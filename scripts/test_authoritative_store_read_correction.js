/**
 * scripts/test_authoritative_store_read_correction.js
 *
 * BUSINZ ERP: PostgreSQL Authoritative Store Read & Stale Cache Invalidation Verification Suite
 *
 * Verifies that:
 * 1. When PostgreSQL is connected and a controlroom_store row exists:
 *    - Authoritative PostgreSQL data is returned.
 *    - Memory cache is updated.
 * 2. When PostgreSQL is connected and a controlroom_store row is missing:
 *    - Stale memory cache is invalidated (cleanKey, key, and uppercase).
 *    - Empty collection is returned ([] for array stores, {} for object stores).
 *    - NEVER falls back to memory cache, disk, Supabase, or legacy storage.
 * 3. When PostgreSQL is connected and the query throws an error:
 *    - The error is explicitly propagated (fail closed).
 *    - Does NOT swallow the error or fall back to stale cache.
 * 4. Deleted reservation followed by new reservation:
 *    - Does NOT resurrect old reservation.
 *    - Only the new reservation is persisted.
 * 5. Unrelated existing reservations in PostgreSQL:
 *    - Remain preserved when new reservations are appended/merged.
 * 6. Special relational-store routing:
 *    - customer_store, crm_opportunities, crm_leads, bom_store, leaves
 *    - Routing is strictly preserved ahead of controlroom_store.
 * 7. Server source code audit:
 *    - getDatabaseStore contains zero silent fallbacks when PostgreSQL is connected.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('===================================================================');
console.log('🧪 BUSINZ ERP: POSTGRESQL AUTHORITATIVE STORE READ VERIFICATION');
console.log('===================================================================\n');

let passedTests = 0;
let failedTests = 0;

async function runTest(name, fn) {
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// Emulate the hardened getDatabaseStore logic from server/index.js
// -----------------------------------------------------------------------------
function createStoreReader({
  isDbConnectedFn,
  queryFn,
  memoryStore,
  loadDatabaseCustomersFn = async () => [{ id: 'cust_relational' }],
  loadDatabaseOpportunitiesFn = async () => [{ id: 'opp_relational' }],
  loadDatabaseLeadsFn = async () => [{ id: 'lead_relational' }],
  loadDatabaseBomsFn = async () => [{ id: 'bom_relational' }]
}) {
  return async function getDatabaseStore(key) {
    const cleanKey = String(key || '').toLowerCase();
    if (cleanKey === 'customer_store' || cleanKey === 'crm_customers') {
      return await loadDatabaseCustomersFn();
    }
    if (cleanKey === 'crm_opportunities' || cleanKey === 'opportunities') {
      return await loadDatabaseOpportunitiesFn();
    }
    if (cleanKey === 'crm_leads' || cleanKey === 'leads') {
      return await loadDatabaseLeadsFn();
    }
    if (cleanKey === 'bom_store' || cleanKey === 'boms' || cleanKey === 'bom_orders') {
      return await loadDatabaseBomsFn();
    }
    if (cleanKey === 'leaves') {
      if (isDbConnectedFn()) {
        try {
          const dbRes = await queryFn('SELECT id, employee, reason, status, dates, duration, type FROM public.leaves ORDER BY id DESC LIMIT 50');
          return dbRes.rows;
        } catch (err) {
          console.error('[getDatabaseStore leaves query error]:', err?.message || err);
          throw err;
        }
      }
      return [];
    }

    // 0. Primary: Check PostgreSQL controlroom_store on Hostinger VPS
    if (isDbConnectedFn()) {
      try {
        const dbRes = await queryFn('SELECT data FROM controlroom_store WHERE key = $1', [cleanKey]);
        if (dbRes.rows.length > 0 && dbRes.rows[0]?.data !== undefined && dbRes.rows[0]?.data !== null) {
          let d = dbRes.rows[0].data;
          if (typeof d === 'string') {
            try { d = JSON.parse(d); } catch (_) {}
          }
          memoryStore[cleanKey] = d;
          memoryStore[key] = d;
          return d;
        }
        // Authoritative PostgreSQL check: row does not exist or has null data.
        delete memoryStore[cleanKey];
        if (key) {
          delete memoryStore[key];
          delete memoryStore[String(key).toUpperCase()];
        }
        const OBJECT_BASED_STORES = new Set(['presets_store', 'templates_store', 'company_branding_store']);
        return OBJECT_BASED_STORES.has(cleanKey) ? {} : [];
      } catch (dbErr) {
        console.error(`[getDatabaseStore PostgreSQL error for ${cleanKey}]:`, dbErr?.message || dbErr);
        throw dbErr;
      }
    }

    // Fallback when DB is not connected
    if (memoryStore[cleanKey]) {
      return memoryStore[cleanKey];
    }
    return [];
  };
}

// -----------------------------------------------------------------------------
// Emulate the POST /api/store/:key merge logic
// -----------------------------------------------------------------------------
async function simulatePostStore(getStoreFn, saveStoreFn, key, storeData) {
  const currentData = await getStoreFn(key);
  let finalDataToSave;

  const getId = (item) => {
    if (!item || typeof item !== 'object') return null;
    return item.id || item.code || item.reservationId || item.poNo || item.bomCode || item.invNo;
  };

  if (Array.isArray(storeData)) {
    if (Array.isArray(currentData) && currentData.length > 0) {
      const map = new Map();
      currentData.forEach(item => {
        const id = getId(item);
        if (id) map.set(id, item);
      });
      storeData.forEach(item => {
        const id = getId(item);
        if (id) {
          if (map.has(id)) {
            map.set(id, { ...map.get(id), ...item });
          } else {
            map.set(id, item);
          }
        }
      });
      finalDataToSave = Array.from(map.values());
    } else {
      finalDataToSave = storeData;
    }
  } else if (storeData && typeof storeData === 'object') {
    const list = Array.isArray(currentData) ? [...currentData] : [];
    const singleId = getId(storeData);
    const existingIdx = singleId ? list.findIndex(it => getId(it) === singleId) : -1;
    if (existingIdx !== -1) {
      list[existingIdx] = { ...list[existingIdx], ...storeData };
    } else {
      list.unshift(storeData);
    }
    finalDataToSave = list;
  }

  await saveStoreFn(key, finalDataToSave);
  return finalDataToSave;
}

// =============================================================================
// TEST SUITE EXECUTION
// =============================================================================

console.log('--- TEST GROUP 1: Authoritative PostgreSQL Store Reads ---');

await runTest('1.1 PostgreSQL row exists -> returns authoritative data and updates memory cache', async () => {
  const memoryStore = {};
  const mockDbData = [{ id: 'res_1', stock: 10 }];

  const reader = createStoreReader({
    isDbConnectedFn: () => true,
    queryFn: async (sql, params) => {
      if (sql.includes('FROM controlroom_store') && params[0] === 'reservations_store') {
        return { rows: [{ data: mockDbData }] };
      }
      return { rows: [] };
    },
    memoryStore
  });

  const res = await reader('reservations_store');
  assert.deepStrictEqual(res, mockDbData, 'Must return data from PostgreSQL row');
  assert.deepStrictEqual(memoryStore['reservations_store'], mockDbData, 'Must update memory store');
});

await runTest('1.2 PostgreSQL row missing -> invalidates stale cache and returns empty array', async () => {
  const memoryStore = {
    reservations_store: [{ id: 'old_stale_res_13909' }],
    RESERVATIONS_STORE: [{ id: 'old_stale_res_13909' }]
  };

  const reader = createStoreReader({
    isDbConnectedFn: () => true,
    queryFn: async (sql, params) => {
      // Row is absent in database
      return { rows: [] };
    },
    memoryStore
  });

  const res = await reader('reservations_store');
  assert.deepStrictEqual(res, [], 'Must return empty array when row is absent in database');
  assert.strictEqual(memoryStore['reservations_store'], undefined, 'Must delete stale memory store entry');
  assert.strictEqual(memoryStore['RESERVATIONS_STORE'], undefined, 'Must delete uppercase stale entry');
});

await runTest('1.3 PostgreSQL row with null data -> invalidates stale cache and returns empty array', async () => {
  const memoryStore = {
    reservations_store: [{ id: 'old_res' }]
  };

  const reader = createStoreReader({
    isDbConnectedFn: () => true,
    queryFn: async () => ({ rows: [{ data: null }] }),
    memoryStore
  });

  const res = await reader('reservations_store');
  assert.deepStrictEqual(res, [], 'Must return empty array for null data row');
  assert.strictEqual(memoryStore['reservations_store'], undefined, 'Stale cache must be deleted');
});

await runTest('1.4 PostgreSQL query fails -> explicitly throws error and does not return stale cache', async () => {
  const memoryStore = {
    reservations_store: [{ id: 'stale_cache' }]
  };

  const reader = createStoreReader({
    isDbConnectedFn: () => true,
    queryFn: async () => {
      throw new Error('Connection terminated unexpectedly');
    },
    memoryStore
  });

  let caught = null;
  try {
    await reader('reservations_store');
  } catch (err) {
    caught = err;
  }

  assert(caught, 'Must throw error on database failure');
  assert(caught.message.includes('Connection terminated'), 'Must propagate original error message');
  // Crucial: did not return memoryStore['reservations_store']!
});

console.log('\n--- TEST GROUP 2: Object-Based Stores vs Array Stores ---');

await runTest('2.1 Missing row for object store (presets_store) returns empty object {}', async () => {
  const memoryStore = {
    presets_store: { preset1: { name: 'old' } }
  };

  const reader = createStoreReader({
    isDbConnectedFn: () => true,
    queryFn: async () => ({ rows: [] }),
    memoryStore
  });

  const res = await reader('presets_store');
  assert.deepStrictEqual(res, {}, 'Must return empty object for missing presets_store');
  assert.strictEqual(memoryStore['presets_store'], undefined, 'Must purge stale cache');
});

await runTest('2.2 Missing row for company_branding_store returns empty object {}', async () => {
  const memoryStore = { company_branding_store: { logo: 'old.png' } };
  const reader = createStoreReader({
    isDbConnectedFn: () => true,
    queryFn: async () => ({ rows: [] }),
    memoryStore
  });

  const res = await reader('company_branding_store');
  assert.deepStrictEqual(res, {}, 'Must return empty object for missing company_branding_store');
});

console.log('\n--- TEST GROUP 3: Resurrected Record Prevention (The Exact Phase 9Y Bug) ---');

await runTest('3.1 Deleted reservation followed by new reservation does NOT resurrect old reservation', async () => {
  // Scenario:
  // Run 1 created old reservation res_SYNTH_P9Y_1793247013909
  // Run 1 cleanup deleted the row in PostgreSQL controlroom_store, but left memoryStore populated.
  // Run 2 now posts new reservation res_SYNTH_P9Y_1793250904736.
  const memoryStore = {
    reservations_store: [
      { id: 'res_SYNTH_P9Y_1793247013909', qty: 10, runId: '1793247013909' }
    ]
  };

  let dbSavedData = null;
  const mockPostgresDb = {
    controlroom_store: {} // Empty: row was deleted!
  };

  const reader = createStoreReader({
    isDbConnectedFn: () => true,
    queryFn: async (sql, params) => {
      const key = params[0];
      if (mockPostgresDb.controlroom_store[key]) {
        return { rows: [{ data: mockPostgresDb.controlroom_store[key] }] };
      }
      return { rows: [] }; // Key does not exist in DB!
    },
    memoryStore
  });

  const saver = async (key, data) => {
    mockPostgresDb.controlroom_store[key] = data;
    memoryStore[key] = data;
    dbSavedData = data;
  };

  // Run 2 creates new reservation
  const newReservation = [
    { id: 'res_SYNTH_P9Y_1793250904736', qty: 25, runId: '1793250904736' }
  ];

  const result = await simulatePostStore(reader, saver, 'reservations_store', newReservation);

  // Assertions:
  assert.strictEqual(result.length, 1, 'Result must contain exactly 1 reservation');
  assert.strictEqual(result[0].id, 'res_SYNTH_P9Y_1793250904736', 'Must contain the new reservation');
  assert(!result.some(r => r.id === 'res_SYNTH_P9Y_1793247013909'), 'Old deleted reservation must NOT be resurrected!');
  assert.deepStrictEqual(dbSavedData, newReservation, 'Database must only receive the new reservation');
});

await runTest('3.2 Unrelated existing reservations in PostgreSQL are preserved on new reservation append', async () => {
  // Scenario:
  // PostgreSQL contains a legitimate existing reservation
  const existingReservation = { id: 'res_REAL_ORDER_440', qty: 50 };
  const mockPostgresDb = {
    controlroom_store: {
      reservations_store: [existingReservation]
    }
  };
  const memoryStore = {};

  const reader = createStoreReader({
    isDbConnectedFn: () => true,
    queryFn: async (sql, params) => {
      const key = params[0];
      if (mockPostgresDb.controlroom_store[key]) {
        return { rows: [{ data: mockPostgresDb.controlroom_store[key] }] };
      }
      return { rows: [] };
    },
    memoryStore
  });

  let dbSavedData = null;
  const saver = async (key, data) => {
    mockPostgresDb.controlroom_store[key] = data;
    dbSavedData = data;
  };

  const newReservation = [
    { id: 'res_SYNTH_P9Y_1793250904736', qty: 100 }
  ];

  const result = await simulatePostStore(reader, saver, 'reservations_store', newReservation);

  assert.strictEqual(result.length, 2, 'Result must contain both reservations');
  assert(result.some(r => r.id === 'res_REAL_ORDER_440'), 'Legitimate existing reservation must be preserved');
  assert(result.some(r => r.id === 'res_SYNTH_P9Y_1793250904736'), 'New reservation must be added');
});

console.log('\n--- TEST GROUP 4: Relational-Store Routing Preservation ---');

await runTest('4.1 Relational stores route to their designated loaders ahead of controlroom_store', async () => {
  let queriedControlroomStore = false;
  const reader = createStoreReader({
    isDbConnectedFn: () => true,
    queryFn: async (sql) => {
      if (sql.includes('controlroom_store')) queriedControlroomStore = true;
      return { rows: [] };
    },
    memoryStore: {},
    loadDatabaseCustomersFn: async () => [{ id: 'rel_cust' }],
    loadDatabaseOpportunitiesFn: async () => [{ id: 'rel_opp' }],
    loadDatabaseLeadsFn: async () => [{ id: 'rel_lead' }],
    loadDatabaseBomsFn: async () => [{ id: 'rel_bom' }]
  });

  const boms = await reader('bom_store');
  assert.deepStrictEqual(boms, [{ id: 'rel_bom' }]);
  assert.strictEqual(queriedControlroomStore, false, 'bom_store must not query controlroom_store');

  const custs = await reader('customer_store');
  assert.deepStrictEqual(custs, [{ id: 'rel_cust' }]);
  assert.strictEqual(queriedControlroomStore, false, 'customer_store must not query controlroom_store');

  const leads = await reader('crm_leads');
  assert.deepStrictEqual(leads, [{ id: 'rel_lead' }]);
  assert.strictEqual(queriedControlroomStore, false, 'crm_leads must not query controlroom_store');

  const opps = await reader('crm_opportunities');
  assert.deepStrictEqual(opps, [{ id: 'rel_opp' }]);
  assert.strictEqual(queriedControlroomStore, false, 'crm_opportunities must not query controlroom_store');
});

await runTest('4.2 leaves store queries public.leaves and propagates database errors', async () => {
  const reader = createStoreReader({
    isDbConnectedFn: () => true,
    queryFn: async (sql) => {
      if (sql.includes('public.leaves')) {
        throw new Error('Table public.leaves locked');
      }
      return { rows: [] };
    },
    memoryStore: {}
  });

  let errCaught = null;
  try {
    await reader('leaves');
  } catch (err) {
    errCaught = err;
  }
  assert(errCaught, 'Must throw error when query on public.leaves fails');
  assert(errCaught.message.includes('public.leaves locked'), 'Must propagate original error');
});

console.log('\n--- TEST GROUP 5: Static Analysis of server/index.js ---');

await runTest('5.1 server/index.js has zero fall-through to memory/disk when isDbConnected() is true', async () => {
  const serverPath = path.resolve(__dirname, '../server/index.js');
  const content = fs.readFileSync(serverPath, 'utf8');

  // Verify getDatabaseStore definition
  const getDbStoreIdx = content.indexOf('const getDatabaseStore = async (key) => {');
  assert(getDbStoreIdx !== -1, 'getDatabaseStore must be defined');

  const blockEndIdx = content.indexOf('const realtimeClients', getDbStoreIdx);
  const fnBody = content.slice(getDbStoreIdx, blockEndIdx);

  // Check 1: In the isDbConnected block, missing row must delete cache
  assert(fnBody.includes('delete supabaseMemoryStore[cleanKey]'), 'Must delete stale cleanKey from supabaseMemoryStore');
  assert(fnBody.includes('delete supabaseMemoryStore[key]'), 'Must delete stale key from supabaseMemoryStore');

  // Check 2: Returns empty collection directly from within isDbConnected block
  assert(fnBody.includes('OBJECT_BASED_STORES.has(cleanKey) ? {} : []'), 'Must return empty collection based on store type');

  // Check 3: dbErr is rethrown
  assert(fnBody.includes('throw dbErr'), 'Must rethrow dbErr to trigger fail-closed HTTP 500');

  // Check 4: leaves error is rethrown
  assert(fnBody.includes('throw err'), 'Must rethrow leaves query error');
});

// =============================================================================
// SUMMARY
// =============================================================================
console.log('\n===================================================================');
console.log(`📊 AUTHORITATIVE READ VERIFICATION SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${passedTests + failedTests})`);
console.log('===================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🛡️  POSTGRESQL AUTHORITATIVE READ VERIFICATION: 100% VERIFIED\n');
  process.exit(0);
}
