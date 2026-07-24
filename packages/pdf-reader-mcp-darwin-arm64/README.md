# @sylphx/pdf-reader-mcp-darwin-arm64

Platform native binary for `darwin-arm64` used by `@sylphx/pdf-reader-mcp`.

## Status

- **Production path** for sole-Rust PDF Reader MCP on this platform
- Installed automatically as an `optionalDependency` of `@sylphx/pdf-reader-mcp` when OS/CPU match
- Binary path: `bin/pdf-reader-mcp-server`

## Install

Prefer the umbrella package (recommended):

```bash
npm install -g @sylphx/pdf-reader-mcp
```

You normally do **not** need to install this package directly. npm selects the matching platform package.

## Notes

This package is not a separate product surface. It is the native engine binary for one platform.
There is no TypeScript PDF runtime and no engine “opt-in” flag for production.
