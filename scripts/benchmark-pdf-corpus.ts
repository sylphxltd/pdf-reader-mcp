import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { readPdf } from '../src/handlers/readPdf.js';
import type { ReadPdfArgs } from '../src/schemas/readPdf.js';
import { writeBenchmarkReport } from './benchmark-utils.js';
import {
  DEFAULT_PDF_URL_CACHE_DIR,
  nonEmptyString,
  resolveVerifiedPdfUrl,
  sha256Hex,
  validatePdfUrl,
} from './pdf-url-cache.js';

interface CorpusAssertion {
  id: string;
  pass: boolean;
  expected: Record<string, unknown>;
  observed: Record<string, unknown>;
}

interface CorpusCaseResult {
  id: string;
  fixture_type: 'checked-in' | 'runtime-generated' | 'external';
  document_archetype: string;
  capability_tags: string[];
  duration_ms: number;
  assertion_count: number;
  passed_assertion_count: number;
  score: number;
  metrics: Record<string, number | string | boolean>;
  assertions: CorpusAssertion[];
}

interface CorpusCapabilitySummary {
  tag: string;
  case_count: number;
  assertion_count: number;
  passed_assertion_count: number;
  failed_assertion_count: number;
  score: number;
  status: 'passed' | 'failed';
}

interface CorpusBenchmarkReport {
  profile: 'pdf_corpus_benchmark';
  generated_at: string;
  corpus_scope: string;
  manifest_path?: string | undefined;
  external_case_count?: number | undefined;
  external_url_case_count?: number | undefined;
  external_download_count?: number | undefined;
  corpus_cache_dir?: string | undefined;
  case_count: number;
  assertion_count: number;
  passed_assertion_count: number;
  score: number;
  capability_summary: CorpusCapabilitySummary[];
  cases: CorpusCaseResult[];
}

interface ExternalCorpusExpected {
  contains_text?: string[] | undefined;
  min_text_chars?: number | undefined;
  min_pages?: number | undefined;
  min_chunks?: number | undefined;
  min_tables?: number | undefined;
  min_ocr_words?: number | undefined;
  min_visual_enrichment_candidates?: number | undefined;
  min_visual_enrichments?: number | undefined;
  required_document_map_layers?: string[] | undefined;
}

interface ExternalCorpusCase {
  id: string;
  path: string;
  source_type: 'path' | 'url';
  source_url?: string | undefined;
  source_label?: string | undefined;
  source_homepage?: string | undefined;
  source_rights?: string | undefined;
  source_retrieved_at?: string | undefined;
  sha256?: string | undefined;
  downloaded?: boolean | undefined;
  pages?: ReadPdfArgs['sources'][number]['pages'] | undefined;
  document_archetype: string;
  capability_tags: string[];
  expected: ExternalCorpusExpected;
  read_pdf_options?: Partial<
    Pick<
      ReadPdfArgs,
      | 'include_full_text'
      | 'include_metadata'
      | 'include_page_count'
      | 'include_text_layer'
      | 'include_chunks'
      | 'include_tables'
      | 'include_ocr_text_layer'
      | 'include_visual_enrichments'
      | 'include_document_map'
      | 'include_document_ast'
      | 'include_layout_diagnostics'
      | 'include_page_geometry'
    >
  >;
}

interface ExternalCorpusManifest {
  cases: ExternalCorpusCase[];
}

interface BuildCorpusBenchmarkReportOptions {
  manifestPath?: string | undefined;
  allowCorpusDownloads?: boolean | undefined;
  allowPrivateIps?: boolean | undefined;
  corpusCacheDir?: string | undefined;
}

interface ExternalCorpusManifestOptions {
  allowCorpusDownloads?: boolean | undefined;
  allowPrivateIps?: boolean | undefined;
  corpusCacheDir?: string | undefined;
}

interface ExternalCorpusEvaluation {
  cases: CorpusCaseResult[];
  manifest: ExternalCorpusManifest;
}

const CORPUS_DOWNLOAD_ENV = 'MCP_PDF_CORPUS_ALLOW_DOWNLOADS';
const CORPUS_CACHE_DIR_ENV = 'MCP_PDF_CORPUS_CACHE_DIR';
const ALLOW_PRIVATE_IPS_ENV = 'MCP_PDF_ALLOW_PRIVATE_IPS';

const round = (value: number): number => Math.round(value * 100) / 100;

const ratioScore = (numerator: number, denominator: number): number =>
  denominator > 0 ? round(Math.min(1, Math.max(0, numerator / denominator))) : 0;

const byteLength = (value: string): number => Buffer.byteLength(value, 'utf8');

const serializePdf = (objects: string[]): string => {
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];

  objects.forEach((object, index) => {
    offsets.push(byteLength(body));
    body += `${String(index + 1)} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = byteLength(body);
  body += `xref\n0 ${String(objects.length + 1)}\n`;
  body += '0000000000 65535 f \n';
  offsets.forEach((offset) => {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\n`;
  body += `startxref\n${String(xrefOffset)}\n%%EOF\n`;

  return body;
};

const pdfStream = (content: string): string =>
  `<< /Length ${String(byteLength(content))} >>\nstream\n${content}endstream`;

const writeReadingOrderReportFixture = async (directory: string): Promise<string> => {
  const content = [
    'BT',
    '/F1 18 Tf',
    '50 760 Td',
    '(Quarterly Report Spanning Header Across Both Columns) Tj',
    'ET',
    'BT',
    '/F1 10 Tf',
    '320 700 Td',
    '(A Right 1) Tj',
    'ET',
    'BT',
    '/F1 10 Tf',
    '320 680 Td',
    '(A Right 2) Tj',
    'ET',
    'BT',
    '/F1 10 Tf',
    '50 700 Td',
    '(A Left 1) Tj',
    'ET',
    'BT',
    '/F1 10 Tf',
    '50 680 Td',
    '(A Left 2) Tj',
    'ET',
    'BT',
    '/F1 18 Tf',
    '50 610 Td',
    '(Risk Section Spanning Header Across Both Columns) Tj',
    'ET',
    'BT',
    '/F1 10 Tf',
    '320 550 Td',
    '(B Right 1) Tj',
    'ET',
    'BT',
    '/F1 10 Tf',
    '320 530 Td',
    '(B Right 2) Tj',
    'ET',
    'BT',
    '/F1 10 Tf',
    '50 550 Td',
    '(B Left 1) Tj',
    'ET',
    'BT',
    '/F1 10 Tf',
    '50 530 Td',
    '(B Left 2) Tj',
    'ET',
    'BT',
    '/F1 10 Tf',
    '50 80 Td',
    '(Page 1 footer spanning both columns) Tj',
    'ET',
    '',
  ].join('\n');
  const pdf = serializePdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    [
      '<< /Type /Page',
      '/Parent 2 0 R',
      '/MediaBox [0 0 612 792]',
      '/Resources << /Font << /F1 4 0 R >> >>',
      '/Contents 5 0 R',
      '>>',
    ].join(' '),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    pdfStream(content),
  ]);
  const fixturePath = path.join(directory, 'corpus-reading-order-report.pdf');
  await fs.writeFile(fixturePath, pdf);

  return fixturePath;
};

