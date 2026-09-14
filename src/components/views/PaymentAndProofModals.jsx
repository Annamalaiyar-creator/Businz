import React, { useState } from "react";
import {
  Eye, FileText, X, CheckCircle, RotateCcw,
  CreditCard, AlertCircle
} from "lucide-react";
import { saveMediaToCache, compressAndSaveFile, stripDataUrlsFromRecord } from "../../utils/otherViewsShared";
import { saveCloudStore } from "../../utils/supabaseDataSync";

export function UploadPaymentModal({ uploadPaymentModal, onClose, setBomStore }) {
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [paymentStageType, setPaymentStageType] = useState('100% Paid');
  const [balanceProofFile, setBalanceProofFile] = useState(null);
  const [balancePaidInput, setBalancePaidInput] = useState('');

  const grandTotal = Number(uploadPaymentModal.grandTotal || uploadPaymentModal.subTotal || 0);
  const partialAdvance = Number(uploadPaymentModal.partialAmount || 0);
  const recordedBalance = uploadPaymentModal.balanceAmount !== undefined && uploadPaymentModal.balanceAmount !== null ? Number(uploadPaymentModal.balanceAmount) : (uploadPaymentModal.paymentType === '100% Paid' ? 0 : Math.max(0, grandTotal - partialAdvance));
  const balancePaidSoFar = Number(uploadPaymentModal.balanceAmountPaid || 0);
  const currentOutstanding = Math.max(0, recordedBalance - balancePaidSoFar);

  const isEligibleForBalance = ['Partial Payment', 'Payment While Dispatch', 'Credit Payment', '50% Advance + 50% Dispatch', 'Net 30 Days'].includes(uploadPaymentModal.paymentType) ||
    (uploadPaymentModal.paymentType || '').toLowerCase().includes('partial') ||
    (uploadPaymentModal.paymentType || '').toLowerCase().includes('dispatch') ||
    (uploadPaymentModal.paymentType || '').toLowerCase().includes('credit');

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', maxWidth: '540px', width: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard style={{ width: '18px', height: '18px' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Payment Details & Proof</h3>
              <span style={{ fontSize: '12px', color: '#64748B' }}>{uploadPaymentModal.bomCode} — {uploadPaymentModal.paymentType || '100% Paid'}</span>
            </div>
          </div>
          <button onClick={() => onClose()} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {/* PAYMENT DETAILS SUMMARY CARD */}
        {(() => {
          const proofObj = uploadPaymentModal.paymentProofDoc || uploadPaymentModal.payments?.proofDocObj;
          const hasProof = Boolean(proofObj || uploadPaymentModal.payments?.proofDoc);
          const proofName = typeof proofObj === 'object' ? proofObj?.name : (uploadPaymentModal.payments?.proofDoc || proofObj);
          const proofData = typeof proofObj === 'object' ? proofObj?.dataUrl : uploadPaymentModal.payments?.proofDocData;
          const isImage = proofData && proofData.startsWith('data:image/');

          const balanceDocObj = uploadPaymentModal.balancePaymentProofDoc || uploadPaymentModal.payments?.balanceProofDocObj;
          const hasBalanceDoc = Boolean(balanceDocObj || uploadPaymentModal.balanceProofDoc);
          const balanceDocName = typeof balanceDocObj === 'object' ? balanceDocObj?.name : (uploadPaymentModal.balanceProofDoc || balanceDocObj);
          const balanceDocData = typeof balanceDocObj === 'object' ? balanceDocObj?.dataUrl : null;

          return (
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Payment Status</span>
                <span style={{ backgroundColor: (hasProof || hasBalanceDoc) ? '#DCFCE7' : '#FEF3C7', color: (hasProof || hasBalanceDoc) ? '#166534' : '#B45309', fontSize: '11px', fontWeight: '800', padding: '4px 12px', borderRadius: '12px', border: (hasProof || hasBalanceDoc) ? '1px solid #BBF7D0' : '1px solid #FDE68A' }}>
                  {hasBalanceDoc ? '✓ Fully Settled' : (hasProof ? '✓ Advance / Initial Proof Attached' : '• Pending Payment Upload')}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginBottom: '2px' }}>Customer Name</span>
                  <strong style={{ color: '#0F172A' }}>{uploadPaymentModal.customerName || uploadPaymentModal.companyName || '—'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginBottom: '2px' }}>Payment Terms</span>
                  <strong style={{ color: '#0F172A' }}>{uploadPaymentModal.paymentType || '100% Paid'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginBottom: '2px' }}>Grand Total Amount</span>
                  <strong style={{ color: '#059669', fontSize: '14px', fontWeight: '800' }}>
                    ₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginBottom: '2px' }}>Order Ref Code</span>
                  <strong style={{ color: '#0E7490' }}>{uploadPaymentModal.bomCode || '—'}</strong>
                </div>
                {uploadPaymentModal.paymentType === 'Partial Payment' && (
                  <>
                    <div style={{ backgroundColor: '#F0FDFA', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CCFBF1' }}>
                      <span style={{ color: '#0F766E', display: 'block', fontSize: '10px', fontWeight: '700' }}>Advance Recorded</span>
                      <strong style={{ color: '#0F766E', fontSize: '12px' }}>₹ {partialAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div style={{ backgroundColor: '#FFF7ED', padding: '8px 10px', borderRadius: '8px', border: '1px solid #FFEDD5' }}>
                      <span style={{ color: '#C2410C', display: 'block', fontSize: '10px', fontWeight: '700' }}>Remaining Balance</span>
                      <strong style={{ color: '#C2410C', fontSize: '12px' }}>₹ {currentOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </>
                )}
              </div>

              {/* UPLOADED ATTACHMENT DISPLAY */}
              {hasProof ? (
                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '8px' }}>Initial / Advance Proof Document:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '10px', padding: '12px 14px' }}>
                    {isImage ? (
                      <img src={proofData} alt="Proof" style={{ width: '46px', height: '46px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #E2E8F0' }} />
                    ) : (
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={20} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0F172A', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {proofName || 'Payment_Proof_Document.pdf'}
                      </div>
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>
                        {typeof proofObj === 'object' && proofObj?.size ? proofObj.size : 'Attached Document'} • Verified
                      </span>
                    </div>
                    {proofData ? (
                      <button
                        onClick={() => {
                          const win = window.open('');
                          if (win) {
                            if (proofData.startsWith('data:image/')) {
                              win.document.write(`<!DOCTYPE html><html><head><title>${proofName || 'Payment Proof'}</title></head><body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${proofData}" style="max-width:95vw;max-height:95vh;object-fit:contain;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);border-radius:12px;"/></body></html>`);
                            } else {
                              win.location.href = proofData;
                            }
                          }
                        }}
                        style={{ fontSize: '12px', fontWeight: '800', color: '#2563EB', backgroundColor: '#EFF6FF', padding: '6px 12px', borderRadius: '8px', border: '1px solid #BFDBFE', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                      >
                        <Eye size={13} /> View File
                      </button>
                    ) : (
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', backgroundColor: '#DCFCE7', padding: '4px 10px', borderRadius: '6px' }}>
                        Attached
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                /* IF NO PROOF DOCUMENT HAS BEEN UPLOADED YET */
                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#B45309' }}>Upload Payment Proof File:</span>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Payment Stage</label>
                    <select
                      value={paymentStageType}
                      onChange={(e) => setPaymentStageType(e.target.value)}
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12px', color: '#0F172A', outline: 'none' }}
                    >
                      {uploadPaymentModal.paymentType === 'Partial Payment' ? (
                        <>
                          <option value="Partial Advance">Stage 1: Advance Partial Payment</option>
                          <option value="Balance Payment">Stage 2: Balance Payment</option>
                        </>
                      ) : uploadPaymentModal.paymentType === 'Payment While Dispatch' ? (
                        <option value="Payment While Dispatch">Dispatch Settlement Payment</option>
                      ) : uploadPaymentModal.paymentType === 'Credit Payment' ? (
                        <option value="Credit Payment">Credit Invoice Settlement</option>
                      ) : uploadPaymentModal.paymentType === '50% Advance + 50% Dispatch' ? (
                        <>
                          <option value="50% Advance">Stage 1: 50% Advance Payment</option>
                          <option value="50% Dispatch">Stage 2: 50% Dispatch Payment</option>
                        </>
                      ) : (
                        <option value="100% Paid">100% Full Payment</option>
                      )}
                    </select>
                  </div>

                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => {
                      const f = e.target.files && e.target.files[0];
                      if (f) {
                        const reader = new FileReader();
                        reader.onload = (loadEvt) => {
                          setPaymentProofFile({
                            name: f.name,
                            size: `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
                            dataUrl: loadEvt.target.result,
                            uploadedAt: new Date().toISOString()
                          });
                        };
                        reader.readAsDataURL(f);
                      }
                    }}
                    style={{ width: '100%', padding: '10px', border: '1px dashed #CBD5E1', borderRadius: '8px', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              {/* DEDICATED BALANCE PAYMENT SECTION FOR THE 3 CATEGORIES */}
              {isEligibleForBalance && (
                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '14px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F766E' }}>
                      Balance Payment / Settlement:
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: hasBalanceDoc ? '#166534' : '#B45309', backgroundColor: hasBalanceDoc ? '#DCFCE7' : '#FEF3C7', padding: '2px 8px', borderRadius: '6px' }}>
                      {hasBalanceDoc ? '✓ Balance Settled' : `Outstanding: ₹${currentOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                    </span>
                  </div>

                  {hasBalanceDoc ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: '10px', padding: '12px 14px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#CCFBF1', color: '#0F766E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={20} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0F172A', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {balanceDocName || 'Balance_Settlement_Proof.pdf'}
                        </div>
                        <span style={{ fontSize: '11px', color: '#0F766E', fontWeight: '700' }}>
                          Settled Amount: ₹{balancePaidSoFar.toLocaleString('en-IN', { minimumFractionDigits: 2 })} • Verified
                        </span>
                      </div>
                      {balanceDocData && (
                        <button
                          onClick={() => {
                            const win = window.open('');
                            if (win) {
                              if (balanceDocData.startsWith('data:image/')) {
                                win.document.write(`<!DOCTYPE html><html><body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${balanceDocData}" style="max-width:95vw;max-height:95vh;object-fit:contain;border-radius:12px;"/></body></html>`);
                              } else {
                                win.location.href = balanceDocData;
                              }
                            }
                          }}
                          style={{ fontSize: '12px', fontWeight: '800', color: '#0F766E', backgroundColor: '#CCFBF1', padding: '6px 12px', borderRadius: '8px', border: '1px solid #99F6E4', cursor: 'pointer' }}
                        >
                          View File
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: '10px', padding: '12px 14px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#0F766E', marginBottom: '4px' }}>
                            Balance Amount Paid (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder={String(currentOutstanding || '')}
                            value={balancePaidInput}
                            onChange={(e) => setBalancePaidInput(e.target.value)}
                            style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #5EEAD4', padding: '0 10px', fontSize: '12px', color: '#0F172A', outline: 'none', fontWeight: '700', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#0F766E', marginBottom: '4px' }}>
                            Attach Balance Proof File
                          </label>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={(e) => {
                              const f = e.target.files && e.target.files[0];
                              if (f) {
                                const reader = new FileReader();
                                reader.onload = (loadEvt) => {
                                  setBalanceProofFile({
                                    name: f.name,
                                    size: `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
                                    dataUrl: loadEvt.target.result,
                                    uploadedAt: new Date().toISOString()
                                  });
                                };
                                reader.readAsDataURL(f);
                              }
                            }}
                            style={{ width: '100%', fontSize: '11px', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (!balanceProofFile) {
                            alert('Please select a file for balance payment proof!');
                            return;
                          }
                          const settledVal = parseFloat(balancePaidInput) || currentOutstanding;
                          const bDocObj = typeof balanceProofFile === 'object' ? balanceProofFile : { name: balanceProofFile, dataUrl: null };
                          setBomStore(prev => {
                            const updated = prev.map(b => b.bomCode === uploadPaymentModal.bomCode ? {
                              ...b,
                              balancePaymentProofDoc: bDocObj,
                              balanceAmountPaid: settledVal,
                              balancePaidAt: new Date().toISOString(),
                              status: 'Payment Completed & Verified',
                              payments: {
                                ...b.payments,
                                balanceSettled: true,
                                balanceProofDoc: bDocObj.name,
                                balanceProofDocObj: bDocObj,
                                balanceAmountPaid: settledVal
                              }
                            } : b);
                            saveCloudStore('bom_store', updated);
                            return updated;
                          });
                          onClose();
                          alert(`✅ Balance payment of ₹${settledVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} recorded and verified successfully!`);
                        }}
                        style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#0D9488', color: 'white', fontSize: '12px', fontWeight: '800', cursor: 'pointer', alignSelf: 'flex-end' }}
                      >
                        Record Balance Settlement
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
          {!(uploadPaymentModal.paymentProofDoc || uploadPaymentModal.payments?.proofDocObj || uploadPaymentModal.payments?.proofDoc) ? (
            <>
              <button
                onClick={() => onClose()}
                style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!paymentProofFile) {
                    alert('Please attach or select payment proof file!');
                    return;
                  }
                  const pDocObj = typeof paymentProofFile === 'object' ? paymentProofFile : { name: paymentProofFile, dataUrl: null };
                  setBomStore(prev => {
                    const updated = prev.map(b => b.bomCode === uploadPaymentModal.bomCode ? {
                      ...b,
                      status: 'Payment Uploaded & Verified',
                      paymentProofDoc: pDocObj,
                      payments: {
                        ...b.payments,
                        proofDoc: pDocObj.name,
                        proofDocObj: pDocObj,
                        proofDocData: pDocObj.dataUrl,
                        advance100Uploaded: paymentStageType === '100% Paid' || paymentStageType === '100% Advance',
                        advance50Uploaded: paymentStageType === '50% Advance' || paymentStageType === 'Partial Advance' || b.payments?.advance50Uploaded,
                        dispatch50Uploaded: paymentStageType === '50% Dispatch' || paymentStageType === 'Balance Payment' || b.payments?.dispatch50Uploaded,
                        net30Uploaded: paymentStageType === 'Credit Payment' || paymentStageType === 'Net 30 Days'
                      }
                    } : b);
                    saveCloudStore('bom_store', updated);
                    return updated;
                  });
                  onClose();
                  alert(`✅ Payment details for (${paymentStageType}) uploaded and recorded successfully!`);
                }}
                style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#10B981', color: 'white', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}
              >
                Record Payment
              </button>
            </>
          ) : (
            <button
              onClick={() => onClose()}
              style={{ padding: '9px 22px', borderRadius: '8px', border: 'none', backgroundColor: '#2563EB', color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
            >
              Close Details
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function UpdatePaymentModal({
  updatePaymentModal, onClose, setBomStore
}) {
  const [updatePaymentFile, setUpdatePaymentFile] = useState(null);
  const [updatePaymentNotes, setUpdatePaymentNotes] = useState('');

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', maxWidth: '520px', width: '92%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard style={{ width: '20px', height: '20px' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Update Payment Details</h3>
              <span style={{ fontSize: '12px', color: '#64748B' }}>{updatePaymentModal.bomCode} — {updatePaymentModal.paymentType}</span>
            </div>
          </div>
          <button onClick={() => onClose()} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#166534', lineHeight: '1.4' }}>
          <div><strong>Customer:</strong> {updatePaymentModal.customerName}</div>
          <div><strong>Order Total:</strong> ₹{parseFloat(updatePaymentModal.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          {updatePaymentModal.creditDays && (
            <div style={{ marginTop: '4px', color: '#6D28D9' }}>
              <strong>Credit Term:</strong> {updatePaymentModal.creditDays} Days (Due: {updatePaymentModal.creditDueDate || 'Within 7 Days'})
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
            Upload Payment Slip / Bank Receipt <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              if (f) {
                compressAndSaveFile(f, (res) => {
                  if (res) {
                    if (res.name && res.dataUrl) saveMediaToCache(res.name, res.dataUrl);
                    setUpdatePaymentFile(res);
                  }
                });
              }
            }}
            style={{ width: '100%', padding: '10px', border: '1px dashed #CBD5E1', borderRadius: '8px', fontSize: '12px', boxSizing: 'border-box' }}
          />
          {updatePaymentFile && (
            <span style={{ fontSize: '11px', color: '#059669', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700' }}>
              <CheckCircle style={{ width: '12px', height: '12px' }} /> Selected: {updatePaymentFile.name} ({updatePaymentFile.size})
            </span>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Payment Reference / Notes</label>
          <textarea
            rows={2}
            value={updatePaymentNotes}
            onChange={(e) => setUpdatePaymentNotes(e.target.value)}
            placeholder="Enter transaction UTR / receipt reference (optional)..."
            style={{ width: '100%', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '10px', fontSize: '12px', boxSizing: 'border-box', outline: 'none', resize: 'vertical' }}
          />
        </div>

        <div style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 12px', fontSize: '11px', color: '#92400E', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <AlertCircle style={{ width: '14px', height: '14px', flexShrink: 0 }} />
          <span><strong>Permanent Lock:</strong> Once updated, payment details cannot be re-updated. The menu option will be locked permanently.</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
          <button
            onClick={() => onClose()}
            style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!updatePaymentFile) {
                alert('Please select or upload payment slip file!');
                return;
              }
              const updatedDoc = {
                name: updatePaymentFile.name,
                size: updatePaymentFile.size || `${(updatePaymentFile.size / (1024 * 1024)).toFixed(2)} MB`,
                type: updatePaymentFile.type,
                dataUrl: updatePaymentFile.dataUrl || null,
                uploadedAt: new Date().toISOString(),
                notes: updatePaymentNotes
              };
              if (updatedDoc.name && updatedDoc.dataUrl) {
                saveMediaToCache(updatedDoc.name, updatedDoc.dataUrl);
              }
              setBomStore(prev => prev.map(b => b.bomCode === updatePaymentModal.bomCode ? {
                ...b,
                status: 'Payment Uploaded & Settled',
                paymentUpdated: true,
                paymentUpdatedDate: new Date().toISOString(),
                paymentProofDoc: updatedDoc,
                payments: {
                  ...b.payments,
                  proofDoc: updatePaymentFile.name,
                  proofDocObj: updatedDoc,
                  proofDocData: updatedDoc.dataUrl,
                  paymentUpdated: true
                }
              } : b));
              onClose();
              alert(`✅ Payment details for (${updatePaymentModal.bomCode}) successfully recorded and locked!`);
            }}
            style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#059669', color: 'white', fontSize: '13px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 2px 4px rgba(5,150,105,0.2)' }}
          >
            Record & Lock Payment Details
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReuploadAddressProofModal({
  reuploadAddressProofModal, onClose, setBomStore, setInvoiceList
}) {
  const [reuploadProofFile, setReuploadProofFile] = useState(null);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', maxWidth: '520px', width: '92%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RotateCcw style={{ width: '20px', height: '20px' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Re-upload Address Proof</h3>
              <span style={{ fontSize: '12px', color: '#DC2626', fontWeight: '700' }}>Invoice Desk Action Required</span>
            </div>
          </div>
          <button onClick={() => onClose()} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#991B1B', lineHeight: '1.5' }}>
          <div><strong>BOM Reference:</strong> {reuploadAddressProofModal.bomCode}</div>
          <div><strong>Customer:</strong> {reuploadAddressProofModal.customerName}</div>
          <div><strong>Delivery Destination:</strong> {reuploadAddressProofModal.deliveryAddress}</div>
          {reuploadAddressProofModal.reuploadRequestedAt && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: '#DC2626', fontWeight: '800' }}>
              Requested on: {new Date(reuploadAddressProofModal.reuploadRequestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
            Select Verified Address Proof File (PDF / Image) <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              if (f) {
                compressAndSaveFile(f, (res) => {
                  if (res) {
                    setReuploadProofFile(res);
                  }
                });
              }
            }}
            style={{ width: '100%', padding: '10px', border: '1px dashed #CBD5E1', borderRadius: '8px', fontSize: '12px', boxSizing: 'border-box' }}
          />
          {reuploadProofFile && (
            <span style={{ fontSize: '11px', color: '#166534', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700' }}>
              <CheckCircle style={{ width: '12px', height: '12px' }} /> Selected: {reuploadProofFile.name} ({reuploadProofFile.size})
            </span>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
          <button
            onClick={() => onClose()}
            style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!reuploadProofFile) {
                alert('Please select or upload the verified address proof file!');
                return;
              }
              const targetCode = reuploadAddressProofModal.bomCode;
              const reuploadedTime = new Date().toISOString();
              const newDoc = {
                name: reuploadProofFile.name,
                size: reuploadProofFile.size,
                type: reuploadProofFile.type,
                dataUrl: reuploadProofFile.dataUrl,
                uploadedAt: reuploadedTime
              };
              if (newDoc.name && newDoc.dataUrl) {
                saveMediaToCache(newDoc.name, newDoc.dataUrl);
              }

              setBomStore(prev => prev.map(b => (b.bomCode === targetCode || b.code === targetCode) ? {
                ...b,
                status: 'Pending Verification for Invoice',
                addressProofStatus: 'Pending Verification for Invoice',
                deliveryAddressProofDoc: {
                  ...newDoc,
                  history: [...((b.deliveryAddressProofDoc?.history) || (b.deliveryAddressProofDoc ? [b.deliveryAddressProofDoc] : [])), newDoc]
                },
                addressProofReuploadRequested: false,
                addressProofReuploaded: true,
                addressProofReuploadedAt: reuploadedTime
              } : b));

              if (typeof setInvoiceList === 'function') {
                setInvoiceList(prev => prev.map(i => (i.poNo === targetCode || i.invNo === targetCode || i.code === targetCode) ? {
                  ...i,
                  status: 'Pending Address Proof',
                  addressProofStatus: 'Pending Verification for Invoice',
                  deliveryAddressProofDoc: {
                    ...newDoc,
                    history: [...((i.deliveryAddressProofDoc?.history) || (i.deliveryAddressProofDoc ? [i.deliveryAddressProofDoc] : [])), newDoc]
                  },
                  addressProofReuploadRequested: false,
                  addressProofReuploadedAt: reuploadedTime
                } : i));
              }

              onClose();
              alert(`✅ Verified address proof attached for BOM (${targetCode}) and synced with Invoice Desk!`);
            }}
            style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#2563EB', color: 'white', fontSize: '13px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}
          >
            Submit Verified Address Proof
          </button>
        </div>
      </div>
    </div>
  );
}
