/**
 * Shared helpers for production-path MCP contract tests.
 * Always exercise the published launcher with full-parity engine (never pure-rust).
 */
import { type ChildProcess, execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const repoRoot = path.resolve(import.meta.dirname, '../..');
export const binWrapper = path.join(repoRoot, 'bin/pdf-reader-mcp');
export const samplePdf = path.join(repoRoot, 'test/fixtures/sample.pdf');
export const fixturesRoot = path.join(repoRoot, 'test/fixtures');

export type JsonRpcResponse = {
  jsonrpc?: string;
  id?: number | string;
  result?: {
    serverInfo?: { name?: string; version?: string; instructions?: string };
    tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>;
    content?: Array<{ type?: string; text?: string; data?: string; mimeType?: string }>;
    isError?: boolean;
    structuredContent?: Record<string, unknown>;
  };
  error?: { code?: number; message?: string };
};

export const packageJson = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
) as { version: string; bin?: Record<string, string> };

export const ensureProductionArtifacts = () => {
  execSync('bun run build', { cwd: repoRoot, stdio: 'pipe', timeout: 180_000 });
  execSync('bun run build:rust', { cwd: repoRoot, stdio: 'pipe', timeout: 300_000 });
  if (!fs.existsSync(binWrapper)) {
    throw new Error(`missing launcher: ${binWrapper}`);
  }
  if (!fs.existsSync(path.join(repoRoot, 'bin/native/pdf-reader-mcp-server'))) {
    throw new Error('missing staged Rust MCP server binary');
  }
  if (!fs.existsSync(path.join(repoRoot, 'dist/legacy-engine-runtime.js'))) {
    throw new Error('missing full-parity TS engine runtime');
  }
  if (!fs.existsSync(path.join(repoRoot, 'dist/pdf.worker.mjs'))) {
    throw new Error('missing staged pdfjs worker');
  }
};

export const productionEnv = (overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => {
  const env = { ...process.env, ...overrides };
  // Hard production contract: never allow pure-rust subset to masquerade as default.
  delete env.PDF_READER_PURE_RUST;
  env.PDF_READER_ENGINE_MODE = 'full';
  env.PDF_READER_MCP_ENGINE = env.PDF_READER_MCP_ENGINE ?? 'rust';
  env.NODE_ENV = env.NODE_ENV ?? 'test';
  env.MCP_TRANSPORT = env.MCP_TRANSPORT ?? '';
  env.PDF_READER_MCP_TRANSPORT = env.PDF_READER_MCP_TRANSPORT ?? '';
  return env;
};

export const createRequest = (id: number, method: string, params?: unknown) => ({
  jsonrpc: '2.0' as const,
  id,
  method,
  params,
});

export const sendMessage = (proc: ChildProcess, message: object): void => {
  proc.stdin?.write(`${JSON.stringify(message)}\n`);
};

export const readResponse = (proc: ChildProcess, timeoutMs = 45_000): Promise<JsonRpcResponse> =>
  new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for MCP response. Buffer: ${buffer.slice(0, 2000)}`));
    }, timeoutMs);

    const onData = (data: Buffer) => {
      buffer += data.toString();
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex === -1) return;
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) return;
      cleanup();
      try {
        resolve(JSON.parse(line) as JsonRpcResponse);
      } catch {
        reject(new Error(`Failed to parse MCP JSON line: ${line.slice(0, 500)}`));
      }
    };

    const onExit = (code: number | null) => {
      cleanup();
      reject(
        new Error(`MCP process exited early (code=${code}). Buffer: ${buffer.slice(0, 1000)}`)
      );
    };

    const cleanup = () => {
      clearTimeout(timer);
      proc.stdout?.off('data', onData);
      proc.off('exit', onExit);
    };

    proc.stdout?.on('data', onData);
    proc.on('exit', onExit);
  });

export const spawnProductionMcp = (envOverrides: NodeJS.ProcessEnv = {}): ChildProcess =>
  spawn(binWrapper, [], {
    cwd: repoRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: productionEnv(envOverrides),
  });

export const initializeSession = async (
  proc: ChildProcess,
  clientName = 'production-contract'
): Promise<JsonRpcResponse> => {
  sendMessage(
    proc,
    createRequest(1, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: clientName, version: '1.0.0' },
    })
  );
  const init = await readResponse(proc);
  sendMessage(proc, { jsonrpc: '2.0', method: 'notifications/initialized' });
  await new Promise((r) => setTimeout(r, 50));
  return init;
};

export const callTool = async (
  proc: ChildProcess,
  id: number,
  name: string,
  args: Record<string, unknown>,
  timeoutMs = 60_000
): Promise<JsonRpcResponse> => {
  sendMessage(
    proc,
    createRequest(id, 'tools/call', {
      name,
      arguments: args,
    })
  );
  return readResponse(proc, timeoutMs);
};

export const listTools = async (proc: ChildProcess, id = 2): Promise<JsonRpcResponse> => {
  sendMessage(proc, createRequest(id, 'tools/list', {}));
  return readResponse(proc);
};

export const parseToolPayload = (
  response: JsonRpcResponse
): { isError: boolean; text: string; json?: Record<string, unknown> } => {
  if (response.error) {
    return { isError: true, text: response.error.message ?? 'rpc error' };
  }
  const result = response.result;
  if (!result) {
    return { isError: true, text: 'missing result' };
  }
  if (result.structuredContent && typeof result.structuredContent === 'object') {
    return {
      isError: Boolean(result.isError),
      text: JSON.stringify(result.structuredContent),
      json: result.structuredContent as Record<string, unknown>,
    };
  }
  const text = result.content?.[0]?.text ?? '';
  if (!text) {
    return { isError: Boolean(result.isError), text: '' };
  }
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    return { isError: Boolean(result.isError), text, json };
  } catch {
    return { isError: Boolean(result.isError), text };
  }
};

export const assertToolSuccess = (response: JsonRpcResponse, label: string) => {
  const payload = parseToolPayload(response);
  if (payload.isError) {
    throw new Error(`${label} failed: ${payload.text.slice(0, 800)}`);
  }
  return payload;
};
