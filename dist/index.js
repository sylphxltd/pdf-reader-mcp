#!/usr/bin/env node

// src/index.ts
import { createServer, stdio } from "@sylphx/mcp-server-sdk";

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
  include_images: optional(bool(description("Extract and include embedded images from the PDF pages as base64-encoded data.")))
});

// src/handlers/readPdf.ts
var logger5 = createLogger("ReadPdf");
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
      const pageContents = await Promise.all(pagesToProcess.map((pageNum) => extractPageContent(pdfDocument, pageNum, options.includeImages, sourceDescription)));
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
        logger5.warn("Error destroying PDF document", { sourceDescription, error: message });
      }
    }
  }
  return individualResult;
};
var readPdf = tool().description("Reads content/metadata/images from one or more PDFs (local/URL). Each source can specify pages to extract.").input(readPdfArgsSchema).handler(async ({ input }) => {
  const { sources, include_full_text, include_metadata, include_page_count, include_images } = input;
  const MAX_CONCURRENT_SOURCES = 3;
  const results = [];
  const options = {
    includeFullText: include_full_text ?? false,
    includeMetadata: include_metadata ?? true,
    includePageCount: include_page_count ?? true,
    includeImages: include_images ?? false
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
      const { images, page_contents, ...dataWithoutBinaryContent } = result.data;
      if (images) {
        const imageInfo = images.map((img) => ({
          page: img.page,
          index: img.index,
          width: img.width,
          height: img.height,
          format: img.format
        }));
        return { ...result, data: { ...dataWithoutBinaryContent, image_info: imageInfo } };
      }
      return { ...result, data: dataWithoutBinaryContent };
    }
    return result;
  });
  content.push(text(JSON.stringify({ results: resultsForJson }, null, 2)));
  for (const result of results) {
    if (!result.success || !result.data?.page_contents)
      continue;
    for (const pageContent of result.data.page_contents) {
      for (const item of pageContent.items) {
        if (item.type === "text" && item.textContent) {
          content.push(text(item.textContent));
        } else if (item.type === "image" && item.imageData) {
          content.push(image(item.imageData.data, "image/png"));
        }
      }
    }
  }
  return content;
});

// src/index.ts
var server = createServer({
  name: "pdf-reader-mcp",
  version: "1.3.0",
  instructions: "MCP Server for reading PDF files and extracting text, metadata, images, and page information.",
  tools: { read_pdf: readPdf },
  transport: stdio()
});
async function main() {
  await server.start();
  if (process.env["DEBUG_MCP"]) {
    console.error("[PDF Reader MCP] Server running on stdio");
    console.error("[PDF Reader MCP] Project root:", process.cwd());
  }
}
main().catch((error) => {
  console.error("[PDF Reader MCP] Server error:", error);
  process.exit(1);
});
