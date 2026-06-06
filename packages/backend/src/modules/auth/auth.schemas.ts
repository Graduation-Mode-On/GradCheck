import { z } from "zod";

export const profileSchema = z.object({
  displayName: z.string().min(1).max(80),
  college: z.string().min(1).max(120),
  major: z.string().min(1).max(120),
  grade: z.coerce.number().int().min(2000).max(2100),
  gpaGoal: z.string().regex(/^[0-4](\.\d{1,2})?$/)
});

export const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128)
});

export const registerSchema = credentialsSchema.extend({
  profile: profileSchema.optional()
});
