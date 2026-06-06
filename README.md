# GradCheck

GradCheck is a mobile-first web app for tracking Southeast University graduation requirements.

## Stack

- Frontend: Vite, Vue, Vue Router, Varlet, Zod, TanStack Query, TailwindCSS
- Backend: TypeScript, Express.js, Drizzle ORM
- Database: PostgreSQL
- Workspace: pnpm monorepo

## Packages

- `packages/web`: Vue web app with login, profile, navbar, and feature placeholder cards.
- `packages/backend`: Express API with health check, JWT auth, user profile routes, and Drizzle schema.

## Setup

```bash
pnpm install
cp .env.example .env
```

For local PostgreSQL:

```bash
docker compose up -d postgres
pnpm db:migrate
```

For a remote PostgreSQL server, set `DATABASE_URL` in `.env` after the server allows your client IP:

```bash
DATABASE_URL=postgres://<user>:<password>@<host>:5432/gradcheck?sslmode=require
```

## Development

```bash
pnpm dev
```

- Web: http://localhost:5173
- Backend: http://localhost:3000
- Health check: http://localhost:3000/health

## Verification

```bash
pnpm test
pnpm typecheck
pnpm build
```
