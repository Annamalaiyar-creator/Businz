/**
 * Automated Verification Suite for Phase B1: Request Deduplication
 * 
 * Tests:
 * 1. Multiple simultaneous identical requests result in exactly ONE underlying network fetch.
 * 2. All simultaneous callers receive identical resolved arrays.
 * 3. Different search requests (?q=VRM vs ?q=TATA) produce distinct keys and remain independent.
 * 4. Failed requests reject cleanly and are immediately removed from inFlightRequests.
 * 5. Subsequent calls after a failure retry cleanly without returning a cached rejection.
 * 6. Query parameter sorting ensures ?q=A&limit=10 and ?limit=10&q=A map to the same key.
 */

import assert from 'assert';
import { 
  buildCustomerRequestKey, 
  fetchCustomersDeduplicated, 
  getActiveInFlightCount, 
  resetInFlightRegistry 
} from '../src/services/customerService.js';

console.log('========================================================================');
console.log('🧪 Starting Phase B1 Request Deduplication Automated Test Suite');
console.log('========================================================================\n');

// Mock Global Fetch
let networkFetchCount = 0;
let fetchLog = [];
let mockFetchDelay = 50; // ms
let shouldFailNext = false;

const sampleCustomers = [
  { id: 'CUST-001', customerCode: 'CUST-001', companyName: 'VRM Structures India Pvt Ltd' },
  { id: 'CUST-002', customerCode: 'CUST-002', companyName: 'Tata Steel Processing Ltd' }
];

globalThis.fetch = async (url, options = {}) => {
  networkFetchCount++;
  fetchLog.push({ url, timestamp: Date.now() });
  
  await new Promise(r => setTimeout(r, mockFetchDelay));

  if (shouldFailNext) {
    shouldFailNext = false;
    return {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'Database connection failed' })
    };
  }

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => sampleCustomers
  };
};

async function runTests() {
  let passed = 0;

  // Test 1: Key Generation & Query Param Normalization
  console.log('Test 1: Query parameter order invariance in request key...');
  const key1 = buildCustomerRequestKey('/api/customers?limit=50&q=vrm');
  const key2 = buildCustomerRequestKey('/api/customers?q=vrm&limit=50');
  assert.strictEqual(key1, key2, 'Keys with reordered query parameters must match!');
  console.log('  ✅ [PASS] Reordered query params generate identical key:', key1);
  passed++;

  // Test 2: In-Flight Request Deduplication (5 concurrent calls = 1 network request)
  console.log('\nTest 2: 5 simultaneous identical calls to /api/customers...');
  resetInFlightRegistry();
  networkFetchCount = 0;
  fetchLog = [];

  const promises = [
    fetchCustomersDeduplicated('/api/customers'),
    fetchCustomersDeduplicated('/api/customers'),
    fetchCustomersDeduplicated('/api/customers'),
    fetchCustomersDeduplicated('/api/customers'),
    fetchCustomersDeduplicated('/api/customers')
  ];

  // While in flight, registry count must be 1
  assert.strictEqual(getActiveInFlightCount(), 1, 'In-flight registry should have exactly 1 active request!');

  const results = await Promise.all(promises);

  assert.strictEqual(networkFetchCount, 1, `Expected exactly 1 network fetch, got ${networkFetchCount}!`);
  assert.strictEqual(results.length, 5, 'All 5 callers must receive results');
  for (const res of results) {
    assert.strictEqual(res.length, 2, 'Caller must receive 2 sample customers');
    assert.strictEqual(res[0].customerCode, 'CUST-001');
  }
  // After completion, in-flight registry must be empty
  assert.strictEqual(getActiveInFlightCount(), 0, 'In-flight registry must be 0 after completion');
  console.log(`  ✅ [PASS] 5 concurrent requests collapsed into exactly 1 network fetch (Saved 80% redundant calls).`);
  passed++;

  // Test 3: Independent Search Queries Do Not Collide
  console.log('\nTest 3: Concurrent independent queries remain distinct...');
  resetInFlightRegistry();
  networkFetchCount = 0;
  fetchLog = [];

  const queryPromises = [
    fetchCustomersDeduplicated('/api/customers?q=vrm'),
    fetchCustomersDeduplicated('/api/customers?q=vrm'), // should dedupe with first
    fetchCustomersDeduplicated('/api/customers?q=tata'),
    fetchCustomersDeduplicated('/api/customers')
  ];

  assert.strictEqual(getActiveInFlightCount(), 3, 'In-flight registry should track 3 distinct queries!');

  await Promise.all(queryPromises);

  assert.strictEqual(networkFetchCount, 3, `Expected 3 network fetches (q=vrm, q=tata, full), got ${networkFetchCount}!`);
  assert.strictEqual(getActiveInFlightCount(), 0, 'In-flight registry must be 0 after all complete');
  console.log('  ✅ [PASS] 4 calls with 3 unique query signatures resulted in exactly 3 network fetches.');
  passed++;

  // Test 4: Failure & Immediate Retry Capability
  console.log('\nTest 4: Error cleanup and retry without stale rejection...');
  resetInFlightRegistry();
  networkFetchCount = 0;
  shouldFailNext = true;

  let failedError = null;
  try {
    await fetchCustomersDeduplicated('/api/customers');
  } catch (err) {
    failedError = err;
  }

  assert.ok(failedError, 'First call must fail as configured');
  assert.strictEqual(getActiveInFlightCount(), 0, 'In-flight registry must be cleaned up immediately even on error!');

  // Now retry call immediately — it must trigger a new network fetch and succeed
  const retryResult = await fetchCustomersDeduplicated('/api/customers');
  assert.strictEqual(networkFetchCount, 2, 'Retry must issue a new network fetch!');
  assert.strictEqual(retryResult.length, 2, 'Retry must succeed and return customer data');
  console.log('  ✅ [PASS] Failed request cleaned up from registry; retry succeeded immediately.');
  passed++;

  // Test 5: User/Role Scope Context Separation
  console.log('\nTest 5: User context separation...');
  resetInFlightRegistry();
  networkFetchCount = 0;

  const user1Promise = fetchCustomersDeduplicated('/api/customers', {}, { userId: 'USER-A' });
  const user2Promise = fetchCustomersDeduplicated('/api/customers', {}, { userId: 'USER-B' });

  assert.strictEqual(getActiveInFlightCount(), 2, 'Different user contexts must be tracked separately!');
  await Promise.all([user1Promise, user2Promise]);
  assert.strictEqual(networkFetchCount, 2, 'Different user contexts must trigger separate fetches!');
  console.log('  ✅ [PASS] User context separation prevents cross-tenant or cross-salesperson collisions.');
  passed++;

  console.log('\n========================================================================');
  console.log(`🎉 ALL ${passed} PHASE B1 DEDUPLICATION TESTS PASSED WITH 100% SUCCESS!`);
  console.log('========================================================================\n');
}

runTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
