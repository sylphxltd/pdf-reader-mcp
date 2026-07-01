import { describe, expect, mock, test } from 'bun:test';
import { safeErrorMessage } from '../../src/utils/errorHandling.js';
import { ErrorCode, PdfError } from '../../src/utils/errors.js';
import { createLogger } from '../../src/utils/logger.js';

describe('safeErrorMessage', () => {
  test('returns PdfError message directly', () => {
    const error = new PdfError(ErrorCode.InvalidParams, 'Curated error message');
    expect(safeErrorMessage(error, 'Fallback')).toBe('Curated error message');
  });

  test('returns fallback for generic Error and logs detail', () => {
    const logger = createLogger('Test', 0);
    const errorSpy = mock(() => {});
    const origError = console.error;
    console.error = errorSpy;

    const result = safeErrorMessage(
      new Error('Internal /secret/path leak'),
      'Generic fallback',
      logger,
      { sourceDescription: 'test.pdf' }
    );

    console.error = origError;
    expect(result).toBe('Generic fallback');
    expect(errorSpy).toHaveBeenCalled();
  });

  test('returns fallback for non-Error values', () => {
    const result = safeErrorMessage('string error', 'Fallback');
    expect(result).toBe('Fallback');
  });

  test('returns fallback for null', () => {
    const result = safeErrorMessage(null, 'Null fallback');
    expect(result).toBe('Null fallback');
  });

  test('works without a logger', () => {
    const result = safeErrorMessage(new Error('bad'), 'No logger fallback');
    expect(result).toBe('No logger fallback');
  });
});
