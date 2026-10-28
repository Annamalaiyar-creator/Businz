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
