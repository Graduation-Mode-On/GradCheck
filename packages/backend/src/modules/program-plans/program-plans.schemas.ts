import { z } from "zod";

const programSchema = z.object({
  school: z.string().min(1),
  college: z.string().nullable().optional(),
  major: z.string().min(1),
  grade: z.string().nullable().optional(),
  total_credits: z.number().nullable().optional()
}).passthrough();

const courseSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  credits: z.number(),
  category: z.string().nullable().optional(),
  subcategory: z.string().nullable().optional(),
  term: z.object({
    year: z.string().nullable().optional(),
    semester: z.string().nullable().optional()
  }).passthrough().optional()
}).passthrough();

const requirementSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1)
}).passthrough();

export const curriculumPlanSchema = z.object({
  program: programSchema,
  courses: z.array(courseSchema),
  requirements: z.array(requirementSchema),
  semester_plan: z.array(z.unknown()).default([]),
  warnings: z.array(z.unknown()).default([]),
  provenance: z.record(z.string(), z.unknown()).default({})
}).passthrough();

export const importProgramPlanSchema = z.object({
  sourceFilename: z.string().min(1).max(240),
  planJson: curriculumPlanSchema
});

export type CurriculumPlan = z.infer<typeof curriculumPlanSchema>;
export type ImportProgramPlanInput = z.infer<typeof importProgramPlanSchema>;

export interface ProgramPlanSummary {
  id: string;
  sourceFilename: string;
  school: string;
  college: string | null;
  major: string;
  grade: string | null;
  totalCredits: string | null;
  courseCount: number;
  requirementCount: number;
  warningCount: number;
  planJson: CurriculumPlan;
  createdAt: Date;
  updatedAt: Date;
}
