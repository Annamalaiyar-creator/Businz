import React from 'react';
import {
  Eye, X, Truck, CreditCard, Boxes, Receipt, Factory
} from 'lucide-react';
import { cleanNum } from '../../../utils/otherViewsShared';
import ExecutiveOrderDossierModal from '../ExecutiveOrderDossierModal';

export default function BomExecutiveModals({ ctx }) {
  const {
    formatBomDateDot,
    getBomStageTiming,
    ceoBomDetailModal,
    setCeoBomDetailModal,
    viewingPiModalFromBom,
    setViewingPiModalFromBom,
    executiveDossierOrder,
    setExecutiveDossierOrder,
    setPreviewDocModal,
    presetSetCount,
    presetUnit,
    presetKitPrice,
    presetGroups
  } = ctx;

  return (
    <>
      {/* CEO EXCLUSIVE: ORDER-TO-CASH LIFECYCLE & BOM DETAIL MODAL */}
      {ceoBomDetailModal && (() => {
        const bom = ceoBomDetailModal;
        const bomCode = bom.bomCode || bom.code || bom.id || 'BOM';
        const bomDate = bom.appliedAt || bom.bomDate || bom.date || bom.createdAt || '—';
        const customer = bom.customerName || bom.customer || bom.c3 || '—';
        const salesPerson = bom.salesPerson || bom.createdBy || 'Sales / Engineering';
        const linkedPiNo = bom.sourcePiNo || bom.piNo || bom.piNumber || bom.source_pi_no;

        let allPiList = [];
        try {
          allPiList = JSON.parse(localStorage.getItem('controlroom_pi_store') || '[]');
        } catch (e) {
          allPiList = [];
        }
        const matchingPi = linkedPiNo ? allPiList.find(p => (p.piNo === linkedPiNo || p.id === linkedPiNo || p.code === linkedPiNo)) : null;

        const items = Array.isArray(bom.items) && bom.items.length > 0 ? bom.items : (Array.isArray(bom.materials) && bom.materials.length > 0 ? bom.materials : (Array.isArray(matchingPi?.items) ? matchingPi.items : []));
        const grandTotal = cleanNum(bom.grandTotal || bom.totalAmount || bom.amount || bom.value || matchingPi?.grandTotal || 0);
        const subtotal = cleanNum(bom.subtotal || bom.subTotal || bom.taxableAmount || bom.unitValue || matchingPi?.subtotal || (grandTotal > 0 ? Math.round(grandTotal / 1.18) : 0));
        const taxTotal = cleanNum(bom.taxTotal || bom.gstAmount || matchingPi?.taxTotal || Math.max(0, grandTotal - subtotal));
        const totalUnits = items.reduce((sum, it) => sum + (parseFloat(it.totalDispatchQty || it.qty || it.quantity || 0) || 0), 0);
        const st = String(bom.status || '').toLowerCase();

        // Payment Proof Documents for CEO
        const pDocs = (Array.isArray(bom.paymentProofDocs) && bom.paymentProofDocs.length > 0)
          ? bom.paymentProofDocs
          : (Array.isArray(bom.payments?.proofDocObjs) && bom.payments.proofDocObjs.length > 0)
            ? bom.payments.proofDocObjs
            : (bom.paymentProofDoc
                ? (Array.isArray(bom.paymentProofDoc) ? bom.paymentProofDoc : [bom.paymentProofDoc])
                : (bom.payments?.proofDoc
                    ? [{ name: bom.payments.proofDoc, dataUrl: bom.payments.proofDocData }]
                    : (matchingPi?.paymentProofDocs && matchingPi.paymentProofDocs.length > 0
                        ? matchingPi.paymentProofDocs
                        : (matchingPi?.paymentProofDoc ? [matchingPi.paymentProofDoc] : []))));
        const validPDocs = (pDocs || []).filter(d => Boolean(d && (typeof d === 'string' ? d.trim() : (d.name || d.url || d.dataUrl || d.storagePath))));

        // Address Proof Documents for CEO
        const aDocs = (Array.isArray(bom.deliveryAddressProofDocs) && bom.deliveryAddressProofDocs.length > 0)
          ? bom.deliveryAddressProofDocs
          : (Array.isArray(bom.deliveryProofDocs) && bom.deliveryProofDocs.length > 0)
            ? bom.deliveryProofDocs
            : (bom.deliveryAddressProofDoc
                ? (Array.isArray(bom.deliveryAddressProofDoc) ? bom.deliveryAddressProofDoc : [bom.deliveryAddressProofDoc])
                : (bom.deliveryProofDoc
                    ? (Array.isArray(bom.deliveryProofDoc) ? bom.deliveryProofDoc : [bom.deliveryProofDoc])
                    : (matchingPi?.deliveryAddressProofDocs && matchingPi.deliveryAddressProofDocs.length > 0
                        ? matchingPi.deliveryAddressProofDocs
                        : (matchingPi?.deliveryAddressProofDoc
                            ? [matchingPi.deliveryAddressProofDoc]
                            : (matchingPi?.deliveryProofDoc ? [matchingPi.deliveryProofDoc] : [])))));
        const validADocs = (aDocs || []).filter(d => Boolean(d && (typeof d === 'string' ? d.trim() : (d.name || d.url || d.dataUrl || d.storagePath))));

        const timing = getBomStageTiming(bom, matchingPi);

        // 6 Lifecycle stage indicators with Real Operational Timestamps & Active Processing Stage
        const stages = [
          {
            num: 1,
            label: 'PI Commercial',
            done: timing?.hasPi,
            active: false,
            date: timing?.piDate || '—',
            completedTime: timing?.piTime,
            receivedTime: timing?.piTime,
            duration: null,
            subtext: timing?.hasPi ? 'Issued to Client' : 'Direct Order'
          },
          {
            num: 2,
            label: 'BOM Confirmed',
            done: timing?.hasConfirmed,
            active: !timing?.hasConfirmed,
            date: timing?.confirmedDate || '—',
            completedTime: timing?.confirmedTime,
            receivedTime: timing?.piTime || timing?.confirmedTime,
            duration: null,
            subtext: timing?.hasConfirmed ? 'Sales Confirmed' : 'Draft Order'
          },
          {
            num: 3,
            label: 'Dispatch Packing',
            done: timing?.hasPacking,
            active: timing?.isPackingActive,
            date: timing?.packingDate || (timing?.isPackingActive ? timing?.confirmedDate : '—'),
            completedTime: timing?.packingCompletedTime,
            receivedTime: timing?.packingReceivedTime,
            duration: timing?.packingDuration,
            subtext: timing?.hasPacking ? 'Packing Verified' : 'Awaiting Packing'
          },
          {
            num: 4,
            label: timing?.isPaymentProofPending ? 'Payment Proof Pending' : 'Accounts Verified',
            done: timing?.hasAccounts,
            active: timing?.isAccountsActive,
            date: timing?.accountsDate || (timing?.isAccountsActive ? (timing?.packingDate || timing?.confirmedDate) : '—'),
            completedTime: timing?.accountsCompletedTime,
            receivedTime: timing?.accountsReceivedTime,
            duration: timing?.accountsDuration,
            subtext: timing?.hasAccounts
              ? 'Accounts Verified'
              : (timing?.isPaymentProofPending ? 'Awaiting Sales Payment Proof' : 'Awaiting Accounts')
          },
          {
            num: 5,
            label: 'GST Invoiced',
            done: timing?.hasInvoice,
            active: timing?.isInvoiceActive,
            date: timing?.invoiceDate || (timing?.isInvoiceActive ? (timing?.accountsDate || timing?.packingDate) : '—'),
            completedTime: timing?.invoiceCompletedTime,
            receivedTime: timing?.invoiceReceivedTime,
            duration: timing?.invoiceDuration,
            subtext: timing?.hasInvoice ? 'Invoice Confirmed' : 'Awaiting Billing'
          },
          {
            num: 6,
            label: 'Final Dispatched',
            done: timing?.hasDispatch,
            active: timing?.isDispatchActive,
            date: timing?.dispatchDate || (timing?.isDispatchActive ? (timing?.invoiceDate || timing?.accountsDate) : '—'),
            completedTime: timing?.dispatchCompletedTime,
            receivedTime: timing?.dispatchReceivedTime,
            duration: timing?.dispatchDuration,
            subtext: timing?.hasDispatch ? 'Dispatched' : 'Awaiting Loading'
          }
        ];

        return (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}>
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              width: '920px',
              maxWidth: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{
                padding: '16px 22px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#F8FAFC'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#F0F9FF',
                    color: '#0284C7',
                    border: '1px solid #BAE6FD',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Factory size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>
                        BOM Order • {bomCode}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        backgroundColor: '#ECFEFF',
                        color: '#0E7490',
                        border: '1px solid #A5F3FC'
                      }}>
                        {bom.status || 'Active'}
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                      Customer Project: <strong>{customer}</strong> • Date: {formatBomDateDot(bomDate)} • Rep: {salesPerson}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCeoBomDetailModal(null)}
                  style={{
                    border: 'none',
                    background: 'none',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748B',
                    backgroundColor: '#F1F5F9'
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* 6-Stage Progress Stepper Bar with Date & 2-Hour SLA Stopwatch */}
                <div style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  border: '1px solid #E2E8F0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Order-to-Cash Lifecycle Progress
                    </div>
                    {timing && (
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: '800',
                        color: timing.isCompleted ? '#16A34A' : '#0E7490',
                        backgroundColor: timing.isCompleted ? '#F0FDF4' : '#ECFEFF',
                        border: `1px solid ${timing.isCompleted ? '#BBF7D0' : '#BAE6FD'}`,
                        padding: '2px 10px',
                        borderRadius: '999px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}>
                        {timing.isCompleted ? (
                          <>✓ Order Completed & Dispatched {timing.totalTurnaround ? `(Turnaround: ${timing.totalTurnaround})` : ''}</>
                        ) : (
                          <>Current: {timing.activeStageName} (In Processing)</>
                        )}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
                    {stages.map((stg) => {
                      const isComplete = stg.done;
                      const isCurrent = stg.active;
                      return (
                        <div
                          key={stg.num}
                          style={{
                            backgroundColor: isComplete ? '#F0FDF4' : (isCurrent ? '#ECFEFF' : '#FFFFFF'),
                            border: `1.5px solid ${isComplete ? '#BBF7D0' : (isCurrent ? '#0E7490' : '#E2E8F0')}`,
                            borderRadius: '10px',
                            padding: '8px 6px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            gap: '3px',
                            minHeight: '94px',
                            boxSizing: 'border-box'
                          }}
                        >
                          <span style={{
                            fontSize: '9.5px',
                            fontWeight: '800',
                            color: isComplete ? '#16A34A' : (isCurrent ? '#0E7490' : '#94A3B8'),
                            textTransform: 'uppercase',
                            letterSpacing: '0.4px'
                          }}>
                            {isComplete ? '✓ STEP ' + stg.num : 'STEP ' + stg.num}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '800',
                            color: isComplete ? '#15803D' : (isCurrent ? '#0E7490' : '#475569'),
                            lineHeight: 1.15
                          }}>
                            {stg.label}
                          </span>
                          {/* DATE */}
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            color: isComplete ? '#166534' : (isCurrent ? '#0E7490' : '#64748B'),
                            marginTop: '2px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}>
                            {stg.date}
                          </span>
                          {/* TIME & STAGE STATUS */}
                          <div style={{
                            backgroundColor: isComplete ? '#DCFCE7' : (isCurrent ? '#E0F2FE' : '#F1F5F9'),
                            border: `1.5px solid ${isComplete ? '#BBF7D0' : (isCurrent ? '#0E7490' : '#E2E8F0')}`,
                            padding: '4px 4px',
                            borderRadius: '8px',
                            marginTop: 'auto',
                            width: '100%',
                            boxSizing: 'border-box',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px'
                          }}>
                            {/* Primary Status */}
                            <span style={{
                              fontSize: '9.5px',
                              fontWeight: '900',
                              color: isComplete ? '#15803D' : (isCurrent ? '#0369A1' : '#64748B'),
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}>
                              {isComplete ? '✓ Completed' : (isCurrent ? 'Processing' : 'Pending')}
                            </span>

                            {/* Exact Operational Timestamp */}
                            {isComplete ? (
                              <span style={{
                                fontSize: '9px',
                                fontWeight: '800',
                                color: '#166534',
                                lineHeight: '1.2'
                              }}>
                                {stg.completedTime ? `At ${stg.completedTime}` : (stg.date !== '—' ? stg.date : 'Done')}
                              </span>
                            ) : isCurrent ? (
                              <span style={{
                                fontSize: '9px',
                                fontWeight: '800',
                                color: '#0E7490',
                                lineHeight: '1.2'
                              }}>
                                {stg.receivedTime ? `Received: ${stg.receivedTime}` : 'In Progress'}
                              </span>
                            ) : (
                              <span style={{
                                fontSize: '8.5px',
                                fontWeight: '600',
                                color: '#94A3B8'
                              }}>
                                Waiting
                              </span>
                            )}

                            {/* Turnaround Duration if Completed */}
                            {isComplete && stg.duration && (
                              <span style={{
                                fontSize: '8px',
                                fontWeight: '700',
                                color: '#15803D',
                                opacity: 0.85
                              }}>
                                Took {stg.duration}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Info Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0', minHeight: '68px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Linked PI Reference</div>
                    {linkedPiNo ? (
                      <div style={{ marginTop: '3px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const targetPi = matchingPi || {
                              piNo: linkedPiNo,
                              id: linkedPiNo,
                              customerName: customer,
                              customer: customer,
                              date: timing?.piDate !== '—' ? timing?.piDate : bomDate,
                              salesPerson: salesPerson,
                              grandTotal: grandTotal,
                              subtotal: subtotal,
                              taxTotal: taxTotal,
                              items: items,
                              paymentTerms: bom.paymentType || '100% Paid',
                              status: 'Converted to BOM',
                              convertedBomCode: bomCode,
                              bomCode: bomCode
                            };
                            setCeoBomDetailModal(null);
                            setViewingPiModalFromBom({ pi: targetPi, returnBom: bom });
                          }}
                          style={{
                            border: 'none',
                            background: 'none',
                            padding: 0,
                            fontSize: '13px',
                            fontWeight: '800',
                            color: '#0284C7',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Open Commercial PI Details (same page, in-modal)"
                        >
                          {linkedPiNo} <Receipt size={13} />
                        </button>
                        <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '2px' }}>Click to view Commercial PI</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>Direct Factory BOM</div>
                    )}
                  </div>

                  {/* Payment Attachment */}
                  <div style={{ backgroundColor: validPDocs.length > 0 ? '#F0FDF4' : '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: validPDocs.length > 0 ? '1px solid #BBF7D0' : '1px solid #E2E8F0', minHeight: '68px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                      <span style={{ fontSize: '10.5px', color: validPDocs.length > 0 ? '#15803D' : '#64748B', fontWeight: '700', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CreditCard size={12} /> Payment Attachment
                      </span>
                      {validPDocs.length > 0 && (
                        <span style={{ fontSize: '9px', fontWeight: '800', color: '#16A34A', backgroundColor: '#DCFCE7', padding: '1px 6px', borderRadius: '999px', border: '1px solid #BBF7D0' }}>
                          ✓ {validPDocs.length} {validPDocs.length === 1 ? 'File' : 'Files'}
                        </span>
                      )}
                    </div>
                    {validPDocs.length > 0 ? (
                      <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {validPDocs.map((pDoc, pIdx) => {
                          const rawName = typeof pDoc === 'string' ? pDoc : (pDoc?.name || pDoc?.originalName || `Payment Slip #${pIdx + 1}`);
                          const isPdf = /\.pdf($|\?)/i.test(rawName);
                          return (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() => setPreviewDocModal({ title: `Payment Proof #${pIdx + 1}: ${rawName}`, doc: pDoc, bomCode })}
                              style={{
                                border: '1px solid #BBF7D0',
                                backgroundColor: '#FFFFFF',
                                borderRadius: '6px',
                                padding: '3px 6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                textAlign: 'left',
                                gap: '6px',
                                width: '100%',
                                boxSizing: 'border-box'
                              }}
                              title={`Click to preview ${rawName}`}
                            >
                              <span style={{ fontSize: '11px', color: '#166534', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {isPdf ? '📑' : '🖼️'} {rawName}
                              </span>
                              <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                                <Eye size={10} /> View
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ marginTop: '4px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#94A3B8' }}>Not Attached</div>
                        <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '1px' }}>No payment receipt on file</div>
                      </div>
                    )}
                  </div>

                  {/* Address Proof */}
                  <div style={{ backgroundColor: validADocs.length > 0 ? '#F0FDFA' : '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: validADocs.length > 0 ? '1px solid #99F6E4' : '1px solid #E2E8F0', minHeight: '68px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                      <span style={{ fontSize: '10.5px', color: validADocs.length > 0 ? '#0F766E' : '#64748B', fontWeight: '700', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Truck size={12} /> Address Proof
                      </span>
                      {validADocs.length > 0 && (
                        <span style={{ fontSize: '9px', fontWeight: '800', color: '#0D9488', backgroundColor: '#CCFBF1', padding: '1px 6px', borderRadius: '999px', border: '1px solid #99F6E4' }}>
                          ✓ {validADocs.length} {validADocs.length === 1 ? 'File' : 'Files'}
                        </span>
                      )}
                    </div>
                    {validADocs.length > 0 ? (
                      <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {validADocs.map((aDoc, aIdx) => {
                          const rawName = typeof aDoc === 'string' ? aDoc : (aDoc?.name || aDoc?.originalName || `Address Proof #${aIdx + 1}`);
                          const isPdf = /\.pdf($|\?)/i.test(rawName);
                          return (
                            <button
                              key={aIdx}
                              type="button"
                              onClick={() => setPreviewDocModal({ title: `Address Proof #${aIdx + 1}: ${rawName}`, doc: aDoc, bomCode })}
                              style={{
                                border: '1px solid #99F6E4',
                                backgroundColor: '#FFFFFF',
                                borderRadius: '6px',
                                padding: '3px 6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                textAlign: 'left',
                                gap: '6px',
                                width: '100%',
                                boxSizing: 'border-box'
                              }}
                              title={`Click to preview ${rawName}`}
                            >
                              <span style={{ fontSize: '11px', color: '#0F766E', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {isPdf ? '📑' : '📍'} {rawName}
                              </span>
                              <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                                <Eye size={10} /> View
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ marginTop: '4px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#94A3B8' }}>Not Attached</div>
                        <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '1px' }}>No address proof on file</div>
                      </div>
                    )}
                  </div>

                  <div style={{ backgroundColor: '#F0F9FF', padding: '10px 12px', borderRadius: '10px', border: '1px solid #BAE6FD', minHeight: '68px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '10.5px', color: '#0284C7', fontWeight: '800', textTransform: 'uppercase' }}>BOM Order Value</div>
                    <div style={{ fontSize: '16px', fontWeight: '900', color: '#0284C7', marginTop: '3px' }}>
                      ₹ {Math.round(grandTotal).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#0284C7', marginTop: '2px' }}>
                      {bom.invoiceConfirmed ? '✓ Invoiced & Locked' : 'Pending Invoice'}
                    </div>
                  </div>
                </div>

                {/* Items Table with Grouped Presets and Kit Value Header (PI Formatted for CEO) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                      BOM Materials & Preset Structure Kits ({items.length} components)
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                      Grouped by Structure Kit with commercial rates, GST & boundaries
                    </div>
                  </div>

                  {(() => {
                    let presetGroupsData = bom.presetGroups || matchingPi?.presetGroups || {};
                    if (typeof presetGroupsData === 'string') {
                      try {
                        presetGroupsData = JSON.parse(presetGroupsData);
                      } catch (e) {
                        presetGroupsData = {};
                      }
                    }
                    const sections = [];
                    const sectionMap = new Map();

                    const allZeroRates = items.length > 0 && items.every(it => (parseFloat(it.rate || it.price || 0) || 0) === 0);

                    items.forEach((it, idx) => {
                      const isPreset = Boolean(it.isPresetItem || it.presetGroupId || it.presetName || (allZeroRates && (bom.presetName || matchingPi?.presetName)));
                      const secKey = isPreset
                        ? (it.presetGroupId || it.presetName || bom.presetName || matchingPi?.presetName || 'PRESET_1')
                        : '__CUSTOM_ITEMS__';

                      if (!sectionMap.has(secKey)) {
                        const secObj = {
                          key: secKey,
                          isPreset,
                          presetGroupId: it.presetGroupId,
                          presetName: isPreset ? (it.presetName || (it.presetGroupId && presetGroupsData[it.presetGroupId]?.presetName) || bom.presetName || matchingPi?.presetName || 'Preset Structure Kit') : 'Custom / Standalone Products',
                          items: []
                        };
                        sectionMap.set(secKey, secObj);
                        sections.push(secObj);
                      }
                      sectionMap.get(secKey).items.push({ item: it, originalIndex: idx });
                    });

                    // Fallback single section if items is empty
                    if (sections.length === 0 && (bom.presetName || matchingPi?.presetName || grandTotal > 0)) {
                      sections.push({
                        key: 'PRESET_1',
                        isPreset: true,
                        presetGroupId: 'group_1',
                        presetName: bom.presetName || matchingPi?.presetName || 'Solar Mounting Structure Kit',
                        items: [{
                          item: {
                            name: bom.presetName || matchingPi?.presetName || 'Solar Mounting Structure Kit',
                            hsn: '73089090',
                            qty: bom.presetSetCount || matchingPi?.presetSetCount || 1,
                            uom: bom.presetUnit || matchingPi?.presetUnit || 'SET',
                            rate: subtotal,
                            gstRate: '18%'
                          },
                          originalIndex: 0
                        }]
                      });
                    }

                    // Pre-compute custom items taxable sum
                    const customTaxableTotal = sections
                      .filter(s => !s.isPreset)
                      .flatMap(s => s.items)
                      .reduce((sum, { item }) => {
                        const q = (parseFloat(item.totalDispatchQty) > 0 ? parseFloat(item.totalDispatchQty) : (parseFloat(item.qty || item.bomQty || item.quantity || 0) || 0));
                        const r = parseFloat(item.rate || item.price || 0) || 0;
                        return sum + (q * r);
                      }, 0);

                    const presetTaxablePool = Math.max(0, subtotal - customTaxableTotal);
                    const presetSections = sections.filter(s => s.isPreset);
                    const presetGroupsList = Array.isArray(presetGroupsData)
                      ? presetGroupsData
                      : (presetGroupsData && typeof presetGroupsData === 'object' ? Object.values(presetGroupsData) : []);

                    return (
                      <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                              <th style={{ padding: '8px 10px', width: '38px', textAlign: 'center' }}>#</th>
                              <th style={{ padding: '8px 10px' }}>Product / Component</th>
                              <th style={{ padding: '8px 10px', width: '80px', textAlign: 'center' }}>HSN / SAC</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center', width: '65px' }}>Qty</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center', width: '55px' }}>UOM</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center', width: '110px' }}>Rate (₹)</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center', width: '55px' }}>GST</th>
                              <th style={{ padding: '8px 10px', textAlign: 'right', width: '110px' }}>Total (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sections.length > 0 ? (
                              sections.map((sec, secIdx) => {
                                if (sec.isPreset) {
                                  const presetIdx = presetSections.indexOf(sec);
                                  let grpConfig = (sec.presetGroupId && presetGroupsData[sec.presetGroupId]) || (presetGroupsData[sec.key]) || null;
                                  if (!grpConfig && presetGroupsList.length > 0) {
                                    grpConfig = presetGroupsList.find(g =>
                                      (sec.presetGroupId && (g.id === sec.presetGroupId || g.groupId === sec.presetGroupId)) ||
                                      (sec.presetName && g.presetName && g.presetName.toLowerCase().trim() === sec.presetName.toLowerCase().trim()) ||
                                      (g.name && sec.presetName && g.name.toLowerCase().trim() === sec.presetName.toLowerCase().trim())
                                    ) || null;
                                  }
                                  const setCount = parseFloat(grpConfig?.setCount || grpConfig?.quantity || bom.presetSetCount || matchingPi?.presetSetCount || 1) || 1;
                                  const pUnit = grpConfig?.unit || grpConfig?.unitType || bom.presetUnit || matchingPi?.presetUnit || 'Sets';

                                  // Calculate kit taxable
                                  let taxable = 0;
                                  if (grpConfig?.kitPrice && parseFloat(grpConfig.kitPrice) > 0) {
                                    taxable = (parseFloat(grpConfig.kitPrice) || 0) * setCount;
                                  } else if (bom.presetKitPrice && parseFloat(bom.presetKitPrice) > 0) {
                                    taxable = (parseFloat(bom.presetKitPrice) || 0) * setCount;
                                  } else if (matchingPi?.presetKitPrice && parseFloat(matchingPi.presetKitPrice) > 0) {
                                    taxable = (parseFloat(matchingPi.presetKitPrice) || 0) * setCount;
                                  } else if (bom.unitValue && parseFloat(bom.unitValue) > 0) {
                                    taxable = parseFloat(bom.unitValue) || 0;
                                  } else if (presetSections.length === 1) {
                                    taxable = presetTaxablePool || (grandTotal > 0 ? Math.round(grandTotal / 1.18) : 0);
                                  } else if (presetSections.length > 0) {
                                    taxable = Math.round(presetTaxablePool / presetSections.length);
                                  }

                                  const rawGst = grpConfig?.gstRate || sec.items[0]?.item?.gstRate || bom.gstRate || matchingPi?.gstRate || '18%';
                                  const gstPct = parseFloat(String(rawGst).replace('%', '').trim()) || 18;
                                  const kitGst = Math.round(taxable * (gstPct / 100));
                                  const kitTotal = Math.round(taxable + kitGst);

                                  return (
                                    <React.Fragment key={sec.key}>
                                      {/* PRESET HEADER BANNER WITH KIT VALUE */}
                                      <tr style={{ backgroundColor: '#F0FDFA', borderTop: '2px solid #0E7490', borderBottom: '1px solid #CCFBF1' }}>
                                        <td colSpan={8} style={{ padding: '8px 12px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              <span style={{
                                                backgroundColor: '#0E7490',
                                                color: '#FFFFFF',
                                                fontSize: '10.5px',
                                                fontWeight: '900',
                                                padding: '2.5px 8px',
                                                borderRadius: '6px',
                                                letterSpacing: '0.5px'
                                              }}>
                                                PRESET {presetIdx + 1}
                                              </span>
                                              <strong style={{ fontSize: '13px', color: '#0F766E', fontWeight: '800' }}>
                                                {sec.presetName}
                                              </strong>
                                              <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700', backgroundColor: '#E0F2FE', padding: '1px 8px', borderRadius: '4px' }}>
                                                {setCount} {pUnit} ({sec.items.length} items)
                                              </span>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                              <div style={{
                                                backgroundColor: '#CCFBF1',
                                                border: '1px solid #5EEAD4',
                                                padding: '3px 10px',
                                                borderRadius: '6px',
                                                fontSize: '11px',
                                                color: '#0F766E',
                                                fontWeight: '700',
                                                display: 'flex',
                                                gap: '8px'
                                              }}>
                                                <span>KIT VALUE: <strong>₹ {Math.round(taxable).toLocaleString('en-IN')}</strong></span>
                                                <span style={{ color: '#0D9488' }}>|</span>
                                                <span>GST ({gstPct}%): <strong>₹ {kitGst.toLocaleString('en-IN')}</strong></span>
                                                <span style={{ color: '#0D9488' }}>|</span>
                                                <span style={{ color: '#0E7490', fontWeight: '900' }}>TOTAL: ₹ {kitTotal.toLocaleString('en-IN')}</span>
                                              </div>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>

                                      {/* Preset Item Rows */}
                                      {sec.items.map(({ item: it, originalIndex }, pIdx) => {
                                        const q = (parseFloat(it.totalDispatchQty) > 0 ? parseFloat(it.totalDispatchQty) : (parseFloat(it.qty || it.bomQty || it.quantity || 0) || 0));
                                        const r = parseFloat(it.rate || it.price || 0) || 0;
                                        const taxRateStr = String(it.gstRate || it.gst || '18%').replace('%', '').trim();
                                        const taxRate = parseFloat(taxRateStr) || 18;
                                        const hasExplicitRate = r > 0;
                                        const taxableItem = q * r;
                                        const itemTotal = taxableItem + (taxableItem * (taxRate / 100));

                                        return (
                                          <tr key={originalIndex} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: pIdx % 2 === 1 ? '#F8FAFC' : '#FFFFFF' }}>
                                            <td style={{ padding: '7px 10px', color: '#64748B', fontWeight: '700', textAlign: 'center' }}>
                                              {presetIdx + 1}.{pIdx + 1}
                                            </td>
                                            <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>
                                              <div>{it.name || it.material || it.productName || 'Component'}</div>
                                              {it.category && (
                                                <div style={{ fontSize: '10px', color: '#64748B', marginTop: '1px' }}>
                                                  {it.category}
                                                </div>
                                              )}
                                              {it.subPresetName && (
                                                <div style={{ fontSize: '9.5px', color: '#0E7490', fontWeight: '600', marginTop: '1px' }}>
                                                  ↳ Sub-Kit: {it.subPresetName}
                                                </div>
                                              )}
                                            </td>
                                            <td style={{ padding: '7px 10px', color: '#64748B', textAlign: 'center' }}>{it.hsn || it.hsn_or_sac || '73089090'}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: '800', color: '#0F172A' }}>{q}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{it.uom || it.unit || 'NOS'}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                                              {hasExplicitRate ? (
                                                <span style={{ color: '#475569', fontWeight: '700' }}>₹ {r.toLocaleString('en-IN')}</span>
                                              ) : (
                                                <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '2px 7px', borderRadius: '4px', border: '1px solid #CFFAFE' }}>
                                                  Incl. in Kit
                                                </span>
                                              )}
                                            </td>
                                            <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{taxRate}%</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                                              {hasExplicitRate ? (
                                                <strong style={{ color: '#0F172A' }}>₹ {Math.round(itemTotal).toLocaleString('en-IN')}</strong>
                                              ) : (
                                                <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '2px 7px', borderRadius: '4px', border: '1px solid #CFFAFE' }}>
                                                  Incl. in Kit
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}

                                      {/* END OF PRESET DIVIDER */}
                                      <tr style={{ backgroundColor: '#F0FDFA', borderTop: '1px dashed #99F6E4', borderBottom: '2.5px solid #0E7490' }}>
                                        <td colSpan={8} style={{ padding: '8px 14px', textAlign: 'center' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                            <div style={{ height: '1.5px', flex: 1, backgroundColor: '#5EEAD4' }} />
                                            <span style={{
                                              fontSize: '11px',
                                              fontWeight: '800',
                                              color: '#0F766E',
                                              backgroundColor: '#CCFBF1',
                                              padding: '3px 12px',
                                              borderRadius: '999px',
                                              border: '1px solid #99F6E4',
                                              letterSpacing: '0.4px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '6px'
                                            }}>
                                              ✓ END OF PRESET {presetIdx + 1}: {sec.presetName} ({sec.items.length} Components • Total Kit Value: ₹ {kitTotal.toLocaleString('en-IN')})
                                            </span>
                                            <div style={{ height: '1.5px', flex: 1, backgroundColor: '#5EEAD4' }} />
                                          </div>
                                        </td>
                                      </tr>
                                    </React.Fragment>
                                  );
                                }

                                // CUSTOM / STANDALONE PRODUCTS SECTION
                                const customSecTaxable = sec.items.reduce((sum, { item }) => {
                                  const q = (parseFloat(item.totalDispatchQty) > 0 ? parseFloat(item.totalDispatchQty) : (parseFloat(item.qty || item.bomQty || item.quantity || 0) || 0));
                                  const r = parseFloat(item.rate || item.price || 0) || 0;
                                  return sum + (q * r);
                                }, 0);

                                return (
                                  <React.Fragment key="custom_section">
                                    <tr style={{ backgroundColor: '#F8FAFC', borderTop: '2.5px solid #475569', borderBottom: '1.5px solid #CBD5E1' }}>
                                      <td colSpan={8} style={{ padding: '9px 12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{
                                              backgroundColor: '#475569',
                                              color: '#FFFFFF',
                                              fontSize: '10.5px',
                                              fontWeight: '900',
                                              padding: '2.5px 8px',
                                              borderRadius: '6px',
                                              letterSpacing: '0.5px'
                                            }}>
                                              START OF NEW PRODUCTS (STANDALONE)
                                            </span>
                                            <strong style={{ fontSize: '13px', color: '#1E293B', fontWeight: '800' }}>
                                              Additional Materials / Standalone Products ({sec.items.length} items)
                                            </strong>
                                          </div>
                                          <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '700' }}>
                                            Individually Priced Components • Subtotal: ₹ {Math.round(customSecTaxable).toLocaleString('en-IN')}
                                          </span>
                                        </div>
                                      </td>
                                    </tr>

                                    {sec.items.map(({ item: it, originalIndex }, cIdx) => {
                                      const q = (parseFloat(it.totalDispatchQty) > 0 ? parseFloat(it.totalDispatchQty) : (parseFloat(it.qty || it.bomQty || it.quantity || 0) || 0));
                                      const r = parseFloat(it.rate || it.price || 0) || 0;
                                      const taxRateStr = String(it.gstRate || it.gst || '18%').replace('%', '').trim();
                                      const taxRate = parseFloat(taxRateStr) || 18;
                                      const taxableItem = q * r;
                                      const itemTotal = taxableItem + (taxableItem * (taxRate / 100));

                                      return (
                                        <tr key={originalIndex} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: cIdx % 2 === 1 ? '#F8FAFC' : '#FFFFFF' }}>
                                          <td style={{ padding: '7px 10px', color: '#64748B', fontWeight: '700', textAlign: 'center' }}>
                                            C.{cIdx + 1}
                                          </td>
                                          <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>
                                            <div>{it.name || it.material || it.productName || 'Item'}</div>
                                            {it.category && (
                                              <div style={{ fontSize: '10px', color: '#64748B', marginTop: '1px' }}>
                                                {it.category}
                                              </div>
                                            )}
                                          </td>
                                          <td style={{ padding: '7px 10px', color: '#64748B', textAlign: 'center' }}>{it.hsn || it.hsn_or_sac || '73089090'}</td>
                                          <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: '800', color: '#0F172A' }}>{q}</td>
                                          <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{it.uom || it.unit || 'NOS'}</td>
                                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#334155', fontWeight: '700' }}>
                                            ₹ {r.toLocaleString('en-IN')}
                                          </td>
                                          <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{taxRate}%</td>
                                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                                            ₹ {Math.round(itemTotal).toLocaleString('en-IN')}
                                          </td>
                                        </tr>
                                      );
                                    })}

                                    <tr style={{ backgroundColor: '#F8FAFC', borderTop: '1px dashed #CBD5E1', borderBottom: '2.5px solid #475569' }}>
                                      <td colSpan={8} style={{ padding: '7px 14px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                          <div style={{ height: '1px', flex: 1, backgroundColor: '#CBD5E1' }} />
                                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', letterSpacing: '0.4px' }}>
                                            ✓ END OF STANDALONE PRODUCTS ({sec.items.length} Items)
                                          </span>
                                          <div style={{ height: '1px', flex: 1, backgroundColor: '#CBD5E1' }} />
                                        </div>
                                      </td>
                                    </tr>
                                  </React.Fragment>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={8} style={{ padding: '16px', textAlign: 'center', color: '#94A3B8' }}>
                                  No items in this BOM order.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>

                {/* Financial Summary */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: '4px'
                }}>
                  <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                      <span>Subtotal (Taxable):</span>
                      <strong style={{ color: '#0F172A' }}>₹ {Math.round(subtotal).toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                      <span>Estimated GST (18%):</span>
                      <strong style={{ color: '#0F172A' }}>₹ {Math.round(taxTotal).toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderTop: '2px solid #0E7490',
                      paddingTop: '6px',
                      fontSize: '14px',
                      color: '#0E7490'
                    }}>
                      <span><strong>Total Order Value:</strong></span>
                      <strong style={{ fontSize: '15px' }}>₹ {Math.round(grandTotal).toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '12px 22px',
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <button
                  type="button"
                  onClick={() => setCeoBomDetailModal(null)}
                  style={{
                    padding: '7px 18px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: '12px',
                    fontWeight: '700',
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

      {/* IN-MODAL COMMERCIAL PI PREVIEW FROM CEO BOM MODAL (NO PAGE REDIRECT) */}
      {viewingPiModalFromBom && (() => {
        const { pi, returnBom } = viewingPiModalFromBom;
        const piNo = pi.piNo || pi.id || 'PI';
        const piDate = pi.date || pi.piDate || pi.createdDate || '—';
        const customer = pi.customerName || pi.customer || pi.companyName || '—';
        const salesPerson = pi.salesPerson || pi.salesperson || pi.salesRep || pi.createdBy || 'Sales Team';
        const items = Array.isArray(pi.items) ? pi.items : [];

        const grandTotal = cleanNum(pi.grandTotal || pi.totalAmount || pi.amount || pi.orderValue || pi.c5 || 0);
        const subtotal = cleanNum(pi.subtotal || pi.unitValue || pi.taxableAmount || (grandTotal > 0 ? Math.round(grandTotal / 1.18) : 0));
        const taxTotal = cleanNum(pi.taxTotal || Math.max(0, grandTotal - subtotal));
        const paymentTerms = pi.paymentTerms || pi.paymentType || pi.terms || '100% Paid';

        let presetGroupsData = pi.presetGroups || {};
        if (typeof presetGroupsData === 'string') {
          try {
            presetGroupsData = JSON.parse(presetGroupsData);
          } catch (e) {
            presetGroupsData = {};
          }
        }
        const sections = [];
        const sectionMap = new Map();

        const allZeroRates = items.length > 0 && items.every(it => (parseFloat(it.rate || it.price || 0) || 0) === 0);

        items.forEach((it, idx) => {
          const isPreset = Boolean(it.isPresetItem || it.presetGroupId || it.presetName || (allZeroRates && pi.presetName));
          const secKey = isPreset
            ? (it.presetGroupId || it.presetName || pi.presetName || 'PRESET_1')
            : '__CUSTOM_ITEMS__';

          if (!sectionMap.has(secKey)) {
            const secObj = {
              key: secKey,
              isPreset,
              presetGroupId: it.presetGroupId,
              presetName: isPreset ? (it.presetName || (it.presetGroupId && presetGroupsData[it.presetGroupId]?.presetName) || pi.presetName || 'Preset Structure Kit') : 'Custom / Standalone Products',
              items: []
            };
            sectionMap.set(secKey, secObj);
            sections.push(secObj);
          }
          sectionMap.get(secKey).items.push({ item: it, originalIndex: idx });
        });

        // Pre-compute custom items taxable sum
        const customTaxableTotal = sections
          .filter(s => !s.isPreset)
          .flatMap(s => s.items)
          .reduce((sum, { item }) => {
            const q = parseFloat(item.qty !== undefined ? item.qty : (item.quantity || 0)) || 0;
            const r = parseFloat(item.rate || item.price || 0) || 0;
            return sum + (q * r);
          }, 0);

        const presetTaxablePool = Math.max(0, subtotal - customTaxableTotal);
        const presetSections = sections.filter(s => s.isPreset);
        const presetGroupsList = Array.isArray(presetGroupsData)
          ? presetGroupsData
          : (presetGroupsData && typeof presetGroupsData === 'object' ? Object.values(presetGroupsData) : []);

        const totalComponentCount = sections.reduce((acc, s) => acc + s.items.length, 0);

        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(3px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
            onClick={() => setViewingPiModalFromBom(null)}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '20px',
                width: '920px',
                maxWidth: '100%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
                border: '1px solid #E2E8F0',
                overflow: 'hidden'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{
                padding: '16px 22px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#F8FAFC'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#ECFEFF',
                    color: '#0E7490',
                    border: '1px solid #A5F3FC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Receipt size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>
                        Proforma Invoice • {piNo}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        backgroundColor: '#F0FDF4',
                        color: '#16A34A',
                        border: '1px solid #BBF7D0'
                      }}>
                        {pi.status || 'Converted to BOM'}
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                      Commercial Sales PI • Generated on {piDate} • Executive: <strong>{salesPerson}</strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingPiModalFromBom(null)}
                  style={{
                    border: 'none',
                    background: 'none',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748B',
                    backgroundColor: '#F1F5F9'
                  }}
                  title="Close PI Details"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Info Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Customer / Client</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginTop: '3px' }}>{customer}</div>
                    {pi.customerPhone && <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>📞 {pi.customerPhone}</div>}
                  </div>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Payment Terms</div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', marginTop: '3px' }}>{paymentTerms}</div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Date: {piDate}</div>
                  </div>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Total Line Items</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginTop: '3px' }}>{totalComponentCount || items.length} Products / Kits</div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Sales Rep: {salesPerson}</div>
                  </div>
                  <div style={{ backgroundColor: '#ECFEFF', padding: '10px 12px', borderRadius: '10px', border: '1px solid #A5F3FC' }}>
                    <div style={{ fontSize: '10.5px', color: '#0E7490', fontWeight: '800', textTransform: 'uppercase' }}>PI Grand Total</div>
                    <div style={{ fontSize: '16px', fontWeight: '900', color: '#0E7490', marginTop: '3px' }}>
                      ₹ {Math.round(grandTotal).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#0E7490', marginTop: '2px' }}>Incl. GST (18%)</div>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                      Quoted Products & Preset Kits ({totalComponentCount || items.length} components)
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                      Grouped by Preset Kit with distinct pricing & boundaries
                    </div>
                  </div>

                  <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                          <th style={{ padding: '8px 10px', width: '38px', textAlign: 'center' }}>#</th>
                          <th style={{ padding: '8px 10px' }}>Product / Component</th>
                          <th style={{ padding: '8px 10px', width: '80px', textAlign: 'center' }}>HSN / SAC</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '65px' }}>Qty</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '55px' }}>UOM</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '110px' }}>Rate (₹)</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '55px' }}>GST</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', width: '110px' }}>Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sections.length > 0 ? (
                          sections.map((sec, secIdx) => {
                            if (sec.isPreset) {
                              const presetIdx = presetSections.indexOf(sec);
                              let grpConfig = (sec.presetGroupId && presetGroupsData[sec.presetGroupId]) || (presetGroupsData[sec.key]) || null;
                              if (!grpConfig && presetGroupsList.length > 0) {
                                grpConfig = presetGroupsList.find(g =>
                                  (sec.presetGroupId && (g.id === sec.presetGroupId || g.groupId === sec.presetGroupId)) ||
                                  (sec.presetName && g.presetName && g.presetName.toLowerCase().trim() === sec.presetName.toLowerCase().trim()) ||
                                  (g.name && sec.presetName && g.name.toLowerCase().trim() === sec.presetName.toLowerCase().trim())
                                ) || null;
                              }
                              const setCount = parseFloat(grpConfig?.setCount || grpConfig?.quantity || pi.presetSetCount || 1) || 1;
                              const pUnit = grpConfig?.unit || grpConfig?.unitType || pi.presetUnit || 'Sets';

                              // Calculate kit taxable
                              let taxable = 0;
                              if (grpConfig?.kitPrice && parseFloat(grpConfig.kitPrice) > 0) {
                                taxable = (parseFloat(grpConfig.kitPrice) || 0) * setCount;
                              } else if (pi.presetKitPrice && parseFloat(pi.presetKitPrice) > 0) {
                                taxable = (parseFloat(pi.presetKitPrice) || 0) * setCount;
                              } else if (pi.unitValue && parseFloat(pi.unitValue) > 0) {
                                taxable = parseFloat(pi.unitValue) || 0;
                              } else if (pi.kitSubtotal && parseFloat(pi.kitSubtotal) > 0) {
                                taxable = parseFloat(pi.kitSubtotal) || 0;
                              } else if (presetSections.length === 1) {
                                taxable = presetTaxablePool || (grandTotal > 0 ? Math.round(grandTotal / 1.18) : 0);
                              } else if (presetSections.length > 0) {
                                taxable = Math.round(presetTaxablePool / presetSections.length);
                              }

                              const rawGst = grpConfig?.gstRate || sec.items[0]?.item?.gstRate || pi.gstRate || '18%';
                              const gstPct = parseFloat(String(rawGst).replace('%', '').trim()) || 18;
                              const kitGst = Math.round(taxable * (gstPct / 100));
                              const kitTotal = Math.round(taxable + kitGst);

                              return (
                                <React.Fragment key={sec.key || secIdx}>
                                  {/* PRESET HEADER BANNER */}
                                  <tr style={{ backgroundColor: '#F0FDFA', borderTop: '2.5px solid #0E7490', borderBottom: '1.5px solid #A5F3FC' }}>
                                    <td colSpan={8} style={{ padding: '9px 12px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{
                                            backgroundColor: '#0E7490',
                                            color: '#FFFFFF',
                                            fontSize: '10.5px',
                                            fontWeight: '900',
                                            padding: '2.5px 8px',
                                            borderRadius: '6px',
                                            letterSpacing: '0.5px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                          }}>
                                            <Boxes size={12} />
                                            PRESET {presetIdx + 1}
                                          </span>
                                          <strong style={{ fontSize: '13px', color: '#0F172A', fontWeight: '800' }}>
                                            {sec.presetName}
                                          </strong>
                                          <span style={{
                                            fontSize: '11px',
                                            color: '#0E7490',
                                            fontWeight: '700',
                                            backgroundColor: '#ECFEFF',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            border: '1px solid #A5F3FC'
                                          }}>
                                            Total Qty: {setCount} {pUnit} ({sec.items.length} components)
                                          </span>
                                        </div>

                                        <div style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '10px',
                                          backgroundColor: '#FFFFFF',
                                          border: '1.5px solid #0E7490',
                                          borderRadius: '8px',
                                          padding: '4px 12px',
                                          boxShadow: '0 1px 3px rgba(14, 116, 144, 0.08)'
                                        }}>
                                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                            <span style={{ fontSize: '9.5px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>KIT VALUE:</span>
                                            <strong style={{ fontSize: '12.5px', color: '#0F172A', fontWeight: '900' }}>
                                              ₹ {Math.round(taxable).toLocaleString('en-IN')}
                                            </strong>
                                          </div>
                                          <span style={{ color: '#CBD5E1', fontWeight: '300' }}>|</span>
                                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                            <span style={{ fontSize: '9.5px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>GST ({gstPct}%):</span>
                                            <strong style={{ fontSize: '11.5px', color: '#0F172A', fontWeight: '800' }}>
                                              ₹ {kitGst.toLocaleString('en-IN')}
                                            </strong>
                                          </div>
                                          <span style={{ color: '#CBD5E1', fontWeight: '300' }}>|</span>
                                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                            <span style={{ fontSize: '9.5px', color: '#0E7490', fontWeight: '800', textTransform: 'uppercase' }}>TOTAL:</span>
                                            <strong style={{ fontSize: '13.5px', color: '#0E7490', fontWeight: '900' }}>
                                              ₹ {kitTotal.toLocaleString('en-IN')}
                                            </strong>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>

                                  {/* Individual Component Items */}
                                  {sec.items.map(({ item: it, originalIndex }, cIdx) => {
                                    const q = parseFloat(it.qty !== undefined ? it.qty : (it.quantity || 0)) || 0;
                                    const r = parseFloat(it.rate || it.price || 0) || 0;
                                    const taxRateStr = String(it.gstRate || it.gst || '18%').replace('%', '').trim();
                                    const taxRate = parseFloat(taxRateStr) || gstPct;
                                    const hasExplicitRate = r > 0;
                                    const taxableItem = q * r;
                                    const itemTotal = taxableItem + (taxableItem * (taxRate / 100));

                                    return (
                                      <tr key={originalIndex} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: cIdx % 2 === 1 ? '#FAFDFD' : '#FFFFFF' }}>
                                        <td style={{ padding: '7px 10px', color: '#64748B', fontWeight: '700', textAlign: 'center' }}>
                                          {presetIdx + 1}.{cIdx + 1}
                                        </td>
                                        <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>
                                          <div>{it.name || it.productName || 'Item'}</div>
                                          {it.subPresetName && (
                                            <div style={{ fontSize: '10px', color: '#0D9488', fontWeight: '700', marginTop: '1px' }}>
                                              ↳ Sub-Kit: {it.subPresetName}
                                            </div>
                                          )}
                                        </td>
                                        <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{it.hsn || it.hsnSac || '73089090'}</td>
                                        <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: '800', color: '#0F172A' }}>{q}</td>
                                        <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{it.uom || it.unit || 'NOS'}</td>
                                        <td style={{ padding: '7px 10px', textAlign: 'center', color: hasExplicitRate ? '#0F172A' : '#94A3B8' }}>
                                          {hasExplicitRate ? `₹ ${r.toLocaleString('en-IN')}` : '—'}
                                        </td>
                                        <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{taxRate}%</td>
                                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                                          {hasExplicitRate ? (
                                            `₹ ${Math.round(itemTotal).toLocaleString('en-IN')}`
                                          ) : (
                                            <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '2px 7px', borderRadius: '4px', border: '1px solid #CFFAFE' }}>
                                              Incl. in Kit
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}

                                  {/* END OF PRESET DIVIDER */}
                                  <tr style={{ backgroundColor: '#F0FDFA', borderTop: '1px dashed #99F6E4', borderBottom: '2.5px solid #0E7490' }}>
                                    <td colSpan={8} style={{ padding: '8px 14px', textAlign: 'center' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                        <div style={{ height: '1.5px', flex: 1, backgroundColor: '#5EEAD4' }} />
                                        <span style={{
                                          fontSize: '11px',
                                          fontWeight: '800',
                                          color: '#0F766E',
                                          backgroundColor: '#CCFBF1',
                                          padding: '3px 12px',
                                          borderRadius: '999px',
                                          border: '1px solid #99F6E4',
                                          letterSpacing: '0.4px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px'
                                        }}>
                                          ✓ END OF PRESET {presetIdx + 1}: {sec.presetName} ({sec.items.length} Components • Kit Value: ₹ {kitTotal.toLocaleString('en-IN')})
                                        </span>
                                        <div style={{ height: '1.5px', flex: 1, backgroundColor: '#5EEAD4' }} />
                                      </div>
                                    </td>
                                  </tr>
                                </React.Fragment>
                              );
                            }

                            // CUSTOM / STANDALONE PRODUCTS SECTION
                            const customSecTaxable = sec.items.reduce((sum, { item }) => {
                              const q = parseFloat(item.qty !== undefined ? item.qty : (item.quantity || 0)) || 0;
                              const r = parseFloat(item.rate || item.price || 0) || 0;
                              return sum + (q * r);
                            }, 0);

                            return (
                              <React.Fragment key={sec.key || 'custom_section'}>
                                <tr style={{ backgroundColor: '#F8FAFC', borderTop: '2.5px solid #475569', borderBottom: '1.5px solid #CBD5E1' }}>
                                  <td colSpan={8} style={{ padding: '9px 12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{
                                          backgroundColor: '#475569',
                                          color: '#FFFFFF',
                                          fontSize: '10.5px',
                                          fontWeight: '900',
                                          padding: '2.5px 8px',
                                          borderRadius: '6px',
                                          letterSpacing: '0.5px'
                                        }}>
                                          START OF NEW PRODUCTS (STANDALONE)
                                        </span>
                                        <strong style={{ fontSize: '13px', color: '#0F172A', fontWeight: '800' }}>
                                          Additional Materials / Standalone Products ({sec.items.length} items)
                                        </strong>
                                      </div>
                                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '700' }}>
                                        Individually Priced Components • Subtotal: ₹ {Math.round(customSecTaxable).toLocaleString('en-IN')}
                                      </span>
                                    </div>
                                  </td>
                                </tr>

                                {sec.items.map(({ item: it, originalIndex }, cIdx) => {
                                  const q = parseFloat(it.qty !== undefined ? it.qty : (it.quantity || 0)) || 0;
                                  const r = parseFloat(it.rate || it.price || 0) || 0;
                                  const taxRateStr = String(it.gstRate || it.gst || '18%').replace('%', '').trim();
                                  const taxRate = parseFloat(taxRateStr) || 18;
                                  const taxableItem = q * r;
                                  const itemTotal = taxableItem + (taxableItem * (taxRate / 100));

                                  return (
                                    <tr key={originalIndex} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: cIdx % 2 === 1 ? '#F8FAFC' : '#FFFFFF' }}>
                                      <td style={{ padding: '7px 10px', color: '#64748B', fontWeight: '700', textAlign: 'center' }}>
                                        C.{cIdx + 1}
                                      </td>
                                      <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>
                                        <div>{it.name || it.productName || 'Item'}</div>
                                        {it.description && <div style={{ fontSize: '10px', color: '#64748B' }}>{it.description}</div>}
                                      </td>
                                      <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{it.hsn || it.hsnSac || '73089090'}</td>
                                      <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: '800', color: '#0F172A' }}>{q}</td>
                                      <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{it.uom || it.unit || 'NOS'}</td>
                                      <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: '700', color: '#0F172A' }}>
                                        ₹ {r.toLocaleString('en-IN')}
                                      </td>
                                      <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{taxRate}%</td>
                                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                                        ₹ {Math.round(itemTotal).toLocaleString('en-IN')}
                                      </td>
                                    </tr>
                                  );
                                })}

                                <tr style={{ backgroundColor: '#F8FAFC', borderTop: '1px dashed #CBD5E1', borderBottom: '2.5px solid #475569' }}>
                                  <td colSpan={8} style={{ padding: '7px 14px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                      <div style={{ height: '1px', flex: 1, backgroundColor: '#CBD5E1' }} />
                                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', letterSpacing: '0.4px' }}>
                                        ✓ END OF STANDALONE PRODUCTS ({sec.items.length} Items)
                                      </span>
                                      <div style={{ height: '1px', flex: 1, backgroundColor: '#CBD5E1' }} />
                                    </div>
                                  </td>
                                </tr>
                              </React.Fragment>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={8} style={{ padding: '16px', textAlign: 'center', color: '#94A3B8' }}>
                              No line items found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Summary */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: '4px'
                }}>
                  <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                      <span>Subtotal (Taxable):</span>
                      <strong style={{ color: '#0F172A' }}>₹ {Math.round(subtotal).toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                      <span>Estimated GST (18%):</span>
                      <strong style={{ color: '#0F172A' }}>₹ {Math.round(taxTotal).toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderTop: '2px solid #0E7490',
                      paddingTop: '6px',
                      fontSize: '14px',
                      color: '#0E7490'
                    }}>
                      <span><strong>Total Quoted:</strong></span>
                      <strong style={{ fontSize: '15px' }}>₹ {Math.round(grandTotal).toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '12px 22px',
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {returnBom && (
                    <button
                      type="button"
                      onClick={() => {
                        setViewingPiModalFromBom(null);
                        setCeoBomDetailModal(returnBom);
                      }}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        border: '1px solid #BAE6FD',
                        backgroundColor: '#F0F9FF',
                        color: '#0284C7',
                        fontSize: '11.5px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                      title="Return to the BOM Order modal"
                    >
                      ← Back to BOM ({returnBom.bomCode || returnBom.code || 'BOM'})
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setViewingPiModalFromBom(null)}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#475569',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* EXECUTIVE 360° ORDER DOSSIER MODAL */}
      {executiveDossierOrder && (
        <ExecutiveOrderDossierModal
          order={executiveDossierOrder}
          onClose={() => setExecutiveDossierOrder(null)}
        />
      )}
    </>
  );
}
