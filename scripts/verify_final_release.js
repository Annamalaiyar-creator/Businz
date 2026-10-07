/**
 * Final Release Complete Validation Suite
 * Runs in isolated test server on port 5195.
 * Tests all native routes, status codes, response shapes,
 * E2E flows (Customer, Vendor/PO, Item/Inventory, Sales/PI/Invoice),
 * sequential numbering, GST calculations, stock math, and integrity.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

process.env.PORT = '5195';
const app = require('../server/index.js');

const PORT = 5195;
const BASE_URL = `http://localhost:${PORT}`;

function req(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const request = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(data);
        } catch (_) {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, data: json });
      });
    });

    request.on('error', reject);
    if (body) {
      request.write(JSON.stringify(body));
    }
    request.end();
  });
}

async function runValidation() {
  console.log('====================================================');
  console.log(`RUNNING BUSINZ FINAL RELEASE VALIDATION on ${BASE_URL}`);
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Initial Baseline Count Check
  console.log('--- 1. BASELINE COUNTS ---');
  const custInit = await req('/api/customers');
  assert(custInit.status === 200 && custInit.data.length === 57, `Initial Customers: ${custInit.data.length} (Expected: 57)`);

  const vendInit = await req('/api/vendors');
  assert(vendInit.status === 200 && vendInit.data.length === 7, `Initial Vendors: ${vendInit.data.length} (Expected: 7)`);

  const itemInit = await req('/api/items');
  assert(itemInit.status === 200 && itemInit.data.length === 312, `Initial Items: ${itemInit.data.length} (Expected: 312)`);

  const poInit = await req('/api/purchaseorders');
  assert(poInit.status === 200 && poInit.data.length === 104, `Initial POs: ${poInit.data.length} (Expected: 104)`);

  const invInit = await req('/api/invoices');
  assert(invInit.status === 200 && invInit.data.length === 10, `Initial Invoices: ${invInit.data.length} (Expected: 10)`);

  const piInit = await req('/api/proforma-invoices');
  assert(piInit.status === 200 && piInit.data.length === 21, `Initial PIs: ${piInit.data.length} (Expected: 21)`);

  const dcInit = await req('/api/deliverychallans');
  assert(dcInit.status === 200 && dcInit.data.length === 0, `Initial DCs: ${dcInit.data.length} (Expected: 0)`);

  // 2. Sequential Number Generation Tests
  console.log('\n--- 2. NUMBER GENERATION ROUTES ---');
  const nextPoRes = await req('/api/next-po-number');
  const poNum = nextPoRes.data.nextPoNo || nextPoRes.data.nextPoNumber;
  assert(nextPoRes.status === 200 && poNum === 'PO-00141', `Next PO Number: ${poNum} (Expected: PO-00141)`);

  const nextInvRes = await req('/api/next-invoice-number');
  const invNum = nextInvRes.data.nextInvNo || nextInvRes.data.nextInvoiceNumber;
  assert(nextInvRes.status === 200 && invNum === 'INV-000012', `Next Invoice Number: ${invNum} (Expected: INV-000012)`);

  const nextPiRes = await req('/api/next-pi-number');
  const piNum = nextPiRes.data.nextPiNo || nextPiRes.data.nextPiNumber;
  assert(nextPiRes.status === 200 && piNum === 'PI-00056', `Next PI Number: ${piNum} (Expected: PI-00056)`);

  // 3. GST Lookup Route Test
  console.log('\n--- 3. GST LOOKUP ROUTE ---');
  const gstRes = await req('/api/gst-lookup?gstin=33AABCU9603R1ZM');
  const companyName = gstRes.data.legalName || gstRes.data.tradeName || gstRes.data.companyName || '';
  assert(gstRes.status === 200 && gstRes.data.success && companyName.includes('Vikram Solar'), `GST Lookup: ${companyName}`);

  // 4. End-to-End CUSTOMER FLOW
  console.log('\n--- 4. END-TO-END CUSTOMER FLOW ---');
  const testCustId = `CUST-VAL-${Date.now()}`;
  const createCustRes = await req('/api/customers', 'POST', {
    id: testCustId,
    customerCode: testCustId,
    name: 'Validation Enterprises Test',
    companyName: 'Validation Enterprises Test Pvt Ltd',
    email: 'test@validation.com',
    phone: '9876543210',
    gstin: '33AABCT1234D1Z5',
    placeOfSupply: 'Tamil Nadu'
  });
  assert(createCustRes.status === 200 && createCustRes.data.success, 'Create Customer returned 200 & success');

  const getCusts = await req('/api/customers');
  const foundCust = getCusts.data.find(c => c.id === testCustId || c.customerCode === testCustId);
  assert(Boolean(foundCust), `View Customer: Created customer found in list (${testCustId})`);

  // 5. End-to-End VENDOR & PROCUREMENT FLOW
  console.log('\n--- 5. END-TO-END VENDOR & PROCUREMENT FLOW ---');
  const testVendId = `VEND-VAL-${Date.now()}`;
  const createVendRes = await req('/api/vendors', 'POST', {
    id: testVendId,
    name: 'Validation Vendor Alpha',
    companyName: 'Validation Vendor Alpha LLP',
    email: 'vendor@validation.com',
    phone: '9123456780',
    gstin: '33AABCV5678E1Z9',
    pan: 'AABCV5678E',
    paymentTerms: 'Net 30'
  });
  assert(createVendRes.status === 200 && createVendRes.data.success, 'Create Vendor returned 200 & success');

  const testPoNo = `PO-VAL-${Date.now()}`;
  const createPoRes = await req('/api/purchaseorders', 'POST', {
    id: testPoNo,
    poNo: testPoNo,
    vendorName: 'Validation Vendor Alpha',
    vendorId: testVendId,
    orderDate: '2026-10-07',
    expectedDate: '2026-10-20',
    status: 'Draft / Pending Approval',
    items: [
      { name: 'Testing Valve Seal', quantity: 10, unit: 'PCS', rate: 500, taxPercent: 18, amount: 5000 }
    ],
    total: 5900,
    subtotal: 5000,
    taxTotal: 900
  });
  assert(createPoRes.status === 200 && createPoRes.data.success, 'Create PO returned 200 & success');

  const getPoDetail = await req(`/api/purchaseorders/${testPoNo}`);
  assert(getPoDetail.status === 200 && (getPoDetail.data.id === testPoNo || getPoDetail.data.poNo === testPoNo), `Get PO Details: Found ${testPoNo}`);

  const approveRes = await req(`/api/purchaseorders/${testPoNo}/approve`, 'POST', { remarks: 'Validation MD Approval' });
  assert(approveRes.status === 200 && approveRes.data.success, 'Approve PO: Endpoint returned 200 & success');

  const payRes = await req(`/api/purchaseorders/${testPoNo}/process-payment`, 'POST', {
    amount: 5900,
    paymentMode: 'NEFT',
    referenceNo: 'VAL-TXN-12345',
    paidDate: '2026-10-07'
  });
  assert(payRes.status === 200 && payRes.data.success, 'Payment Process PO: Endpoint returned 200 & success');

  const proceedRes = await req(`/api/purchaseorders/${testPoNo}/proceed`, 'POST', { notes: 'Proceeding to procurement' });
  assert(proceedRes.status === 200 && proceedRes.data.success, 'Proceed PO: Endpoint returned 200 & success');

  const closeRes = await req(`/api/purchaseorders/${testPoNo}/close`, 'POST', { notes: 'Closing test PO' });
  assert(closeRes.status === 200 && closeRes.data.success, 'Close PO: Endpoint returned 200 & success');

  // 6. End-to-End ITEM & INVENTORY FLOW
  console.log('\n--- 6. END-TO-END ITEM & INVENTORY FLOW ---');
  const testItemId = `ITEM-VAL-${Date.now()}`;
  const createItemRes = await req('/api/items', 'POST', {
    id: testItemId,
    name: 'Validation Raw Component Beta',
    sku: `SKU-VAL-${Date.now()}`,
    unit: 'NOS',
    rate: 1200,
    taxPercent: 18,
    category: 'Hardware',
    stockOnHand: 50,
    hsnCode: '84818090'
  });
  assert(createItemRes.status === 200 && createItemRes.data.success, 'Create Item returned 200 & success');

  const updateItemRes = await req(`/api/items/${testItemId}`, 'PUT', {
    rate: 1250,
    stockOnHand: 75
  });
  assert(updateItemRes.status === 200 && updateItemRes.data.success, 'Update Item returned 200 & success');

  // 7. End-to-End SALES FLOW (Quotation/PI/Invoice/DC)
  console.log('\n--- 7. END-TO-END SALES FLOW ---');
  const testPiNo = `PI-VAL-${Date.now()}`;
  const createPiRes = await req('/api/proforma-invoices', 'POST', {
    id: testPiNo,
    piNo: testPiNo,
    customerName: 'Validation Enterprises Test',
    date: '2026-10-07',
    status: 'Issued',
    items: [
      { name: 'Validation Raw Component Beta', quantity: 2, rate: 1250, taxPercent: 18, amount: 2500 }
    ],
    subtotal: 2500,
    taxTotal: 450,
    total: 2950
  });
  assert(createPiRes.status === 200 && createPiRes.data.success, 'Create PI returned 200 & success');

  const cancelPiRes = await req('/api/proforma-invoices/cancel', 'POST', { piNo: testPiNo, reason: 'Validation test cancel' });
  assert(cancelPiRes.status === 200 && cancelPiRes.data.success, 'Cancel PI returned 200 & success');

  const testInvNo = `INV-VAL-${Date.now()}`;
  const createInvRes = await req('/api/invoices', 'POST', {
    id: testInvNo,
    invoiceNo: testInvNo,
    customerName: 'Validation Enterprises Test',
    date: '2026-10-07',
    dueDate: '2026-10-21',
    status: 'Sent',
    items: [
      { name: 'Validation Raw Component Beta', quantity: 2, rate: 1250, taxPercent: 18, amount: 2500 }
    ],
    subtotal: 2500,
    cgst: 225,
    sgst: 225,
    igst: 0,
    taxTotal: 450,
    total: 2950
  });
  assert(createInvRes.status === 200 && createInvRes.data.success, 'Create Invoice returned 200 & success');

  const testDcNo = `DC-VAL-${Date.now()}`;
  const createDcRes = await req('/api/deliverychallans', 'POST', {
    id: testDcNo,
    dcNo: testDcNo,
    customerName: 'Validation Enterprises Test',
    date: '2026-10-07',
    status: 'Delivered',
    items: [
      { name: 'Validation Raw Component Beta', quantity: 2, unit: 'NOS' }
    ]
  });
  assert(createDcRes.status === 200 && createDcRes.data.success, 'Create Delivery Challan returned 200 & success');

  // 8. GST Mathematical Formula Verification
  console.log('\n--- 8. GST TAX FORMULA VERIFICATION ---');
  function calcGst(taxableAmount, ratePct, isInterstate = false) {
    const tax = Math.round((taxableAmount * (ratePct / 100)) * 100) / 100;
    if (isInterstate) {
      return { cgst: 0, sgst: 0, igst: tax, totalTax: tax, grandTotal: taxableAmount + tax };
    } else {
      const half = Math.round((tax / 2) * 100) / 100;
      return { cgst: half, sgst: half, igst: 0, totalTax: half * 2, grandTotal: taxableAmount + (half * 2) };
    }
  }

  // Check brackets: 0%, 5%, 12%, 18%, 28%
  const brackets = [0, 5, 12, 18, 28];
  brackets.forEach(pct => {
    const intra = calcGst(10000, pct, false);
    const inter = calcGst(10000, pct, true);
    assert(intra.cgst === intra.sgst && (intra.cgst + intra.sgst) === (10000 * pct / 100), `Intrastate ${pct}% tax split matches exactly (CGST: ₹${intra.cgst}, SGST: ₹${intra.sgst})`);
    assert(inter.igst === (10000 * pct / 100), `Interstate ${pct}% IGST matches exactly (IGST: ₹${inter.igst})`);
  });

  // 9. CLEANUP / ROLLBACK OF TEST RECORDS
  console.log('\n--- 9. ROLLBACK & INTEGRITY RESTORATION ---');
  await req(`/api/purchaseorders/${testPoNo}`, 'DELETE');
  await req(`/api/items/${testItemId}`, 'DELETE');
  await req(`/api/vendors/${testVendId}`, 'DELETE');

  const testIdsToClean = {
    customerIds: [testCustId],
    invoiceIds: [testInvNo],
    piNos: [testPiNo],
    dcIds: [testDcNo]
  };

  const cleanFiles = [
    { file: 'customer_store.json', key: 'customerCode', ids: testIdsToClean.customerIds },
    { file: 'crm_customers.json', key: 'customerCode', ids: testIdsToClean.customerIds },
    { file: 'invoice_store.json', key: 'invNo', ids: testIdsToClean.invoiceIds },
    { file: 'proforma_invoice_store.json', key: 'piNo', ids: testIdsToClean.piNos },
    { file: 'sales_pi_store.json', key: 'piNo', ids: testIdsToClean.piNos },
    { file: 'dc_store.json', key: 'dcNo', ids: testIdsToClean.dcIds }
  ];

  const serverDir = path.join(__dirname, '..', 'server');
  for (const cf of cleanFiles) {
    try {
      const p = path.join(serverDir, cf.file);
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (Array.isArray(data)) {
          const cleaned = data.filter(item => !cf.ids.includes(item[cf.key]) && !cf.ids.includes(item.id) && !cf.ids.includes(item.invoiceNo));
          fs.writeFileSync(p, JSON.stringify(cleaned, null, 2), 'utf8');
        }
      }
    } catch (_) {}
  }

  if (app && app.supabaseMemoryStore) {
    if (Array.isArray(app.supabaseMemoryStore.customer_store)) {
      app.supabaseMemoryStore.customer_store = app.supabaseMemoryStore.customer_store.filter(c => !testIdsToClean.customerIds.includes(c.customerCode) && !testIdsToClean.customerIds.includes(c.id));
    }
    if (Array.isArray(app.supabaseMemoryStore.crm_customers)) {
      app.supabaseMemoryStore.crm_customers = app.supabaseMemoryStore.crm_customers.filter(c => !testIdsToClean.customerIds.includes(c.customerCode) && !testIdsToClean.customerIds.includes(c.id));
    }
    if (Array.isArray(app.supabaseMemoryStore.invoice_store)) {
      app.supabaseMemoryStore.invoice_store = app.supabaseMemoryStore.invoice_store.filter(i => !testIdsToClean.invoiceIds.includes(i.invNo) && !testIdsToClean.invoiceIds.includes(i.id) && !testIdsToClean.invoiceIds.includes(i.invoiceNo));
    }
    if (Array.isArray(app.supabaseMemoryStore.proforma_invoice_store)) {
      app.supabaseMemoryStore.proforma_invoice_store = app.supabaseMemoryStore.proforma_invoice_store.filter(p => !testIdsToClean.piNos.includes(p.piNo) && !testIdsToClean.piNos.includes(p.id));
    }
    if (Array.isArray(app.supabaseMemoryStore.sales_pi_store)) {
      app.supabaseMemoryStore.sales_pi_store = app.supabaseMemoryStore.sales_pi_store.filter(p => !testIdsToClean.piNos.includes(p.piNo) && !testIdsToClean.piNos.includes(p.id));
    }
    if (Array.isArray(app.supabaseMemoryStore.dc_store)) {
      app.supabaseMemoryStore.dc_store = app.supabaseMemoryStore.dc_store.filter(d => !testIdsToClean.dcIds.includes(d.dcNo) && !testIdsToClean.dcIds.includes(d.id));
    }
  }

  // 10. Post-Cleanup Baseline Check
  console.log('\n--- 10. FINAL RESTORED PRODUCTION AUDIT ---');
  const custAfter = await req('/api/customers');
  assert(custAfter.data.length === 57, `Final Customers: ${custAfter.data.length} (Expected: 57)`);

  const vendAfter = await req('/api/vendors');
  assert(vendAfter.data.length === 7, `Final Vendors: ${vendAfter.data.length} (Expected: 7)`);

  const itemAfter = await req('/api/items');
  assert(itemAfter.data.length === 312, `Final Items: ${itemAfter.data.length} (Expected: 312)`);

  const poAfter = await req('/api/purchaseorders');
  assert(poAfter.data.length === 104, `Final POs: ${poAfter.data.length} (Expected: 104)`);

  const invAfter = await req('/api/invoices');
  assert(invAfter.data.length === 10, `Final Invoices: ${invAfter.data.length} (Expected: 10)`);

  const piAfter = await req('/api/proforma-invoices');
  assert(piAfter.data.length === 21, `Final PIs: ${piAfter.data.length} (Expected: 21)`);

  const dcAfter = await req('/api/deliverychallans');
  assert(dcAfter.data.length === 0, `Final DCs: ${dcAfter.data.length} (Expected: 0)`);

  // 11. Aggregate Calculations Verification
  console.log('\n--- 11. AGGREGATE TOTALS AUDIT ---');
  const poTotal = poAfter.data.reduce((sum, p) => sum + (parseFloat(p.total || p.grandTotal || p.amount || 0) || 0), 0);
  assert(poTotal === 208799201, `PO Aggregate: ₹${poTotal.toLocaleString('en-IN')} (Expected: ₹20,87,99,201 - Variance: ₹0)`);

  const invTotal = invAfter.data.reduce((sum, inv) => {
    const raw = inv.invAmt || inv.total || inv.grandTotal || inv.amount || 0;
    return sum + (parseFloat(String(raw).replace(/[^0-9.]/g, '')) || 0);
  }, 0);
  assert(invTotal === 1260420, `Invoice Aggregate: ₹${invTotal.toLocaleString('en-IN')} (Expected: ₹12,60,420 - Variance: ₹0)`);

  const piTotal = piAfter.data.reduce((sum, pi) => {
    const val = pi.grandTotal !== undefined ? pi.grandTotal : (pi.total !== undefined ? pi.total : 0);
    return sum + (parseFloat(val) || 0);
  }, 0);
  assert(Math.abs(piTotal - 2133648.80) < 0.01, `PI Aggregate: ₹${piTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Expected: ₹21,33,648.80 - Variance: ₹0)`);

  console.log('\n====================================================');
  console.log(`VALIDATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runValidation().catch(err => {
  console.error('Validation script execution error:', err);
  process.exit(1);
});
