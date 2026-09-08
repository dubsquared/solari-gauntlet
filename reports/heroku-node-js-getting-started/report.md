# Gauntlet review — https://github.com/heroku/node-js-getting-started.git

**19/30** (▲ was 17/30) · reviewed 2026-09-07 at `7233aca` · ran as `web` · 71s · ~18k tokens

| Dimension | Score | |
| --- | --- | --- |
| Runs | 8/10 | `████████░░` |
| Delivers its claims | 7/10 | `███████░░░` |
| Code quality | 4/10 | `████░░░░░░` |

The submission runs successfully and its live behavior matches the README's boilerplate claims, with tests passing and no error leakage on hostile probes. However, based on the file tree, manifests, and source shown, this is essentially the stock Heroku Node.js getting-started template with no visible original feature work, so it's not possible to assess genuine coding ability beyond copying and running a reference project. Code quality must be scored conservatively given the thinness and boilerplate nature of what was actually shown.

## Strengths
- App starts cleanly and the bundled jest suite (2 tests, IPv4/IPv6 bind checks) passes
- Live page content matches the README's described tutorial content, and 404/malformed-JSON hostile checks returned proper 404s with no stack trace leakage
- Sensible production touches carried from the template: keepAliveTimeout set above Heroku's router idle timeout, graceful SIGTERM handling

## Concerns
- The entire repository, including index.js, package.json, README, and test.js, appears to be the unmodified heroku/node-js-getting-started template — there is no visible custom feature, route, or business logic that would demonstrate the candidate's own engineering beyond copying the reference project
- package.json declares engines node 22.x||24.x||26.x but the app was only verified running on node 18.20.4, producing EBADENGINE warnings; this mismatch was not resolved or explained
- Only one source file (index.js) was shown; there is no evidence of error handling, input validation, or any logic beyond a single static-plus-templated-view GET route, making it hard to assess real coding ability
- Test suite is the stock template's own smoke test, not something demonstrating candidate-authored test design or coverage of custom functionality

## How it was run
> Simple Express+EJS app; no external deps/credentials needed, listens on PORT env (default 5006), binds all interfaces by default.

```console
$ cd /home/user/repo && npm install   # exit 0
$ node index.js   # exit 0
```

## The submission's own tests
`CI=true npx jest` → **PASS**

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
    ✓ should bind to IPv4 and respond to GET / (532 ms)
    ✓ should bind to IPv6 and respond to GET / (1014 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        1.826 s, estimated 2 s
Ran all test suites.

```

## Security sweep
- dependency audit: no known vulnerabilities
- secret patterns: no matches

## Live probe
Opened `https://3f9e8b9c4f97f4309f6e-5006.preview.getsolari.com` in a Solari cloud browser.

- title: "Node.js Getting Started on Heroku"
- landing page DOM loaded in 189ms
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
1. This repo appears identical to the official heroku/node-js-getting-started template — what, if anything, did you build or modify yourself, and can you walk through a change you made and why?
2. Your package.json requires node 22-26.x but the app was tested and ran on node 18.20.4 with EBADENGINE warnings — how would you actually enforce or reconcile the runtime version in a real deployment pipeline?
3. The keepAliveTimeout is explicitly set to 95s with a comment about Heroku's router timeout — can you explain the race condition this prevents and what would happen if you removed that line?

---
Evidence sealed: [`manifest.json`](manifest.json) carries a SHA-256 for every
artifact in this directory, ed25519-signed. `npm run verify -- <this dir>`
proves nothing changed since the review.
