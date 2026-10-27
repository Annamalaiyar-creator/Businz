import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBackupDir, getStoreFilePath } from './runtimePaths.js';
import { recordJobStart, recordJobEnd } from './memoryDiagnostics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = getBackupDir();

// Ensure backups directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  } catch (err) {
    console.error('[BackupEngine] Failed to create backup dir:', err.message);
  }
}

// All ERP data stores
export const ALL_STORE_KEYS = [
  'bom_store', 'po_store', 'item_store', 'raw_materials_store',
  'customer_store', 'vendor_store', 'employees_store', 'invoice_store',
  'sales_pi_store', 'proforma_invoice_store', 'payment_store',
  'company_branding_store', 'presets_store', 'workorder_store',
  'grn_store', 'quotations_store', 'notifications_store',
  'crm_leads', 'crm_customers', 'crm_opportunities', 'crm_quotations',
  'crm_whatsapp_conversations', 'vrm_prod_inventory', 'vrm_prod_recipes',
  'vrm_prod_ledger', 'vrm_prod_workorders'
];

/**
 * Format bytes to readable string (e.g. 4.2 MB)
 */
export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Capture full unified snapshot: Database Stores + Supabase cloud tables + Media Cache
 */
export async function createFullBackup({ supabaseClient, memoryStore = {}, triggeredBy = 'System Admin' } = {}) {
  const timestamp = new Date().toISOString();
  const fileDateStr = timestamp.replace(/[:.]/g, '-');
  const filename = `controlroom_backup_${fileDateStr}.json`;
  const backupFilePath = path.join(BACKUP_DIR, filename);

  console.log(`\n🛡️ [BackupEngine] Starting Full ERP & Media Backup (${timestamp})...`);

  const backupData = {
    system: 'Control Room Enterprise ERP',
    version: '2.5.0',
    backupId: `BKP-${Date.now()}`,
    createdAt: timestamp,
    triggeredBy,
    metadata: {
      totalStores: 0,
      totalRecords: 0,
      mediaCount: 0,
      mediaSizeBytes: 0,
      mediaSizeFormatted: '0 Bytes',
      backupSizeBytes: 0,
      backupSizeFormatted: '0 Bytes'
    },
    stores: {},
    media: {},
    cloudUsers: []
  };

  let totalRecords = 0;

  // 1. Collect Structured Stores (from Memory, Disk & Supabase)
  for (const key of ALL_STORE_KEYS) {
    let data = null;

    // A. Check memory cache
    if (memoryStore[key] && Array.isArray(memoryStore[key]) && memoryStore[key].length > 0) {
      data = memoryStore[key];
    }

    // B. Check server disk file
    if (!data) {
      const diskPath = getStoreFilePath(`${key}.json`);
      if (fs.existsSync(diskPath)) {
        try {
          data = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
        } catch (_) {}
      }
    }

    // C. Check Supabase 'leaves' table if available
    if ((!data || (Array.isArray(data) && data.length === 0)) && supabaseClient) {
      try {
        const { data: records } = await supabaseClient
          .from('leaves')
          .select('reason')
          .eq('employee', key.toUpperCase())
          .order('id', { ascending: false })
          .limit(1);

        if (records && records.length > 0 && records[0].reason) {
          data = JSON.parse(records[0].reason);
        }
      } catch (_) {}
    }

    const finalData = data !== null && data !== undefined ? data : [];
    backupData.stores[key] = finalData;

    if (Array.isArray(finalData)) {
      totalRecords += finalData.length;
    } else if (typeof finalData === 'object') {
      totalRecords += Object.keys(finalData).length;
    }
  }

  // 2. Fetch Supabase users table (Employee credentials & roles)
  if (supabaseClient) {
    try {
      const { data: users, error } = await supabaseClient.from('users').select('*');
      if (!error && Array.isArray(users)) {
        backupData.cloudUsers = users;
        console.log(`[BackupEngine] Captured ${users.length} user accounts from Supabase`);
      }
    } catch (e) {
      console.warn('[BackupEngine] Failed to snapshot cloud users:', e.message);
    }
  }

  // 3. Collect Media Cache (All PDFs, images, proof documents, datasheets)
  let mediaCache = {};
  let mediaSizeBytes = 0;
  const mediaPath = getStoreFilePath('media_cache.json');
  if (fs.existsSync(mediaPath)) {
    try {
      const mediaStat = fs.statSync(mediaPath);
      mediaSizeBytes = mediaStat.size;
      mediaCache = JSON.parse(fs.readFileSync(mediaPath, 'utf8'));
    } catch (_) {}
  }
  backupData.media = mediaCache;
  const mediaKeys = Object.keys(mediaCache);

  // 4. Update metadata
  backupData.metadata.totalStores = Object.keys(backupData.stores).length;
  backupData.metadata.totalRecords = totalRecords;
  backupData.metadata.mediaCount = mediaKeys.length;
  backupData.metadata.mediaSizeBytes = mediaSizeBytes;
  backupData.metadata.mediaSizeFormatted = formatBytes(mediaSizeBytes);

  const jobStartTime = recordJobStart('backupEngine');

  try {
    // 5. Serialize and stream directly to disk incrementally to prevent giant contiguous JSON string buffers in V8 heap
    const writeStream = fs.createWriteStream(backupFilePath, { encoding: 'utf8' });

    const preamble = {
      system: backupData.system,
      version: backupData.version,
      backupId: backupData.backupId,
      createdAt: backupData.createdAt,
      triggeredBy: backupData.triggeredBy,
      metadata: backupData.metadata
    };

    let preambleStr = JSON.stringify(preamble, null, 2);
    // Remove trailing closing brace to open envelope
    preambleStr = preambleStr.slice(0, preambleStr.lastIndexOf('}'));
    writeStream.write(preambleStr + ',\n  "stores": {\n');

    const storeKeys = Object.keys(backupData.stores);
    for (let i = 0; i < storeKeys.length; i++) {
      const k = storeKeys[i];
      const isLast = i === storeKeys.length - 1;
      const serializedStore = JSON.stringify(backupData.stores[k], null, 2);
      const indented = serializedStore.replace(/\n/g, '\n    ');
      writeStream.write(`    "${k}": ${indented}${isLast ? '' : ','}\n`);
      // Immediately release in-memory copy for this store
      backupData.stores[k] = null;
    }
    writeStream.write('  },\n');
    backupData.stores = null;

    // Stream media cache and immediately release
    writeStream.write('  "media": ');
    const serializedMedia = JSON.stringify(backupData.media || {}, null, 2);
    writeStream.write(serializedMedia.replace(/\n/g, '\n  '));
    writeStream.write(',\n');
    backupData.media = null;
    mediaCache = null;

    // Stream cloud users and finalize envelope
    writeStream.write(`  "cloudUsers": ${JSON.stringify(backupData.cloudUsers || [], null, 2).replace(/\n/g, '\n  ')}\n}\n`);

    await new Promise((resolve, reject) => {
      writeStream.end((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const finalStat = fs.statSync(backupFilePath);
    backupData.metadata.backupSizeBytes = finalStat.size;
    backupData.metadata.backupSizeFormatted = formatBytes(finalStat.size);

    console.log(`✅ [BackupEngine] Backup successfully written to ${filename}`);
    console.log(`   Stores: ${backupData.metadata.totalStores} | Records: ${totalRecords} | Media: ${mediaKeys.length} files (${backupData.metadata.mediaSizeFormatted}) | Total: ${backupData.metadata.backupSizeFormatted}\n`);

    // 6. Prune old backups (keep latest 15)
    pruneOldBackups(15);

    return {
      success: true,
      filename,
      filePath: backupFilePath,
      metadata: backupData.metadata,
      createdAt: timestamp
    };
  } finally {
    recordJobEnd('backupEngine', jobStartTime);
  }
}

/**
 * Lightweight header reader: extracts metadata and timestamp using multi-stage probing
 * (4KB fast-path -> 64KB extended -> 32KB tail probe).
 * Guarantees zero full-file buffering and never silently omits valid backups.
 */
export function readBackupHeader(fullPath) {
  let fd = null;
  try {
    const stat = fs.statSync(fullPath);
    const fileSize = stat.size;
    fd = fs.openSync(fullPath, 'r');

    let metadata = {
      totalRecords: '—',
      mediaCount: '—',
      mediaSizeFormatted: '—'
    };
    let createdAt = null;

    const extractFields = (text) => {
      if (!createdAt) {
        const createdMatch = text.match(/"createdAt"\s*:\s*"([^"]+)"/);
        if (createdMatch) {
          createdAt = createdMatch[1];
        } else {
          const bkpMatch = text.match(/"backupId"\s*:\s*"BKP-(\d+)"/);
          if (bkpMatch) {
            try {
              createdAt = new Date(Number(bkpMatch[1])).toISOString();
            } catch (_) {}
          }
        }
      }

      if (metadata.totalRecords === '—') {
        const metaMatch = text.match(/"metadata"\s*:\s*\{([^}]+)\}/);
        if (metaMatch) {
          try {
            const parsedMeta = JSON.parse(`{${metaMatch[1]}}`);
            metadata = { ...metadata, ...parsedMeta };
          } catch (_) {}
        }
      }
    };

    // Stage 1: Probe first 4096 bytes (Fast path for standard backups)
    const initialSize = Math.min(4096, fileSize);
    const buf4k = Buffer.alloc(initialSize);
    const read1 = fs.readSync(fd, buf4k, 0, initialSize, 0);
    extractFields(buf4k.toString('utf8', 0, read1));

    // Stage 2: If metadata or createdAt missing, probe up to 64KB from head
    if ((metadata.totalRecords === '—' || !createdAt) && fileSize > 4096) {
      const probeSize = Math.min(65536, fileSize);
      const buf64k = Buffer.alloc(probeSize);
      const read2 = fs.readSync(fd, buf64k, 0, probeSize, 0);
      extractFields(buf64k.toString('utf8', 0, read2));
    }

    // Stage 3: If metadata still missing and file is large, probe the tail 32KB
    // (covers cases where metadata is appended at the end of the JSON object)
    if (metadata.totalRecords === '—' && fileSize > 65536) {
      const tailSize = Math.min(32768, fileSize);
      const tailOffset = fileSize - tailSize;
      const bufTail = Buffer.alloc(tailSize);
      const read3 = fs.readSync(fd, bufTail, 0, tailSize, tailOffset);
      extractFields(bufTail.toString('utf8', 0, read3));
    }

    return { metadata, createdAt };
  } catch (_) {
    return {
      metadata: { totalRecords: '—', mediaCount: '—', mediaSizeFormatted: '—' },
      createdAt: null
    };
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch (_) {}
    }
  }
}

/**
 * List all available backups using lightweight header streaming (Zero full-file buffering)
 * Guarantees that valid backups are never silently omitted.
 */
export function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json') && (f.startsWith('controlroom_backup_') || f.startsWith('businz_backup_') || f.includes('backup')))
      .sort()
      .reverse();

    return files.map(file => {
      const fullPath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(fullPath);
      const { metadata, createdAt } = readBackupHeader(fullPath);

      return {
        filename: file,
        sizeBytes: stat.size,
        sizeFormatted: formatBytes(stat.size),
        createdAt: createdAt || stat.mtime.toISOString(),
        totalRecords: metadata.totalRecords || '—',
        mediaCount: metadata.mediaCount || '—',
        mediaSizeFormatted: metadata.mediaSizeFormatted || '—'
      };
    });
  } catch (err) {
    console.error('[BackupEngine] Failed to list backups:', err.message);
    return [];
  }
}

