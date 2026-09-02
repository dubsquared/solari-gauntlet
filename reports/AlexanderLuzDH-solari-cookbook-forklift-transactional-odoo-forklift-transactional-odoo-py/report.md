# Gauntlet review — https://github.com/AlexanderLuzDH/solari-cookbook.git

**16/30** · reviewed 2026-09-02 at `0d81af7` · ran as `cli` · 74s · ~38k tokens

| Dimension | Score | |
| --- | --- | --- |
| Runs | 5/10 | `█████░░░░░` |
| Delivers its claims | 4/10 | `████░░░░░░` |
| Code quality | 7/10 | `███████░░░` |

The repository presents an ambitious and conceptually well-thought-out transactional-acceptance framework for GUI automation against Odoo, with clean domain modeling (Decimal discipline, frozen dataclasses, digest-bound determinism) and a passing 69-test suite. However, the headline end-to-end claim — a real browser-driven Odoo workflow validated via snapshot/promote — was never actually exercised in this environment, and the evidence-verification script itself failed on a basic import path bug when run as documented. Scoring must therefore rest mainly on the offline test suite and code excerpts, which are solid but not sufficient to confirm the more dramatic claims in the README.

## Strengths
- Unit test suite (69 tests) passed cleanly with no errors, covering oracle, case generation, promotion, and evidence verification logic
- Domain layer shows careful engineering discipline: Decimal-only money/quantity handling, explicit float rejection, frozen dataclasses with __post_init__ validation
- Deterministic, digest-bound case generation (case_digest/manifest_digest) and fault-schedule modeling show a coherent design for reproducible, tamper-evident trials
- Sealed evidence artifacts (final-report.json, per-trial JSON, protocol.json) are present and structured consistently with the documented acceptance pipeline

## Concerns
- The actual end-to-end claim (visible GUI worker driving Odoo in Docker, snapshot/promote pipeline) was never observed running in this environment — only the offline unit test suite executed, so the core README claim is unverified live
- scripts/verify_final_evidence.py failed with ModuleNotFoundError when run directly as documented, indicating a packaging/path bug in the very tool meant to let a reviewer independently verify the sealed evidence
- No Docker/Compose execution was attempted or shown, so the 'RESULT: PASS' local-crash-challenge claim and the six held-out sealed trials cannot be independently corroborated beyond trusting the checked-in JSON artifacts
- Source excerpts are fragments (files truncated at 3KB); several files (gui_worker.py, faults.py, domain.py) are cut off mid-definition, limiting judgment of error handling and edge cases in the actual GUI automation and oracle code paths

## How it was run
> apt package is python3-venv (not python3.10-venv); run apt-get update first since package lists were stale. Full live GUI pipeline needs Docker, a real Odoo instance, and proprietary solari-desktop/solari-sandbox packages plus credentials, none of which are available, so we validate against the sealed offline evidence artifacts already committed in the repo instead.

```console
$ cd /home/user/repo/examples/forklift-transactional-odoo-py && apt-get update -y   # exit 0
$ cd /home/user/repo/examples/forklift-transactional-odoo-py && apt-get install -y python3.10-venv python3-pip   # exit 100
$ cd /home/user/repo/examples/forklift-transactional-odoo-py && apt-get update -y   # exit 0
$ cd /home/user/repo/examples/forklift-transactional-odoo-py && apt-get install -y python3-venv python3-pip || true   # exit 0
$ cd /home/user/repo/examples/forklift-transactional-odoo-py && python3 -m venv .venv || python3 -m pip install --user virtualenv   # exit 0
$ cd /home/user/repo/examples/forklift-transactional-odoo-py && . .venv/bin/activate && pip install --upgrade pip   # exit 0
$ cd /home/user/repo/examples/forklift-transactional-odoo-py && . .venv/bin/activate && pip install -r requirements.txt || true   # exit 0
$ cd /home/user/repo/examples/forklift-transactional-odoo-py && . .venv/bin/activate && pip install pytest   # exit 0
$ cd /home/user/repo/examples/forklift-transactional-odoo-py && . .venv/bin/activate && (python scripts/verify_final_evidence.py artifacts/sealed/final-v2 || python -m pytest tests/test_evidence_verifier.py -q)   # exit 0
```

## The submission's own tests
`. .venv/bin/activate && python -m pytest -q` → **PASS**

```
.....................................................................    [100%]
=============================== warnings summary ===============================
.venv/lib/python3.11/site-packages/solari_core/ws.py:17
  /home/user/repo/examples/forklift-transactional-odoo-py/.venv/lib/python3.11/site-packages/solari_core/ws.py:17: DeprecationWarning: websockets.client.WebSocketClientProtocol is deprecated
    from websockets.client import WebSocketClientProtocol

.venv/lib/python3.11/site-packages/websockets/legacy/__init__.py:6
  /home/user/repo/examples/forklift-transactional-odoo-py/.venv/lib/python3.11/site-packages/websockets/legacy/__init__.py:6: DeprecationWarning: websockets.legacy is deprecated; see https://websockets.readthedocs.io/en/stable/howto/upgrade.html for upgrade instructions
    warnings.warn(  # deprecated in 14.0 - 2024-11-09

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
69 passed, 2 warnings in 0.24s

```

## Security sweep
- dependency audit: n/a (no lockfile)
- secret patterns: no matches

## Output
```
..                                                                       [100%]
2 passed in 0.01s
Traceback (most recent call last):
  File "/home/user/repo/examples/forklift-transactional-odoo-py/scripts/verify_final_evidence.py", line 11, in <module>
    from forklift.case_generation import case_digest, case_payload, generate_cases, manifest_digest
ModuleNotFoundError: No module named 'forklift'

```

## Ask the candidate
1. Walk me through why the auditor's selector requires case digest, fault-schedule digest, action-log digest, and receipt binding all together — what specific race or replay attack does each piece close, and what happens if one is stale but the others aren't?
2. verify_final_evidence.py failed with ModuleNotFoundError when run exactly as the README instructs from the example directory — what's the actual packaging/PYTHONPATH assumption there, and why wasn't this caught before submission?
3. The gui_worker.py file uses a file-based gate/permit mechanism (step_gate_prefix, /tmp/forklift-worker-release) to synchronize faults with milestones — how would this hold up under concurrent trials or in a containerized CI environment where /tmp isn't shared, and did you test that?
