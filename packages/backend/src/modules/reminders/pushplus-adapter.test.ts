import { describe, expect, it, vi } from "vitest";

import { PushPlusAdapter } from "./pushplus-adapter.js";
import type { ReminderDto } from "./reminders.types.js";

const dueAt = new Date("2026-06-07T02:30:00.000Z");
const scheduledAt = new Date("2026-06-07T01:30:00.000Z");

function createReminder(overrides: Partial<ReminderDto> = {}): ReminderDto {
  return {
    id: "reminder-1",
    userId: "user-1",
    title: "光电子学实验",
    category: "lab",
    status: "pending",
    priority: "high",
    startAt: null,
    dueAt,
    location: "九龙湖校区光电学院",
    notes: "记得带学生证",
    sourceType: "lab_exam_event",
    sourceId: null,
    reminderOffsets: [60],
    smsEnabled: true,
    showOnHome: true,
    completedAt: null,
    snoozedUntil: null,
    deletedAt: null,
    createdAt: scheduledAt,
    updatedAt: scheduledAt,
    ...overrides
  };
}

function mockFetch(response: Response): typeof fetch {
  return vi.fn(async () => response) as unknown as typeof fetch;
}

function lastCall(impl: typeof fetch): { init: RequestInit | undefined; url: string } {
  const mock = impl as unknown as { mock: { calls: [string, RequestInit | undefined][] } };
  const call = mock.mock.calls[mock.mock.calls.length - 1];
  return { url: call[0], init: call[1] };
}

describe("PushPlusAdapter", () => {
  it("posts a wechat txt notification with the user's token and returns the message id", async () => {
    const fetchImpl = mockFetch(
      new Response(JSON.stringify({ code: 200, msg: "请求成功", data: "msg-flow-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const adapter = new PushPlusAdapter({ fetchImpl, publicBaseUrl: "https://gradcheck.example.com/" });
    const result = await adapter.sendReminder({
      reminder: createReminder(),
      scheduledAt,
      pushplusToken: "06f028951ec64eafadbd4a0a6d235b41"
    });

    expect(result).toEqual({ providerMessageId: "msg-flow-1" });
    const { init } = lastCall(fetchImpl);
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({
      token: "06f028951ec64eafadbd4a0a6d235b41",
      template: "txt",
      channel: "wechat",
      title: "[实验提醒] 光电子学实验"
    });
    expect(body.content).toContain("光电子学实验");
    expect(body.content).toContain("地点：九龙湖校区光电学院");
    expect(body.content).toContain("备注：记得带学生证");
    expect(body.content).toContain("https://gradcheck.example.com/reminders");
  });

  it("throws when PushPlus returns a non-200 code", async () => {
    const fetchImpl = mockFetch(
      new Response(JSON.stringify({ code: 903, msg: "token不存在" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    const adapter = new PushPlusAdapter({ fetchImpl });
    await expect(
      adapter.sendReminder({
        reminder: createReminder(),
        scheduledAt,
        pushplusToken: "00000000000000000000000000000000"
      })
    ).rejects.toThrow(/code=903/);
  });

  it("throws when PushPlus returns an HTTP error", async () => {
    const fetchImpl = mockFetch(new Response("Bad Gateway", { status: 502 }));
    const adapter = new PushPlusAdapter({ fetchImpl });
    await expect(
      adapter.sendReminder({
        reminder: createReminder(),
        scheduledAt,
        pushplusToken: "06f028951ec64eafadbd4a0a6d235b41"
      })
    ).rejects.toThrow(/HTTP 502/);
  });

  it("omits the link line when no public base url is configured", async () => {
    const fetchImpl = mockFetch(
      new Response(JSON.stringify({ code: 200, msg: "ok", data: "id" }), { status: 200 })
    );
    const adapter = new PushPlusAdapter({ fetchImpl });
    await adapter.sendReminder({
      reminder: createReminder({ location: null, notes: null }),
      scheduledAt,
      pushplusToken: "06f028951ec64eafadbd4a0a6d235b41"
    });
    const { init } = lastCall(fetchImpl);
    const body = JSON.parse(init?.body as string);
    expect(body.content).not.toContain("查看详情");
    expect(body.content).not.toContain("地点");
    expect(body.content).not.toContain("备注");
  });
});
