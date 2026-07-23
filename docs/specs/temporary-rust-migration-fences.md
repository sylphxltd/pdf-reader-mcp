# Temporary Rust migration fences

The published `3.0.14`-compatible TypeScript runtime remains the default MCP
entrypoint until sole-runtime cutover. Pure-Rust uses **capability-first semantic compatibility**
(ADR-0005) and may be published under verified-candidate admission without
claiming exhaustive PDF.js JSON equality.

## Verified-candidate admission

Registry publish is gated by:

```bash
bun scripts/check-verified-candidate-admission.ts
```

wired into:

- `.github/workflows/release.yml`
- `.github/workflows/publish-npm.yml`

This replaces the historical hard-coded `exit 1` publish freeze.

## Sole-runtime cutover (still fenced)

Retire TS-default migration fences in the same candidate when every condition
below is true:

1. `docs/specs/pure-rust-capability-matrix.json` records
   `productTruth.dropInFor3014: true` from complete **capability-first**
   evidence (interface + semantic contracts + calibrated task-eval), not from
   exhaustive PDF.js JSON equality;
2. `bun run validate:pure-rust-claimed` passes on the exact candidate for the
   claimed interface/security/semantic suites that remain in force;
3. package smoke proves the installed default MCP entrypoint and public schemas
   are drop-in compatible; and
4. five-platform native optional packages are published and registry
   install/readback is proven; and
5. the published artifact readback identifies that exact candidate.

Until sole-runtime cutover:

- `productTruth.dropInFor3014` remains `false`
- TypeScript remains the default package entry
- pure-Rust remains opt-in via `PDF_READER_ENGINE_MODE=pure-rust`
- TS 3.0.14 exact differential families remain frozen regression assets
- new exact residual expansion is limited to contract breaks, semantic
  regressions, and security/resource fail-closed gaps
- open non-claims are tracked in
  `docs/specs/nonclaim-reclassification-ledger.json`

`productTruth.publishFreeze` may be `false` when verified-candidate admission
authorizes registry publish of pure-Rust progress packages.

The replacement proof is the executable package smoke, integration, contract,
semantic, task-eval, differential, and registry-install suites. Do not replace
these fences with new source-token checks after cutover.

## Native optional packages (Stage B)

Five platform packages under `packages/pdf-reader-mcp-*` are publishable optional
dependencies of the main package:

- manifests are version-synced by `bun run native:sync-manifests`
- `prepublishOnly` refuses missing/empty binaries
- multi-platform build + publish: `.github/workflows/publish-npm.yml`
- local readiness: `bun run native:assert-ready`
- registry proof: `bun run check:registry-install-proof -- --registry --version=<ver>`

Until registry install/readback is green on all five platforms:

- `productTruth.dropInFor3014` remains `false`
- TypeScript remains the default package entry
- pure-Rust remains opt-in

