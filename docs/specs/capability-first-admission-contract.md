# Capability-first admission contract

Status: active  
Date: 2026-07-22  
Authority: ADR-0005  
Product truth SSOT: `docs/specs/pure-rust-capability-matrix.json`

## Purpose

Define how Rust is admitted as the TypeScript 3.0.14 replacement without
requiring exact PDF.js output equality.

## Layers

### A. Interface compatibility (exact)

Must remain stable or explicitly versioned:

- tool names: `read_pdf`, `search_pdf`, `pdf_evidence` (and any published aliases)
- input schema required/optional rules
- output field types for claimed public surfaces
- MCP transport/JSON-RPC envelopes
- error classes (`isError`, source-local vs request-fatal)
- 1-based page numbering
- system-owned IDs/provenance non-overwrite rules
- fail-closed capability absence

Breaks here block release.

### B. Semantic capability equivalence (primary)

For each claimed capability family, Rust must support the same agent task class
as the TS LKG, with correct page/location/provenance usefulness.

Examples of accepted representation differences when classified:

- whitespace normalization
- ID formatting within stable system ownership
- bbox sub-pixel / rounding deltas inside documented tolerance
- ordering differences inside an equivalence class
- richer provenance than TS

Examples of semantic failures:

- missing primary table or wrong cell relations
- citation to wrong page
- search misses all relevant matches for a query class
- OCR path silently drops scanned-page evidence
- form/annotation capability disappears or mislabels critical values

### C. Quality parity (task-eval)

Release requires a calibrated agent-task corpus. Thresholds are measured against
TS baseline on the same corpus, not invented.

Minimum task classes:

1. extract specified passage
2. answer table numeric questions
3. recover headings/sections
4. cite answers with correct page
5. surface annotations/forms/attachments
6. OCR scanned pages
7. image/caption linkage
8. malformed/huge PDF safety and bounds
9. latency/memory resource bounds

## Mismatch taxonomy

| Class | Action |
| --- | --- |
| `contract_break` | must fix before merge/release |
| `semantic_regression` | must fix before merge/release |
| `equivalent_representation` | accept + document |
| `rust_improvement` | accept + document |
| `pdfjs_implementation_non_goal` | stop chasing |
| `unknown` | route to task-eval |

## TS 3.0.14 differential role

Keep:

- frozen exact families already admitted
- interface/schema checks
- security/resource hostile cases
- high-value semantic oracles

Stop expanding:

- residual PRs whose only goal is PDF.js representation micro-parity

## Nonclaim reclassification

All open matrix non-claims must eventually land in
`docs/specs/nonclaim-reclassification-ledger.json` as one of:

- `blocking_capability_gap`
- `quality_risk`
- `compatibility_only`
- `pdfjs_implementation_non_goal`
- `equivalent_representation`
- `security_or_resource_bound`
- `unclassified` (temporary only)

Unfreeze requires zero `unclassified` and zero unresolved
`blocking_capability_gap`.

## Current freeze

Until the new bar is met:

- `productTruth.dropInFor3014 = false`
- `productTruth.publishFreeze = true`
- published stable remains `@sylphx/pdf-reader-mcp@3.0.14` TypeScript path

## Architecture note

Canonical model ownership stays in Rust. PDF.js is a reference implementation
for compatibility discovery, not the product’s semantic SSOT.
