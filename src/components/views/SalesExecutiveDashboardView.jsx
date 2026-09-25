import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowUpRight, Clock, Sparkles, RefreshCw,
  Edit3, X, Check, Eye, ArrowUpDown, Plus, CheckCircle, Flame
} from 'lucide-react';
import { fetchCloudStore } from '../../utils/supabaseDataSync';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

// Safe numeric amount parser
function parseAmt(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).trim();
  if (str.includes('Cr')) {
    const num = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
    return num * 10000000;
  }
  if (str.includes('L') || str.includes('Lakh')) {
    const num = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
    return num * 100000;
  }
  const clean = str.replace(/[^0-9.]/g, '');
  return parseFloat(clean) || 0;
}

// Indian Lakhs and Crores formatter
function formatLakhsCr(amt) {
  const num = Number(amt) || 0;
  if (num >= 10000000) {
    return `₹ ${(num / 10000000).toFixed(2)} Cr`;
  }
  if (num >= 100000) {
    return `₹ ${(num / 100000).toFixed(1)} L`;
  }
  if (num === 0) return '₹ 0.00';
  return `₹ ${Math.round(num).toLocaleString('en-IN')}`;
}

// Helper to determine if a date falls in the selected period
function isDateInPeriod(dateVal, period) {
  if (!dateVal) return true;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return true;
  const now = new Date();

  if (period === 'This Month') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (period === 'Last Month') {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
  }
  if (period === 'This Quarter') {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const dateQuarter = Math.floor(d.getMonth() / 3);
    return currentQuarter === dateQuarter && d.getFullYear() === now.getFullYear();
  }
  if (period === 'Financial Year (YTD)') {
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStartDate = new Date(fyStartYear, 3, 1);
    return d >= fyStartDate && d <= now;
  }
  return true;
}

// Categorize items by product line
function categorizeProduct(item) {
  const text = `${item.name || ''} ${item.description || ''} ${item.code || ''} ${item.category || ''} ${item.structure || ''} ${item.productCategory || ''}`.toLowerCase();
  if (text.includes('profile') || text.includes('aluminium') || text.includes('channel') || text.includes('extrusion') || text.includes('rail')) {
    return 'Aluminium Profiles';
  }
  if (text.includes('bos') || text.includes('fastener') || text.includes('bolt') || text.includes('nut') || text.includes('hardware') || text.includes('kit')) {
    return 'BOS Kits';
  }
  if (text.includes('walkway') || text.includes('handrail') || text.includes('grating') || text.includes('ladder')) {
    return 'Walkway / Handrail';
  }
  if (text.includes('clamp') || text.includes('accessory') || text.includes('bracket') || text.includes('cable') || text.includes('tie') || text.includes('earthing')) {
    return 'Accessories';
  }
  return 'Solar Structures';
}

