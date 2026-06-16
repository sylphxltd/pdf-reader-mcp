// PDF content safety type definitions

import type { BoundingBox } from './geometry.js';

export type PdfSafetyFindingType = 'prompt_injection_pattern' | 'off_page_text' | 'tiny_text';

export type PdfSafetySeverity = 'low' | 'medium' | 'high';

export interface PdfSafetyFinding {
  type: PdfSafetyFindingType;
  severity: PdfSafetySeverity;
  page: number;
  message: string;
  element_id?: string | undefined;
  snippet?: string | undefined;
  bounding_box?: BoundingBox | undefined;
}
