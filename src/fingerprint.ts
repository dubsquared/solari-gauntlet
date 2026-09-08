/**
 * Deterministic structural fingerprinting for clone detection — the MOSS/JPlag
 * approach, not embeddings. A MinHash signature over k-shingles of the repo's
 * source tokens lets us estimate the Jaccard similarity of any two repos by
 * comparing fixed-length signatures. Zero tokens, no new provider, no
 * per-comparison cost — the only kind of similarity a finance team signs off on.
 */
import type { Sandbox } from "@solarisdk/sdk"

import { sh } from "./sandbox.js"

const N = 128 // signature length — more = tighter Jaccard estimate
const K = 5 // shingle size in tokens
const MIN_SHINGLES = 20 // below this a repo is too small to fingerprint meaningfully

export interface Fingerprint {
  minhash: number[]
  tokens: number
  shingles: number
}

/** FNV-1a 32-bit, seeded — fast, deterministic, dependency-free. */
function hash32(s: string, seed: number): number {
  let h = (2166136261 ^ seed) >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

/** Build a MinHash signature from raw source text. */
export function fingerprintText(text: string): Fingerprint {
  const tokens = text.toLowerCase().match(/[a-z0-9_]+/g) ?? []
  const shingles = new Set<string>()
  for (let i = 0; i + K <= tokens.length; i++) shingles.add(tokens.slice(i, i + K).join(" "))
  const mins = new Array<number>(N).fill(0xffffffff)
  for (const sh of shingles) {
    for (let j = 0; j < N; j++) {
      const h = hash32(sh, j)
      if (h < mins[j]) mins[j] = h
    }
  }
  return { minhash: mins, tokens: tokens.length, shingles: shingles.size }
}

/**
 * Concatenate the repo's source (bounded), normalized, and fingerprint it.
 * One extra sandbox command; no tokens. Import/comment lines are kept — clones
 * copy them too — but pure whitespace is dropped so formatting noise doesn't count.
 */
export async function captureFingerprint(sandbox: Sandbox, workDir: string): Promise<Fingerprint> {
  const res = await sh(
    sandbox,
    `cd ${workDir} && find . -path ./.git -prune -o ` +
      `\\( -name node_modules -o -name dist -o -name build -o -name vendor -o -name .venv \\) -prune -o ` +
      `-type f \\( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.py' ` +
      `-o -name '*.go' -o -name '*.rs' -o -name '*.java' -o -name '*.rb' -o -name '*.html' -o -name '*.css' \\) -print ` +
      `| grep -viE '\\.min\\.|\\.d\\.ts' | sort | head -300 ` +
      `| while read -r f; do cat "$f"; done 2>/dev/null | grep -v '^[[:space:]]*$' | head -c 500000`,
    120_000,
  )
  return fingerprintText(res.stdout)
}

/** Estimated Jaccard similarity in [0,1]; 0 when either side is too small. */
export function similarity(a: Fingerprint, b: Fingerprint): number {
  if (a.shingles < MIN_SHINGLES || b.shingles < MIN_SHINGLES) return 0
  if (a.minhash.length !== b.minhash.length || a.minhash.length === 0) return 0
  let eq = 0
  for (let i = 0; i < a.minhash.length; i++) if (a.minhash[i] === b.minhash[i]) eq++
  return eq / a.minhash.length
}
