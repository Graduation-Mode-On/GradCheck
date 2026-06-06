import { runReminderScheduler, type PushplusTokenResolver, type SchedulerResult } from "./reminder-scheduler.js";
import type { SmsAdapter } from "./sms-adapter.js";
import type { ReminderRepository } from "./reminders.types.js";

export interface StartReminderSchedulerOptions {
  repository: ReminderRepository;
  smsAdapter: SmsAdapter;
  tokenResolver: PushplusTokenResolver;
  intervalMs: number;
  enabled: boolean;
  now?: () => Date;
  logger?: Pick<Console, "info" | "warn" | "error">;
}

export interface StoppableScheduler {
  stop(): void;
  tickOnce(): Promise<SchedulerResult | null>;
}

export function startReminderScheduler(options: StartReminderSchedulerOptions): StoppableScheduler {
  const log = options.logger ?? console;
  const now = options.now ?? (() => new Date());

  if (!options.enabled) {
    log.info("[reminder-scheduler] disabled via configuration; no ticks will run");
    return {
      stop() {},
      async tickOnce() {
        return null;
      }
    };
  }

  let running = false;

  async function tick(): Promise<SchedulerResult | null> {
    if (running) {
      log.warn("[reminder-scheduler] previous tick still running, skipping this round");
      return null;
    }
    running = true;
    try {
      const result = await runReminderScheduler({
        now: now(),
        repository: options.repository,
        smsAdapter: options.smsAdapter,
        tokenResolver: options.tokenResolver
      });
      if (result.scanned > 0 || result.sent > 0 || result.failed > 0) {
        log.info(
          `[reminder-scheduler] scanned=${result.scanned} sent=${result.sent} skipped=${result.skipped} failed=${result.failed}`
        );
      }
      return result;
    } catch (error) {
      log.error("[reminder-scheduler] tick failed:", error instanceof Error ? error.message : error);
      return null;
    } finally {
      running = false;
    }
  }

  const handle = setInterval(() => {
    void tick();
  }, options.intervalMs);
  if (typeof handle.unref === "function") {
    handle.unref();
  }
  log.info(`[reminder-scheduler] started; ticking every ${options.intervalMs}ms`);

  return {
    stop() {
      clearInterval(handle);
      log.info("[reminder-scheduler] stopped");
    },
    tickOnce: tick
  };
}
