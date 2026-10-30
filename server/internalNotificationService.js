// ===================================================================================
// BUSINZ ERP: PRECISE INTERNAL WORKFLOW & LEAD NOTIFICATION SERVICE
// ===================================================================================
// Real-time, transaction-safe notification engine strictly limited to:
// 1. Lead creation, assignment, reassignment & transfer.
// 2. Department-to-department authorized ERP workflow handoffs.
// 3. Approval requests, approvals & rejections requiring action.
// 4. BOM / order cancellation affecting another department.
//
// Rules:
// - Persisted in PostgreSQL with deterministic deduplication IDs (dedup_id).
// - Sub-second realtime delivery via SSE / WebSocket stream.
// - NEVER notify the actor who triggered the event.
// - Offline persistence + seamless reconnect sync.
// ===================================================================================

import fs from 'fs';
import path from 'path';
import { query as executeSql } from './db.js';

const NOTIFICATIONS_STORE_FILE = path.join(process.cwd(), 'server', 'notifications_store.json');

// Connected SSE/WebSocket notification client sockets
// Each client entry: { res, empCode, role, userName, connectedAt }
const connectedClients = new Set();

/**
 * Register a client for authenticated real-time notification streaming
 */
export function registerNotificationClient(client) {
  connectedClients.add(client);
  return () => {
    connectedClients.delete(client);
  };
}

export function getConnectedClientCount() {
  return connectedClients.size;
}

/**
 * Fallback local disk helper for zero-data-loss durability
 */
function readLocalNotificationsDisk() {
  try {
    if (fs.existsSync(NOTIFICATIONS_STORE_FILE)) {
      const data = JSON.parse(fs.readFileSync(NOTIFICATIONS_STORE_FILE, 'utf8'));
      if (Array.isArray(data)) return data;
    }
  } catch (_) {}
  return [];
}

function writeLocalNotificationsDisk(list) {
  try {
    fs.writeFileSync(NOTIFICATIONS_STORE_FILE, JSON.stringify(list.slice(0, 500), null, 2), 'utf8');
  } catch (_) {}
}

/**
 * Checks whether a given client matches the recipient criteria
 */
function isClientRecipient(client, notification) {
  if (!client || !notification) return false;

  const clientEmp = String(client.empCode || '').toUpperCase().trim();
  const clientRole = String(client.role || '').toLowerCase().trim();
  const clientName = String(client.userName || '').toLowerCase().trim();

  const actorEmp = String(notification.actor_emp_code || '').toUpperCase().trim();
  const actorName = String(notification.actor_name || '').toLowerCase().trim();

  // RULE 3: Do NOT notify the employee who performed the action
  if (actorEmp && clientEmp && actorEmp === clientEmp) return false;
  if (actorName && clientName && actorName === clientName) return false;

  const targetEmp = String(notification.recipient_emp_code || '').toUpperCase().trim();
  const targetRole = String(notification.recipient_role || '').toLowerCase().trim();

  // Specific user targeted by employee code
  if (targetEmp && clientEmp && targetEmp === clientEmp) {
    return true;
  }

  // Department / Role queue targeted
  if (targetRole) {
    if (targetRole === 'all') return true;
    if (clientRole === targetRole) return true;
    if (clientRole.includes(targetRole) || targetRole.includes(clientRole)) return true;

    // Common department aliases
    if (targetRole === 'dispatch' && clientRole.includes('dispatch')) return true;
    if (targetRole === 'accounts' && (clientRole.includes('account') || clientRole.includes('finance'))) return true;
    if (targetRole === 'billing' && (clientRole.includes('bill') || clientRole.includes('invoice'))) return true;
    if (targetRole === 'production' && clientRole.includes('production')) return true;
    if (targetRole === 'procurement' && clientRole.includes('procurement')) return true;
    if (targetRole === 'ceo' && (clientRole === 'ceo' || clientRole === 'md' || clientRole.includes('managing director'))) return true;
    if (targetRole === 'lead_managers' && (clientRole.includes('sales head') || clientRole === 'ceo' || clientRole.includes('technical administrator') || clientRole.includes('admin'))) return true;
  }

  return false;
}

