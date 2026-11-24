import React from 'react';
import {
  Maximize2,
  Mail,
  FileCheck,
  ExternalLink,
  CheckCircle,
  CreditCard,
  Send,
  Boxes,
  FileText,
  Image,
  Ban,
  Package,
  Layers,
  MapPin,
  Building2,
  Calendar
} from 'lucide-react';
import { getCompanyProfile } from './poConstants';

export default function PoReadOnlyDocument(props) {
  const {
    poNumber,
    poList = [],
    viewingPoStatus,
    poDate,
    billingAddress,
    deliveryAddress,
    items = [],
    terms,
    notes,
    vendorName,
    discount,
    paymentTerms,
    reference,
    otherCharges,
    scope,
    shippingCharges,
    contactNo,
    email,
    subtotal,
    totalGst,
    grandTotal,
    setPreviewZoomImage,
    handlePushToGrn,
    onNavigateTab,
    gstNo,
    gstType,
    panNumber,
    deliveryLocation,
    deliveryMethod,
    shipmentPref,
    transportName,
    priority,
    taxType,
    advancePaidPct,
    getSubTotal,
    getDiscountAmount,
    getEffectiveCGSTPct,
    getCGST,
    getEffectiveSGSTPct,
    getSGST,
    getEffectiveIGSTPct,
    getIGST,
    getGrandTotal,
    deliveryCompanyName,
    companyLocation,
    branch,
    contactPerson,
    discountPct,
    deliveryDate,
    destination,
    dispatchThrough,
    purchaser,
    approver,
    project,
    approvalRequired
  } = props;

  return (
            /* ==================== PREMIUM READ-ONLY PO DOCUMENT LAYOUT ==================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

              {/* Visual PO Workflow History Timeline */}
              <div className="section-card po-lifecycle-timeline po-no-print" style={{ padding: '20px', borderRadius: '12px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '13px', color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PO Lifecycle & Workflow History</strong>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>PO Ref: {poNumber}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', padding: '10px 0' }}>
                  {(() => {
                    const currentPoObj = poList.find(p => p.poNo === poNumber || p.id === poNumber);

                    let hasLocalGrn = false;
                    let isLocalGrnClosed = false;
                    let firstGrnRecord = null;
                    let closedGrnRecord = null;
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
                          firstGrnRecord = matched[matched.length - 1] || matched[0];
                          closedGrnRecord = matched.find(g => {
                            const gst = String(g.status || '').toUpperCase();
                            return gst.includes('CLOSED') || gst.includes('FULLY RECEIVED') || gst.includes('FULLY ACCEPTED');
                          }) || null;
                          isLocalGrnClosed = Boolean(closedGrnRecord);
                        }
                      }
                    } catch (_) {}

                    const fmtStageTimestamp = (isoOrStr, fallbackDate, fallbackTime) => {
                      if (isoOrStr) {
                        const parsed = new Date(isoOrStr);
                        if (!Number.isNaN(parsed.getTime()) && String(isoOrStr).includes('T')) {
                          const dStr = parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
                          const tStr = parsed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
                          return `${dStr}, ${tStr}`;
                        }
                      }
                      if (fallbackDate && fallbackTime) return `${fallbackDate}, ${fallbackTime}`;
                      return fallbackDate || (isoOrStr ? String(isoOrStr) : '');
                    };

                    const st = String(viewingPoStatus || currentPoObj?.status || 'Draft / Pending Approval').trim();
                    const objStatus = String(currentPoObj?.status || '').trim();
                    const objStatusType = String(currentPoObj?.statusType || '').toLowerCase();
                    const totalRec = Number(currentPoObj?.totalReceived || currentPoObj?.totalReceivedQty || 0);
                    const grnCount = Number(currentPoObj?.grnCount || (currentPoObj?.grnHistory ? currentPoObj.grnHistory.length : 0));

                    const isExplicitPartial = st.toLowerCase().includes('partial') || objStatus.toLowerCase().includes('partial') || objStatusType === 'partially_received';
                    const isClosed = !isExplicitPartial && (st.includes('CLOSED') || st.includes('FULLY RECEIVED') || objStatus.includes('CLOSED') || objStatusType === 'closed' || isLocalGrnClosed);
                    const isPartial = isExplicitPartial || totalRec > 0 || hasLocalGrn || grnCount > 0;
                    const isProceed = st === 'Proceed PO' || st === 'PROCEED PO' || objStatus === 'Proceed PO' || objStatusType === 'proceed_po' || !!currentPoObj?.proceedDetails || isPartial || isClosed;
                    const isPaymentDone = st === 'Payment Processed' || objStatus === 'Payment Processed' || objStatusType === 'payment_processed' || !!currentPoObj?.paymentDetails || isProceed;
                    const isMdApproved = st === 'MD Approved' || st === 'OPEN' || st === 'Approved' || objStatus === 'MD Approved' || objStatusType === 'approved' || objStatusType === 'md_approved' || isPaymentDone;
                    const isDraft = (st === 'Draft' || st === 'DRAFT' || objStatus === 'Draft') && !isMdApproved;
                    const isPending = (st === 'Draft / Pending Approval' || st.includes('Pending') || st.includes('WAITING') || objStatusType === 'pending') && !isMdApproved;

                    // 6-STAGE WORKFLOW HIERARCHY:
                    // Stage 0: 1. PO Created
                    // Stage 1: 2. MD Approval
                    // Stage 2: 3. Payment Process
                    // Stage 3: 4. Proceed PO
                    // Stage 4: 5. GRN Process
                    // Stage 5: 6. GRN Completed

                    let currentStepIndex = 1;
                    if (isClosed) {
                      currentStepIndex = 5;
                    } else if (isPartial || isProceed || hasLocalGrn || grnCount > 0) {
                      currentStepIndex = 4;
                    } else if (isPaymentDone) {
                      currentStepIndex = 3;
                    } else if (isMdApproved) {
                      currentStepIndex = 2;
                    } else if (isPending) {
                      currentStepIndex = 1;
                    } else if (isDraft) {
                      currentStepIndex = 0;
                    }

                    const createdStamp = fmtStageTimestamp(
                      currentPoObj?.createdAt || currentPoObj?.created_at,
                      currentPoObj?.poDate || currentPoObj?.date || poDate,
                      currentPoObj?.createdTime
                    );
                    const approvedStamp = isMdApproved
                      ? fmtStageTimestamp(
                          currentPoObj?.approvedAt || currentPoObj?.approved_at,
                          currentPoObj?.approvedDate || currentPoObj?.approvalDate,
                          currentPoObj?.approvedTime || currentPoObj?.approvalTime
                        )
                      : '';
                    const paymentStamp = isPaymentDone
                      ? fmtStageTimestamp(
                          currentPoObj?.paymentDetails?.paidAt,
                          currentPoObj?.paymentDetails?.date,
                          currentPoObj?.paymentDetails?.time
                        )
                      : '';
                    const proceedStamp = isProceed
                      ? fmtStageTimestamp(
                          currentPoObj?.proceedDetails?.proceededAt || currentPoObj?.proceedDetails?.emailSentAt,
                          currentPoObj?.proceedDetails?.date,
                          currentPoObj?.proceedDetails?.time
                        )
                      : '';
                    const grnProcessStamp = (isPartial || hasLocalGrn || grnCount > 0 || isClosed)
                      ? fmtStageTimestamp(
                          firstGrnRecord?.createdAt || firstGrnRecord?.created_at || currentPoObj?.firstGrnAt || currentPoObj?.lastGrnAt,
                          firstGrnRecord?.grnDate || firstGrnRecord?.date || firstGrnRecord?.receiptDate,
                          firstGrnRecord?.time
                        )
                      : '';
                    const grnCompletedStamp = isClosed
                      ? fmtStageTimestamp(
                          closedGrnRecord?.completedAt || closedGrnRecord?.createdAt || closedGrnRecord?.updatedAt || currentPoObj?.lastGrnAt || currentPoObj?.updatedAt,
                          closedGrnRecord?.grnDate || closedGrnRecord?.date || closedGrnRecord?.receiptDate,
                          closedGrnRecord?.time
                        )
                      : '';

                    const steps = [
                      { label: '1. PO Created', timestamp: createdStamp },
                      { label: '2. MD Approval', timestamp: approvedStamp },
                      { label: '3. Payment Process', timestamp: paymentStamp },
                      { label: '4. Proceed PO', timestamp: proceedStamp },
                      { label: '5. GRN Process', timestamp: grnProcessStamp },
                      { label: '6. GRN Completed', timestamp: grnCompletedStamp }
                    ];

                    return steps.map((step, idx) => {
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
                  })().map((step, idx, arr) => (
                    <React.Fragment key={idx}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', zIndex: 2, flex: 1 }}>
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
                        <span style={{ fontSize: '10px', fontWeight: step.current ? 'bold' : '600', color: step.current ? '#2563EB' : ((step.done || step.finalDone) ? '#16A34A' : '#64748B'), textAlign: 'center', marginTop: '2px' }}>
                          {step.label}
                        </span>
                        {step.timestamp && (step.done || step.finalDone || step.current) && (
                          <span style={{ fontSize: '9px', color: '#64748B', fontWeight: '500', textAlign: 'center', lineHeight: '1.25' }}>
                            {step.timestamp}
                          </span>
                        )}
                      </div>
                      {idx < arr.length - 1 && (
                        <div style={{ height: '2px', backgroundColor: step.done ? '#16A34A' : '#E2E8F0', flex: 1, marginTop: '13px' }} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Official Purchase Order Header Card */}
              <div id="businz-po-official-document" className="section-card businz-po-document" style={{ padding: '30px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative', borderTop: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  {(() => {
                    const currentPoObj = poList.find(p => p.poNo === poNumber || p.id === poNumber);
                    const effLocation = currentPoObj?.companyLocation || currentPoObj?.branch || companyLocation || 'VRM Structures India Pvt Ltd';
                    const comp = getCompanyProfile(effLocation);
                    return (
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
                    );
                  })()}
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
                      }}>{priority} Priority</span>
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
                    <strong style={{ color: '#1E293B', display: 'block', marginTop: '2px' }}>{deliveryDate || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold' }}>Payment Terms</span>
                    <strong style={{ color: '#1E293B', display: 'block', marginTop: '2px' }}>
                      {paymentTerms === 'Advance'
                        ? `Advance (${advancePaidPct || 40}% Paid / ${Math.max(0, 100 - Number(advancePaidPct || 40))}% Pending)`
                        : paymentTerms}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold' }}>PO Issued By</span>
                    <strong style={{ color: '#1E293B', display: 'block', marginTop: '2px' }}>{purchaser}</strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', fontSize: '11px' }}>

                  {/* Vendor Details Card (with Vendor Billing Address) */}
                  <div style={{ border: '1px solid #F1F5F9', borderRadius: '8px', padding: '16px', backgroundColor: '#F8FAFC' }}>
                    <strong style={{ fontSize: '11px', color: '#2563EB', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Vendor Details</strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <strong style={{ fontSize: '13px', color: '#0F172A' }}>{vendorName}</strong>
                      {branch && <span style={{ color: '#475569' }}>Branch: {branch}</span>}
                      {contactPerson && <span style={{ color: '#475569' }}>Attn: {contactPerson}</span>}
                      {contactNo && <span style={{ color: '#475569' }}>Phone: {contactNo}</span>}
                      {email && <span style={{ color: '#475569' }}>Email: {email}</span>}
                      {billingAddress && (
                        <span style={{ color: '#334155', marginTop: '4px', lineHeight: '1.4' }}>
                          <strong style={{ color: '#0F172A' }}>Billing Address: </strong>{billingAddress}
                        </span>
                      )}
                      {gstNo && <span style={{ color: '#475569', fontWeight: 'bold', marginTop: '2px' }}>GSTIN: {gstNo}</span>}
                    </div>
                  </div>

                  {/* Delivery Address Box (VRM or Custom Consignee Name) */}
                  <div style={{ border: '1px solid #F1F5F9', borderRadius: '8px', padding: '16px', backgroundColor: '#F8FAFC' }}>
                    <strong style={{ fontSize: '11px', color: '#0E7490', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Delivery Address</strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <strong style={{ fontSize: '13px', color: '#0F172A' }}>
                        {deliveryCompanyName || getCompanyProfile(companyLocation || branch).name}
                      </strong>
                      <span style={{ color: '#334155', lineHeight: '1.45' }}>{deliveryAddress || '—'}</span>
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
                        const taxAmt = total * (itemTax / 100);
                        const finalAmt = total + taxAmt;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64748B' }}>{idx + 1}</td>
                            <td style={{ padding: '10px 8px', color: '#1E293B' }}>
                              <div style={{ fontWeight: '600' }}>{item.name}</div>
                              {item.description && (
                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', fontWeight: '400', lineHeight: '1.3', whiteSpace: 'pre-wrap' }}>
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
                      <strong style={{ color: '#1E293B' }}>₹ {items.reduce((acc, curr) => acc + (curr.qty * curr.rate), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    {discountPct > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EF4444' }}>
                        <span>Discount ({discountPct}%)</span>
                        <strong>- ₹ {(items.reduce((acc, curr) => acc + (curr.qty * curr.rate), 0) * (discountPct / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>CGST ({getEffectiveCGSTPct()}%)</span>
                      <strong style={{ color: '#1E293B' }}>₹ {getCGST().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>SGST ({getEffectiveSGSTPct()}%)</span>
                      <strong style={{ color: '#1E293B' }}>₹ {getSGST().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
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
                      <strong style={{ color: '#2563EB', fontSize: '14px' }}>₹ {getGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                  </div>
                </div>

                {/* Priority & Project information */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', borderTop: '1px solid #E2E8F0', paddingTop: '16px', fontSize: '11px', color: '#475569' }}>
                  {approvalRequired === 'Yes' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                      <span>Approval required from <strong>{approver}</strong></span>
                    </div>
                  )}
                  {scope && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
                      <span>Scope: <strong>{scope}</strong></span>
                    </div>
                  )}
                  {shipmentPref && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3B82F6' }} />
                      <span>Shipment Preference: <strong>{shipmentPref}</strong></span>
                    </div>
                  )}
                  {shipmentPref === 'Transport' && transportName && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#06B6D4' }} />
                      <span>Transport Name: <strong>{transportName}</strong></span>
                    </div>
                  )}
                  {project && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#8B5CF6' }} />
                      <span>Project: <strong>{project}</strong></span>
                    </div>
                  )}
                </div>

                {/* Accounts Payment Verification & Proof Card (if verified) */}
                {(() => {
                  const currentPoObj = poList.find(p => p.poNo === poNumber || p.id === poNumber);
                  const pd = currentPoObj?.paymentDetails;
                  if (!pd) return null;

                  return (
                    <div style={{
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '14px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CheckCircle size={16} style={{ color: '#059669' }} />
                          <strong style={{ fontSize: '13px', color: '#0F172A' }}>Accounts Payment Verification Details</strong>
                        </div>
                        <span style={{ fontSize: '11px', color: '#059669', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '3px 8px', borderRadius: '6px', fontWeight: '700' }}>
                          Verified on {pd.date} {pd.time}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '12px' }}>
                        <div>
                          <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Payment Mode</span>
                          <strong style={{ color: '#1E293B' }}>{pd.mode || 'Bank Transfer'}</strong>
                        </div>
                        {pd.refNo && pd.refNo !== 'CREDIT-CONFIRMED' && (
                          <div>
                            <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Transaction / UTR Ref</span>
                            <strong style={{ color: '#0E7490' }}>{pd.refNo}</strong>
                          </div>
                        )}
                        <div>
                          <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Amount Recorded</span>
                          <strong style={{ color: '#1E293B' }}>{pd.amount || '—'}</strong>
                        </div>
                        {pd.remarks && (
                          <div>
                            <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Accounts Notes</span>
                            <span style={{ color: '#334155' }}>{pd.remarks}</span>
                          </div>
                        )}
                      </div>

                      {(() => {
                        const proofImages = Array.isArray(pd.paymentImages) && pd.paymentImages.length > 0
                          ? pd.paymentImages
                          : (pd.paymentImage ? [{ dataUrl: pd.paymentImage, name: pd.paymentImageMeta?.name || 'Payment_Proof.jpg', size: pd.paymentImageMeta?.size || '' }] : []);

                        if (proofImages.length === 0) return null;

                        return (
                          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Image size={13} style={{ color: '#0E7490' }} /> Attached Payment Proof Receipts ({proofImages.length} image{proofImages.length > 1 ? 's' : ''}):
                              </span>
                              <span style={{ fontSize: '10.5px', color: '#64748B' }}>Click any receipt to zoom preview</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                              {proofImages.map((imgObj, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => setPreviewZoomImage(imgObj)}
                                  style={{
                                    border: '1px solid #CBD5E1',
                                    borderRadius: '8px',
                                    padding: '6px',
                                    backgroundColor: '#FFFFFF',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    transition: 'all 0.15s ease',
                                    position: 'relative'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0E7490'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.transform = 'none'; }}
                                >
                                  <div style={{ position: 'relative', width: '100%', height: '70px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#F1F5F9' }}>
                                    <img
                                      src={imgObj.dataUrl || imgObj}
                                      alt={imgObj.name || `Proof ${idx + 1}`}
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    <div style={{ position: 'absolute', bottom: '4px', right: '4px', backgroundColor: 'rgba(15, 23, 42, 0.7)', borderRadius: '4px', padding: '2px 4px', display: 'flex', alignItems: 'center', color: '#FFFFFF' }}>
                                      <Maximize2 size={11} />
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {imgObj.name || `Receipt #${idx + 1}`}
                                    </span>
                                    {imgObj.size && (
                                      <span style={{ fontSize: '9.5px', color: '#64748B' }}>{imgObj.size}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {/* Proceed PO (Ready for GRN) Authorization Details Card (if proceeded) */}
                {(() => {
                  const currentPoObj = poList.find(p => p.poNo === poNumber || p.id === poNumber);
                  const prd = currentPoObj?.proceedDetails;
                  if (!prd && viewingPoStatus !== 'Proceed PO' && currentPoObj?.status !== 'Proceed PO') return null;

                  return (
                    <div style={{
                      backgroundColor: '#ECFEFF',
                      border: '1px solid #A5F3FC',
                      borderRadius: '12px',
                      padding: '14px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CheckCircle size={16} style={{ color: '#0E7490' }} />
                          <strong style={{ fontSize: '13px', color: '#0F172A' }}>Proceed PO Authorization (Ready for GRN)</strong>
                        </div>
                        {prd?.date && (
                          <span style={{ fontSize: '11px', color: '#0E7490', backgroundColor: '#CFFAFE', border: '1px solid #A5F3FC', padding: '3px 8px', borderRadius: '6px', fontWeight: '700' }}>
                            Authorized on {prd.date} {prd.time}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '12px' }}>
                        <div>
                          <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Status</span>
                          <strong style={{ color: '#0E7490' }}>Eligible & Ready for GRN Receiving</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Authorized By</span>
                          <strong style={{ color: '#1E293B' }}>{prd?.authorizedBy || 'Procurement Head'}</strong>
                        </div>
                        {(prd?.vendorEmail || currentPoObj?.email) && (
                          <div>
                            <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Vendor PO Dispatch</span>
                            <span style={{ color: '#0E7490', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Mail size={12} /> Dispatched to {prd?.vendorEmail || currentPoObj?.email}
                            </span>
                          </div>
                        )}
                        {prd?.remarks && (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Proceed Remarks</span>
                            <span style={{ color: '#334155' }}>{prd.remarks}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* GRN Inwarding & Receipt History Card for Accounts & Procurement (Partial & Full) */}
                {(() => {
                  let matchedGrns = [];
                  try {
                    const localGrns = JSON.parse(localStorage.getItem('controlroom_central_grns_v2') || localStorage.getItem('goods_receipt_notes') || '[]');
                    if (Array.isArray(localGrns)) {
                      matchedGrns = localGrns.filter(g => {
                        const gRef = String(g.poRef || g.poNo || g.poId || '').toLowerCase().trim();
                        const pRef = String(poNumber || '').toLowerCase().trim();
                        return gRef && pRef && (gRef === pRef || gRef.includes(pRef) || pRef.includes(gRef));
                      });
                    }
                  } catch (_) {}

                  if (matchedGrns.length === 0) return null;

                  return (
                    <div style={{
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileCheck size={18} style={{ color: '#0E7490' }} />
                          <strong style={{ fontSize: '13px', color: '#0F172A' }}>
                            GRN Inwarding & Delivery Receipts ({matchedGrns.length})
                          </strong>
                          <span style={{ fontSize: '11px', color: '#0E7490', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                            Sent to Accounts for Bill Verification
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            if (typeof onNavigateTab === 'function') {
                              onNavigateTab('Goods Receipt Note');
                            } else {
                              localStorage.setItem('controlroom_active_tab', 'Goods Receipt Note');
                              window.location.reload();
                            }
                          }}
                          style={{
                            border: '1px solid #0E7490',
                            backgroundColor: '#FFFFFF',
                            color: '#0E7490',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <ExternalLink size={12} /> Open Full GRN Ledger
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {matchedGrns.map((g, gIdx) => {
                          const isFullyRec = String(g.status || '').toUpperCase().includes('FULLY') || String(g.status || '').toUpperCase().includes('CLOSED');
                          const recQty = g.receivedQty || (Array.isArray(g.items) ? g.items.reduce((s, it) => s + Number(it.accepted !== undefined ? it.accepted : (it.now || 0)), 0) : '—');
                          const rejQty = Number(g.rejectedQty || 0);
                          const currentPoObj = poList.find(p => p.poNo === poNumber || p.id === poNumber);
                          const grnItemsList = (Array.isArray(g.items) && g.items.length > 0)
                            ? g.items
                            : (Array.isArray(currentPoObj?.items) ? currentPoObj.items.map(it => {
                                const ord = Number(it.qty !== undefined ? it.qty : (it.quantity || 0));
                                const fallbackRec = (currentPoObj.items.length === 1 && recQty !== '—') ? recQty : ord;
                                return {
                                  name: it.name || it.item_name || it.description || 'Material Item',
                                  uom: it.unit || it.uom || 'NOS',
                                  ordered: ord,
                                  accepted: fallbackRec,
                                  rejected: 0,
                                  date: g.date || '—'
                                };
                              }) : []);

                          return (
                            <div key={gIdx} style={{
                              backgroundColor: '#FFFFFF',
                              border: '1px solid #E2E8F0',
                              borderRadius: '8px',
                              padding: '12px 14px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px'
                            }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '10px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{
                                    width: '28px', height: '28px', borderRadius: '6px',
                                    backgroundColor: isFullyRec ? '#DCFCE7' : '#FEF3C7',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}>
                                    <Boxes size={14} style={{ color: isFullyRec ? '#166534' : '#B45309' }} />
                                  </div>
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <strong style={{ fontSize: '12.5px', color: '#0F172A' }}>{g.grnNo || g.id}</strong>
                                      <span style={{
                                        fontSize: '10px',
                                        fontWeight: '700',
                                        padding: '1px 6px',
                                        borderRadius: '6px',
                                        backgroundColor: isFullyRec ? '#DCFCE7' : '#FEF3C7',
                                        color: isFullyRec ? '#166534' : '#B45309',
                                        border: isFullyRec ? '1px solid #86EFAC' : '1px solid #FDE68A'
                                      }}>
                                        {isFullyRec ? 'Fully Received' : 'Partially Received'}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                                      Date: {g.date || '—'} • DC / Inv No: <strong>{g.challanNo || '—'}</strong> • Received by: {g.receivedBy || 'Store Inwarder'}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ textAlign: 'right', fontSize: '11.5px' }}>
                                  <div>
                                    <strong style={{ color: '#0E7490' }}>{recQty} Units</strong> Received
                                    {rejQty > 0 && <span style={{ color: '#DC2626', marginLeft: '4px' }}>({rejQty} rejected)</span>}
                                  </div>
                                  <div style={{ fontSize: '10.5px', color: '#166534', fontWeight: '600', marginTop: '2px' }}>
                                    ✓ Inwarded into Live Inventory
                                  </div>
                                </div>
                              </div>

                              {grnItemsList.length > 0 && (
                                <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                                    <thead>
                                      <tr style={{ backgroundColor: '#F8FAFC', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>
                                        <th style={{ padding: '7px 10px', fontWeight: '700' }}>Product Name</th>
                                        <th style={{ padding: '7px 10px', fontWeight: '700', textAlign: 'center' }}>UOM</th>
                                        <th style={{ padding: '7px 10px', fontWeight: '700', textAlign: 'right' }}>Ordered Qty</th>
                                        <th style={{ padding: '7px 10px', fontWeight: '700', textAlign: 'right' }}>Received Qty</th>
                                        <th style={{ padding: '7px 10px', fontWeight: '700', textAlign: 'right' }}>Date</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {grnItemsList.map((it, itIdx) => {
                                        const itemName = it.name || it.item_name || it.productName || it.description || 'Material Item';
                                        const itemUom = it.uom || it.unit || 'NOS';
                                        const ordQtyVal = it.ordered ?? it.orderedQty ?? it.poQty ?? it.qty ?? it.quantity ?? '—';
                                        const recQtyVal = it.accepted ?? it.now ?? it.receivedQty ?? ordQtyVal;
                                        const itemRej = Number(it.rejected || 0);
                                        const itemDate = it.date || it.receivedDate || g.date || '—';
                                        return (
                                          <tr key={itIdx} style={{ borderBottom: itIdx < grnItemsList.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                                            <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>{itemName}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{itemUom}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '600', color: '#334155' }}>{ordQtyVal}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '800', color: '#0E7490' }}>
                                              {recQtyVal}
                                              {itemRej > 0 && <span style={{ color: '#DC2626', fontWeight: '600', marginLeft: '4px' }}>({itemRej} rej)</span>}
                                            </td>
                                            <td style={{ padding: '7px 10px', textAlign: 'right', color: '#64748B' }}>{itemDate}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}


              </div>
            </div>
  );
}
