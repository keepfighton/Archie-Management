#!/bin/bash
# Fix .env JWT_SECRET issue and restart backend
# Run on VPS

set -e

cd ~/archie-node/apps/archie-management

echo "🔧 Fixing .env and restarting backend"
echo "======================================"

# Generate proper JWT secret
JWT_SECRET=$(openssl rand -base64 32)

echo ""
echo "Step 1: Backing up current .env..."
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

echo ""
echo "Step 2: Fixing .env file..."
cat > .env <<ENVFILE
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
DB_USER=archie_user
DB_PASSWORD=Archie@DB2024Secure!
DB_NAME=archie_management_db

# ─── Auth & JWT ─────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_EXP_HOURS=24

# ─── SMTP (Email untuk Forgot Password) ────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=info@archieconsultant.com
SMTP_PASSWORD=
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

echo "✅ .env fixed with proper JWT_SECRET"

echo ""
echo "Step 3: Verifying .env..."
cat .env | grep -E "JWT_SECRET|POSTGRES|DB_"

echo ""
echo "Step 4: Stopping backend..."
docker compose stop backend

echo ""
echo "Step 5: Removing old backend container..."
docker compose rm -f backend

echo ""
echo "Step 6: Starting backend with new config..."
docker compose up -d backend

echo ""
echo "Step 7: Watching backend logs (Ctrl+C to stop)..."
echo "Waiting 5 seconds for startup..."
sleep 5

# Check if backend started successfully
if docker compose ps backend | grep -q "Up"; then
    echo "✅ Backend container is Up!"
else
    echo "⚠️ Backend container not up, checking logs..."
fi

echo ""
echo "📝 Backend logs:"
docker compose logs backend --tail 100

echo ""
echo "Step 8: Testing backend health..."
sleep 5

MAX_ATTEMPTS=20
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ Backend is healthy!"
        echo ""
        echo "Backend health response:"
        curl -s http://localhost:8080/health
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "Waiting for backend... ($ATTEMPT/$MAX_ATTEMPTS)"
    sleep 3
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "❌ Backend still not healthy after $MAX_ATTEMPTS attempts"
    echo ""
    echo "Latest backend logs:"
    docker compose logs backend --tail 50
    echo ""
    echo "Container status:"
    docker compose ps backend
    exit 1
fi

echo ""
echo "Step 9: Seeding database..."
docker compose exec -T backend sh -lc './seed'

echo ""
echo "=========================================="
echo "✅ All services should be running now!"
echo "=========================================="
echo ""

docker compose ps

echo ""
echo "🌐 Access URLs:"
echo "  - Archie Management: https://management.archieconsultant.com"
echo "  - Backend Health:    curl http://localhost:8080/health"
echo ""
echo "👤 Default Login:"
echo "  Email: admin@archieconsultant.com"
echo "  Pass:  Admin123!"
echo ""
echo "📝 View logs:"
echo "  docker compose logs -f"
echo ""
echo "🔍 If still having issues:"
echo "  docker compose logs backend"
echo "  docker compose logs frontend"
echo ""
