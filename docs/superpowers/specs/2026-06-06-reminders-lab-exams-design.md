# Reminders and Lab Exam Events Design

## Context

GradCheck already has a homepage feature entry for `实验考试`, but `/exams` still renders a placeholder. The homepage also has a placeholder `提醒事项` dashboard card that points to `/profile` and displays static text. The product requirement is to let users register upcoming exams or lab sessions, automatically surface those records in reminders, support general custom reminders, and prepare for future SMS notifications.

The approved scope is MVP+:

- Build persistent lab/exam event management.
- Build persistent reminder management.
- Show an Apple Reminders-style homepage card.
- Add scheduling and delivery log models with a replaceable SMS adapter stub.
- Do not integrate a real SMS provider yet.
- Do not support recurring reminders in this version.

## Goals

- Add a logged-in `实验考试` page at `/exams`.
- Add a logged-in `提醒事项` page at `/reminders`.
- Use one unified reminder core model as the source of truth for all reminder display, completion, snooze, homepage, and scheduling behavior.
- Keep lab/exam-specific fields in a dedicated event model that automatically creates and syncs a linked reminder.
- Let users create additional custom one-time reminders from the reminders page.
- Show the most relevant incomplete reminders on the homepage in an Apple Reminders-style widget card.
- Prepare a scheduler and delivery log boundary so a real SMS provider can be added later without redesigning the feature.

## Non-goals

- No real SMS provider integration in this version.
- No recurring reminders.
- No external exam schedule import.
- No notification preferences page beyond per-reminder SMS enablement and reminder offsets.
- No attachment upload or proof workflow.
- No admin review or moderation workflow.

## Product Structure

The feature uses a unified core with a specialized entry point:

1. `/exams` is the fast lab/exam entry page. It captures event-specific fields such as course name, event type, start/end time, location, seat or group, teacher, and notes.
2. Creating a lab/exam event automatically creates one linked reminder with default offsets of 1 day and 1 hour before the event.
3. `/reminders` is the superset page. It shows lab/exam reminders and user-created custom reminders together.
4. The homepage reminder card reads only from the unified reminder list.
5. The scheduler reads only from the unified reminder model and writes delivery logs.

This avoids duplicate completion, delete, homepage, and SMS logic across lab/exam events and custom reminders.

## Routes and Navigation

- Replace the `/exams` placeholder with `LabExamEventsPage.vue`.
- Add `/reminders` with `RemindersPage.vue`.
- Update the homepage `提醒事项` card to route to `/reminders`.
- Keep the homepage `实验考试` feature entry pointing to `/exams`.

Both pages require login. Without a local token, the frontend redirects to `/login`, matching existing page behavior.

## Data Model

### `reminders`

One row per reminder.

- `id` UUID primary key.
- `user_id` references `users.id` with cascade delete.
- `title` varchar(160), required.
- `category` varchar(32), required. Values: `lab`, `exam`, `custom`, `volunteer`, `labor`, `sports`, `other`.
- `status` varchar(32), required. Values: `pending`, `done`, `snoozed`, `cancelled`.
- `priority` varchar(32), required. Values: `low`, `normal`, `high`.
- `start_at` timestamp with timezone, nullable.
- `due_at` timestamp with timezone, required.
- `location` varchar(200), nullable.
- `notes` text, nullable.
- `source_type` varchar(32), required. Values: `lab_exam_event`, `custom`, `system`.
- `source_id` UUID, nullable.
- `reminder_offsets` JSONB number array, required. Values are minutes before `due_at`, for example `[1440, 60]`.
- `sms_enabled` boolean, default false.
- `show_on_home` boolean, default true.
- `completed_at` timestamp with timezone, nullable.
- `snoozed_until` timestamp with timezone, nullable.
- `deleted_at` timestamp with timezone, nullable.
- `created_at`
- `updated_at`

Soft delete is used so delivery logs and audit references remain meaningful. Normal list queries exclude rows with `deleted_at`.

### `lab_exam_events`

One row per user-created lab or exam event.

- `id` UUID primary key.
- `user_id` references `users.id` with cascade delete.
- `reminder_id` references `reminders.id` with cascade delete.
- `title` varchar(160), required.
- `course_name` varchar(160), nullable.
- `event_type` varchar(32), required. Values: `lab`, `midterm`, `final`, `quiz`, `other_exam`.
- `start_at` timestamp with timezone, required.
- `end_at` timestamp with timezone, nullable.
- `location` varchar(200), nullable.
- `teacher` varchar(120), nullable.
- `seat_or_group` varchar(120), nullable.
- `notes` text, nullable.
- `status` varchar(32), required. Values: `scheduled`, `done`, `cancelled`.
- `deleted_at` timestamp with timezone, nullable.
- `created_at`
- `updated_at`

The lab/exam event stores event-specific information. Its linked reminder stores reminder-specific state and drives homepage and SMS scheduling.

### `reminder_delivery_logs`

One row per scheduled or attempted reminder delivery.

