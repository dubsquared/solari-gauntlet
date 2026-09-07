# Gauntlet review — https://github.com/heroku/node-js-getting-started.git

**18/30** (▼ was 19/30) · reviewed 2026-09-07 at `7233aca` · ran as `web` · 74s · ~10k tokens

| Dimension | Score | |
| --- | --- | --- |
| Runs | 8/10 | `████████░░` |
| Delivers its claims | 6/10 | `██████░░░░` |
| Code quality | 4/10 | `████░░░░░░` |

This submission runs cleanly and the live probe matches the barebones claims in the README, but the codebase is essentially the stock Heroku Node.js starter template with no visible custom functionality added for the hiring challenge. The unused db.ejs view and the engine-version mismatch suggest incomplete customization or lack of attention to the manifest. As evidence of engineering skill for a hiring decision, this is thin — it demonstrates the app can be run but not that the candidate built anything substantial beyond the provided scaffold.

## Strengths
- npm install, npm start, and npm test all completed successfully with exit code 0
- Live probe confirms the app renders the expected homepage content and handles a nonexistent route with a clean 404 (no stack trace leak)
- Graceful SIGTERM handling and keep-alive timeout tuning show awareness of Heroku's dyno lifecycle
- Security sweep found no vulnerabilities or leaked secrets

## Concerns
- The repository is essentially the unmodified Heroku 'nodejs-getting-started' boilerplate — index.js only implements a single static '/' route with no custom business logic, so there is little original engineering to evaluate
- views/pages/db.ejs exists in the tree but no /db route or database integration appears in index.js, suggesting an incomplete or copy-pasted scaffold rather than a working feature
- package.json declares node 22.x/24.x/26.x but the app was actually run on node 18.20.4, triggering EBADENGINE warnings — indicates the manifest wasn't validated against the actual run environment
- No custom error-handling middleware, input validation, or additional endpoints are present to demonstrate defensive coding beyond Express/EJS defaults
- test.js only checks IPv4/IPv6 binding and a 200 on '/', not deep functional coverage, and appears to be the stock template test rather than added by the candidate

## How it was run
> Simple Express/EJS app, no DB or credentials required; binds to PORT env var (defaults 5006), overridden to 3000.

```console
$ cd /home/user/repo && npm install   # exit 0
$ PORT=3000 npm start   # exit 0
```

## The submission's own tests
`npm test` → **PASS**

```

> test
> jest

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
    ✓ should bind to IPv4 and respond to GET / (1260 ms)
    ✓ should bind to IPv6 and respond to GET / (525 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        2.207 s
Ran all test suites.

```

## Security sweep
- dependency audit: no known vulnerabilities
- secret patterns: no matches

## Live probe
Opened `https://19b289dffc1eed318402-3000.preview.getsolari.com` in a Solari cloud browser.

- title: "Node.js Getting Started on Heroku"
- landing page DOM loaded in 197ms
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
1. The repo includes views/pages/db.ejs but index.js has no route serving it — what was this meant to do, and why was it left disconnected?
2. package.json requires Node 22.x-26.x yet you ran (and presumably tested) on Node 18.20.4 — how did you validate engine compatibility before submitting?
3. Beyond the single static '/' route, what part of this application did you write or modify yourself versus what came from the Heroku template, and can you walk through those specific changes?

---
Evidence sealed: [`manifest.json`](manifest.json) carries a SHA-256 for every
artifact in this directory, ed25519-signed. `npm run verify -- <this dir>`
proves nothing changed since the review.
