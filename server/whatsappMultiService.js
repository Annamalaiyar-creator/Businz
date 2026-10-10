import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSIONS_BASE_DIR = path.join(__dirname, 'wa_sessions');
if (!fs.existsSync(SESSIONS_BASE_DIR)) {
  fs.mkdirSync(SESSIONS_BASE_DIR, { recursive: true });
}

const silentLogger = pino({ level: 'silent' });

// Global registry of user sessions: Map<userId, SessionObject>
const activeSessions = new Map();

// Helper to sanitize userId into safe filesystem folder name
export function sanitizeUserId(userId) {
  if (!userId) return 'default_user';
  return String(userId).toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 50);
}

// Format phone number to WhatsApp JID (e.g. 919876543210@s.whatsapp.net)
export function formatPhoneNumberToJid(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    digits = `91${digits}`; // Default India prefix for 10-digit mobile
  }
  return `${digits}@s.whatsapp.net`;
}

// Helper to get session chat cache file path
function getChatsCachePath(userId) {
  return path.join(SESSIONS_BASE_DIR, `user_${userId}`, 'chats_cache.json');
}

function loadUserChatsFromDisk(userId) {
  try {
    const p = getChatsCachePath(userId);
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      return new Map(Object.entries(data));
    }
  } catch (err) {
    console.warn(`[WhatsApp MultiService] Error loading chats cache for ${userId}:`, err.message);
  }
  return new Map();
}

function saveUserChatsToDisk(userId, chatsMap) {
  try {
    const p = getChatsCachePath(userId);
    const obj = Object.fromEntries(chatsMap);
    fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.warn(`[WhatsApp MultiService] Error saving chats cache for ${userId}:`, err.message);
  }
}

/**
 * Get all synced chats/contacts for a specific user
 */
export function getUserChats(rawUserId) {
  const userId = sanitizeUserId(rawUserId);
  let session = activeSessions.get(userId);
  let chatsMap = session?.chats;

  if (!chatsMap) {
    chatsMap = loadUserChatsFromDisk(userId);
    if (session) session.chats = chatsMap;
  }

  const list = Array.from(chatsMap.values());
  // Sort by most recent conversation first
  list.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  return list;
}

/**
 * Start or add a chat conversation manually with a phone number
 */
export function addUserChat(rawUserId, { phone, name = '', company = 'Client Contact' }) {
  const userId = sanitizeUserId(rawUserId);
  let session = activeSessions.get(userId);
  if (!session) {
    session = { userId, chats: loadUserChatsFromDisk(userId) };
    activeSessions.set(userId, session);
  }
  if (!session.chats) {
    session.chats = loadUserChatsFromDisk(userId);
  }

  const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
  if (!cleanPhone) return null;

  let existing = session.chats.get(cleanPhone);
  if (!existing) {
    existing = {
      id: cleanPhone,
      phone: `+${cleanPhone}`,
      customerName: name || `Contact +${cleanPhone}`,
      companyName: company || 'Client Contact',
      unreadCount: 0,
      timestamp: new Date().toISOString(),
      messages: []
    };
    session.chats.set(cleanPhone, existing);
    saveUserChatsToDisk(userId, session.chats);
  }

  return existing;
}

/**
 * Get current session state for a specific user
 */
export function getUserSessionStatus(rawUserId) {
  const userId = sanitizeUserId(rawUserId);
  const session = activeSessions.get(userId);

  if (!session) {
    const sessionDir = path.join(SESSIONS_BASE_DIR, `user_${userId}`);
    const hasCreds = fs.existsSync(path.join(sessionDir, 'creds.json'));
    return {
      userId,
      status: hasCreds ? 'DISCONNECTED_SAVED' : 'DISCONNECTED',
      phoneNumber: null,
      userName: null,
      qrCode: null,
      isReady: false
    };
  }

  return {
    userId,
    status: session.status,
    phoneNumber: session.phoneNumber || null,
    userName: session.userName || null,
    qrCode: session.qrCode || null,
    isReady: session.status === 'CONNECTED'
  };
}

/**
 * List all active sessions across all sales representatives
 */
export function getAllUserSessions() {
  const list = [];
  activeSessions.forEach((val, key) => {
    list.push({
      userId: key,
      status: val.status,
      phoneNumber: val.phoneNumber || null,
      userName: val.userName || null,
      isReady: val.status === 'CONNECTED'
    });
  });
  return list;
}

