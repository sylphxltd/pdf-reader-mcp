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
`publish-npm.yml` artifact path. There is no alias, republish, or unpublish
workflow.

Release admission binds publication to an exact reviewed source candidate. A
later release/version commit is accepted only when it descends from that
candidate and changes generated release metadata or evidence; runtime/source
changes require a new review pin. This keeps versioning from becoming a second
implementation authority.

A release is closed only after all five native packages and the umbrella package
are read back at one exact version, the installed `citra` launcher initializes
with that version, the N-1 → N update and uninstall checks pass, and a GitHub
release at the publishing source SHA triggers canonical MCP Registry publication.
The registry workflow then reads back active `io.github.SylphxAI/citra` metadata
and deprecates every version of the retired MCP Registry identity. Cross-build
success is artifact evidence, not host-runtime parity.
