import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey || !supabaseUrl) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const serverDir = path.resolve(__dirname, '../server');

// Stores to completely empty ([] / 0 records)
const EMPTY_STORES = [
  'bom_store',
  'sales_pi_store',
  'proforma_invoice_store',
  'procurement_pi_store',
  'po_store',
  'grn_store',
  'invoice_store',
  'payment_store',
  'workorder_store',
  'vrm_prod_workorders',
  'vrm_prod_ledger',
  'notifications_store'
];

// Leaves table keys to reset to '[]'
const EMPTY_LEAVES_KEYS = [
  'BOM_STORE',
  'SALES_PI_STORE',
  'PROFORMA_INVOICE_STORE',
  'PROCUREMENT_PI_STORE',
  'PO_STORE',
  'GRN_STORE',
  'INVOICE_STORE',
  'PAYMENT_STORE',
  'WORKORDER_STORE',
  'VRM_PROD_WORKORDERS',
  'VRM_PROD_LEDGER',
  'JOBWORKS_STORE',
  'RESERVATIONS_STORE',
  'NOTIFICATIONS_STORE'
];

async function runReset() {
  console.log('====================================================');
  console.log('🧹 BUSINZ ERP - FULL OPERATIONAL DATA & STOCK RESET');
  console.log('====================================================\n');

  // STEP 1: Wipe Supabase bom_orders table
  console.log('1️⃣  Wiping Supabase bom_orders table...');
  const { data: bomsBefore, count: bomCountBefore } = await supabaseAdmin
    .from('bom_orders')
    .select('id', { count: 'exact' });
  console.log(`   Found ${bomCountBefore || 0} rows in bom_orders.`);

  if (bomCountBefore > 0) {
    // Delete all records in batches or with neq
    const { error: bomDelErr } = await supabaseAdmin
      .from('bom_orders')
      .delete()
      .neq('id', '___NEVER_MATCH___');
    if (bomDelErr) {
      console.error('❌ Error wiping bom_orders:', bomDelErr.message);
    } else {
      console.log('   ✅ bom_orders table completely wiped.');
    }
  }

  // STEP 2: Wipe Supabase invoices table
  console.log('\n2️⃣  Wiping Supabase invoices table...');
  const { count: invCountBefore } = await supabaseAdmin
    .from('invoices')
    .select('id', { count: 'exact' });
  console.log(`   Found ${invCountBefore || 0} rows in invoices.`);

  if (invCountBefore > 0) {
    const { error: invDelErr } = await supabaseAdmin
      .from('invoices')
      .delete()
      .neq('id', '___NEVER_MATCH___');
    if (invDelErr) {
      console.error('❌ Error wiping invoices:', invDelErr.message);
    } else {
      console.log('   ✅ invoices table completely wiped.');
    }
  }

  // STEP 3: Wipe Supabase purchase_orders table if exists
  console.log('\n3️⃣  Checking Supabase purchase_orders table...');
  try {
    const { count: poCount } = await supabaseAdmin
      .from('purchase_orders')
      .select('id', { count: 'exact' });
    if (poCount > 0) {
      await supabaseAdmin.from('purchase_orders').delete().neq('id', '___NEVER_MATCH___');
      console.log(`   ✅ Wiped ${poCount} rows from purchase_orders.`);
    } else {
      console.log('   ✅ purchase_orders table is already empty (0 rows).');
    }
  } catch (_) {}

  // STEP 4: Reset leaves table keys for operational stores
  console.log('\n4️⃣  Resetting Supabase leaves table store records...');
  for (const key of EMPTY_LEAVES_KEYS) {
    const { data: existingRows } = await supabaseAdmin
      .from('leaves')
      .select('id')
      .eq('employee', key);

    if (existingRows && existingRows.length > 0) {
      const ids = existingRows.map(r => r.id);
      await supabaseAdmin.from('leaves').delete().in('id', ids);
    }

    // Insert clean empty array
    await supabaseAdmin.from('leaves').insert({
      employee: key,
      reason: '[]',
      dates: new Date().toISOString(),
      status: 'active',
      type: 'Store'
    });
    console.log(`   ✅ leaves.${key} reset to '[]'`);
  }

  // Reset BOM_SEQUENCE in leaves
  console.log('\n5️⃣  Resetting BOM_SEQUENCE in leaves...');
  const { data: seqRows } = await supabaseAdmin
    .from('leaves')
    .select('id')
    .eq('employee', 'BOM_SEQUENCE');
  if (seqRows && seqRows.length > 0) {
    await supabaseAdmin.from('leaves').delete().in('id', seqRows.map(r => r.id));
  }
  await supabaseAdmin.from('leaves').insert({
    employee: 'BOM_SEQUENCE',
    reason: JSON.stringify({ lastNumber: 0, updatedAt: new Date().toISOString() }),
    dates: new Date().toISOString(),
    status: 'active',
    duration: '0',
    type: 'Sequence'
  });
  console.log('   ✅ leaves.BOM_SEQUENCE reset to 0');

  // STEP 5: Reset Local Disk Operational Stores to []
  console.log('\n6️⃣  Resetting local server disk operational stores to []...');
  for (const store of EMPTY_STORES) {
    const filePath = path.join(serverDir, `${store}.json`);
    fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf8');
    console.log(`   ✅ server/${store}.json reset to []`);
  }

  // Also clean optional local files if they exist
  const optFiles = ['vrm_prod_ledger.json', 'grn_store.json', 'jobworks_store.json'];
  for (const f of optFiles) {
    const fp = path.join(serverDir, f);
    if (fs.existsSync(fp)) {
      fs.writeFileSync(fp, JSON.stringify([], null, 2), 'utf8');
    }
  }

  // STEP 6: Reset Inventory Stock to exactly 5,000 available, 0 reserved
  console.log('\n7️⃣  Resetting item_store.json stock to 5,000 available, 0 reserved...');
  const itemStorePath = path.join(serverDir, 'item_store.json');
  let items = [];
  if (fs.existsSync(itemStorePath)) {
    items = JSON.parse(fs.readFileSync(itemStorePath, 'utf8'));
  }

  const resetItems = items.map(item => ({
    ...item,
    stock: 5000,
    openingStock: 5000,
    physicalStock: 5000,
    availableStock: 5000,
    stockOnHand: 5000,
    available: 5000,
    onHand: 5000,
    reserved: 0,
    reservedStock: 0,
    blockedForBom: 0,
    goodsReceived: 0,
    issuedProd: 0,
    matReturn: 0,
    stockAdj: 0,
    status: 'In Stock',
    lastUpdated: 'Stock Reset to 5,000'
  }));

  fs.writeFileSync(itemStorePath, JSON.stringify(resetItems, null, 2), 'utf8');
  console.log(`   ✅ Reset ${resetItems.length} items in server/item_store.json to 5,000 available / 0 reserved.`);

  // Reset raw_materials_store.json
  console.log('\n8️⃣  Resetting raw_materials_store.json stock to 5,000 available, 0 reserved...');
  const rawMatPath = path.join(serverDir, 'raw_materials_store.json');
  let rawMats = [];
  if (fs.existsSync(rawMatPath)) {
    rawMats = JSON.parse(fs.readFileSync(rawMatPath, 'utf8'));
  }

  const resetRawMats = rawMats.map(mat => ({
    ...mat,
    stock: 5000,
    openingStock: 5000,
    physicalStock: 5000,
    availableStock: 5000,
    stockOnHand: 5000,
    available: 5000,
    onHand: 5000,
    reserved: 0,
    reservedStock: 0,
    blockedForBom: 0,
    goodsReceived: 0,
    issuedProd: 0,
    matReturn: 0,
    stockAdj: 0,
    status: 'In Stock',
    lastUpdated: 'Stock Reset to 5,000'
  }));

  fs.writeFileSync(rawMatPath, JSON.stringify(resetRawMats, null, 2), 'utf8');
  console.log(`   ✅ Reset ${resetRawMats.length} raw materials in server/raw_materials_store.json to 5,000 available / 0 reserved.`);

  // Reset vrm_prod_inventory.json
  console.log('\n9️⃣  Resetting vrm_prod_inventory.json stock to 5,000 available, 0 reserved...');
  const vrmInvPath = path.join(serverDir, 'vrm_prod_inventory.json');
  let vrmInv = [];
  if (fs.existsSync(vrmInvPath)) {
    vrmInv = JSON.parse(fs.readFileSync(vrmInvPath, 'utf8'));
  }

  const resetVrmInv = vrmInv.map(inv => ({
    ...inv,
    stock: 5000,
    openingStock: 5000,
    physicalStock: 5000,
    availableStock: 5000,
    reservedStock: 0,
    issuedStock: 0,
    consumedStock: 0,
    status: 'In Stock'
  }));

  fs.writeFileSync(vrmInvPath, JSON.stringify(resetVrmInv, null, 2), 'utf8');
  console.log(`   ✅ Reset ${resetVrmInv.length} inventory records in server/vrm_prod_inventory.json.`);

  // STEP 7: Sync reset inventory to Supabase leaves table
  console.log('\n🔟  Syncing reset inventory to Supabase leaves table...');
  // ITEM_STORE
  const { data: itemLeaves } = await supabaseAdmin.from('leaves').select('id').eq('employee', 'ITEM_STORE');
  if (itemLeaves && itemLeaves.length > 0) {
    await supabaseAdmin.from('leaves').delete().in('id', itemLeaves.map(r => r.id));
  }
  await supabaseAdmin.from('leaves').insert({
    employee: 'ITEM_STORE',
    reason: JSON.stringify(resetItems),
    dates: new Date().toISOString(),
    status: 'active',
    type: 'Store'
  });
  console.log('   ✅ leaves.ITEM_STORE updated with 5,000 stock items.');

  // RAW_MATERIALS_STORE
  const { data: rmLeaves } = await supabaseAdmin.from('leaves').select('id').eq('employee', 'RAW_MATERIALS_STORE');
  if (rmLeaves && rmLeaves.length > 0) {
    await supabaseAdmin.from('leaves').delete().in('id', rmLeaves.map(r => r.id));
  }
  await supabaseAdmin.from('leaves').insert({
    employee: 'RAW_MATERIALS_STORE',
    reason: JSON.stringify(resetRawMats),
    dates: new Date().toISOString(),
    status: 'active',
    type: 'Store'
  });
  console.log('   ✅ leaves.RAW_MATERIALS_STORE updated with 5,000 stock raw materials.');

  // VRM_PROD_INVENTORY
  const { data: vrmLeaves } = await supabaseAdmin.from('leaves').select('id').eq('employee', 'VRM_PROD_INVENTORY');
  if (vrmLeaves && vrmLeaves.length > 0) {
    await supabaseAdmin.from('leaves').delete().in('id', vrmLeaves.map(r => r.id));
  }
  await supabaseAdmin.from('leaves').insert({
    employee: 'VRM_PROD_INVENTORY',
    reason: JSON.stringify(resetVrmInv),
    dates: new Date().toISOString(),
    status: 'active',
    type: 'Store'
  });
  console.log('   ✅ leaves.VRM_PROD_INVENTORY updated with 5,000 stock items.');

  console.log('\n====================================================');
  console.log('🔍 FINAL VERIFICATION:');
  console.log('====================================================');

  const { count: finalBomOrders } = await supabaseAdmin.from('bom_orders').select('*', { count: 'exact', head: true });
  const { count: finalInvoices } = await supabaseAdmin.from('invoices').select('*', { count: 'exact', head: true });

  console.log(`Supabase bom_orders count: ${finalBomOrders} (Expected: 0)`);
  console.log(`Supabase invoices count:   ${finalInvoices} (Expected: 0)`);

  const serverBom = JSON.parse(fs.readFileSync(path.join(serverDir, 'bom_store.json'), 'utf8'));
  const serverPi = JSON.parse(fs.readFileSync(path.join(serverDir, 'sales_pi_store.json'), 'utf8'));
  const serverPo = JSON.parse(fs.readFileSync(path.join(serverDir, 'po_store.json'), 'utf8'));
  const serverInv = JSON.parse(fs.readFileSync(path.join(serverDir, 'invoice_store.json'), 'utf8'));
  const serverWo = JSON.parse(fs.readFileSync(path.join(serverDir, 'workorder_store.json'), 'utf8'));
  const serverItems = JSON.parse(fs.readFileSync(path.join(serverDir, 'item_store.json'), 'utf8'));

  console.log(`server/bom_store.json:      ${serverBom.length} (Expected: 0)`);
  console.log(`server/sales_pi_store.json: ${serverPi.length} (Expected: 0)`);
  console.log(`server/po_store.json:       ${serverPo.length} (Expected: 0)`);
  console.log(`server/invoice_store.json:  ${serverInv.length} (Expected: 0)`);
  console.log(`server/workorder_store.json:${serverWo.length} (Expected: 0)`);
  console.log(`server/item_store.json:     ${serverItems.length} items, Available Stock = ${serverItems[0].availableStock}, Reserved = ${serverItems[0].reserved}`);

  console.log('\n🎉 ALL OPERATIONAL DATA CLEARED & STOCK RESET TO 5000 SUCCESSFULLY!');
}

runReset().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error during reset:', err);
  process.exit(1);
});
