---
"@sylphx/pdf-reader-mcp": patch
---

Add unit tests for extracted modules and shared utilities.

New test files (29 tests):
- `test/pdf/autoReadPolicy.test.ts` (16 tests): covers hasExplicitReadOptions,
  shouldUseAutoRead, buildAutoDetailOptions (fast/balanced/full presets),
  buildReadOptions defaults and overrides, constants
- `test/utils/errorHandling.test.ts` (5 tests): covers safeErrorMessage for
  PdfError, generic Error, non-Error values, null, and no-logger case
- `test/utils/geometry.test.ts` (8 tests): covers roundRatio edge cases,
  mergeBoundingBoxes union computation, undefined filtering, NaN filtering

Also restored `export` on `hasExplicitReadOptions` and `buildAutoDetailOptions`
in autoReadPolicy.ts — they were incorrectly made private during Phase 3
dead-export cleanup but need to be testable.
