/**
 * scripts/validate_optimization_test_isolation_static.js
 * 
 * BUSINZ ERP: Phase 5D Static Validation Suite
 * 
 * Verifies all isolation invariants purely in-memory and statically:
 * 1. Test mode refuses missing configuration.
 * 2. Test mode refuses production (5001) and development (5002) ports.
 * 3. Test mode refuses non-test database targets (businz, businz_dev, postgres, etc.).
 * 4. Test mode refuses non-test storage paths (/var/www/businz, /var/www/businz-dev, repo server/).
 * 5. Automatic background jobs & WhatsApp sockets are disabled in test mode.
 * 6. HTTP test scripts cannot silently fall back to production.
 * 7. Database health logic (isDbConnected) does not report healthy solely because a pool exists.
 * 
 * ABSOLUTELY ZERO NETWORK REQUESTS OR DATABASE OPERATIONS ARE EXECUTED.
 */

import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import guard modules
import {
  isOptimizationTestMode,
  validatePortForTestMode,
  validateDatabaseConfigForTestMode,
  validateStorageConfigForTestMode,
  parseDatabaseTarget,
  areBackgroundJobsAllowed,
  isWhatsAppRestorationAllowed,
  isWhatsAppOutboundAllowed,
  areExternalIntegrationsAllowed,
  REQUIRED_TEST_PORT,
  REQUIRED_TEST_DATABASE
} from '../server/optimizationTestGuard.js';

import {
  resolveAndValidateTestApiUrl,
  resolveAndValidateTestDatabaseUrl
} from './testEnvironmentGuard.js';

import { isDbConnected } from '../server/db.js';

console.log('===================================================================');
console.log('🛡️  BUSINZ ERP: PHASE 5D STATIC ISOLATION & SAFETY AUDIT SUITE');
console.log('===================================================================\n');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

// Preserve original env
const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
}

