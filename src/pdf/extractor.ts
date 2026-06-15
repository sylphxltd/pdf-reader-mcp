// PDF text and metadata extraction utilities

import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PNG } from 'pngjs';
import type {
  BoundingBox,
  ExtractedImage,
  ExtractedPageText,
  PageContentItem,
  PageTextRunCharEvidence,
  PageTextRunEvidence,
  PdfAnnotation,
  PdfAttachment,
  PdfFormField,
  PdfInfo,
  PdfMetadata,
  PdfOutlineItem,
  PdfPageAnnotations,
  PdfPageGeometry,
  PdfPageStructureTree,
  PdfResultData,
  PdfStructureTreeChild,
  PdfStructureTreeContent,
  PdfStructureTreeNode,
} from '../types/pdf.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Extractor');
const TEXT_SEGMENT_GAP_THRESHOLD = 48;
const COLUMN_CUT_MIN_GAP = 48;
const COLUMN_CUT_MIN_WIDTH_RATIO = 0.12;
const SPANNING_WIDTH_RATIO = 0.72;
const XY_CUT_MAX_DEPTH = 8;
const XY_CUT_MIN_ITEMS = 4;
const XY_CUT_MIN_HORIZONTAL_GAP = 36;
const XY_CUT_MIN_HORIZONTAL_GAP_RATIO = 0.04;

interface TextRowPart {
  text: string;
  x: number;
  width: number;
  height: number;
  bounding_box?: BoundingBox | undefined;
  font_name?: string | undefined;
  direction?: string | undefined;
  transform?: number[] | undefined;
  has_eol?: boolean | undefined;
  chars: PageTextRunCharEvidence[];
}

interface RawOutlineItem {
  title?: string;
  bold?: boolean;
  italic?: boolean;
  color?: ArrayLike<number>;
  url?: string;
  dest?: unknown;
  items?: RawOutlineItem[];
}

interface RawAnnotation {
  id?: string;
  subtype?: string;
  contents?: string;
  contentsObj?: { str?: string };
  title?: string;
  titleObj?: { str?: string };
  url?: string;
  unsafeUrl?: string;
  dest?: unknown;
  rect?: number[];
}

interface RawFormField {
  id?: string;
  name?: string;
  fieldName?: string;
  type?: string;
  fieldType?: string;
  value?: unknown;
  defaultValue?: unknown;
  // PDF.js exposes both `page` and `pageIndex` as zero-based page indexes.
  page?: number;
  pageIndex?: number;
  editable?: boolean;
  required?: boolean;
  rect?: number[];
}

interface RawAttachment {
  filename?: string;
  description?: string;
  content?: Uint8Array | ArrayBuffer | { byteLength?: number; length?: number };
}

interface PdfDocumentWithOptionalStructure {
  getOutline?: () => Promise<RawOutlineItem[] | null>;
  getPageLabels?: () => Promise<string[] | null>;
  getPermissions?: () => Promise<number[] | null>;
  getMarkInfo?: () => Promise<Record<string, unknown> | null>;
  getFieldObjects?: () => Promise<Record<string, RawFormField[] | RawFormField> | null>;
  getAttachments?: () => Promise<Record<string, RawAttachment> | null>;
}

interface PdfPageWithOptionalAnnotations {
  getAnnotations?: (params?: { intent?: 'display' | 'print' | 'any' }) => Promise<RawAnnotation[]>;
}

interface RawStructTreeNode {
  role?: unknown;
  children?: unknown;
}

interface RawStructTreeContent {
  type?: unknown;
  id?: unknown;
}

interface PdfPageWithOptionalStructureTree {
  getStructTree?: () => Promise<RawStructTreeNode | null>;
}

type PdfPageWithGeometry = pdfjsLib.PDFPageProxy & {
  view?: ReadonlyArray<number>;
  rotate?: number;
  userUnit?: number;
};

const mergeBoundingBoxes = (boxes: Array<BoundingBox | undefined>): BoundingBox | undefined => {
  const validBoxes = boxes.filter((box): box is BoundingBox => box !== undefined);
  if (validBoxes.length === 0) return undefined;

  return {
    left: Math.min(...validBoxes.map((box) => box.left)),
    bottom: Math.min(...validBoxes.map((box) => box.bottom)),
    right: Math.max(...validBoxes.map((box) => box.right)),
    top: Math.max(...validBoxes.map((box) => box.top)),
  };
};

const buildBoundingBox = (
  x: number | undefined,
  y: number | undefined,
  width: number | undefined,
  height: number | undefined
): BoundingBox | undefined => {
  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return undefined;
  }

  if (![x, y, width, height].every(Number.isFinite)) {
    return undefined;
  }

  return {
    left: x,
    bottom: y,
    right: x + Math.max(0, width),
    top: y + Math.max(0, height),
  };
};

const buildRectBoundingBox = (rect: ReadonlyArray<number> | undefined): BoundingBox | undefined => {
  if (!rect || rect.length < 4) return undefined;
  const [x1, y1, x2, y2] = rect;
  if (
    x1 === undefined ||
    y1 === undefined ||
    x2 === undefined ||
    y2 === undefined ||
    ![x1, y1, x2, y2].every(Number.isFinite)
  ) {
    return undefined;
  }

  return {
    left: Math.min(x1, x2),
    bottom: Math.min(y1, y2),
    right: Math.max(x1, x2),
    top: Math.max(y1, y2),
  };
};

