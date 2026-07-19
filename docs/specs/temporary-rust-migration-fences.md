# Temporary Rust migration fences

The published `3.0.14`-compatible TypeScript runtime remains authoritative after
the `3.0.15` rollback. Rust is experimental and opt-in. The remaining
source-shape checks in `scripts/check-no-ts-{stdio,http}-backend.sh`,
`scripts/check-ts-adapter-deletion-ready.sh`, their focused test matrices, and
the corresponding release-gate assertions are temporary migration fences, not
durable architecture tests.

Retire all of them in the same candidate when every condition below is true:

1. `docs/specs/pure-rust-capability-matrix.json` records
   `productTruth.dropInFor3014: true` from complete capability evidence;
2. `bun run validate:pure-rust-claimed` passes on the exact candidate, including
   all v3.0.14 behavior, structure, text, citation, semantic, AST, document-map,
   visual, and TS-versus-Rust differential suites;
3. package smoke proves the installed default MCP entrypoint and public schemas
   are drop-in compatible; and
4. the published artifact readback identifies that exact candidate.

The replacement proof is the executable package smoke, integration, contract,
and differential suites. Do not replace these fences with new source-token
checks after cutover.
