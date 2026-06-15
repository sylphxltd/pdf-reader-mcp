# Design Philosophy

PDF Reader MCP is built on these core principles:

## 1. Performance First

- **Concurrent Processing** - Multiple PDF sources are processed in parallel
- **Efficient Parsing** - Uses pdfjs-dist for reliable, fast PDF parsing
- **Minimal Overhead** - Direct stdio communication with no HTTP overhead
- **Batch Operations** - Process multiple files in a single request

## 2. Comprehensive Extraction

- **Text Extraction** - Full document or specific pages
- **Agent Document Map** - One navigable contract linking pages, elements, chunks, layout diagnostics, safety findings, routing signals, and page geometry
- **Structured Elements** - Optional agent-ready elements with stable IDs, provenance, and best-effort bounding boxes
- **Semantic Hints** - Optional deterministic heading, list, and paragraph hints on text elements
- **Table Geometry** - Optional table elements include row data, cell metadata, confidence, and best-effort coordinates
- **Markdown Rendering** - Page-aware Markdown for RAG, summarization, and agent context
- **HTML Rendering** - Escaped page-aware HTML for preview, export, and conversion workflows
- **Citation Chunks** - Page, semantic, size, and table chunks with element IDs and best-effort bounding boxes
- **Document Signals** - Outlines, annotations, structure trees, page geometry, form fields, attachment metadata, page labels, permissions, and mark info
- **Content Safety Findings** - Optional deterministic warnings for prompt-injection patterns, tiny text, and off-page text
- **Page Ranges** - Flexible page selection with ranges like "1-5, 10, 15-20"
- **Metadata Access** - Document properties, author, title, dates
- **Image Extraction** - Embedded images as base64-encoded PNG

## 3. Simple Integration

- **Single Tool** - One `read_pdf` tool handles all extraction needs
- **Standard MCP** - Compatible with any MCP client
- **Easy Setup** - One command installation via npx
- **Multiple Clients** - Works with Claude Desktop, Claude Code, Cursor, and more

## 4. Flexible Input

- **Local Files** - Read PDFs from any path on the filesystem
- **Remote URLs** - Download and process PDFs from URLs
- **Mixed Sources** - Combine local and remote files in one request

## 5. Robust Error Handling

- **Graceful Failures** - One failed source doesn't stop others
- **Clear Errors** - Specific error codes and messages
- **Partial Results** - Get results from successful sources even if some fail

## 6. Agent-Ready Output

- **Stable References** - Element IDs and page numbers make downstream citations easier to preserve
- **Document Map** - Pages, elements, chunks, layout diagnostics, safety findings, routing signals, and geometry are linked from one response shape
- **Semantic Hints** - Heading, list, and paragraph hints carry confidence and signals without overstating parser certainty
- **Cell-Level Provenance** - Table cells can carry row/column indexes and coordinates for downstream citation workflows
- **Retrieval-Ready Chunks** - Page, semantic, size, and table chunks carry source references without requiring a separate indexing pass
- **Portable Renderings** - Markdown and HTML renderers support different agent, preview, and export workflows from the same extraction pass
- **Layout Provenance** - Page geometry and best-effort bounding boxes make extracted content easier to trace back to source pages
- **Safety Findings** - Deterministic content warnings help agents treat risky PDF text as data, not instructions
- **Column-Aware Ordering** - Distant same-line text is segmented before ordering to improve common multi-column PDFs
- **Structured JSON First** - Machine-readable summaries come before large text or image parts
- **Binary Discipline** - Image bytes are delivered as MCP image content, not duplicated into JSON summaries
- **Extensible Model** - The response model can grow toward headings, tables, citations, and richer layout without breaking existing callers

## Technical Stack

- **Runtime**: Node.js 22+
- **PDF Parsing**: pdfjs-dist
- **Image Encoding**: pngjs
- **Schema Validation**: @sylphx/vex
- **MCP SDK**: @sylphx/mcp-server-sdk
- **Build Tool**: bunup
