# Installation

## Requirements

- Node.js >= 22.13.0

The default install does not require a local OCR engine, vision model, Ollama,
LM Studio, llama.cpp, or cloud provider. Those are optional provider-enabled
upgrades for scanned-page OCR and focused visual-region enrichment; core PDF
inspection, selectable-text extraction, rendering, source crops, document maps,
trust reports, and accessibility reports work from the package itself.

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

`pdf_evidence` operation `ocr_pages` and `read_pdf` OCR fusion are disabled
until a local OCR command or preset is configured. Set
`MCP_PDF_OCR_PRESET=tesseract` for the plain-text Tesseract command template,
or `MCP_PDF_OCR_PRESET=tesseract-tsv` when agents need normalized Tesseract
word boxes and confidence. You can also set `MCP_PDF_OCR_COMMAND` to the OCR
executable or wrapper you want the server to run. Optionally set
`MCP_PDF_OCR_ARGS_JSON` to a JSON string array with `{input}`, `{page}`,
`{source}`, `{language}`, `{languages}`, and `{languages_tesseract}`
placeholders. The argument template must include `{input}` so the provider
receives the temporary rendered PNG.

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
`language`, and `words`; the `tesseract-tsv` preset parses TSV stdout directly.
The default package does not bundle an OCR model.

## Optional Visual Region Analysis Provider

`pdf_evidence` operation `analyze_regions` and `read_pdf` visual enrichment are
disabled until a local visual analysis provider is configured. Set
`MCP_PDF_REGION_ANALYSIS_COMMAND` to a local executable or
wrapper that accepts a temporary cropped PNG, or set
`MCP_PDF_REGION_ANALYSIS_HTTP_URL` to an env-configured local model server.
For local Ollama vision models, set `MCP_PDF_REGION_ANALYSIS_PRESET=ollama`
and `MCP_PDF_REGION_ANALYSIS_OLLAMA_MODEL`; the generate endpoint defaults to
`http://127.0.0.1:11434/api/generate`. For local or private
OpenAI-compatible chat-completions vision servers, set
`MCP_PDF_REGION_ANALYSIS_PRESET=openai-compatible`,
`MCP_PDF_REGION_ANALYSIS_OPENAI_MODEL`, and
`MCP_PDF_REGION_ANALYSIS_OPENAI_URL`; no remote endpoint is used by default.
For common local OpenAI-compatible engines, use
`MCP_PDF_REGION_ANALYSIS_PRESET=lmstudio` with
`MCP_PDF_REGION_ANALYSIS_LMSTUDIO_MODEL`, or
`MCP_PDF_REGION_ANALYSIS_PRESET=llamacpp` with
`MCP_PDF_REGION_ANALYSIS_LLAMACPP_MODEL`; both presets use localhost chat
completions defaults that can be overridden with the matching `*_URL` env var.
Command providers take precedence when both are configured. Optionally set
`MCP_PDF_REGION_ANALYSIS_ARGS_JSON` to a JSON string array with `{input}`,
`{page}`, `{source}`, `{region_id}`, `{evidence_id}`, `{left}`, `{bottom}`,
`{right}`, `{top}`, `{language}`, and `{languages}` placeholders. The command
argument template must include `{input}` so the provider receives the temporary
region crop. HTTP providers receive JSON with `image_base64`, `mime_type`,
page/region metadata, crop coordinates, scale, and languages; optional headers
come from `MCP_PDF_REGION_ANALYSIS_HTTP_HEADERS_JSON`. The Ollama preset sends
`images: [base64Crop]`, `stream: false`, and `format: "json"` to `/api/generate`
and normalizes the JSON object in the `response` field. The OpenAI-compatible
preset sends a chat-completions request with a JSON-only prompt plus an
`image_url` data URL and normalizes `choices[0].message.content`.

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

For a local HTTP model server, set `MCP_PDF_REGION_ANALYSIS_HTTP_URL` instead
of the command variables.

For Ollama:

```json
{
  "mcpServers": {
    "pdf-reader": {
      "command": "npx",
      "args": ["@sylphx/pdf-reader-mcp"],
      "env": {
        "MCP_PDF_REGION_ANALYSIS_PRESET": "ollama",
        "MCP_PDF_REGION_ANALYSIS_OLLAMA_MODEL": "llama3.2-vision"
      }
    }
  }
}
```

For an OpenAI-compatible local server:

```json
{
  "mcpServers": {
    "pdf-reader": {
      "command": "npx",
      "args": ["@sylphx/pdf-reader-mcp"],
      "env": {
        "MCP_PDF_REGION_ANALYSIS_PRESET": "openai-compatible",
        "MCP_PDF_REGION_ANALYSIS_OPENAI_URL": "http://127.0.0.1:1234/v1/chat/completions",
        "MCP_PDF_REGION_ANALYSIS_OPENAI_MODEL": "local-vision"
      }
    }
  }
}
```

For LM Studio:

```json
{
  "mcpServers": {
    "pdf-reader": {
      "command": "npx",
      "args": ["@sylphx/pdf-reader-mcp"],
      "env": {
        "MCP_PDF_REGION_ANALYSIS_PRESET": "lmstudio",
        "MCP_PDF_REGION_ANALYSIS_LMSTUDIO_MODEL": "qwen2.5-vl-local"
      }
    }
  }
}
```

For llama.cpp:

```json
{
  "mcpServers": {
    "pdf-reader": {
      "command": "npx",
      "args": ["@sylphx/pdf-reader-mcp"],
      "env": {
        "MCP_PDF_REGION_ANALYSIS_PRESET": "llamacpp",
        "MCP_PDF_REGION_ANALYSIS_LLAMACPP_MODEL": "llava-local"
      }
    }
  }
}
```

Provider stdout or HTTP response body may be plain text or JSON with `kind`, `description`, `text`,
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

## Docker

A `Dockerfile` is included for sandboxed, reproducible deployment. The
container image bundles Node.js 22, the MCP server, and Tesseract OCR for
optional scanned-page support.

### Build

```bash
docker build -t pdf-reader-mcp .
```

### Run (stdio)

```bash
docker run --rm -i \
  -v /path/to/pdfs:/workspace \
  pdf-reader-mcp
```

Mount your PDF directory at `/workspace`. The container's
`MCP_PDF_ALLOWED_DIRS` defaults to `/workspace` for filesystem sandboxing.

### Run (HTTP transport)

```bash
docker run --rm \
  -p 3000:3000 \
  -v /path/to/pdfs:/workspace \
  -e MCP_TRANSPORT=http \
  -e MCP_API_KEY=your-secret-key \
  pdf-reader-mcp
```

Connect your MCP client to `http://127.0.0.1:3000/mcp` with header
`X-API-Key: your-secret-key`.

### Use with Claude Desktop

```json
{
  "mcpServers": {
    "pdf-reader": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-v", "/path/to/pdfs:/workspace",
        "pdf-reader-mcp"
      ]
    }
  }
}
```

### Pre-installed OCR

The container includes Tesseract OCR (`tesseract-ocr-eng`). Set the OCR preset
to enable scanned-page routing:

```bash
docker run --rm -i \
  -v /path/to/pdfs:/workspace \
  -e MCP_PDF_OCR_PRESET=tesseract-tsv \
  pdf-reader-mcp
```
