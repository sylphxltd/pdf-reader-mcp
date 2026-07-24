# Same-host TS 3.0.14 vs Rust candidate A/B contract

Status: scaffold (not admissible for marketing or public performance claims)

## Purpose

Prove a material, reproducible performance advantage for the exact sole-Rust
candidate against immutable TypeScript `@sylphx/pdf-reader-mcp@3.0.14` on the
**same host**, without quality/safety/tail-latency regressions.

## Hard rules

1. Same machine, corpus, inputs, configuration, and task semantics.
2. Semantic task outcomes must pass before timing is admitted.
3. Interleave/randomize engine order.
4. Separate cold start and warm execution.
5. Record median, p95, throughput, peak memory, startup cost, package/install size.
6. Cover small, medium, large, scanned, table-heavy, structured, and hostile PDFs.
7. Retain raw samples bound to source SHA, binaries, fixtures, toolchains, environment.
8. Distinguish parser/runtime time from provider/external I/O.
9. Historical cross-run numbers are **not** marketing claims.
10. Harness must fail closed with `status != admissible_pass` until complete.

## Commands

```bash
bun scripts/perf/same-host-ts-rust-ab.ts
bun scripts/perf/same-host-ts-rust-ab.ts --require-admissible  # must fail until wired
```

## Admission

Public performance claims require:

- harness `status=admissible_pass`
- independent review authorization of performance claims
- publication of the honest report derived from raw samples
