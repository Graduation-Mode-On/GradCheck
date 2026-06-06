import { eq } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { volunteerLaborProgress } from "../../db/schema.js";
import type { VolunteerLaborProgress, VolunteerLaborProgressInput } from "./volunteer-labor.schemas.js";
import { defaultVolunteerLaborProgress } from "./volunteer-labor.schemas.js";

export interface VolunteerLaborRepository {
  getProgress(userId: string): Promise<VolunteerLaborProgress>;
  upsertProgress(userId: string, input: VolunteerLaborProgressInput): Promise<VolunteerLaborProgress>;
}

export function createVolunteerLaborRepository(db: Database): VolunteerLaborRepository {
  return {
    async getProgress(userId) {
      const [progress] = await db
        .select()
        .from(volunteerLaborProgress)
        .where(eq(volunteerLaborProgress.userId, userId))
        .limit(1);
      return (progress as VolunteerLaborProgress | undefined) ?? defaultVolunteerLaborProgress(userId);
    },

    async upsertProgress(userId, input) {
      const [progress] = await db
        .insert(volunteerLaborProgress)
        .values({ userId, ...input })
        .onConflictDoUpdate({
          target: volunteerLaborProgress.userId,
          set: { ...input, updatedAt: new Date() }
        })
        .returning();
      return progress as VolunteerLaborProgress;
    }
  };
}
