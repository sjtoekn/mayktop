#!/bin/bash
# AI agent කෙනෙකුට දෙන්න project එකේ code zip එකක් හදනවා
cd "$(dirname "$0")/.." || exit 1

NAME="falvenco-web-$(date +%Y%m%d-%H%M).zip"
OUT="$HOME/Desktop/$NAME"

zip -r "$OUT" . \
  -x "node_modules/*" \
  -x ".next/*" \
  -x ".git/*" \
  -x "generated/*" \
  -x "storage/*" \
  -x "dev.db" -x "dev.db-journal" -x "*.db" \
  -x ".env" -x ".env.local" -x ".env.development" -x ".env.production" \
  -x "package-lock.json" \
  -x "*.log" -x "*.zip" \
  -x "tsconfig.tsbuildinfo" \
  -x ".DS_Store" -x "*/.DS_Store"

echo ""
echo "✅ හැදුවා: $OUT"
ls -lh "$OUT"
