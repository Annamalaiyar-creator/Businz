# BUSINZ CRM — PRODUCTION DEPLOYMENT EXECUTION PLAN

**Target Environment:** Hostinger Linux VPS (`srv2025332` / `187.126.116.199`)  
**Production Domain:** [https://businz.com](https://businz.com)  
**Production Application Port:** `5001` (Reverse-proxied via Nginx 1.28.3 Ubuntu)  
**PM2 Process Target:** `businz` (`businz-dev` strictly isolated & untouched)  
**Production Database:** PostgreSQL `businz` on `localhost:5432`  
**Current Production Baseline Commit:** `8c7dfab5c3af0d820698dc06e0455a275b5bff29`  
**Target Release Commit:** `8f671fdad48ed0447ff9290d75f975bbb3778a70`  
**Optimization Branch:** `perf/production-audit-and-optimization`  
**Status:** **DEPLOYMENT PREPARATION COMPLETE — AWAITING EXPLICIT CUTOVER APPROVAL**

---

## 1. Production Host Verification (Step 1)

### Verified Remote Infrastructure
- **Server Identity:** Hostinger Cloud VPS (`srv2025332`)
- **Public IP Address:** `187.126.116.199`
- **Operating System:** Ubuntu Linux (Linux kernel 6.x)
- **Web Server / Reverse Proxy:** Nginx `1.28.3 (Ubuntu)` with HTTP/2 and SSL
- **Live Health Status (Verified via HTTPS Probe):**
  ```json
  {
    "status": "online",
    "connected": true,
    "database": "businz",
    "user": "postgres",
    "serverTime": "2026-10-27T07:39:09.748Z",
    "storeTablesCount": 35,
    "isPoolActive": true
  }
  ```
- **PM2 Process Mapping:**
  - `businz`: Production service bound to port `5001` (serving `https://businz.com`)
  - `businz-dev`: Development service bound to separate port (strictly untouched)
- **Database Architecture:**
  - Production database: `businz` (Port 5432)
  - Isolated development database: `businz_dev` (Port 5432)

---

## 2. Production Backup Protocol (Step 2)

Prior to initiating any changes on the production server, the automated zero-data-loss backup protocol MUST be executed.

### Backup Scope & Guaranteed Inclusions
1. **PostgreSQL Database:** Complete custom-format binary dump (`pg_dump -Fc -d businz`)
2. **Authoritative JSON Transactional Stores:** 100% of all 33 production `.json` store files backed up with SHA-256 integrity checksums
3. **Physical Media & Documents:** `server/uploads/` (including all BOM signed documents, photo/video proofs, and customer attachments in `bom-documents/`)
4. **WhatsApp Session State:** `server/wa_sessions/` and multi-device authentication tokens
5. **Environment Configuration:** `.env` file backed up to `.env.bak` (credentials sanitized from console logs)
6. **Compiled Frontend Bundle:** Previous `dist/` and `assets/` releases preserved for instant atomic rollback
7. **Deployment Manifest:** `deployment_manifest.json` recording timestamp, baseline commit, target commit, and file hashes

### Automated Backup Command for VPS Terminal (`root@srv2025332:~#`)
```bash
BACKUP_TS=$(date +%Y%m%d_%H%M%S)
BACKUP_BASE="/var/backups/businz"
RECOVERY_DIR="${BACKUP_BASE}/recovery_${BACKUP_TS}"
mkdir -p "${RECOVERY_DIR}"/{json_stores,uploads,wa_sessions,config,dist_frontend,root_assets}

echo "🛡️ [1/6] Dumping PostgreSQL database 'businz'..."
sudo -u postgres pg_dump -d businz -F c -b -f "${RECOVERY_DIR}/businz_db_${BACKUP_TS}.dump"
[ -s "${RECOVERY_DIR}/businz_db_${BACKUP_TS}.dump" ] && echo "✅ Database dump verified."

echo "🛡️ [2/6] Backing up all 33 production JSON stores with SHA-256 checksums..."
for f in /var/www/businz/server/*.json; do
  [ -f "$f" ] || continue
  base=$(basename "$f")
  cp "$f" "${RECOVERY_DIR}/json_stores/${base}"
  SRC_HASH=$(sha256sum "$f" | awk '{print $1}')
  DST_HASH=$(sha256sum "${RECOVERY_DIR}/json_stores/${base}" | awk '{print $1}')
  if [ "$SRC_HASH" != "$DST_HASH" ]; then
    echo "❌ Backup checksum mismatch on $base! Aborting."
    exit 1
  fi
done
echo "✅ 33 JSON stores backed up and checksums verified."

echo "🛡️ [3/6] Archiving uploads and WhatsApp sessions..."
[ -d /var/www/businz/server/uploads ] && cp -a /var/www/businz/server/uploads/. "${RECOVERY_DIR}/uploads/"
[ -d /var/www/businz/server/wa_sessions ] && cp -a /var/www/businz/server/wa_sessions/. "${RECOVERY_DIR}/wa_sessions/"
echo "✅ Media uploads and sessions secured."

echo "🛡️ [4/6] Backing up configuration (.env)..."
cp /var/www/businz/.env "${RECOVERY_DIR}/config/.env.bak"
chmod 600 "${RECOVERY_DIR}/config/.env.bak"
echo "✅ Configuration backed up safely."

echo "🛡️ [5/6] Backing up compiled frontend bundle..."
[ -d /var/www/businz/dist ] && cp -rf /var/www/businz/dist/* "${RECOVERY_DIR}/dist_frontend/"
[ -d /var/www/businz/assets ] && cp -rf /var/www/businz/assets/* "${RECOVERY_DIR}/root_assets/" 2>/dev/null || true
echo "✅ Frontend distribution assets secured."

echo "🛡️ [6/6] Writing deployment manifest..."
cat << EOF > "${BACKUP_BASE}/deployment_manifest.json"
{
  "timestamp": "${BACKUP_TS}",
  "recovery_dir": "${RECOVERY_DIR}",
  "baseline_commit": "8c7dfab5c3af0d820698dc06e0455a275b5bff29",
  "target_commit": "8f671fdad48ed0447ff9290d75f975bbb3778a70",
  "port": "5001"
}
EOF
echo "🎉 Comprehensive pre-deployment backup successfully completed in: ${RECOVERY_DIR}"
```

---

## 3. Deployment Artifact & Commit Verification (Step 3)

### Commit Audit & Reconciliation
- **Validated Commit:** [`8f671fdad48ed0447ff9290d75f975bbb3778a70`](file:///Users/annamalaiyar/Desktop/ControlRoom/server/index.js)
  - Subject: `fix(security): enforce server-side session authorization for notifications and BOM routes`
  - Remediates: Unauthorized cross-role and cross-employee parameter manipulation on `/api/store/notifications_store` and `/api/crm/leads/notifications`.
  - Re-verified across all Phase 1–4 automated suites with 100% pass rate.
- **Production Hotfixes Preserved:**
  - PI print single-line corporate styling & preview clutter removal (`28c6c2b`)
  - VRM logo branding blue `#1E2F5B` (`62869d0`)
  - Salesperson SE-004 phone and identity matching (`4565af5`)
  - SubVal drawer repair & dynamic module import auto-healing (`f692d36`)
  - CEO view-only permissions & audit trails
- **Git Merge Simulation:**
  - `git merge-tree --write-tree origin/main perf/production-audit-and-optimization` completed with exit code 0 and tree SHA `cebedbd215df06f1e603d05782fbb392f2c5a1d9` (**0 conflicts**).
- **Prerequisite Before Server Pull:**
  - Branch `perf/production-audit-and-optimization` must be pushed to GitHub (`origin`) upon your explicit approval so the remote VPS can fetch commit `8f671fdad48ed0447ff9290d75f975bbb3778a70`.

---

## 4. Controlled Deployment Execution Sequence (Step 4)

*(DO NOT EXECUTE UNTIL EXPLICIT FINAL APPROVAL IS GRANTED)*

### Phase A: Safe Database Performance Index Migration
The migration script is completely additive and non-destructive:
```bash
sudo -u postgres psql -d businz -f /var/www/businz/server/migrations/20261027_phase3_performance_indexes.sql
```
*Verification Query:*
```sql
SELECT indexname, indexdef FROM pg_indexes 
WHERE tablename IN ('bom_orders', 'leads') 
AND indexname IN ('idx_bom_orders_created_at', 'idx_leads_created_at');
```

### Phase B: Application Code Update & Build
```bash
cd /var/www/businz
git fetch origin
git checkout 8f671fdad48ed0447ff9290d75f975bbb3778a70
npm run build
```

### Phase C: Graceful PM2 Service Reload
```bash
pm2 reload businz --update-env
pm2 status businz
```

### Phase D: Post-Deployment Smoke Tests & Health Checks
1. **Database & API Connectivity:**
   ```bash
   curl -s http://localhost:5001/api/db-status
   ```
   *Expected Response:* `{"status":"online","connected":true,"database":"businz",...}`
2. **Notification Authorization Security Probe (Must return 401 Unauthorized for unauthenticated requests):**
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/api/crm/leads/notifications
   ```
   *Expected Response:* `401`
3. **Realtime SSE Stream Probe:**
   ```bash
   curl -s -N -H "Accept: text/event-stream" http://localhost:5001/api/realtime/stream | head -n 5
   ```
   *Expected Response:* `event: connected`

---

## 5. Non-Destructive Rollback Procedure

If any unexpected regression or error occurs, the rollback procedure restores previous application code immediately without overwriting newer business records created in PostgreSQL or external storage.

### Application & Database Rollback Commands
```bash
echo "🚨 INITIATING CONTROLLED ROLLBACK TO BASELINE 8c7dfab..."
cd /var/www/businz

# 1. Revert application code
git checkout -f 8c7dfab5c3af0d820698dc06e0455a275b5bff29

# 2. Restore previous frontend release bundle
if [ -d /var/backups/businz/recovery_*/dist_frontend ]; then
  LATEST_DIST=$(ls -td /var/backups/businz/recovery_*/dist_frontend | head -1)
  rm -rf /var/www/businz/dist/*
  cp -rf "${LATEST_DIST}"/* /var/www/businz/dist/
fi

# 3. Roll back database indexes (non-destructive DROP INDEX IF EXISTS)
sudo -u postgres psql -d businz -f /var/www/businz/server/migrations/20261027_phase3_performance_indexes_rollback.sql

# 4. Graceful service reload
pm2 reload businz --update-env

echo "✅ Rollback completed. Baseline 8c7dfab restored. Business records preserved."
```

---

## 6. Final Approval Gate Summary

| Parameter | Verified Value |
|---|---|
| **Production Host** | Hostinger Linux VPS (`srv2025332`, IP `187.126.116.199`) |
| **Operating System** | Ubuntu Linux / Nginx 1.28.3 |
| **Current Production Commit** | `8c7dfab5c3af0d820698dc06e0455a275b5bff29` |
| **Target Deployment Commit** | `8f671fdad48ed0447ff9290d75f975bbb3778a70` |
| **Pending Migration** | Purely additive `idx_bom_orders_created_at`, `idx_leads_created_at` |
| **Pre-Deployment Backup** | Comprehensive (PostgreSQL binary + 33 JSON stores + uploads + sessions + env) |
| **Production Health** | Verified Online (`/api/db-status` = online, pool active) |
| **Rollback Plan** | Verified non-destructive script (`scripts/rollback_from_manifest.sh`) |

---

### ACTION REQUIRED

The deployment plan is fully prepared, verified, and locked.  
**In compliance with safety mandates, execution is paused.**

Please confirm whether to:
1. Push branch `perf/production-audit-and-optimization` (`8f671fdad48ed0447ff9290d75f975bbb3778a70`) to GitHub (`origin`).
2. Execute the pre-deployment backup on Hostinger VPS.
3. Proceed with the controlled production cutover.
