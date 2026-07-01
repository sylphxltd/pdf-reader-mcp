// Shared error-handling utilities for handler and domain layers.
//
// SSS-02 policy: PdfError messages are curated and safe to surface to callers.
// Any other error must be logged with full detail but returned as a generic
// message so raw PDF.js / Node messages cannot leak filesystem or module paths.

import { PdfError } from './errors.js';
import type { Logger } from './logger.js';

/**
 * Extract a safe user-facing message from a caught error.
 *
 * - `PdfError`: returns the curated message directly.
 * - Everything else: logs the raw detail via the logger and returns
 *   `fallbackMessage`, so untrusted internals never leak to callers.
 */
export const safeErrorMessage = (
  error: unknown,
  fallbackMessage: string,
  logger?: Logger,
  logContext?: Record<string, unknown>
): string => {
  if (error instanceof PdfError) return error.message;
  const detail = error instanceof Error ? error.message : String(error);
  logger?.error(fallbackMessage, { error: detail, ...logContext });
  return fallbackMessage;
};
