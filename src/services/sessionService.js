import { supabase } from '../supabaseClient';

/**
 * Helper to detect device and browser from User Agent
 */
export function getDeviceInfo() {
  const ua = navigator.userAgent;
  let device = 'Desktop PC';
  let browser = 'Chrome';

  if (/iPad|Tablet/i.test(ua)) {
    device = 'Tablet';
  } else if (/iPhone|Android.*Mobile/i.test(ua)) {
    device = 'Mobile Device';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    device = 'MacBook / Mac';
  } else if (/Windows NT/i.test(ua)) {
    device = 'Windows PC';
  } else if (/Linux/i.test(ua)) {
    device = 'Linux Station';
  }

  if (/Edg\//i.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/Chrome\//i.test(ua)) {
    browser = 'Google Chrome';
  } else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Safari';
  } else if (/Firefox\//i.test(ua)) {
    browser = 'Mozilla Firefox';
  }

  return { device, browser };
}

/**
 * Create a brand new unique session token
 */
export function createNewSessionId() {
  const sesId = 'SES-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();
  try {
    localStorage.setItem('controlroom_device_session_id', sesId);
    localStorage.setItem('controlroom_session_start_time', String(Date.now()));
  } catch (e) {
    console.warn('[sessionService] Failed to persist session to localStorage:', e);
  }
  return sesId;
}

/**
 * Get or generate unique persistent session token for this browser client
 */
export function getOrCreateSessionId() {
  let sesId = localStorage.getItem('controlroom_device_session_id');
  if (!sesId) {
    sesId = createNewSessionId();
  }
  return sesId;
}

/**
 * Register or update active session in backend session registry
 * Server verifies credentials and issues cryptographic session ID (sess_...)
 */
export async function registerActiveSession(userEmail, empCode, displayName, userRole, password = null) {
  if (!userEmail && !empCode) return null;
  const { device, browser } = getDeviceInfo();

  const sessionPayload = {
    email: (userEmail || '').toLowerCase().trim(),
    empCode: empCode || 'EMP',
    user: displayName || userEmail,
    role: userRole || 'Employee',
    ...(password ? { password: String(password) } : {}),
    device: device,
    browser: browser
  };

  try {
    const res = await fetch('/api/sessions/register', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sessionPayload)
    }).catch(() => null);

    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.success && data.session?.id) {
        localStorage.setItem('controlroom_device_session_id', data.session.id);
        localStorage.setItem('controlroom_session_start_time', String(Date.now()));
        return data.session;
      }
    }
  } catch (err) {
    console.warn('[SessionService] Register notice:', err);
  }

  return sessionPayload;
}

let isHeartbeatInFlight = false;

/**
 * Update heartbeat / last active timestamp for current device
 */
export async function heartbeatActiveSession() {
  const sessionId = localStorage.getItem('controlroom_device_session_id');
  const isAuthenticated = localStorage.getItem('controlroom_is_authenticated') === 'true';
  if (!isAuthenticated || isHeartbeatInFlight) return;

  const empCode = localStorage.getItem('controlroom_logged_emp_id') || localStorage.getItem('controlroom_logged_user_id') || '';
  const userRole = localStorage.getItem('controlroom_user_role') || '';
  const userName = localStorage.getItem('controlroom_logged_user_name') || localStorage.getItem('controlroom_logged_user') || '';
  const userEmail = localStorage.getItem('controlroom_logged_user_email') || '';

  isHeartbeatInFlight = true;
  try {
    const res = await fetch('/api/sessions/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId || '',
        'x-user-role': userRole,
        'x-emp-code': empCode
      },
      body: JSON.stringify({ 
        sessionId,
        empCode,
        role: userRole,
        userName
      })
    }).catch(() => null);

    if (res && res.status === 401) {
      // Server may have restarted (e.g. PM2 reload or update) clearing in-memory sessions.
      // Do not force-logout the user on transient 401 heartbeat; only explicit 'revoked' logs out.
      console.warn('[SessionService] Session heartbeat returned 401; keeping local session active.');
      return;
    }

    if (res && res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.status === 'revoked') {
        const sessionStartTime = Number(localStorage.getItem('controlroom_session_start_time') || 0);
        if ((Date.now() - sessionStartTime) / 1000 > 30) {
          console.warn('Session has been revoked remotely by administrator. Logging out.');
          const revokedEmp = localStorage.getItem('controlroom_logged_emp_id');
          const revokedEmail = localStorage.getItem('controlroom_logged_user');
          const revokedSession = localStorage.getItem('controlroom_device_session_id');
          removeSavedAccount(revokedEmp || revokedEmail || revokedSession);
          localStorage.removeItem('controlroom_is_authenticated');
          localStorage.removeItem('controlroom_user_role');
          localStorage.removeItem('controlroom_logged_emp_id');
          localStorage.removeItem('controlroom_logged_user');
          localStorage.removeItem('controlroom_logged_user_email');
          localStorage.removeItem('controlroom_logged_user_name');
          localStorage.removeItem('controlroom_device_session_id');
          localStorage.removeItem('controlroom_session_start_time');
          window.location.reload();
        }
      }
    }
  } catch (_) {
  } finally {
    isHeartbeatInFlight = false;
  }
}

