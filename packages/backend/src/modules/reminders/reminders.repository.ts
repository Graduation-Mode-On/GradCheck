import { and, asc, eq, gte, isNull, lte, ne } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { reminderDeliveryLogs, reminders } from "../../db/schema.js";
import type {
  ReminderDeliveryChannel,
  ReminderDeliveryLogDto,
  ReminderDto,
  ReminderFilters,
  ReminderRepository
} from "./reminders.types.js";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type RemindersDatabase = Database | Transaction;

function toReminderDto(row: typeof reminders.$inferSelect): ReminderDto {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    category: row.category as ReminderDto["category"],
    status: row.status as ReminderDto["status"],
    priority: row.priority as ReminderDto["priority"],
    startAt: row.startAt,
    dueAt: row.dueAt,
    location: row.location,
    notes: row.notes,
    sourceType: row.sourceType as ReminderDto["sourceType"],
    sourceId: row.sourceId,
    reminderOffsets: row.reminderOffsets,
    smsEnabled: row.smsEnabled,
    showOnHome: row.showOnHome,
    completedAt: row.completedAt,
    snoozedUntil: row.snoozedUntil,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function toDeliveryLogDto(row: typeof reminderDeliveryLogs.$inferSelect): ReminderDeliveryLogDto {
  return {
    id: row.id,
    reminderId: row.reminderId,
    channel: row.channel as ReminderDeliveryLogDto["channel"],
    status: row.status as ReminderDeliveryLogDto["status"],
    scheduledAt: row.scheduledAt,
    sentAt: row.sentAt,
    providerMessageId: row.providerMessageId,
    errorMessage: row.errorMessage,
    attemptCount: row.attemptCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function listConditions(userId: string, filters?: ReminderFilters): SQL[] {
  const conditions: SQL[] = [eq(reminders.userId, userId), isNull(reminders.deletedAt)];
  if (filters?.status) conditions.push(eq(reminders.status, filters.status));
  if (filters?.category) conditions.push(eq(reminders.category, filters.category));
  if (filters?.showOnHome !== undefined) conditions.push(eq(reminders.showOnHome, filters.showOnHome));
  if (filters?.includeCompleted === false) {
    conditions.push(ne(reminders.status, "done"), ne(reminders.status, "cancelled"));
  }
  if (filters?.dueFrom) conditions.push(gte(reminders.dueAt, filters.dueFrom));
  if (filters?.dueTo) conditions.push(lte(reminders.dueAt, filters.dueTo));
  return conditions;
}

export function createReminderRepository(db: RemindersDatabase): ReminderRepository {
  return {
    async listByUserId(userId, filters) {
      const rows = await db
        .select()
        .from(reminders)
        .where(and(...listConditions(userId, filters)))
        .orderBy(asc(reminders.dueAt));
      return rows.map(toReminderDto);
    },

    async findById(userId, id) {
      const [row] = await db
        .select()
        .from(reminders)
        .where(and(eq(reminders.userId, userId), eq(reminders.id, id), isNull(reminders.deletedAt)))
        .limit(1);
      return row ? toReminderDto(row) : null;
    },

    async create(userId, input) {
      const [row] = await db.insert(reminders).values({ userId, ...input }).returning();
      return toReminderDto(row);
    },

    async update(userId, id, input) {
      const [row] = await db
        .update(reminders)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(reminders.userId, userId), eq(reminders.id, id), isNull(reminders.deletedAt)))
        .returning();
      return row ? toReminderDto(row) : null;
    },

    async softDelete(userId, id) {
      const [row] = await db
        .update(reminders)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(reminders.userId, userId), eq(reminders.id, id), isNull(reminders.deletedAt)))
        .returning({ id: reminders.id });
      return Boolean(row);
    },

    async listDueSmsCandidates(now) {
      const rows = await db
        .select()
        .from(reminders)
        .where(
          and(
            eq(reminders.smsEnabled, true),
            isNull(reminders.deletedAt),
            lte(reminders.dueAt, now),
            ne(reminders.status, "done"),
            ne(reminders.status, "cancelled")
          )
        )
        .orderBy(asc(reminders.dueAt));
      return rows.map(toReminderDto);
    },

    async findDeliveryLog(reminderId, channel: ReminderDeliveryChannel, scheduledAt) {
      const [row] = await db
        .select()
        .from(reminderDeliveryLogs)
        .where(
          and(
            eq(reminderDeliveryLogs.reminderId, reminderId),
            eq(reminderDeliveryLogs.channel, channel),
            eq(reminderDeliveryLogs.scheduledAt, scheduledAt)
          )
        )
        .limit(1);
      return row ? toDeliveryLogDto(row) : null;
    },

    async createDeliveryLog(input) {
      const [row] = await db.insert(reminderDeliveryLogs).values(input).returning();
      return toDeliveryLogDto(row);
    }
  };
}
