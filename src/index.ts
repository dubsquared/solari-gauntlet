#!/usr/bin/env tsx
/**
 * Gauntlet — point it at GitHub repos; it runs each one in a Solari sandbox,
 * looks at the result through a Solari cloud browser, and writes a scored
 * review. See README.md for the full story.
 *
 *   SOLARI_API_KEY=... ANTHROPIC_API_KEY=... npm start -- <repo-url> [more...]
 */
import { SolariClient } from "@solarisdk/sdk"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { planRun, tokenUsage, writeVerdict } from "./ai.js"
import { reviewGui } from "./desktop.js"
import { probeCli, probeWeb, saveRawContext } from "./probe.js"
import {
  appLog,
  bootSandbox,
  buildAndRun,
  cloneRepo,
  gatherContext,
  parseRepoUrl,
  securitySweep,
} from "./sandbox.js"
import { buildArena } from "./arena.js"
import { captureFingerprint } from "./fingerprint.js"
import { fetchPrMeta, parsePrUrl, reviewPr, type PrTarget } from "./pr.js"
import { buildSimilarity } from "./similarity.js"
import { writeIndex, writeReport, type ReportSummary } from "./report.js"
import { findWarmSnapshot, lockfileHash, readSeedPlan, saveWarmSnapshot, syncToRef } from "./warm.js"
import type { ProbeResult } from "./types.js"

const args = process.argv.slice(2)

/** `--name N` or `--name=N`; consumes its value from `rest`. */
function numFlag(name: string, rest: string[], def: number): number {
  const i = rest.findIndex((a) => a === name || a.startsWith(`${name}=`))
  if (i === -1) return def
  const [flag] = rest.splice(i, 1)
  const raw = flag.includes("=") ? flag.split("=")[1] : rest.splice(i, 1)[0]
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) {
    console.error(`${name} needs a positive number, got: ${raw}`)
    process.exit(1)
  }
  return n
}

/** Presence flag: removes it from `rest` and returns whether it was there. */
function boolFlag(name: string, rest: string[]): boolean {
  const i = rest.indexOf(name)
  if (i === -1) return false
  rest.splice(i, 1)
  return true
}

const rest = [...args]
const prComment = boolFlag("--pr-comment", rest)
const dryRunComment = boolFlag("--dry-run-comment", rest)
const prCheck = boolFlag("--pr-check", rest)
const dryRunCheck = boolFlag("--dry-run-check", rest)
const strictCheck = boolFlag("--strict-check", rest)
// Snapshot-warmed environments: reuse a repo's built VM across reviews.
const warm = boolFlag("--warm", rest) || process.env.GAUNTLET_WARM === "1"
const noWarm = boolFlag("--no-warm", rest)
const warmEnabled = warm && !noWarm
// Interactive claim verification: drive the app to check its README's claims.
const verifyClaims = boolFlag("--verify-claims", rest)
// Watch mode: stand and re-review whenever a target's commit changes.
const watch = boolFlag("--watch", rest)
const interval = Math.max(60, Math.round(numFlag("--interval", rest, 300))) // seconds, floor 60
// Starter plan allows 2 concurrent sandboxes; cap defensively above that.
const concurrency = Math.min(8, Math.round(numFlag("--concurrency", rest, 1)))
// Hard ceiling on Anthropic tokens for the whole batch — when the meter
// crosses it, remaining repos are skipped, never silently reviewed on a
// blown budget. GAUNTLET_MAX_TOKENS works too, for CI.
const budgetTokens = numFlag(
  "--budget-tokens",
  rest,
  Number(process.env.GAUNTLET_MAX_TOKENS) || Infinity,
)

const unknownFlags = rest.filter((a) => a.startsWith("-"))
if (unknownFlags.length > 0) console.warn(`ignoring unknown flag(s): ${unknownFlags.join(" ")}`)

