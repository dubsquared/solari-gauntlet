/** Browser side: open the sandboxed app's public preview URL and look at it. */
import { Solari } from "@solarisdk/browser"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { Sandbox } from "@solarisdk/sdk"

import type { ExecutedPlan } from "./sandbox.js"
import type { ProbeResult } from "./types.js"

const READY_TIMEOUT_MS = 60_000

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: "follow" })
      if (res.status < 500) return
    } catch {
      // still booting
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`server never became reachable at ${url}`)
}

export async function probeWeb(
  sandbox: Sandbox,
  executed: ExecutedPlan,
  reportDir: string,
): Promise<ProbeResult> {
  const port = executed.plan.port ?? 3000
  const { url } = await sandbox.previewUrl(port)
  console.log(`  preview: ${url}`)
  await waitForServer(url)

  const solari = new Solari({ apiKey: process.env.SOLARI_API_KEY! })
  const browser = await solari.launch()
  try {
    const page = await browser.newPage()
    const consoleErrors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300))
    })

    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 })
    const title = await page.title()
    const pageText = (await page.locator("body").innerText()).slice(0, 5000)

    await mkdir(reportDir, { recursive: true })
    const screenshot = "screenshot.png"
    await page.screenshot({ path: join(reportDir, screenshot), fullPage: true })
    console.log(`  screenshot saved, title: ${JSON.stringify(title)}`)

    // Report the bare URL: the pt_token query param is a short-lived access
    // token and has no business in a committed report.
    return { kind: "web", url: url.split("?")[0], title, pageText, consoleErrors, screenshot }
  } finally {
    await browser.close()
    // Without this the loopback proxy keeps the event loop alive on some
    // client versions — harmless to call, fatal to forget.
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