const estimateCharacterBoundingBox = (
  runBox: BoundingBox | undefined,
  textLength: number,
  charStart: number,
  charEnd: number
): BoundingBox | undefined => {
  if (!runBox || textLength <= 0 || charEnd <= charStart) return undefined;

  const width = runBox.right - runBox.left;
  if (!Number.isFinite(width) || width <= 0) return undefined;

  const startRatio = Math.max(0, Math.min(1, charStart / textLength));
  const endRatio = Math.max(startRatio, Math.min(1, charEnd / textLength));

  return {
    left: runBox.left + width * startRatio,
    bottom: runBox.bottom,
    right: runBox.left + width * endRatio,
    top: runBox.top,
  };
};

const buildRunChars = (
  text: string,
  runBox: BoundingBox | undefined
): PageTextRunCharEvidence[] => {
  const chars: PageTextRunCharEvidence[] = [];

  for (let cursor = 0; cursor < text.length; ) {
    const codePoint = text.codePointAt(cursor);
    const char = codePoint === undefined ? text[cursor] : String.fromCodePoint(codePoint);
    if (char === undefined) break;

    const charStart = cursor;
    const charEnd = cursor + char.length;
    const boundingBox = estimateCharacterBoundingBox(runBox, text.length, charStart, charEnd);

    chars.push({
      index: chars.length,
      text: char,
      item_char_start: charStart,
      item_char_end: charEnd,
      is_whitespace: /\s/u.test(char),
      ...(boundingBox ? { bounding_box: boundingBox, confidence: 0.74 } : {}),
    });

    cursor = charEnd;
  }

  return chars;
};

const finiteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const textFromAnnotationField = (
  direct: string | undefined,
  objectValue: { str?: string } | undefined
): string | undefined => {
  const value = direct ?? objectValue?.str;
  return value && value.trim().length > 0 ? value : undefined;
};

const sanitizeOutlineItems = (items: RawOutlineItem[]): PdfOutlineItem[] =>
  items
    .map((item): PdfOutlineItem | undefined => {
      const title = item.title?.trim();
      if (!title) return undefined;

      const children = item.items ? sanitizeOutlineItems(item.items) : undefined;
      return {
        title,
        ...(item.bold !== undefined ? { bold: item.bold } : {}),
        ...(item.italic !== undefined ? { italic: item.italic } : {}),
        ...(item.color ? { color: Array.from(item.color) } : {}),
        ...(item.url ? { url: item.url } : {}),
        ...(item.dest !== undefined ? { dest: item.dest } : {}),
        ...(children && children.length > 0 ? { items: children } : {}),
      };
    })
    .filter((item): item is PdfOutlineItem => item !== undefined);

const PDF_PERMISSION_LABELS = new Map<number, string>([
  [4, 'print'],
  [8, 'modify'],
  [16, 'copy'],
  [32, 'annotate'],
  [256, 'fill_forms'],
  [512, 'copy_for_accessibility'],
  [1024, 'assemble'],
  [2048, 'print_high_quality'],
]);

const permissionLabels = (permissions: number[]): string[] =>
  permissions.map(
    (permission) => PDF_PERMISSION_LABELS.get(permission) ?? `unknown:${String(permission)}`
  );

const attachmentSize = (content: RawAttachment['content']): number | undefined => {
  if (!content) return undefined;
  if ('byteLength' in content && typeof content.byteLength === 'number') {
    return content.byteLength;
  }
  if ('length' in content && typeof content.length === 'number') {
    return content.length;
  }
  return undefined;
};

const textSegmentToContentItem = (y: number, segment: TextRowPart[]): PageContentItem | null => {
  const textContent = segment.map((part) => part.text).join('');
  if (!textContent.trim()) return null;

  const boundingBox = mergeBoundingBoxes(segment.map((part) => part.bounding_box));
  const xPosition = boundingBox?.left ?? segment[0]?.x;
  const width =
    boundingBox !== undefined
      ? boundingBox.right - boundingBox.left
      : segment.reduce((sum, part) => sum + part.width, 0);
  const height =
    boundingBox !== undefined
      ? boundingBox.top - boundingBox.bottom
      : Math.max(...segment.map((part) => part.height), 0);

  const textRuns: PageTextRunEvidence[] = [];
  let itemCharOffset = 0;

  for (const part of segment) {
    const runBox = part.bounding_box;
    const chars = part.chars.map((char) => ({
      ...char,
      item_char_start: itemCharOffset + char.item_char_start,
      item_char_end: itemCharOffset + char.item_char_end,
    }));

    textRuns.push({
      index: textRuns.length,
      text: part.text,
      item_char_start: itemCharOffset,
      item_char_end: itemCharOffset + part.text.length,
      ...(runBox ? { bounding_box: runBox } : {}),
      ...(part.font_name ? { font_name: part.font_name } : {}),
      ...(part.direction ? { direction: part.direction } : {}),
      ...(part.transform ? { transform: part.transform } : {}),
      ...(part.has_eol !== undefined ? { has_eol: part.has_eol } : {}),
      chars,
    });

    itemCharOffset += part.text.length;
  }

  return {
    type: 'text',
    yPosition: y,
    xPosition,
    width,
    height,
    bounding_box: boundingBox,
    textContent,
    textRuns,
  };
};

