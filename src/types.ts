/** Shared shapes passed between the plan → execute → probe → verdict stages. */

export interface RunPlan {
  /** What kind of thing this repo is once running. */
  kind: "web" | "cli"
  /** Shell commands run in order to install/build. Each runs via `sh -c`. */
  setup: string[]
  /** Command that starts the app (web) or produces its output (cli). */
  run: string
  /** Command that runs the repo's own test suite; undefined when none exists. */
  test?: string
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

/** The submission's own test suite, run non-fatally after setup. */
export interface TestRun {
  cmd: string
  exitCode: number
  output: string
}

/** What we inspect while we already have the code in a sandbox. */
export interface SecuritySweep {
  /** npm audit vulnerability counts, when a package.json exists. */
  auditSummary?: string
  /** Files matching high-signal secret patterns (paths only, never contents). */
  secretHits: string[]
}

export interface PageVisit {
  path: string
  title: string
  errors: number
}

export interface ProbeResult {
  kind: "web" | "cli"
  /** Web: the public preview URL that was probed (query stripped). */
  url?: string
  /** Web: page title. */
  title?: string
  /** Web: visible text of the landing page, truncated. */
  pageText?: string
  /** Web: browser console errors seen while loading. */
  consoleErrors: string[]
  /** Web: path to the saved screenshot, relative to the report dir. */
  screenshot?: string
  /** Web: wall time for the landing page's DOM to load. */
  loadMs?: number
  /** Web: additional same-origin pages visited beyond the landing page. */
  extraPages?: PageVisit[]
  /** Web: rrweb events captured in the session replay, when recorded. */
  replayEvents?: number
  /** Web: replay file name relative to the report dir. */
  replayFile?: string
  /** CLI: captured output of the run command. */
  output?: string
  /** Web: how the app answered deliberately hostile requests. */
  hostile?: HostileCheck[]
}

/** One hostile request and how the submission handled it. */
export interface HostileCheck {
  check: string
  status: number | "no response"
  /** Response body leaked a stack trace — the tutorial-vs-senior tell. */
  leakedTrace: boolean
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
  /** Questions a hiring panel should ask this candidate, grounded in the code. */
  interviewQuestions: string[]
}
