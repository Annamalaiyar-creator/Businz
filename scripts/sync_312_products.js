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

const extraProducts = [
  {
    code: "ALU-LEN-2414MM",
    sku: "ALU-LEN-2414MM",
    itemId: "RM-ALU-LEN-2414MM",
    name: "Aluminium Length (2414 mm)",
    cat: "Aluminium Profiles",
    category: "Aluminium Profiles",
    unit: "Length",
    uom: "Length",
    price: 580,
    rate: 580,
    gstRate: "18%",
    status: "Out of Stock",
    productType: "goods",
    store: "Bay #1 - Extrusion Yard",
    location: "Bay #1 - Extrusion Yard",
    hsn: "7604",
    minLevel: 15,
    reorderLevel: 50,
    id: "RM-ALU-LEN-2414MM",
    description: "Aluminium Length 2414 mm for Solar Structure",
    purchaseRate: 580,
    purchaseDescription: "",
    material: "Aluminium Profile",
    stock: 0,
    openingStock: 0,
    physicalStock: 0,
    availableStock: 0,
    stockOnHand: 0,
    reserved: 0,
    blockedForBom: 0,
    goodsReceived: 0,
    issuedProd: 0,
    matReturn: 0,
    stockAdj: 0,
    lastUpdated: "System Sync"
  },
  {
    code: "ALU-BAR-2650MM",
    sku: "ALU-BAR-2650MM",
    itemId: "RM-ALU-BAR-2650MM",
    name: "Aluminium Extrusion Bar (2650 mm)",
    cat: "Aluminium Profiles",
    category: "Aluminium Profiles",
    unit: "Length",
    uom: "Length",
    price: 620,
    rate: 620,
    gstRate: "18%",
    status: "Out of Stock",
    productType: "goods",
    store: "Bay #1 - Extrusion Yard",
    location: "Bay #1 - Extrusion Yard",
    hsn: "7604",
    minLevel: 20,
    reorderLevel: 50,
    id: "RM-ALU-BAR-2650MM",
    description: "Aluminium Extrusion Bar 2650 mm",
    purchaseRate: 620,
    purchaseDescription: "",
    material: "Aluminium Profile",
    stock: 0,
    openingStock: 0,
    physicalStock: 0,
    availableStock: 0,
    stockOnHand: 0,
    reserved: 0,
    blockedForBom: 0,
    goodsReceived: 0,
    issuedProd: 0,
    matReturn: 0,
    stockAdj: 0,
    lastUpdated: "System Sync"
  },
  {
    code: "RM-ALU-6000",
    sku: "RM-ALU-6000",
    itemId: "RM-ALU-6000",
    name: "Aluminium Profile 6000mm Length",
    cat: "Aluminium Profiles",
    category: "Aluminium Profiles",
    unit: "Lengths",
    uom: "Lengths",
    price: 1450,
    rate: 1450,
    gstRate: "18%",
    status: "Out of Stock",
    productType: "goods",
    store: "Main Raw Material Warehouse - Rack A1",
    location: "Main Raw Material Warehouse - Rack A1",
    hsn: "7604",
    minLevel: 20,
    reorderLevel: 50,
    id: "RM-ALU-6000",
    description: "Aluminium Profile 6000mm Length Heavy Duty",
    purchaseRate: 1450,
    purchaseDescription: "",
    material: "Aluminium Profile",
    stock: 0,
    openingStock: 0,
    physicalStock: 0,
    availableStock: 0,
    stockOnHand: 0,
    reserved: 0,
    blockedForBom: 0,
    goodsReceived: 0,
    issuedProd: 0,
    matReturn: 0,
    stockAdj: 0,
    lastUpdated: "System Sync"
  }
];

async function sync312Products() {
  console.log('--- Syncing full 312 products master list ---');

  // 1. Update raw_materials_store.json
  const rawPath = path.join(projectRoot, 'server', 'raw_materials_store.json');
  let rawList = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  const rawCodes = new Set(rawList.map(r => r.code));

  extraProducts.forEach(ep => {
    if (!rawCodes.has(ep.code)) {
      rawList.push(ep);
      rawCodes.add(ep.code);
    }
  });
  fs.writeFileSync(rawPath, JSON.stringify(rawList, null, 2), 'utf8');
  console.log(`✓ server/raw_materials_store.json now has ${rawList.length} items`);

  // 2. Update item_store.json
  const itemPath = path.join(projectRoot, 'server', 'item_store.json');
  let itemList = JSON.parse(fs.readFileSync(itemPath, 'utf8'));
  const itemCodes = new Set(itemList.map(r => r.code));

  extraProducts.forEach(ep => {
    if (!itemCodes.has(ep.code)) {
      itemList.push(ep);
      itemCodes.add(ep.code);
    }
  });
  fs.writeFileSync(itemPath, JSON.stringify(itemList, null, 2), 'utf8');
  console.log(`✓ server/item_store.json now has ${itemList.length} items`);

  // 3. Sync to Supabase
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
      duration: String(data.length),
      type: 'Store'
    };

    if (records && records.length > 0) {
      await supabase.from('leaves').update(payload).eq('id', records[0].id);
      if (records.length > 1) {
        const excessIds = records.slice(1).map(r => r.id);
        await supabase.from('leaves').delete().in('id', excessIds);
      }
      console.log(`✓ Updated Supabase key ${employeeKey} (${data.length} records)`);
    } else {
      await supabase.from('leaves').insert(payload);
      console.log(`✓ Inserted Supabase key ${employeeKey} (${data.length} records)`);
    }
  };

  try {
    await pushToSupabase('raw_materials_store', rawList);
    await pushToSupabase('item_store', itemList);
  } catch (err) {
    console.error('Supabase update notice:', err.message);
  }

  // 4. Update running local server memory cache and SSE
  try {
    const postServer = async (endpoint, data) => {
      await fetch(`http://localhost:5001/api/store/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });
    };
    await postServer('raw_materials_store', rawList);
    await postServer('item_store', itemList);
    console.log('✓ Successfully notified running local server & broadcasted SSE');
  } catch (err) {
    console.log('Local server notification notice:', err.message);
  }
}

sync312Products();
