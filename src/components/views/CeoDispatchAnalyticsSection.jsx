import React, { useMemo, useState } from 'react';
import {
  Truck, Clock, AlertTriangle, ShieldAlert, FileCheck,
  Package, CheckCircle, X, Search, Calendar, SlidersHorizontal
} from 'lucide-react';

const formatINRCompact = (val) => {
  const n = Number(val) || 0;
  if (n >= 10000000) return `₹ ${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹ ${(n / 100000).toFixed(2)} L`;
  return `₹ ${Math.round(n).toLocaleString('en-IN')}`;
};

const cardStyle = {
  backgroundColor: '#FFFFFF',
  borderRadius: '16px',
  border: '1px solid #EAEFEF',
  padding: '18px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
};

const cardHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid #F1F5F9',
  paddingBottom: '8px'
};

const cardTitleStyle = {
  fontSize: '11.5px',
  fontWeight: '800',
  color: '#0F172A',
  textTransform: 'uppercase',
  letterSpacing: '0.4px'
};

const summaryStripStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '8px',
  backgroundColor: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderRadius: '10px',
  padding: '8px 12px'
};

const DonutChartSvg = ({ segments = [], centerLabel, centerSub, activeName = null, onSelectSegment = null }) => {
  const size = 136;
  const stroke = 19;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0) || 1;

  let offset = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F1F5F9" strokeWidth={stroke} />
        {segments.map((seg, idx) => {
          const pct = (seg.value || 0) / total;
          const dash = pct * circumference;
          const curOffset = offset;
          offset += dash;
          if (dash <= 0) return null;
          const isSelected = activeName && seg.name === activeName;
          const isDimmed = activeName && seg.name !== activeName;
          return (
            <circle
              key={idx}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={isSelected ? stroke + 3 : stroke}
              strokeDasharray={`${dash} ${circumference}`}
              strokeDashoffset={-curOffset}
              opacity={isDimmed ? 0.35 : 1}
              style={{ cursor: onSelectSegment ? 'pointer' : 'default', transition: 'opacity 0.18s ease, stroke-width 0.18s ease' }}
              onClick={() => onSelectSegment && onSelectSegment(seg.name)}
            />
          );
        })}
      </svg>
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        pointerEvents: 'none',
        padding: '0 18px'
      }}>
        <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A', lineHeight: 1.1 }}>{centerLabel}</div>
        <div style={{ fontSize: '9.5px', fontWeight: '600', color: '#64748B', marginTop: '2px' }}>{centerSub}</div>
      </div>
    </div>
  );
};

