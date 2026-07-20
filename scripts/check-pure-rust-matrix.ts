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
const attachmentResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-attachment-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxAttachmentsPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const markinfoResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-markinfo-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const formParentChildCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-form-parent-child-corpus.json'),
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
const annotationResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-annotation-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxAnnotationsPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const annotationDestResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-annotation-dest-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxAnnotationsPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const annotationActionDestResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-annotation-action-dest-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxAnnotationsPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const annotationActionPrecedenceResidualCorpus = JSON.parse(
  readFileSync(
    join(
      root,
      'scripts/differential/fixtures/v3014-annotation-action-precedence-residual-corpus.json'
    ),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxAnnotationsPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const infoFlagsResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-info-flags-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const pageGeometryResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-page-geometry-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const pageLabelsResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-page-labels-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const outlineResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-outline-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxOutlineItemsPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const permissionsResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-permissions-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
    maxPermissionsPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const metadataPresenceResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-metadata-presence-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const infoExtrasResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-info-extras-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const encryptFilterResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-encrypt-filter-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const linearizedResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-linearized-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const formFlagsResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-form-flags-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const textAnnotationResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-text-annotation-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const remoteActionResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-remote-action-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const popupAnnotationResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-popup-annotation-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const popupZeroSizeResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-popup-zero-size-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const popupGroupIrtResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-popup-group-irt-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const textAppearanceResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-text-appearance-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const textNamedAppearanceResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-text-named-appearance-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const textInvertedRectResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-text-inverted-rect-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const remoteNamedDestResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-remote-named-dest-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const pageLabelsKidsResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-page-labels-kids-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const formButtonArrayResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-form-button-array-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const attachmentOddNamesResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-attachment-odd-names-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const formUtf16TextResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-form-utf16-text-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const utf16TextResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-utf16-text-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const textInvalidAsResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-text-invalid-as-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const lineAnnotationResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-line-annotation-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const polylinePolygonResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-polyline-polygon-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const inkAnnotationResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-ink-annotation-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const borderWidthClampResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-border-width-clamp-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const borderArrayWidthResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-border-array-width-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const borderBsPreferenceResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-border-bs-preference-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const borderBsNondictResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-border-bs-nondict-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const borderArrayShortResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-border-array-short-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const borderBsWrongTypeResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-border-bs-wrong-type-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const borderZeroSizeClampBypassResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-border-zero-size-clamp-bypass-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const annotationAppearanceBboxResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-annotation-appearance-bbox-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
  };
  nonclaims: Record<string, boolean>;
};
const annotationApNonstreamResidualCorpus = JSON.parse(
  readFileSync(
    join(root, 'scripts/differential/fixtures/v3014-annotation-ap-nonstream-residual-corpus.json'),
    'utf8'
  )
) as {
  cases: Array<{ id: string }>;
  envelope: {
    fixtureCount: number;
    caseCount: number;
    maxPagesPerCase: number;
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
  'ATTACHMENT_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-attachment-residual-result.json"',
  formRadioGroupWorkflowStart
);
const formRadioGroupWorkflow =
  formRadioGroupWorkflowStart >= 0 &&
  formRadioGroupWorkflowEnd > formRadioGroupWorkflowStart
    ? differentialWorkflow.slice(formRadioGroupWorkflowStart, formRadioGroupWorkflowEnd)
    : '';
const attachmentResidualWorkflowStart = differentialWorkflow.indexOf(
  'ATTACHMENT_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-attachment-residual-result.json"'
);
const attachmentResidualWorkflowEnd = differentialWorkflow.indexOf(
  'MARKINFO_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-markinfo-residual-result.json"',
  attachmentResidualWorkflowStart
);
const attachmentResidualWorkflow =
  attachmentResidualWorkflowStart >= 0 &&
  attachmentResidualWorkflowEnd > attachmentResidualWorkflowStart
    ? differentialWorkflow.slice(
        attachmentResidualWorkflowStart,
        attachmentResidualWorkflowEnd
      )
    : '';
const markinfoResidualWorkflowStart = differentialWorkflow.indexOf(
  'MARKINFO_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-markinfo-residual-result.json"'
);
const markinfoResidualWorkflowEnd = differentialWorkflow.indexOf(
  'FORM_PARENT_CHILD_ARTIFACT="${SCRATCH_DIR}/v3014-form-parent-child-result.json"',
  markinfoResidualWorkflowStart
);
const markinfoResidualWorkflow =
  markinfoResidualWorkflowStart >= 0 &&
  markinfoResidualWorkflowEnd > markinfoResidualWorkflowStart
    ? differentialWorkflow.slice(markinfoResidualWorkflowStart, markinfoResidualWorkflowEnd)
    : '';
const formParentChildWorkflowStart = differentialWorkflow.indexOf(
  'FORM_PARENT_CHILD_ARTIFACT="${SCRATCH_DIR}/v3014-form-parent-child-result.json"'
);
const formParentChildWorkflowEnd = differentialWorkflow.indexOf(
  'ANNOTATION_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-annotation-residual-result.json"',
  formParentChildWorkflowStart
);
const formParentChildWorkflow =
  formParentChildWorkflowStart >= 0 &&
  formParentChildWorkflowEnd > formParentChildWorkflowStart
    ? differentialWorkflow.slice(formParentChildWorkflowStart, formParentChildWorkflowEnd)
    : '';
const annotationResidualWorkflowStart = differentialWorkflow.indexOf(
  'ANNOTATION_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-annotation-residual-result.json"'
);
const annotationResidualWorkflowEnd = differentialWorkflow.indexOf(
  'ANNOTATION_DEST_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-annotation-dest-residual-result.json"',
  annotationResidualWorkflowStart
);
const annotationResidualWorkflow =
  annotationResidualWorkflowStart >= 0 &&
  annotationResidualWorkflowEnd > annotationResidualWorkflowStart
    ? differentialWorkflow.slice(annotationResidualWorkflowStart, annotationResidualWorkflowEnd)
    : '';
const annotationDestResidualWorkflowStart = differentialWorkflow.indexOf(
  'ANNOTATION_DEST_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-annotation-dest-residual-result.json"'
);
const annotationDestResidualWorkflowEnd = differentialWorkflow.indexOf(
  'ANNOTATION_ACTION_DEST_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-annotation-action-dest-residual-result.json"',
  annotationDestResidualWorkflowStart
);
const annotationDestResidualWorkflow =
  annotationDestResidualWorkflowStart >= 0 &&
  annotationDestResidualWorkflowEnd > annotationDestResidualWorkflowStart
    ? differentialWorkflow.slice(
        annotationDestResidualWorkflowStart,
        annotationDestResidualWorkflowEnd
      )
    : '';
const annotationActionDestResidualWorkflowStart = differentialWorkflow.indexOf(
  'ANNOTATION_ACTION_DEST_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-annotation-action-dest-residual-result.json"'
);
const annotationActionDestResidualWorkflowEnd = differentialWorkflow.indexOf(
  'ANNOTATION_ACTION_PRECEDENCE_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-annotation-action-precedence-residual-result.json"',
  annotationActionDestResidualWorkflowStart
);
const annotationActionDestResidualWorkflow =
  annotationActionDestResidualWorkflowStart >= 0 &&
  annotationActionDestResidualWorkflowEnd > annotationActionDestResidualWorkflowStart
    ? differentialWorkflow.slice(
        annotationActionDestResidualWorkflowStart,
        annotationActionDestResidualWorkflowEnd
      )
    : '';
const annotationActionPrecedenceResidualWorkflowStart = differentialWorkflow.indexOf(
  'ANNOTATION_ACTION_PRECEDENCE_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-annotation-action-precedence-residual-result.json"'
);
const annotationActionPrecedenceResidualWorkflowEnd = differentialWorkflow.indexOf(
  'INFO_FLAGS_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-info-flags-residual-result.json"',
  annotationActionPrecedenceResidualWorkflowStart
);
const annotationActionPrecedenceResidualWorkflow =
  annotationActionPrecedenceResidualWorkflowStart >= 0 &&
  annotationActionPrecedenceResidualWorkflowEnd > annotationActionPrecedenceResidualWorkflowStart
    ? differentialWorkflow.slice(
        annotationActionPrecedenceResidualWorkflowStart,
        annotationActionPrecedenceResidualWorkflowEnd
      )
    : '';
const infoFlagsResidualWorkflowStart = differentialWorkflow.indexOf(
  'INFO_FLAGS_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-info-flags-residual-result.json"'
);
const infoFlagsResidualWorkflowEnd = differentialWorkflow.indexOf(
  'PAGE_GEOMETRY_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-page-geometry-residual-result.json"',
  infoFlagsResidualWorkflowStart
);
const infoFlagsResidualWorkflow =
  infoFlagsResidualWorkflowStart >= 0 &&
  infoFlagsResidualWorkflowEnd > infoFlagsResidualWorkflowStart
    ? differentialWorkflow.slice(infoFlagsResidualWorkflowStart, infoFlagsResidualWorkflowEnd)
    : '';
const pageGeometryResidualWorkflowStart = differentialWorkflow.indexOf(
  'PAGE_GEOMETRY_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-page-geometry-residual-result.json"'
);
const pageGeometryResidualWorkflowEnd = differentialWorkflow.indexOf(
  'PAGE_LABELS_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-page-labels-residual-result.json"',
  pageGeometryResidualWorkflowStart
);
const pageGeometryResidualWorkflow =
  pageGeometryResidualWorkflowStart >= 0 &&
  pageGeometryResidualWorkflowEnd > pageGeometryResidualWorkflowStart
    ? differentialWorkflow.slice(
        pageGeometryResidualWorkflowStart,
        pageGeometryResidualWorkflowEnd
      )
    : '';
const pageLabelsResidualWorkflowStart = differentialWorkflow.indexOf(
  'PAGE_LABELS_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-page-labels-residual-result.json"'
);
const pageLabelsResidualWorkflowEnd = differentialWorkflow.indexOf(
  'OUTLINE_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-outline-residual-result.json"',
  pageLabelsResidualWorkflowStart
);
const pageLabelsResidualWorkflow =
  pageLabelsResidualWorkflowStart >= 0 &&
  pageLabelsResidualWorkflowEnd > pageLabelsResidualWorkflowStart
    ? differentialWorkflow.slice(pageLabelsResidualWorkflowStart, pageLabelsResidualWorkflowEnd)
    : '';
const outlineResidualWorkflowStart = differentialWorkflow.indexOf(
  'OUTLINE_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-outline-residual-result.json"'
);
const outlineResidualWorkflowEnd = differentialWorkflow.indexOf(
  'PERMISSIONS_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-permissions-residual-result.json"',
  outlineResidualWorkflowStart
);
const outlineResidualWorkflow =
  outlineResidualWorkflowStart >= 0 &&
  outlineResidualWorkflowEnd > outlineResidualWorkflowStart
    ? differentialWorkflow.slice(outlineResidualWorkflowStart, outlineResidualWorkflowEnd)
    : '';
const permissionsResidualWorkflowStart = differentialWorkflow.indexOf(
  'PERMISSIONS_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-permissions-residual-result.json"'
);
const permissionsResidualWorkflowEnd = differentialWorkflow.indexOf(
  'METADATA_PRESENCE_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-metadata-presence-residual-result.json"',
  permissionsResidualWorkflowStart
);
const permissionsResidualWorkflow =
  permissionsResidualWorkflowStart >= 0 &&
  permissionsResidualWorkflowEnd > permissionsResidualWorkflowStart
    ? differentialWorkflow.slice(
        permissionsResidualWorkflowStart,
        permissionsResidualWorkflowEnd
      )
    : '';
const metadataPresenceResidualWorkflowStart = differentialWorkflow.indexOf(
  'METADATA_PRESENCE_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-metadata-presence-residual-result.json"'
);
const metadataPresenceResidualWorkflowEnd = differentialWorkflow.indexOf(
  'INFO_EXTRAS_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-info-extras-residual-result.json"',
  metadataPresenceResidualWorkflowStart
);
const metadataPresenceResidualWorkflow =
  metadataPresenceResidualWorkflowStart >= 0 &&
  metadataPresenceResidualWorkflowEnd > metadataPresenceResidualWorkflowStart
    ? differentialWorkflow.slice(
        metadataPresenceResidualWorkflowStart,
        metadataPresenceResidualWorkflowEnd
      )
    : '';
const infoExtrasResidualWorkflowStart = differentialWorkflow.indexOf(
  'INFO_EXTRAS_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-info-extras-residual-result.json"'
);
const infoExtrasResidualWorkflowEnd = differentialWorkflow.indexOf(
  'ENCRYPT_FILTER_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-encrypt-filter-residual-result.json"',
  infoExtrasResidualWorkflowStart
);
const infoExtrasResidualWorkflow =
  infoExtrasResidualWorkflowStart >= 0 &&
  infoExtrasResidualWorkflowEnd > infoExtrasResidualWorkflowStart
    ? differentialWorkflow.slice(
        infoExtrasResidualWorkflowStart,
        infoExtrasResidualWorkflowEnd
      )
    : '';
const encryptFilterResidualWorkflowStart = differentialWorkflow.indexOf(
  'ENCRYPT_FILTER_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-encrypt-filter-residual-result.json"'
);
const encryptFilterResidualWorkflowEnd = differentialWorkflow.indexOf(
  'LINEARIZED_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-linearized-residual-result.json"',
  encryptFilterResidualWorkflowStart
);
const encryptFilterResidualWorkflow =
  encryptFilterResidualWorkflowStart >= 0 &&
  encryptFilterResidualWorkflowEnd > encryptFilterResidualWorkflowStart
    ? differentialWorkflow.slice(
        encryptFilterResidualWorkflowStart,
        encryptFilterResidualWorkflowEnd
      )
    : '';
const linearizedResidualWorkflowStart = differentialWorkflow.indexOf(
  'LINEARIZED_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-linearized-residual-result.json"'
);
const linearizedResidualWorkflowEnd = differentialWorkflow.indexOf(
  'FORM_FLAGS_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-form-flags-residual-result.json"',
  linearizedResidualWorkflowStart
);
const linearizedResidualWorkflow =
  linearizedResidualWorkflowStart >= 0 &&
  linearizedResidualWorkflowEnd > linearizedResidualWorkflowStart
    ? differentialWorkflow.slice(
        linearizedResidualWorkflowStart,
        linearizedResidualWorkflowEnd
      )
    : '';
const formFlagsResidualWorkflowStart = differentialWorkflow.indexOf(
  'FORM_FLAGS_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-form-flags-residual-result.json"'
);
const formFlagsResidualWorkflowEnd = differentialWorkflow.indexOf(
  'TEXT_ANNOTATION_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-text-annotation-residual-result.json"',
  formFlagsResidualWorkflowStart
);
const formFlagsResidualWorkflow =
  formFlagsResidualWorkflowStart >= 0 &&
  formFlagsResidualWorkflowEnd > formFlagsResidualWorkflowStart
    ? differentialWorkflow.slice(
        formFlagsResidualWorkflowStart,
        formFlagsResidualWorkflowEnd
      )
    : '';
const textAnnotationResidualWorkflowStart = differentialWorkflow.indexOf(
  'TEXT_ANNOTATION_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-text-annotation-residual-result.json"'
);
const textAnnotationResidualWorkflowEnd = differentialWorkflow.indexOf(
  'REMOTE_ACTION_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-remote-action-residual-result.json"',
  textAnnotationResidualWorkflowStart
);
const textAnnotationResidualWorkflow =
  textAnnotationResidualWorkflowStart >= 0 &&
  textAnnotationResidualWorkflowEnd > textAnnotationResidualWorkflowStart
    ? differentialWorkflow.slice(
        textAnnotationResidualWorkflowStart,
        textAnnotationResidualWorkflowEnd
      )
    : '';
const remoteActionResidualWorkflowStart = differentialWorkflow.indexOf(
  'REMOTE_ACTION_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-remote-action-residual-result.json"'
);
const remoteActionResidualWorkflowEnd = differentialWorkflow.indexOf(
  'POPUP_ANNOTATION_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-popup-annotation-residual-result.json"',
  remoteActionResidualWorkflowStart
);
const remoteActionResidualWorkflow =
  remoteActionResidualWorkflowStart >= 0 &&
  remoteActionResidualWorkflowEnd > remoteActionResidualWorkflowStart
    ? differentialWorkflow.slice(
        remoteActionResidualWorkflowStart,
        remoteActionResidualWorkflowEnd
      )
    : '';
const popupAnnotationResidualWorkflowStart = differentialWorkflow.indexOf(
  'POPUP_ANNOTATION_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-popup-annotation-residual-result.json"'
);
const popupAnnotationResidualWorkflowEnd = differentialWorkflow.indexOf(
  'VISUAL_ARTIFACT="${SCRATCH_DIR}/v3014-visual-result.json"',
  popupAnnotationResidualWorkflowStart
);
const popupAnnotationResidualWorkflow =
  popupAnnotationResidualWorkflowStart >= 0 &&
  popupAnnotationResidualWorkflowEnd > popupAnnotationResidualWorkflowStart
    ? differentialWorkflow.slice(
        popupAnnotationResidualWorkflowStart,
        popupAnnotationResidualWorkflowEnd
      )
    : '';

const popupZeroSizeResidualWorkflowStart = differentialWorkflow.indexOf(
  'POPUP_ZERO_SIZE_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-popup-zero-size-residual-result.json"'
);
const popupZeroSizeResidualWorkflowEnd = differentialWorkflow.indexOf(
  'VISUAL_ARTIFACT="${SCRATCH_DIR}/v3014-visual-result.json"',
  popupZeroSizeResidualWorkflowStart
);
const popupZeroSizeResidualWorkflow =
  popupZeroSizeResidualWorkflowStart >= 0 &&
  popupZeroSizeResidualWorkflowEnd > popupZeroSizeResidualWorkflowStart
    ? differentialWorkflow.slice(
        popupZeroSizeResidualWorkflowStart,
        popupZeroSizeResidualWorkflowEnd
      )
    : '';

const popupGroupIrtResidualWorkflowStart = differentialWorkflow.indexOf(
  'POPUP_GROUP_IRT_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-popup-group-irt-residual-result.json"'
);
const popupGroupIrtResidualWorkflowEnd = differentialWorkflow.indexOf(
  'VISUAL_ARTIFACT="${SCRATCH_DIR}/v3014-visual-result.json"',
  popupGroupIrtResidualWorkflowStart
);
const popupGroupIrtResidualWorkflow =
  popupGroupIrtResidualWorkflowStart >= 0 &&
  popupGroupIrtResidualWorkflowEnd > popupGroupIrtResidualWorkflowStart
    ? differentialWorkflow.slice(
        popupGroupIrtResidualWorkflowStart,
        popupGroupIrtResidualWorkflowEnd
      )
    : '';

const textAppearanceResidualWorkflowStart = differentialWorkflow.indexOf(
  'TEXT_APPEARANCE_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-text-appearance-residual-result.json"'
);
const textAppearanceResidualWorkflowEnd = differentialWorkflow.indexOf(
  'VISUAL_ARTIFACT="${SCRATCH_DIR}/v3014-visual-result.json"',
  textAppearanceResidualWorkflowStart
);
const textAppearanceResidualWorkflow =
  textAppearanceResidualWorkflowStart >= 0 &&
  textAppearanceResidualWorkflowEnd > textAppearanceResidualWorkflowStart
    ? differentialWorkflow.slice(
        textAppearanceResidualWorkflowStart,
        textAppearanceResidualWorkflowEnd
      )
    : '';

const textNamedAppearanceResidualWorkflowStart = differentialWorkflow.indexOf(
  'TEXT_NAMED_APPEARANCE_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-text-named-appearance-residual-result.json"'
);
const textNamedAppearanceResidualWorkflowEnd = differentialWorkflow.indexOf(
  'VISUAL_ARTIFACT="${SCRATCH_DIR}/v3014-visual-result.json"',
  textNamedAppearanceResidualWorkflowStart
);
const textNamedAppearanceResidualWorkflow =
  textNamedAppearanceResidualWorkflowStart >= 0 &&
  textNamedAppearanceResidualWorkflowEnd > textNamedAppearanceResidualWorkflowStart
    ? differentialWorkflow.slice(
        textNamedAppearanceResidualWorkflowStart,
        textNamedAppearanceResidualWorkflowEnd
      )
    : '';

const textInvertedRectResidualWorkflowStart = differentialWorkflow.indexOf(
  'TEXT_INVERTED_RECT_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-text-inverted-rect-residual-result.json"'
);
const textInvertedRectResidualWorkflowEnd = differentialWorkflow.indexOf(
  'VISUAL_ARTIFACT="${SCRATCH_DIR}/v3014-visual-result.json"',
  textInvertedRectResidualWorkflowStart
);
const textInvertedRectResidualWorkflow =
  textInvertedRectResidualWorkflowStart >= 0 &&
  textInvertedRectResidualWorkflowEnd > textInvertedRectResidualWorkflowStart
    ? differentialWorkflow.slice(
        textInvertedRectResidualWorkflowStart,
        textInvertedRectResidualWorkflowEnd
      )
    : '';

const remoteNamedDestResidualWorkflowStart = differentialWorkflow.indexOf(
  'REMOTE_NAMED_DEST_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-remote-named-dest-residual-result.json"'
);
const remoteNamedDestResidualWorkflowEnd = differentialWorkflow.indexOf(
  'VISUAL_ARTIFACT="${SCRATCH_DIR}/v3014-visual-result.json"',
  remoteNamedDestResidualWorkflowStart
);
const remoteNamedDestResidualWorkflow =
  remoteNamedDestResidualWorkflowStart >= 0 &&
  remoteNamedDestResidualWorkflowEnd > remoteNamedDestResidualWorkflowStart
    ? differentialWorkflow.slice(
        remoteNamedDestResidualWorkflowStart,
        remoteNamedDestResidualWorkflowEnd
      )
    : '';

const pageLabelsKidsResidualWorkflowStart = differentialWorkflow.indexOf(
  'PAGE_LABELS_KIDS_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-page-labels-kids-residual-result.json"'
);
const pageLabelsKidsResidualWorkflowEnd = differentialWorkflow.indexOf(
  'FORM_BUTTON_ARRAY_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-form-button-array-residual-result.json"',
  pageLabelsKidsResidualWorkflowStart
);
const pageLabelsKidsResidualWorkflow =
  pageLabelsKidsResidualWorkflowStart >= 0 &&
  pageLabelsKidsResidualWorkflowEnd > pageLabelsKidsResidualWorkflowStart
    ? differentialWorkflow.slice(
        pageLabelsKidsResidualWorkflowStart,
        pageLabelsKidsResidualWorkflowEnd
      )
    : '';
const formButtonArrayResidualWorkflowStart = differentialWorkflow.indexOf(
  'FORM_BUTTON_ARRAY_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-form-button-array-residual-result.json"'
);
const formButtonArrayResidualWorkflowEnd = differentialWorkflow.indexOf(
  'ATTACHMENT_ODD_NAMES_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-attachment-odd-names-residual-result.json"',
  formButtonArrayResidualWorkflowStart
);
const formButtonArrayResidualWorkflow =
  formButtonArrayResidualWorkflowStart >= 0 &&
  formButtonArrayResidualWorkflowEnd > formButtonArrayResidualWorkflowStart
    ? differentialWorkflow.slice(
        formButtonArrayResidualWorkflowStart,
        formButtonArrayResidualWorkflowEnd
      )
    : '';
const attachmentOddNamesResidualWorkflowStart = differentialWorkflow.indexOf(
  'ATTACHMENT_ODD_NAMES_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-attachment-odd-names-residual-result.json"'
);
const attachmentOddNamesResidualWorkflowEnd = differentialWorkflow.indexOf(
  'FORM_UTF16_TEXT_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-form-utf16-text-residual-result.json"',
  attachmentOddNamesResidualWorkflowStart
);
const attachmentOddNamesResidualWorkflow =
  attachmentOddNamesResidualWorkflowStart >= 0 &&
  attachmentOddNamesResidualWorkflowEnd > attachmentOddNamesResidualWorkflowStart
    ? differentialWorkflow.slice(
        attachmentOddNamesResidualWorkflowStart,
        attachmentOddNamesResidualWorkflowEnd
      )
    : '';
const formUtf16TextResidualWorkflowStart = differentialWorkflow.indexOf(
  'FORM_UTF16_TEXT_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-form-utf16-text-residual-result.json"'
);
const formUtf16TextResidualWorkflowEnd = differentialWorkflow.indexOf(
  'UTF16_TEXT_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-utf16-text-residual-result.json"',
  formUtf16TextResidualWorkflowStart
);
const formUtf16TextResidualWorkflow =
  formUtf16TextResidualWorkflowStart >= 0 &&
  formUtf16TextResidualWorkflowEnd > formUtf16TextResidualWorkflowStart
    ? differentialWorkflow.slice(
        formUtf16TextResidualWorkflowStart,
        formUtf16TextResidualWorkflowEnd
      )
    : '';
const utf16TextResidualWorkflowStart = differentialWorkflow.indexOf(
  'UTF16_TEXT_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-utf16-text-residual-result.json"'
);
const utf16TextResidualWorkflowEnd = differentialWorkflow.indexOf(
  'TEXT_INVALID_AS_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-text-invalid-as-residual-result.json"',
  utf16TextResidualWorkflowStart
);
const utf16TextResidualWorkflow =
  utf16TextResidualWorkflowStart >= 0 &&
  utf16TextResidualWorkflowEnd > utf16TextResidualWorkflowStart
    ? differentialWorkflow.slice(
        utf16TextResidualWorkflowStart,
        utf16TextResidualWorkflowEnd
      )
    : '';
const textInvalidAsResidualWorkflowStart = differentialWorkflow.indexOf(
  'TEXT_INVALID_AS_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-text-invalid-as-residual-result.json"'
);
const textInvalidAsResidualWorkflowEnd = differentialWorkflow.indexOf(
  'LINE_ANNOTATION_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-line-annotation-residual-result.json"',
  textInvalidAsResidualWorkflowStart
);
const textInvalidAsResidualWorkflow =
  textInvalidAsResidualWorkflowStart >= 0 &&
  textInvalidAsResidualWorkflowEnd > textInvalidAsResidualWorkflowStart
    ? differentialWorkflow.slice(
        textInvalidAsResidualWorkflowStart,
        textInvalidAsResidualWorkflowEnd
      )
    : '';
const lineAnnotationResidualWorkflowStart = differentialWorkflow.indexOf(
  'LINE_ANNOTATION_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-line-annotation-residual-result.json"'
);
const lineAnnotationResidualWorkflowEnd = differentialWorkflow.indexOf(
  'POLYLINE_POLYGON_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-polyline-polygon-residual-result.json"',
  lineAnnotationResidualWorkflowStart
);
const lineAnnotationResidualWorkflow =
  lineAnnotationResidualWorkflowStart >= 0 &&
  lineAnnotationResidualWorkflowEnd > lineAnnotationResidualWorkflowStart
    ? differentialWorkflow.slice(
        lineAnnotationResidualWorkflowStart,
        lineAnnotationResidualWorkflowEnd
      )
    : '';
const polylinePolygonResidualWorkflowStart = differentialWorkflow.indexOf(
  'POLYLINE_POLYGON_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-polyline-polygon-residual-result.json"'
);
const polylinePolygonResidualWorkflowEnd = differentialWorkflow.indexOf(
  'INK_ANNOTATION_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-ink-annotation-residual-result.json"',
  polylinePolygonResidualWorkflowStart
);
const polylinePolygonResidualWorkflow =
  polylinePolygonResidualWorkflowStart >= 0 &&
  polylinePolygonResidualWorkflowEnd > polylinePolygonResidualWorkflowStart
    ? differentialWorkflow.slice(
        polylinePolygonResidualWorkflowStart,
        polylinePolygonResidualWorkflowEnd
      )
    : '';
const inkAnnotationResidualWorkflowStart = differentialWorkflow.indexOf(
  'INK_ANNOTATION_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-ink-annotation-residual-result.json"'
);
const inkAnnotationResidualWorkflowEnd = differentialWorkflow.indexOf(
  'BORDER_WIDTH_CLAMP_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-border-width-clamp-residual-result.json"',
  inkAnnotationResidualWorkflowStart
);
const inkAnnotationResidualWorkflow =
  inkAnnotationResidualWorkflowStart >= 0 &&
  inkAnnotationResidualWorkflowEnd > inkAnnotationResidualWorkflowStart
    ? differentialWorkflow.slice(
        inkAnnotationResidualWorkflowStart,
        inkAnnotationResidualWorkflowEnd
      )
    : '';
const borderWidthClampResidualWorkflowStart = differentialWorkflow.indexOf(
  'BORDER_WIDTH_CLAMP_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-border-width-clamp-residual-result.json"'
);
const borderWidthClampResidualWorkflowEnd = differentialWorkflow.indexOf(
  'BORDER_ARRAY_WIDTH_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-border-array-width-residual-result.json"',
  borderWidthClampResidualWorkflowStart
);
const borderWidthClampResidualWorkflow =
  borderWidthClampResidualWorkflowStart >= 0 &&
  borderWidthClampResidualWorkflowEnd > borderWidthClampResidualWorkflowStart
    ? differentialWorkflow.slice(
        borderWidthClampResidualWorkflowStart,
        borderWidthClampResidualWorkflowEnd
      )
    : '';
const borderArrayWidthResidualWorkflowStart = differentialWorkflow.indexOf(
  'BORDER_ARRAY_WIDTH_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-border-array-width-residual-result.json"'
);
const borderArrayWidthResidualWorkflowEnd = differentialWorkflow.indexOf(
  'BORDER_BS_PREFERENCE_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-border-bs-preference-residual-result.json"',
  borderArrayWidthResidualWorkflowStart
);
const borderArrayWidthResidualWorkflow =
  borderArrayWidthResidualWorkflowStart >= 0 &&
  borderArrayWidthResidualWorkflowEnd > borderArrayWidthResidualWorkflowStart
    ? differentialWorkflow.slice(
        borderArrayWidthResidualWorkflowStart,
        borderArrayWidthResidualWorkflowEnd
      )
    : '';
const borderBsPreferenceResidualWorkflowStart = differentialWorkflow.indexOf(
  'BORDER_BS_PREFERENCE_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-border-bs-preference-residual-result.json"'
);
const borderBsPreferenceResidualWorkflowEnd = differentialWorkflow.indexOf(
  'BORDER_BS_NONDICT_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-border-bs-nondict-residual-result.json"',
  borderBsPreferenceResidualWorkflowStart
);
const borderBsPreferenceResidualWorkflow =
  borderBsPreferenceResidualWorkflowStart >= 0 &&
  borderBsPreferenceResidualWorkflowEnd > borderBsPreferenceResidualWorkflowStart
    ? differentialWorkflow.slice(
        borderBsPreferenceResidualWorkflowStart,
        borderBsPreferenceResidualWorkflowEnd
      )
    : '';
const borderBsNondictResidualWorkflowStart = differentialWorkflow.indexOf(
  'BORDER_BS_NONDICT_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-border-bs-nondict-residual-result.json"'
);
const borderBsNondictResidualWorkflowEnd = differentialWorkflow.indexOf(
  'BORDER_ARRAY_SHORT_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-border-array-short-residual-result.json"',
  borderBsNondictResidualWorkflowStart
);
const borderBsNondictResidualWorkflow =
  borderBsNondictResidualWorkflowStart >= 0 &&
  borderBsNondictResidualWorkflowEnd > borderBsNondictResidualWorkflowStart
    ? differentialWorkflow.slice(
        borderBsNondictResidualWorkflowStart,
        borderBsNondictResidualWorkflowEnd
      )
    : '';
const borderArrayShortResidualWorkflowStart = differentialWorkflow.indexOf(
  'BORDER_ARRAY_SHORT_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-border-array-short-residual-result.json"'
);
const borderArrayShortResidualWorkflowEnd = differentialWorkflow.indexOf(
  'BORDER_BS_WRONG_TYPE_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-border-bs-wrong-type-residual-result.json"',
  borderArrayShortResidualWorkflowStart
);
const borderArrayShortResidualWorkflow =
  borderArrayShortResidualWorkflowStart >= 0 &&
  borderArrayShortResidualWorkflowEnd > borderArrayShortResidualWorkflowStart
    ? differentialWorkflow.slice(
        borderArrayShortResidualWorkflowStart,
        borderArrayShortResidualWorkflowEnd
      )
    : '';
const borderBsWrongTypeResidualWorkflowStart = differentialWorkflow.indexOf(
  'BORDER_BS_WRONG_TYPE_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-border-bs-wrong-type-residual-result.json"'
);
const borderBsWrongTypeResidualWorkflowEnd = differentialWorkflow.indexOf(
  'BORDER_ZERO_SIZE_CLAMP_BYPASS_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-border-zero-size-clamp-bypass-residual-result.json"',
  borderBsWrongTypeResidualWorkflowStart
);
const borderBsWrongTypeResidualWorkflow =
  borderBsWrongTypeResidualWorkflowStart >= 0 &&
  borderBsWrongTypeResidualWorkflowEnd > borderBsWrongTypeResidualWorkflowStart
    ? differentialWorkflow.slice(
        borderBsWrongTypeResidualWorkflowStart,
        borderBsWrongTypeResidualWorkflowEnd
      )
    : '';
const borderZeroSizeClampBypassResidualWorkflowStart = differentialWorkflow.indexOf(
  'BORDER_ZERO_SIZE_CLAMP_BYPASS_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-border-zero-size-clamp-bypass-residual-result.json"'
);
const borderZeroSizeClampBypassResidualWorkflowEnd = differentialWorkflow.indexOf(
  'ANNOTATION_APPEARANCE_BBOX_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-annotation-appearance-bbox-residual-result.json"',
  borderZeroSizeClampBypassResidualWorkflowStart
);
const borderZeroSizeClampBypassResidualWorkflow =
  borderZeroSizeClampBypassResidualWorkflowStart >= 0 &&
  borderZeroSizeClampBypassResidualWorkflowEnd > borderZeroSizeClampBypassResidualWorkflowStart
    ? differentialWorkflow.slice(
        borderZeroSizeClampBypassResidualWorkflowStart,
        borderZeroSizeClampBypassResidualWorkflowEnd
      )
    : '';
const annotationAppearanceBboxResidualWorkflowStart = differentialWorkflow.indexOf(
  'ANNOTATION_APPEARANCE_BBOX_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-annotation-appearance-bbox-residual-result.json"'
);
const annotationAppearanceBboxResidualWorkflowEnd = differentialWorkflow.indexOf(
  'ANNOTATION_AP_NONSTREAM_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-annotation-ap-nonstream-residual-result.json"',
  annotationAppearanceBboxResidualWorkflowStart
);
const annotationAppearanceBboxResidualWorkflow =
  annotationAppearanceBboxResidualWorkflowStart >= 0 &&
  annotationAppearanceBboxResidualWorkflowEnd > annotationAppearanceBboxResidualWorkflowStart
    ? differentialWorkflow.slice(
        annotationAppearanceBboxResidualWorkflowStart,
        annotationAppearanceBboxResidualWorkflowEnd
      )
    : '';
const annotationApNonstreamResidualWorkflowStart = differentialWorkflow.indexOf(
  'ANNOTATION_AP_NONSTREAM_RESIDUAL_ARTIFACT="${SCRATCH_DIR}/v3014-annotation-ap-nonstream-residual-result.json"'
);
const annotationApNonstreamResidualWorkflowEnd = differentialWorkflow.indexOf(
  'VISUAL_ARTIFACT="${SCRATCH_DIR}/v3014-visual-result.json"',
  annotationApNonstreamResidualWorkflowStart
);
const annotationApNonstreamResidualWorkflow =
  annotationApNonstreamResidualWorkflowStart >= 0 &&
  annotationApNonstreamResidualWorkflowEnd > annotationApNonstreamResidualWorkflowStart
    ? differentialWorkflow.slice(
        annotationApNonstreamResidualWorkflowStart,
        annotationApNonstreamResidualWorkflowEnd
      )
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

const attachmentResidualCaseCount = attachmentResidualCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-attachment-residual-differential')) {
  failures.push('rust parity workflow must execute the frozen attachment residual differential');
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-attachment-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-attachment-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014AttachmentResidualCaseCount') ||
  !repositoryDifferential.includes('v3014AttachmentResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014AttachmentResidualOracleHash')
) {
  failures.push('repository differential artifact must bind the attachment residual family');
}
if (
  !attachmentResidualWorkflow.includes(`.caseCount == ${attachmentResidualCaseCount}`) ||
  !attachmentResidualWorkflow.includes(`.passed == ${attachmentResidualCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${attachmentResidualCaseCount}/${attachmentResidualCaseCount} attachment residual corpus`
  );
}
if (
  attachmentResidualCaseCount !== 2 ||
  attachmentResidualCorpus.envelope.fixtureCount !== 2 ||
  attachmentResidualCorpus.nonclaims.dropInFor3014 !== false ||
  attachmentResidualCorpus.nonclaims.publishFreeze !== true ||
  attachmentResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'attachment residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !attachmentResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_attachment_residual_result"'
  ) ||
  !attachmentResidualWorkflow.includes('.mutationSensitive.leafMutationCount == 17') ||
  !attachmentResidualWorkflow.includes(
    '.providerProof.nameTreeKidsWinOverNames == true'
  ) ||
  !attachmentResidualWorkflow.includes('.providerProof.trailingSlashUnnamed == true') ||
  !attachmentResidualWorkflow.includes('.providerProof.windowsPathBasename == true') ||
  !attachmentResidualWorkflow.includes(
    '.capabilityStatus.includeAttachments == "PARTIAL"'
  ) ||
  !attachmentResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !attachmentResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'attachment residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-attachment-residual-differential.ts',
  'scripts/differential/capture-v3014-attachment-residual-oracle.ts',
  'v3014-attachment-residual-baseline-runner.ts',
  'v3014-attachment-residual-projection.ts',
  'v3014-attachment-residual-corpus.json',
  'v3014-attachment-residual-oracle.json',
  'v3014-attachment-kids-v1.pdf',
  'v3014-attachment-filename-v1.pdf',
  'v3014AttachmentResidualCaseCount',
  'v3014AttachmentResidualCorpusHash',
  'v3014AttachmentResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind attachment residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) => claim.includes('exact 2-case') && claim.includes('include_attachments residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('include_attachments outside the frozen 2-case')
  )
) {
  failures.push(
    'attachment residual bounded claim and explicit nonclaims must remain documented'
  );
}

