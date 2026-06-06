# GPA Course Plan Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist links between GPA courses and normalized program-plan courses, use those links to sync required/elective flags, and clean transcript parsing artifacts.

**Architecture:** Add a `user_course_plan_matches` table as the durable matching layer between `gpa_courses` and `program_plan_courses`. Matching runs after GPA transcript import and during a cleanup/backfill script; parser-level filtering prevents numeric grade-scale artifacts from becoming GPA courses.

**Tech Stack:** TypeScript, Express, Drizzle ORM, PostgreSQL, Zod, Vitest, pnpm monorepo.

---

## File structure

- Modify `packages/backend/src/db/schema.ts`: add `userCoursePlanMatches`.
- Create `packages/backend/src/modules/gpa/course-plan-matcher.ts`: normalize names, match GPA courses to plan courses, compute confidence/method.
- Test `packages/backend/src/modules/gpa/course-plan-matcher.test.ts`.
- Modify `packages/backend/src/modules/gpa/transcript-parser.ts`: reject numeric/grade-scale artifact names.
- Update `packages/backend/src/modules/gpa/transcript-parser.test.ts`.
- Modify `packages/backend/src/modules/gpa/gpa.repository.ts`: add methods to match and sync required flags.
- Modify `packages/backend/src/modules/gpa/gpa.service.ts`: run match/sync after transcript import.
- Modify `packages/backend/src/app.test.ts`: assert transcript import updates `isRequired` for matched required courses.
- Create `packages/backend/src/scripts/backfill-gpa-course-plan-matches.ts`: delete artifact GPA rows, match existing GPA courses, sync required flags, recalculate GPA.
- Modify `packages/backend/package.json`: add `backfill:gpa-course-matches`.
- Generate migration under `packages/backend/drizzle/`.

## Task 1: Matcher and parser cleanup

1. Add failing tests:
   - `course-plan-matcher.test.ts` should verify normalized matching handles Roman numerals, full-width parentheses, and credit equality.
   - `transcript-parser.test.ts` should verify pure numeric artifact names like `3.53.02.82.5` are not parsed.
2. Implement `normalizeCourseName`, `matchGpaCourseToPlanCourse`, and `isTranscriptArtifactName`.
3. Verify:
   - `pnpm --filter @gradcheck/backend test -- src/modules/gpa/course-plan-matcher.test.ts src/modules/gpa/transcript-parser.test.ts`
   - `pnpm --filter @gradcheck/backend typecheck`

## Task 2: Schema and repository integration

1. Add `user_course_plan_matches` table:
   - `id`
   - `user_id`
   - `gpa_course_id`
   - `program_plan_course_id`
   - `match_method`
   - `confidence`
   - `confirmed_by_user`
   - timestamps
2. Generate migration with `pnpm db:generate`.
3. Add repository method `matchCoursesToProgramPlan(userId)` that:
   - Finds the user's active `program_plan_id`.
   - Loads `gpa_courses` and `program_plan_courses`.
   - Writes one best match per GPA course.
   - Sets `gpa_courses.is_required=true` when matched plan course has `requirement_type='required'`.
   - Leaves unmatched courses unchanged.
   - Recalculates GPA result after syncing flags.
4. Update app tests to verify import of a known required course changes `isRequired` to true.
5. Verify backend tests and typecheck.

## Task 3: Existing data cleanup and backfill

1. Add `backfill-gpa-course-plan-matches.ts`.
2. Script should:
   - Delete artifact GPA rows whose names are detected by `isTranscriptArtifactName`.
   - For each user with GPA courses, run `matchCoursesToProgramPlan`.
   - Log deleted artifact count and matched count.
3. Add package script `backfill:gpa-course-matches`.
4. Run migration and backfill against current DB.
5. Verify suspicious artifact row is gone and matched required rows now have `is_required=true`.

## Task 4: Final verification

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: all pass.
