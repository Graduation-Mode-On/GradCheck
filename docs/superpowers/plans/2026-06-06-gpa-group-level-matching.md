# GPA Group-level Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend GPA-to-program matching so courses can match either exact/alias/high-confidence plan courses or broader requirement groups, including general education and elective groups.

**Architecture:** Expand `user_course_plan_matches` to support `course` and `group` targets. The matcher first tries exact/alias/high-confidence course matching, then falls back to group-level matching using transcript markers, GPA eligibility, category/requirement group names, and elective/general-education rules.

**Tech Stack:** TypeScript, Drizzle ORM, PostgreSQL, Vitest, pnpm monorepo.

---

## Task 1: Matcher behavior

Files:
- Modify `packages/backend/src/modules/gpa/course-plan-matcher.ts`
- Modify `packages/backend/src/modules/gpa/course-plan-matcher.test.ts`

Steps:
- Add tests for:
  - Alias match auto-confirms `程序设计及算法语言Ⅱ` -> `程序设计基础及语言II(双语)`.
  - High-confidence required match accepts `大学物理BⅠ` -> `大学物理(B)Ⅰ`.
  - Elective/group match maps `▲电影艺术理论与实践` or a generic elective course to a group without requiring same course name.
  - Low-confidence unrelated courses stay unmatched.
- Implement:
  - Alias dictionary.
  - `matchTargetType: "course" | "group"`.
  - `confirmedByUser` output flag.
  - Course matching thresholds: exact/alias auto-confirm, high-confidence required accepted.
  - Group fallback for general education/elective categories.
- Verify backend matcher tests and typecheck.

## Task 2: Schema and repository

Files:
- Modify `packages/backend/src/db/schema.ts`
- Modify `packages/backend/src/modules/gpa/gpa.repository.ts`
- Modify `packages/backend/src/app.test.ts`
- Generate migration.

Steps:
- Update `user_course_plan_matches`:
  - `program_plan_course_id` nullable.
  - Add `program_plan_course_group_id` nullable FK.
  - Add `match_target_type`.
  - Keep `match_method`, `confidence`, `confirmed_by_user`.
- Repository writes either course or group match.
- `is_required=true` only when matched target is a course or group with `requirement_type='required'`.
- App tests assert:
  - Required course alias import becomes `isRequired=true`.
  - General education course creates a group match but does not become `isRequired=true` unless the group is required.
- Verify app tests and typecheck.

## Task 3: Backfill and docs

Files:
- Modify `packages/backend/src/scripts/backfill-gpa-course-plan-matches.ts`
- Modify `docs/course-database-map.md`

Steps:
- Backfill script reruns group-level matcher for existing users.
- Run migration and backfill against current DB.
- Verify:
  - More than previous 48 matches after backfill.
  - General education courses are matched to groups.
  - Required flags remain correct.
- Update docs to describe group-level matches.

## Task 4: Final verification and merge

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Merge back to `main`, rerun `pnpm test`, then clean up worktree.
