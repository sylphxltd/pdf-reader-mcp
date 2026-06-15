import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';
import { readPdf } from '../src/handlers/readPdf.js';
import { getOcrProviderStatus } from '../src/pdf/ocr.js';
import {
  analyzePdfRegionsFromSource,
  defaultAnalyzeRegionsOptions,
  getRegionAnalysisProviderStatus,
} from '../src/pdf/regionAnalysis.js';
import type { ReadPdfArgs } from '../src/schemas/readPdf.js';
import type {
  PdfInspectionProviderStatus,
  PdfRegionAnalysisData,
  PdfRegionAnalysisKind,
  PdfRegionRequest,
} from '../src/types/pdf.js';

interface ProviderBenchmarkResult {
  provider: 'tesseract-tsv' | 'region-analysis';
  status: 'passed' | 'failed' | 'skipped';
  duration_ms: number;
  message?: string | undefined;
  assertions?: Array<{ name: string; pass: boolean }> | undefined;
  provider_status?: Partial<PdfInspectionProviderStatus> | undefined;
  metrics?: {
    adapter?: string | undefined;
    kind?: string | undefined;
    confidence?: number | undefined;
    table_cells?: number | undefined;
    table_rows?: number | undefined;
    chart_series?: number | undefined;
    formula_formats?: number | undefined;
    figure_count?: number | undefined;
    image_description_count?: number | undefined;
    text_chars?: number | undefined;
    word_count?: number | undefined;
    words_with_bounding_boxes?: number | undefined;
    average_confidence?: number | undefined;
  };
  certification?: {
    profile: 'ocr-text-layer' | 'visual-full-fidelity';
    fixture_count: number;
    capability_count: number;
    passed_capability_count: number;
    capabilities: Record<string, 'passed' | 'failed' | 'skipped'>;
  };
}

interface OcrTextLayerBenchmarkView {
  pages?: Array<{
    text?: string;
    confidence?: number;
    words?: Array<{ bounding_box?: unknown }>;
    source_render_evidence_id?: string;
  }>;
  summary?: {
    text_chars?: number;
    word_count?: number;
    words_with_bounding_boxes?: number;
    average_confidence?: number;
  };
}

interface DocumentMapBenchmarkView {
  layers?: string[];
  routing?: { ocr_applied_pages?: number[] };
}

const execFileAsync = promisify(execFile);
const STRICT_PROVIDER_BENCHMARK_ENV = 'MCP_PDF_PROVIDER_BENCHMARK_REQUIRED';
const EXPECTED_TOKENS = ['HELLO', 'WORLD'];
const TESSERACT_TSV_CAPABILITIES = [
  'tesseract-tsv provider returns expected OCR tokens',
  'tesseract-tsv provider normalizes word-level bounding boxes',
  'read_pdf fuses provider OCR evidence into the document map',
] as const;
const VISUAL_REGION_CAPABILITIES = [
  'region provider analyzes all visual certification fixtures',
  'region provider preserves crop evidence provenance for every fixture',
  'region provider returns a structured table with cell boxes',
  'region provider returns machine-readable formula evidence',
  'region provider returns chart axes or series evidence',
  'region provider returns figure description evidence',
  'region provider returns image-description evidence',
] as const;
const VISUAL_PROVIDER_FIXTURES = [
  {
    id: 'cert-table',
    kind: 'table',
    region: {
      id: 'cert-table',
      page: 1,
      bounding_box: { left: 50, bottom: 545, right: 435, top: 735 },
      padding: 8,
    },
  },
  {
    id: 'cert-formula',
    kind: 'formula',
    region: {
      id: 'cert-formula',
      page: 1,
      bounding_box: { left: 50, bottom: 430, right: 435, top: 530 },
      padding: 8,
    },
  },
  {
    id: 'cert-chart',
    kind: 'chart',
    region: {
      id: 'cert-chart',
      page: 1,
      bounding_box: { left: 50, bottom: 160, right: 535, top: 415 },
      padding: 8,
    },
  },
  {
    id: 'cert-figure',
    kind: 'figure',
    region: {
      id: 'cert-figure',
      page: 1,
      bounding_box: { left: 50, bottom: 40, right: 300, top: 145 },
      padding: 8,
    },
  },
  {
    id: 'cert-image',
    kind: 'image',
    region: {
      id: 'cert-image',
      page: 1,
      bounding_box: { left: 330, bottom: 40, right: 585, top: 145 },
      padding: 8,
    },
  },
] satisfies Array<{
  id: string;
  kind: Exclude<PdfRegionAnalysisKind, 'unknown'>;
  region: PdfRegionRequest;
}>;

