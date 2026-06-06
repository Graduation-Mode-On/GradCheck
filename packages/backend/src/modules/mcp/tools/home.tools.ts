import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { McpContext, McpDependencies } from "../mcp.context.js";
import { jsonResult } from "../mcp.helpers.js";
import { toMcpError } from "../mcp.errors.js";
import { getGraduationSummary } from "../../home-summary/home-summary.service.js";

export function registerHomeTools(server: McpServer, ctx: McpContext, deps: McpDependencies): void {
  server.registerTool(
    "home.summary",
    { description: "Get the home graduation summary across all dimensions.", inputSchema: {} },
    async () => {
      try {
        return jsonResult(await getGraduationSummary(deps.homeSummaryDependencies, ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );
}
