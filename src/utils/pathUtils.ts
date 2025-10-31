// Removed unused import: import { fileURLToPath } from 'url';

import path from 'node:path';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

// Use the server's current working directory as the project root.
// This relies on the process launching the server to set the CWD correctly.
export const PROJECT_ROOT = process.cwd();

console.info(`[Filesystem MCP - pathUtils] Project Root determined from CWD: ${PROJECT_ROOT}`); // Use info instead of log

/**
 * Resolves a user-provided relative path against the project root,
 * ensuring it stays within the project boundaries.
 * Throws McpError on invalid input, absolute paths, or path traversal.
 * @param userPath The relative path provided by the user.
 * @returns The resolved absolute path.
 */
export const resolvePath = (userPath: string): string => {
  if (typeof userPath !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, 'Path must be a string.');
  }
  const normalizedUserPath = path.normalize(userPath);
  if (path.isAbsolute(normalizedUserPath)) {
    throw new McpError(ErrorCode.InvalidParams, 'Absolute paths are not allowed.');
  }
  // Resolve against the calculated PROJECT_ROOT
  const resolved = path.resolve(PROJECT_ROOT, normalizedUserPath);
  // Security check: Ensure the resolved path is still within the project root
  if (!resolved.startsWith(PROJECT_ROOT)) {
    throw new McpError(ErrorCode.InvalidRequest, 'Path traversal detected. Access denied.');
  }
  return resolved;
};
