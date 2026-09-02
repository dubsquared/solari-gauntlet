# Gauntlet review — https://github.com/elMonsi/solari-agent-kit.git

**14/30** · reviewed 2026-09-02 at `1e08bca` · ran as `cli` · 70s · ~24k tokens

| Dimension | Score | |
| --- | --- | --- |
| Runs | 5/10 | `█████░░░░░` |
| Delivers its claims | 3/10 | `███░░░░░░░` |
| Code quality | 6/10 | `██████░░░░` |

The repo is thoughtfully documented, with genuine engineering reasoning behind each of the five patterns and real citations for the problems being solved, and the one pattern actually executed here started cleanly and failed only due to lack of a live credential. However, the submission's own validation claims are internally inconsistent — the top-level README claims live end-to-end success on pattern 3 while that pattern's source explicitly says it was never run live — and no test suite or independently verifiable live run was observable in this review. Code quality reads as competent and well-commented from the excerpts, but without passing tests or a confirmed live run, claims of full validation should be treated skeptically.

## Strengths
- Extensive, well-cited documentation tying each pattern to a specific real-world failure mode (EchoLeak, Replit DB wipe, mcp-remote CVE, etc.) rather than generic marketing
- Code shows deliberate design decisions (allowlist-not-denylist gating, dual-session quarantine boundary, snapshot/fork wrappers) with inline rationale
- Pattern 1 started cleanly, printed config, computed the expected p^N baseline, and failed with a clean, expected AuthError rather than crashing on bad code — shows reasonable error surfacing

## Concerns
- Top-level README validation table claims all five patterns were run end-to-end against a live Solari key and pattern 3 'Pass, no changes' — but pattern 3's own source header explicitly states 'this file has NOT been run against the live Solari API.' That is a direct, verifiable contradiction between the README's headline claim and the code's own documentation.
- No live API key was available in this review, so essentially none of the '✅ all five run against real API' claims could be independently confirmed; the only pattern actually executed failed at the network boundary (expected without credentials, but means zero patterns were observed succeeding end-to-end)
- No automated test suite anywhere in the repo — validation is via manual one-off scripts and README narrative rather than repeatable, checked tests
- README tone leans heavily on grandiose framing ('the field's most-cited agent failures... are infrastructure problems') that isn't something a live probe can substantiate
- Pattern 1's own comments admit snapshot/fork/revert method names were 'confirmed against docs... NOT against a live API key,' undermining confidence that the SDK surface used actually matches what ships

## How it was run
> Every pattern is a thin demo client for the proprietary paid 'Solari' microVM/browser/desktop API (@solarisdk/sdk, solari_browser) and hard-requires a real slr_live_ API key we do not have; there is no local server, docker image, or mock backend, so nothing here can actually execute end-to-end without credentials. Ran pattern 1 (best-of-n) as a representative smoke test — expect it to fail on the first live API call (auth/network error), which is the expected/documented behavior given missing credentials rather than a bug. Also worth flagging: README claims all 5 patterns were validated live, but pattern 3's own source header states it was NOT run against the live API, an internal inconsistency worth noting to a reviewer.

```console
$ cd /home/user/repo && cd patterns/1-best-of-n && npm install --no-audit --no-fund || true   # exit 0
$ cd /home/user/repo && cd patterns/1-best-of-n && npm install --no-save tsx || true   # exit 0
$ cd /home/user/repo && cd patterns/1-best-of-n && SOLARI_API_KEY=dummy_no_credentials_available DEMO_STEPS=3 DEMO_FORKS=1 npx tsx index.ts; echo "exit=$?"   # exit 0
```

## The submission's own tests
No test command found — a fact the score reflects.

## Security sweep
- dependency audit: n/a (no lockfile)
- secret patterns: no matches

## Output
```
Config: seed=98 steps=3 forks=1 p/step=0.65 maxRetries=4
Naive end-to-end odds if we just retried nothing: p^N = 0.2746
exit=1
AuthError: Unauthorized
    at mapGatewayError (/home/user/repo/patterns/1-best-of-n/node_modules/@solarisdk/core/src/errors.ts:107:14)
    at HttpTransport.request (/home/user/repo/patterns/1-best-of-n/node_modules/@solarisdk/core/src/http.ts:123:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at main (/home/user/repo/patterns/1-best-of-n/index.ts:363:15) {
  status: 401,
  code: undefined,
  body: { error: 'Unauthorized' }
}

```

## Ask the candidate
1. Your top-level README table marks pattern 3 (Quarantine Browser) as '✅ Pass, no changes' under live validation, but the file's own header says it has NOT been run against the live API — can you walk me through how that entry ended up in the validation table?
2. In pattern 2 you mention discovering that revert() 409s and switching to 'restore-by-fork' — what exactly does that guarantee about state consistency, and how did you verify the fork actually rolled back the destructive operation?
3. There's no automated test suite in this repo — how did you actually validate correctness during development, and what would a CI pipeline for these patterns look like if you had to add one?