const splitTextPartsIntoSegments = (parts: TextRowPart[]): TextRowPart[][] => {
  const sortedParts = [...parts].sort((a, b) => a.x - b.x);
  const segments: TextRowPart[][] = [];
  let currentSegment: TextRowPart[] = [];
  let previousRight: number | undefined;

  for (const part of sortedParts) {
    if (previousRight !== undefined && part.x - previousRight > TEXT_SEGMENT_GAP_THRESHOLD) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
      }
      currentSegment = [];
    }

    currentSegment.push(part);
    previousRight = Math.max(previousRight ?? part.x, part.x + part.width);
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
};

const sortByYThenX = (items: PageContentItem[]): PageContentItem[] =>
  [...items].sort((a, b) => b.yPosition - a.yPosition || (a.xPosition ?? 0) - (b.xPosition ?? 0));

const pageContentBounds = (items: PageContentItem[]): BoundingBox | undefined =>
  mergeBoundingBoxes(items.map((item) => item.bounding_box));

const findHorizontalWhitespaceCut = (items: PageContentItem[]): number | undefined => {
  const boxedItems = items.filter((item) => item.bounding_box !== undefined);
  if (boxedItems.length < XY_CUT_MIN_ITEMS) return undefined;

  const bounds = pageContentBounds(boxedItems);
  if (!bounds) return undefined;

  const pageHeight = bounds.top - bounds.bottom;
  if (!Number.isFinite(pageHeight) || pageHeight <= 0) return undefined;

  const sorted = [...boxedItems].sort(
    (a, b) =>
      (b.bounding_box?.top ?? b.yPosition) - (a.bounding_box?.top ?? a.yPosition) ||
      (a.bounding_box?.left ?? a.xPosition ?? 0) - (b.bounding_box?.left ?? b.xPosition ?? 0)
  );

  let upperClusterBottom = sorted[0]?.bounding_box?.bottom;
  if (upperClusterBottom === undefined) return undefined;

  const candidates: Array<{ gap: number; cutPosition: number }> = [];

  for (let i = 1; i < sorted.length; i++) {
    const nextBox = sorted[i]?.bounding_box;
    if (!nextBox) continue;

    const gap = upperClusterBottom - nextBox.top;
    if (gap > 0) {
      candidates.push({ gap, cutPosition: (upperClusterBottom + nextBox.top) / 2 });
    }

    upperClusterBottom = Math.min(upperClusterBottom, nextBox.bottom);
  }

  const minGap = Math.max(XY_CUT_MIN_HORIZONTAL_GAP, pageHeight * XY_CUT_MIN_HORIZONTAL_GAP_RATIO);
  const viableCandidates = candidates
    .filter((candidate) => candidate.gap >= minGap)
    .sort((a, b) => b.gap - a.gap);

  for (const candidate of viableCandidates) {
    const upperCount = boxedItems.filter(
      (item) => (item.bounding_box?.bottom ?? 0) >= candidate.cutPosition
    ).length;
    const lowerCount = boxedItems.filter(
      (item) => (item.bounding_box?.top ?? 0) <= candidate.cutPosition
    ).length;
    if (upperCount > 0 && (lowerCount >= 2 || (lowerCount === 1 && upperCount >= 4))) {
      return candidate.cutPosition;
    }
  }

  return undefined;
};

const findVerticalColumnCut = (items: PageContentItem[]): number | undefined => {
  const boxedItems = items.filter((item) => item.bounding_box !== undefined);
  if (boxedItems.length < 4) return undefined;

  const left = Math.min(...boxedItems.map((item) => item.bounding_box?.left ?? 0));
  const right = Math.max(...boxedItems.map((item) => item.bounding_box?.right ?? 0));
  const pageWidth = right - left;
  if (pageWidth <= 0) return undefined;

  const narrowItems = boxedItems.filter((item) => {
    const box = item.bounding_box;
    if (!box) return false;
    return box.right - box.left < pageWidth * SPANNING_WIDTH_RATIO;
  });
  if (narrowItems.length < 4) return undefined;

  const sorted = [...narrowItems].sort(
    (a, b) => (a.bounding_box?.left ?? 0) - (b.bounding_box?.left ?? 0)
  );
  let currentRight = sorted[0]?.bounding_box?.right;
  if (currentRight === undefined) return undefined;

  let largestGap = 0;
  let cutPosition: number | undefined;
  for (let i = 1; i < sorted.length; i++) {
    const box = sorted[i]?.bounding_box;
    if (!box) continue;

    if (box.left > currentRight) {
      const gap = box.left - currentRight;
      if (gap > largestGap) {
        largestGap = gap;
        cutPosition = (box.left + currentRight) / 2;
      }
    }
    currentRight = Math.max(currentRight, box.right);
  }

  if (cutPosition === undefined) return undefined;
  const minGap = Math.max(COLUMN_CUT_MIN_GAP, pageWidth * COLUMN_CUT_MIN_WIDTH_RATIO);
  if (largestGap < minGap) return undefined;

  const leftCount = narrowItems.filter((item) => {
    const box = item.bounding_box;
    if (!box) return false;
    return (box.left + box.right) / 2 < cutPosition;
  }).length;
  const rightCount = narrowItems.length - leftCount;

  return leftCount >= 2 && rightCount >= 2 ? cutPosition : undefined;
};

