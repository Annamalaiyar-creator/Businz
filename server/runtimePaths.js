/**
 * server/runtimePaths.js
 * 
 * BUSINZ ERP: Centralized Persistent Runtime Storage & External Path Resolution
 * 
 * Protects runtime JSON stores, physical uploads, backups, and sessions from
 * being overwritten or wiped by Git operations (checkout, pull, merge, reset, clean).
 * 
 * Guarantees:
 * 1. If BUSINZ_DATA_DIR is configured, all business state is decoupled from the Git working tree.
 * 2. Non-destructive auto-seed: Existing store files are seeded into external storage on first boot
 *    if absent, but existing external data is NEVER overwritten by older repo snapshots.
 * 3. 100% backward-compatible: If BUSINZ_DATA_DIR is not set, seamlessly falls back to legacy paths.
 * 4. Zero business logic, permissions, workflow, or schema changes.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  isOptimizationTestMode,
  validateStorageConfigForTestMode,
  isPathInsideApprovedStorage,
  checkSymlinkRedirection,
  APPROVED_TEST_STORAGE_ROOT
} from './optimizationTestGuard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Safely ensures a directory exists.
 * In test mode, strictly rejects directory creation outside APPROVED_TEST_STORAGE_ROOT
 * or through symlinks that escape the approved test root.
 */
function safeEnsureDir(dirPath) {
  const resolved = path.resolve(dirPath);
  if (isOptimizationTestMode()) {
    if (!isPathInsideApprovedStorage(resolved, APPROVED_TEST_STORAGE_ROOT)) {
      throw new Error(`[STORAGE-FAIL-CLOSED] Refusing to create or access directory outside approved test storage: "${resolved}"`);
    }
    checkSymlinkRedirection(resolved, APPROVED_TEST_STORAGE_ROOT);
  }
  if (!fs.existsSync(resolved)) {
    try {
      fs.mkdirSync(resolved, { recursive: true });
    } catch (err) {
      if (isOptimizationTestMode()) {
        throw new Error(`[STORAGE-FAIL-CLOSED] Failed to safely create approved test directory "${resolved}": ${err.message}`);
      }
    }
  }
  return resolved;
}

// All known live business transaction and application JSON stores
export const ALL_STORE_FILENAMES = [
  'bom_store.json',
  'sales_pi_store.json',
  'proforma_invoice_store.json',
  'procurement_pi_store.json',
  'po_store.json',
  'grn_store.json',
  'invoice_store.json',
  'dc_store.json',
  'customer_store.json',
  'crm_customers.json',
  'crm_leads.json',
  'crm_opportunities.json',
  'crm_quotations.json',
  'crm_whatsapp_conversations.json',
  'raw_materials_store.json',
  'deleted_raw_materials_store.json',
  'item_store.json',
  'workorder_store.json',
  'vrm_prod_workorders.json',
  'vrm_prod_inventory.json',
  'vrm_prod_ledger.json',
  'vrm_prod_recipes.json',
  'vendor_store.json',
  'payment_store.json',
  'employees_store.json',
  'presets_store.json',
  'company_branding_store.json',
  'zoho_config.json',
  'notifications_store.json',
  'ceo_target_store.json',
  'media_cache.json'
];

/**
 * Returns whether external persistent storage is active.
 */
export function isExternalStorageActive() {
  return Boolean(process.env.BUSINZ_DATA_DIR && process.env.BUSINZ_DATA_DIR.trim().length > 0);
}

/**
 * Resolves the maintenance flag file location.
 * Checks external persistent storage directory, current working directory, and server directory.
 */
export function getMaintenanceFlagPath() {
  if (isOptimizationTestMode()) {
    validateStorageConfigForTestMode();
    return path.join(getDataDir(), 'maintenance.flag');
  }
  if (isExternalStorageActive()) {
    return path.join(getDataDir(), 'maintenance.flag');
  }
  const rootFlag = path.resolve(process.cwd(), 'maintenance.flag');
  const serverFlag = path.resolve(__dirname, 'maintenance.flag');
  if (fs.existsSync(rootFlag)) return rootFlag;
  if (fs.existsSync(serverFlag)) return serverFlag;
  return rootFlag;
}

/**
 * Authoritative check for maintenance mode.
 * Survives process restarts by reading the disk flag.
 */
