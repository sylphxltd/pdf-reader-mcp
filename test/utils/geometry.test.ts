import { describe, expect, test } from 'bun:test';
import { mergeBoundingBoxes, roundRatio } from '../../src/utils/geometry.js';

describe('roundRatio', () => {
  test('rounds to 2 decimal places', () => {
    expect(roundRatio(0.56789)).toBe(0.57);
    expect(roundRatio(1)).toBe(1);
    expect(roundRatio(0.004)).toBe(0);
    expect(roundRatio(0.005)).toBe(0.01);
  });

  test('handles negative values', () => {
    expect(roundRatio(-0.567)).toBe(-0.57);
  });
});

describe('mergeBoundingBoxes', () => {
  test('returns undefined for empty array', () => {
    expect(mergeBoundingBoxes([])).toBeUndefined();
  });

  test('returns undefined for array of undefineds', () => {
    expect(mergeBoundingBoxes([undefined, undefined])).toBeUndefined();
  });

  test('computes union of single box', () => {
    const box = { left: 10, bottom: 20, right: 30, top: 40 };
    expect(mergeBoundingBoxes([box])).toEqual(box);
  });

  test('computes union of multiple boxes', () => {
    const result = mergeBoundingBoxes([
      { left: 10, bottom: 20, right: 30, top: 40 },
      { left: 5, bottom: 15, right: 35, top: 45 },
    ]);
    expect(result).toEqual({ left: 5, bottom: 15, right: 35, top: 45 });
  });

  test('filters out undefined entries', () => {
    const result = mergeBoundingBoxes([
      undefined,
      { left: 10, bottom: 20, right: 30, top: 40 },
      undefined,
    ]);
    expect(result).toEqual({ left: 10, bottom: 20, right: 30, top: 40 });
  });

  test('filters out boxes with NaN coordinates', () => {
    const result = mergeBoundingBoxes([
      { left: NaN, bottom: 20, right: 30, top: 40 },
      { left: 10, bottom: 20, right: 30, top: 40 },
    ]);
    expect(result).toEqual({ left: 10, bottom: 20, right: 30, top: 40 });
  });
});
