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
- `mdn-beginner-html-site-styled-pr114/` — a PR **behavioral-diff** review.

## Demo fixtures
Famous boilerplate repos, reviewed only to demonstrate the pipeline against
code whose contents you can already picture:

- `heroku-node-js-getting-started/` — the Heroku Node starter. Gauntlet
  correctly scores it as competent-but-unoriginal boilerplate and flags its
  orphaned `db.ejs`, its stock test, and its `package.json` Node-engine
  mismatch. That verdict is the *point* of the fixture, not a submission.
- `mdn-beginner-html-site-styled/` — MDN's tutorial site.

Each review directory is self-contained: `report.md` (human), `report.html`
(shareable card with the embedded replay), `verdict.json` / `invoice.json`
(machine-readable), and `manifest.json` (ed25519-signed hashes —
`npm run verify -- reports/<dir>` proves nothing changed since review).