const round = (value: number): number => Math.round(value * 100) / 100;

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

const escapePdfText = (text: string): string =>
  text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');

const writeProviderFixture = async (directory: string): Promise<string> => {
  const contentStream = `BT\n/F1 48 Tf\n60 130 Td\n(${escapePdfText(EXPECTED_TOKENS.join(' '))}) Tj\nET\n`;
  const pdf = serializePdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    [
      '<< /Type /Page',
      '/Parent 2 0 R',
      '/MediaBox [0 0 600 240]',
      '/Resources << /Font << /F1 5 0 R >> >>',
      '/Contents 4 0 R',
      '>>',
    ].join(' '),
    `<< /Length ${String(byteLength(contentStream))} >>\nstream\n${contentStream}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]);
  const fixturePath = path.join(directory, 'provider-ocr-fixture.pdf');
  await fs.writeFile(fixturePath, pdf);

  return fixturePath;
};

const writeVisualProviderFixture = async (directory: string): Promise<string> => {
  const contentStream = [
    'q',
    '0 0 0 RG',
    '1 w',
    '60 720 m 420 720 l 420 560 l 60 560 l h S',
    '60 680 m 420 680 l S',
    '60 640 m 420 640 l S',
    '60 600 m 420 600 l S',
    '240 720 m 240 560 l S',
    'BT',
    '/F1 16 Tf',
    '72 694 Td (Metric) Tj',
    '180 0 Td (Value) Tj',
    '-180 -40 Td (Revenue) Tj',
    '180 0 Td ($1.2M) Tj',
    '-180 -40 Td (Users) Tj',
    '180 0 Td (4200) Tj',
    'ET',
    'BT',
    '/F1 24 Tf',
    '72 480 Td (E = mc^2) Tj',
    'ET',
    '0 0 0 RG',
    '1.5 w',
    '72 205 m 72 380 l 500 205 l S',
    '0.24 0.47 0.86 rg',
    '100 205 54 72 re f',
    '190 205 54 108 re f',
    '280 205 54 144 re f',
    'BT',
    '/F1 12 Tf',
    '105 185 Td (Q1) Tj',
    '90 0 Td (Q2) Tj',
    '90 0 Td (Q3) Tj',
    '-260 205 Td (Revenue by Quarter) Tj',
    'ET',
    '0 0 0 RG',
    '1 w',
    '80 70 m 140 115 l 220 70 l S',
    '80 70 m 220 70 l S',
    'BT',
    '/F1 12 Tf',
    '72 118 Td (Pipeline figure) Tj',
    'ET',
    '0.85 0.90 0.96 rg',
    '345 58 210 72 re f',
    '0 0 0 RG',
    '1 w',
    '345 58 210 72 re S',
    '360 72 m 410 108 l 458 76 l 510 120 l S',
    'BT',
    '/F1 12 Tf',
    '360 118 Td (Office image) Tj',
    'ET',
    'Q',
  ].join('\n');
  const pdf = serializePdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    [
      '<< /Type /Page',
      '/Parent 2 0 R',
      '/MediaBox [0 0 640 820]',
      '/Resources << /Font << /F1 5 0 R >> >>',
      '/Contents 4 0 R',
      '>>',
    ].join(' '),
    `<< /Length ${String(byteLength(contentStream))} >>\nstream\n${contentStream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]);
  const fixturePath = path.join(directory, 'provider-visual-fixture.pdf');
  await fs.writeFile(fixturePath, pdf);

  return fixturePath;
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

const readTesseractTsvProviderStatus = async () =>
  withEnv(
    {
      MCP_PDF_OCR_COMMAND: undefined,
      MCP_PDF_OCR_ARGS_JSON: undefined,
      MCP_PDF_OCR_PRESET: 'tesseract-tsv',
    },
    async () => getOcrProviderStatus()
  );

const parseReadPdfResult = async (input: ReadPdfArgs): Promise<Record<string, unknown>> => {
  const result = await readPdf.handler({ input, ctx: {} as unknown });
  if (result && typeof result === 'object' && 'isError' in result && result.isError) {
    const content = result.content as Array<{ text?: string }>;
    throw new Error(content[0]?.text ?? 'read_pdf returned an error');
  }

  const content = result.content as Array<{ text?: string }>;
  const textPayload = content[0]?.text;
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

  const data = (first as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) {
    throw new Error('read_pdf first result did not include data');
  }

  return data as Record<string, unknown>;
};

