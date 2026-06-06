import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { McpContext, McpDependencies } from "./mcp.context.js";
import { registerPingTool } from "./tools/ping.tool.js";

export function createMcpServer(ctx: McpContext, _deps: McpDependencies): McpServer {
  const server = new McpServer({ name: "gradcheck", version: "1.0.0" });
  registerPingTool(server, ctx);
  return server;
}
