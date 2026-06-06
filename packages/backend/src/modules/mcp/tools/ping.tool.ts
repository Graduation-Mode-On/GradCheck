import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { McpContext } from "../mcp.context.js";
import { jsonResult } from "../mcp.helpers.js";

export function registerPingTool(server: McpServer, ctx: McpContext): void {
  server.registerTool(
    "ping",
    {
      description: "Health check. Returns ok and the authenticated userId.",
      inputSchema: {}
    },
    async () => jsonResult({ ok: true, userId: ctx.userId, ts: new Date().toISOString() })
  );
}
