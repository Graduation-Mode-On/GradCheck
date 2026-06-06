# Program Plan Import Design

## Context

GradCheck currently has a `/plans` route that renders a placeholder page. The backend already has a `program-rules` module that can upload PDFs and store parsed drafts, but its internal schema differs from the JSON structure used by `/Users/river/Documents/Projects/pdf-extract`.

The `pdf-extract` project exposes a curriculum JSON with this top-level shape:

- `program`
- `courses`
- `requirements`
- `semester_plan`
- `warnings`
- `provenance`

The `pdf-extract` frontend displays a top summary, remaining requirements, rule cards, and a browsable course list. This design reuses that JSON structure and display concept for GradCheck's first real `/plans` page.

## Goals

- Replace the `/plans` placeholder with a logged-in program plan import page.
- Let users upload a PDF and receive a simulated parse result based on the bundled `pdf-extract` sample JSON.
- Let users preview the parsed plan before importing.
- Let users confirm import and bind the program plan as their current graduation baseline.
- Display the currently bound plan when the user revisits `/plans`.

## Non-goals

- No real PDF parsing in this iteration.
- No completed-course tracking on `/plans`.
- No integration with `/courses` yet.
- No manual editing of parsed courses or rules.
- No admin review workflow.

## User Flow

The page uses a three-step wizard:

1. Upload PDF.
2. Preview parsed JSON.
3. Confirm import and bind to current user.

For now, uploading any PDF returns the bundled sample JSON copied from `pdf-extract/plan.json`. The UI should clearly label the result as a simulated parse.

If the user already has a bound plan, `/plans` shows a current-plan summary and offers a re-import action. Confirming a new import updates the user's binding to the new plan.

## Data Model

Add `program_plans`:

- `id` UUID primary key.
- `source_filename` varchar.
- `school` varchar.
- `college` varchar.
- `major` varchar.
- `grade` varchar.
- `total_credits` numeric.
- `course_count` integer.
- `requirement_count` integer.
- `warning_count` integer.
- `plan_json` jsonb, storing the complete `pdf-extract` JSON.
- `created_at`
- `updated_at`

Add `user_program_plan_bindings`:

- `user_id` UUID primary key, references `users.id` with cascade delete.
- `program_plan_id` UUID, references `program_plans.id` with cascade delete.
- `confirmed_at`
- `created_at`
- `updated_at`

## Backend API

Add authenticated APIs under `/api/program-plans`:

- `POST /api/program-plans/mock-upload`
  - Multipart PDF upload.
  - Validates `.pdf` filename.
  - Returns `{ preview }` containing the sample JSON and summary.
  - Does not persist or bind.

- `POST /api/program-plans/import`
  - Accepts a parsed plan JSON and source filename.
  - Validates the top-level `pdf-extract` shape.
  - Saves a `program_plans` row.
  - Upserts `user_program_plan_bindings` for the authenticated user.
  - Returns `{ plan, binding }`.

- `GET /api/program-plans/me`
  - Returns the currently bound plan for the authenticated user.
  - If no plan is bound, returns `{ plan: null }`.

All routes require login.

## Frontend UX

Add `PlansPage.vue` and route `/plans` to it.

Page sections:

1. Current binding summary:
   - Shows current bound program if present.
   - Displays school, college, major, grade, total credits, course count, requirement count, and warning count.

2. Upload step:
   - PDF file input.
   - `模拟解析` button.
   - Clear copy explaining that real parsing is not enabled yet.

3. Preview step:
   - Summary cards: total credits, courses, requirements, warnings.
   - Program metadata.
   - Tabs or stacked sections for:
     - Courses.
     - Requirements.
     - Semester plan.
   - Course browser supports search by code/name and category filtering.

4. Confirm step:
   - `导入并绑定为我的培养方案` button.
   - Success feedback after import.

## JSON Types

Add frontend and backend schema/types aligned to `pdf-extract`:

- `ProgramInfo`
- `Course`
- `Requirement`
- `SemesterPlan`
- `CurriculumPlan`

The implementation can start with the fields needed by the UI:

- Program metadata.
- Course code/name/credits/category/subcategory/term.
- Requirement id/type/title/min credits/min courses/groups.
- Semester plan academic year/semester/courses.
- Warnings.
- Provenance.

Unknown extra fields should be preserved in `plan_json` on the backend rather than discarded.

## Error Handling

- No token: frontend redirects to `/login`; backend returns 401.
- Non-PDF upload: backend returns 400.
- Missing sample JSON or invalid sample JSON: backend returns 500 and tests should fail during development.
- Import with invalid JSON: backend returns 400.
- Save failure: frontend keeps the preview and displays the error.
- No existing binding: `GET /me` returns `{ plan: null }`.

## Testing

Backend tests:

- Unauthenticated access is rejected.
- Mock upload rejects non-PDF.
- Mock upload with PDF returns sample program metadata, course count, requirement count, and warning count.
- Import saves and binds a plan for the current user.
- `GET /me` returns `{ plan: null }` before import.
- `GET /me` returns the imported plan after import.

Frontend tests:

- `/plans` renders a real `PlansPage`.
- No token redirects to `/login`.
- Uploading a PDF calls mock upload.
- Preview shows program metadata, total credits, course count, requirement count, and warning count.
- Course search and category filter work on the preview list.
- Confirm import calls API and shows success feedback.
- Existing bound plan renders as current plan summary.

Verification:

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`

## Resolved Decisions

- Import scope: bind imported plan to user progress baseline.
- Parser behavior: upload PDF returns bundled `pdf-extract` sample JSON.
- Course completion tracking: not part of this iteration.
- Layout: three-step import wizard.
- JSON structure: preserve and display `pdf-extract` structure.
