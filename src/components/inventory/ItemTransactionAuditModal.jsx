import React from "react";
import {
  ArrowLeft, Eye, Download, Printer, Filter, Calendar, Search, CheckCircle, Clock,
  AlertCircle, ChevronDown, ChevronUp, User, ShoppingCart, Truck, ShieldAlert,
  Boxes, Layers, ArrowRight, RotateCcw, Activity, ClipboardList, Info, X
} from "lucide-react";
import StatusBadge from "../StatusBadge";

export default function ItemTransactionAuditModal(props) {
  const {
    selectedMat,
    setShowTxModal,
    activeTab,
    isRawMaterialDirectory,
    itemAuditLogs = [],
    auditViewMode,
    setAuditViewMode,
    auditTypeFilter,
    setAuditTypeFilter,
    auditSearchQuery,
    setAuditSearchQuery
  } = props;

  const isOut = selectedMat.status === 'Out of Stock';
    const isLow = selectedMat.status === 'Low Stock';
    const stBg = isOut ? '#FEF2F2' : isLow ? '#FFF7ED' : '#F0FDF4';
    const stFg = isOut ? '#B91C1C' : isLow ? '#C2410C' : '#15803D';
    const stBorder = isOut ? '1px solid #FEE2E2' : isLow ? '1px solid #FFEDD5' : '1px solid #DCFCE7';

    const physicalStockVal = Math.max(0, parseFloat(selectedMat.physicalStock !== undefined ? selectedMat.physicalStock : (selectedMat.stock !== undefined ? selectedMat.stock : (selectedMat.openingStock || 0))) || 0);
    const reservedVal = Math.max(0, parseFloat(selectedMat.reserved !== undefined ? selectedMat.reserved : (selectedMat.blockedForBom || 0)) || 0);
    const availableVal = Math.max(0, parseFloat(selectedMat.stock !== undefined ? selectedMat.stock : (physicalStockVal - reservedVal)) || 0);
    const minLevelVal = Math.max(0, parseFloat(selectedMat.minLevel !== undefined ? selectedMat.minLevel : (selectedMat.reorderLevel || 50)) || 50);

    const filteredLogs = itemAuditLogs.filter(log => {
      if (auditTypeFilter === 'OUTFLOW' && log.qty >= 0) return false;
      if (auditTypeFilter === 'INFLOW' && log.qty <= 0) return false;
      if (auditTypeFilter === 'BOM' && !String(log.type || '').startsWith('BOM')) return false;
      if (auditTypeFilter === 'GRN' && log.type !== 'GOODS_RECEIPT') return false;

      if (auditSearchQuery.trim()) {
        const q = auditSearchQuery.toLowerCase().trim();
        const str = `${log.referenceDoc} ${log.reason} ${log.typeName} ${log.user} ${log.role} ${log.source} ${log.salesPerson || ''} ${log.salesPersonFull || ''} ${log.salesPersonCode || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, width: '100%', fontFamily: "'DM Sans', sans-serif" }}>
        
        {/* Top Breadcrumb & Actions Bar */}
        <div style={{
          backgroundColor: '#FFFFFF',
          padding: '16px 24px',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          boxSizing: 'border-box',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          gap: '16px'
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>
              <span>Businz</span>
              <span>/</span>
              <span>{isRawMaterialDirectory ? (activeTab === 'Raw Material Inventory' ? 'Raw Material Inventory' : 'Raw Material Directory') : (activeTab === 'Store Inventory' ? 'Store Inventory' : 'Inventory Stores')}</span>
              <span>/</span>
              <span style={{ color: '#0E7490' }}>Item Audit Log & Traceability</span>
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '10px' }}>
              Item Audit Log & Production Traceability
              <span style={{ fontSize: '12px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', backgroundColor: '#ECFEFF', color: '#0E7490', border: '1px solid #A5F3FC' }}>
                Live Inventory Ledger
              </span>
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setShowTxModal(false)}
            style={{
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              padding: '9px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.borderColor = '#94A3B8'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
          >
            <ArrowLeft size={16} /> Back to {isRawMaterialDirectory ? (activeTab === 'Raw Material Inventory' ? 'Raw Material Inventory' : 'Raw Material Directory') : (activeTab === 'Store Inventory' ? 'Store Inventory' : 'Inventory Stores')}
          </button>
        </div>

        {/* Executive Material Identity Banner & KPI Summary Cards */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          {/* Material Identity Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ backgroundColor: '#0E7490', color: '#FFFFFF', padding: '4px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', letterSpacing: '0.5px' }}>
                  {selectedMat.code}
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  {selectedMat.name}
                </h2>
                <span style={{ backgroundColor: stBg, color: stFg, border: stBorder, padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                  <span style={{ width: '6px', height: '6px', minWidth: '6px', minHeight: '6px', borderRadius: '50%', backgroundColor: stFg, flexShrink: 0, display: 'inline-block' }}></span>
                  {selectedMat.status || 'In Stock'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12.5px', color: '#64748B', flexWrap: 'wrap' }}>
                <span>Category: <strong style={{ color: '#1E293B' }}>{selectedMat.cat || selectedMat.category || 'General'}</strong></span>
                <span>•</span>
                <span>UOM: <strong style={{ color: '#1E293B' }}>{selectedMat.unit || 'NOS'}</strong></span>
                <span>•</span>
                <span>Warehouse Location: <strong style={{ color: '#0E7490' }}>{selectedMat.store || 'Finished Goods Bay'}</strong></span>
                <span>•</span>
                <span>HSN Code: <strong style={{ color: '#1E293B' }}>{selectedMat.hsn || '76042990'}</strong></span>
              </div>
            </div>

            {/* View Mode Toggle Switcher (Table vs Timeline) */}
            <div style={{ display: 'inline-flex', padding: '3px', backgroundColor: '#F1F5F9', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
              <button
                type="button"
                onClick={() => setAuditViewMode('table')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: auditViewMode === 'table' ? '#FFFFFF' : 'transparent',
                  color: auditViewMode === 'table' ? '#0F172A' : '#64748B',
                  boxShadow: auditViewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <ClipboardList size={14} /> Audit Ledger Table
              </button>
              <button
                type="button"
                onClick={() => setAuditViewMode('timeline')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: auditViewMode === 'timeline' ? '#FFFFFF' : 'transparent',
                  color: auditViewMode === 'timeline' ? '#0F172A' : '#64748B',
                  boxShadow: auditViewMode === 'timeline' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Clock size={14} /> Activity Timeline
              </button>
            </div>
          </div>

          {/* 3 Executive Stock KPI Cards (Physical stock removed as requested) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            
            {/* KPI 1: Live Available Free Stock (Primary Source of Truth) */}
            <div style={{ backgroundColor: '#ECFEFF', border: '1.5px solid #0E7490', borderRadius: '12px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: '0 2px 6px rgba(14, 116, 144, 0.08)' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Live Available Free Stock
              </div>
              <div style={{ fontSize: '26px', fontWeight: '800', color: '#0E7490' }}>
                {(Number(availableVal) || 0).toLocaleString()} <span style={{ fontSize: '14px', fontWeight: '700', color: '#0E7490' }}>{selectedMat.unit || 'NOS'}</span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#155E75', fontWeight: '600' }}>
                Ready for immediate sales dispatch booking
              </div>
            </div>

            {/* KPI 2: Reserved for Orders */}
            <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FEF3C7', borderRadius: '12px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Allocated / In Dispatch
              </div>
              <div style={{ fontSize: '26px', fontWeight: '800', color: '#D97706' }}>
                {reservedVal > 0 ? `-${(Number(reservedVal) || 0).toLocaleString()}` : '0'} <span style={{ fontSize: '14px', fontWeight: '600', color: '#B45309' }}>{selectedMat.unit || 'NOS'}</span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#92400E' }}>
                Blocked for confirmed sales BOMs
              </div>
            </div>

            {/* KPI 3: Minimum Threshold & Safety Buffer */}
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Min. Reorder Threshold
              </div>
              <div style={{ fontSize: '26px', fontWeight: '800', color: '#334155' }}>
                {(Number(minLevelVal) || 0).toLocaleString()} <span style={{ fontSize: '14px', fontWeight: '600', color: '#64748B' }}>{selectedMat.unit || 'NOS'}</span>
              </div>
              <div style={{ fontSize: '11.5px', color: availableVal <= minLevelVal ? '#DC2626' : '#16A34A', fontWeight: '600' }}>
                {availableVal <= minLevelVal ? '⚠️ Below safety reorder level' : '✓ Stock is above minimum threshold'}
              </div>
            </div>

          </div>

          {/* Search & Filter Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingTop: '4px' }}>
            {/* Search input */}
            <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input id="raw-material-inventory-audit-search-query" name="auditSearchQuery" aria-label="Search by document #, user, reason"
                type="text"
                placeholder="Search by document #, user, reason..."
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  padding: '0 12px 0 34px',
                  fontSize: '12.5px',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
               />
              {auditSearchQuery && (
                <button
                  type="button"
                  onClick={() => setAuditSearchQuery('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: `All Events (${itemAuditLogs.length})` },
                { id: 'OUTFLOW', label: 'Dispatches & Deductions' },
                { id: 'INFLOW', label: 'Receipts & Additions' },
                { id: 'BOM', label: 'Sales BOMs' },
                { id: 'GRN', label: 'GRN Inwarding' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAuditTypeFilter(f.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: auditTypeFilter === f.id ? '1px solid #0E7490' : '1px solid #E2E8F0',
                    backgroundColor: auditTypeFilter === f.id ? '#ECFEFF' : '#FFFFFF',
                    color: auditTypeFilter === f.id ? '#0E7490' : '#64748B',
                    fontSize: '11.5px',
                    fontWeight: auditTypeFilter === f.id ? '800' : '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* AUDIT LOG DATA DISPLAY: TABLE MODE OR TIMELINE MODE */}
        {auditViewMode === 'table' ? (
          /* ======================== 1. DETAILED AUDIT LEDGER TABLE ======================== */
          <div style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}>
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', tableLayout: 'auto' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '12px 16px', fontWeight: '800', width: '150px' }}>Date & Time</th>
                    <th style={{ padding: '12px 16px', fontWeight: '800', width: '180px' }}>Event Category</th>
                    <th style={{ padding: '12px 16px', fontWeight: '800', width: '130px' }}>Ref Document</th>
                    <th style={{ padding: '12px 16px', fontWeight: '800' }}>Activity Description / Narrative</th>
                    <th style={{ padding: '12px 16px', fontWeight: '800', textAlign: 'right', width: '120px' }}>Impact Qty</th>
                    <th style={{ padding: '12px 16px', fontWeight: '800', textAlign: 'center', width: '150px' }}>Available Balance</th>
                    <th style={{ padding: '12px 16px', fontWeight: '800', width: '180px' }}>Sales Owner / Authorized By</th>
                    <th style={{ padding: '12px 16px', fontWeight: '800', width: '140px' }}>Warehouse Bay</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '48px 24px', textAlign: 'center', color: '#94A3B8' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <Info size={28} style={{ color: '#CBD5E1' }} />
                          <strong style={{ color: '#475569', fontSize: '14px' }}>No audit transactions found</strong>
                          <span style={{ fontSize: '12px' }}>Try clearing the search query or adjusting the category filter.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log, idx) => {
                      const isAddition = log.qty > 0;
                      const isZero = log.qty === 0;
                      const qtyColor = isAddition ? '#16A34A' : isZero ? '#64748B' : '#DC2626';
                      const qtyBg = isAddition ? '#F0FDF4' : isZero ? '#F8FAFC' : '#FEF2F2';
                      const qtyBorder = isAddition ? '#DCFCE7' : isZero ? '#E2E8F0' : '#FEE2E2';

                      return (
                        <tr
                          key={log.id || idx}
                          style={{
                            borderBottom: '1px solid #F1F5F9',
                            backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                            transition: 'background-color 0.15s ease'
                          }}
                          className="table-row-hover"
                        >
                          {/* Date & Time */}
                          <td style={{ padding: '14px 16px', fontWeight: '600', color: '#334155', whiteSpace: 'nowrap', fontSize: '12.5px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Calendar size={13} style={{ color: '#94A3B8' }} />
                              <span>{log.timestamp}</span>
                            </div>
                          </td>

                          {/* Event Category Badge */}
                          <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              backgroundColor: log.typeBg || '#F1F5F9',
                              color: log.typeColor || '#334155',
                              border: `1px solid ${log.typeBorder || '#E2E8F0'}`,
                              padding: '3px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '800',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              {log.typeName || log.type}
                            </span>
                          </td>

                          {/* Reference Document */}
                          <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              backgroundColor: '#F8FAFC',
                              border: '1px solid #CBD5E1',
                              color: '#0F172A',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '700',
                              fontFamily: 'monospace'
                            }}>
                              {log.referenceDoc}
                            </span>
                          </td>

                          {/* Activity Description */}
                          <td style={{ padding: '14px 16px', color: '#1E293B', lineHeight: '1.5', minWidth: '270px' }}>
                            <div style={{ fontWeight: '500' }}>{log.reason}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                              {log.source && (
                                <span style={{ fontSize: '11px', color: '#64748B' }}>
                                  Customer: <strong style={{ color: '#0F172A' }}>{log.source}</strong>
                                </span>
                              )}
                              {log.salesPerson && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  backgroundColor: '#ECFEFF',
                                  color: '#0E7490',
                                  border: '1px solid #CFFAFE',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <User size={12} style={{ color: '#0E7490' }} />
                                  <span>Sales Person:</span>
                                  <strong style={{ color: '#155E75' }}>{log.salesPersonFull || log.salesPerson}</strong>
                                </span>
                              )}
                              {log.sourcePiNo && (
                                <span style={{
                                  fontSize: '10.5px',
                                  fontWeight: '600',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: '#F1F5F9',
                                  color: '#475569',
                                  border: '1px solid #E2E8F0'
                                }}>
                                  Ref PI: {log.sourcePiNo}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Impact Quantity */}
                          <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <span style={{
                              backgroundColor: qtyBg,
                              color: qtyColor,
                              border: `1px solid ${qtyBorder}`,
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '12.5px',
                              fontWeight: '800',
                              fontFamily: 'monospace',
                              display: 'inline-block'
                            }}>
                              {isAddition ? `+${(Number(log.qty) || 0).toLocaleString()}` : (Number(log.qty) || 0).toLocaleString()} {log.unit}
                            </span>
                          </td>

                          {/* Stock Balance Movement */}
                          <td style={{ padding: '14px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{
                              backgroundColor: '#F1F5F9',
                              color: '#0F172A',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: '700'
                            }}>
                              {log.previousStock !== undefined ? (Number(log.previousStock) || 0).toLocaleString() : '—'} → <strong style={{ color: '#0E7490' }}>{log.newStock !== undefined ? (Number(log.newStock) || 0).toLocaleString() : (Number(availableVal) || 0).toLocaleString()}</strong>
                            </span>
                          </td>

                          {/* Sales Owner / Authorized By */}
                          <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                            {log.salesPerson ? (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  <User size={13} style={{ color: '#0E7490' }} />
                                  <span style={{ fontWeight: '800', color: '#0F172A', fontSize: '12.5px' }}>
                                    {log.salesPerson}
                                  </span>
                                </div>
                                <div style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700', marginTop: '2px' }}>
                                  {log.salesPersonCode ? `Sales Rep (${log.salesPersonCode})` : (log.role || 'Sales Department')}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '12.5px' }}>
                                  {log.user || 'Production Head'}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748B' }}>
                                  {log.role || 'Production & Logistics'}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Warehouse Location */}
                          <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', color: '#64748B', fontSize: '12px' }}>
                            <span style={{ backgroundColor: '#F8FAFC', padding: '3px 8px', borderRadius: '4px', border: '1px solid #E2E8F0', fontWeight: '600' }}>
                              {log.location || selectedMat.store || 'Finished Goods Bay'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer Summary */}
            <div style={{
              padding: '12px 20px',
              backgroundColor: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12.5px',
              color: '#64748B'
            }}>
              <span>Showing <strong>{filteredLogs.length}</strong> of <strong>{itemAuditLogs.length}</strong> verified events</span>
              <span style={{ color: '#0E7490', fontWeight: '700' }}>Authoritative Businz Material Traceability Trail</span>
            </div>
          </div>
        ) : (
          /* ======================== 2. VISUAL ACTIVITY TIMELINE ======================== */
          <div style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            padding: '28px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0F172A' }}>
                  Sequential Traceability Trail ({filteredLogs.length} Events)
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '3px 0 0 0' }}>
                  Chronological lifecycle progression from initial stock setup, supplier inwarding, to sales dispatch allocations.
                </p>
              </div>
              <span style={{ fontSize: '12px', fontWeight: '700', backgroundColor: '#ECFEFF', color: '#0E7490', padding: '4px 12px', borderRadius: '20px', border: '1px solid #CFFAFE' }}>
                {filteredLogs.length} Logged Events
              </span>
            </div>

            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '26px', paddingLeft: '12px' }}>
              
              {/* Perfectly Centered Vertical Connector Line */}
              <div style={{
                position: 'absolute',
                top: '20px',
                bottom: '20px',
                left: '29px',
                width: '2px',
                backgroundColor: '#E2E8F0',
                zIndex: 1
              }}></div>

              {filteredLogs.map((log, idx) => {
                const isAddition = log.qty > 0;
                const isZero = log.qty === 0;
                const accentColor = log.typeColor || (isAddition ? '#16A34A' : '#DC2626');
                const avatarBg = log.typeBg || (isAddition ? '#F0FDF4' : '#FEF2F2');
                const avatarBorder = log.typeBorder || (isAddition ? '#DCFCE7' : '#FEE2E2');

                return (
                  <div key={log.id || idx} style={{ position: 'relative', zIndex: 2, display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                    
                    {/* Left Center Avatar */}
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: avatarBg,
                      border: `2px solid ${accentColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
                    }}>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: accentColor }}>
                        {isAddition ? '+' : (isZero ? '•' : '−')}
                      </span>
                    </div>

                    {/* Right Timeline Card */}
                    <div style={{
                      flex: 1,
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '18px 22px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                      borderLeft: `4px solid ${accentColor}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      {/* Top Header of Card */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{
                            backgroundColor: log.typeBg || '#F1F5F9',
                            color: log.typeColor || '#334155',
                            border: `1px solid ${log.typeBorder || '#E2E8F0'}`,
                            padding: '3px 9px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '800'
                          }}>
                            {log.typeName || log.type}
                          </span>
                          <span style={{
                            backgroundColor: '#F8FAFC',
                            border: '1px solid #CBD5E1',
                            color: '#0F172A',
                            padding: '2px 8px',
                            borderRadius: '5px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            fontFamily: 'monospace'
                          }}>
                            {log.referenceDoc}
                          </span>
                          {log.salesPerson ? (
                            <span style={{
                              fontSize: '11.5px',
                              backgroundColor: '#ECFEFF',
                              border: '1px solid #A5F3FC',
                              color: '#0E7490',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontWeight: '700',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}>
                              <span>
                                <User size={12} style={{ color: '#0E7490', display: 'inline', verticalAlign: '-1px', marginRight: '3px' }} />
                                Sales Person:
                              </span>
                              <strong style={{ color: '#155E75' }}>{log.salesPersonFull || log.salesPerson}</strong>
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#64748B' }}>
                              Authorized by: <strong style={{ color: '#0F172A' }}>{log.user}</strong> ({log.role})
                            </span>
                          )}
                        </div>

                        {/* Timestamp */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#94A3B8', fontWeight: '600' }}>
                          <Calendar size={13} />
                          <span>{log.timestamp}</span>
                        </div>
                      </div>

                      {/* Narrative Reason */}
                      <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.6', fontWeight: '500' }}>
                        {log.reason}
                      </div>

                      {/* Movement Metric Banner */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        padding: '10px 16px',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12.5px' }}>
                          <div>
                            <span style={{ color: '#64748B' }}>Baseline Before: </span>
                            <strong>{log.previousStock !== undefined ? (Number(log.previousStock) || 0).toLocaleString() : '—'} {log.unit}</strong>
                          </div>
                          <span>→</span>
                          <div>
                            <span style={{ color: '#64748B' }}>New Balance: </span>
                            <strong style={{ color: '#0E7490' }}>{log.newStock !== undefined ? (Number(log.newStock) || 0).toLocaleString() : (Number(availableVal) || 0).toLocaleString()} {log.unit}</strong>
                          </div>
                        </div>

                        <div style={{
                          backgroundColor: isAddition ? '#F0FDF4' : '#FEF2F2',
                          color: isAddition ? '#166534' : '#991B1B',
                          border: isAddition ? '1px solid #DCFCE7' : '1px solid #FEE2E2',
                          padding: '4px 12px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: '800',
                          fontFamily: 'monospace'
                        }}>
                          {isAddition ? `+${(Number(log.qty) || 0).toLocaleString()}` : (Number(log.qty) || 0).toLocaleString()} {log.unit}
                        </div>
                      </div>

                      {/* Footer entity info */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#64748B', paddingTop: '4px', flexWrap: 'wrap', gap: '8px' }}>
                        <span>Customer / Order: <strong style={{ color: '#0F172A' }}>{log.source || 'Warehouse Inventory Store'}</strong></span>
                        {log.salesPerson && (
                          <span style={{ backgroundColor: '#ECFEFF', padding: '2px 8px', borderRadius: '4px', border: '1px solid #CFFAFE', color: '#0E7490', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <User size={12} style={{ color: '#0E7490' }} /> Sales Person: <strong>{log.salesPersonFull || log.salesPerson}</strong>
                          </span>
                        )}
                        <span>Bay: <strong style={{ color: '#0E7490' }}>{log.location || selectedMat.store || 'Finished Goods Bay'}</strong></span>
                      </div>
                    </div>

                  </div>
                );
              })}

            </div>
          </div>
        )}

      </div>
    );
}
