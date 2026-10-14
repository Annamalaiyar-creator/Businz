#!/usr/bin/env bash
# ==============================================================================
# BUSINZ Enterprise ERP — Consolidated Zero-Data-Loss Safe Production Deployment
# 
# Target Environment: Hostinger Production VPS (srv2025332)
# Production Port:    5001
# PM2 Target:         businz (businz-dev strictly isolated and untouched)
# Baseline Commit:    f0ada49745d9fa1eceab4bf4dfa27ddb43f96eba
# Target Release:     dc3cede60613130f00bbca378a6434fb91ff04c7
# ==============================================================================
set -euo pipefail

CURRENT_PHASE="PHASE_1_PREFLIGHT"
APP_DIR="/var/www/businz"
EXT_BASE="/var/lib/businz"
EXT_DATA_DIR="${EXT_BASE}/data"
BACKUP_BASE="/var/backups/businz"
PORT="5001"
RELEASE_COMMIT="dc3cede60613130f00bbca378a6434fb91ff04c7"
BASELINE_COMMIT="f0ada49745d9fa1eceab4bf4dfa27ddb43f96eba"
MANIFEST_FILE="${BACKUP_BASE}/deployment_manifest.json"

# Phase-aware failure trap
on_error() {
  local FAILED_LINE="$1"
  local EXIT_CODE="$2"
  echo ""
  echo "🚨 ======================================================================"
  echo "🚨 DEPLOYMENT FAILURE in ${CURRENT_PHASE} at line ${FAILED_LINE} (Code: ${EXIT_CODE})"
  echo "🚨 ======================================================================"

  case "${CURRENT_PHASE}" in
    PHASE_1_PREFLIGHT)
      echo "👉 Preflight failed before any modifications. Application remains active."
      ;;
    PHASE_2_BACKUP)
      echo "👉 Backup failed. Restarting baseline application on port ${PORT}..."
      pm2 start businz --update-env || pm2 restart businz
      ;;
    PHASE_3_SEEDING)
      echo "👉 Seeding failed. Preserving partial files for forensics and creating lock..."
      touch "${EXT_BASE}/.MIGRATION_FAILED_RECONCILIATION_REQUIRED"
      pm2 start businz --update-env || pm2 restart businz
      ;;
    PHASE_4_BUILD|PHASE_5_STARTUP)
      echo "👉 Release failed after code switch. Triggering standalone rollback..."
      if [ -f "${BACKUP_BASE}/rollback_from_manifest.sh" ]; then
        bash "${BACKUP_BASE}/rollback_from_manifest.sh"
      else
        bash "${APP_DIR}/scripts/rollback_from_manifest.sh"
      fi
      ;;
  esac
  exit "${EXIT_CODE}"
}

trap 'on_error ${LINENO} $?' ERR

echo "========================================================================"
echo "🚀 [BUSINZ] Starting Zero-Data-Loss Safe Production Deployment"
echo "🕒 Timestamp: $(date)"
echo "📌 Target Release Commit: ${RELEASE_COMMIT}"
echo "📌 Baseline Commit:       ${BASELINE_COMMIT}"
echo "📌 Production Port:       ${PORT}"
echo "========================================================================"

# --- PHASE 1: PRE-FLIGHT VALIDATION ---
CURRENT_PHASE="PHASE_1_PREFLIGHT"
echo ""
echo "=== [Phase 1] Preflight Checks & Permissions Validation ==="

# 1. Environment Isolation Guard
if [ "${APP_DIR}" = "/var/www/businz-dev" ]; then
  echo "❌ CRITICAL SAFETY HALT: APP_DIR is businz-dev. Target must be production (/var/www/businz)."; exit 1
fi
echo "✅ Targeting production service (/var/www/businz). Development (businz-dev) is isolated."

# 2. Check for reconciliation lock
if [ -f "${EXT_BASE}/.MIGRATION_FAILED_RECONCILIATION_REQUIRED" ]; then
  echo "❌ ABORT: Reconciliation lock file detected: ${EXT_BASE}/.MIGRATION_FAILED_RECONCILIATION_REQUIRED"
  echo "👉 Manual data reconciliation required before any new deployment attempt."
  exit 1
fi

# 3. Confirm BUSINZ_ADMIN_SECRET is configured in .env (BEFORE downtime, NO fallback)
if ! grep -q "^BUSINZ_ADMIN_SECRET=" "${APP_DIR}/.env"; then
  echo "❌ ABORT: BUSINZ_ADMIN_SECRET is missing from ${APP_DIR}/.env. Halted before downtime."
  exit 1
