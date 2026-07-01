// PDF source type — re-exported from the schema (SSOT).
//
// The canonical definition lives in src/schemas/readPdf.ts (pdfSourceSchema).
// This re-export keeps the barrel (types/pdf.ts) backward-compatible for
// modules that import PdfSource from types, while ensuring there is exactly
// one definition.

export type { PdfSource } from '../../schemas/readPdf.js';
