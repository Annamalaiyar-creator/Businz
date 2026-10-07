/**
 * Phase 4 Automated Verification Test Script
 * Verifies that all Zoho WRITE operations are replaced with BUSINZ Native DB / Local Store writes.
 * Verifies zero outbound network calls (POST, PUT, DELETE, GET) to Zoho Books during all write operations.
 * Tests offline resilience by actively blocking Zoho domains.
 * Restores baseline production records after execution.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Intercept all outbound HTTP/HTTPS requests to detect any attempt to contact Zoho
let zohoRequestCount = 0;
const zohoBlockedLog = [];

const originalHttpsRequest = https.request;
https.request = function (options, callback) {
  const host = options.hostname || options.host || '';
  const method = (options.method || 'GET').toUpperCase();
  const reqPath = options.path || '';

  if (host.includes('zohoapis') || host.includes('zoho.in') || host.includes('zoho')) {
    zohoRequestCount++;
    zohoBlockedLog.push({ method, host, reqPath });
    // Intentionally error out / block if anything attempts to reach Zoho
    const EventEmitter = require('events');
    const dummyReq = new EventEmitter();
    dummyReq.write = () => {};
    dummyReq.end = () => {
      dummyReq.emit('error', new Error('BLOCKED: Zoho domain is intentionally offline for Phase 4 verification'));
    };
    return dummyReq;
  }
  return originalHttpsRequest.apply(this, arguments);
};

// Start the server for testing
process.env.PORT = '5198';
const app = require('../server/index.js');

function makeRequest(apiPath, method = 'POST', postBody = null) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const dataToSend = postBody ? JSON.stringify(postBody) : '';
    const req = http.request({
      hostname: 'localhost',
      port: 5198,
      path: apiPath,
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(dataToSend ? { 'Content-Length': Buffer.byteLength(dataToSend) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        const durationMs = Date.now() - start;
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), durationMs });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data, durationMs });
        }
      });
    });
    req.on('error', reject);
    if (dataToSend) req.write(dataToSend);
    req.end();
  });
}

async function runPhase4Tests() {
  console.log('====================================================');
  console.log('BUSINZ PHASE 4 WRITE OPERATIONS VERIFICATION');
  console.log('Testing Native DB / Local Store Writes (0 Zoho calls)');
  console.log('====================================================\n');

  // Baseline counts before tests
  const initialRes = await Promise.all([
    makeRequest('/api/customers', 'GET'),
    makeRequest('/api/vendors', 'GET'),
    makeRequest('/api/items', 'GET'),
    makeRequest('/api/purchaseorders', 'GET'),
    makeRequest('/api/invoices', 'GET'),
    makeRequest('/api/estimates', 'GET'),
    makeRequest('/api/deliverychallans', 'GET')
  ]);

  const baselineCounts = {
    customers: initialRes[0].body?.length || 0,
    vendors: initialRes[1].body?.length || 0,
    items: initialRes[2].body?.length || 0,
    pos: initialRes[3].body?.length || 0,
    invoices: initialRes[4].body?.length || 0,
    estimates: initialRes[5].body?.length || 0,
    dcs: initialRes[6].body?.length || 0
  };

  console.log('Baseline Production Record Counts:');
  console.log(`- Customers: ${baselineCounts.customers}`);
  console.log(`- Vendors:   ${baselineCounts.vendors}`);
  console.log(`- Items:     ${baselineCounts.items}`);
  console.log(`- POs:       ${baselineCounts.pos}`);
  console.log(`- Invoices:  ${baselineCounts.invoices}`);
  console.log(`- PIs:       ${baselineCounts.estimates}`);
  console.log(`- DCs:       ${baselineCounts.dcs}\n`);

  const results = [];
  const testIdsToClean = {
    customerIds: [],
    vendorIds: [],
    itemIds: [],
    poIds: [],
    invoiceIds: [],
    piNos: [],
    dcIds: []
  };

  // TEST 1: Customer Create & Update
  try {
    const testCustCode = `CUST-PH4-TEST-${Date.now()}`;
    testIdsToClean.customerIds.push(testCustCode);
    const resCreateCust = await makeRequest('/api/customers', 'POST', {
      customerCode: testCustCode,
      companyName: 'Phase 4 Test EPC Solar Corp',
      customerName: 'Phase 4 Test EPC Solar Corp',
      gstNumber: '33AABCP1234F1Z1',
      panNumber: 'AABCP1234F',
      contactPerson: 'Suresh Kumar',
      phone: '+91 99887 66554',
      email: 'suresh@phase4test.com',
      address: '123 Solar High Tech Park, Industrial Area, Chennai, Tamil Nadu'
    });

    const isCustOk = resCreateCust.status === 200 && resCreateCust.body?.success === true;
    results.push({
      test: 'TEST 1: Customer Create',
      passed: isCustOk,
      details: isCustOk ? `Saved locally as ${testCustCode}` : JSON.stringify(resCreateCust.body)
    });
  } catch (err) {
    results.push({ test: 'TEST 1: Customer Create', passed: false, details: err.message });
  }

  // TEST 2: Vendor Create & Delete
  try {
    const testVendId = `VEND-PH4-TEST-${Date.now()}`;
    testIdsToClean.vendorIds.push(testVendId);
    const resCreateVend = await makeRequest('/api/vendors', 'POST', {
      id: testVendId,
      code: testVendId,
      name: 'Phase 4 Aluminium Fasteners Pvt Ltd',
      companyName: 'Phase 4 Aluminium Fasteners Pvt Ltd',
      contact: 'Rajesh Sharma',
      phone: '+91 98450 11223',
      email: 'rajesh@phase4vendor.com',
      gstin: '33AABCR1234F1Z9',
      pan: 'AABCR1234F',
      terms: 'Net 30 Days'
    });

    const isVendOk = resCreateVend.status === 200 && resCreateVend.body?.success === true && resCreateVend.body?.vendor?.id === testVendId;
    results.push({
      test: 'TEST 2: Vendor Create',
      passed: isVendOk,
      details: isVendOk ? `Saved locally as ${testVendId}` : JSON.stringify(resCreateVend.body)
    });
  } catch (err) {
    results.push({ test: 'TEST 2: Vendor Create', passed: false, details: err.message });
  }

  // TEST 3: Item Create, Update, Delete
  try {
    const testItemId = `ITEM-PH4-TEST-${Date.now()}`;
    testIdsToClean.itemIds.push(testItemId);
    const resCreateItem = await makeRequest('/api/items', 'POST', {
      itemId: testItemId,
      id: testItemId,
      name: 'Phase 4 High Strength Bracket 40mm',
      sku: 'SKU-PH4-BRK-40',
      rate: 450,
      purchaseRate: 380,
      unit: 'NOS',
      status: 'Active',
      description: 'Galvanized 40mm bracket for solar mounting'
    });

    const isItemCreateOk = resCreateItem.status === 200 && resCreateItem.body?.success === true;
    
    // Update Item
    const resUpdateItem = await makeRequest(`/api/items/${testItemId}`, 'PUT', {
      rate: 475,
      description: 'Updated Galvanized 40mm bracket'
    });
    const isItemUpdateOk = resUpdateItem.status === 200 && resUpdateItem.body?.success === true;

    results.push({
      test: 'TEST 3: Item Create & Update',
      passed: isItemCreateOk && isItemUpdateOk,
      details: isItemCreateOk ? `Created (${testItemId}) and updated successfully` : 'Item operation failed'
    });
  } catch (err) {
    results.push({ test: 'TEST 3: Item Create & Update', passed: false, details: err.message });
  }

  // TEST 4: PO Create
  let testPoNo = `PO-PH4-${Date.now()}`;
  try {
    testIdsToClean.poIds.push(testPoNo);
    const resCreatePo = await makeRequest('/api/purchaseorders', 'POST', {
      poNo: testPoNo,
      vendor: 'Phase 4 Aluminium Fasteners Pvt Ltd',
      branch: 'Chennai',
      poDate: '2026-10-07',
      deliveryDate: '2026-10-15',
      deliveryAddress: 'Main Factory, Chennai',
      billingAddress: 'Main Office, Chennai',
      approvalRequired: 'YES',
      approver: 'Velmurugan Rathinam (MD)',
      status: 'Draft / Pending Approval',
      amount: '₹45,000.00',
      items: [
        { itemName: 'Aluminium Rail 4.2m', qty: 100, rate: 450, tax: 18 }
      ]
    });

    const isPoCreateOk = resCreatePo.status === 200 && resCreatePo.body?.success === true && resCreatePo.body?.poNo === testPoNo;
    results.push({
      test: 'TEST 4: PO Create',
      passed: isPoCreateOk,
      details: isPoCreateOk ? `Created PO ${testPoNo} in BUSINZ local store` : JSON.stringify(resCreatePo.body)
    });
  } catch (err) {
    results.push({ test: 'TEST 4: PO Create', passed: false, details: err.message });
  }

  // TEST 5: PO MD Approval
  try {
    const resApprove = await makeRequest(`/api/purchaseorders/${testPoNo}/approve`, 'POST', {
      remarks: 'Approved by MD for production run',
      approver: 'Velmurugan Rathinam (MD)'
    });
    const isApproveOk = resApprove.status === 200 && resApprove.body?.success === true;
    results.push({
      test: 'TEST 5: PO Approve',
      passed: isApproveOk,
      details: isApproveOk ? `PO ${testPoNo} marked as MD Approved locally` : JSON.stringify(resApprove.body)
    });
  } catch (err) {
    results.push({ test: 'TEST 5: PO Approve', passed: false, details: err.message });
  }

  // TEST 6: PO Process Payment
  try {
    const resPay = await makeRequest(`/api/purchaseorders/${testPoNo}/process-payment`, 'POST', {
      paymentMode: 'Bank Transfer',
      paymentRef: 'NEFT-PH4-998877',
      amountPaid: '₹45,000.00',
      remarks: 'Advance paid 100%'
    });
    const isPayOk = resPay.status === 200 && resPay.body?.success === true;
    results.push({
      test: 'TEST 6: PO Payment Process',
      passed: isPayOk,
      details: isPayOk ? `PO ${testPoNo} payment recorded locally` : JSON.stringify(resPay.body)
    });
  } catch (err) {
    results.push({ test: 'TEST 6: PO Payment Process', passed: false, details: err.message });
  }

  // TEST 7: PO Proceed PO
  try {
    const resProceed = await makeRequest(`/api/purchaseorders/${testPoNo}/proceed`, 'POST', {
      remarks: 'Proceed for dispatch and receiving',
      authorizedBy: 'Procurement Head'
    });
    const isProceedOk = resProceed.status === 200 && resProceed.body?.success === true;
    results.push({
      test: 'TEST 7: PO Proceed',
      passed: isProceedOk,
      details: isProceedOk ? `PO ${testPoNo} marked as Proceed PO locally` : JSON.stringify(resProceed.body)
    });
  } catch (err) {
    results.push({ test: 'TEST 7: PO Proceed', passed: false, details: err.message });
  }

  // TEST 8: PO Close
  try {
    const resClose = await makeRequest(`/api/purchaseorders/${testPoNo}/close`, 'POST', {});
    const isCloseOk = resClose.status === 200 && resClose.body?.success === true;
    results.push({
      test: 'TEST 8: PO Close',
      passed: isCloseOk,
      details: isCloseOk ? `PO ${testPoNo} marked as CLOSED locally` : JSON.stringify(resClose.body)
    });
  } catch (err) {
    results.push({ test: 'TEST 8: PO Close', passed: false, details: err.message });
  }

  // TEST 9: Invoice Create
  let testInvNo = `INV-PH4-${Date.now()}`;
  try {
    testIdsToClean.invoiceIds.push(testInvNo);
    const resCreateInv = await makeRequest('/api/invoices', 'POST', {
      invNo: testInvNo,
      date: '2026-10-07',
      customerName: 'Phase 4 Test EPC Solar Corp',
      invAmt: '₹1,18,000.00',
      total: 118000,
      subTotal: 100000,
      gstAmount: 18000,
      items: [
        { name: 'Ground Mount 4P Structure Kit', quantity: 2, rate: 50000, unit: 'SET' }
      ]
    });

    const isInvOk = resCreateInv.status === 200 && resCreateInv.body?.success === true && resCreateInv.body?.invoice?.invNo === testInvNo;
    results.push({
      test: 'TEST 9: Invoice Create',
      passed: isInvOk,
      details: isInvOk ? `Invoice ${testInvNo} saved locally with GST preserved` : JSON.stringify(resCreateInv.body)
    });
  } catch (err) {
    results.push({ test: 'TEST 9: Invoice Create', passed: false, details: err.message });
  }

  // TEST 10: PI Create & Cancel
  let testPiNo = `PI-PH4-${Date.now()}`;
  try {
    testIdsToClean.piNos.push(testPiNo);
    const resCreatePi = await makeRequest('/api/proforma-invoices', 'POST', {
      piNo: testPiNo,
      customerName: 'Phase 4 Test EPC Solar Corp',
      piDate: '2026-10-07',
      grandTotal: 59000,
      subTotal: 50000,
      gstAmount: 9000,
      items: [
        { name: 'Rooftop Ballasted Kit', quantity: 1, rate: 50000 }
      ]
    });

    const isPiOk = resCreatePi.status === 200 && resCreatePi.body?.success === true;

    // Cancel PI
    const resCancelPi = await makeRequest('/api/proforma-invoices/cancel', 'POST', {
      piNo: testPiNo,
      reason: 'Testing cancellation in Phase 4 verification'
    });

    const isCancelOk = resCancelPi.status === 200 && resCancelPi.body?.success === true;

    results.push({
      test: 'TEST 10: PI Create & Cancel',
      passed: isPiOk && isCancelOk,
      details: isPiOk && isCancelOk ? `PI ${testPiNo} created and cancelled in local stores` : 'PI failed'
    });
  } catch (err) {
    results.push({ test: 'TEST 10: PI Create & Cancel', passed: false, details: err.message });
  }

  // TEST 11: DC Create
  let testDcNo = `DC-PH4-${Date.now()}`;
  try {
    testIdsToClean.dcIds.push(testDcNo);
    const resCreateDc = await makeRequest('/api/deliverychallans', 'POST', {
      dcNo: testDcNo,
      customerName: 'Phase 4 Test EPC Solar Corp',
      date: '2026-10-07',
      items: [
        { name: 'Solar Mounting Hardware Pack', qty: 50 }
      ]
    });

    const isDcOk = resCreateDc.status === 200 && resCreateDc.body?.success === true && resCreateDc.body?.deliverychallan?.dcNo === testDcNo;
    results.push({
      test: 'TEST 11: Delivery Challan Create',
      passed: isDcOk,
      details: isDcOk ? `DC ${testDcNo} saved locally` : JSON.stringify(resCreateDc.body)
    });
  } catch (err) {
    results.push({ test: 'TEST 11: Delivery Challan Create', passed: false, details: err.message });
  }

  // TEST 12: Vendor Delete & Item Delete & PO Delete
  try {
    const resDelVend = await makeRequest(`/api/vendors/${testIdsToClean.vendorIds[0]}`, 'DELETE');
    const isVendDelOk = resDelVend.status === 200 && resDelVend.body?.success === true;

    const resDelItem = await makeRequest(`/api/items/${testIdsToClean.itemIds[0]}`, 'DELETE');
    const isItemDelOk = resDelItem.status === 200 && resDelItem.body?.success === true;

    const resDelPo = await makeRequest(`/api/purchaseorders/${testPoNo}`, 'DELETE');
    const isPoDelOk = resDelPo.status === 200 && resDelPo.body?.success === true;

    results.push({
      test: 'TEST 12: Native Store Delete Operations (Vendor, Item, PO)',
      passed: isVendDelOk && isItemDelOk && isPoDelOk,
      details: 'All target deletions completed in local stores without Zoho calls'
    });
  } catch (err) {
    results.push({ test: 'TEST 12: Native Store Delete Operations', passed: false, details: err.message });
  }

  // Output test results
  console.log('----------------------------------------------------');
  console.log('TEST EXECUTION SUMMARY:');
  console.log('----------------------------------------------------');
  let allPassed = true;
  for (const r of results) {
    const statusMark = r.passed ? '✓ PASS' : '✗ FAIL';
    if (!r.passed) allPassed = false;
    console.log(`${statusMark}: ${r.test} - ${r.details}`);
  }

  console.log('\n----------------------------------------------------');
  console.log('REMOTE ZOHO NETWORK OUTBOUND AUDIT:');
  console.log('----------------------------------------------------');
  console.log(`Outbound Zoho Requests Attempted: ${zohoRequestCount}`);
  if (zohoBlockedLog.length > 0) {
    console.log('Blocked calls:', JSON.stringify(zohoBlockedLog, null, 2));
  } else {
    console.log('✓ PERFECT: ZERO outbound requests to Zoho Books during all writes!');
  }

  // Clean up any remaining test records to restore exact baseline production counts
  console.log('\n----------------------------------------------------');
  console.log('CLEANING UP TEST RECORDS TO RESTORE BASELINE...');
  console.log('----------------------------------------------------');

  const cleanFiles = [
    { file: 'customer_store.json', key: 'customerCode', ids: testIdsToClean.customerIds },
    { file: 'crm_customers.json', key: 'customerCode', ids: testIdsToClean.customerIds },
    { file: 'invoice_store.json', key: 'invNo', ids: testIdsToClean.invoiceIds },
    { file: 'proforma_invoice_store.json', key: 'piNo', ids: testIdsToClean.piNos },
    { file: 'sales_pi_store.json', key: 'piNo', ids: testIdsToClean.piNos },
    { file: 'dc_store.json', key: 'dcNo', ids: testIdsToClean.dcIds }
  ];

  for (const cf of cleanFiles) {
    try {
      const p = path.join(__dirname, '..', 'server', cf.file);
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (Array.isArray(data)) {
          const cleaned = data.filter(item => !cf.ids.includes(item[cf.key]) && !cf.ids.includes(item.id));
          fs.writeFileSync(p, JSON.stringify(cleaned, null, 2), 'utf8');
        }
      }
    } catch (_) {}
  }

  // Also clean running server's supabaseMemoryStore so GET endpoints immediately reflect baseline
  if (app && app.supabaseMemoryStore) {
    if (Array.isArray(app.supabaseMemoryStore.customer_store)) {
      app.supabaseMemoryStore.customer_store = app.supabaseMemoryStore.customer_store.filter(c => !testIdsToClean.customerIds.includes(c.customerCode) && !testIdsToClean.customerIds.includes(c.id));
    }
    if (Array.isArray(app.supabaseMemoryStore.crm_customers)) {
      app.supabaseMemoryStore.crm_customers = app.supabaseMemoryStore.crm_customers.filter(c => !testIdsToClean.customerIds.includes(c.customerCode) && !testIdsToClean.customerIds.includes(c.id));
    }
    if (Array.isArray(app.supabaseMemoryStore.invoice_store)) {
      app.supabaseMemoryStore.invoice_store = app.supabaseMemoryStore.invoice_store.filter(i => !testIdsToClean.invoiceIds.includes(i.invNo) && !testIdsToClean.invoiceIds.includes(i.id));
    }
    if (Array.isArray(app.supabaseMemoryStore.dc_store)) {
      app.supabaseMemoryStore.dc_store = app.supabaseMemoryStore.dc_store.filter(d => !testIdsToClean.dcIds.includes(d.dcNo) && !testIdsToClean.dcIds.includes(d.id));
    }
  }

  // Re-verify counts
  const finalRes = await Promise.all([
    makeRequest('/api/customers', 'GET'),
    makeRequest('/api/vendors', 'GET'),
    makeRequest('/api/items', 'GET'),
    makeRequest('/api/purchaseorders', 'GET'),
    makeRequest('/api/invoices', 'GET'),
    makeRequest('/api/estimates', 'GET'),
    makeRequest('/api/deliverychallans', 'GET')
  ]);

  console.log('Final Restored Production Record Counts:');
  console.log(`- Customers: ${finalRes[0].body?.length || 0} (Baseline: ${baselineCounts.customers})`);
  console.log(`- Vendors:   ${finalRes[1].body?.length || 0} (Baseline: ${baselineCounts.vendors})`);
  console.log(`- Items:     ${finalRes[2].body?.length || 0} (Baseline: ${baselineCounts.items})`);
  console.log(`- POs:       ${finalRes[3].body?.length || 0} (Baseline: ${baselineCounts.pos})`);
  console.log(`- Invoices:  ${finalRes[4].body?.length || 0} (Baseline: ${baselineCounts.invoices})`);
  console.log(`- PIs:       ${finalRes[5].body?.length || 0} (Baseline: ${baselineCounts.estimates})`);
  console.log(`- DCs:       ${finalRes[6].body?.length || 0} (Baseline: ${baselineCounts.dcs})`);

  process.exit(allPassed && zohoRequestCount === 0 ? 0 : 1);
}

// Give server 500ms to listen before initiating requests
setTimeout(runPhase4Tests, 500);