export default function CeoDispatchAnalyticsSection({
  bomList = [],
  dispatchesList = [],
  challansList = [],
  invList = [],
  inventoryList = [],
  onOpenBom = null
}) {
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedDayIdx, setSelectedDayIdx] = useState(null);
  const [ordersPopup, setOrdersPopup] = useState(null);
  const [popupSearch, setPopupSearch] = useState('');
  const [selectedProductNames, setSelectedProductNames] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('businz_ceo_dispatch_selected_products') : null;
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed.slice(0, 5) : null;
    } catch (_) {
      return null;
    }
  });
  const [productFilterOpen, setProductFilterOpen] = useState(false);
  const [productFilterSearch, setProductFilterSearch] = useState('');

  const updateSelectedProducts = (next) => {
    setSelectedProductNames(next);
    try {
      if (next === null) localStorage.removeItem('businz_ceo_dispatch_selected_products');
      else localStorage.setItem('businz_ceo_dispatch_selected_products', JSON.stringify(next));
    } catch (_) {}
  };

  const closePopup = () => {
    setOrdersPopup(null);
    setPopupSearch('');
    setSelectedStatus(null);
  };

  const analytics = useMemo(() => {
    const now = new Date();
    const todayIso = now.toISOString().split('T')[0];
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const toDateObj = (raw) => {
      if (!raw) return null;
      const d = new Date(raw);
      return isNaN(d.getTime()) ? null : d;
    };
    const toIsoDate = (raw) => {
      const d = toDateObj(raw);
      return d ? d.toISOString().split('T')[0] : null;
    };

    const invMap = new Map();
    for (const inv of (invList || [])) {
      const k = String(inv?.bomCode || inv?.poNo || inv?.bomId || '').trim().toLowerCase();
      if (k) invMap.set(k, inv);
    }

    const challanMap = new Map();
    for (const ch of (challansList || [])) {
      const k = String(ch?.bomCode || ch?.orderNo || ch?.poNo || '').trim().toLowerCase();
      if (k) challanMap.set(k, ch);
    }

    let orders = (bomList || []).filter(Boolean).map((b, idx) => {
      const code = b.bomCode || b.code || b.id || `BOM-${idx + 1}`;
      const codeKey = String(code).trim().toLowerCase();
      const customer = b.customerName || b.companyName || b.vendor || b.clientName || 'Customer';
      const st = String(b.status || '').toLowerCase();
      const matchedInv = invMap.get(codeKey) || null;
      const matchedChallan = challanMap.get(codeKey) || null;

      const isCancelled = Boolean(b.cancelled || b.status === 'Cancelled & Stock Restored' || st.includes('cancel'));
      const isDispatched = !isCancelled && Boolean(
        b.fullyCompleted ||
        b.vehicleLoadingVerified ||
        b.dispatchedAt ||
        b.finalDispatchedAt ||
        st === 'dispatched' ||
        st === 'closed' ||
        st.includes('fully dispatched')
      );
      const isInTransit = !isCancelled && !isDispatched && Boolean(
        st.includes('transit') ||
        st.includes('vehicle loading') ||
        b.lrNumber ||
        b.vehicleNo ||
        b.vehicleLoading?.vehicleNo
      );
      const isReadyForDispatch = !isCancelled && !isDispatched && !isInTransit && Boolean(
        b.invoiceConfirmed ||
        b.invoiceGenerated ||
        matchedInv ||
        st.includes('invoice') ||
        st.includes('awaiting vehicle') ||
        st.includes('ready for dispatch')
      );

      let bucket = 'Pending (Not Ready)';
      if (isCancelled) bucket = 'Cancelled';
      else if (isDispatched) bucket = 'Dispatched';
      else if (isInTransit) bucket = 'In Transit';
      else if (isReadyForDispatch) bucket = 'Ready for Dispatch';

      const createdD = toDateObj(b.salesConfirmedAt || b.confirmedAt || b.date || b.createdAt);
      const dispatchedD = toDateObj(b.finalDispatchedAt || b.dispatchedAt || b.vehicleLoading?.completedAt);
      const expectedD = toDateObj(b.deliveryDate || b.expectedDispatchDate || b.expectedDate);
      const plannedIso = (expectedD ? expectedD.toISOString().split('T')[0] : null) || toIsoDate(b.date || b.createdAt) || todayIso;

      const ageDays = createdD ? Math.max(0, Math.floor((now.getTime() - createdD.getTime()) / 86400000)) : 0;
      const delayDays = (!isCancelled && !isDispatched)
        ? (expectedD
            ? Math.max(0, Math.floor((now.getTime() - expectedD.getTime()) / 86400000))
            : Math.max(0, ageDays - 2))
        : 0;
      const dispatchedOnTime = isDispatched && (!expectedD || !dispatchedD || (dispatchedD.toISOString().split('T')[0] <= plannedIso));

      let delayReason = 'Pending Processing';
      if (st.includes('packing') || !b.dispatchPackingVerified) delayReason = 'Packing Pending';
      else if (!b.accountsVerified && !b.isAccountsDone) delayReason = 'Accounts Verification Pending';
      else if (!b.invoiceConfirmed && !b.invoiceGenerated && !matchedInv) delayReason = 'Invoice Pending';
      else if (!b.vehicleNo && !b.vehicleLoading?.vehicleNo) delayReason = 'Vehicle Loading Pending';

      const grandTotal = Number(b.grandTotal || matchedInv?.grandTotal || b.subTotal || 0) || 0;
      const itemsArr = Array.isArray(b.items) ? b.items : [];
      const totalQty = itemsArr.reduce((s, it) => s + (parseFloat(it.qty || it.bomQty || it.quantity || 0) || 0), 0);
      const firstProd = b.presetName || b.preset || itemsArr[0]?.name || itemsArr[0]?.description || 'Solar Structure Kit';

      const hasInvoice = Boolean(b.invoiceConfirmed || b.invoiceGenerated || b.invoiceNo || matchedInv);
      const hasEwayBill = Boolean(b.ewayBillNo || b.ewayBillDoc || matchedInv?.ewayBillNo || matchedInv?.ewayBillDoc);
      const hasLrOrDc = Boolean(b.lrNumber || b.lrDoc || b.lrCopyDoc || matchedChallan || b.docType === 'DC');
      const hasPackingList = Boolean(b.dispatchPackingVerified || b.packingVerified || st.includes('packed'));

      return {
        rawBom: b,
        code,
        customer,
        bucket,
        isCancelled,
        isDispatched,
        isInTransit,
        isReadyForDispatch,
        createdIso: createdD ? createdD.toISOString().split('T')[0] : null,
        dispatchedIso: dispatchedD ? dispatchedD.toISOString().split('T')[0] : null,
        plannedIso,
        delayDays,
        dispatchedOnTime,
        delayReason,
        grandTotal,
        totalQty,
        firstProd,
        itemsArr,
        hasInvoice,
        hasEwayBill,
        hasLrOrDc,
        hasPackingList
      };
    });

    // Localhost-only preview when local orders are empty (NEVER runs on dev/live servers)
    const isLocalhostPreview =
      typeof window !== 'undefined' &&
      ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
      orders.length === 0;

    if (isLocalhostPreview) {
      const dayIso = (ago) => {
        const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ago);
        return dt.toISOString().split('T')[0];
      };
      orders = [
        { code: 'VRMS/BOM/26-27/718', customer: 'Softrays Power Solutions', bucket: 'Dispatched', isCancelled: false, isDispatched: true, isInTransit: false, isReadyForDispatch: false, createdIso: dayIso(1), dispatchedIso: dayIso(0), plannedIso: dayIso(0), delayDays: 0, delayReason: 'On Schedule', grandTotal: 287271, totalQty: 144, firstProd: 'HAT Purlin 2x5 (1200x1800)', itemsArr: [{ name: 'HAT Purlin 2x5 (1200x1800)', qty: 144, total: 287271 }], hasInvoice: true, hasEwayBill: true, hasLrOrDc: true, hasPackingList: true },
        { code: 'VRMS/BOM/26-27/719', customer: 'Green Infra Ltd', bucket: 'Dispatched', isCancelled: false, isDispatched: true, isInTransit: false, isReadyForDispatch: false, createdIso: dayIso(2), dispatchedIso: dayIso(1), plannedIso: dayIso(1), delayDays: 0, delayReason: 'On Schedule', grandTotal: 540000, totalQty: 320, firstProd: 'Mono Rail 4200 mm (AL)', itemsArr: [{ name: 'Mono Rail 4200 mm (AL)', qty: 320, total: 540000 }], hasInvoice: true, hasEwayBill: true, hasLrOrDc: true, hasPackingList: true },
        { code: 'VRMS/BOM/26-27/720', customer: 'ABC Solar Pvt Ltd', bucket: 'Dispatched', isCancelled: false, isDispatched: true, isInTransit: false, isReadyForDispatch: false, createdIso: dayIso(4), dispatchedIso: dayIso(2), plannedIso: dayIso(2), delayDays: 0, delayReason: 'On Schedule', grandTotal: 785000, totalQty: 500, firstProd: 'LEG 1500 mm (HDG)', itemsArr: [{ name: 'LEG 1500 mm (HDG)', qty: 500, total: 785000 }], hasInvoice: true, hasEwayBill: true, hasLrOrDc: true, hasPackingList: true },
        { code: 'VRMS/BOM/26-27/721', customer: 'Sun Power EPC', bucket: 'In Transit', isCancelled: false, isDispatched: false, isInTransit: true, isReadyForDispatch: false, createdIso: dayIso(4), dispatchedIso: null, plannedIso: dayIso(0), delayDays: 2, delayReason: 'In Transit — ETA Today', grandTotal: 420000, totalQty: 260, firstProd: 'Mid Clamp 35mm Anodized', itemsArr: [{ name: 'Mid Clamp 35mm Anodized', qty: 260, total: 420000 }], hasInvoice: true, hasEwayBill: true, hasLrOrDc: true, hasPackingList: true },
        { code: 'VRMS/BOM/26-27/722', customer: 'Bright Energy', bucket: 'Ready for Dispatch', isCancelled: false, isDispatched: false, isInTransit: false, isReadyForDispatch: true, createdIso: dayIso(5), dispatchedIso: null, plannedIso: dayIso(0), delayDays: 3, delayReason: 'Vehicle Loading Pending', grandTotal: 365000, totalQty: 180, firstProd: 'Rafter 4300 mm (GAL)', itemsArr: [{ name: 'Rafter 4300 mm (GAL)', qty: 180, total: 365000 }], hasInvoice: true, hasEwayBill: false, hasLrOrDc: false, hasPackingList: true },
        { code: 'VRMS/BOM/26-27/723', customer: 'Voltix Solutions', bucket: 'Pending (Not Ready)', isCancelled: false, isDispatched: false, isInTransit: false, isReadyForDispatch: false, createdIso: dayIso(6), dispatchedIso: null, plannedIso: dayIso(0), delayDays: 4, delayReason: 'Packing Pending', grandTotal: 195000, totalQty: 120, firstProd: 'End Clamp L-Foot Kit', itemsArr: [{ name: 'End Clamp L-Foot Kit', qty: 120, total: 195000 }], hasInvoice: false, hasEwayBill: false, hasLrOrDc: false, hasPackingList: false },
        { code: 'VRMS/BOM/26-27/724', customer: 'KPR Mill Solar', bucket: 'Dispatched', isCancelled: false, isDispatched: true, isInTransit: false, isReadyForDispatch: false, createdIso: dayIso(5), dispatchedIso: dayIso(3), plannedIso: dayIso(3), delayDays: 0, delayReason: 'On Schedule', grandTotal: 615000, totalQty: 410, firstProd: 'HAT Purlin 2x5 (1200x1800)', itemsArr: [{ name: 'HAT Purlin 2x5 (1200x1800)', qty: 410, total: 615000 }], hasInvoice: true, hasEwayBill: true, hasLrOrDc: true, hasPackingList: true }
      ];
    }

    const totalOrders = orders.length;
    const dispatchedCount = orders.filter(o => o.isDispatched).length;
    const inQueueCount = orders.filter(o => !o.isCancelled && !o.isDispatched).length;

    // 1. DISPATCH STATUS
    const statusDefs = [
      { name: 'Dispatched', color: '#059669' },
      { name: 'In Transit', color: '#2563EB' },
      { name: 'Ready for Dispatch', color: '#D97706' },
      { name: 'Pending (Not Ready)', color: '#7C3AED' },
      { name: 'Cancelled', color: '#DC2626' }
    ];
    const statusSegments = statusDefs.map(sd => {
      const list = orders.filter(o => o.bucket === sd.name);
      return {
        ...sd,
        value: list.length,
        orders: list,
        pct: totalOrders > 0 ? ((list.length / totalOrders) * 100).toFixed(1) : '0.0'
      };
    });

    // 2. DAILY DISPATCH TREND (Last 7 Days — configured with BOM Expected Date `deliveryDate`)
    const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dailyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const label = `${String(d.getDate()).padStart(2, '0')} ${monthShort[d.getMonth()]}`;
      const dayDispatched = orders.filter(o => o.isDispatched && (o.dispatchedIso === iso || (!o.dispatchedIso && o.plannedIso === iso)));
      const dayExpected = orders.filter(o => !o.isCancelled && o.plannedIso === iso);
      const onTimeCount = dayDispatched.filter(o => o.dispatchedOnTime !== false).length;
      const onTimePct = dayDispatched.length > 0
        ? Math.round((onTimeCount / dayDispatched.length) * 100)
        : (dayExpected.length > 0 ? 0 : 100);
      dailyTrend.push({
        iso,
        label,
        dispatchedCount: dayDispatched.length,
        plannedCount: dayExpected.length,
        onTimePct,
        valueSum: dayDispatched.reduce((s, o) => s + o.grandTotal, 0)
      });
    }

    // 3. TOP 5 DELAYED DISPATCH ORDERS
    const delayedOrders = orders
      .filter(o => !o.isCancelled && !o.isDispatched && o.delayDays > 0)
      .sort((a, b) => b.delayDays - a.delayDays)
      .slice(0, 5);

    // 4. DISPATCH BY PRODUCT / PROFILE (MTD)
    const mtdDispatched = orders.filter(o =>
      o.isDispatched && ((o.dispatchedIso || o.createdIso || '').startsWith(currentMonthKey))
    );
    const prodSource = mtdDispatched.length > 0 ? mtdDispatched : orders.filter(o => o.isDispatched);
    const prodMap = new Map();
    for (const o of prodSource) {
      if (o.itemsArr.length > 0) {
        for (const it of o.itemsArr) {
          const pName = it.name || it.description || o.firstProd;
          const q = parseFloat(it.qty || it.bomQty || it.quantity || 0) || 0;
          const v = parseFloat(it.total || it.amount || (q * (parseFloat(it.rate || it.price || 0) || 0))) || 0;
          const cur = prodMap.get(pName) || { name: pName, ordersMap: new Map(), qty: 0, value: 0 };
          cur.ordersMap.set(o.code, o);
          cur.qty += q;
          cur.value += v;
          prodMap.set(pName, cur);
        }
      } else {
        const cur = prodMap.get(o.firstProd) || { name: o.firstProd, ordersMap: new Map(), qty: 0, value: 0 };
        cur.ordersMap.set(o.code, o);
        cur.qty += o.totalQty;
        cur.value += o.grandTotal;
        prodMap.set(o.firstProd, cur);
      }
    }
    // Seed all known products from BOMs & inventoryList so the Filter popup lists every product
    for (const o of orders) {
      if (o.itemsArr.length > 0) {
        for (const it of o.itemsArr) {
          const pName = it.name || it.description || o.firstProd;
          if (pName && !prodMap.has(pName)) {
            prodMap.set(pName, { name: pName, ordersMap: new Map(), qty: 0, value: 0 });
          }
        }
      } else if (o.firstProd && !prodMap.has(o.firstProd)) {
        prodMap.set(o.firstProd, { name: o.firstProd, ordersMap: new Map(), qty: 0, value: 0 });
      }
    }
    for (const invIt of (inventoryList || [])) {
      const pName = invIt?.name || invIt?.itemName || invIt?.description;
      if (pName && !prodMap.has(pName)) {
        prodMap.set(pName, { name: pName, ordersMap: new Map(), qty: 0, value: 0 });
      }
    }

    const productBreakdown = Array.from(prodMap.values())
      .map(p => ({ name: p.name, orders: p.ordersMap.size, orderList: Array.from(p.ordersMap.values()), qty: p.qty, value: p.value }))
      .sort((a, b) => (b.value - a.value) || String(a.name).localeCompare(String(b.name)));

    // 5. TODAY'S DISPATCH PLAN
    const todaysPlan = orders
      .filter(o => !o.isCancelled && (o.plannedIso === todayIso || o.dispatchedIso === todayIso || o.isReadyForDispatch || o.isInTransit))
      .slice(0, 8);

    // 6. DOCUMENT CHECKLIST (Today)
    const docBase = todaysPlan.length > 0 ? todaysPlan : orders.filter(o => !o.isCancelled).slice(0, 20);
    const reqCount = docBase.length;
    const mkDocRow = (label, fn) => {
      const done = docBase.filter(fn).length;
      const pendingOrders = docBase.filter(o => !fn(o));
      const pct = reqCount > 0 ? Math.round((done / reqCount) * 100) : 100;
      return { label, required: reqCount, completed: done, pending: pendingOrders.length, pendingOrders, pct };
    };
    const docChecklist = [
      mkDocRow('Invoice', o => o.hasInvoice),
      mkDocRow('E-Way Bill', o => o.hasEwayBill),
      mkDocRow('LR / Delivery Challan', o => o.hasLrOrDc),
      mkDocRow('Packing List', o => o.hasPackingList)
    ];

    // 7. KEY ALERTS
    const overdueOrders = orders.filter(o => !o.isCancelled && !o.isDispatched && o.delayDays > 0);
    const invPendingOrders = orders.filter(o => !o.isCancelled && !o.isDispatched && !o.hasInvoice);
    const packingPendingOrders = orders.filter(o => !o.isCancelled && !o.isDispatched && !o.hasPackingList);
    const vehiclePendingOrders = orders.filter(o => !o.isCancelled && !o.isDispatched && o.hasInvoice && !o.isInTransit);

    const keyAlerts = [
      {
        title: 'Overdue Dispatches',
        sub: `${overdueOrders.length} orders past SLA (>2 days)`,
        badge: `${overdueOrders.length} Orders`,
        color: '#DC2626',
        bg: '#FEF2F2',
        border: '#FECACA',
        icon: ShieldAlert,
        orders: overdueOrders
      },
      {
        title: 'Invoices Pending',
        sub: `${invPendingOrders.length} orders awaiting billing`,
        badge: `${invPendingOrders.length} Orders`,
        color: '#D97706',
        bg: '#FFFBEB',
        border: '#FDE68A',
        icon: FileCheck,
        orders: invPendingOrders
      },
      {
        title: 'Packing Pending',
        sub: `${packingPendingOrders.length} orders awaiting packing`,
        badge: `${packingPendingOrders.length} Orders`,
        color: '#7C3AED',
        bg: '#F5F3FF',
        border: '#DDD6FE',
        icon: Package,
        orders: packingPendingOrders
      },
      {
        title: 'Vehicle Loading Pending',
        sub: `${vehiclePendingOrders.length} invoiced orders waiting vehicle`,
        badge: `${vehiclePendingOrders.length} Orders`,
        color: '#0E7490',
        bg: '#ECFEFF',
        border: '#A5F3FC',
        icon: Truck,
        orders: vehiclePendingOrders
      }
    ];

    return {
      totalOrders,
      dispatchedCount,
      inQueueCount,
      statusSegments,
      dailyTrend,
      delayedOrders,
      productBreakdown,
      todaysPlan,
      docChecklist,
      keyAlerts
    };
  }, [bomList, challansList, invList, inventoryList]);

  const maxDailyCount = Math.max(1, ...analytics.dailyTrend.map(d => d.dispatchedCount));
  const peakDay = analytics.dailyTrend.reduce((best, d) => (d.dispatchedCount >= best.dispatchedCount ? d : best), analytics.dailyTrend[0] || { label: '—', dispatchedCount: 0 });
  const activeDayIdx = selectedDayIdx !== null && analytics.dailyTrend[selectedDayIdx]
    ? selectedDayIdx
    : Math.max(0, analytics.dailyTrend.length - 1);
  const activeDay = analytics.dailyTrend[activeDayIdx] || { label: '—', dispatchedCount: 0, plannedCount: 0, onTimePct: 100, valueSum: 0 };
  const activeStatusSeg = selectedStatus ? analytics.statusSegments.find(s => s.name === selectedStatus) || null : null;

  const statusBadgeStyle = (bucket) => {
    if (bucket === 'Dispatched') return { bg: '#DCFCE7', fg: '#15803D', border: '#BBF7D0' };
    if (bucket === 'In Transit') return { bg: '#DBEAFE', fg: '#1D4ED8', border: '#BFDBFE' };
    if (bucket === 'Ready for Dispatch') return { bg: '#FEF3C7', fg: '#B45309', border: '#FDE68A' };
    if (bucket === 'Cancelled') return { bg: '#FEE2E2', fg: '#DC2626', border: '#FECACA' };
    return { bg: '#F3E8FF', fg: '#7E22CE', border: '#E9D5FF' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ROW 1: DISPATCH STATUS (DONUT) + DAILY DISPATCH TREND (ORDERS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {/* 1. DISPATCH STATUS */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={cardTitleStyle}>Dispatch Status</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#0E7490',
                backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                {analytics.totalOrders} Total Orders
              </span>
            </div>
            <Truck size={15} color="#0E7490" />
          </div>

          <div style={summaryStripStyle}>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Total Orders</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>{analytics.totalOrders}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Dispatched</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#059669' }}>{analytics.dispatchedCount}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>In Queue</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#D97706' }}>{analytics.inQueueCount}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, minHeight: '150px' }}>
            <DonutChartSvg
              segments={analytics.statusSegments}
              centerLabel={activeStatusSeg ? activeStatusSeg.value : analytics.totalOrders}
              centerSub={activeStatusSeg ? `${activeStatusSeg.pct}% Share` : 'Total Orders'}
              activeName={selectedStatus}
              onSelectSegment={(name) => {
                const seg = analytics.statusSegments.find(s => s.name === name);
                setSelectedStatus(name);
                if (seg) {
                  setPopupSearch('');
                  setOrdersPopup({ title: `Dispatch Status: ${seg.name}`, color: seg.color, orders: seg.orders });
                }
              }}
            />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '5px', justifyContent: 'center' }}>
              {analytics.statusSegments.map((seg, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedStatus(seg.name);
                    setPopupSearch('');
                    setOrdersPopup({ title: `Dispatch Status: ${seg.name}`, color: seg.color, orders: seg.orders });
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: '3px',
                    width: '100%', textAlign: 'left', padding: '5px 8px',
                    borderRadius: '8px',
                    border: selectedStatus === seg.name ? `1.5px solid ${seg.color}` : '1px solid transparent',
                    backgroundColor: selectedStatus === seg.name ? '#F8FAFC' : 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span style={{ width: '9px', height: '9px', borderRadius: '3px', backgroundColor: seg.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{seg.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontWeight: '800', color: '#0F172A' }}>{seg.value}</span>
                      <span style={{ fontSize: '10px', fontWeight: '800', color: seg.color, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', padding: '1px 6px', borderRadius: '6px' }}>
                        {seg.pct}%
                      </span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '4px', backgroundColor: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Math.max(seg.value > 0 ? 3 : 0, Number(seg.pct)))}%`, height: '100%', backgroundColor: seg.color, borderRadius: '999px' }} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. DAILY DISPATCH TREND (Orders) */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={cardTitleStyle}>Daily Dispatch Trend (Orders)</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#059669',
                backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                BOM Expected Date
              </span>
            </div>
            <Calendar size={15} color="#0E7490" />
          </div>

          <div style={summaryStripStyle}>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>{activeDay.label} Orders</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>{activeDay.dispatchedCount}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>On-Time %</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#059669' }}>{activeDay.onTimePct}%</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>7-Day Peak</div>
              <div style={{ fontSize: '13px', fontWeight: '900', color: '#0E7490' }}>{peakDay.label} ({peakDay.dispatchedCount})</div>
            </div>
          </div>

          <div style={{ position: 'relative', flex: 1, minHeight: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingTop: '12px' }}>
            <div style={{ position: 'absolute', inset: '14px 0 24px 0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
              <div style={{ borderTop: '1px dashed #E2E8F0', width: '100%' }} />
              <div style={{ borderTop: '1px dashed #E2E8F0', width: '100%' }} />
              <div style={{ borderTop: '1px solid #E2E8F0', width: '100%' }} />
            </div>

            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', height: '100%' }}>
              {analytics.dailyTrend.map((d, idx) => {
                const isSelected = idx === activeDayIdx;
                const barH = d.dispatchedCount > 0 ? Math.max(18, Math.round((d.dispatchedCount / maxDailyCount) * 86)) : 6;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDayIdx(idx)}
                    style={{
                      flex: 1, border: 'none',
                      background: isSelected ? '#ECFEFF' : 'transparent',
                      borderRadius: '10px', padding: '4px 2px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                      gap: '4px', height: '100%', cursor: 'pointer'
                    }}
                  >
                    <span style={{ fontSize: '9.5px', fontWeight: '800', color: '#059669' }}>{d.onTimePct}%</span>
                    <div style={{
                      width: '100%', maxWidth: '30px', height: `${barH}px`,
                      background: d.dispatchedCount <= 0 ? '#CBD5E1' : (isSelected ? 'linear-gradient(180deg, #0E7490 0%, #075985 100%)' : '#93C5FD'),
                      borderRadius: '6px 6px 2px 2px',
                      boxShadow: isSelected && d.dispatchedCount > 0 ? '0 4px 10px rgba(14, 116, 144, 0.25)' : 'none'
                    }} />
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#0F172A' }}>{d.dispatchedCount}</span>
                    <span style={{ fontSize: '9.5px', fontWeight: isSelected ? '800' : '600', color: isSelected ? '#0E7490' : '#64748B' }}>{d.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px dashed #E2E8F0', display: 'flex', justifyContent: 'space-between', fontSize: '11px', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontWeight: '700', color: '#475569' }}>
              <strong style={{ color: '#0F172A' }}>{activeDay.label}:</strong> {activeDay.dispatchedCount} Dispatched • {activeDay.plannedCount} Expected (BOM)
            </span>
            <span style={{ fontWeight: '800', color: '#059669' }}>
              Value: {formatINRCompact(activeDay.valueSum)}
            </span>
          </div>
        </div>
      </div>

      {/* ROW 2: TOP 5 DELAYED DISPATCH ORDERS + DISPATCH BY PRODUCT / PROFILE (MTD) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {/* 3. TOP 5 DELAYED DISPATCH ORDERS */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Top 5 Delayed Dispatch Orders</span>
              <span style={{
                fontSize: '10px', fontWeight: '800',
                color: analytics.delayedOrders.length > 0 ? '#DC2626' : '#059669',
                backgroundColor: analytics.delayedOrders.length > 0 ? '#FEF2F2' : '#ECFDF5',
                border: `1px solid ${analytics.delayedOrders.length > 0 ? '#FECACA' : '#A7F3D0'}`,
                padding: '2px 8px', borderRadius: '999px'
              }}>
                {analytics.delayedOrders.length} Delayed
              </span>
            </div>
            <Clock size={15} color="#DC2626" />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '7px 6px' }}>Order No.</th>
                  <th style={{ padding: '7px 6px' }}>Customer</th>
                  <th style={{ padding: '7px 6px', textAlign: 'center' }}>Delay</th>
                  <th style={{ padding: '7px 6px' }}>Reason</th>
                  <th style={{ padding: '7px 6px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {analytics.delayedOrders.length > 0 ? analytics.delayedOrders.map((o, idx) => (
                  <tr
                    key={idx}
                    onClick={() => {
                      if (onOpenBom) {
                        onOpenBom(o.rawBom || { bomCode: o.code, code: o.code, customerName: o.customer, status: o.bucket, grandTotal: o.grandTotal, items: o.itemsArr, deliveryDate: o.plannedIso });
                      } else {
                        setPopupSearch('');
                        setOrdersPopup({ title: `Delayed Order: ${o.code}`, color: '#DC2626', orders: [o] });
                      }
                    }}
                    style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '7px 6px', fontWeight: '800', color: '#0E7490', whiteSpace: 'nowrap', textDecoration: 'underline' }}>{o.code}</td>
                    <td style={{ padding: '7px 6px', fontWeight: '700', color: '#0F172A' }}>{o.customer}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'center', fontWeight: '800', color: '#DC2626' }}>{o.delayDays}d</td>
                    <td style={{ padding: '7px 6px', color: '#475569' }}>{o.delayReason}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: '9.5px', fontWeight: '800', padding: '2px 7px', borderRadius: '999px',
                        backgroundColor: o.delayDays >= 3 ? '#FEE2E2' : '#FEF3C7',
                        color: o.delayDays >= 3 ? '#DC2626' : '#B45309'
                      }}>
                        {o.delayDays >= 3 ? 'Overdue' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} style={{ padding: '22px', textAlign: 'center', color: '#059669', fontWeight: '700' }}>
                      No delayed dispatch orders — all orders on schedule.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. DISPATCH BY PRODUCT / PROFILE (MTD) */}
        {(() => {
          const defaultTop5 = analytics.productBreakdown.slice(0, 5);
          const visibleProducts = selectedProductNames !== null
            ? analytics.productBreakdown.filter(p => selectedProductNames.includes(p.name)).slice(0, 5)
            : defaultTop5;
          const activeCount = selectedProductNames !== null ? visibleProducts.length : defaultTop5.length;

          return (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={cardTitleStyle}>Dispatch by Product / Profile (MTD)</span>
                  <span style={{
                    fontSize: '10px', fontWeight: '800', color: '#0E7490',
                    backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC',
                    padding: '2px 8px', borderRadius: '999px'
                  }}>
                    Top {activeCount} of {analytics.productBreakdown.length}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setProductFilterSearch('');
                      setProductFilterOpen(true);
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      border: '1px solid #A5F3FC', backgroundColor: '#ECFEFF', color: '#0E7490',
                      fontSize: '10.5px', fontWeight: '800', padding: '4px 10px',
                      borderRadius: '8px', cursor: 'pointer'
                    }}
                  >
                    <SlidersHorizontal size={12} />
                    Filter ({activeCount}/5)
                  </button>
                  <Package size={15} color="#0E7490" />
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '7px 6px' }}>Product / Profile</th>
                      <th style={{ padding: '7px 6px', textAlign: 'right' }}>Orders</th>
                      <th style={{ padding: '7px 6px', textAlign: 'right' }}>Qty</th>
                      <th style={{ padding: '7px 6px', textAlign: 'right' }}>Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProducts.length > 0 ? visibleProducts.map((p, idx) => (
                      <tr
                        key={idx}
                        onClick={() => {
                          setPopupSearch('');
                          setOrdersPopup({ title: `Product: ${p.name}`, color: '#0E7490', orders: p.orderList });
                        }}
                        style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '7px 6px', fontWeight: '700', color: '#0F172A' }}>{p.name}</td>
                        <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: '700', color: '#0E7490' }}>{p.orders}</td>
                        <td style={{ padding: '7px 6px', textAlign: 'right', color: '#475569', fontWeight: '600' }}>{p.qty.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>{formatINRCompact(p.value)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} style={{ padding: '22px', textAlign: 'center', color: '#64748B', fontWeight: '600' }}>
                          {analytics.productBreakdown.length > 0
                            ? 'No products selected — click Filter to choose up to 5 products.'
                            : 'No dispatched product profiles recorded yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ROW 3: TODAY'S DISPATCH PLAN (FULL WIDTH) */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={cardTitleStyle}>Today&apos;s Dispatch Plan</span>
            <span style={{
              fontSize: '10px', fontWeight: '800', color: '#0E7490',
              backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC',
              padding: '2px 8px', borderRadius: '999px'
            }}>
              {analytics.todaysPlan.length} Orders
            </span>
          </div>
          <Truck size={15} color="#059669" />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '8px 8px' }}>Order No.</th>
                <th style={{ padding: '8px 8px' }}>Customer</th>
                <th style={{ padding: '8px 8px' }}>Product / Item</th>
                <th style={{ padding: '8px 8px', textAlign: 'right' }}>Qty (Nos)</th>
                <th style={{ padding: '8px 8px', textAlign: 'right' }}>Value</th>
                <th style={{ padding: '8px 8px', textAlign: 'center' }}>Planned Date</th>
                <th style={{ padding: '8px 8px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {analytics.todaysPlan.length > 0 ? analytics.todaysPlan.map((o, idx) => {
                const badge = statusBadgeStyle(o.bucket);
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 8px', fontWeight: '800', color: '#0E7490', whiteSpace: 'nowrap' }}>{o.code}</td>
                    <td style={{ padding: '8px 8px', fontWeight: '700', color: '#0F172A' }}>{o.customer}</td>
                    <td style={{ padding: '8px 8px', color: '#475569' }}>{o.firstProd}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: '700' }}>{o.totalQty.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>{formatINRCompact(o.grandTotal)}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'center', color: '#64748B', fontWeight: '600' }}>{o.plannedIso}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '999px',
                        backgroundColor: badge.bg, color: badge.fg, border: `1px solid ${badge.border}`
                      }}>
                        {o.bucket}
                      </span>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} style={{ padding: '22px', textAlign: 'center', color: '#64748B', fontWeight: '600' }}>
                    No dispatch orders scheduled for today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ROW 4: DOCUMENT CHECKLIST (TODAY) + KEY ALERTS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {/* 6. DOCUMENT CHECKLIST (Today) */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Document Checklist (Today)</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#059669',
                backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                Compliance Audit
              </span>
            </div>
            <CheckCircle size={15} color="#059669" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, justifyContent: 'center' }}>
            {analytics.docChecklist.map((doc, idx) => {
              const canOpen = doc.pendingOrders.length > 0;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!canOpen}
                  onClick={() => {
                    if (!canOpen) return;
                    setPopupSearch('');
                    setOrdersPopup({ title: `Missing Document: ${doc.label}`, color: '#DC2626', orders: doc.pendingOrders });
                  }}
                  style={{
                    border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', borderRadius: '10px',
                    padding: '9px 12px', width: '100%', textAlign: 'left',
                    display: 'flex', flexDirection: 'column', gap: '6px',
                    cursor: canOpen ? 'pointer' : 'default'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', gap: '8px' }}>
                    <span style={{ fontWeight: '800', color: '#0F172A' }}>{doc.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#059669' }}>{doc.completed}/{doc.required} Done</span>
                      <span style={{
                        fontSize: '10px', fontWeight: '800', padding: '1px 7px', borderRadius: '999px',
                        backgroundColor: doc.pending > 0 ? '#FEF2F2' : '#ECFDF5',
                        color: doc.pending > 0 ? '#DC2626' : '#059669',
                        border: `1px solid ${doc.pending > 0 ? '#FECACA' : '#A7F3D0'}`
                      }}>
                        {doc.pending > 0 ? `${doc.pending} Pending` : '100% Ready'}
                      </span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${doc.pct}%`, height: '100%', backgroundColor: doc.pending > 0 ? '#0E7490' : '#059669', borderRadius: '999px' }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 7. KEY ALERTS */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Key Alerts</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#DC2626',
                backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                {analytics.keyAlerts.reduce((s, a) => s + a.orders.length, 0)} Alerts
              </span>
            </div>
            <AlertTriangle size={15} color="#DC2626" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'center' }}>
            {analytics.keyAlerts.map((al, idx) => {
              const IconComp = al.icon;
              const canOpen = al.orders.length > 0;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!canOpen}
                  onClick={() => {
                    if (!canOpen) return;
                    setPopupSearch('');
                    setOrdersPopup({ title: `Alert: ${al.title}`, color: al.color, orders: al.orders });
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '10px', width: '100%', textAlign: 'left',
                    padding: '9px 12px', borderRadius: '10px',
                    backgroundColor: al.bg, border: `1px solid ${al.border}`,
                    cursor: canOpen ? 'pointer' : 'default'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <IconComp size={15} color={al.color} style={{ flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>{al.title}</div>
                      <div style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748B' }}>{al.sub}</div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '10.5px', fontWeight: '800', color: al.color,
                    backgroundColor: '#FFFFFF', border: `1px solid ${al.border}`,
                    padding: '2px 8px', borderRadius: '999px', whiteSpace: 'nowrap'
                  }}>
                    {al.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* PRODUCT / PROFILE FILTER MODAL (MAX 5) */}
      {productFilterOpen && (() => {
        const currentList = selectedProductNames !== null
          ? selectedProductNames
          : analytics.productBreakdown.slice(0, 5).map(p => p.name);
        const pq = productFilterSearch.trim().toLowerCase();
        const filteredProds = analytics.productBreakdown.filter(p =>
          !pq || String(p.name || '').toLowerCase().includes(pq)
        );
        const toggleProd = (name) => {
          if (currentList.includes(name)) {
            updateSelectedProducts(currentList.filter(n => n !== name));
          } else if (currentList.length < 5) {
            updateSelectedProducts([...currentList, name]);
          }
        };

        return (
          <div
            onClick={() => setProductFilterOpen(false)}
            style={{
              position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(3px)', zIndex: 99999,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#FFFFFF', borderRadius: '18px', width: '560px', maxWidth: '100%',
                maxHeight: '82vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)', border: '1px solid #E2E8F0', overflow: 'hidden'
              }}
            >
              <div style={{
                padding: '14px 20px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px'
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>
                    Select Products / Profiles (Max 5)
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', marginTop: '2px' }}>
                    {currentList.length} / 5 selected — deselect one to add another
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => updateSelectedProducts(null)}
                    style={{
                      border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569',
                      fontSize: '10.5px', fontWeight: '700', padding: '5px 10px', borderRadius: '8px', cursor: 'pointer'
                    }}
                  >
                    Reset Top 5
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductFilterOpen(false)}
                    style={{
                      border: 'none', backgroundColor: '#E2E8F0', color: '#475569',
                      width: '30px', height: '30px', borderRadius: '8px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div style={{ padding: '12px 20px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '10px', padding: '7px 12px'
                }}>
                  <Search size={14} color="#64748B" />
                  <input
                    type="text"
                    value={productFilterSearch}
                    onChange={(e) => setProductFilterSearch(e.target.value)}
                    placeholder="Search product / profile name..."
                    style={{ border: 'none', background: 'none', outline: 'none', width: '100%', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}
                  />
                </div>
              </div>

              <div style={{ overflowY: 'auto', padding: '10px 20px 16px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {filteredProds.length > 0 ? filteredProds.map((p, idx) => {
                  const isChecked = currentList.includes(p.name);
                  const isDisabled = !isChecked && currentList.length >= 5;
                  return (
                    <label
                      key={idx}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                        padding: '8px 12px', borderRadius: '10px',
                        border: isChecked ? '1.5px solid #0E7490' : '1px solid #E2E8F0',
                        backgroundColor: isChecked ? '#ECFEFF' : (isDisabled ? '#F8FAFC' : '#FFFFFF'),
                        opacity: isDisabled ? 0.55 : 1,
                        cursor: isDisabled ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isDisabled}
                          onChange={() => toggleProd(p.name)}
                          style={{ accentColor: '#0E7490', width: '15px', height: '15px', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.name}
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '600' }}>
                            {p.orders} {p.orders === 1 ? 'Order' : 'Orders'} • {p.qty.toLocaleString('en-IN')} Qty
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#0E7490', flexShrink: 0 }}>
                        {formatINRCompact(p.value)}
                      </span>
                    </label>
                  );
                }) : (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748B', fontSize: '12px', fontWeight: '600' }}>
                    No matching products found.
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ORDERS DRILLDOWN POPUP MODAL */}
      {ordersPopup && (() => {
        const q = popupSearch.trim().toLowerCase();
        const filtered = (ordersPopup.orders || []).filter(o =>
          !q ||
          String(o.code || '').toLowerCase().includes(q) ||
          String(o.customer || '').toLowerCase().includes(q) ||
          String(o.firstProd || '').toLowerCase().includes(q)
        );
        return (
          <div
            onClick={closePopup}
            style={{
              position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(3px)', zIndex: 99999,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#FFFFFF', borderRadius: '18px', width: '820px', maxWidth: '100%',
                maxHeight: '84vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)', border: '1px solid #E2E8F0', overflow: 'hidden'
              }}
            >
              <div style={{
                padding: '14px 20px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '11px', height: '11px', borderRadius: '4px', backgroundColor: ordersPopup.color }} />
                  <span style={{ fontSize: '15px', fontWeight: '900', color: '#0F172A' }}>{ordersPopup.title}</span>
                  <span style={{
                    fontSize: '10.5px', fontWeight: '800', color: ordersPopup.color,
                    backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', padding: '2px 8px', borderRadius: '999px'
                  }}>
                    {ordersPopup.orders.length} Orders
                  </span>
                </div>
                <button
                  type="button"
                  onClick={closePopup}
                  style={{
                    border: 'none', backgroundColor: '#E2E8F0', color: '#475569',
                    width: '30px', height: '30px', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: '12px 20px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '10px', padding: '7px 12px'
                }}>
                  <Search size={14} color="#64748B" />
                  <input
                    type="text"
                    value={popupSearch}
                    onChange={(e) => setPopupSearch(e.target.value)}
                    placeholder="Search order no, customer, or product..."
                    style={{ border: 'none', background: 'none', outline: 'none', width: '100%', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}
                  />
                </div>
              </div>

              <div style={{ overflowY: 'auto', padding: '12px 20px 18px 20px' }}>
                {filtered.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid #E2E8F0', color: '#64748B', fontSize: '10px', textTransform: 'uppercase' }}>
                        <th style={{ textAlign: 'left', padding: '8px 6px' }}>Order No.</th>
                        <th style={{ textAlign: 'left', padding: '8px 6px' }}>Customer</th>
                        <th style={{ textAlign: 'left', padding: '8px 6px' }}>Product / Kit</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px' }}>Qty</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px' }}>Value</th>
                        <th style={{ textAlign: 'center', padding: '8px 6px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((o, idx) => {
                        const badge = statusBadgeStyle(o.bucket);
                        const handleOpenOrderBom = () => {
                          if (!onOpenBom) return;
                          closePopup();
                          onOpenBom(o.rawBom || { bomCode: o.code, code: o.code, customerName: o.customer, status: o.bucket, grandTotal: o.grandTotal, items: o.itemsArr, deliveryDate: o.plannedIso });
                        };
                        return (
                          <tr
                            key={idx}
                            onClick={handleOpenOrderBom}
                            style={{ borderBottom: '1px solid #F1F5F9', cursor: onOpenBom ? 'pointer' : 'default' }}
                          >
                            <td style={{ padding: '8px 6px', fontWeight: '800', color: '#0E7490', whiteSpace: 'nowrap', textDecoration: onOpenBom ? 'underline' : 'none' }}>
                              {o.code}
                            </td>
                            <td style={{ padding: '8px 6px', fontWeight: '700', color: '#0F172A' }}>{o.customer}</td>
                            <td style={{ padding: '8px 6px', color: '#475569' }}>{o.firstProd}</td>
                            <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: '700' }}>{o.totalQty.toLocaleString('en-IN')}</td>
                            <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: '800' }}>{formatINRCompact(o.grandTotal)}</td>
                            <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                              <span style={{
                                fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '999px',
                                backgroundColor: badge.bg, color: badge.fg, border: `1px solid ${badge.border}`
                              }}>
                                {o.bucket}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748B', fontSize: '12.5px', fontWeight: '600' }}>
                    No matching orders found.
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
