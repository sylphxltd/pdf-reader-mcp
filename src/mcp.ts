import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type {
  CallToolResult,
  ContentBlock,
  ImageContent,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export const text = (value: string): TextContent => ({ type: 'text', text: value });

export const image = (data: string, mimeType: string): ImageContent => ({
  type: 'image',
  data,
  mimeType,
});

export const toolError = (message: string): CallToolResult => ({
  content: [text(message)],
  isError: true,
});

export type ToolHandlerResult = CallToolResult | ContentBlock | readonly ContentBlock[];

export type ToolHandler<TInput> = (args: {
  input: TInput;
  ctx: unknown;
}) => ToolHandlerResult | Promise<ToolHandlerResult>;

export interface ToolDefinition<TInput = unknown> {
  description: string;
  inputSchema: z.ZodType<TInput>;
  handler(args: { input: TInput; ctx: unknown }): ToolHandlerResult | Promise<ToolHandlerResult>;
}

class ToolBuilder<TInput = unknown> {
  readonly #description: string | undefined;
  readonly #inputSchema: z.ZodType<TInput> | undefined;

  constructor(descriptionValue?: string, inputSchema?: z.ZodType<TInput>) {
    this.#description = descriptionValue;
    this.#inputSchema = inputSchema;
  }

  description(value: string): ToolBuilder<TInput> {
    return new ToolBuilder(value, this.#inputSchema);
  }

  input<TSchema extends z.ZodType>(schema: TSchema): ToolBuilder<z.infer<TSchema>> {
    return new ToolBuilder(this.#description, schema as z.ZodType<z.infer<TSchema>>);
  }

  handler(handler: ToolHandler<TInput>): ToolDefinition<TInput> {
    return {
      description: this.#description ?? '',
      inputSchema: this.#inputSchema ?? (z.object({}) as z.ZodType<TInput>),
      handler,
    };
  }
}

export const tool = (): ToolBuilder => new ToolBuilder();

interface StdioTransportConfig {
  kind: 'stdio';
}

interface HttpTransportConfig {
  kind: 'http';
  port: number;
  hostname: string;
  cors?: string;
  /**
   * When set, every `/mcp` request must present a matching `X-API-Key` header.
   * When undefined, the endpoint is unauthenticated (the historical behavior).
   */
  apiKey?: string;
}

type TransportConfig = StdioTransportConfig | HttpTransportConfig;

export const stdio = (): StdioTransportConfig => ({ kind: 'stdio' });

export const http = (config: {
  port: number;
  hostname: string;
  cors?: string;
  apiKey?: string;
}): HttpTransportConfig => ({ kind: 'http', ...config });

interface CreateServerOptions {
  name: string;
  version: string;
  instructions?: string;
  tools: Record<string, ToolDefinition<unknown>>;
  transport: TransportConfig;
}

interface ServerHandle {
  start(): Promise<void>;
  close(): Promise<void>;
}

const isCallToolResult = (result: ToolHandlerResult): result is CallToolResult =>
  typeof result === 'object' && result !== null && 'content' in result;

const isContentArray = (result: ToolHandlerResult): result is readonly ContentBlock[] =>
  Array.isArray(result);

const normalizeToolResult = (result: ToolHandlerResult): CallToolResult => {
  if (isContentArray(result)) return { content: [...result] };
  if (isCallToolResult(result)) return result;
  return { content: [result] };
};

const withCors = (res: import('node:http').ServerResponse, origin: string | undefined) => {
  if (!origin) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, X-API-Key'
  );
};

/**
 * Constant-time check of a presented `X-API-Key` header against the configured
 * key. Both sides are SHA-256 hashed before comparison so the comparison is
 * length-independent and does not leak the key (or its length) through response
 * timing. Returns true only when a non-empty header exactly matches the key.
 */
const isApiKeyValid = (
  configuredKey: string,
  presented: string | string[] | undefined
): boolean => {
  const provided = Array.isArray(presented) ? presented[0] : presented;
  if (typeof provided !== 'string' || provided.length === 0) return false;
  const expected = createHash('sha256').update(configuredKey).digest();
  const actual = createHash('sha256').update(provided).digest();
  return timingSafeEqual(expected, actual);
};

const unauthorized = (res: import('node:http').ServerResponse) => {
  res.writeHead(401, { 'Content-Type': 'application/json', 'WWW-Authenticate': 'X-API-Key' });
  res.end(
    JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32001, message: 'Unauthorized: missing or invalid X-API-Key header' },
    })
  );
};

