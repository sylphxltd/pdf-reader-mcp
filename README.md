<div align="center">

# PDF Reader MCP

**Evidence-first PDF intelligence for AI agents**

Read PDFs with page citations, tables, structure, OCR, and trust signals — not a plain text dump.

[![npm version](https://img.shields.io/npm/v/@sylphx/pdf-reader-mcp?style=flat-square)](https://www.npmjs.com/package/@sylphx/pdf-reader-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](https://opensource.org/licenses/MIT)
[![CI](https://img.shields.io/github/actions/workflow/status/SylphxAI/pdf-reader-mcp/ci.yml?style=flat-square&label=CI)](https://github.com/SylphxAI/pdf-reader-mcp/actions/workflows/ci.yml)

</div>

## What it does

`@sylphx/pdf-reader-mcp` is an MCP server that turns PDFs into agent-usable evidence:

- **Text + structure** with page numbers and locations
- **Tables** with cells and geometry
- **Search** with snippets and page hits
- **Document map / AST** for headings, lists, figures, reading order
- **OCR** for scanned pages
- **Forms, annotations, attachments**
- **Trust / accessibility signals** when requested
- **Crops and renders** for visual verification

Version 4 runs a **native Rust engine** on supported platforms (thin Node launcher only).

## Install

```bash
npm install -g @sylphx/pdf-reader-mcp
```

Or pin a version:

```bash
npm install -g @sylphx/pdf-reader-mcp@4.0.1
```

Supported native packages (installed automatically when available):

- macOS Apple Silicon / Intel
- Linux x64 / arm64 (glibc)
- Windows x64

## Quick start

### Claude Code / Claude Desktop style MCP config

```bash
claude mcp add pdf-reader -- npx @sylphx/pdf-reader-mcp
```

### Stdio

```bash
pdf-reader-mcp
```

### HTTP transport

```bash
MCP_TRANSPORT=http pdf-reader-mcp
```

## Tools

| Tool | Purpose |
| --- | --- |
| `read_pdf` | Read pages/regions; markdown, tables, OCR, structure, evidence |
| `search_pdf` | Find matches with page + snippet context |
| `pdf_evidence` | Inspect evidence, crops, renders, and related operations |

### Minimal `read_pdf` call

```json
{
  "sources": [{ "path": "/absolute/path/to/report.pdf" }]
}
```

Typical result includes page count, extracted content, and citeable locations (page + bounding box) when geometry is available.

## Platforms

| Platform | Package |
| --- | --- |
| macOS arm64 | `@sylphx/pdf-reader-mcp-darwin-arm64` |
| macOS x64 | `@sylphx/pdf-reader-mcp-darwin-x64` |
| Linux x64 | `@sylphx/pdf-reader-mcp-linux-x64-gnu` |
| Linux arm64 | `@sylphx/pdf-reader-mcp-linux-arm64-gnu` |
| Windows x64 | `@sylphx/pdf-reader-mcp-win32-x64-msvc` |

If the matching native package is missing, the server **fails closed** instead of silently switching engines.

## Performance

Controlled same-host benchmarks versus the historical TypeScript baseline are **in progress**.  
Until those results are published, do **not** assume or advertise a specific speedup factor.

## v4 notes

- Public default is the native Rust server via a thin launcher.
- There is no bundled TypeScript PDF engine in the production package.
- Breaking change from 3.x: the `./typescript` export and TypeScript production runtime are removed.
- Historical TypeScript baseline remains available only as the immutable package `@sylphx/pdf-reader-mcp@3.0.14` if you need that exact engine for comparison or recovery.

## Docs

- [Comparison / capability overview](docs/comparison/index.md)
- [Capability matrix](docs/specs/pure-rust-capability-matrix.json)
- [ADR-0005 capability-first compatibility](docs/adr/0005-capability-first-semantic-compatibility.md)
- [ADR-0006 sole-Rust production](docs/adr/0006-sole-rust-production-and-channel-authority.md)
- [Migration / recovery notes](docs/specs/release-closeout-4.0.0.md)

## License

MIT
