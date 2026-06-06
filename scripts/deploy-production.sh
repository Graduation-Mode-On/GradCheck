#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-https://gc.myseu.cn/health}"

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

require_env_key() {
  local key="$1"
  if ! grep -Eq "^${key}=.+" .env; then
    echo "Missing required .env key: $key" >&2
    exit 1
  fi
}

require_command docker
require_command curl

if [ ! -f .env ]; then
  echo "Missing production .env in $(pwd)" >&2
  exit 1
fi

require_env_key DATABASE_URL
require_env_key JWT_SECRET
require_env_key AMAP_WEATHER_KEY
require_env_key CORS_ORIGIN

docker compose -f "$COMPOSE_FILE" config >/dev/null
docker compose -f "$COMPOSE_FILE" build migrate backend web
docker compose -f "$COMPOSE_FILE" run --rm migrate
docker compose -f "$COMPOSE_FILE" up -d backend web
docker compose -f "$COMPOSE_FILE" ps

for attempt in $(seq 1 12); do
  if curl -fsS "$PUBLIC_HEALTH_URL" >/tmp/gradcheck-health.json; then
    cat /tmp/gradcheck-health.json
    echo
    exit 0
  fi

  echo "Health check attempt ${attempt}/12 failed; retrying in 5 seconds" >&2
  sleep 5
done

docker compose -f "$COMPOSE_FILE" logs --tail=100 backend web >&2
echo "Production health check failed: $PUBLIC_HEALTH_URL" >&2
exit 1
