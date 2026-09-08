#!/usr/bin/env tsx
/**
 * Harness self-test — commands DESIGNED to fail in the ways that fooled the
 * harness before, asserting the real step runner reports each one honestly.
 * One sandbox, zero tokens. Run it after touching sandbox.ts: `npm run selftest`.
 *
 * Every case here is a bug that shipped once:
 *   - a failing pipeline reported exit 0 (no pipefail)
 *   - `source` failed under dash
 *   - exports vanished between steps
 *   - a stdin-blocking command hung the review instead of failing fast
 */
import { SolariClient } from "@solarisdk/sdk"

import { bootSandbox, timedStep } from "./sandbox.js"

const pt = new SolariClient({ apiKey: process.env.SOLARI_API_KEY! })
const sandbox = await bootSandbox(pt)
const dir = "/tmp"
let failures = 0

async function expect(name: string, cmd: string, ok: (exit: number, err: string) => boolean, timeoutMs = 60_000): Promise<void> {
  const r = await timedStep(sandbox, dir, cmd, timeoutMs)
  const pass = ok(r.exitCode, r.stderr)
  console.log(`${pass ? "  ✔" : "  ✘"} ${name}  (exit ${r.exitCode})`)
  if (!pass) failures++
}

try {
  await expect("failing pipeline is NOT masked by tail (pipefail)",
    "false | tail -1", (e) => e !== 0)
  await expect("exit code propagates exactly",
    "exit 7", (e) => e === 7)
  await expect("bash, not dash: `source` works",
    "source /dev/null", (e) => e === 0)
  await expect("export in one step…",
    "export GAUNTLET_SELFTEST=ok", (e) => e === 0)
  await expect("…persists into the next step",
    'test "$GAUNTLET_SELFTEST" = ok', (e) => e === 0)
  await expect("PATH change persists too",
    'export PATH=/opt/selftest-bin:$PATH; case "$PATH" in /opt/selftest-bin*) exit 0;; *) exit 1;; esac',
    (e) => e === 0)
  await expect("stdin-blocking command fails fast as 124 with a hint, not a hang",
    "cat", (e, err) => e === 124 && err.includes("[gauntlet]"), 15_000)
  await expect("harness still alive after the hang (next step runs)",
    "true", (e) => e === 0)
} finally {
  await sandbox.kill().catch(() => {})
}

console.log(failures === 0 ? "selftest: PASS" : `selftest: FAIL (${failures})`)
process.exit(failures === 0 ? 0 : 1)
