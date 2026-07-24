# Product proof

This page is the acquisition-facing evidence board for PDF Reader MCP.
Engineering history stays in [migration notes](/migration).

## Promise

> Give your AI agent eyes for PDFs.

One MCP server returns structured text, tables, OCR paths, visual evidence, and
page-level citations — local-first on five platforms.

![Before vs after](/before-after-evidence.svg)

## Three flagship workflows

### 1. Financial report / tables

```json
{
  "sources": [{ "path": "/absolute/path/to/10-k.pdf" }],
  "include_tables": true,
  "include_markdown": true,
  "pages": [14]
}
```

Expected agent outcome: table cells with page + geometry, not a prose guess.

### 2. Research paper / citations

```json
{
  "sources": [{ "path": "/absolute/path/to/paper.pdf" }],
  "include_full_text": true,
  "include_document_map": true
}
```

Expected agent outcome: section/reading-order context and page-linked quotes.

### 3. Scanned document / OCR

```json
{
  "sources": [{ "path": "/absolute/path/to/scan.pdf" }],
  "include_ocr_text_layer": true,
  "include_tables": true
}
```

Expected agent outcome: OCR text kept separate from selectable text, with page
evidence for verification.

Copy-ready examples live in [`examples/`](https://github.com/SylphxAI/pdf-reader-mcp/tree/main/examples).

## Install footprint (measured)

Clean install on **linux-x64** (Node 24):

| Metric | TS `3.0.14` | Sole-Rust `4.0.2` |
| --- | ---: | ---: |
| Full `node_modules` | ~82.3 MiB | **~24.4 MiB (~3.4× smaller)** |
| Files | 4,101 | **20 (~205× fewer)** |
| Production deps | PDF.js + MCP SDK + … | `{}` + one native package |

Source: `verification/footprint/*-linux-x64.json`

## Performance surfaces (honest)

Do not collapse these into one “Nx faster” slogan:

| Surface | What it measures | Current draft status |
| --- | --- | --- |
| `startup_inclusive` | spawn + initialize + one task | Large Rust advantage on local fixtures |
| `persistent_warm` | long-lived process, repeated identical local `read_pdf` | Local suite `admissible_pass` after process-local warm cache (min ~10× on 8 classes) |
| First request in a process | full parse/extract | Still pays full cost |
| Registry-installed exact binary | clean npm install of published natives | Required before formal marketing authorization |

Policy: [same-host contract](/specs/performance/same-host-ab-contract) ·
[claims policy](https://github.com/SylphxAI/pdf-reader-mcp/blob/main/docs/specs/performance/4.0.2-performance-claims-policy.md)

Until independent review sets `performanceClaimsAuthorized=true` against a
registry-bound suite, treat speed numbers as **engineering evidence**, not a
universal product guarantee.

## Engine

Version 4+ uses a **native Rust engine** via a thin Node launcher.

- Five platforms
- Fail closed if native binary missing
- No TypeScript PDF runtime in the production package

## What is still secondary

- Migration ledgers, residual PDF.js parity families, CI SHA archaeology
- See [migration](/migration) and maintainer ADRs
