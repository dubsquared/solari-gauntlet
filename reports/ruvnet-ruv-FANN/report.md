# Gauntlet review — https://github.com/ruvnet/ruv-FANN.git

**17/30** · reviewed 2026-09-08 at `1d93b35` · ran as `cli` · 159s · ~38k tokens

| Dimension | Score | |
| --- | --- | --- |
| Runs | 8/10 | `████████░░` |
| Delivers its claims | 4/10 | `████░░░░░░` |
| Code quality | 5/10 | `█████░░░░░` |

The evidence supports that the core ruv-fann Rust crate builds cleanly and passes its own 173-test suite, which is a real, positive signal for that narrow slice of the project. However, the README's most prominent claims (ephemeral swarm intelligence, 84.8% SWE-Bench performance, 27+ forecasting models) are entirely unverified by the source excerpts or live probe provided, which show only tooling scripts and a bare CLI build/test log. Given the thinness and non-representativeness of the reviewed code plus outstanding dependency vulnerabilities, this should be scored as 'runs and has a tested core' rather than 'delivers on its ambitious claims'.

## Strengths
- The core ruv-fann Rust library actually compiled cleanly in release mode after only standard toolchain setup (rustup, apt build tools), with no patched Cargo.toml or workarounds needed.
- The submitted test run shows 173 passing tests (0 failed) across varied modules (webgpu compute context, kernel optimizer, pipeline cache, pressure monitor, training/adam convergence), which is a genuine, verifiable signal that at least the core crate has functioning unit tests.
- The helper scripts shown (github-safe.js, memory.js, session.js, router.js) are small, single-purpose utilities with reasonable error handling (try/catch, fallback behavior) and clear CLI usage docs.

## Concerns
- The file tree and source excerpts provided are almost entirely from a cuda-wasm sub-package and .claude tooling/orchestration scripts, not from the actual ruv-fann neural network core, neuro-divergent forecasting, or ruv-swarm agent code that the README's headline claims (84.8% SWE-Bench solve rate, 27+ forecasting models, 2-4x speedups) depend on. None of those claims are checkable from what was shown.
- The live probe returned only raw CLI build/test output with empty pageText and consoleErrors — there is no evidence of any running demo, server, or UI behavior that would let a reviewer verify functional claims beyond 'the library compiles and its unit tests pass'.
- Dependency audit reports 2 high and 1 moderate severity vulnerabilities across the workspace; these were not addressed or explained in what was shown.
- Security sweep flagged ./.claude/agents/v3/pii-detector.md and .../security-auditor.md as matching secret patterns — these read as agent role-definition docs (a 'PII detector' and 'security auditor' persona), most likely filename/keyword false positives rather than actual leaked secrets, but this is worth clarifying with the maintainer rather than assuming either way.
- The repository is an enormous, sprawling monorepo (cuda-wasm, ruv-swarm, neuro-divergent, extensive .claude/.claude-flow tooling, dozens of ADRs/docs) which makes it very hard to assess actual authorship, cohesion, and code quality of the flagship claims within the scope of evidence given.

## How it was run
> Root Cargo.toml (name=ruv-fann) is the core FANN neural-network crate and is its own workspace (excludes neuro-divergent); cuda-wasm/ruv-swarm are separate heavy sub-projects not built here per 'target the core crate' guidance. No network services or API keys needed; building/testing the lib alone avoids pulling in optional GPU (wgpu) or WASM toolchains.

```console
$ apt-get update -y   # exit 0
$ apt-get install -y build-essential pkg-config libssl-dev   # exit 0
$ curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable   # exit 0
$ . "$HOME/.cargo/env"   # exit 0
$ rustc --version && cargo --version   # exit 0
$ cargo fetch --manifest-path Cargo.toml   # exit 0
$ cargo build --release --lib --manifest-path Cargo.toml 2>&1 | tail -60 && echo '--- ruv-fann core library built successfully ---'   # exit 0
```

## The submission's own tests
`cargo test --lib --release --manifest-path Cargo.toml -- --test-threads=2 2>&1 | tail -100` → **PASS**

```
:tests::test_kernel_optimizer_creation ... ok
test webgpu::kernel_optimizer::tests::test_matrix_vector_optimization ... ok
test webgpu::kernel_optimizer::tests::test_performance_recording ... ok
test webgpu::performance_monitor::tests::test_measurement_recording ... ok
test webgpu::performance_monitor::tests::test_performance_monitor_creation ... ok
test webgpu::performance_monitor::tests::test_performance_stats_calculation ... ok
test webgpu::pipeline_cache::tests::test_cache_clearing ... ok
test webgpu::pipeline_cache::tests::test_cache_hit_ratio_calculation ... ok
test webgpu::pipeline_cache::tests::test_pipeline_cache_creation ... ok
test webgpu::pressure_monitor::tests::test_anomaly_threshold_detection ... ok
test webgpu::pressure_monitor::tests::test_pressure_calculation_methods ... ok
test webgpu::pressure_monitor::tests::test_response_strategy_escalation ... ok
test webgpu::tests::webgpu_tests::test_backend_selector_creation ... ok
test webgpu::tests::webgpu_tests::test_compute_profile_selection ... ok
test training::test_all_algorithms::tests::test_adam_xor_convergence ... ok

test result: ok. 173 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s


```

## Security sweep
- dependency audit: moderate: 1, high: 2, total: 3
- secret patterns: ⚠️ matches in `./.claude/agents/v3/pii-detector.md`, `./.claude/agents/v3/security-auditor.md`

## Output
```
   Compiling syn v2.0.104
   Compiling serde v1.0.219
   Compiling either v1.15.0
   Compiling memchr v2.7.5
   Compiling rayon v1.10.0
   Compiling serde_derive v1.0.219
   Compiling thiserror-impl v1.0.69
   Compiling thiserror v1.0.69
   Compiling bincode v1.3.3
   Compiling serde_json v1.0.140
   Compiling ruv-fann v0.2.1 (/home/user/repo)
    Finished `release` profile [optimized] target(s) in 12.09s
--- ruv-fann core library built successfully ---

```

## Ask the candidate
1. Walk us through 2-3 of the 173 passing tests in the core library (e.g., in webgpu::compute_context or training::test_all_algorithms) — what specific FANN behavior are they validating, and did you write them or generate them?
2. The README claims a competitive '84.8% SWE-Bench solve rate' for ruv-swarm outperforming Claude 3.7 — what is the benchmark harness for that claim, where does it live in the repo, and can you reproduce the number live?
3. The dependency audit shows 2 high-severity vulnerabilities in the workspace — which crates are they in, what's the exploit surface, and what's your patching plan?

---
Evidence sealed: [`manifest.json`](manifest.json) carries a SHA-256 for every
artifact in this directory, ed25519-signed. `npm run verify -- <this dir>`
proves nothing changed since the review.
