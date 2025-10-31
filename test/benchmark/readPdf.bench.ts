import fs from 'node:fs/promises';
import path from 'node:path';
import { bench, describe } from 'vitest'; // Prefix unused import
import { handleReadPdfFunc } from '../../src/handlers/readPdf.js'; // Adjust path as needed

// Mock the project root - Vitest runs from the project root by default
const PROJECT_ROOT = process.cwd();
const SAMPLE_PDF_PATH = 'test/fixtures/sample.pdf'; // Relative path to test PDF

// Pre-check if the sample PDF exists to avoid errors during benchmark setup
let pdfExists = false;
try {
  await fs.access(path.resolve(PROJECT_ROOT, SAMPLE_PDF_PATH));
  pdfExists = true;
} catch (error: unknown) {
  // Explicitly type error as unknown
  // Check if error is an instance of Error before accessing message
  const message = error instanceof Error ? error.message : String(error);
  console.warn(
    `Warning: Sample PDF not found at ${SAMPLE_PDF_PATH}. Benchmarks requiring it will be skipped. Details: ${message}`
  );
}

describe('read_pdf Handler Benchmarks', () => {
  // Benchmark getting only metadata and page count
  bench(
    'Get Metadata & Page Count',
    async () => {
      if (!pdfExists) return; // Skip if PDF doesn't exist
      try {
        await handleReadPdfFunc({
          sources: [{ path: SAMPLE_PDF_PATH }],
          include_metadata: true,
          include_page_count: true,
          include_full_text: false,
        });
      } catch (error: unknown) {
        // Explicitly type error as unknown
        console.warn(
          `Benchmark 'Get Metadata & Page Count' failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    { time: 1000 }
  ); // Run for 1 second

  // Benchmark getting full text
  bench(
    'Get Full Text',
    async () => {
      if (!pdfExists) return;
      try {
        await handleReadPdfFunc({
          sources: [{ path: SAMPLE_PDF_PATH }],
          include_metadata: false,
          include_page_count: false,
          include_full_text: true,
        });
      } catch (error: unknown) {
        // Explicitly type error as unknown
        console.warn(
          `Benchmark 'Get Full Text' failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    { time: 1000 }
  );

  // Benchmark getting specific pages (e.g., page 1)
  bench(
    'Get Specific Page (Page 1)',
    async () => {
      if (!pdfExists) return;
      try {
        await handleReadPdfFunc({
          sources: [{ path: SAMPLE_PDF_PATH, pages: [1] }],
          include_metadata: false,
          include_page_count: false,
          include_full_text: false, // Should be ignored when pages is set
        });
      } catch (error: unknown) {
        // Explicitly type error as unknown
        console.warn(
          `Benchmark 'Get Specific Page (Page 1)' failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    { time: 1000 }
  );

  // Benchmark getting multiple specific pages (e.g., pages 1 & 2)
  bench(
    'Get Specific Pages (Pages 1 & 2)',
    async () => {
      if (!pdfExists) return;
      // Assuming sample.pdf has at least 2 pages
      try {
        await handleReadPdfFunc({
          sources: [{ path: SAMPLE_PDF_PATH, pages: [1, 2] }],
          include_metadata: false,
          include_page_count: false,
        });
      } catch (error: unknown) {
        // Explicitly type error as unknown
        console.warn(
          `Benchmark 'Get Specific Pages (Pages 1 & 2)' failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    { time: 1000 }
  );

  // Benchmark handling a non-existent file (error path)
  bench(
    'Handle Non-Existent File',
    async () => {
      try {
        await handleReadPdfFunc({
          sources: [{ path: 'non/existent/file.pdf' }],
          include_metadata: true,
          include_page_count: true,
        });
      } catch (error: unknown) {
        // Explicitly type error as unknown
        // Expecting an error here, but log if something unexpected happens during the benchmark itself
        console.warn(
          `Benchmark 'Handle Non-Existent File' unexpectedly failed internally: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    { time: 1000 }
  );

  // Add more benchmarks as needed (e.g., larger PDFs, URL sources if feasible in benchmark)
});
