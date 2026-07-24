# Introduction

PDF Reader MCP is a full-fidelity Model Context Protocol (MCP) server that
turns PDFs into agent-readable evidence. It is built around an Agent Document
Twin: text layers, semantic structure, source visuals, region crops, OCR
provenance, tables, citations, trust signals, accessibility signals, and
provider-backed visual enrichments linked through stable IDs.

The production package is **sole-Rust** and local-first. Selectable-text
PDFs, smart routing, search, rendering, crops, document maps, trust reports,
accessibility reports, Markdown/HTML/JSON extraction, and safety signals work
without heavy model downloads. Scanned OCR and visual table/chart/formula/figure
understanding are enabled through configured local providers.

## What It Does

AI agents often need to access information from PDF documents - reports,
invoices, research papers, manuals, and more. This server provides tools to
inspect, verify, enrich, and extract:

- **Smart PDF reads** - `read_pdf` can profile unfamiliar PDFs, choose an extraction route, and return the Agent Document Twin in one response
- **PDF profiles** - Detect text-rich, low-text, mixed, or scanned/image-like PDFs before extraction
- **PDF search evidence** - Locate literal text matches with snippets, match offsets, character-derived or text-item bounding boxes, and provenance
- **Visual page evidence** - Render selected pages as bounded PNG MCP image parts with provenance
- **Region crop evidence** - Crop PDF-coordinate bounding boxes as focused PNG evidence
- **Visual region analysis** - Send focused crops to a configured local provider and normalize table, chart, formula, figure, and image-description results
- **Configured OCR text layers** - Run selected rendered pages through a local OCR provider and normalize text, confidence, words, language, and provenance
- **Agent Document Twin** - Read one linked document map with pages, elements, text-layer coverage, chunks, layout diagnostics, OCR evidence, visual enrichment indexes, trust routing, accessibility routing, and page geometry
- **Full text content** - Get all text from a PDF
- **PDF text layers** - Return direction-aware run records, line records, word records, character records, estimated boxes, provenance, and metadata coverage diagnostics
- **Page-specific text** - Extract text from specific pages or page ranges
- **Metadata** - Author, title, creation date, and other document properties
- **Page count** - Total number of pages
- **Embedded images** - Extract images as base64-encoded PNG data
- **Agent document maps** - Link pages, elements, text-layer and metadata coverage, chunks, layout confidence, safety findings, trust report routing and signal indexes, accessibility report routing and issue indexes, visual evidence routing, and geometry
- **Trust reports** - Summarize page risk, scores, signal counts, redacted evidence snippets, and optional document-map trust signal routing
- **Accessibility reports** - Summarize tagged-PDF coverage, tag-to-visible-content coverage, heading roles, images, forms, links, accessibility permissions, issue summaries, page-grade routing, and optional document-map issue indexes
- **Citation chunks** - Return stable source references for retrieval workflows
- **Safety signals** - Surface deterministic findings before agents trust PDF text

## Key Features

### Multiple Sources
Process PDFs from local files or URLs in a single request. Mix and match sources
as needed, but each source must provide exactly one locator: `path` or `url`.

### Batch Processing
Send multiple PDF sources in one request. The server processes them concurrently for optimal performance.

### Flexible Extraction
Choose exactly what data you need - visual page evidence, region crops, full text, specific pages, metadata only, an agent document map, or everything including images.

### Smart Default Read
Call `read_pdf` with only `sources` when an agent does not know the document
shape. V3 profiles the PDF, chooses a useful extraction route, and returns the
selected arguments with the response so the agent can see what happened.

### PDF Search
Use `search_pdf` to find relevant pages and source snippets before deciding whether an agent should read, render, OCR, crop, or cite a region. OCR-layer search is opt-in so fast selectable-text search stays the default.

### Focused Evidence
Use `pdf_evidence` when the agent needs one specialist operation after reading
or searching: `inspect`, `render_page`, `extract_regions`, `ocr_pages`, or
`analyze_regions`.

### PDF Text Layer
Use `include_text_layer` when agents need direction-aware run, line, word, and character records with page-level ranges, estimated bounding boxes, and metadata coverage counts.

### Image Extraction
Extract embedded images from PDFs for AI vision analysis. Images are returned as base64-encoded PNG data.

### Page Rendering
Render selected pages as visual evidence for layout inspection, OCR routing, and agent verification. Rendered PNGs are returned as MCP image parts while JSON carries only metadata and provenance.

### Region Cropping
Crop PDF-coordinate bounding boxes into focused visual evidence for tables, figures, charts, formulas, annotations, and citation verification.

### Visual Region Analysis
Analyze focused crops with a configured local command or HTTP provider for visual table recognition, chart-to-data extraction, formula recognition, figure descriptions, and image captions. Provider commands and endpoints are environment-configured, so request payloads cannot choose arbitrary executables or URLs. Outputs can preserve rich table cell geometry, formula formats, and chart axes/series.

### OCR Provider Pipeline
Run selected rendered pages through a configured local OCR command when scanned or sparse pages need a text layer. OCR commands are environment-configured, so request payloads cannot choose arbitrary executables.

`read_pdf` can also opt into OCR text layer fusion with `include_ocr_text_layer`, keeping external OCR text separate from selectable PDF text while linking it into the agent document map. When `include_tables` is enabled, OCR word boxes can also produce OCR-derived table structure for scanned pages.

### Accessibility Report
Use `include_accessibility_report` when an agent needs page-level accessibility routing for tagged structure, tag-to-visible-content coverage, headings, image alt-text verifiability, form labels, link labels, copy-based accessibility permissions, issue summaries, and page-grade buckets.

## Supported Clients

- **Claude Desktop** - Add to your `claude_desktop_config.json`
- **Claude Code** - Use `claude mcp add` command
- **Cursor** - Configure in MCP settings
- **Any MCP Client** - Standard MCP protocol over stdio
