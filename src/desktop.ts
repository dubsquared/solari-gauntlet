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

import type { RunPlan, StepResult } from "./types.js"

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

    return { steps, screenshot: shot, streamUrl: desktop.streamUrl }
  } finally {
    // close() drops the local channel; destroy() ends the billed session.
    desktop.close()
    await client.destroy(desktop.sessionId).catch(() => {})
  }
}
