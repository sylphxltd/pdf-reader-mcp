# Migration and recovery notes

This page is **secondary engineering history**. Product install lives on the [Installation](/guide/installation) guide and repository README.

## Current production

- Latest: `@sylphx/pdf-reader-mcp@4.1.1`
- Engine: native Rust via thin Node launcher
- No TypeScript PDF runtime in the production package
- No `./typescript` export
- Missing native package fails closed

## Prefer

Use **4.1.1** (or latest 4.1.x).

- Prefer 4.1.1 over 4.1.0 for the synced product README.
- Prefer 4.1.x over 4.0.2 for warm-cache + smaller strip/LTO natives.
- Do not prefer 4.0.1 on Linux x64: `linux-x64-gnu@4.0.1` was tombstoned.

## Historical TypeScript baseline

Immutable external baseline for comparison/recovery only:

```bash
npm install -g @sylphx/pdf-reader-mcp@3.0.14
```

## Transitional history

- `3.2.2`: Rust-default with bundled TypeScript rollback (not Sole Rust)
- `4.0.0`: Sole-Rust runtime cutover that still declared TS/PDF.js production dependencies
- `4.0.1`: empty production dependency graph; Linux x64 native packaging defect
- `4.0.2`: Sole-Rust dependency-closure with installable five-platform natives
- `4.1.0`: warm read cache + strip/LTO natives + product performance evidence
- `4.1.1`: npm README / claims sync of the authorized 4.1 narrative

## Performance admission status

Registry-bound dual-mode suite for published 4.1.0: `admissible_pass` on linux-x64.
Bounded claims authorized; see product proof and 4.1.0 performance report.