/**
 * Automatically clean up revoked or expired sessions (> 24 hours) from Supabase
 */
export async function pruneStaleSessions() {
  // Pruning is handled automatically server-side in /api/sessions/active
}

/**
 * Fetch all active sessions across all devices from native backend
 */
export async function fetchLiveActiveSessions() {
  const currentSessionId = getOrCreateSessionId();

  try {
    const res = await fetch('/api/sessions/active').catch(() => null);
    if (!res || !res.ok) return [];
    const json = await res.json().catch(() => null);
    const data = Array.isArray(json?.data) ? json.data : [];

    const now = Date.now();
    return data
      .filter(item => item.status === 'active')
      .map(item => {
        const diffSeconds = Math.floor((now - (item.lastActiveTimestamp || 0)) / 1000);
        let activeLabel = 'Just now';
        if (diffSeconds > 120) {
          activeLabel = `${Math.floor(diffSeconds / 60)} mins ago`;
        }

        return {
          id: item.id,
          dbId: item.id,
          user: item.user || item.email || 'Employee',
          email: item.email,
          empCode: item.empCode,
          role: item.role,
          device: item.device || 'Desktop PC',
          browser: item.browser || 'Web Browser',
          ip: item.ip || 'Live Client',
          location: item.location || 'India',
          loginTime: item.loginTime || 'Today',
          lastActive: activeLabel,
          isCurrent: (item.id === currentSessionId)
        };
      });
  } catch (err) {
    console.error('Error fetching live active sessions:', err);
    return [];
  }
}

/**
 * Revoke a specific session (forces logout on target device)
 */
export async function revokeSession(sessionId) {
  try {
    await fetch('/api/sessions/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    }).catch(() => null);
    return true;
  } catch (err) {
    console.error('Error revoking session:', err);
    return false;
  }
}

/**
 * Revoke all sessions except the current administrator's device
 */
export async function revokeAllOtherSessions() {
  const currentSessionId = getOrCreateSessionId();
  try {
    const sessions = await fetchLiveActiveSessions();
    for (const s of sessions) {
      if (s.id !== currentSessionId) {
        await revokeSession(s.id);
      }
    }
    return true;
  } catch (err) {
    console.error('Error revoking all other sessions:', err);
    return false;
  }
}

const SAVED_ACCOUNTS_KEY = 'businz_saved_accounts';
const MAX_SAVED_ACCOUNTS = 8;

/**
 * Derive a deterministic key for a BUSINZ account saved on this browser.
 */
export function normalizeAccountKey(empCode = '', email = '', role = '') {
  const emp = String(empCode || '').trim().toLowerCase();
  if (emp) return `emp:${emp}`;
  const mail = String(email || '').trim().toLowerCase();
  if (mail) return `email:${mail}`;
  const r = String(role || '').trim().toLowerCase();
  return r ? `role:${r}` : '';
}

/**
 * Return saved account session descriptors (never includes passwords).
 */
export function getSavedAccounts() {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((acc) => acc && (acc.empCode || acc.email || acc.role))
      .sort((a, b) => Number(b.lastUsedAt || 0) - Number(a.lastUsedAt || 0));
  } catch (_) {
    return [];
  }
}

function writeSavedAccounts(list) {
  try {
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(list.slice(0, MAX_SAVED_ACCOUNTS)));
  } catch (_) {}
}

/**
 * Add or update a saved account entry on this browser (token-based, no password stored).
 */
