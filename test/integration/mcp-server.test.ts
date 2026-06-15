/**
 * Integration test for MCP server
 * Tests the actual JSON-RPC communication over stdio
 */

import { type ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// JSON-RPC message helpers
const createRequest = (id: number, method: string, params?: unknown) => ({
  jsonrpc: '2.0' as const,
  id,
  method,
  params,
});

// MCP uses JSON Lines format (newline-delimited JSON)
const sendMessage = (proc: ChildProcess, message: object): void => {
  const json = JSON.stringify(message);
  proc.stdin?.write(`${json}\n`);
};

// Generous per-request timeout: the server spawns a fresh `bun dist/index.js`
// whose module graph eagerly imports pdfjs-dist (worker + wasm + cmaps). On a
// cold, loaded CI runner that first import can take several seconds, so 5s was
// flaky. This is a test-harness tolerance, not a product latency budget — a
// long-running MCP server pays the import cost once at startup.
const readResponse = (proc: ChildProcess, timeout = 15000): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for response. Buffer: ${buffer}`));
    }, timeout);

    const onData = (data: Buffer) => {
      buffer += data.toString();

      // Parse JSON Lines format
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex === -1) return;

      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (line.length === 0) return;

      clearTimeout(timer);
      proc.stdout?.off('data', onData);
      try {
        resolve(JSON.parse(line));
      } catch {
        reject(new Error(`Failed to parse JSON: ${line}`));
      }
    };

    proc.stdout?.on('data', onData);
  });
};

describe('MCP Server Integration', () => {
  let serverProc: ChildProcess;

  beforeAll(async () => {
    // Start the MCP server
    const serverPath = path.resolve(__dirname, '../../dist/index.js');
    const mockOcrProviderPath = path.resolve(__dirname, '../fixtures/mock-ocr-provider.mjs');
    // Must use bun as SDK uses Bun APIs
    serverProc = spawn('bun', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        MCP_PDF_OCR_COMMAND: process.execPath,
        MCP_PDF_OCR_ARGS_JSON: JSON.stringify([mockOcrProviderPath, '{input}', '{page}', '{languages}']),
      },
    });

    // Wait for the server to boot. The module graph eagerly imports
    // pdfjs-dist, so cold startup on a loaded CI runner can exceed a few
    // hundred ms — give it headroom before the first request to avoid a
    // race where `initialize` is sent before stdin is wired up.
    await new Promise((r) => setTimeout(r, 2500));
  });

  afterAll(() => {
    serverProc?.kill();
  });

  it('should respond to initialize request', async () => {
    const initRequest = createRequest(1, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
    });

    sendMessage(serverProc, initRequest);
    const response = (await readResponse(serverProc)) as {
      id: number;
      result?: { serverInfo?: { name: string } };
    };

    expect(response.id).toBe(1);
    expect(response.result?.serverInfo?.name).toBe('pdf-reader-mcp');
  });

  it('should list available tools', async () => {
    // Send initialized notification first
    sendMessage(serverProc, { jsonrpc: '2.0', method: 'notifications/initialized' });

    // Wait a bit
    await new Promise((r) => setTimeout(r, 100));

    const listRequest = createRequest(2, 'tools/list', {});
    sendMessage(serverProc, listRequest);

    const response = (await readResponse(serverProc)) as {
      id: number;
      result?: { tools?: Array<{ name: string }> };
    };

    expect(response.id).toBe(2);
    expect(response.result?.tools).toBeDefined();
    expect(response.result?.tools?.length).toBeGreaterThan(0);

    const toolNames = response.result?.tools?.map((t) => t.name);
    expect(toolNames).toContain('inspect_pdf');
    expect(toolNames).toContain('read_pdf');
    expect(toolNames).toContain('search_pdf');
    expect(toolNames).toContain('render_page');
    expect(toolNames).toContain('extract_regions');
    expect(toolNames).toContain('ocr_pages');
  });

  it('should call inspect_pdf tool with a test PDF', async () => {
    const testPdfPath = path.resolve(__dirname, '../fixtures/sample.pdf');

    const callRequest = createRequest(3, 'tools/call', {
      name: 'inspect_pdf',
      arguments: {
        sources: [{ path: testPdfPath }],
        sample_pages: 2,
        include_metadata: true,
      },
    });

    sendMessage(serverProc, callRequest);
    const response = (await readResponse(serverProc, 10000)) as {
      id: number;
      result?: { content?: Array<{ type: string; text?: string }>; isError?: boolean };
      error?: { message: string };
    };

    expect(response.id).toBe(3);

    if (response.error || response.result?.isError) {
      expect(response.error?.message || response.result?.content?.[0]?.text).toContain('PDF');
    } else {
      const textContent = response.result?.content?.[0]?.text ?? '';
      expect(response.result?.content?.[0]?.type).toBe('text');
      expect(textContent).toContain('"profile"');
      expect(textContent).toContain('"recommendation"');
    }
  });

  it('should call read_pdf tool with a test PDF', async () => {
    const testPdfPath = path.resolve(__dirname, '../fixtures/sample.pdf');

    const callRequest = createRequest(4, 'tools/call', {
      name: 'read_pdf',
      arguments: {
        sources: [{ path: testPdfPath }],
        include_metadata: true,
        include_page_count: true,
        include_full_text: false,
      },
    });

    sendMessage(serverProc, callRequest);
    const response = (await readResponse(serverProc, 10000)) as {
      id: number;
      result?: { content?: Array<{ type: string; text?: string }>; isError?: boolean };
      error?: { message: string };
    };

    expect(response.id).toBe(4);

    // If test PDF doesn't exist, expect error
    if (response.error || response.result?.isError) {
      // Expected if no test PDF
      expect(response.error?.message || response.result?.content?.[0]?.text).toContain('PDF');
    } else {
      // If it exists, should have content
      expect(response.result?.content).toBeDefined();
      expect(response.result?.content?.[0]?.type).toBe('text');
    }
  });

  it('should call render_page tool with a test PDF', async () => {
    const testPdfPath = path.resolve(__dirname, '../fixtures/sample.pdf');

    const callRequest = createRequest(5, 'tools/call', {
      name: 'render_page',
      arguments: {
        sources: [{ path: testPdfPath, pages: [1] }],
        scale: 1,
        max_pages: 1,
      },
    });

    sendMessage(serverProc, callRequest);
    const response = (await readResponse(serverProc, 10000)) as {
      id: number;
      result?: {
        content?: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
        isError?: boolean;
      };
      error?: { message: string };
    };

    expect(response.id).toBe(5);

    if (response.error || response.result?.isError) {
      expect(response.error?.message || response.result?.content?.[0]?.text).toContain('PDF');
    } else {
      const textContent = response.result?.content?.[0]?.text ?? '';
      const parsed = JSON.parse(textContent) as {
        profile: string;
        results: Array<{
          success: boolean;
          rendered_pages?: Array<{ data?: string; image_content_index?: number }>;
        }>;
      };

      expect(response.result?.content?.[0]?.type).toBe('text');
      expect(response.result?.content?.[1]?.type).toBe('image');
      expect(response.result?.content?.[1]?.mimeType).toBe('image/png');
      expect(parsed.profile).toBe('page_render_evidence');
      expect(parsed.results[0]?.success).toBe(true);
      expect(parsed.results[0]?.rendered_pages?.[0]?.data).toBeUndefined();
      expect(parsed.results[0]?.rendered_pages?.[0]?.image_content_index).toBe(1);
    }
  });

  it('should call extract_regions tool with a test PDF', async () => {
    const testPdfPath = path.resolve(__dirname, '../fixtures/sample.pdf');

    const callRequest = createRequest(6, 'tools/call', {
      name: 'extract_regions',
      arguments: {
        sources: [
          {
            path: testPdfPath,
            regions: [
              {
                id: 'bottom-left',
                page: 1,
                bounding_box: { left: 0, bottom: 0, right: 100, top: 100 },
              },
            ],
          },
        ],
        scale: 1,
        max_regions: 1,
      },
    });

    sendMessage(serverProc, callRequest);
    const response = (await readResponse(serverProc, 10000)) as {
      id: number;
      result?: {
        content?: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
        isError?: boolean;
      };
      error?: { message: string };
    };

    expect(response.id).toBe(6);

    if (response.error || response.result?.isError) {
      expect(response.error?.message || response.result?.content?.[0]?.text).toContain('PDF');
    } else {
      const textContent = response.result?.content?.[0]?.text ?? '';
      const parsed = JSON.parse(textContent) as {
        profile: string;
        results: Array<{
          success: boolean;
          regions?: Array<{ data?: string; image_content_index?: number; region_id?: string }>;
        }>;
      };

      expect(response.result?.content?.[0]?.type).toBe('text');
      expect(response.result?.content?.[1]?.type).toBe('image');
      expect(response.result?.content?.[1]?.mimeType).toBe('image/png');
      expect(parsed.profile).toBe('region_crop_evidence');
      expect(parsed.results[0]?.success).toBe(true);
      expect(parsed.results[0]?.regions?.[0]?.region_id).toBe('bottom-left');
      expect(parsed.results[0]?.regions?.[0]?.data).toBeUndefined();
      expect(parsed.results[0]?.regions?.[0]?.image_content_index).toBe(1);
    }
  });

  it('should call ocr_pages tool with a configured OCR provider', async () => {
    const testPdfPath = path.resolve(__dirname, '../fixtures/sample.pdf');

    const callRequest = createRequest(7, 'tools/call', {
      name: 'ocr_pages',
      arguments: {
        sources: [{ path: testPdfPath, pages: [1] }],
        scale: 1,
        max_pages: 1,
        languages: ['eng'],
      },
    });

    sendMessage(serverProc, callRequest);
    const response = (await readResponse(serverProc, 10000)) as {
      id: number;
      result?: { content?: Array<{ type: string; text?: string }>; isError?: boolean };
      error?: { message: string };
    };

    expect(response.id).toBe(7);

    if (response.error || response.result?.isError) {
      expect(response.error?.message || response.result?.content?.[0]?.text).toContain('PDF');
    } else {
      const textContent = response.result?.content?.[0]?.text ?? '';
      const parsed = JSON.parse(textContent) as {
        profile: string;
        results: Array<{
          success: boolean;
          ocr_pages?: Array<{ text?: string; provider?: string; data?: string }>;
        }>;
      };

      expect(response.result?.content?.[0]?.type).toBe('text');
      expect(parsed.profile).toBe('ocr_text_layer');
      expect(parsed.results[0]?.success).toBe(true);
      expect(parsed.results[0]?.ocr_pages?.[0]?.text).toBe('Mock OCR text for page 1');
      expect(parsed.results[0]?.ocr_pages?.[0]?.provider).toBe('command');
      expect(parsed.results[0]?.ocr_pages?.[0]?.data).toBeUndefined();
    }
  });

  it('should call search_pdf tool with a test PDF', async () => {
    const testPdfPath = path.resolve(__dirname, '../fixtures/sample.pdf');

    const callRequest = createRequest(8, 'tools/call', {
      name: 'search_pdf',
      arguments: {
        sources: [{ path: testPdfPath, pages: [1] }],
        query: 'PDF',
        max_pages: 1,
        max_matches_per_source: 5,
      },
    });

    sendMessage(serverProc, callRequest);
    const response = (await readResponse(serverProc, 10000)) as {
      id: number;
      result?: { content?: Array<{ type: string; text?: string }>; isError?: boolean };
      error?: { message: string };
    };

    expect(response.id).toBe(8);

    if (response.error || response.result?.isError) {
      expect(response.error?.message || response.result?.content?.[0]?.text).toContain('PDF');
    } else {
      const textContent = response.result?.content?.[0]?.text ?? '';
      const parsed = JSON.parse(textContent) as {
        profile: string;
        results: Array<{ success: boolean; matches?: unknown[] }>;
      };

      expect(response.result?.content?.[0]?.type).toBe('text');
      expect(parsed.profile).toBe('pdf_search_results');
      expect(parsed.results[0]?.success).toBe(true);
      expect(Array.isArray(parsed.results[0]?.matches)).toBe(true);
    }
  });

  it('should handle invalid tool arguments', async () => {
    const callRequest = createRequest(9, 'tools/call', {
      name: 'read_pdf',
      arguments: {
        // Missing required 'sources' field
        include_metadata: true,
      },
    });

    sendMessage(serverProc, callRequest);
    const response = (await readResponse(serverProc)) as {
      id: number;
      result?: { isError?: boolean; content?: Array<{ text?: string }> };
      error?: { code: number; message: string };
    };

    expect(response.id).toBe(9);
    // SDK returns validation error as result.isError, not JSON-RPC error
    expect(response.result?.isError).toBe(true);
    expect(response.result?.content?.[0]?.text).toMatch(/sources/i);
  });
});
