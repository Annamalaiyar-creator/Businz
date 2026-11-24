import React from "react";
import {
  AlertCircle, Ban, Boxes, CheckCircle, Clock, Edit3, FileText, Package
} from "lucide-react";
import StatusBadge from "../StatusBadge";

export default function DcReadOnlyDocument(props) {
  const {
    activeDc,
    setViewMode,
    handleStartEdit,
    handleOpenReturnModal,
    cancellingDc,
    setCancellingDc,
    cancellationRemarkInput,
    setCancellationRemarkInput,
    handleConfirmCancel,
    cancelSubmitting
  } = props;

  if (!activeDc) return null;

  return (
    <>
<div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* View Details Header */}
          <div className="dc-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                  View Delivery Challan: {activeDc.dcNo || activeDc.code || activeDc.id}
                </h2>
                <StatusBadge status={activeDc.status || 'Draft'} size="sm" />
              </div>
              <span style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                Issued by {activeDc.companyName} on {activeDc.dcDate || activeDc.date}.
              </span>
            </div>
          </div>

          {/* Cancellation Notice if Cancelled */}
          {String(activeDc.status || '').toLowerCase().includes('cancel') && (
            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '10px',
              padding: '12px 18px',
              color: '#991B1B',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertCircle size={18} style={{ color: '#DC2626', flexShrink: 0 }} />
              <div>
                <strong>THIS DELIVERY CHALLAN HAS BEEN CANCELLED</strong>
                <div style={{ fontSize: '12px', marginTop: '2px' }}>
                  Remark: {activeDc.cancellationRemark || activeDc.cancelReason || 'No remark provided'}
                </div>
              </div>
            </div>
          )}

          {/* Official Delivery Challan Header Card (Exact section-card styling from PO) */}
          <div
            id="businz-dc-official-document"
            className="section-card businz-dc-document"
            style={{
              padding: '30px',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              position: 'relative',
              borderTop: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box'
            }}
          >
            {/* Header Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#1E293B', margin: 0, letterSpacing: '-0.5px' }}>
                  {activeDc.companyName}
                </h1>
                <div style={{ marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>{activeDc.companyAddress}</span>
                </div>
                <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '2px' }}>
                  GSTIN: <strong>{activeDc.companyGst}</strong> | State: {activeDc.sourceOfSupply || 'Tamil Nadu'}
                </span>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block',
                  backgroundColor: '#0E7490',
                  color: '#FFFFFF',
                  padding: '4px 14px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '900',
                  letterSpacing: '1px',
                  textTransform: 'uppercase'
                }}>
                  DELIVERY CHALLAN
                </span>
                <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '700', marginTop: '4px' }}>
                  (RULE 55 OF CGST RULES, 2017)
                </div>
                <div style={{ marginTop: '6px', fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                  DC No: {activeDc.dcNo || activeDc.code}
                </div>
                <div style={{ fontSize: '12px', color: '#475569' }}>
                  Date: <strong>{activeDc.dcDate || activeDc.date}</strong>
                </div>
              </div>
            </div>

            {/* 3-Column Info Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '18px',
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              padding: '16px',
              fontSize: '12px',
              border: '1px solid #E2E8F0'
            }}>
              <div>
                <strong style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Consignee / Deliver To
                </strong>
                <span style={{ color: '#0F172A', fontWeight: '800', fontSize: '13px', display: 'block' }}>{activeDc.customerName || 'Customer'}</span>
                {(activeDc.vendorGst || activeDc.gstNo || activeDc.gstin) && (
                  <div style={{ color: '#0E7490', fontWeight: '800', fontSize: '11px', marginTop: '3px', marginBottom: '3px', display: 'inline-block', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', borderRadius: '4px', padding: '1px 6px' }}>
                    GSTIN: <span>{activeDc.vendorGst || activeDc.gstNo || activeDc.gstin}</span>
                  </div>
                )}
                <span style={{ color: '#334155', lineHeight: '1.4', display: 'block', marginTop: '2px' }}>
                  {activeDc.deliveryAddress}
                </span>
              </div>

              <div>
                <strong style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Transport & Logistics
                </strong>
                <div style={{ color: '#334155', lineHeight: '1.6' }}>
                  <div>Vehicle No: <strong>{activeDc.vehicleNo || '—'}</strong></div>
                  <div>Transporter: <strong>{activeDc.transporter || 'Direct Fleet'}</strong></div>
                  <div>LR / Consignment#: <strong>{activeDc.lrNo || '—'}</strong></div>
                </div>
              </div>

              <div>
                <strong style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Challan Details
                </strong>
                <div style={{ color: '#334155', lineHeight: '1.6' }}>
                  <div>Challan Type: <strong>{activeDc.challanType || 'Job Work'}</strong></div>
                  <div>Reference#: <strong>{activeDc.referenceNo || '—'}</strong></div>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0E7490', color: '#FFFFFF', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 10px', width: '30px' }}>#</th>
                    <th style={{ padding: '8px 10px' }}>Description of Goods</th>
                    <th style={{ padding: '8px 10px', width: '80px' }}>Brand</th>
                    <th style={{ padding: '8px 10px', width: '70px' }}>WP</th>
                    <th style={{ padding: '8px 10px', width: '70px', textAlign: 'right' }}>Qty</th>
                    <th style={{ padding: '8px 10px', width: '85px', textAlign: 'right' }}>Rate (₹)</th>
                    <th style={{ padding: '8px 10px', width: '75px', textAlign: 'right' }}>Tax %</th>
                    <th style={{ padding: '8px 10px', width: '100px', textAlign: 'right' }}>Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(activeDc.items) && activeDc.items.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '8px 10px', color: '#64748B' }}>{idx + 1}</td>
                      <td style={{ padding: '8px 10px', fontWeight: '600', color: '#0F172A' }}>
                        {it.name}
                        {it.description && <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 'normal' }}>{it.description}</div>}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#475569' }}>{it.brand || 'VRM'}</td>
                      <td style={{ padding: '8px 10px', color: '#475569' }}>{it.wp || '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }}>
                        {Number(it.qty || it.dcQty || 1).toLocaleString('en-IN')} {it.unit || ''}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>
                        ₹ {Number(it.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>
                        {it.tax !== undefined ? `${it.tax}%` : '18%'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>
                        ₹ {Number(it.amount || ((it.qty || 1) * (it.rate || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations & Statutory Declaration Footer */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: '20px', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
              <div>
                <strong style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Statutory Rule 55 Declaration & Notes
                </strong>
                <p style={{ margin: 0, fontSize: '11px', color: '#334155', lineHeight: '1.4' }}>
                  The goods described above are being transported strictly under Rule 55 of the CGST Rules, 2017. This transaction represents goods movement for {activeDc.challanType || 'Job Work / Approval'} and does not constitute a sale. No sales consideration is payable on this delivery challan.
                </p>
                {activeDc.customerNotes && (
                  <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#475569' }}>
                    <strong>Customer Notes:</strong> {activeDc.customerNotes}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px', color: '#475569', textAlign: 'right' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <strong>₹ {Number(activeDc.subtotal || activeDc.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
                {activeDc.discountPct > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Discount ({activeDc.discountPct}%):</span>
                    <strong>- ₹ {((Number(activeDc.subtotal || 0) * activeDc.discountPct) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                )}
                {activeDc.totalTax > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>GST Amount:</span>
                    <strong>₹ {Number(activeDc.totalTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                )}
                {activeDc.adjustment !== 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Adjustment:</span>
                    <strong>₹ {Number(activeDc.adjustment || 0).toFixed(2)}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0E7490', paddingTop: '6px', fontSize: '14px', color: '#0F172A' }}>
                  <strong>Total Value:</strong>
                  <strong style={{ color: '#0E7490' }}>₹ {Number(activeDc.totalAmount || activeDc.totalValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>
            </div>

            {/* Signatures Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '20px',
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px dashed #CBD5E1',
              textAlign: 'center',
              fontSize: '11px',
              color: '#64748B'
            }}>
              <div>
                <div style={{ height: '36px' }}></div>
                <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '4px', fontWeight: '700', color: '#334155' }}>
                  Prepared By (Procurement)
                </div>
              </div>
              <div>
                <div style={{ height: '36px' }}></div>
                <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '4px', fontWeight: '700', color: '#334155' }}>
                  Dispatched By (Logistics / Stores)
                </div>
              </div>
              <div>
                <div style={{ height: '36px' }}></div>
                <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '4px', fontWeight: '700', color: '#334155' }}>
                  Received & Acknowledged By Consignee
                </div>
              </div>
            </div>

          </div>

          {/* ==================== JOB WORK RETURN TRACKING & HISTORY CARD ==================== */}
          {(() => {
            const allItems = Array.isArray(activeDc.items) ? activeDc.items : [];
            const returnsList = Array.isArray(activeDc.returns) ? activeDc.returns : [];

            // Compute per-item return stats
            let totalSent = 0;
            let totalReturned = 0;

            const itemStats = allItems.map((it, idx) => {
              const sentQty = Number(it.qty || it.dcQty || 1);
              totalSent += sentQty;
              const matchingReturnedItems = [];
              const retQty = returnsList.reduce((sum, ret) => {
                const matchedList = (ret.returnedItems || []).filter(r => (
                  (r.sentItemIdx !== undefined ? r.sentItemIdx === idx : r.itemIdx === idx) ||
                  r.sentItemName === it.name ||
                  r.itemName === it.name
                ));
                matchedList.forEach(m => matchingReturnedItems.push(m));
                return sum + matchedList.reduce((s, m) => s + Number(m.returnedQty || 0), 0);
              }, 0);
              totalReturned += retQty;
              const balance = Math.max(0, sentQty - retQty);
              const receivedNames = Array.from(new Set(
                matchingReturnedItems
                  .map(m => m.receivedItemName || m.itemName)
                  .filter(n => n && n !== (it.name || it.description))
              ));
              return {
                ...it,
                idx,
                sentQty,
                retQty,
                balance,
                receivedNames
              };
            });

            const totalBalance = Math.max(0, totalSent - totalReturned);
            const isFullyReturned = totalSent > 0 && totalBalance === 0;
            const isPartiallyReturned = totalReturned > 0 && totalBalance > 0;
            const isCancelled = String(activeDc.status || '').toLowerCase().includes('cancel');

            return (
              <div className="section-card dc-no-print" style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}>
                {/* Header & Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: '#EFF6FF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#2563EB'
                    }}>
                      <Boxes size={20} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#1E293B' }}>
                        Job Work Return Tracking & Reconciliation
                      </h3>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>
                        Track materials sent for processing under Rule 55 and received back into inventory.
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {isFullyReturned ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        backgroundColor: '#DCFCE7',
                        color: '#15803D',
                        fontSize: '12px',
                        fontWeight: '700'
                      }}>
                        <CheckCircle size={14} /> Full Return Received (Settled)
                      </span>
                    ) : isPartiallyReturned ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        backgroundColor: '#FEF3C7',
                        color: '#B45309',
                        fontSize: '12px',
                        fontWeight: '700'
                      }}>
                        <Clock size={14} /> Partially Returned ({totalReturned}/{totalSent})
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        backgroundColor: '#F1F5F9',
                        color: '#475569',
                        fontSize: '12px',
                        fontWeight: '700'
                      }}>
                        <Clock size={14} /> Awaiting Return from Vendor
                      </span>
                    )}

                    {!isCancelled && !isFullyReturned && (
                      <button
                        type="button"
                        onClick={() => handleOpenReturnModal(activeDc)}
                        style={{
                          backgroundColor: '#0E7490',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '7px 16px',
                          fontSize: '12.5px',
                          fontWeight: '700',
                          color: '#FFFFFF',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 4px rgba(14,116,144,0.2)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0891B2'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0E7490'}
                      >
                        <Package size={14} /> Record Return Entry
                      </button>
                    )}
                  </div>
                </div>

                {/* 3 Summary Cards */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '14px'
                }}>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Total Quantity Sent</span>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#1E293B', marginTop: '4px' }}>
                      {totalSent.toLocaleString('en-IN')} <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#64748B' }}>units</span>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#F0FDF4', padding: '14px 16px', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
                    <span style={{ fontSize: '11px', color: '#15803D', fontWeight: '700', textTransform: 'uppercase' }}>Total Received Back</span>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#15803D', marginTop: '4px' }}>
                      {totalReturned.toLocaleString('en-IN')} <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#15803D' }}>units</span>
                    </div>
                  </div>

                  <div style={{ backgroundColor: totalBalance > 0 ? '#FFFBEB' : '#F8FAFC', padding: '14px 16px', borderRadius: '10px', border: totalBalance > 0 ? '1px solid #FDE68A' : '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '11px', color: totalBalance > 0 ? '#92400E' : '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Remaining with Vendor</span>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: totalBalance > 0 ? '#B45309' : '#059669', marginTop: '4px' }}>
                      {totalBalance.toLocaleString('en-IN')} <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#64748B' }}>units</span>
                    </div>
                  </div>
                </div>

                {/* Per-Item Reconciliation Table */}
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#334155', margin: '0 0 10px 0' }}>
                    Item-wise Return Status
                  </h4>
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F8FAFC', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>
                          <th style={{ padding: '8px 12px' }}>S.No</th>
                          <th style={{ padding: '8px 12px' }}>Item Description</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Sent Qty</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Returned Qty</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Balance Pending</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemStats.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: idx === itemStats.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748B' }}>{idx + 1}</td>
                            <td style={{ padding: '8px 12px', fontWeight: '600', color: '#1E293B' }}>
                              <div>{item.name || item.description}</div>
                              {item.receivedNames && item.receivedNames.length > 0 && (
                                <div style={{ fontSize: '11px', color: '#0E7490', fontWeight: '600', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span>↳ Inwarded as:</span>
                                  <span style={{ backgroundColor: '#ECFEFF', padding: '1px 6px', borderRadius: '4px', border: '1px solid #CFFAFE' }}>
                                    {item.receivedNames.join(', ')}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600' }}>{item.sentQty} {item.unit || ''}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: '#15803D' }}>{item.retQty} {item.unit || ''}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: item.balance > 0 ? '#B45309' : '#059669' }}>
                              {item.balance} {item.unit || ''}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              {item.balance === 0 ? (
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#15803D', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '10px' }}>
                                  Fully Returned
                                </span>
                              ) : item.retQty > 0 ? (
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#B45309', backgroundColor: '#FEF3C7', padding: '2px 8px', borderRadius: '10px' }}>
                                  Partial
                                </span>
                              ) : (
                                <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748B', backgroundColor: '#F1F5F9', padding: '2px 8px', borderRadius: '10px' }}>
                                  Pending
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Return Consignments Log */}
                {returnsList.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#334155', margin: '0 0 10px 0' }}>
                      Return Consignments Inwarded ({returnsList.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {returnsList.map((ret, rIdx) => (
                        <div key={rIdx} style={{
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          borderRadius: '8px',
                          padding: '12px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#0E7490', color: '#FFFFFF', padding: '2px 8px', borderRadius: '4px' }}>
                                #{rIdx + 1}
                              </span>
                              <strong style={{ fontSize: '13px', color: '#0F172A' }}>
                                Return Date: {ret.returnDate}
                              </strong>
                              {ret.returnRef && (
                                <span style={{ fontSize: '12px', color: '#64748B' }}>
                                  (Ref: <strong>{ret.returnRef}</strong>)
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '11.5px', color: '#475569' }}>
                              Received By: <strong>{ret.receivedBy}</strong>
                            </span>
                          </div>

                          {/* Items in this return */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                            {(ret.returnedItems || []).map((ri, riIdx) => {
                              const isDiff = ri.sentItemName && ri.sentItemName !== (ri.receivedItemName || ri.itemName);
                              return (
                                <span key={riIdx} style={{
                                  fontSize: '11px',
                                  backgroundColor: '#FFFFFF',
                                  border: '1px solid #CBD5E1',
                                  borderRadius: '6px',
                                  padding: '3px 8px',
                                  color: '#334155',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <strong style={{ color: '#0E7490' }}>{ri.receivedItemName || ri.itemName}</strong>
                                  {isDiff && (
                                    <span style={{ color: '#64748B', fontSize: '10.5px' }}>
                                      (from {ri.sentItemName})
                                    </span>
                                  )}
                                  <span style={{ fontWeight: '700', color: '#15803D' }}>
                                    +{ri.returnedQty} {ri.unit || ''}
                                  </span>
                                </span>
                              );
                            })}
                          </div>

                          {ret.remarks && (
                            <div style={{ fontSize: '11px', color: '#64748B', fontStyle: 'italic', marginTop: '2px' }}>
                              Notes: {ret.remarks}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Sticky Bottom Action Bar Following with Scroll for View Delivery Challan */}
          <div
            className="dc-no-print"
            style={{
              position: 'sticky',
              bottom: 0,
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderTop: '1.5px solid #CBD5E1',
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              zIndex: 50,
              boxShadow: '0 -4px 16px rgba(15, 23, 42, 0.08)',
              borderRadius: '12px',
              marginTop: '16px',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* 1. Back to DC List */}
              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              >
                Back to DC List
              </button>

              {/* 2. Receive Back Button */}
              {!['cancelled', 'closed'].some(s => String(activeDc.status || '').toLowerCase().includes(s)) && (
                <button
                  type="button"
                  onClick={() => handleOpenReturnModal(activeDc)}
                  style={{
                    backgroundColor: '#0E7490',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 18px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    boxShadow: '0 2px 6px rgba(14,116,144,0.3)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0891B2'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0E7490'}
                >
                  <Package size={15} /> Receive Back
                </button>
              )}

              {/* 3. Edit Info */}
              {!String(activeDc.status || '').toLowerCase().includes('cancel') && (
                <button
                  type="button"
                  onClick={() => handleStartEdit(activeDc)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                >
                  <Edit3 size={14} style={{ color: '#64748B' }} /> Edit Info
                </button>
              )}

              {/* 4. Export / Print PDF */}
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              >
                <FileText size={14} style={{ color: '#059669' }} /> Export / Print PDF
              </button>
            </div>

            {/* Right: Total Value Display */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>DC Total:</span>
              <strong style={{ fontSize: '15px', color: '#0E7490', fontWeight: '800' }}>
                ₹ {Number(activeDc.totalAmount || activeDc.totalValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </strong>
            </div>
          </div>

        </div>

      {/* ==================== MODAL: CANCEL DELIVERY CHALLAN ==================== */}
      {cancellingDc && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#FEF2F2' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                <Ban size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#991B1B' }}>
                  Cancel Delivery Challan
                </h3>
                <span style={{ fontSize: '12px', color: '#7F1D1D' }}>
                  DC No: <strong>{cancellingDc.dcNo || cancellingDc.id}</strong>
                </span>
              </div>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.4' }}>
                Cancelling this Delivery Challan will mark its status as <strong>Cancelled</strong> and restore any outward-deducted inventory stock back into available stores.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#0F172A', marginBottom: '6px' }}>
                  Cancellation Remark / Reason <span style={{ color: '#EF4444' }}>* (Mandatory)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Specify why this delivery challan is being cancelled (e.g. Order cancelled by client, incorrect items loaded, duplicate challan)..."
                  value={cancellationRemarkInput}
                  onChange={(e) => setCancellationRemarkInput(e.target.value)}
                  style={{
                    width: '100%',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '10px 12px',
                    fontSize: '13px',
                    color: '#1E293B',
                    outline: 'none',
                    fontFamily: 'inherit',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid #F1F5F9', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => { setCancellingDc(null); setCancellationRemarkInput(''); }}
                disabled={cancelSubmitting}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelSubmitting || !cancellationRemarkInput.trim()}
                style={{
                  backgroundColor: (!cancellationRemarkInput.trim() || cancelSubmitting) ? '#FCA5A5' : '#DC2626',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#FFFFFF',
                  cursor: (!cancellationRemarkInput.trim() || cancelSubmitting) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {cancelSubmitting ? 'Cancelling…' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
