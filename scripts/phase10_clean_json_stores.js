/**
 * PHASE 10: Clean legacy Zoho keys from active authoritative JSON stores
 * Removes obsolete metadata properties while strictly preserving 100% of business data.
 */
const fs = require('fs');
const path = require('path');

const RETIRED_ZOHO_KEYS = new Set([
  'zohoContactId',
  'zoho_contact_id',
  'zohoId',
  'zoho_id',
  'zohoPoId',
  'zoho_po_id',
  'zohoItemId',
  'zoho_item_id',
  'zohoEstimateId',
  'zoho_estimate_id',
  'zohoDcId',
  'zoho_dc_id',
  'zohoSynced',
  'zoho_synced',
  'syncedToZoho',
  'synced_to_zoho',
  'zohoModule',
  'zohoSyncError',
  'zohoBillPosted',
  'zohoInvoiceNumber'
]);

const targetStores = [
  'customer_store.json',
  'crm_customers.json',
  'vendor_store.json',
  'item_store.json',
  'raw_materials_store.json',
  'po_store.json',
  'invoice_store.json',
  'proforma_invoice_store.json',
  'sales_pi_store.json',
  'dc_store.json',
  'payment_store.json',
  'grn_store.json'
];

function cleanObjectRecursively(obj, stats) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanObjectRecursively(item, stats));
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (RETIRED_ZOHO_KEYS.has(key)) {
      stats.removedKeys[key] = (stats.removedKeys[key] || 0) + 1;
      stats.totalRemoved++;
    } else {
      cleaned[key] = cleanObjectRecursively(value, stats);
    }
  }
  return cleaned;
}

console.log('=== PHASE 10: AUTHORITATIVE JSON STORE CLEANUP ===\n');

const storeStats = {};

targetStores.forEach(fileName => {
  const filePath = path.join(__dirname, '..', 'server', fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`- ${fileName}: Skipped (file not present)`);
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`ERROR: Failed to parse ${fileName}:`, err.message);
    process.exit(1);
  }

  const initialRecordCount = Array.isArray(parsed) ? parsed.length : 1;
  const stats = { totalRemoved: 0, removedKeys: {} };
  const cleaned = cleanObjectRecursively(parsed, stats);
  const finalRecordCount = Array.isArray(cleaned) ? cleaned.length : 1;

  if (initialRecordCount !== finalRecordCount) {
    console.error(`CRITICAL ERROR: Record count mismatch in ${fileName}! Before: ${initialRecordCount}, After: ${finalRecordCount}`);
    process.exit(1);
  }

  // Write back formatted JSON
  fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf8');

  // Verify readable JSON
  try {
    const reread = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(reread) && reread.length !== initialRecordCount) {
      throw new Error('Record count changed after re-reading');
    }
  } catch (reErr) {
    console.error(`CRITICAL ERROR: Re-parsed ${fileName} failed validation:`, reErr.message);
    process.exit(1);
  }

  storeStats[fileName] = stats;
  console.log(`✓ ${fileName}: ${stats.totalRemoved} legacy keys removed (Record count: ${finalRecordCount})`);
  if (stats.totalRemoved > 0) {
    console.log(`    Keys removed:`, stats.removedKeys);
  }
});

const grandTotalRemoved = Object.values(storeStats).reduce((sum, s) => sum + s.totalRemoved, 0);
console.log(`\n=== JSON CLEANUP COMPLETE: ${grandTotalRemoved} TOTAL OBSOLETE KEYS REMOVED ===`);
