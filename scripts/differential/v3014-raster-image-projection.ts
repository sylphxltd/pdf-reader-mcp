import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export const RASTER_IMAGE_MUTATION_MANIFEST = {
  version: 1,
  wrongPrimitiveTypes: [
    'images[0].page',
    'images[0].format',
    'images[0].data',
    'elements[0].id',
    'chunks[0].element_ids[0]',
  ],
  unexpectedFields: ['image', 'element', 'chunk'],
  requiredOmissions: ['image-free.images', 'include-images-false.images'],
} as const;

const record = (value: unknown, context: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
};
const array = (value: unknown, context: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`);
  return value;
};
const string = (value: unknown, context: string): string => {
  if (typeof value !== 'string') throw new Error(`${context} must be a string`);
  return value;
};
const number = (value: unknown, context: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${context} must be a finite number`);
  return value;
};
const integer = (value: unknown, context: string): number => {
  const result = number(value, context);
  if (!Number.isInteger(result) || result < 0) throw new Error(`${context} must be a nonnegative integer`);
  return result;
};
const coordinate = (value: unknown, context: string): number =>
  Math.round(number(value, context) * 1_000_000) / 1_000_000;
const exactKeys = (value: Record<string, unknown>, allowed: readonly string[], context: string): void => {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) throw new Error(`${context} has unexpected keys: ${unexpected.join(',')}`);
};
const required = (value: Record<string, unknown>, key: string, context: string): unknown => {
  if (!Object.hasOwn(value, key)) throw new Error(`${context}.${key} is required`);
  return value[key];
};
const strings = (value: unknown, context: string): string[] =>
  array(value, context).map((entry, index) => string(entry, `${context}[${String(index)}]`));
const integers = (value: unknown, context: string): number[] =>
  array(value, context).map((entry, index) => integer(entry, `${context}[${String(index)}]`));
const sha256 = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');

const BOX_KEYS = ['left', 'top', 'right', 'bottom'] as const;
const box = (value: unknown, context: string): Json => {
  const raw = record(value, context);
  exactKeys(raw, BOX_KEYS, context);
  return Object.fromEntries(
    BOX_KEYS.map((key) => [key, coordinate(required(raw, key, context), `${context}.${key}`)])
  );
};

const semanticHint = (value: unknown, context: string): Json => {
  const raw = record(value, context);
  exactKeys(raw, ['role', 'confidence', 'signals', 'level'], context);
  const result: Record<string, Json> = {
    role: string(required(raw, 'role', context), `${context}.role`),
    confidence: number(required(raw, 'confidence', context), `${context}.confidence`),
    signals: strings(required(raw, 'signals', context), `${context}.signals`),
  };
  if (Object.hasOwn(raw, 'level')) result.level = integer(raw.level, `${context}.level`);
  return result;
};

const image = (value: unknown, context: string, withPixels: boolean): Json => {
  const raw = record(value, context);
  const allowed = ['page', 'index', 'width', 'height', 'format', 'data', 'bounding_box'] as const;
  exactKeys(raw, allowed, context);
  const width = integer(required(raw, 'width', context), `${context}.width`);
  const height = integer(required(raw, 'height', context), `${context}.height`);
  const result: Record<string, Json> = {
    page: integer(required(raw, 'page', context), `${context}.page`),
    index: integer(required(raw, 'index', context), `${context}.index`),
    width,
    height,
    format: string(required(raw, 'format', context), `${context}.format`),
  };
  if (raw.bounding_box !== undefined) result.bounding_box = box(raw.bounding_box, `${context}.bounding_box`);
  if (withPixels) {
    const encoded = string(required(raw, 'data', context), `${context}.data`);
    const decoded = PNG.sync.read(Buffer.from(encoded, 'base64'));
    if (decoded.width !== width || decoded.height !== height) throw new Error(`${context} decoded dimensions differ from metadata`);
    if (decoded.width * decoded.height > 4) throw new Error(`${context} exceeds four-pixel corpus envelope`);
    result.decoded = {
      width: decoded.width,
      height: decoded.height,
      rgba_sha256: sha256(decoded.data),
      rgba: [...decoded.data],
    };
  } else if (raw.data !== undefined) {
    throw new Error(`${context} public image metadata leaked binary data`);
  }
  return result;
};