let targets: ReturnType<typeof parseRepoUrl>[] = []
const prTargets: PrTarget[] = []
try {
  for (const a of rest.filter((x) => !x.startsWith("-"))) {
    const pr = parsePrUrl(a)
    if (pr) prTargets.push(pr)
    else targets.push(parseRepoUrl(a))
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}
if (targets.length + prTargets.length === 0) {
  console.error("usage: gauntlet <github-repo-or-pr-url> [more urls...]")
  process.exit(1)
}
for (const key of ["SOLARI_API_KEY", "ANTHROPIC_API_KEY"]) {
  if (!process.env[key]) {
    console.error(`missing ${key}`)
    process.exit(1)
  }
}

const pt = new SolariClient({ apiKey: process.env.SOLARI_API_KEY! })

async function review(target: ReturnType<typeof parseRepoUrl>): Promise<ReportSummary> {
  const { url, slug } = target
  console.log(`\n▶ ${url}${target.ref ? ` @ ${target.ref}` : ""}${target.subdir ? ` /${target.subdir}` : ""}`)
  const reportDir = join("reports", slug)

  // Warm-start only applies to plain-repo targets (the re-review case). A
  // subdir target's snapshot layout differs, so those always cold-boot.
  const warmable = warmEnabled && !target.subdir

  // Acquire a ready sandbox with the repo checked out. Warm-start is a pure
  // optimization: if any part of it fails (control channel drop after restore,
  // a bad sync), we discard that VM and cold-boot clean — a review is never
  // failed by a warm miss, only ever made a little slower.
  let sandbox!: Awaited<ReturnType<typeof bootSandbox>>
  let commit!: string
  let workDir!: string
  let seedPlan: Awaited<ReturnType<typeof readSeedPlan>>
  let bootedWarm = false

  const snap = warmable ? await findWarmSnapshot(pt, url) : undefined
  if (snap) {
    let warmVm: Awaited<ReturnType<typeof bootSandbox>> | undefined
    try {
      warmVm = await bootSandbox(pt, snap)
      const synced = await syncToRef(warmVm, target.ref)
      sandbox = warmVm
      commit = synced.commit
      workDir = synced.workDir
      seedPlan = await readSeedPlan(warmVm)
      bootedWarm = true
      console.log(`  sandbox: ${warmVm.sandboxId.slice(0, 24)}… (warm ❄→🔥)`)
    } catch (err) {
      // Discard the flaky warm VM so it can't leak, then fall to cold boot.
      if (warmVm) await warmVm.kill().catch(() => {})
      console.log(`  warm boot missed (${err instanceof Error ? err.message : "error"}), cold-booting`)
    }
  }
  if (!bootedWarm) {
    sandbox = await bootSandbox(pt)
    console.log(`  sandbox: ${sandbox.sandboxId.slice(0, 24)}…`)
    const cloned = await cloneRepo(sandbox, target)
    commit = cloned.commit
    workDir = cloned.workDir
    seedPlan = undefined
  }

  const startedAt = Date.now()
  const tokensBefore = tokenUsage()
  try {
    // Sweep before anything from the repo executes — a hostile postinstall
    // can't scrub evidence it never got to run ahead of.
    const sweep = await securitySweep(sandbox, workDir)
    const context = await gatherContext(sandbox, url, workDir)
    await saveRawContext(reportDir, context)

    // Structural fingerprint for cross-batch clone detection — captured while
    // the repo is in the sandbox, zero tokens, sealed with the rest.
    try {
      const fingerprint = await captureFingerprint(sandbox, workDir)
      await mkdir(reportDir, { recursive: true })
      await writeFile(
        join(reportDir, "fingerprint.json"),
        JSON.stringify({ repoUrl: url, commit, fingerprint }, null, 2) + "\n",
      )
    } catch {
      /* fingerprinting is best-effort */
    }

    // Decide the kind up front so GUI submissions route to a desktop (a
    // screen) instead of being run headless in the sandbox.
    const plan0 = seedPlan ?? (await planRun(context))

    if (plan0.kind === "gui") {
      console.log(`  plan: ${plan0.notes}`)
      console.log(`  🖥  GUI submission → Solari desktop`)
      // Release the planning sandbox before booting the desktop — otherwise we
      // hold two sessions at once and blow the plan's concurrency limit.
      await sandbox.kill().catch(() => {})
      const gui = await reviewGui(target, plan0, reportDir, verifyClaims ? { context } : undefined)
      const probe: ProbeResult = {
        kind: "gui",
        consoleErrors: [],
        screenshot: "screenshot.png",
        streamUrl: gui.streamUrl,
        claims: gui.claims,
        output: gui.steps.map((s) => `$ ${s.cmd} (exit ${s.exitCode})`).join("\n"),
      }
      const b64 = Buffer.from(gui.screenshot).toString("base64")
      const verdict = await writeVerdict(context, gui.steps, probe, undefined, sweep, b64)
      const cost = {
        tokens: tokenUsage().input + tokenUsage().output - tokensBefore.input - tokensBefore.output,
        seconds: (Date.now() - startedAt) / 1000,
      }
      const executedGui = { plan: plan0, steps: gui.steps }
      const { path, flagged } = await writeReport(
        reportDir, url, commit, executedGui, probe, verdict, sweep, cost,
      )
      const total = verdict.runs + verdict.deliversClaims + verdict.codeQuality
      console.log(`  ✔ ${total}/30${flagged ? " ⚠️ flagged" : ""} → ${path}`)
      return { repoUrl: url, slug, total, verdict, flagged }
    }

    // Circuit breaker: one review can never spend more than this on replans.
    const perReviewCap = Number(process.env.GAUNTLET_MAX_TOKENS_PER_REVIEW) || 40_000
    const executed = await buildAndRun(
      sandbox,
      context,
      workDir,
      () => {
        const now = tokenUsage()
        return now.input + now.output - tokensBefore.input - tokensBefore.output < perReviewCap
      },
      plan0,
    )

    let probe: ProbeResult
    if (executed.plan.kind === "web") {
      try {
        probe = await probeWeb(sandbox, executed, reportDir, verifyClaims ? { context } : undefined)
      } catch (err) {
        // Server never came up — judge the failure instead of crashing.
        probe = {
          kind: "web",
          consoleErrors: [],
          output: `probe failed: ${err instanceof Error ? err.message : String(err)}\napp log:\n${await appLog(sandbox)}`,
        }
      }
    } else {
      probe = probeCli(executed)
    }

    const verdict = await writeVerdict(context, executed.steps, probe, executed.testRun, sweep)
    const tokensAfter = tokenUsage()
    const cost = {
      tokens:
        tokensAfter.input + tokensAfter.output - tokensBefore.input - tokensBefore.output,
      seconds: (Date.now() - startedAt) / 1000,
    }
    const { path, flagged } = await writeReport(
      reportDir, url, commit, executed, probe, verdict, sweep, cost,
    )
    const total = verdict.runs + verdict.deliversClaims + verdict.codeQuality
    console.log(`  ✔ ${total}/30${flagged ? " ⚠️ flagged" : ""} → ${path}`)

    // After a green build, checkpoint the warm image for next time. Only when
    // setup actually succeeded — never snapshot a broken environment.
    if (warmable && executed.steps.length > 0 && executed.steps.every((s) => s.exitCode === 0)) {
      const h = await lockfileHash(sandbox, workDir)
      await saveWarmSnapshot(pt, sandbox, url, h, executed.plan)
      console.log(`  ❄ warm snapshot saved (lock ${h})`)
    }
    return { repoUrl: url, slug, total, verdict, flagged }
  } finally {
    // kill(), not close(): close() only drops the control channel and the VM
    // would keep billing until its idle timeout. Never mask the real error.
    await sandbox.kill().catch(() => {})
  }
}

const prOpts = { comment: prComment, dryRunComment, check: prCheck, dryRunCheck, strictCheck }

/** Latest commit sha on a repo target's ref (default branch when unspecified). */
async function currentSha(t: ReturnType<typeof parseRepoUrl>): Promise<string | undefined> {
  const owner = t.url.replace("https://github.com/", "").replace(/\.git$/, "").split("/")
  const q = t.ref ? `?sha=${encodeURIComponent(t.ref)}&per_page=1` : "?per_page=1"
  try {
    const res = await fetch(`https://api.github.com/repos/${owner[0]}/${owner[1]}/commits${q}`, {
      headers: {
        accept: "application/vnd.github+json",
        ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return undefined
    const arr = (await res.json()) as Array<{ sha: string }>
    return arr[0]?.sha
  } catch {
    return undefined
  }
}

/**
 * Watch mode: a standing reviewer. Polls each target's commit sha every
 * `interval`s and re-reviews ONLY when it changes — idle polls are one free
 * GitHub call, so cost tracks real activity, not wall-clock. Warm-start pairs
 * naturally (same repo, over and over). The cumulative --budget-tokens ceiling
 * stops the whole watch, so it can never run unbounded spend.
 */
async function watchLoop(): Promise<never> {
  const seen = new Map<string, string>()
  console.log(
    `👁  watch · ${targets.length + prTargets.length} target(s) · every ${interval}s` +
      (warmEnabled ? " · warm" : "") +
      (Number.isFinite(budgetTokens) ? ` · budget ${Math.round(budgetTokens / 1000)}k tokens` : "") +
      " · Ctrl-C to stop",
  )
  for (;;) {
    const spent = tokenUsage()
    if (spent.input + spent.output >= budgetTokens) {
      console.log(`\n⏹  budget ceiling reached (${Math.round((spent.input + spent.output) / 1000)}k tokens) — watch stopped`)
      process.exit(0)
    }
    for (const t of targets) {
      const sha = await currentSha(t)
      if (!sha || seen.get(t.slug) === sha) continue
      const first = !seen.has(t.slug)
      seen.set(t.slug, sha)
      console.log(`\n🔔 ${first ? "first sight" : "new commit"} ${t.url} @ ${sha.slice(0, 7)}`)
      try {
        await review(t)
        console.log(`  🏟  arena → ${await buildArena()}`)
        await buildSimilarity().catch(() => {})
      } catch (err) {
        console.error(`  ✘ ${t.url}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    for (const p of prTargets) {
      const meta = await fetchPrMeta(p).catch(() => undefined)
      if (!meta || seen.get(p.slug) === meta.headSha) continue
      const first = !seen.has(p.slug)
      seen.set(p.slug, meta.headSha)
      console.log(`\n🔔 ${first ? "first sight" : "new push"} ${p.owner}/${p.repo}#${p.number} @ ${meta.headSha.slice(0, 7)}`)
      try {
        await reviewPr(pt, p, prOpts)
        console.log(`  🏟  arena → ${await buildArena()}`)
      } catch (err) {
        console.error(`  ✘ ${p.owner}/${p.repo}#${p.number}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    await new Promise((r) => setTimeout(r, interval * 1000))
  }
}

if (watch) await watchLoop()

const summaries: ReportSummary[] = []
const skippedForBudget: string[] = []
let failures = 0
const startedBatch = Date.now()
const queue = [...targets]

async function worker(): Promise<void> {
  for (;;) {
    const target = queue.shift()
    if (!target) return
    const spent = tokenUsage()
    if (spent.input + spent.output >= budgetTokens) {
      skippedForBudget.push(target.url)
      continue
    }
    try {
      summaries.push(await review(target))
    } catch (err) {
      failures++
      console.error(`  ✘ ${target.url}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}

if (concurrency > 1)
  console.log(`running ${targets.length} review(s), ${concurrency} at a time (logs interleave)`)
await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker))

// PR behavioral-diff reviews run after repo reviews, sequentially — each one
// occupies a sandbox for both sides of the diff.
for (const prt of prTargets) {
  const spent = tokenUsage()
  if (spent.input + spent.output >= budgetTokens) {
    skippedForBudget.push(`PR ${prt.owner}/${prt.repo}#${prt.number}`)
    continue
  }
  try {
    await reviewPr(pt, prt, prOpts)
  } catch (err) {
    failures++
    console.error(
      `  ✘ ${prt.owner}/${prt.repo}#${prt.number}: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

if (summaries.length > 1) {
  const index = await writeIndex("reports", summaries)
  console.log(`\nranked index → ${index}`)
}

// Keep the public scoreboard in sync with whatever we just reviewed.
if (summaries.length > 0 || prTargets.length > 0) {
  await buildArena().then((p) => console.log(`arena → ${p}`)).catch(() => {})
  await buildSimilarity()
    .then((r) => console.log(`similarity → ${r.path} (${r.flagged} pair(s) flagged)`))
    .catch(() => {})
}

// The line a finance team actually wants to see.
const total = tokenUsage()
console.log(
  `\nbatch: ${summaries.length} reviewed, ${failures} failed` +
    (skippedForBudget.length > 0
      ? `, ${skippedForBudget.length} skipped at the --budget-tokens ceiling`
      : "") +
    ` · ${Math.round((Date.now() - startedBatch) / 1000)}s · ${Math.round((total.input + total.output) / 1000)}k tokens` +
    (Number.isFinite(budgetTokens) ? ` of ${Math.round(budgetTokens / 1000)}k budget` : ""),
)
for (const url of skippedForBudget) console.log(`  ⏸ skipped: ${url}`)

// Any failed or budget-skipped review is a nonzero exit — CI callers need to
// see partial completion.
process.exit(failures > 0 || skippedForBudget.length > 0 ? 1 : 0)
