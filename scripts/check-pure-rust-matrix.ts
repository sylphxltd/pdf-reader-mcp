#!/usr/bin/env bun
/** Fail-closed phase invariants for the pure-Rust capability ledger. */
import { existsSync, readFileSync } from 'node:fs';
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
const visualFusionCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-visual-fusion-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxCandidatesPerCase: number;
    maxProviderCallsPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const documentAstVisualFusionCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-document-ast-visual-fusion-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxCandidatesPerCase: number;
    maxProviderCallsPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const readOcrCorpus = JSON.parse(
  readFileSync(join(root, 'scripts/differential/fixtures/v3014-read-ocr-corpus.json'), 'utf8')
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxOcrPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const readOcrResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-read-ocr-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxOcrPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const ocrTsvCorpus = JSON.parse(
  readFileSync(join(root, 'scripts/differential/fixtures/v3014-ocr-tsv-corpus.json'), 'utf8')
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxOcrPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const ocrTableMergeCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-ocr-table-merge-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxOcrPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const ocrSearchResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-ocr-search-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxMatchesPerSource: number;
  };
  nonclaims: Record<string, boolean>;
};
const ocrSearchInterleaveCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-ocr-search-interleave-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxMatchesPerSource: number;
  };
  nonclaims: Record<string, boolean>;
};
const urlSingleFetchCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-url-single-fetch-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxFetchesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const ocrSearchTsvCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-ocr-search-tsv-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxMatchesPerSource: number;
  };
  nonclaims: Record<string, boolean>;
};
const searchMultiwordGeometryCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-search-multiword-geometry-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxMatchesPerSource: number;
  };
  nonclaims: Record<string, boolean>;
};
const formResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-form-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxFieldsPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const formRadioGroupCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-form-radio-group-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxFieldsPerCase: number;
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
  'VISUAL_FUSION_ARTIFACT="${SCRATCH_DIR}/v3014-visual-fusion-result.json"',
  visualCandidateWorkflowStart
);
const visualCandidateWorkflow =
  visualCandidateWorkflowStart >= 0 && visualCandidateWorkflowEnd > visualCandidateWorkflowStart
    ? differentialWorkflow.slice(visualCandidateWorkflowStart, visualCandidateWorkflowEnd)
    : '';
const visualFusionWorkflowStart = differentialWorkflow.indexOf(
  'VISUAL_FUSION_ARTIFACT="${SCRATCH_DIR}/v3014-visual-fusion-result.json"'
);
const visualFusionWorkflowEnd = differentialWorkflow.indexOf(
  'DOCUMENT_AST_VISUAL_FUSION_ARTIFACT="${SCRATCH_DIR}/v3014-document-ast-visual-fusion-result.json"',
  visualFusionWorkflowStart
);
const visualFusionWorkflow =
  visualFusionWorkflowStart >= 0 && visualFusionWorkflowEnd > visualFusionWorkflowStart
    ? differentialWorkflow.slice(visualFusionWorkflowStart, visualFusionWorkflowEnd)
    : '';
const documentAstVisualFusionWorkflowStart = differentialWorkflow.indexOf(
  'DOCUMENT_AST_VISUAL_FUSION_ARTIFACT="${SCRATCH_DIR}/v3014-document-ast-visual-fusion-result.json"'
);
const documentAstVisualFusionWorkflowEnd = differentialWorkflow.indexOf(
  'READ_OCR_ARTIFACT="${SCRATCH_DIR}/v3014-read-ocr-result.json"',
  documentAstVisualFusionWorkflowStart
);
const documentAstVisualFusionWorkflow =
  documentAstVisualFusionWorkflowStart >= 0 &&
  documentAstVisualFusionWorkflowEnd > documentAstVisualFusionWorkflowStart
    ? differentialWorkflow.slice(
        documentAstVisualFusionWorkflowStart,
        documentAstVisualFusionWorkflowEnd
      )
    : '';
const readOcrWorkflowStart = differentialWorkflow.indexOf(
  'READ_OCR_ARTIFACT="${SCRATCH_DIR}/v3014-read-ocr-result.json"'
);
const readOcrWorkflowEnd = differentialWorkflow.indexOf(
  'READ_OCR_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-read-ocr-residual-result.json"',
  readOcrWorkflowStart
);
const readOcrWorkflow =
  readOcrWorkflowStart >= 0 && readOcrWorkflowEnd > readOcrWorkflowStart
    ? differentialWorkflow.slice(readOcrWorkflowStart, readOcrWorkflowEnd)
    : '';
const readOcrResidualWorkflowStart = differentialWorkflow.indexOf(
  'READ_OCR_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-read-ocr-residual-result.json"'
);
const readOcrResidualWorkflowEnd = differentialWorkflow.indexOf(
  'OCR_TSV_ARTIFACT="${SCRATCH_DIR}/v3014-ocr-tsv-result.json"',
  readOcrResidualWorkflowStart
);
const readOcrResidualWorkflow =
  readOcrResidualWorkflowStart >= 0 &&
  readOcrResidualWorkflowEnd > readOcrResidualWorkflowStart
    ? differentialWorkflow.slice(readOcrResidualWorkflowStart, readOcrResidualWorkflowEnd)
    : '';
const ocrTsvWorkflowStart = differentialWorkflow.indexOf(
  'OCR_TSV_ARTIFACT="${SCRATCH_DIR}/v3014-ocr-tsv-result.json"'
);
const ocrTsvWorkflowEnd = differentialWorkflow.indexOf(
  'OCR_TABLE_MERGE_ARTIFACT="${SCRATCH_DIR}/v3014-ocr-table-merge-result.json"',
  ocrTsvWorkflowStart
);
const ocrTsvWorkflow =
  ocrTsvWorkflowStart >= 0 && ocrTsvWorkflowEnd > ocrTsvWorkflowStart
    ? differentialWorkflow.slice(ocrTsvWorkflowStart, ocrTsvWorkflowEnd)
    : '';
const ocrTableMergeWorkflowStart = differentialWorkflow.indexOf(
  'OCR_TABLE_MERGE_ARTIFACT="${SCRATCH_DIR}/v3014-ocr-table-merge-result.json"'
);
const ocrTableMergeWorkflowEnd = differentialWorkflow.indexOf(
  'OCR_SEARCH_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-ocr-search-residual-result.json"',
  ocrTableMergeWorkflowStart
);
const ocrTableMergeWorkflow =
  ocrTableMergeWorkflowStart >= 0 &&
  ocrTableMergeWorkflowEnd > ocrTableMergeWorkflowStart
    ? differentialWorkflow.slice(ocrTableMergeWorkflowStart, ocrTableMergeWorkflowEnd)
    : '';
