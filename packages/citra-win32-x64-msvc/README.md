# @sylphx/citra-win32-x64-msvc

Platform native binary for `win32-x64-msvc` used by `@sylphx/citra`.

## Status

- **Production path** for sole-Rust PDF Reader MCP on this platform
- Installed automatically as an `optionalDependency` of `@sylphx/citra` when OS/CPU match
- Binary path: `bin/citra-mcp-server`

## Install

Prefer the umbrella package (recommended):

```bash
npm install -g @sylphx/citra
```

You normally do **not** need to install this package directly. npm selects the matching platform package.

## Notes

This package is not a separate product surface. It is the native engine binary for one platform.
There is no TypeScript PDF runtime and no engine “opt-in” flag for production.
