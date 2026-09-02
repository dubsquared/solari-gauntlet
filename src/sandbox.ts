/** Sandbox side: clone the repo, gather context for the planner, execute plans. */
import { SolariClient, type Sandbox } from "@solarisdk/sdk"

import { planRun, revisePlan, UNTRUSTED_CLOSE, UNTRUSTED_OPEN } from "./ai.js"
import type { RunPlan, SecuritySweep, StepResult, TestRun } from "./types.js"

const REPO_DIR = "/home/user/repo"
const MAX_PLAN_ATTEMPTS = 3

/**
 * Reject anything but a plain https GitHub repo URL before it goes anywhere
 * near a shell. Returns the canonical URL and an fs-safe slug.
 */
export function parseRepoUrl(input: string): { url: string; slug: string } {
  let u: URL
  try {
    u = new URL(input)
  } catch {
    throw new Error(`not a URL: ${input}`)
  }
  if (u.protocol !== "https:" || u.hostname !== "github.com")
    throw new Error(`only https://github.com/<owner>/<repo> URLs are accepted: ${input}`)
  const m = u.pathname.match(/^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(\.git)?\/?$/)
  if (!m) throw new Error(`URL path is not <owner>/<repo>: ${input}`)
  return {
    url: `https://github.com/${m[1]}/${m[2]}.git`,
    slug: `${m[1]}-${m[2]}`.replace(/\.+/g, "."),
  }
}

export async function bootSandbox(pt: SolariClient): Promise<Sandbox> {
  const sandbox = await pt.sandboxes.create({
    template: "base",
    // Rolling idle window, not a hard deadline — resets on every command.
    timeoutMs: 10 * 60_000,
  })
  try {
    await sandbox.connect()
  } catch (err) {
    // A VM we failed to connect to would otherwise idle-bill for 10 minutes.
    await sandbox.kill().catch(() => {})
    throw err
  }
  return sandbox
}

/** `commands.run` is not shell-interpreted, so everything goes through sh -c. */
export async function sh(sandbox: Sandbox, cmd: string, timeoutMs = 180_000): Promise<StepResult> {
  const out = await sandbox.commands.run("sh", { args: ["-c", cmd], timeoutMs })
  return { cmd, exitCode: out.exitCode, stdout: out.stdout, stderr: out.stderr }
}

/** Clone via argv (no shell interpolation of the URL) and report the HEAD sha. */
export async function cloneRepo(sandbox: Sandbox, repoUrl: string): Promise<string> {
  const clone = await sandbox.commands.run("git", {
    args: ["clone", "--depth", "1", "--", repoUrl, REPO_DIR],
    timeoutMs: 120_000,
  })
  if (clone.exitCode !== 0) throw new Error(`clone failed: ${clone.stderr.slice(-500)}`)
  const head = await sh(sandbox, `cd ${REPO_DIR} && git rev-parse --short HEAD`)
  return head.stdout.trim()
}

/**
 * File tree + README + manifests + source excerpts. The excerpts exist so the
 * verdict's codeQuality score is grounded in code the model actually saw.
 */
export async function gatherContext(sandbox: Sandbox, repoUrl: string): Promise<string> {
  const tree = await sh(
    sandbox,
    `cd ${REPO_DIR} && find . -path ./.git -prune -o -type f -print | head -200`,
  )
  const readme = await sh(
    sandbox,
    `cd ${REPO_DIR} && head -c 4000 README.md 2>/dev/null || head -c 4000 readme.md 2>/dev/null || true`,
  )
  const manifests = await sh(
    sandbox,
    `cd ${REPO_DIR} && for f in package.json requirements.txt pyproject.toml Makefile go.mod Cargo.toml; do ` +
      `[ -f "$f" ] && echo "=== $f ===" && head -c 2000 "$f"; done; true`,
  )
  const sources = await sh(
    sandbox,
    `cd ${REPO_DIR} && find . -path ./.git -prune -o \\( -name node_modules -o -name dist -o -name build -o -name vendor \\) -prune -o ` +
      `-type f \\( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.py' -o -name '*.go' -o -name '*.rs' \\) -print ` +
      `| grep -viE 'test|spec|\\.min\\.|\\.d\\.ts' | sort | head -5 ` +
      `| while read -r f; do echo "=== $f ==="; head -c 3000 "$f"; echo; done; true`,
  )
  return `Repo: ${repoUrl}

File tree:
${UNTRUSTED_OPEN}${tree.stdout}${UNTRUSTED_CLOSE}

README (first 4KB):
${UNTRUSTED_OPEN}${readme.stdout || "(none)"}${UNTRUSTED_CLOSE}

Manifests:
${UNTRUSTED_OPEN}${manifests.stdout || "(none)"}${UNTRUSTED_CLOSE}

Source excerpts (up to 5 files, first 3KB each):
${UNTRUSTED_OPEN}${sources.stdout || "(none found)"}${UNTRUSTED_CLOSE}`
}

export interface ExecutedPlan {
  plan: RunPlan
  steps: StepResult[]
  testRun?: TestRun
}

