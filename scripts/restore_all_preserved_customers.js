import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, initPostgresDatabase } from '../server/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function restoreAllPreservedCustomers() {
  console.log('========================================================================');
  console.log('🛡️  BUSINZ CRM: RESTORING ALL PRESERVED CUSTOMERS TO POSTGRESQL');
  console.log('========================================================================\n');

  await initPostgresDatabase();

  const backupPath = path.resolve(__dirname, '../server/backups/IMMUTABLE_PRESERVED_CUSTOMERS_20261007/crm_customers.json');
  if (!fs.existsSync(backupPath)) {
    console.error('❌ Immutable customer backup file not found at:', backupPath);
    process.exit(1);
  }

  const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  console.log(`📦 Loaded ${backupData.length} total customer records from immutable backup archive.`);

  const client = await pool.connect();
  try {
    const existingRes = await client.query('SELECT customer_code FROM public.customers;');
    const existingCodes = new Set(existingRes.rows.map(r => String(r.customer_code).toLowerCase().trim()));
    console.log(`📊 Current existing rows in public.customers: ${existingCodes.size}`);

    const toInsert = [];
    const seen = new Set(existingCodes);

    backupData.forEach(c => {
      const code = String(c.customerCode || c.customer_code || c.code || c.id || '').trim();
      if (!code) return;
      if (!seen.has(code.toLowerCase())) {
        toInsert.push(c);
        seen.add(code.toLowerCase());
      }
    });

    console.log(`🚀 Found ${toInsert.length} unique missing customer records to restore into PostgreSQL.`);

    if (toInsert.length === 0) {
      console.log('✅ All backup customer records already exist in public.customers.');
      return;
    }

    const q = `
      INSERT INTO public.customers (
        id, customer_code, company_name, customer_name, customer_type, industry,
        gst_number, pan_number, billing_address, city, state, pincode, billing_address_obj,
        dispatch_address, dispatch_city, dispatch_state, dispatch_pincode, delivery_address_obj,
        same_as_billing, credit_limit, credit_days, payment_terms, assigned_salesperson,
        source, primary_contact, email, phone, status, notes, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23,
        $24, $25, $26, $27, $28, $29, $30, $31
      ) ON CONFLICT (customer_code) DO NOTHING
    `;

    await client.query('BEGIN');
    let insertedCount = 0;

    for (const c of toInsert) {
      const code = String(c.customerCode || c.customer_code || c.code || c.id || '').trim();
      const id = String(c.id || code).trim();
      const company = String(c.companyName || c.company_name || c.c2 || c.customerName || c.customer_name || 'Customer').trim();
      const custName = String(c.customerName || c.customer_name || c.c3 || company).trim();

      await client.query(q, [
        id,
        code,
        company,
        custName,
        c.customerType || c.customer_type || 'Customer',
        c.industry || 'Solar Energy / Infrastructure',
        c.gstNumber || c.gst_number || c.gstNo || '—',
        c.panNumber || c.pan_number || '—',
        c.billingAddress || c.billing_address || c.address || '',
        c.city || '',
        c.state || '',
        c.pincode || '',
        JSON.stringify(c.billingAddressObj || c.billing_address_obj || {}),
        c.dispatchAddress || c.dispatch_address || c.deliveryAddress || '',
        c.dispatchCity || c.dispatch_city || '',
        c.dispatchState || c.dispatch_state || '',
        c.dispatchPincode || c.dispatch_pincode || '',
        JSON.stringify(c.deliveryAddressObj || c.delivery_address_obj || {}),
        Boolean(c.sameAsBilling !== undefined ? c.sameAsBilling : c.same_as_billing),
        Number(c.creditLimit || c.credit_limit || 0),
        Number(c.creditDays || c.credit_days || 0),
        c.paymentTerms || c.payment_terms || 'Due on Receipt',
        c.assignedSalesperson || c.assigned_salesperson || c.salesPerson || 'Sales Rep',
        c.source || 'Historical Archive',
        JSON.stringify(c.primaryContact || c.primary_contact || {}),
        c.email || '—',
        c.phone || '—',
        (c.status || 'Active').toUpperCase(),
        c.notes || '',
        c.createdAt || c.created_at || new Date().toISOString(),
        new Date().toISOString()
      ]);
      insertedCount++;
    }

    await client.query('COMMIT');
    console.log(`✅ Successfully inserted ${insertedCount} missing records into public.customers!`);

    const finalRes = await client.query('SELECT count(*) as total FROM public.customers;');
    console.log(`🎉 Final Total Customers in PostgreSQL public.customers: ${finalRes.rows[0].total}`);

  } catch (err) {
    await client.query('ROLLBACK').catch(() => null);
    console.error('❌ Restore failed, rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

restoreAllPreservedCustomers().then(() => {
  console.log('\n🏁 Customer Restoration Completed Successfully.');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
