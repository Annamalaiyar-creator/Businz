/**
 * scripts/test_recover_phase9ab_mixed_residue.js
 *
 * BUSINZ ERP: Safety and Verification Suite for Mixed Residue Recovery (Phase 9AB)
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  EXPECTED_OPTIMIZATION_TEST_WORKSPACE,
  TARGET_RUNS,
  BASELINE_STORE_KEYS,
  NEWLY_CREATED_STORE_KEYS,
  REQUIRED_BACKUP_PATH,
  REQUIRED_BACKUP_SHA256,
  verifyWorkspaceIsolation,
  verifyRecoveryBackup,
  verifySyntheticLeadOwnership,
  verifySyntheticBomOwnership,
  verifySyntheticEmployeeOwnership,
  verifySyntheticQuotationOwnership,
  verifySyntheticPiOwnership,
  verifySyntheticInvoiceOwnership,
  verifySyntheticReservationOwnership,
  runMixedResidueRecovery
} from './recover_phase9ab_mixed_residue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('===================================================================');
console.log('🧪 BUSINZ ERP: PHASE 9AB MIXED RESIDUE RECOVERY TEST SUITE');
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
// TEST GROUP 1: Workspace & Database Isolation Validation
// =============================================================================
console.log('--- TEST GROUP 1: Workspace & Database Isolation Validation ---');

await runTest('1.1 verifyWorkspaceIsolation approves test workspace and rejects all other paths', () => {
  assert.strictEqual(verifyWorkspaceIsolation('/var/www/businz-optimization-test'), true);
  assert.strictEqual(verifyWorkspaceIsolation('/var/www/businz'), false);
  assert.strictEqual(verifyWorkspaceIsolation('/var/www/businz-dev'), false);
  assert.strictEqual(verifyWorkspaceIsolation('/var/www/hrms'), false);
  assert.strictEqual(verifyWorkspaceIsolation('/tmp/arbitrary-workspace'), false);
});

await runTest('1.2 runMixedResidueRecovery rejects invalid workspace in dry-run mode before connecting', async () => {
  const res = await runMixedResidueRecovery({
    workspaceDir: '/var/www/businz' // Production workspace
  });
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.reason, 'Workspace mismatch');
  assert.strictEqual(res.dryRun, true);
});

await runTest('1.3 runMixedResidueRecovery fails closed on forbidden database URLs', async () => {
  const prodDbRes = await runMixedResidueRecovery({
    workspaceDir: EXPECTED_OPTIMIZATION_TEST_WORKSPACE,
    databaseUrl: 'postgresql://businz_test_user:pass@127.0.0.1:5432/businz' // Production DB
  });
  assert.strictEqual(prodDbRes.success, false);
  assert(prodDbRes.reason.includes('FORBIDDEN DATABASE TARGET "businz"'));

  const nonLocalRes = await runMixedResidueRecovery({
    workspaceDir: EXPECTED_OPTIMIZATION_TEST_WORKSPACE,
    databaseUrl: 'postgresql://businz_test_user:pass@192.168.1.100:5432/businz_optimization_test' // Non-local IP
  });
  assert.strictEqual(nonLocalRes.success, false);
  assert(nonLocalRes.reason.includes('Unverified database host'));
});

// =============================================================================
// TEST GROUP 2: Backup Integrity Verification
// =============================================================================
console.log('\n--- TEST GROUP 2: Backup Integrity Verification ---');

const tmpDir = path.resolve(__dirname, '../.tmp_test_backup');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const fakeDumpPath = path.join(tmpDir, 'test_backup.dump');
// Create a fake dump file with matching SHA-256 for unit test
// To match REQUIRED_BACKUP_SHA256, we can either mock verifyRecoveryBackup or test the hash logic
await runTest('2.1 verifyRecoveryBackup detects missing backup file', () => {
  const res = verifyRecoveryBackup('/var/www/businz-optimization-test', '/non/existent/dump.file');
  assert.strictEqual(res.valid, false);
  assert(res.reason.includes('not found'));
});

await runTest('2.2 verifyRecoveryBackup detects empty file (0 bytes)', () => {
  const emptyDumpPath = path.join(tmpDir, 'empty.dump');
  fs.writeFileSync(emptyDumpPath, '');
  const res = verifyRecoveryBackup(tmpDir, emptyDumpPath);
  assert.strictEqual(res.valid, false);
  assert(res.reason.includes('empty'));
  fs.unlinkSync(emptyDumpPath);
});

await runTest('2.3 verifyRecoveryBackup detects corrupted or mismatched SHA-256 archive', () => {
  const corruptedDumpPath = path.join(tmpDir, 'corrupted.dump');
  fs.writeFileSync(corruptedDumpPath, 'CORRUPTED_POSTGRESQL_BACKUP_CONTENT');
  const res = verifyRecoveryBackup(tmpDir, corruptedDumpPath);
  assert.strictEqual(res.valid, false);
  assert(res.reason.includes('SHA-256 mismatch'));
  fs.unlinkSync(corruptedDumpPath);
});

await runTest('2.4 Live recovery (--execute-authorized) fails closed when backup verification fails', async () => {
  const liveRes = await runMixedResidueRecovery({
    executeAuthorized: true,
    workspaceDir: EXPECTED_OPTIMIZATION_TEST_WORKSPACE,
    backupPath: '/non/existent/backup.dump',
    databaseUrl: 'postgresql://businz_test_user:pass@127.0.0.1:5432/businz_optimization_test'
  });
  assert.strictEqual(liveRes.success, false);
  assert(liveRes.reason.includes('not found') || liveRes.reason.includes('Backup archive not found'));
  assert.strictEqual(liveRes.dryRun, false);
});

// =============================================================================
// TEST GROUP 3: Multi-Run Synthetic Ownership Verification
// =============================================================================
console.log('\n--- TEST GROUP 3: Multi-Run Synthetic Ownership Verification ---');

await runTest('3.1 Verifies Run 1 (1793247013909) and Run 2 (1793250904736) leads, rejects real leads', () => {
  // Run 1 Lead
  const lead1 = { id: 101, lead_number: 'VRM-LD-2026-01', company_name: 'SYNTH_P9Y_1793247013909 Solar Infra', notes: 'SYNTH_P9Y_1793247013909' };
  const res1 = verifySyntheticLeadOwnership(lead1);
  assert(res1 && res1.verified, 'Lead 1 must be verified');
  assert.strictEqual(res1.runId, '1793247013909');

  // Run 2 Lead
  const lead2 = { id: 102, lead_number: 'VRM-LD-2026-02', company_name: 'SYNTH_P9Y_1793250904736 Solar Infra', notes: 'SYNTH_P9Y_1793250904736' };
  const res2 = verifySyntheticLeadOwnership(lead2);
  assert(res2 && res2.verified, 'Lead 2 must be verified');
  assert.strictEqual(res2.runId, '1793250904736');

  // Unrelated real customer lead -> MUST BE REJECTED!
  const realLead = { id: 999, lead_number: 'LD-REAL-100', company_name: 'Tata Power Solar Systems', notes: 'Customer inquiry' };
  assert.strictEqual(verifySyntheticLeadOwnership(realLead), false, 'Real lead must never be verified as synthetic');
});

await runTest('3.2 Verifies synthetic BOM orders across both runs, rejects real BOM orders', () => {
  // Run 1 BOMs
  const b1 = { id: 1, bom_code: 'BOM-13909', customer_name: 'SYNTH_P9Y_1793247013909 Solar Infra', synthTag: 'SYNTH_P9Y_1793247013909' };
  const b2 = { id: 2, bom_code: 'BOM-C1-3909', customer_name: 'Client 1' };
  const resB1 = verifySyntheticBomOwnership(b1);
  const resB2 = verifySyntheticBomOwnership(b2);
  assert(resB1 && resB1.verified && resB1.runId === '1793247013909');
  assert(resB2 && resB2.verified && resB2.runId === '1793247013909');

  // Run 2 BOM
  const b3 = { id: 3, bom_code: 'BOM-4736', customer_name: 'SYNTH_P9Y_1793250904736 Solar Infra' };
  const resB3 = verifySyntheticBomOwnership(b3);
  assert(resB3 && resB3.verified && resB3.runId === '1793250904736');

  const b4 = { id: 4, bom_code: 'BOM-04736', customer_name: 'SYNTH_P9Y_1793250904736 Solar Infra' };
  const resB4 = verifySyntheticBomOwnership(b4);
  assert(resB4 && resB4.verified && resB4.runId === '1793250904736');

  // Real BOM order -> MUST BE REJECTED!
  const realBom = { id: 88, bom_code: 'BOM-2026-0044', customer_name: 'Adani Solar Infrastructure', synthTag: null };
  assert.strictEqual(verifySyntheticBomOwnership(realBom), false, 'Real BOM must never be verified');
});

await runTest('3.3 Verifies synthetic reservations from BOTH runs and strictly preserves unrelated reservations', () => {
  // Run 1 Reservation
  const r1 = { id: 'res_SYNTH_P9Y_1793247013909', qty: 10, synthTag: 'SYNTH_P9Y_1793247013909' };
  const checkR1 = verifySyntheticReservationOwnership(r1);
  assert(checkR1 && checkR1.verified, 'Run 1 reservation must be verified');
  assert.strictEqual(checkR1.runId, '1793247013909');

  // Run 2 Reservation
  const r2 = { id: 'res_SYNTH_P9Y_1793250904736', qty: 25, synthTag: 'SYNTH_P9Y_1793250904736' };
  const checkR2 = verifySyntheticReservationOwnership(r2);
  assert(checkR2 && checkR2.verified, 'Run 2 reservation must be verified');
  assert.strictEqual(checkR2.runId, '1793250904736');

  // Unrelated existing customer reservation -> MUST BE PRESERVED!
  const realRes = { id: 'res_REAL_ORDER_440', qty: 100, notes: 'Reserved for site installation' };
  assert.strictEqual(verifySyntheticReservationOwnership(realRes), false, 'Real reservation must never be verified');

  const randomRes = { id: 'res_STOCK_RESERVE_12', code: 'ALU-PROFILE-2414' };
  assert.strictEqual(verifySyntheticReservationOwnership(randomRes), false, 'Arbitrary reservation must never be verified');
});

await runTest('3.4 Verifies synthetic employees, quotes, PIs, invoices across runs and rejects real ones', () => {
  // Employees
  assert(verifySyntheticEmployeeOwnership({ employee_code: 'TA-TEST-909', email: 'synth_admin_1793247013909@example.com' }));
  assert(verifySyntheticEmployeeOwnership({ employee_code: 'TA-TEST-736', email: 'synth_admin_1793250904736@example.com' }));
  assert(!verifySyntheticEmployeeOwnership({ employee_code: 'EMP-001', email: 'director@businz.com' }));

  // Quotations
  assert(verifySyntheticQuotationOwnership({ quotationNo: 'QT-13909', customerName: 'SYNTH_P9Y_1793247013909 Solar' }));
  assert(verifySyntheticQuotationOwnership({ quotationNo: 'QT-4736', customerName: 'SYNTH_P9Y_1793250904736 Solar' }));
  assert(!verifySyntheticQuotationOwnership({ quotationNo: 'QT-2026-098', customerName: 'JSW Steel' }));

  // PIs
  assert(verifySyntheticPiOwnership({ piNo: 'PI-13909', customerName: 'SYNTH_P9Y_1793247013909' }));
  assert(verifySyntheticPiOwnership({ piNo: 'PI-4736', customerName: 'SYNTH_P9Y_1793250904736' }));
  assert(!verifySyntheticPiOwnership({ piNo: 'PI-70044', customerName: 'Hero Future Energies' }));

  // Invoices
  assert(verifySyntheticInvoiceOwnership({ invNo: 'INV-13909', customerName: 'SYNTH_P9Y_1793247013909' }));
  assert(verifySyntheticInvoiceOwnership({ invNo: 'INV-4736', customerName: 'SYNTH_P9Y_1793250904736' }));
  assert(!verifySyntheticInvoiceOwnership({ invNo: 'INV-2026-0033', customerName: 'L&T Construction' }));
});

// =============================================================================
// TEST GROUP 4: Mock Database Dry-Run & Live Execution Simulation
// =============================================================================
console.log('\n--- TEST GROUP 4: Mock Database Dry-Run & Live Execution Simulation ---');

function createMockPostgresClient(initialState = {}) {
  const state = {
    leads: [...(initialState.leads || [])],
    lead_notifications: [...(initialState.lead_notifications || [])],
    lead_notification_recipients: [...(initialState.lead_notification_recipients || [])],
    lead_status_history: [...(initialState.lead_status_history || [])],
    lead_assignment_history: [...(initialState.lead_assignment_history || [])],
    lead_activities: [...(initialState.lead_activities || [])],
    lead_followups: [...(initialState.lead_followups || [])],
    lead_inactivity_incidents: [...(initialState.lead_inactivity_incidents || [])],
    bom_orders: [...(initialState.bom_orders || [])],
    bom_items: [...(initialState.bom_items || [])],
    controlroom_store: { ...(initialState.controlroom_store || {}) }
  };

  const queryLog = [];

  const client = {
    state,
    queryLog,
    query: async (sql, params = []) => {
      queryLog.push({ sql, params });

      // to_regclass
      if (sql.includes('to_regclass')) {
        return { rows: [{ reg: 'public.present' }] };
      }

      // SELECT key FROM controlroom_store
      if (sql.includes('SELECT key FROM public.controlroom_store')) {
        const keys = Object.keys(state.controlroom_store).sort();
        return { rows: keys.map(k => ({ key: k })) };
      }

      // SELECT data FROM controlroom_store
      if (sql.includes('SELECT data FROM public.controlroom_store')) {
        const keyMatch = params[0] || sql.match(/WHERE key = '([^']+)'/)?.[1];
        if (keyMatch && state.controlroom_store[keyMatch] !== undefined) {
          return { rows: [{ data: state.controlroom_store[keyMatch] }] };
        }
        return { rows: [] };
      }

      // UPDATE controlroom_store
      if (sql.includes('UPDATE public.controlroom_store SET data = $1::jsonb')) {
        const data = JSON.parse(params[0]);
        const keyMatch = params[1] || sql.match(/WHERE key = '([^']+)'/)?.[1];
        if (keyMatch) {
          state.controlroom_store[keyMatch] = data;
        }
        return { rowCount: 1 };
      }

      // DELETE FROM controlroom_store WHERE key = $1
      if (sql.includes('DELETE FROM public.controlroom_store WHERE key = $1')) {
        const key = params[0];
        delete state.controlroom_store[key];
        return { rowCount: 1 };
      }

      // DELETE FROM leads
      if (sql.includes('DELETE FROM public.leads')) {
        const id = params[0];
        state.leads = state.leads.filter(x => String(x.id) !== String(id));
        return { rowCount: 1 };
      }

      // SELECT leads
      if (sql.includes('SELECT') && sql.includes('FROM public.leads')) {
        if (sql.includes('WHERE id = $1')) {
          const l = state.leads.find(x => String(x.id) === String(params[0]));
          return { rows: l ? [l] : [] };
        }
        if (sql.includes('count(*)::int')) {
          const count = state.leads.filter(x => x.company_name?.includes('SYNTH_P9Y_')).length;
          return { rows: [{ count }] };
        }
        return { rows: [...state.leads] };
      }

      // DELETE FROM bom_orders
      if (sql.includes('DELETE FROM public.bom_orders')) {
        const id = params[0];
        state.bom_orders = state.bom_orders.filter(x => String(x.id) !== String(id));
        return { rowCount: 1 };
      }

      // SELECT bom_orders
      if (sql.includes('SELECT') && sql.includes('FROM public.bom_orders')) {
        if (sql.includes('WHERE id = $1')) {
          const b = state.bom_orders.find(x => String(x.id) === String(params[0]));
          return { rows: b ? [b] : [] };
        }
        if (sql.includes('count(*)::int')) {
          const count = state.bom_orders.filter(x =>
            x.customer_name?.includes('SYNTH_P9Y_') ||
            x.bom_code?.includes('13909') ||
            x.bom_code?.includes('3909') ||
            x.bom_code?.includes('4736')
          ).length;
          return { rows: [{ count }] };
        }
        return { rows: [...state.bom_orders] };
      }

      // Child records
      if (sql.includes('lead_notifications')) {
        if (sql.includes('count(*)::int')) return { rows: [{ count: 0 }] };
        return { rows: [...state.lead_notifications] };
      }
      if (sql.includes('lead_notification_recipients')) {
        return { rows: [{ count: state.lead_notification_recipients.length }] };
      }
      if (sql.includes('lead_status_history')) {
        return { rows: [{ count: state.lead_status_history.length }] };
      }

      // Transactions
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rows: [] };
      }

      return { rows: [] };
    },
    release: () => {}
  };

  return client;
}

const mockInitialState = {
  leads: [
    { id: 10, lead_number: 'VRM-LD-2026-02', company_name: 'SYNTH_P9Y_1793250904736 Solar Infra', notes: 'SYNTH_P9Y_1793250904736 Lead Qualified by Sales Rep' }
  ],
  lead_notifications: [{ id: 50, lead_id: 10 }],
  lead_notification_recipients: Array(9).fill(null).map((_, i) => ({ id: i + 1, notification_id: 50 })),
  lead_status_history: [{ id: 1, lead_id: 10 }],
  bom_orders: [
    { id: 1, bom_code: 'BOM-4736', customer_name: 'SYNTH_P9Y_1793250904736 Solar Infra' },
    { id: 2, bom_code: 'BOM-C1-4736', customer_name: 'SYNTH_P9Y_1793250904736 Client 1' },
    { id: 3, bom_code: 'BOM-C2-4736', customer_name: 'SYNTH_P9Y_1793250904736 Client 2' },
    { id: 4, bom_code: 'BOM-C3-4736', customer_name: 'SYNTH_P9Y_1793250904736 Client 3' }
  ],
  controlroom_store: {
    employees_store: [
      { employee_code: 'TA-TEST-736', email: 'synth_admin_1793250904736@example.com' },
      { employee_code: 'SE-PEND-736', email: 'synth_pend_1793250904736@example.com' },
      { employee_code: 'SE-ACT-736', email: 'synth_act_1793250904736@example.com' }
    ],
    quotations_store: [
      { quotationNo: 'QT-4736', customerName: 'SYNTH_P9Y_1793250904736 Solar Infra' }
    ],
    customer_pis_store: [
      { piNo: 'PI-4736', customerName: 'SYNTH_P9Y_1793250904736 Solar Infra' }
    ],
    bom_store: [
      { bomCode: 'BOM-4736', synthTag: 'SYNTH_P9Y_1793250904736' },
      { bomCode: 'BOM-C1-4736', synthTag: 'SYNTH_P9Y_1793250904736' },
      { bomCode: 'BOM-C2-4736', synthTag: 'SYNTH_P9Y_1793250904736' },
      { bomCode: 'BOM-C3-4736', synthTag: 'SYNTH_P9Y_1793250904736' }
    ],
    invoice_store: [
      { invNo: 'INV-4736', synthTag: 'SYNTH_P9Y_1793250904736' }
    ],
    reservations_store: [
      { id: 'res_SYNTH_P9Y_1793247013909', synthTag: 'SYNTH_P9Y_1793247013909' },
      { id: 'res_SYNTH_P9Y_1793250904736', synthTag: 'SYNTH_P9Y_1793250904736' }
    ]
  }
};

await runTest('4.1 Dry run audits exact observed counts without performing any writes', async () => {
  const mockClient = createMockPostgresClient(mockInitialState);

  const res = await runMixedResidueRecovery({
    workspaceDir: EXPECTED_OPTIMIZATION_TEST_WORKSPACE,
    client: mockClient,
    databaseUrl: 'postgresql://businz_test_user:pass@127.0.0.1:5432/businz_optimization_test'
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.dryRun, true);

  // Assert overall audited counts
  assert.strictEqual(res.auditReport.leadsFound.length, 1);
  assert.strictEqual(res.auditReport.bomsFound.length, 4);
  assert.strictEqual(res.auditReport.employeesFound.length, 3);
  assert.strictEqual(res.auditReport.quotationsFound.length, 1);
  assert.strictEqual(res.auditReport.pisFound.length, 1);
  assert.strictEqual(res.auditReport.invoicesFound.length, 1);
  assert.strictEqual(res.auditReport.bomStoreItemsFound.length, 4);
  assert.strictEqual(res.auditReport.reservationsFound.length, 2); // 1 from each run!

  // Assert counts and IDs attributed to Run 1 (1793247013909)
  // Run 1 business records were already cleaned up; only resurrected reservation remains!
  assert.strictEqual(res.auditReport.byRun['1793247013909'].leads.length, 0);
  assert.strictEqual(res.auditReport.byRun['1793247013909'].boms.length, 0);
  assert.strictEqual(res.auditReport.byRun['1793247013909'].employees.length, 0);
  assert.strictEqual(res.auditReport.byRun['1793247013909'].quotations.length, 0);
  assert.strictEqual(res.auditReport.byRun['1793247013909'].pis.length, 0);
  assert.strictEqual(res.auditReport.byRun['1793247013909'].invoices.length, 0);
  assert.strictEqual(res.auditReport.byRun['1793247013909'].bomStore.length, 0);
  assert.strictEqual(res.auditReport.byRun['1793247013909'].reservations.length, 1);
  assert.deepStrictEqual(res.auditReport.byRun['1793247013909'].reservations, ['res_SYNTH_P9Y_1793247013909']);
  assert.strictEqual(res.auditReport.byRun['1793247013909'].childRecords.statusHistory, 0);
  assert.strictEqual(res.auditReport.byRun['1793247013909'].childRecords.notifications, 0);
  assert.strictEqual(res.auditReport.byRun['1793247013909'].childRecords.recipients, 0);

  // Assert counts and IDs attributed to Run 2 (1793250904736)
  // All active business residue in DB belongs to Run 2
  assert.strictEqual(res.auditReport.byRun['1793250904736'].leads.length, 1);
  assert.deepStrictEqual(res.auditReport.byRun['1793250904736'].leads, ['VRM-LD-2026-02']);
  assert.strictEqual(res.auditReport.byRun['1793250904736'].boms.length, 4);
  assert.deepStrictEqual(res.auditReport.byRun['1793250904736'].boms, ['BOM-4736', 'BOM-C1-4736', 'BOM-C2-4736', 'BOM-C3-4736']);
  assert.strictEqual(res.auditReport.byRun['1793250904736'].employees.length, 3);
  assert.deepStrictEqual(res.auditReport.byRun['1793250904736'].employees, ['TA-TEST-736', 'SE-PEND-736', 'SE-ACT-736']);
  assert.strictEqual(res.auditReport.byRun['1793250904736'].quotations.length, 1);
  assert.deepStrictEqual(res.auditReport.byRun['1793250904736'].quotations, ['QT-4736']);
  assert.strictEqual(res.auditReport.byRun['1793250904736'].pis.length, 1);
  assert.deepStrictEqual(res.auditReport.byRun['1793250904736'].pis, ['PI-4736']);
  assert.strictEqual(res.auditReport.byRun['1793250904736'].invoices.length, 1);
  assert.deepStrictEqual(res.auditReport.byRun['1793250904736'].invoices, ['INV-4736']);
  assert.strictEqual(res.auditReport.byRun['1793250904736'].bomStore.length, 4);
  assert.deepStrictEqual(res.auditReport.byRun['1793250904736'].bomStore, ['BOM-4736', 'BOM-C1-4736', 'BOM-C2-4736', 'BOM-C3-4736']);
  assert.strictEqual(res.auditReport.byRun['1793250904736'].reservations.length, 1);
  assert.deepStrictEqual(res.auditReport.byRun['1793250904736'].reservations, ['res_SYNTH_P9Y_1793250904736']);
  assert.strictEqual(res.auditReport.byRun['1793250904736'].childRecords.statusHistory, 1);
  assert.strictEqual(res.auditReport.byRun['1793250904736'].childRecords.notifications, 1);
  assert.strictEqual(res.auditReport.byRun['1793250904736'].childRecords.recipients, 9);

  // Assert ZERO writes occurred
  assert(!mockClient.queryLog.some(q => q.sql === 'BEGIN'), 'Dry-run must not call BEGIN');
  assert(!mockClient.queryLog.some(q => q.sql.includes('DELETE')), 'Dry-run must not call DELETE');
  assert(!mockClient.queryLog.some(q => q.sql.includes('UPDATE')), 'Dry-run must not call UPDATE');
});

await runTest('4.2 Live execution fails closed when backup SHA-256 does not match', async () => {
  const mockClient = createMockPostgresClient(mockInitialState);
  const mockBackupPath = path.join(tmpDir, 'corrupted_test.dump');
  fs.writeFileSync(mockBackupPath, 'DUMMY_DUMP_CONTENT');

  const res = await runMixedResidueRecovery({
    executeAuthorized: true,
    workspaceDir: EXPECTED_OPTIMIZATION_TEST_WORKSPACE,
    client: mockClient,
    databaseUrl: 'postgresql://businz_test_user:pass@127.0.0.1:5432/businz_optimization_test',
    backupPath: mockBackupPath
  });

  assert.strictEqual(res.success, false, 'Must fail closed on SHA mismatch');
  assert(res.reason.includes('SHA-256 mismatch'));
  fs.unlinkSync(mockBackupPath);
});

await runTest('4.3 Live execution simulation under transaction removes synthetic residue and restores baseline', async () => {
  const mockClient = createMockPostgresClient(mockInitialState);

  const res = await runMixedResidueRecovery({
    executeAuthorized: true,
    workspaceDir: EXPECTED_OPTIMIZATION_TEST_WORKSPACE,
    client: mockClient,
    databaseUrl: 'postgresql://businz_test_user:pass@127.0.0.1:5432/businz_optimization_test',
    bypassBackupCheckForTesting: true
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.dryRun, false);
  assert.strictEqual(res.auditReport.executed, true);
  assert.strictEqual(res.auditReport.committed, true);

  // Assert transaction called BEGIN and COMMIT
  assert(mockClient.queryLog.some(q => q.sql === 'BEGIN'), 'Must execute BEGIN');
  assert(mockClient.queryLog.some(q => q.sql === 'COMMIT'), 'Must execute COMMIT');
  assert(!mockClient.queryLog.some(q => q.sql === 'ROLLBACK'), 'Must not execute ROLLBACK');

  // Assert state changes:
  // 1. Leads deleted
  assert.strictEqual(mockClient.state.leads.length, 0, 'Synthetic leads must be deleted');
  // 2. BOM orders deleted
  assert.strictEqual(mockClient.state.bom_orders.length, 0, 'Synthetic BOM orders must be deleted');
  // 3. Baseline store keys preserved as empty arrays
  assert.deepStrictEqual(mockClient.state.controlroom_store.employees_store, [], 'employees_store must be empty array');
  assert.deepStrictEqual(mockClient.state.controlroom_store.quotations_store, [], 'quotations_store must be empty array');
  assert.deepStrictEqual(mockClient.state.controlroom_store.customer_pis_store, [], 'customer_pis_store must be empty array');
  // 4. Newly created store keys dropped
  assert.strictEqual(mockClient.state.controlroom_store.bom_store, undefined, 'bom_store must be dropped');
  assert.strictEqual(mockClient.state.controlroom_store.invoice_store, undefined, 'invoice_store must be dropped');
  assert.strictEqual(mockClient.state.controlroom_store.reservations_store, undefined, 'reservations_store must be dropped');
  // 5. Exactly 3 store keys remaining
  const remainingKeys = Object.keys(mockClient.state.controlroom_store).sort();
  assert.deepStrictEqual(remainingKeys, ['customer_pis_store', 'employees_store', 'quotations_store']);
});

await runTest('4.4 Live execution rolls back when store contains an unrelated reservation', async () => {
  const mixedState = {
    ...mockInitialState,
    controlroom_store: {
      ...mockInitialState.controlroom_store,
      reservations_store: [
        { id: 'res_SYNTH_P9Y_1793247013909', synthTag: 'SYNTH_P9Y_1793247013909' },
        { id: 'res_CUSTOMER_ORDER_100', notes: 'real reservation' } // Unrelated record!
      ]
    }
  };

  const mockClient = createMockPostgresClient(mixedState);

  const res = await runMixedResidueRecovery({
    executeAuthorized: true,
    workspaceDir: EXPECTED_OPTIMIZATION_TEST_WORKSPACE,
    client: mockClient,
    databaseUrl: 'postgresql://businz_test_user:pass@127.0.0.1:5432/businz_optimization_test',
    bypassBackupCheckForTesting: true
  });

  assert.strictEqual(res.success, false);
  assert(res.error.includes('contains non-synthetic or unverified items'));
  assert(mockClient.queryLog.some(q => q.sql === 'ROLLBACK'), 'Must execute ROLLBACK on error');
});

await runTest('4.5 Script contains zero SQL TRUNCATE or DROP TABLE statements', () => {
  const scriptContent = fs.readFileSync(path.resolve(__dirname, 'recover_phase9ab_mixed_residue.js'), 'utf8');
  const codeWithoutComments = scriptContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  assert(!/\bTRUNCATE\b/i.test(codeWithoutComments), 'Script must not contain SQL TRUNCATE');
  assert(!/\bDROP\s+TABLE\b/i.test(codeWithoutComments), 'Script must not contain DROP TABLE');
  assert(!/\bDROP\s+DATABASE\b/i.test(codeWithoutComments), 'Script must not contain DROP DATABASE');
  assert(!/\bDROP\s+SCHEMA\b/i.test(codeWithoutComments), 'Script must not contain DROP SCHEMA');
});

// Cleanup temp dir
if (fs.existsSync(tmpDir)) {
  fs.rmdirSync(tmpDir, { recursive: true });
}

// =============================================================================
// SUMMARY
// =============================================================================
console.log('\n===================================================================');
console.log(`📊 MIXED RESIDUE RECOVERY TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${passedTests + failedTests})`);
console.log('===================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🛡️  PHASE 9AB MIXED RESIDUE RECOVERY: 100% VERIFIED & SAFE\n');
  process.exit(0);
}
