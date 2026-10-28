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
  if (!sessionId) return;
  const isAuthenticated = localStorage.getItem('controlroom_is_authenticated') === 'true';
  if (!isAuthenticated || isHeartbeatInFlight) return;

  isHeartbeatInFlight = true;
  try {
    const res = await fetch('/api/sessions/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId
      },
      body: JSON.stringify({ sessionId })
    }).catch(() => null);

    if (res && res.status === 401) {
      console.warn('Session is invalid or expired. Logging out.');
      localStorage.removeItem('controlroom_is_authenticated');
      localStorage.removeItem('controlroom_user_role');
      localStorage.removeItem('controlroom_device_session_id');
      localStorage.removeItem('controlroom_session_start_time');
      window.location.reload();
      return;
    }

    if (res && res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.status === 'revoked') {
        const sessionStartTime = Number(localStorage.getItem('controlroom_session_start_time') || 0);
        if ((Date.now() - sessionStartTime) / 1000 > 30) {
          console.warn('Session has been revoked remotely. Logging out.');
          localStorage.removeItem('controlroom_is_authenticated');
          localStorage.removeItem('controlroom_user_role');
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
