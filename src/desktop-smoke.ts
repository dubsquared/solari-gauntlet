/**
 * Desktop smoke test — proves the GUI review chain end to end without an
 * Anthropic key: boot a Solari desktop, wait for X11, open an app, screenshot
 * the screen. If this passes, reviewGui's plumbing works. `npm run smoke:desktop`
 */
import { DesktopClient } from "@solarisdk/sdk"
import { writeFile } from "node:fs/promises"

const client = new DesktopClient({
  apiKey: process.env.SOLARI_API_KEY!,
  baseUrl: process.env.SOLARI_BASE_URL ?? "https://api.getsolari.com",
})

const desktop = await client.create({ template: "default", resolution: "1280x720", timeoutMs: 5 * 60_000 })
console.log("desktop:", desktop.sessionId.slice(0, 24), "…")
console.log("stream :", desktop.streamUrl)

try {
  await desktop.connect()
  let ready = false
  for (let i = 0; i < 30; i++) {
    const h = await desktop.health()
    if (h.ready) { ready = true; break }
    await new Promise((r) => setTimeout(r, 1000))
  }
  console.log("ready  :", ready)

  const pid = await desktop.open("mousepad")
  console.log("opened : mousepad pid", pid)
  await new Promise((r) => setTimeout(r, 4000))

  const shot = await desktop.screenshot({ format: "png" } as never)
  await writeFile("reports/desktop-smoke.png", shot)
  console.log(`screenshot: reports/desktop-smoke.png (${shot.length} bytes)`)
  console.log("smoke  : PASS")
} finally {
  desktop.close()
  await client.destroy(desktop.sessionId).catch(() => {})
}
