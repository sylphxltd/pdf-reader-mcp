#!/usr/bin/env node

// src/index.ts
import { createServer, http, stdio } from "@sylphx/mcp-server-sdk";

// src/handlers/readPdf.ts
import { image, text, tool, toolError } from "@sylphx/mcp-server-sdk";

// src/pdf/extractor.ts
import { OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PNG } from "pngjs";

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
var logger2 = createLogger("Extractor");
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
      if (typeof metadataObj.getAll === "function") {
        output.metadata = metadataObj.getAll();
      } else {
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
      const yCoord = textItem.transform[5];
      if (yCoord === undefined)
        continue;
      const y = Math.round(yCoord);
      if (!textByY.has(y)) {
        textByY.set(y, []);
      }
      textByY.get(y)?.push(textItem.str);
    }
    for (const [y, textParts] of textByY.entries()) {
      const textContent2 = textParts.join("");
      if (textContent2.trim()) {
        contentItems.push({
          type: "text",
          yPosition: y,
          textContent: textContent2
        });
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
        let yPosition = 0;
        if (argsArray.length > 1 && Array.isArray(argsArray[1])) {
          const transform = argsArray[1];
          const yCoord = transform[5];
          if (yCoord !== undefined) {
            yPosition = Math.round(yCoord);
          }
        }
        const imageData = await retrieveImageData(page, imageName, pageNum);
        const extractedImage = processImageData(imageData, pageNum, arrayIndex);
        if (extractedImage) {
          return {
            type: "image",
            yPosition,
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
        textContent: `Error processing page: ${message}`
      }
    ];
  }
  return contentItems.sort((a, b) => b.yPosition - a.yPosition);
};

// src/pdf/loader.ts
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// src/utils/errors.ts
class PdfError extends Error {
  code;
  constructor(code, message, options) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.code = code;
    this.name = "PdfError";
  }
}

// src/utils/pathUtils.ts
import path from "node:path";
var PROJECT_ROOT = process.cwd();
var resolvePath = (userPath) => {
  if (typeof userPath !== "string") {
    throw new PdfError(-32602 /* InvalidParams */, "Path must be a string.");
  }
  const normalizedUserPath = path.normalize(userPath);
  return path.isAbsolute(normalizedUserPath) ? normalizedUserPath : path.resolve(PROJECT_ROOT, normalizedUserPath);
};

