# Course-related Database Map

This document summarizes the database tables that currently touch courses, grades, program plans, and course-adjacent graduation progress. It distinguishes the tables actively modeled in the current Drizzle schema from older/live database tables that still exist in the database and may matter for future module integration.

## High-level module map

| Area | Main tables | Current role |
|---|---|---|
| GPA calculator | `gpa_courses`, `gpa_calculation_results` | User-entered or transcript-imported course grades and latest GPA summaries. |
| Program plan import | `program_plans`, `user_program_plan_bindings` | Stores parsed curriculum plans as JSON and the current plan bound to a user. |
| Legacy/older structured plan model | `program_schemas`, `schema_courses`, `elective_groups`, `user_program_bindings`, `user_courses`, `user_requirement_progress` | Present in the live DB, but not modeled in current `src/db/schema.ts`; useful reference for future normalized plan/progress design. |
| Non-course graduation progress | `lecture_practice_progress`, `volunteer_labor_progress`, `srtp_records`, `custom_requirements` | Tracks graduation requirements that may interact with courses but are not normal course rows. |
| Opportunities and community | `news_items`, `scraped_opportunities`, `recommendations`, `user_opportunity_actions`, `plaza_posts` | Course-adjacent recommendations, activities, and posts. |

## Current Drizzle-modeled tables

These are defined in `packages/backend/src/db/schema.ts` and are the safest source of truth for code changes.

### `gpa_courses`

Stores the GPA module's concrete course-grade records. Records are owned by a user and are independent from program-plan courses.

| Column | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key. |
| `user_id` | `uuid` | Owner; references `users.id`, cascade delete. |
| `term` | `varchar(20)` | Human-readable term enum, e.g. `2025-2026 春`. |
| `name` | `varchar(160)` | Course name. |
| `credit` | `numeric(5,2)` | Course credit used for weighted calculation. |
| `score` | `numeric(5,2)` | Numeric percentage score after any transcript grade conversion. |
| `is_required` | `boolean` | Whether the course should count as required for the "first-attempt required courses" GPA scope. |
| `is_first_attempt` | `boolean` | Whether this record is the first attempt. |
| `is_gpa_eligible` | `boolean` | Whether this course participates in GPA/weighted-average calculation. |
| `created_at`, `updated_at` | `timestamp with time zone` | Audit timestamps. |

Current data sources:

- Manual entry in the GPA page.
- Confirmed transcript import from `POST /api/gpa/transcript/import`.

Important behavior:

- `is_gpa_eligible=false` excludes the course from both GPA scopes.
- Required-first-attempt GPA filters `is_gpa_eligible && is_required && is_first_attempt`.
- Transcript import currently defaults `is_required=false`, because the transcript alone does not know curriculum requirement type.
- Duplicate transcript imports are skipped by `term + name + credit + score`.

### `gpa_calculation_results`

Stores the latest persisted GPA calculation result per user.

| Column | Type | Meaning |
|---|---|---|
| `user_id` | `uuid` | Primary key; references `users.id`, cascade delete. |
| `required_first_attempt` | `jsonb` | Latest summary for required first-attempt courses. |
| `overall` | `jsonb` | Latest summary for all GPA-eligible courses. |
| `created_at`, `updated_at` | `timestamp with time zone` | Audit timestamps. |

Each result JSON has:

```ts
{
  weightedGpa: number | null;
  weightedAverageScore: number | null;
  totalCredits: number;
  courseCount: number;
}
```

Integration note: this table is derived state. If future modules update `gpa_courses`, they should use the GPA repository/service methods so the derived result is recalculated atomically.

### `program_plans`

Stores parsed curriculum plans. Unlike `gpa_courses`, courses are not normalized into rows here; they live inside `plan_json.courses`.

