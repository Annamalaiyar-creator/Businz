import {
  Check, Truck, CreditCard, FileCheck, CheckSquare, PackageCheck, Receipt
} from 'lucide-react';
import { stripDataUrlsFromRecord } from '../../../utils/otherViewsShared.js';

export const formatAppliedAtDate = (r) => {
  if (!r) return '—';
  if (r.dateTimeObj && typeof r.dateTimeObj === 'object') {
    const d = r.dateTimeObj.date;
    if (typeof d === 'string' && d.trim() && d !== '[object Object]' && !d.includes('[object')) {
      return d.trim();
    }
  }
  const candidates = [
    r.date,
    r.bomDate,
    r.salesConfirmedAt,
    r.sales_confirmed_at,
    r.createdAt,
    r.created_at,
    r.updatedAt,
    r.updated_at
  ];
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === 'string') {
      const trimmed = c.trim();
      if (!trimmed || trimmed === '[object Object]' || trimmed.includes('[object')) continue;
      if (/^\d{2}\s+[A-Za-z]{3}\s+\d{4}$/.test(trimmed)) return trimmed;
      const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        }
      }
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    } else if (c instanceof Date && !isNaN(c.getTime())) {
      return c.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } else if (typeof c === 'object') {
      if (typeof c.date === 'string' && c.date !== '[object Object]' && !c.date.includes('[object')) {
        return formatAppliedAtDate({ date: c.date });
      }
    }
  }
  return '—';
};

export const formatBomDateDot = (raw) => {
  if (!raw) return '—';
  if (typeof raw === 'object' && raw.date) return formatBomDateDot(raw.date);
  const s = String(raw).trim();
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s;
  const ddmmyyyy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (ddmmyyyy) {
    return `${ddmmyyyy[1].padStart(2, '0')}.${ddmmyyyy[2].padStart(2, '0')}.${ddmmyyyy[3]}`;
  }
  const d = new Date(raw);
  if (isNaN(d.getTime())) return s;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
};

