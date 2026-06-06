# Custom Requirements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 1 custom requirement templates so users can create, update, track, and optionally show custom graduation requirements on the homepage.

**Architecture:** Add a focused backend module under `packages/backend/src/modules/custom-requirements/` with Drizzle persistence, Zod validation, authenticated routes, and audit logging. Add a focused frontend feature under `packages/web/src/pages/CustomRequirementsPage.vue` plus typed API helpers; keep this module independent from the future graduation rule engine by computing local status from each requirement's own fields.

**Tech Stack:** TypeScript, Express, Drizzle ORM, PostgreSQL, Zod, Vitest, Vue 3, Vue Router, TanStack Query, TailwindCSS, pnpm.

---

## Scope and Product Decisions

This plan implements the confirmed Phase 1 template model:

- A custom requirement is both the template and current progress record in the first version.
- Supported kinds: `count`, `hours`, `credits`, `boolean`.
- Supported categories: `lecture`, `volunteer`, `labor`, `practice`, `college`, `sports`, `exam`, `other`.
- Supported importance values: `required`, `optional`, `personal_goal`.
- Supported sources: `user_custom`, `college_requirement`, `pending_confirmation`.
- `showOnHome` controls whether this requirement may appear in homepage summary cards.
- `includeInProgress` controls whether it contributes to future graduation progress aggregation.
- `currentValue` may exceed `targetValue`; UI progress percentage is capped at 100%.
- `status` is derived, not user-entered:
  - `pending_confirmation` when source is `pending_confirmation`.
  - `completed` when `currentValue >= targetValue`.
  - `at_risk` when not completed and `deadline` is within 14 days or earlier.
  - `in_progress` when `currentValue > 0` and below target.
  - `not_started` when `currentValue = 0` and not at risk.

## File Structure

### Backend

- Modify: `packages/backend/src/db/schema.ts`
  - Add `customRequirements` table.
- Create: `packages/backend/src/modules/custom-requirements/custom-requirement.types.ts`
  - Shared backend TypeScript types for derived status and row DTOs.
- Create: `packages/backend/src/modules/custom-requirements/custom-requirement.schemas.ts`
  - Zod request schemas and enum constants.
- Create: `packages/backend/src/modules/custom-requirements/custom-requirement.status.ts`
  - Pure status/progress calculation helpers.
- Create: `packages/backend/src/modules/custom-requirements/custom-requirement.repository.ts`
  - Drizzle database access.
- Create: `packages/backend/src/modules/custom-requirements/custom-requirement.routes.ts`
  - Authenticated Express routes.
- Create: `packages/backend/src/modules/custom-requirements/custom-requirement.routes.test.ts`
  - API behavior tests with an in-memory repository.
- Modify: `packages/backend/src/app.ts`
  - Register `/api/custom-requirements` router and dependency.
- Modify: `packages/backend/src/index.ts`
  - Create and inject Drizzle repository.
- Generate: `packages/backend/drizzle/*.sql`
  - Migration adding `custom_requirements`.

### Frontend

- Modify: `packages/web/src/lib/api.ts`
  - Add typed API helpers for custom requirements.
- Create: `packages/web/src/schemas/customRequirement.ts`
  - Zod schemas and TypeScript types for form input.
- Create: `packages/web/src/pages/CustomRequirementsPage.vue`
  - List, create/edit form, quick actions, show-on-home toggle.
- Create: `packages/web/src/pages/CustomRequirementsPage.test.ts`
  - Component tests for fields, show-on-home option, and progress labels.
- Modify: `packages/web/src/router.ts`
  - Replace `/custom-requirements` placeholder route with real page.
- Modify: `packages/web/src/pages/HomePage.vue`
  - Add a small custom requirements dashboard section using `showOnHome` records.
- Modify: `packages/web/src/pages/HomePage.test.ts`
  - Verify homepage only surfaces `showOnHome` custom requirements.

---

## Task 1: Backend status helper and API contract tests

**Files:**
- Create: `packages/backend/src/modules/custom-requirements/custom-requirement.types.ts`
- Create: `packages/backend/src/modules/custom-requirements/custom-requirement.status.ts`
- Test: `packages/backend/src/modules/custom-requirements/custom-requirement.status.test.ts`

- [ ] **Step 1: Write the failing status helper tests**

