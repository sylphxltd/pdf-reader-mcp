# Migration and recovery notes

This page is **secondary engineering history**. Product install docs live on the README and Installation guide.

This page holds historical engine-transition details. The main product page is the repository [README](https://github.com/SylphxAI/pdf-reader-mcp#readme) / docs [home](/).

## Current production

- Latest: `@sylphx/pdf-reader-mcp@4.0.2`
- Engine: native Rust via thin Node launcher
- No TypeScript PDF runtime in the production package
- No `./typescript` export
- Missing native package fails closed

## Prefer

Use **4.0.2**.  
Do not prefer 4.0.1 on Linux x64: `@sylphx/pdf-reader-mcp-linux-x64-gnu@4.0.1` was tombstoned after a broken tarball repair attempt.

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

## Performance admission status

Preliminary same-host startup-inclusive measurements exist. Formal product performance admission requires the rebuilt harness (startup vs persistent warm, stronger semantic gates, capability-specific tasks, registry-installed binaries, durable raw samples).
