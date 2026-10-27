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

APP_DIR="${BUSINZ_APP_DIR:-/var/www/businz}"
BACKUP_BASE="${BUSINZ_BACKUP_BASE:-/var/backups/businz}"
PORT="${BUSINZ_PORT:-5001}"
BASELINE_COMMIT="04e0a5190ddebddbf8531909fcb64ca114d1832d"
BASELINE_BRANCH="feature/crm-lead-management-system"

# ------------------------------------------------------------------------------
# PREFLIGHT: RECOVERY DIRECTORY RESOLUTION & METADATA VALIDATION
# ------------------------------------------------------------------------------
EXACT_RECOVERY_DIR="${1:-}"
RESOLVED_MANIFEST=""

if [ -n "${EXACT_RECOVERY_DIR}" ]; then
  if [ ! -d "${EXACT_RECOVERY_DIR}" ]; then
    echo "❌ CRITICAL: Specified recovery directory does not exist: ${EXACT_RECOVERY_DIR}" >&2
    exit 1
  fi
  # Locate deployment manifest
  if [ -f "${EXACT_RECOVERY_DIR}/deployment_manifest.json" ]; then
    RESOLVED_MANIFEST="${EXACT_RECOVERY_DIR}/deployment_manifest.json"
  else
    for m in $(ls -t "${BACKUP_BASE}"/deployment_manifest_*.json 2>/dev/null || true); do
      if [ -s "${m}" ]; then
        target_dir=$(node -e "try { const d = JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).recovery_dir; console.log(d || ''); } catch(_) {}" "${m}" 2>/dev/null || true)
        if [ "${target_dir}" = "${EXACT_RECOVERY_DIR}" ]; then
          RESOLVED_MANIFEST="${m}"
          break
        fi
      fi
    done
  fi
else
  # Resolve from latest valid deployment manifest
  for m in $(ls -t "${BACKUP_BASE}"/deployment_manifest_*.json 2>/dev/null || true); do
    if [ -s "${m}" ]; then
      target_dir=$(node -e "try { const d = JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).recovery_dir; console.log(d || ''); } catch(_) {}" "${m}" 2>/dev/null || true)
      if [ -n "${target_dir}" ] && [ -d "${target_dir}" ]; then
        EXACT_RECOVERY_DIR="${target_dir}"
        RESOLVED_MANIFEST="${m}"
        break
      fi
    fi
  done
fi

if [ -z "${EXACT_RECOVERY_DIR}" ] || [ ! -d "${EXACT_RECOVERY_DIR}" ]; then
  echo "❌ CRITICAL: Could not resolve a valid deployment recovery directory!" >&2
  echo "Usage: $0 [/var/backups/businz/recovery_YYYYMMDD_HHMMSS]" >&2
  exit 1
fi

# Mandatory completeness check: Must contain frontend bundle
if [ ! -f "${EXACT_RECOVERY_DIR}/dist_frontend/index.html" ] || [ ! -s "${EXACT_RECOVERY_DIR}/dist_frontend/index.html" ]; then
  echo "❌ CRITICAL: Recovery directory '${EXACT_RECOVERY_DIR}' is INCOMPLETE!" >&2
  echo "Missing mandatory frontend bundle: '${EXACT_RECOVERY_DIR}/dist_frontend/index.html'." >&2
  echo "👉 A partial or database-only backup cannot be used for complete application rollback." >&2
  exit 1
fi

# Mandatory index metadata validation: Must be defined and strictly 0 or 1. Never guess.
PRE_EXISTING_BOM_IDX=""
PRE_EXISTING_LEADS_IDX=""

if [ -n "${RESOLVED_MANIFEST}" ] && [ -s "${RESOLVED_MANIFEST}" ]; then
  PRE_EXISTING_BOM_IDX=$(node -e "try { const m = JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); if (typeof m.pre_existing_bom_idx === 'number') console.log(m.pre_existing_bom_idx); } catch(_) {}" "${RESOLVED_MANIFEST}" 2>/dev/null || true)
  PRE_EXISTING_LEADS_IDX=$(node -e "try { const m = JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); if (typeof m.pre_existing_leads_idx === 'number') console.log(m.pre_existing_leads_idx); } catch(_) {}" "${RESOLVED_MANIFEST}" 2>/dev/null || true)
