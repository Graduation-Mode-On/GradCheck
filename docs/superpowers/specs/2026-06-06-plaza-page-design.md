# Plaza Page Design

## Context

GradCheck already has a `/plaza` route, mobile bottom navigation entry, and placeholder page. The product PRD defines the plaza as the home for course exchange posts and team recruiting posts. The current backend has authentication, user profiles, audit logs, and no plaza/feed/post data model yet.

The first plaza implementation will be a logged-in, full-stack, persistent feature for:

- Course exchange posts.
- Team recruiting posts.

It will not add built-in chat. Users must provide their own contact information.

## Goals

- Replace the current plaza placeholder with a mobile-first list page.
- Let logged-in users create, browse, filter, edit, close/reopen, and soft-delete their own plaza posts.
- Support both course exchange and team recruiting with shared list behavior and type-specific fields.
- Keep author identity minimal in public display: show only the author's display name.
- Preserve existing project conventions for Vue, TanStack Query, Express, Zod, Drizzle, and JWT authentication.

## Non-goals

- No anonymous browsing or posting.
- No built-in direct messaging or chat.
- No hard delete for normal delete actions.
- No structured course timetable parser in the first version.
- No moderation/admin workflow in the first version.

## Requirements

### Access

- `/plaza` requires login. Unauthenticated users are redirected to `/login`.
- All plaza APIs require a valid Bearer token.
- The authenticated user is always the post author for create operations.
- Only the author can edit, close/reopen, or delete a post.

### Post Types

The plaza supports two post types:

- `course_exchange`
- `team_recruit`

Shared post fields:

- `id`
- `authorUserId`
- `authorDisplayName` in responses
- `type`
- `title`
- `college`
- `contact`
- `description`
- `tags`
- `status`
- `createdAt`
- `updatedAt`
- `deletedAt`

Course exchange fields:

- `offeredCourse`
- `wantedCourse`
- `courseTime`

Team recruiting fields:

- `teamPurpose`
- `projectType`
- `teammateRequirements`
- `currentMembers`
- `targetMembers`
- `activityTime`

### Lifecycle

- Status values are `open` and `closed`.
- New posts start as `open`.
- Authors can close and reopen their posts.
- Delete is a soft delete: set `deletedAt`; soft-deleted posts are excluded from normal queries.
- Default list view shows only open, non-deleted posts sorted by `updatedAt` descending.

### Filtering and Search

The list supports:

- Type filter.
- Status filter.
- Course keyword filter for course exchange fields.
- College filter.
- Time keyword filter for `courseTime` and `activityTime`.
- Tag text filter.
- General keyword search across title, description, contact, and type-specific text fields.

The frontend uses infinite scrolling backed by cursor pagination. The backend returns `posts` and `nextCursor`.

### Frontend UX

The page uses a list-first layout:

1. Header with title and publish button.
2. Type tabs for all posts, course exchange, and team recruiting.
3. Search box and compact filter controls.
4. Infinite-scrolling post list.

Post cards show:

- Type badge.
- Status badge.
- Title.
- Tags.
- Updated time.
- Author display name only.
- Type-specific summary fields.

Clicking a card expands details inline. Details include contact, full description, and all relevant type-specific fields. If the current user owns the post, the card shows edit, close/reopen, and delete actions.

Create and edit use a modal form on the same page. The form switches required fields based on post type. Tags are entered as comma-separated free text. Contact is a single required text field.

## Backend Design

### Module Structure

Add a plaza module under `packages/backend/src/modules/plaza/`:

- `plaza.schemas.ts` for request validation and query validation.
- `plaza.repository.ts` for Drizzle queries.
- `plaza.service.ts` for ownership, lifecycle, and validation rules that do not belong in route handlers.
- `plaza.routes.ts` for Express routes.

Register the router in `packages/backend/src/app.ts` at `/api/plaza/posts`.

### Database

Use a single `plaza_posts` table with shared columns and nullable type-specific columns. This keeps list queries simple and matches the current MVP scope of two post types.

Important constraints:

