# 🚀 Archie Management - VPS Deployment Guide

## 🌐 Server Info
- **VPS IP**: 187.77.122.197
- **Structure**: `~/archie-node/apps/`
- **Reverse Proxy**: Traefik
- **Domain**: management.archieconsultant.com

---

## 📋 Step 1: Initial VPS Setup (One Time)

### 1.1 SSH ke VPS
```bash
ssh root@187.77.122.197
```

### 1.2 Download & Run Setup Script

**Option A: Via Git (jika sudah ada git)**
```bash
cd ~
git clone https://github.com/keepfighton/Archie-Management.git temp-setup
cd temp-setup
chmod +x vps-setup.sh
./vps-setup.sh
cd ~
rm -rf temp-setup
```

**Option B: Via Curl**
```bash
curl -O https://raw.githubusercontent.com/keepfighton/Archie-Management/main/vps-setup.sh
chmod +x vps-setup.sh
./vps-setup.sh
```

**Option C: Manual (Copy-Paste)**
```bash
nano vps-setup.sh
# Paste script content dari file vps-setup.sh
chmod +x vps-setup.sh
./vps-setup.sh
```

### 1.3 Script akan Install:
- ✅ Docker Engine
- ✅ Docker Compose v2
- ✅ Git
- ✅ UFW Firewall
- ✅ Traefik (reverse proxy)
- ✅ Create directory structure: `~/archie-node/apps/`
- ✅ Create Docker network: `web`

### 1.4 Verify Installation
```bash
# Check Docker
docker --version
docker compose version

# Check Traefik
docker ps | grep traefik

# Check directory
ls -la ~/archie-node/
```

Expected output:
```
~/archie-node/
├── traefik/          # Traefik config & certs
│   ├── docker-compose.yml
│   ├── traefik.yml
│   └── letsencrypt/
└── apps/             # Your applications
```

---

## 📋 Step 2: Setup DNS (Di Domain Provider)

Tambahkan DNS records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | management | 187.77.122.197 | 300 |
| A | traefik | 187.77.122.197 | 300 |

**Verify DNS:**
```bash
# Di local machine
dig management.archieconsultant.com +short
dig traefik.archieconsultant.com +short
# Should return: 187.77.122.197
```

---

## 📋 Step 3: Deploy Archie Management

### 3.1 Clone Repository
```bash
cd ~/archie-node/apps
git clone https://github.com/keepfighton/Archie-Management.git archie-management
cd archie-management
```

### 3.2 Configure Environment
```bash
# Copy dan edit .env
cp .env .env.backup
nano .env
```

**WAJIB GANTI:**
```env
# Generate dengan: openssl rand -base64 32
JWT_SECRET=GANTI_DENGAN_RANDOM_32_CHARS

# Strong password
POSTGRES_PASSWORD=GANTI_DENGAN_PASSWORD_KUAT_123!

# Pastikan ini sesuai
APP_URL=https://management.archieconsultant.com
```

**Optional - SMTP:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=info@archieconsultant.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM=info@archieconsultant.com
```

### 3.3 Generate JWT Secret
```bash
openssl rand -base64 32
# Copy output ke JWT_SECRET di .env
```

### 3.4 Deploy Application
```bash
# Ensure on web network
docker network inspect web

# Deploy
docker compose up -d --build

# Check logs
docker compose logs -f
```

### 3.5 Seed Database (First Time Only)
```bash
# Wait for backend to be healthy (check logs first)
docker compose logs backend | grep "Started"

# Seed
docker compose exec backend sh -c 'cd cmd/seed && go run main.go'
```

### 3.6 Verify Deployment
```bash
# Check containers
docker ps | grep archie

# Should see:
# archie-backend
# archie-frontend
# archie-postgres

# Check health
curl http://localhost:8080/health

# Test domain
curl -I https://management.archieconsultant.com
```

---

## 🌐 Access Application

### Production URL
https://management.archieconsultant.com

### Default Login
- **Email**: admin@archieconsultant.com
- **Password**: Admin123!

⚠️ **PENTING**: Ganti password setelah login pertama!

### Traefik Dashboard
- **URL**: https://traefik.archieconsultant.com
- **User**: admin
- **Password**: admin123

⚠️ **PENTING**: Ganti password Traefik dashboard!

**Cara ganti password Traefik:**
```bash
# Generate hashed password
apt-get install -y apache2-utils
htpasswd -nb admin YOUR_NEW_PASSWORD

# Edit docker-compose.yml di ~/archie-node/traefik
cd ~/archie-node/traefik
nano docker-compose.yml

# Update line:
# "traefik.http.middlewares.auth.basicauth.users=admin:$$apr1$$..."
# Dengan hasil htpasswd (ganti $ jadi $$)

# Restart Traefik
docker compose up -d
```

---

## 📁 Directory Structure

```
~/archie-node/
├── traefik/                          # Traefik reverse proxy
│   ├── docker-compose.yml            # Traefik service
│   ├── traefik.yml                   # Traefik config
│   └── letsencrypt/                  # SSL certificates
│       └── acme.json
│
└── apps/                             # Applications
    └── archie-management/            # Archie Management app
        ├── docker-compose.yml
        ├── .env
        ├── Backend/
        ├── Frontend/
        └── ... (uploaded files, db volumes)