export function upsertSavedAccount(account = {}) {
  const key = normalizeAccountKey(account.empCode, account.email, account.role);
  if (!key) return getSavedAccounts();

  const existing = getSavedAccounts();
  const prev = existing.find((item) => item.key === key) || {};
  const nextEntry = {
    key,
    empCode: String(account.empCode ?? prev.empCode ?? '').trim(),
    email: String(account.email ?? prev.email ?? '').trim(),
    name: String(account.name ?? prev.name ?? '').trim() || String(account.empCode || account.email || account.role || 'User').trim(),
    role: String(account.role ?? prev.role ?? '').trim(),
    sessionId: String(account.sessionId ?? prev.sessionId ?? '').trim(),
    sessionStartTime: Number(account.sessionStartTime || prev.sessionStartTime || Date.now()),
    lastUsedAt: Number(account.lastUsedAt || Date.now())
  };

  const filtered = existing.filter((item) => item.key !== key);
  const updated = [nextEntry, ...filtered].slice(0, MAX_SAVED_ACCOUNTS);
  writeSavedAccounts(updated);
  return updated;
}

/**
 * Remove one account from saved accounts by key, empCode, email, or sessionId.
 */
export function removeSavedAccount(accountOrKey) {
  if (!accountOrKey) return getSavedAccounts();
  const targetKey = typeof accountOrKey === 'string'
    ? (accountOrKey.startsWith('emp:') || accountOrKey.startsWith('email:') || accountOrKey.startsWith('role:')
        ? accountOrKey.trim().toLowerCase()
        : '')
    : normalizeAccountKey(accountOrKey.empCode, accountOrKey.email, accountOrKey.role);

  const rawLower = typeof accountOrKey === 'string' ? accountOrKey.trim().toLowerCase() : '';
  const existing = getSavedAccounts();
  const updated = existing.filter((item) => {
    if (targetKey && item.key === targetKey) return false;
    if (rawLower) {
      if (String(item.empCode || '').trim().toLowerCase() === rawLower) return false;
      if (String(item.email || '').trim().toLowerCase() === rawLower) return false;
      if (String(item.sessionId || '').trim().toLowerCase() === rawLower) return false;
    }
    return true;
  });
  writeSavedAccounts(updated);
  return updated;
}

/**
 * Activate a saved account's local identity keys cleanly without wiping other saved accounts.
 */
export function activateSavedAccountLocal(account) {
  if (!account || !account.role) return false;
  const sessionId = String(account.sessionId || '').trim() || createNewSessionId();
  const startTime = Number(account.sessionStartTime || Date.now());

  localStorage.setItem('controlroom_is_authenticated', 'true');
  localStorage.setItem('controlroom_user_role', account.role);
  localStorage.setItem('controlroom_logged_emp_id', account.empCode || '');
  localStorage.setItem('controlroom_logged_user', account.email || account.empCode || '');
  localStorage.setItem('controlroom_logged_user_email', account.email || '');
  localStorage.setItem('controlroom_logged_user_name', account.name || account.empCode || account.email || account.role);
  localStorage.setItem('controlroom_device_session_id', sessionId);
  localStorage.setItem('controlroom_session_start_time', String(startTime));

  upsertSavedAccount({
    ...account,
    sessionId,
    sessionStartTime: startTime,
    lastUsedAt: Date.now()
  });
  return true;
}

/**
 * Verify that a saved account's backend session token is still valid and unrevoked.
 */
export async function verifySavedAccountSession(account) {
  if (!account || !account.sessionId) {
    return { valid: false, reason: 'missing_session' };
  }
  try {
    const res = await fetch('/api/sessions/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': account.sessionId,
        'x-user-role': account.role || '',
        'x-emp-code': account.empCode || ''
      },
      body: JSON.stringify({
        sessionId: account.sessionId,
        empCode: account.empCode || '',
        role: account.role || '',
        userName: account.name || account.email || ''
      })
    });

    if (res.status === 401 || res.status === 403) {
      return { valid: false, reason: 'unauthorized' };
    }
    if (!res.ok) {
      return { valid: true, offlineFallback: true };
    }
    const json = await res.json().catch(() => null);
    if (json && json.status === 'revoked') {
      return { valid: false, reason: 'revoked' };
    }
    return { valid: true };
  } catch (_) {
    return { valid: true, offlineFallback: true };
  }
}
