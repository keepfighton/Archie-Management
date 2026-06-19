# 📝 Cara Menambahkan Workflow File ke GitHub

Karena GitHub memerlukan token dengan scope `workflow` untuk push workflow file via git, cara tercepat adalah menambahkan via **GitHub Web UI**.

---

## ✅ Langkah-langkah (5 menit):

### 1. Buka GitHub Repository
Klik: https://github.com/keepfighton/Archie-Management

### 2. Buat Folder `.github/workflows/`
- Klik tombol **"Add file"** → **"Create new file"**
- Di kolom nama file, ketik: `.github/workflows/deploy.yml`
  (GitHub otomatis buat folder `.github/workflows/`)

### 3. Copy-Paste Workflow Content

Copy **seluruh isi** dari file lokal `.github/workflows/deploy.yml` atau copy dari sini:

```yaml
name: Deploy Archie Management to VPS

on:
  push:
    branches:
      - main
  workflow_dispatch:

concurrency:
  group: archie-production-deploy
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: 🚀 Deploy to VPS via SSH
        id: deploy
        continue-on-error: true
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          password: ${{ secrets.VPS_PASSWORD }}
          script_stop: true
          command_timeout: 20m
          script: |
            set -e

            echo "📂 Navigating to project directory..."
            cd ~/archie-node/apps/archie-management

            echo "🔄 Pulling latest code..."
            git fetch origin main
            git reset --hard origin/main

            echo "🔍 Checking environment file..."
            if [ ! -f .env ]; then
              echo "❌ .env file not found!"
              exit 1
            fi

            echo "🌐 Checking network..."
            docker network inspect web >/dev/null 2>&1 || docker network create web

            echo "🐳 Building and deploying containers..."
            docker compose up -d --build --no-deps backend frontend

            echo "⏳ Waiting for services..."
            sleep 10

            echo "🏥 Health check..."
            max_attempts=30
            attempt=0
            while [ $attempt -lt $max_attempts ]; do
              if curl -s http://localhost:8080/health > /dev/null; then
                echo "✅ Backend is healthy!"
                break
              fi
              attempt=$((attempt + 1))
              echo "Waiting... ($attempt/$max_attempts)"
              sleep 2
            done

            if [ $attempt -eq $max_attempts ]; then
              echo "⚠️ Health check timeout!"
              docker compose logs --tail=50 backend
              exit 1
            fi

            echo "🔍 Verifying containers..."
            docker ps --format '{{.Names}}' | grep '^archie-backend$' || exit 1
            docker ps --format '{{.Names}}' | grep '^archie-frontend$' || exit 1

            echo "🧹 Cleaning up old images..."
            docker image prune -f

            echo "✅ Deployment successful!"

      - name: 📊 Deployment Status
        if: always()
        run: |
          if [ "${{ steps.deploy.outcome }}" == "success" ]; then
            echo "✅ Deployment successful!"
            echo "🌐 Live at: https://management.archieconsultant.com"
            echo "🕐 Deployed at: $(date)"
          else
            echo "⚠️ Automated deployment failed!"
            echo ""
            echo "📋 Manual deployment steps:"
            echo "1. SSH to VPS: ssh ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}"
            echo "2. cd /opt/archie-management"
            echo "3. git pull origin main"
            echo "4. docker compose up -d --build"
            echo ""
            echo "🔍 Troubleshooting:"
            echo "- Check VPS is accessible"
            echo "- Verify GitHub Secrets: VPS_HOST, VPS_USER, VPS_PASSWORD"
            echo "- Check VPS firewall allows GitHub Actions IPs"
            echo "- Review VPS logs: docker compose logs"
            exit 0
          fi

      - name: 📝 Deployment Summary
        if: success()
        run: |
          echo "## 🚀 Deployment Summary" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "- **Status**: ✅ Success" >> $GITHUB_STEP_SUMMARY
          echo "- **Environment**: Production" >> $GITHUB_STEP_SUMMARY
          echo "- **URL**: https://management.archieconsultant.com" >> $GITHUB_STEP_SUMMARY
          echo "- **Commit**: ${{ github.sha }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Triggered by**: ${{ github.actor }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Timestamp**: $(date -u)" >> $GITHUB_STEP_SUMMARY
```

### 4. Commit File
- Scroll ke bawah
- Commit message: `Add GitHub Actions workflow for auto-deployment`
- Klik **"Commit new file"**

---

## 🔐 Setup GitHub Secrets (Wajib!)

Setelah workflow ditambahkan, setup secrets:

### Buka Settings
https://github.com/keepfighton/Archie-Management/settings/secrets/actions

### Tambahkan 3 Secrets

**1. VPS_HOST**
- Click **"New repository secret"**
- Name: `VPS_HOST`
- Secret: `187.77.122.197`
- Click **"Add secret"**

**2. VPS_USER**
- Click **"New repository secret"**
- Name: `VPS_USER`
- Secret: `root` (atau username SSH VPS Anda)
- Click **"Add secret"**

**3. VPS_PASSWORD**
- Click **"New repository secret"**
- Name: `VPS_PASSWORD`
- Secret: [Password SSH VPS Anda]
- Click **"Add secret"**

---

## ✅ Verifikasi

### 1. Check Workflow Ada
Buka: https://github.com/keepfighton/Archie-Management/actions

Anda akan lihat workflow **"Deploy Archie Management to VPS"**

### 2. Test Manual Run
- Click workflow name
- Click **"Run workflow"** dropdown
- Click **"Run workflow"** button
- Watch deployment progress

### 3. Check Deployment
Jika berhasil, akses: https://management.archieconsultant.com

---

## 🚀 Auto-Deploy Test

Setelah setup selesai, test auto-deploy:

```bash
cd '/Users/cbqaglobal/Documents/New project/ARCHIE-MNGMNT'

# Buat perubahan kecil
echo "# Test auto-deploy" >> README.md

# Commit & push
git add README.md
git commit -m "Test auto-deploy"
git push origin main

# 🤖 GitHub Actions akan otomatis deploy!
# Lihat progress: https://github.com/keepfighton/Archie-Management/actions
```

---

## 📚 Dokumentasi Lengkap

- **CI/CD Setup Guide**: `.github/CICD-SETUP.md`
- **Deployment Guide**: `DEPLOYMENT.md`

---

## 🆘 Butuh Bantuan?

Jika ada error saat setup:
1. Check workflow syntax di GitHub (ada validator)
2. Check secrets sudah benar
3. Baca troubleshooting di `.github/CICD-SETUP.md`
