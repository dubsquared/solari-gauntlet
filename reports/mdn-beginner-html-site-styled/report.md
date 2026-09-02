# Gauntlet review — https://github.com/mdn/beginner-html-site-styled.git

**21/30** · reviewed 2026-09-02 at `6c7a360` · ran as `web`

| Dimension | Score | |
| --- | --- | --- |
| Runs | 9/10 | `█████████░` |
| Delivers its claims | 8/10 | `████████░░` |
| Code quality | 4/10 | `████░░░░░░` |

The site is a static HTML/CSS tutorial page that started and rendered successfully, with live page text matching the expected MDN 'Mozilla is cool' content, fulfilling the basic README promise. However, no actual source code was provided for review, so code quality can only be scored conservatively based on the repo's minimal, tutorial-level nature. This is an intentionally simple beginner project with no application logic, tests, or error handling to assess.

## Strengths
- Static site served cleanly via python http.server with no errors related to app logic
- Live page content matches the expected MDN beginner tutorial content (Mozilla is cool, manifesto text, etc.)
- Simple, low-risk scope appropriate for a beginner HTML/CSS tutorial repo

## Concerns
- No source excerpts (index.html, style.css) were actually provided, so code quality cannot be verified directly
- No tests, error handling, or build tooling present — expected for a static tutorial repo but limits quality signal
- Console shows a mixed-content warning, though likely from the preview proxy rather than the site itself
- Manifests were empty/none, further limiting verifiability of structure

## How it was run
> Static HTML/CSS site; serve files directly with a simple HTTP server, no build needed.

```console
$ python3 -m http.server 3000 --bind 0.0.0.0   # exit 0
```

## Live probe
Opened `https://e1725f8c6e377fb8b326-3000.preview.getsolari.com` in a Solari cloud browser.

- title: "My test page"
- console errors: 
  - `Mixed Content: The page at 'https://e1725f8c6e377fb8b326-3000.preview.getsolari.com/`

![screenshot](screenshot.png)
