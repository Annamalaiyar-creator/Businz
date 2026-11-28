import React, { useMemo, useState } from 'react';
import CeoKpiGrid from '../ceoDashboard/CeoKpiGrid';
import { triggerCeoDrilldown } from '../../utils/ceoDrilldownFilter';

const parseAmount = (val) => {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const cleaned = String(val ?? '0').replace(/[^0-9.-]/g, '');
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
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};

const formatExactINR = (val) => {
  const n = Number(val) || 0;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getNetTaxInvoiceVal = (inv) => {
  const exGst = parseAmount(inv?.subTotal ?? inv?.subtotal ?? inv?.taxableValue ?? inv?.taxableAmount ?? inv?.baseAmount);
  if (exGst > 0) return exGst;
  const gross = parseAmount(inv?.grandTotal ?? inv?.grand_total ?? inv?.totalAmount ?? inv?.invoiceAmount ?? inv?.amount);
  return gross > 0 ? gross / 1.18 : 0;
};

const BusinzSectionCard = ({ title, children }) => (
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
      padding: '12px 16px',
      backgroundColor: '#F8FAFC',
      borderBottom: '1px solid #EAEFEF'
    }}>
      <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{title}</h3>
    </div>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
  </div>
);

const PERIOD_PILLS = ['Today', 'MTD', 'This Month', 'This Quarter', 'This Year', 'Yesterday', 'Last Month', 'Last Quarter', 'Last Year', 'Custom'];