const writeScannedImageFixture = async (directory: string): Promise<string> => {
  const contentStream = 'q\n160 0 0 160 20 20 cm\n/Im1 Do\nQ\n';
  const imageData = 'FF000000FF000000FFFF00>';
  const pdf = serializePdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    [
      '<< /Type /Page',
      '/Parent 2 0 R',
      '/MediaBox [0 0 200 200]',
      '/Resources << /XObject << /Im1 5 0 R >> >>',
      '/Contents 4 0 R',
      '>>',
    ].join(' '),
    pdfStream(contentStream),
    [
      '<< /Type /XObject',
      '/Subtype /Image',
      '/Width 2',
      '/Height 2',
      '/ColorSpace /DeviceRGB',
      '/BitsPerComponent 8',
      '/Filter /ASCIIHexDecode',
      `/Length ${String(byteLength(imageData))}`,
      '>>',
      'stream',
      imageData,
      'endstream',
    ].join('\n'),
  ]);
  const fixturePath = path.join(directory, 'corpus-scanned-image.pdf');
  await fs.writeFile(fixturePath, pdf);

  return fixturePath;
};

const contentBlocksFromReadPdfResult = (
  result: Awaited<ReturnType<typeof readPdf.handler>>
): Array<{ type?: string; text?: string }> => {
  if (Array.isArray(result)) return result;
  if (result && typeof result === 'object' && 'content' in result && Array.isArray(result.content)) {
    return result.content;
  }
  if (result && typeof result === 'object' && 'type' in result) {
    return [result];
  }
  return [];
};

const parseReadPdfResult = async (input: ReadPdfArgs): Promise<Record<string, unknown>> => {
  const result = await readPdf.handler({ input, ctx: {} as unknown });
  if (result && typeof result === 'object' && 'isError' in result && result.isError) {
    const content = contentBlocksFromReadPdfResult(result);
    throw new Error(content[0]?.text ?? 'read_pdf returned an error');
  }

  const textPayload = contentBlocksFromReadPdfResult(result).find((block) => block.type === 'text')
    ?.text;
  if (!textPayload) {
    throw new Error('read_pdf did not return a JSON text payload');
  }

  return JSON.parse(textPayload) as Record<string, unknown>;
};

const firstResultData = (payload: Record<string, unknown>): Record<string, unknown> => {
  const results = payload.results;
  if (!Array.isArray(results)) throw new Error('read_pdf payload did not include results');

  const first = results[0];
  if (typeof first !== 'object' || first === null) {
    throw new Error('read_pdf payload did not include a first result');
  }

  const firstRecord = first as { data?: unknown; error?: unknown; success?: unknown };
  if (firstRecord.success === false) {
    throw new Error(
      `read_pdf first result failed: ${
        typeof firstRecord.error === 'string' ? firstRecord.error : 'unknown source error'
      }`
    );
  }

  const data = firstRecord.data;
  if (typeof data !== 'object' || data === null) {
    throw new Error('read_pdf first result did not include data');
  }

  return data as Record<string, unknown>;
};

const withEnv = async <T>(
  updates: Record<string, string | undefined>,
  run: () => Promise<T>
): Promise<T> => {
  const previous = Object.fromEntries(
    Object.keys(updates).map((name) => [name, process.env[name]])
  ) as Record<string, string | undefined>;

  for (const [name, value] of Object.entries(updates)) {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, name);
    } else {
      process.env[name] = value;
    }
  }

  try {
    return await run();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, name);
      } else {
        process.env[name] = value;
      }
    }
  }
};

const stringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : undefined))
    .filter((entry): entry is string => Boolean(entry));
  return normalized.length > 0 ? normalized : undefined;
};

const capabilityTags = (value: unknown): string[] => {
  const normalized =
    stringArray(value)
      ?.map((entry) =>
        entry
          .toLowerCase()
          .replace(/[^a-z0-9._:-]+/gu, '-')
          .replace(/^-+|-+$/gu, '')
      )
      .filter((entry) => entry.length > 0) ?? [];
  return [...new Set(normalized)];
};

const positiveNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

const booleanOption = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const parseExternalCorpusExpected = (value: unknown): ExternalCorpusExpected => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;

  return {
    contains_text: stringArray(record.contains_text),
    min_text_chars: positiveNumber(record.min_text_chars),
    min_pages: positiveNumber(record.min_pages),
    min_chunks: positiveNumber(record.min_chunks),
    min_tables: positiveNumber(record.min_tables),
    min_ocr_words: positiveNumber(record.min_ocr_words),
    min_visual_enrichment_candidates: positiveNumber(record.min_visual_enrichment_candidates),
    min_visual_enrichments: positiveNumber(record.min_visual_enrichments),
    required_document_map_layers: stringArray(record.required_document_map_layers),
  };
};

