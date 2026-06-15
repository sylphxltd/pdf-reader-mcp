import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type {
  InspectPdfOptions,
  PdfInspectionData,
  PdfInspectionDocumentSignals,
  PdfInspectionPageSignal,
  PdfInspectionProfile,
  PdfInspectionRecommendation,
  PdfInspectionSourceResult,
  PdfSource,
} from '../types/pdf.js';
import { PdfError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import {
  buildWarnings,
  extractDocumentStructure,
  extractMetadataAndPageCount,
  extractPageGeometry,
  extractStructureTrees,
} from './extractor.js';
import { loadPdfDocument } from './loader.js';
import { getTargetPages } from './parser.js';

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

export const buildInspectionRecommendation = (
  source: PdfSource,
  profile: PdfInspectionProfile,
  documentSignals: PdfInspectionDocumentSignals
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
    return {
      workflow: 'scanned_pdf_triage',
      needs_ocr: true,
      reason:
        'Sampled pages contain little selectable text and visible image paint operations; OCR or an optional advanced engine is likely required for text extraction.',
      read_pdf_arguments: readPdfArguments,
    };
  }

  if (profile === 'mixed_text_and_scan') {
    Object.assign(readPdfArguments, {
      include_document_map: true,
      include_chunks: true,
      include_semantic_hints: true,
      include_safety_findings: true,
      include_layout_diagnostics: true,
      include_markdown: true,
      include_tables: true,
    });
    return {
      workflow: 'mixed_pdf_review',
      needs_ocr: true,
      reason:
        'Some sampled pages look text-based while others look image-only; use read_pdf for selectable-text pages and OCR for scanned pages.',
      read_pdf_arguments: readPdfArguments,
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
    return {
      workflow: 'agentic_rag',
      needs_ocr: false,
      reason:
        'Sampled pages expose selectable text; the agent document map, citation chunks, semantic hints, table extraction, and safety findings are the highest-value next read_pdf options.',
      read_pdf_arguments: readPdfArguments,
    };
  }

  return {
    workflow: 'metadata_review',
    needs_ocr: false,
    reason:
      'Sampled pages expose limited text; inspect metadata, forms, attachments, structure, and selected pages before running a heavier extraction.',
    read_pdf_arguments: readPdfArguments,
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
    const recommendation = buildInspectionRecommendation(source, profile, documentSignals);
    const warnings = buildWarnings(invalidPages, totalPages);

    if (targetPages !== undefined && sampledPages.length === 0) {
      warnings.push('No requested pages are inside the document page range.');
    }
    if (recommendation.needs_ocr) {
      warnings.push(
        'Default PDF Reader MCP does not perform OCR; use an optional OCR-capable engine for scanned pages.'
      );
    }

    const data: PdfInspectionData = {
      profile,
      num_pages: totalPages,
      sampled_pages: sampledPages,
      page_signals: pageSignals,
      document_signals: documentSignals,
      recommendation,
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
    if (loadingTask && typeof loadingTask.destroy === 'function') {
      try {
        await loadingTask.destroy();
      } catch (destroyError: unknown) {
        const message = destroyError instanceof Error ? destroyError.message : String(destroyError);
        logger.warn('Error destroying PDF document after inspection', {
          sourceDescription,
          error: message,
        });
      }
    }
  }
};

export const defaultInspectPdfOptions = (): InspectPdfOptions => ({
  sample_pages: DEFAULT_SAMPLE_PAGES,
  include_metadata: true,
});
