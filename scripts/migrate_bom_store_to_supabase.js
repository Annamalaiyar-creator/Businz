import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const isExecute = process.argv.includes('--execute');

function toDatabaseBomRow(item) {
  const id = item.id || item.bomCode || item.code || `BOM-${Date.now()}`;
  const bomCode = item.bomCode || item.code || id;
  const code = item.code || bomCode;
  const sourcePiNo = item.sourcePiNo || null;

  const sanitizeDate = (d) => {
    if (!d) return null;
    const str = String(d).trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : null;
  };

  const sanitizeTimestamp = (ts) => {
    if (!ts) return null;
    try {
      const d = new Date(ts);
      return !isNaN(d.getTime()) ? d.toISOString() : null;
    } catch (_) {
      return null;
    }
  };

  const sanitizeNumber = (val, defaultVal = 0) => {
    if (val === null || val === undefined || val === '') return defaultVal;
    const n = Number(val);
    return isNaN(n) ? defaultVal : n;
  };

  const serializeDoc = (doc) => {
    if (!doc) return null;
    if (typeof doc === 'string') return doc;
    try {
      return JSON.stringify(doc);
    } catch (_) {
      return null;
    }
  };

  // Standard fields supported by public.bom_orders columns
  const standardFields = new Set([
    'id', 'bomCode', 'code', 'sourcePiNo', 'date', 'deliveryDate',
    'customerName', 'companyName', 'mobile', 'email', 'billingAddress',
    'billingAddressObj', 'deliveryAddress', 'deliveryAddressObj',
    'deliveryAddressProofDoc', 'transportMode', 'transportScope',
    'transporterName', 'vehicleNo', 'lrNo', 'paymentType', 'partialAmount',
    'balanceAmount', 'creditDays', 'creditDueDate', 'paymentProofDoc',
    'remarks', 'status', 'salesConfirmed', 'salesConfirmedAt', 'salesPerson',
    'salesPersonCode', 'createdBy', 'createdById', 'items', 'payments',
    'dispatchPacking', 'accountsVerification', 'invoiceConfirmed',
    'invoiceDeducted', 'stockBlocked', 'stockBlockedAt', 'presetName',
    'presetKitPrice', 'presetSetCount', 'presetGroups', 'subTotal',
    'gstAmount', 'cgstAmount', 'sgstAmount', 'grandTotal', 'stockDeducted',
    'createdAt', 'updatedAt'
  ]);

  // Preserve any legacy fields not in standard columns
  const extraData = {};
  Object.keys(item).forEach(k => {
    if (!standardFields.has(k)) {
      extraData[k] = item[k];
    }
  });

  const accountsVerification = typeof item.accountsVerification === 'object' && item.accountsVerification !== null
    ? { ...item.accountsVerification, _extra_data: extraData }
    : { _extra_data: extraData };

  return {
    id,
    bom_code: bomCode,
    code,
    source_pi_no: sourcePiNo,
    date: sanitizeDate(item.date) || new Date().toISOString().slice(0, 10),
    delivery_date: sanitizeDate(item.deliveryDate),
    customer_name: item.customerName || item.companyName || 'Customer',
    company_name: item.companyName || item.customerName || '',
    mobile: item.mobile || '',
    email: item.email || '',
    billing_address: item.billingAddress || '',
    billing_address_obj: item.billingAddressObj || {},
    delivery_address: item.deliveryAddress || '',
    delivery_address_obj: item.deliveryAddressObj || {},
    delivery_address_proof_doc: serializeDoc(item.deliveryAddressProofDoc),
    transport_mode: item.transportMode || 'Transport',
    transport_scope: item.transportScope || 'VRM Structures',
    transporter_name: item.transporterName || '',
    vehicle_no: item.vehicleNo || '',
    lr_no: item.lrNo || '',
    payment_type: item.paymentType || 'Credit Payment',
    partial_amount: sanitizeNumber(item.partialAmount, 0),
    balance_amount: sanitizeNumber(item.balanceAmount, 0),
    credit_days: Math.round(sanitizeNumber(item.creditDays, 0)),
    credit_due_date: sanitizeDate(item.creditDueDate),
    payment_proof_doc: serializeDoc(item.paymentProofDoc),
    remarks: item.remarks || '',
    status: item.status || 'Draft',
    sales_confirmed: Boolean(item.salesConfirmed),
    sales_confirmed_at: sanitizeTimestamp(item.salesConfirmedAt),
    sales_person: item.salesPerson || '',
    sales_person_code: item.salesPersonCode || '',
    created_by: item.createdBy || '',
    created_by_id: item.createdById || '',
    items: Array.isArray(item.items) ? item.items : [],
    payments: typeof item.payments === 'object' && item.payments !== null ? item.payments : {},
    dispatch_packing: Array.isArray(item.dispatchPacking) || typeof item.dispatchPacking === 'object' ? item.dispatchPacking : [],
    accounts_verification: accountsVerification,
    invoice_confirmed: Boolean(item.invoiceConfirmed),
    invoice_deducted: Boolean(item.invoiceDeducted),
    stock_blocked: Boolean(item.stockBlocked),
    stock_blocked_at: sanitizeTimestamp(item.stockBlockedAt),
    preset_name: item.presetName || '',
    preset_kit_price: sanitizeNumber(item.presetKitPrice, 0),
    preset_set_count: Math.round(sanitizeNumber(item.presetSetCount, 0)),
    preset_groups: Array.isArray(item.presetGroups) ? item.presetGroups : [],
    sub_total: sanitizeNumber(item.subTotal, 0),
    gst_amount: sanitizeNumber(item.gstAmount, 0),
    cgst_amount: sanitizeNumber(item.cgstAmount, 0),
    sgst_amount: sanitizeNumber(item.sgstAmount, 0),
    grand_total: sanitizeNumber(item.grandTotal, 0),
    stock_deducted: Boolean(item.stockDeducted),
    created_at: sanitizeTimestamp(item.createdAt || item.date) || new Date().toISOString(),
    updated_at: sanitizeTimestamp(item.updatedAt) || new Date().toISOString()
  };
}

