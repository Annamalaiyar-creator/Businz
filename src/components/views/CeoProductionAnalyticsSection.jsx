import React, { useMemo, useState } from 'react';
import {
  Factory, Clock, AlertTriangle, ShieldAlert, CheckCircle2,
  Package, X, Search, Calendar, SlidersHorizontal, PauseCircle
} from 'lucide-react';

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
        <div style={{ fontSize: '13px', fontWeight: '900', color: '#0F172A', lineHeight: 1.1 }}>{centerLabel}</div>
        <div style={{ fontSize: '9.5px', fontWeight: '600', color: '#64748B', marginTop: '2px' }}>{centerSub}</div>
      </div>
    </div>
  );
};

export default function CeoProductionAnalyticsSection({
  workOrdersList = [],
  bomList = [],
  inventoryList = []
}) {
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedQuality, setSelectedQuality] = useState(null);
  const [selectedDayIdx, setSelectedDayIdx] = useState(null);
  const [ordersPopup, setOrdersPopup] = useState(null);
  const [popupSearch, setPopupSearch] = useState('');
  const [selectedProductNames, setSelectedProductNames] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('businz_ceo_prod_selected_products') : null;
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
      if (next === null) localStorage.removeItem('businz_ceo_prod_selected_products');
      else localStorage.setItem('businz_ceo_prod_selected_products', JSON.stringify(next));
    } catch (_) {}
  };

  const closePopup = () => {
    setOrdersPopup(null);
    setPopupSearch('');
    setSelectedStatus(null);
    setSelectedQuality(null);
  };

  const analytics = useMemo(() => {
    const now = new Date();
    const todayIso = now.toISOString().split('T')[0];

    const toDateObj = (raw) => {
      if (!raw) return null;
      const d = new Date(raw);
      return isNaN(d.getTime()) ? null : d;
    };
    const toIso = (raw) => {
      const d = toDateObj(raw);
      return d ? d.toISOString().split('T')[0] : null;
    };

    let orders = (workOrdersList || []).filter(Boolean).map((wo, idx) => {
      const code = wo.woNo || wo.workOrderNo || wo.code || wo.id || `WO-${idx + 1}`;
      const product = wo.productName || wo.product || wo.itemName || wo.profile || wo.presetName || (Array.isArray(wo.items) && wo.items[0]?.name) || 'Solar Structure Component';
      const st = String(wo.status || '').toLowerCase();

      const plannedQty = parseFloat(wo.plannedQty ?? wo.targetQty ?? wo.qty ?? wo.quantity ?? 0) || 0;
      const completedQty = parseFloat(wo.completedQty ?? wo.producedQty ?? wo.actualQty ?? (st.includes('complete') || st.includes('done') ? plannedQty : 0)) || 0;
      const rejectedQty = parseFloat(wo.rejectedQty ?? wo.scrapQty ?? wo.defects ?? 0) || 0;
      const goodQty = Math.max(0, completedQty - rejectedQty);

      const createdD = toDateObj(wo.date || wo.startDate || wo.createdAt);
      const dueD = toDateObj(wo.dueDate || wo.targetDate || wo.expectedDate || wo.deliveryDate);
      const dateIso = toIso(wo.completedAt || wo.date || wo.createdAt) || todayIso;

      const isCompleted = st.includes('complete') || st.includes('finish') || st.includes('done') || (plannedQty > 0 && completedQty >= plannedQty);
      const isOnHold = !isCompleted && (st.includes('hold') || st.includes('pause') || st.includes('block'));
      const isDelayed = !isCompleted && !isOnHold && dueD && now.getTime() > dueD.getTime();
      const isInProgress = !isCompleted && !isOnHold && !isDelayed && (st.includes('progress') || st.includes('running') || st.includes('active') || completedQty > 0);

      let bucket = 'Planned';
      if (isCompleted) bucket = 'Completed';
      else if (isDelayed) bucket = 'Delayed';
      else if (isOnHold) bucket = 'On Hold';
      else if (isInProgress) bucket = 'In Progress';

      const delayDays = isDelayed && dueD
        ? Math.max(1, Math.floor((now.getTime() - dueD.getTime()) / 86400000))
        : (st.includes('delay') ? 1 : 0);
      if (delayDays > 0 && !isCompleted) bucket = 'Delayed';

      const delayReason = wo.delayReason || wo.holdReason || wo.remarks || (isOnHold ? 'Material / Machine Hold' : (isDelayed ? 'Schedule Overdue' : 'In Queue'));
      const defectReason = wo.defectReason || wo.rejectionReason || (rejectedQty > 0 ? 'Dimension / Surface Rework' : 'Passed');
      const achievementPct = plannedQty > 0 ? Math.min(100, Math.round((completedQty / plannedQty) * 100)) : (isCompleted ? 100 : 0);

      return {
        rawWo: wo,
        code,
        product,
        bucket,
        statusLabel: wo.status || bucket,
        plannedQty,
        completedQty,
        goodQty,
        rejectedQty,
        achievementPct,
        dateIso,
        createdIso: createdD ? createdD.toISOString().split('T')[0] : todayIso,
        delayDays,
        delayReason,
        defectReason
      };
    });

    // Localhost-only preview when workOrdersList is empty (NEVER runs on dev/live servers)
    const isLocalhostPreview =
      typeof window !== 'undefined' &&
      ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
      orders.length === 0;

    if (isLocalhostPreview) {
      const dayIso = (ago) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - ago).toISOString().split('T')[0];
      orders = [
        { code: 'WO/26-27/118', product: 'Mini Rail 100 mm', bucket: 'Delayed', statusLabel: 'Overdue', plannedQty: 500, completedQty: 360, goodQty: 348, rejectedQty: 12, achievementPct: 72, dateIso: dayIso(0), createdIso: dayIso(4), delayDays: 2, delayReason: 'Material Delay', defectReason: 'Dimension Out' },
        { code: 'WO/26-27/101', product: 'Long Rail 3000 mm', bucket: 'Delayed', statusLabel: 'Overdue', plannedQty: 200, completedQty: 120, goodQty: 114, rejectedQty: 6, achievementPct: 60, dateIso: dayIso(1), createdIso: dayIso(5), delayDays: 2, delayReason: 'Machine Down', defectReason: 'Surface Scratch' },
        { code: 'WO/26-27/089', product: 'Mid Clamp 35 mm', bucket: 'In Progress', statusLabel: 'In Progress', plannedQty: 1500, completedQty: 1100, goodQty: 1085, rejectedQty: 15, achievementPct: 73, dateIso: dayIso(0), createdIso: dayIso(2), delayDays: 1, delayReason: 'Operator Shortage', defectReason: 'Bent / Deformed' },
        { code: 'WO/26-27/074', product: 'End Clamp 35 mm', bucket: 'On Hold', statusLabel: 'On Hold', plannedQty: 400, completedQty: 260, goodQty: 254, rejectedQty: 6, achievementPct: 65, dateIso: dayIso(2), createdIso: dayIso(3), delayDays: 1, delayReason: 'Tool Change', defectReason: 'Drilling Offset' },
        { code: 'WO/26-27/125', product: 'HAT Purlin 2x5', bucket: 'Completed', statusLabel: 'Completed', plannedQty: 800, completedQty: 800, goodQty: 788, rejectedQty: 12, achievementPct: 100, dateIso: dayIso(0), createdIso: dayIso(1), delayDays: 0, delayReason: 'On Schedule', defectReason: 'Dimension Out' },
        { code: 'WO/26-27/126', product: 'Mini Rail 60 mm', bucket: 'Completed', statusLabel: 'Completed', plannedQty: 1200, completedQty: 1180, goodQty: 1165, rejectedQty: 15, achievementPct: 98, dateIso: dayIso(3), createdIso: dayIso(4), delayDays: 0, delayReason: 'On Schedule', defectReason: 'Surface Scratch' },
        { code: 'WO/26-27/127', product: 'LEG 1500 mm (HDG)', bucket: 'Completed', statusLabel: 'Completed', plannedQty: 680, completedQty: 680, goodQty: 672, rejectedQty: 8, achievementPct: 100, dateIso: dayIso(4), createdIso: dayIso(5), delayDays: 0, delayReason: 'On Schedule', defectReason: 'Other Rework' },
        { code: 'WO/26-27/128', product: 'Mini Rail 100 mm', bucket: 'Planned', statusLabel: 'Planned', plannedQty: 600, completedQty: 0, goodQty: 0, rejectedQty: 0, achievementPct: 0, dateIso: dayIso(0), createdIso: dayIso(0), delayDays: 0, delayReason: 'Scheduled', defectReason: 'Passed' }
      ];
    }

    const totalOrders = orders.length;
    const totalPlannedQty = orders.reduce((s, o) => s + o.plannedQty, 0);
    const totalProducedQty = orders.reduce((s, o) => s + o.completedQty, 0);
    const totalGoodQty = orders.reduce((s, o) => s + o.goodQty, 0);
    const totalRejectedQty = orders.reduce((s, o) => s + o.rejectedQty, 0);
    const overallAchievement = totalPlannedQty > 0 ? Math.round((totalProducedQty / totalPlannedQty) * 100) : 0;
    const rejectionPct = totalProducedQty > 0 ? ((totalRejectedQty / totalProducedQty) * 100).toFixed(2) : '0.00';

    // 1. PRODUCTION STATUS
    const statusDefs = [
      { name: 'Completed', color: '#059669' },
      { name: 'In Progress', color: '#2563EB' },
      { name: 'Planned', color: '#D97706' },
      { name: 'On Hold', color: '#7C3AED' },
      { name: 'Delayed', color: '#DC2626' }
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

    // 2. DAILY PRODUCTION (Last 7 Days)
    const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dailyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const label = `${String(d.getDate()).padStart(2, '0')} ${monthShort[d.getMonth()]}`;
      const dayOrders = orders.filter(o => o.dateIso === iso);
      const planned = dayOrders.reduce((s, o) => s + o.plannedQty, 0);
      const actual = dayOrders.reduce((s, o) => s + o.completedQty, 0);
      const achPct = planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : (actual > 0 ? 100 : 0);
      dailyTrend.push({ iso, label, planned, actual, achPct, orderCount: dayOrders.length });
    }

    // 3. TOP DELAYED PRODUCTION
    const delayedOrders = orders
      .filter(o => o.bucket === 'Delayed' || o.delayDays > 0)
      .sort((a, b) => b.delayDays - a.delayDays)
      .slice(0, 5);

    // 4. PRODUCTION BY PRODUCT / PROFILE (Seed all known products for Filter popup)
    const prodMap = new Map();
    for (const o of orders) {
      const cur = prodMap.get(o.product) || { name: o.product, planned: 0, actual: 0, orders: [] };
      cur.planned += o.plannedQty;
      cur.actual += o.completedQty;
      cur.orders.push(o);
      prodMap.set(o.product, cur);
    }
    for (const b of (bomList || [])) {
      for (const it of (Array.isArray(b?.items) ? b.items : [])) {
        const pName = it?.name || it?.description;
        if (pName && !prodMap.has(pName)) prodMap.set(pName, { name: pName, planned: 0, actual: 0, orders: [] });
      }
    }
    for (const invIt of (inventoryList || [])) {
      const pName = invIt?.name || invIt?.itemName || invIt?.description;
      if (pName && !prodMap.has(pName)) prodMap.set(pName, { name: pName, planned: 0, actual: 0, orders: [] });
    }
    const productBreakdown = Array.from(prodMap.values())
      .map(p => ({
        ...p,
        achPct: p.planned > 0 ? Math.min(100, Math.round((p.actual / p.planned) * 100)) : (p.actual > 0 ? 100 : 0)
      }))
      .sort((a, b) => (b.actual - a.actual) || (b.planned - a.planned) || String(a.name).localeCompare(String(b.name)));

    // 5. QUALITY SUMMARY
    const defectOrders = orders.filter(o => o.rejectedQty > 0);
    const dimOrders = defectOrders.filter(o => String(o.defectReason).toLowerCase().includes('dim'));
    const surfOrders = defectOrders.filter(o => String(o.defectReason).toLowerCase().includes('surf'));
    const otherDefectOrders = defectOrders.filter(o => !dimOrders.includes(o) && !surfOrders.includes(o));
    const dimQty = dimOrders.reduce((s, o) => s + o.rejectedQty, 0);
    const surfQty = surfOrders.reduce((s, o) => s + o.rejectedQty, 0);
    const otherDefQty = otherDefectOrders.reduce((s, o) => s + o.rejectedQty, 0);

    const qualitySegments = [
      { name: 'Good Production', value: totalGoodQty, color: '#059669', orders: orders.filter(o => o.goodQty > 0) },
      { name: 'Dimension Out', value: dimQty, color: '#DC2626', orders: dimOrders },
      { name: 'Surface Scratch', value: surfQty, color: '#D97706', orders: surfOrders },
      { name: 'Other Rework', value: otherDefQty, color: '#7C3AED', orders: otherDefectOrders }
    ].map(q => ({
      ...q,
      pct: totalProducedQty > 0 ? ((q.value / totalProducedQty) * 100).toFixed(1) : '0.0'
    }));

    // 6. KEY ALERTS
    const holdOrders = orders.filter(o => o.bucket === 'On Hold');
    const lowAchOrders = orders.filter(o => o.bucket !== 'Planned' && o.plannedQty > 0 && o.achievementPct < 80);
    const keyAlerts = [
      {
        title: 'Delayed Work Orders',
        sub: `${delayedOrders.length} orders past target schedule`,
        badge: `${delayedOrders.length} Orders`,
        color: '#DC2626', bg: '#FEF2F2', border: '#FECACA',
        icon: ShieldAlert,
        orders: delayedOrders
      },
      {
        title: 'Rejection / Rework',
        sub: `${totalRejectedQty.toLocaleString('en-IN')} rejected units (${rejectionPct}%)`,
        badge: `${defectOrders.length} Orders`,
        color: '#D97706', bg: '#FFFBEB', border: '#FDE68A',
        icon: AlertTriangle,
        orders: defectOrders
      },
      {
        title: 'On Hold / Blocked',
        sub: `${holdOrders.length} work orders paused`,
        badge: `${holdOrders.length} Orders`,
        color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE',
        icon: PauseCircle,
        orders: holdOrders
      },
      {
        title: 'Below 80% Achievement',
        sub: `${lowAchOrders.length} active orders under target`,
        badge: `${lowAchOrders.length} Orders`,
        color: '#0E7490', bg: '#ECFEFF', border: '#A5F3FC',
        icon: Factory,
        orders: lowAchOrders
      }
    ];

    return {
      totalOrders,
      totalPlannedQty,
      totalProducedQty,
      totalGoodQty,
      totalRejectedQty,
      overallAchievement,
      rejectionPct,
      statusSegments,
      dailyTrend,
      delayedOrders,
      productBreakdown,
      qualitySegments,
      keyAlerts
    };
  }, [workOrdersList, bomList, inventoryList]);

  const maxDailyQty = Math.max(1, ...analytics.dailyTrend.map(d => Math.max(d.planned, d.actual)));
  const peakDay = analytics.dailyTrend.reduce((best, d) => (d.actual >= best.actual ? d : best), analytics.dailyTrend[0] || { label: '—', actual: 0 });
  const activeDayIdx = selectedDayIdx !== null && analytics.dailyTrend[selectedDayIdx]
    ? selectedDayIdx
    : Math.max(0, analytics.dailyTrend.length - 1);
  const activeDay = analytics.dailyTrend[activeDayIdx] || { label: '—', planned: 0, actual: 0, achPct: 0 };
  const activeStatusSeg = selectedStatus ? analytics.statusSegments.find(s => s.name === selectedStatus) || null : null;
  const activeQualSeg = selectedQuality ? analytics.qualitySegments.find(q => q.name === selectedQuality) || null : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ROW 1: PRODUCTION STATUS (DONUT) + DAILY PRODUCTION */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {/* 1. PRODUCTION STATUS */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={cardTitleStyle}>Production Status</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#0E7490',
                backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                {analytics.totalOrders} Work Orders
              </span>
            </div>
          </div>

          <div style={summaryStripStyle}>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Planned Qty</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>{analytics.totalPlannedQty.toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Produced</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#059669' }}>{analytics.totalProducedQty.toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Achievement</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0E7490' }}>{analytics.overallAchievement}%</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, minHeight: '150px' }}>
            <DonutChartSvg
              segments={analytics.statusSegments}
              centerLabel={activeStatusSeg ? activeStatusSeg.value : analytics.totalOrders}
              centerSub={activeStatusSeg ? `${activeStatusSeg.pct}% Share` : 'Work Orders'}
              activeName={selectedStatus}
              onSelectSegment={(name) => {
                const seg = analytics.statusSegments.find(s => s.name === name);
                setSelectedStatus(name);
                if (seg) {
                  setPopupSearch('');
                  setOrdersPopup({ title: `Production Status: ${seg.name}`, color: seg.color, orders: seg.orders });
                }
              }}
            />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
              {analytics.statusSegments.map((seg, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedStatus(seg.name);
                    setPopupSearch('');
                    setOrdersPopup({ title: `Production Status: ${seg.name}`, color: seg.color, orders: seg.orders });
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: '4px',
                    width: '100%', textAlign: 'left', padding: '6px 8px',
                    borderRadius: '10px',
                    border: selectedStatus === seg.name ? `1.5px solid ${seg.color}` : '1px solid transparent',
                    backgroundColor: selectedStatus === seg.name ? '#F8FAFC' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease, border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: seg.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{seg.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontWeight: '800', color: '#0F172A', fontSize: '12px' }}>{seg.value}</span>
                      <span style={{ fontSize: '10px', fontWeight: '800', color: seg.color, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', padding: '1px 6px', borderRadius: '6px' }}>
                        {seg.pct}%
                      </span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '5px', backgroundColor: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Math.max(seg.value > 0 ? 2 : 0, Number(seg.pct)))}%`, height: '100%', backgroundColor: seg.color, borderRadius: '999px' }} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. DAILY PRODUCTION */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={cardTitleStyle}>Daily Production</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#059669',
                backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                Last 7 Days (Nos)
              </span>
            </div>
          </div>

          <div style={summaryStripStyle}>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>{activeDay.label} Actual</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>{activeDay.actual.toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Achievement</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#059669' }}>{activeDay.achPct}%</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>7-Day Peak</div>
              <div style={{ fontSize: '13px', fontWeight: '900', color: '#0E7490' }}>{peakDay.label} ({peakDay.actual})</div>
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
                const planH = d.planned > 0 ? Math.max(14, Math.round((d.planned / maxDailyQty) * 86)) : 4;
                const actH = d.actual > 0 ? Math.max(14, Math.round((d.actual / maxDailyQty) * 86)) : 4;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDayIdx(idx)}
                    style={{
                      flex: 1, border: 'none',
                      background: isSelected ? '#F0FDF4' : 'transparent',
                      borderRadius: '10px', padding: '4px 2px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                      gap: '5px', height: '100%', cursor: 'pointer',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '10px', fontWeight: '800', color: d.actual > 0 ? (isSelected ? '#047857' : '#059669') : '#94A3B8' }}>{d.achPct}%</span>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                      <div
                        title={`Planned: ${d.planned}`}
                        style={{
                          width: '12px',
                          height: `${planH}px`,
                          background: isSelected ? 'linear-gradient(180deg, #0E7490 0%, #075985 100%)' : '#BAE6FD',
                          borderRadius: '6px 6px 2px 2px',
                          transition: 'all 0.18s ease'
                        }}
                      />
                      <div
                        title={`Actual: ${d.actual}`}
                        style={{
                          width: '12px',
                          height: `${actH}px`,
                          background: isSelected ? 'linear-gradient(180deg, #059669 0%, #0E7490 100%)' : '#A7F3D0',
                          borderRadius: '6px 6px 2px 2px',
                          boxShadow: isSelected && d.actual > 0 ? '0 4px 10px rgba(5, 150, 105, 0.25)' : 'none',
                          transition: 'all 0.18s ease'
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '10.5px', fontWeight: isSelected ? '800' : '700', color: isSelected ? '#0F172A' : '#64748B' }}>{d.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px dashed #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: '800', color: '#0F172A' }}>{activeDay.label}:</span>
              <span style={{ color: '#475569', fontWeight: '600' }}>
                Planned <strong style={{ color: '#0E7490' }}>{activeDay.planned.toLocaleString('en-IN')}</strong>
              </span>
              <span style={{ color: '#CBD5E1' }}>•</span>
              <span style={{ color: '#475569', fontWeight: '600' }}>
                Actual <strong style={{ color: '#059669' }}>{activeDay.actual.toLocaleString('en-IN')}</strong>
              </span>
            </div>
            <span style={{
              fontSize: '10px', fontWeight: '800', color: '#0E7490',
              backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC',
              padding: '2px 8px', borderRadius: '999px'
            }}>
              Achievement: {activeDay.achPct}%
            </span>
          </div>
        </div>
      </div>

      {/* ROW 2: TOP DELAYED PRODUCTION + PRODUCTION BY PRODUCT / PROFILE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {/* 3. TOP DELAYED PRODUCTION */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Top Delayed Production</span>
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
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '260px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '7px 8px' }}>Order No.</th>
                  <th style={{ padding: '7px 8px' }}>Product / Profile</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>Done / Plan</th>
                  <th style={{ padding: '7px 8px', textAlign: 'center' }}>Delay</th>
                  <th style={{ padding: '7px 8px' }}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {analytics.delayedOrders.length > 0 ? analytics.delayedOrders.map((o, idx) => (
                  <tr
                    key={idx}
                    onClick={() => {
                      setPopupSearch('');
                      setOrdersPopup({ title: `Delayed Work Order: ${o.code}`, color: '#DC2626', orders: [o] });
                    }}
                    style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '6px 8px', fontWeight: '800', color: '#0E7490', whiteSpace: 'nowrap', textDecoration: 'underline' }}>{o.code}</td>
                    <td style={{ padding: '6px 8px', fontWeight: '600', color: '#0F172A' }}>{o.product}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', color: '#334155', whiteSpace: 'nowrap' }}>{o.completedQty}/{o.plannedQty}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '800', color: '#DC2626', whiteSpace: 'nowrap' }}>{o.delayDays}d</td>
                    <td style={{ padding: '6px 8px', color: '#475569' }}>{o.delayReason}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} style={{ padding: '18px', textAlign: 'center', color: '#059669', fontWeight: '700' }}>
                      No delayed work orders — production on schedule.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. PRODUCTION BY PRODUCT / PROFILE */}
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
                  <span style={cardTitleStyle}>Production by Product / Profile</span>
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
                </div>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: '260px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '7px 8px' }}>Product / Profile</th>
                      <th style={{ padding: '7px 8px', textAlign: 'right' }}>Planned</th>
                      <th style={{ padding: '7px 8px', textAlign: 'right' }}>Actual</th>
                      <th style={{ padding: '7px 8px', textAlign: 'right' }}>Achievement %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProducts.length > 0 ? visibleProducts.map((p, idx) => (
                      <tr
                        key={idx}
                        onClick={() => {
                          if (p.orders.length === 0) return;
                          setPopupSearch('');
                          setOrdersPopup({ title: `Product: ${p.name}`, color: '#0E7490', orders: p.orders });
                        }}
                        style={{ borderBottom: '1px solid #F1F5F9', cursor: p.orders.length > 0 ? 'pointer' : 'default' }}
                      >
                        <td style={{ padding: '6px 8px', fontWeight: '600', color: '#0F172A' }}>{p.name}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#334155', whiteSpace: 'nowrap' }}>{p.planned.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap' }}>{p.actual.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800', color: p.achPct >= 90 ? '#059669' : '#D97706', whiteSpace: 'nowrap' }}>{p.achPct}%</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} style={{ padding: '18px', textAlign: 'center', color: '#64748B', fontWeight: '600' }}>
                          No production profiles recorded yet.
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

      {/* ROW 3: QUALITY SUMMARY + KEY ALERTS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {/* 5. QUALITY SUMMARY */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Quality Summary</span>
              <span style={{
                fontSize: '10px', fontWeight: '800',
                color: Number(analytics.rejectionPct) > 3 ? '#DC2626' : '#059669',
                backgroundColor: Number(analytics.rejectionPct) > 3 ? '#FEF2F2' : '#ECFDF5',
                border: `1px solid ${Number(analytics.rejectionPct) > 3 ? '#FECACA' : '#A7F3D0'}`,
                padding: '2px 8px', borderRadius: '999px'
              }}>
                Rejection: {analytics.rejectionPct}%
              </span>
            </div>
          </div>

          <div style={summaryStripStyle}>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Total Produced</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>{analytics.totalProducedQty.toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Good Qty</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#059669' }}>{analytics.totalGoodQty.toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Rejected</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: analytics.totalRejectedQty > 0 ? '#DC2626' : '#0F172A' }}>{analytics.totalRejectedQty.toLocaleString('en-IN')}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, minHeight: '140px' }}>
            <DonutChartSvg
              segments={analytics.qualitySegments}
              centerLabel={activeQualSeg ? activeQualSeg.value.toLocaleString('en-IN') : `${analytics.rejectionPct}%`}
              centerSub={activeQualSeg ? `${activeQualSeg.pct}% Share` : 'Rejection Rate'}
              activeName={selectedQuality}
              onSelectSegment={(name) => {
                const seg = analytics.qualitySegments.find(q => q.name === name);
                setSelectedQuality(name);
                if (seg && seg.orders.length > 0) {
                  setPopupSearch('');
                  setOrdersPopup({ title: `Quality: ${seg.name}`, color: seg.color, orders: seg.orders });
                }
              }}
            />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
              {analytics.qualitySegments.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedQuality(q.name);
                    if (q.orders.length > 0) {
                      setPopupSearch('');
                      setOrdersPopup({ title: `Quality: ${q.name}`, color: q.color, orders: q.orders });
                    }
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: '4px',
                    padding: '6px 8px', borderRadius: '10px',
                    border: selectedQuality === q.name ? `1.5px solid ${q.color}` : '1px solid transparent',
                    backgroundColor: selectedQuality === q.name ? '#F8FAFC' : 'transparent',
                    cursor: q.orders.length > 0 ? 'pointer' : 'default', width: '100%', textAlign: 'left',
                    transition: 'background-color 0.15s ease, border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: q.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontWeight: '800', color: '#0F172A', fontSize: '12px' }}>{q.value.toLocaleString('en-IN')}</span>
                      <span style={{ fontSize: '10px', fontWeight: '800', color: q.color, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', padding: '1px 6px', borderRadius: '6px' }}>
                        {q.pct}%
                      </span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '5px', backgroundColor: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Math.max(q.value > 0 ? 2 : 0, Number(q.pct)))}%`, height: '100%', backgroundColor: q.color, borderRadius: '999px' }} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 6. KEY ALERTS */}
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

      {/* PRODUCT FILTER MODAL (MAX 5) */}
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
                            Planned: {p.planned.toLocaleString('en-IN')} • Actual: {p.actual.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: p.achPct >= 90 ? '#059669' : '#0E7490', flexShrink: 0 }}>
                        {p.achPct}%
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

      {/* WORK ORDERS DRILLDOWN POPUP MODAL */}
      {ordersPopup && (() => {
        const q = popupSearch.trim().toLowerCase();
        const filtered = (ordersPopup.orders || []).filter(o =>
          !q ||
          String(o.code || '').toLowerCase().includes(q) ||
          String(o.product || '').toLowerCase().includes(q) ||
          String(o.statusLabel || '').toLowerCase().includes(q)
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
                    placeholder="Search work order no, product, or status..."
                    style={{ border: 'none', background: 'none', outline: 'none', width: '100%', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}
                  />
                </div>
              </div>

              <div style={{ overflowY: 'auto', padding: '12px 20px 18px 20px' }}>
                {filtered.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid #E2E8F0', color: '#64748B', fontSize: '10px', textTransform: 'uppercase' }}>
                        <th style={{ textAlign: 'left', padding: '8px 6px' }}>Work Order</th>
                        <th style={{ textAlign: 'left', padding: '8px 6px' }}>Product / Profile</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px' }}>Planned</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px' }}>Produced</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px' }}>Rejected</th>
                        <th style={{ textAlign: 'center', padding: '8px 6px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((o, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 6px', fontWeight: '800', color: '#0E7490', whiteSpace: 'nowrap' }}>{o.code}</td>
                          <td style={{ padding: '8px 6px', fontWeight: '700', color: '#0F172A' }}>{o.product}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: '600' }}>{o.plannedQty.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: '800', color: '#059669' }}>{o.completedQty.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: '700', color: o.rejectedQty > 0 ? '#DC2626' : '#64748B' }}>{o.rejectedQty.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                            <span style={{
                              fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '999px',
                              backgroundColor: '#F1F5F9', color: '#0F172A', border: '1px solid #CBD5E1'
                            }}>
                              {o.bucket}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748B', fontSize: '12.5px', fontWeight: '600' }}>
                    No matching work orders found.
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
