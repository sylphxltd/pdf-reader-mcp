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
const behaviorCorpus = JSON.parse(
  readFileSync(join(root, 'scripts/differential/fixtures/v3014-behavior-corpus.json'), 'utf8')
) as { cases: Array<{ id: string }> };
const structureCorpus = JSON.parse(
  readFileSync(join(root, 'scripts/differential/fixtures/v3014-structure-corpus.json'), 'utf8')
) as { cases: Array<{ id: string }> };
const citationChunkCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-citation-chunk-corpus.json'),
    'utf8'
  )
) as { cases: Array<{ id: string }> };
const semanticHintCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-semantic-hint-corpus.json'),
    'utf8'
  )
) as { cases: Array<{ id: string }> };
const documentAstCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-document-ast-corpus.json'),
    'utf8'
  )
) as { cases: Array<{ id: string }> };
const documentMapCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-document-map-corpus.json'),
    'utf8'
  )
) as { cases: Array<{ id: string }> };
const trustReportCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-trust-report-corpus.json'),
    'utf8'
  )
) as { cases: Array<{ id: string }> };
const selectableTableCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-selectable-table-corpus.json'),
    'utf8'
  )
) as { cases: Array<{ id: string }> };
const differentialWorkflow = readFileSync(
  join(root, '.github/workflows/rust-parity-differential.yml'),
  'utf8'
);

