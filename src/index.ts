#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod'; // Import Zod
import { zodToJsonSchema } from 'zod-to-json-schema';
// Import the aggregated tool definitions
import { allToolDefinitions } from './handlers/index.js';

// Removed incorrect import left over from partial diff

// --- Tool Names (Constants) ---
// Removed tool name constants, names are now in the definitions

// --- Server Setup ---

const server = new Server(
  {
    name: 'pdf-reader-mcp',
    version: '1.0.0',
    description:
      'MCP Server for reading PDF files and extracting text, metadata, and page information.',
  },
  {
    capabilities: { tools: {} },
  }
);

// Helper function to convert Zod schema to JSON schema for MCP
// Use 'unknown' instead of 'any' for better type safety, although casting is still needed for the SDK
const generateInputSchema = (schema: z.ZodType<unknown>): object => {
  // Need to cast as 'unknown' then 'object' because zodToJsonSchema might return slightly incompatible types for MCP SDK
  return zodToJsonSchema(schema, { target: 'openApi3' }) as unknown as object;
};

server.setRequestHandler(ListToolsRequestSchema, () => {
  // Removed unnecessary async
  // Removed log
  // Map the aggregated definitions to the format expected by the SDK
  const availableTools = allToolDefinitions.map((def) => ({
    name: def.name,
    description: def.description,
    inputSchema: generateInputSchema(def.schema), // Generate JSON schema from Zod schema
  }));
  return { tools: availableTools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Use imported handlers
  // Find the tool definition by name and call its handler
  const toolDefinition = allToolDefinitions.find((def) => def.name === request.params.name);

  if (!toolDefinition) {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
  }

  // Call the handler associated with the found definition
  // The handler itself will perform Zod validation on the arguments
  return toolDefinition.handler(request.params.arguments);
});

// --- Server Start ---

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[PDF Reader MCP] Server running on stdio');
}

main().catch((error: unknown) => {
  // Specify 'unknown' type for catch variable
  console.error('[PDF Reader MCP] Server error:', error);
  process.exit(1);
});
