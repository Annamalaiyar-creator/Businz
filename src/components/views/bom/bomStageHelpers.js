import {
  Check, Truck, CreditCard, FileCheck, CheckSquare, PackageCheck, Receipt
} from 'lucide-react';
import { stripDataUrlsFromRecord } from '../../../utils/otherViewsShared';

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

  const isInvoiceGenerated = Boolean(row.invoiceGenerated || (row.invoiceNo && row.invoiceNo !== 'Pending Confirmation') || row.taxInvoiceNo || row.invoiceConfirmed) ||
    ['Invoice Generated', 'Awaiting Vehicle Loading & Dispatch', 'Invoice Confirmed'].includes(row.status) ||
    statusStr.includes('invoice') ||
    Boolean(row.invoiceConfirmedAt || row.invoicedAt || row.stockDeductionDate);
  if (isInvoiceGenerated) {
    return { name: 'Vehicle Loading Pending', bg: '#ECFEFF', color: '#0E7490', border: '#A5F3FC', dot: '#0891B2' };
  }

  const isAccountsVerified = Boolean(row.accountsVerified || row.isAccountsDone || row.accountsVerification?.verified) ||
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
    return { name: 'Accounts Verification Pending', bg: '#FAF5FF', color: '#7E22CE', border: '#E9D5FF', dot: '#9333EA' };
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


