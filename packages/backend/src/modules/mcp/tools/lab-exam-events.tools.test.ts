import { describe, expect, it, vi } from "vitest";

import type { McpDependencies } from "../mcp.context.js";
import { createToolRecorder, textOf } from "../mcp.test-helpers.js";
import { registerLabExamEventTools } from "./lab-exam-events.tools.js";

function depsWith(serviceCreate: ReturnType<typeof vi.fn>): McpDependencies {
  const reminderRepository = { create: vi.fn(async () => ({ id: "rem1" })), update: vi.fn() };
  const eventRepository = {
    create: serviceCreate,
    update: vi.fn(),
    findById: vi.fn(async () => ({ id: "e1", reminderId: "rem1" }))
  };
  return {
    labExamEvents: {
      db: { transaction: async (fn: (tx: unknown) => unknown) => fn({}) },
      createReminderRepository: () => reminderRepository,
      createLabExamEventRepository: () => eventRepository
    }
  } as unknown as McpDependencies;
}

describe("lab_exam_events tools", () => {
  it("registers 5 tools", () => {
    const rec = createToolRecorder();
    registerLabExamEventTools(rec.server, { userId: "u1" }, depsWith(vi.fn()));
    expect(rec.names().sort()).toEqual(
      [
        "lab_exam_events.create",
        "lab_exam_events.delete",
        "lab_exam_events.list",
        "lab_exam_events.update",
        "lab_exam_events.update_status"
      ].sort()
    );
  });

  it("create rejects endAt before startAt with -32602", async () => {
    const rec = createToolRecorder();
    registerLabExamEventTools(rec.server, { userId: "u1" }, depsWith(vi.fn()));
    await expect(
      rec.call("lab_exam_events.create", {
        title: "Final",
        eventType: "final",
        startAt: new Date("2026-07-01T10:00:00.000Z"),
        endAt: new Date("2026-07-01T09:00:00.000Z")
      })
    ).rejects.toMatchObject({ code: -32602 });
  });

  it("create returns event+reminder from service", async () => {
    const create = vi.fn(async (_u: string, input: Record<string, unknown>) => ({ id: "e1", ...input }));
    const rec = createToolRecorder();
    registerLabExamEventTools(rec.server, { userId: "u1" }, depsWith(create));
    const out = await rec.call("lab_exam_events.create", {
      title: "Final",
      eventType: "final",
      startAt: new Date("2026-07-01T09:00:00.000Z")
    });
    expect(textOf(out)).toContain("rem1");
  });
});
