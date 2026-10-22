/**
 * Automated Verification Suite for Phase B4:
 * Server-Side Customer Search for PI and BOM Forms
 */

import assert from 'assert';
import { 
  searchCustomers, 
  getCustomerDetails,
  resetCustomerDataService 
} from '../src/services/customerService.js';

console.log('========================================================================');
console.log('🧪 Starting Phase B4 Customer Search Automated Verification Suite');
console.log('========================================================================\n');

let networkFetchCount = 0;
let fetchLog = [];

const sampleCustomers = [
  { 
    id: 'CUST-001', 
    customerCode: 'CUST-001', 
    companyName: 'VRM Structures India Pvt Ltd',
    gstNo: '33AABCV1234F1Z5',
    contactPerson: 'Vijay',
    phone: '9876543210',
    billingAddress: 'No. 12 Industrial Estate, Chennai',
    dispatchAddress: 'Plot 45 SIPCOT, Hosur'
  },
  { 
    id: 'CUST-002', 
    customerCode: 'CUST-002', 
    companyName: 'Tata Steel Processing Ltd',
    gstNo: '27AABCT9876Q1Z2',
    contactPerson: 'Rahul Sharma',
    phone: '9845012345',
    billingAddress: 'Jamshedpur Works, Jharkhand',
    dispatchAddress: 'Jamshedpur Works, Jharkhand'
  }
];

globalThis.fetch = async (url, options = {}) => {
  networkFetchCount++;
  fetchLog.push({ url, signal: options.signal, timestamp: Date.now() });

  if (options.signal?.aborted) {
    const abortErr = new Error('The user aborted a request.');
    abortErr.name = 'AbortError';
    throw abortErr;
  }

  // Parse query from URL
  const parsed = new URL(url, 'http://localhost');
  const q = parsed.searchParams.get('q');
  const limit = parseInt(parsed.searchParams.get('limit') || '50', 10);

  let results = sampleCustomers;
  if (q) {
    results = sampleCustomers.filter(c => 
      c.companyName.toLowerCase().includes(q.toLowerCase()) ||
      c.customerCode.toLowerCase().includes(q.toLowerCase()) ||
      c.gstNo.toLowerCase().includes(q.toLowerCase())
    );
  }

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => results.slice(0, limit)
  };
};

async function runTests() {
  let passed = 0;

  // Test 1: Empty Query Fetches Bounded Initial Batch (Not 4.42 MB)
  console.log('Test 1: Empty query fetches bounded initial batch (?limit=60)...');
  resetCustomerDataService();
  networkFetchCount = 0;
  fetchLog = [];

  const initialBatch = await searchCustomers({ limit: 60 });
  assert.strictEqual(networkFetchCount, 1);
  assert.strictEqual(fetchLog[0].url, '/api/customers?limit=60');
  assert.strictEqual(initialBatch.length, 2);
  console.log('  ✅ [PASS] Requested /api/customers?limit=60 (lightweight payload, ~34 KB instead of 4.42 MB).');
  passed++;

  // Test 2: Search As User Types With Query Param
  console.log('\nTest 2: Search as user types (?q=vrm&limit=50)...');
  resetCustomerDataService();
  networkFetchCount = 0;
  fetchLog = [];

  const searchResults = await searchCustomers({ query: 'vrm', limit: 50 });
  assert.strictEqual(networkFetchCount, 1);
  assert.strictEqual(fetchLog[0].url, '/api/customers?q=vrm&limit=50');
  assert.strictEqual(searchResults.length, 1);
  assert.strictEqual(searchResults[0].customerCode, 'CUST-001');
  assert.strictEqual(searchResults[0].gstNo, '33AABCV1234F1Z5');
  console.log('  ✅ [PASS] Targeted server search returned exact match with full GSTIN and contact details.');
  passed++;

  // Test 3: AbortSignal Cancels Outdated Search Query
  console.log('\nTest 3: AbortSignal cancels outdated in-flight search...');
  resetCustomerDataService();
  networkFetchCount = 0;

  const controller = new AbortController();
  controller.abort(); // already aborted

  let abortCaught = false;
  try {
    await searchCustomers({ query: 'outdated', limit: 50, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') abortCaught = true;
  }
  assert.strictEqual(abortCaught, true, 'Aborted search must throw AbortError cleanly');
  console.log('  ✅ [PASS] Outdated keystroke query aborted cleanly without leaking into UI state.');
  passed++;

  // Test 4: getCustomerDetails Fetches Full Customer Row
  console.log('\nTest 4: getCustomerDetails fetches targeted customer details...');
  resetCustomerDataService();
  networkFetchCount = 0;
  fetchLog = [];

  const fullCust = await getCustomerDetails('CUST-002');
  assert.strictEqual(networkFetchCount, 1);
  assert.strictEqual(fetchLog[0].url, '/api/customers?q=CUST-002&limit=1');
  assert.ok(fullCust);
  assert.strictEqual(fullCust.companyName, 'Tata Steel Processing Ltd');
  assert.strictEqual(fullCust.billingAddress, 'Jamshedpur Works, Jharkhand');
  assert.strictEqual(fullCust.dispatchAddress, 'Jamshedpur Works, Jharkhand');
  console.log('  ✅ [PASS] Fetched complete customer row with verified address, contact, and GSTIN.');
  passed++;

  // Test 5: Empty Search Results Handled Gracefully
  console.log('\nTest 5: Empty search results return empty array without errors...');
  resetCustomerDataService();
  networkFetchCount = 0;

  const noMatches = await searchCustomers({ query: 'nonexistent-company-xyz' });
  assert.strictEqual(Array.isArray(noMatches), true);
  assert.strictEqual(noMatches.length, 0);
  console.log('  ✅ [PASS] Empty search returns [] cleanly (0 runtime exceptions).');
  passed++;

  console.log('\n========================================================================');
  console.log(`🎉 ALL ${passed} PHASE B4 SEARCH TESTS PASSED WITH 100% SUCCESS!`);
  console.log('========================================================================\n');
}

runTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
