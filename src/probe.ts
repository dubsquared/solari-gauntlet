/** Browser side: open the sandboxed app's public preview URL and look at it. */
import { Solari } from "@solarisdk/browser"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { Sandbox } from "@solarisdk/sdk"

import type { ExecutedPlan } from "./sandbox.js"
import type { HostileCheck, PageVisit, ProbeResult } from "./types.js"

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
  // Recording is opt-in per session and cannot be enabled later — without it
  // the replay endpoint 404s forever. The replay is the audit trail.
  const browser = await solari.launch({ recording: true })
  const sessionId = browser.id
  let result: ProbeResult
  try {
    const page = await browser.newPage()
    const consoleErrors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300))
    })

    // networkidle never fires for apps that poll or stream; settle for the
    // DOM plus a beat for client-side rendering.
    const t0 = Date.now()
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 })
    const loadMs = Date.now() - t0
    await page.waitForTimeout(2_500)
    const title = await page.title()
    const pageText = (await page.locator("body").innerText()).slice(0, 5000)

    await mkdir(reportDir, { recursive: true })
    const screenshot = "screenshot.png"
    await page.screenshot({ path: join(reportDir, screenshot), fullPage: true })
    console.log(`  screenshot saved, title: ${JSON.stringify(title)} (${loadMs}ms to DOM)`)

    // One screenshot is one frame; walk a couple of same-origin links so the
    // verdict sees more than the front door.
    const extraPages = await crawl(page, url)

    // Failure-mode probe: a missing route and malformed JSON. How an app
    // fails distinguishes a senior's error handling from a tutorial's.
    const hostile = await hostileProbe(url)

    // Mobile viewport: half the panel's users will open the submission on a
    // phone-width window first.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {})
    await page.screenshot({ path: join(reportDir, "screenshot-mobile.png") }).catch(() => {})

    // Report the bare URL: the pt_token query param is a short-lived access
    // token and has no business in a committed report.
    result = {
      kind: "web",
      url: bareUrl,
      title,
      pageText,
      consoleErrors,
      screenshot,
      loadMs,
      extraPages,
      hostile,
    }
  } finally {
    // browser.close() failing must not leak the client's loopback proxy —
    // solari.close() is what lets the process exit.
    await browser.close().catch(() => {})
  }

  try {
    const replay = await downloadReplay(solari, sessionId)
    if (replay) {
      await writeFile(join(reportDir, "replay.ndjson"), replay.bytes)
      result.replayEvents = replay.events
      result.replayFile = "replay.ndjson"
      console.log(`  replay saved: ${replay.events} rrweb events`)
    }
  } finally {
    await solari.close()
  }
  return result
}

type Page = Awaited<ReturnType<Awaited<ReturnType<Solari["launch"]>>["newPage"]>>

async function crawl(page: Page, landingUrl: string): Promise<PageVisit[]> {
  const visits: PageVisit[] = []
  try {
    const origin = new URL(landingUrl).origin
    const hrefs: string[] = await page.$$eval("a[href]", (as) =>
      as.map((a) => (a as HTMLAnchorElement).href),
    )
    const paths = [
      ...new Set(
        hrefs
          .filter((h) => h.startsWith(origin))
          .map((h) => new URL(h).pathname)
          .filter((p) => p !== "/" && p.length > 1),
      ),
    ].slice(0, 2)
    for (const path of paths) {
      let errors = 0
      const onErr = (msg: { type(): string }) => {
        if (msg.type() === "error") errors++
      }
      page.on("console", onErr)
      try {
        await page.goto(origin + path, { waitUntil: "domcontentloaded", timeout: 20_000 })
        await page.waitForTimeout(1_000)
        visits.push({ path, title: await page.title(), errors })
      } catch {
        visits.push({ path, title: "(failed to load)", errors })
      } finally {
        page.off("console", onErr)
      }
    }
  } catch {
    /* crawling is best-effort */
  }
  return visits
}

const TRACE_MARKERS = [/\bat .+\.[cm]?js:\d+/, /Traceback \(most recent call last\)/, /\.py", line \d+/]

/**
 * Deliberately hostile requests, same SSRF posture as the readiness poll
 * (manual redirects, per-request timeout, status + body sniff only).
 */
async function hostileProbe(url: string): Promise<HostileCheck[]> {
  const origin = url // preview URL already points at the app root
  const attempts: Array<{ check: string; init: RequestInit; path: string }> = [
    { check: "GET a route that does not exist", path: "/__gauntlet_probe_missing__", init: {} },
    {
      check: "POST malformed JSON to /",
      path: "/",
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"malformed": ',
      },
    },
  ]
  const results: HostileCheck[] = []
  for (const a of attempts) {
    try {
      // Keep the query string — the preview gateway's access token lives there.
      const target = new URL(origin)
      target.pathname = a.path
      const res = await fetch(target, {
        ...a.init,
        redirect: "manual",
        signal: AbortSignal.timeout(8_000),
      })
      const body = (await res.text().catch(() => "")).slice(0, 4000)
      results.push({
        check: a.check,
        status: res.status,
        leakedTrace: TRACE_MARKERS.some((m) => m.test(body)),
      })
    } catch {
      results.push({ check: a.check, status: "no response", leakedTrace: false })
    }
  }
  return results
}

/** The upload is async after release — the first polls 404 even on success. */
async function downloadReplay(
  solari: Solari,
  sessionId: string,
): Promise<{ bytes: Uint8Array; events: number } | undefined> {
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise((r) => setTimeout(r, 3_000))
    try {
      const bytes = await solari.sessions.downloadReplay(sessionId)
      const events = new TextDecoder().decode(bytes).split("\n").filter(Boolean).length
      return { bytes, events }
    } catch {
      // not uploaded yet — keep polling
    }
  }
  return undefined
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
