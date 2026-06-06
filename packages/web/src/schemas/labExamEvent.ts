import { z } from "zod";

export const labExamEventTypeSchema = z.enum(["lab", "midterm", "final", "quiz", "other_exam"]);
export const labExamEventStatusSchema = z.enum(["scheduled", "done", "cancelled"]);

const reminderOffsetsSchema = z
  .array(z.number().int().min(0).max(525600))
  .min(1)
  .max(5);

export const labExamEventInputSchema = z
  .object({
    title: z.string().min(1, "请输入实验或考试标题").max(160),
    courseName: z.string().max(160).nullable(),
    eventType: labExamEventTypeSchema,
    startAt: z.string().min(1, "请选择开始时间"),
    endAt: z.string().nullable(),
    location: z.string().max(200).nullable(),
    teacher: z.string().max(120).nullable(),
    seatOrGroup: z.string().max(120).nullable(),
    notes: z.string().max(1000).nullable(),
    reminderOffsets: reminderOffsetsSchema,
    smsEnabled: z.boolean(),
    showOnHome: z.boolean()
  })
  .refine((input) => !input.endAt || new Date(input.endAt) > new Date(input.startAt), {
    message: "结束时间必须晚于开始时间",
    path: ["endAt"]
  });

export type LabExamEventInput = z.infer<typeof labExamEventInputSchema>;
export type LabExamEventType = z.infer<typeof labExamEventTypeSchema>;
export type LabExamEventStatus = z.infer<typeof labExamEventStatusSchema>;
