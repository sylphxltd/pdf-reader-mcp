import {
  canonicalDocumentAstResult,
  DOCUMENT_AST_DEPENDENCY_SURFACES,
  type Json,
} from './v3014-document-ast-projection.ts';

export type { Json };

const AST_KEYS = ['version', 'profile', 'root', 'summary', 'warnings'] as const;
const NODE_KEYS = [
  'id', 'type', 'page_start', 'page_end', 'element_ids', 'visual_enrichment_ids', 'chunk_ids',
  'bounding_boxes', 'title', 'text', 'level', 'confidence', 'semantic_role', 'section_path',
  'continued_from_section_id', 'caption_links', 'caption_ids', 'table', 'image', 'formula', 'chart',
  'visual_enrichment', 'children',
] as const;
const LINK_KEYS = [
  'node_id', 'element_id', 'type', 'relation', 'confidence', 'signals', 'visual_enrichment_id',
] as const;
const SUMMARY_KEYS = [
  'selected_pages', 'page_count', 'node_count', 'section_count', 'paragraph_count',
  'list_item_count', 'caption_count', 'header_count', 'footer_count',
  'section_context_node_count', 'cross_page_section_context_count', 'caption_link_count',
  'table_count', 'image_count', 'figure_count', 'chart_count', 'formula_count', 'diagram_count',
  'visual_enrichment_count', 'visual_enrichment_kind_counts', 'max_depth',
] as const;
const DEPENDENCIES = [...DOCUMENT_AST_DEPENDENCY_SURFACES, 'safety_findings', 'layout_diagnostics'] as const;
const RELATIONS = new Set(['above', 'below', 'left', 'right', 'overlapping']);

const record = (value: unknown, context: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
};
const exactKeys = (value: Record<string, unknown>, allowed: readonly string[], context: string) => {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) throw new Error(`${context} has unexpected keys: ${unexpected.join(',')}`);
};
const required = (value: Record<string, unknown>, key: string, context: string): unknown => {
  if (!Object.hasOwn(value, key)) throw new Error(`${context}.${key} is required`);
  return value[key];
};
const string = (value: unknown, context: string): string => {
  if (typeof value !== 'string') throw new Error(`${context} must be a string`);
  return value;
};
const number = (value: unknown, context: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${context} must be finite`);
  return value;
};
const array = (value: unknown, context: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`);
  return value;
};
const strings = (value: unknown, context: string): string[] =>
  array(value, context).map((entry, index) => string(entry, `${context}[${String(index)}]`));
const numbers = (value: unknown, context: string): number[] =>
  array(value, context).map((entry, index) => number(entry, `${context}[${String(index)}]`));
const coordinate = (value: unknown, context: string): number =>
  Math.round(number(value, context) * 1e4) / 1e4;
const box = (value: unknown, context: string): Json => {
  const source = record(value, context);
  exactKeys(source, ['left', 'bottom', 'right', 'top'], context);
  const result = {
    left: coordinate(required(source, 'left', context), `${context}.left`),
    bottom: coordinate(required(source, 'bottom', context), `${context}.bottom`),
    right: coordinate(required(source, 'right', context), `${context}.right`),
    top: coordinate(required(source, 'top', context), `${context}.top`),
  };
  if (result.right <= result.left || result.top <= result.bottom) throw new Error(`${context} must have positive area`);
  return result;
};

const link = (value: unknown, context: string): Json => {
  const source = record(value, context);
  exactKeys(source, LINK_KEYS, context);
  const relation = string(required(source, 'relation', context), `${context}.relation`);
  if (!RELATIONS.has(relation)) throw new Error(`${context}.relation is invalid`);
  return {
    node_id: string(required(source, 'node_id', context), `${context}.node_id`),
    element_id: string(required(source, 'element_id', context), `${context}.element_id`),
    type: string(required(source, 'type', context), `${context}.type`),
    relation,
    confidence: number(required(source, 'confidence', context), `${context}.confidence`),
    signals: strings(required(source, 'signals', context), `${context}.signals`),
    ...(Object.hasOwn(source, 'visual_enrichment_id')
      ? { visual_enrichment_id: string(source.visual_enrichment_id, `${context}.visual_enrichment_id`) }
      : {}),
  };
};

type FocusNode = { id: string; type: string; page_start: number; bounding_boxes: Json[]; caption_links?: Json[]; caption_ids?: string[] };
const focusedNodes = (value: unknown, context: string, output: FocusNode[]): void => {
  const source = record(value, context);
  exactKeys(source, NODE_KEYS, context);
  const id = string(required(source, 'id', context), `${context}.id`);
  const type = string(required(source, 'type', context), `${context}.type`);
  number(required(source, 'page_start', context), `${context}.page_start`);
  number(required(source, 'page_end', context), `${context}.page_end`);
  strings(required(source, 'element_ids', context), `${context}.element_ids`);
  const boundingBoxes = Object.hasOwn(source, 'bounding_boxes')
    ? array(source.bounding_boxes, `${context}.bounding_boxes`).map((entry, index) => box(entry, `${context}.bounding_boxes[${String(index)}]`))
    : [];
  if (type === 'caption' || type === 'table') {
    output.push({
      id,
      type,
      page_start: number(source.page_start, `${context}.page_start`),
      bounding_boxes: boundingBoxes,
      ...(Object.hasOwn(source, 'caption_links')
        ? { caption_links: array(source.caption_links, `${context}.caption_links`).map((entry, index) => link(entry, `${context}.caption_links[${String(index)}]`)) }
        : {}),
      ...(Object.hasOwn(source, 'caption_ids') ? { caption_ids: strings(source.caption_ids, `${context}.caption_ids`) } : {}),
    });
  }
  if (Object.hasOwn(source, 'children')) {
    array(source.children, `${context}.children`).forEach((entry, index) =>
      focusedNodes(entry, `${context}.children[${String(index)}]`, output)
    );
  }
};

