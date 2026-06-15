import type {
  BoundingBox,
  PdfChunk,
  PdfDocumentAst,
  PdfDocumentAstNode,
  PdfDocumentAstNodeType,
  PdfDocumentElement,
} from '../types/pdf.js';

const DOCUMENT_AST_VERSION = '2026-06-15' as const;

interface BuildDocumentAstInput {
  selectedPages: number[];
  elements: PdfDocumentElement[];
  chunks: PdfChunk[];
  warnings?: string[] | undefined;
}

interface AstStats {
  nodeCount: number;
  sectionCount: number;
  paragraphCount: number;
  listItemCount: number;
  tableCount: number;
  imageCount: number;
  maxDepth: number;
}

const unique = <TValue>(values: TValue[]): TValue[] => [...new Set(values)];

const pageRangeForElements = (elements: PdfDocumentElement[]): { start: number; end: number } => {
  if (elements.length === 0) return { start: 0, end: 0 };
  const pages = elements.map((element) => element.page);
  return {
    start: Math.min(...pages),
    end: Math.max(...pages),
  };
};

const chunksByElementId = (chunks: PdfChunk[]): Map<string, string[]> => {
  const index = new Map<string, string[]>();

  for (const chunk of chunks) {
    for (const elementId of chunk.element_ids) {
      const ids = index.get(elementId) ?? [];
      ids.push(chunk.id);
      index.set(elementId, ids);
    }
  }

  return index;
};

const nodeForElement = (
  element: PdfDocumentElement,
  chunkIndex: Map<string, string[]>
): PdfDocumentAstNode => {
  const base = {
    page_start: element.page,
    page_end: element.page,
    element_ids: [element.id],
    ...(chunkIndex.get(element.id) ? { chunk_ids: chunkIndex.get(element.id) } : {}),
    ...(element.bounding_box ? { bounding_boxes: [element.bounding_box] } : {}),
    ...(element.confidence !== undefined ? { confidence: element.confidence } : {}),
  };

  if (element.type === 'text') {
    const role = element.semantic_hint?.role ?? 'paragraph';
    const type: PdfDocumentAstNodeType =
      role === 'heading' ? 'section' : role === 'list_item' ? 'list_item' : 'paragraph';

    return {
      ...base,
      id: type === 'section' ? `${element.id}-section` : element.id,
      type,
      text: element.content,
      ...(type === 'section'
        ? { title: element.content, level: element.semantic_hint?.level ?? 1 }
        : {}),
      semantic_role: role,
      ...(type === 'section' ? { children: [] } : {}),
    };
  }

  if (element.type === 'table') {
    return {
      ...base,
      id: element.id,
      type: 'table',
      text: element.table.rows.map((row) => row.join(' | ')).join('\n'),
      table: {
        rows: element.table.rows,
        rowCount: element.table.rowCount,
        colCount: element.table.colCount,
        confidence: element.table.confidence,
        ...(element.table.quality ? { quality: element.table.quality } : {}),
        ...(element.table.continuation ? { continuation: element.table.continuation } : {}),
      },
    };
  }

  return {
    ...base,
    id: element.id,
    type: 'image',
    image: {
      index: element.image.index,
      width: element.image.width,
      height: element.image.height,
      format: element.image.format,
    },
  };
};

const appendToPageTree = (
  pageNode: PdfDocumentAstNode,
  sectionStack: PdfDocumentAstNode[],
  node: PdfDocumentAstNode
) => {
  if (node.type === 'section') {
    const level = node.level ?? 1;
    while (sectionStack.length > 0) {
      const parent = sectionStack[sectionStack.length - 1];
      if (parent && (parent.level ?? 1) < level) break;
      sectionStack.pop();
    }

    const parent = sectionStack[sectionStack.length - 1] ?? pageNode;
    parent.children ??= [];
    parent.children.push(node);
    sectionStack.push(node);
    return;
  }

  const parent = sectionStack[sectionStack.length - 1] ?? pageNode;
  parent.children ??= [];
  parent.children.push(node);
};

