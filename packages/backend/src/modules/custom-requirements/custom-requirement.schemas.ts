import { z } from "zod";

export const customRequirementKindSchema = z.enum(["count", "hours", "credits", "boolean"]);
export const customRequirementCategorySchema = z.enum([
  "lecture",
  "volunteer",
  "labor",
  "practice",
  "college",
  "sports",
  "exam",
  "other"
]);
export const customRequirementImportanceSchema = z.enum(["required", "optional", "personal_goal"]);
export const customRequirementSourceSchema = z.enum(["user_custom", "college_requirement", "pending_confirmation"]);

const decimalStringSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/)
  .refine((value) => Number(value) <= 999999.99, "Value must fit numeric(8,2)");
const positiveDecimalStringSchema = decimalStringSchema.refine((value) => Number(value) > 0, "Target value must be greater than zero");

function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const deadlineSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isRealCalendarDate, "Deadline must be a real calendar date")
  .nullable();

export const createCustomRequirementSchema = z.object({
  name: z.string().min(1).max(120),
  kind: customRequirementKindSchema,
  category: customRequirementCategorySchema,
  targetValue: positiveDecimalStringSchema,
  currentValue: decimalStringSchema.default("0"),
  unit: z.string().min(1).max(24),
  importance: customRequirementImportanceSchema.default("required"),
  source: customRequirementSourceSchema.default("user_custom"),
  includeInProgress: z.boolean().default(true),
  showOnHome: z.boolean().default(true),
  deadline: deadlineSchema.default(null),
  notes: z.string().max(1000).nullable().default(null)
});

export const updateCustomRequirementSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  kind: customRequirementKindSchema.optional(),
  category: customRequirementCategorySchema.optional(),
  targetValue: positiveDecimalStringSchema.optional(),
  currentValue: decimalStringSchema.optional(),
  unit: z.string().min(1).max(24).optional(),
  importance: customRequirementImportanceSchema.optional(),
  source: customRequirementSourceSchema.optional(),
  includeInProgress: z.boolean().optional(),
  showOnHome: z.boolean().optional(),
  deadline: deadlineSchema.optional(),
  notes: z.string().max(1000).nullable().optional()
});
