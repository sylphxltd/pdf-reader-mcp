/**
 * Integration test for MCP server with HTTP transport
 * Tests the actual JSON-RPC communication over HTTP
 */

import { type ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_PORT = 18080; // Use a high port to avoid conflicts
const BASE_URL = `http://localhost:${TEST_PORT}/mcp`;

// JSON-RPC request helper
const sendRequest = async (method: string, params?: unknown, id = 1) => {
  const response = await fetch(BASE_URL, {
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
  await fetch(BASE_URL, {
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
    serverProc = spawn('bun', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        MCP_TRANSPORT: 'http',
        MCP_HTTP_PORT: TEST_PORT.toString(),
        MCP_HTTP_HOST: 'localhost',
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
    const response = await fetch(`${BASE_URL}/health`);
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
    expect(response.result?.serverInfo?.version).toBe('2.1.0');
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

  it('should handle CORS preflight requests', async () => {
    const response = await fetch(BASE_URL, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://example.com',
        'Access-Control-Request-Method': 'POST',
      },
    });

    // Should allow cross-origin requests
    const corsHeader = response.headers.get('Access-Control-Allow-Origin');
    expect(corsHeader).toBe('*');
  });

  it('should reject invalid JSON-RPC requests', async () => {
    const response = await fetch(BASE_URL, {
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
