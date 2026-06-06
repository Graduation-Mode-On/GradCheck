# Program Plan Course Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize imported curriculum plan courses into relational tables and backfill existing `program_plans` so GPA courses can later be matched to required/elective curriculum requirements.

**Architecture:** Keep `program_plans.plan_json` as the immutable source/preview payload, and add derived relational tables for plan course groups and plan courses. Program plan import writes both the JSON plan and normalized rows inside one repository operation; a backfill script populates rows for existing plans.

**Tech Stack:** TypeScript, Express, Drizzle ORM, PostgreSQL, Zod, Vitest, pnpm monorepo.

---

## File structure

- Modify `packages/backend/src/db/schema.ts`: add `programPlanCourseGroups` and `programPlanCourses` tables.
- Create `packages/backend/src/modules/program-plans/program-plan-normalizer.ts`: convert `CurriculumPlan` JSON into normalized groups/courses.
- Modify `packages/backend/src/modules/program-plans/program-plans.repository.ts`: upsert normalized rows after `program_plans` insert; expose `backfillNormalizedCourses()`.
- Modify `packages/backend/src/app.test.ts`: assert import writes normalized rows through the in-memory repository contract.
- Create `packages/backend/src/modules/program-plans/program-plan-normalizer.test.ts`: unit tests for required courses, elective groups, choose-one requirements, and existing sample-like course data.
- Create `packages/backend/src/scripts/backfill-program-plan-courses.ts`: CLI backfill for existing `program_plans`.
- Modify `packages/backend/package.json`: add `backfill:program-courses` script.
- Generate Drizzle migration under `packages/backend/drizzle/`.
- Update `docs/course-database-map.md`: document new tables and linkage path.

## Task 1: Normalizer

**Files:**
- Create: `packages/backend/src/modules/program-plans/program-plan-normalizer.ts`
- Test: `packages/backend/src/modules/program-plans/program-plan-normalizer.test.ts`

- [ ] **Step 1: Write failing tests**

Create tests for:

```ts
import { describe, expect, it } from "vitest";
import { normalizeProgramPlanCourses } from "./program-plan-normalizer.js";
import type { CurriculumPlan } from "./program-plans.schemas.js";

describe("normalizeProgramPlanCourses", () => {
  it("normalizes required and elective courses from plan JSON", () => {
    const plan: CurriculumPlan = {
      program: { school: "东南大学", college: "软件学院", major: "软件工程", grade: "2022级", total_credits: 166 },
      courses: [
        { code: "MATH1", name: "工科数学分析I", credits: 6, category: "通识教育基础课", subcategory: "数学类", term: { year: "一", semester: "1" } },
        { code: "ELEC1", name: "专业选修A", credits: 2, category: "专业选修课", subcategory: "方向选修", term: { year: "三", semester: "1" } }
      ],
      requirements: [
        { id: "required_core", type: "required", title: "必修课程" },
        { id: "major_electives", type: "min_credits", title: "专业选修课", min_credits: 6, course_codes: ["ELEC1"] }
      ],
      semester_plan: [],
      warnings: [],
      provenance: {}
    };

    const normalized = normalizeProgramPlanCourses(plan);

    expect(normalized.groups).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceRequirementId: "required_core", name: "必修课程", requirementType: "required", minCourses: null, minCredits: null }),
      expect.objectContaining({ sourceRequirementId: "major_electives", name: "专业选修课", requirementType: "min_credits", minCourses: null, minCredits: "6" })
    ]));
    expect(normalized.courses).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "MATH1", name: "工科数学分析I", credits: "6", requirementType: "required", suggestedTerm: "一-1" }),
      expect.objectContaining({ code: "ELEC1", name: "专业选修A", credits: "2", requirementType: "min_credits", sourceRequirementId: "major_electives" })
    ]));
  });
});
```

Run:

```bash
pnpm --filter @gradcheck/backend test -- src/modules/program-plans/program-plan-normalizer.test.ts
```

Expected: fail because the normalizer file does not exist.

- [ ] **Step 2: Implement normalizer**

Create:

