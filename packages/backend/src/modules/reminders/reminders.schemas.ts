import { z } from "zod";

export const reminderCategorySchema = z.enum(["lab", "exam", "custom", "volunteer", "labor", "sports", "other"]);
export const reminderStatusSchema = z.enum(["pending", "done", "snoozed", "cancelled"]);
export const reminderPrioritySchema = z.enum(["low", "normal", "high"]);
export const reminderSourceTypeSchema = z.enum(["lab_exam_event", "custom", "system"]);

const isoDateSchema = z.iso.datetime().transform((value) => new Date(value));
const nullableIsoDateSchema = isoDateSchema.nullable();
const nullableStringSchema = z.string().max(1000).nullable();
const nullableUuidSchema = z.uuid().nullable();

export const reminderOffsetsSchema = z.array(z.number().int().min(0).max(525600)).min(1).max(5);

const booleanQuerySchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

export const createReminderSchema = z.object({
  title: z.string().min(1).max(160),
  category: reminderCategorySchema.default("custom"),
  priority: reminderPrioritySchema.default("normal"),
  startAt: nullableIsoDateSchema.default(null),
  dueAt: isoDateSchema,
  location: z.string().max(200).nullable().default(null),
  notes: nullableStringSchema.default(null),
  sourceType: reminderSourceTypeSchema.default("custom"),
  sourceId: nullableUuidSchema.default(null),
  reminderOffsets: reminderOffsetsSchema.default([1440, 60]),
  smsEnabled: z.boolean().default(false),
  showOnHome: z.boolean().default(true)
});

export const updateReminderSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  category: reminderCategorySchema.optional(),
  priority: reminderPrioritySchema.optional(),
  startAt: nullableIsoDateSchema.optional(),
  dueAt: isoDateSchema.optional(),
  location: z.string().max(200).nullable().optional(),
  notes: nullableStringSchema.optional(),
  sourceType: reminderSourceTypeSchema.optional(),
  sourceId: nullableUuidSchema.optional(),
  reminderOffsets: reminderOffsetsSchema.optional(),
  smsEnabled: z.boolean().optional(),
  showOnHome: z.boolean().optional(),
  status: reminderStatusSchema.optional(),
  completedAt: nullableIsoDateSchema.optional(),
  snoozedUntil: nullableIsoDateSchema.optional(),
  deletedAt: nullableIsoDateSchema.optional()
});

export const listReminderQuerySchema = z.object({
  status: reminderStatusSchema.optional(),
  category: reminderCategorySchema.optional(),
  showOnHome: booleanQuerySchema,
  includeCompleted: booleanQuerySchema,
  dueFrom: isoDateSchema.optional(),
  dueTo: isoDateSchema.optional()
});

export const completeReminderSchema = z.object({
  completed: z.boolean()
});

export const snoozeReminderSchema = z.object({
  snoozedUntil: isoDateSchema
});
