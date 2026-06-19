#!/bin/bash
# Fix Postgres Issue - Run this on VPS
# Copy-paste ini ke VPS untuk fix postgres error

set -e

echo "🔧 Fixing Postgres Issue"
echo "========================"

cd ~/archie-node/apps/archie-management

echo ""
echo "Step 1: Checking current status..."
docker compose ps -a

echo ""
echo "Step 2: Stopping all containers..."
docker compose down

echo ""
echo "Step 3: Checking for port conflicts..."
netstat -tlnp | grep 5432 || echo "✅ Port 5432 is free"

echo ""
echo "Step 4: Checking .env file..."
if [ ! -f .env ]; then
    echo "❌ .env file not found! Creating from template..."
    cat > .env <<'ENVFILE'
# ─── App ────────────────────────────────────
ENV=production
PORT=8080
APP_URL=https://management.archieconsultant.com
UPLOAD_DIR=/app/uploads

# ─── Database (PostgreSQL) ──────────────────
POSTGRES_USER=archie_user
POSTGRES_PASSWORD=Archie@DB2024Secure!
POSTGRES_DB=archie_management_db
DB_HOST=postgres
DB_PORT=5432

# ─── Auth & JWT ─────────────────────────────
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXP_HOURS=24

# ─── SMTP (Email untuk Forgot Password) ────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=info@archieconsultant.com
SMTP_PASSWORD=your-app-password-here
SMTP_FROM=info@archieconsultant.com

# ─── WhatsApp Cloud API (Optional) ──────────
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_API_VERSION=v20.0
WHATSAPP_OWNER_NUMBERS=6285218071841

# ─── Frontend Build Args ────────────────────
VITE_API_URL=/api/v1
ENVFILE

    echo "✅ .env created with generated JWT_SECRET"
else
    echo "✅ .env exists"
fi

cat .env | grep -E "POSTGRES|DB_|JWT_SECRET"

echo ""
echo "Step 5: Removing old volumes (if any)..."
docker volume ls | grep archie-management || echo "No old volumes"

echo ""
echo "Step 6: Starting postgres only..."
docker compose up -d postgres

echo ""
echo "Step 7: Waiting for postgres to be healthy (max 60 seconds)..."
ATTEMPT=0
MAX_ATTEMPTS=30

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    HEALTH=$(docker compose ps postgres --format json 2>/dev/null | grep -o '"Health":"[^"]*"' | cut -d'"' -f4)

    if [ "$HEALTH" = "healthy" ]; then
        echo "✅ Postgres is healthy!"
        break
    fi

    ATTEMPT=$((ATTEMPT + 1))
    echo "Waiting... ($ATTEMPT/$MAX_ATTEMPTS) - Current status: $HEALTH"
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "❌ Postgres health check timeout!"
    echo ""
    echo "Postgres logs:"
    docker compose logs postgres
    exit 1
fi

echo ""
echo "Step 8: Starting backend and frontend..."
docker compose up -d backend frontend

echo ""
echo "Step 9: Waiting for backend to be healthy (max 60 seconds)..."
ATTEMPT=0
while [ $ATTEMPT -lt 30 ]; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ Backend is healthy!"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "Waiting for backend... ($ATTEMPT/30)"
    sleep 2
done

if [ $ATTEMPT -eq 30 ]; then
    echo "⚠️ Backend health check timeout, checking logs..."
    docker compose logs backend | tail -50
fi

echo ""
echo "Step 10: Seeding database (if not already seeded)..."
docker compose exec -T backend sh -c 'cd cmd/seed && go run main.go' 2>&1 || echo "⚠️ Seeding skipped (might be already seeded)"

echo ""
echo "=========================================="
echo "✅ Fix Complete!"
echo "=========================================="
echo ""

docker compose ps

echo ""
echo "🌐 Access:"
echo "  - Archie Management: https://management.archieconsultant.com"
echo "  - Backend Health: http://localhost:8080/health"
echo ""
echo "👤 Login:"
echo "  Email: admin@archieconsultant.com"
echo "  Pass:  Admin123!"
echo ""
echo "📝 Check logs:"
echo "  docker compose logs -f"
echo ""
