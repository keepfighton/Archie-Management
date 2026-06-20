#!/bin/bash
# Manual deployment script when GitHub Actions SSH fails
# Run this from your local machine OR directly on the server

set -e

echo "======================================"
echo "Archie Management Manual Deployment"
echo "======================================"
echo ""

# Check if running on server or local
if [ -d "$HOME/nexora-node/apps/archie" ]; then
    echo "📍 Detected: Running ON production server"
    cd $HOME/nexora-node/apps/archie
else
    echo "📍 Detected: Running from LOCAL machine"
    echo ""
    echo "You need to SSH to server first:"
    echo ""
    echo "ssh YOUR_USER@YOUR_SERVER"
    echo ""
    echo "Then run this script on the server, OR run these commands:"
    echo ""
    echo "cd ~/nexora-node/apps/archie"
    echo "git pull origin main"
    echo "docker compose up -d --build --no-deps backend frontend"
    echo "docker ps | grep archie"
    echo ""
    exit 1
fi

echo "📂 Current directory: $(pwd)"
echo ""

echo "🔄 Pulling latest changes..."
git pull origin main

echo ""
echo "🐳 Rebuilding and restarting containers..."
docker compose up -d --build --no-deps backend frontend

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Container status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "NAMES|archie"

echo ""
echo "🌐 Application should be live at: https://archie.nexoratech.co"
echo ""
echo "📝 View logs:"
echo "docker compose logs -f --tail=50 frontend"
echo "docker compose logs -f --tail=50 backend"
