# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GradCheck is a full-stack web application for university students to track graduation requirements, manage course plans, and interact with a community plaza. It is a pnpm monorepo with a Vue 3 frontend and an Express.js backend.

## Tech Stack

- **Frontend**: Vue 3 (Composition API, `<script setup>`), Vue Router, Vite, TailwindCSS 4, Varlet UI (mobile-first), TanStack Query (Vue Query)
- **Backend**: Express.js 5, Drizzle ORM, PostgreSQL, JWT authentication, PDF parsing pipeline (pdfjs-dist, OCR, DeepSeek AI)
- **Shared**: TypeScript strict mode, Zod validation
- **Testing**: Vitest (jsdom for frontend, node for backend)

## Common Commands

All commands should be run from the repository root.

```bash
# Development
pnpm dev                      # Start both frontend (vite, port 5173) and backend (tsx watch, port 3000)

# Building
pnpm build                    # Build both packages for production
pnpm typecheck                # Run TypeScript type checking across both packages

# Testing
pnpm test                     # Run all tests (frontend and backend)
# To run a single test file, cd into the package and use:
#   pnpm vitest run src/path/to/file.test.ts
#   pnpm vitest run --reporter=verbose     # for detailed output

# Database (backend)
pnpm db:generate              # Generate Drizzle migrations
pnpm db:migrate               # Run pending migrations
pnpm db:studio                # Launch Drizzle Studio GUI

# PDF Parser (backend)
pnpm parse:program            # Run the PDF program rules parser CLI
```

## Architecture

### Monorepo Structure

The project uses pnpm workspaces with two packages under `packages/`:

- `packages/web/` — Vue 3 frontend
- `packages/backend/` — Express.js API server

### Frontend (`packages/web/`)

- **Vite config** (`vite.config.ts`): Dev server runs on port 5173 and proxies `/api` and `/health` to `http://localhost:3000`.
- **API client** (`src/lib/api.ts`): Thin wrapper around `fetch`. Reads JWT from `localStorage` under key `gradcheck.token` and sends it via `Authorization: Bearer` header. Base URL is controlled by `VITE_API_BASE_URL`.
- **Router** (`src/router.ts`): Uses Vue Router with `createWebHistory()`. Several routes are placeholder pages that describe future functionality.
- **State management**: Uses TanStack Query (Vue Query) for server state. No global client-side state library is used.
- **Styling**: TailwindCSS 4 with `@tailwindcss/vite` plugin. Varlet UI components for mobile-first design.

### Backend (`packages/backend/`)

- **Entry point** (`src/index.ts`): Loads config, creates DB connection, builds repositories, and calls `createApp(dependencies)` before listening on the configured port.
- **App factory** (`src/app.ts`): `createApp(dependencies)` wires routes with dependency injection. This pattern makes testing easier.
- **Modules**: Each domain lives under `src/modules/<name>/` and typically contains:
  - `*.routes.ts` — Express router
  - `*.repository.ts` — Database access layer (Drizzle ORM)
  - `*.schemas.ts` — Zod validation schemas
  - `*.types.ts` — Shared TypeScript types
- **Database** (`src/db/schema.ts`): PostgreSQL with Drizzle ORM. Key conventions:
  - UUID primary keys (`defaultRandom()`)
  - Soft deletes via `deletedAt` timestamp (always filter with `isNull(table.deletedAt)`)
  - `createdAt` / `updatedAt` timestamps on most tables
  - JSONB columns for flexible arrays (e.g., `tags`)
- **Auth**: JWT-based. `authRepository` handles login/register. Token is validated in middleware and attached to `req.user`.
- **Program rules module**: Complex PDF parsing pipeline with multiple extraction strategies (pdfjs-dist primary, OCR fallback, DeepSeek AI enhancement, python pdfplumber alternative).

### Database Configuration

- Drizzle config (`drizzle.config.ts`) loads `.env` from the repo root (`../../.env`) and falls back to local `.env`.
- Default connection string fallback: `postgres://postgres:postgres@localhost:5432/gradcheck`

## TypeScript Conventions

- Strict mode enabled with `noUnusedLocals: true` and `noUnusedParameters: true`. Unused variables will fail the build.
- `moduleResolution: "Bundler"` with ES2022 target.
- Backend imports must include `.js` extensions for Node ESM compatibility, even for `.ts` files.

## Testing

- **Frontend**: Vitest with jsdom environment. Uses `@vue/test-utils` for component testing.
- **Backend**: Vitest with node environment. Uses `supertest` for HTTP assertions.
- Test pattern in both packages: `src/**/*.test.ts`

## Environment Variables

- **Frontend**: `VITE_API_BASE_URL`
- **Backend**: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN`, `AMAP_WEATHER_KEY`
