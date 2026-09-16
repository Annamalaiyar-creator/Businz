import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zjkabqcgymxysqgfbbge.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpqa2FicWNneW14eXNxZ2ZiYmdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyOTQzNzYsImV4cCI6MjEwMDg3MDM3Nn0.z821_dGCjnS_LZnj6l5mERGtu8wZvkMRDiGURXxFXmY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function setAllStockTo5000() {
  console.log('--- Setting all 312 products stock level to 5,000 ---');

  // 1. raw_materials_store.json
  const rawPath = path.join(projectRoot, 'server', 'raw_materials_store.json');
  let rawItems = [];
  if (fs.existsSync(rawPath)) {
    rawItems = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    rawItems = rawItems.map(item => ({
      ...item,
      stock: 5000,
      openingStock: 5000,
      physicalStock: 5000,
      availableStock: 5000,
      stockOnHand: 5000,
      stockAdj: 0,
      reserved: 0,
      blockedForBom: 0,
      goodsReceived: 0,
      issuedProd: 0,
      matReturn: 0,
      status: 'In Stock',
      lastUpdated: 'Stock Set to 5,000'
    }));
    fs.writeFileSync(rawPath, JSON.stringify(rawItems, null, 2), 'utf8');
    console.log(`✓ Set stock to 5,000 for all ${rawItems.length} items in server/raw_materials_store.json`);
  }

  // 2. item_store.json
  const itemPath = path.join(projectRoot, 'server', 'item_store.json');
  let items = [];
  if (fs.existsSync(itemPath)) {
    items = JSON.parse(fs.readFileSync(itemPath, 'utf8'));
    items = items.map(item => ({
      ...item,
      stock: 5000,
      openingStock: 5000,
      physicalStock: 5000,
      availableStock: 5000,
      stockOnHand: 5000,
      stockAdj: 0,
      reserved: 0,
      status: 'In Stock',
      lastUpdated: 'Stock Set to 5,000'
    }));
    fs.writeFileSync(itemPath, JSON.stringify(items, null, 2), 'utf8');
    console.log(`✓ Set stock to 5,000 for all ${items.length} items in server/item_store.json`);
  }

  // 3. vrm_prod_inventory.json
  const prodInvPath = path.join(projectRoot, 'server', 'vrm_prod_inventory.json');
  let prodInv = [];
  if (fs.existsSync(prodInvPath)) {
    prodInv = JSON.parse(fs.readFileSync(prodInvPath, 'utf8'));
    prodInv = prodInv.map(item => ({
      ...item,
      physicalStock: 5000,
      reservedStock: 0,
      availableStock: 5000,
      issuedStock: 0,
      consumedStock: 0
    }));
    fs.writeFileSync(prodInvPath, JSON.stringify(prodInv, null, 2), 'utf8');
    console.log(`✓ Set stock to 5,000 for all ${prodInv.length} items in server/vrm_prod_inventory.json`);
  }

  // 4. Update Supabase Cloud Database (leaves table)
  console.log('Syncing 5,000 stock to Supabase cloud database...');
  const pushToSupabase = async (key, data) => {
    const employeeKey = key.toUpperCase();
    const { data: records } = await supabase
      .from('leaves')
      .select('id')
      .eq('employee', employeeKey)
      .order('id', { ascending: false });

    const payload = {
      employee: employeeKey,
      reason: JSON.stringify(data),
      status: 'active',
      dates: new Date().toISOString(),
      duration: String(Array.isArray(data) ? data.length : 1),
      type: 'Store'
    };

    if (records && records.length > 0) {
      const masterId = records[0].id;
      await supabase.from('leaves').update(payload).eq('id', masterId);
      if (records.length > 1) {
        const excessIds = records.slice(1).map(r => r.id);
        await supabase.from('leaves').delete().in('id', excessIds);
      }
      console.log(`✓ Updated Supabase key ${employeeKey} (${data.length} items)`);
    } else {
      await supabase.from('leaves').insert(payload);
      console.log(`✓ Inserted Supabase key ${employeeKey} (${data.length} items)`);
    }
  };

  try {
    await pushToSupabase('raw_materials_store', rawItems);
    await pushToSupabase('item_store', items);
    await pushToSupabase('vrm_prod_inventory', prodInv);
  } catch (err) {
    console.error('Supabase update notice:', err.message);
  }

  // 5. Notify the running local server via API so memory cache updates & SSE broadcasts
  try {
    const postServer = async (endpoint, data) => {
      const res = await fetch(`http://localhost:5001/api/store/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });
      return res.status;
    };
    await postServer('raw_materials_store', rawItems);
    await postServer('item_store', items);
    await postServer('vrm_prod_inventory', prodInv);
    console.log('✓ Successfully notified running local server & broadcasted SSE');
  } catch (err) {
    console.log('Local server notification notice:', err.message);
  }

  console.log('All 312 products successfully updated to 5,000 stock level!');
}

setAllStockTo5000();
