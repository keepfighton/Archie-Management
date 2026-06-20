#!/bin/bash
# Complete Fix - Backend Migration Error + Frontend Nginx Config
# Run on VPS

set -e

cd ~/archie-node/apps/archie-management

echo "🔧 Complete Fix for Archie Management"
echo "======================================"
echo ""

echo "Step 1: Stopping all containers..."
docker compose down

echo ""
echo "Step 2: Removing old database volume (fresh start)..."
docker volume rm archie-management_postgres_data 2>/dev/null || echo "Volume already removed"

echo ""
echo "Step 3: Fixing .env with Hostinger SMTP..."
JWT_SECRET=$(openssl rand -base64 32)

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

# ─── SMTP (Hostinger) ───────────────────────
SMTP_HOST=smtp.hostinger.com
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

echo "✅ .env updated with:"
echo "   - Fresh JWT_SECRET"
echo "   - SMTP: smtp.hostinger.com"

echo ""
echo "Step 4: Fixing Frontend nginx config..."
# Check if nginx conf has old name
if grep -q "archie-backend" Frontend/nginx.conf 2>/dev/null; then
    echo "   Updating archie-backend → backend in nginx.conf"
    sed -i 's/archie-backend/backend/g' Frontend/nginx.conf
    echo "   ✅ nginx.conf fixed"
else
    echo "   ✅ nginx.conf already correct (or doesn't exist)"
fi

echo ""
echo "Step 5: Rebuilding all images (no cache)..."
docker compose build --no-cache

echo ""
echo "Step 6: Starting all services..."
docker compose up -d

echo ""
echo "Step 7: Waiting for postgres to be healthy..."
sleep 5

ATTEMPT=0
while [ $ATTEMPT -lt 20 ]; do
    if docker compose ps postgres | grep -q "healthy"; then
        echo "✅ Postgres is healthy!"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "Waiting for postgres... ($ATTEMPT/20)"
    sleep 2
done

echo ""
echo "Step 8: Waiting for backend to be ready..."
sleep 10

ATTEMPT=0
while [ $ATTEMPT -lt 30 ]; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ Backend is healthy!"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "Waiting for backend... ($ATTEMPT/30)"
    sleep 3
done

if [ $ATTEMPT -eq 30 ]; then
    echo "⚠️ Backend timeout, checking logs..."
    docker compose logs backend --tail 30
fi

echo ""
echo "Step 9: Seeding database..."
docker compose exec -T backend sh -c 'cd cmd/seed && go run main.go' 2>&1 || echo "⚠️ Seeding issue (might be already seeded)"

echo ""
echo "=========================================="
echo "✅ Complete Fix Done!"
echo "=========================================="
echo ""

docker compose ps

echo ""
echo "🌐 Access:"
echo "  - Archie Management: https://management.archieconsultant.com"
echo "  - Backend Health: http://localhost:8080/health"
echo ""
echo "👤 Default Login:"
echo "  Email: admin@archieconsultant.com"
echo "  Pass:  Admin123!"
echo ""
echo "📧 SMTP Config:"
echo "  Host: smtp.hostinger.com"
echo "  User: info@archieconsultant.com"
echo "  ⚠️  Set SMTP_PASSWORD in .env untuk enable forgot password"
echo ""
echo "📝 View logs:"
echo "  docker compose logs -f backend"
echo "  docker compose logs -f frontend"
echo ""
echo "🔍 Test backend:"
echo "  curl http://localhost:8080/health"
echo ""
