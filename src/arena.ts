#!/usr/bin/env tsx
/**
 * The Gauntlet Arena — a single self-updating scoreboard of every review in
 * reports/. Pure render from committed verdict.json files: no sandbox, no API,
 * no tokens. `npm run arena` rebuilds reports/arena.html; watch mode rebuilds
 * it after every new review.
 */
import { readdir, readFile, writeFile, stat } from "node:fs/promises"
import { join } from "node:path"

/**
 * On GitHub Pages a bare .md is served as raw text. For any review that only
 * has report.md (older reviews, before HTML cards), write a lightweight
 * report.html that renders its sibling markdown with marked — so every Arena
 * link opens a real page. Zero cost, no re-review.
 */
async function ensureFallbackCards(reportsRoot: string): Promise<void> {
  for (const e of await readdir(reportsRoot, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    const dir = join(reportsRoot, e.name)
    const hasMd = await stat(join(dir, "report.md")).then(() => true, () => false)
    const hasHtml = await stat(join(dir, "report.html")).then(() => true, () => false)
    if (!hasMd || hasHtml) continue
    await writeFile(
      join(dir, "report.html"),
      `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gauntlet review — ${e.name}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown-dark.min.css">
<style>body{background:#0b0d10;margin:0}.markdown-body{box-sizing:border-box;max-width:900px;margin:0 auto;padding:44px 24px;background:#0b0d10}a.back{color:#7ab7ff;font-family:system-ui;text-decoration:none;display:inline-block;margin:18px 24px 0}</style>
</head><body>
<a class="back" href="../arena.html">← Arena</a>
<article class="markdown-body" id="c">loading…</article>
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"></script>
<script>fetch("./report.md").then(r=>r.text()).then(t=>{document.getElementById("c").innerHTML=marked.parse(t)}).catch(()=>{document.getElementById("c").textContent="could not load report.md"})</script>
</body></html>\n`,
    )
  }
}

interface Row {
  slug: string
  kind: "repo" | "pr"
  title: string
  href: string
  total?: number // repo reviews, /30
  runs?: number
  claims?: number
  quality?: number
  assessment?: string // pr reviews
  flagged?: boolean
  commit?: string
  updated: number
}

const ASSESS = {
  improvement: { icon: "🟢", label: "improvement" },
  regression: { icon: "🔴", label: "regression" },
  neutral: { icon: "⚪", label: "neutral" },
  mixed: { icon: "🟡", label: "mixed" },
} as const

async function collectRows(reportsRoot: string): Promise<Row[]> {
  const rows: Row[] = []
  for (const e of await readdir(reportsRoot, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    const dir = join(reportsRoot, e.name)
    let v: Record<string, unknown>
    try {
      v = JSON.parse(await readFile(join(dir, "verdict.json"), "utf8"))
    } catch {
      continue // not a review dir
    }
    const hasCard = await stat(join(dir, "report.html")).then(() => true, () => false)
    const href = `${e.name}/${hasCard ? "report.html" : "report.md"}`
    const updated = (await stat(join(dir, "verdict.json"))).mtimeMs
    if (typeof v.pr === "string") {
      rows.push({
        slug: e.name,
        kind: "pr",
        title: String(v.pr),
        href,
        assessment: String(v.assessment ?? "mixed"),
        updated,
      })
    } else {
      const verdict = (v.verdict ?? {}) as Record<string, number>
      rows.push({
        slug: e.name,
        kind: "repo",
        title: String(v.repoUrl ?? e.name).replace("https://github.com/", "").replace(/\.git$/, ""),
        href,
        total: typeof v.total === "number" ? v.total : undefined,
        runs: verdict.runs,
        claims: verdict.deliversClaims,
        quality: verdict.codeQuality,
        flagged: Boolean(v.flagged),
        commit: typeof v.commit === "string" ? v.commit : undefined,
        updated,
      })
    }
  }
  return rows
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export function renderArena(rows: Row[]): string {
  const repos = rows.filter((r) => r.kind === "repo").sort((a, b) => (b.total ?? -1) - (a.total ?? -1))
  const prs = rows.filter((r) => r.kind === "pr").sort((a, b) => b.updated - a.updated)
  const bar = (n: number | undefined): string => {
    if (n === undefined) return ""
    const pct = Math.min(100, Math.max(0, n * 10))
    return `<span class="mini"><i style="width:${pct}%"></i></span>`
  }
  const repoRows = repos
    .map(
      (r, i) => `<tr>
<td class="rank">${i + 1}</td>
<td><a href="${esc(r.href)}">${esc(r.title)}</a>${r.flagged ? ' <span class="flag" title="flagged for manual review">⚠️</span>' : ""}${r.commit ? ` <code>${esc(r.commit)}</code>` : ""}</td>
<td class="score"><b>${r.total ?? "–"}</b><small>/30</small></td>
<td>${bar(r.runs)}</td><td>${bar(r.claims)}</td><td>${bar(r.quality)}</td>
</tr>`,
    )
    .join("\n")
  const prRows = prs
    .map((r) => {
      const a = ASSESS[r.assessment as keyof typeof ASSESS] ?? ASSESS.mixed
      return `<tr><td>${a.icon}</td><td><a href="${esc(r.href)}">${esc(r.title)}</a></td><td>${a.label}</td></tr>`
    })
    .join("\n")

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gauntlet Arena</title>
<style>
:root{color-scheme:dark}
body{font-family:ui-sans-serif,system-ui,sans-serif;background:#0b0d10;color:#e6e8eb;max-width:960px;margin:2rem auto;padding:0 1rem}
h1{font-size:1.6rem;margin-bottom:.2rem}h2{color:#9aa4b2;font-size:1rem;margin-top:2.2rem;text-transform:uppercase;letter-spacing:.05em}
a{color:#7ab7ff;text-decoration:none}a:hover{text-decoration:underline}
.sub{color:#9aa4b2;margin-top:0}
table{border-collapse:collapse;width:100%;margin-top:.6rem}
td,th{border-bottom:1px solid #1c2229;padding:.55rem .5rem;text-align:left;vertical-align:middle}
th{color:#9aa4b2;font-weight:600;font-size:.8rem;text-transform:uppercase;letter-spacing:.04em}
.rank{color:#6b7280;width:2rem}.score b{font-size:1.15rem}.score small{color:#6b7280}
code{background:#1a1f26;padding:.05rem .35rem;border-radius:4px;color:#9aa4b2;font-size:.8rem}
.mini{display:inline-block;width:70px;height:8px;background:#1a1f26;border-radius:4px;overflow:hidden;vertical-align:middle}
.mini i{display:block;height:100%;background:linear-gradient(90deg,#f0b429,#ff7849)}
.flag{cursor:help}
footer{color:#6b7280;margin-top:2.5rem;font-size:.85rem}
</style></head><body>
<h1>🥊 Gauntlet Arena</h1>
<p class="sub">Every repo that ran the gauntlet — built, tested, and probed in a Solari sandbox (or a desktop, for GUIs), scored by Claude. Higher is better; each row links to the full evidence — report card, screenshots, and session replay.</p>

<h2>Repositories · ${repos.length}</h2>
<table><thead><tr><th class="rank">#</th><th>submission</th><th>score</th><th>runs</th><th>claims</th><th>quality</th></tr></thead>
<tbody>
${repoRows || '<tr><td colspan="6">no reviews yet</td></tr>'}
</tbody></table>

${
  prs.length
    ? `<h2>Pull requests · ${prs.length}</h2>
<table><thead><tr><th></th><th>PR</th><th>verdict</th></tr></thead><tbody>
${prRows}
</tbody></table>`
    : ""
}

<footer>Rebuilt ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC ·
generated by <a href="https://github.com/dubsquared/solari-gauntlet">Gauntlet</a> ·
evidence in each report is ed25519-signed (<code>npm run verify</code>).</footer>
</body></html>`
}

export async function buildArena(reportsRoot = "reports"): Promise<string> {
  await ensureFallbackCards(reportsRoot)
  const rows = await collectRows(reportsRoot)
  const path = join(reportsRoot, "arena.html")
  await writeFile(path, renderArena(rows))
  return path
}

// Run directly: rebuild the Arena from whatever is in reports/.
if (import.meta.url === `file://${process.argv[1]}`) {
  const path = await buildArena()
  console.log(`arena → ${path} (${(await collectRows("reports")).length} reviews)`)
}
