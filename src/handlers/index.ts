// Import only the consolidated PDF tool definition

// Define the structure for a tool definition (used internally and for index.ts)
// We need Zod here to define the schema type correctly
import type { z } from 'zod';
import { readPdfToolDefinition } from './readPdf.js';
export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodType<unknown>; // Use Zod schema type with unknown
  // Define the specific return type expected by the SDK for tool handlers
  handler: (args: unknown) => Promise<{ content: { type: string; text: string }[] }>;
}

// Aggregate only the consolidated PDF tool definition
export const allToolDefinitions: ToolDefinition[] = [readPdfToolDefinition];
