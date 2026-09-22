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

export async function getCanonicalMergedCustomers() {
  const custStore = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../server/customer_store.json'), 'utf8'));
  const crmCust = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../server/crm_customers.json'), 'utf8'));
  
  const { data: leavesRows } = await supabase
    .from('leaves')
    .select('reason')
    .eq('employee', 'CUSTOMER_STORE')
    .order('id', { ascending: false })
    .limit(1);

  const leavesCust = leavesRows && leavesRows.length > 0 ? JSON.parse(leavesRows[0].reason) : [];

  const norm = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  const extractCode = (str) => {
    if (!str) return null;
    const m = String(str).match(/CUST-[A-Z0-9-]+/i);
    return m ? m[0].toUpperCase() : null;
  };

  const customerMap = new Map();

  function mergeRecord(incoming, sourceTag) {
    if (!incoming || typeof incoming !== 'object') return;

    // Detect customer code
    let code = extractCode(incoming.customerCode) ||
               extractCode(incoming.customer_code) ||
               extractCode(incoming.id) ||
               incoming.customerCode ||
               incoming.customer_code ||
               incoming.code;

    const zohoId = incoming.zohoContactId || incoming.zoho_contact_id || (String(incoming.id).length > 15 ? incoming.id : null);
    const company = incoming.companyName || incoming.company_name || incoming.c2 || incoming.customerName || incoming.name;

    // Determine primary index key
    let primaryKey = null;
    if (code && String(code).toUpperCase().startsWith('CUST-')) {
      primaryKey = 'CODE_' + norm(code);
    } else if (zohoId && zohoId !== '—') {
      primaryKey = 'ZOHO_' + norm(zohoId);
    } else if (company && company !== '—') {
      primaryKey = 'COMP_' + norm(company);
    } else {
      primaryKey = 'ID_' + norm(incoming.id || Math.random());
    }

    // Also check if any existing record shares zohoId or company or code
    let existingKey = null;
    for (const [k, existing] of customerMap.entries()) {
      const eCode = existing.customer_code;
      const eZoho = existing.zoho_contact_id;
      const eComp = existing.company_name;

      const codeMatch = code && eCode && norm(code) === norm(eCode);
      const zohoMatch = zohoId && eZoho && zohoId !== '—' && norm(zohoId) === norm(eZoho);
      const compMatch = company && eComp && norm(company) === norm(eComp) && norm(company).length > 3;

      if (codeMatch || zohoMatch || (compMatch && (codeMatch || zohoMatch || (!code && !eCode)))) {
        existingKey = k;
        break;
      }
    }

    const targetKey = existingKey || primaryKey;
    const existing = customerMap.get(targetKey) || {};

    // Merge strategy: Non-empty incoming overwrites empty existing; richer fields preserved
    const effCode = (code && code.startsWith('CUST-')) ? code : (existing.customer_code || code || `CUST-ZOHO-${norm(company).substring(0, 10).toUpperCase()}`);
    const effCompany = company || existing.company_name || 'Customer';
    const effName = incoming.customerName || incoming.customer_name || incoming.c3 || existing.customer_name || effCompany;
    const effZohoId = (zohoId && zohoId !== '—') ? zohoId : (existing.zoho_contact_id || null);
    const effGst = (incoming.gstNumber && incoming.gstNumber !== '—') ? incoming.gstNumber : (incoming.gstNo && incoming.gstNo !== '—' ? incoming.gstNo : (existing.gst_number || '—'));
    const effPan = (incoming.panNumber && incoming.panNumber !== '—') ? incoming.panNumber : (existing.pan_number || '—');
    
    // Addresses
    const effBillingAddr = incoming.billingAddress || incoming.c6 || incoming.address || existing.billing_address || '';
    const effBillingObj = (incoming.billingAddressObj && Object.keys(incoming.billingAddressObj).length > 0) ? incoming.billingAddressObj : (existing.billing_address_obj || {});
    const effDispatchAddr = incoming.dispatchAddress || incoming.c7 || incoming.deliveryAddress || existing.dispatch_address || effBillingAddr;
    const effDispatchObj = (incoming.deliveryAddressObj && Object.keys(incoming.deliveryAddressObj).length > 0) ? incoming.deliveryAddressObj : (existing.delivery_address_obj || effBillingObj);
    
    // Contact
    const effEmail = (incoming.email && incoming.email !== '—') ? incoming.email : (incoming.c5 && incoming.c5 !== '—' ? incoming.c5 : (existing.email || '—'));
    const effPhone = (incoming.phone && incoming.phone !== '—') ? incoming.phone : (incoming.c4 && incoming.c4 !== '—' ? incoming.c4 : (existing.phone || '—'));
    const effPrimaryContact = (incoming.primaryContact && incoming.primaryContact.name && incoming.primaryContact.name !== '—') ? incoming.primaryContact : (existing.primary_contact || {});
    
    // Sales / Terms
    const effSalesPerson = incoming.assignedSalesperson || incoming.salesPerson || incoming.c8 || existing.assigned_salesperson || 'Sales Rep';
    const effTerms = incoming.paymentTerms || existing.payment_terms || 'Due on Receipt';
    const effCreditLimit = Number(incoming.creditLimit || existing.credit_limit || 0);
    const effCreditDays = Number(incoming.creditDays || existing.credit_days || 0);
    const effStatus = incoming.status || existing.status || 'Active';
    const effNotes = incoming.notes || existing.notes || '';
    const effSource = incoming.source || existing.source || (effZohoId ? 'Zoho Books' : 'Manual');

    const mergedRecord = {
      id: effCode,
      customer_code: effCode,
      company_name: effCompany,
      customer_name: effName,
      customer_type: incoming.customerType || existing.customer_type || 'Customer',
      industry: incoming.industry || existing.industry || 'Solar Energy / Infrastructure',
      gst_number: effGst,
      pan_number: effPan,
      billing_address: effBillingAddr,
      city: incoming.city || existing.city || (effBillingObj.city || ''),
      state: incoming.state || existing.state || (effBillingObj.state || 'Tamil Nadu'),
      pincode: incoming.pincode || existing.pincode || (effBillingObj.pincode || ''),
      billing_address_obj: effBillingObj,
      dispatch_address: effDispatchAddr,
      dispatch_city: incoming.dispatchCity || existing.dispatch_city || '',
      dispatch_state: incoming.dispatchState || existing.dispatch_state || 'Tamil Nadu',
      dispatch_pincode: incoming.dispatchPincode || existing.dispatch_pincode || '',
      delivery_address_obj: effDispatchObj,
      same_as_billing: incoming.sameAsBilling !== undefined ? incoming.sameAsBilling : (existing.same_as_billing || false),
      credit_limit: effCreditLimit,
      credit_days: effCreditDays,
      payment_terms: effTerms,
      assigned_salesperson: effSalesPerson,
      source: effSource,
      zoho_contact_id: effZohoId,
      primary_contact: effPrimaryContact,
      email: effEmail,
      phone: effPhone,
      status: effStatus,
      notes: effNotes
    };

    customerMap.set(targetKey, mergedRecord);
  }

  // 1. Process customer_store first
  custStore.forEach(c => mergeRecord(c, 'customer_store'));
  // 2. Process crm_customers (adds rich CRM addresses, primaryContacts)
  crmCust.forEach(c => mergeRecord(c, 'crm_customers'));
  // 3. Process leaves (adds latest live Zoho IDs)
  leavesCust.forEach(c => mergeRecord(c, 'leaves'));

  return Array.from(customerMap.values());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  getCanonicalMergedCustomers().then(customers => {
    console.log(`\nCanonical Merged Customers Count: ${customers.length}`);
    console.log('\nSample Merged Customer (first 3):');
    console.log(JSON.stringify(customers.slice(0, 3), null, 2));

    // Check for duplicates
    const codes = new Set();
    const dups = [];
    customers.forEach(c => {
      if (codes.has(c.customer_code)) dups.push(c.customer_code);
      codes.add(c.customer_code);
    });
    console.log(`Duplicate codes: ${dups.length === 0 ? 'NONE (All unique)' : dups.join(', ')}`);
  });
}
