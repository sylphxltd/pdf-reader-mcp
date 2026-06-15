#!/usr/bin/env node

// src/index.ts
import { createRequire as createRequire2 } from "node:module";
import { createServer, http, stdio } from "@sylphx/mcp-server-sdk";

// src/handlers/inspectPdf.ts
import { text, tool, toolError } from "@sylphx/mcp-server-sdk";

// src/pdf/inspector.ts
import { OPS as OPS2 } from "pdfjs-dist/legacy/build/pdf.mjs";

// src/utils/errors.ts
class PdfError extends Error {
  code;
  constructor(code, message, options) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.code = code;
    this.name = "PdfError";
  }
}

// src/utils/logger.ts
class Logger {
  prefix;
  minLevel;
  constructor(component, minLevel = 1 /* INFO */) {
    this.prefix = `[PDF Reader MCP${component ? ` - ${component}` : ""}]`;
    this.minLevel = minLevel;
  }
  setLevel(level) {
    this.minLevel = level;
  }
  debug(message, context) {
    if (this.minLevel <= 0 /* DEBUG */) {
      this.log("debug", message, context);
    }
  }
  info(message, context) {
    if (this.minLevel <= 1 /* INFO */) {
      this.log("info", message, context);
    }
  }
  warn(message, context) {
    if (this.minLevel <= 2 /* WARN */) {
      this.log("warn", message, context);
    }
  }
  error(message, context) {
    if (this.minLevel <= 3 /* ERROR */) {
      this.log("error", message, context);
    }
  }
  logWithContext(level, logMessage, structuredLog) {
    if (level === "error") {
      console.error(logMessage);
      console.error(JSON.stringify(structuredLog));
    } else if (level === "warn") {
      console.warn(logMessage);
      console.warn(JSON.stringify(structuredLog));
    } else if (level === "info") {
      console.info(logMessage);
    } else {
      console.log(logMessage);
    }
  }
  logSimple(level, logMessage) {
    if (level === "error") {
      console.error(logMessage);
    } else if (level === "warn") {
      console.warn(logMessage);
    } else if (level === "info") {
      console.info(logMessage);
    } else {
      console.log(logMessage);
    }
  }
  log(level, message, context) {
    const logMessage = `${this.prefix} ${message}`;
    if (context && Object.keys(context).length > 0) {
      const timestamp = new Date().toISOString();
      const structuredLog = {
        timestamp,
        level,
        component: this.prefix,
        message,
        ...context
      };
      this.logWithContext(level, logMessage, structuredLog);
    } else {
      this.logSimple(level, logMessage);
    }
  }
}
var createLogger = (component, minLevel) => {
  return new Logger(component, minLevel);
};
var logger = new Logger("", 2 /* WARN */);

