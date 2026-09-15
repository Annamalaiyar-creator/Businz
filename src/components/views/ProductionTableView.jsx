import React from 'react';
import {
  Plus, Search, Calendar, RotateCcw, XCircle, Trash2, Eye,
  CreditCard, Printer, X, Edit3, Package
} from 'lucide-react';
import StatusBadge from '../StatusBadge';

export default function ProductionTableView({
  pageConfig,
  activeTab,
  userRole,
  filteredRows,
  selectedRows,
  setSelectedRows,
  handleSelectAllGeneric,
  handleSelectRowGeneric,
  prodSearchQueryText,
  setProdSearchQueryText,
  prodFilterDateVal,
  setProdFilterDateVal,
  prodFilterStatusSelect,
  setProdFilterStatusSelect,
  prodActiveSubTab,
  setProdActiveSubTab,
  rowsPerPage,
  setRowsPerPage,
  currentPage,
  setCurrentPage,
  bomStore,
  canCancelBom,
  handleCancelBomOrder,
  onHeaderAction,
  onRowClick,
  onEditRecord,
  onQuickPreview,
  onUploadPayment,
  showAlert
}) {
  const isSuperUser = userRole === 'CEO' || userRole === 'MD' || userRole === 'Managing Director';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, width: '100%', fontFamily: "'DM Sans', sans-serif" }}>

      {/* 1. TOP HEADER SECTION WITH BLUE PRIMARY BUTTON */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            {pageConfig.title}
          </h2>
          <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
            {pageConfig.subtitle}
          </span>
        </div>
        {pageConfig.actionText && !isSuperUser ? (
          <button
            onClick={onHeaderAction}
            style={{
              backgroundColor: '#0E7490',
              border: 'none',
              color: '#FFFFFF',
              height: '40px',
              padding: '0 6px 0 20px',
              borderRadius: '50px',
              fontSize: '13px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(14, 116, 144, 0.35)',
              transition: 'all 0.2s ease',
              letterSpacing: '0.2px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#085D75'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0E7490'}
          >
            <span>{pageConfig.actionText.replace(/^\+\s*/, '')}</span>
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
              <Plus size={16} strokeWidth={2.5} />
            </div>
          </button>
        ) : null}
      </div>

      {/* 2. FILTERS & SEARCH ROW CARD */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '12px 16px', backgroundColor: '#fafbfc', borderRadius: '12px', border: '1px solid #e2e8f0', alignItems: 'center', width: '100%', boxSizing: 'border-box', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: '#f8fafc', width: '340px' }}>
          <Search style={{ width: '15px', height: '15px', color: '#64748b' }} />
          <input
            type="text"
            placeholder={pageConfig.searchPlaceholder}
            value={prodSearchQueryText}
            onChange={(e) => setProdSearchQueryText(e.target.value)}
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: '13px', width: '100%', color: '#334155' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'nowrap', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: 'white' }}>
            <Calendar style={{ width: '14px', height: '14px', color: '#64748b' }} />
            <input
              type="date"
              value={prodFilterDateVal}
              onChange={(e) => setProdFilterDateVal(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: '13px', color: '#334155', backgroundColor: 'transparent' }}
            />
          </div>

          <select
            value={prodFilterStatusSelect}
            onChange={(e) => setProdFilterStatusSelect(e.target.value)}
            style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white', color: '#334155', outline: 'none' }}
          >
            <option value="All">Status: All</option>
            <option value="OPEN">OPEN</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>

          <button
            onClick={() => { setProdSearchQueryText(''); setProdFilterDateVal(''); setProdFilterStatusSelect('All'); }}
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

      {/* 3. STATUS SUB-TABS ROW */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '20px', padding: '4px 0', alignItems: 'center', flexWrap: 'wrap' }}>
        {pageConfig.tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setProdActiveSubTab(tab.id)}
            style={{
              border: 'none',
              background: 'transparent',
              padding: '10px 4px',
              fontSize: '13px',
              fontWeight: 'bold',
              color: prodActiveSubTab === tab.id ? '#2563eb' : '#64748b',
              borderBottom: prodActiveSubTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {tab.label}
            <span style={{
              fontSize: '10px',
              padding: '2px 7px',
              borderRadius: '12px',
              backgroundColor: tab.bg,
              color: tab.fg,
              fontWeight: 'bold'
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 4. MAIN DATA TABLE (EXACT MATCH FOR PI & PO DESIGN) */}
      <div className="section-card" style={{ padding: '0', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table className="custom-table" style={{ width: '100%', minWidth: '1200px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', padding: '12px 0', textAlign: 'center', verticalAlign: 'middle', boxSizing: 'border-box' }}>
                  <input
                    type="checkbox"
                    style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                    checked={filteredRows.length > 0 && selectedRows.length === filteredRows.length}
                    onChange={(e) => handleSelectAllGeneric(e, filteredRows, 'code')}
                  />
                </th>
                {pageConfig.headers.map((h, i) => {
                  const isRight = h.includes('Amount') || h.includes('Cost') || h.includes('Value') || h.includes('Price') || h.includes('Spend');
                  let colWidth = 'auto';
                  let minColWidth = '140px';
                  if (i === 0) { colWidth = '150px'; minColWidth = '150px'; }
                  else if (i === 1) { minColWidth = '220px'; }
                  else if (h === 'Status' || h === 'Fulfillment Status' || h === 'Dispatch Packing Status') { colWidth = '180px'; minColWidth = '180px'; }
                  else if (isRight) { colWidth = '150px'; minColWidth = '150px'; }
                  else if (h.includes('Date')) { colWidth = '130px'; minColWidth = '130px'; }
                  else if (h.includes('Payment')) { colWidth = '150px'; minColWidth = '150px'; }

                  return (
                    <th
                      key={h}
                      style={{
                        padding: '12px 14px',
                        textAlign: isRight ? 'right' : 'left',
                        width: colWidth,
                        minWidth: minColWidth,
                        boxSizing: 'border-box',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {h}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
                const indexOfLastRow = currentPage * rowsPerPage;
                const indexOfFirstRow = indexOfLastRow - rowsPerPage;
                const currentRows = filteredRows.slice(indexOfFirstRow, indexOfLastRow);

                if (currentRows.length === 0) {
                  return (
                    <tr>
                      <td colSpan={pageConfig.headers.length + 1} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                        No records found matching your filters.
                      </td>
                    </tr>
                  );
                }

                return currentRows.map((row, idx) => {
                  const isChecked = selectedRows.includes(row.code);
                  return (
                    <tr key={row.code || idx} style={{
                      borderBottom: '1px solid #F1F5F9',
                      transition: 'all 0.15s ease',
                      backgroundColor: isChecked ? '#ECFEFF' : 'transparent'
                    }} className={`table-row-hover ${isChecked ? 'selected-row' : ''}`}>
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
                          style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                          checked={isChecked}
                          onChange={() => handleSelectRowGeneric(row.code)}
                        />
                      </td>
                      <td
                        onClick={() => onRowClick(row)}
                        style={{ padding: '12px 14px', fontWeight: 'bold', color: '#2563EB', cursor: 'pointer' }}
                      >
                        {row.code}
                      </td>
                      <td
                        onClick={() => onRowClick(row)}
                        style={{ padding: '12px 14px', fontWeight: '600', color: '#1E293B', cursor: 'pointer' }}
                      >
                        {row.c2 || row.name}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#64748B' }}>{row.c3 || row.date1}</td>
                      <td style={{ padding: '12px 14px', color: '#64748B' }}>{row.c4 || row.date2}</td>
                      {row.c5 !== undefined && <td style={{ padding: '12px 14px', fontWeight: 'bold', color: '#0F172A', textAlign: row.c5?.toString()?.includes('₹') ? 'right' : 'left' }}>{row.c5 || row.value}</td>}
                      {row.c6 !== undefined && activeTab !== 'Customer Management' && (
                        <td style={{ padding: '12px 14px', color: '#475569' }}>
                          {activeTab === 'Invoice Management' ? (
                            <span style={{
                              backgroundColor: (row.c6 === 'Ready' || row.c6 === 'Ready for Payment' || row.c6 === 'Paid') ? '#DCFCE7' : '#FEF3C7',
                              color: (row.c6 === 'Ready' || row.c6 === 'Ready for Payment' || row.c6 === 'Paid') ? '#166534' : '#B45309',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              {row.c6}
                            </span>
                          ) : (
                            row.c6
                          )}
                        </td>
                      )}
                      {(pageConfig.headers.includes('Status') || pageConfig.headers.includes('Dispatch Packing Status') || pageConfig.headers.includes('Fulfillment Status')) && (
                        <td style={{ padding: '12px 14px', textAlign: 'left' }}>
                          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                            <StatusBadge status={row.status} size="sm" />
                            {row.packingProgressText && (
                              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', paddingLeft: '2px', whiteSpace: 'nowrap' }}>
                                {row.packingProgressText}
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>

        {/* 4. PAGINATION FOOTER STRICTLY COMPLIANT WITH RULE 6 */}
        {filteredRows.length > 0 && (() => {
          const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
          const indexOfLastRow = currentPage * rowsPerPage;
          const indexOfFirstRow = indexOfLastRow - rowsPerPage;

          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', fontSize: '13px', color: '#64748B', borderTop: '1px solid #F1F5F9', backgroundColor: '#FFFFFF' }}>
              {/* Left Side: Rows per page selector strictly restricted to [5, 10] + Showing X to Y of Z entries */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Showing per page</span>
                  <select
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
                  <input
                    type="number"
                    min="1"
                    max={totalPages || 1}
                    defaultValue={currentPage}
                    id="bom-goto-page-input"
                    style={{ width: '42px', height: '32px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <button
                    onClick={() => {
                      const val = parseInt(document.getElementById('bom-goto-page-input')?.value || '1', 10);
                      if (val >= 1 && val <= totalPages) setCurrentPage(val);
                    }}
                    style={{ height: '32px', padding: '0 10px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: '#FFFFFF', color: '#0E7490', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Go &rsaquo;
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 5. FLOATING BOTTOM ACTION BAR (RULE 6: FIXED BOTTOM CENTER, SINGLE LINE, VISIBLE BUTTONS) */}
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
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px', paddingRight: '6px' }}>
            <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selectedRows.length}</strong> Selected
          </span>

          {!isSuperUser && (() => {
            const firstCode = selectedRows[0];
            const targetRow = (filteredRows || []).find(r => r.code === firstCode || r.id === firstCode || r.bomCode === firstCode) || { code: firstCode };
            const isCancelledRow = Boolean(
              targetRow && (
                targetRow.cancelled ||
                targetRow.status === 'CANCELLED' ||
                targetRow.status === 'Cancelled' ||
                targetRow.status === 'Cancelled & Stock Restored' ||
                (typeof targetRow.status === 'string' && targetRow.status.toLowerCase().includes('cancel'))
              )
            );

            return (
              <button
                onClick={() => {
                  if (selectedRows.length > 1) {
                    if (showAlert) showAlert('You cannot edit multiple items at once.');
                  } else if (selectedRows.length === 1) {
                    onEditRecord(targetRow, isCancelledRow);
                  }
                }}
                style={{
                  backgroundColor: isCancelledRow ? '#FEF2F2' : '#FFFFFF',
                  border: isCancelledRow ? '1px solid #FECACA' : '1px solid #E2E8F0',
                  color: isCancelledRow ? '#DC2626' : '#1E293B',
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
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isCancelledRow ? '#FEE2E2' : '#F8FAFC'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isCancelledRow ? '#FEF2F2' : '#FFFFFF'}
              >
                {isCancelledRow ? (
                  <>
                    <Eye size={14} style={{ color: '#DC2626' }} /> View Info (Cancelled)
                  </>
                ) : activeTab === 'Dispatch Orders' ? (
                  <>
                    <Package size={14} style={{ color: '#0E7490' }} /> Pack BOM
                  </>
                ) : activeTab === 'Invoice Management' ? (
                  <>
                    <FileText size={14} style={{ color: '#0E7490' }} /> View / Confirm Invoice
                  </>
                ) : (
                  <>
                    <Edit3 size={14} style={{ color: '#64748B' }} /> Edit Info
                  </>
                )}
              </button>
            );
          })()}

          {/* Cancel BOM Order Button */}
          {canCancelBom && (() => {
            const hasCancellable = (selectedRows || []).some(codeVal => {
              const r = (filteredRows || []).find(it => it.code === codeVal || it.id === codeVal || it.bomCode === codeVal) || (bomStore || []).find(b => (b.bomCode || b.code || b.id) === codeVal);
              return r && !r.cancelled && r.status !== 'CANCELLED' && r.status !== 'Cancelled' && r.status !== 'Cancelled & Stock Restored' && !(typeof r.status === 'string' && r.status.toLowerCase().includes('cancel'));
            });
            if (!hasCancellable) return null;

            return (
              <button
                onClick={() => {
                  const targetCode = selectedRows[0];
                  const targetBom = (filteredRows || []).find(r => r.code === targetCode || r.id === targetCode || r.bomCode === targetCode) || (bomStore || []).find(b => (b.bomCode || b.code || b.id) === targetCode);
                  if (targetBom) handleCancelBomOrder(targetBom);
                }}
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#DC2626',
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
                  boxShadow: '0 1px 2px rgba(220,38,38,0.08)'
                }}
                title="Cancel BOM and restore blocked stock back into inventory"
              >
                <XCircle size={14} style={{ color: '#DC2626' }} /> Cancel BOM
              </button>
            );
          })()}

          {/* Delete Button */}
          {!isSuperUser && activeTab !== 'Dispatch Orders' && (
            <button
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete ${selectedRows.length} selected item(s)?`)) {
                  setSelectedRows([]);
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
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEF2F2'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
            >
              <Trash2 size={14} style={{ color: '#DC2626' }} /> Delete
            </button>
          )}

          {/* View Details Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (selectedRows && selectedRows.length > 1) {
                if (showAlert) showAlert("You can't open details for multiple files at once. Please select a single item to view details.");
                return;
              }
              const codeVal = (selectedRows && selectedRows.length > 0) ? selectedRows[0] : null;
              const targetRow = codeVal
                ? ((filteredRows || []).find(r => r.code === codeVal || r.id === codeVal || r.bomCode === codeVal) || { code: codeVal, name: `Record #${codeVal}` })
                : (filteredRows && filteredRows[0] ? filteredRows[0] : { code: 'CR-001', name: 'Sample Record' });
              onQuickPreview(targetRow);
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

          {/* View Payment Details Button */}
          {activeTab !== 'Dispatch Orders' && activeTab !== 'Accounts Verification' && activeTab !== 'Invoice Management' && (
            <button
              onClick={() => {
                const codeVal = (selectedRows && selectedRows.length > 0) ? selectedRows[0] : null;
                const targetRow = codeVal
                  ? ((filteredRows || []).find(r => r.code === codeVal || r.id === codeVal || r.bomCode === codeVal) || (bomStore || []).find(b => b.bomCode === codeVal))
                  : ((bomStore || [])[0] || (filteredRows || [])[0]);

                if (targetRow) {
                  onUploadPayment(targetRow);
                } else {
                  if (showAlert) showAlert('Please select a BOM order to view payment details.');
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
            <CreditCard size={14} style={{ color: '#2563EB' }} /> Payment Details
          </button>
        )}

          {/* Export and Print */}
          <button
            onClick={() => {
              window.print();
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
            <Printer size={14} style={{ color: '#059669' }} /> Export &amp; Print
          </button>

          {/* Deselect All */}
          <button
            onClick={() => setSelectedRows([])}
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
