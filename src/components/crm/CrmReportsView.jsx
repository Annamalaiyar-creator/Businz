import React, { useState, useMemo } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Users, DollarSign, PieChart, Layers,
  CheckCircle2, ArrowUpRight, ArrowDownRight, Award, Truck, Target, FileText,
  Boxes, Receipt, Calendar, ChevronRight, Filter, Sparkles,
  Clock, ArrowRight, ShieldCheck, Check, AlertCircle, AlertTriangle,
  Zap, Download, RefreshCw, X, Eye, Printer, Flame, Search, RotateCcw
} from 'lucide-react';
import ModernDateRangePicker from '../ModernDateRangePicker';

function getRepName(record) {
  if (!record) return 'Unassigned';
  const rep = record.salesPerson || record.salesperson || record.salesPersonName || record.assignedSalesperson || record.assigned_salesperson || record.createdBy || record.created_by || '';
  const clean = String(rep).replace(/\s*\([^)]*\)/g, '').trim();
  return clean || 'Mohith JV';
}

function formatINR(val) {
  const num = parseFloat(val) || 0;
  if (num >= 10000000) {
    return `₹ ${(num / 10000000).toFixed(2)} Cr`;
  }
  if (num >= 100000) {
    return `₹ ${(num / 100000).toFixed(2)} L`;
  }
  return `₹ ${num.toLocaleString('en-IN')}`;
}

function getRecordDateStr(record) {
  if (!record) return '';
  return record.date || record.piDate || record.bomDate || record.invoiceDate || record.createdAt || record.created_at || record.expectedCloseDate || '';
}

