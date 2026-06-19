# 🚀 ARCHIE MANAGEMENT - Quick Start Guide

## ✅ Status Saat Ini

### Repository: READY ✓
- **GitHub**: https://github.com/keepfighton/Archie-Management
- **Commits**: 8 commits pushed successfully
- **Customization**: Complete untuk Archie Consultant
- **Documentation**: Complete

### Yang Sudah Dikerjakan:
1. ✅ Clone NEXONE source
2. ✅ Customization lengkap (domain, branding, emails)
3. ✅ CI/CD documentation & scripts
4. ✅ Deployment guides
5. ✅ Push ke GitHub repository

### Yang Perlu Anda Lakukan:
1. ⏳ Add workflow file via GitHub UI (5 menit)
2. ⏳ Setup GitHub Secrets (3 menit)
3. ⏳ Deploy ke VPS (10 menit)

---

## 📋 Next Steps (Total: ~20 menit)

### Step 1: Add GitHub Actions Workflow (5 menit)

**Buka file instruction:**
```bash
open '/Users/cbqaglobal/Documents/New project/ARCHIE-MNGMNT/ADD-WORKFLOW-INSTRUCTION.md'
```

**Atau langsung:**
1. Buka: https://github.com/keepfighton/Archie-Management
2. Click **"Add file"** → **"Create new file"**
3. Nama file: `.github/workflows/deploy.yml`
4. Copy content dari file lokal: `.github/workflows/deploy.yml`
5. Commit file

---

### Step 2: Setup GitHub Secrets (3 menit)

**Buka:** https://github.com/keepfighton/Archie-Management/settings/secrets/actions

**Tambahkan 3 secrets:**

| Name | Value |
|------|-------|
| `VPS_HOST` | `187.77.122.197` |
| `VPS_USER` | `root` |
| `VPS_PASSWORD` | [Password SSH VPS Anda] |

---

### Step 3: Deploy ke VPS (10 menit)

#### 3.1 SSH ke VPS
```bash
ssh root@187.77.122.197
```

#### 3.2 Clone Repository
```bash
cd /opt
git clone https://github.com/keepfighton/Archie-Management.git archie-management
cd archie-management
```

#### 3.3 Setup Environment
```bash
# Edit .env file
nano .env
```

**WAJIB GANTI:**
```env
JWT_SECRET=<generate-random-32-chars>
POSTGRES_PASSWORD=<strong-password>
```

**Generate JWT Secret:**
```bash
openssl rand -base64 32
```

#### 3.4 Deploy
```bash
# Run deployment script
chmod +x deploy-vps.sh
./deploy-vps.sh
```

#### 3.5 Seed Database (First Time)
```bash
docker compose exec backend sh -c 'cd cmd/seed && go run main.go'
```

#### 3.6 Access Application
https://management.archieconsultant.com

**Default Login:**
- Email: `admin@archieconsultant.com`
- Password: `Admin123!`

**⚠️ PENTING:** Ganti password setelah login pertama!

---

## 🤖 Test Auto-Deploy

Setelah semua setup selesai:

```bash
cd '/Users/cbqaglobal/Documents/New project/ARCHIE-MNGMNT'

# Buat perubahan
echo "# Test" >> README.md

# Commit & push
git add README.md
git commit -m "Test auto-deploy"
./push-to-github.sh YOUR_GITHUB_TOKEN

# 🚀 GitHub Actions akan auto-deploy!
# Lihat: https://github.com/keepfighton/Archie-Management/actions
```

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `ADD-WORKFLOW-INSTRUCTION.md` | Cara add workflow via GitHub UI |
| `.github/CICD-SETUP.md` | Complete CI/CD setup guide |
| `DEPLOYMENT.md` | VPS deployment guide |
| `deploy-vps.sh` | Automated VPS deployment script |
| `.env` | Production environment config |
| `docker-compose.yml` | Docker orchestration |

---

## 🔗 Important Links

### GitHub
- **Repository**: https://github.com/keepfighton/Archie-Management
- **Actions**: https://github.com/keepfighton/Archie-Management/actions
- **Settings**: https://github.com/keepfighton/Archie-Management/settings/secrets/actions

### Production
- **URL**: https://management.archieconsultant.com
- **VPS IP**: 187.77.122.197

---

## 📞 Configuration

### Email
- Admin: `admin@archieconsultant.com`
- Corporate: `info@archieconsultant.com`
- Staff: `staff@archieconsultant.com`

### Phone/WhatsApp
- `+62 852 1807 1841`

### Database
- Name: `archie_management_db`
- User: `archie_user`

### Containers
- `archie-backend`
- `archie-frontend`
- `archie-postgres`

---

## 🆘 Need Help?

### Dokumentasi
1. **Workflow Setup**: `ADD-WORKFLOW-INSTRUCTION.md`
2. **CI/CD Guide**: `.github/CICD-SETUP.md`
3. **Deployment**: `DEPLOYMENT.md`
4. **README**: `README.md`

### Commands
```bash
# Check local files
cd '/Users/cbqaglobal/Documents/New project/ARCHIE-MNGMNT'
ls -la

# View documentation
open ADD-WORKFLOW-INSTRUCTION.md
open .github/CICD-SETUP.md
open DEPLOYMENT.md

# Git status
git status
git log --oneline -10
```

---

## ✅ Deployment Checklist

```
Local Setup:
[✅] Repository cloned & customized
[✅] Pushed to GitHub
[✅] CI/CD docs created
[ ] Workflow file added via GitHub UI
[ ] GitHub Secrets configured

VPS Setup:
[ ] SSH access verified
[ ] Docker installed
[ ] Traefik running
[ ] Repository cloned to /opt/archie-management
[ ] .env configured
[ ] Deployment executed
[ ] Database seeded
[ ] Application accessible

Security:
[ ] JWT_SECRET changed
[ ] POSTGRES_PASSWORD changed
[ ] Admin password changed after first login
[ ] Firewall configured
[ ] SMTP configured (optional)

Testing:
[ ] Manual deployment successful
[ ] Auto-deploy tested
[ ] Login working
[ ] All features working
```

---

## 🎯 Current Task

**Anda sekarang di Step 1:**
👉 **Add workflow file via GitHub UI**

Buka: `ADD-WORKFLOW-INSTRUCTION.md` untuk panduan lengkap.

Atau langsung ke: https://github.com/keepfighton/Archie-Management

Klik "Add file" → "Create new file" → `.github/workflows/deploy.yml`
