# Installation

## Published stable (required for production)

Install from **npm**. Published stable is **TypeScript `@sylphx/pdf-reader-mcp@3.0.14`**.

Pure-Rust cutover packages (`3.0.15`–`3.1.1`) are **withdrawn/deprecated**. Do not use them.

## Requirements

- **Node.js >= 22.13.0**
- The published package runs the TypeScript MCP server at `dist/index.js`
- Optional OCR / visual providers are opt-in (not required for core text + twin path)

## Claude Code

```bash
claude mcp add pdf-reader -- npx @sylphx/pdf-reader-mcp@3.0.14
```

## Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pdf-reader": {
      "command": "npx",
      "args": ["@sylphx/pdf-reader-mcp@3.0.14"]
    }
  }
}
```

### Config file locations

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

## Cursor

```json
{
  "mcpServers": {
    "pdf-reader": {
      "command": "npx",
      "args": ["@sylphx/pdf-reader-mcp@3.0.14"]
    }
  }
}
```

## Other MCP clients

```bash
npx @sylphx/pdf-reader-mcp@3.0.14
```

## Experimental pure-Rust (developers only)

Not a production install path. Build from source in this repository:

```bash
bun run build:rust
PDF_READER_ENGINE_MODE=pure-rust ./bin/pdf-reader-mcp
```

Honest capability status: [`docs/specs/pure-rust-capability-matrix.json`](../specs/pure-rust-capability-matrix.json).

## Optional OCR Provider

`pdf_evidence` operation `ocr_pages` and `read_pdf` OCR fusion are disabled
until a local OCR command or preset is configured. Set
`MCP_PDF_OCR_PRESET=tesseract` for the plain-text Tesseract command template,
or `MCP_PDF_OCR_PRESET=tesseract-tsv` when agents need normalized Tesseract
word boxes and confidence. You can also set `MCP_PDF_OCR_COMMAND` to the OCR
executable or wrapper you want the server to run.
