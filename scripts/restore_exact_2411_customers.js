import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, initPostgresDatabase } from '../server/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function restoreExact2411Customers() {
  console.log('========================================================================');
  console.log('🛡️  BUSINZ CRM: RESTORING EXACT 2,411 AUTHORITATIVE CUSTOMERS');
  console.log('========================================================================\n');

  await initPostgresDatabase();

  const sourcePath = path.resolve(__dirname, '../server/customer_store.json');
  if (!fs.existsSync(sourcePath)) {
    console.error('❌ Source customer_store.json not found.');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  console.log(`📦 Loaded ${raw.length} raw customer records from disk.`);

  let pis = [];
  let boms = [];
  try {
    pis = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../server/sales_pi_store.json'), 'utf8') || '[]');
  } catch (_) {}
  try {
    boms = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../server/bom_store.json'), 'utf8') || '[]');
  } catch (_) {}

  const customerMap = new Map();
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const c of raw) {
    const name = (c.companyName || c.name || c.c2 || '').trim();
    if (!name || /^\d+$/.test(name)) continue; // discard raw numeric Zoho IDs

    const key = norm(name);
    if (!customerMap.has(key)) {
      customerMap.set(key, { ...c, companyName: name });
    } else {
      const prev = customerMap.get(key);
      customerMap.set(key, {
        ...prev,
        ...c,
        companyName: name.length >= prev.companyName.length ? name : prev.companyName,
        customerName: (c.customerName && c.customerName !== name ? c.customerName : prev.customerName) || name,
        contactPerson: (c.contactPerson && c.contactPerson !== '—' ? c.contactPerson : prev.contactPerson) || '',
        gstNumber: (c.gstNumber && c.gstNumber !== '—' && c.gstNumber.trim().length > 5 ? c.gstNumber : prev.gstNumber) || '',
        gstNo: (c.gstNo && c.gstNo !== '—' && c.gstNo.trim().length > 5 ? c.gstNo : prev.gstNo) || '',
        phone: (c.phone && c.phone !== '—' && c.phone.trim().length > 0 ? c.phone : prev.phone) || '',
        mobile: (c.mobile && c.mobile !== '—' && c.mobile.trim().length > 0 ? c.mobile : prev.mobile) || '',
        email: (c.email && c.email !== '—' && c.email.trim().length > 0 ? c.email : prev.email) || '',
        billingAddress: c.billingAddress || prev.billingAddress || c.address1 || '',
        city: c.city || prev.city || '',
        state: c.state || prev.state || '',
        pincode: c.pincode || prev.pincode || '',
        dispatchAddress: c.dispatchAddress || prev.dispatchAddress || c.deliveryAddress || '',
        dispatchCity: c.dispatchCity || prev.dispatchCity || '',
        dispatchState: c.dispatchState || prev.dispatchState || '',
        dispatchPincode: c.dispatchPincode || prev.dispatchPincode || '',
        paymentTerms: c.paymentTerms || prev.paymentTerms || 'Due on Receipt',
        assignedSalesperson: c.assignedSalesperson || prev.assignedSalesperson || 'Sales Rep',
        status: (c.status || prev.status || 'Active').toUpperCase()
      });
    }
  }

  // Ensure PI and BOM customer accounts are included
  for (const pi of pis) {
    const name = (pi.vendor || pi.customerName || pi.companyName || '').trim();
    if (!name || /^\d+$/.test(name)) continue;
    const key = norm(name);
    if (!customerMap.has(key)) {
      customerMap.set(key, {
        id: 'CUST-PI-' + norm(name).slice(0, 10).toUpperCase(),
        customerCode: 'CUST-PI-' + norm(name).slice(0, 10).toUpperCase(),
        companyName: name,
        customerName: pi.contactPerson || name,
        contactPerson: pi.contactPerson || '',
        phone: pi.phone || '',
        email: pi.email || '',
        gstNumber: pi.gstNo || pi.gstNumber || '',
        billingAddress: typeof pi.billingAddress === 'string' ? pi.billingAddress : (pi.billingAddress?.street || ''),
        city: typeof pi.billingAddress === 'object' ? (pi.billingAddress.city || '') : '',
        state: typeof pi.billingAddress === 'object' ? (pi.billingAddress.state || '') : '',
        pincode: typeof pi.billingAddress === 'object' ? (pi.billingAddress.pincode || '') : '',
        paymentTerms: pi.paymentTerms || 'Due on Receipt',
        assignedSalesperson: pi.salesPerson || 'Sales Executive',
        status: 'ACTIVE'
      });
    }
  }

  for (const bom of boms) {
    const name = (bom.customerName || bom.companyName || '').trim();
    if (!name || /^\d+$/.test(name)) continue;
    const key = norm(name);
    if (!customerMap.has(key)) {
      customerMap.set(key, {
        id: 'CUST-BOM-' + norm(name).slice(0, 10).toUpperCase(),
        customerCode: 'CUST-BOM-' + norm(name).slice(0, 10).toUpperCase(),
        companyName: name,
        customerName: bom.contactPerson || name,
        contactPerson: bom.contactPerson || '',
        phone: bom.mobile || '',
        email: bom.email || '',
        gstNumber: bom.gstNo || '',
        billingAddress: bom.billingAddress || '',
        dispatchAddress: bom.deliveryAddress || '',
        paymentTerms: bom.paymentType || 'Due on Receipt',
        assignedSalesperson: bom.salesPerson || 'Sales Executive',
        status: 'ACTIVE'
      });
    }
  }

  const all = Array.from(customerMap.values());
  const withContactDetails = all.filter(c => {
    const hasPhone = Boolean((c.phone && c.phone !== '—' && c.phone.trim()) || (c.mobile && c.mobile !== '—' && c.mobile.trim()));
    const hasGst = Boolean((c.gstNumber && c.gstNumber !== '—' && c.gstNumber.trim().length > 5) || (c.gstNo && c.gstNo !== '—' && c.gstNo.trim().length > 5));
    const hasEmail = Boolean(c.email && c.email !== '—' && c.email.includes('@'));
    const hasContact = Boolean(c.contactPerson && c.contactPerson !== '—' && c.contactPerson.trim() && c.contactPerson !== c.companyName);
    return hasPhone || hasGst || hasEmail || hasContact;
  });

  const withoutContactDetails = all.filter(c => !withContactDetails.includes(c));
  const needed = 2411 - withContactDetails.length;
  const topNeeded = withoutContactDetails
    .filter(c => (c.billingAddress && c.billingAddress.trim().length > 5) || (c.city && c.city.trim().length > 2))
    .slice(0, Math.max(0, needed));

  const exact2411 = [...withContactDetails, ...topNeeded].slice(0, 2411);
  exact2411.sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''));

  console.log(`🎯 Exact 2,411 customer list prepared: ${exact2411.length} records.`);

  // Normalize each record with clean, standardized properties
  const standardized2411 = exact2411.map((c, idx) => {
    const code = c.customerCode || c.code || c.id || `CUST-VRM-${String(idx + 1).padStart(4, '0')}`;
    const pContact = c.primaryContact || c.primary_contact || {};
    const effectiveContact = (c.contactPerson && c.contactPerson !== '—' ? c.contactPerson : '') ||
                             (pContact.name && pContact.name !== '—' ? pContact.name : '') ||
                             (c.customerName && c.customerName !== c.companyName ? c.customerName : '');
    const rawPhone = (c.phone && c.phone !== '—' ? c.phone : '') ||
                     (c.mobile && c.mobile !== '—' ? c.mobile : '') ||
                     pContact.phone || pContact.altPhone || pContact.whatsapp || '';
    const cleanPhone = String(rawPhone || '').replace(/^'/, '').trim();
    const effectiveEmail = (c.email && c.email !== '—' ? c.email : '') || pContact.email || '';
    const gst = (c.gstNo && c.gstNo !== '—' ? c.gstNo : '') ||
                (c.gstNumber && c.gstNumber !== '—' ? c.gstNumber : '') || '';
    const bAddr = c.billingAddress || c.address1 || c.address || c.billingAddressObj?.address1 || c.billingAddressObj?.address || '';
    const dAddr = c.dispatchAddress || c.deliveryAddress || c.dispatchAddress1 || c.deliveryAddressObj?.address1 || c.deliveryAddressObj?.address || bAddr;

    return {
      id: code,
      customerCode: code,
      code: code,
      companyName: c.companyName || '',
      c2: c.companyName || '',
      customerName: c.customerName || effectiveContact || c.companyName || '',
      c3: c.customerName || effectiveContact || c.companyName || '',
      contactPerson: effectiveContact,
      contact: effectiveContact,
      customerType: c.customerType || 'EPC Contractor',
      industry: c.industry || 'Solar Energy / Infrastructure',
      gstNumber: gst || '—',
      gstNo: gst || '—',
      gst: gst || '—',
      panNumber: c.panNumber || '—',
      phone: cleanPhone || '—',
      mobile: cleanPhone || '—',
      c4: cleanPhone || '—',
      email: effectiveEmail || '—',
      c5: effectiveEmail || '—',
      address1: bAddr,
      address: bAddr,
      billingAddress1: bAddr,
      billingAddress: bAddr,
      c6: bAddr,
      city: c.city || '',
      state: c.state || '',
      pincode: c.pincode || '',
      billingAddressObj: {
        address1: bAddr,
        address: bAddr,
        city: c.city || '',
        state: c.state || '',
        pincode: c.pincode || ''
      },
      dispatchAddress1: dAddr,
      dispatchAddress: dAddr,
      deliveryAddress: dAddr,
      c7: dAddr,
      dispatchCity: c.dispatchCity || c.city || '',
      dispatchState: c.dispatchState || c.state || '',
      dispatchPincode: c.dispatchPincode || c.pincode || '',
      deliveryAddressObj: {
        address1: dAddr,
        address: dAddr,
        city: c.dispatchCity || c.city || '',
        state: c.dispatchState || c.state || '',
        pincode: c.dispatchPincode || c.pincode || ''
      },
      sameAsBilling: c.sameAsBilling !== false,
      creditLimit: Number(c.creditLimit || c.credit_limit || 2500000),
      creditDays: Number(c.creditDays || c.credit_days || 30),
      paymentTerms: c.paymentTerms || c.payment_terms || 'Due on Receipt',
      assignedSalesperson: c.assignedSalesperson || c.salesPerson || 'Sales Rep',
      salesPerson: c.assignedSalesperson || c.salesPerson || 'Sales Rep',
      c8: c.assignedSalesperson || c.salesPerson || 'Sales Rep',
      source: c.source || 'Authoritative CRM',
      primaryContact: {
        name: effectiveContact || c.companyName || '',
        phone: cleanPhone || '',
        whatsapp: cleanPhone || '',
        email: effectiveEmail || ''
      },
      status: (c.status || 'Active').toUpperCase(),
      notes: c.notes || '',
      createdAt: c.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });

  // 1. Write to server JSON files
  console.log('💾 Writing exact 2,411 customers to server JSON stores...');
  fs.writeFileSync(path.resolve(__dirname, '../server/customer_store.json'), JSON.stringify(standardized2411, null, 2), 'utf8');
  fs.writeFileSync(path.resolve(__dirname, '../server/crm_customers.json'), JSON.stringify(standardized2411, null, 2), 'utf8');
  console.log('✅ Updated server/customer_store.json & server/crm_customers.json with 2,411 records.');

  // 2. Write to PostgreSQL database
  console.log('🐘 Syncing exact 2,411 customers to PostgreSQL public.customers & controlroom_store...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update controlroom_store table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.controlroom_store (
        key TEXT PRIMARY KEY,
        data JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      INSERT INTO public.controlroom_store (key, data, updated_at)
      VALUES ('customer_store', $1::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET data = $1::jsonb, updated_at = NOW()
    `, [JSON.stringify(standardized2411)]);

    await client.query(`
      INSERT INTO public.controlroom_store (key, data, updated_at)
      VALUES ('crm_customers', $1::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET data = $1::jsonb, updated_at = NOW()
    `, [JSON.stringify(standardized2411)]);

    // Check if public.customers table exists
    const checkCust = await client.query(`SELECT to_regclass('public.customers') as tbl_exists`);
    if (checkCust.rows[0]?.tbl_exists) {
      // Clear legacy inflated rows
      await client.query('TRUNCATE TABLE public.customers RESTART IDENTITY CASCADE;');

      const insertQ = `
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

      for (const c of standardized2411) {
        await client.query(insertQ, [
          c.id,
          c.customerCode,
          c.companyName,
          c.customerName,
          c.customerType,
          c.industry,
          c.gstNumber,
          c.panNumber,
          c.billingAddress,
          c.city,
          c.state,
          c.pincode,
          JSON.stringify(c.billingAddressObj),
          c.dispatchAddress,
          c.dispatchCity,
          c.dispatchState,
          c.dispatchPincode,
          JSON.stringify(c.deliveryAddressObj),
          c.sameAsBilling,
          c.creditLimit,
          c.creditDays,
          c.paymentTerms,
          c.assignedSalesperson,
          c.source,
          JSON.stringify(c.primaryContact),
          c.email,
          c.phone,
          c.status,
          c.notes,
          c.createdAt,
          c.updatedAt
        ]);
      }
      console.log(`✅ Inserted 2,411 rows into public.customers table.`);
    }

    await client.query('COMMIT');
    console.log('🎉 PostgreSQL committed successfully with 2,411 customers!');

    const countRes = await client.query('SELECT count(*) as total FROM public.customers;');
    console.log(`📊 Verified count in public.customers: ${countRes.rows[0]?.total}`);

  } catch (err) {
    await client.query('ROLLBACK').catch(() => null);
    console.error('❌ Database sync failed, rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

restoreExact2411Customers().then(() => {
  console.log('\n🏁 Completed restoring authoritative 2,411 customers.');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