const ocrSearchResidualWorkflowStart = differentialWorkflow.indexOf(
  'OCR_SEARCH_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-ocr-search-residual-result.json"'
);
const ocrSearchResidualWorkflowEnd = differentialWorkflow.indexOf(
  'OCR_SEARCH_INTERLEAVE_ARTIFACT="${SCRATCH_DIR}/v3014-ocr-search-interleave-result.json"',
  ocrSearchResidualWorkflowStart
);
const ocrSearchResidualWorkflow =
  ocrSearchResidualWorkflowStart >= 0 &&
  ocrSearchResidualWorkflowEnd > ocrSearchResidualWorkflowStart
    ? differentialWorkflow.slice(ocrSearchResidualWorkflowStart, ocrSearchResidualWorkflowEnd)
    : '';
const ocrSearchInterleaveWorkflowStart = differentialWorkflow.indexOf(
  'OCR_SEARCH_INTERLEAVE_ARTIFACT="${SCRATCH_DIR}/v3014-ocr-search-interleave-result.json"'
);
const ocrSearchInterleaveWorkflowEnd = differentialWorkflow.indexOf(
  'URL_SINGLE_FETCH_ARTIFACT="${SCRATCH_DIR}/v3014-url-single-fetch-result.json"',
  ocrSearchInterleaveWorkflowStart
);
const ocrSearchInterleaveWorkflow =
  ocrSearchInterleaveWorkflowStart >= 0 &&
  ocrSearchInterleaveWorkflowEnd > ocrSearchInterleaveWorkflowStart
    ? differentialWorkflow.slice(ocrSearchInterleaveWorkflowStart, ocrSearchInterleaveWorkflowEnd)
    : '';
const urlSingleFetchWorkflowStart = differentialWorkflow.indexOf(
  'URL_SINGLE_FETCH_ARTIFACT="${SCRATCH_DIR}/v3014-url-single-fetch-result.json"'
);
const urlSingleFetchWorkflowEnd = differentialWorkflow.indexOf(
  'OCR_SEARCH_TSV_ARTIFACT="${SCRATCH_DIR}/v3014-ocr-search-tsv-result.json"',
  urlSingleFetchWorkflowStart
);
const urlSingleFetchWorkflow =
  urlSingleFetchWorkflowStart >= 0 &&
  urlSingleFetchWorkflowEnd > urlSingleFetchWorkflowStart
    ? differentialWorkflow.slice(urlSingleFetchWorkflowStart, urlSingleFetchWorkflowEnd)
    : '';
const ocrSearchTsvWorkflowStart = differentialWorkflow.indexOf(
  'OCR_SEARCH_TSV_ARTIFACT="${SCRATCH_DIR}/v3014-ocr-search-tsv-result.json"'
);
const ocrSearchTsvWorkflowEnd = differentialWorkflow.indexOf(
  'SEARCH_MULTIWORD_GEOMETRY_ARTIFACT="${SCRATCH_DIR}/v3014-search-multiword-geometry-result.json"',
  ocrSearchTsvWorkflowStart
);
const ocrSearchTsvWorkflow =
  ocrSearchTsvWorkflowStart >= 0 &&
  ocrSearchTsvWorkflowEnd > ocrSearchTsvWorkflowStart
    ? differentialWorkflow.slice(ocrSearchTsvWorkflowStart, ocrSearchTsvWorkflowEnd)
    : '';
const searchMultiwordGeometryWorkflowStart = differentialWorkflow.indexOf(
  'SEARCH_MULTIWORD_GEOMETRY_ARTIFACT="${SCRATCH_DIR}/v3014-search-multiword-geometry-result.json"'
);
const searchMultiwordGeometryWorkflowEnd = differentialWorkflow.indexOf(
  'FORM_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-form-residual-result.json"',
  searchMultiwordGeometryWorkflowStart
);
const searchMultiwordGeometryWorkflow =
  searchMultiwordGeometryWorkflowStart >= 0 &&
  searchMultiwordGeometryWorkflowEnd > searchMultiwordGeometryWorkflowStart
    ? differentialWorkflow.slice(
        searchMultiwordGeometryWorkflowStart,
        searchMultiwordGeometryWorkflowEnd
      )
    : '';
const formResidualWorkflowStart = differentialWorkflow.indexOf(
  'FORM_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-form-residual-result.json"'
);
const formResidualWorkflowEnd = differentialWorkflow.indexOf(
  'FORM_RADIO_GROUP_ARTIFACT="${SCRATCH_DIR}/v3014-form-radio-group-result.json"',
  formResidualWorkflowStart
);
const formResidualWorkflow =
  formResidualWorkflowStart >= 0 && formResidualWorkflowEnd > formResidualWorkflowStart
    ? differentialWorkflow.slice(formResidualWorkflowStart, formResidualWorkflowEnd)
    : '';