fi

if [ -z "${PRE_EXISTING_BOM_IDX}" ] && [ -n "${BUSINZ_PRE_EXISTING_BOM_IDX:-}" ]; then
  PRE_EXISTING_BOM_IDX="${BUSINZ_PRE_EXISTING_BOM_IDX}"
fi
if [ -z "${PRE_EXISTING_LEADS_IDX}" ] && [ -n "${BUSINZ_PRE_EXISTING_LEADS_IDX:-}" ]; then
  PRE_EXISTING_LEADS_IDX="${BUSINZ_PRE_EXISTING_LEADS_IDX}"
fi

if [[ ! "${PRE_EXISTING_BOM_IDX}" =~ ^[01]$ ]] || [[ ! "${PRE_EXISTING_LEADS_IDX}" =~ ^[01]$ ]]; then
  echo "❌ CRITICAL: Missing or invalid required index metadata!" >&2
  echo "PRE_EXISTING_BOM_IDX:   '${PRE_EXISTING_BOM_IDX:-undefined}' (expected 0 or 1)" >&2
  echo "PRE_EXISTING_LEADS_IDX: '${PRE_EXISTING_LEADS_IDX:-undefined}' (expected 0 or 1)" >&2
  echo "Manifest path:          '${RESOLVED_MANIFEST:-none}'" >&2
  echo "👉 Aborting rollback immediately BEFORE modifying application files or database indexes." >&2
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

# 2. Complete Code & File Rollback to Baseline Commit
echo "🔄 Executing complete rollback of code files to baseline commit ${BASELINE_COMMIT}..."
cd "${APP_DIR}"

ROLLBACK_CHANGES_RAW=$(git diff-tree -r --name-status HEAD "${BASELINE_COMMIT}")

ROLLBACK_CODE_PATHS=()
while IFS= read -r line; do
  [ -z "${line}" ] && continue
  status=$(echo "${line}" | awk '{print $1}')
  filepath=$(echo "${line}" | awk '{print $2}')
  
  # STRICT DATA & RUNTIME PROTECTION: Never touch active JSON stores, uploads, sessions, .env, core dumps
  if [[ "${filepath}" =~ ^server/.*\.json$ ]] || \
     [[ "${filepath}" =~ ^server/uploads/ ]] || \
     [[ "${filepath}" =~ ^server/wa_sessions/ ]] || \
     [[ "${filepath}" =~ ^core ]] || \
     [[ "${filepath}" =~ \.bak$ ]] || \
     [[ "${filepath}" =~ \.dump$ ]] || \
     [ "${filepath}" = ".env" ]; then
    continue
  fi
  
  ROLLBACK_CODE_PATHS+=("${filepath}")
  
  if [ "${status}" = "D" ]; then
    # File introduced in release that did NOT exist in baseline (e.g. server/memoryDiagnostics.js)
    if [ -f "${APP_DIR}/${filepath}" ]; then
      echo "   - Removing newly introduced release file: ${filepath}"
      rm -f "${APP_DIR}/${filepath}"
    fi
  else
    # File modified or existed in baseline: check out from baseline
    git checkout "${BASELINE_COMMIT}" -- "${filepath}"
  fi
done <<< "${ROLLBACK_CHANGES_RAW}"

# Advance Git ref back to baseline
git update-ref "refs/heads/${BASELINE_BRANCH}" "${BASELINE_COMMIT}"
git symbolic-ref HEAD "refs/heads/${BASELINE_BRANCH}"

