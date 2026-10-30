// ===================================================================================
// BUSINZ ERP: CLIENT-SIDE REAL-TIME NOTIFICATION SERVICE
// ===================================================================================
// Maintains SSE streaming connection to /api/realtime-events
// Provides instantaneous alerts without polling or page refreshes.
// Handles automatic reconnects, missed event sync, and actor exclusion.
// ===================================================================================

import { speakNotificationVoice } from './notificationService';

class RealtimeNotificationService {
  constructor() {
    this.eventSource = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.subscribers = new Set();
    this.notifications = [];
    this.unreadCount = 0;
    this.isConnecting = false;
    this.lastEventTime = null;
  }

  getEmpCode() {
    return (localStorage.getItem('controlroom_logged_emp_id') || '').toUpperCase().trim();
  }

  getUserRole() {
    return (localStorage.getItem('controlroom_user_role') || '').trim();
  }

  getUserName() {
    return (localStorage.getItem('controlroom_logged_user_name') || '').trim();
  }

  /**
   * Start the real-time notification listener
   */
  start() {
    if (typeof window === 'undefined') return;
    if (this.eventSource && (this.eventSource.readyState === EventSource.OPEN || this.eventSource.readyState === EventSource.CONNECTING)) {
      return;
    }
    this.connect();
    this.fetchInitialNotifications();
  }

  connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      if (this.eventSource) {
        try { this.eventSource.close(); } catch (_) {}
        this.eventSource = null;
      }

      const empCode = encodeURIComponent(this.getEmpCode());
      const role = encodeURIComponent(this.getUserRole());
      const userName = encodeURIComponent(this.getUserName());
      const url = `/api/realtime-events?empCode=${empCode}&role=${role}&userName=${userName}`;

      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        console.log('[RealtimeNotifs] ⚡ Connected to BUSINZ real-time notification gateway');
      };

      // Listen for dedicated workflow/lead notification events
      this.eventSource.addEventListener('notification', (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed && parsed.notification) {
            this.handleIncomingNotification(parsed.notification);
          }
        } catch (err) {
          console.warn('[RealtimeNotifs] Parse error:', err);
        }
      });

      // Also listen on general message channel for broadcast events
      this.eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed?.type === 'NOTIFICATION_RECEIVED' && parsed.notification) {
            this.handleIncomingNotification(parsed.notification);
          } else if (parsed?.type === 'INTERNAL_NOTIFICATION' && parsed.payload) {
            this.handleIncomingNotification(parsed.payload);
          }
        } catch (_) {}
      };

      this.eventSource.onerror = () => {
        this.isConnecting = false;
        if (this.eventSource) {
          try { this.eventSource.close(); } catch (_) {}
          this.eventSource = null;
        }
        this.scheduleReconnect();
      };
    } catch (err) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(30000, 2000 * Math.pow(1.5, this.reconnectAttempts++));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
      // On reconnect, sync missed notifications
      if (this.lastEventTime) {
        this.fetchMissedNotifications(this.lastEventTime);
      }
    }, delay);
  }

  /**
   * Handle incoming real-time notification
   */
  handleIncomingNotification(notif) {
    if (!notif || !notif.id) return;

    // RULE 3: Do NOT notify the employee who performed the action
    const currentEmp = this.getEmpCode();
    const currentName = this.getUserName().toLowerCase();
    const actorEmp = String(notif.actor_emp_code || '').toUpperCase().trim();
    const actorName = String(notif.actor_name || '').toLowerCase().trim();

    if (currentEmp && actorEmp && currentEmp === actorEmp) return;
    if (currentName && actorName && currentName === actorName) return;

    // Check if already in list (deduplication)
    const exists = this.notifications.some(n => n.id === notif.id || (n.dedup_id && n.dedup_id === notif.dedup_id));
    if (exists) return;

    this.lastEventTime = notif.created_at || new Date().toISOString();

    // Prepend to memory cache
    this.notifications.unshift(notif);
    this.unreadCount = this.notifications.filter(n => !n.is_read).length;

    // Notify all UI listeners
    this.emitChange({ newNotification: notif });

    // Voice announcement (Text-to-Speech) for instant hands-free alert
    try {
      speakNotificationVoice(notif);
    } catch (_) {}

    // Trigger local DOM event for toast popup
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('businz_notification_received', { detail: notif }));
    }
  }

  /**
   * Initial fetch of notifications from PostgreSQL
   */
  async fetchInitialNotifications() {
    try {
      const emp = encodeURIComponent(this.getEmpCode());
      const role = encodeURIComponent(this.getUserRole());
      const res = await fetch(`/api/notifications?empCode=${emp}&role=${role}&limit=50`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.notifications)) {
          this.notifications = json.notifications;
          this.unreadCount = json.unreadCount || this.notifications.filter(n => !n.is_read).length;
          this.emitChange();
        }
      }
    } catch (_) {}
  }

  /**
   * Sync missed notifications on reconnect
   */
  async fetchMissedNotifications(since) {
    try {
      const emp = encodeURIComponent(this.getEmpCode());
      const role = encodeURIComponent(this.getUserRole());
      const res = await fetch(`/api/notifications?empCode=${emp}&role=${role}&since=${encodeURIComponent(since)}&limit=50`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.notifications)) {
          json.notifications.forEach(n => {
            if (!this.notifications.some(existing => existing.id === n.id)) {
              this.notifications.unshift(n);
            }
          });
          this.unreadCount = this.notifications.filter(n => !n.is_read).length;
          this.emitChange();
        }
      }
    } catch (_) {}
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, all = false) {
    try {
      if (all) {
        this.notifications.forEach(n => { n.is_read = true; });
        this.unreadCount = 0;
      } else if (notificationId) {
        const match = this.notifications.find(n => n.id === notificationId);
        if (match) match.is_read = true;
        this.unreadCount = this.notifications.filter(n => !n.is_read).length;
      }
      this.emitChange();

      const empCode = this.getEmpCode();
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, empCode, all })
      });
    } catch (_) {}
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback({
      notifications: this.notifications,
      unreadCount: this.unreadCount
    });
    return () => {
      this.subscribers.delete(callback);
    };
  }

  emitChange(extra = {}) {
    for (const sub of this.subscribers) {
      try {
        sub({
          notifications: this.notifications,
          unreadCount: this.unreadCount,
          ...extra
        });
      } catch (_) {}
    }
  }

  stop() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.eventSource) {
      try { this.eventSource.close(); } catch (_) {}
      this.eventSource = null;
    }
    this.subscribers.clear();
  }
}

export const realtimeNotificationService = new RealtimeNotificationService();
export default realtimeNotificationService;
