import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error('Missing Supabase configuration.');
  process.exit(1);
}

const supabase = createClient(url, key);

async function compareCustomerData() {
  const custStore = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../server/customer_store.json'), 'utf8'));
  const crmCust = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../server/crm_customers.json'), 'utf8'));
  
  const { data: leavesRows } = await supabase
    .from('leaves')
    .select('reason')
    .eq('employee', 'CUSTOMER_STORE')
    .order('id', { ascending: false })
    .limit(1);

  const leavesCust = leavesRows && leavesRows.length > 0 ? JSON.parse(leavesRows[0].reason) : [];

  console.log(`Counts -> customer_store: ${custStore.length}, crm_customers: ${crmCust.length}, leaves: ${leavesCust.length}`);

  // Normalize key helper
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  const unifiedMap = new Map();

  function processRecord(rec, sourceName) {
    if (!rec) return;
    const code = rec.customerCode || rec.code || rec.customer_code || rec.id;
    const company = rec.companyName || rec.company_name || rec.c2 || rec.name || rec.customerName;
    const zohoId = rec.zohoContactId || rec.zoho_contact_id;

    // determine match key:
    let matchKey = '';
    if (code && code.startsWith('CUST-')) {
      matchKey = 'code_' + norm(code);
    } else if (zohoId && zohoId !== '—' && zohoId.length > 5) {
      matchKey = 'zoho_' + norm(zohoId);
    } else if (company) {
      matchKey = 'comp_' + norm(company);
    } else {
      matchKey = 'id_' + norm(rec.id);
    }

    if (!unifiedMap.has(matchKey)) {
      unifiedMap.set(matchKey, {
        sources: [sourceName],
        records: { [sourceName]: rec }
      });
    } else {
      const entry = unifiedMap.get(matchKey);
      entry.sources.push(sourceName);
      entry.records[sourceName] = rec;
    }
  }

  custStore.forEach(r => processRecord(r, 'customer_store'));
  crmCust.forEach(r => processRecord(r, 'crm_customers'));
  leavesCust.forEach(r => processRecord(r, 'leaves_customer_store'));

  console.log(`Total unique customer entities across all 3 sources: ${unifiedMap.size}`);

  let multiSourceCount = 0;
  let singleSourceCount = 0;

  for (const [k, v] of unifiedMap.entries()) {
    if (v.sources.length > 1) {
      multiSourceCount++;
    } else {
      singleSourceCount++;
    }
  }

  console.log(`Entities appearing in multiple sources: ${multiSourceCount}`);
  console.log(`Entities appearing in only 1 source: ${singleSourceCount}`);

  // Print all entities with summary
  let idx = 1;
  for (const [k, v] of unifiedMap.entries()) {
    const r = v.records;
    const name = (r.crm_customers?.companyName || r.customer_store?.companyName || r.leaves_customer_store?.companyName || r.crm_customers?.customerName || 'Unknown');
    const code = (r.crm_customers?.customerCode || r.customer_store?.customerCode || r.leaves_customer_store?.customerCode || 'None');
    console.log(`${idx++}. [Key: ${k}] Name: "${name}", Code: "${code}", Sources: [${v.sources.join(', ')}]`);
  }
}

compareCustomerData();
