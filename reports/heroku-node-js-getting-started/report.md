# Gauntlet review — https://github.com/heroku/node-js-getting-started.git

**23/30** · reviewed 2026-09-02 at `63c6674` · ran as `web` · 74s · ~9k tokens

| Dimension | Score | |
| --- | --- | --- |
| Runs | 9/10 | `█████████░` |
| Delivers its claims | 8/10 | `████████░░` |
| Code quality | 6/10 | `██████░░░░` |

The submission runs cleanly, serves the expected static Heroku sample page, and passes its own Jest test suite with no secrets or crash leakage on hostile probes. However, it is nearly identical to the stock Heroku Node.js starter template with a single route and an unused db.ejs view, offering little evidence of original engineering depth. Given the thinness of the code and unresolved engine-version mismatch, this reads as a lightly-touched boilerplate rather than substantive custom work.

## Strengths
- App started cleanly, served the expected page content matching README's description, and responded correctly to hostile probes (404s, no stack trace leakage)
- index.js includes production-conscious details: static file serving, keepAliveTimeout tuned for Heroku's router timeout, and a SIGTERM handler for graceful shutdown
- Test suite (Jest) actually passed both IPv4 and IPv6 binding tests, and npm audit reported minimal vulnerabilities

## Concerns
- This is essentially the unmodified Heroku 'getting-started' boilerplate — there is no custom feature work distinguishing this as challenge-specific engineering; index.js has just one route
- views/pages/db.ejs exists in the tree but index.js never wires up a corresponding route or database connection, suggesting an incomplete or leftover feature with no evidence it works
- package.json declares node 22.x/24.x/26.x engines but the app was actually run on node 18.20.4 with EBADENGINE warnings — an engine mismatch that wasn't caught or fixed
- Source excerpts are thin (single file, ~30 lines) — not enough to assess error handling depth, input validation, or architecture beyond the trivial route

## How it was run
> Simple Express/EJS app, no DB/credentials needed; listens on PORT env var, bound to all interfaces by default.

```console
$ cd /home/user/repo && npm install   # exit 0
$ PORT=3000 node index.js   # exit 0
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
    ✓ should bind to IPv4 and respond to GET / (612 ms)
    ✓ should bind to IPv6 and respond to GET / (523 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        1.511 s
Ran all test suites.

```

## Security sweep
- dependency audit: moderate: 1, total: 1
- secret patterns: no matches

## Live probe
Opened `https://fe57fcc7e7c6e82578ee-3000.preview.getsolari.com` in a Solari cloud browser.

- title: "Node.js Getting Started on Heroku"
- landing page DOM loaded in 255ms
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
1. The package.json declares Node 22-26 as required engines but the app was run and tested on Node 18 with warnings — how would you have caught and resolved that mismatch before submission?
2. There's a db.ejs view in the views/pages directory with no corresponding route in index.js — what was the intended purpose, and why wasn't it implemented or removed?
3. Walk me through why you set server.keepAliveTimeout to 95 seconds and how you'd verify that value works correctly under Heroku's router behavior.

---
Evidence sealed: [`manifest.json`](manifest.json) carries a SHA-256 for every
artifact in this directory. If a byte of evidence changes after review,
the manifest says so.
