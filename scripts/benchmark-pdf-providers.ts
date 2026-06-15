import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';
import { readPdf } from '../src/handlers/readPdf.js';
import type { ReadPdfArgs } from '../src/schemas/readPdf.js';

interface ProviderBenchmarkResult {
  provider: 'tesseract-tsv';
  status: 'passed' | 'failed' | 'skipped';
  duration_ms: number;
  message?: string | undefined;
  assertions?: Array<{ name: string; pass: boolean }> | undefined;
  metrics?: {
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

const main = async () => {
  const results = [await runTesseractTsvBenchmark()];
  const report = {
    profile: 'pdf_provider_benchmark',
    generated_at: new Date().toISOString(),
    fixture_scope:
      'runtime-generated local PDF rendered through read_pdf OCR fusion with optional installed providers',
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
