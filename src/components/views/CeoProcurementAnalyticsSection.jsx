import React, { useMemo, useState } from 'react';
import { X, Search, ExternalLink } from 'lucide-react';
import CeoKpiGrid from '../ceoDashboard/CeoKpiGrid';
import { triggerCeoDrilldown } from '../../utils/ceoDrilldownFilter';

const parseAmount = (val) => {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (!val) return 0;
  const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
};

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

const formatCompactINR = (num) => {
  const n = Number(num) || 0;
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(3).replace(/\.?0+$/, '')} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};

const formatLakhs = (num) => {
  const n = Number(num) || 0;
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};

const formatShortDate = (d) => {
  const ms = parseDateMs(d);
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const getPeriodSubtitle = (selectedPeriod) => {
  const now = new Date();
  const monthName = now.toLocaleDateString('en-GB', { month: 'long' });
  const shortMonth = now.toLocaleDateString('en-GB', { month: 'short' });
  const day = now.getDate();
  if (selectedPeriod === 'Today') return { range: `POs placed ${day} ${shortMonth}`, prefix: `Today (${day} ${shortMonth})` };
  if (selectedPeriod === 'This Week') return { range: 'POs placed this week', prefix: 'This week' };
  if (selectedPeriod === 'MTD') return { range: `POs placed 1–${day} ${shortMonth}`, prefix: monthName };
  if (selectedPeriod === 'Last Month') return { range: 'POs placed last month', prefix: 'Last month' };
  if (selectedPeriod === 'Q2 FY27' || selectedPeriod === 'This Quarter') return { range: 'POs placed this quarter', prefix: 'Quarter' };
  if (selectedPeriod === 'YTD') return { range: 'POs placed FYTD', prefix: 'FYTD' };
  return { range: 'All POs placed', prefix: 'All' };
};

const getPoExclGstValue = (po) => {
  if (!po) return 0;
  const sub = parseAmount(po.subTotal ?? po.subtotal ?? po.sub_total ?? po.taxableAmount ?? po.amountExclGst);
  if (sub > 0) return sub;
  if (Array.isArray(po.items) && po.items.length > 0) {
    const itemsSum = po.items.reduce((acc, it) => {
      const q = parseAmount(it.qty ?? it.quantity ?? it.orderedQty ?? 0);
      const r = parseAmount(it.rate ?? it.unitPrice ?? it.price ?? 0);
      const line = parseAmount(it.amount ?? it.subTotal ?? (q * r));
      return acc + (line > 0 ? line : 0);
    }, 0);
    if (itemsSum > 0) return itemsSum;
  }
  const grand = parseAmount(po.grandTotal ?? po.total ?? po.totalAmount ?? po.amount ?? 0);
  return grand > 0 ? Math.round((grand / 1.18) * 100) / 100 : 0;
};

const enrichPoRecord = (po, idx, grnByPoMap) => {
  const poNo = String(po.poNo || po.poNumber || po.purchaseorder_number || po.id || `PO-${idx + 1}`).trim();
  const poKey = poNo.toUpperCase();
  const vendor = String(po.vendor || po.vendorName || po.vendor_name || po.supplierName || 'Vendor').trim() || 'Vendor';
  const rawDate = po.poDate || po.date || po.createdAt || po.created_at || '';
  const dateTs = parseDateMs(rawDate);
  const rawDel = po.committedDeliveryDate || po.deliveryDate || po.expectedDeliveryDate || po.expectedDate || po.dueDate || '';
  const delTs = parseDateMs(rawDel);

  const rawStatus = String(po.status || po.stage || po.approvalStatus || '').trim();
  const lower = rawStatus.toLowerCase();
  const statusType = String(po.statusType || po.order_status || '').trim().toLowerCase();

  const matchedGrns = grnByPoMap.get(poKey) || [];
  const grnHist = Array.isArray(po.grnHistory) ? po.grnHistory : [];
  const allGrns = matchedGrns.length > 0 ? matchedGrns : grnHist;

  const isCancelled = lower.includes('cancel') || lower.includes('reject') || statusType === 'cancelled' || statusType === 'rejected';
  const isClosed = !isCancelled && (
    lower.includes('closed') ||
    lower.includes('completed') ||
    lower.includes('grn completed') ||
    statusType === 'closed' ||
    allGrns.some(g => String(g?.status || '').toLowerCase().includes('closed') || g?.forceClosePO === true)
  );

  const orderedQty = parseAmount(po.totalOrderedQty) || (Array.isArray(po.items) ? po.items.reduce((s, it) => s + parseAmount(it.qty ?? it.quantity ?? 0), 0) : 0);
  const receivedQtyFromGrns = allGrns.reduce((s, g) => s + parseAmount(g.acceptedQty ?? g.receivedQty ?? 0), 0);
  const receivedQty = Math.max(parseAmount(po.totalReceivedQty), receivedQtyFromGrns);

  const isFullyReceived = !isCancelled && (
    isClosed ||
    lower.includes('fully') ||
    lower === 'received' ||
    allGrns.some(g => String(g?.status || '').toLowerCase().includes('fully')) ||
    (orderedQty > 0 && receivedQty >= orderedQty)
  );
  const isPartiallyReceived = !isCancelled && !isFullyReceived && (
    lower.includes('partial') ||
    statusType === 'partially_received' ||
    receivedQty > 0 ||
    allGrns.length > 0
  );
  const hasNoMaterial = !isCancelled && !isFullyReceived && !isPartiallyReceived;

  const isMdApprovalPending = !isCancelled && !isFullyReceived && !isPartiallyReceived && (
    lower.includes('waiting for approval') ||
    lower.includes('pending approval') ||
    lower.includes('pending ceo') ||
    lower.includes('pending md') ||
    lower.includes('awaiting approval') ||
    lower === 'draft' ||
    lower === '' ||
    statusType === 'pending' ||
    statusType === 'draft'
  );

  const isPaidOrProceeded = Boolean(
    po.paymentDetails ||
    po.proceedDetails ||
    lower.includes('proceed') ||
    lower.includes('payment processed') ||
    lower.includes('paid') ||
    lower.includes('issued') ||
    lower.includes('sent') ||
    statusType === 'payment_processed' ||
    statusType === 'proceed_po'
  );

  const isApprovedPaymentPending = !isCancelled && !isMdApprovalPending && !isFullyReceived && !isPartiallyReceived && !isPaidOrProceeded && (
    lower.includes('payment pending') ||
    lower.includes('awaiting payment') ||
    lower.includes('md approved') ||
    lower.includes('ceo approved') ||
    lower === 'approved' ||
    lower === 'open' ||
    statusType === 'approved'
  );

  const isPaidDeliveryPending = !isCancelled && !isMdApprovalPending && !isApprovedPaymentPending && !isFullyReceived && !isPartiallyReceived && isPaidOrProceeded;

  const hasMaterialArrived = Boolean(
    po.materialReceivedAt ||
    po.arrivedAt ||
    po.receivedAt ||
    po.materialReceived === true ||
    isFullyReceived ||
    isPartiallyReceived ||
    allGrns.length > 0
  );
  const hasGrnPosted = allGrns.length > 0 || Number(po.grnCount || 0) > 0 || isFullyReceived;
  const isMaterialReceivedGrnPending = !isCancelled && !isFullyReceived && (
    isPartiallyReceived ||
    (hasMaterialArrived && !hasGrnPosted)
  );

  const latestGrnTs = allGrns.reduce((maxTs, g) => {
    const t = parseDateMs(g.date || g.grnDate || g.createdAt || g.created_at);
    return (t && (!maxTs || t > maxTs)) ? t : maxTs;
  }, null);
  const receiptTs = parseDateMs(po.materialReceivedAt || po.arrivedAt || po.receivedAt) || latestGrnTs;

  const deliveredOnTime = isFullyReceived && (!delTs || !receiptTs || receiptTs <= delTs + 86400000);
  const grnPostedOnTime = hasGrnPosted && (!receiptTs || !latestGrnTs || latestGrnTs <= receiptTs + (2 * 86400000));

  const exclGstValue = getPoExclGstValue(po);
  const grandTotal = parseAmount(po.grandTotal ?? po.total ?? po.totalAmount ?? po.amount ?? 0);

  return {
    ...po,
    poNo,
    vendor,
    rawDate,
    dateTs,
    rawDel,
    delTs,
    rawStatus: rawStatus || 'Draft',
    exclGstValue,
    grandTotal,
    isCancelled,
    isClosed,
    isFullyReceived,
    isPartiallyReceived,
    hasNoMaterial,
    isMdApprovalPending,
    isApprovedPaymentPending,
    isPaidDeliveryPending,
    isMaterialReceivedGrnPending,
    hasMaterialArrived,
    hasGrnPosted,
    deliveredOnTime,
    grnPostedOnTime,
    receiptTs
  };
};

const BusinzSectionCard = ({ title, subtitle, children }) => (
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
      <span style={{
        fontSize: '11px', fontWeight: '700', color: '#475569',
        backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0',
        padding: '3px 10px', borderRadius: '999px'
      }}>
        {subtitle}
      </span>
    </div>
    <div style={{ padding: '14px' }}>
      {children}
    </div>
  </div>
);

export default function CeoProcurementAnalyticsSection({
  poList = [],
  allPoList = [],
  grnList = [],
  selectedPeriod = 'MTD',
  onNavigateTab
}) {
  const [poPopup, setPoPopup] = useState(null);
  const [popupSearch, setPopupSearch] = useState('');

  const analytics = useMemo(() => {
    const nowMs = Date.now();
    const grnByPoMap = new Map();
    (grnList || []).forEach((g) => {
      const ref = String(g?.poNumber || g?.poNo || g?.poRef || '').trim().toUpperCase();
      if (!ref) return;
      if (!grnByPoMap.has(ref)) grnByPoMap.set(ref, []);
      grnByPoMap.get(ref).push(g);
    });

    const periodSource = (poList && poList.length > 0) ? poList : [];
    const allSource = (allPoList && allPoList.length > 0) ? allPoList : periodSource;

    const periodPOs = periodSource
      .filter(Boolean)
      .map((p, i) => enrichPoRecord(p, i, grnByPoMap))
      .filter(p => !p.isCancelled);

    const openAllPOs = allSource
      .filter(Boolean)
      .map((p, i) => enrichPoRecord(p, i, grnByPoMap))
      .filter(p => !p.isCancelled);

    const noMaterialPOs = periodPOs.filter(p => p.hasNoMaterial);
    const fullyReceivedPOs = periodPOs.filter(p => p.isFullyReceived);
    const partiallyReceivedPOs = periodPOs.filter(p => p.isPartiallyReceived);
    const closedPOs = periodPOs.filter(p => p.isClosed);
    const totalPeriodValue = periodPOs.reduce((s, p) => s + p.exclGstValue, 0);

    const mdPendingPOs = openAllPOs.filter(p => p.isMdApprovalPending);
    const paymentPendingPOs = openAllPOs.filter(p => p.isApprovedPaymentPending);
    const deliveryPendingPOs = openAllPOs.filter(p => p.isPaidDeliveryPending);
    const deliveryOverdueCount = deliveryPendingPOs.filter(p => p.delTs && p.delTs < nowMs).length;
    const grnPendingPOs = openAllPOs.filter(p => p.isMaterialReceivedGrnPending);
    const grnArrivedOnTimeCount = grnPendingPOs.filter(p => !p.delTs || !p.receiptTs || p.receiptTs <= p.delTs + 86400000).length;

    const deliveredFullPOs = periodPOs.filter(p => p.isFullyReceived);
    const deliveredOnTimePOs = deliveredFullPOs.filter(p => p.deliveredOnTime);
    const deliveredOnTimePct = deliveredFullPOs.length > 0 ? Math.round((deliveredOnTimePOs.length / deliveredFullPOs.length) * 100) : 0;

    const grnEligiblePOs = periodPOs.filter(p => p.isFullyReceived || p.isPartiallyReceived || p.hasGrnPosted);
    const grnPostedPOs = grnEligiblePOs.filter(p => p.hasGrnPosted);
    const grnPostedOnTimePOs = grnPostedPOs.filter(p => p.grnPostedOnTime);
    const grnPostedOnTimePct = grnPostedPOs.length > 0 ? Math.round((grnPostedOnTimePOs.length / grnPostedPOs.length) * 100) : 0;

    const vendorMap = new Map();
    const productMap = new Map();

    periodPOs.forEach((po) => {
      const vEntry = vendorMap.get(po.vendor) || { name: po.vendor, value: 0, pos: [] };
      vEntry.value += po.exclGstValue;
      vEntry.pos.push(po);
      vendorMap.set(po.vendor, vEntry);

      if (Array.isArray(po.items) && po.items.length > 0) {
        const rawItemLines = po.items.map((it) => {
          const pName = String(it.name || it.itemName || it.description || 'Material Item').trim() || 'Material Item';
          const q = parseAmount(it.qty ?? it.quantity ?? it.orderedQty ?? 0);
          const r = parseAmount(it.rate ?? it.unitPrice ?? it.price ?? 0);
          const line = parseAmount(it.amount ?? it.subTotal ?? (q * r));
          return { pName, line: line > 0 ? line : 0 };
        });
        const lineSum = rawItemLines.reduce((s, x) => s + x.line, 0);
        const scale = (lineSum > 0 && po.exclGstValue > 0) ? (po.exclGstValue / lineSum) : 1;

        rawItemLines.forEach(({ pName, line }) => {
          const val = line > 0 ? line * scale : (po.exclGstValue / rawItemLines.length);
          const pEntry = productMap.get(pName) || { name: pName, value: 0, pos: [] };
          pEntry.value += val;
          if (!pEntry.pos.some(x => x.poNo === po.poNo)) pEntry.pos.push(po);
          productMap.set(pName, pEntry);
        });
      }
    });

    const topVendors = Array.from(vendorMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map(v => ({
        ...v,
        share: totalPeriodValue > 0 ? (v.value / totalPeriodValue) * 100 : 0
      }));
    const topVendorsTotal = topVendors.reduce((s, v) => s + v.value, 0);
    const topVendorsShare = totalPeriodValue > 0 ? (topVendorsTotal / totalPeriodValue) * 100 : 0;

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map(p => ({
        ...p,
        share: totalPeriodValue > 0 ? (p.value / totalPeriodValue) * 100 : 0
      }));
    const topProductsTotal = topProducts.reduce((s, p) => s + p.value, 0);
    const topProductsShare = totalPeriodValue > 0 ? (topProductsTotal / totalPeriodValue) * 100 : 0;

    return {
      periodPOs,
      noMaterialPOs,
      fullyReceivedPOs,
      partiallyReceivedPOs,
      closedPOs,
      totalPeriodValue,
      mdPendingPOs,
      paymentPendingPOs,
      deliveryPendingPOs,
      deliveryOverdueCount,
      grnPendingPOs,
      grnArrivedOnTimeCount,
      deliveredFullPOs,
      deliveredOnTimePOs,
      deliveredOnTimePct,
      grnEligiblePOs,
      grnPostedPOs,
      grnPostedOnTimePOs,
      grnPostedOnTimePct,
      topVendors,
      topVendorsTotal,
      topVendorsShare,
      topProducts,
      topProductsTotal,
      topProductsShare
    };
  }, [poList, allPoList, grnList]);

  const periodLabels = getPeriodSubtitle(selectedPeriod);
  const todayLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const drillToPurchaseOrders = (title, list) => triggerCeoDrilldown({
    storageKey: 'controlroom_po_initial_date_filter',
    eventName: 'controlroom_po_filter_date',
    targetKeys: (list || []).map(p => p.poNo || p.raw?.poNumber || p.raw?.poNo || p.raw?.id),
    periodLabel: title,
    sourceLabel: 'Procurement',
    navigateTab: 'Purchase Orders',
    onNavigateTab
  });

  const openListPopup = (title, list) => {
    drillToPurchaseOrders(title, list);
  };

  const filteredPopupList = useMemo(() => {
    if (!poPopup) return [];
    const q = popupSearch.trim().toLowerCase();
    if (!q) return poPopup.list;
    return poPopup.list.filter(p =>
      p.poNo.toLowerCase().includes(q) ||
      p.vendor.toLowerCase().includes(q) ||
      p.rawStatus.toLowerCase().includes(q)
    );
  }, [poPopup, popupSearch]);

  const maxVendorVal = analytics.topVendors[0]?.value || 1;
  const maxProductVal = analytics.topProducts[0]?.value || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* 1. PURCHASE ORDER SUMMARY (BUSINZ CeoKpiGrid) */}
      <BusinzSectionCard
        title="Purchase Order Summary"
        subtitle={periodLabels.range}
      >
        <CeoKpiGrid kpis={[
          {
            title: 'POs Placed',
            value: `${analytics.periodPOs.length}`,
            trend: `${analytics.noMaterialPOs.length} Awaiting`,
            trendNeutral: true,
            hideTrendIcon: true,
            bottomPrefix: `${analytics.noMaterialPOs.length} `,
            bottomHighlight: 'with no material received',
            bottomHighlightColor: '#475569',
            onClick: () => openListPopup('POs placed', analytics.periodPOs)
          },
          {
            title: selectedPeriod === 'MTD' ? 'Monthly Purchase Value' : 'Period Purchase Value',
            value: formatCompactINR(analytics.totalPeriodValue),
            trend: 'Excl. GST',
            trendNeutral: true,
            hideTrendIcon: true,
            bottomPrefix: 'Placed PO value · ',
            bottomHighlight: 'Excluding GST',
            bottomHighlightColor: '#0E7490',
            onClick: () => openListPopup('Purchase value (excl. GST)', analytics.periodPOs)
          },
          {
            title: 'Fully Received',
            value: `${analytics.fullyReceivedPOs.length}`,
            valColor: '#059669',
            trend: analytics.periodPOs.length > 0 ? `${Math.round((analytics.fullyReceivedPOs.length / analytics.periodPOs.length) * 100)}%` : '0%',
            trendUp: true,
            hideTrendIcon: true,
            bottomPrefix: 'All ordered material ',
            bottomHighlight: 'received',
            bottomHighlightColor: '#059669',
            onClick: () => openListPopup('Fully received POs', analytics.fullyReceivedPOs)
          },
          {
            title: 'Partially Received',
            value: `${analytics.partiallyReceivedPOs.length}`,
            valColor: '#D97706',
            trend: 'In Progress',
            trendNeutral: true,
            hideTrendIcon: true,
            bottomPrefix: 'Balance material ',
            bottomHighlight: 'still due',
            bottomHighlightColor: '#B45309',
            onClick: () => openListPopup('Partially received POs', analytics.partiallyReceivedPOs)
          },
          {
            title: 'POs Closed',
            value: `${analytics.closedPOs.length}`,
            valColor: '#059669',
            trend: 'Closed',
            trendUp: true,
            hideTrendIcon: true,
            bottomPrefix: 'BUSINZ ',
            bottomHighlight: 'closure status',
            bottomHighlightColor: '#059669',
            onClick: () => openListPopup('POs closed', analytics.closedPOs)
          }
        ]} />
      </BusinzSectionCard>

      {/* 2. PENDING ACTIONS (BUSINZ Highlight Action Grid) */}
      <BusinzSectionCard
        title="Pending Actions"
        subtitle={`All open POs as of ${todayLabel}, including prior months`}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
          {[
            {
              title: 'MD Approval Pending',
              count: `${analytics.mdPendingPOs.length} POs`,
              owner: 'Owner · MD',
              bg: '#FFFBEB',
              border: '#FDE68A',
              accent: '#B45309',
              badgeBg: '#FEF3C7',
              list: analytics.mdPendingPOs
            },
            {
              title: 'Approved, Payment Pending',
              count: `${analytics.paymentPendingPOs.length} POs`,
              owner: 'Owner · Accounts',
              bg: '#FFFBEB',
              border: '#FDE68A',
              accent: '#B45309',
              badgeBg: '#FEF3C7',
              list: analytics.paymentPendingPOs
            },
            {
              title: 'Paid, Delivery Pending',
              count: `${analytics.deliveryPendingPOs.length} POs`,
              owner: `Owner · Purchase${analytics.deliveryOverdueCount > 0 ? ` | ${analytics.deliveryOverdueCount} overdue` : ''}`,
              bg: '#FEF2F2',
              border: '#FECACA',
              accent: '#DC2626',
              badgeBg: '#FEE2E2',
              list: analytics.deliveryPendingPOs
            },
            {
              title: 'Material Received, GRN Pending',
              count: `${analytics.grnPendingPOs.length} POs`,
              owner: `Owner · Stores${analytics.grnArrivedOnTimeCount > 0 ? ` | ${analytics.grnArrivedOnTimeCount} arrived on time` : ''}`,
              bg: '#FEF2F2',
              border: '#FECACA',
              accent: '#DC2626',
              badgeBg: '#FEE2E2',
              list: analytics.grnPendingPOs
            }
          ].map((act) => (
            <div
              key={act.title}
              onClick={() => openListPopup(act.title, act.list)}
              role="button"
              tabIndex={0}
              style={{
                backgroundColor: act.bg,
                borderRadius: '16px',
                border: `1px solid ${act.border}`,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: act.accent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {act.title}
                </span>
                <span style={{ fontSize: '20px', fontWeight: '900', color: act.accent, letterSpacing: '-0.5px', lineHeight: 1.15 }}>
                  {act.count}
                </span>
              </div>
              <div style={{
                backgroundColor: 'rgba(255,255,255,0.75)',
                border: `1px solid ${act.border}`,
                borderRadius: '10px',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: '700',
                color: act.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span>{act.owner}</span>
                <span style={{ color: '#0E7490', fontWeight: '800', fontSize: '10.5px' }}>View →</span>
              </div>
            </div>
          ))}
        </div>
      </BusinzSectionCard>

      {/* 3. DELIVERY AND GRN PERFORMANCE (BUSINZ CeoKpiGrid) */}
      <BusinzSectionCard
        title="Delivery and GRN Performance"
        subtitle={`${periodLabels.prefix} POs placed`}
      >
        <CeoKpiGrid kpis={[
          {
            title: 'POs Delivered in Full On Time',
            value: `${analytics.deliveredOnTimePOs.length} / ${analytics.deliveredFullPOs.length}`,
            valColor: '#059669',
            trend: `${analytics.deliveredOnTimePct}%`,
            trendUp: analytics.deliveredOnTimePct >= 75,
            hideTrendIcon: true,
            bottomPrefix: 'Full receipt by ',
            bottomHighlight: 'committed delivery date',
            bottomHighlightColor: '#059669',
            onClick: () => openListPopup('POs delivered in full on time', analytics.deliveredOnTimePOs)
          },
          {
            title: 'POs with GRN Posted',
            value: `${analytics.grnPostedPOs.length} / ${analytics.grnEligiblePOs.length}`,
            trend: analytics.grnEligiblePOs.length > 0 ? `${Math.round((analytics.grnPostedPOs.length / analytics.grnEligiblePOs.length) * 100)}%` : '0%',
            trendNeutral: true,
            hideTrendIcon: true,
            bottomPrefix: 'GRNs posted for ',
            bottomHighlight: 'recorded PO receipts',
            bottomHighlightColor: '#0E7490',
            onClick: () => openListPopup('POs with GRN posted', analytics.grnPostedPOs)
          },
          {
            title: 'POs with GRN Posted On Time',
            value: `${analytics.grnPostedOnTimePOs.length} / ${analytics.grnPostedPOs.length}`,
            valColor: '#059669',
            trend: `${analytics.grnPostedOnTimePct}%`,
            trendUp: analytics.grnPostedOnTimePct >= 75,
            hideTrendIcon: true,
            bottomPrefix: 'Posted within ',
            bottomHighlight: '1 working day of receipt',
            bottomHighlightColor: '#059669',
            onClick: () => openListPopup('POs with GRN posted on time', analytics.grnPostedOnTimePOs)
          }
        ]} />
      </BusinzSectionCard>

      {/* 4. WHERE THE PURCHASE VALUE WENT */}
      <BusinzSectionCard
        title="Where the Purchase Value Went"
        subtitle={`${periodLabels.prefix} POs placed · Ranked by value excluding GST`}
      >

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '12px' }}>
          {/* Top 5 vendors */}
          <div style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #EAEFEF',
            borderRadius: '16px',
            padding: '16px 18px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginBottom: '12px' }}>Top 5 Vendors</div>
            {analytics.topVendors.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#94A3B8', padding: '18px 0', textAlign: 'center' }}>No POs recorded in this period</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ textAlign: 'left', padding: '6px 4px', width: '24px' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '6px 4px' }}>Vendor</th>
                    <th style={{ padding: '6px 8px', width: '110px' }}></th>
                    <th style={{ textAlign: 'right', padding: '6px 4px' }}>PO Value</th>
                    <th style={{ textAlign: 'right', padding: '6px 4px', width: '54px' }}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topVendors.map((v, idx) => (
                    <tr
                      key={v.name}
                      onClick={() => openListPopup(`Vendor: ${v.name}`, v.pos)}
                      style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '9px 4px', color: '#0E7490', fontWeight: '800' }}>{idx + 1}</td>
                      <td style={{ padding: '9px 4px', color: '#0F172A', fontWeight: '600', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.name}>{v.name}</td>
                      <td style={{ padding: '9px 8px' }}>
                        <div style={{ width: '100%', height: '6px', backgroundColor: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(6, Math.round((v.value / maxVendorVal) * 100))}%`, height: '100%', background: 'linear-gradient(90deg, #0891B2, #0E7490)', borderRadius: '999px' }} />
                        </div>
                      </td>
                      <td style={{ padding: '9px 4px', textAlign: 'right', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap' }}>{formatLakhs(v.value)}</td>
                      <td style={{ padding: '9px 4px', textAlign: 'right', color: '#475569', fontWeight: '700' }}>{v.share.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#F0FDFA', borderTop: '1.5px solid #A5F3FC', fontWeight: '800', color: '#0E7490' }}>
                    <td colSpan={3} style={{ padding: '9px 6px', borderRadius: '6px 0 0 6px' }}>Top 5 Total</td>
                    <td style={{ padding: '9px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatLakhs(analytics.topVendorsTotal)}</td>
                    <td style={{ padding: '9px 6px', textAlign: 'right', borderRadius: '0 6px 6px 0' }}>{analytics.topVendorsShare.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Top 5 products */}
          <div style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #EAEFEF',
            borderRadius: '16px',
            padding: '16px 18px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginBottom: '12px' }}>Top 5 Products</div>
            {analytics.topProducts.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#94A3B8', padding: '18px 0', textAlign: 'center' }}>No product lines recorded in this period</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ textAlign: 'left', padding: '6px 4px', width: '24px' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '6px 4px' }}>Product</th>
                    <th style={{ padding: '6px 8px', width: '110px' }}></th>
                    <th style={{ textAlign: 'right', padding: '6px 4px' }}>PO Value</th>
                    <th style={{ textAlign: 'right', padding: '6px 4px', width: '54px' }}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topProducts.map((p, idx) => (
                    <tr
                      key={p.name}
                      onClick={() => openListPopup(`Product: ${p.name}`, p.pos)}
                      style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '9px 4px', color: '#0E7490', fontWeight: '800' }}>{idx + 1}</td>
                      <td style={{ padding: '9px 4px', color: '#0F172A', fontWeight: '600', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.name}>{p.name}</td>
                      <td style={{ padding: '9px 8px' }}>
                        <div style={{ width: '100%', height: '6px', backgroundColor: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(6, Math.round((p.value / maxProductVal) * 100))}%`, height: '100%', background: 'linear-gradient(90deg, #0891B2, #0E7490)', borderRadius: '999px' }} />
                        </div>
                      </td>
                      <td style={{ padding: '9px 4px', textAlign: 'right', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap' }}>{formatLakhs(p.value)}</td>
                      <td style={{ padding: '9px 4px', textAlign: 'right', color: '#475569', fontWeight: '700' }}>{p.share.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#F0FDFA', borderTop: '1.5px solid #A5F3FC', fontWeight: '800', color: '#0E7490' }}>
                    <td colSpan={3} style={{ padding: '9px 6px', borderRadius: '6px 0 0 6px' }}>Top 5 Total</td>
                    <td style={{ padding: '9px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatLakhs(analytics.topProductsTotal)}</td>
                    <td style={{ padding: '9px 6px', textAlign: 'right', borderRadius: '0 6px 6px 0' }}>{analytics.topProductsShare.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </BusinzSectionCard>

      {/* DRILL-DOWN PO LIST MODAL */}
      {poPopup && (
        <div
          onClick={() => setPoPopup(null)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF', borderRadius: '16px', width: '100%', maxWidth: '820px',
              maxHeight: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', overflow: 'hidden'
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>{poPopup.title}</h4>
                <span style={{ fontSize: '12px', color: '#64748B' }}>{filteredPopupList.length} purchase order(s)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => { setPoPopup(null); onNavigateTab('Purchase Orders'); }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px',
                      borderRadius: '8px', border: '1px solid #0E7490', backgroundColor: '#ECFEFF',
                      color: '#0E7490', fontSize: '12px', fontWeight: '800', cursor: 'pointer'
                    }}
                  >
                    <ExternalLink size={13} /> Open POs
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPoPopup(null)}
                  style={{ border: 'none', background: '#F1F5F9', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#475569' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div style={{ padding: '10px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={14} color="#94A3B8" />
              <input
                type="text"
                value={popupSearch}
                onChange={(e) => setPopupSearch(e.target.value)}
                placeholder="Search PO number, vendor, or status..."
                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px', color: '#0F172A' }}
              />
            </div>

            <div style={{ overflowY: 'auto', padding: '8px 20px 18px 20px' }}>
              {filteredPopupList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px', color: '#94A3B8', fontSize: '13px' }}>No matching purchase orders found.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '11px', textTransform: 'uppercase' }}>
                      <th style={{ textAlign: 'left', padding: '8px 6px' }}>PO No</th>
                      <th style={{ textAlign: 'left', padding: '8px 6px' }}>Vendor</th>
                      <th style={{ textAlign: 'left', padding: '8px 6px' }}>Date</th>
                      <th style={{ textAlign: 'right', padding: '8px 6px' }}>Value (Excl. GST)</th>
                      <th style={{ textAlign: 'left', padding: '8px 6px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPopupList.map((po) => (
                      <tr key={po.poNo} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '9px 6px', fontWeight: '700', color: '#0E7490' }}>{po.poNo}</td>
                        <td style={{ padding: '9px 6px', color: '#0F172A', fontWeight: '600' }}>{po.vendor}</td>
                        <td style={{ padding: '9px 6px', color: '#64748B' }}>{formatShortDate(po.rawDate)}</td>
                        <td style={{ padding: '9px 6px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>{formatLakhs(po.exclGstValue)}</td>
                        <td style={{ padding: '9px 6px', color: '#475569' }}>{po.rawStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
