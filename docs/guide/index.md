# Introduction

PDF Reader MCP is a Model Context Protocol (MCP) server that enables AI agents to inspect, read, and extract content from PDF files.

## What It Does

AI agents often need to access information from PDF documents - reports, invoices, research papers, manuals, and more. This server provides tools to inspect and extract:

- **PDF profiles** - Detect text-rich, low-text, mixed, or scanned/image-like PDFs before extraction
- **Full text content** - Get all text from a PDF
- **Page-specific text** - Extract text from specific pages or page ranges
- **Metadata** - Author, title, creation date, and other document properties
- **Page count** - Total number of pages
- **Embedded images** - Extract images as base64-encoded PNG data
- **Citation chunks** - Return stable source references for retrieval workflows
- **Safety signals** - Surface deterministic findings before agents trust PDF text

## Key Features

### Multiple Sources
Process PDFs from local files or URLs in a single request. Mix and match sources as needed.

### Batch Processing
Send multiple PDF sources in one request. The server processes them concurrently for optimal performance.

### Flexible Extraction
Choose exactly what data you need - full text, specific pages, metadata only, or everything including images.

### Agent-Native Inspection
Use `inspect_pdf` to sample a PDF, identify extraction risks, and get recommended `read_pdf` arguments before spending context or runtime on heavier extraction.

### Image Extraction
Extract embedded images from PDFs for AI vision analysis. Images are returned as base64-encoded PNG data.

## Supported Clients

- **Claude Desktop** - Add to your `claude_desktop_config.json`
- **Claude Code** - Use `claude mcp add` command
- **Cursor** - Configure in MCP settings
- **Any MCP Client** - Standard MCP protocol over stdio
