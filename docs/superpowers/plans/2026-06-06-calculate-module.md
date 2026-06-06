# Calculate Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a signed-in, full-stack GPA calculator where users persist their own courses and latest Southeast University GPA/weighted-average results.

**Architecture:** Add a focused backend `modules/gpa` feature with pure calculation logic, repository persistence, and authenticated Express routes. Add a real frontend `/gpa` page that uses the backend as the source of truth and refreshes course/result state after every create, update, or delete.

**Tech Stack:** TypeScript, Express, Drizzle ORM, PostgreSQL, Zod, Vitest, Supertest, Vue 3, Vue Router, TanStack Vue Query, TailwindCSS.

---

## File Structure

Create backend GPA files:

- `packages/backend/src/modules/gpa/gpa.types.ts`: shared backend GPA types.
- `packages/backend/src/modules/gpa/gpa.schemas.ts`: Zod request validation and term enum generation.
- `packages/backend/src/modules/gpa/gpa.calculator.ts`: pure score conversion and weighted calculations.
- `packages/backend/src/modules/gpa/gpa.repository.ts`: Drizzle-backed persistence for courses and latest results.
- `packages/backend/src/modules/gpa/gpa.service.ts`: orchestration for listing, creating, updating, deleting, recalculating, and persisting.
- `packages/backend/src/modules/gpa/gpa.routes.ts`: authenticated Express router.
- `packages/backend/src/modules/gpa/gpa.calculator.test.ts`: pure calculation tests.

Modify backend files:

- `packages/backend/src/db/schema.ts`: add `gpa_courses` and `gpa_calculation_results` tables.
- `packages/backend/src/app.ts`: accept `gpaRepository` and mount `/api/gpa`.
- `packages/backend/src/index.ts`: construct and pass the Drizzle GPA repository.
- `packages/backend/src/app.test.ts`: add in-memory GPA repository and API integration tests.
- `packages/backend/drizzle/*`: generated migration from `pnpm db:generate`.

Create frontend files:

- `packages/web/src/schemas/gpa.ts`: frontend validation schema matching backend request fields.
- `packages/web/src/pages/GpaPage.vue`: real GPA calculator page.
- `packages/web/src/pages/GpaPage.test.ts`: page behavior tests.

Modify frontend files:

- `packages/web/src/lib/api.ts`: GPA DTOs and API functions.
- `packages/web/src/router.ts`: route `/gpa` to `GpaPage`.
- `packages/web/src/router.test.ts`: assert `/gpa` resolves to the real page route.

---

## Task 1: Backend Pure GPA Calculator

**Files:**

- Create: `packages/backend/src/modules/gpa/gpa.types.ts`
- Create: `packages/backend/src/modules/gpa/gpa.calculator.ts`
- Create: `packages/backend/src/modules/gpa/gpa.calculator.test.ts`

- [ ] **Step 1: Write the failing calculator tests**

Create `packages/backend/src/modules/gpa/gpa.calculator.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { calculateGpaResult, convertScoreToSeuGradePoint } from "./gpa.calculator.js";
import type { GpaCourse } from "./gpa.types.js";

function course(overrides: Partial<GpaCourse>): GpaCourse {
  return {
    id: "course-1",
    userId: "user-1",
    term: "2025-2026 春",
    name: "高等数学",
    credit: "4.00",
    score: "96.00",
    isRequired: true,
    isFirstAttempt: true,
    isGpaEligible: true,
    createdAt: new Date("2026-06-06T00:00:00.000Z"),
    updatedAt: new Date("2026-06-06T00:00:00.000Z"),
    ...overrides
  };
}

describe("convertScoreToSeuGradePoint", () => {
  it.each([
    [100, 4.8],
    [96, 4.8],
    [95, 4.5],
    [93, 4.5],
    [92, 4.0],
    [90, 4.0],
    [89, 3.8],
    [86, 3.8],
    [85, 3.5],
    [83, 3.5],
    [82, 3.0],
    [80, 3.0],
    [79, 2.8],
    [76, 2.8],
    [75, 2.5],
    [73, 2.5],
    [72, 2.0],
    [70, 2.0],
    [69, 1.8],
    [66, 1.8],
    [65, 1.5],
    [63, 1.5],
    [62, 1.0],
    [60, 1.0],
    [59, 0],
    [0, 0]
  ])("maps %i to %f", (score, expected) => {
    expect(convertScoreToSeuGradePoint(score)).toBe(expected);
  });
});

describe("calculateGpaResult", () => {
  it("calculates both GPA scopes with credit weighting and four-decimal rounding", () => {
    const result = calculateGpaResult([
      course({ id: "required-a", credit: "3.00", score: "96.00", isRequired: true, isFirstAttempt: true }),
      course({ id: "required-b", credit: "2.00", score: "90.00", isRequired: true, isFirstAttempt: true }),
      course({ id: "elective", credit: "1.00", score: "80.00", isRequired: false, isFirstAttempt: true }),
      course({ id: "retake", credit: "2.00", score: "100.00", isRequired: true, isFirstAttempt: false })
    ]);

    expect(result.requiredFirstAttempt).toEqual({
      weightedGpa: 4.48,
      weightedAverageScore: 93.6,
      totalCredits: 5,
      courseCount: 2
    });
    expect(result.overall).toEqual({
      weightedGpa: 4.3375,
      weightedAverageScore: 93.5,
      totalCredits: 8,
      courseCount: 4
    });
  });

  it("excludes courses that are not GPA eligible from both scopes", () => {
    const result = calculateGpaResult([
      course({ id: "pass-fail", credit: "2.00", score: "100.00", isGpaEligible: false })
    ]);

    expect(result).toEqual({
      requiredFirstAttempt: {
        weightedGpa: null,
        weightedAverageScore: null,
        totalCredits: 0,
        courseCount: 0
      },
      overall: {
        weightedGpa: null,
        weightedAverageScore: null,
        totalCredits: 0,
        courseCount: 0
      }
    });
  });
});
```

