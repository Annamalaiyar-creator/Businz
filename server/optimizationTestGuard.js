/**
 * server/optimizationTestGuard.js
 * 
 * BUSINZ ERP: Hardened Fail-Closed Optimization Test Environment Guard (Phase 6B)
 * Enforces absolute isolation for optimization testing environments.
 * 
 * Key Invariants:
 * 1. Requires PORT=5101 when BUSINZ_OPTIMIZATION_TEST_MODE is enabled.
 * 2. Strictly rejects Production (5001) and Development (5002) ports.
 * 3. Requires exact database name: "businz_optimization_test".
 * 4. Requires TCP host "127.0.0.1" (rejects "localhost", Unix sockets, alternate hosts).
 * 5. Rejects URL query parameters, service overrides, and socket redirection.
 * 6. Requires dedicated test role "businz_test_user" (rejects "postgres", "root", production users).
 * 7. Rejects production, development, HRMS, and unverified database targets.
 * 8. Requires storage strictly inside "/var/www/businz-optimization-test/storage" (rejects symlink escapes).
 * 9. Independently validates data, uploads, backups, and WhatsApp session paths.
 * 10. Masks credentials in all errors and logs.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const REQUIRED_TEST_PORT = '5101';
export const REQUIRED_TEST_DATABASE = 'businz_optimization_test';
export const REQUIRED_TEST_DB_ROLE = 'businz_test_user';
export const REQUIRED_TEST_HOST = '127.0.0.1';
export const REQUIRED_TEST_BIND_HOST = '127.0.0.1';
export const APPROVED_TEST_STORAGE_ROOT = '/var/www/businz-optimization-test/storage';

/**
 * Returns the bind host for Express server.
 * In test mode: strictly binds to loopback 127.0.0.1 (blocking external network access).
 * In normal mode: returns undefined (Node default 0.0.0.0 / ::).
 */
export function getServerBindHost() {
  if (isOptimizationTestMode()) {
    return REQUIRED_TEST_BIND_HOST;
  }
  return undefined;
}

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
 * Checks whether optimization test mode is active.
 */
export function isOptimizationTestMode() {
  return (
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE === 'true' ||
    process.env.BUSINZ_OPTIMIZATION_TEST_MODE === '1'
  );
}

/**
 * Masks credentials in connection strings, error messages, or logs.
 */
export function maskCredentials(str = '') {
  if (typeof str !== 'string') return '';
  return str
    .replace(/:([^:@]+)@/, ':••••••••@')
    .replace(/(password|secret|key|token)=([^&]+)/gi, '$1=••••••••');
}

/**
 * Extracts database name, host, user, port, and query parameter presence.
 */
export function parseDatabaseTarget(connectionString = '') {
  let dbName = '';
  let host = '';
  let user = '';
  let port = '';
  let hasQueryParams = false;
  let queryParamsList = [];

  const rawConn = String(connectionString || '').trim();

  // Reject Unix domain socket strings immediately
  if (rawConn) {
    if (rawConn.includes('/var/run/postgresql') || rawConn.includes('.s.PGSQL') || rawConn.includes('socket=')) {
      throw new Error(
        `[TEST-MODE-FAIL-CLOSED] Unix domain socket redirection strictly rejected in optimization test mode. Must use TCP host 127.0.0.1.`
      );
    }
  }

  if (rawConn) {
    let parsedUrl = null;
    try {
      parsedUrl = new URL(rawConn.replace('postgresql://', 'http://').replace('postgres://', 'http://'));
    } catch (err) {
      throw new Error(`[TEST-MODE-FAIL-CLOSED] Malformed database connection URL: ${maskCredentials(err.message)}`);
    }

    dbName = parsedUrl.pathname.replace(/^\/+/, '');
    host = parsedUrl.hostname;
    user = decodeURIComponent(parsedUrl.username || '');
    port = parsedUrl.port;

    if (parsedUrl.search && parsedUrl.search.length > 1) {
      hasQueryParams = true;
      queryParamsList = Array.from(parsedUrl.searchParams.keys());
    }
  }

  if (!dbName) {
    dbName = (process.env.BUSINZ_TEST_DATABASE || process.env.PGDATABASE || '').trim();
  }
  if (!host) {
    host = (process.env.PGHOST || '').trim();
  }
  if (!user) {
    user = (process.env.BUSINZ_TEST_DB_USER || process.env.PGUSER || '').trim();
  }
  if (!port) {
    port = (process.env.PGPORT || '5432').trim();
  }

  return { dbName, host, user, port, hasQueryParams, queryParamsList };
}

/**
 * Validates database target against hardened optimization test rules.
 * Fails closed immediately if anything is unverified or matches forbidden targets.
 */