const markinfoResidualCaseCount = markinfoResidualCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-markinfo-residual-differential')) {
  failures.push('rust parity workflow must execute the frozen markinfo residual differential');
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-markinfo-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-markinfo-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014MarkinfoResidualCaseCount') ||
  !repositoryDifferential.includes('v3014MarkinfoResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014MarkinfoResidualOracleHash')
) {
  failures.push('repository differential artifact must bind the markinfo residual family');
}
if (
  !markinfoResidualWorkflow.includes(`.caseCount == ${markinfoResidualCaseCount}`) ||
  !markinfoResidualWorkflow.includes(`.passed == ${markinfoResidualCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${markinfoResidualCaseCount}/${markinfoResidualCaseCount} markinfo residual corpus`
  );
}
if (
  markinfoResidualCaseCount !== 3 ||
  markinfoResidualCorpus.envelope.fixtureCount !== 3 ||
  markinfoResidualCorpus.nonclaims.dropInFor3014 !== false ||
  markinfoResidualCorpus.nonclaims.publishFreeze !== true ||
  markinfoResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'markinfo residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !markinfoResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_markinfo_residual_result"'
  ) ||
  !markinfoResidualWorkflow.includes('.mutationSensitive.leafMutationCount == 30') ||
  !markinfoResidualWorkflow.includes('.providerProof.nonBooleanDefaultsFalse == true') ||
  !markinfoResidualWorkflow.includes('.providerProof.allTruePreserved == true') ||
  !markinfoResidualWorkflow.includes('.providerProof.emptyAllFalse == true') ||
  !markinfoResidualWorkflow.includes(
    '.capabilityStatus.includePermissions == "PARTIAL"'
  ) ||
  !markinfoResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !markinfoResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'markinfo residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-markinfo-residual-differential.ts',
  'scripts/differential/capture-v3014-markinfo-residual-oracle.ts',
  'v3014-markinfo-residual-baseline-runner.ts',
  'v3014-markinfo-residual-projection.ts',
  'v3014-markinfo-residual-corpus.json',
  'v3014-markinfo-residual-oracle.json',
  'v3014-markinfo-nonbool-v1.pdf',
  'v3014-markinfo-alltrue-v1.pdf',
  'v3014-markinfo-empty-v1.pdf',
  'v3014MarkinfoResidualCaseCount',
  'v3014MarkinfoResidualCorpusHash',
  'v3014MarkinfoResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind markinfo residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) => claim.includes('exact 3-case') && claim.includes('mark_info residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('mark_info outside the frozen 3-case')
  )
) {
  failures.push(
    'markinfo residual bounded claim and explicit nonclaims must remain documented'
  );
}

