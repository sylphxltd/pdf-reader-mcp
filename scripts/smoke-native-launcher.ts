#!/usr/bin/env bun
/**
 * Local pure-Rust launcher smoke (not registry install proof).
 * Verifies platform mapping + staged binary resolution + MCP initialize.
 * Keeps publishFreeze/dropInFor3014 product truth unchanged.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  nativeBinaryRelativePath,
  resolveNativePlatformId,
} from './native/platform-package-map.ts';

const repoRoot = join(import.meta.dirname, '..');
const platformId = resolveNativePlatformId();
if (!platformId) {
  console.error(`unsupported host platform ${process.platform}/${process.arch}`);
  process.exit(2);
}

const staged = join(repoRoot, nativeBinaryRelativePath(platformId));
const packageBin = join(
  repoRoot,
  `packages/pdf-reader-mcp-${platformId}/bin`,
  platformId.startsWith('win32') ? 'pdf-reader-mcp-server.exe' : 'pdf-reader-mcp-server'
);

if (!existsSync(staged) && !existsSync(packageBin)) {
  console.error(
    `[smoke-native-launcher] missing staged binary for ${platformId}. Run: bun run build:rust`
  );
  process.exit(1);
}

const child = spawn(join(repoRoot, 'bin/pdf-reader-mcp'), [], {
  cwd: repoRoot,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    PDF_READER_ENGINE_MODE: 'pure-rust',
    MCP_TRANSPORT: 'stdio',
  },
});

let buffer = '';
let resolved = false;
const fail = (message: string) => {
  if (resolved) return;
  resolved = true;
  child.kill('SIGTERM');
  console.error(`[smoke-native-launcher] ${message}`);
  process.exit(1);
};

const timer = setTimeout(() => fail('timed out waiting for initialize'), 15_000);
child.stderr.on('data', () => {});
child.stdout.on('data', (chunk: Buffer) => {
  buffer += chunk.toString();
  while (buffer.includes('\n')) {
    const index = buffer.indexOf('\n');
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    let response: Record<string, unknown>;
    try {
      response = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (response.id !== 1) continue;
    const result = response.result as Record<string, unknown> | undefined;
    const serverInfo = result?.serverInfo as Record<string, unknown> | undefined;
    if (serverInfo?.name !== 'pdf-reader-mcp') {
      fail(`unexpected serverInfo: ${JSON.stringify(serverInfo)}`);
    }
    clearTimeout(timer);
    resolved = true;
    child.kill('SIGTERM');
    console.log(
      JSON.stringify(
        {
          profile: 'pdf_native_launcher_smoke',
          platformId,
          stagedPath: existsSync(staged) ? staged : packageBin,
          serverName: serverInfo?.name,
          serverVersion: serverInfo?.version,
          productTruth: { dropInFor3014: false, publishFreeze: true },
          pass: true,
        },
        null,
        2
      )
    );
    process.exit(0);
  }
});
child.on('exit', (code) => {
  if (!resolved) fail(`launcher exited early with code ${String(code)}`);
});

child.stdin.write(
  `${JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'native-launcher-smoke', version: '1' },
    },
  })}\n`
);