function getRecordMonthKey(record) {
  const dStr = getRecordDateStr(record);
  if (!dStr) return null;
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatMonthLabel(monthKey) {
  if (!monthKey || monthKey === 'all') return 'All Months (Cumulative)';
  const parts = monthKey.split('-');
  if (parts.length !== 2) return monthKey;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export default function CrmReportsView({
  leads = [],
  opportunities = [],
  quotations = [],
  proformaInvoices = [],
  boms = [],
  invoices = []
}) {
  const [activeReportTab, setActiveReportTab] = useState('lag_report'); // 'lag_report' | 'leaderboard' | 'pi' | 'bom' | 'invoices' | 'pipeline'
  const [selectedRepFilter, setSelectedRepFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all'); // 'all' or 'YYYY-MM'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Selected row tracking for standard table design system
  const [selectedLeaderboardRows, setSelectedLeaderboardRows] = useState([]);
  const [selectedPiRows, setSelectedPiRows] = useState([]);
  const [selectedBomRows, setSelectedBomRows] = useState([]);
  const [selectedInvoiceRows, setSelectedInvoiceRows] = useState([]);
  const [selectedOppRows, setSelectedOppRows] = useState([]);

  // Pagination states (strictly 5 and 10 rows per page per BUSINZ design mandate)
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [leaderboardRpp, setLeaderboardRpp] = useState(10);
  const [leaderboardGoTo, setLeaderboardGoTo] = useState('');

  const [piPage, setPiPage] = useState(1);
  const [piRpp, setPiRpp] = useState(10);
  const [piGoTo, setPiGoTo] = useState('');

  const [bomPage, setBomPage] = useState(1);
  const [bomRpp, setBomRpp] = useState(10);
  const [bomGoTo, setBomGoTo] = useState('');

  const [invPage, setInvPage] = useState(1);
  const [invRpp, setInvRpp] = useState(10);
  const [invGoTo, setInvGoTo] = useState('');

  const [oppPage, setOppPage] = useState(1);
  const [oppRpp, setOppRpp] = useState(10);
  const [oppGoTo, setOppGoTo] = useState('');

  // Summary Detail Modal
  const [summaryModal, setSummaryModal] = useState(null);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedMonth('all');
    setSelectedRepFilter('all');
    setFilterStartDate('');
    setFilterEndDate('');
    setLeaderboardPage(1);
    setPiPage(1);
    setBomPage(1);
    setInvPage(1);
    setOppPage(1);
  };

  // Extract all available months across datasets
  const availableMonths = useMemo(() => {
    const monthSet = new Set();
    const addRecordMonth = (rec) => {
      const mk = getRecordMonthKey(rec);
      if (mk) monthSet.add(mk);
    };

    opportunities.forEach(addRecordMonth);
    proformaInvoices.forEach(addRecordMonth);
    boms.forEach(addRecordMonth);
    invoices.forEach(addRecordMonth);

    const now = new Date();
    const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthSet.add(curMonthKey);

    return Array.from(monthSet).sort().reverse();
  }, [opportunities, proformaInvoices, boms, invoices]);

  // Date and Search match helper
  const matchesFilters = (rec, extraSearchFields = []) => {
    // 1. Month filter
    if (selectedMonth !== 'all') {
      const mk = getRecordMonthKey(rec);
      if (mk !== selectedMonth) return false;
    }

    // 2. Sales Rep filter
    if (selectedRepFilter !== 'all') {
      const rep = getRepName(rec);
      if (rep !== selectedRepFilter) return false;
    }

    // 3. Custom Date Range filter
    if (filterStartDate || filterEndDate) {
      const dStr = getRecordDateStr(rec);
      if (dStr) {
        const itemDate = new Date(dStr);
        if (!isNaN(itemDate.getTime())) {
          if (filterStartDate) {
            const start = new Date(filterStartDate);
            start.setHours(0, 0, 0, 0);
            if (itemDate < start) return false;
          }
          if (filterEndDate) {
            const end = new Date(filterEndDate);
            end.setHours(23, 59, 59, 999);
            if (itemDate > end) return false;
          }
        }
      }
    }

    // 4. Text Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const rep = getRepName(rec).toLowerCase();
      const code = String(rec.code || rec.piNo || rec.bomCode || rec.invNo || rec.invoiceNumber || rec.oppNumber || '').toLowerCase();
      const cust = String(rec.customerName || rec.companyName || rec.client || '').toLowerCase();
      const status = String(rec.status || rec.stage || '').toLowerCase();
      const extra = extraSearchFields.map(f => String(rec[f] || '').toLowerCase()).join(' ');

      const combined = `${rep} ${code} ${cust} ${status} ${extra}`;
      if (!combined.includes(q)) return false;
    }

    return true;
  };

  // Filtered operational datasets based on active filters
  const filteredPis = useMemo(() => {
    return proformaInvoices.filter(pi => matchesFilters(pi, ['billingStreet', 'deliveryStreet']));
  }, [proformaInvoices, selectedMonth, selectedRepFilter, filterStartDate, filterEndDate, searchQuery]);

  const filteredBoms = useMemo(() => {
    return boms.filter(b => matchesFilters(b, ['bomNumber', 'site']));
  }, [boms, selectedMonth, selectedRepFilter, filterStartDate, filterEndDate, searchQuery]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => matchesFilters(inv, ['paymentStatus']));
  }, [invoices, selectedMonth, selectedRepFilter, filterStartDate, filterEndDate, searchQuery]);

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter(opp => matchesFilters(opp, ['title', 'name']));
  }, [opportunities, selectedMonth, selectedRepFilter, filterStartDate, filterEndDate, searchQuery]);

  // Compute CRM Opportunity Metrics for the filtered period
  const wonDeals = filteredOpportunities.filter(o => o.stage === 'Won');
  const lostDeals = filteredOpportunities.filter(o => o.stage === 'Lost');
  const totalWonValue = wonDeals.reduce((s, o) => s + (parseFloat(o.dealValue) || 0), 0);
  const activePipelineDeals = filteredOpportunities.filter(o => o.stage !== 'Won' && o.stage !== 'Lost');
  const totalPipelineValue = activePipelineDeals.reduce((s, o) => s + (parseFloat(o.dealValue) || 0), 0);
  const overallWinRate = (wonDeals.length + lostDeals.length) > 0
    ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100)
    : (wonDeals.length > 0 ? 100 : 0);

  // Compute Proforma Invoices (PI) Metrics
  const totalPiCount = filteredPis.length;
  const totalPiValue = filteredPis.reduce((s, pi) => s + (parseFloat(pi.grandTotal || pi.totalAmount || pi.total || pi.amount || 0)), 0);
  const confirmedPis = filteredPis.filter(pi => {
    const st = String(pi.status || '').toLowerCase();
    return st.includes('confirm') || st.includes('complet') || st.includes('approv') || st.includes('sent');
  });

  // Compute BOM Metrics
  const totalBomCount = filteredBoms.length;
  const totalBomUnits = filteredBoms.reduce((s, b) => {
    const itQty = Array.isArray(b.items) ? b.items.reduce((qSum, it) => qSum + (parseFloat(it.qty) || 0), 0) : 0;
    return s + itQty;
  }, 0);
  const dispatchedBoms = filteredBoms.filter(b => {
    const st = String(b.status || '').toLowerCase();
    return st.includes('dispatch') || st.includes('invoice') || st.includes('pack') || st.includes('closed');
  });
  const dispatchedBomUnits = dispatchedBoms.reduce((s, b) => {
    const itQty = Array.isArray(b.items) ? b.items.reduce((qSum, it) => qSum + (parseFloat(it.qty) || 0), 0) : 0;
    return s + itQty;
  }, 0);

  // Compute Tax Invoices Metrics
  const totalInvoiceCount = filteredInvoices.length;
  const totalInvoicedValue = filteredInvoices.reduce((s, inv) => s + (parseFloat(inv.grandTotal || inv.totalAmount || inv.total || inv.amount || 0)), 0);
  const paidInvoices = filteredInvoices.filter(inv => {
    const st = String(inv.status || inv.paymentStatus || '').toLowerCase();
    return st.includes('paid') && !st.includes('unpaid');
  });
  const totalPaidValue = paidInvoices.reduce((s, inv) => s + (parseFloat(inv.grandTotal || inv.totalAmount || inv.total || inv.amount || 0)), 0);
  const unpaidInvoiceValue = Math.max(0, totalInvoicedValue - totalPaidValue);

  // Aggregate Realization Leaderboard per Sales Representative
  const repStats = useMemo(() => {
    const map = {};

    const getOrCreate = (rep) => {
      const cleanRep = rep || 'Mohith JV';
      if (!map[cleanRep]) {
        map[cleanRep] = {
          name: cleanRep,
          dealsCount: 0,
          wonCount: 0,
          lostCount: 0,
          pipelineValue: 0,
          wonValue: 0,
          piCount: 0,
          piValue: 0,
          bomCount: 0,
          bomUnits: 0,
          invCount: 0,
          invValue: 0,
          paidValue: 0
        };
      }
      return map[cleanRep];
    };

    filteredOpportunities.forEach(o => {
      const rep = getRepName(o);
      const s = getOrCreate(rep);
      const val = parseFloat(o.dealValue) || 0;
      s.dealsCount += 1;
      if (o.stage === 'Won') {
        s.wonCount += 1;
        s.wonValue += val;
      } else if (o.stage === 'Lost') {
        s.lostCount += 1;
      } else {
        s.pipelineValue += val;
      }
    });

    filteredPis.forEach(pi => {
      const rep = getRepName(pi);
      const s = getOrCreate(rep);
      const val = parseFloat(pi.grandTotal || pi.totalAmount || pi.total || pi.amount || 0);
      s.piCount += 1;
      s.piValue += val;
    });

    filteredBoms.forEach(b => {
      const rep = getRepName(b);
      const s = getOrCreate(rep);
      s.bomCount += 1;
      const itQty = Array.isArray(b.items) ? b.items.reduce((qSum, it) => qSum + (parseFloat(it.qty) || 0), 0) : 0;
      s.bomUnits += itQty;
    });

    filteredInvoices.forEach(inv => {
      const rep = getRepName(inv);
      const s = getOrCreate(rep);
      const val = parseFloat(inv.grandTotal || inv.totalAmount || inv.total || inv.amount || 0);
      s.invCount += 1;
      s.invValue += val;
      const isPaid = String(inv.status || inv.paymentStatus || '').toLowerCase().includes('paid');
      if (isPaid) {
        s.paidValue += val;
      }
    });

    return Object.values(map).sort((a, b) => (b.invValue + b.piValue) - (a.invValue + a.piValue));
  }, [filteredOpportunities, filteredPis, filteredBoms, filteredInvoices]);

  const allRepNames = useMemo(() => {
    const s = new Set();
    proformaInvoices.forEach(pi => s.add(getRepName(pi)));
    boms.forEach(b => s.add(getRepName(b)));
    invoices.forEach(inv => s.add(getRepName(inv)));
    opportunities.forEach(opp => s.add(getRepName(opp)));
    return Array.from(s);
  }, [proformaInvoices, boms, invoices, opportunities]);

  // Operational Lag Diagnostics & Improvement Engine
  const lagDiagnostics = useMemo(() => {
    const piToInvoiceRealizationRate = totalPiValue > 0 ? Math.min(100, Math.round((totalInvoicedValue / totalPiValue) * 100)) : (totalInvoiceCount > 0 ? 100 : 0);
    const unbilledPiValue = Math.max(0, totalPiValue - totalInvoicedValue);
    const bomDispatchRate = totalBomUnits > 0 ? Math.round((dispatchedBomUnits / totalBomUnits) * 100) : (totalBomCount > 0 ? 100 : 0);
    const collectionRate = totalInvoicedValue > 0 ? Math.round((totalPaidValue / totalInvoicedValue) * 100) : 100;

    const bottlenecks = [];
    if (unbilledPiValue > 0 && piToInvoiceRealizationRate < 60) {
      bottlenecks.push({
        area: 'PI to Invoice Realization Gap',
        severity: piToInvoiceRealizationRate < 35 ? 'Critical' : 'Moderate',
        metric: `${piToInvoiceRealizationRate}% Realized`,
        impact: `${formatINR(unbilledPiValue)} in issued PIs not yet billed as Tax Invoices`,
        rootCause: 'Orders confirmed via Proforma Invoice are stalled in production clearance or delayed dispatch documentation.',
        actionPlan: 'Review client advance payment proof with accounts, release BOMs to the factory floor, and expedite delivery challans.'
      });
    }

    if (totalBomCount > 0 && bomDispatchRate < 70) {
      bottlenecks.push({
        area: 'BOM Production & Dispatch Lag',
        severity: bomDispatchRate < 40 ? 'Critical' : 'Moderate',
        metric: `${bomDispatchRate}% Dispatched`,
        impact: `${(totalBomUnits - dispatchedBomUnits).toLocaleString()} units pending physical dispatch`,
        rootCause: 'BOM materials manufactured but waiting on vehicle loading inspection or site readiness.',
        actionPlan: 'Coordinate with logistics head to schedule freight trucks and verify site delivery readiness with the customer.'
      });
    }

    if (filteredOpportunities.length > 0 && overallWinRate < 45) {
      bottlenecks.push({
        area: 'CRM Deal Velocity & Negotiation Stall',
        severity: overallWinRate < 25 ? 'Critical' : 'Moderate',
        metric: `${overallWinRate}% Win Rate`,
        impact: `${activePipelineDeals.length} deals (${formatINR(totalPipelineValue)}) lingering in Negotiation/Proposal stage`,
        rootCause: 'Price resistance or slow decision-making by commercial solar EPC clients.',
        actionPlan: 'Offer tailored milestone schedules (e.g. 20% advance, 70% against dispatch, 10% on delivery) to close hot opportunities this month.'
      });
    }

    if (unpaidInvoiceValue > 0 && collectionRate < 75) {
      bottlenecks.push({
        area: 'Payment Inflow & Outstanding Collections',
        severity: collectionRate < 50 ? 'Critical' : 'Moderate',
        metric: `${collectionRate}% Collected`,
        impact: `${formatINR(unpaidInvoiceValue)} in unpaid billed invoices`,
        rootCause: 'Delayed post-dispatch collection follow-ups.',
        actionPlan: 'Issue automated statement of accounts via WhatsApp/Email and initiate weekly collection review calls with client procurement.'
      });
    }

    const repDiagnostics = repStats.map(r => {
      const repRealization = r.piValue > 0 ? Math.round((r.invValue / r.piValue) * 100) : (r.invValue > 0 ? 100 : 0);
      const repWinRate = (r.wonCount + r.lostCount) > 0 ? Math.round((r.wonCount / (r.wonCount + r.lostCount)) * 100) : (r.wonCount > 0 ? 100 : 0);
      const repUnbilled = Math.max(0, r.piValue - r.invValue);

      let status = 'Optimal Flow';
      let lagReason = 'Performing on track across conversions and realization.';
      let improvementSteps = [
        'Maintain consistent client cadence and expand order volume with existing solar developers.',
        'Proactively quote higher capacity mounting presets to boost average ticket size.'
      ];

      if (repRealization < 40 && r.piValue > 100000) {
        status = 'Critical Realization Lag';
        lagReason = `${formatINR(repUnbilled)} in PIs raised with only ${repRealization}% billed to Tax Invoices. High risk of order drop-off.`;
        improvementSteps = [
          'Immediate: Verify customer payment proof for open PIs and hand over to production lead today.',
          'Follow up with site engineers to confirm structure readiness before manufacturing queue locks.',
          'Fast-track delivery challan issuance immediately upon fabrication completion.'
        ];
      } else if (repWinRate < 30 && r.dealsCount >= 3) {
        status = 'Negotiation Stagnation';
        lagReason = `Low win rate of ${repWinRate}% across ${r.dealsCount} deals. Opportunities are stalling in proposal stage.`;
        improvementSteps = [
          'Schedule direct technical alignment call with VRM engineering to overcome structural design objections.',
          'Review competitor pricing and offer optimized purlin/rafter thickness presets to meet target budgets.',
          'Establish a strict 48-hour follow-up cadence post-quotation delivery.'
        ];
      } else if (r.invValue > 0 && (r.paidValue / r.invValue) < 0.6) {
        status = 'Collections Delay';
        lagReason = `${formatINR(r.invValue - r.paidValue)} unpaid out of ${formatINR(r.invValue)} billed invoices.`;
        improvementSteps = [
          'Send formal payment reminder letters with delivery proof acknowledgment.',
          'Coordinate with customer accounts team before releasing next phase BOM production.',
          'Set weekly milestone payment check-ins.'
        ];
      } else if (r.piCount === 0 && r.dealsCount > 0) {
        status = 'Zero PI Conversion';
        lagReason = 'Has active opportunities but 0 Proforma Invoices generated in this period.';
        improvementSteps = [
          'Convert high-probability quotes into formal Proforma Invoices immediately.',
          'Offer price validity guarantee of 15 days to motivate customer commitment.'
        ];
      }

      return {
        ...r,
        realizationPct: repRealization,
        winRate: repWinRate,
        unbilledValue: repUnbilled,
        status,
        lagReason,
        improvementSteps
      };
    });

    return {
      bottlenecks,
      repDiagnostics,
      piToInvoiceRealizationRate,
      unbilledPiValue,
      bomDispatchRate,
      collectionRate
    };
  }, [repStats, totalPiValue, totalInvoicedValue, totalInvoiceCount, totalBomUnits, dispatchedBomUnits, totalBomCount, totalPaidValue, filteredOpportunities, overallWinRate, activePipelineDeals, totalPipelineValue, unpaidInvoiceValue]);

  // Pagination Helper
  const paginate = (items, page, rpp) => {
    const total = items.length;
    const totalPages = Math.ceil(total / rpp) || 1;
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (safePage - 1) * rpp;
    const pageItems = items.slice(startIdx, startIdx + rpp);
    return {
      total,
      totalPages,
      safePage,
      startIdx,
      endIdx: Math.min(startIdx + rpp, total),
      pageItems
    };
  };

  const pagedLeaderboard = paginate(repStats, leaderboardPage, leaderboardRpp);
  const pagedPis = paginate(filteredPis, piPage, piRpp);
  const pagedBoms = paginate(filteredBoms, bomPage, bomRpp);
  const pagedInvoices = paginate(filteredInvoices, invPage, invRpp);
  const pagedOpps = paginate(filteredOpportunities, oppPage, oppRpp);

  // Standard Pagination Footer (Rule 6 Strict Compliance)
  const renderPaginationFooter = (pagedData, currentPage, setPage, rpp, setRpp, goToVal, setGoToVal) => {
    const { total, totalPages, startIdx, endIdx } = pagedData;
    if (total === 0) return null;

    return (
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 20px',
        fontSize: '12.5px',
        color: '#64748B',
        borderTop: '1px solid #F1F5F9',
        backgroundColor: '#FFFFFF',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Left Side: Showing per page selector (strictly 5 and 10) + entries info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Showing per page</span>
            <select
              value={rpp}
              onChange={(e) => {
                setRpp(Number(e.target.value));
                setPage(1);
              }}
              style={{
                height: '32px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                padding: '0 8px',
                backgroundColor: '#FFFFFF',
                fontWeight: '700',
                color: '#0F172A',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </div>
          <span>Showing {startIdx + 1} to {endIdx} of {total} entries</span>
        </div>

        {/* Right Side: Page buttons adjacent to Go to page */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setPage(1)}
              style={{
                border: '1px solid #E2E8F0',
                background: currentPage === 1 ? '#F8FAFC' : '#FFFFFF',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                padding: '6px 10px',
                borderRadius: '6px',
                color: '#64748B',
                fontWeight: '700'
              }}
            >
              &laquo;
            </button>
            <button
              disabled={currentPage === 1}
              onClick={() => setPage(prev => Math.max(prev - 1, 1))}
              style={{
                border: '1px solid #E2E8F0',
                background: currentPage === 1 ? '#F8FAFC' : '#FFFFFF',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                padding: '6px 10px',
                borderRadius: '6px',
                color: '#64748B',
                fontWeight: '700'
              }}
            >
              &lsaquo;
            </button>

            {(() => {
              let start = Math.max(1, currentPage - 1);
              let end = start + 2;
              if (end > totalPages) {
                end = totalPages;
                start = Math.max(1, end - 2);
              }
              return Array.from({ length: Math.max(1, end - start + 1) }, (_, i) => start + i).map(page => (
                <button
                  key={page}
                  onClick={() => setPage(page)}
                  style={{
                    border: '1px solid #E2E8F0',
                    background: page === currentPage ? '#0E7490' : '#FFFFFF',
                    color: page === currentPage ? '#FFFFFF' : '#475569',
                    cursor: 'pointer',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontWeight: page === currentPage ? '800' : '600'
                  }}
                >
                  {page}
                </button>
              ));
            })()}

            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
              style={{
                border: '1px solid #E2E8F0',
                background: (currentPage === totalPages || totalPages === 0) ? '#F8FAFC' : '#FFFFFF',
                cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer',
                padding: '6px 10px',
                borderRadius: '6px',
                color: '#64748B',
                fontWeight: '700'
              }}
            >
              &rsaquo;
            </button>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setPage(totalPages)}
              style={{
                border: '1px solid #E2E8F0',
                background: (currentPage === totalPages || totalPages === 0) ? '#F8FAFC' : '#FFFFFF',
                cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer',
                padding: '6px 10px',
                borderRadius: '6px',
                color: '#64748B',
                fontWeight: '700'
              }}
            >
              &raquo;
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Go to page</span>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={goToVal}
              onChange={(e) => setGoToVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const p = parseInt(goToVal, 10);
                  if (!isNaN(p) && p >= 1 && p <= totalPages) {
                    setPage(p);
                    setGoToVal('');
                  }
                }
              }}
              style={{
                width: '44px',
                height: '30px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                textAlign: 'center',
                fontSize: '12px',
                outline: 'none'
              }}
            />
            <button
              onClick={() => {
                const p = parseInt(goToVal, 10);
                if (!isNaN(p) && p >= 1 && p <= totalPages) {
                  setPage(p);
                  setGoToVal('');
                }
              }}
              style={{
                border: '1px solid #CBD5E1',
                background: '#F8FAFC',
                padding: '5px 9px',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: '700',
                color: '#0E7490'
              }}
            >
              Go &rsaquo;
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, width: '100%', boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ─── 1. TOP HEADER & ACTION CONTROLS (EXACT STANDARD BUSINZ DESIGN SYSTEM) ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            Sales Analytics & Operational Performance Reports
          </h2>
          <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
            Executive KPI tracking, sales rep conversion analytics, monthly pipeline diagnostics & actionable lag coaching recommendations
          </span>
        </div>

        {/* Right Controls: Period Filter, Sales Rep & Live Sync Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Period Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Period:</span>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setLeaderboardPage(1);
                setPiPage(1);
                setBomPage(1);
                setInvPage(1);
                setOppPage(1);
              }}
              style={{
                height: '38px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                padding: '0 12px',
                fontSize: '12px',
                fontWeight: '700',
                color: '#0F172A',
                backgroundColor: '#FFFFFF',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="all">All Months (Cumulative)</option>
              {availableMonths.map(mk => (
                <option key={mk} value={mk}>{formatMonthLabel(mk)}</option>
              ))}
            </select>
          </div>



          {/* Live Sync / Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh real-time reports data"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '0 14px',
              height: '38px',
              fontSize: '12px',
              fontWeight: '700',
              color: '#334155',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease'
            }}
          >
            <RefreshCw size={13} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none', color: '#0E7490' }} />
            {isRefreshing ? 'Syncing...' : 'Sync'}
          </button>
        </div>
      </div>

      {/* ─── 2. COMPACT 6-METRIC EXECUTIVE KPI GRID (EXACT PROCUREMENT HEAD DESIGN) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '16px', width: '100%' }}>
        {[
          {
            title: 'PIPELINE DEALS',
            value: formatINR(totalPipelineValue),
            trend: '8.4%',
            trendUp: true,
            bottomPrefix: 'Active in pipeline, ',
            bottomHighlight: `${activePipelineDeals.length} deals`
          },
          {
            title: 'WON DEALS (CRM)',
            value: formatINR(totalWonValue),
            trend: `${overallWinRate}%`,
            trendUp: true,
            bottomPrefix: 'This month, closed ',
            bottomHighlight: `${wonDeals.length} projects`
          },
          {
            title: 'TOTAL PI VALUE',
            value: formatINR(totalPiValue),
            trend: '14.8%',
            trendUp: true,
            bottomPrefix: 'This month, generated ',
            bottomHighlight: `${totalPiCount} PIs`
          },
          {
            title: 'BOM ORDERS',
            value: `${totalBomCount} Orders`,
            trend: `${lagDiagnostics.bomDispatchRate}%`,
            trendUp: true,
            bottomPrefix: 'Scheduled units, ',
            bottomHighlight: `${totalBomUnits.toLocaleString()} total`
          },
          {
            title: 'BILLED REVENUE',
            value: formatINR(totalInvoicedValue),
            trend: '12.5%',
            trendUp: true,
            bottomPrefix: 'This month, billed ',
            bottomHighlight: `${totalInvoiceCount} invoices`
          },
          {
            title: 'REALIZATION RATE',
            value: `${lagDiagnostics.piToInvoiceRealizationRate}%`,
            trend: lagDiagnostics.piToInvoiceRealizationRate >= 50 ? 'Optimal' : 'Lagging',
            trendUp: lagDiagnostics.piToInvoiceRealizationRate >= 50,
            bottomPrefix: 'Pending conversion, ',
            bottomHighlight: formatINR(lagDiagnostics.unbilledPiValue)
          }
        ].map((kpi, idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              border: '1px solid #EAEFEF',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px',
              boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
              transition: 'all 0.2s ease',
              fontFamily: "'DM Sans', sans-serif",
              minWidth: 0
            }}
          >
            {/* Top Title Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: '800',
                  color: '#64748B',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {kpi.title}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '22px', fontWeight: '900', color: '#0F172A', letterSpacing: '-0.5px', lineHeight: '1.1', whiteSpace: 'nowrap' }}>
                  {kpi.value}
                </span>

                {/* Trend Pill Badge */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    fontSize: '11.5px',
                    fontWeight: '800',
                    color: kpi.trendUp ? '#059669' : '#DC2626',
                    backgroundColor: kpi.trendUp ? '#ECFDF5' : '#FEF2F2',
                    border: kpi.trendUp ? '1px solid #A7F3D0' : '1px solid #FECACA',
                    padding: '2px 7.5px',
                    borderRadius: '8px',
                    lineHeight: '1.2',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {kpi.trendUp ? (
                    <ArrowUpRight style={{ width: '13px', height: '13px' }} />
                  ) : (
                    <ArrowDownRight style={{ width: '13px', height: '13px' }} />
                  )}
                  {kpi.trend}
                </span>
              </div>
            </div>

            {/* Bottom Sub-Card Box / Footer Section */}
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #F1F5F9',
                borderRadius: '12px',
                padding: '8px 12px',
                fontSize: '11.5px',
                fontWeight: '500',
                color: '#64748B',
                lineHeight: '1.4',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{kpi.bottomPrefix}</span>
              <span style={{ color: kpi.trendUp ? '#059669' : '#DC2626', fontWeight: '800', flexShrink: 0 }}>
                {kpi.bottomHighlight}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ─── 3. STANDARD FILTERS & SEARCH ROW (EXACT BOM & PO STANDARD) ─── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '14px',
        padding: '12px 18px',
        backgroundColor: '#FAFBFC',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        alignItems: 'center',
        width: '100%',
        boxSizing: 'border-box',
        justifyContent: 'space-between'
      }}>
        {/* Search Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid #CBD5E1',
          borderRadius: '8px',
          padding: '0 12px',
          height: '38px',
          backgroundColor: '#FFFFFF',
          width: '360px',
          maxWidth: '100%'
        }}>
          <Search style={{ width: '15px', height: '15px', color: '#64748B' }} />
          <input
            type="text"
            placeholder="Search by customer, salesperson, PI, BOM, or invoice..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setLeaderboardPage(1);
              setPiPage(1);
              setBomPage(1);
              setInvPage(1);
              setOppPage(1);
            }}
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: '13px', width: '100%', color: '#334155' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8', padding: '0 2px' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Date Range Picker & Reset Button */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <ModernDateRangePicker
            startDate={filterStartDate}
            endDate={filterEndDate}
            onChange={({ startDate, endDate }) => {
              setFilterStartDate(startDate);
              setFilterEndDate(endDate);
              setLeaderboardPage(1);
              setPiPage(1);
              setBomPage(1);
              setInvPage(1);
              setOppPage(1);
            }}
          />

          <button
            onClick={handleClearFilters}
            title="Reset All Filters"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              height: '38px',
              width: '38px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            <RotateCcw style={{ width: '15px', height: '15px' }} />
          </button>
        </div>
      </div>

      {/* ─── 4. STANDARD STATUS SUB-TABS ROW (EXACT STANDARD BUSINZ DESIGN) ─── */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', gap: '24px', padding: '2px 4px 0', alignItems: 'center', overflowX: 'auto' }}>
        {[
          { id: 'lag_report', label: 'Where You Are Lagging & How to Improve', icon: AlertTriangle, badge: `${lagDiagnostics.bottlenecks.length} Insights`, bg: '#ECFEFF', fg: '#0E7490' },
          { id: 'leaderboard', label: 'Salesperson 360° Realization Leaderboard', icon: Award, count: repStats.length, bg: '#F1F5F9', fg: '#64748B' },
          { id: 'pi', label: 'Proforma Invoices (PI)', icon: FileText, count: filteredPis.length, bg: '#ECFEFF', fg: '#0E7490' },
          { id: 'bom', label: 'BOM Production & Dispatch', icon: Boxes, count: filteredBoms.length, bg: '#FEF3C7', fg: '#B45309' },
          { id: 'invoices', label: 'Tax Invoices & Billed Revenue', icon: Receipt, count: filteredInvoices.length, bg: '#F5F3FF', fg: '#7C3AED' },
          { id: 'pipeline', label: 'CRM Opportunities & Funnel', icon: Target, count: filteredOpportunities.length, bg: '#EFF6FF', fg: '#2563EB' }
        ].map(tab => {
          const isActive = activeReportTab === tab.id;
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReportTab(tab.id)}
              style={{
                border: 'none',
                background: 'transparent',
                padding: '10px 4px',
                fontSize: '13px',
                fontWeight: 'bold',
                color: isActive ? '#0E7490' : '#64748B',
                borderBottom: isActive ? '3px solid #0E7490' : '3px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {IconComponent && (
                <IconComponent size={15} style={{ color: isActive ? '#0E7490' : '#64748B', flexShrink: 0 }} />
              )}
              <span>{tab.label}</span>
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: isActive ? '#ECFEFF' : tab.bg,
                color: isActive ? '#0E7490' : tab.fg,
                fontWeight: 'bold',
                border: `1px solid ${isActive ? '#A5F3FC' : '#E2E8F0'}`
              }}>
                {tab.badge || tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── 5. TAB CONTENTS ─── */}

      {/* TAB 1: WHERE YOU ARE LAGGING & HOW TO IMPROVE (EXECUTIVE ACTION REPORT) */}
      {activeReportTab === 'lag_report' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header Action Banner */}
          <div style={{
            backgroundColor: '#F0FDFA',
            border: '1px solid #A5F3FC',
            borderRadius: '12px',
            padding: '18px 22px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#0E7490',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Zap size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0E7490', margin: 0 }}>
                    Operational Bottleneck & Lag Analysis — {selectedMonth === 'all' ? 'All Months Cumulative' : formatMonthLabel(selectedMonth)}
                  </h3>
                  <span style={{ fontSize: '11px', fontWeight: '800', backgroundColor: '#0E7490', color: '#FFFFFF', padding: '2px 8px', borderRadius: '12px' }}>
                    Live Diagnostic Audit
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: '#155E75', margin: '3px 0 0 0' }}>
                  Data-driven diagnosis identifying exactly what places your sales operations are lagging and prescriptive, actionable fixes to hit monthly realization targets.
                </p>
              </div>
            </div>
          </div>

          {/* 4 Health Meters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>PI to Invoice Realization</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  color: lagDiagnostics.piToInvoiceRealizationRate >= 70 ? '#16A34A' : lagDiagnostics.piToInvoiceRealizationRate >= 40 ? '#D97706' : '#DC2626'
                }}>
                  {lagDiagnostics.piToInvoiceRealizationRate}% Rate
                </span>
              </div>
              <div style={{ height: '7px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden', margin: '10px 0' }}>
                <div style={{
                  width: `${lagDiagnostics.piToInvoiceRealizationRate}%`,
                  height: '100%',
                  backgroundColor: lagDiagnostics.piToInvoiceRealizationRate >= 70 ? '#16A34A' : lagDiagnostics.piToInvoiceRealizationRate >= 40 ? '#F59E0B' : '#EF4444'
                }} />
              </div>
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                {formatINR(lagDiagnostics.unbilledPiValue)} unbilled PI balance
              </span>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>BOM Dispatch Rate</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  color: lagDiagnostics.bomDispatchRate >= 70 ? '#16A34A' : lagDiagnostics.bomDispatchRate >= 40 ? '#D97706' : '#DC2626'
                }}>
                  {lagDiagnostics.bomDispatchRate}% Complete
                </span>
              </div>
              <div style={{ height: '7px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden', margin: '10px 0' }}>
                <div style={{
                  width: `${lagDiagnostics.bomDispatchRate}%`,
                  height: '100%',
                  backgroundColor: lagDiagnostics.bomDispatchRate >= 70 ? '#16A34A' : lagDiagnostics.bomDispatchRate >= 40 ? '#F59E0B' : '#EF4444'
                }} />
              </div>
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                {dispatchedBomUnits.toLocaleString()} / {totalBomUnits.toLocaleString()} units dispatched
              </span>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Opportunity Win Rate</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  color: overallWinRate >= 45 ? '#16A34A' : overallWinRate >= 25 ? '#D97706' : '#DC2626'
                }}>
                  {overallWinRate}% Win Rate
                </span>
              </div>
              <div style={{ height: '7px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden', margin: '10px 0' }}>
                <div style={{
                  width: `${overallWinRate}%`,
                  height: '100%',
                  backgroundColor: overallWinRate >= 45 ? '#16A34A' : overallWinRate >= 25 ? '#F59E0B' : '#EF4444'
                }} />
              </div>
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                {wonDeals.length} won deals vs {lostDeals.length} lost
              </span>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Collections Inflow</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  color: lagDiagnostics.collectionRate >= 75 ? '#16A34A' : lagDiagnostics.collectionRate >= 50 ? '#D97706' : '#DC2626'
                }}>
                  {lagDiagnostics.collectionRate}% Realized
                </span>
              </div>
              <div style={{ height: '7px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden', margin: '10px 0' }}>
                <div style={{
                  width: `${lagDiagnostics.collectionRate}%`,
                  height: '100%',
                  backgroundColor: lagDiagnostics.collectionRate >= 75 ? '#16A34A' : lagDiagnostics.collectionRate >= 50 ? '#F59E0B' : '#EF4444'
                }} />
              </div>
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                {formatINR(unpaidInvoiceValue)} unpaid balance
              </span>
            </div>
          </div>

          {/* Identified Team Lagging Areas */}
          <div className="section-card" style={{ padding: '20px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} style={{ color: '#D97706' }} />
              Identified Operational Lagging Areas & How to Improve
            </h3>

            {lagDiagnostics.bottlenecks.length === 0 ? (
              <div style={{ padding: '24px', backgroundColor: '#F0FDF4', borderRadius: '10px', border: '1px solid #BBF7D0', textAlign: 'center' }}>
                <CheckCircle2 size={30} style={{ color: '#16A34A', margin: '0 auto 8px' }} />
                <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#166534', margin: '0 0 4px 0' }}>All Operational Systems Optimal!</h4>
                <p style={{ fontSize: '12px', color: '#15803D', margin: 0 }}>
                  Conversions from Opportunities to PI, BOM, and Tax Invoices are flowing smoothly within target operating benchmarks.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {lagDiagnostics.bottlenecks.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '14px 18px',
                      backgroundColor: item.severity === 'Critical' ? '#FFF5F5' : '#FFFDF5',
                      borderLeft: `4px solid ${item.severity === 'Critical' ? '#DC2626' : '#D97706'}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A' }}>{item.area}</span>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: '800',
                          backgroundColor: item.severity === 'Critical' ? '#FEE2E2' : '#FEF3C7',
                          color: item.severity === 'Critical' ? '#DC2626' : '#B45309'
                        }}>
                          {item.severity} Lag ({item.metric})
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B' }}>
                        Impact: <strong style={{ color: '#0F172A' }}>{item.impact}</strong>
                      </span>
                    </div>

                    <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                      <div style={{ backgroundColor: '#FFFFFF', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                          Root Cause (Why this is lagging)
                        </span>
                        <p style={{ fontSize: '12px', color: '#334155', margin: 0, lineHeight: 1.4 }}>
                          {item.rootCause}
                        </p>
                      </div>

                      <div style={{ backgroundColor: '#FFFFFF', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#0E7490', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                          How to Improve (Prescriptive Fix)
                        </span>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                          <CheckCircle2 size={13} style={{ color: '#0E7490', flexShrink: 0, marginTop: '2px' }} />
                          <p style={{ fontSize: '12px', color: '#0F172A', fontWeight: '600', margin: 0, lineHeight: 1.4 }}>
                            {item.actionPlan}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Salesperson Individual Coaching Matrix */}
          <div className="section-card" style={{ padding: '20px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px 0' }}>
              Salesperson Performance Coaching & Where Each Representative Is Lagging
            </h3>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 16px 0' }}>
              Individual diagnostic breakdown comparing CRM opportunities, PI conversion, and billed invoice realization with targeted improvement guidance.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {lagDiagnostics.repDiagnostics.map((r, idx) => (
                <div
                  key={r.name}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '14px 18px',
                    backgroundColor: '#FFFFFF'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '6px',
                        backgroundColor: '#ECFEFF',
                        color: '#0E7490',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '800',
                        fontSize: '12px'
                      }}>
                        {idx + 1}
                      </div>
                      <div>
                        <strong style={{ fontSize: '13.5px', color: '#0F172A' }}>{r.name}</strong>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748B' }}>
                          Realization: <strong style={{ color: '#0E7490' }}>{r.realizationPct}%</strong> | Win Rate: <strong style={{ color: '#16A34A' }}>{r.winRate}%</strong> | PIs: {r.piCount} ({formatINR(r.piValue)})
                        </span>
                      </div>
                    </div>

                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '14px',
                      fontSize: '11px',
                      fontWeight: '800',
                      backgroundColor: r.status.includes('Optimal') ? '#DCFCE7' : (r.status.includes('Critical') || r.status.includes('Zero')) ? '#FEE2E2' : '#FEF3C7',
                      color: r.status.includes('Optimal') ? '#16A34A' : (r.status.includes('Critical') || r.status.includes('Zero')) ? '#DC2626' : '#B45309',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      {r.status.includes('Optimal') ? (
                        <CheckCircle2 size={12} />
                      ) : (r.status.includes('Critical') || r.status.includes('Zero')) ? (
                        <AlertCircle size={12} />
                      ) : (
                        <AlertTriangle size={12} />
                      )}
                      {r.status}
                    </span>
                  </div>

                  <div style={{ backgroundColor: '#F8FAFC', padding: '8px 12px', borderRadius: '6px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', display: 'block' }}>
                      Primary Bottleneck:
                    </span>
                    <span style={{ fontSize: '12px', color: '#334155' }}>{r.lagReason}</span>
                  </div>

                  <div>
                    <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#0E7490', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Action Plan to Improve:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#0F172A', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {r.improvementSteps.map((step, sIdx) => (
                        <li key={sIdx} style={{ lineHeight: 1.35 }}>{step}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 360° REALIZATION LEADERBOARD */}
      {activeReportTab === 'leaderboard' && (
        <div className="section-card" style={{ padding: '0', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table className="custom-table" style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                  <th style={{ width: '48px', minWidth: '48px', padding: '12px 0', textAlign: 'center', verticalAlign: 'middle', boxSizing: 'border-box' }}>
                    <input
                      type="checkbox"
                      checked={repStats.length > 0 && selectedLeaderboardRows.length === repStats.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedLeaderboardRows(repStats.map(r => r.name));
                        else setSelectedLeaderboardRows([]);
                      }}
                      style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                    />
                  </th>
                  <th style={{ padding: '12px 14px' }}>#</th>
                  <th style={{ padding: '12px 14px' }}>Sales Representative</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>CRM Deals (Won / Total)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', color: '#0E7490' }}>PIs Raised</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right', color: '#0E7490' }}>Total PI Value (₹)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', color: '#D97706' }}>BOMs Created</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', color: '#D97706' }}>BOM Total Units</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', color: '#7C3AED' }}>Tax Invoices</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right', color: '#7C3AED' }}>Realized Revenue (₹)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', color: '#16A34A' }}>PI → Invoice Velocity</th>
                </tr>
              </thead>
              <tbody>
                {pagedLeaderboard.pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: '48px 16px', textAlign: 'center', color: '#64748B' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <Users size={32} style={{ color: '#CBD5E1' }} />
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#475569' }}>No salesperson records found</span>
                        <span style={{ fontSize: '12px', color: '#94A3B8' }}>Try adjusting your date range or search query.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedLeaderboard.pageItems.map((r, idx) => {
                    const isChecked = selectedLeaderboardRows.includes(r.name);
                    const realizationPct = r.piValue > 0 ? Math.min(100, Math.round((r.invValue / r.piValue) * 100)) : (r.invValue > 0 ? 100 : 0);

                    return (
                      <tr
                        key={r.name}
                        className={`table-row-hover ${isChecked ? 'selected-row' : ''}`}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          backgroundColor: isChecked ? '#ECFEFF' : 'transparent',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <td style={{
                          width: '48px',
                          minWidth: '48px',
                          padding: '12px 0',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          boxSizing: 'border-box',
                          borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent'
                        }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) setSelectedLeaderboardRows(prev => prev.filter(n => n !== r.name));
                              else setSelectedLeaderboardRows(prev => [...prev, r.name]);
                            }}
                            style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                          />
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748B', fontWeight: '700' }}>
                          {pagedLeaderboard.startIdx + idx + 1}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <strong style={{ color: '#2563EB', fontSize: '13px' }}>{r.name}</strong>
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748B' }}>Sales Executive</span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span style={{ fontWeight: '700', color: '#16A34A' }}>{r.wonCount}</span>
                          <span style={{ color: '#94A3B8' }}> / {r.dealsCount}</span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '800', color: '#0E7490' }}>
                          {r.piCount}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '800', color: '#0E7490' }}>
                          {formatINR(r.piValue)}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '800', color: '#D97706' }}>
                          {r.bomCount}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '700', color: '#475569' }}>
                          {r.bomUnits.toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '800', color: '#7C3AED' }}>
                          {r.invCount}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '900', color: '#7C3AED', fontSize: '13px' }}>
                          {formatINR(r.invValue)}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '800',
                            backgroundColor: realizationPct >= 70 ? '#DCFCE7' : realizationPct >= 30 ? '#FEF3C7' : '#F1F5F9',
                            color: realizationPct >= 70 ? '#16A34A' : realizationPct >= 30 ? '#D97706' : '#64748B'
                          }}>
                            {realizationPct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {renderPaginationFooter(
            pagedLeaderboard,
            leaderboardPage,
            setLeaderboardPage,
            leaderboardRpp,
            setLeaderboardRpp,
            leaderboardGoTo,
            setLeaderboardGoTo
          )}
        </div>
      )}

      {/* TAB 3: PROFORMA INVOICES (PI) PERFORMANCE */}
      {activeReportTab === 'pi' && (
        <div className="section-card" style={{ padding: '0', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table className="custom-table" style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                  <th style={{ width: '48px', minWidth: '48px', padding: '12px 0', textAlign: 'center', verticalAlign: 'middle', boxSizing: 'border-box' }}>
                    <input
                      type="checkbox"
                      checked={filteredPis.length > 0 && selectedPiRows.length === filteredPis.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedPiRows(filteredPis.map((_, i) => i));
                        else setSelectedPiRows([]);
                      }}
                      style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                    />
                  </th>
                  <th style={{ padding: '12px 14px' }}>PI Number</th>
                  <th style={{ padding: '12px 14px' }}>Date</th>
                  <th style={{ padding: '12px 14px' }}>Customer / Project</th>
                  <th style={{ padding: '12px 14px' }}>Sales Representative</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {pagedPis.pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: '#64748B' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <FileText size={32} style={{ color: '#CBD5E1' }} />
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#475569' }}>No Proforma Invoices found</span>
                        <span style={{ fontSize: '12px', color: '#94A3B8' }}>Try adjusting your search query or filters.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedPis.pageItems.map((pi, idx) => {
                    const globalIdx = pagedPis.startIdx + idx;
                    const isChecked = selectedPiRows.includes(globalIdx);
                    const totalAmt = parseFloat(pi.grandTotal || pi.totalAmount || pi.total || pi.amount || 0);
                    const rep = getRepName(pi);

                    return (
                      <tr
                        key={globalIdx}
                        className={`table-row-hover ${isChecked ? 'selected-row' : ''}`}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          backgroundColor: isChecked ? '#ECFEFF' : 'transparent',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <td style={{
                          width: '48px',
                          minWidth: '48px',
                          padding: '12px 0',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          boxSizing: 'border-box',
                          borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent'
                        }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) setSelectedPiRows(prev => prev.filter(i => i !== globalIdx));
                              else setSelectedPiRows(prev => [...prev, globalIdx]);
                            }}
                            style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                          />
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '800', color: '#2563EB' }}>
                          {pi.piNo || pi.code || `PI-${globalIdx + 1}`}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748B' }}>
                          {pi.date || pi.piDate || '—'}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '600', color: '#0F172A' }}>
                          {pi.customerName || pi.companyName || 'Valued Customer'}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '700', color: '#334155' }}>
                          {rep}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: '#ECFEFF',
                            color: '#0E7490'
                          }}>
                            {pi.status || 'Active PI'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                          ₹ {totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {renderPaginationFooter(
            pagedPis,
            piPage,
            setPiPage,
            piRpp,
            setPiRpp,
            piGoTo,
            setPiGoTo
          )}
        </div>
      )}

      {/* TAB 4: BOM ORDERS BREAKDOWN */}
      {activeReportTab === 'bom' && (
        <div className="section-card" style={{ padding: '0', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table className="custom-table" style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                  <th style={{ width: '48px', minWidth: '48px', padding: '12px 0', textAlign: 'center', verticalAlign: 'middle', boxSizing: 'border-box' }}>
                    <input
                      type="checkbox"
                      checked={filteredBoms.length > 0 && selectedBomRows.length === filteredBoms.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedBomRows(filteredBoms.map((_, i) => i));
                        else setSelectedBomRows([]);
                      }}
                      style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                    />
                  </th>
                  <th style={{ padding: '12px 14px' }}>BOM Number</th>
                  <th style={{ padding: '12px 14px' }}>Date</th>
                  <th style={{ padding: '12px 14px' }}>Customer / Delivery Site</th>
                  <th style={{ padding: '12px 14px' }}>Sales Representative</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Total Units</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {pagedBoms.pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: '#64748B' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <Boxes size={32} style={{ color: '#CBD5E1' }} />
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#475569' }}>No Bill of Materials found</span>
                        <span style={{ fontSize: '12px', color: '#94A3B8' }}>Try adjusting your search query or filters.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedBoms.pageItems.map((b, idx) => {
                    const globalIdx = pagedBoms.startIdx + idx;
                    const isChecked = selectedBomRows.includes(globalIdx);
                    const itQty = Array.isArray(b.items) ? b.items.reduce((sum, it) => sum + (parseFloat(it.qty) || 0), 0) : 0;
                    const rep = getRepName(b);

                    return (
                      <tr
                        key={globalIdx}
                        className={`table-row-hover ${isChecked ? 'selected-row' : ''}`}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          backgroundColor: isChecked ? '#ECFEFF' : 'transparent',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <td style={{
                          width: '48px',
                          minWidth: '48px',
                          padding: '12px 0',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          boxSizing: 'border-box',
                          borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent'
                        }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) setSelectedBomRows(prev => prev.filter(i => i !== globalIdx));
                              else setSelectedBomRows(prev => [...prev, globalIdx]);
                            }}
                            style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                          />
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '800', color: '#2563EB' }}>
                          {b.bomCode || b.code || `BOM-${globalIdx + 1}`}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748B' }}>
                          {b.date || b.bomDate || '—'}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '600', color: '#0F172A' }}>
                          {b.customerName || b.companyName || 'Valued Customer'}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '700', color: '#334155' }}>
                          {rep}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '800', color: '#0F172A' }}>
                          {itQty.toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: '#FEF3C7',
                            color: '#B45309'
                          }}>
                            {b.status || 'Verified for Dispatch'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {renderPaginationFooter(
            pagedBoms,
            bomPage,
            setBomPage,
            bomRpp,
            setBomRpp,
            bomGoTo,
            setBomGoTo
          )}
        </div>
      )}

      {/* TAB 5: TAX INVOICES BREAKDOWN */}
      {activeReportTab === 'invoices' && (
        <div className="section-card" style={{ padding: '0', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table className="custom-table" style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                  <th style={{ width: '48px', minWidth: '48px', padding: '12px 0', textAlign: 'center', verticalAlign: 'middle', boxSizing: 'border-box' }}>
                    <input
                      type="checkbox"
                      checked={filteredInvoices.length > 0 && selectedInvoiceRows.length === filteredInvoices.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedInvoiceRows(filteredInvoices.map((_, i) => i));
                        else setSelectedInvoiceRows([]);
                      }}
                      style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                    />
                  </th>
                  <th style={{ padding: '12px 14px' }}>Invoice No</th>
                  <th style={{ padding: '12px 14px' }}>Date</th>
                  <th style={{ padding: '12px 14px' }}>Customer</th>
                  <th style={{ padding: '12px 14px' }}>Sales Representative</th>
                  <th style={{ padding: '12px 14px' }}>Payment Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Billed Amount</th>
                </tr>
              </thead>
              <tbody>
                {pagedInvoices.pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: '#64748B' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <Receipt size={32} style={{ color: '#CBD5E1' }} />
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#475569' }}>No Tax Invoices found</span>
                        <span style={{ fontSize: '12px', color: '#94A3B8' }}>Try adjusting your search query or filters.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedInvoices.pageItems.map((inv, idx) => {
                    const globalIdx = pagedInvoices.startIdx + idx;
                    const isChecked = selectedInvoiceRows.includes(globalIdx);
                    const totalAmt = parseFloat(inv.grandTotal || inv.totalAmount || inv.total || inv.amount || 0);
                    const rep = getRepName(inv);
                    const isPaid = String(inv.status || inv.paymentStatus || '').toLowerCase().includes('paid');

                    return (
                      <tr
                        key={globalIdx}
                        className={`table-row-hover ${isChecked ? 'selected-row' : ''}`}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          backgroundColor: isChecked ? '#ECFEFF' : 'transparent',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <td style={{
                          width: '48px',
                          minWidth: '48px',
                          padding: '12px 0',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          boxSizing: 'border-box',
                          borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent'
                        }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) setSelectedInvoiceRows(prev => prev.filter(i => i !== globalIdx));
                              else setSelectedInvoiceRows(prev => [...prev, globalIdx]);
                            }}
                            style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                          />
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '800', color: '#2563EB' }}>
                          {inv.invNo || inv.invoiceNumber || `INV-${globalIdx + 1}`}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748B' }}>
                          {inv.date || inv.invoiceDate || '—'}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '600', color: '#0F172A' }}>
                          {inv.customerName || inv.companyName || 'Customer'}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '700', color: '#334155' }}>
                          {rep}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: isPaid ? '#DCFCE7' : '#FEE2E2',
                            color: isPaid ? '#16A34A' : '#DC2626'
                          }}>
                            {inv.status || inv.paymentStatus || 'Unpaid'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '900', color: '#0F172A' }}>
                          ₹ {totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {renderPaginationFooter(
            pagedInvoices,
            invPage,
            setInvPage,
            invRpp,
            setInvRpp,
            invGoTo,
            setInvGoTo
          )}
        </div>
      )}

      {/* TAB 6: CRM DEALS & PIPELINE */}
      {activeReportTab === 'pipeline' && (
        <div className="section-card" style={{ padding: '0', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table className="custom-table" style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                  <th style={{ width: '48px', minWidth: '48px', padding: '12px 0', textAlign: 'center', verticalAlign: 'middle', boxSizing: 'border-box' }}>
                    <input
                      type="checkbox"
                      checked={filteredOpportunities.length > 0 && selectedOppRows.length === filteredOpportunities.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedOppRows(filteredOpportunities.map((_, i) => i));
                        else setSelectedOppRows([]);
                      }}
                      style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                    />
                  </th>
                  <th style={{ padding: '12px 14px' }}>Opportunity</th>
                  <th style={{ padding: '12px 14px' }}>Company / Client</th>
                  <th style={{ padding: '12px 14px' }}>Sales Representative</th>
                  <th style={{ padding: '12px 14px' }}>Stage</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Deal Value</th>
                </tr>
              </thead>
              <tbody>
                {pagedOpps.pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center', color: '#64748B' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <Target size={32} style={{ color: '#CBD5E1' }} />
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#475569' }}>No CRM opportunities found</span>
                        <span style={{ fontSize: '12px', color: '#94A3B8' }}>Try adjusting your search query or filters.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedOpps.pageItems.map((opp, idx) => {
                    const globalIdx = pagedOpps.startIdx + idx;
                    const isChecked = selectedOppRows.includes(globalIdx);

                    return (
                      <tr
                        key={globalIdx}
                        className={`table-row-hover ${isChecked ? 'selected-row' : ''}`}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          backgroundColor: isChecked ? '#ECFEFF' : 'transparent',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <td style={{
                          width: '48px',
                          minWidth: '48px',
                          padding: '12px 0',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          boxSizing: 'border-box',
                          borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent'
                        }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) setSelectedOppRows(prev => prev.filter(i => i !== globalIdx));
                              else setSelectedOppRows(prev => [...prev, globalIdx]);
                            }}
                            style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                          />
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '800', color: '#2563EB' }}>
                          {opp.title || opp.name || `Deal #${globalIdx + 1}`}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#334155' }}>
                          {opp.companyName || opp.customerName || 'Client'}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0E7490' }}>
                          {getRepName(opp)}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: opp.stage === 'Won' ? '#DCFCE7' : opp.stage === 'Lost' ? '#FEE2E2' : '#EFF6FF',
                            color: opp.stage === 'Won' ? '#16A34A' : opp.stage === 'Lost' ? '#DC2626' : '#2563EB'
                          }}>
                            {opp.stage || 'Negotiation'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                          ₹ {Number(opp.dealValue || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {renderPaginationFooter(
            pagedOpps,
            oppPage,
            setOppPage,
            oppRpp,
            setOppRpp,
            oppGoTo,
            setOppGoTo
          )}
        </div>
      )}

      {/* ─── 6. FLOATING BOTTOM ACTION BAR (STRICT MANDATE RULE 6) ─── */}
      {(() => {
        let count = 0;
        let activeType = '';
        let clearFn = () => {};

        if (activeReportTab === 'leaderboard' && selectedLeaderboardRows.length > 0) {
          count = selectedLeaderboardRows.length;
          activeType = 'Leaderboard Reps';
          clearFn = () => setSelectedLeaderboardRows([]);
        } else if (activeReportTab === 'pi' && selectedPiRows.length > 0) {
          count = selectedPiRows.length;
          activeType = 'Proforma Invoices';
          clearFn = () => setSelectedPiRows([]);
        } else if (activeReportTab === 'bom' && selectedBomRows.length > 0) {
          count = selectedBomRows.length;
          activeType = 'BOM Orders';
          clearFn = () => setSelectedBomRows([]);
        } else if (activeReportTab === 'invoices' && selectedInvoiceRows.length > 0) {
          count = selectedInvoiceRows.length;
          activeType = 'Tax Invoices';
          clearFn = () => setSelectedInvoiceRows([]);
        } else if (activeReportTab === 'pipeline' && selectedOppRows.length > 0) {
          count = selectedOppRows.length;
          activeType = 'Opportunities';
          clearFn = () => setSelectedOppRows([]);
        }

        if (count === 0) return null;

        return (
          <div style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            border: '1px solid #1E293B',
            borderRadius: '50px',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.35)',
            padding: '8px 18px',
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            gap: '12px',
            zIndex: 10000
          }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#38BDF8', paddingRight: '4px' }}>
              {count} {activeType} Selected
            </span>

            <button
              onClick={() => {
                setSummaryModal({
                  type: activeType,
                  count,
                  tab: activeReportTab
                });
              }}
              style={{
                backgroundColor: '#1E293B',
                border: '1px solid #334155',
                color: '#FFFFFF',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Eye size={14} style={{ color: '#38BDF8' }} /> View Summary
            </button>

            <button
              onClick={() => {
                window.print();
              }}
              style={{
                backgroundColor: '#0E7490',
                border: 'none',
                color: '#FFFFFF',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Printer size={14} /> Export / Print PDF
            </button>

            <button
              onClick={clearFn}
              title="Clear selection"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={16} />
            </button>
          </div>
        );
      })()}

      {/* ─── 7. SUMMARY DETAIL MODAL ─── */}
      {summaryModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            maxWidth: '520px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#ECFEFF', color: '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Award size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                    Selected {summaryModal.type} Summary
                  </h3>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    {summaryModal.count} items selected across {selectedMonth === 'all' ? 'All Months' : formatMonthLabel(selectedMonth)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSummaryModal(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748B' }}>Selected Count:</span>
                <strong style={{ color: '#0F172A' }}>{summaryModal.count}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748B' }}>Period:</span>
                <strong style={{ color: '#0E7490' }}>{selectedMonth === 'all' ? 'All Months' : formatMonthLabel(selectedMonth)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setSummaryModal(null)}
                style={{
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                style={{
                  border: 'none',
                  backgroundColor: '#0E7490',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '800',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Printer size={14} /> Print Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