try {
  // TEST GROUP 1: Port Enforcement
  console.log('--- TEST GROUP 1: Port Isolation Enforcement ---');

  runTest('Refuses missing PORT in optimization test mode', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    delete process.env.PORT;
    assert.throws(() => validatePortForTestMode(), /requires explicit PORT=5101/);
  });

  runTest('Refuses Production PORT=5001', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.PORT = '5001';
    assert.throws(() => validatePortForTestMode(), /FORBIDDEN PORT "5001"/);
  });

  runTest('Refuses Development PORT=5002', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.PORT = '5002';
    assert.throws(() => validatePortForTestMode(), /FORBIDDEN PORT "5002"/);
  });

  runTest('Refuses arbitrary non-test PORT=8080', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.PORT = '8080';
    assert.throws(() => validatePortForTestMode(), /Invalid port "8080"/);
  });

  runTest('Accepts designated test PORT=5101', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.PORT = '5101';
    assert.doesNotThrow(() => validatePortForTestMode());
  });

  // TEST GROUP 2: Database Isolation
  console.log('\n--- TEST GROUP 2: Database Isolation & Target Validation ---');

  runTest('Refuses missing database target in test mode', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    delete process.env.DATABASE_URL;
    delete process.env.PGDATABASE;
    delete process.env.BUSINZ_TEST_DATABASE;
    assert.throws(() => validateDatabaseConfigForTestMode(''), /requires an explicitly configured test database/);
  });

  runTest('Refuses Production database "businz"', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    const conn = 'postgres://postgres:postgres@127.0.0.1:5432/businz';
    assert.throws(() => validateDatabaseConfigForTestMode(conn), /FORBIDDEN DATABASE TARGET "businz"/);
  });

  runTest('Refuses Development database "businz_dev"', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    const conn = 'postgres://postgres:postgres@127.0.0.1:5432/businz_dev';
    assert.throws(() => validateDatabaseConfigForTestMode(conn), /FORBIDDEN DATABASE TARGET "businz_dev"/);
  });

  runTest('Refuses system database "postgres"', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    const conn = 'postgres://postgres:postgres@127.0.0.1:5432/postgres';
    assert.throws(() => validateDatabaseConfigForTestMode(conn), /FORBIDDEN DATABASE TARGET "postgres"/);
  });

  runTest('Refuses unverified random database "my_test_db"', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    const conn = 'postgres://postgres:postgres@127.0.0.1:5432/my_test_db';
    assert.throws(() => validateDatabaseConfigForTestMode(conn), /Unverified database target "my_test_db"/);
  });

  runTest('Refuses non-local database host "192.168.1.50"', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    const conn = 'postgres://postgres:postgres@192.168.1.50:5432/businz_optimization_test';
    assert.throws(() => validateDatabaseConfigForTestMode(conn), /database host must be local/);
  });

  runTest('Accepts dedicated test database "businz_optimization_test" on localhost', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    const conn = 'postgres://postgres:postgres@127.0.0.1:5432/businz_optimization_test';
    assert.doesNotThrow(() => validateDatabaseConfigForTestMode(conn));
  });

  // TEST GROUP 3: Storage Path Isolation
  console.log('\n--- TEST GROUP 3: Storage Path Isolation ---');

  runTest('Refuses missing BUSINZ_DATA_DIR in test mode', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    delete process.env.BUSINZ_DATA_DIR;
    assert.throws(() => validateStorageConfigForTestMode(), /requires an explicit BUSINZ_DATA_DIR/);
  });

  runTest('Refuses Production storage path "/var/www/businz"', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.BUSINZ_DATA_DIR = '/var/www/businz';
    assert.throws(() => validateStorageConfigForTestMode(), /Refusing to use production or development storage path/);
  });

  runTest('Refuses Development storage path "/var/www/businz-dev"', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.BUSINZ_DATA_DIR = '/var/www/businz-dev';
    assert.throws(() => validateStorageConfigForTestMode(), /Refusing to use production or development storage path/);
  });

  runTest('Refuses repository server source path', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.BUSINZ_DATA_DIR = path.resolve(__dirname, '../server');
    assert.throws(() => validateStorageConfigForTestMode(), /Refusing to use production or development storage path/);
  });

  runTest('Accepts isolated test storage path "/var/www/businz-optimization-test/storage"', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.BUSINZ_DATA_DIR = '/var/www/businz-optimization-test/storage';
    assert.doesNotThrow(() => validateStorageConfigForTestMode());
  });

  // TEST GROUP 4: Background Jobs & Integrations Fencing
  console.log('\n--- TEST GROUP 4: Background Jobs & Integrations Fencing ---');

  runTest('Background jobs disabled when test mode is enabled', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    assert.strictEqual(areBackgroundJobsAllowed(), false);
  });

  runTest('WhatsApp auto-restoration disabled when test mode is enabled', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    assert.strictEqual(isWhatsAppRestorationAllowed(), false);
  });

  runTest('WhatsApp outbound messaging disabled when test mode is enabled', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    assert.strictEqual(isWhatsAppOutboundAllowed(), false);
  });

  runTest('External integrations disabled when test mode is enabled', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    assert.strictEqual(areExternalIntegrationsAllowed(), false);
  });

  // TEST GROUP 5: Test Scripts Environment Guard
  console.log('\n--- TEST GROUP 5: Test Suite Script Guards ---');

  runTest('Scripts refuse missing BUSINZ_TEST_API_URL', () => {
    resetEnv();
    delete process.env.BUSINZ_TEST_API_URL;
    delete process.env.TEST_API_URL;
    assert.throws(() => resolveAndValidateTestApiUrl(), /Missing test API URL/);
  });

  runTest('Scripts refuse Production URL http://127.0.0.1:5001', () => {
    assert.throws(() => resolveAndValidateTestApiUrl('http://127.0.0.1:5001'), /FORBIDDEN TARGET PORT "5001"/);
  });

  runTest('Scripts refuse Development URL http://127.0.0.1:5002', () => {
    assert.throws(() => resolveAndValidateTestApiUrl('http://127.0.0.1:5002'), /FORBIDDEN TARGET PORT "5002"/);
  });

  runTest('Scripts accept Test URL http://127.0.0.1:5101', () => {
    const resolved = resolveAndValidateTestApiUrl('http://127.0.0.1:5101');
    assert.strictEqual(resolved, 'http://127.0.0.1:5101');
  });

  runTest('Scripts refuse missing BUSINZ_TEST_DATABASE_URL', () => {
    resetEnv();
    delete process.env.BUSINZ_TEST_DATABASE_URL;
    delete process.env.TEST_DATABASE_URL;
    assert.throws(() => resolveAndValidateTestDatabaseUrl(), /Missing test database connection URL/);
  });

  runTest('Scripts refuse Production database URL for businz', () => {
    assert.throws(
      () => resolveAndValidateTestDatabaseUrl('postgresql://postgres:postgres@localhost:5432/businz'),
      /FORBIDDEN DATABASE TARGET "businz"/
    );
  });

  runTest('Scripts refuse Development database URL for businz_dev', () => {
    assert.throws(
      () => resolveAndValidateTestDatabaseUrl('postgresql://postgres:postgres@localhost:5432/businz_dev'),
      /FORBIDDEN DATABASE TARGET "businz_dev"/
    );
  });

  runTest('Scripts accept Test database URL for businz_optimization_test', () => {
    const url = 'postgresql://postgres:postgres@127.0.0.1:5432/businz_optimization_test';
    const resolved = resolveAndValidateTestDatabaseUrl(url);
    assert.strictEqual(resolved, url);
  });

  // TEST GROUP 6: Database Health Logic Correction
  console.log('\n--- TEST GROUP 6: Database Health Verification Contract ---');

  runTest('isDbConnected() returns false when unestablished, not true from pool presence', () => {
    // Before active query or connect, isDbConnected() MUST return false
    const status = isDbConnected();
    assert.strictEqual(typeof status, 'boolean');
    assert.strictEqual(status, false, 'isDbConnected() must return false when no actual connection has been verified');
  });

} finally {
  resetEnv();
}

console.log('\n===================================================================');
console.log(`📊 AUDIT SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${passedTests + failedTests})`);
console.log('===================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🛡️  PHASE 5D STATIC ISOLATION AUDIT: FULLY VERIFIED & COMPLIANT\n');
  process.exit(0);
}