/**
 * Initialize or start QR connection for a user's WhatsApp
 */
export async function initUserSession(rawUserId, options = {}) {
  const userId = sanitizeUserId(rawUserId);
  const { onMessageReceived, onStatusChange, onChatsUpdated } = options;

  const sessionDir = path.join(SESSIONS_BASE_DIR, `user_${userId}`);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // If already connected, return existing session
  const existing = activeSessions.get(userId);
  if (existing && existing.status === 'CONNECTED' && existing.sock) {
    return getUserSessionStatus(userId);
  }

  // Setup session tracking object
  const sessionObj = existing || {
    userId,
    sock: null,
    status: 'INITIALIZING',
    qrCode: null,
    phoneNumber: null,
    userName: null,
    chats: loadUserChatsFromDisk(userId),
    contacts: new Map(),
    onMessageReceived,
    onStatusChange,
    onChatsUpdated
  };
  sessionObj.chats = sessionObj.chats || loadUserChatsFromDisk(userId);
  sessionObj.contacts = sessionObj.contacts || new Map();
  activeSessions.set(userId, sessionObj);

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    const sock = makeWASocket({
      auth: state,
      logger: silentLogger,
      printQRInTerminal: false,
      browser: ['BUSINZ CRM', 'Chrome', '1.0.0'],
      syncFullHistory: true
    });

    sessionObj.sock = sock;

    // Listen for credential updates
    sock.ev.on('creds.update', saveCreds);

    // Listen for connection status & QR codes
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, {
            width: 280,
            margin: 2,
            color: { dark: '#0E7490', light: '#FFFFFF' }
          });
          sessionObj.qrCode = qrDataUrl;
          sessionObj.status = 'SCAN_QR';
          if (sessionObj.onStatusChange) sessionObj.onStatusChange(getUserSessionStatus(userId));
        } catch (err) {
          console.error(`[WhatsApp MultiService] QR generation error for ${userId}:`, err.message);
        }
      }

      if (connection === 'open') {
        sessionObj.status = 'CONNECTED';
        sessionObj.qrCode = null;
        const jid = sock.user?.id || '';
        sessionObj.phoneNumber = jid.split(':')[0] || '';
        sessionObj.userName = sock.user?.name || '';
        console.log(`[WhatsApp MultiService] Sales rep '${userId}' connected! Phone: +${sessionObj.phoneNumber}`);
        if (sessionObj.onStatusChange) sessionObj.onStatusChange(getUserSessionStatus(userId));
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        console.log(`[WhatsApp MultiService] Connection closed for '${userId}'. Code: ${statusCode}, LoggedOut: ${isLoggedOut}`);

        if (isLoggedOut) {
          sessionObj.status = 'DISCONNECTED';
          sessionObj.qrCode = null;
          sessionObj.phoneNumber = null;
          sessionObj.sock = null;
          activeSessions.delete(userId);
          try {
            fs.rmSync(sessionDir, { recursive: true, force: true });
          } catch (_) {}
          if (sessionObj.onStatusChange) sessionObj.onStatusChange(getUserSessionStatus(userId));
        } else {
          sessionObj.status = 'CONNECTING';
          sessionObj.qrCode = null;
          if (sessionObj.onStatusChange) sessionObj.onStatusChange(getUserSessionStatus(userId));
          // Auto reconnect after brief pause
          setTimeout(() => {
            initUserSession(userId, options).catch(() => {});
          }, 3500);
        }
      }
    });

    // 1. Initial WhatsApp History Sync (Chats, Contacts, Messages)
    sock.ev.on('messaging-history.set', ({ chats = [], contacts = [], messages = [] }) => {
      console.log(`[WhatsApp MultiService] Synced history for '${userId}': ${chats.length} chats, ${contacts.length} contacts, ${messages.length} messages`);

      // Store contacts
      for (const c of contacts) {
        if (!c.id) continue;
        const phone = c.id.split('@')[0];
        const name = c.name || c.notify || c.verifiedName || '';
        if (name) sessionObj.contacts.set(phone, name);
      }

      // Store chats
      for (const ch of chats) {
        if (!ch.id || ch.id.includes('status@broadcast') || ch.id.includes('@broadcast')) continue;
        const cleanPhone = ch.id.split('@')[0];
        const contactName = sessionObj.contacts.get(cleanPhone) || ch.name || '';
        const existing = sessionObj.chats.get(cleanPhone) || {};

        sessionObj.chats.set(cleanPhone, {
          id: cleanPhone,
          phone: `+${cleanPhone}`,
          customerName: contactName || ch.name || existing.customerName || `WhatsApp Contact (+${cleanPhone})`,
          companyName: ch.id.includes('@g.us') ? 'WhatsApp Group' : 'WhatsApp Contact',
          isGroup: ch.id.includes('@g.us'),
          unreadCount: ch.unreadCount || 0,
          timestamp: ch.conversationTimestamp ? new Date(Number(ch.conversationTimestamp) * 1000).toISOString() : (existing.timestamp || new Date().toISOString()),
          messages: existing.messages || []
        });
      }

      // Store recent messages
      for (const msg of messages) {
        const senderJid = msg.key.remoteJid || '';
        if (!senderJid || senderJid.includes('status@broadcast')) continue;
        const cleanPhone = senderJid.split('@')[0];
        const text = msg.message?.conversation ||
                     msg.message?.extendedTextMessage?.text ||
                     msg.message?.imageMessage?.caption ||
                     msg.message?.documentMessage?.caption ||
                     (msg.message?.documentMessage ? 'Attached Document' : '') ||
                     (msg.message?.imageMessage ? 'Attached Photo' : '');

        if (!text) continue;

        let chat = sessionObj.chats.get(cleanPhone);
        if (!chat) {
          const contactName = sessionObj.contacts.get(cleanPhone) || msg.pushName || '';
          chat = {
            id: cleanPhone,
            phone: `+${cleanPhone}`,
            customerName: contactName || `WhatsApp Contact (+${cleanPhone})`,
            companyName: senderJid.includes('@g.us') ? 'WhatsApp Group' : 'WhatsApp Contact',
            isGroup: senderJid.includes('@g.us'),
            unreadCount: 0,
            timestamp: new Date().toISOString(),
            messages: []
          };
          sessionObj.chats.set(cleanPhone, chat);
        }

        const msgTime = msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000).toISOString() : new Date().toISOString();
        const msgId = msg.key.id;

        if (!chat.messages.some(m => m.id === msgId)) {
          chat.messages.push({
            id: msgId,
            sender: msg.key.fromMe ? 'agent' : 'customer',
            senderName: msg.key.fromMe ? (sessionObj.userName || 'Sales Representative') : (chat.customerName),
            text: text,
            timestamp: msgTime,
            status: 'delivered'
          });
          chat.timestamp = msgTime;
        }
      }

      saveUserChatsToDisk(userId, sessionObj.chats);
      if (sessionObj.onChatsUpdated) sessionObj.onChatsUpdated(getUserChats(userId));
    });

    // 2. Continuous Contact Updates
    sock.ev.on('contacts.upsert', (contacts) => {
      for (const c of contacts) {
        if (!c.id) continue;
        const phone = c.id.split('@')[0];
        const name = c.name || c.notify || c.verifiedName || '';
        if (name) {
          sessionObj.contacts.set(phone, name);
          const chat = sessionObj.chats.get(phone);
          if (chat && (!chat.customerName || chat.customerName.startsWith('WhatsApp Contact'))) {
            chat.customerName = name;
          }
        }
      }
      saveUserChatsToDisk(userId, sessionObj.chats);
    });

    // 3. Continuous Chat Upserts
    sock.ev.on('chats.upsert', (chats) => {
      for (const ch of chats) {
        if (!ch.id || ch.id.includes('status@broadcast') || ch.id.includes('@broadcast')) continue;
        const cleanPhone = ch.id.split('@')[0];
        const contactName = sessionObj.contacts.get(cleanPhone) || ch.name || '';
        const existing = sessionObj.chats.get(cleanPhone) || {};

        sessionObj.chats.set(cleanPhone, {
          ...existing,
          id: cleanPhone,
          phone: `+${cleanPhone}`,
          customerName: contactName || ch.name || existing.customerName || `WhatsApp Contact (+${cleanPhone})`,
          companyName: ch.id.includes('@g.us') ? 'WhatsApp Group' : 'WhatsApp Contact',
          isGroup: ch.id.includes('@g.us'),
          unreadCount: ch.unreadCount !== undefined ? ch.unreadCount : (existing.unreadCount || 0),
          timestamp: ch.conversationTimestamp ? new Date(Number(ch.conversationTimestamp) * 1000).toISOString() : (existing.timestamp || new Date().toISOString()),
          messages: existing.messages || []
        });
      }
      saveUserChatsToDisk(userId, sessionObj.chats);
    });

    // 4. Listen for incoming live messages
    sock.ev.on('messages.upsert', async (m) => {
      try {
        if (m.type === 'notify' && m.messages && m.messages.length > 0) {
          for (const msg of m.messages) {
            const senderJid = msg.key.remoteJid || '';
            if (!senderJid || senderJid.includes('status@broadcast')) continue;

            const senderPhone = senderJid.split('@')[0];
            const text = msg.message?.conversation ||
                         msg.message?.extendedTextMessage?.text ||
                         msg.message?.imageMessage?.caption ||
                         msg.message?.documentMessage?.caption ||
                         (msg.message?.documentMessage ? 'Attached Document' : '') ||
                         (msg.message?.imageMessage ? 'Attached Photo' : '');

            if (!text) continue;

            const pushName = msg.pushName || sessionObj.contacts.get(senderPhone) || `Customer +${senderPhone}`;
            const msgTime = msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000).toISOString() : new Date().toISOString();
            const msgId = msg.key.id;

            // Update in-memory chat
            let chat = sessionObj.chats.get(senderPhone);
            if (!chat) {
              chat = {
                id: senderPhone,
                phone: `+${senderPhone}`,
                customerName: pushName,
                companyName: senderJid.includes('@g.us') ? 'WhatsApp Group' : 'WhatsApp Contact',
                isGroup: senderJid.includes('@g.us'),
                unreadCount: 0,
                timestamp: msgTime,
                messages: []
              };
              sessionObj.chats.set(senderPhone, chat);
            }

            if (!chat.messages.some(m => m.id === msgId)) {
              chat.messages.push({
                id: msgId,
                sender: msg.key.fromMe ? 'agent' : 'customer',
                senderName: msg.key.fromMe ? (sessionObj.userName || 'Sales Representative') : pushName,
                text,
                timestamp: msgTime,
                status: 'delivered'
              });
              chat.timestamp = msgTime;
              if (!msg.key.fromMe) chat.unreadCount = (chat.unreadCount || 0) + 1;
            }

            saveUserChatsToDisk(userId, sessionObj.chats);

            // Notify real-time listeners if not from self
            if (!msg.key.fromMe && sessionObj.onMessageReceived) {
              sessionObj.onMessageReceived({
                userId,
                from: senderPhone,
                formattedPhone: `+${senderPhone}`,
                pushName,
                text,
                msgId,
                timestamp: msgTime
              });
            }
          }
        }
      } catch (upsertErr) {
        console.error(`[WhatsApp MultiService] Message upsert error for ${userId}:`, upsertErr.message);
      }
    });

    return getUserSessionStatus(userId);
  } catch (initErr) {
    console.error(`[WhatsApp MultiService] Failed to init session for ${userId}:`, initErr);
    sessionObj.status = 'ERROR';
    sessionObj.error = initErr.message;
    return getUserSessionStatus(userId);
  }
}

