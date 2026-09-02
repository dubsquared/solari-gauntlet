# Gauntlet

**An AI reviewer for code submissions, built on [Solari](https://getsolari.com).**

Point Gauntlet at any GitHub repo. It clones the repo into a fresh Solari
sandbox, has Claude figure out how to install and run it (and re-plan when a
build breaks), exposes the running app on a public preview URL, opens that URL
in a Solari cloud browser, screenshots it, and writes a scored review — does it
run, does it do what the README claims, is the code any good.

Built for a hiring challenge that promised *"we review every build that tags
us."* This is that reviewer. Every submission runs the gauntlet.

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
opens. `GAUNTLET_MODEL` overrides the reviewer model (default
`claude-sonnet-5`).

## What each Solari product does here

| Product | Used for |
| --- | --- |
| Sandbox | Clone + build + run untrusted code in a disposable microVM |
| Port preview | Make the sandboxed server publicly reachable, zero config |
| Cloud browser | Render the app for real: title, text, console errors, screenshot |

Desktop sessions are the natural next step — submissions that are GUI apps
rather than web apps would get the same treatment via a screenshot of an X11
screen. The plumbing is identical; `kind: "gui"` is left as roadmap.

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