- `id` UUID primary key.
- `reminder_id` references `reminders.id` with cascade delete.
- `channel` varchar(32), required. Values: `sms`.
- `status` varchar(32), required. Values: `pending`, `sent`, `failed`, `skipped`.
- `scheduled_at` timestamp with timezone, required.
- `sent_at` timestamp with timezone, nullable.
- `provider_message_id` varchar(160), nullable.
- `error_message` text, nullable.
- `attempt_count` integer, default 0.
- `created_at`
- `updated_at`

The scheduler creates or updates delivery logs. The initial SMS adapter is a no-op implementation that returns a simulated success result.

## Backend Design

### Module Structure

Add two backend modules:

- `packages/backend/src/modules/reminders/reminders.schemas.ts`
- `packages/backend/src/modules/reminders/reminders.repository.ts`
- `packages/backend/src/modules/reminders/reminders.service.ts`
- `packages/backend/src/modules/reminders/reminders.routes.ts`
- `packages/backend/src/modules/lab-exam-events/lab-exam-events.schemas.ts`
- `packages/backend/src/modules/lab-exam-events/lab-exam-events.repository.ts`
- `packages/backend/src/modules/lab-exam-events/lab-exam-events.service.ts`
- `packages/backend/src/modules/lab-exam-events/lab-exam-events.routes.ts`
- `packages/backend/src/modules/reminders/reminder-scheduler.ts`
- `packages/backend/src/modules/reminders/sms-adapter.ts`

`createApp` should accept reminder and lab/exam repositories and mount:

- `/api/reminders`
- `/api/lab-exam-events`

Services own cross-table behavior, especially lab/exam event synchronization with reminders.

### Reminder API

All reminder APIs require authentication.

- `GET /api/reminders`
  - Query filters: `status`, `category`, `range`, `showOnHome`, `includeCompleted`.
  - Default: incomplete, non-cancelled, non-deleted reminders ordered by due time.
  - Response: `{ reminders }`.

- `GET /api/reminders/home`
  - Returns the top homepage reminders.
  - Default limit: 3.
  - Filters to `showOnHome = true`, incomplete, non-cancelled, non-deleted.
  - Response: `{ reminders, pendingCount }`.

- `POST /api/reminders`
  - Creates a custom one-time reminder.
  - Response: `{ reminder }`.

- `PUT /api/reminders/:id`
  - Edits a reminder owned by the authenticated user.
  - Lab/exam-linked reminders can update reminder-specific fields, but event-specific fields should be edited from `/exams`.
  - Response: `{ reminder }`.

- `PATCH /api/reminders/:id/complete`
  - Body: `{ completed: boolean }`.
  - Sets or clears `completedAt` and status.
  - Response: `{ reminder }`.

- `PATCH /api/reminders/:id/snooze`
  - Body: `{ snoozedUntil: string }`.
  - Sets status to `snoozed`.
  - Response: `{ reminder }`.

- `POST /api/reminders/:id/duplicate`
  - Creates a copy as a custom reminder.
  - Response: `{ reminder }`.

- `DELETE /api/reminders/:id`
  - Soft deletes a reminder.
  - Response: 204.

### Lab/Exam Event API

All lab/exam APIs require authentication.

- `GET /api/lab-exam-events`
  - Query filters: `status`, `eventType`, `range`.
  - Response: `{ events }`.

- `POST /api/lab-exam-events`
  - Creates a lab/exam event and its linked reminder in one transaction.
  - Default linked reminder offsets: `[1440, 60]`.
  - Response: `{ event, reminder }`.

- `PUT /api/lab-exam-events/:id`
  - Updates event fields and synchronizes linked reminder title, due time, start time, location, notes, and category.
  - Response: `{ event, reminder }`.

- `PATCH /api/lab-exam-events/:id/status`
  - Body: `{ status: "scheduled" | "done" | "cancelled" }`.
  - `done` completes the linked reminder.
  - `cancelled` cancels the linked reminder.
  - Response: `{ event, reminder }`.

- `DELETE /api/lab-exam-events/:id`
  - Sets the event `deletedAt`, soft deletes or cancels the linked reminder, and removes both from normal lists.
  - Response: 204.

## Synchronization Rules

- Creating a lab/exam event creates exactly one linked reminder.
- Updating lab/exam title, time, location, or notes updates the linked reminder.
- Completing a lab/exam event completes the linked reminder.
- Cancelling a lab/exam event cancels the linked reminder.
- Deleting a lab/exam event sets `lab_exam_events.deletedAt` and hides or soft-deletes the linked reminder.
- Updating a linked reminder from `/reminders` must not overwrite event-specific fields such as teacher, course name, or seat/group.
- Custom reminders never create lab/exam events.
- Cross-table operations run in a transaction. If reminder synchronization fails, the lab/exam event mutation rolls back.

## Frontend Design

### Files

Add:

- `packages/web/src/pages/LabExamEventsPage.vue`
- `packages/web/src/pages/RemindersPage.vue`
- `packages/web/src/components/HomeReminderCard.vue`
- `packages/web/src/components/ReminderListItem.vue`
- `packages/web/src/schemas/reminder.ts`
- `packages/web/src/schemas/labExamEvent.ts`

Update:

