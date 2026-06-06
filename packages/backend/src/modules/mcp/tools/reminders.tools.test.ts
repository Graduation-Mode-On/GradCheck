import { describe, expect, it, vi } from "vitest";

import type { McpDependencies } from "../mcp.context.js";
import type { ReminderRepository } from "../../reminders/reminders.types.js";
import { createToolRecorder, textOf } from "../mcp.test-helpers.js";
import { registerReminderTools } from "./reminders.tools.js";

function deps(reminderRepository: Partial<ReminderRepository>): McpDependencies {
  return { reminderRepository } as unknown as McpDependencies;
}

describe("reminders tools", () => {
  it("registers all 8 tools", () => {
    const rec = createToolRecorder();
    registerReminderTools(rec.server, { userId: "u1" }, deps({}));
    for (const n of [
      "reminders.list",
      "reminders.get",
      "reminders.create",
      "reminders.update",
      "reminders.complete",
      "reminders.snooze",
      "reminders.duplicate",
      "reminders.delete"
    ]) {
      expect(rec.has(n)).toBe(true);
    }
  });

  it("reminders.get returns the reminder for the user", async () => {
    const findById = vi.fn(async () => ({ id: "r1", title: "Lab" }));
    const rec = createToolRecorder();
    registerReminderTools(rec.server, { userId: "u1" }, deps({ findById } as unknown as Partial<ReminderRepository>));
    const out = await rec.call("reminders.get", { id: "11111111-1111-4111-8111-111111111111" });
    expect(findById).toHaveBeenCalledWith("u1", "11111111-1111-4111-8111-111111111111");
    expect(textOf(out)).toContain("Lab");
  });

  it("reminders.create passes the parsed input to the service", async () => {
    const create = vi.fn(async (_u: string, input: Record<string, unknown>) => ({ id: "r2", ...input }));
    const rec = createToolRecorder();
    registerReminderTools(rec.server, { userId: "u1" }, deps({ create } as unknown as Partial<ReminderRepository>));
    await rec.call("reminders.create", { title: "Exam", dueAt: "2026-07-01T09:00:00.000Z" });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][1]).toMatchObject({ title: "Exam", sourceType: "custom" });
  });
});
