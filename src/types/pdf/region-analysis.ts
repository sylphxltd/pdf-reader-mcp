// PDF region analysis type definitions

import type { PdfRegionBoundingBox, PdfRegionCropPixels } from './regions.js';

export type PdfRegionAnalysisProvider = 'command';

export type PdfRegionAnalysisKind =
  | 'text'
  | 'table'
  | 'figure'
  | 'chart'
  | 'formula'
  | 'image'
  | 'diagram'
  | 'unknown';

export interface PdfRegionAnalysisTable {
  rows?: string[][] | undefined;
  markdown?: string | undefined;
  csv?: string | undefined;
  confidence?: number | undefined;
}

export interface PdfRegionAnalysisFormula {
  latex?: string | undefined;
  text?: string | undefined;
  confidence?: number | undefined;
}

export interface PdfRegionAnalysisChart {
  title?: string | undefined;
  summary?: string | undefined;
  data_points?: Array<Record<string, string | number | boolean | null>> | undefined;
  confidence?: number | undefined;
}

export interface PdfRegionAnalysisData {
  region_id: string;
  page: number;
  kind: PdfRegionAnalysisKind;
  description?: string | undefined;
  text?: string | undefined;
  markdown?: string | undefined;
  confidence?: number | undefined;
  table?: PdfRegionAnalysisTable | undefined;
  formula?: PdfRegionAnalysisFormula | undefined;
  chart?: PdfRegionAnalysisChart | undefined;
  provider: PdfRegionAnalysisProvider;
  source_crop_evidence_id: string;
  source_bounding_box: PdfRegionBoundingBox;
  crop_pixels: PdfRegionCropPixels;
  scale: number;
  provenance: {
    engine: 'external-command';
    source: 'region-analysis-provider';
  };
  warnings?: string[] | undefined;
}

export interface PdfRegionAnalysisSourceResult {
  source: string;
  success: boolean;
  num_pages?: number | undefined;
  region_analyses?: PdfRegionAnalysisData[] | undefined;
  warnings?: string[] | undefined;
  error?: string | undefined;
}

export interface AnalyzeRegionsOptions {
  scale: number;
  max_regions: number;
  max_pixels_per_page: number;
  timeout_ms: number;
  max_output_chars: number;
  languages?: string[] | undefined;
}
