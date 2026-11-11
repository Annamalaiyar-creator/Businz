import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, verifyDbConnectivity, isDbConnected } from '../server/db.js';
import { getStoreFilePath } from '../server/runtimePaths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function clearProcurementData() {
  console.log('====================================================');
  console.log('🗑️  BUSINZ: Clear Vendors and Dummy POs');
  console.log('====================================================');

  const args = process.argv.slice(2);
  const clearVendors = args.includes('--vendors') || args.includes('--all') || (!args.includes('--pos-only'));
  const clearDummyPOs = args.includes('--dummy-pos') || args.includes('--all') || (!args.includes('--vendors-only'));
  const clearAllPOs = args.includes('--all-pos');

  // 1. Verify DB connectivity
  const connCheck = await verifyDbConnectivity(5000);
  console.log('📡 Database status:', connCheck.ok ? `CONNECTED (${connCheck.latencyMs}ms)` : `NOT CONNECTED (${connCheck.error})`);

  // 2. Handle Vendors
  if (clearVendors) {
    console.log('\n--- 1. Clearing Vendors ---');
    // Clear disk file
    try {
      const vendorFile = getStoreFilePath('vendor_store.json');
      fs.writeFileSync(vendorFile, JSON.stringify([], null, 2), 'utf8');
      console.log('✅ Cleared server/vendor_store.json');
    } catch (e) {
      console.warn('⚠️  Could not write vendor_store.json:', e.message);
    }

    // Clear PostgreSQL database
    if (isDbConnected()) {
      try {
        await query(`
          INSERT INTO controlroom_store (key, data, updated_at)
          VALUES ('vendor_store', '[]'::jsonb, NOW())
          ON CONFLICT (key) DO UPDATE SET data = '[]'::jsonb, updated_at = NOW()
        `);
        console.log('✅ Cleared vendor_store in PostgreSQL controlroom_store');
      } catch (err) {
        console.error('❌ Failed to update vendor_store in DB:', err.message);
      }
    }
  }

  // 3. Handle POs
  if (clearDummyPOs || clearAllPOs) {
    console.log('\n--- 2. Cleaning Dummy Purchase Orders ---');
    const poFile = getStoreFilePath('po_store.json');
    let currentPOs = [];
    try {
      if (fs.existsSync(poFile)) {
        currentPOs = JSON.parse(fs.readFileSync(poFile, 'utf8') || '[]');
      }
    } catch (_) {}

    // Also check DB for POs
    if (isDbConnected()) {
      try {
        const dbRes = await query(`SELECT data FROM controlroom_store WHERE key = 'po_store'`);
        if (dbRes?.rows?.[0]?.data && Array.isArray(dbRes.rows[0].data)) {
          if (dbRes.rows[0].data.length > currentPOs.length) {
            currentPOs = dbRes.rows[0].data;
          }
        }
      } catch (_) {}
    }

    console.log(`Found ${currentPOs.length} total Purchase Order(s) in store.`);

    let remainingPOs = [];
    if (clearAllPOs || (!args.includes('--keep-real'))) {
      console.log('⚠️  Removing all test/dummy Purchase Orders.');
      remainingPOs = [];
    } else {
      // Remove only dummy / test POs
      remainingPOs = currentPOs.filter(p => {
        const poNo = String(p.poNo || p.po_number || p.id || '').trim();
        const vendor = String(p.vendor || p.vendorName || '').trim().toLowerCase();
        const isDummy = poNo.startsWith('VRM-PO-2026-') || poNo.startsWith('PO-') || vendor.includes('dummy') || vendor.includes('test') || p.isDummy;
        if (isDummy) {
          console.log(`   - Removing dummy PO: ${poNo} (Vendor: ${p.vendor || p.vendorName}, Amount: ${p.amount || p.grandTotal})`);
        }
        return !isDummy;
      });
    }

    const removedCount = currentPOs.length - remainingPOs.length;
    console.log(`Removed ${removedCount} dummy PO(s). Remaining POs: ${remainingPOs.length}`);

    // Update disk file
    try {
      fs.writeFileSync(poFile, JSON.stringify(remainingPOs, null, 2), 'utf8');
      console.log('✅ Updated server/po_store.json');
    } catch (e) {
      console.warn('⚠️  Could not write po_store.json:', e.message);
    }

    // Update PostgreSQL
    if (isDbConnected()) {
      try {
        await query(`
          INSERT INTO controlroom_store (key, data, updated_at)
          VALUES ('po_store', $1::jsonb, NOW())
          ON CONFLICT (key) DO UPDATE SET data = $1::jsonb, updated_at = NOW()
        `, [JSON.stringify(remainingPOs)]);
        console.log('✅ Updated po_store in PostgreSQL controlroom_store');
      } catch (err) {
        console.error('❌ Failed to update po_store in DB:', err.message);
      }
    }
  }

  console.log('\n====================================================');
  console.log('🎉 Cleanup completed successfully!');
  console.log('====================================================');
}

// Execute if run directly
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  clearProcurementData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error during cleanup:', err);
      process.exit(1);
    });
}