- [ ] **Step 2: Run the calculator test to verify it fails**

Run:

```bash
pnpm --filter @gradcheck/backend test -- src/modules/gpa/gpa.calculator.test.ts
```

Expected: FAIL because `gpa.calculator.js` and `gpa.types.js` do not exist.

- [ ] **Step 3: Create the backend GPA types**

Create `packages/backend/src/modules/gpa/gpa.types.ts`:

```ts
export interface GpaCourseInput {
  term: string;
  name: string;
  credit: string;
  score: string;
  isRequired: boolean;
  isFirstAttempt: boolean;
  isGpaEligible: boolean;
}

export interface GpaCourse extends GpaCourseInput {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GpaScopeResult {
  weightedGpa: number | null;
  weightedAverageScore: number | null;
  totalCredits: number;
  courseCount: number;
}

export interface GpaCalculationResult {
  requiredFirstAttempt: GpaScopeResult;
  overall: GpaScopeResult;
}

export interface PersistedGpaCalculationResult extends GpaCalculationResult {
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 4: Create the calculator implementation**

Create `packages/backend/src/modules/gpa/gpa.calculator.ts`:

```ts
import type { GpaCalculationResult, GpaCourse, GpaScopeResult } from "./gpa.types.js";

const EMPTY_SCOPE_RESULT: GpaScopeResult = {
  weightedGpa: null,
  weightedAverageScore: null,
  totalCredits: 0,
  courseCount: 0
};

