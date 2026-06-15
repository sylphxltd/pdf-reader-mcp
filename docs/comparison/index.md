# Comparison with Other Solutions

## PDF Reader MCP vs Alternatives

| Feature | PDF Reader MCP | CLI Tools | Cloud APIs | Generic FS MCP |
|---------|---------------|-----------|------------|----------------|
| Text Extraction | ✅ | ✅ | ✅ | ❌ |
| Search With Evidence | ✅ | ⚠️ | ✅ | ❌ |
| Metadata | ✅ | ✅ | ✅ | ❌ |
| Image Extraction | ✅ | ⚠️ | ✅ | ❌ |
| Page Rendering Evidence | ✅ | ⚠️ | ✅ | ❌ |
| Region Crop Evidence | ✅ | ❌ | ✅ | ❌ |
| Configured OCR Text Layer | ✅ | ⚠️ | ✅ | ❌ |
| Page Ranges | ✅ | ⚠️ | ✅ | ❌ |
| Batch Processing | ✅ | ❌ | ✅ | ❌ |
| URL Support | ✅ | ❌ | ✅ | ❌ |
| MCP Native | ✅ | ❌ | ❌ | ✅ |
| Local Processing | ✅ | ✅ | ❌ | ✅ |
| No API Keys | ✅ | ✅ | ❌ | ✅ |
| Structured Output | ✅ | ❌ | ✅ | ❌ |
| Agent Document Map | ✅ | ❌ | ⚠️ | ❌ |

## Detailed Comparison

### CLI Tools (pdftotext, pdfinfo)

**Pros:**
- Can extract text and metadata
- Works locally

**Cons:**
- Requires executing shell commands
- Output needs parsing
- No native MCP integration
- No batch processing
- No image extraction (usually)

### Cloud PDF APIs

**Pros:**
- Rich features (OCR, conversion)
- Structured output

**Cons:**
- Requires API keys and billing
- Data sent to third party
- Network latency
- Not MCP native

### Generic Filesystem MCP

**Pros:**
- Can read files
- MCP native

**Cons:**
- Returns raw binary for PDFs
- No PDF parsing
- No text/metadata extraction
- No image extraction

### PDF Reader MCP

**Pros:**
- Purpose-built for PDF extraction
- MCP native integration
- Local processing (privacy)
- No API keys needed
- Batch processing
- Search with snippets, match offsets, text-item bounding boxes, and provenance
- Image extraction
- Page rendering evidence with bounded PNG image parts
- Region crop evidence for bbox-grounded verification
- Configured local OCR provider pipeline for scanned-page text layers
- URL support
- Structured JSON output
- Agent document maps with linked pages, elements, chunks, layout confidence, safety findings, routing signals, and geometry

**Cons:**
- PDF-specific (not general file access)
- Requires Node.js 22+

## When to Use PDF Reader MCP

- You need AI agents to read PDF content
- Privacy matters (local processing)
- You want simple MCP integration
- You need to process multiple PDFs
- You need to find evidence before reading, rendering, cropping, or citing a PDF region
- You need image extraction
- You need page images for visual verification or OCR routing
- You need focused crops from table, figure, chart, formula, or citation bounding boxes
- You need scanned-page OCR through a local provider without making a cloud API the default path
- You need table quality signals, sparse-cell warnings, or continuation candidates for agent routing
- You need a semantic document AST for page, section, paragraph, list, table, and image traversal
- You need a local trust report before using PDF content as instructions, evidence, or retrieval context
- You want structured, parseable output
- You want agents to navigate PDF evidence through stable references
