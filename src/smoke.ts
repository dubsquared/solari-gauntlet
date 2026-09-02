/**
 * Smoke test — verifies your SOLARI_API_KEY end to end without spending
 * Anthropic tokens: sandbox up, page served, port previewed, cloud browser
 * screenshot taken. If this passes, Gauntlet's plumbing works.
 *
 *   npm run smoke
 */
import { Solari } from "@solarisdk/browser"
import { SolariClient } from "@solarisdk/sdk"
import { mkdir, writeFile } from "node:fs/promises"

const pt = new SolariClient({ apiKey: process.env.SOLARI_API_KEY! })

const sandbox = await pt.sandboxes.create({ template: "base", timeoutMs: 5 * 60_000 })
console.log("sandbox :", sandbox.sandboxId)

try {
  await sandbox.connect()
  await sandbox.files.write(
    "/tmp/site/index.html",
    "<h1>Gauntlet smoke test</h1><p>served from a Solari sandbox, screenshotted by a Solari cloud browser</p>",
  )
  await sandbox.commands.run("sh", {
    args: ["-c", "cd /tmp/site && nohup python3 -m http.server 3000 >/dev/null 2>&1 & sleep 1"],
  })
  const { url } = await sandbox.previewUrl(3000)
  console.log("preview :", url)

  const solari = new Solari({ apiKey: process.env.SOLARI_API_KEY! })
  const browser = await solari.launch()
  try {
    const page = await browser.newPage()
    await page.goto(url, { timeout: 45_000 })
    console.log("h1      :", await page.locator("h1").innerText())
    await mkdir("reports", { recursive: true })
    await writeFile("reports/smoke.png", await page.screenshot({ fullPage: true }))
    console.log("saved   : reports/smoke.png")
  } finally {
    await browser.close()
    await solari.close()
  }
  console.log("smoke   : PASS")
} finally {
  await sandbox.kill()
}
