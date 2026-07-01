// Shared geometry helpers used across PDF domain modules.
// Eliminates duplicated roundRatio and mergeBoundingBoxes implementations.

/** Round to 2 decimal places for confidence/ratio reporting. */
export const roundRatio = (value: number): number => Math.round(value * 100) / 100;

export interface BoundingBox {
  left: number;
  bottom: number;
  right: number;
  top: number;
}

/**
 * Compute the union of a list of bounding boxes.
 * Returns `undefined` if no box has finite coordinates.
 */
export const mergeBoundingBoxes = (
  boxes: ReadonlyArray<BoundingBox | undefined>
): BoundingBox | undefined => {
  const valid = boxes.filter(
    (b): b is BoundingBox =>
      b !== undefined &&
      Number.isFinite(b.left) &&
      Number.isFinite(b.bottom) &&
      Number.isFinite(b.right) &&
      Number.isFinite(b.top)
  );
  if (valid.length === 0) return undefined;
  return {
    left: Math.min(...valid.map((b) => b.left)),
    bottom: Math.min(...valid.map((b) => b.bottom)),
    right: Math.max(...valid.map((b) => b.right)),
    top: Math.max(...valid.map((b) => b.top)),
  };
};
