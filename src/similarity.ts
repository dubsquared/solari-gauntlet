#!/usr/bin/env tsx
/**
 * Cross-batch clone detection. Loads every repo's committed fingerprint and
 * compares them pairwise, flagging suspicious overlap. Pure deterministic
 * compute over MinHash signatures — no sandbox, no API, no tokens.
 * `npm run similarity` writes reports/similarity.md.
 */
import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { similarity, type Fingerprint } from "./fingerprint.js"

// Jaccard thresholds. Structural overlap is expected between repos in the same
// ecosystem, so the bar for "flag it" is deliberately high.
const CLONE = 0.8 // near-identical — almost certainly the same code
const NOTABLE = 0.4 // substantial shared structure — worth a human glance

interface Entry {
  slug: string
  repoUrl: string
  fp: Fingerprint
}

async function loadFingerprints(reportsRoot: string): Promise<Entry[]> {
  const entries: Entry[] = []
  for (const e of await readdir(reportsRoot, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    try {
      const fp = JSON.parse(await readFile(join(reportsRoot, e.name, "fingerprint.json"), "utf8")) as {
        fingerprint: Fingerprint
        repoUrl: string
      }
      if (fp.fingerprint?.minhash?.length) entries.push({ slug: e.name, repoUrl: fp.repoUrl, fp: fp.fingerprint })
    } catch {
      /* no fingerprint for this review (PR diff, or pre-feature) */
    }
  }
  return entries
}

interface Pair {
  a: Entry
  b: Entry
  score: number
}

export function comparePairs(entries: Entry[]): Pair[] {
  const pairs: Pair[] = []
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++) {
      const score = similarity(entries[i].fp, entries[j].fp)
      if (score >= NOTABLE) pairs.push({ a: entries[i], b: entries[j], score })
    }
  return pairs.sort((x, y) => y.score - x.score)
}

export async function buildSimilarity(reportsRoot = "reports"): Promise<{ path: string; flagged: number }> {
  const entries = await loadFingerprints(reportsRoot)
  const pairs = comparePairs(entries)
  const label = (s: number): string => (s >= CLONE ? "🚨 likely clone" : "⚠️ notable overlap")
  const short = (u: string): string => u.replace("https://github.com/", "").replace(/\.git$/, "")

  const lines = [
    "# Cross-batch similarity",
    "",
    `${entries.length} fingerprinted submission(s) compared pairwise by MinHash Jaccard over ` +
      "source k-shingles — the MOSS/JPlag method, computed locally at zero token cost.",
    "",
    pairs.length === 0
      ? `No pair exceeded the ${NOTABLE} overlap threshold. No clones detected.`
      : "| Similarity | Verdict | A | B |\n| --- | --- | --- | --- |",
    ...pairs.map(
      (p) =>
        `| ${(p.score * 100).toFixed(0)}% | ${label(p.score)} | [${short(p.a.repoUrl)}](${p.a.slug}/report.md) | [${short(p.b.repoUrl)}](${p.b.slug}/report.md) |`,
    ),
    "",
    "---",
    "_Similarity ≠ plagiarism. Shared boilerplate, a common framework, or forking the " +
      "same template all raise the score legitimately — a flag is a prompt to look, not a verdict. " +
      `Thresholds: clone ≥ ${CLONE}, notable ≥ ${NOTABLE}._`,
  ]
  const path = join(reportsRoot, "similarity.md")
  await writeFile(path, lines.join("\n") + "\n")
  return { path, flagged: pairs.length }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { path, flagged } = await buildSimilarity()
  console.log(`similarity → ${path} (${flagged} pair(s) flagged)`)
}
