import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import CeoKpiGrid from '../ceoDashboard/CeoKpiGrid';
import { triggerCeoDrilldown } from '../../utils/ceoDrilldownFilter';

const parseNum = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const cleaned = String(v ?? '0').replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const parseDateMs = (raw) => {
  if (!raw) return NaN;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw < 1e12 ? raw * 1000 : raw;
  const s = String(raw).trim();
  if (!s || s === '—' || s === '-') return NaN;
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) return parsed;
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    const day = Number(m[1]);
    const mon = Number(m[2]) - 1;
    const yr = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return new Date(yr, mon, day).getTime();
  }
  return NaN;
};

const formatCompactINR = (val) => {
  const n = Number(val) || 0;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};

const formatCroreNum = (val) => ((Number(val) || 0) / 10000000).toFixed(2);

const formatShortDate = (ms) => {
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const BusinzSectionCard = ({ title, subtitle, rightNode, bodyPadding = '0', children }) => (
  <div style={{
    backgroundColor: '#FFFFFF',
    border: '1px solid #EAEFEF',
    borderRadius: '14px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
      padding: '12px 16px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #EAEFEF'
    }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>{title}</h3>
        {subtitle && <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{subtitle}</div>}
      </div>
      {rightNode}
    </div>
    <div style={{ padding: bodyPadding, flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
  </div>
);

const thStyle = {
  padding: '8px 12px',
  fontSize: '11px',
  fontWeight: '700',
  color: '#64748B',
  borderBottom: '1px solid #E2E8F0',
  backgroundColor: '#F8FAFC',
  whiteSpace: 'nowrap'
};

const tdStyle = {
  padding: '9px 12px',
  fontSize: '12px',
  borderBottom: '1px solid #F1F5F9',
  verticalAlign: 'middle'
};

const selectStyle = {
  padding: '6px 10px',
  borderRadius: '8px',
  border: '1px solid #E2E8F0',
  backgroundColor: '#FFFFFF',
  color: '#0F172A',
  fontSize: '12px',
  fontWeight: '600',
  outline: 'none'
};

const TABLE_FILTERS = [
  { id: 'needs_attention', label: 'Needs Attention' },
  { id: 'all', label: 'All Stock' },
  { id: 'fast', label: 'Fast Moving' },
  { id: 'slow', label: 'Slow Moving' },
  { id: 'non_moving', label: 'Non-Moving' },
  { id: 'ageing', label: 'Ageing' },
  { id: 'high_value', label: 'High Value' }
];

export default function CeoInventoryAnalyticsSection({
  inventoryList = [],
  allBomList = [],
  allGrnList = [],
  allPoList = [],
  onNavigateTab
}) {
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [asOfDate, setAsOfDate] = useState(todayIso);
  const [warehouseFilter, setWarehouseFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [tableTab, setTableTab] = useState('needs_attention');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const analytics = useMemo(() => {
    const parsedAsOf = Date.parse(asOfDate);
    const asOfEndMs = Number.isFinite(parsedAsOf)
      ? parsedAsOf + 86400000 - 1
      : Date.now();
    const now = asOfEndMs;
    const todayStr = new Date(asOfEndMs).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();

    // Build latest GRN receipt date & open PO ETA by item as of selected date
    const lastReceiptByItem = new Map();
    (allGrnList || []).forEach((g) => {
      const ms = parseDateMs(g.grnDate || g.receivedDate || g.date || g.createdAt);
      if (!Number.isFinite(ms) || ms > asOfEndMs) return;
      (g.items || []).forEach((it) => {
        const key = String(it.itemName || it.name || it.sku || '').trim().toLowerCase();
        if (!key) return;
        const prev = lastReceiptByItem.get(key);
        if (!prev || ms > prev) lastReceiptByItem.set(key, ms);
      });
    });

    const openPoEtaByItem = new Map();
    (allPoList || []).forEach((po) => {
      if (!po || po.cancelled) return;
      const poDateMs = parseDateMs(po.date || po.createdAt);
      if (Number.isFinite(poDateMs) && poDateMs > asOfEndMs) return;
      const st = String(po.status || '').toLowerCase();
      if (st.includes('received') || st.includes('closed') || st.includes('cancel')) return;
      const etaMs = parseDateMs(po.expectedDeliveryDate || po.deliveryDate || po.dueDate);
      const etaStr = Number.isFinite(etaMs) ? `PO · ${formatShortDate(etaMs)}` : (po.poNumber || po.poNo || 'PO Open');
      (po.items || []).forEach((it) => {
        const key = String(it.itemName || it.name || it.description || it.sku || '').trim().toLowerCase();
        if (key && !openPoEtaByItem.has(key)) openPoEtaByItem.set(key, { etaStr, qty: parseNum(it.qty || it.quantity), rate: parseNum(it.rate || it.unitPrice) });
      });
    });

    // Compute 30-day BOM consumption days per item for Fast/Slow/Non-Moving as of selected date
    const thirtyDaysAgo = asOfEndMs - 30 * 86400000;
    const itemIssueDays = new Map();
    const reservedQtyByItem = new Map();
    (allBomList || []).forEach((b) => {
      if (!b || b.cancelled) return;
      const st = String(b.status || '').toLowerCase();
      if (st.includes('cancel')) return;
      const createdMs = parseDateMs(b.date || b.createdAt);
      if (Number.isFinite(createdMs) && createdMs > asOfEndMs) return;
      const dispMs = parseDateMs(b.dispatchedAt);
      const isDispatched = Boolean((b.dispatchedAt && (!Number.isFinite(dispMs) || dispMs <= asOfEndMs)) || st === 'dispatched' || st === 'closed' || st === 'completed');
      const bMs = parseDateMs(b.dispatchedAt || b.date || b.createdAt);
      const dayKey = Number.isFinite(bMs) && bMs <= asOfEndMs ? new Date(bMs).toISOString().slice(0, 10) : null;
      (b.items || []).forEach((it) => {
        const key = String(it.itemName || it.name || it.description || it.sku || '').trim().toLowerCase();
        if (!key) return;
        const q = parseNum(it.qty || it.quantity);
        if (!isDispatched) {
          reservedQtyByItem.set(key, (reservedQtyByItem.get(key) || 0) + q);
        }
        if (dayKey && bMs >= thirtyDaysAgo && bMs <= asOfEndMs) {
          if (!itemIssueDays.has(key)) itemIssueDays.set(key, new Set());
          itemIssueDays.get(key).add(dayKey);
        }
      });
    });

    const warehouses = new Set(['Madhavaram Warehouse', 'Stock Area']);
    const categories = new Set();

    const normalized = (inventoryList || []).map((it, idx) => {
      const name = String(it.itemName || it.name || it.description || `Item ${idx + 1}`).trim();
      const sku = String(it.sku || it.itemCode || it.code || '').trim();
      const category = String(it.category || it.group || 'General').trim();
      const rawWarehouse = String(it.warehouse || it.location || it.branch || '').trim();
      const combinedText = `${name} ${sku} ${category}`.toLowerCase();
      const isSolarModule =
        combinedText.includes('solar panel') ||
        combinedText.includes('pv module') ||
        /\bmodules?\b/.test(combinedText) ||
        rawWarehouse.toLowerCase().includes('stock area');
      const warehouse = isSolarModule ? 'Stock Area' : 'Madhavaram Warehouse';
      const unit = String(it.uom || it.unit || 'Nos').trim();

      warehouses.add(warehouse);
      categories.add(category);

      const onHandQty = Math.max(0, parseNum(it.stock ?? it.qty ?? it.quantity ?? it.currentStock ?? it.availableQty ?? 0));
      const rate = parseNum(it.rate ?? it.unitPrice ?? it.price ?? it.cost ?? 0);
      const minStock = parseNum(it.minStock ?? it.reorderLevel ?? it.minLevel ?? 0);
      const holdQty = Math.max(0, parseNum(it.holdQty ?? 0));

      const key = name.toLowerCase();
      const reservedQty = Math.min(onHandQty, reservedQtyByItem.get(key) || 0);
      const availableQty = Math.max(0, onHandQty - reservedQty - holdQty);
      const shortfall = minStock > 0 ? Math.max(0, minStock - availableQty) : 0;

      const onHandValue = onHandQty * rate;
      const availableValue = availableQty * rate;
      const reservedValue = reservedQty * rate;
      const holdValue = holdQty * rate;

      const openPo = openPoEtaByItem.get(key);
      const inTransitValue = openPo ? (openPo.qty * (openPo.rate || rate)) : 0;

      const receiptMs = lastReceiptByItem.get(key) || parseDateMs(it.lastRestockedAt || it.updatedAt || it.createdAt);
      const ageDays = Number.isFinite(receiptMs) ? Math.max(0, Math.floor((now - receiptMs) / 86400000)) : 15;

      const issueDaysCount = itemIssueDays.get(key)?.size || 0;
      const movement = issueDaysCount >= 4 ? 'Fast Moving' : issueDaysCount >= 1 ? 'Slow Moving' : 'Non-Moving';

      let stockStatus = 'In Stock';
      if (onHandQty <= 0) stockStatus = 'Out of Stock';
      else if (minStock > 0 && availableQty < minStock) stockStatus = 'Below Minimum';

      return {
        id: it.id || sku || `${key}-${idx}`,
        name,
        sku,
        warehouse,
        category,
        unit,
        onHandQty,
        availableQty,
        minStock,
        shortfall,
        rate,
        onHandValue,
        availableValue,
        reservedValue,
        holdValue,
        inTransitValue,
        eta: openPo?.etaStr || '—',
        ageDays,
        movement,
        stockStatus
      };
    });

    const filtered = normalized.filter((it) => {
      if (warehouseFilter !== 'All' && it.warehouse !== warehouseFilter) return false;
      if (categoryFilter !== 'All' && it.category !== categoryFilter) return false;
      return true;
    });

    const totalValue = filtered.reduce((s, i) => s + i.onHandValue, 0);
    const skusWithStock = filtered.filter((i) => i.onHandQty > 0).length;
    const outOfStockCount = filtered.filter((i) => i.stockStatus === 'Out of Stock').length;
    const lowStockCount = filtered.filter((i) => i.stockStatus === 'Below Minimum').length;
    const agedStockValue = filtered.filter((i) => i.ageDays > 90).reduce((s, i) => s + i.onHandValue, 0);
    const agedPct = totalValue > 0 ? ((agedStockValue / totalValue) * 100).toFixed(1) : '0.0';

    // Warehouse breakdown (always show both Madhavaram Warehouse and Stock Area)
    const whMap = new Map();
    if (warehouseFilter === 'All' || warehouseFilter === 'Madhavaram Warehouse') {
      whMap.set('Madhavaram Warehouse', { warehouse: 'Madhavaram Warehouse', onHand: 0, available: 0, reserved: 0, hold: 0, inTransit: 0 });
    }
    if (warehouseFilter === 'All' || warehouseFilter === 'Stock Area') {
      whMap.set('Stock Area', { warehouse: 'Stock Area', onHand: 0, available: 0, reserved: 0, hold: 0, inTransit: 0 });
    }
    filtered.forEach((it) => {
      const w = whMap.get(it.warehouse) || { warehouse: it.warehouse, onHand: 0, available: 0, reserved: 0, hold: 0, inTransit: 0 };
      w.onHand += it.onHandValue;
      w.available += it.availableValue;
      w.reserved += it.reservedValue;
      w.hold += it.holdValue;
      w.inTransit += it.inTransitValue;
      whMap.set(it.warehouse, w);
    });
    const warehouseRows = Array.from(whMap.values()).sort((a, b) => b.onHand - a.onHand);
    const whTotals = warehouseRows.reduce((acc, r) => ({
      onHand: acc.onHand + r.onHand,
      available: acc.available + r.available,
      reserved: acc.reserved + r.reserved,
      hold: acc.hold + r.hold,
      inTransit: acc.inTransit + r.inTransit
    }), { onHand: 0, available: 0, reserved: 0, hold: 0, inTransit: 0 });

    // Ageing buckets
    const buckets = [
      { label: '0–30 days', min: 0, max: 30, color: '#0E7490', val: 0 },
      { label: '31–60 days', min: 31, max: 60, color: '#3B82F6', val: 0 },
      { label: '61–90 days', min: 61, max: 90, color: '#60A5FA', val: 0 },
      { label: '91–180 days', min: 91, max: 180, color: '#D97706', val: 0 },
      { label: '181+ days', min: 181, max: Infinity, color: '#DC2626', val: 0 }
    ];
    filtered.forEach((it) => {
      const b = buckets.find((x) => it.ageDays >= x.min && it.ageDays <= x.max) || buckets[0];
      b.val += it.onHandValue;
    });
    const ageingRows = buckets.map((b) => ({
      ...b,
      pct: totalValue > 0 ? (b.val / totalValue) * 100 : 0
    }));

    return {
      todayStr,
      timeStr,
      warehouses: Array.from(warehouses).sort(),
      categories: Array.from(categories).sort(),
      filtered,
      totalCount: filtered.length,
      totalValue,
      skusWithStock,
      outOfStockCount,
      lowStockCount,
      agedStockValue,
      agedPct,
      warehouseRows,
      whTotals,
      ageingRows
    };
  }, [inventoryList, allBomList, allGrnList, allPoList, warehouseFilter, categoryFilter, asOfDate]);

  const tableRows = useMemo(() => {
    let list = [...analytics.filtered];
    if (tableTab === 'needs_attention') {
      list = list.filter((i) => i.stockStatus === 'Out of Stock' || i.stockStatus === 'Below Minimum');
      list.sort((a, b) => (a.availableQty - b.availableQty) || (b.shortfall - a.shortfall));
    } else if (tableTab === 'fast') {
      list = list.filter((i) => i.movement === 'Fast Moving');
    } else if (tableTab === 'slow') {
      list = list.filter((i) => i.movement === 'Slow Moving');
    } else if (tableTab === 'non_moving') {
      list = list.filter((i) => i.movement === 'Non-Moving');
    } else if (tableTab === 'ageing') {
      list = list.filter((i) => i.ageDays > 90).sort((a, b) => b.ageDays - a.ageDays);
    } else if (tableTab === 'high_value') {
      list.sort((a, b) => b.onHandValue - a.onHandValue);
    }
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || i.warehouse.toLowerCase().includes(q));
    }
    return list;
  }, [analytics.filtered, tableTab, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = tableRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const drillToInventory = (label, items) => triggerCeoDrilldown({
    storageKey: 'controlroom_inventory_initial_filter',
    eventName: 'controlroom_inventory_filter',
    targetKeys: (items || []).flatMap((i) => [i.sku, i.id, i.name]).filter(Boolean),
    periodLabel: label,
    sourceLabel: 'Inventory',
    navigateTab: 'Raw Material Inventory',
    onNavigateTab
  });

  const kpis = [
    {
      title: 'INVENTORY VALUE',
      value: formatCompactINR(analytics.totalValue),
      valColor: '#0E7490',
      hideTrendIcon: true,
      bottomPrefix: 'On-hand stock at cost',
      bottomHighlight: '',
      onClick: () => drillToInventory('All Stock Items', analytics.filtered)
    },
    {
      title: 'SKUS WITH STOCK',
      value: `${analytics.skusWithStock}`,
      valColor: '#059669',
      hideTrendIcon: true,
      bottomPrefix: `of ${analytics.totalCount} `,
      bottomHighlight: 'active SKUs',
      onClick: () => drillToInventory('SKUs With Stock', analytics.filtered.filter((i) => i.onHandQty > 0))
    },
    {
      title: 'OUT OF STOCK',
      value: `${analytics.outOfStockCount}`,
      valColor: analytics.outOfStockCount > 0 ? '#DC2626' : '#059669',
      highlightCard: analytics.outOfStockCount > 0,
      hideTrendIcon: true,
      bottomPrefix: 'Zero on-hand quantity',
      bottomHighlight: '',
      onClick: () => drillToInventory('Out of Stock', analytics.filtered.filter((i) => i.stockStatus === 'Out of Stock'))
    },
    {
      title: 'LOW STOCK',
      value: `${analytics.lowStockCount}`,
      valColor: analytics.lowStockCount > 0 ? '#B45309' : '#059669',
      hideTrendIcon: true,
      bottomPrefix: 'In stock, below minimum',
      bottomHighlight: '',
      onClick: () => drillToInventory('Low Stock', analytics.filtered.filter((i) => i.stockStatus === 'Below Minimum'))
    },
    {
      title: 'AGED STOCK VALUE',
      value: formatCompactINR(analytics.agedStockValue),
      valColor: analytics.agedStockValue > 0 ? '#B45309' : '#0F172A',
      hideTrendIcon: true,
      bottomPrefix: 'Over 90 days · ',
      bottomHighlight: `${analytics.agedPct}% of total`,
      onClick: () => drillToInventory('Aged Stock (>90 days)', analytics.filtered.filter((i) => i.ageDays > 90))
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <style>{`
        .ceo-inv-mid-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
          gap: 14px;
          align-items: stretch;
        }
        @media (max-width: 1080px) {
          .ceo-inv-mid-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>

      {/* Filter Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
        padding: '10px 14px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <label style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
            As of
            <input
              type="date"
              value={asOfDate}
              max={todayIso}
              onChange={(e) => { if (e.target.value) { setAsOfDate(e.target.value); setPage(1); } }}
              style={{ ...selectStyle, cursor: 'pointer' }}
            />
          </label>
          <label style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Warehouse
            <select value={warehouseFilter} onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1); }} style={selectStyle}>
              <option value="All">All locations</option>
              {analytics.warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </label>
          <label style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Category
            <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} style={selectStyle}>
              <option value="All">All</option>
              {analytics.categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            placeholder="Search by item or SKU"
            style={{ ...selectStyle, minWidth: '190px', fontWeight: '500' }}
          />
        </div>
        <span style={{ fontSize: '11px', color: '#64748B' }}>Last updated {analytics.timeStr} IST</span>
      </div>

      {/* Top 5 KPI Cards */}
      <CeoKpiGrid kpis={kpis} />

      {/* Middle 2-Column Row */}
      <div className="ceo-inv-mid-grid">
        {/* Stock by Warehouse */}
        <BusinzSectionCard title="Stock by Warehouse" subtitle="Stock value at cost, in ₹ crore">
          <div style={{ overflowX: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Warehouse</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>On Hand</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Available</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Reserved</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Hold</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>In Transit</th>
                </tr>
              </thead>
              <tbody>
                {analytics.warehouseRows.map((w) => (
                  <tr key={w.warehouse}>
                    <td style={{ ...tdStyle, fontWeight: '700', color: '#0F172A' }}>{w.warehouse}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#0F172A', fontWeight: '600' }}>{formatCroreNum(w.onHand)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#334155' }}>{formatCroreNum(w.available)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#475569' }}>{formatCroreNum(w.reserved)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#64748B' }}>{formatCroreNum(w.hold)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#0E7490', fontWeight: '600' }}>{formatCroreNum(w.inTransit)}</td>
                  </tr>
                ))}
                <tr style={{ backgroundColor: '#F8FAFC', fontWeight: '800', color: '#0F172A' }}>
                  <td style={{ ...tdStyle, borderBottom: 'none' }}>Total</td>
                  <td style={{ ...tdStyle, textAlign: 'right', borderBottom: 'none' }}>{formatCroreNum(analytics.whTotals.onHand)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', borderBottom: 'none' }}>{formatCroreNum(analytics.whTotals.available)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', borderBottom: 'none' }}>{formatCroreNum(analytics.whTotals.reserved)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', borderBottom: 'none' }}>{formatCroreNum(analytics.whTotals.hold)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', borderBottom: 'none' }}>{formatCroreNum(analytics.whTotals.inTransit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ padding: '8px 14px', fontSize: '11px', color: '#64748B', backgroundColor: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
            Available = On Hand less Reserved and Hold · In Transit is shown separately.
          </div>
        </BusinzSectionCard>

        {/* Inventory Ageing */}
        <BusinzSectionCard title="Inventory Ageing" subtitle="On-hand value by age from receipt date" bodyPadding="16px">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'center', flex: 1 }}>
            {analytics.ageingRows.map((row) => (
              <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '95px 1fr 78px 46px', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                <span style={{ fontWeight: row.min >= 91 ? '700' : '600', color: '#0F172A' }}>{row.label}</span>
                <div style={{ height: '8px', backgroundColor: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, row.pct)}%`, height: '100%', backgroundColor: row.color, borderRadius: '999px' }} />
                </div>
                <strong style={{ textAlign: 'right', color: '#0F172A' }}>{formatCompactINR(row.val)}</strong>
                <span style={{ textAlign: 'right', color: '#64748B', fontWeight: '600' }}>{row.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </BusinzSectionCard>
      </div>

      {/* Item-wise Inventory Table */}
      <BusinzSectionCard
        title="Item-wise Inventory"
        rightNode={<span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Shortages first · One row per item and warehouse</span>}
      >
        <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '6px', borderBottom: '1px solid #F1F5F9' }}>
          {TABLE_FILTERS.map((f) => {
            const active = tableTab === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => { setTableTab(f.id); setPage(1); }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '999px',
                  border: active ? '1px solid #0E7490' : '1px solid #E2E8F0',
                  backgroundColor: active ? '#0E7490' : '#F8FAFC',
                  color: active ? '#FFFFFF' : '#475569',
                  fontSize: '11.5px',
                  fontWeight: active ? '700' : '600',
                  cursor: 'pointer'
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left', paddingLeft: '16px' }}>Item / SKU</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Warehouse</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Unit</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Available</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Min. Stock</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Shortfall</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>PO / Transfer ETA</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Movement</th>
                <th style={{ ...thStyle, textAlign: 'right', paddingRight: '16px' }}>Stock Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '22px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>No inventory items match the selected filter.</td></tr>
              ) : pageRows.map((row) => {
                const isOut = row.stockStatus === 'Out of Stock';
                const isLow = row.stockStatus === 'Below Minimum';
                const badgeStyle = isOut
                  ? { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' }
                  : isLow
                    ? { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' }
                    : { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' };
                return (
                  <tr key={row.id}>
                    <td style={{ ...tdStyle, paddingLeft: '16px', fontWeight: '700', color: '#0F172A' }}>
                      {row.name}
                      {row.sku && <span style={{ color: '#64748B', fontWeight: '500' }}> · {row.sku}</span>}
                    </td>
                    <td style={{ ...tdStyle, color: '#475569' }}>{row.warehouse}</td>
                    <td style={{ ...tdStyle, color: '#64748B' }}>{row.unit}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600', color: '#0F172A' }}>{row.availableQty.toLocaleString('en-IN')}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#64748B' }}>{row.minStock > 0 ? row.minStock.toLocaleString('en-IN') : '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: row.shortfall > 0 ? '#0F172A' : '#94A3B8' }}>{row.shortfall > 0 ? row.shortfall.toLocaleString('en-IN') : '—'}</td>
                    <td style={{ ...tdStyle, color: '#475569' }}>{row.eta}</td>
                    <td style={{ ...tdStyle, fontWeight: '700', color: row.movement === 'Fast Moving' ? '#059669' : row.movement === 'Slow Moving' ? '#475569' : '#94A3B8' }}>{row.movement}</td>
                    <td style={{ ...tdStyle, paddingRight: '16px', textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: badgeStyle.bg,
                        color: badgeStyle.color,
                        border: `1px solid ${badgeStyle.border}`,
                        whiteSpace: 'nowrap'
                      }}>
                        {row.stockStatus}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer + Pagination */}
        <div style={{
          padding: '10px 16px', backgroundColor: '#F8FAFC', borderTop: '1px solid #F1F5F9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '11px', color: '#64748B'
        }}>
          <span>Movement uses customer dispatch and production consumption. Fast Moving = issues on 4+ distinct days in the last 30 days.</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{tableRows.length === 0 ? '0' : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, tableRows.length)}`} of {tableRows.length}</span>
            <button type="button" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', borderRadius: '6px', padding: '3px 6px', cursor: safePage <= 1 ? 'not-allowed' : 'pointer', opacity: safePage <= 1 ? 0.45 : 1 }}>
              <ChevronLeft size={14} />
            </button>
            <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', borderRadius: '6px', padding: '3px 6px', cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', opacity: safePage >= totalPages ? 0.45 : 1 }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </BusinzSectionCard>
    </div>
  );
}