const sanitizeNode = (value: Record<string, unknown>): void => {
  for (const key of ['visual_enrichment_ids', 'confidence', 'caption_links', 'caption_ids', 'table', 'image', 'formula', 'chart', 'visual_enrichment']) delete value[key];
  if (Array.isArray(value.children)) value.children.forEach((child) => sanitizeNode(child as Record<string, unknown>));
};

export const canonicalCaptionLinkResult = (value: unknown): Json => {
  const data = record(value, 'result.data');
  const ast = record(required(data, 'document_ast', 'result.data'), 'document_ast');
  exactKeys(ast, AST_KEYS, 'document_ast');
  const summary = record(required(ast, 'summary', 'document_ast'), 'document_ast.summary');
  exactKeys(summary, SUMMARY_KEYS, 'document_ast.summary');
  const nodes: FocusNode[] = [];
  focusedNodes(required(ast, 'root', 'document_ast'), 'document_ast.root', nodes);

  // Reuse the already-admitted strict text-AST validator after removing only
  // the caption/table extension fields validated above.
  const sanitized = structuredClone(data);
  const sanitizedAst = record(sanitized.document_ast, 'sanitized.document_ast');
  sanitizeNode(record(sanitizedAst.root, 'sanitized.document_ast.root'));
  if (Array.isArray(sanitized.elements)) {
    sanitized.elements = sanitized.elements.filter(
      (entry) => record(entry, 'sanitized.element').type === 'text'
    );
  }
  canonicalDocumentAstResult(sanitized);

  const exposedElements = Object.hasOwn(data, 'elements')
    ? array(data.elements, 'result.data.elements').flatMap((entry, index) => {
        const element = record(entry, `elements[${String(index)}]`);
        const elementContext = `elements[${String(index)}]`;
        if (element.type === 'table') {
          exactKeys(element, ['id', 'type', 'page', 'table', 'bounding_box', 'confidence', 'provenance'], elementContext);
          return [{
            id: string(required(element, 'id', elementContext), `${elementContext}.id`),
            type: string(required(element, 'type', elementContext), `${elementContext}.type`),
            page: number(required(element, 'page', elementContext), `${elementContext}.page`),
            ...(Object.hasOwn(element, 'bounding_box') ? { bounding_box: box(element.bounding_box, `${elementContext}.bounding_box`) } : {}),
          }];
        }
        if (element.type !== 'text' || !Object.hasOwn(element, 'semantic_hint')) return [];
        const hint = record(element.semantic_hint, `${elementContext}.semantic_hint`);
        if (hint.role !== 'caption') return [];
        exactKeys(element, ['id', 'type', 'page', 'content', 'bounding_box', 'confidence', 'provenance', 'semantic_hint'], elementContext);
        exactKeys(hint, ['role', 'confidence', 'signals'], `${elementContext}.semantic_hint`);
        return [{
          id: string(required(element, 'id', elementContext), `${elementContext}.id`),
          type: string(required(element, 'type', elementContext), `${elementContext}.type`),
          page: number(required(element, 'page', elementContext), `${elementContext}.page`),
          content: string(required(element, 'content', elementContext), `${elementContext}.content`),
          semantic_hint: {
            role: string(required(hint, 'role', `${elementContext}.semantic_hint`), `${elementContext}.semantic_hint.role`),
            confidence: number(required(hint, 'confidence', `${elementContext}.semantic_hint`), `${elementContext}.semantic_hint.confidence`),
            signals: strings(required(hint, 'signals', `${elementContext}.semantic_hint`), `${elementContext}.semantic_hint.signals`),
          },
        }];
      })
    : [];
  return {
    dependency_surfaces: Object.fromEntries(DEPENDENCIES.map((key) => [key, Object.hasOwn(data, key)])),
    exposed_elements: exposedElements,
    focused_nodes: nodes,
    summary: {
      selected_pages: numbers(required(summary, 'selected_pages', 'document_ast.summary'), 'document_ast.summary.selected_pages'),
      caption_count: number(required(summary, 'caption_count', 'document_ast.summary'), 'document_ast.summary.caption_count'),
      caption_link_count: number(required(summary, 'caption_link_count', 'document_ast.summary'), 'document_ast.summary.caption_link_count'),
      table_count: number(required(summary, 'table_count', 'document_ast.summary'), 'document_ast.summary.table_count'),
    },
  };
};

export const CAPTION_LINK_MUTATION_MANIFEST = {
  version: 1,
  wrongPrimitiveTypes: ['caption_link.node_id', 'caption_link.confidence', 'caption_link.signals[0]', 'caption_ids[0]', 'summary.caption_link_count'],
  unexpectedFields: ['document_ast', 'node', 'caption_link', 'element'],
  requiredOmissions: ['document_ast', 'root', 'summary.caption_link_count', 'caption_link.node_id', 'caption_link.signals'],
  privateLeakage: ['page_geometry', 'document_map', 'text_layer', '_internal', 'internal'],
  dependencyPresence: [...DEPENDENCIES],
} as const;