const formParentChildCaseCount = formParentChildCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-form-parent-child-differential')) {
  failures.push('rust parity workflow must execute the frozen form parent-child differential');
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-form-parent-child-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-form-parent-child-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014FormParentChildCaseCount') ||
  !repositoryDifferential.includes('v3014FormParentChildCorpusHash') ||
  !repositoryDifferential.includes('v3014FormParentChildOracleHash')
) {
  failures.push('repository differential artifact must bind the form parent-child family');
}
if (
  !formParentChildWorkflow.includes(`.caseCount == ${formParentChildCaseCount}`) ||
  !formParentChildWorkflow.includes(`.passed == ${formParentChildCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${formParentChildCaseCount}/${formParentChildCaseCount} form parent-child corpus`
  );
}
if (
  formParentChildCaseCount !== 2 ||
  formParentChildCorpus.envelope.fixtureCount !== 2 ||
  formParentChildCorpus.nonclaims.dropInFor3014 !== false ||
  formParentChildCorpus.nonclaims.publishFreeze !== true ||
  formParentChildCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'form parent-child corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !formParentChildWorkflow.includes(
    '.profile == "pdf_reader_v3014_form_parent_child_result"'
  ) ||
  !formParentChildWorkflow.includes('.mutationSensitive.leafMutationCount == 34') ||
  !formParentChildWorkflow.includes('.providerProof.skipDirectDicts == true') ||
  !formParentChildWorkflow.includes(
    '.providerProof.dottedChildNameWithDvValue == true'
  ) ||
  !formParentChildWorkflow.includes(
    '.providerProof.readonlyParentEditableFalse == true'
  ) ||
  !formParentChildWorkflow.includes(
    '.capabilityStatus.includeFormFields == "PARTIAL"'
  ) ||
  !formParentChildWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !formParentChildWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'form parent-child workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-form-parent-child-differential.ts',
  'scripts/differential/capture-v3014-form-parent-child-oracle.ts',
  'v3014-form-parent-child-baseline-runner.ts',
  'v3014-form-parent-child-projection.ts',
  'v3014-form-parent-child-corpus.json',
  'v3014-form-parent-child-oracle.json',
  'v3014-form-parent-child-v1.pdf',
  'v3014-form-parent-readonly-v1.pdf',
  'v3014FormParentChildCaseCount',
  'v3014FormParentChildCorpusHash',
  'v3014FormParentChildOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind form parent-child family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) => claim.includes('exact 2-case') && claim.includes('parent/child residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('parent/child outside the frozen 2-case')
  )
) {
  failures.push(
    'form parent-child bounded claim and explicit nonclaims must remain documented'
  );
}

const annotationResidualCaseCount = annotationResidualCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-annotation-residual-differential')) {
  failures.push('rust parity workflow must execute the frozen annotation residual differential');
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-annotation-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-annotation-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014AnnotationResidualCaseCount') ||
  !repositoryDifferential.includes('v3014AnnotationResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014AnnotationResidualOracleHash')
) {
  failures.push('repository differential artifact must bind the annotation residual family');
}
if (
  !annotationResidualWorkflow.includes(`.caseCount == ${annotationResidualCaseCount}`) ||
  !annotationResidualWorkflow.includes(`.passed == ${annotationResidualCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${annotationResidualCaseCount}/${annotationResidualCaseCount} annotation residual corpus`
  );
}
if (
  annotationResidualCaseCount !== 2 ||
  annotationResidualCorpus.envelope.fixtureCount !== 2 ||
  annotationResidualCorpus.nonclaims.dropInFor3014 !== false ||
  annotationResidualCorpus.nonclaims.publishFreeze !== true ||
  annotationResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'annotation residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !annotationResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_annotation_residual_result"'
  ) ||
  !annotationResidualWorkflow.includes('.mutationSensitive.leafMutationCount == 44') ||
  !annotationResidualWorkflow.includes(
    '.providerProof.freeTextAndLinkFullBoxes == true'
  ) ||
  !annotationResidualWorkflow.includes('.providerProof.multiPageFreeText == true') ||
  !annotationResidualWorkflow.includes(
    '.providerProof.textContentTitleWithoutBoxes == true'
  ) ||
  !annotationResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !annotationResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !annotationResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'annotation residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-annotation-residual-differential.ts',
  'scripts/differential/capture-v3014-annotation-residual-oracle.ts',
  'v3014-annotation-residual-baseline-runner.ts',
  'v3014-annotation-residual-projection.ts',
  'v3014-annotation-residual-corpus.json',
  'v3014-annotation-residual-oracle.json',
  'v3014-annotation-link-freetext-v1.pdf',
  'v3014-annotation-text-content-v1.pdf',
  'v3014AnnotationResidualCaseCount',
  'v3014AnnotationResidualCorpusHash',
  'v3014AnnotationResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind annotation residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 2-case') &&
      claim.includes('include_annotations residual') &&
      !claim.includes('dest residual')
  ) ||
  !matrix.explicitlyNotClaimed.some(
    (claim) =>
      claim.includes('include_annotations outside the frozen 2-case') ||
      claim.includes('include_annotations outside the frozen public-stdio residual families')
  )
) {
  failures.push(
    'annotation residual bounded claim and explicit nonclaims must remain documented'
  );
}

const annotationDestResidualCaseCount = annotationDestResidualCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-annotation-dest-residual-differential')) {
  failures.push(
    'rust parity workflow must execute the frozen annotation dest residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-annotation-dest-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-annotation-dest-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014AnnotationDestResidualCaseCount') ||
  !repositoryDifferential.includes('v3014AnnotationDestResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014AnnotationDestResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the annotation dest residual family'
  );
}
if (
  !annotationDestResidualWorkflow.includes(
    `.caseCount == ${annotationDestResidualCaseCount}`
  ) ||
  !annotationDestResidualWorkflow.includes(
    `.passed == ${annotationDestResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${annotationDestResidualCaseCount}/${annotationDestResidualCaseCount} annotation dest residual corpus`
  );
}
if (
  annotationDestResidualCaseCount !== 2 ||
  annotationDestResidualCorpus.envelope.fixtureCount !== 2 ||
  annotationDestResidualCorpus.nonclaims.dropInFor3014 !== false ||
  annotationDestResidualCorpus.nonclaims.publishFreeze !== true ||
  annotationDestResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'annotation dest residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !annotationDestResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_annotation_dest_residual_result"'
  ) ||
  !annotationDestResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 33'
  ) ||
  !annotationDestResidualWorkflow.includes(
    '.providerProof.fitPageRefNameShape == true'
  ) ||
  !annotationDestResidualWorkflow.includes(
    '.providerProof.xyzPageRefCoordinates == true'
  ) ||
  !annotationDestResidualWorkflow.includes('.providerProof.fullRectBoxes == true') ||
  !annotationDestResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !annotationDestResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !annotationDestResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'annotation dest residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-annotation-dest-residual-differential.ts',
  'scripts/differential/capture-v3014-annotation-dest-residual-oracle.ts',
  'v3014-annotation-dest-residual-baseline-runner.ts',
  'v3014-annotation-dest-residual-projection.ts',
  'v3014-annotation-dest-residual-corpus.json',
  'v3014-annotation-dest-residual-oracle.json',
  'v3014-annotation-dest-fit-v1.pdf',
  'v3014-annotation-dest-xyz-v1.pdf',
  'v3014AnnotationDestResidualCaseCount',
  'v3014AnnotationDestResidualCorpusHash',
  'v3014AnnotationDestResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind annotation dest residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) => claim.includes('exact 2-case') && claim.includes('include_annotations dest residual') && !claim.includes('action/named')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('include_annotations dest residual outside the frozen 2-case')
  )
) {
  failures.push(
    'annotation dest residual bounded claim and explicit nonclaims must remain documented'
  );
}

const annotationActionDestResidualCaseCount = annotationActionDestResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-annotation-action-dest-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen annotation action dest residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-annotation-action-dest-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-annotation-action-dest-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014AnnotationActionDestResidualCaseCount') ||
  !repositoryDifferential.includes('v3014AnnotationActionDestResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014AnnotationActionDestResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the annotation action dest residual family'
  );
}
if (
  !annotationActionDestResidualWorkflow.includes(
    `.caseCount == ${annotationActionDestResidualCaseCount}`
  ) ||
  !annotationActionDestResidualWorkflow.includes(
    `.passed == ${annotationActionDestResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${annotationActionDestResidualCaseCount}/${annotationActionDestResidualCaseCount} annotation action dest residual corpus`
  );
}
if (
  annotationActionDestResidualCaseCount !== 2 ||
  annotationActionDestResidualCorpus.envelope.fixtureCount !== 2 ||
  annotationActionDestResidualCorpus.nonclaims.dropInFor3014 !== false ||
  annotationActionDestResidualCorpus.nonclaims.publishFreeze !== true ||
  annotationActionDestResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'annotation action dest residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !annotationActionDestResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_annotation_action_dest_residual_result"'
  ) ||
  !annotationActionDestResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 29'
  ) ||
  !annotationActionDestResidualWorkflow.includes(
    '.providerProof.namedDestString == true'
  ) ||
  !annotationActionDestResidualWorkflow.includes(
    '.providerProof.gotoActionFitH == true'
  ) ||
  !annotationActionDestResidualWorkflow.includes(
    '.providerProof.fullRectBoxes == true'
  ) ||
  !annotationActionDestResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !annotationActionDestResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !annotationActionDestResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'annotation action dest residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-annotation-action-dest-residual-differential.ts',
  'scripts/differential/capture-v3014-annotation-action-dest-residual-oracle.ts',
  'v3014-annotation-action-dest-residual-baseline-runner.ts',
  'v3014-annotation-action-dest-residual-projection.ts',
  'v3014-annotation-action-dest-residual-corpus.json',
  'v3014-annotation-action-dest-residual-oracle.json',
  'v3014-annotation-named-dest-v1.pdf',
  'v3014-annotation-goto-action-v1.pdf',
  'v3014AnnotationActionDestResidualCaseCount',
  'v3014AnnotationActionDestResidualCorpusHash',
  'v3014AnnotationActionDestResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind annotation action dest residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 2-case') && claim.includes('action/named dest residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('action/named dest residual outside the frozen 2-case')
  )
) {
  failures.push(
    'annotation action dest residual bounded claim and explicit nonclaims must remain documented'
  );
}

const annotationActionPrecedenceResidualCaseCount =
  annotationActionPrecedenceResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-annotation-action-precedence-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen annotation action precedence residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-annotation-action-precedence-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-annotation-action-precedence-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014AnnotationActionPrecedenceResidualCaseCount') ||
  !repositoryDifferential.includes('v3014AnnotationActionPrecedenceResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014AnnotationActionPrecedenceResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the annotation action precedence residual family'
  );
}
if (
  !annotationActionPrecedenceResidualWorkflow.includes(
    `.caseCount == ${annotationActionPrecedenceResidualCaseCount}`
  ) ||
  !annotationActionPrecedenceResidualWorkflow.includes(
    `.passed == ${annotationActionPrecedenceResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${annotationActionPrecedenceResidualCaseCount}/${annotationActionPrecedenceResidualCaseCount} annotation action precedence residual corpus`
  );
}
if (
  annotationActionPrecedenceResidualCaseCount !== 3 ||
  annotationActionPrecedenceResidualCorpus.envelope.fixtureCount !== 3 ||
  annotationActionPrecedenceResidualCorpus.nonclaims.dropInFor3014 !== false ||
  annotationActionPrecedenceResidualCorpus.nonclaims.publishFreeze !== true ||
  annotationActionPrecedenceResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'annotation action precedence residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !annotationActionPrecedenceResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_annotation_action_precedence_residual_result"'
  ) ||
  !annotationActionPrecedenceResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 42'
  ) ||
  !annotationActionPrecedenceResidualWorkflow.includes(
    '.providerProof.gotoOverDest == true'
  ) ||
  !annotationActionPrecedenceResidualWorkflow.includes(
    '.providerProof.uriSuppressesDest == true'
  ) ||
  !annotationActionPrecedenceResidualWorkflow.includes(
    '.providerProof.launchFileUrl == true'
  ) ||
  !annotationActionPrecedenceResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !annotationActionPrecedenceResidualWorkflow.includes(
    '.productTruth.dropInFor3014 == false'
  ) ||
  !annotationActionPrecedenceResidualWorkflow.includes(
    '.productTruth.publishFreeze == true'
  )
) {
  failures.push(
    'annotation action precedence residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-annotation-action-precedence-residual-differential.ts',
  'scripts/differential/capture-v3014-annotation-action-precedence-residual-oracle.ts',
  'v3014-annotation-action-precedence-residual-baseline-runner.ts',
  'v3014-annotation-action-precedence-residual-projection.ts',
  'v3014-annotation-action-precedence-residual-corpus.json',
  'v3014-annotation-action-precedence-residual-oracle.json',
  'v3014-annotation-goto-over-dest-v1.pdf',
  'v3014-annotation-uri-over-dest-v1.pdf',
  'v3014-annotation-launch-file-v1.pdf',
  'v3014AnnotationActionPrecedenceResidualCaseCount',
  'v3014AnnotationActionPrecedenceResidualCorpusHash',
  'v3014AnnotationActionPrecedenceResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind annotation action precedence residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') && claim.includes('action-precedence residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('action-precedence residual outside the frozen 3-case')
  )
) {
  failures.push(
    'annotation action precedence residual bounded claim and explicit nonclaims must remain documented'
  );
}

const infoFlagsResidualCaseCount = infoFlagsResidualCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-info-flags-residual-differential')) {
  failures.push('rust parity workflow must execute the frozen info flags residual differential');
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-info-flags-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-info-flags-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014InfoFlagsResidualCaseCount') ||
  !repositoryDifferential.includes('v3014InfoFlagsResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014InfoFlagsResidualOracleHash')
) {
  failures.push('repository differential artifact must bind the info flags residual family');
}
if (
  !infoFlagsResidualWorkflow.includes(`.caseCount == ${infoFlagsResidualCaseCount}`) ||
  !infoFlagsResidualWorkflow.includes(`.passed == ${infoFlagsResidualCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${infoFlagsResidualCaseCount}/${infoFlagsResidualCaseCount} info flags residual corpus`
  );
}
if (
  infoFlagsResidualCaseCount !== 2 ||
  infoFlagsResidualCorpus.envelope.fixtureCount !== 2 ||
  infoFlagsResidualCorpus.nonclaims.dropInFor3014 !== false ||
  infoFlagsResidualCorpus.nonclaims.publishFreeze !== true ||
  infoFlagsResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'info flags residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !infoFlagsResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_info_flags_residual_result"'
  ) ||
  !infoFlagsResidualWorkflow.includes('.mutationSensitive.leafMutationCount == 33') ||
  !infoFlagsResidualWorkflow.includes('.providerProof.acroformLangFlags == true') ||
  !infoFlagsResidualWorkflow.includes('.providerProof.plainNullFlags == true') ||
  !infoFlagsResidualWorkflow.includes('.providerProof.documentInfoFields == true') ||
  !infoFlagsResidualWorkflow.includes(
    '.capabilityStatus.includeMetadata == "PARTIAL"'
  ) ||
  !infoFlagsResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !infoFlagsResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'info flags residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-info-flags-residual-differential.ts',
  'scripts/differential/capture-v3014-info-flags-residual-oracle.ts',
  'v3014-info-flags-residual-baseline-runner.ts',
  'v3014-info-flags-residual-projection.ts',
  'v3014-info-flags-residual-corpus.json',
  'v3014-info-flags-residual-oracle.json',
  'v3014-info-flags-acroform-v1.pdf',
  'v3014-info-flags-plain-v1.pdf',
  'v3014InfoFlagsResidualCaseCount',
  'v3014InfoFlagsResidualCorpusHash',
  'v3014InfoFlagsResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind info flags residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) => claim.includes('exact 2-case') && claim.includes('include_metadata info residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('include_metadata info residual outside the frozen 2-case')
  )
) {
  failures.push(
    'info flags residual bounded claim and explicit nonclaims must remain documented'
  );
}

const pageGeometryResidualCaseCount = pageGeometryResidualCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-page-geometry-residual-differential')) {
  failures.push(
    'rust parity workflow must execute the frozen page geometry residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-page-geometry-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-page-geometry-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014PageGeometryResidualCaseCount') ||
  !repositoryDifferential.includes('v3014PageGeometryResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014PageGeometryResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the page geometry residual family'
  );
}
if (
  !pageGeometryResidualWorkflow.includes(
    `.caseCount == ${pageGeometryResidualCaseCount}`
  ) ||
  !pageGeometryResidualWorkflow.includes(
    `.passed == ${pageGeometryResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${pageGeometryResidualCaseCount}/${pageGeometryResidualCaseCount} page geometry residual corpus`
  );
}
if (
  pageGeometryResidualCaseCount !== 3 ||
  pageGeometryResidualCorpus.envelope.fixtureCount !== 3 ||
  pageGeometryResidualCorpus.nonclaims.dropInFor3014 !== false ||
  pageGeometryResidualCorpus.nonclaims.publishFreeze !== true ||
  pageGeometryResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'page geometry residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !pageGeometryResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_page_geometry_residual_result"'
  ) ||
  !pageGeometryResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 39'
  ) ||
  !pageGeometryResidualWorkflow.includes(
    '.providerProof.rotateUserUnitCropBox == true'
  ) ||
  !pageGeometryResidualWorkflow.includes('.providerProof.defaultMediaBox == true') ||
  !pageGeometryResidualWorkflow.includes(
    '.providerProof.invertedMediaBoxNormalized == true'
  ) ||
  !pageGeometryResidualWorkflow.includes(
    '.capabilityStatus.includePageGeometry == "PARTIAL"'
  ) ||
  !pageGeometryResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !pageGeometryResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'page geometry residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-page-geometry-residual-differential.ts',
  'scripts/differential/capture-v3014-page-geometry-residual-oracle.ts',
  'v3014-page-geometry-residual-baseline-runner.ts',
  'v3014-page-geometry-residual-projection.ts',
  'v3014-page-geometry-residual-corpus.json',
  'v3014-page-geometry-residual-oracle.json',
  'v3014-page-geometry-rotate-userunit-v1.pdf',
  'v3014-page-geometry-default-v1.pdf',
  'v3014-page-geometry-inverted-mediabox-v1.pdf',
  'v3014PageGeometryResidualCaseCount',
  'v3014PageGeometryResidualCorpusHash',
  'v3014PageGeometryResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind page geometry residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') && claim.includes('include_page_geometry residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('include_page_geometry residual outside the frozen 3-case')
  )
) {
  failures.push(
    'page geometry residual bounded claim and explicit nonclaims must remain documented'
  );
}

