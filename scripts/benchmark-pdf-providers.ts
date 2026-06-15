import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';
import { PNG } from 'pngjs';
import { readPdf } from '../src/handlers/readPdf.js';
import {
  analyzeRegionCropWithConfiguredProvider,
  defaultAnalyzeRegionsOptions,
  getRegionAnalysisProviderStatus,
} from '../src/pdf/regionAnalysis.js';
import type { ReadPdfArgs } from '../src/schemas/readPdf.js';
import type { PdfRegionAnalysisData, PdfRegionCropData } from '../src/types/pdf.js';

interface ProviderBenchmarkResult {
  provider: 'tesseract-tsv' | 'region-analysis';
  status: 'passed' | 'failed' | 'skipped';
  duration_ms: number;
  message?: string | undefined;
  assertions?: Array<{ name: string; pass: boolean }> | undefined;
  metrics?: {
    adapter?: string | undefined;
    kind?: string | undefined;
    confidence?: number | undefined;
    table_cells?: number | undefined;
    table_rows?: number | undefined;
    chart_series?: number | undefined;
    formula_formats?: number | undefined;
    text_chars?: number | undefined;
    word_count?: number | undefined;
    words_with_bounding_boxes?: number | undefined;
    average_confidence?: number | undefined;
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
    name: 'tesseract-tsv provider returns expected OCR tokens',
    pass: EXPECTED_TOKENS.every((token) => normalizedText.includes(token)),
  },
  {
    name: 'tesseract-tsv provider normalizes word-level bounding boxes',
    pass:
      (ocrTextLayer?.summary?.words_with_bounding_boxes ?? 0) >= EXPECTED_TOKENS.length &&
      (page?.words?.filter((word) => word.bounding_box !== undefined).length ?? 0) >=
        EXPECTED_TOKENS.length,
  },
  {
    name: 'read_pdf fuses provider OCR evidence into the document map',
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

const drawRect = (
  png: PNG,
  left: number,
  top: number,
  width: number,
  height: number,
  color: [number, number, number, number]
) => {
  for (let y = top; y < top + height; y++) {
    for (let x = left; x < left + width; x++) {
      if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
      const offset = (png.width * y + x) << 2;
      png.data[offset] = color[0];
      png.data[offset + 1] = color[1];
      png.data[offset + 2] = color[2];
      png.data[offset + 3] = color[3];
    }
  }
};

const buildRegionAnalysisBenchmarkCrop = (): PdfRegionCropData => {
  const png = new PNG({ width: 220, height: 140 });
  png.data.fill(255);
  const black: [number, number, number, number] = [0, 0, 0, 255];
  const blue: [number, number, number, number] = [60, 120, 220, 255];

  for (const x of [20, 90, 160, 200]) drawRect(png, x, 18, 2, 72, black);
  for (const y of [18, 42, 66, 90]) drawRect(png, 20, y, 180, 2, black);
  drawRect(png, 34, 106, 22, 20, blue);
  drawRect(png, 72, 96, 22, 30, blue);
  drawRect(png, 110, 82, 22, 44, blue);
  drawRect(png, 148, 68, 22, 58, blue);
  const buffer = PNG.sync.write(png);

  return {
    region_id: 'provider-region-benchmark',
    page: 1,
    evidence_id: 'page-1-provider-region-benchmark-crop-scale-2',
    source_bounding_box: { left: 24, bottom: 120, right: 244, top: 260 },
    crop_pixels: { left: 48, top: 240, width: 440, height: 280 },
    scale: 2,
    byte_length: buffer.byteLength,
    format: 'png',
    mime_type: 'image/png',
    provenance: {
      engine: 'pdfjs',
      renderer: '@napi-rs/canvas',
      source: 'region-crop',
      page_render_evidence_id: 'page-1-render-scale-2',
    },
    data: buffer.toString('base64'),
  };
};

const countFormulaFormats = (result: PdfRegionAnalysisData): number =>
  [
    result.formula?.latex,
    result.formula?.mathml,
    result.formula?.asciimath,
    result.formula?.text,
  ].filter((value) => typeof value === 'string' && value.trim().length > 0).length;

const evaluateRegionAnalysisEvidence = (
  result: PdfRegionAnalysisData
): Array<{ name: string; pass: boolean }> => [
  {
    name: 'region provider preserves crop evidence provenance',
    pass:
      result.source_crop_evidence_id === 'page-1-provider-region-benchmark-crop-scale-2' &&
      result.source_bounding_box.left === 24 &&
      result.provenance.source === 'region-analysis-provider',
  },
  {
    name: 'region provider returns typed visual evidence',
    pass: result.kind !== 'unknown',
  },
  {
    name: 'region provider returns structured visual fields or confidence',
    pass:
      result.table !== undefined ||
      result.chart !== undefined ||
      result.formula !== undefined ||
      result.confidence !== undefined,
  },
];

const buildRegionAnalysisMetrics = (
  result: PdfRegionAnalysisData
): ProviderBenchmarkResult['metrics'] => ({
  adapter: result.provider,
  kind: result.kind,
  confidence: result.confidence,
  table_cells: result.table?.cells?.length,
  table_rows: result.table?.row_count,
  chart_series: result.chart?.series?.length,
  formula_formats: countFormulaFormats(result),
});

const runTesseractTsvBenchmark = async (): Promise<ProviderBenchmarkResult> => {
  const start = performance.now();
  if (!(await hasTesseract())) {
    return {
      provider: 'tesseract-tsv',
      status: 'skipped',
      duration_ms: round(performance.now() - start),
      message: 'tesseract executable was not found on PATH.',
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
      metrics: buildProviderMetrics(evidence.ocrTextLayer),
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
    };
  }

  if (status.readiness === 'invalid_configuration') {
    return {
      provider: 'region-analysis',
      status: 'failed',
      duration_ms: round(performance.now() - start),
      message: status.warnings?.join('; ') ?? 'Region analysis provider configuration is invalid.',
    };
  }

  try {
    const result = await analyzeRegionCropWithConfiguredProvider(
      buildRegionAnalysisBenchmarkCrop(),
      { source: 'provider-region-fixture.pdf', languages: ['eng'] },
      defaultAnalyzeRegionsOptions()
    );
    const assertions = evaluateRegionAnalysisEvidence(result);

    return {
      provider: 'region-analysis',
      status: assertions.every((assertion) => assertion.pass) ? 'passed' : 'failed',
      duration_ms: round(performance.now() - start),
      assertions,
      metrics: buildRegionAnalysisMetrics(result),
    };
  } catch (error: unknown) {
    return {
      provider: 'region-analysis',
      status: 'failed',
      duration_ms: round(performance.now() - start),
      message: error instanceof Error ? error.message : String(error),
    };
  }
};

const main = async () => {
  const results = [await runTesseractTsvBenchmark(), await runRegionAnalysisProviderBenchmark()];
  const report = {
    profile: 'pdf_provider_benchmark',
    generated_at: new Date().toISOString(),
    fixture_scope:
      'runtime-generated local PDF rendered through read_pdf OCR fusion plus synthetic visual-region crops with optional installed providers',
    strict: process.env[STRICT_PROVIDER_BENCHMARK_ENV] === 'true',
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