const aggregateNode = (node: PdfDocumentAstNode, depth: number): AstStats => {
  const children = node.children ?? [];
  const childStats = children.map((child) => aggregateNode(child, depth + 1));

  const childElementIds = children.flatMap((child) => child.element_ids);
  node.element_ids = unique([...node.element_ids, ...childElementIds]);

  const childChunkIds = children.flatMap((child) => child.chunk_ids ?? []);
  const chunkIds = unique([...(node.chunk_ids ?? []), ...childChunkIds]);
  if (chunkIds.length > 0) {
    node.chunk_ids = chunkIds;
  }

  const childBoxes = children.flatMap((child) => child.bounding_boxes ?? []);
  const boxes = uniqueBoundingBoxes([...(node.bounding_boxes ?? []), ...childBoxes]);
  if (boxes.length > 0) {
    node.bounding_boxes = boxes;
  }

  if (children.length > 0) {
    node.page_start = Math.min(node.page_start, ...children.map((child) => child.page_start));
    node.page_end = Math.max(node.page_end, ...children.map((child) => child.page_end));
  }

  return childStats.reduce<AstStats>(
    (stats, child) => ({
      nodeCount: stats.nodeCount + child.nodeCount,
      sectionCount: stats.sectionCount + child.sectionCount,
      paragraphCount: stats.paragraphCount + child.paragraphCount,
      listItemCount: stats.listItemCount + child.listItemCount,
      tableCount: stats.tableCount + child.tableCount,
      imageCount: stats.imageCount + child.imageCount,
      maxDepth: Math.max(stats.maxDepth, child.maxDepth),
    }),
    {
      nodeCount: 1,
      sectionCount: node.type === 'section' ? 1 : 0,
      paragraphCount: node.type === 'paragraph' ? 1 : 0,
      listItemCount: node.type === 'list_item' ? 1 : 0,
      tableCount: node.type === 'table' ? 1 : 0,
      imageCount: node.type === 'image' ? 1 : 0,
      maxDepth: depth,
    }
  );
};

const uniqueBoundingBoxes = (boxes: BoundingBox[]): BoundingBox[] => {
  const seen = new Set<string>();
  const uniqueBoxes: BoundingBox[] = [];

  for (const box of boxes) {
    const key = `${box.left}:${box.bottom}:${box.right}:${box.top}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueBoxes.push(box);
  }

  return uniqueBoxes;
};

export const buildDocumentAst = (input: BuildDocumentAstInput): PdfDocumentAst => {
  const selectedPages = [...new Set(input.selectedPages)].sort((a, b) => a - b);
  const range = pageRangeForElements(input.elements);
  const chunkIndex = chunksByElementId(input.chunks);

  const root: PdfDocumentAstNode = {
    id: 'document',
    type: 'document',
    page_start: range.start,
    page_end: range.end,
    element_ids: [],
    children: [],
  };

  const elementsByPage = new Map<number, PdfDocumentElement[]>();
  for (const element of input.elements) {
    const pageElements = elementsByPage.get(element.page) ?? [];
    pageElements.push(element);
    elementsByPage.set(element.page, pageElements);
  }

  for (const page of selectedPages) {
    const pageElements = elementsByPage.get(page) ?? [];
    const pageNode: PdfDocumentAstNode = {
      id: `p${page}`,
      type: 'page',
      page_start: page,
      page_end: page,
      element_ids: [],
      children: [],
    };
    const sectionStack: PdfDocumentAstNode[] = [];

    for (const element of pageElements) {
      appendToPageTree(pageNode, sectionStack, nodeForElement(element, chunkIndex));
    }

    root.children?.push(pageNode);
  }

  const stats = aggregateNode(root, 1);
  const warnings = [...(input.warnings ?? [])];
  if (
    !input.elements.some(
      (element) => element.type === 'text' && element.semantic_hint?.role === 'heading'
    )
  ) {
    warnings.push('No heading hierarchy detected; document_ast uses page-level leaf nodes.');
  }

  return {
    version: DOCUMENT_AST_VERSION,
    profile: 'document_ast',
    root,
    summary: {
      selected_pages: selectedPages,
      page_count: selectedPages.length,
      node_count: stats.nodeCount,
      section_count: stats.sectionCount,
      paragraph_count: stats.paragraphCount,
      list_item_count: stats.listItemCount,
      table_count: stats.tableCount,
      image_count: stats.imageCount,
      max_depth: stats.maxDepth,
    },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};
