import type {
  PageContentItem,
  PdfAccessibilityReport,
  PdfChunk,
  PdfDocumentElement,
  PdfDocumentMap,
  PdfDocumentMapLayer,
  PdfDocumentMapPage,
  PdfOcrTextLayer,
  PdfPageGeometry,
  PdfPageLayoutDiagnostics,
  PdfSafetyFinding,
  PdfTextLayer,
  PdfTextLayerPage,
  PdfTrustReport,
  PdfVisualEnrichment,
  PdfVisualEnrichmentCandidate,
  PdfVisualEnrichmentTargetType,
} from '../types/pdf.js';

const DOCUMENT_MAP_VERSION = '2026-06-15' as const;
const LOW_LAYOUT_CONFIDENCE_THRESHOLD = 0.7;

interface BuildDocumentMapInput {
  totalPages?: number | undefined;
  selectedPages: number[];
  pageContents: Array<{ page: number; items: PageContentItem[] }>;
  elements: PdfDocumentElement[];
  chunks: PdfChunk[];
  layoutDiagnostics: PdfPageLayoutDiagnostics[];
  safetyFindings: PdfSafetyFinding[];
  visualEnrichmentCandidates?: PdfVisualEnrichmentCandidate[] | undefined;
  visualEnrichments?: PdfVisualEnrichment[] | undefined;
  textLayer?: PdfTextLayer | undefined;
  ocrTextLayer?: PdfOcrTextLayer | undefined;
  trustReport?: PdfTrustReport | undefined;
  accessibilityReport?: PdfAccessibilityReport | undefined;
  pageGeometry?: PdfPageGeometry[] | undefined;
  warnings?: string[] | undefined;
}

const roundRatio = (value: number): number => Math.round(value * 100) / 100;

const pushToMap = <TValue>(map: Map<number, TValue[]>, key: number, value: TValue) => {
  const values = map.get(key);
  if (values) {
    values.push(value);
    return;
  }

  map.set(key, [value]);
};

const pagesForChunk = (chunk: PdfChunk): number[] => {
  const pages: number[] = [];
  for (let page = chunk.page_start; page <= chunk.page_end; page++) {
    pages.push(page);
  }
  return pages;
};

const buildLayers = (
  elements: PdfDocumentElement[],
  chunks: PdfChunk[],
  visualEnrichmentCandidates: PdfVisualEnrichmentCandidate[],
  visualEnrichments: PdfVisualEnrichment[],
  layoutDiagnostics: PdfPageLayoutDiagnostics[],
  safetyFindings: PdfSafetyFinding[],
  textLayer: PdfTextLayer | undefined,
  ocrTextLayer: PdfOcrTextLayer | undefined,
  trustReport: PdfTrustReport | undefined,
  accessibilityReport: PdfAccessibilityReport | undefined,
  pageGeometry: PdfPageGeometry[] | undefined
): PdfDocumentMapLayer[] => {
  const layers = new Set<PdfDocumentMapLayer>();

  if (elements.some((element) => element.type === 'text')) layers.add('selectable_text');
  if ((textLayer?.pages.length ?? 0) > 0) layers.add('text_layer');
  if ((ocrTextLayer?.pages.length ?? 0) > 0) layers.add('ocr_text_layer');
  if (elements.some((element) => element.type === 'image')) layers.add('image_metadata');
  if (elements.some((element) => element.type === 'table')) layers.add('table_structure');
  if (visualEnrichmentCandidates.length > 0) layers.add('visual_region_candidates');
  if (visualEnrichments.length > 0) layers.add('visual_enrichment');
  if (elements.some((element) => element.type === 'text' && element.semantic_hint !== undefined)) {
    layers.add('semantic_hints');
  }
  if (chunks.length > 0) layers.add('citation_chunks');
  if (layoutDiagnostics.length > 0) layers.add('layout_diagnostics');
  if (safetyFindings.length > 0) layers.add('content_safety');
  if (trustReport) layers.add('trust_report');
  if (accessibilityReport) layers.add('accessibility_report');
  if ((pageGeometry?.length ?? 0) > 0) layers.add('page_geometry');

  return [...layers];
};

const pageTextStats = (items: PageContentItem[]): { textChars: number; textItemCount: number } => {
  let textChars = 0;
  let textItemCount = 0;

  for (const item of items) {
    if (item.type !== 'text') continue;
    const text = item.textContent?.trim();
    if (!text) continue;
    textChars += text.length;
    textItemCount++;
  }

  return { textChars, textItemCount };
};

