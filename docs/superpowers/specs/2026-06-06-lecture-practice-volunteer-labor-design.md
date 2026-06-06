# Lecture Practice and Volunteer Labor Design

## Context

GradCheck currently has a `/news` route rendered by `NewsPage.vue`, a `/volunteer` route that still uses `PlaceholderPage.vue`, and a homepage feature entry titled `讲座实践` that currently points to `/news`. The product direction now separates these concerns:

- `/news` remains an information/news page.
- `讲座实践` gets a new dedicated route: `/lecture-practice`.
- `/volunteer` becomes the `志愿劳育` progress page.

The first implementation uses full-stack persistence with summary counts only. It does not record individual lecture, report, practice, volunteer, or labor events.

## Goals

- Add a logged-in `讲座实践` page at `/lecture-practice`.
- Upgrade `/volunteer` into a logged-in `志愿劳育` page.
- Track the exact graduation requirements provided by the user.
- Persist each user's summary progress in the backend.
- Show per-requirement status, missing amount, and module-level completion.
- Let users edit values by typing numbers or using `+1` / `-1` controls.

## Non-goals

- No detailed event records in the first version.
- No file uploads or proof attachments.
- No admin review workflow.
- No automatic data import from external systems.
- No recommendation or notification workflow in this version.

## Routes and Navigation

- Keep `/news` as the news/information page.
- Add `/lecture-practice` for `讲座实践`.
- Keep `/volunteer` for `志愿劳育`.
- Change the homepage `讲座实践` feature entry from `/news` to `/lecture-practice`.
- Keep the mobile bottom navigation `资讯` tab pointing to `/news`.

Both `/lecture-practice` and `/volunteer` require login. If there is no local token, the page redirects to `/login`, matching the existing `HomePage` and `ProfilePage` pattern.

## Graduation Rules

### 讲座实践

The module is complete for graduation only when all of these are true:

- Human lectures attended: at least 8.
- Book reports completed: at least 2.
- Social practice credits: at least 1.
- Social practice public classes attended: at least 1.

Social practice excellence is shown separately:

- Less than 1 credit: not passing; show missing credits for graduation.
- At least 1 and less than 3 credits: passing; show missing credits for excellence.
- At least 3 credits: excellent.

### 志愿劳育

The module is complete for graduation only when all of these are true:

- Volunteer activity hours: at least 12.
- Ordinary production labor sessions: at least 2.
- Special labor sessions: at least 1.

## Data Model

Add two user-scoped summary tables.

### `lecture_practice_progress`

One row per user:

- `user_id` primary key, references `users.id` with cascade delete.
- `human_lecture_count` integer, default 0.
- `book_report_count` integer, default 0.
- `social_practice_credits` numeric, default 0.
- `social_practice_course_count` integer, default 0.
- `created_at`
- `updated_at`

### `volunteer_labor_progress`

One row per user:

- `user_id` primary key, references `users.id` with cascade delete.
- `volunteer_hours` numeric, default 0.
- `ordinary_labor_count` integer, default 0.
- `special_labor_count` integer, default 0.
- `created_at`
- `updated_at`

Counts are non-negative integers. Credits and hours are non-negative numbers.

## Backend API

Add authenticated APIs:

- `GET /api/lecture-practice/me`
- `PUT /api/lecture-practice/me`
- `GET /api/volunteer-labor/me`
- `PUT /api/volunteer-labor/me`

GET returns a default all-zero progress object when the user has no saved row yet. PUT validates the whole progress object and upserts the row for the authenticated user.

Suggested module structure:

- `packages/backend/src/modules/lecture-practice/lecture-practice.schemas.ts`
- `packages/backend/src/modules/lecture-practice/lecture-practice.repository.ts`
- `packages/backend/src/modules/lecture-practice/lecture-practice.routes.ts`
- `packages/backend/src/modules/volunteer-labor/volunteer-labor.schemas.ts`
- `packages/backend/src/modules/volunteer-labor/volunteer-labor.repository.ts`
- `packages/backend/src/modules/volunteer-labor/volunteer-labor.routes.ts`

`createApp` should accept both repositories and mount both routers after auth/users/plaza routes.

## Frontend UX

Add:

- `packages/web/src/pages/LecturePracticePage.vue`
- `packages/web/src/pages/VolunteerPage.vue`
- `packages/web/src/components/RequirementProgressCard.vue`
- `packages/web/src/schemas/lecturePractice.ts`
- `packages/web/src/schemas/volunteerLabor.ts`
- API functions in `packages/web/src/lib/api.ts`

Each page uses this layout:

1. Header card with page title and module-level status.
2. Requirement cards, one card per requirement.
3. Each card shows current value, target, status, and missing amount.
4. Each card includes a `-1` button, numeric input, `+1` button, and save button.

The page keeps one reactive progress object. Editing any card updates that object. Saving from any card submits the full page progress object to prevent partial saves from overwriting other fields with stale values.

Step controls:

- Integer count fields change by 1.
- Credit/hour fields also change by 1 in this version.
- Values cannot be decremented below 0.
- Users can still type exact values manually.

## Error Handling

- No token: frontend redirects to `/login`; backend returns 401.
- Invalid values: frontend shows validation errors; backend Zod validation returns 400.
- GET with no existing row: return default progress with zeros.
- Save failure: keep the user's current form values and show the backend error message.
- Unknown backend errors keep the existing `{ error: { message } }` response shape.

## Testing

Backend tests should cover:

- GET returns all-zero default lecture practice progress.
- PUT saves lecture practice progress and a later GET returns it.
- Lecture practice rejects negative values and non-integer count fields.
- GET returns all-zero default volunteer labor progress.
- PUT saves volunteer labor progress and a later GET returns it.
- Volunteer labor rejects negative values and non-integer count fields.
- Both modules reject unauthenticated access.

Frontend tests should cover:

- Router registers `/lecture-practice` and `/volunteer`.
- Homepage `讲座实践` entry points to `/lecture-practice`.
- `/lecture-practice` redirects to `/login` without token.
- `/volunteer` redirects to `/login` without token.
- Both pages render requirement cards with the correct targets.
- `+1` and `-1` controls update values and do not decrement below 0.
- Manual input can be saved.
- Lecture practice shows social practice passing and excellence states correctly.
- Save calls the corresponding API and refreshes page data.

Verification uses:

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`

## Resolved Decisions

- Implementation depth: full-stack persistent.
- Record granularity: summary counts only.
- Page split: two pages.
- Lecture practice route: `/lecture-practice`.
- `/news` remains the information/news page.
- Homepage `讲座实践` entry moves to `/lecture-practice`.
- `/volunteer` becomes the volunteer/labor page.
- Layout: editable cards.
- Editing: manual numeric input plus `+1` / `-1` controls.
