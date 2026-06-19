# ARCHIE MANAGEMENT - Deployment Guide

## 🌐 Production Info
- **Domain**: https://management.archieconsultant.com
- **VPS IP**: 187.77.122.197
- **GitHub**: https://github.com/keepfighton/Archie-Management
- **CI/CD**: ✅ GitHub Actions (Auto-deploy on push to `main`)

---

## 🤖 CI/CD Automated Deployment

Project ini sudah dilengkapi dengan **GitHub Actions** untuk automated deployment!

### Quick Start CI/CD:
1. **Setup GitHub Secrets** (one time only):
   - Buka: https://github.com/keepfighton/Archie-Management/settings/secrets/actions
   - Tambahkan:
     - `VPS_HOST` = `187.77.122.197`
     - `VPS_USER` = `root` (atau SSH username Anda)
     - `VPS_PASSWORD` = Your VPS SSH password

2. **Auto Deploy**: Setiap kali push ke `main`, otomatis deploy!
   ```bash
   git add .
   git commit -m "Update feature"
   git push origin main
   # 🚀 Auto deployment triggered!
   ```

3. **Manual Deploy**: Via GitHub UI
   - Buka: https://github.com/keepfighton/Archie-Management/actions
   - Click "Run workflow"

📖 **Detailed CI/CD Guide**: See [.github/CICD-SETUP.md](.github/CICD-SETUP.md)

---

## 📋 Prerequisites VPS

Pastikan sudah terinstall di VPS:
- Docker Engine (20.10+)
- Docker Compose (v2+)
- Git
- Traefik (reverse proxy) dengan network `web`

---

## 🚀 Deployment Steps

### 1. SSH ke VPS
```bash
ssh root@187.77.122.197
# atau
ssh user@187.77.122.197
```

### 2. Clone Repository
```bash
cd /opt
git clone https://github.com/keepfighton/Archie-Management.git archie-management
cd archie-management
```

### 3. Setup Environment Variables

**PENTING**: Edit file `.env` dan ganti nilai berikut:

```bash
nano .env
```

**Wajib diganti:**
```env
# JWT Secret - gunakan random string 32+ characters
JWT_SECRET=GANTI_DENGAN_RANDOM_STRING_PANJANG_32_CHARS_OR_MORE

# Database Password
POSTGRES_PASSWORD=GANTI_DENGAN_PASSWORD_KUAT_123!
```

**Opsional (untuk email forgot password):**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=info@archieconsultant.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM=info@archieconsultant.com
```

**Generate JWT Secret:**
```bash
openssl rand -base64 32
# atau
head -c 32 /dev/urandom | base64
```

### 4. Pastikan Traefik Network Exists
```bash
docker network inspect web || docker network create web
```

### 5. Deploy dengan Docker Compose
```bash
# Build dan jalankan semua containers
docker compose up -d --build

# Check status
docker compose ps

# Check logs
docker compose logs -f backend
docker compose logs -f frontend
```

### 6. Seed Database (Pertama Kali)
```bash
# Masuk ke backend container
docker compose exec backend sh

# Jalankan seeder
cd cmd/seed && go run main.go

# Keluar
exit
```

### 7. Verify Deployment
```bash
# Check containers running
docker ps | grep archie

# Check backend health
curl http://localhost:8080/health

# Check traefik routing
curl -I https://management.archieconsultant.com
```

---

## 👤 Default Login

Setelah seeding database:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@archieconsultant.com | Admin123! |
| Staff | staff@archieconsultant.com | Member123! |

**PENTING**: Ganti password default setelah login pertama kali!

---

## 🔄 Update Deployment

```bash
cd /opt/archie-management

# Pull latest code
git pull origin main

# Rebuild dan restart
docker compose up -d --build

# Check logs untuk error
docker compose logs -f
```

---

## 📊 Monitoring

### Check Logs
```bash
# All services
docker compose logs -f

# Backend only
docker compose logs -f backend

# Frontend only
docker compose logs -f frontend

# Database
docker compose logs -f postgres
```

### Check Resources
```bash
# Container stats
docker stats archie-backend archie-frontend archie-postgres

# Disk usage
docker system df
```

### Database Backup
```bash
# Backup database
docker compose exec postgres pg_dump -U archie_user archie_management_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
docker compose exec -T postgres psql -U archie_user archie_management_db < backup_file.sql
```

---

## 🛠️ Troubleshooting

### Container tidak start
```bash
# Check logs detail
docker compose logs backend
docker compose logs frontend

# Restart specific service
docker compose restart backend
```

### Database connection error
```bash
# Check postgres running
docker compose ps postgres

# Check postgres logs
docker compose logs postgres

# Restart postgres
docker compose restart postgres
```

### Domain tidak accessible
```bash
# Check traefik routing
docker logs traefik | grep archie

# Check network
docker network inspect web

# Pastikan containers terhubung ke network 'web'
docker inspect archie-backend | grep -A 10 Networks
```

### SSL Certificate issue
```bash
# Check traefik logs
docker logs traefik

# Force certificate renewal (jika pakai Traefik)
# Hapus acme.json dan restart traefik
```

---

## 🔒 Security Checklist

- [ ] Ganti `JWT_SECRET` dengan random string panjang
- [ ] Ganti `POSTGRES_PASSWORD` dengan password kuat
- [ ] Ganti password default admin setelah login
- [ ] Setup SMTP untuk forgot password
- [ ] Enable firewall (UFW/iptables)
- [ ] Setup automatic backup database
- [ ] Monitor disk space
- [ ] Setup log rotation
- [ ] Review Traefik SSL configuration

---

## 📁 Important Paths

```
/opt/archie-management/           # Application root
├── Backend/                      # Go backend source
├── Frontend/                     # React frontend source
├── .env                          # Environment variables (SENSITIVE!)
├── docker-compose.yml            # Docker orchestration
└── uploads/                      # File uploads (Docker volume)

Docker volumes:
- archie-management_postgres_data # Database data
- archie-management_uploads_data  # Uploaded files
```

---

## 🆘 Support

- GitHub Issues: https://github.com/keepfighton/Archie-Management/issues
- Phone/WhatsApp: +62 852 1807 1841
- Email: info@archieconsultant.com

---

## 📝 Notes

- Application menggunakan sistem NEXONE yang sudah di-customize untuk Archie Consultant
- Database akan auto-migrate saat pertama kali backend start
- File uploads disimpan di Docker volume yang persisten
- Backup database minimal seminggu sekali
- Monitor disk space karena file uploads dan database bisa berkembang
