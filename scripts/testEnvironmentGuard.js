/**
 * scripts/testEnvironmentGuard.js
 * 
 * BUSINZ ERP: Test Suite Safety & Hardened Fail-Closed Isolation Guard (Phase 6B)
 * 
 * Guarantees:
 * 1. Test scripts MUST explicitly target the optimization test environment (PORT=5101).
 * 2. Strictly prevents tests from running against Production (5001) or Development (5002).
 * 3. Requires exact database name "businz_optimization_test".
 * 4. Requires TCP host "127.0.0.1" (rejects "localhost", Unix sockets, alternate hosts).
 * 5. Rejects URL query parameters, service overrides, and socket redirection.
 * 6. Requires dedicated test role "businz_test_user" (rejects "postgres", "root", production users).
 * 7. Strictly rejects connection to production, development, HRMS, and unverified targets.
 * 8. Never exposes credentials in logs or errors.
 */

export const FORBIDDEN_PORTS = ['5001', '5002'];
export const REQUIRED_TEST_PORT = '5101';
export const REQUIRED_TEST_DATABASE = 'businz_optimization_test';
export const REQUIRED_TEST_DB_ROLE = 'businz_test_user';
export const REQUIRED_TEST_HOST = '127.0.0.1';

export const FORBIDDEN_DATABASES = [
  'businz',
  'businz_prod',
  'businz_production',
  'businz-prod',
  'businz_dev',
  'businz-dev',
  'businz_development',
  'controlroom',
  'postgres',
  'template1',
  'hrms',
  'businz_hrms',
  'hrms_prod',
  'hrms_dev',
  'hrms_development'
];

export const FORBIDDEN_DATABASE_ROLES = [
  'postgres',
  'root',
  'admin',
  'businz',
  'businz_user',
  'businz_dev',
  'controlroom',
  'hrms',
  'hrms_user'
];

/**
 * Masks credentials in connection strings or error messages.
 */
export function maskCredentials(str = '') {
  if (typeof str !== 'string') return '';
  return str
    .replace(/:([^:@]+)@/, ':••••••••@')
    .replace(/(password|secret|key|token)=([^&]+)/gi, '$1=••••••••');
}

/**
 * Resolves and validates the test API URL.
 * Throws immediately if missing, points to production (5001), dev (5002), or any unverified port.
 */
