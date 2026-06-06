# Lecture Practice and Volunteer Labor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build persistent `/lecture-practice` and `/volunteer` progress pages for lecture/practice and volunteer/labor graduation requirements.

**Architecture:** Add two user-scoped summary tables and authenticated GET/PUT APIs. Add two Vue pages sharing a `RequirementProgressCard` component, with page-level form state, manual numeric input, `+1/-1` controls, and full-page saves.

**Tech Stack:** Express 5, Drizzle ORM, PostgreSQL, Zod, Vitest, Supertest, Vue 3, Vue Router, TanStack Vue Query, Tailwind CSS, Vue Test Utils.

---

## Database Baseline

Current configured database contains `users`, `user_profiles`, `audit_logs`, `plaza_posts`, `custom_requirements`, and program-related tables. It does **not** contain `lecture_practice_progress` or `volunteer_labor_progress`; this implementation must add them via Drizzle migration.

## File Structure

- Modify `packages/backend/src/db/schema.ts`: add `lecturePracticeProgress` and `volunteerLaborProgress`.
- Create `packages/backend/src/modules/lecture-practice/lecture-practice.schemas.ts`: Zod schemas and types.
- Create `packages/backend/src/modules/lecture-practice/lecture-practice.repository.ts`: get/upsert logic with default zero progress.
- Create `packages/backend/src/modules/lecture-practice/lecture-practice.routes.ts`: authenticated GET/PUT routes.
- Create `packages/backend/src/modules/volunteer-labor/volunteer-labor.schemas.ts`: Zod schemas and types.
- Create `packages/backend/src/modules/volunteer-labor/volunteer-labor.repository.ts`: get/upsert logic with default zero progress.
- Create `packages/backend/src/modules/volunteer-labor/volunteer-labor.routes.ts`: authenticated GET/PUT routes.
- Modify `packages/backend/src/app.ts`, `packages/backend/src/index.ts`, `packages/backend/src/app.test.ts`: dependency injection, routes, and API tests.
- Create `packages/web/src/components/RequirementProgressCard.vue`: reusable editable requirement card.
- Create `packages/web/src/pages/LecturePracticePage.vue`: lecture/practice page.
- Create `packages/web/src/pages/VolunteerPage.vue`: volunteer/labor page.
- Create `packages/web/src/schemas/lecturePractice.ts` and `packages/web/src/schemas/volunteerLabor.ts`: frontend types, schemas, and progress status helpers.
- Modify `packages/web/src/lib/api.ts`: API client methods.
- Modify `packages/web/src/router.ts`, `packages/web/src/router.test.ts`, `packages/web/src/pages/HomePage.vue`, `packages/web/src/pages/HomePage.test.ts`: new route and homepage link.
- Add page tests for the two new pages.

---

### Task 1: Backend RED Tests

**Files:**
- Modify: `packages/backend/src/app.test.ts`

- [ ] **Step 1: Add failing API tests**

Add tests that create an app with in-memory `lecturePracticeRepository` and `volunteerLaborRepository`, then assert:

```ts
await request(app).get("/api/lecture-practice/me").expect(401);
await request(app).get("/api/volunteer-labor/me").expect(401);
```

After registering a user, assert:

```ts
expect((await request(app).get("/api/lecture-practice/me").set("Authorization", `Bearer ${token}`)).body.progress).toMatchObject({
  humanLectureCount: 0,
  bookReportCount: 0,
  socialPracticeCredits: "0.00",
  socialPracticeCourseCount: 0
});
```

Then PUT lecture progress:

```ts
{
  humanLectureCount: 8,
  bookReportCount: 2,
  socialPracticeCredits: "3.00",
  socialPracticeCourseCount: 1
}
```

and GET it back. Repeat for volunteer progress:

```ts
{
  volunteerHours: "12.00",
  ordinaryLaborCount: 2,
  specialLaborCount: 1
}
```

