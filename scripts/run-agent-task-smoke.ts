#!/usr/bin/env bun
/**
 * Capability-first agent-task smoke runner.
 * Executes local-fixture tasks against the pure-Rust MCP server using semantic
 * acceptance predicates (not exact PDF.js JSON equality).
 */
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const manifest = JSON.parse(
  readFileSync(join(root, 'docs/specs/agent-task-corpus/manifest.json'), 'utf8')
) as { taskFiles: string[] };
const serverPath = join(root, 'target/release/pdf-reader-mcp-server');

if (!existsSync(serverPath)) {
  const build = spawnSync('cargo', ['build', '-p', 'pdf-reader-mcp-server', '--release'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (build.status !== 0) {
    console.error('[agent-task-smoke] release server build failed');
    process.exit(1);
  }
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const callTool = async (
  tool: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  const child = spawn(serverPath, [], {
    cwd: root,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, MCP_TRANSPORT: 'stdio', PDF_READER_ENGINE_MODE: 'pure-rust' },
  }) as ChildProcessWithoutNullStreams;
  let buffer = '';
  const pending = new Map<number, (value: Record<string, unknown>) => void>();
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    while (buffer.includes('\n')) {
      const index = buffer.indexOf('\n');
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      const response = JSON.parse(line) as Record<string, unknown>;
      const id = Number(response.id);
      const resolver = pending.get(id);
      if (resolver) {
        pending.delete(id);
        resolver(response);
      }
    }
  });
  const request = (id: number, method: string, params: Record<string, unknown>) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout ${method}: ${stderr.slice(-2000)}`)), 30000);
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
      clientInfo: { name: 'agent-task-smoke', version: '1' },
    });
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`
    );
    const response = await request(2, 'tools/call', { name: tool, arguments: args });
    return response;
  } finally {
    child.kill('SIGTERM');
  }
};

const publicPayload = (response: Record<string, unknown>): Record<string, unknown> => {
  const result = response.result as Record<string, unknown> | undefined;
  if (!result) throw new Error(`missing result: ${JSON.stringify(response).slice(0, 500)}`);
  if (Array.isArray(result.content)) {
    const textPart = result.content.find(
      (entry) => entry && typeof entry === 'object' && (entry as { type?: string }).type === 'text'
    ) as { text?: string } | undefined;
    if (textPart?.text) return JSON.parse(textPart.text) as Record<string, unknown>;
  }
  if (result.structuredContent && typeof result.structuredContent === 'object') {
    return result.structuredContent as Record<string, unknown>;
  }
  return result;
};

const failures: string[] = [];

for (const rel of manifest.taskFiles) {
  const task = JSON.parse(
    readFileSync(join(root, 'docs/specs/agent-task-corpus', rel), 'utf8')
  ) as {
    id: string;
    tool: string;
    input: Record<string, unknown>;
    acceptance: Record<string, unknown>;
  };
  // Resolve relative fixture paths against repo root for server
  const input = structuredClone(task.input);
  if (Array.isArray(input.sources)) {
    for (const source of input.sources as Array<Record<string, unknown>>) {
      if (typeof source.path === 'string' && !source.path.startsWith('/')) {
        source.path = join(root, source.path);
      }
    }
  }
  try {
    const response = await callTool(task.tool, input);
    const isError = Boolean((response.result as { isError?: boolean } | undefined)?.isError);
    const payload = publicPayload(response);
    const results = (payload.results as Array<Record<string, unknown>> | undefined) ?? [];
    const first = results[0] ?? payload;
    const success = first.success === true;
    const data = (first.data as Record<string, unknown> | undefined) ?? {};
    const acc = task.acceptance;

    if (acc.resultSuccess === true && (isError || !success)) {
      failures.push(`${task.id}: expected success`);
      continue;
    }
    const pageTexts = (data.page_texts as Array<Record<string, unknown>> | undefined) ?? [];
    const joinedPageText = pageTexts
      .map((entry) => String(entry.text ?? ''))
      .join('\n');
    const fullText = String(data.full_text ?? data.text ?? joinedPageText ?? '');
    if (typeof acc.minFullTextChars === 'number') {
      if (fullText.length < acc.minFullTextChars) {
        failures.push(`${task.id}: full text too short (${fullText.length})`);
      }
    }
    if (typeof acc.requirePageCountAtLeast === 'number') {
      const pages = Number(data.num_pages ?? data.page_count ?? 0);
      if (!(pages >= acc.requirePageCountAtLeast)) {
        failures.push(`${task.id}: page count missing/too small`);
      }
    }
    if (typeof acc.minTables === 'number') {
      const topTables = (data.tables as unknown[] | undefined) ?? [];
      const tableInfo = (data.table_info as unknown[] | undefined) ?? [];
      const elementTables = (
        (data.elements as Array<Record<string, unknown>> | undefined) ?? []
      ).filter((entry) => entry.kind === 'table' || entry.type === 'table');
      const tables = topTables.length
        ? topTables
        : tableInfo.length
          ? tableInfo
          : elementTables;
      if (tables.length < acc.minTables) {
        failures.push(`${task.id}: expected tables (tables/table_info/elements)`);
      }
      if (acc.requireTablePage === 1 && tables[0] && typeof tables[0] === 'object') {
        const page = Number((tables[0] as { page?: number }).page ?? 1);
        if (page < 1) failures.push(`${task.id}: table page invalid`);
      }
    }
    if (typeof acc.minMatches === 'number') {
      // search payload shapes vary: matches at top-level result or data
      const matches =
        (first.matches as unknown[] | undefined) ??
        (data.matches as unknown[] | undefined) ??
        (payload.matches as unknown[] | undefined) ??
        [];
      // also common: results[].matches
      const nested = results.flatMap((result) =>
        Array.isArray(result.matches) ? (result.matches as unknown[]) : []
      );
      const all = matches.length ? matches : nested;
      if (all.length < acc.minMatches) failures.push(`${task.id}: expected search matches, got ${all.length}`);
      if (typeof acc.requireMatchPageAtLeast === 'number' && all[0] && typeof all[0] === 'object') {
        const page = Number((all[0] as { page?: number }).page ?? 0);
        if (!(page >= acc.requireMatchPageAtLeast)) {
          failures.push(`${task.id}: match page missing`);
        }
      }
    }
    if (acc.requireWarningOrEmptyText === true) {
      const text = fullText;
      const warnings = (data.warnings as unknown[] | undefined) ?? (first.warnings as unknown[] | undefined) ?? [];
      if (text.trim().length > 0 && (!Array.isArray(warnings) || warnings.length === 0)) {
        // success with empty-ish selected content is ok; inventing substantial text is not
        if (text.trim().length >= 40) {
          failures.push(`${task.id}: invalid page invented substantial text without warnings`);
        }
      }
    }
    if (acc.forbidInventedFullText === true) {
      const text = fullText;
      // page 9999 should not yield a normal multi-sentence extraction
      if (text.length > 200) failures.push(`${task.id}: invalid page produced excessive text`);
    }
  } catch (error) {
    failures.push(`${task.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(
  `[agent-task-smoke] PASS ${manifest.taskFiles.length} local tasks under capability-first predicates`
);
