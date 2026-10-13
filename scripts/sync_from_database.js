import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, initPostgresDatabase } from '../server/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function syncFromDatabase() {
  console.log('========================================================================');
  console.log('🛡️  BUSINZ CRM: SYNCHRONIZING CUSTOMERS DIRECTLY FROM POSTGRESQL');
  console.log('========================================================================\n');

  await initPostgresDatabase();
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT 
        id, customer_code, company_name, customer_name, customer_type, industry,
        gst_number, pan_number, billing_address, city, state, pincode, billing_address_obj,
        dispatch_address, dispatch_city, dispatch_state, dispatch_pincode, delivery_address_obj,
        same_as_billing, credit_limit, credit_days, payment_terms, assigned_salesperson,
        source, primary_contact, email, phone, status, notes, created_at, updated_at
      FROM public.customers 
      ORDER BY company_name ASC;
    `);

    const count = res.rows.length;
    console.log(`📊 Authoritative customers found in PostgreSQL public.customers: ${count}`);

    if (count === 0) {
      console.warn('⚠️ No customers found in public.customers table.');
      return;
    }

    const mapped = res.rows.map(c => ({
      id: c.customer_code || c.id,
      customerCode: c.customer_code,
      code: c.customer_code,
      companyName: c.company_name,
      c2: c.company_name,
      customerName: c.customer_name || c.company_name,
      c3: c.customer_name || c.company_name,
      customerType: c.customer_type || 'Customer',
      industry: c.industry || '',
      gstNumber: c.gst_number || '—',
      gstNo: c.gst_number || '—',
      panNumber: c.pan_number || '—',
      address: c.billing_address || '',
      city: c.city || '',
      state: c.state || '',
      pincode: c.pincode || '',
      billingAddress: c.billing_address || '',
      c6: c.billing_address || '',
      billingAddressObj: c.billing_address_obj || {},
      dispatchAddress: c.dispatch_address || '',
      deliveryAddress: c.dispatch_address || '',
      c7: c.dispatch_address || '',
      dispatchCity: c.dispatch_city || '',
      dispatchState: c.dispatch_state || '',
      dispatchPincode: c.dispatch_pincode || '',
      deliveryAddressObj: c.delivery_address_obj || {},
      sameAsBilling: Boolean(c.same_as_billing),
      creditLimit: Number(c.credit_limit || 0),
      creditDays: Number(c.credit_days || 0),
      paymentTerms: c.payment_terms || 'Due on Receipt',
      assignedSalesperson: c.assigned_salesperson || 'Sales Rep',
      salesPerson: c.assigned_salesperson || 'Sales Rep',
      c8: c.assigned_salesperson || 'Sales Rep',
      source: c.source || 'Manual',
      primaryContact: c.primary_contact || {},
      email: c.email || '—',
      c5: c.email || '—',
      phone: c.phone || '—',
      c4: c.phone || '—',
      status: (c.status || 'Active').toUpperCase(),
      notes: c.notes || '',
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }));

    // Write directly to disk store files
    const custPath = path.resolve(__dirname, '../server/customer_store.json');
    const crmPath = path.resolve(__dirname, '../server/crm_customers.json');
    fs.writeFileSync(custPath, JSON.stringify(mapped, null, 2), 'utf8');
    fs.writeFileSync(crmPath, JSON.stringify(mapped, null, 2), 'utf8');
    console.log(`✅ Synchronized ${count} customers to ${custPath}`);
    console.log(`✅ Synchronized ${count} customers to ${crmPath}`);

    // Update controlroom_store key-value cache in PostgreSQL
    await client.query(`
      INSERT INTO controlroom_store (key, data, updated_at)
      VALUES ('customer_store', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW();
    `, [JSON.stringify(mapped)]);
    await client.query(`
      INSERT INTO controlroom_store (key, data, updated_at)
      VALUES ('crm_customers', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW();
    `, [JSON.stringify(mapped)]);
    console.log(`✅ Synchronized controlroom_store cache in PostgreSQL to match ${count} customers.`);

    console.log(`\n🎉 SUCCESS: Exactly ${count} customers are active and ready in BUSINZ!`);
  } catch (err) {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

syncFromDatabase().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
