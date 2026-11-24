import React from 'react';
import { Ban } from 'lucide-react';
import { formatAddressObj } from '../../utils/otherViewsShared';

export default function PoConfirmationModals(props) {
  const {
    deleteIdx,
    setDeleteIdx,
    poList = [],
    executeDeletePO,
    items = [],
    handleRemoveItem,
    showSaveConfirm,
    setShowSaveConfirm,
    deliveryAddress1,
    deliveryAddress2,
    deliveryCity,
    deliveryState,
    deliveryPincode,
    deliveryAddress,
    getTaxableAmount,
    getCGST,
    getSGST,
    getGrandTotal,
    viewMode,
    poNumber,
    vendorName,
    purchaser,
    poDate,
    deliveryDate,
    paymentTerms,
    priority,
    isSubmittingPO,
    executeCreatePO,
    showCancelConfirm,
    setShowCancelConfirm,
    setViewMode,
    cancellingPo,
    setCancellingPo,
    cancellationRemarkInput,
    setCancellationRemarkInput,
    handleCancelPoSubmit
  } = props;

  return (
    <>
      {deleteIdx !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', width: '420px', padding: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ backgroundColor: '#ef4444', color: 'white', fontSize: '12px', fontWeight: '800', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.15em' }}>
              URGENT
            </div>
            <div style={{ padding: '16px', border: '1.5px dashed #cbd5e1', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Delete Purchase Order?</h3>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>{poList[deleteIdx].poDate}</span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
                Are you sure you want to permanently delete Purchase Order <strong>{poList[deleteIdx].poNo}</strong>? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', marginTop: '6px' }}>
                <button onClick={() => setDeleteIdx(null)} style={{ border: 'none', backgroundColor: 'transparent', color: '#64748b', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                <button onClick={executeDeletePO} style={{ backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Delete PO</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SAVE CONFIRMATION POPUP ==================== */}
      {showSaveConfirm && (() => {
        const confirmItems = (items || []).filter(it => it && String(it.name || '').trim() !== '' && Number(it.qty) > 0);
        const confirmDelAddr = formatAddressObj({ address1: deliveryAddress1, address2: deliveryAddress2, city: deliveryCity, state: deliveryState, pincode: deliveryPincode }) || (deliveryAddress || '').trim();
        const subtotalAmt = getTaxableAmount();
        const gstAmt = getCGST() + getSGST();
        const grandTotalAmt = getGrandTotal();
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', width: '620px', maxWidth: '100%', maxHeight: '90vh', padding: '18px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ backgroundColor: '#2563eb', color: 'white', fontSize: '12px', fontWeight: '800', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.12em', flexShrink: 0 }}>
                RECONFIRM PURCHASE ORDER DETAILS
              </div>
              <div style={{ padding: '16px', border: '1.5px dashed #cbd5e1', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'white', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                    {viewMode === 'edit' ? 'Confirm Purchase Order Changes?' : 'Confirm Purchase Order Submission?'}
                  </h3>
                  <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: '700' }}>{poNumber}</span>
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.4', margin: 0 }}>
                  Please verify all PO details below before confirming:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '12px', color: '#334155', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div><span style={{ color: '#64748b' }}>Vendor:</span> <strong>{vendorName || 'Fresh Vendor'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>PO Issued By:</span> <strong>{purchaser || '-'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>PO Date:</span> <strong>{poDate || '-'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Expected Delivery:</span> <strong>{deliveryDate || '-'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Payment Terms:</span> <strong>{paymentTerms || '-'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Priority:</span> <strong>{priority || '-'}</strong></div>
                  <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#64748b' }}>Delivery Address:</span> <strong>{confirmDelAddr || '-'}</strong></div>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <thead style={{ backgroundColor: '#f1f5f9', position: 'sticky', top: 0 }}>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '7px 10px', color: '#475569', fontWeight: '700' }}>Item</th>
                          <th style={{ textAlign: 'right', padding: '7px 8px', color: '#475569', fontWeight: '700' }}>Qty</th>
                          <th style={{ textAlign: 'right', padding: '7px 8px', color: '#475569', fontWeight: '700' }}>Rate</th>
                          <th style={{ textAlign: 'right', padding: '7px 10px', color: '#475569', fontWeight: '700' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {confirmItems.map((it, idx) => {
                          const qty = Number(it.qty || 0);
                          const rate = Number(it.rate || 0);
                          return (
                            <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '6px 10px', color: '#1e293b', fontWeight: '600' }}>{it.name}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#334155' }}>{qty} {it.unit || 'NOS'}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#334155' }}>₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', color: '#1e293b', fontWeight: '600' }}>₹{(qty * rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '10px 12px', backgroundColor: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                  <div style={{ display: 'flex', gap: '16px', color: '#475569' }}>
                    <span>Subtotal: <strong>₹{subtotalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                    <span>GST: <strong>₹{gstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                  </div>
                  <div style={{ fontSize: '14px', color: '#1d4ed8', fontWeight: '800' }}>
                    Total: ₹{grandTotalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setShowSaveConfirm(false)}
                    disabled={isSubmittingPO}
                    style={{ border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontWeight: '700', cursor: isSubmittingPO ? 'not-allowed' : 'pointer' }}
                  >
                    Go Back & Edit
                  </button>
                  <button
                    type="button"
                    onClick={(e) => executeCreatePO(e, 'Draft / Pending Approval')}
                    disabled={isSubmittingPO}
                    style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '12px', fontWeight: '700', cursor: isSubmittingPO ? 'not-allowed' : 'pointer', opacity: isSubmittingPO ? 0.6 : 1 }}
                  >
                    {isSubmittingPO ? 'Submitting...' : (viewMode === 'edit' ? 'Confirm & Save Changes' : 'Confirm & Submit PO')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==================== CANCEL/DISCARD DETAILS CONFIRMATION POPUP ==================== */}
      {showCancelConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', width: '420px', padding: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ backgroundColor: '#f97316', color: 'white', fontSize: '12px', fontWeight: '800', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.15em' }}>
              DISCARD
            </div>
            <div style={{ padding: '16px', border: '1.5px dashed #cbd5e1', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Discard Changes?</h3>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
                Are you sure you want to discard your changes? All unsaved details for this Purchase Order will be lost.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', marginTop: '6px' }}>
                <button onClick={() => setShowCancelConfirm(false)} style={{ border: 'none', backgroundColor: 'transparent', color: '#64748b', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>No, Go Back</button>
                <button onClick={() => {
                  setShowCancelConfirm(false);
                  try {
                    sessionStorage.removeItem('controlroom_po_view_mode');
                    sessionStorage.removeItem('controlroom_viewing_po');
                  } catch (_) {}
                  setViewMode('list');
                }} style={{ backgroundColor: '#ffedd5', color: '#ea580c', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Discard Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL PURCHASE ORDER MODAL */}
      {cancellingPo && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', border: '1px solid #E2E8F0', width: '460px', maxWidth: '92vw', padding: '22px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#DC2626', color: '#FFFFFF', fontSize: '12px', fontWeight: '800', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.12em', gap: '6px' }}>
              <Ban size={15} /> CANCEL PURCHASE ORDER
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0F172A', margin: 0 }}>
                Cancel PO {cancellingPo.poNo || cancellingPo.id}?
              </h3>
              <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: '#F8FAFC', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div>Vendor: <strong style={{ color: '#0F172A' }}>{cancellingPo.vendor || cancellingPo.vendorName || vendorName}</strong></div>
                <div>Amount: <strong style={{ color: '#0F172A' }}>{cancellingPo.amount ? `₹${Number(cancellingPo.amount).toLocaleString('en-IN')}` : (cancellingPo.total ? `₹${Number(cancellingPo.total).toLocaleString('en-IN')}` : '—')}</strong></div>
                <div>Current Status: <strong style={{ color: '#0E7490' }}>{cancellingPo.status || 'Active'}</strong></div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                <label htmlFor="po-cancellation-remark-input" style={{ fontSize: '11px', fontWeight: 'bold', color: '#DC2626' }}>
                  Cancellation Remark (Mandatory) *
                </label>
                <textarea
                  id="po-cancellation-remark-input"
                  name="cancellationRemarkInput"
                  aria-label="Cancellation Remark"
                  value={cancellationRemarkInput}
                  onChange={(e) => setCancellationRemarkInput(e.target.value)}
                  placeholder="Enter detailed reason / remark for cancelling this PO..."
                  style={{ height: '70px', borderRadius: '8px', border: '1.5px solid #FCA5A5', padding: '8px 12px', fontSize: '12px', resize: 'none', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setCancellingPo(null); setCancellationRemarkInput(''); }}
                  style={{ border: 'none', backgroundColor: 'transparent', color: '#64748B', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={!cancellationRemarkInput || String(cancellationRemarkInput).trim() === ''}
                  onClick={() => handleCancelPoSubmit(cancellingPo)}
                  style={{
                    backgroundColor: (!cancellationRemarkInput || String(cancellationRemarkInput).trim() === '') ? '#FCA5A5' : '#DC2626',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 18px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: (!cancellationRemarkInput || String(cancellationRemarkInput).trim() === '') ? 'not-allowed' : 'pointer'
                  }}
                >
                  Confirm Cancellation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
