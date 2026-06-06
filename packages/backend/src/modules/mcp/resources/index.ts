import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { McpContext, McpDependencies } from "../mcp.context.js";
import { toMcpError } from "../mcp.errors.js";
import { getGraduationSummary } from "../../home-summary/home-summary.service.js";
import { getCoursesProgress } from "../../courses-progress/courses-progress.service.js";
import { createReminderService } from "../../reminders/reminders.service.js";

function jsonResource(uri: string, payload: unknown) {
  return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(payload, null, 2) }] };
}

export function registerResources(server: McpServer, ctx: McpContext, deps: McpDependencies): void {
  const reminderService = createReminderService(deps.reminderRepository);

  server.registerResource(
    "home-summary",
    "gradcheck://home/summary",
    { title: "Home summary", description: "Graduation summary across all dimensions", mimeType: "application/json" },
    async (uri) => {
      try {
        return jsonResource(uri.href, await getGraduationSummary(deps.homeSummaryDependencies, ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerResource(
    "reminders-today",
    "gradcheck://reminders/today",
    { title: "Today's reminders", description: "Active reminders shown on home", mimeType: "application/json" },
    async (uri) => {
      try {
        return jsonResource(uri.href, await reminderService.home(ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerResource(
    "courses-risk",
    "gradcheck://courses/risk",
    { title: "Course progress", description: "Course/credit progress and risks", mimeType: "application/json" },
    async (uri) => {
      try {
        return jsonResource(uri.href, await getCoursesProgress(deps.coursesProgressRepository, ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerResource(
    "program-progress",
    "gradcheck://program/progress",
    { title: "Program progress", description: "Bound program plan progress", mimeType: "application/json" },
    async (uri) => {
      try {
        return jsonResource(uri.href, await getCoursesProgress(deps.coursesProgressRepository, ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );
}
