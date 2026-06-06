# Calculate Module Design

## Goal

Implement an independent GPA calculation module for GradCheck. Users can sign in, add their own course grades, and see persisted results for Southeast University weighted GPA and weighted average score. The module will not read data from other course, plan, or graduation-progress modules in this iteration.

## Scope

This implementation covers the current GPA and weighted-average calculation described in `docs/Calculate.md`.

Included:

- Frontend `/gpa` page for course input, editing, deletion, and result display.
- Backend `/api/gpa` endpoints protected by the existing JWT authentication middleware.
- Persistent storage for user-entered courses and each user's latest calculation result.
- Automatic recalculation after course creation, update, or deletion.
- Two calculation scopes: first-attempt required courses and all GPA-eligible courses.

Excluded:

- Target GPA estimation and remaining-credit planning.
- Importing courses from transcript, training-plan, OCR, or other modules.
- Grade formats other than numeric percentage scores.
- Historical calculation snapshots.

## Architecture

The backend will add a `modules/gpa` feature module with route, schema, service, and repository layers. `createApp` will mount the router at `/api/gpa`, and every route will use the existing JWT authentication flow so records belong to the current user.

The frontend will replace the `/gpa` placeholder route with `GpaPage.vue`. The page will use the existing API helper style in `packages/web/src/lib/api.ts`, existing `AppShell`, and the current Tommy theme classes. Existing homepage links to `/gpa` remain unchanged.

## Data model

Add a `gpa_courses` table with:

- `id`
- `userId`
- `term`
- `name`
- `credit`
- `score`
- `isRequired`
- `isFirstAttempt`
- `isGpaEligible`
- `createdAt`
- `updatedAt`

Add a `gpa_calculation_results` table with one latest result per user:

- `userId`
- `requiredFirstAttempt`
- `overall`
- `createdAt`
- `updatedAt`

`requiredFirstAttempt` and `overall` store result objects containing:

- `weightedGpa`
- `weightedAverageScore`
- `totalCredits`
- `courseCount`

When a scope has no eligible courses, `weightedGpa` and `weightedAverageScore` are `null`, while `totalCredits` and `courseCount` are `0`.

## Course input

The course form includes:

- Term enum, formatted like `2025-2026 春` and `2025-2026 秋`. The initial enum covers academic years `2020-2021` through `2030-2031`, with both `秋` and `春` options for each academic year.
- Course name.
- Credit, greater than `0`.
- Numeric percentage score from `0` to `100`.
- Whether the course is required.
- Whether this record is the first attempt.
- Whether the course is GPA-eligible.

The first version uses term enums and does not include course code, course category, or transcript source fields.

## API

`GET /api/gpa`

- Returns the current user's courses and latest calculation result.

`POST /api/gpa/courses`

- Creates a course for the current user.
- Recalculates and persists the latest result.
- Returns the updated course list and result.

`PUT /api/gpa/courses/:id`

- Updates a course owned by the current user.
- Recalculates and persists the latest result.
- Returns the updated course list and result.

`DELETE /api/gpa/courses/:id`

- Deletes a course owned by the current user.
- Recalculates and persists the latest result.
- Returns the updated course list and result.

Editing or deleting a course not owned by the current user returns `404` to avoid revealing whether another user's record exists.

## Calculation rules

The backend service is the source of truth for calculation. The frontend displays returned results and does not compute final GPA values.

Grade-point conversion follows `docs/Calculate.md`:

- `96-100`: `4.8`
- `93-95`: `4.5`
- `90-92`: `4.0`
- `86-89`: `3.8`
- `83-85`: `3.5`
- `80-82`: `3.0`
- `76-79`: `2.8`
- `73-75`: `2.5`
- `70-72`: `2.0`
- `66-69`: `1.8`
- `63-65`: `1.5`
- `60-62`: `1.0`
- `0-59`: `0`

The overall scope includes courses where `isGpaEligible` is true. The first-attempt required scope includes courses where `isGpaEligible`, `isRequired`, and `isFirstAttempt` are all true.

For each scope:

```ts
weightedGpa = sum(courseGradePoint * credit) / sum(credit);
weightedAverageScore = sum(score * credit) / sum(credit);
```

Both calculated values are rounded to four decimal places with `Math.round(value * 10000) / 10000`.

## Frontend behavior

The `/gpa` page shows:

- Result cards for first-attempt required courses and all GPA-eligible courses.
- A course list with edit and delete actions.
- A course form for adding or updating courses.
- Empty-state text when there are no courses or no calculable result.

On page load, the frontend requests `GET /api/gpa`. After create, update, or delete operations, it uses the API response to refresh both the course list and result display. API validation errors are shown on the page using the existing error-message style.

## Error handling

- Unauthenticated access follows the existing redirect-to-login behavior.
- Backend validation errors return the existing `{ error: { message } }` shape.
- Invalid score, credit, term, or empty name fails request validation.
- Update and delete operations validate ownership before changing data.
- Empty calculation scopes return null GPA and average values instead of pretending the GPA is `0`.

## Testing

Backend tests:

- Unit tests for score-to-grade-point conversion, including boundary scores.
- Unit tests for weighted GPA and weighted average calculations.
- API tests for create, update, delete, automatic recalculation, persistence, and ownership isolation.

Frontend tests:

- Router test that `/gpa` renders the real GPA page.
- Page tests for displaying loaded results, submitting a course, and showing empty/error states.

Verification commands:

```bash
pnpm test
pnpm typecheck
pnpm build
```
