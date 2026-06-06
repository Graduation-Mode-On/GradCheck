import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { srtpRecords } from "../../db/schema.js";
import type { SrtpRecord, SrtpRecordInput } from "./srtp.schemas.js";

export interface SrtpRepository {
  listRecords(userId: string): Promise<SrtpRecord[]>;
  createRecord(userId: string, input: SrtpRecordInput): Promise<SrtpRecord>;
  updateRecord(userId: string, id: string, input: SrtpRecordInput): Promise<SrtpRecord | null>;
  deleteRecord(userId: string, id: string): Promise<boolean>;
}

export function createSrtpRepository(db: Database): SrtpRepository {
  return {
    async listRecords(userId) {
      const records = await db
        .select()
        .from(srtpRecords)
        .where(eq(srtpRecords.userId, userId))
        .orderBy(desc(srtpRecords.updatedAt), desc(srtpRecords.id));
      return records as SrtpRecord[];
    },

    async createRecord(userId, input) {
      const [record] = await db.insert(srtpRecords).values({ userId, ...input }).returning();
      return record as SrtpRecord;
    },

    async updateRecord(userId, id, input) {
      const [record] = await db
        .update(srtpRecords)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(srtpRecords.userId, userId), eq(srtpRecords.id, id)))
        .returning();
      return (record as SrtpRecord | undefined) ?? null;
    },

    async deleteRecord(userId, id) {
      const [record] = await db
        .delete(srtpRecords)
        .where(and(eq(srtpRecords.userId, userId), eq(srtpRecords.id, id)))
        .returning({ id: srtpRecords.id });
      return Boolean(record);
    }
  };
}

