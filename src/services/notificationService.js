// ===================================================================================
// BUSINZ ERP: UNIFIED NOTIFICATION SERVICE
// ===================================================================================
// Provides WhatsApp/Modern SaaS real-time notifications, Web Audio chimes,
// and Text-to-Speech voice announcements for all ERP workflows (BOM, Lead, PO, PI, etc.)
// ===================================================================================

let sharedAudioCtx = null;

export function getAudioContext() {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx && !sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch (_) {
    return null;
  }
}

/**
 * Play a pleasant, high-fidelity dual-tone notification chime using Web Audio API
 */
export function playWorkflowNotificationSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    // Dual-tone harmonic chime (WhatsApp / iOS style): 587.33Hz (D5) -> 880Hz (A5)
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    osc1.frequency.exponentialRampToValueAtTime(880.0, now + 0.12);

    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.4);
  } catch (err) {
    console.warn('[AudioChime] Chime error:', err);
  }
}

export function playPorterOrderAlert() {
  playWorkflowNotificationSound();
}

export function isVoiceNotificationEnabled() {
  if (typeof window === 'undefined' || !window.localStorage) return true;
  const val = localStorage.getItem('businz_voice_notifications_enabled');
  return val === null ? true : val === 'true';
}

export function setVoiceNotificationEnabled(enabled) {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('businz_voice_notifications_enabled', enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('businz_voice_toggle', { detail: { enabled: Boolean(enabled) } }));
  }
}

export function getVoiceAnnouncementText(notif) {
  if (!notif) return '';
  if (typeof notif === 'string') return notif;
  if (notif.voice_text && typeof notif.voice_text === 'string') return notif.voice_text;

  const eventType = String(notif.event_type || '').toUpperCase().trim();
  const docType = String(notif.document_type || '').toUpperCase().trim();
  const actorName = notif.actor_name || notif.actor_role || '';

  switch (eventType) {
    case 'PI_SAVED':
      return 'Proforma Invoice saved successfully';
    case 'BOM_SUBMITTED':
      return 'New BOM submitted from Sales';
    case 'PACKING_VERIFIED':
      return 'Packing verified by Dispatch';
    case 'ACCOUNTS_APPROVED':
      return 'Payment verified by Accounts';
    case 'ACCOUNTS_REJECTED':
    case 'PACKING_RETURNED':
      return 'Verification returned by Accounts';
    case 'INVOICE_COMPLETED':
      return 'Invoice completed, order ready for loading';
    case 'ORDER_DISPATCHED':
      return 'Order dispatched';
    case 'BOM_CANCELLED':
      return actorName ? `BOM cancelled by ${actorName}` : 'BOM order cancelled';
    case 'PO_SUBMITTED_FOR_APPROVAL':
      return 'Purchase Order submitted for approval';
    case 'PO_APPROVED':
      return 'Purchase Order approved by MD';
    case 'PO_REJECTED':
      return 'Purchase Order rejected';
    case 'PO_AWAITING_PAYMENT':
      return 'Approved Purchase Order awaiting payment';
    case 'PO_PAYMENT_COMPLETED':
      return 'Purchase Order payment completed';
    case 'LEAD_CREATED':
      return 'New lead received';
    case 'LEAD_ASSIGNED':
      return 'New lead assigned to you';
    case 'LEAD_REASSIGNED':
      return 'Lead reassigned to you';
    case 'WORK_ORDER_ASSIGNED':
      return 'Work order assigned';
    default:
      if (notif.title && typeof notif.title === 'string') {
        return notif.title.replace(/[^\w\s.,]/gi, '').trim();
      }
      return 'New workflow update';
  }
}

export function speakNotificationVoice(textOrNotif) {
  if (typeof window === 'undefined') return;

  // 1. Always play the dual-tone notification chime immediately
  try {
    playWorkflowNotificationSound();
  } catch (_) {}

  // 2. Check if voice announcements are enabled and supported
  if (!isVoiceNotificationEnabled() || !('speechSynthesis' in window)) return;

  const text = typeof textOrNotif === 'object' ? getVoiceAnnouncementText(textOrNotif) : textOrNotif;
  if (!text || typeof text !== 'string') return;

  try {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';

    // Store globally on window to protect against Chromium GC bug that silently cuts off speech
    window._businzSpeechUtterance = utterance;

    const selectVoiceAndSpeak = () => {
      try {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const preferred = voices.find(v =>
            v.lang.startsWith('en') &&
            (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Karen') || v.default)
          ) || voices.find(v => v.lang.startsWith('en'));

          if (preferred) utterance.voice = preferred;
        }
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('[VoiceAlert] Speak execution error:', err);
      }
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        selectVoiceAndSpeak();
      };
    } else {
      selectVoiceAndSpeak();
    }
  } catch (err) {
    console.warn('[VoiceAlert] Text-to-speech error:', err);
  }
}

export function isRoleTargeted() {
  return false;
}

export function sendWorkflowNotification() {
  // No-op: Notifications completely removed
  return { id: 'disabled', unread: false };
}

export function markNotificationAsRead() {
  // No-op
}

export function deleteLiveNotification() {
  // No-op
}

export function clearAllLiveNotifications() {
  // Clean up any remaining legacy localStorage keys if present
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.removeItem('vrm_live_notifications');
      localStorage.removeItem('controlroom_read_notification_ids');
      localStorage.removeItem('controlroom_notifications_read');
      localStorage.removeItem('controlroom_voice_notifications_enabled');
      localStorage.removeItem('controlroom_central_notifications_v2');
    } catch (_) {}
  }
}

// -----------------------------------------------------------------------------------
// Backwards-Compatible Workflow Notification No-Op Helpers
// -----------------------------------------------------------------------------------

export function notifyStockShortageToProcurement() {
  return { success: true, disabled: true };
}

export function notifyBomCreatedToSales() {
  return { success: true, disabled: true };
}

export function notifyBomSentToDispatch() {
  return { success: true, disabled: true };
}

export function notifyBomPackedAndSentToAccounts() {
  return { success: true, disabled: true };
}

export function notifyPiCreated() {
  return { success: true, disabled: true };
}

export function notifyAccountsVerificationCompleted() {
  return { success: true, disabled: true };
}

export function notifyInvoiceCompletedReadyForDispatch() {
  return { success: true, disabled: true };
}

export function notifyBomCancelledByDispatch() {
  return { success: true, disabled: true };
}

export function notifyDispatchCompletedToSales() {
  return { success: true, disabled: true };
}

export function notifyGrnCompletedToAccounts() {
  return { success: true, disabled: true };
}

export function notifyAccountsVerified() {
  return { success: true, disabled: true };
}

export function notifyInvoiceCompleted() {
  return { success: true, disabled: true };
}

export function notifyVehicleLoadedAndDispatched() {
  return { success: true, disabled: true };
}

export function notifyPurchaseOrderApproved() {
  return { success: true, disabled: true };
}

export function notifyNewQuotationCreated() {
  return { success: true, disabled: true };
}

export function notifyQuotationConverted() {
  return { success: true, disabled: true };
}

export function notifyNewWorkOrderCreated() {
  return { success: true, disabled: true };
}

export function notifyStockShortage() {
  return { success: true, disabled: true };
}

export function notifyLeadUnattended24h() {
  return { success: true, disabled: true };
}

export function notifyLeadAssigned() {
  return { success: true, disabled: true };
}

export function notifyNewLead() {
  return { success: true, disabled: true };
}

export function syncNotificationsFromCloud() {
  return Promise.resolve([]);
}

export function pruneStaleLiveNotifications() {
  return [];
}
