# Gauntlet review — https://github.com/techwithtim/Snake-Game.git

**15/30** (▼ was 18/30) · reviewed 2026-09-08 at `4965f76` · ran as `gui` · 51s · ~19k tokens

| Dimension | Score | |
| --- | --- | --- |
| Runs | 8/10 | `████████░░` |
| Delivers its claims | 4/10 | `████░░░░░░` |
| Code quality | 3/10 | `███░░░░░░░` |

The snake game runs successfully in a live X11 environment, displaying a grid, snake head, and food, confirming basic setup and rendering work correctly. However, driving the app reveals a functional bug: pressing Down moves the snake left instead of down, meaning core directional gameplay is broken — a significant failure for a game whose entire value is correct movement. Code quality is mediocre, with redundant key-handling logic and a classic mutable class-attribute bug, and there is no test suite to catch such issues. This looks like an unmodified or lightly modified tutorial clone rather than an independently verified, production-quality submission.

## Strengths
- App launched cleanly under Xvfb with no crashes, rendering a grid, snake head, and food square as expected for a basic snake game
- Simple, readable class structure (cube/snake) separating rendering from movement logic
- Dependencies are minimal and correctly declared (pygame only), and the install/run process succeeded without friction

## Concerns
- Live probe shows Down arrow key press moved the snake left instead of down — a core gameplay mechanic is broken, directly contradicting the basic promise of a working snake game
- The move() method's key-handling loop (`for key in keys: if keys[pygame.K_LEFT]... elif ...`) is redundant/buggy — iterating over all keys but checking the same global keys state each iteration serves no purpose and hints at copy-pasted or unreviewed tutorial code
- No test suite exists at all — no unit tests for collision, growth, or movement logic, so correctness is unverified beyond manual play
- Class-level mutable attributes (body = [], turns = {} at class scope in snake) are a classic Python bug pattern (shared mutable state across instances) that a careful engineer should have caught
- README contains unrelated self-promotional bootcamp marketing content embedded in project docs, unrelated to the actual submission and a mild red flag for content hygiene
- Code excerpt is truncated/incomplete (addCube method cut off), making full quality assessment difficult beyond what's shown

## How it was run
> Pygame desktop snake game requiring a display; needs X11/pygame libs installed since no docker/GPU is available. README contains unrelated promotional content, ignored as non-instructional.

```console
$ git clone   # exit 0
$ cd /tmp/gauntlet-repo && apt-get update -y   # exit 0
$ cd /tmp/gauntlet-repo && apt-get install -y python3-tk xvfb libsdl2-2.0-0 libsdl2-mixer-2.0-0 libsdl2-image-2.0-0 libsdl2-ttf-2.0-0   # exit 0
$ cd /tmp/gauntlet-repo && pip install -r requirements.txt   # exit 0
$ python3 snake.py   # exit 0
$ gui log   # exit 0
```

## The submission's own tests
No test command found — a fact the score reflects.

## Security sweep
- dependency audit: n/a (no lockfile)
- secret patterns: no matches

## Live GUI
Launched on a Solari desktop (X11 + VNC) and screenshotted — the verdict's scores are judged from what the window actually rendered.

![desktop](screenshot.png)

### Claims, checked by driving the GUI
Gauntlet clicked and typed in the window, then judged the before/after by vision:

- ✅ **verified** — Pressing the Right arrow key moves the snake (red head) further to the right _(The red snake head moved rightward from around x=655 to x=780, consistent with a rightward grid shift.)_
- ❌ **failed** — Pressing the Down arrow key moves the snake (red head) downward _(The red square moved horizontally to the left, staying in the same row, rather than shifting downward.)_

```console
$ git clone (exit 0)
$ cd /tmp/gauntlet-repo && apt-get update -y (exit 0)
$ cd /tmp/gauntlet-repo && apt-get install -y python3-tk xvfb libsdl2-2.0-0 libsdl2-mixer-2.0-0 libsdl2-image-2.0-0 libsdl2-ttf-2.0-0 (exit 0)
$ cd /tmp/gauntlet-repo && pip install -r requirements.txt (exit 0)
$ python3 snake.py (exit 0)
$ gui log (exit 0)
```

## Ask the candidate
1. Walk me through the `move()` method's `for key in keys:` loop — what is it actually accomplishing, and why is it structured that way?
2. The live probe showed Down arrow moving the snake left instead of down — can you reproduce and explain the root cause of this bug?
3. Why are `body` and `turns` declared as class-level attributes on the `snake` class rather than initialized in `__init__`? What bugs could this cause if you ever create two snake instances?

---
Evidence sealed: [`manifest.json`](manifest.json) carries a SHA-256 for every
artifact in this directory, ed25519-signed. `npm run verify -- <this dir>`
proves nothing changed since the review.
