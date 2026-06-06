# SRTP Page Design

## Context

GradCheck currently has a homepage entry labeled `SRTP` and a `/srtp` route that renders a placeholder page. The SRTP graduation requirement is:

- 2 credits to pass.
- 6 credits for excellent.

Students can earn SRTP credits through competitions, SRTP projects, SRTP lectures, and other recognized extracurricular practice activities. The SRTP page should let students record credit sources and see their progress clearly.

## Goals

- Replace the `/srtp` placeholder with a logged-in SRTP progress page.
- Let users create, edit, and delete itemized SRTP credit records.
- Automatically calculate total SRTP credits from records.
- Show pass/excellent status and remaining credit gaps.
- Keep the homepage label as `SRTP`.

## Non-goals

- No proof uploads or file attachments.
- No admin review workflow.
- No external SRTP import.
- No status workflow such as planned/completed.
- No manual total-credit override.

## Graduation Rules

- `totalCredits < 2`: not passing.
- `2 <= totalCredits < 6`: passing, but not excellent.
- `totalCredits >= 6`: excellent.

The UI should show:

- Current total credits.
- Pass threshold: 2 credits.
- Excellent threshold: 6 credits.
- Missing credits for pass when below 2.
- Missing credits for excellent when between 2 and 6.

## Data Model

Add `srtp_records`.

Fields:

- `id` UUID primary key.
- `user_id` UUID, references `users.id` with cascade delete.
- `title` varchar, required.
- `type` varchar, required. Allowed values:
  - `competition`
  - `project`
  - `lecture`
  - `other`
- `credits` numeric, required, non-negative, supports 0.1 credit increments.
- `description` text, optional but represented as an empty string in API responses.
- `created_at`
- `updated_at`

The table stores itemized records only. Summary values are derived.

## Backend API

Add authenticated SRTP APIs:

- `GET /api/srtp/me`
- `POST /api/srtp/me/records`
- `PUT /api/srtp/me/records/:id`
- `DELETE /api/srtp/me/records/:id`

`GET /api/srtp/me` returns:

```ts
{
  records: SrtpRecord[];
  summary: {
    totalCredits: string;
    passingRequiredCredits: "2.00";
    excellentRequiredCredits: "6.00";
    status: "not_passing" | "passing" | "excellent";
    missingForPassing: string;
    missingForExcellent: string;
  };
}
```

POST and PUT accept:

```ts
{
  title: string;
  type: "competition" | "project" | "lecture" | "other";
  credits: string;
  description: string;
}
```

All routes require login. Users can only update or delete their own records. Missing or non-owned records should return 404.

## Credit Calculation

To avoid floating-point drift, the backend should calculate summary credits in tenths:

1. Parse each credit string.
2. Convert to tenths by multiplying by 10 and rounding to an integer after validation.
3. Sum integer tenths.
4. Convert back to a fixed two-decimal string for API output.

Validation allows non-negative values with up to two decimals, but frontend controls use a 0.1 step.

## Frontend UX

Add `packages/web/src/pages/SrtpPage.vue` and route `/srtp` to it.

Page layout:

1. Header summary card:
   - Title: `SRTP（课外实践）`.
   - Total credits.
   - Status badge: not passing / passing / excellent.
   - Pass and excellent thresholds.
   - Missing-credit hint.
   - Progress bar from 0 to 6 credits.
2. Action button: `新增记录`.
3. Record card list:
   - Title.
   - Type label.
   - Credits.
   - Description.
   - Right-top `...` action menu with edit/delete.
4. Empty state when no records exist.
5. Modal form for create/edit:
   - Title.
   - Type.
   - Credits with `step=0.1`.
   - Description.

Successful create/edit/delete invalidates the SRTP query and shows a short success message.

## Error Handling

- No token: page redirects to `/login`; API returns 401.
- Empty title: 400.
- Invalid type: 400.
- Negative or malformed credits: 400.
- Non-owned or missing record: 404.
- GET with no records returns empty `records` and zero-credit summary.
- Save failure keeps form values and shows the error message.

## Testing

Backend tests should cover:

- Unauthenticated access is rejected.
- Empty GET returns empty records and zero-credit summary.
- POST creates competition/project/lecture records.
- GET sums records and returns passing/excellent status correctly.
- PUT edits a record and updates summary.
- DELETE removes a record and updates summary.
- Invalid title/type/credits are rejected.
- Missing/non-owned record updates return 404.

Frontend tests should cover:

- Router maps `/srtp` to a real SRTP page.
- Unauthenticated page access redirects to `/login`.
- Empty state renders.
- Summary shows 2-credit pass and 6-credit excellent thresholds.
- Credit status colors change for not passing, passing, and excellent.
- Create form submits a record with type/title/credits/description.
- Credit input uses `step=0.1`.
- Record action menu exposes edit/delete.
- Successful mutation refreshes the list.

Verification uses:

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`

## Resolved Decisions

- Record granularity: itemized records.
- Record fields: title, type, credits, description.
- Credit precision: 0.1 credit frontend step.
- Actions: create, edit, delete.
- Layout: dashboard summary plus record cards.
- Backend owns summary calculation.
