import { eq } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { sportsProgress } from "../../db/schema.js";
import type { SportsProgress, SportsProgressInput } from "./sports.schemas.js";
import { defaultSportsProgress } from "./sports.schemas.js";

export interface SportsRepository {
  getProgress(userId: string): Promise<SportsProgress>;
  upsertProgress(userId: string, input: SportsProgressInput): Promise<SportsProgress>;
}

export function createSportsRepository(db: Database): SportsRepository {
  return {
    async getProgress(userId) {
      const [progress] = await db.select().from(sportsProgress).where(eq(sportsProgress.userId, userId)).limit(1);
      return (progress as SportsProgress | undefined) ?? defaultSportsProgress(userId);
    },

    async upsertProgress(userId, input) {
      const [progress] = await db
        .insert(sportsProgress)
        .values({ userId, ...input })
        .onConflictDoUpdate({
          target: sportsProgress.userId,
          set: { ...input, updatedAt: new Date() }
        })
        .returning();
      return progress as SportsProgress;
    }
  };
}
