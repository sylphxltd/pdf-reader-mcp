// PDF layout diagnostics type definitions

export type PdfLayoutProfile =
  | 'single_column'
  | 'multi_column'
  | 'mixed_layout'
  | 'image_or_sparse'
  | 'unknown';

export type PdfReadingOrderModel = 'natural' | 'columnar' | 'mixed' | 'uncertain';

export interface PdfLayoutColumn {
  index: number;
  left: number;
  right: number;
  item_count: number;
}

export interface PdfPageLayoutDiagnostics {
  page: number;
  profile: PdfLayoutProfile;
  reading_order: PdfReadingOrderModel;
  confidence: number;
  item_count: number;
  text_item_count: number;
  image_item_count: number;
  positioned_item_ratio: number;
  column_count: number;
  columns?: PdfLayoutColumn[] | undefined;
  signals: string[];
  warnings?: string[] | undefined;
}
