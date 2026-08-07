# Citra — brand-sole publish (hard cut)

**Publish authority:** this repository only.

| Field | Value |
| --- | --- |
| Brand | **Citra** |
| **Canonical npm** | `@sylphx/citra` |
| **Canonical bin** | `citra` |
| **MCP registry name** | `io.github.SylphxAI/citra` |
| Deprecated alias | `@sylphx/pdf-reader-mcp` (do not publish new as primary) |

## Policy (clean break)

1. **One product / one identity:** `@sylphx/citra` is the only supported install path.
2. Transitional `@sylphx/pdf-reader-mcp` must not be the README primary CTA.
3. If a transitional alias package is ever published, it is a thin re-export deprecation stub only — never a second engine.
4. Native optionalDependencies may still use historical package names until the native rename train lands; versions **must** match Citra version.

## User install

```bash
npm i -g @sylphx/citra
# or
npx @sylphx/citra
```

## Deprecate transitional (registry auth required)

```bash
npm deprecate @sylphx/pdf-reader-mcp@"*" "Use @sylphx/citra (brand-sole). Same engine."
```
