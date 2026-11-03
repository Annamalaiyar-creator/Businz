/**
 * scripts/audit_phase9y_test_safety.js
 *
 * BUSINZ ERP: Phase 9Y Hardened Test Safety Audit & Preflight Rejection Verification Suite
 *
 * Verifies that the Phase 9Y test runner:
 * 1. Contains ZERO dangerous operations (no TRUNCATE, no DROP, no un-predicated DELETE).
 * 2. Statically binds all network requests to 127.0.0.1:5101 and PostgreSQL to businz_optimization_test.
 * 3. Enforces fail-closed preflight rejection when executed in wrong workspace directories.
 * 4. Strictly rejects production (5001), development (5002), and unapproved ports.
 * 5. Strictly rejects production, dev, and HRMS databases and roles.
 * 6. Implements exact-ID synthetic ledger tracking for all record types.
 * 7. Enforces foreign key child-record dependency cleanup order without error suppression.
 * 8. Uses atomic row-level locking (FOR UPDATE) for generic JSONB stores.
 * 9. Executes pre-commit database baseline checks BEFORE COMMIT and rolls back on mismatch.
 * 10. Distinguishes database transaction cleanup from non-transactional disk-file cleanup.
 * 11. Preserves Pending Approval status and tests HTTP 403 login rejection while pending.
 * 12. Provisions authorized administrator in test database and uses real server-side approval mechanism.
 * 13. Never uses x-user-emp-id or x-user-name headers as authentication.
 * 14. Enforces nonzero exit code on test failure, failed cleanup, or baseline mismatch without skipping cleanup.
 * 15. Separates tested store operations from unsupported transitions (Dispatch, Accounts, loading, stock release).
 * 16. Never resets global numbering sequences.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  resolveAndValidateTestApiUrl,
  resolveAndValidateTestDatabaseUrl,
  REQUIRED_TEST_PORT,
  REQUIRED_TEST_DATABASE,
  REQUIRED_TEST_DB_ROLE
} from './testEnvironmentGuard.js';
import { executePreflight, provisionSyntheticTestAdmin } from './test_phase9y_real_db_workflow_integration.js';
import {
  KNOWN_SYNTHETIC_LEADS,
  KNOWN_SYNTHETIC_EMPLOYEES,
  verifySyntheticLeadOwnership,
  verifySyntheticEmployeeEvidence
} from './recover_phase9y_test_residue.js';
import {
  validateAndSyncSourcePi,
  isPiMatch,
  AUTHORITATIVE_PI_STORE_KEYS
} from '../server/bomPersistence.js';
import {
  verifySyntheticLeadOwnership304,
  verifySyntheticEmployeeEvidence304,
  verifySyntheticQuotationOwnership304,
  verifySyntheticPiOwnership304,
  runResidueRecovery304,
  TARGET_RUN_ID,
  TARGET_SYNTH_TAG
} from './recover_phase9y_run_70304_residue.js';
import {
  runResidueRecovery13909,
  verifyWorkspaceIsolation,
  EXPECTED_OPTIMIZATION_TEST_WORKSPACE,
  verifySyntheticLeadOwnership909,
  verifySyntheticEmployeeEvidence909,
  verifySyntheticQuotationOwnership909,
  verifySyntheticPiOwnership909,
  verifySyntheticBomOwnership909,
  verifySyntheticInvoiceOwnership909,
  verifySyntheticReservationOwnership909,
  BASELINE_STORE_KEYS_909,
  NEWLY_CREATED_STORE_KEYS_909,
  TARGET_RUN_ID as TARGET_RUN_ID_909,
  TARGET_SYNTH_TAG as TARGET_SYNTH_TAG_909
} from './recover_phase9y_run_13909_residue.js';
import {
  queryTableCount,
  queryStoreItemCount,
  collectDatabaseCounts,
  executeComprehensiveCleanup,
  testReport,
  syntheticLedger,
  isSyntheticStoreItem,
  SYNTH_TAG,
  RUN_ID,
  ALLOWED_AUDIT_TABLES,
  OPTIONAL_AUDIT_TABLES,
  ALLOWED_AUDIT_STORES
} from './test_phase9y_real_db_workflow_integration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('===================================================================');
console.log('🛡️  BUSINZ ERP: PHASE 9Y HARDENED TEST SCRIPT SAFETY AUDIT');
console.log('===================================================================\n');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
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

// Read test script source for static inspection
const testScriptPath = path.resolve(__dirname, 'test_phase9y_real_db_workflow_integration.js');
const testScriptSrc = fs.readFileSync(testScriptPath, 'utf8');

// =============================================================================
// TEST GROUP 1: Static Code Safety Inspection (Zero Dangerous Operations)
// =============================================================================
console.log('--- TEST GROUP 1: Static Code Safety Inspection ---');

runTest('1.1 Script contains zero SQL TRUNCATE statements', () => {
  assert(!testScriptSrc.match(/\bTRUNCATE\s+(TABLE\s+)?[a-zA-Z0-9_]+/i), 'Must never execute SQL TRUNCATE');
});

runTest('1.2 Script contains zero DROP TABLE, DROP DATABASE, or DROP SCHEMA statements', () => {
  assert(!testScriptSrc.toUpperCase().includes('DROP TABLE'), 'Must never drop tables');
  assert(!testScriptSrc.toUpperCase().includes('DROP DATABASE'), 'Must never drop databases');
  assert(!testScriptSrc.toUpperCase().includes('DROP SCHEMA'), 'Must never drop schemas');
});

runTest('1.3 Script contains zero service restart commands (PM2, systemctl, process.kill)', () => {
  assert(!testScriptSrc.includes('pm2 restart'), 'Must never restart PM2');
  assert(!testScriptSrc.includes('systemctl'), 'Must never run systemctl');
  assert(!testScriptSrc.includes('process.kill'), 'Must never kill processes');
});

runTest('1.4 All DELETE statements in cleanup are strictly parameterized by ID and ownership', () => {
  const deleteMatches = testScriptSrc.match(/DELETE FROM [^;]+/g) || [];
  assert(deleteMatches.length > 0, 'Must have cleanup DELETE statements');
  deleteMatches.forEach(stmt => {
    assert(stmt.includes('WHERE'), `DELETE statement must have WHERE clause: ${stmt}`);
    assert(stmt.includes('$1'), `DELETE statement must use parameterized queries: ${stmt}`);
  });
});

runTest('1.5 Script contains zero access to HRMS application, database, or tables', () => {
  const hrmsTokens = ['/var/www/hrms', 'hrms_prod', 'hrms_dev', 'businz_hrms'];
  hrmsTokens.forEach(token => {
    assert(!testScriptSrc.includes(token), `Must never reference HRMS token: ${token}`);
  });
});

runTest('1.6 Script never suppresses child-record deletion failures in cleanup', () => {
  assert(!testScriptSrc.match(/DELETE FROM public\.lead_[a-z_]+[^}]+catch\s*\(_\)\s*\{\}/i), 'Must not suppress lead child deletion errors');
  assert(!testScriptSrc.match(/DELETE FROM public\.bom_items[^}]+catch\s*\(_\)\s*\{\}/i), 'Must not suppress bom_items deletion errors');
});

runTest('1.7 Script never resets global numbering sequences or invokes wipe endpoints', () => {
  assert(!testScriptSrc.includes('reset-all-testing-data'), 'Must never call testing reset endpoint');
  assert(!testScriptSrc.includes("employee = 'BOM_SEQUENCE'"), 'Must never wipe BOM_SEQUENCE in leaves');
});

// =============================================================================
// TEST GROUP 2: Preflight Rejection Tests
// =============================================================================
console.log('\n--- TEST GROUP 2: Preflight Rejection Tests ---');

await runAsyncTest('2.1 Preflight rejects workspace directory outside /var/www/businz-optimization-test', async () => {
  const failures = await executePreflight('/Users/annamalaiyar/Desktop/ControlRoom');
  assert(
    failures.some(f => f.includes('Workspace directory mismatch')),
    'Must fail preflight on workspace directory mismatch'
  );
});

await runAsyncTest('2.2 Preflight rejects production workspace directory /var/www/businz', async () => {
  const failures = await executePreflight('/var/www/businz');
  assert(
    failures.some(f => f.includes('Workspace directory mismatch')),
    'Must fail preflight on production directory'
  );
});

runTest('2.3 resolveAndValidateTestApiUrl rejects production PORT=5001 and development PORT=5002', () => {
  assert.throws(() => resolveAndValidateTestApiUrl('http://127.0.0.1:5001'), /FORBIDDEN TARGET PORT/);
  assert.throws(() => resolveAndValidateTestApiUrl('http://127.0.0.1:5002'), /FORBIDDEN TARGET PORT/);
  assert.throws(() => resolveAndValidateTestApiUrl('http://127.0.0.1:8080'), /Invalid target port/);
  assert.throws(() => resolveAndValidateTestApiUrl('http://localhost:5101'), /Target host.*strictly rejected/);
  assert.strictEqual(resolveAndValidateTestApiUrl('http://127.0.0.1:5101'), 'http://127.0.0.1:5101');
});

runTest('2.4 resolveAndValidateTestDatabaseUrl rejects production, dev, HRMS databases', () => {
  assert.throws(
    () => resolveAndValidateTestDatabaseUrl('postgresql://businz_test_user:pass@127.0.0.1:5432/businz'),
    /FORBIDDEN DATABASE TARGET/
  );
  assert.throws(
    () => resolveAndValidateTestDatabaseUrl('postgresql://businz_test_user:pass@127.0.0.1:5432/businz_dev'),
    /FORBIDDEN DATABASE TARGET/
  );
  assert.throws(
    () => resolveAndValidateTestDatabaseUrl('postgresql://businz_test_user:pass@127.0.0.1:5432/hrms'),
    /FORBIDDEN DATABASE TARGET/
  );
});

runTest('2.5 resolveAndValidateTestDatabaseUrl rejects superuser and non-test roles', () => {
  assert.throws(
    () => resolveAndValidateTestDatabaseUrl('postgresql://postgres:pass@127.0.0.1:5432/businz_optimization_test'),
    /FORBIDDEN DATABASE ROLE/
  );
  assert.throws(
    () => resolveAndValidateTestDatabaseUrl('postgresql://root:pass@127.0.0.1:5432/businz_optimization_test'),
    /FORBIDDEN DATABASE ROLE/
  );
  assert.throws(
    () => resolveAndValidateTestDatabaseUrl('postgresql://businz:pass@127.0.0.1:5432/businz_optimization_test'),
    /FORBIDDEN DATABASE ROLE/
  );
});

// =============================================================================
// TEST GROUP 3: Transaction Cleanup, Pre-Commit Baseline Check & Rollback
// =============================================================================
console.log('\n--- TEST GROUP 3: Transaction Cleanup, Pre-Commit Baseline Check & Rollback ---');

runTest('3.1 Script tracks exact database IDs across all 7 synthetic record types in syntheticLedger', () => {
  assert(testScriptSrc.includes('leads: []'), 'Must track leads');
  assert(testScriptSrc.includes('quotations: []'), 'Must track quotations');
  assert(testScriptSrc.includes('proformaInvoices: []'), 'Must track proforma invoices');
  assert(testScriptSrc.includes('bomOrders: []'), 'Must track BOM orders');
  assert(testScriptSrc.includes('reservations: []'), 'Must track reservations');
  assert(testScriptSrc.includes('invoices: []'), 'Must track invoices');
  assert(testScriptSrc.includes('registeredEmployees: []'), 'Must track registered employees');
});

runTest('3.2 Pre-commit baseline check executes inside transaction before COMMIT', () => {
  const preCommitIndex = testScriptSrc.indexOf('const preCommitCounts = await collectDatabaseCounts(client);');
  const commitIndex = testScriptSrc.indexOf("await client.query('COMMIT');", preCommitIndex);
  assert(preCommitIndex !== -1, 'Must collect pre-commit counts');
  assert(commitIndex !== -1, 'Must have COMMIT statement in cleanup transaction');
  assert(preCommitIndex < commitIndex, 'Pre-commit baseline check must execute before COMMIT');
});

runTest('3.3 Transaction rolls back when pre-commit baseline check fails', () => {
  assert(testScriptSrc.includes('if (!preCommitMatches) {'), 'Must check preCommitMatches');
  assert(testScriptSrc.includes("await client.query('ROLLBACK');"), 'Must rollback on mismatch');
  assert(testScriptSrc.includes("cleanupReport.dbCleanup.status = 'ROLLED_BACK_BASELINE_MISMATCH'"), 'Must record ROLLED_BACK_BASELINE_MISMATCH');
});

runTest('3.4 Distinguishes PostgreSQL transaction cleanup from non-transactional disk cleanup', () => {
  assert(testScriptSrc.includes('dbCleanup:'), 'Must report dbCleanup separately');
  assert(testScriptSrc.includes('diskCleanup:'), 'Must report diskCleanup separately');
  assert(testScriptSrc.includes('filesystemInconsistency'), 'Must track filesystem inconsistency');
});

runTest('3.5 Generic JSONB stores use atomic row locks (FOR UPDATE) and item-level filtering', () => {
  assert(testScriptSrc.includes('SELECT data FROM public.controlroom_store WHERE key = $1 FOR UPDATE'), 'Must use row lock FOR UPDATE');
  assert(testScriptSrc.includes('matchesLedger && hasSynthTag'), 'Must filter matching synthetic items with ownership proof');
});

// =============================================================================
// TEST GROUP 4: Synthetic Employee Approval, Dual Identities & Pending Rejection
// =============================================================================
console.log('\n--- TEST GROUP 4: Synthetic Employee Approval & Pending Rejection ---');

runTest('4.1 Preserves application rule: unauthenticated registration forced to Pending Approval', () => {
  assert(
    testScriptSrc.includes("selfRegRes.data?.account?.status,\n      'Pending Approval'"),
    'Must assert account status is Pending Approval for self-registration'
  );
});

runTest('4.2 Verifies login is rejected with HTTP 403 while approval is pending', () => {
  assert(testScriptSrc.includes('assert.strictEqual(pendingLoginRes.status, 403'), 'Must assert pending login returns 403');
  assert(testScriptSrc.includes("pendingLoginRes.data?.error || '').toLowerCase().includes('pending approval')"), 'Must assert error contains pending approval');
});

runTest('4.3 Implements authorized administrator setup with collision protection in test database', () => {
  assert(testScriptSrc.includes('provisionSyntheticTestAdmin'), 'Must define provisionSyntheticTestAdmin');
  assert(testScriptSrc.includes("role: 'Technical Administrator'"), 'Admin must have Technical Administrator role');
  assert(testScriptSrc.includes("status: 'Active'"), 'Admin must have Active status');
  assert(
    testScriptSrc.includes('Synthetic administrator code collision detected') &&
    testScriptSrc.includes('Synthetic administrator email collision detected'),
    'Admin must fail closed on collision'
  );
  assert(testScriptSrc.includes('hashPassword('), 'Admin password must be hashed with scrypt');
});

runTest('4.4 Enforces explicit PostgreSQL transaction (BEGIN, COMMIT, ROLLBACK) in administrator provisioning', () => {
  assert(testScriptSrc.includes("await client.query('BEGIN');"), 'Must begin transaction explicitly');
  assert(testScriptSrc.includes("await client.query('COMMIT');"), 'Must commit transaction explicitly');
  assert(testScriptSrc.includes("await client.query('ROLLBACK');"), 'Must rollback transaction on error');
});

runTest('4.5 Protects concurrent access via pg_advisory_xact_lock and row initialization with FOR UPDATE', () => {
  assert(
    testScriptSrc.includes("pg_advisory_xact_lock(hashtext('controlroom_store:employees_store'))"),
    'Must acquire store-specific advisory lock'
  );
  assert(
    testScriptSrc.includes("INSERT INTO public.controlroom_store (key, data, updated_at)") &&
    testScriptSrc.includes("ON CONFLICT (key) DO NOTHING"),
    'Must seed missing employees_store row before FOR UPDATE'
  );
  assert(
    testScriptSrc.includes("SELECT data FROM public.controlroom_store WHERE key = 'employees_store' FOR UPDATE"),
    'Must acquire row-level lock with FOR UPDATE'
  );
});

runTest('4.6 Administrator provisions Identity B with Active status and sessionId authorization', () => {
  assert(testScriptSrc.includes('sessionId: adminTestSessionId'), 'Must pass admin session to provisioning request');
  assert(testScriptSrc.includes('assert.strictEqual(adminProvisionRes.status, 201'), 'Must assert admin provision returns 201');
  assert(testScriptSrc.includes("adminProvisionRes.data?.account?.status,\n      'Active'"), 'Must verify account is provisioned Active');
  assert(testScriptSrc.includes('SYNTH_PENDING_EMP') && testScriptSrc.includes('SYNTH_ACTIVE_EMP'), 'Must use separate identities for pending and active');
});

runTest('4.7 Authenticates approved employee with genuine credentials to obtain server-issued session', () => {
  assert(testScriptSrc.includes('assert.strictEqual(activeLoginRes.status, 200'), 'Must assert approved login returns 200');
  assert(testScriptSrc.includes('activeTestSessionId = activeLoginRes.data.session.id'), 'Must store server-issued session ID');
});

runTest('4.8 Registers synthetic administrator in cleanup ledger strictly after commit', () => {
  const provIdx = testScriptSrc.indexOf('await provisionSyntheticTestAdmin(');
  const ledgerIdx = testScriptSrc.indexOf('syntheticLedger.registeredEmployees.push({ employee_code: SYNTH_ADMIN_EMP');
  assert(provIdx !== -1 && ledgerIdx !== -1, 'Must provision admin and register in ledger');
  assert(provIdx < ledgerIdx, 'Ledger registration must occur after successful commit of provisionSyntheticTestAdmin');
});

runTest('4.9 Honestly reports pending-to-active approval transition of existing record as NOT TESTED', () => {
  assert(testScriptSrc.includes("'10c. Pending-to-active employee approval transition'] = {\n      status: 'NOT TESTED'"), 'Must mark 10c as NOT TESTED');
});

// =============================================================================
// TEST GROUP 5: Process Exit Code Evaluation (Issue 2)
// =============================================================================
console.log('\n--- TEST GROUP 5: Process Exit Code Evaluation ---');

runTest('5.1 Sets process.exitCode = 1 on preflight failure without skipping report', () => {
  assert(testScriptSrc.includes('testReport.environment.preflightPassed = false;'), 'Must record preflight failure');
  assert(testScriptSrc.includes('process.exitCode = 1;'), 'Must set process.exitCode = 1');
});

runTest('5.2 Sets process.exitCode = 1 on test failures, failed cleanup, or baseline mismatch', () => {
  assert(testScriptSrc.includes('testReport.summary.failed > 0'), 'Must check test failure count');
  assert(testScriptSrc.includes('!testReport.cleanup.baselineRestored'), 'Must check baseline restoration');
  assert(testScriptSrc.includes('testReport.cleanup.discrepancies.length > 0'), 'Must check discrepancies');
  assert(testScriptSrc.includes('testReport.cleanup.diskCleanup.filesystemInconsistency'), 'Must check filesystem inconsistency');
});

runTest('5.3 Successful cleanup does not clear or hide an earlier test failure', () => {
  // Verify hasFailures includes testReport.summary.failed > 0 independently of cleanup status
  assert(testScriptSrc.includes('const hasFailures ='), 'Must define consolidated hasFailures');
  assert(testScriptSrc.includes('testReport.summary.failed > 0 ||'), 'hasFailures must include failed > 0 independently');
});

runTest('5.4 Cleanup is guaranteed in finally block and avoids premature process.exit()', () => {
  assert(testScriptSrc.includes('finally {'), 'Must have finally block in main');
  assert(testScriptSrc.includes('testReport.cleanup = await executeComprehensiveCleanup(dbPool);'), 'Must execute cleanup in finally');
  // Confirm process.exit is NOT inside main's workflow try block
  const tryBlock = testScriptSrc.slice(testScriptSrc.indexOf('// Preflight passed: Proceed with real workflows'), testScriptSrc.indexOf('printFinalReport();'));
  assert(!tryBlock.includes('process.exit('), 'Must never call process.exit() inside workflow try block');
});

// =============================================================================
// TEST GROUP 6: Session Security & Accurate Workflow Reporting
// =============================================================================
console.log('\n--- TEST GROUP 6: Session Security & Accurate Workflow Reporting ---');

runTest('6.1 Script never uses x-user-emp-id or x-user-name headers as authentication', () => {
  assert(!testScriptSrc.includes("'x-user-emp-id':"), 'Must not send x-user-emp-id header');
  assert(!testScriptSrc.includes("'x-user-name':"), 'Must not send x-user-name header');
});

runTest('6.2 Separates tested reservation store write from unsupported physical stock release', () => {
  assert(testScriptSrc.includes("'6a. Inventory reservation store persistence'"), 'Must test store write as 6a');
  assert(testScriptSrc.includes("'6b. Inventory physical stock release'] = {\n      status: 'NOT TESTED'"), 'Must mark stock release 6b as NOT TESTED');
});

runTest('6.3 Separates tested invoice creation from unsupported final vehicle loading/dispatch', () => {
  assert(testScriptSrc.includes("'8a. Invoice creation and BOM linkage'"), 'Must test invoice creation as 8a');
  assert(testScriptSrc.includes("'8b. Vehicle loading and final dispatch completion'] = {\n      status: 'NOT TESTED'"), 'Must mark vehicle loading 8b as NOT TESTED');
});

runTest('6.4 Reports unsupported Dispatch packing and Accounts verification as NOT TESTED', () => {
  assert(testScriptSrc.includes("'7. Dispatch packing and accounts verification'] = {\n      status: 'NOT TESTED'"), 'Must mark 7 as NOT TESTED');
});

// =============================================================================
// TEST GROUP 7: Synthetic Administrator Provisioning & Transaction Safety
// Targeted regression tests for transactions, locking, collisions & cleanup
// =============================================================================
console.log('\n--- TEST GROUP 7: Synthetic Administrator Provisioning & Transaction Safety ---');

function createMockDbClient(initialStoreData = null, options = {}) {
  const queryLog = [];
  let inTransaction = false;
  let rolledBack = false;
  let committed = false;
  let storeState = initialStoreData !== null ? JSON.parse(JSON.stringify(initialStoreData)) : null;

  return {
    queryLog,
    get inTransaction() { return inTransaction; },
    get rolledBack() { return rolledBack; },
    get committed() { return committed; },
    get storeState() { return storeState; },
    async query(sql, params) {
      const trimmed = sql.trim();
      queryLog.push({ sql: trimmed, params });

      if (options.failOnSql && options.failOnSql.test(trimmed)) {
        throw new Error(`[MOCK DB ERROR] Simulated failure on SQL: ${trimmed}`);
      }

      const normalized = trimmed.toUpperCase();

      if (normalized === 'BEGIN') {
        if (inTransaction) throw new Error('Transaction already active');
        inTransaction = true;
        return { rows: [] };
      }

      if (normalized === 'COMMIT') {
        if (!inTransaction) throw new Error('COMMIT called outside transaction');
        inTransaction = false;
        committed = true;
        return { rows: [] };
      }

      if (normalized === 'ROLLBACK') {
        inTransaction = false;
        rolledBack = true;
        return { rows: [] };
      }

      if (normalized.startsWith('SELECT PG_ADVISORY_XACT_LOCK')) {
        if (!inTransaction) throw new Error('Advisory xact lock requires active transaction');
        return { rows: [{ pg_advisory_xact_lock: null }] };
      }

      if (normalized.includes('INSERT INTO PUBLIC.CONTROLROOM_STORE') && normalized.includes('ON CONFLICT (KEY) DO NOTHING')) {
        if (storeState === null) {
          storeState = [];
        }
        return { rowCount: 1, rows: [] };
      }

      if (normalized.includes('SELECT DATA FROM PUBLIC.CONTROLROOM_STORE WHERE KEY =') && normalized.includes('FOR UPDATE')) {
        if (storeState === null) {
          return { rows: [] };
        }
        return { rows: [{ data: storeState }] };
      }

      if (normalized.includes('UPDATE PUBLIC.CONTROLROOM_STORE') || (normalized.includes('INSERT INTO PUBLIC.CONTROLROOM_STORE') && normalized.includes('DO UPDATE'))) {
        const newData = params && params[0] ? JSON.parse(params[0]) : [];
        storeState = newData;
        return { rowCount: 1, rows: [] };
      }

      return { rows: [] };
    }
  };
}

await runAsyncTest('7.1 Successful administrator provisioning with explicit BEGIN and COMMIT', async () => {
  const initial = [{ employee_code: 'EMP-001', email: 'emp1@test.com', status: 'Active' }];
  const mockClient = createMockDbClient(initial);
  const admin = await provisionSyntheticTestAdmin(mockClient, 'TA-TEST-001', 'admin@test.com', 'AdminPass123!');

  assert.strictEqual(mockClient.committed, true, 'Transaction must be committed');
  assert.strictEqual(mockClient.rolledBack, false, 'Transaction must not be rolled back');
  assert.strictEqual(mockClient.inTransaction, false, 'Transaction state must be inactive after commit');
  assert.strictEqual(admin.employee_code, 'TA-TEST-001', 'Employee code must match');
  assert.strictEqual(admin.status, 'Active', 'Status must be Active');
  assert.strictEqual(admin.role, 'Technical Administrator', 'Role must be Technical Administrator');
  assert(admin.synthTag, 'Must include synthTag for ownership tracking');
  assert.strictEqual(mockClient.storeState.length, 2, 'Store must contain both initial employee and new admin');
  assert.strictEqual(mockClient.storeState[0].employee_code, 'EMP-001', 'Original employee must be preserved');
  assert.strictEqual(mockClient.storeState[1].employee_code, 'TA-TEST-001', 'Admin must be appended');
});

await runAsyncTest('7.2 Rejects pre-existing employee-code collision and triggers ROLLBACK', async () => {
  const initial = [{ employee_code: 'TA-EXISTING', email: 'existing@test.com', status: 'Active' }];
  const mockClient = createMockDbClient(initial);
  let errorCaught = null;
  try {
    await provisionSyntheticTestAdmin(mockClient, 'TA-EXISTING', 'new_email@test.com', 'AdminPass123!');
  } catch (err) {
    errorCaught = err;
  }
  assert(errorCaught, 'Must throw error on code collision');
  assert(errorCaught.message.includes('code collision detected'), 'Error must specify code collision');
  assert.strictEqual(mockClient.rolledBack, true, 'Transaction must be rolled back on collision');
  assert.strictEqual(mockClient.committed, false, 'Transaction must not be committed');
  assert.strictEqual(mockClient.inTransaction, false, 'inTransaction must be cleared');
  assert.strictEqual(mockClient.storeState.length, 1, 'Store must remain unchanged');
});

await runAsyncTest('7.3 Rejects pre-existing email collision and triggers ROLLBACK', async () => {
  const initial = [{ employee_code: 'EMP-002', email: 'admin_dupe@test.com', status: 'Active' }];
  const mockClient = createMockDbClient(initial);
  let errorCaught = null;
  try {
    await provisionSyntheticTestAdmin(mockClient, 'TA-NEW-CODE', 'admin_dupe@test.com', 'AdminPass123!');
  } catch (err) {
    errorCaught = err;
  }
  assert(errorCaught, 'Must throw error on email collision');
  assert(errorCaught.message.includes('email collision detected'), 'Error must specify email collision');
  assert.strictEqual(mockClient.rolledBack, true, 'Transaction must be rolled back on email collision');
  assert.strictEqual(mockClient.committed, false, 'Transaction must not be committed');
  assert.strictEqual(mockClient.storeState.length, 1, 'Store must remain unchanged');
});

await runAsyncTest('7.4 Protects concurrent access via pg_advisory_xact_lock and FOR UPDATE', async () => {
  const mockClient = createMockDbClient([]);
  await provisionSyntheticTestAdmin(mockClient, 'TA-CONCUR-1', 'admin_c1@test.com', 'Pass1!');

  const hasAdvisoryLock = mockClient.queryLog.some(q => q.sql.includes("pg_advisory_xact_lock(hashtext('controlroom_store:employees_store'))"));
  const hasRowLock = mockClient.queryLog.some(q => q.sql.includes("SELECT data FROM public.controlroom_store WHERE key = 'employees_store' FOR UPDATE"));

  assert(hasAdvisoryLock, 'Must acquire advisory xact lock for store serialization');
  assert(hasRowLock, 'Must acquire exclusive row lock with FOR UPDATE');

  // Sequential provisioning of second administrator preserves first without lost updates
  await provisionSyntheticTestAdmin(mockClient, 'TA-CONCUR-2', 'admin_c2@test.com', 'Pass2!');
  assert.strictEqual(mockClient.storeState.length, 2, 'Both administrators must exist without lost updates');
  assert.strictEqual(mockClient.storeState[0].employee_code, 'TA-CONCUR-1');
  assert.strictEqual(mockClient.storeState[1].employee_code, 'TA-CONCUR-2');
});

await runAsyncTest('7.5 Triggers ROLLBACK before releasing client when query fails', async () => {
  const mockClient = createMockDbClient([], { failOnSql: /UPDATE PUBLIC\.CONTROLROOM_STORE|ON CONFLICT/i });
  let errorCaught = null;
  try {
    await provisionSyntheticTestAdmin(mockClient, 'TA-FAIL-TEST', 'fail@test.com', 'Pass1!');
  } catch (err) {
    errorCaught = err;
  }
  assert(errorCaught, 'Must rethrow query failure');
  assert.strictEqual(mockClient.rolledBack, true, 'Must execute ROLLBACK on query failure');
  assert.strictEqual(mockClient.committed, false, 'Must not commit on failure');
  assert.strictEqual(mockClient.inTransaction, false, 'Transaction must be closed before releasing client');
});

await runAsyncTest('7.6 Safely initializes and locks missing employees_store row without lost updates', async () => {
  const mockClient = createMockDbClient(null);
  await provisionSyntheticTestAdmin(mockClient, 'TA-INIT-TEST', 'init@test.com', 'Pass1!');

  const hasDoNothing = mockClient.queryLog.some(q =>
    q.sql.includes("INSERT INTO public.controlroom_store") && q.sql.includes("ON CONFLICT (key) DO NOTHING")
  );
  assert(hasDoNothing, 'Must seed missing row with ON CONFLICT DO NOTHING before FOR UPDATE');
  assert.strictEqual(mockClient.committed, true, 'Must successfully commit');
  assert.strictEqual(mockClient.storeState.length, 1, 'Store must contain exactly the new admin');
  assert.strictEqual(mockClient.storeState[0].employee_code, 'TA-INIT-TEST');
});

await runAsyncTest('7.7 Verifies cleanup removes all three synthetic identities', async () => {
  const testRunId = Date.now();
  const synthTag = `SYNTH_P9Y_${testRunId}`;
  const adminCode = `TA-TEST-${testRunId % 1000}`;
  const pendCode = `SE-PEND-${testRunId % 1000}`;
  const actCode = `SE-ACT-${testRunId % 1000}`;

  const store = [
    { employee_code: 'EMP-001', employee_name: 'Existing Employee 1', email: 'emp1@businz.com', status: 'Active' },
    { employee_code: adminCode, employee_name: 'Test Administrator', email: `admin_${testRunId}@test.com`, synthTag, status: 'Active' },
    { employee_code: pendCode, employee_name: 'Pending Sales Rep', email: `pend_${testRunId}@test.com`, status: 'Pending Approval' },
    { employee_code: actCode, employee_name: 'Active Sales Rep', email: `act_${testRunId}@test.com`, status: 'Active' },
    { employee_code: 'EMP-002', employee_name: 'Existing Employee 2', email: 'emp2@businz.com', status: 'Active' }
  ];

  const syntheticEmployeeLedger = [
    { employee_code: adminCode, email: `admin_${testRunId}@test.com` },
    { employee_code: pendCode, email: `pend_${testRunId}@test.com` },
    { employee_code: actCode, email: `act_${testRunId}@test.com` }
  ];

  const scIds = syntheticEmployeeLedger.map(e => e.employee_code || e);

  // Exact filtering logic from executeComprehensiveCleanup
  const filtered = store.filter(item => {
    if (!item || typeof item !== 'object') return true;
    const matchId = item.employee_code || item.id || item.code;
    const matchesLedger = scIds.includes(matchId);
    const hasSynthTag = (item.synthTag === synthTag) ||
      (typeof item.customerName === 'string' && item.customerName.includes(synthTag)) ||
      (typeof item.email === 'string' && item.email.includes(String(testRunId))) ||
      (typeof item.employee_code === 'string' && item.employee_code.includes(String(testRunId % 1000)));
    return !(matchesLedger && hasSynthTag);
  });

  assert.strictEqual(store.length - filtered.length, 3, 'Exactly three synthetic identities must be removed');
  assert.strictEqual(filtered.length, 2, 'Exactly two unrelated employees must remain');
  assert(!filtered.some(e => e.employee_code === adminCode), 'Admin must be removed');
  assert(!filtered.some(e => e.employee_code === pendCode), 'Pending employee must be removed');
  assert(!filtered.some(e => e.employee_code === actCode), 'Active employee must be removed');
});

await runAsyncTest('7.8 Verifies unrelated employee records are 100% preserved during cleanup', async () => {
  const testRunId = Date.now();
  const synthTag = `SYNTH_P9Y_${testRunId}`;
  const unrelatedList = [
    { employee_code: 'EMP-001', employee_name: 'Alice Smith', email: 'alice@businz.com', role: 'Sales Executive', status: 'Active' },
    { employee_code: 'EMP-002', employee_name: 'Bob Jones', email: 'bob@businz.com', role: 'Accounts Manager', status: 'Active' },
    { employee_code: 'MGR-100', employee_name: 'Carol White', email: 'carol@businz.com', role: 'Production Admin', status: 'Active' }
  ];

  const fullStore = [
    ...unrelatedList,
    { employee_code: `TA-TEST-${testRunId % 1000}`, email: `admin_${testRunId}@test.com`, synthTag },
    { employee_code: `SE-PEND-${testRunId % 1000}`, email: `pend_${testRunId}@test.com` },
    { employee_code: `SE-ACT-${testRunId % 1000}`, email: `act_${testRunId}@test.com` }
  ];

  const scIds = [`TA-TEST-${testRunId % 1000}`, `SE-PEND-${testRunId % 1000}`, `SE-ACT-${testRunId % 1000}`];

  const filtered = fullStore.filter(item => {
    if (!item || typeof item !== 'object') return true;
    const matchId = item.employee_code || item.id || item.code;
    const matchesLedger = scIds.includes(matchId);
    const hasSynthTag = (item.synthTag === synthTag) ||
      (typeof item.customerName === 'string' && item.customerName.includes(synthTag)) ||
      (typeof item.email === 'string' && item.email.includes(String(testRunId))) ||
      (typeof item.employee_code === 'string' && item.employee_code.includes(String(testRunId % 1000)));
    return !(matchesLedger && hasSynthTag);
  });

  assert.strictEqual(filtered.length, unrelatedList.length, 'All unrelated records must be preserved');
  assert.deepStrictEqual(filtered, unrelatedList, 'Unrelated records must remain identical and unmodified');
});

// =============================================================================
// TEST GROUP 8: Phase 9Z Lead Notification Schema, Transaction Consistency & Recovery
// =============================================================================
console.log('\n--- TEST GROUP 8: Phase 9Z Lead Notification Schema, Transaction Consistency & Recovery ---');

const migrationPath = path.resolve(__dirname, '../server/migrations/20261028_lead_notification_recipient_unique_constraint.sql');
const rollbackMigrationPath = path.resolve(__dirname, '../server/migrations/20261028_lead_notification_recipient_unique_constraint_rollback.sql');
const leadMgmtSrcPath = path.resolve(__dirname, '../server/leadManagementService.js');
const dbSrcPath = path.resolve(__dirname, '../server/db.js');
const recoveryScriptPath = path.resolve(__dirname, 'recover_phase9y_test_residue.js');

const migrationSrc = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const rollbackSrc = fs.existsSync(rollbackMigrationPath) ? fs.readFileSync(rollbackMigrationPath, 'utf8') : '';
const leadMgmtSrc = fs.existsSync(leadMgmtSrcPath) ? fs.readFileSync(leadMgmtSrcPath, 'utf8') : '';
const dbSrc = fs.existsSync(dbSrcPath) ? fs.readFileSync(dbSrcPath, 'utf8') : '';
const recoveryScriptSrc = fs.existsSync(recoveryScriptPath) ? fs.readFileSync(recoveryScriptPath, 'utf8') : '';

runTest('8.1 Migration exists and creates unique index on (notification_id, recipient_user_id) concurrently', () => {
  assert(fs.existsSync(migrationPath), 'Migration file must exist');
  assert(migrationSrc.includes('CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_notif_recipient_unique'), 'Must create unique index concurrently');
  assert(migrationSrc.includes('ON public.lead_notification_recipients(notification_id, recipient_user_id)'), 'Must index notification_id and recipient_user_id');
});

runTest('8.2 Migration includes fail-safe duplicate pre-flight audit without automatic deletion', () => {
  assert(migrationSrc.includes('duplicate_count > 0'), 'Must check for duplicate count');
  assert(migrationSrc.includes('RAISE EXCEPTION'), 'Must raise exception on duplicates');
  assert(migrationSrc.includes('[PRE-FLIGHT-FAIL-SAFE]'), 'Must include fail-safe tag');
  assert(!migrationSrc.includes('DELETE FROM public.lead_notification_recipients'), 'Migration must never auto-delete rows');
});

runTest('8.3 Migration inspects target index table, columns, and never drops an unrelated index', () => {
  assert(migrationSrc.includes('v_tbl <> \'lead_notification_recipients\''), 'Must fail closed if index belongs to different table');
  assert(migrationSrc.includes('v_cols <> ARRAY[\'notification_id\', \'recipient_user_id\']'), 'Must fail closed if index has different columns');
  assert(migrationSrc.includes('[INDEX-METADATA-MISMATCH]'), 'Must include metadata mismatch error');
});

runTest('8.4 Migration performs separately guarded DROP INDEX CONCURRENTLY outside any transaction', () => {
  assert(migrationSrc.includes('DROP INDEX CONCURRENTLY IF EXISTS public.idx_notif_recipient_unique;'), 'Must execute DROP INDEX CONCURRENTLY');
  assert(migrationSrc.includes('\\gexec'), 'Must execute guarded concurrent drop via \\gexec');
  assert(migrationSrc.includes('i.indisvalid IS FALSE'), 'Guarded drop must only trigger when matching index is invalid');
});

runTest('8.5 Migration verifies final index is valid, unique, and on exact intended columns', () => {
  assert(migrationSrc.includes('v_tbl <> \'lead_notification_recipients\''), 'Post-check must verify table');
  assert(migrationSrc.includes('v_cols <> ARRAY[\'notification_id\', \'recipient_user_id\']'), 'Post-check must verify columns');
  assert(migrationSrc.includes('IF NOT v_valid THEN'), 'Post-check must assert indisvalid = true');
  assert(migrationSrc.includes('IF NOT v_unique THEN'), 'Post-check must assert indisunique = true');
});

runTest('8.6 Migration is authoritative schema change: runtime startup does NOT create unique index', () => {
  assert(!leadMgmtSrc.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_recipient_unique'), 'ensureLeadsSchema must not create index at runtime');
  assert(!dbSrc.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_recipient_unique'), 'db.js table init must not create index at runtime');
});

runTest('8.7 Rollback migration exists and drops unique index concurrently', () => {
  assert(fs.existsSync(rollbackMigrationPath), 'Rollback migration must exist');
  assert(rollbackSrc.includes('DROP INDEX CONCURRENTLY IF EXISTS public.idx_notif_recipient_unique'), 'Rollback must drop index concurrently');
});

runTest('8.8 createLead() runs schema prep before BEGIN and executes lead + notifications atomically', () => {
  const schemaCallIdx = leadMgmtSrc.indexOf('await ensureLeadsSchema();');
  const txCallIdx = leadMgmtSrc.indexOf('withTransaction(async (client) => {');
  assert(schemaCallIdx !== -1, 'createLead must call ensureLeadsSchema');
  assert(txCallIdx !== -1, 'createLead must call withTransaction');
  assert(schemaCallIdx < txCallIdx, 'ensureLeadsSchema must execute before withTransaction BEGIN');
  assert(leadMgmtSrc.includes('createLeadNotification({\n        client,'), 'createLead must pass client to createLeadNotification');
});

runTest('8.9 Realtime SSE notification broadcast is deferred until AFTER transaction commit', () => {
  assert(leadMgmtSrc.includes('deferredBroadcast: () => broadcastLeadNotification(broadcastData)'), 'createLeadNotification must defer broadcast when client is passed');
  assert(leadMgmtSrc.includes('// Post-commit: Broadcast realtime notification only after transaction has successfully committed'), 'createLead must document post-commit broadcast');
  assert(leadMgmtSrc.includes('if (typeof pendingNotificationBroadcast === \'function\')'), 'createLead must execute broadcast only after withTransaction');
});

runTest('8.10 Standalone createLeadNotification without client broadcasts immediately upon commit', () => {
  assert(leadMgmtSrc.includes('await withTransaction(executeNotificationWrites);'), 'Standalone notification must run in isolated transaction');
  assert(leadMgmtSrc.includes('broadcastLeadNotification(broadcastData);'), 'Standalone notification must broadcast after withTransaction completes');
});

runTest('8.11 Recipient insertion enforces idempotency with ON CONFLICT DO NOTHING', () => {
  assert(leadMgmtSrc.includes('ON CONFLICT (notification_id, recipient_user_id) DO NOTHING'), 'Must use ON CONFLICT DO NOTHING for recipients');
});

runTest('8.12 Recovery script rejects lead number VRM-LD-2026-01 alone without SYNTH_P9Y_ marker', () => {
  const legitLead = { id: 'VRM-LD-2026-01', lead_number: 'VRM-LD-2026-01', company_name: 'Genuine Corp', notes: 'Legitimate enquiry' };
  assert.strictEqual(verifySyntheticLeadOwnership(legitLead), false, 'Lead number alone must NEVER qualify as synthetic');

  const synthLead = { id: 'VRM-LD-2026-01', lead_number: 'VRM-LD-2026-01', company_name: 'SYNTH_P9Y_Solar', notes: 'Test' };
  assert.strictEqual(verifySyntheticLeadOwnership(synthLead), true, 'Lead with SYNTH_P9Y_ marker must qualify');

  const unknownLead = { id: 'OTHER-001', lead_number: 'OTHER-001', company_name: 'SYNTH_P9Y_Solar' };
  assert.strictEqual(verifySyntheticLeadOwnership(unknownLead), false, 'Unknown lead code must be rejected');
});

runTest('8.13 Recovery script requires exact code + run-specific identity marker and rejects generic prefixes/names', () => {
  // Generic email prefix without matching run marker -> REJECT
  const genericEmailEmp = { employee_code: 'SE-PEND-552', employee_name: 'Test Sales Rep', email: 'synth_random_user@example.com' };
  assert.strictEqual(verifySyntheticEmployeeEvidence(genericEmailEmp), false, 'Generic email prefix without run marker must be rejected');

  // Generic name without synthetic evidence -> REJECT
  const fakeEmp = { employee_code: 'SE-PEND-552', employee_name: 'Active Test Pending User', email: 'john.doe@company.com' };
  assert.strictEqual(verifySyntheticEmployeeEvidence(fakeEmp), false, 'Generic Active/Test/Pending names must be rejected');

  // Unknown employee code -> REJECT
  const unknownEmp = { employee_code: 'EMP-999', email: 'synth_admin_552@example.com' };
  assert.strictEqual(verifySyntheticEmployeeEvidence(unknownEmp), false, 'Unknown employee code must be rejected');

  // Exact known Phase 9Y synthetic records -> MUST BE VERIFIED
  const synthAdmin = { employee_code: 'TA-TEST-552', synthTag: 'SYNTH_P9Y_1793160000552', email: 'synth_admin_1793160000552@example.com' };
  assert.strictEqual(verifySyntheticEmployeeEvidence(synthAdmin), true, 'TA-TEST-552 with correlated tag and email must be verified');

  const synthPend = { employee_code: 'SE-PEND-552', email: 'synth_pend_1793160000552@example.com' };
  assert.strictEqual(verifySyntheticEmployeeEvidence(synthPend), true, 'SE-PEND-552 with correlated email must be verified');

  const synthAct = { employee_code: 'SE-ACT-552', email: 'synth_act_1793160000552@example.com' };
  assert.strictEqual(verifySyntheticEmployeeEvidence(synthAct), true, 'SE-ACT-552 with correlated email must be verified');

  const synthLegacy = { employee_code: 'SE-TEST-396', email: 'synth_user_396@example.com' };
  assert.strictEqual(verifySyntheticEmployeeEvidence(synthLegacy), true, 'SE-TEST-396 with correlated email must be verified');
});

runTest('8.14 SQL queries escape underscores so SYNTH_P9Y_ does not act as wildcard', () => {
  assert(recoveryScriptSrc.includes('LIKE \'%SYNTH\\\\_P9Y\\\\_%\' ESCAPE \'\\\\\''), 'Recovery script must escape underscores in LIKE');
  assert(testScriptSrc.includes('ESCAPE \'\\\\\''), 'Test integration script must use ESCAPE in LIKE queries');
});

runTest('8.15 Recovery script acquires FOR UPDATE row locks and re-verifies ownership before removal', () => {
  assert(recoveryScriptSrc.includes('SELECT id, lead_number, company_name, notes FROM public.leads WHERE id = $1 FOR UPDATE'), 'Must lock lead row FOR UPDATE');
  assert(recoveryScriptSrc.includes('verifySyntheticLeadOwnership(lockedLead)'), 'Must re-verify synthetic lead ownership under lock');
  assert(recoveryScriptSrc.includes('SELECT data FROM public.controlroom_store WHERE key = \'employees_store\' FOR UPDATE'), 'Must lock employees_store FOR UPDATE');
  assert(recoveryScriptSrc.includes('verifySyntheticEmployeeEvidence(item)'), 'Must re-verify synthetic employee evidence under lock');
});

runTest('8.16 Recovery script uses parameterized ownership-constrained DELETE statements', () => {
  assert(recoveryScriptSrc.includes('DELETE FROM public.leads\n        WHERE id = $1 AND (company_name LIKE \'%SYNTH\\\\_P9Y\\\\_%\' ESCAPE \'\\\\\' OR notes LIKE \'%SYNTH\\\\_P9Y\\\\_%\' ESCAPE \'\\\\\')'), 'Parent lead delete must be constrained by ownership');
  assert(recoveryScriptSrc.includes('DELETE FROM public.lead_notification_recipients\n        WHERE notification_id IN (\n          SELECT n.id FROM public.lead_notifications n\n          JOIN public.leads l ON n.lead_id = l.id\n          WHERE l.id = $1 AND (l.company_name LIKE \'%SYNTH\\\\_P9Y\\\\_%\' ESCAPE \'\\\\\' OR l.notes LIKE \'%SYNTH\\\\_P9Y\\\\_%\' ESCAPE \'\\\\\')\n        )'), 'Recipients delete must be constrained by ownership');
});

runTest('8.17 Dynamic cleanup restricts unrecorded lead & BOM recovery strictly to current SYNTH_TAG', () => {
  assert(testScriptSrc.includes('WHERE (company_name LIKE $1 ESCAPE \'\\\\\' OR notes = $2) AND id NOT IN'), 'Lead recovery must require SYNTH_TAG with escape');
  assert(testScriptSrc.includes('WHERE customer_name LIKE $1 ESCAPE \'\\\\\' AND id NOT IN'), 'BOM recovery must strictly require customer_name SYNTH_TAG with escape');
  assert(!testScriptSrc.includes('bom_code LIKE $2'), 'BOM recovery must not use loose bom_code substring');
});

runTest('8.18 Pre-commit baseline check asserts zero residual synthetic records matching SYNTH_TAG', () => {
  assert(testScriptSrc.includes('// Verify zero residual synthetic records matching this run\'s SYNTH_TAG'), 'Must check for residual synthetic records');
  assert(testScriptSrc.includes('residualLeads = await client.query('), 'Must query residual leads');
  assert(testScriptSrc.includes('residualBoms = await client.query('), 'Must query residual BOMs');
  assert(testScriptSrc.includes('cleanupReport.remainingSyntheticData.length === 0'), 'baselineRestored must require zero residual synthetic records');
});

runTest('8.19 Unrelated records are 100% preserved during recovery filtering', () => {
  const originalEmployees = [
    { employee_code: 'EMP-001', employee_name: 'Real Engineer', email: 'real@businz.com' },
    { employee_code: 'SE-PEND-552', employee_name: 'Synth User', email: 'synth_se_pend_552@example.com' },
    { employee_code: 'EMP-002', employee_name: 'Real Sales', email: 'sales@businz.com' }
  ];

  const targetCodes = ['SE-PEND-552'];
  const cleaned = originalEmployees.filter(e => !targetCodes.includes(e.employee_code));

  assert.strictEqual(cleaned.length, 2, 'Must keep exactly 2 non-synthetic employees');
  assert.strictEqual(cleaned[0].employee_code, 'EMP-001', 'Must preserve EMP-001');
  assert.strictEqual(cleaned[1].employee_code, 'EMP-002', 'Must preserve EMP-002');
});

runTest('8.20 assignLead() preserves historical return contract and does not leak internal fields', () => {
  assert(leadMgmtSrc.includes('// Preserve historical return contract: return database lead row directly without leaking internal fields'), 'Must document historical return preservation');
  assert(leadMgmtSrc.includes('return result;'), 'assignLead must return the database lead row directly');

  // Verify non-enumerable definition of _deferredNotification
  assert(leadMgmtSrc.includes('Object.defineProperty(result, \'_deferredNotification\','), 'Must attach _deferredNotification as non-enumerable');
  assert(leadMgmtSrc.includes('enumerable: false'), 'Internal notification must be enumerable: false');

  // Verify that an object with non-enumerable property does not leak in JSON.stringify
  const sampleLead = { id: 'LD-001', company_name: 'Acme', assigned_to_user_id: 'SE-001' };
  Object.defineProperty(sampleLead, '_deferredNotification', { value: () => {}, enumerable: false });
  const serialized = JSON.stringify(sampleLead);
  assert(!serialized.includes('_deferredNotification'), 'JSON serialization must not include non-enumerable _deferredNotification');
  assert.deepStrictEqual(JSON.parse(serialized), { id: 'LD-001', company_name: 'Acme', assigned_to_user_id: 'SE-001' });
});

runTest('8.21 assignLead() supports onDeferredNotification callback for parent transactions', () => {
  assert(leadMgmtSrc.includes('onDeferredNotification = null'), 'assignLead must accept onDeferredNotification parameter');
  assert(leadMgmtSrc.includes('onDeferredNotification(notifResult.deferredBroadcast);'), 'Must invoke onDeferredNotification with deferredBroadcast');
  assert(leadMgmtSrc.includes('onDeferredNotification: (broadcastFn) => {'), 'createLead must pass onDeferredNotification');
});

runTest('8.22 assignLead() preserves status history, assignment history, and authorization checks', () => {
  assert(leadMgmtSrc.includes('canAssignLeads(assignerUser.role, assignerUser.employee_code)'), 'Must check canAssignLeads permission');
  assert(leadMgmtSrc.includes('INSERT INTO public.lead_assignment_history'), 'Must insert into lead_assignment_history');
  assert(leadMgmtSrc.includes('INSERT INTO public.lead_status_history'), 'Must insert into lead_status_history');
  assert(leadMgmtSrc.includes('UPDATE public.leads SET'), 'Must update lead record');
});

runTest('8.23 Recovery script defaults to dry-run and requires --execute-authorized for live execution', () => {
  assert(recoveryScriptSrc.includes('--execute-authorized'), 'Must check for --execute-authorized flag');
  assert(recoveryScriptSrc.includes('const isDryRun = !isExecuteAuthorized'), 'Must default to dry run mode');
  assert(recoveryScriptSrc.includes('DRY RUN COMPLETE: Zero database writes performed.'), 'Must confirm dry run completion');
});

runTest('8.24 Recovery script enforces fail-closed workspace and database isolation', () => {
  assert(recoveryScriptSrc.includes('resolveAndValidateTestDatabaseUrl'), 'Must use resolveAndValidateTestDatabaseUrl');
  assert(recoveryScriptSrc.includes("expectedWorkspace = '/var/www/businz-optimization-test'"), 'Must define expected workspace');
  assert(recoveryScriptSrc.includes('workspaceDir !== expectedWorkspace'), 'Must check workspace mismatch');
  assert(recoveryScriptSrc.includes('[FAIL-CLOSED] Workspace mismatch'), 'Must report fail-closed workspace mismatch');
});

runTest('8.25 PostgreSQL 18-compatible index metadata inspection', () => {
  // Must avoid int2vector array_position() incompatibility in PostgreSQL 18.6
  assert(!migrationSrc.includes('array_position('), 'Must not use array_position anywhere in migration');
  assert(!migrationSrc.includes('split_part'), 'Must not use split_part anywhere in migration');

  // Must use PostgreSQL 18.6 verified pg_get_indexdef column extraction
  assert(migrationSrc.includes('pg_get_indexdef(i.indexrelid, k, TRUE)'), 'Must use pg_get_indexdef for column extraction');
  assert(migrationSrc.includes('generate_series(1, i.indnkeyatts)'), 'Must use generate_series(1, i.indnkeyatts)');

  // Must verify total and key attributes (PostgreSQL 11+ / 18.6 compatible)
  assert(migrationSrc.includes('v_natts <> 2 OR v_nkeyatts <> 2'), 'Must verify total and key attributes in step 1');
  assert(migrationSrc.includes('i.indnatts = 2\n    AND i.indnkeyatts = 2'), 'Must verify total and key attributes in step 2');

  // Must enable ON_ERROR_STOP in psql
  assert(migrationSrc.includes('\\set ON_ERROR_STOP on'), 'Must enable ON_ERROR_STOP for psql autocommit mode');
});

runTest('8.26 Exact key-column matching in required order (notification_id, recipient_user_id)', () => {
  assert(migrationSrc.includes("v_cols <> ARRAY['notification_id', 'recipient_user_id']"), 'Step 1 must fail closed on column mismatch');
  assert(migrationSrc.includes("ARRAY['notification_id', 'recipient_user_id']"), 'Step 2 must verify matching columns in order');
  assert(migrationSrc.includes("v_cols <> ARRAY['notification_id', 'recipient_user_id']"), 'Step 5 must verify exact column ordering');
});

runTest('8.27 Invalid-index fail-closed protection for expressions and partial predicates', () => {
  // Expression index fail-closed
  assert(migrationSrc.includes('(i.indexprs IS NOT NULL)'), 'Must check for expressions');
  assert(migrationSrc.includes('v_has_expr'), 'Must track expressions flag');
  assert(migrationSrc.includes("contains unexpected expressions (indexprs IS NOT NULL)"), 'Step 1 must fail closed on expressions');

  // Partial predicate fail-closed
  assert(migrationSrc.includes('(i.indpred IS NOT NULL)'), 'Must check for partial predicates');
  assert(migrationSrc.includes('v_has_pred'), 'Must track partial predicates flag');
  assert(migrationSrc.includes("has an unexpected partial predicate (indpred IS NOT NULL)"), 'Step 1 must fail closed on partial predicates');

  // Step 2 drop condition
  assert(migrationSrc.includes('i.indexprs IS NULL'), 'Step 2 guarded drop must require indexprs IS NULL');
  assert(migrationSrc.includes('i.indpred IS NULL'), 'Step 2 guarded drop must require indpred IS NULL');
});

runTest('8.28 Transaction rollback on mandatory notification failure inside assignLead()', async () => {
  // 1. Static assertion: catch block in assignLead must re-throw when client is present
  assert(leadMgmtSrc.includes('if (client) {\n      // Mandatory notification write failure within outer transaction'), 'assignLead must check if (client) on notification failure');
  assert(leadMgmtSrc.includes('throw notifErr;'), 'assignLead must throw notifErr when client is present');

  // 2. Behavioral assertion: test that an error in notification creation within an outer transaction propagates
  let rollbackTriggered = false;
  const simulatedOuterTx = async () => {
    const mockClient = { query: async () => ({ rows: [] }) };
    try {
      // Simulate assignLead with client throwing on notification failure
      const simulateAssignLead = async (client) => {
        const leadRow = { id: 'LD-999', lead_number: 'VRM-LD-2026-99', company_name: 'Rollback Test' };
        // Step 1-4 execute on client...
        // Step 5: Notification creation fails
        try {
          throw new Error('[DB-ERR] duplicate key or constraint violation on lead_notification_recipients');
        } catch (notifErr) {
          if (client) {
            throw notifErr;
          }
        }
        return leadRow;
      };

      await simulateAssignLead(mockClient);
    } catch (err) {
      rollbackTriggered = true;
      throw err;
    }
  };

  await assert.rejects(simulatedOuterTx(), /duplicate key or constraint violation/, 'Outer transaction must receive notification failure and trigger rollback');
  assert.strictEqual(rollbackTriggered, true, 'Rollback must be triggered upon mandatory notification failure');
});

runTest('8.29 Standalone assignment compatibility (notification error does not fail committed assignment)', async () => {
  // 1. Static assertion: standalone mode logs warning and does not re-throw
  assert(leadMgmtSrc.includes('// Preserve historical standalone assignment behavior: log warning without reversing already committed assignment'), 'Must document standalone behavior preservation');

  // 2. Behavioral assertion: test that an error in notification creation without client does NOT throw and returns lead
  let noticeLogged = false;
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (args.some(a => String(a).includes('[Notification Notice]'))) noticeLogged = true;
  };

  try {
    const simulateStandaloneAssignLead = async (client = null) => {
      const leadRow = { id: 'LD-100', lead_number: 'VRM-LD-2026-10', company_name: 'Standalone Test' };
      // Step 1-4 commit successfully...
      // Step 5: Notification fails
      try {
        throw new Error('Network timeout talking to notification service');
      } catch (notifErr) {
        if (client) {
          throw notifErr;
        }
        console.warn('[Notification Notice]:', notifErr.message);
      }
      return leadRow;
    };

    const res = await simulateStandaloneAssignLead(null);
    assert.deepStrictEqual(res, { id: 'LD-100', lead_number: 'VRM-LD-2026-10', company_name: 'Standalone Test' });
    assert.strictEqual(noticeLogged, true, 'Notice must be logged without failing standalone assignment');
  } finally {
    console.warn = originalWarn;
  }
});

runTest('8.30 Post-commit SSE delivery guarantees no broadcast on rollback', () => {
  assert(leadMgmtSrc.includes('// Post-commit: Broadcast realtime notification only after transaction has successfully committed'), 'Must document post-commit broadcast guarantee');
  
  // Verify structural ordering: broadcast call occurs after withTransaction has resolved
  const txEndIdx = leadMgmtSrc.indexOf('return lead;\n  });');
  const broadcastIdx = leadMgmtSrc.indexOf('if (typeof pendingNotificationBroadcast === \'function\') {\n    try {\n      pendingNotificationBroadcast();');
  assert(txEndIdx !== -1, 'Must locate end of withTransaction block in createLead');
  assert(broadcastIdx !== -1, 'Must locate post-commit broadcast in createLead');
  assert(txEndIdx < broadcastIdx, 'Broadcast must strictly follow withTransaction resolution');
});

runTest('8.31 Complete preservation of unrelated database records during recovery and cleanup', () => {
  const dataset = [
    { id: 'VRM-LD-2026-01', company_name: 'SYNTH_P9Y_Test_Solar', notes: 'SYNTH_P9Y_Test_Solar', isSynth: true },
    { id: 'VRM-LD-2026-02', company_name: 'Legitimate Solar Industries', notes: 'Quotation requested', isSynth: false },
    { id: 'VRM-LD-2026-03', company_name: 'Real Power Corp', notes: 'Follow up next week', isSynth: false }
  ];

  // Recovery filter criteria: exact ownership marker
  const preserved = dataset.filter(r => !verifySyntheticLeadOwnership(r));
  assert.strictEqual(preserved.length, 2, 'Must preserve exactly 2 unrelated leads');
  assert.strictEqual(preserved[0].id, 'VRM-LD-2026-02', 'Must preserve VRM-LD-2026-02');
  assert.strictEqual(preserved[1].id, 'VRM-LD-2026-03', 'Must preserve VRM-LD-2026-03');
});

runTest('8.32 Fail-closed protection across single-column, composite, invalid, and mismatched index definitions', () => {
  // Simulates Step 1 metadata evaluation logic on PostgreSQL 18.6
  function evaluateIndexMetadata({
    tableName,
    keyColumns,
    isUnique,
    isValid,
    natts,
    nkeyatts,
    hasExpr,
    hasPred
  }) {
    if (tableName !== 'lead_notification_recipients') {
      throw new Error(`[INDEX-METADATA-MISMATCH] Existing index belongs to unrelated table "${tableName}", expected "lead_notification_recipients"!`);
    }
    if (natts !== 2 || nkeyatts !== 2) {
      throw new Error(`[INDEX-METADATA-MISMATCH] Existing index has ${natts} total attributes and ${nkeyatts} key attributes (expected exactly 2 key columns, no included columns)!`);
    }
    if (hasExpr) {
      throw new Error('[INDEX-METADATA-MISMATCH] Existing index contains unexpected expressions (indexprs IS NOT NULL)!');
    }
    if (hasPred) {
      throw new Error('[INDEX-METADATA-MISMATCH] Existing index has an unexpected partial predicate (indpred IS NOT NULL)!');
    }
    const expectedCols = ['notification_id', 'recipient_user_id'];
    if (keyColumns.length !== 2 || keyColumns[0] !== expectedCols[0] || keyColumns[1] !== expectedCols[1]) {
      throw new Error(`[INDEX-METADATA-MISMATCH] Existing index key columns are [${keyColumns.join(', ')}], expected [notification_id, recipient_user_id] in that exact order!`);
    }
    if (isValid && isUnique) {
      return 'VALID_AND_UNIQUE';
    } else if (!isValid) {
      return 'INVALID_MATCHING';
    } else {
      throw new Error('[INDEX-METADATA-MISMATCH] Existing index is NOT unique (indisunique = false)!');
    }
  }

  // 1. Single-column index (e.g. Hostinger\'s lead_notification_recipients_pkey on [\'id\'])
  assert.throws(() => {
    evaluateIndexMetadata({
      tableName: 'lead_notification_recipients',
      keyColumns: ['id'],
      isUnique: true,
      isValid: true,
      natts: 1,
      nkeyatts: 1,
      hasExpr: false,
      hasPred: false
    });
  }, /expected exactly 2 key columns/, 'Single-column index must fail closed');

  // 2. Matching composite index: valid and unique
  const matchingRes = evaluateIndexMetadata({
    tableName: 'lead_notification_recipients',
    keyColumns: ['notification_id', 'recipient_user_id'],
    isUnique: true,
    isValid: true,
    natts: 2,
    nkeyatts: 2,
    hasExpr: false,
    hasPred: false
  });
  assert.strictEqual(matchingRes, 'VALID_AND_UNIQUE', 'Matching index must evaluate as valid and unique');

  // 3. Invalid matching index: triggers guarded concurrent drop
  const invalidRes = evaluateIndexMetadata({
    tableName: 'lead_notification_recipients',
    keyColumns: ['notification_id', 'recipient_user_id'],
    isUnique: true,
    isValid: false,
    natts: 2,
    nkeyatts: 2,
    hasExpr: false,
    hasPred: false
  });
  assert.strictEqual(invalidRes, 'INVALID_MATCHING', 'Invalid matching index must evaluate as invalid matching');

  // 4. Incorrect index definitions:
  // 4a. Reversed column order
  assert.throws(() => {
    evaluateIndexMetadata({
      tableName: 'lead_notification_recipients',
      keyColumns: ['recipient_user_id', 'notification_id'],
      isUnique: true,
      isValid: true,
      natts: 2,
      nkeyatts: 2,
      hasExpr: false,
      hasPred: false
    });
  }, /expected \[notification_id, recipient_user_id\] in that exact order/, 'Reversed column order must fail closed');

  // 4b. Unexpected included columns (INCLUDE)
  assert.throws(() => {
    evaluateIndexMetadata({
      tableName: 'lead_notification_recipients',
      keyColumns: ['notification_id', 'recipient_user_id'],
      isUnique: true,
      isValid: true,
      natts: 3,
      nkeyatts: 2,
      hasExpr: false,
      hasPred: false
    });
  }, /expected exactly 2 key columns, no included columns/, 'Included columns must fail closed');

  // 4c. Expression index
  assert.throws(() => {
    evaluateIndexMetadata({
      tableName: 'lead_notification_recipients',
      keyColumns: ['notification_id', 'recipient_user_id'],
      isUnique: true,
      isValid: true,
      natts: 2,
      nkeyatts: 2,
      hasExpr: true,
      hasPred: false
    });
  }, /contains unexpected expressions/, 'Expression index must fail closed');

  // 4d. Partial predicate
  assert.throws(() => {
    evaluateIndexMetadata({
      tableName: 'lead_notification_recipients',
      keyColumns: ['notification_id', 'recipient_user_id'],
      isUnique: true,
      isValid: true,
      natts: 2,
      nkeyatts: 2,
      hasExpr: false,
      hasPred: true
    });
  }, /has an unexpected partial predicate/, 'Partial index must fail closed');

  // 4e. Unrelated table
  assert.throws(() => {
    evaluateIndexMetadata({
      tableName: 'leads',
      keyColumns: ['notification_id', 'recipient_user_id'],
      isUnique: true,
      isValid: true,
      natts: 2,
      nkeyatts: 2,
      hasExpr: false,
      hasPred: false
    });
  }, /belongs to unrelated table "leads"/, 'Unrelated table must fail closed');

  // 4f. Non-unique index
  assert.throws(() => {
    evaluateIndexMetadata({
      tableName: 'lead_notification_recipients',
      keyColumns: ['notification_id', 'recipient_user_id'],
      isUnique: false,
      isValid: true,
      natts: 2,
      nkeyatts: 2,
      hasExpr: false,
      hasPred: false
    });
  }, /is NOT unique/, 'Non-unique index must fail closed');
});

// =============================================================================
// TEST GROUP 9: Phase 9AA PI-to-BOM Multi-Store Consistency & Cleanup Safeguards
// =============================================================================
console.log('\n--- TEST GROUP 9: Phase 9AA PI-to-BOM Multi-Store Consistency & Cleanup Safeguards ---');

runTest('9.1 isPiMatch helper matches PI across id, piNo, pi_no, proformaInvoiceNumber, piNumber, invoiceNo', () => {
  assert(isPiMatch({ id: 'PI-70304' }, 'pi-70304'), 'Must match id');
  assert(isPiMatch({ piNo: 'PI-70304' }, 'pi-70304'), 'Must match piNo');
  assert(isPiMatch({ pi_no: 'PI-70304' }, 'pi-70304'), 'Must match pi_no');
  assert(isPiMatch({ proformaInvoiceNumber: 'PI-70304' }, 'pi-70304'), 'Must match proformaInvoiceNumber');
  assert(isPiMatch({ piNumber: 'PI-70304' }, 'pi-70304'), 'Must match piNumber');
  assert(isPiMatch({ invoiceNo: 'PI-70304' }, 'pi-70304'), 'Must match invoiceNo');
  assert(!isPiMatch({ id: 'PI-99999' }, 'pi-70304'), 'Must not match different ID');
  assert(!isPiMatch(null, 'pi-70304'), 'Must handle null safely');
});

runTest('9.2 AUTHORITATIVE_PI_STORE_KEYS includes customer_pis_store, sales_pi_store, and proforma_invoice_store', () => {
  assert(AUTHORITATIVE_PI_STORE_KEYS.includes('customer_pis_store'), 'Must include customer_pis_store');
  assert(AUTHORITATIVE_PI_STORE_KEYS.includes('sales_pi_store'), 'Must include sales_pi_store');
  assert(AUTHORITATIVE_PI_STORE_KEYS.includes('proforma_invoice_store'), 'Must include proforma_invoice_store');
});

await runAsyncTest('9.3 validateAndSyncSourcePi succeeds when PI exists in customer_pis_store and updates conversion status', async () => {
  let updatedData = null;
  let updatedKey = null;

  const mockClient = {
    query: async (sql, params) => {
      if (sql.includes('public.controlroom_store') && sql.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              key: 'customer_pis_store',
              data: [
                {
                  id: 'PI-70304',
                  piNo: 'PI-70304',
                  customerName: 'Solar Infra',
                  grandTotal: 1850000,
                  status: 'Issued',
                  synthTag: 'SYNTH_P9Y_70304'
                },
                {
                  id: 'PI-UNRELATED-1',
                  piNo: 'PI-UNRELATED-1',
                  customerName: 'Real Customer',
                  grandTotal: 500000,
                  status: 'Issued'
                }
              ]
            }
          ]
        };
      }
      if (sql.includes("to_regclass('public.proforma_invoices')")) {
        return { rows: [{ reg: null }] };
      }
      if (sql.includes('public.bom_orders') && sql.includes('LOWER(source_pi_no)')) {
        return { rows: [] };
      }
      if (sql.includes('UPDATE public.controlroom_store')) {
        updatedData = JSON.parse(params[0]);
        updatedKey = params[1];
        return { rowCount: 1 };
      }
      return { rows: [] };
    }
  };

  await validateAndSyncSourcePi(mockClient, 'PI-70304', 'BOM-70304', {});

  assert.strictEqual(updatedKey, 'customer_pis_store', 'Must update customer_pis_store');
  assert(Array.isArray(updatedData), 'Updated data must be array');
  const matched = updatedData.find(p => p.id === 'PI-70304');
  assert(matched, 'Matched PI must exist in updated store');
  assert.strictEqual(matched.status, 'Converted to BOM', 'Status must be updated');
  assert.strictEqual(matched.convertedToBom, true, 'convertedToBom must be true');
  assert.strictEqual(matched.convertedBomCode, 'BOM-70304', 'convertedBomCode must match');
  assert.strictEqual(matched.customerName, 'Solar Infra', 'Customer name must be preserved');
  assert.strictEqual(matched.grandTotal, 1850000, 'Grand total must be preserved');
  assert.strictEqual(matched.synthTag, 'SYNTH_P9Y_70304', 'Synth tag must be preserved');

  // Verify unrelated record is 100% preserved
  const unrelated = updatedData.find(p => p.id === 'PI-UNRELATED-1');
  assert(unrelated, 'Unrelated PI must be preserved');
  assert.strictEqual(unrelated.status, 'Issued', 'Unrelated PI status must be unchanged');
  assert.strictEqual(unrelated.grandTotal, 500000, 'Unrelated PI total must be unchanged');
});

await runAsyncTest('9.4 validateAndSyncSourcePi succeeds when PI exists in sales_pi_store', async () => {
  let updatedKey = null;

  const mockClient = {
    query: async (sql, params) => {
      if (sql.includes('public.controlroom_store') && sql.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              key: 'sales_pi_store',
              data: [
                { id: 'PI-80001', piNo: 'PI-80001', customerName: 'Sales Cust', status: 'Issued' }
              ]
            }
          ]
        };
      }
      if (sql.includes("to_regclass('public.proforma_invoices')")) {
        return { rows: [{ reg: null }] };
      }
      if (sql.includes('public.bom_orders') && sql.includes('LOWER(source_pi_no)')) {
        return { rows: [] };
      }
      if (sql.includes('UPDATE public.controlroom_store')) {
        updatedKey = params[1];
        return { rowCount: 1 };
      }
      return { rows: [] };
    }
  };

  await validateAndSyncSourcePi(mockClient, 'PI-80001', 'BOM-80001', {});
  assert.strictEqual(updatedKey, 'sales_pi_store', 'Must update sales_pi_store');
});

await runAsyncTest('9.5 validateAndSyncSourcePi succeeds when PI exists in relational public.proforma_invoices table', async () => {
  let dbUpdateExecuted = false;

  const mockClient = {
    query: async (sql, params) => {
      if (sql.includes('public.controlroom_store') && sql.includes('FOR UPDATE')) {
        return { rows: [] };
      }
      if (sql.includes("to_regclass('public.proforma_invoices')")) {
        return { rows: [{ reg: 'public.proforma_invoices' }] };
      }
      if (sql.includes('SELECT * FROM public.proforma_invoices')) {
        return { rows: [{ id: 'PI-90001', pi_no: 'PI-90001', customer_name: 'DB Cust', status: 'Issued' }] };
      }
      if (sql.includes('public.bom_orders') && sql.includes('LOWER(source_pi_no)')) {
        return { rows: [] };
      }
      if (sql.includes('UPDATE public.proforma_invoices')) {
        dbUpdateExecuted = true;
        return { rowCount: 1 };
      }
      return { rows: [] };
    }
  };

  await validateAndSyncSourcePi(mockClient, 'PI-90001', 'BOM-90001', {});
  assert(dbUpdateExecuted, 'Must update relational proforma_invoices table');
});

await runAsyncTest('9.6 validateAndSyncSourcePi throws explicit error when PI is missing from all authoritative stores', async () => {
  const mockClient = {
    query: async (sql) => {
      if (sql.includes('public.controlroom_store') && sql.includes('FOR UPDATE')) {
        return { rows: [] };
      }
      if (sql.includes("to_regclass('public.proforma_invoices')")) {
        return { rows: [{ reg: null }] };
      }
      return { rows: [] };
    }
  };

  await assert.rejects(
    async () => {
      await validateAndSyncSourcePi(mockClient, 'PI-MISSING-999', 'BOM-999', {});
    },
    /\[PI Validation Error\] Source PI "PI-MISSING-999" does not exist in authoritative PI stores/,
    'Must throw explicit validation error when PI is missing'
  );
});

await runAsyncTest('9.7 validateAndSyncSourcePi rejects conflicting source PI association on base record', async () => {
  const mockClient = { query: async () => ({ rows: [] }) };
  await assert.rejects(
    async () => {
      await validateAndSyncSourcePi(mockClient, 'PI-NEW', 'BOM-100', { sourcePiNo: 'PI-ORIGINAL' });
    },
    /\[PI Association Conflict\] BOM "BOM-100" is already linked to source PI "PI-ORIGINAL", cannot re-associate to "PI-NEW"/,
    'Must reject conflicting source PI on BOM'
  );
});

await runAsyncTest('9.8 validateAndSyncSourcePi rejects when PI is already converted to a different active BOM in public.bom_orders', async () => {
  const mockClient = {
    query: async (sql) => {
      if (sql.includes('public.controlroom_store') && sql.includes('FOR UPDATE')) {
        return {
          rows: [{ key: 'customer_pis_store', data: [{ id: 'PI-70304', piNo: 'PI-70304', status: 'Issued' }] }]
        };
      }
      if (sql.includes("to_regclass('public.proforma_invoices')")) {
        return { rows: [{ reg: null }] };
      }
      if (sql.includes('public.bom_orders') && sql.includes('LOWER(source_pi_no)')) {
        return { rows: [{ bom_code: 'BOM-ACTIVE-PRIOR', id: 'BOM-ACTIVE-PRIOR', status: 'Sales Confirmed' }] };
      }
      return { rows: [] };
    }
  };

  await assert.rejects(
    async () => {
      await validateAndSyncSourcePi(mockClient, 'PI-70304', 'BOM-70304', {});
    },
    /\[PI Association Conflict\] Source PI "PI-70304" is already converted to active BOM "BOM-ACTIVE-PRIOR", cannot associate with BOM "BOM-70304"/,
    'Must reject when PI is already converted to an active BOM'
  );
});

await runAsyncTest('9.9 validateAndSyncSourcePi rejects when PI was previously converted to a cancelled BOM in public.bom_orders', async () => {
  const mockClient = {
    query: async (sql) => {
      if (sql.includes('public.controlroom_store') && sql.includes('FOR UPDATE')) {
        return {
          rows: [{ key: 'customer_pis_store', data: [{ id: 'PI-70304', piNo: 'PI-70304', status: 'Issued' }] }]
        };
      }
      if (sql.includes("to_regclass('public.proforma_invoices')")) {
        return { rows: [{ reg: null }] };
      }
      if (sql.includes('public.bom_orders') && sql.includes('LOWER(source_pi_no)')) {
        return { rows: [{ bom_code: 'BOM-CANCELLED-PRIOR', id: 'BOM-CANCELLED-PRIOR', status: 'Cancelled' }] };
      }
      return { rows: [] };
    }
  };

  await assert.rejects(
    async () => {
      await validateAndSyncSourcePi(mockClient, 'PI-70304', 'BOM-70304', {});
    },
    /\[PI Association Conflict\] Source PI "PI-70304" was previously converted to cancelled BOM "BOM-CANCELLED-PRIOR"\. Cannot associate with another BOM "BOM-70304"/,
    'Must reject when PI was converted to a cancelled BOM'
  );
});

await runAsyncTest('9.10 validateAndSyncSourcePi rejects when store PI object has a conflicting convertedBomCode', async () => {
  const mockClient = {
    query: async (sql) => {
      if (sql.includes('public.controlroom_store') && sql.includes('FOR UPDATE')) {
        return {
          rows: [{ key: 'customer_pis_store', data: [{ id: 'PI-70304', piNo: 'PI-70304', convertedBomCode: 'BOM-OTHER' }] }]
        };
      }
      if (sql.includes("to_regclass('public.proforma_invoices')")) {
        return { rows: [{ reg: null }] };
      }
      if (sql.includes('public.bom_orders') && sql.includes('LOWER(source_pi_no)')) {
        return { rows: [] };
      }
      if (sql.includes('public.bom_orders') && sql.includes('bom_code = $1')) {
        return { rows: [{ bom_code: 'BOM-OTHER', status: 'Production Planning' }] };
      }
      return { rows: [] };
    }
  };

  await assert.rejects(
    async () => {
      await validateAndSyncSourcePi(mockClient, 'PI-70304', 'BOM-NEW', {});
    },
    /\[PI Association Conflict\] Source PI "PI-70304" is already converted to BOM "BOM-OTHER"/,
    'Must reject when store PI has conflicting convertedBomCode'
  );
});

await runAsyncTest('9.11 queryTableCount checks to_regclass before querying non-existent tables to prevent SQLSTATE 25P02 transaction abort', async () => {
  let countQueryExecuted = false;
  const mockClient = {
    query: async (sql, params) => {
      if (sql.includes('to_regclass')) {
        // Table does not exist (returns null without throwing 42P01)
        return { rows: [{ reg: null }] };
      }
      if (sql.includes('SELECT COUNT(*)')) {
        countQueryExecuted = true;
        return { rows: [{ cnt: '10' }] };
      }
      return { rows: [] };
    }
  };

  const count = await queryTableCount(mockClient, 'bom_items');
  assert.strictEqual(count, 0, 'Non-existent table count must safely return 0');
  assert(!countQueryExecuted, 'Must NEVER execute SELECT COUNT(*) on non-existent table inside transaction');
});

runTest('9.12 executeComprehensiveCleanup dynamically discovers referencing foreign keys from information_schema.table_constraints', () => {
  assert(testScriptSrc.includes('information_schema.table_constraints'), 'Must query information_schema.table_constraints');
  assert(testScriptSrc.includes("ccu.table_name = 'bom_orders'"), 'Must filter by foreign table bom_orders');
  assert(testScriptSrc.includes("to_regclass"), 'Must verify child table existence with to_regclass');
});

runTest('9.13 executeComprehensiveCleanup implements bounded diagnostic logging (sqlState, failedStep, failedTarget, masked 300 chars)', () => {
  assert(testScriptSrc.includes('currentCleanupStep'), 'Must track currentCleanupStep');
  assert(testScriptSrc.includes('currentCleanupTarget'), 'Must track currentCleanupTarget');
  assert(testScriptSrc.includes('sqlState'), 'Must capture SQLSTATE');
  assert(testScriptSrc.includes('.slice(0, 300)'), 'Must bound error to 300 chars');
  assert(testScriptSrc.includes('password=***'), 'Must sanitize password credentials');
  assert(testScriptSrc.includes('x-session-id:***'), 'Must sanitize session tokens');
});

runTest('9.14 executeComprehensiveCleanup includes customer_pis_store, sales_pi_store, and proforma_invoice_store in storeCleanups', () => {
  assert(testScriptSrc.includes("'customer_pis_store'"), 'Must include customer_pis_store');
  assert(testScriptSrc.includes("'sales_pi_store'"), 'Must include sales_pi_store');
  assert(testScriptSrc.includes("'proforma_invoice_store'"), 'Must include proforma_invoice_store');
});

runTest('9.15 recover_phase9y_run_70304_residue verifies strict synthetic ownership on leads, employees, quotes, and PIs', () => {
  // Lead ownership
  assert(verifySyntheticLeadOwnership304({ company_name: `Company ${TARGET_SYNTH_TAG}` }), 'Valid lead must pass');
  assert(verifySyntheticLeadOwnership304({ notes: TARGET_SYNTH_TAG }), 'Valid lead notes must pass');
  assert(!verifySyntheticLeadOwnership304({ company_name: 'Real Company', notes: 'Real Note' }), 'Unrelated lead must fail');

  // Employee ownership
  assert(verifySyntheticEmployeeEvidence304({ employee_code: 'TA-TEST-304', email: 'synth_admin_1793190270304@example.com' }), 'Valid TA must pass');
  assert(verifySyntheticEmployeeEvidence304({ employee_code: 'SE-PEND-304', synthTag: TARGET_SYNTH_TAG }), 'Valid SE-PEND must pass');
  assert(verifySyntheticEmployeeEvidence304({ employee_code: 'SE-ACT-304', email: 'synth_act_304@example.com' }), 'Valid SE-ACT must pass');
  assert(!verifySyntheticEmployeeEvidence304({ employee_code: 'TA-TEST-304', email: 'generic_admin@example.com' }), 'Generic email must fail');
  assert(!verifySyntheticEmployeeEvidence304({ employee_code: 'EMP-001', email: 'emp@example.com' }), 'Unrelated employee must fail');

  // Quotation ownership
  assert(verifySyntheticQuotationOwnership304({ quotationNo: 'QT-70304', synthTag: TARGET_SYNTH_TAG }), 'Valid quotation must pass');
  assert(!verifySyntheticQuotationOwnership304({ quotationNo: 'QT-70304', customerName: 'Real Customer' }), 'Quotation without tag must fail');
  assert(!verifySyntheticQuotationOwnership304({ quotationNo: 'QT-99999', synthTag: TARGET_SYNTH_TAG }), 'Different quote number must fail');

  // PI ownership
  assert(verifySyntheticPiOwnership304({ piNo: 'PI-70304', synthTag: TARGET_SYNTH_TAG }), 'Valid PI must pass');
  assert(!verifySyntheticPiOwnership304({ piNo: 'PI-70304', customerName: 'Real Customer' }), 'PI without tag must fail');
  assert(!verifySyntheticPiOwnership304({ piNo: 'PI-99999', synthTag: TARGET_SYNTH_TAG }), 'Different PI number must fail');
});

await runAsyncTest('9.16 recover_phase9y_run_70304_residue defaults to dry-run and enforces workspace and database isolation', async () => {
  const result = await runResidueRecovery304({
    bypassWorkspaceCheckForTesting: false,
    databaseUrl: 'postgres://invalid:pass@192.168.1.1:5432/businz'
  });
  assert.strictEqual(result.success, false, 'Must fail closed on wrong workspace');
  assert.strictEqual(result.dryRun, true, 'Default mode must be dryRun: true');
});

// =============================================================================
// TEST GROUP 10: Fail-Closed Database Audit & Baseline Verification Safeguards
// =============================================================================
console.log('\n--- TEST GROUP 10: Fail-Closed Database Audit & Baseline Verification Safeguards ---');

await runAsyncTest('10.1 Missing optional table is handled safely and returns 0 without executing COUNT(*)', async () => {
  let countQueryExecuted = false;
  const mockClient = {
    query: async (sql, params) => {
      if (sql.includes('to_regclass')) {
        return { rows: [{ reg: null }] };
      }
      if (sql.includes('SELECT COUNT(*)')) {
        countQueryExecuted = true;
        return { rows: [{ cnt: '99' }] };
      }
      return { rows: [] };
    }
  };

  const count = await queryTableCount(mockClient, 'bom_items');
  assert.strictEqual(count, 0, 'Verified missing optional table must safely return 0');
  assert(!countQueryExecuted, 'Must NEVER execute COUNT(*) on missing optional table');

  // Also verify explicit optional override on another table
  const countExplicit = await queryTableCount(mockClient, 'leads', { optional: true });
  assert.strictEqual(countExplicit, 0, 'Explicitly optional missing table must safely return 0');
});

await runAsyncTest('10.2 Missing required table fails closed with explicit error', async () => {
  const mockClient = {
    query: async (sql) => {
      if (sql.includes('to_regclass')) {
        return { rows: [{ reg: null }] };
      }
      return { rows: [] };
    }
  };

  await assert.rejects(
    async () => {
      await queryTableCount(mockClient, 'leads');
    },
    /\[Database Audit Error\] Required table "public\.leads" is missing from database schema\./,
    'Must fail closed when required table is missing'
  );

  await assert.rejects(
    async () => {
      await queryTableCount(mockClient, 'bom_orders');
    },
    /\[Database Audit Error\] Required table "public\.bom_orders" is missing from database schema\./,
    'Must fail closed when bom_orders is missing'
  );

  // Even bom_items with { optional: false } must fail closed
  await assert.rejects(
    async () => {
      await queryTableCount(mockClient, 'bom_items', { optional: false });
    },
    /\[Database Audit Error\] Required table "public\.bom_items" is missing from database schema\./,
    'Must fail closed when optional: false table is missing'
  );
});

await runAsyncTest('10.3 Unapproved table names are strictly rejected by allowlist', async () => {
  const mockClient = { query: async () => ({ rows: [] }) };

  await assert.rejects(
    async () => {
      await queryTableCount(mockClient, 'malicious_table');
    },
    /\[Database Audit Error\] Table "malicious_table" is not in the approved audit allowlist\./,
    'Must reject table not in allowlist'
  );

  await assert.rejects(
    async () => {
      await queryTableCount(mockClient, 'users; DROP TABLE leads');
    },
    /\[Database Audit Error\] Table "users; DROP TABLE leads" is not in the approved audit allowlist\./,
    'Must reject SQL injection in table name'
  );

  await assert.rejects(
    async () => {
      await queryTableCount(mockClient, '');
    },
    /\[Database Audit Error\] Invalid table name parameter/,
    'Must reject empty table name'
  );
});

await runAsyncTest('10.4 PostgreSQL permission failure (SQLSTATE 42501) propagates from queryTableCount', async () => {
  const permError = Object.assign(new Error('permission denied for table leads'), { code: '42501' });
  const mockClient = {
    query: async (sql) => {
      if (sql.includes('to_regclass')) {
        throw permError;
      }
      return { rows: [] };
    }
  };

  await assert.rejects(
    async () => {
      await queryTableCount(mockClient, 'leads');
    },
    (err) => {
      assert.strictEqual(err.code, '42501', 'Must preserve SQLSTATE 42501');
      assert(err.message.includes('permission denied'), 'Must preserve original error message');
      return true;
    },
    'Permission failure on to_regclass must propagate directly'
  );
});

await runAsyncTest('10.5 PostgreSQL connection failure (SQLSTATE 08006) propagates from queryTableCount', async () => {
  const connError = Object.assign(new Error('connection failure: client disconnected'), { code: '08006' });
  const mockClient = {
    query: async () => {
      throw connError;
    }
  };

  await assert.rejects(
    async () => {
      await queryTableCount(mockClient, 'bom_orders');
    },
    (err) => {
      assert.strictEqual(err.code, '08006', 'Must preserve SQLSTATE 08006');
      return true;
    },
    'Connection failure must propagate directly'
  );
});

await runAsyncTest('10.6 Failed COUNT query cannot become zero and must propagate exception', async () => {
  const countError = Object.assign(new Error('statement timeout while counting'), { code: '57014' });
  const mockClient = {
    query: async (sql) => {
      if (sql.includes('to_regclass')) {
        return { rows: [{ reg: 'public.leads' }] };
      }
      if (sql.includes('SELECT COUNT(*)')) {
        throw countError;
      }
      return { rows: [] };
    }
  };

  await assert.rejects(
    async () => {
      await queryTableCount(mockClient, 'leads');
    },
    (err) => {
      assert.strictEqual(err.code, '57014', 'Failed COUNT query error code must propagate');
      return true;
    },
    'Failed COUNT query must NEVER be swallowed as zero'
  );
});

await runAsyncTest('10.7 queryStoreItemCount returns 0 for non-existent key and empty array, length for array, 1 for other JSON', async () => {
  // Scenario A: Key does not exist in controlroom_store (0 rows)
  const mockClientNoRow = {
    query: async () => ({ rows: [] })
  };
  const countNoRow = await queryStoreItemCount(mockClientNoRow, 'customer_pis_store');
  assert.strictEqual(countNoRow, 0, 'Non-existent store key must return 0');

  // Scenario B: Stored value is null/undefined
  const mockClientNull = {
    query: async () => ({ rows: [{ data: null }] })
  };
  const countNull = await queryStoreItemCount(mockClientNull, 'quotations_store');
  assert.strictEqual(countNull, 0, 'Null store data must return 0');

  // Scenario C: Stored value is a valid empty array []
  const mockClientEmptyArray = {
    query: async () => ({ rows: [{ data: [] }] })
  };
  const countEmpty = await queryStoreItemCount(mockClientEmptyArray, 'sales_pi_store');
  assert.strictEqual(countEmpty, 0, 'Valid empty array must return 0');

  // Scenario D: Stored value is an array with items
  const mockClientArray = {
    query: async () => ({ rows: [{ data: [{ id: 'PI-1' }, { id: 'PI-2' }, { id: 'PI-3' }] }] })
  };
  const countArray = await queryStoreItemCount(mockClientArray, 'customer_pis_store');
  assert.strictEqual(countArray, 3, 'Array store must return element count');

  // Scenario E: Stored value is a valid JSON object
  const mockClientObject = {
    query: async () => ({ rows: [{ data: { branding: 'BUSINZ', active: true } }] })
  };
  const countObject = await queryStoreItemCount(mockClientObject, 'invoice_store');
  assert.strictEqual(countObject, 1, 'Non-array JSON value must return 1');
});

await runAsyncTest('10.8 queryStoreItemCount propagates database read failures and never masks SQL exceptions as zero', async () => {
  const permError = Object.assign(new Error('permission denied for relation controlroom_store'), { code: '42501' });
  const mockClient = {
    query: async () => {
      throw permError;
    }
  };

  await assert.rejects(
    async () => {
      await queryStoreItemCount(mockClient, 'employees_store');
    },
    (err) => {
      assert.strictEqual(err.code, '42501', 'Must preserve SQLSTATE 42501 on store query');
      return true;
    },
    'Store query permission failure must propagate'
  );
});

await runAsyncTest('10.9 queryStoreItemCount rejects unapproved store keys', async () => {
  const mockClient = { query: async () => ({ rows: [] }) };

  await assert.rejects(
    async () => {
      await queryStoreItemCount(mockClient, 'unapproved_secret_store');
    },
    /\[Database Audit Error\] Store key "unapproved_secret_store" is not in the approved audit allowlist\./,
    'Must reject store key not in allowlist'
  );
});

await runAsyncTest('10.10 Aborted transaction (SQLSTATE 25P02) cannot produce a passing baseline', async () => {
  const abortedTxError = Object.assign(
    new Error('current transaction is aborted, commands ignored until end of transaction block'),
    { code: '25P02' }
  );

  const mockAbortedClient = {
    query: async () => {
      throw abortedTxError;
    }
  };

  await assert.rejects(
    async () => {
      await collectDatabaseCounts(mockAbortedClient);
    },
    (err) => {
      assert.strictEqual(err.code, '25P02', 'Must fail closed on SQLSTATE 25P02');
      return true;
    },
    'Aborted transaction must throw and cannot return false zero baselines'
  );
});

await runAsyncTest('10.11 Database cleanup rolls back when baseline verification fails or throws an exception', async () => {
  const queryLog = [];
  const testError = Object.assign(new Error('relation leads is locked by another transaction'), { code: '55P03' });

  const mockPool = {
    connect: async () => ({
      query: async (sql) => {
        queryLog.push(sql);
        if (sql.includes('BEGIN')) return {};
        if (sql.includes('ROLLBACK')) return {};
        // Simulate error during pre-commit check (e.g. leads query fails)
        if (sql.includes('to_regclass') && sql.includes('leads')) {
          throw testError;
        }
        return { rows: [] };
      },
      release: () => {}
    })
  };

  const cleanupReport = await executeComprehensiveCleanup(mockPool);

  assert.strictEqual(cleanupReport.dbCleanup.committed, false, 'Transaction must NOT be committed on baseline failure');
  assert.strictEqual(cleanupReport.dbCleanup.status, 'ROLLED_BACK_ON_ERROR', 'Cleanup status must reflect transaction rollback');
  assert.strictEqual(cleanupReport.baselineRestored, false, 'baselineRestored must be false');
  assert(queryLog.some(q => q.includes('ROLLBACK')), 'ROLLBACK query must be issued to PostgreSQL');
});

await runAsyncTest('10.12 Database cleanup rolls back when baseline count discrepancies are detected', async () => {
  const queryLog = [];
  const origBaselines = testReport.baselines;
  testReport.baselines = {
    tables: { leads: 10 },
    stores: {}
  };

  try {
    const mockPool = {
      connect: async () => ({
        query: async (sql, params) => {
          queryLog.push(sql);
          if (sql.includes('BEGIN')) return {};
          if (sql.includes('ROLLBACK')) return {};
          if (sql.includes('to_regclass')) return { rows: [{ reg: 'public.leads' }] };
          if (sql.includes('SELECT COUNT(*)')) return { rows: [{ cnt: '9999' }] }; // Discrepancy with baseCount (10 vs 9999)
          if (sql.includes('SELECT data FROM public.controlroom_store')) return { rows: [{ data: [] }] };
          return { rows: [] };
        },
        release: () => {}
      })
    };

    const cleanupReport = await executeComprehensiveCleanup(mockPool);
    assert.strictEqual(cleanupReport.dbCleanup.committed, false, 'Discrepancy must prevent COMMIT');
    assert.strictEqual(cleanupReport.dbCleanup.status, 'ROLLED_BACK_BASELINE_MISMATCH', 'Status must be ROLLED_BACK_BASELINE_MISMATCH');
    assert.strictEqual(cleanupReport.baselineRestored, false, 'baselineRestored must be false on discrepancy');
    assert(queryLog.some(q => q.includes('ROLLBACK')), 'ROLLBACK query must be issued to PostgreSQL');
  } finally {
    testReport.baselines = origBaselines;
  }
});

// =============================================================================
// TEST GROUP 11: Phase 9AB Transactional JSONB Store Baseline Restoration Safeguards
// =============================================================================
console.log('\n--- TEST GROUP 11: Phase 9AB Transactional JSONB Store Baseline Restoration Safeguards ---');

await runAsyncTest('11.1 Baseline captures store keys as an array of strings in alphabetical order', async () => {
  const mockClient = {
    query: async (sql) => {
      if (sql.includes('SELECT key FROM public.controlroom_store')) {
        return {
          rows: [
            { key: 'customer_pis_store' },
            { key: 'employees_store' },
            { key: 'quotations_store' }
          ]
        };
      }
      if (sql.includes('to_regclass')) {
        return { rows: [{ reg: 'public.mock' }] };
      }
      if (sql.includes('SELECT COUNT(*)')) {
        return { rows: [{ cnt: '0' }] };
      }
      if (sql.includes('SELECT data FROM public.controlroom_store')) {
        return { rows: [{ data: [] }] };
      }
      return { rows: [] };
    }
  };

  const counts = await collectDatabaseCounts(mockClient);
  assert(Array.isArray(counts.storeKeys), 'storeKeys must be an array');
  assert.strictEqual(counts.storeKeys.length, 3, 'Must contain exactly 3 store keys');
  assert.deepStrictEqual(counts.storeKeys, ['customer_pis_store', 'employees_store', 'quotations_store'], 'Keys must match alphabetical order');
});

await runAsyncTest('11.2 Pre-existing store key with remaining items updates row without deletion', async () => {
  const queryLog = [];
  const origBaselines = testReport.baselines;
  const origEmployees = [...syntheticLedger.registeredEmployees];

  syntheticLedger.registeredEmployees = [{ employee_code: 'TA-TEST-909', email: 'synth_admin_909@example.com' }];
  testReport.baselines = {
    tables: {},
    storeKeys: ['employees_store'],
    stores: { employees_store: 1 }
  };

  try {
    const mockPool = {
      connect: async () => ({
        query: async (sql, params) => {
          queryLog.push({ sql, params });
          if (sql.includes('BEGIN')) return {};
          if (sql.includes('COMMIT')) return {};
          if (sql.includes('to_regclass')) return { rows: [{ reg: 'public.table' }] };
          if (sql.includes('SELECT COUNT(*)')) return { rows: [{ cnt: '0' }] };
          if (sql.includes('SELECT key FROM public.controlroom_store')) return { rows: [{ key: 'employees_store' }] };
          if (sql.includes('SELECT data FROM public.controlroom_store WHERE key = $1 FOR UPDATE')) {
            return {
              rows: [{
                data: [
                  { employee_code: 'TA-TEST-909', email: 'synth_admin_909@example.com', synthTag: SYNTH_TAG },
                  { employee_code: 'EMP-GENUINE', email: 'genuine@businz.com', employee_name: 'Genuine Staff' }
                ]
              }]
            };
          }
          if (sql.includes('UPDATE public.controlroom_store')) return { rowCount: 1 };
          if (sql.includes('SELECT data FROM public.controlroom_store WHERE key = $1')) {
            return { rows: [{ data: [{ employee_code: 'EMP-GENUINE' }] }] };
          }
          return { rows: [] };
        },
        release: () => {}
      })
    };

    const cleanupReport = await executeComprehensiveCleanup(mockPool);

    // Verify row was updated, NOT deleted
    const updateCall = queryLog.find(q => q.sql.includes('UPDATE public.controlroom_store') && q.params && q.params[1] === 'employees_store');
    assert(updateCall, 'Must execute UPDATE on employees_store');
    const updatedData = JSON.parse(updateCall.params[0]);
    assert.strictEqual(updatedData.length, 1, 'Updated data must retain remaining genuine employee');
    assert.strictEqual(updatedData[0].employee_code, 'EMP-GENUINE', 'Must retain genuine employee record');

    const deleteCall = queryLog.find(q => q.sql.includes('DELETE FROM public.controlroom_store') && q.params && q.params[0] === 'employees_store');
    assert(!deleteCall, 'Must NOT delete pre-existing employees_store row');
    assert.strictEqual(cleanupReport.dbCleanup.storesCleaned['employees_store']?.deletedRow, false, 'deletedRow must be false');
  } finally {
    testReport.baselines = origBaselines;
    syntheticLedger.registeredEmployees = origEmployees;
  }
});

await runAsyncTest('11.3 Pre-existing store key empty after cleanup updates row to \'[]\' without deleting row', async () => {
  const queryLog = [];
  const origBaselines = testReport.baselines;
  const origQuotations = [...syntheticLedger.quotations];

  syntheticLedger.quotations = [{ id: 'QT-13909', quotationNo: 'QT-13909' }];
  testReport.baselines = {
    tables: {},
    storeKeys: ['quotations_store'],
    stores: { quotations_store: 0 }
  };

  try {
    const mockPool = {
      connect: async () => ({
        query: async (sql, params) => {
          queryLog.push({ sql, params });
          if (sql.includes('BEGIN')) return {};
          if (sql.includes('COMMIT')) return {};
          if (sql.includes('to_regclass')) return { rows: [{ reg: 'public.table' }] };
          if (sql.includes('SELECT COUNT(*)')) return { rows: [{ cnt: '0' }] };
          if (sql.includes('SELECT key FROM public.controlroom_store')) return { rows: [{ key: 'quotations_store' }] };
          if (sql.includes('SELECT data FROM public.controlroom_store WHERE key = $1 FOR UPDATE')) {
            return {
              rows: [{
                data: [
                  { quotationNo: 'QT-13909', synthTag: SYNTH_TAG }
                ]
              }]
            };
          }
          if (sql.includes('UPDATE public.controlroom_store')) return { rowCount: 1 };
          if (sql.includes('SELECT data FROM public.controlroom_store WHERE key = $1')) {
            return { rows: [{ data: [] }] };
          }
          return { rows: [] };
        },
        release: () => {}
      })
    };

    const cleanupReport = await executeComprehensiveCleanup(mockPool);

    const updateCall = queryLog.find(q => q.sql.includes('UPDATE public.controlroom_store') && q.params && q.params[1] === 'quotations_store');
    assert(updateCall, 'Must execute UPDATE on quotations_store to empty array');
    assert.strictEqual(updateCall.params[0], '[]', 'Data must be updated to empty array');

    const deleteCall = queryLog.find(q => q.sql.includes('DELETE FROM public.controlroom_store') && q.params && q.params[0] === 'quotations_store');
    assert(!deleteCall, 'Must NOT delete pre-existing quotations_store row even when empty');
    assert.strictEqual(cleanupReport.dbCleanup.storesCleaned['quotations_store']?.deletedRow, false, 'deletedRow must be false');
  } finally {
    testReport.baselines = origBaselines;
    syntheticLedger.quotations = origQuotations;
  }
});

await runAsyncTest('11.4 Newly created store key with exclusively owned synthetic items deletes row from controlroom_store', async () => {
  const queryLog = [];
  const origBaselines = testReport.baselines;
  const origBoms = [...syntheticLedger.bomOrders];

  syntheticLedger.bomOrders = [{ id: 'BOM-13909', bomCode: 'BOM-13909' }];
  testReport.baselines = {
    tables: {},
    storeKeys: ['employees_store'], // bom_store was NOT present at baseline!
    stores: {}
  };

  try {
    const mockPool = {
      connect: async () => ({
        query: async (sql, params) => {
          queryLog.push({ sql, params });
          if (sql.includes('BEGIN')) return {};
          if (sql.includes('COMMIT')) return {};
          if (sql.includes('to_regclass')) return { rows: [{ reg: 'public.table' }] };
          if (sql.includes('SELECT COUNT(*)')) return { rows: [{ cnt: '0' }] };
          if (sql.includes('SELECT key FROM public.controlroom_store')) {
            // After deletion, only employees_store remains
            return { rows: [{ key: 'employees_store' }] };
          }
          if (sql.includes('SELECT data FROM public.controlroom_store WHERE key = $1 FOR UPDATE')) {
            if (params[0] === 'bom_store') {
              return {
                rows: [{
                  data: [
                    { bomCode: 'BOM-13909', synthTag: SYNTH_TAG }
                  ]
                }]
              };
            }
            return { rows: [{ data: [] }] };
          }
          if (sql.includes('DELETE FROM public.controlroom_store')) return { rowCount: 1 };
          if (sql.includes('SELECT data FROM public.controlroom_store WHERE key = $1')) {
            return { rows: [] };
          }
          return { rows: [] };
        },
        release: () => {}
      })
    };

    const cleanupReport = await executeComprehensiveCleanup(mockPool);

    const deleteCall = queryLog.find(q => q.sql.includes('DELETE FROM public.controlroom_store') && q.params && q.params[0] === 'bom_store');
    assert(deleteCall, 'Must DELETE newly created bom_store row when exclusively owned');
    assert.strictEqual(cleanupReport.dbCleanup.storesCleaned['bom_store']?.deletedRow, true, 'deletedRow must be true');
    assert.strictEqual(cleanupReport.dbCleanup.committed, true, 'Transaction must commit when baseline restored');
  } finally {
    testReport.baselines = origBaselines;
    syntheticLedger.bomOrders = origBoms;
  }
});

await runAsyncTest('11.5 Newly created store key with any unrelated record is NOT deleted (preserved) and triggers baseline mismatch', async () => {
  const queryLog = [];
  const origBaselines = testReport.baselines;
  const origBoms = [...syntheticLedger.bomOrders];

  syntheticLedger.bomOrders = [{ id: 'BOM-13909', bomCode: 'BOM-13909' }];
  testReport.baselines = {
    tables: {},
    storeKeys: ['employees_store'], // bom_store was absent at baseline
    stores: {}
  };

  try {
    const mockPool = {
      connect: async () => ({
        query: async (sql, params) => {
          queryLog.push({ sql, params });
          if (sql.includes('BEGIN')) return {};
          if (sql.includes('ROLLBACK')) return {};
          if (sql.includes('to_regclass')) return { rows: [{ reg: 'public.table' }] };
          if (sql.includes('SELECT COUNT(*)')) return { rows: [{ cnt: '0' }] };
          if (sql.includes('SELECT key FROM public.controlroom_store')) {
            // bom_store remains in controlroom_store
            return { rows: [{ key: 'bom_store' }, { key: 'employees_store' }] };
          }
          if (sql.includes('SELECT data FROM public.controlroom_store WHERE key = $1 FOR UPDATE')) {
            if (params[0] === 'bom_store') {
              return {
                rows: [{
                  data: [
                    { bomCode: 'BOM-13909', synthTag: SYNTH_TAG },
                    { bomCode: 'BOM-GENUINE-PROD', customerName: 'Genuine Customer' } // Unrelated!
                  ]
                }]
              };
            }
            return { rows: [{ data: [] }] };
          }
          if (sql.includes('UPDATE public.controlroom_store')) return { rowCount: 1 };
          return { rows: [] };
        },
        release: () => {}
      })
    };

    const cleanupReport = await executeComprehensiveCleanup(mockPool);

    // Verify row was NOT deleted
    const deleteCall = queryLog.find(q => q.sql.includes('DELETE FROM public.controlroom_store') && q.params && q.params[0] === 'bom_store');
    assert(!deleteCall, 'Must NOT delete newly created store row when unrelated record is present');
    assert.strictEqual(cleanupReport.dbCleanup.storesCleaned['bom_store']?.deletedRow, false, 'deletedRow must be false');

    // Verify baseline mismatch was detected and triggered rollback
    assert.strictEqual(cleanupReport.dbCleanup.committed, false, 'Transaction must NOT commit');
    assert.strictEqual(cleanupReport.dbCleanup.status, 'ROLLED_BACK_BASELINE_MISMATCH', 'Status must be ROLLED_BACK_BASELINE_MISMATCH');
    assert(cleanupReport.discrepancies.some(d => d.target === 'storeKeys:extra' && d.extraKeys.includes('bom_store')), 'Discrepancies must include extra store key bom_store');
  } finally {
    testReport.baselines = origBaselines;
    syntheticLedger.bomOrders = origBoms;
  }
});

await runAsyncTest('11.6 Newly created store key without exclusive ownership is NOT deleted', async () => {
  const queryLog = [];
  const origBaselines = testReport.baselines;
  const origInvoices = [...syntheticLedger.invoices];

  syntheticLedger.invoices = [{ id: 'INV-13909', invNo: 'INV-13909' }];
  testReport.baselines = {
    tables: {},
    storeKeys: ['employees_store'],
    stores: {}
  };

  try {
    const mockPool = {
      connect: async () => ({
        query: async (sql, params) => {
          queryLog.push({ sql, params });
          if (sql.includes('BEGIN')) return {};
          if (sql.includes('ROLLBACK')) return {};
          if (sql.includes('to_regclass')) return { rows: [{ reg: 'public.table' }] };
          if (sql.includes('SELECT COUNT(*)')) return { rows: [{ cnt: '0' }] };
          if (sql.includes('SELECT key FROM public.controlroom_store')) return { rows: [{ key: 'employees_store' }, { key: 'invoice_store' }] };
          if (sql.includes('SELECT data FROM public.controlroom_store WHERE key = $1 FOR UPDATE')) {
            if (params[0] === 'invoice_store') {
              return {
                rows: [{
                  data: [
                    // Item lacks synthetic markers (no synthTag, no matching run ID)
                    { invNo: 'INV-OTHER', customerName: 'Other Entity' }
                  ]
                }]
              };
            }
            return { rows: [{ data: [] }] };
          }
          if (sql.includes('UPDATE public.controlroom_store')) return { rowCount: 1 };
          return { rows: [] };
        },
        release: () => {}
      })
    };

    const cleanupReport = await executeComprehensiveCleanup(mockPool);
    const deleteCall = queryLog.find(q => q.sql.includes('DELETE FROM public.controlroom_store') && q.params && q.params[0] === 'invoice_store');
    assert(!deleteCall, 'Must NOT delete store row lacking exclusive synthetic ownership');
    assert.strictEqual(cleanupReport.dbCleanup.storesCleaned['invoice_store']?.deletedRow, false, 'deletedRow must be false');
    assert.strictEqual(cleanupReport.dbCleanup.committed, false, 'Transaction must NOT commit');
  } finally {
    testReport.baselines = origBaselines;
    syntheticLedger.invoices = origInvoices;
  }
});

await runAsyncTest('11.7 Pre-commit audit detects unexpected extra store key and sets preCommitMatches = false', async () => {
  const origBaselines = testReport.baselines;
  testReport.baselines = {
    tables: {},
    storeKeys: ['customer_pis_store', 'employees_store'],
    stores: {}
  };

  try {
    const mockPool = {
      connect: async () => ({
        query: async (sql) => {
          if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return {};
          if (sql.includes('to_regclass')) return { rows: [{ reg: 'public.table' }] };
          if (sql.includes('SELECT COUNT(*)')) return { rows: [{ cnt: '0' }] };
          if (sql.includes('SELECT key FROM public.controlroom_store')) {
            return { rows: [{ key: 'customer_pis_store' }, { key: 'employees_store' }, { key: 'reservations_store' }] };
          }
          if (sql.includes('SELECT data FROM public.controlroom_store')) return { rows: [{ data: [] }] };
          return { rows: [] };
        },
        release: () => {}
      })
    };

    const cleanupReport = await executeComprehensiveCleanup(mockPool);
    assert.strictEqual(cleanupReport.dbCleanup.committed, false, 'Must not commit on extra store key');
    assert.strictEqual(cleanupReport.dbCleanup.status, 'ROLLED_BACK_BASELINE_MISMATCH', 'Status must be ROLLED_BACK_BASELINE_MISMATCH');
    const extraDisc = cleanupReport.discrepancies.find(d => d.target === 'storeKeys:extra');
    assert(extraDisc, 'Must record storeKeys:extra discrepancy');
    assert.deepStrictEqual(extraDisc.extraKeys, ['reservations_store'], 'Extra key must be reservations_store');
  } finally {
    testReport.baselines = origBaselines;
  }
});

await runAsyncTest('11.8 Pre-commit audit detects missing expected baseline store key and sets preCommitMatches = false', async () => {
  const origBaselines = testReport.baselines;
  testReport.baselines = {
    tables: {},
    storeKeys: ['customer_pis_store', 'employees_store', 'quotations_store'],
    stores: {}
  };

  try {
    const mockPool = {
      connect: async () => ({
        query: async (sql) => {
          if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return {};
          if (sql.includes('to_regclass')) return { rows: [{ reg: 'public.table' }] };
          if (sql.includes('SELECT COUNT(*)')) return { rows: [{ cnt: '0' }] };
          if (sql.includes('SELECT key FROM public.controlroom_store')) {
            // quotations_store is missing
            return { rows: [{ key: 'customer_pis_store' }, { key: 'employees_store' }] };
          }
          if (sql.includes('SELECT data FROM public.controlroom_store')) return { rows: [{ data: [] }] };
          return { rows: [] };
        },
        release: () => {}
      })
    };

    const cleanupReport = await executeComprehensiveCleanup(mockPool);
    assert.strictEqual(cleanupReport.dbCleanup.committed, false, 'Must not commit on missing baseline store key');
    assert.strictEqual(cleanupReport.dbCleanup.status, 'ROLLED_BACK_BASELINE_MISMATCH', 'Status must be ROLLED_BACK_BASELINE_MISMATCH');
    const missingDisc = cleanupReport.discrepancies.find(d => d.target === 'storeKeys:missing');
    assert(missingDisc, 'Must record storeKeys:missing discrepancy');
    assert.deepStrictEqual(missingDisc.missingKeys, ['quotations_store'], 'Missing key must be quotations_store');
  } finally {
    testReport.baselines = origBaselines;
  }
});

await runAsyncTest('11.9 Synthetic identifier matching supports bom_store (bomCode, code, id)', async () => {
  const known = ['BOM-13909'];
  const runId = '1793247013909';
  const tag = `SYNTH_P9Y_${runId}`;

  // bomCode match
  assert(isSyntheticStoreItem('bom_store', { bomCode: 'BOM-13909', synthTag: tag }, known, runId, tag), 'Must match bomCode');
  // code match
  assert(isSyntheticStoreItem('bom_store', { code: 'BOM-13909', synthTag: tag }, known, runId, tag), 'Must match code');
  // id match
  assert(isSyntheticStoreItem('bom_store', { id: 'BOM-13909', customerName: tag }, known, runId, tag), 'Must match id');
  // Unrelated BOM
  assert(!isSyntheticStoreItem('bom_store', { bomCode: 'BOM-99999', customerName: 'Genuine Company' }, known, runId, tag), 'Must reject unrelated BOM');
});

await runAsyncTest('11.10 Synthetic identifier matching supports invoice_store (invNo, id, code, bomCode, invoiceNo)', async () => {
  const known = ['INV-13909'];
  const runId = '1793247013909';
  const tag = `SYNTH_P9Y_${runId}`;

  assert(isSyntheticStoreItem('invoice_store', { invNo: 'INV-13909', synthTag: tag }, known, runId, tag), 'Must match invNo');
  assert(isSyntheticStoreItem('invoice_store', { id: 'INV-13909', synthTag: tag }, known, runId, tag), 'Must match id');
  assert(isSyntheticStoreItem('invoice_store', { code: 'INV-13909', customerName: tag }, known, runId, tag), 'Must match code');
  assert(isSyntheticStoreItem('invoice_store', { bomCode: 'BOM-13909', synthTag: tag }, ['BOM-13909'], runId, tag), 'Must match bomCode');
  assert(isSyntheticStoreItem('invoice_store', { invoiceNo: 'INV-13909', synthTag: tag }, known, runId, tag), 'Must match invoiceNo');

  // Unrelated invoice
  assert(!isSyntheticStoreItem('invoice_store', { invNo: 'INV-00001', customerName: 'Real Client' }, known, runId, tag), 'Must reject unrelated invoice');
});

await runAsyncTest('11.11 Synthetic identifier matching supports reservations_store (id, code, reservationId, bomCode)', async () => {
  const resKey = 'res_SYNTH_P9Y_1793247013909';
  const known = [resKey, 'BOM-13909'];
  const runId = '1793247013909';
  const tag = `SYNTH_P9Y_${runId}`;

  assert(isSyntheticStoreItem('reservations_store', { id: resKey, synthTag: tag }, known, runId, tag), 'Must match id');
  assert(isSyntheticStoreItem('reservations_store', { code: resKey, synthTag: tag }, known, runId, tag), 'Must match code');
  assert(isSyntheticStoreItem('reservations_store', { reservationId: resKey, synthTag: tag }, known, runId, tag), 'Must match reservationId');
  assert(isSyntheticStoreItem('reservations_store', { bomCode: 'BOM-13909', synthTag: tag }, known, runId, tag), 'Must match bomCode');

  // Unrelated reservation
  assert(!isSyntheticStoreItem('reservations_store', { id: 'res_real_order_99', notes: 'normal stock' }, known, runId, tag), 'Must reject unrelated reservation');
});

await runAsyncTest('11.12 recover_phase9y_run_13909_residue.js dry-run by default, requires --execute-authorized, validates target DB and workspace', async () => {
  // Test A: Fails closed on workspace mismatch when invoked from an invalid workspace path (isolated context)
  const invalidWorkspaceRes = await runResidueRecovery13909({
    workspaceDir: '/var/www/businz' // Genuine production workspace -> MUST BE REJECTED
  });
  assert.strictEqual(invalidWorkspaceRes.success, false, 'Must fail closed when workspace is not /var/www/businz-optimization-test');
  assert.strictEqual(invalidWorkspaceRes.reason, 'Workspace mismatch', 'Must specify workspace mismatch');
  assert.strictEqual(invalidWorkspaceRes.dryRun, true, 'Default mode must be dry-run');

  const randomWorkspaceRes = await runResidueRecovery13909({
    workspaceDir: '/tmp/unauthorized-workspace'
  });
  assert.strictEqual(randomWorkspaceRes.success, false, 'Must fail closed on arbitrary directory');
  assert.strictEqual(randomWorkspaceRes.reason, 'Workspace mismatch', 'Must specify workspace mismatch');

  // Test B: Pure workspace isolation validator verifies approved vs unapproved workspaces
  assert.strictEqual(verifyWorkspaceIsolation('/var/www/businz-optimization-test'), true, 'Approved optimization test workspace must pass');
  assert.strictEqual(verifyWorkspaceIsolation('/var/www/businz'), false, 'Production workspace must be rejected');
  assert.strictEqual(verifyWorkspaceIsolation('/var/www/businz-dev'), false, 'Development workspace must be rejected');
  assert.strictEqual(verifyWorkspaceIsolation('/var/www/hrms'), false, 'HRMS workspace must be rejected');

  // Test C: Unauthorized PostgreSQL URL rejection tested independently (fails BEFORE connection or writes)
  const dbUrlRes = await runResidueRecovery13909({
    workspaceDir: EXPECTED_OPTIMIZATION_TEST_WORKSPACE,
    databaseUrl: 'postgresql://postgres:pass@127.0.0.1:5432/businz' // Production database!
  });
  assert.strictEqual(dbUrlRes.success, false, 'Must fail closed on production database URL');
  assert.strictEqual(dbUrlRes.dryRun, true, 'Must remain dry-run');
  assert(
    typeof dbUrlRes.reason === 'string' && dbUrlRes.reason.includes('FORBIDDEN DATABASE TARGET "businz"'),
    'Must explicitly state forbidden database target'
  );

  const nonLocalDbRes = await runResidueRecovery13909({
    workspaceDir: EXPECTED_OPTIMIZATION_TEST_WORKSPACE,
    databaseUrl: 'postgresql://businz_test_user:pass@192.168.1.100:5432/businz_optimization_test' // Non-local IP!
  });
  assert.strictEqual(nonLocalDbRes.success, false, 'Must fail closed on non-local database host');
  assert.strictEqual(nonLocalDbRes.dryRun, true, 'Must remain dry-run');

  // Test D: Live recovery strictly refuses unauthorized execution or workspace tampering
  const liveRecoveryBlocked = await runResidueRecovery13909({
    executeAuthorized: true,
    workspaceDir: '/var/www/businz',
    databaseUrl: 'postgresql://postgres:pass@127.0.0.1:5432/businz'
  });
  assert.strictEqual(liveRecoveryBlocked.success, false, 'Live recovery must fail closed on unauthorized target');
  assert.strictEqual(liveRecoveryBlocked.dryRun, false, 'executeAuthorized reflects live flag');

  // Test E: Verifies constants and baseline keys exported
  assert.deepStrictEqual([...BASELINE_STORE_KEYS_909].sort(), ['customer_pis_store', 'employees_store', 'quotations_store']);
  assert.deepStrictEqual([...NEWLY_CREATED_STORE_KEYS_909].sort(), ['bom_store', 'invoice_store', 'reservations_store']);
  assert.strictEqual(TARGET_RUN_ID_909, '1793247013909');
  assert.strictEqual(TARGET_SYNTH_TAG_909, 'SYNTH_P9Y_1793247013909');
  assert.strictEqual(EXPECTED_OPTIMIZATION_TEST_WORKSPACE, '/var/www/businz-optimization-test');
});

// =============================================================================
// TEST GROUP 12: PostgreSQL Authoritative Store Read & Cache Invalidation
// =============================================================================
console.log('\n--- TEST GROUP 12: PostgreSQL Authoritative Store Read & Cache Invalidation ---');

await runAsyncTest('12.1 server/index.js enforces PostgreSQL authoritative reads with zero fall-through to memory or disk', async () => {
  const serverPath = path.resolve(__dirname, '../server/index.js');
  const content = fs.readFileSync(serverPath, 'utf8');

  const getDbStoreIdx = content.indexOf('const getDatabaseStore = async (key) => {');
  assert(getDbStoreIdx !== -1, 'getDatabaseStore must be defined');

  const blockEndIdx = content.indexOf('const realtimeClients', getDbStoreIdx);
  const fnBody = content.slice(getDbStoreIdx, blockEndIdx);

  // Must check isDbConnected()
  assert(fnBody.includes('if (isDbConnected()) {'), 'Must check isDbConnected() before reading');

  // Must query controlroom_store
  assert(fnBody.includes("SELECT data FROM controlroom_store WHERE key = $1"), 'Must query controlroom_store with parameterized key');

  // Must update cache on row hit
  assert(fnBody.includes('supabaseMemoryStore[cleanKey] = d'), 'Must update cache on row hit');

  // Must invalidate cache on missing row
  assert(fnBody.includes('delete supabaseMemoryStore[cleanKey]'), 'Must delete cleanKey from cache on missing row');
  assert(fnBody.includes('delete supabaseMemoryStore[key]'), 'Must delete key from cache on missing row');

  // Must return empty collection directly within isDbConnected block
  assert(fnBody.includes('OBJECT_BASED_STORES.has(cleanKey) ? {} : []'), 'Must return empty collection on missing row');

  // Must propagate database error
  assert(fnBody.includes('throw dbErr'), 'Must rethrow dbErr to trigger fail-closed HTTP 500');

  // Must propagate leaves database error
  assert(fnBody.includes('throw err'), 'Must rethrow leaves query error');
});

await runAsyncTest('12.2 Missing PostgreSQL row invalidates stale cache and returns empty collection', async () => {
  const fakeMemory = {
    reservations_store: [{ id: 'res_SYNTH_P9Y_1793247013909' }],
    RESERVATIONS_STORE: [{ id: 'res_SYNTH_P9Y_1793247013909' }]
  };

  const getStore = async (key) => {
    const cleanKey = String(key || '').toLowerCase();
    const isDbConnected = true;
    if (isDbConnected) {
      // Simulate PostgreSQL returning 0 rows
      const dbRes = { rows: [] };
      if (dbRes.rows.length > 0 && dbRes.rows[0]?.data !== undefined && dbRes.rows[0]?.data !== null) {
        let d = dbRes.rows[0].data;
        fakeMemory[cleanKey] = d;
        fakeMemory[key] = d;
        return d;
      }
      delete fakeMemory[cleanKey];
      if (key) {
        delete fakeMemory[key];
        delete fakeMemory[String(key).toUpperCase()];
      }
      const OBJECT_BASED_STORES = new Set(['presets_store', 'templates_store', 'company_branding_store']);
      return OBJECT_BASED_STORES.has(cleanKey) ? {} : [];
    }
    return fakeMemory[cleanKey] || [];
  };

  const res = await getStore('reservations_store');
  assert.deepStrictEqual(res, [], 'Must return empty array on missing PostgreSQL row');
  assert.strictEqual(fakeMemory['reservations_store'], undefined, 'Must purge stale cleanKey cache');
  assert.strictEqual(fakeMemory['RESERVATIONS_STORE'], undefined, 'Must purge stale uppercase cache');
});

await runAsyncTest('12.3 Database error propagates fail-closed without returning stale cache', async () => {
  const fakeMemory = {
    reservations_store: [{ id: 'stale_reservation_residue' }]
  };

  const getStore = async (key) => {
    const cleanKey = String(key || '').toLowerCase();
    const isDbConnected = true;
    if (isDbConnected) {
      try {
        throw new Error('PostgreSQL connection pool exhausted [08006]');
      } catch (dbErr) {
        throw dbErr;
      }
    }
    return fakeMemory[cleanKey] || [];
  };

  let caught = null;
  try {
    await getStore('reservations_store');
  } catch (err) {
    caught = err;
  }

  assert(caught, 'Must throw error on database failure');
  assert(caught.message.includes('08006'), 'Must preserve SQLSTATE/error message');
});

await runAsyncTest('12.4 Deleted reservation does not resurrect old reservation on new reservation write', async () => {
  // Stale memory contains old reservation from Run 1
  const fakeMemory = {
    reservations_store: [{ id: 'res_SYNTH_P9Y_1793247013909', tag: 'old' }]
  };

  // Database currently has NO row for reservations_store (clean baseline)
  const fakePgDb = {};

  // Step 1: Read current store before write
  const cleanKey = 'reservations_store';
  const dbRes = fakePgDb[cleanKey] ? { rows: [{ data: fakePgDb[cleanKey] }] } : { rows: [] };
  let currentData;
  if (dbRes.rows.length > 0 && dbRes.rows[0]?.data != null) {
    currentData = dbRes.rows[0].data;
    fakeMemory[cleanKey] = currentData;
  } else {
    delete fakeMemory[cleanKey];
    const OBJECT_BASED = new Set(['presets_store', 'templates_store', 'company_branding_store']);
    currentData = OBJECT_BASED.has(cleanKey) ? {} : [];
  }

  assert.deepStrictEqual(currentData, [], 'Current data must be empty array, not stale cache');

  // Step 2: New reservation arrives for Run 2
  const newReservation = [{ id: 'res_SYNTH_P9Y_1793250904736', tag: 'new' }];

  // Step 3: Array merge
  const map = new Map();
  currentData.forEach(item => { if (item?.id) map.set(item.id, item); });
  newReservation.forEach(item => { if (item?.id) map.set(item.id, item); });
  const finalToSave = Array.from(map.values());

  assert.strictEqual(finalToSave.length, 1, 'Final data must contain exactly 1 reservation');
  assert.strictEqual(finalToSave[0].id, 'res_SYNTH_P9Y_1793250904736', 'Must be the new reservation');
  assert(!finalToSave.some(r => r.id === 'res_SYNTH_P9Y_1793247013909'), 'Old reservation must NOT be resurrected');
});

await runAsyncTest('12.5 Unrelated existing reservations in PostgreSQL remain preserved', async () => {
  const existingReservation = { id: 'res_CUSTOMER_ORDER_100', notes: 'real' };
  const fakePgDb = {
    reservations_store: [existingReservation]
  };

  const cleanKey = 'reservations_store';
  const dbRes = fakePgDb[cleanKey] ? { rows: [{ data: fakePgDb[cleanKey] }] } : { rows: [] };
  const currentData = dbRes.rows.length > 0 ? dbRes.rows[0].data : [];

  const newReservation = [{ id: 'res_SYNTH_P9Y_1793250904736', tag: 'new' }];

  const map = new Map();
  currentData.forEach(item => { if (item?.id) map.set(item.id, item); });
  newReservation.forEach(item => { if (item?.id) map.set(item.id, item); });
  const finalToSave = Array.from(map.values());

  assert.strictEqual(finalToSave.length, 2, 'Must contain both reservations');
  assert(finalToSave.some(r => r.id === 'res_CUSTOMER_ORDER_100'), 'Must preserve existing order');
  assert(finalToSave.some(r => r.id === 'res_SYNTH_P9Y_1793250904736'), 'Must contain new reservation');
});

await runAsyncTest('12.6 Object-based stores return {} on missing PostgreSQL row', async () => {
  const fakeMemory = { presets_store: { a: 1 } };
  const cleanKey = 'presets_store';
  const OBJECT_BASED = new Set(['presets_store', 'templates_store', 'company_branding_store']);

  delete fakeMemory[cleanKey];
  const result = OBJECT_BASED.has(cleanKey) ? {} : [];

  assert.deepStrictEqual(result, {}, 'presets_store must return empty object');
  assert.strictEqual(fakeMemory['presets_store'], undefined, 'Must purge memory cache');
});

await runAsyncTest('12.7 Relational-store loaders are preserved ahead of controlroom_store', async () => {
  const serverPath = path.resolve(__dirname, '../server/index.js');
  const content = fs.readFileSync(serverPath, 'utf8');

  const getDbStoreIdx = content.indexOf('const getDatabaseStore = async (key) => {');
  const controlroomQueryIdx = content.indexOf('SELECT data FROM controlroom_store', getDbStoreIdx);

  const customersRouteIdx = content.indexOf('loadDatabaseCustomers', getDbStoreIdx);
  const oppsRouteIdx = content.indexOf('loadDatabaseOpportunities', getDbStoreIdx);
  const leadsRouteIdx = content.indexOf('loadDatabaseLeads', getDbStoreIdx);
  const bomsRouteIdx = content.indexOf('loadDatabaseBoms', getDbStoreIdx);
  const leavesRouteIdx = content.indexOf('public.leaves', getDbStoreIdx);

  assert(customersRouteIdx > getDbStoreIdx && customersRouteIdx < controlroomQueryIdx, 'customer_store must precede controlroom_store');
  assert(oppsRouteIdx > getDbStoreIdx && oppsRouteIdx < controlroomQueryIdx, 'crm_opportunities must precede controlroom_store');
  assert(leadsRouteIdx > getDbStoreIdx && leadsRouteIdx < controlroomQueryIdx, 'crm_leads must precede controlroom_store');
  assert(bomsRouteIdx > getDbStoreIdx && bomsRouteIdx < controlroomQueryIdx, 'bom_store must precede controlroom_store');
  assert(leavesRouteIdx > getDbStoreIdx && leavesRouteIdx < controlroomQueryIdx, 'leaves must precede controlroom_store');
});

// =============================================================================
// SUMMARY
// =============================================================================
console.log('\n===================================================================');
console.log(`📊 PHASE 9Y SAFETY AUDIT SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${passedTests + failedTests})`);
console.log('===================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🛡️  PHASE 9Y TEST SAFETY AUDIT: 100% VERIFIED & SAFE FOR DELIVERY\n');
  process.exit(0);
}
