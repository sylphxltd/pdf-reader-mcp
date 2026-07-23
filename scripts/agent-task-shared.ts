import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_PDF_URL_CACHE_DIR,
  resolveVerifiedPdfUrl,
  sha256Hex,
} from './pdf-url-cache.ts';

export type RuntimeId = 'typescript' | 'pure-rust';

export type Task = {
  id: string;
  class?: string;
  scope?: 'local' | 'public-url';
  tool: string;
  fixture?: string;
  publicCaseId?: string;
  input: Record<string, unknown>;
  acceptance: Record<string, unknown>;
  contractIds?: string[];
  env?: Record<string, string>;
  clearEnv?: string[];
};

export type Metrics = {
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
  visualCandidateCount: number;
  visualEnrichmentCount: number;
  ocrTextChars: number;
  hasDocumentMap: boolean;
  containsTextHits: number;
  fullTextPreview: string;
};

export type TaskMeasurement = {
  taskId: string;
  class?: string;
  runtime: RuntimeId;
  metrics: Metrics;
  acceptancePass: boolean;
  acceptanceFailures: string[];
};

export const asRecordArray = (value: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => entry && typeof entry === 'object') as Array<
    Record<string, unknown>
  >;
};

export const resolveTaskEnv = (
  task: Task,
  root: string,
  baseEnv: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...baseEnv };
  for (const key of task.clearEnv ?? []) {
    delete env[key];
  }
  const replacements: Record<string, string> = {
    '{root}': root,
    '{node}': process.execPath,
  };
  for (const [key, raw] of Object.entries(task.env ?? {})) {
    let value = raw;
    for (const [token, replacement] of Object.entries(replacements)) {
      value = value.split(token).join(replacement);
    }
    env[key] = value;
  }
  return env;
};

