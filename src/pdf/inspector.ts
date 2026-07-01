import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type {
  InspectPdfOptions,
  PdfInspectionData,
  PdfInspectionDocumentSignals,
  PdfInspectionNextTool,
  PdfInspectionPageSignal,
  PdfInspectionProfile,
  PdfInspectionRecommendation,
  PdfInspectionSourceResult,
  PdfOptionalProviderReadiness,
  PdfSource,
} from '../types/pdf.js';
import { PdfError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import { destroyLoadingTask } from '../utils/pdfjs.js';
import {
  buildWarnings,
  extractDocumentStructure,
  extractMetadataAndPageCount,
  extractPageGeometry,
  extractStructureTrees,
} from './extractor.js';
import { loadPdfDocument } from './loader.js';
import { getOcrProviderStatus } from './ocr.js';
import { getTargetPages } from './parser.js';
import { getRegionAnalysisProviderStatus } from './regionAnalysis.js';

const logger = createLogger('Inspector');

const DEFAULT_SAMPLE_PAGES = 5;
const MAX_SAMPLE_PAGES = 20;
const LOW_TEXT_CHAR_THRESHOLD = 20;
const DIGITAL_TEXT_CHAR_THRESHOLD = 80;
const APPROX_CHARS_PER_TOKEN = 4;

const clampSamplePageCount = (value: number): number =>
  Math.min(MAX_SAMPLE_PAGES, Math.max(1, Math.floor(value)));

const publicSource = (source: PdfSource): PdfSource => ({
  ...(source.path ? { path: source.path } : {}),
  ...(source.url ? { url: source.url } : {}),
  ...(source.pages ? { pages: source.pages } : {}),
});

const publicSourceWithPages = (source: PdfSource, pages: number[]): PdfSource => ({
  ...publicSource(source),
  ...(pages.length > 0 ? { pages } : {}),
});

const selectEvenlySpaced = (values: number[], maxItems: number): number[] => {
  const uniqueValues = [...new Set(values)].sort((a, b) => a - b);
  if (uniqueValues.length <= maxItems) return uniqueValues;
  if (maxItems === 1) return [uniqueValues[0] as number];

  const selected = new Set<number>();
  for (let i = 0; i < maxItems; i++) {
    const index = Math.round((i * (uniqueValues.length - 1)) / (maxItems - 1));
    const value = uniqueValues[index];
    if (value !== undefined) selected.add(value);
  }

  for (const value of uniqueValues) {
    if (selected.size >= maxItems) break;
    selected.add(value);
  }

  return [...selected].sort((a, b) => a - b);
};

export const selectInspectionSamplePages = (
  totalPages: number,
  targetPages: number[] | undefined,
  samplePageCount: number
): number[] => {
  if (totalPages <= 0) return [];

  const maxSamples = clampSamplePageCount(samplePageCount);
  if (targetPages !== undefined) {
    const validTargetPages = targetPages.filter((page) => page >= 1 && page <= totalPages);
    return selectEvenlySpaced(validTargetPages, maxSamples);
  }

  if (totalPages <= maxSamples) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const sampled = new Set<number>();
  for (let i = 0; i < maxSamples; i++) {
    const page = 1 + Math.round((i * (totalPages - 1)) / (maxSamples - 1));
    sampled.add(page);
  }

  return [...sampled].sort((a, b) => a - b);
};

export const classifyPdfInspectionProfile = (
  pageSignals: PdfInspectionPageSignal[]
): PdfInspectionProfile => {
  if (pageSignals.length === 0) return 'unknown';

  const scannedCount = pageSignals.filter((signal) => signal.likely_scanned).length;
  const digitalTextCount = pageSignals.filter(
    (signal) => signal.text_chars >= DIGITAL_TEXT_CHAR_THRESHOLD
  ).length;

  if (scannedCount === pageSignals.length) return 'scanned_or_image_only';
  if (scannedCount > 0 && digitalTextCount > 0) return 'mixed_text_and_scan';
  if (digitalTextCount > 0) return 'digital_text';
  return 'low_text_or_form';
};

const countImagePaintOperations = async (page: pdfjsLib.PDFPageProxy): Promise<number> => {
  try {
    const operatorList = await page.getOperatorList();
    return operatorList.fnArray.filter(
      (op) => op === OPS.paintImageXObject || op === OPS.paintXObject
    ).length;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Error counting image paint operations', { error: message });
    return 0;
  }
};

const inspectPageSignal = async (
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  pageNum: number
): Promise<PdfInspectionPageSignal> => {
  const page = await pdfDocument.getPage(pageNum);
  const textContent = await page.getTextContent();
  const textValues = textContent.items
    .map((item: unknown) => (item as { str?: unknown }).str)
    .filter((value): value is string => typeof value === 'string');
  const textChars = textValues.reduce((sum, value) => sum + value.trim().length, 0);
  const imagePaintOperations = await countImagePaintOperations(page);
  const likelyScanned = textChars < LOW_TEXT_CHAR_THRESHOLD && imagePaintOperations > 0;

  return {
    page: pageNum,
    text_chars: textChars,
    text_items: textValues.filter((value) => value.trim().length > 0).length,
    estimated_tokens: Math.ceil(textChars / APPROX_CHARS_PER_TOKEN),
    image_paint_operations: imagePaintOperations,
    likely_scanned: likelyScanned,
    low_text_density: textChars < DIGITAL_TEXT_CHAR_THRESHOLD,
  };
};

const buildDocumentSignals = (
  structureOutput: Awaited<ReturnType<typeof extractDocumentStructure>>,
  hasStructureTree: boolean
): PdfInspectionDocumentSignals => ({
  has_outline: (structureOutput.outline?.length ?? 0) > 0,
  has_page_labels: (structureOutput.page_labels?.length ?? 0) > 0,
  has_permissions: (structureOutput.permissions?.length ?? 0) > 0,
  has_mark_info: Object.keys(structureOutput.mark_info ?? {}).length > 0,
  has_form_fields: (structureOutput.form_fields?.length ?? 0) > 0,
  has_attachments: (structureOutput.attachments?.length ?? 0) > 0,
  has_structure_tree: hasStructureTree,
});

const setTrue = (target: Record<string, unknown>, key: string, enabled: boolean) => {
  if (enabled) target[key] = true;
};

interface InspectionProviderReadiness {
  ocr_pages: PdfOptionalProviderReadiness;
  analyze_regions: PdfOptionalProviderReadiness;
}

const defaultInspectionProviderReadiness = (): InspectionProviderReadiness => ({
  ocr_pages: 'ready',
  analyze_regions: 'ready',
});

const providerReady = (readiness: PdfOptionalProviderReadiness): boolean => readiness === 'ready';

const enableVisualEnrichmentFusion = (
  target: Record<string, unknown>,
  providerReadiness: InspectionProviderReadiness
) => {
  if (!providerReady(providerReadiness.analyze_regions)) return;

  target['include_visual_enrichments'] = true;
  target['max_visual_enrichments'] = 8;
};

const providerRequiredInputs = (
  inputs: string[],
  providerName: 'OCR' | 'analyze_regions',
  readiness: PdfOptionalProviderReadiness
): string[] => {
  if (providerReady(readiness)) return inputs;

  const providerRequirement =
    readiness === 'not_configured'
      ? `configured ${providerName} provider`
      : readiness === 'unavailable'
        ? `available ${providerName} provider`
        : `valid ${providerName} provider configuration`;

  return [...inputs, providerRequirement];
};

const providerRequiredInput = (
  providerName: 'OCR' | 'analyze_regions',
  readiness: PdfOptionalProviderReadiness
): string =>
  providerRequiredInputs([], providerName, readiness)[0] ?? `configured ${providerName} provider`;

const buildRegionSourceTemplate = (source: PdfSource): Record<string, unknown> => ({
  ...(source.path ? { path: source.path } : {}),
  ...(source.url ? { url: source.url } : {}),
  regions: [
    {
      id: '<region-id>',
      page: '<page-number>',
      bounding_box: {
        left: '<pdf-left>',
        bottom: '<pdf-bottom>',
        right: '<pdf-right>',
        top: '<pdf-top>',
      },
    },
  ],
});

const toolStep = (
  priority: number,
  step: Omit<PdfInspectionNextTool, 'priority'>
): PdfInspectionNextTool => ({
  priority,
  ...step,
});

const buildInspectionNextTools = (
  source: PdfSource,
  profile: PdfInspectionProfile,
  readPdfArguments: Record<string, unknown>,
  pageSignals: PdfInspectionPageSignal[],
  providerReadiness: InspectionProviderReadiness
): PdfInspectionNextTool[] => {
  const sampledPages = pageSignals.map((signal) => signal.page);
  const scannedPages = pageSignals
    .filter((signal) => signal.likely_scanned)
    .map((signal) => signal.page);
  const visualPages = scannedPages.length > 0 ? scannedPages : sampledPages;
  const visualSource = publicSourceWithPages(source, visualPages);
  const baseSource = publicSource(source);
  const regionSourceTemplate = buildRegionSourceTemplate(source);
  const readPdfStep = (purpose: string, when: string): PdfInspectionNextTool => {
    const needsOcrProvider = Boolean(readPdfArguments['include_ocr_text_layer']);
    const ocrReady = providerReady(providerReadiness.ocr_pages);

    return toolStep(1, {
      tool: 'read_pdf',
      ready: needsOcrProvider ? ocrReady : true,
      purpose,
      when,
      arguments: readPdfArguments,
      ...(needsOcrProvider ? { requires_provider: 'ocr_pages' as const } : {}),
      ...(needsOcrProvider && !ocrReady
        ? { required_inputs: [providerRequiredInput('OCR', providerReadiness.ocr_pages)] }
        : {}),
    });
  };
  const searchStep = (
    priority: number,
    includeOcrTextLayer: boolean,
    when: string
  ): PdfInspectionNextTool =>
    toolStep(priority, {
      tool: 'search_pdf',
      ready: false,
      purpose:
        'Find task-relevant source snippets with offsets, page references, and bbox evidence before heavier extraction.',
      when,
      argument_template: {
        sources: [baseSource],
        query: '<literal-query-from-user-task>',
        include_ocr_text_layer: includeOcrTextLayer,
        max_matches_per_source: 10,
        context_chars: 160,
      },
      required_inputs: providerRequiredInputs(
        ['literal search query'],
        'OCR',
        includeOcrTextLayer ? providerReadiness.ocr_pages : 'ready'
      ),
      ...(includeOcrTextLayer ? { requires_provider: 'ocr_pages' as const } : {}),
    });
  const renderStep = (priority: number, when: string): PdfInspectionNextTool =>
    toolStep(priority, {
      tool: 'pdf_evidence',
      ready: true,
      purpose:
        'Return bounded page images as MCP image evidence for visual verification, OCR routing, or human review.',
      when,
      arguments: {
        operation: 'render_page',
        sources: [visualSource],
        scale: 2,
        max_pages: Math.min(Math.max(visualPages.length, 1), 5),
        include_image: true,
      },
    });
  const ocrStep = (priority: number, when: string): PdfInspectionNextTool =>
    toolStep(priority, {
      tool: 'pdf_evidence',
      ready: providerReady(providerReadiness.ocr_pages),
      purpose:
        'Run selected rendered pages through the configured OCR provider and return normalized text, confidence, word boxes, and provenance.',
      when,
      arguments: {
        operation: 'ocr_pages',
        sources: [visualSource],
        scale: 2,
        max_pages: Math.min(Math.max(visualPages.length, 1), 5),
      },
      requires_provider: 'ocr_pages',
      ...(providerReady(providerReadiness.ocr_pages)
        ? {}
        : { required_inputs: [providerRequiredInput('OCR', providerReadiness.ocr_pages)] }),
    });
  const extractRegionsStep = (priority: number, when: string): PdfInspectionNextTool =>
    toolStep(priority, {
      tool: 'pdf_evidence',
      ready: false,
      purpose:
        'Crop bbox-grounded regions as focused visual evidence after read_pdf exposes table, image, text-layer, or chunk boxes.',
      when,
      argument_template: {
        operation: 'extract_regions',
        sources: [regionSourceTemplate],
        scale: 2,
        max_regions: 20,
        include_image: true,
      },
      required_inputs: ['page number', 'PDF-coordinate bounding box'],
    });
  const analyzeRegionsStep = (priority: number, when: string): PdfInspectionNextTool =>
    toolStep(priority, {
      tool: 'pdf_evidence',
      ready: false,
      purpose:
        'Send focused crops to a configured local visual provider and normalize table, chart, formula, figure, or image-description evidence.',
      when,
      argument_template: {
        operation: 'analyze_regions',
        sources: [regionSourceTemplate],
        scale: 2,
        max_regions: 20,
      },
      required_inputs: providerRequiredInputs(
        ['page number', 'PDF-coordinate bounding box'],
        'analyze_regions',
        providerReadiness.analyze_regions
      ),
      requires_provider: 'analyze_regions',
    });

  if (profile === 'scanned_or_image_only') {
    return [
      readPdfStep(
        'Build an agent document map with OCR text-layer evidence fused into page routing.',
        'Use first when the goal is to extract text from scanned or image-only pages.'
      ),
      ocrStep(
        2,
        'Use when the workflow needs a dedicated OCR pass or OCR output should be inspected before document-map fusion.'
      ),
      renderStep(
        3,
        'Use when no OCR provider is configured yet, OCR confidence is low, or the original page image must be inspected.'
      ),
    ];
  }

  if (profile === 'mixed_text_and_scan') {
    return [
      readPdfStep(
        'Build one provenance-aware document map that includes selectable text, tables, chunks, safety signals, and OCR text-layer evidence.',
        'Use first for mixed PDFs so digital and scanned pages share one evidence model.'
      ),
      searchStep(
        2,
        true,
        'Use when the task has a specific term and both selectable text and OCR text should be searched.'
      ),
      renderStep(
        3,
        'Use to inspect sampled scanned or low-text pages before relying on extracted text.'
      ),
      extractRegionsStep(
        4,
        'Use after read_pdf exposes bbox evidence for tables, figures, formulas, suspicious text, or citation-critical regions.'
      ),
      analyzeRegionsStep(
        5,
        'Use after region boxes are known and visual table, chart, formula, figure, or caption enrichment is needed.'
      ),
    ];
  }

  if (profile === 'digital_text') {
    return [
      readPdfStep(
        'Build citation-ready agent context with document map, chunks, semantic hints, tables, layout diagnostics, and safety findings.',
        'Use first when sampled pages already expose selectable text.'
      ),
      searchStep(
        2,
        false,
        'Use before broad extraction when the task asks for specific facts, terms, or citations.'
      ),
      extractRegionsStep(
        3,
        'Use when read_pdf returns bbox evidence for a table, figure, chart, formula, annotation, or citation that needs visual proof.'
      ),
      analyzeRegionsStep(
        4,
        'Use when a known region needs local visual table, chart, formula, figure, or image-description enrichment.'
      ),
      renderStep(
        5,
        'Use when layout diagnostics are uncertain or the answer requires original page appearance.'
      ),
    ];
  }

  return [
    readPdfStep(
      'Inspect metadata, forms, attachments, structure, page geometry, and low-text pages before choosing heavier extraction.',
      'Use first for sparse, form-like, or uncertain PDFs.'
    ),
    renderStep(
      2,
      'Use when sparse sampled pages need visual inspection before OCR, form handling, or manual review.'
    ),
    searchStep(
      3,
      false,
      'Use only if the task provides a literal query and selectable text may still contain relevant snippets.'
    ),
  ];
};

export const buildInspectionRecommendation = (
  source: PdfSource,
  profile: PdfInspectionProfile,
  documentSignals: PdfInspectionDocumentSignals,
  pageSignals: PdfInspectionPageSignal[] = [],
  providerReadiness: InspectionProviderReadiness = defaultInspectionProviderReadiness()
): PdfInspectionRecommendation => {
  const readPdfArguments: Record<string, unknown> = {
    sources: [publicSource(source)],
    include_metadata: true,
    include_page_count: true,
    include_page_geometry: true,
  };

  setTrue(readPdfArguments, 'include_outline', documentSignals.has_outline);
  setTrue(readPdfArguments, 'include_page_labels', documentSignals.has_page_labels);
  setTrue(readPdfArguments, 'include_permissions', documentSignals.has_permissions);
  setTrue(readPdfArguments, 'include_form_fields', documentSignals.has_form_fields);
  setTrue(readPdfArguments, 'include_attachments', documentSignals.has_attachments);
  setTrue(readPdfArguments, 'include_structure_tree', documentSignals.has_structure_tree);

  if (profile === 'scanned_or_image_only') {
    Object.assign(readPdfArguments, {
      include_document_map: true,
      include_layout_diagnostics: true,
      include_ocr_text_layer: true,
      include_tables: true,
    });
    enableVisualEnrichmentFusion(readPdfArguments, providerReadiness);
    return {
      workflow: 'scanned_pdf_triage',
      needs_ocr: true,
      reason:
        'Sampled pages contain little selectable text and visible image paint operations; use read_pdf with include_ocr_text_layer and include_tables for OCR text and OCR-derived table evidence, plus include_visual_enrichments when a visual-region provider is ready.',
      read_pdf_arguments: readPdfArguments,
      next_tools: buildInspectionNextTools(
        source,
        profile,
        readPdfArguments,
        pageSignals,
        providerReadiness
      ),
    };
  }

  if (profile === 'mixed_text_and_scan') {
    Object.assign(readPdfArguments, {
      include_document_map: true,
      include_chunks: true,
      include_semantic_hints: true,
      include_safety_findings: true,
      include_layout_diagnostics: true,
      include_ocr_text_layer: true,
      include_markdown: true,
      include_tables: true,
    });
    enableVisualEnrichmentFusion(readPdfArguments, providerReadiness);
    return {
      workflow: 'mixed_pdf_review',
      needs_ocr: true,
      reason:
        'Some sampled pages look text-based while others look image-only; use read_pdf with OCR and visual enrichment fusion for one provenance-aware document map when providers are ready.',
      read_pdf_arguments: readPdfArguments,
      next_tools: buildInspectionNextTools(
        source,
        profile,
        readPdfArguments,
        pageSignals,
        providerReadiness
      ),
    };
  }

  if (profile === 'digital_text') {
    Object.assign(readPdfArguments, {
      include_document_map: true,
      include_chunks: true,
      include_semantic_hints: true,
      include_safety_findings: true,
      include_layout_diagnostics: true,
      include_markdown: true,
      include_tables: true,
    });
    enableVisualEnrichmentFusion(readPdfArguments, providerReadiness);
    return {
      workflow: 'agentic_rag',
      needs_ocr: false,
      reason:
        'Sampled pages expose selectable text; the agent document map, citation chunks, semantic hints, table extraction, safety findings, and visual enrichment fusion are the highest-value next read_pdf options when providers are ready.',
      read_pdf_arguments: readPdfArguments,
      next_tools: buildInspectionNextTools(
        source,
        profile,
        readPdfArguments,
        pageSignals,
        providerReadiness
      ),
    };
  }

  return {
    workflow: 'metadata_review',
    needs_ocr: false,
    reason:
      'Sampled pages expose limited text; inspect metadata, forms, attachments, structure, and selected pages before running a heavier extraction.',
    read_pdf_arguments: readPdfArguments,
    next_tools: buildInspectionNextTools(
      source,
      profile,
      readPdfArguments,
      pageSignals,
      providerReadiness
    ),
  };
};

export const inspectPdfSource = async (
  source: PdfSource,
  options: InspectPdfOptions
): Promise<PdfInspectionSourceResult> => {
  const sourceDescription = source.path ?? source.url ?? 'unknown source';
  let pdfDocument: pdfjsLib.PDFDocumentProxy | null = null;

  try {
    const targetPages = getTargetPages(source.pages, sourceDescription);
    const { pages: _pages, ...loadArgs } = source;
    pdfDocument = await loadPdfDocument(loadArgs, sourceDescription);
    const totalPages = pdfDocument.numPages;
    const validTargetPages = targetPages?.filter((page) => page <= totalPages);
    const invalidPages = targetPages?.filter((page) => page > totalPages) ?? [];
    const sampledPages = selectInspectionSamplePages(
      totalPages,
      validTargetPages,
      options.sample_pages
    );

    const metadataOutput = await extractMetadataAndPageCount(
      pdfDocument,
      options.include_metadata,
      true
    );
    const structureOutput = await extractDocumentStructure(pdfDocument, {
      includeOutline: true,
      includePageLabels: true,
      includePermissions: true,
      includeFormFields: true,
      includeAttachments: true,
    });
    const structureTrees =
      sampledPages.length > 0 ? await extractStructureTrees(pdfDocument, sampledPages) : [];
    const documentSignals = buildDocumentSignals(structureOutput, structureTrees.length > 0);
    const pageSignals = await Promise.all(
      sampledPages.map((pageNum) =>
        inspectPageSignal(pdfDocument as pdfjsLib.PDFDocumentProxy, pageNum)
      )
    );
    const pageGeometry =
      sampledPages.length > 0 ? await extractPageGeometry(pdfDocument, sampledPages) : [];
    const profile = classifyPdfInspectionProfile(pageSignals);
    const providerStatus = {
      ocr_pages: getOcrProviderStatus(),
      analyze_regions: getRegionAnalysisProviderStatus(),
    };
    const recommendation = buildInspectionRecommendation(
      source,
      profile,
      documentSignals,
      pageSignals,
      {
        ocr_pages: providerStatus.ocr_pages.readiness,
        analyze_regions: providerStatus.analyze_regions.readiness,
      }
    );
    const warnings = buildWarnings(invalidPages, totalPages);

    if (targetPages !== undefined && sampledPages.length === 0) {
      warnings.push('No requested pages are inside the document page range.');
    }
    if (recommendation.needs_ocr) {
      warnings.push(
        'OCR is opt-in and requires a configured provider; use read_pdf with include_ocr_text_layer or pdf_evidence operation ocr_pages for scanned pages.'
      );
    }

    const data: PdfInspectionData = {
      profile,
      num_pages: totalPages,
      sampled_pages: sampledPages,
      page_signals: pageSignals,
      document_signals: documentSignals,
      recommendation,
      provider_status: providerStatus,
      ...(metadataOutput.info ? { info: metadataOutput.info } : {}),
      ...(metadataOutput.metadata ? { metadata: metadataOutput.metadata } : {}),
      ...(pageGeometry.length > 0 ? { page_geometry: pageGeometry } : {}),
      ...(warnings.length > 0 ? { warnings } : {}),
    };

    return {
      source: sourceDescription,
      success: true,
      data,
    };
  } catch (error: unknown) {
    if (error instanceof PdfError) {
      return { source: sourceDescription, success: false, error: error.message };
    }

    const message = error instanceof Error ? error.message : String(error);
    logger.error('Unexpected error inspecting PDF source', {
      sourceDescription,
      error: message,
    });
    return {
      source: sourceDescription,
      success: false,
      error: `Failed to inspect PDF from ${sourceDescription}.`,
    };
  } finally {
    const loadingTask = pdfDocument?.loadingTask;
    await destroyLoadingTask(loadingTask, logger, 'PDF document after inspection', {
      sourceDescription,
    });
  }
};

export const defaultInspectPdfOptions = (): InspectPdfOptions => ({
  sample_pages: DEFAULT_SAMPLE_PAGES,
  include_metadata: true,
});
