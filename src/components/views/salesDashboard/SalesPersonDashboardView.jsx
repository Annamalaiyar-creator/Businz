import React, { useMemo } from 'react';
import {
  Target, TrendingUp, Clock, AlertTriangle,
  ChevronRight, ArrowUpRight, Users, Package, BarChart3,
  Activity, XCircle, Wallet
} from 'lucide-react';
import CeoKpiGrid from '../../ceoDashboard/CeoKpiGrid';

function parseAmtLocal(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).trim();
  if (str.includes('Cr')) return (parseFloat(str.replace(/[^0-9.]/g, '')) || 0) * 10000000;
  if (str.includes('L')) return (parseFloat(str.replace(/[^0-9.]/g, '')) || 0) * 100000;
  return parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
}

function fmtLakhCrCompact(amt) {
  const num = Number(amt) || 0;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)} L`;
  if (num === 0) return '₹0.0 L';
  return `₹${Math.round(num).toLocaleString('en-IN')}`;
}

function fmtLakhNum(amt) {
  const num = Number(amt) || 0;
  return (num / 100000).toFixed(1);
}

function daysBetween(dateVal, ref = new Date()) {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((ref.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

function fmtShortDate(dateVal, fallback = 'Scheduled') {
  if (!dateVal) return fallback;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const businzCardStyle = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #EAEFEF',
  borderRadius: '16px',
  padding: '16px 18px',
  boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
  boxSizing: 'border-box',
  minWidth: 0,
  fontFamily: "'Plus Jakarta Sans', sans-serif"
};

const businzHeaderRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid #F1F5F9',
  paddingBottom: '9px',
  marginBottom: '12px',
  gap: '8px'
};

const businzSectionTitleStyle = {
  fontSize: '12px',
  fontWeight: 800,
  color: '#1E3A8A',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '7px'
};

const businzPillBtnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '11px',
  fontWeight: 700,
  color: '#0E7490',
  backgroundColor: '#ECFEFF',
  border: '1px solid #A5F3FC',
  borderRadius: '9999px',
  padding: '4px 11px',
  cursor: 'pointer'
};

const businzTagStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: '10.5px',
  fontWeight: 700,
  color: '#0E7490',
  backgroundColor: '#ECFEFF',
  border: '1px solid #CFFAFE',
  borderRadius: '9999px',
  padding: '3px 10px'
};

const businzThStyle = {
  padding: '7px 8px',
  fontSize: '10px',
  fontWeight: 700,
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  textAlign: 'left',
  backgroundColor: '#F8FAFC',
  borderBottom: '1px solid #E2E8F0',
  whiteSpace: 'nowrap'
};

const businzTdStyle = {
  padding: '7px 8px',
  fontSize: '11.5px',
  color: '#1E293B',
  borderBottom: '1px solid #F1F5F9',
  verticalAlign: 'middle'
};

export default function SalesPersonDashboardView({
  isMobile = false,
  selectedPeriod = 'This Month',
  monthlyTargetNum = 0,
  targetAchievedVal = 0,
  targetAchievedPct = 0,
  targetBalanceVal = 0,
  requiredDailySales = 0,
  monthEndForecastVal = 0,
  forecastPctOfTarget = 0,
  forecastExpectedAddl = 0,
  remainingWorkingDays = 10,
  filteredQuotations = [],
  filteredOpportunities = [],
  filteredLeads = [],
  filteredPis = [],
  filteredInvoices = [],
  invoices = [],
  followups = [],
  customers = [],
  regionWiseSales = { rows: [], total: { customers: 0, invoices: 0, salesLakhs: '0.0' } },
  monthlyTrendData = [],
  productPerformance = [],
  customerSalesMix = {
    newCustomers: { count: 0, salesLakhs: '0.0', pct: '0%' },
    existingCustomers: { count: 0, salesLakhs: '0.0', pct: '0%' },
    total: { count: 0, salesLakhs: '0.0', pct: '100%' }
  },
  realLostCancelledData = [],
  totalLostVal = 0,
  onNavigateTab
}) {
  const now = new Date();
  const currentMonthLabel = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const totalQuotesVal = useMemo(
    () => (filteredQuotations || []).reduce((s, q) => s + parseAmtLocal(q.grandTotal || q.total), 0),
    [filteredQuotations]
  );
  const totalPiVal = useMemo(
    () => (filteredPis || []).reduce((s, p) => s + parseAmtLocal(p.total || p.grandTotal), 0),
    [filteredPis]
  );
  const totalInvoicedVal = useMemo(
    () => (filteredInvoices || []).reduce((s, i) => s + parseAmtLocal(i.total || i.invAmt || i.amount), 0),
    [filteredInvoices]
  );

  // 1. Today's Actions & Open Follow-ups
  const openActions = useMemo(() => {
    const rows = [];
    (filteredOpportunities || [])
      .filter(o => o && o.stage !== 'Won' && o.stage !== 'Lost' && o.stage !== 'Cancelled')
      .forEach(o => {
        const stageDays = daysBetween(o.stageUpdatedAt || o.updatedAt || o.createdAt, now);
        const contactDays = daysBetween(o.lastContactAt || o.updatedAt || o.createdAt, now);
        const dueStr = o.nextFollowup || (o.nextFollowupDate ? fmtShortDate(o.nextFollowupDate) : 'Follow up');
        const closeDate = o.expectedClosingDate || o.targetCloseDate;
        const isOverdue = o.nextFollowupDate ? new Date(o.nextFollowupDate) < new Date(now.toDateString()) : false;
        rows.push({
          id: o.id || o.oppNumber || Math.random(),
          customer: o.customerName || o.companyName || o.title || 'Customer',
          offerValue: fmtLakhCrCompact(parseAmtLocal(o.dealValue)),
          valNum: parseAmtLocal(o.dealValue),
          stage: o.stage || 'Negotiation',
          nextAction: dueStr,
          isOverdue,
          expectedClose: fmtShortDate(closeDate, '—'),
          stageContact: `${stageDays ?? 1}d / ${contactDays ?? 1}d`
        });
      });

    (followups || [])
      .filter(f => f && f.status !== 'Completed')
      .forEach(f => {
        const cust = f.customerName || f.companyName || 'Customer';
        if (rows.some(r => r.customer.toLowerCase() === cust.toLowerCase())) return;
        const schedDate = f.date ? new Date(f.date) : null;
        const isOverdue = schedDate && !isNaN(schedDate.getTime()) && schedDate < new Date(now.toDateString());
        const age = daysBetween(f.createdAt || f.date, now);
        rows.push({
          id: f.id || Math.random(),
          customer: cust,
          offerValue: f.dealValue ? fmtLakhCrCompact(parseAmtLocal(f.dealValue)) : '—',
          valNum: parseAmtLocal(f.dealValue),
          stage: f.activityType || 'Follow-up',
          nextAction: `${f.notes || f.subject || 'Follow-up'}${f.date ? ` • ${fmtShortDate(f.date)}` : ''}`,
          isOverdue,
          expectedClose: fmtShortDate(f.date, '—'),
          stageContact: `${age ?? 1}d / ${age ?? 1}d`
        });
      });

    if (rows.length === 0) {
      (filteredQuotations || []).slice(0, 5).forEach(q => {
        const age = daysBetween(q.date || q.createdAt, now);
        rows.push({
          id: q.quoteNumber || q.id || Math.random(),
          customer: q.customerName || q.companyName || 'Customer',
          offerValue: fmtLakhCrCompact(parseAmtLocal(q.grandTotal || q.total)),
          valNum: parseAmtLocal(q.grandTotal || q.total),
          stage: q.status || 'Quotation Sent',
          nextAction: q.validUntil ? `Confirm PO • ${fmtShortDate(q.validUntil)}` : 'Confirm PO / follow up',
          isOverdue: false,
          expectedClose: fmtShortDate(q.validUntil, '—'),
          stageContact: `${age ?? 1}d / ${age ?? 1}d`
        });
      });
    }

    return rows.sort((a, b) => b.valNum - a.valNum).slice(0, 6);
  }, [filteredOpportunities, followups, filteredQuotations]);

  // 2. Urgent Alerts
  const urgentAlerts = useMemo(() => {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysLater = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

    const overdueFollowupsList = (followups || []).filter(f => {
      if (!f || f.status === 'Completed' || !f.date) return false;
      const d = new Date(f.date);
      return !isNaN(d.getTime()) && d < startOfToday;
    });
    const overdueFollowupCusts = new Set(overdueFollowupsList.map(f => (f.customerName || f.companyName || f.id).toLowerCase()));

    const inactiveOpps = (filteredOpportunities || []).filter(o => {
      if (!o || o.stage === 'Won' || o.stage === 'Lost' || o.stage === 'Cancelled') return false;
      const diff = daysBetween(o.lastContactAt || o.updatedAt || o.createdAt, now);
      return diff !== null && diff >= 15;
    });
    const inactiveVal = inactiveOpps.reduce((s, o) => s + parseAmtLocal(o.dealValue), 0);

    const expiringQuotes = (filteredQuotations || []).filter(q => {
      if (!q || !q.validUntil) return false;
      const d = new Date(q.validUntil);
      return !isNaN(d.getTime()) && d >= startOfToday && d <= sevenDaysLater;
    });
    const expiringQuotesVal = expiringQuotes.reduce((s, q) => s + parseAmtLocal(q.grandTotal || q.total), 0);

    const duePromises = (invoices || []).filter(inv => {
      if (!inv || inv.status === 'Paid' || inv.paymentStatus === 'Paid') return false;
      const bal = inv.balance !== undefined ? parseAmtLocal(inv.balance) : parseAmtLocal(inv.total || inv.invAmt);
      if (bal <= 0) return false;
      const d = inv.promiseDate || inv.dueDate ? new Date(inv.promiseDate || inv.dueDate) : null;
      return d && !isNaN(d.getTime()) && d <= startOfToday;
    });
    const duePromisesVal = duePromises.reduce((s, inv) => {
      const bal = inv.balance !== undefined ? parseAmtLocal(inv.balance) : parseAmtLocal(inv.total || inv.invAmt);
      return s + Math.max(0, bal);
    }, 0);
    const duePromisesCusts = new Set(duePromises.map(i => (i.customerName || i.vendor || '').toLowerCase()).filter(Boolean));

    return {
      overdueFollowupsCount: overdueFollowupsList.length,
      overdueFollowupCustomers: overdueFollowupCusts.size,
      inactiveCount: inactiveOpps.length,
      inactiveVal,
      expiringCount: expiringQuotes.length,
      expiringVal: expiringQuotesVal,
      promisesVal: duePromisesVal,
      promisesCustomers: duePromisesCusts.size
    };
  }, [followups, filteredOpportunities, filteredQuotations, invoices]);

  // 3. Sales Funnel (BUSINZ Flat 2D Tapered Funnel)
  const funnelSummary = useMemo(() => {
    const qualifiedOpps = (filteredOpportunities || []).filter(
      o => o && o.stage !== 'New Lead' && o.stage !== 'Contacted' && o.stage !== 'Lost' && o.stage !== 'Cancelled'
    );
    const qualifiedVal = qualifiedOpps.reduce((s, o) => s + parseAmtLocal(o.dealValue), 0);

    const offersCount = filteredQuotations.length;
    const invCount = filteredInvoices.length;
    const countConv = offersCount > 0 ? ((invCount / offersCount) * 100).toFixed(1) : '0.0';
    const valConv = totalQuotesVal > 0 ? ((totalInvoicedVal / totalQuotesVal) * 100).toFixed(1) : '0.0';
    const avgInvoice = invCount > 0 ? totalInvoicedVal / invCount : 0;

    return {
      steps: [
        {
          label: 'OFFERS',
          count: `${offersCount} Deals`,
          value: fmtLakhCrCompact(totalQuotesVal),
          pct: '100%',
          barColor: '#8B5CF6',
          width: '100%'
        },
        {
          label: 'QUALIFIED',
          count: `${qualifiedOpps.length} Deals`,
          value: fmtLakhCrCompact(qualifiedVal),
          pct: `${totalQuotesVal > 0 ? Math.round((qualifiedVal / totalQuotesVal) * 100) : 0}%`,
          barColor: '#EC4899',
          width: '88%'
        },
        {
          label: 'PROFORMA INVOICES',
          count: `${filteredPis.length} Deals`,
          value: fmtLakhCrCompact(totalPiVal),
          pct: `${totalQuotesVal > 0 ? Math.round((totalPiVal / totalQuotesVal) * 100) : 0}%`,
          barColor: '#0284C7',
          width: '76%'
        },
        {
          label: 'INVOICED',
          count: `${invCount} Deals`,
          value: fmtLakhCrCompact(totalInvoicedVal),
          pct: `${totalQuotesVal > 0 ? Math.round((totalInvoicedVal / totalQuotesVal) * 100) : 0}%`,
          barColor: '#16A34A',
          width: '64%'
        }
      ],
      countConv,
      offersCount,
      invCount,
      valConv,
      avgInvoice
    };
  }, [filteredQuotations, filteredOpportunities, filteredPis, filteredInvoices, totalQuotesVal, totalPiVal, totalInvoicedVal]);

  // 4. Actual Sales Trend (7 months)
  const trendMax = useMemo(() => {
    const maxActual = Math.max(...(monthlyTrendData || []).map(d => Number(d.actual) || 0), 10);
    return Math.ceil(maxActual / 25) * 25 || 100;
  }, [monthlyTrendData]);

  // 5. Product Performance with Target & Achievement
  const productRows = useMemo(() => {
    const activeTotal = (productPerformance || []).reduce((s, p) => s + (Number(p.rawAmount) || 0), 0);
    const baseTarget = monthlyTargetNum > 0 ? monthlyTargetNum : Math.max(activeTotal, 100000);
    const defaultWeights = {
      'Solar Structures': 0.46,
      'Aluminium Profiles': 0.30,
      'BOS Kits': 0.14,
      'Walkway / Handrail': 0.06,
      'Accessories': 0.04,
      'Solar Panels / Modules': 0.15
    };
    return (productPerformance || [])
      .filter(p => (p.rawAmount || 0) > 0 || p.name !== 'Solar Panels / Modules')
      .map(p => {
        const actualRaw = Number(p.rawAmount) || 0;
        const targetRaw = Math.round(baseTarget * (defaultWeights[p.name] || 0.1));
        const achPct = targetRaw > 0 ? ((actualRaw / targetRaw) * 100).toFixed(1) : '0.0';
        return {
          name: p.name,
          actualStr: fmtLakhCrCompact(actualRaw),
          targetStr: fmtLakhCrCompact(targetRaw),
          achNum: parseFloat(achPct),
          achStr: `${achPct}%`
        };
      });
  }, [productPerformance, monthlyTargetNum]);

  // 6. Top 5 Customers
  const top5Customers = useMemo(() => {
    const srcInvoices = (filteredInvoices && filteredInvoices.length > 0) ? filteredInvoices : invoices;
    const map = new Map();
    (srcInvoices || []).forEach(inv => {
      const name = (inv.customerName || inv.vendor || inv.customerId || '').trim();
      if (!name) return;
      const amt = parseAmtLocal(inv.total || inv.invAmt || inv.amount);
      if (amt <= 0) return;
      const prev = map.get(name) || { name, sales: 0, count: 0 };
      prev.sales += amt;
      prev.count += 1;
      map.set(name, prev);
    });
    const list = Array.from(map.values()).sort((a, b) => b.sales - a.sales);
    const totalAll = list.reduce((s, c) => s + c.sales, 0);
    return list.slice(0, 5).map((c, idx) => ({
      rank: String(idx + 1).padStart(2, '0'),
      name: c.name,
      salesLakhs: fmtLakhNum(c.sales),
      invoices: c.count,
      share: totalAll > 0 ? `${((c.sales / totalAll) * 100).toFixed(1)}%` : '0.0%'
    }));
  }, [filteredInvoices, invoices]);

  // 7. Collections & Customer Credit
  const collectionsData = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const next7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const custLimitMap = new Map();
    (customers || []).forEach(c => {
      if (!c) return;
      const n = (c.customerName || c.companyName || '').trim().toLowerCase();
      if (n) custLimitMap.set(n, parseAmtLocal(c.creditLimit) || 1000000);
    });

    let totalInvoicedAll = 0;
    let totalReceivedAll = 0;
    let totalOutstandingAll = 0;
    let totalOverdueAll = 0;
    let dueThisWeekAll = 0;

    const custAgg = new Map();
    (invoices || []).forEach(inv => {
      const custName = (inv.customerName || inv.vendor || '').trim();
      if (!custName) return;
      const amt = parseAmtLocal(inv.total || inv.invAmt || inv.amount);
      const isPaid = inv.status === 'Paid' || inv.paymentStatus === 'Paid';
      const bal = isPaid ? 0 : (inv.balance !== undefined ? Math.max(0, parseAmtLocal(inv.balance)) : amt);
      const recv = Math.max(0, amt - bal);

      totalInvoicedAll += amt;
      totalReceivedAll += recv;
      totalOutstandingAll += bal;

      if (bal > 0) {
        const k = custName.toLowerCase();
        const entry = custAgg.get(k) || {
          customer: custName,
          limit: custLimitMap.get(k) || 1000000,
          outstanding: 0,
          overdue: 0,
          dueTodayOrSoon: false,
          promiseOverdue: false
        };
        entry.outstanding += bal;

        const due = inv.dueDate ? new Date(inv.dueDate) : null;
        if (due && !isNaN(due.getTime())) {
          if (due < today) {
            entry.overdue += bal;
            entry.promiseOverdue = true;
            totalOverdueAll += bal;
          } else if (due <= next7) {
            entry.dueTodayOrSoon = true;
            dueThisWeekAll += bal;
          }
        }
        custAgg.set(k, entry);
      }
    });

    const rows = Array.from(custAgg.values())
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 5)
      .map(e => {
        const utilPct = e.limit > 0 ? Math.round((e.outstanding / e.limit) * 1000) / 10 : 0;
        let payStatus = 'No overdue';
        let payColor = '#059669';
        let payBg = '#ECFDF5';
        let payBorder = '#A7F3D0';
        if (e.promiseOverdue) {
          payStatus = 'Promise overdue';
          payColor = '#DC2626';
          payBg = '#FEF2F2';
          payBorder = '#FECACA';
        } else if (e.dueTodayOrSoon) {
          payStatus = 'Due today';
          payColor = '#B45309';
          payBg = '#FFFBEB';
          payBorder = '#FDE68A';
        }
        return {
          customer: e.customer,
          limitLakhs: fmtLakhNum(e.limit),
          outstandingLakhs: fmtLakhNum(e.outstanding),
          overdueLakhs: e.overdue > 0 ? fmtLakhNum(e.overdue) : '—',
          utilPct,
          payStatus,
          payColor,
          payBg,
          payBorder
        };
      });

    return {
      received: totalReceivedAll,
      ratio: totalInvoicedAll > 0 ? ((totalReceivedAll / totalInvoicedAll) * 100).toFixed(1) : '0.0',
      outstanding: totalOutstandingAll,
      overdue: totalOverdueAll,
      dueThisWeek: dueThisWeekAll,
      rows
    };
  }, [invoices, customers]);

  // 8. Activity & Customer Growth
  const activityData = useMemo(() => {
    const calls = (followups || []).filter(f => String(f.activityType || '').toLowerCase().includes('call')).length;
    const meetings = (followups || []).filter(f => {
      const t = String(f.activityType || '').toLowerCase();
      return t.includes('meeting') || t.includes('visit') || t.includes('demo');
    }).length;
    const completedFups = (followups || []).filter(f => f.status === 'Completed').length;
    const totalFups = (followups || []).length;
    const onTimePct = totalFups > 0 ? Math.round((completedFups / totalFups) * 100) : 0;
    return {
      newLeads: filteredLeads.length,
      callsCompleted: calls,
      meetings,
      offersSent: filteredQuotations.length,
      followupsCompleted: completedFups,
      onTimePct
    };
  }, [filteredLeads, followups, filteredQuotations]);

  // 9. Lost / Cancelled Reasons Breakdown
  const lostReasons = useMemo(() => {
    let price = 0;
    let postponed = 0;
    let competitor = 0;
    let noResp = 0;
    (realLostCancelledData || []).forEach(item => {
      const r = String(item.reason || '').toLowerCase();
      if (r.includes('price') || r.includes('cost') || r.includes('rate')) price += 1;
      else if (r.includes('postpon') || r.includes('delay') || r.includes('hold')) postponed += 1;
      else if (r.includes('compet')) competitor += 1;
      else noResp += 1;
    });
    return { price, postponed, competitor, noResp };
  }, [realLostCancelledData]);

  const kpiCards = [
    {
      title: 'MONTH TARGET',
      value: fmtLakhCrCompact(monthlyTargetNum),
      trend: currentMonthLabel,
      trendUp: true,
      trendNeutral: true,
      icon: Target,
      iconColor: '#0E7490',
      iconBg: '#ECFEFF',
      bottomPrefix: 'Assigned quota ',
      bottomHighlight: currentMonthLabel,
      bottomHighlightColor: '#0E7490'
    },
    {
      title: 'ACHIEVED / INVOICED',
      value: fmtLakhCrCompact(targetAchievedVal),
      trend: `${targetAchievedPct}% Achieved`,
      trendUp: targetAchievedPct >= 50,
      icon: TrendingUp,
      iconColor: '#059669',
      iconBg: '#ECFDF5',
      bottomPrefix: 'Monthly target ',
      bottomHighlight: `${targetAchievedPct}% Done`,
      bottomHighlightColor: '#059669',
      onClick: () => onNavigateTab && onNavigateTab('Invoice Management')
    },
    {
      title: 'BALANCE TO TARGET',
      value: fmtLakhCrCompact(targetBalanceVal),
      trend: targetBalanceVal > 0 ? `₹${Math.round(requiredDailySales).toLocaleString('en-IN')}/day` : 'Target Met',
      trendUp: targetBalanceVal === 0,
      icon: Clock,
      iconColor: '#D97706',
      iconBg: '#FFFBEB',
      bottomPrefix: 'Runway ',
      bottomHighlight: `${remainingWorkingDays} working days left`,
      bottomHighlightColor: targetBalanceVal > 0 ? '#D97706' : '#059669'
    },
    {
      title: 'MONTH-END FORECAST',
      value: fmtLakhCrCompact(monthEndForecastVal),
      trend: `${forecastPctOfTarget}% Projected`,
      trendUp: forecastPctOfTarget >= 100,
      icon: ArrowUpRight,
      iconColor: '#0284C7',
      iconBg: '#F0F9FF',
      bottomPrefix: 'Pipeline expected ',
      bottomHighlight: `+${fmtLakhCrCompact(forecastExpectedAddl)}`,
      bottomHighlightColor: '#0284C7'
    }
  ];

  const rankColors = ['#0E7490', '#0284C7', '#10B981', '#D97706', '#6366F1'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', boxSizing: 'border-box', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* ROW 1: CANONICAL BUSINZ CeoKpiGrid */}
      <CeoKpiGrid kpis={kpiCards} />

      {/* TARGET ACHIEVEMENT RUNWAY BAR */}
      <div style={{
        ...businzCardStyle,
        padding: '13px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
          Target Achievement
        </span>
        <div style={{ flex: 1, minWidth: '180px', height: '9px', backgroundColor: '#E2E8F0', borderRadius: '9999px', overflow: 'hidden' }}>
          <div style={{
            width: `${Math.min(100, Math.max(0, targetAchievedPct))}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #0E7490 0%, #10B981 100%)',
            borderRadius: '9999px',
            transition: 'width 0.4s ease'
          }} />
        </div>
        <span style={{
          fontSize: '11.5px',
          fontWeight: 800,
          color: '#059669',
          backgroundColor: '#ECFDF5',
          border: '1px solid #A7F3D0',
          borderRadius: '9999px',
          padding: '2px 10px'
        }}>
          {targetAchievedPct}%
        </span>
        <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
          Assumes {remainingWorkingDays} working days remaining • Sales values exclude GST
        </span>
      </div>

      {/* ROW 2: TODAY'S ACTIONS & OPEN FOLLOW-UPS (65%) + URGENT ALERTS (35%) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1.75fr 1fr',
        gap: '16px',
        alignItems: 'stretch'
      }}>
        <div style={{ ...businzCardStyle, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={businzHeaderRowStyle}>
              <h3 style={businzSectionTitleStyle}>
                <Clock size={14} color="#0E7490" />
                Today&apos;s Actions &amp; Open Follow-ups
              </h3>
              <button type="button" style={businzPillBtnStyle} onClick={() => onNavigateTab && onNavigateTab('Follow-ups')}>
                Open records <ChevronRight size={13} />
              </button>
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid #F1F5F9', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
                <thead>
                  <tr>
                    <th style={businzThStyle}>Customer</th>
                    <th style={businzThStyle}>Offer value</th>
                    <th style={businzThStyle}>Stage</th>
                    <th style={businzThStyle}>Next action / due</th>
                    <th style={businzThStyle}>Expected close</th>
                    <th style={{ ...businzThStyle, textAlign: 'right' }}>Stage / contact</th>
                  </tr>
                </thead>
                <tbody>
                  {openActions.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ ...businzTdStyle, textAlign: 'center', color: '#94A3B8', padding: '24px 8px' }}>
                        No open follow-ups or active opportunities for {selectedPeriod.toLowerCase()}.
                      </td>
                    </tr>
                  ) : (
                    openActions.map(row => (
                      <tr key={row.id}>
                        <td style={{ ...businzTdStyle, fontWeight: 700, color: '#0F172A' }}>{row.customer}</td>
                        <td style={{ ...businzTdStyle, fontWeight: 700, color: '#0E7490' }}>{row.offerValue}</td>
                        <td style={businzTdStyle}>
                          <span style={{
                            display: 'inline-block',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            backgroundColor: '#F1F5F9',
                            color: '#334155'
                          }}>
                            {row.stage}
                          </span>
                        </td>
                        <td style={{ ...businzTdStyle, color: row.isOverdue ? '#DC2626' : '#1E293B', fontWeight: row.isOverdue ? 700 : 500 }}>
                          {row.nextAction}
                        </td>
                        <td style={businzTdStyle}>{row.expectedClose}</td>
                        <td style={{ ...businzTdStyle, textAlign: 'right', color: '#64748B', fontWeight: 600 }}>{row.stageContact}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '10px' }}>
            Stage / contact shows days in current stage and days since last customer contact.
          </div>
        </div>

        <div style={businzCardStyle}>
          <div style={businzHeaderRowStyle}>
            <h3 style={businzSectionTitleStyle}>
              <AlertTriangle size={14} color="#D97706" />
              Urgent Alerts
            </h3>
            <button type="button" style={businzPillBtnStyle} onClick={() => onNavigateTab && onNavigateTab('Follow-ups')}>
              Open records <ChevronRight size={13} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              onClick={() => onNavigateTab && onNavigateTab('Follow-ups')}
              style={{
                padding: '11px 13px',
                borderRadius: '10px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#991B1B' }}>Overdue follow-ups</div>
                <div style={{ fontSize: '10.5px', color: '#B91C1C' }}>Past the scheduled follow-up date</div>
              </div>
              <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#DC2626', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {urgentAlerts.overdueFollowupsCount} follow-ups • {urgentAlerts.overdueFollowupCustomers} customers
              </div>
            </div>

            <div
              onClick={() => onNavigateTab && onNavigateTab('Leads')}
              style={{
                padding: '11px 13px',
                borderRadius: '10px',
                backgroundColor: '#FFFBEB',
                border: '1px solid #FDE68A',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400E' }}>Inactive opportunities</div>
                <div style={{ fontSize: '10.5px', color: '#B45309' }}>No contact for over 15 days</div>
              </div>
              <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#B45309', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {urgentAlerts.inactiveCount} opps • {fmtLakhCrCompact(urgentAlerts.inactiveVal)}
              </div>
            </div>

            <div
              onClick={() => onNavigateTab && onNavigateTab('Quotations')}
              style={{
                padding: '11px 13px',
                borderRadius: '10px',
                backgroundColor: '#FEFCE8',
                border: '1px solid #FEF08A',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#854D0E' }}>Expiring quotations</div>
                <div style={{ fontSize: '10.5px', color: '#A16207' }}>Within the next 7 days</div>
              </div>
              <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#B45309', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {urgentAlerts.expiringCount} quotes • {fmtLakhCrCompact(urgentAlerts.expiringVal)}
              </div>
            </div>

            <div
              onClick={() => onNavigateTab && onNavigateTab('Payments')}
              style={{
                padding: '11px 13px',
                borderRadius: '10px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#991B1B' }}>Collection promises due</div>
                <div style={{ fontSize: '10.5px', color: '#B91C1C' }}>Due today or earlier</div>
              </div>
              <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#DC2626', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {fmtLakhCrCompact(urgentAlerts.promisesVal)} • {urgentAlerts.promisesCustomers} customers
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3: SALES FUNNEL (60%) + REGION-WISE SALES (40%) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr',
        gap: '16px',
        alignItems: 'stretch'
      }}>
        <div style={{ ...businzCardStyle, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={businzHeaderRowStyle}>
              <h3 style={businzSectionTitleStyle}>My Sales Funnel — {selectedPeriod}</h3>
              <span style={businzTagStyle}>CONVERSION: {funnelSummary.countConv}%</span>
            </div>
            {/* Flat 2D Tapered Sales Funnel matching BUSINZ Design System */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', padding: '4px 0' }}>
              {funnelSummary.steps.map((tier, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                  <div
                    style={{
                      width: tier.width,
                      backgroundColor: tier.barColor,
                      color: '#FFFFFF',
                      borderRadius: '9px',
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 6px rgba(15, 23, 42, 0.08)',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: 800, letterSpacing: '0.5px' }}>
                        {tier.label}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        backgroundColor: 'rgba(255,255,255,0.24)',
                        padding: '2px 8px',
                        borderRadius: '9999px'
                      }}>
                        {tier.count}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800 }}>{tier.value}</span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        backgroundColor: 'rgba(255,255,255,0.22)',
                        padding: '2px 7px',
                        borderRadius: '9999px'
                      }}>
                        {tier.pct}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{
            marginTop: '14px',
            padding: '10px 14px',
            backgroundColor: '#F8FAFC',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            fontSize: '11.5px',
            color: '#334155',
            fontWeight: 700,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: '10px'
          }}>
            <span>Count conversion: <strong style={{ color: '#0E7490' }}>{funnelSummary.countConv}%</strong> ({funnelSummary.invCount}/{funnelSummary.offersCount})</span>
            <span>Value conversion: <strong style={{ color: '#059669' }}>{funnelSummary.valConv}%</strong></span>
            <span>Avg invoice: <strong style={{ color: '#1E3A8A' }}>{fmtLakhCrCompact(funnelSummary.avgInvoice)}</strong></span>
          </div>
        </div>

        <div style={businzCardStyle}>
          <div style={businzHeaderRowStyle}>
            <h3 style={businzSectionTitleStyle}>Region-wise Sales</h3>
            <span style={businzTagStyle}>{selectedPeriod}</span>
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid #F1F5F9', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={businzThStyle}>Region</th>
                  <th style={{ ...businzThStyle, textAlign: 'right' }}>Customers</th>
                  <th style={{ ...businzThStyle, textAlign: 'right' }}>Invoices</th>
                  <th style={{ ...businzThStyle, textAlign: 'right' }}>Sales (₹ L)</th>
                </tr>
              </thead>
              <tbody>
                {(regionWiseSales.rows || []).map(r => (
                  <tr key={r.region}>
                    <td style={{ ...businzTdStyle, padding: '6px 10px', fontWeight: 700 }}>{r.region}</td>
                    <td style={{ ...businzTdStyle, padding: '6px 10px', textAlign: 'right' }}>{r.customers}</td>
                    <td style={{ ...businzTdStyle, padding: '6px 10px', textAlign: 'right' }}>{r.invoices}</td>
                    <td style={{ ...businzTdStyle, padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#0E7490' }}>{r.salesLakhs}</td>
                  </tr>
                ))}
                <tr style={{ backgroundColor: '#F8FAFC' }}>
                  <td style={{ ...businzTdStyle, padding: '7px 10px', fontWeight: 800, borderBottom: 'none', color: '#1E3A8A' }}>Total</td>
                  <td style={{ ...businzTdStyle, padding: '7px 10px', textAlign: 'right', fontWeight: 800, borderBottom: 'none' }}>{regionWiseSales.total?.customers || 0}</td>
                  <td style={{ ...businzTdStyle, padding: '7px 10px', textAlign: 'right', fontWeight: 800, borderBottom: 'none' }}>{regionWiseSales.total?.invoices || 0}</td>
                  <td style={{ ...businzTdStyle, padding: '7px 10px', textAlign: 'right', fontWeight: 800, borderBottom: 'none', color: '#0E7490' }}>{regionWiseSales.total?.salesLakhs || '0.0'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '8px' }}>
            Unique invoiced customers • One assigned region per customer
          </div>
        </div>
      </div>

      {/* ROW 4: LEFT (TREND + PRODUCT + COLLECTIONS) & RIGHT (TOP 5 CUSTOMERS + ACTIVITY) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1.75fr 1fr',
        gap: '16px',
        alignItems: 'start'
      }}>
        {/* Left Stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          {/* Actual Sales Trend + Product Performance */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '0.88fr 1.12fr',
            gap: '16px'
          }}>
            <div style={businzCardStyle}>
              <div style={businzHeaderRowStyle}>
                <h3 style={businzSectionTitleStyle}>
                  <BarChart3 size={14} color="#0E7490" />
                  Actual Sales Trend
                </h3>
                <span style={businzTagStyle}>₹ Lakh</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '145px', padding: '12px 4px 4px', borderBottom: '1.5px solid #E2E8F0' }}>
                {(monthlyTrendData || []).map(d => {
                  const pct = trendMax > 0 ? Math.min(100, Math.max(10, (d.actual / trendMax) * 100)) : 10;
                  return (
                    <div key={d.month} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <div style={{
                        width: '100%',
                        maxWidth: '30px',
                        height: `${pct}%`,
                        background: 'linear-gradient(180deg, #0E7490 0%, #0369A1 100%)',
                        borderRadius: '6px 6px 0 0',
                        display: 'flex',
                        justifyContent: 'center',
                        paddingTop: '4px',
                        color: '#FFFFFF',
                        fontSize: '10px',
                        fontWeight: 800,
                        boxShadow: '0 2px 6px rgba(14, 116, 144, 0.2)'
                      }}>
                        {d.actual > 0 ? Math.round(d.actual) : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '8px', paddingTop: '6px' }}>
                {(monthlyTrendData || []).map(d => (
                  <div key={d.month} style={{ flex: 1, textAlign: 'center', fontSize: '10.5px', color: '#64748B', fontWeight: 700 }}>
                    {d.month}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '10px' }}>
                Bars show invoiced sales • Monthly target <strong style={{ color: '#0E7490' }}>{fmtLakhCrCompact(monthlyTargetNum)}</strong>
              </div>
            </div>

            <div style={businzCardStyle}>
              <div style={businzHeaderRowStyle}>
                <h3 style={businzSectionTitleStyle}>
                  <Package size={14} color="#0E7490" />
                  Product Performance
                </h3>
                <span style={businzTagStyle}>₹ Lakh</span>
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid #F1F5F9', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={businzThStyle}>Product</th>
                      <th style={{ ...businzThStyle, textAlign: 'right' }}>Actual</th>
                      <th style={{ ...businzThStyle, textAlign: 'right' }}>Target</th>
                      <th style={{ ...businzThStyle, textAlign: 'right' }}>Achievement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productRows.map(p => (
                      <tr key={p.name}>
                        <td style={{ ...businzTdStyle, fontWeight: 700 }}>{p.name}</td>
                        <td style={{ ...businzTdStyle, textAlign: 'right', fontWeight: 700, color: '#0E7490' }}>{p.actualStr}</td>
                        <td style={{ ...businzTdStyle, textAlign: 'right', color: '#64748B' }}>{p.targetStr}</td>
                        <td style={{ ...businzTdStyle, textAlign: 'right' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            backgroundColor: p.achNum >= 100 ? '#ECFDF5' : '#F1F5F9',
                            color: p.achNum >= 100 ? '#059669' : '#334155'
                          }}>
                            {p.achStr}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Collections & Customer Credit */}
          <div style={businzCardStyle}>
            <div style={businzHeaderRowStyle}>
              <h3 style={businzSectionTitleStyle}>
                <Wallet size={14} color="#0E7490" />
                Collections &amp; Customer Credit
              </h3>
              <button type="button" style={businzPillBtnStyle} onClick={() => onNavigateTab && onNavigateTab('Payments')}>
                All open balances <ChevronRight size={13} />
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, minmax(0, 1fr))',
              gap: '10px',
              marginBottom: '14px'
            }}>
              <div style={{ padding: '11px 12px', borderRadius: '12px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#166534' }}>Collections received</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#059669', marginTop: '3px' }}>{fmtLakhCrCompact(collectionsData.received)}</div>
              </div>
              <div style={{ padding: '11px 12px', borderRadius: '12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#475569' }}>Invoice-value ratio</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#0F172A', marginTop: '3px' }}>{collectionsData.ratio}%</div>
              </div>
              <div style={{ padding: '11px 12px', borderRadius: '12px', backgroundColor: '#ECFEFF', border: '1px solid #CFFAFE' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#0E7490' }}>Total outstanding</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#0F172A', marginTop: '3px' }}>{fmtLakhCrCompact(collectionsData.outstanding)}</div>
              </div>
              <div style={{ padding: '11px 12px', borderRadius: '12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#991B1B' }}>Total overdue</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#DC2626', marginTop: '3px' }}>{fmtLakhCrCompact(collectionsData.overdue)}</div>
              </div>
              <div style={{ padding: '11px 12px', borderRadius: '12px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#92400E' }}>Due this week</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#D97706', marginTop: '3px' }}>{fmtLakhCrCompact(collectionsData.dueThisWeek)}</div>
              </div>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid #F1F5F9', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
                <thead>
                  <tr>
                    <th style={businzThStyle}>Customer</th>
                    <th style={{ ...businzThStyle, textAlign: 'right' }}>Credit limit (₹ L)</th>
                    <th style={{ ...businzThStyle, textAlign: 'right' }}>Outstanding (₹ L)</th>
                    <th style={{ ...businzThStyle, textAlign: 'right' }}>Overdue (₹ L)</th>
                    <th style={{ ...businzThStyle, textAlign: 'right' }}>Utilisation</th>
                    <th style={{ ...businzThStyle, textAlign: 'right' }}>Payment status</th>
                  </tr>
                </thead>
                <tbody>
                  {collectionsData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ ...businzTdStyle, textAlign: 'center', color: '#94A3B8', padding: '18px 8px' }}>
                        No open customer credit balances.
                      </td>
                    </tr>
                  ) : (
                    collectionsData.rows.map(r => (
                      <tr key={r.customer}>
                        <td style={{ ...businzTdStyle, fontWeight: 700 }}>{r.customer}</td>
                        <td style={{ ...businzTdStyle, textAlign: 'right' }}>{r.limitLakhs}</td>
                        <td style={{ ...businzTdStyle, textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>{r.outstandingLakhs}</td>
                        <td style={{ ...businzTdStyle, textAlign: 'right', fontWeight: 700, color: r.overdueLakhs !== '—' ? '#DC2626' : '#64748B' }}>{r.overdueLakhs}</td>
                        <td style={{ ...businzTdStyle, textAlign: 'right', fontWeight: 800, color: r.utilPct > 100 ? '#DC2626' : '#1E293B' }}>
                          {r.utilPct}%
                        </td>
                        <td style={{ ...businzTdStyle, textAlign: 'right' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 9px',
                            borderRadius: '9999px',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            color: r.payColor,
                            backgroundColor: r.payBg,
                            border: `1px solid ${r.payBorder}`
                          }}>
                            {r.payStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          {/* Top 5 Customers */}
          <div style={businzCardStyle}>
            <div style={businzHeaderRowStyle}>
              <h3 style={businzSectionTitleStyle}>
                <Users size={14} color="#0E7490" />
                Top 5 Customers
              </h3>
              <span style={businzTagStyle}>Month Share</span>
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid #F1F5F9', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={businzThStyle}>#</th>
                    <th style={businzThStyle}>Customer</th>
                    <th style={{ ...businzThStyle, textAlign: 'right' }}>Sales (₹ L)</th>
                    <th style={{ ...businzThStyle, textAlign: 'right' }}>Inv</th>
                    <th style={{ ...businzThStyle, textAlign: 'right' }}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {top5Customers.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ ...businzTdStyle, textAlign: 'center', color: '#94A3B8', padding: '18px 8px' }}>
                        No invoiced customers yet.
                      </td>
                    </tr>
                  ) : (
                    top5Customers.map((c, idx) => (
                      <tr key={c.rank}>
                        <td style={{ ...businzTdStyle, fontWeight: 800, color: rankColors[idx] || '#64748B' }}>{c.rank}</td>
                        <td style={{ ...businzTdStyle, fontWeight: 700, maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.name}>
                          {c.name}
                        </td>
                        <td style={{ ...businzTdStyle, textAlign: 'right', fontWeight: 700, color: '#0E7490' }}>{c.salesLakhs}</td>
                        <td style={{ ...businzTdStyle, textAlign: 'right' }}>{c.invoices}</td>
                        <td style={{ ...businzTdStyle, textAlign: 'right', fontWeight: 700, color: '#475569' }}>{c.share}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Activity & Customer Growth */}
          <div style={businzCardStyle}>
            <div style={businzHeaderRowStyle}>
              <h3 style={businzSectionTitleStyle}>
                <Activity size={14} color="#0E7490" />
                Activity &amp; Customer Growth
              </h3>
              <span style={businzTagStyle}>{selectedPeriod}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', paddingBottom: '12px', borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569', fontWeight: 500 }}>New leads</span>
                <strong style={{ color: '#0F172A' }}>{activityData.newLeads}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569', fontWeight: 500 }}>Calls completed</span>
                <strong style={{ color: '#0F172A' }}>{activityData.callsCompleted}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569', fontWeight: 500 }}>Meetings</span>
                <strong style={{ color: '#0F172A' }}>{activityData.meetings}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569', fontWeight: 500 }}>Offers sent</span>
                <strong style={{ color: '#0F172A' }}>{activityData.offersSent}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#475569', fontWeight: 500 }}>Follow-ups completed</span>
                <div>
                  <strong style={{ color: '#0F172A' }}>{activityData.followupsCompleted}</strong>
                  <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#0E7490', marginLeft: '8px', backgroundColor: '#ECFEFF', padding: '2px 7px', borderRadius: '9999px' }}>
                    {activityData.onTimePct}% on time
                  </span>
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto', marginTop: '10px', border: '1px solid #F1F5F9', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...businzThStyle, padding: '7px 8px' }}>Customer mix</th>
                    <th style={{ ...businzThStyle, padding: '7px 8px', textAlign: 'right' }}>Cust</th>
                    <th style={{ ...businzThStyle, padding: '7px 8px', textAlign: 'right' }}>Sales (₹ L)</th>
                    <th style={{ ...businzThStyle, padding: '7px 8px', textAlign: 'right' }}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ ...businzTdStyle, padding: '6px 8px', fontWeight: 600 }}>New customers</td>
                    <td style={{ ...businzTdStyle, padding: '6px 8px', textAlign: 'right' }}>{customerSalesMix.newCustomers?.count || 0}</td>
                    <td style={{ ...businzTdStyle, padding: '6px 8px', textAlign: 'right' }}>{customerSalesMix.newCustomers?.salesLakhs || '0.0'}</td>
                    <td style={{ ...businzTdStyle, padding: '6px 8px', textAlign: 'right' }}>{customerSalesMix.newCustomers?.pct || '0%'}</td>
                  </tr>
                  <tr>
                    <td style={{ ...businzTdStyle, padding: '6px 8px', fontWeight: 600 }}>Existing customers</td>
                    <td style={{ ...businzTdStyle, padding: '6px 8px', textAlign: 'right' }}>{customerSalesMix.existingCustomers?.count || 0}</td>
                    <td style={{ ...businzTdStyle, padding: '6px 8px', textAlign: 'right' }}>{customerSalesMix.existingCustomers?.salesLakhs || '0.0'}</td>
                    <td style={{ ...businzTdStyle, padding: '6px 8px', textAlign: 'right' }}>{customerSalesMix.existingCustomers?.pct || '0%'}</td>
                  </tr>
                  <tr style={{ backgroundColor: '#F8FAFC' }}>
                    <td style={{ ...businzTdStyle, padding: '7px 8px', fontWeight: 800, borderBottom: 'none', color: '#1E3A8A' }}>Total</td>
                    <td style={{ ...businzTdStyle, padding: '7px 8px', textAlign: 'right', fontWeight: 800, borderBottom: 'none' }}>{customerSalesMix.total?.count || 0}</td>
                    <td style={{ ...businzTdStyle, padding: '7px 8px', textAlign: 'right', fontWeight: 800, borderBottom: 'none', color: '#0E7490' }}>{customerSalesMix.total?.salesLakhs || '0.0'}</td>
                    <td style={{ ...businzTdStyle, padding: '7px 8px', textAlign: 'right', fontWeight: 800, borderBottom: 'none' }}>{customerSalesMix.total?.pct || '100%'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM STRIP: LOST / CANCELLED */}
      <div style={{
        ...businzCardStyle,
        padding: '13px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '12.5px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.4px', fontSize: '12px' }}>
            <XCircle size={14} color="#DC2626" />
            Lost / Cancelled
          </span>
          <span style={{
            fontSize: '11.5px',
            fontWeight: 800,
            padding: '3px 10px',
            borderRadius: '9999px',
            backgroundColor: realLostCancelledData.length > 0 ? '#FEF2F2' : '#ECFDF5',
            color: realLostCancelledData.length > 0 ? '#DC2626' : '#059669',
            border: `1px solid ${realLostCancelledData.length > 0 ? '#FECACA' : '#A7F3D0'}`
          }}>
            {realLostCancelledData.length} opportunities • {fmtLakhCrCompact(totalLostVal)}
          </span>
          <span style={{ color: '#64748B' }}>Price difference <strong style={{ color: '#0F172A' }}>{lostReasons.price}</strong></span>
          <span style={{ color: '#64748B' }}>Project postponed <strong style={{ color: '#0F172A' }}>{lostReasons.postponed}</strong></span>
          <span style={{ color: '#64748B' }}>Competitor selected <strong style={{ color: '#0F172A' }}>{lostReasons.competitor}</strong></span>
          <span style={{ color: '#64748B' }}>No response <strong style={{ color: '#0F172A' }}>{lostReasons.noResp}</strong></span>
        </div>
        <span style={businzTagStyle}>{selectedPeriod}</span>
      </div>
    </div>
  );
}
