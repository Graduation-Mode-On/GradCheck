# Plaza Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a logged-in, persistent plaza page for course exchange and team recruiting posts.

**Architecture:** Add a backend plaza module with a single typed `plaza_posts` table, authenticated CRUD/status/soft-delete APIs, and cursor pagination. Replace the frontend plaza placeholder with a mobile-first list page using TanStack Query infinite loading, modal create/edit forms, filters, and owner-only actions.

**Tech Stack:** Vue 3, Vue Router, TanStack Vue Query, Tailwind CSS, Zod, Express 5, Drizzle ORM, PostgreSQL, Vitest, Supertest, Vue Test Utils.

---

## File Structure

- Modify `packages/backend/src/db/schema.ts`: add `plazaPosts` table.
- Create `packages/backend/src/modules/plaza/plaza.types.ts`: shared backend plaza types.
- Create `packages/backend/src/modules/plaza/plaza.schemas.ts`: request and query validation.
- Create `packages/backend/src/modules/plaza/plaza.repository.ts`: Drizzle-backed post persistence.
- Create `packages/backend/src/modules/plaza/plaza.service.ts`: ownership, lifecycle, and response mapping rules.
- Create `packages/backend/src/modules/plaza/plaza.routes.ts`: Express route handlers.
- Modify `packages/backend/src/app.ts`: accept and mount plaza repository.
- Modify `packages/backend/src/index.ts`: create and inject plaza repository.
- Modify `packages/backend/src/app.test.ts`: add in-memory plaza repository and API behavior tests.
- Create `packages/web/src/schemas/plaza.ts`: frontend schemas, types, helpers.
- Modify `packages/web/src/lib/api.ts`: add plaza API client functions.
- Create `packages/web/src/components/PlazaFilters.vue`: list search/filter controls.
- Create `packages/web/src/components/PlazaPostCard.vue`: expandable post card with owner actions.
- Create `packages/web/src/components/PlazaPostForm.vue`: create/edit modal form.
- Modify `packages/web/src/pages/PlazaPage.vue`: route guard, infinite list, modal orchestration.
- Create `packages/web/src/pages/PlazaPage.test.ts`: frontend behavior tests.

---

### Task 1: Backend Plaza API Contract Tests

**Files:**
- Modify: `packages/backend/src/app.test.ts`

- [ ] **Step 1: Add failing API tests and in-memory repository shape**

Append plaza tests to `packages/backend/src/app.test.ts`. The tests intentionally reference `PlazaRepository` and `createApp({ plazaRepository })` before implementation exists.

