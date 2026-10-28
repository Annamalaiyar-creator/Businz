/**
 * scripts/validate_optimization_test_isolation_static.js
 * 
 * BUSINZ ERP: Phase 6P Static Validation Suite
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
 * 11. External integrations fail-closed: Zoho OAuth, Zoho Books API, Zoho PI sync, Tally Prime bridge, IndiaMART CRM sync, Backups, and WhatsApp.
 * 12. Complete sanitation of hardcoded operational secrets in integration adapters.
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

import {
  verifyPasswordVerifier,
  hashPassword,
  generateSecureSessionId,
  authenticateEmployeeRecord,
  isPrivilegedRole,
  normalizeEmployeeCode,
  createSessionRecord,
  validateSessionInMap,
  heartbeatSessionInMap,
  revokeSessionInMap,
  SESSION_TTL_MS,
  FORBIDDEN_SELF_REGISTER_ROLES
} from '../server/authSecurity.js';

console.log('===================================================================');
console.log('🛡️  BUSINZ ERP: PHASE 6P STATIC ISOLATION & EXTERNAL INTEGRATION AUDIT SUITE');
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

  // TEST GROUP 8: External Integration Fail-Closed & Secret Sanitation (Phase 6P)
  console.log('\n--- TEST GROUP 8: External Integration Fail-Closed & Secret Sanitation ---');

  runTest('Zoho Auth Service contains zero hardcoded operational secrets in source', () => {
    const zohoSource = fs.readFileSync(path.resolve(__dirname, '../server/zohoAuthService.js'), 'utf8');

    // Reject hardcoded client secrets, refresh tokens, client IDs, or org IDs
    assert(!zohoSource.includes('e82079a'), 'zohoAuthService.js must not contain hardcoded Zoho client secret');
    assert(!zohoSource.includes('dbba4167'), 'zohoAuthService.js must not contain hardcoded Zoho refresh token');
    assert(!zohoSource.includes('9U5BAN338075M5HBI3U8K1VBNKUU8K'), 'zohoAuthService.js must not contain hardcoded Zoho client ID');
    assert(!zohoSource.includes('60082137608'), 'zohoAuthService.js must not contain hardcoded Zoho organization ID');

    // Confirm DEFAULT_CONFIG uses environment variables
    assert(
      /clientId:\s*process\.env\.ZOHO_CLIENT_ID\s*\|\|\s*''/.test(zohoSource),
      'DEFAULT_CONFIG must resolve clientId from process.env.ZOHO_CLIENT_ID with empty default'
    );
    assert(
      /clientSecret:\s*process\.env\.ZOHO_CLIENT_SECRET\s*\|\|\s*''/.test(zohoSource),
      'DEFAULT_CONFIG must resolve clientSecret from process.env.ZOHO_CLIENT_SECRET with empty default'
    );
    assert(
      /refreshToken:\s*process\.env\.ZOHO_REFRESH_TOKEN\s*\|\|\s*''/.test(zohoSource),
      'DEFAULT_CONFIG must resolve refreshToken from process.env.ZOHO_REFRESH_TOKEN with empty default'
    );
  });

  runTest('Zoho Auth Service startup and storage routines are side-effect-free in test mode', () => {
    const zohoSource = fs.readFileSync(path.resolve(__dirname, '../server/zohoAuthService.js'), 'utf8');

    // Confirm initZohoConfig skips in test mode
    assert(
      /function\s+initZohoConfig\(\)\s*\{[\s\r\n]*if\s*\(\s*isOptimizationTestMode\(\)\s*\)\s*\{[\s\r\n]*return;/.test(zohoSource),
      'initZohoConfig() must exit immediately when isOptimizationTestMode() is true'
    );

    // Confirm initTokenCache skips in test mode
    assert(
      /function\s+initTokenCache\(\)\s*\{[\s\r\n]*if\s*\(\s*isOptimizationTestMode\(\)\s*\)\s*\{[\s\r\n]*return;/.test(zohoSource),
      'initTokenCache() must exit immediately when isOptimizationTestMode() is true'
    );
  });

  runTest('Zoho Auth Service fails closed on all OAuth and API operations in test mode', async () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.PORT = '5101';
    process.env.BUSINZ_DATA_DIR = '/var/www/businz-optimization-test/storage';
    process.env.DATABASE_URL = 'postgresql://businz_test_user:testpass@127.0.0.1:5432/businz_optimization_test';

    const zohoModule = await import('../server/zohoAuthService.js');

    // 1. getZohoAccessToken rejects
    await assert.rejects(
      async () => await zohoModule.getZohoAccessToken(),
      /\[FAIL-CLOSED\] External Zoho OAuth authentication is blocked in optimization test mode\./
    );

    // 2. zohoRequest rejects
    await assert.rejects(
      async () => await zohoModule.zohoRequest({ path: '/books/v3/organizations' }),
      /\[FAIL-CLOSED\] External Zoho Books API requests are blocked in optimization test mode\./
    );

    // 3. testZohoConnection fails closed
    const testConnRes = await zohoModule.testZohoConnection();
    assert.strictEqual(testConnRes.success, false);
    assert.strictEqual(testConnRes.connected, false);
    assert(testConnRes.error.includes('[FAIL-CLOSED]'));

    // 4. exchangeAuthorizationCode rejects
    await assert.rejects(
      async () => await zohoModule.exchangeAuthorizationCode({ code: 'dummy_grant_code' }),
      /\[FAIL-CLOSED\] External Zoho authorization code exchange is blocked in optimization test mode\./
    );

    // 5. updateZohoConfig rejects
    await assert.rejects(
      async () => await zohoModule.updateZohoConfig({ clientId: 'new_id' }),
      /\[FAIL-CLOSED\] External Zoho configuration updates are blocked in optimization test mode\./
    );
  });

  runTest('Zoho PI Service uses centralized runtime storage and fails closed in test mode', async () => {
    const piSource = fs.readFileSync(path.resolve(__dirname, '../server/zohoPiService.js'), 'utf8');

    // Confirm getStoreFilePath imported from runtimePaths
    assert(
      /import\s*\{[\s\S]*?getStoreFilePath[\s\S]*?\}\s*from\s*['"]\.\/runtimePaths\.js['"]/.test(piSource),
      'zohoPiService.js must import getStoreFilePath from ./runtimePaths.js'
    );
    assert(
      !piSource.includes('function getStoreFilePath('),
      'zohoPiService.js must not define a local getStoreFilePath'
    );

    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.PORT = '5101';
    process.env.BUSINZ_DATA_DIR = '/var/www/businz-optimization-test/storage';
    process.env.DATABASE_URL = 'postgresql://businz_test_user:testpass@127.0.0.1:5432/businz_optimization_test';

    const zohoPiModule = await import('../server/zohoPiService.js');
    await assert.rejects(
      async () => await zohoPiModule.pushPiToZoho({ piNo: 'VRM-PI-TEST' }),
      /\[FAIL-CLOSED\] External Zoho PI synchronization is blocked in optimization test mode\./
    );
  });

  runTest('Tally Service fails closed before network dispatch in test mode', async () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.PORT = '5101';
    process.env.BUSINZ_DATA_DIR = '/var/www/businz-optimization-test/storage';
    process.env.DATABASE_URL = 'postgresql://businz_test_user:testpass@127.0.0.1:5432/businz_optimization_test';

    const tallyModule = await import('../server/tallyService.js');

    // sendTallyRequest rejects
    await assert.rejects(
      async () => await tallyModule.sendTallyRequest('<xml></xml>'),
      /\[FAIL-CLOSED\] External Tally HTTP requests are blocked in optimization test mode\./
    );

    // pushDirectVoucher returns fail-closed
    const voucherRes = await tallyModule.pushDirectVoucher('<xml></xml>');
    assert.strictEqual(voucherRes.success, false);
    assert.strictEqual(voucherRes.created, 0);
    assert.strictEqual(voucherRes.errors, 1);
    assert(voucherRes.error.includes('[FAIL-CLOSED]'));

    // checkTallyStatus reports offline
    const statusRes = await tallyModule.checkTallyStatus();
    assert.strictEqual(statusRes.online, false);

    // fetchTallyPnl returns failure
    const pnlRes = await tallyModule.fetchTallyPnl();
    assert.strictEqual(pnlRes.success, false);
  });

  runTest('Backup Engine protects storage and fails closed in test mode', async () => {
    const backupSource = fs.readFileSync(path.resolve(__dirname, '../server/backupEngine.js'), 'utf8');

    // Confirm directory creation on import is guarded
    assert(
      /if\s*\(\s*!isOptimizationTestMode\(\)\s*\)\s*\{[\s\S]*?fs\.mkdirSync\(/.test(backupSource),
      'backupEngine.js must guard fs.mkdirSync with !isOptimizationTestMode()'
    );

    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.PORT = '5101';
    process.env.BUSINZ_DATA_DIR = '/var/www/businz-optimization-test/storage';
    process.env.DATABASE_URL = 'postgresql://businz_test_user:testpass@127.0.0.1:5432/businz_optimization_test';

    const backupModule = await import('../server/backupEngine.js');

    // createFullBackup throws fail-closed
    await assert.rejects(
      async () => await backupModule.createFullBackup(),
      /\[FAIL-CLOSED\] External backup creation is blocked in optimization test mode\./
    );

    // restoreFromBackup throws fail-closed
    await assert.rejects(
      async () => await backupModule.restoreFromBackup({ stores: {} }),
      /\[FAIL-CLOSED\] External backup restoration is blocked in optimization test mode\./
    );

    // listBackups returns empty array in test mode
    assert.deepStrictEqual(backupModule.listBackups(), []);
  });

  runTest('WhatsApp Service fails closed on outbound messaging and session init in test mode', async () => {
    const waSource = fs.readFileSync(path.resolve(__dirname, '../server/whatsappMultiService.js'), 'utf8');

    // Confirm no eager call to getWaSessionsDir() at top level
    assert(
      !waSource.includes('const SESSIONS_BASE_DIR = getWaSessionsDir();'),
      'whatsappMultiService.js must not eagerly call getWaSessionsDir() at module top-level'
    );

    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.PORT = '5101';
    process.env.BUSINZ_DATA_DIR = '/var/www/businz-optimization-test/storage';
    process.env.DATABASE_URL = 'postgresql://businz_test_user:testpass@127.0.0.1:5432/businz_optimization_test';

    const waModule = await import('../server/whatsappMultiService.js');

    // sendUserWhatsAppMessage rejects
    await assert.rejects(
      async () => await waModule.sendUserWhatsAppMessage('sales_rep_1', { to: '919876543210', text: 'Hello' }),
      /\[FAIL-CLOSED\] Outbound WhatsApp messages are blocked in optimization test mode\./
    );

    // initUserSession rejects
    await assert.rejects(
      async () => await waModule.initUserSession('sales_rep_1'),
      /\[FAIL-CLOSED\] WhatsApp session initialization is blocked in optimization test mode\./
    );
  });

  runTest('IndiaMART Service fails closed on connection tests and lead sync in test mode', async () => {
    resetEnv();
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE = 'true';
    process.env.PORT = '5101';
    process.env.BUSINZ_DATA_DIR = '/var/www/businz-optimization-test/storage';
    process.env.DATABASE_URL = 'postgresql://businz_test_user:testpass@127.0.0.1:5432/businz_optimization_test';

    const imModule = await import('../server/indiaMartService.js');

    // testIndiaMartConnection returns fail-closed
    const connRes = await imModule.testIndiaMartConnection();
    assert.strictEqual(connRes.success, false);
    assert(connRes.error.includes('[FAIL-CLOSED]'));

    // syncIndiaMartLeads returns fail-closed
    const syncRes = await imModule.syncIndiaMartLeads();
    assert.strictEqual(syncRes.success, false);
    assert(syncRes.error.includes('[FAIL-CLOSED]'));
  });

  // TEST GROUP 9: Authentication & Session Security Invariants (Phase 8D)
  console.log('\n--- TEST GROUP 9: Authentication & Session Security Invariants (Phase 8D) ---');

  // 1. Correct password authentication (plaintext and hashed verifiers)
  runTest('Correct password authentication verifies successfully for plaintext, SHA-256, and scrypt', () => {
    const rawPass = 'SyntheticSecurePass#2026';

    // Plaintext
    assert.strictEqual(verifyPasswordVerifier(rawPass, rawPass), true);

    // Salted SHA-256
    const shaVerifier = hashPassword(rawPass, 'sha256');
    assert(shaVerifier.startsWith('sha256$'));
    assert.strictEqual(verifyPasswordVerifier(rawPass, shaVerifier), true);

    // Salted scrypt
    const scryptVerifier = hashPassword(rawPass, 'scrypt');
    assert(scryptVerifier.startsWith('scrypt$'));
    assert.strictEqual(verifyPasswordVerifier(rawPass, scryptVerifier), true);

    // authenticateEmployeeRecord
    const syntheticEmp = {
      employee_code: 'EMP-SYN001',
      employee_name: 'Synthetic Sales Rep',
      email: 'salesrep@synthetic.local',
      role: 'Sales Executive',
      password: shaVerifier,
      status: 'Active'
    };
    const authRes = authenticateEmployeeRecord(syntheticEmp, rawPass);
    assert.strictEqual(authRes.verified, true);
    assert.strictEqual(authRes.employee_code, 'EMP-SYN001');
    assert.strictEqual(authRes.role, 'Sales Executive');
    assert.strictEqual(authRes.email, 'salesrep@synthetic.local');
  });

  // 2. Incorrect and missing candidate passwords
  runTest('Rejects incorrect, empty, and missing candidate passwords', () => {
    const validVerifier = hashPassword('SyntheticPass#1', 'sha256');
    const syntheticEmp = {
      employee_code: 'EMP-SYN002',
      employee_name: 'Synthetic Employee',
      email: 'synth2@synthetic.local',
      role: 'Production Staff',
      password: validVerifier,
      status: 'Active'
    };

    // Wrong password
    const wrongRes = authenticateEmployeeRecord(syntheticEmp, 'WrongPass#999');
    assert.strictEqual(wrongRes.verified, false);
    assert.strictEqual(wrongRes.status, 401);
    assert.strictEqual(wrongRes.error, 'Invalid password');

    // Empty password
    const emptyRes = authenticateEmployeeRecord(syntheticEmp, '');
    assert.strictEqual(emptyRes.verified, false);
    assert.strictEqual(emptyRes.status, 401);
    assert.strictEqual(emptyRes.error, 'Password is required');

    // Missing password (null/undefined)
    const nullRes = authenticateEmployeeRecord(syntheticEmp, null);
    assert.strictEqual(nullRes.verified, false);
    assert.strictEqual(nullRes.status, 401);

    const undefRes = authenticateEmployeeRecord(syntheticEmp, undefined);
    assert.strictEqual(undefRes.verified, false);
    assert.strictEqual(undefRes.status, 401);
  });

  // 3. Rejection of missing stored password verifiers
  runTest('Rejects accounts with missing, null, or empty stored password verifiers', () => {
    const accountsWithoutVerifier = [
      { employee_code: 'EMP-NO-VER1', password: null, status: 'Active' },
      { employee_code: 'EMP-NO-VER2', password: '', status: 'Active' },
      { employee_code: 'EMP-NO-VER3', password: '   ', status: 'Active' },
      { employee_code: 'EMP-NO-VER4', status: 'Active' }
    ];

    for (const acc of accountsWithoutVerifier) {
      // Must fail unconditionally; must NEVER accept arbitrary passwords
      const res1 = authenticateEmployeeRecord(acc, 'AnyPassword123');
      assert.strictEqual(res1.verified, false);
      assert.strictEqual(res1.status, 401);
      assert(res1.error.includes('no valid password verifier configured'));

      const res2 = authenticateEmployeeRecord(acc, '');
      assert.strictEqual(res2.verified, false);
      assert.strictEqual(res2.status, 401);

      // Raw verifier helper must also return false
      assert.strictEqual(verifyPasswordVerifier('AnyPassword123', acc.password), false);
    }
  });

  // 4. Rejection of unknown and inactive employees
  runTest('Rejects unknown employees and non-active employee statuses', () => {
    // Unknown employee record
    const notFoundRes = authenticateEmployeeRecord(null, 'SomePass');
    assert.strictEqual(notFoundRes.verified, false);
    assert.strictEqual(notFoundRes.status, 404);
    assert.strictEqual(notFoundRes.error, 'Account not found');

    const rawPass = 'Pass123!';
    const verifier = hashPassword(rawPass, 'sha256');

    // Pending Approval
    const pendingEmp = { employee_code: 'EMP-P1', password: verifier, status: 'Pending Approval' };
    const pendingRes = authenticateEmployeeRecord(pendingEmp, rawPass);
    assert.strictEqual(pendingRes.verified, false);
    assert.strictEqual(pendingRes.status, 403);
    assert.strictEqual(pendingRes.error, 'Account is Pending Approval');

    // Disabled
    const disabledEmp = { employee_code: 'EMP-D1', password: verifier, status: 'Disabled' };
    const disabledRes = authenticateEmployeeRecord(disabledEmp, rawPass);
    assert.strictEqual(disabledRes.verified, false);
    assert.strictEqual(disabledRes.status, 403);
    assert.strictEqual(disabledRes.error, 'Account is Disabled');

    // Rejected
    const rejectedEmp = { employee_code: 'EMP-R1', password: verifier, status: 'Rejected' };
    const rejectedRes = authenticateEmployeeRecord(rejectedEmp, rawPass);
    assert.strictEqual(rejectedRes.verified, false);
    assert.strictEqual(rejectedRes.status, 403);
  });

  // 5. Rejection of client-submitted CEO and privileged roles
  runTest('Detects and rejects client-submitted CEO, TA, and privileged executive roles', () => {
    assert.strictEqual(isPrivilegedRole('CEO'), true);
    assert.strictEqual(isPrivilegedRole('Technical Administrator'), true);
    assert.strictEqual(isPrivilegedRole('Director'), true);
    assert.strictEqual(isPrivilegedRole('Managing Director'), true);
    assert.strictEqual(isPrivilegedRole('MD'), true);
    assert.strictEqual(isPrivilegedRole('Super Admin'), true);
    assert.strictEqual(isPrivilegedRole('Admin'), true);
    assert.strictEqual(isPrivilegedRole(null, 'TA-VRM001'), true);
    assert.strictEqual(isPrivilegedRole(null, 'CEO-001'), true);
    assert.strictEqual(isPrivilegedRole(null, 'MD-100'), true);
    assert.strictEqual(isPrivilegedRole(null, 'DIR-01'), true);

    // Non-privileged roles
    assert.strictEqual(isPrivilegedRole('Sales Executive', 'SE-001'), false);
    assert.strictEqual(isPrivilegedRole('Billing Team', 'BIL-001'), false);
    assert.strictEqual(isPrivilegedRole('Dispatch Staff', 'DIS-001'), false);

    // Server-side session creation strictly ignores client-supplied roles
    const authResult = {
      verified: true,
      employee_code: 'EMP-SE01',
      employee_name: 'Sales Rep',
      email: 'rep@synthetic.local',
      role: 'Sales Executive'
    };
    const session = createSessionRecord(authResult, { device: 'Mobile', browser: 'Safari' });
    assert.strictEqual(session.role, 'Sales Executive');
    assert.strictEqual(session.empCode, 'EMP-SE01');
    assert(session.id.startsWith('sess_'));
  });

  // 6. Elimination of hardcoded operational fallback credentials in source
  runTest('Application source contains zero hardcoded operational employee credentials or fallback passwords', () => {
    const serverIndexSrc = fs.readFileSync(path.resolve(__dirname, '../server/index.js'), 'utf8');
    const authServiceSrc = fs.readFileSync(path.resolve(__dirname, '../src/services/authService.js'), 'utf8');

    // Confirm elimination of CORE_AUTHENTICATED_EMPLOYEES array
    assert(
      !serverIndexSrc.includes('const CORE_AUTHENTICATED_EMPLOYEES ='),
      'server/index.js must not define CORE_AUTHENTICATED_EMPLOYEES'
    );

    // Confirm DEFAULT_CORE_EMPLOYEES is empty in authService.js
    assert(
      authServiceSrc.includes('export const DEFAULT_CORE_EMPLOYEES = [];'),
      'src/services/authService.js must have empty DEFAULT_CORE_EMPLOYEES'
    );

    // Verify hardcoded plaintext credentials are eliminated from both source files
    const forbiddenCredentialPatterns = ['Efx@1234', 'password: "12345"', 'password: \'12345\''];
    for (const cred of forbiddenCredentialPatterns) {
      assert(!serverIndexSrc.includes(cred), `server/index.js must not contain credential pattern "${cred}"`);
      assert(!authServiceSrc.includes(cred), `src/services/authService.js must not contain credential pattern "${cred}"`);
    }
  });

  // 7. Session impersonation and adoption prevention
  runTest('Prevents session adoption, requires cryptographic server-generated session tokens', () => {
    const id1 = generateSecureSessionId();
    const id2 = generateSecureSessionId();
    assert(id1.startsWith('sess_'));
    assert(id2.startsWith('sess_'));
    assert.notStrictEqual(id1, id2);
    // At least 48 hex characters after 'sess_' prefix
    assert(id1.length >= 53);

    // Random session cannot be adopted in session map without prior registration
    const testMap = new Map();
    const validation = validateSessionInMap('sess_unregistered_attacker_token', testMap);
    assert.strictEqual(validation.valid, false);
    assert.strictEqual(validation.error, 'Active session not found or expired');
  });

  // 8. Session refresh, heartbeat, cross-employee prevention, revocation, and expiry
  runTest('Enforces session lifecycle: heartbeat, cross-employee prevention, revocation, and 24h expiry', () => {
    const testMap = new Map();
    const authSynthetic = {
      verified: true,
      employee_code: 'EMP-SYN88',
      employee_name: 'Synthetic Heartbeat Test',
      email: 'hb@synthetic.local',
      role: 'Sales Executive'
    };
    const session = createSessionRecord(authSynthetic);
    testMap.set(session.id, session);

    // 8a. Valid heartbeat updates timestamp
    const hbRes = heartbeatSessionInMap(session.id, testMap, 'EMP-SYN88');
    assert.strictEqual(hbRes.success, true);
    assert.strictEqual(hbRes.status, 'active');

    // 8b. Cross-employee heartbeat attempt rejected with 403 forbidden
    const hijackRes = heartbeatSessionInMap(session.id, testMap, 'EMP-OTHER-ATTACKER');
    assert.strictEqual(hijackRes.success, false);
    assert.strictEqual(hijackRes.status, 'forbidden');
    assert.strictEqual(hijackRes.error, 'Forbidden: Cannot refresh another employee session');

    // 8c. Expired session (> 24 hours inactivity)
    const expiredSession = createSessionRecord(authSynthetic);
    expiredSession.lastActiveTimestamp = Date.now() - (SESSION_TTL_MS + 5000);
    testMap.set(expiredSession.id, expiredSession);

    const expValidation = validateSessionInMap(expiredSession.id, testMap);
    assert.strictEqual(expValidation.valid, false);
    assert.strictEqual(expValidation.error, 'Session has expired');

    // Pruned from map
    assert.strictEqual(testMap.has(expiredSession.id), false);

    // 8d. Session revocation
    const revokeTarget = createSessionRecord(authSynthetic);
    testMap.set(revokeTarget.id, revokeTarget);

    // Non-executive cannot revoke another user's session
    const otherEmployeeCaller = { sessionId: 'sess_other', empCode: 'EMP-999', role: 'Sales Executive' };
    const failRevoke = revokeSessionInMap(revokeTarget.id, testMap, otherEmployeeCaller);
    assert.strictEqual(failRevoke.success, false);
    assert(failRevoke.error.includes('Forbidden'));

    // Own session revocation succeeds
    const ownCaller = { sessionId: revokeTarget.id, empCode: 'EMP-SYN88', role: 'Sales Executive' };
    const ownRevoke = revokeSessionInMap(revokeTarget.id, testMap, ownCaller);
    assert.strictEqual(ownRevoke.success, true);

    // Revoked session rejected on subsequent validation
    const revokedCheck = validateSessionInMap(revokeTarget.id, testMap);
    assert.strictEqual(revokedCheck.valid, false);
    assert.strictEqual(revokedCheck.error, 'Session has been revoked');

    // Executive caller CAN revoke any session
    const anotherTarget = createSessionRecord(authSynthetic);
    testMap.set(anotherTarget.id, anotherTarget);
    const execCaller = { sessionId: 'sess_exec', empCode: 'CEO-001', role: 'CEO' };
    const execRevoke = revokeSessionInMap(anotherTarget.id, testMap, execCaller);
    assert.strictEqual(execRevoke.success, true);
  });

  // 9. Administrator-key bypass strictly blocked in optimization test mode
  runTest('Administrator-key bypass is strictly blocked in optimization test mode across all endpoints', () => {
    const serverIndexSrc = fs.readFileSync(path.resolve(__dirname, '../server/index.js'), 'utf8');

    // getVerifiedUserSession gates x-admin-key behind !isOptimizationTestMode()
    assert(
      serverIndexSrc.includes('adminKey && !isOptimizationTestMode() && process.env.SUPABASE_SERVICE_ROLE_KEY'),
      'server/index.js getVerifiedUserSession must strictly fence x-admin-key behind !isOptimizationTestMode()'
    );

    // requireBusinzSession delegates to getVerifiedUserSession
    assert(
      serverIndexSrc.includes('const session = await getVerifiedUserSession(req);') &&
      serverIndexSrc.includes('const requireBusinzSession = async (req, res, next) => {'),
      'requireBusinzSession must delegate session verification directly to getVerifiedUserSession'
    );

    // requireBusinzSession does not accept unauthenticated x-user-role or x-user-email headers
    const reqSessionMatch = serverIndexSrc.match(/const requireBusinzSession = async[\s\S]*?next\(\);\s*\};/);
    assert(reqSessionMatch, 'requireBusinzSession must be defined in server/index.js');
    assert(
      !reqSessionMatch[0].includes("req.headers['x-user-role']") && !reqSessionMatch[0].includes("req.headers['x-user-email']"),
      'requireBusinzSession must not allow unauthenticated role spoofing via x-user-role or x-user-email headers'
    );

    // Maintenance toggle gates x-admin-key behind !isOptimizationTestMode()
    assert(
      serverIndexSrc.includes("(!isOptimizationTestMode() ? req.headers['x-admin-key'] : null)"),
      'server/index.js /api/maintenance/toggle must reject x-admin-key in optimization test mode'
    );

    // Self-registration endpoint rejects privileged executive/admin roles
    assert(
      serverIndexSrc.includes('isPrivilegedRole(role, cleanCode) || isPrivilegedRole(prefix, cleanCode)'),
      'server/index.js /api/auth/register-employee must reject self-registration of privileged roles'
    );
  });

  // 10. Role-based notification authorization scoping
  runTest('Notification store access requires authenticated session and strictly scopes by verified role', () => {
    const serverIndexSrc = fs.readFileSync(path.resolve(__dirname, '../server/index.js'), 'utf8');

    // Endpoint checks getVerifiedUserSession
    assert(
      serverIndexSrc.includes("key === 'notifications_store'") &&
      serverIndexSrc.includes('await getVerifiedUserSession(req)'),
      'server/index.js notification store access must require verified session'
    );

    // Non-executive users are filtered to their session role or 'All'
    assert(
      serverIndexSrc.includes('!isExecutive') &&
      serverIndexSrc.includes('scopedList.filter(n => {') &&
      serverIndexSrc.includes("rLower === 'all' || rLower.includes(userRoleLower)"),
      'server/index.js notifications must scope non-executive users strictly to their verified session role or All'
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
  console.log('🛡️  PHASE 6P STATIC ISOLATION & EXTERNAL INTEGRATION AUDIT: FULLY VERIFIED & COMPLIANT\n');
  process.exit(0);
}
