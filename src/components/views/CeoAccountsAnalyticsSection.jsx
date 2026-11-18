import React, { useMemo, useState } from 'react';
import {
  TrendingUp, Wallet, PieChart, Users, Building2,
  Clock, ShieldCheck, BarChart3, X, Search, FileText, ArrowRight
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
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹ ${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹ ${(abs / 100000).toFixed(2)} L`;
  return `${sign}₹ ${Math.round(abs).toLocaleString('en-IN')}`;
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

export default function CeoAccountsAnalyticsSection({
  invList = [],
  poList = [],
  paymentsList = [],
  bomList = [],
  onNavigateTab
}) {
  const [selectedExpCat, setSelectedExpCat] = useState(null);
  const [selectedRevIdx, setSelectedRevIdx] = useState(null);
  const [selectedCfIdx, setSelectedCfIdx] = useState(null);
  const [drillPopup, setDrillPopup] = useState(null);
  const [popupSearch, setPopupSearch] = useState('');

  const closePopup = () => {
    setDrillPopup(null);
    setSelectedExpCat(null);
    setPopupSearch('');
  };

  const analytics = useMemo(() => {
    const now = Date.now();
    let rawInvoices = (invList || []).filter(Boolean);
    let rawPOs = (poList || []).filter(Boolean);
    let rawPayments = (paymentsList || []).filter(Boolean);

    // Localhost-only preview data when local database is empty (NEVER runs on live/dev servers)
    const isLocalhostPreview =
      typeof window !== 'undefined' &&
      ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
      rawInvoices.length === 0 &&
      rawPOs.length === 0;

    if (isLocalhostPreview) {
      const isoDaysAgo = (d) => new Date(now - d * 86400000).toISOString().split('T')[0];
      rawInvoices = [
        { invoiceNo: 'INV/26-27/101', customerName: 'ABC Solar Pvt Ltd', date: isoDaysAgo(12), grandTotal: 5200000, paidAmount: 2000000, status: 'Partially Paid' },
        { invoiceNo: 'INV/26-27/102', customerName: 'Sun Power EPC', date: isoDaysAgo(25), grandTotal: 4650000, paidAmount: 1850000, status: 'Partially Paid' },
        { invoiceNo: 'INV/26-27/103', customerName: 'Green Infra Ltd', date: isoDaysAgo(42), grandTotal: 3800000, paidAmount: 1500000, status: 'Partially Paid' },
        { invoiceNo: 'INV/26-27/104', customerName: 'Bright Energy', date: isoDaysAgo(68), grandTotal: 2950000, paidAmount: 850000, status: 'Overdue' },
        { invoiceNo: 'INV/26-27/105', customerName: 'Voltix Solutions', date: isoDaysAgo(102), grandTotal: 3200000, paidAmount: 1400000, status: 'Overdue' },
        { invoiceNo: 'INV/26-27/106', customerName: 'ABC Solar Pvt Ltd', date: isoDaysAgo(140), grandTotal: 4050000, paidAmount: 4050000, status: 'Paid' }
      ];
      rawPOs = [
        { poNo: 'PO-00081', vendorName: 'AKEYEM SONS', date: isoDaysAgo(14), grandTotal: 4200000, paidAmount: 2000000, status: 'Approved' },
        { poNo: 'PO-00078', vendorName: 'ARUMUGA STEEL', date: isoDaysAgo(38), grandTotal: 3400000, paidAmount: 1600000, status: 'Partially Received' },
        { poNo: 'PO-00072', vendorName: 'VAIBOV POLES', date: isoDaysAgo(71), grandTotal: 2650000, paidAmount: 1250000, status: 'Approved' },
        { poNo: 'PO-00068', vendorName: 'KPR Mill', date: isoDaysAgo(98), grandTotal: 2150000, paidAmount: 1050000, status: 'Approved' },
        { poNo: 'PO-00060', vendorName: 'Shree Ganesh Traders', date: isoDaysAgo(130), grandTotal: 1920000, paidAmount: 1020000, status: 'Fully Received' }
      ];
    }

    // Normalize Invoices (Receivables)
    const invoices = rawInvoices.map((inv, idx) => {
      const docNo = inv.invoiceNo || inv.invoiceNumber || inv.id || `INV-${idx + 1}`;
      const party = inv.customerName || inv.clientName || inv.customer || inv.partyName || 'Customer';
      const dateStr = inv.invoiceDate || inv.date || inv.createdAt || inv.created_at || '';
      const dateTs = parseDateMs(dateStr);
      const total = parseAmount(inv.grandTotal ?? inv.totalAmount ?? inv.total ?? inv.amount ?? 0);
      const paid = parseAmount(inv.paidAmount ?? inv.amountPaid ?? inv.receivedAmount ?? (String(inv.status || '').toLowerCase() === 'paid' ? total : 0));
      const balance = Math.max(0, total - paid);
      const invSub = parseAmount(inv.subTotal ?? inv.subtotal ?? 0);
      const gst = parseAmount(inv.gstAmount ?? inv.taxAmount ?? (invSub > 0 && invSub < total ? (total - invSub) : (total > 0 ? total - total / 1.18 : 0)));
      const ageDays = Number.isFinite(dateTs) ? Math.max(0, Math.floor((now - dateTs) / 86400000)) : 0;
      return { docNo, party, dateStr, dateTs, total, paid, balance, gst, ageDays, type: 'Invoice' };
    });

    // Normalize Purchase Orders (Payables / Purchases)
    const purchaseOrders = rawPOs
      .filter(p => !String(p.status || '').toLowerCase().includes('cancel'))
      .map((po, idx) => {
        const docNo = po.poNo || po.poNumber || po.purchaseorder_number || `PO-${idx + 1}`;
        const party = po.vendor || po.vendorName || po.vendor_name || po.supplierName || 'Vendor';
        const dateStr = po.poDate || po.date || po.createdAt || po.created_at || '';
        const dateTs = parseDateMs(dateStr);
        const total = parseAmount(po.grandTotal ?? po.total ?? po.totalAmount ?? po.amount ?? 0);
        const stLower = String(po.status || po.stage || '').toLowerCase();
        const paid = parseAmount(
          po.paidAmount ??
          po.advancePaid ??
          (stLower.includes('payment processed') || stLower.includes('proceed') || stLower.includes('fully received') || stLower.includes('closed') ? total : 0)
        );
        const balance = Math.max(0, total - paid);
        const poSub = parseAmount(po.subTotal ?? po.subtotal ?? 0);
        const gst = parseAmount(po.taxAmount ?? po.gstAmount ?? (poSub > 0 && poSub < total ? (total - poSub) : (total > 0 ? total - total / 1.18 : 0)));
        const ageDays = Number.isFinite(dateTs) ? Math.max(0, Math.floor((now - dateTs) / 86400000)) : 0;
        return { docNo, party, dateStr, dateTs, total, paid, balance, gst, ageDays, type: 'PO' };
      });

    // Payments collected from paymentsList (if any explicit payments exist beyond invoice paidAmount)
    const paymentRecordsTotal = rawPayments.reduce((s, p) => s + parseAmount(p.amount ?? p.paidAmount ?? p.total ?? 0), 0);

    // 1. P&L & Cash Flow Totals
    const totalRevenue = invoices.reduce((s, i) => s + i.total, 0);
    const totalCogs = purchaseOrders.reduce((s, p) => s + p.total, 0);
    const grossProfit = totalRevenue - totalCogs;
    const grossProfitPct = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0';

    const bomOrderBook = (bomList || []).reduce((s, b) => s + parseAmount(b.grandTotal ?? b.total ?? 0), 0);
    const totalCollected = Math.max(
      invoices.reduce((s, i) => s + i.paid, 0),
      paymentRecordsTotal
    );
    const totalVendorPaid = purchaseOrders.reduce((s, p) => s + p.paid, 0);
    const netCashFlow = totalCollected - totalVendorPaid;

    const totalReceivables = invoices.reduce((s, i) => s + i.balance, 0);
    const totalPayables = purchaseOrders.reduce((s, p) => s + p.balance, 0);

    const outputGst = invoices.reduce((s, i) => s + i.gst, 0);
    const inputGst = purchaseOrders.reduce((s, p) => s + p.gst, 0);
    const netGstPayable = Math.max(0, outputGst - inputGst);
    const estimatedTds = purchaseOrders.reduce((s, p) => s + (p.total * 0.01), 0);

    // 2. Expense Breakup (Purchase vs Input GST vs Pending Payables vs Paid Outflow)
    const expColors = ['#2563EB', '#059669', '#D97706', '#7C3AED'];
    const basePurchases = Math.max(0, totalCogs - inputGst);
    const rawExpenses = [
      { name: 'Material Purchases (Excl. GST)', value: basePurchases, orders: purchaseOrders },
      { name: 'Input GST / Tax Credit', value: inputGst, orders: purchaseOrders },
      { name: 'Paid Vendor Settlements', value: totalVendorPaid, orders: purchaseOrders.filter(p => p.paid > 0) },
      { name: 'Pending Vendor Payables', value: totalPayables, orders: purchaseOrders.filter(p => p.balance > 0) }
    ];
    const expTotal = rawExpenses.reduce((s, e) => s + e.value, 0);
    const expenseSegments = rawExpenses.map((e, idx) => ({
      ...e,
      color: expColors[idx % expColors.length],
      pct: expTotal > 0 ? ((e.value / expTotal) * 100).toFixed(1) : '0.0'
    }));

    // 3. Monthly Revenue vs Margin & Cash Flow Trend (Last 6 Months)
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
        revenue: 0,
        expense: 0,
        inflow: 0,
        outflow: 0,
        netMargin: 0,
        netCf: 0
      };
      trendMap.set(key, bucket);
      trendMonths.push(bucket);
    }
    invoices.forEach(inv => {
      if (!Number.isFinite(inv.dateTs)) return;
      const d = new Date(inv.dateTs);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const b = trendMap.get(key);
      if (b) {
        b.revenue += inv.total;
        b.inflow += inv.paid;
      }
    });
    purchaseOrders.forEach(po => {
      if (!Number.isFinite(po.dateTs)) return;
      const d = new Date(po.dateTs);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const b = trendMap.get(key);
      if (b) {
        b.expense += po.total;
        b.outflow += po.paid;
      }
    });
    trendMonths.forEach(m => {
      m.netMargin = m.revenue - m.expense;
      m.netCf = m.inflow - m.outflow;
    });

    // 4. Ageing Buckets (Receivables & Payables)
    const buildAgeing = (pool) => {
      const open = pool.filter(x => x.balance > 0);
      const tot = open.reduce((s, x) => s + x.balance, 0);
      return [
        { label: '0 - 30 Days', color: '#059669', min: 0, max: 30 },
        { label: '31 - 60 Days', color: '#D97706', min: 31, max: 60 },
        { label: '61 - 90 Days', color: '#EA580C', min: 61, max: 90 },
        { label: 'Above 90 Days', color: '#DC2626', min: 91, max: Infinity }
      ].map(b => {
        const list = open.filter(x => x.ageDays >= b.min && x.ageDays <= b.max);
        const val = list.reduce((s, x) => s + x.balance, 0);
        return {
          ...b,
          value: val,
          count: list.length,
          pct: tot > 0 ? ((val / tot) * 100).toFixed(1) : '0.0',
          orders: list
        };
      });
    };

    const receivableAgeing = buildAgeing(invoices);
    const payableAgeing = buildAgeing(purchaseOrders);

    // 5. Top 5 Customers (By Outstanding) & Top 5 Vendors (By Payable)
    const groupTop5 = (pool) => {
      const open = pool.filter(x => x.balance > 0);
      const tot = open.reduce((s, x) => s + x.balance, 0);
      const mp = new Map();
      open.forEach(x => {
        const prev = mp.get(x.party) || { party: x.party, amount: 0, count: 0, orders: [] };
        prev.amount += x.balance;
        prev.count += 1;
        prev.orders.push(x);
        mp.set(x.party, prev);
      });
      return Array.from(mp.values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
        .map(row => ({
          ...row,
          pct: tot > 0 ? ((row.amount / tot) * 100).toFixed(1) : '0.0'
        }));
    };

    const top5Customers = groupTop5(invoices);
    const top5Vendors = groupTop5(purchaseOrders);

    // 6. Key Financial Ratios
    const collectionRatePct = totalRevenue > 0 ? ((totalCollected / totalRevenue) * 100).toFixed(1) : '0.0';
    const avgRecDays = invoices.length > 0
      ? Math.round(invoices.reduce((s, i) => s + i.ageDays, 0) / invoices.length)
      : 0;
    const avgPayDays = purchaseOrders.length > 0
      ? Math.round(purchaseOrders.reduce((s, p) => s + p.ageDays, 0) / purchaseOrders.length)
      : 0;

    return {
      invoices,
      purchaseOrders,
      totalRevenue,
      totalCogs,
      grossProfit,
      grossProfitPct,
      bomOrderBook,
      totalCollected,
      totalVendorPaid,
      netCashFlow,
      totalReceivables,
      totalPayables,
      uniqueCustomers: new Set(invoices.map(i => i.party)).size,
      uniqueVendors: new Set(purchaseOrders.map(p => p.party)).size,
      outputGst,
      inputGst,
      netGstPayable,
      estimatedTds,
      expenseSegments,
      expTotal,
      trendMonths,
      receivableAgeing,
      payableAgeing,
      top5Customers,
      top5Vendors,
      collectionRatePct,
      avgRecDays,
      avgPayDays
    };
  }, [invList, poList, paymentsList, bomList]);

  const maxRevVal = Math.max(1, ...analytics.trendMonths.map(m => m.revenue));
  const maxCfVal = Math.max(1, ...analytics.trendMonths.map(m => Math.max(m.inflow, m.outflow)));
  const latestIdx = Math.max(0, analytics.trendMonths.length - 1);
  const activeRevIdx = selectedRevIdx !== null && analytics.trendMonths[selectedRevIdx] ? selectedRevIdx : latestIdx;
  const activeCfIdx = selectedCfIdx !== null && analytics.trendMonths[selectedCfIdx] ? selectedCfIdx : latestIdx;
  const activeRevMonth = analytics.trendMonths[activeRevIdx] || { label: '—', revenue: 0, expense: 0, netMargin: 0 };
  const activeCfMonth = analytics.trendMonths[activeCfIdx] || { label: '—', inflow: 0, outflow: 0, netCf: 0 };

  const activeExpSeg = selectedExpCat ? analytics.expenseSegments.find(e => e.name === selectedExpCat) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ROW 1: PROFIT & LOSS SUMMARY + MONTHLY REVENUE VS MARGIN TREND */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {/* 1. PROFIT & LOSS SUMMARY */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Profit &amp; Loss Summary</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#059669',
                backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                Live Billed vs Spend
              </span>
            </div>
          </div>

          <div style={summaryStripStyle}>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Total Revenue</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>{formatINRCompact(analytics.totalRevenue)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Total Purchases</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#D97706' }}>{formatINRCompact(analytics.totalCogs)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Gross Margin %</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: analytics.grossProfit >= 0 ? '#059669' : '#DC2626' }}>{analytics.grossProfitPct}%</div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '7px 8px' }}>Particulars</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>Share / %</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Taxable + GST Billed Revenue', val: formatINRCompact(analytics.totalRevenue), pct: '100.0%', color: '#0F172A' },
                  { label: 'Procurement & Material Cost (POs)', val: formatINRCompact(analytics.totalCogs), pct: analytics.totalRevenue > 0 ? `${((analytics.totalCogs / analytics.totalRevenue) * 100).toFixed(1)}%` : '0.0%', color: '#D97706' },
                  { label: 'Gross Profit (Revenue − Purchases)', val: formatINRCompact(analytics.grossProfit), pct: `${analytics.grossProfitPct}%`, color: analytics.grossProfit >= 0 ? '#059669' : '#DC2626', bold: true },
                  { label: 'Confirmed BOM Order Book', val: formatINRCompact(analytics.bomOrderBook), pct: `${analytics.invoices.length} Inv`, color: '#0E7490' },
                  { label: 'Realized Collections', val: formatINRCompact(analytics.totalCollected), pct: `${analytics.collectionRatePct}%`, color: '#059669' }
                ].map((r, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: r.bold ? '#F8FAFC' : 'transparent' }}>
                    <td style={{ padding: '7px 8px', fontWeight: r.bold ? '800' : '600', color: '#0F172A' }}>{r.label}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: '800', color: r.color, whiteSpace: 'nowrap' }}>{r.val}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: '700', color: '#475569' }}>{r.pct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. MONTHLY REVENUE VS NET MARGIN TREND */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Monthly Revenue vs Margin Trend</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#0E7490',
                backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                6 Months
              </span>
            </div>
          </div>

          <div style={summaryStripStyle}>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>{activeRevMonth.label} Revenue</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>{formatINRCompact(activeRevMonth.revenue)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Purchases</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#D97706' }}>{formatINRCompact(activeRevMonth.expense)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Net Margin</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: activeRevMonth.netMargin >= 0 ? '#059669' : '#DC2626' }}>
                {formatINRCompact(activeRevMonth.netMargin)}
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
                const isSelected = idx === activeRevIdx;
                const barH = m.revenue > 0 ? Math.max(18, Math.round((m.revenue / maxRevVal) * 92)) : 6;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedRevIdx(idx)}
                    style={{
                      flex: 1, border: 'none',
                      background: isSelected ? '#ECFEFF' : 'transparent',
                      borderRadius: '10px', padding: '4px 2px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                      gap: '5px', height: '100%', cursor: 'pointer',
                      transition: 'background-color 0.15s ease'
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

          <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px dashed #E2E8F0', display: 'flex', justifyContent: 'space-between', fontSize: '11px', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontWeight: '700', color: '#475569' }}>
              <strong style={{ color: '#0F172A' }}>{activeRevMonth.label}:</strong> Billed {formatINRCompact(activeRevMonth.revenue)} • Cost {formatINRCompact(activeRevMonth.expense)}
            </span>
            <span style={{
              fontSize: '10px', fontWeight: '800', color: '#059669',
              backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0',
              padding: '2px 8px', borderRadius: '999px'
            }}>
              Margin: {formatINRCompact(activeRevMonth.netMargin)}
            </span>
          </div>
        </div>
      </div>

      {/* ROW 2: CASH FLOW SUMMARY + EXPENSE BREAKUP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {/* 3. CASH FLOW SUMMARY */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Cash Flow Summary</span>
              <span style={{
                fontSize: '10px', fontWeight: '800',
                color: analytics.netCashFlow >= 0 ? '#059669' : '#DC2626',
                backgroundColor: analytics.netCashFlow >= 0 ? '#ECFDF5' : '#FEF2F2',
                border: `1px solid ${analytics.netCashFlow >= 0 ? '#A7F3D0' : '#FECACA'}`,
                padding: '2px 8px', borderRadius: '999px'
              }}>
                Net: {formatINRCompact(analytics.netCashFlow)}
              </span>
            </div>
          </div>

          <div style={summaryStripStyle}>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Inflow (Collected)</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#059669' }}>{formatINRCompact(analytics.totalCollected)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Outflow (Paid POs)</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#D97706' }}>{formatINRCompact(analytics.totalVendorPaid)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Net Cash Flow</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: analytics.netCashFlow >= 0 ? '#0E7490' : '#DC2626' }}>{formatINRCompact(analytics.netCashFlow)}</div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '7px 8px' }}>Cash Flow Activity</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Operating Inflow — Customer Collections', val: formatINRCompact(analytics.totalCollected), color: '#059669' },
                  { label: 'Operating Outflow — Vendor PO Settlements', val: formatINRCompact(-analytics.totalVendorPaid), color: '#DC2626' },
                  { label: 'Pending Receivables (Expected Inflow)', val: formatINRCompact(analytics.totalReceivables), color: '#0E7490' },
                  { label: 'Pending Payables (Upcoming Outflow)', val: formatINRCompact(-analytics.totalPayables), color: '#D97706' },
                  { label: 'Net Operating Cash Position', val: formatINRCompact(analytics.netCashFlow), color: analytics.netCashFlow >= 0 ? '#059669' : '#DC2626', bold: true }
                ].map((r, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: r.bold ? '#F8FAFC' : 'transparent' }}>
                    <td style={{ padding: '7px 8px', fontWeight: r.bold ? '800' : '600', color: '#0F172A' }}>{r.label}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: '800', color: r.color, whiteSpace: 'nowrap' }}>{r.val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. EXPENSE BREAKUP */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={cardTitleStyle}>Expense Breakup</span>
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#0E7490',
                backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC',
                padding: '2px 8px', borderRadius: '999px'
              }}>
                {formatINRCompact(analytics.expTotal)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, minHeight: '150px' }}>
            <DonutChartSvg
              segments={analytics.expenseSegments}
              centerLabel={activeExpSeg ? formatINRCompact(activeExpSeg.value) : formatINRCompact(analytics.totalCogs)}
              centerSub={activeExpSeg ? `${activeExpSeg.pct}% Share` : 'Total Spend'}
              activeName={selectedExpCat}
              onSelectSegment={(name) => {
                const seg = analytics.expenseSegments.find(e => e.name === name);
                if (!seg || seg.orders.length === 0) return;
                setSelectedExpCat(name);
                setPopupSearch('');
                setDrillPopup({ title: `Expense: ${seg.name}`, color: seg.color, orders: seg.orders });
              }}
            />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
              {analytics.expenseSegments.map((seg, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={seg.orders.length === 0}
                  onClick={() => {
                    if (seg.orders.length === 0) return;
                    setSelectedExpCat(seg.name);
                    setPopupSearch('');
                    setDrillPopup({ title: `Expense: ${seg.name}`, color: seg.color, orders: seg.orders });
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: '4px',
                    width: '100%', textAlign: 'left', padding: '6px 8px',
                    borderRadius: '10px',
                    border: selectedExpCat === seg.name ? `1.5px solid ${seg.color}` : '1px solid transparent',
                    backgroundColor: selectedExpCat === seg.name ? '#F8FAFC' : 'transparent',
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

      {/* ROW 3: ACCOUNTS RECEIVABLE (DEBTORS) + ACCOUNTS PAYABLE (CREDITORS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {[
          {
            title: 'Accounts Receivable (Debtors)',
            badge: `${analytics.uniqueCustomers} Customers`,
            strip: [
              { label: 'Total Outstanding', val: formatINRCompact(analytics.totalReceivables), color: '#0E7490' },
              { label: 'Collected', val: formatINRCompact(analytics.totalCollected), color: '#059669' },
              { label: 'Avg Ageing', val: `${analytics.avgRecDays} Days`, color: '#0F172A' }
            ],
            brackets: analytics.receivableAgeing,
            popupPrefix: 'Receivables'
          },
          {
            title: 'Accounts Payable (Creditors)',
            badge: `${analytics.uniqueVendors} Vendors`,
            strip: [
              { label: 'Total Payable', val: formatINRCompact(analytics.totalPayables), color: '#D97706' },
              { label: 'Paid to Vendors', val: formatINRCompact(analytics.totalVendorPaid), color: '#059669' },
              { label: 'Avg Ageing', val: `${analytics.avgPayDays} Days`, color: '#0F172A' }
            ],
            brackets: analytics.payableAgeing,
            popupPrefix: 'Payables'
          }
        ].map((panel, pIdx) => (
          <div key={pIdx} style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={cardTitleStyle}>{panel.title}</span>
                <span style={{
                  fontSize: '10px', fontWeight: '800', color: '#0E7490',
                  backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC',
                  padding: '2px 8px', borderRadius: '999px'
                }}>
                  {panel.badge}
                </span>
              </div>
            </div>

            <div style={summaryStripStyle}>
              {panel.strip.map((st, sIdx) => (
                <div key={sIdx}>
                  <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>{st.label}</div>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: st.color }}>{st.val}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {panel.brackets.map((b, bIdx) => {
                const canOpen = b.orders.length > 0;
                return (
                  <button
                    key={bIdx}
                    type="button"
                    disabled={!canOpen}
                    onClick={() => {
                      if (!canOpen) return;
                      setPopupSearch('');
                      setDrillPopup({ title: `${panel.popupPrefix}: ${b.label}`, color: b.color, orders: b.orders });
                    }}
                    style={{
                      border: 'none', background: 'none', padding: '2px 0', width: '100%', textAlign: 'left',
                      display: 'flex', flexDirection: 'column', gap: '4px', cursor: canOpen ? 'pointer' : 'default'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span style={{ width: '9px', height: '9px', borderRadius: '3px', backgroundColor: b.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: '700', color: '#334155' }}>{b.label}</span>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>({b.count})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: '800', color: '#0F172A' }}>{formatINRCompact(b.value)}</span>
                        <span style={{
                          fontSize: '10px', fontWeight: '800', color: b.color,
                          backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0',
                          padding: '1px 6px', borderRadius: '6px'
                        }}>
                          {b.pct}%
                        </span>
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, Number(b.pct))}%`, height: '100%', backgroundColor: b.color, borderRadius: '999px' }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ROW 4: TOP 5 CUSTOMERS (BY OUTSTANDING) + TOP 5 VENDORS (BY PAYABLE) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {[
          {
            title: 'Top 5 Customers (By Outstanding)',
            colName: 'Customer Name',
            valCol: 'Outstanding',
            rows: analytics.top5Customers,
            icon: Users,
            empty: 'No outstanding customer balances.'
          },
          {
            title: 'Top 5 Vendors (By Payable)',
            colName: 'Vendor Name',
            valCol: 'Payable',
            rows: analytics.top5Vendors,
            icon: Building2,
            empty: 'No pending vendor payables.'
          }
        ].map((tbl, tIdx) => {
          const IconComp = tbl.icon;
          return (
            <div key={tIdx} style={cardStyle}>
              <div style={cardHeaderStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={cardTitleStyle}>{tbl.title}</span>
                  <span style={{
                    fontSize: '10px', fontWeight: '800', color: '#0E7490',
                    backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC',
                    padding: '2px 8px', borderRadius: '999px'
                  }}>
                    {tbl.rows.length} Listed
                  </span>
                </div>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: '240px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '7px 8px' }}>{tbl.colName}</th>
                      <th style={{ padding: '7px 8px', textAlign: 'right' }}>{tbl.valCol}</th>
                      <th style={{ padding: '7px 8px', textAlign: 'right' }}>% of Total</th>
                      <th style={{ padding: '7px 8px', textAlign: 'center' }}>Docs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tbl.rows.length > 0 ? tbl.rows.map((r, rIdx) => (
                      <tr
                        key={rIdx}
                        onClick={() => {
                          setPopupSearch('');
                          setDrillPopup({ title: `${tbl.valCol}: ${r.party}`, color: '#0E7490', orders: r.orders });
                        }}
                        style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '6px 8px', fontWeight: '700', color: '#0E7490', textDecoration: 'underline' }}>{r.party}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap' }}>{formatINRCompact(r.amount)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', color: '#475569' }}>{r.pct}%</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '700', color: '#334155' }}>{r.count}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} style={{ padding: '18px', textAlign: 'center', color: '#64748B' }}>{tbl.empty}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* ROW 5: TDS & GST STATUS + KEY FINANCIAL RATIOS + MONTHLY CASH FLOW TREND */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
        {/* 9. TDS & GST STATUS */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>TDS &amp; GST Status</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Est. TDS (1%)</div>
              <div style={{ fontSize: '17px', fontWeight: '900', color: '#0F172A', marginTop: '4px' }}>{formatINRCompact(analytics.estimatedTds)}</div>
              <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>On Purchase Orders</div>
            </div>
            <div style={{ backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#0E7490', textTransform: 'uppercase' }}>Net GST Payable</div>
              <div style={{ fontSize: '17px', fontWeight: '900', color: '#0E7490', marginTop: '4px' }}>{formatINRCompact(analytics.netGstPayable)}</div>
              <div style={{ fontSize: '10px', color: '#0E7490', marginTop: '4px' }}>Out − Input Credit</div>
            </div>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px dashed #E2E8F0', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#475569' }}>Output GST: <strong style={{ color: '#0F172A' }}>{formatINRCompact(analytics.outputGst)}</strong></span>
            <span style={{ color: '#475569' }}>ITC: <strong style={{ color: '#059669' }}>{formatINRCompact(analytics.inputGst)}</strong></span>
          </div>
        </div>

        {/* 10. KEY FINANCIAL RATIOS */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>Key Financial Ratios</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px' }}>
            {[
              { label: 'Gross Profit %', val: `${analytics.grossProfitPct}%`, color: Number(analytics.grossProfitPct) >= 20 ? '#059669' : '#D97706' },
              { label: 'Collection Efficiency %', val: `${analytics.collectionRatePct}%`, color: Number(analytics.collectionRatePct) >= 75 ? '#059669' : '#D97706' },
              { label: 'Debtors Avg Ageing', val: `${analytics.avgRecDays} Days`, color: '#0F172A' },
              { label: 'Creditors Avg Ageing', val: `${analytics.avgPayDays} Days`, color: '#0F172A' }
            ].map((rt, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontWeight: '700', color: '#334155' }}>{rt.label}</span>
                <span style={{ fontWeight: '900', color: rt.color }}>{rt.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 11. MONTHLY CASH FLOW TREND */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>Monthly Cash Flow Trend</span>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('Billing Dashboard')}
                style={{ border: 'none', background: 'none', color: '#0E7490', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
              >
                Billing <ArrowRight size={11} />
              </button>
            )}
          </div>
          <div style={{ position: 'relative', flex: 1, minHeight: '130px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingTop: '8px' }}>
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '6px', height: '100%' }}>
              {analytics.trendMonths.map((m, idx) => {
                const isSelected = idx === activeCfIdx;
                const inH = m.inflow > 0 ? Math.max(12, Math.round((m.inflow / maxCfVal) * 74)) : 4;
                const outH = m.outflow > 0 ? Math.max(12, Math.round((m.outflow / maxCfVal) * 74)) : 4;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedCfIdx(idx)}
                    style={{
                      flex: 1, border: 'none',
                      background: isSelected ? '#F0FDF4' : 'transparent',
                      borderRadius: '8px', padding: '4px 2px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                      gap: '4px', height: '100%', cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px' }}>
                      <div title={`Inflow: ${formatINRCompact(m.inflow)}`} style={{ width: '9px', height: `${inH}px`, background: isSelected ? '#059669' : '#A7F3D0', borderRadius: '4px 4px 1px 1px' }} />
                      <div title={`Outflow: ${formatINRCompact(m.outflow)}`} style={{ width: '9px', height: `${outH}px`, background: isSelected ? '#D97706' : '#FDE68A', borderRadius: '4px 4px 1px 1px' }} />
                    </div>
                    <span style={{ fontSize: '9.5px', fontWeight: isSelected ? '800' : '600', color: isSelected ? '#0F172A' : '#64748B' }}>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px dashed #E2E8F0', fontSize: '10.5px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#059669', fontWeight: '700' }}>In: {formatINRCompact(activeCfMonth.inflow)}</span>
            <span style={{ color: '#D97706', fontWeight: '700' }}>Out: {formatINRCompact(activeCfMonth.outflow)}</span>
          </div>
        </div>
      </div>

      {/* DRILLDOWN MODAL */}
      {drillPopup && (() => {
        const q = popupSearch.trim().toLowerCase();
        const filtered = (drillPopup.orders || []).filter(o =>
          !q ||
          String(o.docNo || '').toLowerCase().includes(q) ||
          String(o.party || '').toLowerCase().includes(q)
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
                  <span style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: drillPopup.color }} />
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
                  placeholder="Search document number or party..."
                  style={{ flex: 1, border: '1px solid #CBD5E1', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', outline: 'none' }}
                />
              </div>
              <div style={{ overflowY: 'auto', padding: '12px 20px', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '8px' }}>Doc No.</th>
                      <th style={{ padding: '8px' }}>Party</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Paid</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Balance</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length > 0 ? filtered.map((o, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px', fontWeight: '800', color: '#0E7490', whiteSpace: 'nowrap' }}>{o.docNo}</td>
                        <td style={{ padding: '8px', fontWeight: '700', color: '#0F172A' }}>{o.party}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>{formatINRCompact(o.total)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#059669', fontWeight: '700' }}>{formatINRCompact(o.paid)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: o.balance > 0 ? '#DC2626' : '#059669', fontWeight: '800' }}>{formatINRCompact(o.balance)}</td>
                        <td style={{ padding: '8px', textAlign: 'center', color: '#64748B', fontWeight: '700' }}>{o.ageDays}d</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>No matching records found.</td></tr>
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
