/**
 * server/optimizationTestGuard.js
 * 
 * BUSINZ ERP: Fail-Closed Optimization Test Environment Guard (Phase 5D)
 * Enforces absolute isolation for optimization testing environments.
 * 
 * Key Invariants:
 * 1. Requires PORT=5101 when BUSINZ_OPTIMIZATION_TEST_MODE is enabled.
 * 2. Strictly rejects Production (5001) and Development (5002) ports.
 * 3. Requires an explicitly configured test database: "businz_optimization_test".
 * 4. Strictly rejects production and development database targets.
 * 5. Requires dedicated test-only storage path (BUSINZ_DATA_DIR), rejecting production/dev paths.
 * 6. Disables scheduled background jobs, WhatsApp sockets, and third-party API calls.
 * 7. Fails closed before any database connections or side-effects can execute.
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const REQUIRED_TEST_PORT = '5101';
export const REQUIRED_TEST_DATABASE = 'businz_optimization_test';
export const FORBIDDEN_PORTS = ['5001', '5002'];

export const FORBIDDEN_DATABASE_NAMES = [
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
 * Checks whether optimization test mode is active.
 */
export function isOptimizationTestMode() {
  return (
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE === 'true' ||
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE === '1'
  );
}

/**
 * Extracts database name and host from connection string or individual environment variables.
 */
export function parseDatabaseTarget(connectionString = '') {
  let dbName = '';
  let host = '';

  const rawConn = String(connectionString || '').trim();
  if (rawConn) {
    try {
      const url = new URL(rawConn.replace('postgresql://', 'http://').replace('postgres://', 'http://'));
      dbName = url.pathname.replace(/^\/+/, '');
      host = url.hostname;
    } catch (_) {
      const match = rawConn.match(/\/([a-zA-Z0-9_-]+)(?:\?.*)?$/);
      if (match) dbName = match[1];
    }
  }

  if (!dbName) {
    dbName = (process.env.BUSINZ_TEST_DATABASE || process.env.PGDATABASE || '').trim();
  }
  if (!host) {
    host = (process.env.PGHOST || '127.0.0.1').trim();
  }

  return { dbName, host };
}

/**
 * Validates database target against optimization test rules.
 * Fails closed immediately if anything is unverified or matches production/development.
 */
export function validateDatabaseConfigForTestMode(connectionString = '') {
  if (!isOptimizationTestMode()) return;

  const { dbName, host } = parseDatabaseTarget(connectionString);

  if (!dbName) {
    throw new Error(
      `[TEST-MODE-FAIL-CLOSED] Optimization test mode requires an explicitly configured test database. ` +
      `Dedicated test database must be "${REQUIRED_TEST_DATABASE}".`
    );
  }

  const normalizedDb = dbName.toLowerCase().trim();

  // 1. If not the exact designated test database, identify and reject specific forbidden target
  if (normalizedDb !== REQUIRED_TEST_DATABASE) {
    for (const forbidden of FORBIDDEN_DATABASE_NAMES) {
      if (normalizedDb === forbidden || normalizedDb.startsWith(`${forbidden}_`) || normalizedDb.startsWith(`${forbidden}-`)) {
        throw new Error(
          `[TEST-MODE-FAIL-CLOSED] FORBIDDEN DATABASE TARGET "${dbName}"! ` +
          `Optimization test mode strictly refuses to connect to production or development databases. ` +
          `Configured database must be "${REQUIRED_TEST_DATABASE}".`
        );
      }
    }
    throw new Error(
      `[TEST-MODE-FAIL-CLOSED] Unverified database target "${dbName}". ` +
      `Optimization test mode requires dedicated database "${REQUIRED_TEST_DATABASE}".`
    );
  }

  // 2. Enforce local host target
  const normalizedHost = (host || '').toLowerCase().trim();
  if (!['127.0.0.1', 'localhost'].includes(normalizedHost)) {
    throw new Error(
      `[TEST-MODE-FAIL-CLOSED] Unverified database host "${host}". ` +
      `Optimization test database host must be local (127.0.0.1 or localhost).`
    );
  }
}

/**
 * Validates storage path configuration for optimization test mode.
 */
export function validateStorageConfigForTestMode() {
  if (!isOptimizationTestMode()) return;

  const dataDir = process.env.BUSINZ_DATA_DIR ? process.env.BUSINZ_DATA_DIR.trim() : '';
  if (!dataDir) {
    throw new Error(
      `[TEST-MODE-FAIL-CLOSED] Optimization test mode requires an explicit BUSINZ_DATA_DIR. ` +
      `Must point to an isolated test storage directory (e.g. /var/www/businz-optimization-test/storage).`
    );
  }

  const resolved = path.resolve(dataDir);
  const normalized = resolved.toLowerCase();

  // Reject production, development, and repository source directories
  if (
    normalized.includes('/var/www/businz/') ||
    normalized === '/var/www/businz' ||
    normalized.includes('/var/www/businz-dev/') ||
    normalized === '/var/www/businz-dev' ||
    resolved === path.resolve(__dirname) ||
    resolved === path.resolve(__dirname, '..')
  ) {
    throw new Error(
      `[TEST-MODE-FAIL-CLOSED] Refusing to use production or development storage path "${resolved}". ` +
      `Dedicated test storage must be completely isolated.`
    );
  }
}

/**
 * Validates port configuration for optimization test mode.
 */
export function validatePortForTestMode() {
  if (!isOptimizationTestMode()) return;

  const port = String(process.env.PORT || '').trim();
  if (!port) {
    throw new Error(
      `[TEST-MODE-FAIL-CLOSED] Optimization test mode requires explicit PORT=${REQUIRED_TEST_PORT}. None provided.`
    );
  }

  if (FORBIDDEN_PORTS.includes(port)) {
    throw new Error(
      `[TEST-MODE-FAIL-CLOSED] FORBIDDEN PORT "${port}"! ` +
      `Optimization test mode strictly refuses production (5001) and development (5002) ports. ` +
      `Must use PORT=${REQUIRED_TEST_PORT}.`
    );
  }

  if (port !== REQUIRED_TEST_PORT) {
    throw new Error(
      `[TEST-MODE-FAIL-CLOSED] Invalid port "${port}". ` +
      `Optimization test mode requires PORT=${REQUIRED_TEST_PORT}.`
    );
  }
}

/**
 * Permission checks for operations in test mode.
 */
export function areBackgroundJobsAllowed() {
  return !isOptimizationTestMode();
}

export function isWhatsAppRestorationAllowed() {
  return !isOptimizationTestMode();
}

export function isWhatsAppOutboundAllowed() {
  return !isOptimizationTestMode();
}

export function areExternalIntegrationsAllowed() {
  return !isOptimizationTestMode();
}

/**
 * Master pre-flight validation routine.
 * Enforces all test mode isolation invariants before connections or side-effects can run.
 */
export function enforceOptimizationTestPreflight() {
  if (!isOptimizationTestMode()) return;

  validatePortForTestMode();
  validateStorageConfigForTestMode();

  const connStr = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING || '';
  validateDatabaseConfigForTestMode(connStr);
}

// Automatically enforce preflight check if optimization test mode is active on module load
if (isOptimizationTestMode()) {
  enforceOptimizationTestPreflight();
}
