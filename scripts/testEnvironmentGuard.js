/**
 * scripts/testEnvironmentGuard.js
 * 
 * BUSINZ ERP: Test Suite Safety & Fail-Closed Isolation Guard (Phase 5D)
 * 
 * Guarantees:
 * 1. Test scripts MUST explicitly target the optimization test environment (PORT=5101).
 * 2. Absolutely prevents tests from silently running against Production (5001) or Development (5002).
 * 3. Test scripts requiring database access MUST explicitly target "businz_optimization_test".
 * 4. Absolutely prevents tests from connecting to production ("businz") or active dev ("businz_dev").
 * 5. Rejects non-local host destinations.
 */

export const FORBIDDEN_PORTS = ['5001', '5002'];
export const REQUIRED_TEST_PORT = '5101';
export const REQUIRED_TEST_DATABASE = 'businz_optimization_test';

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
  'template1'
];

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
    throw new Error(`[TEST-SAFETY-FAIL-CLOSED] Malformed test API URL "${rawUrl}": ${err.message}`);
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
  if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
    throw new Error(
      `[TEST-SAFETY-FAIL-CLOSED] Non-local target host "${hostname}" is forbidden for test execution. ` +
      `Target host must be 127.0.0.1 or localhost.`
    );
  }

  return rawUrl.replace(/\/+$/, '');
}

/**
 * Resolves and validates the test database connection string.
 * Throws immediately if missing, points to production or dev databases, or any unverified DB.
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
      'Set BUSINZ_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/businz_optimization_test. ' +
      'Silent fallbacks to production or development databases are strictly prohibited.'
    );
  }

  let dbName = '';
  let host = '';

  try {
    const url = new URL(connStr.replace('postgresql://', 'http://').replace('postgres://', 'http://'));
    dbName = url.pathname.replace(/^\/+/, '');
    host = url.hostname;
  } catch (_) {
    const match = connStr.match(/\/([a-zA-Z0-9_-]+)(?:\?.*)?$/);
    if (match) dbName = match[1];
  }

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
          `[TEST-SAFETY-FAIL-CLOSED] FORBIDDEN DATABASE TARGET "${dbName}"! ` +
          `Test suite strictly refuses to connect to production or development databases. ` +
          `Required test database is "${REQUIRED_TEST_DATABASE}".`
        );
      }
    }
    throw new Error(
      `[TEST-SAFETY-FAIL-CLOSED] Unverified database target "${dbName}". ` +
      `Test suite strictly requires dedicated database "${REQUIRED_TEST_DATABASE}".`
    );
  }

  const normalizedHost = (host || '').toLowerCase().trim();
  if (!['127.0.0.1', 'localhost'].includes(normalizedHost)) {
    throw new Error(
      `[TEST-SAFETY-FAIL-CLOSED] Unverified database host "${host}". ` +
      `Test database must reside on local instance (127.0.0.1 or localhost).`
    );
  }

  return connStr;
}
