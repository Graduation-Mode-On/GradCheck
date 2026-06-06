import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { McpContext, McpDependencies } from "../mcp.context.js";
import { jsonResult } from "../mcp.helpers.js";
import { toMcpError } from "../mcp.errors.js";
import { getGpaCourseMatches, getGpaDashboard, upsertGpaCourseMatch } from "../../gpa/gpa.service.js";

export function registerGpaTools(server: McpServer, ctx: McpContext, deps: McpDependencies): void {
  const repo = deps.gpaRepository;

  server.registerTool(
    "gpa.dashboard",
    { description: "Get the GPA dashboard (courses, gpa, distribution).", inputSchema: {} },
    async () => {
      try {
        return jsonResult(await getGpaDashboard(repo, ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "gpa.list_matches",
    { description: "List GPA-course to program-plan matches.", inputSchema: {} },
    async () => {
      try {
        return jsonResult(await getGpaCourseMatches(repo, ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "gpa.fix_match",
    {
      description: "Manually fix the program-plan match for a GPA course.",
      inputSchema: {
        gpaCourseId: z.string().min(1),
        matchTargetType: z.enum(["course", "group"]),
        programPlanCourseId: z.string().min(1).optional(),
        programPlanCourseGroupId: z.string().min(1).optional()
      }
    },
    async (args) => {
      try {
        const { gpaCourseId, ...input } = args as {
          gpaCourseId: string;
          matchTargetType: "course" | "group";
          programPlanCourseId?: string;
          programPlanCourseGroupId?: string;
        };
        return jsonResult(await upsertGpaCourseMatch(repo, ctx.userId, gpaCourseId, input));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "gpa.rematch",
    { description: "Re-run automatic matching of GPA courses to the program plan.", inputSchema: {} },
    async () => {
      try {
        return jsonResult(await repo.matchCoursesToProgramPlan(ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );
}
