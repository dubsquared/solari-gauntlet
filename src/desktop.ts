/**
 * GUI review mode — the third Solari surface. A desktop is a sandbox with a
 * screen (X11 + VNC), so a submission whose deliverable is a GUI window
 * (Electron, Tkinter, PyQt, a game) gets clone → setup → launch → screenshot,
 * and the screenshot is judged by Claude vision. This is the one Solari product
 * the browser/sandbox paths don't touch.
 */
import { DesktopClient, type Desktop } from "@solarisdk/sdk"
import { writeFile, mkdir } from "node:fs/promises"
import { join } from "node:path"

import { assertGuiChange, extractGuiClaims } from "./ai.js"
import type { ClaimCheck, RunPlan, StepResult } from "./types.js"

const BASE_URL = process.env.SOLARI_BASE_URL ?? "https://api.getsolari.com"
const REPO_DIR = "/tmp/gauntlet-repo"

/** Desktop exec is argv-based like the sandbox; route shell through sh -c. */
async function dsh(desktop: Desktop, cmd: string, timeoutMs = 180_000): Promise<StepResult> {
  const out = await desktop.exec("sh", { args: ["-c", cmd], timeoutMs })
  return { cmd, exitCode: out.exitCode, stdout: out.stdout, stderr: out.stderr }
}

export interface GuiResult {
  steps: StepResult[]
  screenshot: Uint8Array
  streamUrl: string
  claims?: ClaimCheck[]
}

const b64 = (b: Uint8Array): string => Buffer.from(b).toString("base64")

/**
 * Computer-use claim verification: extract checkable GUI claims from the
 * README + the live screenshot, then DRIVE the desktop (click/type/key) to
 * check each one, judging the before/after screenshots by vision. The desktop
 * analog of web claim verification. Bounded: ≤2 claims, ≤6 clamped actions
 * each, one extract + one assert vision call per claim.
 */
async function runGuiClaims(
  desktop: Desktop,
  context: string,
  firstShot: Uint8Array,
): Promise<ClaimCheck[]> {
  const scripts = await extractGuiClaims(context, b64(firstShot))
  if (!scripts.length) return []
  const { w, h } = await desktop.display.size().catch(() => ({ w: 1280, h: 720 }))
  const clamp = (v: number, max: number): number => Math.max(0, Math.min(max - 1, v))
  const out: ClaimCheck[] = []
  for (const s of scripts) {
    try {
      const before = await desktop.screenshot({ format: "png" } as never)
      for (const a of s.actions) {
        if (a.op === "click") await desktop.mouse.click(clamp(a.x, w), clamp(a.y, h))
        else if (a.op === "doubleClick") await desktop.mouse.doubleClick(clamp(a.x, w), clamp(a.y, h))
        else if (a.op === "type") await desktop.keyboard.type(a.text)
        else if (a.op === "key") await desktop.keyboard.press(a.keys.includes("+") ? a.keys.split("+") : a.keys)
        await new Promise((r) => setTimeout(r, 400))
      }
      await new Promise((r) => setTimeout(r, 800))
      const after = await desktop.screenshot({ format: "png" } as never)
      const v = await assertGuiChange(s.expect, b64(before), b64(after))
      out.push({
        claim: s.claim,
        result: v.ok ? "verified" : "failed",
        detail: v.detail || (v.ok ? "expected change observed" : "expected change not observed"),
      })
    } catch (err) {
      out.push({
        claim: s.claim,
        result: "unverified",
        detail: `couldn't drive it: ${(err instanceof Error ? err.message : String(err)).slice(0, 120)}`,
      })
    }
  }
  return out
}

/**
 * Boot a desktop, build the repo on it, launch the GUI, and screenshot the
 * screen. Best-effort setup with the plan's commands; the screenshot is the
 * evidence whether or not every step was clean.
 */
export async function reviewGui(
  target: { url: string; ref?: string },
  plan: RunPlan,
  reportDir: string,
  /** When set, drive the GUI to check the README's claims (computer-use). */
  verifyClaims?: { context: string },
): Promise<GuiResult> {
  const client = new DesktopClient({ apiKey: process.env.SOLARI_API_KEY!, baseUrl: BASE_URL })
  const desktop = await client.create({
    template: "default",
    resolution: "1280x720",
    timeoutMs: 10 * 60_000,
  })
  const steps: StepResult[] = []
  try {
    await desktop.connect()
    // Wait for X11 + VNC before driving the GUI.
    for (let i = 0; i < 30; i++) {
      const h = await desktop.health()
      if (h.ready) break
      await new Promise((r) => setTimeout(r, 1000))
    }

    // Clone via argv (no shell interpolation of the URL).
    const cloneArgs = ["clone", "--depth", "1"]
    if (target.ref) cloneArgs.push("--branch", target.ref)
    cloneArgs.push("--", target.url, REPO_DIR)
    const clone = await desktop.exec("git", { args: cloneArgs, timeoutMs: 120_000 })
    steps.push({ cmd: "git clone", exitCode: clone.exitCode, stdout: clone.stdout, stderr: clone.stderr })

    for (const cmd of plan.setup) {
      const res = await dsh(desktop, `cd ${REPO_DIR} && ${cmd}`, 300_000)
      steps.push(res)
      if (res.exitCode !== 0) break // GUI apps often run despite setup noise; keep going to the screenshot
    }

    // Launch the GUI on the display, backgrounded, then let it paint.
    await dsh(
      desktop,
      `cd ${REPO_DIR} && DISPLAY=:0 nohup sh -c '${plan.run.replaceAll("'", "'\\''")}' >/tmp/gui.log 2>&1 & sleep 1`,
    )
    steps.push({ cmd: plan.run, exitCode: 0, stdout: "(launched on :0)", stderr: "" })
    await new Promise((r) => setTimeout(r, 6000)) // give the window time to map

    const shot = await desktop.screenshot({ format: "png" } as never)
    await mkdir(reportDir, { recursive: true })
    await writeFile(join(reportDir, "screenshot.png"), shot)
    const log = await dsh(desktop, "tail -c 1500 /tmp/gui.log 2>/dev/null || true")
    steps.push({ cmd: "gui log", exitCode: 0, stdout: log.stdout, stderr: "" })

    // Computer-use claim verification, while the session is live.
    let claims: ClaimCheck[] | undefined
    if (verifyClaims) {
      claims = await runGuiClaims(desktop, verifyClaims.context, shot)
      if (claims.length) {
        const v = claims.filter((c) => c.result === "verified").length
        const f = claims.filter((c) => c.result === "failed").length
        console.log(`  🖲  GUI claims: ${v} verified, ${f} failed, ${claims.length - v - f} unverified`)
      }
    }

    // Re-screenshot after interaction so the report shows the exercised state.
    const finalShot = verifyClaims ? await desktop.screenshot({ format: "png" } as never) : shot
    if (verifyClaims) await writeFile(join(reportDir, "screenshot.png"), finalShot)

    return { steps, screenshot: finalShot, streamUrl: desktop.streamUrl, claims }
  } finally {
    // close() drops the local channel; destroy() ends the billed session.
    desktop.close()
    await client.destroy(desktop.sessionId).catch(() => {})
  }
}