/**
 * Inspect the working tree while we have it — BEFORE any of its code runs, so
 * a hostile postinstall can't scrub the evidence. Everything is best-effort:
 * a sweep failure never blocks the review.
 */
export async function securitySweep(sandbox: Sandbox): Promise<SecuritySweep> {
  const sweep: SecuritySweep = { secretHits: [] }
  try {
    const secrets = await sh(
      sandbox,
      `cd ${REPO_DIR} && grep -rElI --exclude-dir=.git ` +
        `'AKIA[0-9A-Z]{16}|-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY|sk-ant-[a-zA-Z0-9]|ghp_[A-Za-z0-9]{36}|xox[bap]-[0-9]' ` +
        `. 2>/dev/null | head -10; true`,
    )
    sweep.secretHits = secrets.stdout.split("\n").filter(Boolean)
  } catch {
    /* best effort */
  }
  try {
    const hasLock = await sh(sandbox, `test -f ${REPO_DIR}/package-lock.json && echo yes || echo no`)
    if (hasLock.stdout.trim() === "yes") {
      // audit reads the lockfile only — no install, no scripts execute.
      const audit = await sh(
        sandbox,
        `cd ${REPO_DIR} && npm audit --omit=dev --json 2>/dev/null | ` +
          `python3 -c "import json,sys; v=json.load(sys.stdin).get('metadata',{}).get('vulnerabilities',{}); print(', '.join(f'{k}: {n}' for k,n in v.items() if n) or 'no known vulnerabilities')" || true`,
        120_000,
      )
      sweep.auditSummary = audit.stdout.trim() || undefined
    }
  } catch {
    /* best effort */
  }
  return sweep
}

/**
 * Plan → execute → on failure, feed the error back and replan. The loop that
 * makes this an agent instead of a script.
 */
export async function buildAndRun(sandbox: Sandbox, context: string): Promise<ExecutedPlan> {
  const priorPlans: RunPlan[] = []
  let plan = await planRun(context)
  const steps: StepResult[] = []

  for (let attempt = 1; attempt <= MAX_PLAN_ATTEMPTS; attempt++) {
    console.log(`  plan (attempt ${attempt}): ${plan.notes}`)
    let failed: StepResult | undefined

    for (const cmd of plan.setup) {
      const res = await sh(sandbox, `cd ${REPO_DIR} && ${cmd}`, 300_000)
      steps.push(res)
      console.log(`    $ ${cmd} → exit ${res.exitCode}`)
      if (res.exitCode !== 0) {
        failed = res
        break
      }
    }

    if (!failed) {
      // The submission's own tests, before the server claims the port. A test
      // failure is evidence for the verdict, never a reason to abort the run.
      let testRun: TestRun | undefined
      if (plan.test) {
        const t = await sh(sandbox, `cd ${REPO_DIR} && CI=true ${plan.test}`, 300_000)
        testRun = { cmd: plan.test, exitCode: t.exitCode, output: (t.stdout + t.stderr).slice(-3000) }
        console.log(`    $ ${plan.test} → ${t.exitCode === 0 ? "tests PASS" : `tests FAIL (exit ${t.exitCode})`}`)
      }

      if (plan.kind === "web") {
        // Background the server, then verify it survived its first seconds —
        // otherwise a crash-on-boot reports exit 0 here and the self-healing
        // loop never fires on the one path the tool exists for.
        const launch = await sh(
          sandbox,
          `cd ${REPO_DIR} && nohup sh -c '${plan.run.replaceAll("'", "'\\''")}' >/tmp/app.log 2>&1 & ` +
            `echo $! >/tmp/app.pid; sleep 4; kill -0 "$(cat /tmp/app.pid)" 2>/dev/null`,
        )
        if (launch.exitCode === 0) {
          steps.push({ ...launch, cmd: plan.run })
          console.log(`    $ ${plan.run} (background, alive after 4s)`)
          return { plan, steps, testRun }
        }
        const log = await appLog(sandbox)
        failed = { cmd: plan.run, exitCode: launch.exitCode || 1, stdout: "", stderr: log }
        steps.push(failed)
        console.log(`    $ ${plan.run} → died on startup`)
      } else {
        const res = await sh(sandbox, `cd ${REPO_DIR} && ${plan.run}`, 300_000)
        steps.push(res)
        console.log(`    $ ${plan.run} → exit ${res.exitCode}`)
        if (res.exitCode === 0) return { plan, steps, testRun }
        failed = res
      }
    }

    if (attempt === MAX_PLAN_ATTEMPTS) break
    priorPlans.push(plan)
    plan = await revisePlan(context, [...priorPlans], failed)
  }

  // Out of attempts: return what happened so the verdict can judge the failure.
  return { plan, steps }
}

/** Tail of the server log — evidence for the verdict when a web app misbehaves. */
export async function appLog(sandbox: Sandbox): Promise<string> {
  const res = await sh(sandbox, "tail -c 2000 /tmp/app.log 2>/dev/null || true")
  return res.stdout
}
