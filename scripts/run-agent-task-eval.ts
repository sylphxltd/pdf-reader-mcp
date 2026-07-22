#!/usr/bin/env bun
/**
 * Capability-first agent-task evaluation (ADR-0005).
 *
 * - Measures semantic metrics on the same local corpus for TS baseline and
 *   pure-Rust candidate.
 * - Thresholds come from measured TS baseline metrics, never invented %.
 * - Exact PDF.js JSON equality is intentionally not required.
 */
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = join(import.meta.dirname, '..');
const corpusDir = join(root, 'docs/specs/agent-task-corpus');
const manifestPath = join(corpusDir, 'manifest.json');
const baselinePath = join(corpusDir, 'baselines/typescript-v3.0.14.local.json');
const rustServerPath = join(root, 'target/release/pdf-reader-mcp-server');
const tsServerPath = join(root, 'dist/index.js');

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type RuntimeId = 'typescript' | 'pure-rust';

type Task = {
  id: string;
  class?: string;
  tool: string;
  fixture?: string;
  input: Record<string, unknown>;
  acceptance: Record<string, unknown>;
  contractIds?: string[];
};

type Metrics = {
  success: boolean;
  isError: boolean;
  fullTextChars: number;
  pageCount: number | null;
  tableCount: number;
  matchCount: number;
  firstMatchPage: number | null;
  firstTablePage: number | null;
  outlineCount: number;
  formFieldCount: number;
  annotationCount: number;
  warningCount: number;
  inventedFullTextRisk: boolean;
};

type TaskMeasurement = {
  taskId: string;
  class?: string;
  runtime: RuntimeId;
  metrics: Metrics;
  acceptancePass: boolean;
  acceptanceFailures: string[];
};

const args = process.argv.slice(2);
const writeBaseline = args.includes('--write-baseline');
const compareToBaseline = args.includes('--compare-baseline') || !args.includes('--no-compare');
const runtimes: RuntimeId[] = args.includes('--runtime=typescript')
  ? ['typescript']
  : args.includes('--runtime=pure-rust')
    ? ['pure-rust']
    : args.includes('--runtime=both') || writeBaseline
      ? ['typescript', 'pure-rust']
      : ['pure-rust'];

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  taskFiles: string[];
  baselineRuntime?: string;
  candidateRuntime?: string;
  calibration?: { inventedNumericThresholdsForbidden?: boolean };
};

if (manifest.calibration?.inventedNumericThresholdsForbidden !== true) {
  console.error('[agent-task-eval] invented numeric thresholds are forbidden by manifest');
  process.exit(1);
}

