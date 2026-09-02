# Gauntlet review — https://github.com/heroku/node-js-getting-started

**22/30** · reviewed 2026-09-02 · ran as `web`

| Dimension | Score | |
| --- | --- | --- |
| Runs | 8/10 | `████████░░` |
| Delivers its claims | 7/10 | `███████░░░` |
| Code quality | 7/10 | `███████░░░` |

This is the standard Heroku Node.js Getting Started template, which installs and runs correctly, serving the expected static content as described in the README. Code quality is fine but minimal since it's largely boilerplate rather than original work. Some engine/version mismatches and unaddressed audit vulnerabilities are minor blemishes, and the db-related view wasn't verified as functional in the live probe.

## Strengths
- App installs and runs successfully, serving the expected homepage content matching README claims
- Clean, minimal Express + EJS boilerplate structure with partials for header/nav
- Includes test.js with Jest configured, Procfile for Heroku deployment, and app.json for one-click deploy
- No console errors observed on the live probe

## Concerns
- Node engine mismatch: package.json requires Node 22.x/24.x/26.x but ran on 18.20.4 with EBADENGINE warnings
- 3 npm audit vulnerabilities (1 moderate, 2 high) present and unaddressed
- This is essentially Heroku's official boilerplate/template repo, not a custom submission demonstrating original problem-solving
- db.ejs page and any database-backed functionality weren't exercised/verified in the probe
- Deprecated transitive dependencies (glob, inflight) still present

## How it was run
> Express app; PORT env var sets listening port, default binds all interfaces

```console
$ cd /home/user/repo && npm install   # exit 0
$ PORT=3000 node index.js   # exit 0
```

## Live probe
Opened `https://70fcd7d649684c2eb443-3000.preview.getsolari.com` in a Solari cloud browser.

- title: "Node.js Getting Started on Heroku"
- console errors: none

![screenshot](screenshot.png)