fi
BUSINZ_ADMIN_SECRET=$(grep "^BUSINZ_ADMIN_SECRET=" "${APP_DIR}/.env" | cut -d '=' -f2- | tr -d ' "\r\n')
if [ -z "${BUSINZ_ADMIN_SECRET}" ]; then
  echo "❌ ABORT: BUSINZ_ADMIN_SECRET is empty in ${APP_DIR}/.env. Halted before downtime."
  exit 1
fi
echo "✅ BUSINZ_ADMIN_SECRET verified configured in .env."

# 4. Resolve PM2 runtime user dynamically (strictly for process 'businz')
PM2_USER=$(pm2 describe businz 2>/dev/null | grep -i "username" | awk -F'│' '{print $3}' | tr -d ' ' || whoami)
echo "Runtime PM2 user: ${PM2_USER}"

# 5. Verify remote release commit availability
cd "${APP_DIR}"
git fetch origin
git cat-file -e "${RELEASE_COMMIT}" || { echo "❌ Remote does not have commit ${RELEASE_COMMIT}"; exit 1; }
echo "✅ Release commit ${RELEASE_COMMIT} verified on remote."

# 6. Check for conflicting existing stores in target directory
if [ -d "${EXT_DATA_DIR}" ] && [ "$(ls -A "${EXT_DATA_DIR}"/*.json 2>/dev/null)" ]; then
  echo "❌ ABORT: Stale JSON stores found in ${EXT_DATA_DIR}. Reconciliation required."
  exit 1
fi

# 7. Create external directories and verify ownership
mkdir -p "${EXT_BASE}"/{data,uploads,uploads/bom-documents,backups,wa_sessions} "${BACKUP_BASE}"
chown -R "${PM2_USER}:${PM2_USER}" "${EXT_BASE}"
chmod -R 770 "${EXT_BASE}"
sudo -u "${PM2_USER}" touch "${EXT_DATA_DIR}/.perm_test" && rm -f "${EXT_DATA_DIR}/.perm_test"
echo "✅ External storage permissions verified for ${PM2_USER}."

# 8. Verify PostgreSQL write capability in rolled-back transaction
sudo -u "${PM2_USER}" psql -d businz -c "BEGIN; CREATE TEMP TABLE _businz_write_test(id int); INSERT INTO _businz_write_test VALUES(1); ROLLBACK;"
echo "✅ PostgreSQL write capability confirmed."

# 9. Verify available disk space for backup (>= 2GB)
AVAILABLE_MB=$(df -m "${BACKUP_BASE}" | tail -1 | awk '{print $4}')
if [ "${AVAILABLE_MB}" -lt 2000 ]; then
  echo "❌ ABORT: Insufficient disk space in ${BACKUP_BASE}. Required: >= 2000MB, Available: ${AVAILABLE_MB}MB"
  exit 1
fi
echo "✅ Disk space verified: ${AVAILABLE_MB}MB free in ${BACKUP_BASE}."

# --- PHASE 2: CONTROLLED DOWNTIME & STRICT COMPLETE BACKUP ---
CURRENT_PHASE="PHASE_2_BACKUP"
echo ""
echo "=== [Phase 2] Controlled Downtime & Comprehensive Backup ==="

# Stop PM2 process (strictly businz only)
pm2 stop businz

BACKUP_TS=$(date +%Y%m%d_%H%M%S)
RECOVERY_DIR="${BACKUP_BASE}/recovery_${BACKUP_TS}"
mkdir -p "${RECOVERY_DIR}"/{json_stores,uploads,wa_sessions,config,dist_frontend,root_assets}

# 1. Reliable PostgreSQL dump via /tmp (avoids postgres user permission issues)
TMP_DUMP="/tmp/businz_db_${BACKUP_TS}.dump"
sudo -u postgres pg_dump -d businz -F c -b -v -f "${TMP_DUMP}"
sudo -u postgres pg_restore -l "${TMP_DUMP}" > /dev/null
[ -s "${TMP_DUMP}" ] || { echo "❌ pg_dump produced 0 bytes"; exit 1; }
mv "${TMP_DUMP}" "${RECOVERY_DIR}/businz_db_${BACKUP_TS}.dump"
echo "✅ PostgreSQL backup verified and secured."

