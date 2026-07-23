# @sylphx/pdf-reader-mcp-linux-arm64-gnu

Optional pure-Rust MCP server binary for `linux-arm64-gnu`.

## Status

- Publishable optional package under verified-candidate admission (ADR-0005).
- Consumed by `@sylphx/pdf-reader-mcp` via `optionalDependencies`.
- Default package entry of the main package remains TypeScript until
  `dropInFor3014=true` and sole-runtime cutover.
- Binary path: `bin/pdf-reader-mcp-server`
- Local host smoke: `bun run smoke:native-package-resolve`
- Registry install proof: `bun run check:registry-install-proof -- --registry --version=<ver>`

## Notes

This package is not a standalone product surface. Prefer installing
`@sylphx/pdf-reader-mcp` and opting into pure-Rust with
`PDF_READER_ENGINE_MODE=pure-rust` (or the `./pure-rust` library export).
