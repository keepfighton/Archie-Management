#!/bin/bash
# Script untuk push dengan workflow scope
# Token harus punya scope: repo + workflow

if [ -z "$1" ]; then
  echo "❌ Error: Token tidak ditemukan"
  echo ""
  echo "📝 Cara pakai:"
  echo "  ./push-with-workflow.sh YOUR_GITHUB_TOKEN"
  echo ""
  echo "🔑 Token harus punya scope:"
  echo "   ✅ repo (full control)"
  echo "   ✅ workflow (update GitHub Actions workflows)"
  echo ""
  echo "Buat token di: https://github.com/settings/tokens/new"
  exit 1
fi

TOKEN=$1

echo "🔍 Checking for workflow files..."
if git diff --staged --name-only | grep -q "\.github/workflows/"; then
  echo "✅ Workflow files detected"
  echo "⚠️  Token MUST have 'workflow' scope!"
else
  echo "ℹ️  No workflow files changed"
fi

echo ""
echo "🔄 Setting remote with token..."
git remote set-url origin "https://${TOKEN}@github.com/keepfighton/Archie-Management.git"

echo "🚀 Pushing to GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
  echo "✅ Push berhasil!"
  echo ""
  echo "🔒 Mengembalikan remote ke HTTPS biasa..."
  git remote set-url origin "https://github.com/keepfighton/Archie-Management.git"
  echo "✅ Selesai!"
else
  echo "❌ Push gagal!"
  echo ""
  echo "Possible reasons:"
  echo "- Token tidak punya 'workflow' scope"
  echo "- Token expired atau invalid"
  echo "- Network issue"
  echo ""
  echo "🔑 Create new token with both scopes:"
  echo "   https://github.com/settings/tokens/new"
  echo "   ✅ repo"
  echo "   ✅ workflow"
  exit 1
fi
