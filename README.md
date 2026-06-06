# GradCheck

GradCheck is a mobile-first web app for tracking Southeast University graduation requirements.

## Stack

- Frontend: Vite, Vue, Vue Router, Varlet, Zod, TanStack Query, TailwindCSS
- Backend: TypeScript, Express.js, Drizzle ORM
- Database: PostgreSQL
- Workspace: pnpm monorepo

## Packages

- `packages/web`: Vue web app with login, profile, navbar, and feature placeholder cards.
- `packages/backend`: Express API with health check, JWT auth, user profile routes, Drizzle schema, and program PDF parsing.

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

## Program PDF Parsing

The backend includes a program-rule parser at `packages/backend/src/modules/program-rules`.
It separates program parsing output into two primary parts:

- Graduation requirements: grouped rules and non-course requirements used for progress calculation.
- Course catalog: structured table facts only, including course code, course name, credits, teaching academic year, and teaching semester.

```text
data/program_rules/<draft_id>.json                    # full editable parse draft
data/program_rules/requirements/<draft_id>.json       # requirement set only
data/program_rules/course_catalogs/<draft_id>.json    # course catalog only
```

CLI example:

```bash
pnpm parse:program -- "./2022级软件工程专业培养方案.pdf" \
  --save \
  --storage-dir data/program_rules \
  --school 东南大学 \
  --college 计算机科学与工程学院 \
  --major 软件工程 \
  --grade 2022 \
  --version 2022级
```

With DeepSeek enhancement:

```bash
export DEEPSEEK_API_KEY="sk-..."
pnpm parse:program -- "./2022级软件工程专业培养方案.pdf" --llm deepseek --save
```

API endpoints:

- `POST /api/program-rules/uploads`
- `GET /api/program-rules/:draftId`
- `GET /api/program-rules/:draftId/requirements`
- `GET /api/program-rules/:draftId/course-catalog`
- `PATCH /api/program-rules/:draftId`
