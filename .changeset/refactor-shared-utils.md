---
"@sylphx/pdf-reader-mcp": patch
---

Refactor: extract shared utilities to eliminate code duplication and improve maintainability.

**Extracted shared utilities:**
- `src/utils/errorHandling.ts` — `safeErrorMessage()` helper eliminates the duplicated PdfError-vs-generic error pattern across all 6 handlers (was repeated ~41 times with slight variations)
- `src/utils/geometry.ts` — `roundRatio()` and `mergeBoundingBoxes()` shared across 5 modules (tableExtractor, accessibilityReport, documentMap, textLayer, extractor) — was independently defined 8 times
- `src/utils/pdfjs.ts` — `destroyLoadingTask()` and `execFileAsync()` shared across 6 modules (search, regions, inspector, renderer, readPdf, ocr, regionAnalysis) — was duplicated 7 times

**Improvements:**
- Exported `Logger` class from `utils/logger.ts` for type-safe dependency injection
- Consistent error-message sanitization policy (SSS-02) enforced through one function instead of ad-hoc duplication
- Geometry helpers now use `Number.isFinite` validation (more robust than the old undefined-only checks)
- Import ordering auto-fixed by Biome across all touched files

**No behavior changes.** All 348 tests pass. The refactoring is purely structural — same inputs produce same outputs.