/**
 * Delete older backups exceeding keepCount
 */
export function pruneOldBackups(keepCount = 15) {
  try {
    const backups = listBackups();
    if (backups.length > keepCount) {
      const excess = backups.slice(keepCount);
      excess.forEach(b => {
        try {
          const p = path.join(BACKUP_DIR, b.filename);
          if (fs.existsSync(p)) fs.unlinkSync(p);
          console.log(`[BackupEngine] Pruned old backup: ${b.filename}`);
        } catch (_) {}
      });
    }
  } catch (e) {}
}

/**
 * Restore ERP state from a backup object
 */
export async function restoreFromBackup(backupData, { supabaseClient, memoryStore = {} } = {}) {
  if (!backupData || typeof backupData !== 'object') {
    throw new Error('Invalid backup file structure.');
  }

  if (!backupData.stores || typeof backupData.stores !== 'object') {
    throw new Error('Backup file missing required "stores" payload.');
  }

  console.log(`\n⚠️ [BackupEngine] RESTORING DATABASE from backup created on: ${backupData.createdAt || 'Unknown'}`);

  const restoredStores = [];

  // 1. Restore each store to disk and memory
  for (const [storeKey, storeValue] of Object.entries(backupData.stores)) {
    try {
      // Memory store
      memoryStore[storeKey] = storeValue;

      // Disk file
      const diskPath = getStoreFilePath(`${storeKey}.json`);
      fs.writeFileSync(diskPath, JSON.stringify(storeValue, null, 2), 'utf8');

      // Supabase cloud table
      if (supabaseClient) {
        const employeeKey = storeKey.toUpperCase();
        const payload = {
          employee: employeeKey,
          reason: JSON.stringify(storeValue),
          status: 'active',
          dates: new Date().toISOString(),
          duration: String(Array.isArray(storeValue) ? storeValue.length : 1),
          type: 'Store'
        };

        const { data: records } = await supabaseClient
          .from('leaves')
          .select('id')
          .eq('employee', employeeKey)
          .order('id', { ascending: false });

        if (records && records.length > 0) {
          await supabaseClient.from('leaves').update(payload).eq('id', records[0].id);
        } else {
          await supabaseClient.from('leaves').insert(payload);
        }
      }

      restoredStores.push(storeKey);
    } catch (err) {
      console.warn(`[BackupEngine] Failed restoring store ${storeKey}:`, err.message);
    }
  }

  // 2. Restore Media Cache (PDFs, images, attachments)
  let restoredMediaCount = 0;
  if (backupData.media && typeof backupData.media === 'object') {
    try {
      const mediaPath = getStoreFilePath('media_cache.json');
      fs.writeFileSync(mediaPath, JSON.stringify(backupData.media, null, 2), 'utf8');
      restoredMediaCount = Object.keys(backupData.media).length;
      console.log(`[BackupEngine] Restored ${restoredMediaCount} media files to media_cache.json`);
    } catch (err) {
      console.error('[BackupEngine] Failed to restore media_cache.json:', err.message);
    }
  }

  // 3. Restore Supabase users if present
  let restoredUsersCount = 0;
  if (supabaseClient && Array.isArray(backupData.cloudUsers) && backupData.cloudUsers.length > 0) {
    try {
      for (const u of backupData.cloudUsers) {
        if (!u.email) continue;
        const { data: existing } = await supabaseClient
          .from('users')
          .select('id')
          .eq('email', u.email.trim().toLowerCase())
          .maybeSingle();

        if (existing && existing.id) {
          await supabaseClient.from('users').update({
            name: u.name,
            role: u.role,
            department: u.department,
            password: u.password
          }).eq('id', existing.id);
        } else {
          await supabaseClient.from('users').insert({
            name: u.name,
            email: u.email.trim().toLowerCase(),
            password: u.password,
            role: u.role,
            department: u.department,
            annual_leave: u.annual_leave || 20,
            sick_leave: u.sick_leave || 5
          });
        }
        restoredUsersCount++;
      }
      console.log(`[BackupEngine] Restored/verified ${restoredUsersCount} user accounts`);
    } catch (e) {
      console.warn('[BackupEngine] User restore notice:', e.message);
    }
  }

  return {
    success: true,
    restoredStoresCount: restoredStores.length,
    restoredStores,
    restoredMediaCount,
    restoredUsersCount,
    restoredAt: new Date().toISOString()
  };
}
