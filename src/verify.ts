#!/usr/bin/env tsx
/**
 * `npm run verify -- reports/<slug>` — recompute every artifact hash in a
 * review directory and validate the manifest's ed25519 signature. Exit 0 only
 * when the evidence is byte-identical to what was reviewed and signed.
 */
import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { verifySignature } from "./attest.js"

const dir = process.argv[2]
if (!dir) {
  console.error("usage: npm run verify -- reports/<slug>")
  process.exit(1)
}

const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"))
let failures = 0

for (const [file, expected] of Object.entries(manifest.sha256 as Record<string, string>)) {
  try {
    const actual = createHash("sha256").update(await readFile(join(dir, file))).digest("hex")
    if (actual === expected) console.log(`  ✔ ${file}`)
    else {
      console.error(`  ✘ ${file}: hash mismatch — evidence altered after sealing`)
      failures++
    }
  } catch {
    console.error(`  ✘ ${file}: missing`)
    failures++
  }
}
for (const f of await readdir(dir)) {
  if (f !== "manifest.json" && f !== "context.txt" && !(f in manifest.sha256)) {
    console.error(`  ✘ ${f}: not in manifest — added after sealing`)
    failures++
  }
}

if (manifest.attestation) {
  if (verifySignature(manifest, manifest.attestation)) console.log("  ✔ ed25519 signature valid")
  else {
    console.error("  ✘ ed25519 signature INVALID")
    failures++
  }
} else {
  console.log("  – unsigned manifest (sealed before signing shipped)")
}

console.log(failures === 0 ? `verified: ${dir}` : `FAILED: ${failures} problem(s) in ${dir}`)
process.exit(failures === 0 ? 0 : 1)