const formRadioGroupWorkflowStart = differentialWorkflow.indexOf(
  'FORM_RADIO_GROUP_ARTIFACT="${SCRATCH_DIR}/v3014-form-radio-group-result.json"'
);
const formRadioGroupWorkflowEnd = differentialWorkflow.indexOf(
  'VISUAL_ARTIFACT="${SCRATCH_DIR}/v3014-visual-result.json"',
  formRadioGroupWorkflowStart
);
const formRadioGroupWorkflow =
  formRadioGroupWorkflowStart >= 0 &&
  formRadioGroupWorkflowEnd > formRadioGroupWorkflowStart
    ? differentialWorkflow.slice(formRadioGroupWorkflowStart, formRadioGroupWorkflowEnd)
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
if (matrix.tools.read_pdf.include_ocr_text_layer !== 'PARTIAL') {
  failures.push('bounded read_pdf include_ocr_text_layer claim must remain PARTIAL');
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

const visualFusionCaseCount = visualFusionCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-visual-fusion-differential')) {
  failures.push('rust parity workflow must execute the frozen visual-fusion differential');
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-visual-fusion-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-visual-fusion-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014VisualFusionCaseCount') ||
  !repositoryDifferential.includes('v3014VisualFusionCorpusHash') ||
  !repositoryDifferential.includes('v3014VisualFusionOracleHash')
) {
  failures.push('repository differential artifact must bind the visual-fusion family');
}
if (
  !visualFusionWorkflow.includes(`.caseCount == ${visualFusionCaseCount}`) ||
  !visualFusionWorkflow.includes(`.passed == ${visualFusionCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${visualFusionCaseCount}/${visualFusionCaseCount} visual-fusion corpus`
  );
}
if (
  visualFusionCaseCount !== 5 ||
  visualFusionCorpus.envelope.fixtureCount !== 1 ||
  visualFusionCorpus.envelope.maxPagesPerCase !== 3 ||
  visualFusionCorpus.envelope.maxCandidatesPerCase !== 2 ||
  visualFusionCorpus.envelope.maxProviderCallsPerCase !== 2 ||
  visualFusionCorpus.nonclaims.dropInFor3014 !== false ||
  visualFusionCorpus.nonclaims.publishFreeze !== true
) {
  failures.push('visual-fusion corpus envelope and explicit product-truth nonclaims must remain frozen');
}
if (
  !visualFusionWorkflow.includes('.mutationSensitive.leafMutationCount == 565') ||
  !visualFusionWorkflow.includes('.portabilityProof.relocatedFixtureRootReplay == true') ||
  !visualFusionWorkflow.includes('.providerProof.configuredCommandOnly == true') ||
  !visualFusionWorkflow.includes('.providerProof.zeroCallNoCandidate == true') ||
  !visualFusionWorkflow.includes('.providerProof.failClosedDiscardsPartial == true') ||
  !visualFusionWorkflow.includes('.capabilityStatus.includeVisualEnrichments == "PARTIAL"') ||
  !visualFusionWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !visualFusionWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push('visual-fusion workflow must bind mutation, provider, capability, and product-truth proof');
}
const documentAstVisualFusionCaseCount = documentAstVisualFusionCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-document-ast-visual-fusion-differential')) {
  failures.push('rust parity workflow must execute the frozen document-ast-visual-fusion differential');
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-document-ast-visual-fusion-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-document-ast-visual-fusion-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014DocumentAstVisualFusionCaseCount') ||
  !repositoryDifferential.includes('v3014DocumentAstVisualFusionCorpusHash') ||
  !repositoryDifferential.includes('v3014DocumentAstVisualFusionOracleHash')
) {
  failures.push('repository differential artifact must bind the document-ast-visual-fusion family');
}
if (
  !documentAstVisualFusionWorkflow.includes(`.caseCount == ${documentAstVisualFusionCaseCount}`) ||
  !documentAstVisualFusionWorkflow.includes(`.passed == ${documentAstVisualFusionCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${documentAstVisualFusionCaseCount}/${documentAstVisualFusionCaseCount} document-ast-visual-fusion corpus`
  );
}
if (
  documentAstVisualFusionCaseCount !== 5 ||
  documentAstVisualFusionCorpus.envelope.fixtureCount !== 1 ||
  documentAstVisualFusionCorpus.envelope.maxPagesPerCase !== 3 ||
  documentAstVisualFusionCorpus.envelope.maxCandidatesPerCase !== 2 ||
  documentAstVisualFusionCorpus.envelope.maxProviderCallsPerCase !== 2 ||
  documentAstVisualFusionCorpus.nonclaims.dropInFor3014 !== false ||
  documentAstVisualFusionCorpus.nonclaims.publishFreeze !== true
) {
  failures.push('document-ast-visual-fusion corpus envelope and product-truth nonclaims must remain frozen');
}
if (
  !documentAstVisualFusionWorkflow.includes('.mutationSensitive.leafMutationCount == 145') ||
  !documentAstVisualFusionWorkflow.includes('.portabilityProof.relocatedFixtureRootReplay == true') ||
  !documentAstVisualFusionWorkflow.includes('.providerProof.configuredCommandOnly == true') ||
  !documentAstVisualFusionWorkflow.includes('.providerProof.zeroCallNoCandidate == true') ||
  !documentAstVisualFusionWorkflow.includes('.providerProof.failClosedDiscardsPartial == true') ||
  !documentAstVisualFusionWorkflow.includes('.capabilityStatus.includeVisualEnrichments == "PARTIAL"') ||
  !documentAstVisualFusionWorkflow.includes('.capabilityStatus.includeDocumentAst == "PARTIAL"') ||
  !documentAstVisualFusionWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !documentAstVisualFusionWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push('document-ast-visual-fusion workflow must bind mutation, provider, capability, and product-truth proof');
}

const readOcrCaseCount = readOcrCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-read-ocr-differential')) {
  failures.push('rust parity workflow must execute the frozen read-ocr differential');
}
if (
  !repositoryDifferential.includes('scripts/differential/check-v3014-read-ocr-differential.ts') ||
  !repositoryDifferential.includes('scripts/differential/capture-v3014-read-ocr-oracle.ts') ||
  !repositoryDifferential.includes('v3014ReadOcrCaseCount') ||
  !repositoryDifferential.includes('v3014ReadOcrCorpusHash') ||
  !repositoryDifferential.includes('v3014ReadOcrOracleHash')
) {
  failures.push('repository differential artifact must bind the read-ocr family');
}
if (
  !readOcrWorkflow.includes(`.caseCount == ${readOcrCaseCount}`) ||
  !readOcrWorkflow.includes(`.passed == ${readOcrCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${readOcrCaseCount}/${readOcrCaseCount} read-ocr corpus`
  );
}
if (
  readOcrCaseCount !== 6 ||
  readOcrCorpus.envelope.fixtureCount !== 1 ||
  readOcrCorpus.envelope.caseCount !== 6 ||
  readOcrCorpus.envelope.maxPagesPerCase !== 2 ||
  readOcrCorpus.envelope.maxOcrPagesPerCase !== 2 ||
  readOcrCorpus.nonclaims.tesseractTsv !== false ||
  readOcrCorpus.nonclaims.textOnlyProviderFallback !== false ||
  readOcrCorpus.nonclaims.selectableOcrTableContinuation !== false ||
  readOcrCorpus.nonclaims.urlSingleFetch !== false ||
  readOcrCorpus.nonclaims.firstFiveOfSixPageBoundary !== false ||
  readOcrCorpus.nonclaims.wholeProductParity !== false ||
  readOcrCorpus.nonclaims.dropInFor3014 !== false ||
  readOcrCorpus.nonclaims.publishFreeze !== true
) {
  failures.push('read-ocr corpus envelope and product-truth nonclaims must remain frozen');
}
if (
  !readOcrWorkflow.includes('.profile == "pdf_reader_v3014_read_ocr_result"') ||
  !readOcrWorkflow.includes('.mutationSensitive.leafMutationCount == 143') ||
  !readOcrWorkflow.includes('.portabilityProof.relocatedFixtureRootReplay == true') ||
  !readOcrWorkflow.includes('.providerProof.configuredCommandOnly == true') ||
  !readOcrWorkflow.includes('.providerProof.optOutOmitsLayer == true') ||
  !readOcrWorkflow.includes('.providerProof.failSoftOmitsLayer == true') ||
  !readOcrWorkflow.includes('.providerProof.notConfiguredSoftOmitsLayer == true') ||
  !readOcrWorkflow.includes('.capabilityStatus.includeOcrTextLayer == "PARTIAL"') ||
  !readOcrWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !readOcrWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push('read-ocr workflow must bind mutation, provider, capability, and product-truth proof');
}
for (const required of [
  'scripts/differential/check-v3014-read-ocr-differential.ts',
  'scripts/differential/capture-v3014-read-ocr-oracle.ts',
  'v3014-read-ocr-baseline-runner.ts',
  'v3014-read-ocr-projection.ts',
  'v3014-read-ocr-corpus.json',
  'v3014-read-ocr-oracle.json',
  'v3014ReadOcrCaseCount',
  'v3014ReadOcrCorpusHash',
  'v3014ReadOcrOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(`repository differential artifact must bind read-ocr family member: ${required}`);
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) => claim.includes('exact 6-case') && claim.includes('include_ocr_text_layer')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('read_pdf include_ocr_text_layer outside the frozen 6-case')
  )
) {
  failures.push('read-ocr bounded claim and explicit nonclaims must remain documented');
}

