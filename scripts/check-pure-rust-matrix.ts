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
  claimedForDifferential: string[];
  explicitlyNotClaimed: string[];
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
const captionLinkCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-caption-link-corpus.json'),
    'utf8'
  )
) as { cases: Array<{ id: string }> };
const searchSemanticCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-search-semantic-corpus.json'),
    'utf8'
  )
) as { cases: Array<{ id: string }>; nonclaim: { utf16SplitSurrogateWireParity: boolean } };
const lowercaseIndexCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-lowercase-index-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  localeContract: { defaultLocale: string; sentinel: string; lowercase: string };
  nonclaims: Record<string, boolean>;
};
const ocrSearchCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-ocr-search-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: { fixtureCount: number; caseCount: number; maxPagesPerCase: number };
  nonclaims: Record<string, boolean>;
};
const selectableTextSegmentationCorpus = JSON.parse(
  readFileSync(
    join(
      root,
      'scripts/differential/fixtures/v3014-selectable-text-segmentation-corpus.json'
    ),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    pageCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const rasterImageCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-raster-image-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxImagesPerCase: number;
    maxDecodedPixelsPerImage: number;
  };
  nonclaims: Record<string, boolean>;
};
const visualCandidateCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-visual-candidate-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxCandidatesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const differentialWorkflow = readFileSync(
  join(root, '.github/workflows/rust-parity-differential.yml'),
  'utf8'
);
const repositoryDifferential = readFileSync(
  join(root, 'scripts/run-pdf-reader-differential.sh'),
  'utf8'
);
const selectableTextSegmentationWorkflowStart = differentialWorkflow.indexOf(
  'SELECTABLE_TEXT_SEGMENTATION_ARTIFACT="${SCRATCH_DIR}/v3014-selectable-text-segmentation-result.json"'
);
const selectableTextSegmentationWorkflowEnd = differentialWorkflow.indexOf(
  'RASTER_IMAGE_ARTIFACT="${SCRATCH_DIR}/v3014-raster-image-result.json"',
  selectableTextSegmentationWorkflowStart
);
const selectableTextSegmentationWorkflow =
  selectableTextSegmentationWorkflowStart >= 0 &&
  selectableTextSegmentationWorkflowEnd > selectableTextSegmentationWorkflowStart
    ? differentialWorkflow.slice(
        selectableTextSegmentationWorkflowStart,
        selectableTextSegmentationWorkflowEnd
      )
    : '';
const rasterImageWorkflowStart = differentialWorkflow.indexOf(
  'RASTER_IMAGE_ARTIFACT="${SCRATCH_DIR}/v3014-raster-image-result.json"'
);
const rasterImageWorkflowEnd = differentialWorkflow.indexOf(
  'VISUAL_CANDIDATE_ARTIFACT="${SCRATCH_DIR}/v3014-visual-candidate-result.json"',
  rasterImageWorkflowStart
);
const rasterImageWorkflow =
  rasterImageWorkflowStart >= 0 && rasterImageWorkflowEnd > rasterImageWorkflowStart
    ? differentialWorkflow.slice(rasterImageWorkflowStart, rasterImageWorkflowEnd)
    : '';
