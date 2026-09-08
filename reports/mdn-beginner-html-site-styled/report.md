# Gauntlet review — https://github.com/mdn/beginner-html-site-styled.git

**19/30** (▲ was 18/30) · reviewed 2026-09-08 at `6c7a360` · ran as `web` · 61s · ~6k tokens

| Dimension | Score | |
| --- | --- | --- |
| Runs | 8/10 | `████████░░` |
| Delivers its claims | 8/10 | `████████░░` |
| Code quality | 3/10 | `███░░░░░░░` |

The site is a simple static HTML/CSS page (an MDN beginner tutorial fork) that served correctly and matched the README's content claims when driven live. However, the live probe caught a genuine bug — an insecure http:// font stylesheet causing mixed-content blocking — indicating the CSS/HTML wasn't fully hardened for HTTPS delivery. With no source excerpts, tests, or manifest supplied, code quality must be judged mostly on the visible defect and the minimal nature of the deliverable.

## Strengths
- Static site served cleanly with python http.server, no errors on load
- Rendered content matches README claims exactly (heading text, Mozilla Manifesto mention)
- 404 and malformed-request handling did not leak stack traces

## Concerns
- Live console shows Mixed Content errors: page loads over HTTPS but references an insecure http:// Google Fonts stylesheet — this is a real, verifiable defect in the shipped markup/CSS, not just an artifact of the proxy
- No source excerpts were actually provided for review (index.html, style.css contents not shown), so code quality can't be verified beyond behavior — scored conservatively
- No test suite, no manifest, no build tooling — acceptable for a beginner HTML/CSS tutorial repo but means there's no automated verification of markup/CSS correctness
- This repo is a copy of an MDN beginner tutorial; almost all substantive content (HTML structure, CSS approach) is templated/prescribed by the tutorial rather than original engineering by the candidate

## How it was run
> Static HTML/CSS site with no build process; serve files directly with a simple HTTP server.

```console
$ python3 -m http.server 3000 --bind 0.0.0.0   # exit 0
```

## The submission's own tests
No test command found — a fact the score reflects.

## Security sweep
- dependency audit: n/a (no lockfile)
- secret patterns: no matches

## Live probe
Opened `https://5baa0149770666e466f8-3000.preview.getsolari.com` in a Solari cloud browser.

- title: "My test page"
- landing page DOM loaded in 125ms
- console errors: 
  - `Mixed Content: The page at 'https://5baa0149770666e466f8-3000.preview.getsolari.com/`
  - `Mixed Content: The page at 'https://5baa0149770666e466f8-3000.preview.getsolari.com/`
  - `Mixed Content: The page at 'https://5baa0149770666e466f8-3000.preview.getsolari.com/' was loaded over HTTPS, but requested an insecure stylesheet 'http://fonts.googleapis.com/css?family=Open+Sans'. This request has been blocked; the content must be served over HTTPS.`
  - `Mixed Content: The page at 'https://5baa0149770666e466f8-3000.preview.getsolari.com/`
  - `Mixed Content: The page at 'https://5baa0149770666e466f8-3000.preview.getsolari.com/' was loaded over HTTPS, but requested an insecure stylesheet 'http://fonts.googleapis.com/css?family=Open+Sans'. This request has been blocked; the content must be served over HTTPS.`
  - `Mixed Content: The page at 'https://5baa0149770666e466f8-3000.preview.getsolari.com/`
  - `Mixed Content: The page at 'https://5baa0149770666e466f8-3000.preview.getsolari.com/`

### Failure-mode probe
How the app answers hostile requests — clean 4xx beats a stack trace:

| Check | Status | Stack trace leaked |
| --- | --- | --- |
| GET a route that does not exist | 404 | no |
| POST malformed JSON to / | 501 | no |

### README claims, checked by driving the app
renders ≠ works — each claim was exercised in the live browser:

- ✅ **verified** — The landing page displays the heading text 'Mozilla is cool' _(all assertions held when the app was driven)_
- ✅ **verified** — The page mentions the Mozilla Manifesto _(all assertions held when the app was driven)_

![screenshot](screenshot.png)

![mobile](screenshot-mobile.png)

## Ask the candidate
1. The Google Fonts stylesheet link uses http:// instead of https://, causing mixed-content blocking under HTTPS — how would you fix this and why did it happen?
2. This repo is largely a copy of an MDN starter tutorial — what specific parts of the HTML/CSS did you personally write or modify versus scaffold from the tutorial?
3. If you were to extend this into a real multi-page site, how would you structure the CSS to avoid duplication and handle responsive layout?

---
Evidence sealed: [`manifest.json`](manifest.json) carries a SHA-256 for every
artifact in this directory, ed25519-signed. `npm run verify -- <this dir>`
proves nothing changed since the review.
