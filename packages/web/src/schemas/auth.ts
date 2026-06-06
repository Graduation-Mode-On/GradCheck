import { z } from "zod";

export const profileSchema = z.object({
  displayName: z.string().min(1, "请输入显示名称").max(80),
  college: z.string().min(1, "请输入学院").max(120),
  major: z.string().min(1, "请输入专业").max(120),
  grade: z.coerce.number().int().min(2000).max(2100),
  gpaGoal: z.string().regex(/^[0-4](\.\d{1,2})?$/, "请输入 0.00 到 4.80 之间的目标绩点"),
  studentId: z.string().regex(/^\d{9}$/, "学生一卡通必须是 9 位数字"),
  pushplusToken: z
    .preprocess(
      (value) => {
        if (value === null || value === undefined) return null;
        if (typeof value === "string" && value.trim().length === 0) return null;
        return value;
      },
      z
        .string()
        .regex(/^[a-f0-9]{32}$/i, "PushPlus token 必须是 32 位十六进制字符")
        .nullable()
    )
    .transform((value) => (value ? value.toLowerCase() : null))
});

export const loginSchema = z.object({
  email: z.string().email("请输入有效邮箱"),
  password: z.string().min(8, "密码至少 8 位")
});

export const registerSchema = loginSchema.extend({
  profile: profileSchema
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
