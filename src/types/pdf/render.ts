// PDF page render type definitions

export interface PdfPageRenderProvenance {
  engine: 'pdfjs';
  renderer: '@napi-rs/canvas';
  source: 'page-render';
}

export interface PdfPageRenderData {
  page: number;
  evidence_id: string;
  width: number;
  height: number;
  scale: number;
  pixel_count: number;
  byte_length: number;
  format: 'png';
  mime_type: 'image/png';
  rotation: number;
  provenance: PdfPageRenderProvenance;
  data: string;
}

export interface PdfPageRenderSummary extends Omit<PdfPageRenderData, 'data'> {
  image_content_index?: number | undefined;
}

export interface PdfPageRenderSourceResult {
  source: string;
  success: boolean;
  num_pages?: number | undefined;
  rendered_pages?: PdfPageRenderSummary[] | undefined;
  warnings?: string[] | undefined;
  error?: string | undefined;
}

export interface RenderPageOptions {
  scale: number;
  max_pages: number;
  max_pixels_per_page: number;
  include_image: boolean;
}
