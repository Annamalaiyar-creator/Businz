import React from 'react';
import {
  ArrowRight,
  Ban,
  Boxes,
  CheckCircle,
  Edit3,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  FileText,
  RotateCcw,
  Search,
  Send,
  ShoppingCart,
  X
} from 'lucide-react';
import ModernDateRangePicker from '../ModernDateRangePicker';

export default function PoTableSection(props) {
  const {
    isExecutiveOrMD,
    isAccounts,
    poList = [],
    getPoStage,
    kpiFilterMeta,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    poTab,
    setPoTab,
    filterDate,
    setFilterDate,
    filterEndDate,
    setFilterEndDate,
    sortDirection,
    setSortDirection,
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    selectedPOs = [],
    setSelectedPOs,
    handleSelectAll,
    handleSelectRow,
    handleStartFreshPO,
    canApproveAsMD,
    setApprovingPo,
    handleOpenPaymentProcessModal,
    handleOpenProceedPoModal,
    setPrintPoModal,
    handleStartEdit,
    handleStartView,
    setCancellingPo,
    renderStatusBadge,
    targetPoNo,
    showCeoPoModal,
    setCancellationRemarkInput,
    tableLoading,
    isMobile,
    handlePushToGrn,
    onNavigateTab,
    clearFilters
  } = props;

        const allStatusOptions = [
          'All orders',
          'Pending Approval',
          'MD Approved',
          'Payment Processed',
          'Pending GRN',
          'Partially Received',
          'Fully Received',
          'Cancelled'
        ];

        const rawBaseList = (isExecutiveOrMD || isAccounts)
          ? poList.filter(po => getPoStage(po) !== 'PURE_DRAFT')
          : poList;

        const kpiBaseList = (!kpiFilterMeta || !kpiFilterMeta.targetKeys)
          ? rawBaseList
          : (kpiFilterMeta.targetKeys.size === 0
            ? []
            : rawBaseList.filter(po => {
                if (!po) return false;
                const k1 = String(po.poNo || '').trim().toLowerCase();
                const k2 = String(po.id || '').trim().toLowerCase();
                const k3 = String(po.purchaseorder_number || '').trim().toLowerCase();
                const k4 = String(po.poNumber || '').trim().toLowerCase();
                const k5 = String(po._id || '').trim().toLowerCase();
                return (k1 && kpiFilterMeta.targetKeys.has(k1)) ||
                       (k2 && kpiFilterMeta.targetKeys.has(k2)) ||
                       (k3 && kpiFilterMeta.targetKeys.has(k3)) ||
                       (k4 && kpiFilterMeta.targetKeys.has(k4)) ||
                       (k5 && kpiFilterMeta.targetKeys.has(k5));
              })
            );

        const filteredPOList = kpiBaseList.filter(po => {
          if (!po) return false;
          const pNo = String(po.poNo || po.id || '');
          const pVend = String(po.vendor || po.companyName || '');
          const matchesSearch = pNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
            pVend.toLowerCase().includes(searchQuery.toLowerCase());

          const statusStr = String(po.status || '');
          const currentStage = getPoStage(po);

          const matchesStatus = statusFilter === 'All' || statusFilter === 'All orders' ||
            ((statusFilter === 'Pending Approval' || statusFilter === 'Draft' || statusFilter === 'Draft / Pending Approval') && currentStage === 'Draft') ||
            (statusFilter === 'MD Approved' && currentStage === 'MD_APPROVED') ||
            ((statusFilter === 'Payment Processed' || statusFilter === 'Payment Processed / Credit Verified') && currentStage === 'PAYMENT_PROCESSED') ||
            ((statusFilter === 'Pending GRN' || statusFilter === 'Proceed PO' || statusFilter === 'Proceed PO (GRN Ready)') && currentStage === 'PROCEED_PO') ||
            ((statusFilter === 'Partially Received' || statusFilter === 'Partially Recived' || statusFilter === 'OPEN / PARTIALLY RECEIVED') && currentStage === 'PARTIALLY_RECEIVED') ||
            ((statusFilter === 'Fully Received' || statusFilter === 'Fully Recived' || statusFilter === 'CLOSED / FULLY RECEIVED' || statusFilter === 'Closed') && currentStage === 'CLOSED') ||
            (statusFilter === 'Cancelled' && currentStage === 'CANCELLED') ||
            statusStr === statusFilter;

          const matchesTab = poTab === 'All' || currentStage === poTab;

          let matchesDate = true;
          if (!kpiFilterMeta && (filterDate || filterEndDate)) {
            const rawDate = po.poDate || po.date || po.createdAt;
            if (rawDate) {
              const dStr = String(rawDate).substring(0, 10);
              if (filterDate && dStr < filterDate) matchesDate = false;
              if (filterEndDate && dStr > filterEndDate) matchesDate = false;
            } else {
              matchesDate = false;
            }
          }

          return matchesSearch && matchesStatus && matchesTab && matchesDate;
        });

        const sortedPOList = [...filteredPOList].sort((a, b) => {
          const parsePoSequenceNumber = (item) => {
            if (!item) return 0;
            const str = String(item.poNo || item.id || item.purchaseorder_number || item.poNumber || '').trim();
            if (!str) return 0;
            const terminalMatch = str.match(/[-/_](\d+)$/);
            if (terminalMatch) return parseInt(terminalMatch[1], 10);
            const allNums = str.match(/\d+/g);
            if (allNums && allNums.length > 0) {
              return parseInt(allNums[allNums.length - 1], 10);
            }
            return 0;
          };

          const numA = parsePoSequenceNumber(a);
          const numB = parsePoSequenceNumber(b);
          if (numB !== numA) {
            return sortDirection === 'asc' ? (numA - numB) : (numB - numA);
          }

          const dateA = new Date(a.createdAt || a.poDate || a.date || 0).getTime() || 0;
          const dateB = new Date(b.createdAt || b.poDate || b.date || 0).getTime() || 0;
          if (dateB !== dateA) {
            return sortDirection === 'asc' ? (dateA - dateB) : (dateB - dateA);
          }

          const strA = String(a.poNo || a.id || '');
          const strB = String(b.poNo || b.id || '');
          return sortDirection === 'asc'
            ? strA.localeCompare(strB, undefined, { numeric: true })
            : strB.localeCompare(strA, undefined, { numeric: true });
        });

        const indexOfLastRow = currentPage * rowsPerPage;
        const indexOfFirstRow = indexOfLastRow - rowsPerPage;
        const currentRows = sortedPOList.slice(indexOfFirstRow, indexOfLastRow);
        const totalPages = Math.ceil(sortedPOList.length / rowsPerPage);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>

            {/* Header section with Action Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', width: '100%', boxSizing: 'border-box' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#0F172A' }}>
                  {isExecutiveOrMD ? 'Purchase Order Approvals (PO)' : isAccounts ? 'Purchase Order Verification (PO)' : 'Purchase Orders (PO)'}
                </h2>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  {isExecutiveOrMD 
                    ? 'Review, verify and grant MD approval for corporate Purchase Orders awaiting authorization'
                    : isAccounts
                    ? 'Verify payment process, credit terms, and accounts clearance for MD-approved Purchase Orders'
                    : 'Generate, tracking and dispatch management of corporate Purchase Orders'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {!isExecutiveOrMD && !isAccounts && (
                  <button
                    onClick={() => handleStartFreshPO()}
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
                      flexShrink: 0,
                      boxShadow: '0 4px 14px rgba(14, 116, 144, 0.35)',
                      transition: 'all 0.2s ease',
                      letterSpacing: '0.2px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#085D75'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0E7490'}
                  >
                    <span>Create PO</span>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0E7490',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                      <ArrowRight size={16} strokeWidth={2.5} />
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* 1. FILTERS & SEARCH ROW CARD */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '12px 16px', backgroundColor: '#fafbfc', borderRadius: '12px', border: '1px solid #e2e8f0', alignItems: 'center', width: '100%', boxSizing: 'border-box', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: '#f8fafc', width: '320px', maxWidth: '100%', boxSizing: 'border-box' }}>
                <Search style={{ width: '15px', height: '15px', color: '#64748b', flexShrink: 0 }} />
                <input id="purchase-orders-search-query" name="searchQuery" aria-label="Search Purchase Orders (PO No, Company Name)"
                  type="text"
                  placeholder="Search Purchase Orders (PO No, Company Name)..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  style={{ border: 'none', background: 'none', outline: 'none', fontSize: '13px', width: '100%', color: '#334155' }}
                 />
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                <ModernDateRangePicker
                  startDate={filterDate}
                  endDate={filterEndDate}
                  onChange={({ startDate, endDate }) => {
                    setFilterDate(startDate);
                    setFilterEndDate(endDate);
                    setCurrentPage(1);
                  }}
                />

                <select id="purchase-orders-status-filter" name="statusFilter" aria-label="StatusFilter" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '12px', backgroundColor: 'white', color: '#334155', outline: 'none' }}>
                  {allStatusOptions.map(s => (
                    <option key={s} value={s === 'All orders' ? 'All' : s}>
                      {s === 'All orders' ? 'Status: All orders' : s}
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

            {/* KPI Filter Notification Banner */}
            {kpiFilterMeta && (
              <div style={{
                backgroundColor: '#F0F9FF',
                border: '1px solid #BAE6FD',
                borderRadius: '10px',
                padding: '10px 16px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#0369A1', fontWeight: '800' }}>
                  <span>Showing <strong>{filteredPOList.length}</strong> Purchase Orders filtered from {kpiFilterMeta.sourceLabel ? `${kpiFilterMeta.sourceLabel} KPI` : "Today's POs KPI"} ({kpiFilterMeta.periodLabel})</span>
                </div>
                <button
                  type="button"
                  onClick={clearFilters}
                  style={{
                    border: 'none',
                    backgroundColor: '#0284C7',
                    color: '#FFFFFF',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  Clear Filter ✕
                </button>
              </div>
            )}

            {/* 2. STATUS TABS ROW */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '20px', padding: '4px 0', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
              {(isExecutiveOrMD ? [
                { id: 'All', label: 'All orders', count: kpiBaseList.length, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Draft', label: 'Pending Approval', count: kpiBaseList.filter(po => getPoStage(po) === 'Draft').length, bg: '#fff7ed', fg: '#c2410c' },
                { id: 'MD_APPROVED', label: 'MD Approved', count: kpiBaseList.filter(po => getPoStage(po) === 'MD_APPROVED').length, bg: '#e0e7ff', fg: '#3730a3' }
              ] : isAccounts ? [
                { id: 'All', label: 'All orders', count: kpiBaseList.length, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Draft', label: 'Pending Approval', count: kpiBaseList.filter(po => getPoStage(po) === 'Draft').length, bg: '#fff7ed', fg: '#c2410c' },
                { id: 'MD_APPROVED', label: 'MD Approved', count: kpiBaseList.filter(po => getPoStage(po) === 'MD_APPROVED').length, bg: '#e0e7ff', fg: '#3730a3' },
                { id: 'PAYMENT_PROCESSED', label: 'Payment Processed', count: kpiBaseList.filter(po => getPoStage(po) === 'PAYMENT_PROCESSED').length, bg: '#fef3c7', fg: '#92400e' }
              ] : [
                { id: 'All', label: 'All orders', count: kpiBaseList.length, bg: '#e2e8f0', fg: '#475569' },
                { id: 'PURE_DRAFT', label: 'Drafts', count: kpiBaseList.filter(po => getPoStage(po) === 'PURE_DRAFT').length, bg: '#f1f5f9', fg: '#475569' },
                { id: 'Draft', label: 'Pending Approval', count: kpiBaseList.filter(po => getPoStage(po) === 'Draft').length, bg: '#fff7ed', fg: '#c2410c' },
                { id: 'MD_APPROVED', label: 'MD Approved', count: kpiBaseList.filter(po => getPoStage(po) === 'MD_APPROVED').length, bg: '#e0e7ff', fg: '#3730a3' },
                { id: 'PAYMENT_PROCESSED', label: 'Payment Processed', count: kpiBaseList.filter(po => getPoStage(po) === 'PAYMENT_PROCESSED').length, bg: '#fef3c7', fg: '#92400e' },
                { id: 'PROCEED_PO', label: 'Pending GRN', count: kpiBaseList.filter(po => getPoStage(po) === 'PROCEED_PO').length, bg: '#ecfeff', fg: '#0e7490' },
                { id: 'PARTIALLY_RECEIVED', label: 'Partially Received', count: kpiBaseList.filter(po => getPoStage(po) === 'PARTIALLY_RECEIVED').length, bg: '#fef3c7', fg: '#b45309' },
                { id: 'CLOSED', label: 'Fully Received', count: kpiBaseList.filter(po => getPoStage(po) === 'CLOSED').length, bg: '#dcfce7', fg: '#15803d' },
                { id: 'CANCELLED', label: 'Cancelled', count: kpiBaseList.filter(po => getPoStage(po) === 'CANCELLED').length, bg: '#fee2e2', fg: '#b91c1c' }
              ]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setPoTab(tab.id); setCurrentPage(1); }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: '10px 4px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    color: poTab === tab.id ? '#2563eb' : '#64748b',
                    borderBottom: poTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>{tab.label}</span>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', backgroundColor: tab.bg, color: tab.fg, padding: '1px 6px', borderRadius: '10px' }}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* PO Table or Mobile Cards */}
            <div className="section-card" style={{ padding: 0, overflowX: 'auto', display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px' }}>
              {isMobile ? (
                /* Mobile Cards View */
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
                        onChange={(e) => handleSelectAll(e, filteredPOList)}
                        checked={filteredPOList.length > 0 && filteredPOList.every(po => selectedPOs.includes(po.poNo))}
                        style={{ accentColor: '#0E7490', cursor: 'pointer', width: '16px', height: '16px', margin: 0 }}
                      />
                      <span>Select All ({filteredPOList.length})</span>
                    </label>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>
                      {selectedPOs.length > 0 ? `${selectedPOs.length} selected` : `Showing ${filteredPOList.length === 0 ? 0 : indexOfFirstRow + 1}-${Math.min(indexOfLastRow, filteredPOList.length)}`}
                    </span>
                  </div>

                  {filteredPOList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px 20px', color: '#94A3B8' }}>
                      <ShoppingCart size={38} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#475569' }}>No Purchase Orders found</p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Try adjusting your search or filters.</p>
                    </div>
                  ) : (
                    currentRows.map((po, idx) => {
                      const isChecked = selectedPOs.includes(po.poNo);
                      return (
                        <div
                          key={po.poNo || idx}
                          onClick={() => handleStartView(po)}
                          style={{
                            backgroundColor: isChecked ? '#ECFEFF' : '#FFFFFF',
                            border: isChecked ? '1.5px solid #0E7490' : '1px solid #E2E8F0',
                            borderLeft: isChecked ? '4px solid #0E7490' : '1px solid #CBD5E1',
                            borderRadius: '12px',
                            padding: '14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            cursor: 'pointer',
                            boxShadow: isChecked ? '0 4px 12px rgba(14,116,144,0.12)' : '0 1px 3px rgba(0,0,0,0.03)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {/* Top row: Checkbox + PO No + Status */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => handleSelectRow(po.poNo)}
                                style={{ accentColor: '#0E7490', cursor: 'pointer', width: '16px', height: '16px', margin: 0 }}
                              />
                              <span style={{ fontSize: '14px', fontWeight: '800', color: '#2563EB', letterSpacing: '0.2px' }}>
                                {po.poNo}
                              </span>
                            </div>
                            {renderStatusBadge(po.statusType, po.status)}
                          </div>

                          {/* Middle row: Company / Vendor Name */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A', lineHeight: '1.3' }}>
                              {po.vendor || '—'}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748B', flexWrap: 'wrap' }}>
                              <span>PO Date: <strong>{po.poDate || '—'}</strong></span>
                              <span>•</span>
                              <span>Issued By: <strong style={{ color: '#0369A1' }}>{po.purchaser || po.issuedBy || po.createdBy || po.created_by || '—'}</strong></span>
                              {po.deliveryDate && <span>• Due: <strong>{po.deliveryDate}</strong></span>}
                            </div>
                          </div>

                          {/* Bottom row: Total Value */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '12px',
                            paddingTop: '8px',
                            borderTop: '1px dashed #E2E8F0'
                          }}>
                            <span style={{ color: '#64748B' }}>Total Value:</span>
                            <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                              {po.amount || '—'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
              <div className="table-responsive" style={{ border: 'none', borderRadius: '16px', margin: 0, overflowX: 'auto', width: '100%', boxSizing: 'border-box' }}>
                <table className="custom-table" style={{ fontSize: '13px', width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#475569', height: '48px' }}>
                      <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', textAlign: 'center', padding: '12px 0', boxSizing: 'border-box' }}>
                        <input id="purchase-orders-select-all" name="selectAll" aria-label="SelectAll"
                          type="checkbox"
                          onChange={(e) => handleSelectAll(e, filteredPOList)}
                          checked={filteredPOList.length > 0 && filteredPOList.every(po => selectedPOs.includes(po.poNo))}
                          style={{ cursor: 'pointer', borderRadius: '4px', accentColor: '#0E7490' }}
                         />
                      </th>
                      <th
                        onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
                        style={{
                          width: '16%',
                          minWidth: '130px',
                          fontWeight: '700',
                          padding: '12px 14px',
                          color: '#0E7490',
                          textAlign: 'left',
                          boxSizing: 'border-box',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                        title="Click to toggle PO No. sort order (Descending / Ascending)"
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span>PO No.</span>
                          <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: '800' }}>
                            {sortDirection === 'desc' ? '▼' : '▲'}
                          </span>
                        </div>
                      </th>
                      <th style={{ width: '22%', minWidth: '180px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>Company Name</th>
                      <th style={{ width: '14%', minWidth: '120px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>Issued By</th>
                      <th style={{ width: '13%', minWidth: '110px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>PO Date</th>
                      <th style={{ width: '14%', minWidth: '120px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>Expected Delivery</th>
                      <th style={{ width: '12%', minWidth: '110px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'right', boxSizing: 'border-box' }}>Total Value</th>
                      <th style={{ width: '11%', minWidth: '110px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'center', boxSizing: 'border-box' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableLoading ? (
                      Array.from({ length: 6 }).map((_, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ textAlign: 'center', padding: '12px 0', width: '48px' }}>
                            <input id="purchase-orders-input-1" name="input1" aria-label="Input 1" type="checkbox" defaultChecked={false} disabled  />
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div className="skeleton-shimmer skeleton-text" style={{ width: '90px', height: '14px' }} />
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div className="skeleton-shimmer skeleton-text" style={{ width: '70%', height: '14px' }} />
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div className="skeleton-shimmer skeleton-text" style={{ width: '80px', height: '14px' }} />
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div className="skeleton-shimmer skeleton-text" style={{ width: '80px', height: '14px' }} />
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div className="skeleton-shimmer skeleton-text" style={{ width: '80px', height: '14px' }} />
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div className="skeleton-shimmer skeleton-text" style={{ width: '85px', height: '14px', marginLeft: 'auto' }} />
                          </td>
                          <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                            <div className="skeleton-shimmer" style={{ width: '80px', height: '22px', borderRadius: '12px', margin: '0 auto' }} />
                          </td>
                        </tr>
                      ))
                    ) : (() => {
                      return currentRows.map((po, idx) => {
                        const isChecked = selectedPOs.includes(po.poNo);
                        return (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: idx === currentRows.length - 1 ? 'none' : '1px solid #f1f5f9',
                              transition: 'all 0.15s ease',
                              backgroundColor: isChecked ? '#ECFEFF' : 'transparent',
                              borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent'
                            }}
                            className={`table-row-hover ${isChecked ? 'selected-row' : ''}`}
                          >
                            <td style={{ textAlign: 'center' }}>
                              <input id="purchase-orders-checkbox" name="checkbox" aria-label="Checkbox"
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleSelectRow(po.poNo)}
                                style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                               />
                            </td>
                            <td style={{ fontWeight: '600', color: '#2563eb', textAlign: 'left' }}>
                              <a
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleStartView(po);
                                }}
                                style={{ fontWeight: '600', color: '#2563eb', textDecoration: 'none' }}
                              >
                                {po.poNo}
                              </a>
                            </td>
                            <td style={{ fontWeight: '500', color: '#1e293b', textAlign: 'left' }}>{po.vendor}</td>
                            <td style={{ color: '#334155', fontWeight: '500', textAlign: 'left' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '50%',
                                  backgroundColor: '#E0F2FE',
                                  color: '#0369A1',
                                  fontSize: '10px',
                                  fontWeight: '700',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  {String(po.purchaser || po.issuedBy || po.createdBy || po.created_by || 'U').trim().charAt(0).toUpperCase()}
                                </span>
                                <span style={{ fontSize: '12.5px', color: '#1E293B', fontWeight: '600' }}>
                                  {po.purchaser || po.issuedBy || po.createdBy || po.created_by || '—'}
                                </span>
                              </div>
                            </td>
                            <td style={{ color: '#64748b', textAlign: 'left' }}>{po.poDate}</td>
                            <td style={{ color: '#64748b', textAlign: 'left' }}>{po.deliveryDate}</td>
                            <td style={{ fontWeight: '600', color: '#1e293b', textAlign: 'right' }}>{po.amount}</td>
                            <td style={{ textAlign: 'center' }}>
                              {renderStatusBadge(po.statusType, po.status)}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
              )}
                {/* 4. PAGINATION FOOTER */}
                {filteredPOList.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: isMobile ? 'center' : 'space-between',
                    alignItems: isMobile ? 'stretch' : 'center',
                    gap: isMobile ? '12px' : '16px',
                    padding: isMobile ? '12px 14px' : '16px 24px',
                    fontSize: '13px',
                    color: '#64748b',
                    borderTop: '1px solid #f1f5f9'
                  }}>
                    <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
                      Showing {indexOfFirstRow + 1} to {Math.min(indexOfLastRow, filteredPOList.length)} of {filteredPOList.length} entries
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isMobile ? 'space-between' : 'flex-end',
                      gap: '16px',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Rows per page:</span>
                        <select id="purchase-orders-rows-per-page" name="rowsPerPage" aria-label="RowsPerPage"
                          value={rowsPerPage}
                          onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                          style={{ height: '30px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', padding: '0 4px', backgroundColor: 'white' }}
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={15}>15</option>
                          <option value={20}>20</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          style={{ border: '1px solid #cbd5e1', background: currentPage === 1 ? '#f1f5f9' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                        >
                          <ChevronLeft style={{ width: '14px', height: '14px' }} />
                        </button>

                        {(() => {
                          let start = Math.max(1, currentPage - 1);
                          let end = start + 3;
                          if (end > totalPages) {
                            end = totalPages;
                            start = Math.max(1, end - 3);
                          }
                          const pages = [];
                          for (let i = start; i <= end; i++) {
                            pages.push(i);
                          }
                          return pages;
                        })().map(page => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            style={{
                              border: page === currentPage ? 'none' : '1px solid #cbd5e1',
                              background: page === currentPage ? '#0E7490' : 'white',
                              color: page === currentPage ? 'white' : '#475569',
                              cursor: 'pointer',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontWeight: page === currentPage ? 'bold' : 'normal'
                            }}
                          >
                            {page}
                          </button>
                        ))}

                        <button
                          disabled={currentPage === totalPages || totalPages === 0}
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          style={{ border: '1px solid #cbd5e1', background: (currentPage === totalPages || totalPages === 0) ? '#f1f5f9' : 'white', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                        >
                          <ChevronRight style={{ width: '14px', height: '14px' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            {/* Floating Selection Toolbar (exact reference design) */}
            {selectedPOs.length > 0 && !showCeoPoModal && (
              <div className="floating-action-bar po-no-print" style={{
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
                  <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selectedPOs.length}</strong> Selected
                </span>

                {/* Edit Info: Only available BEFORE MD approval (Draft / Pending Approval). Once MD approved, Edit is disabled/disappeared */}
                {!isExecutiveOrMD && !isAccounts && (() => {
                  // Check if any selected PO has already been approved by MD or progressed further
                  const canEdit = selectedPOs.length > 0 && selectedPOs.every(poNo => {
                    const target = poList.find(p => p.poNo === poNo || p.id === poNo);
                    if (!target) return false;
                    const st = String(target.status || '').trim();
                    const isDraftOrPending = st === 'Draft' || st.includes('Pending') || st.includes('WAITING') || st === 'Draft / Pending Approval';
                    return isDraftOrPending;
                  });

                  if (!canEdit) return null;

                  return (
                    <button
                      onClick={() => {
                        if (selectedPOs.length > 1) {
                          alert('You cannot edit multiple items at once.');
                        } else if (selectedPOs.length === 1) {
                          const targetPoNo = selectedPOs[0];
                          const idx = poList.findIndex(p => p.poNo === targetPoNo);
                          const targetPo = poList[idx] || { poNo: targetPoNo, vendor: '' };
                          setSelectedPOs([]);
                          handleStartEdit(targetPo, idx >= 0 ? idx : 0);
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
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                    >
                      <Edit3 size={14} style={{ color: '#64748B' }} /> Edit Info
                    </button>
                  );
                })()}

                {/* 3. Role & Status-specific Primary Actions (1 PO Selected) */}
                {selectedPOs.length === 1 && (() => {
                  const target = poList.find(p => p.poNo === selectedPOs[0] || p.id === selectedPOs[0]);
                  if (!target) return null;
                  const st = String(target.status || '').trim();
                  const stt = String(target.statusType || '').toLowerCase();

                  // ACCOUNTS ROLE ACTIONS: Verify Payment or Payment Processed badge ONLY
                  if (isAccounts) {
                    const rowStage = getPoStage(target);
                    const isPaidOrBeyond = st === 'Payment Processed' || stt === 'payment_processed' || rowStage === 'PAYMENT_PROCESSED' || rowStage === 'PROCEED_PO' || Boolean(target.paymentDetails) || Boolean(target.proceedDetails) || st === 'Proceed PO' || stt === 'proceed_po' || st.includes('CLOSED') || st.includes('PARTIALLY');
                    if (isPaidOrBeyond) {
                      return (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 12px',
                          borderRadius: '8px',
                          backgroundColor: '#ECFDF5',
                          color: '#065F46',
                          fontSize: '11px',
                          fontWeight: '700',
                          border: '1px solid #A7F3D0'
                        }}>
                          <CheckCircle size={13} style={{ color: '#059669' }} /> Payment Processed / Credit Verified
                        </div>
                      );
                    }
                    const isMdApproved = (st === 'MD Approved' || st === 'OPEN' || st === 'Approved' || stt === 'md_approved' || rowStage === 'MD_APPROVED') && !Boolean(target.paymentDetails);
                    if (isMdApproved) {
                      return (
                        <button
                          onClick={() => {
                            setSelectedPOs([]);
                            handleOpenPaymentProcessModal(target);
                          }}
                          style={{
                            backgroundColor: '#FFFBEB',
                            border: '1px solid #FDE68A',
                            color: '#92400E',
                            borderRadius: '10px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEF3C7'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFBEB'}
                        >
                          <CreditCard size={14} style={{ color: '#D97706' }} /> Verify Payment
                        </button>
                      );
                    }
                    return null;
                  }

                  // PROCUREMENT / ADMIN / CEO ACTIONS (isAccounts is FALSE)
                  const rowStage = getPoStage(target);
                  const isClosed = rowStage === 'CLOSED' || st.toUpperCase().includes('CLOSED') || st.toUpperCase().includes('FULLY RECEIVED') || stt === 'closed';
                  const isPartiallyReceived = rowStage === 'PARTIALLY_RECEIVED' || st.toUpperCase().includes('PARTIAL') || stt.includes('partial');

                  // If Closed / Fully Received or already in GRN receiving, no lifecycle progression actions needed here
                  if (isClosed || isPartiallyReceived) {
                    return null;
                  }

                  const isProceedPo = st === 'Proceed PO' || st === 'PROCEED PO' || stt === 'proceed_po' || rowStage === 'PROCEED_PO' || Boolean(target.proceedDetails);
                  const isPaymentProcessed = !isProceedPo && (st === 'Payment Processed' || stt === 'payment_processed' || rowStage === 'PAYMENT_PROCESSED' || Boolean(target.paymentDetails));
                  const isAlreadyApproved = isPaymentProcessed || isProceedPo || st === 'MD Approved' || stt === 'md_approved' || rowStage === 'MD_APPROVED';
                  const isDraftOrPending = !isAlreadyApproved && (st.includes('Pending') || st.includes('WAITING') || st === 'Draft / Pending Approval' || st === 'OPEN');

                  // A) If CEO/MD and still Draft -> Show "Approve as MD"
                  if (canApproveAsMD && isDraftOrPending) {
                    return (
                      <button
                        onClick={() => {
                          setSelectedPOs([]);
                          setApprovingPo(target);
                        }}
                        title="Approve Purchase Order directly as MD / CEO"
                        style={{
                          backgroundColor: '#F0FDF4',
                          border: '1.5px solid #86EFAC',
                          color: '#15803D',
                          borderRadius: '10px',
                          padding: '6px 14px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 4px rgba(22, 163, 74, 0.15)',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#DCFCE7'; e.currentTarget.style.borderColor = '#4ADE80'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F0FDF4'; e.currentTarget.style.borderColor = '#86EFAC'; }}
                      >
                        <CheckCircle size={14} style={{ color: '#16A34A' }} /> Approve PO (Authorize Payment)
                      </button>
                    );
                  }

                  // B) If Payment Processed -> Show "Proceed PO (Ready for GRN)"
                  if (isPaymentProcessed) {
                    return (
                      <button
                        onClick={() => handleOpenProceedPoModal(target)}
                        style={{
                          backgroundColor: '#0E7490',
                          border: 'none',
                          color: '#FFFFFF',
                          borderRadius: '10px',
                          padding: '6px 14px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 1px 2px rgba(14, 116, 144, 0.25)',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0891B2'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0E7490'}
                      >
                        <Send size={14} style={{ color: '#FFFFFF' }} /> Proceed PO (Ready for GRN)
                      </button>
                    );
                  }

                  // C) If Proceed PO -> Show "Push to GRN" (Proceed PO disappears)
                  if (isProceedPo) {
                    return (
                      <button
                        onClick={() => {
                          setSelectedPOs([]);
                          handlePushToGrn(target);
                        }}
                        style={{
                          backgroundColor: '#0E7490',
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
                          boxShadow: '0 2px 4px rgba(14, 116, 144, 0.3)',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0891B2'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0E7490'}
                      >
                        <Boxes size={14} style={{ color: '#FFFFFF' }} /> Push to GRN
                      </button>
                    );
                  }

                  return null;
                })()}

                {/* 4. Cancel PO: Opens cancellation remark popup (Replacing Delete) */}
                {!isAccounts && (
                  <button
                    onClick={() => {
                      if (selectedPOs && selectedPOs.length > 1) {
                        alert("Please select a single Purchase Order to cancel.");
                        return;
                      }
                      const target = (selectedPOs && selectedPOs.length > 0)
                        ? (poList.find(p => p.poNo === selectedPOs[0] || p.id === selectedPOs[0]) || { poNo: selectedPOs[0], id: selectedPOs[0], vendor: 'Vendor Reference' })
                        : (poList[0] || null);
                      if (!target) return;
                      if (String(target.status || '').toUpperCase() === 'CANCELLED') {
                        alert(`PO ${target.poNo || target.id} is already cancelled.`);
                        return;
                      }
                      setCancellingPo(target);
                      setCancellationRemarkInput('');
                    }}
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #FECACA',
                      color: '#DC2626',
                      borderRadius: '10px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEF2F2'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                  >
                    <Ban size={14} style={{ color: '#DC2626' }} /> Cancel PO
                  </button>
                )}

                {/* 5. View Details */}
                <button
                  onClick={() => {
                    if (selectedPOs && selectedPOs.length > 1) {
                      alert("You can't open details for multiple files at once. Please select a single item to view details.");
                      return;
                    }
                    const target = (selectedPOs && selectedPOs.length > 0)
                      ? (poList.find(p => p.poNo === selectedPOs[0] || p.id === selectedPOs[0]) || { poNo: selectedPOs[0], id: selectedPOs[0], vendor: 'Vendor Reference' })
                      : (poList[0] || null);
                    setSelectedPOs([]);
                    if (target) {
                      handleStartView(target);
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
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                >
                  <Eye size={14} style={{ color: '#0E7490' }} /> View Details
                </button>

                {/* 6. Export / Print PDF */}
                <button
                  onClick={() => {
                    if (selectedPOs && selectedPOs.length > 1) {
                      alert("Please select a single Purchase Order to export / print PDF.");
                      return;
                    }
                    const target = (selectedPOs && selectedPOs.length > 0)
                      ? (poList.find(p => p.poNo === selectedPOs[0] || p.id === selectedPOs[0]) || { poNo: selectedPOs[0], id: selectedPOs[0], vendor: 'Vendor Reference' })
                      : (poList[0] || null);
                    if (!target) return;
                    setSelectedPOs([]);
                    setPrintPoModal(target);
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
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                >
                  <FileText size={14} style={{ color: '#059669' }} /> Export / Print PDF
                </button>

                <button
                  onClick={() => setSelectedPOs([])}
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
                    marginLeft: '2px'
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        );
}
