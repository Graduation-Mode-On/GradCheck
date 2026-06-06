import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

export interface ToolRecorder {
  server: McpServer;
  call(name: string, args?: Record<string, unknown>): Promise<unknown>;
  has(name: string): boolean;
  names(): string[];
}

export function createToolRecorder(): ToolRecorder {
  const tools = new Map<string, Handler>();
  const server = {
    registerTool(name: string, _cfg: unknown, handler: Handler) {
      tools.set(name, handler);
    },
    registerResource(_name: string, _uri: unknown, _cfg: unknown, _handler: unknown) {},
    registerPrompt(_name: string, _cfg: unknown, _handler: unknown) {}
  } as unknown as McpServer;

  return {
    server,
    call: (name, args = {}) => {
      const handler = tools.get(name);
      if (!handler) throw new Error(`tool not registered: ${name}`);
      return handler(args);
    },
    has: (name) => tools.has(name),
    names: () => [...tools.keys()]
  };
}

export function textOf(result: unknown): string {
  const content = (result as { content?: Array<{ text?: string }> }).content;
  return content?.[0]?.text ?? "";
}
