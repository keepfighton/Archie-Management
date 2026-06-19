# CI/CD Pipeline Setup Guide

## 📋 Overview

Automated deployment menggunakan **GitHub Actions** yang akan:
- ✅ Trigger otomatis saat push ke branch `main`
- ✅ SSH ke VPS dan pull latest code
- ✅ Build & restart Docker containers
- ✅ Health check backend
- ✅ Cleanup old images
- ✅ Notification status deployment

---

## 🔐 Setup GitHub Secrets

### 1. Buka Repository Settings

Buka: https://github.com/keepfighton/Archie-Management/settings/secrets/actions

### 2. Tambahkan Secrets

Klik **"New repository secret"** dan tambahkan 3 secrets berikut:

#### Secret 1: `VPS_HOST`
- **Name**: `VPS_HOST`
- **Value**: `187.77.122.197`
- **Description**: IP address VPS

#### Secret 2: `VPS_USER`
- **Name**: `VPS_USER`
- **Value**: `root` (atau username SSH Anda)
- **Description**: SSH username untuk login ke VPS

#### Secret 3: `VPS_PASSWORD`
- **Name**: `VPS_PASSWORD`
- **Value**: `YOUR_VPS_SSH_PASSWORD`
- **Description**: SSH password untuk login ke VPS

---

## 🔑 Alternative: Menggunakan SSH Key (Lebih Aman)

Jika ingin pakai SSH key daripada password:

### 1. Generate SSH Key di Local
```bash
ssh-keygen -t ed25519 -C "github-actions-archie" -f ~/.ssh/github_actions_archie
```

### 2. Copy Public Key ke VPS
```bash
ssh-copy-id -i ~/.ssh/github_actions_archie.pub root@187.77.122.197
```

### 3. Update GitHub Workflow

Ganti di `.github/workflows/deploy.yml`:
```yaml
- name: 🚀 Deploy to VPS via SSH
  uses: appleboy/ssh-action@v1.2.0
  with:
    host: ${{ secrets.VPS_HOST }}
    username: ${{ secrets.VPS_USER }}
    key: ${{ secrets.VPS_SSH_KEY }}  # <-- ganti password dengan key
    script_stop: true
    # ... rest of config
```

### 4. Tambahkan Secret `VPS_SSH_KEY`

Buka private key:
```bash
cat ~/.ssh/github_actions_archie
```

Copy isinya (termasuk `-----BEGIN` dan `-----END`) ke GitHub Secret:
- **Name**: `VPS_SSH_KEY`
- **Value**: (paste private key content)

---

## 📂 VPS Preparation

Sebelum CI/CD bisa jalan, pastikan VPS sudah setup:

### 1. Clone Repository di VPS
```bash
ssh root@187.77.122.197
cd /opt
git clone https://github.com/keepfighton/Archie-Management.git archie-management
cd archie-management
```

### 2. Setup .env File
```bash
cp Backend/.env.example .env
nano .env
```

Update minimal:
```env
JWT_SECRET=YOUR_RANDOM_32_CHARS_SECRET
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD
```

### 3. Initial Deployment
```bash
# Create network
docker network create web

# Deploy
docker compose up -d --build

# Seed database (first time only)
docker compose exec backend sh -c 'cd cmd/seed && go run main.go'
```

### 4. Test Access
- Open: https://management.archieconsultant.com
- Login: `admin@archieconsultant.com` / `Admin123!`

---

## 🚀 How CI/CD Works

### Auto Deploy on Push
```bash
# Di local machine
git add .
git commit -m "Update feature X"
git push origin main
```

GitHub Actions akan otomatis:
1. Detect push ke `main` branch
2. SSH ke VPS (187.77.122.197)
3. Pull latest code
4. Rebuild Docker containers
5. Health check
6. Report status

### Manual Deploy via GitHub UI

1. Buka: https://github.com/keepfighton/Archie-Management/actions
2. Pilih workflow **"Deploy Archie Management to VPS"**
3. Klik **"Run workflow"** → **"Run workflow"**

---

## 📊 Monitoring Deployment

### Via GitHub Actions UI
1. Buka: https://github.com/keepfighton/Archie-Management/actions
2. Lihat workflow runs
3. Klik run untuk detail logs

### Via VPS
```bash
# SSH ke VPS
ssh root@187.77.122.197

# Check logs
cd /opt/archie-management
docker compose logs -f

# Check containers
docker ps | grep archie

# Check health
curl http://localhost:8080/health
```

---

## 🐛 Troubleshooting

### Deployment Failed - SSH Connection Error

**Problem**: `Connection refused` atau `Permission denied`

**Solution**:
1. Check VPS is online: `ping 187.77.122.197`
2. Check SSH service: `ssh root@187.77.122.197`
3. Verify GitHub Secrets (VPS_HOST, VPS_USER, VPS_PASSWORD)
4. Check VPS firewall allows port 22

### Deployment Failed - Health Check Timeout

**Problem**: Backend health check gagal setelah 30 attempts

**Solution**:
```bash
# SSH ke VPS
ssh root@187.77.122.197
cd /opt/archie-management

# Check backend logs
docker compose logs backend

# Common issues:
# - Database migration error
# - .env file tidak ada atau invalid
# - Port 8080 sudah dipakai

# Restart backend
docker compose restart backend
```

### Deployment Failed - Docker Build Error

**Problem**: Build gagal atau out of memory

**Solution**:
```bash
# Check disk space
df -h

# Clean up Docker
docker system prune -a -f

# Check memory
free -m

# Increase swap if needed (VPS dengan RAM kecil)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### GitHub Actions Can't Access VPS

**Problem**: VPS firewall block GitHub Actions IPs

**Solution**:
```bash
# Option 1: Allow all SSH (not recommended for production)
ufw allow 22

# Option 2: Use SSH key instead of password (recommended)
# See "Alternative: Menggunakan SSH Key" section above
```

---

## 🔒 Security Best Practices

### ✅ DO:
- Use SSH key authentication instead of password
- Rotate secrets periodically
- Use strong passwords for VPS and database
- Enable UFW firewall
- Setup fail2ban for SSH
- Regular backup database

### ❌ DON'T:
- Commit .env file to git
- Share GitHub Secrets
- Use weak passwords
- Disable firewall
- Run as root without sudo (create separate user)

---

## 📈 Advanced: Notifications

### Add Slack/Discord Notification

Edit `.github/workflows/deploy.yml`, tambahkan step:

```yaml
- name: 📢 Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'Deployment to Archie Management: ${{ job.status }}'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

Tambahkan secret `SLACK_WEBHOOK` dengan Slack webhook URL.

---

## 📝 Workflow File Location

File workflow ada di:
```
.github/workflows/deploy.yml
```

Edit file ini untuk customize deployment process.

---

## 🆘 Support

Jika ada masalah dengan CI/CD:
1. Check GitHub Actions logs
2. Check VPS logs: `docker compose logs`
3. Verify secrets di GitHub Settings
4. Test SSH manual: `ssh root@187.77.122.197`

---

## 📚 Resources

- GitHub Actions Docs: https://docs.github.com/en/actions
- SSH Action: https://github.com/appleboy/ssh-action
- Docker Compose: https://docs.docker.com/compose/
