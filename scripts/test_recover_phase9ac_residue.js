/**
 * scripts/test_recover_phase9ac_residue.js
 *
 * BUSINZ ERP: Safety and Verification Suite for Phase 9AC Residue Recovery
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  EXPECTED_OPTIMIZATION_TEST_WORKSPACE,
  BASELINE_STORE_KEYS,
  DYNAMIC_STORE_KEYS,
  verifyWorkspaceIsolation,
  isSyntheticMarkerMatch,
  verifySyntheticEmployeeOwnership,
  verifySyntheticBomOwnership,
  verifySyntheticReservationOwnership,
  verifySyntheticInvoiceOwnership,
  verifySyntheticLedgerOwnership,
  verifySyntheticNotificationOwnership,
  cleanSyntheticUploads,
  runPhase9acResidueRecovery
} from './recover_phase9ac_residue.js';

console.log('===================================================================');
console.log('🧪 BUSINZ ERP: PHASE 9AC RESIDUE RECOVERY TEST SUITE');
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

// =============================================================================
// TEST GROUP 1: Workspace & Pattern Isolation Validation
// =============================================================================
console.log('--- TEST GROUP 1: Workspace & Pattern Isolation Validation ---');

await runTest('1.1 verifyWorkspaceIsolation approves test workspace and rejects production/development/hrms', () => {
  assert.strictEqual(verifyWorkspaceIsolation('/var/www/businz-optimization-test'), true);
  assert.strictEqual(verifyWorkspaceIsolation('/var/www/businz'), false);
  assert.strictEqual(verifyWorkspaceIsolation('/var/www/businz-dev'), false);
  assert.strictEqual(verifyWorkspaceIsolation('/var/www/hrms'), false);
  assert.strictEqual(verifyWorkspaceIsolation('/tmp'), false);
});

await runTest('1.2 isSyntheticMarkerMatch identifies synthetic markers accurately', () => {
  const marker = 'SYNTH_P9AC_1793260000000';
  assert.strictEqual(isSyntheticMarkerMatch(`VRM-${marker}-01`, marker), true);
  assert.strictEqual(isSyntheticMarkerMatch('VRM-BOM-2026-001', marker), false);
  assert.strictEqual(isSyntheticMarkerMatch(null, marker), false);
  assert.strictEqual(isSyntheticMarkerMatch('', marker), false);
});

// =============================================================================
// TEST GROUP 2: Ownership Attribution Verification
// =============================================================================
console.log('\n--- TEST GROUP 2: Ownership Attribution Verification ---');

await runTest('2.1 verifySyntheticEmployeeOwnership matches synthetic employees and preserves genuine staff', () => {
  const marker = 'SYNTH_P9AC_1793260000000';
  const synthEmp = { employee_code: `SE-PEND-${marker}`, email: `pend_${marker}@example.com` };
  const genuineEmp = { employee_code: 'SE-001', email: 'karthik@vrmstructures.com' };

  assert.strictEqual(verifySyntheticEmployeeOwnership(synthEmp, marker), true);
  assert.strictEqual(verifySyntheticEmployeeOwnership(genuineEmp, marker), false);
});

await runTest('2.2 verifySyntheticBomOwnership matches synthetic BOMs and preserves customer BOMs', () => {
  const marker = 'SYNTH_P9AC_1793260000000';
  const synthBom = { bom_code: `VRM-BOM-${marker}`, client_name: `Test Client ${marker}` };
  const realBom = { bom_code: 'VRM-BOM-2026-0042', client_name: 'Tata Power Solar' };

  assert.strictEqual(verifySyntheticBomOwnership(synthBom, marker), true);
  assert.strictEqual(verifySyntheticBomOwnership(realBom, marker), false);
});

await runTest('2.3 verifySyntheticReservationOwnership matches synthetic stock reservations', () => {
  const marker = 'SYNTH_P9AC_1793260000000';
  const synthRes = { id: `RES-${marker}-MR100`, refNo: `BOM-${marker}` };
  const realRes = { id: 'RES-BOM-2026-0042-MR100', refNo: 'VRM-BOM-2026-0042' };

  assert.strictEqual(verifySyntheticReservationOwnership(synthRes, marker), true);
  assert.strictEqual(verifySyntheticReservationOwnership(realRes, marker), false);
});

await runTest('2.4 verifySyntheticInvoiceOwnership matches synthetic invoices', () => {
  const marker = 'SYNTH_P9AC_1793260000000';
  const synthInv = { invNo: `INV-${marker}`, poNo: `BOM-${marker}` };
  const realInv = { invNo: 'INV-2026-0099', poNo: 'VRM-BOM-2026-0042' };

  assert.strictEqual(verifySyntheticInvoiceOwnership(synthInv, marker), true);
  assert.strictEqual(verifySyntheticInvoiceOwnership(realInv, marker), false);
});

await runTest('2.5 verifySyntheticLedgerOwnership matches synthetic transactions and preserves genuine ledger', () => {
  const marker = 'SYNTH_P9AC_1793260000000';
  const synthTx = { id: `TX-PROD-${marker}`, refNo: `BOM-${marker}` };
  const realTx = { id: 'TX-PROD-998877', refNo: 'VRM-BOM-2026-0042' };

  assert.strictEqual(verifySyntheticLedgerOwnership(synthTx, marker), true);
  assert.strictEqual(verifySyntheticLedgerOwnership(realTx, marker), false);
});

await runTest('2.6 verifySyntheticNotificationOwnership matches synthetic notifications', () => {
  const marker = 'SYNTH_P9AC_1793260000000';
  const synthNotif = { title: `BOM Order Created: BOM-${marker}`, message: `Details for ${marker}` };
  const realNotif = { title: 'System Central Inventory Initialized', message: 'Ready' };

  assert.strictEqual(verifySyntheticNotificationOwnership(synthNotif, marker), true);
  assert.strictEqual(verifySyntheticNotificationOwnership(realNotif, marker), false);
});

// =============================================================================
// TEST GROUP 3: Transactional Mock Recovery & Baseline Integrity
// =============================================================================
console.log('\n--- TEST GROUP 3: Transactional Mock Recovery & Baseline Integrity ---');

function createMockPgClient(initialStoreData = {}, initialBoms = [], initialLeads = []) {
  const store = new Map(Object.entries(initialStoreData));
  const boms = [...initialBoms];
  const leads = [...initialLeads];
  const executedStatements = [];

  return {
    executedStatements,
    async query(sql, params = []) {
      executedStatements.push({ sql, params });

      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rows: [] };
      }

      if (sql.includes('FROM public.bom_orders')) {
        return { rows: [...boms] };
      }

      if (sql.includes('DELETE FROM public.bom_orders WHERE id = $1')) {
        const id = params[0];
        const idx = boms.findIndex(b => b.id === id);
        if (idx !== -1) boms.splice(idx, 1);
        return { rowCount: 1 };
      }

      if (sql.includes('FROM public.leads')) {
        return { rows: [...leads] };
      }

      if (sql.includes('DELETE FROM public.leads WHERE id = $1')) {
        const id = params[0];
        const idx = leads.findIndex(l => l.id === id);
        if (idx !== -1) leads.splice(idx, 1);
        return { rowCount: 1 };
      }

      if (sql.includes('SELECT key, data FROM public.controlroom_store')) {
        const rows = [];
        for (const [key, data] of store.entries()) {
          rows.push({ key, data });
        }
        return { rows };
      }

      if (sql.includes('UPDATE public.controlroom_store SET data = $1')) {
        const [dataJson, key] = params;
        store.set(key, JSON.parse(dataJson));
        return { rowCount: 1 };
      }

      if (sql.includes('DELETE FROM public.controlroom_store WHERE key = $1')) {
        const [key] = params;
        store.delete(key);
        return { rowCount: 1 };
      }

      if (sql.includes('SELECT key FROM public.controlroom_store ORDER BY key')) {
        const keys = Array.from(store.keys()).sort();
        return { rows: keys.map(k => ({ key: k })) };
      }

      return { rows: [] };
    }
  };
}

await runTest('3.1 runPhase9acResidueRecovery successfully cleans mock synthetic state across all stores and restores 3 baseline keys', async () => {
  const marker = 'SYNTH_P9AC_1793260000000';
  const initialStore = {
    customer_pis_store: [{ piNumber: `PI-${marker}` }],
    employees_store: [
      { employee_code: `SE-PEND-${marker}`, email: `pend_${marker}@example.com` },
      { employee_code: 'SE-ACTUAL-01', email: 'actual@vrmstructures.com' }
    ],
    quotations_store: [{ quotationNo: `QT-${marker}` }],
    vrm_prod_ledger: [{ id: `TX-${marker}`, refNo: `BOM-${marker}` }],
    notifications_store: [{ id: `NOTIF-${marker}`, title: `Notification ${marker}` }],
    bom_store: [{ bomCode: `BOM-${marker}` }],
    invoice_store: [{ invNo: `INV-${marker}` }],
    reservations_store: [{ id: `RES-${marker}` }]
  };

  const initialBoms = [{ id: 101, bom_code: `BOM-${marker}`, client_name: `Client ${marker}` }];
  const initialLeads = [{ id: 201, lead_number: 'VRM-LD-99', company_name: `Company ${marker}` }];

  const mockClient = createMockPgClient(initialStore, initialBoms, initialLeads);

  const report = await runPhase9acResidueRecovery({
    execute: true,
    mock: true,
    mockClient,
    synthMarker: marker
  });

  assert.strictEqual(report.committed, true);
  assert.strictEqual(report.baselineVerified, true);
  assert.strictEqual(report.syntheticBomsDeleted, 1);
  assert.strictEqual(report.syntheticLeadsDeleted, 1);
  assert.strictEqual(report.employeesCleaned, 1);
  assert.strictEqual(report.reservationsCleaned, 1);
  assert.strictEqual(report.invoicesCleaned, 1);
  assert.strictEqual(report.ledgerCleaned, 1);
  assert.strictEqual(report.notificationsCleaned, 1);
  assert.deepStrictEqual(report.storeKeysRemoved.sort(), ['bom_store', 'invoice_store', 'notifications_store', 'reservations_store', 'vrm_prod_ledger']);
  assert.deepStrictEqual(report.finalStoreKeys.sort(), ['customer_pis_store', 'employees_store', 'quotations_store']);
});

await runTest('3.2 runPhase9acResidueRecovery rolls back if an unrelated non-synthetic reservation is present', async () => {
  const marker = 'SYNTH_P9AC_1793260000000';
  const initialStore = {
    customer_pis_store: [],
    employees_store: [],
    quotations_store: [],
    reservations_store: [
      { id: `RES-${marker}` },
      { id: 'RES-GENUINE-CUSTOMER-001', refNo: 'VRM-BOM-2026-9999' }
    ]
  };

  const mockClient = createMockPgClient(initialStore, [], []);

  let threw = false;
  try {
    await runPhase9acResidueRecovery({
      execute: true,
      mock: true,
      mockClient,
      synthMarker: marker
    });
  } catch (err) {
    threw = true;
    assert.match(err.message, /Unrelated non-synthetic reservation found/);
  }

  assert.strictEqual(threw, true);
  const rollbackCalled = mockClient.executedStatements.some(s => s.sql === 'ROLLBACK');
  assert.strictEqual(rollbackCalled, true);
});

await runTest('3.3 runPhase9acResidueRecovery rolls back if an unrelated non-synthetic invoice is present', async () => {
  const marker = 'SYNTH_P9AC_1793260000000';
  const initialStore = {
    customer_pis_store: [],
    employees_store: [],
    quotations_store: [],
    invoice_store: [
      { invNo: `INV-${marker}` },
      { invNo: 'INV-OFFICIAL-2026-0042', clientName: 'Reliance Solar' }
    ]
  };

  const mockClient = createMockPgClient(initialStore, [], []);

  let threw = false;
  try {
    await runPhase9acResidueRecovery({
      execute: true,
      mock: true,
      mockClient,
      synthMarker: marker
    });
  } catch (err) {
    threw = true;
    assert.match(err.message, /Unrelated non-synthetic invoice found/);
  }

  assert.strictEqual(threw, true);
  const rollbackCalled = mockClient.executedStatements.some(s => s.sql === 'ROLLBACK');
  assert.strictEqual(rollbackCalled, true);
});

await runTest('3.4 runPhase9acResidueRecovery issues ROLLBACK and reports committed: false in dry-run mode', async () => {
  const marker = 'SYNTH_P9AC_1793260000000';
  const initialStore = {
    customer_pis_store: [],
    employees_store: [],
    quotations_store: []
  };

  const mockClient = createMockPgClient(initialStore, [], []);

  const report = await runPhase9acResidueRecovery({
    execute: false, // Dry Run
    mock: true,
    mockClient,
    synthMarker: marker
  });

  assert.strictEqual(report.committed, false);
  assert.strictEqual(report.mode, 'DRY_RUN');
  const rollbackCalled = mockClient.executedStatements.some(s => s.sql === 'ROLLBACK');
  assert.strictEqual(rollbackCalled, true);
});

console.log('\n===================================================================');
console.log(`📊 TEST RESULTS: ${passedTests} passed, ${failedTests} failed.`);
console.log('===================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
