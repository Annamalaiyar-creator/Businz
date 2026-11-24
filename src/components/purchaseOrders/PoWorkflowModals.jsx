import VRMPurchaseOrderPrintTemplate from '../VRMPurchaseOrderPrintTemplate.jsx';
import React from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle,
  Download,
  FileText,
  Image,
  Info,
  Layers,
  Mail,
  Maximize2,
  MessageSquare,
  Phone,
  Send,
  ShieldCheck,
  UploadCloud,
  XCircle,
  X
} from 'lucide-react';

export default function PoWorkflowModals(props) {
  const {
    rejectingPo,
    setRejectingPo,
    rejectionReasonInput,
    setRejectionReasonInput,
    handleRejectPoSubmit,
    approvingPo,
    setApprovingPo,
    approvalRemarksInput,
    setApprovalRemarksInput,
    handleApprovePoSubmit,
    paymentProcessingPo,
    setPaymentProcessingPo,
    payAmountInput,
    setPayAmountInput,
    payModeInput,
    setPayModeInput,
    payRefInput,
    setPayRefInput,
    payRemarksInput,
    setPayRemarksInput,
    payCreditTermsInput,
    setPayCreditTermsInput,
    payImagesInput,
    handlePaymentImageUpload,
    handleRemovePaymentImage,
    handleProcessPaymentSubmit,
    proceedingPo,
    setProceedingPo,
    proceedPhoneInput,
    setProceedPhoneInput,
    proceedEmailInput,
    setProceedEmailInput,
    proceedRemarksInput,
    setProceedRemarksInput,
    proceedMessageContent,
    setProceedMessageContent,
    handleSendViaWhatsApp,
    handleProceedPoSubmit,
    previewZoomImage,
    setPreviewZoomImage,
    creditAlertPopup,
    setCreditAlertPopup,
    poList,
    handleOpenProceedPoModal,
    validationErrorModal,
    setValidationErrorModal,
    showCreateSetModal,
    setShowCreateSetModal,
    isProcurementRole,
    isProcurementHead,
    printPoModal,
    setPrintPoModal,
    newSetName,
    setNewSetName,
    newSetPrice,
    setNewSetPrice,
    newSetGstRate,
    setNewSetGstRate,
    newSetUnit,
    setNewSetUnit,
    handleCreateCustomSet,
    customAlert,
    setCustomAlert
  } = props;

  return (
    <>
      {/* CEO REJECTION MODAL */}
      {rejectingPo && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10005 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', width: '450px', padding: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#dc2626', color: 'white', fontSize: '12px', fontWeight: '800', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.15em' }}>
              REJECT PURCHASE ORDER
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Reject PO {rejectingPo.poNo}?</h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Vendor: <strong>{rejectingPo.vendor}</strong> | Amount: <strong>{rejectingPo.amount}</strong></span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                <label htmlFor="purchase-orders-rejection-reason-mandatory" style={{ fontSize: '11px', fontWeight: 'bold', color: '#dc2626' }}>Rejection Reason (Mandatory) *</label>
                <textarea id="purchase-orders-rejection-reason-mandatory" name="rejectionReasonMandatory" aria-label="Rejection Reason (Mandatory)"
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  placeholder="Enter detailed reason for rejecting this PO..."
                  style={{ height: '70px', borderRadius: '8px', border: '1.5px solid #fca5a5', padding: '8px 12px', fontSize: '12px', resize: 'none' }}
                 />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button onClick={() => { setRejectingPo(null); setRejectionReasonInput(''); }} style={{ border: 'none', backgroundColor: 'transparent', color: '#64748b', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => handleRejectPoSubmit(rejectingPo)} style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Confirm Rejection</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CEO APPROVAL & PAYMENT AUTHORIZATION MODAL */}
      {approvingPo && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10005 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', width: '500px', maxWidth: '92vw', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#16a34a', color: 'white', fontSize: '12px', fontWeight: '800', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.12em', gap: '8px' }}>
              <ShieldCheck size={16} /> CEO APPROVAL & PAYMENT AUTHORIZATION
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                  Approve PO {approvingPo.poNo || approvingPo.id}?
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Vendor: <strong style={{ color: '#0F172A' }}>{approvingPo.vendor}</strong> | Value: <strong style={{ color: '#0E7490' }}>{approvingPo.amount}</strong>
                </span>
              </div>

              {/* Informative Authorization Notice */}
              <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <CheckCircle size={18} style={{ color: '#16A34A', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '12px', color: '#166534', lineHeight: '1.45' }}>
                  <strong style={{ display: 'block', marginBottom: '2px' }}>CEO Authorization for Payment Release:</strong>
                  By approving this Purchase Order, you officially authorize Accounts to proceed with the payment clearance or credit terms release. Once approved, real-time alerts will notify Accounts and Procurement immediately.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="purchase-orders-approval-remarks-md" style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                  Approval Remarks / Instructions for Accounts (Optional)
                </label>
                <textarea
                  id="purchase-orders-approval-remarks-md"
                  name="approvalRemarksMD"
                  aria-label="Approval Remarks / Instructions for Accounts"
                  value={approvalRemarksInput}
                  onChange={(e) => setApprovalRemarksInput(e.target.value)}
                  placeholder="Enter approval notes or payment instructions..."
                  style={{ height: '65px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '12px', resize: 'none', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const target = approvingPo;
                    setApprovingPo(null);
                    setApprovalRemarksInput('');
                    setRejectingPo(target);
                  }}
                  style={{
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#DC2626',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <XCircle size={14} /> Reject PO
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => { setApprovingPo(null); setApprovalRemarksInput(''); }}
                    style={{ border: 'none', backgroundColor: 'transparent', color: '#64748B', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', padding: '8px 12px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprovePoSubmit(approvingPo)}
                    style={{
                      backgroundColor: '#16A34A',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 20px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)'
                    }}
                  >
                    <CheckCircle size={15} /> Approve PO & Authorize Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT PROCESS & CREDIT VERIFICATION MODAL (SUPPORTS UP TO 4 PROOF IMAGES) */}
      {paymentProcessingPo && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', width: '560px', maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#D97706', color: 'white', fontSize: '12px', fontWeight: '800', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.12em' }}>
              ACCOUNTS TEAM — PAYMENT & CREDIT PROCESS
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Process Payment / Verify Credit</h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>PO Ref: <strong>{paymentProcessingPo.poNo}</strong> | Vendor: <strong>{paymentProcessingPo.vendor}</strong></span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#92400E', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', padding: '4px 10px', borderRadius: '8px' }}>
                  {paymentProcessingPo.amount}
                </span>
              </div>

              {/* Mode Selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="purchase-orders-payment-settlement-mode" style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                  Payment / Settlement Mode <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  id="purchase-orders-payment-settlement-mode"
                  name="paymentSettlementMode"
                  aria-label="Payment / Settlement Mode"
                  value={payModeInput}
                  onChange={(e) => setPayModeInput(e.target.value)}
                  style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white' }}
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT / RTGS / IMPS)</option>
                  <option value="UPI / Online">UPI / Corporate Card</option>
                  <option value="Cheque / DD">Cheque / Demand Draft</option>
                  <option value="Credit / Net Terms">Credit Mode (Vendor Credit Period / Net Days)</option>
                  <option value="Advance 50% / Balance on Delivery">Partial Advance Payment</option>
                </select>
              </div>

              {/* Conditional Credit Fields vs Direct Payment Fields */}
              {payModeInput === 'Credit / Net Terms' ? (
                <div style={{ backgroundColor: '#FEF9C3', border: '1px solid #FDE047', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Info size={16} style={{ color: '#854D0E' }} />
                    <strong style={{ fontSize: '12px', color: '#854D0E' }}>Credit Verification Required</strong>
                  </div>
                  <p style={{ fontSize: '11px', color: '#713F12', margin: 0, lineHeight: 1.4 }}>
                    This PO will be marked as Credit Verified by Accounts. MD / CEO has authorized the PO, and once Accounts confirms credit terms, Procurement can Proceed PO for GRN.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                    <label htmlFor="purchase-orders-agreed-credit-terms" style={{ fontSize: '11px', fontWeight: 'bold', color: '#854D0E' }}>Agreed Credit Terms / Days</label>
                    <input
                      id="purchase-orders-agreed-credit-terms"
                      name="agreedCreditTerms"
                      aria-label="Agreed Credit Terms / Days"
                      type="text"
                      value={payCreditTermsInput}
                      onChange={(e) => setPayCreditTermsInput(e.target.value)}
                      placeholder="e.g. Net 30 Days, PDC 45 Days..."
                      style={{ height: '34px', borderRadius: '6px', border: '1px solid #FDE047', padding: '0 10px', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label htmlFor="purchase-orders-utr-ref" style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                      Transaction / UTR Reference No. <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      id="purchase-orders-utr-ref"
                      name="uTRReferenceNo"
                      aria-label="Transaction / UTR Reference No."
                      type="text"
                      value={payRefInput}
                      onChange={(e) => setPayRefInput(e.target.value)}
                      placeholder="e.g. UTR12345678"
                      style={{ height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '12px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label htmlFor="purchase-orders-amount-recorded" style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                      Amount Recorded (₹) <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      id="purchase-orders-amount-recorded"
                      name="amountRecorded"
                      aria-label="Amount Recorded (₹)"
                      type="text"
                      value={payAmountInput}
                      onChange={(e) => setPayAmountInput(e.target.value)}
                      placeholder="Amount"
                      style={{ height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '12px' }}
                    />
                  </div>
                </div>
              )}

              {/* Multi-Image Payment Proof Upload (Up to 4 Images) - Non-Credit modes */}
              {payModeInput !== 'Credit / Net Terms' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Payment Proof Images <span style={{ color: '#EF4444', fontWeight: 'bold' }}>* (Mandatory, max 4)</span>
                    </label>
                    <span style={{ fontSize: '11px', color: payImagesInput.length > 0 ? '#059669' : '#64748B', fontWeight: '700' }}>
                      {payImagesInput.length}/4 uploaded
                    </span>
                  </div>

                  {/* Uploaded Images Grid */}
                  {payImagesInput.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))', gap: '8px' }}>
                      {payImagesInput.map((imgObj, idx) => (
                        <div
                          key={idx}
                          style={{
                            border: '1px solid #86EFAC',
                            backgroundColor: '#F0FDF4',
                            borderRadius: '8px',
                            padding: '6px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            position: 'relative'
                          }}
                        >
                          <div
                            onClick={() => setPreviewZoomImage(imgObj)}
                            style={{ position: 'relative', width: '100%', height: '65px', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer', backgroundColor: '#E2E8F0' }}
                            title="Click to zoom preview"
                          >
                            <img
                              src={imgObj.dataUrl}
                              alt={imgObj.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <div style={{ position: 'absolute', bottom: '2px', right: '2px', backgroundColor: 'rgba(15, 23, 42, 0.7)', borderRadius: '3px', padding: '1px 3px', color: '#FFF' }}>
                              <Maximize2 size={10} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', color: '#166534', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75px' }}>
                              {imgObj.name || `Proof #${idx + 1}`}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemovePaymentImage(idx)}
                              style={{
                                background: '#FEE2E2',
                                border: 'none',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#DC2626',
                                cursor: 'pointer',
                                padding: 0
                              }}
                              title="Remove image"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Dropzone if less than 4 images */}
                  {payImagesInput.length < 4 && (
                    <label style={{
                      border: '2px dashed #CBD5E1',
                      borderRadius: '10px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      backgroundColor: '#F8FAFC',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0E7490'; e.currentTarget.style.backgroundColor = '#F0FDFA'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                    >
                      <UploadCloud size={20} style={{ color: '#0E7490' }} />
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#0E7490' }}>
                        {payImagesInput.length === 0 ? 'Click to upload Payment Screenshot / Receipt (up to 4)' : `+ Add Another Image (${4 - payImagesInput.length} remaining)`}
                      </span>
                      <span style={{ fontSize: '10.5px', color: '#64748B' }}>
                        PNG, JPG, JPEG (Auto-compressed to &lt;25 KB)
                      </span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handlePaymentImageUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="purchase-orders-pay-remarks-input" style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                  Accounts Verification Notes (Optional)
                </label>
                <textarea
                  id="purchase-orders-pay-remarks-input"
                  name="payRemarksInput"
                  aria-label="Accounts Verification Notes (Optional)"
                  value={payRemarksInput}
                  onChange={(e) => setPayRemarksInput(e.target.value)}
                  placeholder="Enter remarks or voucher details..."
                  style={{ height: '48px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 10px', fontSize: '12px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setPaymentProcessingPo(null)}
                  style={{ border: 'none', backgroundColor: 'transparent', color: '#64748b', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleProcessPaymentSubmit(paymentProcessingPo)}
                  style={{ backgroundColor: '#D97706', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Check size={14} /> {payModeInput === 'Credit / Net Terms' ? 'Confirm Credit Terms' : 'Record & Verify Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROCEED PO & VENDOR DISPATCH CONFIRMATION MODAL (STEP 4) */}
      {proceedingPo && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '16px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', width: '680px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#0E7490', color: 'white', fontSize: '12px', fontWeight: '800', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.12em', gap: '8px' }}>
              <Send size={15} /> PROCEED PO & VENDOR DISPATCH (PROCUREMENT)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Card 1: PO & Vendor Summary */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 16px' }}>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: '#0F172A', margin: 0 }}>
                    Proceed Purchase Order: {proceedingPo.poNo || proceedingPo.id}
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    Vendor: <strong style={{ color: '#0F172A' }}>{proceedingPo.vendor}</strong> | Date: <strong>{proceedingPo.date || new Date().toLocaleDateString('en-GB')}</strong>
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', display: 'block' }}>
                    {proceedingPo.amount}
                  </span>
                  <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: '700' }}>
                    ✓ CEO Approved
                  </span>
                </div>
              </div>

              {/* Card 2: Accounts Payment Clearance Details */}
              {(() => {
                const pd = proceedingPo.paymentDetails;
                const proofImages = Array.isArray(pd?.paymentImages) && pd.paymentImages.length > 0
                  ? pd.paymentImages
                  : (pd?.paymentImage ? [{ dataUrl: pd.paymentImage, name: pd.paymentImageMeta?.name || 'Payment_Proof.jpg', size: pd.paymentImageMeta?.size || '' }] : []);

                return (
                  <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '12px', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle size={15} style={{ color: '#16A34A' }} /> Accounts Payment Clearance Verified
                      </strong>
                      {pd?.date && (
                        <span style={{ fontSize: '10.5px', color: '#15803D', fontWeight: '700', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '6px' }}>
                          Verified on {pd.date} {pd.time}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', fontSize: '11.5px' }}>
                      <div>
                        <span style={{ color: '#4B5563', display: 'block', fontSize: '10.5px' }}>Payment Mode</span>
                        <strong style={{ color: '#111827' }}>{pd?.mode || 'Bank Transfer'}</strong>
                      </div>
                      {pd?.refNo && (
                        <div>
                          <span style={{ color: '#4B5563', display: 'block', fontSize: '10.5px' }}>Transaction / UTR Ref</span>
                          <strong style={{ color: '#0E7490' }}>{pd.refNo}</strong>
                        </div>
                      )}
                      <div>
                        <span style={{ color: '#4B5563', display: 'block', fontSize: '10.5px' }}>Amount Recorded</span>
                        <strong style={{ color: '#111827' }}>{pd?.amount || proceedingPo.amount}</strong>
                      </div>
                      {pd?.remarks && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={{ color: '#4B5563', display: 'block', fontSize: '10.5px' }}>Accounts Notes</span>
                          <span style={{ color: '#374151' }}>{pd.remarks}</span>
                        </div>
                      )}
                    </div>

                    {/* Payment Proof Images (Up to 4) with Lightbox Zoom */}
                    {proofImages.length > 0 && (
                      <div style={{ borderTop: '1px solid #DCFCE7', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Image size={13} /> Attached Payment Proof Receipts ({proofImages.length}):
                          </span>
                          <span style={{ fontSize: '10px', color: '#15803D' }}>Click any receipt to zoom preview</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
                          {proofImages.map((imgObj, idx) => (
                            <div
                              key={idx}
                              onClick={() => setPreviewZoomImage(imgObj)}
                              style={{
                                border: '1px solid #86EFAC',
                                borderRadius: '8px',
                                padding: '4px',
                                backgroundColor: '#FFFFFF',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0E7490'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#86EFAC'; e.currentTarget.style.transform = 'none'; }}
                            >
                              <div style={{ position: 'relative', width: '100%', height: '58px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#F1F5F9' }}>
                                <img
                                  src={imgObj.dataUrl || imgObj}
                                  alt={imgObj.name || `Proof ${idx + 1}`}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                <div style={{ position: 'absolute', bottom: '2px', right: '2px', backgroundColor: 'rgba(15, 23, 42, 0.7)', borderRadius: '3px', padding: '1px 3px', color: '#FFF' }}>
                                  <Maximize2 size={10} />
                                </div>
                              </div>
                              <span style={{ fontSize: '9.5px', fontWeight: '700', color: '#166534', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {imgObj.name || `Receipt #${idx + 1}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Card 3: Formatted Vendor Message Content (WhatsApp & Email Preview) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="purchase-orders-vendor-message-content" style={{ fontSize: '11px', fontWeight: 'bold', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MessageSquare size={13} style={{ color: '#0E7490' }} /> Vendor Message Preview (WhatsApp & Email Format)
                  </label>
                  <span style={{ fontSize: '10.5px', color: '#64748B' }}>Editable text</span>
                </div>
                <textarea
                  id="purchase-orders-vendor-message-content"
                  name="vendorMessageContent"
                  aria-label="Vendor Message Preview (WhatsApp & Email Format)"
                  value={proceedMessageContent}
                  onChange={(e) => setProceedMessageContent(e.target.value)}
                  style={{
                    height: '110px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '8px 10px',
                    fontSize: '11.5px',
                    fontFamily: 'monospace',
                    lineHeight: '1.4',
                    color: '#1E293B',
                    backgroundColor: '#F8FAFC',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Attached Images / Documents Preview */}
              {(() => {
                const pd = proceedingPo.paymentDetails;
                const modalImages = Array.isArray(pd?.paymentImages) && pd.paymentImages.length > 0
                  ? pd.paymentImages
                  : (pd?.paymentImage ? [{ dataUrl: pd.paymentImage, name: pd.paymentImageMeta?.name || 'Payment_Proof.jpg' }] : []);
                const modalAttachments = [
                  ...modalImages,
                  ...(Array.isArray(proceedingPo.attachments) ? proceedingPo.attachments : []),
                  ...(Array.isArray(proceedingPo.documents) ? proceedingPo.documents : [])
                ].filter(Boolean);
                if (modalAttachments.length === 0) return null;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                      Attachments ({modalAttachments.length}) — Preview & Download (WhatsApp links send text only; attach file in WhatsApp if needed)
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {modalAttachments.map((att, idx) => {
                        const src = att?.dataUrl || att?.url || att?.fileUrl || att?.previewUrl || '';
                        const attName = att?.name || att?.fileName || att?.title || `Attachment ${idx + 1}`;
                        const isImg = Boolean(src && (src.startsWith('data:image/') || /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(attName) || /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(src)));
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px' }}>
                            {isImg ? (
                              <img
                                src={src}
                                alt={attName}
                                onClick={() => setPreviewZoomImage({ dataUrl: src, name: attName })}
                                style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid #E2E8F0' }}
                                title="Click to preview"
                              />
                            ) : (
                              <FileText size={18} style={{ color: '#0E7490' }} />
                            )}
                            <span style={{ fontSize: '11px', fontWeight: '600', color: '#1E293B', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {attName}
                            </span>
                            {src && (
                              <a
                                href={src}
                                download={attName}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: '11px', fontWeight: '700', color: '#0E7490', textDecoration: 'none', padding: '3px 8px', backgroundColor: '#ECFEFF', borderRadius: '6px', border: '1px solid #A5F3FC' }}
                              >
                                Download
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Vendor Email & Phone Contact Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="purchase-orders-vendor-company-com" style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Mail size={13} style={{ color: '#0E7490' }} /> Vendor Email Address
                  </label>
                  <input
                    id="purchase-orders-vendor-company-com"
                    name="vendorCompanyCom"
                    aria-label="Vendor Email Address"
                    type="email"
                    value={proceedEmailInput}
                    onChange={(e) => setProceedEmailInput(e.target.value)}
                    placeholder="vendor@company.com"
                    style={{ height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '12px', color: '#1E293B', backgroundColor: '#FFFFFF' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="purchase-orders-vendor-phone-input" style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Phone size={13} style={{ color: '#16A34A' }} /> Vendor Mobile / WhatsApp No.
                  </label>
                  <input
                    id="purchase-orders-vendor-phone-input"
                    name="vendorPhoneInput"
                    aria-label="Vendor Mobile / WhatsApp No."
                    type="text"
                    value={proceedPhoneInput}
                    onChange={(e) => setProceedPhoneInput(e.target.value)}
                    placeholder="e.g. 9884720789"
                    style={{ height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '12px', color: '#1E293B', backgroundColor: '#FFFFFF' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="purchase-orders-proceed-remarks-input" style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                  Internal Dispatch Remarks (Optional)
                </label>
                <textarea
                  id="purchase-orders-proceed-remarks-input"
                  name="proceedRemarksInput"
                  aria-label="Internal Dispatch Remarks (Optional)"
                  value={proceedRemarksInput}
                  onChange={(e) => setProceedRemarksInput(e.target.value)}
                  placeholder="Enter dispatch notes, delivery gate instructions, etc..."
                  style={{ height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: '12px', resize: 'none' }}
                />
              </div>

              {/* Action Buttons: WhatsApp + Authorize Dispatch */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
                <button
                  type="button"
                  onClick={() => handleSendViaWhatsApp(proceedingPo)}
                  style={{
                    backgroundColor: '#25D366',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(37, 211, 102, 0.25)'
                  }}
                  title="Open WhatsApp Web / App with this message content"
                >
                  <MessageSquare size={14} /> Send via WhatsApp
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => { setProceedingPo(null); setProceedRemarksInput(''); setProceedEmailInput(''); setProceedPhoneInput(''); }}
                    style={{ border: 'none', backgroundColor: 'transparent', color: '#64748b', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', padding: '8px 14px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProceedPoSubmit(proceedingPo)}
                    style={{
                      backgroundColor: '#0E7490',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 20px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)'
                    }}
                  >
                    <Send size={14} /> Authorize & Send PO to Vendor
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN LIGHTBOX ZOOM MODAL FOR PAYMENT PROOF IMAGES */}
      {previewZoomImage && (
        <div 
          onClick={() => setPreviewZoomImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 11000,
            padding: '24px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '16px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '16px' }}>
              <strong style={{ fontSize: '14px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={16} style={{ color: '#0E7490' }} />
                {typeof previewZoomImage === 'object' ? previewZoomImage.name || 'Payment Proof Receipt' : 'Payment Proof Receipt'}
              </strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a
                  href={typeof previewZoomImage === 'object' ? previewZoomImage.dataUrl : previewZoomImage}
                  download={typeof previewZoomImage === 'object' ? previewZoomImage.name || 'payment_proof.jpg' : 'payment_proof.jpg'}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    backgroundColor: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: '#0E7490',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Download size={13} /> Download
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewZoomImage(null)}
                  style={{
                    background: '#F1F5F9',
                    border: 'none',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#475569'
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', maxHeight: '78vh' }}>
              <img
                src={typeof previewZoomImage === 'object' ? previewZoomImage.dataUrl : previewZoomImage}
                alt="Payment Proof Zoom"
                style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: '8px', border: '1px solid #E2E8F0' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* CREDIT CONFIRMATION NOTIFICATION POPUP */}
      {creditAlertPopup && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 10000, animation: 'slideInRight 0.3s ease-out' }}>
          <div style={{ backgroundColor: '#FFFFFF', border: '2px solid #F59E0B', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', width: '380px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
                  <AlertCircle size={16} />
                </div>
                <strong style={{ fontSize: '13px', color: '#92400E' }}>Credit Term Verified by Accounts</strong>
              </div>
              <button
                onClick={() => setCreditAlertPopup(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: 1.4 }}>
              PO <strong>{creditAlertPopup.poNo}</strong> ({creditAlertPopup.vendor}) is confirmed under <strong>{creditAlertPopup.terms}</strong>. CEO approval was verified, and accounts team has authorized credit terms.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              {isProcurementHead ? (
                <button
                  type="button"
                  onClick={() => {
                    const targetPo = poList.find(p => p.poNo === creditAlertPopup.poNo) || { poNo: creditAlertPopup.poNo, vendor: creditAlertPopup.vendor, amount: creditAlertPopup.amount };
                    setCreditAlertPopup(null);
                    handleOpenProceedPoModal(targetPo);
                  }}
                  style={{ backgroundColor: '#0E7490', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  Proceed PO Now <ArrowRight size={12} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreditAlertPopup(null)}
                  style={{ backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MANDATORY VALIDATION MODAL */}
      {validationErrorModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', width: '460px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444', flexShrink: 0 }}>
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', margin: 0 }}>Mandatory Fields Required</h3>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>Please complete all required fields to move forward.</p>
              </div>
            </div>
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>You did not fill out the following mandatory box(es):</span>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#DC2626', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {validationErrorModal.fields.map((field, idx) => (
                  <li key={idx}><strong>{field}</strong></li>
                ))}
              </ul>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                onClick={() => setValidationErrorModal(null)}
                style={{ backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)' }}
              >
                OK, I'll fill it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CREATE CUSTOM SET / KIT MODAL ─── */}
      {showCreateSetModal && !isProcurementRole && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              width: '460px',
              maxWidth: '92vw',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                    Create Custom Set / Kit
                  </h3>
                  <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                    Bundle products into a set for this Purchase Order
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateSetModal(false)}
                style={{ border: 'none', background: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCustomSet} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Set / Kit Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  placeholder="e.g. Custom 5kW Structure Set"
                  style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1.5px solid #CBD5E1', padding: '0 12px', fontSize: '13px', fontWeight: '600', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    UOM
                  </label>
                  <select
                    value={newSetUnit}
                    onChange={(e) => setNewSetUnit(e.target.value)}
                    style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1.5px solid #CBD5E1', padding: '0 10px', fontSize: '13px', fontWeight: '700', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF' }}
                  >
                    <option value="MT">MT</option>
                    <option value="KG">KG</option>
                    <option value="LG">LG</option>
                    <option value="NOS">NOS</option>
                    <option value="PCS">PCS</option>
                    <option value="MTR">MTR</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    GST Rate
                  </label>
                  <select
                    value={newSetGstRate}
                    onChange={(e) => setNewSetGstRate(e.target.value)}
                    style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1.5px solid #CBD5E1', padding: '0 10px', fontSize: '13px', fontWeight: '700', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF' }}
                  >
                    <option value="18%">18%</option>
                    <option value="12%">12%</option>
                    <option value="5%">5%</option>
                    <option value="0%">0%</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Pack Amt / Rate per {newSetUnit || 'Sets'} (₹) <span style={{ fontSize: '11px', fontWeight: '400', color: '#64748B' }}>(Optional, can set in table)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: '700', color: '#64748B' }}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={newSetPrice}
                    onChange={(e) => setNewSetPrice(e.target.value)}
                    placeholder={`Enter Pack Amount per 1 ${newSetUnit || 'Set'}`}
                    style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1.5px solid #CBD5E1', padding: '0 12px 0 28px', fontSize: '13px', fontWeight: '700', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateSetModal(false)}
                  style={{ padding: '9px 18px', borderRadius: '8px', backgroundColor: '#FFFFFF', color: '#475569', border: '1px solid #CBD5E1', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 20px', borderRadius: '8px', backgroundColor: '#7C3AED', color: '#FFFFFF', border: 'none', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(124, 58, 237, 0.3)' }}
                >
                  <Layers size={15} />
                  Create Set &amp; Add Items
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── OFFICIAL PO PRINTOUT / EXPORT PDF TEMPLATE ─── */}
      {printPoModal && (
        <VRMPurchaseOrderPrintTemplate
          po={printPoModal}
          onClose={() => setPrintPoModal(null)}
        />
      )}


    </>
  );
}