export function isMaintenanceModeActive() {
  if (global.__BUSINZ_MAINTENANCE_MODE === true) return true;
  if (process.env.BUSINZ_MAINTENANCE_MODE === 'true') return true;
  try {
    const flagPath = getMaintenanceFlagPath();
    if (fs.existsSync(flagPath)) {
      const stats = fs.statSync(flagPath);
      if (stats.isFile()) return true;
    }
    // In optimization test mode, do not probe outside approved storage
    if (isOptimizationTestMode()) return false;

    const cwdFlag = path.resolve(process.cwd(), 'maintenance.flag');
    if (fs.existsSync(cwdFlag) && fs.statSync(cwdFlag).isFile()) return true;
    const srvFlag = path.resolve(__dirname, 'maintenance.flag');
    if (fs.existsSync(srvFlag) && fs.statSync(srvFlag).isFile()) return true;
  } catch (_) {}
  return false;
}

/**
 * Resolves the root data directory.
 */
export function getDataDir() {
  if (isOptimizationTestMode()) {
    validateStorageConfigForTestMode();
    const p = path.resolve((process.env.BUSINZ_DATA_DIR || '').trim());
    return safeEnsureDir(p);
  }
  if (isExternalStorageActive()) {
    const p = path.resolve(process.env.BUSINZ_DATA_DIR.trim());
    return safeEnsureDir(p);
  }
  return __dirname;
}

/**
 * Resolves the uploads directory for attachments, photos, videos, and LR docs.
 */
export function getUploadsDir() {
  if (isOptimizationTestMode()) {
    validateStorageConfigForTestMode();
    const p = process.env.BUSINZ_UPLOADS_DIR && process.env.BUSINZ_UPLOADS_DIR.trim().length > 0
      ? path.resolve(process.env.BUSINZ_UPLOADS_DIR.trim())
      : path.join(getDataDir(), 'uploads');
    return safeEnsureDir(p);
  }
  if (process.env.BUSINZ_UPLOADS_DIR && process.env.BUSINZ_UPLOADS_DIR.trim().length > 0) {
    const p = path.resolve(process.env.BUSINZ_UPLOADS_DIR.trim());
    return safeEnsureDir(p);
  }
  if (isExternalStorageActive()) {
    const p = path.join(getDataDir(), 'uploads');
    return safeEnsureDir(p);
  }
  const defaultPath = path.join(__dirname, 'uploads');
  return safeEnsureDir(defaultPath);
}

/**
 * Resolves the BOM documents folder inside uploads.
 */
export function getBomDocumentsDir() {
  const p = path.join(getUploadsDir(), 'bom-documents');
  return safeEnsureDir(p);
}

/**
 * Resolves the backups directory.
 */
export function getBackupDir() {
  if (isOptimizationTestMode()) {
    validateStorageConfigForTestMode();
    const p = process.env.BUSINZ_BACKUP_DIR && process.env.BUSINZ_BACKUP_DIR.trim().length > 0
      ? path.resolve(process.env.BUSINZ_BACKUP_DIR.trim())
      : path.join(getDataDir(), 'backups');
    return safeEnsureDir(p);
  }
  if (process.env.BUSINZ_BACKUP_DIR && process.env.BUSINZ_BACKUP_DIR.trim().length > 0) {
    const p = path.resolve(process.env.BUSINZ_BACKUP_DIR.trim());
    return safeEnsureDir(p);
  }
  if (isExternalStorageActive()) {
    const p = path.join(getDataDir(), 'backups');
    return safeEnsureDir(p);
  }
  const defaultPath = path.resolve(__dirname, 'backups');
  return safeEnsureDir(defaultPath);
}

/**
 * Resolves the WhatsApp sessions directory.
 */
export function getWaSessionsDir() {
  if (isOptimizationTestMode()) {
    validateStorageConfigForTestMode();
    const p = process.env.BUSINZ_WA_SESSIONS_DIR && process.env.BUSINZ_WA_SESSIONS_DIR.trim().length > 0
      ? path.resolve(process.env.BUSINZ_WA_SESSIONS_DIR.trim())
      : path.join(getDataDir(), 'wa_sessions');
    return safeEnsureDir(p);
  }
  if (process.env.BUSINZ_WA_SESSIONS_DIR && process.env.BUSINZ_WA_SESSIONS_DIR.trim().length > 0) {
    const p = path.resolve(process.env.BUSINZ_WA_SESSIONS_DIR.trim());
    return safeEnsureDir(p);
  }
  if (isExternalStorageActive()) {
    const p = path.join(getDataDir(), 'wa_sessions');
    return safeEnsureDir(p);
  }
  const defaultPath = path.join(__dirname, 'wa_sessions');
  return safeEnsureDir(defaultPath);
}

