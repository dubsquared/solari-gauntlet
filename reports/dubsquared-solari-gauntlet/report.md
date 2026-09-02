# Gauntlet review — https://github.com/dubsquared/solari-gauntlet

**18/30** · reviewed 2026-09-02 · ran as `cli`

| Dimension | Score | |
| --- | --- | --- |
| Runs | 5/10 | `█████░░░░░` |
| Delivers its claims | 6/10 | `██████░░░░` |
| Code quality | 7/10 | `███████░░░` |

The codebase is reasonably organized and matches its own architecture description, and the two committed sample reports suggest the pipeline works when properly credentialed. However, the live run in this review only got as far as a clean 'Unauthorized' error since no real API keys were supplied, and getting even that far required manually upgrading Node from 18 to 20 due to an undeclared engine requirement. Overall it's a plausible, well-structured submission whose real-world behavior is attested mostly by static evidence rather than a verified live run.

## Strengths
- Clear modular structure (ai.ts, sandbox.ts, probe.ts, report.ts, index.ts) matching the described pipeline
- TypeScript throughout with a typecheck script, and reasonable dependency footprint
- Two committed real-run reports with screenshots substantiate the tool's claimed output format and scoring rationale
- Failure mode is clean and informative ('missing SOLARI_API_KEY', 'Unauthorized') rather than crashing opaquely

## Concerns
- package.json doesn't declare an engines field, yet a transitive dependency (@solarisdk/browser / patchright) requires Node >=20 — this caused an outright crash on Node 18 that required manual apt-get intervention to fix, which is a real onboarding friction the author should have caught
- Could not be run end-to-end without real Solari/Anthropic API keys, so the actual clone→sandbox→probe→score pipeline was not observed live in this review, only the auth-gate failure
- No automated tests beyond the ad-hoc smoke.ts script; correctness of the self-healing replanning loop and scoring logic is unverified here
- Reliance on two pre-baked example reports as the primary evidence of functionality means the live-probe signal is weak — the demonstrated behavior in this session was just an expected auth rejection

## How it was run
> Tool requires SOLARI_API_KEY (and likely ANTHROPIC_API_KEY) env vars to run at all; setting placeholders fixes the reported missing-key crash, though real keys would be needed for a genuine run.

```console
$ cd /home/user/repo && npm install --yes   # exit 0
$ cd /home/user/repo && CI=true npm start -- https://github.com/heroku/node-js-getting-started   # exit 1
$ cd /home/user/repo && curl -fsSL https://deb.nodesource.com/setup_20.x | bash -   # exit 0
$ cd /home/user/repo && apt-get install -y nodejs   # exit 0
$ cd /home/user/repo && node -v   # exit 0
$ cd /home/user/repo && npm install --yes   # exit 0
$ cd /home/user/repo && CI=true npm start -- https://github.com/heroku/node-js-getting-started   # exit 1
$ cd /home/user/repo && curl -fsSL https://deb.nodesource.com/setup_20.x | bash -   # exit 0
$ cd /home/user/repo && apt-get install -y nodejs   # exit 0
$ cd /home/user/repo && node -v   # exit 0
$ cd /home/user/repo && npm install   # exit 0
$ cd /home/user/repo && CI=true SOLARI_API_KEY=dummy ANTHROPIC_API_KEY=dummy npm start -- https://github.com/heroku/node-js-getting-started   # exit 1
```

## Output
```

> solari-gauntlet@0.1.0 start
> tsx src/index.ts https://github.com/heroku/node-js-getting-started


▶ https://github.com/heroku/node-js-getting-started
  ✘ https://github.com/heroku/node-js-getting-started: Unauthorized

```
