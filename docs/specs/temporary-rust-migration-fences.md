# Temporary Rust migration fences

Pure-Rust is the default package entry via `dist/runtime-entry.js` when the
platform optional native package is installed. TypeScript remains available as:

- `exports["./typescript"]` → `dist/index.js`
- `PDF_READER_FORCE_TYPESCRIPT=1` or `PDF_READER_ENGINE_MODE=typescript`

Admission bar: **capability-first semantic compatibility** (ADR-0005).

## Sole-runtime cutover evidence

1. Five-platform registry install + pure-Rust MCP initialize proof:
   `verification/pdf-reader-registry-install-proof-3.1.4.json`
   run: https://github.com/SylphxAI/pdf-reader-mcp/actions/runs/29998671429
2. Linux natives built on Ubuntu 22.04 with GLIBC <= 2.35 publish gate.
3. Independent review sole-runtime authorization in
   `verification/pdf-reader-whole-product-independent-review-f1a1626.json`.

## Still retained

- Frozen TS 3.0.14 residual differentials as regression assets
- TypeScript fallback path for unsupported platforms / missing optional deps
- Withdrawn range `3.0.15`–`3.1.1` must not be used

## Publish gates

```bash
bun scripts/check-verified-candidate-admission.ts
bun run check:pure-rust-matrix
bun run check:registry-install-proof -- --registry --version=<ver>
```

## Related SSOT

- `docs/adr/0005-capability-first-semantic-compatibility.md`
- `docs/specs/capability-first-admission-contract.md`
- `docs/specs/nonclaim-reclassification-ledger.json`
- `docs/specs/pure-rust-capability-matrix.json`

