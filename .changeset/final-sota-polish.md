---
"@sylphx/pdf-reader-mcp": patch
---

Final SOTA polish: tsconfig strictness, JSON.parse type safety, logger simplification.

**tsconfig:**
- Added `noUnusedLocals` and `noUnusedParameters` — dead code is now a compile error

**JSON.parse type safety:**
- `ocr.ts`: `JSON.parse(stdout) as RawOcrOutput` → `JSON.parse(stdout) as unknown` then
  validate before use. Provider output is untrusted and must not be trusted to
  match internal types without runtime validation.
- `regionAnalysis.ts`: same fix for `RawRegionAnalysisOutput`

**Logger simplification (125 → 76 lines, -39%):**
- Consolidated `logWithContext` + `logSimple` into single `emit()` method
- Removed duplicated `console[level]` branching (was repeated in both methods)
- Console methods resolved at call time (not module load) so test spies work
- Same behavior: structured context still logged for error/warn levels
