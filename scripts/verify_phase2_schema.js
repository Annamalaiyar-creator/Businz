import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(url, key);

async function verify() {
  console.log('====================================================');
  console.log('🔍 VERIFYING PHASE 2 SUPABASE SCHEMA EXECUTION');
  console.log('====================================================');

  const tables = [
    'company_branding', 'vendors', 'customers', 'items', 'raw_materials',
    'bom_presets', 'leads', 'opportunities', 'quotations', 'whatsapp_conversations',
    'proforma_invoices', 'goods_receipt_notes', 'bom_orders', 'production_work_orders',
    'production_inventory', 'production_recipes', 'production_ledger', 'invoices',
    'payments', 'notifications', 'media_assets'
  ];

  let allTablesExist = true;
  const tableStatus = {};

  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      allTablesExist = false;
      tableStatus[t] = `❌ Missing (${error.message})`;
    } else {
      const { count } = await supabase.from(t).select('*', { count: 'exact' });
      tableStatus[t] = `✅ Exists (row count: ${count !== null ? count : 0})`;
    }
  }

  console.log('\n--- 21 New Tables Status ---');
  for (const [t, status] of Object.entries(tableStatus)) {
    console.log(`  ${t.padEnd(28)}: ${status}`);
  }

  // Check 16 PO columns
  const { data: poSample, error: poErr } = await supabase.from('purchase_orders').select('*').limit(1);
  const poCols = poSample && poSample.length > 0 ? Object.keys(poSample[0]) : [];
  
  const expectedCols = [
    'branch', 'contact_person', 'contact_no', 'email', 'gst_no',
    'delivery_address', 'billing_address', 'payment_terms', 'purchaser',
    'approval_remarks', 'approval_date', 'approval_time', 'payment_details',
    'proceed_details', 'delivery_type', 'pdf_name'
  ];

  console.log('\n--- Purchase Orders 16 New Columns Status ---');
  let allColsExist = true;
  for (const col of expectedCols) {
    const exists = poCols.includes(col);
    if (!exists) allColsExist = false;
    console.log(`  ${col.padEnd(25)}: ${exists ? '✅ Present' : '❌ Missing'}`);
  }

  // Row counts for existing tables
  const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact' });
  const { count: poCount } = await supabase.from('purchase_orders').select('*', { count: 'exact' });
  const { count: leavesCount } = await supabase.from('leaves').select('*', { count: 'exact' });
  const { count: crsCount } = await supabase.from('controlroom_store').select('*', { count: 'exact' });

  console.log('\n--- Preserved Existing Tables Row Counts ---');
  console.log(`  users               : ${usersCount} (expected: 30)`);
  console.log(`  purchase_orders     : ${poCount} (expected: 98)`);
  console.log(`  leaves              : ${leavesCount} (expected: 273)`);
  console.log(`  controlroom_store   : ${crsCount} (expected: 4)`);

  console.log('====================================================');
  if (allTablesExist && allColsExist) {
    console.log('🎉 ALL 21 TABLES & 16 PO COLUMNS CONFIRMED IN SUPABASE!');
  } else {
    console.log('⏳ Tables/Columns pending execution in Supabase.');
  }
}

verify().catch(console.error);