const parseExternalCorpusPages = (value: unknown): ExternalCorpusCase['pages'] | undefined => {
  if (value === undefined) return undefined;
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (
    Array.isArray(value) &&
    value.every((page) => typeof page === 'number' && Number.isInteger(page) && page > 0)
  ) {
    return value;
  }
  throw new Error('External corpus case pages must be a page range string or positive integer array.');
};

const parseExternalCorpusReadOptions = (
  value: unknown
): ExternalCorpusCase['read_pdf_options'] | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const options: ExternalCorpusCase['read_pdf_options'] = {};
  const optionKeys = [
    'include_full_text',
    'include_metadata',
    'include_page_count',
    'include_text_layer',
    'include_chunks',
    'include_tables',
    'include_ocr_text_layer',
    'include_visual_enrichments',
    'include_document_map',
    'include_document_ast',
    'include_layout_diagnostics',
    'include_page_geometry',
  ] as const;

  for (const key of optionKeys) {
    const valueForKey = booleanOption(record[key]);
    if (valueForKey !== undefined) {
      options[key] = valueForKey;
    }
  }

  return Object.keys(options).length > 0 ? options : undefined;
};

const readExternalCorpusManifest = async (
  manifestPath: string,
  options: ExternalCorpusManifestOptions = {}
): Promise<ExternalCorpusManifest> => {
  const absoluteManifestPath = path.resolve(manifestPath);
  const raw = await fs.readFile(absoluteManifestPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('External corpus manifest must be a JSON object.');
  }

  const cases = (parsed as { cases?: unknown }).cases;
  if (!Array.isArray(cases)) {
    throw new Error('External corpus manifest must include a cases array.');
  }

  const manifestDirectory = path.dirname(absoluteManifestPath);
  const cacheDir = path.resolve(options.corpusCacheDir ?? DEFAULT_PDF_URL_CACHE_DIR);
  return {
    cases: await Promise.all(cases.map(async (entry, index): Promise<ExternalCorpusCase> => {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        throw new Error(`External corpus case ${String(index + 1)} must be a JSON object.`);
      }

      const record = entry as Record<string, unknown>;
      const id = nonEmptyString(record.id) ?? `external-${String(index + 1)}`;
      const pathValue = nonEmptyString(record.path);
      const urlValue = nonEmptyString(record.url);
      if ((pathValue ? 1 : 0) + (urlValue ? 1 : 0) !== 1) {
        throw new Error(`External corpus case ${id} must include exactly one of path or url.`);
      }

      const source =
        pathValue !== undefined
          ? {
              path: path.isAbsolute(pathValue) ? pathValue : path.resolve(manifestDirectory, pathValue),
              source_type: 'path' as const,
            }
          : await (async () => {
              const url = validatePdfUrl(urlValue as string, id, 'External corpus case').toString();
              const sha256 = sha256Hex(record.sha256);
              if (!sha256) {
                throw new Error(
                  `External corpus case ${id} with url must include a 64-character sha256.`
                );
              }
              const resolved = await resolveVerifiedPdfUrl({
                id,
                url,
                sha256,
                allowDownloads: options.allowCorpusDownloads === true,
                allowPrivateIps: options.allowPrivateIps === true,
                cacheDir,
                caseLabel: 'External corpus case',
                downloadHint: `Pass --allow-corpus-downloads or set ${CORPUS_DOWNLOAD_ENV}=true.`,
              });
              return {
                path: resolved.path,
                source_type: 'url' as const,
                source_url: url,
                sha256,
                downloaded: resolved.downloaded,
              };
            })();

      return {
        id,
        ...source,
        source_label: nonEmptyString(record.source_label),
        source_homepage: nonEmptyString(record.source_homepage),
        source_rights: nonEmptyString(record.source_rights),
        source_retrieved_at: nonEmptyString(record.source_retrieved_at),
        pages: parseExternalCorpusPages(record.pages),
        document_archetype:
          nonEmptyString(record.document_archetype) ?? 'external PDF',
        capability_tags: capabilityTags(record.capability_tags),
        expected: parseExternalCorpusExpected(record.expected),
        read_pdf_options: parseExternalCorpusReadOptions(record.read_pdf_options),
      };
    })),
  };
};

const flagValue = (argv: string[], flagName: string): string | undefined => {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === flagName) {
      const next = argv[index + 1];
      return next && !next.startsWith('--') ? next : undefined;
    }
    const prefix = `${flagName}=`;
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
  }
  return undefined;
};

const hasFlag = (argv: string[], flagName: string): boolean => argv.includes(flagName);

const truthyEnv = (value: string | undefined): boolean =>
  value !== undefined && /^(1|true|yes)$/iu.test(value.trim());

export const resolveCorpusManifestPath = (
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env
): string | undefined => {
  const fromFlag = flagValue(argv, '--corpus-manifest');
  if (fromFlag !== undefined) return fromFlag;

  return env.MCP_PDF_CORPUS_MANIFEST;
};

export const resolveCorpusBenchmarkOptions = (
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env
): BuildCorpusBenchmarkReportOptions => ({
  manifestPath: resolveCorpusManifestPath(argv, env),
  allowCorpusDownloads: hasFlag(argv, '--allow-corpus-downloads') || truthyEnv(env[CORPUS_DOWNLOAD_ENV]),
  allowPrivateIps: hasFlag(argv, '--allow-private-ips') || truthyEnv(env[ALLOW_PRIVATE_IPS_ENV]),
  corpusCacheDir: flagValue(argv, '--corpus-cache-dir') ?? env[CORPUS_CACHE_DIR_ENV],
});

