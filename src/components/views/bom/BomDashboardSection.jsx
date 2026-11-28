import React from 'react';
import {
  Plus, Check, Eye, FileText, Search, AlertCircle, X, XCircle, Clock, Calendar, Edit3, RotateCcw, UploadCloud, Truck, Upload, Printer, CreditCard, CheckSquare, Boxes, User, ArrowUpRight, Receipt
} from 'lucide-react';
import ModernDateRangePicker from '../../ModernDateRangePicker';
import BomOperationalModals from './BomOperationalModals';
import BomExecutiveModals from './BomExecutiveModals';
import { isBomAddressProofPending, needsSalesAddressProof } from './bomStageHelpers';
import { isSalesLoginRole } from '../../../utils/vrmProductsData';

export default function BomDashboardSection({ ctx }) {
  const {
    userRole,
    getOrderLifecycle,
    getCleanSalesPersonName,
    formatAppliedAtDate,
    formatBomDateDot,
    getBomActiveStage,
    getBomStageTiming,
    searchQueryText,
    setSearchQueryText,
    kpiFilterMeta,
    setKpiFilterMeta,
    filterDateVal,
    setFilterDateVal,
    filterEndDateVal,
    setFilterEndDateVal,
    setFilterStatusSelect,
    filterSalesPerson,
    setFilterSalesPerson,
    activeSubTab,
    setActiveSubTab,
    selectedRows,
    setSelectedRows,
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    setPrintingBomRecord,
    setLrUploadModal,
    setCeoBomDetailModal,
    bomStore,
    tableLoading,
    isCeo,
    setConfirmingBomModal,
    setUploadPaymentModal,
    setSettleCreditModal,
    setQuickPreviewRecord,
    ceoMetrics,
    canUserCancelBom,
    handleCancelBomOrder,
    alert,
    handleSelectRowGeneric,
    pageConfig,
    uniqueSalesPersons,
    filteredRows,
    totalPages,
    indexOfLastRow,
    indexOfFirstRow,
    currentRows
  } = ctx;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, width: '100%', fontFamily: "'DM Sans', sans-serif" }}>
      {/* 1. TOP HEADER WITH CREATE BOM BUTTON */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            {pageConfig.title}
          </h2>
          <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
            {pageConfig.subtitle}
          </span>
        </div>
      </div>

      {/* BOM OPERATIONAL & EXECUTIVE FINANCIAL RIBBON (BUSINZ CANONICAL DESIGN SYSTEM) */}
      {ceoMetrics && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '10px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Tile 1: Total Order Book */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Order Book Value
              </span>
              <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#ECFEFF', color: '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Receipt size={13} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '20px', fontWeight: '900', color: '#0F172A', letterSpacing: '-0.5px' }}>
                {ceoMetrics.totalOrderBookFormatted}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '11px', fontWeight: '800', color: '#059669', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '1.5px 6px', borderRadius: '6px' }}>
                <ArrowUpRight style={{ width: '12px', height: '12px' }} />
                {ceoMetrics.validBomsCount} Orders
              </span>
            </div>
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: '10px', padding: '6px 10px', fontSize: '11px', color: '#64748B' }}>
              <span>Confirmed orders </span>
              <span style={{ color: '#059669', fontWeight: '800' }}>Active Order Book</span>
            </div>
          </div>

          {/* Tile 2: Today ALL BOM */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {ceoMetrics.isNonTodayDateFilter ? 'Filtered ALL BOM' : 'Today ALL BOM'}
              </span>
              <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={13} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '20px', fontWeight: '900', color: '#4F46E5', letterSpacing: '-0.5px' }}>
                {ceoMetrics.todayAllCount} Orders
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '11px', fontWeight: '800', color: '#4F46E5', backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', padding: '1.5px 6px', borderRadius: '6px' }}>
                {ceoMetrics.todayAllValFormatted}
              </span>
            </div>
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: '10px', padding: '6px 10px', fontSize: '11px', color: '#64748B' }}>
              <span>{ceoMetrics.isNonTodayDateFilter ? 'Selected filter ' : 'Registered today '}</span>
              <span style={{ color: '#4F46E5', fontWeight: '800' }}>{ceoMetrics.isNonTodayDateFilter ? 'Filtered Bookings' : 'Daily Bookings'}</span>
            </div>
          </div>

          {/* Tile 3: Dispatched BOM today */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {ceoMetrics.isNonTodayDateFilter ? 'Dispatched BOM' : 'Dispatched BOM today'}
              </span>
              <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Truck size={13} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '20px', fontWeight: '900', color: '#059669', letterSpacing: '-0.5px' }}>
                {ceoMetrics.todayDispatchedCount} Orders
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '11px', fontWeight: '800', color: '#059669', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '1.5px 6px', borderRadius: '6px' }}>
                {ceoMetrics.todayDispatchedValFormatted}
              </span>
            </div>
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: '10px', padding: '6px 10px', fontSize: '11px', color: '#64748B' }}>
              <span>Outward fulfillment </span>
              <span style={{ color: '#059669', fontWeight: '800' }}>Cleared & Dispatched</span>
            </div>
          </div>

          {/* Tile 4: Pending BOMs */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Pending BOMs
              </span>
              <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#FFFBEB', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={13} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '20px', fontWeight: '900', color: '#D97706', letterSpacing: '-0.5px' }}>
                {ceoMetrics.pendingCount} Orders
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '11px', fontWeight: '800', color: '#D97706', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', padding: '1.5px 6px', borderRadius: '6px' }}>
                {ceoMetrics.pendingValFormatted}
              </span>
            </div>
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: '10px', padding: '6px 10px', fontSize: '11px', color: '#64748B' }}>
              <span>In-progress pipeline </span>
              <span style={{ color: '#D97706', fontWeight: '800' }}>Awaiting Dispatch</span>
            </div>
          </div>
        </div>
      )}

      {/* ADDRESS PROOF RE-UPLOAD REQUEST NOTIFICATION BANNER (hidden on CEO/MD login) */}
      {!/^(ceo|md|managing director)$/i.test(String(userRole || '').trim()) &&
        (bomStore || []).some(b => b.addressProofReuploadRequested || b.status === 'Address Proof Requested from Sales') && (() => {
        const ONE_HOUR_MS = 60 * 60 * 1000;
        const nowMs = Date.now();
        const pendingBoms = (bomStore || []).filter(b => {
          if (!b || b.cancelled || (b.status || '').toLowerCase().includes('cancel')) return false;
          if (!(b.addressProofReuploadRequested || b.status === 'Address Proof Requested from Sales')) return false;
          const t = b.addressProofReuploadRequestedAt || b.reuploadRequestedAt || b.reissueRequestedAt;
          if (t) {
            const reqMs = new Date(t).getTime();
            if (Number.isFinite(reqMs) && (nowMs - reqMs) >= ONE_HOUR_MS) return false;
          }
          return true;
        });
        if (pendingBoms.length === 0) return null;

        const earliestReq = pendingBoms.reduce((acc, b) => {
          const t = b.addressProofReuploadRequestedAt || b.reuploadRequestedAt || b.reissueRequestedAt;
          if (!t) return acc;
          const time = new Date(t).getTime();
          return acc ? Math.min(acc, time) : time;
        }, null);

        let minsLeft = null;
        if (earliestReq) {
          minsLeft = Math.max(1, Math.ceil((ONE_HOUR_MS - (nowMs - earliestReq)) / 60000));
        }

        return (
          <div style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #FECACA',
            borderLeft: '4px solid #DC2626',
            borderRadius: '14px',
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 4px 14px rgba(220, 38, 38, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertCircle size={19} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>Address Proof Re-upload Requested by Accounts</span>
                  <span style={{ fontSize: '11px', fontWeight: '800', backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '2px 9px', borderRadius: '9999px' }}>
                    {pendingBoms.length} Order{pendingBoms.length > 1 ? 's' : ''}
                  </span>
                  {minsLeft !== null && (
                    <span style={{ fontSize: '11px', fontWeight: '800', backgroundColor: '#DC2626', color: '#FFFFFF', padding: '2px 9px', borderRadius: '9999px' }}>
                      ⏱️ {minsLeft}m SLA Left
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>
                  Upload verified address proof within 1 hour of the Accounts reissue request to prevent automatic cancellation.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setActiveSubTab('AddressAction'); setCurrentPage(1); }}
              style={{
                border: 'none',
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                padding: '9px 18px',
                borderRadius: '9999px',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)'
              }}
            >
              Review Requested Orders ({pendingBoms.length}) <ArrowUpRight size={14} />
            </button>
          </div>
        );
      })()}

      {/* 2. FILTERS & SEARCH ROW */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '12px 16px', backgroundColor: '#fafbfc', borderRadius: '12px', border: '1px solid #e2e8f0', alignItems: 'center', width: '100%', boxSizing: 'border-box', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: '#f8fafc', width: '340px' }}>
          <Search style={{ width: '15px', height: '15px', color: '#64748b' }} />
          <input id="bom-orders-page-config-search-placeholder" name="pageConfigSearchPlaceholder" aria-label="PageConfig searchPlaceholder"
            type="text"
            placeholder={pageConfig.searchPlaceholder}
            value={searchQueryText}
            onChange={(e) => { setSearchQueryText(e.target.value); setCurrentPage(1); }}
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: '13px', width: '100%', color: '#334155' }}
           />
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'nowrap', flexShrink: 0 }}>
          {isCeo && (
            <select
              id="bom-orders-sales-filter"
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
                backgroundColor: '#ffffff',
                color: filterSalesPerson !== 'All' && filterSalesPerson !== 'All Sales' ? '#0e7490' : '#334155',
                fontWeight: filterSalesPerson !== 'All' && filterSalesPerson !== 'All Sales' ? '600' : '500',
                outline: 'none',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <option value="All Sales">All Sales</option>
              {uniqueSalesPersons.map(sp => (
                <option key={sp} value={sp}>{sp}</option>
              ))}
            </select>
          )}

          <ModernDateRangePicker
            startDate={filterDateVal}
            endDate={filterEndDateVal}
            onChange={({ startDate, endDate }) => {
              setFilterDateVal(startDate);
              setFilterEndDateVal(endDate);
              if (kpiFilterMeta) {
                setKpiFilterMeta(null);
                try { sessionStorage.removeItem('controlroom_bom_initial_date_filter'); } catch (_) {}
              }
              setCurrentPage(1);
            }}
          />

          <button
            onClick={() => {
              setSearchQueryText('');
              setFilterDateVal('');
              setFilterEndDateVal('');
              setFilterStatusSelect('All');
              setFilterSalesPerson('All Sales');
              setKpiFilterMeta(null);
              try { sessionStorage.removeItem('controlroom_bom_initial_date_filter'); } catch (_) {}
            }}
            title="Clear Filters"
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              height: '38px',
              width: '38px'
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
          backgroundColor: '#F0F9FF',
          border: '1.5px solid #0284C7',
          borderRadius: '10px',
          padding: '9px 16px',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#0369A1', fontWeight: '800' }}>
            <span>Showing <strong>{filteredRows.length}</strong> BOM Orders filtered from {kpiFilterMeta.sourceLabel ? `${kpiFilterMeta.sourceLabel} KPI` : 'Company Overview KPI'} ({kpiFilterMeta.periodLabel})</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setKpiFilterMeta(null);
              setFilterDateVal('');
              setFilterEndDateVal('');
              try { sessionStorage.removeItem('controlroom_bom_initial_date_filter'); } catch (_) {}
            }}
            style={{
              border: 'none',
              backgroundColor: '#0284C7',
              color: '#FFFFFF',
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            ✕ Show All BOM Orders
          </button>
        </div>
      )}

      {/* 3. STATUS FILTER PILLS (CEO Dashboard Pill Style with Counts) */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '4px 0',
        alignItems: 'center',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {pageConfig.tabs.map(tab => {
          const isSelected = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveSubTab(tab.id); setCurrentPage(1); }}
              style={{
                backgroundColor: isSelected ? '#0E7490' : '#FFFFFF',
                color: isSelected ? '#FFFFFF' : '#334155',
                border: isSelected ? '1px solid #0E7490' : '1px solid #E2E8F0',
                borderRadius: '9999px',
                padding: '7px 14px',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isSelected
                  ? '0 2px 8px rgba(14, 116, 144, 0.25)'
                  : '0 1px 2px rgba(15, 23, 42, 0.04)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <span>{tab.label}</span>
              <span style={{
                fontSize: '11px',
                padding: '1px 7px',
                borderRadius: '9999px',
                backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.22)' : (tab.bg || '#F1F5F9'),
                color: isSelected ? '#FFFFFF' : (tab.fg || '#475569'),
                fontWeight: '800',
                lineHeight: '1.3'
              }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. MAIN DATA DISPLAY (PIPELINE CARDS / CLASSIC TABLE) WITH INTERACTIVE ROW SELECTION */}
      <div className="section-card" style={{ padding: '0', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
        {/* MASTER REGISTER DATA TABLE (Unified Clean Table for Sales & CEO) */}
        {(() => {
          let ceoPiLookup = null;
          const getCeoPiLookup = () => {
            if (ceoPiLookup) return ceoPiLookup;
            ceoPiLookup = new Map();
            try {
              const rawPis = JSON.parse(localStorage.getItem('controlroom_pi_store') || '[]');
              if (Array.isArray(rawPis)) {
                rawPis.forEach((p) => {
                  const k1 = String(p?.piNo || '').trim().toLowerCase();
                  const k2 = String(p?.id || '').trim().toLowerCase();
                  const k3 = String(p?.code || '').trim().toLowerCase();
                  if (k1) ceoPiLookup.set(k1, p);
                  if (k2) ceoPiLookup.set(k2, p);
                  if (k3) ceoPiLookup.set(k3, p);
                });
              }
            } catch (_) {}
            return ceoPiLookup;
          };
          const resolveCeoBomValue = (row) => {
            const parseNum = (v) => {
              if (v === null || v === undefined || v === '') return 0;
              if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
              const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
              return Number.isFinite(n) && n > 0 ? n : 0;
            };
            let val = parseNum(row.grandTotal) || parseNum(row.totalAmount) || parseNum(row.amount) || parseNum(row.value) || parseNum(row.total);
            if (!val) {
              const linkedPi = String(row.sourcePiNo || row.piNo || row.piNumber || row.source_pi_no || '').trim().toLowerCase();
              if (linkedPi) {
                const matchedPi = getCeoPiLookup().get(linkedPi);
                if (matchedPi) {
                  val = parseNum(matchedPi.grandTotal) || parseNum(matchedPi.totalAmount) || parseNum(matchedPi.amount);
                }
              }
            }
            if (val > 0) return '₹ ' + Math.round(val).toLocaleString('en-IN');
            if (row.c5 && row.c5 !== '—') return row.c5;
            return '—';
          };

          return (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table className="custom-table" style={{ width: '100%', minWidth: '1120px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                  <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', padding: '12px 0', textAlign: 'center', verticalAlign: 'middle', boxSizing: 'border-box' }}>
                    <input
                      id="bom-orders-table-select-all"
                      name="selectAll"
                      aria-label="SelectAll"
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRows(filteredRows.map(r => r.code));
                        } else {
                          setSelectedRows([]);
                        }
                      }}
                      checked={filteredRows.length > 0 && filteredRows.every(r => selectedRows.includes(r.code))}
                      style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                    />
                  </th>
                  <th style={{ width: '150px', minWidth: '130px', padding: '12px 14px', boxSizing: 'border-box' }}>BOM NO.</th>
                  <th style={{ width: '120px', minWidth: '110px', padding: '12px 14px', boxSizing: 'border-box' }}>BOM Date</th>
                  <th style={{ width: '180px', minWidth: '160px', padding: '12px 14px', boxSizing: 'border-box' }}>Sales Person</th>
                  <th style={{ minWidth: '220px', padding: '12px 14px', boxSizing: 'border-box' }}>Company Name</th>
                  <th style={{ width: '140px', minWidth: '125px', padding: '12px 14px', textAlign: 'right', boxSizing: 'border-box' }}>Value</th>
                  <th style={{ width: '200px', minWidth: '180px', padding: '12px 14px', textAlign: 'center', boxSizing: 'border-box' }}>Stages</th>
                </tr>
              </thead>
              <tbody>
                {tableLoading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={`skel-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ textAlign: 'center', padding: '12px 0', width: '48px' }}>
                        <input type="checkbox" disabled style={{ opacity: 0.3 }} />
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div className="skeleton-shimmer skeleton-text" style={{ width: '100px', height: '14px' }} />
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div className="skeleton-shimmer skeleton-text" style={{ width: '80px', height: '14px' }} />
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div className="skeleton-shimmer skeleton-text" style={{ width: '120px', height: '14px' }} />
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div className="skeleton-shimmer skeleton-text" style={{ width: '65%', height: '14px' }} />
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div className="skeleton-shimmer skeleton-text" style={{ width: '85px', height: '14px', marginLeft: 'auto' }} />
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div className="skeleton-shimmer" style={{ width: '120px', height: '22px', borderRadius: '12px', margin: '0 auto' }} />
                      </td>
                    </tr>
                  ))
                ) : currentRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: '#64748B' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <Boxes size={32} style={{ color: '#CBD5E1' }} />
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#475569' }}>No BOM orders found</span>
                        <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                          No records match your active search or filter criteria.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentRows.map((row, idx) => {
                    const isChecked = selectedRows.includes(row.code);
                    const isCancelled = Boolean(row.cancelled || row.status === 'Cancelled & Stock Restored' || (row.status || '').toLowerCase().includes('cancel') || row.tabGroup === 'Cancelled');
                    const bDateRaw = row.appliedAt || row.bomDate || row.date || row.createdAt;
                    const dateFormatted = formatBomDateDot(bDateRaw);
                    const expectedDateFormatted = row.deliveryDate ? formatBomDateDot(row.deliveryDate) : '';
                    const timing = getBomStageTiming(row);
                    const currentStage = getBomActiveStage(row);

                    return (
                      <tr
                        key={row.code || idx}
                        onClick={() => {
                          if (isCeo) {
                            setCeoBomDetailModal(row);
                          } else {
                            const isPendingSales = ['Draft', 'Pending Confirmation', 'Pending Sales Confirmation', 'Edited / Pending Confirmation', 'Cancelled & Reissued to Dispatch', 'Pending Verification', 'Pending'].includes(row.status);
                            setConfirmingBomModal({ ...row, isEditMode: isPendingSales && !isCancelled });
                          }
                        }}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          transition: 'all 0.15s ease',
                          backgroundColor: isChecked ? '#ECFEFF' : 'transparent',
                          cursor: 'pointer'
                        }}
                        className="hover-row"
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
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleSelectRowGeneric(row.code)}
                            style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                          />
                        </td>
                        <td style={{ padding: '12px 14px', width: '150px', minWidth: '130px' }}>
                          {(() => {
                            const isEditedBom = Boolean(row.isEdited || (Array.isArray(row.editHistory) && row.editHistory.length > 0));
                            return (
                              <span
                                title={isEditedBom ? (row.lastEditedBy ? `Edited by ${row.lastEditedBy} on ${new Date(row.lastEditedAt || Date.now()).toLocaleString('en-IN')}` : 'This BOM was edited') : undefined}
                                style={{
                                  fontWeight: 'bold',
                                  color: isCancelled ? '#DC2626' : (isEditedBom ? '#D97706' : '#2563EB'),
                                  fontSize: '13px'
                                }}
                              >
                                {row.code}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748B', width: '120px', minWidth: '110px', whiteSpace: 'nowrap' }}>
                          <div>{dateFormatted}</div>
                          {isCeo && expectedDateFormatted && (
                            <div style={{ fontSize: '11px', color: '#0E7490', fontWeight: '600', marginTop: '2px' }}>
                              Exp: {expectedDateFormatted}
                            </div>
                          )}
                        </td>
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
                              {((row.salesPerson || row.createdBy || 'S')[0] || 'S').toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: '700', fontSize: '12.5px', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {row.salesPerson || row.createdBy || 'Sales Department'}
                              </div>
                              {row.salesPersonCode && (
                                <div style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace' }}>
                                  {row.salesPersonCode}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '600', color: '#1E293B', minWidth: '220px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: '700', color: '#0F172A' }}>
                              {row.c3 || row.customerName || 'Customer'}
                            </span>
                            {(row.contactPerson || row.c2) && (
                              <span style={{ fontSize: '11px', color: '#64748B' }}>
                                Attn: {row.contactPerson || row.c2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', width: '140px', minWidth: '125px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: '800', color: isCancelled ? '#94A3B8' : '#0F172A', fontSize: '13px', textDecoration: isCancelled ? 'line-through' : 'none' }}>
                            {resolveCeoBomValue(row)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', width: '200px', minWidth: '180px' }}>
                          <span style={{
                            backgroundColor: currentStage.bg,
                            color: currentStage.color,
                            border: `1px solid ${currentStage.border}`,
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '700',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap'
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: currentStage.dot || currentStage.color }} />
                            <span>{currentStage.name}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          );
        })()}
        {/* PAGINATION FOOTER - STRICT RULES MATCH */}
        {!tableLoading && filteredRows.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', fontSize: '13px', color: '#64748B', borderTop: '1px solid #F1F5F9', backgroundColor: '#FFFFFF' }}>
            {/* Left Side: Rows per page selector + Showing X to Y entries */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Showing per page</span>
                <select id="bom-orders-rows-per-page" name="rowsPerPage" aria-label="RowsPerPage"
                  value={rowsPerPage}
                  onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  style={{ height: '32px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', padding: '0 8px', backgroundColor: 'white', fontWeight: 'bold' }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                </select>
              </div>
              <span>Showing {filteredRows.length === 0 ? 0 : indexOfFirstRow + 1} to {Math.min(indexOfLastRow, filteredRows.length)} of {filteredRows.length} entries</span>
            </div>

            {/* Right Side: Page navigation controls */}
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
                  id="bom-orders-goto-page-input"
                  style={{ width: '42px', height: '32px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}
                 />
                <button
                  onClick={() => {
                    const val = parseInt(document.getElementById('bom-orders-goto-page-input')?.value || '1', 10);
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

      {/* FLOATING ACTION BAR FOR SELECTED ROWS */}
      {selectedRows.length > 0 && (
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
            <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selectedRows.length}</strong> Selected
          </span>

          {/* View Details - Always accessible across all logins (Sales, Admin, etc.) and statuses */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (selectedRows.length > 1) {
                alert("You can't open details for multiple BOM orders at once. Please select a single item to view details.");
                return;
              }
              const codeVal = (selectedRows && selectedRows.length > 0) ? selectedRows[0] : null;
              const targetRow = codeVal
                ? ((filteredRows || []).find(r => r.code === codeVal || r.id === codeVal || r.bomCode === codeVal) || (bomStore || []).find(b => (b.bomCode || b.code) === codeVal) || { code: codeVal, name: `Record #${codeVal}` })
                : (filteredRows && filteredRows[0] ? filteredRows[0] : null);
              setSelectedRows([]);
              if (targetRow) {
                if (isCeo) {
                  setCeoBomDetailModal(targetRow);
                } else {
                  setQuickPreviewRecord(targetRow);
                }
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
            <Eye size={14} style={{ color: '#0E7490' }} /> View Details
          </button>

          {/* Reconfirm BOM Action Button (Sales Person Verification of Materials & Quantities) */}
          {userRole !== 'CEO' && userRole !== 'MD' && userRole !== 'Managing Director' && (() => {
            const codeVal = (selectedRows && selectedRows.length > 0) ? selectedRows[0] : null;
            if (!codeVal) return null;
            const targetRow = (filteredRows || []).find(r => r.code === codeVal || r.id === codeVal || r.bomCode === codeVal) || (bomStore || []).find(b => (b.bomCode || b.code) === codeVal);
            if (!targetRow) return null;

            const storeBom = (bomStore || []).find(b => (b.bomCode || b.code || b.id) === (targetRow.bomCode || targetRow.code || targetRow.id));
            const effectiveBom = storeBom || targetRow;

            // Reconfirm BOM must strictly NOT be visible if already confirmed and sent to dispatch packing
            const isExplicitPendingStatus = ['Draft', 'Pending Confirmation', 'Pending Sales Confirmation', 'Edited / Pending Confirmation', 'Cancelled & Reissued to Dispatch', 'Pending Verification', 'Pending'].includes(effectiveBom.status);
            const isAlreadyConfirmedOrSent = Boolean(
              effectiveBom.salesConfirmed ||
              effectiveBom.salesReconfirmed ||
              effectiveBom.salesConfirmedAt ||
              (!isExplicitPendingStatus && effectiveBom.stockBlocked) ||
              effectiveBom.stockDeducted ||
              effectiveBom.dispatchPackingVerified ||
              effectiveBom.packingStatus === 'PACKING_VERIFIED' ||
              (effectiveBom.dispatchPacking && effectiveBom.dispatchPacking.some(p => p && (p.packed || p.scanned || p.checked))) ||
              (typeof effectiveBom.status === 'string' && (
                effectiveBom.status.toLowerCase().includes('dispatch') ||
                effectiveBom.status.toLowerCase().includes('packing') ||
                effectiveBom.status.toLowerCase().includes('confirmed') ||
                effectiveBom.status.toLowerCase().includes('accounts') ||
                effectiveBom.status.toLowerCase().includes('invoice') ||
                effectiveBom.status.toLowerCase().includes('closed') ||
                effectiveBom.status.toLowerCase().includes('completed') ||
                effectiveBom.status.toLowerCase().includes('cancel')
              )) ||
              effectiveBom.cancelled ||
              effectiveBom.fullyCompleted
            );
            if (isAlreadyConfirmedOrSent) return null;

            return (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (selectedRows.length > 1) {
                    alert('Please select a single BOM order to reconfirm.');
                    return;
                  }
                  setSelectedRows([]);
                  setConfirmingBomModal({ ...targetRow, isEditMode: true });
                }}
                style={{
                  backgroundColor: '#0E7490',
                  border: '1px solid #0891B2',
                  color: '#FFFFFF',
                  borderRadius: '20px',
                  padding: '6px 16px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(14, 116, 144, 0.35)',
                  transition: 'all 0.15s ease'
                }}
                title="Verify materials, check quantities with tick marks, and send BOM to Dispatch"
              >
                <CheckSquare size={14} style={{ color: '#FFFFFF' }} /> Reconfirm BOM
              </button>
            );
          })()}

          {userRole !== 'CEO' && userRole !== 'MD' && userRole !== 'Managing Director' && (() => {
            const isOnlyEditable = (selectedRows || []).every(codeVal => {
              const r = (filteredRows || []).find(it => it.code === codeVal || it.id === codeVal || it.bomCode === codeVal) || (bomStore || []).find(b => (b.bomCode || b.code) === codeVal);
              return r && (!r.status || ['Draft', 'Pending Confirmation', 'Pending Sales Confirmation', 'Edited / Pending Confirmation', 'Pending'].includes(r.status));
            });
            if (!isOnlyEditable) return null;

            return (
              <button
                onClick={() => {
                  if (selectedRows.length > 1) {
                    alert('You cannot edit multiple items at once.');
                  } else if (selectedRows.length === 1) {
                    const codeVal = selectedRows[0];
                    const targetRow = (filteredRows || []).find(r => r.code === codeVal || r.id === codeVal || r.bomCode === codeVal) || { code: codeVal };
                    setSelectedRows([]);
                    setConfirmingBomModal({ ...targetRow, isEditMode: true });
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
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                <Edit3 size={14} style={{ color: '#64748B' }} /> Edit Info
              </button>
            );
          })()}

          <button
            onClick={() => {
              const codeVal = (selectedRows && selectedRows.length > 0) ? selectedRows[0] : null;
              const targetRow = codeVal
                ? ((filteredRows || []).find(r => r.code === codeVal || r.id === codeVal || r.bomCode === codeVal) || (bomStore || []).find(b => b.bomCode === codeVal))
                : ((bomStore || [])[0] || (filteredRows || [])[0]);

              setSelectedRows([]);
              if (targetRow) {
                setUploadPaymentModal(targetRow);
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
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <CreditCard size={14} style={{ color: '#2563EB' }} /> Payment Details
          </button>

          {/* Attach Payment Proof Button for Packed BOM Awaiting Sales Slip */}
          {(() => {
            const codeVal = (selectedRows && selectedRows.length > 0) ? selectedRows[0] : null;
            if (!codeVal) return null;
            const targetRow = (filteredRows || []).find(r => r.code === codeVal || r.id === codeVal || r.bomCode === codeVal) || (bomStore || []).find(b => (b.bomCode || b.code) === codeVal);
            const isAwaitingProof = targetRow && getBomActiveStage(targetRow).name === 'Payment Proof Pending (Sales)';
            if (!isAwaitingProof || isCeo) return null;
            return (
              <button
                type="button"
                onClick={() => {
                  setSelectedRows([]);
                  setUploadPaymentModal(targetRow);
                }}
                style={{
                  backgroundColor: '#F59E0B',
                  border: '1px solid #D97706',
                  color: '#FFFFFF',
                  borderRadius: '20px',
                  padding: '6px 16px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)',
                  transition: 'all 0.15s ease'
                }}
                title="Upload payment receipt / proof slip to release order to Accounts"
              >
                <Upload size={14} style={{ color: '#FFFFFF' }} /> Attach Payment Proof
              </button>
            );
          })()}

          {/* Settle Credit / Record Payment Button for Credit Orders */}
          {(() => {
            const codeVal = (selectedRows && selectedRows.length > 0) ? selectedRows[0] : null;
            if (!codeVal) return null;
            const targetRow = (filteredRows || []).find(r => r.code === codeVal || r.id === codeVal || r.bomCode === codeVal) || (bomStore || []).find(b => (b.bomCode || b.code) === codeVal);
            if (!targetRow || targetRow.cancelled || isCeo) return null;

            const pType = String(targetRow.paymentType || targetRow.paymentTerms || '').toLowerCase();
            const accPay = String(targetRow.accountsVerification?.paymentStatus || '').toLowerCase();
            const cDays = Number(targetRow.creditDays || 0);
            const isCreditOrder = pType.includes('credit') || pType.includes('net 30') || accPay.includes('credit') || cDays > 0;

            const isAlreadySettled = Boolean(
              targetRow.creditSettled || 
              targetRow.paymentSettled || 
              String(targetRow.status || '').toLowerCase().includes('credit settled') ||
              targetRow.accountsVerification?.creditSettled
            );

            if (!isCreditOrder || isAlreadySettled) return null;

            return (
              <button
                type="button"
                onClick={() => {
                  setSelectedRows([]);
                  setSettleCreditModal(targetRow);
                }}
                style={{
                  backgroundColor: '#059669',
                  border: '1px solid #047857',
                  color: '#FFFFFF',
                  borderRadius: '20px',
                  padding: '6px 16px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.35)',
                  transition: 'all 0.15s ease'
                }}
                title="Record customer payment and close credit for this order"
              >
                <Receipt size={14} style={{ color: '#FFFFFF' }} /> Settle Credit / Record Payment
              </button>
            );
          })()}

          {(() => {
            const codeVal = (selectedRows && selectedRows.length > 0) ? selectedRows[0] : null;
            if (!codeVal) return null;
            const targetRow = (filteredRows || []).find(r => r.code === codeVal || r.id === codeVal || r.bomCode === codeVal) || (bomStore || []).find(b => (b.bomCode || b.code) === codeVal);
            const isAwaitingLr = targetRow && (
              targetRow.status === 'Dispatched - Awaiting LR Copy' ||
              targetRow.status === 'Awaiting LR Copy' ||
              targetRow.status === 'AWAITING LR COPY' ||
              targetRow.tabGroup === 'AwaitingLrCopy'
            );
            if (!isAwaitingLr || isCeo) return null;
            return (
              <button
                onClick={() => {
                  setSelectedRows([]);
                  setLrUploadModal(targetRow);
                }}
                style={{
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #FCD34D',
                  color: '#92400E',
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
                  boxShadow: '0 1px 2px rgba(245, 158, 11, 0.15)'
                }}
              >
                <FileText size={14} style={{ color: '#D97706' }} /> Upload LR Copy
              </button>
            );
          })()}

          {(() => {
            const hasCancellable = (selectedRows || []).some(codeVal => {
              const row = (filteredRows || []).find(r => r.code === codeVal || r.id === codeVal || r.bomCode === codeVal) || (bomStore || []).find(b => (b.bomCode || b.code) === codeVal);
              return row && canUserCancelBom(row);
            });
            if (!hasCancellable) return null;

            return (
              <button
                type="button"
                onClick={() => {
                  if (selectedRows.length > 1) {
                    alert('Please select a single BOM order to cancel.');
                    return;
                  }
                  const targetCode = selectedRows[0];
                  const targetBom = (filteredRows || []).find(r => r.code === targetCode || r.id === targetCode || r.bomCode === targetCode) || (bomStore || []).find(b => (b.bomCode || b.code) === targetCode);
                  if (targetBom) {
                    setSelectedRows([]);
                    handleCancelBomOrder(targetBom);
                  }
                }}
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#DC2626',
                  borderRadius: '20px',
                  padding: '6px 16px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: '0 1px 3px rgba(220, 38, 38, 0.12)',
                  transition: 'all 0.15s ease'
                }}
                title="Cancel selected BOM order and restore inventory stock"
              >
                <XCircle size={14} style={{ color: '#DC2626' }} /> Cancel BOM
              </button>
            );
          })()}

          {!isSalesLoginRole(userRole) && (
          <button
            type="button"
            onClick={() => {
              const codeVal = (selectedRows && selectedRows.length > 0) ? selectedRows[0] : null;
              const fullBom = codeVal
                ? (bomStore || []).find(b => b && (b.bomCode === codeVal || b.code === codeVal || b.id === codeVal || b.piNo === codeVal))
                : (bomStore || [])[0];
              const rowRec = codeVal
                ? (filteredRows || []).find(r => r && (r.code === codeVal || r.id === codeVal || r.bomCode === codeVal))
                : (filteredRows || [])[0];
              const mergedRow = (fullBom || rowRec)
                ? {
                    ...(fullBom || {}),
                    ...(rowRec || {}),
                    items: (Array.isArray(fullBom?.items) && fullBom.items.length > 0)
                      ? fullBom.items
                      : (rowRec?.items || [])
                  }
                : null;

              setSelectedRows([]);
              if (mergedRow) {
                setPrintingBomRecord(mergedRow);
              } else {
                alert('Please select a BOM record to print.');
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
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <Printer size={14} style={{ color: '#059669' }} /> Print
          </button>
          )}

          <button
            onClick={() => {
              setSelectedRows([]);
            }}
            title="Deselect all"
            style={{ backgroundColor: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <BomOperationalModals ctx={ctx} />
      <BomExecutiveModals ctx={ctx} />
    </div>
  );
}
