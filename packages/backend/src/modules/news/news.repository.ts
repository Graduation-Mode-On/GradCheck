import { and, desc, eq, gt, ilike, isNull, lt, or } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { newsItems } from "../../db/schema.js";
import type { NewsListQuery } from "./news.schemas.js";
import type { NewsItemRecord, NewsListResult } from "./news.types.js";

export interface NewsRepository {
  listItems(filters: NewsListQuery): Promise<NewsListResult>;
  findItemById(id: string): Promise<NewsItemRecord | null>;
  createItem(values: Omit<NewsItemRecord, "id" | "createdAt" | "updatedAt">): Promise<NewsItemRecord>;
}

export function createNewsRepository(db: Database): NewsRepository {
  return {
    async listItems(filters) {
      const now = new Date();
      const conditions = [
        eq(newsItems.status, "active"),
        or(gt(newsItems.endTime, now), isNull(newsItems.endTime))!
      ];

      if (filters.type) {
        conditions.push(eq(newsItems.type, filters.type));
      }
      if (filters.keyword) {
        const pattern = `%${filters.keyword}%`;
        conditions.push(
          or(
            ilike(newsItems.title, pattern),
            ilike(newsItems.organizer, pattern),
            ilike(newsItems.description, pattern)
          )!
        );
      }
      if (filters.cursor) {
        const cursorItem = await this.findItemById(filters.cursor);
        if (cursorItem) {
          conditions.push(
            or(
              lt(newsItems.updatedAt, cursorItem.updatedAt),
              and(eq(newsItems.updatedAt, cursorItem.updatedAt), lt(newsItems.id, cursorItem.id))!
            )!
          );
        }
      }

      const rows = await db
        .select()
        .from(newsItems)
        .where(and(...conditions))
        .orderBy(desc(newsItems.updatedAt), desc(newsItems.id))
        .limit(filters.limit + 1);

      const items = rows.slice(0, filters.limit) as NewsItemRecord[];
      const nextCursor = rows.length > filters.limit ? (items.at(-1)?.id ?? null) : null;
      return { items, nextCursor };
    },

    async findItemById(id) {
      const [item] = await db.select().from(newsItems).where(eq(newsItems.id, id)).limit(1);
      return (item as NewsItemRecord | undefined) ?? null;
    },

    async createItem(values) {
      const [item] = await db
        .insert(newsItems)
        .values({
          title: values.title,
          type: values.type,
          organizer: values.organizer,
          location: values.location,
          startTime: values.startTime,
          endTime: values.endTime,
          registrationUrl: values.registrationUrl,
          targetAudience: values.targetAudience,
          creditCategory: values.creditCategory,
          description: values.description,
          sourceUrl: values.sourceUrl,
          sourceName: values.sourceName,
          dataQuality: values.dataQuality,
          status: values.status,
          scrapedAt: values.scrapedAt
        })
        .returning();
      return item as NewsItemRecord;
    }
  };
}
