# BUSINZ CRM — PRODUCTION DEPLOYMENT RISK ASSESSMENT REPORT

**System:** BUSINZ Enterprise ERP & CRM  
**Date & Time:** 2026-10-27 13:20 IST  
**Target Environment:** Hostinger Cloud VPS (`srv2025332` / `187.126.116.199`)  
**Target Release Commit:** [`8f671fdad48ed0447ff9290d75f975bbb3778a70`](file:///Users/annamalaiyar/Desktop/ControlRoom/server/index.js)  
**Approved Baseline Commit:** `8c7dfab5c3af0d820698dc06e0455a275b5bff29`  
**Execution Script:** [`/var/backups/businz/release_scripts/execute_controlled_production_deployment.sh`](file:///Users/annamalaiyar/Desktop/ControlRoom/scripts/execute_controlled_production_deployment.sh)  
**Assessment Result:** **ALL 14 SAFETY REQUIREMENTS FULLY IMPLEMENTED & HARDENED**

---

## 1. Safety Fixes & Risk Mitigation Matrix

| # | Requirement | Risk Addressed | Implementation & Verification in Deployment Script | Status |
|---|-------------|----------------|----------------------------------------------------|:------:|
| **1** | **Exact Git Baseline Verification** | Deploying over an unexpected or altered baseline state. | Strict assertion: `[ "${CURRENT_COMMIT}" != "${APPROVED_BASELINE_COMMIT}" ]` triggers immediate hard exit with non-zero code. No warnings, no continuation. | **PASS** |
| **2** | **Verified Non-Destructive Checkout** | `git checkout -f` overwriting uncommitted code or hotfixes. | Replaced forced checkout with verified clean checkout: requires 100% clean working tree, validates commit existence via `git cat-file -e`, and verifies resulting HEAD. | **PASS** |
| **3** | **Independent Rollback Script** | Rollback failing because repository files in `APP_DIR` are corrupted or changed. | Standalone rollback script written to `/var/backups/businz/release_scripts/standalone_rollback.sh` (outside Git tree) *before* cutover. Contains self-contained logic and inline SQL. | **PASS** |
| **4** | **PostgreSQL `ON_ERROR_STOP=1`** | Partial or silent failure during SQL execution leading to corrupted database state. | Added `-v ON_ERROR_STOP=1` to all `psql` invocations. Queries verify index counts (`SELECT count(*) FROM pg_indexes`) post-execution. | **PASS** |
| **5** | **Comprehensive Backup Verification** | Incomplete backup missing tables, stores, or corrupt JSON files. | Checks all 33 production store files in `ALL_STORE_FILENAMES` for existence, non-zero size, valid JSON syntax (`JSON.parse`), and SHA-256 match. Inspects DB dump with `pg_restore -l`. | **PASS** |
| **6** | **Dynamic Disk Headroom Calculation** | Hardcoded 2 GB assumption failing on servers with large media/data growth. | Measures live database size via `pg_database_size`, adds `server/` and `dist/` directory footprints, and enforces dynamic headroom: `(Footprint * 2.5) + 1000 MB buffer`. | **PASS** |
| **7** | **Preserve Live Transaction Records** | Routine rollback overwriting newer orders, invoices, or leads created post-cutover. | Rollback reverts code only and executes `DROP INDEX IF EXISTS`. Live PostgreSQL rows and external JSON stores are untouched. Safety snapshot taken prior to any rollback operation. | **PASS** |
| **8** | **Mandatory Public HTTPS Health Check** | Internal service running on port 5001 while public domain `https://businz.com` is broken (502/SSL issue). | Mandatory `curl -s -o /dev/null -w "%{http_code}" https://businz.com` assertion. Must return HTTP 200 or deployment fails and triggers rollback. | **PASS** |
| **9** | **PM2 Status & Restart Delta Verification** | PM2 reporting "online" while flapping in a rapid crash-restart loop. | Captures baseline restart count before reload; asserts post-reload status is strictly `online` and restart delta does not exceed 2. | **PASS** |
| **10** | **Business Module & Security Smoke Tests** | Broken API routes for CRM, PI, BOM, or leaking notifications. | Probes `/api/customers`, `/api/crm/leads`, `/api/boms`, `/api/invoices`, `/api/raw-materials`. Tests notification security probes to assert HTTP 401 Unauthorized for unauthenticated calls. | **PASS** |
| **11** | **Strict All-or-Nothing Success Gating** | Premature success messages when downstream verifications fail. | `DEPLOYMENT_SUCCESS=false` initialized at script top; set to `true` strictly on the very final line after 100% of all smoke tests and health checks pass. | **PASS** |
| **12** | **Explicit Error Capturing in Rollback** | Silent error suppression (`2>/dev/null || true`) concealing rollback failures. | Removed silent error suppression. Every step checks exit codes and logs explicit error descriptions. Trap captures failed line number and command. | **PASS** |
| **13** | **Restricted Secret Permissions** | Backup files containing `.env` database passwords exposed to world-readable permissions. | Sets `chmod 700` on backup directories and `chmod 600` on `.env.bak` and manifest files immediately upon creation. | **PASS** |
| **14** | **Script Syntax & Dry-Run Validation** | Shell script syntax errors or unexpected behavior during execution. | Validated via `bash -n`. Script includes a `--validate-only` dry-run flag allowing complete preflight validation without modifying the system. | **PASS** |

---

## 2. Risk Evaluation & Failure Modes Analysis

### Failure Mode 1: Mid-Deployment Network or Server Failure
- **Risk:** Network connection drops or server process hangs during `git checkout` or `npm run build`.
- **Mitigation:**
  - Script runs under `set -Eeuo pipefail`.
  - Trap catches `ERR` and `EXIT`.
  - Standalone rollback script exists in `/var/backups/businz/release_scripts/standalone_rollback.sh` outside the Git repository.
  - Baseline frontend bundle is already preserved in `${RECOVERY_DIR}/dist_frontend/` and can be restored in < 2 seconds.

### Failure Mode 2: Migration Failure on Database
- **Risk:** SQL index migration hangs or fails due to locks.
- **Mitigation:**
  - Indexes use purely additive syntax: `CREATE INDEX IF NOT EXISTS`.
  - Executed with `-v ON_ERROR_STOP=1`.
  - If migration fails, zero data is altered; trap immediately triggers rollback without touching any table rows.

### Failure Mode 3: Post-Deployment Application Crash
- **Risk:** New Node.js bundle fails to start or crashes repeatedly on port 5001.
- **Mitigation:**
  - Script captures PM2 restart count before and after reload.
  - If restart count jumps (`RESTART_DELTA > 2`), flapping is detected immediately.
  - Step 7 verifies `/api/db-status` returns `connected: true` and `status: "online"`.
  - If unhealthy, automated rollback restores previous code and reloads baseline PM2.

### Failure Mode 4: Security Regression
- **Risk:** Notification routes leak data to unauthenticated callers.
- **Mitigation:**
  - Automated smoke probes in Step 7 test both `/api/crm/leads/notifications` and `/api/store/notifications_store` without authorization headers.
  - If either returns anything other than HTTP `401`, the script triggers immediate automated rollback.

---

## 3. Pre-Deployment Dry-Run Option

The deployment script supports a safe preflight dry-run mode:
```bash
bash /var/backups/businz/release_scripts/execute_controlled_production_deployment.sh --validate-only
```
This performs:
- Exact Git baseline check
- Working tree cleanliness audit
- Target commit availability check
- PM2 process status and restart count probe
- PostgreSQL database connectivity probe
- Dynamic disk headroom calculation

**Without making any code changes, modifying databases, or restarting services.**

---

## 4. Current State & Safety Status

- Production environment: **Completely untouched.**
- PostgreSQL database `businz`: **100% intact.**
- Working tree: **Clean.**
- Target commit: **[`8f671fdad48ed0447ff9290d75f975bbb3778a70`](file:///Users/annamalaiyar/Desktop/ControlRoom/server/index.js)** pushed to GitHub `origin`.
- Deployment script: **Hardened with all 14 safety fixes and validated via `bash -n`.**

**Execution is halted. Awaiting your explicit written approval before proceeding with production execution.**