const EXPENSE_COLORS = ['#0E7490', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#64748B'];

export default function CeoAccountsAnalyticsSection({
  allInvList = [],
  allPoList = [],
  allPaymentsList = [],
  selectedPeriod = 'Today',
  onNavigateTab
}) {
  const [localPeriod, setLocalPeriod] = useState(() => (PERIOD_PILLS.includes(selectedPeriod) ? selectedPeriod : 'This Month'));
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [fromDate, setFromDate] = useState(todayIso);
  const [toDate, setToDate] = useState(todayIso);

  const analytics = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 86400000 - 1;

    let rangeStart = 0;
    let rangeEnd = todayEnd;
    let prevStart = 0;
    let prevEnd = 0;

    if (localPeriod === 'Today') {
      rangeStart = todayStart;
      rangeEnd = todayEnd;
      prevStart = todayStart - 86400000;
      prevEnd = todayStart - 1;
    } else if (localPeriod === 'Yesterday') {
      rangeStart = todayStart - 86400000;
      rangeEnd = todayStart - 1;
      prevStart = todayStart - 2 * 86400000;
      prevEnd = rangeStart - 1;
    } else if (localPeriod === 'MTD' || localPeriod === 'This Month') {
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
      prevEnd = rangeStart - 1;
    } else if (localPeriod === 'Last Month') {
      rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
      rangeEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();
      prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1).getTime();
      prevEnd = rangeStart - 1;
    } else if (localPeriod === 'This Quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      rangeStart = new Date(now.getFullYear(), qMonth, 1).getTime();
      prevStart = new Date(now.getFullYear(), qMonth - 3, 1).getTime();
      prevEnd = rangeStart - 1;
    } else if (localPeriod === 'Last Quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      rangeStart = new Date(now.getFullYear(), qMonth - 3, 1).getTime();
      rangeEnd = new Date(now.getFullYear(), qMonth, 0, 23, 59, 59, 999).getTime();
      prevStart = new Date(now.getFullYear(), qMonth - 6, 1).getTime();
      prevEnd = rangeStart - 1;
    } else if (localPeriod === 'This Year') {
      const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      rangeStart = new Date(fyYear, 3, 1).getTime();
      prevStart = new Date(fyYear - 1, 3, 1).getTime();
      prevEnd = rangeStart - 1;
    } else if (localPeriod === 'Last Year') {
      const fyYear = (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1) - 1;
      rangeStart = new Date(fyYear, 3, 1).getTime();
      rangeEnd = new Date(fyYear + 1, 2, 31, 23, 59, 59, 999).getTime();
      prevStart = new Date(fyYear - 1, 3, 1).getTime();
      prevEnd = rangeStart - 1;
    } else if (localPeriod === 'Custom') {
      const f = Date.parse(fromDate);
      const t = Date.parse(toDate);
      rangeStart = Number.isFinite(f) ? f : todayStart;
      rangeEnd = Number.isFinite(t) ? t + 86400000 - 1 : todayEnd;
      const span = Math.max(86400000, rangeEnd - rangeStart);
      prevStart = rangeStart - span;
      prevEnd = rangeStart - 1;
    }

    const inRange = (rec, start, end) => {
      const ms = parseDateMs(rec?.date || rec?.invoiceDate || rec?.createdAt || rec?.created_at);
      if (!Number.isFinite(ms)) return false;
      return ms >= start && ms <= end;
    };

    const validInvoices = (allInvList || []).filter((inv) => {
      if (!inv || inv.cancelled) return false;
      const st = String(inv.status || '').toLowerCase();
      if (st.includes('cancel') || st === 'draft') return false;
      const code = String(inv.taxInvoiceNo || inv.invNo || inv.invoiceNo || inv.code || inv.id || '').trim();
      return Boolean(code && !/^PI[-/]/i.test(code) && !/^INV-(POST|STAGING|USER|MOCK)/i.test(code));
    });

    const curInvs = validInvoices.filter((i) => inRange(i, rangeStart, rangeEnd));
    const prevInvs = validInvoices.filter((i) => inRange(i, prevStart, prevEnd));

    const validPos = (allPoList || []).filter((p) => p && !p.cancelled && !String(p.status || '').toLowerCase().includes('cancel'));
    const curPos = validPos.filter((p) => inRange(p, rangeStart, rangeEnd));
    const prevPos = validPos.filter((p) => inRange(p, prevStart, prevEnd));

    const salesRevenue = curInvs.reduce((s, i) => s + getNetTaxInvoiceVal(i), 0);
    const prevRevenue = prevInvs.reduce((s, i) => s + getNetTaxInvoiceVal(i), 0);

    // Expense categorization from Purchase Orders
    const catTotals = {
      'Cost of Goods Sold': 0,
      'Factory & Machinery': 0,
      'Office & Administrative': 0,
      'Sales & Marketing': 0,
      'Employee': 0,
      'Finance Costs': 0,
      'Statutory & Other': 0
    };

    curPos.forEach((po) => {
      const amt = parseAmount(po.subTotal ?? po.subtotal ?? po.taxableAmount ?? po.grandTotal ?? po.totalAmount ?? po.amount);
      const txt = String(po.category || po.expenseCategory || po.department || po.notes || po.vendorName || '').toLowerCase();
      if (txt.includes('machin') || txt.includes('factory') || txt.includes('tool') || txt.includes('maint')) {
        catTotals['Factory & Machinery'] += amt;
      } else if (txt.includes('office') || txt.includes('admin') || txt.includes('rent') || txt.includes('station')) {
        catTotals['Office & Administrative'] += amt;
      } else if (txt.includes('market') || txt.includes('sales') || txt.includes('advert')) {
        catTotals['Sales & Marketing'] += amt;
      } else if (txt.includes('salary') || txt.includes('employ') || txt.includes('staff') || txt.includes('hr')) {
        catTotals['Employee'] += amt;
      } else if (txt.includes('bank') || txt.includes('interest') || txt.includes('finance')) {
        catTotals['Finance Costs'] += amt;
      } else if (txt.includes('tax') || txt.includes('gst') || txt.includes('statut') || txt.includes('fee')) {
        catTotals['Statutory & Other'] += amt;
      } else {
        catTotals['Cost of Goods Sold'] += amt;
      }
    });

    const cogs = catTotals['Cost of Goods Sold'];
    const operatingExpenses =
      catTotals['Factory & Machinery'] +
      catTotals['Office & Administrative'] +
      catTotals['Sales & Marketing'] +
      catTotals['Employee'] +
      catTotals['Statutory & Other'];
    const financeCosts = catTotals['Finance Costs'];
    const totalExpenses = cogs + operatingExpenses + financeCosts;

    const grossProfit = salesRevenue - cogs;
    const grossProfitPct = salesRevenue > 0 ? (grossProfit / salesRevenue) * 100 : 0;
    const netProfitBeforeTax = grossProfit - operatingExpenses - financeCosts;

    const prevCogs = prevPos.reduce((s, p) => s + parseAmount(p.subTotal ?? p.subtotal ?? p.grandTotal ?? p.totalAmount ?? p.amount), 0);
    const prevGrossProfit = prevRevenue - prevCogs;

    const deltaPct = (cur, prev) => {
      if (prev <= 0) return null;
      return (((cur - prev) / prev) * 100).toFixed(1);
    };

    const collectionsTotal = (allPaymentsList || [])
      .filter((p) => inRange(p, rangeStart, rangeEnd))
      .reduce((s, p) => s + parseAmount(p.amount ?? p.paidAmount ?? p.receivedAmount), 0);
    const poPaidTotal = curPos
      .filter((p) => p.paid || String(p.status || '').toLowerCase().includes('paid'))
      .reduce((s, p) => s + parseAmount(p.grandTotal ?? p.totalAmount ?? p.amount), 0);
    const cashBankBalance = collectionsTotal - poPaidTotal;

    const outstandingPayment = validInvoices.reduce((s, inv) => {
      const total = parseAmount(inv.grandTotal ?? inv.totalAmount ?? inv.invoiceAmount ?? inv.amount);
      const paid = parseAmount(inv.paidAmount ?? inv.amountPaid ?? inv.receivedAmount);
      return s + Math.max(0, total - paid);
    }, 0);

    const expenseRows = Object.entries(catTotals).map(([category, amount], idx) => ({
      category,
      amount,
      pct: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      color: EXPENSE_COLORS[idx % EXPENSE_COLORS.length]
    }));

    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyLabel = `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`;

    return {
      fyLabel,
      salesRevenue,
      revDelta: deltaPct(salesRevenue, prevRevenue),
      cogs,
      grossProfit,
      gpDelta: deltaPct(grossProfit, prevGrossProfit),
      grossProfitPct,
      operatingExpenses,
      financeCosts,
      netProfitBeforeTax,
      totalExpenses,
      cashBankBalance,
      outstandingPayment,
      expenseRows,
      curInvKeys: curInvs.map((inv) => inv.taxInvoiceNo || inv.invNo || inv.invoiceNo || inv.code || inv.id),
      unpaidInvKeys: validInvoices.filter((inv) => {
        const total = parseAmount(inv.grandTotal ?? inv.totalAmount ?? inv.invoiceAmount ?? inv.amount);
        const paid = parseAmount(inv.paidAmount ?? inv.amountPaid ?? inv.receivedAmount);
        return (total - paid) > 0;
      }).map((inv) => inv.taxInvoiceNo || inv.invNo || inv.invoiceNo || inv.code || inv.id)
    };
  }, [allInvList, allPoList, allPaymentsList, localPeriod, fromDate, toDate]);

  const drillToInvoices = (label, keys) => triggerCeoDrilldown({
    storageKey: 'controlroom_inv_initial_date_filter',
    eventName: 'controlroom_inv_filter_date',
    targetKeys: keys,
    periodLabel: label,
    sourceLabel: 'Accounts & Finance',
    navigateTab: 'Invoice Management',
    onNavigateTab
  });

  const kpis = [
    {
      title: 'TOTAL REVENUE',
      value: formatCompactINR(analytics.salesRevenue),
      valColor: '#0F172A',
      trend: analytics.revDelta !== null ? `${Number(analytics.revDelta) >= 0 ? '+' : ''}${analytics.revDelta}%` : undefined,
      trendUp: Number(analytics.revDelta || 0) >= 0,
      bottomPrefix: 'Selected period',
      bottomHighlight: 'vs previous',
      onClick: () => drillToInvoices(`Revenue (${localPeriod})`, analytics.curInvKeys)
    },
    {
      title: 'GROSS PROFIT',
      value: formatCompactINR(analytics.grossProfit),
      valColor: analytics.grossProfit >= 0 ? '#059669' : '#DC2626',
      trend: analytics.gpDelta !== null ? `${Number(analytics.gpDelta) >= 0 ? '+' : ''}${analytics.gpDelta}%` : undefined,
      trendUp: Number(analytics.gpDelta || 0) >= 0,
      bottomPrefix: 'Selected period',
      bottomHighlight: 'vs previous',
      onClick: () => drillToInvoices(`Gross Profit (${localPeriod})`, analytics.curInvKeys)
    },
    {
      title: 'GROSS PROFIT %',
      value: `${analytics.grossProfitPct.toFixed(1)}%`,
      valColor: analytics.grossProfitPct >= 0 ? '#059669' : '#DC2626',
      hideTrendIcon: true,
      bottomPrefix: 'Selected period',
      bottomHighlight: 'margin',
      onClick: () => drillToInvoices(`Gross Margin (${localPeriod})`, analytics.curInvKeys)
    },
    {
      title: 'NET PROFIT BEFORE TAX',
      value: formatCompactINR(analytics.netProfitBeforeTax),
      valColor: analytics.netProfitBeforeTax >= 0 ? '#0E7490' : '#DC2626',
      hideTrendIcon: true,
      bottomPrefix: 'Selected period',
      bottomHighlight: 'net',
      onClick: () => drillToInvoices(`Net Profit (${localPeriod})`, analytics.curInvKeys)
    },
    {
      title: 'CASH & BANK BALANCE',
      value: formatCompactINR(analytics.cashBankBalance),
      valColor: '#0F172A',
      hideTrendIcon: true,
      bottomPrefix: 'Net collections vs payouts',
      bottomHighlight: '',
      onClick: () => onNavigateTab && onNavigateTab('Payments')
    },
    {
      title: 'OUTSTANDING PAYMENT',
      value: formatCompactINR(analytics.outstandingPayment),
      valColor: analytics.outstandingPayment > 0 ? '#B45309' : '#059669',
      hideTrendIcon: true,
      bottomPrefix: 'Open receivables',
      bottomHighlight: '',
      onClick: () => drillToInvoices('Outstanding Receivables', analytics.unpaidInvKeys)
    }
  ];

  // SVG Donut math
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let cumulativePct = 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <style>{`
        .ceo-acc-three-col {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          align-items: stretch;
        }
        @media (max-width: 1120px) {
          .ceo-acc-three-col {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>

      {/* Period & Date Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
        padding: '10px 14px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
          {PERIOD_PILLS.map((p) => {
            const active = localPeriod === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setLocalPeriod(p)}
                style={{
                  padding: '5px 11px',
                  borderRadius: '999px',
                  border: active ? '1px solid #0E7490' : '1px solid #E2E8F0',
                  backgroundColor: active ? '#0E7490' : '#F8FAFC',
                  color: active ? '#FFFFFF' : '#475569',
                  fontSize: '11px',
                  fontWeight: active ? '700' : '600',
                  cursor: 'pointer'
                }}
              >
                {p}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '11.5px' }}>
          {localPeriod === 'Custom' && (
            <>
              <label style={{ color: '#64748B', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                From <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ border: '1px solid #E2E8F0', borderRadius: '6px', padding: '3px 6px', fontSize: '11px' }} />
              </label>
              <label style={{ color: '#64748B', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                To <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ border: '1px solid #E2E8F0', borderRadius: '6px', padding: '3px 6px', fontSize: '11px' }} />
              </label>
            </>
          )}
          <span style={{ padding: '4px 10px', borderRadius: '999px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', fontWeight: '700', color: '#0F172A' }}>
            {analytics.fyLabel}
          </span>
        </div>
      </div>

      {/* Top 6 KPI Cards */}
      <CeoKpiGrid kpis={kpis} />

      {/* 3-Column Financial Cards */}
      <div className="ceo-acc-three-col">
        {/* 1. Profit & Loss Summary */}
        <BusinzSectionCard title="Profit & Loss Summary">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '10.5px', textAlign: 'left' }}>
                <th style={{ padding: '9px 16px' }}>PARTICULARS</th>
                <th style={{ padding: '9px 16px', textAlign: 'right' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Sales Revenue', val: formatExactINR(analytics.salesRevenue), color: '#059669' },
                { label: 'Cost of Goods Sold', val: formatExactINR(analytics.cogs), color: '#DC2626' },
                { label: 'Gross Profit', val: formatExactINR(analytics.grossProfit), color: '#059669' },
                { label: 'Operating Expenses', val: formatExactINR(analytics.operatingExpenses), color: '#DC2626' },
                { label: 'Finance Costs', val: formatExactINR(analytics.financeCosts), color: '#DC2626' },
                { label: 'Net Profit Before Tax', val: formatExactINR(analytics.netProfitBeforeTax), color: '#0E7490', highlight: true },
                { label: 'Gross Profit %', val: `${analytics.grossProfitPct.toFixed(1)}%`, color: '#059669' }
              ].map((r) => (
                <tr key={r.label} style={{ backgroundColor: r.highlight ? '#ECFEFF' : '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px 16px', fontWeight: r.highlight ? '800' : '600', color: '#0F172A' }}>{r.label}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '700', color: r.color }}>{r.val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </BusinzSectionCard>

        {/* 2. Expense Categories */}
        <BusinzSectionCard title="Expense Categories">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '10.5px', textAlign: 'left' }}>
                <th style={{ padding: '9px 16px' }}>CATEGORY</th>
                <th style={{ padding: '9px 16px', textAlign: 'right' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {analytics.expenseRows.map((row) => (
                <tr key={row.category} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '9px 16px', fontWeight: '600', color: '#0F172A' }}>{row.category}</td>
                  <td style={{ padding: '9px 16px', textAlign: 'right', fontWeight: '700', color: '#334155' }}>{formatExactINR(row.amount)}</td>
                </tr>
              ))}
              <tr style={{ backgroundColor: '#ECFEFF' }}>
                <td style={{ padding: '10px 16px', fontWeight: '800', color: '#0F172A' }}>Total Expenses</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '800', color: '#0E7490' }}>{formatExactINR(analytics.totalExpenses)}</td>
              </tr>
            </tbody>
          </table>
        </BusinzSectionCard>

        {/* 3. Expense Breakup */}
        <BusinzSectionCard title="Expense Breakup">
          <div style={{ padding: '18px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '16px', flexWrap: 'wrap', flex: 1 }}>
            <div style={{ position: 'relative', width: '148px', height: '148px', flexShrink: 0 }}>
              <svg viewBox="0 0 148 148" width="148" height="148" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="74" cy="74" r={radius} fill="none" stroke="#F1F5F9" strokeWidth="18" />
                {analytics.totalExpenses > 0 && analytics.expenseRows.map((row) => {
                  if (row.pct <= 0) return null;
                  const dash = (row.pct / 100) * circumference;
                  const offset = -(cumulativePct / 100) * circumference;
                  cumulativePct += row.pct;
                  return (
                    <circle
                      key={row.category}
                      cx="74"
                      cy="74"
                      r={radius}
                      fill="none"
                      stroke={row.color}
                      strokeWidth="18"
                      strokeDasharray={`${dash} ${circumference}`}
                      strokeDashoffset={offset}
                    />
                  );
                })}
              </svg>
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', textAlign: 'center', pointerEvents: 'none'
              }}>
                <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>{formatCompactINR(analytics.totalExpenses)}</span>
                <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}>Total expenses</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', flex: '1 1 160px', minWidth: '150px' }}>
              {analytics.expenseRows.map((row) => (
                <div key={row.category} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '11.5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: row.color, flexShrink: 0 }} />
                    <span style={{ color: '#334155', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.category}</span>
                  </div>
                  <strong style={{ color: '#0F172A', whiteSpace: 'nowrap' }}>
                    {row.pct > 0 && row.pct < 0.1 ? '<0.1%' : `${row.pct.toFixed(1)}%`}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </BusinzSectionCard>
      </div>

      {/* Quick Links Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
        padding: '10px 14px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '12px'
      }}>
        <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748B', letterSpacing: '0.4px', marginRight: '4px' }}>QUICK LINKS</span>
        {[
          { label: 'P&L Statement', tab: 'Accounts & Finance' },
          { label: 'Debtors Details', tab: 'Invoice Management' },
          { label: 'Creditors Details', tab: 'Purchase Orders' },
          { label: 'Bank Book', tab: 'Payments' },
          { label: 'Tax Dashboard', tab: 'Invoice Management' }
        ].map((link) => (
          <button
            key={link.label}
            type="button"
            onClick={() => onNavigateTab && onNavigateTab(link.tab)}
            style={{
              padding: '5px 12px',
              borderRadius: '999px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#F8FAFC',
              color: '#0F172A',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            {link.label}
          </button>
        ))}
      </div>
    </div>
  );
}