| Column | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key. |
| `source_filename` | `varchar(240)` | Uploaded/imported source file name. |
| `school` | `varchar(120)` | School name. |
| `college` | `varchar(120)` | College, nullable. |
| `major` | `varchar(120)` | Major. |
| `grade` | `varchar(40)` | Grade/cohort, nullable. |
| `total_credits` | `numeric(6,2)` | Total credits from the program plan, nullable. |
| `course_count` | `integer` | Number of courses in `plan_json.courses`. |
| `requirement_count` | `integer` | Number of requirement records in `plan_json.requirements`. |
| `warning_count` | `integer` | Number of parser warnings. |
| `plan_json` | `jsonb` | Full parsed curriculum plan. |
| `created_at`, `updated_at` | `timestamp with time zone` | Audit timestamps. |

Current `plan_json.courses` shape is validated in `program-plans.schemas.ts`:

```ts
{
  code: string;
  name: string;
  credits: number;
  category?: string | null;
  subcategory?: string | null;
  term?: {
    year?: string | null;
    semester?: string | null;
  };
}
```

Integration note: this is the best current source for "what the curriculum requires", but it is JSON, so matching it to `gpa_courses` requires normalization logic such as course-code/name matching.

### `user_program_plan_bindings`

Stores the current program plan selected by a user.

| Column | Type | Meaning |
|---|---|---|
| `user_id` | `uuid` | Primary key; references `users.id`, cascade delete. |
| `program_plan_id` | `uuid` | References `program_plans.id`, cascade delete. |
| `confirmed_at` | `timestamp with time zone` | When the user confirmed/bound the plan. |
| `created_at`, `updated_at` | `timestamp with time zone` | Audit timestamps. |

Integration note: use this table to find a user's active curriculum plan before comparing plan courses against transcript/GPA courses.

### `srtp_records`

Tracks SRTP-related credit records. It is not a normal course table but contributes to graduation-related credit requirements.

| Column | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key. |
| `user_id` | `uuid` | Owner; references `users.id`. |
| `title` | `varchar(160)` | Record title. |
| `type` | `varchar(32)` | SRTP record type, e.g. project/competition/lecture. |
| `credits` | `numeric(5,2)` | Credits earned. |
| `description` | `text` | Notes/description. |
| `created_at`, `updated_at` | `timestamp with time zone` | Audit timestamps. |

### `lecture_practice_progress`

Tracks lecture/practice-style graduation progress.

| Column | Type | Meaning |
|---|---|---|
| `user_id` | `uuid` | Primary key; references `users.id`. |
| `human_lecture_count` | `integer` | Humanities lecture count. |
| `book_report_count` | `integer` | Book report count. |
| `social_practice_credits` | `numeric(5,2)` | Social practice credits. |
| `social_practice_course_count` | `integer` | Social practice course count. |

### `volunteer_labor_progress`

Tracks volunteer/labor graduation progress.

| Column | Type | Meaning |
|---|---|---|
| `user_id` | `uuid` | Primary key; references `users.id`. |
| `volunteer_hours` | `numeric(6,2)` | Volunteer hours. |
| `ordinary_labor_count` | `integer` | Ordinary labor count. |
| `special_labor_count` | `integer` | Special labor count. |

### `custom_requirements`

User-defined or college-specific requirements that may represent course-like, credit-like, count-like, or hour-like requirements.

Important columns:

- `user_id`
- `name`
- `kind`
- `category`
- `target_value`
- `current_value`
- `unit`
- `include_in_progress`
- `show_on_home`

Integration note: this is a flexible escape hatch for requirements that are not yet modeled as first-class course/progress tables.

### `plaza_posts`

Community posts. Course-related only for course exchange posts.

Relevant course fields:

- `offered_course`
- `wanted_course`
- `course_time`

Integration note: this is not authoritative course progress data.

### `news_items`

Opportunity/news records. Course-adjacent when opportunities can satisfy graduation gaps.

Relevant fields:

- `type`
- `credit_category`
- `target_audience`
- `start_time`
- `end_time`
- `registration_url`

## Live DB tables not currently modeled in Drizzle schema

These tables exist in the current database, but they are not defined in `packages/backend/src/db/schema.ts`. Treat them as legacy or future-reference tables until the codebase explicitly adopts them.

### `program_schemas`

Older/normalized curriculum schema root.

