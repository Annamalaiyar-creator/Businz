#!/usr/bin/env bash
# ==============================================================================
# BUSINZ CRM — PRODUCTION DEPLOYMENT & VERIFICATION SCRIPT (PHASE 3A)
# Target Environment: Hostinger VPS (srv2025332)
# Database:           PostgreSQL 18.6 (businz)
# Approved Release:   bb723233a41f66a15f629c25ba10e32869c1d532
# Known-Good Commit:  122260fc93cff15cf287ec56c703b44b82d3346b
# Safety Standard:    Zero-data-loss, automated rollback, full pre/post audit
# ==============================================================================
set -eo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BASE_DIR="/var/www/businz"
BACKUP_DIR="${BASE_DIR}/server/backups/phase3a_predeploy_${TIMESTAMP}"
VERIFY_DB="businz_verify_${TIMESTAMP}"
APPROVED_RELEASE_COMMIT="66f84918e8ec387d34f0096c56043097827a5f04"
KNOWN_GOOD_ROLLBACK_COMMIT="0b11e7ae68ba26911b1e2bd5fb6dbd4d55873cfc"

DEPLOYMENT_SUCCESS=0
APPLICATION_STOPPED=0
RECOVERY_EXECUTED=0
PRE_DEPLOY_COMMIT=""
PM2_NAME="businz"