/**
 * Send an outbound message or PDF document from a specific sales rep's WhatsApp
 */
export async function sendUserWhatsAppMessage(rawUserId, { to, text = '', document = null, fileName = 'Document.pdf', mimetype = 'application/pdf', caption = '' }) {
  const userId = sanitizeUserId(rawUserId);
  const session = activeSessions.get(userId);

  if (!session || session.status !== 'CONNECTED' || !session.sock) {
    throw new Error(`Sales representative WhatsApp is not connected. Please scan QR Code in WhatsApp Setup.`);
  }

  const jid = formatPhoneNumberToJid(to);
  if (!jid) {
    throw new Error(`Invalid recipient phone number: ${to}`);
  }

  const sock = session.sock;
  const cleanPhone = String(to).replace(/[^0-9]/g, '');

  // Case 1: Sending document (PDF / Image)
  if (document) {
    let docPayload;

    if (Buffer.isBuffer(document)) {
      docPayload = document;
    } else if (typeof document === 'string' && document.startsWith('data:')) {
      const base64Data = document.split(',')[1] || document;
      docPayload = Buffer.from(base64Data, 'base64');
    } else if (typeof document === 'string' && (document.startsWith('http://') || document.startsWith('https://'))) {
      docPayload = { url: document };
    } else if (typeof document === 'string' && fs.existsSync(document)) {
      docPayload = fs.readFileSync(document);
    } else {
      throw new Error(`Unsupported document payload format.`);
    }

    const sendRes = await sock.sendMessage(jid, {
      document: docPayload,
      fileName: fileName || 'Document.pdf',
      mimetype: mimetype || 'application/pdf',
      caption: caption || text || ''
    });

    // Record outbound document message into chat history
    if (session.chats) {
      let chat = session.chats.get(cleanPhone);
      if (!chat) {
        chat = {
          id: cleanPhone,
          phone: `+${cleanPhone}`,
          customerName: `Customer +${cleanPhone}`,
          companyName: 'Client Contact',
          unreadCount: 0,
          timestamp: new Date().toISOString(),
          messages: []
        };
        session.chats.set(cleanPhone, chat);
      }
      chat.messages.push({
        id: sendRes?.key?.id || `MSG-${Date.now()}`,
        sender: 'agent',
        senderName: session.userName || 'Sales Representative',
        text: caption || text || `Sent Document: ${fileName}`,
        timestamp: new Date().toISOString(),
        status: 'sent'
      });
      chat.timestamp = new Date().toISOString();
      saveUserChatsToDisk(userId, session.chats);
    }

    return {
      success: true,
      messageId: sendRes?.key?.id,
      sender: session.phoneNumber,
      recipient: jid
    };
  }

  // Case 2: Standard Text Message
  const sendRes = await sock.sendMessage(jid, {
    text: text || ''
  });

  // Record outbound text message into chat history
  if (session.chats) {
    let chat = session.chats.get(cleanPhone);
    if (!chat) {
      chat = {
        id: cleanPhone,
        phone: `+${cleanPhone}`,
        customerName: `Customer +${cleanPhone}`,
        companyName: 'Client Contact',
        unreadCount: 0,
        timestamp: new Date().toISOString(),
        messages: []
      };
      session.chats.set(cleanPhone, chat);
    }
    chat.messages.push({
      id: sendRes?.key?.id || `MSG-${Date.now()}`,
      sender: 'agent',
      senderName: session.userName || 'Sales Representative',
      text: text,
      timestamp: new Date().toISOString(),
      status: 'sent'
    });
    chat.timestamp = new Date().toISOString();
    saveUserChatsToDisk(userId, session.chats);
  }

  return {
    success: true,
    messageId: sendRes?.key?.id,
    sender: session.phoneNumber,
    recipient: jid
  };
}

