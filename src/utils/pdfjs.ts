// Shared pdfjs lifecycle helpers to eliminate duplicated cleanup blocks.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Logger } from './logger.js';

/** Shared promisified execFile for OCR and region-analysis providers. */
export const execFileAsync = promisify(execFile);

/**
 * Safely destroy a pdfjs loading task.
 * Guards against undefined and missing destroy method.
 * Logs a warning if destroy throws, with the caller's logger and context.
 */
export const destroyLoadingTask = async (
  loadingTask: unknown,
  logger?: Logger,
  logLabel = 'PDF document',
  logContext?: Record<string, unknown>
): Promise<void> => {
  if (
    loadingTask &&
    typeof loadingTask === 'object' &&
    'destroy' in loadingTask &&
    typeof (loadingTask as { destroy: unknown }).destroy === 'function'
  ) {
    try {
      await (loadingTask as { destroy: () => Promise<void> }).destroy();
    } catch (destroyError: unknown) {
      logger?.warn(`Error destroying ${logLabel}`, {
        error: destroyError instanceof Error ? destroyError.message : String(destroyError),
        ...logContext,
      });
    }
  }
};
