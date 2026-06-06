import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { McpContext, McpDependencies } from "../mcp.context.js";
import { jsonResult } from "../mcp.helpers.js";
import { toMcpError } from "../mcp.errors.js";
import { createReminderService } from "../../reminders/reminders.service.js";
import {
  completeReminderSchema,
  createReminderSchema,
  listReminderQuerySchema,
  snoozeReminderSchema,
  updateReminderSchema
} from "../../reminders/reminders.schemas.js";

const idShape = { id: z.string().uuid() };

export function registerReminderTools(server: McpServer, ctx: McpContext, deps: McpDependencies): void {
  const service = createReminderService(deps.reminderRepository);

  server.registerTool(
    "reminders.list",
    { description: "List reminders with optional filters.", inputSchema: listReminderQuerySchema.shape },
    async (args) => {
      try {
        return jsonResult({ reminders: await service.list(ctx.userId, args as never) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "reminders.get",
    { description: "Get a single reminder by id.", inputSchema: idShape },
    async (args) => {
      try {
        const reminder = await deps.reminderRepository.findById(ctx.userId, args.id as string);
        return jsonResult({ reminder });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "reminders.create",
    { description: "Create a custom reminder.", inputSchema: createReminderSchema.shape },
    async (args) => {
      try {
        return jsonResult({ reminder: await service.createCustom(ctx.userId, args as never) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "reminders.update",
    { description: "Update a reminder.", inputSchema: { ...idShape, ...updateReminderSchema.shape } },
    async (args) => {
      try {
        const { id, ...input } = args as { id: string } & Record<string, unknown>;
        return jsonResult({ reminder: await service.update(ctx.userId, id, input as never) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "reminders.complete",
    { description: "Mark a reminder complete or not.", inputSchema: { ...idShape, ...completeReminderSchema.shape } },
    async (args) => {
      try {
        const { id, completed } = args as { id: string; completed: boolean };
        return jsonResult({ reminder: await service.setCompleted(ctx.userId, id, completed) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "reminders.snooze",
    { description: "Snooze a reminder until a time.", inputSchema: { ...idShape, ...snoozeReminderSchema.shape } },
    async (args) => {
      try {
        const { id, snoozedUntil } = args as { id: string; snoozedUntil: Date };
        return jsonResult({ reminder: await service.snooze(ctx.userId, id, snoozedUntil) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "reminders.duplicate",
    { description: "Duplicate a reminder.", inputSchema: idShape },
    async (args) => {
      try {
        return jsonResult({ reminder: await service.duplicate(ctx.userId, args.id as string) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "reminders.delete",
    { description: "Delete a reminder.", inputSchema: idShape },
    async (args) => {
      try {
        await service.delete(ctx.userId, args.id as string);
        return jsonResult({ ok: true });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );
}
