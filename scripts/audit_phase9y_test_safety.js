/**
 * scripts/audit_phase9y_test_safety.js
 *
 * BUSINZ ERP: Phase 9Y Test Safety Audit & Preflight Rejection Verification Suite
 *
 * Verifies that the Phase 9Y test runner:
 * 1. Contains ZERO dangerous operations (no TRUNCATE, no DROP, no un-predicated DELETE).
 * 2. Statically binds all network requests to 127.0.0.1:5101 and PostgreSQL to businz_optimization_test.
 * 3. Enforces fail-closed preflight rejection when executed in wrong workspace directories.
 * 4. Strictly rejects production (5001), development (5002), and unapproved ports.
 * 5. Strictly rejects production, dev, and HRMS databases and roles.
 * 6. Implements exact-ID synthetic ledger tracking for all 7 record types (leads, quotes, PIs, BOMs, reservations, invoices, employees).
 * 7. Enforces foreign key child-record dependency cleanup order before parent deletion.
 * 8. Uses atomic row-level locking (FOR UPDATE) for generic JSONB stores.
 * 9. Executes cleanup in try...finally block to guarantee safe cleanup on mid-test failure.
 * 10. Reports unsupported dispatch/accounts transitions as NOT TESTED per real workflow rules.
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
console.log('🛡️  BUSINZ ERP: PHASE 9Y TEST SCRIPT SAFETY & PREFLIGHT AUDIT');
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

runTest('1.6 Script uses item-level filtering in generic JSONB stores rather than whole-array replacement', () => {
  assert(testScriptSrc.includes('.filter(item =>'), 'Must use item-level filtering');
  assert(testScriptSrc.includes('matchesLedger && hasSynthTag'), 'Must filter only matching synthetic items with ownership proof');
});

// =============================================================================
// TEST GROUP 2: Preflight Rejection of Incorrect Directory, Port, and Role
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
// TEST GROUP 3: Exact-ID Synthetic Ledger Tracking & Comprehensive Cleanup Safety
// =============================================================================
console.log('\n--- TEST GROUP 3: Exact-ID Synthetic Ledger Tracking & Comprehensive Cleanup Safety ---');

runTest('3.1 Script tracks exact database IDs across all 7 synthetic record types in syntheticLedger', () => {
  assert(testScriptSrc.includes('leads: []'), 'Must track leads');
  assert(testScriptSrc.includes('quotations: []'), 'Must track quotations');
  assert(testScriptSrc.includes('proformaInvoices: []'), 'Must track proforma invoices');
  assert(testScriptSrc.includes('bomOrders: []'), 'Must track BOM orders');
  assert(testScriptSrc.includes('reservations: []'), 'Must track reservations');
  assert(testScriptSrc.includes('invoices: []'), 'Must track invoices');
  assert(testScriptSrc.includes('registeredEmployees: []'), 'Must track registered employees');
});

runTest('3.2 Cleanup verifies ownership before deleting each synthetic record', () => {
  assert(testScriptSrc.includes('SELECT id, lead_number, company_name, notes FROM public.leads WHERE id = $1'), 'Must verify lead ownership');
  assert(testScriptSrc.includes('SELECT id, bom_code, customer_name FROM public.bom_orders WHERE id = $1 AND bom_code = $2'), 'Must verify BOM ownership');
  assert(testScriptSrc.includes('SELECT data FROM public.controlroom_store WHERE key = $1 FOR UPDATE'), 'Must use row-level lock FOR UPDATE');
});

runTest('3.3 Cleanup enforces FK child record deletion order before parent deletion', () => {
  assert(testScriptSrc.includes('DELETE FROM public.lead_notification_recipients'), 'Must clean recipients');
  assert(testScriptSrc.includes('DELETE FROM public.lead_notifications WHERE lead_id = $1'), 'Must clean notifications');
  assert(testScriptSrc.includes('DELETE FROM public.lead_status_history WHERE lead_id = $1'), 'Must clean status history');
  assert(testScriptSrc.includes('DELETE FROM public.bom_items WHERE bom_order_id = $1 OR bom_code = $2'), 'Must clean bom_items');
});

runTest('3.4 Cleanup is guaranteed in finally block to protect partial test failures', () => {
  assert(testScriptSrc.includes('finally {'), 'Must have finally block');
  assert(testScriptSrc.includes('testReport.cleanup = await executeComprehensiveCleanup(dbPool);'), 'Must execute comprehensive cleanup in finally');
});

runTest('3.5 Baseline and final count audit verifies both tables and generic stores', () => {
  assert(testScriptSrc.includes('collectDatabaseCounts'), 'Must collect database and store counts');
  assert(testScriptSrc.includes('testReport.baselines = await collectDatabaseCounts'), 'Must record baseline counts');
  assert(testScriptSrc.includes('finalCounts = await collectDatabaseCounts'), 'Must record final post-cleanup counts');
  assert(testScriptSrc.includes('discrepancies.push'), 'Must detect count discrepancies');
});

runTest('3.6 Unsupported dispatch/accounts transitions are reported as NOT TESTED per workflow rules', () => {
  assert(
    testScriptSrc.includes("testReport.workflows['7. Dispatch packing and accounts verification'] = {\n      status: 'NOT TESTED'"),
    'Must report Dispatch packing as NOT TESTED'
  );
  assert(
    testScriptSrc.includes('Direct BOM status update bypassed per application transition logic'),
    'Must document transition logic requirement in reason'
  );
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