const buildCaseResult = async ({
  id,
  fixtureType,
  documentArchetype,
  capabilityTags: caseCapabilityTags,
  run,
}: {
  id: string;
  fixtureType: CorpusCaseResult['fixture_type'];
  documentArchetype: string;
  capabilityTags: string[];
  run: () => Promise<{ assertions: CorpusAssertion[]; metrics: CorpusCaseResult['metrics'] }>;
}): Promise<CorpusCaseResult> => {
  const start = performance.now();
  try {
    const { assertions, metrics } = await run();
    const passed = assertions.filter((assertion) => assertion.pass).length;
    return {
      id,
      fixture_type: fixtureType,
      document_archetype: documentArchetype,
      capability_tags: caseCapabilityTags,
      duration_ms: round(performance.now() - start),
      assertion_count: assertions.length,
      passed_assertion_count: passed,
      score: ratioScore(passed, assertions.length),
      metrics,
      assertions,
    };
  } catch (error: unknown) {
    return {
      id,
      fixture_type: fixtureType,
      document_archetype: documentArchetype,
      capability_tags: caseCapabilityTags,
      duration_ms: round(performance.now() - start),
      assertion_count: 1,
      passed_assertion_count: 0,
      score: 0,
      metrics: {},
      assertions: [
        {
          id: `${id}:runtime`,
          pass: false,
          expected: { no_uncaught_error: true },
          observed: { error: error instanceof Error ? error.message : String(error) },
        },
      ],
    };
  }
};

const getArrayLength = (value: unknown): number => (Array.isArray(value) ? value.length : 0);

const evaluateCheckedInSample = async (): Promise<CorpusCaseResult> =>
  buildCaseResult({
    id: 'checked-in-sample-agent-document-twin',
    fixtureType: 'checked-in',
    documentArchetype: 'text-rich repository PDF',
    capabilityTags: [
      'checked_in_sample',
      'citation_chunks',
      'document_map',
      'document_twin',
      'selectable_text',
      'text_layer',
    ],
    run: async () => {
      const payload = await parseReadPdfResult({
        sources: [{ path: 'test/fixtures/sample.pdf', pages: [1] }],
        include_metadata: true,
        include_page_count: true,
        include_full_text: true,
        include_text_layer: true,
        include_chunks: true,
        include_document_map: true,
        include_page_geometry: true,
      });
      const data = firstResultData(payload);
      const pageTexts = data.page_texts as Array<{ text?: string }> | undefined;
      const text = pageTexts?.[0]?.text ?? '';
      const documentMap = data.document_map as { layers?: string[]; summary?: Record<string, number> } | undefined;
      const chunks = data.chunks as unknown[] | undefined;
      const textLayer = data.text_layer as
        | { summary?: { run_count?: number; word_count?: number; char_count?: number } }
        | undefined;
      const info = data.info as { Title?: unknown; Author?: unknown } | undefined;

      return {
        metrics: {
          pages: typeof data.num_pages === 'number' ? data.num_pages : 0,
          text_chars: text.length,
          chunk_count: getArrayLength(chunks),
          text_layer_words: textLayer?.summary?.word_count ?? 0,
        },
        assertions: [
          {
            id: 'sample:page-count',
            pass: data.num_pages === 1,
            expected: { num_pages: 1 },
            observed: { num_pages: data.num_pages },
          },
          {
            id: 'sample:metadata',
            pass: info?.Title === 'sample' && typeof info.Author === 'string',
            expected: { title: 'sample', author_present: true },
            observed: { title: info?.Title, author_present: typeof info?.Author === 'string' },
          },
          {
            id: 'sample:text-volume',
            pass: text.includes('Sample PDF') && text.length > 2000,
            expected: { contains: 'Sample PDF', min_text_chars: 2000 },
            observed: { text_chars: text.length },
          },
          {
            id: 'sample:text-layer',
            pass:
              (textLayer?.summary?.run_count ?? 0) > 0 &&
              (textLayer?.summary?.word_count ?? 0) > 100 &&
              (textLayer?.summary?.char_count ?? 0) > 2000,
            expected: { min_runs: 1, min_words: 100, min_characters: 2000 },
            observed: {
              run_count: textLayer?.summary?.run_count,
              word_count: textLayer?.summary?.word_count,
              char_count: textLayer?.summary?.char_count,
            },
          },
          {
            id: 'sample:chunks',
            pass: getArrayLength(chunks) > 0,
            expected: { min_chunks: 1 },
            observed: { chunk_count: getArrayLength(chunks) },
          },
          {
            id: 'sample:document-map',
            pass:
              documentMap?.layers?.includes('text_layer') === true &&
              documentMap.layers.includes('citation_chunks') &&
              documentMap.layers.includes('page_geometry'),
            expected: { layers: ['text_layer', 'citation_chunks', 'page_geometry'] },
            observed: { layers: documentMap?.layers ?? [] },
          },
        ],
      };
    },
  });