async function run() {
  console.log('================================================================');
  console.log(`🚀 BOM_STORE TO PUBLIC.BOM_ORDERS MIGRATION [${isExecute ? 'EXECUTE MODE' : 'DRY RUN MODE'}]`);
  console.log('================================================================\n');

  // 1. Read legacy BOM_STORE from public.leaves
  console.log('Step 1: Reading source records from public.leaves (employee = BOM_STORE)...');
  const { data: leavesRows, error: leavesErr } = await supabase
    .from('leaves')
    .select('id, employee, duration, dates, reason')
    .eq('employee', 'BOM_STORE');

  if (leavesErr || !leavesRows || leavesRows.length === 0) {
    console.error('❌ Failed to read BOM_STORE from leaves:', leavesErr?.message || 'No row found');
    process.exit(1);
  }

  const leavesRecord = leavesRows[0];
  console.log(`  Source leaves row ID: ${leavesRecord.id}`);
  console.log(`  Source reason size: ${(leavesRecord.reason.length / 1024).toFixed(2)} KB`);

  let rawList = [];
  try {
    rawList = JSON.parse(leavesRecord.reason);
  } catch (e) {
    console.error('❌ Failed to parse JSON reason from leaves:', e.message);
    process.exit(1);
  }

  console.log(`  Total legacy BOM records found: ${rawList.length}`);

  // 2. Validate and map records
  console.log('\nStep 2: Mapping and validating all records...');
  const mappedRows = [];
  const seenIds = new Set();
  const duplicateIds = [];
  const invalidRecords = [];
  const unsupportedFields = new Set();

  rawList.forEach((item, idx) => {
    const id = item.id || item.bomCode || item.code;
    if (!id) {
      invalidRecords.push({ idx, error: 'Missing ID/code' });
      return;
    }
    if (seenIds.has(id)) {
      duplicateIds.push(id);
      return;
    }
    seenIds.add(id);

    try {
      const mapped = toDatabaseBomRow(item);
      mappedRows.push(mapped);
      // Collect extra fields stored in accounts_verification._extra_data
      if (mapped.accounts_verification?._extra_data) {
        Object.keys(mapped.accounts_verification._extra_data).forEach(k => unsupportedFields.add(k));
      }
    } catch (err) {
      invalidRecords.push({ idx, id, error: err.message });
    }
  });

  console.log(`  Mapped valid records: ${mappedRows.length}`);
  console.log(`  Duplicate IDs found: ${duplicateIds.length}`);
  console.log(`  Invalid records found: ${invalidRecords.length}`);
  console.log(`  Unsupported fields safely stored in _extra_data (${unsupportedFields.size}):`, Array.from(unsupportedFields).sort());

  if (mappedRows.length !== rawList.length || duplicateIds.length > 0 || invalidRecords.length > 0) {
    console.error('❌ Validation check failed: Mapped count does not match source count exactly!');
    process.exit(1);
  }

  // Check target table before inserting
  console.log('\nStep 3: Checking target table public.bom_orders...');
  const { count: targetBeforeCount, error: countErr } = await supabase
    .from('bom_orders')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    console.error('❌ Error checking public.bom_orders:', countErr.message);
    process.exit(1);
  }

  console.log(`  Target public.bom_orders row count BEFORE migration: ${targetBeforeCount}`);

  if (targetBeforeCount > 0 && !isExecute) {
    console.warn(`  ⚠️ Target table already has ${targetBeforeCount} rows.`);
  }

  // Specific spot check on BOM-713 and first/last records
  console.log('\nStep 4: Spot check key records...');
  const bom713 = mappedRows.find(r => r.id === 'BOM-713');
  if (bom713) {
    console.log(`  ✅ Found BOM-713: customer="${bom713.customer_name}", items=${bom713.items.length}, status="${bom713.status}"`);
    console.log(`     payment_proof_doc preserved: ${Boolean(bom713.payment_proof_doc)} (length: ${bom713.payment_proof_doc?.length || 0})`);
    console.log(`     delivery_address_proof_doc preserved: ${Boolean(bom713.delivery_address_proof_doc)} (length: ${bom713.delivery_address_proof_doc?.length || 0})`);
  } else {
    console.error('  ❌ BOM-713 NOT found in mapped list!');
    process.exit(1);
  }

  const oldest = mappedRows[mappedRows.length - 1];
  const newest = mappedRows[0];
  console.log(`  ✅ First record: ${newest.id} (${newest.customer_name})`);
  console.log(`  ✅ Last record: ${oldest.id} (${oldest.customer_name})`);

  // Dry run vs Execution
  if (!isExecute) {
    console.log('\n================================================================');
    console.log('✅ DRY RUN COMPLETED SUCCESSFULLY: 53 records ready for migration.');
    console.log('To execute migration, re-run with --execute flag:');
    console.log('node scripts/migrate_bom_store_to_supabase.js --execute');
    console.log('================================================================\n');
    return;
  }

  // EXECUTION
  console.log('\nStep 5: Executing batch upsert into public.bom_orders (batch size = 15)...');
  const batchSize = 15;
  let insertedTotal = 0;

  for (let i = 0; i < mappedRows.length; i += batchSize) {
    const batch = mappedRows.slice(i, i + batchSize);
    const { data: upsertData, error: upsertErr } = await supabase
      .from('bom_orders')
      .upsert(batch, { onConflict: 'id' });

    if (upsertErr) {
      console.error(`❌ Error upserting batch ${i / batchSize + 1}:`, upsertErr.message);
      process.exit(1);
    }
    insertedTotal += batch.length;
    console.log(`  Upserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} rows (${insertedTotal}/${mappedRows.length})`);
  }

  // Verify target table count after migration
  const { count: targetAfterCount } = await supabase
    .from('bom_orders')
    .select('*', { count: 'exact', head: true });

  console.log(`\nStep 6: Target public.bom_orders row count AFTER migration: ${targetAfterCount}`);

  if (targetAfterCount === mappedRows.length) {
    console.log('\n================================================================');
    console.log(`🎉 SUCCESS: ${targetAfterCount} BOM records migrated to public.bom_orders!`);
    console.log('================================================================\n');
  } else {
    console.error(`❌ Row count mismatch! Expected ${mappedRows.length}, found ${targetAfterCount}`);
    process.exit(1);
  }
}

run();