export function resolveAndValidateTestApiUrl(explicitUrl = null) {
  const rawUrl = String(
    explicitUrl ||
    process.env.BUSINZ_TEST_API_URL ||
    process.env.TEST_API_URL ||
    ''
  ).trim();

  if (!rawUrl) {
    throw new Error(
      '[TEST-SAFETY-FAIL-CLOSED] Missing test API URL! ' +
      'Set BUSINZ_TEST_API_URL=http://127.0.0.1:5101. ' +
      'Silent fallbacks to production (5001) or development (5002) are strictly prohibited.'
    );
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (err) {
    throw new Error(`[TEST-SAFETY-FAIL-CLOSED] Malformed test API URL "${maskCredentials(rawUrl)}": ${err.message}`);
  }

  const port = String(parsed.port || (parsed.protocol === 'https:' ? '443' : '80'));

  if (FORBIDDEN_PORTS.includes(port)) {
    throw new Error(
      `[TEST-SAFETY-FAIL-CLOSED] FORBIDDEN TARGET PORT "${port}"! ` +
      `Test suite strictly refuses to run against Production (5001) or Development (5002). ` +
      `Dedicated test server must run on PORT=${REQUIRED_TEST_PORT}.`
    );
  }

  if (port !== REQUIRED_TEST_PORT) {
    throw new Error(
      `[TEST-SAFETY-FAIL-CLOSED] Invalid target port "${port}". ` +
      `Optimization test environment requires PORT=${REQUIRED_TEST_PORT}.`
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== '127.0.0.1') {
    throw new Error(
      `[TEST-SAFETY-FAIL-CLOSED] Target host "${hostname}" strictly rejected. ` +
      `Test API must be explicitly addressed at 127.0.0.1 (not "localhost" or remote host).`
    );
  }

  return rawUrl.replace(/\/+$/, '');
}

/**
 * Resolves and validates the test database connection string.
 * Fails closed if missing, targets production/dev/HRMS, uses wrong role, or has query parameters.
 */
export function resolveAndValidateTestDatabaseUrl(explicitConnStr = null) {
  const connStr = String(
    explicitConnStr ||
    process.env.BUSINZ_TEST_DATABASE_URL ||
    process.env.TEST_DATABASE_URL ||
    ''
  ).trim();

  if (!connStr) {
    throw new Error(
      '[TEST-SAFETY-FAIL-CLOSED] Missing test database connection URL! ' +
      'Set BUSINZ_TEST_DATABASE_URL=postgresql://businz_test_user:password@127.0.0.1:5432/businz_optimization_test. ' +
      'Silent fallbacks to production or development databases are strictly prohibited.'
    );
  }

  // 1. Reject Unix domain sockets before URL parsing
  if (connStr.includes('/var/run/postgresql') || connStr.includes('.s.PGSQL') || connStr.includes('socket=')) {
    throw new Error(
      `[TEST-SAFETY-FAIL-CLOSED] Unix domain socket redirection strictly rejected in test mode. Must use TCP host 127.0.0.1.`
    );
  }

  // 2. Check for URL query parameter overrides
  let url = null;
  try {
    url = new URL(connStr.replace('postgresql://', 'http://').replace('postgres://', 'http://'));
  } catch (err) {
    throw new Error(`[TEST-SAFETY-FAIL-CLOSED] Malformed connection string: ${maskCredentials(err.message)}`);
  }

  if (url.search && url.search.length > 1) {
    const keys = Array.from(url.searchParams.keys());
    throw new Error(
      `[TEST-SAFETY-FAIL-CLOSED] Database connection overrides strictly rejected! ` +
      `URL query parameters are forbidden in test connection. Detected: [${keys.join(', ')}].`
    );
  }

  const dbName = url.pathname.replace(/^\/+/, '');
  const host = url.hostname;
  const user = decodeURIComponent(url.username || '');

  // 3. Database name validation
  if (!dbName) {
    throw new Error(
      '[TEST-SAFETY-FAIL-CLOSED] Could not determine database name from connection string. ' +
      `Dedicated test database must be "${REQUIRED_TEST_DATABASE}".`
    );
  }

  const normalizedDb = dbName.toLowerCase().trim();

  // If not the exact designated test database, identify and reject specific forbidden target
  if (normalizedDb !== REQUIRED_TEST_DATABASE) {
    for (const forbidden of FORBIDDEN_DATABASES) {
      if (normalizedDb === forbidden || normalizedDb.startsWith(`${forbidden}_`) || normalizedDb.startsWith(`${forbidden}-`)) {
        throw new Error(
          `[TEST-SAFETY-FAIL-CLOSED] FORBIDDEN DATABASE TARGET "${maskCredentials(dbName)}"! ` +
          `Test suite strictly refuses to connect to production, development, or HRMS databases. ` +
          `Required test database is "${REQUIRED_TEST_DATABASE}".`
        );
      }
    }
    throw new Error(
      `[TEST-SAFETY-FAIL-CLOSED] Unverified database target "${maskCredentials(dbName)}". ` +
      `Test suite strictly requires dedicated database "${REQUIRED_TEST_DATABASE}".`
    );
  }

  // 4. Host validation: Strictly 127.0.0.1
  const normalizedHost = (host || '').toLowerCase().trim();
  if (normalizedHost === 'localhost') {
    throw new Error(
      `[TEST-SAFETY-FAIL-CLOSED] Host "localhost" is ambiguous and may resolve to Unix socket. Must be explicitly set to 127.0.0.1.`
    );
  }
  if (normalizedHost !== REQUIRED_TEST_HOST) {
    throw new Error(
      `[TEST-SAFETY-FAIL-CLOSED] Unverified database host "${normalizedHost}". ` +
      `Test database host must be local (127.0.0.1).`
    );
  }

  // 5. User / Role validation: Dedicated test role required (reject postgres, root, etc.)
  const normalizedUser = (user || '').toLowerCase().trim();
  if (!normalizedUser) {
    throw new Error(
      `[TEST-SAFETY-FAIL-CLOSED] Missing database user/role. Test suite requires dedicated test role "${REQUIRED_TEST_DB_ROLE}".`
    );
  }
  if (normalizedUser !== REQUIRED_TEST_DB_ROLE) {
    for (const forbiddenRole of FORBIDDEN_DATABASE_ROLES) {
      if (normalizedUser === forbiddenRole || normalizedUser.startsWith(`${forbiddenRole}_`)) {
        throw new Error(
          `[TEST-SAFETY-FAIL-CLOSED] FORBIDDEN DATABASE ROLE "${user}"! ` +
          `Test suite strictly refuses superuser "postgres" or production database users. ` +
          `Must connect as dedicated test role "${REQUIRED_TEST_DB_ROLE}".`
        );
      }
    }
    throw new Error(
      `[TEST-SAFETY-FAIL-CLOSED] Invalid database role "${user}". ` +
      `Test suite requires dedicated role "${REQUIRED_TEST_DB_ROLE}".`
    );
  }

  return connStr;
}