const evaluateReadingOrderReport = async (tempDir: string): Promise<CorpusCaseResult> =>
  buildCaseResult({
    id: 'runtime-report-reading-order',
    fixtureType: 'runtime-generated',
    documentArchetype: 'multi-column report with spanning headers and footer',
    capabilityTags: [
      'document_ast',
      'document_map',
      'layout_diagnostics',
      'multi_column',
      'reading_order',
      'runtime_generated',
    ],
    run: async () => {
      const fixturePath = await writeReadingOrderReportFixture(tempDir);
      const payload = await parseReadPdfResult({
        sources: [{ path: fixturePath, pages: [1] }],
        include_full_text: true,
        include_elements: true,
        include_semantic_hints: true,
        include_layout_diagnostics: true,
        include_document_map: true,
        include_document_ast: true,
      });
      const data = firstResultData(payload);
      const text = ((data.page_texts as Array<{ text?: string }> | undefined)?.[0]?.text ?? '')
        .replace(/\s+/gu, ' ')
        .trim();
      const indexOf = (needle: string): number => text.indexOf(needle);
      const layoutDiagnostics = data.layout_diagnostics as
        | Array<{ confidence?: number; reading_order_model?: string; signals?: string[] }>
        | undefined;
      const documentAst = data.document_ast as { summary?: { section_count?: number } } | undefined;
      const documentMap = data.document_map as { layers?: string[] } | undefined;

      return {
        metrics: {
          text_chars: text.length,
          section_count: documentAst?.summary?.section_count ?? 0,
          layout_confidence: layoutDiagnostics?.[0]?.confidence ?? 0,
        },
        assertions: [
          {
            id: 'reading-order:header-first',
            pass: indexOf('Quarterly Report') === 0,
            expected: { starts_with: 'Quarterly Report' },
            observed: { text_start: text.slice(0, 40) },
          },
          {
            id: 'reading-order:left-before-right',
            pass:
              indexOf('A Left 1') > -1 &&
              indexOf('A Left 1') < indexOf('A Left 2') &&
              indexOf('A Left 2') < indexOf('A Right 1') &&
              indexOf('A Right 1') < indexOf('A Right 2'),
            expected: { order: ['A Left 1', 'A Left 2', 'A Right 1', 'A Right 2'] },
            observed: {
              a_left_1: indexOf('A Left 1'),
              a_left_2: indexOf('A Left 2'),
              a_right_1: indexOf('A Right 1'),
              a_right_2: indexOf('A Right 2'),
            },
          },
          {
            id: 'reading-order:section-continuation',
            pass:
              indexOf('Risk Section') > indexOf('A Right 2') &&
              indexOf('Risk Section') < indexOf('B Left 1') &&
              indexOf('B Left 2') < indexOf('B Right 1'),
            expected: { risk_section_between_a_and_b: true },
            observed: {
              risk_section: indexOf('Risk Section'),
              b_left_1: indexOf('B Left 1'),
              b_left_2: indexOf('B Left 2'),
              b_right_1: indexOf('B Right 1'),
            },
          },
          {
            id: 'reading-order:footer-last',
            pass: indexOf('Page 1 footer') > indexOf('B Right 2'),
            expected: { footer_after_body: true },
            observed: { footer: indexOf('Page 1 footer'), b_right_2: indexOf('B Right 2') },
          },
          {
            id: 'reading-order:diagnostics',
            pass:
              (layoutDiagnostics?.[0]?.confidence ?? 0) >= 0.75 &&
              Array.isArray(layoutDiagnostics?.[0]?.signals),
            expected: { min_confidence: 0.75, signals: 'present' },
            observed: {
              confidence: layoutDiagnostics?.[0]?.confidence,
              signals: layoutDiagnostics?.[0]?.signals ?? [],
            },
          },
          {
            id: 'reading-order:agent-map-and-ast',
            pass:
              documentMap?.layers?.includes('layout_diagnostics') === true &&
              documentMap.layers.includes('semantic_hints') &&
              (documentAst?.summary?.section_count ?? 0) >= 2,
            expected: { layers: ['layout_diagnostics', 'semantic_hints'], min_sections: 2 },
            observed: {
              layers: documentMap?.layers ?? [],
              section_count: documentAst?.summary?.section_count,
            },
          },
        ],
      };
    },
  });

const evaluateScannedOcrRouting = async (tempDir: string): Promise<CorpusCaseResult> =>
  buildCaseResult({
    id: 'runtime-scanned-ocr-routing',
    fixtureType: 'runtime-generated',
    documentArchetype: 'image-only scanned page with OCR text-layer fusion',
    capabilityTags: [
      'document_map',
      'ocr_routing',
      'ocr_text_layer',
      'runtime_generated',
      'scanned_page',
      'source_render_evidence',
    ],
    run: async () => {
      const fixturePath = await writeScannedImageFixture(tempDir);
      const scriptPath = path.resolve(process.cwd(), 'test/fixtures/mock-ocr-provider.mjs');
      const payload = await withEnv(
        {
          MCP_PDF_OCR_COMMAND: process.execPath,
          MCP_PDF_OCR_ARGS_JSON: JSON.stringify([scriptPath, '{input}', '{page}', '{languages}']),
          MCP_PDF_OCR_PRESET: undefined,
        },
        () =>
          parseReadPdfResult({
            sources: [{ path: fixturePath, pages: [1] }],
            include_page_count: true,
            include_full_text: false,
            include_ocr_text_layer: true,
            include_layout_diagnostics: true,
            include_document_map: true,
            include_page_geometry: true,
          })
      );
      const data = firstResultData(payload);
      const ocrTextLayer = data.ocr_text_layer as
        | {
            pages?: Array<{ text?: string; source_render_evidence_id?: string }>;
            summary?: { page_count?: number; word_count?: number; source_render_count?: number };
          }
        | undefined;
      const documentMap = data.document_map as
        | {
            layers?: string[];
            pages?: Array<{ ocr_text_chars?: number; ocr_source_render_evidence_id?: string }>;
            routing?: { ocr_applied_pages?: number[]; needs_ocr_pages?: number[] };
            summary?: { ocr_page_count?: number; ocr_text_chars?: number };
          }
        | undefined;
      const layoutDiagnostics = data.layout_diagnostics as
        | Array<{ confidence?: number; signals?: string[]; text_item_count?: number }>
        | undefined;

      return {
        metrics: {
          ocr_pages: ocrTextLayer?.summary?.page_count ?? 0,
          ocr_words: ocrTextLayer?.summary?.word_count ?? 0,
          ocr_text_chars: documentMap?.summary?.ocr_text_chars ?? 0,
        },
        assertions: [
          {
            id: 'scanned-ocr:text-layer',
            pass:
              ocrTextLayer?.summary?.page_count === 1 &&
              ocrTextLayer.summary.word_count === 1 &&
              ocrTextLayer.summary.source_render_count === 1 &&
              ocrTextLayer.pages?.[0]?.text === 'Mock OCR text for page 1',
            expected: { page_count: 1, word_count: 1, text: 'Mock OCR text for page 1' },
            observed: {
              page_count: ocrTextLayer?.summary?.page_count,
              word_count: ocrTextLayer?.summary?.word_count,
              text: ocrTextLayer?.pages?.[0]?.text,
            },
          },
          {
            id: 'scanned-ocr:document-map',
            pass:
              documentMap?.layers?.includes('ocr_text_layer') === true &&
              documentMap.summary?.ocr_page_count === 1 &&
              documentMap.pages?.[0]?.ocr_source_render_evidence_id === 'page-1-render-scale-2' &&
              documentMap.routing?.ocr_applied_pages?.includes(1) === true,
            expected: { layer: 'ocr_text_layer', source_render_evidence_id: 'page-1-render-scale-2' },
            observed: {
              layers: documentMap?.layers ?? [],
              ocr_page_count: documentMap?.summary?.ocr_page_count,
              source_render_evidence_id: documentMap?.pages?.[0]?.ocr_source_render_evidence_id,
              ocr_applied_pages: documentMap?.routing?.ocr_applied_pages ?? [],
            },
          },
          {
            id: 'scanned-ocr:routing-diagnostics',
            pass:
              layoutDiagnostics?.[0]?.text_item_count === 0 &&
              (layoutDiagnostics[0]?.confidence ?? 1) <= 0.3 &&
              layoutDiagnostics[0]?.signals?.includes('empty-page-content') === true &&
              documentMap?.routing?.needs_ocr_pages?.includes(1) === true,
            expected: { empty_text_items: true, needs_ocr_page: 1 },
            observed: {
              text_item_count: layoutDiagnostics?.[0]?.text_item_count,
              confidence: layoutDiagnostics?.[0]?.confidence,
              signals: layoutDiagnostics?.[0]?.signals ?? [],
              needs_ocr_pages: documentMap?.routing?.needs_ocr_pages ?? [],
            },
          },
        ],
      };
    },
  });

