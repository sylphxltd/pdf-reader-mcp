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
