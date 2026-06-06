FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json packages/backend/package.json
RUN pnpm install --filter @gradcheck/backend --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/backend packages/backend
RUN pnpm --filter @gradcheck/backend build

FROM deps AS migrate
COPY tsconfig.base.json ./
COPY packages/backend packages/backend
WORKDIR /app/packages/backend
CMD ["pnpm", "db:migrate"]

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json packages/backend/package.json
RUN pnpm install --filter @gradcheck/backend --prod --frozen-lockfile && pnpm store prune
COPY --from=build /app/packages/backend/dist packages/backend/dist
WORKDIR /app/packages/backend
CMD ["node", "dist/index.js"]
