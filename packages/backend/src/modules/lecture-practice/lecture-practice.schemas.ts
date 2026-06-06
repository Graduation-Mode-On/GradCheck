import { z } from "zod";

const nonNegativeDecimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "请输入非负数字，最多两位小数");

export const lecturePracticeProgressSchema = z.object({
  humanLectureCount: z.coerce.number().int().min(0),
  bookReportCount: z.coerce.number().int().min(0),
  socialPracticeCredits: nonNegativeDecimalString,
  socialPracticeCourseCount: z.coerce.number().int().min(0)
});

export type LecturePracticeProgressInput = z.infer<typeof lecturePracticeProgressSchema>;

export interface LecturePracticeProgress extends LecturePracticeProgressInput {
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export function defaultLecturePracticeProgress(userId: string): LecturePracticeProgress {
  const now = new Date(0);
  return {
    userId,
    humanLectureCount: 0,
    bookReportCount: 0,
    socialPracticeCredits: "0.00",
    socialPracticeCourseCount: 0,
    createdAt: now,
    updatedAt: now
  };
}