```

---

## 🔄 Update Deployment (CI/CD)

### Auto Deploy via GitHub Actions

Setelah setup GitHub Secrets, setiap push ke `main` akan auto-deploy.

**Update path di workflow:**
Edit `.github/workflows/deploy.yml`, ganti:
```yaml
cd /opt/archie-management
```
Menjadi:
```yaml
cd ~/archie-node/apps/archie-management
```

### Manual Update
```bash
ssh root@187.77.122.197
cd ~/archie-node/apps/archie-management

git pull origin main
docker compose up -d --build

# Check logs
docker compose logs -f backend
```

---

## 📊 Monitoring

### Check All Services
```bash
# Traefik
docker ps | grep traefik

# Archie Management
docker ps | grep archie

# All containers
docker ps
```

### View Logs
```bash
# Traefik logs
cd ~/archie-node/traefik
docker compose logs -f

# Archie Management logs
cd ~/archie-node/apps/archie-management
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

### Container Stats
```bash
docker stats
```

### Check SSL Certificates
```bash
# Via Traefik dashboard
https://traefik.archieconsultant.com

# Or check acme.json
cat ~/archie-node/traefik/letsencrypt/acme.json | jq
```

---

## 🔐 Security Checklist

### Immediate Actions
- [ ] Change Traefik dashboard password
- [ ] Change default admin password in app
- [ ] Update JWT_SECRET in .env
- [ ] Update POSTGRES_PASSWORD in .env

### Recommended
- [ ] Setup SSH key authentication
- [ ] Disable password authentication for SSH
- [ ] Install fail2ban
- [ ] Setup database backup automation
- [ ] Configure log rotation
- [ ] Setup monitoring (Prometheus/Grafana)

### SSH Hardening
```bash
# Create non-root user
adduser archie
usermod -aG sudo archie
usermod -aG docker archie

# Setup SSH key
# (copy your public key)
mkdir -p /home/archie/.ssh
nano /home/archie/.ssh/authorized_keys
# Paste your public key
chmod 700 /home/archie/.ssh
chmod 600 /home/archie/.ssh/authorized_keys
chown -R archie:archie /home/archie/.ssh

# Disable password auth
nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
systemctl restart sshd
```

### Install Fail2Ban
```bash
apt-get install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

---

## 💾 Backup Strategy

### Database Backup
```bash
# Create backup script
mkdir -p ~/backups
nano ~/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR=~/backups
DATE=$(date +%Y%m%d_%H%M%S)
cd ~/archie-node/apps/archie-management

docker compose exec -T postgres pg_dump -U archie_user archie_management_db > \
  $BACKUP_DIR/archie_db_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "archie_db_*.sql" -mtime +7 -delete

echo "Backup completed: archie_db_$DATE.sql"
```

```bash
chmod +x ~/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /root/backup-db.sh >> /var/log/backup-db.log 2>&1
```

### Restore Database
```bash
cd ~/archie-node/apps/archie-management

# Stop backend first
docker compose stop backend

# Restore
cat ~/backups/archie_db_YYYYMMDD_HHMMSS.sql | \
  docker compose exec -T postgres psql -U archie_user archie_management_db

# Restart
docker compose up -d backend
```

---

## 🐛 Troubleshooting

### Traefik Not Working
```bash
# Check Traefik logs
cd ~/archie-node/traefik
docker compose logs traefik

# Check network
docker network inspect web

# Restart Traefik
docker compose restart
```

### SSL Certificate Issues
```bash
# Check acme.json
ls -la ~/archie-node/traefik/letsencrypt/acme.json

# Should be 600 permissions
chmod 600 ~/archie-node/traefik/letsencrypt/acme.json

# Force certificate renewal
cd ~/archie-node/traefik
docker compose down
rm letsencrypt/acme.json
touch letsencrypt/acme.json
chmod 600 letsencrypt/acme.json
docker compose up -d
```

### Application Not Starting
```bash
cd ~/archie-node/apps/archie-management

# Check logs
docker compose logs

# Check .env file
cat .env

# Restart
docker compose down
docker compose up -d --build
```

### Database Connection Error
```bash
# Check postgres
docker compose ps postgres
docker compose logs postgres

# Check environment vars
docker compose exec backend env | grep DB_
```

### Port Already in Use
```bash
# Check what's using the port
netstat -tulpn | grep :80
netstat -tulpn | grep :443

# Usually it's old containers
docker ps -a
docker rm -f $(docker ps -aq)
```

---

## 📝 Adding More Applications

Untuk menambah aplikasi baru ke `~/archie-node/apps/`:

```bash
cd ~/archie-node/apps
git clone <repo-url> <app-name>
cd <app-name>

# Configure .env

# Update docker-compose.yml dengan Traefik labels:
# labels:
#   - "traefik.enable=true"
#   - "traefik.docker.network=web"
#   - "traefik.http.routers.<app-name>.rule=Host(`<subdomain>.archieconsultant.com`)"
#   - "traefik.http.routers.<app-name>.entrypoints=websecure"
#   - "traefik.http.routers.<app-name>.tls.certresolver=myresolver"

# Deploy
docker compose up -d
```

---

## 🆘 Support

- **GitHub**: https://github.com/keepfighton/Archie-Management/issues
- **Email**: info@archieconsultant.com
- **Phone/WA**: +62 852 1807 1841

---

## 📚 Resources

- **Traefik Docs**: https://doc.traefik.io/traefik/
- **Docker Docs**: https://docs.docker.com/
- **Let's Encrypt**: https://letsencrypt.org/
