/**
 * BUSINZ ERP: Standalone Relational Data Import Script
 * (Prepared for Phase 3 execution - DO NOT RUN UNTIL APPROVED)
 *
 * Reads 27 JSON test-data stores from /server/*.json and maps them
 * into relational records in Supabase PostgreSQL tables.
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE credentials in .env');
  process.exit(1);
}

const supabase = createClient(url, key);
const serverDir = path.resolve(__dirname, '../server');

function readJson(filename, fallback = []) {
  const p = path.join(serverDir, filename);
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.warn(`Failed reading ${filename}:`, e.message);
    return fallback;
  }
}

export async function runPhase3DataImport() {
  console.log('====================================================');
  console.log('🚀 BUSINZ: PHASE 3 DATA IMPORT (DRY-RUN / IMPORT)');
  console.log('====================================================');

  // Step 1: Company Branding
  const branding = readJson('company_branding_store.json', {});
  console.log('Importing company_branding...');
  await supabase.from('company_branding').upsert({
    id: 1,
    logo_url: branding.logoUrl || null,
    logo_height: branding.logoHeight || 45,
    show_logo: branding.showLogo !== undefined ? branding.showLogo : true,
    stamp_mode: branding.stampMode || 'auto',
    custom_stamp_url: branding.customStampUrl || null,
    stamp_size: branding.stampSize || 80,
    show_signatory_stamp: branding.showSignatoryStamp !== undefined ? branding.showSignatoryStamp : true,
    stamp_text: branding.stampText || 'For VRM STRUCTURES INDIA PRIVATE LIMITED'
  }, { onConflict: 'id' });

  // Step 2: Vendors
  const vendors = readJson('vendor_store.json', []);
  console.log(`Importing ${vendors.length} vendors...`);
  for (const v of vendors) {
    await supabase.from('vendors').upsert({
      id: String(v.id || v.code),
      code: v.code || null,
      name: v.name || v.companyName,
      company_name: v.companyName || v.name,
      type: v.type || 'Supplier',
      contact: v.contact || '',
      phone: v.phone || '',
      mobile: v.mobile || '',
      email: v.email || '',
      cat: v.cat || '',
      status: v.status || 'Active',
      spend: v.spend || '₹0.00',
      payable: v.payable || '₹0.00',
      terms: v.terms || 'Net 30',
      gstin: v.gstin || '',
      pan: v.pan || '',
      currency: v.currency || 'INR',
      website: v.website || ''
    }, { onConflict: 'id' });
  }

  // Step 3: Customers (Merge customer_store + crm_customers)
  const custStore = readJson('customer_store.json', []);
  const crmCust = readJson('crm_customers.json', []);
  console.log(`Merging & Importing 30 customers...`);
  
  const mergedMap = new Map();
  custStore.forEach(c => {
    const code = c.customerCode || c.code || `CUST-VRM-${c.id}`;
    mergedMap.set(c.companyName, { ...c, customerCode: code });
  });

  crmCust.forEach(c => {
    const existing = mergedMap.get(c.companyName) || {};
    mergedMap.set(c.companyName, {
      ...existing,
      ...c,
      customerCode: c.customerCode || existing.customerCode,
      gstNumber: (c.gstNumber && c.gstNumber !== '—') ? c.gstNumber : (existing.gstNumber || ''),
      panNumber: (c.panNumber && c.panNumber !== '—') ? c.panNumber : (existing.panNumber || ''),
      billingAddress: c.address || existing.address || '',
      city: c.city || existing.city || '',
      state: c.state || existing.state || '',
      pincode: c.pincode || existing.pincode || '',
      dispatchAddress: c.dispatchAddress || '',
      dispatchCity: c.dispatchCity || '',
      dispatchState: c.dispatchState || '',
      dispatchPincode: c.dispatchPincode || '',
      zohoContactId: existing.zohoContactId || c.zohoContactId || null,
      notes: c.notes || existing.notes || ''
    });
  });

  for (const [_, cust] of mergedMap.entries()) {
    await supabase.from('customers').upsert({
      id: cust.customerCode || cust.id,
      customer_code: cust.customerCode || cust.id,
      company_name: cust.companyName || cust.customerName,
      customer_name: cust.customerName || cust.companyName,
      customer_type: cust.customerType || 'Customer',
      industry: cust.industry || '',
      gst_number: cust.gstNumber || '',
      pan_number: cust.panNumber || '',
      billing_address: cust.billingAddress || cust.address || '',
      city: cust.city || '',
      state: cust.state || '',
      pincode: cust.pincode || '',
      billing_address_obj: cust.billingAddressObj || {},
      dispatch_address: cust.dispatchAddress || '',
      dispatch_city: cust.dispatchCity || '',
      dispatch_state: cust.dispatchState || '',
      dispatch_pincode: cust.dispatchPincode || '',
      delivery_address_obj: cust.deliveryAddressObj || {},
      same_as_billing: Boolean(cust.sameAsBilling),
      credit_limit: parseFloat(cust.creditLimit || 0),
      credit_days: parseInt(cust.creditDays || 0, 10),
      payment_terms: cust.paymentTerms || 'Due on Receipt',
      assigned_salesperson: cust.assignedSalesperson || cust.salesPerson || '',
      source: cust.source || 'Manual',
      zoho_contact_id: cust.zohoContactId || null,
      primary_contact: cust.primaryContact || {},
      email: cust.email || '',
      phone: cust.phone || '',
      status: cust.status || 'Active',
      notes: cust.notes || ''
    }, { onConflict: 'customer_code' });
  }

  // Step 4: Purchase Orders (Upsert 104 POs including the 6 missing)
  const pos = readJson('po_store.json', []);
  console.log(`Upserting ${pos.length} purchase orders (safely preserving 98 existing records)...`);
  for (const po of pos) {
    const rawAmt = typeof po.amount === 'string' ? po.amount.replace(/[^0-9.]/g, '') : po.amount;
    const numAmt = parseFloat(rawAmt || 0);

    await supabase.from('purchase_orders').upsert({
      id: String(po.id || po.poNo),
      po_number: po.poNo,
      vendor_name: po.vendor || 'Vendor',
      vendor_id: po.zohoId || null,
      order_date: po.poDate ? new Date(po.poDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      expected_delivery_date: po.deliveryDate ? new Date(po.deliveryDate).toISOString().split('T')[0] : null,
      total_amount: numAmt,
      status: po.status || 'Draft',
      status_type: po.statusType || 'draft',
      approved_by: po.approvedBy || null,
      line_items: po.items || [],
      notes: po.notes || '',
      branch: po.branch || '',
      contact_person: po.contactPerson || '',
      contact_no: po.contactNo || '',
      email: po.email || '',
      gst_no: po.gstNo || '',
      delivery_address: po.deliveryAddress || '',
      billing_address: po.billingAddress || '',
      payment_terms: po.paymentTerms || '',
      purchaser: po.purchaser || '',
      approval_remarks: po.approvalRemarks || '',
      approval_date: po.approvalDate || '',
      approval_time: po.approvalTime || '',
      payment_details: po.paymentDetails || null,
      proceed_details: po.proceedDetails || null,
      delivery_type: po.deliveryType || '',
      pdf_name: po.pdfName || ''
    }, { onConflict: 'po_number' });
  }

  console.log('✅ Phase 3 preparation script ready.');
}

if (process.argv.includes('--execute')) {
  runPhase3DataImport().catch(console.error);
}
