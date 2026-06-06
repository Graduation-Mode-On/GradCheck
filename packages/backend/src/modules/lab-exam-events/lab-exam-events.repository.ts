import { and, asc, eq, isNull } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { labExamEvents } from "../../db/schema.js";
import type { LabExamEventDto, LabExamEventFilters, LabExamEventRepository } from "./lab-exam-events.types.js";

function toDto(row: typeof labExamEvents.$inferSelect): LabExamEventDto {
  return {
    id: row.id,
    userId: row.userId,
    reminderId: row.reminderId,
    title: row.title,
    courseName: row.courseName,
    eventType: row.eventType as LabExamEventDto["eventType"],
    startAt: row.startAt,
    endAt: row.endAt,
    location: row.location,
    teacher: row.teacher,
    seatOrGroup: row.seatOrGroup,
    notes: row.notes,
    status: row.status as LabExamEventDto["status"],
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function listConditions(userId: string, filters?: LabExamEventFilters): SQL[] {
  const conditions: SQL[] = [eq(labExamEvents.userId, userId), isNull(labExamEvents.deletedAt)];
  if (filters?.status) conditions.push(eq(labExamEvents.status, filters.status));
  if (filters?.eventType) conditions.push(eq(labExamEvents.eventType, filters.eventType));
  return conditions;
}

export function createLabExamEventRepository(db: Database): LabExamEventRepository {
  return {
    async listByUserId(userId, filters) {
      const rows = await db
        .select()
        .from(labExamEvents)
        .where(and(...listConditions(userId, filters)))
        .orderBy(asc(labExamEvents.startAt));
      return rows.map(toDto);
    },

    async findById(userId, id) {
      const [row] = await db
        .select()
        .from(labExamEvents)
        .where(and(eq(labExamEvents.userId, userId), eq(labExamEvents.id, id), isNull(labExamEvents.deletedAt)))
        .limit(1);
      return row ? toDto(row) : null;
    },

    async create(userId, input) {
      const [row] = await db.insert(labExamEvents).values({ userId, ...input }).returning();
      return toDto(row);
    },

    async update(userId, id, input) {
      const [row] = await db
        .update(labExamEvents)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(labExamEvents.userId, userId), eq(labExamEvents.id, id), isNull(labExamEvents.deletedAt)))
        .returning();
      return row ? toDto(row) : null;
    },

    async softDelete(userId, id) {
      const [row] = await db
        .update(labExamEvents)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(labExamEvents.userId, userId), eq(labExamEvents.id, id), isNull(labExamEvents.deletedAt)))
        .returning({ id: labExamEvents.id });
      return Boolean(row);
    }
  };
}
