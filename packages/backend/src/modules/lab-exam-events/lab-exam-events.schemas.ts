import { z } from "zod";

export const labExamEventTypeSchema = z.enum(["lab", "midterm", "final", "quiz", "other_exam"]);
export const labExamEventStatusSchema = z.enum(["scheduled", "done", "cancelled"]);

const isoDateSchema = z.iso.datetime().transform((value) => new Date(value));
const nullableIsoDateSchema = isoDateSchema.nullable();
const nullableString = (max: number) => z.string().max(max).nullable();

export const labExamReminderOffsetsSchema = z.array(z.number().int().min(0).max(525600)).min(1).max(5);

const createFields = {
  title: z.string().min(1).max(160),
  courseName: nullableString(160).default(null),
  eventType: labExamEventTypeSchema,
  startAt: isoDateSchema,
  endAt: nullableIsoDateSchema.default(null),
  location: nullableString(200).default(null),
  teacher: nullableString(120).default(null),
  seatOrGroup: nullableString(120).default(null),
  notes: nullableString(1000).default(null),
  smsEnabled: z.boolean().default(false),
  showOnHome: z.boolean().default(true),
  reminderOffsets: labExamReminderOffsetsSchema.default([1440, 60])
};

function endAtAfterStartAt(input: { startAt?: Date; endAt?: Date | null }) {
  return !input.startAt || !input.endAt || input.endAt > input.startAt;
}

export const createLabExamEventSchema = z.object(createFields).refine(endAtAfterStartAt, {
  message: "endAt must be after startAt",
  path: ["endAt"]
});

export const updateLabExamEventSchema = z
  .object({
    title: createFields.title.optional(),
    courseName: nullableString(160).optional(),
    eventType: labExamEventTypeSchema.optional(),
    startAt: isoDateSchema.optional(),
    endAt: nullableIsoDateSchema.optional(),
    location: nullableString(200).optional(),
    teacher: nullableString(120).optional(),
    seatOrGroup: nullableString(120).optional(),
    notes: nullableString(1000).optional(),
    smsEnabled: z.boolean().optional(),
    showOnHome: z.boolean().optional(),
    reminderOffsets: labExamReminderOffsetsSchema.optional()
  })
  .refine(endAtAfterStartAt, {
    message: "endAt must be after startAt",
    path: ["endAt"]
  });

export const updateLabExamEventStatusSchema = z.object({
  status: labExamEventStatusSchema
});

export const listLabExamEventsQuerySchema = z.object({
  status: labExamEventStatusSchema.optional(),
  eventType: labExamEventTypeSchema.optional()
});