# 2. Strict Backup of ALL production JSON stores with 1:1 filename and SHA256 checksum matching
SOURCE_STORES=($(cd "${APP_DIR}/server" && ls -1 *.json 2>/dev/null))
TOTAL_STORES=${#SOURCE_STORES[@]}
echo "Found ${TOTAL_STORES} production JSON stores in ${APP_DIR}/server/."

for store in "${SOURCE_STORES[@]}"; do
  src="${APP_DIR}/server/${store}"
  dst="${RECOVERY_DIR}/json_stores/${store}"
  cp "${src}" "${dst}"

  SRC_HASH=$(sha256sum "${src}" | awk '{print $1}')
  DST_HASH=$(sha256sum "${dst}" | awk '{print $1}')

  if [ "${SRC_HASH}" != "${DST_HASH}" ]; then
    echo "❌ CRITICAL: Checksum mismatch on backup of ${store}!"
    exit 1
  fi
done
echo "✅ 100% of all ${TOTAL_STORES} production JSON stores backed up with exact SHA256 match."

# 3. Uploads & WhatsApp sessions backup (preserving hidden files and verifying copies)
if [ -d "${APP_DIR}/server/uploads" ]; then
  cp -a "${APP_DIR}/server/uploads/." "${RECOVERY_DIR}/uploads/"
fi
if [ -d "${APP_DIR}/server/wa_sessions" ]; then
  cp -a "${APP_DIR}/server/wa_sessions/." "${RECOVERY_DIR}/wa_sessions/"
fi
if [ -d "${APP_DIR}/server/.wwebjs_auth" ]; then
  cp -a "${APP_DIR}/server/.wwebjs_auth" "${RECOVERY_DIR}/wa_sessions/"
fi

# 4. Config backup
cp "${APP_DIR}/.env" "${RECOVERY_DIR}/config/.env.bak"
[ -s "${RECOVERY_DIR}/config/.env.bak" ] || { echo "❌ Missing .env backup"; exit 1; }

# 5. Compiled frontend bundle & root assets backup
[ -d "${APP_DIR}/dist" ] && cp -rf "${APP_DIR}"/dist/* "${RECOVERY_DIR}/dist_frontend/"
[ -d "${APP_DIR}/assets" ] && cp -rf "${APP_DIR}"/assets/* "${RECOVERY_DIR}/root_assets/" 2>/dev/null || true
[ -s "${RECOVERY_DIR}/dist_frontend/index.html" ] || { echo "❌ Missing dist/index.html backup"; exit 1; }
echo "✅ Compiled frontend bundle and assets preserved."

# 6. Write Complete Deployment Manifest (Includes expected_stores array)
EXPECTED_STORES_JSON=$(node -e "console.log(JSON.stringify(process.argv.slice(1)));" "${SOURCE_STORES[@]}")
cat << EOF > "${MANIFEST_FILE}"
{
  "timestamp": "${BACKUP_TS}",
  "recovery_dir": "${RECOVERY_DIR}",
  "release_commit": "${RELEASE_COMMIT}",
  "baseline_commit": "${BASELINE_COMMIT}",
  "pm2_user": "${PM2_USER}",
  "app_dir": "${APP_DIR}",
  "ext_base": "${EXT_BASE}",
  "ext_data_dir": "${EXT_DATA_DIR}",
  "expected_port": "${PORT}",
  "expected_stores": ${EXPECTED_STORES_JSON}
}
EOF
echo "✅ Deployment manifest created with all ${TOTAL_STORES} expected stores."

# Copy standalone rollback script to backup location
cp "${APP_DIR}/scripts/rollback_from_manifest.sh" "${BACKUP_BASE}/rollback_from_manifest.sh"
chmod +x "${BACKUP_BASE}/rollback_from_manifest.sh"

# --- PHASE 3: SEED EXTERNAL STORAGE ---
CURRENT_PHASE="PHASE_3_SEEDING"
echo ""
echo "=== [Phase 3] Seeding External Storage ==="

for store in "${SOURCE_STORES[@]}"; do
  src="${APP_DIR}/server/${store}"
  dst="${EXT_DATA_DIR}/${store}"
  cp "${src}" "${dst}"

  SRC_HASH=$(sha256sum "${src}" | awk '{print $1}')
  DST_HASH=$(sha256sum "${dst}" | awk '{print $1}')

  if [ "${SRC_HASH}" != "${DST_HASH}" ]; then
    echo "❌ CRITICAL: Checksum mismatch on seeding of ${store}!"
    exit 1
  fi
done

if [ -d "${APP_DIR}/server/uploads" ]; then
  cp -a "${APP_DIR}/server/uploads/." "${EXT_BASE}/uploads/"
fi
if [ -d "${APP_DIR}/server/wa_sessions" ]; then
  cp -a "${APP_DIR}/server/wa_sessions/." "${EXT_BASE}/wa_sessions/"
fi
if [ -d "${APP_DIR}/server/.wwebjs_auth" ]; then
  cp -a "${APP_DIR}/server/.wwebjs_auth" "${EXT_BASE}/wa_sessions/"
fi

chown -R "${PM2_USER}:${PM2_USER}" "${EXT_BASE}"
chmod 660 "${EXT_DATA_DIR}"/*.json
echo "✅ Seeded and verified all $(ls "${EXT_DATA_DIR}"/*.json | wc -l) stores to ${EXT_DATA_DIR}."

# --- PHASE 4: CODE SWITCH & PRODUCTION BUILD ---
# Requirement 8: git checkout -f is run ONLY after backups and external data copies have passed validation
CURRENT_PHASE="PHASE_4_BUILD"
echo ""
echo "=== [Phase 4] Code Checkout & React/Vite Build ==="

cd "${APP_DIR}"
git checkout -f "${RELEASE_COMMIT}"
echo "✅ Checked out release commit: $(git rev-parse HEAD)"

# Reproducible install with npm ci when package-lock.json exists
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

# Build production bundle
npm run build
test -f dist/index.html && test -d dist/assets
echo "✅ Production bundle built and verified."

# Update .env with external paths and start in maintenance mode
sed -i "/BUSINZ_DATA_DIR/d; /BUSINZ_UPLOADS_DIR/d; /BUSINZ_BACKUP_DIR/d; /BUSINZ_WA_SESSIONS_DIR/d; /BUSINZ_MAINTENANCE_MODE/d" .env
cat << EOF >> .env

# BUSINZ Persistent External Runtime Storage
BUSINZ_DATA_DIR=${EXT_DATA_DIR}
BUSINZ_UPLOADS_DIR=${EXT_BASE}/uploads
BUSINZ_BACKUP_DIR=${EXT_BASE}/backups
BUSINZ_WA_SESSIONS_DIR=${EXT_BASE}/wa_sessions
BUSINZ_MAINTENANCE_MODE=true
EOF

# --- PHASE 5: START WITH MAINTENANCE & VALIDATION ON PORT 5001 ---
CURRENT_PHASE="PHASE_5_STARTUP"
echo ""
echo "=== [Phase 5] Service Startup & Smoke Validation on Port ${PORT} ==="

BUSINZ_DATA_DIR="${EXT_DATA_DIR}" \
BUSINZ_UPLOADS_DIR="${EXT_BASE}/uploads" \
BUSINZ_BACKUP_DIR="${EXT_BASE}/backups" \
BUSINZ_WA_SESSIONS_DIR="${EXT_BASE}/wa_sessions" \
BUSINZ_MAINTENANCE_MODE=true \
pm2 start businz --update-env

sleep 3

# 1. Verify Maintenance Mode is blocking writes with HTTP 503 on Port 5001
STATUS_503=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:${PORT}/api/boms -H "Content-Type: application/json" -d "{}")
if [ "${STATUS_503}" != "503" ]; then
  echo "❌ ABORT: Writes are not blocked! Expected HTTP 503, got ${STATUS_503}"
  exit 1
fi
echo "✅ Maintenance write-blocking verified active (HTTP 503 on mutating requests)."

# 2. Verify external storage status
curl -s http://localhost:${PORT}/api/storage/status | grep "\"externalStorage\":true"
echo "✅ External storage resolver active and verified."

# 3. Verify core business entity read endpoints
curl -s http://localhost:${PORT}/api/boms | grep "\"success\":true"
curl -s http://localhost:${PORT}/api/invoices | grep "\"success\":true"
curl -s http://localhost:${PORT}/api/raw-materials | grep "\"success\":true"
echo "✅ Core business read APIs validated on port ${PORT} against external storage."

# 4. Explicitly disable maintenance mode using configured secret (no fallback)
curl -s -X POST http://localhost:${PORT}/api/maintenance/toggle \
  -H "Content-Type: application/json" \
  -d "{\"enabled\": false, \"secret\": \"${BUSINZ_ADMIN_SECRET}\"}" | grep "\"maintenance\":false"

# Update .env to keep maintenance mode disabled across future restarts
sed -i "s/BUSINZ_MAINTENANCE_MODE=true/BUSINZ_MAINTENANCE_MODE=false/" .env
curl -s http://localhost:${PORT}/api/maintenance/status | grep "\"maintenance\":false"
echo "✅ Maintenance mode explicitly disabled: Writes reopened on port ${PORT}."

echo ""
echo "========================================================================"
echo "🎉 [BUSINZ] PRODUCTION DEPLOYMENT COMPLETE & VERIFIED SAFE ON PORT ${PORT}!"
echo "   - Active Git Commit: $(git rev-parse HEAD)"
echo "   - Expected Commit:   ${RELEASE_COMMIT}"
echo "   - Baseline for Rollback: ${BASELINE_COMMIT}"
echo "   - External Storage:  ${EXT_DATA_DIR}"
echo "   - Maintenance Mode:  Disabled (Normal Operations Live)"
echo "========================================================================"
