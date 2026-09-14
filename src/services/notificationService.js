// ===================================================================================
// CONTROLROOM WORKFLOW NOTIFICATION & AUDIO SERVICE
// ===================================================================================
// Manages real-time multi-stage notifications with synthesized Web Audio chimes,
// cross-tab BroadcastChannel sync, and deep linking across workflow stages:
// 1. Sales -> Dispatch (BOM received to pack) -> redirects to 'Dispatch Orders'
// 2. Dispatch -> Sales & Accounts (BOM packed & ready for accounts) -> redirects to 'Accounts Verification' / 'BOM Orders'
// 3. Accounts -> Billing (Verified & ready for invoicing) -> redirects to 'Invoice Management'
// 4. Billing -> Sales & Dispatch (Invoice completed & ready to dispatch) -> redirects to 'BOM Orders' / 'Dispatch Orders'
// ===================================================================================

import { fetchCloudStore, saveCloudStore } from "../utils/supabaseDataSync";

let audioCtx = null;

/**
 * Returns or initializes a Web Audio Context, handling browser autoplay resumption.
 */
export function getAudioContext() {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (e) {
    console.warn('Web Audio Context not available:', e);
    return null;
  }
}

// Automatically unlock audio context on initial user click/keypress in the window
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { once: true, passive: true });
  window.addEventListener('keydown', unlockAudio, { once: true, passive: true });
  window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
}

/**
 * Synthesizes a melodic, professional chime using the Web Audio API.
 * Never requires external audio files, works offline, zero latency, and sounds crisp.
 * @param {'chime' | 'success' | 'alert' | 'invoice'} soundType 
 */
export function playWorkflowNotificationSound(soundType = 'chime') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => playMelody(ctx, soundType)).catch(() => {});
    } else {
      playMelody(ctx, soundType);
    }
  } catch (e) {
    console.warn('Error playing workflow notification sound:', e);
  }
}

function playMelody(ctx, soundType) {
  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);
  masterGain.gain.setValueAtTime(0.35, now);

  let notes = [];
  if (soundType === 'success') {
    // Uplifting major chord progression: C5 -> E5 -> G5 -> C6
    notes = [
      { freq: 523.25, time: 0.0,  duration: 0.28, type: 'sine' },
      { freq: 659.25, time: 0.10, duration: 0.28, type: 'sine' },
      { freq: 783.99, time: 0.20, duration: 0.35, type: 'triangle' },
      { freq: 1046.5, time: 0.32, duration: 0.65, type: 'sine' }
    ];
  } else if (soundType === 'invoice') {
    // Crisp energetic two-tone chime
    notes = [
      { freq: 659.25, time: 0.0,  duration: 0.22, type: 'sine' },
      { freq: 987.77, time: 0.12, duration: 0.55, type: 'sine' }
    ];
  } else if (soundType === 'alert') {
    // Double ding attention tone
    notes = [
      { freq: 880.00, time: 0.0,  duration: 0.18, type: 'sine' },
      { freq: 880.00, time: 0.16, duration: 0.45, type: 'sine' }
    ];
  } else {
    // Default 'chime' (Slack/Apple style pleasant 3-bell ring: D5 -> A5 -> D6)
    notes = [
      { freq: 587.33, time: 0.0,  duration: 0.30, type: 'sine' },
      { freq: 880.00, time: 0.12, duration: 0.35, type: 'sine' },
      { freq: 1174.66, time: 0.24, duration: 0.65, type: 'sine' }
    ];
  }

  notes.forEach(({ freq, time, duration, type }) => {
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();

    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, now + time);

    // Exponential decay envelope (natural bell strike)
    noteGain.gain.setValueAtTime(0.001, now + time);
    noteGain.gain.exponentialRampToValueAtTime(0.8, now + time + 0.02);
    noteGain.gain.exponentialRampToValueAtTime(0.001, now + time + duration);

    osc.connect(noteGain);
    noteGain.connect(masterGain);

    osc.start(now + time);
    osc.stop(now + time + duration + 0.05);
  });
}

/**
 * Synthesizes an iconic Porter / delivery-app style upbeat order alert tone.
 * High clarity, vibrant 3-tone ascending chime (G5 -> C6 -> E6).
 */
export function playPorterOrderAlert() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => playPorterChime(ctx)).catch(() => {});
    } else {
      playPorterChime(ctx);
    }
  } catch (e) {
    console.warn('Error playing Porter order alert:', e);
  }
}

