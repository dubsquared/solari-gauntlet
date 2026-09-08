# The contest, run through the contest reviewer

Harry said *"we review every build that tags us."* Gauntlet's whole purpose is reviewing a pile of hiring submissions — so here is the field of the Pinetree/Solari challenge: every public submission repo found tagging @harrychow_ and @getsolari on X as of 2026-09-02, each cloned into a Solari sandbox, run, probed, and scored by the same rubric. This repo is included and gets no special treatment.

This table is the **contest field only**. Gauntlet has also reviewed real production repos (Tesla's `vehicle-command`, ruvnet's `ruv-FANN`) and demo fixtures; those appear on the [live Arena](https://dubsquared.github.io/solari-gauntlet/), not here. Submitted after the snapshot date? Open an issue and you'll be added.

| Rank | Submission | Score | What the review observed |
| --- | --- | --- | --- |
| 1 | [dubsquared/solari-gauntlet](reports/dubsquared-solari-gauntlet/report.md) *(this repo)* | **17/30** | Typecheck passes, ran itself inside the sandbox; capped honestly — its pipeline needs live keys a reviewer's sandbox rightly lacks |
| 2 | [AlexanderLuzDH — forklift, Odoo agent](reports/AlexanderLuzDH-solari-cookbook-forklift-transactional-odoo-forklift-transactional-odoo-py/report.md) | **16/30** | pytest PASS, sealed-evidence verifier clean; full GUI pipeline needs Docker + Odoo + credentials. Strong domain modeling |
| 3 | [elMonsi/solari-agent-kit](reports/elMonsi-solari-agent-kit/report.md) | **14/30** | Well-documented patterns; README claims all 5 validated live, but pattern 3's own source header says it never was |
| 3 | [SaddyMalingu/previewguard](reports/SaddyMalingu-previewguard/report.md) | **14/30** | Server stays up (after Gauntlet's replan fixed a launch flag); its own tests FAIL; headline claims unverified |
| 5 | [itw-code/solari-cookbook](reports/itw-code-solari-cookbook/report.md) | **12/30** | Generator works; the README's own credibility command — `npm run verify`, "37 tests passing" — exits 1 |

## Methodology, honestly

- Scores measure **what a sandboxed reviewer could verify**, not effort or ambition. Needing live keys, Docker, or external services caps "Runs" by design — including for this repo.
- Integrity signals weigh heaviest: a README claim contradicted by the repo's own code or failing tests costs more than a missing feature.
- Integrity *accusations* clear the highest bar. A suggestive word in a repo (fabricate, stub, scorecard) is never treated as an admission — it's as likely to be fixing the problem as committing it — and ambiguous intent is reported as "worth clarifying with the maintainer," never as a red flag.
- Reviews are point-in-time (commit SHA in each report). Ship a fix and I'll re-run — a review typically takes one to four minutes and 10–40k tokens.
- To every builder here: these are strong projects, and an LLM rubric is not the last word. Corrections welcome — open an issue and Gauntlet re-reviews.
