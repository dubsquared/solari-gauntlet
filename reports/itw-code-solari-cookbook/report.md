# Gauntlet review — https://github.com/itw-code/solari-cookbook.git

**12/30** · reviewed 2026-09-02 at `ae00916` · ran as `cli` · 95s · ~45k tokens

| Dimension | Score | |
| --- | --- | --- |
| Runs | 4/10 | `████░░░░░░` |
| Delivers its claims | 3/10 | `███░░░░░░░` |
| Code quality | 5/10 | `█████░░░░░` |

The project installs and can generate deterministic variant data, and its example SDK snippets are thoughtfully documented, but the one command the README stakes its credibility on — `npm run verify` with '37 tests passing' — crashed in the observed environment due to a Node version mismatch, directly undermining the delivered claims. Because none of the core harness source (agent loop, verifier, variant generator internals) was shown, code quality must be judged almost entirely from peripheral example scripts, which are solid but not representative of the actual pitch. The huge volume of committed binary artifacts and saved-webpage captures raises questions about what is genuinely reproducible versus staged. Overall this reads as ambitious in scope but not verified as working end-to-end.

## Strengths
- npm install and the gen:variants script both succeeded and produced concrete deterministic output (14 variants -> variants.json), showing at least part of the pipeline is real and wired up
- Example SDK snippets shown (browser-quickstart, profiles, stealth-proxy, session-recording) are well-commented with genuine operational footguns called out (event-loop hangs, replay upload race, gzip decoding gotchas) — suggests real hands-on usage rather than boilerplate
- Extensive supporting artifacts (run traces, screenshots, scorecard.json, per-step logs) indicate a serious attempt at building an evaluation harness with reproducible evidence, not just a claim-only README

## Concerns
- The headline command from the README's own 60-second quickstart (`npm run verify`) FAILED in the observed run — tests crashed with process.exit(1) inside patchright-core/bootstrap.js, directly contradicting the '37 passing' badge and the MOCK-mode-no-network claim
- Node engine mismatch (repo requires Node >=20, environment had 18.20.4) surfaced as EBADENGINE warnings and appears to be the root cause of the test crash — no engines guard or graceful fallback in package.json/CI to catch this
- Core logic (agent-loop, verifier, generate-variants internals) was never shown in source excerpts — only peripheral example scripts were available, so code quality of the actual harness (the thing being pitched) is unverifiable
- Repo tree is bloated with committed browser-saved HTML pages, downloaded JS bundles, and binary assets (mp4, gif, many PNG run traces) checked directly into version control — unusual practice for a code submission and makes it hard to distinguish genuine live-agent evidence from staged demo captures
- 5 npm audit vulnerabilities (including 1 critical) surfaced on install with no evidence of remediation or awareness in the docs
- Live probe returned essentially empty pageText/consoleErrors — the interactive showcase / actual live agent behavior claimed in the README could not be independently verified

## How it was run
> Cookbook's 'examples/' need SOLARI_API_KEY (unavailable); the actual harness runs fully offline via npm run verify (tsc+vitest, MOCK mode) and gen:variants produces variants.json deterministically with no network/keys.

```console
$ cd /home/user/repo && npm install   # exit 0
$ cd /home/user/repo && npm run gen:variants   # exit 0
```

## The submission's own tests
`npm run verify` → **FAIL (exit 1)**

```

 ❯ Module._compile node:internal/modules/cjs/loader:1364:14
 ❯ Object.Module._extensions..js node:internal/modules/cjs/loader:1422:10
 ❯ Module.load node:internal/modules/cjs/loader:1203:32
 ❯ Function.Module._load node:internal/modules/cjs/loader:1019:12
 ❯ Module.require node:internal/modules/cjs/loader:1231:19
 ❯ require node:internal/modules/helpers:177:18
 ❯ Object.<anonymous> node_modules/patchright-core/index.js:16:1
 ❯ Module._compile node:internal/modules/cjs/loader:1364:14

This error originated in "test/agent-loop.spec.ts" test file. It doesn't mean the error was thrown inside the file itself, but while it was running.
The latest test that might've caused the error is "test/agent-loop.spec.ts". It might mean one of the following:
- The error was thrown, while Vitest was running this test.
- If the error occurred after the test had been completed, this was the last documented test before it was thrown.


```

## Security sweep
- dependency audit: n/a (no lockfile)
- secret patterns: no matches

## Output
```

> coldstart-solari-cookbook@0.1.0 gen:variants
> tsx src/generate-variants/index.ts

[generate-variants] wrote 14 variant(s) -> variants.json

```

## Ask the candidate
1. The test suite crashed inside patchright-core/bootstrap.js on Node 18, and the package requires Node >=20 per the install warnings — why isn't there an `engines` field or CI guard to prevent this, and how did you validate the '37 passing' badge before publishing it?
2. Walk us through the fail-closed verifier you describe (recomputing ground truth from the seed, reading the SQLite row) — what exactly makes it impossible for the agent's `done` signal to produce a false positive, and did you test that path directly?
3. The docs/artifacts directory contains full saved HTML pages and downloaded JS bundles from what looks like a Next.js demo site — were these captured from a real live run against Solari, and how would a reviewer distinguish that from a manually staged screenshot session?