const element = (value: unknown, context: string): Json => {
  const raw = record(value, context);
  const type = string(required(raw, 'type', context), `${context}.type`);
  const common: Record<string, Json> = {
    id: string(required(raw, 'id', context), `${context}.id`),
    type,
    page: integer(required(raw, 'page', context), `${context}.page`),
  };
  if (raw.bounding_box !== undefined) common.bounding_box = box(raw.bounding_box, `${context}.bounding_box`);
  const provenance = record(required(raw, 'provenance', context), `${context}.provenance`);
  const provenanceSource = string(required(provenance, 'source', `${context}.provenance`), `${context}.provenance.source`);
  common.provenance = {
    source: provenanceSource === 'text-content' ? 'selectable-text' : provenanceSource,
  };
  if (type === 'image') {
    exactKeys(raw, ['id', 'type', 'page', 'bounding_box', 'confidence', 'provenance', 'image'], context);
    common.image = image(required(raw, 'image', context), `${context}.image`, false);
  } else if (type === 'text') {
    exactKeys(raw, ['id', 'type', 'page', 'bounding_box', 'confidence', 'provenance', 'content', 'semantic_hint'], context);
    common.content = string(required(raw, 'content', context), `${context}.content`);
    if (raw.semantic_hint !== undefined) {
      common.semantic_hint = semanticHint(raw.semantic_hint, `${context}.semantic_hint`);
    }
  } else {
    throw new Error(`${context} unsupported element type in raster corpus: ${type}`);
  }
  return common;
};

const chunk = (value: unknown, context: string): Json => {
  const raw = record(value, context);
  exactKeys(raw, ['id', 'page_start', 'page_end', 'text', 'element_ids', 'strategy', 'heading', 'bounding_boxes'], context);
  const result: Record<string, Json> = {
    id: string(required(raw, 'id', context), `${context}.id`),
    page_start: integer(required(raw, 'page_start', context), `${context}.page_start`),
    page_end: integer(required(raw, 'page_end', context), `${context}.page_end`),
    text: string(required(raw, 'text', context), `${context}.text`),
    element_ids: strings(required(raw, 'element_ids', context), `${context}.element_ids`),
  };
  if (Object.hasOwn(raw, 'strategy')) result.strategy = string(raw.strategy, `${context}.strategy`);
  if (Object.hasOwn(raw, 'bounding_boxes')) result.bounding_boxes = array(raw.bounding_boxes, `${context}.bounding_boxes`).map((entry, index) => box(entry, `${context}.bounding_boxes[${String(index)}]`));
  return result;
};

const astImageNodes = (rootValue: unknown): Json[] => {
  const found: Json[] = [];
  const visit = (value: unknown, context: string): void => {
    const raw = record(value, context);
    if (raw.type === 'image') {
      const imageRaw = record(required(raw, 'image', context), `${context}.image`);
      found.push({
        id: string(required(raw, 'id', context), `${context}.id`),
        page_start: integer(required(raw, 'page_start', context), `${context}.page_start`),
        page_end: integer(required(raw, 'page_end', context), `${context}.page_end`),
        element_ids: strings(required(raw, 'element_ids', context), `${context}.element_ids`),
        chunk_ids: Object.hasOwn(raw, 'chunk_ids') ? strings(raw.chunk_ids, `${context}.chunk_ids`) : [],
        image: {
          index: integer(required(imageRaw, 'index', `${context}.image`), `${context}.image.index`),
          width: integer(required(imageRaw, 'width', `${context}.image`), `${context}.image.width`),
          height: integer(required(imageRaw, 'height', `${context}.image`), `${context}.image.height`),
          format: string(required(imageRaw, 'format', `${context}.image`), `${context}.image.format`),
        },
      });
    }
    if (Object.hasOwn(raw, 'children')) {
      for (const [index, child] of array(raw.children, `${context}.children`).entries()) visit(child, `${context}.children[${String(index)}]`);
    }
  };
  visit(rootValue, 'document_ast.root');
  return found;
};

