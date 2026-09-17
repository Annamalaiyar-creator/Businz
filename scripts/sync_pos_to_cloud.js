import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ognmvcpzlebrvdynunwh.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function syncPOsToCloud() {
  console.log('[PO CLOUD SYNC] Starting sync of Purchase Orders to Cloud Database...');
  console.log(`[PO CLOUD SYNC] Target Supabase URL: ${SUPABASE_URL}`);

  const poStorePath = path.resolve(__dirname, '../server/po_store.json');
  if (!fs.existsSync(poStorePath)) {
    console.error(`[PO CLOUD SYNC] Error: ${poStorePath} does not exist.`);
    return false;
  }

  const pos = JSON.parse(fs.readFileSync(poStorePath, 'utf8'));
  console.log(`[PO CLOUD SYNC] Loaded ${pos.length} Purchase Orders from local disk store (including ${pos.map(p => p.poNo).join(', ')}).`);

  // 1. Sync to public.leaves table (PO_STORE)
  try {
    const employeeKey = 'PO_STORE';
    const payload = {
      employee: employeeKey,
      reason: JSON.stringify(pos),
      status: 'active',
      dates: new Date().toISOString(),
      duration: String(pos.length),
      type: 'Store'
    };

    const { data: records, error: selectErr } = await supabase
      .from('leaves')
      .select('id')
      .eq('employee', employeeKey)
      .order('id', { ascending: false });

    if (selectErr) {
      console.warn(`[PO CLOUD SYNC] Table 'leaves' not ready or error: ${selectErr.message}`);
    } else {
      if (records && records.length > 0) {
        const masterId = records[0].id;
        await supabase.from('leaves').update(payload).eq('id', masterId);
        if (records.length > 1) {
          const excessIds = records.slice(1).map(r => r.id);
          await supabase.from('leaves').delete().in('id', excessIds).catch(() => {});
        }
        console.log(`[PO CLOUD SYNC] Updated ${pos.length} POs in public.leaves (Record ID: ${masterId})`);
      } else {
        const { data: inserted } = await supabase.from('leaves').insert(payload).select();
        console.log(`[PO CLOUD SYNC] Inserted ${pos.length} POs into public.leaves (Record ID: ${inserted?.[0]?.id})`);
      }
    }
  } catch (err) {
    console.warn(`[PO CLOUD SYNC] leaves sync exception: ${err.message}`);
  }

  // 2. Sync to public.controlroom_store table
  try {
    const { error: crErr } = await supabase
      .from('controlroom_store')
      .upsert({
        key: 'po_store',
        data: pos,
        record_count: pos.length,
        updated_at: new Date().toISOString(),
        updated_by: 'sync_script'
      }, { onConflict: 'key' });

    if (!crErr) {
      console.log(`[PO CLOUD SYNC] Synced ${pos.length} POs into public.controlroom_store`);
    }
  } catch (err) {}

  // 3. Sync individual rows to public.purchase_orders table
  try {
    const poRows = pos.map(p => ({
      id: p.id || p.po_id || `po_${p.poNo || Date.now()}`,
      po_number: p.poNo || p.purchaseorder_number || 'UNKNOWN',
      vendor_name: p.vendorName || p.vendor || 'Unknown Vendor',
      vendor_id: p.vendorId || null,
      order_date: p.orderDate || p.date || new Date().toISOString().split('T')[0],
      expected_delivery_date: p.deliveryDate || null,
      total_amount: Number(p.totalAmount || p.total || 0),
      status: p.status || 'Draft',
      status_type: (p.status || 'draft').toLowerCase(),
      approved_by: p.approvedBy || null,
      line_items: p.lineItems || p.items || [],
      notes: p.notes || '',
      updated_at: new Date().toISOString()
    }));

    const { error: poRowErr } = await supabase
      .from('purchase_orders')
      .upsert(poRows, { onConflict: 'po_number' });

    if (!poRowErr) {
      console.log(`[PO CLOUD SYNC] Synced ${poRows.length} individual PO rows to public.purchase_orders`);
    }
  } catch (err) {}

  console.log(`\n======================================================`);
  console.log(` All POs (${pos.map(p => p.poNo).join(', ')}) sync attempt completed!`);
  console.log(`======================================================\n`);
  return true;
}

syncPOsToCloud();
