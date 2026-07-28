# Installation

## Published stable

Install from **npm**. Current production is **`@sylphx/pdf-reader-mcp@4.1.1`** — a **sole-Rust** MCP server launched by a thin Node entrypoint.

```bash
npm install -g @sylphx/pdf-reader-mcp
# or pin
npm install -g @sylphx/pdf-reader-mcp@4.1.1
```

What you get:

1. Thin launcher package
2. **One** platform native package as an optional dependency (auto-selected)

There is **no** TypeScript PDF runtime in the production package. If the matching native binary is missing, the server **fails closed**.

## Requirements

- **Node.js >= 22.13.0** (launcher only)
- Supported platforms:
  - macOS arm64 / x64
  - Linux x64 gnu / arm64 gnu
  - Windows x64
- Optional OCR / visual providers are opt-in (not required for core text paths)

## Claude Code

```bash
claude mcp add pdf-reader -- npx @sylphx/pdf-reader-mcp
```

## Claude Desktop

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

### Config file locations

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\\Claude\\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

## Cursor / VS Code / Codex / other MCP clients

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

### Dual-era clients (Gemini Antigravity CLI)

Some MCP hosts probe with SEP-2575 `server/discover` **before** the legacy
`initialize` handshake (for example Gemini Antigravity CLI on Windows). The
native server answers that discovery request on stdio without closing the
transport, then completes `initialize` as usual. If an older published build
fails with `expect initialized request` / `EOF` on plugin load, upgrade to a
release that includes this fix.

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

## Next

- [Product proof](/guide/product-proof) — before/after, flagship workflows, performance bounds
- [Getting started](/guide/getting-started) — tools and first calls
- [Migration / recovery](/migration) — historical notes only

## Historical TypeScript baseline (not production)

Immutable external comparison/recovery pin only:

```bash
npm install -g @sylphx/pdf-reader-mcp@3.0.14
```
