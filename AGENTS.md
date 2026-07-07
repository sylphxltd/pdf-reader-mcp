# PDF Reader MCP Agent Instructions

## Scope

This file is the repo-local operating policy for agents working in
`SylphxAI/pdf-reader-mcp`. Org-wide engineering doctrine is owned by
`SylphxAI/doctrine`; `PROJECT.md` and `.doctrine/project.json` own this
repository's local identity, lifecycle, boundary, and delivery facts.

`@sylphx/pdf-reader-mcp` is a local-first, public Model Context Protocol package
for PDF/document intelligence. It is not a hosted Sylphx Platform BaaS service
and must not absorb product-specific Spiron, Gateway, Cubeage, or customer-data
semantics.

## Read First

Before proposing or implementing changes, read the smallest relevant set of
these source-of-truth documents:

1. `README.md` — public package contract, supported MCP tools, install surface,
   performance claims, and user-facing behavior.
2. `PROJECT.md` and `.doctrine/project.json` — project goal, lifecycle,
   boundaries, public surfaces, delivery proof, package release path, and
   adoption gaps.
3. `project.manifest.json` — vendor-neutral GroundAtlas project-control
   manifest. Generated `.groundatlas*` outputs plus GroundAtlas JSON/Markdown
   reports are evidence/read models only, not source of truth.
4. `docs/adr/0001-2027-sota-document-intelligence-boundary.md` — package
   ownership, portfolio integration boundary, and SOTA invariants.
5. `docs/specs/2026-06-16-2027-sota-document-intelligence-operating-model.md`
   — implementation target, non-goals, provider boundary, acceptance criteria,
   and release quality bar.
6. The touched tool/spec document under `docs/specs/`, such as text layer,
   OCR provider, region crop/evidence, trust report, accessibility, or document
   AST specs.
7. `CONTRIBUTING.md` and `package.json` before changing development commands,
   release, or validation workflows.
8. The paired schema/handler/test files for any public MCP tool change.

## Non-Negotiables

- Preserve local-first privacy. Do not upload documents or call remote providers
  unless the caller explicitly selects a provider/adapter that requires it.
- Do not add hosted auth, billing, storage, tenancy, durable work, retention, or
  customer-account state inside this package.
- Do not add direct provider secrets, Sylphx AI Gateway credentials, or
  product-specific model routing to this repository.
- Keep optional OCR, vision, and region-analysis providers behind typed adapters
  with explicit provenance, cost/latency/error metadata where available, and
  clear local-vs-remote behavior.
- Public MCP schemas are contracts. Version, document, and regression-test tool
  option/output changes.
- Preserve page/region/source provenance for extraction, search, rendering,
  crop, OCR, table, and visual-analysis outputs.
- Package publishing must remain Changesets-driven and bot/workflow-owned via
  the repository release workflow. Do not publish from a human shell or personal
  token.
- Keep product integration boundaries clean: Gateway may expose/route tools,
  product apps own permissions/audit/durable outcomes, and hosted document
  intelligence requires a separate ADR/service.
- Do not commit secrets, private documents, customer data, provider keys, or
  generated credentials.

## Workflow

1. Identify the owning boundary: MCP schema, handler, parser/extractor, document
   model, provenance, provider adapter, benchmark, docs, release gate, or package
   distribution.
2. Check the related ADR/spec and open PRs before editing; avoid broad shared-doc
   conflicts with large WIP PRs.
3. Prefer small, evidence-backed slices with paired tests and docs.
4. For tool behavior changes, update schema, handler, tests, docs, and release
   evidence together.
5. Use branch → commit → PR. Do not push directly to `main`, force-push, merge,
   release, or publish without manager-visible evidence and required gates.

## Validation

Use the narrowest meaningful validation first, then broaden as needed:

- `bun run typecheck`
- `bun run test`
- `bun run check`
- `bun run build`
- `bun run docs:build`
- `bun test test/project-control.test.ts`
- release/benchmark gates named by the touched spec or workflow

Docs-only boundary changes may be validated by reviewing the diff and checking
referenced files exist. Runtime/schema/provider changes need targeted tests and
compatibility evidence.

## Reporting

When reporting completed work, include changed files, boundaries read, validation
run, PR/issue links, and residual risk. Be explicit when no runtime behavior,
provider dispatch, credentials, package build, npm release, or customer data
handling changed.