export default function SalesExecutiveDashboardView({ userRole = 'Sales Executive', onNavigateTab }) {
  // Live Collection States
  const [quotations, setQuotations] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [leads, setLeads] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [proformaInvoices, setProformaInvoices] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [boms, setBoms] = useState([]);
  const [isZohoConnected, setIsZohoConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));

  // Filter States
  const [selectedExecutive, setSelectedExecutive] = useState('All');
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');

  // Table interactive selection states
  const [selectedFollowups, setSelectedFollowups] = useState([]);
  const [followupPage, setFollowupPage] = useState(1);
  const [followupRowsPerPage, setFollowupRowsPerPage] = useState(5);
  const [followupGoTo, setFollowupGoTo] = useState('');

  // Outstanding table pagination
  const [outstandingPage, setOutstandingPage] = useState(1);
  const [outstandingRowsPerPage, setOutstandingRowsPerPage] = useState(5);

  // Hover states
  const [hoveredTrendMonth, setHoveredTrendMonth] = useState(null);

  // Authoritative real-time data loader
  const loadSalesData = useCallback(async () => {
    try {
      // 1. Fetch Zoho connection status
      fetchWithTimeout('/api/zoho/status', { timeout: 3000 })
        .then(r => r.json())
        .then(st => {
          if (st && st.connected !== undefined) setIsZohoConnected(Boolean(st.connected));
        })
        .catch(() => setIsZohoConnected(false));

      // 2. Fetch all collections in parallel from authoritative cloud stores with timeout protection
      const [
        cloudQuotes,
        cloudOpps,
        cloudLeads,
        cloudFollowups,
        cloudSalesPis,
        cloudProformaPis,
        cloudInvoices,
        cloudCustomers,
        liveBoms
      ] = await Promise.all([
        fetchCloudStore('crm_quotations', []).catch(() => []),
        fetchCloudStore('crm_opportunities', []).catch(() => []),
        fetchCloudStore('crm_leads', []).catch(() => []),
        fetchCloudStore('crm_followups', []).catch(() => []),
        fetchCloudStore('sales_pi_store', []).catch(() => []),
        fetchCloudStore('proforma_invoice_store', []).catch(() => []),
        fetchWithTimeout('/api/zoho/invoices', { timeout: 8000 })
          .then(r => r.json())
          .then(j => Array.isArray(j) ? j : (Array.isArray(j?.data) ? j.data : (j ? [j] : [])))
          .catch(() => fetchCloudStore('invoice_store', [])),
        fetchWithTimeout('/api/zoho/customers', { timeout: 8000 })
          .then(r => r.json())
          .then(j => Array.isArray(j) ? j : (Array.isArray(j?.data) ? j.data : []))
          .catch(() => fetchCloudStore('customer_store', [])),
        fetchWithTimeout('/api/boms', { timeout: 5000 })
          .then(r => r.json())
          .then(j => Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []))
          .catch(() => [])
      ]);

      // 3. Merge with local storage caches for zero-data-loss protection
      const getCached = (key) => {
        try {
          const val = localStorage.getItem(key);
          return val ? JSON.parse(val) : null;
        } catch { return null; }
      };

      // Merge Quotations
      const localQuotes = getCached('controlroom_crm_quotations') || getCached('quotations_store') || [];
      const quoteMap = new Map();
      (Array.isArray(cloudQuotes) ? cloudQuotes : []).forEach(q => {
        const id = q.quoteNumber || q.id || q.code;
        if (id) quoteMap.set(String(id).trim().toLowerCase(), q);
      });
      (Array.isArray(localQuotes) ? localQuotes : []).forEach(q => {
        const id = q.quoteNumber || q.id || q.code;
        if (id && !quoteMap.has(String(id).trim().toLowerCase())) {
          quoteMap.set(String(id).trim().toLowerCase(), q);
        }
      });
      const unifiedQuotes = Array.from(quoteMap.values());
      setQuotations(unifiedQuotes);

      // Merge Opportunities
      const localOpps = getCached('controlroom_crm_opportunities') || [];
      const oppMap = new Map();
      (Array.isArray(cloudOpps) ? cloudOpps : []).forEach(o => {
        const id = o.oppNumber || o.id;
        if (id) oppMap.set(String(id).trim().toLowerCase(), o);
      });
      (Array.isArray(localOpps) ? localOpps : []).forEach(o => {
        const id = o.oppNumber || o.id;
        if (id && !oppMap.has(String(id).trim().toLowerCase())) {
          oppMap.set(String(id).trim().toLowerCase(), o);
        }
      });
      const unifiedOpps = Array.from(oppMap.values());
      setOpportunities(unifiedOpps);

      // Merge Leads
      const localLeads = getCached('controlroom_crm_leads') || [];
      const leadMap = new Map();
      (Array.isArray(cloudLeads) ? cloudLeads : []).forEach(l => {
        const id = l.leadNumber || l.id;
        if (id) leadMap.set(String(id).trim().toLowerCase(), l);
      });
      (Array.isArray(localLeads) ? localLeads : []).forEach(l => {
        const id = l.leadNumber || l.id;
        if (id && !leadMap.has(String(id).trim().toLowerCase())) {
          leadMap.set(String(id).trim().toLowerCase(), l);
        }
      });
      setLeads(Array.from(leadMap.values()));

      // Merge Followups
      const localFollowups = getCached('controlroom_crm_followups') || [];
      const followupMap = new Map();
      (Array.isArray(cloudFollowups) ? cloudFollowups : []).forEach(f => {
        const id = f.id;
        if (id) followupMap.set(String(id).trim().toLowerCase(), f);
      });
      (Array.isArray(localFollowups) ? localFollowups : []).forEach(f => {
        const id = f.id;
        if (id && !followupMap.has(String(id).trim().toLowerCase())) {
          followupMap.set(String(id).trim().toLowerCase(), f);
        }
      });
      setFollowups(Array.from(followupMap.values()));

      // Merge Proforma Invoices (sales_pi_store & proforma_invoice_store)
      const localPis = getCached('controlroom_sales_pi_store') || getCached('sales_pi_store') || getCached('proforma_invoice_store') || [];
      const piMap = new Map();
      [...(Array.isArray(cloudSalesPis) ? cloudSalesPis : []), ...(Array.isArray(cloudProformaPis) ? cloudProformaPis : []), ...(Array.isArray(localPis) ? localPis : [])].forEach(p => {
        const id = p?.piNo || p?.id || p?.estimate_number;
        if (id) {
          const k = String(id).trim().toLowerCase();
          if (!piMap.has(k)) piMap.set(k, p);
        }
      });
      setProformaInvoices(Array.from(piMap.values()));

      // Merge Invoices
      const localInvoices = getCached('controlroom_invoice_store') || [];
      const invMap = new Map();
      [...(Array.isArray(cloudInvoices) ? cloudInvoices : []), ...(Array.isArray(localInvoices) ? localInvoices : [])].forEach(inv => {
        const id = inv?.invNo || inv?.invoiceNo || inv?.invoiceNumber || inv?.id;
        if (id) {
          const k = String(id).trim().toLowerCase();
          if (!invMap.has(k)) invMap.set(k, inv);
        }
      });
      setInvoices(Array.from(invMap.values()));

      // Merge Customers
      const localCustomers = getCached('controlroom_customer_store') || getCached('controlroom_crm_customers') || [];
      const custMap = new Map();
      [...(Array.isArray(cloudCustomers) ? cloudCustomers : []), ...(Array.isArray(localCustomers) ? localCustomers : [])].forEach(c => {
        const id = c?.customerCode || c?.id || c?.zohoContactId || c?.customerName;
        if (id) {
          const k = String(id).trim().toLowerCase();
          if (!custMap.has(k)) custMap.set(k, c);
        }
      });
      setCustomers(Array.from(custMap.values()));

      // BOMs
      const localBoms = getCached('controlroom_bom_store') || [];
      const bomMap = new Map();
      [...(Array.isArray(liveBoms) ? liveBoms : []), ...(Array.isArray(localBoms) ? localBoms : [])].forEach(b => {
        const id = b?.bomCode || b?.code || b?.id;
        if (id) {
          const k = String(id).trim().toLowerCase();
          if (!bomMap.has(k)) bomMap.set(k, b);
        }
      });
      setBoms(Array.from(bomMap.values()));

      setLastSyncedTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('[SalesExecutiveDashboard] Error loading live sales data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load and live real-time auto-synchronization
  useEffect(() => {
    loadSalesData();

    const handleSync = () => loadSalesData();
    window.addEventListener('controlroom_storage_update', handleSync);
    window.addEventListener('controlroom_crm_updated', handleSync);
    window.addEventListener('controlroom_pi_updated', handleSync);
    window.addEventListener('controlroom_invoice_updated', handleSync);
    window.addEventListener('controlroom_bom_store_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('controlroom_storage_update', handleSync);
      window.removeEventListener('controlroom_crm_updated', handleSync);
      window.removeEventListener('controlroom_pi_updated', handleSync);
      window.removeEventListener('controlroom_invoice_updated', handleSync);
      window.removeEventListener('controlroom_bom_store_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [loadSalesData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadSalesData();
  };

  // Extract distinct dynamic list of sales executives from real data
  const availableExecutives = useMemo(() => {
    const names = new Set();
    const addName = (n) => {
      if (n && typeof n === 'string' && n.trim() && n.trim() !== '—' && n.trim() !== 'Customer' && n.trim() !== 'Sales Rep') {
        names.add(n.trim());
      }
    };
    opportunities.forEach(o => addName(o.assignedSalesperson || o.salesperson));
    quotations.forEach(q => addName(q.salesperson || q.salesRep || q.salesPerson));
    proformaInvoices.forEach(p => addName(p.salesPerson || p.salesPersonName));
    customers.forEach(c => addName(c.assignedSalesperson || c.salesPerson));

    const loggedName = localStorage.getItem('controlroom_logged_user_name');
    if (loggedName) addName(loggedName);

    // Default core reps if dataset is empty
    if (names.size === 0) {
      addName('Mohith J V');
      addName('Vijay');
      addName('Sanjai Kumar');
      addName('Kalaiselvi T');
    }

    return ['All', ...Array.from(names)];
  }, [opportunities, quotations, proformaInvoices, customers]);

  // Executive matching filter helper
  const matchesExecutive = useCallback((repName) => {
    if (selectedExecutive === 'All') return true;
    if (!repName) return false;
    const target = selectedExecutive.toLowerCase().trim();
    const cur = String(repName).toLowerCase().trim();
    return cur.includes(target) || target.includes(cur);
  }, [selectedExecutive]);

  // Filtered collections by Executive and Period
  const filteredQuotations = useMemo(() => {
    return quotations.filter(q => {
      const rep = q.salesperson || q.salesRep || q.salesPerson || '';
      if (!matchesExecutive(rep)) return false;
      const d = q.date || q.createdAt;
      return isDateInPeriod(d, selectedPeriod);
    });
  }, [quotations, matchesExecutive, selectedPeriod]);

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter(o => {
      const rep = o.assignedSalesperson || o.salesperson || '';
      if (!matchesExecutive(rep)) return false;
      const d = o.createdAt || o.targetCloseDate || o.expectedClosingDate;
      return isDateInPeriod(d, selectedPeriod);
    });
  }, [opportunities, matchesExecutive, selectedPeriod]);

  const filteredPis = useMemo(() => {
    return proformaInvoices.filter(p => {
      const rep = p.salesPerson || p.salesPersonName || '';
      if (!matchesExecutive(rep)) return false;
      const d = p.date || p.piDate || p.createdAt;
      return isDateInPeriod(d, selectedPeriod);
    });
  }, [proformaInvoices, matchesExecutive, selectedPeriod]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const d = inv.date || inv.invoiceDate || inv.createdAt;
      return isDateInPeriod(d, selectedPeriod);
    });
  }, [invoices, selectedPeriod]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const rep = l.assignedSalesperson || '';
      if (!matchesExecutive(rep)) return false;
      const d = l.createdAt;
      return isDateInPeriod(d, selectedPeriod);
    });
  }, [leads, matchesExecutive, selectedPeriod]);

  // Computed Real KPIs
  const totalQuotesValue = useMemo(() => {
    return filteredQuotations.reduce((sum, q) => sum + parseAmt(q.grandTotal || q.total || q.amount || q.subtotal), 0);
  }, [filteredQuotations]);

  const totalPiValue = useMemo(() => {
    return filteredPis.reduce((sum, p) => sum + parseAmt(p.total || p.grandTotal || p.invAmt || p.amount), 0);
  }, [filteredPis]);

  const totalInvoicedValue = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + parseAmt(inv.total || inv.invAmt || inv.amount), 0);
  }, [filteredInvoices]);

  const totalCollections = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => {
      const total = parseAmt(inv.total || inv.invAmt || inv.amount);
      const balance = parseAmt(inv.balance !== undefined ? inv.balance : 0);
      return sum + Math.max(0, total - balance);
    }, 0);
  }, [filteredInvoices]);

  const realizedPercent = useMemo(() => {
    if (totalInvoicedValue <= 0) return 0;
    return Math.min(100, Math.round((totalCollections / totalInvoicedValue) * 100));
  }, [totalCollections, totalInvoicedValue]);

  const wonDeals = useMemo(() => {
    return filteredOpportunities.filter(o => o.stage === 'Won');
  }, [filteredOpportunities]);

  const wonDealsValue = useMemo(() => {
    return wonDeals.reduce((sum, o) => sum + parseAmt(o.dealValue), 0);
  }, [wonDeals]);

  // Conversion rate (Deals Won vs Total Pipeline or Offers vs Invoices)
  const conversionRate = useMemo(() => {
    if (filteredQuotations.length > 0) {
      const rate = (filteredInvoices.length / filteredQuotations.length) * 100;
      return rate > 100 ? 100 : Math.round(rate * 10) / 10;
    }
    if (filteredOpportunities.length > 0) {
      return Math.round((wonDeals.length / filteredOpportunities.length) * 100 * 10) / 10;
    }
    return 0;
  }, [filteredQuotations, filteredInvoices, filteredOpportunities, wonDeals]);

  // Month Target Progress calculations
  // Default target is ₹ 75.0 L (75,00,000) or scaled by total pipeline if larger
  const monthlyTargetNum = useMemo(() => {
    const defaultBaseline = 7500000;
    const pipelineEstimate = filteredOpportunities.reduce((s, o) => s + parseAmt(o.dealValue), 0);
    return Math.max(defaultBaseline, pipelineEstimate > defaultBaseline ? Math.round(pipelineEstimate * 0.8) : defaultBaseline);
  }, [filteredOpportunities]);

  const targetAchievedVal = useMemo(() => {
    return totalInvoicedValue + (wonDealsValue > 0 ? wonDealsValue : 0);
  }, [totalInvoicedValue, wonDealsValue]);

  const targetAchievedPct = useMemo(() => {
    if (monthlyTargetNum <= 0) return 0;
    return Math.min(100, Math.round((targetAchievedVal / monthlyTargetNum) * 100));
  }, [targetAchievedVal, monthlyTargetNum]);

  const targetBalanceVal = useMemo(() => {
    return Math.max(0, monthlyTargetNum - targetAchievedVal);
  }, [monthlyTargetNum, targetAchievedVal]);

  const now = new Date();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingWorkingDays = Math.max(1, lastDayOfMonth - now.getDate());
  const requiredDailySales = targetBalanceVal > 0 ? targetBalanceVal / remainingWorkingDays : 0;

  // Real Sales Funnel 4-Tier Breakdown
  const funnelData = useMemo(() => {
    const offersCount = filteredQuotations.length;
    const offersVal = totalQuotesValue;

    const qualifiedOpps = filteredOpportunities.filter(o => o.stage !== 'New Lead' && o.stage !== 'Contacted' && o.stage !== 'Lost');
    const qualifiedVal = qualifiedOpps.reduce((s, o) => s + parseAmt(o.dealValue), 0);

    const piCount = filteredPis.length;
    const piVal = totalPiValue;

    const invCount = filteredInvoices.length;
    const invVal = totalInvoicedValue;

    const maxVal = Math.max(offersVal, qualifiedVal, piVal, invVal, 100000);

    return [
      {
        label: 'OFFERS',
        count: `${offersCount} Deals`,
        value: formatLakhsCr(offersVal),
        pct: '100%',
        barColor: '#8B5CF6',
        width: '100%'
      },
      {
        label: 'QUALIFIED',
        count: `${qualifiedOpps.length} Deals`,
        value: formatLakhsCr(qualifiedVal),
        pct: `${offersVal > 0 ? Math.round((qualifiedVal / offersVal) * 100) : 0}%`,
        barColor: '#EC4899',
        width: `${Math.max(30, Math.min(100, Math.round((qualifiedVal / maxVal) * 100)))}%`
      },
      {
        label: 'PROFORMA INVOICES',
        count: `${piCount} Deals`,
        value: formatLakhsCr(piVal),
        pct: `${offersVal > 0 ? Math.round((piVal / offersVal) * 100) : 0}%`,
        barColor: '#0284C7',
        width: `${Math.max(25, Math.min(100, Math.round((piVal / maxVal) * 100)))}%`
      },
      {
        label: 'INVOICED',
        count: `${invCount} Deals`,
        value: formatLakhsCr(invVal),
        pct: `${offersVal > 0 ? Math.round((invVal / offersVal) * 100) : 0}%`,
        barColor: '#16A34A',
        width: `${Math.max(20, Math.min(100, Math.round((invVal / maxVal) * 100)))}%`
      }
    ];
  }, [filteredQuotations, totalQuotesValue, filteredOpportunities, filteredPis, totalPiValue, filteredInvoices, totalInvoicedValue]);

  // Real Monthly Sales Trend (Last 7 Months)
  const monthlyTrendData = useMemo(() => {
    const today = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const months = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      months.push({
        month: monthNames[d.getMonth()],
        monthIdx: d.getMonth(),
        year: d.getFullYear(),
        actual: 0
      });
    }

    // Populate actual sales from invoices and proforma invoices
    invoices.forEach(inv => {
      const invDate = new Date(inv.date || inv.invoiceDate || inv.createdAt);
      if (!isNaN(invDate.getTime())) {
        const found = months.find(m => m.monthIdx === invDate.getMonth() && m.year === invDate.getFullYear());
        if (found) {
          found.actual += parseAmt(inv.total || inv.invAmt || inv.amount);
        }
      }
    });

    proformaInvoices.forEach(pi => {
      const piDate = new Date(pi.date || pi.piDate || pi.createdAt);
      if (!isNaN(piDate.getTime())) {
        const found = months.find(m => m.monthIdx === piDate.getMonth() && m.year === piDate.getFullYear());
        if (found) {
          found.actual += (parseAmt(pi.total || pi.grandTotal) * 0.4); // partial weighting for trend
        }
      }
    });

    return months.map(m => {
      const valLakhs = Math.round((m.actual / 100000) * 10) / 10;
      return {
        month: m.month,
        actual: valLakhs
      };
    });
  }, [invoices, proformaInvoices]);

  const maxTrendLakhs = useMemo(() => {
    const maxVal = Math.max(...monthlyTrendData.map(d => d.actual), 50);
    return Math.ceil(maxVal / 20) * 20;
  }, [monthlyTrendData]);

  // Real Product Performance Distribution
  const productPerformance = useMemo(() => {
    const catMap = {
      'Solar Structures': 0,
      'Aluminium Profiles': 0,
      'BOS Kits': 0,
      'Walkway / Handrail': 0,
      'Accessories': 0
    };

    // Analyze line items from invoices
    invoices.forEach(inv => {
      if (Array.isArray(inv.items)) {
        inv.items.forEach(it => {
          const cat = categorizeProduct(it);
          const amt = parseAmt(it.amount || it.total || (it.qty * it.rate));
          if (catMap[cat] !== undefined) catMap[cat] += amt;
        });
      } else {
        const amt = parseAmt(inv.total || inv.invAmt);
        catMap['Solar Structures'] += amt;
      }
    });

    // Analyze line items from PIs
    proformaInvoices.forEach(pi => {
      const items = pi.items || pi.lineItems;
      if (Array.isArray(items)) {
        items.forEach(it => {
          const cat = categorizeProduct(it);
          const amt = parseAmt(it.amount || it.total || (it.qty * it.rate));
          if (catMap[cat] !== undefined) catMap[cat] += (amt * 0.5);
        });
      }
    });

    boms.forEach(b => {
      const amt = parseAmt(b.total || b.amount || b.grandTotal);
      if (amt > 0) catMap['Solar Structures'] += (amt * 0.3);
    });

    const entries = Object.entries(catMap).map(([name, totalAmt]) => {
      const valLakhs = Math.round((totalAmt / 100000) * 10) / 10;
      return {
        name,
        actual: valLakhs,
        actualStr: formatLakhsCr(totalAmt)
      };
    });

    return entries.sort((a, b) => b.actual - a.actual);
  }, [invoices, proformaInvoices, boms]);

  const maxProductVal = useMemo(() => {
    return Math.max(...productPerformance.map(p => p.actual), 10);
  }, [productPerformance]);

  // Real Top 10 Customers by actual sales value
  const topCustomers = useMemo(() => {
    const custMap = new Map();

    invoices.forEach(inv => {
      const name = inv.customerName || inv.vendor || inv.customerId || 'Customer';
      const cur = custMap.get(name) || 0;
      custMap.set(name, cur + parseAmt(inv.total || inv.invAmt || inv.amount));
    });

    proformaInvoices.forEach(pi => {
      const name = pi.customerName || pi.customer || pi.companyName || 'Customer';
      const cur = custMap.get(name) || 0;
      custMap.set(name, cur + parseAmt(pi.total || pi.grandTotal));
    });

    quotations.forEach(q => {
      const name = q.customerName || q.companyName || q.customer || 'Customer';
      if (!custMap.has(name)) custMap.set(name, parseAmt(q.grandTotal || q.total) * 0.2);
    });

    const totalSalesAll = Array.from(custMap.values()).reduce((s, v) => s + v, 0);

    const sorted = Array.from(custMap.entries())
      .filter(([_, val]) => val > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return sorted.map(([name, val], idx) => {
      const share = totalSalesAll > 0 ? ((val / totalSalesAll) * 100).toFixed(1) + '%' : '0%';
      return {
        rank: String(idx + 1).padStart(2, '0'),
        name,
        valNum: val,
        value: formatLakhsCr(val),
        share
      };
    });
  }, [invoices, proformaInvoices, quotations]);

  const top10TotalVal = useMemo(() => {
    return topCustomers.reduce((s, c) => s + c.valNum, 0);
  }, [topCustomers]);

  // Real Follow-up and Live Opportunities Dataset
  const realFollowupsData = useMemo(() => {
    const list = [];

    // Opportunities in active negotiation
    filteredOpportunities
      .filter(o => o.stage !== 'Won' && o.stage !== 'Lost')
      .forEach(o => {
        const ageDays = o.createdAt
          ? Math.max(1, Math.floor((new Date() - new Date(o.createdAt)) / (1000 * 60 * 60 * 24)))
          : 5;
        list.push({
          id: o.id || o.oppNumber,
          customer: o.customerName || o.companyName || 'Active Customer',
          offerValue: formatLakhsCr(parseAmt(o.dealValue)),
          nextFollowup: o.nextFollowup || (o.expectedClosingDate ? new Date(o.expectedClosingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Scheduled Today'),
          stage: o.stage || 'Negotiation',
          age: `${ageDays} days`,
          priority: o.priority || (parseAmt(o.dealValue) >= 500000 ? 'HIGH' : 'MEDIUM')
        });
      });

    // CRM Follow-ups
    followups
      .filter(f => f.status !== 'Completed')
      .forEach(f => {
        if (!list.some(item => item.id === f.id || item.customer === f.customerName)) {
          list.push({
            id: f.id,
            customer: f.customerName || 'Inquiry Contact',
            offerValue: f.dealValue ? formatLakhsCr(parseAmt(f.dealValue)) : '₹ 4.5 L',
            nextFollowup: f.date ? `${f.date} ${f.time || ''}` : 'Today, 2:30 PM',
            stage: f.activityType || 'Follow-up',
            age: '3 days',
            priority: f.priority || 'HIGH'
          });
        }
      });

    // If list is small, supplement with recent quotes
    if (list.length === 0) {
      filteredQuotations.forEach(q => {
        list.push({
          id: q.quoteNumber || q.id,
          customer: q.customerName || q.companyName || 'Quoted Customer',
          offerValue: formatLakhsCr(parseAmt(q.grandTotal || q.total)),
          nextFollowup: q.validUntil ? `Valid till ${q.validUntil}` : 'Pending follow-up',
          stage: q.status || 'Quote Sent',
          age: '4 days',
          priority: 'HIGH'
        });
      });
    }

    return list;
  }, [filteredOpportunities, followups, filteredQuotations]);

  // Real Customer Outstanding & Credit Status
  const realOutstandingData = useMemo(() => {
    const today = new Date();
    const list = [];

    customers.forEach(c => {
      const name = c.customerName || c.companyName;
      if (!name) return;

      // Invoices matching this customer
      const matchingInvoices = invoices.filter(inv => {
        const invCust = (inv.customerName || inv.vendor || '').toLowerCase();
        return invCust.includes(name.toLowerCase()) || name.toLowerCase().includes(invCust);
      });

      const invoicedAmt = matchingInvoices.reduce((s, inv) => s + parseAmt(inv.total || inv.invAmt), 0);
      const outstandingAmt = matchingInvoices.reduce((s, inv) => s + parseAmt(inv.balance !== undefined ? inv.balance : inv.total), 0);

      // Overdue invoices (past due date)
      const overdueAmt = matchingInvoices
        .filter(inv => inv.dueDate && new Date(inv.dueDate) < today)
        .reduce((s, inv) => s + parseAmt(inv.balance !== undefined ? inv.balance : inv.total), 0);

      const limitNum = parseAmt(c.creditLimit) || 2500000;

      let status = 'Within limit';
      if (outstandingAmt > limitNum) {
        status = 'Limit exceeded';
      } else if (outstandingAmt > limitNum * 0.7) {
        status = `${Math.round((outstandingAmt / limitNum) * 100)}% used`;
      }

      if (invoicedAmt > 0 || outstandingAmt > 0 || c.creditLimit) {
        list.push({
          id: c.customerCode || c.id || name,
          customer: name,
          invoicedNum: invoicedAmt,
          invoiced: formatLakhsCr(invoicedAmt),
          outstandingNum: outstandingAmt,
          outstanding: formatLakhsCr(outstandingAmt),
          overdue: overdueAmt > 0 ? formatLakhsCr(overdueAmt) : '—',
          creditLimit: formatLakhsCr(limitNum),
          creditStatus: status
        });
      }
    });

    // Sort by outstanding descending
    return list.sort((a, b) => b.outstandingNum - a.outstandingNum);
  }, [customers, invoices]);

  // Real Lost / Cancelled Opportunities
  const realLostCancelledData = useMemo(() => {
    return filteredOpportunities
      .filter(o => o.stage === 'Lost' || o.stage === 'Cancelled' || o.status === 'Lost' || o.status === 'Cancelled')
      .map(o => ({
        id: o.oppNumber || o.id,
        opportunity: o.title || o.customerName || 'Project Deal',
        value: formatLakhsCr(parseAmt(o.dealValue)),
        valNum: parseAmt(o.dealValue),
        status: o.stage || 'Lost',
        reason: o.notes || o.reason || 'Price difference / Competitor',
        closedDate: o.targetCloseDate ? new Date(o.targetCloseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Recent'
      }));
  }, [filteredOpportunities]);

  const totalLostVal = useMemo(() => {
    return realLostCancelledData.reduce((s, l) => s + l.valNum, 0);
  }, [realLostCancelledData]);

  // Follow-up Table Pagination
  const totalFollowupPages = Math.ceil(realFollowupsData.length / followupRowsPerPage) || 1;
  const currentFollowupRows = useMemo(() => {
    const start = (followupPage - 1) * followupRowsPerPage;
    return realFollowupsData.slice(start, start + followupRowsPerPage);
  }, [realFollowupsData, followupPage, followupRowsPerPage]);

  // Outstanding Table Pagination
  const totalOutstandingPages = Math.ceil(realOutstandingData.length / outstandingRowsPerPage) || 1;
  const currentOutstandingRows = useMemo(() => {
    const start = (outstandingPage - 1) * outstandingRowsPerPage;
    return realOutstandingData.slice(start, start + outstandingRowsPerPage);
  }, [realOutstandingData, outstandingPage, outstandingRowsPerPage]);

  // Opportunity Risk & Expiry Alerts
  const inactiveOpportunities = useMemo(() => {
    const today = new Date();
    return filteredOpportunities.filter(o => {
      if (o.stage === 'Won' || o.stage === 'Lost') return false;
      const refDate = new Date(o.updatedAt || o.createdAt || today);
      const diffDays = Math.floor((today - refDate) / (1000 * 60 * 60 * 24));
      return diffDays >= 10;
    }).slice(0, 3);
  }, [filteredOpportunities]);

  const expiringQuotations = useMemo(() => {
    const today = new Date();
    const sevenDaysLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return filteredQuotations.filter(q => {
      if (!q.validUntil) return false;
      const exp = new Date(q.validUntil);
      return !isNaN(exp.getTime()) && exp <= sevenDaysLater;
    }).slice(0, 3);
  }, [filteredQuotations]);

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAEFEF', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
        <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', color: '#0E7490', margin: '0 auto 14px auto', display: 'block' }} />
        <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>Loading Real-Time Sales Metrics...</div>
        <div style={{ fontSize: '13px', color: '#64748B', marginTop: '6px' }}>Connecting to Zoho Books, Supabase CRM & live proforma invoice stores</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', minWidth: 0, boxSizing: 'border-box', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ─── 1. TOP PERSONALIZED WELCOME BANNER & LIVE CONTROLS CARD ─── */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EAEFEF',
        padding: '16px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
        position: 'relative',
        overflow: 'hidden',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 2 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
                Welcome back, {userRole === 'Sales Head' ? 'Vijay' : (localStorage.getItem('controlroom_logged_user_name') || 'Mohith JV')}!
              </h2>
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                backgroundColor: '#ECFEFF',
                color: '#0E7490',
                border: '1px solid #CFFAFE',
                padding: '2px 8px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Flame size={12} color="#0E7490" /> Live Sales Command
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0', fontWeight: '500' }}>
              Real-time Zoho revenue sync, active proforma invoices & conversion performance. Updated {lastSyncedTime}.
            </p>
          </div>
        </div>

        {/* Right Status Indicators and Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 2, flexWrap: 'wrap' }}>
          {/* Executive Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              SALES REP
            </span>
            <select
              value={selectedExecutive}
              onChange={(e) => setSelectedExecutive(e.target.value)}
              style={{
                height: '32px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                padding: '0 8px',
                fontSize: '12px',
                fontWeight: '700',
                color: '#0F172A',
                backgroundColor: '#FFFFFF',
                cursor: 'pointer'
              }}
            >
              {availableExecutives.map(exec => (
                <option key={exec} value={exec}>{exec === 'All' ? 'All Sales Reps' : exec}</option>
              ))}
            </select>
          </div>

          {/* Period Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              TIME PERIOD
            </span>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              style={{
                height: '32px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                padding: '0 8px',
                fontSize: '12px',
                fontWeight: '700',
                color: '#0F172A',
                backgroundColor: '#FFFFFF',
                cursor: 'pointer'
              }}
            >
              <option value="This Month">This Month</option>
              <option value="Last Month">Last Month</option>
              <option value="This Quarter">This Quarter</option>
              <option value="Financial Year (YTD)">Financial Year (YTD)</option>
            </select>
          </div>

          <div style={{ width: '1px', height: '32px', backgroundColor: '#E2E8F0' }} />

          {/* Zoho Integration Status */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ZOHO INTEGRATION
            </div>
            <div style={{ fontSize: '12.5px', fontWeight: '700', color: isZohoConnected ? '#0284C7' : '#D97706', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', marginTop: '2px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: isZohoConnected ? '#0284C7' : '#F59E0B', boxShadow: `0 0 6px ${isZohoConnected ? '#38BDF8' : '#FBBF24'}` }} />
              {isZohoConnected ? 'Connected & Synced' : 'Sync Active'}
            </div>
          </div>

          {/* Live Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh real-time sales data"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '700',
              color: '#334155',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease'
            }}
          >
            <RefreshCw size={13} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none', color: '#0E7490' }} />
            {isRefreshing ? 'Syncing...' : 'Sync'}
          </button>
        </div>

        <div style={{
          position: 'absolute',
          right: '-20px',
          top: '-20px',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(14, 116, 144, 0.05) 0%, rgba(255,255,255,0) 70%)',
          pointerEvents: 'none'
        }} />
      </div>

      {/* ─── ROW 1: 5-COLUMN REAL-TIME KPI CARDS ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', width: '100%' }}>
        {/* Card 1: Conversion */}
        <div className="section-card" style={{ padding: '16px 18px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Conversion</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '24px', fontWeight: '900', color: '#0F172A' }}>{conversionRate}%</span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#16A34A', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: '2px 8px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <ArrowUpRight size={13} strokeWidth={2.5} /> Active Pace
            </span>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', color: '#64748B', fontWeight: '600', width: '100%', boxSizing: 'border-box' }}>
            {wonDeals.length} Won of {filteredOpportunities.length} Deals
          </div>
        </div>

        {/* Card 2: Proforma Invoice */}
        <div className="section-card" style={{ padding: '16px 18px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Proforma Invoice</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '24px', fontWeight: '900', color: '#0F172A' }}>{formatLakhsCr(totalPiValue)}</span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#0284C7', backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', padding: '2px 8px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              Live PIs
            </span>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', color: '#64748B', fontWeight: '600', width: '100%', boxSizing: 'border-box' }}>
            {filteredPis.length} proforma invoices
          </div>
        </div>

        {/* Card 3: Invoiced */}
        <div className="section-card" style={{ padding: '16px 18px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Invoiced</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '24px', fontWeight: '900', color: '#0F172A' }}>{formatLakhsCr(totalInvoicedValue)}</span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#16A34A', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: '2px 8px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              Zoho Synced
            </span>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', color: '#64748B', fontWeight: '600', width: '100%', boxSizing: 'border-box' }}>
            {filteredInvoices.length} invoices generated
          </div>
        </div>

        {/* Card 4: Collections */}
        <div className="section-card" style={{ padding: '16px 18px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Collections</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '24px', fontWeight: '900', color: '#0F172A' }}>{formatLakhsCr(totalCollections)}</span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#16A34A', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: '2px 8px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              {realizedPercent}% realised
            </span>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', color: '#64748B', fontWeight: '600', width: '100%', boxSizing: 'border-box' }}>
            {selectedPeriod}
          </div>
        </div>

        {/* Card 5: Active Inquiries & Deals */}
        <div className="section-card" style={{ padding: '16px 18px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Inquiries & Deals</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '24px', fontWeight: '900', color: '#0F172A' }}>{filteredLeads.length + filteredOpportunities.length}</span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#0E7490', backgroundColor: '#ECFEFF', border: '1px solid #CFFAFE', padding: '2px 8px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              Active Pipeline
            </span>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', color: '#64748B', fontWeight: '600', width: '100%', boxSizing: 'border-box' }}>
            Leads: {filteredLeads.length} • Deals: {filteredOpportunities.length}
          </div>
        </div>
      </div>

      {/* ─── ROW 2: MONTH TARGET RUN RATE & SALES FUNNEL (50/50 SPLIT) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', width: '100%', alignItems: 'stretch' }}>
        {/* Card A: Target Progress & Run Rate */}
        <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                MONTH TARGET PROGRESS AND REQUIRED RUN RATE
              </span>
              <span style={{
                fontSize: '10.5px',
                fontWeight: '700',
                color: targetAchievedPct >= 80 ? '#166534' : targetAchievedPct >= 50 ? '#92400E' : '#1E40AF',
                backgroundColor: targetAchievedPct >= 80 ? '#DCFCE7' : targetAchievedPct >= 50 ? '#FEF3C7' : '#EFF6FF',
                border: `1px solid ${targetAchievedPct >= 80 ? '#BBF7D0' : targetAchievedPct >= 50 ? '#FDE68A' : '#DBEAFE'}`,
                padding: '2px 8px',
                borderRadius: '10px'
              }}>
                PACING: {targetAchievedPct}% ON TRACK
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center', marginBottom: '14px' }}>
              <div style={{ backgroundColor: '#F8FAFC', padding: '10px 8px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '600', display: 'block' }}>Monthly Target</span>
                <strong style={{ fontSize: '17px', color: '#0F172A', fontWeight: '900' }}>{formatLakhsCr(monthlyTargetNum)}</strong>
              </div>
              <div style={{ backgroundColor: '#F0FDF4', padding: '10px 8px', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
                <span style={{ fontSize: '10.5px', color: '#166534', fontWeight: '600', display: 'block' }}>Achieved</span>
                <strong style={{ fontSize: '17px', color: '#16A34A', fontWeight: '900' }}>{formatLakhsCr(targetAchievedVal)}</strong>
              </div>
              <div style={{ backgroundColor: '#FFFBEB', padding: '10px 8px', borderRadius: '10px', border: '1px solid #FDE68A' }}>
                <span style={{ fontSize: '10.5px', color: '#92400E', fontWeight: '600', display: 'block' }}>Balance</span>
                <strong style={{ fontSize: '17px', color: '#D97706', fontWeight: '900' }}>{formatLakhsCr(targetBalanceVal)}</strong>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div style={{ width: '100%', height: '22px', backgroundColor: '#E2E8F0', borderRadius: '11px', overflow: 'hidden', position: 'relative' }}>
              <div style={{
                width: `${Math.max(8, targetAchievedPct)}%`,
                height: '100%',
                backgroundColor: targetAchievedPct >= 80 ? '#16A34A' : '#0E7490',
                borderRadius: '11px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '0.5px',
                transition: 'width 0.4s ease'
              }}>
                {targetAchievedPct}% achieved
              </div>
            </div>
          </div>

          <div style={{ marginTop: '12px', padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '11.5px', color: '#334155', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={14} style={{ color: '#0E7490' }} />
            <span>
              {targetBalanceVal > 0 ? (
                <>Required daily sales: <strong style={{ color: '#0E7490' }}>{formatLakhsCr(requiredDailySales)}</strong> for remaining {remainingWorkingDays} working days</>
              ) : (
                <strong style={{ color: '#16A34A' }}>✓ Monthly sales target successfully achieved! Excellent performance.</strong>
              )}
            </span>
          </div>
        </div>

        {/* Card B: Sales Funnel */}
        <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                MY SALES FUNNEL — {selectedPeriod.toUpperCase()}
              </div>
              <span style={{ fontSize: '10.5px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', border: '1px solid #CFFAFE', padding: '2px 8px', borderRadius: '12px' }}>
                CONVERSION: {conversionRate}%
              </span>
            </div>

            {/* Flat 2D Sales Funnel matching Design System */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '2px 0' }}>
              {funnelData.map((tier, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                  <div
                    style={{
                      width: tier.width,
                      backgroundColor: tier.barColor,
                      color: '#FFFFFF',
                      borderRadius: '8px',
                      padding: '7px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.01)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: '800', letterSpacing: '0.5px' }}>
                        {tier.label}
                      </span>
                      <span style={{ fontSize: '10px', fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.25)', padding: '2px 6px', borderRadius: '10px' }}>
                        {tier.count}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: '800' }}>
                        {tier.value}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            marginTop: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px',
            backgroundColor: '#F8FAFC',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            fontSize: '11px',
            color: '#334155',
            flexWrap: 'wrap',
            gap: '6px'
          }}>
            <span>Offer-to-Invoice conversion: <strong style={{ color: '#0E7490' }}>{conversionRate}%</strong></span>
            <span>•</span>
            <span>Average invoice value: <strong style={{ color: '#0E7490' }}>{filteredInvoices.length > 0 ? formatLakhsCr(totalInvoicedValue / filteredInvoices.length) : '₹ 0.00'}</strong></span>
          </div>
        </div>
      </div>

      {/* ─── ROW 3: SALES TREND, PRODUCT PERFORMANCE, TOP 10 CUSTOMERS (3 COLUMNS) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '16px', width: '100%', alignItems: 'stretch' }}>
        {/* Card A: Actual vs Target Trend Chart */}
        <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                LIVE SALES TREND (LAST 7 MONTHS)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0284C7', fontSize: '11px', fontWeight: '700' }}>
                  <span style={{ width: '8px', height: '8px', backgroundColor: '#0284C7', borderRadius: '2px' }}></span> Billed Revenue
                </span>
              </div>
            </div>

            {/* Chart Canvas with Y-Axis, Rounded Stadium Bars, and Hover Tooltip */}
            <div style={{ display: 'flex', position: 'relative' }}>
              {/* Y-Axis Labels */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                paddingRight: '10px',
                fontSize: '10px',
                fontWeight: '600',
                color: '#94A3B8',
                height: '160px',
                userSelect: 'none',
                textAlign: 'right',
                minWidth: '32px'
              }}>
                <span>{maxTrendLakhs} L</span>
                <span>{Math.round(maxTrendLakhs * 0.75)} L</span>
                <span>{Math.round(maxTrendLakhs * 0.5)} L</span>
                <span>{Math.round(maxTrendLakhs * 0.25)} L</span>
                <span>0 L</span>
              </div>

              {/* Bars Area with Background Dashed Gridlines */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {/* Horizontal Gridlines */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} style={{ width: '100%', borderBottom: '1px dashed #E2E8F0' }}></div>
                  ))}
                </div>

                {/* Bar Columns Container */}
                <div style={{ height: '160px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', position: 'relative', zIndex: 4, padding: '0 4px' }}>
                  {monthlyTrendData.map((d) => {
                    const heightPct = maxTrendLakhs > 0 ? (d.actual / maxTrendLakhs) * 100 : 0;
                    const isHovered = hoveredTrendMonth === d.month;

                    return (
                      <div
                        key={d.month}
                        onMouseEnter={() => setHoveredTrendMonth(d.month)}
                        onMouseLeave={() => setHoveredTrendMonth(null)}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          height: '100%',
                          justifyContent: 'flex-end',
                          position: 'relative',
                          cursor: 'pointer'
                        }}
                      >
                        {/* Tooltip visible on hover */}
                        {isHovered && (
                          <div style={{
                            position: 'absolute',
                            bottom: `${Math.min(90, heightPct + 10)}%`,
                            zIndex: 20,
                            backgroundColor: '#0F172A',
                            color: '#FFFFFF',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            textAlign: 'center',
                            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.3)',
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            fontSize: '11px',
                            fontWeight: '700'
                          }}>
                            <span>₹ {d.actual} L</span>
                            <div style={{
                              position: 'absolute',
                              bottom: '-4px',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: 0,
                              height: 0,
                              borderLeft: '4px solid transparent',
                              borderRight: '4px solid transparent',
                              borderTop: '4px solid #0F172A'
                            }} />
                          </div>
                        )}

                        {/* Stadium-Rounded Bar */}
                        <div
                          style={{
                            width: '28px',
                            maxWidth: '75%',
                            height: `${Math.max(4, heightPct)}%`,
                            backgroundColor: '#0284C7',
                            backgroundImage: isHovered
                              ? 'linear-gradient(180deg, #38BDF8 0%, #0284C7 100%)'
                              : 'linear-gradient(180deg, #0284C7 0%, #0369A1 100%)',
                            borderRadius: '14px',
                            transition: 'all 0.2s ease',
                            boxShadow: isHovered
                              ? '0 6px 14px rgba(2, 132, 199, 0.4)'
                              : '0 1px 3px rgba(0,0,0,0.06)',
                            transform: isHovered ? 'translateY(-2px)' : 'translateY(0)'
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                <div style={{ width: '100%', height: '2px', backgroundColor: '#E2E8F0', marginTop: '4px' }}></div>

                {/* Month Labels */}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', paddingLeft: '4px', paddingRight: '4px', fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                  {monthlyTrendData.map(d => {
                    const isHovered = hoveredTrendMonth === d.month;
                    return (
                      <span
                        key={d.month}
                        onMouseEnter={() => setHoveredTrendMonth(d.month)}
                        onMouseLeave={() => setHoveredTrendMonth(null)}
                        style={{
                          flex: 1,
                          textAlign: 'center',
                          cursor: 'pointer',
                          color: isHovered ? '#0284C7' : '#64748B',
                          fontWeight: isHovered ? '800' : '600',
                          transition: 'color 0.2s ease'
                        }}
                      >
                        {d.month}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card B: Product Sale Comparison */}
        <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', position: 'relative', height: '100%', justifyContent: 'space-between', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                PRODUCT SALE COMPARISON
              </span>
            </div>

            {/* Subtle background gridlines */}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'space-between', pointerEvents: 'none', zIndex: 0 }}>
                {[...Array(5)].map((_, i) => (
                  <div key={i} style={{ height: '100%', borderRight: '1px dashed #F1F5F9' }}></div>
                ))}
              </div>

              {/* Pattern for striped secondary bars */}
              <svg width="0" height="0" style={{ position: 'absolute' }}>
                <defs>
                  <pattern id="diagonalHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="0" y2="8" stroke="#94A3B8" strokeWidth="2.5" strokeOpacity="0.55" />
                  </pattern>
                </defs>
              </svg>

              {/* List of Products */}
              {productPerformance.map((p, idx) => {
                const pct = maxProductVal > 0 ? (p.actual / maxProductVal) * 100 : 0;
                const isTop = idx === 0;

                return (
                  <div key={idx} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#1E293B' }}>
                        {p.name}
                      </span>
                      <span style={{ fontSize: '10.5px', fontWeight: '600', color: '#94A3B8' }}>
                        {p.actualStr}
                      </span>
                    </div>

                    <div style={{ width: '100%', height: '8px', position: 'relative' }}>
                      {isTop ? (
                        <div
                          style={{
                            width: `${Math.max(5, pct)}%`,
                            height: '8px',
                            borderRadius: '4px',
                            background: 'linear-gradient(90deg, #38BDF8 0%, #0284C7 60%, #0369A1 100%)',
                            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
                            transition: 'width 0.3s ease'
                          }}
                        />
                      ) : (
                        <svg width={`${Math.max(5, pct)}%`} height="8" style={{ display: 'block', overflow: 'hidden', borderRadius: '4px' }}>
                          <rect
                            width="100%"
                            height="8"
                            rx="4"
                            ry="4"
                            fill="url(#diagonalHatch)"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card C: Top 10 Customers Month Sales Contribution */}
        <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                TOP 10 CUSTOMERS — SALES SHARE
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr 1fr',
              paddingBottom: '6px',
              borderBottom: '1px solid #E2E8F0',
              fontSize: '10.5px',
              fontWeight: '700',
              color: '#64748B'
            }}>
              <div>Customer</div>
              <div style={{ textAlign: 'right' }}>Sales Value</div>
              <div style={{ textAlign: 'right' }}>% Share</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '175px', overflowY: 'auto' }}>
              {topCustomers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>
                  No customer invoices recorded yet for this period
                </div>
              ) : (
                topCustomers.map((c, idx) => {
                  const dotColors = [
                    '#16A34A', '#65A30D', '#84CC16', '#CA8A04', '#EA580C',
                    '#DC2626', '#EF4444', '#EC4899', '#8B5CF6', '#6366F1'
                  ];
                  const dotColor = dotColors[idx] || '#64748B';

                  return (
                    <div
                      key={c.rank}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.4fr 1fr 1fr',
                        alignItems: 'center',
                        padding: '6px 0',
                        borderBottom: '1px solid #F8FAFC',
                        fontSize: '11px',
                        lineHeight: '1.3'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, paddingRight: '4px' }}>
                        <span style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: dotColor,
                          flexShrink: 0
                        }} />
                        <span style={{ fontWeight: '600', color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.name}
                        </span>
                      </div>

                      <div style={{ textAlign: 'right', fontWeight: '600', color: '#1E293B' }}>
                        {c.value}
                      </div>

                      <div style={{ textAlign: 'right', color: '#64748B' }}>
                        {c.share}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {topCustomers.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr 1fr',
              alignItems: 'center',
              paddingTop: '8px',
              marginTop: '6px',
              borderTop: '2px solid #E2E8F0',
              fontSize: '11.5px',
              fontWeight: '800',
              color: '#1E3A8A'
            }}>
              <div>Total (Top 10)</div>
              <div style={{ textAlign: 'right', color: '#1E3A8A' }}>{formatLakhsCr(top10TotalVal)}</div>
              <div style={{ textAlign: 'right', color: '#1E3A8A' }}>
                {totalInvoicedValue > 0 ? ((top10TotalVal / totalInvoicedValue) * 100).toFixed(1) + '%' : '100%'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── ROW 4: FOLLOW-UP AND OPPORTUNITY LIST (TABLE WITH CHECKBOXES & STRICT AGENTS.MD PAGINATION) ─── */}
      <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Follow-up and Opportunity List — {selectedPeriod}
            </span>
            <span style={{
              fontSize: '10px',
              fontWeight: '800',
              letterSpacing: '0.5px',
              padding: '2px 8px',
              borderRadius: '10px',
              backgroundColor: '#EFF6FF',
              color: '#1D4ED8',
              border: '1px solid #DBEAFE'
            }}>
              {realFollowupsData.length} LIVE OPPORTUNITIES
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onNavigateTab && onNavigateTab('Opportunities')}
              style={{
                backgroundColor: '#0E7490',
                color: '#FFFFFF',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Plus size={13} /> Add Opportunity
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div style={{ border: '1px solid #F1F5F9', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                  <th style={{ width: '36px', padding: '12px 14px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={currentFollowupRows.length > 0 && currentFollowupRows.every(r => selectedFollowups.includes(r.id))}
                      onChange={() => {
                        if (currentFollowupRows.every(r => selectedFollowups.includes(r.id))) {
                          setSelectedFollowups([]);
                        } else {
                          setSelectedFollowups(currentFollowupRows.map(r => r.id));
                        }
                      }}
                      style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ padding: '12px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Customer / Opportunity <ArrowUpDown size={11} style={{ opacity: 0.6 }} />
                    </div>
                  </th>
                  <th style={{ padding: '12px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px' }}>Offer Value</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px' }}>Next Follow-up</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px' }}>Stage</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px' }}>Age</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px' }}>Priority</th>
                </tr>
              </thead>
              <tbody>
                {currentFollowupRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '28px', textAlign: 'center', color: '#94A3B8', fontSize: '13px', fontStyle: 'italic' }}>
                      No active opportunities or follow-ups recorded yet. Click "+ Add Opportunity" to create one.
                    </td>
                  </tr>
                ) : (
                  currentFollowupRows.map((row) => {
                    const isSelected = selectedFollowups.includes(row.id);
                    return (
                      <tr
                        key={row.id}
                        className="table-row-hover"
                        style={{
                          backgroundColor: isSelected ? '#ECFEFF' : 'transparent',
                          borderBottom: '1px solid #F1F5F9',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <td style={{
                          padding: '12px 14px',
                          textAlign: 'center',
                          borderLeft: isSelected ? '4px solid #0E7490' : '4px solid transparent'
                        }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) setSelectedFollowups(selectedFollowups.filter(i => i !== row.id));
                              else setSelectedFollowups([...selectedFollowups, row.id]);
                            }}
                            style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '700', color: '#1E293B' }}>{row.customer}</td>
                        <td style={{ padding: '12px 14px', fontWeight: '700', color: '#1E293B' }}>{row.offerValue}</td>
                        <td style={{ padding: '12px 14px', color: '#475569', fontWeight: '500' }}>{row.nextFollowup}</td>
                        <td style={{ padding: '12px 14px', color: '#64748B', fontWeight: '600' }}>{row.stage}</td>
                        <td style={{ padding: '12px 14px', color: '#64748B' }}>{row.age}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 10px',
                            borderRadius: '14px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: row.priority === 'HIGH' ? '#FEF2F2' : '#FFFBEB',
                            border: `1px solid ${row.priority === 'HIGH' ? '#FEE2E2' : '#FEF3C7'}`,
                            color: row.priority === 'HIGH' ? '#DC2626' : '#D97706'
                          }}>
                            {row.priority === 'HIGH' && <Clock size={11} />}
                            {row.priority}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Standard Pagination Footer Layout (AGENTS.md strict rules) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', backgroundColor: '#FFFFFF', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>Showing per page</span>
            <select
              value={followupRowsPerPage}
              onChange={(e) => { setFollowupRowsPerPage(parseInt(e.target.value)); setFollowupPage(1); }}
              style={{ height: '30px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 6px', fontSize: '12px', fontWeight: '600', color: '#334155' }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
              Showing {realFollowupsData.length > 0 ? (followupPage - 1) * followupRowsPerPage + 1 : 0} to {Math.min(followupPage * followupRowsPerPage, realFollowupsData.length)} of {realFollowupsData.length} entries
            </span>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              disabled={followupPage === 1}
              onClick={() => setFollowupPage(1)}
              style={{ width: '28px', height: '28px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: '#FFFFFF', cursor: followupPage === 1 ? 'not-allowed' : 'pointer', color: '#475569', fontWeight: 'bold', fontSize: '11px' }}
            >
              &lt;&lt;
            </button>
            <button
              disabled={followupPage === 1}
              onClick={() => setFollowupPage(p => p - 1)}
              style={{ width: '28px', height: '28px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: '#FFFFFF', cursor: followupPage === 1 ? 'not-allowed' : 'pointer', color: '#475569', fontWeight: 'bold', fontSize: '11px' }}
            >
              &lt;
            </button>
            {Array.from({ length: totalFollowupPages }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setFollowupPage(idx + 1)}
                style={{
                  width: '28px',
                  height: '28px',
                  border: followupPage === idx + 1 ? 'none' : '1px solid #CBD5E1',
                  borderRadius: '6px',
                  backgroundColor: followupPage === idx + 1 ? '#0E7490' : '#FFFFFF',
                  color: followupPage === idx + 1 ? '#FFFFFF' : '#475569',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                {idx + 1}
              </button>
            ))}
            <button
              disabled={followupPage === totalFollowupPages}
              onClick={() => setFollowupPage(p => p + 1)}
              style={{ width: '28px', height: '28px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: '#FFFFFF', cursor: followupPage === totalFollowupPages ? 'not-allowed' : 'pointer', color: '#475569', fontWeight: 'bold', fontSize: '11px' }}
            >
              &gt;
            </button>
            <button
              disabled={followupPage === totalFollowupPages}
              onClick={() => setFollowupPage(totalFollowupPages)}
              style={{ width: '28px', height: '28px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: '#FFFFFF', cursor: followupPage === totalFollowupPages ? 'not-allowed' : 'pointer', color: '#475569', fontWeight: 'bold', fontSize: '11px' }}
            >
              &gt;&gt;
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
              <span style={{ fontSize: '12px', color: '#64748B' }}>Go to page</span>
              <input
                type="number"
                value={followupGoTo}
                onChange={(e) => setFollowupGoTo(e.target.value)}
                placeholder="1"
                style={{ width: '40px', height: '28px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '12px' }}
              />
              <button
                onClick={() => {
                  const p = parseInt(followupGoTo);
                  if (p >= 1 && p <= totalFollowupPages) setFollowupPage(p);
                }}
                style={{ height: '28px', padding: '0 8px', backgroundColor: '#0E7490', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Go ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── ROW 5: CUSTOMER OUTSTANDING & CREDIT + LOST / CANCELLED (50/50 SPLIT) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', width: '100%', alignItems: 'stretch' }}>
        {/* Table A: Customer Outstanding and Credit Status */}
        <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '12px', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  CUSTOMER OUTSTANDING AND CREDIT STATUS
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  letterSpacing: '0.5px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: '#EFF6FF',
                  color: '#1E40AF',
                  border: '1px solid #DBEAFE'
                }}>
                  {realOutstandingData.length} CUSTOMERS
                </span>
              </div>
            </div>

            <div style={{ border: '1px solid #F1F5F9', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'left' }}>
                        Customer
                      </th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'right' }}>Invoiced</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'right' }}>Outstanding</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'right' }}>Overdue</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'right' }}>Credit Limit</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'center' }}>Credit Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentOutstandingRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '12px', fontStyle: 'italic' }}>
                          No customer invoices or outstandings recorded yet.
                        </td>
                      </tr>
                    ) : (
                      currentOutstandingRows.map(c => (
                        <tr key={c.id} className="table-row-hover" style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 14px', fontWeight: '700', color: '#1E293B', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.customer}>
                            {c.customer}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#475569' }}>{c.invoiced}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#1E293B' }}>{c.outstanding}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: c.overdue !== '—' ? '#DC2626' : '#64748B' }}>{c.overdue}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#64748B' }}>{c.creditLimit}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 10px',
                              borderRadius: '14px',
                              fontSize: '11px',
                              fontWeight: '700',
                              backgroundColor: c.creditStatus === 'Within limit' ? '#ECFDF5' : c.creditStatus.includes('used') ? '#FFFBEB' : '#FEF2F2',
                              border: `1px solid ${c.creditStatus === 'Within limit' ? '#D1FAE5' : c.creditStatus.includes('used') ? '#FEF3C7' : '#FEE2E2'}`,
                              color: c.creditStatus === 'Within limit' ? '#059669' : c.creditStatus.includes('used') ? '#D97706' : '#DC2626'
                            }}>
                              {c.creditStatus}
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

          {/* Outstanding Table Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748B', paddingTop: '4px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Showing per page</span>
              <select
                value={outstandingRowsPerPage}
                onChange={(e) => { setOutstandingRowsPerPage(parseInt(e.target.value)); setOutstandingPage(1); }}
                style={{ height: '24px', borderRadius: '4px', border: '1px solid #CBD5E1', padding: '0 4px', fontSize: '11px', color: '#334155' }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
              <span>
                Showing {realOutstandingData.length > 0 ? (outstandingPage - 1) * outstandingRowsPerPage + 1 : 0} to {Math.min(outstandingPage * outstandingRowsPerPage, realOutstandingData.length)} of {realOutstandingData.length}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                disabled={outstandingPage === 1}
                onClick={() => setOutstandingPage(p => p - 1)}
                style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', cursor: outstandingPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                Prev
              </button>
              <button
                disabled={outstandingPage === totalOutstandingPages}
                onClick={() => setOutstandingPage(p => p + 1)}
                style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', cursor: outstandingPage === totalOutstandingPages ? 'not-allowed' : 'pointer' }}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Table B: Lost and Cancelled Opportunities */}
        <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '12px', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                LOST AND CANCELLED OPPORTUNITIES — {selectedPeriod.toUpperCase()}
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: '800',
                letterSpacing: '0.5px',
                padding: '2px 8px',
                borderRadius: '10px',
                backgroundColor: realLostCancelledData.length > 0 ? '#FEF2F2' : '#F0FDF4',
                color: realLostCancelledData.length > 0 ? '#DC2626' : '#166534',
                border: `1px solid ${realLostCancelledData.length > 0 ? '#FEE2E2' : '#BBF7D0'}`
              }}>
                {realLostCancelledData.length} DEALS
              </span>
            </div>

            <div style={{ border: '1px solid #F1F5F9', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'left' }}>
                        Opportunity
                      </th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'right' }}>Value</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'left' }}>Reason</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'right' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {realLostCancelledData.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: '#166534', backgroundColor: '#F0FDF4' }}>
                          <CheckCircle size={24} style={{ margin: '0 auto 6px auto', display: 'block', color: '#16A34A' }} />
                          <strong style={{ fontSize: '13px' }}>Zero lost or cancelled opportunities in this period!</strong>
                          <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: '#15803D' }}>
                            100% active deal conversion velocity across your pipeline.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      realLostCancelledData.map(l => (
                        <tr key={l.id} className="table-row-hover" style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 14px', fontWeight: '700', color: '#1E293B' }}>{l.opportunity}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#1E293B' }}>{l.value}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 10px',
                              borderRadius: '14px',
                              fontSize: '11px',
                              fontWeight: '700',
                              backgroundColor: l.status === 'Lost' ? '#FEF2F2' : '#F1F5F9',
                              border: `1px solid ${l.status === 'Lost' ? '#FEE2E2' : '#E2E8F0'}`,
                              color: l.status === 'Lost' ? '#DC2626' : '#64748B'
                            }}>
                              {l.status}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748B' }}>{l.reason}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#94A3B8' }}>{l.closedDate}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {realLostCancelledData.length > 0 && (
                <div style={{ padding: '10px 14px', backgroundColor: '#F8FAFC', borderTop: '1px solid #F1F5F9', textAlign: 'right', fontSize: '11px', color: '#DC2626', fontWeight: '700' }}>
                  Total lost / cancelled value: {formatLakhsCr(totalLostVal)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── ROW 6: ACTIVITY SUMMARY & OPPORTUNITY RISK (50/50 SPLIT) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', width: '100%', alignItems: 'stretch' }}>
        {/* Card: Real Activity Summary */}
        <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '8px', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ACTIVITY SUMMARY — {selectedPeriod.toUpperCase()}
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr',
              paddingBottom: '6px',
              borderBottom: '1px solid #E2E8F0',
              fontSize: '10.5px',
              fontWeight: '700',
              color: '#64748B'
            }}>
              <div>Activity</div>
              <div style={{ textAlign: 'right' }}>Achieved / Metric</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                { label: 'New inquiries / Leads', count: String(filteredLeads.length), sub: 'Active in CRM', color: '#0284C7' },
                { label: 'Offers / Quotations issued', count: String(filteredQuotations.length), sub: formatLakhsCr(totalQuotesValue), color: '#8B5CF6' },
                { label: 'Active Opportunities in pipeline', count: String(filteredOpportunities.length), sub: `${wonDeals.length} Won`, color: '#0D9488' },
                { label: 'Follow-ups scheduled', count: String(realFollowupsData.length), sub: '100% tracked', color: '#16A34A' },
                { label: 'Proforma invoices issued', count: String(filteredPis.length), sub: formatLakhsCr(totalPiValue), color: '#0E7490' },
                { label: 'Tax Invoices generated', count: String(filteredInvoices.length), sub: formatLakhsCr(totalInvoicedValue), color: '#EA580C' }
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.4fr 1fr',
                    alignItems: 'center',
                    padding: '7px 0',
                    borderBottom: '1px solid #F8FAFC',
                    fontSize: '11px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
                    <span style={{ color: '#1E293B', fontWeight: '600' }}>{item.label}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ color: '#1E293B', fontSize: '12px' }}>{item.count}</strong>
                    <span style={{ fontSize: '10.5px', color: '#64748B', marginLeft: '6px' }}>{item.sub}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            alignItems: 'center',
            paddingTop: '8px',
            marginTop: '4px',
            borderTop: '2px solid #E2E8F0',
            fontSize: '11.5px',
            fontWeight: '800',
            color: '#1E3A8A'
          }}>
            <div>Total Engagement Actions</div>
            <div style={{ textAlign: 'right', color: '#1E3A8A' }}>
              {filteredLeads.length + filteredQuotations.length + filteredOpportunities.length + filteredPis.length + filteredInvoices.length} Live Interactions
            </div>
          </div>
        </div>

        {/* Card: Opportunity Risk & Expiry Alerts */}
        <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '12px', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                OPPORTUNITY RISK AND EXPIRY ALERTS
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: '800',
                letterSpacing: '0.5px',
                padding: '2px 8px',
                borderRadius: '10px',
                backgroundColor: inactiveOpportunities.length + expiringQuotations.length > 0 ? '#FEF2F2' : '#F0FDF4',
                color: inactiveOpportunities.length + expiringQuotations.length > 0 ? '#DC2626' : '#166534',
                border: `1px solid ${inactiveOpportunities.length + expiringQuotations.length > 0 ? '#FEE2E2' : '#BBF7D0'}`
              }}>
                {inactiveOpportunities.length + expiringQuotations.length > 0 ? 'ATTENTION NEEDED' : 'CLEAR'}
              </span>
            </div>

            {/* Inactive Alert Sub-block */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> Inactive Above 10 Days
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {inactiveOpportunities.length === 0 ? (
                  <div style={{ padding: '8px 12px', backgroundColor: '#F0FDF4', borderRadius: '8px', border: '1px solid #DCFCE7', fontSize: '11.5px', color: '#166534', fontWeight: '600' }}>
                    ✓ All pipeline opportunities have recent activity within the last 10 days.
                  </div>
                ) : (
                  inactiveOpportunities.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                      <span style={{ fontWeight: '700', color: '#1E293B', fontSize: '11.5px' }}>{item.customerName || item.title}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: '700', color: '#1E293B', fontSize: '11.5px' }}>{formatLakhsCr(parseAmt(item.dealValue))}</span>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor: '#FEF2F2',
                          border: '1px solid #FEE2E2',
                          color: '#DC2626',
                          fontSize: '10.5px',
                          fontWeight: '700'
                        }}>
                          <Clock size={10} /> Inactive
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Expiring Alert Sub-block */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> Offers Expiring Soon
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {expiringQuotations.length === 0 ? (
                  <div style={{ padding: '8px 12px', backgroundColor: '#F0FDF4', borderRadius: '8px', border: '1px solid #DCFCE7', fontSize: '11.5px', color: '#166534', fontWeight: '600' }}>
                    ✓ No active quotations approaching immediate expiration this week.
                  </div>
                ) : (
                  expiringQuotations.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                      <span style={{ fontWeight: '700', color: '#1E293B', fontSize: '11.5px' }}>{item.customerName || item.quoteNumber}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: '700', color: '#1E293B', fontSize: '11.5px' }}>{formatLakhsCr(parseAmt(item.grandTotal || item.total))}</span>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor: '#FFFBEB',
                          border: '1px solid #FEF3C7',
                          color: '#D97706',
                          fontSize: '10.5px',
                          fontWeight: '700'
                        }}>
                          <Clock size={10} /> {item.validUntil || 'Expiring soon'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── ROW 7: TODAY'S SNAPSHOT RIBBON ─── */}
      <div className="section-card" style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EAEFEF',
        padding: '16px 20px',
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          TODAY'S SNAPSHOT — {selectedPeriod.toUpperCase()}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '10px', textAlign: 'center' }}>
          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9', padding: '10px 8px', borderRadius: '10px' }}>
            <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block', fontWeight: '600' }}>New leads</span>
            <strong style={{ fontSize: '18px', color: '#1E293B', fontWeight: '800' }}>{filteredLeads.length}</strong>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9', padding: '10px 8px', borderRadius: '10px' }}>
            <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block', fontWeight: '600' }}>Active deals</span>
            <strong style={{ fontSize: '18px', color: '#1E293B', fontWeight: '800' }}>{filteredOpportunities.length}</strong>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9', padding: '10px 8px', borderRadius: '10px' }}>
            <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block', fontWeight: '600' }}>Follow-ups</span>
            <strong style={{ fontSize: '18px', color: '#1E293B', fontWeight: '800' }}>{realFollowupsData.length}</strong>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9', padding: '10px 8px', borderRadius: '10px' }}>
            <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block', fontWeight: '600' }}>Offers sent</span>
            <strong style={{ fontSize: '18px', color: '#1E293B', fontWeight: '800' }}>{filteredQuotations.length}</strong>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9', padding: '10px 8px', borderRadius: '10px' }}>
            <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block', fontWeight: '600' }}>Proforma invoices</span>
            <strong style={{ fontSize: '18px', color: '#0284C7', fontWeight: '800' }}>{filteredPis.length}</strong>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9', padding: '10px 8px', borderRadius: '10px' }}>
            <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block', fontWeight: '600' }}>Invoices</span>
            <strong style={{ fontSize: '18px', color: '#EA580C', fontWeight: '800' }}>{filteredInvoices.length}</strong>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9', padding: '10px 8px', borderRadius: '10px' }}>
            <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block', fontWeight: '600' }}>Invoice value</span>
            <strong style={{ fontSize: '18px', color: '#EA580C', fontWeight: '800' }}>{formatLakhsCr(totalInvoicedValue)}</strong>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9', padding: '10px 8px', borderRadius: '10px' }}>
            <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block', fontWeight: '600' }}>Collections</span>
            <strong style={{ fontSize: '18px', color: '#16A34A', fontWeight: '800' }}>{formatLakhsCr(totalCollections)}</strong>
          </div>
        </div>
      </div>

      {/* ─── FLOATING ACTION BAR FOR SELECTED FOLLOW-UPS (STRICT AGENTS.MD SINGLE LINE) ─── */}
      {selectedFollowups.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '50px',
          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.15)',
          padding: '8px 20px',
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          whiteSpace: 'nowrap',
          alignItems: 'center',
          gap: '12px',
          zIndex: 10000
        }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748B' }}>
            <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selectedFollowups.length}</strong> Selected
          </span>

          <button
            onClick={() => onNavigateTab && onNavigateTab('Opportunities')}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: '#334155',
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
            <Eye size={14} style={{ color: '#0E7490' }} /> View Details
          </button>

          <button
            onClick={() => {
              alert(`Rescheduling follow-up for ${selectedFollowups.length} selected record(s)`);
            }}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: '#334155',
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
            <Edit3 size={14} style={{ color: '#0E7490' }} /> Reschedule
          </button>

          <button
            onClick={() => {
              alert(`Marking ${selectedFollowups.length} follow-up(s) as completed`);
              setSelectedFollowups([]);
            }}
            style={{
              backgroundColor: '#0E7490',
              border: 'none',
              color: '#FFFFFF',
              borderRadius: '20px',
              padding: '6px 16px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Check size={14} /> Mark Completed
          </button>

          <button
            onClick={() => setSelectedFollowups([])}
            title="Deselect all"
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px'
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
