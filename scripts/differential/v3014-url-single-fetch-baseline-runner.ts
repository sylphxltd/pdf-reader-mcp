#!/usr/bin/env bun

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalUrlSingleFetchResult } from './v3014-url-single-fetch-projection.ts';

const [corpusPath, fixtureDir, providerPath, serverScriptPath] = process.argv.slice(2);
if (!corpusPath || !fixtureDir || !providerPath || !serverScriptPath) {
  throw new Error(
    'usage: v3014-url-single-fetch-baseline-runner <corpus.json> <fixtureDir> <ocr-provider.ts> <fixture-server.ts>'
  );
}

type Case = {
  id: string;
  tool: 'read_pdf' | 'search_pdf';
  fixture: string;
  providerMode?: string;
  input: Record<string, unknown>;
};
type Corpus = { cases: Case[] };
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as Corpus;
// Capture copies this runner into a detached v3.0.14 worktree root and invokes
// it with cwd=worktree. Use process.cwd() so the TS server entrypoint resolves
// inside that worktree (import.meta.url would point at scripts/ only in-repo).
const repoRoot = process.cwd();

const startServer = async (
  fixture: string
): Promise<{ url: string; counterPath: string; stop: () => void }> => {
  const work = mkdtempSync(join(tmpdir(), 'pdf-url-single-fetch-'));
  const counterPath = join(work, 'counter.json');
  const pdfPath = join(fixtureDir, fixture);
  writeFileSync(counterPath, `${JSON.stringify({ hits: 0 })}\n`);
  const child = spawn(process.execPath, [serverScriptPath, pdfPath, counterPath, '0'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const started = Date.now();
  while (!stdout.includes('\n')) {
    if (Date.now() - started > 10_000) {
      child.kill('SIGTERM');
      throw new Error(`fixture server failed to start: ${stderr}`);
    }
    await Bun.sleep(20);
  }
  const info = JSON.parse(stdout.trim().split('\n')[0]!) as { port: number; path: string };
  return {
    url: `http://127.0.0.1:${String(info.port)}${info.path}`,
    counterPath,
    stop: () => {
      child.kill('SIGTERM');
      rmSync(work, { recursive: true, force: true });
    },
  };
};

const runCase = async (entry: Case): Promise<unknown> => {
  const server = await startServer(entry.fixture);
  try {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      MCP_TRANSPORT: 'stdio',
      MCP_PDF_ALLOW_PRIVATE_IPS: 'true',
      MCP_PDF_OCR_COMMAND: process.execPath,
      MCP_PDF_OCR_ARGS_JSON: JSON.stringify([
        providerPath,
        '{input}',
        '{page}',
        '{languages}',
        entry.providerMode ?? 'success',
      ]),
    };
    const child = spawn(process.execPath, ['src/index.ts'], {
      cwd: repoRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    }) as ChildProcessWithoutNullStreams;
    let buffer = '';
    let stderr = '';
    const pending = new Map<number, (value: Record<string, unknown>) => void>();
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      while (buffer.includes('\n')) {
        const index = buffer.indexOf('\n');
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        const response = JSON.parse(line) as Record<string, unknown>;
        pending.get(Number(response.id))?.(response);
        pending.delete(Number(response.id));
      }
    });
    const request = (
      id: number,
      method: string,
      params: unknown
    ): Promise<Record<string, unknown>> =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`TS url single-fetch timed out: ${stderr.slice(-2000)}`));
        }, 120_000);
        pending.set(id, (value) => {
          clearTimeout(timer);
          resolve(value);
        });
        child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
      });
    try {
      await request(1, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'v3014-url-single-fetch-baseline', version: '1' },
      });
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`
      );
      const input = structuredClone(entry.input);
      const sources = input.sources as Array<Record<string, unknown>>;
      for (const source of sources) {
        delete source.path;
        source.url = server.url;
      }
      const response = await request(2, 'tools/call', {
        name: entry.tool,
        arguments: input,
      });
      const counter = JSON.parse(readFileSync(server.counterPath, 'utf8')) as { hits: number };
      return canonicalUrlSingleFetchResult(response, {
        tool: entry.tool,
        fetchHits: counter.hits,
      });
    } finally {
      child.kill('SIGTERM');
    }
  } finally {
    server.stop();
  }
};

const expectations: Record<string, unknown> = {};
for (const entry of corpus.cases) expectations[entry.id] = await runCase(entry);
console.log(JSON.stringify(expectations));