const ensureRustServer = () => {
  if (existsSync(rustServerPath)) return;
  const build = spawnSync('cargo', ['build', '-p', 'pdf-reader-mcp-server', '--release'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (build.status !== 0) {
    console.error('[agent-task-eval] pure-rust release server build failed');
    process.exit(1);
  }
};

const ensureTsServer = () => {
  if (existsSync(tsServerPath)) return;
  console.error('[agent-task-eval] missing dist/index.js; run bun run build first for TS baseline');
  process.exit(1);
};

const callTool = async (
  runtime: RuntimeId,
  tool: string,
  toolArgs: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  const child =
    runtime === 'pure-rust'
      ? (spawn(rustServerPath, [], {
          cwd: root,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, MCP_TRANSPORT: 'stdio', PDF_READER_ENGINE_MODE: 'pure-rust' },
        }) as ChildProcessWithoutNullStreams)
      : (spawn(process.execPath, [tsServerPath], {
          cwd: root,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            MCP_TRANSPORT: 'stdio',
            // Explicitly leave pure-rust opt-in unset for TS LKG path.
            PDF_READER_ENGINE_MODE: '',
          },
        }) as ChildProcessWithoutNullStreams);

  let buffer = '';
  let stderr = '';
  const pending = new Map<number, (value: Record<string, unknown>) => void>();
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
      try {
        const response = JSON.parse(line) as Record<string, unknown>;
        const id = Number(response.id);
        const resolver = pending.get(id);
        if (resolver) {
          pending.delete(id);
          resolver(response);
        }
      } catch {
        // ignore non-JSON noise
      }
    }
  });

  const request = (id: number, method: string, params: Record<string, unknown>) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`timeout ${runtime} ${method}: ${stderr.slice(-2000)}`)),
        45000
      );
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
      clientInfo: { name: 'agent-task-eval', version: '1' },
    });
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`
    );
    return await request(2, 'tools/call', { name: tool, arguments: toolArgs });
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

const asRecordArray = (value: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => entry && typeof entry === 'object') as Array<
    Record<string, unknown>
  >;
};

const resolveInput = (input: Record<string, unknown>): Record<string, unknown> => {
  const resolved = structuredClone(input);
  if (Array.isArray(resolved.sources)) {
    for (const source of resolved.sources as Array<Record<string, unknown>>) {
      if (typeof source.path === 'string' && !source.path.startsWith('/')) {
        source.path = join(root, source.path);
      }
    }
  }
  return resolved;
};

const extractMetrics = (
  response: Record<string, unknown>,
  payload: Record<string, unknown>
): Metrics => {
  const result = (response.result as Record<string, unknown> | undefined) ?? {};
  const isError = result.isError === true;
  const results = asRecordArray(payload.results);
  const first = (results[0] ?? payload) as Record<string, unknown>;
  const data =
    first.data && typeof first.data === 'object'
      ? (first.data as Record<string, unknown>)
      : first;

  const pageTexts = asRecordArray(data.page_texts ?? first.page_texts);
  const joinedPageText = pageTexts
    .map((entry) => (typeof entry.text === 'string' ? entry.text : ''))
    .join('\n');
  const fullText =
    (typeof data.full_text === 'string' ? data.full_text : undefined) ??
    (typeof first.full_text === 'string' ? first.full_text : undefined) ??
    (typeof data.text === 'string' ? data.text : undefined) ??
    (typeof first.text === 'string' ? first.text : undefined) ??
    joinedPageText ??
    '';

  const pageCountRaw =
    data.page_count ?? first.page_count ?? data.num_pages ?? first.num_pages ?? null;
  const pageCount =
    typeof pageCountRaw === 'number'
      ? pageCountRaw
      : typeof pageCountRaw === 'string' && pageCountRaw.trim()
        ? Number(pageCountRaw)
        : null;

  const tablesTop = asRecordArray(data.tables ?? first.tables);
  const tableInfo = asRecordArray(data.table_info ?? first.table_info);
  const elementTables = asRecordArray(data.elements ?? first.elements).filter(
    (entry) => entry.kind === 'table' || entry.type === 'table'
  );
  const tables = tablesTop.length ? tablesTop : tableInfo.length ? tableInfo : elementTables;
  const firstTablePage =
    tables[0] && typeof tables[0].page === 'number'
      ? Number(tables[0].page)
      : tables[0]
        ? 1
        : null;

  const matchesTop = asRecordArray(
    (first.matches as unknown) ?? (data.matches as unknown) ?? (payload.matches as unknown)
  );
  const nestedMatches = results.flatMap((entry) => asRecordArray(entry.matches));
  const matches = matchesTop.length ? matchesTop : nestedMatches;
  const firstMatchPage =
    matches[0] && typeof matches[0].page === 'number' ? Number(matches[0].page) : null;

  const outline = asRecordArray(
    data.outline ?? first.outline ?? data.outlines ?? first.outlines
  );
  const formFields = asRecordArray(
    data.form_fields ?? first.form_fields ?? data.fields ?? first.fields
  );
  const annotations = asRecordArray(data.annotations ?? first.annotations);
  const warnings = asRecordArray(data.warnings ?? first.warnings ?? payload.warnings);

  const success = !isError && (first.success === true || first.success === undefined);

  return {
    success,
    isError,
    fullTextChars: fullText.length,
    pageCount: Number.isFinite(pageCount as number) ? (pageCount as number) : null,
    tableCount: tables.length,
    matchCount: matches.length,
    firstMatchPage,
    firstTablePage,
    outlineCount: outline.length,
    formFieldCount: formFields.length,
    annotationCount: annotations.length,
    warningCount: warnings.length,
    // Only meaningful for fail-closed invalid-page tasks; computed during acceptance.
    inventedFullTextRisk: false,
  };
};

const evaluateAcceptance = (
  acceptance: Record<string, unknown>,
  metrics: Metrics
): { pass: boolean; failures: string[] } => {
  const failures: string[] = [];
  if (acceptance.resultSuccess === true && !metrics.success) {
    failures.push('resultSuccess required');
  }
  if (typeof acceptance.minFullTextChars === 'number') {
    if (metrics.fullTextChars < acceptance.minFullTextChars) {
      failures.push(
        `minFullTextChars ${acceptance.minFullTextChars}, got ${metrics.fullTextChars}`
      );
    }
  }
  if (typeof acceptance.requirePageCountAtLeast === 'number') {
    if ((metrics.pageCount ?? 0) < acceptance.requirePageCountAtLeast) {
      failures.push(
        `requirePageCountAtLeast ${acceptance.requirePageCountAtLeast}, got ${metrics.pageCount}`
      );
    }
  }
  if (typeof acceptance.minTables === 'number') {
    if (metrics.tableCount < acceptance.minTables) {
      failures.push(`minTables ${acceptance.minTables}, got ${metrics.tableCount}`);
    }
  }
  if (acceptance.requireTablePage === 1 && metrics.tableCount > 0) {
    if ((metrics.firstTablePage ?? 0) < 1) failures.push('table page invalid');
  }
  if (typeof acceptance.minMatches === 'number') {
    if (metrics.matchCount < acceptance.minMatches) {
      failures.push(`minMatches ${acceptance.minMatches}, got ${metrics.matchCount}`);
    }
  }
  if (typeof acceptance.requireMatchPageAtLeast === 'number' && metrics.matchCount > 0) {
    if ((metrics.firstMatchPage ?? 0) < acceptance.requireMatchPageAtLeast) {
      failures.push('match page missing/invalid');
    }
  }
  if (typeof acceptance.minOutlineItems === 'number') {
    if (metrics.outlineCount < acceptance.minOutlineItems) {
      failures.push(`minOutlineItems ${acceptance.minOutlineItems}, got ${metrics.outlineCount}`);
    }
  }
  if (typeof acceptance.minFormFields === 'number') {
    if (metrics.formFieldCount < acceptance.minFormFields) {
      failures.push(`minFormFields ${acceptance.minFormFields}, got ${metrics.formFieldCount}`);
    }
  }
  if (typeof acceptance.minAnnotations === 'number') {
    if (metrics.annotationCount < acceptance.minAnnotations) {
      failures.push(
        `minAnnotations ${acceptance.minAnnotations}, got ${metrics.annotationCount}`
      );
    }
  }
  if (acceptance.forbidInventedFullText === true && metrics.fullTextChars > 200) {
    metrics.inventedFullTextRisk = true;
    failures.push('invalid page produced excessive text');
  }
  if (acceptance.requireWarningOrEmptyText === true) {
    if (metrics.fullTextChars >= 40 && metrics.warningCount === 0) {
      failures.push('invalid page invented substantial text without warnings');
    }
  }
  if (acceptance.allowSuccessWithWarnings === true) {
    // success or warning/empty-text path is acceptable; hard isError alone is not auto-fail
    // unless resultSuccess was also required.
  }
  return { pass: failures.length === 0, failures };
};

const compareMetricFloor = (
  taskId: string,
  metric: keyof Metrics,
  baseline: number,
  candidate: number,
  mode: 'gte' | 'lte' = 'gte'
): string | null => {
  if (mode === 'gte' && candidate + 1e-9 < baseline) {
    return `${taskId}: ${metric} below TS baseline (${candidate} < ${baseline})`;
  }
  if (mode === 'lte' && candidate - 1e-9 > baseline) {
    return `${taskId}: ${metric} above TS baseline ceiling (${candidate} > ${baseline})`;
  }
  return null;
};

const loadTasks = (): Task[] =>
  manifest.taskFiles.map((rel) => {
    const task = JSON.parse(readFileSync(join(corpusDir, rel), 'utf8')) as Task;
    return task;
  });

const measureRuntime = async (runtime: RuntimeId, tasks: Task[]): Promise<TaskMeasurement[]> => {
  const out: TaskMeasurement[] = [];
  for (const task of tasks) {
    try {
      const response = await callTool(runtime, task.tool, resolveInput(task.input));
      const payload = publicPayload(response);
      const metrics = extractMetrics(response, payload);
      const acceptance = evaluateAcceptance(task.acceptance, metrics);
      out.push({
        taskId: task.id,
        class: task.class,
        runtime,
        metrics,
        acceptancePass: acceptance.pass,
        acceptanceFailures: acceptance.failures,
      });
    } catch (error) {
      out.push({
        taskId: task.id,
        class: task.class,
        runtime,
        metrics: {
          success: false,
          isError: true,
          fullTextChars: 0,
          pageCount: null,
          tableCount: 0,
          matchCount: 0,
          firstMatchPage: null,
          firstTablePage: null,
          outlineCount: 0,
          formFieldCount: 0,
          annotationCount: 0,
          warningCount: 0,
          inventedFullTextRisk: false,
        },
        acceptancePass: false,
        acceptanceFailures: [error instanceof Error ? error.message : String(error)],
      });
    }
  }
  return out;
};

const tasks = loadTasks();
if (runtimes.includes('pure-rust')) ensureRustServer();
if (runtimes.includes('typescript')) ensureTsServer();

const measurements: TaskMeasurement[] = [];
for (const runtime of runtimes) {
  measurements.push(...(await measureRuntime(runtime, tasks)));
}

const failures: string[] = [];
for (const item of measurements) {
  if (!item.acceptancePass) {
    failures.push(
      `${item.runtime}/${item.taskId}: acceptance failed: ${item.acceptanceFailures.join('; ')}`
    );
  }
}

if (writeBaseline) {
  const ts = measurements.filter((item) => item.runtime === 'typescript');
  if (ts.length !== tasks.length) {
    console.error('[agent-task-eval] cannot write baseline without complete typescript run');
    process.exit(1);
  }
  if (ts.some((item) => !item.acceptancePass)) {
    console.error('[agent-task-eval] refusing to write baseline with failing TS acceptance');
    process.exit(1);
  }
  const baseline = {
    schemaVersion: 1,
    authority: 'ADR-0005',
    runtime: 'typescript-v3.0.14',
    measuredAt: new Date().toISOString(),
    method: 'scripts/run-agent-task-eval.ts --write-baseline',
    note: 'Measured local-fixture metrics. Thresholds must not be invented above these floors.',
    tasks: Object.fromEntries(
      ts.map((item) => [
        item.taskId,
        {
          class: item.class ?? null,
          metrics: item.metrics,
          acceptancePass: item.acceptancePass,
        },
      ])
    ),
  };
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`[agent-task-eval] wrote measured TS baseline: ${baselinePath}`);
}

if (compareToBaseline && existsSync(baselinePath)) {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as {
    tasks: Record<string, { metrics: Metrics }>;
  };
  const rust = measurements.filter((item) => item.runtime === 'pure-rust');
  for (const item of rust) {
    const base = baseline.tasks[item.taskId]?.metrics;
    if (!base) {
      failures.push(`${item.taskId}: missing measured TS baseline entry`);
      continue;
    }
    // Floors from measured TS baseline; representation differences allowed.
    // Capability presence floors from measured TS baseline (no invented %).
    // Only compare metrics that are material to the task class / non-zero capability proof.
    // Exact count equality is intentionally not required under ADR-0005.
    const task = tasks.find((entry) => entry.id === item.taskId);
    const acceptance = task?.acceptance ?? {};
    const presence: Array<[keyof Metrics, number, number]> = [];
    if (typeof acceptance.minFullTextChars === 'number' || (task?.class === 'extract_passage')) {
      presence.push(['fullTextChars', base.fullTextChars > 0 ? 1 : 0, item.metrics.fullTextChars]);
    }
    if (typeof acceptance.minTables === 'number' || base.tableCount > 0) {
      presence.push(['tableCount', base.tableCount > 0 ? 1 : 0, item.metrics.tableCount]);
    }
    if (typeof acceptance.minMatches === 'number' || base.matchCount > 0) {
      presence.push(['matchCount', base.matchCount > 0 ? 1 : 0, item.metrics.matchCount]);
    }
    if (typeof acceptance.minOutlineItems === 'number' || base.outlineCount > 0) {
      presence.push(['outlineCount', base.outlineCount > 0 ? 1 : 0, item.metrics.outlineCount]);
    }
    if (typeof acceptance.minFormFields === 'number' || base.formFieldCount > 0) {
      presence.push(['formFieldCount', base.formFieldCount > 0 ? 1 : 0, item.metrics.formFieldCount]);
    }
    if (typeof acceptance.minAnnotations === 'number' || base.annotationCount > 0) {
      presence.push(['annotationCount', base.annotationCount > 0 ? 1 : 0, item.metrics.annotationCount]);
    }
    for (const [metric, required, c] of presence) {
      if (required <= 0) continue;
      const msg = compareMetricFloor(item.taskId, metric, required, c, 'gte');
      if (msg) failures.push(`${msg} [TS measured presence]`);
    }
    if (base.pageCount != null && base.pageCount >= 1 && acceptance.requirePageCountAtLeast != null) {
      if ((item.metrics.pageCount ?? 0) < 1) {
        failures.push(`${item.taskId}: pageCount missing while TS baseline had pageCount`);
      }
    }
    if (acceptance.forbidInventedFullText === true) {
      if (base.inventedFullTextRisk === false && item.metrics.fullTextChars > 200) {
        failures.push(`${item.taskId}: invented full text risk above TS baseline`);
      }
    }
  }
} else if (compareToBaseline && !existsSync(baselinePath) && !writeBaseline) {
  failures.push(
    `missing measured baseline at ${baselinePath}; run with --write-baseline first`
  );
}

const summary = {
  runtimes,
  taskCount: tasks.length,
  measurements: measurements.map((item) => ({
    taskId: item.taskId,
    runtime: item.runtime,
    acceptancePass: item.acceptancePass,
    metrics: item.metrics,
  })),
  failureCount: failures.length,
};

if (failures.length) {
  console.error(failures.join('\n'));
  console.error(`[agent-task-eval] FAIL ${JSON.stringify(summary)}`);
  process.exit(1);
}

console.log(
  `[agent-task-eval] PASS ${tasks.length} tasks x ${runtimes.join(',')} under measured semantic floors`
);
console.log(JSON.stringify(summary, null, 2));
