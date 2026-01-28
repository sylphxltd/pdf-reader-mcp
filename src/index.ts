#!/usr/bin/env node

import { createServer, http, stdio } from '@sylphx/mcp-server-sdk';
import { readPdf } from './handlers/readPdf.js';

// Transport configuration via environment variables
// MCP_TRANSPORT: 'stdio' (default) | 'http'
// MCP_HTTP_PORT: HTTP port (default: 8080)
// MCP_HTTP_HOST: HTTP hostname (default: '0.0.0.0')
// MCP_API_KEY: Optional API key for authentication (X-API-Key header)
const transportType = process.env['MCP_TRANSPORT'] ?? 'stdio';
const httpPort = Number.parseInt(process.env['MCP_HTTP_PORT'] ?? '8080', 10);
const httpHost = process.env['MCP_HTTP_HOST'] ?? '0.0.0.0';
const apiKey = process.env['MCP_API_KEY'];

/**
 * Create the appropriate transport based on configuration
 */
function createTransport() {
  if (transportType === 'http') {
    return http({
      port: httpPort,
      hostname: httpHost,
      cors: '*', // Allow cross-origin requests for remote access
    });
  }
  return stdio();
}

const server = createServer({
  name: 'pdf-reader-mcp',
  version: '2.1.0',
  instructions:
    'MCP Server for reading PDF files and extracting text, metadata, images, and page information.',
  tools: { read_pdf: readPdf },
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
