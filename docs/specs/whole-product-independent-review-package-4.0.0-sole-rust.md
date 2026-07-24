# Whole-product independent review package — sole-Rust 4.0.0 candidate

Status: **ready for independent review input** (not an authorization)  
Date: 2026-07-24  
Authority: ADR-0005 capability-first; ADR-0006 sole-Rust production  
Product truth SSOT: `docs/specs/pure-rust-capability-matrix.json`

## Purpose

Exact-SHA review package for the **sole-Rust 4.0.0** candidate before any stable
publish, freeze lift, or goal-complete claim.

This package does **not** authorize publish by itself.

## Exact candidate identity

| Field | Value |
| --- | --- |
| Repository | `SylphxAI/pdf-reader-mcp` |
| Branch | `codex/sole-rust-4.0.0-showhand` / PR #574 |
| Candidate SHA | `7dddcb42bd7cb1ebffc9d502a8886922f26ce4c6` |
| Candidate version | `4.0.0` (unpublished) |
| Admission bar | capability-first semantic compatibility |
| `soleRustProduction` | `true` |
| `typescriptProductionShipped` | `false` |
| `dropInFor3014` | `false` until review + remaining gates |
| `publishFreeze` | `true` until review + remaining gates |
| Published stable (live) | `@sylphx/pdf-reader-mcp@3.2.2` transitional Rust-default + bundled TS |
| Historical TS LKG | `@sylphx/pdf-reader-mcp@3.0.14` external only |

## What "Sole Rust" means for this candidate

- Production package ships only thin JS launcher (`dist/runtime-entry.js`) + optional pure-rust spawn helper
- No `./typescript` export; force-TS flags fail closed
- No TS PDF runtime / PDF.js workers in published tarball
- Rust owns MCP tools, PDF processing, evidence, OCR/provider routing, fail-closed behavior

## Review layers and evidence

### A. Interface compatibility (exact)

Commands / artifacts:

- `bun run check:production-contract` → PASS  
  `verification/pdf-reader-production-contract-sole-rust-draft.json`
- `bun run check:ts-production-absence` → PASS
- `bun run package:smoke` → tarball excludes TS/PDF.js payloads
- `bun run check:pure-rust-exports` → PASS

### B. Semantic capability equivalence

- `bun run check:semantic-contracts` → 12 contracts PASS
- `bun test test/production/capabilityParity.contract.test.ts` → 11/11 PASS  
  `verification/pdf-reader-capability-parity-sole-rust-draft.json`
- `bun run test:ts-vs-rust-text` → PASS (token recall ~0.85; not exact full_text equality)
- Inventory: `docs/specs/sole-rust-4.0.0-capability-inventory.json`  
  (PARTIAL remains PARTIAL; dispositions are tracking only)

### C. Quality parity (task-eval)

- Local agent-task eval pure-Rust vs TS 3.0.14 baseline: **10/10 PASS**  
  `verification/pdf-reader-agent-task-eval-pure-rust-local-draft.json`
- Public URL corpus remains opt-in follow-on (`test:agent-task-public-*`)

### D. Packaging / five-host runtime

- Candidate host runtime proof (local-pack + initialize, arch-matched): **5/5 PASS**  
  Run: https://github.com/SylphxAI/pdf-reader-mcp/actions/runs/30063292557  
  Aggregate: `verification/pdf-reader-candidate-host-runtime-proof-4.0.0-aggregate.json`
- Hosts: linux-x64-gnu, linux-arm64-gnu, darwin-arm64, **darwin-x64 (self-hosted x86_64, Rosetta=false)**, win32-x64-msvc
- Contract: `docs/specs/host-runtime-proof-contract.md`

### E. Performance (same-host A/B)

- Harness: `bun run perf:same-host-ab` / `perf:same-host-ab-suite`
- Status: **measured_draft_not_admissible** (diagnostic only)
- Evidence drafts:
  - `verification/pdf-reader-same-host-ab-suite-draft.json`
  - `verification/pdf-reader-same-host-ab-single-fixture-draft.json`
- Reviewer must not accept historical cross-run numbers as marketing claims.

### F. Core admission script

```bash
PDF_READER_MCP_RUST_BIN=target/release/pdf-reader-mcp-server bun run check:sole-rust-core
```

Local result: PASS  
`verification/pdf-reader-sole-rust-core-admission-draft.json`

## Required independent reviewer actions

1. Check out exact SHA `7dddcb42bd7cb1ebffc9d502a8886922f26ce4c6` (or successor clean tip after green CI) with clean worktree.
2. Re-run A–F from source (do not trust prior draft JSON alone).
3. Inspect cumulative migration vs 3.2.2 transitional surface and 3.0.14 LKG.
4. Verify tarball contents and launcher behavior (no TS production path).
5. Verify five-host proofs include real darwin-x64 (not arm64 re-label).
6. Assess performance methodology; authorize claims only if admissible.
7. Decide explicit outcomes:
   - capability-first whole-product replacement: yes/no
   - sole-Rust production authority: yes/no
   - TypeScript production deletion: yes/no
   - performance claims: yes/no/none
   - exact stable release authorization: yes/no
   - goal completion eligibility: yes/no

## Forbidden reviewer outcomes

- Rewriting older review JSON (e.g. f1a1626 / 3.2.2 packaging) to authorize this SHA
- Treating PARTIAL matrix cells as FULL by declaration
- Treating 3.2.2 as Sole Rust
- Authorizing publish while `publishFreeze=true` without explicit freeze lift evidence

## Suggested output artifact

`verification/pdf-reader-whole-product-independent-review-4.0.0-<shortsha>.json` with:

- `candidate.sha`
- `outcome` starting with `review_pass_` or `review_fail_`
- explicit booleans: unfreezeAuthorized, soleRuntimeAuthorized, tsRetirementAuthorized, performanceClaimsAuthorized, goalCompleteAuthorized
- findings + evidence commands actually re-run
