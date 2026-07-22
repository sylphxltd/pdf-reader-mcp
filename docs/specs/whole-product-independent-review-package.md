# Whole-product independent review package (Rust replacement candidate)

Status: draft package for review launch  
Date: 2026-07-22  
Authority: ADR-0005 capability-first semantic compatibility  
Product truth SSOT: `docs/specs/pure-rust-capability-matrix.json`

## Purpose

Provide a single exact-SHA review package for the pure-Rust sole-runtime candidate
before any publish unfreeze or TypeScript retirement.

This package does **not** authorize unfreeze by itself. It is the input to an
independent whole-product review.

## Exact candidate identity

| Field | Value |
| --- | --- |
| Repository | `SylphxAI/pdf-reader-mcp` |
| Branch baseline | `main` at review start |
| Candidate SHA | _fill at review launch_ |
| Admission bar | capability-first semantic compatibility (not exact PDF.js equality) |
| `dropInFor3014` | `false` until review + remaining gates pass |
| `publishFreeze` | `true` until review + remaining gates pass |
| Published stable | `@sylphx/pdf-reader-mcp@3.0.14` (TypeScript) |

## Review layers

### A. Interface compatibility (exact)

Must remain green:

- MCP tool names / schemas / envelopes
- page numbering convention
- fail-closed capability absence
- package default export remains intentional and versioned

Evidence:

- schema/runtime tests
- `bun run check:pure-rust-matrix`
- package smoke (`exports["."]` TypeScript path)

### B. Semantic capability equivalence (primary)

Must support the same agent task classes as TS 3.0.14 LKG for claimed surfaces:

- text extraction + citation usefulness
- table structure usefulness
- search page localization
- outline/forms/annotations presence
- visual candidates / enrichment fusion
- OCR text layer when configured
- security/resource fail-closed behavior

Evidence:

- frozen differential suites under `validate:pure-rust-claimed`
- semantic contracts in `docs/specs/semantic-contracts/`
- agent-task corpus + measured TS baseline comparison

### C. Quality parity (task-eval)

Local measured baseline:

- `docs/specs/agent-task-corpus/baselines/typescript-v3.0.14.local.json`
- commands:
  - `bun run test:agent-task-eval:calibrate`
  - `bun run test:agent-task-eval`
  - `bun run test:agent-task-smoke`

Public URL corpus remains a follow-on gate before unfreeze.

### D. Packaging / runtime

- five-platform native host runtime smoke workflow
- experimental pure-Rust library export: `@sylphx/pdf-reader-mcp/pure-rust`
- default package entry remains TypeScript until unfreeze

Evidence:

- `.github/workflows/native-package-scaffold.yml`
- `bun run smoke:native-launcher`
- `bun run smoke:native-package-resolve`
- `bun run check:pure-rust-exports`

### E. Remaining blockers before unfreeze

1. npm registry native package install/readback on five platforms
2. public URL agent-task corpus calibration
3. independent whole-product review sign-off on one exact candidate SHA
4. TS retirement + rollback plan readback
5. explicit `publishFreeze=false` / `dropInFor3014` decision after A–D

## Independent review checklist

Reviewer must verify from current main/candidate SHA (not memory):

- [ ] Candidate SHA recorded above
- [ ] `productTruth.publishFreeze === true` and `dropInFor3014 === false` before unfreeze decision
- [ ] Interface contracts green
- [ ] Semantic contracts green (`bun run check:semantic-contracts`)
- [ ] Agent-task local corpus green vs measured TS baseline
- [ ] Native five-platform host smoke green on latest main workflow
- [ ] Pure-Rust library export contract green without changing default TS entry
- [ ] Release workflow fails only at publish freeze (or succeeds only after intentional unfreeze)
- [ ] Residual exact PDF.js micro-parity expansion is not required for admission
- [ ] Remaining blockers listed explicitly; none silently reclassified as pass

## Launch command template

```bash
git fetch origin main
git rev-parse origin/main   # record as candidate SHA
bun run check:pure-rust-matrix
bun run check:semantic-contracts
bun run check:agent-task-corpus
bun run test:agent-task-eval
bun run check:pure-rust-exports
bun run smoke:native-launcher
bun run smoke:native-package-resolve
```

## Outcome states

| Outcome | Meaning |
| --- | --- |
| Review pass with freeze retained | Candidate is review-ready; unfreeze still blocked by registry/public corpus/explicit decision |
| Review fail | Record contract/semantic/security gaps; do not unfreeze |
| Unfreeze authorized | Only after review pass **and** remaining blockers closed with evidence |

