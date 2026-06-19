#!/bin/bash
# VPS Setup Script for Archie Management
# Run this script on VPS: 187.77.122.197

set -e

echo "🚀 Archie VPS Setup Script"
echo "================================"
echo ""

# Update system
echo "📦 Updating system packages..."
apt-get update
apt-get upgrade -y

# Install dependencies
echo "📦 Installing dependencies..."
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw

# Install Docker
echo "🐳 Installing Docker..."
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

    echo "✅ Docker installed successfully!"
else
    echo "✅ Docker already installed"
fi

# Verify Docker installation
docker --version
docker compose version

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p ~/archie-node/apps
mkdir -p ~/archie-node/traefik
cd ~/archie-node

echo "✅ Directory structure created:"
tree -L 2 ~/archie-node || ls -la ~/archie-node

# Create Traefik configuration
echo "🌐 Setting up Traefik..."
cd ~/archie-node/traefik

# Create traefik.yml
cat > traefik.yml <<'EOF'
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
EOF

# Create docker-compose.yml for Traefik
cat > docker-compose.yml <<'EOF'
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
      - "traefik.http.routers.traefik.rule=Host(`traefik.archieconsultant.com`)"
      - "traefik.http.routers.traefik.entrypoints=websecure"
      - "traefik.http.routers.traefik.tls.certresolver=myresolver"
      - "traefik.http.routers.traefik.service=api@internal"
      - "traefik.http.routers.traefik.middlewares=auth"
      - "traefik.http.middlewares.auth.basicauth.users=admin:$$apr1$$8eVQ7b3F$$3KH8nH8Y0U.gKHZLhQXQC1"
      # Default user: admin / admin123 (change this!)

networks:
  web:
    external: true
    name: web
EOF

# Create letsencrypt directory
mkdir -p letsencrypt
touch letsencrypt/acme.json
chmod 600 letsencrypt/acme.json

echo "✅ Traefik configuration created"

# Create Docker network
echo "🌐 Creating Docker network 'web'..."
docker network create web 2>/dev/null || echo "Network 'web' already exists"

# Start Traefik
echo "🚀 Starting Traefik..."
docker compose up -d

# Wait for Traefik to start
echo "⏳ Waiting for Traefik to initialize..."
sleep 5

# Check Traefik status
docker ps | grep traefik

# Setup firewall
echo "🔥 Configuring firewall..."
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw status

echo ""
echo "✅ VPS Setup Complete!"
echo ""
echo "📋 Summary:"
echo "  - Docker: $(docker --version)"
echo "  - Docker Compose: $(docker compose version)"
echo "  - Traefik: Running on ports 80 & 443"
echo "  - Network: 'web' created"
echo "  - Directory: ~/archie-node/apps ready"
echo ""
echo "🌐 Traefik Dashboard:"
echo "  URL: https://traefik.archieconsultant.com"
echo "  User: admin"
echo "  Pass: admin123"
echo "  ⚠️  CHANGE DEFAULT PASSWORD!"
echo ""
echo "📁 Directory Structure:"
echo "  ~/archie-node/"
echo "  ├── traefik/          # Traefik reverse proxy"
echo "  └── apps/             # Your applications here"
echo ""
echo "🔐 Security Checklist:"
echo "  [ ] Change Traefik dashboard password"
echo "  [ ] Setup SSH key authentication"
echo "  [ ] Disable password authentication"
echo "  [ ] Setup fail2ban"
echo ""
echo "📝 Next Steps:"
echo "  1. Clone Archie Management to ~/archie-node/apps/"
echo "  2. Update DNS: traefik.archieconsultant.com → 187.77.122.197"
echo "  3. Deploy applications"
echo ""
