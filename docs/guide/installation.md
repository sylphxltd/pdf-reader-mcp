# Installation

## Requirements

- Node.js >= 22.13.0

## Claude Code

```bash
claude mcp add pdf-reader -- npx @sylphx/pdf-reader-mcp
```

## Claude Desktop

Add to your `claude_desktop_config.json`:

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

### Config file locations:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

## Cursor

Add to your Cursor MCP settings:

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

## Other MCP Clients

The server communicates via stdio. Run with:

```bash
npx @sylphx/pdf-reader-mcp
```

## Optional OCR Provider

`ocr_pages` is disabled until a local OCR command or preset is configured. Set
`MCP_PDF_OCR_PRESET=tesseract` to use the built-in Tesseract command template,
or set `MCP_PDF_OCR_COMMAND` to the OCR executable or wrapper you want the
server to run. Optionally set `MCP_PDF_OCR_ARGS_JSON` to a JSON string array
with `{input}`, `{page}`, `{source}`, `{language}`, `{languages}`, and
`{languages_tesseract}` placeholders. The argument template must include
`{input}` so the provider receives the temporary rendered PNG.

Example:

```json
{
  "mcpServers": {
    "pdf-reader": {
      "command": "npx",
      "args": ["@sylphx/pdf-reader-mcp"],
      "env": {
        "MCP_PDF_OCR_PRESET": "tesseract"
      }
    }
  }
}
```

Provider stdout may be plain text or JSON with `text`, `confidence`,
`language`, and `words`. The default package does not bundle an OCR model.

## Optional Visual Region Analysis Provider

`analyze_regions` is disabled until a local visual analysis command is
configured. Set `MCP_PDF_REGION_ANALYSIS_COMMAND` to a local executable or
wrapper that accepts a temporary cropped PNG. Optionally set
`MCP_PDF_REGION_ANALYSIS_ARGS_JSON` to a JSON string array with `{input}`,
`{page}`, `{source}`, `{region_id}`, `{evidence_id}`, `{left}`, `{bottom}`,
`{right}`, `{top}`, `{language}`, and `{languages}` placeholders. The argument
template must include `{input}` so the provider receives the temporary region
crop.

Example:

```json
{
  "mcpServers": {
    "pdf-reader": {
      "command": "npx",
      "args": ["@sylphx/pdf-reader-mcp"],
      "env": {
        "MCP_PDF_REGION_ANALYSIS_COMMAND": "/usr/local/bin/pdf-region-analyzer",
        "MCP_PDF_REGION_ANALYSIS_ARGS_JSON": "[\"{input}\", \"--page\", \"{page}\", \"--region\", \"{region_id}\"]"
      }
    }
  }
}
```

Provider stdout may be plain text or JSON with `kind`, `description`, `text`,
`markdown`, `confidence`, `table`, `formula`, `chart`, and `warnings`. The
default package does not bundle a vision model.

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/SylphxAI/pdf-reader-mcp.git
   cd pdf-reader-mcp
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Build:
   ```bash
   bun run build
   ```

4. Run:
   ```bash
   bun dist/index.js
   ```

## Troubleshooting

### Cache Issues

If you encounter issues after updating, clear the npm cache:

```bash
npm cache clean --force
rm -rf ~/.npm/_npx
```

Then restart your MCP client.
