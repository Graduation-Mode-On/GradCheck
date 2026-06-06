import { z } from "zod";

export const scheduleSlotSchema = z.object({
  dayOfWeek: z.number().min(1).max(7),
  startPeriod: z.number().min(1).max(13),
  endPeriod: z.number().min(1).max(13),
  startWeek: z.number().min(1).max(30).optional(),
  endWeek: z.number().min(1).max(30).optional(),
  weekLabel: z.string().max(40).optional()
});

export const semesterCourseInputSchema = z.object({
  term: z.string().min(1).max(20),
  courseCode: z.string().max(20).optional(),
  courseName: z.string().min(1).max(160),
  credits: z.number().positive(),
  teacher: z.string().max(80).optional(),
  classroom: z.string().max(80).optional(),
  schedule: z.array(scheduleSlotSchema),
  category: z.string().max(32).optional(),
  source: z.enum(["manual", "image_parsed"]).default("manual"),
  selected: z.boolean().default(false)
});

export const parseImageSchema = z.object({
  imageBase64: z.string().min(1),
  term: z.string().min(1).max(20)
});

export const recommendationPreferencesSchema = z.object({
  avoidDays: z.array(z.number().min(1).max(7)).default([]),
  avoidEarlyMorning: z.boolean().default(false),
  scheduleStyle: z.enum(["balanced", "compact", "spread"]).default("spread"),
  maxCoursesPerDay: z.number().min(1).max(12).optional(),
  notes: z.string().optional()
});

export const generateRecommendationSchema = z.object({
  term: z.string().min(1).max(20),
  preferences: recommendationPreferencesSchema,
  candidateCourseIds: z.array(z.string()).default([])
});

export const conflictCourseInfoSchema = z.object({
  courseCode: z.string().optional(),
  courseName: z.string(),
  credits: z.number(),
  teacher: z.string().optional(),
  classroom: z.string().optional(),
  schedule: z.array(scheduleSlotSchema)
});

export const courseConflictSchema = z.object({
  id: z.string(),
  incoming: conflictCourseInfoSchema,
  existing: z.array(conflictCourseInfoSchema),
  defaultChoice: z.enum(["incoming", "existing"]),
  reason: z.string()
});

export const aiRecommendationResponseSchema = z.object({
  recommendedCourses: z.array(
    z.object({
      courseCode: z.string().optional(),
      courseName: z.string(),
      credits: z.number(),
      teacher: z.string().optional(),
      classroom: z.string().optional(),
      schedule: z.array(scheduleSlotSchema),
      reason: z.string()
    })
  ),
  totalCredits: z.number(),
  courseCount: z.number(),
  summary: z.string(),
  warnings: z.array(z.string()).default([]),
  conflicts: z.array(courseConflictSchema).default([])
});

export type SemesterCourseInput = z.infer<typeof semesterCourseInputSchema>;
export type ParseImageInput = z.infer<typeof parseImageSchema>;
export type RecommendationPreferences = z.infer<typeof recommendationPreferencesSchema>;
export type GenerateRecommendationInput = z.infer<typeof generateRecommendationSchema>;
export type AiRecommendationResponse = z.infer<typeof aiRecommendationResponseSchema>;
