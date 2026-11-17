import React, { useMemo, useState } from 'react';
import {
  TrendingUp, Target, Users, Share2, Award,
  CalendarClock, Package, BarChart3, X, Search, ArrowRight
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

const formatINRCompact = (val) => {
  const n = Number(val) || 0;
  if (n >= 10000000) return `₹ ${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹ ${(n / 100000).toFixed(2)} L`;
  return `₹ ${Math.round(n).toLocaleString('en-IN')}`;
};

const parseAmount = (val) => {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const cleaned = String(val ?? '0').replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const parseDateMs = (raw) => {
  if (!raw) return NaN;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw < 1e12 ? raw * 1000 : raw;
  const str = String(raw).trim();
  if (/^\d{10,13}$/.test(str)) {
    const n = Number(str);
    return n < 1e12 ? n * 1000 : n;
  }
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    const p1 = Number(dmy[1]);
    const p2 = Number(dmy[2]);
    const day = p2 > 12 ? p2 : p1;
    const month = p2 > 12 ? p1 : p2;
    return new Date(Number(dmy[3]), month - 1, day).getTime();
  }
  const ts = new Date(str).getTime();
  return Number.isFinite(ts) ? ts : NaN;
};

const formatShortDate = (raw) => {
  const ts = parseDateMs(raw);
  if (!Number.isFinite(ts)) return raw || '—';
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
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

export default function CeoSalesAnalyticsSection({
  leadsList = [],
  quotesList = [],
  piList = [],
  bomList = [],
  invList = [],
  companyTarget = 18000000,
  onNavigateTab
}) {
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedSource, setSelectedSource] = useState(null);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(null);
  const [drillPopup, setDrillPopup] = useState(null);
  const [popupSearch, setPopupSearch] = useState('');

  const closePopup = () => {
    setDrillPopup(null);
    setSelectedStage(null);
    setSelectedSource(null);
    setPopupSearch('');
  };

  const analytics = useMemo(() => {
    const now = Date.now();
    let rawLeads = (leadsList || []).filter(Boolean);
    let rawQuotes = (quotesList || []).filter(Boolean);
    let rawPIs = (piList || []).filter(Boolean);
    let rawBoms = (bomList || []).filter(Boolean);
    let rawInvs = (invList || []).filter(Boolean);

    // Localhost-only demo data when local DB is empty (NEVER runs on live/dev servers)
    const isLocalhostPreview =
      typeof window !== 'undefined' &&
      ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
      rawLeads.length === 0 &&
      rawQuotes.length === 0 &&
      rawPIs.length === 0 &&
      rawBoms.length === 0;

    if (isLocalhostPreview) {
      const isoDaysAgo = (d) => new Date(now - d * 86400000).toISOString().split('T')[0];
      rawLeads = [
        { leadNo: 'LD-101', customerName: 'Jashsun Power Dynamics', source: 'Website', status: 'New', estimatedValue: 2500000, salesPerson: 'Karthik R', followUpDate: isoDaysAgo(-1), priority: 'High', date: isoDaysAgo(2) },
        { leadNo: 'LD-102', customerName: 'Solarize India Pvt Ltd', source: 'Referral', status: 'Qualified', estimatedValue: 1850000, salesPerson: 'Priya S', followUpDate: isoDaysAgo(-2), priority: 'Medium', date: isoDaysAgo(4) },
        { leadNo: 'LD-103', customerName: 'Bright Future Energy', source: 'IndiaMART', status: 'Proposal', estimatedValue: 3100000, salesPerson: 'Suresh B', followUpDate: isoDaysAgo(-3), priority: 'High', date: isoDaysAgo(6) },
        { leadNo: 'LD-104', customerName: 'Apex Infra Projects', source: 'Social Media', status: 'Negotiation', estimatedValue: 1450000, salesPerson: 'Anitha M', followUpDate: isoDaysAgo(-4), priority: 'Low', date: isoDaysAgo(10) },
        { leadNo: 'LD-105', customerName: 'Greenvolt Energy', source: 'Cold Call', status: 'New', estimatedValue: 1120000, salesPerson: 'Vijay K', date: isoDaysAgo(14) }
      ];
      rawQuotes = [
        { quoteNo: 'QT-201', customerName: 'Jashsun Power Dynamics', grandTotal: 4200000, salesPerson: 'Karthik R', date: isoDaysAgo(5), product: 'Ground Mounting Structure' },
        { quoteNo: 'QT-202', customerName: 'Solarize India Pvt Ltd', grandTotal: 2950000, salesPerson: 'Priya S', date: isoDaysAgo(9), product: 'Carport Structure' },
        { quoteNo: 'QT-203', customerName: 'Bright Future Energy', grandTotal: 3400000, salesPerson: 'Suresh B', date: isoDaysAgo(12), product: 'RCC Roof Structure' }
      ];
      rawPIs = [
        { piNo: 'PI/26-27/041', customerName: 'Jashsun Power Dynamics', grandTotal: 1850000, salesPerson: 'Karthik R', date: isoDaysAgo(2), product: 'Ground Mounting Structure', status: 'Confirmed' },
        { piNo: 'PI/26-27/040', customerName: 'Greenvolt Energy Pvt Ltd', grandTotal: 1275000, salesPerson: 'Priya S', date: isoDaysAgo(6), product: 'Carport Structure', status: 'Confirmed' },
        { piNo: 'PI/26-27/039', customerName: 'Sunbright Infra', grandTotal: 920000, salesPerson: 'Suresh B', date: isoDaysAgo(15), product: 'Ground Mounting Structure', status: 'Advance Paid' }
      ];
      rawBoms = [
        { bomNo: 'BOM-088', customerName: 'Jashsun Power Dynamics', grandTotal: 1850000, salesPerson: 'Karthik R', date: isoDaysAgo(1), product: 'Ground Mounting Structure', status: 'Sales Confirmed' },
        { bomNo: 'BOM-085', customerName: 'Greenvolt Energy Pvt Ltd', grandTotal: 1275000, salesPerson: 'Priya S', date: isoDaysAgo(4), product: 'Carport Structure', status: 'Sales Confirmed' },
        { bomNo: 'BOM-081', customerName: 'Eco Power Pvt Ltd', grandTotal: 755000, salesPerson: 'Anitha M', date: isoDaysAgo(35), product: 'BOS Kit', status: 'Dispatched' },
        { bomNo: 'BOM-076', customerName: 'Radiant Solar Solutions', grandTotal: 640000, salesPerson: 'Vijay K', date: isoDaysAgo(65), product: 'RCC Roof Structure', status: 'Dispatched' }
      ];
      rawInvs = [
        { invoiceNo: 'INV-101', customerName: 'Jashsun Power Dynamics', grandTotal: 1850000, date: isoDaysAgo(1) },
        { invoiceNo: 'INV-100', customerName: 'Greenvolt Energy Pvt Ltd', grandTotal: 1275000, date: isoDaysAgo(34) }
      ];
    }

    const wonDeals = (rawBoms.length > 0 ? rawBoms : rawInvs).map((r, idx) => {
      const docNo = r.bomNo || r.bomNumber || r.invoiceNo || r.piNo || `DEAL-${idx + 1}`;
      const customer = r.customerName || r.clientName || r.customer || 'Customer';
      const val = parseAmount(r.grandTotal ?? r.total ?? r.amount ?? 0);
      const rep = r.salesPerson || r.salesExecutive || r.createdBy || 'Sales Team';
      const dateStr = r.bomDate || r.invoiceDate || r.date || r.createdAt || '';
      const dateTs = parseDateMs(dateStr);
      const firstItem = Array.isArray(r.items) && r.items[0] ? (r.items[0].name || r.items[0].description) : '';
      const product = r.product || r.structureType || firstItem || 'Solar Mounting Structure';
      return { docNo, customer, value: val, rep, dateStr, dateTs, product };
    });

    const totalRevenue = wonDeals.reduce((s, d) => s + d.value, 0);
    const totalPipeline = rawQuotes.reduce((s, q) => s + parseAmount(q.grandTotal ?? q.total ?? q.amount ?? 0), 0)
      + rawPIs.reduce((s, p) => s + parseAmount(p.grandTotal ?? p.total ?? p.amount ?? 0), 0);

    // 1. Sales Overview & Forecast (Last 6 Months)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const curDate = new Date();
    const trendMap = new Map();
    const trendMonths = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(curDate.getFullYear(), curDate.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const b = { key, label: `${monthNames[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`, revenue: 0, deals: 0, orders: [] };
      trendMap.set(key, b);
      trendMonths.push(b);
    }
    wonDeals.forEach(d => {
      if (!Number.isFinite(d.dateTs)) return;
      const dt = new Date(d.dateTs);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const b = trendMap.get(key);
      if (b) {
        b.revenue += d.value;
        b.deals += 1;
        b.orders.push(d);
      }
    });

    // 2. Pipeline by Stage
    const stageRows = [
      {
        name: 'New Leads',
        color: '#2563EB',
        value: rawLeads.reduce((s, l) => s + parseAmount(l.estimatedValue ?? l.value ?? l.amount ?? 0), 0) || rawLeads.length * 100000,
        orders: rawLeads.map((l, i) => ({ docNo: l.leadNo || `LD-${i + 1}`, customer: l.customerName || l.name || 'Lead', value: parseAmount(l.estimatedValue ?? l.value ?? 0), dateStr: l.date || l.createdAt || '', rep: l.salesPerson || 'Sales' }))
      },
      {
        name: 'Quotations Sent',
        color: '#059669',
        value: rawQuotes.reduce((s, q) => s + parseAmount(q.grandTotal ?? q.total ?? q.amount ?? 0), 0),
        orders: rawQuotes.map((q, i) => ({ docNo: q.quoteNo || q.quotationNo || `QT-${i + 1}`, customer: q.customerName || q.clientName || 'Client', value: parseAmount(q.grandTotal ?? q.total ?? 0), dateStr: q.date || q.createdAt || '', rep: q.salesPerson || 'Sales' }))
      },
      {
        name: 'Proforma Invoices (PI)',
        color: '#D97706',
        value: rawPIs.reduce((s, p) => s + parseAmount(p.grandTotal ?? p.total ?? p.amount ?? 0), 0),
        orders: rawPIs.map((p, i) => ({ docNo: p.piNo || `PI-${i + 1}`, customer: p.customerName || p.clientName || 'Client', value: parseAmount(p.grandTotal ?? p.total ?? 0), dateStr: p.piDate || p.date || '', rep: p.salesPerson || 'Sales' }))
      },
      {
        name: 'Closed Won (BOMs)',
        color: '#0E7490',
        value: totalRevenue,
        orders: wonDeals
      }
    ];
    const stageTotalVal = stageRows.reduce((s, st) => s + st.value, 0);
    const stageSegments = stageRows.map(st => ({
      ...st,
      pct: stageTotalVal > 0 ? ((st.value / stageTotalVal) * 100).toFixed(1) : '0.0'
    }));

    // 3. Top Salespersons
    const repMap = new Map();
    wonDeals.forEach(d => {
      const prev = repMap.get(d.rep) || { rep: d.rep, revenue: 0, deals: 0, orders: [] };
      prev.revenue += d.value;
      prev.deals += 1;
      prev.orders.push(d);
      repMap.set(d.rep, prev);
    });
    const perRepTarget = Math.max(1, companyTarget / Math.max(1, repMap.size));
    const topSalespersons = Array.from(repMap.values())
      .map(r => ({
        ...r,
        achPct: Math.min(200, Math.round((r.revenue / perRepTarget) * 100))
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // 4. Leads by Source
    const srcColors = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#0E7490', '#64748B'];
    const srcMap = new Map();
    rawLeads.forEach((l, idx) => {
      const src = l.source || l.leadSource || 'Direct / Other';
      const prev = srcMap.get(src) || { name: src, value: 0, orders: [] };
      prev.value += 1;
      prev.orders.push({
        docNo: l.leadNo || `LD-${idx + 1}`,
        customer: l.customerName || l.name || 'Lead',
        value: parseAmount(l.estimatedValue ?? l.value ?? 0),
        dateStr: l.date || l.createdAt || '',
        rep: l.salesPerson || 'Sales'
      });
      srcMap.set(src, prev);
    });
    const totalLeads = rawLeads.length;
    const sourceSegments = Array.from(srcMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((s, idx) => ({
        ...s,
        color: srcColors[idx % srcColors.length],
        pct: totalLeads > 0 ? ((s.value / totalLeads) * 100).toFixed(1) : '0.0'
      }));

    // 5. Recent Deals Won
    const recentWon = [...wonDeals]
      .sort((a, b) => (b.dateTs || 0) - (a.dateTs || 0))
      .slice(0, 6);

    // 6. Upcoming Follow Ups
    const followUps = rawLeads
      .filter(l => l.followUpDate || l.nextFollowUp || !String(l.status || '').toLowerCase().includes('won'))
      .slice(0, 5)
      .map((l, idx) => ({
        docNo: l.leadNo || `LD-${idx + 1}`,
        customer: l.customerName || l.name || 'Prospect',
        task: l.nextAction || l.remarks || `Follow up (${l.status || 'Active Lead'})`,
        when: formatShortDate(l.followUpDate || l.nextFollowUp || l.date || ''),
        priority: l.priority || (idx < 2 ? 'High' : 'Medium')
      }));

    // 7. Revenue by Product
    const prodColors = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#0E7490', '#64748B'];
    const prodMap = new Map();
    wonDeals.forEach(d => {
      const prev = prodMap.get(d.product) || { name: d.product, value: 0, deals: 0, orders: [] };
      prev.value += d.value;
      prev.deals += 1;
      prev.orders.push(d);
      prodMap.set(d.product, prev);
    });
    const revenueByProduct = Array.from(prodMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((p, idx) => ({
        ...p,
        color: prodColors[idx % prodColors.length],
        pct: totalRevenue > 0 ? ((p.value / totalRevenue) * 100).toFixed(1) : '0.0'
      }));

    return {
      wonDeals,
      totalRevenue,
      totalPipeline,
      totalLeads,
      trendMonths,
      stageSegments,
      stageTotalVal,
      topSalespersons,
      sourceSegments,
      recentWon,
      followUps,
      revenueByProduct
    };
  }, [leadsList, quotesList, piList, bomList, invList, companyTarget]);

  const maxRevVal = Math.max(1, ...analytics.trendMonths.map(m => m.revenue));
  const latestIdx = Math.max(0, analytics.trendMonths.length - 1);
  const activeIdx = selectedMonthIdx !== null && analytics.trendMonths[selectedMonthIdx] ? selectedMonthIdx : latestIdx;
  const activeMonth = analytics.trendMonths[activeIdx] || { label: '—', revenue: 0, deals: 0, orders: [] };
  const peakMonth = analytics.trendMonths.reduce((best, m) => (m.revenue >= best.revenue ? m : best), analytics.trendMonths[0] || { label: '—', revenue: 0 });
  const activeStageSeg = selectedStage ? analytics.stageSegments.find(s => s.name === selectedStage) : null;
  const activeSourceSeg = selectedSource ? analytics.sourceSegments.find(s => s.name === selectedSource) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ROW 1: SALES OVERVIEW + PIPELINE BY STAGE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {/* 1. SALES OVERVIEW */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Sales Overview (6 Months)</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#0E7490',
                backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                {analytics.wonDeals.length} Deals Won
              </span>
            </div>
          </div>

          <div style={summaryStripStyle}>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>{activeMonth.label} Revenue</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>{formatINRCompact(activeMonth.revenue)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Deals</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#059669' }}>{activeMonth.deals}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>6-Mo Peak</div>
              <div style={{ fontSize: '13px', fontWeight: '900', color: '#0E7490', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {peakMonth.label} ({formatINRCompact(peakMonth.revenue)})
              </div>
            </div>
          </div>

          <div style={{ position: 'relative', flex: 1, minHeight: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingTop: '12px' }}>
            <div style={{ position: 'absolute', inset: '14px 0 24px 0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
              <div style={{ borderTop: '1px dashed #E2E8F0', width: '100%' }} />
              <div style={{ borderTop: '1px dashed #E2E8F0', width: '100%' }} />
              <div style={{ borderTop: '1px solid #E2E8F0', width: '100%' }} />
            </div>
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '10px', height: '100%' }}>
              {analytics.trendMonths.map((m, idx) => {
                const isSelected = idx === activeIdx;
                const barH = m.revenue > 0 ? Math.max(18, Math.round((m.revenue / maxRevVal) * 92)) : 6;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedMonthIdx(idx)}
                    style={{
                      flex: 1, border: 'none',
                      background: isSelected ? '#ECFEFF' : 'transparent',
                      borderRadius: '10px', padding: '4px 2px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                      gap: '5px', height: '100%', cursor: 'pointer', transition: 'background-color 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '10px', fontWeight: '800', color: m.revenue > 0 ? (isSelected ? '#075985' : '#0E7490') : '#94A3B8', whiteSpace: 'nowrap' }}>
                      {formatINRCompact(m.revenue).replace('₹ ', '')}
                    </span>
                    <div style={{
                      width: '100%', maxWidth: '34px', height: `${barH}px`,
                      background: m.revenue <= 0 ? '#CBD5E1' : (isSelected ? 'linear-gradient(180deg, #0E7490 0%, #075985 100%)' : '#BAE6FD'),
                      borderRadius: '6px 6px 2px 2px',
                      boxShadow: isSelected && m.revenue > 0 ? '0 4px 10px rgba(14, 116, 144, 0.25)' : 'none',
                      transition: 'all 0.18s ease'
                    }} />
                    <span style={{ fontSize: '10.5px', fontWeight: isSelected ? '800' : '700', color: isSelected ? '#0F172A' : '#64748B' }}>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px dashed #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '11px' }}>
            <span style={{ fontWeight: '700', color: '#475569' }}>
              <strong style={{ color: '#0F172A' }}>{activeMonth.label}:</strong> {activeMonth.deals} Won Deal{activeMonth.deals === 1 ? '' : 's'}
            </span>
            <span style={{
              fontSize: '10px', fontWeight: '800', color: '#0E7490',
              backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC',
              padding: '2px 8px', borderRadius: '999px'
            }}>
              Total: {formatINRCompact(activeMonth.revenue)}
            </span>
          </div>
        </div>

        {/* 2. PIPELINE BY STAGE */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Pipeline by Stage</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#0E7490',
                backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                {formatINRCompact(analytics.stageTotalVal)}
              </span>
            </div>
          </div>

          <div style={summaryStripStyle}>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Total Funnel</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>{formatINRCompact(analytics.stageTotalVal)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Closed Won</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#059669' }}>{formatINRCompact(analytics.totalRevenue)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Open Pipeline</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0E7490' }}>{formatINRCompact(analytics.totalPipeline)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, minHeight: '142px' }}>
            <DonutChartSvg
              segments={analytics.stageSegments}
              centerLabel={activeStageSeg ? formatINRCompact(activeStageSeg.value) : formatINRCompact(analytics.stageTotalVal)}
              centerSub={activeStageSeg ? `${activeStageSeg.pct}% Share` : 'Total Pipeline'}
              activeName={selectedStage}
              onSelectSegment={(name) => {
                const seg = analytics.stageSegments.find(s => s.name === name);
                if (!seg || seg.orders.length === 0) return;
                setSelectedStage(name);
                setPopupSearch('');
                setDrillPopup({ title: `Stage: ${seg.name}`, color: seg.color, orders: seg.orders });
              }}
            />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
              {analytics.stageSegments.map((seg, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={seg.orders.length === 0}
                  onClick={() => {
                    if (seg.orders.length === 0) return;
                    setSelectedStage(seg.name);
                    setPopupSearch('');
                    setDrillPopup({ title: `Stage: ${seg.name}`, color: seg.color, orders: seg.orders });
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: '4px',
                    width: '100%', textAlign: 'left', padding: '6px 8px',
                    borderRadius: '10px',
                    border: selectedStage === seg.name ? `1.5px solid ${seg.color}` : '1px solid transparent',
                    backgroundColor: selectedStage === seg.name ? '#F8FAFC' : 'transparent',
                    cursor: seg.orders.length > 0 ? 'pointer' : 'default',
                    transition: 'background-color 0.15s ease, border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: seg.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{seg.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontWeight: '800', color: '#0F172A', fontSize: '12px' }}>{formatINRCompact(seg.value)}</span>
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
      </div>

      {/* ROW 2: TOP SALESPERSONS + LEADS BY SOURCE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {/* 3. TOP SALESPERSONS */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Top Salespersons</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#0E7490',
                backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                {analytics.topSalespersons.length} Active
              </span>
            </div>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '260px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '7px 8px' }}>Salesperson</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>Revenue</th>
                  <th style={{ padding: '7px 8px', textAlign: 'center' }}>Deals</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>Target %</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topSalespersons.length > 0 ? analytics.topSalespersons.map((r, idx) => (
                  <tr
                    key={idx}
                    onClick={() => {
                      setPopupSearch('');
                      setDrillPopup({ title: `Deals by ${r.rep}`, color: '#0E7490', orders: r.orders });
                    }}
                    style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '6px 8px', fontWeight: '700', color: '#0E7490', textDecoration: 'underline' }}>{r.rep}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap' }}>{formatINRCompact(r.revenue)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '700', color: '#334155' }}>{r.deals}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800', color: r.achPct >= 90 ? '#059669' : '#D97706' }}>{r.achPct}%</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} style={{ padding: '18px', textAlign: 'center', color: '#64748B' }}>No salesperson deals recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. LEADS BY SOURCE */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Leads by Source</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#0E7490',
                backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                {analytics.totalLeads} Leads
              </span>
            </div>
          </div>

            <div style={summaryStripStyle}>
              <div>
                <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Total Leads</div>
                <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>{analytics.totalLeads}</div>
              </div>
              <div>
                <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Top Source</div>
                <div style={{ fontSize: '13px', fontWeight: '900', color: '#0E7490', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {analytics.sourceSegments[0]?.name || '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Top Share</div>
                <div style={{ fontSize: '14px', fontWeight: '900', color: '#059669' }}>
                  {analytics.sourceSegments[0]?.pct ? `${analytics.sourceSegments[0].pct}%` : '0.0%'}
                </div>
              </div>
            </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, minHeight: '142px' }}>
            <DonutChartSvg
              segments={analytics.sourceSegments}
              centerLabel={activeSourceSeg ? activeSourceSeg.value : analytics.totalLeads}
              centerSub={activeSourceSeg ? `${activeSourceSeg.pct}% Share` : 'Total Leads'}
              activeName={selectedSource}
              onSelectSegment={(name) => {
                const seg = analytics.sourceSegments.find(s => s.name === name);
                if (!seg || seg.orders.length === 0) return;
                setSelectedSource(name);
                setPopupSearch('');
                setDrillPopup({ title: `Leads: ${seg.name}`, color: seg.color, orders: seg.orders });
              }}
            />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
              {analytics.sourceSegments.length > 0 ? analytics.sourceSegments.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={s.orders.length === 0}
                  onClick={() => {
                    if (s.orders.length === 0) return;
                    setSelectedSource(s.name);
                    setPopupSearch('');
                    setDrillPopup({ title: `Leads: ${s.name}`, color: s.color, orders: s.orders });
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: '4px',
                    width: '100%', textAlign: 'left', padding: '6px 8px',
                    borderRadius: '10px',
                    border: selectedSource === s.name ? `1.5px solid ${s.color}` : '1px solid transparent',
                    backgroundColor: selectedSource === s.name ? '#F8FAFC' : 'transparent',
                    cursor: s.orders.length > 0 ? 'pointer' : 'default'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: s.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontWeight: '800', color: '#0F172A', fontSize: '12px' }}>{s.value}</span>
                      <span style={{ fontSize: '10px', fontWeight: '800', color: s.color, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', padding: '1px 6px', borderRadius: '6px' }}>
                        {s.pct}%
                      </span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '5px', backgroundColor: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Math.max(s.value > 0 ? 2 : 0, Number(s.pct)))}%`, height: '100%', backgroundColor: s.color, borderRadius: '999px' }} />
                  </div>
                </button>
              )) : (
                <span style={{ fontSize: '12px', color: '#64748B' }}>No lead source data recorded yet.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3: RECENT DEALS WON + UPCOMING FOLLOW UPS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {/* 5. RECENT DEALS WON */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Recent Deals Won</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#059669',
                backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                Latest {analytics.recentWon.length}
              </span>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('Sales Proforma')}
                style={{ border: 'none', background: 'none', color: '#0E7490', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
              >
                View All <ArrowRight size={11} />
              </button>
            )}
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '240px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '7px 8px' }}>Customer</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>Deal Value</th>
                  <th style={{ padding: '7px 8px' }}>Product</th>
                  <th style={{ padding: '7px 8px' }}>Closed On</th>
                </tr>
              </thead>
              <tbody>
                {analytics.recentWon.length > 0 ? analytics.recentWon.map((d, idx) => (
                  <tr
                    key={idx}
                    onClick={() => {
                      setPopupSearch('');
                      setDrillPopup({ title: `Deal: ${d.docNo}`, color: '#059669', orders: [d] });
                    }}
                    style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '6px 8px', fontWeight: '700', color: '#0F172A' }}>{d.customer}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800', color: '#059669', whiteSpace: 'nowrap' }}>{formatINRCompact(d.value)}</td>
                    <td style={{ padding: '6px 8px', color: '#475569' }}>{d.product}</td>
                    <td style={{ padding: '6px 8px', color: '#64748B', whiteSpace: 'nowrap' }}>{formatShortDate(d.dateStr)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} style={{ padding: '18px', textAlign: 'center', color: '#64748B' }}>No won deals recorded in selected period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 6. UPCOMING FOLLOW UPS */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Upcoming Follow Ups</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#D97706',
                backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                {analytics.followUps.length} Scheduled
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'center' }}>
            {analytics.followUps.length > 0 ? analytics.followUps.map((f, idx) => {
              const pColor = f.priority === 'High' ? '#DC2626' : (f.priority === 'Low' ? '#059669' : '#D97706');
              const pBg = f.priority === 'High' ? '#FEF2F2' : (f.priority === 'Low' ? '#ECFDF5' : '#FFFBEB');
              const pBorder = f.priority === 'High' ? '#FECACA' : (f.priority === 'Low' ? '#A7F3D0' : '#FDE68A');
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '8px 12px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>{f.customer}</div>
                    <div style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748B' }}>{f.task} • {f.when}</div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: '800', color: pColor, backgroundColor: pBg, border: `1px solid ${pBorder}`, padding: '2px 8px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                    {f.priority}
                  </span>
                </div>
              );
            }) : (
              <div style={{ padding: '22px', textAlign: 'center', color: '#64748B', fontSize: '12px' }}>No upcoming follow-ups scheduled.</div>
            )}
          </div>
        </div>
      </div>

      {/* ROW 4: SALES FORECAST + REVENUE BY PRODUCT */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {/* 7. SALES FORECAST */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>Sales Forecast &amp; Target Attainment</span>
          </div>
          <div style={summaryStripStyle}>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Forecast Pipeline</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#2563EB' }}>{formatINRCompact(analytics.totalPipeline)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Committed (Won)</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#059669' }}>{formatINRCompact(analytics.totalRevenue)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Monthly Target</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>{formatINRCompact(companyTarget)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '800' }}>
              <span style={{ color: '#334155' }}>Target Achievement</span>
              <span style={{ color: '#0E7490' }}>
                {companyTarget > 0 ? Math.round((analytics.totalRevenue / companyTarget) * 100) : 0}%
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, companyTarget > 0 ? (analytics.totalRevenue / companyTarget) * 100 : 0)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #0E7490 0%, #059669 100%)',
                borderRadius: '999px'
              }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            {analytics.stageSegments.map((st, sIdx) => (
              <div key={sIdx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ fontWeight: '700', color: '#334155' }}>{st.name}</span>
                  <span style={{ fontWeight: '800', color: '#0F172A' }}>{formatINRCompact(st.value)} ({st.pct}%)</span>
                </div>
                <div style={{ width: '100%', height: '5px', backgroundColor: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.max(st.value > 0 ? 2 : 0, Number(st.pct)))}%`, height: '100%', backgroundColor: st.color, borderRadius: '999px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 8. REVENUE BY PRODUCT */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Revenue by Product</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#0E7490',
                backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                {analytics.revenueByProduct.length} Products
              </span>
            </div>
          </div>
          <div style={summaryStripStyle}>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Total Revenue</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>{formatINRCompact(analytics.totalRevenue)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Top Product</div>
              <div style={{ fontSize: '13px', fontWeight: '900', color: '#059669', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {analytics.revenueByProduct[0]?.name || '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Top Share</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0E7490' }}>
                {analytics.revenueByProduct[0]?.pct ? `${analytics.revenueByProduct[0].pct}%` : '0.0%'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {analytics.revenueByProduct.length > 0 ? analytics.revenueByProduct.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setPopupSearch('');
                  setDrillPopup({ title: `Product: ${p.name}`, color: p.color, orders: p.orders });
                }}
                style={{
                  border: 'none', background: 'none', padding: '2px 0', width: '100%', textAlign: 'left',
                  display: 'flex', flexDirection: 'column', gap: '4px', cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '3px', backgroundColor: p.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{ fontWeight: '800', color: '#0F172A' }}>{formatINRCompact(p.value)}</span>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: p.color, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '1px 6px', borderRadius: '6px' }}>
                      {p.pct}%
                    </span>
                  </div>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Number(p.pct))}%`, height: '100%', backgroundColor: p.color, borderRadius: '999px' }} />
                </div>
              </button>
            )) : (
              <div style={{ padding: '22px', textAlign: 'center', color: '#64748B', fontSize: '12px' }}>No product revenue recorded yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* DRILLDOWN MODAL */}
      {drillPopup && (() => {
        const q = popupSearch.trim().toLowerCase();
        const filtered = (drillPopup.orders || []).filter(o =>
          !q ||
          String(o.docNo || '').toLowerCase().includes(q) ||
          String(o.customer || '').toLowerCase().includes(q) ||
          String(o.rep || '').toLowerCase().includes(q)
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
                backgroundColor: '#FFFFFF', borderRadius: '18px', width: '760px', maxWidth: '100%',
                maxHeight: '84vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)', border: '1px solid #E2E8F0', overflow: 'hidden'
              }}
            >
              <div style={{
                padding: '14px 20px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Award size={16} color={drillPopup.color} />
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>{drillPopup.title}</span>
                  <span style={{
                    fontSize: '10.5px', fontWeight: '800', color: '#0E7490',
                    backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', padding: '2px 8px', borderRadius: '999px'
                  }}>
                    {filtered.length} Records
                  </span>
                </div>
                <button
                  type="button"
                  onClick={closePopup}
                  style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '5px', cursor: 'pointer', display: 'flex', color: '#475569' }}
                >
                  <X size={16} />
                </button>
              </div>
              <div style={{ padding: '10px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={14} color="#64748B" />
                <input
                  type="text"
                  value={popupSearch}
                  onChange={(e) => setPopupSearch(e.target.value)}
                  placeholder="Search reference, customer, or salesperson..."
                  style={{ flex: 1, border: '1px solid #CBD5E1', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', outline: 'none' }}
                />
              </div>
              <div style={{ overflowY: 'auto', padding: '12px 20px', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '8px' }}>Ref No.</th>
                      <th style={{ padding: '8px' }}>Customer</th>
                      <th style={{ padding: '8px' }}>Salesperson</th>
                      <th style={{ padding: '8px' }}>Date</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length > 0 ? filtered.map((o, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px', fontWeight: '800', color: '#0E7490', whiteSpace: 'nowrap' }}>{o.docNo}</td>
                        <td style={{ padding: '8px', fontWeight: '700', color: '#0F172A' }}>{o.customer}</td>
                        <td style={{ padding: '8px', color: '#475569' }}>{o.rep}</td>
                        <td style={{ padding: '8px', color: '#64748B', whiteSpace: 'nowrap' }}>{formatShortDate(o.dateStr)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>{formatINRCompact(o.value)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>No matching records found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
