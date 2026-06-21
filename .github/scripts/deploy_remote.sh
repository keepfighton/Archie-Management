set -e

echo "📂 Navigating to project directory..."
cd ~/archie-node/apps/archie-management

echo "🔄 Pulling latest code..."
git fetch origin main
git reset --hard origin/main

echo "🔍 Checking environment file..."
if [ ! -f .env ]; then
  echo "❌ .env file not found!"
  exit 1
fi

echo "🌐 Checking network..."
docker network inspect web >/dev/null 2>&1 || docker network create web

echo "🐳 Building and deploying containers..."
docker compose up -d --build --no-deps backend frontend

echo "⏳ Waiting for services..."
sleep 10

echo "🏥 Health check..."
max_attempts=30
attempt=0
while [ "$attempt" -lt "$max_attempts" ]; do
  if docker compose exec -T backend sh -lc 'wget -qO- http://127.0.0.1:8080/health >/dev/null'; then
    echo "✅ Backend is healthy!"
    break
  fi
  attempt=$((attempt + 1))
  echo "Waiting... ($attempt/$max_attempts)"
  sleep 2
done

if [ "$attempt" -eq "$max_attempts" ]; then
  echo "⚠️ Health check timeout!"
  docker compose logs --tail=50 backend
  exit 1
fi

echo "🔍 Verifying containers..."
docker ps --format '{{.Names}}' | grep '^archie-backend$' || exit 1
docker ps --format '{{.Names}}' | grep '^archie-frontend$' || exit 1

echo "🧹 Cleaning up old images..."
docker image prune -f

echo "✅ Deployment successful!"