const readOcrResidualCaseCount = readOcrResidualCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-read-ocr-residual-differential')) {
  failures.push('rust parity workflow must execute the frozen read-ocr residual differential');
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-read-ocr-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-read-ocr-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014ReadOcrResidualCaseCount') ||
  !repositoryDifferential.includes('v3014ReadOcrResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014ReadOcrResidualOracleHash')
) {
  failures.push('repository differential artifact must bind the read-ocr residual family');
}
if (
  !readOcrResidualWorkflow.includes(`.caseCount == ${readOcrResidualCaseCount}`) ||
  !readOcrResidualWorkflow.includes(`.passed == ${readOcrResidualCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${readOcrResidualCaseCount}/${readOcrResidualCaseCount} read-ocr residual corpus`
  );
}
if (
  readOcrResidualCaseCount !== 3 ||
  readOcrResidualCorpus.envelope.fixtureCount !== 2 ||
  readOcrResidualCorpus.envelope.caseCount !== 3 ||
  readOcrResidualCorpus.envelope.maxPagesPerCase !== 6 ||
  readOcrResidualCorpus.envelope.maxOcrPagesPerCase !== 5 ||
  readOcrResidualCorpus.nonclaims.tesseractTsv !== false ||
  readOcrResidualCorpus.nonclaims.selectableOcrTableContinuation !== false ||
  readOcrResidualCorpus.nonclaims.urlSingleFetch !== false ||
  readOcrResidualCorpus.nonclaims.mixedSelectableOcrInterleaving !== false ||
  readOcrResidualCorpus.nonclaims.wholeProductParity !== false ||
  readOcrResidualCorpus.nonclaims.dropInFor3014 !== false ||
  readOcrResidualCorpus.nonclaims.publishFreeze !== true
) {
  failures.push('read-ocr residual corpus envelope and product-truth nonclaims must remain frozen');
}
if (
  !readOcrResidualWorkflow.includes('.profile == "pdf_reader_v3014_read_ocr_residual_result"') ||
  !readOcrResidualWorkflow.includes('.mutationSensitive.leafMutationCount == 154') ||
  !readOcrResidualWorkflow.includes('.portabilityProof.relocatedFixtureRootReplay == true') ||
  !readOcrResidualWorkflow.includes('.providerProof.configuredCommandOnly == true') ||
  !readOcrResidualWorkflow.includes('.providerProof.plainTextStdoutOmitsWords == true') ||
  !readOcrResidualWorkflow.includes('.providerProof.jsonTextOnlyOmitsWords == true') ||
  !readOcrResidualWorkflow.includes('.providerProof.firstFiveOfSixTruncates == true') ||
  !readOcrResidualWorkflow.includes('.capabilityStatus.includeOcrTextLayer == "PARTIAL"') ||
  !readOcrResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !readOcrResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'read-ocr residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-read-ocr-residual-differential.ts',
  'scripts/differential/capture-v3014-read-ocr-residual-oracle.ts',
  'v3014-read-ocr-residual-baseline-runner.ts',
  'v3014-read-ocr-residual-projection.ts',
  'reference-ocr-residual-provider.ts',
  'v3014-read-ocr-residual-corpus.json',
  'v3014-read-ocr-residual-oracle.json',
  'v3014ReadOcrResidualCaseCount',
  'v3014ReadOcrResidualCorpusHash',
  'v3014ReadOcrResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind read-ocr residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') &&
      claim.includes('plain-text provider stdout fallback') &&
      claim.includes('first-five-of-six')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('read_pdf OCR residual outside the frozen 3-case')
  )
) {
  failures.push('read-ocr residual bounded claim and explicit nonclaims must remain documented');
}

const ocrTsvCaseCount = ocrTsvCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-ocr-tsv-differential')) {
  failures.push('rust parity workflow must execute the frozen ocr-tsv differential');
}
if (
  !repositoryDifferential.includes('scripts/differential/check-v3014-ocr-tsv-differential.ts') ||
  !repositoryDifferential.includes('scripts/differential/capture-v3014-ocr-tsv-oracle.ts') ||
  !repositoryDifferential.includes('v3014OcrTsvCaseCount') ||
  !repositoryDifferential.includes('v3014OcrTsvCorpusHash') ||
  !repositoryDifferential.includes('v3014OcrTsvOracleHash')
) {
  failures.push('repository differential artifact must bind the ocr-tsv family');
}
if (
  !ocrTsvWorkflow.includes(`.caseCount == ${ocrTsvCaseCount}`) ||
  !ocrTsvWorkflow.includes(`.passed == ${ocrTsvCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${ocrTsvCaseCount}/${ocrTsvCaseCount} ocr-tsv corpus`
  );
}
if (
  ocrTsvCaseCount !== 2 ||
  ocrTsvCorpus.envelope.fixtureCount !== 1 ||
  ocrTsvCorpus.envelope.caseCount !== 2 ||
  ocrTsvCorpus.nonclaims.dropInFor3014 !== false ||
  ocrTsvCorpus.nonclaims.publishFreeze !== true
) {
  failures.push('ocr-tsv corpus envelope and product-truth nonclaims must remain frozen');
}
if (
  !ocrTsvWorkflow.includes('.profile == "pdf_reader_v3014_ocr_tsv_result"') ||
  !ocrTsvWorkflow.includes('.mutationSensitive.leafMutationCount == 66') ||
  !ocrTsvWorkflow.includes('.providerProof.tesseractTsvPreset == true') ||
  !ocrTsvWorkflow.includes('.providerProof.validTsvIncludesWords == true') ||
  !ocrTsvWorkflow.includes('.providerProof.malformedTsvSoftRaw == true') ||
  !ocrTsvWorkflow.includes('.capabilityStatus.includeOcrTextLayer == "PARTIAL"') ||
  !ocrTsvWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !ocrTsvWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push('ocr-tsv workflow must bind mutation, provider, capability, and product-truth proof');
}
for (const required of [
  'scripts/differential/check-v3014-ocr-tsv-differential.ts',
  'scripts/differential/capture-v3014-ocr-tsv-oracle.ts',
  'v3014-ocr-tsv-baseline-runner.ts',
  'v3014-ocr-tsv-projection.ts',
  'reference-ocr-tsv-provider.ts',
  'v3014-ocr-tsv-corpus.json',
  'v3014-ocr-tsv-oracle.json',
  'v3014OcrTsvCaseCount',
  'v3014OcrTsvCorpusHash',
  'v3014OcrTsvOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(`repository differential artifact must bind ocr-tsv family member: ${required}`);
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) => claim.includes('exact 2-case') && claim.includes('tesseract-tsv')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('tesseract-tsv outside the frozen 2-case')
  )
) {
  failures.push('ocr-tsv bounded claim and explicit nonclaims must remain documented');
}

