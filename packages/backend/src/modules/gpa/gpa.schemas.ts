import { z } from "zod";

export const gpaTerms = Array.from({ length: 11 }, (_, index) => {
  const startYear = 2020 + index;
  return [`${startYear}-${startYear + 1} 秋`, `${startYear}-${startYear + 1} 春`];
}).flat() as [string, ...string[]];

const decimalStringSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Value must be a number with up to two decimals");

export const gpaCourseInputSchema = z.object({
  term: z.enum(gpaTerms),
  name: z.string().trim().min(1, "Course name is required").max(160),
  credit: decimalStringSchema.refine((value) => {
    const numberValue = Number(value);
    return numberValue > 0 && numberValue <= 99.99;
  }, "Credit must be greater than 0"),
  score: decimalStringSchema.refine((value) => {
    const numberValue = Number(value);
    return numberValue >= 0 && numberValue <= 100;
  }, "Score must be between 0 and 100"),
  isRequired: z.boolean(),
  isFirstAttempt: z.boolean(),
  isGpaEligible: z.boolean()
});

export const gpaTranscriptImportSchema = z.object({
  courses: z.array(gpaCourseInputSchema).min(1).max(300)
});

export type GpaCourseInputRequest = z.infer<typeof gpaCourseInputSchema>;