const visualCandidateWorkflowStart = differentialWorkflow.indexOf(
  'VISUAL_CANDIDATE_ARTIFACT="${SCRATCH_DIR}/v3014-visual-candidate-result.json"'
);
const visualCandidateWorkflowEnd = differentialWorkflow.indexOf(
  'VISUAL_ARTIFACT="${SCRATCH_DIR}/v3014-visual-result.json"',
  visualCandidateWorkflowStart
);
const visualCandidateWorkflow =
  visualCandidateWorkflowStart >= 0 && visualCandidateWorkflowEnd > visualCandidateWorkflowStart
    ? differentialWorkflow.slice(visualCandidateWorkflowStart, visualCandidateWorkflowEnd)
    : '';

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
if (matrix.tools.read_pdf.include_images !== 'PARTIAL') {
  failures.push('bounded common-raster image claim must remain PARTIAL');
}
if (matrix.tools.read_pdf.include_visual_enrichments !== 'PARTIAL') {
  failures.push('bounded provider-independent visual-candidate claim must remain PARTIAL');
}
if (matrix.tools.search_pdf.include_ocr_text_layer !== 'PARTIAL') {
  failures.push('bounded OCR-search claim must remain PARTIAL');
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
const captionLinkCaseCount = captionLinkCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-caption-link-differential')) {
  failures.push('rust parity workflow must execute the frozen caption-link differential');
}
if (
  !differentialWorkflow.includes(`.caseCount == ${captionLinkCaseCount}`) ||
  !differentialWorkflow.includes(`.passed == ${captionLinkCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${captionLinkCaseCount}/${captionLinkCaseCount} caption-link corpus`
  );
}
if (captionLinkCaseCount !== 6) {
  failures.push(`frozen caption-link differential must contain exactly 6 cases (got ${captionLinkCaseCount})`);
}
if (
  !differentialWorkflow.includes(
    '.mutationSensitive.mutationManifestSha256 == "4e7807a895abaaba895ccdcd7096d768d57c72a92674a530afb8c58e31cf8e54"'
  ) ||
  !differentialWorkflow.includes('.mutationSensitive.leafMutationCount == 493') ||
  !differentialWorkflow.includes('.mutationSensitive.wrongPrimitiveTypeProbeCount == 5') ||
  !differentialWorkflow.includes('.mutationSensitive.unexpectedFieldProbeCount == 4') ||
  !differentialWorkflow.includes('.mutationSensitive.requiredOmissionProbeCount == 5') ||
  !differentialWorkflow.includes('.mutationSensitive.privateLeakProbeCount == 5') ||
  !differentialWorkflow.includes('.mutationSensitive.dependencyPresenceProbeCount == 12')
) {
  failures.push('caption-link workflow must bind the executed mutation manifest, leaf coverage, and exact probe counts');
}
const searchSemanticCaseCount = searchSemanticCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-search-semantic-differential')) {
  failures.push('rust parity workflow must execute the frozen search-semantic differential');
}
if (
  !differentialWorkflow.includes(`.caseCount == ${searchSemanticCaseCount}`) ||
  !differentialWorkflow.includes(`.passed == ${searchSemanticCaseCount}`)
) {
  failures.push(`rust parity workflow must require the exact ${searchSemanticCaseCount}/${searchSemanticCaseCount} search-semantic corpus`);
}
if (searchSemanticCaseCount !== 12) {
  failures.push(`frozen search-semantic differential must contain exactly 12 cases (got ${searchSemanticCaseCount})`);
}
if (searchSemanticCorpus.nonclaim.utf16SplitSurrogateWireParity !== false) {
  failures.push('search-semantic corpus must explicitly exclude split-surrogate wire parity');
}
if (
  !differentialWorkflow.includes(
    '.mutationSensitive.mutationManifestSha256 == "b5f9aebf64bea4633376fdab137f57369d845173996ce21fb1b3bfe748c0481c"'
  ) ||
  !differentialWorkflow.includes('.mutationSensitive.leafMutationCount == 171') ||
  !differentialWorkflow.includes('.mutationSensitive.wrongPrimitiveTypeProbeCount == 4') ||
  !differentialWorkflow.includes('.mutationSensitive.unexpectedFieldProbeCount == 2') ||
  !differentialWorkflow.includes('.mutationSensitive.requiredOmissionProbeCount == 2') ||
  !differentialWorkflow.includes('.nonclaim.utf16SplitSurrogateWireParity == false') ||
  !differentialWorkflow.includes('.nonclaim.failClosedProof == true') ||
  !differentialWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !differentialWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push('search-semantic workflow must bind mutation proof, nonclaim, and frozen product truth');
}
const lowercaseIndexCaseCount = lowercaseIndexCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-lowercase-index-differential')) {
  failures.push('rust parity workflow must execute the frozen lowercase-index differential');
}
if (
  !differentialWorkflow.includes(`.caseCount == ${lowercaseIndexCaseCount}`) ||
  !differentialWorkflow.includes(`.passed == ${lowercaseIndexCaseCount}`)
) {
  failures.push(`rust parity workflow must require the exact ${lowercaseIndexCaseCount}/${lowercaseIndexCaseCount} lowercase-index corpus`);
}
if (lowercaseIndexCaseCount !== 6) failures.push(`frozen lowercase-index differential must contain exactly 6 cases (got ${lowercaseIndexCaseCount})`);
if (
  lowercaseIndexCorpus.localeContract.defaultLocale !== 'en-US' ||
  lowercaseIndexCorpus.localeContract.sentinel !== 'İX' ||
  lowercaseIndexCorpus.localeContract.lowercase !== 'i\u0307x' ||
  Object.values(lowercaseIndexCorpus.nonclaims).some((value) => value !== false)
) failures.push('lowercase-index locale sentinel and explicit nonclaims must remain frozen');
if (
  !differentialWorkflow.includes('.mutationSensitive.mutationManifestSha256 == "ec260134fe80513ee741b5b02c47830a9e3cc409a6420fc9fd5020f0f4662ec4"') ||
  !differentialWorkflow.includes('.mutationSensitive.leafMutationCount == 43') ||
  !differentialWorkflow.includes('.mutationSensitive.wrongPrimitiveTypeProbeCount == 5') ||
  !differentialWorkflow.includes('.mutationSensitive.unexpectedFieldProbeCount == 2') ||
  !differentialWorkflow.includes('.mutationSensitive.requiredOmissionProbeCount == 3') ||
  !differentialWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !differentialWorkflow.includes('.productTruth.publishFreeze == true')
) failures.push('lowercase-index workflow must bind mutation proof and frozen product truth');
const selectableTextSegmentationCaseCount = selectableTextSegmentationCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-selectable-text-segmentation-differential'
  )
) {
  failures.push('rust parity workflow must execute the frozen selectable-text-segmentation differential');
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-selectable-text-segmentation-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-selectable-text-segmentation-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014SelectableTextSegmentationCaseCount') ||
  !repositoryDifferential.includes('v3014SelectableTextSegmentationCorpusHash') ||
  !repositoryDifferential.includes('v3014SelectableTextSegmentationOracleHash') ||
  !repositoryDifferential.includes('v3014SelectableTextSegmentationRunnerHash') ||
  !repositoryDifferential.includes('v3014SelectableTextSegmentationProjectionHash') ||
  !repositoryDifferential.includes('v3014SelectableTextSegmentationGeneratorHash') ||
  !repositoryDifferential.includes('v3014SelectableTextSegmentationFixtureManifestHash') ||
  !repositoryDifferential.includes('v3014SelectableTextSegmentationFixtureHash') ||
  !repositoryDifferential.includes('v3014SelectableTextSegmentationProfile') ||
  !repositoryDifferential.includes('v3014SelectableTextSegmentationPass') ||
  !repositoryDifferential.includes('v3014SelectableTextSegmentationMutationSensitive') ||
  !repositoryDifferential.includes('v3014SelectableTextSegmentationSemanticProof') ||
  !repositoryDifferential.includes('v3014SelectableTextSegmentationPdfjsObservation') ||
  !repositoryDifferential.includes('v3014SelectableTextSegmentationNonclaims') ||
  !repositoryDifferential.includes('v3014SelectableTextSegmentationProductTruth') ||
  !repositoryDifferential.includes(
    'v3014-selectable-text-segmentation-baseline-runner.ts'
  ) ||
  !repositoryDifferential.includes('v3014-selectable-text-segmentation-projection.ts') ||
  !repositoryDifferential.includes(
    'generate-v3014-selectable-text-segmentation-fixture.ts'
  ) ||
  !repositoryDifferential.includes('v3014-selectable-text-segmentation-corpus.json') ||
  !repositoryDifferential.includes('v3014-selectable-text-segmentation-oracle.json') ||
  !repositoryDifferential.includes('v3014-selectable-text-segmentation-fixture.json') ||
  !repositoryDifferential.includes('v3014-selectable-text-segmentation-v1.pdf')
) {
  failures.push('repository differential artifact must bind the selectable-text-segmentation family');
}
if (
  !selectableTextSegmentationWorkflow.includes(
    `.caseCount == ${selectableTextSegmentationCaseCount}`
  ) ||
  !selectableTextSegmentationWorkflow.includes(
    `.passed == ${selectableTextSegmentationCaseCount}`
  ) ||
  !selectableTextSegmentationWorkflow.includes('.skipped == 0')
) {
  failures.push(
    `rust parity workflow must require the exact ${selectableTextSegmentationCaseCount}/${selectableTextSegmentationCaseCount} selectable-text-segmentation corpus with zero skips`
  );
}
if (
  selectableTextSegmentationCaseCount !== 4 ||
  selectableTextSegmentationCorpus.envelope.fixtureCount !== 1 ||
  selectableTextSegmentationCorpus.envelope.pageCount !== 5 ||
  selectableTextSegmentationCorpus.envelope.caseCount !== 4 ||
  selectableTextSegmentationCorpus.envelope.maxPagesPerCase !== 5 ||
  Object.values(selectableTextSegmentationCorpus.nonclaims).some((value) => value !== false)
) {
  failures.push('selectable-text-segmentation corpus envelope and explicit nonclaims must remain frozen');
}
if (
  !selectableTextSegmentationWorkflow.includes(
    '.corpusSha256 == "7ffb00b303ed6c69b892703b04ada8717d096eb4abe18c7df11d597595679fe7"'
  ) ||
  !selectableTextSegmentationWorkflow.includes(
    '.oracleSha256 == "2cf463f36419ca7eb7f3f90f8eee25af9df1d5aae7cff5505934a9abffec206f"'
  ) ||
  !selectableTextSegmentationWorkflow.includes(
    '.runnerSha256 == "3c98b1c2fd3b0e0cba0f4c6924f6b7f8566b6610eac0abeb5f826b2edcd559e1"'
  ) ||
  !selectableTextSegmentationWorkflow.includes(
    '.projectionSha256 == "a8c48e183cb037d160c47797dd8eefba9b5f84702e087e20d5e16a215b1683dd"'
  ) ||
  !selectableTextSegmentationWorkflow.includes(
    '.generatorSha256 == "35aec9a77916c437ba99e39d9352c66735736f6bc76e5d219e3a4f74057dd5f4"'
  ) ||
  !selectableTextSegmentationWorkflow.includes(
    '.fixtureManifestSha256 == "c6144f7354b7c6c84b7a0b8c6e6b0d682ea8baea4925f229770c9d41ffb6eb7a"'
  ) ||
  !selectableTextSegmentationWorkflow.includes(
    '.fixtureSha256 == "bb765fb7402107bf4d67805e8ec0e594f962bf51b386439316575358e341c9dd"'
  ) ||
  !selectableTextSegmentationWorkflow.includes(
    '.mutationSensitive.mutationManifestSha256 == "6f8733264fec378ec45b094225ea5fe026a9a75c81563a9dcead3722681e1bbe"'
  ) ||
  !selectableTextSegmentationWorkflow.includes('.mutationSensitive.leafMutationCount == 1043') ||
  !selectableTextSegmentationWorkflow.includes(
    '.mutationSensitive.wrongPrimitiveTypeProbeCount == 5'
  ) ||
  !selectableTextSegmentationWorkflow.includes(
    '.mutationSensitive.unexpectedFieldProbeCount == 4'
  ) ||
  !selectableTextSegmentationWorkflow.includes(
    '.mutationSensitive.requiredOmissionProbeCount == 5'
  ) ||
  !selectableTextSegmentationWorkflow.includes(
    '.mutationSensitive.publicOmissionProbeCount == 4'
  ) ||
  !selectableTextSegmentationWorkflow.includes(
    '.mutationSensitive.dependencyPresenceProbeCount == 5'
  ) ||
  !selectableTextSegmentationWorkflow.includes(
    '(.semanticProof | to_entries | length == 10 and all(.value == true))'
  ) ||
  !selectableTextSegmentationWorkflow.includes(
    '.pdfjsObservation.syntheticWhitespaceAt48 == false'
  ) ||
  !selectableTextSegmentationWorkflow.includes(
    '.pdfjsObservation.syntheticWhitespaceAbove48 == false'
  ) ||
  !selectableTextSegmentationWorkflow.includes(
    '.pdfjsObservation.directGapThresholdIsolatedByPdfFixture == true'
  ) ||
  !selectableTextSegmentationWorkflow.includes(
    '(.nonclaims | to_entries | length == 7 and all(.value == false))'
  ) ||
  !selectableTextSegmentationWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !selectableTextSegmentationWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push('selectable-text-segmentation workflow must bind exact hashes, mutation counts, semantic proof, PDF.js observation, nonclaims, and product truth');
}
if (
  matrix.tools.read_pdf.include_full_text !== 'PARTIAL' ||
  matrix.tools.read_pdf.include_elements !== 'PARTIAL' ||
  matrix.tools.read_pdf.include_chunks !== 'PARTIAL' ||
  matrix.tools.read_pdf.include_text_layer !== 'PARTIAL' ||
  matrix.tools.read_pdf.include_document_map !== 'PARTIAL' ||
  matrix.tools.read_pdf.bounding_boxes !== 'PARTIAL' ||
  matrix.tools.search_pdf.literal_search !== 'PARTIAL' ||
  matrix.tools.search_pdf.bounding_box !== 'PARTIAL'
) {
  failures.push('bounded selectable-text-segmentation claim must keep affected read/search capabilities PARTIAL');
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes(
        'exact 4-case immutable TS v3.0.14 LTR selectable-text segmentation subset'
      ) &&
      claim.includes('request-wide raw-part and normalized-segment caps of 65,536') &&
      claim.includes('per-page caps of 8,192') &&
      claim.includes('exact-cap acceptance and cap-plus-one rejection') &&
      claim.includes('raw-part rejection before allocation') &&
      claim.includes('normalized rejection without partial output') &&
      claim.includes('O(runs + chars) 4,096-run text-layer projection')
  ) ||
  !matrix.explicitlyNotClaimed.some(
    (claim) =>
      claim.includes('selectable-text segmentation outside the frozen 4-case LTR corpus') &&
      claim.includes('cross-runtime hostile-input resource parity')
  )
) {
  failures.push('selectable-text-segmentation claim and explicit nonclaims must remain documented');
}
const rasterImageCaseCount = rasterImageCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-raster-image-differential')) {
  failures.push('rust parity workflow must execute the frozen raster-image differential');
}
if (
  !rasterImageWorkflow.includes(`.caseCount == ${rasterImageCaseCount}`) ||
  !rasterImageWorkflow.includes(`.passed == ${rasterImageCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${rasterImageCaseCount}/${rasterImageCaseCount} raster-image corpus`
  );
}
if (
  rasterImageCaseCount !== 14 ||
  rasterImageCorpus.envelope.fixtureCount !== 3 ||
  rasterImageCorpus.envelope.maxPagesPerCase !== 4 ||
  rasterImageCorpus.envelope.maxImagesPerCase !== 2 ||
  rasterImageCorpus.envelope.maxDecodedPixelsPerImage !== 4 ||
  Object.values(rasterImageCorpus.nonclaims).some((value) => value !== false)
) {
  failures.push('raster-image corpus envelope and explicit nonclaims must remain frozen');
}
if (
  !rasterImageWorkflow.includes(
    '.mutationSensitive.mutationManifestSha256 == "d331d3de0dd6405fc424a9dbc6264b23e9e48b03bc19bf43406007f645f9d494"'
  ) ||
  !rasterImageWorkflow.includes('.mutationSensitive.leafMutationCount == 430') ||
  !rasterImageWorkflow.includes('.mutationSensitive.wrongPrimitiveTypeProbeCount == 5') ||
  !rasterImageWorkflow.includes('.mutationSensitive.unexpectedFieldProbeCount == 3') ||
  !rasterImageWorkflow.includes('.mutationSensitive.requiredOmissionProbeCount == 2') ||
  !rasterImageWorkflow.includes('.decodedPixelProof.comparedCompressionBytes == false') ||
  !rasterImageWorkflow.includes('.capabilityStatus.includeImages == "PARTIAL"') ||
  !rasterImageWorkflow.includes('.capabilityStatus.visualEnrichments == "PARTIAL"') ||
  !rasterImageWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !rasterImageWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push('raster-image workflow must bind mutation, decoded-pixel, capability, and product-truth proof');
}
const visualCandidateCaseCount = visualCandidateCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-visual-candidate-differential')) {
  failures.push('rust parity workflow must execute the frozen visual-candidate differential');
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-visual-candidate-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-visual-candidate-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014VisualCandidateCaseCount') ||
  !repositoryDifferential.includes('v3014VisualCandidateCorpusHash') ||
  !repositoryDifferential.includes('v3014VisualCandidateOracleHash')
) {
  failures.push('repository differential artifact must bind the visual-candidate family');
}
if (
  !visualCandidateWorkflow.includes(`.caseCount == ${visualCandidateCaseCount}`) ||
  !visualCandidateWorkflow.includes(`.passed == ${visualCandidateCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${visualCandidateCaseCount}/${visualCandidateCaseCount} visual-candidate corpus`
  );
}
if (
  visualCandidateCaseCount !== 11 ||
  visualCandidateCorpus.envelope.fixtureCount !== 1 ||
  visualCandidateCorpus.envelope.maxPagesPerCase !== 2 ||
  visualCandidateCorpus.envelope.maxCandidatesPerCase !== 2 ||
  Object.values(visualCandidateCorpus.nonclaims).some((value) => value !== false)
) {
  failures.push('visual-candidate corpus envelope and explicit nonclaims must remain frozen');
}
if (
  !visualCandidateWorkflow.includes(
    '.mutationSensitive.mutationManifestSha256 == "75763aa379f2db5558a9ce91b06bbc7f44df1839195e1b15ff86d1642ad2d70c"'
  ) ||
  !visualCandidateWorkflow.includes('.mutationSensitive.leafMutationCount == 362') ||
  !visualCandidateWorkflow.includes('.mutationSensitive.wrongPrimitiveTypeProbeCount == 4') ||
  !visualCandidateWorkflow.includes('.mutationSensitive.unexpectedFieldProbeCount == 2') ||
  !visualCandidateWorkflow.includes('.mutationSensitive.requiredOmissionProbeCount == 4') ||
  !visualCandidateWorkflow.includes('.mutationSensitive.publicOmissionProbeCount == 3') ||
  !visualCandidateWorkflow.includes('.mutationSensitive.privateLeakProbeCount == 2') ||
  !visualCandidateWorkflow.includes('.mutationSensitive.dependencyPresenceProbeCount == 6') ||
  !visualCandidateWorkflow.includes('.providerIndependentProof.providerNotConfigured == true') ||
  !visualCandidateWorkflow.includes('.providerIndependentProof.candidatesRetained == true') ||
  !visualCandidateWorkflow.includes('.providerIndependentProof.enrichmentsOmitted == true') ||
  !visualCandidateWorkflow.includes('.providerIndependentProof.internalElementsHidden == true') ||
  !visualCandidateWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !visualCandidateWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push('visual-candidate workflow must bind provider-independent and product-truth proof');
}
const ocrSearchCaseCount = ocrSearchCorpus.cases.length;
if (
  ocrSearchCaseCount !== 12 ||
  ocrSearchCorpus.envelope.caseCount !== 12 ||
  ocrSearchCorpus.envelope.fixtureCount !== 1 ||
  ocrSearchCorpus.envelope.maxPagesPerCase !== 4 ||
  ocrSearchCorpus.nonclaims.dropInFor3014 !== false ||
  ocrSearchCorpus.nonclaims.publishFreeze !== true ||
  ocrSearchCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push('OCR-search corpus envelope, nonclaims, and product truth must remain frozen');
}
if (
  !differentialWorkflow.includes('bun run test:v3014-ocr-search-differential') ||
  !differentialWorkflow.includes('.profile == "pdf_reader_v3014_ocr_search_result"') ||
  !differentialWorkflow.includes('.caseCount == 12 and .passed == 12 and .skipped == 0') ||
  !differentialWorkflow.includes('.mutationSensitive.leafMutationCount == 185') ||
  !differentialWorkflow.includes('.resourceProof.sourceCap32PreIoAnd33Rejected == true') ||
  !differentialWorkflow.includes('.resourceProof.crossRuntimeHostileResourceParity == false') ||
  !differentialWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !differentialWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push('rust parity workflow must bind the exact OCR-search corpus, resources, nonclaims, and product truth');
}
for (const required of [
  'scripts/differential/check-v3014-ocr-search-differential.ts',
  'scripts/differential/capture-v3014-ocr-search-oracle.ts',
  'v3014-ocr-search-baseline-runner.ts',
  'v3014-ocr-search-projection.ts',
  'v3014-ocr-search-corpus.json',
  'v3014-ocr-search-oracle.json',
  'v3014OcrSearchCaseCount',
  'v3014OcrSearchCorpusHash',
  'v3014OcrSearchOracleHash',
  'v3014OcrSearchResourceProof',
  'v3014OcrSearchNonclaims',
  'v3014OcrSearchProductTruth',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(`repository differential artifact must bind OCR-search family member: ${required}`);
  }
}
if (
  !matrix.claimedForDifferential.some((claim) => claim.includes('exact 12-case') && claim.includes('OCR-search')) ||
  !matrix.explicitlyNotClaimed.some((claim) => claim.includes('OCR search outside the frozen 12-case'))
) {
  failures.push('OCR-search bounded claim and explicit nonclaims must remain documented');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('[check-pure-rust-matrix] PASS honest matrix invariants');
