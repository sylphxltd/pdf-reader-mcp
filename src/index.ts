#!/usr/bin/env node

import { createRequire } from 'node:module';
import { pdfEvidence } from './handlers/pdfEvidence.js';
import { readPdf } from './handlers/readPdf.js';
import { searchPdf } from './handlers/searchPdf.js';
import { createServer, http, stdio } from './mcp.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

// Transport configuration via environment variables
// MCP_TRANSPORT: 'stdio' (default) | 'http'
// MCP_HTTP_PORT: HTTP port (default: 8080)
// MCP_HTTP_HOST: HTTP hostname (default: '127.0.0.1' — loopback only; set
//   explicitly to expose on other interfaces, and set MCP_API_KEY when you do)
// MCP_API_KEY: Optional API key. When set, every /mcp request must present a
//   matching X-API-Key header; requests without it are rejected with 401.
// MCP_CORS_ORIGIN: CORS allowed origin (e.g. 'https://myapp.example.com'). Not set by default (no cross-origin access).
const transportType = process.env['MCP_TRANSPORT'] ?? 'stdio';
const httpPort = Number.parseInt(process.env['MCP_HTTP_PORT'] ?? '8080', 10);
const httpHost = process.env['MCP_HTTP_HOST'] ?? '127.0.0.1';
const apiKey = process.env['MCP_API_KEY'];
const corsOrigin = process.env['MCP_CORS_ORIGIN'];

/** Loopback hosts never reachable from another machine without extra config. */
const isLoopbackHost = (host: string): boolean =>
  host === 'localhost' || host === '::1' || host === '127.0.0.1' || host.startsWith('127.');

/**
 * Create the appropriate transport based on configuration
 */
function createTransport() {
  if (transportType === 'http') {
    return http({
      port: httpPort,
      hostname: httpHost,
      ...(corsOrigin ? { cors: corsOrigin } : {}),
      ...(apiKey ? { apiKey } : {}),
    });
  }
  return stdio();
}

const server = createServer({
  name: 'pdf-reader-mcp',
  version: packageJson.version,
  instructions:
    'V3 PDF intelligence MCP server. Use read_pdf first with auto=true for smart Agent Document Twin extraction, search_pdf for cheap literal evidence retrieval, and pdf_evidence for focused inspect, render, crop, OCR, or visual-region evidence operations.',
  tools: {
    read_pdf: readPdf,
    search_pdf: searchPdf,
    pdf_evidence: pdfEvidence,
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
      // Truthful only because the transport now enforces this key (see src/mcp.ts).
      console.log('[PDF Reader MCP] API key authentication enabled (X-API-Key header)');
    } else if (!isLoopbackHost(httpHost)) {
      console.warn(
        `[PDF Reader MCP] WARNING: bound to non-loopback host ${httpHost} with no API key. ` +
          'Any client that can reach this port can read every PDF this process can access. ' +
          'Set MCP_API_KEY to require an X-API-Key header, or bind MCP_HTTP_HOST=127.0.0.1.'
      );
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