export const canonicalRasterImageResult = (value: unknown): Json => {
  const outer = record(value, 'raster result');
  let data = outer;
  let publicTextParts: string[] | undefined;
  if (Object.hasOwn(outer, 'content')) {
    const content = array(required(outer, 'content', 'raster tool result'), 'raster tool result.content').map((entry, index) => record(entry, `raster tool result.content[${String(index)}]`));
    const first = content[0];
    if (!first || first.type !== 'text') throw new Error('raster tool result must start with structured JSON text');
    const payload = record(JSON.parse(string(required(first, 'text', 'raster tool result.content[0]'), 'raster tool result.content[0].text')), 'raster JSON payload');
    const source = record(array(required(payload, 'results', 'raster JSON payload'), 'raster JSON payload.results')[0], 'raster JSON source result');
    if (required(source, 'success', 'raster JSON source result') !== true) throw new Error('raster JSON source result must succeed');
    data = record(required(source, 'data', 'raster JSON source result'), 'raster JSON source data');
    const imageInfo = Object.hasOwn(data, 'image_info') ? array(data.image_info, 'image_info') : [];
    const imageBlocks = content.slice(1).filter((entry) => entry.type === 'image');
    if (imageInfo.length !== imageBlocks.length) throw new Error(`raster public image_info/content count mismatch: ${String(imageInfo.length)} != ${String(imageBlocks.length)}`);
    if (imageInfo.length > 0) {
      data = {
        ...data,
        images: imageInfo.map((entry, index) => ({
          ...record(entry, `image_info[${String(index)}]`),
          data: string(required(imageBlocks[index]!, 'data', `image content[${String(index)}]`), `image content[${String(index)}].data`),
        })),
      };
    }
    publicTextParts = content.slice(1).filter((entry) => entry.type === 'text').map((entry, index) => string(required(entry, 'text', `public text part[${String(index)}]`), `public text part[${String(index)}].text`));
  }
  const result: Record<string, Json> = {
    num_pages: integer(required(data, 'num_pages', 'raster result'), 'raster result.num_pages'),
  };
  if (publicTextParts && publicTextParts.length > 0) result.text_parts = publicTextParts;
  if (Object.hasOwn(data, 'warnings')) result.warnings = strings(data.warnings, 'raster result.warnings');
  if (Object.hasOwn(data, 'images')) result.images = array(data.images, 'raster result.images').map((entry, index) => image(entry, `raster result.images[${String(index)}]`, true));
  if (Object.hasOwn(data, 'page_texts')) result.page_texts = array(data.page_texts, 'raster result.page_texts').map((entry, index) => {
    const raw = record(entry, `page_texts[${String(index)}]`);
    return { page: integer(required(raw, 'page', 'page_text'), 'page_text.page'), text: string(required(raw, 'text', 'page_text'), 'page_text.text') };
  });
  if (Object.hasOwn(data, 'elements')) result.elements = array(data.elements, 'elements').map((entry, index) => element(entry, `elements[${String(index)}]`));
  if (Object.hasOwn(data, 'chunks')) result.chunks = array(data.chunks, 'chunks').map((entry, index) => chunk(entry, `chunks[${String(index)}]`));
  if (Object.hasOwn(data, 'markdown')) result.markdown = string(data.markdown, 'markdown');
  if (Object.hasOwn(data, 'html')) result.html = string(data.html, 'html');
  if (Object.hasOwn(data, 'document_ast')) {
    const ast = record(data.document_ast, 'document_ast');
    const summary = record(required(ast, 'summary', 'document_ast'), 'document_ast.summary');
    result.document_ast = {
      image_count: integer(required(summary, 'image_count', 'document_ast.summary'), 'document_ast.summary.image_count'),
      image_nodes: astImageNodes(required(ast, 'root', 'document_ast')),
      warnings: Object.hasOwn(ast, 'warnings') ? strings(ast.warnings, 'document_ast.warnings') : [],
    };
  }
  if (Object.hasOwn(data, 'document_map')) {
    const map = record(data.document_map, 'document_map');
    const summary = record(required(map, 'summary', 'document_map'), 'document_map.summary');
    result.document_map = {
      layers: strings(required(map, 'layers', 'document_map'), 'document_map.layers'),
      pages: array(required(map, 'pages', 'document_map'), 'document_map.pages').map((entry, index) => {
        const page = record(entry, `document_map.pages[${String(index)}]`);
        return {
          page: integer(required(page, 'page', 'document_map page'), 'document_map page.page'),
          element_ids: strings(required(page, 'element_ids', 'document_map page'), 'document_map page.element_ids'),
          chunk_ids: strings(required(page, 'chunk_ids', 'document_map page'), 'document_map page.chunk_ids'),
          image_count: integer(required(page, 'image_count', 'document_map page'), 'document_map page.image_count'),
        };
      }),
      image_element_count: integer(required(summary, 'image_element_count', 'document_map.summary'), 'document_map.summary.image_element_count'),
      element_count: integer(required(summary, 'element_count', 'document_map.summary'), 'document_map.summary.element_count'),
      chunk_count: integer(required(summary, 'chunk_count', 'document_map.summary'), 'document_map.summary.chunk_count'),
    };
  }
  return result;
};
