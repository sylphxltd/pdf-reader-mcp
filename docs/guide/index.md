# Introduction

PDF Reader MCP is a Model Context Protocol (MCP) server that enables AI agents to inspect, read, and extract content from PDF files.

## What It Does

AI agents often need to access information from PDF documents - reports, invoices, research papers, manuals, and more. This server provides tools to inspect and extract:

- **PDF profiles** - Detect text-rich, low-text, mixed, or scanned/image-like PDFs before extraction
- **PDF search evidence** - Locate literal text matches with snippets, match offsets, character-derived or text-item bounding boxes, and provenance
- **Visual page evidence** - Render selected pages as bounded PNG MCP image parts with provenance
- **Region crop evidence** - Crop PDF-coordinate bounding boxes as focused PNG evidence
- **Visual region analysis** - Send focused crops to a configured local provider and normalize table, chart, formula, figure, and image-description results
- **Configured OCR text layers** - Run selected rendered pages through a local OCR provider and normalize text, confidence, words, language, and provenance
- **Full text content** - Get all text from a PDF
- **PDF text layers** - Return run records, line records, word records, character records, estimated boxes, and provenance
- **Page-specific text** - Extract text from specific pages or page ranges
- **Metadata** - Author, title, creation date, and other document properties
- **Page count** - Total number of pages
- **Embedded images** - Extract images as base64-encoded PNG data
- **Agent document maps** - Link pages, elements, chunks, layout confidence, safety findings, routing signals, and geometry
- **Accessibility reports** - Summarize tagged-PDF coverage, heading roles, images, forms, links, and accessibility permissions
- **Citation chunks** - Return stable source references for retrieval workflows
- **Safety signals** - Surface deterministic findings before agents trust PDF text

## Key Features

### Multiple Sources
Process PDFs from local files or URLs in a single request. Mix and match sources as needed.

### Batch Processing
Send multiple PDF sources in one request. The server processes them concurrently for optimal performance.

### Flexible Extraction
Choose exactly what data you need - visual page evidence, region crops, full text, specific pages, metadata only, an agent document map, or everything including images.

### Agent-Native Inspection
Use `inspect_pdf` to sample a PDF, identify extraction risks, and get recommended `read_pdf` arguments before spending context or runtime on heavier extraction.

### PDF Search
Use `search_pdf` to find relevant pages and source snippets before deciding whether an agent should read, render, crop, or cite a region.

### PDF Text Layer
Use `include_text_layer` when agents need run, line, word, and character records with page-level ranges and estimated bounding boxes.

### Image Extraction
Extract embedded images from PDFs for AI vision analysis. Images are returned as base64-encoded PNG data.

### Page Rendering
Render selected pages as visual evidence for layout inspection, OCR routing, and agent verification. Rendered PNGs are returned as MCP image parts while JSON carries only metadata and provenance.

### Region Cropping
Crop PDF-coordinate bounding boxes into focused visual evidence for tables, figures, charts, formulas, annotations, and citation verification.

### Visual Region Analysis
Analyze focused crops with a configured local provider for visual table recognition, chart-to-data extraction, formula recognition, figure descriptions, and image captions. Provider commands are environment-configured, so request payloads cannot choose arbitrary executables.

### OCR Provider Pipeline
Run selected rendered pages through a configured local OCR command when scanned or sparse pages need a text layer. OCR commands are environment-configured, so request payloads cannot choose arbitrary executables.

### Accessibility Report
Use `include_accessibility_report` when an agent needs page-level accessibility routing for tagged structure, headings, image alt-text verifiability, form labels, link labels, and copy-based accessibility permissions.

## Supported Clients

- **Claude Desktop** - Add to your `claude_desktop_config.json`
- **Claude Code** - Use `claude mcp add` command
- **Cursor** - Configure in MCP settings
- **Any MCP Client** - Standard MCP protocol over stdio