export function convertScoreToSeuGradePoint(score: number): number {
  if (score >= 96) return 4.8;
  if (score >= 93) return 4.5;
  if (score >= 90) return 4.0;
  if (score >= 86) return 3.8;
  if (score >= 83) return 3.5;
  if (score >= 80) return 3.0;
  if (score >= 76) return 2.8;
  if (score >= 73) return 2.5;
  if (score >= 70) return 2.0;
  if (score >= 66) return 1.8;
  if (score >= 63) return 1.5;
  if (score >= 60) return 1.0;
  return 0;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function toNumber(value: string): number {
  return Number(value);
}

function calculateScope(courses: GpaCourse[]): GpaScopeResult {
  if (courses.length === 0) {
    return { ...EMPTY_SCOPE_RESULT };
  }

  const totalCredits = courses.reduce((sum, course) => sum + toNumber(course.credit), 0);
  if (totalCredits === 0) {
    return { ...EMPTY_SCOPE_RESULT };
  }

  const weightedGpaTotal = courses.reduce(
    (sum, course) => sum + convertScoreToSeuGradePoint(toNumber(course.score)) * toNumber(course.credit),
    0
  );
  const weightedScoreTotal = courses.reduce((sum, course) => sum + toNumber(course.score) * toNumber(course.credit), 0);

  return {
    weightedGpa: round4(weightedGpaTotal / totalCredits),
    weightedAverageScore: round4(weightedScoreTotal / totalCredits),
    totalCredits: round4(totalCredits),
    courseCount: courses.length
  };
}

export function calculateGpaResult(courses: GpaCourse[]): GpaCalculationResult {
  const eligibleCourses = courses.filter((course) => course.isGpaEligible);
  const requiredFirstAttemptCourses = eligibleCourses.filter((course) => course.isRequired && course.isFirstAttempt);

  return {
    requiredFirstAttempt: calculateScope(requiredFirstAttemptCourses),
    overall: calculateScope(eligibleCourses)
  };
}
```

- [ ] **Step 5: Run the calculator test to verify it passes**

Run:

```bash
pnpm --filter @gradcheck/backend test -- src/modules/gpa/gpa.calculator.test.ts
```

Expected: PASS with the calculator test file passing.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add packages/backend/src/modules/gpa/gpa.types.ts packages/backend/src/modules/gpa/gpa.calculator.ts packages/backend/src/modules/gpa/gpa.calculator.test.ts
git commit -m "feat: add GPA calculation core" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Expected: commit succeeds.

---

## Task 2: Database Schema and Repository

**Files:**

- Modify: `packages/backend/src/db/schema.ts`
- Create: `packages/backend/src/modules/gpa/gpa.schemas.ts`
- Create: `packages/backend/src/modules/gpa/gpa.repository.ts`
- Modify generated files under: `packages/backend/drizzle/`

- [ ] **Step 1: Add GPA tables to the Drizzle schema**

Modify the import in `packages/backend/src/db/schema.ts`:

```ts
import { boolean, integer, jsonb, numeric, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
```

Append this table definition after `auditLogs`:

```ts
export const gpaCourses = pgTable("gpa_courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  term: varchar("term", { length: 20 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  credit: numeric("credit", { precision: 5, scale: 2 }).notNull(),
  score: numeric("score", { precision: 5, scale: 2 }).notNull(),
  isRequired: boolean("is_required").notNull().default(false),
  isFirstAttempt: boolean("is_first_attempt").notNull().default(true),
  isGpaEligible: boolean("is_gpa_eligible").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const gpaCalculationResults = pgTable("gpa_calculation_results", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  requiredFirstAttempt: jsonb("required_first_attempt")
    .$type<{
      weightedGpa: number | null;
      weightedAverageScore: number | null;
      totalCredits: number;
      courseCount: number;
    }>()
    .notNull(),
  overall: jsonb("overall")
    .$type<{
      weightedGpa: number | null;
      weightedAverageScore: number | null;
      totalCredits: number;
      courseCount: number;
    }>()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
```

- [ ] **Step 2: Create backend validation schemas**

Create `packages/backend/src/modules/gpa/gpa.schemas.ts`:

```ts
import { z } from "zod";

export const gpaTerms = Array.from({ length: 11 }, (_, index) => {
  const startYear = 2020 + index;
  return [`${startYear}-${startYear + 1} 秋`, `${startYear}-${startYear + 1} 春`];
}).flat() as [string, ...string[]];

const decimalStringSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Value must be a number with up to two decimals");

export const gpaCourseInputSchema = z.object({
  term: z.enum(gpaTerms),
  name: z.string().trim().min(1, "Course name is required").max(160),
  credit: decimalStringSchema.refine((value) => {
    const numberValue = Number(value);
    return numberValue > 0 && numberValue <= 99.99;
  }, "Credit must be greater than 0"),
  score: decimalStringSchema.refine((value) => {
    const numberValue = Number(value);
    return numberValue >= 0 && numberValue <= 100;
  }, "Score must be between 0 and 100"),
  isRequired: z.boolean(),
  isFirstAttempt: z.boolean(),
  isGpaEligible: z.boolean()
});

export type GpaCourseInputRequest = z.infer<typeof gpaCourseInputSchema>;
```

- [ ] **Step 3: Create the Drizzle-backed GPA repository**

Create `packages/backend/src/modules/gpa/gpa.repository.ts`:

```ts
import { and, eq } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { gpaCalculationResults, gpaCourses } from "../../db/schema.js";
import type { GpaCalculationResult, GpaCourse, GpaCourseInput, PersistedGpaCalculationResult } from "./gpa.types.js";

export interface GpaRepository {
  listCourses(userId: string): Promise<GpaCourse[]>;
  findCourse(userId: string, courseId: string): Promise<GpaCourse | null>;
  createCourse(userId: string, input: GpaCourseInput): Promise<GpaCourse>;
  updateCourse(userId: string, courseId: string, input: GpaCourseInput): Promise<GpaCourse | null>;
  deleteCourse(userId: string, courseId: string): Promise<boolean>;
  getLatestResult(userId: string): Promise<PersistedGpaCalculationResult | null>;
  upsertLatestResult(userId: string, result: GpaCalculationResult): Promise<PersistedGpaCalculationResult>;
}

export function createGpaRepository(db: Database): GpaRepository {
  return {
    async listCourses(userId) {
      return db.select().from(gpaCourses).where(eq(gpaCourses.userId, userId));
    },
    async findCourse(userId, courseId) {
      const [course] = await db
        .select()
        .from(gpaCourses)
        .where(and(eq(gpaCourses.userId, userId), eq(gpaCourses.id, courseId)))
        .limit(1);
      return course ?? null;
    },
    async createCourse(userId, input) {
      const [course] = await db.insert(gpaCourses).values({ userId, ...input }).returning();
      return course;
    },
    async updateCourse(userId, courseId, input) {
      const [course] = await db
        .update(gpaCourses)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(gpaCourses.userId, userId), eq(gpaCourses.id, courseId)))
        .returning();
      return course ?? null;
    },
    async deleteCourse(userId, courseId) {
      const deleted = await db
        .delete(gpaCourses)
        .where(and(eq(gpaCourses.userId, userId), eq(gpaCourses.id, courseId)))
        .returning({ id: gpaCourses.id });
      return deleted.length > 0;
    },
    async getLatestResult(userId) {
      const [result] = await db
        .select()
        .from(gpaCalculationResults)
        .where(eq(gpaCalculationResults.userId, userId))
        .limit(1);
      return result ?? null;
    },
    async upsertLatestResult(userId, result) {
      const [persisted] = await db
        .insert(gpaCalculationResults)
        .values({ userId, ...result })
        .onConflictDoUpdate({
          target: gpaCalculationResults.userId,
          set: { ...result, updatedAt: new Date() }
        })
        .returning();
      return persisted;
    }
  };
}
```

- [ ] **Step 4: Generate the database migration**

Run:

```bash
pnpm db:generate
```

Expected: a new SQL migration and snapshot changes are created under `packages/backend/drizzle/`. Inspect the generated SQL and confirm it creates `gpa_courses`, `gpa_calculation_results`, and foreign keys to `users`.

- [ ] **Step 5: Typecheck backend schema and repository**

Run:

```bash
pnpm --filter @gradcheck/backend typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add packages/backend/src/db/schema.ts packages/backend/src/modules/gpa/gpa.schemas.ts packages/backend/src/modules/gpa/gpa.repository.ts packages/backend/drizzle
git commit -m "feat: add GPA persistence schema" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Expected: commit succeeds.

---

## Task 3: Backend GPA Service and Authenticated API

**Files:**

- Create: `packages/backend/src/modules/gpa/gpa.service.ts`
- Create: `packages/backend/src/modules/gpa/gpa.routes.ts`
- Modify: `packages/backend/src/app.ts`
- Modify: `packages/backend/src/index.ts`
- Modify: `packages/backend/src/app.test.ts`

- [ ] **Step 1: Write API tests in `app.test.ts`**

Modify imports in `packages/backend/src/app.test.ts`:

```ts
import type { GpaCalculationResult, GpaCourse, GpaCourseInput, PersistedGpaCalculationResult } from "./modules/gpa/gpa.types.js";
import type { GpaRepository } from "./modules/gpa/gpa.repository.js";
```

Add this helper after `createRepository()`:

```ts
function createGpaRepository(): GpaRepository {
  const courses = new Map<string, GpaCourse>();
  const results = new Map<string, PersistedGpaCalculationResult>();

  return {
    async listCourses(userId) {
      return [...courses.values()].filter((course) => course.userId === userId);
    },
    async findCourse(userId, courseId) {
      const course = courses.get(courseId);
      return course?.userId === userId ? course : null;
    },
    async createCourse(userId, input: GpaCourseInput) {
      const course: GpaCourse = {
        id: `course-${courses.size + 1}`,
        userId,
        ...input,
        createdAt: now,
        updatedAt: now
      };
      courses.set(course.id, course);
      return course;
    },
    async updateCourse(userId, courseId, input) {
      const existing = courses.get(courseId);
      if (!existing || existing.userId !== userId) {
        return null;
      }

      const updated: GpaCourse = {
        ...existing,
        ...input,
        updatedAt: now
      };
      courses.set(courseId, updated);
      return updated;
    },
    async deleteCourse(userId, courseId) {
      const existing = courses.get(courseId);
      if (!existing || existing.userId !== userId) {
        return false;
      }

      courses.delete(courseId);
      return true;
    },
    async getLatestResult(userId) {
      return results.get(userId) ?? null;
    },
    async upsertLatestResult(userId, result: GpaCalculationResult) {
      const persisted: PersistedGpaCalculationResult = {
        userId,
        ...result,
        createdAt: results.get(userId)?.createdAt ?? now,
        updatedAt: now
      };
      results.set(userId, persisted);
      return persisted;
    }
  };
}

function createTestApp() {
  return createApp({
    authRepository: createRepository(),
    gpaRepository: createGpaRepository()
  });
}
```

Replace each existing app creation in `app.test.ts` with `createTestApp()`. The current file has three calls shaped like `createApp({ authRepository: createRepository() })`; replace each one with:

```ts
const app = createTestApp();
```

Add this test in the `describe("GradCheck API baseline", () => { ... })` block:

```ts
it("persists GPA courses and recalculates latest results after changes", async () => {
  const app = createTestApp();

  const registerResponse = await request(app)
    .post("/api/auth/register")
    .send({ email: "gpa@example.com", password: "password123" })
    .expect(201);
  const token = registerResponse.body.token as string;

  const emptyResponse = await request(app).get("/api/gpa").set("Authorization", `Bearer ${token}`).expect(200);
  expect(emptyResponse.body).toEqual({
    courses: [],
    result: {
      requiredFirstAttempt: {
        weightedGpa: null,
        weightedAverageScore: null,
        totalCredits: 0,
        courseCount: 0
      },
      overall: {
        weightedGpa: null,
        weightedAverageScore: null,
        totalCredits: 0,
        courseCount: 0
      }
    }
  });

  const createResponse = await request(app)
    .post("/api/gpa/courses")
    .set("Authorization", `Bearer ${token}`)
    .send({
      term: "2025-2026 春",
      name: "高等数学",
      credit: "3.00",
      score: "96.00",
      isRequired: true,
      isFirstAttempt: true,
      isGpaEligible: true
    })
    .expect(201);

  expect(createResponse.body.courses).toHaveLength(1);
  expect(createResponse.body.result.requiredFirstAttempt).toEqual({
    weightedGpa: 4.8,
    weightedAverageScore: 96,
    totalCredits: 3,
    courseCount: 1
  });

  const courseId = createResponse.body.courses[0].id as string;
  const updateResponse = await request(app)
    .put(`/api/gpa/courses/${courseId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      term: "2025-2026 秋",
      name: "高等数学",
      credit: "3.00",
      score: "90.00",
      isRequired: true,
      isFirstAttempt: true,
      isGpaEligible: true
    })
    .expect(200);

  expect(updateResponse.body.result.requiredFirstAttempt.weightedGpa).toBe(4);
  expect(updateResponse.body.result.requiredFirstAttempt.weightedAverageScore).toBe(90);

  const deleteResponse = await request(app)
    .delete(`/api/gpa/courses/${courseId}`)
    .set("Authorization", `Bearer ${token}`)
    .expect(200);

  expect(deleteResponse.body.courses).toEqual([]);
  expect(deleteResponse.body.result.overall.weightedGpa).toBeNull();
});
```

Add this ownership test:

```ts
it("does not allow users to update another user's GPA course", async () => {
  const app = createTestApp();

  const firstUser = await request(app)
    .post("/api/auth/register")
    .send({ email: "owner@example.com", password: "password123" })
    .expect(201);
  const secondUser = await request(app)
    .post("/api/auth/register")
    .send({ email: "other@example.com", password: "password123" })
    .expect(201);

  const createResponse = await request(app)
    .post("/api/gpa/courses")
    .set("Authorization", `Bearer ${firstUser.body.token}`)
    .send({
      term: "2025-2026 春",
      name: "大学物理",
      credit: "2.00",
      score: "88.00",
      isRequired: true,
      isFirstAttempt: true,
      isGpaEligible: true
    })
    .expect(201);

  const courseId = createResponse.body.courses[0].id as string;

  await request(app)
    .put(`/api/gpa/courses/${courseId}`)
    .set("Authorization", `Bearer ${secondUser.body.token}`)
    .send({
      term: "2025-2026 春",
      name: "大学物理",
      credit: "2.00",
      score: "100.00",
      isRequired: true,
      isFirstAttempt: true,
      isGpaEligible: true
    })
    .expect(404);
});
```

- [ ] **Step 2: Run API tests to verify they fail**

Run:

```bash
pnpm --filter @gradcheck/backend test -- src/app.test.ts
```

Expected: FAIL because `gpa.service.ts`, `gpa.routes.ts`, and `createApp` GPA wiring do not exist yet.

- [ ] **Step 3: Create the GPA service**

Create `packages/backend/src/modules/gpa/gpa.service.ts`:

```ts
import { HttpError } from "../../lib/http-error.js";
import { calculateGpaResult } from "./gpa.calculator.js";
import type { GpaRepository } from "./gpa.repository.js";
import type { GpaCalculationResult, GpaCourseInput } from "./gpa.types.js";

