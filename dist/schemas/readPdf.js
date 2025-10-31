// Zod validation schemas for PDF reading
import { z } from 'zod';
// Schema for page specification (array of numbers or range string)
export const pageSpecifierSchema = z.union([
    z
        .array(z.number().int().min(1))
        .min(1)
        .describe('Array of page numbers (1-based)'),
    z
        .string()
        .min(1)
        .refine((val) => /^[0-9,-]+$/.test(val.replace(/\s/g, '')), {
        message: 'Page string must contain only numbers, commas, and hyphens.',
    })
        .describe('Page range string (e.g., "1-5,10,15-20")'),
]);
// Schema for a single PDF source (path or URL)
export const pdfSourceSchema = z
    .object({
    path: z.string().min(1).optional().describe('Relative path to the local PDF file.'),
    url: z.string().url().optional().describe('URL of the PDF file.'),
    pages: pageSpecifierSchema
        .optional()
        .describe("Extract text only from specific pages (1-based) or ranges for this source. If provided, 'include_full_text' is ignored for this source."),
})
    .strict()
    .refine((data) => !!(data.path && !data.url) || !!(!data.path && data.url), {
    message: "Each source must have either 'path' or 'url', but not both.",
});
// Schema for the read_pdf tool arguments
export const readPdfArgsSchema = z
    .object({
    sources: z
        .array(pdfSourceSchema)
        .min(1)
        .describe('An array of PDF sources to process, each can optionally specify pages.'),
    include_full_text: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include the full text content of each PDF (only if 'pages' is not specified for that source)."),
    include_metadata: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include metadata and info objects for each PDF.'),
    include_page_count: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include the total number of pages for each PDF.'),
})
    .strict();
