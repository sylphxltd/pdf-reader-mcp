# Citra — brand npm publish readiness

**Publish authority:** this repository only (not a multi-product monorepo).

| Field | Value |
| --- | --- |
| Brand | **Citra** |
| Transitional npm id | `@sylphx/pdf-reader-mcp` |
| Target brand npm id | `@sylphx/citra` |
| Brand bin | `citra` |
| Marketplace title | Citra (`server.json`) |

## Current policy

1. Ship/publish `@sylphx/pdf-reader-mcp` from this repo (existing CI/release train).
2. Optional second publish of `@sylphx/citra` **from this same repo** (same artifacts, renamed package.json at pack time).
3. Never publish brand packages from `SylphxAI/instruments` (docs-only).

## Dry-run (no npm auth required)

```bash
# Transitional package as configured
npm pack --dry-run
# Or product-specific brand pack plan script when present:
# bun scripts/brand-pack-plan.ts
```

## Blockers for live brand publish

- npm automation token / 2FA for `@sylphx` scope
- Changeset/version alignment with transitional package
- Registry readback proof after publish

## Family

https://github.com/SylphxAI/instruments
