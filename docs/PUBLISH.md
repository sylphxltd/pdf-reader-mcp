# Publish status — Citra

| Field | Value |
| --- | --- |
| **Canonical npm** | `@sylphx/citra` |
| **Canonical bin** | `citra` |
| **MCP registry name** | `io.github.SylphxAI/citra` |
| Source tip version | `5.0.0` (this repository) |
| Registry (live) | may lag tip — verify with `npm view @sylphx/citra version` |
| Retired install CTA | `@sylphx/pdf-reader-mcp` (historical pins only) |
| Auth | GitHub org `NPM_TOKEN` via protected release workflows |

## Install (canonical)

```bash
npm i -g @sylphx/citra
# or
npx @sylphx/citra
```

## Deprecate transitional (operator, requires auth)

```bash
npm deprecate @sylphx/pdf-reader-mcp@"*" \
  "Retired install CTA. Use @sylphx/citra (bin: citra)."
```

Publish authority: Changesets through `release.yml`, then the admission-gated
`publish-npm.yml` artifact path. There is no alias-publish workflow.
