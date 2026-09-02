# Gauntlet review — https://github.com/dubsquared/solari-gauntlet.git

**17/30** · reviewed 2026-09-02 at `bbecb39` · ran as `cli` · 97s · ~25k tokens

| Dimension | Score | |
| --- | --- | --- |
| Runs | 4/10 | `████░░░░░░` |
| Delivers its claims | 6/10 | `██████░░░░` |
| Code quality | 7/10 | `███████░░░` |

The code excerpts show a thoughtfully engineered, security-conscious agent with real defensive design (SSRF guards, argv-only shelling, LLM output validation, a deterministic verdict-consistency check) and it typechecks and installs cleanly. However, the live run in this environment never got past a missing-API-key guard, so the actual headline capability — cloning, running, and probing arbitrary repos — could not be directly observed; all evidence for that comes from the candidate's own committed reports rather than anything verified here. Code quality per the shown excerpts is clearly above average, but the absence of an observable test suite or a fully live run caps confidence.

## Strengths
- Careful security posture: SSRF-safe fetch (redirect: manual, timeout), argv-based git clone (no shell interpolation), URL allowlisting to https://github.com/<owner>/<repo>, sanitization of untrusted model/app output before embedding in reports.
- Self-aware design: a deterministic consistencyFlag() cross-checks the LLM verdict against actual step exit codes and flags 'too clean' scores for human review — a genuine backstop against prompt injection/verdict steering.
- Committed artifacts (report.md, screenshot.png, replay.ndjson, verdict.json for three repos including a self-review) give some independent evidence the pipeline has produced real output before, and the self-review's refusal to award itself 'Runs' points is a credible, non-self-serving detail.
- Clean TypeScript with narrow validation of untrusted LLM JSON output (validatePlan/validateVerdict) rather than blind casting.

## Concerns
- In this review session the tool never got past 'missing SOLARI_API_KEY' — the actual core pipeline (clone→plan→run→probe→verdict) was not observed running live; everything about its real behavior rests on the candidate's own committed reports, which are unverifiable claims in this context.
- No real automated test suite was exercised — 'npm run typecheck' passing is not equivalent to unit/integration tests around the planning/replan logic, JSON extraction, or sandbox execution paths.
- The environment needed a Node 18→20 upgrade via nodesource despite an `engines` field already being present in package.json, suggesting either the sandbox base image or the setup script isn't fully aligned with the stated requirement — friction that had to be worked around rather than prevented.
- Because the tool depends entirely on two external paid APIs (Solari, Anthropic) to do anything beyond argument parsing, a reviewer without those keys can only validate scaffolding, not the actual claimed value.

## How it was run
> Repo requires Node >=20 (engines field) so nodesource upgrade is needed; it's a CLI tool that calls out to Solari + Anthropic APIs and hard-exits with 'missing ANTHROPIC_API_KEY'/'missing SOLARI_API_KEY' since no credentials are available in this environment, so the run command will only demonstrate that expected failure path; typecheck is the closest thing to a self-test since there's no test script.

```console
$ cd /home/user/repo && curl -fsSL https://deb.nodesource.com/setup_20.x | bash -   # exit 0
$ cd /home/user/repo && apt-get install -y nodejs   # exit 0
$ cd /home/user/repo && node -v && npm -v   # exit 0
$ cd /home/user/repo && npm install   # exit 0
$ cd /home/user/repo && npm start -- https://github.com/octocat/Hello-World.git 2>&1 | head -50   # exit 0
```

## The submission's own tests
`npm run typecheck` → **PASS**

```

> solari-gauntlet@0.1.0 typecheck
> tsc --noEmit


```

## Security sweep
- dependency audit: no known vulnerabilities
- secret patterns: no matches

## Output
```

> solari-gauntlet@0.1.0 start
> tsx src/index.ts https://github.com/octocat/Hello-World.git

missing SOLARI_API_KEY

```

## Ask the candidate
1. Walk through consistencyFlag() in report.ts — what specific attack or failure mode were you defending against, and how did you decide on the thresholds (e.g. runs>=8 despite failed steps)?
2. The previewUrl fetch uses redirect:'manual' and a 5s AbortSignal.timeout inside waitForServer — what exact SSRF or hang scenario does that prevent, and what would happen without it given this tool executes untrusted repos?
3. Since the pipeline depends on live Solari/Anthropic calls, how would you unit-test planRun/revisePlan and the JSON-extraction logic in ai.ts without hitting real APIs, and why isn't that test suite in the repo yet?
