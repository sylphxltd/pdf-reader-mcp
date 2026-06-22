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
}

type TransportConfig = StdioTransportConfig | HttpTransportConfig;

export const stdio = (): StdioTransportConfig => ({ kind: 'stdio' });

export const http = (config: {
  port: number;
  hostname: string;
  cors?: string;
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

const startHttpServer = async (
  serverInfo: Pick<CreateServerOptions, 'name' | 'version' | 'instructions' | 'tools'>,
  transportConfig: HttpTransportConfig
): Promise<{ mcpServer: McpServer; httpServer: HttpServer }> => {
  const mcpServer = buildMcpServer(serverInfo);
  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? transportConfig.hostname}`);

    withCors(res, transportConfig.cors);

    if (url.pathname === '/mcp/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (url.pathname !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    ensureStreamableAcceptHeader(req);
    const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });

    try {
      await mcpServer.connect(transport as unknown as Parameters<McpServer['connect']>[0]);
      await transport.handleRequest(req, res);
    } finally {
      await mcpServer.close();
    }
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
      async (input, ctx) => normalizeToolResult(await definition.handler({ input, ctx }))
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
