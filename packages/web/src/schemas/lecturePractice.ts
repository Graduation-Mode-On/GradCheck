import { z } from "zod";

export const lecturePracticeProgressSchema = z.object({
  humanLectureCount: z.coerce.number().int().min(0, "次数不能小于 0"),
  bookReportCount: z.coerce.number().int().min(0, "次数不能小于 0"),
  socialPracticeCredits: z.string().regex(/^\d+(\.\d{1,2})?$/, "请输入非负学分，最多两位小数"),
  socialPracticeCourseCount: z.coerce.number().int().min(0, "次数不能小于 0")
});

export type LecturePracticeProgressInput = z.infer<typeof lecturePracticeProgressSchema>;

export interface LecturePracticeProgress extends LecturePracticeProgressInput {
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export function decimalToFixedText(value: string | number): string {
  return Number(value || 0).toFixed(2);
}

export function lecturePracticeCompleted(progress: LecturePracticeProgressInput): boolean {
  return (
    progress.humanLectureCount >= 8 &&
    progress.bookReportCount >= 2 &&
    Number(progress.socialPracticeCredits) >= 1 &&
    progress.socialPracticeCourseCount >= 1
  );
}

export function socialPracticeStatus(creditsText: string): string {
  const credits = Number(creditsText || 0);
  if (credits >= 3) return "社会实践优秀已达成";
  if (credits >= 1) return `已及格，距优秀还差 ${Number((3 - credits).toFixed(2))} 学分`;
  return `未及格，距毕业还差 ${Number((1 - credits).toFixed(2))} 学分`;
}
