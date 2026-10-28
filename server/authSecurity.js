/**
 * server/authSecurity.js
 * 
 * BUSINZ ERP: Critical Authentication and Session Security Hardening (Phase 8D)
 * 
 * Enforces strict authentication and session security invariants:
 * 1. Zero hardcoded operational employee credentials or fallback passwords in source.
 * 2. Strict password verifier requirement: Accounts with missing, null, or empty
 *    stored verifiers fail authentication unconditionally.
 * 3. Constant-time timing-safe password verification supporting salted SHA-256,
 *    scrypt, and backward-compatible plaintext verifiers.
 * 4. Server-generated cryptographic session identifiers (sess_<randomHex>).
 * 5. Strictly server-derived employee identity and role; caller-submitted roles are ignored.
 * 6. Heartbeat and session renewal require valid session ownership and enforce
 *    revocation and 24-hour inactivity expiry.
 * 7. Scoped administrator access: x-admin-key authentication bypass is strictly
 *    disabled in optimization test mode.
 * 8. Privileged roles (CEO, Technical Administrator, Director, MD) cannot be self-registered.
 */

import crypto from 'crypto';

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24-hour inactivity TTL

export const FORBIDDEN_SELF_REGISTER_ROLES = [
  'CEO',
  'Technical Administrator',
  'Director',
  'Managing Director',
  'MD',
  'Super Admin',
  'Admin'
];

/**
 * Normalizes employee code identifiers for case/delimiter-insensitive matching.
 */
export function normalizeEmployeeCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[-_\s]/g, '');
}

/**
 * Checks whether a given role or code is a privileged administrative/executive identity.
 */
export function isPrivilegedRole(role = '', code = '') {
  const cleanRole = String(role || '').trim().toLowerCase();
  const rawCode = String(code || '').trim().toUpperCase().replace(/[-_\s]/g, '');
  const normCode = normalizeEmployeeCode(code);

  const privilegedRoleMatches = [
    'ceo',
    'technical administrator',
    'director',
    'managing director',
    'md',
    'super admin',
    'admin'
  ].some(r => cleanRole === r || cleanRole.includes(r));

  const privilegedCodeMatches = (
    normCode.startsWith('TA') ||
    normCode.startsWith('CEO') ||
    normCode.startsWith('CE0') ||
    rawCode.startsWith('CEO') ||
    normCode.startsWith('DIR') ||
    normCode.startsWith('MD') ||
    normCode.startsWith('ADMIN')
  );

  return Boolean(privilegedRoleMatches || privilegedCodeMatches);
}

/**
 * Verifies candidate password against stored verifier using timing-safe comparisons.
 * Supports:
 * - sha256$salt$hash or sha256:salt:hash
 * - scrypt$salt$hash or scrypt:salt:hash
 * - constant-time direct comparison for existing unmigrated records
 * 
 * Rejects unconditionally if candidate or stored verifier is missing/empty.
 */
export function verifyPasswordVerifier(candidatePassword, storedVerifier) {
  if (typeof candidatePassword !== 'string' || candidatePassword.length === 0) {
    return false;
  }
  if (typeof storedVerifier !== 'string' || storedVerifier.trim().length === 0) {
    return false;
  }

  const cleanCandidate = candidatePassword;
  const cleanStored = storedVerifier.trim();

  // Salted SHA-256 or scrypt hash verification
  if (
    cleanStored.startsWith('sha256$') || cleanStored.startsWith('sha256:') ||
    cleanStored.startsWith('scrypt$') || cleanStored.startsWith('scrypt:')
  ) {
    const delimiter = cleanStored.includes(':') ? ':' : '$';
    const parts = cleanStored.split(delimiter);
    if (parts.length === 3) {
      const [algo, salt, expectedHash] = parts;
      try {
        let computedHash = '';
        if (algo === 'sha256') {
          computedHash = crypto.createHash('sha256').update(salt + cleanCandidate).digest('hex');
        } else if (algo === 'scrypt') {
          computedHash = crypto.scryptSync(cleanCandidate, salt, 64).toString('hex');
        }
        if (computedHash && expectedHash.length === computedHash.length) {
          return crypto.timingSafeEqual(
            Buffer.from(expectedHash, 'hex'),
            Buffer.from(computedHash, 'hex')
          );
        }
      } catch (_) {
        return false;
      }
    }
    return false;
  }

  // Constant-time direct comparison for existing unmigrated records
  if (cleanCandidate.length === cleanStored.length) {
    return crypto.timingSafeEqual(
      Buffer.from(cleanCandidate, 'utf8'),
      Buffer.from(cleanStored, 'utf8')
    );
  }

  return false;
}

/**
 * Creates a salted password verifier for secure identity provisioning.
 */
