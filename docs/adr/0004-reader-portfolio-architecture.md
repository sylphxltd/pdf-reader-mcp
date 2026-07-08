# ADR-0004: Sylphx Reader Portfolio — Multi-Format Evidence-First MCP Architecture

**Status:** Accepted  
**Date:** 2026-07-08  
**Deciders:** Kyle Tse, Codex  
**Project:** pdf-reader-mcp (portfolio seed); siblings: image-reader-mcp, video-reader-mcp, smart-reader-mcp, smart-read-mcp

## Context

`@sylphx/pdf-reader-mcp` proved that agents need **reading with proof**, not plain
text dumps. The portfolio ambition extends that model to images, video, and
eventually any path (local or remote) through a thin orchestration layer.

Product language distinguishes:

| Verb | Meaning | Default stack |
|------|---------|---------------|
| **Read** | Extract structured facts, transcripts, metadata, regions, and timelines with provenance | Deterministic parsers, classical signal processing, OCR/ASR adapters |
| **Interpret** | Summarize, classify intent, answer open questions, generate narrative | **Out of scope** for Reader MCP packages; belongs in the agent or a separate optional provider |

**Read ≠ LLM.** Reading must not require a generative language model. OCR
(Tesseract), embedded caption/subtitle tracks, EXIF/XMP, ffprobe, shot/scene
detectors, barcode/QR decoders, and speech-to-text (local ASR such as Whisper
or Vosk) are **transcription and measurement**, not interpretation. Optional
classical computer-vision adapters (edge histograms, dominant colors, face/pose
*counts* via lightweight detectors) may ship behind typed adapters with the
same local-first boundary as PDF OCR.

Generative vision LLMs (captioning, VQA, “what is happening”) are **optional
remote providers** only — never the default read path.

## Decision

### Repository topology (five public MCP packages + one shared schema package)