export function validateDatabaseConfigForTestMode(connectionString = '') {
  if (!isOptimizationTestMode()) return;

  const rawConn = String(connectionString || '').trim();

  // 1. Reject Unix socket redirection or alternate path configurations before URL parsing
  if (rawConn) {
    if (rawConn.includes('/var/run/postgresql') || rawConn.includes('.s.PGSQL') || rawConn.includes('socket=')) {
      throw new Error(
        `[TEST-MODE-FAIL-CLOSED] Unix domain socket redirection strictly rejected in optimization test mode. Must use TCP host 127.0.0.1.`
      );
    }
  }

  // 2. Connection URL query parameters check: REJECT all overrides
  const { dbName, host, user, hasQueryParams, queryParamsList } = parseDatabaseTarget(rawConn);

  if (hasQueryParams) {
    throw new Error(
      `[TEST-MODE-FAIL-CLOSED] Database connection overrides strictly rejected! ` +
      `URL query parameters are forbidden in optimization test mode. Detected: [${queryParamsList.join(', ')}].`
    );
  }

  // 3. Database name validation
  if (!dbName) {
    throw new Error(
      `[TEST-MODE-FAIL-CLOSED] Optimization test mode requires an explicitly configured test database. ` +
      `Dedicated test database must be "${REQUIRED_TEST_DATABASE}".`
    );
  }

  const normalizedDb = dbName.toLowerCase().trim();

  // If not the exact designated test database, identify and reject specific forbidden target
  if (normalizedDb !== REQUIRED_TEST_DATABASE) {
    for (const forbidden of FORBIDDEN_DATABASE_NAMES) {
      if (normalizedDb === forbidden || normalizedDb.startsWith(`${forbidden}_`) || normalizedDb.startsWith(`${forbidden}-`)) {
        throw new Error(
          `[TEST-MODE-FAIL-CLOSED] FORBIDDEN DATABASE TARGET "${maskCredentials(dbName)}"! ` +
          `Optimization test mode strictly refuses to connect to production, development, or HRMS databases. ` +
          `Configured database must be "${REQUIRED_TEST_DATABASE}".`
        );
      }
    }
    throw new Error(
      `[TEST-MODE-FAIL-CLOSED] Unverified database target "${maskCredentials(dbName)}". ` +
      `Optimization test mode requires dedicated database "${REQUIRED_TEST_DATABASE}".`
    );
  }

  // 4. Host validation: Strictly 127.0.0.1 (reject localhost, remote hosts, domain names, unix sockets)
  const normalizedHost = (host || '').toLowerCase().trim();
  if (!normalizedHost) {
    throw new Error(`[TEST-MODE-FAIL-CLOSED] Missing database host. Must be explicitly set to 127.0.0.1.`);
  }
  if (normalizedHost === 'localhost') {
    throw new Error(
      `[TEST-MODE-FAIL-CLOSED] Host "localhost" is ambiguous and may resolve to Unix socket. Must be explicitly set to 127.0.0.1.`
    );
  }
  if (normalizedHost !== REQUIRED_TEST_HOST) {
    throw new Error(
      `[TEST-MODE-FAIL-CLOSED] Alternate database host "${normalizedHost}" strictly rejected. ` +
      `Optimization test database must reside on local instance (127.0.0.1).`
    );
  }

  // 5. User / Role validation: Dedicated test role required (reject postgres, root, businz, etc.)
  const normalizedUser = (user || '').toLowerCase().trim();
  if (!normalizedUser) {
    throw new Error(
      `[TEST-MODE-FAIL-CLOSED] Missing database user/role. Optimization test mode requires dedicated test role "${REQUIRED_TEST_DB_ROLE}".`
    );
  }
  if (normalizedUser !== REQUIRED_TEST_DB_ROLE) {
    for (const forbiddenRole of FORBIDDEN_DATABASE_ROLES) {
      if (normalizedUser === forbiddenRole || normalizedUser.startsWith(`${forbiddenRole}_`)) {
        throw new Error(
          `[TEST-MODE-FAIL-CLOSED] FORBIDDEN DATABASE ROLE "${user}"! ` +
          `Optimization test mode strictly refuses superuser "postgres" or production database users. ` +
          `Must connect as dedicated test role "${REQUIRED_TEST_DB_ROLE}".`
        );
      }
    }
    throw new Error(
      `[TEST-MODE-FAIL-CLOSED] Invalid database role "${user}". ` +
      `Optimization test mode requires dedicated role "${REQUIRED_TEST_DB_ROLE}".`
    );
  }
}

/**
 * Checks whether a path resides strictly within approved test storage root.
 */
