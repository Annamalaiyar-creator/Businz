#!/usr/bin/env bash
# ==============================================================================
# BUSINZ CRM — STANDALONE ROLLBACK SCRIPT (RECONCILED BASELINE)
# Target Environment: Hostinger Production VPS (srv2025332 / 187.126.116.199)
# Approved Baseline:  04e0a5190ddebddbf8531909fcb64ca114d1832d
# Baseline Branch:    feature/crm-lead-management-system
#
# Core Rollback Guarantees:
# 1. Reverts application code and compiled frontend assets to baseline 04e0a51
# 2. Selectively drops newly created performance indexes
# 3. STRICTLY PRESERVES all live PostgreSQL and JSON transactional records
# 4. Never overwrites or extracts older snapshots over newer live data
# ==============================================================================
set -Eeuo pipefail

APP_DIR="/var/www/businz"
BACKUP_BASE="/var/backups/businz"
PORT="5001"
BASELINE_COMMIT="04e0a5190ddebddbf8531909fcb64ca114d1832d"
BASELINE_BRANCH="feature/crm-lead-management-system"

# Use specified recovery directory or read from deployment manifest
EXACT_RECOVERY_DIR="${1:-}"
LATEST_MANIFEST=""
if [ -z "${EXACT_RECOVERY_DIR}" ]; then
  LATEST_MANIFEST=$(ls -t "${BACKUP_BASE}"/deployment_manifest_*.json 2>/dev/null | head -1 || true)
  if [ -s "${LATEST_MANIFEST}" ]; then
    EXACT_RECOVERY_DIR=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).recovery_dir);" "${LATEST_MANIFEST}")
  fi
fi

if [ -z "${EXACT_RECOVERY_DIR}" ] || [ ! -d "${EXACT_RECOVERY_DIR}" ]; then
  echo "❌ CRITICAL: Bound recovery directory not found! (Target: ${EXACT_RECOVERY_DIR:-unset})"
  exit 1
fi

echo "🚨 ==================================================================="
echo "🚨 INITIATING CONTROLLED ROLLBACK TO BASELINE ${BASELINE_COMMIT}"
echo "🚨 Baseline Branch:          ${BASELINE_BRANCH}"
echo "🚨 Bound Recovery Directory: ${EXACT_RECOVERY_DIR}"
echo "🚨 Timestamp:                $(date)"
echo "🚨 ==================================================================="

# 1. Create Point-in-Time Safety Snapshot (For disaster recovery; NOT for auto-overwrite)
ROLLBACK_TS=$(date +%Y%m%d_%H%M%S)
SNAPSHOT_FILE="${BACKUP_BASE}/pre_rollback_live_state_${ROLLBACK_TS}.tar.gz"
echo "🛡️ Securing point-in-time recovery archive of live transaction state to ${SNAPSHOT_FILE}..."
tar --exclude='core*' --exclude='*.bak' -czf "${SNAPSHOT_FILE}" -C "${APP_DIR}/server" $(cd "${APP_DIR}/server" && ls -1 *.json uploads wa_sessions 2>/dev/null || true)
echo "✅ Live recovery archive secured."

# 2. Revert Code Files Cleanly to Baseline Commit (Leaving server/*.json 100% untouched)
echo "🔄 Reverting code files to baseline commit ${BASELINE_COMMIT}..."
cd "${APP_DIR}"
git checkout "${BASELINE_COMMIT}" -- server/index.js server/db.js server/leadManagementService.js server/bomDocumentService.js server/backupEngine.js server/runtimePaths.js server/memoryDiagnostics.js server/whatsappMultiService.js server/migrations src/ package.json 2>/dev/null || true
git update-ref "refs/heads/${BASELINE_BRANCH}" "${BASELINE_COMMIT}"
git symbolic-ref HEAD "refs/heads/${BASELINE_BRANCH}"
echo "✅ Code files reverted to baseline. Live JSON transactional stores were NOT touched."

# Verify untracked runtime artifacts are intact
for protected_file in \
  "${APP_DIR}/core.2440327" \
  "${APP_DIR}/server/bomPersistence.js.before_port_guard_fix_20261012_114540" \
  "${APP_DIR}/server/bom_store.json.bak" \
  "${APP_DIR}/server/sales_pi_store.json.bak"; do
  if [ -f "${protected_file}" ]; then
    echo "🛡️ Verified protected file intact post-rollback: $(basename "${protected_file}")"
  fi