const sortPageContentItems = (items: PageContentItem[], depth = 0): PageContentItem[] => {
  if (items.length < XY_CUT_MIN_ITEMS || depth >= XY_CUT_MAX_DEPTH) {
    return sortByYThenX(items);
  }

  const horizontalCut = findHorizontalWhitespaceCut(items);
  if (horizontalCut !== undefined) {
    const upper: PageContentItem[] = [];
    const lower: PageContentItem[] = [];
    const crossing: PageContentItem[] = [];

    for (const item of items) {
      const box = item.bounding_box;
      if (!box) {
        crossing.push(item);
      } else if (box.bottom >= horizontalCut) {
        upper.push(item);
      } else if (box.top <= horizontalCut) {
        lower.push(item);
      } else {
        crossing.push(item);
      }
    }

    if (upper.length > 0 && lower.length > 0) {
      return [
        ...sortPageContentItems(upper, depth + 1),
        ...sortByYThenX(crossing),
        ...sortPageContentItems(lower, depth + 1),
      ];
    }
  }

  const cutPosition = findVerticalColumnCut(items);
  if (cutPosition === undefined) return sortByYThenX(items);

  const leftColumn: PageContentItem[] = [];
  const rightColumn: PageContentItem[] = [];
  const spanning: PageContentItem[] = [];

  for (const item of items) {
    const box = item.bounding_box;
    if (!box) {
      spanning.push(item);
      continue;
    }

    if (box.left < cutPosition && box.right > cutPosition) {
      spanning.push(item);
      continue;
    }

    const center = (box.left + box.right) / 2;
    if (center < cutPosition) {
      leftColumn.push(item);
    } else {
      rightColumn.push(item);
    }
  }

  const columnItems = [...leftColumn, ...rightColumn].filter((item) => item.bounding_box);
  const highestColumnTop =
    columnItems.length > 0
      ? Math.max(...columnItems.map((item) => item.bounding_box?.top ?? item.yPosition))
      : Number.POSITIVE_INFINITY;

  const topSpanning = spanning.filter(
    (item) => (item.bounding_box?.top ?? item.yPosition) >= highestColumnTop
  );
  const remainingSpanning = spanning.filter(
    (item) => (item.bounding_box?.top ?? item.yPosition) < highestColumnTop
  );

  return [
    ...sortByYThenX(topSpanning),
    ...sortPageContentItems(leftColumn, depth + 1),
    ...sortPageContentItems(rightColumn, depth + 1),
    ...sortByYThenX(remainingSpanning),
  ];
};

/**
 * Encode raw pixel data to PNG format
 */
const encodePixelsToPNG = (
  pixelData: Uint8Array,
  width: number,
  height: number,
  channels: number
): string => {
  const png = new PNG({ width, height });

  // Convert pixel data to RGBA format expected by pngjs
  if (channels === 4) {
    // Already RGBA
    png.data = Buffer.from(pixelData);
  } else if (channels === 3) {
    // RGB -> RGBA (add alpha channel)
    for (let i = 0; i < width * height; i++) {
      const srcIdx = i * 3;
      const dstIdx = i * 4;
      png.data[dstIdx] = pixelData[srcIdx] ?? 0; // R
      png.data[dstIdx + 1] = pixelData[srcIdx + 1] ?? 0; // G
      png.data[dstIdx + 2] = pixelData[srcIdx + 2] ?? 0; // B
      png.data[dstIdx + 3] = 255; // A (fully opaque)
    }
  } else if (channels === 1) {
    // Grayscale -> RGBA
    for (let i = 0; i < width * height; i++) {
      const gray = pixelData[i] ?? 0;
      const dstIdx = i * 4;
      png.data[dstIdx] = gray; // R
      png.data[dstIdx + 1] = gray; // G
      png.data[dstIdx + 2] = gray; // B
      png.data[dstIdx + 3] = 255; // A
    }
  }

  // Encode to PNG and convert to base64
  const pngBuffer = PNG.sync.write(png);
  return pngBuffer.toString('base64');
};

/**
 * Process raw image data from PDF.js and convert to ExtractedImage
 */
const processImageData = (
  imageData: unknown,
  pageNum: number,
  arrayIndex: number
): ExtractedImage | null => {
  if (!imageData || typeof imageData !== 'object') {
    return null;
  }

  const img = imageData as {
    width?: number;
    height?: number;
    data?: Uint8Array;
    kind?: number;
  };

  if (!img.data || !img.width || !img.height) {
    return null;
  }

  // Determine number of channels based on kind
  // kind === 1 = grayscale (1 channel), 2 = RGB (3 channels), 3 = RGBA (4 channels)
  const channels = img.kind === 1 ? 1 : img.kind === 3 ? 4 : 3;
  const format = img.kind === 1 ? 'grayscale' : img.kind === 3 ? 'rgba' : 'rgb';

  // Encode raw pixel data to PNG format
  const pngBase64 = encodePixelsToPNG(img.data, img.width, img.height, channels);

  return {
    page: pageNum,
    index: arrayIndex,
    width: img.width,
    height: img.height,
    format,
    data: pngBase64,
  };
};

