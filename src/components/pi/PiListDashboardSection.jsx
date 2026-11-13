import React from 'react';
import {
  Plus, Edit3, Eye, FileText, X, UploadCloud, CheckCircle, Search, ArrowRight, Edit, Info, Calendar, Filter, RotateCcw, Layers, Boxes, UserCheck, Printer, Copy, GitBranch
} from 'lucide-react';
import StatusBadge from '../StatusBadge';
import ModernDateRangePicker from '../ModernDateRangePicker';

export default function PiListDashboardSection({ ctx }) {
  const {
    onNavigateTab,
    canonicalizeSalespersonCode,
    resolvePiSalesPersonName,
    isCeo,
    viewMode,
    setViewMode,
    tableLoading,
    syncingPiNo,
    selectedPi,
    setSelectedPi,
    printModalPi,
    setPrintModalPi,
    validationAlert,
    filterSalesPerson,
    setFilterSalesPerson,
    kpiFilterMeta,
    setKpiFilterMeta,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    isMobile,
    showTopToast,
    piList,
    getConvertedBomsForPi,
    currentEmpName,
    isTechSupportLogin,
    canAssignPi,
    handleOpenAssignModal,
    formatPiDateDot,
    visiblePIList,
    piMetrics,
    syncPiToZoho,
    handleReleaseDraftPi,
    handleConvertToBom,
    setEditIdx,
    selectedPIs,
    setSelectedPIs,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    piTab,
    setPiTab,
    rowsPerPage,
    setRowsPerPage,
    currentPage,
    setCurrentPage,
    handleSelectAll,
    handleSelectRow,
    clearFilters,
    setPiNumber,
    piDate,
    salesPerson,
    gstNo,
    resetForm,
    handleStartEdit,
    handleClonePi
  } = ctx;

  return (
    <>
      {/* ==================== VIEW 1: LIST DASHBOARD SCREEN ==================== */}
      {viewMode === 'list' && (() => {
        const uniqueStatuses = ['All', ...new Set(visiblePIList.map(pi => pi.status))];
        const uniqueSalesPersons = Array.from(new Set(
          (visiblePIList || []).map(pi => resolvePiSalesPersonName(pi)).filter(name => {
            if (!name) return false;
            const lower = name.toLowerCase().trim();
            return !['sales', 'sales person', 'salesperson', 'sales department', '—', '-', 'undefined', 'null'].includes(lower);
          })
        )).sort((a, b) => a.localeCompare(b));

        const matchesSelectedSalesPerson = (pi) => {
          if (!isCeo || !filterSalesPerson || filterSalesPerson === 'All' || filterSalesPerson === 'All Sales') return true;
          const target = filterSalesPerson.trim().toLowerCase();
          const sp = (resolvePiSalesPersonName(pi) || '').toLowerCase();
          return sp === target || sp.includes(target);
        };

        const piEffectiveStatusMap = new Map();
        const baseFilteredPIList = (visiblePIList || []).filter(pi => {
          if (!pi) return false;
          const matchedBoms = getConvertedBomsForPi(pi);
          const hasSavedBom = matchedBoms.length > 0;
          const bomCodesStr = matchedBoms.map(b => b.bomCode || b.code || b.id).join(' ').toLowerCase();

          const searchLower = String(searchQuery || '').toLowerCase().trim();
          const matchesSearch = !searchLower ||
            String(pi.piNo || '').toLowerCase().includes(searchLower) ||
            String(pi.vendor || pi.customerName || '').toLowerCase().includes(searchLower) ||
            String(pi.gstNo || '').toLowerCase().includes(searchLower) ||
            String(pi.productName || '').toLowerCase().includes(searchLower) ||
            bomCodesStr.includes(searchLower);

          const isExplicitConverted = Boolean(
            pi.status === 'Converted to BOM' || 
            pi.statusType === 'converted' || 
            pi.convertedToBom === true || 
            pi.convertedBomCode || 
            pi.convertedBomNo
          );
          const isConverted = (hasSavedBom || isExplicitConverted) && pi.status !== 'Cancelled';
          const isDraft = (pi.status === 'Draft' || pi.statusType === 'draft') && !isConverted;
          const currentStatus = isConverted
            ? 'Converted to BOM'
            : (isDraft
              ? 'Draft'
              : ((pi.status === 'Pending Approval' || pi.status === 'Approved' || pi.status === 'Converted to BOM')
                ? 'Issued'
                : (pi.status || 'Issued')));

          const matchesStatus = statusFilter === 'All'
            || (statusFilter === 'Issued' && currentStatus === 'Issued')
            || (statusFilter === 'Converted to BOM' && currentStatus === 'Converted to BOM')
            || currentStatus === statusFilter;

          // Date Range Matching
          let matchesDateRange = true;
          const rawDateStr = String(pi.piDate || pi.date || pi.created_time || pi.createdAt || '').trim();
          let piIsoDate = '';
          if (/^\d{4}-\d{2}-\d{2}/.test(rawDateStr)) {
            piIsoDate = rawDateStr.slice(0, 10);
          } else if (rawDateStr) {
            const d = new Date(rawDateStr);
            if (!isNaN(d.getTime())) {
              piIsoDate = d.toISOString().slice(0, 10);
            }
          }

          if (startDate && piIsoDate && piIsoDate < startDate) {
            matchesDateRange = false;
          }
          if (endDate && piIsoDate && piIsoDate > endDate) {
            matchesDateRange = false;
          }

          // KPI Filter from Overview
          if (kpiFilterMeta && kpiFilterMeta.targetKeys) {
            if (kpiFilterMeta.targetKeys.size === 0) {
              return false;
            }
            const piKey1 = String(pi.piNo || '').trim().toLowerCase();
            const piKey2 = String(pi.id || '').trim().toLowerCase();
            if (!kpiFilterMeta.targetKeys.has(piKey1) && !kpiFilterMeta.targetKeys.has(piKey2)) {
              return false;
            }
          }

          // Sales person filter for CEO
          const matchesSalesPerson = matchesSelectedSalesPerson(pi);

          if (!(matchesSearch && matchesStatus && matchesDateRange && matchesSalesPerson)) {
            return false;
          }

          piEffectiveStatusMap.set(pi, currentStatus);
          return true;
        });

        const filteredPIList = baseFilteredPIList.filter(pi => {
          const currentStatus = piEffectiveStatusMap.get(pi) || 'Issued';
          return piTab === 'All'
            || (piTab === 'Issued' && currentStatus === 'Issued')
            || (piTab === 'Converted to BOM' && currentStatus === 'Converted to BOM')
            || currentStatus === piTab;
        });

        const indexOfLastRow = currentPage * rowsPerPage;
        const indexOfFirstRow = indexOfLastRow - rowsPerPage;
        const currentRows = filteredPIList.slice(indexOfFirstRow, indexOfLastRow);
        const totalPages = Math.ceil(filteredPIList.length / rowsPerPage);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-24)', minWidth: 0, width: '100%' }}>
            {/* Header section with Action Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: '200px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-text-primary)', margin: 0 }}>
                  Performa Invoices
                </h2>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Manage commercial Proforma Invoices and customer billing
                </span>
              </div>

              {!isCeo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={() => {
                      resetForm();
                      setEditIdx(null);
                      setViewMode('create');
                      setPiNumber('');
                    }}
                    style={{
                      backgroundColor: '#0E7490',
                      border: 'none',
                      color: 'white',
                      height: '40px',
                      fontSize: '13px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '0 6px 0 20px',
                      borderRadius: '50px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(14, 116, 144, 0.2)',
                      transition: 'all 0.2s ease-in-out',
                      flexShrink: 0
                    }}
                  >
                    <span>Create PI</span>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: '#FFFFFF',
                      color: '#0E7490',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}>
                      <ArrowRight style={{ width: '16px', height: '16px', color: '#0E7490' }} />
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* PI OPERATIONS & CONVERSION KPI RIBBON (TECH SUPPORT LOGIN ALONE) */}
            {isTechSupportLogin && piMetrics && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '12px',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                {/* Tile 1: Total PIs Today */}
                <div style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #EAEFEF',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Total PIs Today
                    </span>
                    <div style={{ width: '26px', height: '26px', borderRadius: '6px', backgroundColor: '#ECFEFF', color: '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={14} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '22px', fontWeight: '900', color: '#0F172A', letterSpacing: '-0.5px' }}>
                      {piMetrics.todayPiCount} Orders
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: '800', color: '#0E7490', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', padding: '2px 8px', borderRadius: '6px' }}>
                      {piMetrics.todayPiValFormatted}
                    </span>
                  </div>
                  <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: '10px', padding: '6px 10px', fontSize: '11px', color: '#64748B' }}>
                    <span>Commercial pipeline </span>
                    <span style={{ color: '#0E7490', fontWeight: '800' }}>New PIs Authored Today</span>
                  </div>
                </div>

                {/* Tile 2: Converted to BOM Today */}
                <div style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #EAEFEF',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Converted to BOM Today
                    </span>
                    <div style={{ width: '26px', height: '26px', borderRadius: '6px', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <GitBranch size={14} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '22px', fontWeight: '900', color: '#059669', letterSpacing: '-0.5px' }}>
                      {piMetrics.todayConvertedCount} Orders
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: '800', color: '#059669', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '2px 8px', borderRadius: '6px' }}>
                      {piMetrics.todayConvertedValFormatted}
                    </span>
                  </div>
                  <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: '10px', padding: '6px 10px', fontSize: '11px', color: '#64748B' }}>
                    <span>Production handoff </span>
                    <span style={{ color: '#059669', fontWeight: '800' }}>{piMetrics.conversionRate}</span>
                  </div>
                </div>

                {/* Tile 3: Assigned to Today */}
                <div style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #EAEFEF',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Assigned to Today
                    </span>
                    <div style={{ width: '26px', height: '26px', borderRadius: '6px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserCheck size={14} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '22px', fontWeight: '900', color: '#2563EB', letterSpacing: '-0.5px' }}>
                      {piMetrics.todayAssignedCount} Orders
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: '800', color: '#2563EB', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', padding: '2px 8px', borderRadius: '6px' }}>
                      {piMetrics.todayAssignedValFormatted}
                    </span>
                  </div>
                  <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: '10px', padding: '6px 10px', fontSize: '11px', color: '#64748B' }}>
                    <span>Sales assignment </span>
                    <span style={{ color: '#2563EB', fontWeight: '800' }}>Handed to Sales Reps</span>
                  </div>
                </div>
              </div>
            )}

            {/* 1. FILTERS & SEARCH ROW CARD */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              padding: isMobile ? '10px 12px' : '12px 16px',
              backgroundColor: '#fafbfc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              alignItems: 'center',
              width: '100%',
              boxSizing: 'border-box',
              justifyContent: 'space-between',
              marginBottom: '14px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0 12px',
                height: '38px',
                backgroundColor: '#f8fafc',
                flex: isMobile ? '1 1 100%' : '1 1 240px',
                maxWidth: isMobile ? '100%' : '380px',
                minWidth: '200px',
                boxSizing: 'border-box'
              }}>
                <Search style={{ width: '15px', height: '15px', color: '#64748b', flexShrink: 0 }} />
                <input id="performa-invoice-search-query" name="searchQuery" aria-label="Search Performa Invoices (PI No, Customer Name, GST No)"
                  type="text"
                  placeholder={isMobile ? "Search PIs, Customer, GST..." : "Search Performa Invoices (PI No, Customer Name, GST No)..."}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  style={{ border: 'none', background: 'none', outline: 'none', fontSize: '13px', width: '100%', minWidth: 0, color: '#334155' }}
                 />
              </div>

              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                flexWrap: isMobile ? 'wrap' : 'nowrap',
                width: isMobile ? '100%' : 'auto',
                justifyContent: isMobile ? 'space-between' : 'flex-end',
                flexShrink: 0
              }}>
                {/* Sales Person Filter for CEO */}
                {isCeo && (
                  <select
                    id="performa-invoice-sales-filter"
                    name="salesPersonFilter"
                    aria-label="Filter by Sales Person"
                    value={filterSalesPerson}
                    onChange={(e) => {
                      setFilterSalesPerson(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      padding: '0 24px 0 10px',
                      fontSize: '13px',
                      backgroundColor: 'white',
                      color: filterSalesPerson !== 'All' && filterSalesPerson !== 'All Sales' ? '#0e7490' : '#334155',
                      fontWeight: filterSalesPerson !== 'All' && filterSalesPerson !== 'All Sales' ? '600' : '500',
                      minWidth: isMobile ? '110px' : '140px',
                      flex: isMobile ? '1 1 auto' : 'none',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="All Sales">All Sales</option>
                    {uniqueSalesPersons.map(sp => (
                      <option key={sp} value={sp}>
                        {sp}
                      </option>
                    ))}
                  </select>
                )}

                {/* Modern Date Range Picker */}
                <div style={{ flex: isMobile ? '1 1 auto' : 'none' }}>
                  <ModernDateRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    onChange={({ startDate: s, endDate: e }) => {
                      setStartDate(s);
                      setEndDate(e);
                      if (kpiFilterMeta) {
                        setKpiFilterMeta(null);
                        try { sessionStorage.removeItem('controlroom_pi_initial_date_filter'); } catch (_) {}
                      }
                      setCurrentPage(1);
                    }}
                  />
                </div>

                <select id="performa-invoice-status-filter" name="statusFilter" aria-label="StatusFilter" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 24px 0 10px', fontSize: '13px', backgroundColor: 'white', color: '#334155', minWidth: isMobile ? '110px' : '130px', flex: isMobile ? '1 1 auto' : 'none', outline: 'none' }}>
                  {uniqueStatuses.map(s => (
                    <option key={s} value={s}>
                      {s === 'All' ? 'Status: All' : s}
                    </option>
                  ))}
                </select>

                <button
                  onClick={clearFilters}
                  title="Clear Filters"
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    cursor: 'pointer',
                    padding: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '8px',
                    height: '38px',
                    width: '38px',
                    flexShrink: 0,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <RotateCcw style={{ width: '15px', height: '15px' }} />
                </button>
              </div>
            </div>

            {/* KPI FILTER ALERT BANNER */}
            {kpiFilterMeta && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#ECFEFF',
                border: '1.5px solid #0E7490',
                borderRadius: '10px',
                padding: '9px 16px',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#0E7490', fontWeight: '800' }}>
                  <span>Showing <strong>{filteredPIList.length}</strong> Proforma Invoices filtered from {kpiFilterMeta.sourceLabel ? `${kpiFilterMeta.sourceLabel} KPI` : 'Company Overview KPI'} ({kpiFilterMeta.periodLabel})</span>
                </div>
                <button
                  type="button"
                  onClick={clearFilters}
                  style={{
                    border: 'none',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  ✕ Show All Proforma Invoices
                </button>
              </div>
            )}

            {/* 2. STATUS SUB-TABS ROW & EXPORT BUTTON */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '0',
              marginBottom: '16px',
              width: '100%',
              overflowX: isMobile ? 'auto' : 'visible',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none'
            }}>
              <div style={{
                display: 'flex',
                gap: isMobile ? '14px' : '20px',
                flexWrap: isMobile ? 'nowrap' : 'wrap',
                whiteSpace: isMobile ? 'nowrap' : 'normal',
                paddingBottom: isMobile ? '6px' : '0'
              }}>
                {[
                  { id: 'All', label: 'All Invoices (Total Sent)', count: baseFilteredPIList.length },
                  { id: 'Issued', label: 'Issued / Active', count: baseFilteredPIList.filter(pi => piEffectiveStatusMap.get(pi) === 'Issued').length },
                  { id: 'Converted to BOM', label: 'Converted to BOM', count: baseFilteredPIList.filter(pi => piEffectiveStatusMap.get(pi) === 'Converted to BOM').length },
                  { id: 'Cancelled', label: 'Cancelled', count: baseFilteredPIList.filter(pi => piEffectiveStatusMap.get(pi) === 'Cancelled').length },
                  { id: 'Draft', label: 'Draft', count: baseFilteredPIList.filter(pi => piEffectiveStatusMap.get(pi) === 'Draft').length }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setPiTab(tab.id); setCurrentPage(1); }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: '12px 0',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      color: piTab === tab.id ? '#0E7490' : '#64748b',
                      borderBottom: piTab === tab.id ? '2px solid #0E7490' : '2px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexShrink: 0
                    }}
                  >
                    {tab.label}
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 7px',
                      borderRadius: '12px',
                      backgroundColor: tab.id === 'Converted to BOM' ? '#ecfdf5' : tab.id === 'Issued' ? '#f0fdf4' : tab.id === 'Cancelled' ? '#fef2f2' : '#f1f5f9',
                      color: tab.id === 'Converted to BOM' ? '#059669' : tab.id === 'Issued' ? '#16a34a' : tab.id === 'Cancelled' ? '#b91c1c' : '#475569',
                      fontWeight: 'bold'
                    }}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. MAIN DATA TABLE MATCHING EXACT REFERENCE DESIGN */}
            <div className="section-card" style={{ padding: 0, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
              {isMobile ? (
                /* MOBILE RESPONSIVE CARD VIEW (Clean mobile view without cut-off) */
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Mobile Select All Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                    color: '#475569'
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '700' }}>
                      <input
                        type="checkbox"
                        onChange={(e) => handleSelectAll(e, filteredPIList)}
                        checked={filteredPIList.length > 0 && filteredPIList.every(pi => selectedPIs.includes(pi.piNo))}
                        style={{ accentColor: '#0E7490', cursor: 'pointer', width: '16px', height: '16px', margin: 0 }}
                      />
                      <span>Select All ({filteredPIList.length})</span>
                    </label>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>
                      {selectedPIs.length > 0 ? `${selectedPIs.length} selected` : `Showing ${indexOfFirstRow + 1}-${Math.min(indexOfLastRow, filteredPIList.length)}`}
                    </span>
                  </div>

                  {tableLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#0E7490' }}>
                      <div style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid #0E7490', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      <p style={{ marginTop: '10px', fontSize: '13px', fontWeight: '700' }}>Loading Proforma Invoices...</p>
                    </div>
                  ) : currentRows.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>
                      <FileText size={40} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#475569' }}>No Proforma Invoices found</p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Try adjusting your filters or create a new PI.</p>
                    </div>
                  ) : (
                    currentRows.map((pi) => {
                      const isSelected = selectedPIs.includes(pi.piNo);
                      const contactPerson = pi.contactPerson || pi.customerContactPerson || pi.attn || pi.customerContact || '—';
                      const phone = pi.phone || pi.customerPhone || pi.mobile || '';

                      return (
                        <div
                          key={pi.piNo}
                          onClick={() => setSelectedPi(pi)}
                          style={{
                            backgroundColor: isSelected ? '#ECFEFF' : '#FFFFFF',
                            border: isSelected ? '1.5px solid #0E7490' : '1px solid #E2E8F0',
                            borderLeft: isSelected ? '4px solid #0E7490' : '1px solid #CBD5E1',
                            borderRadius: '12px',
                            padding: '14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            cursor: 'pointer',
                            boxShadow: isSelected ? '0 4px 12px rgba(14,116,144,0.12)' : '0 1px 3px rgba(0,0,0,0.03)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {/* Top row: Checkbox + PI Number + Status Badge */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => handleSelectRow(pi.piNo)}
                                style={{ accentColor: '#0E7490', cursor: 'pointer', width: '16px', height: '16px', margin: 0 }}
                              />
                              <span style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', letterSpacing: '0.2px' }}>
                                {pi.piNo}
                              </span>
                            </div>
                            <StatusBadge type={pi.status} label={pi.status} size="sm" />
                          </div>

                          {/* Customer Name & Contact */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A', lineHeight: '1.3' }}>
                              {pi.customerName || 'Unknown Customer'}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#64748B', flexWrap: 'wrap' }}>
                              {contactPerson !== '—' && <span>Attn: <strong style={{ color: '#475569' }}>{contactPerson}</strong></span>}
                              {phone && <span>• 📞 {phone}</span>}
                            </div>
                          </div>

                          {/* Sales Person & Terms */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '12px', flexWrap: 'wrap', paddingTop: '4px', borderTop: '1px dashed #F1F5F9' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                backgroundColor: '#E0F2FE',
                                color: '#0369A1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                fontWeight: '800'
                              }}>
                                {(pi.salesPerson || 'S').charAt(0).toUpperCase()}
                              </div>
                              <span style={{ color: '#475569', fontSize: '12px', fontWeight: '600' }}>
                                {pi.salesPerson || 'Sales Team'}
                              </span>
                            </div>
                          </div>

                          {/* Footer row: Date & Total Amount */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingTop: '6px',
                            borderTop: '1px solid #F1F5F9'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#64748B' }}>
                              <Calendar size={13} style={{ color: '#94A3B8' }} />
                              <span>{pi.piDate ? new Date(pi.piDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                              <span style={{ fontSize: '11px', color: '#64748B' }}>Total:</span>
                              <span style={{ fontSize: '15px', fontWeight: '900', color: '#0F172A' }}>
                                {pi.grandTotal || pi.totalAmount ? `₹${Number(pi.grandTotal || pi.totalAmount || 0).toLocaleString('en-IN')}` : '₹0'}
                              </span>
                            </div>
                          </div>

                          {/* Badges / Quick Actions Row */}
                          {(pi.bomCode || pi.zohoSalesOrderId || pi.status === 'Draft') && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '4px' }}>
                              {pi.bomCode && (
                                <span style={{ backgroundColor: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700' }}>
                                  ✓ Linked BOM: {pi.bomCode}
                                </span>
                              )}
                              {pi.zohoSalesOrderId && (
                                <span style={{ backgroundColor: '#EFF6FF', color: '#1E40AF', padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700' }}>
                                  ✓ Zoho Synced
                                </span>
                              )}
                              {pi.status === 'Draft' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReleaseDraftPi(pi);
                                  }}
                                  style={{
                                    marginLeft: 'auto',
                                    backgroundColor: '#10B981',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <CheckCircle size={11} /> Complete PI →
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  {/* Mobile Pagination Footer */}
                  {!tableLoading && filteredPIList.length > 0 && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      padding: '12px 6px',
                      borderTop: '1px solid #E2E8F0',
                      fontSize: '12px',
                      color: '#64748B'
                    }}>
                      {/* Top: Rows per page & Showing text */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>Per page</span>
                          <select
                            value={rowsPerPage}
                            onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            style={{ height: '30px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', padding: '0 6px', backgroundColor: 'white', fontWeight: 'bold' }}
                          >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                          </select>
                        </div>
                        <span>{indexOfFirstRow + 1}-{Math.min(indexOfLastRow, filteredPIList.length)} of {filteredPIList.length}</span>
                      </div>

                      {/* Bottom: Page Nav buttons & Page Jump */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(1)}
                            style={{ border: '1px solid #E2E8F0', background: currentPage === 1 ? '#F8FAFC' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', padding: '5px 8px', borderRadius: '6px', color: '#64748B', fontWeight: 'bold' }}
                          >
                            &laquo;
                          </button>
                          <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            style={{ border: '1px solid #E2E8F0', background: currentPage === 1 ? '#F8FAFC' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', padding: '5px 8px', borderRadius: '6px', color: '#64748B' }}
                          >
                            &lt;
                          </button>
                          <span style={{ padding: '4px 8px', fontWeight: 'bold', color: '#0E7490' }}>
                            {currentPage} / {totalPages || 1}
                          </span>
                          <button
                            disabled={currentPage === totalPages || totalPages === 0}
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            style={{ border: '1px solid #E2E8F0', background: (currentPage === totalPages || totalPages === 0) ? '#F8FAFC' : 'white', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', padding: '5px 8px', borderRadius: '6px', color: '#64748B' }}
                          >
                            &gt;
                          </button>
                          <button
                            disabled={currentPage === totalPages || totalPages === 0}
                            onClick={() => setCurrentPage(totalPages)}
                            style={{ border: '1px solid #E2E8F0', background: (currentPage === totalPages || totalPages === 0) ? '#F8FAFC' : 'white', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', padding: '5px 8px', borderRadius: '6px', color: '#64748B', fontWeight: 'bold' }}
                          >
                            &raquo;
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>Go</span>
                          <input
                            type="number"
                            min="1"
                            max={totalPages || 1}
                            defaultValue={currentPage}
                            id="pi-goto-page-input-mobile"
                            style={{ width: '38px', height: '30px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}
                          />
                          <button
                            onClick={() => {
                              const val = parseInt(document.getElementById('pi-goto-page-input-mobile')?.value || '1', 10);
                              if (val >= 1 && val <= totalPages) setCurrentPage(val);
                            }}
                            style={{ height: '30px', padding: '0 8px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: '#FFFFFF', color: '#0E7490', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}
                          >
                            ›
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table className="custom-table" style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                      <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', padding: '12px 0', textAlign: 'center', verticalAlign: 'middle', boxSizing: 'border-box' }}>
                        <input id="performa-invoice-select-all" name="selectAll" aria-label="SelectAll"
                          type="checkbox"
                          onChange={(e) => handleSelectAll(e, filteredPIList)}
                          checked={filteredPIList.length > 0 && filteredPIList.every(pi => selectedPIs.includes(pi.piNo))}
                          style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                         />
                      </th>
                      <th style={{ width: '150px', minWidth: '130px', padding: '12px 14px', boxSizing: 'border-box' }}>PI NO.</th>
                      <th style={{ width: '120px', minWidth: '110px', padding: '12px 14px', boxSizing: 'border-box' }}>PI Date</th>
                      {isTechSupportLogin ? (
                        <>
                          <th style={{ width: '160px', minWidth: '140px', padding: '12px 14px', boxSizing: 'border-box' }}>Created By</th>
                          <th style={{ width: '180px', minWidth: '160px', padding: '12px 14px', boxSizing: 'border-box' }}>Assigned to</th>
                        </>
                      ) : (
                        <th style={{ width: '180px', minWidth: '160px', padding: '12px 14px', boxSizing: 'border-box' }}>Sales Person</th>
                      )}
                      <th style={{ minWidth: '220px', padding: '12px 14px', boxSizing: 'border-box' }}>Company Name</th>
                      <th style={{ width: '150px', minWidth: '130px', padding: '12px 14px', textAlign: 'right', boxSizing: 'border-box' }}>Total Amount</th>
                      <th style={{ width: '150px', minWidth: '130px', padding: '12px 14px', textAlign: 'center', boxSizing: 'border-box' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableLoading ? (
                      <>
                        <tr style={{ backgroundColor: '#F0FDFA' }}>
                          <td colSpan={isTechSupportLogin ? 8 : 7} style={{ padding: '24px 16px', textAlign: 'center', borderBottom: '1px solid #CCFBF1' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className="businz-spin-ring" />
                                <div style={{ textAlign: 'left' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490' }}>
                                      Loading Proforma Invoices...
                                    </span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#ECFDF5', color: '#059669', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', border: '1px solid #A7F3D0' }}>
                                      <span className="businz-pulse-dot" /> Live Cloud Sync
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                                    Retrieving quotation records from Businz Cloud Storage...
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {Array.from({ length: 6 }).map((_, idx) => (
                          <tr key={`pi-skeleton-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ textAlign: 'center', padding: '12px 0', width: '48px' }}>
                              <input id="performa-invoice-input-1" name="input1" aria-label="Input 1" type="checkbox" defaultChecked={false} disabled style={{ opacity: 0.3 }}  />
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div className="skeleton-shimmer skeleton-text" style={{ width: '90px', height: '14px' }} />
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div className="skeleton-shimmer skeleton-text" style={{ width: '80px', height: '14px' }} />
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div className="skeleton-shimmer skeleton-text" style={{ width: '120px', height: '14px' }} />
                            </td>
                            {isTechSupportLogin && (
                              <td style={{ padding: '12px 14px' }}>
                                <div className="skeleton-shimmer skeleton-text" style={{ width: '120px', height: '14px' }} />
                              </td>
                            )}
                            <td style={{ padding: '12px 14px' }}>
                              <div className="skeleton-shimmer skeleton-text" style={{ width: '65%', height: '14px' }} />
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              <div className="skeleton-shimmer skeleton-text" style={{ width: '85px', height: '14px', marginLeft: 'auto' }} />
                            </td>
                            <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                              <div className="skeleton-shimmer" style={{ width: '80px', height: '22px', borderRadius: '12px', margin: '0 auto' }} />
                            </td>
                          </tr>
                        ))}
                      </>
                    ) : filteredPIList.length === 0 ? (
                      <tr>
                        <td colSpan={isTechSupportLogin ? 8 : 7} style={{ padding: '48px 16px', textAlign: 'center', color: '#64748B' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <FileText size={32} style={{ color: '#CBD5E1' }} />
                            <span style={{ fontSize: '14px', fontWeight: '700', color: '#475569' }}>No Proforma Invoices found</span>
                            <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                              {isCeo
                                ? 'No records match your active filter or search query.'
                                : 'No records match your active filter or search query. Click "+ Create Proforma Invoice" above to author a new quotation.'}
                            </span>
                            {(searchQuery || statusFilter !== 'All' || piTab !== 'All') && (
                              <button
                                type="button"
                                onClick={() => { setSearchQuery(''); setStatusFilter('All'); setPiTab('All'); }}
                                style={{
                                  marginTop: '6px',
                                  padding: '6px 14px',
                                  backgroundColor: '#F1F5F9',
                                  color: '#0E7490',
                                  border: '1px solid #CBD5E1',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  cursor: 'pointer'
                                }}
                              >
                                Clear All Filters
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      currentRows.map((pi, idx) => {
                        const isChecked = selectedPIs.includes(pi.piNo);

                        const matchedBoms = getConvertedBomsForPi(pi);
                        const hasSavedBom = matchedBoms.length > 0;
                        const isExplicitConverted = Boolean(
                          pi.status === 'Converted to BOM' || 
                          pi.statusType === 'converted' || 
                          pi.convertedToBom === true || 
                          pi.convertedBomCode || 
                          pi.convertedBomNo
                        );
                        const isConverted = (hasSavedBom || isExplicitConverted) && pi.status !== 'Cancelled';
                        const isDraft = (pi.status === 'Draft' || pi.statusType === 'draft') && !isConverted;
                        const currentStatus = isConverted
                          ? 'Converted to BOM'
                          : (isDraft
                            ? 'Draft'
                            : ((pi.status === 'Pending Approval' || pi.status === 'Approved' || pi.status === 'Converted to BOM')
                              ? 'Issued'
                              : (pi.status || 'Issued')));

                        let statusBg = '#eff6ff';
                        let statusFg = '#2563eb';
                        let displayStatus = currentStatus;

                        if (isConverted) {
                          statusBg = '#ecfdf5';
                          statusFg = '#059669';
                          displayStatus = 'Converted to BOM';
                        } else if (currentStatus === 'Issued') {
                          statusBg = '#f0fdf4';
                          statusFg = '#16a34a';
                        } else if (currentStatus === 'Cancelled') {
                          statusBg = '#fef2f2';
                          statusFg = '#b91c1c';
                        } else if (currentStatus === 'Draft' || currentStatus === 'Overdue') {
                          statusBg = '#fef2f2';
                          statusFg = '#dc2626';
                        }

                        return (
                          <tr
                            key={idx}
                            onClick={() => setSelectedPi(pi)}
                            style={{
                              borderBottom: '1px solid #F1F5F9',
                              transition: 'all 0.15s ease',
                              backgroundColor: isChecked ? '#ECFEFF' : 'transparent',
                              cursor: 'pointer'
                            }}
                            className={`table-row-hover ${isChecked ? 'selected-row' : ''}`}
                          >
                            <td 
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                width: '48px',
                                minWidth: '48px',
                                padding: '12px 14px',
                                textAlign: 'center',
                                verticalAlign: 'middle',
                                boxSizing: 'border-box',
                                borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent'
                              }}
                            >
                              <input id="performa-invoice-checkbox" name="checkbox" aria-label="Checkbox"
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleSelectRow(pi.piNo)}
                                style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                               />
                            </td>
                            <td
                              style={{ padding: '12px 14px', width: '150px', minWidth: '130px' }}
                            >
                              <div style={{ fontWeight: 'bold', color: '#2563EB', fontSize: '13px' }}>
                                {pi.piNo}
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px', color: '#64748B', width: '120px', minWidth: '110px', whiteSpace: 'nowrap', fontFamily: isTechSupportLogin ? 'monospace' : 'inherit', fontWeight: isTechSupportLogin ? '600' : 'normal' }}>
                              {formatPiDateDot(pi.piDate || pi.date || pi.createdAt)}
                            </td>

                            {/* Tech Support Split: Created By & Assigned to */}
                            {isTechSupportLogin ? (
                              <>
                                {/* Created By (Tech Person name who created PI) */}
                                <td style={{ padding: '12px 14px', color: '#1E293B', width: '160px', minWidth: '140px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{
                                      width: '26px',
                                      height: '26px',
                                      borderRadius: '50%',
                                      backgroundColor: '#F3E8FF',
                                      color: '#9333EA',
                                      border: '1px solid #E9D5FF',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '11px',
                                      fontWeight: '800',
                                      flexShrink: 0
                                    }}>
                                      {((pi.createdBy || pi.createdByName || pi.author || currentEmpName || 'T')[0] || 'T').toUpperCase()}
                                    </div>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div style={{ fontWeight: '700', fontSize: '12.5px', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {pi.createdBy || pi.createdByName || pi.author || currentEmpName || 'Tech Support'}
                                      </div>
                                      {pi.createdById && (
                                        <div style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace' }}>
                                          {pi.createdById}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* Assigned to (Sales person name which tech support assigned to) */}
                                <td style={{ padding: '12px 14px', color: '#1E293B', width: '180px', minWidth: '160px' }}>
                                  {(() => {
                                    const assignedSp = pi.assignedSalesperson || pi.assignedToName || (
                                      pi.salesPerson && !pi.salesPerson.toLowerCase().includes('support') && !pi.salesPerson.toLowerCase().includes('admin') && !pi.salesPerson.toLowerCase().includes('direct')
                                        ? pi.salesPerson
                                        : ''
                                    );
                                    const assignedCode = pi.assignedSalespersonCode || pi.assignedToId || (assignedSp ? pi.salesPersonCode : '');

                                    if (assignedSp) {
                                      return (
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
                                            {assignedSp[0]?.toUpperCase()}
                                          </div>
                                          <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                              <div style={{ fontWeight: '700', fontSize: '12.5px', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {assignedSp}
                                              </div>
                                              {canAssignPi && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenAssignModal(pi);
                                                  }}
                                                  title={`Reassign PI ${pi.piNo || ''} to Sales Executive`}
                                                  style={{ border: 'none', background: '#ECFEFF', cursor: 'pointer', padding: '2px 6px', color: '#0E7490', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: '700', flexShrink: 0 }}
                                                  onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#0E7490';
                                                    e.currentTarget.style.color = '#FFFFFF';
                                                  }}
                                                  onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#ECFEFF';
                                                    e.currentTarget.style.color = '#0E7490';
                                                  }}
                                                >
                                                  <UserCheck size={10} /> Reassign
                                                </button>
                                              )}
                                            </div>
                                            {assignedCode && (
                                              <div style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace' }}>
                                                {assignedCode}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    }

                                    return (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '6px' }}>
                                        <span style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>
                                          Not Assigned
                                        </span>
                                        {canAssignPi && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenAssignModal(pi);
                                            }}
                                            title={`Assign PI ${pi.piNo || ''} to Sales Executive`}
                                            style={{ border: '1px solid #A5F3FC', background: '#ECFEFF', cursor: 'pointer', padding: '3px 8px', color: '#0E7490', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '700' }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.backgroundColor = '#0E7490';
                                              e.currentTarget.style.color = '#FFFFFF';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.backgroundColor = '#ECFEFF';
                                              e.currentTarget.style.color = '#0E7490';
                                            }}
                                          >
                                            <UserCheck size={11} /> Assign
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </td>
                              </>
                            ) : (
                              /* Standard Sales Person column for non-Tech-Support logins */
                              <td style={{ padding: '12px 14px', color: '#1E293B', width: '180px', minWidth: '160px' }}>
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
                                    {(resolvePiSalesPersonName(pi) || 'S')[0]?.toUpperCase()}
                                  </div>
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                      <div style={{ fontWeight: '700', fontSize: '12.5px', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {resolvePiSalesPersonName(pi) || 'Direct / Admin'}
                                      </div>
                                      {canAssignPi && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenAssignModal(pi);
                                          }}
                                          title={`Assign/Reassign PI ${pi.piNo || ''} to Sales Executive`}
                                          style={{ border: 'none', background: '#ECFEFF', cursor: 'pointer', padding: '2px 6px', color: '#0E7490', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: '700', flexShrink: 0 }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#0E7490';
                                            e.currentTarget.style.color = '#FFFFFF';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = '#ECFEFF';
                                            e.currentTarget.style.color = '#0E7490';
                                          }}
                                        >
                                          <UserCheck size={11} /> Assign
                                        </button>
                                      )}
                                    </div>
                                    {pi.salesPersonCode && (
                                      <div style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace' }}>
                                        {canonicalizeSalespersonCode(pi.salesPersonCode, pi.salesPerson || pi.createdBy)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            )}

                            <td style={{ padding: '12px 14px', fontWeight: '600', color: '#1E293B', minWidth: '220px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontWeight: '700', color: '#0F172A' }}>{pi.vendor || pi.customerName || 'Direct Customer'}</span>
                                {pi.contactPerson && <span style={{ fontSize: '11px', color: '#64748B' }}>Attn: {pi.contactPerson}</span>}
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 'bold', color: '#0F172A', textAlign: 'right', width: '150px', minWidth: '130px' }}>
                              {pi.amount}
                            </td>
                            
                            {/* Status Column: For Tech Support, strictly badge without BOM buttons */}
                            <td style={{ padding: '12px 14px', textAlign: 'center', width: isTechSupportLogin ? '150px' : '160px', minWidth: '130px' }}>
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                <span style={{ backgroundColor: statusBg, color: statusFg, padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusFg }}></span>
                                  {displayStatus}
                                </span>
                                {!isTechSupportLogin && !isCeo && isConverted && (
                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                    {matchedBoms.map((b, bIdx) => {
                                      const bCode = b.bomCode || b.code || b.id;
                                      return (
                                        <button
                                          key={bIdx}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            window.dispatchEvent(new CustomEvent('controlroom_navigate_tab', { 
                                              detail: { tab: 'Sales BOM', targetBom: bCode } 
                                            }));
                                            if (typeof onNavigateTab === 'function') {
                                              onNavigateTab('Sales BOM');
                                            }
                                          }}
                                          title={`View ${bCode} in Sales BOM`}
                                          style={{
                                            backgroundColor: '#0E7490',
                                            color: '#FFFFFF',
                                            border: 'none',
                                            fontSize: '11px',
                                            fontWeight: '800',
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            boxShadow: '0 1px 3px rgba(14,116,144,0.3)',
                                            transition: 'transform 0.1s ease'
                                          }}
                                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.04)'}
                                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                        >
                                          <Boxes size={12} style={{ marginRight: '3px' }} />
                                          {bCode} ↗
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                {Boolean(pi.zohoSynced) && (
                                  <span
                                    title={`Synced to Zoho Books as Quote #${pi.zohoEstimateNo || pi.piNo}`}
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: '700',
                                      color: '#047857',
                                      backgroundColor: '#ECFDF5',
                                      border: '1px solid #A7F3D0',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      marginTop: '2px'
                                    }}
                                  >
                                    <CheckCircle size={10} style={{ color: '#10B981' }} /> Zoho Synced
                                  </span>
                                )}
                                {isDraft && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReleaseDraftPi(pi);
                                    }}
                                    title="Complete and Release this Proforma Invoice"
                                    style={{
                                      backgroundColor: '#10B981',
                                      color: '#FFFFFF',
                                      border: 'none',
                                      fontSize: '10.5px',
                                      fontWeight: '800',
                                      padding: '3px 9px',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      boxShadow: '0 1px 3px rgba(16,185,129,0.3)',
                                      transition: 'transform 0.1s ease'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.04)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                  >
                                    <CheckCircle size={11} /> Complete PI →
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Actions column removed per user request */}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                {/* 4. PAGINATION FOOTER EXACT MATCHING STANDARD RULES */}
                {!tableLoading && filteredPIList.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', fontSize: '13px', color: '#64748b', borderTop: '1px solid #f1f5f9', backgroundColor: '#FFFFFF' }}>
                    {/* Left Side: Rows per page selector + Showing X to Y of Z entries */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Showing per page</span>
                        <select id="performa-invoice-rows-per-page" name="rowsPerPage" aria-label="RowsPerPage"
                          value={rowsPerPage}
                          onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                          style={{ height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', padding: '0 8px', backgroundColor: 'white', fontWeight: 'bold' }}
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                        </select>
                      </div>
                      <span>Showing {indexOfFirstRow + 1} to {Math.min(indexOfLastRow, filteredPIList.length)} of {filteredPIList.length} entries</span>
                    </div>

                    {/* Right Side: Page navigation controls adjacent to Go to page input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(1)}
                          style={{ border: '1px solid #E2E8F0', background: currentPage === 1 ? '#F8FAFC' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B', fontWeight: 'bold' }}
                        >
                          &laquo;
                        </button>
                        <button
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          style={{ border: '1px solid #E2E8F0', background: currentPage === 1 ? '#F8FAFC' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B' }}
                        >
                          &lt;
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
                              onClick={() => setCurrentPage(page)}
                              style={{
                                border: '1px solid #E2E8F0',
                                background: page === currentPage ? '#0E7490' : 'white',
                                color: page === currentPage ? 'white' : '#475569',
                                cursor: 'pointer',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontWeight: page === currentPage ? 'bold' : '500'
                              }}
                            >
                              {page}
                            </button>
                          ));
                        })()}

                        <button
                          disabled={currentPage === totalPages || totalPages === 0}
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          style={{ border: '1px solid #E2E8F0', background: (currentPage === totalPages || totalPages === 0) ? '#F8FAFC' : 'white', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B' }}
                        >
                          &gt;
                        </button>
                        <button
                          disabled={currentPage === totalPages || totalPages === 0}
                          onClick={() => setCurrentPage(totalPages)}
                          style={{ border: '1px solid #E2E8F0', background: (currentPage === totalPages || totalPages === 0) ? '#F8FAFC' : 'white', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B', fontWeight: 'bold' }}
                        >
                          &raquo;
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#64748B' }}>Go to page</span>
                        <input name="pageJump" aria-label="PageJump"
                          type="number"
                          min="1"
                          max={totalPages || 1}
                          defaultValue={currentPage}
                          id="pi-goto-page-input"
                          style={{ width: '42px', height: '32px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}
                         />
                        <button
                          onClick={() => {
                            const val = parseInt(document.getElementById('pi-goto-page-input')?.value || '1', 10);
                            if (val >= 1 && val <= totalPages) setCurrentPage(val);
                          }}
                          style={{ height: '32px', padding: '0 10px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: '#FFFFFF', color: '#0E7490', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
                        >
                          Go &rsaquo;
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>

            {/* Floating Selection Toolbar (Single line, direct action buttons, no 3-dot menu) */}
            {selectedPIs.length > 0 && !selectedPi && !printModalPi && !validationAlert && (
              <div style={{
                position: 'fixed',
                bottom: '24px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '50px',
                boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                padding: '8px 16px',
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'nowrap',
                alignItems: 'center',
                whiteSpace: 'nowrap',
                gap: '8px',
                zIndex: 10000,
                width: 'max-content',
                maxWidth: 'calc(100vw - 32px)',
                overflowX: 'auto',
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px', paddingRight: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selectedPIs.length}</strong> Selected
                </span>

                {/* View Details */}
                <button
                  onClick={() => {
                    if (selectedPIs.length > 1) {
                      showTopToast("You can't open details for multiple files at once. Please select a single item to view details.", 'error', 4000);
                      return;
                    }
                    const target = piList.find(p => p.piNo === selectedPIs[0]);
                    setSelectedPIs([]);
                    if (target) setSelectedPi(target);
                  }}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    color: '#1E293B',
                    borderRadius: '10px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                >
                  <Eye size={14} style={{ color: '#0E7490' }} /> View Details
                </button>

                {/* Convert to BOM / View BOM button */}
                {(() => {
                  const target = selectedPIs.length === 1 ? piList.find(p => p.piNo === selectedPIs[0]) : null;
                  if (isCeo || !target || target.status === 'Cancelled') return null;

                  if (target.status === 'Draft' || target.statusType === 'draft') {
                    return (
                      <button
                        onClick={() => {
                          setSelectedPIs([]);
                          handleReleaseDraftPi(target);
                        }}
                        style={{
                          backgroundColor: '#10B981',
                          border: 'none',
                          color: '#FFFFFF',
                          borderRadius: '10px',
                          padding: '6px 16px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10B981'}
                      >
                        <CheckCircle size={14} style={{ color: '#FFFFFF' }} /> Complete & Release PI →
                      </button>
                    );
                  }
                  const matchedBoms = getConvertedBomsForPi(target);
                  const hasSavedBom = matchedBoms.length > 0;
                  const isConverted = hasSavedBom;

                  const firstBomCode = matchedBoms[0]?.bomCode || matchedBoms[0]?.code || matchedBoms[0]?.id;
                  const isPushed = Boolean(target.zohoSynced);
                  const isCurrentlyPushing = syncingPiNo === target.piNo;

                  // Exclude Convert to BOM and Push to Zoho from floating menu in Tech Support login per user mandate
                  if (isTechSupportLogin) return null;

                  return (
                    <React.Fragment key={target.piNo}>
                      {isConverted ? (
                        <button
                          onClick={() => {
                            setSelectedPIs([]);
                            window.dispatchEvent(new CustomEvent('controlroom_navigate_tab', { 
                              detail: { tab: 'Sales BOM', targetBom: firstBomCode } 
                            }));
                            if (typeof onNavigateTab === 'function') {
                              onNavigateTab('Sales BOM');
                            }
                          }}
                          style={{
                            backgroundColor: '#059669',
                            border: 'none',
                            color: '#FFFFFF',
                            borderRadius: '10px',
                            padding: '6px 16px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            boxShadow: '0 2px 4px rgba(5, 150, 105, 0.3)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Layers size={14} style={{ color: '#FFFFFF' }} /> View {firstBomCode} ↗
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedPIs([]);
                            handleConvertToBom(target);
                          }}
                          style={{
                            backgroundColor: '#4F46E5',
                            border: 'none',
                            color: '#FFFFFF',
                            borderRadius: '10px',
                            padding: '6px 16px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            boxShadow: '0 2px 4px rgba(79, 70, 229, 0.3)',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4338CA'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4F46E5'}
                        >
                          <Layers size={14} style={{ color: '#FFFFFF' }} /> Convert to BOM
                        </button>
                      )}

                      <button
                        onClick={() => syncPiToZoho(target)}
                        disabled={isCurrentlyPushing}
                        style={{
                          backgroundColor: isPushed ? '#F0FDF4' : '#0E7490',
                          border: isPushed ? '1px solid #86EFAC' : 'none',
                          color: isPushed ? '#15803D' : '#FFFFFF',
                          borderRadius: '10px',
                          padding: '6px 16px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: isCurrentlyPushing ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          boxShadow: isPushed ? 'none' : '0 2px 4px rgba(14, 116, 144, 0.3)',
                          transition: 'all 0.15s ease',
                          opacity: isCurrentlyPushing ? 0.7 : 1
                        }}
                        title={isPushed ? `Already pushed to Zoho Books as Quote #${target.zohoEstimateNo || target.piNo}. Click to re-sync.` : 'Push this Proforma Invoice to Zoho Books as a Quote'}
                      >
                        {isCurrentlyPushing ? (
                          <>
                            <RotateCcw size={14} className="animate-spin" style={{ color: isPushed ? '#15803D' : '#FFFFFF' }} /> Pushing to Zoho...
                          </>
                        ) : isPushed ? (
                          <>
                            <CheckCircle size={14} style={{ color: '#16A34A' }} /> Zoho Synced ({target.zohoEstimateNo || target.piNo})
                          </>
                        ) : (
                          <>
                            <UploadCloud size={14} style={{ color: '#FFFFFF' }} /> Push to Zoho
                          </>
                        )}
                      </button>
                    </React.Fragment>
                  );
                })()}

                {/* Edit Info */}
                {(() => {
                  const targetPiNo = selectedPIs[0];
                  const targetPi = targetPiNo ? piList.find(p => p.piNo === targetPiNo) : null;
                  const isConverted = Boolean(targetPi && (targetPi.status === 'Converted to BOM' || targetPi.convertedToBom || targetPi.convertedBomCode));
                  if (isConverted || isCeo) return null;

                  return (
                    <button
                      onClick={() => {
                        if (selectedPIs.length > 1) {
                          showTopToast('You cannot edit multiple items at once. Please select 1 item.', 'error', 4000);
                        } else if (selectedPIs.length === 1) {
                          const idx = piList.findIndex(p => p.piNo === targetPiNo);
                          setSelectedPIs([]);
                          handleStartEdit(targetPi || { piNo: targetPiNo }, idx >= 0 ? idx : 0);
                        }
                      }}
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        color: '#1E293B',
                        borderRadius: '10px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        transition: 'all 0.15s ease'
                      }}
                      title="Edit Info"
                    >
                      <Edit3 size={14} style={{ color: '#0E7490' }} />
                      Edit Info
                    </button>
                  );
                })()}

                {/* Clone PI */}
                {selectedPIs.length === 1 && !isCeo && (
                  <button
                    onClick={() => {
                      const targetPiNo = selectedPIs[0];
                      const targetPi = targetPiNo ? piList.find(p => p.piNo === targetPiNo) : null;
                      setSelectedPIs([]);
                      if (targetPi) {
                        handleClonePi(targetPi);
                      }
                    }}
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      color: '#1E293B',
                      borderRadius: '10px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                    title="Clone / Duplicate this Proforma Invoice"
                  >
                    <Copy size={14} style={{ color: '#0E7490' }} />
                    Clone PI
                  </button>
                )}

                {/* Assign to Sales Rep (Tech Support / CEO / Sales Head) */}
                {selectedPIs.length === 1 && canAssignPi && (
                  <button
                    onClick={() => {
                      const targetPiNo = selectedPIs[0];
                      const targetPi = targetPiNo ? piList.find(p => p.piNo === targetPiNo) : null;
                      if (targetPi) {
                        handleOpenAssignModal(targetPi);
                      }
                    }}
                    style={{
                      backgroundColor: '#ECFEFF',
                      border: '1px solid #A5F3FC',
                      color: '#0E7490',
                      borderRadius: '10px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      boxShadow: '0 1px 2px rgba(14,116,144,0.1)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#0E7490';
                      e.currentTarget.style.color = '#FFFFFF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ECFEFF';
                      e.currentTarget.style.color = '#0E7490';
                    }}
                    title="Assign this Proforma Invoice to a Sales Representative"
                  >
                    <UserCheck size={14} />
                    Assign to Sales Rep
                  </button>
                )}

                {/* Export / Print PDF */}
                {!isCeo && (
                  <button
                    onClick={() => {
                      const target = (selectedPIs && selectedPIs.length > 0)
                        ? (piList.find(p => p.piNo === selectedPIs[0]) || { piNo: selectedPIs[0], vendor: 'Customer Reference' })
                        : null;
                      setSelectedPIs([]);
                      if (target) {
                        setPrintModalPi(target);
                      } else {
                        window.print();
                      }
                    }}
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      color: '#1E293B',
                      borderRadius: '10px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                  >
                    <Printer size={14} style={{ color: '#0E7490' }} /> Export / Print PDF
                  </button>
                )}



                {/* Deselect All */}
                <button
                  onClick={() => setSelectedPIs([])}
                  title="Deselect all"
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    marginLeft: '2px',
                    flexShrink: 0
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        );
      })()}
    </>
  );
}
