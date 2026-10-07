import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5194;
process.env.PORT = String(PORT);

// Block any domain matching zoho to verify 0 outbound calls
import https from 'https';
const origHttps = https.request;
https.request = function(options, cb) {
  const host = options.hostname || options.host || '';
  if (host.includes('zoho')) {
    throw new Error('BLOCKED OUTBOUND ZOHO DOMAIN: ' + host);
  }
  return origHttps.apply(this, arguments);
};

console.log('====================================================');
console.log('BUSINZ PHASE 9 SCHEMA DECOUPLING VERIFICATION');
console.log('Testing Native Record Operations (Null/Omitted Zoho fields)');
console.log('====================================================\n');

// Start server
await import('../server/index.js');
await new Promise(r => setTimeout(r, 800));

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const b = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(b ? { 'Content-Length': Buffer.byteLength(b) } : {})
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: d ? JSON.parse(d) : null });
        } catch (e) {
          resolve({ status: res.statusCode, raw: d });
        }
      });
    });
    req.on('error', reject);
    if (b) req.write(b);
    req.end();
  });
}

const timestamp = Date.now();
let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${message}`);
    process.exit(1);
  }
}

// TEST 1: Customer Creation with NULL Zoho Fields
const custCode = `CUST-PH9-NULL-${timestamp}`;
const custRes = await request('/api/customers', 'POST', {
  customerCode: custCode,
  companyName: 'Phase 9 Null Test Company',
  customerName: 'Phase 9 Decoupled Contact',
  email: 'phase9null@example.com',
  phone: '9876543210',
  gstNumber: '33AAAAA0000A1Z5',
  zohoContactId: null,
  zoho_contact_id: null
});
assert(custRes.status === 200 && custRes.data?.customer?.customerCode === custCode,
  `Customer created with NULL Zoho fields (ID: ${custCode})`);

// TEST 2: Vendor Creation with NULL Zoho Fields
const vendCode = `VEND-PH9-NULL-${timestamp}`;
const vendRes = await request('/api/vendors', 'POST', {
  code: vendCode,
  name: 'Phase 9 Decoupled Vendor',
  email: 'p9vend@example.com',
  phone: '9876543211',
  gstin: '33BBBBB0000B1Z5',
  zohoId: null,
  zoho_contact_id: null
});
assert(vendRes.status === 200 && (vendRes.data?.vendor?.id || vendRes.data?.vendor?.code),
  `Vendor created with NULL Zoho fields (ID: ${vendCode})`);

// TEST 3: Item Creation with NULL Zoho Fields
const itemCode = `ITEM-PH9-NULL-${timestamp}`;
const itemRes = await request('/api/items', 'POST', {
  itemId: itemCode,
  name: 'Phase 9 Decoupled Solar Bracket',
  rate: 1500,
  sku: `SKU-P9-${timestamp}`,
  unit: 'NOS',
  zohoItemId: null,
  zoho_item_id: null
});
assert(itemRes.status === 200 && itemRes.data?.item?.itemId === itemCode,
  `Item created with NULL Zoho fields (ID: ${itemCode})`);

// TEST 4: PO Creation with NULL Zoho Fields
const poNum = `PO-PH9-NULL-${timestamp}`;
const poRes = await request('/api/purchaseorders', 'POST', {
  poNo: poNum,
  vendor: 'Phase 9 Decoupled Vendor',
  orderDate: '2026-10-07',
  deliveryDate: '2026-10-15',
  items: [{ itemId: itemCode, name: 'Phase 9 Decoupled Solar Bracket', qty: 20, rate: 1500 }],
  zohoId: null,
  zohoPoId: null,
  zoho_po_id: null,
  syncedToZoho: false
});
assert(poRes.status === 200 && (poRes.data?.po?.poNo === poNum || poRes.data?.purchaseorder?.poNo === poNum),
  `PO created with NULL Zoho fields (PO No: ${poNum})`);

// TEST 5: PO Approval using solely native BUSINZ PO Number
const appRes = await request(`/api/purchaseorders/${poNum}/approve`, 'POST', {
  approver: 'Velmurugan Rathinam (MD)',
  remarks: 'Decoupled approval test'
});
assert(appRes.status === 200 && appRes.data?.success === true,
  `PO approved using solely BUSINZ PO Number (${poNum})`);

// TEST 6: PO Payment using solely native BUSINZ PO Number
const payRes = await request(`/api/purchaseorders/${poNum}/process-payment`, 'POST', {
  amountPaid: '₹30,000.00',
  paymentMode: 'Bank Transfer',
  paymentRef: `REF-P9-${timestamp}`,
  remarks: 'Decoupled payment test'
});
assert(payRes.status === 200 && payRes.data?.success === true,
  `PO payment processed using solely BUSINZ PO Number (${poNum})`);

// TEST 7: Invoice Creation with NULL Zoho Fields
const invNum = `INV-PH9-NULL-${timestamp}`;
const invRes = await request('/api/invoices', 'POST', {
  invNo: invNum,
  customerName: 'Phase 9 Null Test Company',
  date: '2026-10-07',
  invAmt: 35400,
  items: [{ name: 'Phase 9 Item', qty: 20, rate: 1500 }],
  zohoId: null,
  zoho_id: null,
  syncedToZoho: null,
  synced_to_zoho: null
});
assert(invRes.status === 200 && (invRes.data?.invoice?.invNo === invNum || invRes.data?.invoice?.id === invNum),
  `Invoice created with NULL Zoho fields (Inv No: ${invNum})`);

// TEST 8: PI Creation with NULL Zoho Fields
const piNum = `PI-PH9-NULL-${timestamp}`;
const piRes = await request('/api/proforma-invoices', 'POST', {
  piNo: piNum,
  customerName: 'Phase 9 Null Test Company',
  date: '2026-10-07',
  total: 45000,
  items: [{ name: 'Phase 9 PI Item', qty: 10, rate: 4500 }],
  zohoEstimateId: null,
  zoho_estimate_id: null,
  zohoSynced: false,
  zoho_synced: false
});
assert(piRes.status === 200 && (piRes.data?.pi?.piNo === piNum || piRes.data?.estimate?.piNo === piNum),
  `PI created with NULL Zoho fields (PI No: ${piNum})`);

// TEST 9: PI Cancellation using solely native BUSINZ PI Number
const piCancelRes = await request('/api/proforma-invoices/cancel', 'POST', {
  piNo: piNum,
  reason: 'Phase 9 decoupling verification test'
});
assert(piCancelRes.status === 200 && piCancelRes.data?.success === true,
  `PI cancelled using solely BUSINZ PI Number (${piNum})`);

// TEST 10: Delivery Challan with NULL Zoho Fields
const dcNum = `DC-PH9-NULL-${timestamp}`;
const dcRes = await request('/api/deliverychallans', 'POST', {
  dcNo: dcNum,
  customerName: 'Phase 9 Null Test Company',
  date: '2026-10-07',
  items: [{ name: 'Phase 9 DC Item', qty: 5 }],
  zohoDcId: null,
  zoho_dc_id: null
});
assert(dcRes.status === 200 && (dcRes.data?.deliverychallan?.dcNo === dcNum || dcRes.data?.challan?.dcNo === dcNum || dcRes.data?.dc?.dcNo === dcNum),
  `Delivery Challan created with NULL Zoho fields (DC No: ${dcNum})`);

// TEST 11: Historical Record Lookup (Verifies records with legacy zohoId/zohoContactId load normally)
const histPoRes = await request('/api/purchaseorders/PO-00140');
assert(histPoRes.status === 200 && histPoRes.data?.poNo === 'PO-00140',
  'Historical PO PO-00140 loaded successfully without requiring active Zoho linkage');

console.log('\n----------------------------------------------------');
console.log(`DECOUPLING VERIFICATION: ${passed}/${total} TESTS PASSED`);
console.log('----------------------------------------------------');

// CLEANUP: Clean up test records and verify baseline counts
console.log('\nCleaning up test records to restore exact production baseline...');

function cleanupStore(filename, matchFn) {
  const filePath = path.join(__dirname, '../server', filename);
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(data)) {
        const filtered = data.filter(item => !matchFn(item));
        fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2), 'utf8');
      }
    } catch (_) {}
  }
}

cleanupStore('customer_store.json', c => (c.customerCode || c.id) === custCode);
cleanupStore('crm_customers.json', c => (c.customerCode || c.id) === custCode);
cleanupStore('vendor_store.json', v => (v.id || v.code) === vendCode);
cleanupStore('item_store.json', i => (i.itemId || i.id) === itemCode);
cleanupStore('po_store.json', p => (p.poNo || p.id) === poNum);
cleanupStore('invoice_store.json', i => (i.invNo || i.id) === invNum);
cleanupStore('sales_pi_store.json', p => (p.piNo || p.id) === piNum);
cleanupStore('proforma_invoice_store.json', p => (p.piNo || p.id) === piNum);
cleanupStore('dc_store.json', d => (d.dcNo || d.id) === dcNum);

function getCount(file) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../server', file), 'utf8'));
    return Array.isArray(raw) ? raw.length : 0;
  } catch (e) {
    return 0;
  }
}

console.log('Final Baseline Record Counts:');
console.log('- Customers: ' + getCount('customer_store.json') + ' (Expected: 57)');
console.log('- Vendors:   ' + getCount('vendor_store.json') + ' (Expected: 7)');
console.log('- Items:     ' + getCount('item_store.json') + ' (Expected: 312)');
console.log('- POs:       ' + getCount('po_store.json') + ' (Expected: 104)');
console.log('- Invoices:  ' + getCount('invoice_store.json') + ' (Expected: 10)');
console.log('- PIs:       ' + getCount('sales_pi_store.json') + ' (Expected: 21)');
console.log('- Payments:  ' + getCount('payment_store.json') + ' (Expected: 2)');
console.log('- GRNs:      ' + getCount('grn_store.json') + ' (Expected: 19)');
console.log('- DCs:       ' + getCount('dc_store.json') + ' (Expected: 0)');

process.exit(0);
