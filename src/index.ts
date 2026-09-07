#!/usr/bin/env tsx
/**
 * Gauntlet — point it at GitHub repos; it runs each one in a Solari sandbox,
 * looks at the result through a Solari cloud browser, and writes a scored
 * review. See README.md for the full story.
 *
 *   SOLARI_API_KEY=... ANTHROPIC_API_KEY=... npm start -- <repo-url> [more...]
 */
import { SolariClient } from "@solarisdk/sdk"
import { join } from "node:path"

import { tokenUsage, writeVerdict } from "./ai.js"
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
import { parsePrUrl, reviewPr, type PrTarget } from "./pr.js"
import { writeIndex, writeReport, type ReportSummary } from "./report.js"
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

const rest = [...args]
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
  const sandbox = await bootSandbox(pt)
  console.log(`  sandbox: ${sandbox.sandboxId.slice(0, 24)}…`)

  const startedAt = Date.now()
  const tokensBefore = tokenUsage()
  try {
    const { commit, workDir } = await cloneRepo(sandbox, target)
    // Sweep before anything from the repo executes — a hostile postinstall
    // can't scrub evidence it never got to run ahead of.
    const sweep = await securitySweep(sandbox, workDir)
    const context = await gatherContext(sandbox, url, workDir)
    await saveRawContext(reportDir, context)

    // Circuit breaker: one review can never spend more than this on replans.
    const perReviewCap = Number(process.env.GAUNTLET_MAX_TOKENS_PER_REVIEW) || 40_000
    const executed = await buildAndRun(sandbox, context, workDir, () => {
      const now = tokenUsage()
      return now.input + now.output - tokensBefore.input - tokensBefore.output < perReviewCap
    })

    let probe: ProbeResult
    if (executed.plan.kind === "web") {
      try {
        probe = await probeWeb(sandbox, executed, reportDir)
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
    return { repoUrl: url, slug, total, verdict, flagged }
  } finally {
    // kill(), not close(): close() only drops the control channel and the VM
    // would keep billing until its idle timeout. Never mask the real error.
    await sandbox.kill().catch(() => {})
  }
}

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
    await reviewPr(pt, prt)
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
