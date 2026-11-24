import React from 'react';
import { CheckCircle, Boxes, Send, ShieldCheck, CreditCard, XCircle } from 'lucide-react';

export default function PoStageActionButtons({
  poList = [],
  poNumber,
  vendorName,
  getGrandTotal,
  paymentTerms,
  viewingPoStatus,
  isAccounts,
  isProcurementHead,
  canApproveAsMD,
  handlePushToGrn,
  handleOpenProceedPoModal,
  handleOpenPaymentProcessModal,
  setApprovingPo,
  setRejectingPo
}) {
  const currentPoObj = poList.find(p => p.poNo === poNumber || p.id === poNumber) || {
    poNo: poNumber,
    vendor: vendorName,
    amount: `₹ ${Number(getGrandTotal ? getGrandTotal() : 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    paymentTerms
  };

  let hasLocalGrn = false;
  let isLocalGrnClosed = false;
  try {
    const localGrns = JSON.parse(localStorage.getItem('controlroom_central_grns_v2') || localStorage.getItem('goods_receipt_notes') || '[]');
    if (Array.isArray(localGrns)) {
      const matched = localGrns.filter(g => {
        const gRef = String(g.poRef || g.poNo || g.poId || '').toLowerCase().trim();
        const pRef = String(poNumber || '').toLowerCase().trim();
        return gRef && pRef && (gRef === pRef || gRef.includes(pRef) || pRef.includes(gRef));
      });
      if (matched.length > 0) {
        hasLocalGrn = true;
        isLocalGrnClosed = matched.some(g => {
          const gst = String(g.status || '').toUpperCase();
          return gst.includes('CLOSED') || gst.includes('FULLY RECEIVED') || gst.includes('FULLY ACCEPTED');
        });
      }
    }
  } catch (_) {}

  const st = String(viewingPoStatus || currentPoObj?.status || '').trim();
  const objStatus = String(currentPoObj?.status || '').trim();
  const objStatusType = String(currentPoObj?.statusType || '').toLowerCase();
  const totalRec = Number(currentPoObj?.totalReceived || currentPoObj?.totalReceivedQty || 0);
  const grnCount = Number(currentPoObj?.grnCount || (currentPoObj?.grnHistory ? currentPoObj.grnHistory.length : 0));

  const isClosed = st.includes('CLOSED') || st.includes('FULLY RECEIVED') || objStatus.includes('CLOSED') || objStatusType === 'closed' || isLocalGrnClosed;
  const isAlreadyInGrnProcessOrPartial = !isClosed && (
    st.toUpperCase().includes('PARTIAL') ||
    objStatus.toUpperCase().includes('PARTIAL') ||
    objStatusType.includes('partial') ||
    st.toUpperCase().includes('PACKED') ||
    objStatus.toUpperCase().includes('PACKED') ||
    objStatusType.includes('packed') ||
    st.toUpperCase().includes('GRN PROCESS') ||
    objStatus.toUpperCase().includes('GRN PROCESS') ||
    totalRec > 0 ||
    hasLocalGrn ||
    grnCount > 0
  );
  const isProceedPoOnly = !isClosed && !isAlreadyInGrnProcessOrPartial && (st === 'Proceed PO' || st === 'PROCEED PO' || objStatus === 'Proceed PO' || objStatusType === 'proceed_po' || Boolean(currentPoObj?.proceedDetails));
  const isGrnProcess = isAlreadyInGrnProcessOrPartial || isProceedPoOnly;
  const isPaymentProcessed = !isClosed && !isGrnProcess && (st === 'Payment Processed' || objStatus === 'Payment Processed' || objStatusType === 'payment_processed' || Boolean(currentPoObj?.paymentDetails));
  const isMdApproved = (st === 'MD Approved' || objStatus === 'MD Approved' || objStatusType === 'md_approved' || Boolean(currentPoObj?.approvedBy)) && !isClosed && !isGrnProcess && !isPaymentProcessed;
  const isDraftOrPending = !isClosed && !isGrnProcess && !isPaymentProcessed && !isMdApproved;

  if (isClosed) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: '700', color: '#166534' }}>
        <CheckCircle size={14} style={{ color: '#16A34A' }} /> GRN Completed
      </div>
    );
  }

  if (isAlreadyInGrnProcessOrPartial) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#ECFEFF', border: '1px solid #0E7490', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: '700', color: '#0E7490' }}>
        <CheckCircle size={14} style={{ color: '#0E7490' }} /> In GRN Process
      </div>
    );
  }

  if (isProceedPoOnly) {
    if (isAccounts) {
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#ECFEFF', border: '1px solid #0E7490', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: '700', color: '#0E7490' }}>
          <CheckCircle size={14} style={{ color: '#0E7490' }} /> Pending GRN
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => handlePushToGrn(currentPoObj)}
        style={{
          backgroundColor: '#0E7490',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 18px',
          fontSize: '13px',
          fontWeight: '700',
          color: 'white',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)'
        }}
      >
        <Boxes size={15} /> Push to GRN
      </button>
    );
  }

  if (isPaymentProcessed) {
    if (!isProcurementHead) {
      return (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: '#ECFDF5',
          border: '1px solid #A7F3D0',
          borderRadius: '8px',
          padding: '6px 14px',
          fontSize: '12px',
          fontWeight: '700',
          color: '#065F46'
        }}>
          <CheckCircle size={15} style={{ color: '#059669' }} /> Payment Processed / Credit Verified
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => handleOpenProceedPoModal(currentPoObj)}
        style={{ backgroundColor: '#0E7490', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: '700', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)' }}
      >
        <Send style={{ width: '15px', height: '15px' }} /> Proceed PO (Ready for GRN)
      </button>
    );
  }

  if (isMdApproved) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: '#F0FDF4',
          border: '1px solid #BBF7D0',
          borderRadius: '8px',
          padding: '6px 14px',
          fontSize: '12px',
          fontWeight: '700',
          color: '#166534'
        }}>
          <ShieldCheck size={14} style={{ color: '#16A34A' }} /> Approved by CEO — Ready for Payment
        </div>
        {isAccounts && (
          <button
            type="button"
            onClick={() => handleOpenPaymentProcessModal(currentPoObj)}
            style={{ backgroundColor: '#D97706', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: '700', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(217, 119, 6, 0.25)' }}
          >
            <CreditCard style={{ width: '15px', height: '15px' }} /> Process Payment / Verify Credit
          </button>
        )}
      </div>
    );
  }

  if (isDraftOrPending) {
    if (canApproveAsMD) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setRejectingPo(currentPoObj)}
            style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '8px',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#DC2626',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEE2E2'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FEF2F2'}
          >
            <XCircle style={{ width: '15px', height: '15px' }} /> Reject PO
          </button>
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
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#15803D'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#16A34A'}
          >
            <CheckCircle style={{ width: '15px', height: '15px' }} /> Approve PO (Authorize Payment)
          </button>
        </div>
      );
    }
    return null;
  }

  return null;
}
