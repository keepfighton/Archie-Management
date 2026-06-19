# 🚀 Manual VPS Setup - Copy & Paste

Karena saya tidak punya akses SSH langsung, berikut cara setup VPS secara manual.

---

## ⚡ Quick Setup (Recommended)

### Step 1: SSH ke VPS
```bash
ssh root@187.77.122.197
```

### Step 2: Download & Run Script
```bash
wget https://raw.githubusercontent.com/keepfighton/Archie-Management/main/run-on-vps.sh
chmod +x run-on-vps.sh
./run-on-vps.sh
```

**Script akan otomatis:**
- Install Docker & Docker Compose
- Setup Traefik dengan SSL
- Create directory structure
- Configure firewall
- Clone Archie Management
- Deploy aplikasi
- Seed database

**Total waktu: ~10-15 menit**

Setelah selesai, aplikasi bisa diakses di:
- https://management.archieconsultant.com
- https://traefik.archieconsultant.com

---

## 🔐 Setup SSH Key (Optional - untuk Claude bisa SSH)

Jika ingin saya bisa SSH ke VPS untuk maintenance:

```bash
# Di VPS
ssh root@187.77.122.197

# Add public key
mkdir -p ~/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFmYB5UCtdSnRUOAUKLWsh94EKf0YPw8n0fqhqi3Dnqw moch.ihsan@nexoratech.co" >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys

# Test (keluar dulu, lalu SSH lagi)
exit
ssh root@187.77.122.197
# Sekarang bisa login tanpa password
```

Setelah ini saya bisa SSH langsung untuk maintenance.

---

## 📋 DNS Setup (PENTING!)

Sebelum atau sesudah run script, setup DNS di domain provider:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | management | 187.77.122.197 | 300 |
| A | traefik | 187.77.122.197 | 300 |

**Verify:**
```bash
dig management.archieconsultant.com +short
dig traefik.archieconsultant.com +short
# Should return: 187.77.122.197
```

⚠️ DNS propagation bisa memakan waktu 5-30 menit.

---

## ✅ Verifikasi Setup

### Check Services Running
```bash
docker ps
```

Expected output:
```
traefik         (port 80, 443)
archie-backend  (port 8080)
archie-frontend (port 80)
archie-postgres (port 5432)
```

### Check Logs
```bash
# Traefik
cd ~/archie-node/traefik
docker compose logs -f

# Archie Management
cd ~/archie-node/apps/archie-management
docker compose logs -f
```

### Test Access
```bash
# Local health check
curl http://localhost:8080/health

# External (after DNS propagation)
curl -I https://management.archieconsultant.com
```

---

## 🔒 Post-Setup Security

### 1. Change Traefik Password
```bash
cd ~/archie-node/traefik

# Generate new password hash
htpasswd -nb admin YOUR_NEW_PASSWORD

# Edit docker-compose.yml
nano docker-compose.yml
# Update line with auth.basicauth.users

# Restart
docker compose up -d
```

### 2. Change Admin Password
Login ke https://management.archieconsultant.com dengan:
- Email: `admin@archieconsultant.com`
- Password: `Admin123!`

Langsung ganti password setelah login!

### 3. Verify Environment
```bash
cd ~/archie-node/apps/archie-management
nano .env

# Pastikan JWT_SECRET dan POSTGRES_PASSWORD sudah random
# Jika belum, generate:
openssl rand -base64 32
```

---

## 🔄 Update Aplikasi (Future)

```bash
ssh root@187.77.122.197
cd ~/archie-node/apps/archie-management

# Pull latest
git pull origin main

# Rebuild & restart
docker compose up -d --build

# Check logs
docker compose logs -f
```

Atau via GitHub Actions (auto-deploy setelah setup secrets).

---

## 🆘 Troubleshooting

### Script Gagal di Tengah Jalan
```bash
# Cek di mana errornya
cat /tmp/vps-setup.log

# Atau run manual step by step:
# Lihat file run-on-vps.sh untuk command detail
```

### Docker Command Not Found
```bash
# Install manual
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
apt-get install docker-compose-plugin
```

### SSL Certificate Tidak Muncul
```bash
# Pastikan DNS sudah pointing
dig management.archieconsultant.com +short

# Check Traefik logs
cd ~/archie-node/traefik
docker compose logs traefik | grep acme

# Wait beberapa menit untuk Let's Encrypt
```

### Container Tidak Start
```bash
cd ~/archie-node/apps/archie-management

# Check logs
docker compose logs backend
docker compose logs frontend
docker compose logs postgres

# Restart
docker compose down
docker compose up -d --build
```

---

## 📞 Need Help?

Jika ada masalah saat setup:
1. Check logs: `docker compose logs`
2. Check firewall: `ufw status`
3. Check DNS: `dig management.archieconsultant.com +short`
4. Beri saya akses SSH (add public key) agar saya bisa debug

---

## 🎯 Expected Result

Setelah setup selesai:

✅ Docker installed & running
✅ Traefik running on port 80 & 443
✅ Network 'web' created
✅ Directory ~/archie-node/apps/ ready
✅ Archie Management deployed
✅ Database seeded
✅ SSL certificates issued
✅ Firewall configured

**Access:**
- https://management.archieconsultant.com → Archie Management
- https://traefik.archieconsultant.com → Traefik Dashboard

**Login:**
- Admin: admin@archieconsultant.com / Admin123!
- Traefik: admin / admin123

🎉 **DONE!**