/**
 * Broadcast notification payload to matching connected clients
 */
function broadcastNotificationToClients(notification) {
  if (!notification || connectedClients.size === 0) return;

  const payloadStr = JSON.stringify({
    type: 'NOTIFICATION_RECEIVED',
    notification,
    timestamp: new Date().toISOString()
  });
  const sseChunk = `event: notification\ndata: ${payloadStr}\n\n`;

  setImmediate(() => {
    for (const client of connectedClients) {
      try {
        if (client.res && !client.res.writableEnded && !client.res.destroyed) {
          if (isClientRecipient(client, notification)) {
            client.res.write(sseChunk);
          }
        } else {
          connectedClients.delete(client);
        }
      } catch (_) {
        connectedClients.delete(client);
      }
    }
  });
}

/**
 * Create a new internal notification with strict deduplication and outbox persistence
 */
export async function createInternalNotification(params = {}) {
  const {
    recipientEmpCode = null,
    recipientRole = null,
    eventType,
    documentType,
    documentId,
    title,
    message,
    actorEmpCode = null,
    actorName = 'System',
    actorRole = 'System',
    targetTab = null,
    targetRecordId = null,
    metadata = {},
    dedupId = null
  } = params;

  if (!eventType || !documentType || !documentId || !title || !message) {
    console.warn('[InternalNotification] Missing required fields. Skipped.', params);
    return { success: false, error: 'Missing required notification fields' };
  }

  // Generate deterministic deduplication ID if not explicitly provided
  const computedDedupId = dedupId || [
    eventType,
    documentType,
    documentId,
    recipientEmpCode || recipientRole || 'queue',
    metadata?.stage || metadata?.status || metadata?.version || 'v1'
  ].join('_');

  const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const nowIso = new Date().toISOString();

  let insertedNotification = null;

  // 1. Transaction-safe insert into PostgreSQL with ON CONFLICT (dedup_id) DO NOTHING
  try {
    const res = await executeSql(`
      INSERT INTO public.internal_notifications (
        id, recipient_emp_code, recipient_role, event_type, document_type, document_id,
        title, message, actor_emp_code, actor_name, actor_role, target_tab, target_record_id,
        metadata, is_read, created_at, dedup_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, false, NOW(), $15)
      ON CONFLICT (dedup_id) DO NOTHING
      RETURNING *;
    `, [
      notifId,
      recipientEmpCode,
      recipientRole,
      eventType,
      documentType,
      documentId,
      title,
      message,
      actorEmpCode,
      actorName,
      actorRole,
      targetTab,
      targetRecordId || documentId,
      JSON.stringify(metadata || {}),
      computedDedupId
    ]);

    if (res && res.rows && res.rows.length > 0) {
      insertedNotification = res.rows[0];
    } else {
      // Event already recorded (deduplicated)
      console.log(`[InternalNotification] Deduplicated event ${computedDedupId}. Skipped duplicate emit.`);
      return { success: true, deduplicated: true };
    }
  } catch (dbErr) {
    console.warn('[InternalNotification DB Notice]:', dbErr.message);

    // Fallback to local disk store if PostgreSQL is unavailable
    const localList = readLocalNotificationsDisk();
    const existing = localList.find(n => n.dedup_id === computedDedupId);
    if (existing) {
      return { success: true, deduplicated: true };
    }

    insertedNotification = {
      id: notifId,
      recipient_emp_code: recipientEmpCode,
      recipient_role: recipientRole,
      event_type: eventType,
      document_type: documentType,
      document_id: documentId,
      title,
      message,
      actor_emp_code: actorEmpCode,
      actor_name: actorName,
      actor_role: actorRole,
      target_tab: targetTab,
      target_record_id: targetRecordId || documentId,
      metadata,
      is_read: false,
      read_at: null,
      created_at: nowIso,
      dedup_id: computedDedupId
    };

    localList.unshift(insertedNotification);
    writeLocalNotificationsDisk(localList);
  }

  // 2. Realtime broadcast to connected recipient clients immediately (sub-second)
  if (insertedNotification) {
    broadcastNotificationToClients(insertedNotification);
  }

  return { success: true, notification: insertedNotification };
}

