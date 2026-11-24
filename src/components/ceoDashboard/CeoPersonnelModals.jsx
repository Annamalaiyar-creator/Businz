import React from 'react';
import { Boxes, Check, Edit3, Filter, Mail, Phone, RefreshCw, Target, X } from 'lucide-react';
import { parseAmt } from './ceoDashboardUtils';

export default function CeoPersonnelModals({
  activePersonModal,
  setActivePersonModal,
  showCeoTargetModal,
  setShowCeoTargetModal,
  editingTargetRep,
  setEditingTargetRep,
  editingTargetAmount,
  setEditingTargetAmount,
  isSavingTarget,
  handleSaveCeoTarget,
  viewingRepBomsModal,
  setViewingRepBomsModal,
  setViewingBomModal,
  onNavigateTab,
  allPiList = [],
  allQuotesList = [],
  allBomList = [],
  allPoList = [],
  allInvList = [],
  allPaymentsList = [],
  allWorkOrdersList = [],
  allDispatchesList = [],
  allChallansList = [],
  presetsList = [],
  inventoryList = [],
  employeesList = [],
  periodMultiplier = 1,
  challansList = [],
  dispatchesList = [],
  bomList = [],
  teamDirectory = [],
  formatTargetCurrency = (v) => '₹ ' + Number(v || 0).toLocaleString('en-IN'),
  ceoTargetStore = {}
}) {
  return (
    <>
            {activePersonModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: activePersonModal.avatarBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '900',
                  fontSize: '16px'
                }}>
                  {activePersonModal.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>{activePersonModal.name}</h3>
                    <span style={{ fontSize: '10px', fontWeight: '800', backgroundColor: 'rgba(255, 255, 255, 0.2)', padding: '1px 6px', borderRadius: '4px' }}>
                      {activePersonModal.code}
                    </span>
                  </div>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94A3B8' }}>
                    {activePersonModal.designation} • {activePersonModal.department} Department
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActivePersonModal(null)}
                style={{
                  border: 'none',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#FFFFFF',
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Executive Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Period Output</div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#0E7490', marginTop: '2px' }}>
                    {activePersonModal.unit === 'Revenue' || activePersonModal.unit === 'PO Spend' || activePersonModal.unit === 'Invoicing' || activePersonModal.unit === 'Collections'
                      ? (activePersonModal.achievedVal >= 10000000 
                          ? `₹ ${(activePersonModal.achievedVal / 10000000).toFixed(2)} Cr`
                          : `₹ ${(activePersonModal.achievedVal / 100000).toFixed(2)} L`)
                      : `${Math.round(activePersonModal.achievedVal)} ${activePersonModal.unit}`}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>{activePersonModal.unit} Handled</div>
                </div>

                <div style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Target Met</div>
                    {activePersonModal.department === 'Sales' && (
                      <button
                        onClick={() => {
                          setEditingTargetRep(activePersonModal.name);
                          setEditingTargetAmount(String(activePersonModal.monthlyTarget || 18000000));
                          setShowCeoTargetModal(true);
                        }}
                        style={{
                          background: '#ECFEFF',
                          border: '1px solid #CFFAFE',
                          borderRadius: '4px',
                          color: '#0E7490',
                          fontSize: '10px',
                          fontWeight: '800',
                          padding: '1px 5px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}
                        title="Edit Target as CEO"
                      >
                        <Edit3 size={10} /> Edit Target
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: activePersonModal.targetPct >= 100 ? '#16A34A' : '#2563EB', marginTop: '2px' }}>
                    {activePersonModal.targetPct}%
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>
                    {activePersonModal.department === 'Sales'
                      ? `Target: ₹ ${(activePersonModal.monthlyTarget * periodMultiplier / 10000000).toFixed(2)} Cr`
                      : `Rating: ${activePersonModal.rating}`}
                  </div>
                </div>

                <div style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Activity Volume</div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#0F172A', marginTop: '2px' }}>
                    {activePersonModal.recordCount} Items
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>Operational Records</div>
                </div>
              </div>

              {/* Contact Information */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 14px', backgroundColor: '#F0F9FF', borderRadius: '10px', border: '1px solid #BAE6FD', fontSize: '11px', color: '#0369A1' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Mail size={12} /> {activePersonModal.email}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Phone size={12} /> {activePersonModal.phone}
                </span>
              </div>

              {/* Individual Live Records List */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Live Department Records Associated with {activePersonModal.name}
                </div>

                <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                        <th style={{ padding: '8px 10px' }}>Reference No</th>
                        <th style={{ padding: '8px 10px' }}>Counterparty / Description</th>
                        <th style={{ padding: '8px 10px' }}>Amount / Output</th>
                        <th style={{ padding: '8px 10px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* If Sales: show their PIs, Quotes, and BOM Orders */}
                      {activePersonModal.department === 'Sales' && (
                        (activePersonModal.records?.pis?.length > 0 || activePersonModal.records?.quotes?.length > 0 || activePersonModal.records?.boms?.length > 0) ? (
                          [...(activePersonModal.records?.boms || []), ...(activePersonModal.records?.pis || []), ...(activePersonModal.records?.quotes || [])].slice(0, 8).map((rec, rIdx) => {
                            const isBom = Boolean(rec.bomCode || (rec.code && String(rec.code).startsWith('BOM')));
                            const refNo = rec.bomCode || rec.code || rec.piNo || rec.quoteNo || rec.id;
                            const amt = isBom 
                              ? (rec.totalWeight ? `${rec.totalWeight} MT` : (rec.totalAmount ? `₹ ${parseAmt(rec.totalAmount).toLocaleString('en-IN')}` : 'BOM Order'))
                              : (typeof rec.grandTotal === 'number' 
                                  ? `₹ ${rec.grandTotal.toLocaleString('en-IN')}` 
                                  : (rec.grandTotal || (rec.amount ? `₹ ${parseAmt(rec.amount).toLocaleString('en-IN')}` : '₹ 0.00')));
                            return (
                              <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '8px 10px', fontWeight: '800', color: isBom ? '#0284C7' : '#0E7490' }}>
                                  {refNo} {isBom && <span style={{ fontSize: '8.5px', padding: '1px 4px', backgroundColor: '#E0F2FE', color: '#0369A1', borderRadius: '4px', marginLeft: '4px' }}>BOM</span>}
                                </td>
                                <td style={{ padding: '8px 10px', fontWeight: '700' }}>{rec.customerName || rec.customer || 'Key Client'}</td>
                                <td style={{ padding: '8px 10px', fontWeight: '800' }}>{amt}</td>
                                <td style={{ padding: '8px 10px' }}>
                                  <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: isBom ? '#EFF6FF' : '#DCFCE7', color: isBom ? '#1D4ED8' : '#16A34A' }}>
                                    {rec.status || 'Active'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                              No Proforma Invoices, Quotes, or BOM orders created yet.
                            </td>
                          </tr>
                        )
                      )}

                      {/* If Procurement: show their POs */}
                      {activePersonModal.department === 'Procurement' && (
                        (activePersonModal.records?.pos?.length > 0) ? (
                          activePersonModal.records.pos.slice(0, 5).map((rec, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: '800', color: '#2563EB' }}>{rec.poNo || rec.poNumber || rec.purchaseorder_number || rec.id}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '700' }}>{rec.vendor || rec.vendorName || rec.vendor_name || 'Supplier'}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '800' }}>
                                {rec.amount || (rec.total ? `₹ ${(parseAmt(rec.total) / 100000).toFixed(2)} L` : '₹ 0.00')}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#EFF6FF', color: '#2563EB' }}>
                                  {rec.status || rec.stage || 'Issued'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                              No Purchase Orders managed yet.
                            </td>
                          </tr>
                        )
                      )}

                      {/* If Accounts: show Invoices & Payments */}
                      {activePersonModal.department === 'Accounts' && (
                        (activePersonModal.records?.invs?.length > 0) ? (
                          activePersonModal.records.invs.slice(0, 5).map((rec, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: '800', color: '#7C3AED' }}>{rec.invNo || rec.invoiceNo || rec.id}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '700' }}>{rec.customerName || rec.customer || 'Client'}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '800' }}>
                                {typeof rec.total === 'number' ? `₹ ${rec.total.toLocaleString('en-IN')}` : (rec.total || rec.grandTotal || '₹ 0.00')}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{
                                  fontSize: '9.5px',
                                  fontWeight: '800',
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  backgroundColor: String(rec.status).toLowerCase().includes('paid') ? '#DCFCE7' : '#FEF3C7',
                                  color: String(rec.status).toLowerCase().includes('paid') ? '#16A34A' : '#D97706'
                                }}>
                                  {rec.status || 'Verified'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                              No Invoices or Collections handled yet.
                            </td>
                          </tr>
                        )
                      )}

                      {/* If Billing: show Invoices & Clearances */}
                      {activePersonModal.department === 'Billing' && (
                        (activePersonModal.records?.invs?.length > 0) ? (
                          activePersonModal.records.invs.slice(0, 5).map((rec, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: '800', color: '#9333EA' }}>{rec.invNo || rec.invoiceNo || rec.id}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '700' }}>{rec.customerName || rec.customer || 'Client'}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '800' }}>
                                {typeof rec.total === 'number' ? `₹ ${rec.total.toLocaleString('en-IN')}` : (rec.total || rec.grandTotal || '₹ 0.00')}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#F3E8FF', color: '#9333EA' }}>
                                  {rec.status || 'Generated'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                              No Tax Invoices issued yet.
                            </td>
                          </tr>
                        )
                      )}

                      {/* If Production: show BOM Orders & Work Orders */}
                      {activePersonModal.department === 'Production' && (
                        (activePersonModal.records?.boms?.length > 0 || bomList.length > 0) ? (
                          (activePersonModal.records?.boms?.length > 0 ? activePersonModal.records.boms : bomList).slice(0, 5).map((rec, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0284C7' }}>{rec.bomCode || rec.id}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '700' }}>{rec.customerName || rec.customer || 'Solar Project'}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '800' }}>{rec.totalWeight ? `${rec.totalWeight} MT` : (rec.weight ? `${rec.weight} MT` : '0 MT')}</td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#E0F2FE', color: '#0284C7' }}>
                                  {rec.status || 'Active'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                              No BOM production orders assigned yet.
                            </td>
                          </tr>
                        )
                      )}

                      {/* If Dispatch: show Dispatches & Delivery Challans */}
                      {activePersonModal.department === 'Dispatch' && (
                        (challansList.length > 0 || dispatchesList.length > 0) ? (
                          (challansList.length > 0 ? challansList : dispatchesList).slice(0, 5).map((rec, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: '800', color: '#059669' }}>{rec.challanNo || rec.dcNo || rec.id || `DC-${rIdx + 1}`}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '700' }}>{rec.customerName || rec.customer || '-'}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '800' }}>{rec.weight ? `${rec.weight} MT` : (rec.tonnage ? `${rec.tonnage} MT` : '-')}</td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#DCFCE7', color: '#059669' }}>
                                  {rec.status || 'Dispatched'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                              No dispatch clearances or challans recorded yet.
                            </td>
                          </tr>
                        )
                      )}

                      {/* If Design: show Presets & Engineering Models */}
                      {activePersonModal.department === 'Design' && (
                        (presetsList.length > 0) ? (
                          presetsList.slice(0, 5).map((rec, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: '800', color: '#D97706' }}>{rec.presetCode || rec.code || rec.id || `PST-${rIdx + 1}`}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '700' }}>{rec.presetName || rec.name || rec.profile || 'Structural Profile'}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '800' }}>{rec.category || rec.type || 'Preset'}</td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#FEF3C7', color: '#D97706' }}>
                                  {rec.status || 'Approved'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                              No structural presets saved yet.
                            </td>
                          </tr>
                        )
                      )}

                      {/* If Tech Support: show Technical Audits & Material Validations */}
                      {activePersonModal.department === 'Tech Support' && (
                        (bomList.filter(b => b.qcPassed || b.status === 'Completed').length > 0) ? (
                          bomList.filter(b => b.qcPassed || b.status === 'Completed').slice(0, 5).map((rec, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: '800', color: '#4F46E5' }}>{rec.bomCode || rec.id}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '700' }}>{rec.customerName || rec.customer || 'Inspection'}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '800' }}>{rec.totalWeight ? `${rec.totalWeight} MT` : 'Certified'}</td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#EEF2FF', color: '#4F46E5' }}>
                                  QA Passed
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                              No technical QA audit records logged yet.
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 20px', backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setActivePersonModal(null)}
                style={{
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: CEO / MD TARGET CONFIGURATION MODAL */}
      {showCeoTargetModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden',
            border: '1px solid #CBD5E1',
            fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              backgroundColor: '#0E7490',
              color: '#FFFFFF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Target size={18} style={{ color: '#FFFFFF' }} /> Configure Monthly Sales Targets
                </h3>
                <span style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px', display: 'block' }}>
                  Executive Command • Set Company & Rep Targets
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCeoTargetModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '6px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label htmlFor="ceo-executive-dashboard-editing-target-rep" style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Target Scope / Sales Representative
                </label>
                <select id="ceo-executive-dashboard-editing-target-rep" name="editingTargetRep" aria-label="Target Scope / Sales Representative"
                  value={editingTargetRep}
                  onChange={(e) => {
                    const newRep = e.target.value;
                    setEditingTargetRep(newRep);
                    const currentVal = newRep === 'All'
                      ? (ceoTargetStore?.repTargets?.['All'] || ceoTargetStore?.monthlyCompanyTarget || 18000000)
                      : (ceoTargetStore?.repTargets?.[newRep] || 18000000);
                    setEditingTargetAmount(String(currentVal));
                  }}
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    padding: '0 12px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#0F172A',
                    backgroundColor: '#F8FAFC'
                  }}
                >
                  <option value="All">All Sales Reps (Overall Company Monthly Target)</option>
                  {teamDirectory.filter(t => t.department === 'Sales').map(rep => (
                    <option key={rep.code} value={rep.name}>{rep.name} ({rep.designation})</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>
                    Monthly Target (₹)
                  </label>
                  <span style={{ fontSize: '13px', fontWeight: '900', color: '#0E7490' }}>
                    {formatTargetCurrency(editingTargetAmount)}
                  </span>
                </div>
                <input id="ceo-executive-dashboard-editing-target-amount" name="editingTargetAmount" aria-label="Enter amount in ₹ ( 18000000)"
                  type="number"
                  value={editingTargetAmount}
                  onChange={(e) => setEditingTargetAmount(e.target.value)}
                  placeholder="Enter amount in ₹ (e.g. 18000000)"
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    border: '2px solid #0E7490',
                    padding: '0 12px',
                    fontSize: '15px',
                    fontWeight: '800',
                    color: '#0F172A',
                    boxSizing: 'border-box'
                  }}
                 />
              </div>

              {/* Quick Presets */}
              <div>
                <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '6px' }}>
                  Quick Presets:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {[
                    { label: '₹ 50 L', val: 5000000 },
                    { label: '₹ 75 L', val: 7500000 },
                    { label: '₹ 1.0 Cr', val: 10000000 },
                    { label: '₹ 1.4 Cr', val: 14000000 },
                    { label: '₹ 1.8 Cr', val: 18000000 },
                    { label: '₹ 2.5 Cr', val: 25000000 },
                    { label: '₹ 3.5 Cr', val: 35000000 },
                    { label: '₹ 5.0 Cr', val: 50000000 }
                  ].map(preset => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setEditingTargetAmount(String(preset.val))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        border: Number(editingTargetAmount) === preset.val ? '1px solid #0E7490' : '1px solid #E2E8F0',
                        backgroundColor: Number(editingTargetAmount) === preset.val ? '#ECFEFF' : '#F8FAFC',
                        color: Number(editingTargetAmount) === preset.val ? '#0E7490' : '#475569',
                        fontSize: '11px',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 20px',
              backgroundColor: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => setShowCeoTargetModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingTarget || Number(editingTargetAmount) <= 0}
                onClick={() => handleSaveCeoTarget(editingTargetRep, Number(editingTargetAmount))}
                style={{
                  padding: '8px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: isSavingTarget ? '#94A3B8' : '#0E7490',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: isSavingTarget ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(14, 116, 144, 0.25)'
                }}
              >
                {isSavingTarget ? (
                  <>
                    <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Saving...
                  </>
                ) : (
                  <>
                    <Check size={14} /> Save & Apply Target
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SALES REP BOM ORDERS DETAIL MODAL */}
      {viewingRepBomsModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            width: '900px',
            maxWidth: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
            border: '1px solid #E2E8F0',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: viewingRepBomsModal.avatarBg || '#0E7490',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  fontWeight: '800'
                }}>
                  {viewingRepBomsModal.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                      {viewingRepBomsModal.name}
                    </h3>
                    <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#0E7490', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', padding: '1px 7px', borderRadius: '6px' }}>
                      {viewingRepBomsModal.code}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>
                      • {viewingRepBomsModal.role}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                    Total BOM Orders Given: <strong>{viewingRepBomsModal.boms.length} Orders</strong> • Total Value: <strong>{viewingRepBomsModal.totalAmount >= 10000000 ? `₹ ${(viewingRepBomsModal.totalAmount / 10000000).toFixed(2)} Cr` : `₹ ${(viewingRepBomsModal.totalAmount / 100000).toFixed(2)} Lakhs`}</strong> • Total Weight: <strong>{viewingRepBomsModal.totalTonnage.toFixed(1)} MT</strong>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setViewingRepBomsModal(null)}
                style={{
                  border: 'none',
                  backgroundColor: '#F1F5F9',
                  color: '#64748B',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body: Table of BOMs */}
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
              {viewingRepBomsModal.boms.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
                  <Boxes size={36} color="#CBD5E1" style={{ marginBottom: '10px' }} />
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>No BOM orders recorded for this sales representative yet</div>
                  <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '4px' }}>BOMs raised by {viewingRepBomsModal.name} in the BOM Orders view will automatically appear here.</div>
                </div>
              ) : (
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: '700' }}>
                        <th style={{ padding: '10px 12px' }}>#</th>
                        <th style={{ padding: '10px 12px' }}>BOM Order No</th>
                        <th style={{ padding: '10px 12px' }}>Client / Developer</th>
                        <th style={{ padding: '10px 12px' }}>Date</th>
                        <th style={{ padding: '10px 12px' }}>Tonnage</th>
                        <th style={{ padding: '10px 12px' }}>Order Value</th>
                        <th style={{ padding: '10px 12px' }}>Status</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingRepBomsModal.boms.map((b, idx) => {
                        const bomAmt = parseAmt(b.totalAmount || b.amount || b.grandTotal || b.value || b.val || 0);
                        const weight = parseFloat(b.totalWeight || b.weight || 0) || 0;
                        return (
                          <tr key={idx} style={{ borderBottom: idx === viewingRepBomsModal.boms.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                            <td style={{ padding: '10px 12px', color: '#94A3B8', fontWeight: '600' }}>{idx + 1}</td>
                            <td style={{ padding: '10px 12px', fontWeight: '800', color: '#0E7490' }}>
                              {b.bomCode || b.code || b.id || `BOM-${idx + 1}`}
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0F172A' }}>
                              {b.customer || b.customerName || 'Client'}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#64748B' }}>
                              {b.date || b.createdAt ? new Date(b.date || b.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0284C7' }}>
                              {weight > 0 ? `${weight.toFixed(1)} MT` : '—'}
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: '800', color: '#0F172A' }}>
                              {bomAmt > 0 ? `₹ ${bomAmt.toLocaleString('en-IN')}` : '₹ 0.00'}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '10px',
                                fontWeight: '800',
                                backgroundColor: String(b.status).toLowerCase().includes('production') ? '#EFF6FF' : (String(b.status).toLowerCase().includes('dispatch') || b.invoiceConfirmed ? '#F0FDF4' : '#FFFBEB'),
                                color: String(b.status).toLowerCase().includes('production') ? '#1D4ED8' : (String(b.status).toLowerCase().includes('dispatch') || b.invoiceConfirmed ? '#15803D' : '#B45309')
                              }}>
                                {b.status || 'Active'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <button
                                onClick={() => {
                                  setViewingRepBomsModal(null);
                                  if (onNavigateTab) {
                                    onNavigateTab('BOM Orders', null, null, null);
                                  }
                                }}
                                style={{
                                  border: '1px solid #CBD5E1',
                                  backgroundColor: '#FFFFFF',
                                  color: '#0E7490',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '10.5px',
                                  fontWeight: '700',
                                  cursor: 'pointer'
                                }}
                              >
                                Open BOM
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
              padding: '12px 24px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#F8FAFC'
            }}>
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                Showing all <strong>{viewingRepBomsModal.boms.length}</strong> BOM orders raised by <strong>{viewingRepBomsModal.name}</strong>
              </span>
              <button
                onClick={() => setViewingRepBomsModal(null)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
