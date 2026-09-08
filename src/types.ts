/** Shared shapes passed between the plan → execute → probe → verdict stages. */

export interface RunPlan {
  /** What kind of thing this repo is once running. web = HTTP server;
   *  cli = exits with output; gui = a desktop GUI window to look at. */
  kind: "web" | "cli" | "gui"
  /** Shell commands run in order to install/build. Each runs via `sh -c`. */
  setup: string[]
  /** Command that starts the app (web/gui) or produces its output (cli). */
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

/** One README claim, checked by driving the running app. */
export interface ClaimCheck {
  claim: string
  /** verified = all its assertions passed; failed = an assertion was false;
   *  unverified = couldn't be exercised (missing element, timeout). */
  result: "verified" | "failed" | "unverified"
  detail: string
}

export interface ProbeResult {
  kind: "web" | "cli" | "gui"
  /** Web: the public preview URL that was probed (query stripped). */
  url?: string
  /** GUI: the live VNC stream URL of the desktop session. */
  streamUrl?: string
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
  /** Web: README claims checked by driving the app, when --verify-claims is on. */
  claims?: ClaimCheck[]
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

/** A pull request resolved via the GitHub API. */
export interface PrMeta {
  number: number
  title: string
  body: string
  baseRef: string
  baseSha: string
  headRef: string
  headSha: string
  /** Clone URL of the head repo — differs from base when the PR is from a fork. */
  headCloneUrl: string
}

/** What one side (base or head) of a PR did when actually run. */
export interface SideEvidence {
  label: "base" | "head"
  sha: string
  buildOk: boolean
  testsPass: boolean | null
  loadMs: number | null
  consoleErrors: number
  hostileLeaks: number
  probeOk: boolean
}

export interface DiffVerdict {
  assessment: "improvement" | "regression" | "neutral" | "mixed"
  summary: string
  improvements: string[]
  regressions: string[]
  concerns: string[]
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