export const getBomStageTiming = (b, matchingPi = null) => {
  if (!b) return null;

  const parseAnyDate = (val) => {
    if (!val) return { date: null, hasTime: false };
    if (typeof val === 'number') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? { date: null, hasTime: false } : { date: d, hasTime: true };
    }
    if (val instanceof Date) return isNaN(val.getTime()) ? { date: null, hasTime: false } : { date: val, hasTime: true };
    const str = String(val).trim();
    if (!str || str === '—' || str === '-') return { date: null, hasTime: false };

    // Check DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY (with optional time)
    const ddmmyyyy = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
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

  // 1. Stage 1: PI Commercial
  const rawPi = matchingPi?.createdAt || matchingPi?.piDate || matchingPi?.date || b.piDate || b.sourcePiDate || b.createdAt;
  const pPi = parseAnyDate(rawPi);
  const dPi = pPi.date;
  const hasPi = Boolean(dPi || b.sourcePiNo || b.piNo);
  const piTime = formatTimeStr(pPi) || b.piTime || matchingPi?.time || null;

  // 2. Stage 2: BOM Confirmed (locked to exact confirmed time, never changing)
  const rawConfirmed = b.salesConfirmedAt || b.confirmedAt || b.reconfirmedAt || b.createdAt || b.appliedAt || b.date;
  const pConfirmed = parseAnyDate(rawConfirmed);
  const dConfirmed = pConfirmed.date;
  const hasConfirmed = Boolean(b.salesConfirmed || (b.status && b.status !== 'Draft' && !String(b.status).toLowerCase().includes('draft')));
  const confirmedTime = formatTimeStr(pConfirmed) || b.confirmedTime || b.salesConfirmedTime || b.time || null;

  // 3. Stage 3: Dispatch Packing
  const rawPacking = b.packingCompletedAt || b.packedAt || b.packingVerifiedAt || b.accountsVerification?.packedAt || (b.packingStatus === 'PACKING_VERIFIED' ? (b.updatedAt || b.date) : null);
  const pPacking = parseAnyDate(rawPacking);
  const dPacking = pPacking.date;
  const hasPacking = Boolean(dPacking || b.packingStatus === 'PACKING_VERIFIED');
  const isPackingActive = hasConfirmed && !hasPacking;
  const packingCompletedTime = formatTimeStr(pPacking) || b.packedTime || null;
  const packingReceivedTime = confirmedTime;

  // 4. Stage 4: Accounts Verification
  const rawAccounts = b.accountsVerifiedAt || b.accountsVerification?.verifiedAt || (b.isAccountsDone ? (b.updatedAt || b.date) : null);
  const pAccounts = parseAnyDate(rawAccounts);
  const dAccounts = pAccounts.date;
  const hasAccounts = Boolean(dAccounts || b.isAccountsDone || b.accountsVerification?.verified);
  const isAccountsActive = hasPacking && !hasAccounts;
  const accountsCompletedTime = formatTimeStr(pAccounts) || b.accountsVerifiedTime || null;
  const accountsReceivedTime = packingCompletedTime || confirmedTime;

  // 5. Stage 5: GST Invoiced
  const rawInvoice = b.invoiceConfirmedAt || b.invoicedAt || b.stockDeductionDate || (b.invoiceConfirmed ? (b.updatedAt || b.date) : null);
  const pInvoice = parseAnyDate(rawInvoice);
  const dInvoice = pInvoice.date;
  const hasInvoice = Boolean(dInvoice || b.invoiceConfirmed);
  const isInvoiceActive = hasAccounts && !hasInvoice;
  const invoiceCompletedTime = formatTimeStr(pInvoice) || b.invoiceTime || null;
  const invoiceReceivedTime = accountsCompletedTime || packingCompletedTime || confirmedTime;

  // 6. Stage 6: Final Dispatched
  const rawDispatch = b.dispatchedAt || b.vehicleLoading?.loadedAt || (b.fullyCompleted ? (b.updatedAt || b.date) : null);
  const pDispatch = parseAnyDate(rawDispatch);
  const dDispatch = pDispatch.date;
  const hasDispatch = Boolean(dDispatch || b.fullyCompleted);
  const isDispatchActive = hasInvoice && !hasDispatch;
  const dispatchCompletedTime = formatTimeStr(pDispatch) || b.dispatchedTime || null;
  const dispatchReceivedTime = invoiceCompletedTime || accountsCompletedTime || packingCompletedTime || confirmedTime;

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
                ? 'Accounts Verification Pending'
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
  const isInvoiceGenerated = isDispatched || Boolean(row.invoiceGenerated || (row.invoiceNo && row.invoiceNo !== 'Pending Confirmation') || row.taxInvoiceNo) || ['Invoice Generated', 'Awaiting Vehicle Loading & Dispatch', 'Invoice Confirmed'].includes(row.status) || statusStr.includes('invoice');
  const isAccountsVerified = isInvoiceGenerated ||
    Boolean(row.accountsVerified || row.isAccountsDone || row.accountsVerification?.verified) ||
    ['Dispatch Packing Verified - Sent to Accounts', 'Accounts Verified - Proceed Billing', 'Accounts Verified & Passed to Invoice'].includes(row.status) ||
    statusStr.includes('accounts verified') ||
    statusStr.includes('passed to invoice');
  const isPackingVerified = isAccountsVerified ||
    Boolean(row.dispatchPackingVerified || row.packingVerified || row.dispatchPackingDone) ||
    (Array.isArray(row.dispatchPacking) && row.dispatchPacking.length > 0 && row.dispatchPacking.some(p => p.packed)) ||
    ['Packed & Ready for Dispatch', 'Partially Packed', 'Packed — Awaiting Sales Payment Proof', 'Packed - Awaiting Sales Payment Proof'].includes(row.status) ||
    statusStr.includes('packed') ||
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
// Canonical Salesperson Code Normalizer  // Canonical Salesperson Code Normalizer
export const canonicalizeSalespersonCode = (rawCode, name) => {
  const c = String(rawCode || '').trim().toUpperCase();
  if (c.startsWith('TS-')) return c;
  if (c === 'SE-015' || (c === 'SE-VRM002' && String(name || '').toLowerCase().includes('mohith'))) return 'SE-004';
  if (c === 'SH-001' || c === 'SH-VRM001') return 'SE-001';
  if (c === 'SE-020') return 'SE-006';
  if (c === 'SE-010') return 'SE-008';
  if (c === 'SE-VRM090') return 'SE-009';
  if (String(name || '').toLowerCase().includes('mohith')) return 'SE-004';
  if (String(name || '').toLowerCase().includes('sanjai') || String(name || '').toLowerCase().includes('sanjay')) return 'SE-002';
  if (String(name || '').toLowerCase().includes('manoj')) return 'SE-001';
  const lowerName = String(name || '').toLowerCase();
  if (lowerName.includes('kumar') && lowerName.includes('vasanth')) return 'SE-003';
  if (c === 'SE-003' || c === 'SE-VRM006') return 'SE-003';
  if (c === 'SE-004' || c === 'SE-015') return 'SE-004';
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
  'SE-009': 'KALAISELVI T',
  'SE-VRM090': 'KALAISELVI T',
  'SE-VRM005': 'KALAISELVI T',
  'SE-1000': 'Annamalaiyar'
};

// Helper to resolve salesperson actual human name rather than role title
export const getCleanSalesPersonName = (rawName, code) => {
  let name = String(rawName || '').replace(/\s*\([^)]*\)/g, '').trim();
  const cleanCode = String(code || '').trim().toUpperCase();

  const nonSalesPersons = [
    'kalpanaram', 'kalpana', 'tech support', 'ts-001', 'ts-002',
    'dispatch', 'dispatch head', 'dh-vrm001', 'dh-001', 'admin',
    'sales executive', 'sales', 'sales department', 'salesperson', 'sales person', 'sales rep',
    'se', 'sls', 'user', 'undefined', 'null', 'direct / admin'
  ];

  if (name.toLowerCase() === 'annamalai' || name.toLowerCase() === 'ar.annamalaiyar' || name.toLowerCase() === 'ar annamalaiyar') {
    return 'Annamalaiyar';
  }

  // If a sales code is provided that maps to a real sales executive,
  // and the record creator name is a non-sales user (e.g. KalpanaRam/Tech Support/Dispatch/Admin) or generic,
  // the true salesperson is the assigned sales executive!
  if (cleanCode && CODE_TO_SALES_NAME[cleanCode]) {
    if (!name || nonSalesPersons.includes(name.toLowerCase())) {
      return CODE_TO_SALES_NAME[cleanCode];
    }
  }

  if (cleanCode === 'SE-015' || (!name && cleanCode === 'SE-004') || String(rawName || '').includes('SE-015')) return 'Mohith JV';
  if (cleanCode === 'SH-001' || cleanCode === 'SH-VRM001') return 'Manojraj Selvaraj';
  if (cleanCode === 'SE-002' || cleanCode === 'SE-VRM002') return 'Sanjai kumar';
  if (cleanCode === 'SE-020') return 'Dhana Sekar';
  if (cleanCode === 'SE-010') return 'Pavithra';
  if (cleanCode === 'SE-VRM090') return 'KALAISELVI T';

  if (!name || nonSalesPersons.includes(name.toLowerCase())) {
    try {
      const emps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
      if (cleanCode) {
        const found = emps.find(e => {
          const c = String(e.employee_code || e.code || e.id || '').trim().toUpperCase();
          return c === cleanCode;
        });
        if (found && (found.employee_name || found.name)) return found.employee_name || found.name;
      }
      const salesEmp = emps.find(e => (e.role || '').toLowerCase().includes('sale'));
      if (salesEmp && (salesEmp.employee_name || salesEmp.name)) return salesEmp.employee_name || salesEmp.name;
    } catch (_) {}

    const storedName = (localStorage.getItem('controlroom_logged_user_name') || localStorage.getItem('controlroom_logged_emp_name') || '').trim();
    if (storedName && !nonSalesPersons.includes(storedName.toLowerCase())) {
      return storedName;
    }
    return 'Annamalaiyar';
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