// src/pdf/loader.ts
var logger3 = createLogger("Loader");
var require2 = createRequire(import.meta.url);
var CMAP_URL = require2.resolve("pdfjs-dist/package.json").replace("package.json", "cmaps/");
var MAX_PDF_SIZE = 100 * 1024 * 1024;
var loadPdfDocument = async (source, sourceDescription) => {
  let pdfDataSource;
  try {
    if (source.path) {
      const safePath = resolvePath(source.path);
      const buffer = await fs.readFile(safePath);
      if (buffer.length > MAX_PDF_SIZE) {
        throw new PdfError(-32600 /* InvalidRequest */, `PDF file exceeds maximum size of ${MAX_PDF_SIZE} bytes (${(MAX_PDF_SIZE / 1024 / 1024).toFixed(0)}MB). File size: ${buffer.length} bytes.`);
      }
      pdfDataSource = new Uint8Array(buffer);
    } else if (source.url) {
      pdfDataSource = { url: source.url };
    } else {
      throw new PdfError(-32602 /* InvalidParams */, `Source ${sourceDescription} missing 'path' or 'url'.`);
    }
  } catch (err) {
    if (err instanceof PdfError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    const errorCode = -32600 /* InvalidRequest */;
    if (typeof err === "object" && err !== null && "code" in err && err.code === "ENOENT" && source.path) {
      throw new PdfError(errorCode, `File not found at '${source.path}'.`, {
        cause: err instanceof Error ? err : undefined
      });
    }
    throw new PdfError(errorCode, `Failed to prepare PDF source ${sourceDescription}. Reason: ${message}`, { cause: err instanceof Error ? err : undefined });
  }
  const documentParams = pdfDataSource instanceof Uint8Array ? { data: pdfDataSource } : pdfDataSource;
  const loadingTask = getDocument({
    ...documentParams,
    cMapUrl: CMAP_URL,
    cMapPacked: true
  });
  try {
    return await loadingTask.promise;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger3.error("PDF.js loading error", { sourceDescription, error: message });
    throw new PdfError(-32600 /* InvalidRequest */, `Failed to load PDF document from ${sourceDescription}. Reason: ${message || "Unknown loading error"}`, { cause: err instanceof Error ? err : undefined });
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

// src/pdf/tableExtractor.ts
var logger5 = createLogger("TableExtractor");
var Y_TOLERANCE = 5;
var COLUMN_GAP_THRESHOLD = 15;
var MIN_ROWS = 2;
var MIN_COLS = 2;
var MIN_ROW_ITEMS = 2;
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
    items.push({
      text: textItem.str,
      x,
      y,
      width: textItem.width ?? textItem.str.length * 6
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
var assignToColumns = (row, columnBoundaries, tolerance = COLUMN_GAP_THRESHOLD / 2) => {
  const cells = new Array(columnBoundaries.length).fill("");
  for (const item of row.items) {
    let colIndex = 0;
    for (let i = columnBoundaries.length - 1;i >= 0; i--) {
      const boundary = columnBoundaries[i];
      if (boundary !== undefined && item.x >= boundary - tolerance) {
        colIndex = i;
        break;
      }
    }
    const current = cells[colIndex];
    cells[colIndex] = current ? `${current} ${item.text}` : item.text;
  }
  return cells;
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
      for (const row of region.rows) {
        const cells = assignToColumns(row, region.columnBoundaries);
        tableRows.push(cells);
      }
      const confidence = calculateConfidence(region.rows, region.columnBoundaries);
      if (confidence >= 0.3) {
        tables.push({
          page: pageNum,
          tableIndex,
          rows: tableRows,
          rowCount: tableRows.length,
          colCount: region.columnBoundaries.length,
          confidence: Math.round(confidence * 100) / 100
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger5.warn("Error extracting tables from page", { pageNum, error: message });
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
      logger5.warn("Error getting page for table extraction", { pageNum, error: message });
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
  include_tables: optional(bool(description("Detect and extract tables from PDF pages. Uses spatial clustering of text coordinates to identify tabular structures.")))
});

// src/handlers/readPdf.ts
var logger6 = createLogger("ReadPdf");
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
    const { pagesToProcess, invalidPages } = determinePagesToProcess(targetPages, totalPages, options.includeFullText);
    const warnings = buildWarnings(invalidPages, totalPages);
    if (warnings.length > 0) {
      output.warnings = warnings;
    }
    if (pagesToProcess.length > 0) {
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
      } else {
        output.full_text = extractedPageTexts.map((p) => p.text).join(`

`);
      }
      if (options.includeImages) {
        const extractedImages = pageContents.flatMap((items) => items.filter((item) => item.type === "image" && item.imageData)).map((item) => item.imageData).filter((img) => img !== undefined);
        if (extractedImages.length > 0) {
          output.images = extractedImages;
        }
      }
      if (options.includeTables) {
        const extractedTables = await extractTables(pdfDocument, pagesToProcess);
        if (extractedTables.length > 0) {
          output.tables = extractedTables;
        }
      }
    }
    individualResult = { ...individualResult, data: output, success: true };
  } catch (error) {
    let errorMessage = `Failed to process PDF from ${sourceDescription}.`;
    if (error instanceof Error) {
      errorMessage += ` Reason: ${error.message}`;
    } else {
      errorMessage += ` Unknown error: ${JSON.stringify(error)}`;
    }
    individualResult.error = errorMessage;
    individualResult.success = false;
    individualResult.data = undefined;
  } finally {
    if (pdfDocument && typeof pdfDocument.destroy === "function") {
      try {
        await pdfDocument.destroy();
      } catch (destroyError) {
        const message = destroyError instanceof Error ? destroyError.message : String(destroyError);
        logger6.warn("Error destroying PDF document", { sourceDescription, error: message });
      }
    }
  }
  return individualResult;
};
var readPdf = tool().description("Reads content/metadata/images from one or more PDFs (local/URL). Each source can specify pages to extract.").input(readPdfArgsSchema).handler(async ({ input }) => {
  const {
    sources,
    include_full_text,
    include_metadata,
    include_page_count,
    include_images,
    include_tables
  } = input;
  const MAX_CONCURRENT_SOURCES = 3;
  const results = [];
  const options = {
    includeFullText: include_full_text ?? false,
    includeMetadata: include_metadata ?? true,
    includePageCount: include_page_count ?? true,
    includeImages: include_images ?? false,
    includeTables: include_tables ?? false
  };
  for (let i = 0;i < sources.length; i += MAX_CONCURRENT_SOURCES) {
    const batch = sources.slice(i, i + MAX_CONCURRENT_SOURCES);
    const batchResults = await Promise.all(batch.map((source) => processSingleSource(source, options)));
    results.push(...batchResults);
  }
  const allFailed = results.every((r) => !r.success);
  if (allFailed) {
    const errorMessages = results.map((r) => r.error).join("; ");
    return toolError(`All PDF sources failed to process: ${errorMessages}`);
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
          confidence: tbl.confidence
        }));
      }
      return { ...result, data: processedData };
    }
    return result;
  });
  content.push(text(JSON.stringify({ results: resultsForJson }, null, 2)));
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
        content.push(text(`[Page ${pageContent.page}]
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
      content.push(text(markdownTables));
    }
  }
  return content;
});

// src/index.ts
var transportType = process.env["MCP_TRANSPORT"] ?? "stdio";
var httpPort = Number.parseInt(process.env["MCP_HTTP_PORT"] ?? "8080", 10);
var httpHost = process.env["MCP_HTTP_HOST"] ?? "0.0.0.0";
var apiKey = process.env["MCP_API_KEY"];
function createTransport() {
  if (transportType === "http") {
    return http({
      port: httpPort,
      hostname: httpHost,
      cors: "*"
    });
  }
  return stdio();
}
var server = createServer({
  name: "pdf-reader-mcp",
  version: "2.1.0",
  instructions: "MCP Server for reading PDF files and extracting text, metadata, images, and page information.",
  tools: { read_pdf: readPdf },
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
