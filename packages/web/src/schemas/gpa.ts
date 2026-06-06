import { z } from "zod";

export const gpaTerms = Array.from({ length: 11 }, (_, index) => {
  const startYear = 2020 + index;
  return [`${startYear}-${startYear + 1} 秋`, `${startYear}-${startYear + 1} 春`];
}).flat() as [string, ...string[]];

const decimalStringSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "请输入最多两位小数的数字");

export const gpaCourseSchema = z.object({
  term: z.enum(gpaTerms),
  name: z.string().trim().min(1, "请输入课程名称").max(160, "课程名称不能超过 160 个字符"),
  credit: decimalStringSchema.refine((value) => Number(value) > 0 && Number(value) <= 99.99, "学分必须大于 0"),
  score: decimalStringSchema.refine((value) => Number(value) >= 0 && Number(value) <= 100, "成绩必须在 0 到 100 之间"),
  isRequired: z.boolean(),
  isFirstAttempt: z.boolean(),
  isGpaEligible: z.boolean()
});

export type GpaCourseInput = z.infer<typeof gpaCourseSchema>;