const pageWarnings = (
  layout: PdfPageLayoutDiagnostics | undefined,
  safetyFindingIndexes: number[],
  trustSignalCount: number,
  accessibilityIssueCount: number,
  tableWarnings: string[]
): string[] | undefined => {
  const warnings = [...(layout?.warnings ?? []), ...tableWarnings];
  if (safetyFindingIndexes.length > 0) {
    warnings.push(
      'Page has content safety findings; inspect findings before using as instructions.'
    );
  }
  if (trustSignalCount > 0) {
    warnings.push('Page has trust report signals; inspect trust evidence before using content.');
  }
  if (accessibilityIssueCount > 0) {
    warnings.push(
      'Page has accessibility report issues; inspect accessibility evidence before relying on tagged structure.'
    );
  }
  return warnings.length > 0 ? warnings : undefined;
};

const countVisualEnrichmentKinds = (
  visualEnrichments: PdfVisualEnrichment[]
): Record<string, number> => {
  const counts: Record<string, number> = {};

  for (const enrichment of visualEnrichments) {
    counts[enrichment.kind] = (counts[enrichment.kind] ?? 0) + 1;
  }

  return counts;
};

const countVisualCandidateKinds = (
  candidates: PdfVisualEnrichmentCandidate[]
): Partial<Record<PdfVisualEnrichmentTargetType, number>> => {
  const counts: Partial<Record<PdfVisualEnrichmentTargetType, number>> = {};

  for (const candidate of candidates) {
    counts[candidate.target_element_type] = (counts[candidate.target_element_type] ?? 0) + 1;
  }

  return counts;
};

const textLayerPageStats = (
  page: PdfTextLayerPage | undefined
):
  | {
      text_layer_run_count: number;
      text_layer_line_count: number;
      text_layer_word_count: number;
      text_layer_char_count: number;
      text_layer_runs_with_bounding_boxes: number;
      text_layer_lines_with_bounding_boxes: number;
      text_layer_words_with_bounding_boxes: number;
      text_layer_chars_with_bounding_boxes: number;
      text_layer_runs_with_font_metadata: number;
      text_layer_runs_with_direction_metadata: number;
      text_layer_runs_with_transform_metadata: number;
      text_layer_runs_with_eol_metadata: number;
    }
  | undefined => {
  if (!page) return undefined;

  const runs = page.lines.flatMap((line) => line.runs);
  const words = page.lines.flatMap((line) => line.words);
  const chars = page.lines.flatMap((line) => line.chars);

  return {
    text_layer_run_count: runs.length,
    text_layer_line_count: page.line_count,
    text_layer_word_count: page.word_count,
    text_layer_char_count: page.char_count,
    text_layer_runs_with_bounding_boxes: runs.filter((run) => run.bounding_box).length,
    text_layer_lines_with_bounding_boxes: page.lines.filter((line) => line.bounding_box).length,
    text_layer_words_with_bounding_boxes: words.filter((word) => word.bounding_box).length,
    text_layer_chars_with_bounding_boxes: chars.filter((char) => char.bounding_box).length,
    text_layer_runs_with_font_metadata: runs.filter((run) => run.font_name !== undefined).length,
    text_layer_runs_with_direction_metadata: runs.filter((run) => run.direction !== undefined)
      .length,
    text_layer_runs_with_transform_metadata: runs.filter((run) => run.transform !== undefined)
      .length,
    text_layer_runs_with_eol_metadata: runs.filter((run) => run.has_eol !== undefined).length,
  };
};

