import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { McpContext, McpDependencies } from "../mcp.context.js";
import { jsonResult } from "../mcp.helpers.js";
import { toMcpError } from "../mcp.errors.js";
import { getCoursesProgress } from "../../courses-progress/courses-progress.service.js";

export function registerCoursesTools(server: McpServer, ctx: McpContext, deps: McpDependencies): void {
  const repo = deps.coursesProgressRepository;

  server.registerTool(
    "courses.progress",
    { description: "Get course/credit progress against the bound program plan.", inputSchema: {} },
    async () => {
      try {
        return jsonResult(await getCoursesProgress(repo, ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "courses.ignore_group",
    {
      description: "Ignore a requirement group, then return updated progress.",
      inputSchema: { groupId: z.string().min(1) }
    },
    async (args) => {
      try {
        await repo.ignoreGroup(ctx.userId, args.groupId as string);
        return jsonResult(await getCoursesProgress(repo, ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "courses.unignore_group",
    {
      description: "Un-ignore a requirement group, then return updated progress.",
      inputSchema: { groupId: z.string().min(1) }
    },
    async (args) => {
      try {
        await repo.unignoreGroup(ctx.userId, args.groupId as string);
        return jsonResult(await getCoursesProgress(repo, ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );
}