export const getBomActiveStage = (row) => {
  if (!row) return { name: 'Unknown', bg: '#F1F5F9', color: '#475569', border: '#CBD5E1', dot: '#94A3B8' };
  const statusStr = String(row.status || '').toLowerCase();
  const isCancelled = Boolean(row.cancelled || row.status === 'Cancelled & Stock Restored' || statusStr.includes('cancel'));
  if (isCancelled) {
    return { name: 'Cancelled', bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', dot: '#DC2626' };
  }

  const isDispatched = row.status === 'Dispatched' || row.status === 'Closed' || row.status === 'CLOSED' || statusStr.includes('dispatched') || Boolean(row.dispatchedAt || row.vehicleLoading?.loadedAt || row.fullyCompleted);
  if (isDispatched) {
    return { name: 'Dispatched', bg: '#F0FDF4', color: '#166534', border: '#BBF7D0', dot: '#16A34A' };
  }

  const isPendingInvoiceStatus = statusStr.includes('passed to invoice') || statusStr.includes('awaiting invoice') || statusStr.includes('ready for invoice') || statusStr.includes('proceed billing');
  const isInvoiceStatus = !isPendingInvoiceStatus && (
    ['Invoice Generated', 'Awaiting Vehicle Loading & Dispatch', 'Invoice Confirmed'].includes(row.status) ||
    statusStr.includes('invoice confirmed') ||
    statusStr.includes('invoice generated') ||
    statusStr.includes('invoiced') ||
    statusStr.includes('vehicle loading')
  );
  const isInvoiceGenerated = Boolean(row.invoiceGenerated || row.invoiceConfirmed) ||
    isInvoiceStatus ||
    Boolean(row.invoiceConfirmedAt || row.invoicedAt || row.stockDeductionDate);
  if (isInvoiceGenerated) {
    return { name: 'Vehicle Loading Pending', bg: '#ECFEFF', color: '#0E7490', border: '#A5F3FC', dot: '#0891B2' };
  }

  const isAccountsVerified = Boolean(row.accountsVerified || (row.isAccountsDone && (row.accountsVerification?.verified || statusStr.includes('accounts verified') || statusStr.includes('passed to invoice'))) || row.accountsVerification?.verified) ||
    ['Accounts Verified - Proceed Billing', 'Accounts Verified & Passed to Invoice'].includes(row.status) ||
    (statusStr.includes('accounts verified') && !statusStr.includes('sent to accounts')) ||
    statusStr.includes('passed to invoice') ||
    Boolean(row.accountsVerifiedAt || row.accountsVerification?.verifiedAt);
  if (isAccountsVerified) {
    return { name: 'Invoice Pending', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE', dot: '#2563EB' };
  }

  const isPackingVerified = Boolean(row.dispatchPackingVerified || row.packingVerified || row.dispatchPackingDone) ||
    (Array.isArray(row.dispatchPacking) && row.dispatchPacking.length > 0 && row.dispatchPacking.some(p => p.packed)) ||
    ['Packed & Ready for Dispatch', 'Partially Packed', 'Packed — Awaiting Sales Payment Proof', 'Packed - Awaiting Sales Payment Proof', 'Dispatch Packing Verified - Sent to Accounts'].includes(row.status) ||
    statusStr.includes('sent to accounts') ||
    statusStr.includes('packed') ||
    Boolean(row.awaitingSalesPaymentProof) ||
    Boolean(row.packingCompletedAt || row.packedAt || row.packingVerifiedAt || row.accountsVerification?.packedAt || row.packingStatus === 'PACKING_VERIFIED');
  if (isPackingVerified) {
    const payType = String(
      row.paymentTerms || 
      row.payments?.paymentType || 
      row.payments?.paymentTerms || 
      row.salesPoDetails?.paymentTerms || 
      row.paymentType || ''
    ).toLowerCase();

    const isCreditTerms = payType.includes('credit');
    const isWhileDispatch = payType.includes('while dispatch') || payType.includes('before dispatch') || payType.includes('against delivery');
    const isPartialPaidTerms = payType.includes('partial') || payType.includes('50%') || payType.includes('advance');

    const rawProofForCheck = row.paymentProofDoc ||
      row.payments?.proofDocObj ||
      row.payments?.proofDoc ||
      row.proofDoc ||
      row.salesPoDetails?.proofDocObj ||
      row.balancePaymentProofDoc ||
      row.payments?.balanceProofDocObj ||
      row.payments?.balanceProofDoc;

    const hasUploadedPaymentProof = Boolean(
      (typeof rawProofForCheck === 'string' && rawProofForCheck.trim().length > 0) ||
      (rawProofForCheck && typeof rawProofForCheck === 'object' && (rawProofForCheck.url || rawProofForCheck.dataUrl || rawProofForCheck.fileData || rawProofForCheck.storagePath || rawProofForCheck.name)) ||
      row.paymentProofDocName ||
      (Array.isArray(row.paymentProofDocs) && row.paymentProofDocs.length > 0) ||
      (Array.isArray(row.balancePaymentProofDocs) && row.balancePaymentProofDocs.length > 0) ||
      row.balancePaymentProofDoc ||
      row.payments?.balanceProofDoc ||
      row.payments?.balanceSettled ||
      row.creditSettled ||
      row.paymentSettled
    );

    const isMissingPaymentProof = !isCreditTerms && Boolean(
      row.awaitingSalesPaymentProof ||
      statusStr.includes('awaiting sales payment proof') ||
      ((isWhileDispatch || isPartialPaidTerms) && !hasUploadedPaymentProof)
    );

    const bAddr = String(row.billingAddress || row.companyBillingAddress || '').trim().toLowerCase();
    const dAddr = String(row.deliveryAddress || row.siteAddress || row.consigneeAddress || '').trim().toLowerCase();
    const isDifferentAddress = Boolean(bAddr && dAddr && bAddr !== dAddr);
    const rawAddressProof = row.addressProofDoc || row.addressDoc || row.salesPoDetails?.addressDocObj || row.deliveryAddressProofDoc;
    const hasAddressProof = Boolean(
      (typeof rawAddressProof === 'string' && rawAddressProof.trim().length > 0) ||
      (rawAddressProof && typeof rawAddressProof === 'object' && (rawAddressProof.url || rawAddressProof.dataUrl || rawAddressProof.fileData || rawAddressProof.name)) ||
      row.addressProofDocName
    );
    const isMissingAddressProof = isDifferentAddress && !hasAddressProof;

    if (isMissingPaymentProof) {
      return { 
        name: 'Payment Proof Pending (Sales)', 
        bg: '#FFFBEB', 
        color: '#B45309', 
        border: '#FDE68A', 
        dot: '#D97706',
        responsibleDept: 'Sales'
      };
    }

    if (isMissingAddressProof) {
      return { 
        name: 'Address Proof Pending (Sales)', 
        bg: '#FFF7ED', 
        color: '#C2410C', 
        border: '#FFEDD5', 
        dot: '#EA580C',
        responsibleDept: 'Sales'
      };
    }

    return { 
      name: 'Accounts Verification Pending', 
      bg: '#FAF5FF', 
      color: '#7E22CE', 
      border: '#E9D5FF', 
      dot: '#9333EA',
      responsibleDept: 'Accounts'
    };
  }

  const isSalesConfirmed = Boolean(row.salesConfirmed || row.salesReconfirmed || row.creditSettled || row.paymentSettled) ||
    ['Sales Confirmed - Sent to Dispatch', 'Sent to Production', 'Confirmed'].includes(row.status) ||
    statusStr.includes('sales confirmed') ||
    statusStr.includes('sent to dispatch') ||
    statusStr.includes('credit settled') ||
    Boolean(row.salesConfirmedAt || row.confirmedAt || row.reconfirmedAt);
  if (isSalesConfirmed) {
    return { name: 'Dispatch Packing Pending', bg: '#FFFBEB', color: '#B45309', border: '#FDE68A', dot: '#D97706' };
  }

  return { name: 'Sales Confirmation Pending', bg: '#F1F5F9', color: '#475569', border: '#CBD5E1', dot: '#64748B' };
};


export const getBomStageTiming = (b, matchingPi = null, matchingInvoice = null) => {
  if (!b) return null;

  const parseAnyDate = (val) => {
    if (!val) return { date: null, hasTime: false };
    if (typeof val === 'number') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? { date: null, hasTime: false } : { date: d, hasTime: true };
    }
    if (val instanceof Date) return isNaN(val.getTime()) ? { date: null, hasTime: false } : { date: val, hasTime: true };
    if (typeof val === 'object') return { date: null, hasTime: false };
    const str = String(val).trim();
    if (!str || str === '—' || str === '-' || str === 'null' || str === 'undefined') return { date: null, hasTime: false };

    // Check DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY (with optional comma / 'at' and time)
    const ddmmyyyy = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s*,?\s*(?:at\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1], 10);
      const month = parseInt(ddmmyyyy[2], 10) - 1;
      const year = parseInt(ddmmyyyy[3], 10);
      const hasTime = Boolean(ddmmyyyy[4]);
      let hours = ddmmyyyy[4] ? parseInt(ddmmyyyy[4], 10) : 0;
      const mins = ddmmyyyy[5] ? parseInt(ddmmyyyy[5], 10) : 0;
      const secs = ddmmyyyy[6] ? parseInt(ddmmyyyy[6], 10) : 0;
      const ampm = ddmmyyyy[7] ? ddmmyyyy[7].toUpperCase() : null;
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      return { date: new Date(year, month, day, hours, mins, secs), hasTime };
    }

    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const hasTime = str.includes('T') || str.includes(':') || /am|pm/i.test(str);
      return { date: d, hasTime };
    }
    return { date: null, hasTime: false };
  };

  const firstValidDate = (...candidates) => {
    let bestDateOnly = null;
    for (const c of candidates) {
      const parsed = parseAnyDate(c);
      if (parsed.date && !isNaN(parsed.date.getTime())) {
        if (parsed.hasTime) return parsed;
        if (!bestDateOnly) bestDateOnly = parsed;
      }
    }
    return bestDateOnly || { date: null, hasTime: false };
  };

  const formatTimeStr = (res) => {
    if (!res) return null;
    const d = res.date || (res instanceof Date ? res : null);
    if (!d || isNaN(d.getTime())) return null;
    if (res.hasTime === false) return null;
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDateStr = (res) => {
    if (!res) return null;
    const d = res.date || (res instanceof Date ? res : null);
    if (!d || isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const formatDuration = (ms) => {
    if (!ms || ms <= 0) return null;
    const totalMins = Math.round(ms / 60000);
    if (totalMins < 60) return `${totalMins}m`;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const statusLower = String(b.status || '').toLowerCase();

  // 1. Stage 1: PI Commercial
  const pPi = firstValidDate(matchingPi?.createdAt, matchingPi?.created_at, b.piCreatedAt, matchingPi?.piDate, matchingPi?.date, b.piDate, b.sourcePiDate, b.createdAt, b.created_at, b.date);
  const dPi = pPi.date;
  const hasPi = Boolean(dPi || b.sourcePiNo || b.piNo);
  const piTime = formatTimeStr(pPi) || b.piTime || matchingPi?.time || null;

  // 2. Stage 2: BOM Confirmed (locked to exact confirmed time, never changing)
  const pConfirmed = firstValidDate(b.salesConfirmedAt, b.sales_confirmed_at, b.confirmedAt, b.confirmed_at, b.reconfirmedAt, b.reconfirmed_at, b.createdAt, b.created_at, b.appliedAt, b.date);
  const dConfirmed = pConfirmed.date;
  const confirmedTime = formatTimeStr(pConfirmed) || b.confirmedTime || b.salesConfirmedTime || b.time || null;

  // 6. Stage 6: Final Dispatched (evaluate bottom-up so later completed stages imply earlier stages are done)
  const dispatchFallback = (b.fullyCompleted || statusLower.includes('dispatched')) ? (b.completedAt || b.updatedAt || b.updated_at || b.date) : null;
  const pDispatch = firstValidDate(b.dispatchedAt, b.dispatched_at, b.vehicleLoading?.loadedAt, dispatchFallback);
  const dDispatch = pDispatch.date;
  const hasDispatch = Boolean(dDispatch || b.fullyCompleted || statusLower.includes('dispatched') || statusLower === 'closed');
  const dispatchCompletedTime = formatTimeStr(pDispatch) || b.dispatchedTime || null;

  // 5. Stage 5: GST Invoiced
  const isPendingInvStatus = statusLower.includes('passed to invoice') || statusLower.includes('awaiting invoice') || statusLower.includes('ready for invoice') || statusLower.includes('proceed billing');
  const isInvDoneByStatus = !isPendingInvStatus && (
    statusLower.includes('invoice confirmed') ||
    statusLower.includes('invoice generated') ||
    statusLower.includes('invoiced') ||
    statusLower.includes('vehicle loading')
  );
  const invDateFallback = (b.invoiceConfirmed || isInvDoneByStatus || hasDispatch) ? (matchingInvoice?.date || b.date || null) : null;
  const pInvoice = firstValidDate(b.invoiceConfirmedAt, b.invoice_confirmed_at, b.invoicedAt, b.invoiced_at, b.stockDeductionDate, matchingInvoice?.confirmedAt, matchingInvoice?.stockDeductionDate, matchingInvoice?.createdAt, invDateFallback);
  const dInvoice = pInvoice.date;
  const hasInvoice = Boolean(dInvoice || b.invoiceConfirmed || (!isPendingInvStatus && b.invoiceGenerated) || isInvDoneByStatus || hasDispatch);
  const invoiceCompletedTime = formatTimeStr(pInvoice) || b.invoiceTime || null;

  // 4. Stage 4: Accounts Verification
  const accDateFallback = (b.accountsVerified || (b.isAccountsDone && (b.accountsVerification?.verified || statusLower.includes('accounts verified') || statusLower.includes('passed to invoice'))) || b.accountsVerification?.verified || hasInvoice) ? (b.date || b.createdAt || null) : null;
  const pAccounts = firstValidDate(b.accountsVerifiedAt, b.accounts_verified_at, b.accountsVerification?.verifiedAt, accDateFallback);
  const dAccounts = pAccounts.date;
  const hasAccounts = Boolean(dAccounts || b.accountsVerified || (b.isAccountsDone && (b.accountsVerification?.verified || statusLower.includes('accounts verified') || statusLower.includes('passed to invoice'))) || b.accountsVerification?.verified || hasInvoice || (statusLower.includes('accounts verified') && !statusLower.includes('sent to accounts')) || statusLower.includes('passed to invoice'));
  const accountsCompletedTime = formatTimeStr(pAccounts) || b.accountsVerifiedTime || null;

  // 3. Stage 3: Dispatch Packing
  const packDateFallback = (b.dispatchPackingVerified || b.packingVerified || b.dispatchPackingDone || b.packingStatus === 'PACKING_VERIFIED' || hasAccounts || statusLower.includes('packed')) ? (b.date || b.createdAt || null) : null;
  let pPacking = firstValidDate(b.packingCompletedAt, b.packedAt, b.packed_at, b.packingVerifiedAt, b.accountsVerification?.packedAt, packDateFallback);
  if (pPacking.date && dAccounts && pPacking.date.getTime() > dAccounts.getTime()) {
    const earlierPacking = parseAnyDate(b.accountsVerification?.packedAt || b.packingVerifiedAt);
    if (earlierPacking.date && earlierPacking.date.getTime() <= dAccounts.getTime()) {
      pPacking = earlierPacking;
    } else {
      pPacking = pAccounts;
    }
  }
  const dPacking = pPacking.date;
  const hasPacking = Boolean(dPacking || b.dispatchPackingVerified || b.packingVerified || b.dispatchPackingDone || b.packingStatus === 'PACKING_VERIFIED' || hasAccounts || statusLower.includes('packed'));
  const packingCompletedTime = formatTimeStr(pPacking) || b.packedTime || null;

  const hasConfirmed = Boolean(b.salesConfirmed || b.salesReconfirmed || hasPacking || (b.status && !statusLower.includes('draft') && !statusLower.includes('pending confirmation')));

  const isPackingActive = hasConfirmed && !hasPacking;
  const isAccountsActive = hasPacking && !hasAccounts;
  const isInvoiceActive = hasAccounts && !hasInvoice;
  const isDispatchActive = hasInvoice && !hasDispatch;

  const packingReceivedTime = confirmedTime;
  const accountsReceivedTime = packingCompletedTime || confirmedTime;
  const invoiceReceivedTime = accountsCompletedTime || packingCompletedTime || confirmedTime;
  const dispatchReceivedTime = invoiceCompletedTime || (hasInvoice ? null : (accountsCompletedTime || packingCompletedTime || confirmedTime));

  // Turnaround durations between actual completions
  const packingDuration = (dPacking && dConfirmed) ? formatDuration(dPacking.getTime() - dConfirmed.getTime()) : null;
  const accountsDuration = (dAccounts && dPacking) ? formatDuration(dAccounts.getTime() - dPacking.getTime()) : null;
  const invoiceDuration = (dInvoice && dAccounts) ? formatDuration(dInvoice.getTime() - dAccounts.getTime()) : null;
  const dispatchDuration = (dDispatch && dInvoice) ? formatDuration(dDispatch.getTime() - dInvoice.getTime()) : null;
  const totalTurnaround = (dDispatch && dConfirmed) ? formatDuration(dDispatch.getTime() - dConfirmed.getTime()) : null;

  const activeStageName = hasDispatch
    ? 'Dispatched'
    : (isDispatchActive
        ? 'Vehicle Loading Pending'
        : (isInvoiceActive
            ? 'Invoice Pending'
            : (isAccountsActive
                ? (getBomActiveStage(b).name)
                : (isPackingActive
                    ? 'Dispatch Packing Pending'
                    : 'Sales Confirmation Pending'))));

  return {
    piDate: formatDateStr(pPi),
    piTime,
    hasPi,

    confirmedDate: formatDateStr(pConfirmed),
    confirmedTime,
    hasConfirmed,

    packingDate: formatDateStr(pPacking),
    packingTime: packingCompletedTime,
    packingCompletedTime,
    packingReceivedTime,
    hasPacking,
    isPackingActive,
    packingStartedTime: packingReceivedTime,
    packingDuration,

    accountsDate: formatDateStr(pAccounts),
    accountsTime: accountsCompletedTime,
    accountsCompletedTime,
    accountsReceivedTime,
    hasAccounts,
    isAccountsActive,
    accountsStartedTime: accountsReceivedTime,
    accountsDuration,

    invoiceDate: formatDateStr(pInvoice),
    invoiceTime: invoiceCompletedTime,
    invoiceCompletedTime,
    invoiceReceivedTime,
    hasInvoice,
    isInvoiceActive,
    invoiceStartedTime: invoiceReceivedTime,
    invoiceDuration,

    dispatchDate: formatDateStr(pDispatch),
    dispatchTime: dispatchCompletedTime,
    dispatchCompletedTime,
    dispatchReceivedTime,
    hasDispatch,
    isDispatchActive,
    dispatchStartedTime: dispatchReceivedTime,
    dispatchDuration,

    totalTurnaround,
    isCompleted: hasDispatch,
    activeStageName
  };
};

// Helper to determine BOM Order lifecycle stages matching the reference stepper design in BUSINZ brand colors
export const getOrderLifecycle = (row) => {
  if (!row) return { isCancelled: false, steps: [] };
  const statusStr = String(row.status || '').toLowerCase();
  const isCancelled = Boolean(row.cancelled || row.status === 'Cancelled & Stock Restored' || statusStr.includes('cancel'));
  const isDispatched = row.status === 'Dispatched' || row.status === 'Closed' || row.status === 'CLOSED' || statusStr.includes('dispatched');
  const isPendingInvLifecycle = statusStr.includes('passed to invoice') || statusStr.includes('awaiting invoice') || statusStr.includes('ready for invoice') || statusStr.includes('proceed billing');
  const isInvoiceGenerated = isDispatched || Boolean(row.invoiceConfirmed || row.invoiceConfirmedAt || row.stockDeductionDate) || (!isPendingInvLifecycle && (Boolean(row.invoiceGenerated || (row.invoiceNo && row.invoiceNo !== 'Pending Confirmation') || row.taxInvoiceNo) || ['Invoice Generated', 'Awaiting Vehicle Loading & Dispatch', 'Invoice Confirmed'].includes(row.status) || statusStr.includes('invoice')));
  const isAccountsVerified = isInvoiceGenerated ||
    Boolean(row.accountsVerified || (row.isAccountsDone && (row.accountsVerification?.verified || statusStr.includes('accounts verified') || statusStr.includes('passed to invoice'))) || row.accountsVerification?.verified) ||
    ['Accounts Verified - Proceed Billing', 'Accounts Verified & Passed to Invoice'].includes(row.status) ||
    (statusStr.includes('accounts verified') && !statusStr.includes('sent to accounts')) ||
    statusStr.includes('passed to invoice');
  const isPackingVerified = isAccountsVerified ||
    Boolean(row.dispatchPackingVerified || row.packingVerified || row.dispatchPackingDone) ||
    (Array.isArray(row.dispatchPacking) && row.dispatchPacking.length > 0 && row.dispatchPacking.some(p => p.packed)) ||
    ['Dispatch Packing Verified - Sent to Accounts', 'Packed & Ready for Dispatch', 'Partially Packed', 'Packed — Awaiting Sales Payment Proof', 'Packed - Awaiting Sales Payment Proof'].includes(row.status) ||
    statusStr.includes('packed') ||
    statusStr.includes('sent to accounts') ||
    Boolean(row.awaitingSalesPaymentProof);
  const isSalesConfirmed = isPackingVerified ||
    Boolean(row.salesConfirmed || row.salesReconfirmed || row.creditSettled || row.paymentSettled) ||
    ['Sales Confirmed - Sent to Dispatch', 'Sent to Production', 'Confirmed'].includes(row.status) ||
    statusStr.includes('sales confirmed') ||
    statusStr.includes('sent to dispatch') ||
    statusStr.includes('credit settled');

  return {
    isCancelled,
    steps: [
      { id: 1, label: 'PI Converted', isDone: true, isActive: false, icon: FileCheck },
      { id: 2, label: 'Sales Reconfirm', isDone: isSalesConfirmed, isActive: !isSalesConfirmed && !isCancelled, icon: CheckSquare },
      { id: 3, label: 'Dispatch Packing', isDone: isPackingVerified, isActive: isSalesConfirmed && !isPackingVerified && !isCancelled, icon: PackageCheck },
      { id: 4, label: 'Accounts Verify', isDone: isAccountsVerified, isActive: isPackingVerified && !isAccountsVerified && !isCancelled, icon: CreditCard },
      { id: 5, label: 'Invoice', isDone: isInvoiceGenerated, isActive: isAccountsVerified && !isInvoiceGenerated && !isCancelled, icon: Receipt },
      { id: 6, label: 'Final Dispatch', isDone: isDispatched, isActive: isInvoiceGenerated && !isDispatched && !isCancelled, icon: Truck }
    ]
  };
};

// Stage Stopwatch & Timestamp Audit helper for CEO view
// Canonical Salesperson Code Normalizer
export const canonicalizeSalespersonCode = (rawCode, name) => {
  const c = String(rawCode || '').trim().toUpperCase();
  if (c.startsWith('TS-')) return c;
  // NEVER overwrite a valid SE-XXX employee code on a record
  if (/^SE-\d{3,4}$/.test(c)) return c;
  const lowerName = String(name || '').toLowerCase().trim();

  // Dynamic lookup from live Employee Directory only when rawCode is missing or legacy
  try {
    const empsList = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
    const empsStore = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
    const allEmps = [...(Array.isArray(empsList) ? empsList : []), ...(Array.isArray(empsStore) ? empsStore : [])].filter(Boolean);
    if (lowerName) {
      const byNameOrEmail = allEmps.find(e => {
        const eName = String(e.employee_name || e.name || '').replace(/\s*\([^)]*\)/g, '').toLowerCase().trim();
        const eEmail = String(e.email || '').toLowerCase().trim();
        return (eName && (eName === lowerName || eName.includes(lowerName) || lowerName.includes(eName))) || (eEmail && eEmail === lowerName);
      });
      if (byNameOrEmail) {
        const empCode = String(byNameOrEmail.employee_code || byNameOrEmail.code || byNameOrEmail.id || '').trim().toUpperCase();
        if (empCode) return empCode;
      }
    }
  } catch (_) {}

  if (c === 'SE-015' || (c === 'SE-VRM002' && lowerName.includes('mohith'))) return 'SE-004';
  if (c === 'SH-001' || c === 'SH-VRM001') return 'SE-001';
  if (c === 'SE-020') return 'SE-006';
  if (c === 'SE-010') return 'SE-008';
  if (c === 'SE-VRM090') return 'SE-009';
  if (EMAIL_TO_SALES_CODE[lowerName]) return EMAIL_TO_SALES_CODE[lowerName];
  if (c === 'SE-VRM006') return 'SE-003';
  return c || '';
};

// Canonical Salesperson Code to Name mapping
export const CODE_TO_SALES_NAME = {
  'SE-001': 'Manojraj Selvaraj',
  'SH-001': 'Manojraj Selvaraj',
  'SH-VRM001': 'Manojraj Selvaraj',
  'SE-002': 'Sanjai kumar',
  'SE-VRM002': 'Sanjai kumar',
  'SE-003': 'Vasanth Kumar S',
  'SE-VRM006': 'Vasanth Kumar S',
  'SE-004': 'Mohith JV',
  'SE-015': 'Mohith JV',
  'SE-VRM004': 'Mohith JV',
  'SE-005': 'Shanthi',
  'SE-006': 'Dhana Sekar',
  'SE-020': 'Dhana Sekar',
  'SE-007': 'PRASHANTH',
  'SE-008': 'Pavithra',
  'SE-010': 'Pavithra',
  'SE-009': 'Jawahar',
  'SE-VRM090': 'Jawahar',
  'SE-VRM005': 'Kalai selvi',
  'SE-1000': 'Annamalaiyar'
};

// Canonical Salesperson Email to Display Name mapping
export const EMAIL_TO_SALES_NAME = {
  'sales.s1@vrmstructures.in': 'Manojraj Selvaraj',
  'sales.s2@vrmstructures.in': 'PRASHANTH',
  'sales.s3@vrmstructures.in': 'Shanthi',
  'sales.s4@vrmstructures.in': 'Mohith JV',
  'sanjaikumar3a@gmail.com': 'Sanjai kumar',
  'sanjay@vrmstructures.in': 'Sanjai kumar',
  'dhanasekar@gmail.com': 'Dhana Sekar',
  'projectsales@jashsun.com': 'Pavithra',
  'velmuruganr@vrmstructures.in': 'Pavithra',
  'mms@vrmstructures.in': 'Kalai selvi',
  'jawahar@vrmstructures.in': 'Jawahar',
  'kalpanaram17@vrmstructures.in': 'KalpanaRam',
  'vasanth.support@vrmstructures.in': 'Vasanth',
  'scm@vrmstructures.in': 'ARUN BOOPATHI M',
  'arun@vrmstructures.in': 'ARUN BOOPATHI M',
  'production@vrm.com': 'Senthil Kumar',
  'dispatch@vrmstructures.in': 'Kalpana',
  'dispatchhead@gmail.com': 'Kalpana',
  'arannamalaiyar@gmail.com': 'Annamalaiyar',
  'admin@businz.com': 'Admin User',
  'bi@gmail.com': 'Billing',
  'keerthana@vrmstructures.in': 'Keerthana'
};

// Canonical Salesperson Email to Employee Code mapping
export const EMAIL_TO_SALES_CODE = {
  'sales.s1@vrmstructures.in': 'SE-001',
  'sales.s2@vrmstructures.in': 'SE-007',
  'sales.s3@vrmstructures.in': 'SE-005',
  'sales.s4@vrmstructures.in': 'SE-004',
  'sanjaikumar3a@gmail.com': 'SE-002',
  'sanjay@vrmstructures.in': 'SE-002',
  'vasanthkumarsaravanan.work@gmail.com': 'SE-003',
  'vasanthkumar1234@gmail.com': 'SE-003',
  'dhanasekar@gmail.com': 'SE-006',
  'projectsales@jashsun.com': 'SE-008',
  'velmuruganr@vrmstructures.in': 'SE-008',
  'mms@vrmstructures.in': 'SE-009',
  'kalpanaram17@vrmstructures.in': 'TS-001',
  'vasanth.support@vrmstructures.in': 'TS-002',
  'scm@vrmstructures.in': 'PR-001',
  'arun@vrmstructures.in': 'PR-001',
  'production@vrm.com': 'PH-001',
  'dispatch@vrmstructures.in': 'DH-001',
  'dispatchhead@gmail.com': 'DH-001',
  'arannamalaiyar@gmail.com': 'TA-001'
};

// Helper to resolve salesperson actual human name rather than role title or raw email
export const getCleanSalesPersonName = (rawName, code) => {
  let name = String(rawName || '').replace(/\s*\([^)]*\)/g, '').trim();
  const cleanCode = String(code || '').trim().toUpperCase();

  const nonSalesPersons = [
    'kalpanaram', 'kalpana', 'tech support', 'ts-001', 'ts-002',
    'dispatch', 'dispatch head', 'dh-vrm001', 'dh-001', 'admin',
    'sales executive', 'sales', 'sales department', 'salesperson', 'sales person', 'sales rep',
    'se', 'sls', 'user', 'undefined', 'null', 'direct / admin'
  ];

  if (name.includes('@')) {
    const emailLower = name.toLowerCase();
    if (EMAIL_TO_SALES_NAME[emailLower]) return EMAIL_TO_SALES_NAME[emailLower];
    if (emailLower.includes('sales.s4')) return 'Mohith JV';
    if (emailLower.includes('sales.s1')) return 'Manojraj Selvaraj';
    if (emailLower.includes('sales.s2')) return 'PRASHANTH';
    if (emailLower.includes('sales.s3')) return 'Shanthi';
  }

  if (name.toLowerCase() === 'annamalai' || name.toLowerCase() === 'ar.annamalaiyar' || name.toLowerCase() === 'ar annamalaiyar') {
    return 'Annamalaiyar';
  }

  // Prioritize live Employee Directory lookup before static fallbacks
  try {
    const emps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
    if (cleanCode) {
      const foundByCode = emps.find(e => {
        const c = String(e.employee_code || e.code || e.id || '').trim().toUpperCase();
        return c === cleanCode;
      });
      if (foundByCode && (foundByCode.employee_name || foundByCode.name)) {
        return foundByCode.employee_name || foundByCode.name;
      }
    }
    if (name && name.includes('@')) {
      const foundByEmail = emps.find(e => (e.email || '').toLowerCase().trim() === name.toLowerCase());
      if (foundByEmail && (foundByEmail.employee_name || foundByEmail.name)) {
        return foundByEmail.employee_name || foundByEmail.name;
      }
    }
  } catch (_) {}

  // Authoritative code-to-name mapping (prevents stale row.salesPerson strings from showing wrong person for SE-XXX)
  if (cleanCode && CODE_TO_SALES_NAME[cleanCode]) {
    return CODE_TO_SALES_NAME[cleanCode];
  }

  if (cleanCode === 'SE-015' || (!name && cleanCode === 'SE-004') || String(rawName || '').includes('SE-015')) return 'Mohith JV';
  if (cleanCode === 'SH-001' || cleanCode === 'SH-VRM001') return 'Manojraj Selvaraj';
  if (cleanCode === 'SE-002' || cleanCode === 'SE-VRM002') return 'Sanjai kumar';
  if (cleanCode === 'SE-020') return 'Dhana Sekar';
  if (cleanCode === 'SE-010') return 'Pavithra';
  if (cleanCode === 'SE-VRM090') return 'Jawahar';

  if (!name || name.includes('@') || nonSalesPersons.includes(name.toLowerCase())) {
    try {
      const emps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
      if (cleanCode) {
        const found = emps.find(e => {
          const c = String(e.employee_code || e.code || e.id || '').trim().toUpperCase();
          return c === cleanCode;
        });
        if (found && (found.employee_name || found.name)) return found.employee_name || found.name;
      }
      if (name.includes('@')) {
        const found = emps.find(e => (e.email || '').toLowerCase().trim() === name.toLowerCase());
        if (found && (found.employee_name || found.name)) return found.employee_name || found.name;
      }
      const salesEmp = emps.find(e => (e.role || '').toLowerCase().includes('sale'));
      if (salesEmp && (salesEmp.employee_name || salesEmp.name)) return salesEmp.employee_name || salesEmp.name;
    } catch (_) {}

    const storedName = (localStorage.getItem('controlroom_logged_user_name') || localStorage.getItem('controlroom_logged_emp_name') || '').trim();
    if (storedName && !storedName.includes('@') && !nonSalesPersons.includes(storedName.toLowerCase())) {
      return storedName;
    }
    return 'Annamalaiyar';
  }

  // Final check: if name still contains '@', derive human name
  if (name.includes('@')) {
    const prefix = name.split('@')[0].toLowerCase();
    if (prefix.includes('sales.s4')) return 'Mohith JV';
    if (prefix.includes('sales.s1')) return 'Manojraj Selvaraj';
    if (prefix.includes('sales.s2')) return 'PRASHANTH';
    if (prefix.includes('sales.s3')) return 'Shanthi';
    if (prefix.includes('mohith')) return 'Mohith JV';
    if (prefix.includes('manoj')) return 'Manojraj Selvaraj';
    if (prefix.includes('sanjai') || prefix.includes('sanjay')) return 'Sanjai kumar';
    if (prefix.includes('vasanth')) return 'Vasanth Kumar S';
    if (prefix.includes('dhana')) return 'Dhana Sekar';
    if (prefix.includes('pavithra')) return 'Pavithra';
    if (prefix.includes('kalai')) return 'KALAISELVI T';
    return 'Sales Department';
  }

  return name;
};

// Safe localStorage saver that catches QuotaExceededError and trims cache to top 50 recent records per Rule 5
export const safeSaveBomStoreToLocal = (list) => {
  try {
    const sanitized = (Array.isArray(list) ? list : []).map(stripDataUrlsFromRecord);
    try {
      localStorage.setItem('controlroom_bom_store', JSON.stringify(sanitized));
    } catch (quotaErr) {
      console.warn('[LocalStorage Quota Exceeded] Trimming local BOM cache to recent 50 records.');
      const trimmed = sanitized.slice(0, 50);
      try {
        localStorage.setItem('controlroom_bom_store', JSON.stringify(trimmed));
      } catch (_) {}
    }
  } catch (err) {
    console.warn('[safeSaveBomStoreToLocal error]:', err);
  }
};

// Self-healing sanitizer for BOM records (ensures credit-settled orders stay in their true lifecycle stage)
export const sanitizeBomRecord = (b) => {
  if (!b) return b;
  if (b.status === 'Credit Settled (100% Paid)') {
    let trueStatus = 'Accounts Verified & Passed to Invoice';
    if (b.invoiceGenerated || (b.invoiceNo && b.invoiceNo !== 'Pending Confirmation') || b.taxInvoiceNo) {
      trueStatus = 'Invoice Generated';
    } else if (b.accountsVerified || b.isAccountsDone || b.accountsVerification?.verified) {
      trueStatus = 'Accounts Verified & Passed to Invoice';
    } else if (b.dispatchPackingVerified || (Array.isArray(b.dispatchPacking) && b.dispatchPacking.length > 0)) {
      trueStatus = 'Dispatch Packing Verified - Sent to Accounts';
    } else if (b.salesConfirmed) {
      trueStatus = 'Sales Confirmed - Sent to Dispatch';
    }
    return {
      ...b,
      status: trueStatus,
      paymentStatus: 'Credit Settled (100% Paid)',
      creditSettled: true,
      salesConfirmed: true,
      dispatchPackingVerified: Boolean(b.dispatchPackingVerified || (Array.isArray(b.dispatchPacking) && b.dispatchPacking.length > 0) || trueStatus === 'Accounts Verified & Passed to Invoice'),
      accountsVerified: Boolean(b.accountsVerified || b.isAccountsDone || b.accountsVerification?.verified || trueStatus === 'Accounts Verified & Passed to Invoice'),
      isAccountsDone: Boolean(b.isAccountsDone || b.accountsVerification?.verified || trueStatus === 'Accounts Verified & Passed to Invoice')
    };
  }
  return b;
};

/** Returns true when a non-cancelled BOM uses a different delivery address without an attached address proof doc. */
export const isBomAddressProofPending = (bom) => {
  if (!bom || typeof bom !== 'object') return false;
  const st = String(bom.status || '').toLowerCase();
  if (bom.cancelled || bom.status === 'Cancelled & Stock Restored' || st.includes('cancel')) return false;
  if (bom.processedWithoutAddressProof || bom.addressProofWaived) return false;
  if (bom.sameAsBilling === true) return false;

  const bObj = bom.billingAddressObj || {};
  const dObj = bom.deliveryAddressObj || {};
  const bStreet = String(bObj.address || bObj.street || '').trim().toLowerCase();
  const dStreet = String(dObj.address || dObj.street || '').trim().toLowerCase();
  const bCity = String(bObj.city || '').trim().toLowerCase();
  const dCity = String(dObj.city || '').trim().toLowerCase();
  const bState = String(bObj.state || '').trim().toLowerCase();
  const dState = String(dObj.state || '').trim().toLowerCase();
  const bPin = String(bObj.pincode || '').trim().toLowerCase();
  const dPin = String(dObj.pincode || '').trim().toLowerCase();

  const hasDObjFields = Boolean(dStreet || dCity || dState || dPin);
  const bStr = String(bom.billingAddress || '').trim().toLowerCase();
  const dStr = String(bom.deliveryAddress || '').trim().toLowerCase();

  let isDifferentAddress = false;
  if (hasDObjFields) {
    isDifferentAddress = !(dStreet === bStreet && dCity === bCity && dState === bState && dPin === bPin);
  } else if (dStr) {
    isDifferentAddress = dStr !== bStr;
  } else if (bom.sameAsBilling === false) {
    isDifferentAddress = true;
  }

  if (!isDifferentAddress) return false;

  const proofDoc = bom.deliveryAddressProofDoc || bom.addressProofDoc || null;
  if (!proofDoc) return true;
  if (typeof proofDoc === 'string') return proofDoc.trim().length === 0;
  if (typeof proofDoc === 'object') {
    return !(
      proofDoc.name ||
      proofDoc.originalName ||
      proofDoc.url ||
      proofDoc.dataUrl ||
      proofDoc.fileData ||
      proofDoc.storagePath
    );
  }
  return false;
};