const hasTesseract = async (): Promise<boolean> => {
  try {
    await execFileAsync('tesseract', ['--version'], { timeout: 5_000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
};

const normalizeText = (value: string): string => value.toUpperCase().replace(/[^A-Z0-9]+/gu, ' ');

const extractTesseractTsvEvidence = (
  data: Record<string, unknown>
): {
  ocrTextLayer: OcrTextLayerBenchmarkView | undefined;
  documentMap: DocumentMapBenchmarkView | undefined;
  page: NonNullable<OcrTextLayerBenchmarkView['pages']>[number] | undefined;
  normalizedText: string;
} => {
  const ocrTextLayer = data.ocr_text_layer as OcrTextLayerBenchmarkView | undefined;
  const documentMap = data.document_map as DocumentMapBenchmarkView | undefined;
  const page = ocrTextLayer?.pages?.[0];

  return {
    ocrTextLayer,
    documentMap,
    page,
    normalizedText: normalizeText(page?.text ?? ''),
  };
};

const evaluateTesseractTsvEvidence = ({
  ocrTextLayer,
  documentMap,
  page,
  normalizedText,
}: ReturnType<typeof extractTesseractTsvEvidence>): Array<{ name: string; pass: boolean }> => [
  {
    name: TESSERACT_TSV_CAPABILITIES[0],
    pass: EXPECTED_TOKENS.every((token) => normalizedText.includes(token)),
  },
  {
    name: TESSERACT_TSV_CAPABILITIES[1],
    pass:
      (ocrTextLayer?.summary?.words_with_bounding_boxes ?? 0) >= EXPECTED_TOKENS.length &&
      (page?.words?.filter((word) => word.bounding_box !== undefined).length ?? 0) >=
        EXPECTED_TOKENS.length,
  },
  {
    name: TESSERACT_TSV_CAPABILITIES[2],
    pass:
      documentMap?.layers?.includes('ocr_text_layer') === true &&
      documentMap.routing?.ocr_applied_pages?.includes(1) === true &&
      page?.source_render_evidence_id === 'page-1-render-scale-2',
  },
];

const buildProviderMetrics = (
  ocrTextLayer: OcrTextLayerBenchmarkView | undefined
): ProviderBenchmarkResult['metrics'] => ({
  text_chars: ocrTextLayer?.summary?.text_chars,
  word_count: ocrTextLayer?.summary?.word_count,
  words_with_bounding_boxes: ocrTextLayer?.summary?.words_with_bounding_boxes,
  average_confidence: ocrTextLayer?.summary?.average_confidence,
});

const countFormulaFormats = (result: PdfRegionAnalysisData): number =>
  [
    result.formula?.latex,
    result.formula?.mathml,
    result.formula?.asciimath,
    result.formula?.text,
  ].filter((value) => typeof value === 'string' && value.trim().length > 0).length;

const evaluateRegionAnalysisEvidence = (
  results: PdfRegionAnalysisData[]
): Array<{ name: string; pass: boolean }> => [
  {
    name: VISUAL_REGION_CAPABILITIES[0],
    pass: VISUAL_PROVIDER_FIXTURES.every((fixture) =>
      results.some((result) => result.region_id === fixture.id)
    ),
  },
  {
    name: VISUAL_REGION_CAPABILITIES[1],
    pass: results.every(
      (result) =>
        result.source_crop_evidence_id ===
          `page-1-${result.region_id}-crop-scale-${String(result.scale)}` &&
        result.provenance.source === 'region-analysis-provider' &&
        result.source_bounding_box.left > 0
    ),
  },
  {
    name: VISUAL_REGION_CAPABILITIES[2],
    pass: results.some(
      (result) =>
        result.region_id === 'cert-table' &&
        result.kind === 'table' &&
        (result.table?.row_count ?? 0) >= 2 &&
        (result.table?.column_count ?? 0) >= 2 &&
        (result.table?.cells?.filter((cell) => cell.bounding_box !== undefined).length ?? 0) >= 4
    ),
  },
  {
    name: VISUAL_REGION_CAPABILITIES[3],
    pass: results.some(
      (result) =>
        result.region_id === 'cert-formula' &&
        result.kind === 'formula' &&
        countFormulaFormats(result) >= 2
    ),
  },
  {
    name: VISUAL_REGION_CAPABILITIES[4],
    pass: results.some(
      (result) =>
        result.region_id === 'cert-chart' &&
        result.kind === 'chart' &&
        ((result.chart?.series?.length ?? 0) > 0 ||
          (result.chart?.data_points?.length ?? 0) >= 3) &&
        result.chart?.x_axis !== undefined &&
        result.chart.y_axis !== undefined
    ),
  },
  {
    name: VISUAL_REGION_CAPABILITIES[5],
    pass: results.some(
      (result) =>
        result.region_id === 'cert-figure' &&
        result.kind === 'figure' &&
        typeof result.description === 'string' &&
        result.description.includes('pipeline') &&
        typeof result.text === 'string' &&
        result.text.includes('Pipeline figure')
    ),
  },
  {
    name: VISUAL_REGION_CAPABILITIES[6],
    pass: results.some(
      (result) =>
        result.region_id === 'cert-image' &&
        result.kind === 'image' &&
        typeof result.description === 'string' &&
        result.description.includes('office image') &&
        typeof result.text === 'string' &&
        result.text.includes('Office image')
    ),
  },
];

const buildRegionAnalysisMetrics = (
  results: PdfRegionAnalysisData[]
): ProviderBenchmarkResult['metrics'] => ({
  adapter: results[0]?.provider,
  kind: results.map((result) => result.kind).join(','),
  confidence:
    results.length > 0
      ? round(
          results.reduce((sum, result) => sum + (result.confidence ?? 0), 0) / results.length
        )
      : undefined,
  table_cells: results.reduce((sum, result) => sum + (result.table?.cells?.length ?? 0), 0),
  table_rows: results.reduce((sum, result) => sum + (result.table?.row_count ?? 0), 0),
  chart_series: results.reduce((sum, result) => sum + (result.chart?.series?.length ?? 0), 0),
  formula_formats: results.reduce((sum, result) => sum + countFormulaFormats(result), 0),
  figure_count: results.filter((result) => result.kind === 'figure').length,
  image_description_count: results.filter(
    (result) =>
      result.kind === 'image' &&
      ((result.description?.trim().length ?? 0) > 0 || (result.text?.trim().length ?? 0) > 0)
  ).length,
});

const buildCertificationSummary = (
  profile: NonNullable<ProviderBenchmarkResult['certification']>['profile'],
  fixtureCount: number,
  assertions: Array<{ name: string; pass: boolean }>
): NonNullable<ProviderBenchmarkResult['certification']> => {
  const capabilities = Object.fromEntries(
    assertions.map((assertion) => [assertion.name, assertion.pass ? 'passed' : 'failed'])
  ) as Record<string, 'passed' | 'failed' | 'skipped'>;

  return {
    profile,
    fixture_count: fixtureCount,
    capability_count: assertions.length,
    passed_capability_count: assertions.filter((assertion) => assertion.pass).length,
    capabilities,
  };
};

const buildSkippedCertificationSummary = (
  profile: NonNullable<ProviderBenchmarkResult['certification']>['profile'],
  fixtureCount: number,
  capabilityNames: readonly string[]
): NonNullable<ProviderBenchmarkResult['certification']> => ({
  profile,
  fixture_count: fixtureCount,
  capability_count: capabilityNames.length,
  passed_capability_count: 0,
  capabilities: Object.fromEntries(
    capabilityNames.map((name) => [name, 'skipped'])
  ) as Record<string, 'passed' | 'failed' | 'skipped'>,
});

const runTesseractTsvBenchmark = async (): Promise<ProviderBenchmarkResult> => {
  const start = performance.now();
  const providerStatus = await readTesseractTsvProviderStatus();
  if (!(await hasTesseract())) {
    return {
      provider: 'tesseract-tsv',
      status: 'skipped',
      duration_ms: round(performance.now() - start),
      message: 'tesseract executable was not found on PATH.',
      provider_status: {
        ocr_pages: providerStatus,
      },
      certification: buildSkippedCertificationSummary(
        'ocr-text-layer',
        1,
        TESSERACT_TSV_CAPABILITIES
      ),
    };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-reader-mcp-provider-'));

  try {
    const fixturePath = await writeProviderFixture(tempDir);
    const payload = await withEnv(
      {
        MCP_PDF_OCR_COMMAND: undefined,
        MCP_PDF_OCR_ARGS_JSON: undefined,
        MCP_PDF_OCR_PRESET: 'tesseract-tsv',
      },
      () =>
        parseReadPdfResult({
          sources: [{ path: fixturePath, pages: [1] }],
          include_full_text: false,
          include_ocr_text_layer: true,
          include_document_map: true,
          include_layout_diagnostics: true,
          include_page_geometry: true,
        })
    );
    const data = firstResultData(payload);
    const evidence = extractTesseractTsvEvidence(data);
    const assertions = evaluateTesseractTsvEvidence(evidence);

    return {
      provider: 'tesseract-tsv',
      status: assertions.every((assertion) => assertion.pass) ? 'passed' : 'failed',
      duration_ms: round(performance.now() - start),
      assertions,
      provider_status: {
        ocr_pages: providerStatus,
      },
      metrics: buildProviderMetrics(evidence.ocrTextLayer),
      certification: buildCertificationSummary('ocr-text-layer', 1, assertions),
    };
  } catch (error: unknown) {
    return {
      provider: 'tesseract-tsv',
      status: 'failed',
      duration_ms: round(performance.now() - start),
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

const runRegionAnalysisProviderBenchmark = async (): Promise<ProviderBenchmarkResult> => {
  const start = performance.now();
  const status = getRegionAnalysisProviderStatus();

  if (status.readiness === 'not_configured') {
    return {
      provider: 'region-analysis',
      status: 'skipped',
      duration_ms: round(performance.now() - start),
      message:
        'Set MCP_PDF_REGION_ANALYSIS_COMMAND or MCP_PDF_REGION_ANALYSIS_HTTP_URL to benchmark a configured visual-region provider.',
      provider_status: {
        analyze_regions: status,
      },
      certification: buildSkippedCertificationSummary(
        'visual-full-fidelity',
        VISUAL_PROVIDER_FIXTURES.length,
        VISUAL_REGION_CAPABILITIES
      ),
    };
  }

  if (status.readiness === 'invalid_configuration') {
    return {
      provider: 'region-analysis',
      status: 'failed',
      duration_ms: round(performance.now() - start),
      message: status.warnings?.join('; ') ?? 'Region analysis provider configuration is invalid.',
      provider_status: {
        analyze_regions: status,
      },
    };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-reader-mcp-visual-provider-'));

  try {
    const fixturePath = await writeVisualProviderFixture(tempDir);
    const analyzed = await analyzePdfRegionsFromSource(
      {
        path: fixturePath,
        regions: VISUAL_PROVIDER_FIXTURES.map((fixture) => fixture.region),
      },
      {
        ...defaultAnalyzeRegionsOptions(),
        max_regions: VISUAL_PROVIDER_FIXTURES.length,
        languages: ['eng'],
      }
    );
    const assertions = evaluateRegionAnalysisEvidence(analyzed.analyses);
    return {
      provider: 'region-analysis',
      status: assertions.every((assertion) => assertion.pass) ? 'passed' : 'failed',
      duration_ms: round(performance.now() - start),
      assertions,
      provider_status: {
        analyze_regions: status,
      },
      metrics: buildRegionAnalysisMetrics(analyzed.analyses),
      certification: buildCertificationSummary(
        'visual-full-fidelity',
        VISUAL_PROVIDER_FIXTURES.length,
        assertions
      ),
    };
  } catch (error: unknown) {
    return {
      provider: 'region-analysis',
      status: 'failed',
      duration_ms: round(performance.now() - start),
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

const main = async () => {
  const results = [await runTesseractTsvBenchmark(), await runRegionAnalysisProviderBenchmark()];
  const report = {
    profile: 'pdf_provider_benchmark',
    generated_at: new Date().toISOString(),
    fixture_scope:
      'runtime-generated local PDFs rendered through read_pdf OCR fusion and visual-region crop analysis with optional installed providers',
    strict: process.env[STRICT_PROVIDER_BENCHMARK_ENV] === 'true',
    certification_profiles: ['ocr-text-layer', 'visual-full-fidelity'],
    results,
  };

  console.table(
    results.map((result) => ({
      provider: result.provider,
      status: result.status,
      duration_ms: result.duration_ms,
      text_chars: result.metrics?.text_chars ?? '-',
      word_count: result.metrics?.word_count ?? '-',
      word_boxes: result.metrics?.words_with_bounding_boxes ?? '-',
      adapter: result.metrics?.adapter ?? '-',
      kind: result.metrics?.kind ?? '-',
      table_cells: result.metrics?.table_cells ?? '-',
      chart_series: result.metrics?.chart_series ?? '-',
      formula_formats: result.metrics?.formula_formats ?? '-',
      figures: result.metrics?.figure_count ?? '-',
      image_descriptions: result.metrics?.image_description_count ?? '-',
      passed_capabilities: result.certification
        ? `${String(result.certification.passed_capability_count)}/${String(result.certification.capability_count)}`
        : '-',
    }))
  );
  console.log(JSON.stringify(report, null, 2));

  const failed = results.some((result) => result.status === 'failed');
  const skipped = results.some((result) => result.status === 'skipped');
  if (failed || (report.strict && skipped)) {
    process.exitCode = 1;
  }
};

await main();
