import React from 'react';
import { FileText, UploadCloud, Loader2, Trash2 } from 'lucide-react';
import { TERMS_PRESETS } from './poConstants';

export default function PoCalculationsAndNotesSection(props) {
  const {
    discountPct,
    setDiscountPct,
    shippingCharges,
    setShippingCharges,
    otherCharges,
    setOtherCharges,
    taxType,
    getSubTotal,
    getDiscountAmount,
    getEffectiveCGSTPct,
    getCGST,
    getEffectiveSGSTPct,
    getSGST,
    getEffectiveIGSTPct,
    getIGST,
    getGrandTotal,
    notes,
    setNotes,
    terms,
    setTerms,
    useDefaultTerms,
    setUseDefaultTerms,
    selectedTermsPreset,
    setSelectedTermsPreset,
    attachedFiles,
    setAttachedFiles,
    isUploading,
    uploadProgress
  } = props;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>

                {/* Notes & Terms */}
                <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                      4
                    </div>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      NOTES &amp; TERMS
                    </h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="purchase-orders-notes-remarks" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Notes & Remarks</label>
                    <textarea id="purchase-orders-notes-remarks" name="notesRemarks" aria-label="Notes & Remarks" value={notes} onChange={(e) => setNotes(e.target.value)} rows="3" placeholder="Add remarks for internal reference..." style={{ borderRadius: '8px', border: '1px solid #cbd5e1', padding: '10px 12px', fontSize: '13px', fontFamily: 'inherit', resize: 'none' }}  />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Terms & Conditions</label>
                      <span style={{ fontSize: '10px', color: '#94A3B8' }}>Select a preset to auto-fill</span>
                    </div>

                    {/* Clean Preset Pill Buttons */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTermsPreset('');
                          setTerms('');
                        }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: selectedTermsPreset === '' ? '1px dashed #64748B' : '1px solid #CBD5E1',
                          backgroundColor: selectedTermsPreset === '' ? '#F1F5F9' : '#FFFFFF',
                          color: selectedTermsPreset === '' ? '#0F172A' : '#64748B',
                          fontSize: '11px',
                          fontWeight: selectedTermsPreset === '' ? '600' : '500',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Clear / Custom
                      </button>
                      {TERMS_PRESETS.map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => {
                            setSelectedTermsPreset(p.key);
                            setTerms(p.text);
                          }}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '6px',
                            border: selectedTermsPreset === p.key ? '1px solid #2563EB' : '1px solid #CBD5E1',
                            backgroundColor: selectedTermsPreset === p.key ? '#2563EB' : '#FFFFFF',
                            color: selectedTermsPreset === p.key ? '#FFFFFF' : '#475569',
                            fontSize: '11px',
                            fontWeight: selectedTermsPreset === p.key ? '600' : '500',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <textarea id="purchase-orders-terms" name="terms" aria-label="Select a preset above or type custom Terms & Conditions"
                      value={terms}
                      onChange={(e) => setTerms(e.target.value)}
                      rows="6"
                      placeholder="Select a preset above or type custom Terms & Conditions..."
                      style={{ borderRadius: '8px', border: '1px solid #cbd5e1', padding: '10px 12px', fontSize: '12px', fontFamily: 'inherit', resize: 'vertical', minHeight: '130px', backgroundColor: '#FFFFFF' }}
                     />
                  </div>
                </div>

                {/* Calculations Summary */}
                <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                      5
                    </div>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      SUMMARY DETAILS
                    </h3>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#64748b' }}>Subtotal</span>
                    <strong style={{ color: '#334155' }}>₹ {getSubTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: '#64748b' }}>Discount (%)</span>
                    <input id="purchase-orders-discount-pct" name="discountPct" aria-label="DiscountPct" type="number" value={discountPct} onChange={(e) => setDiscountPct(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '60px', height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', textAlign: 'right', fontSize: '12px' }}  />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#64748b' }}>CGST ({getEffectiveCGSTPct()}%)</span>
                    <strong style={{ color: '#334155' }}>₹ {getCGST().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#64748b' }}>SGST ({getEffectiveSGSTPct()}%)</span>
                    <strong style={{ color: '#334155' }}>₹ {getSGST().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: '#64748b' }}>Shipping Charges (₹)</span>
                    <input id="purchase-orders-shipping-charges" name="shippingCharges" aria-label="ShippingCharges" type="number" value={shippingCharges} onChange={(e) => setShippingCharges(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '100px', height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', textAlign: 'right', fontSize: '12px' }}  />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: '#64748b' }}>Other Charges (₹)</span>
                    <input id="purchase-orders-other-charges" name="otherCharges" aria-label="OtherCharges" type="number" value={otherCharges} onChange={(e) => setOtherCharges(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '100px', height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', textAlign: 'right', fontSize: '12px' }}  />
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '4px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>Grand Total</strong>
                    <strong style={{ fontSize: '15px', color: '#2563eb' }}>
                      ₹{getGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>

                </div>

              </div>
  );
}