Create `packages/backend/src/modules/custom-requirements/custom-requirement.status.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { calculateCustomRequirementProgress, deriveCustomRequirementStatus } from "./custom-requirement.status.js";

const baseDate = new Date("2026-06-06T00:00:00.000Z");

describe("custom requirement status", () => {
  it("marks pending-confirmation sources as pending before any other status", () => {
    expect(
      deriveCustomRequirementStatus({
        source: "pending_confirmation",
        currentValue: 10,
        targetValue: 1,
        deadline: "2026-06-07",
        now: baseDate
      })
    ).toBe("pending_confirmation");
  });

  it("marks requirements completed when current value reaches target value", () => {
    expect(
      deriveCustomRequirementStatus({
        source: "user_custom",
        currentValue: 5,
        targetValue: 4,
        deadline: null,
        now: baseDate
      })
    ).toBe("completed");
  });

  it("marks unfinished requirements due within 14 days as at risk", () => {
    expect(
      deriveCustomRequirementStatus({
        source: "college_requirement",
        currentValue: 1,
        targetValue: 4,
        deadline: "2026-06-15",
        now: baseDate
      })
    ).toBe("at_risk");
  });

  it("marks partial progress outside the risk window as in progress", () => {
    expect(
      deriveCustomRequirementStatus({
        source: "user_custom",
        currentValue: 1,
        targetValue: 4,
        deadline: "2026-07-30",
        now: baseDate
      })
    ).toBe("in_progress");
  });

  it("marks zero progress outside the risk window as not started", () => {
    expect(
      deriveCustomRequirementStatus({
        source: "user_custom",
        currentValue: 0,
        targetValue: 4,
        deadline: null,
        now: baseDate
      })
    ).toBe("not_started");
  });

  it("caps display progress at 100 percent while preserving over-completion values", () => {
    expect(calculateCustomRequirementProgress({ currentValue: 5, targetValue: 4 })).toEqual({
      ratio: 1,
      percent: 100
    });
  });
});
```

- [ ] **Step 2: Run status helper tests to verify RED**

Run:

```bash
pnpm --filter @gradcheck/backend test -- src/modules/custom-requirements/custom-requirement.status.test.ts
```

Expected: FAIL because `custom-requirement.status.js` does not exist.

- [ ] **Step 3: Implement types and status helper**

Create `packages/backend/src/modules/custom-requirements/custom-requirement.types.ts`:

```ts
export type CustomRequirementKind = "count" | "hours" | "credits" | "boolean";
export type CustomRequirementCategory = "lecture" | "volunteer" | "labor" | "practice" | "college" | "sports" | "exam" | "other";
export type CustomRequirementImportance = "required" | "optional" | "personal_goal";
export type CustomRequirementSource = "user_custom" | "college_requirement" | "pending_confirmation";
export type CustomRequirementStatus = "pending_confirmation" | "completed" | "at_risk" | "in_progress" | "not_started";

export interface CustomRequirementDto {
  id: string;
  userId: string;
  name: string;
  kind: CustomRequirementKind;
  category: CustomRequirementCategory;
  targetValue: string;
  currentValue: string;
  unit: string;
  importance: CustomRequirementImportance;
  source: CustomRequirementSource;
  includeInProgress: boolean;
  showOnHome: boolean;
  deadline: string | null;
  notes: string | null;
  status: CustomRequirementStatus;
  progressPercent: number;
  createdAt: Date;
  updatedAt: Date;
}
```

Create `packages/backend/src/modules/custom-requirements/custom-requirement.status.ts`:

```ts
import type { CustomRequirementSource, CustomRequirementStatus } from "./custom-requirement.types.js";

interface StatusInput {
  source: CustomRequirementSource;
  currentValue: number;
  targetValue: number;
  deadline: string | null;
  now?: Date;
}

interface ProgressInput {
  currentValue: number;
  targetValue: number;
}

function isWithinRiskWindow(deadline: string | null, now: Date): boolean {
  if (!deadline) {
    return false;
  }

  const deadlineDate = new Date(`${deadline}T23:59:59.999Z`);
  const millisecondsUntilDeadline = deadlineDate.getTime() - now.getTime();
  const daysUntilDeadline = millisecondsUntilDeadline / (1000 * 60 * 60 * 24);
  return daysUntilDeadline <= 14;
}

export function deriveCustomRequirementStatus(input: StatusInput): CustomRequirementStatus {
  if (input.source === "pending_confirmation") {
    return "pending_confirmation";
  }

  if (input.currentValue >= input.targetValue) {
    return "completed";
  }

  if (isWithinRiskWindow(input.deadline, input.now ?? new Date())) {
    return "at_risk";
  }

  if (input.currentValue > 0) {
    return "in_progress";
  }

  return "not_started";
}

export function calculateCustomRequirementProgress(input: ProgressInput): { ratio: number; percent: number } {
  if (input.targetValue <= 0) {
    return { ratio: 0, percent: 0 };
  }

  const ratio = Math.min(input.currentValue / input.targetValue, 1);
  return {
    ratio,
    percent: Math.round(ratio * 100)
  };
}
```

- [ ] **Step 4: Run status helper tests to verify GREEN**

Run:

```bash
pnpm --filter @gradcheck/backend test -- src/modules/custom-requirements/custom-requirement.status.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/backend/src/modules/custom-requirements/custom-requirement.types.ts \
  packages/backend/src/modules/custom-requirements/custom-requirement.status.ts \
  packages/backend/src/modules/custom-requirements/custom-requirement.status.test.ts
git commit -m "feat: add custom requirement status helpers"
```

---

## Task 2: Database schema, repository, and authenticated API