const ocrTableMergeCaseCount = ocrTableMergeCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-ocr-table-merge-differential')) {
  failures.push('rust parity workflow must execute the frozen ocr-table-merge differential');
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-ocr-table-merge-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-ocr-table-merge-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014OcrTableMergeCaseCount') ||
  !repositoryDifferential.includes('v3014OcrTableMergeCorpusHash') ||
  !repositoryDifferential.includes('v3014OcrTableMergeOracleHash')
) {
  failures.push('repository differential artifact must bind the ocr-table-merge family');
}
if (
  !ocrTableMergeWorkflow.includes(`.caseCount == ${ocrTableMergeCaseCount}`) ||
  !ocrTableMergeWorkflow.includes(`.passed == ${ocrTableMergeCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${ocrTableMergeCaseCount}/${ocrTableMergeCaseCount} ocr-table-merge corpus`
  );
}
if (
  ocrTableMergeCaseCount !== 3 ||
  ocrTableMergeCorpus.envelope.fixtureCount !== 2 ||
  ocrTableMergeCorpus.nonclaims.dropInFor3014 !== false ||
  ocrTableMergeCorpus.nonclaims.publishFreeze !== true
) {
  failures.push('ocr-table-merge corpus envelope and product-truth nonclaims must remain frozen');
}
if (
  !ocrTableMergeWorkflow.includes('.profile == "pdf_reader_v3014_ocr_table_merge_result"') ||
  !ocrTableMergeWorkflow.includes('.mutationSensitive.leafMutationCount == 76') ||
  !ocrTableMergeWorkflow.includes('.providerProof.distinctMergeKeepsBoth == true') ||
  !ocrTableMergeWorkflow.includes('.providerProof.overlapSuppressesOcrDuplicate == true') ||
  !ocrTableMergeWorkflow.includes('.providerProof.ocrOnlyPageAdmitted == true') ||
  !ocrTableMergeWorkflow.includes('.capabilityStatus.includeTables == "PARTIAL"') ||
  !ocrTableMergeWorkflow.includes('.capabilityStatus.includeOcrTextLayer == "PARTIAL"') ||
  !ocrTableMergeWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !ocrTableMergeWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'ocr-table-merge workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-ocr-table-merge-differential.ts',
  'scripts/differential/capture-v3014-ocr-table-merge-oracle.ts',
  'v3014-ocr-table-merge-baseline-runner.ts',
  'v3014-ocr-table-merge-projection.ts',
  'reference-ocr-table-merge-provider.ts',
  'v3014-ocr-table-merge-corpus.json',
  'v3014-ocr-table-merge-oracle.json',
  'v3014OcrTableMergeCaseCount',
  'v3014OcrTableMergeCorpusHash',
  'v3014OcrTableMergeOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind ocr-table-merge family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) => claim.includes('exact 3-case') && claim.includes('selectable/OCR table merge')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('selectable/OCR table merge outside the frozen 3-case')
  )
) {
  failures.push('ocr-table-merge bounded claim and explicit nonclaims must remain documented');
}

const ocrSearchResidualCaseCount = ocrSearchResidualCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-ocr-search-residual-differential')) {
  failures.push('rust parity workflow must execute the frozen ocr-search residual differential');
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-ocr-search-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-ocr-search-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014OcrSearchResidualCaseCount') ||
  !repositoryDifferential.includes('v3014OcrSearchResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014OcrSearchResidualOracleHash')
) {
  failures.push('repository differential artifact must bind the ocr-search residual family');
}
if (
  !ocrSearchResidualWorkflow.includes(`.caseCount == ${ocrSearchResidualCaseCount}`) ||
  !ocrSearchResidualWorkflow.includes(`.passed == ${ocrSearchResidualCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${ocrSearchResidualCaseCount}/${ocrSearchResidualCaseCount} ocr-search residual corpus`
  );
}
if (
  ocrSearchResidualCaseCount !== 4 ||
  ocrSearchResidualCorpus.envelope.fixtureCount !== 2 ||
  ocrSearchResidualCorpus.envelope.caseCount !== 4 ||
  ocrSearchResidualCorpus.nonclaims.dropInFor3014 !== false ||
  ocrSearchResidualCorpus.nonclaims.publishFreeze !== true
) {
  failures.push('ocr-search residual corpus envelope and product-truth nonclaims must remain frozen');
}
if (
  !ocrSearchResidualWorkflow.includes('.profile == "pdf_reader_v3014_ocr_search_residual_result"') ||
  !ocrSearchResidualWorkflow.includes('.mutationSensitive.leafMutationCount == 133') ||
  !ocrSearchResidualWorkflow.includes('.providerProof.textOnlyPlainOmitsGeometry == true') ||
  !ocrSearchResidualWorkflow.includes('.providerProof.textOnlyJsonOmitsGeometry == true') ||
  !ocrSearchResidualWorkflow.includes('.providerProof.wordsControlIncludesGeometry == true') ||
  !ocrSearchResidualWorkflow.includes('.providerProof.firstFiveOfSixTruncates == true') ||
  !ocrSearchResidualWorkflow.includes('.capabilityStatus.includeOcrTextLayer == "PARTIAL"') ||
  !ocrSearchResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !ocrSearchResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'ocr-search residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-ocr-search-residual-differential.ts',
  'scripts/differential/capture-v3014-ocr-search-residual-oracle.ts',
  'v3014-ocr-search-residual-baseline-runner.ts',
  'v3014-ocr-search-residual-projection.ts',
  'reference-ocr-search-residual-provider.ts',
  'v3014-ocr-search-residual-corpus.json',
  'v3014-ocr-search-residual-oracle.json',
  'v3014OcrSearchResidualCaseCount',
  'v3014OcrSearchResidualCorpusHash',
  'v3014OcrSearchResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind ocr-search residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 4-case') &&
      claim.includes('OCR-search residual') &&
      claim.includes('text-only')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('OCR-search residual outside the frozen 4-case')
  )
) {
  failures.push('ocr-search residual bounded claim and explicit nonclaims must remain documented');
}

