#!/usr/bin/env bun
/** Fail-closed phase invariants for the pure-Rust capability ledger. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const matrix = JSON.parse(
  readFileSync(join(root, 'docs/specs/pure-rust-capability-matrix.json'), 'utf8')
) as {
  productTruth: {
    dropInFor3014: boolean;
    publishFreeze: boolean;
    publishedStable: string;
    pureRustStatus: string;
  };
  tools: {
    pdf_evidence: Record<string, string>;
    read_pdf: Record<string, string>;
    search_pdf: Record<string, string>;
  };
};

const failures: string[] = [];
if (!matrix.productTruth.dropInFor3014 && !String(matrix.productTruth.publishedStable).includes('3.0.14')) {
  failures.push('publishedStable must reference 3.0.14 while Rust is not drop-in');
}
const capabilityStatuses = Object.entries(matrix.tools).flatMap(([tool, capabilities]) =>
  Object.entries(capabilities).map(([capability, status]) => ({ tool, capability, status }))
);
const allowedStatuses = new Set(['FULL', 'PARTIAL', 'STUB', 'FAIL_CLOSED', 'MISSING']);
for (const { tool, capability, status } of capabilityStatuses) {
  if (!allowedStatuses.has(status)) failures.push(`${tool}.${capability} has invalid status ${status}`);
}
if (matrix.productTruth.dropInFor3014) {
  const incomplete = capabilityStatuses.filter(({ status }) => status !== 'FULL');
  if (incomplete.length > 0) {
    failures.push(
      `dropInFor3014=true requires every capability FULL; incomplete: ${incomplete
        .map(({ tool, capability, status }) => `${tool}.${capability}=${status}`)
        .join(', ')}`
    );
  }
  if (matrix.productTruth.pureRustStatus === 'experimental-opt-in') {
    failures.push('dropInFor3014=true cannot remain experimental-opt-in');
  }
}
if (!matrix.productTruth.dropInFor3014 && matrix.productTruth.publishFreeze !== true) {
  failures.push('publishFreeze must remain true while dropInFor3014 is false');
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('[check-pure-rust-matrix] PASS honest matrix invariants');