```ts
interface TestPlazaPost {
  id: string;
  authorUserId: string;
  type: "course_exchange" | "team_recruit";
  title: string;
  college: string;
  contact: string;
  description: string;
  tags: string[];
  status: "open" | "closed";
  offeredCourse: string | null;
  wantedCourse: string | null;
  courseTime: string | null;
  teamPurpose: string | null;
  projectType: string | null;
  teammateRequirements: string | null;
  currentMembers: number | null;
  targetMembers: number | null;
  activityTime: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

function createPlazaRepository() {
  const posts = new Map<string, TestPlazaPost>();

  return {
    async createPost(input: Omit<TestPlazaPost, "id" | "createdAt" | "updatedAt" | "deletedAt">) {
      const post: TestPlazaPost = {
        ...input,
        id: `post-${posts.size + 1}`,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      };
      posts.set(post.id, post);
      return post;
    },
    async listPosts(filters: {
      type?: "course_exchange" | "team_recruit";
      status?: "open" | "closed";
      course?: string;
      college?: string;
      time?: string;
      tag?: string;
      keyword?: string;
      cursor?: string;
      limit: number;
    }) {
      const normalized = (value: string | null) => value?.toLowerCase() ?? "";
      let visible = [...posts.values()].filter((post) => !post.deletedAt);
      visible = visible.filter((post) => post.status === (filters.status ?? "open"));
      if (filters.type) visible = visible.filter((post) => post.type === filters.type);
      if (filters.college) visible = visible.filter((post) => post.college.includes(filters.college ?? ""));
      if (filters.tag) visible = visible.filter((post) => post.tags.includes(filters.tag ?? ""));
      if (filters.course) {
        visible = visible.filter(
          (post) =>
            normalized(post.offeredCourse).includes(filters.course?.toLowerCase() ?? "") ||
            normalized(post.wantedCourse).includes(filters.course?.toLowerCase() ?? "")
        );
      }
      if (filters.time) {
        visible = visible.filter(
          (post) =>
            normalized(post.courseTime).includes(filters.time?.toLowerCase() ?? "") ||
            normalized(post.activityTime).includes(filters.time?.toLowerCase() ?? "")
        );
      }
      if (filters.keyword) {
        const keyword = filters.keyword.toLowerCase();
        visible = visible.filter((post) =>
          [
            post.title,
            post.description,
            post.contact,
            post.offeredCourse,
            post.wantedCourse,
            post.courseTime,
            post.teamPurpose,
            post.projectType,
            post.teammateRequirements,
            post.activityTime
          ].some((value) => normalized(value).includes(keyword))
        );
      }
      visible.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.id.localeCompare(a.id));
      const start = filters.cursor ? visible.findIndex((post) => post.id === filters.cursor) + 1 : 0;
      const page = visible.slice(start, start + filters.limit);
      const nextCursor = visible[start + filters.limit]?.id ?? null;
      return { posts: page, nextCursor };
    },
    async findPostById(id: string) {
      const post = posts.get(id);
      return post && !post.deletedAt ? post : null;
    },
    async updatePost(id: string, input: Partial<TestPlazaPost>) {
      const existing = posts.get(id);
      if (!existing || existing.deletedAt) return null;
      const post = { ...existing, ...input, updatedAt: now };
      posts.set(id, post);
      return post;
    },
    async softDeletePost(id: string) {
      const existing = posts.get(id);
      if (!existing || existing.deletedAt) return false;
      posts.set(id, { ...existing, deletedAt: now, updatedAt: now });
      return true;
    }
  };
}

async function registerAndToken(app: ReturnType<typeof createApp>, email: string) {
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      email,
      password: "password123",
      profile: {
        displayName: email.split("@")[0],
        college: "计算机科学与工程学院",
        major: "软件工程",
        grade: 2022,
        gpaGoal: "3.70"
      }
    });
  return response.body.token as string;
}

describe("plaza API", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", "test-secret-that-is-long-enough");
  });

  it("creates and lists course exchange posts for authenticated users", async () => {
    const app = createApp({ authRepository: createRepository(), plazaRepository: createPlazaRepository() });
    const token = await registerAndToken(app, "owner@example.com");

    const createResponse = await request(app)
      .post("/api/plaza/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "course_exchange",
        title: "想换软件工程实践课",
        college: "计算机科学与工程学院",
        contact: "QQ 123456",
        description: "时间冲突，想换同课程其他班。",
        tags: ["换课", "软件工程"],
        offeredCourse: "软件工程实践 周一 1-2 节",
        wantedCourse: "软件工程实践 周三 3-4 节",
        courseTime: "周一 1-2 节"
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.post).toMatchObject({
      type: "course_exchange",
      title: "想换软件工程实践课",
      status: "open",
      authorDisplayName: "owner",
      offeredCourse: "软件工程实践 周一 1-2 节",
      wantedCourse: "软件工程实践 周三 3-4 节"
    });

    const listResponse = await request(app)
      .get("/api/plaza/posts?type=course_exchange&course=软件工程&tag=换课")
      .set("Authorization", `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.posts).toHaveLength(1);
    expect(listResponse.body.nextCursor).toBeNull();
  });

  it("creates team recruiting posts and rejects invalid member counts", async () => {
    const app = createApp({ authRepository: createRepository(), plazaRepository: createPlazaRepository() });
    const token = await registerAndToken(app, "leader@example.com");

    const invalidResponse = await request(app)
      .post("/api/plaza/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "team_recruit",
        title: "数学建模组队",
        college: "计算机科学与工程学院",
        contact: "微信 gradcheck",
        description: "准备参加数学建模。",
        tags: ["竞赛"],
        teamPurpose: "数学建模竞赛",
        projectType: "竞赛",
        teammateRequirements: "会 Python 或建模",
        currentMembers: 4,
        targetMembers: 3,
        activityTime: "暑假"
      });

    expect(invalidResponse.status).toBe(400);

    const createResponse = await request(app)
      .post("/api/plaza/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "team_recruit",
        title: "数学建模组队",
        college: "计算机科学与工程学院",
        contact: "微信 gradcheck",
        description: "准备参加数学建模。",
        tags: ["竞赛"],
        teamPurpose: "数学建模竞赛",
        projectType: "竞赛",
        teammateRequirements: "会 Python 或建模",
        currentMembers: 2,
        targetMembers: 3,
        activityTime: "暑假"
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.post).toMatchObject({
      type: "team_recruit",
      currentMembers: 2,
      targetMembers: 3,
      authorDisplayName: "leader"
    });
  });

  it("allows only the author to edit, close, reopen, and soft-delete posts", async () => {
    const app = createApp({ authRepository: createRepository(), plazaRepository: createPlazaRepository() });
    const ownerToken = await registerAndToken(app, "post-owner@example.com");
    const otherToken = await registerAndToken(app, "other@example.com");

    const createResponse = await request(app)
      .post("/api/plaza/posts")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        type: "course_exchange",
        title: "换高数习题课",
        college: "数学学院",
        contact: "QQ 8888",
        description: "想换到晚上。",
        tags: ["高数"],
        offeredCourse: "高数习题 周二 1-2 节",
        wantedCourse: "高数习题 周四 9-10 节",
        courseTime: "周二 1-2 节"
      });
    const postId = createResponse.body.post.id as string;

    await request(app)
      .put(`/api/plaza/posts/${postId}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ title: "别人改标题" })
      .expect(403);

    const closeResponse = await request(app)
      .patch(`/api/plaza/posts/${postId}/status`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "closed" });
    expect(closeResponse.status).toBe(200);
    expect(closeResponse.body.post.status).toBe("closed");

    const reopenResponse = await request(app)
      .patch(`/api/plaza/posts/${postId}/status`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "open" });
    expect(reopenResponse.status).toBe(200);
    expect(reopenResponse.body.post.status).toBe("open");

    await request(app).delete(`/api/plaza/posts/${postId}`).set("Authorization", `Bearer ${ownerToken}`).expect(200);

    const listResponse = await request(app).get("/api/plaza/posts").set("Authorization", `Bearer ${ownerToken}`);
    expect(listResponse.body.posts).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run backend tests to verify RED**

Run:

```bash
cd /Users/river/Documents/Projects/GradCheck/.worktrees/plaza-page
pnpm --filter @gradcheck/backend test
```

Expected: FAIL because `createApp` does not accept `plazaRepository` and `/api/plaza/posts` does not exist.

- [ ] **Step 3: Commit only after GREEN in Task 4**

Do not commit this test-only RED state.

---

### Task 2: Backend Schema, Validation, and Types

**Files:**
- Modify: `packages/backend/src/db/schema.ts`
- Create: `packages/backend/src/modules/plaza/plaza.types.ts`
- Create: `packages/backend/src/modules/plaza/plaza.schemas.ts`

- [ ] **Step 1: Add `plazaPosts` table**

Add imports and table definition in `packages/backend/src/db/schema.ts`:

```ts
export const plazaPosts = pgTable("plaza_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  authorUserId: uuid("author_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 32 }).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  college: varchar("college", { length: 120 }).notNull(),
  contact: varchar("contact", { length: 200 }).notNull(),
  description: text("description").notNull(),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  status: varchar("status", { length: 32 }).notNull().default("open"),
  offeredCourse: varchar("offered_course", { length: 160 }),
  wantedCourse: varchar("wanted_course", { length: 160 }),
  courseTime: varchar("course_time", { length: 160 }),
  teamPurpose: varchar("team_purpose", { length: 160 }),
  projectType: varchar("project_type", { length: 120 }),
  teammateRequirements: text("teammate_requirements"),
  currentMembers: integer("current_members"),
  targetMembers: integer("target_members"),
  activityTime: varchar("activity_time", { length: 160 }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
```

- [ ] **Step 2: Add backend plaza types**

Create `packages/backend/src/modules/plaza/plaza.types.ts`:

```ts
export type PlazaPostType = "course_exchange" | "team_recruit";
export type PlazaPostStatus = "open" | "closed";

export interface PlazaPostRecord {
  id: string;
  authorUserId: string;
  type: PlazaPostType;
  title: string;
  college: string;
  contact: string;
  description: string;
  tags: string[];
  status: PlazaPostStatus;
  offeredCourse: string | null;
  wantedCourse: string | null;
  courseTime: string | null;
  teamPurpose: string | null;
  projectType: string | null;
  teammateRequirements: string | null;
  currentMembers: number | null;
  targetMembers: number | null;
  activityTime: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface PlazaPostResponse extends Omit<PlazaPostRecord, "authorUserId"> {
  authorDisplayName: string;
  isOwner: boolean;
}

export interface PlazaListResult {
  posts: PlazaPostRecord[];
  nextCursor: string | null;
}
```

- [ ] **Step 3: Add backend Zod schemas**

Create `packages/backend/src/modules/plaza/plaza.schemas.ts`:

```ts
import { z } from "zod";

export const plazaPostTypeSchema = z.enum(["course_exchange", "team_recruit"]);
export const plazaPostStatusSchema = z.enum(["open", "closed"]);

const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(8).default([]);

const basePostSchema = z.object({
  title: z.string().trim().min(1).max(120),
  college: z.string().trim().min(1).max(120),
  contact: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  tags: tagsSchema
});

export const createPlazaPostSchema = z.discriminatedUnion("type", [
  basePostSchema.extend({
    type: z.literal("course_exchange"),
    offeredCourse: z.string().trim().min(1).max(160),
    wantedCourse: z.string().trim().min(1).max(160),
    courseTime: z.string().trim().min(1).max(160)
  }),
  basePostSchema
    .extend({
      type: z.literal("team_recruit"),
      teamPurpose: z.string().trim().min(1).max(160),
      projectType: z.string().trim().min(1).max(120),
      teammateRequirements: z.string().trim().min(1).max(2000),
      currentMembers: z.coerce.number().int().min(1).max(99),
      targetMembers: z.coerce.number().int().min(1).max(99),
      activityTime: z.string().trim().min(1).max(160)
    })
    .refine((input) => input.currentMembers <= input.targetMembers, {
      message: "Current members cannot exceed target members",
      path: ["currentMembers"]
    })
]);

export const updatePlazaPostSchema = createPlazaPostSchema;

export const updatePlazaPostStatusSchema = z.object({
  status: plazaPostStatusSchema
});

export const plazaListQuerySchema = z.object({
  type: plazaPostTypeSchema.optional(),
  status: plazaPostStatusSchema.default("open"),
  course: z.string().trim().min(1).max(160).optional(),
  college: z.string().trim().min(1).max(120).optional(),
  time: z.string().trim().min(1).max(160).optional(),
  tag: z.string().trim().min(1).max(40).optional(),
  keyword: z.string().trim().min(1).max(160).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export type CreatePlazaPostInput = z.infer<typeof createPlazaPostSchema>;
export type UpdatePlazaPostInput = z.infer<typeof updatePlazaPostSchema>;
export type PlazaListQuery = z.infer<typeof plazaListQuerySchema>;
export type UpdatePlazaPostStatusInput = z.infer<typeof updatePlazaPostStatusSchema>;
```

- [ ] **Step 4: Run typecheck to catch schema/table mistakes**

Run:

```bash
pnpm --filter @gradcheck/backend typecheck
```

Expected: still FAIL until repository/routes exist if tests import missing symbols, but schema files should not produce syntax errors.

---

### Task 3: Backend Repository and Service

**Files:**
- Create: `packages/backend/src/modules/plaza/plaza.repository.ts`
- Create: `packages/backend/src/modules/plaza/plaza.service.ts`

- [ ] **Step 1: Implement `PlazaRepository`**

Create `packages/backend/src/modules/plaza/plaza.repository.ts`:

```ts
import { and, desc, eq, ilike, isNull, lt, or, sql } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { plazaPosts } from "../../db/schema.js";
import type { CreatePlazaPostInput, PlazaListQuery, UpdatePlazaPostInput } from "./plaza.schemas.js";
import type { PlazaListResult, PlazaPostRecord, PlazaPostStatus } from "./plaza.types.js";

export interface CreatePlazaPostRecordInput extends Omit<CreatePlazaPostInput, "type"> {
  authorUserId: string;
  type: CreatePlazaPostInput["type"];
  status: PlazaPostStatus;
}

export interface PlazaRepository {
  createPost(input: CreatePlazaPostRecordInput): Promise<PlazaPostRecord>;
  listPosts(filters: PlazaListQuery): Promise<PlazaListResult>;
  findPostById(id: string): Promise<PlazaPostRecord | null>;
  updatePost(id: string, input: UpdatePlazaPostInput): Promise<PlazaPostRecord | null>;
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
      const nextCursor = rows.length > filters.limit ? posts.at(-1)?.id ?? null : null;
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
```

- [ ] **Step 2: Implement plaza service**

Create `packages/backend/src/modules/plaza/plaza.service.ts`:

```ts
import { HttpError } from "../../lib/http-error.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type {
  CreatePlazaPostInput,
  PlazaListQuery,
  UpdatePlazaPostInput,
  UpdatePlazaPostStatusInput
} from "./plaza.schemas.js";
import type { PlazaRepository } from "./plaza.repository.js";
import type { PlazaPostRecord, PlazaPostResponse } from "./plaza.types.js";

async function toResponse(
  authRepository: AuthRepository,
  currentUserId: string,
  post: PlazaPostRecord
): Promise<PlazaPostResponse> {
  const profile = await authRepository.getProfile(post.authorUserId);
  return {
    ...post,
    authorDisplayName: profile?.displayName ?? "GradCheck 用户",
    isOwner: post.authorUserId === currentUserId
  };
}

async function requireOwnedPost(repository: PlazaRepository, userId: string, postId: string) {
  const post = await repository.findPostById(postId);
  if (!post) {
    throw new HttpError(404, "Plaza post not found");
  }
  if (post.authorUserId !== userId) {
    throw new HttpError(403, "You can only manage your own plaza posts");
  }
  return post;
}

export async function listPlazaPosts(
  authRepository: AuthRepository,
  plazaRepository: PlazaRepository,
  userId: string,
  query: PlazaListQuery
) {
  const result = await plazaRepository.listPosts(query);
  return {
    posts: await Promise.all(result.posts.map((post) => toResponse(authRepository, userId, post))),
    nextCursor: result.nextCursor
  };
}

export async function createPlazaPost(
  authRepository: AuthRepository,
  plazaRepository: PlazaRepository,
  userId: string,
  input: CreatePlazaPostInput
) {
  const post = await plazaRepository.createPost({ ...input, authorUserId: userId, status: "open" });
  await authRepository.recordAuditLog({
    actorUserId: userId,
    action: "plaza.post.create",
    entityType: "plaza_post",
    entityId: post.id
  });
  return toResponse(authRepository, userId, post);
}

export async function updatePlazaPost(
  authRepository: AuthRepository,
  plazaRepository: PlazaRepository,
  userId: string,
  postId: string,
  input: UpdatePlazaPostInput
) {
  await requireOwnedPost(plazaRepository, userId, postId);
  const post = await plazaRepository.updatePost(postId, input);
  if (!post) throw new HttpError(404, "Plaza post not found");
  await authRepository.recordAuditLog({
    actorUserId: userId,
    action: "plaza.post.update",
    entityType: "plaza_post",
    entityId: post.id
  });
  return toResponse(authRepository, userId, post);
}

export async function updatePlazaPostStatus(
  authRepository: AuthRepository,
  plazaRepository: PlazaRepository,
  userId: string,
  postId: string,
  input: UpdatePlazaPostStatusInput
) {
  await requireOwnedPost(plazaRepository, userId, postId);
  const post = await plazaRepository.updatePost(postId, { ...(await plazaRepository.findPostById(postId))!, status: input.status });
  if (!post) throw new HttpError(404, "Plaza post not found");
  await authRepository.recordAuditLog({
    actorUserId: userId,
    action: "plaza.post.status.update",
    entityType: "plaza_post",
    entityId: post.id,
    metadata: { status: input.status }
  });
  return toResponse(authRepository, userId, post);
}

export async function deletePlazaPost(
  authRepository: AuthRepository,
  plazaRepository: PlazaRepository,
  userId: string,
  postId: string
) {
  await requireOwnedPost(plazaRepository, userId, postId);
  await plazaRepository.softDeletePost(postId);
  await authRepository.recordAuditLog({
    actorUserId: userId,
    action: "plaza.post.delete",
    entityType: "plaza_post",
    entityId: postId
  });
}
```

- [ ] **Step 3: Refactor status update repository method if typecheck complains**

If TypeScript rejects reusing full record input in `updatePlazaPostStatus`, add this method to `PlazaRepository` instead:

```ts
updatePostStatus(id: string, status: PlazaPostStatus): Promise<PlazaPostRecord | null>;
```

Implement it with:

```ts
async updatePostStatus(id, status) {
  const [post] = await db
    .update(plazaPosts)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(plazaPosts.id, id), isNull(plazaPosts.deletedAt)))
    .returning();
  return (post as PlazaPostRecord | undefined) ?? null;
}
```

Then call `plazaRepository.updatePostStatus(postId, input.status)` in the service.

---

### Task 4: Backend Routes and App Wiring

**Files:**
- Create: `packages/backend/src/modules/plaza/plaza.routes.ts`
- Modify: `packages/backend/src/app.ts`
- Modify: `packages/backend/src/index.ts`
- Modify: `packages/backend/src/app.test.ts`

- [ ] **Step 1: Create routes**

Create `packages/backend/src/modules/plaza/plaza.routes.ts`:

```ts
import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import {
  createPlazaPostSchema,
  plazaListQuerySchema,
  updatePlazaPostSchema,
  updatePlazaPostStatusSchema
} from "./plaza.schemas.js";
import type { PlazaRepository } from "./plaza.repository.js";
import {
  createPlazaPost,
  deletePlazaPost,
  listPlazaPosts,
  updatePlazaPost,
  updatePlazaPostStatus
} from "./plaza.service.js";

export function createPlazaRouter(authRepository: AuthRepository, plazaRepository: PlazaRepository): Router {
  const router = Router();
  router.use(authenticate(authRepository));

  router.get("/", async (req, res, next) => {
    try {
      const result = await listPlazaPosts(
        authRepository,
        plazaRepository,
        req.userId ?? "",
        plazaListQuerySchema.parse(req.query)
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const post = await createPlazaPost(
        authRepository,
        plazaRepository,
        req.userId ?? "",
        createPlazaPostSchema.parse(req.body)
      );
      res.status(201).json({ post });
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id", async (req, res, next) => {
    try {
      const post = await updatePlazaPost(
        authRepository,
        plazaRepository,
        req.userId ?? "",
        req.params.id,
        updatePlazaPostSchema.parse(req.body)
      );
      res.json({ post });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/status", async (req, res, next) => {
    try {
      const post = await updatePlazaPostStatus(
        authRepository,
        plazaRepository,
        req.userId ?? "",
        req.params.id,
        updatePlazaPostStatusSchema.parse(req.body)
      );
      res.json({ post });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      await deletePlazaPost(authRepository, plazaRepository, req.userId ?? "", req.params.id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
```

- [ ] **Step 2: Wire app dependencies**

Modify `packages/backend/src/app.ts`:

```ts
import type { PlazaRepository } from "./modules/plaza/plaza.repository.js";
import { createPlazaRouter } from "./modules/plaza/plaza.routes.js";

export interface AppDependencies {
  authRepository: AuthRepository;
  plazaRepository: PlazaRepository;
  corsOrigin?: string;
}

app.use("/api/plaza/posts", createPlazaRouter(dependencies.authRepository, dependencies.plazaRepository));
```

- [ ] **Step 3: Wire runtime repository**

Modify `packages/backend/src/index.ts`:

```ts
import { createPlazaRepository } from "./modules/plaza/plaza.repository.js";

const app = createApp({
  authRepository: createAuthRepository(db),
  plazaRepository: createPlazaRepository(db),
  corsOrigin: config.CORS_ORIGIN
});
```

- [ ] **Step 4: Update existing backend tests to pass plaza dependency**

In every existing `createApp({ authRepository: createRepository() })` call in `packages/backend/src/app.test.ts`, add `plazaRepository: createPlazaRepository()`.

- [ ] **Step 5: Run backend tests to verify GREEN**

Run:

```bash
pnpm --filter @gradcheck/backend test
```

Expected: PASS.

- [ ] **Step 6: Commit backend API**

Run:

```bash
git add packages/backend/src
git commit -m "feat: add plaza post API"
```

---

### Task 5: Frontend Plaza Schemas and API Client

**Files:**
- Create: `packages/web/src/schemas/plaza.ts`
- Modify: `packages/web/src/lib/api.ts`

- [ ] **Step 1: Add failing frontend API/schema test through page test skeleton**

Create `packages/web/src/pages/PlazaPage.test.ts` with one RED test that imports the future page and expects plaza UI:

```ts
import { VueQueryPlugin } from "@tanstack/vue-query";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PlazaPage from "./PlazaPage.vue";

const push = vi.fn();
const replace = vi.fn();

vi.mock("vue-router", () => ({
  useRouter: () => ({ push, replace }),
  RouterLink: { template: "<a><slot /></a>" }
}));

describe("PlazaPage", () => {
  beforeEach(() => {
    localStorage.clear();
    push.mockClear();
    replace.mockClear();
    vi.restoreAllMocks();
  });

  it("redirects unauthenticated users to login", () => {
    mount(PlazaPage, { global: { plugins: [VueQueryPlugin] } });

    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("renders list-first plaza controls for authenticated users", async () => {
    localStorage.setItem("gradcheck.token", "token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ posts: [], nextCursor: null })
      }))
    );

    const wrapper = mount(PlazaPage, { global: { plugins: [VueQueryPlugin] } });

    expect(wrapper.get('[data-testid="plaza-page"]').text()).toContain("广场");
    expect(wrapper.get('[data-testid="plaza-create-button"]').text()).toContain("发布");
    expect(wrapper.get('[data-testid="plaza-search-input"]').exists()).toBe(true);
  });
});
```

- [ ] **Step 2: Run frontend test to verify RED**

Run:

```bash
pnpm --filter @gradcheck/web test -- PlazaPage.test.ts
```

Expected: FAIL because the existing placeholder does not render the expected controls.

- [ ] **Step 3: Add frontend plaza schemas and helpers**

Create `packages/web/src/schemas/plaza.ts`:

```ts
import { z } from "zod";

export const plazaPostTypeSchema = z.enum(["course_exchange", "team_recruit"]);
export const plazaPostStatusSchema = z.enum(["open", "closed"]);

export const plazaTagsFromText = (value: string) =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);

const basePostSchema = z.object({
  title: z.string().trim().min(1, "请输入标题").max(120),
  college: z.string().trim().min(1, "请输入学院").max(120),
  contact: z.string().trim().min(1, "请输入联系方式").max(200),
  description: z.string().trim().min(1, "请输入说明").max(2000),
  tags: z.array(z.string().min(1).max(40)).max(8)
});

export const plazaPostInputSchema = z.discriminatedUnion("type", [
  basePostSchema.extend({
    type: z.literal("course_exchange"),
    offeredCourse: z.string().trim().min(1, "请输入换出课程").max(160),
    wantedCourse: z.string().trim().min(1, "请输入期望换入课程").max(160),
    courseTime: z.string().trim().min(1, "请输入课程时间").max(160)
  }),
  basePostSchema
    .extend({
      type: z.literal("team_recruit"),
      teamPurpose: z.string().trim().min(1, "请输入组队目的").max(160),
      projectType: z.string().trim().min(1, "请输入项目类型").max(120),
      teammateRequirements: z.string().trim().min(1, "请输入队友要求").max(2000),
      currentMembers: z.coerce.number().int().min(1, "当前人数至少为 1").max(99),
      targetMembers: z.coerce.number().int().min(1, "目标人数至少为 1").max(99),
      activityTime: z.string().trim().min(1, "请输入时间信息").max(160)
    })
    .refine((input) => input.currentMembers <= input.targetMembers, {
      message: "当前人数不能超过目标人数",
      path: ["currentMembers"]
    })
]);

export type PlazaPostInput = z.infer<typeof plazaPostInputSchema>;
export type PlazaPostType = z.infer<typeof plazaPostTypeSchema>;
export type PlazaPostStatus = z.infer<typeof plazaPostStatusSchema>;

export interface PlazaPost extends PlazaPostInput {
  id: string;
  authorDisplayName: string;
  isOwner: boolean;
  status: PlazaPostStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface PlazaPostFilters {
  type?: PlazaPostType;
  status?: PlazaPostStatus;
  course?: string;
  college?: string;
  time?: string;
  tag?: string;
  keyword?: string;
}
```

- [ ] **Step 4: Add API client functions**

Modify `packages/web/src/lib/api.ts`:

```ts
import type { PlazaPost, PlazaPostFilters, PlazaPostInput, PlazaPostStatus } from "../schemas/plaza";

function toQueryString(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

export async function listPlazaPosts(
  filters: PlazaPostFilters & { cursor?: string; limit?: number }
): Promise<{ posts: PlazaPost[]; nextCursor: string | null }> {
  return request<{ posts: PlazaPost[]; nextCursor: string | null }>(
    `/api/plaza/posts${toQueryString({ ...filters, limit: filters.limit ?? 20 })}`
  );
}

export async function createPlazaPost(input: PlazaPostInput): Promise<{ post: PlazaPost }> {
  return request<{ post: PlazaPost }>("/api/plaza/posts", { method: "POST", body: JSON.stringify(input) });
}

export async function updatePlazaPost(id: string, input: PlazaPostInput): Promise<{ post: PlazaPost }> {
  return request<{ post: PlazaPost }>(`/api/plaza/posts/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export async function updatePlazaPostStatus(id: string, status: PlazaPostStatus): Promise<{ post: PlazaPost }> {
  return request<{ post: PlazaPost }>(`/api/plaza/posts/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export async function deletePlazaPost(id: string): Promise<{ success: true }> {
  return request<{ success: true }>(`/api/plaza/posts/${id}`, { method: "DELETE" });
}
```

---

### Task 6: Frontend Components and Page

**Files:**
- Create: `packages/web/src/components/PlazaFilters.vue`
- Create: `packages/web/src/components/PlazaPostCard.vue`
- Create: `packages/web/src/components/PlazaPostForm.vue`
- Modify: `packages/web/src/pages/PlazaPage.vue`
- Modify: `packages/web/src/pages/PlazaPage.test.ts`

- [ ] **Step 1: Implement filters component**

Create `packages/web/src/components/PlazaFilters.vue` with `v-model` props for `keyword`, `course`, `college`, `time`, `tag`, and `status`. Include inputs with data test IDs `plaza-search-input`, `plaza-course-filter`, `plaza-college-filter`, `plaza-time-filter`, `plaza-tag-filter`, and `plaza-status-filter`.

- [ ] **Step 2: Implement post card component**

Create `packages/web/src/components/PlazaPostCard.vue`. Props: `post: PlazaPost`. Emits: `edit`, `status`, `delete`. Render type badge, status badge, title, author display name, tags, summary, expandable details, and owner controls when `post.isOwner` is true.

- [ ] **Step 3: Implement post form component**

Create `packages/web/src/components/PlazaPostForm.vue`. Props: `modelValue`, `post`. Emits: `close`, `submit`. Keep local form state, validate with `plazaPostInputSchema`, and submit parsed `PlazaPostInput`. Use labels for all required fields and switch between course exchange and team recruit fields based on selected type.

- [ ] **Step 4: Replace plaza page**

Modify `packages/web/src/pages/PlazaPage.vue` so it:

```ts
if (!getToken()) {
  void router.replace("/login");
}
```

Uses `useInfiniteQuery` with `listPlazaPosts`, flattens pages into posts, renders `PlazaFilters`, renders `PlazaPostCard`, and uses mutations for create/update/status/delete. Include root `data-testid="plaza-page"` and publish button `data-testid="plaza-create-button"`.

- [ ] **Step 5: Extend frontend tests**

Add tests to `packages/web/src/pages/PlazaPage.test.ts` that:

```ts
expect(wrapper.text()).toContain("暂无广场帖子");
await wrapper.get('[data-testid="plaza-create-button"]').trigger("click");
expect(wrapper.text()).toContain("发布帖子");
```

Add a mocked list response containing an owned course exchange post and assert:

```ts
expect(wrapper.text()).toContain("想换软件工程实践课");
expect(wrapper.text()).toContain("owner");
expect(wrapper.text()).toContain("编辑");
expect(wrapper.text()).toContain("关闭");
```

- [ ] **Step 6: Run frontend test to verify GREEN**

Run:

```bash
pnpm --filter @gradcheck/web test -- PlazaPage.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit frontend page**

Run:

```bash
git add packages/web/src
git commit -m "feat: build plaza page"
```

---

### Task 7: Migration, Full Verification, and Polish

**Files:**
- Create: `packages/backend/drizzle/<generated>_*.sql`
- Modify: `packages/backend/drizzle/meta/_journal.json`
- Modify: `packages/backend/drizzle/meta/<generated>_snapshot.json`

- [ ] **Step 1: Generate migration**

Run:

```bash
pnpm db:generate
```

Expected: a new Drizzle migration creating `plaza_posts`.

- [ ] **Step 2: Run full verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: all pass.

- [ ] **Step 3: Commit migration and verification fixes**

Run:

```bash
git add packages/backend/drizzle package.json pnpm-lock.yaml packages/backend/src packages/web/src
git commit -m "chore: add plaza migration"
```

If only migration files changed, commit only `packages/backend/drizzle`.

- [ ] **Step 4: Final status check**

Run:

```bash
git status --short
git --no-pager log --oneline -n 5
```

Expected: clean worktree and recent commits for backend API, frontend page, and migration.

---

## Self-Review Notes

- Spec coverage: access, two post types, shared/type-specific fields, lifecycle, soft delete, filtering, infinite scroll, display-name-only author, modal form, backend APIs, and tests are all mapped to tasks.
- Placeholder scan: the plan contains no TBD/TODO placeholders.
- Type consistency: post type/status names, route paths, component names, and API method names match across backend, frontend, and tests.
