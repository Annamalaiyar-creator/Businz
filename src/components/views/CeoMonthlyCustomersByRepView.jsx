import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Building2, UserCheck, Search, Filter,
  Phone, Mail, MapPin, Download, RefreshCw, FileText,
  Award, CheckCircle, ExternalLink, X, Eye, Edit3, Trash2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { fetchCloudStore } from '../../utils/supabaseDataSync';

export default function CeoMonthlyCustomersByRepView({ userRole = 'CEO', onNavigateTab }) {
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Identity and Role Scoping
  const loggedInRole = userRole || localStorage.getItem('controlroom_user_role') || 'CEO';
  const isCeo = ['CEO', 'MD', 'Managing Director', 'Admin', 'Super Admin'].includes(loggedInRole);
  const loggedInEmpId = (localStorage.getItem('controlroom_logged_emp_id') || '').trim();
  const loggedInUserName = (localStorage.getItem('controlroom_logged_user_name') || '').trim();

  // Month-wise filter (defaults to current month 'YYYY-MM')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [selectedRep, setSelectedRep] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Row selection for standard table
  const [selectedCustomerRows, setSelectedCustomerRows] = useState([]);

  // Active customer for View Details drawer
  const [activeCustomerDetail, setActiveCustomerDetail] = useState(null);

  // Pagination states (strictly 5 and 10 per page per BUSINZ mandate)
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [pageJump, setPageJump] = useState('');

  // Helper date parsing
  const getCustomerDateStr = (c) => c?.createdAt || c?.created_at || c?.date || c?.onboardedDate || c?.updatedAt || '';

  const getRecordMonthKey = (dStr) => {
    if (!dStr) return null;
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const formatMonthLabel = (monthKey) => {
    if (!monthKey || monthKey === 'all') return 'All Months (Cumulative)';
    const parts = monthKey.split('-');
    if (parts.length !== 2) return monthKey;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  };

  // Helper to extract salesperson name cleanly
  const getRepName = (c) => {
    const raw = c?.assignedSalesperson || c?.salesPerson || c?.salesperson || c?.salesRep || c?.c8 || c?.createdBy || '';
    if (!raw || !raw.trim()) return 'Unassigned / Direct';
    return String(raw).replace(/\s*\([^)]*\)/g, '').trim();
  };

  // Check if customer belongs to the logged in salesperson
  const isCustomerOfSalesperson = (c) => {
    if (isCeo) return true;
    const rName = getRepName(c).toLowerCase();
    const uName = loggedInUserName.toLowerCase();
    const cEmpId = String(c?.createdById || c?.assignedSalespersonCode || c?.salesPersonCode || '').toLowerCase().trim();
    const myEmpId = loggedInEmpId.toLowerCase().trim();

    if (myEmpId && cEmpId && (cEmpId === myEmpId || (myEmpId === 'se-001' && cEmpId === 'se-1000') || (myEmpId === 'se-1000' && cEmpId === 'se-001'))) {
      return true;
    }
    if (uName && (rName.includes(uName) || uName.includes(rName))) {
      return true;
    }
    if (uName.includes('sales') && (rName.includes('sales') || rName.includes('annamalaiyar'))) {
      return true;
    }
    return false;
  };

  // Load customer data
  const loadCustomers = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      let loaded = [];
      // 1. Try native API first for fresh, deduplicated customer catalog
      try {
        const res = await fetch('/api/customers').catch(() => null);
        if (res && res.ok) {
          const json = await res.json().catch(() => null);
          const data = json?.data || json;
          if (Array.isArray(data) && data.length > 0) loaded = data;
        }
      } catch (_) {}

      // 2. Try Supabase cloud fallback if needed
      if (loaded.length === 0) {
        const cloudData = await fetchCloudStore('customer_store', []).catch(() => []);
        if (Array.isArray(cloudData) && cloudData.length > 0) loaded = cloudData;
      }

      // 3. Local storage fallback only if offline / empty
      if (loaded.length === 0) {
        try {
          const local = JSON.parse(localStorage.getItem('controlroom_customer_store') || localStorage.getItem('controlroom_customer_list') || '[]');
          if (Array.isArray(local) && local.length > 0) loaded = local;
        } catch (_) {}
      }

      // Deduplicate loaded customers so each customer is counted once
      const normName = (n) => String(n || '').toLowerCase().replace(/\b(private|pvt|limited|ltd|llp|inc|corporation|corp|enterprises|solutions)\b/g, '').replace(/[^a-z0-9]/g, '').trim();
      const normGst = (g) => {
        const clean = String(g || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
        return clean.length >= 10 ? clean : '';
      };
      const dedupMap = new Map();
      (loaded || []).forEach(c => {
        if (!c) return;
        const gKey = normGst(c.gstNumber || c.gstNo || c.gstin);
        const nKey = normName(c.companyName || c.customerName || c.name);
        const rawCode = String(c.customerCode || c.id || c.code || '').trim();
        const isRealCode = rawCode && !rawCode.toLowerCase().startsWith('cust-') && !rawCode.toLowerCase().startsWith('cust_');
        const dedupKey = gKey ? `gst_${gKey}` : (nKey ? `name_${nKey}` : `code_${rawCode.toLowerCase()}`);
        if (!dedupMap.has(dedupKey)) {
          dedupMap.set(dedupKey, c);
        } else {
          const existing = dedupMap.get(dedupKey);
          const existingHasRealCode = existing.customerCode && !existing.customerCode.toLowerCase().startsWith('cust-');
          const existingHasGst = normGst(existing.gstNumber || existing.gstNo || existing.gstin);
          const cHasGst = normGst(c.gstNumber || c.gstNo || c.gstin);
          const preferred = (isRealCode && !existingHasRealCode) ? c : existing;
          dedupMap.set(dedupKey, {
            ...existing,
            ...c,
            id: isRealCode ? c.customerCode || c.id : preferred.id,
            customerCode: isRealCode ? c.customerCode || c.code : preferred.customerCode,
            gstNumber: cHasGst || existingHasGst || preferred.gstNumber || '',
            gstNo: cHasGst || existingHasGst || preferred.gstNo || '',
            createdAt: existing.createdAt || c.createdAt
          });
        }
      });

      setCustomers(Array.from(dedupMap.values()));
    } catch (err) {
      console.warn('Error loading customers for monthly view:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // Scoped customers according to role
  const scopedCustomers = useMemo(() => {
    if (isCeo) return customers;
    return customers.filter(c => isCustomerOfSalesperson(c));
  }, [customers, isCeo, loggedInUserName, loggedInEmpId]);

  // Extract all available months across scoped customers
  const availableMonths = useMemo(() => {
    const monthSet = new Set();
    const now = new Date();
    const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthSet.add(curMonthKey);

    scopedCustomers.forEach(c => {
      const mk = getRecordMonthKey(getCustomerDateStr(c));
      if (mk) monthSet.add(mk);
    });

    return Array.from(monthSet).sort().reverse();
  }, [scopedCustomers]);

  // Distinct salespersons list across scoped customers
  const distinctReps = useMemo(() => {
    const repSet = new Set();
    scopedCustomers.forEach(c => {
      const r = getRepName(c);
      if (r) repSet.add(r);
    });
    return Array.from(repSet).sort();
  }, [scopedCustomers]);

  // Scoped customers for selected month
  const monthlyCustomers = useMemo(() => {
    return scopedCustomers.filter(c => {
      if (selectedMonth !== 'all') {
        const mk = getRecordMonthKey(getCustomerDateStr(c));
        if (mk !== selectedMonth) return false;
      }
      return true;
    });
  }, [scopedCustomers, selectedMonth]);

  // Grouped customer counts by sales person for selected month
  const repBreakdown = useMemo(() => {
    const map = {};
    monthlyCustomers.forEach(c => {
      const r = getRepName(c);
      if (!map[r]) map[r] = { repName: r, count: 0, customers: [] };
      map[r].count += 1;
      map[r].customers.push(c);
    });

    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [monthlyCustomers]);

  // Final filtered customer list for table (respecting selected rep & search query)
  const filteredCustomers = useMemo(() => {
    return monthlyCustomers.filter(c => {
      if (isCeo && selectedRep !== 'all') {
        const r = getRepName(c);
        if (r.toLowerCase() !== selectedRep.toLowerCase()) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const cName = String(c.customerName || c.companyName || c.code || '').toLowerCase();
        const contact = String(c.contactPerson || c.c3 || c.primaryContact?.name || '').toLowerCase();
        const phone = String(c.phone || c.c4 || c.mobile || '').toLowerCase();
        const gst = String(c.gstNumber || c.gstNo || '').toLowerCase();
        const city = String(c.city || c.dispatchCity || '').toLowerCase();
        const rName = getRepName(c).toLowerCase();

        if (!cName.includes(q) && !contact.includes(q) && !phone.includes(q) && !gst.includes(q) && !city.includes(q) && !rName.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [monthlyCustomers, selectedRep, searchQuery, isCeo]);

  // Executive Monthly KPIs
  const kpis = useMemo(() => {
    const totalCount = monthlyCustomers.length;
    const topRep = repBreakdown[0] || null;
    const gstCount = monthlyCustomers.filter(c => (c.gstNumber || c.gstNo || '').trim().length >= 10).length;
    const activeRepsCount = repBreakdown.filter(r => r.repName !== 'Unassigned / Direct').length;

    return {
      totalCount,
      topRepName: topRep ? topRep.repName : '—',
      topRepCount: topRep ? topRep.count : 0,
      gstCount,
      gstPct: totalCount > 0 ? ((gstCount / totalCount) * 100).toFixed(0) : '0',
      activeRepsCount
    };
  }, [monthlyCustomers, repBreakdown]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentRows = filteredCustomers.slice(startIndex, startIndex + rowsPerPage);

  // CSV Export
  const handleExportCsv = () => {
    const headers = ['#', 'Customer Name', 'Assigned Sales Person', 'GST Number', 'Contact Person', 'Phone', 'Email', 'City', 'State', 'Onboarding Date'];
    const rows = (selectedCustomerRows.length > 0
      ? filteredCustomers.filter(c => selectedCustomerRows.includes(c.id || c.customerCode || c.code))
      : filteredCustomers
    ).map((c, i) => [
      i + 1,
      `"${(c.customerName || c.companyName || c.code || '').replace(/"/g, '""')}"`,
      `"${getRepName(c).replace(/"/g, '""')}"`,
      c.gstNumber || c.gstNo || 'Unregistered',
      `"${(c.contactPerson || c.c3 || c.primaryContact?.name || '').replace(/"/g, '""')}"`,
      c.phone || c.c4 || c.mobile || '',
      c.email || c.c5 || '',
      `"${(c.city || c.dispatchCity || '').replace(/"/g, '""')}"`,
      `"${(c.state || c.dispatchState || '').replace(/"/g, '""')}"`,
      getCustomerDateStr(c)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `New_Monthly_Customers_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', minWidth: 0, paddingBottom: '90px', boxSizing: 'border-box' }}>
      
      {/* 1. TOP HEADER (BUSINZ DESIGN SYSTEM) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.2px' }}>
              New Monthly Customers
            </h2>
            <span style={{ fontSize: '11px', fontWeight: '800', backgroundColor: '#ECFEFF', color: '#0E7490', border: '1px solid #A5F3FC', padding: '2px 8px', borderRadius: '12px' }}>
              {isCeo ? 'CEO EXECUTIVE OVERVIEW' : 'MY CLIENT ONBOARDING'}
            </span>
          </div>
          <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
            {isCeo
              ? 'Track newly onboarded customer accounts for the selected month across all sales representatives.'
              : 'Your new client accounts created and onboarded this month.'}
          </span>
        </div>

        {/* Global Action Controls (Calendar Icon REMOVED per user mandate) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <select
            id="monthly-customers-period-select"
            name="selectedMonth"
            aria-label="Filter by month"
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              height: '38px',
              borderRadius: '8px',
              border: '1.5px solid #0E7490',
              padding: '0 12px',
              fontSize: '12.5px',
              fontWeight: '700',
              color: '#0E7490',
              backgroundColor: '#ECFEFF',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="all">All Months (Cumulative)</option>
            {availableMonths.map(mk => (
              <option key={mk} value={mk}>{formatMonthLabel(mk)}</option>
            ))}
          </select>

          <button
            onClick={() => loadCustomers(true)}
            disabled={isRefreshing}
            style={{
              height: '38px',
              padding: '0 14px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: isRefreshing ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Syncing...' : 'Refresh'}
          </button>

          <button
            onClick={handleExportCsv}
            style={{
              height: '38px',
              padding: '0 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#0E7490',
              color: '#FFFFFF',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(14, 116, 144, 0.25)'
            }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* 2. STATS RIBBON */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {/* KPI 1 */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            backgroundColor: '#ECFEFF',
            color: '#0E7490',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Building2 size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block' }}>
              {isCeo ? 'New Accounts Added' : 'My New Customers'}
            </span>
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', display: 'block', lineHeight: 1.2 }}>
              {kpis.totalCount} <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>in {formatMonthLabel(selectedMonth)}</span>
            </span>
          </div>
        </div>

        {/* KPI 2 */}
        {isCeo ? (
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
          }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: '#F0FDF4',
              color: '#16A34A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Award size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block' }}>
                Top Acquiring Rep
              </span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#16A34A', display: 'block', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {kpis.topRepName} ({kpis.topRepCount})
              </span>
            </div>
          </div>
        ) : (
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
          }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: '#F0FDF4',
              color: '#16A34A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Award size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block' }}>
                Acquisition Share
              </span>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#16A34A', display: 'block', lineHeight: 1.2 }}>
                100% Personal Target
              </span>
            </div>
          </div>
        )}

        {/* KPI 3 */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            backgroundColor: '#FEF3C7',
            color: '#D97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <CheckCircle size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block' }}>
              GST Registered Corporate
            </span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#D97706', display: 'block', lineHeight: 1.2 }}>
              {kpis.gstCount} <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>({kpis.gstPct}%)</span>
            </span>
          </div>
        </div>

        {/* KPI 4 */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            backgroundColor: '#F3E8FF',
            color: '#9333EA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Users size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block' }}>
              {isCeo ? 'Active Acquiring Reps' : 'Created By'}
            </span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#9333EA', display: 'block', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isCeo ? `${kpis.activeRepsCount} Sales Reps` : (loggedInUserName || 'Sales Executive')}
            </span>
          </div>
        </div>
      </div>

      {/* 3. CEO-ONLY SALES PERSON BREAKDOWN QUICK PILLS */}
      {isCeo && repBreakdown.length > 0 && (
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '12.5px', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Sales Person Acquisition Breakdown ({formatMonthLabel(selectedMonth)})
            </strong>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Click a card to filter customer records below
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
            <button
              onClick={() => {
                setSelectedRep('all');
                setCurrentPage(1);
              }}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: selectedRep === 'all' ? '2px solid #0E7490' : '1px solid #E2E8F0',
                backgroundColor: selectedRep === 'all' ? '#ECFEFF' : '#F8FAFC',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: '700', color: selectedRep === 'all' ? '#0E7490' : '#475569' }}>
                All Sales Reps
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '18px', fontWeight: '900', color: '#0F172A' }}>{monthlyCustomers.length}</span>
                <span style={{ fontSize: '11px', color: '#64748B' }}>new clients</span>
              </div>
            </button>

            {repBreakdown.map((r, idx) => {
              const isSelected = selectedRep.toLowerCase() === r.repName.toLowerCase();
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedRep(isSelected ? 'all' : r.repName);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid #0E7490' : '1px solid #E2E8F0',
                    backgroundColor: isSelected ? '#ECFEFF' : '#FFFFFF',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: isSelected ? '#0E7490' : '#E2E8F0',
                      color: isSelected ? '#FFFFFF' : '#475569',
                      fontSize: '10px',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {r.repName[0]?.toUpperCase()}
                    </div>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '700',
                      color: isSelected ? '#0E7490' : '#0F172A',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {r.repName}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '18px', fontWeight: '900', color: isSelected ? '#0E7490' : '#0F172A' }}>
                      {r.count}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>
                      ({monthlyCustomers.length > 0 ? ((r.count / monthlyCustomers.length) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. FILTERS & SEARCH ROW */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        padding: '12px 16px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid #CBD5E1',
          borderRadius: '8px',
          padding: '0 12px',
          height: '38px',
          backgroundColor: '#F8FAFC',
          flex: '1 1 280px',
          maxWidth: '420px'
        }}>
          <Search size={15} style={{ color: '#64748B' }} />
          <input
            type="text"
            placeholder="Search by customer name, GST, contact, mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              fontSize: '12.5px',
              width: '100%',
              color: '#0F172A'
            }}
          />
        </div>

        {isCeo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
              Filter Sales Rep:
            </span>
            <select
              value={selectedRep}
              onChange={(e) => {
                setSelectedRep(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                height: '38px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                padding: '0 12px',
                fontSize: '12.5px',
                fontWeight: '700',
                color: '#0F172A',
                backgroundColor: '#FFFFFF',
                outline: 'none'
              }}
            >
              <option value="all">All Sales Representatives ({monthlyCustomers.length})</option>
              {distinctReps.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 5. MAIN DATA TABLE (STANDARD BUSINZ TABLE SYSTEM) */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                <th style={{ width: '48px', textAlign: 'center', padding: '12px 0' }}>
                  <input
                    type="checkbox"
                    style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                    checked={filteredCustomers.length > 0 && filteredCustomers.every(c => selectedCustomerRows.includes(c.id || c.customerCode || c.code))}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedCustomerRows(filteredCustomers.map(c => c.id || c.customerCode || c.code));
                      else setSelectedCustomerRows([]);
                    }}
                  />
                </th>
                <th style={{ padding: '12px 14px' }}>Customer / Company Name</th>
                {isCeo && <th style={{ padding: '12px 14px' }}>Sales Person (Rep)</th>}
                <th style={{ padding: '12px 14px' }}>GST Number</th>
                <th style={{ padding: '12px 14px' }}>Primary Contact</th>
                <th style={{ padding: '12px 14px' }}>Location</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Customer Type</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Onboarding Date</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={isCeo ? 9 : 8} style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                    Loading customer accounts for {formatMonthLabel(selectedMonth)}...
                  </td>
                </tr>
              ) : currentRows.length === 0 ? (
                <tr>
                  <td colSpan={isCeo ? 9 : 8} style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                    No customer accounts onboarded for {formatMonthLabel(selectedMonth)} matching current filters.
                  </td>
                </tr>
              ) : (
                currentRows.map((c, idx) => {
                  const cKey = c.id || c.customerCode || c.code || `cust-${idx}`;
                  const isChecked = selectedCustomerRows.includes(cKey);
                  const rep = getRepName(c);
                  const cName = c.customerName || c.companyName || c.code || 'Direct Customer';
                  const contact = c.contactPerson || c.c3 || c.primaryContact?.name || '—';
                  const phone = c.phone || c.c4 || c.mobile || c.primaryContact?.phone || '';
                  const city = c.city || c.dispatchCity || c.billingCity || '—';
                  const state = c.state || c.dispatchState || c.billingState || '';
                  const dStr = getCustomerDateStr(c);

                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: isChecked ? '#ECFEFF' : 'transparent',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      <td style={{
                        textAlign: 'center',
                        padding: '12px 0',
                        borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent'
                      }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                          onChange={() => {
                            setSelectedCustomerRows(prev =>
                              prev.includes(cKey) ? prev.filter(k => k !== cKey) : [...prev, cKey]
                            );
                          }}
                        />
                      </td>

                      {/* Customer Name */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '13px' }}>
                          {cName}
                        </div>
                        {c.customerCode && (
                          <span style={{ fontSize: '10.5px', color: '#0E7490', fontFamily: 'monospace', fontWeight: '700' }}>
                            {c.customerCode}
                          </span>
                        )}
                      </td>

                      {/* Sales Person (CEO View) */}
                      {isCeo && (
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              backgroundColor: '#ECFEFF',
                              color: '#0E7490',
                              border: '1px solid #A5F3FC',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: '800',
                              flexShrink: 0
                            }}>
                              {rep[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: '700', fontSize: '12.5px', color: '#0F172A' }}>
                                {rep}
                              </div>
                              {c.assignedSalespersonCode && (
                                <span style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace' }}>
                                  {c.assignedSalespersonCode}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      )}

                      {/* GST */}
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#475569', fontSize: '12px' }}>
                        {c.gstNumber || c.gstNo || 'Unregistered'}
                      </td>

                      {/* Primary Contact */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '600', color: '#0F172A' }}>{contact}</div>
                        {phone && <div style={{ fontSize: '11px', color: '#64748B' }}>{phone}</div>}
                      </td>

                      {/* Location */}
                      <td style={{ padding: '12px 14px', color: '#475569', fontSize: '12px' }}>
                        <div>{city}</div>
                        {state && <div style={{ fontSize: '11px', color: '#94A3B8' }}>{state}</div>}
                      </td>

                      {/* Customer Type */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          backgroundColor: '#F1F5F9',
                          color: '#475569',
                          border: '1px solid #E2E8F0',
                          whiteSpace: 'nowrap'
                        }}>
                          {c.customerType || 'EPC Contractor'}
                        </span>
                      </td>

                      {/* Date */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: '#64748B', whiteSpace: 'nowrap' }}>
                        {dStr ? (dStr.split('T')[0] || dStr) : '—'}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          onClick={() => setActiveCustomerDetail(c)}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: '#ECFEFF',
                            color: '#0E7490',
                            border: '1px solid #A5F3FC',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Eye size={12} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Standard Pagination Footer (Strictly [5, 10] per page per BUSINZ mandate) */}
        {filteredCustomers.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', fontSize: '13px', color: '#64748B', borderTop: '1px solid #F1F5F9', backgroundColor: '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Showing per page</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  style={{ height: '32px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', padding: '0 8px', fontWeight: 'bold' }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                </select>
              </div>
              <span>Showing {startIndex + 1} to {Math.min(startIndex + rowsPerPage, filteredCustomers.length)} of {filteredCustomers.length} entries</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  style={{ border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                >
                  &laquo;
                </button>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  style={{ border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  &lt;
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, currentPage - 2), currentPage + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    style={{
                      border: '1px solid #E2E8F0',
                      backgroundColor: p === currentPage ? '#0E7490' : '#FFFFFF',
                      color: p === currentPage ? '#FFFFFF' : '#475569',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontWeight: p === currentPage ? 'bold' : 'normal',
                      cursor: 'pointer'
                    }}
                  >
                    {p}
                  </button>
                ))}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  style={{ border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: '6px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  &gt;
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  style={{ border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: '6px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                >
                  &raquo;
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Go to page</span>
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={pageJump}
                  onChange={(e) => setPageJump(e.target.value)}
                  style={{ width: '45px', height: '32px', textAlign: 'center', borderRadius: '6px', border: '1px solid #CBD5E1' }}
                />
                <button
                  onClick={() => {
                    const p = parseInt(pageJump, 10);
                    if (p >= 1 && p <= totalPages) setCurrentPage(p);
                  }}
                  style={{ height: '32px', padding: '0 10px', borderRadius: '6px', border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Go &rsaquo;
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. FLOATING BOTTOM ACTION BAR (SINGLE LINE, ZERO 3-DOT MENUS) */}
      {selectedCustomerRows.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#0F172A',
          color: '#FFFFFF',
          padding: '10px 24px',
          borderRadius: '50px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          zIndex: 1000,
          whiteSpace: 'nowrap',
          flexDirection: 'row',
          flexWrap: 'nowrap'
        }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#38BDF8' }}>
            {selectedCustomerRows.length} Selected
          </span>
          <div style={{ height: '16px', width: '1px', backgroundColor: '#334155' }} />
          <button
            onClick={() => {
              const firstId = selectedCustomerRows[0];
              const match = filteredCustomers.find(c => (c.id || c.customerCode || c.code) === firstId);
              if (match) setActiveCustomerDetail(match);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Eye size={14} color="#38BDF8" /> View Details
          </button>
          <div style={{ height: '16px', width: '1px', backgroundColor: '#334155' }} />
          <button
            onClick={handleExportCsv}
            style={{
              background: 'none',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={14} color="#38BDF8" /> Export Selected
          </button>
          <div style={{ height: '16px', width: '1px', backgroundColor: '#334155' }} />
          <button
            onClick={() => setSelectedCustomerRows([])}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 7. CUSTOMER DETAIL SLIDE-OVER DRAWER */}
      {activeCustomerDetail && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(3px)',
          zIndex: 1100,
          display: 'flex',
          justifyContent: 'flex-end'
        }}
        onClick={() => setActiveCustomerDetail(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '520px',
              height: '100%',
              backgroundColor: '#FFFFFF',
              boxShadow: '-8px 0 25px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideInRight 0.25s ease'
            }}
          >
            {/* Drawer Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Customer Profile
                </span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>
                  {activeCustomerDetail.customerName || activeCustomerDetail.companyName || 'Customer Details'}
                </h3>
              </div>
              <button
                onClick={() => setActiveCustomerDetail(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: '6px', borderRadius: '6px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
              {/* Account Overview Box */}
              <div style={{ backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>Customer Code</span>
                    <strong style={{ fontSize: '13px', color: '#0E7490', fontFamily: 'monospace' }}>
                      {activeCustomerDetail.customerCode || activeCustomerDetail.code || '—'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>GST Number</span>
                    <strong style={{ fontSize: '13px', color: '#0F172A', fontFamily: 'monospace' }}>
                      {activeCustomerDetail.gstNumber || activeCustomerDetail.gstNo || 'Unregistered'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>Assigned Sales Rep</span>
                    <strong style={{ fontSize: '13px', color: '#0F172A' }}>
                      {getRepName(activeCustomerDetail)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>Onboarding Date</span>
                    <strong style={{ fontSize: '13px', color: '#0F172A' }}>
                      {getCustomerDateStr(activeCustomerDetail) ? String(getCustomerDateStr(activeCustomerDetail)).split('T')[0] : '—'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Contact Information
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#1E293B' }}>
                    <Users size={16} color="#64748B" />
                    <span>Contact: <strong>{activeCustomerDetail.contactPerson || activeCustomerDetail.c3 || '—'}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#1E293B' }}>
                    <Phone size={16} color="#64748B" />
                    <span>Phone: <strong>{activeCustomerDetail.phone || activeCustomerDetail.c4 || activeCustomerDetail.mobile || '—'}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#1E293B' }}>
                    <Mail size={16} color="#64748B" />
                    <span>Email: <strong>{activeCustomerDetail.email || activeCustomerDetail.c5 || '—'}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#1E293B' }}>
                    <MapPin size={16} color="#64748B" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span>
                      Address: {activeCustomerDetail.address || activeCustomerDetail.street || activeCustomerDetail.c6 || '—'}, {activeCustomerDetail.city || ''} {activeCustomerDetail.state || ''} {activeCustomerDetail.pincode || ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Commercial Terms */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Commercial Profile
                </h4>
                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>Customer Type</span>
                    <strong style={{ fontSize: '12.5px', color: '#0F172A' }}>{activeCustomerDetail.customerType || 'EPC Contractor'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>Payment Terms</span>
                    <strong style={{ fontSize: '12.5px', color: '#0F172A' }}>{activeCustomerDetail.paymentTerms || '100% Advance'}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#F8FAFC' }}>
              <button
                onClick={() => setActiveCustomerDetail(null)}
                style={{ padding: '8px 18px', backgroundColor: '#0E7490', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