/**
 * Retrieve image data from PDF.js page objects
 * Tries multiple strategies: commonObjs -> sync objs.get -> async objs.get with timeout
 */
const retrieveImageData = async (
  page: pdfjsLib.PDFPageProxy,
  imageName: string,
  pageNum: number
): Promise<unknown> => {
  // Try to get from commonObjs first if it starts with 'g_'
  if (imageName.startsWith('g_')) {
    try {
      const imageData = page.commonObjs.get(imageName);
      if (imageData) {
        return imageData;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Error getting image from commonObjs', { imageName, error: message });
    }
  }

  // Try synchronous get first - if image is already loaded
  try {
    const imageData = page.objs.get(imageName);
    if (imageData !== undefined) {
      return imageData;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Sync image get failed, trying async', { imageName, error: message });
  }

  // Fallback to async callback-based get with timeout
  return new Promise<unknown>((resolve) => {
    let resolved = false;
    let timeoutId: NodeJS.Timeout | null = null;

    // Create a cleanup function to ensure resources are released
    const cleanup = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        logger.warn('Image extraction timeout', { imageName, pageNum });
        resolve(null);
      }
    }, 10000); // 10 second timeout as a safety net

    try {
      page.objs.get(imageName, (imageData: unknown) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(imageData);
        }
      });
    } catch (error: unknown) {
      // If get() throws synchronously, clean up and reject
      if (!resolved) {
        resolved = true;
        cleanup();
        const message = error instanceof Error ? error.message : String(error);
        logger.warn('Error in async image get', { imageName, error: message });
        resolve(null);
      }
    }
  });
};

/**
 * Extract metadata and page count from a PDF document
 */
export const extractMetadataAndPageCount = async (
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  includeMetadata: boolean,
  includePageCount: boolean
): Promise<Pick<PdfResultData, 'info' | 'metadata' | 'num_pages'>> => {
  const output: Pick<PdfResultData, 'info' | 'metadata' | 'num_pages'> = {};

  if (includePageCount) {
    output.num_pages = pdfDocument.numPages;
  }

  if (includeMetadata) {
    try {
      const pdfMetadata = await pdfDocument.getMetadata();
      const infoData = pdfMetadata.info as PdfInfo | undefined;

      if (infoData !== undefined) {
        output.info = infoData;
      }

      const metadataObj = pdfMetadata.metadata;

      // Check if it has a getAll method (as used in tests)
      if (
        metadataObj &&
        typeof (metadataObj as unknown as { getAll?: () => unknown }).getAll === 'function'
      ) {
        output.metadata = (metadataObj as unknown as { getAll: () => PdfMetadata }).getAll();
      } else if (metadataObj && typeof metadataObj === 'object') {
        // For real PDF.js metadata, convert to plain object
        const metadataRecord: PdfMetadata = {};
        for (const key in metadataObj) {
          if (Object.hasOwn(metadataObj, key)) {
            metadataRecord[key] = (metadataObj as unknown as Record<string, unknown>)[key];
          }
        }
        output.metadata = metadataRecord;
      }
    } catch (metaError: unknown) {
      const message = metaError instanceof Error ? metaError.message : String(metaError);
      logger.warn('Error extracting metadata', { error: message });
    }
  }

  return output;
};

export const extractDocumentStructure = async (
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  options: {
    includeOutline: boolean;
    includePageLabels: boolean;
    includePermissions: boolean;
    includeFormFields: boolean;
    includeAttachments: boolean;
  }
): Promise<
  Pick<
    PdfResultData,
    'outline' | 'page_labels' | 'permissions' | 'mark_info' | 'form_fields' | 'attachments'
  >
