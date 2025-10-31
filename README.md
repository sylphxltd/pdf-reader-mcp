# PDF Reader MCP Server

[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/sylphxltd-pdf-reader-mcp-badge.png)](https://mseep.ai/app/sylphxltd-pdf-reader-mcp)
[![CI/CD Pipeline](https://github.com/sylphlab/pdf-reader-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sylphlab/pdf-reader-mcp/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/sylphlab/pdf-reader-mcp/graph/badge.svg?token=VYRQFB40UN)](https://codecov.io/gh/sylphlab/pdf-reader-mcp)
[![npm version](https://badge.fury.io/js/%40sylphlab%2Fpdf-reader-mcp.svg)](https://badge.fury.io/js/%40sylphlab%2Fpdf-reader-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![smithery badge](https://smithery.ai/badge/@sylphxltd/pdf-reader-mcp)](https://smithery.ai/server/@sylphxltd/pdf-reader-mcp)

<a href="https://glama.ai/mcp/servers/@sylphlab/pdf-reader-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@sylphlab/pdf-reader-mcp/badge" alt="PDF Reader Server MCP server" />
</a>

**Empower your AI agents** with the ability to securely read and extract information from PDF files using the Model Context Protocol (MCP).

## ✨ Features

- 📄 **Extract text content** from PDF files (full document or specific pages)
- 🖼️ **Extract embedded images** from PDF pages as base64-encoded data
- 📊 **Get metadata** (author, title, creation date, etc.)
- 🔢 **Count pages** in PDF documents
- 🌐 **Support for both local files and URLs**
- 🛡️ **Secure** - Confines file access to project root directory
- ⚡ **Fast** - Parallel processing for maximum performance
- 🔄 **Batch processing** - Handle multiple PDFs in a single request
- 📦 **Multiple deployment options** - npm or Smithery

## 🆕 Recent Updates (October 2025)

- ✅ **Fixed critical bugs**: Buffer/Uint8Array compatibility for PDF.js v5.x
- ✅ **Fixed schema validation**: Resolved `exclusiveMinimum` issue affecting Windsurf, Mistral API, and other tools
- ✅ **Improved metadata extraction**: Robust fallback handling for PDF.js compatibility
- ✅ **Updated dependencies**: All packages updated to latest versions
- ✅ **Migrated to Biome**: 50x faster linting and formatting with unified tooling
- ✅ **Added image extraction**: Extract embedded images from PDF pages
- ✅ **Performance optimization**: Parallel page processing for 5-10x speedup
- ✅ **Deep refactoring**: Modular architecture with 98.9% test coverage (90 tests)

## 📦 Installation

### Option 1: Using Smithery (Easiest)

Install automatically for Claude Desktop:

```bash
npx -y @smithery/cli install @sylphxltd/pdf-reader-mcp --client claude
```

### Option 2: Using npm/pnpm (Recommended)

Install the package:

```bash
pnpm add @sylphx/pdf-reader-mcp
# or
npm install @sylphx/pdf-reader-mcp
```

Configure your MCP client (e.g., Claude Desktop, Cursor):

```json
{
  "mcpServers": {
    "pdf-reader-mcp": {
      "command": "npx",
      "args": ["@sylphx/pdf-reader-mcp"]
    }
  }
}
```

**Important:** Make sure your MCP client sets the correct working directory (`cwd`) to your project root.

### Option 3: Local Development Build

```bash
git clone https://github.com/sylphlab/pdf-reader-mcp.git
cd pdf-reader-mcp
pnpm install
pnpm run build
```

Then configure your MCP client to use `node dist/index.js`.

## 🚀 Quick Start

Once configured, your AI agent can read PDFs using the `read_pdf` tool:

### Example 1: Extract text from specific pages

```json
{
  "sources": [
    {
      "path": "documents/report.pdf",
      "pages": [1, 2, 3]
    }
  ],
  "include_metadata": true
}
```

### Example 2: Get metadata and page count only

```json
{
  "sources": [{ "path": "documents/report.pdf" }],
  "include_metadata": true,
  "include_page_count": true,
  "include_full_text": false
}
```

### Example 3: Read from URL

```json
{
  "sources": [
    {
      "url": "https://example.com/document.pdf"
    }
  ],
  "include_full_text": true
}
```

### Example 4: Process multiple PDFs

```json
{
  "sources": [
    { "path": "doc1.pdf", "pages": "1-5" },
    { "path": "doc2.pdf" },
    { "url": "https://example.com/doc3.pdf" }
  ],
  "include_full_text": true
}
```

### Example 5: Extract images from PDF

```json
{
  "sources": [
    {
      "path": "presentation.pdf",
      "pages": [1, 2, 3]
    }
  ],
  "include_images": true,
  "include_full_text": true
}
```

**Response includes**:
- Text content from each page
- Embedded images as base64-encoded data with metadata (width, height, format)
- Each image includes page number and index

**Note**: Image extraction works best with JPEG and PNG images. Large PDFs with many images may produce large responses.

## 📖 Usage Guide

### Page Specification

You can specify pages in multiple ways:

- **Array of page numbers**: `[1, 3, 5]` (1-based indexing)
- **Range string**: `"1-10"` (extracts pages 1 through 10)
- **Multiple ranges**: `"1-5,10-15,20"` (commas separate ranges and individual pages)
- **Omit for all pages**: Don't include the `pages` field to extract all pages

### Working with Large PDFs

For large PDF files (>20 MB), extract specific pages instead of the full document:

```json
{
  "sources": [
    {
      "path": "large-document.pdf",
      "pages": "1-10"
    }
  ]
}
```

This prevents hitting AI model context limits and improves performance.

### Image Extraction

Extract embedded images from PDF pages as base64-encoded data:

```json
{
  "sources": [{ "path": "document.pdf" }],
  "include_images": true
}
```

**Image data format**:
```json
{
  "images": [
    {
      "page": 1,
      "index": 0,
      "width": 800,
      "height": 600,
      "format": "rgb",
      "data": "base64-encoded-image-data..."
    }
  ]
}
```

**Supported formats**:
- ✅ **RGB** - Standard color images (most common)
- ✅ **RGBA** - Images with transparency
- ✅ **Grayscale** - Black and white images
- ✅ Works with JPEG, PNG, and other embedded formats

**Important considerations**:
- 🔸 Image extraction increases response size significantly
- 🔸 Useful for AI models with vision capabilities
- 🔸 Set `include_images: false` (default) to extract text only
- 🔸 Combine with `pages` parameter to limit extraction scope

### Security: Relative Paths Only

**Important:** The server only accepts **relative paths** for security reasons. Absolute paths are blocked to prevent unauthorized file system access.

✅ **Good**: `"path": "documents/report.pdf"`
❌ **Bad**: `"path": "/Users/john/documents/report.pdf"`

**Solution**: Configure the `cwd` (current working directory) in your MCP client settings.

## 🔧 Troubleshooting

### Issue: "No tools" showing up

**Solution**: Clear npm cache and reinstall:

```bash
npm cache clean --force
npx @sylphx/pdf-reader-mcp@latest
```

Restart your MCP client completely after updating.

### Issue: "File not found" errors

**Causes**:

1. Using absolute paths (not allowed for security)
2. Incorrect working directory

**Solution**: Use relative paths and configure `cwd` in your MCP client:

```json
{
  "mcpServers": {
    "pdf-reader-mcp": {
      "command": "npx",
      "args": ["@sylphx/pdf-reader-mcp"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

### Issue: Cursor/Claude Code compatibility

**Solution**: Update to the latest version (all recent compatibility issues have been fixed):

```bash
npm update @sylphx/pdf-reader-mcp@latest
```

Then restart your editor completely.

## ⚡ Performance

Benchmarks on a standard PDF file:

| Operation                        | Ops/sec   | Speed      |
| :------------------------------- | :-------- | :--------- |
| Handle Non-Existent File         | ~12,933   | Fastest    |
| Get Full Text                    | ~5,575    |            |
| Get Specific Page                | ~5,329    |            |
| Get Multiple Pages               | ~5,242    |            |
| Get Metadata & Page Count        | ~4,912    | Slowest    |

_Performance varies based on PDF complexity and system resources._

See [Performance Documentation](./docs/performance/index.md) for details.

## 🏗️ Architecture

### Tech Stack

- **Runtime**: Node.js 22+
- **PDF Processing**: PDF.js (pdfjs-dist)
- **Validation**: Zod with JSON Schema generation
- **Protocol**: Model Context Protocol (MCP) SDK
- **Build**: TypeScript
- **Testing**: Vitest with 100% coverage goal
- **Code Quality**: Biome (linting + formatting)
- **CI/CD**: GitHub Actions

### Design Principles

1. **Security First**: Strict path validation and sandboxing
2. **Simple Interface**: Single tool handles all PDF operations
3. **Structured Output**: Predictable JSON format for AI parsing
4. **Performance**: Efficient caching and lazy loading
5. **Reliability**: Comprehensive error handling and validation

See [Design Philosophy](./docs/design/index.md) for more details.

## 🧪 Development

### Prerequisites

- Node.js >= 22.0.0
- pnpm (recommended) or npm

### Setup

```bash
git clone https://github.com/sylphlab/pdf-reader-mcp.git
cd pdf-reader-mcp
pnpm install
```

### Available Scripts

```bash
pnpm run build        # Build TypeScript to dist/
pnpm run watch        # Build in watch mode
pnpm run test         # Run tests
pnpm run test:watch   # Run tests in watch mode
pnpm run test:cov     # Run tests with coverage
pnpm run check        # Run Biome (lint + format check)
pnpm run check:fix    # Fix Biome issues automatically
pnpm run lint         # Lint with Biome
pnpm run format       # Format with Biome
pnpm run typecheck    # TypeScript type checking
pnpm run benchmark    # Run performance benchmarks
pnpm run validate     # Full validation (check + test)
```

### Testing

We maintain high test coverage using Vitest:

```bash
pnpm run test         # Run all tests
pnpm run test:cov     # Run with coverage report
```

All tests must pass before merging. Current: **31/31 tests passing** ✅

### Code Quality

The project uses [Biome](https://biomejs.dev/) for fast, unified linting and formatting:

```bash
pnpm run check        # Check code quality
pnpm run check:fix    # Auto-fix issues
```

### Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and ensure tests pass
4. Run `pnpm run check:fix` to format code
5. Commit using [Conventional Commits](https://www.conventionalcommits.org/)
6. Open a Pull Request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

## 📚 Documentation

- **[Full Documentation](https://sylphlab.github.io/pdf-reader-mcp/)** - Complete guides and API reference
- **[Getting Started Guide](./docs/guide/getting-started.md)** - Quick start guide
- **[API Reference](./docs/api/README.md)** - Detailed API documentation
- **[Design Philosophy](./docs/design/index.md)** - Architecture and design decisions
- **[Performance](./docs/performance/index.md)** - Benchmarks and optimization
- **[Comparison](./docs/comparison/index.md)** - How it compares to alternatives

## 🗺️ Roadmap

- [x] ~~Image extraction from PDFs~~ ✅ Completed (v1.0.0)
- [x] ~~Performance optimizations for parallel processing~~ ✅ Completed (v1.0.0)
- [ ] Annotation extraction support
- [ ] OCR integration for scanned PDFs
- [ ] Streaming support for very large files
- [ ] Enhanced caching mechanisms
- [ ] PDF form field extraction

## 🤝 Support & Community

- **Issues**: [GitHub Issues](https://github.com/sylphlab/pdf-reader-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/sylphlab/pdf-reader-mcp/discussions)
- **Contributing**: [CONTRIBUTING.md](./CONTRIBUTING.md)

If you find this project useful, please:

- ⭐ Star the repository
- 👀 Watch for updates
- 🐛 Report bugs
- 💡 Suggest features
- 🔀 Contribute code

## 📄 License

This project is licensed under the [MIT License](./LICENSE).

---

**Made with ❤️ by [Sylphx](https://sylphx.com)**
