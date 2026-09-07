/**
 * PR behavioral-diff mode: run BOTH sides of a pull request in one sandbox
 * and review the delta — tests that flipped, load time that moved, failure
 * probes that started leaking. Evidence no static reviewer can produce.
 */
import { SolariClient } from "@solarisdk/sdk"
import type { Sandbox } from "@solarisdk/sdk"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { tokenUsage, writeDiffVerdict } from "./ai.js"
import { probeWeb } from "./probe.js"
import {
  bootSandbox,
  buildAndRun,
  gatherContext,
  securitySweep,
  sh,
  type ExecutedPlan,
} from "./sandbox.js"
import { sanitize, sealEvidence } from "./report.js"
import type { DiffVerdict, PrMeta, ProbeResult, SideEvidence } from "./types.js"

const REPO_DIR = "/home/user/repo"

export interface PrTarget {
  owner: string
  repo: string
  number: number
  slug: string
}

/** `https://github.com/<owner>/<repo>/pull/<n>` */
export function parsePrUrl(input: string): PrTarget | undefined {
  const m = input.match(
    /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)\/?$/,
  )
  if (!m) return undefined
  return { owner: m[1], repo: m[2], number: Number(m[3]), slug: `${m[1]}-${m[2]}-pr${m[3]}` }
}

