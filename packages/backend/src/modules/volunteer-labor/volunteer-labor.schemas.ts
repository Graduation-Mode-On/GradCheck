import { z } from "zod";

const nonNegativeDecimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "请输入非负数字，最多两位小数");

export const volunteerLaborProgressSchema = z.object({
  volunteerHours: nonNegativeDecimalString,
  ordinaryLaborCount: z.coerce.number().int().min(0),
  specialLaborCount: z.coerce.number().int().min(0)
});

export type VolunteerLaborProgressInput = z.infer<typeof volunteerLaborProgressSchema>;

export interface VolunteerLaborProgress extends VolunteerLaborProgressInput {
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export function defaultVolunteerLaborProgress(userId: string): VolunteerLaborProgress {
  const now = new Date(0);
  return {
    userId,
    volunteerHours: "0.00",
    ordinaryLaborCount: 0,
    specialLaborCount: 0,
    createdAt: now,
    updatedAt: now
  };
}
