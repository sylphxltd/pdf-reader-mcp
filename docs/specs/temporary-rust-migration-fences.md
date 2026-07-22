# Temporary Rust migration fences

The published `3.0.14`-compatible TypeScript runtime remains authoritative after
the `3.0.15` rollback. Rust is experimental and opt-in under a
**capability-first semantic compatibility** admission bar (ADR-0005). Exact
PDF.js output equality is not the whole-product release standard.

The remaining source-shape checks in `scripts/check-no-ts-{stdio,http}-backend.sh`,
`scripts/check-ts-adapter-deletion-ready.sh`, their focused test matrices, and
the corresponding release-gate assertions are temporary migration fences, not
durable architecture tests.

Retire all of them in the same candidate when every condition below is true:

1. `docs/specs/pure-rust-capability-matrix.json` records
   `productTruth.dropInFor3014: true` from complete **capability-first**
   evidence (interface + semantic contracts + calibrated task-eval), not from
   exhaustive PDF.js JSON equality;
2. `bun run validate:pure-rust-claimed` passes on the exact candidate for the
   claimed interface/security/semantic suites that remain in force;
3. package smoke proves the installed default MCP entrypoint and public schemas
   are drop-in compatible; and
4. the published artifact readback identifies that exact candidate.

Until then:

- `productTruth.dropInFor3014` remains `false`
- `productTruth.publishFreeze` remains `true`
- TS 3.0.14 exact differential families remain frozen regression assets
- new exact residual expansion is limited to contract breaks, semantic
  regressions, and security/resource fail-closed gaps
- open non-claims are tracked in
  `docs/specs/nonclaim-reclassification-ledger.json`

The replacement proof is the executable package smoke, integration, contract,
semantic, task-eval, and differential suites. Do not replace these fences with
new source-token checks after cutover.
