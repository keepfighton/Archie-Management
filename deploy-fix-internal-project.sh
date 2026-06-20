#!/bin/bash

# Deployment script for Internal Project error logging fix
# Date: 11 Juni 2026
# Purpose: Deploy fix untuk production bug di /internal-project/projects/1

set -e  # Exit on error

echo "======================================"
echo "Archie Management Internal Project Fix Deployment"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Config - EDIT THESE IF NEEDED
SERVER_USER="ubuntu"
SERVER_HOST="72.61.209.201"  # archie.nexoratech.co
SSH_KEY="~/.ssh/979798.pem"
DEPLOY_PATH="/opt/archie"

echo -e "${BLUE}📋 Pre-deployment Checklist${NC}"
echo "1. Changes committed: ✅"
echo "2. Frontend built: ✅"
echo "3. Git branch: $(git branch --show-current)"
echo ""

echo -e "${YELLOW}⚠️  You need to push to GitHub first!${NC}"
echo "Run this command:"
echo -e "${GREEN}git push origin main${NC}"
echo ""
read -p "Have you pushed to GitHub? (y/N): " pushed
if [[ ! "$pushed" =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Please push to GitHub first, then run this script again${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🔐 Step 1: SSH to production server${NC}"
echo "Testing SSH connection..."

if ! ssh -i "$SSH_KEY" -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_HOST" "echo 'SSH OK'" 2>&1 | grep -q "SSH OK"; then
    echo -e "${RED}❌ SSH connection failed${NC}"
    echo ""
    echo "Trying alternative methods..."
    echo ""
    echo -e "${YELLOW}Option 1: Manual SSH${NC}"
    echo "ssh -i $SSH_KEY $SERVER_USER@$SERVER_HOST"
    echo ""
    echo -e "${YELLOW}Option 2: If you have password access:${NC}"
    echo "ssh $SERVER_USER@$SERVER_HOST"
    echo ""
    echo "Then run these commands manually:"
    echo ""
    echo -e "${GREEN}cd $DEPLOY_PATH"
    echo "git pull origin main"
    echo "cd Frontend"
    echo "npm run build"
    echo "docker-compose down frontend"
    echo "docker-compose up -d frontend"
    echo "docker-compose logs -f --tail=50 frontend${NC}"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ SSH connection successful${NC}"
echo ""

echo -e "${BLUE}🚀 Step 2: Deploy to production${NC}"

ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
set -e

echo "📂 Navigate to deploy directory..."
cd /opt/archie || { echo "❌ Deploy directory not found"; exit 1; }

echo "🔄 Pull latest changes..."
git pull origin main

echo "📦 Rebuild frontend..."
cd Frontend
npm run build

echo "🐳 Restart frontend container..."
cd ..
docker-compose down frontend
docker-compose up -d frontend

echo "✅ Deployment complete!"
echo ""
echo "📋 Checking container status..."
docker ps | grep archie

echo ""
echo "📝 Recent logs:"
docker-compose logs --tail=20 frontend

echo ""
echo "🎉 Deployment successful!"
ENDSSH

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}📊 Next Steps:${NC}"
echo "1. Open browser: https://archie.nexoratech.co/internal-project/projects/1"
echo "2. Press F12 → Console tab"
echo "3. Check for detailed error logs (should see full error object now)"
echo "4. Share the console output for further analysis"
echo ""
echo -e "${YELLOW}Monitor logs:${NC}"
echo "ssh -i $SSH_KEY $SERVER_USER@$SERVER_HOST"
echo "cd $DEPLOY_PATH && docker-compose logs -f frontend"
echo ""
