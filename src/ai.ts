/** Claude calls: plan how to run a repo, revise a failed plan, write the verdict. */
import Anthropic from "@anthropic-ai/sdk"

import type { ProbeResult, RunPlan, StepResult, Verdict } from "./types.js"

const MODEL = process.env.GAUNTLET_MODEL ?? "claude-sonnet-5"

const anthropic = new Anthropic() // reads ANTHROPIC_API_KEY

/** Extract the first JSON object from a response, tolerating fenced blocks. */
function parseJson<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`model returned no JSON:\n${text}`)
  return JSON.parse(match[0]) as T
}

async function ask(system: string, user: string): Promise<string> {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: user }],
  })
  const block = res.content.find((b) => b.type === "text")
  if (!block || block.type !== "text") throw new Error("no text block in model response")
  return block.text
}

const PLAN_SYSTEM = `You decide how to install and run an unknown GitHub repo inside a
fresh Ubuntu microVM (node, python3, pip, git, curl preinstalled; no docker daemon).
Reply with ONLY a JSON object:
{
  "kind": "web" | "cli",
  "setup": ["shell command", ...],
  "run": "shell command that starts the app or produces its output",
  "port": 3000,
  "notes": "one line on why"
}
Rules:
- "web" means the run command starts an HTTP server; include "port" and make the
  server bind 0.0.0.0 (pass a host flag if the tool needs one).
- "cli" means the run command exits on its own with its output; omit "port".
- Commands must be non-interactive (use -y / --yes flags, CI=true where relevant).
- Prefer the repo's own scripts (npm start, make run) over guessing entry points.`

export async function planRun(context: string): Promise<RunPlan> {
  return parseJson<RunPlan>(await ask(PLAN_SYSTEM, context))
}

export async function revisePlan(
  context: string,
  plan: RunPlan,
  failure: StepResult,
): Promise<RunPlan> {
  const user = `${context}

The previous plan failed. Plan was:
${JSON.stringify(plan, null, 2)}

Failing command: ${failure.cmd}
exit code: ${failure.exitCode}
stdout (tail): ${failure.stdout.slice(-2000)}
stderr (tail): ${failure.stderr.slice(-2000)}

Produce a corrected plan. Fix the actual failure; don't repeat the same command.`
  return parseJson<RunPlan>(await ask(PLAN_SYSTEM, user))
}

const VERDICT_SYSTEM = `You are reviewing a code submission for a hiring challenge.
You are given the repo's context, how it was run, and what a live probe of the
running app observed. Be fair but concrete — judge what actually ran, not what
the README promises. Reply with ONLY a JSON object:
{
  "runs": 0-10,
  "deliversClaims": 0-10,
  "codeQuality": 0-10,
  "strengths": ["...", ...],
  "concerns": ["...", ...],
  "summary": "3-4 sentence overall assessment"
}`

export async function writeVerdict(
  context: string,
  steps: StepResult[],
  probe: ProbeResult,
): Promise<Verdict> {
  const user = `Repo context:
${context}

Setup/run steps executed (command, exit code, output tail):
${steps
  .map((s) => `$ ${s.cmd}\nexit ${s.exitCode}\n${(s.stdout + s.stderr).slice(-1500)}`)
  .join("\n---\n")}

Live probe:
${JSON.stringify({ ...probe, pageText: probe.pageText?.slice(0, 3000) }, null, 2)}`
  return parseJson<Verdict>(await ask(VERDICT_SYSTEM, user))
}
