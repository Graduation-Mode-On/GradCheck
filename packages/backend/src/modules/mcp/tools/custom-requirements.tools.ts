import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { McpContext, McpDependencies } from "../mcp.context.js";
import { jsonResult } from "../mcp.helpers.js";
import { mcpError, toMcpError } from "../mcp.errors.js";
import {
  createCustomRequirementSchema,
  updateCustomRequirementSchema
} from "../../custom-requirements/custom-requirement.schemas.js";

const idShape = { id: z.string().uuid() };

export function registerCustomRequirementTools(server: McpServer, ctx: McpContext, deps: McpDependencies): void {
  const repo = deps.customRequirementRepository;

  server.registerTool(
    "custom_requirements.list",
    { description: "List the user's custom graduation requirements.", inputSchema: {} },
    async () => {
      try {
        return jsonResult({ customRequirements: await repo.listByUserId(ctx.userId) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "custom_requirements.create",
    { description: "Create a custom graduation requirement.", inputSchema: createCustomRequirementSchema.shape },
    async (args) => {
      try {
        return jsonResult({ customRequirement: await repo.create(ctx.userId, args as never) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "custom_requirements.update",
    {
      description: "Update a custom graduation requirement.",
      inputSchema: { ...idShape, ...updateCustomRequirementSchema.shape }
    },
    async (args) => {
      try {
        const { id, ...input } = args as { id: string } & Record<string, unknown>;
        const updated = await repo.update(ctx.userId, id, input as never);
        if (!updated) {
          throw mcpError(-32000, "Custom requirement not found");
        }
        return jsonResult({ customRequirement: updated });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "custom_requirements.delete",
    { description: "Delete a custom graduation requirement.", inputSchema: idShape },
    async (args) => {
      try {
        const deleted = await repo.delete(ctx.userId, args.id as string);
        if (!deleted) {
          throw mcpError(-32000, "Custom requirement not found");
        }
        return jsonResult({ ok: true });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );
}
