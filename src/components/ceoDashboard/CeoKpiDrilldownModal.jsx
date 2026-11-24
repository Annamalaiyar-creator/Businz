import React from 'react';
import { AlertCircle, ArrowRight, Eye, Filter, Search, X } from 'lucide-react';

export default function CeoKpiDrilldownModal({
  activeKpiPopup,
  setActiveKpiPopup,
  kpiModalConfig,
  kpiModalRows = [],
  kpiPopupSearch,
  setKpiPopupSearch,
  selectedPeriod,
  handleOpenFilteredFullPage,
  onNavigateTab,
  setViewingPiModal,
  setViewingBomModal
}) {
  if (!activeKpiPopup || !kpiModalConfig) return null;
  return (
            <div
          onClick={() => setActiveKpiPopup(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '1020px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
              border: '1px solid #CBD5E1',
              overflow: 'hidden',
              fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '18px 22px',
              backgroundColor: kpiModalConfig.themeColor,
              color: '#FFFFFF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  flexShrink: 0
                }}>
                  {React.createElement(kpiModalConfig.icon, { size: 20 })}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', letterSpacing: '-0.01em' }}>
                      {kpiModalConfig.title}
                    </h3>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '800',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      color: '#FFFFFF'
                    }}>
                      {kpiModalConfig.badge}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: '#FFFFFF',
                      color: kpiModalConfig.themeColor
                    }}>
                      {kpiModalConfig.valueLabel}: {kpiModalConfig.value}
                    </span>
                  </div>
                  <span style={{ fontSize: '11.5px', opacity: 0.9, marginTop: '2px', display: 'block' }}>
                    {kpiModalConfig.subtitle}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {kpiModalConfig.targetTab && (
                  <button
                    type="button"
                    onClick={() => handleOpenFilteredFullPage()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#FFFFFF',
                      color: kpiModalConfig.themeColor,
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      transition: 'all 0.15s ease'
                    }}
                    title={`Open full ${kpiModalConfig.targetTabLabel || kpiModalConfig.targetTab} view with these ${kpiModalRows.length} records filtered`}
                  >
                    <span>Open Full Page (Filtered)</span>
                    <ArrowRight size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveKpiPopup(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    transition: 'background 0.15s ease'
                  }}
                  title="Close (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filter / Search Bar */}
            <div style={{
              padding: '12px 22px',
              backgroundColor: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '400px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  type="text"
                  value={kpiPopupSearch}
                  onChange={(e) => setKpiPopupSearch(e.target.value)}
                  placeholder={`Search ${kpiModalConfig.title.toLowerCase()} by customer, number, or status...`}
                  style={{
                    width: '100%',
                    padding: '7px 12px 7px 32px',
                    fontSize: '12px',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  autoFocus
                />
                {kpiPopupSearch && (
                  <button
                    onClick={() => setKpiPopupSearch('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: 0
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                Showing <strong>{kpiModalRows.length}</strong> {kpiModalRows.length === 1 ? 'record' : 'records'}
              </div>
            </div>

            {/* Modal Body - Table */}
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(90vh - 180px)', backgroundColor: '#FFFFFF' }}>
              {kpiModalRows.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', color: '#94A3B8' }}>
                  <AlertCircle size={36} color="#CBD5E1" style={{ margin: '0 auto 10px auto' }} />
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#475569' }}>
                    {kpiPopupSearch ? 'No matching records found' : `No records recorded for ${selectedPeriod}`}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                    {kpiPopupSearch ? 'Try clearing your search query' : 'Switch the time period filter on top to This Week, MTD, or YTD to inspect historical data.'}
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 2 }}>
                        {kpiModalConfig.columns.map((col, cIdx) => (
                          <th
                            key={cIdx}
                            style={{
                              padding: '11px 14px',
                              fontWeight: '800',
                              color: '#475569',
                              fontSize: '11px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              whiteSpace: 'nowrap',
                              textAlign: cIdx === kpiModalConfig.columns.length - 3 ? 'right' : (cIdx >= kpiModalConfig.columns.length - 2 ? 'center' : 'left'),
                              backgroundColor: '#F8FAFC'
                            }}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {kpiModalRows.map((row, rIdx) => {
                        let stBg = '#F1F5F9';
                        let stColor = '#475569';
                        let stBorder = '#E2E8F0';
                        if (row.statusType === 'success') {
                          stBg = '#ECFDF5'; stColor = '#047857'; stBorder = '#A7F3D0';
                        } else if (row.statusType === 'warning') {
                          stBg = '#FFFBEB'; stColor = '#B45309'; stBorder = '#FDE68A';
                        } else if (row.statusType === 'danger') {
                          stBg = '#FEF2F2'; stColor = '#DC2626'; stBorder = '#FECACA';
                        } else if (row.statusType === 'info') {
                          stBg = '#F0FDFA'; stColor = '#0E7490'; stBorder = '#CCFBF1';
                        }

                        return (
                          <tr
                            key={row.id || rIdx}
                            style={{
                              borderBottom: '1px solid #F1F5F9',
                              transition: 'background-color 0.15s ease',
                              cursor: 'pointer'
                            }}
                            onClick={() => {
                              if (activeKpiPopup === 'pi' && row.rawRecord) {
                                setViewingPiModal(row.rawRecord);
                              } else if ((activeKpiPopup === 'bom' || activeKpiPopup === 'kits') && row.rawRecord) {
                                setViewingBomModal(row.rawRecord);
                              } else if (activeKpiPopup === 'po' && onNavigateTab) {
                                setActiveKpiPopup(null);
                                onNavigateTab('Purchase Orders', row.rawRecord?.po_number || row.rawRecord?.poNumber || row.id);
                              } else if (activeKpiPopup === 'billing' && onNavigateTab) {
                                setActiveKpiPopup(null);
                                onNavigateTab('Invoice Management');
                              } else if (activeKpiPopup === 'dispatch' && onNavigateTab) {
                                setActiveKpiPopup(null);
                                onNavigateTab('Delivery Challans');
                              }
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F0FDFA'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <td style={{ padding: '10px 14px', color: '#94A3B8', fontSize: '11.5px', width: '36px' }}>
                              {rIdx + 1}
                            </td>
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', ...(row.col1Style || {}) }}>
                              {row.col1}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#64748B', whiteSpace: 'nowrap', fontSize: '12px' }}>
                              {row.col2}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#0F172A', fontWeight: '700', minWidth: '180px' }}>
                              {row.col3}
                            </td>
                            {row.col4 !== undefined && (
                              <td style={{ padding: '10px 14px', color: '#475569', fontSize: '12px' }}>
                                {row.col4}
                              </td>
                            )}
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', ...(row.col5Style || {}) }}>
                              {row.col5}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 9px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '700',
                                backgroundColor: stBg,
                                color: stColor,
                                border: `1px solid ${stBorder}`
                              }}>
                                {row.status}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (activeKpiPopup === 'pi' && row.rawRecord) {
                                    setViewingPiModal(row.rawRecord);
                                  } else if ((activeKpiPopup === 'bom' || activeKpiPopup === 'kits') && row.rawRecord) {
                                    setViewingBomModal(row.rawRecord);
                                  } else if (activeKpiPopup === 'po' && onNavigateTab) {
                                    setActiveKpiPopup(null);
                                    onNavigateTab('Purchase Orders', row.rawRecord?.po_number || row.rawRecord?.poNumber || row.id);
                                  } else if (activeKpiPopup === 'billing' && onNavigateTab) {
                                    setActiveKpiPopup(null);
                                    onNavigateTab('Invoice Management');
                                  } else if (activeKpiPopup === 'dispatch' && onNavigateTab) {
                                    setActiveKpiPopup(null);
                                    onNavigateTab('Delivery Challans');
                                  }
                                }}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #CBD5E1',
                                  backgroundColor: '#FFFFFF',
                                  color: '#0E7490',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Eye size={12} />
                                <span>View</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 22px',
              backgroundColor: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                Period Filter: <strong>{selectedPeriod}</strong> • Showing <strong>{kpiModalRows.length}</strong> matching records
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {kpiModalConfig.targetTab && (
                  <button
                    type="button"
                    onClick={() => handleOpenFilteredFullPage()}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: kpiModalConfig.themeColor,
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>Open Full {kpiModalConfig.targetTabLabel || kpiModalConfig.targetTab} (Filtered)</span>
                    <ArrowRight size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveKpiPopup(null)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#334155',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
  );
}
