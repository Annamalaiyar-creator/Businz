import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://ognmvcpzlebrvdynunwh.supabase.co';
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(url, key);

async function inspectCustomers() {
  console.log('--- 1. INSPECTING public.customers TABLE ---');
  const { data: sample, error, count } = await supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .limit(5);

  if (error) {
    console.error('Error querying public.customers:', error);
    return;
  }

  console.log(`Table exists! Total rows currently in public.customers: ${count}`);
  if (sample && sample.length > 0) {
    console.log('Sample existing rows:', JSON.stringify(sample, null, 2));
    console.log('Columns in public.customers:', Object.keys(sample[0]));
  } else {
    console.log('Table is currently empty (0 rows).');
  }

  console.log('\n--- 2. INSPECTING customer_store.json ON DISK ---');
  const custStorePath = path.resolve(__dirname, '../server/customer_store.json');
  let custStoreJson = [];
  if (fs.existsSync(custStorePath)) {
    custStoreJson = JSON.parse(fs.readFileSync(custStorePath, 'utf8'));
    console.log(`customer_store.json has ${custStoreJson.length} records.`);
    if (custStoreJson.length > 0) {
      console.log('Sample customer_store.json keys:', Object.keys(custStoreJson[0]));
      console.log('First record:', custStoreJson[0]);
    }
  } else {
    console.log('customer_store.json NOT found on disk.');
  }

  console.log('\n--- 3. INSPECTING crm_customers.json ON DISK ---');
  const crmCustPath = path.resolve(__dirname, '../server/crm_customers.json');
  let crmCustJson = [];
  if (fs.existsSync(crmCustPath)) {
    crmCustJson = JSON.parse(fs.readFileSync(crmCustPath, 'utf8'));
    console.log(`crm_customers.json has ${crmCustJson.length} records.`);
    if (crmCustJson.length > 0) {
      console.log('Sample crm_customers.json keys:', Object.keys(crmCustJson[0]));
      console.log('First record:', crmCustJson[0]);
    }
  } else {
    console.log('crm_customers.json NOT found on disk.');
  }

  console.log('\n--- 4. INSPECTING leaves WHERE employee = "CUSTOMER_STORE" ---');
  const { data: leavesRows, error: leavesErr } = await supabase
    .from('leaves')
    .select('id, employee, reason, dates, duration')
    .eq('employee', 'CUSTOMER_STORE')
    .order('id', { ascending: false });

  if (leavesErr) {
    console.error('Error fetching leaves CUSTOMER_STORE:', leavesErr);
  } else {
    console.log(`Found ${leavesRows.length} rows in leaves for CUSTOMER_STORE.`);
    if (leavesRows.length > 0) {
      try {
        const parsed = JSON.parse(leavesRows[0].reason);
        console.log(`Latest leaves row (id: ${leavesRows[0].id}) contains ${Array.isArray(parsed) ? parsed.length : 'non-array'} customer entries.`);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log('Sample leaves entry keys:', Object.keys(parsed[0]));
          console.log('First entry in leaves reason:', parsed[0]);
        }
      } catch (e) {
        console.log('Could not parse reason as JSON:', e.message);
      }
    }
  }
}

inspectCustomers();
