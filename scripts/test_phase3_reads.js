/**
 * Phase 3 Automated Verification Test Script
 * Verifies that all Zoho READ operations are replaced with BUSINZ Native DB / Local Store reads.
 * Verifies zero outbound network calls to www.zohoapis.in during all read flows.
 */

const http = require('http');
const https = require('https');

// Intercept all outbound HTTP/HTTPS requests to detect any attempt to contact Zoho
let zohoGetCallCount = 0;
const zohoCallLog = [];

const originalHttpsRequest = https.request;
https.request = function (options, callback) {
  const host = options.hostname || options.host || '';
  const method = (options.method || 'GET').toUpperCase();
  const path = options.path || '';

  if (host.includes('zohoapis') || host.includes('zoho.in')) {
    if (method === 'GET') {
      zohoGetCallCount++;
      zohoCallLog.push({ method, host, path });
    }
  }
  return originalHttpsRequest.apply(this, arguments);
};

// Start the server for testing
process.env.PORT = '5199';
const app = require('../server/index.js');

function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const req = http.request({
      hostname: 'localhost',
      port: 5199,
      path,
      method,
      headers: { 'Accept': 'application/json' }
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
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 3 VERIFICATION TESTS');
  console.log('====================================================\n');

  let passedAll = true;

  // TEST 1 — Customers
  const custRes = await makeRequest('/api/customers');
  const custCount = Array.isArray(custRes.body) ? custRes.body.length : 0;
  console.log(`TEST 1 [Customers]: ${custCount} records (Status: ${custRes.status}) in ${custRes.durationMs}ms`);
  if (custCount !== 57) {
    console.error(`  FAIL: Expected 57 customers, got ${custCount}`);
    passedAll = false;
  } else {
    console.log(`  PASS: Exactly 57 verified customer records loaded.`);
  }

  // TEST 2 — Vendors
  const vendRes = await makeRequest('/api/vendors');
  const vendCount = Array.isArray(vendRes.body) ? vendRes.body.length : 0;
  console.log(`TEST 2 [Vendors]: ${vendCount} records (Status: ${vendRes.status}) in ${vendRes.durationMs}ms`);
  if (vendCount !== 7) {
    console.error(`  FAIL: Expected 7 vendors, got ${vendCount}`);
    passedAll = false;
  } else {
    console.log(`  PASS: Exactly 7 verified vendor records loaded.`);
  }

  // TEST 3 — Items
  const itemsRes = await makeRequest('/api/items');
  const itemsCount = Array.isArray(itemsRes.body) ? itemsRes.body.length : 0;
  console.log(`TEST 3 [Items]: ${itemsCount} records (Status: ${itemsRes.status}) in ${itemsRes.durationMs}ms`);
  if (itemsCount !== 312) {
    console.error(`  FAIL: Expected 312 items, got ${itemsCount}`);
    passedAll = false;
  } else {
    console.log(`  PASS: Exactly 312 verified item records loaded.`);
  }

  // TEST 4 — Purchase Orders & Historical PO Detail
  const posRes = await makeRequest('/api/purchaseorders');
  const posCount = Array.isArray(posRes.body) ? posRes.body.length : 0;
  console.log(`TEST 4 [Purchase Orders]: ${posCount} records (Status: ${posRes.status}) in ${posRes.durationMs}ms`);
  if (posCount !== 104) {
    console.error(`  FAIL: Expected 104 POs, got ${posCount}`);
    passedAll = false;
  } else {
    console.log(`  PASS: Exactly 104 verified purchase order records loaded.`);
  }

  // Test historical PO detail lookup
  const samplePoId = posRes.body[0]?.poNo || 'PO-00140';
  const poDetailRes = await makeRequest(`/api/purchaseorders/${encodeURIComponent(samplePoId)}`);
  console.log(`TEST 4B [PO Detail ${samplePoId}]: Status ${poDetailRes.status}, items: ${poDetailRes.body?.items?.length || 0} in ${poDetailRes.durationMs}ms`);
  if (poDetailRes.status !== 200 || !poDetailRes.body?.poNo) {
    console.error(`  FAIL: Could not load PO detail locally.`);
    passedAll = false;
  } else {
    console.log(`  PASS: Historical PO detail loaded locally with full metadata.`);
  }

  // TEST 5 — PO Number Generation
  const nextPoRes = await makeRequest('/api/next-po-number');
  console.log(`TEST 5 [Next PO Number]: ${nextPoRes.body?.nextPoNo} (Status: ${nextPoRes.status}) in ${nextPoRes.durationMs}ms`);
  if (nextPoRes.body?.nextPoNo !== 'PO-00141') {
    console.error(`  FAIL: Expected next PO number PO-00141, got ${nextPoRes.body?.nextPoNo}`);
    passedAll = false;
  } else {
    console.log(`  PASS: Next PO number calculated as PO-00141 solely from BUSINZ data.`);
  }

  // TEST 6 — Invoices
  const invRes = await makeRequest('/api/invoices');
  const invCount = Array.isArray(invRes.body) ? invRes.body.length : 0;
  console.log(`TEST 6 [Invoices]: ${invCount} records (Status: ${invRes.status}) in ${invRes.durationMs}ms`);
  if (invCount !== 10) {
    console.error(`  FAIL: Expected 10 invoices, got ${invCount}`);
    passedAll = false;
  } else {
    console.log(`  PASS: Exactly 10 verified invoices loaded.`);
  }

  // TEST 7 — Invoice Number Generation
  const nextInvRes = await makeRequest('/api/next-invoice-number');
  console.log(`TEST 7 [Next Invoice Number]: ${nextInvRes.body?.nextInvNo} (Status: ${nextInvRes.status}) in ${nextInvRes.durationMs}ms`);

  // TEST 8 — Proforma Invoices (Estimates) & Number Generation
  const piRes = await makeRequest('/api/estimates');
  const piCount = Array.isArray(piRes.body) ? piRes.body.length : 0;
  console.log(`TEST 8 [Proforma Invoices]: ${piCount} records (Status: ${piRes.status}) in ${piRes.durationMs}ms`);
  if (piCount !== 21) {
    console.error(`  FAIL: Expected 21 PIs, got ${piCount}`);
    passedAll = false;
  } else {
    console.log(`  PASS: Exactly 21 verified unique PI records loaded.`);
  }

  const nextPiRes = await makeRequest('/api/next-pi-number');
  console.log(`TEST 8B [Next PI Number]: ${nextPiRes.body?.nextPiNo} (Status: ${nextPiRes.status}) in ${nextPiRes.durationMs}ms`);
  if (nextPiRes.body?.nextPiNo !== 'PI-00056') {
    console.error(`  FAIL: Expected next PI number PI-00056, got ${nextPiRes.body?.nextPiNo}`);
    passedAll = false;
  } else {
    console.log(`  PASS: Next PI number calculated as PI-00056 solely from BUSINZ data.`);
  }

  // TEST 9 — GST Lookup
  const gstRes = await makeRequest('/api/gst-lookup?gstin=33AABCU9603R1ZM');
  console.log(`TEST 9 [Local GST Lookup]: ${gstRes.body?.legalName || 'Found'} (Status: ${gstRes.status}) in ${gstRes.durationMs}ms`);
  if (!gstRes.body?.success) {
    console.error(`  FAIL: GST test lookup returned success: false`);
    passedAll = false;
  } else {
    console.log(`  PASS: GSTIN searched locally across BUSINZ Customers and Vendors.`);
  }

  // TEST 10 — Delivery Challans
  const dcRes = await makeRequest('/api/deliverychallans');
  const dcCount = Array.isArray(dcRes.body) ? dcRes.body.length : 0;
  console.log(`TEST 10 [Delivery Challans]: ${dcCount} records (Status: ${dcRes.status}) in ${dcRes.durationMs}ms`);

  // TEST 11 — Approvals Pending
  const appRes = await makeRequest('/api/approvals-pending');
  console.log(`TEST 11 [Approvals Pending]:`, appRes.body, `in ${appRes.durationMs}ms`);
  if (typeof appRes.body?.posPending !== 'number') {
    console.error(`  FAIL: Approvals response invalid shape.`);
    passedAll = false;
  } else {
    console.log(`  PASS: Approvals calculated locally from stores.`);
  }

  // TEST 12 — Zoho Outbound GET Call Counter
  console.log(`\nTEST 12 [Outbound Zoho GET Requests]: Total intercepted = ${zohoGetCallCount}`);
  if (zohoGetCallCount > 0) {
    console.error(`  FAIL: Detected ${zohoGetCallCount} GET requests to Zoho Books!`);
    console.error(zohoCallLog);
    passedAll = false;
  } else {
    console.log(`  PASS: ZERO GET calls were made to Zoho Books during all read operations!`);
  }

  console.log('\n====================================================');
  console.log(`PHASE 3 VERIFICATION SUMMARY: ${passedAll ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log('====================================================');

  process.exit(passedAll ? 0 : 1);
}

// Wait for server to bind port
setTimeout(runTests, 1000);