const EMPTY_RESULT: GpaCalculationResult = {
  requiredFirstAttempt: {
    weightedGpa: null,
    weightedAverageScore: null,
    totalCredits: 0,
    courseCount: 0
  },
  overall: {
    weightedGpa: null,
    weightedAverageScore: null,
    totalCredits: 0,
    courseCount: 0
  }
};

async function recalculate(repository: GpaRepository, userId: string) {
  const courses = await repository.listCourses(userId);
  const result = calculateGpaResult(courses);
  await repository.upsertLatestResult(userId, result);

  return { courses, result };
}

export async function getGpaDashboard(repository: GpaRepository, userId: string) {
  const courses = await repository.listCourses(userId);
  const latestResult = await repository.getLatestResult(userId);
  const result = latestResult
    ? {
        requiredFirstAttempt: latestResult.requiredFirstAttempt,
        overall: latestResult.overall
      }
    : EMPTY_RESULT;

  return { courses, result };
}

export async function createGpaCourse(repository: GpaRepository, userId: string, input: GpaCourseInput) {
  await repository.createCourse(userId, input);
  return recalculate(repository, userId);
}

export async function updateGpaCourse(repository: GpaRepository, userId: string, courseId: string, input: GpaCourseInput) {
  const course = await repository.updateCourse(userId, courseId, input);
  if (!course) {
    throw new HttpError(404, "GPA course was not found");
  }

  return recalculate(repository, userId);
}

