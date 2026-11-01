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
// -----------------------------------------------------------------------------------
// Enterprise Real-Time Department-to-Department Workflow Notification Dispatchers
// -----------------------------------------------------------------------------------

async function sendServerWorkflowNotification(payload) {
  try {
    const actorEmp = (typeof localStorage !== 'undefined' ? localStorage.getItem('controlroom_logged_emp_id') : '') || '';
    const actorName = (typeof localStorage !== 'undefined' ? localStorage.getItem('controlroom_logged_user_name') : '') || 'System';
    const actorRole = (typeof localStorage !== 'undefined' ? localStorage.getItem('controlroom_user_role') : '') || 'System';

    const res = await fetch('/api/workflow-notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-employee-code': actorEmp,
        'x-user-name': actorName,
        'x-user-role': actorRole
      },
      body: JSON.stringify({
        ...payload,
        actorEmpCode: actorEmp,
        actorName,
        actorRole
      })
    });
    return await res.json();
  } catch (err) {
    console.warn('[WorkflowNotif Send Error]:', err.message);
    return { success: false, error: err.message };
  }
}

export function notifyStockShortageToProcurement() {
  return { success: true };
}

export function notifyBomCreatedToSales() {
  return { success: true };
}

export function notifyBomSentToDispatch({ bomCode, customerName, salesPerson }) {
  return sendServerWorkflowNotification({
    recipientRole: 'Dispatch Head',
    eventType: 'BOM_SUBMITTED',
    documentType: 'BOM',
    documentId: bomCode,
    title: `📦 New BOM Submitted: ${bomCode}`,
    message: `BOM ${bomCode} (${customerName || 'Customer'}) has been confirmed by ${salesPerson || 'Sales'} and forwarded for Dispatch Packing.`,
    targetTab: 'Dispatch Orders',
    targetRecordId: bomCode,
    dedupId: `bom_submitted_${bomCode}`
  });
}

export function notifyBomPackedAndSentToAccounts({ bomCode, customerName, actorName }) {
  return sendServerWorkflowNotification({
    recipientRole: 'Accounts Head',
    eventType: 'PACKING_VERIFIED',
    documentType: 'BOM',
    documentId: bomCode,
    title: `💳 Packing Verified: BOM ${bomCode}`,
    message: `BOM ${bomCode} (${customerName || 'Customer'}) packed and verified by Dispatch. Ready for Accounts Payment Verification.`,
    targetTab: 'Accounts Verification',
    targetRecordId: bomCode,
    dedupId: `bom_packing_verified_${bomCode}`
  });
}

export function notifyPiCreated() {
  return { success: true };
}

export function notifyAccountsVerificationCompleted({ bomCode, customerName, actorName }) {
  return sendServerWorkflowNotification({
    recipientRole: 'Billing',
    eventType: 'ACCOUNTS_APPROVED',
    documentType: 'BOM',
    documentId: bomCode,
    title: `📄 Accounts Verified: BOM ${bomCode}`,
    message: `Payment & accounts verification complete for BOM ${bomCode} (${customerName || 'Customer'}). Ready for Tax Invoice generation.`,
    targetTab: 'Invoice Management',
    targetRecordId: bomCode,
    dedupId: `bom_accounts_approved_${bomCode}`
  });
}

export function notifyInvoiceCompletedReadyForDispatch({ bomCode, customerName, invoiceNo }) {
  return sendServerWorkflowNotification({
    recipientRole: 'Dispatch Head',
    eventType: 'INVOICE_COMPLETED',
    documentType: 'BOM',
    documentId: bomCode,
    title: `🚚 Invoice Confirmed — Ready for Loading: ${bomCode}`,
    message: `Tax Invoice (${invoiceNo || bomCode}) completed for ${customerName || 'Customer'}. Ready for vehicle loading and final dispatch.`,
    targetTab: 'Dispatch Orders',
    targetRecordId: bomCode,
    dedupId: `bom_invoice_ready_loading_${bomCode}`
  });
}

export function notifyDispatchCompletedToSales({ bomCode, customerName, salesPerson, salesPersonId, transporterName, lrNumber }) {
  return sendServerWorkflowNotification({
    recipientEmpCode: salesPersonId || null,
    recipientRole: 'Sales Executive',
    eventType: 'ORDER_DISPATCHED',
    documentType: 'BOM',
    documentId: bomCode,
    title: `🚀 Order Dispatched: BOM ${bomCode}`,
    message: `Order ${bomCode} (${customerName || 'Customer'}) has been loaded and dispatched via ${transporterName || 'Transporter'}${lrNumber ? ` (LR: ${lrNumber})` : ''}.`,
    targetTab: 'Sales BOM',
    targetRecordId: bomCode,
    dedupId: `bom_dispatched_${bomCode}`
  });
}

export function notifyBomCancelledByDispatch({ bomCode, customerName, salesPerson, reason, cancelledBy }) {
  return sendServerWorkflowNotification({
    recipientRole: 'Sales Executive',
    eventType: 'BOM_CANCELLED',
    documentType: 'BOM',
    documentId: bomCode,
    title: `❌ BOM ${bomCode} Cancelled`,
    message: `BOM ${bomCode} (${customerName || 'Customer'}) was cancelled by ${cancelledBy || 'Dispatch'}. Reason: ${reason || 'Cancelled by Dispatch'}`,
    targetTab: 'Sales BOM',
    targetRecordId: bomCode,
    dedupId: `bom_cancel_${bomCode}_${Date.now()}`
  });
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