> => {
  const documentWithStructure = pdfDocument as unknown as PdfDocumentWithOptionalStructure;
  const output: Pick<
    PdfResultData,
    'outline' | 'page_labels' | 'permissions' | 'mark_info' | 'form_fields' | 'attachments'
  > = {};

  if (options.includeOutline && typeof documentWithStructure.getOutline === 'function') {
    try {
      const outline = await documentWithStructure.getOutline();
      if (outline && outline.length > 0) {
        output.outline = sanitizeOutlineItems(outline);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Error extracting outline', { error: message });
    }
  }

  if (options.includePageLabels && typeof documentWithStructure.getPageLabels === 'function') {
    try {
      const pageLabels = await documentWithStructure.getPageLabels();
      if (pageLabels && pageLabels.length > 0) {
        output.page_labels = pageLabels;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Error extracting page labels', { error: message });
    }
  }

  if (options.includePermissions && typeof documentWithStructure.getPermissions === 'function') {
    try {
      const permissions = await documentWithStructure.getPermissions();
      if (permissions && permissions.length > 0) {
        output.permissions = permissionLabels(permissions);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Error extracting permissions', { error: message });
    }
  }

  if (options.includePermissions && typeof documentWithStructure.getMarkInfo === 'function') {
    try {
      const markInfo = await documentWithStructure.getMarkInfo();
      if (markInfo && Object.keys(markInfo).length > 0) {
        output.mark_info = markInfo;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Error extracting mark info', { error: message });
    }
  }

  if (options.includeFormFields && typeof documentWithStructure.getFieldObjects === 'function') {
    try {
      const fieldObjects = await documentWithStructure.getFieldObjects();
      if (fieldObjects) {
        const fields = Object.entries(fieldObjects)
          .flatMap(([name, fieldOrFields]) => {
            const fieldList = Array.isArray(fieldOrFields) ? fieldOrFields : [fieldOrFields];
            return fieldList.map((field) => normalizeFormField(name, field));
          })
          .filter((field): field is PdfFormField => field !== undefined);

        if (fields.length > 0) {
          output.form_fields = fields;
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Error extracting form fields', { error: message });
    }
  }

  if (options.includeAttachments && typeof documentWithStructure.getAttachments === 'function') {
    try {
      const attachments = await documentWithStructure.getAttachments();
      if (attachments) {
        const attachmentSummaries = Object.entries(attachments).map(
          ([name, attachment]): PdfAttachment => {
            const size = attachmentSize(attachment.content);
            return {
              name,
              ...(attachment.filename ? { filename: attachment.filename } : {}),
              ...(attachment.description ? { description: attachment.description } : {}),
              ...(size !== undefined ? { size_bytes: size } : {}),
            };
          }
        );

        if (attachmentSummaries.length > 0) {
          output.attachments = attachmentSummaries;
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Error extracting attachments', { error: message });
    }
  }

  return output;
};

const normalizeZeroBasedPageIndex = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value + 1 : undefined;

const normalizeFormField = (
  fallbackName: string,
  field: RawFormField
): PdfFormField | undefined => {
  const name = (field.name ?? field.fieldName ?? fallbackName).trim();
  if (!name) return undefined;

  const page =
    field.pageIndex !== undefined
      ? normalizeZeroBasedPageIndex(field.pageIndex)
      : field.page !== undefined
        ? normalizeZeroBasedPageIndex(field.page)
        : undefined;
  const fieldType = field.type ?? field.fieldType;
  const boundingBox = buildRectBoundingBox(field.rect);

  return {
    name,
    ...(fieldType ? { type: fieldType } : {}),
    ...(field.value !== undefined ? { value: field.value } : {}),
    ...(field.defaultValue !== undefined ? { default_value: field.defaultValue } : {}),
    ...(page !== undefined ? { page } : {}),
    ...(field.id ? { id: field.id } : {}),
    ...(field.editable !== undefined ? { editable: field.editable } : {}),
    ...(field.required !== undefined ? { required: field.required } : {}),
    ...(boundingBox ? { bounding_box: boundingBox } : {}),
  };
};

const normalizeAnnotation = (
  annotation: RawAnnotation,
  pageNum: number
): PdfAnnotation | undefined => {
  const contents = textFromAnnotationField(annotation.contents, annotation.contentsObj);
  const title = textFromAnnotationField(annotation.title, annotation.titleObj);
  const boundingBox = buildRectBoundingBox(annotation.rect);
  const subtype = annotation.subtype?.trim();
  const url = annotation.url ?? annotation.unsafeUrl;

  if (!annotation.id && !subtype && !contents && !title && !url && annotation.dest === undefined) {
    return undefined;
  }

  return {
    page: pageNum,
    ...(annotation.id ? { id: annotation.id } : {}),
    ...(subtype ? { subtype } : {}),
    ...(contents ? { contents } : {}),
    ...(title ? { title } : {}),
    ...(url ? { url } : {}),
    ...(annotation.dest !== undefined ? { dest: annotation.dest } : {}),
    ...(boundingBox ? { bounding_box: boundingBox } : {}),
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeStructureTreeContent = (
  rawContent: RawStructTreeContent
): PdfStructureTreeContent | undefined => {
  const type = typeof rawContent.type === 'string' ? rawContent.type.trim() : '';
  const id = typeof rawContent.id === 'string' ? rawContent.id.trim() : '';

  if (!type && !id) return undefined;

  return {
    type: type || 'content',
    ...(id ? { id } : {}),
  };
};

const normalizeStructureTreeChild = (rawChild: unknown): PdfStructureTreeChild | undefined => {
  if (!isRecord(rawChild)) return undefined;

  if ('role' in rawChild || 'children' in rawChild) {
    return normalizeStructureTreeNode(rawChild);
  }

  return normalizeStructureTreeContent(rawChild);
};

const normalizeStructureTreeNode = (rawNode: RawStructTreeNode): PdfStructureTreeNode => {
  const role =
    typeof rawNode.role === 'string' && rawNode.role.trim() ? rawNode.role.trim() : 'Unknown';
  const children = Array.isArray(rawNode.children)
    ? rawNode.children
        .map((child) => normalizeStructureTreeChild(child))
        .filter((child): child is PdfStructureTreeChild => child !== undefined)
    : [];

  return {
    role,
    ...(children.length > 0 ? { children } : {}),
  };
};

export const extractAnnotations = async (
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  pagesToProcess: number[]
): Promise<PdfPageAnnotations[]> => {
  const pageAnnotations: PdfPageAnnotations[] = [];

  for (const pageNum of pagesToProcess) {
    try {
      const page = (await pdfDocument.getPage(
        pageNum
      )) as unknown as PdfPageWithOptionalAnnotations;
      if (typeof page.getAnnotations !== 'function') continue;

      const annotations = await page.getAnnotations({ intent: 'display' });
      const normalized = annotations
        .map((annotation) => normalizeAnnotation(annotation, pageNum))
        .filter((annotation): annotation is PdfAnnotation => annotation !== undefined);

      if (normalized.length > 0) {
        pageAnnotations.push({ page: pageNum, annotations: normalized });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Error extracting annotations from page', { pageNum, error: message });
    }
  }

  return pageAnnotations;
};

export const extractStructureTrees = async (
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  pagesToProcess: number[]
): Promise<PdfPageStructureTree[]> => {
  const pageStructureTrees: PdfPageStructureTree[] = [];

  for (const pageNum of pagesToProcess) {
    try {
      const page = (await pdfDocument.getPage(
        pageNum
      )) as unknown as PdfPageWithOptionalStructureTree;
      if (typeof page.getStructTree !== 'function') continue;

      const rawTree = await page.getStructTree();
      if (!rawTree) continue;

      pageStructureTrees.push({
        page: pageNum,
        tree: normalizeStructureTreeNode(rawTree),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Error extracting structure tree', { pageNum, error: message });
    }
  }

  return pageStructureTrees;
};

export const extractPageGeometry = async (
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  pagesToProcess: number[]
): Promise<PdfPageGeometry[]> => {
  const pageGeometry: PdfPageGeometry[] = [];

  for (const pageNum of pagesToProcess) {
    try {
      const page = (await pdfDocument.getPage(pageNum)) as PdfPageWithGeometry;
      const viewBox = buildRectBoundingBox(page.view);
      const viewport = page.getViewport({ scale: 1 });
      const width = finiteNumber(viewport.width)
        ? viewport.width
        : viewBox
          ? viewBox.right - viewBox.left
          : undefined;
      const height = finiteNumber(viewport.height)
        ? viewport.height
        : viewBox
          ? viewBox.top - viewBox.bottom
          : undefined;

      if (!finiteNumber(width) || !finiteNumber(height)) {
        logger.warn('Skipping page geometry with invalid dimensions', { pageNum });
        continue;
      }

      pageGeometry.push({
        page: pageNum,
        width,
        height,
        rotation: finiteNumber(page.rotate) ? page.rotate : 0,
        ...(finiteNumber(page.userUnit) ? { user_unit: page.userUnit } : {}),
        ...(viewBox ? { view_box: viewBox } : {}),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Error extracting page geometry', { pageNum, error: message });
    }
  }

  return pageGeometry;
};

/**
 * Extract text from a single page
 */
const extractSinglePageText = async (
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  sourceDescription: string
): Promise<ExtractedPageText> => {
  try {
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: unknown) => (item as { str: string }).str)
      .join('');

    return { page: pageNum, text: pageText };
  } catch (pageError: unknown) {
    // SSS-02: do not propagate raw PDF.js error text into page content — it
    // can carry absolute paths or module internals back to the LLM. The
    // detailed message is kept in logs for operators.
    const message = pageError instanceof Error ? pageError.message : String(pageError);
    logger.warn('Error getting text content for page', {
      pageNum,
      sourceDescription,
      error: message,
    });

    return { page: pageNum, text: `[Error processing page ${String(pageNum)}]` };
  }
};

/**
 * Extract text from specified pages (parallel processing for performance)
 */
export const extractPageTexts = async (
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  pagesToProcess: number[],
  sourceDescription: string
): Promise<ExtractedPageText[]> => {
  // Process all pages in parallel for better performance
  const extractedPageTexts = await Promise.all(
    pagesToProcess.map((pageNum) => extractSinglePageText(pdfDocument, pageNum, sourceDescription))
  );

  return extractedPageTexts.sort((a, b) => a.page - b.page);
};

/**
 * Extract images from a single page
 */
const extractImagesFromPage = async (
  page: pdfjsLib.PDFPageProxy,
  pageNum: number
): Promise<ExtractedImage[]> => {
  const images: ExtractedImage[] = [];

  /* c8 ignore next */
  try {
    const operatorList = await page.getOperatorList();

    // Find all image painting operations
    const imageIndices: number[] = [];
    for (let i = 0; i < operatorList.fnArray.length; i++) {
      const op = operatorList.fnArray[i];
      if (op === OPS.paintImageXObject || op === OPS.paintXObject) {
        imageIndices.push(i);
      }
    }

    // Extract each image using shared helper functions
    const imagePromises = imageIndices.map(async (imgIndex, arrayIndex) => {
      const argsArray = operatorList.argsArray[imgIndex];
      if (!argsArray || argsArray.length === 0) {
        return null;
      }

      const imageName = argsArray[0] as string;
      const imageData = await retrieveImageData(page, imageName, pageNum);
      return processImageData(imageData, pageNum, arrayIndex);
    });

    const resolvedImages = await Promise.all(imagePromises);
    images.push(...resolvedImages.filter((img): img is ExtractedImage => img !== null));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Error extracting images from page', { pageNum, error: message });
  }

  return images;
};

/**
 * Extract images from specified pages
 */
export const extractImages = async (
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  pagesToProcess: number[]
): Promise<ExtractedImage[]> => {
  const allImages: ExtractedImage[] = [];

  // Process pages sequentially to avoid overwhelming PDF.js
  for (const pageNum of pagesToProcess) {
    try {
      const page = await pdfDocument.getPage(pageNum);
      const pageImages = await extractImagesFromPage(page, pageNum);
      allImages.push(...pageImages);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Error getting page for image extraction', { pageNum, error: message });
    }
  }

  return allImages;
};

/**
 * Build warnings array for invalid page numbers
 */
export const buildWarnings = (invalidPages: number[], totalPages: number): string[] => {
  if (invalidPages.length === 0) {
    return [];
  }

  return [
    `Requested page numbers ${invalidPages.join(', ')} exceed total pages (${String(totalPages)}).`,
  ];
};

/**
 * Extract all content (text and images) from a single page with Y-coordinate ordering
 */
export const extractPageContent = async (
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  includeImages: boolean,
  sourceDescription: string
): Promise<PageContentItem[]> => {
  const contentItems: PageContentItem[] = [];

  try {
    const page = await pdfDocument.getPage(pageNum);

    // Extract text content with Y-coordinates
    const textContent = await page.getTextContent();

    // Group text items by Y-coordinate (items on same line have similar Y values)
    const textByY = new Map<number, TextRowPart[]>();

    for (const item of textContent.items) {
      const textItem = item as {
        str: string;
        transform?: number[];
        width?: number;
        height?: number;
        fontName?: string;
        dir?: string;
        hasEOL?: boolean;
      };
      // transform[5] is the Y coordinate
      const xCoord = textItem.transform?.[4];
      const yCoord = textItem.transform?.[5];
      if (yCoord === undefined) continue;
      const y = Math.round(yCoord);
      const width = textItem.width ?? textItem.str.length * 6;
      const height = textItem.height ?? Math.abs(textItem.transform?.[3] ?? 0);
      const boundingBox = buildBoundingBox(xCoord, yCoord, width, height);
      const chars = buildRunChars(textItem.str, boundingBox);

      if (!textByY.has(y)) {
        textByY.set(y, []);
      }
      textByY.get(y)?.push({
        text: textItem.str,
        x: xCoord ?? 0,
        width,
        height,
        bounding_box: boundingBox,
        ...(textItem.fontName ? { font_name: textItem.fontName } : {}),
        ...(textItem.dir ? { direction: textItem.dir } : {}),
        ...(textItem.transform ? { transform: textItem.transform } : {}),
        ...(textItem.hasEOL !== undefined ? { has_eol: textItem.hasEOL } : {}),
        chars,
      });
    }

    // Convert grouped text to content items
    for (const [y, textParts] of textByY.entries()) {
      for (const segment of splitTextPartsIntoSegments(textParts)) {
        const contentItem = textSegmentToContentItem(y, segment);
        if (contentItem) {
          contentItems.push(contentItem);
        }
      }
    }

    // Extract images with Y-coordinates if requested
    if (includeImages) {
      const operatorList = await page.getOperatorList();

      // Find all image painting operations
      const imageIndices: number[] = [];
      for (let i = 0; i < operatorList.fnArray.length; i++) {
        const op = operatorList.fnArray[i];
        if (op === OPS.paintImageXObject || op === OPS.paintXObject) {
          imageIndices.push(i);
        }
      }

      // Extract each image using shared helper functions
      const imagePromises = imageIndices.map(async (imgIndex, arrayIndex) => {
        const argsArray = operatorList.argsArray[imgIndex];
        if (!argsArray || argsArray.length === 0) {
          return null;
        }

        const imageName = argsArray[0] as string;

        // Get transform matrix from the args (if available)
        let xPosition: number | undefined;
        let yPosition: number | undefined;
        if (argsArray.length > 1 && Array.isArray(argsArray[1])) {
          const transform = argsArray[1] as number[];
          const xCoord = transform[4];
          const yCoord = transform[5];
          if (xCoord !== undefined) {
            xPosition = Math.round(xCoord);
          }
          if (yCoord !== undefined) {
            yPosition = Math.round(yCoord);
          }
        }

        // Use shared helper to retrieve and process image data
        const imageData = await retrieveImageData(page, imageName, pageNum);
        const extractedImage = processImageData(imageData, pageNum, arrayIndex);

        // Wrap in PageContentItem with yPosition
        if (extractedImage) {
          const imageBox = buildBoundingBox(
            xPosition,
            yPosition,
            extractedImage.width,
            extractedImage.height
          );
          extractedImage.bounding_box = imageBox;

          return {
            type: 'image' as const,
            yPosition: imageBox?.top ?? yPosition ?? 0,
            xPosition,
            width: extractedImage.width,
            height: extractedImage.height,
            bounding_box: imageBox,
            imageData: extractedImage,
          };
        }
        return null;
      });

      const resolvedImages = await Promise.all(imagePromises);
      const validImages = resolvedImages.filter((item) => item !== null);
      contentItems.push(...validImages);
    }
  } catch (error: unknown) {
    // SSS-02: log raw error internally but only return a sanitized placeholder so
    // the LLM never sees PDF.js / Node internals via page content.
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Error extracting page content', {
      pageNum,
      sourceDescription,
      error: message,
    });
    return [
      {
        type: 'text',
        yPosition: 0,
        textContent: `[Error processing page ${String(pageNum)}]`,
      },
    ];
  }

  return sortPageContentItems(contentItems);
};
