#!/bin/bash
# ====================================
# ARCHIE VPS COMPLETE SETUP SCRIPT
# Run this on VPS: 187.77.122.197
# ====================================

set -e

echo "🚀 Archie VPS - Complete Setup"
echo "========================================"
echo ""
echo "VPS IP: 187.77.122.197"
echo "Structure: ~/archie-node/apps/"
echo ""

# Function to show progress
show_progress() {
    echo ""
    echo "================================"
    echo "▶ $1"
    echo "================================"
}

# Update system
show_progress "Step 1/10: Updating system packages"
apt-get update
apt-get upgrade -y

# Install dependencies
show_progress "Step 2/10: Installing dependencies"
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw \
    wget \
    htop \
    vim \
    apache2-utils

# Install Docker
show_progress "Step 3/10: Installing Docker"
if ! command -v docker &> /dev/null; then
    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Add Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker Engine
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Start Docker
    systemctl start docker
    systemctl enable docker

    echo "✅ Docker installed!"
else
    echo "✅ Docker already installed"
fi

docker --version
docker compose version

# Create directory structure
show_progress "Step 4/10: Creating directory structure"
mkdir -p ~/archie-node/apps
mkdir -p ~/archie-node/traefik/letsencrypt
cd ~/archie-node

echo "✅ Created: ~/archie-node/apps"
echo "✅ Created: ~/archie-node/traefik"

# Create Traefik configuration
show_progress "Step 5/10: Configuring Traefik"
cd ~/archie-node/traefik

cat > traefik.yml <<'TRAEFIK_YML'
api:
  dashboard: true
  insecure: false

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

certificatesResolvers:
  myresolver:
    acme:
      email: info@archieconsultant.com
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: web

log:
  level: INFO
TRAEFIK_YML

echo "✅ Created traefik.yml"

# Generate Traefik dashboard password
TRAEFIK_HASH=$(htpasswd -nb admin admin123)

# Create docker-compose for Traefik
cat > docker-compose.yml <<TRAEFIK_COMPOSE
version: '3.8'

services:
  traefik:
    image: traefik:v3.0
    container_name: traefik
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik.yml:/traefik.yml:ro
      - ./letsencrypt:/letsencrypt
    networks:
      - web
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.traefik.rule=Host(\`traefik.archieconsultant.com\`)"
      - "traefik.http.routers.traefik.entrypoints=websecure"
      - "traefik.http.routers.traefik.tls.certresolver=myresolver"
      - "traefik.http.routers.traefik.service=api@internal"
      - "traefik.http.routers.traefik.middlewares=auth"
      - "traefik.http.middlewares.auth.basicauth.users=${TRAEFIK_HASH}"

networks:
  web:
    external: true
    name: web
TRAEFIK_COMPOSE

echo "✅ Created docker-compose.yml for Traefik"

# Setup letsencrypt
touch letsencrypt/acme.json
chmod 600 letsencrypt/acme.json
echo "✅ Created acme.json"

# Create Docker network
show_progress "Step 6/10: Creating Docker network"
docker network create web 2>/dev/null || echo "✅ Network 'web' already exists"

# Start Traefik
show_progress "Step 7/10: Starting Traefik"
docker compose up -d
sleep 5

echo "✅ Traefik started!"
docker ps | grep traefik

# Setup firewall
show_progress "Step 8/10: Configuring firewall"
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
echo "✅ Firewall configured"
ufw status

# Clone Archie Management
show_progress "Step 9/10: Cloning Archie Management"
cd ~/archie-node/apps

if [ -d "archie-management" ]; then
    echo "⚠️  archie-management already exists, pulling latest..."
    cd archie-management
    git pull origin main
else
    git clone https://github.com/keepfighton/Archie-Management.git archie-management
    cd archie-management
    echo "✅ Repository cloned"
fi

# Setup .env if not exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env .env 2>/dev/null || echo "Using existing .env"

    # Generate random JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    DB_PASSWORD=$(openssl rand -base64 16)

    echo "✅ Generated JWT_SECRET and DB_PASSWORD"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and verify these values:"
    echo "   JWT_SECRET=$JWT_SECRET"
    echo "   POSTGRES_PASSWORD=$DB_PASSWORD"
fi

# Deploy application
show_progress "Step 10/10: Deploying Archie Management"

echo "🐳 Building and starting containers..."
docker compose up -d --build

echo "⏳ Waiting for services to start..."
sleep 15

# Check if backend is healthy
MAX_ATTEMPTS=30
ATTEMPT=0
echo "🏥 Checking backend health..."
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ Backend is healthy!"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "   Waiting... ($ATTEMPT/$MAX_ATTEMPTS)"
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "⚠️  Backend health check timeout - check logs:"
    echo "   docker compose logs backend"
else
    # Seed database
    echo "🌱 Seeding database..."
    docker compose exec backend sh -c 'cd cmd/seed && go run main.go' || echo "⚠️  Database seeding failed - may already be seeded"
fi

# Show final status
echo ""
echo "========================================"
echo "✅ VPS SETUP COMPLETE!"
echo "========================================"
echo ""
echo "📊 Status Check:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "🌐 Access Points:"
echo "  - Archie Management: https://management.archieconsultant.com"
echo "  - Traefik Dashboard: https://traefik.archieconsultant.com"
echo ""
echo "👤 Default Logins:"
echo "  Archie Management:"
echo "    Email: admin@archieconsultant.com"
echo "    Pass:  Admin123!"
echo ""
echo "  Traefik Dashboard:"
echo "    User: admin"
echo "    Pass: admin123"
echo ""
echo "⚠️  SECURITY TASKS:"
echo "  [ ] Change Traefik dashboard password"
echo "  [ ] Change Archie admin password"
echo "  [ ] Verify JWT_SECRET in .env"
echo "  [ ] Setup SSH key authentication"
echo "  [ ] Setup database backups"
echo ""
echo "📁 Directory Structure:"
echo "  ~/archie-node/"
echo "  ├── traefik/          # Traefik reverse proxy"
echo "  └── apps/"
echo "      └── archie-management/"
echo ""
echo "📝 Useful Commands:"
echo "  # View logs"
echo "  cd ~/archie-node/apps/archie-management && docker compose logs -f"
echo ""
echo "  # Restart services"
echo "  docker compose restart"
echo ""
echo "  # Check containers"
echo "  docker ps"
echo ""
echo "  # Update application"
echo "  cd ~/archie-node/apps/archie-management"
echo "  git pull origin main"
echo "  docker compose up -d --build"
echo ""
echo "🎉 Setup complete! Your application should be accessible soon."
echo "   (Wait a few minutes for SSL certificates to be issued)"
echo ""
