import { and, desc, eq, ilike, isNull, lt, or, sql } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { plazaPosts } from "../../db/schema.js";
import type { CreatePlazaPostInput, PlazaListQuery, UpdatePlazaPostInput } from "./plaza.schemas.js";
import type { PlazaListResult, PlazaPostRecord, PlazaPostStatus } from "./plaza.types.js";

export type CreatePlazaPostRecordInput = CreatePlazaPostInput & {
  authorUserId: string;
  status: PlazaPostStatus;
};

export interface PlazaRepository {
  createPost(input: CreatePlazaPostRecordInput): Promise<PlazaPostRecord>;
  listPosts(filters: PlazaListQuery): Promise<PlazaListResult>;
  findPostById(id: string): Promise<PlazaPostRecord | null>;
  updatePost(id: string, input: UpdatePlazaPostInput): Promise<PlazaPostRecord | null>;
  updatePostStatus(id: string, status: PlazaPostStatus): Promise<PlazaPostRecord | null>;
  softDeletePost(id: string): Promise<boolean>;
}

function valuesForPost(input: CreatePlazaPostRecordInput | UpdatePlazaPostInput) {
  return {
    type: input.type,
    title: input.title,
    college: input.college,
    contact: input.contact,
    description: input.description,
    tags: input.tags,
    offeredCourse: input.type === "course_exchange" ? input.offeredCourse : null,
    wantedCourse: input.type === "course_exchange" ? input.wantedCourse : null,
    courseTime: input.type === "course_exchange" ? input.courseTime : null,
    teamPurpose: input.type === "team_recruit" ? input.teamPurpose : null,
    projectType: input.type === "team_recruit" ? input.projectType : null,
    teammateRequirements: input.type === "team_recruit" ? input.teammateRequirements : null,
    currentMembers: input.type === "team_recruit" ? input.currentMembers : null,
    targetMembers: input.type === "team_recruit" ? input.targetMembers : null,
    activityTime: input.type === "team_recruit" ? input.activityTime : null
  };
}

export function createPlazaRepository(db: Database): PlazaRepository {
  return {
    async createPost(input) {
      const [post] = await db
        .insert(plazaPosts)
        .values({
          ...valuesForPost(input),
          authorUserId: input.authorUserId,
          status: input.status
        })
        .returning();
      return post as PlazaPostRecord;
    },

    async listPosts(filters) {
      const conditions = [isNull(plazaPosts.deletedAt), eq(plazaPosts.status, filters.status)];
      if (filters.type) conditions.push(eq(plazaPosts.type, filters.type));
      if (filters.college) conditions.push(ilike(plazaPosts.college, `%${filters.college}%`));
      if (filters.course) {
        conditions.push(
          or(ilike(plazaPosts.offeredCourse, `%${filters.course}%`), ilike(plazaPosts.wantedCourse, `%${filters.course}%`))!
        );
      }
      if (filters.time) {
        conditions.push(
          or(ilike(plazaPosts.courseTime, `%${filters.time}%`), ilike(plazaPosts.activityTime, `%${filters.time}%`))!
        );
      }
      if (filters.tag) {
        conditions.push(sql`${plazaPosts.tags} ? ${filters.tag}`);
      }
      if (filters.keyword) {
        const pattern = `%${filters.keyword}%`;
        conditions.push(
          or(
            ilike(plazaPosts.title, pattern),
            ilike(plazaPosts.description, pattern),
            ilike(plazaPosts.contact, pattern),
            ilike(plazaPosts.offeredCourse, pattern),
            ilike(plazaPosts.wantedCourse, pattern),
            ilike(plazaPosts.courseTime, pattern),
            ilike(plazaPosts.teamPurpose, pattern),
            ilike(plazaPosts.projectType, pattern),
            ilike(plazaPosts.teammateRequirements, pattern),
            ilike(plazaPosts.activityTime, pattern)
          )!
        );
      }
      if (filters.cursor) {
        const cursorPost = await this.findPostById(filters.cursor);
        if (cursorPost) conditions.push(lt(plazaPosts.updatedAt, cursorPost.updatedAt));
      }

      const rows = await db
        .select()
        .from(plazaPosts)
        .where(and(...conditions))
        .orderBy(desc(plazaPosts.updatedAt), desc(plazaPosts.id))
        .limit(filters.limit + 1);

      const posts = rows.slice(0, filters.limit) as PlazaPostRecord[];
      const nextCursor = rows.length > filters.limit ? (posts.at(-1)?.id ?? null) : null;
      return { posts, nextCursor };
    },

    async findPostById(id) {
      const [post] = await db
        .select()
        .from(plazaPosts)
        .where(and(eq(plazaPosts.id, id), isNull(plazaPosts.deletedAt)))
        .limit(1);
      return (post as PlazaPostRecord | undefined) ?? null;
    },

    async updatePost(id, input) {
      const [post] = await db
        .update(plazaPosts)
        .set({ ...valuesForPost(input), updatedAt: new Date() })
        .where(and(eq(plazaPosts.id, id), isNull(plazaPosts.deletedAt)))
        .returning();
      return (post as PlazaPostRecord | undefined) ?? null;
    },

    async updatePostStatus(id, status) {
      const [post] = await db
        .update(plazaPosts)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(plazaPosts.id, id), isNull(plazaPosts.deletedAt)))
        .returning();
      return (post as PlazaPostRecord | undefined) ?? null;
    },

    async softDeletePost(id) {
      const [post] = await db
        .update(plazaPosts)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(plazaPosts.id, id), isNull(plazaPosts.deletedAt)))
        .returning({ id: plazaPosts.id });
      return Boolean(post);
    }
  };
}
