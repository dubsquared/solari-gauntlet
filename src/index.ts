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
import { writeIndex, writeReport, type ReportSummary } from "./report.js"
import type { ProbeResult } from "./types.js"

const args = process.argv.slice(2)
const flags = args.filter((a) => a.startsWith("-"))
if (flags.length > 0) console.warn(`ignoring unknown flag(s): ${flags.join(" ")}`)

let targets
try {
  targets = args.filter((a) => !a.startsWith("-")).map(parseRepoUrl)
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}
if (targets.length === 0) {
  console.error("usage: gauntlet <github-repo-url> [more urls...]")
  process.exit(1)
}
for (const key of ["SOLARI_API_KEY", "ANTHROPIC_API_KEY"]) {
  if (!process.env[key]) {
    console.error(`missing ${key}`)
    process.exit(1)
  }
}

const pt = new SolariClient({ apiKey: process.env.SOLARI_API_KEY! })

async function review(url: string, slug: string): Promise<ReportSummary> {
  console.log(`\n▶ ${url}`)
  const reportDir = join("reports", slug)
  const sandbox = await bootSandbox(pt)
  console.log(`  sandbox: ${sandbox.sandboxId.slice(0, 24)}…`)

  const startedAt = Date.now()
  const tokensBefore = tokenUsage()
  try {
    const commit = await cloneRepo(sandbox, url)
    // Sweep before anything from the repo executes — a hostile postinstall
    // can't scrub evidence it never got to run ahead of.
    const sweep = await securitySweep(sandbox)
    const context = await gatherContext(sandbox, url)
    await saveRawContext(reportDir, context)

    const executed = await buildAndRun(sandbox, context)

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
let failures = 0
for (const { url, slug } of targets) {
  try {
    summaries.push(await review(url, slug))
  } catch (err) {
    failures++
    console.error(`  ✘ ${url}: ${err instanceof Error ? err.message : String(err)}`)
  }
}

if (summaries.length > 1) {
  const index = await writeIndex("reports", summaries)
  console.log(`\nranked index → ${index}`)
}

// Any failed review is a nonzero exit — CI callers need to see partial failure.
process.exit(failures > 0 ? 1 : 0)