/**
 * Resolves the absolute path for any store JSON file.
 * If external storage is active:
 *   - Points to external directory.
 *   - If target file doesn't exist yet, auto-seeds from the repo if legacy file exists.
 *   - NEVER overwrites an existing external store file.
 */
export function getStoreFilePath(filename) {
  if (isOptimizationTestMode()) {
    validateStorageConfigForTestMode();
    const dataDir = getDataDir();
    const targetPath = path.join(dataDir, filename);
    if (!isPathInsideApprovedStorage(targetPath, APPROVED_TEST_STORAGE_ROOT)) {
      throw new Error(`[STORAGE-FAIL-CLOSED] Store path "${targetPath}" is outside approved test storage "${APPROVED_TEST_STORAGE_ROOT}".`);
    }
    checkSymlinkRedirection(targetPath, APPROVED_TEST_STORAGE_ROOT);
    return targetPath;
  }

  if (isExternalStorageActive()) {
    const dataDir = getDataDir();
    const targetPath = path.join(dataDir, filename);

    // If already exists in external storage, use it immediately (never overwrite with repo file)
    if (fs.existsSync(targetPath)) {
      return targetPath;
    }

    // Auto-seed from legacy repo file on first boot if legacy file exists
    const legacyPath = path.join(__dirname, filename);
    if (fs.existsSync(legacyPath)) {
      try {
        fs.copyFileSync(legacyPath, targetPath);
        console.log(`🛡️ [RuntimePaths] Seeded legacy store "${filename}" to external persistent storage: ${targetPath}`);
      } catch (copyErr) {
        console.warn(`⚠️ [RuntimePaths] Could not auto-seed ${filename}:`, copyErr.message);
      }
    }
    return targetPath;
  }

  // Legacy fallback resolution order (exact match to historical server/index.js)
  const p1 = path.join(__dirname, filename);
  if (fs.existsSync(p1)) return p1;
  const p2 = path.resolve(process.cwd(), 'server', filename);
  if (fs.existsSync(p2)) return p2;
  const p3 = path.resolve(process.cwd(), filename);
  if (fs.existsSync(p3)) return p3;
  return p1;
}

/**
 * Recursively copies a directory tree without overwriting existing files in destination.
 */
function copyDirRecursiveNonDestructive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursiveNonDestructive(srcPath, destPath);
    } else if (entry.isFile()) {
      if (!fs.existsSync(destPath)) {
        try {
          fs.copyFileSync(srcPath, destPath);
        } catch {}
      }
    }
  }
}

/**
 * Initializes external storage and auto-seeds all stores & attachments safely.
 */
export function initRuntimeStorage() {
  if (isOptimizationTestMode()) {
    validateStorageConfigForTestMode();
  }

  if (!isExternalStorageActive()) {
    if (isOptimizationTestMode()) {
      throw new Error('[TEST-MODE-FAIL-CLOSED] Optimization test mode requires external isolated storage.');
    }
    return {
      active: false,
      mode: 'in-tree',
      dataDir: __dirname,
      uploadsDir: path.join(__dirname, 'uploads'),
      backupsDir: path.resolve(__dirname, 'backups')
    };
  }

  const dataDir = getDataDir();
  const uploadsDir = getUploadsDir();
  const bomDocsDir = getBomDocumentsDir();
  const backupsDir = getBackupDir();
  const waSessionsDir = getWaSessionsDir();

  let seededStores = 0;
  for (const file of ALL_STORE_FILENAMES) {
    const target = path.join(dataDir, file);
    if (!fs.existsSync(target)) {
      const src = path.join(__dirname, file);
      if (fs.existsSync(src)) {
        try {
          fs.copyFileSync(src, target);
          seededStores++;
        } catch (err) {
          console.warn(`[RuntimePaths] Failed to seed ${file}:`, err.message);
        }
      }
    }
  }

  // Seed existing bom-documents if external uploads folder is missing them
  const legacyBomDocs = path.join(__dirname, 'uploads', 'bom-documents');
  if (fs.existsSync(legacyBomDocs)) {
    copyDirRecursiveNonDestructive(legacyBomDocs, bomDocsDir);
  }

  console.log(`🛡️ [RuntimePaths] External Persistent Storage Active:`);
  console.log(`   - Data Dir:    ${dataDir} (${seededStores} stores seeded on init)`);
  console.log(`   - Uploads:     ${uploadsDir}`);
  console.log(`   - Backups:     ${backupsDir}`);
  console.log(`   - WA Sessions: ${waSessionsDir}`);

  return {
    active: true,
    mode: 'external-persistent',
    dataDir,
    uploadsDir,
    backupsDir,
    waSessionsDir,
    seededStores
  };
}