const ocrSearchInterleaveCaseCount = ocrSearchInterleaveCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-ocr-search-interleave-differential')) {
  failures.push('rust parity workflow must execute the frozen ocr-search interleave differential');
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-ocr-search-interleave-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-ocr-search-interleave-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014OcrSearchInterleaveCaseCount') ||
  !repositoryDifferential.includes('v3014OcrSearchInterleaveCorpusHash') ||
  !repositoryDifferential.includes('v3014OcrSearchInterleaveOracleHash')
) {
  failures.push('repository differential artifact must bind the ocr-search interleave family');
}
if (
  !ocrSearchInterleaveWorkflow.includes(`.caseCount == ${ocrSearchInterleaveCaseCount}`) ||
  !ocrSearchInterleaveWorkflow.includes(`.passed == ${ocrSearchInterleaveCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${ocrSearchInterleaveCaseCount}/${ocrSearchInterleaveCaseCount} ocr-search interleave corpus`
  );
}
if (
  ocrSearchInterleaveCaseCount !== 4 ||
  ocrSearchInterleaveCorpus.envelope.fixtureCount !== 1 ||
  ocrSearchInterleaveCorpus.nonclaims.dropInFor3014 !== false ||
  ocrSearchInterleaveCorpus.nonclaims.publishFreeze !== true
) {
  failures.push(
    'ocr-search interleave corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !ocrSearchInterleaveWorkflow.includes(
    '.profile == "pdf_reader_v3014_ocr_search_interleave_result"'
  ) ||
  !ocrSearchInterleaveWorkflow.includes('.mutationSensitive.leafMutationCount == 149') ||
  !ocrSearchInterleaveWorkflow.includes('.providerProof.selectableThenOcrOrder == true') ||
  !ocrSearchInterleaveWorkflow.includes('.providerProof.exactCapAdmitsOneOcr == true') ||
  !ocrSearchInterleaveWorkflow.includes(
    '.providerProof.capFullSkipsOcrWithoutTruncation == true'
  ) ||
  !ocrSearchInterleaveWorkflow.includes('.providerProof.uniqueOcrTokenAppended == true') ||
  !ocrSearchInterleaveWorkflow.includes('.capabilityStatus.includeOcrTextLayer == "PARTIAL"') ||
  !ocrSearchInterleaveWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !ocrSearchInterleaveWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'ocr-search interleave workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-ocr-search-interleave-differential.ts',
  'scripts/differential/capture-v3014-ocr-search-interleave-oracle.ts',
  'v3014-ocr-search-interleave-baseline-runner.ts',
  'v3014-ocr-search-interleave-projection.ts',
  'reference-ocr-search-interleave-provider.ts',
  'v3014-ocr-search-interleave-corpus.json',
  'v3014-ocr-search-interleave-oracle.json',
  'v3014OcrSearchInterleaveCaseCount',
  'v3014OcrSearchInterleaveCorpusHash',
  'v3014OcrSearchInterleaveOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind ocr-search interleave family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) => claim.includes('exact 4-case') && claim.includes('selectable/OCR interleav')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('selectable/OCR search interleaving outside the frozen 4-case')
  )
) {
  failures.push('ocr-search interleave bounded claim and explicit nonclaims must remain documented');
}

const urlSingleFetchCaseCount = urlSingleFetchCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-url-single-fetch-differential')) {
  failures.push('rust parity workflow must execute the frozen url single-fetch differential');
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-url-single-fetch-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-url-single-fetch-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014UrlSingleFetchCaseCount') ||
  !repositoryDifferential.includes('v3014UrlSingleFetchCorpusHash') ||
  !repositoryDifferential.includes('v3014UrlSingleFetchOracleHash')
) {
  failures.push('repository differential artifact must bind the url single-fetch family');
}
if (
  !urlSingleFetchWorkflow.includes(`.caseCount == ${urlSingleFetchCaseCount}`) ||
  !urlSingleFetchWorkflow.includes(`.passed == ${urlSingleFetchCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${urlSingleFetchCaseCount}/${urlSingleFetchCaseCount} url single-fetch corpus`
  );
}
if (
  urlSingleFetchCaseCount !== 2 ||
  urlSingleFetchCorpus.envelope.fixtureCount !== 1 ||
  urlSingleFetchCorpus.envelope.maxFetchesPerCase !== 1 ||
  urlSingleFetchCorpus.nonclaims.dropInFor3014 !== false ||
  urlSingleFetchCorpus.nonclaims.publishFreeze !== true ||
  urlSingleFetchCorpus.nonclaims.searchPdfUrlOcrSingleFetch !== false ||
  urlSingleFetchCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'url single-fetch corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !urlSingleFetchWorkflow.includes(
    '.profile == "pdf_reader_v3014_url_single_fetch_result"'
  ) ||
  !urlSingleFetchWorkflow.includes('.mutationSensitive.leafMutationCount == 16') ||
  !urlSingleFetchWorkflow.includes('.providerProof.allowPrivateIpsRequired == true') ||
  !urlSingleFetchWorkflow.includes('.providerProof.readPdfNoOcrSingleFetch == true') ||
  !urlSingleFetchWorkflow.includes('.providerProof.readPdfWithOcrSingleFetch == true') ||
  !urlSingleFetchWorkflow.includes('.capabilityStatus.urlSsrf == "PARTIAL"') ||
  !urlSingleFetchWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !urlSingleFetchWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'url single-fetch workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-url-single-fetch-differential.ts',
  'scripts/differential/capture-v3014-url-single-fetch-oracle.ts',
  'v3014-url-single-fetch-baseline-runner.ts',
  'v3014-url-single-fetch-projection.ts',
  'url-single-fetch-fixture-server.ts',
  'v3014-url-single-fetch-corpus.json',
  'v3014-url-single-fetch-oracle.json',
  'v3014UrlSingleFetchCaseCount',
  'v3014UrlSingleFetchCorpusHash',
  'v3014UrlSingleFetchOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind url single-fetch family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) => claim.includes('exact 2-case') && claim.includes('URL source single-fetch')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('URL single-fetch outside the frozen 2-case')
  )
) {
  failures.push('url single-fetch bounded claim and explicit nonclaims must remain documented');
}

const ocrSearchTsvCaseCount = ocrSearchTsvCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-ocr-search-tsv-differential')) {
  failures.push('rust parity workflow must execute the frozen ocr-search tsv differential');
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-ocr-search-tsv-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-ocr-search-tsv-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014OcrSearchTsvCaseCount') ||
  !repositoryDifferential.includes('v3014OcrSearchTsvCorpusHash') ||
  !repositoryDifferential.includes('v3014OcrSearchTsvOracleHash')
) {
  failures.push('repository differential artifact must bind the ocr-search tsv family');
}
if (
  !ocrSearchTsvWorkflow.includes(`.caseCount == ${ocrSearchTsvCaseCount}`) ||
  !ocrSearchTsvWorkflow.includes(`.passed == ${ocrSearchTsvCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${ocrSearchTsvCaseCount}/${ocrSearchTsvCaseCount} ocr-search tsv corpus`
  );
}
if (
  ocrSearchTsvCaseCount !== 2 ||
  ocrSearchTsvCorpus.envelope.fixtureCount !== 1 ||
  ocrSearchTsvCorpus.nonclaims.dropInFor3014 !== false ||
  ocrSearchTsvCorpus.nonclaims.publishFreeze !== true ||
  ocrSearchTsvCorpus.nonclaims.realTesseractBinary !== false ||
  ocrSearchTsvCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'ocr-search tsv corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !ocrSearchTsvWorkflow.includes(
    '.profile == "pdf_reader_v3014_ocr_search_tsv_result"'
  ) ||
  !ocrSearchTsvWorkflow.includes('.mutationSensitive.leafMutationCount == 34') ||
  !ocrSearchTsvWorkflow.includes('.providerProof.tesseractTsvPreset == true') ||
  !ocrSearchTsvWorkflow.includes('.providerProof.validTsvWordGeometry == true') ||
  !ocrSearchTsvWorkflow.includes('.providerProof.malformedTsvSoftFallback == true') ||
  !ocrSearchTsvWorkflow.includes('.capabilityStatus.includeOcrTextLayer == "PARTIAL"') ||
  !ocrSearchTsvWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !ocrSearchTsvWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'ocr-search tsv workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-ocr-search-tsv-differential.ts',
  'scripts/differential/capture-v3014-ocr-search-tsv-oracle.ts',
  'v3014-ocr-search-tsv-baseline-runner.ts',
  'v3014-ocr-search-tsv-projection.ts',
  'reference-ocr-search-tsv-provider.ts',
  'v3014-ocr-search-tsv-corpus.json',
  'v3014-ocr-search-tsv-oracle.json',
  'v3014OcrSearchTsvCaseCount',
  'v3014OcrSearchTsvCorpusHash',
  'v3014OcrSearchTsvOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind ocr-search tsv family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) => claim.includes('exact 2-case') && claim.includes('search_pdf tesseract-tsv')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('search_pdf tesseract-tsv outside the frozen 2-case')
  )
) {
  failures.push('ocr-search tsv bounded claim and explicit nonclaims must remain documented');
}

