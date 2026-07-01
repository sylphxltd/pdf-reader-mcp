---
"@sylphx/pdf-reader-mcp": patch
---

Refactor: consolidate PdfSource type SSOT and remove dead exports.

**PdfSource SSOT:**
- Replaced hand-written `PdfSource` interface in `types/pdf/source.ts` with a
  re-export from the schema definition (`schemas/readPdf.ts`). Now there is
  exactly one definition: `pdfSourceSchema` → `InferOutput` → re-export.
- Removed dead `ReadPdfOptions` interface (never imported by any module).
- Eliminates the split-brain SSOT drift risk: if someone adds a field to
  `pdfSourceSchema`, the type automatically updates everywhere.

**Dead export cleanup:**
- Removed `export` keyword from 14 functions/constants that are only used
  within their own file (never imported externally). This reduces the public
  API surface and prevents accidental coupling.
- Affected: `buildSemanticHint`, `contentItemToElement`,
  `extractTablesFromTextItems`, `readConfiguredRegionAnalysisProviderConfig`,
  `analyzeRegionCropWithHttpProvider`, 7 DEFAULT_ constants,
  `buildAutoDetailOptions`, `hasExplicitReadOptions`.

**No behavior changes.** All 348 tests pass.
