#!/usr/bin/env bun
/**
 * Capability-first agent-task smoke runner (pure-Rust).
 * Semantic acceptance predicates only — not exact PDF.js JSON equality.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  callMcpTool,
  evaluateAcceptance,
  extractMetrics,
  loadTasks,
  publicPayload,
  resolveInput,
  resolveTaskEnv,
} from './agent-task-shared.ts';

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

const tasks = loadTasks(root, manifest.taskFiles);
const failures: string[] = [];

for (const task of tasks) {
  try {
    const env = resolveTaskEnv(task, root, {
      ...process.env,
      MCP_TRANSPORT: 'stdio',
      PDF_READER_ENGINE_MODE: 'pure-rust',
    });
    const response = await callMcpTool({
      command: serverPath,
      env,
      tool: task.tool,
      toolArgs: resolveInput(task.input, root),
      cwd: root,
      timeoutMs: 60_000,
    });
    const payload = publicPayload(response);
    const metrics = extractMetrics(response, payload);
    const acceptance = evaluateAcceptance(task.acceptance, metrics);
    if (!acceptance.pass) {
      failures.push(`${task.id}: ${acceptance.failures.join('; ')}`);
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
  `[agent-task-smoke] PASS ${tasks.length} local tasks under capability-first predicates`
);