const searchMultiwordGeometryCaseCount = searchMultiwordGeometryCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-search-multiword-geometry-differential')) {
  failures.push(
    'rust parity workflow must execute the frozen search multiword geometry differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-search-multiword-geometry-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-search-multiword-geometry-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014SearchMultiwordGeometryCaseCount') ||
  !repositoryDifferential.includes('v3014SearchMultiwordGeometryCorpusHash') ||
  !repositoryDifferential.includes('v3014SearchMultiwordGeometryOracleHash')
) {
  failures.push('repository differential artifact must bind the search multiword geometry family');
}
if (
  !searchMultiwordGeometryWorkflow.includes(
    `.caseCount == ${searchMultiwordGeometryCaseCount}`
  ) ||
  !searchMultiwordGeometryWorkflow.includes(
    `.passed == ${searchMultiwordGeometryCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${searchMultiwordGeometryCaseCount}/${searchMultiwordGeometryCaseCount} search multiword geometry corpus`
  );
}
if (
  searchMultiwordGeometryCaseCount !== 3 ||
  searchMultiwordGeometryCorpus.envelope.fixtureCount !== 1 ||
  searchMultiwordGeometryCorpus.nonclaims.dropInFor3014 !== false ||
  searchMultiwordGeometryCorpus.nonclaims.publishFreeze !== true ||
  searchMultiwordGeometryCorpus.nonclaims.glyphPerfectBoxes !== false ||
  searchMultiwordGeometryCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'search multiword geometry corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !searchMultiwordGeometryWorkflow.includes(
    '.profile == "pdf_reader_v3014_search_multiword_geometry_result"'
  ) ||
  !searchMultiwordGeometryWorkflow.includes('.mutationSensitive.leafMutationCount == 48') ||
  !searchMultiwordGeometryWorkflow.includes(
    '.providerProof.multiwordStartItemUnion == true'
  ) ||
  !searchMultiwordGeometryWorkflow.includes(
    '.providerProof.multiwordMidLineUnion == true'
  ) ||
  !searchMultiwordGeometryWorkflow.includes(
    '.providerProof.multiwordCaseInsensitiveUnion == true'
  ) ||
  !searchMultiwordGeometryWorkflow.includes(
    '.providerProof.charEstimatedLevel == true'
  ) ||
  !searchMultiwordGeometryWorkflow.includes(
    '.capabilityStatus.boundingBox == "PARTIAL"'
  ) ||
  !searchMultiwordGeometryWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !searchMultiwordGeometryWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'search multiword geometry workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-search-multiword-geometry-differential.ts',
  'scripts/differential/capture-v3014-search-multiword-geometry-oracle.ts',
  'v3014-search-multiword-geometry-baseline-runner.ts',
  'v3014-search-multiword-geometry-projection.ts',
  'v3014-search-multiword-geometry-corpus.json',
  'v3014-search-multiword-geometry-oracle.json',
  'v3014SearchMultiwordGeometryCaseCount',
  'v3014SearchMultiwordGeometryCorpusHash',
  'v3014SearchMultiwordGeometryOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind search multiword geometry family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') && claim.includes('multiword selectable-text geometry')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('multiword selectable geometry outside the frozen 3-case')
  )
) {
  failures.push(
    'search multiword geometry bounded claim and explicit nonclaims must remain documented'
  );
}

const formResidualCaseCount = formResidualCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-form-residual-differential')) {
  failures.push('rust parity workflow must execute the frozen form residual differential');
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-form-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-form-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014FormResidualCaseCount') ||
  !repositoryDifferential.includes('v3014FormResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014FormResidualOracleHash')
) {
  failures.push('repository differential artifact must bind the form residual family');
}
if (
  !formResidualWorkflow.includes(`.caseCount == ${formResidualCaseCount}`) ||
  !formResidualWorkflow.includes(`.passed == ${formResidualCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${formResidualCaseCount}/${formResidualCaseCount} form residual corpus`
  );
}
if (
  formResidualCaseCount !== 2 ||
  formResidualCorpus.envelope.fixtureCount !== 2 ||
  formResidualCorpus.nonclaims.dropInFor3014 !== false ||
  formResidualCorpus.nonclaims.publishFreeze !== true ||
  formResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push('form residual corpus envelope and product-truth nonclaims must remain frozen');
}
if (
  !formResidualWorkflow.includes('.profile == "pdf_reader_v3014_form_residual_result"') ||
  !formResidualWorkflow.includes('.mutationSensitive.leafMutationCount == 90') ||
  !formResidualWorkflow.includes(
    '.providerProof.radiobuttonPushbuttonSignatureKinds == true'
  ) ||
  !formResidualWorkflow.includes(
    '.providerProof.signatureOmitsBoxAndEditable == true'
  ) ||
  !formResidualWorkflow.includes('.providerProof.valueCoercionResidual == true') ||
  !formResidualWorkflow.includes(
    '.capabilityStatus.includeFormFields == "PARTIAL"'
  ) ||
  !formResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !formResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'form residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-form-residual-differential.ts',
  'scripts/differential/capture-v3014-form-residual-oracle.ts',
  'v3014-form-residual-baseline-runner.ts',
  'v3014-form-residual-projection.ts',
  'v3014-form-residual-corpus.json',
  'v3014-form-residual-oracle.json',
  'v3014-form-residual-v1.pdf',
  'v3014-form-coercion-v1.pdf',
  'v3014FormResidualCaseCount',
  'v3014FormResidualCorpusHash',
  'v3014FormResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind form residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) => claim.includes('exact 2-case') && claim.includes('include_form_fields residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('include_form_fields outside the frozen 2-case form residual')
  )
) {
  failures.push('form residual bounded claim and explicit nonclaims must remain documented');
}