/**
 * Disconnect and unlink a sales representative's WhatsApp session
 */
export async function logoutUserSession(rawUserId) {
  const userId = sanitizeUserId(rawUserId);
  const session = activeSessions.get(userId);

  if (session && session.sock) {
    try {
      await session.sock.logout();
    } catch (_) {}
    try {
      session.sock.end(undefined);
    } catch (_) {}
  }

  activeSessions.delete(userId);

  const sessionDir = path.join(SESSIONS_BASE_DIR, `user_${userId}`);
  if (fs.existsSync(sessionDir)) {
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch (e) {
      console.error(`[WhatsApp MultiService] Could not remove session directory: ${e.message}`);
    }
  }

  return { success: true, userId, status: 'DISCONNECTED' };
}

/**
 * Auto-restore all saved sessions on server startup
 */
export async function autoRestoreAllSavedSessions(options = {}) {
  if (!fs.existsSync(SESSIONS_BASE_DIR)) return;

  const entries = fs.readdirSync(SESSIONS_BASE_DIR, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.isDirectory() && ent.name.startsWith('user_')) {
      const userId = ent.name.replace('user_', '');
      const credsPath = path.join(SESSIONS_BASE_DIR, ent.name, 'creds.json');
      if (fs.existsSync(credsPath)) {
        console.log(`[WhatsApp MultiService] Auto-restoring session for sales rep: ${userId}...`);
        initUserSession(userId, options).catch((err) => {
          console.warn(`[WhatsApp MultiService] Auto-restore error for ${userId}:`, err.message);
        });
      }
    }
  }
}
