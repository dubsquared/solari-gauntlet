/** Browser side: open the sandboxed app's public preview URL and look at it. */
import { Solari } from "@solarisdk/browser"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { Sandbox } from "@solarisdk/sdk"

import type { ExecutedPlan } from "./sandbox.js"
import type { ProbeResult } from "./types.js"

const READY_TIMEOUT_MS = 90_000

/**
 * Readiness poll. The server behind the URL is the submission's own code, so:
 * `redirect: "manual"` (never follow an attacker redirect from this machine —
 * that's a blind-GET SSRF primitive) and a per-request timeout so the 90s
 * deadline is actually a deadline.
 */
async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(5_000),
      })
      if (res.status < 500) return
    } catch {
      // still booting
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`server never became reachable within ${READY_TIMEOUT_MS / 1000}s`)
}

export async function probeWeb(
  sandbox: Sandbox,
  executed: ExecutedPlan,
  reportDir: string,
): Promise<ProbeResult> {
  const port = executed.plan.port ?? 3000
  const { url } = await sandbox.previewUrl(port)
  const bareUrl = url.split("?")[0]
  console.log(`  preview: ${bareUrl}`) // never log the pt_token
  await waitForServer(url)

  const solari = new Solari({ apiKey: process.env.SOLARI_API_KEY! })
  const browser = await solari.launch()
  try {
    const page = await browser.newPage()
    const consoleErrors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300))
    })

    // networkidle never fires for apps that poll or stream; settle for the
    // DOM plus a beat for client-side rendering.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 })
    await page.waitForTimeout(2_500)
    const title = await page.title()
    const pageText = (await page.locator("body").innerText()).slice(0, 5000)

    await mkdir(reportDir, { recursive: true })
    const screenshot = "screenshot.png"
    await page.screenshot({ path: join(reportDir, screenshot), fullPage: true })
    console.log(`  screenshot saved, title: ${JSON.stringify(title)}`)

    // Report the bare URL: the pt_token query param is a short-lived access
    // token and has no business in a committed report.
    return { kind: "web", url: bareUrl, title, pageText, consoleErrors, screenshot }
  } finally {
    // browser.close() failing must not leak the client's loopback proxy —
    // solari.close() is what lets the process exit.
    await browser.close().catch(() => {})
    await solari.close()
  }
}

export function probeCli(executed: ExecutedPlan): ProbeResult {
  const last = executed.steps.at(-1)
  return {
    kind: "cli",
    consoleErrors: [],
    output: last ? (last.stdout + last.stderr).slice(0, 5000) : "(no output)",
  }
}

export async function saveRawContext(reportDir: string, context: string): Promise<void> {
  await mkdir(reportDir, { recursive: true })
  await writeFile(join(reportDir, "context.txt"), context)
}
