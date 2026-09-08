# What's in here

**Everything in this directory is a repo Gauntlet *reviewed*. None of it is
Gauntlet's own source** — that lives in [`../src`](../src). If a review here
reads harshly (unmodified boilerplate, an orphaned view, a Node engine
mismatch, a stock test file), that is the tool doing its job on the repo named
in the report, not a critique of this project.

## The live contest field
Real submissions to the Pinetree/Solari challenge, ranked in
[`../LEADERBOARD.md`](../LEADERBOARD.md):

- `dubsquared-solari-gauntlet/` — this project reviewing **itself**, no special
  treatment (a reviewer that scores itself 30/30 is one you can't trust).
- `AlexanderLuzDH-...forklift.../`, `elMonsi-solari-agent-kit/`,
  `SaddyMalingu-previewguard/`, `itw-code-solari-cookbook/` — competitors.
- `mdn-beginner-html-site-styled-pr114/` — a PR **behavioral-diff** review
  (base and head both built and probed; `base/` and `head/` hold each side's
  screenshots).

## Real production code
Reviewed to prove the tool handles serious repos, not just demos. Same
rubric; scores measure what a sandbox could verify:

- `teslamotors-vehicle-command/` — 24/30, the highest to date: Go toolchain
  self-installed, full test suite green across ~12 packages.
- `ruvnet-ruv-FANN/` — 17/30: Rust toolchain self-installed, core crate built
  clean, 173 tests passing; the README's broader claims were unverifiable
  from a core-crate build and scored accordingly.
- `teslamotors-light-show/` — 14/30: a data repo whose one script blocks on
  `input()` even on success. Gauntlet diagnosed the hang, retried with piped
  stdin, and reported the defect.

## Demo fixtures
Famous boilerplate and small apps, reviewed to demonstrate the pipeline
against code whose contents you can already picture:

- `heroku-node-js-getting-started/` — the Heroku Node starter. Gauntlet
  correctly scores it as competent-but-unoriginal boilerplate and flags its
  orphaned `db.ejs`, its stock test, and its `package.json` Node-engine
  mismatch. That verdict is the *point* of the fixture, not a submission.
- `mdn-beginner-html-site-styled/` — MDN's tutorial site.
- `techwithtim-Snake-Game/` — a pygame game, reviewed as a **GUI** on a
  Solari desktop: vision judged the rendered window, and computer-use drove
  it to check the README's claims.

Each review directory is self-contained: `report.md` (human), `report.html`
(shareable card with the embedded replay), `verdict.json` / `invoice.json`
(machine-readable), `fingerprint.json` (MinHash signature for clone
detection), screenshots, and `manifest.json` (ed25519-signed hashes —
`npm run verify -- reports/<dir>` proves nothing changed since review).
`context.txt`, the raw planner context, is not committed.
