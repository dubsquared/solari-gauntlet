# Gauntlet review — https://github.com/heroku/node-js-getting-started.git

**19/30** · reviewed 2026-09-07 at `7233aca` · ran as `web` · 72s · ~14k tokens

| Dimension | Score | |
| --- | --- | --- |
| Runs | 8/10 | `████████░░` |
| Delivers its claims | 6/10 | `██████░░░░` |
| Code quality | 5/10 | `█████░░░░░` |

The submission runs and serves the expected static/EJS page, and its bundled test suite passes, but the codebase appears to be the stock Heroku getting-started template with no visible custom feature work — the db.ejs view suggests intended database functionality that is neither wired up nor demonstrated. Given the shallow scope of what was actually exercised (a single static route), this should be scored as a minimally-functional boilerplate rather than a substantive engineering deliverable.

## Strengths
- App started cleanly, served the index page as advertised, and jest test suite (IPv4/IPv6 bind tests) passed
- Graceful SIGTERM handling and keepAliveTimeout tuning show awareness of Heroku's router behavior
- 404s returned cleanly for unknown routes and malformed POSTs with no stack trace leakage

## Concerns
- This repo is effectively an unmodified clone of heroku/node-js-getting-started boilerplate — no evidence of original candidate work beyond the stock starter, which is a red flag for a hiring challenge submission
- views/pages/db.ejs exists in the tree but index.js only defines a single '/' route — no /db route was shown or exercised, so the Postgres-related functionality implied by the view is unverified or dead
- package.json requires node 22.x+ but the environment ran node 18.20.4, producing EBADENGINE warnings; it happened to still work, but engine constraints weren't actually satisfied
- Source excerpt is very thin (one file, single route) — insufficient to judge error handling, modularity, or any substantive business logic beyond the boilerplate

## How it was run
> Simple Express app with no external services/DB dependency required for the main route; binds to PORT env var which we set to 3000.

```console
$ cd /home/user/repo && npm install   # exit 0
$ PORT=3000 node index.js   # exit 0
```

## The submission's own tests
`npx jest --ci` → **PASS**

```
  console.log
    Listening on 5006

      at Socket.log (test.js:11:45)

  console.log
    Rendering 'pages/index' for route '/'

      at Socket.log (test.js:11:45)

  console.log
    Listening on 5006

      at Socket.log (test.js:11:45)

  console.log
    Rendering 'pages/index' for route '/'

      at Socket.log (test.js:11:45)

PASS ./test.js
  getting started guide
    ✓ should bind to IPv4 and respond to GET / (530 ms)
    ✓ should bind to IPv6 and respond to GET / (520 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        1.477 s
Ran all test suites.

```

## Security sweep
- dependency audit: no known vulnerabilities
- secret patterns: no matches

## Live probe
Opened `https://4149d3f870d480556491-3000.preview.getsolari.com` in a Solari cloud browser.

- title: "Node.js Getting Started on Heroku"
- landing page DOM loaded in 181ms
- console errors: none

### Failure-mode probe
How the app answers hostile requests — clean 4xx beats a stack trace:

| Check | Status | Stack trace leaked |
| --- | --- | --- |
| GET a route that does not exist | 404 | no |
| POST malformed JSON to / | 404 | no |

![screenshot](screenshot.png)

![mobile](screenshot-mobile.png)

## Ask the candidate
1. The tree includes views/pages/db.ejs but index.js only defines the root route — what was this view meant to do, and why isn't it wired up or tested?
2. You pinned engines to node 22.x/24.x/26.x yet the app ran fine on node 18 with EBADENGINE warnings — how would you actually enforce or verify engine compatibility in CI?
3. Walk me through what, if anything, in this repository is your own work versus the Heroku starter template — what would you add to make this genuinely demonstrate the challenge's requirements?

---
Evidence sealed: [`manifest.json`](manifest.json) carries a SHA-256 for every
artifact in this directory. If a byte of evidence changes after review,
the manifest says so.
