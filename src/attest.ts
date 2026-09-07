/**
 * Verifiable verdicts: every review's evidence manifest is ed25519-signed, so
 * a report can be checked years later — `npm run verify -- reports/<slug>`
 * recomputes every artifact hash and validates the signature. A verdict you
 * can't tamper with is a verdict worth citing.
 */
import { createHash, generateKeyPairSync, sign, verify } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"

const KEY_FILE = ".gauntlet-signing-key" // gitignored; created on first use

interface KeyPair {
  privateKeyPem: string
  publicKeyPem: string
}

export async function loadOrCreateKey(): Promise<KeyPair> {
  try {
    return JSON.parse(await readFile(KEY_FILE, "utf8")) as KeyPair
  } catch {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519")
    const pair: KeyPair = {
      privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    }
    await writeFile(KEY_FILE, JSON.stringify(pair, null, 2), { mode: 0o600 })
    return pair
  }
}

/** Canonical bytes that get signed: the sorted artifact hashes + metadata. */
export function signingPayload(manifest: {
  repoUrl: string
  reviewedCommit: string
  sealedAt: string
  sha256: Record<string, string>
}): Buffer {
  const canonical = JSON.stringify({
    repoUrl: manifest.repoUrl,
    reviewedCommit: manifest.reviewedCommit,
    sealedAt: manifest.sealedAt,
    sha256: Object.fromEntries(Object.entries(manifest.sha256).sort(([a], [b]) => a.localeCompare(b))),
  })
  return createHash("sha256").update(canonical).digest()
}

export async function signManifest(manifest: Parameters<typeof signingPayload>[0]): Promise<{
  algorithm: "ed25519"
  publicKeyPem: string
  signature: string
}> {
  const { privateKeyPem, publicKeyPem } = await loadOrCreateKey()
  const signature = sign(null, signingPayload(manifest), privateKeyPem).toString("base64")
  return { algorithm: "ed25519", publicKeyPem, signature }
}

export function verifySignature(
  manifest: Parameters<typeof signingPayload>[0],
  attestation: { publicKeyPem: string; signature: string },
): boolean {
  return verify(
    null,
    signingPayload(manifest),
    attestation.publicKeyPem,
    Buffer.from(attestation.signature, "base64"),
  )
}