function playPorterChime(ctx) {
  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);
  masterGain.gain.setValueAtTime(0.48, now);

  // Iconic Porter / logistics style energetic 3-beat chime
  const notes = [
    { freq: 783.99, time: 0.0,  duration: 0.12, type: 'triangle' },
    { freq: 1046.5, time: 0.11, duration: 0.15, type: 'sine' },
    { freq: 1318.5, time: 0.24, duration: 0.40, type: 'sine' }
  ];

  notes.forEach(({ freq, time, duration, type }) => {
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, now + time);
    noteGain.gain.setValueAtTime(0.001, now + time);
    noteGain.gain.exponentialRampToValueAtTime(0.9, now + time + 0.015);
    noteGain.gain.exponentialRampToValueAtTime(0.001, now + time + duration);
    osc.connect(noteGain);
    noteGain.connect(masterGain);
    osc.start(now + time);
    osc.stop(now + time + duration + 0.05);
  });
}

/**
 * Global preference for Voice Notifications (Text-to-Speech)
 * Per requirements: Voice is ALWAYS ON.
 */
export function isVoiceNotificationEnabled() {
  return true; // Voice is always enabled
}

export function setVoiceNotificationEnabled(enabled) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('controlroom_voice_notifications_enabled', 'true');
    window.dispatchEvent(new CustomEvent('controlroom_voice_setting_changed', { detail: { enabled: true } }));
  } catch (_) {}
}

/**
 * Cache available speech synthesis voices
 */