const pageLabelsResidualCaseCount = pageLabelsResidualCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-page-labels-residual-differential')) {
  failures.push(
    'rust parity workflow must execute the frozen page labels residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-page-labels-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-page-labels-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014PageLabelsResidualCaseCount') ||
  !repositoryDifferential.includes('v3014PageLabelsResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014PageLabelsResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the page labels residual family'
  );
}
if (
  !pageLabelsResidualWorkflow.includes(`.caseCount == ${pageLabelsResidualCaseCount}`) ||
  !pageLabelsResidualWorkflow.includes(`.passed == ${pageLabelsResidualCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${pageLabelsResidualCaseCount}/${pageLabelsResidualCaseCount} page labels residual corpus`
  );
}
if (
  pageLabelsResidualCaseCount !== 3 ||
  pageLabelsResidualCorpus.envelope.fixtureCount !== 3 ||
  pageLabelsResidualCorpus.nonclaims.dropInFor3014 !== false ||
  pageLabelsResidualCorpus.nonclaims.publishFreeze !== true ||
  pageLabelsResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'page labels residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !pageLabelsResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_page_labels_residual_result"'
  ) ||
  !pageLabelsResidualWorkflow.includes('.mutationSensitive.leafMutationCount == 17') ||
  !pageLabelsResidualWorkflow.includes('.providerProof.multiStyleLabels == true') ||
  !pageLabelsResidualWorkflow.includes('.providerProof.prefixStartDecimal == true') ||
  !pageLabelsResidualWorkflow.includes('.providerProof.absentLabelsOmitted == true') ||
  !pageLabelsResidualWorkflow.includes(
    '.capabilityStatus.includePageLabels == "PARTIAL"'
  ) ||
  !pageLabelsResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !pageLabelsResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'page labels residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-page-labels-residual-differential.ts',
  'scripts/differential/capture-v3014-page-labels-residual-oracle.ts',
  'v3014-page-labels-residual-baseline-runner.ts',
  'v3014-page-labels-residual-projection.ts',
  'v3014-page-labels-residual-corpus.json',
  'v3014-page-labels-residual-oracle.json',
  'v3014-page-labels-multi-v1.pdf',
  'v3014-page-labels-prefix-v1.pdf',
  'v3014-page-labels-none-v1.pdf',
  'v3014PageLabelsResidualCaseCount',
  'v3014PageLabelsResidualCorpusHash',
  'v3014PageLabelsResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind page labels residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') && claim.includes('include_page_labels residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('include_page_labels residual outside the frozen 3-case')
  )
) {
  failures.push(
    'page labels residual bounded claim and explicit nonclaims must remain documented'
  );
}

const outlineResidualCaseCount = outlineResidualCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-outline-residual-differential')) {
  failures.push('rust parity workflow must execute the frozen outline residual differential');
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-outline-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-outline-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014OutlineResidualCaseCount') ||
  !repositoryDifferential.includes('v3014OutlineResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014OutlineResidualOracleHash')
) {
  failures.push('repository differential artifact must bind the outline residual family');
}
if (
  !outlineResidualWorkflow.includes(`.caseCount == ${outlineResidualCaseCount}`) ||
  !outlineResidualWorkflow.includes(`.passed == ${outlineResidualCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${outlineResidualCaseCount}/${outlineResidualCaseCount} outline residual corpus`
  );
}
if (
  outlineResidualCaseCount !== 3 ||
  outlineResidualCorpus.envelope.fixtureCount !== 3 ||
  outlineResidualCorpus.nonclaims.dropInFor3014 !== false ||
  outlineResidualCorpus.nonclaims.publishFreeze !== true ||
  outlineResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'outline residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !outlineResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_outline_residual_result"'
  ) ||
  !outlineResidualWorkflow.includes('.mutationSensitive.leafMutationCount == 39') ||
  !outlineResidualWorkflow.includes('.providerProof.uriParentChildFit == true') ||
  !outlineResidualWorkflow.includes('.providerProof.fithCoordinate == true') ||
  !outlineResidualWorkflow.includes('.providerProof.absentOutlineOmitted == true') ||
  !outlineResidualWorkflow.includes(
    '.capabilityStatus.includeOutline == "PARTIAL"'
  ) ||
  !outlineResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !outlineResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'outline residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-outline-residual-differential.ts',
  'scripts/differential/capture-v3014-outline-residual-oracle.ts',
  'v3014-outline-residual-baseline-runner.ts',
  'v3014-outline-residual-projection.ts',
  'v3014-outline-residual-corpus.json',
  'v3014-outline-residual-oracle.json',
  'v3014-outline-uri-child-v1.pdf',
  'v3014-outline-fith-v1.pdf',
  'v3014-outline-none-v1.pdf',
  'v3014OutlineResidualCaseCount',
  'v3014OutlineResidualCorpusHash',
  'v3014OutlineResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind outline residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) => claim.includes('exact 3-case') && claim.includes('include_outline residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('include_outline residual outside the frozen 3-case')
  )
) {
  failures.push(
    'outline residual bounded claim and explicit nonclaims must remain documented'
  );
}

const permissionsResidualCaseCount = permissionsResidualCorpus.cases.length;
if (!differentialWorkflow.includes('bun run test:v3014-permissions-residual-differential')) {
  failures.push(
    'rust parity workflow must execute the frozen permissions residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-permissions-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-permissions-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014PermissionsResidualCaseCount') ||
  !repositoryDifferential.includes('v3014PermissionsResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014PermissionsResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the permissions residual family'
  );
}
if (
  !permissionsResidualWorkflow.includes(
    `.caseCount == ${permissionsResidualCaseCount}`
  ) ||
  !permissionsResidualWorkflow.includes(
    `.passed == ${permissionsResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${permissionsResidualCaseCount}/${permissionsResidualCaseCount} permissions residual corpus`
  );
}
if (
  permissionsResidualCaseCount !== 4 ||
  permissionsResidualCorpus.envelope.fixtureCount !== 4 ||
  permissionsResidualCorpus.nonclaims.dropInFor3014 !== false ||
  permissionsResidualCorpus.nonclaims.publishFreeze !== true ||
  permissionsResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'permissions residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !permissionsResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_permissions_residual_result"'
  ) ||
  !permissionsResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 25'
  ) ||
  !permissionsResidualWorkflow.includes(
    '.providerProof.printCopyFillA11y == true'
  ) ||
  !permissionsResidualWorkflow.includes(
    '.providerProof.modifyAnnotateAssemble == true'
  ) ||
  !permissionsResidualWorkflow.includes(
    '.providerProof.printHighQuality == true'
  ) ||
  !permissionsResidualWorkflow.includes(
    '.providerProof.unencryptedOmitsPermissions == true'
  ) ||
  !permissionsResidualWorkflow.includes(
    '.capabilityStatus.includePermissions == "PARTIAL"'
  ) ||
  !permissionsResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !permissionsResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'permissions residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-permissions-residual-differential.ts',
  'scripts/differential/capture-v3014-permissions-residual-oracle.ts',
  'v3014-permissions-residual-baseline-runner.ts',
  'v3014-permissions-residual-projection.ts',
  'v3014-permissions-residual-corpus.json',
  'v3014-permissions-residual-oracle.json',
  'v3014-permissions-print-copy-fill-a11y-v1.pdf',
  'v3014-permissions-modify-annotate-assemble-v1.pdf',
  'v3014-permissions-print-hq-v1.pdf',
  'v3014-permissions-none-v1.pdf',
  'v3014PermissionsResidualCaseCount',
  'v3014PermissionsResidualCorpusHash',
  'v3014PermissionsResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind permissions residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 4-case') && claim.includes('include_permissions residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('include_permissions residual outside the frozen 4-case')
  )
) {
  failures.push(
    'permissions residual bounded claim and explicit nonclaims must remain documented'
  );
}

const metadataPresenceResidualCaseCount = metadataPresenceResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-metadata-presence-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen metadata presence residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-metadata-presence-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-metadata-presence-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014MetadataPresenceResidualCaseCount') ||
  !repositoryDifferential.includes('v3014MetadataPresenceResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014MetadataPresenceResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the metadata presence residual family'
  );
}
if (
  !metadataPresenceResidualWorkflow.includes(
    `.caseCount == ${metadataPresenceResidualCaseCount}`
  ) ||
  !metadataPresenceResidualWorkflow.includes(
    `.passed == ${metadataPresenceResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${metadataPresenceResidualCaseCount}/${metadataPresenceResidualCaseCount} metadata presence residual corpus`
  );
}
if (
  metadataPresenceResidualCaseCount !== 2 ||
  metadataPresenceResidualCorpus.envelope.fixtureCount !== 2 ||
  metadataPresenceResidualCorpus.nonclaims.dropInFor3014 !== false ||
  metadataPresenceResidualCorpus.nonclaims.publishFreeze !== true ||
  metadataPresenceResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'metadata presence residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !metadataPresenceResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_metadata_presence_residual_result"'
  ) ||
  !metadataPresenceResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 12'
  ) ||
  !metadataPresenceResidualWorkflow.includes(
    '.providerProof.absentOmitsMetadata == true'
  ) ||
  !metadataPresenceResidualWorkflow.includes(
    '.providerProof.presentEmptyObject == true'
  ) ||
  !metadataPresenceResidualWorkflow.includes(
    '.providerProof.infoStillPresent == true'
  ) ||
  !metadataPresenceResidualWorkflow.includes(
    '.capabilityStatus.includeMetadata == "PARTIAL"'
  ) ||
  !metadataPresenceResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !metadataPresenceResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'metadata presence residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-metadata-presence-residual-differential.ts',
  'scripts/differential/capture-v3014-metadata-presence-residual-oracle.ts',
  'v3014-metadata-presence-residual-baseline-runner.ts',
  'v3014-metadata-presence-residual-projection.ts',
  'v3014-metadata-presence-residual-corpus.json',
  'v3014-metadata-presence-residual-oracle.json',
  'v3014-metadata-absent-v1.pdf',
  'v3014-metadata-present-v1.pdf',
  'v3014MetadataPresenceResidualCaseCount',
  'v3014MetadataPresenceResidualCorpusHash',
  'v3014MetadataPresenceResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind metadata presence residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 2-case') && claim.includes('metadata presence residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('metadata presence residual outside the frozen 2-case')
  )
) {
  failures.push(
    'metadata presence residual bounded claim and explicit nonclaims must remain documented'
  );
}

const infoExtrasResidualCaseCount = infoExtrasResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-info-extras-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen info extras residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-info-extras-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-info-extras-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014InfoExtrasResidualCaseCount') ||
  !repositoryDifferential.includes('v3014InfoExtrasResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014InfoExtrasResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the info extras residual family'
  );
}
if (
  !infoExtrasResidualWorkflow.includes(
    `.caseCount == ${infoExtrasResidualCaseCount}`
  ) ||
  !infoExtrasResidualWorkflow.includes(
    `.passed == ${infoExtrasResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${infoExtrasResidualCaseCount}/${infoExtrasResidualCaseCount} info extras residual corpus`
  );
}
if (
  infoExtrasResidualCaseCount !== 2 ||
  infoExtrasResidualCorpus.envelope.fixtureCount !== 2 ||
  infoExtrasResidualCorpus.nonclaims.dropInFor3014 !== false ||
  infoExtrasResidualCorpus.nonclaims.publishFreeze !== true ||
  infoExtrasResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'info extras residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !infoExtrasResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_info_extras_residual_result"'
  ) ||
  !infoExtrasResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 60'
  ) ||
  !infoExtrasResidualWorkflow.includes(
    '.providerProof.noRustOnlyInfoExtras == true'
  ) ||
  !infoExtrasResidualWorkflow.includes(
    '.providerProof.exactInfoKeySet == true'
  ) ||
  !infoExtrasResidualWorkflow.includes(
    '.providerProof.topLevelNumPagesPreserved == true'
  ) ||
  !infoExtrasResidualWorkflow.includes(
    '.capabilityStatus.includeMetadata == "PARTIAL"'
  ) ||
  !infoExtrasResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !infoExtrasResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'info extras residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-info-extras-residual-differential.ts',
  'scripts/differential/capture-v3014-info-extras-residual-oracle.ts',
  'v3014-info-extras-residual-baseline-runner.ts',
  'v3014-info-extras-residual-projection.ts',
  'v3014-info-extras-residual-corpus.json',
  'v3014-info-extras-residual-oracle.json',
  'v3014-info-flags-acroform-v1.pdf',
  'v3014-info-flags-plain-v1.pdf',
  'v3014InfoExtrasResidualCaseCount',
  'v3014InfoExtrasResidualCorpusHash',
  'v3014InfoExtrasResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind info extras residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 2-case') && claim.includes('info-extras residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('info-extras residual outside the frozen 2-case')
  )
) {
  failures.push(
    'info extras residual bounded claim and explicit nonclaims must remain documented'
  );
}

const encryptFilterResidualCaseCount = encryptFilterResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-encrypt-filter-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen encrypt filter residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-encrypt-filter-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-encrypt-filter-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014EncryptFilterResidualCaseCount') ||
  !repositoryDifferential.includes('v3014EncryptFilterResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014EncryptFilterResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the encrypt filter residual family'
  );
}
if (
  !encryptFilterResidualWorkflow.includes(
    `.caseCount == ${encryptFilterResidualCaseCount}`
  ) ||
  !encryptFilterResidualWorkflow.includes(
    `.passed == ${encryptFilterResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${encryptFilterResidualCaseCount}/${encryptFilterResidualCaseCount} encrypt filter residual corpus`
  );
}
if (
  encryptFilterResidualCaseCount !== 2 ||
  encryptFilterResidualCorpus.envelope.fixtureCount !== 2 ||
  encryptFilterResidualCorpus.nonclaims.dropInFor3014 !== false ||
  encryptFilterResidualCorpus.nonclaims.publishFreeze !== true ||
  encryptFilterResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'encrypt filter residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !encryptFilterResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_encrypt_filter_residual_result"'
  ) ||
  !encryptFilterResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 18'
  ) ||
  !encryptFilterResidualWorkflow.includes(
    '.providerProof.encryptedStandardFilter == true'
  ) ||
  !encryptFilterResidualWorkflow.includes(
    '.providerProof.unencryptedNullFilter == true'
  ) ||
  !encryptFilterResidualWorkflow.includes(
    '.providerProof.topLevelNumPagesPreserved == true'
  ) ||
  !encryptFilterResidualWorkflow.includes(
    '.capabilityStatus.includeMetadata == "PARTIAL"'
  ) ||
  !encryptFilterResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !encryptFilterResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'encrypt filter residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-encrypt-filter-residual-differential.ts',
  'scripts/differential/capture-v3014-encrypt-filter-residual-oracle.ts',
  'v3014-encrypt-filter-residual-baseline-runner.ts',
  'v3014-encrypt-filter-residual-projection.ts',
  'v3014-encrypt-filter-residual-corpus.json',
  'v3014-encrypt-filter-residual-oracle.json',
  'v3014-permissions-print-copy-fill-a11y-v1.pdf',
  'v3014-permissions-none-v1.pdf',
  'v3014EncryptFilterResidualCaseCount',
  'v3014EncryptFilterResidualCorpusHash',
  'v3014EncryptFilterResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind encrypt filter residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 2-case') && claim.includes('encrypt-filter residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('encrypt-filter residual outside the frozen 2-case')
  )
) {
  failures.push(
    'encrypt filter residual bounded claim and explicit nonclaims must remain documented'
  );
}

const linearizedResidualCaseCount = linearizedResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-linearized-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen linearized residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-linearized-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-linearized-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014LinearizedResidualCaseCount') ||
  !repositoryDifferential.includes('v3014LinearizedResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014LinearizedResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the linearized residual family'
  );
}
if (
  !linearizedResidualWorkflow.includes(
    `.caseCount == ${linearizedResidualCaseCount}`
  ) ||
  !linearizedResidualWorkflow.includes(
    `.passed == ${linearizedResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${linearizedResidualCaseCount}/${linearizedResidualCaseCount} linearized residual corpus`
  );
}
if (
  linearizedResidualCaseCount !== 3 ||
  linearizedResidualCorpus.envelope.fixtureCount !== 3 ||
  linearizedResidualCorpus.nonclaims.dropInFor3014 !== false ||
  linearizedResidualCorpus.nonclaims.publishFreeze !== true ||
  linearizedResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'linearized residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !linearizedResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_linearized_residual_result"'
  ) ||
  !linearizedResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 27'
  ) ||
  !linearizedResidualWorkflow.includes(
    '.providerProof.validLinearizedTrue == true'
  ) ||
  !linearizedResidualWorkflow.includes(
    '.providerProof.spuriousLinearizedFalse == true'
  ) ||
  !linearizedResidualWorkflow.includes(
    '.providerProof.absentLinearizedFalse == true'
  ) ||
  !linearizedResidualWorkflow.includes(
    '.providerProof.topLevelNumPagesPreserved == true'
  ) ||
  !linearizedResidualWorkflow.includes(
    '.capabilityStatus.includeMetadata == "PARTIAL"'
  ) ||
  !linearizedResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !linearizedResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'linearized residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-linearized-residual-differential.ts',
  'scripts/differential/capture-v3014-linearized-residual-oracle.ts',
  'v3014-linearized-residual-baseline-runner.ts',
  'v3014-linearized-residual-projection.ts',
  'v3014-linearized-residual-corpus.json',
  'v3014-linearized-residual-oracle.json',
  'v3014-info-linearized-valid-v1.pdf',
  'v3014-info-linearized-spurious-v1.pdf',
  'v3014-info-linearized-absent-v1.pdf',
  'v3014LinearizedResidualCaseCount',
  'v3014LinearizedResidualCorpusHash',
  'v3014LinearizedResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind linearized residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') && claim.includes('linearized residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('linearized residual outside the frozen 3-case')
  )
) {
  failures.push(
    'linearized residual bounded claim and explicit nonclaims must remain documented'
  );
}

const formFlagsResidualCaseCount = formFlagsResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-form-flags-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen form flags residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-form-flags-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-form-flags-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014FormFlagsResidualCaseCount') ||
  !repositoryDifferential.includes('v3014FormFlagsResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014FormFlagsResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the form flags residual family'
  );
}
if (
  !formFlagsResidualWorkflow.includes(
    `.caseCount == ${formFlagsResidualCaseCount}`
  ) ||
  !formFlagsResidualWorkflow.includes(
    `.passed == ${formFlagsResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${formFlagsResidualCaseCount}/${formFlagsResidualCaseCount} form flags residual corpus`
  );
}
if (
  formFlagsResidualCaseCount !== 4 ||
  formFlagsResidualCorpus.envelope.fixtureCount !== 4 ||
  formFlagsResidualCorpus.nonclaims.dropInFor3014 !== false ||
  formFlagsResidualCorpus.nonclaims.publishFreeze !== true ||
  formFlagsResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'form flags residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !formFlagsResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_form_flags_residual_result"'
  ) ||
  !formFlagsResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 36'
  ) ||
  !formFlagsResidualWorkflow.includes(
    '.providerProof.xfaOnlyAcroformFalse == true'
  ) ||
  !formFlagsResidualWorkflow.includes(
    '.providerProof.collectionPresent == true'
  ) ||
  !formFlagsResidualWorkflow.includes(
    '.providerProof.visibleSignaturesAcroformTrue == true'
  ) ||
  !formFlagsResidualWorkflow.includes(
    '.providerProof.invisibleSignaturesAcroformFalse == true'
  ) ||
  !formFlagsResidualWorkflow.includes(
    '.capabilityStatus.includeMetadata == "PARTIAL"'
  ) ||
  !formFlagsResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !formFlagsResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'form flags residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-form-flags-residual-differential.ts',
  'scripts/differential/capture-v3014-form-flags-residual-oracle.ts',
  'v3014-form-flags-residual-baseline-runner.ts',
  'v3014-form-flags-residual-projection.ts',
  'v3014-form-flags-residual-corpus.json',
  'v3014-form-flags-residual-oracle.json',
  'v3014-info-xfa-present-v1.pdf',
  'v3014-info-collection-present-v1.pdf',
  'v3014-info-signatures-present-v1.pdf',
  'v3014-info-signatures-invisible-v1.pdf',
  'v3014FormFlagsResidualCaseCount',
  'v3014FormFlagsResidualCorpusHash',
  'v3014FormFlagsResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind form flags residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 4-case') && claim.includes('form-flags residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('form-flags residual outside the frozen 4-case')
  )
) {
  failures.push(
    'form flags residual bounded claim and explicit nonclaims must remain documented'
  );
}

