// Import only the consolidated PDF tool definition

// Define the structure for a tool definition (used internally and for index.ts)
// We need Zod here to define the schema type correctly
import type { z } from 'zod';
import { readPdfToolDefinition } from './readPdf.js';
export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodType<unknown>;
  // Handler can return text or image content parts
  handler: (args: unknown) => Promise<{
    content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  }>;
}

// Aggregate only the consolidated PDF tool definition
export const allToolDefinitions: ToolDefinition[] = [readPdfToolDefinition];
