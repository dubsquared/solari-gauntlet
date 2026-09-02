/** Shared shapes passed between the plan → execute → probe → verdict stages. */

export interface RunPlan {
  /** What kind of thing this repo is once running. */
  kind: "web" | "cli"
  /** Shell commands run in order to install/build. Each runs via `sh -c`. */
  setup: string[]
  /** Command that starts the app (web) or produces its output (cli). */
  run: string
  /** Port the app listens on. Required when kind is "web". */
  port?: number
  /** One-line rationale, shown in the report. */
  notes: string
}

export interface StepResult {
  cmd: string
  exitCode: number
  stdout: string
  stderr: string
}

export interface ProbeResult {
  kind: "web" | "cli"
  /** Web: the public preview URL that was probed. */
  url?: string
  /** Web: page title. */
  title?: string
  /** Web: visible text of the landing page, truncated. */
  pageText?: string
  /** Web: browser console errors seen while loading. */
  consoleErrors: string[]
  /** Web: path to the saved screenshot, relative to the report dir. */
  screenshot?: string
  /** CLI: captured output of the run command. */
  output?: string
}

export interface Verdict {
  /** 0–10. Does it start and stay up? */
  runs: number
  /** 0–10. Does what's running match what the README promises? */
  deliversClaims: number
  /** 0–10. Readability, structure, error handling of the source. */
  codeQuality: number
  strengths: string[]
  concerns: string[]
  summary: string
}