const textAnnotationResidualCaseCount = textAnnotationResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-text-annotation-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen text annotation residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-text-annotation-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-text-annotation-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014TextAnnotationResidualCaseCount') ||
  !repositoryDifferential.includes('v3014TextAnnotationResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014TextAnnotationResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the text annotation residual family'
  );
}
if (
  !textAnnotationResidualWorkflow.includes(
    `.caseCount == ${textAnnotationResidualCaseCount}`
  ) ||
  !textAnnotationResidualWorkflow.includes(
    `.passed == ${textAnnotationResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${textAnnotationResidualCaseCount}/${textAnnotationResidualCaseCount} text annotation residual corpus`
  );
}
if (
  textAnnotationResidualCaseCount !== 2 ||
  textAnnotationResidualCorpus.envelope.fixtureCount !== 2 ||
  textAnnotationResidualCorpus.nonclaims.dropInFor3014 !== false ||
  textAnnotationResidualCorpus.nonclaims.publishFreeze !== true ||
  textAnnotationResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'text annotation residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !textAnnotationResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_text_annotation_residual_result"'
  ) ||
  !textAnnotationResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 27'
  ) ||
  !textAnnotationResidualWorkflow.includes(
    '.providerProof.textNoAppearanceIconBox == true'
  ) ||
  !textAnnotationResidualWorkflow.includes(
    '.providerProof.freeTextRawRect == true'
  ) ||
  !textAnnotationResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !textAnnotationResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !textAnnotationResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'text annotation residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-text-annotation-residual-differential.ts',
  'scripts/differential/capture-v3014-text-annotation-residual-oracle.ts',
  'v3014-text-annotation-residual-baseline-runner.ts',
  'v3014-text-annotation-residual-projection.ts',
  'v3014-text-annotation-residual-corpus.json',
  'v3014-text-annotation-residual-oracle.json',
  'v3014-annotation-text-noap-v1.pdf',
  'v3014-annotation-freetext-v1.pdf',
  'v3014TextAnnotationResidualCaseCount',
  'v3014TextAnnotationResidualCorpusHash',
  'v3014TextAnnotationResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind text annotation residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 2-case') && claim.includes('text-annotation residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('text-annotation residual outside the frozen 2-case')
  )
) {
  failures.push(
    'text annotation residual bounded claim and explicit nonclaims must remain documented'
  );
}

const remoteActionResidualCaseCount = remoteActionResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-remote-action-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen remote action residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-remote-action-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-remote-action-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014RemoteActionResidualCaseCount') ||
  !repositoryDifferential.includes('v3014RemoteActionResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014RemoteActionResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the remote action residual family'
  );
}
if (
  !remoteActionResidualWorkflow.includes(
    `.caseCount == ${remoteActionResidualCaseCount}`
  ) ||
  !remoteActionResidualWorkflow.includes(
    `.passed == ${remoteActionResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${remoteActionResidualCaseCount}/${remoteActionResidualCaseCount} remote action residual corpus`
  );
}
if (
  remoteActionResidualCaseCount !== 3 ||
  remoteActionResidualCorpus.envelope.fixtureCount !== 3 ||
  remoteActionResidualCorpus.nonclaims.dropInFor3014 !== false ||
  remoteActionResidualCorpus.nonclaims.publishFreeze !== true ||
  remoteActionResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'remote action residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !remoteActionResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_remote_action_residual_result"'
  ) ||
  !remoteActionResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 42'
  ) ||
  !remoteActionResidualWorkflow.includes(
    '.providerProof.launchStringFile == true'
  ) ||
  !remoteActionResidualWorkflow.includes(
    '.providerProof.launchFileDictPrefersUf == true'
  ) ||
  !remoteActionResidualWorkflow.includes(
    '.providerProof.gotorRemoteDestJson == true'
  ) ||
  !remoteActionResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !remoteActionResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !remoteActionResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'remote action residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-remote-action-residual-differential.ts',
  'scripts/differential/capture-v3014-remote-action-residual-oracle.ts',
  'v3014-remote-action-residual-baseline-runner.ts',
  'v3014-remote-action-residual-projection.ts',
  'v3014-remote-action-residual-corpus.json',
  'v3014-remote-action-residual-oracle.json',
  'v3014-annotation-launch-file-v1.pdf',
  'v3014-annotation-launch-filedict-v1.pdf',
  'v3014-annotation-gotor-v1.pdf',
  'v3014RemoteActionResidualCaseCount',
  'v3014RemoteActionResidualCorpusHash',
  'v3014RemoteActionResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind remote action residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') && claim.includes('remote-action residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('remote-action residual outside the frozen 3-case')
  )
) {
  failures.push(
    'remote action residual bounded claim and explicit nonclaims must remain documented'
  );
}

const popupAnnotationResidualCaseCount = popupAnnotationResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-popup-annotation-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen popup annotation residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-popup-annotation-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-popup-annotation-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014PopupAnnotationResidualCaseCount') ||
  !repositoryDifferential.includes('v3014PopupAnnotationResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014PopupAnnotationResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the popup annotation residual family'
  );
}
if (
  !popupAnnotationResidualWorkflow.includes(
    `.caseCount == ${popupAnnotationResidualCaseCount}`
  ) ||
  !popupAnnotationResidualWorkflow.includes(
    `.passed == ${popupAnnotationResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${popupAnnotationResidualCaseCount}/${popupAnnotationResidualCaseCount} popup annotation residual corpus`
  );
}
if (
  popupAnnotationResidualCaseCount !== 2 ||
  popupAnnotationResidualCorpus.envelope.fixtureCount !== 2 ||
  popupAnnotationResidualCorpus.nonclaims.dropInFor3014 !== false ||
  popupAnnotationResidualCorpus.nonclaims.publishFreeze !== true ||
  popupAnnotationResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'popup annotation residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !popupAnnotationResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_popup_annotation_residual_result"'
  ) ||
  !popupAnnotationResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 36'
  ) ||
  !popupAnnotationResidualWorkflow.includes(
    '.providerProof.popupInheritsParentTitleContents == true'
  ) ||
  !popupAnnotationResidualWorkflow.includes(
    '.providerProof.parentTextIconBox == true'
  ) ||
  !popupAnnotationResidualWorkflow.includes(
    '.providerProof.freeTextNoParentInherit == true'
  ) ||
  !popupAnnotationResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !popupAnnotationResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !popupAnnotationResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'popup annotation residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-popup-annotation-residual-differential.ts',
  'scripts/differential/capture-v3014-popup-annotation-residual-oracle.ts',
  'v3014-popup-annotation-residual-baseline-runner.ts',
  'v3014-popup-annotation-residual-projection.ts',
  'v3014-popup-annotation-residual-corpus.json',
  'v3014-popup-annotation-residual-oracle.json',
  'v3014-annotation-popup-v1.pdf',
  'v3014-annotation-freetext-v1.pdf',
  'v3014PopupAnnotationResidualCaseCount',
  'v3014PopupAnnotationResidualCorpusHash',
  'v3014PopupAnnotationResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind popup annotation residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 2-case') && claim.includes('popup-annotation residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('popup-annotation residual outside the frozen 2-case')
  )
) {
  failures.push(
    'popup annotation residual bounded claim and explicit nonclaims must remain documented'
  );
}

const popupZeroSizeResidualCaseCount = popupZeroSizeResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-popup-zero-size-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen popup zero-size residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-popup-zero-size-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-popup-zero-size-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014PopupZeroSizeResidualCaseCount') ||
  !repositoryDifferential.includes('v3014PopupZeroSizeResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014PopupZeroSizeResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the popup zero-size residual family'
  );
}
if (
  !popupZeroSizeResidualWorkflow.includes(
    `.caseCount == ${popupZeroSizeResidualCaseCount}`
  ) ||
  !popupZeroSizeResidualWorkflow.includes(
    `.passed == ${popupZeroSizeResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${popupZeroSizeResidualCaseCount}/${popupZeroSizeResidualCaseCount} popup zero-size residual corpus`
  );
}
if (
  popupZeroSizeResidualCaseCount !== 2 ||
  popupZeroSizeResidualCorpus.envelope.fixtureCount !== 2 ||
  popupZeroSizeResidualCorpus.nonclaims.dropInFor3014 !== false ||
  popupZeroSizeResidualCorpus.nonclaims.publishFreeze !== true ||
  popupZeroSizeResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'popup zero-size residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !popupZeroSizeResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_popup_zero_size_residual_result"'
  ) ||
  !popupZeroSizeResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 42'
  ) ||
  !popupZeroSizeResidualWorkflow.includes(
    '.providerProof.popupZeroSizeNullsBoundingBox == true'
  ) ||
  !popupZeroSizeResidualWorkflow.includes(
    '.providerProof.popupNonzeroKeepsBoundingBox == true'
  ) ||
  !popupZeroSizeResidualWorkflow.includes(
    '.providerProof.popupZeroSizeStillInheritsParent == true'
  ) ||
  !popupZeroSizeResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !popupZeroSizeResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !popupZeroSizeResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'popup zero-size residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-popup-zero-size-residual-differential.ts',
  'scripts/differential/capture-v3014-popup-zero-size-residual-oracle.ts',
  'v3014-popup-zero-size-residual-baseline-runner.ts',
  'v3014-popup-zero-size-residual-projection.ts',
  'v3014-popup-zero-size-residual-corpus.json',
  'v3014-popup-zero-size-residual-oracle.json',
  'v3014-annotation-popup-zerosize-v1.pdf',
  'v3014-annotation-popup-v1.pdf',
  'v3014PopupZeroSizeResidualCaseCount',
  'v3014PopupZeroSizeResidualCorpusHash',
  'v3014PopupZeroSizeResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind popup zero-size residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 2-case') && claim.includes('popup-zero-size residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('popup-zero-size residual outside the frozen 2-case')
  )
) {
  failures.push(
    'popup zero-size residual bounded claim and explicit nonclaims must remain documented'
  );
}

const popupGroupIrtResidualCaseCount = popupGroupIrtResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-popup-group-irt-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen popup group/IRT residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-popup-group-irt-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-popup-group-irt-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014PopupGroupIrtResidualCaseCount') ||
  !repositoryDifferential.includes('v3014PopupGroupIrtResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014PopupGroupIrtResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the popup group/IRT residual family'
  );
}
if (
  !popupGroupIrtResidualWorkflow.includes(
    `.caseCount == ${popupGroupIrtResidualCaseCount}`
  ) ||
  !popupGroupIrtResidualWorkflow.includes(
    `.passed == ${popupGroupIrtResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${popupGroupIrtResidualCaseCount}/${popupGroupIrtResidualCaseCount} popup group/IRT residual corpus`
  );
}
if (
  popupGroupIrtResidualCaseCount !== 2 ||
  popupGroupIrtResidualCorpus.envelope.fixtureCount !== 2 ||
  popupGroupIrtResidualCorpus.nonclaims.dropInFor3014 !== false ||
  popupGroupIrtResidualCorpus.nonclaims.publishFreeze !== true ||
  popupGroupIrtResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'popup group/IRT residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !popupGroupIrtResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_popup_group_irt_residual_result"'
  ) ||
  !popupGroupIrtResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 64'
  ) ||
  !popupGroupIrtResidualWorkflow.includes(
    '.providerProof.groupTextInheritsIrtTitleContents == true'
  ) ||
  !popupGroupIrtResidualWorkflow.includes(
    '.providerProof.groupPopupInheritsIrtTitleContents == true'
  ) ||
  !popupGroupIrtResidualWorkflow.includes(
    '.providerProof.nongroupPopupInheritsParent == true'
  ) ||
  !popupGroupIrtResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !popupGroupIrtResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !popupGroupIrtResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'popup group/IRT residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-popup-group-irt-residual-differential.ts',
  'scripts/differential/capture-v3014-popup-group-irt-residual-oracle.ts',
  'v3014-popup-group-irt-residual-baseline-runner.ts',
  'v3014-popup-group-irt-residual-projection.ts',
  'v3014-popup-group-irt-residual-corpus.json',
  'v3014-popup-group-irt-residual-oracle.json',
  'v3014-annotation-popup-group-irt-v1.pdf',
  'v3014-annotation-popup-v1.pdf',
  'v3014PopupGroupIrtResidualCaseCount',
  'v3014PopupGroupIrtResidualCorpusHash',
  'v3014PopupGroupIrtResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind popup group/IRT residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 2-case') && claim.includes('popup-group-irt residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('popup-group-irt residual outside the frozen 2-case')
  )
) {
  failures.push(
    'popup group/IRT residual bounded claim and explicit nonclaims must remain documented'
  );
}

const textAppearanceResidualCaseCount = textAppearanceResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-text-appearance-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen text appearance residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-text-appearance-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-text-appearance-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014TextAppearanceResidualCaseCount') ||
  !repositoryDifferential.includes('v3014TextAppearanceResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014TextAppearanceResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the text appearance residual family'
  );
}
if (
  !textAppearanceResidualWorkflow.includes(
    `.caseCount == ${textAppearanceResidualCaseCount}`
  ) ||
  !textAppearanceResidualWorkflow.includes(
    `.passed == ${textAppearanceResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${textAppearanceResidualCaseCount}/${textAppearanceResidualCaseCount} text appearance residual corpus`
  );
}
if (
  textAppearanceResidualCaseCount !== 2 ||
  textAppearanceResidualCorpus.envelope.fixtureCount !== 2 ||
  textAppearanceResidualCorpus.nonclaims.dropInFor3014 !== false ||
  textAppearanceResidualCorpus.nonclaims.publishFreeze !== true ||
  textAppearanceResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'text appearance residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !textAppearanceResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_text_appearance_residual_result"'
  ) ||
  !textAppearanceResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 28'
  ) ||
  !textAppearanceResidualWorkflow.includes(
    '.providerProof.textWithAppearanceKeepsRawRect == true'
  ) ||
  !textAppearanceResidualWorkflow.includes(
    '.providerProof.textEmptyAppearanceKeepsRawRect == true'
  ) ||
  !textAppearanceResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !textAppearanceResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !textAppearanceResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'text appearance residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-text-appearance-residual-differential.ts',
  'scripts/differential/capture-v3014-text-appearance-residual-oracle.ts',
  'v3014-text-appearance-residual-baseline-runner.ts',
  'v3014-text-appearance-residual-projection.ts',
  'v3014-text-appearance-residual-corpus.json',
  'v3014-text-appearance-residual-oracle.json',
  'v3014-annotation-text-ap-v1.pdf',
  'v3014-annotation-text-emptyap-v1.pdf',
  'v3014TextAppearanceResidualCaseCount',
  'v3014TextAppearanceResidualCorpusHash',
  'v3014TextAppearanceResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind text appearance residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 2-case') && claim.includes('text-appearance residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('text-appearance residual outside the frozen 2-case')
  )
) {
  failures.push(
    'text appearance residual bounded claim and explicit nonclaims must remain documented'
  );
}

const textNamedAppearanceResidualCaseCount = textNamedAppearanceResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-text-named-appearance-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen text named appearance residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-text-named-appearance-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-text-named-appearance-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014TextNamedAppearanceResidualCaseCount') ||
  !repositoryDifferential.includes('v3014TextNamedAppearanceResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014TextNamedAppearanceResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the text named appearance residual family'
  );
}
if (
  !textNamedAppearanceResidualWorkflow.includes(
    `.caseCount == ${textNamedAppearanceResidualCaseCount}`
  ) ||
  !textNamedAppearanceResidualWorkflow.includes(
    `.passed == ${textNamedAppearanceResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${textNamedAppearanceResidualCaseCount}/${textNamedAppearanceResidualCaseCount} text named appearance residual corpus`
  );
}
if (
  textNamedAppearanceResidualCaseCount !== 2 ||
  textNamedAppearanceResidualCorpus.envelope.fixtureCount !== 2 ||
  textNamedAppearanceResidualCorpus.nonclaims.dropInFor3014 !== false ||
  textNamedAppearanceResidualCorpus.nonclaims.publishFreeze !== true ||
  textNamedAppearanceResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'text named appearance residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !textNamedAppearanceResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_text_named_appearance_residual_result"'
  ) ||
  !textNamedAppearanceResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 28'
  ) ||
  !textNamedAppearanceResidualWorkflow.includes(
    '.providerProof.namedAppearanceWithAsKeepsRawRect == true'
  ) ||
  !textNamedAppearanceResidualWorkflow.includes(
    '.providerProof.namedAppearanceWithoutAsUsesIconBox == true'
  ) ||
  !textNamedAppearanceResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !textNamedAppearanceResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !textNamedAppearanceResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'text named appearance residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-text-named-appearance-residual-differential.ts',
  'scripts/differential/capture-v3014-text-named-appearance-residual-oracle.ts',
  'v3014-text-named-appearance-residual-baseline-runner.ts',
  'v3014-text-named-appearance-residual-projection.ts',
  'v3014-text-named-appearance-residual-corpus.json',
  'v3014-text-named-appearance-residual-oracle.json',
  'v3014-annotation-text-namedap-v1.pdf',
  'v3014-annotation-text-namedap-noas-v1.pdf',
  'v3014TextNamedAppearanceResidualCaseCount',
  'v3014TextNamedAppearanceResidualCorpusHash',
  'v3014TextNamedAppearanceResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind text named appearance residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 2-case') && claim.includes('text-named-appearance residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('text-named-appearance residual outside the frozen 2-case')
  )
) {
  failures.push(
    'text named appearance residual bounded claim and explicit nonclaims must remain documented'
  );
}

const textInvertedRectResidualCaseCount = textInvertedRectResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-text-inverted-rect-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen text inverted-rect residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-text-inverted-rect-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-text-inverted-rect-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014TextInvertedRectResidualCaseCount') ||
  !repositoryDifferential.includes('v3014TextInvertedRectResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014TextInvertedRectResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the text inverted-rect residual family'
  );
}
if (
  !textInvertedRectResidualWorkflow.includes(
    `.caseCount == ${textInvertedRectResidualCaseCount}`
  ) ||
  !textInvertedRectResidualWorkflow.includes(
    `.passed == ${textInvertedRectResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${textInvertedRectResidualCaseCount}/${textInvertedRectResidualCaseCount} text inverted-rect residual corpus`
  );
}
if (
  textInvertedRectResidualCaseCount !== 2 ||
  textInvertedRectResidualCorpus.envelope.fixtureCount !== 2 ||
  textInvertedRectResidualCorpus.nonclaims.dropInFor3014 !== false ||
  textInvertedRectResidualCorpus.nonclaims.publishFreeze !== true ||
  textInvertedRectResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'text inverted-rect residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !textInvertedRectResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_text_inverted_rect_residual_result"'
  ) ||
  !textInvertedRectResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 28'
  ) ||
  !textInvertedRectResidualWorkflow.includes(
    '.providerProof.invertedTextNoAppearanceIconBox == true'
  ) ||
  !textInvertedRectResidualWorkflow.includes(
    '.providerProof.ordinaryTextNoAppearanceIconBox == true'
  ) ||
  !textInvertedRectResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !textInvertedRectResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !textInvertedRectResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'text inverted-rect residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-text-inverted-rect-residual-differential.ts',
  'scripts/differential/capture-v3014-text-inverted-rect-residual-oracle.ts',
  'v3014-text-inverted-rect-residual-baseline-runner.ts',
  'v3014-text-inverted-rect-residual-projection.ts',
  'v3014-text-inverted-rect-residual-corpus.json',
  'v3014-text-inverted-rect-residual-oracle.json',
  'v3014-annotation-text-inverted-v1.pdf',
  'v3014-annotation-text-noap-v1.pdf',
  'v3014TextInvertedRectResidualCaseCount',
  'v3014TextInvertedRectResidualCorpusHash',
  'v3014TextInvertedRectResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind text inverted-rect residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 2-case') && claim.includes('text-inverted-rect residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('text-inverted-rect residual outside the frozen 2-case')
  )
) {
  failures.push(
    'text inverted-rect residual bounded claim and explicit nonclaims must remain documented'
  );
}