const formRadioGroupCaseCount = formRadioGroupCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-form-radio-group-differential')) {
  failures.push('rust parity workflow must execute the frozen form radio-group differential');
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-form-radio-group-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-form-radio-group-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014FormRadioGroupCaseCount') ||
  !repositoryDifferential.includes('v3014FormRadioGroupCorpusHash') ||
  !repositoryDifferential.includes('v3014FormRadioGroupOracleHash')
) {
  failures.push('repository differential artifact must bind the form radio-group family');
}
if (
  !formRadioGroupWorkflow.includes(`.caseCount == ${formRadioGroupCaseCount}`) ||
  !formRadioGroupWorkflow.includes(`.passed == ${formRadioGroupCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${formRadioGroupCaseCount}/${formRadioGroupCaseCount} form radio-group corpus`
  );
}
if (
  formRadioGroupCaseCount !== 2 ||
  formRadioGroupCorpus.envelope.fixtureCount !== 2 ||
  formRadioGroupCorpus.nonclaims.dropInFor3014 !== false ||
  formRadioGroupCorpus.nonclaims.publishFreeze !== true ||
  formRadioGroupCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push('form radio-group corpus envelope and product-truth nonclaims must remain frozen');
}
if (
  !formRadioGroupWorkflow.includes('.profile == "pdf_reader_v3014_form_radio_group_result"') ||
  !formRadioGroupWorkflow.includes('.mutationSensitive.leafMutationCount == 78') ||
  !formRadioGroupWorkflow.includes('.providerProof.parentStubPlusRadiobuttonKids == true') ||
  !formRadioGroupWorkflow.includes('.providerProof.inheritedValueAndDefault == true') ||
  !formRadioGroupWorkflow.includes('.providerProof.threeOptionRadioGroup == true') ||
  !formRadioGroupWorkflow.includes('.capabilityStatus.includeFormFields == "PARTIAL"') ||
  !formRadioGroupWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !formRadioGroupWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'form radio-group workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-form-radio-group-differential.ts',
  'scripts/differential/capture-v3014-form-radio-group-oracle.ts',
  'v3014-form-radio-group-baseline-runner.ts',
  'v3014-form-radio-group-projection.ts',
  'v3014-form-radio-group-corpus.json',
  'v3014-form-radio-group-oracle.json',
  'v3014-form-radio-group-v1.pdf',
  'v3014-form-radio-group-three-v1.pdf',
  'v3014FormRadioGroupCaseCount',
  'v3014FormRadioGroupCorpusHash',
  'v3014FormRadioGroupOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind form radio-group family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) => claim.includes('exact 2-case') && claim.includes('radio-group residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('radio-group outside the frozen 2-case')
  )
) {
  failures.push('form radio-group bounded claim and explicit nonclaims must remain documented');
}

const ocrSearchCaseCount = ocrSearchCorpus.cases.length;
if (
  ocrSearchCaseCount !== 15 ||
  ocrSearchCorpus.envelope.caseCount !== 15 ||
  ocrSearchCorpus.envelope.fixtureCount !== 1 ||
  ocrSearchCorpus.envelope.maxPagesPerCase !== 10001 ||
  ocrSearchCorpus.nonclaims.dropInFor3014 !== false ||
  ocrSearchCorpus.nonclaims.publishFreeze !== true ||
  ocrSearchCorpus.nonclaims.pageNumbersBeyondU32 !== false ||
  ocrSearchCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push('OCR-search corpus envelope, nonclaims, and product truth must remain frozen');
}
if (
  !differentialWorkflow.includes('bun run test:v3014-ocr-search-differential') ||
  !differentialWorkflow.includes('.profile == "pdf_reader_v3014_ocr_search_result"') ||
  !differentialWorkflow.includes('.caseCount == 15 and .passed == 15 and .skipped == 0') ||
  !differentialWorkflow.includes('.mutationSensitive.leafMutationCount == 247') ||
  !differentialWorkflow.includes('.envelopeProof.allInvalidIsToolError == true') ||
  !differentialWorkflow.includes('.envelopeProof.protocolErrorRejected == true') ||
  !differentialWorkflow.includes('.portabilityProof.relocatedFixtureRootReplay == true') ||
  !differentialWorkflow.includes('.portabilityProof.windowsPathProjection == true') ||
  !differentialWorkflow.includes('.portabilityProof.normalizedFixtureToken == "<fixture>"') ||
  !differentialWorkflow.includes('.resourceProof.sourceCap32PreIoAnd33Rejected == true') ||
  !differentialWorkflow.includes('.resourceProof.invalidGlobalOptionsRejectedPreIo == true') ||
  !differentialWorkflow.includes('.resourceProof.invalidPageSpecSourceLocalPreIo == true') ||
  !differentialWorkflow.includes('.resourceProof.crossRuntimeHostileResourceParity == false') ||
  !differentialWorkflow.includes('.nonclaims.pageNumbersBeyondU32 == false') ||
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
  !matrix.claimedForDifferential.some((claim) => claim.includes('exact 15-case') && claim.includes('OCR-search')) ||
  !matrix.explicitlyNotClaimed.some((claim) => claim.includes('OCR search outside the frozen 15-case'))
) {
  failures.push('OCR-search bounded claim and explicit nonclaims must remain documented');
}


const nativeWorkflow = readFileSync(join(root, '.github/workflows/native-package-scaffold.yml'), 'utf8');
const platformMap = readFileSync(join(root, 'scripts/native/platform-package-map.ts'), 'utf8');
const packageDirs = [
  'packages/pdf-reader-mcp-darwin-arm64',
  'packages/pdf-reader-mcp-darwin-x64',
  'packages/pdf-reader-mcp-linux-arm64-gnu',
  'packages/pdf-reader-mcp-linux-x64-gnu',
  'packages/pdf-reader-mcp-win32-x64-msvc',
];
if (!nativeWorkflow.includes('pdf-reader-mcp-server-${{ matrix.platformId }}')) {
  failures.push('native package scaffold workflow must upload platform-scoped binary artifacts');
}
for (const platform of ['darwin-arm64', 'darwin-x64', 'linux-arm64-gnu', 'linux-x64-gnu', 'win32-x64-msvc']) {
  if (!platformMap.includes(`'${platform}'`) && !platformMap.includes(`"${platform}"`)) {
    failures.push(`native platform map must include ${platform}`);
  }
}
for (const dir of packageDirs) {
  const manifest = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8')) as {
    private?: boolean;
    scripts?: { prepublishOnly?: string };
  };
  if (manifest.private !== true) failures.push(`${dir} must remain private while publish freeze is enabled`);
  if (!manifest.scripts?.prepublishOnly?.includes('PUBLISH FREEZE')) {
    failures.push(`${dir} must fail closed on prepublish while freeze is enabled`);
  }
}
if (!matrix.claimedForDifferential.some((entry: string) => entry.includes('five-platform npm native package scaffold'))) {
  failures.push('capability matrix must claim the five-platform native package scaffold honestly');
}
if (!existsSync(join(root, 'scripts/smoke-native-launcher.ts'))) {
  failures.push('native launcher smoke script must exist');
}
if (!readFileSync(join(root, 'package.json'), 'utf8').includes('smoke:native-launcher')) {
  failures.push('package.json must wire smoke:native-launcher');
}


if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('[check-pure-rust-matrix] PASS honest matrix invariants');
