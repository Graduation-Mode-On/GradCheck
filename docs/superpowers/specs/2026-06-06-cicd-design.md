# GradCheck CI/CD Design

## Goal

Deploy GradCheck automatically to the production Ubuntu server when `main` is updated. The public site will use `https://gc.myseu.cn`, with GitHub Actions handling CI checks and deployment orchestration.

## Architecture

Use Docker Compose on the server for application services:

- Backend: a Node container running the compiled Express app from `packages/backend/dist/index.js`.
- Frontend: static Vite output served by Caddy.
- Reverse proxy: Caddy listens on ports 80 and 443, automatically obtains and renews HTTPS certificates for `gc.myseu.cn`, serves the frontend, and proxies `/api/*` plus `/health` to the backend container.
- Database: not managed by this Compose stack. The backend reads `DATABASE_URL` from the production `.env`, pointing to the existing PostgreSQL instance.

Only Caddy is exposed publicly. The backend remains on the internal Compose network.

## CI/CD Flow

Add a GitHub Actions workflow triggered by pushes to `main` and by manual dispatch.

CI phase:

1. Check out the repository.
2. Install pnpm.
3. Install dependencies with the lockfile.
4. Run `pnpm typecheck`.
5. Run `pnpm test`.
6. Run `pnpm build`.

Deployment phase runs only after CI passes:

1. Connect to the server over SSH using GitHub Secrets.
2. Ensure the deployment directory exists.
3. Sync or update the repository on the server.
4. Write the production `.env` from GitHub Secrets.
5. Run database migrations.
6. Rebuild and restart the Docker Compose services.
7. Verify `https://gc.myseu.cn/health`.

## Secrets and Server Initialization

Production secrets are stored in GitHub Secrets, not in the repository. Required secrets include:

- `PROD_SSH_HOST`
- `PROD_SSH_USER`
- `PROD_SSH_KEY`
- `PROD_DATABASE_URL`
- `PROD_JWT_SECRET`
- `PROD_AMAP_WEATHER_KEY`
- `PROD_CORS_ORIGIN`

The server needs one-time setup:

- Install Docker and Docker Compose.
- Create the deployment directory.
- Configure SSH key access for the deployment user.
- Ensure `gc.myseu.cn` points to the server.
- Open ports 80 and 443.

Password login may be used only for initial setup. Long-term automated deployments use SSH key authentication.

## Error Handling

The deployment script must run in strict shell mode. Missing secrets, failed migrations, failed Compose startup, or failed health checks must fail the workflow. The workflow must not silently report success after a partial deployment.

## Testing and Verification

The workflow uses the repository's existing verification commands: `pnpm typecheck`, `pnpm test`, and `pnpm build`. Deployment-specific validation includes Compose configuration checks and a public health check through Caddy at `https://gc.myseu.cn/health`.
