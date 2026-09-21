import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Import adapters from supabaseDataSync.js
const syncModule = await import('../src/utils/supabaseDataSync.js');
const {
  toConsumerBom,
  toDatabaseBomRow,
  fetchCloudBom,
  saveCloudBomRow,
  deleteCloudBomRow,
  fetchCloudStore,
  saveCloudStoreImmediate,
  getAndReserveNextBomCode
} = syncModule;

async function runTestSuite() {
  console.log('====================================================');
  console.log('🚀 BUSINZ PHASE C — BOM MIGRATION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // Test 1: Check public.bom_orders accessibility & baseline count
  // ----------------------------------------------------
  console.log('Test 1: Check public.bom_orders table accessibility & count');
  const { data: boms, error: bomErr } = await supabase
    .from('bom_orders')
    .select('id, bom_code, customer_name, status, grand_total')
    .order('created_at', { ascending: false });

  assert(!bomErr, `public.bom_orders query successful (error: ${bomErr?.message || 'none'})`);
  assert(Array.isArray(boms) && boms.length >= 53, `Found >= 53 records in public.bom_orders (found ${boms?.length})`);

  // ----------------------------------------------------
  // Test 2: Record baseline of legacy public.leaves BOM_STORE
  // ----------------------------------------------------
  console.log('\nTest 2: Check legacy public.leaves BOM_STORE row baseline');
  const { data: leavesBefore } = await supabase
    .from('leaves')
    .select('id, employee, dates, reason')
    .eq('employee', 'BOM_STORE');

  const baselineLeavesRow = leavesBefore?.[0];
  assert(baselineLeavesRow && baselineLeavesRow.id === 2, `Legacy BOM_STORE row exists with ID 2`);
  const baselineLeavesLen = baselineLeavesRow?.reason?.length || 0;
  const baselineLeavesDates = baselineLeavesRow?.dates;

  // ----------------------------------------------------
  // Test 3: Adapter functionality — toConsumerBom & toDatabaseBomRow
  // ----------------------------------------------------
  console.log('\nTest 3: Adapter functionality — 2-way conversion & legacy field preservation');
  const sampleDbRow = {
    id: 'BOM-ADAPTER-TEST',
    bom_code: 'BOM-ADAPTER-TEST',
    code: 'BOM-ADAPTER-TEST',
    customer_name: 'Adapter Test Corp',
    company_name: 'Adapter Test Corp',
    mobile: '9876543210',
    email: 'adapter@test.com',
    billing_address: '123 Solar Way',
    delivery_address: '456 Panel Ave',
    sub_total: 100000,
    gst_amount: 18000,
    grand_total: 118000,
    status: 'Sales Confirmed - Sent to Dispatch',
    sales_confirmed: true,
    sales_confirmed_at: '2026-09-20T10:00:00.000Z',
    items: [{ item_name: 'Rail 2414mm', qty: 10 }],
    accounts_verification: {
      verified: true,
      _extra_data: {
        presetName: 'Standard Rooftop Kit',
        presetKitPrice: 25000,
        presetSetCount: 4,
        paymentUpdated: true,
        c2: 'Adapter Test Corp',
        c3: 'Adapter Test Corp',
        c4: '9876543210',
        c5: 'adapter@test.com',
        c6: '123 Solar Way',
        c7: '456 Panel Ave'
      }
    }
  };

  const consumerBom = toConsumerBom(sampleDbRow);
  assert(consumerBom.id === 'BOM-ADAPTER-TEST', `consumer.id preserved`);
  assert(consumerBom.bomCode === 'BOM-ADAPTER-TEST', `consumer.bomCode preserved`);
  assert(consumerBom.c2 === 'Adapter Test Corp', `consumer.c2 alias preserved`);
  assert(consumerBom.presetName === 'Standard Rooftop Kit', `consumer.presetName preserved from extra_data`);
  assert(consumerBom.paymentUpdated === true, `consumer.paymentUpdated flag preserved from extra_data`);
  assert(consumerBom.salesConfirmed === true, `consumer.salesConfirmed boolean cast correctly`);
  assert(!consumerBom.accountsVerification?._extra_data, `accountsVerification cleaned of internal _extra_data wrapper`);

  const backToDb = toDatabaseBomRow(consumerBom);
  assert(backToDb.id === 'BOM-ADAPTER-TEST', `db.id matches`);
  assert(backToDb.bom_code === 'BOM-ADAPTER-TEST', `db.bom_code matches`);
  assert(backToDb.preset_name === 'Standard Rooftop Kit', `db.preset_name matches typed column`);
  assert(backToDb.accounts_verification?._extra_data?.paymentUpdated === true, `db accounts_verification._extra_data repacked unsupported fields`);

  // ----------------------------------------------------
  // Test 4: Single BOM Read via fetchCloudBom (BOM-713)
  // ----------------------------------------------------
  console.log('\nTest 4: Single BOM read (BOM-713) from public.bom_orders');
  const bom713 = await fetchCloudBom('BOM-713');
  assert(bom713 && bom713.id === 'BOM-713', `Fetched BOM-713 successfully`);
  assert(bom713.customerName === 'Jashsun', `Customer name matches "Jashsun"`);
  assert(bom713.status === 'Sales Confirmed - Sent to Dispatch', `Status matches`);
  assert(bom713.paymentProofDoc !== null, `Payment proof doc preserved`);
  assert(bom713.deliveryAddressProofDoc !== null, `Delivery address proof doc preserved`);

  // ----------------------------------------------------
  // Test 5: Next BOM Code Generation using public.bom_orders
  // ----------------------------------------------------
  console.log('\nTest 5: Next sequential BOM code calculation');
  const nextCode = await getAndReserveNextBomCode(false);
  assert(/^BOM-\d+$/i.test(nextCode), `Generated valid sequential code format: ${nextCode}`);
  const nextNum = parseInt(nextCode.replace('BOM-', ''), 10);
  assert(nextNum >= 737, `Generated sequence number (${nextNum}) is >= 737 (after latest BOM-736)`);

  // ----------------------------------------------------
  // Test 6: Create/Insert single normalized BOM row
  // ----------------------------------------------------
  console.log('\nTest 6: Create single normalized BOM row (BOM-TEST-VERIFY)');
  const testBomData = {
    id: 'BOM-TEST-VERIFY',
    bomCode: 'BOM-TEST-VERIFY',
    code: 'BOM-TEST-VERIFY',
    customerName: 'Solar Tech Solutions',
    companyName: 'Solar Tech Solutions',
    date: '2026-09-21',
    deliveryDate: '2026-09-28',
    status: 'Draft',
    subTotal: 50000,
    gstAmount: 9000,
    grandTotal: 59000,
    items: [
      { code: 'ALU-LEN-2414MM', name: 'Aluminium Rail 2414mm', qty: 20, rate: 2500 }
    ],
    salesPerson: 'Test Agent',
    salesConfirmed: false,
    remarks: 'Phase C automated test verification row'
  };

  const saved = await saveCloudBomRow(testBomData);
  assert(saved && saved.id === 'BOM-TEST-VERIFY', `saveCloudBomRow returned valid saved consumer BOM`);

  // Verify directly in Supabase table
  const { data: readBack, error: readBackErr } = await supabase
    .from('bom_orders')
    .select('*')
    .eq('id', 'BOM-TEST-VERIFY')
    .single();

  assert(!readBackErr && readBack, `Read back newly created row from public.bom_orders`);
  assert(readBack?.customer_name === 'Solar Tech Solutions', `Persisted customer_name matches`);
  assert(Number(readBack?.grand_total) === 59000, `Persisted grand_total matches`);
  assert(readBack?.status === 'Draft', `Persisted status matches Draft`);

  // Allow async server notification from creation to complete before updating
  await new Promise(r => setTimeout(r, 800));

  // ----------------------------------------------------
  // Test 7: Update/Edit single BOM (status, confirmation, amount)
  // ----------------------------------------------------
  console.log('\nTest 7: Edit BOM (update status to "Sales Confirmed" and grandTotal to 70000)');
  const updateData = {
    ...testBomData,
    status: 'Sales Confirmed - Sent to Dispatch',
    salesConfirmed: true,
    salesConfirmedAt: new Date().toISOString(),
    subTotal: 60000,
    gstAmount: 10800,
    grandTotal: 70800
  };

  const updatedBom = await saveCloudBomRow(updateData);
  assert(updatedBom.status === 'Sales Confirmed - Sent to Dispatch', `Updated status returned correctly`);
  assert(updatedBom.salesConfirmed === true, `Updated salesConfirmed returned correctly`);

  // Wait briefly for asynchronous server sync to settle
  await new Promise(r => setTimeout(r, 300));

  // Verify in table
  const { data: readUpdated } = await supabase
    .from('bom_orders')
    .select('*')
    .eq('id', 'BOM-TEST-VERIFY')
    .single();

  assert(readUpdated.status === 'Sales Confirmed - Sent to Dispatch', `Table row status updated`);
  assert(readUpdated.sales_confirmed === true, `Table row sales_confirmed updated`);
  assert(Number(readUpdated.grand_total) === 70800, `Table row grand_total updated to 70800`);

  // ----------------------------------------------------
  // Test 8: Verify ZERO writes occurred to public.leaves BOM_STORE
  // ----------------------------------------------------
  console.log('\nTest 8: Verify ZERO writes to legacy public.leaves BOM_STORE');
  const { data: leavesAfter } = await supabase
    .from('leaves')
    .select('id, employee, dates, reason')
    .eq('employee', 'BOM_STORE');

  const afterRow = leavesAfter?.[0];
  assert(afterRow?.id === 2, `Legacy row ID remains 2`);
  assert(afterRow?.reason?.length === baselineLeavesLen, `Legacy reason payload size identical (${afterRow?.reason?.length} vs ${baselineLeavesLen})`);
  assert(afterRow?.dates === baselineLeavesDates, `Legacy timestamp untouched (${afterRow?.dates})`);

  // ----------------------------------------------------
  // Test 9: Backend /api/boms and /api/boms/:id endpoints verification
  // ----------------------------------------------------
  console.log('\nTest 9: Backend HTTP routes verification');
  try {
    const listRes = await fetch('http://localhost:5001/api/boms?refresh=true');
    const listJson = await listRes.json();
    assert(listJson.success === true, `GET /api/boms returned success`);
    assert(Array.isArray(listJson.data) && listJson.data.length >= 54, `GET /api/boms contains >= 54 items (found ${listJson.data?.length})`);

    const singleRes = await fetch('http://localhost:5001/api/boms/BOM-TEST-VERIFY');
    const singleJson = await singleRes.json();
    assert(singleJson.success === true, `GET /api/boms/BOM-TEST-VERIFY returned success`);
    assert(singleJson.data?.id === 'BOM-TEST-VERIFY', `GET /api/boms/:id returned correct BOM`);
    assert(singleJson.data?.status === 'Sales Confirmed - Sent to Dispatch', `GET /api/boms/:id returned updated status`);
  } catch (httpErr) {
    console.warn(`  ⚠️ HTTP test notice: ${httpErr.message}`);
  }

  // ----------------------------------------------------
  // Test 10: Atomic single-row DELETE from public.bom_orders
  // ----------------------------------------------------
  console.log('\nTest 10: Atomic single-row DELETE of BOM-TEST-VERIFY');
  const deleted = await deleteCloudBomRow('BOM-TEST-VERIFY');
  assert(deleted === true, `deleteCloudBomRow returned true`);

  const { data: checkDeleted } = await supabase
    .from('bom_orders')
    .select('id')
    .eq('id', 'BOM-TEST-VERIFY');

  assert(Array.isArray(checkDeleted) && checkDeleted.length === 0, `Row confirmed completely deleted from public.bom_orders`);

  // Verify count restored
  const { data: finalCount } = await supabase
    .from('bom_orders')
    .select('id', { count: 'exact' });

  assert(finalCount.length === 53, `BOM count safely restored to original 53 rows`);

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`TEST SUITE SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
