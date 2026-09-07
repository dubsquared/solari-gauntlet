/**
 * The shareable artifact: one self-contained report.html per review — scores,
 * evidence, screenshots inlined as data URIs, and the rrweb session replay
 * embedded with a player. Send one file; the whole review travels with it.
 */
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import type { ExecutedPlan } from "./sandbox.js"
import type { ProbeResult, SecuritySweep, Verdict } from "./types.js"

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

async function dataUri(path: string): Promise<string | undefined> {
  try {
    return `data:image/png;base64,${(await readFile(path)).toString("base64")}`
  } catch {
    return undefined
  }
}

function scoreRow(label: string, n: number): string {
  const pct = Math.min(100, Math.max(0, n * 10))
  return `<div class="score"><span>${label}</span><div class="bar"><i style="width:${pct}%"></i></div><b>${n}/10</b></div>`
}

export async function writeCard(
  reportDir: string,
  repoUrl: string,
  commit: string,
  executed: ExecutedPlan,
  probe: ProbeResult,
  verdict: Verdict,
  sweep: SecuritySweep,
  cost: { tokens: number; seconds: number },
  prevTotal?: number,
): Promise<void> {
  const total = verdict.runs + verdict.deliversClaims + verdict.codeQuality
  const shot = probe.screenshot ? await dataUri(join(reportDir, probe.screenshot)) : undefined
  const mobile = await dataUri(join(reportDir, "screenshot-mobile.png"))
  let replayEvents = ""
  if (probe.replayFile) {
    try {
      replayEvents = await readFile(join(reportDir, probe.replayFile), "utf8")
    } catch {
      /* replay optional */
    }
  }

  const delta =
    prevTotal !== undefined && prevTotal !== total
      ? `<span class="delta">${total > prevTotal ? "▲" : "▼"} was ${prevTotal}/30</span>`
      : ""

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gauntlet · ${esc(repoUrl.replace("https://github.com/", "").replace(/\.git$/, ""))}</title>
${replayEvents ? `<link rel="stylesheet" href="https://unpkg.com/rrweb-player@1.0.0-alpha.4/dist/style.css">` : ""}
<style>
body{font-family:ui-sans-serif,system-ui,sans-serif;background:#0b0d10;color:#e6e8eb;max-width:960px;margin:2rem auto;padding:0 1rem}
a{color:#7ab7ff}h1{font-size:1.4rem}h2{font-size:1.05rem;margin-top:2rem;color:#9aa4b2}
.total{font-size:3rem;font-weight:800}.delta{font-size:1rem;color:#f0b429;margin-left:.75rem}
.score{display:flex;align-items:center;gap:.75rem;margin:.4rem 0}.score span{width:11rem;color:#9aa4b2}
.bar{flex:1;height:10px;background:#1a1f26;border-radius:5px;overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,#f0b429,#ff7849)}
ul{line-height:1.6}.flag{background:#3b2500;border:1px solid #f0b429;border-radius:8px;padding:.75rem 1rem;margin:1rem 0}
img{max-width:100%;border-radius:8px;border:1px solid #2a2f36;margin:.5rem 0}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #2a2f36;padding:.4rem .6rem;text-align:left}
.meta{color:#9aa4b2;font-size:.9rem}code{background:#1a1f26;padding:.1rem .35rem;border-radius:4px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:1rem}@media(max-width:700px){.cols{grid-template-columns:1fr}}
</style></head><body>
<h1>🥊 Gauntlet review — <a href="${esc(repoUrl.replace(/\.git$/, ""))}">${esc(repoUrl.replace("https://github.com/", "").replace(/\.git$/, ""))}</a></h1>
<p class="meta">commit <code>${esc(commit)}</code> · ran as <code>${executed.plan.kind}</code> · ${Math.round(cost.seconds)}s · ~${Math.round(cost.tokens / 1000)}k tokens · evidence sealed &amp; signed (manifest.json)</p>
<div class="total">${total}/30${delta}</div>
${scoreRow("Runs", verdict.runs)}${scoreRow("Delivers its claims", verdict.deliversClaims)}${scoreRow("Code quality", verdict.codeQuality)}
<p>${esc(verdict.summary)}</p>
<div class="cols"><div><h2>Strengths</h2><ul>${verdict.strengths.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>
<div><h2>Concerns</h2><ul>${verdict.concerns.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div></div>
<h2>The submission's own tests</h2>
<p>${executed.testRun ? `<code>${esc(executed.testRun.cmd)}</code> → <b>${executed.testRun.exitCode === 0 ? "PASS ✅" : "FAIL ❌"}</b>` : "No test command found."}</p>
<h2>Security sweep</h2>
<p>audit: ${esc(sweep.auditSummary ?? "n/a")} · secrets: ${sweep.secretHits.length === 0 ? "no matches" : `⚠️ ${sweep.secretHits.length} file(s)`}</p>
${
  probe.hostile?.length
    ? `<h2>Failure-mode probe</h2><table><tr><th>Check</th><th>Status</th><th>Trace leaked</th></tr>${probe.hostile
        .map((h) => `<tr><td>${esc(h.check)}</td><td>${h.status}</td><td>${h.leakedTrace ? "⚠️ yes" : "no"}</td></tr>`)
        .join("")}</table>`
    : ""
}
${verdict.interviewQuestions.length ? `<h2>Ask the candidate</h2><ol>${verdict.interviewQuestions.map((q) => `<li>${esc(q)}</li>`).join("")}</ol>` : ""}
${shot ? `<h2>What the cloud browser saw${probe.loadMs ? ` <span class="meta">(${probe.loadMs}ms to DOM)</span>` : ""}</h2><img src="${shot}" alt="screenshot">` : ""}
${mobile ? `<details><summary>Mobile viewport</summary><img src="${mobile}" alt="mobile screenshot" style="max-width:390px"></details>` : ""}
${
  replayEvents
    ? `<h2>Session replay</h2><p class="meta">A DOM-level recording of the entire probe. Disputes end here.</p><div id="replay"></div>
<script src="https://unpkg.com/rrweb-player@1.0.0-alpha.4/dist/index.js"></script>
<script type="application/x-ndjson" id="events">${replayEvents.replace(/<\//g, "<\\/")}</script>
<script>try{const ev=document.getElementById("events").textContent.split("\\n").filter(Boolean).map(JSON.parse);
new rrwebPlayer({target:document.getElementById("replay"),props:{events:ev,width:900,autoPlay:false}})}catch(e){document.getElementById("replay").textContent="replay needs network access for the player script"}</script>`
    : ""
}
<p class="meta">Generated by <a href="https://github.com/dubsquared/solari-gauntlet">Gauntlet</a> — sandboxes &amp; cloud browsers by Solari, judgment by Claude. Verify this evidence: <code>npm run verify -- &lt;this directory&gt;</code></p>
</body></html>`
  await writeFile(join(reportDir, "report.html"), html)
}
