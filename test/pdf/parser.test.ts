import { describe, expect, it, vi } from 'vitest';
import { determinePagesToProcess, getTargetPages, parsePageRanges } from '../../src/pdf/parser.js';
import { ErrorCode, PdfError } from '../../src/utils/errors.js';

describe('parser', () => {
  describe('parsePageRanges', () => {
    it('should parse single page', () => {
      expect(parsePageRanges('5')).toEqual([5]);
    });

    it('should parse simple range', () => {
      expect(parsePageRanges('1-3')).toEqual([1, 2, 3]);
    });

    it('should parse multiple ranges and pages', () => {
      expect(parsePageRanges('1-3,5,7-9')).toEqual([1, 2, 3, 5, 7, 8, 9]);
    });

    it('should handle open-ended range', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = parsePageRanges('1-');
      expect(result.length).toBe(10001); // 1 to 10001 inclusive
      expect(result[0]).toBe(1);
      expect(result[result.length - 1]).toBe(10001);
      // Logger outputs message first, then structured JSON
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Open-ended range truncated')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should deduplicate and sort pages', () => {
      expect(parsePageRanges('3,1,2,1,3')).toEqual([1, 2, 3]);
    });

    it('should handle ranges with spaces', () => {
      expect(parsePageRanges(' 1 - 3 , 5 ')).toEqual([1, 2, 3, 5]);
    });

    it('should throw on invalid range format', () => {
      expect(() => parsePageRanges('-5')).toThrow('Invalid page');
    });

    it('should throw on invalid page number', () => {
      expect(() => parsePageRanges('0')).toThrow('Invalid page number: 0');
      expect(() => parsePageRanges('-1')).toThrow('Invalid page');
      expect(() => parsePageRanges('abc')).toThrow('Invalid page number');
    });

    it('should throw on invalid range values', () => {
      expect(() => parsePageRanges('5-3')).toThrow('Invalid page range values');
      expect(() => parsePageRanges('0-5')).toThrow('Invalid page range values');
    });

    it('should throw on empty or invalid input', () => {
      expect(() => parsePageRanges('')).toThrow('Invalid page');
    });
  });

  describe('getTargetPages', () => {
    it('should return undefined when sourcePages is undefined', () => {
      expect(getTargetPages(undefined, 'test.pdf')).toBeUndefined();
    });

    it('should parse string ranges', () => {
      expect(getTargetPages('1-3,5', 'test.pdf')).toEqual([1, 2, 3, 5]);
    });

    it('should validate array of numbers', () => {
      expect(getTargetPages([1, 3, 5], 'test.pdf')).toEqual([1, 3, 5]);
    });

    it('should deduplicate array of numbers', () => {
      expect(getTargetPages([3, 1, 2, 1, 3], 'test.pdf')).toEqual([1, 2, 3]);
    });

    it('should throw PdfError on invalid page numbers in array', () => {
      expect(() => getTargetPages([1, 0, 3], 'test.pdf')).toThrow(PdfError);
      expect(() => getTargetPages([1, 0, 3], 'test.pdf')).toThrow(
        'Invalid page specification for source test.pdf'
      );
    });

    it('should throw PdfError on non-integer page numbers', () => {
      expect(() => getTargetPages([1, 2.5, 3], 'test.pdf')).toThrow(PdfError);
      expect(() => getTargetPages([1, 2.5, 3], 'test.pdf')).toThrow(
        'Page numbers in array must be positive integers'
      );
    });

    it('should throw PdfError on negative page numbers', () => {
      expect(() => getTargetPages([1, -1, 3], 'test.pdf')).toThrow(PdfError);
    });

    it('should throw PdfError when result is empty after deduplication', () => {
      expect(() => getTargetPages([], 'test.pdf')).toThrow(PdfError);
      expect(() => getTargetPages([], 'test.pdf')).toThrow(
        'Page specification resulted in an empty set of pages'
      );
    });

    it('should throw PdfError with proper error code', () => {
      try {
        getTargetPages([0], 'test.pdf');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PdfError);
        expect((error as PdfError).code).toBe(ErrorCode.InvalidParams);
      }
    });

    it('should handle non-Error exceptions from parsePageRanges', () => {
      // This tests the String(error) path
      expect(() => getTargetPages('invalid-range', 'test.pdf')).toThrow(PdfError);
    });
  });

  describe('determinePagesToProcess', () => {
    it('should filter valid target pages', () => {
      const result = determinePagesToProcess([1, 2, 5, 10, 15], 10, false);
      expect(result.pagesToProcess).toEqual([1, 2, 5, 10]);
      expect(result.invalidPages).toEqual([15]);
    });

    it('should return all pages when includeFullText is true and no target', () => {
      const result = determinePagesToProcess(undefined, 5, true);
      expect(result.pagesToProcess).toEqual([1, 2, 3, 4, 5]);
      expect(result.invalidPages).toEqual([]);
    });

    it('should return empty when no target and includeFullText is false', () => {
      const result = determinePagesToProcess(undefined, 10, false);
      expect(result.pagesToProcess).toEqual([]);
      expect(result.invalidPages).toEqual([]);
    });

    it('should handle all target pages being invalid', () => {
      const result = determinePagesToProcess([11, 12, 13], 10, false);
      expect(result.pagesToProcess).toEqual([]);
      expect(result.invalidPages).toEqual([11, 12, 13]);
    });

    it('should handle all target pages being valid', () => {
      const result = determinePagesToProcess([1, 2, 3], 10, false);
      expect(result.pagesToProcess).toEqual([1, 2, 3]);
      expect(result.invalidPages).toEqual([]);
    });

    it('should work with target pages when includeFullText is true', () => {
      // Target pages override includeFullText
      const result = determinePagesToProcess([2, 4], 10, true);
      expect(result.pagesToProcess).toEqual([2, 4]);
      expect(result.invalidPages).toEqual([]);
    });
  });
});
