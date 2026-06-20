#!/bin/bash
# Quick deployment script untuk Archie Management di VPS
# Run di VPS setelah clone repo

set -e

echo "🚀 Archie Management - VPS Deployment Script"
echo "=============================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "⚠️  Warning: Not running as root. Some commands may fail."
  echo "   Consider running: sudo ./deploy-vps.sh"
  echo ""
fi

# Check Docker
echo "🔍 Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found! Please install Docker first."
    echo "   https://docs.docker.com/engine/install/"
    exit 1
fi

# Check Docker Compose
echo "🔍 Checking Docker Compose..."
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose not found! Please install Docker Compose v2+"
    exit 1
fi

echo "✅ Docker & Docker Compose installed"
echo ""

# Create web network if not exists
echo "🌐 Creating Traefik network..."
docker network inspect web >/dev/null 2>&1 || docker network create web
echo "✅ Network 'web' ready"
echo ""

# Check .env file
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "   Please create .env file first. See DEPLOYMENT.md"
    exit 1
fi

# Check if JWT_SECRET and POSTGRES_PASSWORD changed
if grep -q "CHANGE_THIS" .env; then
    echo "⚠️  WARNING: .env contains default values!"
    echo "   Please update JWT_SECRET and POSTGRES_PASSWORD in .env"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "📦 Building and starting containers..."
docker compose up -d --build

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if containers are running
echo ""
echo "🔍 Checking container status..."
docker compose ps

echo ""
echo "🏥 Checking backend health..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:8080/health > /dev/null; then
        echo "✅ Backend is healthy!"
        break
    fi
    attempt=$((attempt + 1))
    echo "   Waiting... ($attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "⚠️  Backend health check timeout. Check logs:"
    echo "   docker compose logs backend"
fi

echo ""
echo "🌱 Syncing default login accounts..."
docker compose exec -T backend sh -lc './seed'

echo ""
echo "📊 Container logs (last 20 lines):"
echo "=================================="
docker compose logs --tail=20

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Seed database (first time only):"
echo "   docker compose exec backend sh -c 'cd cmd/seed && go run main.go'"
echo ""
echo "2. Access application:"
echo "   https://management.archieconsultant.com"
echo ""
echo "3. Default login:"
echo "   Email: admin@archieconsultant.com"
echo "   Password: Admin123!"
echo ""
echo "4. Check logs:"
echo "   docker compose logs -f"
echo ""
echo "5. View container stats:"
echo "   docker stats archie-backend archie-frontend archie-postgres"
echo ""