```ts
import type { CurriculumPlan } from "./program-plans.schemas.js";

export interface NormalizedProgramPlanCourseGroup {
  sourceRequirementId: string;
  name: string;
  requirementType: string;
  minCourses: string | null;
  minCredits: string | null;
  description: string | null;
}

export interface NormalizedProgramPlanCourse {
  sourceRequirementId: string | null;
  code: string;
  name: string;
  credits: string;
  category: string | null;
  subcategory: string | null;
  suggestedTerm: string | null;
  requirementType: string;
}

export function normalizeProgramPlanCourses(planJson: CurriculumPlan) {
  const requirementGroups = new Map<string, NormalizedProgramPlanCourseGroup>();
  const courseCodeToRequirement = new Map<string, string>();

  for (const requirement of planJson.requirements) {
    const typedRequirement = requirement as typeof requirement & {
      min_courses?: number;
      min_credits?: number;
      course_codes?: string[];
      description?: string;
    };
    requirementGroups.set(requirement.id, {
      sourceRequirementId: requirement.id,
      name: requirement.title,
      requirementType: requirement.type,
      minCourses: typedRequirement.min_courses == null ? null : String(typedRequirement.min_courses),
      minCredits: typedRequirement.min_credits == null ? null : String(typedRequirement.min_credits),
      description: typedRequirement.description ?? null
    });
    for (const code of typedRequirement.course_codes ?? []) {
      courseCodeToRequirement.set(code, requirement.id);
    }
  }

  if (!requirementGroups.has("required_core")) {
    requirementGroups.set("required_core", {
      sourceRequirementId: "required_core",
      name: "必修课程",
      requirementType: "required",
      minCourses: null,
      minCredits: null,
      description: null
    });
  }

  const courses = planJson.courses.map((course): NormalizedProgramPlanCourse => {
    const sourceRequirementId = courseCodeToRequirement.get(course.code) ?? null;
    const requirementType = sourceRequirementId ? requirementGroups.get(sourceRequirementId)?.requirementType ?? "elective" : inferRequirementType(course.category);
    return {
      sourceRequirementId: sourceRequirementId ?? (requirementType === "required" ? "required_core" : null),
      code: course.code,
      name: course.name,
      credits: String(course.credits),
      category: course.category ?? null,
      subcategory: course.subcategory ?? null,
      suggestedTerm: course.term?.year && course.term?.semester ? `${course.term.year}-${course.term.semester}` : null,
      requirementType
    };
  });

  return {
    groups: [...requirementGroups.values()],
    courses
  };
}

function inferRequirementType(category?: string | null) {
  if (!category) return "unknown";
  return category.includes("选修") || category.includes("任选") || category.includes("限选") ? "elective" : "required";
}
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm --filter @gradcheck/backend test -- src/modules/program-plans/program-plan-normalizer.test.ts
pnpm --filter @gradcheck/backend typecheck
```

Expected: pass.

## Task 2: Schema, repository integration, and migration

**Files:**
- Modify: `packages/backend/src/db/schema.ts`
- Modify: `packages/backend/src/modules/program-plans/program-plans.repository.ts`
- Modify: `packages/backend/src/app.test.ts`
- Generated: `packages/backend/drizzle/*`

- [ ] **Step 1: Add schema tables**

Add tables:

```ts
export const programPlanCourseGroups = pgTable("program_plan_course_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  programPlanId: uuid("program_plan_id").notNull().references(() => programPlans.id, { onDelete: "cascade" }),
  sourceRequirementId: varchar("source_requirement_id", { length: 160 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  requirementType: varchar("requirement_type", { length: 40 }).notNull(),
  minCourses: numeric("min_courses", { precision: 6, scale: 2 }),
  minCredits: numeric("min_credits", { precision: 6, scale: 2 }),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const programPlanCourses = pgTable("program_plan_courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  programPlanId: uuid("program_plan_id").notNull().references(() => programPlans.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").references(() => programPlanCourseGroups.id, { onDelete: "set null" }),
  sourceRequirementId: varchar("source_requirement_id", { length: 160 }),
  code: varchar("code", { length: 80 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  credits: numeric("credits", { precision: 5, scale: 2 }).notNull(),
  category: varchar("category", { length: 120 }),
  subcategory: varchar("subcategory", { length: 120 }),
  suggestedTerm: varchar("suggested_term", { length: 40 }),
  requirementType: varchar("requirement_type", { length: 40 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
```

- [ ] **Step 2: Update repository**

After inserting `program_plans`, call the normalizer and insert groups/courses. Delete existing normalized rows before rewriting a plan if needed. Add `backfillNormalizedCourses()` that iterates `program_plans` and calls the same helper.

- [ ] **Step 3: Generate migration**

Run:

```bash
pnpm db:generate
```

Expected: migration creates both normalized tables with FKs.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm --filter @gradcheck/backend test -- src/app.test.ts src/modules/program-plans/program-plan-normalizer.test.ts
pnpm --filter @gradcheck/backend typecheck
```

Expected: pass.

## Task 3: Backfill existing data

**Files:**
- Create: `packages/backend/src/scripts/backfill-program-plan-courses.ts`
- Modify: `packages/backend/package.json`
- Update: `docs/course-database-map.md`

- [ ] **Step 1: Add script**

Create script that loads config, creates DB/repository, calls `backfillNormalizedCourses()`, and logs affected plan count.

- [ ] **Step 2: Add package script**

Add:

```json
"backfill:program-courses": "tsx src/scripts/backfill-program-plan-courses.ts"
```

- [ ] **Step 3: Update docs**

Document `program_plan_course_groups` and `program_plan_courses` as active tables and explain how they link to `gpa_courses`.

- [ ] **Step 4: Run migration and backfill**

Run:

```bash
pnpm db:migrate
pnpm --filter @gradcheck/backend backfill:program-courses
```

Expected: existing `program_plans` are backfilled into normalized tables.

## Task 4: Final verification

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: all pass.
