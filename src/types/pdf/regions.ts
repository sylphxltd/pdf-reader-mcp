// PDF region crop type definitions

export interface PdfRegionBoundingBox {
  left: number;
  bottom: number;
  right: number;
  top: number;
}

export interface PdfRegionRequest {
  id?: string | undefined;
  page: number;
  bounding_box: PdfRegionBoundingBox;
  padding?: number | undefined;
}

export interface PdfRegionCropPixels {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PdfRegionCropProvenance {
  engine: 'pdfjs';
  renderer: '@napi-rs/canvas';
  source: 'region-crop';
  page_render_evidence_id: string;
}

export interface PdfRegionCropData {
  region_id: string;
  page: number;
  evidence_id: string;
  source_bounding_box: PdfRegionBoundingBox;
  crop_pixels: PdfRegionCropPixels;
  scale: number;
  byte_length: number;
  format: 'png';
  mime_type: 'image/png';
  provenance: PdfRegionCropProvenance;
  data: string;
}

export interface PdfRegionCropSummary extends Omit<PdfRegionCropData, 'data'> {
  image_content_index?: number | undefined;
}

export interface PdfRegionCropSourceResult {
  source: string;
  success: boolean;
  num_pages?: number | undefined;
  regions?: PdfRegionCropSummary[] | undefined;
  warnings?: string[] | undefined;
  error?: string | undefined;
}

export interface ExtractRegionsOptions {
  scale: number;
  max_regions: number;
  max_pixels_per_page: number;
  include_image: boolean;
}