| Column | Meaning |
|---|---|
| `id` | Program schema ID. |
| `college`, `major`, `grade` | Program identity. |
| `version` | Version number. |
| `source_url` | Source link. |
| `status` | Enum status, e.g. draft/confirmed. |
| `confirmed_by` | User who confirmed it. |

### `schema_courses`

Older/normalized curriculum course rows.

| Column | Meaning |
|---|---|
| `id` | Course row ID. |
| `schema_id` | Parent `program_schemas.id`. |
| `code` | Course code. |
| `name` | Course name. |
| `credits` | Course credits. |
| `category` | Enum course category. |
| `elective_group_id` | Optional elective group. |
| `semester` | Suggested semester. |
| `is_required` | Required-course flag. |

Potential future use: this is a better normalized shape for requirement matching than `program_plans.plan_json`, but it is currently not wired into the active backend modules.

### `elective_groups`

Older/normalized elective group constraints.

| Column | Meaning |
|---|---|
| `schema_id` | Parent `program_schemas.id`. |
| `name` | Group name. |
| `min_courses` | Minimum course count. |
| `min_credits` | Minimum credits. |
| `description` | Notes. |

### `user_program_bindings`

Older user-to-program-schema binding.

| Column | Meaning |
|---|---|
| `user_id` | User. |
| `schema_id` | Program schema. |
| `bound_at` | Bind time. |

This overlaps conceptually with current `user_program_plan_bindings`, but points to `program_schemas` instead of `program_plans`.

### `user_courses`

Older/normalized user course progress rows.

| Column | Meaning |
|---|---|
| `user_id` | User. |
| `schema_course_id` | Required/planned course from `schema_courses`. |
| `status` | Enum progress status, e.g. unstarted/completed. |
| `grade` | Numeric grade, nullable. |
| `semester` | User's actual semester, nullable. |
| `notes` | Notes. |

Potential future use: this is close to the desired course-progress table, but currently GPA uses `gpa_courses` instead. A future migration could merge/import `gpa_courses` into a normalized user-course model.

### `user_requirement_progress`

Older generic requirement progress table.

| Column | Meaning |
|---|---|
| `user_id` | User. |
| `requirement_type` | Enum requirement type. |
| `current_value` | Current progress. |
| `target_value` | Target threshold. |
| `unit` | Unit label. |
| `status` | Enum progress status. |
| `details` | JSON details. |

## Recommended integration direction

### Short term

Use current active tables:

1. `user_program_plan_bindings` -> `program_plans.plan_json.courses` for curriculum requirements.
2. `gpa_courses` for actual completed/graded courses.
3. `gpa_calculation_results` for cached GPA summaries.
4. `custom_requirements`, `lecture_practice_progress`, `volunteer_labor_progress`, and `srtp_records` for non-course graduation gaps.

This avoids relying on legacy tables that the current backend code does not maintain.

### Course matching strategy

For linking transcript/GPA courses to curriculum courses:

1. Prefer exact course code when both sides have a code.
2. Current `gpa_courses` has no `code`, so transcript-imported courses can only match by normalized name plus credits.
3. Normalize names by removing markers such as `▲`, whitespace differences, full-width/half-width punctuation, and language suffix variations where safe.
4. Use credits as a tie-breaker.
5. Keep ambiguous matches visible for user confirmation rather than auto-resolving.

### Medium term schema cleanup

If module linkage becomes central, consider adding a first-class normalized course-progress model:

- `courses` or `catalog_courses`: canonical course code/name/credits.
- `program_plan_courses`: normalized rows extracted from `program_plans.plan_json.courses`.
- `user_course_records`: actual user attempts/grades/transcript rows.
- `user_course_matches`: links user attempts to plan courses, with confidence and confirmation status.

This would let GPA, graduation progress, course recommendations, and transcript import share one course identity model instead of duplicating course data.

## Important current limitation

`gpa_courses` currently does not store course code, raw transcript grade, source filename, or match status. The transcript parser produces `rawName`, `rawGrade`, and warnings during preview, but confirmed import only stores the fields required by the GPA calculator.

If future linkage requires traceability, add columns or a separate import audit table before relying on transcript imports for graduation requirement decisions.
