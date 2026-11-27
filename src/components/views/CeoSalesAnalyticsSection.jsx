import React, { useMemo, useState } from 'react';
import CeoKpiGrid from '../ceoDashboard/CeoKpiGrid';

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

const formatLakhs = (val) => {
  const n = Number(val) || 0;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  return `₹${(n / 100000).toFixed(1)} L`;
};

const formatLakhNum = (val) => ((Number(val) || 0) / 100000).toFixed(1);

const formatShortDate = (ms) => {
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const getNetSalesValue = (rec) => {
  const exGst = parseAmount(rec?.subTotal ?? rec?.subtotal ?? rec?.taxableValue ?? rec?.taxableAmount ?? rec?.baseAmount);
  if (exGst > 0) return exGst;
  const gross = parseAmount(rec?.grandTotal ?? rec?.grand_total ?? rec?.totalAmount ?? rec?.invoiceAmount ?? rec?.amount ?? rec?.value ?? rec?.estimated_value);
  return gross > 0 ? gross / 1.18 : 0;
};

const getRepName = (r) =>
  String(
    r?.assigned_to_name ||
    r?.assignedToName ||
    r?.salesperson ||
    r?.salesPerson ||
    r?.salesRep ||
    r?.createdByName ||
    r?.created_by_name ||
    r?.ownerName ||
    'Unassigned'
  ).trim();

const getRegionName = (r, custMap) => {
  const direct = r?.state || r?.deliveryState || r?.billingState || r?.region || r?.location || r?.city;
  if (direct && String(direct).trim()) return String(direct).trim();
  const cKey = String(r?.companyName || r?.customerName || r?.customer || '').trim().toLowerCase();
  const c = custMap.get(cKey);
  if (c) return String(c.state || c.city || c.location || 'Other States').trim();
  return 'Other States';
};

const getProductCategory = (r) => {
  const raw = String(
    r?.productCategory ||
    r?.product_requirement ||
    r?.category ||
    (Array.isArray(r?.items) && r.items[0]?.category) ||
    (Array.isArray(r?.items) && r.items[0]?.description) ||
    r?.subject ||
    ''
  ).toLowerCase();
  if (raw.includes('alum')) return 'Aluminium Profiles';
  if (raw.includes('bos') || raw.includes('kit')) return 'BOS Kits';
  if (raw.includes('walkway') || raw.includes('handrail')) return 'Walkway / Handrail';
  if (raw.includes('accessor') || raw.includes('clamp') || raw.includes('bolt')) return 'Accessories';
  if (raw.includes('solar') || raw.includes('struct') || raw.includes('purlin') || raw.includes('hdg') || raw.includes('galvalume')) return 'Solar Structures';
  return 'Solar Structures';
};

const BusinzSectionCard = ({ title, subtitle, rightNode, bodyPadding = '14px 16px', children }) => (
  <div style={{
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
      padding: '11px 16px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #EAEFEF'
    }}>
      <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.2px' }}>{title}</h3>
      {rightNode || (subtitle && (
        <span style={{
          fontSize: '11px', fontWeight: '700', color: '#64748B',
          backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0',
          padding: '2px 10px', borderRadius: '999px'
        }}>
          {subtitle}
        </span>
      ))}
    </div>
    <div style={{ padding: bodyPadding }}>
      {children}
    </div>
  </div>
);

const selectStyle = {
  padding: '6px 10px',
  borderRadius: '8px',
  border: '1px solid #E2E8F0',
  backgroundColor: '#FFFFFF',
  color: '#0F172A',
  fontSize: '12px',
  fontWeight: '600',
  outline: 'none',
  cursor: 'pointer'
};

const thStyle = {
  padding: '8px 10px',
  fontSize: '11px',
  fontWeight: '700',
  color: '#64748B',
  borderBottom: '1px solid #E2E8F0',
  backgroundColor: '#F8FAFC',
  whiteSpace: 'nowrap'
};

const tdStyle = {
  padding: '9px 10px',
  fontSize: '12px',
  borderBottom: '1px solid #F1F5F9',
  verticalAlign: 'middle'
};

export default function CeoSalesAnalyticsSection({
  leadsList = [],
  allLeadsList = [],
  quotesList = [],
  allQuotesList = [],
  piList = [],
  invList = [],
  allInvList = [],
  paymentsList = [],
  customersList = [],
  companyTarget = 18000000,
  repTargets = {},
  selectedPeriod = 'This Month',
  onNavigateTab
}) {
  const [selectedExec, setSelectedExec] = useState('All');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState('All');

  const analytics = useMemo(() => {
    const now = Date.now();
    const nowDate = new Date(now);
    const currentMonthLabel = nowDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0).getDate();
    const remainingDays = Math.max(1, daysInMonth - nowDate.getDate());
    const remainingWorkingDays = Math.max(1, Math.round(remainingDays * (5 / 7)));

    const custMap = new Map();
    (customersList || []).forEach((c) => {
      const k = String(c?.company_name || c?.companyName || c?.customer_name || c?.name || '').trim().toLowerCase();
      if (k) custMap.set(k, c);
    });

    const srcLeads = (leadsList && leadsList.length > 0) ? leadsList : (allLeadsList || []);
    const srcQuotes = (quotesList && quotesList.length > 0) ? quotesList : (allQuotesList || []);
    const srcInvs = (invList && invList.length > 0) ? invList : [];
    const trendInvs = (allInvList && allInvList.length > 0) ? allInvList : srcInvs;

    const execSet = new Set();
    const regionSet = new Set();
    const productSet = new Set(['Solar Structures', 'Aluminium Profiles', 'BOS Kits', 'Walkway / Handrail', 'Accessories']);

    [...srcLeads, ...srcQuotes, ...piList, ...srcInvs].forEach((r) => {
      const rep = getRepName(r);
      if (rep && rep !== 'Unassigned') execSet.add(rep);
      const reg = getRegionName(r, custMap);
      if (reg) regionSet.add(reg);
      productSet.add(getProductCategory(r));
    });

    const matchesFilters = (r) => {
      if (selectedExec !== 'All' && getRepName(r).toLowerCase() !== selectedExec.toLowerCase()) return false;
      if (selectedRegion !== 'All' && getRegionName(r, custMap).toLowerCase() !== selectedRegion.toLowerCase()) return false;
      if (selectedProduct !== 'All' && getProductCategory(r) !== selectedProduct) return false;
      return true;
    };

    const fLeads = srcLeads.filter(matchesFilters);
    const fAllLeads = (allLeadsList && allLeadsList.length > 0 ? allLeadsList : srcLeads).filter(matchesFilters);
    const fQuotes = srcQuotes.filter(matchesFilters);
    const fPis = (piList || []).filter(matchesFilters);
    const fInvs = srcInvs.filter(matchesFilters);
    const fTrendInvs = trendInvs.filter(matchesFilters);
    const fPayments = (paymentsList || []).filter(matchesFilters);

    const activeTarget = selectedExec !== 'All' && repTargets?.[selectedExec]
      ? Number(repTargets[selectedExec])
      : (Number(companyTarget) || 18000000);

    const achievedValue = fInvs.reduce((s, r) => s + getNetSalesValue(r), 0);
    const achievedPct = activeTarget > 0 ? Math.round((achievedValue / activeTarget) * 100) : 0;
    const balanceValue = Math.max(0, activeTarget - achievedValue);
    const dailyRequired = Math.round(balanceValue / remainingWorkingDays);

    const dayOfMonth = Math.max(1, nowDate.getDate());
    const runRateForecast = Math.round((achievedValue / dayOfMonth) * daysInMonth);
    const forecastValue = achievedValue > 0 ? Math.max(achievedValue, runRateForecast) : 0;
    const forecastPct = activeTarget > 0 ? Math.round((forecastValue / activeTarget) * 100) : 0;
    const forecastDelta = forecastValue - activeTarget;

    const openActions = fAllLeads
      .filter((l) => {
        const st = String(l.pipeline_stage || l.status || '').toLowerCase();
        return !['won', 'lost', 'converted', 'dropped', 'cancelled'].includes(st);
      })
      .map((l) => {
        const nextFollowMs = parseDateMs(l.next_followup_at || l.nextFollowupAt);
        const lastActMs = parseDateMs(l.last_activity_at || l.updated_at || l.created_at);
        const stageMs = parseDateMs(l.stage_changed_at || l.created_at);
        const expCloseMs = parseDateMs(l.expected_close_date || l.expectedCloseDate || l.next_followup_at);
        const daysInStage = Number.isFinite(stageMs) ? Math.max(0, Math.floor((now - stageMs) / 86400000)) : 0;
        const daysSinceContact = Number.isFinite(lastActMs) ? Math.max(0, Math.floor((now - lastActMs) / 86400000)) : daysInStage;
        const isOverdueFollow = Number.isFinite(nextFollowMs) && nextFollowMs < now;
        const val = parseAmount(l.estimated_value || l.value);
        return {
          id: l.id,
          customer: l.company_name || l.contact_person || 'Customer',
          offerValue: val,
          stage: l.pipeline_stage || l.status || 'New',
          nextAction: l.next_action || (Number.isFinite(nextFollowMs) ? `Follow-up · ${formatShortDate(nextFollowMs)}` : 'Schedule follow-up'),
          isOverdueFollow,
          expectedClose: formatShortDate(expCloseMs),
          stageContact: `${daysInStage}d / ${daysSinceContact}d`
        };
      })
      .sort((a, b) => (b.isOverdueFollow - a.isOverdueFollow) || (b.offerValue - a.offerValue))
      .slice(0, 5);

    const overdueLeads = fAllLeads.filter((l) => {
      const st = String(l.pipeline_stage || l.status || '').toLowerCase();
      if (['won', 'lost', 'converted', 'dropped'].includes(st)) return false;
      const ms = parseDateMs(l.next_followup_at || l.nextFollowupAt);
      return Number.isFinite(ms) && ms < now;
    });
    const inactiveLeads = fAllLeads.filter((l) => {
      const st = String(l.pipeline_stage || l.status || '').toLowerCase();
      if (['won', 'lost', 'converted', 'dropped'].includes(st)) return false;
      const ms = parseDateMs(l.last_activity_at || l.updated_at || l.created_at);
      return Number.isFinite(ms) && (now - ms) > 15 * 86400000;
    });
    const inactiveVal = inactiveLeads.reduce((s, l) => s + parseAmount(l.estimated_value || l.value), 0);

    const sevenDaysMs = now + 7 * 86400000;
    const expiringQuotes = fQuotes.filter((q) => {
      const st = String(q.status || '').toLowerCase();
      if (st.includes('convert') || st.includes('won') || st.includes('cancel') || st.includes('reject')) return false;
      const expMs = parseDateMs(q.validUntil || q.expiryDate || q.valid_until);
      return Number.isFinite(expMs) && expMs >= now && expMs <= sevenDaysMs;
    });
    const expiringQuotesVal = expiringQuotes.reduce((s, q) => s + getNetSalesValue(q), 0);

    const offersCount = fQuotes.length;
    const offersVal = fQuotes.reduce((s, q) => s + getNetSalesValue(q), 0);
    const qualifiedLeads = fLeads.filter((l) => ['qualified', 'quotation sent', 'negotiation', 'won', 'opportunity', 'proposal sent', 'converted'].includes(String(l.pipeline_stage || l.status || '').toLowerCase()));
    const qualifiedCount = qualifiedLeads.length;
    const qualifiedVal = qualifiedLeads.reduce((s, l) => s + parseAmount(l.estimated_value || l.value), 0);
    const piCount = fPis.length;
    const piVal = fPis.reduce((s, p) => s + getNetSalesValue(p), 0);
    const invCount = fInvs.length;
    const invVal = achievedValue;
    const countConversion = offersCount > 0 ? ((invCount / offersCount) * 100).toFixed(1) : '0.0';
    const valueConversion = offersVal > 0 ? ((invVal / offersVal) * 100).toFixed(1) : '0.0';
    const avgInvoiceVal = invCount > 0 ? invVal / invCount : 0;

    const trendMonths = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
      trendMonths.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        value: 0
      });
    }
    const trendMap = new Map(trendMonths.map((m) => [m.key, m]));
    fTrendInvs.forEach((inv) => {
      const ms = parseDateMs(inv.date || inv.invoiceDate || inv.createdAt || inv.created_at);
      if (!Number.isFinite(ms)) return;
      const d = new Date(ms);
      const bucket = trendMap.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (bucket) bucket.value += getNetSalesValue(inv);
    });
    const maxTrendVal = Math.max(1, ...trendMonths.map((m) => m.value));

    const prodBuckets = new Map();
    ['Solar Structures', 'Aluminium Profiles', 'BOS Kits', 'Walkway / Handrail', 'Accessories'].forEach((p) => {
      prodBuckets.set(p, { product: p, actual: 0, target: 0 });
    });
    fInvs.forEach((inv) => {
      if (Array.isArray(inv.items) && inv.items.length > 0) {
        const itemTotals = inv.items.map((it) => {
          const lineAmt = parseAmount(it?.taxableAmount ?? it?.baseAmount ?? it?.amount ?? (parseAmount(it?.qty || it?.quantity || 0) * parseAmount(it?.rate || it?.unitPrice || 0)));
          return { cat: getProductCategory({ ...inv, items: [it], category: it?.category, subject: it?.description || it?.name }), amt: lineAmt };
        });
        const sumItemAmt = itemTotals.reduce((s, x) => s + x.amt, 0);
        if (sumItemAmt > 0) {
          const invNet = getNetSalesValue(inv);
          const scale = invNet > 0 ? invNet / sumItemAmt : 1;
          itemTotals.forEach(({ cat, amt }) => {
            const b = prodBuckets.get(cat) || { product: cat, actual: 0, target: 0 };
            b.actual += amt * scale;
            prodBuckets.set(cat, b);
          });
          return;
        }
      }
      const cat = getProductCategory(inv);
      const b = prodBuckets.get(cat) || { product: cat, actual: 0, target: 0 };
      b.actual += getNetSalesValue(inv);
      prodBuckets.set(cat, b);
    });
    const prodShares = { 'Solar Structures': 0.46, 'Aluminium Profiles': 0.30, 'BOS Kits': 0.14, 'Walkway / Handrail': 0.06, 'Accessories': 0.04 };
    const productRows = Array.from(prodBuckets.values()).map((row) => {
      const tgt = Math.round(activeTarget * (prodShares[row.product] || 0.1));
      const ach = tgt > 0 ? ((row.actual / tgt) * 100).toFixed(1) : '0.0';
      return { ...row, target: tgt, achievement: Number(ach) };
    });

    const regMap = new Map();
    fInvs.forEach((inv) => {
      const reg = getRegionName(inv, custMap);
      const cust = String(inv.companyName || inv.customerName || inv.customer || 'Customer').trim().toLowerCase();
      const entry = regMap.get(reg) || { region: reg, customers: new Set(), invoices: 0, sales: 0 };
      entry.customers.add(cust);
      entry.invoices += 1;
      entry.sales += getNetSalesValue(inv);
      regMap.set(reg, entry);
    });
    const regionRows = Array.from(regMap.values())
      .map((r) => ({ region: r.region, customers: r.customers.size, invoices: r.invoices, sales: r.sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 6);
    const totalRegCustomers = new Set(fInvs.map((i) => String(i.companyName || i.customerName || i.customer || '').trim().toLowerCase()).filter(Boolean)).size;

    const custSalesMap = new Map();
    fInvs.forEach((inv) => {
      const name = String(inv.companyName || inv.customerName || inv.customer || 'Customer').trim();
      const entry = custSalesMap.get(name) || { customer: name, sales: 0, invoices: 0 };
      entry.sales += getNetSalesValue(inv);
      entry.invoices += 1;
      custSalesMap.set(name, entry);
    });
    const topCustomers = Array.from(custSalesMap.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5)
      .map((c, idx) => ({
        rank: String(idx + 1).padStart(2, '0'),
        ...c,
        share: achievedValue > 0 ? ((c.sales / achievedValue) * 100).toFixed(1) : '0.0'
      }));

    const collectionsReceived = fPayments.reduce((s, p) => s + parseAmount(p.amount || p.paidAmount || p.receivedAmount), 0);
    const grossInvVal = fInvs.reduce((s, i) => s + parseAmount(i.grandTotal || i.totalAmount || i.amount), 0);
    const invoiceValueRatio = grossInvVal > 0 ? ((collectionsReceived / grossInvVal) * 100).toFixed(1) : '0.0';

    const creditRowsMap = new Map();
    fInvs.forEach((inv) => {
      const name = String(inv.companyName || inv.customerName || inv.customer || 'Customer').trim();
      const total = parseAmount(inv.grandTotal || inv.totalAmount || inv.amount);
      const paid = parseAmount(inv.paidAmount || inv.amountPaid || inv.receivedAmount);
      const outstanding = Math.max(0, total - paid);
      if (outstanding <= 0 && !inv.creditDays) return;
      const dueMs = parseDateMs(inv.dueDate || inv.paymentDueDate || inv.date);
      const isOverdueInv = outstanding > 0 && Number.isFinite(dueMs) && (now - dueMs) > Number(inv.creditDays || 30) * 86400000;
      const custRec = custMap.get(name.toLowerCase());
      const limit = parseAmount(custRec?.creditLimit || custRec?.credit_limit || 500000);
      const existing = creditRowsMap.get(name) || { customer: name, creditLimit: limit, outstanding: 0, overdue: 0, dueToday: false };
      existing.outstanding += outstanding;
      if (isOverdueInv) existing.overdue += outstanding;
      if (Number.isFinite(dueMs) && Math.abs(dueMs - now) < 86400000) existing.dueToday = true;
      creditRowsMap.set(name, existing);
    });
    const creditRows = Array.from(creditRowsMap.values())
      .map((r) => ({
        ...r,
        utilisation: r.creditLimit > 0 ? ((r.outstanding / r.creditLimit) * 100).toFixed(1) : '0.0',
        status: r.overdue > 0 ? 'Overdue' : r.dueToday ? 'Due today' : 'No overdue'
      }))
      .sort((a, b) => b.overdue - a.overdue || b.outstanding - a.outstanding)
      .slice(0, 5);
    const totalOutstanding = Array.from(creditRowsMap.values()).reduce((s, r) => s + r.outstanding, 0);
    const totalOverdue = Array.from(creditRowsMap.values()).reduce((s, r) => s + r.overdue, 0);
    const dueThisWeek = Array.from(creditRowsMap.values()).filter((r) => r.dueToday).reduce((s, r) => s + r.outstanding, 0);

    const getPeriodStartMs = () => {
      const todayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
      if (selectedPeriod === 'Today') return todayStart;
      if (selectedPeriod === 'This Week') {
        const w = new Date(todayStart);
        const day = w.getDay();
        w.setDate(w.getDate() - (day === 0 ? 6 : day - 1));
        return w.getTime();
      }
      if (selectedPeriod === 'Q2 FY27') return new Date(2026, 6, 1).getTime();
      if (selectedPeriod === 'YTD') return new Date(nowDate.getFullYear(), 0, 1).getTime();
      if (selectedPeriod === 'All Time') return 0;
      return new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime();
    };
    const periodStartMs = getPeriodStartMs();

    // First-ever Tax Invoice date per customer across all historical Tax Invoices
    const firstTaxInvoiceByCust = new Map();
    (allInvList || []).forEach((inv) => {
      const cname = String(inv.companyName || inv.customerName || inv.customer || '').trim().toLowerCase();
      const invMs = parseDateMs(inv.date || inv.invoiceDate || inv.createdAt || inv.created_at);
      if (!cname || !Number.isFinite(invMs)) return;
      const prev = firstTaxInvoiceByCust.get(cname);
      if (prev === undefined || invMs < prev) {
        firstTaxInvoiceByCust.set(cname, invMs);
      }
    });

    let newCustSales = 0;
    let existingCustSales = 0;
    const newCustSet = new Set();
    const existingCustSet = new Set();
    fInvs.forEach((inv) => {
      const name = String(inv.companyName || inv.customerName || inv.customer || '').trim().toLowerCase();
      if (!name) return;
      const firstInvMs = firstTaxInvoiceByCust.get(name);
      const val = getNetSalesValue(inv);
      // New customer = had zero Tax Invoices before this period (their first-ever Tax Invoice is in this period)
      if (!Number.isFinite(firstInvMs) || firstInvMs >= periodStartMs) {
        newCustSet.add(name);
        newCustSales += val;
      } else {
        existingCustSet.add(name);
        existingCustSales += val;
      }
    });

    const lostLeads = fLeads.filter((l) => ['lost', 'dropped', 'cancelled', 'rejected'].includes(String(l.pipeline_stage || l.status || '').toLowerCase()));
    const lostVal = lostLeads.reduce((s, l) => s + parseAmount(l.estimated_value || l.value), 0);
    const lostReasonsMap = new Map();
    lostLeads.forEach((l) => {
      const reason = String(l.lost_reason_label || l.lostReason || l.lost_remarks || 'Other').trim();
      lostReasonsMap.set(reason, (lostReasonsMap.get(reason) || 0) + 1);
    });
    const lostReasonBreakdown = Array.from(lostReasonsMap.entries()).slice(0, 4);

    return {
      currentMonthLabel,
      remainingWorkingDays,
      execOptions: Array.from(execSet).sort(),
      regionOptions: Array.from(regionSet).sort(),
      productOptions: Array.from(productSet),
      activeTarget,
      achievedValue,
      achievedPct,
      balanceValue,
      dailyRequired,
      forecastValue,
      forecastPct,
      forecastDelta,
      openActions,
      overdueLeads,
      inactiveLeads,
      inactiveVal,
      expiringQuotes,
      expiringQuotesVal,
      offersCount,
      offersVal,
      qualifiedCount,
      qualifiedVal,
      piCount,
      piVal,
      invCount,
      invVal,
      countConversion,
      valueConversion,
      avgInvoiceVal,
      trendMonths,
      maxTrendVal,
      productRows,
      regionRows,
      totalRegCustomers,
      topCustomers,
      collectionsReceived,
      invoiceValueRatio,
      totalOutstanding,
      totalOverdue,
      dueThisWeek,
      creditRows,
      newLeadsCount: fLeads.length,
      wonLeadsCount: fLeads.filter((l) => ['won', 'converted'].includes(String(l.pipeline_stage || l.status || '').toLowerCase())).length,
      newCustCount: newCustSet.size,
      existingCustCount: existingCustSet.size,
      newCustSales,
      existingCustSales,
      lostLeadsCount: lostLeads.length,
      lostVal,
      lostReasonBreakdown
    };
  }, [
    leadsList, allLeadsList, quotesList, allQuotesList, piList, invList, allInvList,
    paymentsList, customersList, companyTarget, repTargets, selectedExec, selectedRegion, selectedProduct, selectedPeriod
  ]);

  const kpiCards = [
    {
      title: 'MONTH TARGET',
      value: formatLakhs(analytics.activeTarget),
      valColor: '#0F172A',
      hideTrendIcon: true,
      bottomPrefix: analytics.currentMonthLabel,
      bottomHighlight: ''
    },
    {
      title: 'ACHIEVED / INVOICED',
      value: formatLakhs(analytics.achievedValue),
      valColor: '#059669',
      hideTrendIcon: true,
      bottomPrefix: `${analytics.achievedPct}% of `,
      bottomHighlight: 'monthly target',
      bottomHighlightColor: '#059669'
    },
    {
      title: 'BALANCE TO TARGET',
      value: formatLakhs(analytics.balanceValue),
      valColor: analytics.balanceValue > 0 ? '#B45309' : '#059669',
      hideTrendIcon: true,
      bottomPrefix: analytics.balanceValue > 0 ? `${formatLakhs(analytics.dailyRequired)} ` : 'Target ',
      bottomHighlight: analytics.balanceValue > 0 ? 'required daily' : 'achieved',
      bottomHighlightColor: analytics.balanceValue > 0 ? '#B45309' : '#059669'
    },
    {
      title: 'MONTH-END FORECAST',
      value: formatLakhs(analytics.forecastValue),
      valColor: '#0F172A',
      hideTrendIcon: true,
      bottomPrefix: `${analytics.forecastPct}% of target · `,
      bottomHighlight: `${analytics.forecastDelta >= 0 ? '+' : ''}${formatLakhs(Math.abs(analytics.forecastDelta))} ${analytics.forecastDelta >= 0 ? 'expected' : 'gap'}`,
      bottomHighlightColor: analytics.forecastDelta >= 0 ? '#059669' : '#B45309'
    }
  ];

  const barPct = Math.max(0, Math.min(100, analytics.achievedPct));
  const funnelSteps = [
    { label: 'Offers', count: analytics.offersCount, val: analytics.offersVal },
    { label: 'Qualified', count: analytics.qualifiedCount, val: analytics.qualifiedVal },
    { label: 'Proforma invoices', count: analytics.piCount, val: analytics.piVal },
    { label: 'Invoiced', count: analytics.invCount, val: analytics.invVal }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <style>{`
        .ceo-sales-main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.68fr) minmax(0, 1fr);
          gap: 14px;
          align-items: start;
        }
        .ceo-sales-sub-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.18fr);
          gap: 14px;
          align-items: stretch;
        }
        .ceo-sales-funnel-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
          gap: 8px;
          align-items: center;
        }
        .ceo-sales-credit-kpis {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
        }
        @media (max-width: 1140px) {
          .ceo-sales-main-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }
        @media (max-width: 780px) {
          .ceo-sales-sub-grid {
            grid-template-columns: minmax(0, 1fr);
          }
          .ceo-sales-funnel-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .ceo-sales-funnel-arrow {
            display: none !important;
          }
          .ceo-sales-credit-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>

      {/* Filter Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
        padding: '10px 16px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>Sales Dashboard</h2>
          <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '600' }}>Period: {selectedPeriod}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Sales executive
            <select value={selectedExec} onChange={(e) => setSelectedExec(e.target.value)} style={selectStyle}>
              <option value="All">All Executives</option>
              {analytics.execOptions.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
            </select>
          </label>
          <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Region
            <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} style={selectStyle}>
              <option value="All">All</option>
              {analytics.regionOptions.map((reg) => <option key={reg} value={reg}>{reg}</option>)}
            </select>
          </label>
          <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Product
            <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} style={selectStyle}>
              <option value="All">All</option>
              {analytics.productOptions.map((pr) => <option key={pr} value={pr}>{pr}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <CeoKpiGrid kpis={kpiCards} />

      {/* Target Achievement Progress Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px',
        padding: '10px 16px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px'
      }}>
        <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap' }}>Target achievement</span>
        <div style={{ flex: '1 1 260px', height: '9px', backgroundColor: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ width: `${barPct}%`, height: '100%', backgroundColor: '#059669', borderRadius: '999px', transition: 'width 0.3s ease' }} />
        </div>
        <span style={{ fontSize: '13px', fontWeight: '800', color: '#059669' }}>{analytics.achievedPct}%</span>
        <span style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap' }}>
          Assumes {analytics.remainingWorkingDays} working days remaining · Sales values exclude GST
        </span>
      </div>

      {/* Main Asymmetric 2-Column Layout (63% / 37%) */}
      <div className="ceo-sales-main-grid">
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
          {/* Today's Actions & Open Follow-ups */}
          <BusinzSectionCard
            title="Today's Actions & Open Follow-ups"
            bodyPadding="0"
            rightNode={
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('Smart Leads')}
                style={{ fontSize: '11px', fontWeight: '700', color: '#0E7490', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', padding: '3px 10px', borderRadius: '999px', cursor: 'pointer' }}
              >
                Open records
              </button>
            }
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: 'left', paddingLeft: '16px' }}>Customer</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Offer value</th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Stage</th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Next action / due</th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Expected close</th>
                    <th style={{ ...thStyle, textAlign: 'right', paddingRight: '16px' }}>Stage / contact</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.openActions.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>No open follow-ups for selected filters.</td></tr>
                  ) : analytics.openActions.map((row) => (
                    <tr key={row.id}>
                      <td style={{ ...tdStyle, paddingLeft: '16px', fontWeight: '700', color: '#0F172A' }}>{row.customer}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600', color: '#334155', whiteSpace: 'nowrap' }}>{row.offerValue > 0 ? formatLakhs(row.offerValue) : '—'}</td>
                      <td style={{ ...tdStyle, color: '#475569', whiteSpace: 'nowrap' }}>{row.stage}</td>
                      <td style={{ ...tdStyle, fontWeight: row.isOverdueFollow ? '700' : '500', color: row.isOverdueFollow ? '#DC2626' : '#334155' }}>{row.nextAction}</td>
                      <td style={{ ...tdStyle, color: '#475569', whiteSpace: 'nowrap' }}>{row.expectedClose}</td>
                      <td style={{ ...tdStyle, paddingRight: '16px', textAlign: 'right', color: '#64748B', fontWeight: '600', whiteSpace: 'nowrap' }}>{row.stageContact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '8px 16px', fontSize: '11px', color: '#64748B', backgroundColor: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
              Stage / contact shows days in current stage and days since last customer contact.
            </div>
          </BusinzSectionCard>

          {/* Sales Funnel */}
          <BusinzSectionCard title="Sales Funnel" subtitle={selectedPeriod}>
            <div className="ceo-sales-funnel-row">
              {funnelSteps.map((step, idx) => (
                <React.Fragment key={step.label}>
                  <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 14px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>{step.count}</span>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>{step.label}</span>
                    </div>
                    <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0E7490', marginTop: '4px' }}>{formatLakhs(step.val)}</div>
                  </div>
                  {idx < funnelSteps.length - 1 && (
                    <span className="ceo-sales-funnel-arrow" style={{ color: '#94A3B8', fontSize: '14px', fontWeight: '700', userSelect: 'none' }}>›</span>
                  )}
                </React.Fragment>
              ))}
            </div>
            <div style={{ marginTop: '10px', fontSize: '11.5px', color: '#475569', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              <span>Count conversion <strong style={{ color: '#0F172A' }}>{analytics.countConversion}%</strong> ({analytics.invCount}/{analytics.offersCount})</span>
              <span>Value conversion <strong style={{ color: '#0F172A' }}>{analytics.valueConversion}%</strong></span>
              <span>Average invoice <strong style={{ color: '#0F172A' }}>{formatLakhs(analytics.avgInvoiceVal)}</strong></span>
            </div>
          </BusinzSectionCard>

          {/* Actual Sales Trend + Product Performance */}
          <div className="ceo-sales-sub-grid">
            <BusinzSectionCard title="Actual Sales Trend" subtitle="₹ lakh">
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '6px', height: '150px', paddingTop: '14px' }}>
                {analytics.trendMonths.map((m) => {
                  const h = Math.max(10, Math.round((m.value / analytics.maxTrendVal) * 112));
                  return (
                    <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <div style={{
                        width: '100%', maxWidth: '28px', height: `${h}px`,
                        backgroundColor: m.value > 0 ? '#0E7490' : '#E2E8F0',
                        borderRadius: '5px 5px 2px 2px',
                        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '4px',
                        color: '#FFFFFF', fontSize: '10px', fontWeight: '700'
                      }}>
                        {m.value > 0 ? Math.round(m.value / 100000) : ''}
                      </div>
                      <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '600' }}>{m.label}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: '10px', fontSize: '10.5px', color: '#64748B', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
                Bars show invoiced sales (₹ L) · Target {formatLakhs(analytics.activeTarget)}
              </div>
            </BusinzSectionCard>

            <BusinzSectionCard title="Product Performance" subtitle="₹ lakh" bodyPadding="0">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, textAlign: 'left', paddingLeft: '14px' }}>Product</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Actual</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Target</th>
                      <th style={{ ...thStyle, textAlign: 'right', paddingRight: '14px' }}>Achievement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.productRows.map((p) => (
                      <tr key={p.product}>
                        <td style={{ ...tdStyle, paddingLeft: '14px', fontWeight: '700', color: '#0F172A' }}>{p.product}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#334155', whiteSpace: 'nowrap' }}>{formatLakhs(p.actual)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#64748B', whiteSpace: 'nowrap' }}>{formatLakhs(p.target)}</td>
                        <td style={{ ...tdStyle, paddingRight: '14px', textAlign: 'right', fontWeight: '700', color: p.achievement >= 100 ? '#059669' : '#334155', whiteSpace: 'nowrap' }}>{p.achievement.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </BusinzSectionCard>
          </div>

          {/* Collections & Customer Credit */}
          <BusinzSectionCard title="Collections & Customer Credit" subtitle="All open balances">
            <div className="ceo-sales-credit-kpis" style={{ marginBottom: '12px' }}>
              {[
                { label: 'Collections received', val: formatLakhs(analytics.collectionsReceived), color: '#059669' },
                { label: 'Invoice-value ratio', val: `${analytics.invoiceValueRatio}%`, color: '#0F172A' },
                { label: 'Total outstanding', val: formatLakhs(analytics.totalOutstanding), color: '#0F172A' },
                { label: 'Total overdue', val: formatLakhs(analytics.totalOverdue), color: '#DC2626' },
                { label: 'Due this week', val: formatLakhs(analytics.dueThisWeek), color: '#B45309' }
              ].map((m) => (
                <div key={m.label} style={{ backgroundColor: '#F8FAFC', border: '1px solid #EAEFEF', borderRadius: '10px', padding: '10px' }}>
                  <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748B' }}>{m.label}</div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: m.color, marginTop: '4px' }}>{m.val}</div>
                </div>
              ))}
            </div>
            <div style={{ borderRadius: '10px', border: '1px solid #EAEFEF', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Customer</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Credit limit (₹ L)</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Outstanding (₹ L)</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Overdue (₹ L)</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Utilisation</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Payment status</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.creditRows.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>No open credit balances recorded.</td></tr>
                  ) : analytics.creditRows.map((c) => (
                    <tr key={c.customer}>
                      <td style={{ ...tdStyle, fontWeight: '700', color: '#0F172A' }}>{c.customer}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#475569' }}>{formatLakhNum(c.creditLimit)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#0F172A', fontWeight: '600' }}>{formatLakhNum(c.outstanding)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: c.overdue > 0 ? '#DC2626' : '#94A3B8' }}>{c.overdue > 0 ? formatLakhNum(c.overdue) : '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: Number(c.utilisation) > 100 ? '#DC2626' : '#334155' }}>{c.utilisation}%</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: c.status === 'Overdue' ? '#DC2626' : c.status === 'Due today' ? '#B45309' : '#059669', whiteSpace: 'nowrap' }}>{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BusinzSectionCard>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
          {/* Urgent Alerts */}
          <BusinzSectionCard
            title="Urgent Alerts"
            rightNode={
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('Smart Leads')}
                style={{ fontSize: '11px', fontWeight: '700', color: '#0E7490', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', padding: '3px 10px', borderRadius: '999px', cursor: 'pointer' }}
              >
                Open records
              </button>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                {
                  title: 'Overdue follow-ups',
                  sub: 'Past the scheduled follow-up date',
                  right: `${analytics.overdueLeads.length} follow-ups`,
                  bg: '#FEF2F2', border: '#FECACA', color: '#DC2626'
                },
                {
                  title: 'Inactive opportunities',
                  sub: 'No contact for over 15 days',
                  right: `${analytics.inactiveLeads.length} · ${formatLakhs(analytics.inactiveVal)}`,
                  bg: '#FFFBEB', border: '#FDE68A', color: '#B45309'
                },
                {
                  title: 'Expiring quotations',
                  sub: 'Within the next 7 days',
                  right: `${analytics.expiringQuotes.length} · ${formatLakhs(analytics.expiringQuotesVal)}`,
                  bg: '#FFFBEB', border: '#FDE68A', color: '#B45309'
                },
                {
                  title: 'Collection promises due',
                  sub: 'Due today or earlier',
                  right: `${formatLakhs(analytics.dueThisWeek)}`,
                  bg: '#FEF2F2', border: '#FECACA', color: '#DC2626'
                }
              ].map((al) => (
                <div key={al.title} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                  padding: '9px 12px', borderRadius: '10px', backgroundColor: al.bg, border: `1px solid ${al.border}`
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0F172A' }}>{al.title}</div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>{al.sub}</div>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: al.color, textAlign: 'right', whiteSpace: 'nowrap' }}>{al.right}</div>
                </div>
              ))}
            </div>
          </BusinzSectionCard>

          {/* Region-wise Sales */}
          <BusinzSectionCard title="Region-wise Sales" subtitle={selectedPeriod} bodyPadding="0">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: 'left', paddingLeft: '14px' }}>Region</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Customers</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Invoices</th>
                    <th style={{ ...thStyle, textAlign: 'right', paddingRight: '14px' }}>Sales (₹ lakh)</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.regionRows.length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>No invoiced sales for selected period.</td></tr>
                  ) : (
                    <>
                      {analytics.regionRows.map((r) => (
                        <tr key={r.region}>
                          <td style={{ ...tdStyle, paddingLeft: '14px', fontWeight: '700', color: '#0F172A' }}>{r.region}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#475569' }}>{r.customers}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#475569' }}>{r.invoices}</td>
                          <td style={{ ...tdStyle, paddingRight: '14px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>{formatLakhNum(r.sales)}</td>
                        </tr>
                      ))}
                      <tr style={{ backgroundColor: '#F8FAFC', fontWeight: '800', color: '#0F172A' }}>
                        <td style={{ ...tdStyle, paddingLeft: '14px', borderBottom: 'none' }}>Total</td>
                        <td style={{ ...tdStyle, textAlign: 'right', borderBottom: 'none' }}>{analytics.totalRegCustomers}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', borderBottom: 'none' }}>{analytics.invCount}</td>
                        <td style={{ ...tdStyle, paddingRight: '14px', textAlign: 'right', borderBottom: 'none' }}>{formatLakhNum(analytics.achievedValue)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </BusinzSectionCard>

          {/* Top 5 Customers */}
          <BusinzSectionCard title="Top 5 Customers" subtitle="Month sales contribution" bodyPadding="0">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: 'left', paddingLeft: '14px' }}>#</th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Customer</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Sales (₹ lakh)</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Invoices</th>
                    <th style={{ ...thStyle, textAlign: 'right', paddingRight: '14px' }}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topCustomers.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>No customer invoices in period.</td></tr>
                  ) : analytics.topCustomers.map((c) => (
                    <tr key={c.customer}>
                      <td style={{ ...tdStyle, paddingLeft: '14px', color: '#64748B', fontWeight: '700' }}>{c.rank}</td>
                      <td style={{ ...tdStyle, fontWeight: '700', color: '#0F172A' }}>{c.customer}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>{formatLakhNum(c.sales)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#475569' }}>{c.invoices}</td>
                      <td style={{ ...tdStyle, paddingRight: '14px', textAlign: 'right', color: '#0E7490', fontWeight: '700' }}>{c.share}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BusinzSectionCard>

          {/* Activity & Customer Growth */}
          <BusinzSectionCard title="Activity & Customer Growth" subtitle={selectedPeriod}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px', fontSize: '12px' }}>
              {[
                { label: 'New leads', val: analytics.newLeadsCount },
                { label: 'Offers sent', val: analytics.offersCount },
                { label: 'Proforma invoices', val: analytics.piCount },
                { label: 'Won deals', val: analytics.wonLeadsCount }
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #F1F5F9', paddingBottom: '5px' }}>
                  <span style={{ color: '#475569' }}>{row.label}</span>
                  <strong style={{ color: '#0F172A' }}>{row.val}</strong>
                </div>
              ))}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, padding: '6px 6px', textAlign: 'left' }}>Customer sales mix</th>
                  <th style={{ ...thStyle, padding: '6px 6px', textAlign: 'right' }}>Customers</th>
                  <th style={{ ...thStyle, padding: '6px 6px', textAlign: 'right' }}>Sales (₹ L)</th>
                  <th style={{ ...thStyle, padding: '6px 6px', textAlign: 'right' }}>Share</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...tdStyle, padding: '7px 6px', fontWeight: '600', color: '#0F172A' }}>New customers</td>
                  <td style={{ ...tdStyle, padding: '7px 6px', textAlign: 'right' }}>{analytics.newCustCount}</td>
                  <td style={{ ...tdStyle, padding: '7px 6px', textAlign: 'right' }}>{formatLakhNum(analytics.newCustSales)}</td>
                  <td style={{ ...tdStyle, padding: '7px 6px', textAlign: 'right' }}>{analytics.achievedValue > 0 ? Math.round((analytics.newCustSales / analytics.achievedValue) * 100) : 0}%</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, padding: '7px 6px', fontWeight: '600', color: '#0F172A' }}>Existing customers</td>
                  <td style={{ ...tdStyle, padding: '7px 6px', textAlign: 'right' }}>{analytics.existingCustCount}</td>
                  <td style={{ ...tdStyle, padding: '7px 6px', textAlign: 'right' }}>{formatLakhNum(analytics.existingCustSales)}</td>
                  <td style={{ ...tdStyle, padding: '7px 6px', textAlign: 'right' }}>{analytics.achievedValue > 0 ? Math.round((analytics.existingCustSales / analytics.achievedValue) * 100) : 0}%</td>
                </tr>
                <tr style={{ fontWeight: '800', color: '#0F172A', backgroundColor: '#F8FAFC' }}>
                  <td style={{ ...tdStyle, padding: '7px 6px', borderBottom: 'none' }}>Total</td>
                  <td style={{ ...tdStyle, padding: '7px 6px', textAlign: 'right', borderBottom: 'none' }}>{analytics.newCustCount + analytics.existingCustCount}</td>
                  <td style={{ ...tdStyle, padding: '7px 6px', textAlign: 'right', borderBottom: 'none' }}>{formatLakhNum(analytics.achievedValue)}</td>
                  <td style={{ ...tdStyle, padding: '7px 6px', textAlign: 'right', borderBottom: 'none' }}>100%</td>
                </tr>
              </tbody>
            </table>
          </BusinzSectionCard>
        </div>
      </div>

      {/* Bottom Strip: Lost / Cancelled */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
        padding: '11px 16px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <strong style={{ color: '#0F172A' }}>Lost / Cancelled</strong>
          <strong style={{ color: '#DC2626' }}>{analytics.lostLeadsCount} opportunities · {formatLakhs(analytics.lostVal)}</strong>
          {analytics.lostReasonBreakdown.map(([reason, cnt]) => (
            <span key={reason} style={{ color: '#64748B' }}>{reason} <strong style={{ color: '#334155' }}>{cnt}</strong></span>
          ))}
        </div>
        <span style={{ fontSize: '11px', color: '#64748B' }}>{selectedPeriod}</span>
      </div>
    </div>
  );
}
