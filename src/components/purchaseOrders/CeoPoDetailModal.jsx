import React from 'react';
import {
  CheckCircle,
  FileText,
  Printer,
  ShieldCheck,
  XCircle,
  X
} from 'lucide-react';

export default function CeoPoDetailModal(props) {
  const {
    showCeoPoModal,
    setShowCeoPoModal,
    poNumber,
    poDate,
    deliveryDate,
    vendorName,
    gstNo,
    contactPerson,
    contactNo,
    email,
    branch,
    purchaser,
    deliveryAddress,
    billingAddress,
    items,
    notes,
    terms,
    paymentTerms,
    discountPct,
    shippingCharges,
    otherCharges,
    getGrandTotal,
    viewingPoStatus,
    renderStatusBadge,
    setApprovingPo,
    setRejectingPo,
    setPrintPoModal,
    poList,
    renderPoReadOnlyDocument,
    poDetailLoading,
    canApproveAsMD
  } = props;

  if (!showCeoPoModal) return null;

  return (
        <div
          className="ceo-po-modal-overlay po-no-print"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '20px',
            boxSizing: 'border-box'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCeoPoModal(false);
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              width: '100%',
              maxWidth: '1100px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 24px',
                borderBottom: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                gap: '12px',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#E0F2FE',
                  color: '#0369A1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FileText size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                      Purchase Order: {poNumber}
                    </h3>
                    {viewingPoStatus && renderStatusBadge(
                      (viewingPoStatus.includes('CLOSED') || viewingPoStatus.includes('FULLY RECEIVED')) ? 'closed' :
                      (viewingPoStatus.includes('PARTIALLY')) ? 'partially_received' :
                      (viewingPoStatus === 'Proceed PO') ? 'proceed_po' :
                      (viewingPoStatus === 'Payment Processed') ? 'payment_processed' :
                      (viewingPoStatus === 'MD Approved' || viewingPoStatus === 'OPEN' || viewingPoStatus === 'Approved') ? 'approved' :
                      (viewingPoStatus === 'REJECTED') ? 'rejected' : 'pending',
                      viewingPoStatus
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    Vendor: <strong style={{ color: '#0F172A' }}>{vendorName || '—'}</strong> • PO Date: {poDate || '—'}
                  </span>
                </div>
              </div>

              {/* Action Buttons in Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {(() => {
                  const currentPoObj = poList.find(p => p.poNo === poNumber || p.id === poNumber) || {
                    poNo: poNumber,
                    vendor: vendorName,
                    amount: `₹ ${Number(getGrandTotal() || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                    paymentTerms
                  };
                  const st = String(viewingPoStatus || currentPoObj?.status || '').trim();
                  const objStatusType = String(currentPoObj?.statusType || '').toLowerCase();
                  const isMdApproved = st === 'MD Approved' || objStatusType === 'md_approved' || Boolean(currentPoObj?.approvedBy);
                  const isDraftOrPending = !isMdApproved && (st.includes('Pending') || st.includes('WAITING') || st === 'Draft / Pending Approval' || st === 'OPEN');

                  if (isDraftOrPending && canApproveAsMD) {
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => setRejectingPo(currentPoObj)}
                          style={{
                            backgroundColor: '#FEF2F2',
                            border: '1px solid #FECACA',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#DC2626',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <XCircle size={14} /> Reject PO
                        </button>
                        <button
                          type="button"
                          onClick={() => setApprovingPo(currentPoObj)}
                          style={{
                            backgroundColor: '#16A34A',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)'
                          }}
                        >
                          <CheckCircle size={14} /> Approve PO
                        </button>
                      </>
                    );
                  }
                  if (isMdApproved) {
                    return (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: '#F0FDF4',
                        border: '1px solid #BBF7D0',
                        borderRadius: '8px',
                        padding: '5px 12px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        color: '#166534'
                      }}>
                        <ShieldCheck size={14} style={{ color: '#16A34A' }} /> Approved by CEO
                      </span>
                    );
                  }
                  return null;
                })()}

                <button
                  type="button"
                  onClick={() => setPrintPoModal({
                    poNo: poNumber,
                    poDate,
                    deliveryDate,
                    paymentTerms,
                    purchaser,
                    vendorName,
                    branch,
                    contactPerson,
                    contactNo,
                    email,
                    gstNo,
                    deliveryAddress,
                    billingAddress,
                    items,
                    notes,
                    terms,
                    discountPct,
                    shippingCharges,
                    otherCharges
                  })}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Print / Export PDF"
                >
                  <Printer size={13} /> Print
                </button>

                <button
                  type="button"
                  onClick={() => setShowCeoPoModal(false)}
                  style={{
                    backgroundColor: '#F1F5F9',
                    border: 'none',
                    borderRadius: '8px',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748B',
                    marginLeft: '4px'
                  }}
                  title="Close popup"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body (Scrollable) */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, backgroundColor: '#FFFFFF' }}>
              {poDetailLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="skeleton-shimmer" style={{ height: '36px', width: '60%', borderRadius: '8px' }} />
                  <div className="skeleton-shimmer" style={{ height: '120px', width: '100%', borderRadius: '12px' }} />
                  <div className="skeleton-shimmer" style={{ height: '200px', width: '100%', borderRadius: '12px' }} />
                </div>
              ) : (
                renderPoReadOnlyDocument()
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 24px',
                borderTop: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>Grand Total:</span>
                <strong style={{ fontSize: '16px', color: '#0E7490', fontWeight: '800' }}>
                  ₹{Number(getGrandTotal() || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCeoPoModal(false)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '8px 18px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#334155',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>

                {(() => {
                  const currentPoObj = poList.find(p => p.poNo === poNumber || p.id === poNumber);
                  const st = String(viewingPoStatus || currentPoObj?.status || '').trim();
                  const objStatusType = String(currentPoObj?.statusType || '').toLowerCase();
                  const isMdApproved = st === 'MD Approved' || objStatusType === 'md_approved' || Boolean(currentPoObj?.approvedBy);
                  const isDraftOrPending = !isMdApproved && (st.includes('Pending') || st.includes('WAITING') || st === 'Draft / Pending Approval' || st === 'OPEN');

                  if (isDraftOrPending && canApproveAsMD) {
                    return (
                      <button
                        type="button"
                        onClick={() => setApprovingPo(currentPoObj)}
                        style={{
                          backgroundColor: '#16A34A',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 20px',
                          fontSize: '13px',
                          fontWeight: '700',
                          color: 'white',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)'
                        }}
                      >
                        <CheckCircle size={15} /> Approve PO (Authorize Payment)
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>
        </div>

  );
}
