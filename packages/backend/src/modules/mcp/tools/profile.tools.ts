import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { McpContext, McpDependencies } from "../mcp.context.js";
import { jsonResult } from "../mcp.helpers.js";
import { toMcpError } from "../mcp.errors.js";
import { profileSchema } from "../../auth/auth.schemas.js";

export function registerProfileTools(server: McpServer, ctx: McpContext, deps: McpDependencies): void {
  server.registerTool(
    "profile.get",
    { description: "Get the current user's profile.", inputSchema: {} },
    async () => {
      try {
        return jsonResult({ profile: await deps.authRepository.getProfile(ctx.userId) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "profile.update",
    { description: "Create or update the current user's profile.", inputSchema: profileSchema.shape },
    async (args) => {
      try {
        return jsonResult({ profile: await deps.authRepository.upsertProfile(ctx.userId, args as never) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );
}