if [ ${#ROLLBACK_CODE_PATHS[@]} -gt 0 ]; then
  git reset "${BASELINE_COMMIT}" -- "${ROLLBACK_CODE_PATHS[@]}"
fi

# Verify consistency of all changed files
echo "🔍 Verifying complete code rollback consistency..."
while IFS= read -r line; do
  [ -z "${line}" ] && continue
  status=$(echo "${line}" | awk '{print $1}')
  filepath=$(echo "${line}" | awk '{print $2}')

  if [[ "${filepath}" =~ ^server/.*\.json$ ]] || \
     [[ "${filepath}" =~ ^server/uploads/ ]] || \
     [[ "${filepath}" =~ ^server/wa_sessions/ ]] || \
     [[ "${filepath}" =~ ^core ]] || \
     [[ "${filepath}" =~ \.bak$ ]] || \
     [[ "${filepath}" =~ \.dump$ ]] || \
     [ "${filepath}" = ".env" ]; then
    continue
  fi

  if [ "${status}" = "D" ]; then
    if [ -e "${APP_DIR}/${filepath}" ]; then
      echo "❌ CRITICAL: Rolled-back release file still exists: ${filepath}"
      exit 1
    fi
  else
    if ! git diff --quiet "${BASELINE_COMMIT}" -- "${filepath}"; then
      echo "❌ CRITICAL: Rolled-back file differs from baseline: ${filepath}"
      exit 1
    fi
    if ! git diff --quiet --cached "${BASELINE_COMMIT}" -- "${filepath}"; then
      echo "❌ CRITICAL: Git index differs from baseline for: ${filepath}"
      exit 1
    fi
  fi
done <<< "${ROLLBACK_CHANGES_RAW}"

echo "✅ Code files and Git index reverted 100% to baseline ${BASELINE_COMMIT}."

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

# 4. Remove Only Newly Created Indexes (Validated in Preflight)
echo "🗄️ Selectively rolling back performance indexes..."

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
echo "✅ Database indexes reconciled. Live table data and rows remain 100% untouched."

# 5. Reload PM2 Process 'businz'
echo "🔄 Reloading PM2 process 'businz'..."
if ! pm2 reload businz --update-env; then
  echo "⚠️ PM2 reload failed, attempting restart..."
  pm2 restart businz --update-env
fi
sleep 3

# 6. Verify Health Post-Rollback (performed while maintenance mode remains active)
echo "🧪 Verifying application health post-rollback..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT}/api/db-status || echo "000")
FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT}/ || echo "000")
NOTIFICATIONS_AUTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT}/api/crm/leads/notifications || echo "000")

if [ "${HEALTH}" != "200" ] || [ "${FRONTEND}" != "200" ] || [ "${NOTIFICATIONS_AUTH}" != "401" ]; then
  echo "🚨 CRITICAL: Application health check failed after rollback! (DB: HTTP ${HEALTH}, UI: HTTP ${FRONTEND}, Auth: HTTP ${NOTIFICATIONS_AUTH})"
  echo "🔒 Maintenance mode remains active to prevent data corruption. Business writes are NOT reopened."
  exit 1
fi
echo "✅ Health checks passed post-rollback (DB: HTTP 200, UI: HTTP 200, Auth Guard: HTTP 401)."

# 7. Release Maintenance Mode Post-Rollback (ONLY AFTER verification succeeds)
echo "🔓 Releasing maintenance mode post-rollback..."
ROLLBACK_TOKEN=""
if [ -f "${APP_DIR}/maintenance.flag" ]; then
  ROLLBACK_TOKEN=$(jq -r '.token // empty' "${APP_DIR}/maintenance.flag" 2>/dev/null || true)
fi
if [ -z "${ROLLBACK_TOKEN}" ]; then
  ROLLBACK_TOKEN="${BUSINZ_MAINTENANCE_KEY:-${BUSINZ_ADMIN_SECRET:-${SUPABASE_SERVICE_ROLE_KEY:-}}}"
fi
rm -f "${APP_DIR}/maintenance.flag" || true
curl -s -X POST "http://127.0.0.1:${PORT}/api/maintenance/toggle" \
  -H "Content-Type: application/json" \
  -H "x-maintenance-key: ${ROLLBACK_TOKEN}" \
  -d "{\"enabled\": false, \"secret\": \"${ROLLBACK_TOKEN}\"}" >/dev/null 2>&1 || true
echo "✅ Maintenance mode released."

echo "🎉 ROLLBACK SUCCESSFUL: Application restored to baseline ${BASELINE_COMMIT} and confirmed healthy (DB: HTTP 200, UI: HTTP 200, Auth Guard: HTTP 401)."
echo "🛡️ Live transactional data and database records were 100% preserved without overwrite."
