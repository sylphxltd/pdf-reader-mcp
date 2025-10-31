// PDF-related TypeScript type definitions

export interface PdfInfo {
  PDFFormatVersion?: string;
  IsLinearized?: boolean;
  IsAcroFormPresent?: boolean;
  IsXFAPresent?: boolean;
  [key: string]: unknown;
}

export type PdfMetadata = Record<string, unknown>;

export interface ExtractedPageText {
  page: number;
  text: string;
}

export interface ExtractedImage {
  page: number;
  index: number;
  width: number;
  height: number;
  format: string;
  data: string; // base64 encoded image data
}

// Content item with position for ordering
export interface PageContentItem {
  type: 'text' | 'image';
  yPosition: number;
  textContent?: string;
  imageData?: ExtractedImage;
}

export interface PdfResultData {
  info?: PdfInfo;
  metadata?: PdfMetadata;
  num_pages?: number;
  full_text?: string;
  page_texts?: ExtractedPageText[];
  page_contents?: Array<{ page: number; items: PageContentItem[] }>;
  images?: ExtractedImage[];
  warnings?: string[];
}

export interface PdfSourceResult {
  source: string;
  success: boolean;
  data?: PdfResultData | undefined;
  error?: string;
}

export interface PdfSource {
  path?: string | undefined;
  url?: string | undefined;
  pages?: string | number[] | undefined;
}

export interface ReadPdfOptions {
  include_full_text: boolean;
  include_metadata: boolean;
  include_page_count: boolean;
  include_images: boolean;
}
