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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * Resolves the root data directory.
 */
export function getDataDir() {
  if (isExternalStorageActive()) {
    const p = path.resolve(process.env.BUSINZ_DATA_DIR.trim());
    if (!fs.existsSync(p)) {
      try { fs.mkdirSync(p, { recursive: true }); } catch {}
    }
    return p;
  }
  return __dirname;
}

/**
 * Resolves the uploads directory for attachments, photos, videos, and LR docs.
 */
export function getUploadsDir() {
  if (process.env.BUSINZ_UPLOADS_DIR && process.env.BUSINZ_UPLOADS_DIR.trim().length > 0) {
    const p = path.resolve(process.env.BUSINZ_UPLOADS_DIR.trim());
    if (!fs.existsSync(p)) {
      try { fs.mkdirSync(p, { recursive: true }); } catch {}
    }
    return p;
  }
  if (isExternalStorageActive()) {
    const p = path.join(getDataDir(), 'uploads');
    if (!fs.existsSync(p)) {
      try { fs.mkdirSync(p, { recursive: true }); } catch {}
    }
    return p;
  }
  const defaultPath = path.join(__dirname, 'uploads');
  if (!fs.existsSync(defaultPath)) {
    try { fs.mkdirSync(defaultPath, { recursive: true }); } catch {}
  }
  return defaultPath;
}

/**
 * Resolves the BOM documents folder inside uploads.
 */
export function getBomDocumentsDir() {
  const p = path.join(getUploadsDir(), 'bom-documents');
  if (!fs.existsSync(p)) {
    try { fs.mkdirSync(p, { recursive: true }); } catch {}
  }
  return p;
}

/**
 * Resolves the backups directory.
 */
export function getBackupDir() {
  if (process.env.BUSINZ_BACKUP_DIR && process.env.BUSINZ_BACKUP_DIR.trim().length > 0) {
    const p = path.resolve(process.env.BUSINZ_BACKUP_DIR.trim());
    if (!fs.existsSync(p)) {
      try { fs.mkdirSync(p, { recursive: true }); } catch {}
    }
    return p;
  }
  if (isExternalStorageActive()) {
    const p = path.join(getDataDir(), 'backups');
    if (!fs.existsSync(p)) {
      try { fs.mkdirSync(p, { recursive: true }); } catch {}
    }
    return p;
  }
  const defaultPath = path.resolve(__dirname, 'backups');
  if (!fs.existsSync(defaultPath)) {
    try { fs.mkdirSync(defaultPath, { recursive: true }); } catch {}
  }
  return defaultPath;
}

/**
 * Resolves the WhatsApp sessions directory.
 */
export function getWaSessionsDir() {
  if (process.env.BUSINZ_WA_SESSIONS_DIR && process.env.BUSINZ_WA_SESSIONS_DIR.trim().length > 0) {
    const p = path.resolve(process.env.BUSINZ_WA_SESSIONS_DIR.trim());
    if (!fs.existsSync(p)) {
      try { fs.mkdirSync(p, { recursive: true }); } catch {}
    }
    return p;
  }
  if (isExternalStorageActive()) {
    const p = path.join(getDataDir(), 'wa_sessions');
    if (!fs.existsSync(p)) {
      try { fs.mkdirSync(p, { recursive: true }); } catch {}
    }
    return p;
  }
  const defaultPath = path.join(__dirname, 'wa_sessions');
  if (!fs.existsSync(defaultPath)) {
    try { fs.mkdirSync(defaultPath, { recursive: true }); } catch {}
  }
  return defaultPath;
}

/**
 * Resolves the absolute path for any store JSON file.
 * If external storage is active:
 *   - Points to external directory.
 *   - If target file doesn't exist yet, auto-seeds from the repo if legacy file exists.
 *   - NEVER overwrites an existing external store file.
 */
export function getStoreFilePath(filename) {
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
  if (!isExternalStorageActive()) {
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
