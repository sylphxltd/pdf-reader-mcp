---
"@sylphx/pdf-reader-mcp": patch
---

Refactor: extract readCoordinator and autoReadPolicy from fat-controller readPdf handler.

**Before:** `readPdf.ts` was a 955-line fat controller that merged three concerns:
pipeline orchestration, auto-read decision policy, and MCP response assembly.

**After:** Three clean modules with clear separation of concerns:

- `src/pdf/autoReadPolicy.ts` (214 lines) — domain logic: which flags are
  explicit, when auto-read triggers, what fast/balanced/full presets mean,
  how to build processing options from schema input.
- `src/pdf/readCoordinator.ts` (529 lines) — domain orchestration: the full
  extraction stage graph (metadata → structure → geometry → page-content →
  OCR → tables → elements → markdown → chunks → trust report → accessibility
  report → document map). Pure domain logic, no MCP transport awareness.
- `src/handlers/readPdf.ts` (238 lines) — thin transport handler: schema →
  auto-read decision → coordinator call → MCP response assembly. Matches the
  shape of all other 7 handlers.

**No behavior changes.** All 348 tests pass.
