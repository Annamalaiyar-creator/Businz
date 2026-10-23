/**
 * Automated Verification Suite for Phase B1 & B2:
 * In-Flight Request Deduplication and Scoped In-Memory Customer Cache
 */

import assert from 'assert';
import { 
  buildCustomerRequestKey, 
  fetchCustomersDeduplicated, 
  getCustomers,
  getCachedCustomers,
  invalidateCustomerCache,
  clearCustomerCacheOnLogout,
  setCustomerCacheTTL,
  getActiveInFlightCount, 
  getCacheEntriesCount,
  resetCustomerDataService 
} from '../src/services/customerService.js';

console.log('========================================================================');
console.log('🧪 Starting Phase B1 & B2 Full Automated Verification Suite');
console.log('========================================================================\n');

let networkFetchCount = 0;
let fetchLog = [];
let mockFetchDelay = 40; // ms
let shouldFailNext = false;
let mockResponseData = [
  { id: 'CUST-001', customerCode: 'CUST-001', companyName: 'VRM Structures India Pvt Ltd', gstNo: '33AABCV1234F1Z5' },
  { id: 'CUST-002', customerCode: 'CUST-002', companyName: 'Tata Steel Processing Ltd', gstNo: '27AABCT9876Q1Z2' }
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
      json: async () => ({ error: 'Simulated backend fault' })
    };
  }

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => JSON.parse(JSON.stringify(mockResponseData))
  };
};