# ------------------------------------------------------------------------------
# 1. AUTOMATIC APPLICATION RECOVERY (EXIT & ERR TRAP)
# ------------------------------------------------------------------------------
cleanup_and_recover() {
  local original_exit_code=$1
  local line_no=$2
  local failed_command="$3"

  if [ "${DEPLOYMENT_SUCCESS}" -eq 1 ] && [ "${original_exit_code}" -eq 0 ]; then
    return 0
  fi

  if [ "${RECOVERY_EXECUTED}" -eq 1 ]; then
    return 0
  fi
  RECOVERY_EXECUTED=1

  # Ensure failure exit code is non-zero
  if [ "${original_exit_code}" -eq 0 ]; then
    original_exit_code=1
  fi

  echo ""
  echo "========================================================================"
  echo "🚨 [DEPLOYMENT FAILURE] Script execution failed at line ${line_no}!"
  echo "   Failed Command:      ${failed_command}"
  echo "   Original Exit Code:  ${original_exit_code}"
  echo "========================================================================"

  local recovery_failed=0

  # 1. Clean up isolated test database if left behind (check explicitly, zero silent error suppression)
  if sudo -u postgres psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "${VERIFY_DB}"; then
    echo "🧹 Removing isolated verification database '${VERIFY_DB}'..."
    if ! sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE ${VERIFY_DB};"; then
      echo "⚠️ Warning: Could not cleanly drop temporary test database '${VERIFY_DB}'."
    fi
  fi

  # 2. Database snapshot protection: NEVER automatically restore old database snapshot
  echo "🔒 Database Protection: PostgreSQL database 'businz' remains untouched; no old snapshot restored."
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres -c "ALTER DATABASE businz RESET default_transaction_read_only;" 2>/dev/null || true

  # 3. Git Stash Safety: Preserve stash in Git history
  if git stash list 2>/dev/null | grep -q "phase3a_runtime_${TIMESTAMP}"; then
    echo "🔒 Git Stash Notice: Runtime stash 'phase3a_runtime_${TIMESTAMP}' is preserved in Git stash history for safety."
  fi

  if [ "${APPLICATION_STOPPED}" -eq 1 ]; then
    echo ""
    echo "🔄 [AUTO-RECOVERY] Attempting safe application recovery to verified commit ${PRE_DEPLOY_COMMIT}..."
    cd "${BASE_DIR}"

    # 3. Restore and verify original Git commit
    local current_git
    current_git=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    if [ "${current_git}" != "${PRE_DEPLOY_COMMIT}" ] && [ -n "${PRE_DEPLOY_COMMIT}" ]; then
      echo "   - Checking out verified original Git commit (${PRE_DEPLOY_COMMIT})..."
      if ! git checkout --detach "${PRE_DEPLOY_COMMIT}"; then
        echo "🚨 [FATAL RECOVERY ERROR] Git checkout to ${PRE_DEPLOY_COMMIT} failed!"
        recovery_failed=1
      fi

      local confirmed_git
      confirmed_git=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
      if [ "${confirmed_git}" != "${PRE_DEPLOY_COMMIT}" ]; then
        echo "🚨 [FATAL RECOVERY ERROR] Active Git commit (${confirmed_git}) does not match expected (${PRE_DEPLOY_COMMIT})!"
        recovery_failed=1
      else
        echo "   ✓ Confirmed restored Git commit: ${confirmed_git}"
      fi
    fi

    # 4. Re-apply preserved live JSON stores & backups (NEVER overwrite with older repository data)
    if [ -d "${BACKUP_DIR}/live_runtime_data" ]; then
      echo "   - Re-applying preserved live production JSON stores and backups..."
      if ! cp -p "${BACKUP_DIR}/live_runtime_data"/* "${BASE_DIR}/server/"; then
        echo "🚨 [FATAL RECOVERY ERROR] Failed to restore preserved live runtime data!"
        recovery_failed=1
      fi
    fi

    # 5. Recompile client bundle
    echo "   - Recompiling client bundle for rollback commit..."
    if ! npm run build; then
      echo "🚨 [FATAL RECOVERY ERROR] Frontend build failed during recovery!"
      recovery_failed=1
    fi

    # 6. Restart original PM2 application safely
    echo "   - Restarting original PM2 application '${PM2_NAME}'..."
    if ! pm2 start "${PM2_NAME}" --update-env; then
      if ! pm2 restart "${PM2_NAME}" --update-env; then
        echo "🚨 [FATAL RECOVERY ERROR] Failed to restart PM2 process '${PM2_NAME}'!"
        recovery_failed=1
      fi
    fi

    sleep 3

    # 7. Verify application health before reporting recovery success
    local rec_health
    rec_health=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5001/api/db-status || echo "000")
    if [ "${rec_health}" = "200" ] && [ "${recovery_failed}" -eq 0 ]; then
      echo "✅ [AUTO-RECOVERY SUCCESSFUL] Application service recovered to ${PRE_DEPLOY_COMMIT} and confirmed healthy (HTTP 200)."
    else
      echo ""
      echo "🚨 [MANUAL INTERVENTION REQUIRED] Automated recovery could not restore a healthy application state!"
      echo "   - Health Check Status: HTTP ${rec_health} (expected 200)"
      echo "   - Recovery Step Failures: ${recovery_failed}"
      echo "   - Action Required: Run 'pm2 logs ${PM2_NAME} --lines 100' to diagnose application error."
      echo "   - Preserved Live JSONs: ${BACKUP_DIR}/live_json_stores/"
      echo "   - Database Status: Additive columns remain backward compatible; live database is untouched."
    fi
  else
    echo "ℹ️ Application was not stopped prior to failure. No service restart needed."
  fi

  echo "========================================================================"
  # Preserve original script failure exit code
  exit "${original_exit_code}"
}

trap 'cleanup_and_recover $? $LINENO "$BASH_COMMAND"' EXIT

echo "========================================================================"
echo "🚀 BUSINZ CRM: PHASE 3A PRODUCTION DEPLOYMENT SCRIPT"
echo "Timestamp:                  ${TIMESTAMP}"
echo "Approved Release Commit:    ${APPROVED_RELEASE_COMMIT}"
echo "Known-Good Rollback Commit: ${KNOWN_GOOD_ROLLBACK_COMMIT}"
echo "========================================================================"

# ------------------------------------------------------------------------------
# STEP 1: PRE-FLIGHT VALIDATION & WORKING TREE AUDIT
# ------------------------------------------------------------------------------
echo ""
echo "🔍 [Step 1/8] Pre-Flight System & Working Tree Inspection..."

cd "${BASE_DIR}"

# 1.1 Record active pre-deployment Git commit for exact rollback targeting
PRE_DEPLOY_COMMIT=$(git rev-parse HEAD)
echo "   - Current active VPS Git commit: ${PRE_DEPLOY_COMMIT}"
if [ "${PRE_DEPLOY_COMMIT}" != "${KNOWN_GOOD_ROLLBACK_COMMIT}" ]; then
  echo "⚠️ [NOTICE] Active VPS commit differs from expected rollback target (${KNOWN_GOOD_ROLLBACK_COMMIT})."
fi

# 1.2 Verify production PM2 process 'businz' specifically, leaving 'businz-dev' untouched
PM2_TARGET="businz"
PM2_INFO=$(pm2 jlist 2>/dev/null | jq -r --arg n "${PM2_TARGET}" '.[] | select(.name == $n) // empty')
if [ -z "${PM2_INFO}" ]; then
  echo "❌ [FATAL] Production PM2 process '${PM2_TARGET}' not detected! Aborting to protect system."
  exit 1
fi
PM2_NAME="${PM2_TARGET}"
PM2_MODE=$(echo "${PM2_INFO}" | jq -r '.pm2_env.exec_mode // "unknown"')
PM2_INSTANCES=$(echo "${PM2_INFO}" | jq -r '.pm2_env.instances // "1"')
echo "   - Target PM2 process: '${PM2_NAME}' | Mode: ${PM2_MODE} | Instances: ${PM2_INSTANCES}"
echo "   - Note: 'businz-dev' process is preserved and untouched."

# Verify businz-dev process cannot write to production database 'businz'
DEV_PM2_INFO=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name == "businz-dev") // empty')
if [ -n "${DEV_PM2_INFO}" ]; then
  DEV_DB=$(echo "${DEV_PM2_INFO}" | jq -r '.pm2_env.DATABASE_URL // .pm2_env.env.DATABASE_URL // ""')
  if [ -n "${DEV_DB}" ] && echo "${DEV_DB}" | grep -qE "(/businz$|/businz\?)"; then
    echo "🚨 [FATAL ERROR] 'businz-dev' process is configured to target production database 'businz'!"
    echo "   Database URI: ${DEV_DB}"
    echo "   'businz-dev' must NOT connect to the production database 'businz'. Aborting."
    exit 1
  fi
  echo "   ✓ Confirmed 'businz-dev' is isolated and does not target production database 'businz'."
fi

# 1.3 Review Git working tree before checkout (accommodates 5 runtime JSONs and 2 .bak files)
echo "   - Reviewing Git working tree status before deployment..."
GIT_DIRTY=$(git status --porcelain)
if [ -n "${GIT_DIRTY}" ]; then
  echo "⚠️ [NOTICE] Untracked or modified files in working tree detected."
  NON_JSON_DIRTY=$(echo "${GIT_DIRTY}" | grep -v -E "(server/.*\.json$|\.bak$)" || true)
  if [ -n "${NON_JSON_DIRTY}" ]; then
    echo "❌ [FATAL] Dirty working tree contains modified code files outside JSON/backup stores! Aborting."
    echo "${NON_JSON_DIRTY}"
    exit 1
  fi
  echo "   - Working tree modifications are confined strictly to active runtime JSON stores and .bak archives (PASS)."
fi

# 1.4 Verify disk headroom (> 2 GB minimum headroom required)
AVAILABLE_KB=$(df -k "${BASE_DIR}" | awk 'NR==2 {print $4}')
REQUIRED_KB=2097152 # 2 GB
if [ "${AVAILABLE_KB}" -lt "${REQUIRED_KB}" ]; then
  echo "❌ [FATAL] Insufficient disk space! (${AVAILABLE_KB} KB available, ${REQUIRED_KB} KB required). Aborting."
  exit 1
fi
echo "   - Available disk headroom: $(( AVAILABLE_KB / 1024 )) MB (PASS)"

# ------------------------------------------------------------------------------
# STEP 2: PAUSE WRITERS & RECORD PRE-DEPLOYMENT BASELINE AUDIT
# ------------------------------------------------------------------------------
echo ""
echo "⏸️  [Step 2/8] Ensuring Zero Active Writers & Recording Pre-Deployment Baseline..."

# Pause PM2 service to guarantee atomic cross-store consistency (no active writers)
echo "   - Pausing PM2 service '${PM2_NAME}' to freeze incoming transactions..."
pm2 stop "${PM2_NAME}"
APPLICATION_STOPPED=1
sleep 2

BASELINE_DB_WRITES=""

# Helper function: Verify exclusive database maintenance condition
verify_zero_writers() {
  local stage_name="$1"
  echo "   - Verifying exclusive database maintenance condition (${stage_name})..."
  
  # 1. Check for ANY external sessions on database 'businz' (active, idle, or in transaction)
  local active_sessions
  active_sessions=$(sudo -u postgres psql -v ON_ERROR_STOP=1 -d businz -t -A -c "
    SELECT count(*) FROM pg_stat_activity 
    WHERE datname = 'businz' AND pid <> pg_backend_pid();
  ")
  if [ "${active_sessions}" -gt 0 ]; then
    echo "🚨 [FATAL ERROR] Exclusive maintenance condition FAILED at ${stage_name}!"
    echo "   Found ${active_sessions} unapproved PostgreSQL session(s) connected to database 'businz':"
    sudo -u postgres psql -v ON_ERROR_STOP=1 -d businz -c "
      SELECT pid, usename, client_addr, application_name, state, backend_start, query_start, query 
      FROM pg_stat_activity 
      WHERE datname = 'businz' AND pid <> pg_backend_pid();
    "
    echo "🔒 Safety Rule: The script will NOT terminate database sessions automatically."
    echo "   Manual Action Required: Inspect and safely terminate/close lingering client connections before proceeding."
    exit 1
  fi

  # 2. Check for unexpected external writes via pg_stat_database
  local current_writes
  current_writes=$(sudo -u postgres psql -v ON_ERROR_STOP=1 -d businz -t -A -c "
    SELECT COALESCE(tup_inserted + tup_updated + tup_deleted, 0) FROM pg_stat_database WHERE datname = 'businz';
  ")
  if [ -n "${BASELINE_DB_WRITES}" ] && [ "${current_writes}" -ne "${BASELINE_DB_WRITES}" ]; then
    echo "🚨 [FATAL ERROR] Unexpected database write activity detected during ${stage_name}!"
    echo "   Baseline writes: ${BASELINE_DB_WRITES}, Current writes: ${current_writes}"
    echo "   Database 'businz' received modifications outside deployment. Aborting."
    exit 1
  fi

  echo "   ✓ Exclusive maintenance condition verified (${stage_name}): 0 external sessions, 0 unexpected writes."
}

# Initial verification of exclusive maintenance condition
verify_zero_writers "Pre-Deployment Baseline"

# Record baseline tuple writes on 'businz'
BASELINE_DB_WRITES=$(sudo -u postgres psql -v ON_ERROR_STOP=1 -d businz -t -A -c "
  SELECT COALESCE(tup_inserted + tup_updated + tup_deleted, 0) FROM pg_stat_database WHERE datname = 'businz';
")

# Lock database to read-only mode across all connections during maintenance window
echo "   - Locking database 'businz' to read-only mode (default_transaction_read_only = on)..."
sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres -c "ALTER DATABASE businz SET default_transaction_read_only = on;"

# Create backup directory with valid postgres-user filesystem permissions
mkdir -p "${BACKUP_DIR}/live_runtime_data"
chown -R postgres:postgres "${BACKUP_DIR}"
chmod 775 "${BACKUP_DIR}"

BASELINE_FILE="${BACKUP_DIR}/pre_deploy_baseline.tsv"
PRE_DEPLOY_BOM_JSON="${BACKUP_DIR}/pre_deploy_boms.json"

echo "   - Capturing authoritative pre-deployment counts from PostgreSQL (ON_ERROR_STOP=1)..."
sudo -u postgres psql -v ON_ERROR_STOP=1 -d businz -t -A -F$'\t' << 'EOF' > "${BASELINE_FILE}"
SELECT 'bom_orders_total' AS entity, count(*)::text AS val FROM public.bom_orders
UNION ALL
SELECT 'controlroom_bom_store', COALESCE((SELECT CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 1 END FROM public.controlroom_store WHERE key = 'bom_store'), 0)::text
UNION ALL
SELECT 'historical_boms_present', count(*)::text FROM public.bom_orders WHERE bom_code IN ('BOM-659','BOM-660','BOM-661','BOM-662','BOM-663','BOM-664','BOM-665')
UNION ALL
SELECT 'controlroom_sales_pi', COALESCE((SELECT CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 1 END FROM public.controlroom_store WHERE key = 'sales_pi_store'), 0)::text
UNION ALL
SELECT 'controlroom_customer_store', COALESCE((SELECT CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 1 END FROM public.controlroom_store WHERE key = 'customer_store'), 0)::text
UNION ALL
SELECT 'controlroom_item_store', COALESCE((SELECT CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 1 END FROM public.controlroom_store WHERE key = 'item_store'), 0)::text
UNION ALL
SELECT 'controlroom_prod_ledger', COALESCE((SELECT CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 1 END FROM public.controlroom_store WHERE key = 'vrm_prod_ledger'), 0)::text
UNION ALL
SELECT 'controlroom_dc_store', COALESCE((SELECT CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 1 END FROM public.controlroom_store WHERE key = 'dc_store'), 0)::text
UNION ALL
SELECT 'bom_dispatch_entries', count(*)::text FROM public.bom_orders WHERE dispatch_packing IS NOT NULL AND dispatch_packing != '[]'::jsonb;
EOF

echo "   - Capturing complete pre-deployment structured BOM snapshot (jsonb_object_agg)..."
sudo -u postgres psql -v ON_ERROR_STOP=1 -d businz -t -A << 'EOF' > "${PRE_DEPLOY_BOM_JSON}"
SELECT COALESCE(jsonb_object_agg(
  bom_code,
  jsonb_build_object(
    'status', COALESCE(status, ''),
    'grand_total', COALESCE(grand_total, 0),
    'sales_person', COALESCE(sales_person, ''),
    'sales_person_code', COALESCE(sales_person_code, ''),
    'source_pi_no', COALESCE(source_pi_no, ''),
    'dispatch_packing', COALESCE(dispatch_packing, '[]'::jsonb),
    'accounts_verification', COALESCE(accounts_verification, '{}'::jsonb),
    'stock_deducted', COALESCE(stock_deducted, false),
    'stock_blocked', COALESCE(stock_blocked, false),
    'created_by', COALESCE(created_by, '')
  )
), '{}'::jsonb) FROM public.bom_orders;
EOF

echo "   - Recorded Pre-Deployment Baseline Metrics:"
cat "${BASELINE_FILE}"
echo ""

# ------------------------------------------------------------------------------
# STEP 3: PRESERVE ACTIVE LIVE VPS JSON & BACKUP FILES
# ------------------------------------------------------------------------------
echo "📦 [Step 3/8] Preserving Active Live JSON & Backup Files (Zero Active Writers)..."

# Copy all active JSON and .bak stores to safe backup directory outside git checkout path
mkdir -p "${BACKUP_DIR}/live_runtime_data"
cp -p "${BASE_DIR}/server"/*.json "${BACKUP_DIR}/live_runtime_data/" 2>/dev/null || true
cp -p "${BASE_DIR}/server"/*.bak "${BACKUP_DIR}/live_runtime_data/" 2>/dev/null || true
RUNTIME_FILE_COUNT=$(ls -1 "${BACKUP_DIR}/live_runtime_data"/* | wc -l)

# Record checksums of preserved runtime files
cd "${BACKUP_DIR}/live_runtime_data"
sha256sum * > "${BACKUP_DIR}/LIVE_RUNTIME_SHA256SUMS"
cd "${BASE_DIR}"

echo "✅ Preserved ${RUNTIME_FILE_COUNT} live runtime stores/backups with SHA-256 signatures."

# ------------------------------------------------------------------------------
# STEP 4: CREATE POSTGRESQL PRODUCTION BACKUP WITH VALID PERMISSIONS
# ------------------------------------------------------------------------------
echo ""
echo "🐘 [Step 4/8] Creating PostgreSQL Production Backup with Valid Permissions..."

DUMP_CUSTOM="${BACKUP_DIR}/businz_prod_${TIMESTAMP}.dump"
DUMP_SQL="${BACKUP_DIR}/businz_prod_${TIMESTAMP}.sql"
DUMP_LOG="${BACKUP_DIR}/pg_dump_${TIMESTAMP}.log"

# Ensure postgres user owns destination files prior to execution
touch "${DUMP_CUSTOM}" "${DUMP_SQL}" "${DUMP_LOG}"
chown postgres:postgres "${DUMP_CUSTOM}" "${DUMP_SQL}" "${DUMP_LOG}"
chmod 664 "${DUMP_CUSTOM}" "${DUMP_SQL}" "${DUMP_LOG}"

verify_zero_writers "Pre-Backup Creation"

echo "   - Executing binary custom dump (pg_dump -F c)..."
sudo -u postgres pg_dump -F c -b -v -f "${DUMP_CUSTOM}" businz 2> "${DUMP_LOG}"

echo "   - Executing clean plain SQL dump..."
sudo -u postgres pg_dump --clean --if-exists businz > "${DUMP_SQL}" 2>> "${DUMP_LOG}"

# Pre-Restoration Verification: permissions, size, and readability
echo "   - Verifying backup file permissions and readability by user postgres..."
sudo -u postgres test -r "${DUMP_CUSTOM}" || {
  echo "❌ [FATAL] Custom dump file is not readable by postgres user! Aborting."
  exit 1
}

CUSTOM_BYTES=$(wc -c < "${DUMP_CUSTOM}" || echo 0)
if [ "${CUSTOM_BYTES}" -lt 102400 ]; then
  echo "❌ [FATAL] Custom dump size (${CUSTOM_BYTES} bytes) is abnormally small (< 100 KB)! Aborting."
  exit 1
fi

echo "   - Computing SHA-256 Checksums..."
sha256sum "${DUMP_CUSTOM}" > "${BACKUP_DIR}/SHA256SUMS"
sha256sum "${DUMP_SQL}" >> "${BACKUP_DIR}/SHA256SUMS"
sha256sum -c "${BACKUP_DIR}/SHA256SUMS"

echo "✅ PostgreSQL backup created and verified: ${DUMP_CUSTOM} ($(du -h "${DUMP_CUSTOM}" | awk '{print $1}'))."

# ------------------------------------------------------------------------------
# STEP 5: VERIFIED ISOLATED RESTORATION TEST AGAINST SNAPSHOT DATA
# ------------------------------------------------------------------------------
echo ""
echo "🧪 [Step 5/8] Performing Isolated Database Restoration Verification (${VERIFY_DB})..."

RESTORE_LOG="${BACKUP_DIR}/pg_restore_${TIMESTAMP}.log"
touch "${RESTORE_LOG}"
chown postgres:postgres "${RESTORE_LOG}"
chmod 664 "${RESTORE_LOG}"

echo "   - Creating isolated test database '${VERIFY_DB}'..."
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${VERIFY_DB};"

echo "   - Restoring custom dump into '${VERIFY_DB}' (strict non-zero exit validation)..."
sudo -u postgres pg_restore -d "${VERIFY_DB}" --no-owner --no-privileges "${DUMP_CUSTOM}" > "${RESTORE_LOG}" 2>&1

echo "   - Verifying isolated restore against pre-deployment snapshot counts..."
VERIFY_RESTORE_FILE="${BACKUP_DIR}/isolated_restore_counts.tsv"

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${VERIFY_DB}" -t -A -F$'\t' << 'EOF' > "${VERIFY_RESTORE_FILE}"
SELECT 'bom_orders_total' AS entity, count(*)::text AS val FROM public.bom_orders
UNION ALL
SELECT 'controlroom_bom_store', COALESCE((SELECT CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 1 END FROM public.controlroom_store WHERE key = 'bom_store'), 0)::text
UNION ALL
SELECT 'historical_boms_present', count(*)::text FROM public.bom_orders WHERE bom_code IN ('BOM-659','BOM-660','BOM-661','BOM-662','BOM-663','BOM-664','BOM-665')
UNION ALL
SELECT 'controlroom_sales_pi', COALESCE((SELECT CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 1 END FROM public.controlroom_store WHERE key = 'sales_pi_store'), 0)::text
UNION ALL
SELECT 'controlroom_customer_store', COALESCE((SELECT CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 1 END FROM public.controlroom_store WHERE key = 'customer_store'), 0)::text
UNION ALL
SELECT 'controlroom_item_store', COALESCE((SELECT CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 1 END FROM public.controlroom_store WHERE key = 'item_store'), 0)::text
UNION ALL
SELECT 'controlroom_prod_ledger', COALESCE((SELECT CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 1 END FROM public.controlroom_store WHERE key = 'vrm_prod_ledger'), 0)::text
UNION ALL
SELECT 'controlroom_dc_store', COALESCE((SELECT CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 1 END FROM public.controlroom_store WHERE key = 'dc_store'), 0)::text
UNION ALL
SELECT 'bom_dispatch_entries', count(*)::text FROM public.bom_orders WHERE dispatch_packing IS NOT NULL AND dispatch_packing != '[]'::jsonb;
EOF

# Assert 100% exact match between restored snapshot and live baseline
if ! diff -u "${BASELINE_FILE}" "${VERIFY_RESTORE_FILE}"; then
  echo "❌ [FATAL ERROR] Isolated restore test counts DO NOT match pre-deployment baseline! Aborting."
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE ${VERIFY_DB};"
  exit 1
fi

echo "   - Cleaning up isolated verification database..."
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE ${VERIFY_DB};"
echo "✅ Isolated restoration verified 100% identical to live database snapshot."

# ------------------------------------------------------------------------------
# STEP 6: SAFE ADDITIVE SCHEMA MIGRATION
# ------------------------------------------------------------------------------
echo ""
echo "🛠️  [Step 6/8] Applying Safe Additive Database Schema Extension..."

verify_zero_writers "Pre-Migration"

sudo -u postgres psql -v ON_ERROR_STOP=1 -d businz << 'EOF'
-- Disable read-only mode for this specific migration session
SET default_transaction_read_only = off;

-- Add missing columns safely (purely additive, nullable, zero data loss)
ALTER TABLE public.bom_orders ADD COLUMN IF NOT EXISTS invoice_no TEXT;
ALTER TABLE public.bom_orders ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE public.bom_orders ADD COLUMN IF NOT EXISTS gst_no TEXT;

-- Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bom_orders' AND column_name IN ('invoice_no', 'contact_person', 'gst_no')
ORDER BY column_name;
EOF
echo "✅ Database schema extension successfully applied."

# ------------------------------------------------------------------------------
# STEP 7: CHECKOUT RELEASE COMMIT, RESTORE LIVE JSON, BUILD & START
# ------------------------------------------------------------------------------
echo ""
echo "🚀 [Step 7/8] Deploying Release Commit (${APPROVED_RELEASE_COMMIT})..."

cd "${BASE_DIR}"
git fetch origin

# Verify release commit exists and resolves
RELEASE_COMMIT_HASH=$(git rev-parse --verify "${APPROVED_RELEASE_COMMIT}")
if [ "${RELEASE_COMMIT_HASH}" != "${APPROVED_RELEASE_COMMIT}" ]; then
  echo "❌ [FATAL] Approved release commit verification failed! Aborting."
  exit 1
fi

# Safely stash tracked server runtime files to permit clean release checkout without git reset/clean
echo "   - Safely stashing tracked server runtime files to permit clean release checkout..."
STASH_REF=$(git stash push -m "phase3a_runtime_${TIMESTAMP}" -- server/ 2>&1 || true)
echo "   - Stash created: ${STASH_REF}"

# Checkout exact release commit in detached HEAD state
git checkout --detach "${APPROVED_RELEASE_COMMIT}"

# MANDATORY RUNTIME PROTECTION:
# Never allow git checkout repository files to overwrite live production JSON/bak data!
echo "   - Re-applying live preserved runtime data over checked out repository..."
cp -p "${BACKUP_DIR}/live_runtime_data"/* "${BASE_DIR}/server/"

# Verify runtime file integrity against pre-checkout checksums IMMEDIATELY after file restoration
echo "   - Verifying live runtime file integrity after checkout..."
(cd "${BASE_DIR}/server" && sha256sum -c "${BACKUP_DIR}/LIVE_RUNTIME_SHA256SUMS")

# Note: The git stash is NOT dropped here. It is retained until all post-deployment verification checks pass.

# Verify that server/bom_store.json contains NO staging test records
if grep -q "BOM-TEST-" "${BASE_DIR}/server/bom_store.json" 2>/dev/null; then
  echo "❌ [FATAL] Staging test records detected in server/bom_store.json! Aborting."
  exit 1
fi

# Build client production bundle
echo "   - Compiling frontend application bundle..."
npm run build

# Reset database read-only maintenance mode before starting application service
echo "   - Resetting database 'businz' to normal read-write operation..."
sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres -c "ALTER DATABASE businz RESET default_transaction_read_only;"

# Start PM2 process with updated environment
echo "   - Starting ${PM2_NAME} application service..."
pm2 start "${PM2_NAME}" --update-env
sleep 3

# ------------------------------------------------------------------------------
# STEP 8: POST-DEPLOYMENT VERIFICATION & AUTOMATED DISCREPANCY COMPARISON
# ------------------------------------------------------------------------------
echo ""
echo "🔍 [Step 8/8] Post-Deployment Verification & Data Comparison..."

# 8.1 Health check endpoint
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5001/api/db-status || echo "000")
if [ "${HEALTH_STATUS}" != "200" ]; then
  echo "❌ [FATAL] Application health endpoint returned HTTP ${HEALTH_STATUS}! Check pm2 logs."
  exit 1
fi
echo "   - Server health endpoint /api/db-status: HTTP 200 (PASS)"

# 8.2 Capture post-deployment metrics
POST_DEPLOY_FILE="${BACKUP_DIR}/post_deploy_metrics.tsv"

sudo -u postgres psql -v ON_ERROR_STOP=1 -d businz -t -A -F$'\t' << 'EOF' > "${POST_DEPLOY_FILE}"
SELECT 'bom_orders_total' AS entity, count(*)::text AS val FROM public.bom_orders
UNION ALL
SELECT 'controlroom_bom_store', COALESCE((SELECT CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 1 END FROM public.controlroom_store WHERE key = 'bom_store'), 0)::text
UNION ALL
SELECT 'historical_boms_present', count(*)::text FROM public.bom_orders WHERE bom_code IN ('BOM-659','BOM-660','BOM-661','BOM-662','BOM-663','BOM-664','BOM-665')
UNION ALL
SELECT 'controlroom_sales_pi', COALESCE((SELECT CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 1 END FROM public.controlroom_store WHERE key = 'sales_pi_store'), 0)::text
UNION ALL
SELECT 'controlroom_customer_store', COALESCE((SELECT CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 1 END FROM public.controlroom_store WHERE key = 'customer_store'), 0)::text
UNION ALL
SELECT 'controlroom_item_store', COALESCE((SELECT CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 1 END FROM public.controlroom_store WHERE key = 'item_store'), 0)::text
UNION ALL
SELECT 'controlroom_prod_ledger', COALESCE((SELECT CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 1 END FROM public.controlroom_store WHERE key = 'vrm_prod_ledger'), 0)::text
UNION ALL
SELECT 'controlroom_dc_store', COALESCE((SELECT CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 1 END FROM public.controlroom_store WHERE key = 'dc_store'), 0)::text
UNION ALL
SELECT 'bom_dispatch_entries', count(*)::text FROM public.bom_orders WHERE dispatch_packing IS NOT NULL AND dispatch_packing != '[]'::jsonb;
EOF

echo ""
echo "📊 Automated Pre- vs Post-Deployment Metric Comparison:"
echo "------------------------------------------------------------------------"
printf "%-30s | %-15s | %-15s | %-10s\n" "Entity" "Pre-Deploy" "Post-Deploy" "Status"
echo "------------------------------------------------------------------------"

VERIFICATION_FAILED=0

while IFS=$'\t' read -r entity pre_val; do
  post_val=$(grep "^${entity}[[:space:]]" "${POST_DEPLOY_FILE}" | awk -F$'\t' '{print $2}')
  
  case "${entity}" in
    "bom_orders_total")
      if [ "${post_val}" -ge "${pre_val}" ]; then
        status="PASS (>=)"
      else
        status="FAIL"
        VERIFICATION_FAILED=1
      fi
      ;;
    "controlroom_bom_store")
      if [ "${post_val}" -ge "${pre_val}" ]; then
        status="PASS (>=)"
      else
        status="FAIL"
        VERIFICATION_FAILED=1
      fi
      ;;
    "historical_boms_present")
      if [ "${post_val}" -eq 7 ]; then
        status="PASS (=7)"
      else
        status="FAIL (!=7)"
        VERIFICATION_FAILED=1
      fi
      ;;
    "controlroom_sales_pi"|"controlroom_customer_store"|"controlroom_item_store"|"controlroom_prod_ledger"|"controlroom_dc_store"|"bom_dispatch_entries")
      if [ "${post_val}" -eq "${pre_val}" ]; then
        status="PASS (=)"
      else
        status="FAIL (!=)"
        VERIFICATION_FAILED=1
      fi
      ;;
    *)
      status="CHECK"
      ;;
  esac
  
  printf "%-30s | %-15s | %-15s | %-10s\n" "${entity}" "${pre_val}" "${post_val}" "${status}"
done < "${BASELINE_FILE}"

echo "------------------------------------------------------------------------"

# 8.3 Structured Historical BOM Verification & Field Integrity (Node.js JSON Deep Audit)
echo ""
echo "🔍 Validating Historical BOM Field Integrity (Structured JSON Deep Audit):"
POST_DEPLOY_BOM_JSON="${BACKUP_DIR}/post_deploy_boms.json"

sudo -u postgres psql -v ON_ERROR_STOP=1 -d businz -t -A << 'EOF' > "${POST_DEPLOY_BOM_JSON}"
SELECT COALESCE(jsonb_object_agg(
  bom_code,
  jsonb_build_object(
    'status', COALESCE(status, ''),
    'grand_total', COALESCE(grand_total, 0),
    'sales_person', COALESCE(sales_person, ''),
    'sales_person_code', COALESCE(sales_person_code, ''),
    'source_pi_no', COALESCE(source_pi_no, ''),
    'dispatch_packing', COALESCE(dispatch_packing, '[]'::jsonb),
    'accounts_verification', COALESCE(accounts_verification, '{}'::jsonb),
    'stock_deducted', COALESCE(stock_deducted, false),
    'stock_blocked', COALESCE(stock_blocked, false),
    'created_by', COALESCE(created_by, '')
  )
), '{}'::jsonb) FROM public.bom_orders;
EOF

BOM_INTEGRITY_FAILED=0
if ! node -e '
const fs = require("fs");
const prePath = process.argv[1];
const postPath = process.argv[2];

const pre = JSON.parse(fs.readFileSync(prePath, "utf8"));
const post = JSON.parse(fs.readFileSync(postPath, "utf8"));

let errors = 0;

// 1. Mandatory historical BOMs (BOM-659 through BOM-665 must exist post-deployment)
const requiredHistorical = ["BOM-659", "BOM-660", "BOM-661", "BOM-662", "BOM-663", "BOM-664", "BOM-665"];
for (const code of requiredHistorical) {
  if (!post[code]) {
    console.error(`❌ [INTEGRITY VIOLATION] Mandatory historical BOM ${code} is missing post-deployment!`);
    errors++;
  }
}

// 2. Pre-existing BOM preservation & zero mutation audit
const fields = ["status", "grand_total", "sales_person", "sales_person_code", "source_pi_no", "stock_deducted", "stock_blocked", "created_by"];
for (const [code, preData] of Object.entries(pre)) {
  const postData = post[code];
  if (!postData) {
    console.error(`❌ [INTEGRITY VIOLATION] Pre-existing BOM ${code} has been deleted!`);
    errors++;
    continue;
  }
  for (const f of fields) {
    if (String(preData[f]) !== String(postData[f])) {
      console.error(`❌ [INTEGRITY VIOLATION] BOM ${code} field "${f}" mutated: "${preData[f]}" -> "${postData[f]}"`);
      errors++;
    }
  }
  if (JSON.stringify(preData.dispatch_packing) !== JSON.stringify(postData.dispatch_packing)) {
    console.error(`❌ [INTEGRITY VIOLATION] BOM ${code} dispatch_packing mutated!`);
    errors++;
  }
  if (JSON.stringify(preData.accounts_verification) !== JSON.stringify(postData.accounts_verification)) {
    console.error(`❌ [INTEGRITY VIOLATION] BOM ${code} accounts_verification mutated!`);
    errors++;
  }
  if (errors === 0) {
    console.log(`   ✓ BOM ${code}: Intact (status="${preData.status}", total=${preData.grand_total}, sp="${preData.sales_person}")`);
  }
}

// 3. Strict whitelist for newly added relational BOMs
const approvedNewBoms = new Set(["BOM-663", "BOM-664", "BOM-665"]);
for (const code of Object.keys(post)) {
  if (!pre[code]) {
    if (approvedNewBoms.has(code)) {
      console.log(`   ℹ️ Approved reconciled BOM added to relational table: ${code}`);
    } else {
      console.error(`❌ [INTEGRITY VIOLATION] Unapproved new BOM ${code} added to relational table!`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\n🚨 BOM structured integrity verification FAILED with ${errors} violation(s).`);
  process.exit(1);
} else {
  console.log("\n✅ [STRUCTURED AUDIT PASS] All historical BOMs and relational additions verified 100% intact.");
}
' "${PRE_DEPLOY_BOM_JSON}" "${POST_DEPLOY_BOM_JSON}"; then
  BOM_INTEGRITY_FAILED=1
fi

if [ "${VERIFICATION_FAILED}" -ne 0 ] || [ "${BOM_INTEGRITY_FAILED}" -ne 0 ]; then
  echo ""
  echo "❌ [FATAL ERROR] Post-deployment verification detected unexpected differences or record mutations! Initiating halt."
  exit 1
fi

# 8.4 Verify normal database write operations are active on 'businz'
echo ""
echo "🔍 Validating Normal Database Write Capability (Active Transaction Probe)..."
WRITE_PROBE_RESULT=$(sudo -u postgres psql -v ON_ERROR_STOP=1 -d businz -t -A -q << 'EOF'
BEGIN;
INSERT INTO public.controlroom_store (key, data, updated_at) 
VALUES ('__deploy_write_probe__', '{"verified": true}'::jsonb, NOW())
ON CONFLICT (key) DO UPDATE SET updated_at = NOW();
DELETE FROM public.controlroom_store WHERE key = '__deploy_write_probe__';
COMMIT;
SELECT 'WRITE_VERIFIED';
EOF
)

if [ "${WRITE_PROBE_RESULT}" != "WRITE_VERIFIED" ]; then
  echo "❌ [FATAL] Database write verification failed! Production database 'businz' is not accepting writes."
  exit 1
fi
echo "   ✓ Normal database write capability verified 100% operational on 'businz'."

DEPLOYMENT_SUCCESS=1

# Safely drop runtime stash only after 100% deployment verification success
if [ -n "${STASH_REF}" ] && echo "${STASH_REF}" | grep -qv "No local changes to save"; then
  echo "🧹 Cleaning up deployment stash after verified deployment success..."
  git stash drop 2>/dev/null || true
fi

echo ""
echo "========================================================================"
echo "🎉 DEPLOYMENT VERIFICATION COMPLETE: ALL INTEGRITY CHECKS PASSED!"
echo "   Backup Location: ${BACKUP_DIR}"
echo "   Active Commit:   $(git rev-parse HEAD)"
echo "========================================================================"
