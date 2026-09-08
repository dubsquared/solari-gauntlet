#!/usr/bin/env tsx
/**
 * Backfill fingerprints for already-reviewed repos WITHOUT re-running the
 * sandbox. The MinHash fingerprint is a pure function of source text, so
 * cloning each repo locally and fingerprinting it produces the identical
 * signature a sandbox capture would — at zero sandbox and zero token cost.
 * One-shot maintenance tool: `npm run fingerprint:backfill`.
 */
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { fingerprintText, type Fingerprint } from "./fingerprint.js"

const SRC = /\.(ts|tsx|js|jsx|py|go|rs|java|rb|html|css)$/
const SKIP = new Set(["node_modules", "dist", "build", "vendor", ".venv", ".git"])

function gatherSource(dir: string, acc: string[], budget = { bytes: 500_000, files: 300 }): void {
  if (budget.files <= 0 || budget.bytes <= 0) return
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (budget.files <= 0 || budget.bytes <= 0) return
    if (e.isDirectory()) {
      if (!SKIP.has(e.name)) gatherSource(join(dir, e.name), acc, budget)
    } else if (SRC.test(e.name) && !/\.min\.|\.d\.ts$/.test(e.name)) {
      try {
        const t = readFileSync(join(dir, e.name), "utf8").replace(/^[ \t]*\n/gm, "")
        acc.push(t.slice(0, budget.bytes))
        budget.bytes -= t.length
        budget.files--
      } catch {
        /* skip unreadable */
      }
    }
  }
}

function fingerprintRepo(repoUrl: string, ref?: string, subdir?: string): Fingerprint {
  const tmp = mkdtempSync(join(tmpdir(), "gauntlet-fp-"))
  const args = ["clone", "--depth", "1"]
  if (ref) args.push("--branch", ref)
  args.push("--", repoUrl, tmp)
  execFileSync("git", args, { stdio: "ignore", timeout: 120_000 })
  const root = subdir ? join(tmp, subdir) : tmp
  const acc: string[] = []
  gatherSource(existsSync(root) ? root : tmp, acc)
  return fingerprintText(acc.join("\n"))
}

const reportsRoot = "reports"
let done = 0
for (const slug of readdirSync(reportsRoot)) {
  const dir = join(reportsRoot, slug)
  const verdictPath = join(dir, "verdict.json")
  if (!existsSync(verdictPath)) continue
  const v = JSON.parse(readFileSync(verdictPath, "utf8"))
  if (typeof v.pr === "string" || typeof v.repoUrl !== "string") continue // skip PR diffs
  if (existsSync(join(dir, "fingerprint.json"))) continue // already has one
  try {
    // Recover branch/subdir from the slug when it encodes them (best-effort).
    const fingerprint = fingerprintRepo(v.repoUrl)
    writeFileSync(
      join(dir, "fingerprint.json"),
      JSON.stringify({ repoUrl: v.repoUrl, commit: v.commit, fingerprint }, null, 2) + "\n",
    )
    console.log(`  ✔ ${slug} (${fingerprint.shingles} shingles)`)
    done++
  } catch (err) {
    console.error(`  ✘ ${slug}: ${err instanceof Error ? err.message : String(err)}`)
  }
}
console.log(`backfilled ${done} fingerprint(s)`)
