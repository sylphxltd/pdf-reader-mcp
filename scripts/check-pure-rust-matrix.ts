#!/usr/bin/env bun
/**
 * Fail-closed: pure-Rust capability matrix must not claim drop-in or FULL evidence ops.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const matrix = JSON.parse(
  readFileSync(join(root, 'docs/specs/pure-rust-capability-matrix.json'), 'utf8')
) as {
  productTruth: { dropInFor3014: boolean; publishedStable: string; pureRustStatus: string };
  tools: {
    pdf_evidence: Record<string, string>;
    read_pdf: Record<string, string>;
    search_pdf: Record<string, string>;
  };
};

const failures: string[] = [];
if (matrix.productTruth.dropInFor3014 !== false) {
  failures.push('productTruth.dropInFor3014 must be false');
}
if (!String(matrix.productTruth.publishedStable).includes('3.0.14')) {
  failures.push('publishedStable must reference 3.0.14');
}
if (matrix.productTruth.pureRustStatus !== 'experimental-opt-in') {
  failures.push('pureRustStatus must be experimental-opt-in');
}
for (const op of ['render_page', 'extract_regions', 'ocr_pages', 'analyze_regions']) {
  if (matrix.tools.pdf_evidence[op] !== 'FAIL_CLOSED') {
    failures.push(`pdf_evidence.${op} must be FAIL_CLOSED until implemented`);
  }
}
if (matrix.tools.read_pdf.bounding_boxes !== 'MISSING') {
  failures.push('read_pdf.bounding_boxes must be MISSING until geometry lands');
}
if (matrix.tools.search_pdf.bounding_box !== 'MISSING') {
  failures.push('search_pdf.bounding_box must be MISSING until geometry lands');
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('[check-pure-rust-matrix] PASS honest matrix invariants');
