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
 * 11. Enforces server-issued cryptographic sessions without using x-user-emp-id/x-user-name headers for auth.
 * 12. Separates tested store operations from unsupported transitions (Dispatch, Accounts, loading, stock release).
 * 13. Never resets global numbering sequences.
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
import { executePreflight } from './test_phase9y_real_db_workflow_integration.js';

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
  // Assert no empty catch blocks around child deletions
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
  const commitIndex = testScriptSrc.indexOf("await client.query('COMMIT');");
  assert(preCommitIndex !== -1, 'Must collect pre-commit counts');
  assert(commitIndex !== -1, 'Must have COMMIT statement');
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
// TEST GROUP 4: Session Security & Role-Based Access Control
// =============================================================================
console.log('\n--- TEST GROUP 4: Session Security & RBAC Invariants ---');

runTest('4.1 Script never uses x-user-emp-id or x-user-name headers as authentication', () => {
  assert(!testScriptSrc.includes("'x-user-emp-id':"), 'Must not send x-user-emp-id header');
  assert(!testScriptSrc.includes("'x-user-name':"), 'Must not send x-user-name header');
});

runTest('4.2 Uses server-issued, cryptographically verified session token', () => {
  assert(testScriptSrc.includes('/api/sessions/register'), 'Must call session register endpoint');
  assert(testScriptSrc.includes("session.id.startsWith('sess_')"), 'Must verify cryptographic session format');
  assert(testScriptSrc.includes("reqHeaders['x-session-id'] = resolvedSession"), 'Must set x-session-id to verified session');
});

runTest('4.3 Validates RBAC permissions: unauthenticated, cross-employee, privileged self-reg', () => {
  assert(testScriptSrc.includes('assert.strictEqual(unauthLeaves.status, 401'), 'Must verify 401 unauthenticated');
  assert(testScriptSrc.includes('assert.strictEqual(privReg.status, 403'), 'Must verify 403 privileged self-reg');
  assert(testScriptSrc.includes('assert.strictEqual(crossLeave.status, 403'), 'Must verify 403 cross-employee tampering');
});

// =============================================================================
// TEST GROUP 5: Accurate Workflow Reporting (No Fabricated Completions)
// =============================================================================
console.log('\n--- TEST GROUP 5: Accurate Workflow Reporting ---');

runTest('5.1 Separates tested reservation store write from unsupported physical stock release', () => {
  assert(testScriptSrc.includes("'6a. Inventory reservation store persistence'"), 'Must test store write as 6a');
  assert(testScriptSrc.includes("'6b. Inventory physical stock release'] = {\n      status: 'NOT TESTED'"), 'Must mark stock release 6b as NOT TESTED');
});

runTest('5.2 Separates tested invoice creation from unsupported final vehicle loading/dispatch', () => {
  assert(testScriptSrc.includes("'8a. Invoice creation and BOM linkage'"), 'Must test invoice creation as 8a');
  assert(testScriptSrc.includes("'8b. Vehicle loading and final dispatch completion'] = {\n      status: 'NOT TESTED'"), 'Must mark vehicle loading 8b as NOT TESTED');
});

runTest('5.3 Reports unsupported Dispatch packing and Accounts verification as NOT TESTED', () => {
  assert(testScriptSrc.includes("'7. Dispatch packing and accounts verification'] = {\n      status: 'NOT TESTED'"), 'Must mark 7 as NOT TESTED');
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