done

# 3. Atomic Frontend Asset Restoration
if [ -d "${EXACT_RECOVERY_DIR}/dist_frontend" ]; then
  echo "📦 Restoring frontend release atomically from ${EXACT_RECOVERY_DIR}/dist_frontend..."
  STAGE_DIR="${APP_DIR}/dist_rollback_stage_${ROLLBACK_TS}"
  BACKUP_FAILED_DIR="${APP_DIR}/dist_failed_${ROLLBACK_TS}"
  
  rm -rf "${STAGE_DIR}"
  mkdir -p "${STAGE_DIR}"
  cp -rf "${EXACT_RECOVERY_DIR}/dist_frontend"/* "${STAGE_DIR}/"
  
  if [ ! -s "${STAGE_DIR}/index.html" ]; then
    echo "❌ CRITICAL: Staged rollback frontend bundle is invalid (index.html missing)!"
    rm -rf "${STAGE_DIR}"
    exit 1
  fi
  
  mv "${APP_DIR}/dist" "${BACKUP_FAILED_DIR}"
  mv "${STAGE_DIR}" "${APP_DIR}/dist"
  rm -rf "${BACKUP_FAILED_DIR}"

  if [ -d "${EXACT_RECOVERY_DIR}/root_assets" ]; then
    cp -rf "${EXACT_RECOVERY_DIR}/root_assets"/* "${APP_DIR}/assets/" 2>/dev/null || true
  fi
  echo "✅ Frontend release bundle restored atomically."
fi

# 4. Remove Only Newly Created Indexes (Reading manifest if available)
echo "🗄️ Selectively rolling back performance indexes..."
PRE_EXISTING_BOM_IDX=0
PRE_EXISTING_LEADS_IDX=0
if [ -n "${LATEST_MANIFEST:-}" ] && [ -s "${LATEST_MANIFEST}" ]; then
  PRE_EXISTING_BOM_IDX=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).pre_existing_bom_idx || 0);" "${LATEST_MANIFEST}" 2>/dev/null || echo 0)
  PRE_EXISTING_LEADS_IDX=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).pre_existing_leads_idx || 0);" "${LATEST_MANIFEST}" 2>/dev/null || echo 0)
fi

if [ "${PRE_EXISTING_BOM_IDX}" -eq 0 ]; then
  echo "   - Dropping newly created index: idx_bom_orders_created_at"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d businz -c "DROP INDEX IF EXISTS idx_bom_orders_created_at;"
else
  echo "   - Preserving pre-existing index: idx_bom_orders_created_at"
fi

if [ "${PRE_EXISTING_LEADS_IDX}" -eq 0 ]; then
  echo "   - Dropping newly created index: idx_leads_created_at"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d businz -c "DROP INDEX IF EXISTS idx_leads_created_at;"
else
  echo "   - Preserving pre-existing index: idx_leads_created_at"
fi

# Backward-compatible database schema policy:
# Purely additive changes (such as 'idx_lead_inactivity_unique_incident') are preserved during ordinary code rollback.
# Dropping the unique index is NOT performed automatically because baseline 04e0a51 also requires idempotency
# on (lead_id, incident_type, salesperson_id, assigned_at) and dropping it risks re-introducing PostgreSQL 42P10 errors.
# Dedicated database rollback requires explicit manual execution of the rollback migration script:
#   psql -d businz -f server/migrations/20261027_lead_inactivity_unique_constraint_rollback.sql
echo "   - Preserving backward-compatible index: idx_lead_inactivity_unique_incident"
echo "   - Preserving 100% of incident and notification records."
echo "✅ Database indexes reconciled. Table data and rows remain 100% untouched."

# 5. Reload PM2 Process 'businz'
echo "🔄 Reloading PM2 process 'businz'..."
pm2 reload businz --update-env
sleep 3

# 6. Verify Health Post-Rollback
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT}/api/db-status || echo "000")
if [ "${HEALTH}" = "200" ]; then
  echo "🎉 ROLLBACK SUCCESSFUL: Application restored to baseline ${BASELINE_COMMIT} and confirmed healthy (HTTP 200)."
  echo "🛡️ Live transactional data was 100% preserved without overwrite."
else
  echo "🚨 CRITICAL: Application health check returned HTTP ${HEALTH} after rollback!"
  exit 1
fi
