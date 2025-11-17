// Removed unused import: import { fileURLToPath } from 'url';

import path from 'node:path';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

// Use the server's current working directory as the project root.
// This relies on the process launching the server to set the CWD correctly.
export const PROJECT_ROOT = process.cwd();

// Removed console.info to prevent stderr pollution during MCP initialization
// This was causing handshake failures with some MCP clients (e.g., Codex)
// Debug logging can be enabled via DEBUG_MCP environment variable in index.ts

/**
 * Resolves a user-provided path, accepting both absolute and relative paths.
 * Relative paths are resolved against the current working directory (PROJECT_ROOT).
 * @param userPath The path provided by the user (absolute or relative).
 * @returns The resolved absolute path.
 */
export const resolvePath = (userPath: string): string => {
  if (typeof userPath !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, 'Path must be a string.');
  }
  const normalizedUserPath = path.normalize(userPath);
  // If absolute path, return it normalized
  if (path.isAbsolute(normalizedUserPath)) {
    return normalizedUserPath;
  }
  // If relative path, resolve against the PROJECT_ROOT (cwd)
  return path.resolve(PROJECT_ROOT, normalizedUserPath);
};
