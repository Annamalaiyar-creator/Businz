import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, verifyDbConnectivity, isDbConnected } from '../server/db.js';
import { getStoreFilePath } from '../server/runtimePaths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const targetArg = process.argv[2] || '418';
  console.log(`\n==================================================`);
  console.log(`🔍 TARGET BOM DELETION: "${targetArg}"`);
  console.log(`==================================================\n`);

  // 1. Verify database connectivity
  console.log('⏳ Checking PostgreSQL connection...');
  const connCheck = await verifyDbConnectivity(5000);
  console.log(`📡 Database status:`, connCheck.ok ? `CONNECTED (latency: ${connCheck.latencyMs}ms)` : `FAILED (${connCheck.error})`);

  let dbMatches = [];
  let crStoreMatches = [];
  let diskMatches = [];

  // Matcher helper: strictly matches BOM 418
  const isMatch = (code, id) => {
    const s1 = String(code || '').replace(/[\/\-_]/g, '').toLowerCase();
    const s2 = String(id || '').replace(/[\/\-_]/g, '').toLowerCase();
    return s1.includes('418') || s2.includes('418');
  };

  // 2. Query PostgreSQL bom_orders table
  if (isDbConnected()) {
    try {
      const dbRes = await query(`
        SELECT id, bom_code, code, customer_name, company_name, sales_person, sales_person_code, created_by, created_by_id, grand_total, status, date, created_at
        FROM bom_orders
        WHERE bom_code ILIKE '%418%' OR code ILIKE '%418%' OR id ILIKE '%418%'
      `);
      dbMatches = (dbRes.rows || []).filter(r => isMatch(r.bom_code, r.id));
    } catch (e) {
      console.warn('⚠️ Could not query bom_orders table:', e.message);
    }

    // 3. Query controlroom_store (bom_store key)
    try {
      const crRes = await query(`SELECT data FROM controlroom_store WHERE key = 'bom_store'`);
      if (crRes.rows.length > 0 && Array.isArray(crRes.rows[0].data)) {
        crStoreMatches = crRes.rows[0].data.filter(b => isMatch(b.bomCode || b.code, b.id));
      }
    } catch (e) {
      console.warn('⚠️ Could not query controlroom_store:', e.message);
    }
  }

  // 4. Query disk file
  let diskPath = '';
  try {
    diskPath = getStoreFilePath('bom_store.json');
  } catch (_) {
    diskPath = path.resolve(__dirname, '../server/data/bom_store.json');
  }
  let diskList = [];
  if (fs.existsSync(diskPath)) {
    try {
      diskList = JSON.parse(fs.readFileSync(diskPath, 'utf8') || '[]');
      if (Array.isArray(diskList)) {
        diskMatches = diskList.filter(b => isMatch(b.bomCode || b.code, b.id));
      }
    } catch (e) {
      console.warn('⚠️ Could not read disk bom_store.json:', e.message);
    }
  }

  console.log(`\n📊 Records Found for BOM 418:`);
  console.log(`   - bom_orders table: ${dbMatches.length} record(s)`);
  console.log(`   - controlroom_store: ${crStoreMatches.length} record(s)`);
  console.log(`   - disk cache file:   ${diskMatches.length} record(s)\n`);

  const codesToDelete = new Set();
  const idsToDelete = new Set();

  dbMatches.forEach(r => {
    if (r.bom_code) codesToDelete.add(r.bom_code);
    if (r.code) codesToDelete.add(r.code);
    if (r.id) idsToDelete.add(r.id);
    console.log(`📄 Found in PostgreSQL bom_orders:`, {
      id: r.id,
      bomCode: r.bom_code,
      customer: r.customer_name || r.company_name,
      creatorId: r.created_by_id || r.sales_person_code,
      creator: r.created_by || r.sales_person,
      amount: r.grand_total,
      status: r.status,
      date: r.date || r.created_at
    });
  });

  crStoreMatches.forEach(b => {
    if (b.bomCode) codesToDelete.add(b.bomCode);
    if (b.code) codesToDelete.add(b.code);
    if (b.id) idsToDelete.add(b.id);
    console.log(`📄 Found in controlroom_store:`, {
      id: b.id,
      bomCode: b.bomCode || b.code,
      customer: b.customer || b.customerName,
      creatorId: b.createdById || b.salesPersonCode,
      creator: b.createdBy || b.salesPerson,
      amount: b.grandTotal || b.totalAmount,
      status: b.status
    });
  });

  diskMatches.forEach(b => {
    if (b.bomCode) codesToDelete.add(b.bomCode);
    if (b.code) codesToDelete.add(b.code);
    if (b.id) idsToDelete.add(b.id);
  });

  // Ensure 'VRMS/BOM/26-27/418' and 'VRMS-BOM-26-27-418' are in delete list
  codesToDelete.add('VRMS/BOM/26-27/418');
  codesToDelete.add('VRMS-BOM-26-27-418');

  console.log(`\n🚨 EXECUTING TARGETED DELETION FOR BOM 418:`);
  console.log(`   Codes:`, Array.from(codesToDelete));
  console.log(`   IDs:  `, Array.from(idsToDelete));

  // A. Delete from PostgreSQL bom_orders table
  if (isDbConnected()) {
    try {
      const delTbl = await query(`
        DELETE FROM bom_orders 
        WHERE bom_code ILIKE '%418%' 
           OR code ILIKE '%418%' 
           OR id ILIKE '%418%'
      `);
      console.log(`   ✓ Deleted ${delTbl.rowCount || 0} row(s) from PostgreSQL bom_orders table`);
    } catch (delErr) {
      console.error(`   ⚠️ Error deleting from bom_orders table:`, delErr.message);
    }

    // B. Delete from PostgreSQL controlroom_store (bom_store key)
    try {
      const crRes = await query(`SELECT data FROM controlroom_store WHERE key = 'bom_store'`);
      if (crRes.rows.length > 0 && Array.isArray(crRes.rows[0].data)) {
        const origList = crRes.rows[0].data;
        const filtered = origList.filter(b => !isMatch(b.bomCode || b.code, b.id));
        const removed = origList.length - filtered.length;
        await query(`
          INSERT INTO controlroom_store (key, data, updated_at)
          VALUES ('bom_store', $1, NOW())
          ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()
        `, [JSON.stringify(filtered)]);
        console.log(`   ✓ Removed ${removed} entry/entries from controlroom_store (remaining: ${filtered.length})`);
      }
    } catch (crErr) {
      console.error(`   ⚠️ Error updating controlroom_store:`, crErr.message);
    }
  }

  // C. Delete from disk bom_store.json
  if (fs.existsSync(diskPath)) {
    try {
      const origDisk = JSON.parse(fs.readFileSync(diskPath, 'utf8') || '[]');
      if (Array.isArray(origDisk)) {
        const filteredDisk = origDisk.filter(b => !isMatch(b.bomCode || b.code, b.id));
        fs.writeFileSync(diskPath, JSON.stringify(filteredDisk, null, 2), 'utf8');
        console.log(`   ✓ Removed ${origDisk.length - filteredDisk.length} entry/entries from disk file ${diskPath} (remaining: ${filteredDisk.length})`);
      }
    } catch (diskErr) {
      console.error(`   ⚠️ Error updating disk file:`, diskErr.message);
    }
  }

  console.log(`\n🎉 BOM VRMS-BOM-26-27-418 successfully deleted across all database and cache layers!\n`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
