# GradCheck single-port deployment image for ModelScope 创空间 (Docker SDK).
# Serves the built Vue frontend, the Express API, and the MCP endpoint from one
# process listening on 0.0.0.0:7860.

# --- Stage 1: install all workspace dependencies ---------------------------
FROM node:22-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json packages/backend/package.json
COPY packages/web/package.json packages/web/package.json
RUN pnpm install --frozen-lockfile

# --- Stage 2: build the frontend (same-origin API, relative URLs) ----------
FROM deps AS build-web
COPY tsconfig.base.json ./
COPY packages/web packages/web
ENV VITE_API_BASE_URL=""
RUN pnpm --filter @gradcheck/web build

# --- Stage 3: build the backend -------------------------------------------
FROM deps AS build-backend
COPY tsconfig.base.json ./
COPY packages/backend packages/backend
RUN pnpm --filter @gradcheck/backend build

# --- Stage 4: runtime (Node + Python for pdfplumber) -----------------------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=7860

# Python 3 + pip are required because the program-rules pipeline shells out to
# scripts/pdfplumber_extract.py at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json packages/backend/package.json
RUN pnpm install --filter @gradcheck/backend --prod --frozen-lockfile && pnpm store prune

# Compiled backend, its Python helper scripts, and the built frontend.
COPY --from=build-backend /app/packages/backend/dist packages/backend/dist
COPY packages/backend/scripts packages/backend/scripts
COPY --from=build-web /app/packages/web/dist packages/backend/public

EXPOSE 7860
ENTRYPOINT ["node", "packages/backend/dist/index.js"]