let cachedVoices = [];
if (typeof window !== 'undefined' && window.speechSynthesis) {
  const loadVoices = () => {
    try {
      cachedVoices = window.speechSynthesis.getVoices() || [];
    } catch (_) {}
  };
  loadVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

/**
 * Extracts a voice announcement in the format: "[Company Name], [Status]"
 * (e.g. "Vikram Solar, Order Packed" or "Tata Power, Proforma Invoice Created")
 */
export function getPorterVoiceCue(titleOrMessage, metadata = {}) {
  const fullText = ((typeof titleOrMessage === 'object' ? `${titleOrMessage.title || ''} ${titleOrMessage.message || ''}` : titleOrMessage) || '');
  const upperText = fullText.toUpperCase();
  const step = (metadata && metadata.step) ? String(metadata.step).toUpperCase() : '';

  // 1. Extract and clean company / customer / vendor name
  let rawCompany = '';
  if (metadata) {
    rawCompany = metadata.companyName || metadata.customerName || metadata.customer || metadata.company || metadata.client || metadata.clientName || metadata.vendor || metadata.vendorName || '';
  }
  if (!rawCompany && typeof titleOrMessage === 'object' && titleOrMessage) {
    rawCompany = titleOrMessage.companyName || titleOrMessage.customerName || titleOrMessage.customer || titleOrMessage.company || titleOrMessage.client || titleOrMessage.clientName || titleOrMessage.vendor || titleOrMessage.vendorName || '';
  }

  // If not in metadata, inspect message parentheses: e.g. "BOM-1042 (Vikram Solar)"
  if (!rawCompany) {
    const parenMatch = fullText.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1]) {
      const candidate = parenMatch[1].trim();
      if (!candidate.startsWith('BOM-') && !candidate.startsWith('INV-') && !candidate.startsWith('PO-') && !candidate.startsWith('PI-') && candidate.length > 2) {
        rawCompany = candidate;
      }
    }
  }

  // If not in parentheses, inspect "for [Company]" or "from [Company]"
  if (!rawCompany) {
    const forMatch = fullText.match(/\b(?:for|from)\s+([A-Z0-9][A-Za-z0-9\s&]+?)(?:\s+(?:has|is|was|to|\.|—|-|\(|$))/);
    if (forMatch && forMatch[1]) {
      const candidate = forMatch[1].trim();
      if (candidate.length > 2 && candidate.toLowerCase() !== 'dispatch' && candidate.toLowerCase() !== 'accounts') {
        rawCompany = candidate;
      }
    }
  }

  // Clean company name for crisp, natural voice pronunciation (e.g. "Vikram Solar Pvt Ltd" -> "Vikram Solar")
  let cleanCompany = '';
  if (rawCompany && typeof rawCompany === 'string') {
    cleanCompany = rawCompany
      .replace(/\b(Pvt|Private)\s+(Ltd|Limited)\b/gi, '')
      .replace(/\b(Ltd|Limited|LLP|Inc|Corp)\b/gi, '')
      .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[–—_#*:()!]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const lower = cleanCompany.toLowerCase();
    if (lower === 'customer' || lower === 'client' || lower === 'all' || lower === 'vendor') {
      cleanCompany = '';
    }
  }

  const companyToSpeak = cleanCompany || 'VRM';

  // 2. Determine Status cleanly
  let status = 'New Order';
  if (step.includes('BOM_SENT_TO_DISPATCH') || upperText.includes('RECEIVED TO PACK') || upperText.includes('NEW BOM RECEIVED') || upperText.includes('RECEIVED TO DISPATCH')) {
    status = 'New Order to Pack';
  } else if (step.includes('BOM_PACKED') || upperText.includes('PACKED AND SENT') || upperText.includes('PACKED & SENT') || upperText.includes('BOM PACKED') || upperText.includes('ORDER PACKED') || upperText.includes('PACKING COMPLETED')) {
    status = 'Order Packed';
  } else if (step.includes('ACCOUNTS_VERIFIED') || step.includes('BILLING_NOTIF') || upperText.includes('ACCOUNTS APPROVED') || upperText.includes('PAYMENT APPROVED')) {
    status = 'Payment Approved';
  } else if (step.includes('INVOICE_COMPLETED') || step.includes('DISPATCH_NOTIF') || upperText.includes('INVOICE COMPLETED') || upperText.includes('CLEARED FOR VEHICLE')) {
    status = 'Order Cleared for Dispatch';
  } else if (step.includes('CANCEL') || upperText.includes('CANCEL')) {
    status = 'Order Cancelled';
  } else if (upperText.includes('ACCOUNTS VERIFICATION') || upperText.includes('FOR ACCOUNTS')) {
    status = 'Payment Verification Needed';
  } else if (upperText.includes('READY FOR INVOICE') || upperText.includes('READY FOR INVOICING')) {
    status = 'Invoice Ready';
  } else if (upperText.includes('DISPATCHED') || upperText.includes('VEHICLE LOADED')) {
    status = 'Order Dispatched';
  } else if (upperText.includes('PROFORMA INVOICE') || upperText.includes('CONVERTED TO PI') || upperText.includes('PI CREATED')) {
    status = 'Proforma Invoice Created';
  } else if (upperText.includes('PURCHASE ORDER APPROVED') || upperText.includes('PO APPROVED')) {
    status = 'Purchase Order Approved';
  } else if (upperText.includes('PURCHASE ORDER') || upperText.includes('NEW PO')) {
    status = 'New Purchase Order';
  } else if (upperText.includes('QUOTATION CONVERTED')) {
    status = 'Quotation Converted';
  } else if (upperText.includes('QUOTATION')) {
    status = 'Quotation Created';
  } else if (upperText.includes('WORK ORDER')) {
    status = 'New Work Order';
  } else if (upperText.includes('NEW BOM') || upperText.includes('NEW ORDER')) {
    status = 'New Order';
  } else {
    // Fallback: Take the first few words of the title cleanly
    const title = (typeof titleOrMessage === 'object' ? titleOrMessage.title : titleOrMessage) || '';
    const cleanTitle = title
      .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[–—_#*:()!]/g, ' ')
      .trim();

    const words = cleanTitle.split(/\s+/).filter(Boolean);
    if (words.length > 0 && words.length <= 4) {
      status = words.join(' ');
    }
  }

  // 3. Return Combined: "[Company Name], [Status]"
  return `${companyToSpeak}, ${status}`;
}

/**
 * Pronounces the voice announcement using a clear female / girl voice
 * format: "[Company Name], [Status]"
 * @param {string} text - The cue to speak (or full text which will be converted to a cue)
 * @param {Object} options - Optional configuration { rate, pitch, volume }
 */
export function speakNotificationVoice(text, options = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  try {
    let cue = (text && typeof text === 'string' && (text.length > 40 || text.includes('.')))
      ? getPorterVoiceCue(text, options.metadata)
      : (text || 'VRM, New Order');

    window.speechSynthesis.cancel();

    // Final clean
    const spoken = cue
      .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[–—_#*]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!spoken) return;

    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = 'en-US';
    utterance.rate = options.rate || 1.05; // Clear natural speed
    utterance.pitch = options.pitch || 1.18; // Soft, natural female/girl voice pitch
    utterance.volume = options.volume != null ? options.volume : 1.0;

    // Prioritize natural-sounding female / girl voices
    let voices = cachedVoices.length > 0 ? cachedVoices : [];
    if (voices.length === 0 && window.speechSynthesis.getVoices) {
      voices = window.speechSynthesis.getVoices() || [];
    }

    if (voices.length > 0) {
      const femaleKeywords = [
        'google uk english female',
        'google us english',
        'samantha',
        'victoria',
        'karen',
        'zira',
        'jenny',
        'aria',
        'veena',
        'heera',
        'neerja',
        'hazel',
        'susan',
        'fiona',
        'moira',
        'tessa',
        'ava',
        'allison',
        'serena',
        'kate',
        'female',
        'woman',
        'girl'
      ];

      // 1. Search for English female voice
      let girlVoice = null;
      for (const kw of femaleKeywords) {
        girlVoice = voices.find(v => 
          (v.lang && v.lang.startsWith('en')) && 
          v.name.toLowerCase().includes(kw)
        );
        if (girlVoice) break;
      }

      // 2. Fallback: Any voice with female/girl in name
      if (!girlVoice) {
        girlVoice = voices.find(v => {
          const nm = v.name.toLowerCase();
          return nm.includes('female') || nm.includes('girl') || nm.includes('woman');
        });
      }

      // 3. Fallback: standard en-US or en voice
      if (!girlVoice) {
        girlVoice = voices.find(v => v.lang === 'en-US') || voices.find(v => v.lang && v.lang.startsWith('en'));
      }

      if (girlVoice) {
        utterance.voice = girlVoice;
      }
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Speech synthesis error:', e);
  }
}

// Global listener for custom speak events
if (typeof window !== 'undefined') {
  window.addEventListener('controlroom_voice_speak', (e) => {
    if (e && e.detail && e.detail.text) {
      speakNotificationVoice(e.detail.text, e.detail.options);
    }
  });
}

/**
 * Checks whether a given role matches the notification's target roles.
 * System administrators and Executives always receive all notifications.
 */
export function isRoleTargeted(userRole, targetRoles, metadata = {}) {
  if (!userRole) return true;
  
  // Executive Leadership & Tech Admins have global visibility
  const adminRoles = ['CEO', 'Managing Director', 'MD', 'Technical Administrator', 'Developer'];
  if (adminRoles.includes(userRole) || (userRole || '').startsWith('TA')) {
    return true;
  }

  if (!targetRoles || targetRoles === 'All' || targetRoles === '*' || targetRoles.length === 0) {
    return true;
  }

  const roleList = Array.isArray(targetRoles) ? targetRoles : [targetRoles];

  // Resolve active logged in user name and employee ID
  let currentUserName = '';
  let currentUserEmpId = '';
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      currentUserName = (localStorage.getItem('controlroom_logged_user_name') || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
      currentUserEmpId = (localStorage.getItem('controlroom_logged_emp_id') || '').trim().toUpperCase();
    }
  } catch (_) {}

  // Fallback defaults if not set in localStorage
  if (!currentUserName) {
    if (userRole === 'Sales Executive') currentUserName = 'mohith jv';
    else if (userRole === 'Sales Head') currentUserName = 'vijay';
    else if (userRole === 'Technical Administrator' || userRole === 'CEO') currentUserName = 'annamalaiyar';
  }

  // 1. Direct match by employee ID
  if (currentUserEmpId) {
    for (const t of roleList) {
      if (t && String(t).trim().toUpperCase() === currentUserEmpId) return true;
    }
    if (metadata && metadata.salesPersonCode && String(metadata.salesPersonCode).trim().toUpperCase() === currentUserEmpId) {
      return true;
    }
  }

  // 2. Direct match by user name (e.g. Sales Person who created the BOM)
  if (currentUserName) {
    for (const t of roleList) {
      if (!t) continue;
      const cleanTarget = String(t).replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
      if (cleanTarget && (cleanTarget === currentUserName || cleanTarget.includes(currentUserName) || currentUserName.includes(cleanTarget))) {
        return true;
      }
    }
    if (metadata && (metadata.salesPerson || metadata.createdBy)) {
      const sp = String(metadata.salesPerson || metadata.createdBy).replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
      if (sp && (sp === currentUserName || sp.includes(currentUserName) || currentUserName.includes(sp))) {
        return true;
      }
    }
  }

  // 3. Direct match by userRole
  if (roleList.includes(userRole)) return true;

  // 4. Departmental / role-level matching
  const normalizedUserRole = userRole.toLowerCase();

  for (const t of roleList) {
    const norm = (t || '').toLowerCase();
    
    // Dispatch department
    if ((norm.includes('dispatch') || norm.includes('production')) && 
        (normalizedUserRole.includes('dispatch') || normalizedUserRole.includes('production') || normalizedUserRole.includes('floor'))) {
      return true;
    }
    
    // Sales department
    if (norm.includes('sales') && normalizedUserRole.includes('sales')) {
      // If notification has a specific salesPerson and this user is a Sales Executive:
      if (normalizedUserRole === 'sales executive' && currentUserName && metadata && (metadata.salesPerson || metadata.createdBy)) {
        const creator = String(metadata.salesPerson || metadata.createdBy).replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
        if (creator && creator !== 'sales executive' && creator !== 'sales head' && creator !== 'sales') {
          // Check if current user is that creator
          if (creator === currentUserName || creator.includes(currentUserName) || currentUserName.includes(creator)) {
            return true;
          }
          // Different sales executive: do not alert them
          return false;
        }
      }
      return true;
    }
    
    // Accounts department
    if (norm.includes('account') && normalizedUserRole.includes('account')) {
      return true;
    }
    
    // Billing department
    if ((norm.includes('billing') || norm.includes('invoice')) && 
        (normalizedUserRole.includes('billing') || normalizedUserRole.includes('invoice') || normalizedUserRole.includes('account'))) {
      return true;
    }
  }

  return false;
}

// Setup cross-tab BroadcastChannel if supported
let broadcastChannel = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel('controlroom_notifications_channel');
    broadcastChannel.onmessage = (event) => {
      if (event && event.data && event.data.type === 'VRM_WORKFLOW_NOTIFICATION') {
        const notif = event.data.payload;
        // Dispatch local event in this tab
        window.dispatchEvent(new CustomEvent('vrm_workflow_toast', { detail: notif }));
        window.dispatchEvent(new Event('vrm_notifications_updated'));

        // Play alert audio and voice if targeted to this active tab's session
        try {
          const currentRole = (typeof window !== 'undefined' && window.localStorage)
            ? (localStorage.getItem('controlroom_user_role') || '')
            : '';
          const isTargeted = isRoleTargeted(currentRole, notif.targetRoles, notif.metadata);
          if (isTargeted) {
            playPorterOrderAlert();
            setTimeout(() => {
              const cue = getPorterVoiceCue(notif, notif.metadata);
              speakNotificationVoice(cue, { rate: 1.12, pitch: 1.05 });
            }, 320);
          }
        } catch (_) {}
      }
    };
  } catch (e) {
    console.warn('BroadcastChannel not initialized:', e);
  }
}

/**
 * Core function to send and persist a workflow notification.
 * Plays sound, displays live toast banner, syncs to localStorage & broadcast channel.
 */
export function sendWorkflowNotification({
  title,
  message,
  targetTab,
  targetRoles = ['All'],
  type = 'info',
  soundType = 'chime',
  metadata = {}
}) {
  const notifId = `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const notification = {
    id: notifId,
    title,
    message,
    targetTab,
    targetRoles: Array.isArray(targetRoles) ? targetRoles : [targetRoles],
    role: Array.isArray(targetRoles) ? targetRoles[0] : targetRoles,
    type,
    soundType,
    time: timeStr,
    createdAt: new Date().toISOString(),
    metadata,
    unread: true
  };

  // 1. Save to persistent storage for Header Bell icon
  try {
    const existing = JSON.parse(localStorage.getItem('vrm_live_notifications') || '[]');
    const updated = [notification, ...existing.filter(n => n.id !== notifId)].slice(0, 50);
    localStorage.setItem('vrm_live_notifications', JSON.stringify(updated));
    saveCloudStore('notifications_store', updated);
  } catch (e) {
    console.error('Error saving live notification:', e);
  }

  // 2. Play iconic Porter-style order alert chime & speak voice cue if current user session is targeted
  const currentRole = (typeof window !== 'undefined' && window.localStorage)
    ? (localStorage.getItem('controlroom_user_role') || '')
    : '';
  const isTargetedToCurrentSession = isRoleTargeted(currentRole, targetRoles, metadata);

  if (isTargetedToCurrentSession) {
    playPorterOrderAlert();

    // 2b. Speak short, punchy Porter-style voice cue (e.g. "Vikram Solar, Order Packed!")
    setTimeout(() => {
      const cue = getPorterVoiceCue(notification, notification.metadata);
      speakNotificationVoice(cue, { rate: 1.12, pitch: 1.05 });
    }, 320);
  }

  // 3. Emit local event for current tab toast
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vrm_workflow_toast', { detail: notification }));
    window.dispatchEvent(new Event('vrm_notifications_updated'));
  }

  // 4. Broadcast to other open browser tabs
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({
        type: 'VRM_WORKFLOW_NOTIFICATION',
        payload: { ...notification, fromBroadcast: true }
      });
    } catch (e) {
      console.warn('Error posting to BroadcastChannel:', e);
    }
  }

  return notification;
}

/**
 * Marks a notification ID as read in localStorage and dispatches an update event.
 */
export function markNotificationAsRead(notifId) {
  if (!notifId) return;
  try {
    const existing = JSON.parse(localStorage.getItem('controlroom_read_notification_ids') || '[]');
    if (!existing.includes(notifId)) {
      const updated = [...existing, notifId];
      localStorage.setItem('controlroom_read_notification_ids', JSON.stringify(updated));
    }
    window.dispatchEvent(new Event('vrm_notifications_updated'));
  } catch (e) {
    console.error('Error marking notification as read:', e);
  }
}

/**
 * Removes a notification completely from storage.
 */
export function deleteLiveNotification(notifId) {
  if (!notifId) return;
  try {
    const existing = JSON.parse(localStorage.getItem('vrm_live_notifications') || '[]');
    const filtered = existing.filter(n => n.id !== notifId);
    localStorage.setItem('vrm_live_notifications', JSON.stringify(filtered));
    window.dispatchEvent(new Event('vrm_notifications_updated'));
  } catch (e) {
    console.error('Error deleting live notification:', e);
  }
}

/**
 * Clears all live notifications and read history from storage.
 */
export function clearAllLiveNotifications() {
  try {
    localStorage.removeItem('vrm_live_notifications');
    localStorage.removeItem('controlroom_read_notification_ids');
    window.dispatchEvent(new Event('vrm_notifications_updated'));
  } catch (e) {
    console.error('Error clearing live notifications:', e);
  }
}

// ===================================================================================
// DEDICATED WORKFLOW HELPERS AS REQUESTED
// ===================================================================================

/**
 * STEP 1: Sales person creates/proceeds with a BOM to Dispatch / Production.
 * Dispatch team receives message: "You have received a BOM to pack: [BOM ID / Customer]"
 * Clicking redirects to 'Dispatch Orders' screen.
 */
export function notifyBomSentToDispatch({ bomCode, customerName, salesPerson }) {
  const safeCustomer = customerName || 'Customer';
  return sendWorkflowNotification({
    title: `📦 New BOM Received to Pack`,
    message: `You have received BOM ${bomCode} (${safeCustomer}) to pack. Click to open and begin packing.`,
    targetTab: 'Dispatch Orders',
    targetRoles: ['Dispatch Head', 'Production Head', 'Production Admin', 'Dispatch Executive', 'Floor Supervisor'],
    type: 'info',
    soundType: 'chime',
    metadata: {
      bomCode,
      customerName: safeCustomer,
      salesPerson: salesPerson || 'Sales Executive',
      step: 'BOM_SENT_TO_DISPATCH'
    }
  });
}

/**
 * STEP 2: Dispatch / Production finishes packing the BOM.
 * 1. Sales person receives notification: "BOM [BOM ID] is packed and proceeded to Accounts verification"
 * 2. Accounts team receives notification: "BOM [BOM ID] is packed and ready for Accounts verification"
 * Clicking redirects to 'Accounts Verification' or 'BOM Orders'.
 */
export function notifyBomPackedAndSentToAccounts({ bomCode, customerName, salesPerson, salesPersonCode, createdBy, createdById }) {
  const safeCustomer = customerName || 'Customer';
  const resolvedSalesPerson = (salesPerson || createdBy || '').replace(/\s*\([^)]*\)/g, '').trim();
  const resolvedCode = salesPersonCode || createdById || '';

  // Target list specifically for the salesperson who created this BOM:
  // Includes their exact name/ID, as well as Sales Executive and Sales Head
  const salesTargets = [
    resolvedSalesPerson,
    resolvedCode,
    'Sales Executive',
    'Sales Head',
    'CEO',
    'Managing Director'
  ].filter(Boolean);

  // 2a. Notification specifically for the Sales Person who created the BOM
  sendWorkflowNotification({
    title: `📦 BOM Packing Completed`,
    message: `BOM ${bomCode} (${safeCustomer}) created by ${resolvedSalesPerson || 'Sales'} has been fully packed and proceeded to Accounts verification.`,
    targetTab: 'BOM Orders',
    targetRoles: salesTargets,
    type: 'success',
    soundType: 'success',
    metadata: {
      bomCode,
      customerName: safeCustomer,
      salesPerson: resolvedSalesPerson || 'Sales Executive',
      salesPersonCode: resolvedCode,
      createdBy: resolvedSalesPerson,
      step: 'BOM_PACKED'
    }
  });

  // 2b. Notification for Accounts Team (staggered slightly so voice alerts don't collide)
  setTimeout(() => {
    sendWorkflowNotification({
      title: `💳 New BOM for Accounts Verification`,
      message: `BOM ${bomCode} (${safeCustomer}) is fully packed and ready for payment & accounts verification.`,
      targetTab: 'Accounts Verification',
      targetRoles: ['Accounts Head', 'Accounts Executive'],
      type: 'info',
      soundType: 'chime',
      metadata: {
        bomCode,
        customerName: safeCustomer,
        salesPerson: resolvedSalesPerson,
        step: 'BOM_PACKED_ACCOUNTS_NOTIF'
      }
    });
  }, 1600);
}

/**
 * STEP 2.5: Proforma Invoice Created Notification
 * Voice alert: "[Customer Name], Proforma Invoice Created!"
 * Triggered whenever a sales person creates a Proforma Invoice.
 */
export function notifyPiCreated({ piNo, customerName, salesPerson, salesPersonCode, amount }) {
  const safeCustomer = customerName || 'Customer';
  const cleanSalesPerson = (salesPerson || '').replace(/\s*\([^)]*\)/g, '').trim();
  const amtText = amount ? ` (${amount})` : '';

  const salesTargets = [
    cleanSalesPerson,
    salesPersonCode,
    'Sales Executive',
    'Sales Head',
    'Procurement Admin',
    'Accounts Head',
    'Accounts Executive',
    'CEO',
    'Managing Director',
    'Technical Administrator'
  ].filter(Boolean);

  return sendWorkflowNotification({
    title: `📑 Proforma Invoice Created`,
    message: `Proforma Invoice ${piNo} for ${safeCustomer}${amtText} has been created by ${cleanSalesPerson || 'Sales'}.`,
    targetTab: 'Proforma Invoice',
    targetRoles: salesTargets,
    type: 'success',
    soundType: 'success',
    metadata: {
      piNo,
      customerName: safeCustomer,
      salesPerson: cleanSalesPerson,
      salesPersonCode: salesPersonCode || '',
      step: 'PI_CREATED'
    }
  });
}

/**
 * STEP 3: Accounts verification completed.
 * Proceeds to Billing team for invoice generation.
 * Billing team gets notified: "BOM [BOM ID] verified by Accounts, ready for Invoicing"
 * Clicking redirects to 'Invoice Management'.
 */
export function notifyAccountsVerificationCompleted({ bomCode, customerName, invoiceNo, salesPerson }) {
  const safeCustomer = customerName || 'Customer';
  const invText = invoiceNo ? ` (${invoiceNo})` : '';

  // 3a. Notification for Billing / Invoice Team
  sendWorkflowNotification({
    title: `🧾 BOM Verified — Ready for Invoicing`,
    message: `BOM ${bomCode} (${safeCustomer}) has been approved by Accounts. Ready for Invoice creation${invText}.`,
    targetTab: 'Invoice Management',
    targetRoles: ['Billing', 'Invoice Executive', 'Accounts Executive', 'Accounts Head'],
    type: 'info',
    soundType: 'invoice',
    metadata: {
      bomCode,
      invoiceNo,
      customerName: safeCustomer,
      step: 'ACCOUNTS_VERIFIED_BILLING_NOTIF'
    }
  });

  // 3b. Notification for Sales Person
  return sendWorkflowNotification({
    title: `💳 Accounts Approved BOM`,
    message: `Accounts verification passed for BOM ${bomCode} (${safeCustomer}). Forwarded to Billing for invoice generation.`,
    targetTab: 'BOM Orders',
    targetRoles: ['Sales Executive', 'Sales Head'],
    type: 'info',
    soundType: 'chime',
    metadata: {
      bomCode,
      customerName: safeCustomer,
      salesPerson,
      step: 'ACCOUNTS_VERIFIED_SALES_NOTIF'
    }
  });
}

/**
 * STEP 4: Invoice completed by Billing team.
 * 1. Sales person receives notification: "Invoice is completed for BOM [BOM ID] and ready to dispatch."
 * 2. Dispatch team receives notification: "Invoice cleared. Ready for vehicle loading & dispatch!"
 * Clicking redirects to 'BOM Orders' or 'Dispatch Orders'.
 */
export function notifyInvoiceCompletedReadyForDispatch({ invoiceNo, bomCode, customerName, salesPerson }) {
  const safeCustomer = customerName || 'Customer';
  const safeInv = invoiceNo || 'INV-2026';

  // 4a. Notification for Sales Person
  sendWorkflowNotification({
    title: `✅ Invoice Completed & Ready to Dispatch`,
    message: `Invoice ${safeInv} is completed for BOM ${bomCode} (${safeCustomer}) and ready to dispatch.`,
    targetTab: 'BOM Orders',
    targetRoles: ['Sales Executive', 'Sales Head'],
    type: 'success',
    soundType: 'success',
    metadata: {
      invoiceNo: safeInv,
      bomCode,
      customerName: safeCustomer,
      salesPerson: salesPerson || 'Sales Executive',
      step: 'INVOICE_COMPLETED_SALES_NOTIF'
    }
  });

  // 4b. Notification for Dispatch Team
  return sendWorkflowNotification({
    title: `🚚 Order Cleared for Vehicle Loading`,
    message: `Invoice ${safeInv} cleared for BOM ${bomCode} (${safeCustomer}). Ready for vehicle loading and final dispatch!`,
    targetTab: 'Dispatch Orders',
    targetRoles: ['Dispatch Head', 'Production Head', 'Dispatch Executive', 'Floor Supervisor'],
    type: 'success',
    soundType: 'chime',
    metadata: {
      invoiceNo: safeInv,
      bomCode,
      customerName: safeCustomer,
      step: 'INVOICE_COMPLETED_DISPATCH_NOTIF'
    }
  });
}

/**
 * STEP 5: BOM Cancelled by Dispatch (or Accounts/Production).
 * Immediately notifies the Sales Person who raised this BOM with the exact reason,
 * releases inventory, and logs to the audit notification center.
 */
export function notifyBomCancelledByDispatch({ bomCode, customerName, salesPerson, reason, cancelledBy }) {
  const safeCustomer = customerName || 'Customer';
  const safeCode = bomCode || 'BOM';
  const safeReason = reason || 'Order cancelled by Dispatch';
  const safeCancelledBy = cancelledBy || 'Dispatch Head';
  const safeSalesPerson = salesPerson || 'Sales Executive';

  // 5a. High-priority notification specifically targeting the Sales Person and Sales Team
  return sendWorkflowNotification({
    title: `❌ BOM Cancelled: ${safeCode}`,
    message: `BOM ${safeCode} (${safeCustomer}) was CANCELLED by ${safeCancelledBy}. Reason: "${safeReason}". Blocked stock has been released.`,
    targetTab: 'BOM Orders',
    targetRoles: [safeSalesPerson, 'Sales Executive', 'Sales Head', 'All', 'Admin', 'CEO', 'MD'],
    type: 'error',
    soundType: 'alert',
    metadata: {
      bomCode: safeCode,
      customerName: safeCustomer,
      salesPerson: safeSalesPerson,
      cancelledBy: safeCancelledBy,
      reason: safeReason,
      step: 'BOM_CANCELLED_NOTIF'
    }
  });
}

/**
 * Fetch latest notifications from cloud store and merge with local notifications
 * so Dispatch and Accounts logins on different devices/browsers receive live alerts.
 */
export async function syncCloudNotifications() {
  if (typeof window === 'undefined') return;
  try {
    const cloudNotifs = await fetchCloudStore('notifications_store', []);
    if (Array.isArray(cloudNotifs) && cloudNotifs.length > 0) {
      const localNotifs = JSON.parse(localStorage.getItem('vrm_live_notifications') || '[]');
      const map = new Map();
      [...cloudNotifs, ...localNotifs].forEach(n => {
        if (n && n.id && !map.has(n.id)) {
          map.set(n.id, n);
        }
      });
      const merged = Array.from(map.values()).slice(0, 50);
      localStorage.setItem('vrm_live_notifications', JSON.stringify(merged));
      window.dispatchEvent(new Event('vrm_notifications_updated'));
    }
  } catch (_) {}
}

if (typeof window !== 'undefined') {
  setTimeout(() => syncCloudNotifications(), 1500);
  window.addEventListener('controlroom_storage_update', () => syncCloudNotifications());
}