- `packages/web/src/router.ts`
- `packages/web/src/pages/HomePage.vue`
- `packages/web/src/lib/api.ts`

### `/exams`

The lab/exam page is optimized for quick event entry.

Layout:

1. Header card with title, explanation, and upcoming count.
2. Form card with event type, course name, title, start time, end time, location, teacher, seat/group, notes, SMS toggle, and reminder offsets.
3. Upcoming event list.
4. Completed/cancelled events collapsed behind filters.

Default reminder offsets are 1 day and 1 hour before the event. Users can edit offsets per event.

Actions:

- Create.
- Edit.
- Mark done.
- Cancel.
- Delete.

### `/reminders`

The reminder page is the superset view.

Layout:

1. Header card with total pending count and quick create button.
2. Filter chips: all, today, this week, overdue, lab/exam, custom, completed.
3. Custom reminder form or modal.
4. Reminder list grouped by overdue, today, upcoming, and completed when enabled.

Reminder item actions:

- Complete or undo completion.
- Snooze to 1 hour later, tomorrow, or next week.
- Edit details.
- Toggle homepage display.
- Toggle SMS.
- Duplicate reminder.
- Cancel or delete.

### Homepage Reminder Card

The homepage card should look like an Apple Reminders widget:

- Large pending count.
- Three most relevant incomplete reminders.
- Each row has a circular completion control, title, time, and location.
- Overdue or due-soon reminders use warning color.
- Clicking the circle completes the reminder without navigating.
- Clicking the card body navigates to `/reminders`.
- Empty state says there are no pending reminders and links to create one.

Ranking:

1. Overdue reminders first.
2. Then reminders due within 24 hours.
3. Then reminders by nearest `dueAt`.
4. Hide completed, cancelled, and deleted reminders.

## Scheduler and SMS Stub

The initial scheduler is a callable backend function, not a long-running production worker requirement. It can later be wired to a cron job or queue worker.

Scheduler behavior:

1. Find reminders where `smsEnabled = true`, status is incomplete, not cancelled, not deleted.
2. Expand `reminderOffsets` into scheduled delivery times.
3. Skip delivery times that already have a sent or pending delivery log for the same reminder/channel/scheduled time.
4. For due delivery times, call `SmsAdapter.sendReminder`.
5. Write `reminder_delivery_logs` with `sent`, `failed`, or `skipped`.

The MVP+ adapter is `NoopSmsAdapter`. It validates the call shape and returns a simulated provider result. A later real adapter can use the same interface.

## Validation and Error Handling

- Frontend and backend both validate required fields with Zod.
- `dueAt` and `startAt` must be valid datetimes.
- Lab/exam `endAt`, when present, must be after `startAt`.
- Reminder offsets must be non-negative minute values.
- Empty titles are rejected.
- Missing or invalid token returns 401.
- Mutating another user's reminder or event returns 404 or 403 according to existing repository patterns.
- Linked reminder synchronization failure rolls back the full lab/exam event mutation.
- Frontend save failure keeps user-entered form values and shows the backend error message.

## Testing

Backend tests should cover:

- Auth is required for reminder and lab/exam routes.
- Creating a custom reminder persists and lists it.
- Updating reminder fields works only for the owner.
- Completing and undoing completion update status and `completedAt`.
- Snoozing sets `snoozedUntil`.
- Deleting a reminder excludes it from normal lists.
- `GET /api/reminders/home` returns up to three relevant incomplete reminders and pending count.
- Creating a lab/exam event creates a linked reminder with default `[1440, 60]` offsets.
- Updating a lab/exam event synchronizes the linked reminder.
- Marking a lab/exam event done completes the linked reminder.
- Cancelling or deleting a lab/exam event removes the linked reminder from active reminder views.
- Scheduler creates delivery logs using the no-op SMS adapter and does not duplicate logs.

Frontend tests should cover:

- Router registers `/exams` and `/reminders`.
- Both pages redirect to `/login` without token.
- Lab/exam page renders the create form and default offsets.
- Creating a lab/exam event calls the API and refreshes event/reminder data.
- Reminder page renders filters and reminder actions.
- Complete, snooze, edit, homepage toggle, SMS toggle, duplicate, and delete actions call the expected APIs.
- Homepage reminder card shows the pending count, top reminders, empty state, and click-to-complete behavior.

Verification uses:

- `pnpm --filter @gradcheck/backend typecheck`
- `pnpm --filter @gradcheck/backend test`
- `pnpm --filter @gradcheck/web typecheck`
- `pnpm --filter @gradcheck/web test`

## Resolved Decisions

- Scope: MVP+ with scheduler and SMS adapter stub.
- Data architecture: unified `reminders` core plus specialized `lab_exam_events`.
- Default lab/exam reminder offsets: 1 day and 1 hour before event start.
- Recurrence: not supported in this version.
- Homepage card style: Apple Reminders-style widget.
- Homepage card behavior: click circle to complete; click body to open `/reminders`.
- Reminder page actions: complete/undo, snooze, edit, homepage toggle, SMS toggle, duplicate, cancel/delete.
- Real SMS provider: deferred.