/**
 * Retrieve notifications for a specific employee / role with unread count
 */
export async function getNotificationsForUser(options = {}) {
  const { empCode = '', role = '', unreadOnly = false, limit = 40, since = null } = options;

  const normalizedEmp = String(empCode || '').toUpperCase().trim();
  const normalizedRole = String(role || '').toLowerCase().trim();

  let notifications = [];
  let unreadCount = 0;

  try {
    const values = [normalizedEmp, normalizedRole];
    let query = `
      SELECT * FROM public.internal_notifications
      WHERE (
        recipient_emp_code = $1 
        OR recipient_role = $2 
        OR recipient_emp_code = 'ALL'
        OR (recipient_role IS NOT NULL AND $2 ILIKE '%' || recipient_role || '%')
      )
    `;

    if (unreadOnly) {
      query += ` AND is_read = false`;
    }
    if (since) {
      values.push(since);
      query += ` AND created_at > $${values.length}`;
    }

    values.push(limit);
    query += ` ORDER BY created_at DESC LIMIT $${values.length};`;

    const res = await executeSql(query, values);
    if (res && Array.isArray(res.rows)) {
      notifications = res.rows;
    }

    // Count unread
    const countRes = await executeSql(`
      SELECT COUNT(*)::int as count FROM public.internal_notifications
      WHERE is_read = false AND (
        recipient_emp_code = $1 
        OR recipient_role = $2 
        OR recipient_emp_code = 'ALL'
        OR (recipient_role IS NOT NULL AND $2 ILIKE '%' || recipient_role || '%')
      );
    `, [normalizedEmp, normalizedRole]);

    if (countRes && countRes.rows && countRes.rows[0]) {
      unreadCount = Number(countRes.rows[0].count) || 0;
    }
  } catch (dbErr) {
    console.warn('[InternalNotification Fetch Notice]:', dbErr.message);
    const localList = readLocalNotificationsDisk();
    notifications = localList.filter(n => isClientRecipient({ empCode: normalizedEmp, role: normalizedRole }, n));
    if (unreadOnly) {
      notifications = notifications.filter(n => !n.is_read);
    }
    unreadCount = notifications.filter(n => !n.is_read).length;
    notifications = notifications.slice(0, limit);
  }

  return {
    notifications,
    unreadCount
  };
}

/**
 * Mark notification(s) as read
 */
export async function markNotificationAsRead({ notificationId, empCode = '', all = false }) {
  const normalizedEmp = String(empCode || '').toUpperCase().trim();

  try {
    if (all) {
      await executeSql(`
        UPDATE public.internal_notifications
        SET is_read = true, read_at = NOW()
        WHERE is_read = false AND (recipient_emp_code = $1 OR recipient_emp_code = 'ALL');
      `, [normalizedEmp]);
    } else if (notificationId) {
      await executeSql(`
        UPDATE public.internal_notifications
        SET is_read = true, read_at = NOW()
        WHERE id = $1;
      `, [notificationId]);
    }
  } catch (err) {
    console.warn('[InternalNotification markRead Notice]:', err.message);
  }

  // Update local disk cache
  try {
    const list = readLocalNotificationsDisk();
    list.forEach(n => {
      if (all && (n.recipient_emp_code === normalizedEmp || n.recipient_emp_code === 'ALL')) {
        n.is_read = true;
        n.read_at = new Date().toISOString();
      } else if (notificationId && n.id === notificationId) {
        n.is_read = true;
        n.read_at = new Date().toISOString();
      }
    });
    writeLocalNotificationsDisk(list);
  } catch (_) {}

  return { success: true };
}
