import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { McpContext, McpDependencies } from "./mcp.context.js";
import { registerPingTool } from "./tools/ping.tool.js";
import { registerReminderTools } from "./tools/reminders.tools.js";
import { registerCoursesTools } from "./tools/courses.tools.js";
import { registerGpaTools } from "./tools/gpa.tools.js";
import { registerHomeTools } from "./tools/home.tools.js";
import { registerProfileTools } from "./tools/profile.tools.js";
import { registerLabExamEventTools } from "./tools/lab-exam-events.tools.js";
import { registerProgramPlanTools } from "./tools/program-plans.tools.js";
import { registerCustomRequirementTools } from "./tools/custom-requirements.tools.js";
import { registerResources } from "./resources/index.js";

export function createMcpServer(ctx: McpContext, deps: McpDependencies): McpServer {
  const server = new McpServer({ name: "gradcheck", version: "1.0.0" });
  registerPingTool(server, ctx);
  registerReminderTools(server, ctx, deps);
  registerCoursesTools(server, ctx, deps);
  registerGpaTools(server, ctx, deps);
  registerHomeTools(server, ctx, deps);
  registerProfileTools(server, ctx, deps);
  registerLabExamEventTools(server, ctx, deps);
  registerProgramPlanTools(server, ctx, deps);
  registerCustomRequirementTools(server, ctx, deps);
  registerResources(server, ctx, deps);
  return server;
}
