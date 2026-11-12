/**
 * Standalone Targeted Purge Utility for BUSINZ
 * 
 * Safely removes specific BOMs and Proforma Invoices (PIs) requested by the user.
 * Creates an immutable safety backup of deleted records before deletion.
 * 
 * Target BOMs:
 * - VRM-BOM-2026-05
 * - VRM-BOM-2026-265
 * - VRM-BOM-2026-114
 * - VRM-BOM-2026-99
 * - VRM-BOM-2026-32
 * - VRM-BOM-2026-27
 * - VRM-BOM-2026-25
 * 
 * Target PIs:
 * - VRM-PI-2026-283
 * - VRM-PI-2026-138
 * - VRM-PI-2026-121
 * - PI-00060
 * - PI-00059
 * - PI-00062
 * - PI-00061
 * - VRM-PI-2026-37
 * - VRM-PI-2026-29
 * - VRM-PI-2026-23
 * - VRM-PI-2026-237
 * - VRM-PI-2026-228
 * - VRM-PI-2026-04
 * - VRM-PI-2026-03
 * - VRM-PI-2026-02
 * - VRM-PI-2026-01
 * - PI-00063
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.development.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const TARGET_BOMS = [
  'VRM-BOM-2026-05',
  'VRM-BOM-2026-265',
  'VRM-BOM-2026-114',
  'VRM-BOM-2026-99',
  'VRM-BOM-2026-32',
  'VRM-BOM-2026-27',
  'VRM-BOM-2026-25',
  'VRM-BOM-2026-04',
  'VRM-BOM-2026-03',
  'VRM-BOM-2026-02',
  'VRM-BOM-2026-01',
  'BOM-665',
  'BOM-662',
  'BOM-661',
  'BOM-660',
  'BOM-659'
];

const TARGET_PIS = [
  'VRM-PI-2026-283',
  'VRM-PI-2026-138',
  'VRM-PI-2026-121',
  'PI-00060',
  'PI-00059',
  'PI-00062',
  'PI-00061',
  'VRM-PI-2026-37',
  'VRM-PI-2026-29',
  'VRM-PI-2026-23',
  'VRM-PI-2026-237',
  'VRM-PI-2026-228',
  'VRM-PI-2026-04',
  'VRM-PI-2026-03',
  'VRM-PI-2026-02',
  'VRM-PI-2026-01',
  'PI-00063'
];

const TARGET_BOMS_SET = new Set(TARGET_BOMS.map(s => s.trim().toUpperCase()));
const TARGET_PIS_SET = new Set(TARGET_PIS.map(s => s.trim().toUpperCase()));

function getStoreFilePath(fileName) {
  const customDir = process.env.DATA_DIR || process.env.BUSINZ_DATA_DIR;
  if (customDir && fs.existsSync(customDir)) {
    return path.join(customDir, fileName);
  }
  return path.join(__dirname, fileName);
}

async function runPurge() {
  console.log('=====================================================');
  console.log('🗑️  BUSINZ TARGETED PURGE: BOMS & PROFORMA INVOICES');
  console.log('=====================================================');
  console.log(`Target BOMs (${TARGET_BOMS.length}):`, TARGET_BOMS.join(', '));
  console.log(`Target PIs (${TARGET_PIS.length}):`, TARGET_PIS.join(', '));
  console.log('-----------------------------------------------------\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(__dirname, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFilePath = path.join(backupDir, `purged_records_backup_${timestamp}.json`);

  const purgedDataArchive = {
    timestamp: new Date().toISOString(),
    targetBoms: TARGET_BOMS,
    targetPis: TARGET_PIS,
    backedUpBoms: [],
    backedUpPis: [],
    dbResults: {}
  };

  // 1. PURGE FROM LOCAL DISK JSON STORES & POPULATE BACKUP
  console.log('📦 [Step 1/3] Scanning and cleaning JSON disk stores...');

  // 1a. Clean bom_store.json
  const bomStorePath = getStoreFilePath('bom_store.json');
  if (fs.existsSync(bomStorePath)) {
    try {
      const boms = JSON.parse(fs.readFileSync(bomStorePath, 'utf8'));
      if (Array.isArray(boms)) {
        const remainingBoms = [];
        boms.forEach(b => {
          const keys = [b.id, b.bomCode, b.bomNumber, b.bomNo, b.code].filter(Boolean).map(k => String(k).trim().toUpperCase());
          const isTarget = keys.some(k => TARGET_BOMS_SET.has(k));
          if (isTarget) {
            purgedDataArchive.backedUpBoms.push({ source: 'bom_store.json', record: b });
          } else {
            remainingBoms.push(b);
          }
        });
        fs.writeFileSync(bomStorePath, JSON.stringify(remainingBoms, null, 2), 'utf8');
        console.log(`   - bom_store.json: Removed ${boms.length - remainingBoms.length} BOM(s). Remaining: ${remainingBoms.length}`);
      }
    } catch (err) {
      console.warn('   ⚠️ Error processing bom_store.json:', err.message);
    }
  }

  // 1b. Clean proforma_invoice_store.json
  const piStorePath = getStoreFilePath('proforma_invoice_store.json');
  if (fs.existsSync(piStorePath)) {
    try {
      const pis = JSON.parse(fs.readFileSync(piStorePath, 'utf8'));
      if (Array.isArray(pis)) {
        const remainingPis = [];
        pis.forEach(p => {
          const keys = [p.id, p.piNo, p.estimateNumber, p.estimate_number].filter(Boolean).map(k => String(k).trim().toUpperCase());
          const isTarget = keys.some(k => TARGET_PIS_SET.has(k));
          if (isTarget) {
            purgedDataArchive.backedUpPis.push({ source: 'proforma_invoice_store.json', record: p });
          } else {
            remainingPis.push(p);
          }
        });
        fs.writeFileSync(piStorePath, JSON.stringify(remainingPis, null, 2), 'utf8');
        console.log(`   - proforma_invoice_store.json: Removed ${pis.length - remainingPis.length} PI(s). Remaining: ${remainingPis.length}`);
      }
    } catch (err) {
      console.warn('   ⚠️ Error processing proforma_invoice_store.json:', err.message);
    }
  }

  // 1c. Clean sales_pi_store.json
  const salesPiStorePath = getStoreFilePath('sales_pi_store.json');
  if (fs.existsSync(salesPiStorePath)) {
    try {
      const salesPis = JSON.parse(fs.readFileSync(salesPiStorePath, 'utf8'));
      if (Array.isArray(salesPis)) {
        const remainingSalesPis = [];
        salesPis.forEach(p => {
          const keys = [p.id, p.piNo, p.estimateNumber, p.estimate_number].filter(Boolean).map(k => String(k).trim().toUpperCase());
          const isTarget = keys.some(k => TARGET_PIS_SET.has(k));
          if (isTarget) {
            purgedDataArchive.backedUpPis.push({ source: 'sales_pi_store.json', record: p });
          } else {
            remainingSalesPis.push(p);
          }
        });
        fs.writeFileSync(salesPiStorePath, JSON.stringify(remainingSalesPis, null, 2), 'utf8');
        console.log(`   - sales_pi_store.json: Removed ${salesPis.length - remainingSalesPis.length} PI(s). Remaining: ${remainingSalesPis.length}`);
      }
    } catch (err) {
      console.warn('   ⚠️ Error processing sales_pi_store.json:', err.message);
    }
  }

  // 2. PURGE FROM POSTGRESQL (IF CONNECTED)
  console.log('\n🐘 [Step 2/3] Connecting to PostgreSQL database...');
  const isDevServer = process.env.PORT === '5002' || process.env.NODE_ENV === 'development';
  let defaultDbName = isDevServer ? 'businz_dev' : 'businz';
  let resolvedConnString = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;
  if (isDevServer && resolvedConnString && resolvedConnString.includes('/businz') && !resolvedConnString.includes('/businz_dev')) {
    resolvedConnString = resolvedConnString.replace(/\/businz(\?|$)/, '/businz_dev$1');
  }
  const connectionString = resolvedConnString || 
    `postgres://${process.env.PGUSER || 'postgres'}:${encodeURIComponent(process.env.PGPASSWORD || 'postgres')}@${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || 5432}/${defaultDbName}`;

  let pool;
  let client;
  try {
    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 5000,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
    });

    client = await pool.connect();
    const dbInfo = (await client.query('SELECT current_database() AS db_name')).rows[0];
    console.log(`   ✅ Connected to PostgreSQL database: [${dbInfo.db_name}]`);

    await client.query('BEGIN');

    // 2a. Query and backup existing DB rows before deletion
    const existingDbBoms = (await client.query(`
      SELECT * FROM public.bom_orders
      WHERE id = ANY($1) OR bom_code = ANY($1) OR code = ANY($1)
    `, [TARGET_BOMS])).rows || [];
    if (existingDbBoms.length > 0) {
      existingDbBoms.forEach(r => purgedDataArchive.backedUpBoms.push({ source: 'public.bom_orders', record: r }));
    }

    const existingDbPis = (await client.query(`
      SELECT * FROM public.proforma_invoices
      WHERE id = ANY($1) OR pi_no = ANY($1)
    `, [TARGET_PIS])).rows || [];
    if (existingDbPis.length > 0) {
      existingDbPis.forEach(r => purgedDataArchive.backedUpPis.push({ source: 'public.proforma_invoices', record: r }));
    }

    // 2b. Delete from public.bom_orders
    const bomDelRes = await client.query(`
      DELETE FROM public.bom_orders
      WHERE id = ANY($1) OR bom_code = ANY($1) OR code = ANY($1)
    `, [TARGET_BOMS]);
    console.log(`   - public.bom_orders: Deleted ${bomDelRes.rowCount} row(s).`);

    // 2c. Delete from public.proforma_invoices
    const piDelRes = await client.query(`
      DELETE FROM public.proforma_invoices
      WHERE id = ANY($1) OR pi_no = ANY($1)
    `, [TARGET_PIS]);
    console.log(`   - public.proforma_invoices: Deleted ${piDelRes.rowCount} row(s).`);

    // 2d. Clean public.controlroom_store jsonb arrays
    // bom_store
    const bomStoreSync = await client.query(`
      UPDATE public.controlroom_store
      SET data = (
        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
        FROM jsonb_array_elements(data) elem
        WHERE UPPER(TRIM(COALESCE(elem->>'bomCode', elem->>'bomNumber', elem->>'bomNo', elem->>'code', elem->>'id', ''))) != ALL($1)
      ),
      updated_at = NOW()
      WHERE key = 'bom_store';
    `, [TARGET_BOMS]);
    console.log(`   - public.controlroom_store (bom_store): Cleaned array.`);

    // sales_pi_store & proforma_invoice_store
    for (const piKey of ['sales_pi_store', 'proforma_invoice_store']) {
      await client.query(`
        UPDATE public.controlroom_store
        SET data = (
          SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
          FROM jsonb_array_elements(data) elem
          WHERE UPPER(TRIM(COALESCE(elem->>'piNo', elem->>'id', elem->>'estimateNumber', ''))) != ALL($1)
        ),
        updated_at = NOW()
        WHERE key = $2;
      `, [TARGET_PIS, piKey]);
      console.log(`   - public.controlroom_store (${piKey}): Cleaned array.`);
    }

    await client.query('COMMIT');
    console.log('   ✅ PostgreSQL transaction committed successfully.');
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => null);
    }
    console.warn(`   ⚠️ PostgreSQL cleanup skipped or encountered an error: ${err.message}`);
  } finally {
    if (client) client.release();
    if (pool) await pool.end();
  }

  // 3. WRITE SAFETY BACKUP ARCHIVE
  console.log('\n💾 [Step 3/3] Saving safety backup archive...');
  fs.writeFileSync(backupFilePath, JSON.stringify(purgedDataArchive, null, 2), 'utf8');
  console.log(`   ✅ Safety backup successfully saved to: ${backupFilePath}`);
  console.log(`   Total BOM records backed up: ${purgedDataArchive.backedUpBoms.length}`);
  console.log(`   Total PI records backed up: ${purgedDataArchive.backedUpPis.length}`);

  console.log('\n🎉 Targeted purge complete! Now restart your node process to refresh in-memory caches.');
}

runPurge().catch(err => {
  console.error('Fatal error during targeted purge:', err);
  process.exit(1);
});

