# ADR-389: Adopt PDF Reader MCP Family SOTA Roadmap

Date: 2026-07-09  
Status: Proposed in PR #389  
Slug: mcp-family-sota-roadmap

## Context

PDF Reader MCP is the mature document evidence engine in the SylphxAI Reader
family. It needs a repo-local roadmap that preserves its local-first document
intelligence boundary while showing how PDF evidence feeds Smart Reader,
Architecture Reader, Consultant MCP, and other family workflows.

## Decision

Adopt `docs/roadmap/sota-family-roadmap.md` as the local roadmap for PDF Reader
MCP's family role.

PDF Reader MCP remains the owner of PDF document evidence, Agent Document Twin
semantics, provenance, trust reports, search, rendering, crops, OCR routing,
and benchmark-gated release quality.

## Consequences

- Smart Reader routes PDFs but does not replace PDF Reader internals.
- Architecture Reader and Consultant MCP consume PDF evidence rather than
  duplicating PDF extraction.
- Rust native acceleration may be added only where benchmarks preserve existing
  tool semantics and improve measured hot paths.
- Provider routes, privacy behavior, confidence, and degraded extraction must
  stay explicit.

## Verification

- Roadmap added at `docs/roadmap/sota-family-roadmap.md`.
- README and PROJECT link to the roadmap.
- Docs-only validation: `git diff --check`.