Also assert negative values and non-integer count fields return 400.

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @gradcheck/backend test -- app.test.ts
```

Expected: FAIL because app dependencies and routes do not exist.

---

### Task 2: Backend Implementation

**Files:**
- Modify: `packages/backend/src/db/schema.ts`
- Create backend module files listed in File Structure
- Modify: `packages/backend/src/app.ts`
- Modify: `packages/backend/src/index.ts`

- [ ] **Step 1: Add Drizzle tables**

Add `lecturePracticeProgress` and `volunteerLaborProgress` with `userId` primary key, numeric/integer progress fields, and timestamps.

- [ ] **Step 2: Add schemas**

Lecture schema validates:

```ts
humanLectureCount: z.coerce.number().int().min(0)
bookReportCount: z.coerce.number().int().min(0)
socialPracticeCredits: z.string().regex(/^\d+(\.\d{1,2})?$/)
socialPracticeCourseCount: z.coerce.number().int().min(0)
```

Volunteer schema validates:

```ts
volunteerHours: z.string().regex(/^\d+(\.\d{1,2})?$/)
ordinaryLaborCount: z.coerce.number().int().min(0)
specialLaborCount: z.coerce.number().int().min(0)
```

- [ ] **Step 3: Add repositories**

Each repository exposes:

```ts
getProgress(userId: string): Promise<Progress>
upsertProgress(userId: string, input: ProgressInput): Promise<Progress>
```

GET returns all-zero defaults when no row exists.

- [ ] **Step 4: Add routes and app wiring**

Mount:

```ts
app.use("/api/lecture-practice", createLecturePracticeRouter(authRepository, lecturePracticeRepository));
app.use("/api/volunteer-labor", createVolunteerLaborRouter(authRepository, volunteerLaborRepository));
```

- [ ] **Step 5: Verify GREEN**

Run:

```bash
pnpm --filter @gradcheck/backend typecheck
pnpm --filter @gradcheck/backend test -- app.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src
git commit -m "feat: add lecture volunteer progress API"
```

---

### Task 3: Frontend RED Tests

**Files:**
- Modify: `packages/web/src/router.test.ts`
- Modify: `packages/web/src/pages/HomePage.test.ts`
- Create: `packages/web/src/pages/LecturePracticePage.test.ts`
- Create: `packages/web/src/pages/VolunteerPage.test.ts`

- [ ] **Step 1: Add route and homepage failing tests**

Assert router has `lecture-practice` at `/lecture-practice` and homepage `讲座实践` entry resolves there.

- [ ] **Step 2: Add page failing tests**

Lecture page tests assert no token redirects, cards render targets `8 次`, `2 次`, `1 学分`, `1 次`, `+1/-1` update inputs, decrement does not go below zero, and saving calls `updateLecturePracticeProgress`.

Volunteer page tests assert no token redirects, cards render targets `12 小时`, `2 次`, `1 次`, `+1/-1` update inputs, and saving calls `updateVolunteerLaborProgress`.

- [ ] **Step 3: Verify RED**

Run:

```bash
pnpm --filter @gradcheck/web test -- LecturePracticePage.test.ts VolunteerPage.test.ts router.test.ts HomePage.test.ts
```

Expected: FAIL because pages/routes/components do not exist.

---

### Task 4: Frontend Implementation

**Files:**
- Create/modify frontend files listed in File Structure

- [ ] **Step 1: Add frontend schemas and API functions**

Add progress types and API functions:

```ts
getLecturePracticeProgress()
updateLecturePracticeProgress(input)
getVolunteerLaborProgress()
updateVolunteerLaborProgress(input)
```

- [ ] **Step 2: Add `RequirementProgressCard.vue`**

Props include title, unit, target, value, min, step, status text, and missing text. Emits updated numeric/string value and save. Renders `-1`, input, `+1`, and save.

- [ ] **Step 3: Add pages**

Both pages use `useQuery`, `useMutation`, login redirect, page-level reactive progress object, status calculations, and editable cards.

- [ ] **Step 4: Add route and homepage link**

Import `LecturePracticePage` and `VolunteerPage`; set `/lecture-practice` and `/volunteer`; update homepage `讲座实践` entry to `/lecture-practice`.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
pnpm --filter @gradcheck/web typecheck
pnpm --filter @gradcheck/web test -- LecturePracticePage.test.ts VolunteerPage.test.ts router.test.ts HomePage.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src
git commit -m "feat: build lecture volunteer pages"
```

---

### Task 5: Migration and Full Verification

**Files:**
- Create: new Drizzle migration under `packages/backend/drizzle`
- Modify: Drizzle metadata

- [ ] **Step 1: Generate migration**

Run:

```bash
pnpm db:generate
```

Expected: migration creates `lecture_practice_progress` and `volunteer_labor_progress`.

- [ ] **Step 2: Full verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: all pass.

- [ ] **Step 3: Commit migration**

```bash
git add packages/backend/drizzle
git commit -m "chore: add lecture volunteer migration"
```

---

## Self-Review Notes

- Spec coverage: routes, navigation, two pages, two tables, four APIs, +1/-1 controls, manual input, validation, default zero progress, and testing are covered.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: progress field names match the spec and planned frontend/backend APIs.
