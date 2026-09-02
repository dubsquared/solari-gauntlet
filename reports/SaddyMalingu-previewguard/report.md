# Gauntlet review — https://github.com/SaddyMalingu/previewguard.git

**14/30** · reviewed 2026-09-02 at `d88feab` · ran as `web` · 102s · ~30k tokens

| Dimension | Score | |
| --- | --- | --- |
| Runs | 6/10 | `██████░░░░` |
| Delivers its claims | 3/10 | `███░░░░░░░` |
| Code quality | 5/10 | `█████░░░░░` |

The webhook server process starts and stays up, and the code is organized into clean, single-purpose modules, but none of the headline claims (sandboxed preview creation, test execution, public preview URLs, PR comments) were actually verified live — the probe only reached an unhandled root route on the webhook listener. The bundled test suite could not even run in the provided environment, so there is no observed passing coverage to back up the 'comprehensive test coverage' claim. Overall this looks like a plausible-shaped project whose central value proposition remains unverified.

## Strengths
- Clear modular decomposition (cli.ts, server.ts, store.ts, cleanup.ts, analytics.ts, dashboard.ts) with single-responsibility files
- Sensible operational details: stale-preview cleanup on a timer, per-PR cleanup, JSON config persistence with defaults merge
- CLI built on commander with reasonable option validation (fails fast if SOLARI_API_KEY missing) and a --dry-run mode

## Concerns
- The core README claim — creating an isolated Solari sandbox with a real dev-server preview URL — was never actually exercised; only the webhook server was started with a dummy API key, and it correctly 404'd on '/', which tells us nothing about preview creation, test execution inside sandboxes, or PR commenting actually working
- The project's own test suite (vitest) failed to run entirely (Node/rolldown ESM incompatibility) — no evidence any test in project.test.ts / store.test.ts / github.test.ts ever passed
- package.json declares Node >=20 but nothing enforces it at CLI entry; running on Node 18 produced engine warnings and eventually broke tooling, indicating no real portability testing was done
- CLI rejected a documented-sounding flag (--host) with exit 1, showing the interface wasn't smoke-tested end-to-end
- Sandbox/Solari integration code (sandbox.ts, github-app.ts, mcp-server.ts) was not included in excerpts, so the most safety-critical part (isolation guarantees) is unverifiable from what was shown

## How it was run
> server subcommand only accepts -p/--port (no host flag) and node's http server default-binds 0.0.0.0; removed unsupported --host flag which caused the previous failure; no real credentials needed to start the webhook listener.

```console
$ cd /home/user/repo && npm install   # exit 0
$ cd /home/user/repo && npm install -D vitest --no-save || true   # exit 0
$ SOLARI_API_KEY=slr_dummy_offline npx tsx src/index.ts server -p 3000 --host 0.0.0.0   # exit 1
$ cd /home/user/repo && npm install   # exit 0
$ cd /home/user/repo && npm install -D vitest --no-save || true   # exit 0
$ SOLARI_API_KEY=slr_dummy_offline npx tsx src/index.ts server -p 3000   # exit 0
```

## The submission's own tests
`npx --yes vitest run` → **FAIL (exit 1)**

```

⎯⎯⎯⎯⎯⎯⎯ Startup Error ⎯⎯⎯⎯⎯⎯⎯⎯
file:///home/user/repo/node_modules/rolldown/dist/shared/create-bundler-option-CjAOgWvM.mjs:8
import { formatWithOptions, styleText } from "node:util";
                            ^^^^^^^^^
SyntaxError: The requested module 'node:util' does not provide an export named 'styleText'
    at ModuleJob._instantiate (node:internal/modules/esm/module_job:123:21)
    at async ModuleJob.run (node:internal/modules/esm/module_job:191:5)
    at async ModuleLoader.import (node:internal/modules/esm/loader:337:24)
    at async start (file:///home/user/repo/node_modules/vitest/dist/chunks/cac.uFydS1Z4.js:2339:27)
    at async CAC.run (file:///home/user/repo/node_modules/vitest/dist/chunks/cac.uFydS1Z4.js:2318:2)




```

## Security sweep
- dependency audit: n/a (no lockfile)
- secret patterns: ⚠️ matches in `./README.md`

## Live probe
Opened `https://9178b22f917008a02842-3000.preview.getsolari.com` in a Solari cloud browser.

- title: ""
- landing page DOM loaded in 171ms
- console errors: 
  - `Failed to load resource: the server responded with a status of 404 ()`
  - `Failed to load resource: the server responded with a status of 404 ()`

![screenshot](screenshot.png)

![mobile](screenshot-mobile.png)

## Ask the candidate
1. Walk me through what happens end-to-end in sandbox.ts when a Solari API call fails mid-preview — how is that surfaced to the CLI and cleaned up?
2. Your test suite couldn't run in our environment due to a Node/vitest/rolldown incompatibility despite package.json requiring Node >=20 — how would you have caught this before submitting, and what would your CI pipeline look like?
3. The CleanupManager runs on a 5-minute interval and iterates store.list() to delete stale previews — what happens if two cleanup ticks or a manual destroy race against each other on the same preview ID?
