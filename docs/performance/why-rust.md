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

v3.1+ is that end state:

- **npm**: `@sylphx/pdf-reader-mcp` → ships the native `pdf-reader-mcp-server`
- **crates.io**: `pdf-reader-core`, `pdf-reader-mcp-server`, `pdf-reader-cli`
- **Tools**: `read_pdf`, `search_pdf`, `pdf_evidence` (inspect + fail-closed visual ops)

## What must not regress

Updating the implementation language must **not** remove public capabilities.
The pure-Rust path populates the Document Twin response surface, including:

| Capability group | Fields / operations |
| --- | --- |
| Core text | `full_text`, `markdown`, `html`, `chunks`, `elements`, `text_layer` |
| Structure | `tables`, `document_map`, `document_ast`, `layout_diagnostics` |
| Safety / trust | `safety_findings`, `trust_report`, `accessibility_report` |
| Document signals | `outline`, `annotations`, `form_fields`, `attachments`, `structure_trees`, `page_labels`, `page_geometry`, `permissions` |
| Provider opt-in | `ocr_text_layer`, `visual_enrichments` (empty + warning without providers — same model as optional TS providers) |
| Evidence | `pdf_evidence` `inspect` (routing); visual ops fail closed with guidance when no render/OCR backend is configured |

Regression fence:

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

Historical TypeScript baselines (previous release gate, same fixture, documented
in `docs/benchmark.md`):

| Scenario | Historical TS avg |
| --- | --- |
| Metadata + page count | 1.1 ms |
| Full text | 16.1 ms |
| Agent Document Twin | 27.2 ms |

The pure-Rust harness writes a `comparison` block with speedup ratios against
those baselines so industry readers can see the delta without re-running the old
stack.

## Latest measured results (this host)

Fixture: `test/fixtures/sample.pdf` · iterations=15 · warmup=3 · measuredAt=2026-07-17T23:15:41.531Z

| Scenario | Pure-Rust avg | Pure-Rust p50 | Pure-Rust p95 | Historical TS avg | Speedup |
| --- | ---: | ---: | ---: | ---: | ---: |
| Metadata + page count | 11.174 ms | 11.665 ms | 13.318 ms | 1.1 ms | 0.10× |
| Full text | 8.041 ms | 5.875 ms | 14.169 ms | 16.1 ms | 2.00× |
| Agent Document Twin (balanced) | 8.227 ms | 6.447 ms | 14.826 ms | 27.2 ms | 3.31× |
| Agent Document Twin (full includes) | 12.916 ms | 12.516 ms | 18.278 ms | — | — |
| search_pdf literal | 0.862 ms | 0.735 ms | 1.573 ms | — | — |
| pdf_evidence inspect | 9.325 ms | 9.158 ms | 13.206 ms | — | — |

**Headline:** full-text extraction is **2.0×** the historical TS baseline; balanced Agent Document Twin is **3.3×**. Metadata-only on pure-Rust still pays for text extraction today (no separate metadata-only parser), so that scenario is not the primary win — twin and search are.

Artifact: `benchmark-artifacts/pdf_pure_rust_benchmark.json`.


## Why these numbers matter

- **Agent loops are serial.** A 2–10× cut on extract/search multiplies across every tool call.
- **Cold start matters for MCP.** One native binary avoids Node spawn + module graph load on the hot path.
- **Ops cost.** One artifact to pin in Docker / GHCR / cargo install.

## Capability honesty

Pure-Rust text extraction uses the selectable text layer. Geometry-perfect
pdf.js layout boxes and provider-backed OCR/visual pipelines still follow the
same **opt-in provider** contract: without a provider, those arrays are empty
and warnings explain the gap — they do not silently invent pixels.

Visual `pdf_evidence` operations (`render_page`, `extract_regions`, `ocr_pages`,
`analyze_regions`) fail closed with explicit guidance when no render/OCR backend
is configured, matching the previous optional-canvas / optional-provider model.

## Install

Production: pin `@sylphx/pdf-reader-mcp@3.0.14` (TypeScript).  
See [installation guide](../guide/installation.md). Pure-Rust remains experimental source-only.
