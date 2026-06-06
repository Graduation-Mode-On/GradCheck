import { afterEach, describe, expect, it, vi } from "vitest";

import { startReminderScheduler } from "./start-reminder-scheduler.js";
import type { PushplusTokenResolver } from "./reminder-scheduler.js";
import type { SmsAdapter } from "./sms-adapter.js";
import type { ReminderRepository } from "./reminders.types.js";

function silentLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function noopRepository(): ReminderRepository {
  return {
    async listByUserId() {
      return [];
    },
    async findById() {
      return null;
    },
    async create() {
      throw new Error("not used");
    },
    async update() {
      return null;
    },
    async softDelete() {
      return false;
    },
    async listDueSmsCandidates() {
      return [];
    },
    async findDeliveryLog() {
      return null;
    },
    async createDeliveryLog() {
      throw new Error("not used");
    }
  };
}

const okAdapter: SmsAdapter = {
  async sendReminder() {
    return { providerMessageId: "noop" };
  }
};

const okResolver: PushplusTokenResolver = {
  async getPushplusToken() {
    return null;
  }
};

describe("startReminderScheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not start a timer when disabled", async () => {
    vi.useFakeTimers();
    const log = silentLogger();
    const handle = startReminderScheduler({
      repository: noopRepository(),
      smsAdapter: okAdapter,
      tokenResolver: okResolver,
      intervalMs: 1000,
      enabled: false,
      logger: log
    });
    await handle.tickOnce();
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining("disabled"));
    handle.stop();
  });

  it("invokes the scheduler on each interval tick", async () => {
    vi.useFakeTimers();
    const listSpy = vi.fn(async () => []);
    const repository = { ...noopRepository(), listDueSmsCandidates: listSpy };
    const handle = startReminderScheduler({
      repository,
      smsAdapter: okAdapter,
      tokenResolver: okResolver,
      intervalMs: 1000,
      enabled: true,
      logger: silentLogger()
    });

    await vi.advanceTimersByTimeAsync(2500);
    handle.stop();
    expect(listSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("skips a tick when the previous run is still in flight", async () => {
    vi.useFakeTimers();
    let resolvePending: (() => void) | undefined;
    const listSpy = vi.fn(async () => {
      await new Promise<void>((resolve) => {
        resolvePending = resolve;
      });
      return [];
    });
    const repository = { ...noopRepository(), listDueSmsCandidates: listSpy };
    const log = silentLogger();
    const handle = startReminderScheduler({
      repository,
      smsAdapter: okAdapter,
      tokenResolver: okResolver,
      intervalMs: 100,
      enabled: true,
      logger: log
    });

    await vi.advanceTimersByTimeAsync(350);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("previous tick"));
    resolvePending?.();
    handle.stop();
  });

  it("swallows tick errors and keeps running", async () => {
    vi.useFakeTimers();
    let throws = true;
    const listSpy = vi.fn(async () => {
      if (throws) {
        throws = false;
        throw new Error("kaboom");
      }
      return [];
    });
    const repository = { ...noopRepository(), listDueSmsCandidates: listSpy };
    const log = silentLogger();
    const handle = startReminderScheduler({
      repository,
      smsAdapter: okAdapter,
      tokenResolver: okResolver,
      intervalMs: 100,
      enabled: true,
      logger: log
    });

    await vi.advanceTimersByTimeAsync(250);
    handle.stop();
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining("tick failed"), expect.anything());
    expect(listSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
