# Gauntlet review — https://github.com/mdn/beginner-html-site-styled.git

**18/30** · reviewed 2026-09-08 at `6c7a360` · ran as `web` · 62s · ~5k tokens

| Dimension | Score | |
| --- | --- | --- |
| Runs | 8/10 | `████████░░` |
| Delivers its claims | 7/10 | `███████░░░` |
| Code quality | 3/10 | `███░░░░░░░` |

The submission is a static one-page HTML/CSS site that served correctly and rendered content consistent with the README's description, and it handled a couple of hostile requests gracefully. However, no actual source code was available to review, there is no test suite, and the repo structure strongly suggests this is simply the stock MDN tutorial template rather than a differentiated piece of engineering. Scores reflect that it runs and superficially delivers, but there is essentially nothing to assess for code quality or engineering judgment.

## Strengths
- Static site served cleanly via python http.server with a 150ms load time
- Rendered page content (headings, list, manifesto link) matches what the README describes for this beginner HTML/CSS tutorial
- Server responded sanely to hostile probes (404 for missing route, 501 for malformed POST) without leaking stack traces

## Concerns
- No source excerpts were actually provided (index.html/style.css contents were not shown), so code structure, semantics, and CSS quality cannot be verified firsthand
- This appears to be an unmodified clone of MDN's official 'beginner-html-site-styled' tutorial repo (same file tree, README, CODEOWNERS, SECURITY.md) rather than original submitted work — no custom logic, no build step, no tests
- No test suite exists and none is applicable to a static two-file site, so codeQuality can't be credited beyond 'it's a flat static page'
- Console showed mixed-content warnings tied to a proxy/sandbox token in the URL — noise from the hosting harness, but worth confirming it doesn't reflect an actual insecure asset reference in the page

## How it was run
> Static HTML/CSS site with no build step; serve files directly with Python's http server.

```console
$ python3 -m http.server 3000 --bind 0.0.0.0   # exit 0
```

## The submission's own tests
No test command found — a fact the score reflects.

## Security sweep
- dependency audit: n/a (no lockfile)
- secret patterns: no matches

## Live probe
Opened `https://6ed78dae6d3d95f14710-3000.preview.getsolari.com` in a Solari cloud browser.

- title: "My test page"
- landing page DOM loaded in 150ms
- console errors: 
  - `Mixed Content: The page at 'https://6ed78dae6d3d95f14710-3000.preview.getsolari.com/`
  - `Mixed Content: The page at 'https://6ed78dae6d3d95f14710-3000.preview.getsolari.com/`

### Failure-mode probe
How the app answers hostile requests — clean 4xx beats a stack trace:

| Check | Status | Stack trace leaked |
| --- | --- | --- |
| GET a route that does not exist | 404 | no |
| POST malformed JSON to / | 501 | no |

![screenshot](screenshot.png)

![mobile](screenshot-mobile.png)

## Ask the candidate
1. Walk me through index.html and style.css line by line — what CSS selectors did you choose and why, and what would you change to make the layout responsive?
2. This repo appears to mirror the standard MDN tutorial scaffold; what, if anything, did you personally write or modify versus what came from the template?
3. If you were asked to add a test for this static site, what would you test, and how would you set up that test harness from scratch?

---
Evidence sealed: [`manifest.json`](manifest.json) carries a SHA-256 for every
artifact in this directory, ed25519-signed. `npm run verify -- <this dir>`
proves nothing changed since the review.