export async function fetchPrMeta(t: PrTarget): Promise<PrMeta> {
  const res = await fetch(`https://api.github.com/repos/${t.owner}/${t.repo}/pulls/${t.number}`, {
    headers: { accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status} resolving PR #${t.number}`)
  const pr = (await res.json()) as {
    title: string
    body: string | null
    base: { ref: string; sha: string; repo: { clone_url: string } }
    head: { ref: string; sha: string; repo: { clone_url: string } | null }
  }
  if (!pr.head.repo) throw new Error("PR head repository is gone (fork deleted)")
  return {
    number: t.number,
    title: pr.title,
    body: pr.body ?? "",
    baseRef: pr.base.ref,
    baseSha: pr.base.sha,
    headRef: pr.head.ref,
    headSha: pr.head.sha,
    headCloneUrl: pr.head.repo.clone_url,
  }
}

/**
 * Free the port the previous side's server holds, without ending the VM. The
 * pidfile only names the `sh` wrapper, so also reap whatever is actually bound
 * to the port (fuser) — otherwise the next side can't bind and looks broken.
 */
async function stopApp(sandbox: Sandbox, port: number | undefined): Promise<void> {
  const killPort = port ? `fuser -k ${port}/tcp 2>/dev/null || true;` : ""
  // Negative PID kills the whole process group setsid created — reaps the
  // orphaned server child, not just the wrapper. fuser is a best-effort extra.
  await sh(
    sandbox,
    `PID=$(cat /tmp/app.pid 2>/dev/null); [ -n "$PID" ] && { kill -- -"$PID" 2>/dev/null; kill "$PID" 2>/dev/null; }; ` +
      `${killPort} rm -f /tmp/app.pid /tmp/app.log; sleep 1; true`,
  )
}

function evidence(
  label: "base" | "head",
  sha: string,
  executed: ExecutedPlan,
  probe: ProbeResult | undefined,
): SideEvidence {
  return {
    label,
    sha: sha.slice(0, 7),
    buildOk: executed.steps.every((s) => s.exitCode === 0) && executed.steps.length > 0,
    testsPass: executed.testRun ? executed.testRun.exitCode === 0 : null,
    loadMs: probe?.loadMs ?? null,
    consoleErrors: probe?.consoleErrors.length ?? 0,
    hostileLeaks: probe?.hostile?.filter((h) => h.leakedTrace).length ?? 0,
    probeOk: probe?.title !== undefined,
  }
}

export async function reviewPr(
  pt: SolariClient,
  t: PrTarget,
): Promise<{ assessment: DiffVerdict["assessment"]; path: string }> {
  const pr = await fetchPrMeta(t)
  console.log(
    `\n▶ PR #${pr.number} ${JSON.stringify(pr.title.slice(0, 60))} — ${pr.baseRef}@${pr.baseSha.slice(0, 7)} vs ${pr.headRef}@${pr.headSha.slice(0, 7)}`,
  )
  const reportDir = join("reports", t.slug)
  const startedAt = Date.now()
  const tokensBefore = tokenUsage()
  const sandbox = await bootSandbox(pt)

  try {
    // Base clone, then fetch the head side into the same repo (fork-safe).
    const baseUrl = `https://github.com/${t.owner}/${t.repo}.git`
    const clone = await sandbox.commands.run("git", {
      args: ["clone", "--branch", pr.baseRef, "--", baseUrl, REPO_DIR],
      timeoutMs: 180_000,
    })
    if (clone.exitCode !== 0) throw new Error(`clone failed: ${clone.stderr.slice(-400)}`)
    const fetchHead = await sandbox.commands.run("git", {
      args: ["-C", REPO_DIR, "fetch", "--", pr.headCloneUrl, pr.headSha],
      timeoutMs: 180_000,
    })
    if (fetchHead.exitCode !== 0)
      throw new Error(`head fetch failed: ${fetchHead.stderr.slice(-400)}`)

    // Diff evidence, computed before anything from the repo executes.
    const diffStat = await sh(sandbox, `cd ${REPO_DIR} && git diff --stat ${pr.baseSha} ${pr.headSha} | tail -30`)
    const diffHunks = await sh(sandbox, `cd ${REPO_DIR} && git diff ${pr.baseSha} ${pr.headSha} | head -c 12000`)
    const sweep = await securitySweep(sandbox, REPO_DIR)
    const context = await gatherContext(sandbox, baseUrl, REPO_DIR)

    const sides: SideEvidence[] = []
    let sideProbe: Record<string, ProbeResult | undefined> = {}
    for (const side of [
      { label: "base" as const, sha: pr.baseSha },
      { label: "head" as const, sha: pr.headSha },
    ]) {
      await sh(sandbox, `cd ${REPO_DIR} && git checkout -q ${side.sha} -- . && git checkout -q ${side.sha}`)
      console.log(`  ── ${side.label} @ ${side.sha.slice(0, 7)}`)
      const executed = await buildAndRun(sandbox, context, REPO_DIR)
      let probe: ProbeResult | undefined
      if (executed.plan.kind === "web" && executed.steps.every((s) => s.exitCode === 0)) {
        await mkdir(join(reportDir, side.label), { recursive: true })
        probe = await probeWeb(sandbox, executed, join(reportDir, side.label)).catch(() => undefined)
      }
      await stopApp(sandbox, executed.plan.port)
      sides.push(evidence(side.label, side.sha, executed, probe))
      sideProbe[side.label] = probe
    }

    const verdict = await writeDiffVerdict(pr, context, sides, diffStat.stdout, diffHunks.stdout)
    const spent = tokenUsage()
    const cost = {
      tokens: spent.input + spent.output - tokensBefore.input - tokensBefore.output,
      seconds: (Date.now() - startedAt) / 1000,
    }
    const path = await writePrReport(reportDir, t, pr, sides, verdict, sideProbe, sweep.secretHits, cost)
    console.log(`  ✔ ${verdict.assessment.toUpperCase()} → ${path}`)
    return { assessment: verdict.assessment, path }
  } finally {
    await sandbox.kill().catch(() => {})
  }
}

const icon = { improvement: "🟢", regression: "🔴", neutral: "⚪", mixed: "🟡" } as const

async function writePrReport(
  reportDir: string,
  t: PrTarget,
  pr: PrMeta,
  sides: SideEvidence[],
  verdict: DiffVerdict,
  probes: Record<string, ProbeResult | undefined>,
  secretHits: string[],
  cost: { tokens: number; seconds: number },
): Promise<string> {
  const fmt = (v: unknown): string => (v === null || v === undefined ? "–" : String(v))
  const row = (label: string, f: (s: SideEvidence) => unknown): string => {
    const [b, h] = sides
    return `| ${label} | ${fmt(f(b))} | ${fmt(f(h))} |`
  }
  const lines = [
    `# Gauntlet PR review — ${t.owner}/${t.repo}#${pr.number}`,
    "",
    `${icon[verdict.assessment]} **${verdict.assessment.toUpperCase()}** · ${sanitize(pr.title)}`,
    "",
    `\`${pr.baseRef}\` @ ${pr.baseSha.slice(0, 7)} → \`${pr.headRef}\` @ ${pr.headSha.slice(0, 7)} · ${Math.round(cost.seconds)}s · ~${Math.round(cost.tokens / 1000)}k tokens · advisory, not a merge gate`,
    "",
    sanitize(verdict.summary),
    "",
    "## Measured, not claimed",
    "",
    "| | base | head |",
    "| --- | --- | --- |",
    row("Build", (s) => (s.buildOk ? "✅" : "❌")),
    row("Own tests", (s) => (s.testsPass === null ? "none found" : s.testsPass ? "PASS" : "FAIL")),
    row("Landing DOM load", (s) => (s.loadMs === null ? "–" : `${s.loadMs}ms`)),
    row("Console errors", (s) => s.consoleErrors),
    row("Stack-trace leaks under hostile input", (s) => s.hostileLeaks),
    row("Live probe", (s) => (s.probeOk ? "✅" : "—")),
    "",
    ...(verdict.improvements.length ? ["## Improvements", ...verdict.improvements.map((s) => `- ${sanitize(s)}`), ""] : []),
    ...(verdict.regressions.length ? ["## Regressions", ...verdict.regressions.map((s) => `- ${sanitize(s)}`), ""] : []),
    ...(verdict.concerns.length ? ["## Concerns", ...verdict.concerns.map((s) => `- ${sanitize(s)}`), ""] : []),
    ...(secretHits.length ? [`⚠️ secret patterns matched in: ${secretHits.map((h) => `\`${sanitize(h)}\``).join(", ")}`, ""] : []),
  ]
  for (const side of ["base", "head"] as const) {
    const p = probes[side]
    if (p?.screenshot)
      lines.push(`### ${side} — what the cloud browser saw`, "", `![${side}](${side}/${p.screenshot})`, "")
    if (p?.replayFile)
      lines.push(`📼 ${side} replay: [\`${side}/${p.replayFile}\`](${side}/${p.replayFile})`, "")
  }
  lines.push(
    "---",
    "Both sides ran in one disposable Solari sandbox; the browser evidence is a",
    "real Chromium on a public preview URL. Evidence sealed and ed25519-signed",
    "in [`manifest.json`](manifest.json) — `npm run verify` proves integrity.",
  )
  await mkdir(reportDir, { recursive: true })
  const path = join(reportDir, "report.md")
  await writeFile(path, lines.join("\n") + "\n")
  await writeFile(
    join(reportDir, "verdict.json"),
    JSON.stringify({ pr: `${t.owner}/${t.repo}#${pr.number}`, ...verdict, sides, cost }, null, 2) + "\n",
  )
  await sealEvidence(reportDir, `https://github.com/${t.owner}/${t.repo}/pull/${pr.number}`, pr.headSha.slice(0, 7))
  return path
}
