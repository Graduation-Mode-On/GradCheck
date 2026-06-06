import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { McpContext, McpDependencies } from "../mcp.context.js";
import { jsonResult } from "../mcp.helpers.js";
import { mcpError, toMcpError } from "../mcp.errors.js";

export function registerProgramPlanTools(server: McpServer, ctx: McpContext, deps: McpDependencies): void {
  const repo = deps.programPlanRepository;

  server.registerTool(
    "program_plans.bound",
    { description: "Get the program plan currently bound to the user.", inputSchema: {} },
    async () => {
      try {
        return jsonResult({ plan: await repo.getBoundPlan(ctx.userId) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "program_plans.reusable",
    { description: "List reusable program plans the user can bind.", inputSchema: {} },
    async () => {
      try {
        return jsonResult({ plans: await repo.listReusablePlans(ctx.userId) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "program_plans.bind",
    { description: "Bind an existing program plan to the user by id.", inputSchema: { id: z.string().min(1) } },
    async (args) => {
      try {
        const result = await repo.bindExistingPlan(ctx.userId, args.id as string);
        if (!result) {
          throw mcpError(-32000, "Program plan was not found");
        }
        return jsonResult(result);
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );
}
