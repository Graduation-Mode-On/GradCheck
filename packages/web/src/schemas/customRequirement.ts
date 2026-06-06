import { z } from "zod";

export const customRequirementSchema = z.object({
  name: z.string().min(1, "请输入要求名称").max(120),
  kind: z.enum(["count", "hours", "credits", "boolean"]),
  category: z.enum(["lecture", "volunteer", "labor", "practice", "college", "sports", "exam", "other"]),
  targetValue: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "请输入有效目标值")
    .refine((value) => Number(value) <= 999999.99, "目标值不能超过 999999.99")
    .refine((value) => Number(value) > 0, "目标值必须大于 0"),
  currentValue: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "请输入有效当前值")
    .refine((value) => Number(value) <= 999999.99, "当前值不能超过 999999.99"),
  unit: z.string().min(1, "请输入单位").max(24),
  importance: z.enum(["required", "optional", "personal_goal"]),
  source: z.enum(["user_custom", "college_requirement", "pending_confirmation"]),
  includeInProgress: z.boolean(),
  showOnHome: z.boolean(),
  deadline: z.string().nullable(),
  notes: z.string().nullable()
});

export type CustomRequirementInput = z.infer<typeof customRequirementSchema>;
