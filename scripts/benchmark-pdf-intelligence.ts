import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { readPdf } from '../src/handlers/readPdf.js';
import type { ReadPdfArgs } from '../src/schemas/readPdf.js';

interface BenchmarkCase {
  name: string;
  input: ReadPdfArgs;
}

interface BenchmarkResult {
  name: string;
  iterations: number;
  average_ms: number;
  min_ms: number;
  max_ms: number;
}

const SAMPLE_PDF_PATH = 'test/fixtures/sample.pdf';
const ITERATIONS = 20;
const WARMUP_ITERATIONS = 3;

const runReadPdf = async (input: ReadPdfArgs): Promise<void> => {
  const result = await readPdf.handler({ input, ctx: {} as unknown });
  if (result && typeof result === 'object' && 'isError' in result && result.isError) {
    const content = result.content as Array<{ text?: string }>;
    throw new Error(content[0]?.text ?? 'read_pdf returned an error');
  }
};

const round = (value: number): number => Math.round(value * 100) / 100;

const benchmarkCase = async (benchmark: BenchmarkCase): Promise<BenchmarkResult> => {
  for (let index = 0; index < WARMUP_ITERATIONS; index++) {
    await runReadPdf(benchmark.input);
  }

  const timings: number[] = [];
  for (let index = 0; index < ITERATIONS; index++) {
    const start = performance.now();
    await runReadPdf(benchmark.input);
    timings.push(performance.now() - start);
  }

  return {
    name: benchmark.name,
    iterations: ITERATIONS,
    average_ms: round(timings.reduce((sum, value) => sum + value, 0) / timings.length),
    min_ms: round(Math.min(...timings)),
    max_ms: round(Math.max(...timings)),
  };
};

const main = async () => {
  const samplePath = path.resolve(process.cwd(), SAMPLE_PDF_PATH);
  await fs.access(samplePath);

  const cases: BenchmarkCase[] = [
    {
      name: 'metadata_page_count',
      input: {
        sources: [{ path: SAMPLE_PDF_PATH }],
        include_metadata: true,
        include_page_count: true,
        include_full_text: false,
      },
    },
    {
      name: 'full_text',
      input: {
        sources: [{ path: SAMPLE_PDF_PATH }],
        include_metadata: false,
        include_page_count: false,
        include_full_text: true,
      },
    },
    {
      name: 'selected_page_text',
      input: {
        sources: [{ path: SAMPLE_PDF_PATH, pages: [1] }],
        include_metadata: false,
        include_page_count: false,
        include_full_text: false,
      },
    },
    {
      name: 'v3_agent_document_twin',
      input: {
        sources: [{ path: SAMPLE_PDF_PATH, pages: [1] }],
        include_metadata: false,
        include_page_count: true,
        include_tables: true,
        include_chunks: true,
        include_text_layer: true,
        include_semantic_hints: true,
        include_layout_diagnostics: true,
        include_document_map: true,
        include_document_ast: true,
        include_trust_report: true,
        include_accessibility_report: true,
        include_full_text: false,
      },
    },
  ];

  const results: BenchmarkResult[] = [];
  for (const benchmark of cases) {
    results.push(await benchmarkCase(benchmark));
  }

  console.table(results);
  console.log(
    JSON.stringify(
      {
        fixture: SAMPLE_PDF_PATH,
        iterations: ITERATIONS,
        warmup_iterations: WARMUP_ITERATIONS,
        results,
      },
      null,
      2
    )
  );
};

await main();
