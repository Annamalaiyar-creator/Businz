// ===================================================================================
// BUSINZ ERP: NOTIFICATION SERVICE (DECOMMISSIONED)
// ===================================================================================
// All notifications, Web Audio chimes, Porter order alert tones, Text-to-Speech
// voice cues, cross-tab BroadcastChannel sync, and persistent notification stores
// have been completely removed and decommissioned per user authorization.
//
// All exported functions are maintained as pure, harmless no-ops to ensure 100%
// backwards compatibility with existing workflow callers without throwing errors.
// ===================================================================================

export function getAudioContext() {
  return null;
}

export function playWorkflowNotificationSound() {
  // No-op: Sound notifications completely removed
}

export function playPorterOrderAlert() {
  // No-op: Porter audio chime completely removed
}

export function isVoiceNotificationEnabled() {
  return false;
}

export function setVoiceNotificationEnabled() {
  // No-op: Voice notifications completely removed
}

export function getPorterVoiceCue() {
  return '';
}

export function speakNotificationVoice() {
  // No-op: Text-to-speech voice completely removed
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
