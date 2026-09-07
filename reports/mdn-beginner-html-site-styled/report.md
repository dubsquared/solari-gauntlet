# Gauntlet review — https://github.com/mdn/beginner-html-site-styled.git

**18/30** · reviewed 2026-09-07 at `6c7a360` · ran as `web` · 62s · ~8k tokens

| Dimension | Score | |
| --- | --- | --- |
| Runs | 8/10 | `████████░░` |
| Delivers its claims | 7/10 | `███████░░░` |
| Code quality | 3/10 | `███░░░░░░░` |

This is essentially the unmodified MDN 'beginner-html-site-styled' tutorial repo — a static HTML/CSS page with no backend logic, tests, or build process. It ran cleanly under a basic file server and the rendered content matches the README's description, but there is no source code shown and no test suite to judge engineering quality against. As a hiring submission it demonstrates almost nothing beyond the ability to serve a static file; scores reflect that it worked as expected but offered little substantive code to evaluate.

## Strengths
- Static site served cleanly via http.server with no crashes
- Live page content (title, Mozilla manifesto text) matches the README's stated purpose
- Repository structure follows the expected MDN beginner tutorial layout (images/, styles/, index.html)

## Concerns
- No source excerpts (HTML/CSS) were actually provided for review, so code quality cannot be verified from the files themselves
- No test suite, no manifest, no build tooling — appropriate for a static tutorial but leaves nothing to assess for engineering rigor
- Console showed repeated 'Mixed Content' warnings and an unusual pt_token query string appended to the URL, which is a preview-environment artifact but still worth flagging as a red flag / noise in the evaluation environment
- Hostile probes (404, 501) reflect Python's default http.server behavior, not any custom error handling written by the submitter

## How it was run
> Static HTML/CSS site with no build system; served directly via Python's built-in HTTP server.

```console
$ python3 -m http.server 3000 --bind 0.0.0.0   # exit 0
```

## The submission's own tests
No test command found — a fact the score reflects.

## Security sweep
- dependency audit: n/a (no lockfile)
- secret patterns: no matches

## Live probe
Opened `https://97bfe158170b980c5b28-3000.preview.getsolari.com` in a Solari cloud browser.

- title: "My test page"
- landing page DOM loaded in 119ms
- console errors: 
  - `Mixed Content: The page at 'https://97bfe158170b980c5b28-3000.preview.getsolari.com/`
  - `Mixed Content: The page at 'https://97bfe158170b980c5b28-3000.preview.getsolari.com/`

### Failure-mode probe
How the app answers hostile requests — clean 4xx beats a stack trace:

| Check | Status | Stack trace leaked |
| --- | --- | --- |
| GET a route that does not exist | 404 | no |
| POST malformed JSON to / | 501 | no |

![screenshot](screenshot.png)

![mobile](screenshot-mobile.png)

## Ask the candidate
1. Since no source HTML/CSS was included for review, can you walk through the structure of your index.html and style.css and explain key styling decisions?
2. This site has no automated tests — how would you approach testing a static front-end project like this, and what would you prioritize?
3. The live probe showed mixed-content warnings in the console — how would you diagnose and fix mixed content issues when serving a site over HTTPS?

---
Evidence sealed: [`manifest.json`](manifest.json) carries a SHA-256 for every
artifact in this directory. If a byte of evidence changes after review,
the manifest says so.
