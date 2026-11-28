import React, { useMemo, useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { getBomActiveStage, isBomAddressProofPending } from './bom/bomStageHelpers.js';
import CeoKpiGrid from '../ceoDashboard/CeoKpiGrid';
import { triggerCeoDrilldown } from '../../utils/ceoDrilldownFilter';

const parseDateMs = (d) => {
  if (!d) return null;
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d.getTime();
  const s = String(d).trim();
  if (!s || s === '—' || s === '-') return null;
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) return parsed;
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    const day = Number(m[1]);
    const mon = Number(m[2]) - 1;
    const yr = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    const dt = new Date(yr, mon, day);
    return isNaN(dt.getTime()) ? null : dt.getTime();
  }
  return null;
};

const startOfDayMs = (ts) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const formatShortDate = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const formatDateTime = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  const datePart = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  return `${datePart}, ${timePart}`;
};

const STATUS_BADGE = {
  Overdue: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
  Pending: { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
  'On time': { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
  'Dispatched late': { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' }
};

/**
 * Resolves the sequential dispatch blocker for the CEO Dispatch table:
 * - Packed & sent to accounts: check payment proof first; if missing, show "Payment Proof is pending" instead of "Accounts Verification Pending".
 * - Accounts verified: check if delivery address differs without proof; if missing, show "Address Proof is pending" instead of "Invoice Pending".
 */
const resolveDispatchBlocker = (b, stage) => {
  const stageName = String(stage?.name || '');
  const isPackedSentToAccounts =
    stageName === 'Accounts Verification Pending' ||
    stageName === 'Payment Proof Pending (Sales)' ||
    stageName === 'Address Proof Pending (Sales)';

  if (isPackedSentToAccounts) {
    const payType = String(
      b.paymentType ||
      b.paymentTerms ||
      b.payments?.paymentType ||
      b.payments?.paymentTerms ||
      b.salesPoDetails?.paymentTerms || ''
    ).toLowerCase();
    const isCreditTerms = payType.includes('credit') || payType.includes('net ') || payType.includes('net30') || Number(b.creditDays || 0) > 0;
    const isPartialPaidTerms = !isCreditTerms && (payType.includes('partial') || (payType.includes('50%') && !payType.includes('100%')));

    const rawProof =
      b.paymentProofDoc ||
      b.payments?.proofDocObj ||
      b.payments?.proofDoc ||
      b.proofDoc ||
      b.proofDocData ||
      b.salesPoDetails?.proofDocObj;
    const hasDocInList = Array.isArray(b.uploadedDocuments) && b.uploadedDocuments.some((d) =>
      String(d?.category || '').toLowerCase().includes('payment') ||
      String(d?.type || '').toLowerCase().includes('payment')
    );
    const hasPaymentProof = Boolean(
      (typeof rawProof === 'string' && rawProof.trim().length > 0) ||
      (rawProof && typeof rawProof === 'object' && (rawProof.url || rawProof.dataUrl || rawProof.fileData || rawProof.storagePath || rawProof.name)) ||
      b.paymentProofDocName ||
      b.paymentProofAttached ||
      b.hasPaymentProof ||
      hasDocInList ||
      (Array.isArray(b.paymentProofDocs) && b.paymentProofDocs.length > 0) ||
      b.creditSettled ||
      b.paymentSettled ||
      b.accountsVerification?.creditSettled
    );
    const hasBalanceProof = Boolean(
      b.balancePaymentProofDoc ||
      b.balanceProofDoc ||
      (Array.isArray(b.balancePaymentProofDocs) && b.balancePaymentProofDocs.length > 0) ||
      b.payments?.balanceProofDocObj ||
      b.payments?.balanceProofDoc ||
      b.payments?.balanceUploaded ||
      b.payments?.balanceSettled ||
      b.payments?.dispatch50Uploaded ||
      b.paymentProofAttached ||
      b.creditSettled ||
      b.paymentSettled ||
      b.accountsVerification?.creditSettled ||
      b.accountsVerification?.paymentStatus === 'Payment Proof Attached' ||
      b.accountsVerification?.paymentStatus === 'Payment Proof Attached by Sales' ||
      (b.balanceAmount !== undefined && b.balanceAmount !== null && Number(b.balanceAmount) <= 0 && Number(b.partialAmount) > 0 && hasPaymentProof)
    );

    if (!isCreditTerms && (isPartialPaidTerms ? !hasBalanceProof : !hasPaymentProof)) {
      return 'Payment Proof is pending';
    }
    return 'Accounts Verification Pending';
  }

  if (stageName === 'Invoice Pending') {
    return isBomAddressProofPending(b) ? 'Address Proof is pending' : 'Invoice Pending';
  }

  return stageName || 'Pending';
};

const BusinzSectionCard = ({ title, subtitle, rightNode, children }) => (
  <div style={{
    backgroundColor: '#F8FAFC',
    border: '1px solid #EAEFEF',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
      padding: '12px 18px', backgroundColor: '#FFFFFF', borderBottom: '1px solid #EAEFEF'
    }}>
      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.2px' }}>{title}</h3>
      {rightNode || (subtitle && (
        <span style={{
          fontSize: '11px', fontWeight: '700', color: '#475569',
          backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0',
          padding: '3px 10px', borderRadius: '999px'
        }}>
          {subtitle}
        </span>
      ))}
    </div>
    <div style={{ padding: '14px' }}>
      {children}
    </div>
  </div>
);

export default function CeoDispatchAnalyticsSection({
  bomList = [],
  allBomList = [],
  dispatchesList = [],
  selectedPeriod = 'This Month',
  onOpenBom,
  onNavigateTab
}) {
  const [activeFilter, setActiveFilter] = useState('today_overdue');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const analytics = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDayMs(now.getTime());
    const todayEnd = todayStart + 86400000 - 1;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

    const sourceBoms = (allBomList && allBomList.length > 0) ? allBomList : (bomList || []);
    const periodBoms = (bomList && bomList.length > 0) ? bomList : [];

    const normalizeOrder = (b, idx) => {
      const code = String(b.bomCode || b.code || b.id || `BOM-${idx + 1}`).trim();
      const customer = String(b.companyName || b.customerName || b.vendor || 'Customer').trim();
      const stage = getBomActiveStage(b);
      const stLower = String(b.status || '').toLowerCase();
      const isCancelled = Boolean(b.cancelled || stLower.includes('cancel'));
      const isDispatched = Boolean(
        stage.name === 'Dispatched' ||
        b.dispatchedAt ||
        b.vehicleLoading?.loadedAt ||
        b.fullyCompleted ||
        stLower === 'completed' ||
        stLower === 'closed' ||
        stLower.includes('dispatched')
      );

      const promisedTs = parseDateMs(b.deliveryDate || b.promisedDispatchDate || b.expectedDeliveryDate || b.date || b.createdAt);
      const promisedDayStart = promisedTs ? startOfDayMs(promisedTs) : null;
      const actualTs = isDispatched
        ? parseDateMs(b.dispatchedAt || b.vehicleLoading?.loadedAt || b.updatedAt || b.date)
        : null;
      const actualDayStart = actualTs ? startOfDayMs(actualTs) : null;

      let dispatchStatus = 'Pending';
      let delayDays = 0;

      if (isDispatched) {
        if (promisedDayStart && actualDayStart && actualDayStart > promisedDayStart) {
          dispatchStatus = 'Dispatched late';
          delayDays = Math.max(1, Math.round((actualDayStart - promisedDayStart) / 86400000));
        } else {
          dispatchStatus = 'On time';
        }
      } else if (promisedDayStart && promisedDayStart < todayStart) {
        dispatchStatus = 'Overdue';
        delayDays = Math.max(1, Math.round((todayStart - promisedDayStart) / 86400000));
      } else {
        dispatchStatus = 'Pending';
      }

      const reason = b.delayReason || b.blockerReason || (
        isDispatched
          ? (dispatchStatus === 'Dispatched late' ? (b.remarks || 'Dispatched past promised date') : '—')
          : resolveDispatchBlocker(b, stage)
      );

      const isDueToday = Boolean(promisedDayStart && promisedDayStart === todayStart);
      const isDispatchedToday = Boolean(isDispatched && actualTs && actualTs >= todayStart && actualTs <= todayEnd);
      const isOverdueNow = Boolean(!isDispatched && !isCancelled && promisedDayStart && promisedDayStart < todayStart);

      return {
        raw: b,
        code,
        customer,
        promisedTs,
        promisedDayStart,
        actualTs,
        dispatchStatus,
        delayDays,
        reason,
        isCancelled,
        isDispatched,
        isDueToday,
        isDispatchedToday,
        isOverdueNow
      };
    };

    const allOrders = sourceBoms.filter(Boolean).map(normalizeOrder).filter(o => !o.isCancelled);
    const periodOrders = periodBoms.filter(Boolean).map(normalizeOrder).filter(o => !o.isCancelled);

    const pendingTodayList = allOrders.filter(o => !o.isDispatched && o.isDueToday);
    const dispatchedTodayList = allOrders.filter(o => o.isDispatchedToday);
    const overdueNowList = allOrders.filter(o => o.isOverdueNow);

    // Month / Period metrics
    const dueInPeriodList = periodOrders.length > 0
      ? periodOrders
      : allOrders.filter(o => o.promisedTs && o.promisedTs >= monthStart && o.promisedTs <= monthEnd);
    const dispatchedPeriodList = dueInPeriodList.filter(o => o.isDispatched);
    const pendingPeriodList = dueInPeriodList.filter(o => !o.isDispatched);
    const overdueInPeriodCount = pendingPeriodList.filter(o => o.isOverdueNow).length;

    const onTimePeriodList = dispatchedPeriodList.filter(o => o.dispatchStatus === 'On time');
    const latePeriodList = dispatchedPeriodList.filter(o => o.dispatchStatus === 'Dispatched late');
    const onTimePct = dispatchedPeriodList.length > 0
      ? ((onTimePeriodList.length / dispatchedPeriodList.length) * 100).toFixed(1)
      : '0.0';

    // Weekly breakdown (1-7, 8-14, 15-21, 22-end of current month)
    const monthShort = now.toLocaleDateString('en-GB', { month: 'short' });
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const weekBuckets = [
      { label: `1–7 ${monthShort}`, start: 1, end: 7 },
      { label: `8–14 ${monthShort}`, start: 8, end: 14 },
      { label: `15–21 ${monthShort}`, start: 15, end: 21 },
      { label: `22–${Math.min(now.getDate(), lastDayOfMonth)} ${monthShort}`, start: 22, end: 31 }
    ].map(w => {
      const completedInWeek = dispatchedPeriodList.filter(o => {
        const refTs = o.promisedTs || o.actualTs;
        if (!refTs) return false;
        const day = new Date(refTs).getDate();
        return day >= w.start && day <= w.end;
      });
      const onTimeInWeek = completedInWeek.filter(o => o.dispatchStatus === 'On time').length;
      return {
        label: w.label,
        onTime: onTimeInWeek,
        completed: completedInWeek.length
      };
    });

    // Dispatch-related customer complaints (from BOMs or dispatchesList if any tickets/complaints exist)
    const complaints = [];
    allOrders.forEach((o) => {
      const list = Array.isArray(o.raw.complaints) ? o.raw.complaints : [];
      list.forEach((c, cIdx) => {
        complaints.push({
          ticketId: c.ticketId || c.id || `CMP-${o.code.slice(-3)}-${cIdx + 1}`,
          orderId: o.code,
          customer: o.customer,
          complaint: c.description || c.reason || c.title || 'Dispatch issue reported',
          status: c.status || 'Open',
          rawBom: o.raw
        });
      });
      if (o.raw.complaintText || o.raw.customerComplaint) {
        complaints.push({
          ticketId: o.raw.complaintTicketId || `CMP-${o.code.slice(-3)}`,
          orderId: o.code,
          customer: o.customer,
          complaint: o.raw.complaintText || o.raw.customerComplaint,
          status: o.raw.complaintStatus || 'Open',
          rawBom: o.raw
        });
      }
    });
    (dispatchesList || []).forEach((d, dIdx) => {
      if (d && (d.complaint || d.complaintText)) {
        complaints.push({
          ticketId: d.ticketId || `CMP-${100 + dIdx}`,
          orderId: d.bomCode || d.orderId || '—',
          customer: d.customerName || d.customer || 'Customer',
          complaint: d.complaint || d.complaintText,
          status: d.complaintStatus || 'Open',
          rawBom: null
        });
      }
    });

    const openComplaintsCount = complaints.filter(c => String(c.status).toLowerCase() !== 'resolved' && String(c.status).toLowerCase() !== 'closed').length;
    const resolvedComplaintsCount = complaints.length - openComplaintsCount;

    const todayOverdueList = allOrders.filter(o => o.isOverdueNow || o.isDueToday || o.isDispatchedToday);

    return {
      allOrders,
      dueInPeriodList,
      pendingTodayList,
      dispatchedTodayList,
      overdueNowList,
      todayOverdueList,
      dispatchedPeriodList,
      pendingPeriodList,
      overdueInPeriodCount,
      onTimePeriodList,
      latePeriodList,
      onTimePct,
      weekBuckets,
      complaints,
      openComplaintsCount,
      resolvedComplaintsCount,
      monthRangeLabel: `1–${now.getDate()} ${monthShort} ${now.getFullYear()}`
    };
  }, [allBomList, bomList, dispatchesList]);

  const filterOptions = [
    { id: 'today_overdue', label: 'Today + Overdue', list: analytics.todayOverdueList },
    { id: 'pending_today', label: 'Pending Today', list: analytics.pendingTodayList },
    { id: 'dispatched_today', label: 'Dispatched Today', list: analytics.dispatchedTodayList },
    { id: 'overdue', label: 'Overdue', list: analytics.overdueNowList },
    { id: 'mtd', label: 'Month to Date', list: analytics.dueInPeriodList }
  ];

  const filteredOrders = useMemo(() => {
    const active = filterOptions.find(f => f.id === activeFilter) || filterOptions[0];
    const q = searchTerm.trim().toLowerCase();
    const list = active.list;
    if (!q) return list;
    return list.filter(o =>
      o.code.toLowerCase().includes(q) ||
      o.customer.toLowerCase().includes(q) ||
      o.reason.toLowerCase().includes(q)
    );
  }, [activeFilter, searchTerm, analytics]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleOrders = filteredOrders.slice((safePage - 1) * pageSize, safePage * pageSize);

  const totalBar = Math.max(1, analytics.dueInPeriodList.length);
  const onTimeBarPct = Math.round((analytics.onTimePeriodList.length / totalBar) * 100);
  const lateBarPct = Math.round((analytics.latePeriodList.length / totalBar) * 100);
  const pendingBarPct = Math.max(0, 100 - onTimeBarPct - lateBarPct);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* 1. TOP 6 DISPATCH KPI CARDS (BUSINZ CeoKpiGrid) */}
      <CeoKpiGrid kpis={[
        {
          title: 'Pending Today',
          value: `${analytics.pendingTodayList.length}`,
          valColor: '#D97706',
          trend: 'Due Today',
          trendNeutral: true,
          hideTrendIcon: true,
          bottomPrefix: 'Due today and ',
          bottomHighlight: 'still open',
          bottomHighlightColor: '#B45309',
          onClick: () => triggerCeoDrilldown({
            storageKey: 'controlroom_bom_initial_date_filter',
            eventName: 'controlroom_bom_filter_date',
            targetKeys: analytics.pendingTodayList.map(o => o.code),
            periodLabel: 'Pending Today',
            sourceLabel: 'Dispatch',
            navigateTab: 'BOM Orders',
            onNavigateTab
          })
        },
        {
          title: 'Dispatched Today',
          value: `${analytics.dispatchedTodayList.length}`,
          valColor: '#059669',
          trend: 'Completed',
          trendUp: true,
          hideTrendIcon: true,
          bottomPrefix: 'Orders fully ',
          bottomHighlight: 'dispatched today',
          bottomHighlightColor: '#059669',
          onClick: () => triggerCeoDrilldown({
            storageKey: 'controlroom_bom_initial_date_filter',
            eventName: 'controlroom_bom_filter_date',
            targetKeys: analytics.dispatchedTodayList.map(o => o.code),
            periodLabel: 'Dispatched Today',
            sourceLabel: 'Dispatch',
            navigateTab: 'BOM Orders',
            onNavigateTab
          })
        },
        {
          title: 'Overdue Now',
          value: `${analytics.overdueNowList.length}`,
          valColor: '#DC2626',
          highlightCard: analytics.overdueNowList.length > 0,
          trend: analytics.overdueNowList.length > 0 ? 'Action' : 'Clear',
          trendUp: analytics.overdueNowList.length === 0,
          hideTrendIcon: true,
          bottomPrefix: 'Past promised date ',
          bottomHighlight: 'and still open',
          bottomHighlightColor: '#DC2626',
          onClick: () => triggerCeoDrilldown({
            storageKey: 'controlroom_bom_initial_date_filter',
            eventName: 'controlroom_bom_filter_date',
            targetKeys: analytics.overdueNowList.map(o => o.code),
            periodLabel: 'Overdue Now',
            sourceLabel: 'Dispatch',
            navigateTab: 'BOM Orders',
            onNavigateTab
          })
        },
        {
          title: 'Dispatched This Month',
          value: `${analytics.dispatchedPeriodList.length}`,
          trend: `${analytics.dueInPeriodList.length} Due`,
          trendNeutral: true,
          hideTrendIcon: true,
          bottomPrefix: `Of ${analytics.dueInPeriodList.length} orders `,
          bottomHighlight: 'due this period',
          bottomHighlightColor: '#0E7490',
          onClick: () => triggerCeoDrilldown({
            storageKey: 'controlroom_bom_initial_date_filter',
            eventName: 'controlroom_bom_filter_date',
            targetKeys: analytics.dispatchedPeriodList.map(o => o.code),
            periodLabel: `Dispatched (${selectedPeriod})`,
            sourceLabel: 'Dispatch',
            navigateTab: 'BOM Orders',
            onNavigateTab
          })
        },
        {
          title: 'Pending This Month',
          value: `${analytics.pendingPeriodList.length}`,
          valColor: '#D97706',
          trend: `${analytics.overdueInPeriodCount} Overdue`,
          trendNeutral: true,
          hideTrendIcon: true,
          bottomPrefix: `Includes ${analytics.overdueInPeriodCount} `,
          bottomHighlight: 'already overdue',
          bottomHighlightColor: '#B45309',
          onClick: () => triggerCeoDrilldown({
            storageKey: 'controlroom_bom_initial_date_filter',
            eventName: 'controlroom_bom_filter_date',
            targetKeys: analytics.pendingPeriodList.map(o => o.code),
            periodLabel: `Pending (${selectedPeriod})`,
            sourceLabel: 'Dispatch',
            navigateTab: 'BOM Orders',
            onNavigateTab
          })
        },
        {
          title: 'On-Time Dispatch',
          value: `${analytics.onTimePct}%`,
          valColor: '#059669',
          trend: `${analytics.onTimePeriodList.length}/${analytics.dispatchedPeriodList.length}`,
          trendUp: Number(analytics.onTimePct) >= 80,
          hideTrendIcon: true,
          bottomPrefix: `${analytics.onTimePeriodList.length} of ${analytics.dispatchedPeriodList.length} `,
          bottomHighlight: 'completed on time',
          bottomHighlightColor: '#059669',
          onClick: () => triggerCeoDrilldown({
            storageKey: 'controlroom_bom_initial_date_filter',
            eventName: 'controlroom_bom_filter_date',
            targetKeys: analytics.onTimePeriodList.map(o => o.code),
            periodLabel: `On-Time Dispatch (${selectedPeriod})`,
            sourceLabel: 'Dispatch',
            navigateTab: 'BOM Orders',
            onNavigateTab
          })
        }
      ]} />

      {/* 2. DISPATCH ORDERS TABLE (Option 2 Section Card) */}
      <BusinzSectionCard
        title="Dispatch Orders"
        rightNode={
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0',
            borderRadius: '8px', padding: '5px 10px', minWidth: '230px'
          }}>
            <Search size={13} color="#94A3B8" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              placeholder="Search Order ID or customer"
              style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '12px', color: '#0F172A', width: '100%' }}
            />
          </div>
        }
      >
        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {filterOptions.map((opt) => {
            const isSel = activeFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => { setActiveFilter(opt.id); setPage(1); }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '999px',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  border: isSel ? '1px solid #0E7490' : '1px solid #E2E8F0',
                  backgroundColor: isSel ? '#ECFEFF' : '#FFFFFF',
                  color: isSel ? '#0E7490' : '#475569'
                }}
              >
                {opt.label} ({opt.list.length})
              </button>
            );
          })}
        </div>

        {/* Orders Table */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '12px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ textAlign: 'left', padding: '10px 14px' }}>Order ID</th>
                <th style={{ textAlign: 'left', padding: '10px 14px' }}>Customer</th>
                <th style={{ textAlign: 'left', padding: '10px 14px' }}>Promised Dispatch</th>
                <th style={{ textAlign: 'left', padding: '10px 14px' }}>Actual Dispatch</th>
                <th style={{ textAlign: 'left', padding: '10px 14px' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '10px 14px' }}>Delay</th>
                <th style={{ textAlign: 'left', padding: '10px 14px' }}>Reason / Current Blocker</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#94A3B8', fontSize: '12.5px' }}>
                    No dispatch orders match the active filter.
                  </td>
                </tr>
              ) : (
                visibleOrders.map((ord) => {
                  const st = STATUS_BADGE[ord.dispatchStatus] || STATUS_BADGE.Pending;
                  return (
                    <tr
                      key={ord.code}
                      onClick={() => onOpenBom && onOpenBom(ord.raw)}
                      style={{ borderBottom: '1px solid #F1F5F9', cursor: onOpenBom ? 'pointer' : 'default' }}
                    >
                      <td style={{ padding: '10px 14px', fontWeight: '800', color: '#0E7490', whiteSpace: 'nowrap' }}>{ord.code}</td>
                      <td style={{ padding: '10px 14px', color: '#0F172A', fontWeight: '600' }}>{ord.customer}</td>
                      <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap' }}>{formatShortDate(ord.promisedTs)}</td>
                      <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap' }}>{ord.actualTs ? formatDateTime(ord.actualTs) : '—'}</td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 9px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: '800',
                          backgroundColor: st.bg,
                          color: st.color,
                          border: `1px solid ${st.border}`
                        }}>
                          {ord.dispatchStatus}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: ord.delayDays > 0 ? '#DC2626' : '#64748B', fontWeight: ord.delayDays > 0 ? '700' : '500', whiteSpace: 'nowrap' }}>
                        {ord.delayDays > 0 ? `${ord.delayDays} day${ord.delayDays > 1 ? 's' : ''}` : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155' }}>{ord.reason}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination Footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderTop: '1px solid #F1F5F9', fontSize: '11.5px', color: '#64748B', fontWeight: '600'
          }}>
            <span>
              Showing {filteredOrders.length === 0 ? 0 : ((safePage - 1) * pageSize + 1)}–{Math.min(safePage * pageSize, filteredOrders.length)} of {filteredOrders.length} orders
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={{
                  border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', borderRadius: '6px',
                  padding: '3px 7px', cursor: safePage <= 1 ? 'not-allowed' : 'pointer', opacity: safePage <= 1 ? 0.45 : 1
                }}
              >
                <ChevronLeft size={13} />
              </button>
              <span style={{ color: '#0F172A', fontWeight: '800' }}>{safePage} / {totalPages}</span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                style={{
                  border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', borderRadius: '6px',
                  padding: '3px 7px', cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', opacity: safePage >= totalPages ? 0.45 : 1
                }}
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </BusinzSectionCard>

      {/* 3. BOTTOM 2-COLUMN SECTION: MONTHLY PERFORMANCE + DISPATCH COMPLAINTS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '14px' }}>

        {/* Monthly Dispatch Performance */}
        <BusinzSectionCard
          title="Monthly Dispatch Performance"
          subtitle={analytics.monthRangeLabel}
        >
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', fontSize: '12.5px', fontWeight: '800' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <span style={{ color: '#059669' }}>{analytics.onTimePeriodList.length} on time</span>
                <span style={{ color: '#DC2626' }}>{analytics.latePeriodList.length} dispatched late</span>
                <span style={{ color: '#D97706' }}>{analytics.pendingPeriodList.length} pending</span>
              </div>
              <span style={{ color: '#64748B', fontSize: '11.5px', fontWeight: '700' }}>{analytics.dueInPeriodList.length} orders due</span>
            </div>

            {/* Segmented Bar */}
            <div style={{ width: '100%', height: '10px', borderRadius: '999px', overflow: 'hidden', display: 'flex', backgroundColor: '#E2E8F0' }}>
              {onTimeBarPct > 0 && <div style={{ width: `${onTimeBarPct}%`, backgroundColor: '#059669' }} />}
              {lateBarPct > 0 && <div style={{ width: `${lateBarPct}%`, backgroundColor: '#DC2626' }} />}
              {pendingBarPct > 0 && <div style={{ width: `${pendingBarPct}%`, backgroundColor: '#D97706' }} />}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', color: '#475569', fontWeight: '700' }}>
              <span>Weekly dispatch completion</span>
              <span style={{ color: '#64748B', fontWeight: '600' }}>On time / completed</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
              {analytics.weekBuckets.map((wk) => (
                <div key={wk.label} style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', marginBottom: '4px' }}>{wk.label}</div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>{wk.onTime} / {wk.completed}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: '11px', color: '#64748B', lineHeight: 1.45, borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
              On-time rate = orders dispatched by the promised date ÷ completed orders.<br />
              Monthly counts use the promised dispatch date.
            </div>
          </div>
        </BusinzSectionCard>

        {/* Dispatch-Related Customer Complaints */}
        <BusinzSectionCard
          title="Dispatch-Related Customer Complaints"
          rightNode={
            <span style={{
              fontSize: '11px', fontWeight: '800', color: analytics.openComplaintsCount > 0 ? '#B45309' : '#059669',
              backgroundColor: analytics.openComplaintsCount > 0 ? '#FEF3C7' : '#ECFDF5',
              border: `1px solid ${analytics.openComplaintsCount > 0 ? '#FDE68A' : '#A7F3D0'}`,
              padding: '3px 10px', borderRadius: '999px'
            }}>
              {analytics.openComplaintsCount} open
            </span>
          }
        >
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '600' }}>
              {analytics.complaints.length} complaints logged this month · {analytics.resolvedComplaintsCount} resolved
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase' }}>
                  <th style={{ textAlign: 'left', padding: '8px 8px' }}>Ticket ID</th>
                  <th style={{ textAlign: 'left', padding: '8px 8px' }}>Order ID</th>
                  <th style={{ textAlign: 'left', padding: '8px 8px' }}>Customer</th>
                  <th style={{ textAlign: 'left', padding: '8px 8px' }}>Complaint</th>
                  <th style={{ textAlign: 'left', padding: '8px 8px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {analytics.complaints.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '22px', color: '#94A3B8', fontSize: '12px' }}>
                      No dispatch-related customer complaints logged in this period.
                    </td>
                  </tr>
                ) : (
                  analytics.complaints.slice(0, 6).map((c) => {
                    const isOpen = String(c.status).toLowerCase() === 'open';
                    return (
                      <tr
                        key={c.ticketId}
                        onClick={() => c.rawBom && onOpenBom && onOpenBom(c.rawBom)}
                        style={{ borderBottom: '1px solid #F1F5F9', cursor: c.rawBom && onOpenBom ? 'pointer' : 'default' }}
                      >
                        <td style={{ padding: '9px 8px', fontWeight: '800', color: '#0E7490', whiteSpace: 'nowrap' }}>{c.ticketId}</td>
                        <td style={{ padding: '9px 8px', color: '#334155', fontWeight: '600', whiteSpace: 'nowrap' }}>{c.orderId}</td>
                        <td style={{ padding: '9px 8px', color: '#0F172A', fontWeight: '600' }}>{c.customer}</td>
                        <td style={{ padding: '9px 8px', color: '#475569' }}>{c.complaint}</td>
                        <td style={{ padding: '9px 8px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: '999px', fontSize: '10.5px', fontWeight: '800',
                            backgroundColor: isOpen ? '#FFFBEB' : '#ECFEFF',
                            color: isOpen ? '#B45309' : '#0E7490',
                            border: `1px solid ${isOpen ? '#FDE68A' : '#A5F3FC'}`
                          }}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <div style={{ fontSize: '11px', color: '#64748B', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
              Open complaints are linked to the originating order.
            </div>
          </div>
        </BusinzSectionCard>
      </div>
    </div>
  );
}