const remoteNamedDestResidualCaseCount = remoteNamedDestResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-remote-named-dest-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen remote named dest residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-remote-named-dest-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-remote-named-dest-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014RemoteNamedDestResidualCaseCount') ||
  !repositoryDifferential.includes('v3014RemoteNamedDestResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014RemoteNamedDestResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the remote named dest residual family'
  );
}
if (
  !remoteNamedDestResidualWorkflow.includes(
    `.caseCount == ${remoteNamedDestResidualCaseCount}`
  ) ||
  !remoteNamedDestResidualWorkflow.includes(
    `.passed == ${remoteNamedDestResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${remoteNamedDestResidualCaseCount}/${remoteNamedDestResidualCaseCount} remote named dest residual corpus`
  );
}
if (
  remoteNamedDestResidualCaseCount !== 3 ||
  remoteNamedDestResidualCorpus.envelope.fixtureCount !== 3 ||
  remoteNamedDestResidualCorpus.nonclaims.dropInFor3014 !== false ||
  remoteNamedDestResidualCorpus.nonclaims.publishFreeze !== true ||
  remoteNamedDestResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'remote named dest residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !remoteNamedDestResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_remote_named_dest_residual_result"'
  ) ||
  !remoteNamedDestResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 42'
  ) ||
  !remoteNamedDestResidualWorkflow.includes(
    '.providerProof.gotorNamedStringDest == true'
  ) ||
  !remoteNamedDestResidualWorkflow.includes(
    '.providerProof.gotorNamedNameDest == true'
  ) ||
  !remoteNamedDestResidualWorkflow.includes(
    '.providerProof.gotorExplicitDestControl == true'
  ) ||
  !remoteNamedDestResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !remoteNamedDestResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !remoteNamedDestResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'remote named dest residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-remote-named-dest-residual-differential.ts',
  'scripts/differential/capture-v3014-remote-named-dest-residual-oracle.ts',
  'v3014-remote-named-dest-residual-baseline-runner.ts',
  'v3014-remote-named-dest-residual-projection.ts',
  'v3014-remote-named-dest-residual-corpus.json',
  'v3014-remote-named-dest-residual-oracle.json',
  'v3014-annotation-gotor-named-string-v1.pdf',
  'v3014-annotation-gotor-named-name-v1.pdf',
  'v3014-annotation-gotor-v1.pdf',
  'v3014RemoteNamedDestResidualCaseCount',
  'v3014RemoteNamedDestResidualCorpusHash',
  'v3014RemoteNamedDestResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind remote named dest residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') && claim.includes('remote-named-dest residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('remote-named-dest residual outside the frozen 3-case')
  )
) {
  failures.push(
    'remote named dest residual bounded claim and explicit nonclaims must remain documented'
  );
}

const pageLabelsKidsResidualCaseCount = pageLabelsKidsResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-page-labels-kids-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen page labels kids residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-page-labels-kids-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-page-labels-kids-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014PageLabelsKidsResidualCaseCount') ||
  !repositoryDifferential.includes('v3014PageLabelsKidsResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014PageLabelsKidsResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the page labels kids residual family'
  );
}
if (
  !pageLabelsKidsResidualWorkflow.includes(
    `.caseCount == ${pageLabelsKidsResidualCaseCount}`
  ) ||
  !pageLabelsKidsResidualWorkflow.includes(
    `.passed == ${pageLabelsKidsResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${pageLabelsKidsResidualCaseCount}/${pageLabelsKidsResidualCaseCount} page labels kids residual corpus`
  );
}
if (
  pageLabelsKidsResidualCaseCount !== 3 ||
  pageLabelsKidsResidualCorpus.envelope.fixtureCount !== 3 ||
  pageLabelsKidsResidualCorpus.nonclaims.dropInFor3014 !== false ||
  pageLabelsKidsResidualCorpus.nonclaims.publishFreeze !== true ||
  pageLabelsKidsResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'page labels kids residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !pageLabelsKidsResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_page_labels_kids_residual_result"'
  ) ||
  !pageLabelsKidsResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 18'
  ) ||
  !pageLabelsKidsResidualWorkflow.includes(
    '.providerProof.pageLabelsKidsNumberTree == true'
  ) ||
  !pageLabelsKidsResidualWorkflow.includes(
    '.providerProof.pageLabelsMultiStyleControl == true'
  ) ||
  !pageLabelsKidsResidualWorkflow.includes(
    '.providerProof.pageLabelsAbsentControl == true'
  ) ||
  !pageLabelsKidsResidualWorkflow.includes(
    '.capabilityStatus.includePageLabels == "PARTIAL"'
  ) ||
  !pageLabelsKidsResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !pageLabelsKidsResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'page labels kids residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-page-labels-kids-residual-differential.ts',
  'scripts/differential/capture-v3014-page-labels-kids-residual-oracle.ts',
  'v3014-page-labels-kids-residual-baseline-runner.ts',
  'v3014-page-labels-kids-residual-projection.ts',
  'v3014-page-labels-kids-residual-corpus.json',
  'v3014-page-labels-kids-residual-oracle.json',
  'v3014-page-labels-kids-v1.pdf',
  'v3014-page-labels-multi-v1.pdf',
  'v3014-page-labels-none-v1.pdf',
  'v3014PageLabelsKidsResidualCaseCount',
  'v3014PageLabelsKidsResidualCorpusHash',
  'v3014PageLabelsKidsResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind page labels kids residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') && claim.includes('include_page_labels kids residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('include_page_labels kids residual outside the frozen 3-case')
  )
) {
  failures.push(
    'page labels kids residual bounded claim and explicit nonclaims must remain documented'
  );
}


const formButtonArrayResidualCaseCount = formButtonArrayResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-form-button-array-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen form button-array residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-form-button-array-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-form-button-array-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014FormButtonArrayResidualCaseCount') ||
  !repositoryDifferential.includes('v3014FormButtonArrayResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014FormButtonArrayResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the form button-array residual family'
  );
}
if (
  !formButtonArrayResidualWorkflow.includes(
    `.caseCount == ${formButtonArrayResidualCaseCount}`
  ) ||
  !formButtonArrayResidualWorkflow.includes(
    `.passed == ${formButtonArrayResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${formButtonArrayResidualCaseCount}/${formButtonArrayResidualCaseCount} form button-array residual corpus`
  );
}
if (
  formButtonArrayResidualCaseCount !== 2 ||
  formButtonArrayResidualCorpus.envelope.fixtureCount !== 2 ||
  formButtonArrayResidualCorpus.nonclaims.dropInFor3014 !== false ||
  formButtonArrayResidualCorpus.nonclaims.publishFreeze !== true ||
  formButtonArrayResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'form button-array residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !formButtonArrayResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_form_button_array_residual_result"'
  ) ||
  !formButtonArrayResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 68'
  ) ||
  !formButtonArrayResidualWorkflow.includes(
    '.providerProof.checkboxRadioPushbuttonArrayV == true'
  ) ||
  !formButtonArrayResidualWorkflow.includes(
    '.providerProof.plainStringButtonControl == true'
  ) ||
  !formButtonArrayResidualWorkflow.includes(
    '.providerProof.dvArrayFallbackValue == true'
  ) ||
  !formButtonArrayResidualWorkflow.includes(
    '.capabilityStatus.includeFormFields == "PARTIAL"'
  ) ||
  !formButtonArrayResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !formButtonArrayResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'form button-array residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-form-button-array-residual-differential.ts',
  'scripts/differential/capture-v3014-form-button-array-residual-oracle.ts',
  'v3014-form-button-array-residual-baseline-runner.ts',
  'v3014-form-button-array-residual-projection.ts',
  'v3014-form-button-array-residual-corpus.json',
  'v3014-form-button-array-residual-oracle.json',
  'v3014-form-button-array-v-v1.pdf',
  'v3014-form-button-array-dv-v1.pdf',
  'v3014FormButtonArrayResidualCaseCount',
  'v3014FormButtonArrayResidualCorpusHash',
  'v3014FormButtonArrayResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind form button-array residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 2-case') && claim.includes('form button-array residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('form button-array residual outside the frozen 2-case')
  )
) {
  failures.push(
    'form button-array residual bounded claim and explicit nonclaims must remain documented'
  );
}
const whyRustDocs = readFileSync(join(root, 'docs/performance/why-rust.md'), 'utf8');
if (
  !whyRustDocs.includes('button-array residual') ||
  !whyRustDocs.includes('Leaf-mutation count is frozen at 68')
) {
  failures.push('why-rust must document the form button-array residual and frozen leaf-mutation count');
}


const attachmentOddNamesResidualCaseCount = attachmentOddNamesResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-attachment-odd-names-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen attachment odd-names residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-attachment-odd-names-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-attachment-odd-names-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014AttachmentOddNamesResidualCaseCount') ||
  !repositoryDifferential.includes('v3014AttachmentOddNamesResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014AttachmentOddNamesResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the attachment odd-names residual family'
  );
}
if (
  !attachmentOddNamesResidualWorkflow.includes(
    `.caseCount == ${attachmentOddNamesResidualCaseCount}`
  ) ||
  !attachmentOddNamesResidualWorkflow.includes(
    `.passed == ${attachmentOddNamesResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${attachmentOddNamesResidualCaseCount}/${attachmentOddNamesResidualCaseCount} attachment odd-names residual corpus`
  );
}
if (
  attachmentOddNamesResidualCaseCount !== 2 ||
  attachmentOddNamesResidualCorpus.envelope.fixtureCount !== 2 ||
  attachmentOddNamesResidualCorpus.nonclaims.dropInFor3014 !== false ||
  attachmentOddNamesResidualCorpus.nonclaims.publishFreeze !== true ||
  attachmentOddNamesResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'attachment odd-names residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !attachmentOddNamesResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_attachment_odd_names_residual_result"'
  ) ||
  !attachmentOddNamesResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 15'
  ) ||
  !attachmentOddNamesResidualWorkflow.includes(
    '.providerProof.orphanOnlyOddNames == true'
  ) ||
  !attachmentOddNamesResidualWorkflow.includes(
    '.providerProof.pairPlusOrphanKeepsCompletePair == true'
  ) ||
  !attachmentOddNamesResidualWorkflow.includes(
    '.providerProof.trailingOrphanUnnamedNoSize == true'
  ) ||
  !attachmentOddNamesResidualWorkflow.includes(
    '.capabilityStatus.includeAttachments == "PARTIAL"'
  ) ||
  !attachmentOddNamesResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !attachmentOddNamesResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'attachment odd-names residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-attachment-odd-names-residual-differential.ts',
  'scripts/differential/capture-v3014-attachment-odd-names-residual-oracle.ts',
  'v3014-attachment-odd-names-residual-baseline-runner.ts',
  'v3014-attachment-odd-names-residual-projection.ts',
  'v3014-attachment-odd-names-residual-corpus.json',
  'v3014-attachment-odd-names-residual-oracle.json',
  'v3014-attachment-odd-names-v1.pdf',
  'v3014-attachment-odd-names-pair-v1.pdf',
  'v3014AttachmentOddNamesResidualCaseCount',
  'v3014AttachmentOddNamesResidualCorpusHash',
  'v3014AttachmentOddNamesResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind attachment odd-names residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 2-case') && claim.includes('attachment odd-names residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('attachment odd-names residual outside the frozen 2-case')
  )
) {
  failures.push(
    'attachment odd-names residual bounded claim and explicit nonclaims must remain documented'
  );
}
const whyRustAttachmentOdd = readFileSync(join(root, 'docs/performance/why-rust.md'), 'utf8');
if (
  !whyRustAttachmentOdd.includes('attachment odd-names residual') ||
  !whyRustAttachmentOdd.includes('Leaf-mutation count is frozen at 15')
) {
  failures.push(
    'why-rust must document the attachment odd-names residual and frozen leaf-mutation count'
  );
}


const formUtf16TextResidualCaseCount = formUtf16TextResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-form-utf16-text-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen form utf16-text residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-form-utf16-text-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-form-utf16-text-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014FormUtf16TextResidualCaseCount') ||
  !repositoryDifferential.includes('v3014FormUtf16TextResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014FormUtf16TextResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the form utf16-text residual family'
  );
}
if (
  !formUtf16TextResidualWorkflow.includes(
    `.caseCount == ${formUtf16TextResidualCaseCount}`
  ) ||
  !formUtf16TextResidualWorkflow.includes(
    `.passed == ${formUtf16TextResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${formUtf16TextResidualCaseCount}/${formUtf16TextResidualCaseCount} form utf16-text residual corpus`
  );
}
if (
  formUtf16TextResidualCaseCount !== 2 ||
  formUtf16TextResidualCorpus.envelope.fixtureCount !== 2 ||
  formUtf16TextResidualCorpus.nonclaims.dropInFor3014 !== false ||
  formUtf16TextResidualCorpus.nonclaims.publishFreeze !== true ||
  formUtf16TextResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'form utf16-text residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !formUtf16TextResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_form_utf16_text_residual_result"'
  ) ||
  !formUtf16TextResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 52'
  ) ||
  !formUtf16TextResidualWorkflow.includes(
    '.providerProof.utf16BeValidBom == true'
  ) ||
  !formUtf16TextResidualWorkflow.includes(
    '.providerProof.utf16BeOddLengthDropsTrailingByte == true'
  ) ||
  !formUtf16TextResidualWorkflow.includes(
    '.providerProof.utf8BomAndPdfDocEncodingControls == true'
  ) ||
  !formUtf16TextResidualWorkflow.includes(
    '.capabilityStatus.includeFormFields == "PARTIAL"'
  ) ||
  !formUtf16TextResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !formUtf16TextResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'form utf16-text residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-form-utf16-text-residual-differential.ts',
  'scripts/differential/capture-v3014-form-utf16-text-residual-oracle.ts',
  'v3014-form-utf16-text-residual-baseline-runner.ts',
  'v3014-form-utf16-text-residual-projection.ts',
  'v3014-form-utf16-text-residual-corpus.json',
  'v3014-form-utf16-text-residual-oracle.json',
  'v3014-form-utf16-odd-v1.pdf',
  'v3014-form-utf8-bom-v1.pdf',
  'v3014FormUtf16TextResidualCaseCount',
  'v3014FormUtf16TextResidualCorpusHash',
  'v3014FormUtf16TextResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind form utf16-text residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 2-case') && claim.includes('form utf16-text residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('form utf16-text residual outside the frozen 2-case')
  )
) {
  failures.push(
    'form utf16-text residual bounded claim and explicit nonclaims must remain documented'
  );
}
const whyRustUtf16 = readFileSync(join(root, 'docs/performance/why-rust.md'), 'utf8');
if (
  !whyRustUtf16.includes('form utf16-text residual') ||
  !whyRustUtf16.includes('Leaf-mutation count is frozen at 52')
) {
  failures.push(
    'why-rust must document the form utf16-text residual and frozen leaf-mutation count'
  );
}


const utf16TextResidualCaseCount = utf16TextResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes('bun run test:v3014-utf16-text-residual-differential')
) {
  failures.push(
    'rust parity workflow must execute the frozen utf16-text residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-utf16-text-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-utf16-text-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014Utf16TextResidualCaseCount') ||
  !repositoryDifferential.includes('v3014Utf16TextResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014Utf16TextResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the utf16-text residual family'
  );
}
if (
  !utf16TextResidualWorkflow.includes(`.caseCount == ${utf16TextResidualCaseCount}`) ||
  !utf16TextResidualWorkflow.includes(`.passed == ${utf16TextResidualCaseCount}`)
) {
  failures.push(
    `rust parity workflow must require the exact ${utf16TextResidualCaseCount}/${utf16TextResidualCaseCount} utf16-text residual corpus`
  );
}
if (
  utf16TextResidualCaseCount !== 3 ||
  utf16TextResidualCorpus.envelope.fixtureCount !== 3 ||
  utf16TextResidualCorpus.nonclaims.dropInFor3014 !== false ||
  utf16TextResidualCorpus.nonclaims.publishFreeze !== true ||
  utf16TextResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'utf16-text residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !utf16TextResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_utf16_text_residual_result"'
  ) ||
  !utf16TextResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 41'
  ) ||
  !utf16TextResidualWorkflow.includes('.providerProof.annotTextOddUtf16 == true') ||
  !utf16TextResidualWorkflow.includes('.providerProof.freeTextOddUtf16 == true') ||
  !utf16TextResidualWorkflow.includes(
    '.providerProof.catalogOutlineAndInfoOddUtf16 == true'
  ) ||
  !utf16TextResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !utf16TextResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !utf16TextResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'utf16-text residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-utf16-text-residual-differential.ts',
  'scripts/differential/capture-v3014-utf16-text-residual-oracle.ts',
  'v3014-utf16-text-residual-baseline-runner.ts',
  'v3014-utf16-text-residual-projection.ts',
  'v3014-utf16-text-residual-corpus.json',
  'v3014-utf16-text-residual-oracle.json',
  'v3014-annot-utf16-odd-v1.pdf',
  'v3014-freetext-utf16-odd-v1.pdf',
  'v3014-catalog-utf16-odd-v1.pdf',
  'v3014Utf16TextResidualCaseCount',
  'v3014Utf16TextResidualCorpusHash',
  'v3014Utf16TextResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind utf16-text residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) => claim.includes('exact 3-case') && claim.includes('utf16-text residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('utf16-text residual outside the frozen 3-case')
  )
) {
  failures.push(
    'utf16-text residual bounded claim and explicit nonclaims must remain documented'
  );
}
const whyRustUtf16Breadth = readFileSync(join(root, 'docs/performance/why-rust.md'), 'utf8');
if (
  !whyRustUtf16Breadth.includes('utf16-text residual') ||
  !whyRustUtf16Breadth.includes('Leaf-mutation count is frozen at 41')
) {
  failures.push(
    'why-rust must document the utf16-text residual and frozen leaf-mutation count'
  );
}


const textInvalidAsResidualCaseCount = textInvalidAsResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-text-invalid-as-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen text invalid-as residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-text-invalid-as-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-text-invalid-as-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014TextInvalidAsResidualCaseCount') ||
  !repositoryDifferential.includes('v3014TextInvalidAsResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014TextInvalidAsResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the text invalid-as residual family'
  );
}
if (
  !textInvalidAsResidualWorkflow.includes(
    `.caseCount == ${textInvalidAsResidualCaseCount}`
  ) ||
  !textInvalidAsResidualWorkflow.includes(
    `.passed == ${textInvalidAsResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${textInvalidAsResidualCaseCount}/${textInvalidAsResidualCaseCount} text invalid-as residual corpus`
  );
}
if (
  textInvalidAsResidualCaseCount !== 2 ||
  textInvalidAsResidualCorpus.envelope.fixtureCount !== 2 ||
  textInvalidAsResidualCorpus.nonclaims.dropInFor3014 !== false ||
  textInvalidAsResidualCorpus.nonclaims.publishFreeze !== true ||
  textInvalidAsResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'text invalid-as residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !textInvalidAsResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_text_invalid_as_residual_result"'
  ) ||
  !textInvalidAsResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 28'
  ) ||
  !textInvalidAsResidualWorkflow.includes(
    '.providerProof.invalidAsNameUsesIconBox == true'
  ) ||
  !textInvalidAsResidualWorkflow.includes(
    '.providerProof.asNonstreamUsesIconBox == true'
  ) ||
  !textInvalidAsResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !textInvalidAsResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !textInvalidAsResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'text invalid-as residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-text-invalid-as-residual-differential.ts',
  'scripts/differential/capture-v3014-text-invalid-as-residual-oracle.ts',
  'v3014-text-invalid-as-residual-baseline-runner.ts',
  'v3014-text-invalid-as-residual-projection.ts',
  'v3014-text-invalid-as-residual-corpus.json',
  'v3014-text-invalid-as-residual-oracle.json',
  'v3014-annotation-text-namedap-badas-v1.pdf',
  'v3014-annotation-text-namedap-as-nonstream-v1.pdf',
  'v3014TextInvalidAsResidualCaseCount',
  'v3014TextInvalidAsResidualCorpusHash',
  'v3014TextInvalidAsResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind text invalid-as residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 2-case') && claim.includes('text invalid-as residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('text invalid-as residual outside the frozen 2-case')
  )
) {
  failures.push(
    'text invalid-as residual bounded claim and explicit nonclaims must remain documented'
  );
}
const whyRustInvalidAs = readFileSync(join(root, 'docs/performance/why-rust.md'), 'utf8');
if (
  !whyRustInvalidAs.includes('text invalid-as residual') ||
  !whyRustInvalidAs.includes('Leaf-mutation count is frozen at 28')
) {
  failures.push(
    'why-rust must document the text invalid-as residual and frozen leaf-mutation count'
  );
}