export function isPathInsideApprovedStorage(targetPath, approvedRoot = APPROVED_TEST_STORAGE_ROOT) {
  const resolved = path.resolve(targetPath);
  const normalized = resolved.replace(/\\/g, '/').toLowerCase();
  const normalizedRoot = path.resolve(approvedRoot).replace(/\\/g, '/').toLowerCase();

  return normalized === normalizedRoot || normalized.startsWith(`${normalizedRoot}/`);
}

/**
 * Detects and rejects symbolic links that redirect storage outside the designated test directory.
 */
export function checkSymlinkRedirection(targetPath, approvedRoot = APPROVED_TEST_STORAGE_ROOT) {
  const resolved = path.resolve(targetPath);
  const normalizedApproved = path.resolve(approvedRoot);
  let realApproved = normalizedApproved;
  try {
    if (fs.existsSync(normalizedApproved)) {
      realApproved = fs.realpathSync(normalizedApproved);
    }
  } catch (_) {}

  // Only inspect paths at or below the approvedRoot boundary
  let current = resolved;
  while (current && current.length >= normalizedApproved.length) {
    if (fs.existsSync(current)) {
      try {
        const lstat = fs.lstatSync(current);
        if (lstat.isSymbolicLink()) {
          const real = fs.realpathSync(current);
          const isSafe = isPathInsideApprovedStorage(real, normalizedApproved) ||
                         isPathInsideApprovedStorage(real, realApproved);
          if (!isSafe) {
            throw new Error(
              `[STORAGE-FAIL-CLOSED] Symbolic link "${current}" points to "${real}" outside approved storage "${approvedRoot}".`
            );
          }
        }
        const real = fs.realpathSync(current);
        const isSafe = isPathInsideApprovedStorage(real, normalizedApproved) ||
                       isPathInsideApprovedStorage(real, realApproved);
        if (!isSafe && current !== normalizedApproved) {
          throw new Error(
            `[STORAGE-FAIL-CLOSED] Real path "${real}" escapes approved storage root "${approvedRoot}".`
          );
        }
      } catch (err) {
        if (err.message.includes('[STORAGE-FAIL-CLOSED]')) throw err;
      }
    }
    if (current === normalizedApproved) break;
    current = path.dirname(current);
  }
}

/**
 * Validates an individual storage path independently.
 */
export function validateSingleStoragePath(pathName, rawPath, approvedRoot = APPROVED_TEST_STORAGE_ROOT) {
  if (!rawPath || !String(rawPath).trim()) {
    throw new Error(
      `[TEST-MODE-FAIL-CLOSED] Missing ${pathName}. Must be explicitly configured inside "${approvedRoot}".`
    );
  }

  const resolved = path.resolve(rawPath.trim());
  const normalized = resolved.replace(/\\/g, '/').toLowerCase();

  // Reject production, development, and HRMS directories
  const forbiddenDirs = [
    '/var/www/businz',
    '/var/www/businz-dev',
    '/var/www/hrms',
    '/var/www/hrms-dev'
  ];

  for (const forbidden of forbiddenDirs) {
    const normForbidden = path.resolve(forbidden).replace(/\\/g, '/').toLowerCase();
    if (normalized === normForbidden || normalized.startsWith(`${normForbidden}/`)) {
      throw new Error(
        `[TEST-MODE-FAIL-CLOSED] Refusing to use ${pathName} pointing to production/development/HRMS directory "${resolved}".`
      );
    }
  }

  // Must be strictly inside approvedRoot
  if (!isPathInsideApprovedStorage(resolved, approvedRoot)) {
    throw new Error(
      `[TEST-MODE-FAIL-CLOSED] ${pathName} "${resolved}" is outside approved test directory "${approvedRoot}".`
    );
  }

  // Symlink escape check
  checkSymlinkRedirection(resolved, approvedRoot);
}

/**
 * Validates storage path configuration for optimization test mode.
 * Independently validates data, uploads, backups, and WhatsApp session paths.
 */
export function validateStorageConfigForTestMode() {
  if (!isOptimizationTestMode()) return;

  const dataDir = (process.env.BUSINZ_DATA_DIR || '').trim();
  validateSingleStoragePath('BUSINZ_DATA_DIR', dataDir);

  const uploadsDir = (process.env.BUSINZ_UPLOADS_DIR || path.join(dataDir, 'uploads')).trim();
  validateSingleStoragePath('BUSINZ_UPLOADS_DIR', uploadsDir);

  const backupsDir = (process.env.BUSINZ_BACKUP_DIR || path.join(dataDir, 'backups')).trim();
  validateSingleStoragePath('BUSINZ_BACKUP_DIR', backupsDir);

  const waDir = (process.env.BUSINZ_WA_SESSIONS_DIR || path.join(dataDir, 'wa_sessions')).trim();
  validateSingleStoragePath('BUSINZ_WA_SESSIONS_DIR', waDir);
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
