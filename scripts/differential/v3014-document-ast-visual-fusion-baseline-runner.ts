#!/usr/bin/env bun

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalDocumentAstVisualFusionResult } from './v3014-document-ast-visual-fusion-projection.ts';

const [corpusPath, fixtureDir, providerPath] = process.argv.slice(2);
if (!corpusPath || !fixtureDir || !providerPath) {
  throw new Error('usage: runner <corpus.json> <fixture-dir> <provider>');
}

const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as {
  cases: Array<{
    id: string;
    fixture: string;
    providerMode?: string;
    input: Record<string, unknown>;
  }>;
};

const invoke = async (
  entry: (typeof corpus.cases)[number]
): Promise<{ response: unknown; invocations: string[] }> => {
  const markerDir = mkdtempSync(join(tmpdir(), 'pdf-reader-visual-fusion-marker-'));
  const markerPath = join(markerDir, 'invocations.txt');
  writeFileSync(markerPath, '');
  const child = spawn(process.execPath, ['src/index.ts'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      MCP_TRANSPORT: 'stdio',
      MCP_PDF_REGION_ANALYSIS_COMMAND: process.execPath,
      MCP_PDF_REGION_ANALYSIS_ARGS_JSON: JSON.stringify([
        providerPath,
        '{input}',
        '{page}',
        '{region_id}',
        '{evidence_id}',
        '{languages}',
        entry.providerMode ?? 'success',
        markerPath,
      ]),
    },
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

  const request = (id: number, method: string, params: unknown): Promise<Record<string, unknown>> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`TS visual fusion request timed out: ${stderr.slice(-2000)}`));
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
      clientInfo: { name: 'v3014-document-ast-visual-fusion-baseline', version: '1' },
    });
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`
    );
    const input = structuredClone(entry.input);
    const sources = input.sources as Array<Record<string, unknown>>;
    for (const source of sources) source.path = join(fixtureDir, entry.fixture);
    const response = await request(2, 'tools/call', { name: 'read_pdf', arguments: input });
    const invocations = readFileSync(markerPath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    return { response, invocations };
  } finally {
    child.kill('SIGTERM');
    rmSync(markerDir, { recursive: true, force: true });
  }
};

const expectations: Record<string, unknown> = {};
for (const entry of corpus.cases) {
  const { response, invocations } = await invoke(entry);
  expectations[entry.id] = canonicalDocumentAstVisualFusionResult(response, invocations);
}
console.log(JSON.stringify(expectations));
