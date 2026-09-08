/**
 * Snapshot-warmed environments. The first green build of a repo is checkpointed
 * as a Solari snapshot with node_modules hot; later reviews of the same repo
 * boot from it in ~1s and sync to the target commit, instead of paying a cold
 * boot + full install every time. Per-review sandbox cost drops to a
 * predictable floor — the number a tooling budget needs.
 *
 * The snapshot NAME is the cache key (`gauntlet:<repo>:<lockfile-hash>`), so
 * Solari itself is the source of truth — there is no local cache file to drift.
 */
import { createHash } from "node:crypto"
import { SolariClient, type Sandbox } from "@solarisdk/sdk"

import { sh } from "./sandbox.js"
import type { RunPlan } from "./types.js"

const REPO_DIR = "/home/user/repo"
const PLAN_FILE = "/home/user/.gauntlet-plan.json"
const PREFIX = "gauntlet:"
const KEEP_PER_REPO = 2 // newest N snapshots per repo; older ones are evicted

/** Stable, fs/name-safe key for a repo's snapshot family. */
function repoKey(repoUrl: string): string {
  return createHash("sha256").update(repoUrl.replace(/\.git$/, "")).digest("hex").slice(0, 16)
}

function snapName(repoUrl: string, lockHash: string): string {
  return `${PREFIX}${repoKey(repoUrl)}:${lockHash}`
}

/** Hash of the dependency lockfile inside the VM — the warm cache's validity. */
export async function lockfileHash(sandbox: Sandbox, workDir: string): Promise<string> {
  const res = await sh(
    sandbox,
    `cd ${workDir} && cat package-lock.json pnpm-lock.yaml yarn.lock requirements.txt poetry.lock 2>/dev/null | sha256sum | cut -c1-16`,
  )
  const h = res.stdout.trim()
  return h && h !== "e3b0c44298fc1c14" ? h : "nolock" // empty-input hash → no lockfile
}

/** Read the known-good plan baked into a warm snapshot, if present. */
export async function readSeedPlan(sandbox: Sandbox): Promise<RunPlan | undefined> {
  try {
    const res = await sh(sandbox, `cat ${PLAN_FILE} 2>/dev/null || true`)
    if (!res.stdout.trim()) return undefined
    const p = JSON.parse(res.stdout) as RunPlan
    return p.kind && p.run ? p : undefined
  } catch {
    return undefined
  }
}

/** Bake the winning plan into the VM so the next warm boot can replay it. */
async function writeSeedPlan(sandbox: Sandbox, plan: RunPlan): Promise<void> {
  const json = JSON.stringify(plan).replace(/'/g, "'\\''")
  await sh(sandbox, `printf '%s' '${json}' > ${PLAN_FILE}`)
}

/** Newest warm snapshot id for this repo, if any. */
export async function findWarmSnapshot(pt: SolariClient, repoUrl: string): Promise<string | undefined> {
  try {
    const { snapshots } = await pt.sandboxes.listSnapshots({ template: "base", limit: 100 })
    const mine = snapshots
      .filter((s) => s.name?.startsWith(`${PREFIX}${repoKey(repoUrl)}:`))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return mine[0]?.id
  } catch {
    return undefined // snapshot listing is best-effort; fall back to cold boot
  }
}

/**
 * Warm-boot: the repo is already at REPO_DIR from a prior snapshot, at an old
 * commit. Fetch and hard-reset to the target ref, leaving node_modules in
 * place so the follow-up install is incremental. Returns the synced HEAD.
 */
export async function syncToRef(
  sandbox: Sandbox,
  ref: string | undefined,
): Promise<{ commit: string; workDir: string }> {
  // A VM restored from a snapshot can drop its control channel on the very
  // first command; give it a few tries to settle before real work.
  let ready = false
  for (let i = 0; i < 4 && !ready; i++) {
    try {
      const ping = await sh(sandbox, "true", 15_000)
      ready = ping.exitCode === 0
    } catch {
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
  if (!ready) throw new Error("control channel not ready after warm restore")

  const target = ref ? `origin/${ref}` : "@{u}"
  const sync = await sh(
    sandbox,
    `cd ${REPO_DIR} && git fetch --depth 1 origin ${ref ?? "HEAD"} 2>&1 && ` +
      `git reset --hard FETCH_HEAD 2>&1 && git clean -fdq -e node_modules 2>&1`,
    120_000,
  )
  if (sync.exitCode !== 0) throw new Error(`warm sync failed: ${sync.stderr.slice(-400)}`)
  const head = await sh(sandbox, `cd ${REPO_DIR} && git rev-parse --short HEAD`)
  void target
  return { commit: head.stdout.trim(), workDir: REPO_DIR }
}

/**
 * Checkpoint the current VM as this repo's warm image, then evict all but the
 * newest KEEP_PER_REPO snapshots for the repo. Best-effort: a snapshot or
 * eviction failure never fails the review.
 */
export async function saveWarmSnapshot(
  pt: SolariClient,
  sandbox: Sandbox,
  repoUrl: string,
  lockHash: string,
  plan: RunPlan,
): Promise<void> {
  try {
    await writeSeedPlan(sandbox, plan) // travels inside the snapshot
    await sandbox.snapshot(snapName(repoUrl, lockHash))
  } catch {
    return
  }
  try {
    const { snapshots } = await pt.sandboxes.listSnapshots({ template: "base", limit: 100 })
    const mine = snapshots
      .filter((s) => s.name?.startsWith(`${PREFIX}${repoKey(repoUrl)}:`))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    for (const stale of mine.slice(KEEP_PER_REPO)) {
      await pt.sandboxes.deleteSnapshot(stale.id).catch(() => {})
    }
  } catch {
    /* eviction is best-effort */
  }
}
