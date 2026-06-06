import { z } from "zod";

export const volunteerLaborProgressSchema = z.object({
  volunteerHours: z.string().regex(/^\d+(\.\d{1,2})?$/, "请输入非负小时数，最多两位小数"),
  ordinaryLaborCount: z.coerce.number().int().min(0, "次数不能小于 0"),
  specialLaborCount: z.coerce.number().int().min(0, "次数不能小于 0")
});

export type VolunteerLaborProgressInput = z.infer<typeof volunteerLaborProgressSchema>;

export interface VolunteerLaborProgress extends VolunteerLaborProgressInput {
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export function volunteerLaborCompleted(progress: VolunteerLaborProgressInput): boolean {
  return Number(progress.volunteerHours) >= 12 && progress.ordinaryLaborCount >= 2 && progress.specialLaborCount >= 1;
}
