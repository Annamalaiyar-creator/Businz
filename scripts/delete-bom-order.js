import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, isDbConnected } from '../server/db.js';
import { getStoreFilePath } from '../server/runtimePaths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const targetArg = process.argv[2] || '418';
  const targetNormalized = String(targetArg).trim().replace(/[\/\-_]/g, '').toLowerCase();
  console.log(`\n🔍 Searching for BOM to delete: "${targetArg}" (normalized: "${targetNormalized}")...\n`);

  let dbMatches = [];
  let crStoreMatches = [];
  let diskMatches = [];

  // 1. Search PostgreSQL bom_orders table
  if (isDbConnected()) {
    try {
      const dbRes = await query(`
        SELECT id, bom_code, code, customer_name, company_name, sales_person, sales_person_code, created_by, created_by_id, grand_total, status, date, created_at
        FROM bom_orders
        WHERE bom_code ILIKE $1 
           OR code ILIKE $1 
           OR id ILIKE $1
           OR customer_name ILIKE '%sai solar%'
           OR company_name ILIKE '%sai solar%'
      `, [`%${targetArg.replace(/[^a-zA-Z0-9]/g, '%')}%`]);
      dbMatches = dbRes.rows || [];
    } catch (e) {
      console.warn('⚠️ Could not query bom_orders table:', e.message);
    }

    // 2. Search controlroom_store
    try {
      const crRes = await query(`SELECT data FROM controlroom_store WHERE key = 'bom_store'`);
      if (crRes.rows.length > 0 && Array.isArray(crRes.rows[0].data)) {
        crStoreMatches = crRes.rows[0].data.filter(b => {
          const codeNorm = String(b.bomCode || b.code || b.id || '').replace(/[\/\-_]/g, '').toLowerCase();
          const cust = String(b.customer || b.customerName || b.companyName || '').toLowerCase();
          return codeNorm.includes(targetNormalized) || (targetNormalized.includes('418') && cust.includes('sai solar'));
        });
      }
    } catch (e) {
      console.warn('⚠️ Could not query controlroom_store:', e.message);
    }
  }

  // 3. Search disk file
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
        diskMatches = diskList.filter(b => {
          const codeNorm = String(b.bomCode || b.code || b.id || '').replace(/[\/\-_]/g, '').toLowerCase();
          const cust = String(b.customer || b.customerName || b.companyName || '').toLowerCase();
          return codeNorm.includes(targetNormalized) || (targetNormalized.includes('418') && cust.includes('sai solar'));
        });
      }
    } catch (e) {
      console.warn('⚠️ Could not read disk bom_store.json:', e.message);
    }
  }

  console.log(`📊 Search Results for target "${targetArg}":`);
  console.log(`   - bom_orders table matches: ${dbMatches.length}`);
  console.log(`   - controlroom_store matches: ${crStoreMatches.length}`);
  console.log(`   - disk file matches: ${diskMatches.length}\n`);

  const allFoundCodes = new Set();
  const allFoundIds = new Set();

  dbMatches.forEach(r => {
    if (r.bom_code) allFoundCodes.add(r.bom_code);
    if (r.code) allFoundCodes.add(r.code);
    if (r.id) allFoundIds.add(r.id);
    console.log(`📄 Found in bom_orders table:`, {
      id: r.id,
      bomCode: r.bom_code || r.code,
      customer: r.customer_name || r.company_name,
      salesPerson: r.sales_person,
      salesPersonCode: r.sales_person_code,
      createdBy: r.created_by,
      createdById: r.created_by_id,
      amount: r.grand_total,
      status: r.status,
      date: r.date || r.created_at
    });
  });

  crStoreMatches.forEach(b => {
    if (b.bomCode) allFoundCodes.add(b.bomCode);
    if (b.code) allFoundCodes.add(b.code);
    if (b.id) allFoundIds.add(b.id);
    console.log(`📄 Found in controlroom_store:`, {
      id: b.id,
      bomCode: b.bomCode || b.code,
      customer: b.customer || b.customerName || b.companyName,
      salesPerson: b.salesPerson,
      salesPersonCode: b.salesPersonCode,
      creator: b.createdBy,
      createdById: b.createdById || b.creatorEmployeeCode,
      amount: b.grandTotal || b.totalAmount,
      status: b.status,
      date: b.date
    });
  });

  diskMatches.forEach(b => {
    if (b.bomCode) allFoundCodes.add(b.bomCode);
    if (b.code) allFoundCodes.add(b.code);
    if (b.id) allFoundIds.add(b.id);
  });

  if (allFoundCodes.size === 0 && allFoundIds.size === 0) {
    console.log(`❌ No BOM records found matching "${targetArg}". Nothing to delete.`);
    process.exit(0);
  }

  console.log(`\n🚨 PROCEEDING TO DELETE RECORD(S):`);
  console.log(`   Target BOM Codes:`, Array.from(allFoundCodes));
  console.log(`   Target BOM IDs:`, Array.from(allFoundIds));

  // Perform targeted deletion
  // A. Delete from PostgreSQL table bom_orders
  if (isDbConnected()) {
    try {
      for (const code of allFoundCodes) {
        const delRes = await query(`DELETE FROM bom_orders WHERE bom_code = $1 OR code = $1`, [code]);
        console.log(`   ✓ Deleted ${delRes.rowCount || 0} row(s) from bom_orders table for code "${code}"`);
      }
      for (const id of allFoundIds) {
        const delRes = await query(`DELETE FROM bom_orders WHERE id = $1`, [id]);
        console.log(`   ✓ Deleted ${delRes.rowCount || 0} row(s) from bom_orders table for id "${id}"`);
      }
    } catch (delErr) {
      console.error(`   ⚠️ Error deleting from bom_orders table:`, delErr.message);
    }

    // B. Delete from controlroom_store (bom_store key)
    try {
      const crRes = await query(`SELECT data FROM controlroom_store WHERE key = 'bom_store'`);
      if (crRes.rows.length > 0 && Array.isArray(crRes.rows[0].data)) {
        const originalCount = crRes.rows[0].data.length;
        const filtered = crRes.rows[0].data.filter(b => {
          const bCode = b.bomCode || b.code || '';
          const bId = b.id || '';
          return !allFoundCodes.has(bCode) && !allFoundIds.has(bId);
        });
        const removedCount = originalCount - filtered.length;
        await query(`
          INSERT INTO controlroom_store (key, data, updated_at)
          VALUES ('bom_store', $1, NOW())
          ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()
        `, [JSON.stringify(filtered)]);
        console.log(`   ✓ Removed ${removedCount} record(s) from controlroom_store (new count: ${filtered.length})`);
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
        const filteredDisk = origDisk.filter(b => {
          const bCode = b.bomCode || b.code || '';
          const bId = b.id || '';
          return !allFoundCodes.has(bCode) && !allFoundIds.has(bId);
        });
        fs.writeFileSync(diskPath, JSON.stringify(filteredDisk, null, 2), 'utf8');
        console.log(`   ✓ Removed ${origDisk.length - filteredDisk.length} record(s) from disk file ${diskPath} (new count: ${filteredDisk.length})`);
      }
    } catch (diskErr) {
      console.error(`   ⚠️ Error updating disk bom_store.json:`, diskErr.message);
    }
  }

  console.log(`\n🎉 BOM deletion completed successfully!`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
