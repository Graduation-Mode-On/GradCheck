import type { ReminderDto } from "./reminders.types.js";

export interface SmsSendInput {
  reminder: ReminderDto;
  scheduledAt: Date;
  pushplusToken: string;
}

export interface SmsSendResult {
  providerMessageId: string;
}

export interface SmsAdapter {
  sendReminder(input: SmsSendInput): Promise<SmsSendResult>;
}

export class NoopSmsAdapter implements SmsAdapter {
  async sendReminder(input: SmsSendInput): Promise<SmsSendResult> {
    return { providerMessageId: `noop-${input.reminder.id}` };
  }
}