- `author_user_id` references `users.id`.
- `type` is stored as text or varchar constrained by application validation.
- `status` is stored as text or varchar constrained by application validation.
- `tags` is stored as `jsonb` string array.
- `current_members` and `target_members` are integers for team recruiting posts.
- `deleted_at` is nullable and drives soft delete behavior.

Application validation enforces:

- Course exchange posts require `offeredCourse`, `wantedCourse`, and `courseTime`.
- Team recruiting posts require `teamPurpose`, `projectType`, `teammateRequirements`, `currentMembers`, `targetMembers`, and `activityTime`.
- `currentMembers <= targetMembers`.
- Contact is always required.

### API

`createApp` should accept a plaza repository in addition to the existing auth repository. `createPlazaRouter` should receive both repositories so every route can use the existing `authenticate(authRepository)` middleware and the plaza repository for post operations.

- `GET /api/plaza/posts`
  - Query filters: `type`, `status`, `course`, `college`, `time`, `tag`, `keyword`, `cursor`, `limit`.
  - Default filters: `status=open`, exclude soft-deleted posts.
  - Response: `{ posts, nextCursor }`.

- `POST /api/plaza/posts`
  - Creates a post for the authenticated user.
  - Response: `{ post }`.

- `PUT /api/plaza/posts/:id`
  - Edits an existing post owned by the authenticated user.
  - Response: `{ post }`.

- `PATCH /api/plaza/posts/:id/status`
  - Body: `{ status: "open" | "closed" }`.
  - Only the author can update status.
  - Response: `{ post }`.

- `DELETE /api/plaza/posts/:id`
  - Soft deletes an owned post.
  - Response: `{ success: true }`.

## Frontend Design

### Files

Update or add:

- `packages/web/src/pages/PlazaPage.vue`
- `packages/web/src/components/PlazaPostCard.vue`
- `packages/web/src/components/PlazaPostForm.vue`
- `packages/web/src/components/PlazaFilters.vue`
- `packages/web/src/lib/api.ts`
- `packages/web/src/schemas/plaza.ts`

### Data Fetching

Use TanStack Query:

- Infinite query for post list.
- Mutations for create, update, status change, and delete.
- Invalidate or update plaza query cache after mutations.

### State

Local page state includes:

- Active type tab.
- Search and filter values.
- Modal mode: create or edit.
- Expanded card ID.

The page should avoid adding global state unless future features require it.

## Error Handling

- Missing or invalid token returns 401.
- Non-author mutation returns 403.
- Missing, deleted, or inaccessible post returns 404.
- Zod validation errors return 400 through the existing error handler.
- Unknown errors keep the existing `{ error: { message: "Internal server error" } }` shape.
- Frontend form errors should be shown near the form.
- List loading errors should show a retry affordance, not an empty-state success message.

## Testing

Backend tests should cover:

- Authenticated users can create course exchange posts.
- Authenticated users can create team recruiting posts.
- List defaults to open, non-deleted posts.
- Filters work for type, status, course, college, time, tag, and keyword.
- Non-authenticated users cannot call plaza APIs.
- Non-authors cannot edit, close/reopen, or delete posts.
- Authors can close and reopen posts.
- Soft-deleted posts disappear from normal lists.
- Team member validation rejects `currentMembers > targetMembers`.

Frontend tests should cover:

- `/plaza` redirects to `/login` without a token.
- The list-first layout renders search, filters, and post cards.
- The form switches fields by post type.
- Create/edit validation messages are visible.
- Author-only controls appear only for owned posts.
- Infinite scrolling requests additional pages.

Verification uses the existing project commands:

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`

## Open Decisions Resolved

- Scope: course exchange plus team recruiting.
- Depth: full-stack persistent implementation.
- Access: login required for browsing and actions.
- Data model: single table with typed fields.
- Layout: list-first.
- Loading: infinite scrolling.
- Default visibility: open posts only.
- Author display: display name only.
- Contact: one required free-text field.
- Tags: comma-separated free text.
- Time fields: free text.
