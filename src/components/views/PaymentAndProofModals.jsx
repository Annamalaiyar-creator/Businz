import React, { useState, useEffect } from "react";
import {
  Eye, FileText, X, CheckCircle, RotateCcw,
  CreditCard, AlertCircle, Loader2, Clock, UploadCloud, Upload, Trash2
} from "lucide-react";
import { saveMediaToCache, stripDataUrlsFromRecord } from "../../utils/otherViewsShared";
import { saveCloudStore, saveCloudBomRow } from "../../utils/supabaseDataSync";
import { uploadBomDocumentFile } from "../../utils/bomStorageClient";
import { resolveDocumentUrl, resolveDocumentUrlAsync } from "../../utils/documentResolver";

export function UploadPaymentModal({ uploadPaymentModal, onClose, setBomStore }) {
  const [paymentProofFiles, setPaymentProofFiles] = useState([]);
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [paymentStageType, setPaymentStageType] = useState('100% Paid');
  const [balanceProofFile, setBalanceProofFile] = useState(null);
  const [balancePaidInput, setBalancePaidInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const grandTotal = Number(uploadPaymentModal.grandTotal || uploadPaymentModal.subTotal || 0);
  const partialAdvance = Number(uploadPaymentModal.partialAmount || 0);
  const recordedBalance = uploadPaymentModal.balanceAmount !== undefined && uploadPaymentModal.balanceAmount !== null ? Number(uploadPaymentModal.balanceAmount) : (uploadPaymentModal.paymentType === '100% Paid' ? 0 : Math.max(0, grandTotal - partialAdvance));
  const balancePaidSoFar = Number(uploadPaymentModal.balanceAmountPaid || 0);
  const currentOutstanding = Math.max(0, recordedBalance - balancePaidSoFar);

  const isEligibleForBalance = ['Partial Payment', 'Payment While Dispatch', 'Credit Payment', '50% Advance + 50% Dispatch', '50% Advance + 50% Before Dispatch', 'Net 30 Days'].includes(uploadPaymentModal.paymentType) ||
    (uploadPaymentModal.paymentType || '').toLowerCase().includes('partial') ||
    (uploadPaymentModal.paymentType || '').toLowerCase().includes('dispatch') ||
    (uploadPaymentModal.paymentType || '').toLowerCase().includes('credit') ||
    (uploadPaymentModal.paymentType || '').includes('50%');

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
          const proofData = resolveDocumentUrl(proofObj, uploadPaymentModal.bomCode) || (typeof proofObj === 'object' ? proofObj?.dataUrl : uploadPaymentModal.payments?.proofDocData);
          const isImage = proofData && (proofData.startsWith('data:image/') || /\.(jpe?g|png|webp|gif|svg)($|\?)/i.test(proofData) || /\.(jpe?g|png|webp|gif|svg)$/i.test(proofName || ''));

          const balanceDocObj = uploadPaymentModal.balancePaymentProofDoc || uploadPaymentModal.payments?.balanceProofDocObj;
          const hasBalanceDoc = Boolean(balanceDocObj || uploadPaymentModal.balanceProofDoc);
          const balanceDocName = typeof balanceDocObj === 'object' ? balanceDocObj?.name : (uploadPaymentModal.balanceProofDoc || balanceDocObj);
          const balanceDocData = resolveDocumentUrl(balanceDocObj, uploadPaymentModal.bomCode) || (typeof balanceDocObj === 'object' ? balanceDocObj?.dataUrl : null);
          const isBalanceImage = balanceDocData && (balanceDocData.startsWith('data:image/') || /\.(jpe?g|png|webp|gif|svg)($|\?)/i.test(balanceDocData) || /\.(jpe?g|png|webp|gif|svg)$/i.test(balanceDocName || ''));

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
                    <button
                      onClick={async () => {
                        const targetDoc = proofObj || { name: proofName, dataUrl: proofData };
                        const url = await resolveDocumentUrlAsync(targetDoc, uploadPaymentModal.bomCode);
                        if (url) {
                          window.open(url, '_blank');
                        } else {
                          alert('Unable to load document preview');
                        }
                      }}
                      style={{ fontSize: '12px', fontWeight: '700', color: '#2563EB', backgroundColor: '#EFF6FF', padding: '6px 12px', borderRadius: '8px', border: '1px solid #BFDBFE', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <Eye size={13} /> View File
                    </button>
                  </div>
                </div>
              ) : (
                /* IF NO PROOF DOCUMENT HAS BEEN UPLOADED YET */
                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F766E' }}>
                      Upload Payment Proof Document(s) & Slips (At least 4 images supported):
                    </span>
                    {paymentProofFiles.length >= 4 ? (
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
                        ✓ {paymentProofFiles.length} Images Selected (Target Met)
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#B45309', backgroundColor: '#FEF3C7', padding: '2px 8px', borderRadius: '10px', border: '1px solid #FDE68A' }}>
                        {paymentProofFiles.length} / 4 Images Selected
                      </span>
                    )}
                  </div>
                  <div>
                    <label htmlFor="payment-and-proof-modals-payment-stage" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Payment Stage</label>
                    <select id="payment-and-proof-modals-payment-stage" name="paymentStage" aria-label="Payment Stage"
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
                      ) : ((uploadPaymentModal.paymentType || '').includes('50%') || uploadPaymentModal.paymentType === '50% Advance + 50% Dispatch' || uploadPaymentModal.paymentType === '50% Advance + 50% Before Dispatch') ? (
                        <>
                          <option value="50% Advance">Stage 1: 50% Advance Payment</option>
                          <option value="50% Dispatch">Stage 2: 50% Dispatch Payment</option>
                        </>
                      ) : (
                        <option value="100% Paid">100% Full Payment</option>
                      )}
                    </select>
                  </div>

                  {/* Multi-Image Drag & Drop / File Browser */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        const newFiles = Array.from(e.dataTransfer.files);
                        setPaymentProofFiles(prev => [...prev, ...newFiles]);
                        if (!paymentProofFile && newFiles[0]) setPaymentProofFile(newFiles[0]);
                      }
                    }}
                    style={{
                      border: '2px dashed #0E7490',
                      backgroundColor: '#F0FDFA',
                      borderRadius: '12px',
                      padding: '16px',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <UploadCloud style={{ width: '28px', height: '28px', color: '#0E7490' }} />
                    <span style={{ fontSize: '12px', color: '#334155', fontWeight: '700' }}>
                      Drag & drop or select multiple payment proof images / bank slips
                    </span>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#0E7490', color: '#FFFFFF', padding: '8px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 2px 4px rgba(14,116,144,0.3)' }}>
                      <Upload style={{ width: '14px', height: '14px' }} />
                      {paymentProofFiles.length > 0 ? '+ Add More Images' : 'Browse Files (Multi-Select 4+ Images)'}
                      <input
                        id="payment-and-proof-modals-input-multi"
                        name="inputMulti"
                        aria-label="Select Payment Proof Attachments"
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            const newFiles = Array.from(e.target.files);
                            setPaymentProofFiles(prev => [...prev, ...newFiles]);
                            if (!paymentProofFile && newFiles[0]) setPaymentProofFile(newFiles[0]);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                    <span style={{ fontSize: '10.5px', color: '#64748B' }}>
                      Supported: JPG, PNG, WEBP, PDF (Attach 4 or more receipts, slips, or cheques)
                    </span>
                  </div>

                  {/* Previews of Selected Staged Files */}
                  {paymentProofFiles.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0E7490', display: 'block', marginBottom: '8px' }}>
                        Selected Images ({paymentProofFiles.length}):
                      </span>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
                        {paymentProofFiles.map((file, fIdx) => {
                          const isImg = file.type && file.type.startsWith('image/');
                          const previewUrl = isImg ? URL.createObjectURL(file) : null;
                          return (
                            <div key={fIdx} style={{ border: '1px solid #99F6E4', borderRadius: '8px', padding: '6px', backgroundColor: '#FFFFFF', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <div style={{ width: '100%', height: '65px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {isImg && previewUrl ? (
                                  <img src={previewUrl} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <FileText size={24} style={{ color: '#0E7490' }} />
                                )}
                              </div>
                              <span style={{ fontSize: '10px', fontWeight: '700', color: '#0F172A', width: '100%', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'center' }} title={file.name}>
                                {file.name}
                              </span>
                              <span style={{ fontSize: '9px', color: '#64748B' }}>
                                {(file.size / 1024).toFixed(0)} KB
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setPaymentProofFiles(prev => {
                                    const next = prev.filter((_, i) => i !== fIdx);
                                    if (next.length > 0) setPaymentProofFile(next[0]);
                                    else setPaymentProofFile(null);
                                    return next;
                                  });
                                }}
                                style={{ position: 'absolute', top: '2px', right: '2px', width: '18px', height: '18px', borderRadius: '50%', border: 'none', backgroundColor: '#EF4444', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                title="Remove image"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
                      {isBalanceImage ? (
                        <img src={balanceDocData} alt="Balance Proof" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #99F6E4' }} />
                      ) : (
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#CCFBF1', color: '#0F766E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={20} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0F172A', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {balanceDocName || 'Balance_Settlement_Proof.pdf'}
                        </div>
                        <span style={{ fontSize: '11px', color: '#0F766E', fontWeight: '700' }}>
                          Settled Amount: ₹{balancePaidSoFar.toLocaleString('en-IN', { minimumFractionDigits: 2 })} • Verified
                        </span>
                      </div>
                      <button
                        onClick={async () => {
                          const targetDoc = balanceDocObj || { name: balanceDocName, dataUrl: balanceDocData };
                          const url = await resolveDocumentUrlAsync(targetDoc, uploadPaymentModal.bomCode);
                          if (url) {
                            window.open(url, '_blank');
                          } else {
                            alert('Unable to load balance settlement document');
                          }
                        }}
                        style={{ fontSize: '12px', fontWeight: '800', color: '#0F766E', backgroundColor: '#CCFBF1', padding: '6px 12px', borderRadius: '8px', border: '1px solid #99F6E4', cursor: 'pointer' }}
                      >
                        View File
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: '10px', padding: '12px 14px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label htmlFor="payment-and-proof-modals-balance-amount-paid" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#0F766E', marginBottom: '4px' }}>
                            Balance Amount Paid (₹)
                          </label>
                          <input id="payment-and-proof-modals-balance-amount-paid" name="balanceAmountPaid" aria-label="Balance Amount Paid (₹)"
                            type="number"
                            min="0"
                            placeholder={String(currentOutstanding || '')}
                            value={balancePaidInput}
                            onChange={(e) => setBalancePaidInput(e.target.value)}
                            style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #5EEAD4', padding: '0 10px', fontSize: '12px', color: '#0F172A', outline: 'none', fontWeight: '700', boxSizing: 'border-box' }}
                           />
                        </div>
                        <div>
                          <label htmlFor="payment-and-proof-modals-attach-balance-proof" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#0F766E', marginBottom: '4px' }}>
                            Attach Balance Proof File
                          </label>
                          <input id="payment-and-proof-modals-attach-balance-proof" name="attachBalanceProof" aria-label="Attach Balance Proof File"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            disabled={isUploading}
                            onChange={(e) => {
                              const f = e.target.files && e.target.files[0];
                              if (f) {
                                setBalanceProofFile(f);
                              }
                            }}
                            style={{ width: '100%', fontSize: '11px', boxSizing: 'border-box' }}
                           />
                          {balanceProofFile && (
                            <span style={{ fontSize: '10px', color: '#0F766E', fontWeight: '700' }}>
                              Selected: {balanceProofFile.name} ({Math.round(balanceProofFile.size / 1024)} KB)
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        disabled={isUploading}
                        onClick={async () => {
                          if (!balanceProofFile) {
                            alert('Please select a file for balance payment proof!');
                            return;
                          }
                          try {
                            setIsUploading(true);
                            const bomCode = uploadPaymentModal.bomCode || uploadPaymentModal.id;
                            const metadata = await uploadBomDocumentFile({
                              file: balanceProofFile,
                              bomCode,
                              category: 'payment-proof'
                            });
                            const settledVal = parseFloat(balancePaidInput) || currentOutstanding;
                            setBomStore(prev => {
                              const updated = prev.map(b => {
                                if (b.bomCode !== bomCode && b.id !== bomCode) return b;
                                const wasPackedAwaitingProof = Boolean(
                                  b.awaitingSalesPaymentProof ||
                                  (typeof b.status === 'string' && b.status.toLowerCase().includes('awaiting sales payment proof')) ||
                                  b.packingStatus === 'PACKING_VERIFIED' ||
                                  b.dispatchPackingVerified
                                );
                                return {
                                  ...b,
                                  balancePaymentProofDoc: metadata,
                                  balanceProofDoc: metadata,
                                  balancePaymentProofDocs: [...(b.balancePaymentProofDocs || []), metadata],
                                  balanceAmountPaid: settledVal,
                                  balancePaidAt: new Date().toISOString(),
                                  status: wasPackedAwaitingProof ? 'Dispatch Packing Verified - Sent to Accounts' : (b.status || 'Pending Sales Confirmation'),
                                  readyForAccounts: wasPackedAwaitingProof ? true : b.readyForAccounts,
                                  awaitingSalesPaymentProof: false,
                                  pendingSalesDispatchPayment: false,
                                  accountsVerification: {
                                    ...(b.accountsVerification || {}),
                                    readyForAccounts: wasPackedAwaitingProof ? true : (b.accountsVerification?.readyForAccounts || false),
                                    balancePaymentProofDoc: metadata,
                                    paymentStatus: 'Payment Proof Attached'
                                  },
                                  payments: {
                                    ...b.payments,
                                    balanceSettled: true,
                                    balanceUploaded: true,
                                    balanceProofDoc: metadata.name,
                                    balanceProofDocObj: metadata,
                                    balanceAmountPaid: settledVal
                                  }
                                };
                              });
                              const targetBom = updated.find(x => x.bomCode === bomCode || x.id === bomCode);
                              if (targetBom) saveCloudBomRow(targetBom);
                              return updated;
                            });
                            onClose();
                            alert(`Balance settlement proof for (${bomCode}) uploaded to secure storage!`);
                          } catch (err) {
                            alert(`❌ Upload failed: ${err.message}`);
                          } finally {
                            setIsUploading(false);
                          }
                        }}
                        style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#0D9488', color: 'white', fontSize: '12px', fontWeight: '800', cursor: isUploading ? 'not-allowed' : 'pointer', alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {isUploading && <Loader2 size={12} className="animate-spin" />}
                        {isUploading ? 'Uploading to Storage...' : 'Record Balance Settlement'}
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
                disabled={isUploading}
                onClick={async () => {
                  const filesToUpload = paymentProofFiles.length > 0 ? paymentProofFiles : (paymentProofFile ? [paymentProofFile] : []);
                  if (filesToUpload.length === 0) {
                    alert('Please attach or select at least 1 payment proof image/file!');
                    return;
                  }
                  try {
                    setIsUploading(true);
                    const bomCode = uploadPaymentModal.bomCode || uploadPaymentModal.id;
                    const uploadedMetas = [];
                    for (const file of filesToUpload) {
                      const meta = await uploadBomDocumentFile({
                        file,
                        bomCode,
                        category: 'payment-proof'
                      });
                      if (meta) uploadedMetas.push(meta);
                    }
                    const primaryMeta = uploadedMetas[0] || null;
                    setBomStore(prev => {
                      const updated = prev.map(b => {
                        if (b.bomCode !== bomCode && b.id !== bomCode) return b;
                        const wasPackedAwaitingProof = Boolean(
                          b.awaitingSalesPaymentProof ||
                          (typeof b.status === 'string' && b.status.toLowerCase().includes('awaiting sales payment proof')) ||
                          b.packingStatus === 'PACKING_VERIFIED' ||
                          b.dispatchPackingVerified
                        );
                        return {
                          ...b,
                          status: wasPackedAwaitingProof ? 'Dispatch Packing Verified - Sent to Accounts' : (b.status || 'Pending Sales Confirmation'),
                          readyForAccounts: wasPackedAwaitingProof ? true : b.readyForAccounts,
                          awaitingSalesPaymentProof: false,
                          pendingSalesDispatchPayment: false,
                          paymentProofDoc: primaryMeta,
                          paymentProofDocs: [...(b.paymentProofDocs || []), ...uploadedMetas],
                          paymentDocs: [...(b.paymentDocs || []), ...uploadedMetas],
                          accountsVerification: {
                            ...(b.accountsVerification || {}),
                            readyForAccounts: wasPackedAwaitingProof ? true : (b.accountsVerification?.readyForAccounts || false),
                            paymentProofDoc: primaryMeta,
                            paymentProofDocs: [...(b.paymentProofDocs || []), ...uploadedMetas],
                            paymentStatus: 'Payment Proof Attached'
                          },
                          payments: {
                            ...b.payments,
                            proofDoc: primaryMeta?.name,
                            proofDocObj: primaryMeta,
                            paymentProofDocs: [...(b.payments?.paymentProofDocs || []), ...uploadedMetas],
                            dispatchPaymentUploaded: paymentStageType === 'Payment While Dispatch' || b.payments?.dispatchPaymentUploaded,
                            advance100Uploaded: paymentStageType === '100% Paid' || paymentStageType === '100% Advance',
                            advance50Uploaded: paymentStageType === '50% Advance' || paymentStageType === 'Partial Advance' || b.payments?.advance50Uploaded,
                            dispatch50Uploaded: paymentStageType === '50% Dispatch' || paymentStageType === 'Balance Payment' || paymentStageType === 'Payment While Dispatch' || b.payments?.dispatch50Uploaded,
                            net30Uploaded: paymentStageType === 'Credit Payment' || paymentStageType === 'Net 30 Days'
                          }
                        };
                      });
                      const targetBom = updated.find(x => x.bomCode === bomCode || x.id === bomCode);
                      if (targetBom) saveCloudBomRow(targetBom);
                      return updated;
                    });
                    onClose();
                    alert(`✅ ${uploadedMetas.length} payment proof image(s) for (${paymentStageType}) uploaded to secure storage!`);
                  } catch (err) {
                    alert(`❌ Upload failed: ${err.message}`);
                  } finally {
                    setIsUploading(false);
                  }
                }}
                style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#10B981', color: 'white', fontSize: '13px', fontWeight: '800', cursor: isUploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {isUploading && <Loader2 size={13} className="animate-spin" />}
                {isUploading ? 'Uploading to Storage...' : 'Record Payment'}
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
  const [isUploading, setIsUploading] = useState(false);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', maxWidth: '520px', width: '92%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard style={{ width: '20px', height: '20px' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Update & Record Payment</h3>
              <span style={{ fontSize: '12px', color: '#64748B' }}>{updatePaymentModal.bomCode} — {updatePaymentModal.customerName}</span>
            </div>
          </div>
          <button onClick={() => onClose()} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748B' }}>Payment Terms:</span>
            <strong style={{ color: '#0F172A' }}>{updatePaymentModal.paymentType}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748B' }}>Total Amount:</span>
            <strong style={{ color: '#059669', fontWeight: '800' }}>₹ {(updatePaymentModal.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>

        <div>
          <label htmlFor="payment-and-proof-modals-input-2" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
            Upload Payment Slip / Bank Receipt <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <input id="payment-and-proof-modals-input-2" name="input2" aria-label="Upload Payment Slip / Bank Receipt"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            disabled={isUploading}
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              if (f) {
                setUpdatePaymentFile(f);
              }
            }}
            style={{ width: '100%', padding: '10px', border: '1px dashed #CBD5E1', borderRadius: '8px', fontSize: '12px', boxSizing: 'border-box' }}
           />
          {updatePaymentFile && (
            <span style={{ fontSize: '11px', color: '#059669', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700' }}>
              <CheckCircle style={{ width: '12px', height: '12px' }} /> Selected: {updatePaymentFile.name} ({Math.round(updatePaymentFile.size / 1024)} KB)
            </span>
          )}
        </div>

        <div>
          <label htmlFor="payment-and-proof-modals-payment-reference-notes" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Payment Reference / Notes</label>
          <textarea id="payment-and-proof-modals-payment-reference-notes" name="paymentReferenceNotes" aria-label="Payment Reference / Notes"
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
            disabled={isUploading}
            style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            disabled={isUploading}
            onClick={async () => {
              if (!updatePaymentFile) {
                alert('Please select or upload payment slip file!');
                return;
              }
              try {
                setIsUploading(true);
                const bomCode = updatePaymentModal.bomCode || updatePaymentModal.id;
                const metadata = await uploadBomDocumentFile({
                  file: updatePaymentFile,
                  bomCode,
                  category: 'payment-proof'
                });
                const updatedDoc = {
                  ...metadata,
                  notes: updatePaymentNotes
                };
                setBomStore(prev => {
                  const updated = prev.map(b => (b.bomCode === bomCode || b.id === bomCode) ? {
                    ...b,
                    status: 'Payment Uploaded & Settled',
                    paymentUpdated: true,
                    paymentUpdatedDate: new Date().toISOString(),
                    paymentProofDoc: updatedDoc,
                    balancePaymentProofDoc: updatedDoc,
                    paymentProofDocName: metadata.name || b.paymentProofDocName,
                    payments: {
                      ...b.payments,
                      proofDoc: metadata.name,
                      proofDocObj: updatedDoc,
                      balanceProofDocObj: updatedDoc,
                      paymentUpdated: true
                    }
                  } : b);
                  const targetBom = updated.find(x => x.bomCode === bomCode || x.id === bomCode);
                  if (targetBom) {
                    saveCloudBomRow(targetBom).catch(console.error);
                    try {
                      fetch('/api/boms', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(targetBom)
                      }).catch(console.error);
                    } catch (_) {}
                  }
                  return updated;
                });
                onClose();
                alert(`Payment details for (${bomCode}) successfully recorded and locked in secure storage!`);
              } catch (err) {
                alert(`❌ Upload failed: ${err.message}`);
              } finally {
                setIsUploading(false);
              }
            }}
            style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#059669', color: 'white', fontSize: '13px', fontWeight: '800', cursor: isUploading ? 'not-allowed' : 'pointer', boxShadow: '0 2px 4px rgba(5,150,105,0.2)', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {isUploading && <Loader2 size={13} className="animate-spin" />}
            {isUploading ? 'Uploading to Storage...' : 'Record & Lock Payment Details'}
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
  const [isUploading, setIsUploading] = useState(false);

  const reqTime = reuploadAddressProofModal?.addressProofReuploadRequestedAt || reuploadAddressProofModal?.reuploadRequestedAt || reuploadAddressProofModal?.reissueRequestedAt;
  const [secondsRemaining, setSecondsRemaining] = useState(() => {
    if (!reqTime) return null;
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const diff = ONE_HOUR_MS - (Date.now() - new Date(reqTime).getTime());
    return Math.max(0, Math.floor(diff / 1000));
  });

  useEffect(() => {
    if (!reqTime) return;
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const tick = () => {
      const elapsed = Date.now() - new Date(reqTime).getTime();
      const left = Math.max(0, Math.floor((ONE_HOUR_MS - elapsed) / 1000));
      setSecondsRemaining(left);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [reqTime]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', maxWidth: '520px', width: '92%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RotateCcw style={{ width: '20px', height: '20px' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Re-upload Verified Address Proof</h3>
              <span style={{ fontSize: '12px', color: '#64748B' }}>Invoice Desk Reissue Request</span>
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
          {reqTime && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: '#DC2626', fontWeight: '700' }}>
              Requested on: {new Date(reqTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          )}
          {secondsRemaining !== null && (
            <div style={{
              marginTop: '10px',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: secondsRemaining > 300 ? '#FEE2E2' : '#7F1D1D',
              color: secondsRemaining > 300 ? '#991B1B' : '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontWeight: '800',
              fontSize: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={15} />
                <span>Time Remaining to Upload:</span>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                {Math.floor(secondsRemaining / 60)}m {String(secondsRemaining % 60).padStart(2, '0')}s
                {secondsRemaining === 0 ? ' (Time Expired - Invoice Cancelled)' : ''}
              </span>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="payment-and-proof-modals-input-3" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
            Select Verified Address Proof File (PDF / Image) <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <input id="payment-and-proof-modals-input-3" name="input3" aria-label="Select Verified Address Proof File (PDF / Image)"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            disabled={isUploading}
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              if (f) {
                setReuploadProofFile(f);
              }
            }}
            style={{ width: '100%', padding: '10px', border: '1px dashed #CBD5E1', borderRadius: '8px', fontSize: '12px', boxSizing: 'border-box' }}
           />
          {reuploadProofFile && (
            <span style={{ fontSize: '11px', color: '#166534', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700' }}>
              <CheckCircle style={{ width: '12px', height: '12px' }} /> Selected: {reuploadProofFile.name} ({Math.round(reuploadProofFile.size / 1024)} KB)
            </span>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
          <button
            onClick={() => onClose()}
            disabled={isUploading}
            style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            disabled={isUploading}
            onClick={async () => {
              if (!reuploadProofFile) {
                alert('Please select or upload the verified address proof file!');
                return;
              }
              try {
                setIsUploading(true);
                const targetCode = reuploadAddressProofModal.bomCode || reuploadAddressProofModal.id;
                const metadata = await uploadBomDocumentFile({
                  file: reuploadProofFile,
                  bomCode: targetCode,
                  category: 'delivery-proof'
                });
                const reuploadedTime = new Date().toISOString();

                setBomStore(prev => prev.map(b => (b.bomCode === targetCode || b.code === targetCode || b.id === targetCode) ? {
                  ...b,
                  status: 'Pending Verification for Invoice',
                  addressProofStatus: 'Pending Verification for Invoice',
                  deliveryAddressProofDoc: {
                    ...metadata,
                    history: [...((b.deliveryAddressProofDoc?.history) || (b.deliveryAddressProofDoc ? [b.deliveryAddressProofDoc] : [])), metadata]
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
                      ...metadata,
                      history: [...((i.deliveryAddressProofDoc?.history) || (i.deliveryAddressProofDoc ? [i.deliveryAddressProofDoc] : [])), metadata]
                    },
                    addressProofReuploadRequested: false,
                    addressProofReuploadedAt: reuploadedTime
                  } : i));
                }

                onClose();
                alert(`Verified address proof attached for BOM (${targetCode}) and synced with Invoice Desk!`);
              } catch (err) {
                alert(`❌ Upload failed: ${err.message}`);
              } finally {
                setIsUploading(false);
              }
            }}
            style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#2563EB', color: 'white', fontSize: '13px', fontWeight: '800', cursor: isUploading ? 'not-allowed' : 'pointer', boxShadow: '0 2px 4px rgba(37,99,235,0.2)', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {isUploading && <Loader2 size={13} className="animate-spin" />}
            {isUploading ? 'Uploading to Storage...' : 'Submit Verified Address Proof'}
          </button>
        </div>
      </div>
    </div>
  );
}
