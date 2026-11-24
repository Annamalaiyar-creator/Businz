import React from 'react';
import { Calendar, Check, Edit, Edit3, Eye, Filter, Package, Printer, Receipt, Search, Target, Trash2, X } from 'lucide-react';
import StatusBadge from '../StatusBadge';
import { saveCloudStoreImmediate } from '../../utils/supabaseDataSync';

export default function GrnTableSection(props) {
  const {
    grnList = [],
    setGrnList,
    searchQuery,
    setSearchQuery,
    getEffectiveGrnStatus,
    grnListStatusFilter,
    setGrnListStatusFilter,
    grnListActiveTab,
    setGrnListActiveTab,
    filterDate,
    setFilterDate,
    filterEndDate,
    setFilterEndDate,
    selectedGrnRows = [],
    setSelectedGrnRows,
    grnPage,
    setGrnPage,
    grnRowsPerPage,
    setGrnRowsPerPage,
    grnTab,
    setGrnTab,
    statusFilter,
    setStatusFilter,
    handleOpenViewGrn,
    handleOpenEditGrn,
    handleDeleteGRN,
    handleOpenPoModal,
    showCeoGrnModal,
    isMobile,
    isCeoLogin,
    isAccountsUser
  } = props;

  return (
    <>
                    {(() => {
                const filteredGrns = grnList.filter(g => {
                  if (!g) return false;
                  const gId = String(g.id || '').toLowerCase();
                  const pRef = String(g.poRef || '').toLowerCase();
                  const vend = String(g.vendor || '').toLowerCase();
                  const q = searchQuery.toLowerCase().trim();
                  const matchesSearch = !q || gId.includes(q) || pRef.includes(q) || vend.includes(q);

                  const st = getEffectiveGrnStatus(g);
                  const stUpper = st.toUpperCase();

                  const matchesStatus = grnListStatusFilter === 'All' ||
                    (grnListStatusFilter === 'CLOSED / FULLY RECEIVED' && st === 'CLOSED / FULLY RECEIVED') ||
                    (grnListStatusFilter === 'OPEN / PARTIALLY RECEIVED' && st === 'OPEN / PARTIALLY RECEIVED') ||
                    (grnListStatusFilter === 'Approved' && st.toLowerCase() === 'approved') ||
                    (grnListStatusFilter === 'Draft' && st.toLowerCase().includes('draft')) ||
                    st === grnListStatusFilter;

                  const matchesTab = grnListActiveTab === 'All' ||
                    (grnListActiveTab === 'CLOSED' && st === 'CLOSED / FULLY RECEIVED') ||
                    (grnListActiveTab === 'PARTIALLY_RECEIVED' && st === 'OPEN / PARTIALLY RECEIVED') ||
                    (grnListActiveTab === 'Approved' && st.toLowerCase() === 'approved') ||
                    (grnListActiveTab === 'Draft' && st.toLowerCase().includes('draft')) ||
                    st === grnListActiveTab;

                  let matchesDate = true;
                  if (filterDate || filterEndDate) {
                    if (g.date) {
                      const dStr = String(g.date).substring(0, 10);
                      if (filterDate && dStr < filterDate) matchesDate = false;
                      if (filterEndDate && dStr > filterEndDate) matchesDate = false;
                    } else {
                      matchesDate = false;
                    }
                  }

                  return matchesSearch && matchesStatus && matchesTab && matchesDate;
                });

                const sortedGrns = [...filteredGrns].sort((a, b) => {
                  const numA = parseInt(String(a.id || '').replace(/\D/g, ''), 10) || 0;
                  const numB = parseInt(String(b.id || '').replace(/\D/g, ''), 10) || 0;
                  return numB - numA;
                });

                const totalPages = Math.ceil(sortedGrns.length / grnRowsPerPage) || 1;
                const safeCurrentPage = Math.min(grnPage, totalPages);
                const indexOfLastRow = safeCurrentPage * grnRowsPerPage;
                const indexOfFirstRow = (safeCurrentPage - 1) * grnRowsPerPage;
                const currentRows = sortedGrns.slice(indexOfFirstRow, indexOfLastRow);

                let startPage = Math.max(1, safeCurrentPage - 1);
                let endPage = startPage + 2;
                if (endPage > totalPages) {
                  endPage = totalPages;
                  startPage = Math.max(1, endPage - 2);
                }
                const pageNumbers = [];
                for (let i = startPage; i <= endPage; i++) {
                  pageNumbers.push(i);
                }

                return (
                  <div className="section-card" style={{ padding: 0, overflowX: 'auto', display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
                    {/* Header Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <strong style={{ fontSize: '15px', color: '#0F172A', fontWeight: '700' }}>Goods Receipt Notes</strong>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', backgroundColor: '#ECFEFF', color: '#0E7490', padding: '2px 8px', borderRadius: '10px' }}>
                          {sortedGrns.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setFilterDate('');
                          setFilterEndDate('');
                          setStatusFilter('All');
                          setGrnTab('All');
                          setGrnPage(1);
                        }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#FFFFFF',
                          color: '#475569',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                      >
                        View All
                      </button>
                    </div>

                    {/* Mobile Cards View or Desktop Table Wrapper */}
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
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const allPageIds = currentRows.map(g => g.id);
                                  setSelectedGrnRows(prev => Array.from(new Set([...prev, ...allPageIds])));
                                } else {
                                  const pageIdsSet = new Set(currentRows.map(g => g.id));
                                  setSelectedGrnRows(prev => prev.filter(id => !pageIdsSet.has(id)));
                                }
                              }}
                              checked={currentRows.length > 0 && currentRows.every(g => selectedGrnRows.includes(g.id))}
                              style={{ accentColor: '#0E7490', cursor: 'pointer', width: '16px', height: '16px', margin: 0 }}
                            />
                            <span>Select All ({currentRows.length})</span>
                          </label>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>
                            {selectedGrnRows.length > 0 ? `${selectedGrnRows.length} selected` : `Showing ${sortedGrns.length === 0 ? 0 : indexOfFirstRow + 1}-${Math.min(indexOfLastRow, sortedGrns.length)}`}
                          </span>
                        </div>

                        {sortedGrns.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '36px 20px', color: '#94A3B8' }}>
                            <Package size={38} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                            <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#475569' }}>No Goods Receipt Notes found</p>
                            <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Try adjusting your search or filters.</p>
                          </div>
                        ) : (
                          currentRows.map((row, idx) => {
                            const isChecked = selectedGrnRows.includes(row.id);
                            return (
                              <div
                                key={row.id || idx}
                                onClick={() => handleOpenViewGrn(row)}
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
                                {/* Top row: Checkbox + GRN ID + Status Badge */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={() => {
                                        setSelectedGrnRows(prev =>
                                          prev.includes(row.id) ? prev.filter(id => id !== row.id) : [...prev, row.id]
                                        );
                                      }}
                                      style={{ accentColor: '#0E7490', cursor: 'pointer', width: '16px', height: '16px', margin: 0 }}
                                    />
                                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#2563EB', letterSpacing: '0.2px' }}>
                                      {row.id}
                                    </span>
                                  </div>
                                  <StatusBadge status={getEffectiveGrnStatus(row)} size="sm" />
                                </div>

                                {/* Middle row: Vendor Name & PO Ref */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A', lineHeight: '1.3' }}>
                                    {row.vendor || '—'}
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748B', flexWrap: 'wrap' }}>
                                    <span>PO: <strong
                                      onClick={(e) => { e.stopPropagation(); handleOpenPoModal(row.poRef); }}
                                      title="Click to view Purchase Order popup"
                                      style={{ color: '#0E7490', cursor: 'pointer', textDecoration: 'underline' }}
                                    >{row.poRef || '—'}</strong></span>
                                    <span>•</span>
                                    <span>Created By: <strong style={{ color: '#7E22CE' }}>{row.createdBy || row.receivedBy || '—'}</strong></span>
                                    <span>•</span>
                                    <span>Received By: <strong style={{ color: '#0369A1' }}>{row.receivedBy || '—'}</strong></span>
                                  </div>
                                </div>

                                {/* Bottom row: Date & Total Value */}
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: '12px',
                                  paddingTop: '8px',
                                  borderTop: '1px dashed #E2E8F0'
                                }}>
                                  <span style={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Calendar size={13} style={{ color: '#94A3B8' }} />
                                    {row.date || '—'}
                                  </span>
                                  <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A' }}>
                                    {row.val || '—'}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    ) : (
                      /* Table Responsive Wrapper */
                      <div className="table-responsive" style={{ border: 'none', borderRadius: '0', margin: 0, overflowX: 'auto', width: '100%', boxSizing: 'border-box' }}>
                        <table className="custom-table" style={{ fontSize: '13px', width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#475569', height: '48px' }}>
                              <th style={{ width: '48px', minWidth: '48px', textAlign: 'center', padding: '12px 0' }}>
                                <input id="goods-receipt-note-select-all" name="selectAll" aria-label="SelectAll"
                                  type="checkbox"
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      const allPageIds = currentRows.map(g => g.id);
                                      setSelectedGrnRows(prev => Array.from(new Set([...prev, ...allPageIds])));
                                    } else {
                                      const pageIdsSet = new Set(currentRows.map(g => g.id));
                                      setSelectedGrnRows(prev => prev.filter(id => !pageIdsSet.has(id)));
                                    }
                                  }}
                                  checked={currentRows.length > 0 && currentRows.every(g => selectedGrnRows.includes(g.id))}
                                  style={{ cursor: 'pointer', borderRadius: '4px', accentColor: '#0E7490' }}
                                 />
                              </th>
                              <th style={{ width: '13%', minWidth: '120px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>GRN No.</th>
                              <th style={{ width: '18%', minWidth: '160px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>Vendor Name</th>
                              <th style={{ width: '13%', minWidth: '120px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>Created By</th>
                              <th style={{ width: '12%', minWidth: '115px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>Received By</th>
                              <th style={{ width: '11%', minWidth: '105px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>GRN Date</th>
                              <th style={{ width: '11%', minWidth: '105px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'right', boxSizing: 'border-box' }}>Total Value</th>
                              <th style={{ width: '10%', minWidth: '105px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'center', boxSizing: 'border-box' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedGrns.length === 0 ? (
                              <tr>
                                <td colSpan="8" style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                                  No Goods Receipt Notes found matching the criteria.{!isAccountsUser ? ' Click "Create GRN" to record a receipt.' : ''}
                                </td>
                              </tr>
                            ) : (
                              currentRows.map((row, idx) => {
                                const isChecked = selectedGrnRows.includes(row.id);
                                return (
                                  <tr
                                    key={row.id || idx}
                                    style={{
                                      borderBottom: idx === currentRows.length - 1 ? 'none' : '1px solid #f1f5f9',
                                      transition: 'all 0.15s ease',
                                      backgroundColor: isChecked ? '#ECFEFF' : 'transparent',
                                      borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent'
                                    }}
                                    className={`table-row-hover ${isChecked ? 'selected-row' : ''}`}
                                  >
                                    <td style={{ textAlign: 'center', width: '48px' }}>
                                      <input id="goods-receipt-note-checkbox" name={`checkbox_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Checkbox"
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          setSelectedGrnRows(prev =>
                                            prev.includes(row.id) ? prev.filter(id => id !== row.id) : [...prev, row.id]
                                          );
                                        }}
                                        style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                                       />
                                    </td>
                                    <td style={{ fontWeight: '600', color: '#2563eb', textAlign: 'left', padding: '12px 14px' }}>
                                      <a
                                        href="#"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          handleOpenViewGrn(row);
                                        }}
                                        style={{ fontWeight: '600', color: '#2563eb', textDecoration: 'none' }}
                                      >
                                        {row.id}
                                      </a>
                                    </td>
                                    <td style={{ padding: '12px 14px', fontWeight: '500', color: '#1e293b', textAlign: 'left' }}>
                                      {row.vendor}
                                    </td>
                                    <td style={{ padding: '12px 14px', textAlign: 'left' }}>
                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{
                                          width: '22px',
                                          height: '22px',
                                          borderRadius: '50%',
                                          backgroundColor: '#F3E8FF',
                                          color: '#7E22CE',
                                          fontSize: '10px',
                                          fontWeight: '700',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          flexShrink: 0
                                        }}>
                                          {String(row.createdBy || row.receivedBy || 'U').trim().charAt(0).toUpperCase()}
                                        </span>
                                        <span style={{ fontSize: '12.5px', color: '#1E293B', fontWeight: '600' }}>
                                          {row.createdBy || row.receivedBy || '—'}
                                        </span>
                                      </div>
                                    </td>
                                    <td style={{ padding: '12px 14px', textAlign: 'left' }}>
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
                                          {String(row.receivedBy || 'U').trim().charAt(0).toUpperCase()}
                                        </span>
                                        <span style={{ fontSize: '12.5px', color: '#1E293B', fontWeight: '600' }}>
                                          {row.receivedBy || '—'}
                                        </span>
                                      </div>
                                    </td>
                                    <td style={{ padding: '12px 14px', color: '#64748b', textAlign: 'left' }}>
                                      {row.date}
                                    </td>
                                    <td style={{ padding: '12px 14px', fontWeight: '600', color: '#1e293b', textAlign: 'right' }}>
                                      {row.val || '—'}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                                      <StatusBadge status={getEffectiveGrnStatus(row)} size="sm" />
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Standard Pagination Footer Layout (Rule 6 compliant) */}
                    {sortedGrns.length > 0 && (
                      <div style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        justifyContent: isMobile ? 'center' : 'space-between',
                        alignItems: isMobile ? 'stretch' : 'center',
                        gap: isMobile ? '12px' : '16px',
                        padding: isMobile ? '12px 14px' : '14px 20px',
                        fontSize: '13px',
                        color: '#64748B',
                        borderTop: '1px solid #F1F5F9',
                        backgroundColor: '#FFFFFF'
                      }}>
                        {/* Left Side: Rows per page selector + Showing X to Y entries */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: isMobile ? 'space-between' : 'flex-start',
                          gap: isMobile ? '8px' : '16px',
                          flexWrap: 'wrap'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>Showing per page</span>
                            <select id="goods-receipt-note-grn-rows-per-page" name="grnRowsPerPage" aria-label="GrnRowsPerPage"
                              value={grnRowsPerPage}
                              onChange={(e) => { setGrnRowsPerPage(Number(e.target.value)); setGrnPage(1); }}
                              style={{ height: '32px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', padding: '0 8px', backgroundColor: 'white', fontWeight: 'bold' }}
                            >
                              <option value={5}>5</option>
                              <option value={10}>10</option>
                            </select>
                          </div>
                          <span>Showing {sortedGrns.length === 0 ? 0 : indexOfFirstRow + 1} to {Math.min(indexOfLastRow, sortedGrns.length)} of {sortedGrns.length} entries</span>
                        </div>

                        {/* Right Side: Page navigation controls adjacent to Go to page */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: isMobile ? 'center' : 'flex-end',
                          gap: '12px',
                          flexWrap: 'wrap'
                        }}>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <button
                              disabled={safeCurrentPage === 1}
                              onClick={() => setGrnPage(1)}
                              style={{ border: '1px solid #E2E8F0', background: safeCurrentPage === 1 ? '#F8FAFC' : 'white', cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B', fontWeight: 'bold' }}
                            >
                              &laquo;
                            </button>
                            <button
                              disabled={safeCurrentPage === 1}
                              onClick={() => setGrnPage(prev => Math.max(prev - 1, 1))}
                              style={{ border: '1px solid #E2E8F0', background: safeCurrentPage === 1 ? '#F8FAFC' : 'white', cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B' }}
                            >
                              &lt;
                            </button>

                            {pageNumbers.map(page => (
                              <button
                                key={page}
                                onClick={() => setGrnPage(page)}
                                style={{
                                  border: '1px solid #E2E8F0',
                                  background: page === safeCurrentPage ? '#0E7490' : 'white',
                                  color: page === safeCurrentPage ? 'white' : '#475569',
                                  cursor: 'pointer',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontWeight: page === safeCurrentPage ? 'bold' : '500'
                                }}
                              >
                                {page}
                              </button>
                            ))}

                            <button
                              disabled={safeCurrentPage === totalPages || totalPages === 0}
                              onClick={() => setGrnPage(prev => Math.min(prev + 1, totalPages))}
                              style={{ border: '1px solid #E2E8F0', background: (safeCurrentPage === totalPages || totalPages === 0) ? '#F8FAFC' : 'white', cursor: (safeCurrentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B' }}
                            >
                              &gt;
                            </button>
                            <button
                              disabled={safeCurrentPage === totalPages || totalPages === 0}
                              onClick={() => setGrnPage(totalPages)}
                              style={{ border: '1px solid #E2E8F0', background: (safeCurrentPage === totalPages || totalPages === 0) ? '#F8FAFC' : 'white', cursor: (safeCurrentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B', fontWeight: 'bold' }}
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
                              defaultValue={safeCurrentPage}
                              id="grn-goto-page-input"
                              style={{ width: '42px', height: '32px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}
                             />
                            <button
                              onClick={() => {
                                const val = parseInt(document.getElementById('grn-goto-page-input')?.value || '1', 10);
                                if (val >= 1 && val <= totalPages) setGrnPage(val);
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
                );
              })()}

              {/* Floating Selection Toolbar - Single line (Rule 6) */}
              {selectedGrnRows.length > 0 && !showCeoGrnModal && (
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
                    <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selectedGrnRows.length}</strong> Selected
                  </span>

                  <button
                    onClick={() => {
                      if (selectedGrnRows.length > 1) {
                        alert("Please select a single GRN to view details.");
                        return;
                      }
                      const target = grnList.find(g => g.id === selectedGrnRows[0]);
                      setSelectedGrnRows([]);
                      if (target) handleOpenViewGrn(target);
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

                  {!isAccountsUser && selectedGrnRows.length === 1 && (() => {
                    const target = grnList.find(g => g.id === selectedGrnRows[0]);
                    if (!target) return null;
                    const isClosed = String(target.status || '').toUpperCase().includes('CLOSED') || String(target.status || '').toUpperCase().includes('APPROVED') || target.status === 'Fully Accepted';
                    if (isClosed) return null;
                    return (
                      <button
                        onClick={() => {
                          setSelectedGrnRows([]);
                          handleOpenEditGrn(target);
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
                        <Edit3 size={14} style={{ color: '#D97706' }} /> Edit Info
                      </button>
                    );
                  })()}

                  <button
                    onClick={() => {
                      setSelectedGrnRows([]);
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
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                  >
                    <Printer size={14} style={{ color: '#64748B' }} /> Export / Print PDF
                  </button>

                  {!isAccountsUser && (
                    <button
                      onClick={() => {
                        const eligibleToDelete = selectedGrnRows.filter(id => {
                          const t = grnList.find(g => g.id === id);
                          return t && !(String(t.status || '').toUpperCase().includes('CLOSED') || String(t.status || '').toUpperCase().includes('APPROVED') || t.status === 'Fully Accepted');
                        });
                        if (eligibleToDelete.length === 0) {
                          alert('Selected GRN(s) are approved or fully received and cannot be deleted.');
                          return;
                        }
                        if (window.confirm(`Are you sure you want to delete ${eligibleToDelete.length} draft GRN(s)?`)) {
                          eligibleToDelete.forEach(id => {
                            fetch(`/api/grns/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
                          });
                          const remaining = grnList.filter(g => !eligibleToDelete.includes(g.id));
                          setGrnList(remaining);
                          setSelectedGrnRows([]);
                          try {
                            localStorage.setItem('controlroom_central_grns_v2', JSON.stringify(remaining));
                            localStorage.setItem('goods_receipt_notes', JSON.stringify(remaining));
                          } catch (_) {}
                          saveCloudStoreImmediate('grn_store', remaining).catch(() => {});
                        }
                      }}
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
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
                      <Trash2 size={14} style={{ color: '#DC2626' }} /> Delete
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedGrnRows([])}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Deselect all"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
    </>
  );
}
