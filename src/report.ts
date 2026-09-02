/** Render the verdict as a markdown report a reviewer can skim in 30 seconds. */
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import type { ExecutedPlan } from "./sandbox.js"
import type { ProbeResult, Verdict } from "./types.js"

/** Strip short-lived preview tokens from anything that lands in a report. */
function sanitize(text: string): string {
  return text.replace(/\?pt_token=[^\s`'")]*/g, "")
}

function bar(score: number): string {
  return "█".repeat(Math.round(score)) + "░".repeat(10 - Math.round(score))
}

export async function writeReport(
  reportDir: string,
  repoUrl: string,
  executed: ExecutedPlan,
  probe: ProbeResult,
  verdict: Verdict,
): Promise<string> {
  const total = verdict.runs + verdict.deliversClaims + verdict.codeQuality
  const lines = [
    `# Gauntlet review — ${repoUrl}`,
    "",
    `**${total}/30** · reviewed ${new Date().toISOString().slice(0, 10)} · ran as \`${executed.plan.kind}\``,
    "",
    "| Dimension | Score | |",
    "| --- | --- | --- |",
    `| Runs | ${verdict.runs}/10 | \`${bar(verdict.runs)}\` |`,
    `| Delivers its claims | ${verdict.deliversClaims}/10 | \`${bar(verdict.deliversClaims)}\` |`,
    `| Code quality | ${verdict.codeQuality}/10 | \`${bar(verdict.codeQuality)}\` |`,
    "",
    verdict.summary,
    "",
    "## Strengths",
    ...verdict.strengths.map((s) => `- ${s}`),
    "",
    "## Concerns",
    ...verdict.concerns.map((c) => `- ${c}`),
    "",
    "## How it was run",
    `> ${executed.plan.notes}`,
    "",
    "```console",
    ...executed.steps.map((s) => `$ ${s.cmd}   # exit ${s.exitCode}`),
    "```",
  ]

  if (probe.kind === "web") {
    lines.push(
      "",
      "## Live probe",
      `Opened \`${sanitize(probe.url ?? "")}\` in a Solari cloud browser.`,
      "",
      `- title: ${JSON.stringify(probe.title ?? "")}`,
      `- console errors: ${probe.consoleErrors.length === 0 ? "none" : ""}`,
      ...probe.consoleErrors.map((e) => `  - \`${sanitize(e)}\``),
    )
    if (probe.screenshot) lines.push("", `![screenshot](${probe.screenshot})`)
  } else if (probe.output) {
    lines.push("", "## Output", "```", probe.output, "```")
  }

  await mkdir(reportDir, { recursive: true })
  const path = join(reportDir, "report.md")
  await writeFile(path, lines.join("\n") + "\n")
  return path
}