**Files:**
- Modify: `packages/backend/src/db/schema.ts`
- Create: `packages/backend/src/modules/custom-requirements/custom-requirement.schemas.ts`
- Create: `packages/backend/src/modules/custom-requirements/custom-requirement.repository.ts`
- Create: `packages/backend/src/modules/custom-requirements/custom-requirement.routes.ts`
- Create: `packages/backend/src/modules/custom-requirements/custom-requirement.routes.test.ts`
- Modify: `packages/backend/src/app.ts`
- Modify: `packages/backend/src/index.ts`
- Generate: `packages/backend/drizzle/*.sql`

- [ ] **Step 1: Write failing API route tests**

Create `packages/backend/src/modules/custom-requirements/custom-requirement.routes.test.ts`:

```ts
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import type { AuthRepository, UserRecord } from "../auth/auth.repository.js";
import { createCustomRequirementRouter } from "./custom-requirement.routes.js";
import type { CustomRequirementDto } from "./custom-requirement.types.js";

const now = new Date("2026-06-06T00:00:00.000Z");
const user: UserRecord = {
  id: "user-1",
  email: "student@example.com",
  passwordHash: "hash",
  createdAt: now,
  updatedAt: now
};

function createAuthRepository(): AuthRepository {
  return {
    async findUserByEmail() {
      return user;
    },
    async findUserById(id) {
      return id === user.id ? user : null;
    },
    async createUser() {
      return user;
    },
    async getProfile() {
      return null;
    },
    async upsertProfile() {
      throw new Error("not used");
    },
    async recordAuditLog() {
      return;
    }
  };
}

function createRepository() {
  const rows = new Map<string, CustomRequirementDto>();

  return {
    async listByUserId(userId: string) {
      return [...rows.values()].filter((row) => row.userId === userId);
    },
    async create(userId: string, input: Omit<CustomRequirementDto, "id" | "userId" | "status" | "progressPercent" | "createdAt" | "updatedAt">) {
      const row: CustomRequirementDto = {
        id: `requirement-${rows.size + 1}`,
        userId,
        ...input,
        status: input.source === "pending_confirmation" ? "pending_confirmation" : "in_progress",
        progressPercent: 50,
        createdAt: now,
        updatedAt: now
      };
      rows.set(row.id, row);
      return row;
    },
    async update(userId: string, id: string, input: Partial<Omit<CustomRequirementDto, "id" | "userId" | "status" | "progressPercent" | "createdAt" | "updatedAt">>) {
      const existing = rows.get(id);
      if (!existing || existing.userId !== userId) {
        return null;
      }
      const row = { ...existing, ...input, updatedAt: now };
      rows.set(id, row);
      return row;
    },
    async delete(userId: string, id: string) {
      const existing = rows.get(id);
      if (!existing || existing.userId !== userId) {
        return false;
      }
      rows.delete(id);
      return true;
    }
  };
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/custom-requirements", createCustomRequirementRouter({
    authRepository: createAuthRepository(),
    customRequirementRepository: createRepository()
  }));
  app.use(errorHandler);
  return app;
}

describe("custom requirement routes", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", "test-secret-that-is-long-enough");
  });

  it("creates and lists a custom requirement with showOnHome enabled", async () => {
    const app = createApp();
    const token = await import("jsonwebtoken").then((jwt) => jwt.default.sign({ sub: user.id }, "test-secret-that-is-long-enough"));

    const createResponse = await request(app)
      .post("/api/custom-requirements")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "人文讲座",
        kind: "count",
        category: "lecture",
        targetValue: "4",
        currentValue: "2",
        unit: "次",
        importance: "required",
        source: "user_custom",
        includeInProgress: true,
        showOnHome: true,
        deadline: "2026-06-30",
        notes: "需要学院认定"
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.customRequirement).toMatchObject({
      name: "人文讲座",
      kind: "count",
      showOnHome: true,
      includeInProgress: true
    });

    const listResponse = await request(app)
      .get("/api/custom-requirements")
      .set("Authorization", `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.customRequirements).toHaveLength(1);
  });

  it("updates progress and deletes a custom requirement", async () => {
    const app = createApp();
    const token = await import("jsonwebtoken").then((jwt) => jwt.default.sign({ sub: user.id }, "test-secret-that-is-long-enough"));

    const createResponse = await request(app)
      .post("/api/custom-requirements")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "志愿服务",
        kind: "hours",
        category: "volunteer",
        targetValue: "20",
        currentValue: "5",
        unit: "小时",
        importance: "required",
        source: "user_custom",
        includeInProgress: true,
        showOnHome: false,
        deadline: null,
        notes: null
      });

    const id = createResponse.body.customRequirement.id as string;

    const updateResponse = await request(app)
      .put(`/api/custom-requirements/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ currentValue: "20", showOnHome: true });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.customRequirement).toMatchObject({ currentValue: "20", showOnHome: true });

    await request(app)
      .delete(`/api/custom-requirements/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);
  });
});
```

- [ ] **Step 2: Run API tests to verify RED**

Run:

```bash
pnpm --filter @gradcheck/backend test -- src/modules/custom-requirements/custom-requirement.routes.test.ts
```

Expected: FAIL because `custom-requirement.routes.js` does not exist.

- [ ] **Step 3: Add Drizzle schema**

Modify `packages/backend/src/db/schema.ts`:

```ts
import { boolean, integer, jsonb, numeric, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
```

Append after `userProfiles`:

```ts
export const customRequirements = pgTable("custom_requirements", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  kind: varchar("kind", { length: 32 }).notNull(),
  category: varchar("category", { length: 32 }).notNull(),
  targetValue: numeric("target_value", { precision: 8, scale: 2 }).notNull(),
  currentValue: numeric("current_value", { precision: 8, scale: 2 }).notNull().default("0"),
  unit: varchar("unit", { length: 24 }).notNull(),
  importance: varchar("importance", { length: 32 }).notNull(),
  source: varchar("source", { length: 32 }).notNull(),
  includeInProgress: boolean("include_in_progress").notNull().default(true),
  showOnHome: boolean("show_on_home").notNull().default(true),
  deadline: varchar("deadline", { length: 10 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
```

- [ ] **Step 4: Implement schemas, repository, and routes**

Create `packages/backend/src/modules/custom-requirements/custom-requirement.schemas.ts`:

```ts
import { z } from "zod";

export const customRequirementKindSchema = z.enum(["count", "hours", "credits", "boolean"]);
export const customRequirementCategorySchema = z.enum(["lecture", "volunteer", "labor", "practice", "college", "sports", "exam", "other"]);
export const customRequirementImportanceSchema = z.enum(["required", "optional", "personal_goal"]);
export const customRequirementSourceSchema = z.enum(["user_custom", "college_requirement", "pending_confirmation"]);

const decimalStringSchema = z.string().regex(/^\d+(\.\d{1,2})?$/);
const deadlineSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

export const createCustomRequirementSchema = z.object({
  name: z.string().min(1).max(120),
  kind: customRequirementKindSchema,
  category: customRequirementCategorySchema,
  targetValue: decimalStringSchema,
  currentValue: decimalStringSchema.default("0"),
  unit: z.string().min(1).max(24),
  importance: customRequirementImportanceSchema.default("required"),
  source: customRequirementSourceSchema.default("user_custom"),
  includeInProgress: z.boolean().default(true),
  showOnHome: z.boolean().default(true),
  deadline: deadlineSchema.default(null),
  notes: z.string().max(1000).nullable().default(null)
});

export const updateCustomRequirementSchema = createCustomRequirementSchema.partial();
```

Create `packages/backend/src/modules/custom-requirements/custom-requirement.repository.ts`:

```ts
import { and, eq } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { customRequirements } from "../../db/schema.js";
import { calculateCustomRequirementProgress, deriveCustomRequirementStatus } from "./custom-requirement.status.js";
import type { CustomRequirementDto } from "./custom-requirement.types.js";

export type CustomRequirementInput = Omit<CustomRequirementDto, "id" | "userId" | "status" | "progressPercent" | "createdAt" | "updatedAt">;
export type CustomRequirementUpdateInput = Partial<CustomRequirementInput>;

export interface CustomRequirementRepository {
  listByUserId(userId: string): Promise<CustomRequirementDto[]>;
  create(userId: string, input: CustomRequirementInput): Promise<CustomRequirementDto>;
  update(userId: string, id: string, input: CustomRequirementUpdateInput): Promise<CustomRequirementDto | null>;
  delete(userId: string, id: string): Promise<boolean>;
}

function toNumber(value: string): number {
  return Number(value);
}

function toDto(row: typeof customRequirements.$inferSelect): CustomRequirementDto {
  const currentValue = toNumber(row.currentValue);
  const targetValue = toNumber(row.targetValue);
  const status = deriveCustomRequirementStatus({
    source: row.source as CustomRequirementDto["source"],
    currentValue,
    targetValue,
    deadline: row.deadline,
  });
  const progress = calculateCustomRequirementProgress({ currentValue, targetValue });

  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    kind: row.kind as CustomRequirementDto["kind"],
    category: row.category as CustomRequirementDto["category"],
    targetValue: row.targetValue,
    currentValue: row.currentValue,
    unit: row.unit,
    importance: row.importance as CustomRequirementDto["importance"],
    source: row.source as CustomRequirementDto["source"],
    includeInProgress: row.includeInProgress,
    showOnHome: row.showOnHome,
    deadline: row.deadline,
    notes: row.notes,
    status,
    progressPercent: progress.percent,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function createCustomRequirementRepository(db: Database): CustomRequirementRepository {
  return {
    async listByUserId(userId) {
      const rows = await db.select().from(customRequirements).where(eq(customRequirements.userId, userId));
      return rows.map(toDto);
    },
    async create(userId, input) {
      const [row] = await db.insert(customRequirements).values({ userId, ...input }).returning();
      return toDto(row);
    },
    async update(userId, id, input) {
      const [row] = await db
        .update(customRequirements)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(customRequirements.userId, userId), eq(customRequirements.id, id)))
        .returning();
      return row ? toDto(row) : null;
    },
    async delete(userId, id) {
      const rows = await db
        .delete(customRequirements)
        .where(and(eq(customRequirements.userId, userId), eq(customRequirements.id, id)))
        .returning({ id: customRequirements.id });
      return rows.length > 0;
    }
  };
}
```

Create `packages/backend/src/modules/custom-requirements/custom-requirement.routes.ts`:

```ts
import { Router } from "express";

import { HttpError } from "../../lib/http-error.js";
import { authenticate } from "../../middleware/authenticate.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import { createCustomRequirementSchema, updateCustomRequirementSchema } from "./custom-requirement.schemas.js";
import type { CustomRequirementRepository } from "./custom-requirement.repository.js";

interface Dependencies {
  authRepository: AuthRepository;
  customRequirementRepository: CustomRequirementRepository;
}

export function createCustomRequirementRouter(dependencies: Dependencies): Router {
  const router = Router();
  const requireAuth = authenticate(dependencies.authRepository);

  router.get("/", requireAuth, async (req, res, next) => {
    try {
      const customRequirements = await dependencies.customRequirementRepository.listByUserId(req.userId ?? "");
      res.json({ customRequirements });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", requireAuth, async (req, res, next) => {
    try {
      const input = createCustomRequirementSchema.parse(req.body);
      const customRequirement = await dependencies.customRequirementRepository.create(req.userId ?? "", input);
      await dependencies.authRepository.recordAuditLog({
        actorUserId: req.userId ?? null,
        action: "custom_requirement.create",
        entityType: "custom_requirement",
        entityId: customRequirement.id
      });
      res.status(201).json({ customRequirement });
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id", requireAuth, async (req, res, next) => {
    try {
      const input = updateCustomRequirementSchema.parse(req.body);
      const customRequirement = await dependencies.customRequirementRepository.update(req.userId ?? "", req.params.id, input);
      if (!customRequirement) {
        throw new HttpError(404, "Custom requirement not found");
      }
      await dependencies.authRepository.recordAuditLog({
        actorUserId: req.userId ?? null,
        action: "custom_requirement.update",
        entityType: "custom_requirement",
        entityId: customRequirement.id
      });
      res.json({ customRequirement });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", requireAuth, async (req, res, next) => {
    try {
      const deleted = await dependencies.customRequirementRepository.delete(req.userId ?? "", req.params.id);
      if (!deleted) {
        throw new HttpError(404, "Custom requirement not found");
      }
      await dependencies.authRepository.recordAuditLog({
        actorUserId: req.userId ?? null,
        action: "custom_requirement.delete",
        entityType: "custom_requirement",
        entityId: req.params.id
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
```

Modify `packages/backend/src/app.ts`:

```ts
import type { CustomRequirementRepository } from "./modules/custom-requirements/custom-requirement.repository.js";
import { createCustomRequirementRouter } from "./modules/custom-requirements/custom-requirement.routes.js";
```

Extend `AppDependencies`:

```ts
customRequirementRepository: CustomRequirementRepository;
```

Register before error handler:

```ts
app.use("/api/custom-requirements", createCustomRequirementRouter({
  authRepository: dependencies.authRepository,
  customRequirementRepository: dependencies.customRequirementRepository
}));
```

Modify `packages/backend/src/index.ts`:

```ts
import { createCustomRequirementRepository } from "./modules/custom-requirements/custom-requirement.repository.js";
```

Pass dependency:

```ts
customRequirementRepository: createCustomRequirementRepository(db),
```

- [ ] **Step 5: Generate migration**

Run:

```bash
pnpm --filter @gradcheck/backend db:generate
```

Expected: a new SQL migration under `packages/backend/drizzle/` creating `custom_requirements`.

- [ ] **Step 6: Run API tests to verify GREEN**

Run:

```bash
pnpm --filter @gradcheck/backend test -- src/modules/custom-requirements/custom-requirement.routes.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add packages/backend/src packages/backend/drizzle
git commit -m "feat: add custom requirements API"
```

---

## Task 3: Frontend API client, schema, route, and page tests

**Files:**
- Modify: `packages/web/src/lib/api.ts`
- Create: `packages/web/src/schemas/customRequirement.ts`
- Create: `packages/web/src/pages/CustomRequirementsPage.vue`
- Create: `packages/web/src/pages/CustomRequirementsPage.test.ts`
- Modify: `packages/web/src/router.ts`

- [ ] **Step 1: Write failing frontend tests**

Create `packages/web/src/pages/CustomRequirementsPage.test.ts`:

```ts
import { mount, RouterLinkStub } from "@vue/test-utils";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { describe, expect, it, vi } from "vitest";

import CustomRequirementsPage from "./CustomRequirementsPage.vue";

vi.mock("vue-router", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  RouterLink: RouterLinkStub
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    getToken: () => "token",
    listCustomRequirements: async () => ({
      customRequirements: [
        {
          id: "requirement-1",
          userId: "user-1",
          name: "人文讲座",
          kind: "count",
          category: "lecture",
          targetValue: "4",
          currentValue: "2",
          unit: "次",
          importance: "required",
          source: "user_custom",
          includeInProgress: true,
          showOnHome: true,
          deadline: "2026-06-30",
          notes: "需要学院认定",
          status: "in_progress",
          progressPercent: 50,
          createdAt: "2026-06-06T00:00:00.000Z",
          updatedAt: "2026-06-06T00:00:00.000Z"
        }
      ]
    }),
    createCustomRequirement: vi.fn(),
    updateCustomRequirement: vi.fn(),
    deleteCustomRequirement: vi.fn()
  };
});

describe("CustomRequirementsPage", () => {
  it("shows existing custom requirements and the show-on-home setting", async () => {
    const wrapper = mount(CustomRequirementsPage, {
      global: {
        plugins: [VueQueryPlugin],
        stubs: { RouterLink: RouterLinkStub }
      }
    });

    await vi.dynamicImportSettled();

    expect(wrapper.text()).toContain("自定义要求");
    expect(wrapper.text()).toContain("人文讲座");
    expect(wrapper.text()).toContain("2 / 4 次");
    expect(wrapper.text()).toContain("主页展示");
  });

  it("renders the create form fields for the template model", () => {
    const wrapper = mount(CustomRequirementsPage, {
      global: {
        plugins: [VueQueryPlugin],
        stubs: { RouterLink: RouterLinkStub }
      }
    });

    expect(wrapper.get('[data-testid="custom-requirement-name"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="custom-requirement-kind"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="custom-requirement-target"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="custom-requirement-current"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="custom-requirement-show-on-home"]').exists()).toBe(true);
  });
});
```

- [ ] **Step 2: Run frontend test to verify RED**

Run:

```bash
pnpm --filter @gradcheck/web test -- src/pages/CustomRequirementsPage.test.ts
```

Expected: FAIL because `CustomRequirementsPage.vue` does not exist.

- [ ] **Step 3: Add frontend schemas and API helpers**

Create `packages/web/src/schemas/customRequirement.ts`:

```ts
import { z } from "zod";

export const customRequirementSchema = z.object({
  name: z.string().min(1, "请输入要求名称").max(120),
  kind: z.enum(["count", "hours", "credits", "boolean"]),
  category: z.enum(["lecture", "volunteer", "labor", "practice", "college", "sports", "exam", "other"]),
  targetValue: z.string().regex(/^\d+(\.\d{1,2})?$/, "请输入有效目标值"),
  currentValue: z.string().regex(/^\d+(\.\d{1,2})?$/, "请输入有效当前值"),
  unit: z.string().min(1, "请输入单位").max(24),
  importance: z.enum(["required", "optional", "personal_goal"]),
  source: z.enum(["user_custom", "college_requirement", "pending_confirmation"]),
  includeInProgress: z.boolean(),
  showOnHome: z.boolean(),
  deadline: z.string().nullable(),
  notes: z.string().nullable()
});

export type CustomRequirementInput = z.infer<typeof customRequirementSchema>;
```

Modify `packages/web/src/lib/api.ts`, append:

```ts
import type { CustomRequirementInput } from "../schemas/customRequirement";

export interface CustomRequirement extends CustomRequirementInput {
  id: string;
  userId: string;
  status: "pending_confirmation" | "completed" | "at_risk" | "in_progress" | "not_started";
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
}

export async function listCustomRequirements(): Promise<{ customRequirements: CustomRequirement[] }> {
  return request<{ customRequirements: CustomRequirement[] }>("/api/custom-requirements");
}

export async function createCustomRequirement(input: CustomRequirementInput): Promise<{ customRequirement: CustomRequirement }> {
  return request<{ customRequirement: CustomRequirement }>("/api/custom-requirements", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateCustomRequirement(id: string, input: Partial<CustomRequirementInput>): Promise<{ customRequirement: CustomRequirement }> {
  return request<{ customRequirement: CustomRequirement }>(`/api/custom-requirements/${id}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function deleteCustomRequirement(id: string): Promise<void> {
  await request<void>(`/api/custom-requirements/${id}`, {
    method: "DELETE"
  });
}
```

- [ ] **Step 4: Implement page and route**

Create `packages/web/src/pages/CustomRequirementsPage.vue`:

```vue
<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ZodError } from "zod";

import AppShell from "../components/AppShell.vue";
import { createCustomRequirement, deleteCustomRequirement, getToken, listCustomRequirements, updateCustomRequirement } from "../lib/api";
import { customRequirementSchema, type CustomRequirementInput } from "../schemas/customRequirement";

const router = useRouter();
const queryClient = useQueryClient();
const message = ref("");

if (!getToken()) {
  void router.replace("/login");
}

const form = reactive<CustomRequirementInput>({
  name: "",
  kind: "count",
  category: "lecture",
  targetValue: "1",
  currentValue: "0",
  unit: "次",
  importance: "required",
  source: "user_custom",
  includeInProgress: true,
  showOnHome: true,
  deadline: null,
  notes: null
});

const { data } = useQuery({
  queryKey: ["custom-requirements"],
  queryFn: listCustomRequirements,
  enabled: Boolean(getToken())
});

const createMutation = useMutation({
  mutationFn: async () => createCustomRequirement(customRequirementSchema.parse(form)),
  onSuccess: async () => {
    message.value = "自定义要求已创建";
    await queryClient.invalidateQueries({ queryKey: ["custom-requirements"] });
  },
  onError: (error) => {
    message.value = error instanceof ZodError ? error.issues[0]?.message ?? "表单信息不完整" : error instanceof Error ? error.message : "保存失败";
  }
});

async function incrementProgress(id: string, currentValue: string) {
  await updateCustomRequirement(id, { currentValue: String(Number(currentValue) + 1) });
  await queryClient.invalidateQueries({ queryKey: ["custom-requirements"] });
}

async function markComplete(id: string, targetValue: string) {
  await updateCustomRequirement(id, { currentValue: targetValue });
  await queryClient.invalidateQueries({ queryKey: ["custom-requirements"] });
}

async function removeRequirement(id: string) {
  await deleteCustomRequirement(id);
  await queryClient.invalidateQueries({ queryKey: ["custom-requirements"] });
}
</script>

<template>
  <AppShell>
    <section class="rounded-3xl bg-white p-6 shadow-sm">
      <h1 class="text-2xl font-bold text-[var(--tommy-text)]">自定义要求</h1>
      <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">维护学院特色要求、个人目标和待确认毕业任务。</p>

      <form class="mt-6 grid gap-4 sm:grid-cols-2" @submit.prevent="createMutation.mutate()">
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          名称
          <input data-testid="custom-requirement-name" v-model="form.name" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          类型
          <select data-testid="custom-requirement-kind" v-model="form.kind" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2">
            <option value="count">次数</option>
            <option value="hours">时长</option>
            <option value="credits">学分</option>
            <option value="boolean">完成项</option>
          </select>
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          目标值
          <input data-testid="custom-requirement-target" v-model="form.targetValue" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          当前值
          <input data-testid="custom-requirement-current" v-model="form.currentValue" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label class="flex items-center gap-2 text-sm font-medium text-[var(--tommy-text-secondary)] sm:col-span-2">
          <input data-testid="custom-requirement-show-on-home" v-model="form.showOnHome" type="checkbox" />
          主页展示
        </label>
        <button class="rounded-xl bg-[var(--tommy-primary)] px-5 py-2.5 font-semibold text-white sm:col-span-2" type="submit">新增自定义要求</button>
      </form>

      <p v-if="message" class="mt-4 rounded-xl bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] px-3 py-2 text-sm text-[var(--tommy-info)]">{{ message }}</p>
    </section>

    <section class="mt-5 grid gap-3">
      <article v-for="requirement in data?.customRequirements ?? []" :key="requirement.id" class="rounded-3xl bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-[var(--tommy-text)]">{{ requirement.name }}</h2>
            <p class="mt-1 text-sm text-[var(--tommy-text-secondary)]">{{ requirement.currentValue }} / {{ requirement.targetValue }} {{ requirement.unit }}</p>
          </div>
          <span class="rounded-full bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] px-3 py-1 text-xs font-semibold text-[var(--tommy-info)]">
            {{ requirement.showOnHome ? "主页展示" : "不在主页展示" }}
          </span>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button class="rounded-xl border border-slate-200 px-3 py-2 text-sm" type="button" @click="incrementProgress(requirement.id, requirement.currentValue)">+1</button>
          <button class="rounded-xl border border-slate-200 px-3 py-2 text-sm" type="button" @click="markComplete(requirement.id, requirement.targetValue)">标记完成</button>
          <button class="rounded-xl border border-slate-200 px-3 py-2 text-sm" type="button" @click="removeRequirement(requirement.id)">删除</button>
        </div>
      </article>
    </section>
  </AppShell>
</template>
```

Modify `packages/web/src/router.ts`:

```ts
import CustomRequirementsPage from "./pages/CustomRequirementsPage.vue";
```

Replace the `/custom-requirements` route component with `CustomRequirementsPage` and keep `meta`.

- [ ] **Step 5: Run frontend tests to verify GREEN**

Run:

```bash
pnpm --filter @gradcheck/web test -- src/pages/CustomRequirementsPage.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add packages/web/src/lib/api.ts \
  packages/web/src/schemas/customRequirement.ts \
  packages/web/src/pages/CustomRequirementsPage.vue \
  packages/web/src/pages/CustomRequirementsPage.test.ts \
  packages/web/src/router.ts
git commit -m "feat: add custom requirements page"
```

---

## Task 4: Homepage summary integration

**Files:**
- Modify: `packages/web/src/pages/HomePage.vue`
- Modify: `packages/web/src/pages/HomePage.test.ts`

- [ ] **Step 1: Write failing homepage test**

Modify `packages/web/src/pages/HomePage.test.ts` mock for `../lib/api` to include:

```ts
listCustomRequirements: async () => ({
  customRequirements: [
    {
      id: "requirement-1",
      userId: "user-1",
      name: "人文讲座",
      kind: "count",
      category: "lecture",
      targetValue: "4",
      currentValue: "2",
      unit: "次",
      importance: "required",
      source: "user_custom",
      includeInProgress: true,
      showOnHome: true,
      deadline: "2026-06-30",
      notes: null,
      status: "in_progress",
      progressPercent: 50,
      createdAt: "2026-06-06T00:00:00.000Z",
      updatedAt: "2026-06-06T00:00:00.000Z"
    },
    {
      id: "requirement-2",
      userId: "user-1",
      name: "个人阅读目标",
      kind: "count",
      category: "other",
      targetValue: "10",
      currentValue: "1",
      unit: "本",
      importance: "personal_goal",
      source: "user_custom",
      includeInProgress: false,
      showOnHome: false,
      deadline: null,
      notes: null,
      status: "in_progress",
      progressPercent: 10,
      createdAt: "2026-06-06T00:00:00.000Z",
      updatedAt: "2026-06-06T00:00:00.000Z"
    }
  ]
})
```

Add test:

```ts
it("shows only show-on-home custom requirements in the homepage summary", async () => {
  const wrapper = mountHomePage();

  await vi.dynamicImportSettled();

  const customSummary = wrapper.get('[data-testid="custom-requirements-home-summary"]');
  expect(customSummary.text()).toContain("人文讲座");
  expect(customSummary.text()).toContain("2 / 4 次");
  expect(customSummary.text()).not.toContain("个人阅读目标");
});
```

- [ ] **Step 2: Run homepage test to verify RED**

Run:

```bash
pnpm --filter @gradcheck/web test -- src/pages/HomePage.test.ts
```

Expected: FAIL because `custom-requirements-home-summary` does not exist.

- [ ] **Step 3: Implement homepage custom requirements query and summary**

Modify `packages/web/src/pages/HomePage.vue`:

```ts
import { getCurrentUser, getToken, listCustomRequirements } from "../lib/api";
```

Add query:

```ts
const { data: customRequirementsData } = useQuery({
  queryKey: ["custom-requirements"],
  queryFn: listCustomRequirements,
  enabled: computed(() => Boolean(getToken()))
});

const homeCustomRequirements = computed(() =>
  (customRequirementsData.value?.customRequirements ?? [])
    .filter((requirement) => requirement.showOnHome)
    .slice(0, 3)
);
```

Add a dashboard card inside `dashboard-card-grid` after the existing three cards:

```vue
<article data-testid="custom-requirements-home-summary" class="rounded-3xl bg-white p-5 shadow-sm">
  <div class="flex items-start justify-between gap-3">
    <div>
      <h2 class="text-lg font-bold text-[var(--tommy-text)]">自定义要求</h2>
      <p class="mt-2 text-2xl font-bold text-[var(--tommy-primary)]">{{ homeCustomRequirements.length }} 项展示</p>
    </div>
    <RouterLink to="/custom-requirements" class="text-xs font-semibold text-[var(--tommy-info)]">管理要求 &gt;</RouterLink>
  </div>
  <div class="mt-3 space-y-2">
    <p v-if="homeCustomRequirements.length === 0" class="text-sm text-[var(--tommy-text-secondary)]">还没有设置主页展示的自定义要求。</p>
    <p v-for="requirement in homeCustomRequirements" :key="requirement.id" class="text-sm text-[var(--tommy-text-secondary)]">
      {{ requirement.name }}：{{ requirement.currentValue }} / {{ requirement.targetValue }} {{ requirement.unit }}
    </p>
  </div>
</article>
```

- [ ] **Step 4: Run homepage test to verify GREEN**

Run:

```bash
pnpm --filter @gradcheck/web test -- src/pages/HomePage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add packages/web/src/pages/HomePage.vue packages/web/src/pages/HomePage.test.ts
git commit -m "feat: show custom requirements on homepage"
```

---

## Task 5: End-to-end verification and migration smoke

**Files:**
- No new files expected.

- [ ] **Step 1: Run full tests**

Run:

```bash
pnpm test
```

Expected: backend and frontend test suites pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: both packages typecheck with no TypeScript errors.

- [ ] **Step 3: Run production build**

Run:

```bash
pnpm build
```

Expected: both packages build. Vite may print the existing chunk-size warning; that warning is acceptable.

- [ ] **Step 4: Run database migration locally or against configured remote database**

Run:

```bash
pnpm db:migrate
```

Expected: migration applies successfully and creates `custom_requirements` if not already present.

- [ ] **Step 5: Start backend and verify API smoke**

Run:

```bash
PORT=3302 pnpm --filter @gradcheck/backend exec tsx src/index.ts
```

In another shell, register or log in, then call:

```bash
curl -fsS http://localhost:3302/health
```

Expected:

```json
{"status":"ok","service":"gradcheck-backend"}
```

- [ ] **Step 6: Final commit if verification required changes**

If any verification step required fixes, commit them:

```bash
git add <changed-files>
git commit -m "fix: complete custom requirements verification"
```

---

## Self-Review Notes

- Spec coverage: plan includes template fields, four kinds, categories, include-in-progress, show-on-home, source, deadline risk, progress derivation, CRUD, homepage summary, migration, and tests.
- Placeholder scan: no TBD/TODO/fill-in-later instructions remain; all task steps include concrete files and commands.
- Type consistency: backend uses `CustomRequirementDto`, frontend uses `CustomRequirement` with matching enum string values and field names.
