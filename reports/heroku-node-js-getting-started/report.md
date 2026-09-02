# Gauntlet review — https://github.com/heroku/node-js-getting-started.git

**18/30** · reviewed 2026-09-02 at `63c6674` · ran as `web` · 92s · ~11k tokens

| Dimension | Score | |
| --- | --- | --- |
| Runs | 7/10 | `███████░░░` |
| Delivers its claims | 6/10 | `██████░░░░` |
| Code quality | 5/10 | `█████░░░░░` |

The submission is a working but essentially stock Heroku Node.js starter app — it started, served the expected index page, and passed its own Jest tests. However it closely tracks the upstream template with little visible customization, and includes an orphaned db.ejs view with no corresponding route, plus an unresolved Node engine version mismatch. As a hiring-challenge deliverable, it demonstrates competent boilerplate reuse but not clear evidence of original problem-solving or deeper engineering ownership.

## Strengths
- The app started cleanly after installing a compatible Node version, and the rendered page matched the README's described content ('Getting Started on Heroku with Node.js', links to guides, etc.)
- index.js includes production-conscious details (keepAliveTimeout tuned above Heroku router's idle timeout, graceful SIGTERM handling) that show some platform awareness
- A Jest test suite exists and passes cleanly (IPv4/IPv6 binding + GET / checks), giving at least a minimal automated regression check

## Concerns
- This is essentially the unmodified Heroku 'node-js-getting-started' boilerplate — file names, comments, and README text mirror the upstream template almost verbatim, so it's unclear what original work the candidate contributed
- views/pages/db.ejs exists in the tree but index.js defines no /db route or database connection code at all — this is dead/unused code with no evidence the promised Postgres demo functionality actually works
- package.json requires Node 22.x-26.x, but the app only ran after installing Node 20 manually (EBADENGINE warning during npm install), indicating an environment/version mismatch was not caught or resolved
- npm audit reports a moderate vulnerability that was not addressed
- Excerpts show only index.js in real depth; other views/logic (db.ejs, header/nav partials) were not shown, making it hard to assess overall code quality beyond the trivial route

## How it was run
> Simple Express+EJS app; no DB or API keys required, listens on PORT env var.

```console
$ cd /home/user/repo && curl -fsSL https://deb.nodesource.com/setup_20.x | bash -    # exit 0
$ cd /home/user/repo && apt-get install -y nodejs   # exit 0
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
    ✓ should bind to IPv4 and respond to GET / (522 ms)
    ✓ should bind to IPv6 and respond to GET / (772 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        1.601 s
Ran all test suites.

```

## Security sweep
- dependency audit: moderate: 1, total: 1
- secret patterns: no matches

## Live probe
Opened `https://01fdf5bcf90cca98cf97-3000.preview.getsolari.com` in a Solari cloud browser.

- title: "Node.js Getting Started on Heroku"
- landing page DOM loaded in 178ms
- console errors: none

📼 Full session replay: [`replay.ndjson`](replay.ndjson) — 12 rrweb events, a DOM-level recording of everything the probe saw. Disputes end here.

![screenshot](screenshot.png)

![mobile](screenshot-mobile.png)

## Ask the candidate
1. views/pages/db.ejs exists in your repo, but index.js has no /db route or database connection code — what was this meant to do, and why is it not wired up?
2. Your package.json requires Node 22.x–26.x, yet the app only ran cleanly after we installed Node 20 and got an EBADENGINE warning — how would you handle this discrepancy for a real deployment pipeline?
3. This project closely matches Heroku's public getting-started template — walk us through which parts of index.js or the views you personally wrote or modified, and why you made those specific choices.
