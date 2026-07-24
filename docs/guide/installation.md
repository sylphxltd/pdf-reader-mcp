# Installation

## Published stable

Install from **npm**. Current production is **`@sylphx/pdf-reader-mcp@4.0.2`** — a **sole-Rust** MCP server launched by a thin Node entrypoint.

```bash
npm install -g @sylphx/pdf-reader-mcp
# or pin
npm install -g @sylphx/pdf-reader-mcp@4.0.2
```

npm installs:

1. The thin launcher package
2. **One** platform native package as an optional dependency (when available)

There is **no** TypeScript PDF runtime in the production package. If the matching native binary is missing, the server **fails closed**.

## Requirements

- **Node.js >= 22.13.0** (launcher only)
- Supported platform for the native binary:
  - macOS arm64 / x64
  - Linux x64 gnu / arm64 gnu
  - Windows x64
- Optional OCR / visual providers are opt-in (not required for core text paths)

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

### Config file locations

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

## Cursor / VS Code / other MCP clients

Use the same stdio command shape:

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

## Run directly

```bash
npx @sylphx/pdf-reader-mcp
# or after global install
pdf-reader-mcp
```

HTTP transport:

```bash
MCP_TRANSPORT=http pdf-reader-mcp
```

## Platforms

| Platform | Native package |
| --- | --- |
| macOS arm64 | `@sylphx/pdf-reader-mcp-darwin-arm64` |
| macOS x64 | `@sylphx/pdf-reader-mcp-darwin-x64` |
| Linux x64 | `@sylphx/pdf-reader-mcp-linux-x64-gnu` |
| Linux arm64 | `@sylphx/pdf-reader-mcp-linux-arm64-gnu` |
| Windows x64 | `@sylphx/pdf-reader-mcp-win32-x64-msvc` |

## Historical TypeScript baseline (not production)

Immutable external comparison/recovery pin only:

```bash
npm install -g @sylphx/pdf-reader-mcp@3.0.14
```

See [Migration / recovery notes](/migration) for engine history. Do not use withdrawn intermediate cutover packages as production.
