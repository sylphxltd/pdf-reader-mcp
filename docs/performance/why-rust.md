---
layout: doc
title: Why pure Rust + open gaps
---

# Why pure Rust + open gaps

> **Status:** experimental. **Not** a full drop-in for TypeScript 3.0.14.
> Published stable remains `@sylphx/pdf-reader-mcp@3.0.14`.



## The product decision

`@sylphx/pdf-reader-mcp` is a **starred public MCP**. Agents call it thousands of
times. The right end state is not “half TypeScript, half Rust, please wait while
we migrate” — it is **one native engine** with the same public tools and the same
Agent Document Twin fields.

The withdrawn v3.1.x releases did **not** reach that end state. The intended
replacement, once it passes the executable parity and release gates, is:

- **npm**: `@sylphx/pdf-reader-mcp` → ships the native `pdf-reader-mcp-server`
- **crates.io**: `pdf-reader-core`, `pdf-reader-mcp-server`, `pdf-reader-cli`
- **Tools**: `read_pdf`, `search_pdf`, and every `pdf_evidence` success and failure path

## What must not regress

Updating the implementation language must **not** remove public capabilities.
The replacement must reproduce the Document Twin semantics, not merely return
fields with these names. Today many pure-Rust fields are heuristic or empty;
their current status is recorded in the
[capability matrix](../specs/pure-rust-capability-matrix.json).

| Capability group | Fields / operations |
| --- | --- |
| Core text | `full_text`, `markdown`, `html`, `chunks`, `elements`, `text_layer` |
| Structure | `tables`, `document_map`, `document_ast`, `layout_diagnostics` |
| Safety / trust | `safety_findings`, `trust_report`, `accessibility_report` |
| Document signals | `outline`, `annotations`, `form_fields`, `attachments`, `structure_trees`, `page_labels`, `page_geometry`, `permissions` |
| Provider opt-in | `ocr_text_layer`, `visual_enrichments` (empty + warning without providers — same model as optional TS providers) |
| Evidence | `pdf_evidence` `inspect` (routing); visual ops fail closed with guidance when no render/OCR backend is configured |

The following commands exercise only the currently claimed subset. They are
not a drop-in or release-admission proof:

```bash
bun run build:rust
bun test test/production/capabilityParity.contract.test.ts --timeout=600000
bun run check:production-contract
```

## Benchmark method

```bash
bun run build:rust
bun run benchmark:pure-rust -- --iterations 20 --warmup 3 \
  --output benchmark-artifacts/pdf_pure_rust_benchmark.json
```

Scenarios (fixed fixture `test/fixtures/sample.pdf`):

1. `metadata_page_count`
2. `full_text`
3. `agent_document_twin_balanced` (auto)
4. `agent_document_twin_full` (explicit include_*)
5. `search_literal`
6. `inspect`

Each scenario warms up, then records avg / min / max / p50 / p95 over N iterations
against the **production pure-Rust binary**.

Historical TypeScript timings are retained below only as provenance for an old
measurement. They were not collected in the same run, on a digest-bound
semantically equivalent candidate, and therefore cannot establish a speedup:

| Scenario | Historical TS avg |
| --- | --- |
| Metadata + page count | 1.1 ms |
| Full text | 16.1 ms |
| Agent Document Twin | 27.2 ms |

The pure-Rust harness currently writes a `comparison` block, but those ratios
are diagnostic historical comparisons and must not be used as release or
marketing claims.

## Historical diagnostic run (not an A/B benchmark)

Fixture: `test/fixtures/sample.pdf` · iterations=15 · warmup=3 · measuredAt=2026-07-17T23:15:41.531Z

| Scenario | Pure-Rust avg | Pure-Rust p50 | Pure-Rust p95 | Historical TS avg | Speedup |
| --- | ---: | ---: | ---: | ---: | ---: |
| Metadata + page count | 11.174 ms | 11.665 ms | 13.318 ms | 1.1 ms | 0.10× |
| Full text | 8.041 ms | 5.875 ms | 14.169 ms | 16.1 ms | 2.00× |
| Agent Document Twin (balanced) | 8.227 ms | 6.447 ms | 14.826 ms | 27.2 ms | 3.31× |
| Agent Document Twin (full includes) | 12.916 ms | 12.516 ms | 18.278 ms | — | — |
| search_pdf literal | 0.862 ms | 0.735 ms | 1.573 ms | — | — |
| pdf_evidence inspect | 9.325 ms | 9.158 ms | 13.206 ms | — | — |

No speedup claim is admissible from this table. A release benchmark must run
TS 3.0.14 and the exact Rust candidate on the same host and corpus, verify
semantically equivalent outputs before timing, randomize/interleave samples,
separate cold and warm paths, and retain raw samples plus source, fixture,
binary, toolchain, and environment digests.

Artifact: `benchmark-artifacts/pdf_pure_rust_benchmark.json`.


## Why performance work still matters

- **Agent loops are serial.** Verified latency reductions compound across tool calls.
- **Cold start matters for MCP.** It must be measured separately from warm calls.
- **Ops cost.** A native distribution can simplify deployment only after cross-platform packaging is proven.

## Capability honesty

Pure-Rust text extraction currently uses the selectable text layer. Geometry,
OCR, visual evidence, and full Document Twin parity remain open work. Empty
placeholder arrays prove only response shape; they do not prove capability.

Visual `pdf_evidence` operations (`render_page`, `extract_regions`, `ocr_pages`,
`analyze_regions`) currently fail closed. That is safer than silent success but
is not TS 3.0.14 parity.

## Install

Production: pin `@sylphx/pdf-reader-mcp@3.0.14` (TypeScript).  
See [installation guide](../guide/installation.md). Pure-Rust remains experimental source-only.
