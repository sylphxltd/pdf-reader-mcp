// PDF region analysis type definitions

import type { BoundingBox } from './geometry.js';
import type { PdfRegionBoundingBox, PdfRegionCropPixels } from './regions.js';

export type PdfRegionAnalysisProvider = 'command' | 'http';

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
  row_count?: number | undefined;
  column_count?: number | undefined;
  cells?: PdfRegionAnalysisTableCell[] | undefined;
  confidence?: number | undefined;
}

export interface PdfRegionAnalysisTableCell {
  text: string;
  row_index: number;
  column_index: number;
  row_span?: number | undefined;
  column_span?: number | undefined;
  confidence?: number | undefined;
  bounding_box?: BoundingBox | undefined;
}

export interface PdfRegionAnalysisFormula {
  latex?: string | undefined;
  mathml?: string | undefined;
  asciimath?: string | undefined;
  text?: string | undefined;
  confidence?: number | undefined;
}

export interface PdfRegionAnalysisChartAxis {
  label?: string | undefined;
  unit?: string | undefined;
  min?: number | undefined;
  max?: number | undefined;
}

export interface PdfRegionAnalysisChartSeries {
  name?: string | undefined;
  data_points: Array<Record<string, string | number | boolean | null>>;
  confidence?: number | undefined;
}

export interface PdfRegionAnalysisChart {
  title?: string | undefined;
  summary?: string | undefined;
  data_points?: Array<Record<string, string | number | boolean | null>> | undefined;
  x_axis?: PdfRegionAnalysisChartAxis | undefined;
  y_axis?: PdfRegionAnalysisChartAxis | undefined;
  series?: PdfRegionAnalysisChartSeries[] | undefined;
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
    engine: 'external-command' | 'external-http';
    source: 'region-analysis-provider';
  };
  warnings?: string[] | undefined;
}

export type PdfVisualEnrichmentTargetType =
  | 'image'
  | 'table'
  | 'figure'
  | 'chart'
  | 'formula'
  | 'diagram'
  | 'visual_region';

export interface PdfVisualEnrichmentCandidate {
  id: string;
  page: number;
  region: import('./regions.js').PdfRegionRequest;
  target_element_id: string;
  target_element_type: PdfVisualEnrichmentTargetType;
  source_element_id?: string | undefined;
  source_caption_element_id?: string | undefined;
  source_caption_text?: string | undefined;
  candidate_signals: string[];
}

export interface PdfVisualEnrichment extends PdfRegionAnalysisData {
  id: string;
  target_element_id: string;
  target_element_type: PdfVisualEnrichmentTargetType;
  source_caption_element_id?: string | undefined;
  source_caption_text?: string | undefined;
  candidate_signals?: string[] | undefined;
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