async function runTests() {
  let passed = 0;

  // Test 1: B1 Concurrent Deduplication
  console.log('Test 1: Phase B1 — 5 concurrent requests collapse into 1 network fetch...');
  resetCustomerDataService();
  networkFetchCount = 0;

  const b1Promises = [
    fetchCustomersDeduplicated('/api/customers'),
    fetchCustomersDeduplicated('/api/customers'),
    fetchCustomersDeduplicated('/api/customers'),
    fetchCustomersDeduplicated('/api/customers'),
    fetchCustomersDeduplicated('/api/customers')
  ];

  assert.strictEqual(getActiveInFlightCount(), 1, 'In-flight registry should have exactly 1 active request');
  const b1Results = await Promise.all(b1Promises);

  assert.strictEqual(networkFetchCount, 1, `Expected 1 network fetch, got ${networkFetchCount}`);
  assert.strictEqual(b1Results.length, 5);
  assert.strictEqual(getActiveInFlightCount(), 0, 'In-flight registry must be empty after completion');
  console.log('  ✅ [PASS] 5 concurrent requests -> 1 network fetch (80% network egress eliminated).');
  passed++;

  // Test 2: B2 Cache Hit within TTL (Zero Network Requests)
  console.log('\nTest 2: Phase B2 — Subsequent calls within TTL served from memory (0 network fetches)...');
  // At this point, customerCache has 1 entry. Calling getCustomers() again should hit cache.
  const cachedResult = await getCustomers();
  assert.strictEqual(networkFetchCount, 1, 'Network fetch count must remain 1 (Cache Hit!)');
  assert.strictEqual(cachedResult.length, 2);
  assert.strictEqual(cachedResult[0].customerCode, 'CUST-001');
  console.log('  ✅ [PASS] Cache hit confirmed: Returned 2 customer records with 0 network calls (100% latency reduction).');
  passed++;

  // Test 3: B2 User Scope Context Separation
  console.log('\nTest 3: Phase B2 — Cross-user data isolation (User A vs User B)...');
  resetCustomerDataService();
  networkFetchCount = 0;

  mockResponseData = [{ id: 'CUST-USERA', customerCode: 'CUST-A', companyName: 'Client for Salesperson A' }];
  const userAData = await fetchCustomersDeduplicated('/api/customers', {}, { userId: 'USER-A', role: 'Sales Executive' });

  mockResponseData = [{ id: 'CUST-USERB', customerCode: 'CUST-B', companyName: 'Client for Salesperson B' }];
  const userBData = await fetchCustomersDeduplicated('/api/customers', {}, { userId: 'USER-B', role: 'Sales Executive' });

  assert.strictEqual(networkFetchCount, 2, 'Different user contexts must issue separate fetches');
  assert.strictEqual(userAData[0].customerCode, 'CUST-A');
  assert.strictEqual(userBData[0].customerCode, 'CUST-B');

  // Requesting User A again must hit User A's cache, not User B's
  const userARecheck = await fetchCustomersDeduplicated('/api/customers', {}, { userId: 'USER-A', role: 'Sales Executive' });
  assert.strictEqual(networkFetchCount, 2, 'User A second request must hit User A cache with 0 network calls');
  assert.strictEqual(userARecheck[0].customerCode, 'CUST-A');
  console.log('  ✅ [PASS] User context scoping prevents data leakage between salespersons.');
  passed++;

  // Test 4: B2 Invalidation on Data Mutation (Create/Update/Delete)
  console.log('\nTest 4: Phase B2 — Cache invalidation forces fresh fetch on next call...');
  resetCustomerDataService();
  networkFetchCount = 0;

  mockResponseData = [{ id: 'CUST-001', companyName: 'Original Name' }];
  await getCustomers();
  assert.strictEqual(networkFetchCount, 1);

  // Invalidate cache (simulating customer creation/update)
  invalidateCustomerCache();
  assert.strictEqual(getCacheEntriesCount(), 0, 'Cache must be empty after invalidation');

  mockResponseData = [{ id: 'CUST-001', companyName: 'Updated Name After Save' }];
  const freshResult = await getCustomers();
  assert.strictEqual(networkFetchCount, 2, 'Invalidation must trigger fresh network fetch');
  assert.strictEqual(freshResult[0].companyName, 'Updated Name After Save');
  console.log('  ✅ [PASS] Invalidation successfully evicted stale data and retrieved updated customer record.');
  passed++;

  // Test 5: B2 Stale In-Flight Guard
  console.log('\nTest 5: Phase B2 — Stale in-flight response cannot repopulate invalidated cache...');
  resetCustomerDataService();
  networkFetchCount = 0;
  mockFetchDelay = 60; // slow request

  mockResponseData = [{ id: 'CUST-STALE', companyName: 'Old In-Flight Data' }];

  // 1. Start a slow fetch
  const slowPromise = fetchCustomersDeduplicated('/api/customers');

  // 2. While request is in-flight, an invalidation occurs (e.g. user updated a customer in another tab)
  await new Promise(r => setTimeout(r, 10));
  invalidateCustomerCache();

  // 3. Slow fetch resolves
  await slowPromise;

  // 4. Verify that the stale data was NOT cached!
  assert.strictEqual(getCacheEntriesCount(), 0, 'Stale in-flight response must NOT enter the cache after invalidation!');
  console.log('  ✅ [PASS] Stale in-flight response rejected from cache; race-condition prevented.');
  mockFetchDelay = 40;
  passed++;

  // Test 6: B2 Configurable TTL Expiration
  console.log('\nTest 6: Phase B2 — TTL expiration auto-evicts stale cache...');
  resetCustomerDataService();
  networkFetchCount = 0;
  setCustomerCacheTTL(50); // 50ms TTL for testing

  await getCustomers();
  assert.strictEqual(networkFetchCount, 1);

  // Wait 70ms to let TTL expire
  await new Promise(r => setTimeout(r, 70));

  await getCustomers();
  assert.strictEqual(networkFetchCount, 2, 'Expired TTL must trigger a new network fetch');
  setCustomerCacheTTL(5 * 60 * 1000); // restore 5m default
  console.log('  ✅ [PASS] TTL expiration auto-evicts expired data cleanly.');
  passed++;

  // Test 7: B2 Logout Purge
  console.log('\nTest 7: Phase B2 — Full session purge on logout...');
  resetCustomerDataService();
  networkFetchCount = 0;

  await getCustomers({ userId: 'USER-CURRENT' });
  assert.strictEqual(getCacheEntriesCount(), 1);

  clearCustomerCacheOnLogout();
  assert.strictEqual(getCacheEntriesCount(), 0, 'Cache must be 0 after logout');
  assert.strictEqual(getActiveInFlightCount(), 0, 'In-flight registry must be 0 after logout');
  console.log('  ✅ [PASS] Logout completely wipes all cached customer memory.');
  passed++;

  // Test 8: Failed responses are NEVER cached
  console.log('\nTest 8: Error handling — Failed responses are never cached...');
  resetCustomerDataService();
  networkFetchCount = 0;
  shouldFailNext = true;

  try {
    await fetchCustomersDeduplicated('/api/customers');
  } catch (_) {}

  assert.strictEqual(getCacheEntriesCount(), 0, 'Failed response must never enter cache');
  console.log('  ✅ [PASS] Errors leave cache clean; 0 poisoned cache entries.');
  passed++;

  console.log('\n========================================================================');
  console.log(`🎉 ALL ${passed} PHASE B1 & B2 TESTS PASSED WITH 100% SUCCESS!`);
  console.log('========================================================================\n');
}

runTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
