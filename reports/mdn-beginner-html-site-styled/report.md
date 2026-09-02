# Gauntlet review — https://github.com/mdn/beginner-html-site-styled

**21/30** · reviewed 2026-09-02 · ran as `web`

| Dimension | Score | |
| --- | --- | --- |
| Runs | 8/10 | `████████░░` |
| Delivers its claims | 7/10 | `███████░░░` |
| Code quality | 6/10 | `██████░░░░` |

This is the standard MDN 'beginner-html-site-styled' tutorial repository, serving a static HTML/CSS page as described in the README. The live probe confirms the page loads and displays the expected Mozilla-themed content, though a mixed-content console error appeared (likely from an external tracking script, not the site's own code). Code quality is inherently minimal since this is a beginner tutorial template rather than a custom application. It runs and delivers on its stated purpose as a simple styled HTML page.

## Strengths
- Simple static site served successfully with Python http server
- Page renders expected MDN beginner content (title, headings, manifesto text)
- Matches README description of a basic HTML/CSS learning example
- Minimal, easy-to-review file structure typical of MDN tutorial repos

## Concerns
- Mixed content console error suggests an insecure resource request (possibly unrelated tracking token, but still a red flag)
- No actual custom code contribution beyond boilerplate MDN template repo
- No tests, build process, or manifest since this is just a static tutorial site
- Cannot verify CSS styling details from probe beyond text content

## How it was run
> Static HTML/CSS site, served directly with Python's built-in HTTP server

```console
$ python3 -m http.server 3000 --bind 0.0.0.0   # exit 0
```

## Live probe
Opened `https://d29e3e5d8bac06f56e8e-3000.preview.getsolari.com` in a Solari cloud browser.

- title: "My test page"
- console errors: 
  - `Mixed Content: The page at 'https://d29e3e5d8bac06f56e8e-3000.preview.getsolari.com/`

![screenshot](screenshot.png)
