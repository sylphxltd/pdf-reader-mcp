// PDF geometry type definitions

export interface BoundingBox {
  left: number;
  bottom: number;
  right: number;
  top: number;
}

export interface PdfPageGeometry {
  page: number;
  width: number;
  height: number;
  rotation: number;
  user_unit?: number | undefined;
  view_box?: BoundingBox | undefined;
}
