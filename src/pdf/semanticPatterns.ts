import type { PdfRegionAnalysisKind } from '../types/pdf.js';

export type SemanticCaptionKind = Extract<
  PdfRegionAnalysisKind,
  'table' | 'figure' | 'chart' | 'formula' | 'image' | 'diagram'
>;

const CAPTION_PREFIX_PATTERN =
  /^(fig(?:ure)?|table|chart|graph|plot|formula|eq(?:uation)?|image|diagram|algorithm|exhibit)\.?(?:(?:\s*(?:\(?[a-z]?\d+(?:[.-]\d+)*[a-z]?\)?|\([A-Z]\)|[ivxlcdm]+)(?:\s*[:.)\u2013\u2014-]|\s+|$))|\s*[:)\u2013\u2014-])/iu;

const CAPTION_KIND_ALIASES: Record<string, SemanticCaptionKind> = {
  algorithm: 'figure',
  chart: 'chart',
  diagram: 'diagram',
  eq: 'formula',
  equation: 'formula',
  exhibit: 'figure',
  fig: 'figure',
  figure: 'figure',
  formula: 'formula',
  graph: 'chart',
  image: 'image',
  plot: 'chart',
  table: 'table',
};

export const semanticCaptionKind = (text: string | undefined): SemanticCaptionKind | undefined => {
  const rawKind = text?.trim().match(CAPTION_PREFIX_PATTERN)?.[1]?.toLowerCase();
  if (!rawKind) return undefined;

  return CAPTION_KIND_ALIASES[rawKind];
};

export const hasSemanticCaptionPrefix = (text: string | undefined): boolean =>
  semanticCaptionKind(text) !== undefined;
