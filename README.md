<div align="center">

# 📄 @sylphx/pdf-reader-mcp

> Production-ready PDF processing server for AI agents

[![npm version](https://img.shields.io/npm/v/@sylphx/pdf-reader-mcp?style=flat-square)](https://www.npmjs.com/package/@sylphx/pdf-reader-mcp)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](https://opensource.org/licenses/MIT)
[![CI/CD](https://img.shields.io/github/actions/workflow/status/SylphxAI/pdf-reader-mcp/ci.yml?style=flat-square&label=CI/CD)](https://github.com/SylphxAI/pdf-reader-mcp/actions/workflows/ci.yml)
[![codecov](https://img.shields.io/codecov/c/github/SylphxAI/pdf-reader-mcp?style=flat-square)](https://codecov.io/gh/SylphxAI/pdf-reader-mcp)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![Downloads](https://img.shields.io/npm/dm/@sylphx/pdf-reader-mcp?style=flat-square)](https://www.npmjs.com/package/@sylphx/pdf-reader-mcp)

**PDF inspection** • **PDF search** • **Agent document map** • **Accessibility report** • **Visual evidence** • **Region crops** • **Configured OCR**

<a href="https://mseep.ai/app/SylphxAI-pdf-reader-mcp">
<img src="https://mseep.net/pr/SylphxAI-pdf-reader-mcp-badge.png" alt="Security Validated" width="200"/>
</a>

</div>

---

## 🚀 Overview

PDF Reader MCP is a **production-ready** Model Context Protocol server that empowers AI agents with **structured, local-first PDF processing capabilities**. Inspect PDFs before extraction, search text evidence with page and bbox provenance, render page-level visual evidence, crop bbox-grounded page regions, run configured OCR for scanned-page text layers, then extract a full agent document map, accessibility report, text, Markdown, semantic citation chunks, images, tables, annotations, outlines, structure trees, form fields, attachment metadata, and agent-ready document elements with strong performance and reliability.

**The Problem:**
```typescript
// Traditional PDF processing
- Sequential page processing (slow)
- No natural content ordering
- Complex path handling
- Poor error isolation
```

**The Solution:**
```typescript
// PDF Reader MCP
- Preflight PDF inspection for agent extraction planning 🔎
- MCP-native PDF search with snippets and bbox evidence 🔎
- Bounded page rendering for visual evidence and OCR routing 🖼️
- Bbox-grounded region crops for source evidence 🔍
- Configured local OCR provider for scanned-page text layers 🔡
- 5-10x faster parallel processing ⚡
- Full agent document map linking pages, elements, chunks, layout, safety, and geometry 🧭
- Semantic document AST for page/section/paragraph/list/table/image traversal 🌳
- PDF trust report for content safety, layout, table, and link-risk routing 🛡️
- Accessibility report for tagged-PDF coverage, headings, images, forms, links, and permissions ♿
- Structured element output for agent workflows 🧩
- Table quality diagnostics with inferred cell spans and continuation candidates 📊
- Markdown rendering for RAG and summarization 📝
- Citation-ready semantic/table/page chunks 🔗
- Layout diagnostics with reading-order confidence 📐
- Outlines, annotations, structure trees, forms, attachments, labels, and permission signals 🗂️
- Column-aware reading order 📐
- Flexible path support (absolute/relative) 🎯
- Per-page error resilience 🛡️
- CI-backed quality ✅
```

**Result: Production-ready PDF processing that scales.**

---

## ⚡ Key Features

### Performance

- 🚀 **5-10x faster** than sequential with automatic parallelization
- ⚡ **12,933 ops/sec** error handling, 5,575 ops/sec text extraction
- 💨 **Process 50-page PDFs** in seconds with multi-core utilization
- 📦 **TypeScript-first** with performance-bounded local execution

### Developer Experience

- 🎯 **Path Flexibility** - Absolute & relative paths, Windows/Unix support (v1.3.0)
- 🔎 **PDF Inspection** - Profile PDFs before extraction and get recommended `read_pdf` arguments for agent workflows
- 🔎 **PDF Search Evidence** - Search selected PDF pages with snippets, match offsets, text-item bounding boxes, and provenance
- 🖼️ **Visual Page Evidence** - Render selected pages as bounded PNG image parts with JSON provenance and pixel budgets
- 🔍 **Region Crop Evidence** - Crop PDF-coordinate regions as bounded PNG image parts for table, figure, chart, and citation verification
- 🧠 **Visual Region Analysis** - Send focused crops to a configured local provider and normalize table, chart, formula, figure, and image-description results
- 🔡 **Configured OCR Text Layer** - Route rendered pages through an env-configured local OCR command and return normalized text, confidence, words, and provenance
- 🧾 **PDF Text Layer** - Optional line and word records with page-level character ranges, best-effort bounding boxes, and provenance
- 🧭 **Agent Document Map** - Optional page map that links elements, chunks, layout confidence, safety findings, routing signals, and page geometry
- 🌳 **Document AST** - Optional semantic tree with page, section, paragraph, list item, table, and image nodes linked back to evidence IDs
- 🛡️ **Trust Report** - Optional consolidated report for prompt-injection text, hidden/off-page signals, layout uncertainty, sparse pages, table warnings, and external links
- ♿ **Accessibility Report** - Optional deterministic report for tagged-PDF coverage, structure tree availability, heading roles, image alt-text verifiability, form labels, link labels, and accessibility permissions
- 🧩 **Structured Elements** - Optional page-level elements with stable IDs, provenance, and best-effort bounding boxes
- 📊 **Table Intelligence** - Optional table quality metrics, inferred header/span hints, sparse-cell warnings, and repeated-header continuation candidates
- 📐 **Layout Diagnostics** - Optional page profiles, column signals, and reading-order confidence for agent routing
- 📝 **Markdown Rendering** - Optional page-aware Markdown for RAG, summarization, and agent context
- 🔗 **Citation Chunks** - Optional page, semantic, size, and table chunks with element IDs and best-effort bounding boxes
- 🗂️ **Document Signals** - Optional outlines, page labels, annotations, structure trees, forms, attachments, permissions, and mark info
- 🖼️ **Smart Ordering** - Column-aware content ordering improves natural reading flow
- 🛡️ **Type Safe** - Full TypeScript with strict mode enabled
- 📚 **Battle-tested** - Automated tests, strict TypeScript, and CI validation
- 🎨 **Simple API** - `inspect_pdf` plans extraction, `search_pdf` finds text evidence, `render_page` returns visual evidence, `extract_regions` crops source evidence, `analyze_regions` enriches visual regions, `ocr_pages` runs configured OCR, `read_pdf` performs extraction

---

## 📊 Performance Benchmarks

Real-world performance from production testing:

| Operation | Ops/sec | Performance | Use Case |
|-----------|---------|-------------|----------|
| **Error handling** | 12,933 | ⚡⚡⚡⚡⚡ | Validation & safety |
| **Extract full text** | 5,575 | ⚡⚡⚡⚡ | Document analysis |
| **Extract page** | 5,329 | ⚡⚡⚡⚡ | Single page ops |
| **Multiple pages** | 5,242 | ⚡⚡⚡⚡ | Batch processing |
| **Metadata only** | 4,912 | ⚡⚡⚡ | Quick inspection |

### Parallel Processing Speedup

| Document | Sequential | Parallel | Speedup |
|----------|-----------|----------|---------|
| **10-page PDF** | ~2s | ~0.3s | **5-8x faster** |
| **50-page PDF** | ~10s | ~1s | **10x faster** |
| **100+ pages** | ~20s | ~2s | **Linear scaling** with CPU cores |

*Benchmarks vary based on PDF complexity and system resources.*

---

## 📦 Installation

### Claude Code

```bash
claude mcp add pdf-reader -- npx @sylphx/pdf-reader-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pdf-reader": {
      "command": "npx",
      "args": ["@sylphx/pdf-reader-mcp"]
    }
  }
}
```

<details>
<summary><strong>📍 Config file locations</strong></summary>

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

</details>

### VS Code

```bash
code --add-mcp '{"name":"pdf-reader","command":"npx","args":["@sylphx/pdf-reader-mcp"]}'
```

### Cursor

1. Open **Settings** → **MCP** → **Add new MCP Server**
2. Select **Command** type
3. Enter: `npx @sylphx/pdf-reader-mcp`

### Windsurf

Add to your Windsurf MCP config:

```json
{
  "mcpServers": {
    "pdf-reader": {
      "command": "npx",
      "args": ["@sylphx/pdf-reader-mcp"]
    }
  }
}
```

### Cline

Add to Cline's MCP settings:

```json
{
  "mcpServers": {
    "pdf-reader": {
      "command": "npx",
      "args": ["@sylphx/pdf-reader-mcp"]
    }
  }
}
```

### Warp

1. Go to **Settings** → **AI** → **Manage MCP Servers** → **Add**
2. Command: `npx`, Args: `@sylphx/pdf-reader-mcp`

### Ontheia

Add the server in **Settings** → **MCP Servers** → **Add Server** with command `npx` and args `@sylphx/pdf-reader-mcp`. See [Ontheia's compatible MCP servers](https://docs.ontheia.ai/getting-started/03_compatible-mcp-servers/) for the full list.

### Smithery (One-click)

```bash
npx -y @smithery/cli install @sylphx/pdf-reader-mcp --client claude
```

### Manual Installation

```bash
# Quick start - zero installation
npx @sylphx/pdf-reader-mcp

# Or install globally
npm install -g @sylphx/pdf-reader-mcp
```

---

## 🎯 Quick Start

### Inspect Before Extraction

Use `inspect_pdf` when an agent needs to decide how to process an unfamiliar
PDF. It samples a bounded number of pages, detects selectable-text versus
image-like pages, surfaces document signals, and recommends useful `read_pdf`
arguments without extracting image bytes.

```json
{
  "sources": [{
    "path": "documents/report.pdf"
  }],
  "sample_pages": 5,
  "include_metadata": true
}
```

**Result:**
- PDF profile such as `digital_text`, `scanned_or_image_only`, or `mixed_text_and_scan`
- Page-level text density, token estimates, and image paint-operation counts
- Signals for outlines, page labels, forms, attachments, permissions, and structure trees
- Recommended `read_pdf` arguments for citation chunks, safety findings, tables, or OCR triage

### Search PDF Evidence

Use `search_pdf` when an agent needs to locate text evidence before deciding
whether to read a whole page, crop a region, or cite a result.

```json
{
  "sources": [{
    "path": "documents/report.pdf",
    "pages": "1-20"
  }],
  "query": "risk controls",
  "whole_word": true,
  "max_matches_per_source": 10
}
```

**Response includes:**
- A JSON summary with `profile: "pdf_search_results"` and effective search options
- Page numbers, snippets, match offsets, and text-item indexes
- Best-effort text-item bounding boxes when coordinates are available
- Per-match provenance so agents can route hits into `render_page` or `extract_regions`
- Bounded defaults: `max_pages` default 100 and `max_matches_per_source` default 50

### Basic Usage

```json
{
  "sources": [{
    "path": "documents/report.pdf"
  }],
  "include_full_text": true,
  "include_metadata": true,
  "include_page_count": true
}
```

**Result:**
- ✅ Full text content extracted
- ✅ PDF metadata (author, title, dates)
- ✅ Total page count
- ✅ Structured JSON summary for agent workflows

### Extract Specific Pages

```json
{
  "sources": [{
    "path": "documents/manual.pdf",
    "pages": "1-5,10,15-20"
  }],
  "include_full_text": true
}
```

### Structured Elements for Agents

```json
{
  "sources": [{
    "path": "documents/report.pdf",
    "pages": "1-3"
  }],
  "include_elements": true,
  "include_metadata": true,
  "include_page_count": true
}
```

**Response includes:**
- Stable element IDs such as `p1-text-1`
- Page numbers and provenance for each element
- Best-effort bounding boxes when coordinates are available
- Text, image metadata, and table elements without embedding image bytes in the JSON summary
- Table elements include best-effort table and cell bounding boxes, quality metrics, header/span hints, and continuation candidates when coordinates are available

### Agent Document Map

Use `include_document_map` when an agent needs one navigable PDF structure
instead of separate page, element, chunk, layout, and safety outputs.

```json
{
  "sources": [{
    "path": "documents/report.pdf",
    "pages": "1-5"
  }],
  "include_document_map": true,
  "include_full_text": false
}
```

**Response includes:**
- Page records with element IDs, chunk IDs, safety finding indexes, text density, image count, table count, and page geometry
- Semantic elements and citation chunks derived from the same stable IDs
- Layout diagnostics and routing signals for low-confidence, sparse, and OCR-needed pages
- Safety findings linked back to page and element evidence
- No embedded image bytes inside the JSON document map

### Document AST

Use `include_document_ast` when an agent needs a navigable semantic tree rather
than reconstructing document structure from flat text items.

```json
{
  "sources": [{
    "path": "documents/report.pdf",
    "pages": "1-5"
  }],
  "include_document_ast": true,
  "include_full_text": false
}
```

**Response includes:**
- A `document_ast` root with page, section, paragraph, list item, table, and image nodes
- Node-level `element_ids`, `chunk_ids`, bounding boxes, confidence, and semantic roles where available
- Table nodes with rows, quality diagnostics, and continuation candidates when tables are detected
- No forced top-level `elements`, `chunks`, or `tables` output unless those options are requested

### Text Layer

Use `include_text_layer` when an agent needs deterministic line and word
references instead of only full text. It exposes page text, line records, word
records, page-level character ranges, best-effort bounding boxes, and
provenance from the same extracted text-content pass.

```json
{
  "sources": [{
    "path": "documents/report.pdf",
    "pages": "1-5"
  }],
  "include_text_layer": true,
  "include_full_text": false
}
```

**Response includes:**
- A `text_layer` object with one page record per selected page
- Line IDs, line text, page-level `char_start`/`char_end`, and line bounding boxes when available
- Word text, page-level character ranges, and estimated word boxes when the line has geometry
- Summary counts for pages, lines, words, characters, and bbox coverage
- No forced `full_text` or raw `page_contents` output

### Trust Report

Use `include_trust_report` when an agent needs one local risk summary before
using extracted PDF content as instructions, evidence, or retrieval context.

```json
{
  "sources": [{
    "path": "documents/report.pdf",
    "pages": "1-5"
  }],
  "include_trust_report": true,
  "include_full_text": false
}
```

**Response includes:**
- Document and page-level risk scores
- Content safety, layout uncertainty, sparse/scanned-page, table quality, and external-link signals
- Guidance for when to verify with OCR, page rendering, or region crops
- No forced top-level safety, layout, annotation, or table outputs unless those options are requested

### Accessibility Report

Use `include_accessibility_report` when an agent needs a deterministic view of
tagged-PDF and accessibility-relevant structure before relying on the document
for navigation, form filling, summarization, or assisted reading workflows.

```json
{
  "sources": [{
    "path": "documents/report.pdf",
    "pages": "1-5"
  }],
  "include_accessibility_report": true,
  "include_full_text": false
}
```

**Response includes:**
- Document and page-level accessibility scores and grades
- Tagged-page coverage, structure role counts, heading counts, image counts, link counts, and form field counts
- Issues for missing mark info, untagged pages, suspect tags, image alt-text verifiability, weak form labels, weak link labels, and missing `copy_for_accessibility`
- Guidance for when agents should verify semantics with source files, rendering, or region crops
- No forced top-level permissions, mark info, annotations, form fields, or structure trees unless those options are requested

### Render Page Evidence

Use `render_page` when an agent needs to inspect the original page image,
prepare OCR routing, or verify visual layout without stuffing base64 into JSON.

```json
{
  "sources": [{
    "path": "documents/report.pdf",
    "pages": "1-2"
  }],
  "scale": 2,
  "max_pages": 2
}
```

**Response includes:**
- A JSON summary with page number, render scale, pixel count, byte length, evidence ID, and provenance
- PNG pages as MCP image content parts when `include_image` is true
- Bounded defaults: first page by default, `max_pages` default 5, and `max_pixels_per_page` default 16MP
- No rendered page base64 duplicated inside the first JSON content part

### Extract Region Evidence

Use `extract_regions` when an agent has a table, figure, chart, formula, or
citation bounding box and needs a focused crop from the original page.

```json
{
  "sources": [{
    "path": "documents/report.pdf",
    "regions": [{
      "id": "table-1",
      "page": 1,
      "bounding_box": { "left": 72, "bottom": 420, "right": 540, "top": 620 },
      "padding": 8
    }]
  }],
  "scale": 2,
  "max_regions": 20
}
```

**Response includes:**
- A JSON summary with region ID, source bounding box, crop pixel bounds, evidence ID, and provenance
- PNG region crops as MCP image content parts when `include_image` is true
- Bounded defaults: `max_regions` default 20 and `max_pixels_per_page` default 16MP
- No cropped image base64 duplicated inside the first JSON content part

### Analyze Visual Regions

Use `analyze_regions` when an agent has a crop target for a table, chart,
formula, figure, or image and wants a normalized local-provider result linked
back to source pixels. The provider is configured by environment variables, not
by request arguments.

```json
{
  "sources": [{
    "path": "documents/report.pdf",
    "regions": [{
      "id": "chart-1",
      "page": 2,
      "bounding_box": { "left": 72, "bottom": 240, "right": 540, "top": 520 },
      "padding": 8
    }]
  }],
  "scale": 2,
  "max_regions": 10,
  "languages": ["eng"]
}
```

**Response includes:**
- A JSON summary with `profile: "region_analysis"` and the effective analysis options
- Region-level `kind`, description, text, Markdown, confidence, normalized table rows, formula fields, chart data points, warnings, and provenance when supplied by the provider
- `source_crop_evidence_id`, source bounding box, crop pixel bounds, and scale for every analyzed region
- Bounded defaults: `max_regions` default 20, `max_pixels_per_page` default 16MP, and `timeout_ms` default 60 seconds per region
- No cropped image base64 duplicated inside the JSON response

### OCR Selected Pages

Use `ocr_pages` after `inspect_pdf` flags scanned or sparse pages, or when an
agent needs a text layer from pages that have little selectable text. The
server renders bounded page images and passes each temporary PNG to the
configured local OCR command.

```json
{
  "sources": [{
    "path": "documents/scanned-report.pdf",
    "pages": "1-3"
  }],
  "scale": 2,
  "max_pages": 3,
  "languages": ["eng"]
}
```

**Response includes:**
- A JSON summary with `profile: "ocr_text_layer"` and the effective OCR options
- Page-level OCR text, confidence, optional word bounding boxes, language, and provenance
- `source_render_evidence_id` linking each OCR page back to the page render used as OCR input
- Bounded defaults: `max_pages` default 5, `max_pixels_per_page` default 16MP, and `timeout_ms` default 60 seconds per page
- No rendered image base64 duplicated inside the JSON response

### Markdown for RAG and Summaries

```json
{
  "sources": [{
    "path": "documents/report.pdf",
    "pages": "1-5"
  }],
  "include_markdown": true,
  "include_full_text": false
}
```

**Response includes:**
- Page-aware Markdown sections
- Text blocks in extraction order
- Image placeholders with dimensions when images are requested
- Extracted tables appended as Markdown when `include_tables` is enabled

### Citation-Ready Chunks

```json
{
  "sources": [{
    "path": "documents/report.pdf",
    "pages": "1-5"
  }],
  "include_chunks": true,
  "include_semantic_hints": true,
  "include_tables": true,
  "include_full_text": false
}
```

**Response includes:**
- Stable chunk IDs such as `p1-chunk-1`
- Page ranges for each chunk
- Chunk strategies such as `page`, `semantic`, `size`, and `table`
- Semantic headings when heading boundaries are available
- Element IDs that map back to structured elements
- Best-effort bounding boxes for source highlighting

### Outlines, Forms, Attachments, and Document Signals

```json
{
  "sources": [{
    "path": "documents/spec.pdf",
    "pages": "1-5"
  }],
  "include_outline": true,
  "include_annotations": true,
  "include_page_labels": true,
  "include_permissions": true,
  "include_structure_tree": true,
  "include_form_fields": true,
  "include_attachments": true
}
```

**Response includes, when available:**
- Bookmark/outline trees
- Page labels such as roman numerals or section labels
- Link and note annotation summaries with bounding boxes
- Tagged PDF structure trees for selected pages when available
- Form field summaries with values, field types, and bounding boxes when available
- Embedded attachment metadata without returning attachment bytes
- Permission labels and marking signals

### Absolute Paths (v1.3.0+)

```json
// Windows - Both formats work!
{
  "sources": [{
    "path": "C:\\Users\\John\\Documents\\report.pdf"
  }],
  "include_full_text": true
}

// Unix/Mac
{
  "sources": [{
    "path": "/home/user/documents/contract.pdf"
  }],
  "include_full_text": true
}
```

**No more** `"Absolute paths are not allowed"` **errors!**

### Extract Images with Natural Ordering

```json
{
  "sources": [{
    "path": "presentation.pdf",
    "pages": [1, 2, 3]
  }],
  "include_images": true,
  "include_full_text": true
}
```

**Response includes:**
- Text and images in **Y-coordinate reading order**
- Base64-encoded images with metadata (width, height, format)
- Natural reading flow preserved for AI comprehension

### Batch Processing

```json
{
  "sources": [
    { "path": "C:\\Reports\\Q1.pdf", "pages": "1-10" },
    { "path": "/home/user/Q2.pdf", "pages": "1-10" },
    { "url": "https://example.com/Q3.pdf" }
  ],
  "include_full_text": true
}
```

⚡ **All PDFs processed in parallel automatically!**

---

## ✨ Features

### Core Capabilities
- ✅ **PDF Inspection** - Profile PDFs before extraction, detect low-text/scanned pages, and recommend `read_pdf` options
- ✅ **Text Extraction** - Full document or specific pages with intelligent parsing
- ✅ **PDF Search Evidence** - Literal search with page numbers, snippets, match offsets, text-item bounding boxes, and provenance
- ✅ **Image Extraction** - Base64-encoded with complete metadata (width, height, format)
- ✅ **Agent Document Map** - Pages, elements, chunks, layout diagnostics, safety findings, routing signals, and geometry in one contract
- ✅ **Document AST** - Semantic tree for page, section, paragraph, list item, table, and image traversal
- ✅ **Trust Report** - Local risk routing for content safety, layout uncertainty, table quality, sparse pages, and external links
- ✅ **Accessibility Report** - Tagged-PDF coverage, structure tree, heading, image, form, link, and permission signals
- ✅ **PDF Text Layer** - Line records, word records, character ranges, best-effort bounding boxes, and provenance
- ✅ **Configured OCR Text Layer** - Optional command-provider OCR over rendered pages, with normalized text, confidence, words, language, and provenance
- ✅ **Structured Elements** - Agent-ready elements with stable IDs, provenance, and best-effort bounding boxes
- ✅ **Markdown Output** - Page-aware Markdown for RAG, summaries, and context preparation
- ✅ **Citation Chunks** - Page, semantic, size, and table chunks with source references for downstream retrieval
- ✅ **Document Signals** - Outlines, annotations, structure trees, forms, attachments, page labels, permissions, and mark info when exposed by the PDF
- ✅ **Content Ordering** - Column-aware layout preservation for natural reading flow
- ✅ **Metadata Extraction** - Author, title, creation date, and custom properties
- ✅ **Page Counting** - Fast enumeration without loading full content
- ✅ **Dual Sources** - Local files (absolute or relative paths) and HTTP/HTTPS URLs
- ✅ **Batch Processing** - Multiple PDFs processed concurrently

### Advanced Features
- ⚡ **5-10x Performance** - Parallel page processing with Promise.all
- 🎯 **Smart Pagination** - Extract ranges like "1-5,10-15,20"
- 🖼️ **Multi-Format Images** - RGB, RGBA, Grayscale with automatic detection
- 🛡️ **Path Flexibility** - Windows, Unix, and relative paths all supported (v1.3.0)
- 🔍 **Error Resilience** - Per-page error isolation with detailed messages
- 📏 **Large File Support** - Efficient streaming and memory management
- 📝 **Type Safe** - Full TypeScript with strict mode enabled

---

## 🆕 Latest Improvements

### Agent Document Map

`include_document_map` returns a single agent-ready map that links pages,
structured elements, citation chunks, layout diagnostics, content safety
findings, routing signals, and page geometry. It is designed for agents that
need to navigate the original PDF evidence without manually stitching together
separate response fields.

The map is performance-bounded: it reuses the same extraction path, keeps image
bytes out of JSON, and provides page-level routing signals such as
low-confidence pages and pages that likely need OCR.

### Accessibility Report

`include_accessibility_report` returns a deterministic report for tagged-PDF
coverage, page structure trees, heading roles, image alt-text verifiability,
form field labels, link labels, mark info, and `copy_for_accessibility`
permissions. It gives agents routing guidance without claiming PDF/UA
certification or forcing raw structure outputs into top-level JSON.

### Configured OCR Text Layer

`ocr_pages` renders selected PDF pages and sends those temporary PNGs to a
local OCR command configured by environment variables. This keeps the default
TypeScript package private and dependency-bounded while giving teams a real
scanned PDF path when they already run Tesseract, PaddleOCR, a local HTTP shim,
or an internal OCR binary. `MCP_PDF_OCR_PRESET=tesseract` provides a built-in
Tesseract command template without bundling an OCR model.

The OCR provider is env-only, not request-controlled. Tool responses normalize
provider output into page text, confidence, optional word boxes, language,
render evidence IDs, and provenance. Image bytes are not embedded in the JSON
response.

### Agent-Native PDF Inspection

`inspect_pdf` adds a bounded planning tool for agent workflows. It samples
up to 20 pages per source, counts selectable text and image paint operations,
surfaces document-level signals, and returns a recommendation with the next
best `read_pdf` arguments.

Inspection is intentionally low overhead: it does not decode image bytes and it
does not perform OCR. When sampled pages look scanned or image-only, the tool
marks `needs_ocr: true` so agents do not mistake an image-based PDF for a text
extraction failure. It also reports safe optional-provider readiness for
`ocr_pages` and `analyze_regions` without exposing local command paths.

### Layout Confidence for Agent Routing

`include_layout_diagnostics` adds deterministic page-level signals for layout
profile, reading-order model, confidence, column count, positioned item ratio,
and warnings. This helps agents decide when local extraction is safe for RAG and
when a page should be routed to a heavier parser, OCR/vision workflow, or human
review.

### Agent-Ready Structured Output

`include_elements` adds structured document elements to the JSON response while keeping the existing text, metadata, image, and table outputs backward compatible.

```json
{
  "sources": [{ "path": "report.pdf" }],
  "include_elements": true,
  "include_semantic_hints": true
}
```

Elements include stable IDs, page numbers, provenance, and best-effort bounding boxes where available. Image bytes stay out of the JSON summary so MCP clients can keep context payloads manageable.

`include_semantic_hints` adds deterministic heading/list/paragraph hints to text elements, with confidence and signals, without claiming a full semantic parser.

`include_markdown` adds page-aware Markdown for workflows that need clean text context without manually rebuilding sections from raw page text.

`include_html` adds an escaped HTML rendering for previews, export workflows, and downstream conversion.

The extraction pipeline also separates distant same-line text into independent segments before ordering, which improves multi-column PDFs without requiring any extra configuration.

`include_chunks` adds citation-ready chunks with stable IDs, strategy labels, element references, and best-effort bounding boxes for downstream retrieval and citation workflows. When `include_semantic_hints` is also enabled, chunks split on deterministic heading boundaries; table chunks are emitted when table extraction is requested.

`include_outline`, `include_annotations`, `include_page_labels`, `include_page_geometry`, `include_permissions`, `include_structure_tree`, `include_form_fields`, and `include_attachments` expose additional document signals without changing the default response shape.

`include_safety_findings` adds deterministic findings for common prompt-injection patterns, tiny text, and off-page text so agents can inspect risky document content before using it as instructions.

### Absolute Paths Supported

```json
// ✅ Windows
{ "path": "C:\\Users\\John\\Documents\\report.pdf" }
{ "path": "C:/Users/John/Documents/report.pdf" }

// ✅ Unix/Mac
{ "path": "/home/john/documents/report.pdf" }
{ "path": "/Users/john/Documents/report.pdf" }

// ✅ Relative (still works)
{ "path": "documents/report.pdf" }
```

**Other Improvements:**
- 🛡️ Filesystem and HTTP access restrictions for safer deployments
- 📊 Table extraction with Markdown output
- 📦 Updated parser resources for CMaps, fonts, WASM decoders, and color profiles

<details>
<summary><strong>📋 View Full Changelog</strong></summary>

<br/>

**v1.2.0 - Content Ordering**
- Y-coordinate based text and image ordering
- Natural reading flow for AI models
- Intelligent line grouping

**v1.1.0 - Image Extraction & Performance**
- Base64-encoded image extraction
- 10x speedup with parallel processing
- Comprehensive test coverage

[View Full Changelog →](./CHANGELOG.md)

</details>

---

## 📖 API Reference

### `inspect_pdf` Tool

Plan PDF extraction before running a heavier read. This is useful for agents
that need to choose between metadata review, citation-ready extraction, mixed
PDF handling, or OCR-capable workflows.

#### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `sources` | Array | List of PDF sources to inspect | Required |
| `sample_pages` | number | Maximum pages to sample per source, capped at 20 | `5` |
| `include_metadata` | boolean | Include PDF metadata and info objects | `true` |

#### Response Fields

| Field | Description |
|-------|-------------|
| `profile` | `digital_text`, `scanned_or_image_only`, `mixed_text_and_scan`, `low_text_or_form`, or `unknown` |
| `sampled_pages` | Pages used for the bounded inspection sample |
| `page_signals` | Text chars, text items, token estimate, image paint operations, and scan/low-text flags |
| `document_signals` | Outline, labels, permissions, forms, attachments, and structure-tree availability |
| `recommendation` | Suggested workflow, OCR need, reason, and ready-to-use `read_pdf` arguments |
| `provider_status` | Safe readiness metadata for optional `ocr_pages` and `analyze_regions` providers without command paths |

### `render_page` Tool

Render selected pages as PNG visual evidence. This gives agents a page image
they can inspect or route to OCR/vision workflows while keeping binary content
out of the JSON summary.

#### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `sources` | Array | List of PDF sources to render | Required |
| `scale` | number | Render scale relative to PDF points, from 0.25 to 4 | `2` |
| `max_pages` | number | Maximum pages to render per source, capped at 20 | `5` |
| `max_pixels_per_page` | number | Maximum rendered pixels per page, capped at 64MP | `16000000` |
| `include_image` | boolean | Return PNG pages as MCP image parts | `true` |

#### Example

```json
{
  "sources": [{ "path": "report.pdf", "pages": "1-2" }],
  "scale": 2,
  "max_pages": 2
}
```

The first content part is JSON metadata with `profile: "page_render_evidence"`.
Rendered PNG data is returned as subsequent MCP image parts and referenced by
`image_content_index`.

### `search_pdf` Tool

Search extracted PDF text using bounded literal matching and return evidence
that agents can cite or route into visual tools.

#### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `sources` | Array | List of PDF sources to search | Required |
| `query` | string | Literal text query to search for | Required |
| `case_sensitive` | boolean | Use case-sensitive matching | `false` |
| `whole_word` | boolean | Match only whole words using ASCII word boundaries | `false` |
| `max_pages` | number | Maximum pages to search per source, capped at 1000 | `100` |
| `max_matches_per_source` | number | Maximum matches returned per source, capped at 500 | `50` |
| `context_chars` | number | Context characters around each match, capped at 1000 | `120` |

#### Example

```json
{
  "sources": [{ "path": "report.pdf", "pages": "1-20" }],
  "query": "risk controls",
  "whole_word": true,
  "max_matches_per_source": 10
}
```

The first content part is JSON metadata with `profile: "pdf_search_results"`.
Matches include page number, matched text, snippet, match offsets, text-item
index, optional text-item bounding box, and provenance. Search uses literal
matching only; request payloads do not accept arbitrary regular expressions.

### `extract_regions` Tool

Crop selected PDF-coordinate page regions as PNG visual evidence. This is useful
when an agent has bounding boxes from the document map, table detector, or
downstream layout workflow and needs focused source evidence.

#### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `sources` | Array | List of PDF sources with `regions` to crop | Required |
| `scale` | number | Render scale used before cropping, from 0.25 to 4 | `2` |
| `max_regions` | number | Maximum regions to crop per source, capped at 100 | `20` |
| `max_pixels_per_page` | number | Maximum rendered pixels per page before cropping, capped at 64MP | `16000000` |
| `include_image` | boolean | Return cropped regions as MCP image parts | `true` |

Each region uses PDF coordinates:

```json
{
  "id": "figure-1",
  "page": 1,
  "bounding_box": { "left": 72, "bottom": 420, "right": 540, "top": 620 },
  "padding": 8
}
```

The first content part is JSON metadata with `profile:
"region_crop_evidence"`. Cropped PNG data is returned as subsequent MCP image
parts and referenced by `image_content_index`.

### `analyze_regions` Tool

Analyze selected PDF-coordinate page regions with a configured local provider.
This is useful for visual table recognition, chart-to-data enrichment, formula
recognition, figure descriptions, and image captions while keeping every result
linked to a crop evidence ID.

#### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `sources` | Array | List of PDF sources with `regions` to analyze | Required |
| `scale` | number | Render scale used before cropping and analysis, from 0.25 to 4 | `2` |
| `max_regions` | number | Maximum regions to analyze per source, capped at 100 | `20` |
| `max_pixels_per_page` | number | Maximum rendered pixels per page before cropping, capped at 64MP | `16000000` |
| `timeout_ms` | number | Timeout per analyzed region in milliseconds, capped at 300000 | `60000` |
| `max_output_chars` | number | Maximum provider output characters returned per region | `200000` |
| `languages` | string[] | Optional language tags passed to the configured provider | - |

#### Provider Configuration

| Variable | Description |
|----------|-------------|
| `MCP_PDF_REGION_ANALYSIS_COMMAND` | Absolute or PATH-resolved command used for visual region analysis. Required to enable `analyze_regions`. |
| `MCP_PDF_REGION_ANALYSIS_ARGS_JSON` | Optional JSON string array of command arguments. Must include `{input}` and may also use `{page}`, `{source}`, `{region_id}`, `{evidence_id}`, `{left}`, `{bottom}`, `{right}`, `{top}`, `{language}`, and `{languages}` placeholders. Defaults to `["{input}"]`. |

Provider stdout may be plain text or JSON:

```json
{
  "kind": "table",
  "description": "Quarterly revenue table",
  "text": "Q1 revenue...",
  "markdown": "| Quarter | Revenue |",
  "confidence": 0.91,
  "table": {
    "rows": [["Quarter", "Revenue"], ["Q1", "$1.2M"]],
    "confidence": 0.9
  },
  "formula": {
    "latex": "E = mc^2",
    "confidence": 0.82
  },
  "chart": {
    "title": "Revenue by quarter",
    "summary": "Revenue rises across the period.",
    "data_points": [{ "label": "Q1", "value": 1.2 }],
    "confidence": 0.78
  },
  "warnings": ["Low contrast axis labels"]
}
```

The first content part is JSON metadata with `profile: "region_analysis"`.
Each analysis includes `source_crop_evidence_id`, source bounding box, crop
pixel bounds, scale, provider, provenance, and normalized fields supplied by
the local provider. The request cannot select an executable.

### `ocr_pages` Tool

Run selected rendered pages through a configured local OCR provider and return
a normalized OCR text layer. The provider is configured through environment
variables so an MCP request cannot choose arbitrary commands.

#### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `sources` | Array | List of PDF sources to OCR | Required |
| `scale` | number | Render scale used before OCR, from 0.25 to 4 | `2` |
| `max_pages` | number | Maximum pages to OCR per source, capped at 20 | `5` |
| `max_pixels_per_page` | number | Maximum rendered pixels per page before OCR, capped at 64MP | `16000000` |
| `timeout_ms` | number | Timeout per OCR page in milliseconds, capped at 300000 | `60000` |
| `max_output_chars` | number | Maximum OCR text characters returned per page | `200000` |
| `languages` | string[] | Optional OCR language tags passed to the configured provider | - |

#### Provider Configuration

| Variable | Description |
|----------|-------------|
| `MCP_PDF_OCR_PRESET` | Optional built-in command template. Supported value: `tesseract`. |
| `MCP_PDF_OCR_COMMAND` | Absolute or PATH-resolved command used for OCR. Required unless `MCP_PDF_OCR_PRESET` is set. Overrides the preset command when both are set. |
| `MCP_PDF_OCR_ARGS_JSON` | Optional JSON string array of command arguments. Must include `{input}` and may also use `{page}`, `{source}`, `{language}`, `{languages}`, and `{languages_tesseract}` placeholders. Defaults to the preset template or `["{input}"]`. |

Provider stdout may be plain text or JSON:

```json
{
  "text": "Recognized text",
  "confidence": 0.93,
  "language": "eng",
  "words": [{
    "text": "Recognized",
    "confidence": 0.95,
    "bounding_box": { "left": 10, "bottom": 20, "right": 90, "top": 40 }
  }]
}
```

The first content part is JSON metadata with `profile: "ocr_text_layer"`.
OCR results reference the render evidence ID used to create each temporary page
image. The default package does not bundle an OCR model or call a cloud OCR
service.

### `read_pdf` Tool

The extraction tool that handles PDF content, structure, citations, images,
tables, and document signals.

#### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `sources` | Array | List of PDF sources to process | Required |
| `include_full_text` | boolean | Extract full text content | `false` |
| `include_metadata` | boolean | Extract PDF metadata | `true` |
| `include_page_count` | boolean | Include total page count | `true` |
| `include_images` | boolean | Extract embedded images | `false` |
| `include_tables` | boolean | Detect tables with rows, cell metadata, confidence, quality diagnostics, inferred spans, continuation candidates, and best-effort geometry | `false` |
| `include_document_map` | boolean | Include an agent document map that links pages, elements, chunks, layout diagnostics, safety findings, routing signals, and page geometry | `false` |
| `include_document_ast` | boolean | Include a semantic document AST with page, section, paragraph, list item, table, and image nodes linked to element/chunk evidence | `false` |
| `include_trust_report` | boolean | Include a consolidated trust report for content safety, layout uncertainty, sparse/scanned pages, table quality, and external links | `false` |
| `include_accessibility_report` | boolean | Include a deterministic accessibility report for tagged-PDF coverage, structure trees, headings, images, forms, links, and accessibility permissions | `false` |
| `include_elements` | boolean | Include structured document elements for agent workflows | `false` |
| `include_semantic_hints` | boolean | Include deterministic heading/list/paragraph hints on text elements | `false` |
| `include_markdown` | boolean | Include page-aware Markdown for RAG and summarization | `false` |
| `include_html` | boolean | Include escaped page-aware HTML for preview/export workflows | `false` |
| `include_chunks` | boolean | Include page, semantic, size, and table chunks with source references | `false` |
| `include_text_layer` | boolean | Include line and word records with page-level character ranges, best-effort bounding boxes, and provenance | `false` |
| `include_layout_diagnostics` | boolean | Include page layout profiles, reading-order confidence, column signals, and warnings | `false` |
| `include_outline` | boolean | Include PDF outline/bookmarks when available | `false` |
| `include_annotations` | boolean | Include safe annotation summaries for selected pages | `false` |
| `include_page_labels` | boolean | Include PDF page labels when available | `false` |
| `include_page_geometry` | boolean | Include page viewport geometry and PDF view boxes | `false` |
| `include_permissions` | boolean | Include permission labels and mark info when available | `false` |
| `include_structure_tree` | boolean | Include tagged PDF structure trees for selected pages when available | `false` |
| `include_form_fields` | boolean | Include PDF form field summaries when available | `false` |
| `include_attachments` | boolean | Include embedded attachment metadata without attachment bytes | `false` |
| `include_safety_findings` | boolean | Include deterministic content safety findings for agent workflows | `false` |

#### Source Object

```typescript
{
  path?: string;        // Local file path (absolute or relative)
  url?: string;         // HTTP/HTTPS URL to PDF
  pages?: string | number[];  // Pages to extract: "1-5,10" or [1,2,3]
}
```

#### Examples

**Metadata only (fast):**
```json
{
  "sources": [{ "path": "large.pdf" }],
  "include_metadata": true,
  "include_page_count": true,
  "include_full_text": false
}
```

**From URL:**
```json
{
  "sources": [{
    "url": "https://arxiv.org/pdf/2301.00001.pdf"
  }],
  "include_full_text": true
}
```

**Page ranges:**
```json
{
  "sources": [{
    "path": "manual.pdf",
    "pages": "1-5,10-15,20"  // Pages 1,2,3,4,5,10,11,12,13,14,15,20
  }]
}
```

**Structured elements:**
```json
{
  "sources": [{ "path": "report.pdf", "pages": "1-3" }],
  "include_elements": true,
  "include_metadata": true
}
```

Elements are designed for agent workflows that need stable page references, provenance, and best-effort coordinates for citation-ready downstream processing.

**Agent document map:**
```json
{
  "sources": [{ "path": "report.pdf", "pages": "1-5" }],
  "include_document_map": true,
  "include_full_text": false
}
```

The document map is designed for agents that need one navigable structure for
pages, elements, chunks, layout confidence, safety findings, routing signals,
and page geometry without embedding image bytes in JSON.

---

## 🔧 Advanced Usage

<details>
<summary><strong>📐 Column-Aware Content Ordering</strong></summary>

<br/>

Content is returned in natural reading order using Y-coordinates plus deterministic column segmentation:

```
Document Layout:
┌─────────────────────┐
│ [Title]       Y:100 │
│ [Image]       Y:150 │
│ [Text]        Y:400 │
│ [Photo A]     Y:500 │
│ [Photo B]     Y:550 │
└─────────────────────┘

Response Order:
[
  { type: "text", text: "Title..." },
  { type: "image", data: "..." },
  { type: "text", text: "..." },
  { type: "image", data: "..." },
  { type: "image", data: "..." }
]
```

**Benefits:**
- AI understands spatial relationships
- Natural document comprehension
- Perfect for vision-enabled models
- Automatic multi-line text grouping
- Better ordering for common two-column PDFs

</details>

<details>
<summary><strong>🖼️ Image Extraction</strong></summary>

<br/>

**Enable extraction:**
```json
{
  "sources": [{ "path": "manual.pdf" }],
  "include_images": true
}
```

**Response format:**
```json
{
  "images": [{
    "page": 1,
    "index": 0,
    "width": 1920,
    "height": 1080,
    "format": "rgb",
    "data": "base64-encoded-png..."
  }]
}
```

**Supported formats:** RGB, RGBA, Grayscale
**Auto-detected:** JPEG, PNG, and other embedded formats

</details>

<details>
<summary><strong>📂 Path Configuration</strong></summary>

<br/>

**Absolute paths** (v1.3.0+) - Direct file access:
```json
{ "path": "C:\\Users\\John\\file.pdf" }
{ "path": "/home/user/file.pdf" }
```

**Relative paths** - Workspace files:
```json
{ "path": "docs/report.pdf" }
{ "path": "./2024/Q1.pdf" }
```

**Configure working directory:**
```json
{
  "mcpServers": {
    "pdf-reader-mcp": {
      "command": "npx",
      "args": ["@sylphx/pdf-reader-mcp"],
      "cwd": "/path/to/documents"
    }
  }
}
```

</details>

<details>
<summary><strong>📊 Large PDF Strategies</strong></summary>

<br/>

**Strategy 1: Page ranges**
```json
{ "sources": [{ "path": "big.pdf", "pages": "1-20" }] }
```

**Strategy 2: Progressive loading**
```json
// Step 1: Get page count
{ "sources": [{ "path": "big.pdf" }], "include_full_text": false }

// Step 2: Extract sections
{ "sources": [{ "path": "big.pdf", "pages": "50-75" }] }
```

**Strategy 3: Parallel batching**
```json
{
  "sources": [
    { "path": "big.pdf", "pages": "1-50" },
    { "path": "big.pdf", "pages": "51-100" }
  ]
}
```

</details>

---

## 🔒 Security & Sandboxing

By default the server can read any local file the host process can access and fetch any HTTP(S) URL. When running outside a sandbox you should restrict it to a specific working set.

### Restricting filesystem access

Use `--allow-dir` (repeatable) or the `MCP_PDF_ALLOWED_DIRS` env var (`:` or `,` separated). Once set, all `path` sources must resolve inside one of the allowed directories — relative paths, absolute paths, and `..` traversal are all checked after resolution.

```bash
# CLI flags
npx @sylphx/pdf-reader-mcp --allow-dir=/srv/pdfs --allow-dir=/data/reports

# Environment
MCP_PDF_ALLOWED_DIRS="/srv/pdfs:/data/reports" npx @sylphx/pdf-reader-mcp
```

```json
{
  "mcpServers": {
    "pdf-reader": {
      "command": "npx",
      "args": ["@sylphx/pdf-reader-mcp", "--allow-dir=/srv/pdfs"]
    }
  }
}
```

### Disabling or restricting HTTP

```bash
# Block all URL sources
npx @sylphx/pdf-reader-mcp --no-http
MCP_PDF_ALLOW_HTTP=false npx @sylphx/pdf-reader-mcp

# Allowlist hosts (everything else rejected)
npx @sylphx/pdf-reader-mcp --allow-host=cdn.example.com --allow-host=files.internal
MCP_PDF_ALLOWED_HOSTS="cdn.example.com,files.internal" npx @sylphx/pdf-reader-mcp
```

| Setting | CLI flag | Environment variable | Default |
|---------|----------|----------------------|---------|
| Filesystem allowlist | `--allow-dir=<path>` (repeatable) | `MCP_PDF_ALLOWED_DIRS` (`:` or `,` separated) | unrestricted |
| Disable HTTP | `--no-http` | `MCP_PDF_ALLOW_HTTP=false` | enabled |
| HTTP host allowlist | `--allow-host=<host>` (repeatable) | `MCP_PDF_ALLOWED_HOSTS` (`,` separated) | any host |

Denied requests fail fast with an `Access denied` error before any disk read or network call.

---

## 🔧 Troubleshooting

### "Absolute paths are not allowed"

**Solution:** Upgrade to v1.3.0+

```bash
npm update @sylphx/pdf-reader-mcp
```

Restart your MCP client completely.

---

### "File not found"

**Causes:**
- File doesn't exist at path
- Wrong working directory
- Permission issues

**Solutions:**

Use absolute path:
```json
{ "path": "C:\\Full\\Path\\file.pdf" }
```

Or configure `cwd`:
```json
{
  "pdf-reader-mcp": {
    "command": "npx",
    "args": ["@sylphx/pdf-reader-mcp"],
    "cwd": "/path/to/docs"
  }
}
```

---

### "No tools showing up"

**Solution:**

```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install @sylphx/pdf-reader-mcp@latest
```

Restart MCP client completely.

---

## 🌐 HTTP Transport (Remote Access)

By default, PDF Reader MCP uses stdio transport for local use. You can also run it as an HTTP server for remote access from multiple machines.

### Quick Start

```bash
# Run as HTTP server on port 8080
MCP_TRANSPORT=http npx @sylphx/pdf-reader-mcp
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TRANSPORT` | `stdio` | Transport type: `stdio` or `http` |
| `MCP_HTTP_PORT` | `8080` | HTTP server port |
| `MCP_HTTP_HOST` | `0.0.0.0` | HTTP server hostname |
| `MCP_API_KEY` | - | Optional API key for authentication |
| `MCP_PDF_OCR_PRESET` | - | Optional OCR preset. Supported value: `tesseract` |
| `MCP_PDF_OCR_COMMAND` | - | Optional local OCR command used by `ocr_pages` |
| `MCP_PDF_OCR_ARGS_JSON` | `["{input}"]` | Optional JSON string array of OCR command arguments. Must include `{input}`. |
| `MCP_PDF_REGION_ANALYSIS_COMMAND` | - | Optional local visual-region analysis command used by `analyze_regions` |
| `MCP_PDF_REGION_ANALYSIS_ARGS_JSON` | `["{input}"]` | Optional JSON string array of region analysis command arguments. Must include `{input}`. |

### Docker Deployment

```dockerfile
FROM oven/bun:1
WORKDIR /app
RUN bun add @sylphx/pdf-reader-mcp
ENV MCP_TRANSPORT=http
ENV MCP_HTTP_PORT=8080
EXPOSE 8080
CMD ["bun", "node_modules/@sylphx/pdf-reader-mcp/dist/index.js"]
```

### MCP Client Configuration (HTTP)

```json
{
  "servers": {
    "pdf-reader": {
      "type": "http",
      "url": "https://your-server.com/mcp",
      "headers": {
        "X-API-Key": "your-api-key"
      }
    }
  }
}
```

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | JSON-RPC endpoint |
| `/mcp/health` | GET | Health check |

---

## 🏗️ Architecture

### Tech Stack

| Component | Technology |
|:----------|:-----------|
| **Runtime** | Node.js 22+ ESM |
| **PDF Engine** | PDF.js (Mozilla) |
| **Validation** | Vex + JSON Schema |
| **Protocol** | MCP SDK |
| **Language** | TypeScript (strict) |
| **Testing** | Bun test suite |
| **Quality** | Biome (50x faster) |
| **CI/CD** | GitHub Actions |

### Design Principles

- 🔒 **Security First** - Flexible paths with secure defaults
- 🎯 **Simple Interface** - One tool, all operations
- ⚡ **Performance** - Parallel processing, efficient memory
- 🛡️ **Reliability** - Per-page isolation, detailed errors
- 🧪 **Quality** - Automated tests, strict TypeScript, and CI validation
- 📝 **Type Safety** - No `any` types, strict mode
- 🔄 **Backward Compatible** - Smooth upgrades always

---

## 🧪 Development

<details>
<summary><strong>Setup & Scripts</strong></summary>

<br/>

**Prerequisites:**
- Node.js >= 22.13.0 (required by pdfjs-dist v6)
- Bun (this repo uses `bun@1.3.1`)

**Setup:**
```bash
git clone https://github.com/SylphxAI/pdf-reader-mcp.git
cd pdf-reader-mcp
bun install && bun run build
```

**Scripts:**
```bash
bun run build        # Build with bunup
bun test             # Run the test suite
bun run test:cov     # Run coverage
bun run check        # Lint + format
bun run check:fix    # Auto-fix
bun run benchmark    # Reproducible local performance benchmark
```

**Quality:**
- ✅ Automated tests
- ✅ Coverage reporting
- ✅ Strict TypeScript
- ✅ Zero lint errors
- ✅ Strict TypeScript

</details>

<details>
<summary><strong>Contributing</strong></summary>

<br/>

**Quick Start:**
1. Fork repository
2. Create branch: `git checkout -b feature/awesome`
3. Make changes: `bun test`
4. Format: `bun run check:fix`
5. Commit: Use [Conventional Commits](https://www.conventionalcommits.org/)
6. Open PR

**Commit Format:**
```
feat(images): add WebP support
fix(paths): handle UNC paths
docs(readme): update examples
```

See [CONTRIBUTING.md](./CONTRIBUTING.md)

</details>

---

## 📚 Documentation

- 📖 [Full Docs](https://SylphxAI.github.io/pdf-reader-mcp/) - Complete guides
- 🚀 [Getting Started](./docs/guide/getting-started.md) - Quick start
- 📘 [API Reference](./docs/api/README.md) - Detailed API
- 🏗️ [Design](./docs/design/index.md) - Architecture
- ⚡ [Performance](./docs/performance/index.md) - Benchmarks
- 🔍 [Comparison](./docs/comparison/index.md) - vs. alternatives

---

## 🗺️ Roadmap

**✅ Completed**
- [x] Image extraction (v1.1.0)
- [x] 5-10x parallel speedup (v1.1.0)
- [x] Y-coordinate ordering (v1.2.0)
- [x] Absolute paths (v1.3.0)
- [x] Table extraction
- [x] Structured element output
- [x] Semantic document AST
- [x] PDF trust report
- [x] PDF accessibility report
- [x] Table quality diagnostics, inferred cell spans, and continuation candidates
- [x] Markdown rendering
- [x] Citation-ready page, semantic, size, and table chunks
- [x] MCP-native PDF search with snippets and bbox provenance
- [x] Outlines, annotations, structure trees, form fields, attachment metadata, page labels, and permission signals
- [x] Column-aware ordering for common multi-column PDFs
- [x] Layout diagnostics with reading-order confidence
- [x] Configured local OCR provider for scanned-page text layers
- [x] Tesseract OCR provider preset without bundling OCR model assets
- [x] Quality evals for semantic chunks, table ordering, renderers, and safety findings
- [x] Filesystem and HTTP access restrictions

**🚀 Next**
- [ ] Richer semantic layout detection
- [ ] Optional visual table recognizer provider
- [ ] Fixture-backed OCR accuracy benchmarks
- [ ] Optional advanced parser engines
- [ ] 100+ MB streaming
- [ ] Advanced caching

Vote at [Discussions](https://github.com/SylphxAI/pdf-reader-mcp/discussions)

---

## 🏆 Recognition

**Featured on:**
- [Smithery](https://smithery.ai/server/@sylphx/pdf-reader-mcp) - MCP directory
- [Glama](https://glama.ai/mcp/servers/@sylphx/pdf-reader-mcp) - AI marketplace
- [MseeP.ai](https://mseep.ai/app/SylphxAI-pdf-reader-mcp) - Security validated

**Local-first** • **Agent-ready** • **Battle-tested**

---

## 🤝 Support

[![GitHub Issues](https://img.shields.io/github/issues/SylphxAI/pdf-reader-mcp?style=flat-square)](https://github.com/SylphxAI/pdf-reader-mcp/issues)
[![Discord](https://img.shields.io/discord/YOUR_DISCORD_ID?style=flat-square&logo=discord)](https://discord.gg/sylphx)

- 🐛 [Bug Reports](https://github.com/SylphxAI/pdf-reader-mcp/issues)
- 💬 [Discussions](https://github.com/SylphxAI/pdf-reader-mcp/discussions)
- 📖 [Documentation](https://SylphxAI.github.io/pdf-reader-mcp/)
- 📧 [Email](mailto:hi@sylphx.com)

**Show Your Support:**
⭐ Star • 👀 Watch • 🐛 Report bugs • 💡 Suggest features • 🔀 Contribute

---

## 📊 Stats

![Stars](https://img.shields.io/github/stars/SylphxAI/pdf-reader-mcp?style=social)
![Forks](https://img.shields.io/github/forks/SylphxAI/pdf-reader-mcp?style=social)
![Downloads](https://img.shields.io/npm/dm/@sylphx/pdf-reader-mcp)
![Contributors](https://img.shields.io/github/contributors/SylphxAI/pdf-reader-mcp)

**CI-backed quality** • **Structured extraction** • **Production ready**

---

## 📄 License

MIT © [Sylphx](https://sylphx.com)

---

## 🙏 Credits

Built with:
- [PDF.js](https://mozilla.github.io/pdf.js/) - Mozilla PDF engine
- [Bun](https://bun.sh) - Fast JavaScript runtime

Special thanks to the open source community ❤️

## Powered by Sylphx

This project uses the following [@sylphx](https://github.com/SylphxAI) packages:

- [@sylphx/mcp-server-sdk](https://github.com/SylphxAI/mcp-server-sdk) - MCP server framework
- [@sylphx/vex](https://github.com/SylphxAI/vex) - Schema validation
- [@sylphx/biome-config](https://github.com/SylphxAI/biome-config) - Biome configuration
- [@sylphx/tsconfig](https://github.com/SylphxAI/tsconfig) - TypeScript configuration

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=SylphxAI/pdf-reader-mcp&type=Date)](https://star-history.com/#SylphxAI/pdf-reader-mcp&Date)

---

<div align="center">
<sub>Built with ❤️ by <a href="https://github.com/SylphxAI">Sylphx</a></sub>
</div>