// src/pdf/extractor.ts
import { OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PNG } from "pngjs";
var logger2 = createLogger("Extractor");
var TEXT_SEGMENT_GAP_THRESHOLD = 48;
var COLUMN_CUT_MIN_GAP = 48;
var COLUMN_CUT_MIN_WIDTH_RATIO = 0.12;
var SPANNING_WIDTH_RATIO = 0.72;
var mergeBoundingBoxes = (boxes) => {
  const validBoxes = boxes.filter((box) => box !== undefined);
  if (validBoxes.length === 0)
    return;
  return {
    left: Math.min(...validBoxes.map((box) => box.left)),
    bottom: Math.min(...validBoxes.map((box) => box.bottom)),
    right: Math.max(...validBoxes.map((box) => box.right)),
    top: Math.max(...validBoxes.map((box) => box.top))
  };
};
var buildBoundingBox = (x, y, width, height) => {
  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return;
  }
  if (![x, y, width, height].every(Number.isFinite)) {
    return;
  }
  return {
    left: x,
    bottom: y,
    right: x + Math.max(0, width),
    top: y + Math.max(0, height)
  };
};
var buildRectBoundingBox = (rect) => {
  if (!rect || rect.length < 4)
    return;
  const [x1, y1, x2, y2] = rect;
  if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined || ![x1, y1, x2, y2].every(Number.isFinite)) {
    return;
  }
  return {
    left: Math.min(x1, x2),
    bottom: Math.min(y1, y2),
    right: Math.max(x1, x2),
    top: Math.max(y1, y2)
  };
};
var finiteNumber = (value) => typeof value === "number" && Number.isFinite(value);
var textFromAnnotationField = (direct, objectValue) => {
  const value = direct ?? objectValue?.str;
  return value && value.trim().length > 0 ? value : undefined;
};
var sanitizeOutlineItems = (items) => items.map((item) => {
  const title = item.title?.trim();
  if (!title)
    return;
  const children = item.items ? sanitizeOutlineItems(item.items) : undefined;
  return {
    title,
    ...item.bold !== undefined ? { bold: item.bold } : {},
    ...item.italic !== undefined ? { italic: item.italic } : {},
    ...item.color ? { color: Array.from(item.color) } : {},
    ...item.url ? { url: item.url } : {},
    ...item.dest !== undefined ? { dest: item.dest } : {},
    ...children && children.length > 0 ? { items: children } : {}
  };
}).filter((item) => item !== undefined);
var PDF_PERMISSION_LABELS = new Map([
  [4, "print"],
  [8, "modify"],
  [16, "copy"],
  [32, "annotate"],
  [256, "fill_forms"],
  [512, "copy_for_accessibility"],
  [1024, "assemble"],
  [2048, "print_high_quality"]
]);
var permissionLabels = (permissions) => permissions.map((permission) => PDF_PERMISSION_LABELS.get(permission) ?? `unknown:${String(permission)}`);
var attachmentSize = (content) => {
  if (!content)
    return;
  if ("byteLength" in content && typeof content.byteLength === "number") {
    return content.byteLength;
  }
  if ("length" in content && typeof content.length === "number") {
    return content.length;
  }
  return;
};
var textSegmentToContentItem = (y, segment) => {
  const textContent = segment.map((part) => part.text).join("");
  if (!textContent.trim())
    return null;
  const boundingBox = mergeBoundingBoxes(segment.map((part) => part.bounding_box));
  const xPosition = boundingBox?.left ?? segment[0]?.x;
  const width = boundingBox !== undefined ? boundingBox.right - boundingBox.left : segment.reduce((sum, part) => sum + part.width, 0);
  const height = boundingBox !== undefined ? boundingBox.top - boundingBox.bottom : Math.max(...segment.map((part) => part.height), 0);
  return {
    type: "text",
    yPosition: y,
    xPosition,
    width,
    height,
    bounding_box: boundingBox,
    textContent
  };
};
var splitTextPartsIntoSegments = (parts) => {
  const sortedParts = [...parts].sort((a, b) => a.x - b.x);
  const segments = [];
  let currentSegment = [];
  let previousRight;
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
var sortByYThenX = (items) => [...items].sort((a, b) => b.yPosition - a.yPosition || (a.xPosition ?? 0) - (b.xPosition ?? 0));
var findVerticalColumnCut = (items) => {
  const boxedItems = items.filter((item) => item.bounding_box !== undefined);
  if (boxedItems.length < 4)
    return;
  const left = Math.min(...boxedItems.map((item) => item.bounding_box?.left ?? 0));
  const right = Math.max(...boxedItems.map((item) => item.bounding_box?.right ?? 0));
  const pageWidth = right - left;
  if (pageWidth <= 0)
    return;
  const narrowItems = boxedItems.filter((item) => {
    const box = item.bounding_box;
    if (!box)
      return false;
    return box.right - box.left < pageWidth * SPANNING_WIDTH_RATIO;
  });
  if (narrowItems.length < 4)
    return;
  const sorted = [...narrowItems].sort((a, b) => (a.bounding_box?.left ?? 0) - (b.bounding_box?.left ?? 0));
  let currentRight = sorted[0]?.bounding_box?.right;
  if (currentRight === undefined)
    return;
  let largestGap = 0;
  let cutPosition;
  for (let i = 1;i < sorted.length; i++) {
    const box = sorted[i]?.bounding_box;
    if (!box)
      continue;
    if (box.left > currentRight) {
      const gap = box.left - currentRight;
      if (gap > largestGap) {
        largestGap = gap;
        cutPosition = (box.left + currentRight) / 2;
      }
    }
    currentRight = Math.max(currentRight, box.right);
  }
  if (cutPosition === undefined)
    return;
  const minGap = Math.max(COLUMN_CUT_MIN_GAP, pageWidth * COLUMN_CUT_MIN_WIDTH_RATIO);
  if (largestGap < minGap)
    return;
  const leftCount = narrowItems.filter((item) => {
    const box = item.bounding_box;
    if (!box)
      return false;
    return (box.left + box.right) / 2 < cutPosition;
  }).length;
  const rightCount = narrowItems.length - leftCount;
  return leftCount >= 2 && rightCount >= 2 ? cutPosition : undefined;
};
var sortPageContentItems = (items) => {
  const cutPosition = findVerticalColumnCut(items);
  if (cutPosition === undefined)
    return sortByYThenX(items);
  const leftColumn = [];
  const rightColumn = [];
  const spanning = [];
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
  const highestColumnTop = columnItems.length > 0 ? Math.max(...columnItems.map((item) => item.bounding_box?.top ?? item.yPosition)) : Number.POSITIVE_INFINITY;
  const topSpanning = spanning.filter((item) => (item.bounding_box?.top ?? item.yPosition) >= highestColumnTop);
  const remainingSpanning = spanning.filter((item) => (item.bounding_box?.top ?? item.yPosition) < highestColumnTop);
  return [
    ...sortByYThenX(topSpanning),
    ...sortByYThenX(leftColumn),
    ...sortByYThenX(rightColumn),
    ...sortByYThenX(remainingSpanning)
  ];
};
var encodePixelsToPNG = (pixelData, width, height, channels) => {
  const png = new PNG({ width, height });
  if (channels === 4) {
    png.data = Buffer.from(pixelData);
  } else if (channels === 3) {
    for (let i = 0;i < width * height; i++) {
      const srcIdx = i * 3;
      const dstIdx = i * 4;
      png.data[dstIdx] = pixelData[srcIdx] ?? 0;
      png.data[dstIdx + 1] = pixelData[srcIdx + 1] ?? 0;
      png.data[dstIdx + 2] = pixelData[srcIdx + 2] ?? 0;
      png.data[dstIdx + 3] = 255;
    }
  } else if (channels === 1) {
    for (let i = 0;i < width * height; i++) {
      const gray = pixelData[i] ?? 0;
      const dstIdx = i * 4;
      png.data[dstIdx] = gray;
      png.data[dstIdx + 1] = gray;
      png.data[dstIdx + 2] = gray;
      png.data[dstIdx + 3] = 255;
    }
  }
  const pngBuffer = PNG.sync.write(png);
  return pngBuffer.toString("base64");
};
var processImageData = (imageData, pageNum, arrayIndex) => {
  if (!imageData || typeof imageData !== "object") {
    return null;
  }
  const img = imageData;
  if (!img.data || !img.width || !img.height) {
    return null;
  }
  const channels = img.kind === 1 ? 1 : img.kind === 3 ? 4 : 3;
  const format = img.kind === 1 ? "grayscale" : img.kind === 3 ? "rgba" : "rgb";
  const pngBase64 = encodePixelsToPNG(img.data, img.width, img.height, channels);
  return {
    page: pageNum,
    index: arrayIndex,
    width: img.width,
    height: img.height,
    format,
    data: pngBase64
  };
};
var retrieveImageData = async (page, imageName, pageNum) => {
  if (imageName.startsWith("g_")) {
    try {
      const imageData = page.commonObjs.get(imageName);
      if (imageData) {
        return imageData;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger2.warn("Error getting image from commonObjs", { imageName, error: message });
    }
  }
  try {
    const imageData = page.objs.get(imageName);
    if (imageData !== undefined) {
      return imageData;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger2.warn("Sync image get failed, trying async", { imageName, error: message });
  }
  return new Promise((resolve) => {
    let resolved = false;
    let timeoutId = null;
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
        logger2.warn("Image extraction timeout", { imageName, pageNum });
        resolve(null);
      }
    }, 1e4);
    try {
      page.objs.get(imageName, (imageData) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(imageData);
        }
      });
    } catch (error) {
      if (!resolved) {
        resolved = true;
        cleanup();
        const message = error instanceof Error ? error.message : String(error);
        logger2.warn("Error in async image get", { imageName, error: message });
        resolve(null);
      }
    }
  });
};
var extractMetadataAndPageCount = async (pdfDocument, includeMetadata, includePageCount) => {
  const output = {};
  if (includePageCount) {
    output.num_pages = pdfDocument.numPages;
  }
  if (includeMetadata) {
    try {
      const pdfMetadata = await pdfDocument.getMetadata();
      const infoData = pdfMetadata.info;
      if (infoData !== undefined) {
        output.info = infoData;
      }
      const metadataObj = pdfMetadata.metadata;
      if (metadataObj && typeof metadataObj.getAll === "function") {
        output.metadata = metadataObj.getAll();
      } else if (metadataObj && typeof metadataObj === "object") {
        const metadataRecord = {};
        for (const key in metadataObj) {
          if (Object.hasOwn(metadataObj, key)) {
            metadataRecord[key] = metadataObj[key];
          }
        }
        output.metadata = metadataRecord;
      }
    } catch (metaError) {
      const message = metaError instanceof Error ? metaError.message : String(metaError);
      logger2.warn("Error extracting metadata", { error: message });
    }
  }
  return output;
};
var extractDocumentStructure = async (pdfDocument, options) => {
  const documentWithStructure = pdfDocument;
  const output = {};
  if (options.includeOutline && typeof documentWithStructure.getOutline === "function") {
    try {
      const outline = await documentWithStructure.getOutline();
      if (outline && outline.length > 0) {
        output.outline = sanitizeOutlineItems(outline);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger2.warn("Error extracting outline", { error: message });
    }
  }
  if (options.includePageLabels && typeof documentWithStructure.getPageLabels === "function") {
    try {
      const pageLabels = await documentWithStructure.getPageLabels();
      if (pageLabels && pageLabels.length > 0) {
        output.page_labels = pageLabels;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger2.warn("Error extracting page labels", { error: message });
    }
  }
  if (options.includePermissions && typeof documentWithStructure.getPermissions === "function") {
    try {
      const permissions = await documentWithStructure.getPermissions();
      if (permissions && permissions.length > 0) {
        output.permissions = permissionLabels(permissions);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger2.warn("Error extracting permissions", { error: message });
    }
  }
  if (options.includePermissions && typeof documentWithStructure.getMarkInfo === "function") {
    try {
      const markInfo = await documentWithStructure.getMarkInfo();
      if (markInfo && Object.keys(markInfo).length > 0) {
        output.mark_info = markInfo;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger2.warn("Error extracting mark info", { error: message });
    }
  }
  if (options.includeFormFields && typeof documentWithStructure.getFieldObjects === "function") {
    try {
      const fieldObjects = await documentWithStructure.getFieldObjects();
      if (fieldObjects) {
        const fields = Object.entries(fieldObjects).flatMap(([name, fieldOrFields]) => {
          const fieldList = Array.isArray(fieldOrFields) ? fieldOrFields : [fieldOrFields];
          return fieldList.map((field) => normalizeFormField(name, field));
        }).filter((field) => field !== undefined);
        if (fields.length > 0) {
          output.form_fields = fields;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger2.warn("Error extracting form fields", { error: message });
    }
  }
  if (options.includeAttachments && typeof documentWithStructure.getAttachments === "function") {
    try {
      const attachments = await documentWithStructure.getAttachments();
      if (attachments) {
        const attachmentSummaries = Object.entries(attachments).map(([name, attachment]) => {
          const size = attachmentSize(attachment.content);
          return {
            name,
            ...attachment.filename ? { filename: attachment.filename } : {},
            ...attachment.description ? { description: attachment.description } : {},
            ...size !== undefined ? { size_bytes: size } : {}
          };
        });
        if (attachmentSummaries.length > 0) {
          output.attachments = attachmentSummaries;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger2.warn("Error extracting attachments", { error: message });
    }
  }
  return output;
};
var normalizeFormField = (fallbackName, field) => {
  const name = (field.name ?? field.fieldName ?? fallbackName).trim();
  if (!name)
    return;
  const page = field.page !== undefined ? field.page : field.pageIndex !== undefined ? field.pageIndex + 1 : undefined;
  const fieldType = field.type ?? field.fieldType;
  const boundingBox = buildRectBoundingBox(field.rect);
  return {
    name,
    ...fieldType ? { type: fieldType } : {},
    ...field.value !== undefined ? { value: field.value } : {},
    ...field.defaultValue !== undefined ? { default_value: field.defaultValue } : {},
    ...page !== undefined ? { page } : {},
    ...field.id ? { id: field.id } : {},
    ...field.editable !== undefined ? { editable: field.editable } : {},
    ...field.required !== undefined ? { required: field.required } : {},
    ...boundingBox ? { bounding_box: boundingBox } : {}
  };
};
var normalizeAnnotation = (annotation, pageNum) => {
  const contents = textFromAnnotationField(annotation.contents, annotation.contentsObj);
  const title = textFromAnnotationField(annotation.title, annotation.titleObj);
  const boundingBox = buildRectBoundingBox(annotation.rect);
  const subtype = annotation.subtype?.trim();
  const url = annotation.url ?? annotation.unsafeUrl;
  if (!annotation.id && !subtype && !contents && !title && !url && annotation.dest === undefined) {
    return;
  }
  return {
    page: pageNum,
    ...annotation.id ? { id: annotation.id } : {},
    ...subtype ? { subtype } : {},
    ...contents ? { contents } : {},
    ...title ? { title } : {},
    ...url ? { url } : {},
    ...annotation.dest !== undefined ? { dest: annotation.dest } : {},
    ...boundingBox ? { bounding_box: boundingBox } : {}
  };
};
var isRecord = (value) => typeof value === "object" && value !== null;
var normalizeStructureTreeContent = (rawContent) => {
  const type = typeof rawContent.type === "string" ? rawContent.type.trim() : "";
  const id = typeof rawContent.id === "string" ? rawContent.id.trim() : "";
  if (!type && !id)
    return;
  return {
    type: type || "content",
    ...id ? { id } : {}
  };
};
var normalizeStructureTreeChild = (rawChild) => {
  if (!isRecord(rawChild))
    return;
  if ("role" in rawChild || "children" in rawChild) {
    return normalizeStructureTreeNode(rawChild);
  }
  return normalizeStructureTreeContent(rawChild);
};
var normalizeStructureTreeNode = (rawNode) => {
  const role = typeof rawNode.role === "string" && rawNode.role.trim() ? rawNode.role.trim() : "Unknown";
  const children = Array.isArray(rawNode.children) ? rawNode.children.map((child) => normalizeStructureTreeChild(child)).filter((child) => child !== undefined) : [];
  return {
    role,
    ...children.length > 0 ? { children } : {}
  };
};
var extractAnnotations = async (pdfDocument, pagesToProcess) => {
  const pageAnnotations = [];
  for (const pageNum of pagesToProcess) {
    try {
      const page = await pdfDocument.getPage(pageNum);
      if (typeof page.getAnnotations !== "function")
        continue;
      const annotations = await page.getAnnotations({ intent: "display" });
      const normalized = annotations.map((annotation) => normalizeAnnotation(annotation, pageNum)).filter((annotation) => annotation !== undefined);
      if (normalized.length > 0) {
        pageAnnotations.push({ page: pageNum, annotations: normalized });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger2.warn("Error extracting annotations from page", { pageNum, error: message });
    }
  }
  return pageAnnotations;
};
var extractStructureTrees = async (pdfDocument, pagesToProcess) => {
  const pageStructureTrees = [];
  for (const pageNum of pagesToProcess) {
    try {
      const page = await pdfDocument.getPage(pageNum);
      if (typeof page.getStructTree !== "function")
        continue;
      const rawTree = await page.getStructTree();
      if (!rawTree)
        continue;
      pageStructureTrees.push({
        page: pageNum,
        tree: normalizeStructureTreeNode(rawTree)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger2.warn("Error extracting structure tree", { pageNum, error: message });
    }
  }
  return pageStructureTrees;
};
var extractPageGeometry = async (pdfDocument, pagesToProcess) => {
  const pageGeometry = [];
  for (const pageNum of pagesToProcess) {
    try {
      const page = await pdfDocument.getPage(pageNum);
      const viewBox = buildRectBoundingBox(page.view);
      const viewport = page.getViewport({ scale: 1 });
      const width = finiteNumber(viewport.width) ? viewport.width : viewBox ? viewBox.right - viewBox.left : undefined;
      const height = finiteNumber(viewport.height) ? viewport.height : viewBox ? viewBox.top - viewBox.bottom : undefined;
      if (!finiteNumber(width) || !finiteNumber(height)) {
        logger2.warn("Skipping page geometry with invalid dimensions", { pageNum });
        continue;
      }
      pageGeometry.push({
        page: pageNum,
        width,
        height,
        rotation: finiteNumber(page.rotate) ? page.rotate : 0,
        ...finiteNumber(page.userUnit) ? { user_unit: page.userUnit } : {},
        ...viewBox ? { view_box: viewBox } : {}
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger2.warn("Error extracting page geometry", { pageNum, error: message });
    }
  }
  return pageGeometry;
};
var buildWarnings = (invalidPages, totalPages) => {
  if (invalidPages.length === 0) {
    return [];
  }
  return [
    `Requested page numbers ${invalidPages.join(", ")} exceed total pages (${String(totalPages)}).`
  ];
};
var extractPageContent = async (pdfDocument, pageNum, includeImages, sourceDescription) => {
  const contentItems = [];
  try {
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    const textByY = new Map;
    for (const item of textContent.items) {
      const textItem = item;
      const xCoord = textItem.transform?.[4];
      const yCoord = textItem.transform?.[5];
      if (yCoord === undefined)
        continue;
      const y = Math.round(yCoord);
      const width = textItem.width ?? textItem.str.length * 6;
      const height = textItem.height ?? Math.abs(textItem.transform?.[3] ?? 0);
      const boundingBox = buildBoundingBox(xCoord, yCoord, width, height);
      if (!textByY.has(y)) {
        textByY.set(y, []);
      }
      textByY.get(y)?.push({
        text: textItem.str,
        x: xCoord ?? 0,
        width,
        height,
        bounding_box: boundingBox
      });
    }
    for (const [y, textParts] of textByY.entries()) {
      for (const segment of splitTextPartsIntoSegments(textParts)) {
        const contentItem = textSegmentToContentItem(y, segment);
        if (contentItem) {
          contentItems.push(contentItem);
        }
      }
    }
    if (includeImages) {
      const operatorList = await page.getOperatorList();
      const imageIndices = [];
      for (let i = 0;i < operatorList.fnArray.length; i++) {
        const op = operatorList.fnArray[i];
        if (op === OPS.paintImageXObject || op === OPS.paintXObject) {
          imageIndices.push(i);
        }
      }
      const imagePromises = imageIndices.map(async (imgIndex, arrayIndex) => {
        const argsArray = operatorList.argsArray[imgIndex];
        if (!argsArray || argsArray.length === 0) {
          return null;
        }
        const imageName = argsArray[0];
        let xPosition;
        let yPosition;
        if (argsArray.length > 1 && Array.isArray(argsArray[1])) {
          const transform = argsArray[1];
          const xCoord = transform[4];
          const yCoord = transform[5];
          if (xCoord !== undefined) {
            xPosition = Math.round(xCoord);
          }
          if (yCoord !== undefined) {
            yPosition = Math.round(yCoord);
          }
        }
        const imageData = await retrieveImageData(page, imageName, pageNum);
        const extractedImage = processImageData(imageData, pageNum, arrayIndex);
        if (extractedImage) {
          const imageBox = buildBoundingBox(xPosition, yPosition, extractedImage.width, extractedImage.height);
          extractedImage.bounding_box = imageBox;
          return {
            type: "image",
            yPosition: imageBox?.top ?? yPosition ?? 0,
            xPosition,
            width: extractedImage.width,
            height: extractedImage.height,
            bounding_box: imageBox,
            imageData: extractedImage
          };
        }
        return null;
      });
      const resolvedImages = await Promise.all(imagePromises);
      const validImages = resolvedImages.filter((item) => item !== null);
      contentItems.push(...validImages);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger2.warn("Error extracting page content", {
      pageNum,
      sourceDescription,
      error: message
    });
    return [
      {
        type: "text",
        yPosition: 0,
        textContent: `[Error processing page ${String(pageNum)}]`
      }
    ];
  }
  return sortPageContentItems(contentItems);
};

// src/pdf/loader.ts
import fs3 from "node:fs/promises";
import { createRequire } from "node:module";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// src/utils/config.ts
import dns from "node:dns";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
var splitList = (value, separators) => value.split(separators).map((s) => s.trim()).filter((s) => s.length > 0);
var canonicalizeDir = (p) => {
  try {
    return fs.realpathSync(p);
  } catch (err) {
    if (typeof err === "object" && err !== null && "code" in err && (err.code === "ENOENT" || err.code === "ENOTDIR")) {
      const parent = path.dirname(p);
      if (parent === p)
        return p;
      return path.join(canonicalizeDir(parent), path.basename(p));
    }
    throw err;
  }
};
var parseDirs = (values) => values.map((dir) => canonicalizeDir(path.resolve(path.normalize(dir))));
var parseBool = (value, fallback) => {
  if (value === undefined)
    return fallback;
  const v = value.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no" || v === "off")
    return false;
  if (v === "true" || v === "1" || v === "yes" || v === "on")
    return true;
  return fallback;
};
var parseCliFlags = (argv) => {
  const dirs = [];
  const hosts = [];
  let noHttp = false;
  let allowPrivateIps = false;
  for (const arg of argv) {
    if (arg.startsWith("--allow-dir=")) {
      dirs.push(arg.slice("--allow-dir=".length));
    } else if (arg.startsWith("--allow-host=")) {
      hosts.push(arg.slice("--allow-host=".length).toLowerCase());
    } else if (arg === "--no-http") {
      noHttp = true;
    } else if (arg === "--allow-private-ips") {
      allowPrivateIps = true;
    }
  }
  return { dirs, hosts, noHttp, allowPrivateIps };
};
var envList = (raw, separators, transform = (v) => v) => raw ? splitList(raw, separators).map(transform) : [];
var readSecurityConfig = (argv = process.argv.slice(2), env = process.env) => {
  const cli = parseCliFlags(argv);
  const envDirs = envList(env["MCP_PDF_ALLOWED_DIRS"], /[:,]/);
  const envHosts = envList(env["MCP_PDF_ALLOWED_HOSTS"], /,/, (h) => h.toLowerCase());
  const mergedDirs = [...cli.dirs, ...envDirs];
  const mergedHosts = [...cli.hosts, ...envHosts];
  return {
    allowedDirs: mergedDirs.length > 0 ? parseDirs(mergedDirs) : null,
    allowHttp: cli.noHttp ? false : parseBool(env["MCP_PDF_ALLOW_HTTP"], true),
    allowedHosts: mergedHosts.length > 0 ? mergedHosts : null,
    allowPrivateIps: cli.allowPrivateIps || parseBool(env["MCP_PDF_ALLOW_PRIVATE_IPS"], false)
  };
};
var cached = null;
var getSecurityConfig = () => {
  if (cached === null) {
    cached = readSecurityConfig();
  }
  return cached;
};
var isPathAllowed = (absPath, allowedDirs) => {
  if (allowedDirs === null)
    return true;
  if (allowedDirs.length === 0)
    return false;
  const normalized = path.resolve(absPath);
  return allowedDirs.some((dir) => {
    const rel = path.relative(dir, normalized);
    if (rel === "")
      return true;
    if (rel.startsWith(".."))
      return false;
    if (path.isAbsolute(rel))
      return false;
    return true;
  });
};
var isUrlAllowed = (urlString, config) => {
  if (!config.allowHttp)
    return false;
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    return false;
  if (config.allowedHosts === null)
    return true;
  return config.allowedHosts.includes(parsed.hostname.toLowerCase());
};
var PRIVATE_IPV4_PREDICATES = [
  (a) => a === 10,
  (a, b) => a === 172 && b >= 16 && b <= 31,
  (a, b) => a === 192 && b === 168,
  (a) => a === 127,
  (a, b) => a === 169 && b === 254,
  (a) => a === 0,
  (a, b) => a === 100 && b >= 64 && b <= 127,
  (a) => a >= 224
];
var isPrivateIpv4 = (ip) => {
  const parts = ip.split(".").map((s) => Number.parseInt(s, 10));
  const a = parts[0];
  const b = parts[1];
  if (a === undefined || b === undefined)
    return true;
  return PRIVATE_IPV4_PREDICATES.some((pred) => pred(a, b));
};
var isPrivateIpv6 = (ip) => {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::")
    return true;
  if (lower.startsWith("fc") || lower.startsWith("fd"))
    return true;
  if (lower.startsWith("fe80"))
    return true;
  if (lower.startsWith("ff"))
    return true;
  if (lower.startsWith("::ffff:")) {
    const tail = lower.slice("::ffff:".length);
    if (net.isIPv4(tail))
      return isPrivateIpv4(tail);
  }
  return false;
};
var isPrivateIp = (ip) => {
  if (net.isIPv4(ip))
    return isPrivateIpv4(ip);
  if (net.isIPv6(ip))
    return isPrivateIpv6(ip);
  return true;
};
var assertUrlNotPrivate = async (hostname) => {
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error(`URL host '${hostname}' resolves to a non-public address (SSRF protection).`);
    }
    return;
  }
  let addresses;
  try {
    addresses = await dns.promises.lookup(hostname, { all: true });
  } catch {
    throw new Error(`URL host '${hostname}' could not be resolved.`);
  }
  if (addresses.length === 0) {
    throw new Error(`URL host '${hostname}' resolved to no addresses.`);
  }
  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new Error(`URL host '${hostname}' resolves to a non-public address (SSRF protection).`);
    }
  }
};

// src/utils/pathUtils.ts
import fs2 from "node:fs";
import path2 from "node:path";
var PROJECT_ROOT = process.cwd();
var canonicalize = (p) => {
  try {
    return fs2.realpathSync(p);
  } catch (err) {
    if (typeof err === "object" && err !== null && "code" in err && (err.code === "ENOENT" || err.code === "ENOTDIR")) {
      const parent = path2.dirname(p);
      if (parent === p)
        return p;
      return path2.join(canonicalize(parent), path2.basename(p));
    }
    throw err;
  }
};
var resolvePath = (userPath) => {
  if (typeof userPath !== "string") {
    throw new PdfError(-32602 /* InvalidParams */, "Path must be a string.");
  }
  const normalizedUserPath = path2.normalize(userPath);
  const resolved = path2.isAbsolute(normalizedUserPath) ? normalizedUserPath : path2.resolve(PROJECT_ROOT, normalizedUserPath);
  const canonical = canonicalize(resolved);
  const { allowedDirs } = getSecurityConfig();
  if (!isPathAllowed(canonical, allowedDirs)) {
    throw new PdfError(-32600 /* InvalidRequest */, `Access denied: path '${userPath}' is outside the allowed directories.`);
  }
  return canonical;
};

// src/pdf/loader.ts
var logger3 = createLogger("Loader");
var require2 = createRequire(import.meta.url);
var PDFJS_ROOT = require2.resolve("pdfjs-dist/package.json").replace("package.json", "");
var CMAP_URL = `${PDFJS_ROOT}cmaps/`;
var STANDARD_FONT_DATA_URL = `${PDFJS_ROOT}standard_fonts/`;
var WASM_URL = `${PDFJS_ROOT}wasm/`;
var ICC_URL = `${PDFJS_ROOT}iccs/`;
var MAX_PDF_SIZE = 100 * 1024 * 1024;
var URL_FETCH_TIMEOUT_MS = 30000;
var MAX_REDIRECTS = 5;
var formatBytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(0)}MB`;
var sanitizeSourceDescription = (description) => description.length > 200 ? `${description.slice(0, 197)}...` : description;
var loadLocalFile = async (userPath) => {
  const safePath = resolvePath(userPath);
  let stats;
  try {
    stats = await fs3.stat(safePath);
  } catch (err) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "ENOENT") {
      throw new PdfError(-32600 /* InvalidRequest */, `File not found at '${userPath}'.`, {
        cause: err instanceof Error ? err : undefined
      });
    }
    throw new PdfError(-32600 /* InvalidRequest */, `Failed to access file at '${userPath}'.`, {
      cause: err instanceof Error ? err : undefined
    });
  }
  if (!stats.isFile()) {
    throw new PdfError(-32600 /* InvalidRequest */, `Path '${userPath}' is not a regular file.`);
  }
  if (stats.size > MAX_PDF_SIZE) {
    throw new PdfError(-32600 /* InvalidRequest */, `PDF file exceeds maximum size of ${formatBytes(MAX_PDF_SIZE)}. File size: ${formatBytes(stats.size)}.`);
  }
  const buffer = await fs3.readFile(safePath);
  return new Uint8Array(buffer);
};
var validateUrlHop = async (urlString, config) => {
  if (!isUrlAllowed(urlString, config)) {
    const reason = config.allowHttp ? "host is not in the allowed list or scheme is not http(s)" : "HTTP access is disabled";
    throw new PdfError(-32600 /* InvalidRequest */, `Access denied: URL '${urlString}' rejected (${reason}).`);
  }
  if (!config.allowPrivateIps) {
    let hostname;
    try {
      hostname = new URL(urlString).hostname;
    } catch {
      throw new PdfError(-32600 /* InvalidRequest */, `Invalid URL: '${urlString}'.`);
    }
    try {
      await assertUrlNotPrivate(hostname);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "SSRF check failed";
      throw new PdfError(-32600 /* InvalidRequest */, `Access denied: ${reason}`);
    }
  }
};
var fetchUrlBody = async (url, config) => {
  let currentUrl = url;
  const controller = new AbortController;
  const timeout = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);
  try {
    for (let hop = 0;hop <= MAX_REDIRECTS; hop++) {
      await validateUrlHop(currentUrl, config);
      const response = await fetch(currentUrl, {
        redirect: "manual",
        signal: controller.signal
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          throw new PdfError(-32600 /* InvalidRequest */, `URL fetch failed: redirect without Location header.`);
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      if (!response.ok) {
        throw new PdfError(-32600 /* InvalidRequest */, `URL fetch failed with HTTP ${String(response.status)}.`);
      }
      const contentLengthHeader = response.headers.get("content-length");
      if (contentLengthHeader !== null) {
        const declared = Number.parseInt(contentLengthHeader, 10);
        if (Number.isFinite(declared) && declared > MAX_PDF_SIZE) {
          throw new PdfError(-32600 /* InvalidRequest */, `Remote PDF exceeds maximum size of ${formatBytes(MAX_PDF_SIZE)} (Content-Length: ${formatBytes(declared)}).`);
        }
      }
      if (!response.body) {
        const ab = await response.arrayBuffer();
        if (ab.byteLength > MAX_PDF_SIZE) {
          throw new PdfError(-32600 /* InvalidRequest */, `Remote PDF exceeds maximum size of ${formatBytes(MAX_PDF_SIZE)}.`);
        }
        return new Uint8Array(ab);
      }
      const reader = response.body.getReader();
      const chunks = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done)
          break;
        if (value) {
          total += value.byteLength;
          if (total > MAX_PDF_SIZE) {
            await reader.cancel().catch(() => {});
            throw new PdfError(-32600 /* InvalidRequest */, `Remote PDF exceeds maximum size of ${formatBytes(MAX_PDF_SIZE)} during streaming.`);
          }
          chunks.push(value);
        }
      }
      const combined = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return combined;
    }
    throw new PdfError(-32600 /* InvalidRequest */, `URL fetch failed: exceeded redirect limit (${String(MAX_REDIRECTS)}).`);
  } catch (err) {
    if (err instanceof PdfError)
      throw err;
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
      throw new PdfError(-32600 /* InvalidRequest */, `URL fetch timed out after ${String(URL_FETCH_TIMEOUT_MS / 1000)}s.`, { cause: err });
    }
    const message = err instanceof Error ? err.message : String(err);
    logger3.warn("URL fetch failed", { url, error: message });
    throw new PdfError(-32600 /* InvalidRequest */, `URL fetch failed for '${url}'.`, {
      cause: err instanceof Error ? err : undefined
    });
  } finally {
    clearTimeout(timeout);
  }
};
var loadPdfDocument = async (source, sourceDescription) => {
  const safeSource = sanitizeSourceDescription(sourceDescription);
  let pdfData;
  try {
    if (source.path) {
      pdfData = await loadLocalFile(source.path);
    } else if (source.url) {
      const config = getSecurityConfig();
      pdfData = await fetchUrlBody(source.url, config);
    } else {
      throw new PdfError(-32602 /* InvalidParams */, `Source ${safeSource} missing 'path' or 'url'.`);
    }
  } catch (err) {
    if (err instanceof PdfError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    logger3.error("Unexpected error preparing PDF source", {
      sourceDescription: safeSource,
      error: message
    });
    throw new PdfError(-32600 /* InvalidRequest */, `Failed to prepare PDF source ${safeSource}.`, {
      cause: err instanceof Error ? err : undefined
    });
  }
  const loadingTask = getDocument({
    data: pdfData,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    wasmUrl: WASM_URL,
    iccUrl: ICC_URL
  });
  try {
    return await loadingTask.promise;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger3.error("PDF.js loading error", { sourceDescription: safeSource, error: message });
    throw new PdfError(-32600 /* InvalidRequest */, `Failed to load PDF document from ${safeSource}.`, { cause: err instanceof Error ? err : undefined });
  }
};

// src/pdf/parser.ts
var logger4 = createLogger("Parser");
var MAX_RANGE_SIZE = 1e4;
var parseRangePart = (part, pages) => {
  const trimmedPart = part.trim();
  if (trimmedPart.includes("-")) {
    const splitResult = trimmedPart.split("-");
    const startStr = splitResult[0] || "";
    const endStr = splitResult[1];
    const start = parseInt(startStr, 10);
    const end = endStr === "" || endStr === undefined ? Infinity : parseInt(endStr, 10);
    if (Number.isNaN(start) || Number.isNaN(end) || start <= 0 || start > end) {
      throw new Error(`Invalid page range values: ${trimmedPart}`);
    }
    const practicalEnd = Math.min(end, start + MAX_RANGE_SIZE);
    for (let i = start;i <= practicalEnd; i++) {
      pages.add(i);
    }
    if (end === Infinity && practicalEnd === start + MAX_RANGE_SIZE) {
      logger4.warn("Open-ended range truncated", { start, practicalEnd });
    }
  } else {
    const page = parseInt(trimmedPart, 10);
    if (Number.isNaN(page) || page <= 0) {
      throw new Error(`Invalid page number: ${trimmedPart}`);
    }
    pages.add(page);
  }
};
var parsePageRanges = (ranges) => {
  const pages = new Set;
  const parts = ranges.split(",");
  for (const part of parts) {
    parseRangePart(part, pages);
  }
  if (pages.size === 0) {
    throw new Error("Page range string resulted in zero valid pages.");
  }
  return Array.from(pages).sort((a, b) => a - b);
};
var getTargetPages = (sourcePages, sourceDescription) => {
  if (!sourcePages) {
    return;
  }
  try {
    if (typeof sourcePages === "string") {
      return parsePageRanges(sourcePages);
    }
    if (sourcePages.some((p) => !Number.isInteger(p) || p <= 0)) {
      throw new Error("Page numbers in array must be positive integers.");
    }
    const uniquePages = [...new Set(sourcePages)].sort((a, b) => a - b);
    if (uniquePages.length === 0) {
      throw new Error("Page specification resulted in an empty set of pages.");
    }
    return uniquePages;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PdfError(-32602 /* InvalidParams */, `Invalid page specification for source ${sourceDescription}: ${message}`);
  }
};
var determinePagesToProcess = (targetPages, totalPages, includeFullText) => {
  if (targetPages) {
    const pagesToProcess = targetPages.filter((p) => p <= totalPages);
    const invalidPages = targetPages.filter((p) => p > totalPages);
    return { pagesToProcess, invalidPages };
  }
  if (includeFullText) {
    const pagesToProcess = Array.from({ length: totalPages }, (_, i) => i + 1);
    return { pagesToProcess, invalidPages: [] };
  }
  return { pagesToProcess: [], invalidPages: [] };
};

// src/pdf/inspector.ts
var logger5 = createLogger("Inspector");
var DEFAULT_SAMPLE_PAGES = 5;
var MAX_SAMPLE_PAGES = 20;
var LOW_TEXT_CHAR_THRESHOLD = 20;
var DIGITAL_TEXT_CHAR_THRESHOLD = 80;
var APPROX_CHARS_PER_TOKEN = 4;
var clampSamplePageCount = (value) => Math.min(MAX_SAMPLE_PAGES, Math.max(1, Math.floor(value)));
var publicSource = (source) => ({
  ...source.path ? { path: source.path } : {},
  ...source.url ? { url: source.url } : {},
  ...source.pages ? { pages: source.pages } : {}
});
var selectEvenlySpaced = (values, maxItems) => {
  const uniqueValues = [...new Set(values)].sort((a, b) => a - b);
  if (uniqueValues.length <= maxItems)
    return uniqueValues;
  if (maxItems === 1)
    return [uniqueValues[0]];
  const selected = new Set;
  for (let i = 0;i < maxItems; i++) {
    const index = Math.round(i * (uniqueValues.length - 1) / (maxItems - 1));
    const value = uniqueValues[index];
    if (value !== undefined)
      selected.add(value);
  }
  for (const value of uniqueValues) {
    if (selected.size >= maxItems)
      break;
    selected.add(value);
  }
  return [...selected].sort((a, b) => a - b);
};
var selectInspectionSamplePages = (totalPages, targetPages, samplePageCount) => {
  if (totalPages <= 0)
    return [];
  const maxSamples = clampSamplePageCount(samplePageCount);
  if (targetPages !== undefined) {
    const validTargetPages = targetPages.filter((page) => page >= 1 && page <= totalPages);
    return selectEvenlySpaced(validTargetPages, maxSamples);
  }
  if (totalPages <= maxSamples) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const sampled = new Set;
  for (let i = 0;i < maxSamples; i++) {
    const page = 1 + Math.round(i * (totalPages - 1) / (maxSamples - 1));
    sampled.add(page);
  }
  return [...sampled].sort((a, b) => a - b);
};
var classifyPdfInspectionProfile = (pageSignals) => {
  if (pageSignals.length === 0)
    return "unknown";
  const scannedCount = pageSignals.filter((signal) => signal.likely_scanned).length;
  const digitalTextCount = pageSignals.filter((signal) => signal.text_chars >= DIGITAL_TEXT_CHAR_THRESHOLD).length;
  if (scannedCount === pageSignals.length)
    return "scanned_or_image_only";
  if (scannedCount > 0 && digitalTextCount > 0)
    return "mixed_text_and_scan";
  if (digitalTextCount > 0)
    return "digital_text";
  return "low_text_or_form";
};
var countImagePaintOperations = async (page) => {
  try {
    const operatorList = await page.getOperatorList();
    return operatorList.fnArray.filter((op) => op === OPS2.paintImageXObject || op === OPS2.paintXObject).length;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger5.warn("Error counting image paint operations", { error: message });
    return 0;
  }
};
var inspectPageSignal = async (pdfDocument, pageNum) => {
  const page = await pdfDocument.getPage(pageNum);
  const textContent = await page.getTextContent();
  const textValues = textContent.items.map((item) => item.str).filter((value) => typeof value === "string");
  const textChars = textValues.reduce((sum, value) => sum + value.trim().length, 0);
  const imagePaintOperations = await countImagePaintOperations(page);
  const likelyScanned = textChars < LOW_TEXT_CHAR_THRESHOLD && imagePaintOperations > 0;
  return {
    page: pageNum,
    text_chars: textChars,
    text_items: textValues.filter((value) => value.trim().length > 0).length,
    estimated_tokens: Math.ceil(textChars / APPROX_CHARS_PER_TOKEN),
    image_paint_operations: imagePaintOperations,
    likely_scanned: likelyScanned,
    low_text_density: textChars < DIGITAL_TEXT_CHAR_THRESHOLD
  };
};
var buildDocumentSignals = (structureOutput, hasStructureTree) => ({
  has_outline: (structureOutput.outline?.length ?? 0) > 0,
  has_page_labels: (structureOutput.page_labels?.length ?? 0) > 0,
  has_permissions: (structureOutput.permissions?.length ?? 0) > 0,
  has_mark_info: Object.keys(structureOutput.mark_info ?? {}).length > 0,
  has_form_fields: (structureOutput.form_fields?.length ?? 0) > 0,
  has_attachments: (structureOutput.attachments?.length ?? 0) > 0,
  has_structure_tree: hasStructureTree
});
var setTrue = (target, key, enabled) => {
  if (enabled)
    target[key] = true;
};
var buildInspectionRecommendation = (source, profile, documentSignals) => {
  const readPdfArguments = {
    sources: [publicSource(source)],
    include_metadata: true,
    include_page_count: true,
    include_page_geometry: true
  };
  setTrue(readPdfArguments, "include_outline", documentSignals.has_outline);
  setTrue(readPdfArguments, "include_page_labels", documentSignals.has_page_labels);
  setTrue(readPdfArguments, "include_permissions", documentSignals.has_permissions);
  setTrue(readPdfArguments, "include_form_fields", documentSignals.has_form_fields);
  setTrue(readPdfArguments, "include_attachments", documentSignals.has_attachments);
  setTrue(readPdfArguments, "include_structure_tree", documentSignals.has_structure_tree);
  if (profile === "scanned_or_image_only") {
    return {
      workflow: "scanned_pdf_triage",
      needs_ocr: true,
      reason: "Sampled pages contain little selectable text and visible image paint operations; OCR or an optional advanced engine is likely required for text extraction.",
      read_pdf_arguments: readPdfArguments
    };
  }
  if (profile === "mixed_text_and_scan") {
    Object.assign(readPdfArguments, {
      include_chunks: true,
      include_semantic_hints: true,
      include_safety_findings: true,
      include_layout_diagnostics: true,
      include_markdown: true,
      include_tables: true
    });
    return {
      workflow: "mixed_pdf_review",
      needs_ocr: true,
      reason: "Some sampled pages look text-based while others look image-only; use read_pdf for selectable-text pages and OCR for scanned pages.",
      read_pdf_arguments: readPdfArguments
    };
  }
  if (profile === "digital_text") {
    Object.assign(readPdfArguments, {
      include_chunks: true,
      include_semantic_hints: true,
      include_safety_findings: true,
      include_layout_diagnostics: true,
      include_markdown: true,
      include_tables: true
    });
    return {
      workflow: "agentic_rag",
      needs_ocr: false,
      reason: "Sampled pages expose selectable text; citation chunks, semantic hints, table extraction, and safety findings are the highest-value next read_pdf options.",
      read_pdf_arguments: readPdfArguments
    };
  }
  return {
    workflow: "metadata_review",
    needs_ocr: false,
    reason: "Sampled pages expose limited text; inspect metadata, forms, attachments, structure, and selected pages before running a heavier extraction.",
    read_pdf_arguments: readPdfArguments
  };
};
var inspectPdfSource = async (source, options) => {
  const sourceDescription = source.path ?? source.url ?? "unknown source";
  let pdfDocument = null;
  try {
    const targetPages = getTargetPages(source.pages, sourceDescription);
    const { pages: _pages, ...loadArgs } = source;
    pdfDocument = await loadPdfDocument(loadArgs, sourceDescription);
    const totalPages = pdfDocument.numPages;
    const validTargetPages = targetPages?.filter((page) => page <= totalPages);
    const invalidPages = targetPages?.filter((page) => page > totalPages) ?? [];
    const sampledPages = selectInspectionSamplePages(totalPages, validTargetPages, options.sample_pages);
    const metadataOutput = await extractMetadataAndPageCount(pdfDocument, options.include_metadata, true);
    const structureOutput = await extractDocumentStructure(pdfDocument, {
      includeOutline: true,
      includePageLabels: true,
      includePermissions: true,
      includeFormFields: true,
      includeAttachments: true
    });
    const structureTrees = sampledPages.length > 0 ? await extractStructureTrees(pdfDocument, sampledPages) : [];
    const documentSignals = buildDocumentSignals(structureOutput, structureTrees.length > 0);
    const pageSignals = await Promise.all(sampledPages.map((pageNum) => inspectPageSignal(pdfDocument, pageNum)));
    const pageGeometry = sampledPages.length > 0 ? await extractPageGeometry(pdfDocument, sampledPages) : [];
    const profile = classifyPdfInspectionProfile(pageSignals);
    const recommendation = buildInspectionRecommendation(source, profile, documentSignals);
    const warnings = buildWarnings(invalidPages, totalPages);
    if (targetPages !== undefined && sampledPages.length === 0) {
      warnings.push("No requested pages are inside the document page range.");
    }
    if (recommendation.needs_ocr) {
      warnings.push("Default PDF Reader MCP does not perform OCR; use an optional OCR-capable engine for scanned pages.");
    }
    const data = {
      profile,
      num_pages: totalPages,
      sampled_pages: sampledPages,
      page_signals: pageSignals,
      document_signals: documentSignals,
      recommendation,
      ...metadataOutput.info ? { info: metadataOutput.info } : {},
      ...metadataOutput.metadata ? { metadata: metadataOutput.metadata } : {},
      ...pageGeometry.length > 0 ? { page_geometry: pageGeometry } : {},
      ...warnings.length > 0 ? { warnings } : {}
    };
    return {
      source: sourceDescription,
      success: true,
      data
    };
  } catch (error) {
    if (error instanceof PdfError) {
      return { source: sourceDescription, success: false, error: error.message };
    }
    const message = error instanceof Error ? error.message : String(error);
    logger5.error("Unexpected error inspecting PDF source", {
      sourceDescription,
      error: message
    });
    return {
      source: sourceDescription,
      success: false,
      error: `Failed to inspect PDF from ${sourceDescription}.`
    };
  } finally {
    const loadingTask = pdfDocument?.loadingTask;
    if (loadingTask && typeof loadingTask.destroy === "function") {
      try {
        await loadingTask.destroy();
      } catch (destroyError) {
        const message = destroyError instanceof Error ? destroyError.message : String(destroyError);
        logger5.warn("Error destroying PDF document after inspection", {
          sourceDescription,
          error: message
        });
      }
    }
  }
};
var defaultInspectPdfOptions = () => ({
  sample_pages: DEFAULT_SAMPLE_PAGES,
  include_metadata: true
});

// src/schemas/inspectPdf.ts
import {
  array as array2,
  bool as bool2,
  description as description2,
  gte as gte2,
  int as int2,
  lte,
  num as num2,
  object as object2,
  optional as optional2
} from "@sylphx/vex";

// src/schemas/readPdf.ts
import {
  array,
  bool,
  description,
  gte,
  int,
  min,
  num,
  object,
  optional,
  str,
  union
} from "@sylphx/vex";
var pageSpecifierSchema = union(array(num(int, gte(1))), str(min(1)));
var pdfSourceSchema = object({
  path: optional(str(min(1), description("Path to the local PDF file (absolute or relative to cwd)."))),
  url: optional(str(min(1), description("URL of the PDF file."))),
  pages: optional(pageSpecifierSchema)
});
var readPdfArgsSchema = object({
  sources: array(pdfSourceSchema),
  include_full_text: optional(bool(description("Include the full text content of each PDF (only if 'pages' is not specified for that source)."))),
  include_metadata: optional(bool(description("Include metadata and info objects for each PDF."))),
  include_page_count: optional(bool(description("Include the total number of pages for each PDF."))),
  include_images: optional(bool(description("Extract and include embedded images from the PDF pages as base64-encoded data."))),
  include_tables: optional(bool(description("Detect and extract tables from PDF pages. Uses spatial clustering of text coordinates to identify tabular structures."))),
  include_elements: optional(bool(description("Include agent-ready structured document elements with page numbers, stable IDs, provenance, and best-effort bounding boxes."))),
  include_semantic_hints: optional(bool(description("Include deterministic semantic hints on text elements, such as heading, list item, or paragraph."))),
  include_markdown: optional(bool(description("Include a Markdown rendering of extracted pages for RAG, summarization, and agent context."))),
  include_html: optional(bool(description("Include a simple HTML rendering of extracted pages for preview, export, and downstream conversion."))),
  include_chunks: optional(bool(description("Include page-level citation-ready chunks with text, element IDs, page ranges, and best-effort bounding boxes."))),
  include_outline: optional(bool(description("Include document outline/bookmark entries when the PDF exposes them."))),
  include_annotations: optional(bool(description("Include page annotations such as links, notes, and form-related annotations with safe summary fields."))),
  include_page_labels: optional(bool(description("Include PDF page labels when available, such as roman numerals or section labels."))),
  include_page_geometry: optional(bool(description("Include page viewport geometry such as width, height, rotation, user unit, and view box."))),
  include_permissions: optional(bool(description("Include PDF permission and marking signals when exposed by the parser."))),
  include_form_fields: optional(bool(description("Include PDF form field summaries when AcroForm fields are exposed."))),
  include_attachments: optional(bool(description("Include embedded attachment metadata such as filename and size. Attachment bytes are not returned."))),
  include_structure_tree: optional(bool(description("Include best-effort tagged PDF structure trees for selected pages when the PDF exposes them."))),
  include_safety_findings: optional(bool(description("Include deterministic content safety findings for prompt-injection patterns, tiny text, and off-page text."))),
  include_layout_diagnostics: optional(bool(description("Include deterministic page layout profiles, reading-order confidence, column signals, and warnings for agent routing.")))
});

// src/schemas/inspectPdf.ts
var inspectPdfArgsSchema = object2({
  sources: array2(pdfSourceSchema),
  sample_pages: optional2(num2(int2, gte2(1), lte(20), description2("Maximum number of pages to sample per source for lightweight PDF profiling. Defaults to 5."))),
  include_metadata: optional2(bool2(description2("Include PDF metadata and info objects in the inspection response.")))
});

// src/handlers/inspectPdf.ts
var MAX_CONCURRENT_SOURCES = 3;
var inspectPdf = tool().description("Inspects one or more PDFs and recommends the best read_pdf options for agentic extraction, citations, safety, and OCR triage.").input(inspectPdfArgsSchema).handler(async ({ input }) => {
  const options = {
    ...defaultInspectPdfOptions(),
    ...input.sample_pages !== undefined ? { sample_pages: input.sample_pages } : {},
    ...input.include_metadata !== undefined ? { include_metadata: input.include_metadata } : {}
  };
  const results = [];
  for (let i = 0;i < input.sources.length; i += MAX_CONCURRENT_SOURCES) {
    const batch = input.sources.slice(i, i + MAX_CONCURRENT_SOURCES);
    const batchResults = await Promise.all(batch.map((source) => inspectPdfSource(source, options)));
    results.push(...batchResults);
  }
  if (results.every((result) => !result.success)) {
    const errorMessages = results.map((result) => result.error).join("; ");
    return toolError(`All PDF sources failed inspection: ${errorMessages}`);
  }
  return text(JSON.stringify({ results }, null, 2));
});

// src/handlers/readPdf.ts
import { image, text as text2, tool as tool2, toolError as toolError2 } from "@sylphx/mcp-server-sdk";

// src/pdf/tableExtractor.ts
var logger6 = createLogger("TableExtractor");
var Y_TOLERANCE = 5;
var COLUMN_GAP_THRESHOLD = 15;
var MIN_ROWS = 2;
var MIN_COLS = 2;
var MIN_ROW_ITEMS = 2;
var buildBoundingBox2 = (x, y, width, height) => {
  if (![x, y, width].every(Number.isFinite) || height === undefined || !Number.isFinite(height)) {
    return;
  }
  return {
    left: x,
    bottom: y,
    right: x + Math.max(0, width),
    top: y + Math.max(0, height)
  };
};
var mergeBoundingBoxes2 = (boxes) => {
  if (boxes.length === 0)
    return;
  return {
    left: Math.min(...boxes.map((box) => box.left)),
    bottom: Math.min(...boxes.map((box) => box.bottom)),
    right: Math.max(...boxes.map((box) => box.right)),
    top: Math.max(...boxes.map((box) => box.top))
  };
};
var extractTextItemsWithPositions = async (page) => {
  const textContent = await page.getTextContent();
  const items = [];
  for (const item of textContent.items) {
    const textItem = item;
    if (!textItem.str.trim())
      continue;
    if (!textItem.transform || textItem.transform.length < 6)
      continue;
    const x = textItem.transform[4];
    const y = textItem.transform[5];
    if (x === undefined || y === undefined)
      continue;
    const height = textItem.height ?? Math.abs(textItem.transform[3] ?? 0);
    items.push({
      text: textItem.str,
      x,
      y,
      width: textItem.width ?? textItem.str.length * 6,
      ...height > 0 ? { height } : {},
      ...height > 0 ? {
        bounding_box: buildBoundingBox2(x, y, textItem.width ?? textItem.str.length * 6, height)
      } : {}
    });
  }
  return items;
};
var clusterByY = (items, tolerance = Y_TOLERANCE) => {
  if (items.length === 0)
    return [];
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const firstItem = sorted[0];
  if (!firstItem)
    return [];
  const rows = [];
  let currentRow = { y: firstItem.y, items: [firstItem] };
  for (let i = 1;i < sorted.length; i++) {
    const item = sorted[i];
    if (!item)
      continue;
    const yDiff = Math.abs(currentRow.y - item.y);
    if (yDiff <= tolerance) {
      currentRow.items.push(item);
    } else {
      rows.push(currentRow);
      currentRow = { y: item.y, items: [item] };
    }
  }
  rows.push(currentRow);
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
  }
  return rows;
};
var detectColumnBoundaries = (rows, gapThreshold = COLUMN_GAP_THRESHOLD) => {
  if (rows.length === 0)
    return [];
  const allXPositions = [];
  for (const row of rows) {
    for (const item of row.items) {
      allXPositions.push(item.x);
    }
  }
  if (allXPositions.length === 0)
    return [];
  allXPositions.sort((a, b) => a - b);
  const firstX = allXPositions[0];
  if (firstX === undefined)
    return [];
  const boundaries = [firstX];
  for (let i = 1;i < allXPositions.length; i++) {
    const current = allXPositions[i];
    const previous = allXPositions[i - 1];
    if (current === undefined || previous === undefined)
      continue;
    const gap = current - previous;
    if (gap >= gapThreshold) {
      boundaries.push(current);
    }
  }
  return boundaries;
};
var columnIndexForItem = (item, columnBoundaries, tolerance = COLUMN_GAP_THRESHOLD / 2) => {
  for (let i = columnBoundaries.length - 1;i >= 0; i--) {
    const boundary = columnBoundaries[i];
    if (boundary !== undefined && item.x >= boundary - tolerance) {
      return i;
    }
  }
  return 0;
};
var assignToTableCells = (row, rowIndex, columnBoundaries) => {
  const accumulators = Array.from({ length: columnBoundaries.length }, () => ({ textParts: [], boundingBoxes: [] }));
  for (const item of row.items) {
    const colIndex = columnIndexForItem(item, columnBoundaries);
    const accumulator = accumulators[colIndex];
    if (!accumulator)
      continue;
    accumulator.textParts.push(item.text);
    if (item.bounding_box) {
      accumulator.boundingBoxes.push(item.bounding_box);
    }
  }
  const cells = accumulators.map((accumulator, colIndex) => {
    const boundingBox = mergeBoundingBoxes2(accumulator.boundingBoxes);
    return {
      text: accumulator.textParts.join(" "),
      rowIndex,
      colIndex,
      ...boundingBox ? { bounding_box: boundingBox } : {}
    };
  });
  return {
    rowValues: cells.map((cell) => cell.text),
    cells
  };
};
var calculateConfidence = (rows, columnBoundaries) => {
  if (rows.length < MIN_ROWS || columnBoundaries.length < MIN_COLS) {
    return 0;
  }
  let score = 0;
  let checks = 0;
  for (const row of rows) {
    const itemsPerColumn = new Set;
    for (const item of row.items) {
      for (let i = columnBoundaries.length - 1;i >= 0; i--) {
        const boundary = columnBoundaries[i];
        if (boundary !== undefined && item.x >= boundary - COLUMN_GAP_THRESHOLD / 2) {
          itemsPerColumn.add(i);
          break;
        }
      }
    }
    score += itemsPerColumn.size / columnBoundaries.length;
    checks++;
  }
  if (rows.length >= 2) {
    const spacings = [];
    for (let i = 1;i < rows.length; i++) {
      const prevRow = rows[i - 1];
      const currRow = rows[i];
      if (prevRow && currRow) {
        spacings.push(Math.abs(prevRow.y - currRow.y));
      }
    }
    if (spacings.length > 0) {
      const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
      const variance = spacings.reduce((sum, s) => sum + (s - avgSpacing) ** 2, 0) / spacings.length;
      const stdDev = Math.sqrt(variance);
      const regularityScore = avgSpacing > 0 ? Math.max(0, 1 - stdDev / avgSpacing) : 0;
      score += regularityScore;
      checks++;
    }
  }
  return checks > 0 ? Math.min(1, score / checks) : 0;
};
var identifyTableRegions = (rows) => {
  const regions = [];
  const candidateRows = rows.filter((row) => row.items.length >= MIN_ROW_ITEMS);
  if (candidateRows.length < MIN_ROWS) {
    return regions;
  }
  const columnBoundaries = detectColumnBoundaries(candidateRows);
  if (columnBoundaries.length < MIN_COLS) {
    return regions;
  }
  let currentRegion = [];
  for (const row of candidateRows) {
    const alignedItems = row.items.filter((item) => {
      return columnBoundaries.some((boundary) => Math.abs(item.x - boundary) < COLUMN_GAP_THRESHOLD);
    });
    if (alignedItems.length >= MIN_COLS - 1) {
      currentRegion.push(row);
    } else if (currentRegion.length >= MIN_ROWS) {
      const firstRow = currentRegion[0];
      const lastRow = currentRegion[currentRegion.length - 1];
      if (firstRow && lastRow) {
        regions.push({
          rows: currentRegion,
          columnBoundaries,
          startY: firstRow.y,
          endY: lastRow.y
        });
      }
      currentRegion = [];
    } else {
      currentRegion = [];
    }
  }
  if (currentRegion.length >= MIN_ROWS) {
    const firstRow = currentRegion[0];
    const lastRow = currentRegion[currentRegion.length - 1];
    if (firstRow && lastRow) {
      regions.push({
        rows: currentRegion,
        columnBoundaries,
        startY: firstRow.y,
        endY: lastRow.y
      });
    }
  }
  return regions;
};
var extractTablesFromPage = async (page, pageNum) => {
  const tables = [];
  try {
    const textItems = await extractTextItemsWithPositions(page);
    if (textItems.length === 0) {
      return tables;
    }
    const rows = clusterByY(textItems);
    const tableRegions = identifyTableRegions(rows);
    for (let tableIndex = 0;tableIndex < tableRegions.length; tableIndex++) {
      const region = tableRegions[tableIndex];
      if (!region)
        continue;
      const tableRows = [];
      const tableCells = [];
      for (let rowIndex = 0;rowIndex < region.rows.length; rowIndex++) {
        const row = region.rows[rowIndex];
        if (!row)
          continue;
        const assigned = assignToTableCells(row, rowIndex, region.columnBoundaries);
        tableRows.push(assigned.rowValues);
        tableCells.push(...assigned.cells);
      }
      const confidence = calculateConfidence(region.rows, region.columnBoundaries);
      const tableBoundingBox = mergeBoundingBoxes2(tableCells.map((cell) => cell.bounding_box).filter((box) => box !== undefined));
      if (confidence >= 0.3) {
        tables.push({
          page: pageNum,
          tableIndex,
          rows: tableRows,
          cells: tableCells,
          ...tableBoundingBox ? { bounding_box: tableBoundingBox } : {},
          rowCount: tableRows.length,
          colCount: region.columnBoundaries.length,
          confidence: Math.round(confidence * 100) / 100
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger6.warn("Error extracting tables from page", { pageNum, error: message });
  }
  return tables;
};
var extractTables = async (pdfDocument, pagesToProcess) => {
  const allTables = [];
  for (const pageNum of pagesToProcess) {
    try {
      const page = await pdfDocument.getPage(pageNum);
      const pageTables = await extractTablesFromPage(page, pageNum);
      allTables.push(...pageTables);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger6.warn("Error getting page for table extraction", { pageNum, error: message });
    }
  }
  return allTables;
};
var tableToMarkdown = (table) => {
  if (table.rows.length === 0)
    return "";
  const lines = [];
  const headerRow = table.rows[0];
  if (!headerRow)
    return "";
  lines.push(`| ${headerRow.map((cell) => cell.trim() || " ").join(" | ")} |`);
  lines.push(`| ${headerRow.map(() => "---").join(" | ")} |`);
  for (let i = 1;i < table.rows.length; i++) {
    const row = table.rows[i];
    if (!row)
      continue;
    const paddedRow = [...row];
    while (paddedRow.length < headerRow.length) {
      paddedRow.push("");
    }
    lines.push(`| ${paddedRow.map((cell) => cell.trim() || " ").join(" | ")} |`);
  }
  return lines.join(`
`);
};
var tablesToMarkdown = (tables) => {
  if (tables.length === 0)
    return "";
  const sections = ["## Extracted Tables", ""];
  for (const table of tables) {
    sections.push(`### Page ${table.page}, Table ${table.tableIndex + 1}`);
    sections.push(`*Confidence: ${(table.confidence * 100).toFixed(0)}%*`);
    sections.push("");
    sections.push(tableToMarkdown(table));
    sections.push("");
  }
  return sections.join(`
`);
};

// src/pdf/documentModel.ts
var DEFAULT_CHUNK_MAX_CHARS = 1800;
var LAYOUT_COLUMN_MIN_GAP = 48;
var LAYOUT_COLUMN_MIN_GAP_RATIO = 0.14;
var LAYOUT_SPANNING_WIDTH_RATIO = 0.72;
var LAYOUT_POSITIONED_RATIO_WARNING = 0.8;
var buildElementId = (page, type, index) => `p${String(page)}-${type}-${String(index)}`;
var imageElementMetadata = (imageData) => {
  const { data: _data, ...metadata } = imageData;
  return metadata;
};
var buildPageTextStats = (items) => {
  const heights = items.filter((item) => item.type === "text" && item.textContent?.trim() && item.height).map((item) => item.height).sort((a, b) => a - b);
  if (heights.length === 0) {
    return { maxHeight: 0, medianHeight: 0, textItemCount: 0 };
  }
  const midpoint = Math.floor(heights.length / 2);
  const medianHeight = heights.length % 2 === 0 ? ((heights[midpoint - 1] ?? 0) + (heights[midpoint] ?? 0)) / 2 : heights[midpoint] ?? 0;
  return {
    maxHeight: heights.at(-1) ?? 0,
    medianHeight,
    textItemCount: heights.length
  };
};
var buildSemanticHint = (item, stats) => {
  if (item.type !== "text" || !item.textContent?.trim())
    return;
  const textContent = item.textContent.trim();
  if (/^([-*]\s+|\d+[.)]\s+)/.test(textContent)) {
    return {
      role: "list_item",
      confidence: 0.92,
      signals: ["list-prefix"]
    };
  }
  const height = item.height ?? 0;
  const isShortLine = textContent.length <= 120;
  const endsLikeSentence = /[.!?]$/.test(textContent);
  const isLargeText = stats.textItemCount > 1 && height > 0 && stats.medianHeight > 0 && height >= stats.medianHeight * 1.3 && height >= stats.maxHeight * 0.8;
  if (isLargeText && isShortLine && !endsLikeSentence) {
    const ratio = height / stats.medianHeight;
    const level = ratio >= 1.8 ? 1 : ratio >= 1.55 ? 2 : 3;
    return {
      role: "heading",
      level,
      confidence: 0.78,
      signals: ["larger-text", "short-line"]
    };
  }
  return {
    role: "paragraph",
    confidence: 0.5,
    signals: ["default-text"]
  };
};
var contentItemToElement = (item, page, index, semanticHint) => {
  if (item.type === "text" && item.textContent?.trim()) {
    return {
      id: buildElementId(page, "text", index),
      type: "text",
      page,
      content: item.textContent,
      bounding_box: item.bounding_box,
      provenance: {
        engine: "pdfjs",
        source: "text-content"
      },
      ...semanticHint ? { semantic_hint: semanticHint } : {}
    };
  }
  if (item.type === "image" && item.imageData) {
    return {
      id: buildElementId(page, "image", index),
      type: "image",
      page,
      image: imageElementMetadata(item.imageData),
      bounding_box: item.bounding_box,
      provenance: {
        engine: "pdfjs",
        source: "image-xobject"
      }
    };
  }
  return;
};
var buildStructuredElements = (pageContents, tables, includeSemanticHints) => {
  const elements = [];
  const tablesByPage = new Map;
  for (const table of tables ?? []) {
    const pageTables = tablesByPage.get(table.page) ?? [];
    pageTables.push(table);
    tablesByPage.set(table.page, pageTables);
  }
  const appendTableElement = (table) => {
    elements.push({
      id: buildElementId(table.page, "table", table.tableIndex + 1),
      type: "table",
      page: table.page,
      table: {
        rows: table.rows,
        ...table.cells ? { cells: table.cells } : {},
        ...table.bounding_box ? { bounding_box: table.bounding_box } : {},
        rowCount: table.rowCount,
        colCount: table.colCount,
        confidence: table.confidence
      },
      bounding_box: table.bounding_box,
      confidence: table.confidence,
      provenance: {
        engine: "pdfjs",
        source: "table-detector"
      }
    });
  };
  for (const pageContent of pageContents) {
    const stats = includeSemanticHints ? buildPageTextStats(pageContent.items) : undefined;
    let elementIndex = 1;
    for (const item of pageContent.items) {
      const semanticHint = stats ? buildSemanticHint(item, stats) : undefined;
      const element = contentItemToElement(item, pageContent.page, elementIndex, semanticHint);
      if (element) {
        elements.push(element);
        elementIndex++;
      }
    }
    const pageTables = tablesByPage.get(pageContent.page);
    if (pageTables) {
      for (const table of pageTables.sort((a, b) => a.tableIndex - b.tableIndex)) {
        appendTableElement(table);
      }
      tablesByPage.delete(pageContent.page);
    }
  }
  const remainingTables = Array.from(tablesByPage.values()).flat().sort((a, b) => a.page - b.page || a.tableIndex - b.tableIndex);
  for (const table of remainingTables) {
    appendTableElement(table);
  }
  return elements;
};
var renderMarkdownFromPageContents = (pageContents, tables) => {
  const sections = [];
  for (const pageContent of pageContents) {
    const pageLines = [`## Page ${String(pageContent.page)}`, ""];
    for (const item of pageContent.items) {
      if (item.type === "text" && item.textContent?.trim()) {
        pageLines.push(item.textContent.trim(), "");
      } else if (item.type === "image" && item.imageData) {
        pageLines.push(`[Image ${String(item.imageData.index + 1)}: ${String(item.imageData.width)}x${String(item.imageData.height)} ${item.imageData.format}]`, "");
      }
    }
    sections.push(pageLines.join(`
`).trimEnd());
  }
  if (tables && tables.length > 0) {
    sections.push(tablesToMarkdown(tables));
  }
  return sections.join(`

`).trim();
};
var escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
var renderTablesToHtml = (tables) => {
  if (!tables || tables.length === 0)
    return [];
  return tables.map((table) => {
    const rows = table.rows.map((row) => {
      const cells = row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("");
      return `<tr>${cells}</tr>`;
    }).join(`
`);
    return [
      `<table data-page="${String(table.page)}" data-table-index="${String(table.tableIndex)}">`,
      "<tbody>",
      rows,
      "</tbody>",
      "</table>"
    ].join(`
`);
  });
};
var renderHtmlFromPageContents = (pageContents, tables) => {
  const sections = pageContents.map((pageContent) => {
    const body = [
      `<section data-page="${String(pageContent.page)}">`,
      `<h2>Page ${String(pageContent.page)}</h2>`
    ];
    for (const item of pageContent.items) {
      if (item.type === "text" && item.textContent?.trim()) {
        body.push(`<p>${escapeHtml(item.textContent.trim())}</p>`);
      } else if (item.type === "image" && item.imageData) {
        body.push([
          `<figure data-image-index="${String(item.imageData.index)}">`,
          `<figcaption>Image ${String(item.imageData.index + 1)}: ${String(item.imageData.width)}x${String(item.imageData.height)} ${escapeHtml(item.imageData.format)}</figcaption>`,
          "</figure>"
        ].join(`
`));
      }
    }
    body.push("</section>");
    return body.join(`
`);
  });
  return [...sections, ...renderTablesToHtml(tables)].join(`

`).trim();
};
var elementText = (element) => {
  if (element.type === "text")
    return element.content.trim();
  if (element.type === "table") {
    const tableText = element.table.rows.map((row) => row.join(" | ")).join(`
`).trim();
    return tableText.length > 0 ? tableText : undefined;
  }
  return;
};
var elementRole = (element) => element.type === "text" ? element.semantic_hint?.role : undefined;
var chunkTextLength = (draft) => draft.textParts.reduce((sum, part) => sum + part.length + 1, 0);
var createChunkDraft = (element, strategy, heading) => ({
  pageStart: element.page,
  pageEnd: element.page,
  textParts: [],
  elementIds: [],
  boundingBoxes: [],
  strategy,
  heading
});
var addElementToChunk = (draft, element, textValue) => {
  draft.pageEnd = Math.max(draft.pageEnd, element.page);
  draft.textParts.push(textValue);
  draft.elementIds.push(element.id);
  if (element.bounding_box) {
    draft.boundingBoxes.push(element.bounding_box);
  }
};
var finalizeChunk = (draft, index) => {
  const textValue = draft.textParts.join(`
`).trim();
  if (!textValue)
    return;
  return {
    id: draft.pageStart === draft.pageEnd ? `p${String(draft.pageStart)}-chunk-${String(index)}` : `p${String(draft.pageStart)}-p${String(draft.pageEnd)}-chunk-${String(index)}`,
    page_start: draft.pageStart,
    page_end: draft.pageEnd,
    text: textValue,
    element_ids: draft.elementIds,
    strategy: draft.strategy,
    ...draft.heading ? { heading: draft.heading } : {},
    ...draft.boundingBoxes.length > 0 ? { bounding_boxes: draft.boundingBoxes } : {}
  };
};
var buildCitationChunks = (elements, options) => {
  const maxChars = options.maxChars ?? DEFAULT_CHUNK_MAX_CHARS;
  const chunks = [];
  let current;
  const pushCurrent = () => {
    if (!current)
      return;
    const chunk = finalizeChunk(current, chunks.length + 1);
    if (chunk)
      chunks.push(chunk);
    current = undefined;
  };
  for (const element of elements) {
    const textValue = elementText(element);
    if (!textValue)
      continue;
    const role = elementRole(element);
    const shouldStartSemanticChunk = options.useSemanticBoundaries && role === "heading";
    const shouldStartTableChunk = element.type === "table";
    const exceedsSize = current !== undefined && current.elementIds.length > 0 && chunkTextLength(current) + textValue.length > maxChars;
    const crossesPage = current !== undefined && current.pageEnd !== element.page;
    if (shouldStartSemanticChunk || shouldStartTableChunk || exceedsSize || crossesPage) {
      pushCurrent();
    }
    if (!current) {
      const strategy = shouldStartSemanticChunk ? "semantic" : exceedsSize ? "size" : "page";
      const heading = shouldStartSemanticChunk && element.type === "text" ? element.content.trim() : undefined;
      current = createChunkDraft(element, strategy, heading);
    }
    if (element.type === "table" && current.elementIds.length === 0) {
      current.strategy = "table";
    }
    addElementToChunk(current, element, textValue);
    if (element.type === "table") {
      pushCurrent();
    }
  }
  pushCurrent();
  return chunks;
};
var roundRatio = (value) => Math.round(value * 100) / 100;
var clampConfidence = (value) => Math.max(0.2, Math.min(0.98, roundRatio(value)));
var boxWidth = (box) => box ? Math.max(0, box.right - box.left) : 0;
var boxArea = (box) => {
  if (!box)
    return 0;
  return Math.max(0, box.right - box.left) * Math.max(0, box.top - box.bottom);
};
var boxCenterX = (box) => box ? (box.left + box.right) / 2 : 0;
var toLayoutColumn = (items, index) => {
  const boxes = items.map((item) => item.bounding_box).filter((box) => box !== undefined);
  return {
    index,
    left: Math.min(...boxes.map((box) => box.left)),
    right: Math.max(...boxes.map((box) => box.right)),
    item_count: items.length
  };
};
var detectLayoutColumns = (positionedItems) => {
  if (positionedItems.length < 4)
    return [];
  const left = Math.min(...positionedItems.map((item) => item.bounding_box?.left ?? 0));
  const right = Math.max(...positionedItems.map((item) => item.bounding_box?.right ?? 0));
  const pageWidth = right - left;
  if (pageWidth <= 0)
    return [];
  const candidates = positionedItems.filter((item) => boxWidth(item.bounding_box) < pageWidth * LAYOUT_SPANNING_WIDTH_RATIO);
  if (candidates.length < 4)
    return [];
  const sorted = [...candidates].sort((a, b) => (a.bounding_box?.left ?? 0) - (b.bounding_box?.left ?? 0));
  let currentRight = sorted[0]?.bounding_box?.right;
  if (currentRight === undefined)
    return [];
  let largestGap = 0;
  let cutPosition;
  for (let i = 1;i < sorted.length; i++) {
    const box = sorted[i]?.bounding_box;
    if (!box)
      continue;
    if (box.left > currentRight) {
      const gap = box.left - currentRight;
      if (gap > largestGap) {
        largestGap = gap;
        cutPosition = (box.left + currentRight) / 2;
      }
    }
    currentRight = Math.max(currentRight, box.right);
  }
  const minGap = Math.max(LAYOUT_COLUMN_MIN_GAP, pageWidth * LAYOUT_COLUMN_MIN_GAP_RATIO);
  if (cutPosition === undefined || largestGap < minGap)
    return [];
  const leftColumn = candidates.filter((item) => boxCenterX(item.bounding_box) < cutPosition);
  const rightColumn = candidates.filter((item) => boxCenterX(item.bounding_box) >= cutPosition);
  if (leftColumn.length < 2 || rightColumn.length < 2)
    return [];
  return [toLayoutColumn(leftColumn, 1), toLayoutColumn(rightColumn, 2)];
};
var overlapArea = (first, second) => {
  if (!first || !second)
    return 0;
  const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
  const height = Math.max(0, Math.min(first.top, second.top) - Math.max(first.bottom, second.bottom));
  return width * height;
};
var countSignificantOverlaps = (items) => {
  const positionedItems = items.filter((item) => item.bounding_box !== undefined).slice(0, 200);
  let overlaps = 0;
  for (let i = 0;i < positionedItems.length; i++) {
    for (let j = i + 1;j < positionedItems.length; j++) {
      const first = positionedItems[i];
      const second = positionedItems[j];
      if (!first?.bounding_box || !second?.bounding_box)
        continue;
      const smallerArea = Math.min(boxArea(first.bounding_box), boxArea(second.bounding_box));
      if (smallerArea <= 0)
        continue;
      if (overlapArea(first.bounding_box, second.bounding_box) / smallerArea > 0.45) {
        overlaps++;
      }
    }
  }
  return overlaps;
};
var buildLayoutDiagnostics = (pageContents) => pageContents.map((pageContent) => {
  const itemCount = pageContent.items.length;
  const textItemCount = pageContent.items.filter((item) => item.type === "text").length;
  const imageItemCount = pageContent.items.filter((item) => item.type === "image").length;
  const positionedItems = pageContent.items.filter((item) => item.bounding_box !== undefined);
  const positionedItemRatio = itemCount === 0 ? 0 : roundRatio(positionedItems.length / itemCount);
  const columns = detectLayoutColumns(positionedItems);
  const left = positionedItems.length ? Math.min(...positionedItems.map((item) => item.bounding_box?.left ?? 0)) : 0;
  const right = positionedItems.length ? Math.max(...positionedItems.map((item) => item.bounding_box?.right ?? 0)) : 0;
  const pageWidth = right - left;
  const spanningItemCount = pageWidth > 0 ? positionedItems.filter((item) => boxWidth(item.bounding_box) >= pageWidth * LAYOUT_SPANNING_WIDTH_RATIO).length : 0;
  const overlapCount = countSignificantOverlaps(pageContent.items);
  const signals = new Set;
  const warnings = [];
  if (itemCount === 0)
    signals.add("empty-page-content");
  if (textItemCount > 0)
    signals.add("text-items");
  if (imageItemCount > 0)
    signals.add("image-items");
  if (positionedItems.length > 0)
    signals.add("positioned-items");
  if (positionedItemRatio < 1 && itemCount > 0)
    signals.add("unpositioned-items");
  if (columns.length >= 2)
    signals.add("two-column-layout");
  if (spanningItemCount > 0)
    signals.add("spanning-items");
  if (itemCount > 0 && itemCount < 3)
    signals.add("sparse-page");
  if (overlapCount > 0)
    signals.add("overlap-risk");
  if (positionedItemRatio < LAYOUT_POSITIONED_RATIO_WARNING && itemCount > 0) {
    warnings.push("Some content items are missing coordinates; reading-order confidence is reduced.");
  }
  if (overlapCount > 0) {
    warnings.push("Some positioned items overlap significantly; verify reading order before citation-critical use.");
  }
  const profile = itemCount === 0 ? "unknown" : textItemCount === 0 ? "image_or_sparse" : columns.length >= 2 && spanningItemCount > 0 ? "mixed_layout" : columns.length >= 2 ? "multi_column" : positionedItems.length > 0 ? "single_column" : "unknown";
  const readingOrder = profile === "multi_column" ? "columnar" : profile === "mixed_layout" ? "mixed" : profile === "single_column" ? "natural" : "uncertain";
  const baseConfidence = profile === "single_column" ? 0.92 : profile === "multi_column" ? 0.86 : profile === "mixed_layout" ? 0.78 : profile === "image_or_sparse" ? 0.42 : 0.3;
  const confidence = clampConfidence(baseConfidence - (1 - positionedItemRatio) * 0.35 - (overlapCount > 0 ? 0.12 : 0) - (itemCount > 0 && itemCount < 3 ? 0.12 : 0));
  if (confidence < 0.7 && itemCount > 0) {
    warnings.push("Layout confidence is below the recommended threshold for unattended RAG chunking.");
  }
  return {
    page: pageContent.page,
    profile,
    reading_order: readingOrder,
    confidence,
    item_count: itemCount,
    text_item_count: textItemCount,
    image_item_count: imageItemCount,
    positioned_item_ratio: positionedItemRatio,
    column_count: columns.length > 0 ? columns.length : positionedItems.length > 0 ? 1 : 0,
    ...columns.length > 0 ? { columns } : {},
    signals: [...signals],
    ...warnings.length > 0 ? { warnings } : {}
  };
});
var PROMPT_INJECTION_PATTERNS = [
  /\bignore (all )?(previous|prior|above) instructions\b/i,
  /\bdisregard (previous|prior|above) instructions\b/i,
  /\bsystem prompt\b/i,
  /\bdeveloper (message|instruction)s?\b/i,
  /\bdo not (follow|obey) .*instructions\b/i
];
var snippetFromText = (value) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
};
var isOutsideViewBox = (box, viewBox) => {
  if (!box || !viewBox)
    return false;
  const tolerance = 1;
  return box.right < viewBox.left - tolerance || box.left > viewBox.right + tolerance || box.top < viewBox.bottom - tolerance || box.bottom > viewBox.top + tolerance;
};
var buildSafetyFindings = (pageContents, pageGeometry) => {
  const findings = [];
  const geometryByPage = new Map(pageGeometry?.map((geometry) => [geometry.page, geometry]));
  for (const pageContent of pageContents) {
    let elementIndex = 1;
    const geometry = geometryByPage.get(pageContent.page);
    for (const item of pageContent.items) {
      const element = contentItemToElement(item, pageContent.page, elementIndex);
      if (!element) {
        continue;
      }
      if (element.type === "text") {
        const textContent = element.content.trim();
        const snippet = snippetFromText(textContent);
        if (PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(textContent))) {
          findings.push({
            type: "prompt_injection_pattern",
            severity: "high",
            page: pageContent.page,
            element_id: element.id,
            message: "Text matches a common prompt-injection instruction pattern.",
            snippet,
            ...element.bounding_box ? { bounding_box: element.bounding_box } : {}
          });
        }
        if (item.height !== undefined && item.height > 0 && item.height < 2) {
          findings.push({
            type: "tiny_text",
            severity: "medium",
            page: pageContent.page,
            element_id: element.id,
            message: "Text is unusually small and may be hidden, decorative, or extraction noise.",
            snippet,
            ...element.bounding_box ? { bounding_box: element.bounding_box } : {}
          });
        }
        if (isOutsideViewBox(element.bounding_box, geometry?.view_box)) {
          findings.push({
            type: "off_page_text",
            severity: "medium",
            page: pageContent.page,
            element_id: element.id,
            message: "Text bounding box falls outside the PDF page view box.",
            snippet,
            ...element.bounding_box ? { bounding_box: element.bounding_box } : {}
          });
        }
      }
      elementIndex++;
    }
  }
  return findings;
};

// src/handlers/readPdf.ts
var logger7 = createLogger("ReadPdf");
var processSingleSource = async (source, options) => {
  const sourceDescription = source.path ?? source.url ?? "unknown source";
  let individualResult = { source: sourceDescription, success: false };
  let pdfDocument = null;
  try {
    const targetPages = getTargetPages(source.pages, sourceDescription);
    const { pages: _pages, ...loadArgs } = source;
    pdfDocument = await loadPdfDocument(loadArgs, sourceDescription);
    const totalPages = pdfDocument.numPages;
    const metadataOutput = await extractMetadataAndPageCount(pdfDocument, options.includeMetadata, options.includePageCount);
    const output = { ...metadataOutput };
    const structureOutput = await extractDocumentStructure(pdfDocument, {
      includeOutline: options.includeOutline,
      includePageLabels: options.includePageLabels,
      includePermissions: options.includePermissions,
      includeFormFields: options.includeFormFields,
      includeAttachments: options.includeAttachments
    });
    Object.assign(output, structureOutput);
    const explicitPageContent = options.includeFullText || options.includeElements || options.includeSemanticHints || options.includeMarkdown || options.includeHtml || options.includeChunks || options.includeImages || options.includeSafetyFindings || options.includeLayoutDiagnostics;
    const pageScopedMetadata = options.includeTables || options.includeAnnotations || options.includePageGeometry || options.includeStructureTree;
    const includeSelectedPageText = targetPages !== undefined && !explicitPageContent && !pageScopedMetadata;
    const shouldSelectPages = explicitPageContent || includeSelectedPageText || pageScopedMetadata;
    const { pagesToProcess, invalidPages } = determinePagesToProcess(targetPages, totalPages, shouldSelectPages);
    const warnings = buildWarnings(invalidPages, totalPages);
    if (warnings.length > 0) {
      output.warnings = warnings;
    }
    if (pagesToProcess.length > 0) {
      const needsPageContent = explicitPageContent || includeSelectedPageText;
      let pageGeometry;
      if (options.includePageGeometry || options.includeSafetyFindings) {
        pageGeometry = await extractPageGeometry(pdfDocument, pagesToProcess);
        if (pageGeometry.length > 0 && options.includePageGeometry) {
          output.page_geometry = pageGeometry;
        }
      }
      if (needsPageContent) {
        const MAX_CONCURRENT_PAGES = 5;
        const pageContents = [];
        for (let i = 0;i < pagesToProcess.length; i += MAX_CONCURRENT_PAGES) {
          const batch = pagesToProcess.slice(i, i + MAX_CONCURRENT_PAGES);
          const batchResults = await Promise.all(batch.map((pageNum) => extractPageContent(pdfDocument, pageNum, options.includeImages, sourceDescription)));
          pageContents.push(...batchResults);
          if (i + MAX_CONCURRENT_PAGES < pagesToProcess.length) {
            await new Promise((resolve) => setImmediate(resolve));
          }
        }
        output.page_contents = pageContents.map((items, idx) => ({
          page: pagesToProcess[idx],
          items
        }));
        const extractedPageTexts = pageContents.map((items, idx) => ({
          page: pagesToProcess[idx],
          text: items.filter((item) => item.type === "text").map((item) => item.textContent).join("")
        }));
        if (targetPages) {
          output.page_texts = extractedPageTexts;
        } else if (options.includeFullText) {
          output.full_text = extractedPageTexts.map((p) => p.text).join(`

`);
        }
        if (options.includeImages) {
          const extractedImages = pageContents.flatMap((items) => items.filter((item) => item.type === "image" && item.imageData)).map((item) => item.imageData).filter((img) => img !== undefined);
          if (extractedImages.length > 0) {
            output.images = extractedImages;
          }
        }
      }
      if (options.includeTables) {
        const extractedTables = await extractTables(pdfDocument, pagesToProcess);
        if (extractedTables.length > 0) {
          output.tables = extractedTables;
        }
      }
      const buildElementsForOutput = () => buildStructuredElements(output.page_contents ?? [], output.tables, options.includeSemanticHints);
      if ((options.includeElements || options.includeSemanticHints) && output.page_contents) {
        output.elements = buildElementsForOutput();
      }
      if (options.includeMarkdown && output.page_contents) {
        output.markdown = renderMarkdownFromPageContents(output.page_contents, output.tables);
      }
      if (options.includeHtml && output.page_contents) {
        output.html = renderHtmlFromPageContents(output.page_contents, output.tables);
      }
      if (options.includeChunks && output.page_contents) {
        const chunkElements = output.elements ?? buildElementsForOutput();
        output.chunks = buildCitationChunks(chunkElements, {
          useSemanticBoundaries: options.includeSemanticHints
        });
      }
      if (options.includeSafetyFindings && output.page_contents) {
        const safetyFindings = buildSafetyFindings(output.page_contents, pageGeometry);
        if (safetyFindings.length > 0) {
          output.safety_findings = safetyFindings;
        }
      }
      if (options.includeLayoutDiagnostics && output.page_contents) {
        output.layout_diagnostics = buildLayoutDiagnostics(output.page_contents);
      }
      if (options.includeAnnotations) {
        const annotations = await extractAnnotations(pdfDocument, pagesToProcess);
        if (annotations.length > 0) {
          output.annotations = annotations;
        }
      }
      if (options.includeStructureTree) {
        const structureTrees = await extractStructureTrees(pdfDocument, pagesToProcess);
        if (structureTrees.length > 0) {
          output.structure_trees = structureTrees;
        }
      }
    }
    individualResult = { ...individualResult, data: output, success: true };
  } catch (error) {
    let errorMessage;
    if (error instanceof PdfError) {
      errorMessage = error.message;
    } else {
      const detail = error instanceof Error ? error.message : String(error);
      logger7.error("Unexpected error processing PDF source", {
        sourceDescription,
        error: detail
      });
      errorMessage = `Failed to process PDF from ${sourceDescription}.`;
    }
    individualResult.error = errorMessage;
    individualResult.success = false;
    individualResult.data = undefined;
  } finally {
    const loadingTask = pdfDocument?.loadingTask;
    if (loadingTask && typeof loadingTask.destroy === "function") {
      try {
        await loadingTask.destroy();
      } catch (destroyError) {
        const message = destroyError instanceof Error ? destroyError.message : String(destroyError);
        logger7.warn("Error destroying PDF document", { sourceDescription, error: message });
      }
    }
  }
  return individualResult;
};
var readPdf = tool2().description("Reads content/metadata/images from one or more PDFs (local/URL). Each source can specify pages to extract.").input(readPdfArgsSchema).handler(async ({ input }) => {
  const {
    sources,
    include_full_text,
    include_metadata,
    include_page_count,
    include_images,
    include_tables,
    include_elements,
    include_semantic_hints,
    include_markdown,
    include_html,
    include_chunks,
    include_outline,
    include_annotations,
    include_page_labels,
    include_page_geometry,
    include_permissions,
    include_form_fields,
    include_attachments,
    include_structure_tree,
    include_safety_findings,
    include_layout_diagnostics
  } = input;
  const MAX_CONCURRENT_SOURCES2 = 3;
  const results = [];
  const options = {
    includeFullText: include_full_text ?? false,
    includeMetadata: include_metadata ?? true,
    includePageCount: include_page_count ?? true,
    includeImages: include_images ?? false,
    includeTables: include_tables ?? false,
    includeElements: include_elements ?? false,
    includeSemanticHints: include_semantic_hints ?? false,
    includeMarkdown: include_markdown ?? false,
    includeHtml: include_html ?? false,
    includeChunks: include_chunks ?? false,
    includeOutline: include_outline ?? false,
    includeAnnotations: include_annotations ?? false,
    includePageLabels: include_page_labels ?? false,
    includePageGeometry: include_page_geometry ?? false,
    includePermissions: include_permissions ?? false,
    includeFormFields: include_form_fields ?? false,
    includeAttachments: include_attachments ?? false,
    includeStructureTree: include_structure_tree ?? false,
    includeSafetyFindings: include_safety_findings ?? false,
    includeLayoutDiagnostics: include_layout_diagnostics ?? false
  };
  for (let i = 0;i < sources.length; i += MAX_CONCURRENT_SOURCES2) {
    const batch = sources.slice(i, i + MAX_CONCURRENT_SOURCES2);
    const batchResults = await Promise.all(batch.map((source) => processSingleSource(source, options)));
    results.push(...batchResults);
  }
  const allFailed = results.every((r) => !r.success);
  if (allFailed) {
    const errorMessages = results.map((r) => r.error).join("; ");
    return toolError2(`All PDF sources failed to process: ${errorMessages}`);
  }
  const content = [];
  const resultsForJson = results.map((result) => {
    if (result.data) {
      const { images, page_contents, tables, ...dataWithoutBinaryContent } = result.data;
      const processedData = { ...dataWithoutBinaryContent };
      if (images) {
        processedData["image_info"] = images.map((img) => ({
          page: img.page,
          index: img.index,
          width: img.width,
          height: img.height,
          format: img.format
        }));
      }
      if (tables && tables.length > 0) {
        processedData["table_info"] = tables.map((tbl) => ({
          page: tbl.page,
          tableIndex: tbl.tableIndex,
          rowCount: tbl.rowCount,
          colCount: tbl.colCount,
          cellCount: tbl.cells?.length ?? tbl.rowCount * tbl.colCount,
          bounding_box: tbl.bounding_box,
          confidence: tbl.confidence
        }));
      }
      return { ...result, data: processedData };
    }
    return result;
  });
  content.push(text2(JSON.stringify({ results: resultsForJson }, null, 2)));
  for (const result of results) {
    if (!result.success || !result.data?.page_contents)
      continue;
    for (const pageContent of result.data.page_contents) {
      const pageTextParts = [];
      const pageImages = [];
      for (const item of pageContent.items) {
        if (item.type === "text" && item.textContent) {
          pageTextParts.push(item.textContent);
        } else if (item.type === "image" && item.imageData) {
          pageImages.push(item.imageData);
        }
      }
      if (pageTextParts.length > 0) {
        content.push(text2(`[Page ${pageContent.page}]
${pageTextParts.join(`
`)}`));
      }
      for (const img of pageImages) {
        content.push(image(img.data, "image/png"));
      }
    }
  }
  if (options.includeTables) {
    const allTables = [];
    for (const result of results) {
      if (result.success && result.data?.tables) {
        allTables.push(...result.data.tables);
      }
    }
    if (allTables.length > 0) {
      const markdownTables = tablesToMarkdown(allTables);
      content.push(text2(markdownTables));
    }
  }
  return content;
});

// src/index.ts
var require3 = createRequire2(import.meta.url);
var packageJson = require3("../package.json");
var transportType = process.env["MCP_TRANSPORT"] ?? "stdio";
var httpPort = Number.parseInt(process.env["MCP_HTTP_PORT"] ?? "8080", 10);
var httpHost = process.env["MCP_HTTP_HOST"] ?? "0.0.0.0";
var apiKey = process.env["MCP_API_KEY"];
var corsOrigin = process.env["MCP_CORS_ORIGIN"];
function createTransport() {
  if (transportType === "http") {
    return http({
      port: httpPort,
      hostname: httpHost,
      ...corsOrigin ? { cors: corsOrigin } : {}
    });
  }
  return stdio();
}
var server = createServer({
  name: "pdf-reader-mcp",
  version: packageJson.version,
  instructions: "MCP Server for inspecting PDF files and extracting text, metadata, images, citations, safety signals, and agent-ready document structure.",
  tools: { inspect_pdf: inspectPdf, read_pdf: readPdf },
  transport: createTransport()
});
async function main() {
  await server.start();
  if (transportType === "http") {
    console.log(`[PDF Reader MCP] Server running on http://${httpHost}:${httpPort}/mcp`);
    console.log(`[PDF Reader MCP] Health check: http://${httpHost}:${httpPort}/mcp/health`);
    if (apiKey) {
      console.log("[PDF Reader MCP] API key authentication enabled (X-API-Key header)");
    }
    if (corsOrigin) {
      console.log(`[PDF Reader MCP] CORS allowed origin: ${corsOrigin}`);
    }
    console.log("[PDF Reader MCP] Project root:", process.cwd());
  } else if (process.env["DEBUG_MCP"]) {
    console.error("[PDF Reader MCP] Server running on stdio");
    console.error("[PDF Reader MCP] Project root:", process.cwd());
  }
}
main().catch((error) => {
  console.error("[PDF Reader MCP] Server error:", error);
  process.exit(1);
});
