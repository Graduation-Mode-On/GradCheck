import { eq } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { userProfiles } from "../../db/schema.js";
import type { PushplusTokenResolver } from "./reminder-scheduler.js";

export function createPushplusTokenResolver(db: Database): PushplusTokenResolver {
  return {
    async getPushplusToken(userId: string): Promise<string | null> {
      const [row] = await db
        .select({ pushplusToken: userProfiles.pushplusToken })
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1);
      return row?.pushplusToken ?? null;
    }
  };
}