const lineAnnotationResidualCaseCount = lineAnnotationResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-line-annotation-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen line annotation residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-line-annotation-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-line-annotation-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014LineAnnotationResidualCaseCount') ||
  !repositoryDifferential.includes('v3014LineAnnotationResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014LineAnnotationResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the line annotation residual family'
  );
}
if (
  !lineAnnotationResidualWorkflow.includes(
    `.caseCount == ${lineAnnotationResidualCaseCount}`
  ) ||
  !lineAnnotationResidualWorkflow.includes(
    `.passed == ${lineAnnotationResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${lineAnnotationResidualCaseCount}/${lineAnnotationResidualCaseCount} line annotation residual corpus`
  );
}
if (
  lineAnnotationResidualCaseCount !== 3 ||
  lineAnnotationResidualCorpus.envelope.fixtureCount !== 3 ||
  lineAnnotationResidualCorpus.nonclaims.dropInFor3014 !== false ||
  lineAnnotationResidualCorpus.nonclaims.publishFreeze !== true ||
  lineAnnotationResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'line annotation residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !lineAnnotationResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_line_annotation_residual_result"'
  ) ||
  !lineAnnotationResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 39'
  ) ||
  !lineAnnotationResidualWorkflow.includes(
    '.providerProof.defaultBorderExpand == true'
  ) ||
  !lineAnnotationResidualWorkflow.includes(
    '.providerProof.nonIntersectingRectUsesLBbox == true'
  ) ||
  !lineAnnotationResidualWorkflow.includes(
    '.providerProof.borderWidth2Expand == true'
  ) ||
  !lineAnnotationResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !lineAnnotationResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !lineAnnotationResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'line annotation residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-line-annotation-residual-differential.ts',
  'scripts/differential/capture-v3014-line-annotation-residual-oracle.ts',
  'v3014-line-annotation-residual-baseline-runner.ts',
  'v3014-line-annotation-residual-projection.ts',
  'v3014-line-annotation-residual-corpus.json',
  'v3014-line-annotation-residual-oracle.json',
  'v3014-annotation-line-default-v1.pdf',
  'v3014-annotation-line-l-bbox-v1.pdf',
  'v3014-annotation-line-border2-v1.pdf',
  'v3014LineAnnotationResidualCaseCount',
  'v3014LineAnnotationResidualCorpusHash',
  'v3014LineAnnotationResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind line annotation residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') && claim.includes('line annotation residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('line annotation residual outside the frozen 3-case')
  )
) {
  failures.push(
    'line annotation residual bounded claim and explicit nonclaims must remain documented'
  );
}
const whyRustLine = readFileSync(join(root, 'docs/performance/why-rust.md'), 'utf8');
if (
  !whyRustLine.includes('line annotation residual') ||
  !whyRustLine.includes('Leaf-mutation count is frozen at 39')
) {
  failures.push(
    'why-rust must document the line annotation residual and frozen leaf-mutation count'
  );
}

const polylinePolygonResidualCaseCount = polylinePolygonResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-polyline-polygon-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen polyline/polygon residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-polyline-polygon-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-polyline-polygon-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014PolylinePolygonResidualCaseCount') ||
  !repositoryDifferential.includes('v3014PolylinePolygonResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014PolylinePolygonResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the polyline/polygon residual family'
  );
}
if (
  !polylinePolygonResidualWorkflow.includes(
    `.caseCount == ${polylinePolygonResidualCaseCount}`
  ) ||
  !polylinePolygonResidualWorkflow.includes(
    `.passed == ${polylinePolygonResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${polylinePolygonResidualCaseCount}/${polylinePolygonResidualCaseCount} polyline/polygon residual corpus`
  );
}
if (
  polylinePolygonResidualCaseCount !== 3 ||
  polylinePolygonResidualCorpus.envelope.fixtureCount !== 3 ||
  polylinePolygonResidualCorpus.nonclaims.dropInFor3014 !== false ||
  polylinePolygonResidualCorpus.nonclaims.publishFreeze !== true ||
  polylinePolygonResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'polyline/polygon residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !polylinePolygonResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_polyline_polygon_residual_result"'
  ) ||
  !polylinePolygonResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 39'
  ) ||
  !polylinePolygonResidualWorkflow.includes(
    '.providerProof.polylineNonIntersectingUsesVerticesBbox == true'
  ) ||
  !polylinePolygonResidualWorkflow.includes(
    '.providerProof.polygonNonIntersectingUsesVerticesBbox == true'
  ) ||
  !polylinePolygonResidualWorkflow.includes(
    '.providerProof.borderWidth2VerticesBbox == true'
  ) ||
  !polylinePolygonResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !polylinePolygonResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !polylinePolygonResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'polyline/polygon residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-polyline-polygon-residual-differential.ts',
  'scripts/differential/capture-v3014-polyline-polygon-residual-oracle.ts',
  'v3014-polyline-polygon-residual-baseline-runner.ts',
  'v3014-polyline-polygon-residual-projection.ts',
  'v3014-polyline-polygon-residual-corpus.json',
  'v3014-polyline-polygon-residual-oracle.json',
  'v3014-annotation-polyline-l-bbox-v1.pdf',
  'v3014-annotation-polygon-l-bbox-v1.pdf',
  'v3014-annotation-polyline-border2-v1.pdf',
  'v3014PolylinePolygonResidualCaseCount',
  'v3014PolylinePolygonResidualCorpusHash',
  'v3014PolylinePolygonResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind polyline/polygon residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') && claim.includes('polyline/polygon residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('polyline/polygon residual outside the frozen 3-case')
  )
) {
  failures.push(
    'polyline/polygon residual bounded claim and explicit nonclaims must remain documented'
  );
}
const whyRustPolylinePolygon = readFileSync(join(root, 'docs/performance/why-rust.md'), 'utf8');
if (
  !whyRustPolylinePolygon.includes('polyline/polygon residual') ||
  !whyRustPolylinePolygon.includes('Leaf-mutation count is frozen at 39')
) {
  failures.push(
    'why-rust must document the polyline/polygon residual and frozen leaf-mutation count'
  );
}

const inkAnnotationResidualCaseCount = inkAnnotationResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-ink-annotation-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen ink annotation residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-ink-annotation-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-ink-annotation-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014InkAnnotationResidualCaseCount') ||
  !repositoryDifferential.includes('v3014InkAnnotationResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014InkAnnotationResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the ink annotation residual family'
  );
}
if (
  !inkAnnotationResidualWorkflow.includes(
    `.caseCount == ${inkAnnotationResidualCaseCount}`
  ) ||
  !inkAnnotationResidualWorkflow.includes(
    `.passed == ${inkAnnotationResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${inkAnnotationResidualCaseCount}/${inkAnnotationResidualCaseCount} ink annotation residual corpus`
  );
}
if (
  inkAnnotationResidualCaseCount !== 3 ||
  inkAnnotationResidualCorpus.envelope.fixtureCount !== 3 ||
  inkAnnotationResidualCorpus.nonclaims.dropInFor3014 !== false ||
  inkAnnotationResidualCorpus.nonclaims.publishFreeze !== true ||
  inkAnnotationResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'ink annotation residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !inkAnnotationResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_ink_annotation_residual_result"'
  ) ||
  !inkAnnotationResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 39'
  ) ||
  !inkAnnotationResidualWorkflow.includes(
    '.providerProof.inkNonIntersectingUsesInkListBbox == true'
  ) ||
  !inkAnnotationResidualWorkflow.includes(
    '.providerProof.inkMultiStrokeUsesInkListBbox == true'
  ) ||
  !inkAnnotationResidualWorkflow.includes(
    '.providerProof.borderWidth2InkListBbox == true'
  ) ||
  !inkAnnotationResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !inkAnnotationResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !inkAnnotationResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'ink annotation residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-ink-annotation-residual-differential.ts',
  'scripts/differential/capture-v3014-ink-annotation-residual-oracle.ts',
  'v3014-ink-annotation-residual-baseline-runner.ts',
  'v3014-ink-annotation-residual-projection.ts',
  'v3014-ink-annotation-residual-corpus.json',
  'v3014-ink-annotation-residual-oracle.json',
  'v3014-annotation-ink-l-bbox-v1.pdf',
  'v3014-annotation-ink-multistroke-v1.pdf',
  'v3014-annotation-ink-border2-v1.pdf',
  'v3014InkAnnotationResidualCaseCount',
  'v3014InkAnnotationResidualCorpusHash',
  'v3014InkAnnotationResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind ink annotation residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') && claim.includes('ink annotation residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('ink annotation residual outside the frozen 3-case')
  )
) {
  failures.push(
    'ink annotation residual bounded claim and explicit nonclaims must remain documented'
  );
}
const whyRustInk = readFileSync(join(root, 'docs/performance/why-rust.md'), 'utf8');
if (
  !whyRustInk.includes('ink annotation residual') ||
  !whyRustInk.includes('Leaf-mutation count is frozen at 39')
) {
  failures.push(
    'why-rust must document the ink annotation residual and frozen leaf-mutation count'
  );
}

const borderWidthClampResidualCaseCount = borderWidthClampResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-border-width-clamp-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen border-width clamp residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-border-width-clamp-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-border-width-clamp-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014BorderWidthClampResidualCaseCount') ||
  !repositoryDifferential.includes('v3014BorderWidthClampResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014BorderWidthClampResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the border-width clamp residual family'
  );
}
if (
  !borderWidthClampResidualWorkflow.includes(
    `.caseCount == ${borderWidthClampResidualCaseCount}`
  ) ||
  !borderWidthClampResidualWorkflow.includes(
    `.passed == ${borderWidthClampResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${borderWidthClampResidualCaseCount}/${borderWidthClampResidualCaseCount} border-width clamp residual corpus`
  );
}
if (
  borderWidthClampResidualCaseCount !== 3 ||
  borderWidthClampResidualCorpus.envelope.fixtureCount !== 3 ||
  borderWidthClampResidualCorpus.nonclaims.dropInFor3014 !== false ||
  borderWidthClampResidualCorpus.nonclaims.publishFreeze !== true ||
  borderWidthClampResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'border-width clamp residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !borderWidthClampResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_border_width_clamp_residual_result"'
  ) ||
  !borderWidthClampResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 39'
  ) ||
  !borderWidthClampResidualWorkflow.includes(
    '.providerProof.polylineTinyRectClampsBorderWidth == true'
  ) ||
  !borderWidthClampResidualWorkflow.includes(
    '.providerProof.lineTinyRectClampsBorderWidth == true'
  ) ||
  !borderWidthClampResidualWorkflow.includes(
    '.providerProof.inkTinyRectClampsBorderWidth == true'
  ) ||
  !borderWidthClampResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !borderWidthClampResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !borderWidthClampResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'border-width clamp residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-border-width-clamp-residual-differential.ts',
  'scripts/differential/capture-v3014-border-width-clamp-residual-oracle.ts',
  'v3014-border-width-clamp-residual-baseline-runner.ts',
  'v3014-border-width-clamp-residual-projection.ts',
  'v3014-border-width-clamp-residual-corpus.json',
  'v3014-border-width-clamp-residual-oracle.json',
  'v3014-annotation-polyline-clamp-w2-v1.pdf',
  'v3014-annotation-line-clamp-w2-v1.pdf',
  'v3014-annotation-ink-clamp-w2-v1.pdf',
  'v3014BorderWidthClampResidualCaseCount',
  'v3014BorderWidthClampResidualCorpusHash',
  'v3014BorderWidthClampResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind border-width clamp residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') && claim.includes('border-width clamp residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('border-width clamp residual outside the frozen 3-case')
  )
) {
  failures.push(
    'border-width clamp residual bounded claim and explicit nonclaims must remain documented'
  );
}
const whyRustClamp = readFileSync(join(root, 'docs/performance/why-rust.md'), 'utf8');
if (
  !whyRustClamp.includes('border-width clamp residual') ||
  !whyRustClamp.includes('Leaf-mutation count is frozen at 39')
) {
  failures.push(
    'why-rust must document the border-width clamp residual and frozen leaf-mutation count'
  );
}

const borderArrayWidthResidualCaseCount = borderArrayWidthResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-border-array-width-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen border-array width residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-border-array-width-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-border-array-width-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014BorderArrayWidthResidualCaseCount') ||
  !repositoryDifferential.includes('v3014BorderArrayWidthResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014BorderArrayWidthResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the border-array width residual family'
  );
}
if (
  !borderArrayWidthResidualWorkflow.includes(
    `.caseCount == ${borderArrayWidthResidualCaseCount}`
  ) ||
  !borderArrayWidthResidualWorkflow.includes(
    `.passed == ${borderArrayWidthResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${borderArrayWidthResidualCaseCount}/${borderArrayWidthResidualCaseCount} border-array width residual corpus`
  );
}
if (
  borderArrayWidthResidualCaseCount !== 3 ||
  borderArrayWidthResidualCorpus.envelope.fixtureCount !== 3 ||
  borderArrayWidthResidualCorpus.nonclaims.dropInFor3014 !== false ||
  borderArrayWidthResidualCorpus.nonclaims.publishFreeze !== true ||
  borderArrayWidthResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'border-array width residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !borderArrayWidthResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_border_array_width_residual_result"'
  ) ||
  !borderArrayWidthResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 39'
  ) ||
  !borderArrayWidthResidualWorkflow.includes(
    '.providerProof.polylineBorderArrayWidth2 == true'
  ) ||
  !borderArrayWidthResidualWorkflow.includes(
    '.providerProof.lineBorderArrayWidth2 == true'
  ) ||
  !borderArrayWidthResidualWorkflow.includes(
    '.providerProof.inkBorderArrayWidth3 == true'
  ) ||
  !borderArrayWidthResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !borderArrayWidthResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !borderArrayWidthResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'border-array width residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-border-array-width-residual-differential.ts',
  'scripts/differential/capture-v3014-border-array-width-residual-oracle.ts',
  'v3014-border-array-width-residual-baseline-runner.ts',
  'v3014-border-array-width-residual-projection.ts',
  'v3014-border-array-width-residual-corpus.json',
  'v3014-border-array-width-residual-oracle.json',
  'v3014-annotation-polyline-border-array-w2-v1.pdf',
  'v3014-annotation-line-border-array-w2-v1.pdf',
  'v3014-annotation-ink-border-array-w3-v1.pdf',
  'v3014BorderArrayWidthResidualCaseCount',
  'v3014BorderArrayWidthResidualCorpusHash',
  'v3014BorderArrayWidthResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind border-array width residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') && claim.includes('border-array width residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('border-array width residual outside the frozen 3-case')
  )
) {
  failures.push(
    'border-array width residual bounded claim and explicit nonclaims must remain documented'
  );
}
const whyRustBorderArray = readFileSync(join(root, 'docs/performance/why-rust.md'), 'utf8');
if (
  !whyRustBorderArray.includes('border-array width residual') ||
  !whyRustBorderArray.includes('Leaf-mutation count is frozen at 39')
) {
  failures.push(
    'why-rust must document the border-array width residual and frozen leaf-mutation count'
  );
}

const borderBsPreferenceResidualCaseCount = borderBsPreferenceResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-border-bs-preference-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen border BS preference residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-border-bs-preference-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-border-bs-preference-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014BorderBsPreferenceResidualCaseCount') ||
  !repositoryDifferential.includes('v3014BorderBsPreferenceResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014BorderBsPreferenceResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the border BS preference residual family'
  );
}
if (
  !borderBsPreferenceResidualWorkflow.includes(
    `.caseCount == ${borderBsPreferenceResidualCaseCount}`
  ) ||
  !borderBsPreferenceResidualWorkflow.includes(
    `.passed == ${borderBsPreferenceResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${borderBsPreferenceResidualCaseCount}/${borderBsPreferenceResidualCaseCount} border BS preference residual corpus`
  );
}
if (
  borderBsPreferenceResidualCaseCount !== 3 ||
  borderBsPreferenceResidualCorpus.envelope.fixtureCount !== 3 ||
  borderBsPreferenceResidualCorpus.nonclaims.dropInFor3014 !== false ||
  borderBsPreferenceResidualCorpus.nonclaims.publishFreeze !== true ||
  borderBsPreferenceResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'border BS preference residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !borderBsPreferenceResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_border_bs_preference_residual_result"'
  ) ||
  !borderBsPreferenceResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 39'
  ) ||
  !borderBsPreferenceResidualWorkflow.includes(
    '.providerProof.polylineBorderBsPreferenceW2 == true'
  ) ||
  !borderBsPreferenceResidualWorkflow.includes(
    '.providerProof.lineBorderBsPreferenceW2 == true'
  ) ||
  !borderBsPreferenceResidualWorkflow.includes(
    '.providerProof.inkBorderBsPreferenceW3 == true'
  ) ||
  !borderBsPreferenceResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !borderBsPreferenceResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !borderBsPreferenceResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'border BS preference residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-border-bs-preference-residual-differential.ts',
  'scripts/differential/capture-v3014-border-bs-preference-residual-oracle.ts',
  'v3014-border-bs-preference-residual-baseline-runner.ts',
  'v3014-border-bs-preference-residual-projection.ts',
  'v3014-border-bs-preference-residual-corpus.json',
  'v3014-border-bs-preference-residual-oracle.json',
  'v3014-annotation-polyline-border-bs-pref-v1.pdf',
  'v3014-annotation-line-border-bs-pref-v1.pdf',
  'v3014-annotation-ink-border-bs-pref-v1.pdf',
  'v3014BorderBsPreferenceResidualCaseCount',
  'v3014BorderBsPreferenceResidualCorpusHash',
  'v3014BorderBsPreferenceResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind border BS preference residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') && claim.includes('border BS preference residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('border BS preference residual outside the frozen 3-case')
  )
) {
  failures.push(
    'border BS preference residual bounded claim and explicit nonclaims must remain documented'
  );
}
const whyRustBorderBsPreference = readFileSync(join(root, 'docs/performance/why-rust.md'), 'utf8');
if (
  !whyRustBorderBsPreference.includes('border BS preference residual') ||
  !whyRustBorderBsPreference.includes('Leaf-mutation count is frozen at 39')
) {
  failures.push(
    'why-rust must document the border BS preference residual and frozen leaf-mutation count'
  );
}

const borderBsNondictResidualCaseCount = borderBsNondictResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-border-bs-nondict-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen border BS nondict residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-border-bs-nondict-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-border-bs-nondict-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014BorderBsNondictResidualCaseCount') ||
  !repositoryDifferential.includes('v3014BorderBsNondictResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014BorderBsNondictResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the border BS nondict residual family'
  );
}
if (
  !borderBsNondictResidualWorkflow.includes(
    `.caseCount == ${borderBsNondictResidualCaseCount}`
  ) ||
  !borderBsNondictResidualWorkflow.includes(
    `.passed == ${borderBsNondictResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${borderBsNondictResidualCaseCount}/${borderBsNondictResidualCaseCount} border BS nondict residual corpus`
  );
}
if (
  borderBsNondictResidualCaseCount !== 3 ||
  borderBsNondictResidualCorpus.envelope.fixtureCount !== 3 ||
  borderBsNondictResidualCorpus.nonclaims.dropInFor3014 !== false ||
  borderBsNondictResidualCorpus.nonclaims.publishFreeze !== true ||
  borderBsNondictResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'border BS nondict residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !borderBsNondictResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_border_bs_nondict_residual_result"'
  ) ||
  !borderBsNondictResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 39'
  ) ||
  !borderBsNondictResidualWorkflow.includes(
    '.providerProof.polylineBorderBsNondictW1 == true'
  ) ||
  !borderBsNondictResidualWorkflow.includes(
    '.providerProof.lineBorderBsNondictW1 == true'
  ) ||
  !borderBsNondictResidualWorkflow.includes(
    '.providerProof.inkBorderBsNondictW1 == true'
  ) ||
  !borderBsNondictResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !borderBsNondictResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !borderBsNondictResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'border BS nondict residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-border-bs-nondict-residual-differential.ts',
  'scripts/differential/capture-v3014-border-bs-nondict-residual-oracle.ts',
  'v3014-border-bs-nondict-residual-baseline-runner.ts',
  'v3014-border-bs-nondict-residual-projection.ts',
  'v3014-border-bs-nondict-residual-corpus.json',
  'v3014-border-bs-nondict-residual-oracle.json',
  'v3014-annotation-polyline-border-bs-null-v1.pdf',
  'v3014-annotation-line-border-bs-null-v1.pdf',
  'v3014-annotation-ink-border-bs-null-v1.pdf',
  'v3014BorderBsNondictResidualCaseCount',
  'v3014BorderBsNondictResidualCorpusHash',
  'v3014BorderBsNondictResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind border BS nondict residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') && claim.includes('border BS nondict residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('border BS nondict residual outside the frozen 3-case')
  )
) {
  failures.push(
    'border BS nondict residual bounded claim and explicit nonclaims must remain documented'
  );
}
const whyRustBorderBsNondict = readFileSync(join(root, 'docs/performance/why-rust.md'), 'utf8');
if (
  !whyRustBorderBsNondict.includes('border BS nondict residual') ||
  !whyRustBorderBsNondict.includes('Leaf-mutation count is frozen at 39')
) {
  failures.push(
    'why-rust must document the border BS nondict residual and frozen leaf-mutation count'
  );
}

