# PDF Reader MCP Project

PDF Reader MCP is a local-first public Model Context Protocol package for PDF
and document intelligence. It gives agents typed tools for PDF inspection,
search, rendering, region crops, OCR routing, extraction, document maps, trust
signals, accessibility reports, provenance, benchmarks, and package release
evidence without becoming a hosted Sylphx Platform BaaS service.

## Lifecycle

- Lifecycle: `production`
- Layer: `tooling`
- Static instruction SSOT: [SylphxAI/skills](https://github.com/SylphxAI/skills) (Doctrine residual is historical only)
- Machine manifest: `.doctrine/project.json`
- Vendor-neutral GroundAtlas manifest: `project.manifest.json`
- Generated GroundAtlas reports: `.groundatlas*`, JSON reports, and Markdown
  scorecards are evidence/read models only

## Goals

- Own the public MCP tool schemas, handlers, parser/extractor adapters,
  provenance model, provider-neutral optional OCR/vision interfaces, benchmarks,
  docs, and release evidence.
- Keep document processing local-first by default with explicit local-vs-remote
  provider behavior.
- Preserve source/page/region provenance so downstream agents can cite and
  verify evidence.

## Non-Goals

- Do not become Sylphx Platform Auth, Billing, Storage, Durable Work, Gateway,
  hosted multi-tenant execution, or customer data retention.
- Do not own Spiron, Cubeage, or customer-specific product semantics.
- Do not store direct provider secrets or product-specific model routing inside
  this package.

## Boundaries

PDF Reader MCP owns the local/open-source document-intelligence package and its
public MCP contract. It does not own hosted customer accounts, billing, storage,
tenant policy, Gateway routing, product audit, or durable state created after a
tool is used. Hosted document intelligence must be a separate service with its
own ADR/spec and commercial controls.

## Public Surfaces

- MCP package and CLI: `package.json`
- Public docs: `README.md`
- Boundary ADR:
  `docs/adr/0001-2027-sota-document-intelligence-boundary.md`
- Tool/spec docs: `docs/specs/`
- SOTA family roadmap: `docs/roadmap/sota-family-roadmap.md`
- CI workflow: `.github/workflows/ci.yml`
- Release workflow: `.github/workflows/release.yml`

## Delivery

Pull requests use the legacy `Validate Code Quality` context on Sylphx
self-hosted runners. Darwin native package builds and registry proofs use
`[self-hosted, sylphx, macos, standard]` only — never GitHub-hosted `macos-*`.
Linux native ABI builds intentionally keep Ubuntu 22.04 images for GLIBC≤2.35;
Windows natives remain on `windows-latest` until a self-hosted Windows pool exists.
Package release is Changesets-driven through the repo release workflow, which
mints a GitHub App token before creating version PRs or publishing to npm.

Control Plane ADR-0014 retired the in-repository GroundAtlas package dogfood
gate and assigned repository-intelligence ownership to Control Plane Repository
Ingestion. `project.manifest.json` remains the vendor-neutral control file and
`.doctrine/project.json` remains the Sylphx Doctrine adapter. This repository
does not treat the ownership decision as proof of a live central ingestion
receipt; generated inventory and reports remain read models only.

Docs-only boundary changes do not alter runtime behavior, provider dispatch,
credentials, package output, npm release, or customer data handling. MCP schema,
handler, parser, provider, benchmark, or package changes require focused tests,
docs, build/coverage evidence, release intent, and npm readback after publish.

## Commercial Direction

This repo is a public utility package and can support commercial offerings only
through clean packaging, benchmarks, trust, compatibility, and separately owned
hosted/enterprise products. Pricing, hosted document intelligence, enterprise
packaging, or roadmap changes require decision records backed by market and
customer analysis.
