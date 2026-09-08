# Gauntlet

**An AI reviewer for code submissions, built on [Solari](https://getsolari.com).**

Point Gauntlet at any GitHub repo. It clones the repo into a fresh Solari
sandbox, has Claude figure out how to install and run it (and re-plan when a
build breaks), exposes the running app on a public preview URL, opens that URL
in a Solari cloud browser, screenshots it, and writes a scored review — does it
run, does it do what the README claims, is the code any good.

Built for a hiring challenge that promised *"we review every build that tags
us."* This is that reviewer. Every submission runs the gauntlet — including
the actual contest field: **[the live leaderboard](LEADERBOARD.md)** ranks
every public submission to the challenge, this repo among them, same rubric,
no special treatment.

Real output from a real run:

```console
$ npm start -- https://github.com/heroku/node-js-getting-started

▶ https://github.com/heroku/node-js-getting-started
  sandbox: ZGVza3RvcC1wb29sLWktMDZjMWYz...
  plan (attempt 1): Express app; PORT env var sets listening port, default binds all interfaces
    $ npm install → exit 0
    $ PORT=3000 node index.js (background)
  preview: https://...preview.getsolari.com
  screenshot saved, title: "Node.js Getting Started on Heroku"
  ✔ 22/30 → reports/heroku-node-js-getting-started/report.md
```

Two reviews from live runs are committed in this repo, screenshots included:

- [heroku/node-js-getting-started → 22/30](reports/heroku-node-js-getting-started/report.md)
  — the reviewer flagged the Node engine mismatch, the npm audit findings,
  and that the db-backed page went unverified.
- [mdn/beginner-html-site-styled → 21/30](reports/mdn-beginner-html-site-styled/report.md)
  — it noticed the repo is an unmodified tutorial clone and scored it
  accordingly as a hiring submission. That's the judgment the tool is for.
- [dubsquared/solari-gauntlet → 18/30](reports/dubsquared-solari-gauntlet/report.md)
  — yes, it reviewed itself. It couldn't observe its own pipeline live
  (no real API keys inside a reviewer's sandbox), so it refused to award
  "Runs" points on faith — and along the way the self-healing planner hit
  the sandbox's Node 18, diagnosed the engine mismatch, and upgraded Node
  inside the VM to keep going. It flagged the missing `engines` field as
  real onboarding friction; that fix is now committed. A reviewer that
  gives itself 30/30 is a reviewer you can't trust.

## Why this needs Solari

Running a stranger's code from the internet on your laptop is how you get
owned. Running it in a Solari **sandbox** — a microVM that boots from a
snapshot in about a second and is destroyed after the review — makes the scary
part free. The **port preview** makes the app publicly reachable without any
networking setup, and the **cloud browser** means the "does it actually
render?" check is a real Chromium looking at a real URL, not a curl and a
prayer. One Solari key for all the infrastructure, one Anthropic key for the
judgment, nothing to deploy.

## How it works

```
GitHub URL
   │
   ▼
┌─────────────────────────── Solari sandbox ───────────────────────────┐
│  git clone → gather context (tree, README, manifests)                │
│  Claude plans install/run  ──►  execute  ──►  on failure, replan ↺   │
│  web app? start it, expose the port on a public preview URL          │
└──────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌────────────────────────  Solari cloud browser ───────────────────────┐
│  open the preview URL · capture title, text, console errors          │
│  full-page screenshot                                                │
└──────────────────────────────────────────────────────────────────────┘
   │
   ▼
Claude scores what actually happened → reports/<repo>/report.md
```

Beyond run-and-screenshot, every review also:

- **runs the submission's own test suite** and prints the transcript — the
  single highest-trust signal per engineering-hour, and it's deterministic;
- **records the whole browser probe** as an rrweb replay
  (`replay.ndjson`, committed next to the report) — when a candidate says
  "it worked for me," the dispute ends in thirty seconds;
- **sweeps for trouble before any repo code executes**: secret-pattern scan
  and a lockfile-only `npm audit` (no scripts run);
- **walks beyond the front door**: same-origin pages visited with per-page
  console-error counts, landing-page load time, and a mobile-viewport
  screenshot;
- **generates three interview questions** grounded in the specific code —
  built to distinguish "wrote it and understands it" from "generated it and
  shipped";
- **accounts for itself**: wall time and token spend on every report,
  machine-readable `verdict.json` and `invoice.json` beside every
  `report.md`, a per-review token circuit breaker, and an append-only
  `reports/ledger.ndjson` tracking every repo's score, load time, and test
  status across re-reviews;
- **ships a shareable report card**: a self-contained `report.html` per
  review — scores, evidence, screenshots, and the **session replay embedded
  with a player**. Send one file; the whole review travels with it;
- **signs its verdicts**: the evidence manifest is ed25519-signed, and
  `npm run verify -- reports/<slug>` recomputes every hash and validates the
  signature. Inflate a score by one point and verification fails loudly;
- **shows the redemption arc**: re-reviewing a repo prints the score delta
  (▲/▼ vs last time) in the report, the card, and the ledger.

Three things make it an agent rather than a script:

- **Self-healing builds.** When `npm ci` fails on a lockfile or a Python app
  is missing a system package, the failing command's output goes back to
  Claude, which produces a corrected plan. Three strikes and the failure
  itself gets judged.
- **Evidence-based verdicts.** The reviewer model never sees the repo alone —
  it sees the executed commands with exit codes, the server log, the rendered
  page text, and the console errors. It grades what ran, not what was
  promised.
- **CLI submissions work too.** Not everything serves a port; a repo that
  prints its result is captured and judged the same way.

## Run it

```bash
git clone https://github.com/dubsquared/solari-gauntlet.git
cd solari-gauntlet
npm install

export SOLARI_API_KEY=slr_live_...      # console.getsolari.com
export ANTHROPIC_API_KEY=sk-ant-...     # console.anthropic.com

npm run smoke                        # verifies the Solari half alone — no Anthropic key needed
npm start -- https://github.com/heroku/node-js-getting-started
```

Reports land in `reports/<owner>-<repo>/` as markdown with the screenshot
embedded. Pass several URLs and you also get `reports/index.md` — a ranked
table across the batch, which is the artifact a hiring reviewer actually
opens. Submissions that live on a branch or in a subdirectory work as-is:
`.../tree/<branch>/<path>` URLs are understood.

Batch controls, tuned for a finance sign-off:

- `--concurrency N` — parallel reviews (Solari Starter allows 2 concurrent
  sandboxes; two reviews finish in about the wall time of one).
- `--budget-tokens N` (or `GAUNTLET_MAX_TOKENS`) — hard ceiling on Anthropic
  tokens for the whole batch. Crossing it skips the remaining repos loudly
  and exits nonzero; nothing is ever reviewed on a blown budget.
- Every report carries its own wall-time + token cost line, and the batch
  prints a totals line at the end.
- `GAUNTLET_MODEL` overrides the reviewer model (default `claude-sonnet-5`).

## What each Solari product does here

| Product | Used for |
| --- | --- |
| Sandbox | Clone + build + run untrusted code in a disposable microVM |
| Port preview | Make the sandboxed server publicly reachable, zero config |
| Cloud browser | Render the app for real: title, text, console errors, screenshot |

| Session recording | The probe's full DOM-level replay, committed as audit evidence |

## Roadmap (from two multi-persona design reviews and a focus group)

Shipped since the focus group:

- **PR behavioral-diff mode** — give it a pull-request URL
  (`.../pull/123`) and it clones once, fetches both sides (fork-safe), runs
  base *and* head in one sandbox, and reviews the *delta*: a table of build
  status, tests that flipped, load time, console errors, and stack-trace
  leaks — measured, not claimed — plus a Claude assessment of
  improvement / regression / neutral / mixed and before/after
  screenshots and replays. Evidence no static reviewer (Copilot,
  CodeRabbit) can produce. Wire it to PRs with the
  [example workflow](examples/gauntlet-pr-review.yml).

- **Self-updating PR comment** — with `--pr-comment` (or `pr-comment: true`
  in the Action), the behavioral-diff verdict is posted as one sticky comment
  on the PR, keyed by a hidden marker so it edits itself on each push instead
  of spamming the thread. `--dry-run-comment` renders it to stdout without
  posting. Needs a `GITHUB_TOKEN` with pull-request write.

- **GitHub Check Run** — with `--pr-check` (or `pr-check: true`), the diff
  verdict is published as a first-class check on the head commit.
  Conclusion is **advisory by default** — improvement/neutral pass,
  regression/mixed report `neutral`, *nothing fails a merge* — so it
  survives an org rollout. `--strict-check` opts into failing regressions
  for teams that want a hard gate. Needs `checks: write`.

- **Snapshot-warmed environments** (`--warm`, opt-in) — the first green build
  of a repo is checkpointed as a Solari snapshot with dependencies hot *and
  the known-good run plan baked inside it*. A later `--warm` review of the
  same repo boots from that snapshot, syncs to the target commit, and
  **replays the cached plan — zero planning tokens, no replan guesswork**.
  It's a pure optimization: any warm miss (a dropped control channel after
  restore, a sync error) discards that VM and cold-boots clean, so warm-start
  can never fail or corrupt a review — only ever make it a little slower.
  Snapshots are keyed by repo + lockfile hash and LRU-evicted (newest 2 per
  repo). Biggest win on repos with a heavy, stable dependency install that
  you re-review often; for trivial static repos the boot overhead can make it
  a wash, which is why it's off by default.

- **Watch mode** (`--watch`) — a standing reviewer. It polls each target's
  commit sha every `--interval` seconds (floor 60, default 300) and
  re-reviews **only when the sha changes** — an idle poll is a single free
  GitHub call, so spend tracks real activity, not wall-clock. Pairs naturally
  with `--warm` (same repo, over and over) and honours `--budget-tokens` as a
  cumulative ceiling that stops the whole watch, so it can never run unbounded.
  Works on repo and PR targets; rebuilds the Arena after every new review.
- **Gauntlet Arena** (`npm run arena`) — a single self-updating scoreboard,
  `reports/arena.html`, ranking every repo review and listing every PR
  verdict, each row linking to the full evidence card. Pure render from the
  committed `verdict.json` files: no sandbox, no API, no tokens. Rebuilt
  automatically after any batch or watch review.

Ranked by demand across the earlier stakeholder panel:

- **Failure-mode probe** — POST malformed JSON, request missing routes, send
  oversized bodies; record status codes and stack-trace leaks. "Does it
  survive hostile input" is the senior-vs-tutorial filter.
- **Interactive claim verification** — Claude extracts checkable claims from
  the README ("add a todo, it persists") and emits a bounded action script
  the probe executes: fill, click, assert, reload. Renders ≠ works.
- **Cross-batch plagiarism detection** — embed and compare submissions;
  template clones already get caught, copies of each other don't yet.
- **Network egress monitor** — log what the submission talks to during
  install and run; a hiring submission phoning home is a finding.
- **GitHub Action + `--concurrency N`** — batch reviews in parallel CI.
- **Desktop sessions for GUI submissions** — same treatment via X11
  screenshot and VNC stream; the plumbing is identical, `kind: "gui"`.

## Reviewing hostile code, on purpose

Every input to this tool is untrusted by definition, so the design assumes
the submission is malicious:

- **The repo runs remotely, never here.** Clone, install, and execution all
  happen in a disposable Solari microVM that is killed after the review. No
  API keys are ever exported into the sandbox.
- **The repo URL is parsed, not interpolated.** Only
  `https://github.com/<owner>/<repo>` passes validation, and the clone goes
  through argv (`git clone -- <url>`), so neither shell metacharacters nor
  git option injection reach a shell.
- **Repo-derived text is fenced off in prompts.** Everything the submission
  controls (README, file tree, build output, rendered page text, console
  errors) reaches Claude inside `<untrusted_submission_content>` tags that
  both system prompts are instructed to treat as data — and to report as a
  red flag if it tries to give instructions.
- **Scores get a deterministic cross-check.** A verdict claiming a clean run
  that the step transcript contradicts — or suspiciously perfect scores —
  marks the report *flagged for manual review*. Prompt injection against
  LLM reviewers can be mitigated, not eliminated; the flag is the backstop,
  and reports never pretend otherwise.
- **Reports sanitize what they quote.** Preview access tokens, ANSI escape
  sequences, and code-fence breakouts are stripped before anything the
  submission produced lands in a committed markdown file.
- **The readiness poll can't be steered.** The host-side health check uses
  `redirect: "manual"` with a per-request timeout, so a hostile server can't
  bounce this machine into internal endpoints (blind-GET SSRF). The actual
  page rendering happens in Solari's cloud browser, not here.

## Honest limitations

- Reviews are sequential; parallelizing across sandboxes is a `Promise.all`
  away but makes the console output unreadable.
- A malicious repo can't escape the sandbox, but it can waste your Solari
  minutes until the 10-minute idle timeout kills it.
- Prompt injection defenses reduce risk; they don't zero it. The
  flagged-for-review mechanism exists because a sufficiently clever
  submission may still nudge a score.
- The 0–10 scores are an LLM's judgment, calibrated by rubric anchors and
  grounded in source excerpts the model actually reads. They rank a pile of
  submissions well; they are not a substitute for reading the finalists.

MIT licensed.
