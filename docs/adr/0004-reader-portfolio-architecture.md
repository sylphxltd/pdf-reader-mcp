# ADR-0004: Sylphx Reader Portfolio — Multi-Format Evidence-First MCP Architecture

**Status:** Accepted  
**Date:** 2026-07-08  
**Deciders:** Kyle Tse, Codex  
**Project:** pdf-reader-mcp (portfolio seed); siblings: image-reader-mcp, video-reader-mcp, smart-reader-mcp

## Context

`@sylphx/pdf-reader-mcp` proved that agents need **reading with proof**, not plain
text dumps. The portfolio extends that model to images and video, then unifies
dispatch through one Smart Reader MCP.

Product language distinguishes:

| Verb | Meaning | Default stack |
|------|---------|---------------|
| **Read** | Extract structured facts, transcripts, metadata, regions, and timelines with provenance | Deterministic parsers, classical signal processing, OCR/ASR adapters |
| **Interpret** | Summarize, classify intent, answer open questions, generate narrative | **Out of scope** for Reader MCP packages; belongs in the agent or a separate optional provider |

**Read ≠ LLM.** Reading must not require a generative language model. OCR,
embedded subtitles, EXIF/XMP, ffprobe, shot/scene detectors, and local ASR are
**transcription and measurement**, not interpretation.

## Decision

### Repository topology — four MCP repositories only

| Repository | npm package | Owns |
|------------|-------------|------|
| [pdf-reader-mcp](https://github.com/SylphxAI/pdf-reader-mcp) | `@sylphx/pdf-reader-mcp` | PDF Agent Document Twin (**production**) |
| [image-reader-mcp](https://github.com/SylphxAI/image-reader-mcp) | `@sylphx/image-reader-mcp` | Image Agent Media Twin |
| [video-reader-mcp](https://github.com/SylphxAI/video-reader-mcp) | `@sylphx/video-reader-mcp` | Video Agent Media Twin |
| [smart-reader-mcp](https://github.com/SylphxAI/smart-reader-mcp) | `@sylphx/smart-reader-mcp` | Format sniff, delegate to pdf/image/video, unified `read` tool |

**Not separate repositories:**

- **Universal path (local + remote URL)** — a **phase-2 capability inside
  `smart-reader-mcp`**, not its own repo. Dogfoods the three format readers.
- **Shared evidence types** — documented JSON shapes in each repo's specs; no
  standalone schema repo until a second consumer forces extraction.

### Smart Reader (`smart-reader-mcp`)

Thin orchestrator only:

1. Sniff MIME / magic bytes / extension.
2. Delegate to `@sylphx/pdf-reader-mcp`, `@sylphx/image-reader-mcp`, or
   `@sylphx/video-reader-mcp` (subprocess isolation first).
3. Normalize provenance into one response envelope.
4. Never re-implement format parsers.

**Phase 1:** `read` with local `sources[].path` only.  
**Phase 2 (later):** guarded `https://` fetch + `file://` resolution in the
same package — the user's "Smart Web / Smart Read" vision lives here.

### Format readers (image + video)

Image `read_image` default: metadata, dimensions, embedded text, optional OCR.  
Video `read_video` default: ffprobe, subtitles, scene boundaries — not
frame-by-frame vision LLM.

### Performance budget

| Package | Default install |
|---------|-----------------|
| image-reader-mcp | metadata + sharp |
| video-reader-mcp | ffprobe + subtitle extract |
| smart-reader-mcp | sniff + spawn only |

## Alternatives Considered

### Extra repos (`smart-read-mcp`, `reader-evidence`)

Rejected. User scope is **three new format/orchestrator repos** plus existing
PDF Reader. Universal path and shared types ship inside `smart-reader-mcp` until
proven otherwise.

### Monorepo

Rejected for OSS star isolation and independent release cadence per format.

## Consequences

- Implementation order: **image-reader** → **video-reader** → **smart-reader**
  (phase 1 delegate) → **smart-reader** (phase 2 universal path).
- `smart-read-mcp` and `reader-evidence` GitHub repos created in error are
  archived; do not build on them.
- Portfolio README lists four repositories only.

## Verification

- ADR linked from `README.md`.
- Three sibling bootstrap repos + pdf-reader-mcp exist under `SylphxAI`.