// Error handling utilities

/**
 * Extract error message from unknown error type
 * Handles Error objects, strings, and other types consistently
 * @param error - Unknown error value
 * @returns Extracted error message
 */
export const extractErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};
