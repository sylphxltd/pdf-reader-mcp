// PDF document structure type definitions (outline, annotations, forms, attachments, structure tree, info)

import type { BoundingBox } from './geometry.js';

export interface PdfOutlineItem {
  title: string;
  bold?: boolean | undefined;
  italic?: boolean | undefined;
  color?: number[] | undefined;
  url?: string | undefined;
  dest?: unknown;
  items?: PdfOutlineItem[] | undefined;
}

export interface PdfAnnotation {
  page: number;
  id?: string | undefined;
  subtype?: string | undefined;
  contents?: string | undefined;
  title?: string | undefined;
  url?: string | undefined;
  dest?: unknown;
  bounding_box?: BoundingBox | undefined;
}

export interface PdfPageAnnotations {
  page: number;
  annotations: PdfAnnotation[];
}

export interface PdfFormField {
  name: string;
  type?: string | undefined;
  value?: unknown;
  default_value?: unknown;
  page?: number | undefined;
  id?: string | undefined;
  editable?: boolean | undefined;
  required?: boolean | undefined;
  bounding_box?: BoundingBox | undefined;
}

export interface PdfAttachment {
  name: string;
  filename?: string | undefined;
  description?: string | undefined;
  size_bytes?: number | undefined;
}

export interface PdfStructureTreeContent {
  type: string;
  id?: string | undefined;
}

export type PdfStructureTreeChild = PdfStructureTreeNode | PdfStructureTreeContent;

export interface PdfStructureTreeNode {
  role: string;
  children?: PdfStructureTreeChild[] | undefined;
}

export interface PdfPageStructureTree {
  page: number;
  tree: PdfStructureTreeNode;
}

export interface PdfInfo {
  PDFFormatVersion?: string;
  IsLinearized?: boolean;
  IsAcroFormPresent?: boolean;
  IsXFAPresent?: boolean;
  [key: string]: unknown;
}

export type PdfMetadata = Record<string, unknown>;
