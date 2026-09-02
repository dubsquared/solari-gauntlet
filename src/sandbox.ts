/** Sandbox side: clone the repo, gather context for the planner, execute plans. */
import { SolariClient, type Sandbox } from "@solarisdk/sdk"

import { planRun, revisePlan } from "./ai.js"
import type { RunPlan, StepResult } from "./types.js"

const REPO_DIR = "/home/user/repo"
const MAX_PLAN_ATTEMPTS = 3

export async function bootSandbox(pt: SolariClient): Promise<Sandbox> {
  const sandbox = await pt.sandboxes.create({
    template: "base",
    // Rolling idle window, not a hard deadline — resets on every command.
    timeoutMs: 10 * 60_000,
  })
  await sandbox.connect()
  return sandbox
}

/** `commands.run` is not shell-interpreted, so everything goes through sh -c. */
export async function sh(sandbox: Sandbox, cmd: string, timeoutMs = 180_000): Promise<StepResult> {
  const out = await sandbox.commands.run("sh", { args: ["-c", cmd], timeoutMs })
  return { cmd, exitCode: out.exitCode, stdout: out.stdout, stderr: out.stderr }
}

export async function cloneRepo(sandbox: Sandbox, repoUrl: string): Promise<void> {
  const res = await sh(sandbox, `git clone --depth 1 ${repoUrl} ${REPO_DIR}`)
  if (res.exitCode !== 0) throw new Error(`clone failed: ${res.stderr.slice(-500)}`)
}

/** File tree + README + manifests: everything the planner needs, nothing more. */
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
  return `Repo: ${repoUrl}

File tree:
${tree.stdout}

README (first 4KB):
${readme.stdout || "(none)"}

Manifests:
${manifests.stdout || "(none)"}`
}

export interface ExecutedPlan {
  plan: RunPlan
  steps: StepResult[]
}

/**
 * Plan → execute → on failure, feed the error back and replan. The loop that
 * makes this an agent instead of a script.
 */
export async function buildAndRun(sandbox: Sandbox, context: string): Promise<ExecutedPlan> {
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
      if (plan.kind === "web") {
        // Servers block until the idle timeout if run in the foreground.
        const res = await sh(
          sandbox,
          `cd ${REPO_DIR} && nohup sh -c '${plan.run.replaceAll("'", "'\\''")}' >/tmp/app.log 2>&1 & sleep 1`,
        )
        steps.push({ ...res, cmd: plan.run })
        console.log(`    $ ${plan.run} (background)`)
        return { plan, steps }
      }
      const res = await sh(sandbox, `cd ${REPO_DIR} && ${plan.run}`, 300_000)
      steps.push(res)
      console.log(`    $ ${plan.run} → exit ${res.exitCode}`)
      if (res.exitCode === 0) return { plan, steps }
      failed = res
    }

    if (attempt === MAX_PLAN_ATTEMPTS) break
    plan = await revisePlan(context, plan, failed)
  }

  // Out of attempts: return what happened so the verdict can judge the failure.
  return { plan, steps }
}

/** Tail of the server log — evidence for the verdict when a web app misbehaves. */
export async function appLog(sandbox: Sandbox): Promise<string> {
  const res = await sh(sandbox, "tail -c 2000 /tmp/app.log 2>/dev/null || true")
  return res.stdout
}
