# Publish status — Citra

| Field | Value |
| --- | --- |
| **Canonical npm** | `@sylphx/citra` |
| **Canonical bin** | `citra` |
| **MCP registry name** | `io.github.SylphxAI/citra` |
| Source tip version | `5.0.0` (this repository) |
| Registry (live) | may lag tip — verify with `npm view @sylphx/citra version` |
| Deprecated install CTA | `@sylphx/pdf-reader-mcp` (do not document as primary) |
| Auth | GitHub org `NPM_TOKEN` via protected release workflows |

## Install (canonical)

```bash
npm i -g @sylphx/citra
# or
npx @sylphx/citra
```

## Deprecate transitional (operator, requires auth)

```bash
npm deprecate @sylphx/pdf-reader-mcp@"*" "Use @sylphx/citra (brand-sole). Same engine."
```

Workflows: `release.yml`, `publish-npm.yml`, brand-sole publish path (not dual-product expand).
