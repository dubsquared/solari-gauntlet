# Gauntlet review — https://github.com/teslamotors/light-show.git

**14/30** · reviewed 2026-09-08 at `9f94951` · ran as `cli` · 342s · ~30k tokens

| Dimension | Score | |
| --- | --- | --- |
| Runs | 5/10 | `█████░░░░░` |
| Delivers its claims | 5/10 | `█████░░░░░` |
| Code quality | 4/10 | `████░░░░░░` |

The only executable code is a small FSEQ header validator, which functions correctly once stdin is supplied but has a UX/design flaw that causes it to hang without input redirection. The bulk of the repository is documentation and pre-existing example/asset files that appear to mirror the official Tesla open-source project verbatim, with no visible original contribution to evaluate. Given the lack of tests, thin code footprint, and strong resemblance to an unmodified upstream repo, this submission provides very limited evidence of engineering capability specific to the candidate.

## Strengths
- validator.py correctly parses the FSEQ v2 binary header (magic, channel count, frame count, step time, compression flag) and produced the exact expected duration/frame count for the sample show file when stdin was supplied
- Reasonable validation coverage: checks magic bytes, channel count (48/200), compression type, duration cap (4h), and warns on unvalidated FSEQ minor versions rather than silently failing
- Documentation and example assets (multiple full car light-show packages, xLights project templates, screenshots) are extensive and internally consistent with the README's setup instructions

## Concerns
- The repository content (tree, README, validator.py, examples, xlights zips) is effectively identical to the public teslamotors/light-show upstream project — no diff or original contribution is visible anywhere in the provided excerpts, which is a major red flag for a hiring submission claiming this as authored work
- validator.py unconditionally calls input('Press Enter to exit...') even when a file path is passed as a CLI argument, causing the process to hang indefinitely (killed after 300s) unless stdin is explicitly piped — poor design for a script meant to also be invoked non-interactively/scripted
- No automated test suite exists or was found; correctness was only checked via one manual run against one example file
- codeQuality can only be judged from a single ~60-line script; the rest of the 'submission' is static assets and docs, giving very little engineering signal to evaluate

## How it was run
> validator.py always ends with input('Press Enter to exit...'); feeding it a newline via echo (rather than /dev/null, which triggers EOFError) lets it read an empty line and exit cleanly with code 0.

```console
$ python3 -m pip install --quiet --upgrade pip   # exit 0
$ python3 validator.py examples/lightshow_example_3_The_Arrival_5_Car/Car\ #1/LightShow/lightshow.fseq   # exit 124
$ python3 -m pip install --quiet --upgrade pip   # exit 0
$ python3 validator.py 'examples/lightshow_example_3_The_Arrival_5_Car/Car #1/LightShow/lightshow.fseq' < /dev/null   # exit 1
$ python3 -m pip install --quiet --upgrade pip   # exit 0
$ echo | python3 validator.py 'examples/lightshow_example_3_The_Arrival_5_Car/Car #1/LightShow/lightshow.fseq'   # exit 0
```

## The submission's own tests
No test command found — a fact the score reflects.

## Security sweep
- dependency audit: n/a (no lockfile)
- secret patterns: no matches

## Output
```
Found 4410 frames, step time of 25 ms for a total duration of 0:01:50.250000.
Press Enter to exit...
```

## Ask the candidate
1. This repository appears nearly identical to the public teslamotors/light-show project — what specifically did you write or modify versus what came from upstream?
2. validator.py calls input() unconditionally at the end even when a file path is passed via argv, causing it to hang in non-interactive contexts — how would you redesign the CLI to support both interactive and scripted/headless use?
3. How would you build an automated test suite for the FSEQ validation logic, covering malformed headers, unsupported channel counts, and boundary duration cases?

---
Evidence sealed: [`manifest.json`](manifest.json) carries a SHA-256 for every
artifact in this directory, ed25519-signed. `npm run verify -- <this dir>`
proves nothing changed since the review.
