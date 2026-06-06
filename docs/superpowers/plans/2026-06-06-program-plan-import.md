# Program Plan Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `/plans` as a logged-in PDF upload, sample JSON preview, and program plan binding flow.

**Architecture:** Add a backend `program-plans` module that stores `pdf-extract`-style JSON and user bindings. Add a Vue `PlansPage` wizard that uploads a PDF to a mock parser, previews the bundled sample plan JSON, and imports/binds it to the current user.

**Tech Stack:** Express 5, Multer, Drizzle ORM, PostgreSQL JSONB, Zod, Vitest, Supertest, Vue 3, Vue Router, TanStack Vue Query, Tailwind CSS.

---

## Task 1: Backend Program Plans API

**Files:** `packages/backend/src/db/schema.ts`, `packages/backend/src/modules/program-plans/*`, `packages/backend/src/app.ts`, `packages/backend/src/index.ts`, `packages/backend/src/app.test.ts`

- [ ] Write failing backend tests for unauthenticated access, mock PDF upload, non-PDF rejection, import, and GET current binding.
- [ ] Add `programPlans` and `userProgramPlanBindings` tables.
- [ ] Add `program-plans` schemas/types aligned to `pdf-extract` JSON top-level shape.
- [ ] Add repository and routes.
- [ ] Copy a trimmed sample fixture from `/Users/river/Documents/Projects/pdf-extract/plan.json` into backend module.
- [ ] Wire app/index dependencies.
- [ ] Run backend tests/typecheck and commit.

## Task 2: Frontend Plans Page

**Files:** `packages/web/src/pages/PlansPage.vue`, `packages/web/src/schemas/programPlan.ts`, `packages/web/src/lib/api.ts`, `packages/web/src/router.ts`, frontend tests.

- [ ] Write failing frontend tests for `/plans`, login redirect, mock upload preview, course search/category filter, import success, and existing binding display.
- [ ] Add frontend program plan schema/types and API functions.
- [ ] Implement `PlansPage.vue` with three-step wizard and preview sections.
- [ ] Route `/plans` to `PlansPage`.
- [ ] Run frontend tests/typecheck and commit.

## Task 3: Migration and Verification

**Files:** `packages/backend/drizzle/*`

- [ ] Run `pnpm db:generate`.
- [ ] Verify migration creates `program_plans` and `user_program_plan_bindings`.
- [ ] Run `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- [ ] Commit migration.

## Self-Review Notes

- Spec coverage: upload, sample preview, import/bind, current binding, pdf-extract JSON preservation, and tests are covered.
- Placeholder scan: no pending placeholders.
- Type consistency: route path `/api/program-plans`, page `/plans`, and schema names are consistent.