const ensureStreamableAcceptHeader = (req: import('node:http').IncomingMessage) => {
  const accept = req.headers.accept;
  const acceptValues = Array.isArray(accept) ? accept.join(', ') : (accept ?? '');
  if (acceptValues.includes('application/json') && acceptValues.includes('text/event-stream')) {
    return;
  }
  req.headers.accept = 'application/json, text/event-stream';

  const rawAcceptIndex = req.rawHeaders.findIndex(
    (value, index) => index % 2 === 0 && value.toLowerCase() === 'accept'
  );
  if (rawAcceptIndex >= 0) {
    req.rawHeaders[rawAcceptIndex + 1] = 'application/json, text/event-stream';
    return;
  }
  req.rawHeaders.push('Accept', 'application/json, text/event-stream');
};

/**
 * Resolve a request against the non-MCP routes (health, unknown paths, CORS
 * preflight) and the API-key gate. Returns true when the request was fully
 * handled here and the MCP pipeline should be skipped.
 */
const handleNonMcpRoute = (
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  pathname: string,
  transportConfig: HttpTransportConfig
): boolean => {
  if (pathname === '/mcp/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return true;
  }

  if (pathname !== '/mcp') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return true;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  // Authenticate every data-bearing /mcp request when a key is configured.
  // Health and CORS-preflight (above) stay open: the former carries no PDF
  // data, the latter no credentials.
  if (
    transportConfig.apiKey !== undefined &&
    !isApiKeyValid(transportConfig.apiKey, req.headers['x-api-key'])
  ) {
    unauthorized(res);
    return true;
  }

  return false;
};

const handleHttpRequest = async (
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  mcpServer: McpServer,
  transportConfig: HttpTransportConfig
): Promise<void> => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? transportConfig.hostname}`);

  withCors(res, transportConfig.cors);

  if (handleNonMcpRoute(req, res, url.pathname, transportConfig)) return;

  ensureStreamableAcceptHeader(req);
  const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });

  try {
    await mcpServer.connect(transport as unknown as Parameters<McpServer['connect']>[0]);
    await transport.handleRequest(req, res);
  } finally {
    await mcpServer.close();
  }
};

const startHttpServer = async (
  serverInfo: Pick<CreateServerOptions, 'name' | 'version' | 'instructions' | 'tools'>,
  transportConfig: HttpTransportConfig
): Promise<{ mcpServer: McpServer; httpServer: HttpServer }> => {
  const mcpServer = buildMcpServer(serverInfo);
  const httpServer = createHttpServer((req, res) => {
    void handleHttpRequest(req, res, mcpServer, transportConfig);
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(transportConfig.port, transportConfig.hostname, () => {
      httpServer.off('error', reject);
      resolve();
    });
  });

  return { mcpServer, httpServer };
};

const buildMcpServer = ({
  name,
  version,
  instructions,
  tools,
}: Pick<CreateServerOptions, 'name' | 'version' | 'instructions' | 'tools'>): McpServer => {
  const mcpServer = new McpServer(
    { name, version },
    {
      ...(instructions ? { instructions } : {}),
    }
  );

  for (const [name, definition] of Object.entries(tools)) {
    mcpServer.registerTool(
      name,
      {
        description: definition.description,
        inputSchema: definition.inputSchema,
      },
      async (input, ctx) => {
        // MCP SDK may project Zod schemas to JSON Schema for the wire, which can
        // drop refinements (e.g. exclusive path/url). Re-validate with the full
        // Zod schema before executing any tool handler — fail closed.
        const parsed = definition.inputSchema.safeParse(input);
        if (!parsed.success) {
          const message = parsed.error.issues
            .map((issue) => {
              const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
              return `${path}: ${issue.message}`;
            })
            .join('; ');
          return toolError(`Invalid arguments for ${name}: ${message}`);
        }
        return normalizeToolResult(await definition.handler({ input: parsed.data as never, ctx }));
      }
    );
  }

  return mcpServer;
};

export const createServer = (options: CreateServerOptions): ServerHandle => {
  let mcpServer: McpServer | undefined;
  let httpServer: HttpServer | undefined;

  return {
    async start() {
      if (options.transport.kind === 'stdio') {
        mcpServer = buildMcpServer(options);
        await mcpServer.connect(new StdioServerTransport());
        return;
      }

      const started = await startHttpServer(options, options.transport);
      mcpServer = started.mcpServer;
      httpServer = started.httpServer;
    },
    async close() {
      await mcpServer?.close();
      const serverToClose = httpServer;
      if (!serverToClose) return;
      await new Promise<void>((resolve, reject) => {
        serverToClose.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
};