| Repository | npm package | Owns |
|------------|-------------|------|
| [pdf-reader-mcp](https://github.com/SylphxAI/pdf-reader-mcp) | `@sylphx/pdf-reader-mcp` | PDF Agent Document Twin (shipped) |
| [image-reader-mcp](https://github.com/SylphxAI/image-reader-mcp) | `@sylphx/image-reader-mcp` | Image Agent Media Twin |
| [video-reader-mcp](https://github.com/SylphxAI/video-reader-mcp) | `@sylphx/video-reader-mcp` | Video Agent Media Twin |
| [smart-reader-mcp](https://github.com/SylphxAI/smart-reader-mcp) | `@sylphx/smart-reader-mcp` | Format sniff + delegate to pdf/image/video readers |
| [smart-read-mcp](https://github.com/SylphxAI/smart-read-mcp) | `@sylphx/smart-read-mcp` | Universal `path` (file + guarded URL) + smart-reader |
| [reader-evidence](https://github.com/SylphxAI/reader-evidence) | `@sylphx/reader-evidence` | Shared JSON schemas: evidence IDs, bbox, time ranges, provenance, trust signals |

Each MCP repo stays **local-first**, **stdio-default**, **benchmark-gated**, and
**Changesets-published**. No hosted auth, billing, storage, or tenancy inside
any Reader package.

### Agent Media Twin (image + video)

Mirror PDF’s Agent Document Twin:

```
Lossless layer   → container metadata, streams, EXIF/XMP, codec params
Signal layer     → OCR text, ASR transcript, embedded subtitles, chapters
Structure layer  → scenes/shots, keyframes, regions, tables-of-scenes
Evidence layer   → stable IDs, page/frame/time bbox, crops, confidence
Agent layer      → markdown/JSON summary for MCP context (facts only)
```

Image default `read_image` (no flags): metadata + dimensions + color profile +
embedded text (OCR if no text layer) + barcode/QR if present.

Video default `read_video` (no flags): ffprobe summary + chapter markers +
embedded subtitle track + scene/shot boundaries (PySceneDetect or ffmpeg
`select=gt(scene)`) + audio transcript when ASR adapter configured — **not**
frame-by-frame LLM vision.

### Smart Reader (orchestrator)

`smart-reader-mcp` is intentionally **thin**:

1. Sniff MIME / magic bytes / extension.
2. Dispatch to the correct sibling MCP tool surface (in-process adapter or
   subprocess `npx @sylphx/*-reader-mcp` — start with subprocess for isolation).
3. Merge provenance under `@sylphx/reader-evidence` schema.
4. Never re-implement format parsers.

Target binary size: orchestrator-only; heavy deps stay in format repos.

### Smart Read (universal path)

`smart-read-mcp` adds **path resolution** only:

- `file://` and absolute local paths (project-root sandbox like filesystem-mcp)
- `https://` with the same guarded fetch policy as pdf-reader (size caps, SSRF
  controls, optional allowlists)
- Future: `s3://`, `gs://` via explicit deployment adapters — not v1

Dogfoods: `smart-read` → `smart-reader` → `{pdf,image,video}-reader`.

### Shared evidence package

`@sylphx/reader-evidence` publishes TypeScript types + JSON Schema for:

- `EvidenceRef` (id, kind, source, page | frame | time_ms, bbox optional)
- `MediaTrustReport` (hidden metadata, spoofing hints — format-specific)
- `ReadResult` envelope consumed by all Reader MCP tools

PDF Reader migrates provenance fields to this package over time without breaking
MCP schemas (compat re-exports).

### Performance and weight budget

| Package | Heavy optional deps | Default install |
|---------|---------------------|-----------------|
| image-reader-mcp | sharp, tesseract, zbar | sharp + metadata only |
| video-reader-mcp | ffmpeg/ffprobe, scenedetect, whisper.cpp | ffprobe + subtitle extract only |
| smart-reader-mcp | none (delegates) | sniff + spawn |
| smart-read-mcp | none (+ fetch) | path resolve + delegate |

Benchmarks mirror pdf-reader: deterministic quality gate per repo, corpus
fixtures, release-gate JSON artifact.

### Discovery automation (Playwright)

| Target | Playwright feasible? | Recommendation |
|--------|----------------------|----------------|
| mcpservers.org submit form | Partial — site may use bot protection; try headed once, store success URL | Optional `scripts/discovery/mcpservers-submit.mjs` with human-in-loop |
| Glama claim | Partial — requires OAuth; Playwright can reuse `storageState` after one manual login | Document manual claim; do not store credentials in repo |
| Awesome-list PRs | N/A (GitHub API) | Continue PR/issue outreach |

Fully unattended Playwright for OAuth + Cloudflare is **unreliable** and violates
least-privilege; prefer official registry (now listed) + manual claim for Glama.

## Alternatives Considered

### Monorepo (`reader-mcp` with packages/*)

Rejected for OSS adoption. Separate repos maximize GitHub stars, issue isolation,
and independent release cadence — proven by pdf-reader-mcp traction.

### Single “omni-reader” repo with all parsers inline

Rejected. Install weight and CI time explode; users who only need PDF should not
pull ffmpeg + sharp + pdfjs.

### LLM-first image/video understanding

Rejected as default. Violates read/interpret boundary and local-first privacy.
Optional provider adapters may exist; benchmarks must label them `remote` and
`non-default`.

## Consequences

- New repos ship scaffold + ADR-0001 + PROJECT.md before tool implementation.
- `smart-reader-mcp` must not duplicate PDF/image/video parsing logic.
- Each repo adds MCP registry `server.json` + release workflow like pdf-reader v3.0.14+.
- Portfolio cross-links in README “Reader family” section.
- Implementation order: **image-reader** → **video-reader** → **reader-evidence extract** → **smart-reader** → **smart-read**.

## Verification

- ADR linked from `README.md` and `PROJECT.md`.
- Sibling repositories exist under `SylphxAI` with matching descriptions.
- Each sibling `docs/adr/0001-*-boundary.md` defers to this portfolio ADR for cross-cutting rules.