const evaluateOcrTableEvidence = async (tempDir: string): Promise<CorpusCaseResult> =>
  buildCaseResult({
    id: 'runtime-ocr-table-agent-evidence',
    fixtureType: 'runtime-generated',
    documentArchetype: 'scanned tabular page with OCR word-box table recovery',
    capabilityTags: [
      'document_ast',
      'document_map',
      'ocr_table_extraction',
      'ocr_text_layer',
      'runtime_generated',
      'scanned_table',
      'table_structure',
      'word_boxes',
    ],
    run: async () => {
      const fixturePath = await writeScannedImageFixture(tempDir);
      const scriptPath = path.resolve(process.cwd(), 'test/fixtures/mock-ocr-table-provider.mjs');
      const payload = await withEnv(
        {
          MCP_PDF_OCR_COMMAND: process.execPath,
          MCP_PDF_OCR_ARGS_JSON: JSON.stringify([scriptPath, '{input}', '{page}', '{languages}']),
          MCP_PDF_OCR_PRESET: undefined,
        },
        () =>
          parseReadPdfResult({
            sources: [{ path: fixturePath, pages: [1] }],
            include_page_count: false,
            include_full_text: false,
            include_ocr_text_layer: true,
            include_tables: true,
            include_document_map: true,
            include_document_ast: true,
          })
      );
      const data = firstResultData(payload);
      const tableInfo = data.table_info as
        | Array<{
            rowCount?: number;
            colCount?: number;
            cellCount?: number;
            quality?: { cellBoundingBoxCoverage?: number; signals?: string[] };
            provenance?: { source?: string; ocr_source_render_evidence_id?: string };
          }>
        | undefined;
      const ocrTextLayer = data.ocr_text_layer as
        | { pages?: Array<{ words?: Array<{ bounding_box?: unknown }> }> }
        | undefined;
      const documentMap = data.document_map as
        | {
            layers?: string[];
            pages?: Array<{ table_count?: number; ocr_word_count?: number }>;
            elements?: Array<{
              type?: string;
              provenance?: { source?: string; ocr_source_render_evidence_id?: string };
            }>;
          }
        | undefined;
      const documentAst = data.document_ast as { summary?: { table_count?: number }; root?: unknown } | undefined;

      return {
        metrics: {
          table_count: tableInfo?.length ?? 0,
          table_cells: tableInfo?.[0]?.cellCount ?? 0,
          ocr_words: documentMap?.pages?.[0]?.ocr_word_count ?? 0,
        },
        assertions: [
          {
            id: 'ocr-table:table-info',
            pass:
              tableInfo?.[0]?.rowCount === 3 &&
              tableInfo[0]?.colCount === 2 &&
              tableInfo[0]?.cellCount === 6 &&
              tableInfo[0]?.provenance?.source === 'ocr_text_layer' &&
              tableInfo[0]?.quality?.cellBoundingBoxCoverage === 1,
            expected: { rows: 3, columns: 2, cells: 6, source: 'ocr_text_layer' },
            observed: {
              rows: tableInfo?.[0]?.rowCount,
              columns: tableInfo?.[0]?.colCount,
              cells: tableInfo?.[0]?.cellCount,
              source: tableInfo?.[0]?.provenance?.source,
              cell_bounding_box_coverage: tableInfo?.[0]?.quality?.cellBoundingBoxCoverage,
            },
          },
          {
            id: 'ocr-table:word-box-normalization',
            pass:
              JSON.stringify(ocrTextLayer?.pages?.[0]?.words?.[0]?.bounding_box) ===
              JSON.stringify({ left: 40, bottom: 700, right: 88, top: 710 }),
            expected: { first_word_box: { left: 40, bottom: 700, right: 88, top: 710 } },
            observed: { first_word_box: ocrTextLayer?.pages?.[0]?.words?.[0]?.bounding_box },
          },
          {
            id: 'ocr-table:document-map',
            pass:
              documentMap?.layers?.includes('ocr_text_layer') === true &&
              documentMap.layers.includes('table_structure') &&
              documentMap.pages?.[0]?.table_count === 1 &&
              documentMap.elements?.some(
                (element) =>
                  element.type === 'table' &&
                  element.provenance?.source === 'ocr-table-detector' &&
                  element.provenance.ocr_source_render_evidence_id === 'page-1-render-scale-2'
              ) === true,
            expected: { layers: ['ocr_text_layer', 'table_structure'], table_count: 1 },
            observed: {
              layers: documentMap?.layers ?? [],
              table_count: documentMap?.pages?.[0]?.table_count,
              has_ocr_table_element:
                documentMap?.elements?.some(
                  (element) =>
                    element.type === 'table' &&
                    element.provenance?.source === 'ocr-table-detector'
                ) ?? false,
            },
          },
          {
            id: 'ocr-table:document-ast',
            pass:
              documentAst?.summary?.table_count === 1 &&
              JSON.stringify(documentAst.root).includes('"source":"ocr_text_layer"') &&
              JSON.stringify(documentAst.root).includes('"ocr_source_render_evidence_id"'),
            expected: { table_count: 1, ocr_provenance_in_ast: true },
            observed: {
              table_count: documentAst?.summary?.table_count,
              ocr_provenance_in_ast: JSON.stringify(documentAst?.root ?? {}).includes(
                '"ocr_source_render_evidence_id"'
              ),
            },
          },
        ],
      };
    },
  });