export async function deleteGpaCourse(repository: GpaRepository, userId: string, courseId: string) {
  const deleted = await repository.deleteCourse(userId, courseId);
  if (!deleted) {
    throw new HttpError(404, "GPA course was not found");
  }

  return recalculate(repository, userId);
}
```

- [ ] **Step 4: Create the GPA router**

Create `packages/backend/src/modules/gpa/gpa.routes.ts`:

```ts
import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import { gpaCourseInputSchema } from "./gpa.schemas.js";
import type { GpaRepository } from "./gpa.repository.js";
import { createGpaCourse, deleteGpaCourse, getGpaDashboard, updateGpaCourse } from "./gpa.service.js";

export function createGpaRouter(authRepository: AuthRepository, gpaRepository: GpaRepository): Router {
  const router = Router();

  router.get("/", authenticate(authRepository), async (req, res, next) => {
    try {
      res.json(await getGpaDashboard(gpaRepository, req.userId ?? ""));
    } catch (error) {
      next(error);
    }
  });

  router.post("/courses", authenticate(authRepository), async (req, res, next) => {
    try {
      const input = gpaCourseInputSchema.parse(req.body);
      res.status(201).json(await createGpaCourse(gpaRepository, req.userId ?? "", input));
    } catch (error) {
      next(error);
    }
  });

  router.put("/courses/:id", authenticate(authRepository), async (req, res, next) => {
    try {
      const input = gpaCourseInputSchema.parse(req.body);
      res.json(await updateGpaCourse(gpaRepository, req.userId ?? "", req.params.id, input));
    } catch (error) {
      next(error);
    }
  });

  router.delete("/courses/:id", authenticate(authRepository), async (req, res, next) => {
    try {
      res.json(await deleteGpaCourse(gpaRepository, req.userId ?? "", req.params.id));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
```

- [ ] **Step 5: Wire the GPA repository into the app**

Modify `packages/backend/src/app.ts` imports:

```ts
import type { GpaRepository } from "./modules/gpa/gpa.repository.js";
import { createGpaRouter } from "./modules/gpa/gpa.routes.js";
```

Modify `AppDependencies`:

```ts
export interface AppDependencies {
  authRepository: AuthRepository;
  gpaRepository: GpaRepository;
  corsOrigin?: string;
}
```

Add the route after user routes:

```ts
app.use("/api/gpa", createGpaRouter(dependencies.authRepository, dependencies.gpaRepository));
```

- [ ] **Step 6: Wire the repository in `index.ts`**

Modify `packages/backend/src/index.ts` so it imports and passes the GPA repository. The file should include:

```ts
import { createApp } from "./app.js";
import { getConfig } from "./lib/config.js";
import { createDb } from "./db/client.js";
import { createAuthRepository } from "./modules/auth/auth.repository.js";
import { createGpaRepository } from "./modules/gpa/gpa.repository.js";

const config = getConfig();
const db = createDb(config.databaseUrl);
const authRepository = createAuthRepository(db);
const gpaRepository = createGpaRepository(db);
const app = createApp({ authRepository, gpaRepository, corsOrigin: config.corsOrigin });

app.listen(config.port, () => {
  console.log(`GradCheck backend listening on port ${config.port}`);
});
```

- [ ] **Step 7: Run backend tests and typecheck**

Run:

```bash
pnpm --filter @gradcheck/backend test
pnpm --filter @gradcheck/backend typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

Run:

```bash
git add packages/backend/src/modules/gpa/gpa.service.ts packages/backend/src/modules/gpa/gpa.routes.ts packages/backend/src/app.ts packages/backend/src/index.ts packages/backend/src/app.test.ts
git commit -m "feat: add authenticated GPA API" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Expected: commit succeeds.

---

## Task 4: Frontend API Contracts and Route

**Files:**

- Create: `packages/web/src/schemas/gpa.ts`
- Modify: `packages/web/src/lib/api.ts`
- Modify: `packages/web/src/router.ts`
- Modify: `packages/web/src/router.test.ts`

- [ ] **Step 1: Create the frontend GPA schema**

Create `packages/web/src/schemas/gpa.ts`:

```ts
import { z } from "zod";

export const gpaTerms = Array.from({ length: 11 }, (_, index) => {
  const startYear = 2020 + index;
  return [`${startYear}-${startYear + 1} 秋`, `${startYear}-${startYear + 1} 春`];
}).flat() as [string, ...string[]];

const decimalStringSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "请输入最多两位小数的数字");

export const gpaCourseSchema = z.object({
  term: z.enum(gpaTerms),
  name: z.string().trim().min(1, "请输入课程名称").max(160, "课程名称不能超过 160 个字符"),
  credit: decimalStringSchema.refine((value) => Number(value) > 0 && Number(value) <= 99.99, "学分必须大于 0"),
  score: decimalStringSchema.refine((value) => Number(value) >= 0 && Number(value) <= 100, "成绩必须在 0 到 100 之间"),
  isRequired: z.boolean(),
  isFirstAttempt: z.boolean(),
  isGpaEligible: z.boolean()
});

export type GpaCourseInput = z.infer<typeof gpaCourseSchema>;
```

- [ ] **Step 2: Add GPA DTOs and API functions**

Append these imports and types to `packages/web/src/lib/api.ts`:

```ts
import type { GpaCourseInput } from "../schemas/gpa";
```

Add these interfaces after `AuthResponse`:

```ts
export interface GpaCourse extends GpaCourseInput {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GpaScopeResult {
  weightedGpa: number | null;
  weightedAverageScore: number | null;
  totalCredits: number;
  courseCount: number;
}

export interface GpaCalculationResult {
  requiredFirstAttempt: GpaScopeResult;
  overall: GpaScopeResult;
}

export interface GpaDashboardResponse {
  courses: GpaCourse[];
  result: GpaCalculationResult;
}
```

Add these functions after `updateProfile`:

```ts
export async function getGpaDashboard(): Promise<GpaDashboardResponse> {
  return request<GpaDashboardResponse>("/api/gpa");
}

export async function createGpaCourse(input: GpaCourseInput): Promise<GpaDashboardResponse> {
  return request<GpaDashboardResponse>("/api/gpa/courses", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateGpaCourse(courseId: string, input: GpaCourseInput): Promise<GpaDashboardResponse> {
  return request<GpaDashboardResponse>(`/api/gpa/courses/${courseId}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function deleteGpaCourse(courseId: string): Promise<GpaDashboardResponse> {
  return request<GpaDashboardResponse>(`/api/gpa/courses/${courseId}`, {
    method: "DELETE"
  });
}
```

- [ ] **Step 3: Add a temporary page component import and route**

Modify `packages/web/src/router.ts` imports:

```ts
import GpaPage from "./pages/GpaPage.vue";
```

Replace the `/gpa` route object with:

```ts
{
  path: "/gpa",
  name: "gpa",
  component: GpaPage
}
```

Create `packages/web/src/pages/GpaPage.vue` with a minimal shell so the route can compile before the full page task:

```vue
<script setup lang="ts">
import AppShell from "../components/AppShell.vue";
</script>

<template>
  <AppShell>
    <section class="rounded-3xl bg-white p-6 shadow-sm">
      <p class="text-sm font-semibold text-[var(--tommy-primary)]">GPA Calculator</p>
      <h1 class="mt-2 text-2xl font-bold text-[var(--tommy-text)]">GPA 计算器</h1>
    </section>
  </AppShell>
</template>
```

- [ ] **Step 4: Update the router test**

Modify the `/gpa` expectation in `packages/web/src/router.test.ts` by adding this assertion inside the homepage feature route test loop after the existing path assertion:

```ts
if (name === "gpa") {
  expect(router.resolve({ name }).matched[0]?.components?.default).toBeTruthy();
}
```

- [ ] **Step 5: Run frontend typecheck and router tests**

Run:

```bash
pnpm --filter @gradcheck/web test -- src/router.test.ts
pnpm --filter @gradcheck/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

Run:

```bash
git add packages/web/src/schemas/gpa.ts packages/web/src/lib/api.ts packages/web/src/router.ts packages/web/src/router.test.ts packages/web/src/pages/GpaPage.vue
git commit -m "feat: add GPA frontend API route" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Expected: commit succeeds.

---

## Task 5: Frontend GPA Page

**Files:**

- Replace: `packages/web/src/pages/GpaPage.vue`
- Create: `packages/web/src/pages/GpaPage.test.ts`

- [ ] **Step 1: Write failing page tests**

Create `packages/web/src/pages/GpaPage.test.ts`:

```ts
import { mount, RouterLinkStub, flushPromises } from "@vue/test-utils";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { describe, expect, it, vi } from "vitest";

import GpaPage from "./GpaPage.vue";

const replace = vi.fn();
const createGpaCourse = vi.fn();
const updateGpaCourse = vi.fn();
const deleteGpaCourse = vi.fn();

vi.mock("vue-router", () => ({
  useRouter: () => ({
    replace
  }),
  RouterLink: RouterLinkStub
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");

  return {
    ...actual,
    getToken: () => "token",
    getGpaDashboard: async () => ({
      courses: [
        {
          id: "course-1",
          userId: "user-1",
          term: "2025-2026 春",
          name: "高等数学",
          credit: "3.00",
          score: "96.00",
          isRequired: true,
          isFirstAttempt: true,
          isGpaEligible: true,
          createdAt: "2026-06-06T00:00:00.000Z",
          updatedAt: "2026-06-06T00:00:00.000Z"
        }
      ],
      result: {
        requiredFirstAttempt: {
          weightedGpa: 4.8,
          weightedAverageScore: 96,
          totalCredits: 3,
          courseCount: 1
        },
        overall: {
          weightedGpa: 4.8,
          weightedAverageScore: 96,
          totalCredits: 3,
          courseCount: 1
        }
      }
    }),
    createGpaCourse,
    updateGpaCourse,
    deleteGpaCourse
  };
});

function mountPage() {
  return mount(GpaPage, {
    global: {
      plugins: [VueQueryPlugin],
      stubs: {
        RouterLink: RouterLinkStub
      }
    }
  });
}

describe("GpaPage", () => {
  it("shows persisted GPA results and courses", async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get('[data-testid="gpa-required-result"]').text()).toContain("4.8");
    expect(wrapper.get('[data-testid="gpa-overall-result"]').text()).toContain("96");
    expect(wrapper.get('[data-testid="gpa-course-list"]').text()).toContain("高等数学");
    expect(wrapper.get('[data-testid="gpa-course-list"]').text()).toContain("2025-2026 春");
  });

  it("submits a new course through the API", async () => {
    createGpaCourse.mockResolvedValueOnce({
      courses: [],
      result: {
        requiredFirstAttempt: { weightedGpa: null, weightedAverageScore: null, totalCredits: 0, courseCount: 0 },
        overall: { weightedGpa: null, weightedAverageScore: null, totalCredits: 0, courseCount: 0 }
      }
    });

    const wrapper = mountPage();
    await flushPromises();

    await wrapper.get('[data-testid="gpa-course-name"]').setValue("程序设计");
    await wrapper.get('[data-testid="gpa-course-credit"]').setValue("4.00");
    await wrapper.get('[data-testid="gpa-course-score"]').setValue("90.00");
    await wrapper.get('[data-testid="gpa-course-form"]').trigger("submit");

    expect(createGpaCourse).toHaveBeenCalledWith({
      term: "2025-2026 春",
      name: "程序设计",
      credit: "4.00",
      score: "90.00",
      isRequired: true,
      isFirstAttempt: true,
      isGpaEligible: true
    });
  });
});
```

- [ ] **Step 2: Run page tests to verify they fail**

Run:

```bash
pnpm --filter @gradcheck/web test -- src/pages/GpaPage.test.ts
```

Expected: FAIL because the current `GpaPage.vue` does not render the result cards, course list, or form.

- [ ] **Step 3: Replace `GpaPage.vue` with the full page**

Replace `packages/web/src/pages/GpaPage.vue` with:

```vue
<script setup lang="ts">
import { useMutation, useQuery } from "@tanstack/vue-query";
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ZodError } from "zod";

import AppShell from "../components/AppShell.vue";
import {
  createGpaCourse,
  deleteGpaCourse,
  getGpaDashboard,
  getToken,
  updateGpaCourse,
  type GpaCourse,
  type GpaDashboardResponse,
  type GpaScopeResult
} from "../lib/api";
import { gpaCourseSchema, gpaTerms, type GpaCourseInput } from "../schemas/gpa";

const router = useRouter();
const message = ref("");
const editingCourseId = ref<string | null>(null);
const dashboard = ref<GpaDashboardResponse | null>(null);
const form = reactive<GpaCourseInput>({
  term: "2025-2026 春",
  name: "",
  credit: "",
  score: "",
  isRequired: true,
  isFirstAttempt: true,
  isGpaEligible: true
});

if (!getToken()) {
  void router.replace("/login");
}

const { data, isLoading } = useQuery({
  queryKey: ["gpa-dashboard"],
  queryFn: getGpaDashboard,
  enabled: computed(() => Boolean(getToken()))
});

const currentDashboard = computed(() => dashboard.value ?? data.value ?? null);
const courses = computed(() => currentDashboard.value?.courses ?? []);
const result = computed(() => currentDashboard.value?.result ?? null);

function resetForm() {
  editingCourseId.value = null;
  form.term = "2025-2026 春";
  form.name = "";
  form.credit = "";
  form.score = "";
  form.isRequired = true;
  form.isFirstAttempt = true;
  form.isGpaEligible = true;
}

function applyDashboard(response: GpaDashboardResponse) {
  dashboard.value = response;
  message.value = "GPA 数据已更新";
  resetForm();
}

const saveMutation = useMutation({
  mutationFn: async () => {
    const input = gpaCourseSchema.parse(form);
    return editingCourseId.value ? updateGpaCourse(editingCourseId.value, input) : createGpaCourse(input);
  },
  onSuccess: applyDashboard,
  onError: (error) => {
    if (error instanceof ZodError) {
      message.value = error.issues[0]?.message ?? "课程信息不完整";
      return;
    }

    message.value = error instanceof Error ? error.message : "保存失败";
  }
});

const deleteMutation = useMutation({
  mutationFn: deleteGpaCourse,
  onSuccess: applyDashboard,
  onError: (error) => {
    message.value = error instanceof Error ? error.message : "删除失败";
  }
});

function submit() {
  message.value = "";
  saveMutation.mutate();
}

function editCourse(course: GpaCourse) {
  editingCourseId.value = course.id;
  form.term = course.term;
  form.name = course.name;
  form.credit = course.credit;
  form.score = course.score;
  form.isRequired = course.isRequired;
  form.isFirstAttempt = course.isFirstAttempt;
  form.isGpaEligible = course.isGpaEligible;
}

function formatMetric(value: number | null): string {
  return value === null ? "暂无" : String(value);
}

function scopeSubtitle(scope: GpaScopeResult | undefined): string {
  if (!scope || scope.courseCount === 0) {
    return "暂无可计算课程";
  }

  return `${scope.courseCount} 门课程 / ${scope.totalCredits} 学分`;
}
</script>

<template>
  <AppShell>
    <section class="mb-5 rounded-3xl bg-white p-6 shadow-sm">
      <p class="text-sm font-semibold text-[var(--tommy-primary)]">GPA Calculator</p>
      <h1 class="mt-2 text-2xl font-bold text-[var(--tommy-text)]">GPA 计算器</h1>
      <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">
        添加自己的课程成绩后，系统会按东南大学 4.8 制规则自动保存并重新计算。
      </p>
    </section>

    <section class="mb-5 grid gap-4 md:grid-cols-2">
      <article data-testid="gpa-required-result" class="rounded-3xl bg-white p-5 shadow-sm">
        <p class="text-sm font-semibold text-[var(--tommy-info)]">首修必修课程</p>
        <p class="mt-3 text-3xl font-bold text-[var(--tommy-primary)]">{{ formatMetric(result?.requiredFirstAttempt.weightedGpa ?? null) }}</p>
        <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">
          加权均分 {{ formatMetric(result?.requiredFirstAttempt.weightedAverageScore ?? null) }} · {{ scopeSubtitle(result?.requiredFirstAttempt) }}
        </p>
      </article>

      <article data-testid="gpa-overall-result" class="rounded-3xl bg-white p-5 shadow-sm">
        <p class="text-sm font-semibold text-[var(--tommy-info)]">总课程</p>
        <p class="mt-3 text-3xl font-bold text-[var(--tommy-primary)]">{{ formatMetric(result?.overall.weightedGpa ?? null) }}</p>
        <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">
          加权均分 {{ formatMetric(result?.overall.weightedAverageScore ?? null) }} · {{ scopeSubtitle(result?.overall) }}
        </p>
      </article>
    </section>

    <section class="grid gap-5 lg:grid-cols-[1fr_360px]">
      <article class="rounded-3xl bg-white p-5 shadow-sm">
        <h2 class="text-lg font-bold text-[var(--tommy-text)]">我的课程</h2>
        <p v-if="isLoading" class="mt-4 text-sm text-[var(--tommy-text-secondary)]">正在加载课程...</p>
        <p v-else-if="courses.length === 0" class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-[var(--tommy-text-secondary)]">
          还没有课程，先添加一门课程开始计算。
        </p>
        <div v-else data-testid="gpa-course-list" class="mt-4 space-y-3">
          <div v-for="course in courses" :key="course.id" class="rounded-2xl border border-slate-200 p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="font-semibold text-[var(--tommy-text)]">{{ course.name }}</p>
                <p class="mt-1 text-sm text-[var(--tommy-text-secondary)]">
                  {{ course.term }} · {{ course.credit }} 学分 · {{ course.score }} 分
                </p>
                <p class="mt-2 text-xs text-[var(--tommy-text-secondary)]">
                  {{ course.isRequired ? "必修" : "非必修" }} · {{ course.isFirstAttempt ? "首修" : "非首修" }} · {{ course.isGpaEligible ? "计入 GPA" : "不计入 GPA" }}
                </p>
              </div>
              <div class="flex gap-2">
                <button class="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold" type="button" @click="editCourse(course)">
                  编辑
                </button>
                <button class="rounded-xl bg-[color-mix(in_srgb,var(--tommy-error)_12%,white)] px-3 py-2 text-sm font-semibold text-[var(--tommy-error)]" type="button" @click="deleteMutation.mutate(course.id)">
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>

      <aside class="rounded-3xl bg-white p-5 shadow-sm">
        <h2 class="text-lg font-bold text-[var(--tommy-text)]">{{ editingCourseId ? "编辑课程" : "添加课程" }}</h2>
        <form data-testid="gpa-course-form" class="mt-4 space-y-4" @submit.prevent="submit">
          <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
            学期
            <select v-model="form.term" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2">
              <option v-for="term in gpaTerms" :key="term" :value="term">{{ term }}</option>
            </select>
          </label>
          <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
            课程名称
            <input data-testid="gpa-course-name" v-model="form.name" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
              学分
              <input data-testid="gpa-course-credit" v-model="form.credit" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" inputmode="decimal" />
            </label>
            <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
              成绩
              <input data-testid="gpa-course-score" v-model="form.score" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" inputmode="decimal" />
            </label>
          </div>
          <label class="flex items-center gap-2 text-sm text-[var(--tommy-text-secondary)]">
            <input v-model="form.isRequired" type="checkbox" />
            必修课程
          </label>
          <label class="flex items-center gap-2 text-sm text-[var(--tommy-text-secondary)]">
            <input v-model="form.isFirstAttempt" type="checkbox" />
            首修成绩
          </label>
          <label class="flex items-center gap-2 text-sm text-[var(--tommy-text-secondary)]">
            <input v-model="form.isGpaEligible" type="checkbox" />
            计入 GPA/均分
          </label>

          <p v-if="message" class="rounded-xl bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] px-3 py-2 text-sm text-[var(--tommy-info)]">{{ message }}</p>

          <div class="flex flex-wrap gap-2">
            <button class="rounded-xl bg-[var(--tommy-primary)] px-4 py-2.5 font-semibold text-white disabled:opacity-60" type="submit" :disabled="saveMutation.isPending.value">
              {{ saveMutation.isPending.value ? "保存中..." : editingCourseId ? "保存修改" : "添加课程" }}
            </button>
            <button v-if="editingCourseId" class="rounded-xl bg-slate-100 px-4 py-2.5 font-semibold text-[var(--tommy-text)]" type="button" @click="resetForm">
              取消编辑
            </button>
          </div>
        </form>
      </aside>
    </section>
  </AppShell>
</template>
```

- [ ] **Step 4: Run the page test**

Run:

```bash
pnpm --filter @gradcheck/web test -- src/pages/GpaPage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run frontend typecheck**

Run:

```bash
pnpm --filter @gradcheck/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

Run:

```bash
git add packages/web/src/pages/GpaPage.vue packages/web/src/pages/GpaPage.test.ts
git commit -m "feat: build GPA calculator page" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Expected: commit succeeds.

---

## Task 6: Full Verification and Migration Check

**Files:**

- No planned source edits. If verification finds a bug, fix only the failing files and add or update the smallest relevant test.

- [ ] **Step 1: Run full test suite**

Run:

```bash
pnpm test
```

Expected: PASS for backend and frontend tests.

- [ ] **Step 2: Run full typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS for backend and frontend typechecking.

- [ ] **Step 3: Run full build**

Run:

```bash
pnpm build
```

Expected: PASS for backend TypeScript build and frontend Vite build.

- [ ] **Step 4: Run database migration against the configured database**

Run with the repository's normal database URL:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/gradcheck pnpm db:migrate
```

Expected: Drizzle applies the GPA migration without SQL errors. If a different local `DATABASE_URL` is used in `.env`, run `pnpm db:migrate` with that environment instead.

- [ ] **Step 5: Inspect git status**

Run:

```bash
git --no-pager status --short
```

Expected: only intentional files from the completed tasks are cleanly committed. Pre-existing unrelated document path changes may remain; do not revert them.

- [ ] **Step 6: Commit any verification fixes**

If Steps 1-4 required fixes, commit those files:

```bash
git add <fixed-files>
git commit -m "fix: stabilize GPA calculator verification" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Expected: commit succeeds only when fixes were necessary. If no fixes were necessary, skip this commit.
