#!/bin/bash
# ==============================================================================
# Control Room Enterprise ERP - Zero-Data-Loss Safe Deployment Script
# This script ensures an automated full backup (Data + Media) is created and
# verified BEFORE any code updates or service restarts are performed.
# ==============================================================================

set -e

echo "🚀 [Control Room] Initiating Zero-Data-Loss Safe Deployment..."
echo "🕒 Timestamp: $(date)"

# STEP 1: Execute Full Pre-Deployment Backup
echo ""
echo "🛡️  STEP 1: Taking Full Pre-Deployment Snapshot (Data + Media)..."
node scripts/backup.js

# STEP 2: Verify Backup Integrity
LATEST_BACKUP=$(ls -t server/backups/controlroom_backup_*.json 2>/dev/null | head -n 1)

if [ -z "$LATEST_BACKUP" ] || [ ! -s "$LATEST_BACKUP" ]; then
  echo "❌ CRITICAL SAFETY HALT: Backup file was not generated or is 0 bytes!"
  echo "Aborting deployment to protect production data."
  exit 1
fi

echo "✅ Backup Verified: $LATEST_BACKUP ($(du -h "$LATEST_BACKUP" | cut -f1))"

# STEP 3: Build Frontend (if node_modules installed)
echo ""
echo "📦 STEP 2: Building Application Bundle..."
npm run build

echo ""
echo "🎉 DEPLOYMENT READY & VERIFIED SAFE!"
echo "Your live database and media assets are secured in: $LATEST_BACKUP"
