import React from 'react';
import { ArrowLeft, Check, FileText, Filter, Phone, Printer, ShieldCheck, Target, X } from 'lucide-react';
import StatusBadge from '../StatusBadge';
import { getCompanyProfile } from '../purchaseOrders/poConstants';

export default function GrnPoDetailModal({
  showPoModal,
  setShowPoModal,
  selectedPoData,
  selectedGRNPo,
  selectedGRNVendor,
  previousGrnForBack,
  setPreviousGrnForBack,
  setShowCeoGrnModal,
  grnItems = [],
  vendorList = [],
  handleBackToGrn
}) {
  if (!showPoModal) return null;
  return (
            <div
          className="po-details-modal-overlay"
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
            zIndex: 10000,
            padding: '20px',
            boxSizing: 'border-box'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPoModal(false);
            }
          }}
        >
          {(() => {
            const poNumber = selectedPoData?.poNo || selectedPoData?.id || selectedGRNPo || 'PO-00000';
            const poStatus = selectedPoData?.status || 'Open / Active';
            const vendorName = selectedPoData?.vendor || selectedPoData?.vendorName || selectedGRNVendor || '—';
            const poDate = selectedPoData?.date || selectedPoData?.poDate || '—';
            const expectedDelivery = selectedPoData?.expectedDelivery || selectedPoData?.expected_delivery_date || selectedPoData?.deliveryDate || '—';
            const paymentTerms = selectedPoData?.paymentTerms || selectedPoData?.payment_terms || 'Net 30 Days';
            const purchaser = selectedPoData?.purchaser || selectedPoData?.createdBy || selectedPoData?.buyer || '—';
            const priority = selectedPoData?.priority || 'High';
            const approvalRequired = selectedPoData?.approvalRequired || '';
            const approver = selectedPoData?.approver || 'Velmurugan Rathinam (MD)';
            const scope = selectedPoData?.scope || '';

            // Find vendor profile in vendorList for extra address / contact details if missing
            const matchedVendor = (vendorList || []).find(v => {
              const vn = (v.name || v.vendorName || '').toLowerCase().trim();
              const tn = String(vendorName).toLowerCase().trim();
              return vn && tn && (vn === tn || vn.includes(tn) || tn.includes(vn));
            });

            const branch = selectedPoData?.branch || matchedVendor?.branch || '';
            const contactPerson = selectedPoData?.contactPerson || selectedPoData?.contact_person || matchedVendor?.contactPerson || matchedVendor?.contact_person || '';
            const contactNo = selectedPoData?.contactNo || selectedPoData?.phone || matchedVendor?.phone || matchedVendor?.contactNo || '';
            const email = selectedPoData?.email || selectedPoData?.vendorEmail || matchedVendor?.email || '';
            const gstNo = selectedPoData?.gstNo || selectedPoData?.vendorGst || matchedVendor?.gstNo || matchedVendor?.gst || '';
            const billingAddress = selectedPoData?.billingAddress || selectedPoData?.billing_address || matchedVendor?.billingAddress || matchedVendor?.address || 'Chennai, Tamil Nadu, India';
            const deliveryAddress = selectedPoData?.deliveryAddress || selectedPoData?.delivery_address || 'VRM Structures India Pvt Ltd, Madhavaram, Chennai';
            const notes = selectedPoData?.notes || '';
            const terms = selectedPoData?.terms || '';

            // Company Profile
            const effLocation = selectedPoData?.companyLocation || selectedPoData?.branch || 'VRM Structures India Pvt Ltd';
            const comp = typeof getCompanyProfile === 'function' ? getCompanyProfile(effLocation) : {
              name: 'VRM Structures India Pvt Ltd',
              address: '1427, GNT Road, Nagappa Industrial Estate, Madhavaram, Chennai, Tamil Nadu - 600066',
              gst: '33AAGCV4262N1ZZ',
              email: 'contact@vrmstructures.com',
              phone: '+91 98847 20789'
            };

            // Items Mapping
            const items = (Array.isArray(selectedPoData?.items) && selectedPoData.items.length > 0)
              ? selectedPoData.items.map(it => ({
                  name: it.name || it.item_name || 'Material Item',
                  description: it.description || it.desc || '',
                  account: it.account || 'Raw Material',
                  qty: Number(it.qty !== undefined ? it.qty : (it.quantity || it.ordered || 1)),
                  unit: it.unit || it.uom || 'NOS',
                  rate: Number(it.rate !== undefined ? it.rate : (it.item_rate !== undefined ? it.item_rate : (it.price || 0))),
                  tax: (it.tax !== undefined && it.tax !== '' && !isNaN(Number(it.tax))) ? Number(it.tax) : 18
                }))
              : (Array.isArray(grnItems) && grnItems.length > 0)
              ? grnItems.map(it => ({
                  name: it.name || 'Material Item',
                  description: it.desc || '',
                  account: 'Raw Material',
                  qty: Number(it.ordered || it.quantity || 1),
                  unit: it.uom || 'NOS',
                  rate: Number(it.rate || 0),
                  tax: 18
                }))
              : [];

            const discountPct = Number(selectedPoData?.discountPct || selectedPoData?.discount || 0);
            const shippingCharges = Number(selectedPoData?.shippingCharges || 0);
            const otherCharges = Number(selectedPoData?.otherCharges || 0);

            // Calculations
            const subTotal = items.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.rate || 0)), 0);
            const discountAmount = subTotal * (discountPct / 100);
            const taxableAmount = subTotal - discountAmount;
            const factor = (100 - discountPct) / 100;
            const totalTax = items.reduce((sum, item) => {
              const itemTaxable = (Number(item.qty || 0) * Number(item.rate || 0)) * factor;
              const itemTaxPct = Number(item.tax !== undefined && item.tax !== '' ? item.tax : 18);
              return sum + (itemTaxable * (itemTaxPct / 100));
            }, 0);
            const cgst = totalTax / 2;
            const sgst = cgst;
            const effCgstPct = taxableAmount > 0 ? Number(((cgst / taxableAmount) * 100).toFixed(2)) : 9;
            const effSgstPct = effCgstPct;

            const calculatedGrandTotal = taxableAmount + cgst + sgst + shippingCharges + otherCharges;
            const grandTotal = (selectedPoData?.grandTotal || selectedPoData?.total || selectedPoData?.val)
              ? (Number(String(selectedPoData?.grandTotal || selectedPoData?.total || selectedPoData?.val).replace(/[^0-9.]/g, '')) || calculatedGrandTotal)
              : calculatedGrandTotal;

            // Status & Stepper
            const st = String(poStatus || '').toUpperCase();
            const isClosed = st.includes('CLOSED') || st.includes('FULLY RECEIVED') || st.includes('FULLY ACCEPTED');
            const isPartial = st.includes('PARTIALLY') || Number(selectedPoData?.totalReceived || 0) > 0;
            const isProceed = st.includes('PROCEED') || !!selectedPoData?.proceedDetails || isPartial || isClosed;
            const isPaymentDone = st.includes('PAYMENT') || !!selectedPoData?.paymentDetails || isProceed;
            const isMdApproved = st.includes('APPROVED') || st.includes('OPEN') || isPaymentDone;
            const isPending = (st.includes('PENDING') || st.includes('WAITING') || st.includes('DRAFT')) && !isMdApproved;

            let currentStepIndex = 1;
            if (isClosed) currentStepIndex = 5;
            else if (isPartial || isProceed) currentStepIndex = 4;
            else if (isPaymentDone) currentStepIndex = 3;
            else if (isMdApproved) currentStepIndex = 2;
            else if (isPending) currentStepIndex = 1;
            else currentStepIndex = 0;

            const steps = [
              { label: '1. PO Created' },
              { label: '2. MD Approval' },
              { label: '3. Payment Process' },
              { label: '4. Proceed PO' },
              { label: '5. GRN Process' },
              { label: '6. GRN Completed' }
            ];

            const stepperData = steps.map((step, idx) => {
              const isDone = idx < currentStepIndex || (currentStepIndex === 5 && idx === 5);
              const isCurrent = idx === currentStepIndex && currentStepIndex !== 5;
              const isFinalDone = currentStepIndex === 5 && idx === 5;
              return {
                ...step,
                done: isDone,
                current: isCurrent,
                finalDone: isFinalDone
              };
            });

            return (
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
                    backgroundColor: '#FFFFFF',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      backgroundColor: '#E0F2FE',
                      color: '#0369A1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <FileText size={20} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                          Purchase Order: {poNumber}
                        </h3>
                        <StatusBadge status={poStatus} size="sm" />
                      </div>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>
                        Vendor: <strong style={{ color: '#0F172A' }}>{vendorName}</strong> • PO Date: {poDate}
                      </span>
                    </div>
                  </div>

                  {/* Header Badges & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isMdApproved && (
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
                    )}

                    <button
                      type="button"
                      onClick={() => window.print()}
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
                      onClick={() => setShowPoModal(false)}
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
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1, backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* Visual PO Workflow History Timeline */}
                  <div className="section-card po-lifecycle-timeline po-no-print" style={{ padding: '20px', borderRadius: '12px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13px', color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        PO Lifecycle & Workflow History
                      </strong>
                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                        PO Ref: {poNumber}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '10px 0' }}>
                      {stepperData.map((step, idx, arr) => (
                        <React.Fragment key={idx}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 2, flex: 1 }}>
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              backgroundColor: step.current ? '#2563EB' : (step.done || step.finalDone ? '#16A34A' : '#E2E8F0'),
                              color: (step.current || step.done || step.finalDone) ? '#FFFFFF' : '#64748B',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              boxShadow: step.current ? '0 0 0 4px #DBEAFE' : 'none'
                            }}>
                              {(step.done || step.finalDone) ? '✓' : (idx + 1)}
                            </div>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: step.current ? 'bold' : '600',
                              color: step.current ? '#2563EB' : ((step.done || step.finalDone) ? '#16A34A' : '#64748B'),
                              textAlign: 'center'
                            }}>
                              {step.label}
                            </span>
                          </div>
                          {idx < arr.length - 1 && (
                            <div style={{
                              height: '2px',
                              backgroundColor: step.done ? '#16A34A' : '#E2E8F0',
                              flex: 1,
                              marginTop: '-16px'
                            }} />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Official Purchase Order Header Card */}
                  <div
                    id="businz-po-official-document"
                    className="section-card businz-po-document"
                    style={{
                      padding: '30px',
                      borderRadius: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '24px',
                      position: 'relative',
                      borderTop: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      width: '100%',
                      maxWidth: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Header Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#1E293B', margin: 0, letterSpacing: '-0.5px' }}>
                          {comp.name}
                        </h1>
                        <div style={{ marginTop: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>{comp.address}</span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '2px' }}>
                          GSTIN: <strong>{comp.gst}</strong> | {comp.email} | {comp.phone}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                        <div style={{ fontSize: '20px', fontWeight: '900', color: '#0F172A', letterSpacing: '1px' }}>PURCHASE ORDER</div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <strong style={{ fontSize: '13px', color: '#0E7490' }}>{poNumber}</strong>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            backgroundColor: (priority === 'Critical' || priority === 'High') ? '#FEE2E2' : (priority === 'Medium' ? '#FEF3C7' : '#ECFEFF'),
                            color: (priority === 'Critical' || priority === 'High') ? '#EF4444' : (priority === 'Medium' ? '#D97706' : '#0E7490')
                          }}>
                            {priority} Priority
                          </span>
                        </div>
                      </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: 0 }} />

                    {/* Info Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', fontSize: '11px' }}>
                      <div>
                        <span style={{ color: '#64748B', display: 'block', textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold' }}>PO Date</span>
                        <strong style={{ color: '#1E293B', display: 'block', marginTop: '2px' }}>{poDate}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', display: 'block', textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold' }}>Expected Delivery Date</span>
                        <strong style={{ color: '#1E293B', display: 'block', marginTop: '2px' }}>{expectedDelivery || '—'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', display: 'block', textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold' }}>Payment Terms</span>
                        <strong style={{ color: '#1E293B', display: 'block', marginTop: '2px' }}>{paymentTerms}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', display: 'block', textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold' }}>PO Issued By</span>
                        <strong style={{ color: '#1E293B', display: 'block', marginTop: '2px' }}>{purchaser}</strong>
                      </div>
                    </div>

                    {/* Address Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', fontSize: '11px' }}>
                      {/* Vendor Details Card */}
                      <div style={{ border: '1px solid #F1F5F9', borderRadius: '8px', padding: '16px', backgroundColor: '#F8FAFC' }}>
                        <strong style={{ fontSize: '11px', color: '#2563EB', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Vendor Details</strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <strong style={{ fontSize: '13px', color: '#0F172A' }}>{vendorName}</strong>
                          {branch && <span style={{ color: '#475569' }}>Branch: {branch}</span>}
                          {contactPerson && <span style={{ color: '#475569' }}>Attn: {contactPerson}</span>}
                          {contactNo && <span style={{ color: '#475569' }}>Phone: {contactNo}</span>}
                          {email && <span style={{ color: '#475569' }}>Email: {email}</span>}
                          {gstNo && <span style={{ color: '#475569', fontWeight: 'bold' }}>GSTIN: {gstNo}</span>}
                        </div>
                      </div>

                      {/* Address Details */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ border: '1px solid #F1F5F9', borderRadius: '8px', padding: '12px', backgroundColor: '#FFFFFF' }}>
                          <strong style={{ fontSize: '9px', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Delivery Address</strong>
                          <span style={{ color: '#334155', lineHeight: '1.4' }}>{deliveryAddress || '—'}</span>
                        </div>
                        <div style={{ border: '1px solid #F1F5F9', borderRadius: '8px', padding: '12px', backgroundColor: '#FFFFFF' }}>
                          <strong style={{ fontSize: '9px', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Billing Address</strong>
                          <span style={{ color: '#334155', lineHeight: '1.4' }}>{billingAddress || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Line Items Table */}
                    <div style={{ overflowX: 'auto', width: '100%' }}>
                      <table className="custom-table detail-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                            <th style={{ padding: '8px', textAlign: 'center', width: '40px' }}>#</th>
                            <th style={{ padding: '8px', textAlign: 'left' }}>Item & Description</th>
                            <th style={{ padding: '8px', textAlign: 'left' }}>Account</th>
                            <th style={{ padding: '8px', textAlign: 'center' }}>Qty</th>
                            <th style={{ padding: '8px', textAlign: 'center' }}>Unit</th>
                            <th style={{ padding: '8px', textAlign: 'right' }}>Rate (₹)</th>
                            <th style={{ padding: '8px', textAlign: 'center' }}>GST (%)</th>
                            <th style={{ padding: '8px', textAlign: 'right' }}>Total (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, idx) => {
                            const itemTax = (item.tax !== undefined && item.tax !== '' && !isNaN(Number(item.tax))) ? Number(item.tax) : 18;
                            const qtyNum = Number(item.qty) || 0;
                            const rateNum = Number(item.rate) || 0;
                            const total = qtyNum * rateNum;
                            return (
                              <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64748B' }}>{idx + 1}</td>
                                <td style={{ padding: '10px 8px', color: '#1E293B' }}>
                                  <div style={{ fontWeight: '600' }}>{item.name}</div>
                                  {item.description && (
                                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', fontWeight: '400', lineHeight: '1.3' }}>
                                      {item.description}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '10px 8px', color: '#475569' }}>{item.account}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold' }}>{qtyNum}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64748B' }}>{item.unit}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'right' }}>{rateNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64748B' }}>{itemTax}%</td>
                                <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold', color: '#0F172A' }}>{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              </tr>
                            );
                          })}
                          {items.length === 0 && (
                            <tr>
                              <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#94A3B8' }}>No items added.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Notes and Calculations */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', marginTop: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '11px' }}>
                        {notes && (
                          <div>
                            <strong style={{ color: '#475569', display: 'block', marginBottom: '4px' }}>Notes & Remarks</strong>
                            <div style={{ padding: '10px', borderRadius: '8px', border: '1px solid #F1F5F9', backgroundColor: '#F8FAFC', color: '#334155', whiteSpace: 'pre-wrap' }}>{notes}</div>
                          </div>
                        )}
                        {terms && (
                          <div>
                            <strong style={{ color: '#475569', display: 'block', marginBottom: '4px' }}>Terms & Conditions</strong>
                            <div style={{ padding: '10px', borderRadius: '8px', border: '1px solid #F1F5F9', backgroundColor: '#F8FAFC', color: '#334155', whiteSpace: 'pre-wrap' }}>{terms}</div>
                          </div>
                        )}
                      </div>

                      <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', backgroundColor: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748B' }}>Subtotal</span>
                          <strong style={{ color: '#1E293B' }}>₹ {subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        {discountPct > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EF4444' }}>
                            <span>Discount ({discountPct}%)</span>
                            <strong>- ₹ {discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748B' }}>CGST ({effCgstPct}%)</span>
                          <strong style={{ color: '#1E293B' }}>₹ {cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748B' }}>SGST ({effSgstPct}%)</span>
                          <strong style={{ color: '#1E293B' }}>₹ {sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        {shippingCharges > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748B' }}>Shipping Charges</span>
                            <strong style={{ color: '#1E293B' }}>₹ {shippingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                          </div>
                        )}
                        {otherCharges > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748B' }}>Other Charges</span>
                            <strong style={{ color: '#1E293B' }}>₹ {otherCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                          </div>
                        )}
                        <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '4px 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <strong style={{ color: '#0F172A' }}>Grand Total</strong>
                          <strong style={{ color: '#2563EB', fontSize: '14px' }}>₹ {Number(grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Priority & Scope information */}
                    {(approvalRequired === 'Yes' || scope) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', borderTop: '1px solid #E2E8F0', paddingTop: '16px', fontSize: '11px', color: '#475569' }}>
                        {approvalRequired === 'Yes' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                            <span>Approval required from <strong>{approver}</strong></span>
                          </div>
                        )}
                        {scope && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0E7490' }} />
                            <span>Scope: <strong>{scope}</strong></span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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
                      ₹{Number(grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {previousGrnForBack && (
                      <button
                        type="button"
                        onClick={handleBackToGrn}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          borderRadius: '8px',
                          padding: '8px 16px',
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#0E7490',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <ArrowLeft size={14} /> Back to GRN
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPoModal(false)}
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
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
  );
}
