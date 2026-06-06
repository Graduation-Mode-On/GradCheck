import { describe, expect, it } from "vitest";

import { runReminderScheduler, type PushplusTokenResolver } from "./reminder-scheduler.js";
import { NoopSmsAdapter, type SmsAdapter } from "./sms-adapter.js";
import type {
  ReminderDeliveryLogDto,
  ReminderDeliveryLogInput,
  ReminderDto,
  ReminderRepository
} from "./reminders.types.js";

const scheduledAt = new Date("2026-06-06T08:00:00.000Z");

function tokenResolver(token: string | null): PushplusTokenResolver {
  return {
    async getPushplusToken() {
      return token;
    }
  };
}

function createReminder(overrides: Partial<ReminderDto> = {}): ReminderDto {
  return {
    id: "reminder-1",
    userId: "user-1",
    title: "Lab exam",
    category: "exam",
    status: "pending",
    priority: "normal",
    startAt: null,
    dueAt: new Date(scheduledAt.getTime() + 60 * 60_000),
    location: null,
    notes: null,
    sourceType: "custom",
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

function createDeliveryLog(input: ReminderDeliveryLogInput): ReminderDeliveryLogDto {
  return {
    id: "delivery-log-1",
    ...input,
    createdAt: scheduledAt,
    updatedAt: scheduledAt
  };
}

function createRepository({
  candidates,
  existingLog,
  createdLogs
}: {
  candidates: ReminderDto[];
  existingLog?: ReminderDeliveryLogDto | null;
  createdLogs: ReminderDeliveryLogInput[];
}): ReminderRepository {
  return {
    async listByUserId() {
      throw new Error("not used");
    },
    async findById() {
      throw new Error("not used");
    },
    async create() {
      throw new Error("not used");
    },
    async update() {
      throw new Error("not used");
    },
    async softDelete() {
      throw new Error("not used");
    },
    async listDueSmsCandidates(candidateNow) {
      expect(candidateNow).toEqual(scheduledAt);
      return candidates;
    },
    async findDeliveryLog(reminderId, channel, candidateScheduledAt) {
      if (
        existingLog &&
        existingLog.reminderId === reminderId &&
        existingLog.channel === channel &&
        existingLog.scheduledAt.getTime() === candidateScheduledAt.getTime()
      ) {
        return existingLog;
      }
      return null;
    },
    async createDeliveryLog(input) {
      createdLogs.push(input);
      return createDeliveryLog(input);
    }
  };
}

describe("runReminderScheduler", () => {
  it("sends due SMS reminders through the noop adapter and writes a log", async () => {
    const reminder = createReminder();
    const createdLogs: ReminderDeliveryLogInput[] = [];
    const repository = createRepository({ candidates: [reminder], createdLogs });

    const result = await runReminderScheduler({
      now: scheduledAt,
      repository,
      smsAdapter: new NoopSmsAdapter(),
      tokenResolver: tokenResolver("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    });

    expect(result).toEqual({ scanned: 1, sent: 1, skipped: 0, failed: 0 });
    expect(createdLogs).toEqual([
      {
        reminderId: reminder.id,
        channel: "sms",
        status: "sent",
        scheduledAt,
        sentAt: scheduledAt,
        providerMessageId: `noop-${reminder.id}`,
        errorMessage: null,
        attemptCount: 1
      }
    ]);
  });

  it("does not duplicate an existing sent delivery log", async () => {
    const reminder = createReminder();
    const createdLogs: ReminderDeliveryLogInput[] = [];
    const existingLog = createDeliveryLog({
      reminderId: reminder.id,
      channel: "sms",
      status: "sent",
      scheduledAt,
      sentAt: scheduledAt,
      providerMessageId: `noop-${reminder.id}`,
      errorMessage: null,
      attemptCount: 1
    });
    const repository = createRepository({
      candidates: [reminder],
      existingLog,
      createdLogs
    });

    const result = await runReminderScheduler({
      now: scheduledAt,
      repository,
      smsAdapter: new NoopSmsAdapter(),
      tokenResolver: tokenResolver("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    });

    expect(result).toEqual({ scanned: 1, sent: 0, skipped: 1, failed: 0 });
    expect(createdLogs).toEqual([]);
  });

  it("records a failed delivery log when the adapter throws", async () => {
    const reminder = createReminder();
    const createdLogs: ReminderDeliveryLogInput[] = [];
    const failingAdapter: SmsAdapter = {
      async sendReminder() {
        throw new Error("provider down");
      }
    };
    const repository = createRepository({ candidates: [reminder], createdLogs });

    const result = await runReminderScheduler({
      now: scheduledAt,
      repository,
      smsAdapter: failingAdapter,
      tokenResolver: tokenResolver("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    });

    expect(result).toEqual({ scanned: 1, sent: 0, skipped: 0, failed: 1 });
    expect(createdLogs).toEqual([
      {
        reminderId: reminder.id,
        channel: "sms",
        status: "failed",
        scheduledAt,
        sentAt: null,
        providerMessageId: null,
        errorMessage: "provider down",
        attemptCount: 1
      }
    ]);
  });

  it("skips reminders for users who have not bound a PushPlus token", async () => {
    const reminder = createReminder();
    const createdLogs: ReminderDeliveryLogInput[] = [];
    const adapter: SmsAdapter = {
      async sendReminder() {
        throw new Error("adapter should not be invoked");
      }
    };
    const repository = createRepository({ candidates: [reminder], createdLogs });

    const result = await runReminderScheduler({
      now: scheduledAt,
      repository,
      smsAdapter: adapter,
      tokenResolver: tokenResolver(null)
    });

    expect(result).toEqual({ scanned: 1, sent: 0, skipped: 1, failed: 0 });
    expect(createdLogs).toEqual([
      {
        reminderId: reminder.id,
        channel: "sms",
        status: "skipped",
        scheduledAt,
        sentAt: null,
        providerMessageId: null,
        errorMessage: "用户未绑定 PushPlus token",
        attemptCount: 1
      }
    ]);
  });

  it("passes the resolved pushplus token through to the adapter", async () => {
    const reminder = createReminder();
    const createdLogs: ReminderDeliveryLogInput[] = [];
    const seenTokens: string[] = [];
    const adapter: SmsAdapter = {
      async sendReminder(input) {
        seenTokens.push(input.pushplusToken);
        return { providerMessageId: "msg-1" };
      }
    };
    const repository = createRepository({ candidates: [reminder], createdLogs });

    const result = await runReminderScheduler({
      now: scheduledAt,
      repository,
      smsAdapter: adapter,
      tokenResolver: tokenResolver("06f028951ec64eafadbd4a0a6d235b41")
    });

    expect(result).toEqual({ scanned: 1, sent: 1, skipped: 0, failed: 0 });
    expect(seenTokens).toEqual(["06f028951ec64eafadbd4a0a6d235b41"]);
  });
});
