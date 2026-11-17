import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle, Warehouse, TrendingUp,
  Clock, Layers, ArrowRight, RefreshCw, ShieldAlert, X, Search
} from 'lucide-react';

const formatINRCompact = (val) => {
  const n = Number(val) || 0;
  if (n >= 10000000) return `₹ ${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹ ${(n / 100000).toFixed(2)} L`;
  return `₹ ${Math.round(n).toLocaleString('en-IN')}`;
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
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#F1F5F9"
          strokeWidth={stroke}
        />
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
              style={{
                cursor: onSelectSegment ? 'pointer' : 'default',
                transition: 'opacity 0.18s ease, stroke-width 0.18s ease'
              }}
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

export default function CeoInventoryAnalyticsSection({
  inventoryList = [],
  bomList = [],
  grnList = [],
  poList = [],
  onNavigateTab
}) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedMovement, setSelectedMovement] = useState(null);
  const [selectedAbc, setSelectedAbc] = useState(null);
  const [selectedTurnoverIdx, setSelectedTurnoverIdx] = useState(null);
  const [selectedTrendIdx, setSelectedTrendIdx] = useState(null);
  const [categoryPopupSeg, setCategoryPopupSeg] = useState(null);
  const [categoryPopupSearch, setCategoryPopupSearch] = useState('');
  const [highlightedProductCode, setHighlightedProductCode] = useState(null);

  const analytics = useMemo(() => {
    const now = Date.now();
    let items = (inventoryList || []).map((it, idx) => {
      const qty = parseFloat(it.stock ?? it.availableStock ?? it.available ?? it.onHand ?? it.physicalStock ?? it.quantity ?? it.currentStock ?? it.openingStock ?? 0) || 0;
      const reserved = parseFloat(it.reserved ?? it.blockedStock ?? it.allocatedQty ?? 0) || 0;
      const minStock = parseFloat(it.minStock ?? it.reorderLevel ?? it.minQty ?? 10) || 10;
      const rate = parseFloat(it.rate ?? it.unitRate ?? it.unitPrice ?? it.price ?? it.purchasePrice ?? it.cost ?? 0) || 0;
      const rawVal = parseFloat(it.totalValue ?? it.value ?? 0) || 0;
      const value = rawVal > 0 ? rawVal : Math.max(0, qty * rate);
      const uom = it.unit || it.uom || 'Nos';
      const category = it.category || it.group || 'Solar Structure Material';
      const whText = `${it.name || ''} ${it.itemName || ''} ${category} ${it.description || ''}`.toLowerCase();
      const isSolarPanel =
        whText.includes('solar panel') ||
        whText.includes('pv module') ||
        whText.includes('solar module') ||
        (String(category).toLowerCase().includes('panel') && !whText.includes('control panel'));
      const warehouse = isSolarPanel ? 'Stock Area' : 'VRM Structures';
      const rawDate = it.lastInwardDate || it.updatedAt || it.updated_at || it.createdAt || it.created_at;
      const parsedTs = rawDate ? new Date(rawDate).getTime() : NaN;
      const ageDays = !isNaN(parsedTs) ? Math.max(0, Math.floor((now - parsedTs) / 86400000)) : 0;

      return {
        code: it.code || it.itemCode || it.sku || `SKU-${idx + 1}`,
        name: it.name || it.itemName || it.description || 'Raw Material',
        category,
        warehouse,
        uom,
        qty,
        reserved,
        minStock,
        rate,
        value,
        ageDays,
        isOut: qty <= 0,
        isLow: qty <= minStock
      };
    });

    // Localhost-only demo data when local inventory is empty (NEVER runs on live/dev servers)
    const isLocalhostPreview =
      typeof window !== 'undefined' &&
      ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
      items.length === 0;

    let effectiveBomList = bomList || [];
    let effectiveGrnList = grnList || [];
    let effectivePoList = poList || [];

    if (isLocalhostPreview) {
      items = [
        { code: 'HDG-001', name: 'HAT Purlin 2x5 (1200x1800)', category: 'HDG Solar Structures', warehouse: 'VRM Structures', uom: 'Nos', qty: 680, reserved: 120, minStock: 150, rate: 900, value: 612000, ageDays: 12, isOut: false, isLow: false },
        { code: 'HDG-002', name: 'LEG 1500 mm (HDG)', category: 'HDG Solar Structures', warehouse: 'VRM Structures', uom: 'Nos', qty: 540, reserved: 90, minStock: 100, rate: 850, value: 459000, ageDays: 18, isOut: false, isLow: false },
        { code: 'HDG-003', name: 'Rafter 4300 mm (GAL)', category: 'HDG Solar Structures', warehouse: 'VRM Structures', uom: 'Nos', qty: 410, reserved: 60, minStock: 100, rate: 998, value: 409180, ageDays: 42, isOut: false, isLow: false },
        { code: 'ALU-001', name: 'Mono Rail 4200 mm (AL)', category: 'Aluminium Rails & Clamps', warehouse: 'VRM Structures', uom: 'Nos', qty: 900, reserved: 150, minStock: 200, rate: 450, value: 405000, ageDays: 15, isOut: false, isLow: false },
        { code: 'ALU-002', name: 'Mid Clamp 35mm Anodized', category: 'Aluminium Rails & Clamps', warehouse: 'VRM Structures', uom: 'Nos', qty: 1400, reserved: 300, minStock: 400, rate: 175, value: 245000, ageDays: 68, isOut: false, isLow: false },
        { code: 'ALU-003', name: 'End Clamp L-Foot Kit', category: 'Aluminium Rails & Clamps', warehouse: 'VRM Structures', uom: 'Nos', qty: 80, reserved: 20, minStock: 150, rate: 210, value: 16800, ageDays: 95, isOut: false, isLow: true },
        { code: 'SS-001', name: 'SS304 Hex Bolt M10x30', category: 'SS Fasteners & Hardware', warehouse: 'VRM Structures', uom: 'Nos', qty: 6000, reserved: 800, minStock: 1000, rate: 40, value: 240000, ageDays: 22, isOut: false, isLow: false },
        { code: 'SS-002', name: 'Spring Washer M10 SS', category: 'SS Fasteners & Hardware', warehouse: 'VRM Structures', uom: 'Nos', qty: 4000, reserved: 500, minStock: 1000, rate: 37.5, value: 150000, ageDays: 115, isOut: false, isLow: false },
        { code: 'SS-003', name: 'Anchor Fastener M12x100', category: 'SS Fasteners & Hardware', warehouse: 'VRM Structures', uom: 'Nos', qty: 0, reserved: 0, minStock: 500, rate: 48, value: 0, ageDays: 195, isOut: true, isLow: true },
        { code: 'BP-001', name: 'MS Base Plate 200x200x8', category: 'Base Plates & Brackets', warehouse: 'VRM Structures', uom: 'Nos', qty: 420, reserved: 50, minStock: 80, rate: 450, value: 189000, ageDays: 28, isOut: false, isLow: false },
        { code: 'BP-002', name: 'L-Bracket Heavy Duty HDG', category: 'Base Plates & Brackets', warehouse: 'VRM Structures', uom: 'Nos', qty: 360, reserved: 40, minStock: 100, rate: 350, value: 126000, ageDays: 190, isOut: false, isLow: false },
        { code: 'BP-003', name: 'Z-Bracket Purlin Joint', category: 'Base Plates & Brackets', warehouse: 'VRM Structures', uom: 'Nos', qty: 65, reserved: 10, minStock: 120, rate: 250, value: 16250, ageDays: 52, isOut: false, isLow: true },
        { code: 'SP-001', name: 'Solar Panel 550W Mono PERC', category: 'Solar Panels', warehouse: 'Stock Area', uom: 'Nos', qty: 120, reserved: 20, minStock: 30, rate: 9500, value: 1140000, ageDays: 10, isOut: false, isLow: false }
      ];

      const baseD = new Date();
      const mkDate = (monthsAgo, day = 15) => {
        const dt = new Date(baseD.getFullYear(), baseD.getMonth() - monthsAgo, day);
        return dt.toISOString();
      };
      effectiveBomList = [
        { date: mkDate(5), grandTotal: 1120000, stockDeducted: true, items: [{ code: 'HDG-001' }, { code: 'ALU-001' }, { code: 'SS-001' }] },
        { date: mkDate(4), grandTotal: 1450000, stockDeducted: true, items: [{ code: 'HDG-001' }, { code: 'HDG-002' }, { code: 'ALU-001' }, { code: 'BP-001' }] },
        { date: mkDate(3), grandTotal: 1280000, stockDeducted: true, items: [{ code: 'HDG-001' }, { code: 'HDG-002' }, { code: 'ALU-001' }, { code: 'SS-001' }] },
        { date: mkDate(2), grandTotal: 1890000, stockDeducted: true, items: [{ code: 'HDG-002' }, { code: 'HDG-003' }, { code: 'ALU-002' }, { code: 'SS-001' }] },
        { date: mkDate(1), grandTotal: 2150000, stockDeducted: true, items: [{ code: 'HDG-001' }, { code: 'HDG-002' }, { code: 'ALU-001' }, { code: 'BP-001' }] },
        { date: mkDate(0), grandTotal: 2640000, stockDeducted: true, items: [{ code: 'HDG-001' }, { code: 'ALU-001' }, { code: 'SS-001' }, { code: 'BP-001' }] }
      ];
      effectiveGrnList = [
        { date: mkDate(5, 10), grandTotal: 980000 },
        { date: mkDate(4, 12), grandTotal: 1520000 },
        { date: mkDate(3, 8), grandTotal: 1350000 },
        { date: mkDate(2, 14), grandTotal: 2100000 },
        { date: mkDate(1, 18), grandTotal: 2350000 },
        { date: mkDate(0, 5), grandTotal: 2950000 }
      ];
      effectivePoList = [
        { status: 'Proceed PO', items: [{ qty: 250 }, { qty: 180 }] }
      ];
    }

    const totalValue = items.reduce((s, it) => s + it.value, 0);
    const totalQty = items.reduce((s, it) => s + it.qty, 0);
    const totalReserved = items.reduce((s, it) => s + it.reserved, 0);
    const outOfStockItems = items.filter(it => it.isOut);
    const lowStockItems = items.filter(it => it.isLow).sort((a, b) => (a.qty / Math.max(1, a.minStock)) - (b.qty / Math.max(1, b.minStock)));

    // Open POs in transit
    const inTransitPOs = (effectivePoList || []).filter(p => {
      const st = String(p?.status || '').toLowerCase();
      return st.includes('proceed') || st.includes('pending grn') || st.includes('partially');
    });
    const inTransitQty = inTransitPOs.reduce((s, p) => {
      const pItems = Array.isArray(p?.items) ? p.items : [];
      return s + pItems.reduce((ps, pi) => ps + (parseFloat(pi.qty ?? pi.quantity ?? 0) || 0), 0);
    }, 0);

    // 1. Category breakdown (with SKU count, total qty, top 3 items & full sorted items per category)
    const catMap = new Map();
    for (const it of items) {
      const prev = catMap.get(it.category) || { value: 0, skuCount: 0, qty: 0, catItems: [] };
      prev.value += it.value;
      prev.skuCount += 1;
      prev.qty += it.qty;
      prev.catItems.push(it);
      catMap.set(it.category, prev);
    }
    const catColors = ['#0E7490', '#2563EB', '#059669', '#D97706', '#7C3AED', '#64748B'];
    const sortedCats = Array.from(catMap.entries())
      .map(([name, info]) => {
        const sortedItems = [...info.catItems].sort((a, b) => b.value - a.value);
        return {
          name,
          value: info.value,
          skuCount: info.skuCount,
          qty: info.qty,
          topItems: sortedItems.slice(0, 3),
          allItems: sortedItems
        };
      })
      .sort((a, b) => b.value - a.value);
    const topCats = sortedCats.slice(0, 5);
    const othersSlice = sortedCats.slice(5);
    const othersVal = othersSlice.reduce((s, c) => s + c.value, 0);
    if (othersVal > 0 || othersSlice.length > 0) {
      const othersAll = othersSlice.flatMap(c => c.allItems).sort((a, b) => b.value - a.value);
      topCats.push({
        name: 'Others',
        value: othersVal,
        skuCount: othersSlice.reduce((s, c) => s + c.skuCount, 0),
        qty: othersSlice.reduce((s, c) => s + c.qty, 0),
        topItems: othersAll.slice(0, 3),
        allItems: othersAll
      });
    }
    const totalCategoriesCount = sortedCats.length;
    const categorySegments = topCats.map((c, idx) => ({
      ...c,
      color: catColors[idx % catColors.length],
      pct: totalValue > 0 ? ((c.value / totalValue) * 100).toFixed(1) : '0.0'
    }));

    // 2. Ageing buckets (with SKU count, total qty & sorted items for popup drilldown)
    const buckets = [
      { label: '0 - 30 Days', min: 0, max: 30, color: '#059669', value: 0, skuCount: 0, qty: 0, bucketItems: [] },
      { label: '31 - 60 Days', min: 31, max: 60, color: '#0E7490', value: 0, skuCount: 0, qty: 0, bucketItems: [] },
      { label: '61 - 90 Days', min: 61, max: 90, color: '#D97706', value: 0, skuCount: 0, qty: 0, bucketItems: [] },
      { label: '91 - 180 Days', min: 91, max: 180, color: '#EA580C', value: 0, skuCount: 0, qty: 0, bucketItems: [] },
      { label: 'Above 180 Days', min: 181, max: Infinity, color: '#DC2626', value: 0, skuCount: 0, qty: 0, bucketItems: [] }
    ];
    for (const it of items) {
      const b = buckets.find(bk => it.ageDays >= bk.min && it.ageDays <= bk.max) || buckets[0];
      b.value += it.value;
      b.skuCount += 1;
      b.qty += it.qty;
      b.bucketItems.push(it);
    }
    const ageingList = buckets.map(b => ({
      ...b,
      allItems: [...b.bucketItems].sort((a, bItem) => bItem.value - a.value),
      pct: totalValue > 0 ? ((b.value / totalValue) * 100).toFixed(1) : '0.0'
    }));

    // 3. Top 10 High Value Items
    const top10Items = [...items].sort((a, b) => b.value - a.value).slice(0, 10);

    // 4. Stock by Warehouse (Strictly 2 Warehouses: VRM Structures & Stock Area for Solar Panels)
    const whMap = new Map([
      ['VRM Structures', { name: 'VRM Structures', sub: 'All Products (excl. Solar Panels)', color: '#0E7490', qty: 0, value: 0, skuCount: 0, whItems: [] }],
      ['Stock Area', { name: 'Stock Area', sub: 'Solar Panels Only', color: '#059669', qty: 0, value: 0, skuCount: 0, whItems: [] }]
    ]);
    for (const it of items) {
      const targetWh = it.warehouse === 'Stock Area' ? 'Stock Area' : 'VRM Structures';
      const cur = whMap.get(targetWh);
      cur.qty += it.qty;
      cur.value += it.value;
      cur.skuCount += 1;
      cur.whItems.push(it);
    }
    const warehouseList = Array.from(whMap.values()).map(w => ({
      ...w,
      allItems: [...w.whItems].sort((a, b) => b.value - a.value),
      pct: totalValue > 0 ? ((w.value / totalValue) * 100).toFixed(1) : '0.0'
    }));

    // 5. Fast vs Slow vs Non Moving (with SKU count, total qty & sorted items for popup drilldown)
    const usageCount = new Map();
    for (const b of (effectiveBomList || [])) {
      for (const bi of (Array.isArray(b?.items) ? b.items : [])) {
        const key = String(bi.code || bi.name || '').toLowerCase().trim();
        if (key) usageCount.set(key, (usageCount.get(key) || 0) + 1);
      }
    }
    let fastVal = 0, slowVal = 0, nonMovingVal = 0;
    let fastQty = 0, slowQty = 0, nonMovingQty = 0;
    const fastItems = [], slowItems = [], nonMovingItems = [];
    for (const it of items) {
      const hits = (usageCount.get(it.code.toLowerCase()) || 0) + (usageCount.get(it.name.toLowerCase()) || 0);
      if (hits >= 3) {
        fastVal += it.value; fastQty += it.qty; fastItems.push(it);
      } else if (hits >= 1) {
        slowVal += it.value; slowQty += it.qty; slowItems.push(it);
      } else {
        nonMovingVal += it.value; nonMovingQty += it.qty; nonMovingItems.push(it);
      }
    }
    const sortByValDesc = (arr) => [...arr].sort((a, b) => b.value - a.value);
    const movementSegments = [
      {
        name: 'Fast Moving',
        value: fastVal,
        qty: fastQty,
        skuCount: fastItems.length,
        allItems: sortByValDesc(fastItems),
        topItems: sortByValDesc(fastItems).slice(0, 3),
        color: '#059669',
        pct: totalValue > 0 ? ((fastVal / totalValue) * 100).toFixed(1) : '0.0'
      },
      {
        name: 'Slow Moving',
        value: slowVal,
        qty: slowQty,
        skuCount: slowItems.length,
        allItems: sortByValDesc(slowItems),
        topItems: sortByValDesc(slowItems).slice(0, 3),
        color: '#D97706',
        pct: totalValue > 0 ? ((slowVal / totalValue) * 100).toFixed(1) : '0.0'
      },
      {
        name: 'Non Moving',
        value: nonMovingVal,
        qty: nonMovingQty,
        skuCount: nonMovingItems.length,
        allItems: sortByValDesc(nonMovingItems),
        topItems: sortByValDesc(nonMovingItems).slice(0, 3),
        color: '#94A3B8',
        pct: totalValue > 0 ? ((nonMovingVal / totalValue) * 100).toFixed(1) : '0.0'
      }
    ];

    // 6. ABC Analysis (Pareto by Value, with SKU count, total qty & sorted items)
    const sortedForAbc = [...items].sort((a, b) => b.value - a.value);
    let cumVal = 0;
    let aVal = 0, bVal = 0, cVal = 0;
    let aQty = 0, bQty = 0, cQty = 0;
    const aItems = [], bItems = [], cItems = [];
    for (const it of sortedForAbc) {
      cumVal += it.value;
      const ratio = totalValue > 0 ? cumVal / totalValue : 1;
      if (ratio <= 0.70 || aVal === 0) {
        aVal += it.value; aQty += it.qty; aItems.push(it);
      } else if (ratio <= 0.90) {
        bVal += it.value; bQty += it.qty; bItems.push(it);
      } else {
        cVal += it.value; cQty += it.qty; cItems.push(it);
      }
    }
    const abcSegments = [
      {
        name: 'A Items (Top 70%)',
        value: aVal,
        qty: aQty,
        skuCount: aItems.length,
        allItems: aItems,
        topItems: aItems.slice(0, 3),
        color: '#059669',
        pct: totalValue > 0 ? ((aVal / totalValue) * 100).toFixed(1) : '0.0'
      },
      {
        name: 'B Items (Next 20%)',
        value: bVal,
        qty: bQty,
        skuCount: bItems.length,
        allItems: bItems,
        topItems: bItems.slice(0, 3),
        color: '#D97706',
        pct: totalValue > 0 ? ((bVal / totalValue) * 100).toFixed(1) : '0.0'
      },
      {
        name: 'C Items (Last 10%)',
        value: cVal,
        qty: cQty,
        skuCount: cItems.length,
        allItems: cItems,
        topItems: cItems.slice(0, 3),
        color: '#DC2626',
        pct: totalValue > 0 ? ((cVal / totalValue) * 100).toFixed(1) : '0.0'
      }
    ];

    // 7. Monthly Trend & Stock Turnover (last 6 months from real BOM & GRN records, no dummy data)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const curDate = new Date();
    const toMonthKey = (raw) => {
      if (!raw) return null;
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      const m = String(raw).match(/^(\d{4})-(\d{2})/);
      return m ? `${m[1]}-${m[2]}` : null;
    };

    const bomIssuedByMonth = new Map();
    for (const b of (effectiveBomList || [])) {
      if (!b || b.cancelled || String(b.status || '').toLowerCase().includes('cancel')) continue;
      const mk = toMonthKey(b.stockDeductionDate || b.invoiceDate || b.date || b.createdAt || b.bomDate);
      if (!mk) continue;
      const bVal = parseFloat(String(b.grandTotal ?? b.subTotal ?? b.total ?? 0).replace(/[^0-9.-]/g, '')) || 0;
      bomIssuedByMonth.set(mk, (bomIssuedByMonth.get(mk) || 0) + Math.max(0, bVal));
    }

    const grnInwardByMonth = new Map();
    for (const g of (effectiveGrnList || [])) {
      if (!g) continue;
      const mk = toMonthKey(g.date || g.grnDate || g.createdAt || g.created_at);
      if (!mk) continue;
      let gVal = parseFloat(String(g.grandTotal ?? g.totalAmount ?? g.total ?? 0).replace(/[^0-9.-]/g, '')) || 0;
      if (gVal <= 0 && Array.isArray(g.items)) {
        gVal = g.items.reduce((s, gi) => {
          const q = parseFloat(gi.receivedQty ?? gi.qty ?? gi.quantity ?? 0) || 0;
          const r = parseFloat(gi.rate ?? gi.unitPrice ?? gi.price ?? 0) || 0;
          return s + (q * r);
        }, 0);
      }
      grnInwardByMonth.set(mk, (grnInwardByMonth.get(mk) || 0) + Math.max(0, gVal));
    }

    const rawMonths = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(curDate.getFullYear(), curDate.getMonth() - i, 1);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const issuedVal = bomIssuedByMonth.get(mk) || 0;
      const inwardVal = grnInwardByMonth.get(mk) || 0;
      rawMonths.push({
        key: mk,
        label: `${monthNames[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`,
        issuedVal,
        inwardVal
      });
    }

    // Reconstruct month-end stock value walking backward from live totalValue using real net flows
    const trendMonths = new Array(rawMonths.length);
    let runningVal = totalValue;
    for (let idx = rawMonths.length - 1; idx >= 0; idx--) {
      const rm = rawMonths[idx];
      const monthVal = Math.max(0, runningVal);
      const turnover = monthVal > 0 ? Number((rm.issuedVal / monthVal).toFixed(2)) : 0;
      trendMonths[idx] = {
        label: rm.label,
        value: monthVal,
        issuedVal: rm.issuedVal,
        inwardVal: rm.inwardVal,
        turnover
      };
      runningVal = Math.max(0, monthVal - rm.inwardVal + rm.issuedVal);
    }

    // 8. Today's Snapshot
    const todayStr = new Date().toISOString().split('T')[0];
    const isTodayRec = (rec) => {
      const raw = String(rec?.date || rec?.createdAt || rec?.created_at || '');
      return raw.startsWith(todayStr);
    };
    const grnsToday = (effectiveGrnList || []).filter(isTodayRec).length;
    const issuesToday = (effectiveBomList || []).filter(b => b?.stockDeducted && isTodayRec(b)).length;

    const healthyCount = Math.max(0, items.length - outOfStockItems.length);
    const accuracyPct = items.length > 0 ? ((healthyCount / items.length) * 100).toFixed(1) : '100.0';

    return {
      items,
      totalValue,
      totalQty,
      totalReserved,
      inTransitQty,
      outOfStockItems,
      lowStockItems,
      categorySegments,
      totalCategoriesCount,
      ageingList,
      top10Items,
      warehouseList,
      movementSegments,
      abcSegments,
      trendMonths,
      grnsToday,
      issuesToday,
      healthyCount,
      accuracyPct,
      above180Val: ageingList[4]?.value || 0
    };
  }, [inventoryList, bomList, grnList, poList]);

  const maxTrendVal = Math.max(1, ...analytics.trendMonths.map(m => m.value));
  const maxTurnoverVal = Math.max(0.1, ...analytics.trendMonths.map(m => m.turnover));
  const activeCategorySeg = selectedCategory
    ? analytics.categorySegments.find(c => c.name === selectedCategory) || null
    : null;
  const closeCategoryPopup = () => {
    setCategoryPopupSeg(null);
    setHighlightedProductCode(null);
    setCategoryPopupSearch('');
    setSelectedCategory(null);
    setSelectedMovement(null);
    setSelectedAbc(null);
  };
  const toggleCategory = (name) => {
    const seg = analytics.categorySegments.find(c => c.name === name) || null;
    setSelectedCategory(name);
    if (seg) {
      setHighlightedProductCode(null);
      setCategoryPopupSearch('');
      setCategoryPopupSeg(seg);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ROW 1: CATEGORY BREAKDOWN + STOCK TURNOVER (2-COLUMN SPACIOUS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {/* 1. Inventory Value by Category (Interactive Donut + Product Popup Drilldown) */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={cardTitleStyle}>Inventory Value by Category</span>
              <span style={{
                fontSize: '10px',
                fontWeight: '800',
                color: '#0E7490',
                backgroundColor: '#ECFEFF',
                border: '1px solid #A5F3FC',
                padding: '2px 8px',
                borderRadius: '999px'
              }}>
                {analytics.totalCategoriesCount} {analytics.totalCategoriesCount === 1 ? 'Category' : 'Categories'} • {analytics.items.length} SKUs
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {activeCategorySeg && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setHighlightedProductCode(null);
                      setCategoryPopupSearch('');
                      setCategoryPopupSeg(activeCategorySeg);
                    }}
                    style={{
                      border: '1px solid #A5F3FC',
                      backgroundColor: '#ECFEFF',
                      color: '#0E7490',
                      fontSize: '10px',
                      fontWeight: '800',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      cursor: 'pointer'
                    }}
                  >
                    View All ({activeCategorySeg.skuCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(null)}
                    style={{
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#F8FAFC',
                      color: '#475569',
                      fontSize: '10px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      cursor: 'pointer'
                    }}
                  >
                    Show All
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 3-Metric Executive Summary Strip (mirrors Stock Turnover card) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '8px',
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '8px 12px'
          }}>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                Total Value
              </div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>
                {formatINRCompact(analytics.totalValue)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                Total Units
              </div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0E7490' }}>
                {analytics.totalQty.toLocaleString('en-IN')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                Top Category
              </div>
              <div style={{ fontSize: '13px', fontWeight: '900', color: '#059669', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {analytics.categorySegments[0]?.name || '—'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, minHeight: '142px' }}>
            <DonutChartSvg
              segments={analytics.categorySegments}
              centerLabel={activeCategorySeg ? formatINRCompact(activeCategorySeg.value) : formatINRCompact(analytics.totalValue)}
              centerSub={activeCategorySeg ? `${activeCategorySeg.pct}% Share` : 'Live Stock Value'}
              activeName={activeCategorySeg?.name || null}
              onSelectSegment={toggleCategory}
            />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
              {analytics.categorySegments.length > 0 ? analytics.categorySegments.map((c, idx) => {
                const isSelected = activeCategorySeg?.name === c.name;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleCategory(c.name)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 8px',
                      borderRadius: '10px',
                      border: isSelected ? `1.5px solid ${c.color}` : '1px solid transparent',
                      backgroundColor: isSelected ? '#F8FAFC' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease, border-color 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: c.color, flexShrink: 0 }} />
                        <span style={{ color: '#0F172A', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.name}
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', whiteSpace: 'nowrap' }}>
                          ({c.skuCount} SKUs)
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <span style={{ color: '#0F172A', fontWeight: '800', fontSize: '12px' }}>{formatINRCompact(c.value)}</span>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          color: c.color,
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          padding: '1px 6px',
                          borderRadius: '6px'
                        }}>
                          {c.pct}%
                        </span>
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '5px', backgroundColor: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, Math.max(2, Number(c.pct)))}%`,
                        height: '100%',
                        backgroundColor: c.color,
                        borderRadius: '999px'
                      }} />
                    </div>
                  </button>
                );
              }) : (
                <span style={{ fontSize: '12px', color: '#64748B' }}>No live inventory category data</span>
              )}
            </div>
          </div>
        </div>

        {/* 2. Stock Turnover (Monthly) - Executive Interactive Live Card */}
        {(() => {
          const months = analytics.trendMonths || [];
          const latestIdx = Math.max(0, months.length - 1);
          const activeIdx = selectedTurnoverIdx !== null && months[selectedTurnoverIdx] ? selectedTurnoverIdx : latestIdx;
          const activeMonth = months[activeIdx] || { label: '—', turnover: 0, issuedVal: 0, inwardVal: 0, value: 0 };
          const avgTurnover = months.length > 0
            ? (months.reduce((s, m) => s + (m.turnover || 0), 0) / months.length).toFixed(2)
            : '0.00';
          const peakMonth = months.reduce((best, m) => ((m.turnover || 0) >= (best.turnover || 0) ? m : best), months[0] || { label: '—', turnover: 0 });
          const daysToTurn = activeMonth.turnover > 0 ? Math.max(1, Math.round(30 / activeMonth.turnover)) : null;

          return (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={cardTitleStyle}>Stock Turnover (Monthly)</span>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    color: '#059669',
                    backgroundColor: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    padding: '2px 8px',
                    borderRadius: '999px'
                  }}>
                    Live BOM / Stock Ratio
                  </span>
                </div>
              </div>

              {/* 3-Metric Executive Summary Strip */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '8px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '8px 12px'
              }}>
                <div>
                  <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                    {activeMonth.label} Turnover
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: activeMonth.turnover > 0 ? '#059669' : '#0F172A' }}>
                    {activeMonth.turnover}x
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                    6-Mo Average
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: '#0E7490' }}>
                    {avgTurnover}x
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                    Peak Month
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '900', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {peakMonth.label} ({peakMonth.turnover}x)
                  </div>
                </div>
              </div>

              {/* Interactive Bar Chart with Subtle Gridlines */}
              <div style={{ position: 'relative', flex: 1, minHeight: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingTop: '12px' }}>
                <div style={{
                  position: 'absolute',
                  inset: '14px 0 24px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  pointerEvents: 'none'
                }}>
                  <div style={{ borderTop: '1px dashed #E2E8F0', width: '100%' }} />
                  <div style={{ borderTop: '1px dashed #E2E8F0', width: '100%' }} />
                  <div style={{ borderTop: '1px solid #E2E8F0', width: '100%' }} />
                </div>

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '10px', height: '100%' }}>
                  {months.map((m, idx) => {
                    const isSelected = idx === activeIdx;
                    const barH = m.turnover > 0 ? Math.max(18, Math.round((m.turnover / maxTurnoverVal) * 92)) : 6;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedTurnoverIdx(idx)}
                        title={`${m.label}: ${m.turnover}x (BOM Issued: ${formatINRCompact(m.issuedVal)} / Stock: ${formatINRCompact(m.value)})`}
                        style={{
                          flex: 1,
                          border: 'none',
                          background: isSelected ? '#F0FDF4' : 'transparent',
                          borderRadius: '10px',
                          padding: '4px 2px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '5px',
                          height: '100%',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          color: m.turnover > 0 ? (isSelected ? '#047857' : '#059669') : '#94A3B8'
                        }}>
                          {m.turnover}x
                        </span>
                        <div style={{
                          width: '100%',
                          maxWidth: '34px',
                          height: `${barH}px`,
                          background: m.turnover <= 0
                            ? '#CBD5E1'
                            : (isSelected
                              ? 'linear-gradient(180deg, #059669 0%, #0E7490 100%)'
                              : '#A7F3D0'),
                          borderRadius: '6px 6px 2px 2px',
                          boxShadow: isSelected && m.turnover > 0 ? '0 4px 10px rgba(5, 150, 105, 0.25)' : 'none',
                          transition: 'all 0.18s ease'
                        }} />
                        <span style={{
                          fontSize: '10.5px',
                          fontWeight: isSelected ? '800' : '700',
                          color: isSelected ? '#0F172A' : '#64748B'
                        }}>
                          {m.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Selected Month Live Breakdown */}
              <div style={{
                marginTop: 'auto',
                paddingTop: '10px',
                borderTop: '1px dashed #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                fontSize: '11px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: '800', color: '#0F172A' }}>{activeMonth.label}:</span>
                  <span style={{ color: '#475569', fontWeight: '600' }}>
                    BOM Issued <strong style={{ color: '#059669' }}>{formatINRCompact(activeMonth.issuedVal)}</strong>
                  </span>
                  <span style={{ color: '#CBD5E1' }}>•</span>
                  <span style={{ color: '#475569', fontWeight: '600' }}>
                    Stock <strong style={{ color: '#0F172A' }}>{formatINRCompact(activeMonth.value)}</strong>
                  </span>
                </div>
                <span style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  color: daysToTurn ? '#0E7490' : '#64748B',
                  backgroundColor: daysToTurn ? '#ECFEFF' : '#F1F5F9',
                  border: `1px solid ${daysToTurn ? '#A5F3FC' : '#E2E8F0'}`,
                  padding: '2px 8px',
                  borderRadius: '999px'
                }}>
                  {daysToTurn ? `~${daysToTurn} Days / Turn` : 'Click any month bar'}
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ROW 2: INVENTORY VALUE TREND + INVENTORY AGEING (2-COLUMN SPACIOUS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {/* 3. Inventory Value Trend (Executive Interactive 6-Month Card) */}
        {(() => {
          const months = analytics.trendMonths || [];
          const latestIdx = Math.max(0, months.length - 1);
          const activeIdx = selectedTrendIdx !== null && months[selectedTrendIdx] ? selectedTrendIdx : latestIdx;
          const activeMonth = months[activeIdx] || { label: '—', value: 0, inwardVal: 0, issuedVal: 0 };
          const prevMonth = activeIdx > 0 ? months[activeIdx - 1] : null;
          const momDiff = prevMonth ? activeMonth.value - prevMonth.value : 0;
          const momPct = prevMonth && prevMonth.value > 0 ? ((momDiff / prevMonth.value) * 100).toFixed(1) : null;
          const peakMonth = months.reduce((best, m) => ((m.value || 0) >= (best.value || 0) ? m : best), months[0] || { label: '—', value: 0 });

          return (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={cardTitleStyle}>Inventory Value Trend (6 Months)</span>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    color: '#0E7490',
                    backgroundColor: '#ECFEFF',
                    border: '1px solid #A5F3FC',
                    padding: '2px 8px',
                    borderRadius: '999px'
                  }}>
                    Live Stock Flow
                  </span>
                </div>
              </div>

              {/* 3-Metric Executive Summary Strip */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '8px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '8px 12px'
              }}>
                <div>
                  <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                    {activeMonth.label} Stock
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>
                    {formatINRCompact(activeMonth.value)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                    6-Mo Peak
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: '#0E7490' }}>
                    {formatINRCompact(peakMonth.value)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                    MoM Change
                  </div>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '900',
                    color: momDiff > 0 ? '#059669' : (momDiff < 0 ? '#DC2626' : '#475569')
                  }}>
                    {momDiff > 0 ? '+' : (momDiff < 0 ? '-' : '')}
                    {formatINRCompact(Math.abs(momDiff))}
                    {momPct !== null ? ` (${Number(momPct) > 0 ? '+' : ''}${momPct}%)` : ''}
                  </div>
                </div>
              </div>

              {/* Interactive Bar Chart with Subtle Gridlines */}
              <div style={{ position: 'relative', flex: 1, minHeight: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingTop: '12px' }}>
                <div style={{
                  position: 'absolute',
                  inset: '14px 0 24px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  pointerEvents: 'none'
                }}>
                  <div style={{ borderTop: '1px dashed #E2E8F0', width: '100%' }} />
                  <div style={{ borderTop: '1px dashed #E2E8F0', width: '100%' }} />
                  <div style={{ borderTop: '1px solid #E2E8F0', width: '100%' }} />
                </div>

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '10px', height: '100%' }}>
                  {months.map((m, idx) => {
                    const isSelected = idx === activeIdx;
                    const barH = m.value > 0 ? Math.max(18, Math.round((m.value / maxTrendVal) * 92)) : 6;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedTrendIdx(idx)}
                        title={`${m.label}: Stock ${formatINRCompact(m.value)} (Inward: +${formatINRCompact(m.inwardVal)}, Issued: -${formatINRCompact(m.issuedVal)})`}
                        style={{
                          flex: 1,
                          border: 'none',
                          background: isSelected ? '#ECFEFF' : 'transparent',
                          borderRadius: '10px',
                          padding: '4px 2px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '5px',
                          height: '100%',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          color: m.value > 0 ? (isSelected ? '#075985' : '#0E7490') : '#94A3B8',
                          whiteSpace: 'nowrap'
                        }}>
                          {formatINRCompact(m.value).replace('₹ ', '')}
                        </span>
                        <div style={{
                          width: '100%',
                          maxWidth: '34px',
                          height: `${barH}px`,
                          background: m.value <= 0
                            ? '#CBD5E1'
                            : (isSelected
                              ? 'linear-gradient(180deg, #0E7490 0%, #075985 100%)'
                              : '#BAE6FD'),
                          borderRadius: '6px 6px 2px 2px',
                          boxShadow: isSelected && m.value > 0 ? '0 4px 10px rgba(14, 116, 144, 0.25)' : 'none',
                          transition: 'all 0.18s ease'
                        }} />
                        <span style={{
                          fontSize: '10.5px',
                          fontWeight: isSelected ? '800' : '700',
                          color: isSelected ? '#0F172A' : '#64748B'
                        }}>
                          {m.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Selected Month Flow Breakdown */}
              <div style={{
                marginTop: 'auto',
                paddingTop: '10px',
                borderTop: '1px dashed #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                fontSize: '11px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: '800', color: '#0F172A' }}>{activeMonth.label}:</span>
                  <span style={{ color: '#475569', fontWeight: '600' }}>
                    GRN Inward <strong style={{ color: '#059669' }}>+{formatINRCompact(activeMonth.inwardVal)}</strong>
                  </span>
                  <span style={{ color: '#CBD5E1' }}>•</span>
                  <span style={{ color: '#475569', fontWeight: '600' }}>
                    BOM Issued <strong style={{ color: '#D97706' }}>−{formatINRCompact(activeMonth.issuedVal)}</strong>
                  </span>
                </div>
                <span style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  color: '#0E7490',
                  backgroundColor: '#ECFEFF',
                  border: '1px solid #A5F3FC',
                  padding: '2px 8px',
                  borderRadius: '999px'
                }}>
                  Closing: {formatINRCompact(activeMonth.value)}
                </span>
              </div>
            </div>
          );
        })()}

        {/* 4. Inventory Ageing (By Value) - Executive Interactive Card */}
        {(() => {
          const freshVal = analytics.ageingList[0]?.value || 0;
          const modVal = (analytics.ageingList[1]?.value || 0) + (analytics.ageingList[2]?.value || 0);
          const oldVal = (analytics.ageingList[3]?.value || 0) + (analytics.ageingList[4]?.value || 0);
          const above180 = analytics.ageingList[4]?.value || 0;
          const totalSkus = analytics.items.length;

          return (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={cardTitleStyle}>Inventory Ageing (By Value)</span>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    color: above180 > 0 ? '#DC2626' : '#059669',
                    backgroundColor: above180 > 0 ? '#FEF2F2' : '#ECFDF5',
                    border: `1px solid ${above180 > 0 ? '#FECACA' : '#A7F3D0'}`,
                    padding: '2px 8px',
                    borderRadius: '999px'
                  }}>
                    {above180 > 0 ? `180d+ Risk: ${formatINRCompact(above180)}` : `${totalSkus} SKUs Tracked`}
                  </span>
                </div>
              </div>

              {/* 3-Metric Summary Strip */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '8px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '8px 12px'
              }}>
                <div>
                  <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                    Fresh (0–30d)
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: '#059669' }}>
                    {formatINRCompact(freshVal)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                    Mid (31–90d)
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: '#0E7490' }}>
                    {formatINRCompact(modVal)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                    Aged (90d+)
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: oldVal > 0 ? '#DC2626' : '#0F172A' }}>
                    {formatINRCompact(oldVal)}
                  </div>
                </div>
              </div>

              {/* Stacked Multi-Color Ageing Split Bar */}
              <div style={{ width: '100%', height: '8px', backgroundColor: '#F1F5F9', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
                {analytics.ageingList.map((ag, idx) => (
                  <div
                    key={idx}
                    title={`${ag.label}: ${formatINRCompact(ag.value)} (${ag.pct}%)`}
                    style={{
                      width: `${Math.max(0, Number(ag.pct))}%`,
                      height: '100%',
                      backgroundColor: ag.color
                    }}
                  />
                ))}
              </div>

              {/* Interactive Bucket Bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                {analytics.ageingList.map((ag, idx) => {
                  const canInspect = ag.skuCount > 0;
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!canInspect}
                      onClick={() => {
                        if (!canInspect) return;
                        setHighlightedProductCode(null);
                        setCategoryPopupSearch('');
                        setCategoryPopupSeg({
                          name: `Ageing: ${ag.label}`,
                          color: ag.color,
                          pct: ag.pct,
                          skuCount: ag.skuCount,
                          qty: ag.qty,
                          value: ag.value,
                          allItems: ag.allItems
                        });
                      }}
                      style={{
                        border: 'none',
                        background: 'none',
                        padding: '2px 0',
                        width: '100%',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        cursor: canInspect ? 'pointer' : 'default'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <span style={{ width: '9px', height: '9px', borderRadius: '3px', backgroundColor: ag.color, flexShrink: 0 }} />
                          <span style={{ fontWeight: '700', color: '#334155' }}>{ag.label}</span>
                          <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>
                            ({ag.skuCount} {ag.skuCount === 1 ? 'SKU' : 'SKUs'})
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: '800', color: '#0F172A' }}>{formatINRCompact(ag.value)}</span>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '800',
                            color: ag.color,
                            backgroundColor: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            padding: '1px 6px',
                            borderRadius: '6px'
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

              {/* Bottom Hint */}
              <div style={{
                marginTop: 'auto',
                paddingTop: '10px',
                borderTop: '1px dashed #E2E8F0',
                fontSize: '11px',
                color: '#64748B',
                fontWeight: '600',
                textAlign: 'center'
              }}>
                Click any age bracket with SKUs to inspect those items
              </div>
            </div>
          );
        })()}
      </div>

      {/* ROW 3: TOP 10 HIGH VALUE ITEMS + LOW STOCK ALERTS (2-COLUMN SPACIOUS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {/* 5. Top 10 High Value Items */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>Top 10 High Value Items</span>
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('Items Directory')}
              style={{ border: 'none', background: 'none', color: '#0E7490', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
            >
              View All <ArrowRight size={11} />
            </button>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '260px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '7px 8px' }}>Code</th>
                  <th style={{ padding: '7px 8px' }}>Item Description</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {analytics.top10Items.length > 0 ? analytics.top10Items.map((it, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '6px 8px', fontWeight: '800', color: '#0E7490', whiteSpace: 'nowrap' }}>{it.code}</td>
                    <td style={{ padding: '6px 8px', fontWeight: '600', color: '#0F172A' }}>{it.name}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#334155', whiteSpace: 'nowrap' }}>{it.qty.toLocaleString('en-IN')} {it.uom}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap' }}>{formatINRCompact(it.value)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} style={{ padding: '18px', textAlign: 'center', color: '#64748B' }}>No valued inventory items found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 6. Low Stock / Reorder Alerts */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>Low Stock / Reorder Alerts</span>
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('Material Reorder')}
              style={{ border: 'none', background: 'none', color: '#DC2626', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
            >
              Reorder Queue <ArrowRight size={11} />
            </button>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '260px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '7px 8px' }}>Item Description</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>Avail</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>Min</th>
                  <th style={{ padding: '7px 8px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {analytics.lowStockItems.length > 0 ? analytics.lowStockItems.slice(0, 10).map((it, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '6px 8px', fontWeight: '700', color: '#0F172A' }}>
                      <div>{it.name}</div>
                      <div style={{ fontSize: '10px', color: '#64748B' }}>{it.code}</div>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800', color: '#DC2626' }}>{it.qty} {it.uom}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#64748B' }}>{it.minStock}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 7px', borderRadius: '10px', backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                        Reorder
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} style={{ padding: '18px', textAlign: 'center', color: '#059669', fontWeight: '700' }}>All items above minimum threshold.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ROW 4: STOCK BY WAREHOUSE + STOCK HEALTH & TODAY'S SNAPSHOT + KEY ALERTS (3-COLUMN) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
        {/* 7. Stock by Warehouse (2 Warehouses: VRM Structures & Stock Area) */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Stock by Warehouse</span>
              <span style={{
                fontSize: '10px',
                fontWeight: '800',
                color: '#0E7490',
                backgroundColor: '#ECFEFF',
                border: '1px solid #A5F3FC',
                padding: '2px 8px',
                borderRadius: '999px'
              }}>
                2 Locations
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, justifyContent: 'center' }}>
            {analytics.warehouseList.map((w, idx) => {
              const canOpen = w.skuCount > 0;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!canOpen}
                  onClick={() => {
                    if (!canOpen) return;
                    setHighlightedProductCode(null);
                    setCategoryPopupSearch('');
                    setCategoryPopupSeg({
                      name: `Warehouse: ${w.name}`,
                      color: w.color,
                      pct: w.pct,
                      skuCount: w.skuCount,
                      qty: w.qty,
                      value: w.value,
                      allItems: w.allItems
                    });
                  }}
                  style={{
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    width: '100%',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    cursor: canOpen ? 'pointer' : 'default'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', gap: '8px' }}>
                    <div>
                      <div style={{ fontWeight: '800', color: '#0F172A' }}>{w.name}</div>
                      <div style={{ fontSize: '10px', fontWeight: '600', color: '#64748B' }}>{w.sub}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '900', color: w.color }}>{formatINRCompact(w.value)}</div>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>{w.pct}% share</div>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '7px', backgroundColor: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Number(w.pct))}%`, height: '100%', backgroundColor: w.color, borderRadius: '999px' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#475569', fontWeight: '700' }}>
                    <span>{w.skuCount} {w.skuCount === 1 ? 'SKU' : 'SKUs'}</span>
                    <span>{w.qty.toLocaleString('en-IN')} Units</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 11. Stock Health & Today's Snapshot */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>Stock Health &amp; Today&apos;s Snapshot</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '10px', padding: '10px 6px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '700' }}>Active SKUs</div>
              <div style={{ fontSize: '17px', fontWeight: '900', color: '#0F172A' }}>{analytics.items.length}</div>
            </div>
            <div style={{ backgroundColor: '#F0FDF4', borderRadius: '10px', padding: '10px 6px', border: '1px solid #BBF7D0' }}>
              <div style={{ fontSize: '10px', color: '#166534', fontWeight: '700' }}>In-Stock</div>
              <div style={{ fontSize: '17px', fontWeight: '900', color: '#059669' }}>{analytics.healthyCount}</div>
            </div>
            <div style={{ backgroundColor: '#ECFEFF', borderRadius: '10px', padding: '10px 6px', border: '1px solid #A5F3FC' }}>
              <div style={{ fontSize: '10px', color: '#0E7490', fontWeight: '700' }}>Health %</div>
              <div style={{ fontSize: '17px', fontWeight: '900', color: '#0E7490' }}>{analytics.accuracyPct}%</div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '7px',
            backgroundColor: '#F8FAFC',
            borderRadius: '10px',
            padding: '10px 12px',
            border: '1px solid #E2E8F0',
            fontSize: '11.5px',
            marginTop: 'auto'
          }}>
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Today&apos;s Snapshot</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>GRNs Today</span><strong style={{ color: '#059669' }}>{analytics.grnsToday}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>BOM Issues</span><strong style={{ color: '#D97706' }}>{analytics.issuesToday}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total GRNs</span><strong style={{ color: '#0E7490' }}>{grnList.length}</strong></div>
          </div>
        </div>

        {/* 12. Key Alerts (Dedicated Section) */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Key Alerts</span>
              <span style={{
                fontSize: '10px',
                fontWeight: '800',
                color: (analytics.outOfStockItems.length + analytics.lowStockItems.length) > 0 ? '#DC2626' : '#059669',
                backgroundColor: (analytics.outOfStockItems.length + analytics.lowStockItems.length) > 0 ? '#FEF2F2' : '#ECFDF5',
                border: `1px solid ${(analytics.outOfStockItems.length + analytics.lowStockItems.length) > 0 ? '#FECACA' : '#A7F3D0'}`,
                padding: '2px 8px',
                borderRadius: '999px'
              }}>
                {analytics.outOfStockItems.length + analytics.lowStockItems.length} Alerts
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'center' }}>
            {[
              {
                title: 'Out of Stock',
                sub: `${analytics.outOfStockItems.length} items with 0 stock`,
                badge: `${analytics.outOfStockItems.length} SKUs`,
                color: '#DC2626',
                bg: '#FEF2F2',
                border: '#FECACA',
                icon: ShieldAlert,
                items: analytics.outOfStockItems
              },
              {
                title: 'Below Min Level',
                sub: `${analytics.lowStockItems.length} items need reorder`,
                badge: `${analytics.lowStockItems.length} SKUs`,
                color: '#D97706',
                bg: '#FFFBEB',
                border: '#FDE68A',
                icon: AlertTriangle,
                items: analytics.lowStockItems
              },
              {
                title: 'Aged > 180 Days',
                sub: `${analytics.ageingList[4]?.skuCount || 0} old stock items`,
                badge: formatINRCompact(analytics.above180Val),
                color: '#475569',
                bg: '#F8FAFC',
                border: '#E2E8F0',
                icon: Clock,
                items: analytics.ageingList[4]?.allItems || []
              }
            ].map((al, idx) => {
              const IconComp = al.icon;
              const canOpen = al.items.length > 0;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!canOpen}
                  onClick={() => {
                    if (!canOpen) return;
                    const totVal = al.items.reduce((s, it) => s + (it.value || 0), 0);
                    const totQty = al.items.reduce((s, it) => s + (it.qty || 0), 0);
                    setHighlightedProductCode(null);
                    setCategoryPopupSearch('');
                    setCategoryPopupSeg({
                      name: `Alert: ${al.title}`,
                      color: al.color,
                      pct: analytics.totalValue > 0 ? ((totVal / analytics.totalValue) * 100).toFixed(1) : '0.0',
                      skuCount: al.items.length,
                      qty: totQty,
                      value: totVal,
                      allItems: [...al.items].sort((a, b) => b.value - a.value)
                    });
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    backgroundColor: al.bg,
                    border: `1px solid ${al.border}`,
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
                    fontSize: '10.5px',
                    fontWeight: '800',
                    color: al.color,
                    backgroundColor: '#FFFFFF',
                    border: `1px solid ${al.border}`,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    whiteSpace: 'nowrap'
                  }}>
                    {al.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ROW 5: 2-COLUMN BOTTOM ANALYTICS (Fast vs Slow, ABC Analysis — Interactive Donut + Product Popup) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {[
          {
            title: 'Fast vs Slow Moving',
            badge: 'BOM Velocity',
            centerSub: 'By Velocity',
            segments: analytics.movementSegments,
            selected: selectedMovement,
            setSelected: setSelectedMovement,
            hint: 'Click any velocity tier or donut slice to inspect items'
          },
          {
            title: 'ABC Analysis (By Value)',
            badge: 'Pareto 70/20/10',
            centerSub: 'Pareto Split',
            segments: analytics.abcSegments,
            selected: selectedAbc,
            setSelected: setSelectedAbc,
            hint: 'Click any ABC class or donut slice to inspect items'
          }
        ].map((panel, pIdx) => {
          const activeSeg = panel.selected
            ? panel.segments.find(s => s.name === panel.selected) || null
            : null;
          const toggleSeg = (name) => {
            const seg = panel.segments.find(s => s.name === name) || null;
            panel.setSelected(name);
            if (seg) {
              setHighlightedProductCode(null);
              setCategoryPopupSearch('');
              setCategoryPopupSeg(seg);
            }
          };

          return (
            <div key={pIdx} style={cardStyle}>
              <div style={cardHeaderStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={cardTitleStyle}>{panel.title}</span>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    color: '#0E7490',
                    backgroundColor: '#ECFEFF',
                    border: '1px solid #A5F3FC',
                    padding: '2px 8px',
                    borderRadius: '999px'
                  }}>
                    {panel.badge}
                  </span>
                </div>
                {activeSeg && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {activeSeg.skuCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setHighlightedProductCode(null);
                          setCategoryPopupSearch('');
                          setCategoryPopupSeg(activeSeg);
                        }}
                        style={{
                          border: '1px solid #A5F3FC',
                          backgroundColor: '#ECFEFF',
                          color: '#0E7490',
                          fontSize: '10px',
                          fontWeight: '800',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          cursor: 'pointer'
                        }}
                      >
                        View All ({activeSeg.skuCount})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => panel.setSelected(null)}
                      style={{
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#F8FAFC',
                        color: '#475569',
                        fontSize: '10px',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        cursor: 'pointer'
                      }}
                    >
                      Show All
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, minHeight: '142px' }}>
                <DonutChartSvg
                  segments={panel.segments}
                  centerLabel={activeSeg ? formatINRCompact(activeSeg.value) : formatINRCompact(analytics.totalValue)}
                  centerSub={activeSeg ? `${activeSeg.pct}% Share` : panel.centerSub}
                  activeName={activeSeg?.name || null}
                  onSelectSegment={toggleSeg}
                />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
                  {panel.segments.map((seg, idx) => {
                    const isSelected = activeSeg?.name === seg.name;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleSeg(seg.name)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          width: '100%',
                          textAlign: 'left',
                          padding: '6px 8px',
                          borderRadius: '10px',
                          border: isSelected ? `1.5px solid ${seg.color}` : '1px solid transparent',
                          backgroundColor: isSelected ? '#F8FAFC' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease, border-color 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: seg.color, flexShrink: 0 }} />
                            <span style={{ color: '#0F172A', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {seg.name}
                            </span>
                            <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', whiteSpace: 'nowrap' }}>
                              ({seg.skuCount} {seg.skuCount === 1 ? 'SKU' : 'SKUs'})
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <span style={{ color: '#0F172A', fontWeight: '800', fontSize: '12px' }}>{formatINRCompact(seg.value)}</span>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: '800',
                              color: seg.color,
                              backgroundColor: '#FFFFFF',
                              border: '1px solid #E2E8F0',
                              padding: '1px 6px',
                              borderRadius: '6px'
                            }}>
                              {seg.pct}%
                            </span>
                          </div>
                        </div>
                        <div style={{ width: '100%', height: '5px', backgroundColor: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.min(100, Math.max(seg.value > 0 ? 2 : 0, Number(seg.pct)))}%`,
                            height: '100%',
                            backgroundColor: seg.color,
                            borderRadius: '999px'
                          }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CATEGORY PRODUCTS POPUP MODAL */}
      {categoryPopupSeg && (() => {
        const q = categoryPopupSearch.trim().toLowerCase();
        const modalItems = (categoryPopupSeg.allItems || []).filter(it =>
          !q ||
          String(it.name || '').toLowerCase().includes(q) ||
          String(it.code || '').toLowerCase().includes(q) ||
          String(it.warehouse || '').toLowerCase().includes(q)
        );
        return (
          <div
            onClick={closeCategoryPopup}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(3px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '18px',
                width: '860px',
                maxWidth: '100%',
                maxHeight: '86vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
                border: '1px solid #E2E8F0',
                overflow: 'hidden'
              }}
            >
              {/* Modal Header */}
              <div style={{
                padding: '14px 20px',
                borderBottom: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <span style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '4px',
                    backgroundColor: categoryPopupSeg.color,
                    flexShrink: 0
                  }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '15px', fontWeight: '900', color: '#0F172A' }}>
                        {categoryPopupSeg.name}
                      </span>
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: '800',
                        color: categoryPopupSeg.color,
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        padding: '2px 8px',
                        borderRadius: '999px'
                      }}>
                        {categoryPopupSeg.pct}% Share • {categoryPopupSeg.skuCount} SKUs
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px', fontWeight: '600' }}>
                      Total Value: <strong style={{ color: '#0F172A' }}>{formatINRCompact(categoryPopupSeg.value)}</strong> • Total Qty: <strong style={{ color: '#0E7490' }}>{categoryPopupSeg.qty.toLocaleString('en-IN')} Units</strong>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeCategoryPopup}
                  style={{
                    border: 'none',
                    backgroundColor: '#E2E8F0',
                    color: '#475569',
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Search Bar */}
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  borderRadius: '10px',
                  padding: '7px 12px'
                }}>
                  <Search size={14} color="#64748B" />
                  <input
                    type="text"
                    value={categoryPopupSearch}
                    onChange={(e) => setCategoryPopupSearch(e.target.value)}
                    placeholder="Search product name, SKU code, or warehouse..."
                    style={{
                      border: 'none',
                      background: 'none',
                      outline: 'none',
                      width: '100%',
                      fontSize: '12px',
                      color: '#0F172A',
                      fontWeight: '600'
                    }}
                  />
                </div>
              </div>

              {/* Products Table */}
              <div style={{ overflowY: 'auto', padding: '12px 20px 18px 20px' }}>
                {modalItems.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid #E2E8F0', color: '#64748B', fontSize: '10px', textTransform: 'uppercase' }}>
                        <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: '800' }}>SKU Code</th>
                        <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: '800' }}>Product Name</th>
                        <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: '800' }}>Warehouse</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: '800' }}>Avail Qty</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: '800' }}>Reserved</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: '800' }}>Rate</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: '800' }}>Value</th>
                        <th style={{ textAlign: 'center', padding: '8px 6px', fontWeight: '800' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalItems.map((it, idx) => {
                        const isHighlighted = highlightedProductCode && it.code === highlightedProductCode;
                        const statusLabel = it.isOut ? 'Out of Stock' : (it.isLow ? 'Low Stock' : 'In Stock');
                        const statusBg = it.isOut ? '#FEE2E2' : (it.isLow ? '#FEF3C7' : '#DCFCE7');
                        const statusFg = it.isOut ? '#DC2626' : (it.isLow ? '#B45309' : '#15803D');
                        return (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: '1px solid #F1F5F9',
                              backgroundColor: isHighlighted ? '#ECFEFF' : 'transparent'
                            }}
                          >
                            <td style={{ padding: '8px 6px', fontWeight: '700', color: '#0E7490', whiteSpace: 'nowrap' }}>
                              {it.code}
                            </td>
                            <td style={{ padding: '8px 6px', fontWeight: '700', color: '#0F172A' }}>
                              {it.name}
                            </td>
                            <td style={{ padding: '8px 6px', color: '#475569', fontSize: '11px' }}>
                              {it.warehouse}
                            </td>
                            <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap' }}>
                              {it.qty.toLocaleString('en-IN')} {it.uom}
                            </td>
                            <td style={{ padding: '8px 6px', textAlign: 'right', color: '#64748B', fontWeight: '600', whiteSpace: 'nowrap' }}>
                              {it.reserved.toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '8px 6px', textAlign: 'right', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>
                              ₹ {Math.round(it.rate).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap' }}>
                              {formatINRCompact(it.value)}
                            </td>
                            <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '800',
                                backgroundColor: statusBg,
                                color: statusFg,
                                padding: '2px 8px',
                                borderRadius: '999px',
                                whiteSpace: 'nowrap'
                              }}>
                                {statusLabel}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ textAlign: 'center', padding: '28px 0', color: '#64748B', fontSize: '12.5px', fontWeight: '600' }}>
                    No matching products found in {categoryPopupSeg.name}.
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
