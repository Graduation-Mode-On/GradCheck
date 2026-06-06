import type { SmsAdapter } from "./sms-adapter.js";
import type { ReminderRepository } from "./reminders.types.js";

export interface SchedulerResult {
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
}

export async function runReminderScheduler({
  now,
  repository,
  smsAdapter
}: {
  now: Date;
  repository: ReminderRepository;
  smsAdapter: SmsAdapter;
}): Promise<SchedulerResult> {
  const candidates = await repository.listDueSmsCandidates(now);
  const result: SchedulerResult = {
    scanned: candidates.length,
    sent: 0,
    skipped: 0,
    failed: 0
  };

  for (const reminder of candidates) {
    for (const offsetMinutes of reminder.reminderOffsets) {
      const scheduledAt = new Date(reminder.dueAt.getTime() - offsetMinutes * 60_000);

      if (scheduledAt > now) {
        continue;
      }

      const existingLog = await repository.findDeliveryLog(reminder.id, "sms", scheduledAt);
      if (existingLog?.status === "sent" || existingLog?.status === "pending") {
        result.skipped += 1;
        continue;
      }

      try {
        const sendResult = await smsAdapter.sendReminder({ reminder, scheduledAt });
        await repository.createDeliveryLog({
          reminderId: reminder.id,
          channel: "sms",
          status: "sent",
          scheduledAt,
          sentAt: now,
          providerMessageId: sendResult.providerMessageId,
          errorMessage: null,
          attemptCount: 1
        });
        result.sent += 1;
      } catch (error) {
        await repository.createDeliveryLog({
          reminderId: reminder.id,
          channel: "sms",
          status: "failed",
          scheduledAt,
          sentAt: null,
          providerMessageId: null,
          errorMessage: error instanceof Error ? error.message : "Unknown SMS adapter error",
          attemptCount: 1
        });
        result.failed += 1;
      }
    }
  }

  return result;
}
