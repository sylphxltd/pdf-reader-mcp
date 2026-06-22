/**
 * Integration test for MCP server with HTTP transport
 * Tests the actual JSON-RPC communication over HTTP
 */

import { type ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_HOST = '127.0.0.1';
let baseUrl: string;
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
) as {
  version: string;
};

const getFreePort = async (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, TEST_HOST, () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === 'object' && address) {
          resolve(address.port);
        } else {
          reject(new Error('Failed to allocate a test HTTP port'));
        }
      });
    });
  });

// JSON-RPC request helper
const sendRequest = async (method: string, params?: unknown, id = 1) => {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params,
    }),
  });
  return response.json();
};

// Send notification (no response expected for proper notifications)
const sendNotification = async (method: string, params?: unknown) => {
  await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
    }),
  });
};

describe('MCP Server HTTP Transport Integration', () => {
  let serverProc: ChildProcess;

  beforeAll(async () => {
    // Start the MCP server with HTTP transport
    const serverPath = path.resolve(__dirname, '../../dist/index.js');
    const testPort = await getFreePort();
    baseUrl = `http://${TEST_HOST}:${String(testPort)}/mcp`;
    serverProc = spawn('bun', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        MCP_TRANSPORT: 'http',
        MCP_HTTP_PORT: testPort.toString(),
        MCP_HTTP_HOST: TEST_HOST,
      },
    });

    // Wait for server to start and listen
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 10000);

      serverProc.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Server running on http://')) {
          clearTimeout(timeout);
          // Give it a moment after the log appears
          setTimeout(resolve, 200);
        }
      });

      serverProc.stderr?.on('data', (data) => {
        console.error('Server stderr:', data.toString());
      });
    });
  });

  afterAll(() => {
    serverProc?.kill('SIGTERM');
  });

  it('should respond to health check', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  it('should respond to initialize request over HTTP', async () => {
    const response = await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-http-client', version: '1.0.0' },
    });

    expect(response.id).toBe(1);
    expect(response.result?.serverInfo?.name).toBe('pdf-reader-mcp');
    expect(response.result?.serverInfo?.version).toBe(packageJson.version);
  });

  it('should list available tools over HTTP', async () => {
    // Send initialized notification
    await sendNotification('notifications/initialized');

    // Wait a moment
    await new Promise((r) => setTimeout(r, 100));

    const response = await sendRequest('tools/list', {}, 2);

    expect(response.id).toBe(2);
    expect(response.result?.tools).toBeDefined();
    expect(response.result?.tools?.length).toBeGreaterThan(0);

    const toolNames = response.result?.tools?.map((t: { name: string }) => t.name);
    expect(toolNames).toContain('read_pdf');
    expect(toolNames).toContain('search_pdf');
    expect(toolNames).toContain('pdf_evidence');
    expect(toolNames).not.toContain('inspect_pdf');
    expect(toolNames).not.toContain('render_page');
    expect(toolNames).not.toContain('extract_regions');
    expect(toolNames).not.toContain('analyze_regions');
    expect(toolNames).not.toContain('ocr_pages');
  });

  it('should call read_pdf tool over HTTP', async () => {
    const testPdfPath = path.resolve(__dirname, '../fixtures/sample.pdf');

    const response = await sendRequest(
      'tools/call',
      {
        name: 'read_pdf',
        arguments: {
          sources: [{ path: testPdfPath }],
          include_metadata: true,
          include_page_count: true,
          include_full_text: false,
        },
      },
      3
    );

    expect(response.id).toBe(3);

    // If test PDF doesn't exist, expect error
    if (response.error || response.result?.isError) {
      expect(response.error?.message || response.result?.content?.[0]?.text).toContain('PDF');
    } else {
      expect(response.result?.content).toBeDefined();
      expect(response.result?.content?.[0]?.type).toBe('text');
    }
  });

  it('should not return wildcard CORS headers by default', async () => {
    const response = await fetch(baseUrl, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://example.com',
        'Access-Control-Request-Method': 'POST',
      },
    });

    // Without MCP_CORS_ORIGIN, no CORS wildcard should be set
    const corsHeader = response.headers.get('Access-Control-Allow-Origin');
    expect(corsHeader).not.toBe('*');
  });

  it('should reject invalid JSON-RPC requests', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        // Missing jsonrpc version
        id: 1,
        method: 'initialize',
      }),
    });

    const data = await response.json();
    expect(data.error).toBeDefined();
    // -32700 = Parse error, -32600 = Invalid Request (both indicate rejection of malformed requests)
    expect([-32600, -32700]).toContain(data.error.code);
  });
});
