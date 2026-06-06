import { HttpError } from "../../lib/http-error.js";
import type { ReminderFilters, ReminderInput, ReminderRepository, ReminderUpdateInput } from "./reminders.types.js";

export function createReminderService(repository: ReminderRepository) {
  return {
    async list(userId: string, filters: ReminderFilters = {}) {
      return repository.listByUserId(userId, filters);
    },

    async home(userId: string) {
      const active = await repository.listByUserId(userId, { showOnHome: true, includeCompleted: false });
      return { reminders: active.slice(0, 3), pendingCount: active.length };
    },

    async createCustom(userId: string, input: ReminderInput) {
      return repository.create(userId, { ...input, sourceType: "custom", sourceId: null });
    },

    async update(userId: string, id: string, input: ReminderUpdateInput) {
      const reminder = await repository.update(userId, id, input);
      if (!reminder) {
        throw new HttpError(404, "Reminder not found");
      }
      return reminder;
    },

    async setCompleted(userId: string, id: string, completed: boolean) {
      const input: ReminderUpdateInput = {
        status: completed ? "done" : "pending",
        completedAt: completed ? new Date() : null,
        ...(completed ? { snoozedUntil: null } : {})
      };
      return this.update(userId, id, input);
    },

    async snooze(userId: string, id: string, snoozedUntil: Date) {
      return this.update(userId, id, { status: "snoozed", snoozedUntil });
    },

    async duplicate(userId: string, id: string) {
      const existing = await repository.findById(userId, id);
      if (!existing) {
        throw new HttpError(404, "Reminder not found");
      }
      return repository.create(userId, {
        title: existing.title,
        category: existing.category,
        priority: existing.priority,
        startAt: existing.startAt,
        dueAt: existing.dueAt,
        location: existing.location,
        notes: existing.notes,
        sourceType: "custom",
        sourceId: null,
        reminderOffsets: existing.reminderOffsets,
        smsEnabled: existing.smsEnabled,
        showOnHome: existing.showOnHome
      });
    },

    async delete(userId: string, id: string) {
      const deleted = await repository.softDelete(userId, id);
      if (!deleted) {
        throw new HttpError(404, "Reminder not found");
      }
    }
  };
}
