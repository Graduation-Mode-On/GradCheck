import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { McpContext, McpDependencies } from "../mcp.context.js";
import { jsonResult } from "../mcp.helpers.js";
import { mcpError, toMcpError } from "../mcp.errors.js";
import { createLabExamEventService } from "../../lab-exam-events/lab-exam-events.service.js";
import {
  createLabExamEventSchema,
  listLabExamEventsQuerySchema,
  updateLabExamEventSchema,
  updateLabExamEventStatusSchema
} from "../../lab-exam-events/lab-exam-events.schemas.js";

const idShape = { id: z.string().uuid() };

function assertEndAfterStart(input: { startAt?: Date | null; endAt?: Date | null }): void {
  if (input.startAt && input.endAt && input.endAt <= input.startAt) {
    throw mcpError(-32602, "endAt must be after startAt");
  }
}

export function registerLabExamEventTools(server: McpServer, ctx: McpContext, deps: McpDependencies): void {
  const getService = () =>
    createLabExamEventService({
      db: deps.labExamEvents.db,
      createLabExamEventRepository: deps.labExamEvents.createLabExamEventRepository,
      createReminderRepository: deps.labExamEvents.createReminderRepository
    });

  server.registerTool(
    "lab_exam_events.list",
    { description: "List lab/exam events.", inputSchema: listLabExamEventsQuerySchema.shape },
    async (args) => {
      try {
        return jsonResult({ events: await getService().list(ctx.userId, args as never) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "lab_exam_events.create",
    {
      description: "Register a lab/exam event (also creates a derived reminder).",
      inputSchema: createLabExamEventSchema.shape
    },
    async (args) => {
      try {
        assertEndAfterStart(args as { startAt?: Date; endAt?: Date | null });
        return jsonResult(await getService().create(ctx.userId, args as never));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "lab_exam_events.update",
    {
      description: "Update a lab/exam event (syncs its derived reminder).",
      inputSchema: { ...idShape, ...updateLabExamEventSchema.shape }
    },
    async (args) => {
      try {
        const { id, ...input } = args as { id: string } & { startAt?: Date; endAt?: Date | null };
        assertEndAfterStart(input);
        return jsonResult(await getService().update(ctx.userId, id, input as never));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "lab_exam_events.update_status",
    {
      description: "Update a lab/exam event status (scheduled/done/cancelled).",
      inputSchema: { ...idShape, ...updateLabExamEventStatusSchema.shape }
    },
    async (args) => {
      try {
        const { id, status } = args as { id: string; status: "scheduled" | "done" | "cancelled" };
        return jsonResult(await getService().updateStatus(ctx.userId, id, status));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "lab_exam_events.delete",
    { description: "Delete a lab/exam event (and its derived reminder).", inputSchema: idShape },
    async (args) => {
      try {
        await getService().delete(ctx.userId, args.id as string);
        return jsonResult({ ok: true });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );
}
