import { eq } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { lecturePracticeProgress } from "../../db/schema.js";
import type { LecturePracticeProgress, LecturePracticeProgressInput } from "./lecture-practice.schemas.js";
import { defaultLecturePracticeProgress } from "./lecture-practice.schemas.js";

export interface LecturePracticeRepository {
  getProgress(userId: string): Promise<LecturePracticeProgress>;
  upsertProgress(userId: string, input: LecturePracticeProgressInput): Promise<LecturePracticeProgress>;
}

export function createLecturePracticeRepository(db: Database): LecturePracticeRepository {
  return {
    async getProgress(userId) {
      const [progress] = await db
        .select()
        .from(lecturePracticeProgress)
        .where(eq(lecturePracticeProgress.userId, userId))
        .limit(1);
      return (progress as LecturePracticeProgress | undefined) ?? defaultLecturePracticeProgress(userId);
    },

    async upsertProgress(userId, input) {
      const [progress] = await db
        .insert(lecturePracticeProgress)
        .values({ userId, ...input })
        .onConflictDoUpdate({
          target: lecturePracticeProgress.userId,
          set: { ...input, updatedAt: new Date() }
        })
        .returning();
      return progress as LecturePracticeProgress;
    }
  };
}
