import React from 'react';
import { AlertTriangle, Edit, ExternalLink, Eye, FileText, Filter, HelpCircle, Image, Receipt, Split, Target, Trash2, UploadCloud, X } from 'lucide-react';
import StatusBadge from '../StatusBadge';

export default function GrnInwardingFormCards(props) {
  const {
    grnItems = [],
    setGrnItems,
    selectedGrnForModal,
    editingGrnId,
    receiptDate,
    setReceiptDate,
    isViewOnlyMode,
    livePOs = [],
    selectedGRNPo,
    selectedGRNVendor,
    grnChallanNo,
    setGrnChallanNo,
    challanDate,
    setChallanDate,
    handleOpenPoModal,
    itemsList = [],
    poReceivingHistory = [],
    grnDocs = [],
    setGrnDocs,
    deleteDocConfirmIdx = null,
    setDeleteDocConfirmIdx,
    activeDocPreviewModal = null,
    setActiveDocPreviewModal,
    grnCreatedBy = "",
    getLoggedInUserName = () => "",
    grnReceivedBy = "",
    setGrnReceivedBy,
    mergePoReceivingHistory = () => [],
    inferInventoryType = () => "",
    loadPOItems = () => {},
  } = props;

    const renderGrnFormCards = () => {
    const totalOrdered = grnItems.reduce((acc, it) => acc + (it.isSplitChild ? 0 : (Number(it.ordered) || 0)), 0);
    const totalPrev = grnItems.reduce((acc, it) => acc + (it.isSplitChild ? 0 : (Number(it.prev) || 0)), 0);
    const totalNow = grnItems.reduce((acc, it) => acc + (it.isPoReference ? 0 : Number(it.now || 0)), 0);
    const totalAccepted = grnItems.reduce((acc, it) => acc + (it.isPoReference ? 0 : Number(it.accepted || 0)), 0);
    const totalRejected = grnItems.reduce((acc, it) => acc + (it.isPoReference ? 0 : Number(it.rejected || 0)), 0);

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '20px' }}>

                  {/* Card 1: 1. GRN Information (Span 6) */}
                  <div className="section-card" style={{ gridColumn: 'span 6', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800', flexShrink: 0 }}>
                        1
                      </div>
                      <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        GRN INFORMATION
                      </h3>
                      <HelpCircle style={{ width: '14px', height: '14px', color: '#94A3B8' }} />
                    </div>

                    {/* Row 1: GRN No & Receipt Date */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="goods-receipt-note-grn-no" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>GRN No.</label>
                        <input
                          id="goods-receipt-note-grn-no"
                          name="gRNNo"
                          aria-label="GRN No."
                          type="text"
                          value={selectedGrnForModal?.id || selectedGrnForModal?.grnNo || editingGrnId || 'Auto-generated'}
                          disabled
                          style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: '#F8FAFC', color: '#0F172A', fontWeight: '600' }}
                        />
                        <span style={{ fontSize: '10px', color: '#94A3B8' }}>{selectedGrnForModal || editingGrnId ? 'Official GRN Reference' : 'Auto-generated'}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="goods-receipt-note-receipt-date" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>
                          Receipt Date <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        <input
                          id="goods-receipt-note-receipt-date"
                          name="receiptDate"
                          aria-label="Receipt Date"
                          type="date"
                          value={selectedGrnForModal?.date || receiptDate}
                          disabled={isViewOnlyMode}
                          onChange={(e) => setReceiptDate(e.target.value)}
                          style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: isViewOnlyMode ? '#F8FAFC' : '#FFFFFF', color: '#334155' }}
                        />
                      </div>
                    </div>

                    {/* Row 2: Purchase Order & Vendor */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                        <label htmlFor="goods-receipt-note-purchase-order" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>
                          Purchase Order <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        {isViewOnlyMode ? (
                          <input
                            type="text"
                            value={selectedGRNPo || selectedGrnForModal?.poRef || '—'}
                            disabled
                            style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: '#F8FAFC', color: '#0F172A', fontWeight: '600' }}
                          />
                        ) : (
                          <select
                            id="goods-receipt-note-purchase-order"
                            name="purchaseOrder"
                            aria-label="Purchase Order"
                            value={selectedGRNPo}
                            onChange={(e) => {
                              const poNo = e.target.value;
                              loadPOItems(poNo);
                            }}
                            style={{ height: '38px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 8px', fontSize: '12px', backgroundColor: '#FFFFFF', color: '#334155', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                          >
                            {(() => {
                              const eligiblePOs = livePOs.filter(po => {
                                const isSelected = po.poNo === selectedGRNPo || po.id === selectedGRNPo;
                                const s = String(po.status || '').toUpperCase();
                                const sType = String(po.statusType || '').toLowerCase();

                                const isClosed = s.includes('CLOSED') || s.includes('FULLY RECEIVED') || sType === 'closed';
                                if (isClosed && !isSelected) return false;

                                // Strictly only POs that reached "Proceed PO" or are already partially received in GRN
                                const isProceedPo = s === 'PROCEED PO' || sType === 'proceed_po';
                                const isPartiallyReceived = s.includes('PARTIALLY') || sType === 'partially_received';

                                return isSelected || isProceedPo || isPartiallyReceived;
                              });

                              const hasSelected = eligiblePOs.some(p => p.poNo === selectedGRNPo || p.id === selectedGRNPo);
                              const matchedTarget = livePOs.find(p => p.poNo === selectedGRNPo || p.id === selectedGRNPo);
                              const displayList = (!hasSelected && selectedGRNPo)
                                ? [{ poNo: selectedGRNPo, id: selectedGRNPo, vendor: selectedGRNVendor || matchedTarget?.vendor || 'Vendor', status: matchedTarget?.status || 'Proceed PO' }, ...eligiblePOs]
                                : eligiblePOs;

                              return (
                                <>
                                  <option value="" disabled>Select Purchase Order ({displayList.length} Proceeded / Partial POs)</option>
                                  {displayList.map((po) => (
                                    <option key={po.id || po.poNo} value={po.poNo || po.id}>
                                      {po.poNo} — {po.vendor && po.vendor.length > 20 ? po.vendor.substring(0, 20) + '...' : (po.vendor || 'Vendor')} ({po.status})
                                    </option>
                                  ))}
                                </>
                              );
                            })()}
                          </select>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="goods-receipt-note-vendor" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>
                          Vendor <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        <input
                          id="goods-receipt-note-vendor"
                          name="vendor"
                          aria-label="Vendor"
                          type="text"
                          readOnly
                          value={selectedGRNVendor || selectedGrnForModal?.vendor || ''}
                          placeholder="Auto-populated from PO"
                          style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: '#F8FAFC', color: '#334155', fontWeight: '600' }}
                        />
                      </div>
                    </div>

                    {/* Row 3: Warehouse / Location & DC NO / Invoice No. */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="goods-receipt-note-warehouse-location" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>
                          Warehouse / Location <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        <select
                          id="goods-receipt-note-warehouse-location"
                          name="warehouseLocation"
                          aria-label="Warehouse / Location"
                          disabled={isViewOnlyMode}
                          defaultValue="VRM Structures"
                          style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: isViewOnlyMode ? '#F8FAFC' : '#FFFFFF', color: '#334155' }}
                        >
                          <option value="" disabled>Select Warehouse / Location</option>
                          <option value="VRM Structures">VRM Structures</option>
                          <option value="Stock Area">Stock Area</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="goods-receipt-note-dc-no-invoice" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>
                          DC NO / Invoice No. <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        <input
                          id="goods-receipt-note-dc-no-invoice"
                          name="dCNOInvoice"
                          aria-label="DC NO / Invoice No."
                          type="text"
                          placeholder="Enter DC NO / Invoice No."
                          value={grnChallanNo || selectedGrnForModal?.challanNo || ''}
                          disabled={isViewOnlyMode}
                          onChange={(e) => setGrnChallanNo(e.target.value)}
                          style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: isViewOnlyMode ? '#F8FAFC' : '#FFFFFF', color: '#334155' }}
                        />
                      </div>
                    </div>

                    {/* Row 4: Challan Date & Received By */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="goods-receipt-note-challan-date" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>Challan Date</label>
                        <input
                          id="goods-receipt-note-challan-date"
                          name="challanDate"
                          aria-label="Challan Date"
                          type="date"
                          value={selectedGrnForModal?.challanDate || selectedGrnForModal?.date || challanDate}
                          disabled={isViewOnlyMode}
                          onChange={(e) => setChallanDate(e.target.value)}
                          style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: isViewOnlyMode ? '#F8FAFC' : '#FFFFFF', color: '#334155' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="goods-receipt-note-received-by" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>
                          Received By <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        <input
                          id="goods-receipt-note-received-by"
                          name="receivedBy"
                          aria-label="Received By"
                          type="text"
                          value={grnReceivedBy || selectedGrnForModal?.receivedBy || ''}
                          disabled={isViewOnlyMode}
                          placeholder="Enter receiver name"
                          onChange={(e) => setGrnReceivedBy(e.target.value)}
                          style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: isViewOnlyMode ? '#F8FAFC' : '#FFFFFF', color: '#334155' }}
                        />
                      </div>
                    </div>

                    {/* Row 5: Created By (System User) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="goods-receipt-note-created-by" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>
                          Created By (System User)
                        </label>
                        <input
                          id="goods-receipt-note-created-by"
                          name="createdBy"
                          aria-label="Created By"
                          type="text"
                          value={isViewOnlyMode
                            ? (selectedGrnForModal?.createdBy || selectedGrnForModal?.created_by || selectedGrnForModal?.creator || grnCreatedBy || '—')
                            : (grnCreatedBy || getLoggedInUserName() || 'Procurement')}
                          readOnly
                          disabled
                          style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: '#F8FAFC', color: '#0F172A', fontWeight: '600' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: 2. Purchase Order Summary & Receiving History (Span 6) */}
                  <div className="section-card" style={{ gridColumn: 'span 6', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800', flexShrink: 0 }}>
                          2
                        </div>
                        <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          PURCHASE ORDER SUMMARY
                        </h3>
                      </div>
                      {selectedGRNPo && (
                        <button
                          type="button"
                          onClick={() => handleOpenPoModal(selectedGRNPo)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            backgroundColor: '#FFFFFF',
                            color: '#2563EB',
                            fontSize: '11px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          View PO
                          <ExternalLink style={{ width: '10px', height: '10px' }} />
                        </button>
                      )}
                    </div>

                    {!selectedGRNPo ? (
                      <div style={{ padding: '24px 12px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
                        Select a Purchase Order to load order details and line items.
                      </div>
                    ) : (
                      <>
                        {(() => {
                          const totOrd = grnItems.reduce((acc, curr) => acc + (curr.isSplitChild ? 0 : (curr.ordered || 0)), 0);
                          const totPrev = grnItems.reduce((acc, curr) => acc + (curr.isSplitChild ? 0 : (curr.prev || 0)), 0);
                          const totNow = grnItems.reduce((acc, curr) => acc + (curr.isPoReference ? 0 : (curr.now !== undefined ? Number(curr.now) : Number(curr.accepted || 0))), 0);

                          // In view-only mode, we are viewing an already saved GRN.
                          // Total received up to and including this GRN:
                          const totalReceivedUpToNow = isViewOnlyMode ? (totPrev + totNow) : totPrev;
                          const actualPct = totOrd > 0 ? ((totalReceivedUpToNow / totOrd) * 100).toFixed(1) : 0;
                          
                          // Future projected if this draft GRN is submitted:
                          const projectedReceived = totPrev + totNow;
                          const projectedPct = totOrd > 0 ? ((projectedReceived / totOrd) * 100).toFixed(1) : 0;
                          const totRemaining = Math.max(0, totOrd - projectedReceived);

                          // Effective status of the PO:
                          // In entry mode: PO is closed ONLY IF confirmed past receipts totPrev >= totOrd. It does NOT prematurely close while entering a draft!
                          const isPoClosed = isViewOnlyMode 
                            ? (projectedReceived >= totOrd && totOrd > 0)
                            : (totPrev >= totOrd && totOrd > 0);
                          const isPoPartial = isViewOnlyMode
                            ? (projectedReceived > 0 && !isPoClosed)
                            : (totPrev > 0 && !isPoClosed);

                          const statusLabel = isPoClosed 
                            ? 'CLOSED / FULLY RECEIVED' 
                            : (isPoPartial ? 'OPEN / PARTIALLY RECEIVED' : 'OPEN / PENDING RECEIPT');
                          const statusBg = isPoClosed ? '#E6F7ED' : (isPoPartial ? '#FEF3C7' : '#EFF6FF');
                          const statusColor = isPoClosed ? '#137333' : (isPoPartial ? '#D97706' : '#2563EB');

                          // Build complete date-wise GRN history for this PO (including current GRN in View mode) with running Pending balance
                          const viewingGrnNo = String(selectedGrnForModal?.id || selectedGrnForModal?.grnNo || editingGrnId || '').trim();
                          const mergedHistory = mergePoReceivingHistory(selectedGRNPo, poReceivingHistory);
                          const hasViewingInHistory = Boolean(
                            viewingGrnNo && mergedHistory.some(g => String(g.grnNo || g.id || '').trim() === viewingGrnNo)
                          );
                          const allPoGrns = [...mergedHistory];
                          if (isViewOnlyMode && viewingGrnNo && !hasViewingInHistory) {
                            allPoGrns.push({
                              id: viewingGrnNo,
                              grnNo: viewingGrnNo,
                              date: selectedGrnForModal?.date || receiptDate || '',
                              receiptDate: receiptDate || '',
                              receivedQty: totNow,
                              acceptedQty: totNow,
                              createdAt: selectedGrnForModal?.createdAt || ''
                            });
                          }
                          // Sort chronologically (oldest first) so running Pending balance decreases date-by-date
                          const toSortableTs = (g) => {
                            const raw = g.createdAt || g.receiptDate || g.date || '';
                            const t = Date.parse(raw);
                            return Number.isFinite(t) ? t : 0;
                          };
                          allPoGrns.sort((a, b) => toSortableTs(a) - toSortableTs(b));
                          let runningReceived = 0;
                          const dateWiseHistory = allPoGrns.map(g => {
                            const recCount = Number(g.receivedQty ?? g.acceptedQty ?? parseFloat(g.received)) || 0;
                            runningReceived += recCount;
                            const pendingAfter = Math.max(0, totOrd - runningReceived);
                            const recDate = g.date || g.receiptDate || (g.createdAt ? new Date(g.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
                            const gNo = String(g.grnNo || g.id || '—').trim();
                            return {
                              grnNo: gNo,
                              recDate,
                              recCount,
                              pendingAfter,
                              isCurrent: Boolean(viewingGrnNo && gNo === viewingGrnNo)
                            };
                          });

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <strong
                                    onClick={() => handleOpenPoModal(selectedGRNPo)}
                                    title="Click to view Purchase Order in popup"
                                    style={{ fontSize: '16px', color: '#0E7490', cursor: 'pointer', textDecoration: 'underline' }}
                                  >
                                    {selectedGRNPo}
                                  </strong>
                                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{selectedGRNVendor || 'Vendor'}</div>
                                </div>
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: '20px',
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  backgroundColor: statusBg,
                                  color: statusColor
                                }}>
                                  {statusLabel}
                                </span>
                              </div>

                              {/* Receiving Progress Bar */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '11px', fontWeight: '700' }}>
                                  <span style={{ color: '#475569' }}>Receiving Progress</span>
                                  {isViewOnlyMode ? (
                                    <span style={{ color: '#2563EB' }}>
                                      {projectedReceived} / {totOrd} Received ({projectedPct}%)
                                    </span>
                                  ) : (
                                    <div style={{ textAlign: 'right' }}>
                                      <span style={{ color: '#0F172A' }}>
                                        {totPrev} / {totOrd} Received ({actualPct}%)
                                      </span>
                                      {totNow > 0 && (
                                        <span style={{ fontSize: '10px', color: '#0E7490', marginLeft: '6px', fontWeight: '600' }}>
                                          (+{totNow} in this entry will reach {projectedPct}%)
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Stacked Progress Bar: Confirmed received (solid blue) + Current entry (striped cyan) */}
                                <div style={{ height: '7px', width: '100%', backgroundColor: '#E2E8F0', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                                  {/* Confirmed / Past Received portion */}
                                  <div
                                    title={`Confirmed Received: ${isViewOnlyMode ? projectedReceived : totPrev} units`}
                                    style={{
                                      height: '100%',
                                      width: `${Math.min(100, totOrd > 0 ? ((isViewOnlyMode ? projectedReceived : totPrev) / totOrd) * 100 : 0)}%`,
                                      backgroundColor: '#2563EB',
                                      transition: 'width 0.3s'
                                    }}
                                  />
                                  {/* Current Entry Draft portion (shown only in entry mode) */}
                                  {!isViewOnlyMode && totNow > 0 && (
                                    <div
                                      title={`Receiving in this GRN: +${totNow} units`}
                                      style={{
                                        height: '100%',
                                        width: `${Math.min(100 - (totOrd > 0 ? (totPrev / totOrd) * 100 : 0), totOrd > 0 ? (totNow / totOrd) * 100 : 0)}%`,
                                        backgroundColor: '#06B6D4',
                                        backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent)',
                                        backgroundSize: '12px 12px',
                                        transition: 'width 0.3s'
                                      }}
                                    />
                                  )}
                                </div>
                              </div>

                              {/* Quantitative Summary */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center' }}>
                                <div style={{ backgroundColor: '#F1F5F9', padding: '6px 4px', borderRadius: '6px' }}>
                                  <span style={{ fontSize: '9px', color: '#64748B', display: 'block', fontWeight: 'bold' }}>Ordered</span>
                                  <strong style={{ fontSize: '12px', color: '#0F172A' }}>{totOrd}</strong>
                                </div>
                                <div style={{ backgroundColor: '#F1F5F9', padding: '6px 4px', borderRadius: '6px' }}>
                                  <span style={{ fontSize: '9px', color: '#64748B', display: 'block', fontWeight: 'bold' }}>Previously Received</span>
                                  <strong style={{ fontSize: '12px', color: '#64748B' }}>{totPrev}</strong>
                                </div>
                                <div style={{ backgroundColor: '#EFF6FF', padding: '6px 4px', borderRadius: '6px', border: '1px solid #DBEAFE' }}>
                                  <span style={{ fontSize: '9px', color: '#2563EB', display: 'block', fontWeight: 'bold' }}>
                                    {isViewOnlyMode ? 'This GRN' : 'Receiving Now'}
                                  </span>
                                  <strong style={{ fontSize: '12px', color: '#2563EB' }}>+{totNow}</strong>
                                </div>
                                <div style={{ backgroundColor: totRemaining === 0 ? '#E6F7ED' : '#FEF2F2', padding: '6px 4px', borderRadius: '6px' }}>
                                  <span style={{ fontSize: '9px', color: totRemaining === 0 ? '#137333' : '#DC2626', display: 'block', fontWeight: 'bold' }}>
                                    {isViewOnlyMode ? 'Remaining' : 'Pending Balance'}
                                  </span>
                                  <strong style={{ fontSize: '12px', color: totRemaining === 0 ? '#137333' : '#DC2626' }}>
                                    {isViewOnlyMode ? totRemaining : Math.max(0, totOrd - totPrev)}
                                  </strong>
                                </div>
                              </div>

                              {/* Date-Wise GRN Receiving History (Date, Received Qty, Pending Balance) */}
                              {dateWiseHistory.length > 0 && (
                                <div style={{ marginTop: '4px', borderTop: '1px solid #E2E8F0', paddingTop: '10px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A' }}>
                                      Date-Wise GRN History ({dateWiseHistory.length} {dateWiseHistory.length === 1 ? 'Receipt' : 'Receipts'})
                                    </span>
                                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '2px 8px', borderRadius: '12px' }}>
                                      Total Received: +{dateWiseHistory.reduce((sum, g) => sum + g.recCount, 0)} Qty
                                    </span>
                                  </div>
                                  <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                      <thead>
                                        <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '10px', textTransform: 'uppercase' }}>
                                          <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: '700' }}>GRN No</th>
                                          <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: '700' }}>Date</th>
                                          <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '700' }}>Received</th>
                                          <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '700' }}>Pending</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {dateWiseHistory.map((row, idx) => (
                                          <tr
                                            key={`${row.grnNo}-${idx}`}
                                            style={{
                                              borderBottom: idx < dateWiseHistory.length - 1 ? '1px solid #F1F5F9' : 'none',
                                              backgroundColor: row.isCurrent ? '#ECFEFF' : '#FFFFFF'
                                            }}
                                          >
                                            <td style={{ padding: '6px 8px', fontWeight: '700', color: '#0E7490', whiteSpace: 'nowrap' }}>
                                              {row.grnNo}
                                              {row.isCurrent && (
                                                <span style={{ marginLeft: '5px', fontSize: '9px', fontWeight: '800', color: '#0E7490', backgroundColor: '#CFFAFE', padding: '1px 5px', borderRadius: '4px' }}>
                                                  Current
                                                </span>
                                              )}
                                            </td>
                                            <td style={{ padding: '6px 8px', color: '#475569', whiteSpace: 'nowrap' }}>{row.recDate}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800', color: '#137333', whiteSpace: 'nowrap' }}>+{row.recCount}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800', color: row.pendingAfter === 0 ? '#137333' : '#DC2626', whiteSpace: 'nowrap' }}>{row.pendingAfter}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>

                  {/* Card 3: 3. GRN Summary & Received Items (Span 12 Full Width Below) */}
                  {(() => {
                    const showPrevCol = grnItems.some(it => Number(it.prev || 0) > 0) || (poReceivingHistory && poReceivingHistory.length > 0);
                    const totalCols = (showPrevCol ? 10 : 9) + (!isViewOnlyMode ? 1 : 0);

                    const handleAddSplitChild = (parentItem) => {
                      const newChild = {
                        id: `SPLIT-${parentItem.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        parentPoItemId: parentItem.id,
                        orderedItemName: parentItem.name,
                        isSplitChild: true,
                        isPoReference: false,
                        name: '',
                        sku: '',
                        desc: '',
                        uom: parentItem.uom || 'NOS',
                        inventoryType: parentItem.inventoryType || 'Raw Material',
                        ordered: 0,
                        prev: 0,
                        remaining: 0,
                        now: 0,
                        accepted: 0,
                        rejected: 0,
                        reason: '—'
                      };
                      const next = [];
                      let inserted = false;
                      grnItems.forEach((it, i) => {
                        if (it.id === parentItem.id) {
                          next.push({ ...it, isPoReference: true, now: 0, accepted: 0, rejected: 0 });
                          const hasNextChild = grnItems[i + 1]?.isSplitChild && grnItems[i + 1]?.parentPoItemId === parentItem.id;
                          if (!hasNextChild) {
                            next.push(newChild);
                            inserted = true;
                          }
                        } else {
                          next.push(it);
                          const isLastChildOfParent = it.isSplitChild && it.parentPoItemId === parentItem.id && !(grnItems[i + 1]?.isSplitChild && grnItems[i + 1]?.parentPoItemId === parentItem.id);
                          if (!inserted && isLastChildOfParent) {
                            next.push(newChild);
                            inserted = true;
                          }
                        }
                      });
                      if (!inserted) next.push(newChild);
                      setGrnItems(next);
                    };

                    const handleRemoveGrnItem = (targetItem) => {
                      const remaining = grnItems.filter(it => it.id !== targetItem.id && !(targetItem.isPoReference && it.parentPoItemId === targetItem.id));
                      if (targetItem.isSplitChild && targetItem.parentPoItemId) {
                        const stillHasChildren = remaining.some(it => it.isSplitChild && it.parentPoItemId === targetItem.parentPoItemId);
                        if (!stillHasChildren) {
                          setGrnItems(remaining.map(it => {
                            if (it.id === targetItem.parentPoItemId) {
                              const remQty = Math.max(0, Number(it.ordered || 0) - Number(it.prev || 0));
                              return { ...it, isPoReference: false, now: remQty, accepted: remQty, rejected: 0 };
                            }
                            return it;
                          }));
                          return;
                        }
                      }
                      setGrnItems(remaining);
                    };

                    return (
                  <div className="section-card" style={{ gridColumn: 'span 12', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800', flexShrink: 0 }}>
                          3
                        </div>
                        <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          GRN SUMMARY &amp; RECEIVED ITEMS
                        </h3>
                        <HelpCircle style={{ width: '14px', height: '14px', color: '#94A3B8' }} />
                      </div>
                      {!isViewOnlyMode && grnItems.length > 0 && (
                        <span style={{ fontSize: '11px', color: '#64748B' }}>
                          Tip: Use <strong>+ Split Items</strong> on a PO item if multiple different products were received against one PO item.
                        </span>
                      )}
                    </div>

                    <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
                      <table className="custom-table" style={{ width: '100%', minWidth: '1080px', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                            <th style={{ padding: '10px 8px', color: '#64748B', width: '36px' }}>#</th>
                            <th style={{ padding: '10px 8px', color: '#64748B', minWidth: '240px' }}>Item / Material & Description</th>
                            <th style={{ padding: '10px 8px', color: '#64748B', textAlign: 'center', width: '135px' }}>Inventory Type</th>
                            <th style={{ padding: '10px 8px', color: '#64748B', textAlign: 'center', width: '70px' }}>UOM</th>
                            <th style={{ padding: '10px 8px', color: '#64748B', textAlign: 'center', width: '90px' }}>Ordered Qty</th>
                            {showPrevCol && <th style={{ padding: '10px 8px', color: '#64748B', textAlign: 'center', width: '110px' }}>Previously Received</th>}
                            <th style={{ padding: '10px 8px', color: '#64748B', textAlign: 'center', width: '100px' }}>Receiving Now *</th>
                            <th style={{ padding: '10px 8px', color: '#64748B', textAlign: 'center', width: '90px' }}>Accepted Qty</th>
                            <th style={{ padding: '10px 8px', color: '#64748B', textAlign: 'center', width: '90px' }}>Rejected Qty</th>
                            <th style={{ padding: '10px 8px', color: '#64748B', minWidth: '130px' }}>Reason for Rejection</th>
                            {!isViewOnlyMode && <th style={{ padding: '10px 4px', width: '40px' }}></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {grnItems.length === 0 ? (
                            <tr>
                              <td colSpan={totalCols} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
                                No items loaded. Select a Purchase Order to display its line items for receipt entry.
                              </td>
                            </tr>
                          ) : (
                            grnItems.map((item, idx) => (
                              <tr
                                key={item.id}
                                style={{
                                  borderBottom: '1px solid #F1F5F9',
                                  backgroundColor: item.isPoReference ? '#F8FAFC' : (item.isSplitChild ? '#F0FDFA' : 'transparent')
                                }}
                              >
                                <td style={{ padding: '12px 8px', color: '#94A3B8', verticalAlign: 'top' }}>
                                  {item.isSplitChild ? '↳' : idx + 1}
                                </td>
                                <td style={{ padding: '12px 8px', verticalAlign: 'top', minWidth: '240px', paddingLeft: item.isSplitChild ? '22px' : '8px' }}>
                                  {item.isPoReference && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '4px', backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
                                        Given PO Product (Reference Only — Not Inwarded)
                                      </span>
                                    </div>
                                  )}
                                  {item.isSplitChild && (
                                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#0E7490', marginBottom: '4px' }}>
                                      Received Product (for {item.orderedItemName || 'PO Item'})
                                    </div>
                                  )}
                                  {isViewOnlyMode || item.isPoReference ? (
                                    <div>
                                      <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '13px' }}>{item.name || item.itemName || 'Material Item'}</div>
                                      {item.desc && (
                                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', lineHeight: '1.4' }}>
                                          {item.desc}
                                        </div>
                                      )}
                                      {!isViewOnlyMode && item.isPoReference && (
                                        <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                          <button
                                            type="button"
                                            onClick={() => handleAddSplitChild(item)}
                                            style={{
                                              padding: '4px 10px',
                                              borderRadius: '6px',
                                              border: '1px solid #0E7490',
                                              backgroundColor: '#ECFEFF',
                                              color: '#0E7490',
                                              fontSize: '11px',
                                              fontWeight: '700',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            + Add Received Product
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <>
                                      <input
                                        id={`goods-receipt-note-or-item-name-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`}
                                        name={`orItemName_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`}
                                        aria-label="Type or select Item Name"
                                        type="text"
                                        list={`grn-item-datalist-${item.id}`}
                                        value={item.name}
                                        placeholder={item.isSplitChild ? 'Type or select Received Product...' : 'Type or select Item Name...'}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          const matched = (itemsList || []).find(it => (it.name || '').toLowerCase() === val.toLowerCase());
                                          const updated = grnItems.map(it => it.id === item.id ? {
                                            ...it,
                                            name: val,
                                            uom: matched ? (matched.unit || matched.uom || it.uom) : it.uom,
                                            desc: matched ? (matched.description || it.desc) : it.desc,
                                            inventoryType: matched ? inferInventoryType(matched) : it.inventoryType
                                          } : it);
                                          setGrnItems(updated);
                                        }}
                                        style={{ width: '100%', height: '34px', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '0 10px', fontSize: '12px', fontWeight: '700', color: '#0F172A', backgroundColor: '#FFFFFF' }}
                                      />
                                      <datalist id={`grn-item-datalist-${item.id}`}>
                                        {(itemsList || []).map((prod, pidx) => (
                                          <option key={pidx} value={prod.name}>
                                            {prod.code ? `[${prod.code}] ${prod.name}` : prod.name}
                                          </option>
                                        ))}
                                      </datalist>
                                      <div style={{ marginTop: '6px' }}>
                                        <textarea
                                          id={`goods-receipt-note-desc-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`}
                                          name={`desc_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`}
                                          aria-label="Enter Item / Material Description"
                                          value={item.desc || ''}
                                          placeholder="Enter Item / Material Description (e.g. length, size)..."
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            const updated = grnItems.map(it => it.id === item.id ? { ...it, desc: val } : it);
                                            setGrnItems(updated);
                                          }}
                                          style={{
                                            width: '100%',
                                            minHeight: '44px',
                                            border: '1px solid #CBD5E1',
                                            borderRadius: '6px',
                                            padding: '6px 10px',
                                            fontSize: '11px',
                                            color: '#334155',
                                            resize: 'vertical',
                                            boxSizing: 'border-box',
                                            backgroundColor: '#F8FAFC',
                                            lineHeight: '1.4'
                                          }}
                                        />
                                      </div>
                                      {!item.isSplitChild && (
                                        <button
                                          type="button"
                                          onClick={() => handleAddSplitChild(item)}
                                          style={{
                                            marginTop: '6px',
                                            padding: '3px 9px',
                                            borderRadius: '6px',
                                            border: '1px dashed #0E7490',
                                            backgroundColor: '#ECFEFF',
                                            color: '#0E7490',
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          + Split Items (Receive Different Products)
                                        </button>
                                      )}
                                    </>
                                  )}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                                  {item.isPoReference ? (
                                    <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '600' }}>Reference</span>
                                  ) : isViewOnlyMode ? (
                                    <span style={{
                                      fontSize: '10px',
                                      fontWeight: '700',
                                      padding: '3px 8px',
                                      borderRadius: '12px',
                                      backgroundColor: item.inventoryType === 'Finished Goods' ? '#EFF6FF' : '#FEF3C7',
                                      color: item.inventoryType === 'Finished Goods' ? '#1D4ED8' : '#B45309',
                                      border: `1px solid ${item.inventoryType === 'Finished Goods' ? '#BFDBFE' : '#FDE68A'}`,
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {item.inventoryType || 'Raw Material'}
                                    </span>
                                  ) : (
                                    <select
                                      aria-label="Inventory Type"
                                      value={item.inventoryType || 'Raw Material'}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setGrnItems(grnItems.map(it => it.id === item.id ? { ...it, inventoryType: val } : it));
                                      }}
                                      style={{
                                        width: '128px',
                                        height: '34px',
                                        border: '1px solid #CBD5E1',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        backgroundColor: '#FFFFFF',
                                        color: '#0F172A',
                                        padding: '0 6px'
                                      }}
                                    >
                                      <option value="Raw Material">Raw Material</option>
                                      <option value="Finished Goods">Finished Goods</option>
                                    </select>
                                  )}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                                  {isViewOnlyMode || item.isPoReference ? (
                                    <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>{item.uom || 'NOS'}</span>
                                  ) : (
                                    <input
                                      id={`goods-receipt-note-uom-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`}
                                      name={`uom_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`}
                                      aria-label="Uom"
                                      type="text"
                                      value={item.uom}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const updated = grnItems.map(it => it.id === item.id ? { ...it, uom: val } : it);
                                        setGrnItems(updated);
                                      }}
                                      style={{ width: '50px', height: '34px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '11px', backgroundColor: '#FFFFFF' }}
                                    />
                                  )}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                                  {item.isSplitChild ? (
                                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>—</span>
                                  ) : isViewOnlyMode || item.isPoReference ? (
                                    <span style={{ fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>{item.ordered ?? 0}</span>
                                  ) : (
                                    <input
                                      id={`goods-receipt-note-ordered-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`}
                                      name={`ordered_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`}
                                      aria-label="Ordered"
                                      type="number"
                                      value={item.ordered}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        const updated = grnItems.map(it => it.id === item.id ? { ...it, ordered: val } : it);
                                        setGrnItems(updated);
                                      }}
                                      style={{ width: '55px', height: '34px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '11px', fontWeight: '600', backgroundColor: '#FFFFFF' }}
                                    />
                                  )}
                                </td>
                                {showPrevCol && (
                                  <td style={{ padding: '12px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                                      {item.isSplitChild ? '—' : (item.prev ?? 0)}
                                    </span>
                                  </td>
                                )}
                                <td style={{ padding: '12px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                                  {item.isPoReference ? (
                                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>—</span>
                                  ) : isViewOnlyMode ? (
                                    <span style={{ fontWeight: '800', color: '#0E7490', fontSize: '13px', backgroundColor: '#ECFEFF', padding: '3px 8px', borderRadius: '6px', border: '1px solid #CFFAFE' }}>
                                      {item.now ?? 0}
                                    </span>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                      <input
                                        id={`goods-receipt-note-now-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`}
                                        name={`now_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`}
                                        aria-label="Now"
                                        type="number"
                                        value={item.now}
                                        onChange={(e) => {
                                          const val = Number(e.target.value);
                                          const maxAllowed = item.isSplitChild ? Infinity : Math.max(0, item.ordered - item.prev);
                                          const hasErr = !item.isSplitChild && val > maxAllowed;
                                          const updated = grnItems.map(it => it.id === item.id ? {
                                            ...it,
                                            now: val,
                                            accepted: val - (it.rejected || 0),
                                            error: hasErr ? `Exceeds remaining PO quantity of ${maxAllowed}` : null
                                          } : it);
                                          setGrnItems(updated);
                                        }}
                                        style={{
                                          width: '65px',
                                          height: '34px',
                                          border: item.error ? '1.5px solid #DC2626' : '1px solid #CBD5E1',
                                          borderRadius: '6px',
                                          textAlign: 'center',
                                          fontSize: '11px',
                                          fontWeight: 'bold',
                                          backgroundColor: item.error ? '#FEF2F2' : '#FFFFFF',
                                          color: item.error ? '#DC2626' : '#0F172A'
                                        }}
                                      />
                                      {item.error && (
                                        <span style={{ fontSize: '8px', color: '#DC2626', fontWeight: 'bold', marginTop: '2px', lineHeight: '1' }}>
                                          Max {item.ordered - item.prev}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                                  {item.isPoReference ? (
                                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>—</span>
                                  ) : isViewOnlyMode ? (
                                    <span style={{ fontWeight: '700', color: '#16A34A', fontSize: '13px' }}>
                                      {item.accepted ?? 0}
                                    </span>
                                  ) : (
                                    <input
                                      id={`goods-receipt-note-accepted-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`}
                                      name={`accepted_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`}
                                      aria-label="Accepted"
                                      type="number"
                                      value={item.accepted}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        const updated = grnItems.map(it => it.id === item.id ? { ...it, accepted: val, rejected: it.now - val } : it);
                                        setGrnItems(updated);
                                      }}
                                      style={{ width: '55px', height: '34px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '11px', backgroundColor: '#FFFFFF' }}
                                    />
                                  )}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                                  {item.isPoReference ? (
                                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>—</span>
                                  ) : isViewOnlyMode ? (
                                    <span style={{ fontWeight: Number(item.rejected) > 0 ? '700' : 'normal', color: Number(item.rejected) > 0 ? '#DC2626' : '#94A3B8', fontSize: '12px' }}>
                                      {item.rejected ?? 0}
                                    </span>
                                  ) : (
                                    <input
                                      id={`goods-receipt-note-rejected-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`}
                                      name={`rejected_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`}
                                      aria-label="Rejected"
                                      type="number"
                                      value={item.rejected}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        const updated = grnItems.map(it => it.id === item.id ? { ...it, rejected: val, accepted: it.now - val } : it);
                                        setGrnItems(updated);
                                      }}
                                      style={{ width: '55px', height: '34px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '11px', color: item.rejected > 0 ? '#C5221F' : '#334155', fontWeight: item.rejected > 0 ? 'bold' : 'normal', backgroundColor: '#FFFFFF' }}
                                    />
                                  )}
                                </td>
                                <td style={{ padding: '12px 8px', verticalAlign: 'top' }}>
                                  {item.isPoReference ? (
                                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>—</span>
                                  ) : isViewOnlyMode ? (
                                    <span style={{ fontSize: '11px', color: '#64748B' }}>
                                      {item.reason && item.reason !== '—' ? item.reason : '—'}
                                    </span>
                                  ) : (
                                    <select
                                      id={`goods-receipt-note-reason-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`}
                                      name={`reason_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`}
                                      aria-label="Reason"
                                      value={item.reason}
                                      onChange={(e) => {
                                        const updated = grnItems.map(it => it.id === item.id ? { ...it, reason: e.target.value } : it);
                                        setGrnItems(updated);
                                      }}
                                      style={{ height: '34px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '11px', backgroundColor: '#FFFFFF', padding: '0 6px' }}
                                    >
                                      <option>—</option>
                                      <option>Damaged</option>
                                      <option>Thread Issue</option>
                                      <option>Wrong Specs</option>
                                    </select>
                                  )}
                                </td>
                                {!isViewOnlyMode && (
                                  <td style={{ padding: '10px 2px', textAlign: 'center', verticalAlign: 'top', paddingTop: '14px' }}>
                                    <button
                                      type="button"
                                      title="Delete Item"
                                      onClick={() => handleRemoveGrnItem(item)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#EF4444',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '4px'
                                      }}
                                    >
                                      <Trash2 style={{ width: '15px', height: '15px' }} />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Anchored Footer Section with Total Row & Add Button */}
                    <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
                        <table style={{ width: '100%', minWidth: '1080px', borderCollapse: 'collapse', fontSize: '11px' }}>
                          <tbody>
                            <tr style={{ backgroundColor: '#F8FAFC', fontWeight: 'bold' }}>
                              <td colSpan="4" style={{ padding: '10px 8px', fontSize: '12px', color: '#0F172A' }}>Total</td>
                              <td style={{ padding: '10px 8px', textAlign: 'center', width: '90px' }}>{totalOrdered}</td>
                              {showPrevCol && <td style={{ padding: '10px 8px', textAlign: 'center', width: '110px', color: '#64748B' }}>{totalPrev}</td>}
                              <td style={{ padding: '10px 8px', textAlign: 'center', width: '100px', color: '#0E7490' }}>{totalNow}</td>
                              <td style={{ padding: '10px 8px', textAlign: 'center', width: '90px', color: '#137333' }}>{totalAccepted}</td>
                              <td style={{ padding: '10px 8px', textAlign: 'center', width: '90px', color: '#C5221F' }}>{totalRejected}</td>
                              <td colSpan={isViewOnlyMode ? 1 : 2} style={{ padding: '10px 8px' }}></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {!isViewOnlyMode && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const newItem = {
                                id: `NEW-ITEM-${Date.now()}`,
                                name: 'Additional Material / Item',
                                desc: 'Custom ad-hoc line item',
                                sku: 'SKU-NEW',
                                uom: 'NOS',
                                inventoryType: 'Raw Material',
                                ordered: 0,
                                prev: 0,
                                now: 1,
                                accepted: 1,
                                rejected: 0,
                                reason: '—',
                                batch: 'LOT-NEW'
                              };
                              setGrnItems([...grnItems, newItem]);
                            }}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: '#FFFFFF',
                              color: '#2563EB',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            + Add Additional Item
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                    );
                  })()}

                  {/* Card 4: 4. Documents (Span 6) */}
                  <div className="section-card" style={{ gridColumn: 'span 6', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800', flexShrink: 0 }}>
                        4
                      </div>
                      <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        DOCUMENTS <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                      </h3>
                      <HelpCircle style={{ width: '14px', height: '14px', color: '#94A3B8' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                      {grnDocs.map((doc, idx) => (
                        <div key={idx} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#FFFFFF' }}>
                          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748B' }}>{doc.title}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText style={{ width: '24px', height: '24px', color: '#10B981' }} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span
                                onClick={() => setActiveDocPreviewModal({
                                  title: doc.title || 'Document Preview',
                                  filename: doc.filename,
                                  url: doc.url
                                })}
                                style={{ fontSize: '11px', fontWeight: '600', color: '#2563EB', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: 'underline' }}
                                title="Click to view document"
                              >
                                {doc.filename}
                              </span>
                              <span style={{ fontSize: '9px', color: '#94A3B8' }}>{doc.size}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '10px', marginTop: '4px', borderTop: '1px solid #F1F5F9', paddingTop: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <span
                              onClick={() => setActiveDocPreviewModal({
                                title: doc.title || 'Document Preview',
                                filename: doc.filename,
                                url: doc.url
                              })}
                              style={{ fontSize: '11px', color: '#2563EB', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye style={{ width: '14px', height: '14px', color: '#2563EB' }} /> View
                            </span>
                            {!isViewOnlyMode && (
                              <Trash2
                                onClick={() => setDeleteDocConfirmIdx(idx)}
                                style={{ width: '14px', height: '14px', color: '#EF4444', cursor: 'pointer' }}
                              />
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Document Delete Confirmation Modal */}
                      {deleteDocConfirmIdx !== null && (
                        <div style={{
                          position: 'fixed',
                          top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: 'rgba(15, 23, 42, 0.6)',
                          backdropFilter: 'blur(4px)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 99999
                        }}>
                          <div style={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: '16px',
                            padding: '24px',
                            width: '420px',
                            maxWidth: '90%',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <AlertTriangle style={{ width: '22px', height: '22px', color: '#EF4444' }} />
                              </div>
                              <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0F172A' }}>Confirm Document Deletion</h3>
                                <span style={{ fontSize: '12px', color: '#64748B' }}>Action cannot be undone</span>
                              </div>
                            </div>

                            <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                              Are you sure you want to delete the uploaded document <strong>"{grnDocs[deleteDocConfirmIdx]?.filename || 'Attachment'}"</strong>?
                            </p>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                              <button
                                onClick={() => setDeleteDocConfirmIdx(null)}
                                style={{ height: '36px', padding: '0 16px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#334155', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  setGrnDocs(grnDocs.filter((_, i) => i !== deleteDocConfirmIdx));
                                  setDeleteDocConfirmIdx(null);
                                }}
                                style={{ height: '36px', padding: '0 18px', borderRadius: '8px', border: 'none', backgroundColor: '#EF4444', color: '#FFFFFF', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                              >
                                Yes, Delete Document
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Upload Box (Only available in Edit / Create mode) */}
                      {!isViewOnlyMode && (
                        <label
                          style={{ border: '2px dashed #CBD5E1', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', backgroundColor: '#F8FAFC', cursor: 'pointer', transition: 'border-color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2563EB'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#CBD5E1'}
                        >
                          <input id="goods-receipt-note-input-1" name={`input1_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Input 1"
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              if (files.length > 0) {
                                const names = ['Delivery Challan *', 'Invoice', 'Inspection Report', 'Additional Document'];
                                const newDocs = files.map((file, i) => {
                                  const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
                                  const title = names[grnDocs.length + i] || `Attachment ${grnDocs.length + i + 1}`;
                                  let blobUrl = '';
                                  try {
                                    blobUrl = URL.createObjectURL(file);
                                  } catch (err) { }
                                  return {
                                    title,
                                    filename: file.name,
                                    size: `${sizeMB} MB`,
                                    url: blobUrl,
                                    fileObj: file
                                  };
                                });
                                setGrnDocs(prev => [...prev, ...newDocs]);
                              }
                              e.target.value = '';
                            }}
                           />
                          <UploadCloud style={{ width: '20px', height: '20px', color: '#2563EB' }} />
                          <span style={{ fontSize: '11px', color: '#2563EB', fontWeight: 'bold' }}>+ Upload File</span>
                          <span style={{ fontSize: '8px', color: '#94A3B8', textAlign: 'center' }}>PDF, JPG, PNG (Max 10MB)</span>
                        </label>
                      )}
                    </div>

                    {/* Section: Previously Uploaded Documents for this PO */}
                    {!isViewOnlyMode && !editingGrnId && poReceivingHistory && poReceivingHistory.length > 0 && (
                      <div style={{ marginTop: '16px', borderTop: '1px dashed #CBD5E1', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FileText style={{ width: '15px', height: '15px', color: '#2563EB' }} />
                          Previously Uploaded Documents for PO ({selectedGRNPo})
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '10px' }}>
                          {poReceivingHistory.map((prevGrn, pIdx) => {
                            const firstDoc = (prevGrn.documents && prevGrn.documents.length > 0) ? prevGrn.documents[0] : null;
                            const docUrl = firstDoc ? firstDoc.url : prevGrn.docUrl;

                            return (
                              <div key={pIdx} style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>{prevGrn.grnNo} — DC: {prevGrn.challanNo || 'N/A'}</div>
                                  <div style={{ fontSize: '9px', color: '#64748B' }}>Received Date: {prevGrn.date || '—'} | Qty Accepted: {prevGrn.acceptedQty || 0}</div>
                                </div>
                                <span
                                  onClick={() => setActiveDocPreviewModal({
                                    title: `Previous Receipt: ${prevGrn.grnNo}`,
                                    filename: `Delivery Challan: ${prevGrn.challanNo || 'N/A'}`,
                                    url: docUrl,
                                    details: prevGrn
                                  })}
                                  style={{ fontSize: '11px', color: '#2563EB', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Eye style={{ width: '14px', height: '14px', color: '#2563EB' }} /> View
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card 5: 5. GRN Summary (Span 6 - Same line beside Documents) */}
                  <div className="section-card" style={{ gridColumn: 'span 6', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800', flexShrink: 0 }}>
                        5
                      </div>
                      <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        GRN SUMMARY
                      </h3>
                      <HelpCircle style={{ width: '14px', height: '14px', color: '#94A3B8' }} />
                    </div>

                    {(() => {
                      const totOrd = grnItems.reduce((acc, curr) => acc + (curr.ordered || 0), 0);
                      const totNow = grnItems.reduce((acc, curr) => acc + (curr.now || 0), 0);
                      const totAccepted = grnItems.reduce((acc, curr) => acc + (curr.accepted || 0), 0);
                      const totRejected = grnItems.reduce((acc, curr) => acc + (curr.rejected || 0), 0);

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                              <span style={{ color: '#64748B', fontWeight: '600' }}>GRN Status:</span>
                              <strong style={{ color: '#2563EB' }}>{totNow > 0 ? 'DRAFT / READY TO SUBMIT' : 'PENDING ITEM ENTRY'}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                              <span style={{ color: '#64748B', fontWeight: '600' }}>Receiving PO Reference:</span>
                              <strong style={{ color: '#0F172A' }}>{selectedGRNPo || '—'}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                              <span style={{ color: '#64748B', fontWeight: '600' }}>Vendor Name:</span>
                              <strong style={{ color: '#0F172A' }}>{selectedGRNVendor || '—'}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                              <span style={{ color: '#64748B', fontWeight: '600' }}>Delivery Challan / Invoice:</span>
                              <strong style={{ color: '#0F172A' }}>{grnChallanNo || '—'}</strong>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center' }}>
                            <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #DBEAFE', padding: '10px 6px', borderRadius: '8px' }}>
                              <span style={{ fontSize: '10px', color: '#2563EB', display: 'block', fontWeight: 'bold' }}>Total Receiving Now</span>
                              <strong style={{ fontSize: '15px', color: '#2563EB' }}>{totNow}</strong>
                            </div>
                            <div style={{ backgroundColor: '#E6F7ED', border: '1px solid #BBF7D0', padding: '10px 6px', borderRadius: '8px' }}>
                              <span style={{ fontSize: '10px', color: '#137333', display: 'block', fontWeight: 'bold' }}>Total Accepted</span>
                              <strong style={{ fontSize: '15px', color: '#137333' }}>{totAccepted}</strong>
                            </div>
                            <div style={{ backgroundColor: totRejected > 0 ? '#FEF2F2' : '#F8FAFC', border: `1px solid ${totRejected > 0 ? '#FECACA' : '#E2E8F0'}`, padding: '10px 6px', borderRadius: '8px' }}>
                              <span style={{ fontSize: '10px', color: totRejected > 0 ? '#C5221F' : '#64748B', display: 'block', fontWeight: 'bold' }}>Total Rejected</span>
                              <strong style={{ fontSize: '15px', color: totRejected > 0 ? '#C5221F' : '#64748B' }}>{totRejected}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>



                  {/* Inline Document Preview Modal */}
                  {activeDocPreviewModal && (
                    <div style={{
                      position: 'fixed',
                      top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: 'rgba(15, 23, 42, 0.75)',
                      backdropFilter: 'blur(6px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 999999
                    }}>
                      <div style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '16px',
                        width: '900px',
                        maxWidth: '94%',
                        height: '85vh',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        overflow: 'hidden'
                      }}>
                        {/* Header */}
                        <div style={{ padding: '16px 24px', backgroundColor: '#0F172A', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FileText style={{ width: '20px', height: '20px', color: '#38BDF8' }} />
                            <div>
                              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold' }}>{activeDocPreviewModal.title || 'Document Viewer'}</h3>
                              <span style={{ fontSize: '11px', color: '#94A3B8' }}>{activeDocPreviewModal.filename || 'Uploaded Document'}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => setActiveDocPreviewModal(null)}
                            style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '22px', cursor: 'pointer', padding: '4px', lineHeight: 1 }}
                          >
                            ✕
                          </button>
                        </div>

                        {/* Body */}
                        <div style={{ flex: 1, backgroundColor: '#F8FAFC', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
                          {activeDocPreviewModal.url ? (
                            activeDocPreviewModal.url.startsWith('data:image') ? (
                              <img src={activeDocPreviewModal.url} alt="Document Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                            ) : (
                              <iframe src={activeDocPreviewModal.url} title="Document Preview" style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }} />
                            )
                          ) : (
                            <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', maxWidth: '480px' }}>
                              <FileText style={{ width: '48px', height: '48px', color: '#2563EB', margin: '0 auto 12px' }} />
                              <h4 style={{ margin: '0 0 6px', color: '#0F172A', fontSize: '16px' }}>Receipt Record</h4>
                              <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 12px' }}>
                                Reference: <strong>{activeDocPreviewModal.details?.grnNo}</strong> | Delivery Challan: <strong>{activeDocPreviewModal.details?.challanNo || 'N/A'}</strong>
                              </p>
                              <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', justifyContent: 'center', gap: '16px', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                                <span>Date: <strong>{activeDocPreviewModal.details?.date || '—'}</strong></span>
                                <span>Accepted Qty: <strong>{activeDocPreviewModal.details?.acceptedQty || 0}</strong></span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
    );
  };

  return renderGrnFormCards();
}