const textFromData = (data: Record<string, unknown>): string => {
  const fullText = typeof data.full_text === 'string' ? data.full_text : '';
  const pageText = Array.isArray(data.page_texts)
    ? data.page_texts
        .map((page) =>
          typeof page === 'object' && page !== null && typeof (page as { text?: unknown }).text === 'string'
            ? (page as { text: string }).text
            : ''
        )
        .join('\n')
    : '';
  return `${fullText}\n${pageText}`.trim();
};

const evaluateExternalCorpusCase = async (entry: ExternalCorpusCase): Promise<CorpusCaseResult> =>
  buildCaseResult({
    id: entry.id,
    fixtureType: 'external',
    documentArchetype: entry.document_archetype,
    capabilityTags: entry.capability_tags,
    run: async () => {
      const expected = entry.expected;
      const readOptions = entry.read_pdf_options ?? {};
      const payload = await parseReadPdfResult({
        sources: [{ path: entry.path, ...(entry.pages ? { pages: entry.pages } : {}) }],
        include_full_text: true,
        include_metadata: true,
        include_page_count: true,
        include_text_layer: true,
        include_chunks: true,
        include_tables: true,
        include_document_map: true,
        include_document_ast: true,
        include_layout_diagnostics: true,
        include_page_geometry: true,
        ...(expected.min_ocr_words !== undefined ? { include_ocr_text_layer: true } : {}),
        ...(expected.min_visual_enrichment_candidates !== undefined ||
        expected.min_visual_enrichments !== undefined
          ? { include_visual_enrichments: true }
          : {}),
        ...readOptions,
      });
      const data = firstResultData(payload);
      const text = textFromData(data);
      const chunks = data.chunks as unknown[] | undefined;
      const tableInfo = data.table_info as unknown[] | undefined;
      const documentMap = data.document_map as
        | {
            layers?: string[];
            summary?: {
              ocr_word_count?: number;
              visual_enrichment_candidate_count?: number;
              visual_enrichment_count?: number;
            };
          }
        | undefined;
      const visualCandidates = data.visual_enrichment_candidates as unknown[] | undefined;
      const visualEnrichments = data.visual_enrichments as unknown[] | undefined;
      const ocrTextLayer = data.ocr_text_layer as
        | { summary?: { word_count?: number; text_chars?: number } }
        | undefined;

      const metrics = {
        pages: typeof data.num_pages === 'number' ? data.num_pages : 0,
        text_chars: text.length,
        chunk_count: getArrayLength(chunks),
        table_count: getArrayLength(tableInfo),
        ocr_word_count:
          ocrTextLayer?.summary?.word_count ?? documentMap?.summary?.ocr_word_count ?? 0,
        visual_enrichment_candidate_count:
          documentMap?.summary?.visual_enrichment_candidate_count ??
          getArrayLength(visualCandidates),
        visual_enrichment_count:
          documentMap?.summary?.visual_enrichment_count ?? getArrayLength(visualEnrichments),
      };

      const assertions: CorpusAssertion[] = [
        {
          id: `${entry.id}:read-pdf-success`,
          pass: true,
          expected: { parseable_pdf: true },
          observed: {
            source: entry.path,
            source_type: entry.source_type,
            ...(entry.source_url ? { source_url: entry.source_url } : {}),
            ...(entry.source_label ? { source_label: entry.source_label } : {}),
            ...(entry.source_homepage ? { source_homepage: entry.source_homepage } : {}),
            ...(entry.source_rights ? { source_rights: entry.source_rights } : {}),
            ...(entry.source_retrieved_at
              ? { source_retrieved_at: entry.source_retrieved_at }
              : {}),
            ...(entry.sha256 ? { sha256: entry.sha256 } : {}),
            ...(entry.downloaded !== undefined ? { downloaded: entry.downloaded } : {}),
          },
        },
      ];

      if (expected.min_pages !== undefined) {
        assertions.push({
          id: `${entry.id}:min-pages`,
          pass: metrics.pages >= expected.min_pages,
          expected: { min_pages: expected.min_pages },
          observed: { pages: metrics.pages },
        });
      }
      if (expected.min_text_chars !== undefined) {
        assertions.push({
          id: `${entry.id}:min-text-chars`,
          pass: metrics.text_chars >= expected.min_text_chars,
          expected: { min_text_chars: expected.min_text_chars },
          observed: { text_chars: metrics.text_chars },
        });
      }
      for (const textNeedle of expected.contains_text ?? []) {
        assertions.push({
          id: `${entry.id}:contains:${textNeedle.slice(0, 32)}`,
          pass: text.includes(textNeedle),
          expected: { contains_text: textNeedle },
          observed: { matched: text.includes(textNeedle) },
        });
      }
      if (expected.min_chunks !== undefined) {
        assertions.push({
          id: `${entry.id}:min-chunks`,
          pass: metrics.chunk_count >= expected.min_chunks,
          expected: { min_chunks: expected.min_chunks },
          observed: { chunk_count: metrics.chunk_count },
        });
      }
      if (expected.min_tables !== undefined) {
        assertions.push({
          id: `${entry.id}:min-tables`,
          pass: metrics.table_count >= expected.min_tables,
          expected: { min_tables: expected.min_tables },
          observed: { table_count: metrics.table_count },
        });
      }
      if (expected.min_ocr_words !== undefined) {
        assertions.push({
          id: `${entry.id}:min-ocr-words`,
          pass: metrics.ocr_word_count >= expected.min_ocr_words,
          expected: { min_ocr_words: expected.min_ocr_words },
          observed: { ocr_word_count: metrics.ocr_word_count },
        });
      }
      if (expected.min_visual_enrichment_candidates !== undefined) {
        assertions.push({
          id: `${entry.id}:min-visual-candidates`,
          pass:
            metrics.visual_enrichment_candidate_count >=
            expected.min_visual_enrichment_candidates,
          expected: {
            min_visual_enrichment_candidates: expected.min_visual_enrichment_candidates,
          },
          observed: {
            visual_enrichment_candidate_count: metrics.visual_enrichment_candidate_count,
          },
        });
      }
      if (expected.min_visual_enrichments !== undefined) {
        assertions.push({
          id: `${entry.id}:min-visual-enrichments`,
          pass: metrics.visual_enrichment_count >= expected.min_visual_enrichments,
          expected: { min_visual_enrichments: expected.min_visual_enrichments },
          observed: { visual_enrichment_count: metrics.visual_enrichment_count },
        });
      }
      if (expected.required_document_map_layers) {
        const layers = documentMap?.layers ?? [];
        assertions.push({
          id: `${entry.id}:document-map-layers`,
          pass: expected.required_document_map_layers.every((layer) => layers.includes(layer)),
          expected: { required_document_map_layers: expected.required_document_map_layers },
          observed: { layers },
        });
      }

      return { metrics, assertions };
    },
  });