export const buildDocumentMap = (input: BuildDocumentMapInput): PdfDocumentMap => {
  const elementsByPage = new Map<number, PdfDocumentElement[]>();
  for (const element of input.elements) {
    pushToMap(elementsByPage, element.page, element);
  }

  const chunksByPage = new Map<number, PdfChunk[]>();
  for (const chunk of input.chunks) {
    for (const page of pagesForChunk(chunk)) {
      pushToMap(chunksByPage, page, chunk);
    }
  }

  const pageContentByPage = new Map(
    input.pageContents.map((pageContent) => [pageContent.page, pageContent])
  );
  const layoutByPage = new Map(input.layoutDiagnostics.map((layout) => [layout.page, layout]));
  const geometryByPage = new Map(input.pageGeometry?.map((geometry) => [geometry.page, geometry]));
  const textLayerPageIndexByPage = new Map(
    input.textLayer?.pages.map((page, index) => [page.page, index])
  );
  const textLayerPageByPage = new Map(input.textLayer?.pages.map((page) => [page.page, page]));
  const ocrPageByPage = new Map(input.ocrTextLayer?.pages.map((page) => [page.page, page]));
  const safetyFindingIndexesByPage = new Map<number, number[]>();
  input.safetyFindings.forEach((finding, index) => {
    pushToMap(safetyFindingIndexesByPage, finding.page, index);
  });
  const trustPageReportIndexByPage = new Map(
    input.trustReport?.page_reports.map((pageReport, index) => [pageReport.page, index])
  );
  const trustPageReportByPage = new Map(
    input.trustReport?.page_reports.map((pageReport) => [pageReport.page, pageReport])
  );
  const trustSignalIndexesByPage = new Map<number, number[]>();
  input.trustReport?.signals.forEach((signal, index) => {
    if (signal.page !== undefined) {
      pushToMap(trustSignalIndexesByPage, signal.page, index);
    }
  });
  const accessibilityPageReportIndexByPage = new Map(
    input.accessibilityReport?.page_reports.map((pageReport, index) => [pageReport.page, index])
  );
  const accessibilityPageReportByPage = new Map(
    input.accessibilityReport?.page_reports.map((pageReport) => [pageReport.page, pageReport])
  );
  const accessibilityIssueIndexesByPage = new Map<number, number[]>();
  input.accessibilityReport?.issues.forEach((issue, index) => {
    if (issue.page !== undefined) {
      pushToMap(accessibilityIssueIndexesByPage, issue.page, index);
    }
  });
  const visualEnrichmentCandidates = input.visualEnrichmentCandidates ?? [];
  const visualCandidateIndexesByPage = new Map<number, number[]>();
  visualEnrichmentCandidates.forEach((candidate, index) => {
    pushToMap(visualCandidateIndexesByPage, candidate.page, index);
  });
  const visualEnrichments = input.visualEnrichments ?? [];
  const visualEnrichmentIndexesByPage = new Map<number, number[]>();
  visualEnrichments.forEach((enrichment, index) => {
    pushToMap(visualEnrichmentIndexesByPage, enrichment.page, index);
  });

  const selectedPages =
    input.selectedPages.length > 0
      ? [...new Set(input.selectedPages)].sort((a, b) => a - b)
      : [...new Set(input.pageContents.map((pageContent) => pageContent.page))].sort(
          (a, b) => a - b
        );

  const pages: PdfDocumentMapPage[] = selectedPages.map((page): PdfDocumentMapPage => {
    const pageContent = pageContentByPage.get(page);
    const elements = elementsByPage.get(page) ?? [];
    const chunks = chunksByPage.get(page) ?? [];
    const layout = layoutByPage.get(page);
    const ocrPage = ocrPageByPage.get(page);
    const safetyFindingIndexes = safetyFindingIndexesByPage.get(page) ?? [];
    const visualCandidateIndexes = visualCandidateIndexesByPage.get(page) ?? [];
    const visualEnrichmentIndexes = visualEnrichmentIndexesByPage.get(page) ?? [];
    const textLayerPageIndex = textLayerPageIndexByPage.get(page);
    const textLayerStats = textLayerPageStats(textLayerPageByPage.get(page));
    const trustPageReport = trustPageReportByPage.get(page);
    const trustPageReportIndex = trustPageReportIndexByPage.get(page);
    const trustSignalIndexes = trustSignalIndexesByPage.get(page) ?? [];
    const trustHighSignalIndexes = trustSignalIndexes.filter(
      (index) => input.trustReport?.signals[index]?.severity === 'high'
    );
    const trustMediumSignalIndexes = trustSignalIndexes.filter(
      (index) => input.trustReport?.signals[index]?.severity === 'medium'
    );
    const trustLowSignalIndexes = trustSignalIndexes.filter(
      (index) => input.trustReport?.signals[index]?.severity === 'low'
    );
    const accessibilityPageReport = accessibilityPageReportByPage.get(page);
    const accessibilityPageReportIndex = accessibilityPageReportIndexByPage.get(page);
    const accessibilityIssueIndexes = accessibilityIssueIndexesByPage.get(page) ?? [];
    const accessibilityHighIssueIndexes = accessibilityIssueIndexes.filter(
      (index) => input.accessibilityReport?.issues[index]?.severity === 'high'
    );
    const accessibilityMediumIssueIndexes = accessibilityIssueIndexes.filter(
      (index) => input.accessibilityReport?.issues[index]?.severity === 'medium'
    );
    const accessibilityLowIssueIndexes = accessibilityIssueIndexes.filter(
      (index) => input.accessibilityReport?.issues[index]?.severity === 'low'
    );
    const { textChars, textItemCount } = pageTextStats(pageContent?.items ?? []);
    const imageCount = elements.filter((element) => element.type === 'image').length;
    const tableElements = elements.filter((element) => element.type === 'table');
    const tableCount = tableElements.length;
    const tableWarnings = tableElements.flatMap((element) =>
      element.type === 'table'
        ? (element.table.quality?.warnings ?? []).map((warning) => `${element.id}: ${warning}`)
        : []
    );
    const warnings = pageWarnings(
      layout,
      safetyFindingIndexes,
      trustSignalIndexes.length,
      accessibilityPageReport?.issue_count ?? 0,
      tableWarnings
    );

    return {
      page,
      ...(geometryByPage.get(page) ? { geometry: geometryByPage.get(page) } : {}),
      ...(layout ? { layout } : {}),
      element_ids: elements.map((element) => element.id),
      chunk_ids: chunks.map((chunk) => chunk.id),
      safety_finding_indexes: safetyFindingIndexes,
      visual_candidate_indexes: visualCandidateIndexes,
      visual_enrichment_indexes: visualEnrichmentIndexes,
      ...(textLayerPageIndex !== undefined ? { text_layer_page_index: textLayerPageIndex } : {}),
      ...(textLayerStats ? textLayerStats : {}),
      text_chars: textChars,
      text_item_count: textItemCount,
      ...(ocrPage
        ? {
            ocr_text_chars: ocrPage.text.length,
            ocr_word_count: ocrPage.words?.length ?? 0,
            ...(ocrPage.confidence !== undefined ? { ocr_confidence: ocrPage.confidence } : {}),
            ocr_source_render_evidence_id: ocrPage.source_render_evidence_id,
          }
        : {}),
      image_count: imageCount,
      table_count: tableCount,
      visual_candidate_count: visualCandidateIndexes.length,
      visual_enrichment_count: visualEnrichmentIndexes.length,
      ...(trustPageReportIndex !== undefined
        ? { trust_report_page_index: trustPageReportIndex }
        : {}),
      ...(trustPageReport
        ? {
            trust_signal_indexes: trustSignalIndexes,
            trust_high_signal_indexes: trustHighSignalIndexes,
            trust_medium_signal_indexes: trustMediumSignalIndexes,
            trust_low_signal_indexes: trustLowSignalIndexes,
            trust_risk: trustPageReport.risk,
            trust_score: trustPageReport.score,
            trust_signal_count: trustPageReport.signals.length,
            trust_high_signal_count: trustPageReport.signals.filter(
              (signal) => signal.severity === 'high'
            ).length,
            trust_medium_signal_count: trustPageReport.signals.filter(
              (signal) => signal.severity === 'medium'
            ).length,
            trust_low_signal_count: trustPageReport.signals.filter(
              (signal) => signal.severity === 'low'
            ).length,
          }
        : {}),
      ...(accessibilityPageReportIndex !== undefined
        ? { accessibility_report_page_index: accessibilityPageReportIndex }
        : {}),
      ...(accessibilityPageReport
        ? {
            accessibility_issue_indexes: accessibilityIssueIndexes,
            accessibility_high_issue_indexes: accessibilityHighIssueIndexes,
            accessibility_medium_issue_indexes: accessibilityMediumIssueIndexes,
            accessibility_low_issue_indexes: accessibilityLowIssueIndexes,
            accessibility_grade: accessibilityPageReport.grade,
            accessibility_score: accessibilityPageReport.score,
            accessibility_issue_count: accessibilityPageReport.issue_count,
            accessibility_high_issue_count: accessibilityPageReport.high_issue_count,
            accessibility_medium_issue_count: accessibilityPageReport.medium_issue_count,
            accessibility_low_issue_count: accessibilityPageReport.low_issue_count,
          }
        : {}),
      ...(warnings ? { warnings } : {}),
    };
  });

  const lowConfidencePages = input.layoutDiagnostics
    .filter((layout) => layout.confidence < LOW_LAYOUT_CONFIDENCE_THRESHOLD)
    .map((layout) => layout.page);
  const imageOrSparsePages = input.layoutDiagnostics
    .filter((layout) => layout.profile === 'image_or_sparse')
    .map((layout) => layout.page);
  const needsOcrPages = input.layoutDiagnostics
    .filter(
      (layout) =>
        (layout.profile === 'image_or_sparse' || layout.item_count === 0) &&
        layout.text_item_count === 0
    )
    .map((layout) => layout.page);
  const ocrAppliedPages = input.ocrTextLayer?.pages.map((page) => page.page) ?? [];
  const visualCandidatePages = [
    ...new Set(visualEnrichmentCandidates.map((candidate) => candidate.page)),
  ].sort((a, b) => a - b);
  const accessibilityReviewPages =
    input.accessibilityReport?.page_reports
      .filter((pageReport) => pageReport.issue_count > 0)
      .map((pageReport) => pageReport.page) ?? [];
  const accessibilityHighIssuePages =
    input.accessibilityReport?.page_reports
      .filter((pageReport) => pageReport.high_issue_count > 0)
      .map((pageReport) => pageReport.page) ?? [];
  const accessibilityMediumIssuePages =
    input.accessibilityReport?.page_reports
      .filter((pageReport) => pageReport.medium_issue_count > 0)
      .map((pageReport) => pageReport.page) ?? [];
  const accessibilityLowIssuePages =
    input.accessibilityReport?.page_reports
      .filter((pageReport) => pageReport.low_issue_count > 0)
      .map((pageReport) => pageReport.page) ?? [];
  const trustReviewPages =
    input.trustReport?.page_reports
      .filter((pageReport) => pageReport.signals.length > 0)
      .map((pageReport) => pageReport.page) ?? [];
  const trustHighSignalPages =
    input.trustReport?.page_reports
      .filter((pageReport) => pageReport.signals.some((signal) => signal.severity === 'high'))
      .map((pageReport) => pageReport.page) ?? [];
  const trustHighRiskPages =
    input.trustReport?.page_reports
      .filter((pageReport) => pageReport.risk === 'high')
      .map((pageReport) => pageReport.page) ?? [];
  const trustMediumRiskPages =
    input.trustReport?.page_reports
      .filter((pageReport) => pageReport.risk === 'medium')
      .map((pageReport) => pageReport.page) ?? [];

  const layoutConfidences = input.layoutDiagnostics.map((layout) => layout.confidence);
  const averageLayoutConfidence =
    layoutConfidences.length > 0
      ? roundRatio(
          layoutConfidences.reduce((sum, confidence) => sum + confidence, 0) /
            layoutConfidences.length
        )
      : undefined;
  const lowestLayoutConfidence =
    layoutConfidences.length > 0 ? roundRatio(Math.min(...layoutConfidences)) : undefined;

  const textElementCount = input.elements.filter((element) => element.type === 'text').length;
  const imageElementCount = input.elements.filter((element) => element.type === 'image').length;
  const tableElementCount = input.elements.filter((element) => element.type === 'table').length;

  return {
    version: DOCUMENT_MAP_VERSION,
    profile: 'agent_document_map',
    layers: buildLayers(
      input.elements,
      input.chunks,
      visualEnrichmentCandidates,
      visualEnrichments,
      input.layoutDiagnostics,
      input.safetyFindings,
      input.textLayer,
      input.ocrTextLayer,
      input.trustReport,
      input.accessibilityReport,
      input.pageGeometry
    ),
    pages,
    elements: input.elements,
    chunks: input.chunks,
    visual_enrichment_candidates: visualEnrichmentCandidates,
    visual_enrichments: visualEnrichments,
    layout_diagnostics: input.layoutDiagnostics,
    safety_findings: input.safetyFindings,
    routing: {
      low_confidence_pages: lowConfidencePages,
      image_or_sparse_pages: imageOrSparsePages,
      needs_ocr_pages: needsOcrPages,
      ocr_applied_pages: ocrAppliedPages,
      visual_candidate_pages: visualCandidatePages,
      accessibility_review_pages: accessibilityReviewPages,
      accessibility_high_issue_pages: accessibilityHighIssuePages,
      accessibility_medium_issue_pages: accessibilityMediumIssuePages,
      accessibility_low_issue_pages: accessibilityLowIssuePages,
      trust_review_pages: trustReviewPages,
      trust_high_signal_pages: trustHighSignalPages,
      trust_high_risk_pages: trustHighRiskPages,
      trust_medium_risk_pages: trustMediumRiskPages,
    },
    summary: {
      ...(input.totalPages !== undefined ? { total_pages: input.totalPages } : {}),
      selected_pages: selectedPages,
      processed_page_count: pages.length,
      element_count: input.elements.length,
      text_element_count: textElementCount,
      text_layer_page_count: input.textLayer?.summary.page_count ?? 0,
      text_layer_run_count: input.textLayer?.summary.run_count ?? 0,
      text_layer_line_count: input.textLayer?.summary.line_count ?? 0,
      text_layer_word_count: input.textLayer?.summary.word_count ?? 0,
      text_layer_char_count: input.textLayer?.summary.char_count ?? 0,
      text_layer_runs_with_bounding_boxes: input.textLayer?.summary.runs_with_bounding_boxes ?? 0,
      text_layer_lines_with_bounding_boxes: input.textLayer?.summary.lines_with_bounding_boxes ?? 0,
      text_layer_words_with_bounding_boxes: input.textLayer?.summary.words_with_bounding_boxes ?? 0,
      text_layer_chars_with_bounding_boxes: input.textLayer?.summary.chars_with_bounding_boxes ?? 0,
      text_layer_runs_with_font_metadata: input.textLayer?.summary.runs_with_font_metadata ?? 0,
      text_layer_runs_with_direction_metadata:
        input.textLayer?.summary.runs_with_direction_metadata ?? 0,
      text_layer_runs_with_transform_metadata:
        input.textLayer?.summary.runs_with_transform_metadata ?? 0,
      text_layer_runs_with_eol_metadata: input.textLayer?.summary.runs_with_eol_metadata ?? 0,
      ocr_page_count: input.ocrTextLayer?.summary.page_count ?? 0,
      ocr_text_chars: input.ocrTextLayer?.summary.text_chars ?? 0,
      image_element_count: imageElementCount,
      table_element_count: tableElementCount,
      visual_enrichment_candidate_count: visualEnrichmentCandidates.length,
      visual_enrichment_candidate_kind_counts: countVisualCandidateKinds(
        visualEnrichmentCandidates
      ),
      visual_enrichment_count: visualEnrichments.length,
      visual_enrichment_kind_counts: countVisualEnrichmentKinds(visualEnrichments),
      chunk_count: input.chunks.length,
      safety_finding_count: input.safetyFindings.length,
      ...(input.accessibilityReport
        ? {
            accessibility_report_page_count: input.accessibilityReport.page_reports.length,
            accessibility_score: input.accessibilityReport.score,
            accessibility_grade: input.accessibilityReport.grade,
            accessibility_issue_count: input.accessibilityReport.summary.issue_count,
            accessibility_document_issue_count:
              input.accessibilityReport.summary.document_issue_count,
            accessibility_page_issue_count: input.accessibilityReport.summary.page_issue_count,
            accessibility_high_issue_count: input.accessibilityReport.summary.high_issue_count,
            accessibility_medium_issue_count: input.accessibilityReport.summary.medium_issue_count,
            accessibility_low_issue_count: input.accessibilityReport.summary.low_issue_count,
            accessibility_pages_with_issues_count:
              input.accessibilityReport.summary.pages_with_issues_count,
            accessibility_pages_with_high_issues_count:
              input.accessibilityReport.summary.pages_with_high_issues_count,
            accessibility_page_grade_counts: input.accessibilityReport.summary.page_grade_counts,
          }
        : {}),
      ...(input.trustReport
        ? {
            trust_report_page_count: input.trustReport.page_reports.length,
            trust_risk: input.trustReport.risk,
            trust_score: input.trustReport.score,
            trust_signal_count: input.trustReport.summary.signal_count,
            trust_high_signal_count: input.trustReport.summary.high_signal_count,
            trust_medium_signal_count: input.trustReport.summary.medium_signal_count,
            trust_low_signal_count: input.trustReport.summary.low_signal_count,
            trust_pages_with_signals: input.trustReport.summary.pages_with_signals,
            trust_high_risk_page_count: input.trustReport.summary.high_risk_page_count,
            trust_medium_risk_page_count: input.trustReport.summary.medium_risk_page_count,
            trust_signal_type_counts: input.trustReport.summary.signal_type_counts,
          }
        : {}),
      ...(averageLayoutConfidence !== undefined
        ? { average_layout_confidence: averageLayoutConfidence }
        : {}),
      ...(lowestLayoutConfidence !== undefined
        ? { lowest_layout_confidence: lowestLayoutConfidence }
        : {}),
    },
    ...(input.warnings && input.warnings.length > 0 ? { warnings: input.warnings } : {}),
  };
};
