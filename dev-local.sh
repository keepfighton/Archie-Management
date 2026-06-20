#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
LOCAL_OVERRIDE="$ROOT_DIR/docker-compose.local.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not in PATH."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required."
  exit 1
fi

docker network inspect web >/dev/null 2>&1 || docker network create web >/dev/null

echo "Starting local stack with Docker..."
docker compose -f "$COMPOSE_FILE" -f "$LOCAL_OVERRIDE" up -d --build

echo "Waiting for backend health..."
for _ in {1..60}; do
  if curl -fsS http://localhost:3092/health >/dev/null 2>&1; then
    echo "Seeding default data..."
    docker compose -f "$COMPOSE_FILE" -f "$LOCAL_OVERRIDE" exec -T backend ./seed >/dev/null
    echo "Ready."
    echo "Frontend: http://localhost:3091"
    echo "Backend:  http://localhost:3092"
    echo "Logs:"
    echo "  docker compose -f \"$COMPOSE_FILE\" -f \"$LOCAL_OVERRIDE\" logs -f backend"
    echo "  docker compose -f \"$COMPOSE_FILE\" -f \"$LOCAL_OVERRIDE\" logs -f frontend"
    exit 0
  fi
  sleep 1
done

echo "Backend did not become healthy."
echo "Last backend logs:"
docker compose -f "$COMPOSE_FILE" -f "$LOCAL_OVERRIDE" logs --tail=80 backend
exit 1