const evaluateExternalCorpusManifest = async (
  manifestPath: string,
  options: ExternalCorpusManifestOptions = {}
): Promise<ExternalCorpusEvaluation> => {
  const manifest = await readExternalCorpusManifest(manifestPath, options);
  return {
    manifest,
    cases: await Promise.all(manifest.cases.map((entry) => evaluateExternalCorpusCase(entry))),
  };
};

const summarizeCorpusCapabilities = (cases: CorpusCaseResult[]): CorpusCapabilitySummary[] => {
  const tagMap = new Map<
    string,
    {
      caseIds: Set<string>;
      assertion_count: number;
      passed_assertion_count: number;
    }
  >();

  for (const entry of cases) {
    for (const tag of entry.capability_tags) {
      const summary =
        tagMap.get(tag) ??
        {
          caseIds: new Set<string>(),
          assertion_count: 0,
          passed_assertion_count: 0,
        };
      summary.caseIds.add(entry.id);
      summary.assertion_count += entry.assertion_count;
      summary.passed_assertion_count += entry.passed_assertion_count;
      tagMap.set(tag, summary);
    }
  }

  return [...tagMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([tag, summary]) => {
      const failedAssertionCount = summary.assertion_count - summary.passed_assertion_count;
      return {
        tag,
        case_count: summary.caseIds.size,
        assertion_count: summary.assertion_count,
        passed_assertion_count: summary.passed_assertion_count,
        failed_assertion_count: failedAssertionCount,
        score: ratioScore(summary.passed_assertion_count, summary.assertion_count),
        status: failedAssertionCount === 0 ? 'passed' : 'failed',
      };
    });
};

export const buildCorpusBenchmarkReport = async (
  options: BuildCorpusBenchmarkReportOptions = {}
): Promise<CorpusBenchmarkReport> => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-reader-mcp-corpus-'));
  try {
    const externalEvaluation = options.manifestPath
      ? await evaluateExternalCorpusManifest(options.manifestPath, {
          allowCorpusDownloads: options.allowCorpusDownloads,
          allowPrivateIps: options.allowPrivateIps,
          corpusCacheDir: options.corpusCacheDir,
        })
      : undefined;
    const externalCases = externalEvaluation?.cases ?? [];
    const externalManifestCases = externalEvaluation?.manifest.cases ?? [];
    const externalUrlCaseCount = externalManifestCases.filter(
      (entry) => entry.source_type === 'url'
    ).length;
    const externalDownloadCount = externalManifestCases.filter((entry) => entry.downloaded).length;
    const cases = [
      await evaluateCheckedInSample(),
      await evaluateReadingOrderReport(tempDir),
      await evaluateScannedOcrRouting(tempDir),
      await evaluateOcrTableEvidence(tempDir),
      ...externalCases,
    ];
    const assertionCount = cases.reduce((sum, result) => sum + result.assertion_count, 0);
    const passedAssertionCount = cases.reduce(
      (sum, result) => sum + result.passed_assertion_count,
      0
    );

    return {
      profile: 'pdf_corpus_benchmark',
      generated_at: new Date().toISOString(),
      corpus_scope:
        'checked-in repository PDFs plus runtime-generated report and scanned-page archetypes exercised through read_pdf agent-document-twin flows' +
        (options.manifestPath
          ? '; external manifest PDFs supplied by the operator'
          : ''),
      ...(options.manifestPath ? { manifest_path: path.resolve(options.manifestPath) } : {}),
      ...(externalCases.length > 0 ? { external_case_count: externalCases.length } : {}),
      ...(externalUrlCaseCount > 0 ? { external_url_case_count: externalUrlCaseCount } : {}),
      ...(externalDownloadCount > 0 ? { external_download_count: externalDownloadCount } : {}),
      ...(externalUrlCaseCount > 0
        ? {
            corpus_cache_dir: path.resolve(options.corpusCacheDir ?? DEFAULT_PDF_URL_CACHE_DIR),
          }
        : {}),
      case_count: cases.length,
      assertion_count: assertionCount,
      passed_assertion_count: passedAssertionCount,
      score: ratioScore(passedAssertionCount, assertionCount),
      capability_summary: summarizeCorpusCapabilities(cases),
      cases,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

export const main = async () => {
  const report = await buildCorpusBenchmarkReport(resolveCorpusBenchmarkOptions());
  console.table(
    report.cases.map((result) => ({
      id: result.id,
      fixture_type: result.fixture_type,
      archetype: result.document_archetype,
      passed: `${String(result.passed_assertion_count)}/${String(result.assertion_count)}`,
      score: result.score,
      duration_ms: result.duration_ms,
    }))
  );
  console.log(JSON.stringify(report, null, 2));
  const outputPath = await writeBenchmarkReport(report);
  if (outputPath) {
    console.error(`Benchmark report written to ${outputPath}`);
  }

  if (report.score < 1) {
    process.exitCode = 1;
  }
};

if (import.meta.main) {
  await main();
}
