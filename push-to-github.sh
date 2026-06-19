#!/bin/bash
# Script helper untuk push ke GitHub dengan Personal Access Token
#
# Cara pakai:
# 1. Buat Personal Access Token di GitHub:
#    https://github.com/settings/tokens/new
#    - Pilih scope: repo (full control)
# 2. Jalankan script ini:
#    ./push-to-github.sh YOUR_TOKEN_HERE

if [ -z "$1" ]; then
  echo "❌ Error: Token tidak ditemukan"
  echo ""
  echo "📝 Cara pakai:"
  echo "  ./push-to-github.sh YOUR_GITHUB_TOKEN"
  echo ""
  echo "🔑 Buat token di: https://github.com/settings/tokens/new"
  echo "   Pilih scope: repo (full control)"
  exit 1
fi

TOKEN=$1

echo "🔄 Setting remote dengan token..."
git remote set-url origin "https://${TOKEN}@github.com/keepfighton/Archie-Management.git"

echo "🚀 Pushing to GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
  echo "✅ Push berhasil!"
  echo ""
  echo "🔒 Mengembalikan remote ke HTTPS biasa (tanpa token)..."
  git remote set-url origin "https://github.com/keepfighton/Archie-Management.git"
  echo "✅ Selesai!"
else
  echo "❌ Push gagal!"
  exit 1
fi
