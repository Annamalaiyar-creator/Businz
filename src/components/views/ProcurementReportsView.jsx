import React, { useState, useEffect, useMemo } from 'react';
import {
  FileBarChart, ShoppingCart, FileCheck, Building2, Calendar, Search,
  Download, RefreshCw, Layers, ArrowUpRight, Filter, ChevronLeft, ChevronRight,
  TrendingUp, CheckCircle, Clock, AlertTriangle, Boxes, Tag, ShieldCheck, MapPin
} from 'lucide-react';
import { getPurchaseOrders, getVendors } from '../../services/businzDataService';
import { fetchCloudStore } from '../../utils/supabaseDataSync';

export default function ProcurementReportsView({ userRole = 'Procurement Head', onNavigateTab }) {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [grnList, setGrnList] = useState([]);
  const [vendorsList, setVendorsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active Report Tab: 'po_ledger' | 'vendor_spend' | 'grn_ledger'
  const [activeReportTab, setActiveReportTab] = useState('po_ledger');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendorFilter, setSelectedVendorFilter] = useState('all');

  // Month-wise filter: defaults to current month 'YYYY-MM'
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Interactive row selection
  const [selectedPoRows, setSelectedPoRows] = useState([]);
  const [selectedVendorRows, setSelectedVendorRows] = useState([]);
  const [selectedGrnRows, setSelectedGrnRows] = useState([]);

  // Pagination states (strictly 5 and 10 per page per BUSINZ rules)
  const [poPage, setPoPage] = useState(1);
  const [poRpp, setPoRpp] = useState(10);
  const [poGoTo, setPoGoTo] = useState('');

  const [vendorPage, setVendorPage] = useState(1);
  const [vendorRpp, setVendorRpp] = useState(10);
  const [vendorGoTo, setVendorGoTo] = useState('');

  const [grnPage, setGrnPage] = useState(1);
  const [grnRpp, setGrnRpp] = useState(10);
  const [grnGoTo, setGrnGoTo] = useState('');

  // Initial Data Load
  const loadData = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      // 1. Load POs
      const pos = await getPurchaseOrders().catch(() => []);
      setPurchaseOrders(Array.isArray(pos) ? pos : []);

      // 2. Load GRNs
      let grns = [];
      try {
        const localGrns = JSON.parse(localStorage.getItem('controlroom_central_grns_v2') || localStorage.getItem('goods_receipt_notes') || '[]');
        if (Array.isArray(localGrns) && localGrns.length > 0) grns = localGrns;
      } catch (_) {}
      if (grns.length === 0) {
        const cloudGrns = await fetchCloudStore('goods_receipt_notes', []).catch(() => []);
        if (Array.isArray(cloudGrns) && cloudGrns.length > 0) grns = cloudGrns;
      }
      setGrnList(grns);

      // 3. Load Vendors
      const vends = await getVendors().catch(() => []);
      setVendorsList(Array.isArray(vends) ? vends : []);
    } catch (err) {
      console.warn('Error loading procurement reports data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper date parsing
  const getPoDateStr = (po) => po.date || po.poDate || po.createdAt || po.created_at || '';
  const getGrnDateStr = (grn) => grn.date || grn.receivedDate || grn.createdAt || grn.created_at || '';

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

  const cleanNum = (val) => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    const n = parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const formatCurrency = (num) => {
    if (!num || isNaN(num)) return '₹ 0.00';
    return `₹ ${Math.round(num).toLocaleString('en-IN')}`;
  };

  const formatCurrencyShort = (num) => {
    if (!num || isNaN(num)) return '₹ 0.00 L';
    if (num >= 10000000) return `₹ ${(num / 10000000).toFixed(2)} Cr`;
    return `₹ ${(num / 100000).toFixed(2)} L`;
  };

  // Extract all available months across POs and GRNs
  const availableMonths = useMemo(() => {
    const monthSet = new Set();
    const now = new Date();
    const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthSet.add(curMonthKey);

    purchaseOrders.forEach(po => {
      const mk = getRecordMonthKey(getPoDateStr(po));
      if (mk) monthSet.add(mk);
    });

    grnList.forEach(grn => {
      const mk = getRecordMonthKey(getGrnDateStr(grn));
      if (mk) monthSet.add(mk);
    });

    return Array.from(monthSet).sort().reverse();
  }, [purchaseOrders, grnList]);

  // Scoped POs matching selected month and vendor
  const filteredPos = useMemo(() => {
    return purchaseOrders.filter(po => {
      if (selectedMonth !== 'all') {
        const mk = getRecordMonthKey(getPoDateStr(po));
        if (mk !== selectedMonth) return false;
      }
      if (selectedVendorFilter !== 'all') {
        const vName = (po.vendorName || po.vendor || '').trim().toLowerCase();
        if (vName !== selectedVendorFilter.toLowerCase()) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const pNo = String(po.poNo || po.id || '').toLowerCase();
        const vName = String(po.vendorName || po.vendor || '').toLowerCase();
        const loc = String(po.deliveryLocation || po.shippingAddress || '').toLowerCase();
        const st = String(po.status || '').toLowerCase();
        if (!pNo.includes(q) && !vName.includes(q) && !loc.includes(q) && !st.includes(q)) return false;
      }
      return true;
    });
  }, [purchaseOrders, selectedMonth, selectedVendorFilter, searchQuery]);

  // Scoped GRNs matching selected month
  const filteredGrns = useMemo(() => {
    return grnList.filter(grn => {
      if (selectedMonth !== 'all') {
        const mk = getRecordMonthKey(getGrnDateStr(grn));
        if (mk !== selectedMonth) return false;
      }
      if (selectedVendorFilter !== 'all') {
        const vName = (grn.vendorName || grn.vendor || '').trim().toLowerCase();
        if (vName !== selectedVendorFilter.toLowerCase()) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const gNo = String(grn.grnNo || grn.id || '').toLowerCase();
        const pNo = String(grn.poNo || '').toLowerCase();
        const vName = String(grn.vendorName || grn.vendor || '').toLowerCase();
        if (!gNo.includes(q) && !pNo.includes(q) && !vName.includes(q)) return false;
      }
      return true;
    });
  }, [grnList, selectedMonth, selectedVendorFilter, searchQuery]);

  // Vendor Spend Summary for selected month
  const vendorSpendSummary = useMemo(() => {
    const map = {};
    filteredPos.forEach(po => {
      const vName = (po.vendorName || po.vendor || 'Unknown Vendor').trim();
      const amt = cleanNum(po.totalAmount || po.grandTotal || po.amount);
      if (!map[vName]) {
        map[vName] = { vendorName: vName, poCount: 0, totalSpend: 0, pos: [] };
      }
      map[vName].poCount += 1;
      map[vName].totalSpend += amt;
      map[vName].pos.push(po);
    });

    const totalSpendAll = Object.values(map).reduce((acc, v) => acc + v.totalSpend, 0);

    return Object.values(map)
      .map(v => ({
        ...v,
        avgPoValue: v.poCount > 0 ? v.totalSpend / v.poCount : 0,
        sharePct: totalSpendAll > 0 ? ((v.totalSpend / totalSpendAll) * 100).toFixed(1) : '0.0'
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);
  }, [filteredPos]);

  // Executive Month-Wise Metrics
  const monthlyMetrics = useMemo(() => {
    const totalSpend = filteredPos.reduce((acc, po) => acc + cleanNum(po.totalAmount || po.grandTotal || po.amount), 0);
    const authorizedPos = filteredPos.filter(po => {
      const st = String(po.status || '').toLowerCase();
      return st === 'authorized' || st === 'md approved' || st === 'completed' || st === 'issued';
    }).length;
    const pendingPos = filteredPos.filter(po => {
      const st = String(po.status || '').toLowerCase();
      return st === 'waiting for approval' || st === 'draft' || st === 'pending';
    }).length;
    const activeVendors = new Set(filteredPos.map(po => (po.vendorName || po.vendor || '').trim()).filter(Boolean)).size;
    const totalGrns = filteredGrns.length;

    return {
      totalSpend,
      totalSpendFormatted: formatCurrencyShort(totalSpend),
      totalSpendExact: formatCurrency(totalSpend),
      poCount: filteredPos.length,
      authorizedPos,
      pendingPos,
      activeVendors,
      totalGrns
    };
  }, [filteredPos, filteredGrns]);

  // Distinct vendors for dropdown
  const allDistinctVendors = useMemo(() => {
    const set = new Set();
    purchaseOrders.forEach(po => {
      const v = (po.vendorName || po.vendor || '').trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort();
  }, [purchaseOrders]);

  // Pagination for PO Ledger
  const poTotalPages = Math.max(1, Math.ceil(filteredPos.length / poRpp));
  const poStartIndex = (poPage - 1) * poRpp;
  const currentPos = filteredPos.slice(poStartIndex, poStartIndex + poRpp);

  // Pagination for Vendor Summary
  const vendorTotalPages = Math.max(1, Math.ceil(vendorSpendSummary.length / vendorRpp));
  const vendorStartIndex = (vendorPage - 1) * vendorRpp;
  const currentVendors = vendorSpendSummary.slice(vendorStartIndex, vendorStartIndex + vendorRpp);

  // Pagination for GRN Ledger
  const grnTotalPages = Math.max(1, Math.ceil(filteredGrns.length / grnRpp));
  const grnStartIndex = (grnPage - 1) * grnRpp;
  const currentGrns = filteredGrns.slice(grnStartIndex, grnStartIndex + grnRpp);

  // CSV Export
  const handleExportCsv = () => {
    let headers = [];
    let rows = [];
    let filename = `Procurement_Report_${selectedMonth}.csv`;

    if (activeReportTab === 'po_ledger') {
      headers = ['PO Number', 'Date', 'Vendor Name', 'Items Count', 'Total Amount', 'Status', 'Delivery Location'];
      rows = filteredPos.map(po => [
        po.poNo || po.id,
        getPoDateStr(po),
        `"${(po.vendorName || po.vendor || '').replace(/"/g, '""')}"`,
        Array.isArray(po.items) ? po.items.length : 1,
        cleanNum(po.totalAmount || po.grandTotal || po.amount),
        po.status || 'Issued',
        `"${(po.deliveryLocation || po.shippingAddress || '').replace(/"/g, '""')}"`
      ]);
    } else if (activeReportTab === 'vendor_spend') {
      headers = ['Vendor Name', 'PO Orders Count', 'Total Spend (INR)', 'Share of Spend %', 'Avg Order Value (INR)'];
      rows = vendorSpendSummary.map(v => [
        `"${v.vendorName.replace(/"/g, '""')}"`,
        v.poCount,
        Math.round(v.totalSpend),
        v.sharePct,
        Math.round(v.avgPoValue)
      ]);
      filename = `Vendor_Spend_Analysis_${selectedMonth}.csv`;
    } else {
      headers = ['GRN Number', 'PO Number', 'Received Date', 'Vendor Name', 'Status'];
      rows = filteredGrns.map(grn => [
        grn.grnNo || grn.id,
        grn.poNo || '',
        getGrnDateStr(grn),
        `"${(grn.vendorName || grn.vendor || '').replace(/"/g, '""')}"`,
        grn.status || 'Completed'
      ]);
      filename = `GRN_Receipts_${selectedMonth}.csv`;
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      
      {/* 1. HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: '#ECFEFF',
              color: '#0E7490',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileBarChart size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#0F172A', letterSpacing: '-0.3px' }}>
                Procurement & Spend Reports
              </h2>
              <span style={{ fontSize: '12.5px', color: '#64748B' }}>
                Executive Procurement Analytics • Monthly purchase spend, vendor volume allocation, and Goods Receipt Note (GRN) reconciliation.
              </span>
            </div>
          </div>
        </div>

        {/* Global Controls: Month Selector, Refresh, Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} style={{ color: '#0E7490' }} />
            <select
              id="procurement-report-month-select"
              name="selectedMonth"
              aria-label="Filter report by month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setPoPage(1);
                setVendorPage(1);
                setGrnPage(1);
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
          </div>

          <button
            onClick={() => loadData(true)}
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

      {/* 2. MONTH-WISE KPI SUMMARY RIBBON */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '14px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {/* KPI 1: Total Spend */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>
              Total Procurement Spend
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#ECFEFF', color: '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart size={15} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '24px', fontWeight: '900', color: '#0F172A', letterSpacing: '-0.5px' }}>
              {monthlyMetrics.totalSpendFormatted}
            </span>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
              ({monthlyMetrics.totalSpendExact})
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', backgroundColor: '#F8FAFC', padding: '4px 8px', borderRadius: '6px' }}>
            <span>Target period: </span>
            <strong style={{ color: '#0E7490' }}>{formatMonthLabel(selectedMonth)}</strong>
          </div>
        </div>

        {/* KPI 2: POs Issued */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>
              Purchase Orders (Monthly)
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={15} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '24px', fontWeight: '900', color: '#16A34A', letterSpacing: '-0.5px' }}>
              {monthlyMetrics.poCount} Orders
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', backgroundColor: '#F8FAFC', padding: '4px 8px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Authorized: <strong style={{ color: '#16A34A' }}>{monthlyMetrics.authorizedPos}</strong></span>
            <span>Pending MD: <strong style={{ color: '#D97706' }}>{monthlyMetrics.pendingPos}</strong></span>
          </div>
        </div>

        {/* KPI 3: GRN Receipts */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>
              GRN Inward Receipts
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileCheck size={15} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '24px', fontWeight: '900', color: '#D97706', letterSpacing: '-0.5px' }}>
              {monthlyMetrics.totalGrns} Receipts
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', backgroundColor: '#F8FAFC', padding: '4px 8px', borderRadius: '6px' }}>
            <span>Warehouse inward reconciliation complete</span>
          </div>
        </div>

        {/* KPI 4: Active Suppliers */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>
              Active Vendors Transacted
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#F3E8FF', color: '#9333EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={15} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '24px', fontWeight: '900', color: '#9333EA', letterSpacing: '-0.5px' }}>
              {monthlyMetrics.activeVendors} Suppliers
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', backgroundColor: '#F8FAFC', padding: '4px 8px', borderRadius: '6px' }}>
            <span>Monthly supply chain diversification</span>
          </div>
        </div>
      </div>

      {/* 3. REPORT SUB-TABS & FILTERS BAR */}
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
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveReportTab('po_ledger')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: activeReportTab === 'po_ledger' ? '1.5px solid #0E7490' : '1px solid #E2E8F0',
              backgroundColor: activeReportTab === 'po_ledger' ? '#ECFEFF' : '#FFFFFF',
              color: activeReportTab === 'po_ledger' ? '#0E7490' : '#475569',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ShoppingCart size={14} /> Monthly PO Spend Ledger ({filteredPos.length})
          </button>

          <button
            onClick={() => setActiveReportTab('vendor_spend')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: activeReportTab === 'vendor_spend' ? '1.5px solid #0E7490' : '1px solid #E2E8F0',
              backgroundColor: activeReportTab === 'vendor_spend' ? '#ECFEFF' : '#FFFFFF',
              color: activeReportTab === 'vendor_spend' ? '#0E7490' : '#475569',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Building2 size={14} /> Vendor Spend Analysis ({vendorSpendSummary.length})
          </button>

          <button
            onClick={() => setActiveReportTab('grn_ledger')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: activeReportTab === 'grn_ledger' ? '1.5px solid #0E7490' : '1px solid #E2E8F0',
              backgroundColor: activeReportTab === 'grn_ledger' ? '#ECFEFF' : '#FFFFFF',
              color: activeReportTab === 'grn_ledger' ? '#0E7490' : '#475569',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileCheck size={14} /> Monthly GRN Receipts ({filteredGrns.length})
          </button>
        </div>

        {/* Search & Vendor Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '1px solid #CBD5E1',
            borderRadius: '8px',
            padding: '0 10px',
            height: '36px',
            backgroundColor: '#F8FAFC',
            minWidth: '220px'
          }}>
            <Search size={14} style={{ color: '#64748B' }} />
            <input
              type="text"
              placeholder="Search by code, vendor..."
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

          <select
            value={selectedVendorFilter}
            onChange={(e) => setSelectedVendorFilter(e.target.value)}
            style={{
              height: '36px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              padding: '0 10px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#334155',
              backgroundColor: '#FFFFFF',
              outline: 'none'
            }}
          >
            <option value="all">All Vendors</option>
            {allDistinctVendors.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. MAIN DATA TABLE - TAB 1: PO LEDGER */}
      {activeReportTab === 'po_ledger' && (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                  <th style={{ width: '48px', textAlign: 'center', padding: '12px 0' }}>
                    <input
                      type="checkbox"
                      style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                      checked={filteredPos.length > 0 && filteredPos.every(p => selectedPoRows.includes(p.poNo || p.id))}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedPoRows(filteredPos.map(p => p.poNo || p.id));
                        else setSelectedPoRows([]);
                      }}
                    />
                  </th>
                  <th style={{ padding: '12px 14px' }}>PO Number</th>
                  <th style={{ padding: '12px 14px' }}>Date</th>
                  <th style={{ padding: '12px 14px' }}>Vendor / Supplier</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Items</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Amount</th>
                  <th style={{ padding: '12px 14px' }}>Delivery Site</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
                      Loading procurement records for {formatMonthLabel(selectedMonth)}...
                    </td>
                  </tr>
                ) : currentPos.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                      No purchase orders recorded for {formatMonthLabel(selectedMonth)}.
                    </td>
                  </tr>
                ) : (
                  currentPos.map((po, idx) => {
                    const poKey = po.poNo || po.id;
                    const isChecked = selectedPoRows.includes(poKey);
                    const amt = cleanNum(po.totalAmount || po.grandTotal || po.amount);

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
                              setSelectedPoRows(prev =>
                                prev.includes(poKey) ? prev.filter(k => k !== poKey) : [...prev, poKey]
                              );
                            }}
                          />
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '800', color: '#0E7490', fontFamily: 'monospace' }}>
                          {po.poNo || po.id}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748B', whiteSpace: 'nowrap' }}>
                          {getPoDateStr(po)}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0F172A' }}>
                          {po.vendorName || po.vendor || 'Unknown Vendor'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', color: '#475569' }}>
                          {Array.isArray(po.items) ? po.items.length : 1}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                          {formatCurrency(amt)}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748B', fontSize: '12px' }}>
                          {po.deliveryLocation || po.shippingAddress || 'Head Office / Factory'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: (po.status === 'Authorized' || po.status === 'MD Approved') ? '#ECFDF5' : '#FEF3C7',
                            color: (po.status === 'Authorized' || po.status === 'MD Approved') ? '#059669' : '#D97706',
                            border: `1px solid ${(po.status === 'Authorized' || po.status === 'MD Approved') ? '#A7F3D0' : '#FDE68A'}`
                          }}>
                            {po.status || 'Issued'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {filteredPos.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', fontSize: '13px', color: '#64748B', borderTop: '1px solid #F1F5F9', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Showing per page</span>
                  <select
                    value={poRpp}
                    onChange={(e) => { setPoRpp(Number(e.target.value)); setPoPage(1); }}
                    style={{ height: '32px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', padding: '0 8px', fontWeight: 'bold' }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                  </select>
                </div>
                <span>Showing {poStartIndex + 1} to {Math.min(poStartIndex + poRpp, filteredPos.length)} of {filteredPos.length} entries</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    disabled={poPage === 1}
                    onClick={() => setPoPage(1)}
                    style={{ border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: '6px', cursor: poPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                  >
                    &laquo;
                  </button>
                  <button
                    disabled={poPage === 1}
                    onClick={() => setPoPage(prev => Math.max(prev - 1, 1))}
                    style={{ border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: '6px', cursor: poPage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    &lt;
                  </button>
                  {Array.from({ length: poTotalPages }, (_, i) => i + 1).slice(Math.max(0, poPage - 2), poPage + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPoPage(p)}
                      style={{
                        border: '1px solid #E2E8F0',
                        backgroundColor: p === poPage ? '#0E7490' : '#FFFFFF',
                        color: p === poPage ? '#FFFFFF' : '#475569',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontWeight: p === poPage ? 'bold' : 'normal',
                        cursor: 'pointer'
                      }}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    disabled={poPage === poTotalPages}
                    onClick={() => setPoPage(prev => Math.min(prev + 1, poTotalPages))}
                    style={{ border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: '6px', cursor: poPage === poTotalPages ? 'not-allowed' : 'pointer' }}
                  >
                    &gt;
                  </button>
                  <button
                    disabled={poPage === poTotalPages}
                    onClick={() => setPoPage(poTotalPages)}
                    style={{ border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: '6px', cursor: poPage === poTotalPages ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                  >
                    &raquo;
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Go to page</span>
                  <input
                    type="number"
                    min="1"
                    max={poTotalPages}
                    value={poGoTo}
                    onChange={(e) => setPoGoTo(e.target.value)}
                    style={{ width: '45px', height: '32px', textAlign: 'center', borderRadius: '6px', border: '1px solid #CBD5E1' }}
                  />
                  <button
                    onClick={() => {
                      const p = parseInt(poGoTo, 10);
                      if (p >= 1 && p <= poTotalPages) setPoPage(p);
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
      )}

      {/* 4. MAIN DATA TABLE - TAB 2: VENDOR SPEND */}
      {activeReportTab === 'vendor_spend' && (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                  <th style={{ width: '48px', textAlign: 'center', padding: '12px 0' }}>
                    <input
                      type="checkbox"
                      style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                      checked={vendorSpendSummary.length > 0 && vendorSpendSummary.every(v => selectedVendorRows.includes(v.vendorName))}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedVendorRows(vendorSpendSummary.map(v => v.vendorName));
                        else setSelectedVendorRows([]);
                      }}
                    />
                  </th>
                  <th style={{ padding: '12px 14px' }}>Vendor / Supplier Name</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Total PO Orders</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Spend (INR)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Share of Month's Spend</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Average PO Value</th>
                </tr>
              </thead>
              <tbody>
                {vendorSpendSummary.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                      No vendor spend transactions recorded for {formatMonthLabel(selectedMonth)}.
                    </td>
                  </tr>
                ) : (
                  currentVendors.map((v, idx) => {
                    const isChecked = selectedVendorRows.includes(v.vendorName);

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
                              setSelectedVendorRows(prev =>
                                prev.includes(v.vendorName) ? prev.filter(k => k !== v.vendorName) : [...prev, v.vendorName]
                              );
                            }}
                          />
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0F172A' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Building2 size={16} style={{ color: '#0E7490' }} />
                            <span>{v.vendorName}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '700', color: '#0E7490' }}>
                          {v.poCount}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                          {formatCurrency(v.totalSpend)}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '60px', height: '6px', borderRadius: '3px', backgroundColor: '#E2E8F0', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(100, parseFloat(v.sharePct))}%`, height: '100%', backgroundColor: '#0E7490' }} />
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#0E7490' }}>{v.sharePct}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: '#475569', fontWeight: '600' }}>
                          {formatCurrency(v.avgPoValue)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {vendorSpendSummary.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', fontSize: '13px', color: '#64748B', borderTop: '1px solid #F1F5F9', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Showing per page</span>
                  <select
                    value={vendorRpp}
                    onChange={(e) => { setVendorRpp(Number(e.target.value)); setVendorPage(1); }}
                    style={{ height: '32px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', padding: '0 8px', fontWeight: 'bold' }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                  </select>
                </div>
                <span>Showing {vendorStartIndex + 1} to {Math.min(vendorStartIndex + vendorRpp, vendorSpendSummary.length)} of {vendorSpendSummary.length} entries</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    disabled={vendorPage === 1}
                    onClick={() => setVendorPage(1)}
                    style={{ border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: '6px', cursor: vendorPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                  >
                    &laquo;
                  </button>
                  <button
                    disabled={vendorPage === 1}
                    onClick={() => setVendorPage(prev => Math.max(prev - 1, 1))}
                    style={{ border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: '6px', cursor: vendorPage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    &lt;
                  </button>
                  {Array.from({ length: vendorTotalPages }, (_, i) => i + 1).slice(Math.max(0, vendorPage - 2), vendorPage + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setVendorPage(p)}
                      style={{
                        border: '1px solid #E2E8F0',
                        backgroundColor: p === vendorPage ? '#0E7490' : '#FFFFFF',
                        color: p === vendorPage ? '#FFFFFF' : '#475569',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontWeight: p === vendorPage ? 'bold' : 'normal',
                        cursor: 'pointer'
                      }}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    disabled={vendorPage === vendorTotalPages}
                    onClick={() => setVendorPage(prev => Math.min(prev + 1, vendorTotalPages))}
                    style={{ border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: '6px', cursor: vendorPage === vendorTotalPages ? 'not-allowed' : 'pointer' }}
                  >
                    &gt;
                  </button>
                  <button
                    disabled={vendorPage === vendorTotalPages}
                    onClick={() => setVendorPage(vendorTotalPages)}
                    style={{ border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: '6px', cursor: vendorPage === vendorTotalPages ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                  >
                    &raquo;
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. MAIN DATA TABLE - TAB 3: GRN LEDGER */}
      {activeReportTab === 'grn_ledger' && (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                  <th style={{ width: '48px', textAlign: 'center', padding: '12px 0' }}>
                    <input
                      type="checkbox"
                      style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                      checked={filteredGrns.length > 0 && filteredGrns.every(g => selectedGrnRows.includes(g.grnNo || g.id))}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedGrnRows(filteredGrns.map(g => g.grnNo || g.id));
                        else setSelectedGrnRows([]);
                      }}
                    />
                  </th>
                  <th style={{ padding: '12px 14px' }}>GRN Number</th>
                  <th style={{ padding: '12px 14px' }}>PO Reference</th>
                  <th style={{ padding: '12px 14px' }}>Received Date</th>
                  <th style={{ padding: '12px 14px' }}>Vendor / Supplier</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Inward Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredGrns.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                      No Goods Receipt Notes inwarded for {formatMonthLabel(selectedMonth)}.
                    </td>
                  </tr>
                ) : (
                  currentGrns.map((grn, idx) => {
                    const grnKey = grn.grnNo || grn.id;
                    const isChecked = selectedGrnRows.includes(grnKey);

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
                              setSelectedGrnRows(prev =>
                                prev.includes(grnKey) ? prev.filter(k => k !== grnKey) : [...prev, grnKey]
                              );
                            }}
                          />
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '800', color: '#0E7490', fontFamily: 'monospace' }}>
                          {grn.grnNo || grn.id}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '600', color: '#2563EB', fontFamily: 'monospace' }}>
                          {grn.poNo || '—'}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748B' }}>
                          {getGrnDateStr(grn)}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0F172A' }}>
                          {grn.vendorName || grn.vendor || 'Unknown Supplier'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: '#ECFDF5',
                            color: '#059669',
                            border: '1px solid #A7F3D0'
                          }}>
                            {grn.status || 'Verified & Inwarded'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {filteredGrns.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', fontSize: '13px', color: '#64748B', borderTop: '1px solid #F1F5F9', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Showing per page</span>
                  <select
                    value={grnRpp}
                    onChange={(e) => { setGrnRpp(Number(e.target.value)); setGrnPage(1); }}
                    style={{ height: '32px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', padding: '0 8px', fontWeight: 'bold' }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                  </select>
                </div>
                <span>Showing {grnStartIndex + 1} to {Math.min(grnStartIndex + grnRpp, filteredGrns.length)} of {filteredGrns.length} entries</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    disabled={grnPage === 1}
                    onClick={() => setGrnPage(1)}
                    style={{ border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: '6px', cursor: grnPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                  >
                    &laquo;
                  </button>
                  <button
                    disabled={grnPage === 1}
                    onClick={() => setGrnPage(prev => Math.max(prev - 1, 1))}
                    style={{ border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: '6px', cursor: grnPage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    &lt;
                  </button>
                  {Array.from({ length: grnTotalPages }, (_, i) => i + 1).slice(Math.max(0, grnPage - 2), grnPage + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setGrnPage(p)}
                      style={{
                        border: '1px solid #E2E8F0',
                        backgroundColor: p === grnPage ? '#0E7490' : '#FFFFFF',
                        color: p === grnPage ? '#FFFFFF' : '#475569',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontWeight: p === grnPage ? 'bold' : 'normal',
                        cursor: 'pointer'
                      }}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    disabled={grnPage === grnTotalPages}
                    onClick={() => setGrnPage(prev => Math.min(prev + 1, grnTotalPages))}
                    style={{ border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: '6px', cursor: grnPage === grnTotalPages ? 'not-allowed' : 'pointer' }}
                  >
                    &gt;
                  </button>
                  <button
                    disabled={grnPage === grnTotalPages}
                    onClick={() => setGrnPage(grnTotalPages)}
                    style={{ border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: '6px', cursor: grnPage === grnTotalPages ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                  >
                    &raquo;
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Bottom Action Bar for Multi-row selection */}
      {((selectedPoRows.length > 0 && activeReportTab === 'po_ledger') ||
        (selectedVendorRows.length > 0 && activeReportTab === 'vendor_spend') ||
        (selectedGrnRows.length > 0 && activeReportTab === 'grn_ledger')) && (
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
            {activeReportTab === 'po_ledger'
              ? `${selectedPoRows.length} Purchase Order(s) Selected`
              : activeReportTab === 'vendor_spend'
              ? `${selectedVendorRows.length} Vendor(s) Selected`
              : `${selectedGrnRows.length} GRN Receipt(s) Selected`}
          </span>
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
            onClick={() => {
              setSelectedPoRows([]);
              setSelectedVendorRows([]);
              setSelectedGrnRows([]);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            ✕ Clear Selection
          </button>
        </div>
      )}

    </div>
  );
}
