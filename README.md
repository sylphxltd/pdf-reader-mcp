<div align="center">

# Citra

### Give your AI agent eyes for PDFs — with proof.

**Citra** turns PDFs into **structured text, tables, OCR, visual evidence, and page-level citations** your agent can defend — **locally**, with **zero config**.

```bash
npx -y @sylphx/citra
```

Plain-text PDF tools make agents **guess**. Citra returns an **Agent Document Twin** they can **cite**.

| | Typical PDF dump | **Citra** |
| --- | --- | --- |
| Page / cell citations | ❌ invented or missing | ✅ page + geometry + provenance |
| Tables | flattened soup | rows · columns · cells · bboxes |
| Scanned PDFs | noise | OCR path, evidence-linked |
| Setup | install, config, hope | **`npx -y` — done** |
| Engine honesty | silent fallbacks | **fail closed** if native missing |

Canonical: **`@sylphx/citra@5.0.0`** · bin **`citra`** · MCP `io.github.SylphxAI/citra` · sole-Rust production runtime.

[![npm version](https://img.shields.io/npm/v/@sylphx/citra?style=flat-square)](https://www.npmjs.com/package/@sylphx/citra)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](https://opensource.org/licenses/MIT)
[![CI](https://img.shields.io/github/actions/workflow/status/SylphxAI/pdf-reader-mcp/ci.yml?style=flat-square&label=CI)](https://github.com/SylphxAI/pdf-reader-mcp/actions/workflows/ci.yml)
[![stars](https://img.shields.io/github/stars/SylphxAI/pdf-reader-mcp?style=flat-square)](https://github.com/SylphxAI/pdf-reader-mcp/stargazers)
[![MCP Toplist](https://mcptoplist.com/badge/io.github.SylphxAI%2Fcitra.svg)](https://mcptoplist.com/server/io.github.SylphxAI%2Fcitra)

</div>


## Product docs

| Doc | Purpose |
| --- | --- |
| [docs/POSITIONING.md](docs/POSITIONING.md) | Strategic positioning |
| [docs/COMPETITIVE.md](docs/COMPETITIVE.md) | Peer anchors and wedge |
| [docs/EVIDENCE_CONTRACT.md](docs/EVIDENCE_CONTRACT.md) | Evidence = result contract |
| [docs/TOOL_SURFACE.md](docs/TOOL_SURFACE.md) | Few clear tools policy |
| [docs/PRODUCT_INDEPENDENCE.md](docs/PRODUCT_INDEPENDENCE.md) | This repo is SSOT |
| [docs/IPPB.md](docs/IPPB.md) | Independent public product bar |
| [docs/PUBLISH.md](docs/PUBLISH.md) | npm/git publish status |

## Why agents actually finish the job

1. **Zero-config MCP** — `npx -y @sylphx/citra` works without a prior install (stdio MCP).
2. **Evidence, not vibes** — page numbers, boxes, tables, trust signals on the result.
3. **Local-first** — your PDFs stay on the machine; no required cloud vision API.
4. **One brand, one bin** — `@sylphx/citra` / `citra` only (no dual package confusion).
5. **Family ready** — compose with Iris (images), Cue (video), Spine, Lookout, Locus.

## Why this exists

![Plain text vs evidence](docs/public/before-after-evidence.svg)


Most PDF tools dump text. Agents then invent page numbers, miss tables, and cite the wrong cell.

Citra returns an **Agent Document Twin**: markdown + structure + geometry + provenance your agent can actually trust.

| Without evidence | With Citra |
| --- | --- |
| “The revenue was about $12M” | “Page 14, Table 3, cell (row 4, col 2) = `$12.4M`” |
| Lost table structure | Rows, columns, cells, bounding boxes |
| Scanned PDF becomes noise | OCR path with page-linked evidence |
| Hidden text / prompt injection ignored | Trust signals when requested |

## Agent skill surface

See [`skills/citra/SKILL.md`](./skills/citra/SKILL.md).

## Zero-config (no install)

```bash
npx -y @sylphx/citra
```

That’s it. No Docker, no API key, no global install. Agents spawn the MCP server on **stdio** immediately.

| Setup style | Command |
| --- | --- |
| **Zero-config (recommended)** | `npx -y @sylphx/citra` |
| Global install | `npm i -g @sylphx/citra` then `citra` |
| Claude Code | `claude mcp add citra -- npx -y @sylphx/citra` |
| Claude Desktop / Cursor | `"command": "npx", "args": ["-y", "@sylphx/citra"]` |

**Live registry:** `@sylphx/citra@5.0.0` · bin `citra` only · optional native for **your** platform only.

One native binary is pulled for **your** host (not all five). Missing native → **fail closed** (no silent engine switch).

| Platform | Native package (auto optionalDependency) |
| --- | --- |
| macOS arm64 | `@sylphx/citra-darwin-arm64` |
| macOS x64 | `@sylphx/citra-darwin-x64` |
| Linux x64 | `@sylphx/citra-linux-x64-gnu` |
| Linux arm64 | `@sylphx/citra-linux-arm64-gnu` |
| Windows x64 | `@sylphx/citra-win32-x64-msvc` |

Missing native package → **fail closed** (no silent engine switch).

## Quick start

**Claude Code**

```bash
claude mcp add citra -- npx @sylphx/citra
```

**Claude Desktop / Codex / Cursor / VS Code / any MCP client**

```json
{
  "mcpServers": {
    "citra": {
      "command": "npx",
      "args": ["@sylphx/citra"]
    }
  }
}
```

Dual-era hosts that send `server/discover` before `initialize` (e.g. Gemini Antigravity CLI) are supported on stdio — the server answers discovery and keeps the session open for the legacy handshake.

**Stdio / HTTP**

```bash
citra
MCP_TRANSPORT=http citra
```


## SDK (programmatic)

Citra is not MCP-only. Apps and internal dogfood can call the same engine without a chat client.

**TypeScript — spawn the native server as a client**

```ts
import { Citra } from '@sylphx/citra/sdk';

const citra = Citra.create();
const { payload, isError } = await citra.read({
  sources: [{ path: '/absolute/path/to/doc.pdf' }],
  // auto defaults on when you omit include_* flags
});
if (isError) throw new Error(JSON.stringify(payload));
console.log(payload);
```

Low-level escape hatch: `@sylphx/citra/pure-rust` (`createPureRustClient`).

- Export: `@sylphx/citra/sdk` → `Citra` (`read` / `search` / `evidence`)
- Export: `@sylphx/citra/pure-rust` → `createPureRustClient`, `resolvePureRustServerBinary`, `PureRustClient`
- Tools (same as MCP): `read_pdf` · `search_pdf` · `pdf_evidence`
- Requires the platform optional native package (same as MCP install)
- **Roadmap:** richer typed SDK depth; package name is already brand-sole `@sylphx/citra`

**CLI**

```bash
npx citra --help
# doctor / read paths: see package bin and docs/guide
```

**MCP** — see Quick start above (`npx @sylphx/citra`).

Independence: [this product only](docs/PRODUCT_INDEPENDENCE.md). No central Instruments monorepo.

## What you get

Three tools. One product surface.

| Tool | What agents use it for |
| --- | --- |
| `read_pdf` | Smart default: markdown, tables, structure, OCR, citations |
| `search_pdf` | Find page + snippet matches before deep reading |
| `pdf_evidence` | Crops, renders, inspect, focused evidence ops |

Minimal call:

```json
{
  "sources": [{ "path": "/absolute/path/to/report.pdf" }]
}
```

### Flagship use cases

1. **Financial reports** — extract table cells agents can cite by page and geometry  
2. **Research papers** — headings, reading order, page-level quotes  
3. **Scanned documents** — OCR path with evidence, not a text soup  

## Install footprint (honest product comparison)

Compare **full clean installs**, not “JS wrapper tarball vs native executable”:

| Metric (measured clean install, **linux-x64**) | Historical TS `3.0.14` | Sole-Rust `4.1.0` |
| --- | ---: | ---: |
| Main package on disk | ~403 KB | ~77 KB |
| Full `node_modules` | ~82.3 MiB | **~24.4 MiB** (~3.4× smaller) |
| Installed files | 4,101 | **20** (~205× fewer) |
| Production npm dependency graph | PDF.js + MCP TS SDK + more | `{}` + **one** platform native |

The native binary is multi-megabyte because it **is** the PDF intelligence engine (parser, server, rendering/table/OCR routing). That is expected and still yields a **cleaner, smaller install** than shipping PDF.js + a JS dependency tree.

Details: [installed footprint comparison](docs/specs/performance/installed-footprint-comparison.md)

## Performance

Controlled **same-host linux-x64** dual-mode A/B vs `@sylphx/pdf-reader-mcp@3.0.14`, using **registry-installed 4.1.x** natives:

| Mode | What it measures | Result |
| --- | --- | --- |
| `persistent_warm` | long-lived server, repeated identical local `read_pdf` after warm-up | **≥ ~10×** median latency improvement on all 8 required fixture classes |
| `startup_inclusive` | spawn + initialize + one task | large advantage on the same fixtures |

`persistent_warm` includes a process-local cache for identical local path+options. First request in a process still pays full parse cost.

Also: install footprint is much smaller than TS 3.0.14 on measured linux-x64 (~3.4× less disk, ~205× fewer files), and the 4.1.0 native binary is smaller than 4.0.2 (strip/LTO).

**Not** a multi-host guarantee. Details: [4.1.0 report](docs/specs/performance/4.1.0-same-host-performance-report.md) · [claims policy](docs/specs/performance/4.1.0-performance-claims-policy.md)


## Engine note

Version 4 runs a **native Rust engine** on supported platforms via a thin Node launcher.

> Local-first. Five platforms. One clean install.

Unusually formed or broken ToUnicode CMaps are handled without crashing, and
the release binary is built panic-unwind so a worker-thread panic fails the
affected request instead of aborting the whole process
([#608](https://github.com/SylphxAI/pdf-reader-mcp/issues/608)).

Engineering history, recovery pins, and ADRs live under [docs/migration.md](docs/migration.md) — not the product pitch.

## Product proof

- [Before/after + flagship workflows](docs/guide/product-proof.md)
- [Example demos](examples/demo/README.md)

## Docs

- [Website / guide](https://sylphxai.github.io/pdf-reader-mcp/)
- [Installation](docs/guide/installation.md)
- [Comparison](docs/comparison/index.md)
- [Migration / recovery (secondary)](docs/migration.md)

## License

MIT

---

If this saves your agents from PDF hallucinations, **star the repo** and share a demo with your team.
