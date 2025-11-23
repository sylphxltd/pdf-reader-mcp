# Changelog

## 1.3.1

### Patch Changes

- b19fdaa: Refactor CI workflows to use company standard release flow and improve separation of concerns

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.3.0](https://github.com/SylphxAI/pdf-reader-mcp/compare/v1.2.0...v1.3.0) (2025-11-06)

### Features

- **Path Handling**: Remove absolute path restriction ([#212](https://github.com/SylphxAI/pdf-reader-mcp/pull/212))
  - **BREAKING CHANGE**: Absolute paths are now supported for local PDF files
  - Both absolute and relative paths are accepted in the `path` parameter
  - Relative paths are resolved against the current working directory (process.cwd())
  - Fixes [#136](https://github.com/SylphxAI/pdf-reader-mcp/issues/136) - MCP error -32602: Absolute paths are not allowed
  - Windows paths (e.g., `C:\Users\...`) and Unix paths (e.g., `/home/...`) now work correctly
  - Configure working directory via `cwd` in MCP server settings for relative path resolution

### Bug Fixes

- Fix Zod validation error handling - use `error.issues` instead of `error.errors`
- Update dependencies to latest versions (Zod 3.25.76, @modelcontextprotocol/sdk 1.21.0)

### Code Quality

- All 103 tests passing
- Coverage: 94%+ lines, 98%+ functions, 84%+ branches
- TypeScript strict mode compliance
- Zero linting errors

## [1.2.0](https://github.com/SylphxAI/pdf-reader-mcp/compare/v1.1.0...v1.2.0) (2025-10-31)

### Features

- **Content Ordering**: Preserve exact text and image order based on Y-coordinates
  - Content items within each page are now sorted by their vertical position
  - Enables AI to see content in the same order as it appears in the PDF
  - Text and images are interleaved based on document layout
  - Example: page 1 [text, image, text, image, image, text]
  - Uses PDF.js transform matrices to extract Y-coordinates
  - Automatically groups text items on the same line
  - Returns ordered content parts for optimal AI consumption

### Internal Changes

- New `extractPageContent()` function combines text and image extraction with positioning
- New `PageContentItem` interface tracks content type, position, and data
- Handler updated to generate content parts in document-reading order
- Improved error handling to return descriptive error messages as text content

### Code Quality

- All tests passing (91 tests)
- Coverage maintained at 97.76% statements, 90.95% branches
- TypeScript strict mode compliance
- Zero linting errors

## [1.1.0](https://github.com/SylphxAI/pdf-reader-mcp/compare/v1.0.0...v1.1.0) (2025-10-31)

### Features

- **Image Extraction**: Extract embedded images from PDF pages as base64-encoded data ([bd637f3](https://github.com/SylphxAI/pdf-reader-mcp/commit/bd637f3))
  - Support for RGB, RGBA, and Grayscale formats
  - Works with JPEG, PNG, and other embedded image types
  - Includes image metadata (width, height, format, page number)
  - Optional parameter `include_images` (default: false)
  - Uses PDF.js operator list API for reliable extraction

### Performance Improvements

- **Parallel Page Processing**: Process multiple pages concurrently for 5-10x speedup ([e5f85e1](https://github.com/SylphxAI/pdf-reader-mcp/commit/e5f85e1))
  - Refactored extractPageTexts to use Promise.all
  - 10-page PDF: ~5-8x faster
  - 50-page PDF: ~10x faster
  - Maintains error isolation per page

### Code Quality

- **Deep Architectural Refactoring**: Break down monolithic handler into focused modules ([1519fe0](https://github.com/SylphxAI/pdf-reader-mcp/commit/1519fe0))

  - handlers/readPdf.ts: 454 → 143 lines (-68% reduction)
  - NEW src/types/pdf.ts: Type definitions (44 lines)
  - NEW src/schemas/readPdf.ts: Zod schemas (61 lines)
  - NEW src/pdf/parser.ts: Page range parsing (124 lines)
  - NEW src/pdf/loader.ts: Document loading (74 lines)
  - NEW src/pdf/extractor.ts: Text & metadata extraction (96 lines → 224 lines with images)
  - Single Responsibility Principle applied throughout
  - Functional composition for better testability

- **Comprehensive Test Coverage**: 90 tests with 98.94% coverage ([85cf712](https://github.com/SylphxAI/pdf-reader-mcp/commit/85cf712))
  - NEW test/pdf/extractor.test.ts (22 tests)
  - NEW test/pdf/loader.test.ts (9 tests)
  - NEW test/pdf/parser.test.ts (26 tests)
  - Tests: 31 → 90 (+158% increase)
  - Coverage: 90.26% → 98.94% statements
  - Coverage: 78.64% → 93.33% branches

### Documentation

- Enhanced README with image extraction examples and usage guide
- Added dedicated Image Extraction section with format details
- Updated roadmap to reflect completed features
- Clarified image format support and considerations

## [1.0.0](https://github.com/SylphxAI/pdf-reader-mcp/compare/v0.3.24...v1.0.0) (2025-10-31)

### ⚠ BREAKING CHANGES

- **Package renamed from @sylphlab/pdf-reader-mcp to @sylphx/pdf-reader-mcp**
- Docker images renamed from sylphlab/pdf-reader-mcp to sylphx/pdf-reader-mcp

### Features

- Migrate from ESLint/Prettier to Biome for 50x faster linting ([bde79bf](https://github.com/SylphxAI/pdf-reader-mcp/commit/bde79bf))
- Add Docker and Smithery deployment support ([11dc08f](https://github.com/SylphxAI/pdf-reader-mcp/commit/11dc08f))

### Bug Fixes

- Fix Buffer to Uint8Array conversion for PDF.js v5.x compatibility ([1c7710d](https://github.com/SylphxAI/pdf-reader-mcp/commit/1c7710d))
- Fix schema validation with exclusiveMinimum for Mistral/Windsurf compatibility ([1c7710d](https://github.com/SylphxAI/pdf-reader-mcp/commit/1c7710d))
- Fix metadata extraction with robust .getAll() fallback ([1c7710d](https://github.com/SylphxAI/pdf-reader-mcp/commit/1c7710d))
- Fix nested test case that was not running ([2c8e1a5](https://github.com/SylphxAI/pdf-reader-mcp/commit/2c8e1a5))
- Update PdfSourceResult type for exactOptionalPropertyTypes compatibility ([4e0d81d](https://github.com/SylphxAI/pdf-reader-mcp/commit/4e0d81d))

### Improvements

- Upgrade all dependencies to latest versions ([dab3f13](https://github.com/SylphxAI/pdf-reader-mcp/commit/dab3f13))
  - @modelcontextprotocol/sdk: 1.8.0 → 1.20.2
  - pdfjs-dist: 5.1.91 → 5.4.296
  - All GitHub Actions updated to latest versions
- Rebrand from Sylphlab to Sylphx ([1b6e4d3](https://github.com/SylphxAI/pdf-reader-mcp/commit/1b6e4d3))
- Revise README for better clarity and modern structure ([b770b27](https://github.com/SylphxAI/pdf-reader-mcp/commit/b770b27))

### Migration Guide

To migrate from @sylphlab/pdf-reader-mcp to @sylphx/pdf-reader-mcp:

1. Uninstall old package:

   ```bash
   npm uninstall @sylphlab/pdf-reader-mcp
   ```

2. Install new package:

   ```bash
   npm install @sylphx/pdf-reader-mcp
   ```

3. Update your MCP configuration to use @sylphx/pdf-reader-mcp

4. If using Docker, update image name to sylphx/pdf-reader-mcp

All functionality remains the same. No code changes required.

### [0.3.24](https://github.com/sylphlab/pdf-reader-mcp/compare/v0.3.23...v0.3.24) (2025-04-07)

### Bug Fixes

- enable rootDir and adjust include for correct build structure ([a9985a7](https://github.com/sylphlab/pdf-reader-mcp/commit/a9985a7eed16ed0a189dd1bda7a66feb13aee889))

### [0.3.23](https://github.com/sylphlab/pdf-reader-mcp/compare/v0.3.22...v0.3.23) (2025-04-07)

### Bug Fixes

- correct executable paths due to missing rootDir ([ed5c150](https://github.com/sylphlab/pdf-reader-mcp/commit/ed5c15012b849211422fbb22fb15d8a2c9415b0b))

### [0.3.22](https://github.com/sylphlab/pdf-reader-mcp/compare/v0.3.21...v0.3.22) (2025-04-07)

### [0.3.21](https://github.com/sylphlab/pdf-reader-mcp/compare/v0.3.20...v0.3.21) (2025-04-07)

### [0.3.20](https://github.com/sylphlab/pdf-reader-mcp/compare/v0.3.19...v0.3.20) (2025-04-07)

### [0.3.19](https://github.com/sylphlab/pdf-reader-mcp/compare/v0.3.18...v0.3.19) (2025-04-07)

### [0.3.18](https://github.com/sylphlab/pdf-reader-mcp/compare/v0.3.17...v0.3.18) (2025-04-07)

### Bug Fixes

- **publish:** remove dist from gitignore and fix clean script ([305e259](https://github.com/sylphlab/pdf-reader-mcp/commit/305e259d6492fbc1732607ee8f8344f6e07aa073))

### [0.3.17](https://github.com/sylphlab/pdf-reader-mcp/compare/v0.3.16...v0.3.17) (2025-04-07)

### Bug Fixes

- **config:** align package.json paths with build output (dist/) ([ab1100d](https://github.com/sylphlab/pdf-reader-mcp/commit/ab1100d771e277705ef99cb745f89687c74a7e13))

### [0.3.16](https://github.com/sylphlab/pdf-reader-mcp/compare/v0.3.15...v0.3.16) (2025-04-07)

### [0.3.15](https://github.com/sylphlab/pdf-reader-mcp/compare/v0.3.14...v0.3.15) (2025-04-07)

### Bug Fixes

- Run lint-staged in pre-commit hook ([e96680c](https://github.com/sylphlab/pdf-reader-mcp/commit/e96680c771eb99ba303fdf7ad51da880261e11c1))

### [0.3.14](https://github.com/sylphlab/pdf-reader-mcp/compare/v0.3.13...v0.3.14) (2025-04-07)

### [0.3.13](https://github.com/sylphlab/pdf-reader-mcp/compare/v0.3.12...v0.3.13) (2025-04-07)

### Bug Fixes

- **docker:** Install pnpm globally in builder stage ([651d7ae](https://github.com/sylphlab/pdf-reader-mcp/commit/651d7ae06660b97af91c348bc8cc786613232c06))

### [0.3.11](https://github.com/sylphlab/pdf-reader-mcp/compare/v0.3.10...v0.3.11) (2025-04-07)

### [0.3.10](https://github.com/sylphlab/pdf-reader-mcp/compare/v1.0.0...v0.3.10) (2025-04-07)

### Bug Fixes

- address remaining eslint warnings ([a91d313](https://github.com/sylphlab/pdf-reader-mcp/commit/a91d313bec2b843724e62ea6a556d99d5389d6cc))
- resolve eslint errors in tests and scripts ([ffc1bdd](https://github.com/sylphlab/pdf-reader-mcp/commit/ffc1bdd18b972f58e90e12ed2394d2968c5639d9))

## [1.0.0] - 2025-04-07

### Added

- **Project Alignment:** Aligned project structure, configuration (TypeScript, ESLint, Prettier, Vitest), CI/CD (`.github/workflows/ci.yml`), Git Hooks (Husky, lint-staged, commitlint), and dependency management (Dependabot) with Sylph Lab Playbook guidelines.
- **Testing:** Achieved ~95% test coverage using Vitest.
- **Benchmarking:** Implemented initial performance benchmarks using Vitest `bench`.
- **Documentation:**
  - Set up documentation website using VitePress.
  - Created initial content for Guide, Design, Performance, Comparison sections.
  - Updated `README.md` to follow standard structure.
  - Added `CONTRIBUTING.md`.
  - Updated Performance page with initial benchmark results.
  - Added community links and call-to-action in VitePress config footer.
- **Package Manager:** Switched from npm to pnpm.

### Changed

- **Dependencies:** Updated various dependencies to align with guidelines and ensure compatibility.
- **Configuration:** Refined `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`, `package.json` based on guidelines.
- **Project Identity:** Updated scope to `@sylphlab`.

### Fixed

- Resolved various configuration issues identified during guideline alignment.
- Corrected Markdown parsing errors in initial documentation.
- Addressed peer dependency warnings where possible.
- **Note:** TypeDoc API generation is currently blocked due to unresolved initialization errors with TypeDoc v0.28.1.

### Removed

- Sponsorship related files and badges (`.github/FUNDING.yml`).

## [0.3.9] - 2025-04-05

### Fixed

- Removed artifact download/extract steps from `publish-docker` job in workflow, as Docker build needs the full source context provided by checkout.

## [0.3.8] - 2025-04-05

### Fixed

- Removed duplicate `context: .` entry in `docker/build-push-action` step in `.github/workflows/publish.yml`.

## [0.3.7] - 2025-04-05

### Fixed

- Removed explicit `COPY tsconfig.json ./` from Dockerfile (rely on `COPY . .`).
- Explicitly set `context: .` in docker build-push action.

## [0.3.6] - 2025-04-05

### Fixed

- Explicitly added `COPY tsconfig.json ./` before `COPY . .` in Dockerfile to ensure it exists before build step.

## [0.3.5] - 2025-04-05

### Fixed

- Added `RUN ls -la` before build step in Dockerfile to debug `tsconfig.json` not found error.

## [0.3.4] - 2025-04-05

### Fixed

- Explicitly specify `tsconfig.json` path in Dockerfile build step (`RUN ./node_modules/.bin/tsc -p tsconfig.json`) to debug build failure.

## [0.3.3] - 2025-04-05

### Fixed

- Changed Dockerfile build step from `RUN npm run build` to `RUN ./node_modules/.bin/tsc` to debug build failure.

## [0.3.2] - 2025-04-05

### Fixed

- Simplified `build` script in `package.json` to only run `tsc` (removed `chmod`) to debug Docker build failure.

## [0.3.1] - 2025-04-05

### Fixed

- Attempted various fixes for GitHub Actions workflow artifact upload issue (`Error: Provided artifact name input during validation is empty`). Final attempt uses fixed artifact filename in upload/download steps.

## [0.3.0] - 2025-04-05

### Added

- `CHANGELOG.md` file based on Keep a Changelog format.
- `LICENSE` file (MIT License).
- Improved GitHub Actions workflow (`.github/workflows/publish.yml`):
  - Triggers on push to `main` branch and version tags (`v*.*.*`).
  - Conditionally archives build artifacts only on tag pushes.
  - Conditionally runs `publish-npm` and `publish-docker` jobs only on tag pushes.
  - Added `create-release` job to automatically create GitHub Releases from tags, using `CHANGELOG.md` for the body.
- Added version headers to Memory Bank files (`activeContext.md`, `progress.md`).

### Changed

- Bumped version from 0.2.2 to 0.3.0.

<!-- Note: Removed [0.4.0-dev] entry as changes are now part of 1.0.0 -->