export const resolveInput = (
  input: Record<string, unknown>,
  root: string
): Record<string, unknown> => {
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

export const publicPayload = (response: Record<string, unknown>): Record<string, unknown> => {
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

export const extractMetrics = (
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

  const outline = asRecordArray(data.outline ?? first.outline ?? data.outlines ?? first.outlines);
  const formFields = asRecordArray(
    data.form_fields ?? first.form_fields ?? data.fields ?? first.fields
  );
  const annotations = asRecordArray(data.annotations ?? first.annotations);
  const warnings = asRecordArray(data.warnings ?? first.warnings ?? payload.warnings);

  const visualCandidates = asRecordArray(
    data.visual_enrichment_candidates ?? first.visual_enrichment_candidates
  );
  const visualEnrichments = asRecordArray(data.visual_enrichments ?? first.visual_enrichments);
  const documentMap =
    (data.document_map && typeof data.document_map === 'object'
      ? (data.document_map as Record<string, unknown>)
      : undefined) ??
    (first.document_map && typeof first.document_map === 'object'
      ? (first.document_map as Record<string, unknown>)
      : undefined);
  const mapCandidates = asRecordArray(documentMap?.visual_enrichment_candidates);
  const mapEnrichments = asRecordArray(documentMap?.visual_enrichments);

  const ocrLayer =
    (data.ocr_text_layer && typeof data.ocr_text_layer === 'object'
      ? (data.ocr_text_layer as Record<string, unknown>)
      : undefined) ??
    (first.ocr_text_layer && typeof first.ocr_text_layer === 'object'
      ? (first.ocr_text_layer as Record<string, unknown>)
      : undefined);
  const ocrPages = asRecordArray(ocrLayer?.pages ?? ocrLayer?.page_texts);
  const ocrText = ocrPages
    .map((page) => (typeof page.text === 'string' ? page.text : ''))
    .join('\n')
    .trim();
  const ocrTextDirect =
    typeof ocrLayer?.text === 'string'
      ? ocrLayer.text
      : typeof data.ocr_text === 'string'
        ? data.ocr_text
        : '';
  const ocrTextChars = (ocrText || ocrTextDirect).length;

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
    inventedFullTextRisk: false,
    visualCandidateCount: Math.max(visualCandidates.length, mapCandidates.length),
    visualEnrichmentCount: Math.max(visualEnrichments.length, mapEnrichments.length),
    ocrTextChars,
    hasDocumentMap: Boolean(documentMap),
    containsTextHits: 0,
    fullTextPreview: fullText.slice(0, 50_000),
  };
};

export const evaluateAcceptance = (
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
  if (typeof acceptance.minVisualCandidates === 'number') {
    if (metrics.visualCandidateCount < acceptance.minVisualCandidates) {
      failures.push(
        `minVisualCandidates ${acceptance.minVisualCandidates}, got ${metrics.visualCandidateCount}`
      );
    }
  }
  if (typeof acceptance.minVisualEnrichments === 'number') {
    if (metrics.visualEnrichmentCount < acceptance.minVisualEnrichments) {
      failures.push(
        `minVisualEnrichments ${acceptance.minVisualEnrichments}, got ${metrics.visualEnrichmentCount}`
      );
    }
  }
  if (acceptance.requireOcrTextLayer === true) {
    if (metrics.ocrTextChars <= 0) failures.push('ocr text layer missing');
  }
  if (typeof acceptance.minOcrTextChars === 'number') {
    if (metrics.ocrTextChars < acceptance.minOcrTextChars) {
      failures.push(`minOcrTextChars ${acceptance.minOcrTextChars}, got ${metrics.ocrTextChars}`);
    }
  }
  if (acceptance.requireDocumentMap === true && !metrics.hasDocumentMap) {
    failures.push('document_map missing');
  }
  if (Array.isArray(acceptance.containsText) && acceptance.containsText.length > 0) {
    const haystack = metrics.fullTextPreview.toLowerCase();
    const compactHaystack = haystack.replace(/[^a-z0-9]+/giu, '');
    let hits = 0;
    for (const needle of acceptance.containsText) {
      if (typeof needle !== 'string' || !needle.trim()) continue;
      const n = needle.toLowerCase();
      const compactNeedle = n.replace(/[^a-z0-9]+/giu, '');
      // Capability-first: accept equivalent whitespace/punctuation collapse.
      if (haystack.includes(n) || (compactNeedle && compactHaystack.includes(compactNeedle))) {
        hits += 1;
      } else {
        failures.push(`containsText missing: ${needle}`);
      }
    }
    metrics.containsTextHits = hits;
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
  return { pass: failures.length === 0, failures };
};

export const callMcpTool = async (options: {
  command: string;
  args?: string[];
  env: NodeJS.ProcessEnv;
  tool: string;
  toolArgs: Record<string, unknown>;
  timeoutMs?: number;
  cwd: string;
}): Promise<Record<string, unknown>> => {
  const child = spawn(options.command, options.args ?? [], {
    cwd: options.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: options.env,
  }) as ChildProcessWithoutNullStreams;
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
        // ignore non-JSON
      }
    }
  });
  const request = (id: number, method: string, params: Record<string, unknown>) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`timeout ${method}: ${stderr.slice(-2000)}`)),
        options.timeoutMs ?? 45_000
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
      clientInfo: { name: 'agent-task-shared', version: '1' },
    });
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`
    );
    return await request(2, 'tools/call', { name: options.tool, arguments: options.toolArgs });
  } finally {
    child.kill('SIGTERM');
  }
};

export const loadTasks = (root: string, taskFiles: string[]): Task[] =>
  taskFiles.map((rel) => {
    const path = join(root, 'docs/specs/agent-task-corpus', rel);
    if (!existsSync(path)) throw new Error(`task missing: ${rel}`);
    return JSON.parse(readFileSync(path, 'utf8')) as Task;
  });

export type PublicCorpusCase = {
  id: string;
  url: string;
  sha256: string;
};

export const publicTasksEnabled = (
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env
): boolean =>
  argv.includes('--public') ||
  argv.includes('--include-public') ||
  /^(1|true|yes)$/iu.test(String(env.MCP_PDF_AGENT_TASK_PUBLIC ?? '').trim());

export const publicDownloadsEnabled = (
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env
): boolean =>
  argv.includes('--allow-corpus-downloads') ||
  /^(1|true|yes)$/iu.test(String(env.MCP_PDF_CORPUS_ALLOW_DOWNLOADS ?? '').trim());

export const loadPublicCorpusCases = (root: string): Map<string, PublicCorpusCase> => {
  const path = join(root, 'corpus/public-url-corpus.json');
  const data = JSON.parse(readFileSync(path, 'utf8')) as { cases: PublicCorpusCase[] };
  return new Map(data.cases.map((entry) => [entry.id, entry]));
};

export const materializePublicTaskInput = async (
  task: Task,
  root: string,
  options: { allowDownloads: boolean; cacheDir?: string } 
): Promise<Record<string, unknown>> => {
  const input = resolveInput(task.input, root);
  if (task.scope !== 'public-url' || !task.publicCaseId) return input;
  const corpus = loadPublicCorpusCases(root);
  const entry = corpus.get(task.publicCaseId);
  if (!entry) throw new Error(`public corpus case missing: ${task.publicCaseId}`);
  const sha256 = sha256Hex(entry.sha256);
  if (!sha256) throw new Error(`public corpus case ${entry.id} has invalid sha256`);
  const cacheDir = options.cacheDir ?? process.env.MCP_PDF_CORPUS_CACHE_DIR ?? DEFAULT_PDF_URL_CACHE_DIR;
  const resolved = await resolveVerifiedPdfUrl({
    id: entry.id,
    url: entry.url,
    sha256,
    allowDownloads: options.allowDownloads,
    allowPrivateIps: false,
    cacheDir,
    caseLabel: 'Public agent-task case',
    downloadHint:
      'Pass --allow-corpus-downloads or set MCP_PDF_CORPUS_ALLOW_DOWNLOADS=true (and MCP_PDF_AGENT_TASK_PUBLIC=true).',
  });
  if (Array.isArray(input.sources)) {
    for (const source of input.sources as Array<Record<string, unknown>>) {
      delete source.url;
      source.path = resolved.path;
    }
  }
  return input;
};

export const selectTaskFiles = (
  manifest: { taskFiles?: string[]; publicTaskFiles?: string[] },
  includePublic: boolean
): string[] => {
  const local = manifest.taskFiles ?? [];
  if (!includePublic) return local;
  return [...local, ...(manifest.publicTaskFiles ?? [])];
};