export function hashPassword(password, algo = 'sha256') {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  if (algo === 'scrypt') {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt$${salt}$${hash}`;
  }
  const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
  return `sha256$${salt}$${hash}`;
}

/**
 * Generates an unpredictable, cryptographically random server session token.
 */
export function generateSecureSessionId() {
  return `sess_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Validates employee record and authenticates credentials.
 * Fails closed if account is missing, has no verifier, or verifier does not match.
 */
export function authenticateEmployeeRecord(employeeRecord, password) {
  if (typeof password !== 'string' || password.length === 0) {
    return { verified: false, error: 'Password is required', status: 401 };
  }

  if (!employeeRecord || typeof employeeRecord !== 'object') {
    return { verified: false, error: 'Account not found', status: 404 };
  }

  // Mandatory stored verifier check: must not accept arbitrary passwords for records with missing/empty verifier
  if (
    !employeeRecord.password ||
    typeof employeeRecord.password !== 'string' ||
    employeeRecord.password.trim().length === 0
  ) {
    return {
      verified: false,
      error: 'Account has no valid password verifier configured. Please contact Technical Administrator.',
      status: 401
    };
  }

  if (!verifyPasswordVerifier(password, employeeRecord.password)) {
    return { verified: false, error: 'Invalid password', status: 401 };
  }

  if (employeeRecord.status && employeeRecord.status !== 'Active') {
    return { verified: false, error: `Account is ${employeeRecord.status}`, status: 403 };
  }

  return {
    verified: true,
    employee_code: employeeRecord.employee_code || employeeRecord.code || '',
    employee_name: employeeRecord.employee_name || employeeRecord.name || 'Employee',
    email: (employeeRecord.email || '').trim().toLowerCase(),
    role: employeeRecord.role || 'Employee'
  };
}

/**
 * Creates and registers a verified session object with server-derived properties.
 */
export function createSessionRecord(authResult, { device = 'Desktop PC', browser = 'Web Browser' } = {}) {
  const sessionId = generateSecureSessionId();
  const now = Date.now();

  return {
    id: sessionId,
    sessionId,
    empCode: authResult.employee_code,
    email: authResult.email,
    user: authResult.employee_name,
    role: authResult.role, // strictly server-derived
    device,
    browser,
    status: 'active',
    createdAt: now,
    lastActiveTimestamp: now,
    expiresAt: now + SESSION_TTL_MS
  };
}

/**
 * Validates an active session in the in-memory map.
 * Rejects revoked or expired sessions.
 */
export function validateSessionInMap(sessionId, activeSessionsMap) {
  if (!sessionId || typeof sessionId !== 'string') {
    return { valid: false, error: 'Session ID is required' };
  }
  const cleanId = sessionId.trim();
  if (!activeSessionsMap.has(cleanId)) {
    return { valid: false, error: 'Active session not found or expired' };
  }

  const s = activeSessionsMap.get(cleanId);
  if (!s || s.status === 'revoked') {
    return { valid: false, error: 'Session has been revoked' };
  }

  const now = Date.now();
  if ((now - (s.lastActiveTimestamp || 0)) > SESSION_TTL_MS || (s.expiresAt && now > s.expiresAt)) {
    activeSessionsMap.delete(cleanId);
    return { valid: false, error: 'Session has expired' };
  }

  return { valid: true, session: s };
}

/**
 * Refreshes an active session timestamp while enforcing caller identity.
 */
export function heartbeatSessionInMap(sessionId, activeSessionsMap, callerEmpCode = null) {
  const validation = validateSessionInMap(sessionId, activeSessionsMap);
  if (!validation.valid) {
    return { success: false, status: 'invalid', error: validation.error };
  }

  const s = validation.session;

  if (callerEmpCode) {
    if (normalizeEmployeeCode(callerEmpCode) !== normalizeEmployeeCode(s.empCode)) {
      return { success: false, status: 'forbidden', error: 'Forbidden: Cannot refresh another employee session' };
    }
  }

  const now = Date.now();
  s.lastActiveTimestamp = now;
  s.expiresAt = now + SESSION_TTL_MS;
  activeSessionsMap.set(s.id, s);

  return {
    success: true,
    status: 'active',
    sessionId: s.id,
    lastActiveTimestamp: s.lastActiveTimestamp,
    role: s.role,
    empCode: s.empCode
  };
}

/**
 * Revokes a session with permission enforcement.
 */
export function revokeSessionInMap(sessionId, activeSessionsMap, callerSession) {
  if (!sessionId || typeof sessionId !== 'string') {
    return { success: false, error: 'Session ID is required to revoke' };
  }
  const cleanId = sessionId.trim();
  if (!activeSessionsMap.has(cleanId)) {
    return { success: true, message: 'Session already revoked or not found' };
  }

  const s = activeSessionsMap.get(cleanId);
  const isExecutive = callerSession && isPrivilegedRole(callerSession.role, callerSession.empCode);
  const isOwnSession = callerSession && (
    callerSession.sessionId === s.id ||
    normalizeEmployeeCode(callerSession.empCode) === normalizeEmployeeCode(s.empCode)
  );

  if (callerSession && !isExecutive && !isOwnSession) {
    return { success: false, error: 'Forbidden: You can only revoke your own session' };
  }

  s.status = 'revoked';
  s.revokedAt = Date.now();
  s.revokedBy = callerSession?.empCode || 'system';
  activeSessionsMap.set(cleanId, s);

  return { success: true, message: `Session ${cleanId} has been revoked` };
}
