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

import { writeVerdict } from "./ai.js"
import { probeCli, probeWeb, saveRawContext } from "./probe.js"
import { appLog, bootSandbox, buildAndRun, cloneRepo, gatherContext } from "./sandbox.js"
import { writeReport } from "./report.js"
import type { ProbeResult } from "./types.js"

const repos = process.argv.slice(2).filter((a) => !a.startsWith("-"))
if (repos.length === 0) {
  console.error("usage: gauntlet <github-repo-url> [more urls...]")
  process.exit(1)
}
for (const key of ["SOLARI_API_KEY", "ANTHROPIC_API_KEY"]) {
  if (!process.env[key]) {
    console.error(`missing ${key}`)
    process.exit(1)
  }
}

function slug(repoUrl: string): string {
  return repoUrl
    .replace(/\.git$/, "")
    .split("/")
    .slice(-2)
    .join("-")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
}

const pt = new SolariClient({ apiKey: process.env.SOLARI_API_KEY! })

async function review(repoUrl: string): Promise<void> {
  console.log(`\n▶ ${repoUrl}`)
  const reportDir = join("reports", slug(repoUrl))
  const sandbox = await bootSandbox(pt)
  console.log(`  sandbox: ${sandbox.sandboxId}`)

  try {
    await cloneRepo(sandbox, repoUrl)
    const context = await gatherContext(sandbox, repoUrl)
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

    const verdict = await writeVerdict(context, executed.steps, probe)
    const path = await writeReport(reportDir, repoUrl, executed, probe, verdict)
    const total = verdict.runs + verdict.deliversClaims + verdict.codeQuality
    console.log(`  ✔ ${total}/30 → ${path}`)
  } finally {
    // kill(), not close(): close() only drops the control channel and the VM
    // would keep billing until its idle timeout.
    await sandbox.kill()
  }
}

let failures = 0
for (const repoUrl of repos) {
  try {
    await review(repoUrl)
  } catch (err) {
    failures++
    console.error(`  ✘ ${repoUrl}: ${err instanceof Error ? err.message : String(err)}`)
  }
}
process.exit(failures === repos.length && repos.length > 0 ? 1 : 0)
