import React, { useMemo, useState } from 'react';
import {
  ShoppingCart, TrendingUp, Users, Clock, Layers,
  FileText, AlertTriangle, ShieldAlert, CheckCircle2,
  X, Search, ArrowRight, Package
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
  const str = String(raw).trim();
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])).getTime();
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

export default function CeoProcurementAnalyticsSection({
  poList = [],
  grnList = [],
  inventoryList = [],
  onNavigateTab
}) {
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedTrendIdx, setSelectedTrendIdx] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [poPopup, setPoPopup] = useState(null);
  const [popupSearch, setPopupSearch] = useState('');
  const [detailPo, setDetailPo] = useState(null);

  const closePoPopup = () => {
    setPoPopup(null);
    setSelectedStatus(null);
    setSelectedCat(null);
    setPopupSearch('');
  };

  const analytics = useMemo(() => {
    const now = Date.now();
    const invCatLookup = new Map();
    (inventoryList || []).forEach((it) => {
      const key = String(it.name || it.itemName || '').trim().toLowerCase();
      if (key) invCatLookup.set(key, it.category || it.group || 'General Material');
    });

    const inferCategory = (items = []) => {
      if (!Array.isArray(items) || items.length === 0) return 'Others';
      const counts = new Map();
      for (const it of items) {
        const nm = String(it.name || it.itemName || it.description || '').trim();
        const lower = nm.toLowerCase();
        let cat = invCatLookup.get(lower) || it.category || '';
        if (!cat) {
          if (lower.includes('alu') || lower.includes('rail') || lower.includes('clamp')) {
            cat = 'Aluminium Profiles';
          } else if (lower.includes('hdg') || lower.includes('purlin') || lower.includes('rafter') || lower.includes('leg') || lower.includes('steel') || lower.includes('bracing')) {
            cat = 'HDG Steel';
          } else if (lower.includes('bolt') || lower.includes('nut') || lower.includes('washer') || lower.includes('screw') || lower.includes('fastener')) {
            cat = 'Fasteners & Accessories';
          } else if (lower.includes('panel') || lower.includes('inverter') || lower.includes('cable') || lower.includes('solar')) {
            cat = 'Solar & BOS';
          } else {
            cat = 'Others';
          }
        }
        counts.set(cat, (counts.get(cat) || 0) + 1);
      }
      let best = 'Others';
      let bestC = -1;
      counts.forEach((c, k) => {
        if (c > bestC) {
          bestC = c;
          best = k;
        }
      });
      return best;
    };

    const normalizeStatus = (po) => {
      const raw = String(po.status || po.stage || po.approvalStatus || '').trim();
      const lower = raw.toLowerCase();
      if (lower.includes('cancel') || lower.includes('reject')) return 'Cancelled';
      if (lower.includes('fully') || lower.includes('closed') || lower.includes('completed') || lower === 'received' || lower.includes('grn completed')) {
        return 'Fully Received';
      }
      if (lower.includes('partial')) return 'Partially Received';
      if (lower.includes('proceed') || lower.includes('approv') || lower.includes('issued') || lower.includes('sent') || lower.includes('payment') || lower.includes('open')) {
        return 'Approved';
      }
      return 'Draft';
    };

    let rawPOs = (poList || []).filter(Boolean);

    // Localhost-only demo data when local PO store is empty (NEVER runs on live/dev servers)
    const isLocalhostPreview =
      typeof window !== 'undefined' &&
      ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
      rawPOs.length === 0;

    if (isLocalhostPreview) {
      const today = new Date();
      const isoDaysAgo = (d) => new Date(today.getTime() - d * 86400000).toISOString().split('T')[0];
      rawPOs = [
        { poNo: 'PO-00086', vendorName: 'AKEYEM SONS', date: isoDaysAgo(1), deliveryDate: isoDaysAgo(-4), grandTotal: 5248000, status: 'Approved', items: [{ name: 'Alu. Rail 100 mm', category: 'Aluminium Profiles' }] },
        { poNo: 'PO-00085', vendorName: 'ARUMUGA STEEL', date: isoDaysAgo(2), deliveryDate: isoDaysAgo(-3), grandTotal: 2875600, status: 'Approved', items: [{ name: 'LEG 2500 mm (HDG)', category: 'HDG Steel' }] },
        { poNo: 'PO-00084', vendorName: 'VAIBOV POLES', date: isoDaysAgo(4), deliveryDate: isoDaysAgo(-6), grandTotal: 2164400, status: 'Approved', items: [{ name: 'RAFTER 3900 mm (GAL)', category: 'HDG Steel' }] },
        { poNo: 'PO-00083', vendorName: 'KPR Mill', date: isoDaysAgo(6), deliveryDate: isoDaysAgo(1), grandTotal: 1788000, status: 'Partially Received', items: [{ name: 'Mid Clamp 35mm', category: 'Aluminium Profiles' }] },
        { poNo: 'PO-00082', vendorName: 'SHREE GANESH TRADERS', date: isoDaysAgo(9), deliveryDate: isoDaysAgo(2), grandTotal: 1436000, status: 'Fully Received', items: [{ name: 'SS304 Hex Bolt M10*30', category: 'Fasteners & Accessories' }] },
        { poNo: 'PO-00079', vendorName: 'AKEYEM SONS', date: isoDaysAgo(18), deliveryDate: isoDaysAgo(6), grandTotal: 3420000, status: 'Partially Received', items: [{ name: 'Alu. Rail 60 mm', category: 'Aluminium Profiles' }] },
        { poNo: 'PO-00074', vendorName: 'ARUMUGA STEEL', date: isoDaysAgo(35), deliveryDate: isoDaysAgo(9), grandTotal: 1864000, status: 'Approved', items: [{ name: 'Purlin C Type 2400mm', category: 'HDG Steel' }] },
        { poNo: 'PO-00071', vendorName: 'KPR Mill', date: isoDaysAgo(44), deliveryDate: isoDaysAgo(7), grandTotal: 1248000, status: 'Draft', items: [{ name: 'T Nut M10', category: 'Fasteners & Accessories' }] },
        { poNo: 'PO-00063', vendorName: 'VAIBOV POLES', date: isoDaysAgo(65), deliveryDate: isoDaysAgo(12), grandTotal: 972000, status: 'Partially Received', items: [{ name: 'HDG Pipe 50 NB', category: 'HDG Steel' }] },
        { poNo: 'PO-00058', vendorName: 'SHREE GANESH TRADERS', date: isoDaysAgo(95), deliveryDate: isoDaysAgo(90), grandTotal: 1640000, status: 'Fully Received', items: [{ name: 'Solar Panel 550W', category: 'Solar & BOS' }] },
        { poNo: 'PO-00049', vendorName: 'AKEYEM SONS', date: isoDaysAgo(128), deliveryDate: isoDaysAgo(120), grandTotal: 2950000, status: 'Fully Received', items: [{ name: 'Alu. Rail 100 mm', category: 'Aluminium Profiles' }] },
        { poNo: 'PO-00042', vendorName: 'ARUMUGA STEEL', date: isoDaysAgo(155), deliveryDate: isoDaysAgo(148), grandTotal: 2410000, status: 'Fully Received', items: [{ name: 'LEG 3000 mm (HDG)', category: 'HDG Steel' }] }
      ];
    }

    const grnPoNumbers = new Set(
      (grnList || []).map(g => String(g?.poNumber || g?.poNo || '').trim().toUpperCase()).filter(Boolean)
    );

    const normalizedPOs = rawPOs.map((po, idx) => {
      const poNo = po.poNo || po.poNumber || po.purchaseorder_number || `PO-${idx + 1}`;
      const vendor = po.vendor || po.vendorName || po.vendor_name || po.supplierName || 'Vendor';
      const rawDate = po.poDate || po.date || po.createdAt || po.created_at || '';
      const dateTs = parseDateMs(rawDate);
      const rawDel = po.deliveryDate || po.expectedDeliveryDate || po.expectedDate || po.dueDate || '';
      const delTs = parseDateMs(rawDel);
      const value = parseAmount(po.grandTotal ?? po.total ?? po.totalAmount ?? po.amount ?? 0);
      let statusGroup = normalizeStatus(po);
      if (statusGroup !== 'Fully Received' && statusGroup !== 'Cancelled' && grnPoNumbers.has(String(poNo).trim().toUpperCase())) {
        statusGroup = 'Fully Received';
      }
      const rawStatus = po.status || po.stage || statusGroup;
      const ageDays = Number.isFinite(dateTs) ? Math.max(0, Math.floor((now - dateTs) / 86400000)) : 0;
      const isClosed = statusGroup === 'Fully Received' || statusGroup === 'Cancelled';
      let delayDays = 0;
      if (!isClosed) {
        if (Number.isFinite(delTs) && now > delTs) {
          delayDays = Math.max(1, Math.floor((now - delTs) / 86400000));
        } else if (!Number.isFinite(delTs) && ageDays > 15) {
          delayDays = ageDays - 15;
        }
      }
      const category = po.category || inferCategory(po.items);

      return {
        id: po.id || poNo,
        poNo,
        vendor,
        rawDate,
        dateTs,
        rawDel,
        delTs,
        value,
        statusGroup,
        rawStatus,
        ageDays,
        delayDays,
        category,
        itemsCount: Array.isArray(po.items) ? po.items.length : 0,
        rawPo: po
      };
    });

    const totalPOs = normalizedPOs.length;
    const totalValue = normalizedPOs.reduce((s, p) => s + p.value, 0);
    const receivedValue = normalizedPOs
      .filter(p => p.statusGroup === 'Fully Received')
      .reduce((s, p) => s + p.value, 0);
    const openValue = Math.max(0, totalValue - receivedValue);

    // 1. Purchase Status Segments
    const statusOrder = [
      { name: 'Draft', label: 'Draft / Pending', color: '#2563EB' },
      { name: 'Approved', label: 'Approved / Active', color: '#0E7490' },
      { name: 'Partially Received', label: 'Partially Received', color: '#D97706' },
      { name: 'Fully Received', label: 'Fully Received', color: '#059669' },
      { name: 'Cancelled', label: 'Cancelled', color: '#DC2626' }
    ];
    const statusSegments = statusOrder.map(st => {
      const list = normalizedPOs.filter(p => p.statusGroup === st.name);
      const val = list.reduce((s, p) => s + p.value, 0);
      return {
        name: st.label,
        key: st.name,
        color: st.color,
        value: list.length,
        amount: val,
        pct: totalPOs > 0 ? ((list.length / totalPOs) * 100).toFixed(1) : '0.0',
        orders: list
      };
    });

    // 2. PO Value Trend (Last 6 Months)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const curDate = new Date();
    const trendMap = new Map();
    const trendMonths = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(curDate.getFullYear(), curDate.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = {
        key,
        label: `${monthNames[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`,
        value: 0,
        count: 0,
        orders: []
      };
      trendMap.set(key, bucket);
      trendMonths.push(bucket);
    }
    normalizedPOs.forEach(p => {
      if (!Number.isFinite(p.dateTs)) return;
      const d = new Date(p.dateTs);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = trendMap.get(key);
      if (bucket) {
        bucket.value += p.value;
        bucket.count += 1;
        bucket.orders.push(p);
      }
    });

    // 3. Top 5 Vendors by PO Value
    const vendorMap = new Map();
    normalizedPOs.forEach(p => {
      const prev = vendorMap.get(p.vendor) || { vendor: p.vendor, value: 0, count: 0, onTimeCount: 0, orders: [] };
      prev.value += p.value;
      prev.count += 1;
      if (p.delayDays === 0) prev.onTimeCount += 1;
      prev.orders.push(p);
      vendorMap.set(p.vendor, prev);
    });
    const top5Vendors = Array.from(vendorMap.values())
      .map(v => ({
        ...v,
        pct: totalValue > 0 ? ((v.value / totalValue) * 100).toFixed(1) : '0.0',
        onTimePct: v.count > 0 ? ((v.onTimeCount / v.count) * 100).toFixed(1) : '100.0'
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // 4. PO Ageing Summary (By Value) - ONLY Approved / Payment Proceed / Partially Received POs still awaiting material inward (GRN)
    const openPOs = normalizedPOs.filter(p => p.statusGroup === 'Approved' || p.statusGroup === 'Partially Received');
    const ageingPool = openPOs;
    const ageingTotalVal = ageingPool.reduce((s, p) => s + p.value, 0);
    const ageingBrackets = [
      { label: '0 - 7 Days', color: '#059669', min: 0, max: 7 },
      { label: '8 - 15 Days', color: '#0E7490', min: 8, max: 15 },
      { label: '16 - 30 Days', color: '#2563EB', min: 16, max: 30 },
      { label: '31 - 60 Days', color: '#D97706', min: 31, max: 60 },
      { label: 'Above 60 Days', color: '#DC2626', min: 61, max: Infinity }
    ].map(b => {
      const orders = ageingPool.filter(p => p.ageDays >= b.min && p.ageDays <= b.max);
      const val = orders.reduce((s, p) => s + p.value, 0);
      return {
        ...b,
        value: val,
        count: orders.length,
        pct: ageingTotalVal > 0 ? ((val / ageingTotalVal) * 100).toFixed(1) : '0.0',
        orders
      };
    });

    // 5. Material Category Wise Purchase
    const catColors = ['#0E7490', '#059669', '#2563EB', '#D97706', '#7C3AED', '#64748B'];
    const catMap = new Map();
    normalizedPOs.forEach(p => {
      const prev = catMap.get(p.category) || { name: p.category, value: 0, count: 0, orders: [] };
      prev.value += p.value;
      prev.count += 1;
      prev.orders.push(p);
      catMap.set(p.category, prev);
    });
    const categorySegments = Array.from(catMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((c, idx) => ({
        ...c,
        color: catColors[idx % catColors.length],
        pct: totalValue > 0 ? ((c.value / totalValue) * 100).toFixed(1) : '0.0'
      }));

    // 6. Recently Raised POs
    const recentlyRaised = [...normalizedPOs]
      .sort((a, b) => (b.dateTs || 0) - (a.dateTs || 0))
      .slice(0, 6);

    // 7. Overdue POs
    const overduePOs = normalizedPOs
      .filter(p => p.delayDays > 0)
      .sort((a, b) => b.delayDays - a.delayDays);

    // 8. Low Stock / Material Shortages from inventoryList
    const lowStockItems = (inventoryList || []).filter(it => {
      const qty = parseFloat(it.stock ?? it.availableStock ?? it.available ?? it.quantity ?? 0) || 0;
      const minStock = parseFloat(it.minStock ?? it.reorderLevel ?? 10) || 10;
      return qty <= minStock;
    });
    const draftPOs = normalizedPOs.filter(p => p.statusGroup === 'Draft');
    const agedOpenPOs = openPOs.filter(p => p.ageDays > 30);

    const keyAlerts = [
      {
        title: `${overduePOs.length} Overdue PO${overduePOs.length === 1 ? '' : 's'} Pending Delivery`,
        sub: overduePOs.length > 0 ? `Max delay ${overduePOs[0].delayDays} days (${overduePOs[0].vendor})` : 'All active POs within delivery schedule',
        badge: overduePOs.length > 0 ? 'Follow Up' : 'On Time',
        color: overduePOs.length > 0 ? '#DC2626' : '#059669',
        bg: overduePOs.length > 0 ? '#FEF2F2' : '#F0FDF4',
        border: overduePOs.length > 0 ? '#FECACA' : '#BBF7D0',
        icon: AlertTriangle,
        orders: overduePOs
      },
      {
        title: `${draftPOs.length} PO${draftPOs.length === 1 ? '' : 's'} Awaiting MD / Approval`,
        sub: draftPOs.length > 0 ? `Pending value ${formatINRCompact(draftPOs.reduce((s, p) => s + p.value, 0))}` : 'No POs stuck in approval queue',
        badge: draftPOs.length > 0 ? 'Approval Due' : 'Cleared',
        color: draftPOs.length > 0 ? '#D97706' : '#059669',
        bg: draftPOs.length > 0 ? '#FFFBEB' : '#F0FDF4',
        border: draftPOs.length > 0 ? '#FDE68A' : '#BBF7D0',
        icon: Clock,
        orders: draftPOs
      },
      {
        title: `${lowStockItems.length} Material Shortage / Low Stock SKU${lowStockItems.length === 1 ? '' : 's'}`,
        sub: lowStockItems.length > 0 ? 'Items at or below minimum reorder threshold' : 'Inventory stock above reorder levels',
        badge: lowStockItems.length > 0 ? 'Reorder Now' : 'Healthy',
        color: lowStockItems.length > 0 ? '#DC2626' : '#059669',
        bg: lowStockItems.length > 0 ? '#FEF2F2' : '#F0FDF4',
        border: lowStockItems.length > 0 ? '#FECACA' : '#BBF7D0',
        icon: ShieldAlert,
        orders: [],
        navigateTab: 'Material Reorder'
      },
      {
        title: `${agedOpenPOs.length} Open PO${agedOpenPOs.length === 1 ? '' : 's'} Aged > 30 Days`,
        sub: agedOpenPOs.length > 0 ? `Pending value ${formatINRCompact(agedOpenPOs.reduce((s, p) => s + p.value, 0))}` : 'No long-pending open purchase orders',
        badge: agedOpenPOs.length > 0 ? 'Escalate' : 'Clean',
        color: agedOpenPOs.length > 0 ? '#2563EB' : '#059669',
        bg: agedOpenPOs.length > 0 ? '#EFF6FF' : '#F0FDF4',
        border: agedOpenPOs.length > 0 ? '#BFDBFE' : '#BBF7D0',
        icon: CheckCircle2,
        orders: agedOpenPOs
      }
    ];

    return {
      normalizedPOs,
      totalPOs,
      totalValue,
      receivedValue,
      openValue,
      statusSegments,
      trendMonths,
      top5Vendors,
      ageingPool,
      ageingTotalVal,
      ageingBrackets,
      categorySegments,
      recentlyRaised,
      overduePOs,
      keyAlerts
    };
  }, [poList, grnList, inventoryList]);

  const maxTrendVal = Math.max(1, ...analytics.trendMonths.map(m => m.value));
  const latestTrendIdx = Math.max(0, analytics.trendMonths.length - 1);
  const activeTrendIdx = selectedTrendIdx !== null && analytics.trendMonths[selectedTrendIdx] ? selectedTrendIdx : latestTrendIdx;
  const activeTrend = analytics.trendMonths[activeTrendIdx] || { label: '—', value: 0, count: 0, orders: [] };
  const peakTrend = analytics.trendMonths.reduce((best, m) => (m.value >= best.value ? m : best), analytics.trendMonths[0] || { label: '—', value: 0 });
  const avgMonthlySpend = analytics.trendMonths.length > 0
    ? analytics.trendMonths.reduce((s, m) => s + m.value, 0) / analytics.trendMonths.length
    : 0;

  const activeStatusSeg = selectedStatus ? analytics.statusSegments.find(s => s.name === selectedStatus) : null;
  const activeCatSeg = selectedCat ? analytics.categorySegments.find(c => c.name === selectedCat) : null;

  const freshAgeVal = analytics.ageingBrackets[0]?.value || 0;
  const midAgeVal = (analytics.ageingBrackets[1]?.value || 0) + (analytics.ageingBrackets[2]?.value || 0);
  const oldAgeVal = (analytics.ageingBrackets[3]?.value || 0) + (analytics.ageingBrackets[4]?.value || 0);
  const above60Val = analytics.ageingBrackets[4]?.value || 0;

  const statusBadgeStyle = (stGroup) => {
    if (stGroup === 'Fully Received') return { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' };
    if (stGroup === 'Partially Received') return { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' };
    if (stGroup === 'Cancelled') return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' };
    if (stGroup === 'Approved') return { bg: '#ECFEFF', color: '#0E7490', border: '#A5F3FC' };
    return { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ROW 1: PURCHASE STATUS + PO VALUE TREND */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {/* 1. PURCHASE STATUS */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={cardTitleStyle}>Purchase Status</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#0E7490',
                backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                {analytics.totalPOs} POs
              </span>
            </div>
          </div>

          <div style={summaryStripStyle}>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Total PO Value</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>{formatINRCompact(analytics.totalValue)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Received</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#059669' }}>{formatINRCompact(analytics.receivedValue)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Open Value</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0E7490' }}>{formatINRCompact(analytics.openValue)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, minHeight: '150px' }}>
            <DonutChartSvg
              segments={analytics.statusSegments}
              centerLabel={activeStatusSeg ? activeStatusSeg.value : analytics.totalPOs}
              centerSub={activeStatusSeg ? `${activeStatusSeg.pct}% Share` : 'Total POs'}
              activeName={selectedStatus}
              onSelectSegment={(name) => {
                const seg = analytics.statusSegments.find(s => s.name === name);
                if (!seg || seg.orders.length === 0) return;
                setSelectedStatus(name);
                setPopupSearch('');
                setPoPopup({ title: `Purchase Status: ${seg.name}`, color: seg.color, orders: seg.orders });
              }}
            />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
              {analytics.statusSegments.map((seg, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={seg.orders.length === 0}
                  onClick={() => {
                    if (seg.orders.length === 0) return;
                    setSelectedStatus(seg.name);
                    setPopupSearch('');
                    setPoPopup({ title: `Purchase Status: ${seg.name}`, color: seg.color, orders: seg.orders });
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: '4px',
                    width: '100%', textAlign: 'left', padding: '6px 8px',
                    borderRadius: '10px',
                    border: selectedStatus === seg.name ? `1.5px solid ${seg.color}` : '1px solid transparent',
                    backgroundColor: selectedStatus === seg.name ? '#F8FAFC' : 'transparent',
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

        {/* 2. PO VALUE TREND */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={cardTitleStyle}>PO Value Trend (6 Months)</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#059669',
                backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                Monthly Spend & POs
              </span>
            </div>
          </div>

          <div style={summaryStripStyle}>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>{activeTrend.label} Spend</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>{formatINRCompact(activeTrend.value)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>6-Mo Average</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0E7490' }}>{formatINRCompact(avgMonthlySpend)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Peak Month</div>
              <div style={{ fontSize: '13px', fontWeight: '900', color: '#059669', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {peakTrend.label} ({formatINRCompact(peakTrend.value)})
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
                const isSelected = idx === activeTrendIdx;
                const barH = m.value > 0 ? Math.max(18, Math.round((m.value / maxTrendVal) * 92)) : 6;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedTrendIdx(idx)}
                    title={`${m.label}: ${formatINRCompact(m.value)} (${m.count} POs)`}
                    style={{
                      flex: 1, border: 'none',
                      background: isSelected ? '#ECFEFF' : 'transparent',
                      borderRadius: '10px', padding: '4px 2px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                      gap: '5px', height: '100%', cursor: 'pointer',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <span style={{
                      fontSize: '10px', fontWeight: '800',
                      color: m.value > 0 ? (isSelected ? '#075985' : '#0E7490') : '#94A3B8',
                      whiteSpace: 'nowrap'
                    }}>
                      {formatINRCompact(m.value).replace('₹ ', '')}
                    </span>
                    <div style={{
                      width: '100%', maxWidth: '34px', height: `${barH}px`,
                      background: m.value <= 0
                        ? '#CBD5E1'
                        : (isSelected ? 'linear-gradient(180deg, #0E7490 0%, #075985 100%)' : '#BAE6FD'),
                      borderRadius: '6px 6px 2px 2px',
                      boxShadow: isSelected && m.value > 0 ? '0 4px 10px rgba(14, 116, 144, 0.25)' : 'none',
                      transition: 'all 0.18s ease'
                    }} />
                    <span style={{ fontSize: '10.5px', fontWeight: isSelected ? '800' : '700', color: isSelected ? '#0F172A' : '#64748B' }}>
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px dashed #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '11px' }}>
            <span style={{ fontWeight: '700', color: '#475569' }}>
              <strong style={{ color: '#0F172A' }}>{activeTrend.label}:</strong> {activeTrend.count} POs Raised
            </span>
            <button
              type="button"
              disabled={activeTrend.orders.length === 0}
              onClick={() => {
                if (activeTrend.orders.length === 0) return;
                setPopupSearch('');
                setPoPopup({ title: `POs Raised in ${activeTrend.label}`, color: '#0E7490', orders: activeTrend.orders });
              }}
              style={{
                fontSize: '10px', fontWeight: '800', color: '#0E7490',
                backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC',
                padding: '2px 8px', borderRadius: '999px',
                cursor: activeTrend.orders.length > 0 ? 'pointer' : 'default'
              }}
            >
              Total: {formatINRCompact(activeTrend.value)}
            </button>
          </div>
        </div>
      </div>

      {/* ROW 2: TOP 5 VENDORS BY PO VALUE + PO AGEING SUMMARY */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {/* 3. TOP 5 VENDORS BY PO VALUE */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Top 5 Vendors by PO Value</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#0E7490',
                backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                {analytics.top5Vendors.length} Vendors
              </span>
            </div>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '260px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '7px 8px' }}>Vendor Name</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>PO Value</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>% Share</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>On-Time %</th>
                  <th style={{ padding: '7px 8px', textAlign: 'center' }}>POs</th>
                </tr>
              </thead>
              <tbody>
                {analytics.top5Vendors.length > 0 ? analytics.top5Vendors.map((v, idx) => (
                  <tr
                    key={idx}
                    onClick={() => {
                      setPopupSearch('');
                      setPoPopup({ title: `Vendor POs: ${v.vendor}`, color: '#0E7490', orders: v.orders });
                    }}
                    style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '6px 8px', fontWeight: '700', color: '#0E7490', textDecoration: 'underline' }}>{v.vendor}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap' }}>{formatINRCompact(v.value)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', color: '#475569' }}>{v.pct}%</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800', color: Number(v.onTimePct) >= 90 ? '#059669' : '#D97706' }}>{v.onTimePct}%</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '700', color: '#334155' }}>{v.count}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} style={{ padding: '18px', textAlign: 'center', color: '#64748B' }}>
                      No vendor PO records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. PO AGEING SUMMARY */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={cardTitleStyle}>PO Ageing Summary (By Value)</span>
              <span style={{
                fontSize: '10px', fontWeight: '800',
                color: above60Val > 0 ? '#DC2626' : '#0E7490',
                backgroundColor: above60Val > 0 ? '#FEF2F2' : '#ECFEFF',
                border: `1px solid ${above60Val > 0 ? '#FECACA' : '#A5F3FC'}`,
                padding: '2px 8px', borderRadius: '999px'
              }}>
                {above60Val > 0 ? `60d+ Open: ${formatINRCompact(above60Val)}` : `${analytics.ageingPool.length} Open POs (Awaiting GRN)`}
              </span>
            </div>
          </div>

          <div style={summaryStripStyle}>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Fresh (0–7d)</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#059669' }}>{formatINRCompact(freshAgeVal)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Mid (8–30d)</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0E7490' }}>{formatINRCompact(midAgeVal)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Aged (&gt;30d)</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: oldAgeVal > 0 ? '#DC2626' : '#0F172A' }}>{formatINRCompact(oldAgeVal)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {analytics.ageingBrackets.map((ag, idx) => {
              const canOpen = ag.orders.length > 0;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!canOpen}
                  onClick={() => {
                    if (!canOpen) return;
                    setPopupSearch('');
                    setPoPopup({ title: `PO Ageing: ${ag.label}`, color: ag.color, orders: ag.orders });
                  }}
                  style={{
                    border: 'none', background: 'none', padding: '2px 0', width: '100%', textAlign: 'left',
                    display: 'flex', flexDirection: 'column', gap: '4px', cursor: canOpen ? 'pointer' : 'default'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <span style={{ width: '9px', height: '9px', borderRadius: '3px', backgroundColor: ag.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: '700', color: '#334155' }}>{ag.label}</span>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>({ag.count} {ag.count === 1 ? 'PO' : 'POs'})</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: '800', color: '#0F172A' }}>{formatINRCompact(ag.value)}</span>
                      <span style={{
                        fontSize: '10px', fontWeight: '800', color: ag.color,
                        backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0',
                        padding: '1px 6px', borderRadius: '6px'
                      }}>
                        {ag.pct}%
                      </span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Number(ag.pct))}%`, height: '100%', backgroundColor: ag.color, borderRadius: '999px' }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ROW 3: MATERIAL CATEGORY WISE PURCHASE + RECENTLY RAISED POS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {/* 5. MATERIAL CATEGORY WISE PURCHASE */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={cardTitleStyle}>Material Category Wise Purchase</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#0E7490',
                backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                {analytics.categorySegments.length} Categories
              </span>
            </div>
          </div>

          <div style={summaryStripStyle}>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Total Purchase</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>{formatINRCompact(analytics.totalValue)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Top Category</div>
              <div style={{ fontSize: '13px', fontWeight: '900', color: '#059669', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {analytics.categorySegments[0]?.name || '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Avg PO Value</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0E7490' }}>
                {formatINRCompact(analytics.totalPOs > 0 ? analytics.totalValue / analytics.totalPOs : 0)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, minHeight: '142px' }}>
            <DonutChartSvg
              segments={analytics.categorySegments}
              centerLabel={activeCatSeg ? formatINRCompact(activeCatSeg.value) : formatINRCompact(analytics.totalValue)}
              centerSub={activeCatSeg ? `${activeCatSeg.pct}% Share` : 'Total Purchase'}
              activeName={selectedCat}
              onSelectSegment={(name) => {
                const seg = analytics.categorySegments.find(c => c.name === name);
                if (!seg || seg.orders.length === 0) return;
                setSelectedCat(name);
                setPopupSearch('');
                setPoPopup({ title: `Category: ${seg.name}`, color: seg.color, orders: seg.orders });
              }}
            />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
              {analytics.categorySegments.length > 0 ? analytics.categorySegments.map((c, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={c.orders.length === 0}
                  onClick={() => {
                    if (c.orders.length === 0) return;
                    setSelectedCat(c.name);
                    setPopupSearch('');
                    setPoPopup({ title: `Category: ${c.name}`, color: c.color, orders: c.orders });
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: '4px',
                    width: '100%', textAlign: 'left', padding: '6px 8px',
                    borderRadius: '10px',
                    border: selectedCat === c.name ? `1.5px solid ${c.color}` : '1px solid transparent',
                    backgroundColor: selectedCat === c.name ? '#F8FAFC' : 'transparent',
                    cursor: c.orders.length > 0 ? 'pointer' : 'default',
                    transition: 'background-color 0.15s ease, border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: c.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', whiteSpace: 'nowrap' }}>({c.count})</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontWeight: '800', color: '#0F172A', fontSize: '12px' }}>{formatINRCompact(c.value)}</span>
                      <span style={{ fontSize: '10px', fontWeight: '800', color: c.color, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', padding: '1px 6px', borderRadius: '6px' }}>
                        {c.pct}%
                      </span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '5px', backgroundColor: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Math.max(2, Number(c.pct)))}%`, height: '100%', backgroundColor: c.color, borderRadius: '999px' }} />
                  </div>
                </button>
              )) : (
                <span style={{ fontSize: '12px', color: '#64748B' }}>No purchase category data available</span>
              )}
            </div>
          </div>
        </div>

        {/* 6. RECENTLY RAISED POS */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Recently Raised POs</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#0E7490',
                backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                Latest {analytics.recentlyRaised.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('Purchase Orders')}
              style={{ border: 'none', background: 'none', color: '#0E7490', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
            >
              View All <ArrowRight size={11} />
            </button>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '260px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '7px 8px' }}>PO No.</th>
                  <th style={{ padding: '7px 8px' }}>Vendor Name</th>
                  <th style={{ padding: '7px 8px' }}>Date</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>Value</th>
                  <th style={{ padding: '7px 8px' }}>Status</th>
                  <th style={{ padding: '7px 8px' }}>Delivery Date</th>
                </tr>
              </thead>
              <tbody>
                {analytics.recentlyRaised.length > 0 ? analytics.recentlyRaised.map((po, idx) => {
                  const badge = statusBadgeStyle(po.statusGroup);
                  return (
                    <tr
                      key={idx}
                      onClick={() => setDetailPo(po)}
                      style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '6px 8px', fontWeight: '800', color: '#0E7490', whiteSpace: 'nowrap', textDecoration: 'underline' }}>{po.poNo}</td>
                      <td style={{ padding: '6px 8px', fontWeight: '600', color: '#0F172A' }}>{po.vendor}</td>
                      <td style={{ padding: '6px 8px', color: '#475569', whiteSpace: 'nowrap' }}>{formatShortDate(po.rawDate)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap' }}>{formatINRCompact(po.value)}</td>
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: '800',
                          color: badge.color, backgroundColor: badge.bg, border: `1px solid ${badge.border}`,
                          padding: '2px 7px', borderRadius: '999px'
                        }}>
                          {po.statusGroup}
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px', color: '#475569', whiteSpace: 'nowrap' }}>{formatShortDate(po.rawDel)}</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6} style={{ padding: '18px', textAlign: 'center', color: '#64748B' }}>
                      No purchase orders raised yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ROW 4: OVERDUE POS + KEY ALERTS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {/* 7. OVERDUE POS */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Overdue POs</span>
              <span style={{
                fontSize: '10px', fontWeight: '800',
                color: analytics.overduePOs.length > 0 ? '#DC2626' : '#059669',
                backgroundColor: analytics.overduePOs.length > 0 ? '#FEF2F2' : '#ECFDF5',
                border: `1px solid ${analytics.overduePOs.length > 0 ? '#FECACA' : '#A7F3D0'}`,
                padding: '2px 8px', borderRadius: '999px'
              }}>
                {analytics.overduePOs.length} Overdue
              </span>
            </div>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '260px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '7px 8px' }}>PO No.</th>
                  <th style={{ padding: '7px 8px' }}>Vendor Name</th>
                  <th style={{ padding: '7px 8px' }}>PO Date</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>Value</th>
                  <th style={{ padding: '7px 8px', textAlign: 'center' }}>Delay (Days)</th>
                  <th style={{ padding: '7px 8px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {analytics.overduePOs.length > 0 ? analytics.overduePOs.map((po, idx) => (
                  <tr
                    key={idx}
                    onClick={() => setDetailPo(po)}
                    style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '6px 8px', fontWeight: '800', color: '#0E7490', whiteSpace: 'nowrap', textDecoration: 'underline' }}>{po.poNo}</td>
                    <td style={{ padding: '6px 8px', fontWeight: '600', color: '#0F172A' }}>{po.vendor}</td>
                    <td style={{ padding: '6px 8px', color: '#475569', whiteSpace: 'nowrap' }}>{formatShortDate(po.rawDate)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap' }}>{formatINRCompact(po.value)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '800', color: '#DC2626', whiteSpace: 'nowrap' }}>{po.delayDays}d</td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: '800', color: '#DC2626',
                        backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
                        padding: '2px 7px', borderRadius: '999px'
                      }}>
                        Overdue
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} style={{ padding: '18px', textAlign: 'center', color: '#059669', fontWeight: '700' }}>
                      No overdue purchase orders — all deliveries on track.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 8. KEY ALERTS */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Key Alerts</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#DC2626',
                backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                {analytics.keyAlerts.filter(a => a.color === '#DC2626' || a.color === '#D97706').length} Active
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'center' }}>
            {analytics.keyAlerts.map((al, idx) => {
              const IconComp = al.icon;
              const canClick = al.orders.length > 0 || Boolean(al.navigateTab && onNavigateTab);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!canClick}
                  onClick={() => {
                    if (al.orders.length > 0) {
                      setPopupSearch('');
                      setPoPopup({ title: `Alert: ${al.title}`, color: al.color, orders: al.orders });
                    } else if (al.navigateTab && onNavigateTab) {
                      onNavigateTab(al.navigateTab);
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '10px', width: '100%', textAlign: 'left',
                    padding: '10px 12px', borderRadius: '10px',
                    backgroundColor: al.bg, border: `1px solid ${al.border}`,
                    cursor: canClick ? 'pointer' : 'default'
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

      {/* DRILLDOWN PO POPUP MODAL */}
      {poPopup && (() => {
        const q = popupSearch.trim().toLowerCase();
        const filtered = (poPopup.orders || []).filter(o =>
          !q ||
          String(o.poNo || '').toLowerCase().includes(q) ||
          String(o.vendor || '').toLowerCase().includes(q) ||
          String(o.category || '').toLowerCase().includes(q)
        );
        return (
          <div
            onClick={closePoPopup}
            style={{
              position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(3px)', zIndex: 99999,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#FFFFFF', borderRadius: '18px', width: '780px', maxWidth: '100%',
                maxHeight: '84vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)', border: '1px solid #E2E8F0', overflow: 'hidden'
              }}
            >
              <div style={{
                padding: '14px 20px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: poPopup.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>{poPopup.title}</span>
                  <span style={{
                    fontSize: '10.5px', fontWeight: '800', color: '#0E7490',
                    backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', padding: '2px 8px', borderRadius: '999px'
                  }}>
                    {filtered.length} PO{filtered.length === 1 ? '' : 's'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={closePoPopup}
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
                  placeholder="Search PO number, vendor, or category..."
                  style={{
                    flex: 1, border: '1px solid #CBD5E1', borderRadius: '8px',
                    padding: '6px 10px', fontSize: '12px', outline: 'none'
                  }}
                />
              </div>

              <div style={{ overflowY: 'auto', padding: '12px 20px', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '8px' }}>PO No.</th>
                      <th style={{ padding: '8px' }}>Vendor</th>
                      <th style={{ padding: '8px' }}>Category</th>
                      <th style={{ padding: '8px' }}>PO Date</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Value</th>
                      <th style={{ padding: '8px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length > 0 ? filtered.map((o, idx) => (
                      <tr
                        key={idx}
                        onClick={() => setDetailPo(o)}
                        style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '8px', fontWeight: '800', color: '#0E7490', whiteSpace: 'nowrap', textDecoration: 'underline' }}>{o.poNo}</td>
                        <td style={{ padding: '8px', fontWeight: '700', color: '#0F172A' }}>{o.vendor}</td>
                        <td style={{ padding: '8px', color: '#475569' }}>{o.category}</td>
                        <td style={{ padding: '8px', color: '#475569', whiteSpace: 'nowrap' }}>{formatShortDate(o.rawDate)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap' }}>{formatINRCompact(o.value)}</td>
                        <td style={{ padding: '8px', fontWeight: '700', color: o.delayDays > 0 ? '#DC2626' : '#059669' }}>
                          {o.delayDays > 0 ? `${o.statusGroup} (${o.delayDays}d late)` : o.statusGroup}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                          <Package size={18} style={{ display: 'inline', marginBottom: '4px' }} /> No matching purchase orders.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* FULL PO DETAIL PAGE POPUP (Matches PurchaseOrdersView Read-Only Document Layout) */}
      {detailPo && (() => {
        const raw = detailPo.rawPo || {};
        const items = Array.isArray(raw.items) ? raw.items : [];
        const badge = statusBadgeStyle(detailPo.statusGroup);
        const poDateStr = detailPo.rawDate ? formatShortDate(detailPo.rawDate) : '—';
        const delDateStr = detailPo.rawDel ? formatShortDate(detailPo.rawDel) : '—';
        const priority = raw.priority || 'Medium';
        const paymentTerms = raw.paymentTerms === 'Advance'
          ? `Advance (${raw.advancePaidPct || 40}% Paid / ${Math.max(0, 100 - Number(raw.advancePaidPct || 40))}% Pending)`
          : (raw.paymentTerms || 'Immediate');
        const purchaser = raw.purchaser || raw.createdBy || raw.issuedBy || 'Procurement Team';
        const companyName = raw.companyName || raw.companyLocation || raw.branch || 'VRM Structures India Pvt Ltd';
        const deliveryCompanyName = raw.deliveryCompanyName || companyName;
        const deliveryAddress = raw.deliveryAddress || raw.delivery_address || '—';

        const fmtStageStamp = (isoOrStr, fallbackDate, fallbackTime) => {
          if (fallbackDate && fallbackTime) return `${fallbackDate}, ${fallbackTime}`;
          if (isoOrStr) {
            const parsed = new Date(isoOrStr);
            if (!Number.isNaN(parsed.getTime()) && String(isoOrStr).includes('T')) {
              const dStr = parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
              const tStr = parsed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
              return `${dStr}, ${tStr}`;
            }
          }
          return fallbackDate || (isoOrStr ? String(isoOrStr) : '');
        };

        const st = String(detailPo.rawStatus || '').trim();
        const stLower = st.toLowerCase();
        const totalRec = Number(raw.totalReceived || raw.totalReceivedQty || 0);
        const grnCount = Number(raw.grnCount || (Array.isArray(raw.grnHistory) ? raw.grnHistory.length : 0));
        const isClosed = detailPo.statusGroup === 'Fully Received' || stLower.includes('closed') || stLower.includes('fully received');
        const isPartial = detailPo.statusGroup === 'Partially Received' || stLower.includes('partial') || totalRec > 0 || grnCount > 0;
        const isProceed = stLower.includes('proceed') || stLower.includes('pending grn') || !!raw.proceedDetails || isPartial || isClosed;
        const isPaymentDone = stLower.includes('payment') || !!raw.paymentDetails || isProceed;
        const isMdApproved = detailPo.statusGroup === 'Approved' || stLower.includes('md approved') || stLower === 'open' || isPaymentDone;
        const isPending = (detailPo.statusGroup === 'Draft' || stLower.includes('pending') || stLower.includes('waiting')) && !isMdApproved;

        let currentStepIndex = 0;
        if (isClosed) currentStepIndex = 5;
        else if (isPartial || isProceed) currentStepIndex = 4;
        else if (isPaymentDone) currentStepIndex = 3;
        else if (isMdApproved) currentStepIndex = 2;
        else if (isPending) currentStepIndex = 1;

        const steps = [
          { label: '1. PO Created', timestamp: fmtStageStamp(raw.createdAt || raw.created_at, raw.poDate || raw.date, raw.createdTime) },
          { label: '2. MD Approval', timestamp: isMdApproved ? fmtStageStamp(raw.approvedAt || raw.approved_at, raw.approvedDate, raw.approvedTime) : '' },
          { label: '3. Payment Process', timestamp: isPaymentDone ? fmtStageStamp(raw.paymentDetails?.paidAt, raw.paymentDetails?.date, raw.paymentDetails?.time) : '' },
          { label: '4. Proceed PO', timestamp: isProceed ? fmtStageStamp(raw.proceedDetails?.proceededAt, raw.proceedDetails?.date, raw.proceedDetails?.time) : '' },
          { label: '5. GRN Process', timestamp: (isPartial || isClosed) ? fmtStageStamp(raw.updatedAt, '', '') : '' },
          { label: '6. GRN Completed', timestamp: isClosed ? fmtStageStamp(raw.updatedAt, '', '') : '' }
        ].map((step, idx) => ({
          ...step,
          done: idx < currentStepIndex || (currentStepIndex === 5 && idx === 5),
          current: idx === currentStepIndex && currentStepIndex !== 5,
          finalDone: currentStepIndex === 5 && idx === 5
        }));

        const grandTotal = detailPo.value || parseAmount(raw.grandTotal ?? raw.total ?? 0);

        return (
          <div
            onClick={() => setDetailPo(null)}
            style={{
              position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(3px)', zIndex: 100000,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#F8FAFC', borderRadius: '18px', width: '940px', maxWidth: '100%',
                maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.4)', border: '1px solid #E2E8F0', overflow: 'hidden'
              }}
            >
              {/* Modal Top Bar */}
              <div style={{
                padding: '14px 20px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#ECFEFF',
                    border: '1px solid #A5F3FC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <FileText size={18} color="#0E7490" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>
                        Purchase Order: {detailPo.poNo}
                      </span>
                      <span style={{
                        fontSize: '10.5px', fontWeight: '800', color: badge.color,
                        backgroundColor: badge.bg, border: `1px solid ${badge.border}`,
                        padding: '2px 9px', borderRadius: '999px'
                      }}>
                        {detailPo.rawStatus}
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                      Vendor: <strong style={{ color: '#0F172A' }}>{detailPo.vendor}</strong> • PO Date: {poDateStr}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailPo(null)}
                  style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex', color: '#475569' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* PO Lifecycle & Workflow History */}
                <div style={{ padding: '18px 20px', borderRadius: '12px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '12.5px', color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      PO Lifecycle &amp; Workflow History
                    </strong>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>PO Ref: {detailPo.poNo}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', padding: '8px 0' }}>
                    {steps.map((step, idx, arr) => (
                      <React.Fragment key={idx}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', zIndex: 2, flex: 1 }}>
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            backgroundColor: step.current ? '#2563EB' : (step.done || step.finalDone ? '#16A34A' : '#E2E8F0'),
                            color: (step.current || step.done || step.finalDone) ? '#FFFFFF' : '#64748B',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontWeight: 'bold',
                            boxShadow: step.current ? '0 0 0 4px #DBEAFE' : 'none'
                          }}>
                            {(step.done || step.finalDone) ? '✓' : (idx + 1)}
                          </div>
                          <span style={{ fontSize: '10px', fontWeight: step.current ? 'bold' : '600', color: step.current ? '#2563EB' : ((step.done || step.finalDone) ? '#16A34A' : '#64748B'), textAlign: 'center', marginTop: '2px' }}>
                            {step.label}
                          </span>
                          {step.timestamp && (step.done || step.finalDone || step.current) && (
                            <span style={{ fontSize: '9px', color: '#64748B', fontWeight: '500', textAlign: 'center', lineHeight: '1.25' }}>
                              {step.timestamp}
                            </span>
                          )}
                        </div>
                        {idx < arr.length - 1 && (
                          <div style={{ height: '2px', backgroundColor: step.done ? '#16A34A' : '#E2E8F0', flex: 1, marginTop: '13px' }} />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Official Purchase Order Document Card */}
                <div style={{
                  padding: '26px 28px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px',
                  borderTop: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', borderLeft: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1E293B', margin: 0, letterSpacing: '-0.4px' }}>
                        {companyName}
                      </h2>
                      {(raw.companyAddress || raw.branchAddress) && (
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                          {raw.companyAddress || raw.branchAddress}
                        </div>
                      )}
                      {raw.companyGst && (
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                          GSTIN: <strong>{raw.companyGst}</strong>
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                      <div style={{ fontSize: '19px', fontWeight: '900', color: '#0F172A', letterSpacing: '1px' }}>PURCHASE ORDER</div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <strong style={{ fontSize: '13px', color: '#0E7490' }}>{detailPo.poNo}</strong>
                        <span style={{
                          padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold',
                          backgroundColor: (priority === 'Critical' || priority === 'High') ? '#FEE2E2' : (priority === 'Medium' ? '#FEF3C7' : '#ECFEFF'),
                          color: (priority === 'Critical' || priority === 'High') ? '#EF4444' : (priority === 'Medium' ? '#D97706' : '#0E7490')
                        }}>
                          {priority} Priority
                        </span>
                      </div>
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: 0 }} />

                  {/* Info Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px', fontSize: '11px' }}>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold' }}>PO Date</span>
                      <strong style={{ color: '#1E293B', display: 'block', marginTop: '2px' }}>{poDateStr}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold' }}>Expected Delivery Date</span>
                      <strong style={{ color: detailPo.delayDays > 0 ? '#DC2626' : '#1E293B', display: 'block', marginTop: '2px' }}>{delDateStr}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold' }}>Payment Terms</span>
                      <strong style={{ color: '#1E293B', display: 'block', marginTop: '2px' }}>{paymentTerms}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold' }}>PO Issued By</span>
                      <strong style={{ color: '#1E293B', display: 'block', marginTop: '2px' }}>{purchaser}</strong>
                    </div>
                  </div>

                  {/* Vendor Details & Delivery Address */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '11px' }}>
                    <div style={{ border: '1px solid #F1F5F9', borderRadius: '8px', padding: '14px 16px', backgroundColor: '#F8FAFC' }}>
                      <strong style={{ fontSize: '11px', color: '#2563EB', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Vendor Details</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <strong style={{ fontSize: '13px', color: '#0F172A' }}>{detailPo.vendor}</strong>
                        {raw.branch && <span style={{ color: '#475569' }}>Branch: {raw.branch}</span>}
                        {raw.contactPerson && <span style={{ color: '#475569' }}>Attn: {raw.contactPerson}</span>}
                        {(raw.contactNo || raw.vendorPhone) && <span style={{ color: '#475569' }}>Phone: {raw.contactNo || raw.vendorPhone}</span>}
                        {(raw.email || raw.vendorEmail) && <span style={{ color: '#475569' }}>Email: {raw.email || raw.vendorEmail}</span>}
                        {(raw.billingAddress || raw.billing_address) && (
                          <span style={{ color: '#334155', marginTop: '4px', lineHeight: '1.4' }}>
                            <strong style={{ color: '#0F172A' }}>Billing Address: </strong>{raw.billingAddress || raw.billing_address}
                          </span>
                        )}
                        {(raw.gstNo || raw.vendorGst) && (
                          <span style={{ color: '#475569', fontWeight: 'bold', marginTop: '2px' }}>GSTIN: {raw.gstNo || raw.vendorGst}</span>
                        )}
                      </div>
                    </div>

                    <div style={{ border: '1px solid #F1F5F9', borderRadius: '8px', padding: '14px 16px', backgroundColor: '#F8FAFC' }}>
                      <strong style={{ fontSize: '11px', color: '#0E7490', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Delivery Address</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <strong style={{ fontSize: '13px', color: '#0F172A' }}>{deliveryCompanyName}</strong>
                        <span style={{ color: '#334155', lineHeight: '1.45' }}>{deliveryAddress}</span>
                      </div>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div style={{ overflowX: 'auto', width: '100%' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                          <th style={{ padding: '8px', textAlign: 'center', width: '40px' }}>#</th>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Item &amp; Description</th>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Account</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>Qty</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>Unit</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Rate (₹)</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>GST (%)</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length > 0 ? items.map((item, idx) => {
                          const itemTax = (item.tax !== undefined && item.tax !== '' && !isNaN(Number(item.tax))) ? Number(item.tax) : 18;
                          const qtyNum = Number(item.qty ?? item.quantity) || 0;
                          const rateNum = Number(item.rate ?? item.unitPrice ?? item.price) || 0;
                          const baseTot = qtyNum * rateNum;
                          const finalAmt = parseAmount(item.total ?? item.amount ?? (baseTot + baseTot * (itemTax / 100)));
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px', textAlign: 'center', color: '#64748B' }}>{idx + 1}</td>
                              <td style={{ padding: '8px', fontWeight: '700', color: '#0F172A' }}>{item.name || item.itemName || item.description || 'Item'}</td>
                              <td style={{ padding: '8px', color: '#475569' }}>{item.account || 'Cost of Goods Sold'}</td>
                              <td style={{ padding: '8px', textAlign: 'center', fontWeight: '600' }}>{qtyNum.toLocaleString('en-IN')}</td>
                              <td style={{ padding: '8px', textAlign: 'center', color: '#475569' }}>{item.unit || item.uom || 'NOS'}</td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>₹ {rateNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td style={{ padding: '8px', textAlign: 'center', color: '#475569' }}>{itemTax}%</td>
                              <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>₹ {finalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          );
                        }) : (
                          <tr>
                            <td colSpan={8} style={{ padding: '16px', textAlign: 'center', color: '#64748B' }}>No line items recorded on this PO.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Bottom Bar */}
              <div style={{
                padding: '12px 20px', borderTop: '1px solid #E2E8F0', backgroundColor: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap'
              }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>
                  Grand Total:{' '}
                  <strong style={{ fontSize: '15px', fontWeight: '900', color: '#0E7490' }}>
                    ₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setDetailPo(null)}
                    style={{
                      border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#334155',
                      fontSize: '12px', fontWeight: '700', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                  {onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => {
                        setDetailPo(null);
                        setPoPopup(null);
                        onNavigateTab('Purchase Orders');
                      }}
                      style={{
                        border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF',
                        fontSize: '12px', fontWeight: '800', padding: '7px 14px', borderRadius: '8px',
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px'
                      }}
                    >
                      Manage in Purchase Orders <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
