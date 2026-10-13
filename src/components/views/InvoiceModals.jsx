import React, { useState } from "react";
import { AlertCircle, CheckCircle, Package, Truck } from "lucide-react";

export function CloseInvoiceReasonModal({ closeInvoiceReasonModal, onClose, setInvoiceList }) {
  const [closeReasonText, setCloseReasonText] = useState('');

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
      <div style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #E2E8F0', width: '520px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626', flexShrink: 0 }}>
            <AlertCircle size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Close Invoice Without Full Delivery</h3>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
              Invoice: <strong style={{ color: '#0F172A' }}>{closeInvoiceReasonModal.invNo || closeInvoiceReasonModal.code}</strong>
            </p>
          </div>
        </div>

        <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#B45309', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
          <span>You are closing this invoice without delivering the pending/missing products. A mandatory justification reason is required to close this invoice.</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label htmlFor="invoice-modals-close-reason-text" style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>
            Why are you closing this invoice without sending the product? <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <textarea id="invoice-modals-close-reason-text" name="closeReasonText" aria-label="Why are you closing this invoice without sending the product?"
            value={closeReasonText}
            onChange={(e) => setCloseReasonText(e.target.value)}
            placeholder="Specify reason (e.g., Customer cancelled missing items / Short supply agreed / Refund issued)..."
            rows={4}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
           />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
          <button
            type="button"
            onClick={() => onClose()}
            style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!closeReasonText.trim()}
            onClick={() => {
              if (!closeReasonText.trim()) return;
              if (typeof setInvoiceList === 'function') {
                setInvoiceList(prev => prev.map(invItem => (invItem.invNo === closeInvoiceReasonModal.invNo || invItem.code === closeInvoiceReasonModal.code) ? {
                  ...invItem,
                  status: 'CLOSED',
                  closeReason: closeReasonText,
                  pay: 'Closed (No Pending)'
                } : invItem));
              }
              alert(`✅ Invoice ${closeInvoiceReasonModal.invNo || closeInvoiceReasonModal.code} successfully CLOSED with reason recorded.`);
              onClose();
            }}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: closeReasonText.trim() ? '#DC2626' : '#94A3B8',
              color: 'white',
              fontSize: '13px',
              fontWeight: '800',
              cursor: closeReasonText.trim() ? 'pointer' : 'not-allowed',
              boxShadow: closeReasonText.trim() ? '0 2px 4px rgba(220,38,38,0.25)' : 'none'
            }}
          >
            Confirm Close Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmInvoiceSuccessModal({ confirmInvoiceSuccessModal, onClose }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #E2E8F0', width: '560px', maxWidth: '95%', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '14px', backgroundColor: '#DCFCE7', border: '1px solid #86EFAC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534', flexShrink: 0, boxShadow: '0 4px 10px rgba(22,101,52,0.15)' }}>
            <CheckCircle size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#0F172A', margin: 0 }}>Invoice Confirmed & Stock Reduced!</h3>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '3px 0 0 0' }}>
              Invoice: <strong style={{ color: '#2563EB' }}>{typeof confirmInvoiceSuccessModal === 'object' ? confirmInvoiceSuccessModal.invNo : confirmInvoiceSuccessModal}</strong> • BOM: <strong style={{ color: '#4F46E5' }}>{typeof confirmInvoiceSuccessModal === 'object' ? confirmInvoiceSuccessModal.bomCode : 'BOM'}</strong>
            </p>
          </div>
        </div>

        {/* Stock Reduction Banner */}
        <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', color: '#166534' }}>
            <Package size={16} /> Inventory Stock Reduced for Packed Items Alone
          </div>
          <div style={{ fontSize: '12px', color: '#15803D', lineHeight: '1.5' }}>
            {typeof confirmInvoiceSuccessModal === 'object' && confirmInvoiceSuccessModal.packedCount !== undefined ? (
              <>Stock count has been automatically decremented in the inventory registry for <strong>{confirmInvoiceSuccessModal.packedCount} packed item(s)</strong>. Any unpacked items remain untouched.</>
            ) : (
              <>Stock count has been decremented for packed items in the stock inventory registry.</>
            )}
          </div>
        </div>

        {/* Next Route Banner */}
        <div style={{ backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', color: '#4338CA' }}>
            <Truck size={16} /> Next Stage: Despatch Team Vehicle Loading
          </div>
          <div style={{ fontSize: '12px', color: '#4F46E5', lineHeight: '1.5' }}>
            Order is forwarded to the <strong>Despatch Team</strong>. The dispatch crew must record vehicle/driver details and capture <strong>loading photos and videos</strong> before the BOM flow is marked 100% completed.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
          <button
            type="button"
            onClick={() => onClose()}
            style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', backgroundColor: '#2563EB', color: 'white', fontSize: '13px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}
          >
            Great, Done
          </button>
        </div>
      </div>
    </div>
  );
}