const failures: string[] = [];
if (
  !matrix.productTruth.dropInFor3014 &&
  !String(matrix.productTruth.publishedStable).includes('3.0.14')
) {
  failures.push('publishedStable must reference 3.0.14 while Rust is not drop-in');
}
const capabilityStatuses = Object.entries(matrix.tools).flatMap(([tool, capabilities]) =>
  Object.entries(capabilities).map(([capability, status]) => ({
    tool,
    capability,
    status,
  }))
);
const allowedStatuses = new Set(['FULL', 'PARTIAL', 'STUB', 'FAIL_CLOSED', 'MISSING']);
for (const { tool, capability, status } of capabilityStatuses) {
  if (!allowedStatuses.has(status))
    failures.push(`${tool}.${capability} has invalid status ${status}`);
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
if (matrix.productTruth.dropInFor3014 !== false) {
  failures.push('bounded Rust parity slices must keep dropInFor3014=false');
}
if (matrix.productTruth.publishFreeze !== true) {
  failures.push('bounded Rust parity slices must keep publishFreeze=true');
}
if (matrix.tools.read_pdf.include_semantic_hints !== 'PARTIAL') {
  failures.push('bounded semantic-hint claim must remain PARTIAL');
}
if (matrix.tools.read_pdf.include_document_ast !== 'PARTIAL') {
  failures.push('bounded document-AST claim must remain PARTIAL');
}
if (matrix.tools.read_pdf.include_document_map !== 'PARTIAL') {
  failures.push('bounded document-map claim must remain PARTIAL');
}
if (matrix.tools.read_pdf.include_trust_report !== 'PARTIAL') {
  failures.push('bounded trust-report claim must remain PARTIAL');
}
if (matrix.tools.read_pdf.include_tables !== 'PARTIAL') {
  failures.push('bounded selectable-table claim must remain PARTIAL');
}
const behaviorCaseCount = behaviorCorpus.cases.length;
if (
  !differentialWorkflow.includes(`.caseCount == ${behaviorCaseCount}`) ||
  !differentialWorkflow.includes(`.passed == ${behaviorCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${behaviorCaseCount}/${behaviorCaseCount} behavior corpus`
  );
}
const structureCaseCount = structureCorpus.cases.length + 1;
if (!differentialWorkflow.includes('bun run test:v3014-structure-differential')) {
  failures.push('rust parity workflow must execute the frozen structure differential');
}
if (structureCaseCount !== 11) {
  failures.push(
    `frozen structure/inspect differential must contain exactly 11 cases (got ${structureCaseCount})`
  );
}
const citationChunkCaseCount = citationChunkCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-citation-chunk-differential')) {
  failures.push('rust parity workflow must execute the frozen citation-chunk differential');
}
if (
  !differentialWorkflow.includes(`.caseCount == ${citationChunkCaseCount}`) ||
  !differentialWorkflow.includes(`.passed == ${citationChunkCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${citationChunkCaseCount}/${citationChunkCaseCount} citation-chunk corpus`
  );
}
if (citationChunkCaseCount !== 6) {
  failures.push(
    `frozen citation-chunk differential must contain exactly 6 cases (got ${citationChunkCaseCount})`
  );
}
const semanticHintCaseCount = semanticHintCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-semantic-hint-differential')) {
  failures.push('rust parity workflow must execute the frozen semantic-hint differential');
}
if (
  !differentialWorkflow.includes(`.caseCount == ${semanticHintCaseCount}`) ||
  !differentialWorkflow.includes(`.passed == ${semanticHintCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${semanticHintCaseCount}/${semanticHintCaseCount} semantic-hint corpus`
  );
}
if (semanticHintCaseCount !== 3) {
  failures.push(
    `frozen semantic-hint differential must contain exactly 3 cases (got ${semanticHintCaseCount})`
  );
}
const documentAstCaseCount = documentAstCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-document-ast-differential')) {
  failures.push('rust parity workflow must execute the frozen document-AST differential');
}
if (
  !differentialWorkflow.includes(`.caseCount == ${documentAstCaseCount}`) ||
  !differentialWorkflow.includes(`.passed == ${documentAstCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${documentAstCaseCount}/${documentAstCaseCount} document-AST corpus`
  );
}
if (documentAstCaseCount !== 6) {
  failures.push(
    `frozen document-AST differential must contain exactly 6 cases (got ${documentAstCaseCount})`
  );
}
if (
  !differentialWorkflow.includes(
    '.mutationSensitive.mutationManifestSha256 == "6a24391c42d4d6b7fd2e6007f0f807058a1aa78872dbb7f83ab6525752c40dfb"'
  ) ||
  !differentialWorkflow.includes('.mutationSensitive.leafMutationCount == 2384') ||
  !differentialWorkflow.includes('.mutationSensitive.unexpectedFieldProbeCount == 5')
) {
  failures.push('document-AST workflow must bind the exact mutation manifest, leaf count, and unexpected-field probes');
}
const documentMapCaseCount = documentMapCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-document-map-differential')) {
  failures.push('rust parity workflow must execute the frozen document-map differential');
}
if (
  !differentialWorkflow.includes(`.caseCount == ${documentMapCaseCount}`) ||
  !differentialWorkflow.includes(`.passed == ${documentMapCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${documentMapCaseCount}/${documentMapCaseCount} document-map corpus`
  );
}
if (documentMapCaseCount !== 8) {
  failures.push(
    `frozen document-map differential must contain exactly 8 cases (got ${documentMapCaseCount})`
  );
}
if (
  !differentialWorkflow.includes(
    '.mutationSensitive.mutationManifestSha256 == "64c5d3ce6733c76d7c31f54577e6b3e73f060776b0898fbffbbef1075456390c"'
  ) ||
  !differentialWorkflow.includes('.mutationSensitive.leafMutationCount == 3189') ||
  !differentialWorkflow.includes('.mutationSensitive.unexpectedFieldProbeCount == 8')
) {
  failures.push('document-map workflow must bind the exact mutation manifest, leaf count, and unexpected-field probes');
}
const trustReportCaseCount = trustReportCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-trust-report-differential')) {
  failures.push('rust parity workflow must execute the frozen trust-report differential');
}
if (
  !differentialWorkflow.includes(`.caseCount == ${trustReportCaseCount}`) ||
  !differentialWorkflow.includes(`.passed == ${trustReportCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${trustReportCaseCount}/${trustReportCaseCount} trust-report corpus`
  );
}
if (trustReportCaseCount !== 9) {
  failures.push(
    `frozen trust-report differential must contain exactly 9 cases (got ${trustReportCaseCount})`
  );
}
if (
  !differentialWorkflow.includes(
    '.mutationSensitive.mutationManifestSha256 == "28c02c6a9fa184c311fc06ddcb0cc21864f462c05d53447fc69fa019d6ec08e1"'
  ) ||
  !differentialWorkflow.includes('.mutationSensitive.leafMutationCount == 1117') ||
  !differentialWorkflow.includes('.mutationSensitive.wrongPrimitiveTypeProbeCount == 12') ||
  !differentialWorkflow.includes('.mutationSensitive.unexpectedFieldProbeCount == 5') ||
  !differentialWorkflow.includes('.mutationSensitive.requiredOmissionProbeCount == 12') ||
  !differentialWorkflow.includes('(.mapLinkage | to_entries | all(.value == true))')
) {
  failures.push('trust-report workflow must bind exact mutation counts and complete map-linkage proof');
}
const selectableTableCaseCount = selectableTableCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-selectable-table-differential')) {
  failures.push('rust parity workflow must execute the frozen selectable-table differential');
}
if (
  !differentialWorkflow.includes(`.caseCount == ${selectableTableCaseCount}`) ||
  !differentialWorkflow.includes(`.passed == ${selectableTableCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${selectableTableCaseCount}/${selectableTableCaseCount} selectable-table corpus`
  );
}
if (selectableTableCaseCount !== 6) {
  failures.push(`frozen selectable-table differential must contain exactly 6 cases (got ${selectableTableCaseCount})`);
}
if (
  !differentialWorkflow.includes(
    '.mutationSensitive.mutationManifestSha256 == "7ea2129614c89d9d50707d1f96a802bfe485f10ecc576989f9ac99be610df893"'
  ) ||
  !differentialWorkflow.includes('.mutationSensitive.leafMutationCount == 1625') ||
  !differentialWorkflow.includes('.mutationSensitive.wrongPrimitiveTypeProbeCount == 7') ||
  !differentialWorkflow.includes('.mutationSensitive.unexpectedFieldProbeCount == 11') ||
  !differentialWorkflow.includes('.mutationSensitive.requiredOmissionProbeCount == 7') ||
  !differentialWorkflow.includes('.mutationSensitive.privateLeakProbeCount == 5') ||
  !differentialWorkflow.includes('.mutationSensitive.dependencyPresenceProbeCount == 13')
) {
  failures.push('selectable-table workflow must bind the executed mutation manifest, leaf coverage, and exact probe counts');
}
if (
  !differentialWorkflow.includes('(.semanticProof | to_entries | all(.value == true))') ||
  !differentialWorkflow.includes('(.continuationProof | to_entries | all(.value == true))') ||
  !differentialWorkflow.includes('.resourceBoundProof.exactCapItemCount == 4096') ||
  !differentialWorkflow.includes('.resourceBoundProof.itemCount == 4097') ||
  !differentialWorkflow.includes('.resourceBoundProof.cap == 4096') ||
  !differentialWorkflow.includes('.resourceBoundProof.exactCapAccepted == true')
) {
  failures.push('selectable-table workflow must bind semantic/linkage proofs and exact-cap/cap+1 admission');
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('[check-pure-rust-matrix] PASS honest matrix invariants');
