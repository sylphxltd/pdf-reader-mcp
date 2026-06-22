#!/usr/bin/env node

import { createRequire } from 'node:module';
import { analyzeRegions } from './handlers/analyzeRegions.js';
import { extractRegions } from './handlers/extractRegions.js';
import { inspectPdf } from './handlers/inspectPdf.js';
import { ocrPages } from './handlers/ocrPages.js';
import { readPdf } from './handlers/readPdf.js';
import { renderPage } from './handlers/renderPage.js';
import { searchPdf } from './handlers/searchPdf.js';
import { createServer, http, stdio } from './mcp.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

// Transport configuration via environment variables
// MCP_TRANSPORT: 'stdio' (default) | 'http'
// MCP_HTTP_PORT: HTTP port (default: 8080)
// MCP_HTTP_HOST: HTTP hostname (default: '0.0.0.0')
// MCP_API_KEY: Optional API key for authentication (X-API-Key header)
// MCP_CORS_ORIGIN: CORS allowed origin (e.g. 'https://myapp.example.com'). Not set by default (no cross-origin access).
const transportType = process.env['MCP_TRANSPORT'] ?? 'stdio';
const httpPort = Number.parseInt(process.env['MCP_HTTP_PORT'] ?? '8080', 10);
const httpHost = process.env['MCP_HTTP_HOST'] ?? '0.0.0.0';
const apiKey = process.env['MCP_API_KEY'];
const corsOrigin = process.env['MCP_CORS_ORIGIN'];

/**
 * Create the appropriate transport based on configuration
 */
function createTransport() {
  if (transportType === 'http') {
    return http({
      port: httpPort,
      hostname: httpHost,
      ...(corsOrigin ? { cors: corsOrigin } : {}),
    });
  }
  return stdio();
}

const server = createServer({
  name: 'pdf-reader-mcp',
  version: packageJson.version,
  instructions:
    'MCP Server for inspecting PDF files, searching text evidence, rendering visual page evidence, cropping and analyzing visual regions, running configured OCR, and extracting text, metadata, images, citations, safety signals, and agent-ready document structure.',
  tools: {
    inspect_pdf: inspectPdf,
    read_pdf: readPdf,
    search_pdf: searchPdf,
    render_page: renderPage,
    extract_regions: extractRegions,
    analyze_regions: analyzeRegions,
    ocr_pages: ocrPages,
  },
  transport: createTransport(),
});

async function main(): Promise<void> {
  await server.start();

  // Log startup information
  if (transportType === 'http') {
    console.log(`[PDF Reader MCP] Server running on http://${httpHost}:${httpPort}/mcp`);
    console.log(`[PDF Reader MCP] Health check: http://${httpHost}:${httpPort}/mcp/health`);
    if (apiKey) {
      console.log('[PDF Reader MCP] API key authentication enabled (X-API-Key header)');
    }
    if (corsOrigin) {
      console.log(`[PDF Reader MCP] CORS allowed origin: ${corsOrigin}`);
    }
    console.log('[PDF Reader MCP] Project root:', process.cwd());
  } else if (process.env['DEBUG_MCP']) {
    // Only log startup message in debug mode to prevent stderr pollution
    // This prevents handshake failures with MCP clients that expect clean stdio
    console.error('[PDF Reader MCP] Server running on stdio');
    console.error('[PDF Reader MCP] Project root:', process.cwd());
  }
}

main().catch((error: unknown) => {
  console.error('[PDF Reader MCP] Server error:', error);
  process.exit(1);
});
