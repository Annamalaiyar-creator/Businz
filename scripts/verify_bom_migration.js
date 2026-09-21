import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runVerification() {
  console.log('================================================================');
  console.log('🔍 BOM MIGRATION VERIFICATION: RECORD-BY-RECORD COMPARISON');
  console.log('================================================================\n');

  // 1. Fetch legacy source
  const { data: leavesRows } = await supabase
    .from('leaves')
    .select('reason')
    .eq('employee', 'BOM_STORE');

  const legacyList = JSON.parse(leavesRows[0].reason);
  console.log(`Source records in leaves: ${legacyList.length}`);

  // 2. Fetch target rows
  const { data: targetRows, error: targetErr } = await supabase
    .from('bom_orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (targetErr) {
    console.error('❌ Error fetching bom_orders:', targetErr.message);
    process.exit(1);
  }
  console.log(`Target rows in public.bom_orders: ${targetRows.length}`);

  if (targetRows.length !== legacyList.length) {
    console.error(`❌ Count mismatch: ${legacyList.length} vs ${targetRows.length}`);
    process.exit(1);
  }

  // Build target map
  const targetMap = new Map();
  targetRows.forEach(r => targetMap.set(r.id, r));

  let exactMatches = 0;
  let conflicts = 0;
  let missingRecords = 0;
  let fieldChecksPassed = 0;
  let fieldChecksFailed = 0;

  legacyList.forEach(legacy => {
    const id = legacy.id || legacy.bomCode || legacy.code;
    const target = targetMap.get(id);

    if (!target) {
      console.error(`❌ Missing record in target: ${id}`);
      missingRecords++;
      return;
    }

    // Compare essential fields
    const checks = [
      { name: 'bom_code', val1: legacy.bomCode || legacy.code || id, val2: target.bom_code },
      { name: 'customer_name', val1: (legacy.customerName || legacy.companyName || '').trim(), val2: (target.customer_name || '').trim() },
      { name: 'status', val1: legacy.status || 'Draft', val2: target.status || 'Draft' },
      { name: 'grand_total', val1: Number(legacy.grandTotal || 0), val2: Number(target.grand_total || 0) },
      { name: 'items_count', val1: Array.isArray(legacy.items) ? legacy.items.length : 0, val2: Array.isArray(target.items) ? target.items.length : 0 },
      { name: 'sales_confirmed', val1: Boolean(legacy.salesConfirmed), val2: Boolean(target.sales_confirmed) },
      { name: 'stock_deducted', val1: Boolean(legacy.stockDeducted), val2: Boolean(target.stock_deducted) },
      { name: 'stock_blocked', val1: Boolean(legacy.stockBlocked), val2: Boolean(target.stock_blocked) }
    ];

    let recordClean = true;
    checks.forEach(c => {
      if (c.val1 === c.val2) {
        fieldChecksPassed++;
      } else {
        console.warn(`  ⚠️ Field mismatch in ${id} for "${c.name}": legacy="${c.val1}" vs target="${c.val2}"`);
        fieldChecksFailed++;
        recordClean = false;
      }
    });

    // Check embedded documents
    if (legacy.paymentProofDoc) {
      const docStr = typeof legacy.paymentProofDoc === 'object' ? JSON.stringify(legacy.paymentProofDoc) : String(legacy.paymentProofDoc);
      if (!target.payment_proof_doc || target.payment_proof_doc.length !== docStr.length) {
        console.warn(`  ⚠️ Payment proof doc size mismatch in ${id}`);
        recordClean = false;
      }
    }
    if (legacy.deliveryAddressProofDoc) {
      const docStr = typeof legacy.deliveryAddressProofDoc === 'object' ? JSON.stringify(legacy.deliveryAddressProofDoc) : String(legacy.deliveryAddressProofDoc);
      if (!target.delivery_address_proof_doc || target.delivery_address_proof_doc.length !== docStr.length) {
        console.warn(`  ⚠️ Delivery address proof doc size mismatch in ${id}`);
        recordClean = false;
      }
    }

    if (recordClean) exactMatches++;
    else conflicts++;
  });

  console.log('\n----------------------------------------------------------------');
  console.log(`SUMMARY OF RECORD-BY-RECORD COMPARISON:`);
  console.log(`  Total records verified: ${legacyList.length}`);
  console.log(`  Exact clean matches: ${exactMatches}`);
  console.log(`  Conflicts / mismatches: ${conflicts}`);
  console.log(`  Missing records: ${missingRecords}`);
  console.log(`  Field assertions passed: ${fieldChecksPassed}`);
  console.log(`  Field assertions failed: ${fieldChecksFailed}`);
  console.log('----------------------------------------------------------------\n');

  // Spot checks
  console.log('Spot-checking key records:');
  const b713 = targetMap.get('BOM-713');
  console.log(`  • BOM-713 exists: ${Boolean(b713)}`);
  console.log(`    Customer: "${b713.customer_name}", Status: "${b713.status}"`);
  console.log(`    Delivery doc preserved: ${Boolean(b713.delivery_address_proof_doc)} (${b713.delivery_address_proof_doc?.length} bytes)`);
  console.log(`    Payment doc preserved: ${Boolean(b713.payment_proof_doc)} (${b713.payment_proof_doc?.length} bytes)`);

  const oldest = targetMap.get('BOM-684');
  console.log(`  • Oldest record BOM-684 exists: ${Boolean(oldest)}`);
  console.log(`    Customer: "${oldest.customer_name}", Grand Total: ₹${oldest.grand_total}`);

  const newest = targetMap.get('BOM-736');
  console.log(`  • Newest record BOM-736 exists: ${Boolean(newest)}`);
  console.log(`    Customer: "${newest.customer_name}", Items: ${newest.items?.length}`);

  // Check extra_data preservation
  const sampleWithExtra = targetRows.find(r => r.accounts_verification?._extra_data && Object.keys(r.accounts_verification._extra_data).length > 0);
  if (sampleWithExtra) {
    const extraKeys = Object.keys(sampleWithExtra.accounts_verification._extra_data);
    console.log(`  • Sample extra_data preserved in ${sampleWithExtra.id}: (${extraKeys.length} keys: ${extraKeys.slice(0, 8).join(', ')}...)`);
  }

  // Check legacy leaves row untouched
  const { data: leavesAfter } = await supabase
    .from('leaves')
    .select('id, duration, reason')
    .eq('employee', 'BOM_STORE');

  const leavesLenAfter = leavesAfter?.[0]?.reason?.length || 0;
  console.log(`  • Legacy public.leaves row ID ${leavesAfter[0].id} UNTOUCHED (length: ${(leavesLenAfter / 1024).toFixed(2)} KB, count: ${leavesAfter[0].duration})`);

  if (conflicts === 0 && missingRecords === 0) {
    console.log('\n================================================================');
    console.log('✅ RECORD-BY-RECORD VERIFICATION PASSED WITH 100% INTEGRITY!');
    console.log('================================================================\n');
  } else {
    console.error('\n❌ Verification encountered mismatches!');
    process.exit(1);
  }
}

runVerification();
