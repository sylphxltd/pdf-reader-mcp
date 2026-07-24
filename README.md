<div align="center">

# PDF Reader MCP

**Evidence-first PDF intelligence for AI agents**

Read PDFs with page citations, tables, structure, OCR, and trust signals — not a plain text dump.

[![npm version](https://img.shields.io/npm/v/@sylphx/pdf-reader-mcp?style=flat-square)](https://www.npmjs.com/package/@sylphx/pdf-reader-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](https://opensource.org/licenses/MIT)
[![CI](https://img.shields.io/github/actions/workflow/status/SylphxAI/pdf-reader-mcp/ci.yml?style=flat-square&label=CI)](https://github.com/SylphxAI/pdf-reader-mcp/actions/workflows/ci.yml)

</div>

## What it does

`@sylphx/pdf-reader-mcp` turns PDFs into agent-usable evidence:

- Text and structure with page numbers and locations
- Tables with cells and geometry
- Search with snippets and page hits
- Document map / AST for headings, lists, figures, reading order
- OCR for scanned pages
- Forms, annotations, attachments
- Trust / accessibility signals when requested
- Crops and renders for visual verification

Version 4 uses a **native Rust engine** on supported platforms, launched by a thin Node wrapper.

## Install

```bash
npm install -g @sylphx/pdf-reader-mcp
```

Pin a version:

```bash
npm install -g @sylphx/pdf-reader-mcp@4.0.2
```

Optional native packages install automatically when available:

| Platform | Package |
| --- | --- |
| macOS arm64 | `@sylphx/pdf-reader-mcp-darwin-arm64` |
| macOS x64 | `@sylphx/pdf-reader-mcp-darwin-x64` |
| Linux x64 | `@sylphx/pdf-reader-mcp-linux-x64-gnu` |
| Linux arm64 | `@sylphx/pdf-reader-mcp-linux-arm64-gnu` |
| Windows x64 | `@sylphx/pdf-reader-mcp-win32-x64-msvc` |

If the matching native package is missing, the server fails closed.

## Quick start

```bash
claude mcp add pdf-reader -- npx @sylphx/pdf-reader-mcp
```

Stdio:

```bash
pdf-reader-mcp
```

HTTP:

```bash
MCP_TRANSPORT=http pdf-reader-mcp
```

## Tools

| Tool | Purpose |
| --- | --- |
| `read_pdf` | Read pages/regions: markdown, tables, OCR, structure, evidence |
| `search_pdf` | Find matches with page + snippet context |
| `pdf_evidence` | Inspect evidence, crops, renders, related operations |

Minimal `read_pdf` call:

```json
{
  "sources": [{ "path": "/absolute/path/to/report.pdf" }]
}
```

## Performance

Current published measurements are **startup-inclusive end-to-end** (spawn server + initialize + one `read_pdf`), not steady-state latency of an already-running server.

On a controlled same-host **linux-x64** run versus `@sylphx/pdf-reader-mcp@3.0.14` for page-1 `include_full_text`:

- Preliminary suite reported large speedups on local fixtures
- Formal product performance admission is being rebuilt with:
  - separate startup vs persistent-server timings
  - stronger semantic outcome checks
  - capability-specific tasks (table/structure/search/geometry)
  - registry-installed exact binaries and durable raw samples

Until that re-admission lands, treat public speed numbers as **preliminary**, not a universal product guarantee.

Details: [performance report](docs/specs/performance/4.0.2-same-host-performance-report.md) · [claims policy](docs/specs/performance/4.0.2-performance-claims-policy.md)

## Docs

- [Comparison / capability overview](docs/comparison/index.md)
- [Capability matrix](docs/specs/pure-rust-capability-matrix.json)
- [Migration / recovery notes](docs/migration.md)
- [ADR-0005](docs/adr/0005-capability-first-semantic-compatibility.md) · [ADR-0006](docs/adr/0006-sole-rust-production-and-channel-authority.md)

## License

MIT
