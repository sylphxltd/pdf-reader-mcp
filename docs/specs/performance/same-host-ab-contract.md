# Same-host TS 3.0.14 vs Rust candidate A/B contract

Status: executable suite (marketing claims still require independent review)

## Purpose

Prove a material, reproducible performance advantage for the exact sole-Rust
candidate against immutable TypeScript `@sylphx/pdf-reader-mcp@3.0.14` on the
**same host**, without quality/safety/tail-latency regressions.

## Hard rules

1. Same machine, corpus, inputs, configuration, and task semantics.
2. Semantic task outcomes must pass before timing is admitted.
3. Interleave/randomize engine order.
4. Separate cold start, warm execution, and initialize-only startup cost.
5. Record median, p95, peak RSS (when `/usr/bin/time` available), package/binary sizes.
6. Cover required classes: small_text, structured, table_heavy, geometry_edge,
   metadata_structured, text_segmentation, behavior_baseline, hostile_table_bound.
7. Retain raw samples bound to source SHA, binaries, fixtures, toolchains, environment.
8. Capability-first semantic gate (non-empty successful payload), not PDF.js byte equality.
9. Historical cross-run numbers are **not** marketing claims.
10. Harness fails closed with `status != admissible_pass` until complete.

## Fixture gate (`fixture_pass`)

A single fixture is `fixture_pass` when:

- warm semantic pass rate is 1.0 for both engines
- warm iterations ≥ 5
- warm median speedup (TS/Rust) ≥ 1.5
- rust warm p95 / ts warm p95 ≤ 1.15

## Suite gate (`admissible_pass`)

Suite is `admissible_pass` when:

- all required fixture classes are present and `fixture_pass`
- min warm median speedup across required fixtures ≥ 1.5
- no failed semantic/runtime runs

## Commands

```bash
bun run build:rust
bun run perf:same-host-ab
bun run perf:same-host-ab-suite
bun run perf:same-host-ab-suite -- --require-admissible
```

## Marketing claims

Public performance claims additionally require:

- suite `status=admissible_pass`
- independent review `performanceClaimsAuthorized=true`
- published honest report derived from raw samples