const borderArrayShortResidualCaseCount = borderArrayShortResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-border-array-short-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen border array short residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-border-array-short-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-border-array-short-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014BorderArrayShortResidualCaseCount') ||
  !repositoryDifferential.includes('v3014BorderArrayShortResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014BorderArrayShortResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the border array short residual family'
  );
}
if (
  !borderArrayShortResidualWorkflow.includes(
    `.caseCount == ${borderArrayShortResidualCaseCount}`
  ) ||
  !borderArrayShortResidualWorkflow.includes(
    `.passed == ${borderArrayShortResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${borderArrayShortResidualCaseCount}/${borderArrayShortResidualCaseCount} border array short residual corpus`
  );
}
if (
  borderArrayShortResidualCaseCount !== 3 ||
  borderArrayShortResidualCorpus.envelope.fixtureCount !== 3 ||
  borderArrayShortResidualCorpus.nonclaims.dropInFor3014 !== false ||
  borderArrayShortResidualCorpus.nonclaims.publishFreeze !== true ||
  borderArrayShortResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'border array short residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !borderArrayShortResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_border_array_short_residual_result"'
  ) ||
  !borderArrayShortResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 39'
  ) ||
  !borderArrayShortResidualWorkflow.includes(
    '.providerProof.polylineBorderArrayShortW1 == true'
  ) ||
  !borderArrayShortResidualWorkflow.includes(
    '.providerProof.lineBorderArrayEmptyW1 == true'
  ) ||
  !borderArrayShortResidualWorkflow.includes(
    '.providerProof.inkBorderArrayShortW1 == true'
  ) ||
  !borderArrayShortResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !borderArrayShortResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !borderArrayShortResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'border array short residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-border-array-short-residual-differential.ts',
  'scripts/differential/capture-v3014-border-array-short-residual-oracle.ts',
  'v3014-border-array-short-residual-baseline-runner.ts',
  'v3014-border-array-short-residual-projection.ts',
  'v3014-border-array-short-residual-corpus.json',
  'v3014-border-array-short-residual-oracle.json',
  'v3014-annotation-polyline-border-short-v1.pdf',
  'v3014-annotation-line-border-empty-v1.pdf',
  'v3014-annotation-ink-border-short-v1.pdf',
  'v3014BorderArrayShortResidualCaseCount',
  'v3014BorderArrayShortResidualCorpusHash',
  'v3014BorderArrayShortResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind border array short residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') && claim.includes('border array short residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('border array short residual outside the frozen 3-case')
  )
) {
  failures.push(
    'border array short residual bounded claim and explicit nonclaims must remain documented'
  );
}
const whyRustBorderArrayShort = readFileSync(join(root, 'docs/performance/why-rust.md'), 'utf8');
if (
  !whyRustBorderArrayShort.includes('border array short residual') ||
  !whyRustBorderArrayShort.includes('Leaf-mutation count is frozen at 39')
) {
  failures.push(
    'why-rust must document the border array short residual and frozen leaf-mutation count'
  );
}

const borderBsWrongTypeResidualCaseCount = borderBsWrongTypeResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-border-bs-wrong-type-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen border BS wrong-type residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-border-bs-wrong-type-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-border-bs-wrong-type-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014BorderBsWrongTypeResidualCaseCount') ||
  !repositoryDifferential.includes('v3014BorderBsWrongTypeResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014BorderBsWrongTypeResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the border BS wrong-type residual family'
  );
}
if (
  !borderBsWrongTypeResidualWorkflow.includes(
    `.caseCount == ${borderBsWrongTypeResidualCaseCount}`
  ) ||
  !borderBsWrongTypeResidualWorkflow.includes(
    `.passed == ${borderBsWrongTypeResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${borderBsWrongTypeResidualCaseCount}/${borderBsWrongTypeResidualCaseCount} border BS wrong-type residual corpus`
  );
}
if (
  borderBsWrongTypeResidualCaseCount !== 3 ||
  borderBsWrongTypeResidualCorpus.envelope.fixtureCount !== 3 ||
  borderBsWrongTypeResidualCorpus.nonclaims.dropInFor3014 !== false ||
  borderBsWrongTypeResidualCorpus.nonclaims.publishFreeze !== true ||
  borderBsWrongTypeResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'border BS wrong-type residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !borderBsWrongTypeResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_border_bs_wrong_type_residual_result"'
  ) ||
  !borderBsWrongTypeResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 39'
  ) ||
  !borderBsWrongTypeResidualWorkflow.includes(
    '.providerProof.polylineBorderBsWrongTypeW1 == true'
  ) ||
  !borderBsWrongTypeResidualWorkflow.includes(
    '.providerProof.lineBorderBsWrongTypeW1 == true'
  ) ||
  !borderBsWrongTypeResidualWorkflow.includes(
    '.providerProof.inkBorderBsWrongTypeW1 == true'
  ) ||
  !borderBsWrongTypeResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !borderBsWrongTypeResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !borderBsWrongTypeResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'border BS wrong-type residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-border-bs-wrong-type-residual-differential.ts',
  'scripts/differential/capture-v3014-border-bs-wrong-type-residual-oracle.ts',
  'v3014-border-bs-wrong-type-residual-baseline-runner.ts',
  'v3014-border-bs-wrong-type-residual-projection.ts',
  'v3014-border-bs-wrong-type-residual-corpus.json',
  'v3014-border-bs-wrong-type-residual-oracle.json',
  'v3014-annotation-polyline-border-bs-wrong-type-v1.pdf',
  'v3014-annotation-line-border-bs-wrong-type-v1.pdf',
  'v3014-annotation-ink-border-bs-wrong-type-v1.pdf',
  'v3014BorderBsWrongTypeResidualCaseCount',
  'v3014BorderBsWrongTypeResidualCorpusHash',
  'v3014BorderBsWrongTypeResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind border BS wrong-type residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') && claim.includes('border BS wrong-type residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('border BS wrong-type residual outside the frozen 3-case')
  )
) {
  failures.push(
    'border BS wrong-type residual bounded claim and explicit nonclaims must remain documented'
  );
}
const whyRustBorderBsWrongType = readFileSync(join(root, 'docs/performance/why-rust.md'), 'utf8');
if (
  !whyRustBorderBsWrongType.includes('border BS wrong-type residual') ||
  !whyRustBorderBsWrongType.includes('Leaf-mutation count is frozen at 39')
) {
  failures.push(
    'why-rust must document the border BS wrong-type residual and frozen leaf-mutation count'
  );
}

const borderZeroSizeClampBypassResidualCaseCount = borderZeroSizeClampBypassResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-border-zero-size-clamp-bypass-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen border zero-size clamp-bypass residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-border-zero-size-clamp-bypass-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-border-zero-size-clamp-bypass-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014BorderZeroSizeClampBypassResidualCaseCount') ||
  !repositoryDifferential.includes('v3014BorderZeroSizeClampBypassResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014BorderZeroSizeClampBypassResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the border zero-size clamp-bypass residual family'
  );
}
if (
  !borderZeroSizeClampBypassResidualWorkflow.includes(
    `.caseCount == ${borderZeroSizeClampBypassResidualCaseCount}`
  ) ||
  !borderZeroSizeClampBypassResidualWorkflow.includes(
    `.passed == ${borderZeroSizeClampBypassResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${borderZeroSizeClampBypassResidualCaseCount}/${borderZeroSizeClampBypassResidualCaseCount} border zero-size clamp-bypass residual corpus`
  );
}
if (
  borderZeroSizeClampBypassResidualCaseCount !== 3 ||
  borderZeroSizeClampBypassResidualCorpus.envelope.fixtureCount !== 3 ||
  borderZeroSizeClampBypassResidualCorpus.nonclaims.dropInFor3014 !== false ||
  borderZeroSizeClampBypassResidualCorpus.nonclaims.publishFreeze !== true ||
  borderZeroSizeClampBypassResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'border zero-size clamp-bypass residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !borderZeroSizeClampBypassResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_border_zero_size_clamp_bypass_residual_result"'
  ) ||
  !borderZeroSizeClampBypassResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 39'
  ) ||
  !borderZeroSizeClampBypassResidualWorkflow.includes(
    '.providerProof.polylineZeroHeightClampBypassW2 == true'
  ) ||
  !borderZeroSizeClampBypassResidualWorkflow.includes(
    '.providerProof.lineZeroHeightClampBypassW2 == true'
  ) ||
  !borderZeroSizeClampBypassResidualWorkflow.includes(
    '.providerProof.inkZeroWidthClampBypassW2 == true'
  ) ||
  !borderZeroSizeClampBypassResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !borderZeroSizeClampBypassResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !borderZeroSizeClampBypassResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'border zero-size clamp-bypass residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-border-zero-size-clamp-bypass-residual-differential.ts',
  'scripts/differential/capture-v3014-border-zero-size-clamp-bypass-residual-oracle.ts',
  'v3014-border-zero-size-clamp-bypass-residual-baseline-runner.ts',
  'v3014-border-zero-size-clamp-bypass-residual-projection.ts',
  'v3014-border-zero-size-clamp-bypass-residual-corpus.json',
  'v3014-border-zero-size-clamp-bypass-residual-oracle.json',
  'v3014-annotation-polyline-zero-h-w2-v1.pdf',
  'v3014-annotation-line-zero-h-w2-v1.pdf',
  'v3014-annotation-ink-zero-w-w2-v1.pdf',
  'v3014BorderZeroSizeClampBypassResidualCaseCount',
  'v3014BorderZeroSizeClampBypassResidualCorpusHash',
  'v3014BorderZeroSizeClampBypassResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind border zero-size clamp-bypass residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') && claim.includes('zero-size clamp-bypass residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('zero-size clamp-bypass residual outside the frozen 3-case')
  )
) {
  failures.push(
    'border zero-size clamp-bypass residual bounded claim and explicit nonclaims must remain documented'
  );
}
const whyRustBorderZeroSizeClampBypass = readFileSync(join(root, 'docs/performance/why-rust.md'), 'utf8');
if (
  !whyRustBorderZeroSizeClampBypass.includes('zero-size clamp-bypass residual') ||
  !whyRustBorderZeroSizeClampBypass.includes('Leaf-mutation count is frozen at 39')
) {
  failures.push(
    'why-rust must document the border zero-size clamp-bypass residual and frozen leaf-mutation count'
  );
}

const annotationAppearanceBboxResidualCaseCount = annotationAppearanceBboxResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-annotation-appearance-bbox-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen annotation appearance bbox residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-annotation-appearance-bbox-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-annotation-appearance-bbox-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014AnnotationAppearanceBboxResidualCaseCount') ||
  !repositoryDifferential.includes('v3014AnnotationAppearanceBboxResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014AnnotationAppearanceBboxResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the annotation appearance bbox residual family'
  );
}
if (
  !annotationAppearanceBboxResidualWorkflow.includes(
    `.caseCount == ${annotationAppearanceBboxResidualCaseCount}`
  ) ||
  !annotationAppearanceBboxResidualWorkflow.includes(
    `.passed == ${annotationAppearanceBboxResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${annotationAppearanceBboxResidualCaseCount}/${annotationAppearanceBboxResidualCaseCount} annotation appearance bbox residual corpus`
  );
}
if (
  annotationAppearanceBboxResidualCaseCount !== 3 ||
  annotationAppearanceBboxResidualCorpus.envelope.fixtureCount !== 3 ||
  annotationAppearanceBboxResidualCorpus.nonclaims.dropInFor3014 !== false ||
  annotationAppearanceBboxResidualCorpus.nonclaims.publishFreeze !== true ||
  annotationAppearanceBboxResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'annotation appearance bbox residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !annotationAppearanceBboxResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_annotation_appearance_bbox_residual_result"'
  ) ||
  !annotationAppearanceBboxResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 39'
  ) ||
  !annotationAppearanceBboxResidualWorkflow.includes(
    '.providerProof.polylineAppearanceKeepsRawRect == true'
  ) ||
  !annotationAppearanceBboxResidualWorkflow.includes(
    '.providerProof.lineAppearanceKeepsRawRect == true'
  ) ||
  !annotationAppearanceBboxResidualWorkflow.includes(
    '.providerProof.inkAppearanceKeepsRawRect == true'
  ) ||
  !annotationAppearanceBboxResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !annotationAppearanceBboxResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !annotationAppearanceBboxResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'annotation appearance bbox residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-annotation-appearance-bbox-residual-differential.ts',
  'scripts/differential/capture-v3014-annotation-appearance-bbox-residual-oracle.ts',
  'v3014-annotation-appearance-bbox-residual-baseline-runner.ts',
  'v3014-annotation-appearance-bbox-residual-projection.ts',
  'v3014-annotation-appearance-bbox-residual-corpus.json',
  'v3014-annotation-appearance-bbox-residual-oracle.json',
  'v3014-annotation-line-ap-bbox-v1.pdf',
  'v3014-annotation-polyline-ap-bbox-v1.pdf',
  'v3014-annotation-ink-ap-bbox-v1.pdf',
  'v3014AnnotationAppearanceBboxResidualCaseCount',
  'v3014AnnotationAppearanceBboxResidualCorpusHash',
  'v3014AnnotationAppearanceBboxResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind annotation appearance bbox residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') && claim.includes('appearance bbox residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('appearance bbox residual outside the frozen 3-case')
  )
) {
  failures.push(
    'annotation appearance bbox residual bounded claim and explicit nonclaims must remain documented'
  );
}
const whyRustAnnotationAppearanceBbox = readFileSync(join(root, 'docs/performance/why-rust.md'), 'utf8');
if (
  !whyRustAnnotationAppearanceBbox.includes('appearance bbox residual') ||
  !whyRustAnnotationAppearanceBbox.includes('Leaf-mutation count is frozen at 39')
) {
  failures.push(
    'why-rust must document the annotation appearance bbox residual and frozen leaf-mutation count'
  );
}

const annotationApNonstreamResidualCaseCount = annotationApNonstreamResidualCorpus.cases.length;
if (
  !differentialWorkflow.includes(
    'bun run test:v3014-annotation-ap-nonstream-residual-differential'
  )
) {
  failures.push(
    'rust parity workflow must execute the frozen annotation AP non-stream residual differential'
  );
}
if (
  !repositoryDifferential.includes(
    'scripts/differential/check-v3014-annotation-ap-nonstream-residual-differential.ts'
  ) ||
  !repositoryDifferential.includes(
    'scripts/differential/capture-v3014-annotation-ap-nonstream-residual-oracle.ts'
  ) ||
  !repositoryDifferential.includes('v3014AnnotationApNonstreamResidualCaseCount') ||
  !repositoryDifferential.includes('v3014AnnotationApNonstreamResidualCorpusHash') ||
  !repositoryDifferential.includes('v3014AnnotationApNonstreamResidualOracleHash')
) {
  failures.push(
    'repository differential artifact must bind the annotation AP non-stream residual family'
  );
}
if (
  !annotationApNonstreamResidualWorkflow.includes(
    `.caseCount == ${annotationApNonstreamResidualCaseCount}`
  ) ||
  !annotationApNonstreamResidualWorkflow.includes(
    `.passed == ${annotationApNonstreamResidualCaseCount}`
  )
) {
  failures.push(
    `rust parity workflow must require the exact ${annotationApNonstreamResidualCaseCount}/${annotationApNonstreamResidualCaseCount} annotation AP non-stream residual corpus`
  );
}
if (
  annotationApNonstreamResidualCaseCount !== 3 ||
  annotationApNonstreamResidualCorpus.envelope.fixtureCount !== 3 ||
  annotationApNonstreamResidualCorpus.nonclaims.dropInFor3014 !== false ||
  annotationApNonstreamResidualCorpus.nonclaims.publishFreeze !== true ||
  annotationApNonstreamResidualCorpus.nonclaims.wholeProductParity !== false
) {
  failures.push(
    'annotation AP non-stream residual corpus envelope and product-truth nonclaims must remain frozen'
  );
}
if (
  !annotationApNonstreamResidualWorkflow.includes(
    '.profile == "pdf_reader_v3014_annotation_ap_nonstream_residual_result"'
  ) ||
  !annotationApNonstreamResidualWorkflow.includes(
    '.mutationSensitive.leafMutationCount == 39'
  ) ||
  !annotationApNonstreamResidualWorkflow.includes(
    '.providerProof.lineApNNullExpandsGeometry == true'
  ) ||
  !annotationApNonstreamResidualWorkflow.includes(
    '.providerProof.polylineApNNameExpandsGeometry == true'
  ) ||
  !annotationApNonstreamResidualWorkflow.includes(
    '.providerProof.inkApNNullExpandsGeometry == true'
  ) ||
  !annotationApNonstreamResidualWorkflow.includes(
    '.capabilityStatus.includeAnnotations == "PARTIAL"'
  ) ||
  !annotationApNonstreamResidualWorkflow.includes('.productTruth.dropInFor3014 == false') ||
  !annotationApNonstreamResidualWorkflow.includes('.productTruth.publishFreeze == true')
) {
  failures.push(
    'annotation AP non-stream residual workflow must bind mutation, provider, capability, and product-truth proof'
  );
}
for (const required of [
  'scripts/differential/check-v3014-annotation-ap-nonstream-residual-differential.ts',
  'scripts/differential/capture-v3014-annotation-ap-nonstream-residual-oracle.ts',
  'v3014-annotation-ap-nonstream-residual-baseline-runner.ts',
  'v3014-annotation-ap-nonstream-residual-projection.ts',
  'v3014-annotation-ap-nonstream-residual-corpus.json',
  'v3014-annotation-ap-nonstream-residual-oracle.json',
  'v3014-annotation-line-ap-n-null-v1.pdf',
  'v3014-annotation-polyline-ap-n-name-v1.pdf',
  'v3014-annotation-ink-ap-n-null-v1.pdf',
  'v3014AnnotationApNonstreamResidualCaseCount',
  'v3014AnnotationApNonstreamResidualCorpusHash',
  'v3014AnnotationApNonstreamResidualOracleHash',
]) {
  if (!repositoryDifferential.includes(required)) {
    failures.push(
      `repository differential artifact must bind annotation AP non-stream residual family member: ${required}`
    );
  }
}
if (
  !matrix.claimedForDifferential.some(
    (claim) =>
      claim.includes('exact 3-case') && claim.includes('AP non-stream residual')
  ) ||
  !matrix.explicitlyNotClaimed.some((claim) =>
    claim.includes('AP non-stream residual outside the frozen 3-case')
  )
) {
  failures.push(
    'annotation AP non-stream residual bounded claim and explicit nonclaims must remain documented'
  );
}
const whyRustAnnotationApNonstream = readFileSync(join(root, 'docs/performance/why-rust.md'), 'utf8');
if (
  !whyRustAnnotationApNonstream.includes('AP non-stream residual') ||
  !whyRustAnnotationApNonstream.includes('Leaf-mutation count is frozen at 39')
) {
  failures.push(
    'why-rust must document the annotation AP non-stream residual and frozen leaf-mutation count'
  );
}
if (
  !matrix.claimedForDifferential.some(
    (claim) => claim.includes('prefer_speed') && claim.includes('tools/list')
  )
) {
  failures.push(
    'post-3.0.14 tools/list prefer_speed additive surface must remain documented'
  );
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
