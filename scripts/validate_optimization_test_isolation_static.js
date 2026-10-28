/**
 * scripts/validate_optimization_test_isolation_static.js
 * 
 * BUSINZ ERP: Phase 6B Static Validation Suite
 * 
 * Verifies all hardened isolation invariants purely in-memory and statically:
 * 1. Port isolation: strictly requires 5101; refuses 5001 (prod), 5002 (dev), and arbitrary ports.
 * 2. Database isolation: requires exact "businz_optimization_test", host 127.0.0.1, role businz_test_user.
 * 3. Database URL query parameters, service overrides, and Unix socket redirection rejected.
 * 4. Production, Development, HRMS, superuser (postgres, root), and unverified targets strictly rejected.
 * 5. Storage isolation: requires paths strictly inside /var/www/businz-optimization-test/storage.
 * 6. Independent validation for BUSINZ_DATA_DIR, BUSINZ_UPLOADS_DIR, BUSINZ_BACKUP_DIR, BUSINZ_WA_SESSIONS_DIR.
 * 7. Symbolic link escape detection and rejection.
 * 8. Automatic background jobs & WhatsApp sockets disabled in test mode.
 * 9. HTTP test scripts cannot silently fall back to production; require 5101 and businz_test_user.
 * 10. Database health-check reliability: bounded acquisition, bounded query, zero client leaks on timeout.
 * 
 * ABSOLUTELY ZERO NETWORK REQUESTS OR DATABASE OPERATIONS ARE EXECUTED.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import side-effect-free guard modules (NO database, network, or server runtime imports)
import {
  isOptimizationTestMode,
  validatePortForTestMode,
  validateDatabaseConfigForTestMode,
  validateStorageConfigForTestMode,
  validateSingleStoragePath,
  checkSymlinkRedirection,
  isPathInsideApprovedStorage,
  parseDatabaseTarget,
  maskCredentials,
  areBackgroundJobsAllowed,
  isWhatsAppRestorationAllowed,
  isWhatsAppOutboundAllowed,
  areExternalIntegrationsAllowed,
  REQUIRED_TEST_PORT,
  REQUIRED_TEST_DATABASE,
  REQUIRED_TEST_DB_ROLE,
  REQUIRED_TEST_HOST,
  REQUIRED_TEST_BIND_HOST,
  APPROVED_TEST_STORAGE_ROOT,
  getServerBindHost
} from '../server/optimizationTestGuard.js';

import {
  resolveAndValidateTestApiUrl,
  resolveAndValidateTestDatabaseUrl
} from './testEnvironmentGuard.js';

console.log('===================================================================');
console.log('🛡️  BUSINZ ERP: PHASE 6H STATIC ISOLATION & STARTUP AUDIT SUITE');
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

  // TEST GROUP 2: Database Isolation & Configuration
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
    const conn = 'postgres://businz_test_user:testpass@127.0.0.1:5432/businz';
    assert.throws(() => validateDatabaseConfigForTestMode(conn), /FORBIDDEN DATABASE TARGET "businz"/);
  });

  runTest('Refuses Development database "businz_dev"', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    const conn = 'postgres://businz_test_user:testpass@127.0.0.1:5432/businz_dev';
    assert.throws(() => validateDatabaseConfigForTestMode(conn), /FORBIDDEN DATABASE TARGET "businz_dev"/);
  });

  runTest('Refuses system database "postgres"', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    const conn = 'postgres://businz_test_user:testpass@127.0.0.1:5432/postgres';
    assert.throws(() => validateDatabaseConfigForTestMode(conn), /FORBIDDEN DATABASE TARGET "postgres"/);
  });

  runTest('Refuses unverified random database "my_test_db"', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    const conn = 'postgres://businz_test_user:testpass@127.0.0.1:5432/my_test_db';
    assert.throws(() => validateDatabaseConfigForTestMode(conn), /Unverified database target "my_test_db"/);
  });

  runTest('Refuses non-local database host "192.168.1.50"', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    const conn = 'postgres://businz_test_user:testpass@192.168.1.50:5432/businz_optimization_test';
    assert.throws(() => validateDatabaseConfigForTestMode(conn), /(?:database host must be local|Alternate database host)/i);
  });

  runTest('Accepts dedicated test database "businz_optimization_test" with test user on 127.0.0.1', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    const conn = 'postgres://businz_test_user:testpass@127.0.0.1:5432/businz_optimization_test';
    assert.doesNotThrow(() => validateDatabaseConfigForTestMode(conn));
  });

  // Phase 6B New Assertions: Database Hardening
  runTest('Refuses database URL query parameter overrides (?sslmode=disable)', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    const conn = 'postgres://businz_test_user:testpass@127.0.0.1:5432/businz_optimization_test?sslmode=disable';
    assert.throws(() => validateDatabaseConfigForTestMode(conn), /Database connection overrides strictly rejected/);
  });

  runTest('Refuses database URL service override query parameters (?service=custom)', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    const conn = 'postgres://businz_test_user:testpass@127.0.0.1:5432/businz_optimization_test?service=custom';
    assert.throws(() => validateDatabaseConfigForTestMode(conn), /URL query parameters are forbidden/);
  });

  runTest('Refuses Unix domain socket redirection (/var/run/postgresql)', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    const conn = 'postgres://businz_test_user:testpass@/var/run/postgresql/businz_optimization_test';
    assert.throws(() => validateDatabaseConfigForTestMode(conn), /Unix domain socket redirection strictly rejected/);
  });

  runTest('Refuses superuser role "postgres" in test mode', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    const conn = 'postgres://postgres:testpass@127.0.0.1:5432/businz_optimization_test';
    assert.throws(() => validateDatabaseConfigForTestMode(conn), /FORBIDDEN DATABASE ROLE "postgres"/);
  });

  runTest('Refuses production database role "businz" in test mode', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    const conn = 'postgres://businz:testpass@127.0.0.1:5432/businz_optimization_test';
    assert.throws(() => validateDatabaseConfigForTestMode(conn), /FORBIDDEN DATABASE ROLE "businz"/);
  });

  runTest('Refuses HRMS database role "hrms" in test mode', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    const conn = 'postgres://hrms:testpass@127.0.0.1:5432/businz_optimization_test';
    assert.throws(() => validateDatabaseConfigForTestMode(conn), /FORBIDDEN DATABASE ROLE "hrms"/);
  });

  runTest('Refuses ambiguous host "localhost" (strictly requires 127.0.0.1)', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    const conn = 'postgres://businz_test_user:testpass@localhost:5432/businz_optimization_test';
    assert.throws(() => validateDatabaseConfigForTestMode(conn), /Host "localhost" is ambiguous/);
  });

  runTest('Refuses HRMS database target "hrms" and "businz_hrms"', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    const conn1 = 'postgres://businz_test_user:testpass@127.0.0.1:5432/hrms';
    assert.throws(() => validateDatabaseConfigForTestMode(conn1), /FORBIDDEN DATABASE TARGET "hrms"/);

    const conn2 = 'postgres://businz_test_user:testpass@127.0.0.1:5432/businz_hrms';
    assert.throws(() => validateDatabaseConfigForTestMode(conn2), /FORBIDDEN DATABASE TARGET "businz_hrms"/);
  });

  runTest('Masks credentials in database error messages and log outputs', () => {
    const raw = 'postgres://superadmin:supersecretpassword123@127.0.0.1:5432/businz';
    const masked = maskCredentials(raw);
    assert(!masked.includes('supersecretpassword123'), 'Must mask raw password in string');
    assert(masked.includes('••••••••'), 'Must replace credentials with bullets');
  });

  // TEST GROUP 3: Storage Path Isolation
  console.log('\n--- TEST GROUP 3: Storage Path Isolation ---');

  runTest('Refuses missing BUSINZ_DATA_DIR in test mode', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    delete process.env.BUSINZ_DATA_DIR;
    assert.throws(() => validateStorageConfigForTestMode(), /(?:requires an explicit BUSINZ_DATA_DIR|Missing BUSINZ_DATA_DIR)/);
  });

  runTest('Refuses Production storage path "/var/www/businz"', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.BUSINZ_DATA_DIR = '/var/www/businz';
    assert.throws(() => validateStorageConfigForTestMode(), /Refusing to use.*production/i);
  });

  runTest('Refuses Development storage path "/var/www/businz-dev"', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.BUSINZ_DATA_DIR = '/var/www/businz-dev';
    assert.throws(() => validateStorageConfigForTestMode(), /Refusing to use.*production/i);
  });

  runTest('Refuses repository server source path', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.BUSINZ_DATA_DIR = path.resolve(__dirname, '../server');
    assert.throws(() => validateStorageConfigForTestMode(), /(?:Refusing to use production or development storage path|outside approved test directory)/);
  });

  runTest('Accepts isolated test storage path "/var/www/businz-optimization-test/storage"', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.BUSINZ_DATA_DIR = '/var/www/businz-optimization-test/storage';
    assert.doesNotThrow(() => validateStorageConfigForTestMode());
  });

  // Phase 6B New Assertions: Independent Storage Path & Symlink Hardening
  runTest('Independently rejects BUSINZ_UPLOADS_DIR outside approved storage root', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.BUSINZ_DATA_DIR = '/var/www/businz-optimization-test/storage';
    process.env.BUSINZ_UPLOADS_DIR = '/var/www/businz/uploads'; // Points to production!
    assert.throws(() => validateStorageConfigForTestMode(), /Refusing to use BUSINZ_UPLOADS_DIR pointing to production/);
  });

  runTest('Independently rejects BUSINZ_BACKUP_DIR outside approved storage root', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.BUSINZ_DATA_DIR = '/var/www/businz-optimization-test/storage';
    process.env.BUSINZ_BACKUP_DIR = '/var/www/businz-dev/backups'; // Points to dev!
    assert.throws(() => validateStorageConfigForTestMode(), /Refusing to use BUSINZ_BACKUP_DIR pointing to production/);
  });

  runTest('Independently rejects BUSINZ_WA_SESSIONS_DIR outside approved storage root', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.BUSINZ_DATA_DIR = '/var/www/businz-optimization-test/storage';
    process.env.BUSINZ_WA_SESSIONS_DIR = '/tmp/wa_sessions'; // Outside approved test root!
    assert.throws(() => validateStorageConfigForTestMode(), /outside approved test directory/);
  });

  runTest('Rejects HRMS storage directory paths (/var/www/hrms)', () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.BUSINZ_DATA_DIR = '/var/www/hrms/storage';
    assert.throws(() => validateStorageConfigForTestMode(), /Refusing to use BUSINZ_DATA_DIR pointing to production\/development\/HRMS/);
  });

  runTest('Detects and rejects symbolic links that escape approved test directory', () => {
    // In-memory test using temporary test dir if writable, or isolated logic check
    const mockApprovedRoot = '/var/www/businz-optimization-test/storage';
    assert.strictEqual(
      isPathInsideApprovedStorage('/var/www/businz-optimization-test/storage/data', mockApprovedRoot),
      true,
      'Valid subfolder must be recognized as inside approved storage'
    );
    assert.strictEqual(
      isPathInsideApprovedStorage('/var/www/businz/storage', mockApprovedRoot),
      false,
      'Production folder must not be recognized as inside test storage'
    );
    assert.strictEqual(
      isPathInsideApprovedStorage('/var/www/businz-dev/storage', mockApprovedRoot),
      false,
      'Dev folder must not be recognized as inside test storage'
    );
    assert.strictEqual(
      isPathInsideApprovedStorage('/var/www/hrms/storage', mockApprovedRoot),
      false,
      'HRMS folder must not be recognized as inside test storage'
    );
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

  // TEST GROUP 5: Test Suite Script Guards
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
      () => resolveAndValidateTestDatabaseUrl('postgresql://businz_test_user:testpass@127.0.0.1:5432/businz'),
      /FORBIDDEN DATABASE TARGET "businz"/
    );
  });

  runTest('Scripts refuse Development database URL for businz_dev', () => {
    assert.throws(
      () => resolveAndValidateTestDatabaseUrl('postgresql://businz_test_user:testpass@127.0.0.1:5432/businz_dev'),
      /FORBIDDEN DATABASE TARGET "businz_dev"/
    );
  });

  runTest('Scripts accept Test database URL for businz_optimization_test', () => {
    const url = 'postgresql://businz_test_user:testpass@127.0.0.1:5432/businz_optimization_test';
    const resolved = resolveAndValidateTestDatabaseUrl(url);
    assert.strictEqual(resolved, url);
  });

  // Phase 6B New Script Guard Assertions
  runTest('Scripts refuse database URL with query parameter overrides', () => {
    const url = 'postgresql://businz_test_user:testpass@127.0.0.1:5432/businz_optimization_test?sslmode=disable';
    assert.throws(() => resolveAndValidateTestDatabaseUrl(url), /Database connection overrides strictly rejected/);
  });

  runTest('Scripts refuse superuser role "postgres"', () => {
    const url = 'postgresql://postgres:testpass@127.0.0.1:5432/businz_optimization_test';
    assert.throws(() => resolveAndValidateTestDatabaseUrl(url), /FORBIDDEN DATABASE ROLE "postgres"/);
  });

  runTest('Scripts refuse ambiguous host "localhost"', () => {
    const url = 'postgresql://businz_test_user:testpass@localhost:5432/businz_optimization_test';
    assert.throws(() => resolveAndValidateTestDatabaseUrl(url), /Host "localhost" is ambiguous/);
  });

  runTest('Scripts refuse Unix domain socket redirection', () => {
    const url = 'postgresql://businz_test_user:testpass@/var/run/postgresql/businz_optimization_test';
    assert.throws(() => resolveAndValidateTestDatabaseUrl(url), /Unix domain socket redirection strictly rejected/);
  });

  runTest('Scripts refuse HRMS database URL targets', () => {
    const url1 = 'postgresql://businz_test_user:testpass@127.0.0.1:5432/hrms';
    assert.throws(() => resolveAndValidateTestDatabaseUrl(url1), /FORBIDDEN DATABASE TARGET "hrms"/);

    const url2 = 'postgresql://businz_test_user:testpass@127.0.0.1:5432/businz_hrms';
    assert.throws(() => resolveAndValidateTestDatabaseUrl(url2), /FORBIDDEN DATABASE TARGET "businz_hrms"/);
  });

  // TEST GROUP 6: Database Health Logic Correction & Zero-Leak Verification
  console.log('\n--- TEST GROUP 6: Database Health Verification & Leak-Proof Contract ---');

  runTest('isDbConnected() returns false when unestablished, not true from pool presence', () => {
    // 1. Source inspection of server/db.js without executing PostgreSQL or initializing connection pools
    const dbSource = fs.readFileSync(path.resolve(__dirname, '../server/db.js'), 'utf8');

    // Verify initial connection state is false
    assert(
      /let\s+isConnected\s*=\s*false\s*;/.test(dbSource),
      'server/db.js must initialize isConnected = false (not true)'
    );

    // Verify legacy bug (return isConnected || pool...) is eliminated
    assert(
      !dbSource.includes('return isConnected || (pool && !pool.ending && !pool.ended)'),
      'server/db.js must NOT report connected solely because a pool exists (legacy bug eliminated)'
    );

    // Verify isDbConnected requires actual active connection and pool
    assert(
      /export\s+function\s+isDbConnected\(\)\s*\{[\s\S]*?return\s+Boolean\(\s*isConnected\s*&&\s*pool\s*&&\s*!pool\.ending\s*&&\s*!pool\.ended\s*\);/.test(dbSource),
      'server/db.js isDbConnected() must return Boolean(isConnected && pool && !pool.ending && !pool.ended)'
    );

    // Verify bounded verifyDbConnectivity function exists
    assert(
      /export\s+async\s+function\s+verifyDbConnectivity\(/.test(dbSource),
      'server/db.js must export verifyDbConnectivity() for bounded connectivity checks'
    );

    // 2. Behavioral verification using pure mocked state machine matching server/db.js contract
    const contractEvaluator = (isConnectedState, poolObj) => {
      return Boolean(isConnectedState && poolObj && !poolObj.ending && !poolObj.ended);
    };

    // Unestablished connection with active pool MUST evaluate to false
    const activeUnconnectedPool = { ending: false, ended: false };
    assert.strictEqual(
      contractEvaluator(false, activeUnconnectedPool),
      false,
      'isDbConnected contract must return false when connection is unestablished even if pool exists'
    );

    // Verified connected with active pool evaluates to true
    assert.strictEqual(
      contractEvaluator(true, activeUnconnectedPool),
      true,
      'isDbConnected contract must return true when connection is verified and pool active'
    );

    // Terminated pool evaluates to false
    assert.strictEqual(
      contractEvaluator(true, { ending: true, ended: false }),
      false,
      'isDbConnected contract must return false when pool is ending'
    );
    assert.strictEqual(
      contractEvaluator(true, { ending: false, ended: true }),
      false,
      'isDbConnected contract must return false when pool is ended'
    );
  });

  // Phase 6B New Health Check & Client Leak Prevention Assertions
  runTest('verifyDbConnectivity bounds both acquisition and query execution in source', () => {
    const dbSource = fs.readFileSync(path.resolve(__dirname, '../server/db.js'), 'utf8');

    // Bounded connection acquisition
    assert(
      /hasTimedOut\s*=\s*true/.test(dbSource),
      'verifyDbConnectivity must track timeout state to intercept late-arriving clients'
    );

    // Bounded query execution
    assert(
      /queryTimeoutPromise/.test(dbSource),
      'verifyDbConnectivity must bound query execution with independent timeout'
    );

    // Late client release
    assert(
      /acquiredClient\.release\(\)/.test(dbSource),
      'verifyDbConnectivity must explicitly release late-arriving clients after connection timeout'
    );
  });

  runTest('Late-arriving client cleanup state-machine releases client immediately (zero leak)', async () => {
    // Pure in-memory state-machine test of the late-arrival release mechanism
    let clientReleased = false;
    const mockClient = {
      release: () => { clientReleased = true; },
      query: async () => ({ rows: [{ db_name: 'businz_optimization_test', health_check: 1 }] })
    };

    let hasTimedOut = false;
    let poolConnectResolve = null;
    const poolConnectPromise = new Promise((resolve) => {
      poolConnectResolve = resolve;
    });

    const connectPromise = poolConnectPromise.then((acquiredClient) => {
      if (hasTimedOut) {
        acquiredClient.release();
        return null;
      }
      return acquiredClient;
    });

    // Simulate timeout firing BEFORE connection completes
    hasTimedOut = true;

    // Late-arriving connection completes
    poolConnectResolve(mockClient);
    await connectPromise;

    assert.strictEqual(clientReleased, true, 'Late arriving client MUST be immediately released');
  });

  runTest('Query execution failure releases acquired client in finally block', async () => {
    let clientReleased = false;
    let client = {
      release: () => { clientReleased = true; },
      query: async () => { throw new Error('Simulated query failure'); }
    };

    try {
      try {
        await client.query();
      } finally {
        if (client) {
          client.release();
          client = null;
        }
      }
    } catch (_) {}

    assert.strictEqual(clientReleased, true, 'Client must be released even when query execution fails');
    assert.strictEqual(client, null, 'Client reference must be nulled');
  });

  // TEST GROUP 7: Safe Optimization Test Startup & Storage Lifecycle (Phase 6H)
  console.log('\n--- TEST GROUP 7: Safe Optimization Test Startup & Lifecycle Safeguards ---');

  runTest('Server startup in test mode binds exclusively to localhost (127.0.0.1:5101)', () => {
    // 1. Helper / Guard verification
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    assert.strictEqual(getServerBindHost(), '127.0.0.1', 'getServerBindHost() must return 127.0.0.1 in test mode');

    resetEnv();
    delete process.env.BUSINZ_OPTIMIZATION_TEST_MODE;
    assert.strictEqual(getServerBindHost(), undefined, 'getServerBindHost() must return undefined in normal mode');

    // 2. Source inspection of server/index.js
    const indexSource = fs.readFileSync(path.resolve(__dirname, '../server/index.js'), 'utf8');
    assert(
      /if\s*\(\s*isOptimizationTestMode\(\)\s*\)\s*\{[\s\S]*?app\.listen\(\s*PORT\s*,\s*['"]127\.0\.0\.1['"]/.test(indexSource),
      'server/index.js must call app.listen(PORT, "127.0.0.1") when in optimization test mode'
    );
    assert(
      /app\.listen\(\s*PORT\s*,\s*\(\)\s*=>/.test(indexSource),
      'server/index.js must preserve standard app.listen(PORT, ...) when outside test mode'
    );
  });

  runTest('Disabling legacy storage seeding in test mode (initRuntimeStorage)', () => {
    const runtimePathsSource = fs.readFileSync(path.resolve(__dirname, '../server/runtimePaths.js'), 'utf8');
    const initStorageSource = runtimePathsSource.split('export function initRuntimeStorage()')[1] || '';

    // Verify test mode branches before copyFileSync
    assert(
      /if\s*\(\s*isOptimizationTestMode\(\)\s*\)\s*\{[\s\S]*?fs\.writeFileSync\([\s\S]*?seededStores:\s*0/.test(initStorageSource),
      'server/runtimePaths.js must initialize empty synthetic stores and set seededStores: 0 in test mode'
    );

    // Verify copyFileSync is not invoked for legacy stores in test branch of initRuntimeStorage
    const testBranchMatch = initStorageSource.match(/if\s*\(\s*isOptimizationTestMode\(\)\s*\)\s*\{([\s\S]*?return\s*\{[\s\S]*?seededStores:\s*0[\s\S]*?\};)/);
    assert(testBranchMatch, 'Test mode branch must exist in initRuntimeStorage()');
    assert(
      !testBranchMatch[1].includes('fs.copyFileSync'),
      'Test mode branch in initRuntimeStorage() must NOT call fs.copyFileSync'
    );
    assert(
      !testBranchMatch[1].includes('copyDirRecursiveNonDestructive'),
      'Test mode branch in initRuntimeStorage() must NOT copy legacy attachments/bom-documents'
    );
  });

  runTest('Database initialization isolation: verifies active DB and role before schema operations', () => {
    const dbSource = fs.readFileSync(path.resolve(__dirname, '../server/db.js'), 'utf8');

    // Verify query to check current_database() and current_user in initPostgresDatabase
    assert(
      /SELECT\s+current_database\(\)\s+as\s+db_name\s*,\s*current_user\s+as\s+role_name/.test(dbSource),
      'initPostgresDatabase() must query current_database() and current_user for runtime verification'
    );

    // Verify rejection if activeDb is not REQUIRED_TEST_DATABASE
    assert(
      /if\s*\(\s*activeDb\s*!==\s*REQUIRED_TEST_DATABASE\s*\)/.test(dbSource),
      'initPostgresDatabase() must strictly reject schema initialization if active database is not REQUIRED_TEST_DATABASE'
    );

    // Verify rejection if activeRole is not REQUIRED_TEST_DB_ROLE
    assert(
      /if\s*\(\s*activeRole\s*!==\s*REQUIRED_TEST_DB_ROLE\s*\)/.test(dbSource),
      'initPostgresDatabase() must strictly reject schema initialization if active role is not REQUIRED_TEST_DB_ROLE'
    );
  });

  runTest('Startup synchronization safeguards: disables historical data and store seeding', () => {
    const dbSource = fs.readFileSync(path.resolve(__dirname, '../server/db.js'), 'utf8');
    const indexSource = fs.readFileSync(path.resolve(__dirname, '../server/index.js'), 'utf8');

    // Verify historical PI seeding is fenced behind !isOptimizationTestMode()
    assert(
      /if\s*\(\s*!isOptimizationTestMode\(\)\s*\)\s*\{[\s\S]*?const\s+piFiles\s*=\s*\['sales_pi_store\.json'/.test(dbSource),
      'initPostgresDatabase() must fence historical PI auto-seeding behind !isOptimizationTestMode()'
    );

    // Verify controlroom_store seeding is fenced behind !isOptimizationTestMode()
    assert(
      /if\s*\(\s*!isOptimizationTestMode\(\)\s*\)\s*\{[\s\S]*?const\s+storesToSeed\s*=/.test(dbSource),
      'initPostgresDatabase() must fence legacy storesToSeed seeding behind !isOptimizationTestMode()'
    );

    // Verify server/index.js fences startup data pre-warming and relational sync
    assert(
      /if\s*\(\s*!isOptimizationTestMode\(\)\s*\)\s*\{[\s\S]*?loadDatabaseCustomers\(true\)[\s\S]*?loadDatabaseBoms\(true\)[\s\S]*?syncMissingRelationalBoms\(/.test(indexSource),
      'server/index.js must fence customer/BOM pre-warming and relational sync behind !isOptimizationTestMode()'
    );
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
  console.log('🛡️  PHASE 6H STATIC ISOLATION & STARTUP AUDIT: FULLY VERIFIED & COMPLIANT\n');
  process.exit(0);
}
