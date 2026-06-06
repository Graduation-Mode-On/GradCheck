import { z } from "zod";

export const reminderCategorySchema = z.enum([
  "lab",
  "exam",
  "custom",
  "volunteer",
  "labor",
  "sports",
  "other"
]);

export const reminderStatusSchema = z.enum(["pending", "done", "snoozed", "cancelled"]);
export const reminderPrioritySchema = z.enum(["low", "normal", "high"]);
export const reminderSourceTypeSchema = z.enum(["lab_exam_event", "custom", "system"]);

const reminderOffsetsSchema = z
  .array(z.number().int().min(0).max(525600))
  .min(1)
  .max(5);

export const reminderInputSchema = z.object({
  title: z.string().min(1, "请输入提醒标题").max(160),
  category: reminderCategorySchema,
  priority: reminderPrioritySchema,
  startAt: z.string().nullable(),
  dueAt: z.string().min(1, "请选择提醒时间"),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  reminderOffsets: reminderOffsetsSchema,
  smsEnabled: z.boolean(),
  showOnHome: z.boolean()
});

export type ReminderInput = z.infer<typeof reminderInputSchema>;
export type ReminderCategory = z.infer<typeof reminderCategorySchema>;
export type ReminderStatus = z.infer<typeof reminderStatusSchema>;
export type ReminderPriority = z.infer<typeof reminderPrioritySchema>;
export type ReminderSourceType = z.infer<typeof reminderSourceTypeSchema>;
