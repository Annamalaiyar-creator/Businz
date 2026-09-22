import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { getCanonicalMergedCustomers } from './merge_customers.js';

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

async function migrateCustomers() {
  console.log('====================================================');
  console.log('🚀 MIGRATING CANONICAL CUSTOMERS TO public.customers');
  console.log('====================================================');

  const customers = await getCanonicalMergedCustomers();
  console.log(`Found ${customers.length} canonical merged customers to import.`);

  // Verify public.customers before insert
  const { count: beforeCount, error: countErr } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    console.error('Error checking public.customers count:', countErr);
    return;
  }
  console.log(`Existing rows in public.customers before migration: ${beforeCount}`);

  // Format records strictly to match public.customers schema
  const rowsToInsert = customers.map(c => ({
    id: c.id,
    customer_code: c.customer_code,
    company_name: c.company_name,
    customer_name: c.customer_name,
    customer_type: c.customer_type || 'Customer',
    industry: c.industry || 'Solar Energy / Infrastructure',
    gst_number: c.gst_number || '—',
    pan_number: c.pan_number || '—',
    billing_address: c.billing_address || '',
    city: c.city || '',
    state: c.state || '',
    pincode: c.pincode || '',
    billing_address_obj: c.billing_address_obj || {},
    dispatch_address: c.dispatch_address || '',
    dispatch_city: c.dispatch_city || '',
    dispatch_state: c.dispatch_state || '',
    dispatch_pincode: c.dispatch_pincode || '',
    delivery_address_obj: c.delivery_address_obj || {},
    same_as_billing: Boolean(c.same_as_billing),
    credit_limit: Number(c.credit_limit) || 0,
    credit_days: Number(c.credit_days) || 0,
    payment_terms: c.payment_terms || 'Due on Receipt',
    assigned_salesperson: c.assigned_salesperson || 'Sales Rep',
    source: c.source || 'Manual',
    zoho_contact_id: c.zoho_contact_id || null,
    primary_contact: c.primary_contact || {},
    email: c.email || '—',
    phone: c.phone || '—',
    status: c.status || 'Active',
    notes: c.notes || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  // Perform safe upsert in batches of 10
  const batchSize = 10;
  let insertedCount = 0;

  for (let i = 0; i < rowsToInsert.length; i += batchSize) {
    const batch = rowsToInsert.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('customers')
      .upsert(batch, { onConflict: 'customer_code' })
      .select('customer_code');

    if (error) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
      throw error;
    }
    insertedCount += (data ? data.length : batch.length);
    console.log(`Batch ${Math.floor(i / batchSize) + 1}: Successfully upserted ${batch.length} records.`);
  }

  // Verify count after insert
  const { count: afterCount } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });

  console.log('====================================================');
  console.log(`✅ MIGRATION SUCCESSFUL! Total rows in public.customers: ${afterCount}`);
  console.log('====================================================');
}

migrateCustomers().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
