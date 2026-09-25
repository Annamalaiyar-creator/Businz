import React from "react";
import {
  Plus, Check, Trash2, FileText, AlertCircle, CheckCircle,
  CheckSquare, Truck, Package, Upload, Camera, Video
} from "lucide-react";
import { normalizePaymentTerm, stripDataUrlsFromRecord, getMediaFromCache } from "../../utils/otherViewsShared";
import { centralInventoryStore } from "../../utils/centralInventoryStore";
import { saveCloudStore, saveCloudBomRow } from "../../utils/supabaseDataSync";

export default function ConfirmingBomModal({
  confirmingBomModal,
  setConfirmingBomModal,
  setBomStore,
  setActiveMediaPreviewModal = () => {}
}) {
  const isEditMode = Boolean(
    confirmingBomModal.isEditMode !== false &&
    ['Draft', 'Pending Confirmation', 'Edited / Pending Confirmation', 'Cancelled & Reissued to Dispatch', 'ACTIVE', 'Active', 'Pending Verification', 'Pending'].includes(confirmingBomModal.status)
  );
  const isAlreadyForwarded = !isEditMode;
  const allItemsConfirmed = confirmingBomModal.items && confirmingBomModal.items.length > 0 && confirmingBomModal.items.every(i => i.confirmed);

  const modalPresetGroups = (Array.isArray(confirmingBomModal.presetGroups) && confirmingBomModal.presetGroups.length > 0)
    ? confirmingBomModal.presetGroups.map(g => ({ ...g }))
    : (confirmingBomModal.presetName || (parseFloat(confirmingBomModal.presetKitPrice) > 0))
      ? [{
          presetName: confirmingBomModal.presetName || 'Pre-Engineered Structure Kit Package',
          setCount: parseInt(confirmingBomModal.presetSetCount) || 1,
          kitPrice: parseFloat(confirmingBomModal.presetKitPrice) || 0
        }]
      : [];

  let presetKitsTotal = modalPresetGroups.reduce((acc, g) => acc + ((parseFloat(g.kitPrice) || 0) * (parseInt(g.setCount) || 1)), 0) || (parseFloat(confirmingBomModal.presetKitPrice) || 0);
  const customItemsTotal = (confirmingBomModal.items || []).reduce((acc, it) => acc + ((parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0)), 0);

  // Fallback: If presetKitsTotal is 0, but the BOM has items with rate 0 and grandTotal > customItemsTotal, compute preset package price
  if (presetKitsTotal === 0 && (confirmingBomModal.items || []).some(it => it.isPresetItem || parseFloat(it.rate || 0) === 0)) {
    const gTotal = parseFloat(confirmingBomModal.grandTotal) || 0;
    const sTotal = parseFloat(confirmingBomModal.subTotal) || (gTotal > 0 ? (gTotal / 1.18) : 0);
    if (sTotal > customItemsTotal) {
      presetKitsTotal = Math.max(0, Math.round((sTotal - customItemsTotal) * 100) / 100);
      if (modalPresetGroups.length === 0) {
        modalPresetGroups.push({
          presetName: confirmingBomModal.presetName || 'Pre-Engineered Structure Kit Package',
          setCount: parseInt(confirmingBomModal.presetSetCount) || 1,
          kitPrice: presetKitsTotal
        });
      } else if (modalPresetGroups.length === 1 && (parseFloat(modalPresetGroups[0].kitPrice) || 0) === 0) {
        modalPresetGroups[0].kitPrice = presetKitsTotal / (parseInt(modalPresetGroups[0].setCount) || 1);
      }
    }
  }

  const calculatedSubtotal = presetKitsTotal + customItemsTotal;
  const orderSubTotal = parseFloat(confirmingBomModal.subTotal) || calculatedSubtotal;
  const orderGrandTotal = parseFloat(confirmingBomModal.grandTotal) || (calculatedSubtotal > 0 ? Math.round(calculatedSubtotal * 1.18 * 100) / 100 : 0);
  const orderGstAmount = parseFloat(confirmingBomModal.gstAmount) || (orderGrandTotal > orderSubTotal ? Math.round((orderGrandTotal - orderSubTotal) * 100) / 100 : Math.round(orderSubTotal * 0.18 * 100) / 100);
  const grandTotalCalc = orderGrandTotal;

  const bObj = confirmingBomModal.billingAddressObj || {
    address: confirmingBomModal.billingAddress || '',
    city: '',
    state: '',
    pincode: ''
  };
  const dObj = confirmingBomModal.deliveryAddressObj || {
    address: confirmingBomModal.deliveryAddress || '',
    city: '',
    state: '',
    pincode: ''
  };

  const formatAddr = (obj, fallbackStr) => {
    if (!obj) return fallbackStr || '—';
    const { address, city, state, pincode } = obj;
    const parts = [];
    if (address && address.trim() && address.trim() !== '—') parts.push(address.trim());
    if (city && city.trim() && city.trim() !== '—') parts.push(city.trim());
    if (state && state.trim() && state.trim() !== '—' && pincode && pincode.trim() && pincode.trim() !== '—') {
      parts.push(`${state.trim()} - ${pincode.trim()}`);
    } else {
      if (state && state.trim() && state.trim() !== '—') parts.push(state.trim());
      if (pincode && pincode.trim() && pincode.trim() !== '—') parts.push(pincode.trim());
    }
    return parts.length > 0 ? parts.join(', ') : (fallbackStr || '—');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', fontFamily: "'DM Sans', sans-serif", backgroundColor: '#F8FAFC', padding: '24px', borderRadius: '16px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            {isAlreadyForwarded ? `BOM Details & Order Summary — ${confirmingBomModal.bomCode}` : `BOM Verification & Order Editing — ${confirmingBomModal.bomCode}`}
          </h1>
          <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', display: 'block' }}>
            {isAlreadyForwarded
              ? 'Review verified bill of materials, product breakdown, and order specifications.'
              : 'Review & modify company details, billing/delivery addresses, payment terms, or product specifications before final dispatch.'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setConfirmingBomModal(null)}
            style={{ border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', height: '40px', padding: '0 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
          >
            Back to BOM Dashboard
          </button>

          {!isAlreadyForwarded && (
            <button
              onClick={() => {
                const isDeliveryMatching = Boolean(confirmingBomModal.sameAsBilling) || (
                  ((dObj.address || '').trim() === (bObj.address || '').trim()) &&
                  ((dObj.city || '').trim() === (bObj.city || '').trim()) &&
                  ((dObj.state || '').trim() === (bObj.state || '').trim()) &&
                  ((dObj.pincode || '').trim() === (bObj.pincode || '').trim())
                );



                const bStr = formatAddr(bObj, confirmingBomModal.billingAddress);
                const dStr = confirmingBomModal.sameAsBilling ? bStr : formatAddr(dObj, confirmingBomModal.deliveryAddress);
                const finalDObj = confirmingBomModal.sameAsBilling ? { ...bObj } : { ...dObj };

                const finalizedItems = (confirmingBomModal.items || []).map(i => ({ ...i, confirmed: true }));
                const packingItems = (confirmingBomModal.dispatchPacking && confirmingBomModal.dispatchPacking.length > 0)
                  ? confirmingBomModal.dispatchPacking
                  : finalizedItems.map(it => ({
                    name: it.name || it.c2 || 'Item',
                    bomQty: it.qty || 1,
                    packed: false
                  }));

                const updatedBomRecord = {
                  ...confirmingBomModal,
                  companyName: confirmingBomModal.companyName || bObj.companyName,
                  paymentType: confirmingBomModal.paymentType,
                  partialAmount: confirmingBomModal.paymentType === 'Partial Payment' ? (parseFloat(confirmingBomModal.partialAmount) || 0) : (confirmingBomModal.partialAmount || null),
                  balanceAmount: confirmingBomModal.paymentType === 'Partial Payment' ? Math.max(0, (confirmingBomModal.grandTotal || orderGrandTotal) - (parseFloat(confirmingBomModal.partialAmount) || 0)) : (confirmingBomModal.paymentType === '100% Paid' ? 0 : (confirmingBomModal.grandTotal || orderGrandTotal)),
                  billingAddress: bStr,
                  billingAddressObj: bObj,
                  deliveryAddress: dStr,
                  deliveryAddressObj: finalDObj,
                  deliveryAddressProofDoc: confirmingBomModal.sameAsBilling ? null : (confirmingBomModal.deliveryAddressProofDoc || null),
                  items: finalizedItems,
                  dispatchPacking: packingItems,
                  status: 'Sent to Production',
                  stockBlocked: true,
                  stockBlockedAt: confirmingBomModal.stockBlockedAt || new Date().toISOString(),
                  stockDeducted: true,
                  subTotal: confirmingBomModal.subTotal || orderSubTotal,
                  gstAmount: confirmingBomModal.gstAmount || orderGstAmount,
                  grandTotal: confirmingBomModal.grandTotal || orderGrandTotal
                };

                // 1. Deduct / Reserve inventory across all stores (only if not already blocked on creation)
                if (!confirmingBomModal.stockBlocked && !confirmingBomModal.stockDeducted) {
                  try {
                    centralInventoryStore.deductStockForBOM(confirmingBomModal.bomCode, finalizedItems, 'Sales BOM Verification');
                  } catch (cErr) {
                    console.warn('Inventory deduction error on BOM confirmation:', cErr);
                  }
                }

                // 2. Update React State and persist locally & to cloud
                setBomStore(prev => {
                  const updated = (prev || []).map(b => b.bomCode === confirmingBomModal.bomCode ? { ...b, ...updatedBomRecord } : b);
                  try {
                    localStorage.setItem('controlroom_bom_store', JSON.stringify(updated.map(stripDataUrlsFromRecord)));
                    saveCloudBomRow({ ...confirmingBomModal, ...updatedBomRecord });
                  } catch (_) {}
                  return updated;
                });

                // 2.1 If BOM originated from a PI, mark the PI as Converted
                const srcPi = confirmingBomModal.sourcePiNo || confirmingBomModal.piNo;
                if (srcPi) {
                  const updatePiList = (storeKey) => {
                    try {
                      const raw = localStorage.getItem(storeKey);
                      if (raw) {
                        const list = JSON.parse(raw);
                        if (Array.isArray(list)) {
                          const updated = list.map(pi => (pi.piNo === srcPi || pi.id === srcPi) ? {
                            ...pi,
                            status: 'Converted to BOM',
                            convertedToBom: true,
                            isConverted: true,
                            convertedBomCode: confirmingBomModal.bomCode,
                            convertedDate: new Date().toISOString()
                          } : pi);
                          localStorage.setItem(storeKey, JSON.stringify(updated));
                          saveCloudStore('sales_pi_store', updated);
                        }
                      }
                    } catch (_) {}
                  };
                  updatePiList('controlroom_sales_pi_store');
                  updatePiList('controlroom_procurement_pi_store');
                }

                // 3. Post to backend and trigger server reconciliation
                try {
                  fetch('/api/boms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bom: stripDataUrlsFromRecord(updatedBomRecord), isUpdate: true })
                  }).catch(() => {});
                  fetch('/api/inventory/reconcile-boms', { method: 'POST' }).catch(() => {});
                } catch (_) {}

                // 4. Dispatch live synchronization events
                window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: { bom: updatedBomRecord } }));
                window.dispatchEvent(new Event('central_inventory_updated'));
                window.dispatchEvent(new Event('controlroom_raw_materials_update'));
                window.dispatchEvent(new Event('controlroom_storage_update'));
                window.dispatchEvent(new Event('storage'));

                // Trigger Real-time Workflow Notification with synthesized sound & deep-link to Dispatch Orders
                notifyBomSentToDispatch({
                  bomCode: confirmingBomModal.bomCode,
                  customerName: confirmingBomModal.companyName || confirmingBomModal.customerName,
                  salesPerson: confirmingBomModal.salesPerson
                });

                setConfirmingBomModal(null);
                alert(`✅ BOM (${confirmingBomModal.bomCode}) successfully verified and sent to Production (Work Orders) & Dispatch Orders!\n\nInventory has been allocated and deducted.`);
              }}
              style={{
                border: 'none',
                backgroundColor: '#166534',
                color: 'white',
                height: '40px',
                padding: '0 24px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(22,101,52,0.2)'
              }}
            >
              <CheckCircle style={{ width: '16px', height: '16px' }} />
              Send BOM to Production & Dispatch
            </button>
          )}
        </div>
      </div>

      {/* GENERAL BOM & ORDER DETAILS */}
      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {isAlreadyForwarded ? 'BILL OF MATERIALS SUMMARY' : 'ORDER DETAILS & ADDRESSES'}
            </span>
            {!isAlreadyForwarded && (
              <span style={{ fontSize: '11px', color: '#64748B', backgroundColor: '#F1F5F9', padding: '2px 8px', borderRadius: '4px' }}>
                Customer name locked • Addresses & terms editable
              </span>
            )}
          </div>
          <span style={{
            backgroundColor: isAlreadyForwarded ? '#DCFCE7' : '#FEF3C7',
            color: isAlreadyForwarded ? '#166534' : '#B45309',
            padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', display: 'inline-block'
          }}>
            {confirmingBomModal.status}
          </span>
        </div>

        {/* Customer (Locked), Company Name (Editable) & Payment Type (Editable) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '6px' }}>
              CUSTOMER NAME
            </label>
            <input
              type="text"
              value={confirmingBomModal.customerName}
              readOnly
              style={{
                width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px',
                fontSize: '13px', fontWeight: '700', color: '#475569', backgroundColor: '#F8FAFC', outline: 'none', cursor: 'not-allowed', boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
              COMPANY NAME {!isAlreadyForwarded && <span style={{ color: '#2563EB', fontSize: '10px' }}>(Editable)</span>}
            </label>
            {isAlreadyForwarded ? (
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', height: '40px', display: 'flex', alignItems: 'center' }}>
                {confirmingBomModal.companyName || confirmingBomModal.customerName || '—'}
              </div>
            ) : (
              <input
                type="text"
                placeholder="Company Name..."
                value={confirmingBomModal.companyName || ''}
                onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, companyName: e.target.value })}
                style={{
                  width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px',
                  fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', outline: 'none', boxSizing: 'border-box'
                }}
              />
            )}
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
              PAYMENT TYPE {!isAlreadyForwarded && <span style={{ color: '#2563EB', fontSize: '10px' }}>(Editable)</span>}
            </label>
            {isAlreadyForwarded ? (
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#2563EB', height: '40px', display: 'flex', alignItems: 'center' }}>
                {normalizePaymentTerm(confirmingBomModal.paymentType)}
              </div>
            ) : (
              <select
                value={normalizePaymentTerm(confirmingBomModal.paymentType)}
                onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, paymentType: e.target.value })}
                style={{
                  width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px',
                  fontSize: '13px', fontWeight: '700', color: '#2563EB', backgroundColor: '#FFFFFF', outline: 'none', cursor: 'pointer', boxSizing: 'border-box'
                }}
              >
                <option value="100% Paid">100% Paid</option>
                <option value="Partial Paid">Partial Paid</option>
                <option value="Payment While Dispatch">Payment While Dispatch</option>
                <option value="Credit Payment">Credit Payment</option>
              </select>
            )}
          </div>

          {(confirmingBomModal.paymentType === 'Partial Paid' || confirmingBomModal.paymentType === 'Partial Payment') && (
            <div style={{ gridColumn: 'span 2', backgroundColor: '#F0FDFA', border: '1.5px solid #99F6E4', borderRadius: '10px', padding: '12px 14px', marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F766E' }}>
                  Advance Paid Amount (₹)
                </span>
                <span style={{ fontSize: '11px', color: '#0D9488', fontWeight: '700' }}>
                  Total Order: ₹{Number(confirmingBomModal.grandTotal || confirmingBomModal.subTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input
                  type="number"
                  min="0"
                  disabled={isAlreadyForwarded}
                  value={confirmingBomModal.partialAmount !== undefined && confirmingBomModal.partialAmount !== null ? confirmingBomModal.partialAmount : ''}
                  onChange={(e) => {
                    const pAmt = parseFloat(e.target.value) || 0;
                    const gTot = parseFloat(confirmingBomModal.grandTotal || confirmingBomModal.subTotal || 0);
                    setConfirmingBomModal({
                      ...confirmingBomModal,
                      partialAmount: e.target.value,
                      balanceAmount: Math.max(0, gTot - pAmt)
                    });
                  }}
                  placeholder="Enter advance amount"
                  style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #5EEAD4', padding: '0 12px', fontSize: '13px', fontWeight: '700', color: '#0F172A', backgroundColor: isAlreadyForwarded ? '#F1F5F9' : '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #CCFBF1', padding: '0 12px', height: '38px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Remaining Balance</span>
                  <strong style={{ fontSize: '13px', color: '#0F766E' }}>
                    ₹{Math.max(0, (parseFloat(confirmingBomModal.grandTotal || confirmingBomModal.subTotal || 0)) - (parseFloat(confirmingBomModal.partialAmount) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* STRUCTURED ADDRESS CARDS (EDITABLE OR READ-ONLY) */}
        {(() => {
          const bStreet = bObj.address || '—';
          const bCity = bObj.city || '—';
          const bState = bObj.state || '—';
          const bPin = bObj.pincode || '—';

          const dStreet = dObj.address || '—';
          const dCity = dObj.city || '—';
          const dState = dObj.state || '—';
          const dPin = dObj.pincode || '—';

          const isDeliveryMatching = Boolean(confirmingBomModal.sameAsBilling) || (
            ((dObj.address || '').trim() === (bObj.address || '').trim()) &&
            ((dObj.city || '').trim() === (bObj.city || '').trim()) &&
            ((dObj.state || '').trim() === (bObj.state || '').trim()) &&
            ((dObj.pincode || '').trim() === (bObj.pincode || '').trim())
          );

          if (isAlreadyForwarded) {
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '4px' }}>
                {/* Read-Only Billing Address Card */}
                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '800', color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px' }}>
                    <FileText style={{ width: '13px', height: '13px', color: '#2563EB' }} /> Billing Address
                  </div>
                  <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>
                    <div><strong>Address:</strong> {bStreet}</div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px', color: '#64748B', fontSize: '11px' }}>
                      <span>City: <strong style={{ color: '#334155' }}>{bCity}</strong></span>
                      <span>State: <strong style={{ color: '#334155' }}>{bState}</strong></span>
                      <span>Pincode: <strong style={{ color: '#334155' }}>{bPin}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Read-Only Delivery Address Card */}
                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '800', color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px' }}>
                    <Truck style={{ width: '13px', height: '13px', color: '#4F46E5' }} /> Delivery Address
                  </div>
                  <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>
                    <div><strong>Address:</strong> {dStreet}</div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px', color: '#64748B', fontSize: '11px' }}>
                      <span>City: <strong style={{ color: '#334155' }}>{dCity}</strong></span>
                      <span>State: <strong style={{ color: '#334155' }}>{dState}</strong></span>
                      <span>Pincode: <strong style={{ color: '#334155' }}>{dPin}</strong></span>
                    </div>
                    {confirmingBomModal.deliveryAddressProofDoc ? (
                      <div style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '700', color: '#166534' }}>
                          <FileText style={{ width: '13px', height: '13px' }} />
                          Address Proof: {confirmingBomModal.deliveryAddressProofDoc.name}
                        </div>
                        <span style={{ fontSize: '10px', color: '#15803D', fontWeight: '800' }}>Verified</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          }

          // EDITABLE ADDRESSES IN PENDING CONFIRMATION / DRAFT
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '4px' }}>
              {/* EDITABLE BILLING ADDRESS */}
              <div style={{
                backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px',
                padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                    <FileText style={{ width: '14px', height: '14px' }} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Billing Address</h4>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Editable for order invoice billing</span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>
                    Address (Street / Building / Area)
                  </label>
                  <input
                    type="text"
                    placeholder="Street Address..."
                    value={bObj.address || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConfirmingBomModal({
                        ...confirmingBomModal,
                        billingAddressObj: { ...bObj, address: val },
                        deliveryAddressObj: confirmingBomModal.sameAsBilling ? { ...dObj, address: val } : dObj
                      });
                    }}
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                    <input
                      type="text"
                      placeholder="City..."
                      value={bObj.city || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setConfirmingBomModal({
                          ...confirmingBomModal,
                          billingAddressObj: { ...bObj, city: val },
                          deliveryAddressObj: confirmingBomModal.sameAsBilling ? { ...dObj, city: val } : dObj
                        });
                      }}
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                    <input
                      type="text"
                      placeholder="State..."
                      value={bObj.state || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setConfirmingBomModal({
                          ...confirmingBomModal,
                          billingAddressObj: { ...bObj, state: val },
                          deliveryAddressObj: confirmingBomModal.sameAsBilling ? { ...dObj, state: val } : dObj
                        });
                      }}
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pincode</label>
                    <input
                      type="text"
                      placeholder="Pincode..."
                      value={bObj.pincode || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setConfirmingBomModal({
                          ...confirmingBomModal,
                          billingAddressObj: { ...bObj, pincode: val },
                          deliveryAddressObj: confirmingBomModal.sameAsBilling ? { ...dObj, pincode: val } : dObj
                        });
                      }}
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>

              {/* EDITABLE DELIVERY ADDRESS */}
              <div style={{
                backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px',
                padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5' }}>
                      <Truck style={{ width: '14px', height: '14px' }} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Delivery Address</h4>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Destination for physical dispatch</span>
                    </div>
                  </div>

                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#4F46E5', cursor: 'pointer', backgroundColor: '#EEF2FF', padding: '4px 10px', borderRadius: '8px', border: '1px solid #C7D2FE' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(confirmingBomModal.sameAsBilling)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked) {
                          setConfirmingBomModal({
                            ...confirmingBomModal,
                            sameAsBilling: true,
                            deliveryAddressObj: { ...bObj }
                          });
                        } else {
                          setConfirmingBomModal({
                            ...confirmingBomModal,
                            sameAsBilling: false
                          });
                        }
                      }}
                      style={{ accentColor: '#4F46E5', cursor: 'pointer' }}
                    />
                    Same as Billing
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>
                    Address (Street / Building / Area)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Plot No 42, SIDCO Industrial Estate"
                    value={confirmingBomModal.sameAsBilling ? (bObj.address || '') : (dObj.address || '')}
                    disabled={confirmingBomModal.sameAsBilling}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConfirmingBomModal({
                        ...confirmingBomModal,
                        deliveryAddressObj: { ...dObj, address: val }
                      });
                    }}
                    style={{
                      width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px',
                      color: confirmingBomModal.sameAsBilling ? '#64748B' : '#0F172A',
                      backgroundColor: confirmingBomModal.sameAsBilling ? '#F1F5F9' : '#FFFFFF',
                      boxSizing: 'border-box', outline: 'none',
                      cursor: confirmingBomModal.sameAsBilling ? 'not-allowed' : 'text'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                    <input
                      type="text"
                      placeholder="e.g. Chennai"
                      value={confirmingBomModal.sameAsBilling ? (bObj.city || '') : (dObj.city || '')}
                      disabled={confirmingBomModal.sameAsBilling}
                      onChange={(e) => {
                        const val = e.target.value;
                        setConfirmingBomModal({
                          ...confirmingBomModal,
                          deliveryAddressObj: { ...dObj, city: val }
                        });
                      }}
                      style={{
                        width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px',
                        color: confirmingBomModal.sameAsBilling ? '#64748B' : '#0F172A',
                        backgroundColor: confirmingBomModal.sameAsBilling ? '#F1F5F9' : '#FFFFFF',
                        boxSizing: 'border-box', outline: 'none',
                        cursor: confirmingBomModal.sameAsBilling ? 'not-allowed' : 'text'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                    <input
                      type="text"
                      placeholder="e.g. Tamil Nadu"
                      value={confirmingBomModal.sameAsBilling ? (bObj.state || '') : (dObj.state || '')}
                      disabled={confirmingBomModal.sameAsBilling}
                      onChange={(e) => {
                        const val = e.target.value;
                        setConfirmingBomModal({
                          ...confirmingBomModal,
                          deliveryAddressObj: { ...dObj, state: val }
                        });
                      }}
                      style={{
                        width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px',
                        color: confirmingBomModal.sameAsBilling ? '#64748B' : '#0F172A',
                        backgroundColor: confirmingBomModal.sameAsBilling ? '#F1F5F9' : '#FFFFFF',
                        boxSizing: 'border-box', outline: 'none',
                        cursor: confirmingBomModal.sameAsBilling ? 'not-allowed' : 'text'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pincode</label>
                    <input
                      type="text"
                      placeholder="e.g. 600058"
                      value={confirmingBomModal.sameAsBilling ? (bObj.pincode || '') : (dObj.pincode || '')}
                      disabled={confirmingBomModal.sameAsBilling}
                      onChange={(e) => {
                        const val = e.target.value;
                        setConfirmingBomModal({
                          ...confirmingBomModal,
                          deliveryAddressObj: { ...dObj, pincode: val }
                        });
                      }}
                      style={{
                        width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px',
                        color: confirmingBomModal.sameAsBilling ? '#64748B' : '#0F172A',
                        backgroundColor: confirmingBomModal.sameAsBilling ? '#F1F5F9' : '#FFFFFF',
                        boxSizing: 'border-box', outline: 'none',
                        cursor: confirmingBomModal.sameAsBilling ? 'not-allowed' : 'text'
                      }}
                    />
                  </div>
                </div>

                {/* MANDATORY ADDRESS PROOF ATTACHMENT WHEN DELIVERY ADDRESS DIFFERS FROM BILLING */}
                {!isDeliveryMatching ? (
                  <div style={{
                    marginTop: '6px',
                    padding: '14px 16px',
                    backgroundColor: '#FEF2F2',
                    border: '1px dashed #F87171',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <AlertCircle style={{ width: '14px', height: '14px' }} />
                        </div>
                        <div>
                          <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>
                            Delivery Address Proof Document <span style={{ color: '#64748B', fontWeight: '600' }}>(Optional)</span>
                          </h5>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>
                            Delivery address differs from billing address. Upload proof (GST / Electricity Bill / Lease Agreement) if available.
                          </span>
                        </div>
                      </div>
                      {confirmingBomModal.deliveryAddressProofDoc && (
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle style={{ width: '12px', height: '12px' }} /> Attached
                        </span>
                      )}
                    </div>

                    {confirmingBomModal.deliveryAddressProofDoc ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: '10px 14px', borderRadius: '8px', border: '1px solid #FECACA' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText style={{ width: '16px', height: '16px', color: '#DC2626' }} />
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>{confirmingBomModal.deliveryAddressProofDoc.name}</div>
                            <div style={{ fontSize: '10px', color: '#64748B' }}>{confirmingBomModal.deliveryAddressProofDoc.size || '1.2 MB'} • Uploaded</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setConfirmingBomModal({ ...confirmingBomModal, deliveryAddressProofDoc: null })}
                          style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Trash2 style={{ width: '13px', height: '13px' }} /> Remove
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <label style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          backgroundColor: '#FFFFFF', border: '1px solid #DC2626', color: '#DC2626',
                          padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
                          cursor: 'pointer'
                        }}>
                          <Upload style={{ width: '13px', height: '13px' }} />
                          Upload Address Proof Document
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files && e.target.files[0];
                              if (file) {
                                setConfirmingBomModal(prev => ({
                                  ...prev,
                                  deliveryAddressProofDoc: {
                                    name: file.name,
                                    size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
                                    type: file.type || "application/pdf",
                                    uploadedAt: new Date().toISOString()
                                  }
                                }));
                              }
                            }}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: '#166534', backgroundColor: '#DCFCE7', border: '1px solid #BBF7D0', padding: '8px 12px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle style={{ width: '13px', height: '13px' }} /> Delivery address matches registered billing address. No additional address proof required.
                  </div>
                )}
              </div>

            </div>
          );
        })()}

        {/* DISPATCH PACKED ITEMS MEDIA VIEWER FOR SALES */}
        {(() => {
          const packMedia = confirmingBomModal.dispatchPackingMedia || {};
          const packPhotos = packMedia.photos || [];
          const packVideos = packMedia.videos || [];
          const hasMedia = packPhotos.length > 0 || packVideos.length > 0;

          if (!hasMedia && !confirmingBomModal.status?.includes('Dispatch') && !confirmingBomModal.status?.includes('Packed') && !confirmingBomModal.dispatchPacking) {
            return null;
          }

          return (
            <div style={{
              marginTop: '16px',
              backgroundColor: 'white',
              padding: '18px 22px',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#ECFEFF', color: '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Camera size={16} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', color: '#0F172A' }}>
                      Dispatch Packed Items Media ({packPhotos.length} Photos, {packVideos.length} Videos)
                    </h4>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>
                      Photos and videos captured by Dispatch Fulfillment Team during packing
                    </span>
                  </div>
                </div>

                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  backgroundColor: hasMedia ? '#DCFCE7' : '#F1F5F9',
                  color: hasMedia ? '#166534' : '#64748B',
                  border: `1px solid ${hasMedia ? '#BBF7D0' : '#E2E8F0'}`
                }}>
                  {hasMedia ? '✓ Media Attached' : 'Awaiting Dispatch Media'}
                </span>
              </div>

              {hasMedia ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginTop: '4px' }}>
                  {packPhotos.map((ph, pIdx) => {
                    const photoUrl = (ph.url && !ph.url.startsWith('blob:')) ? ph.url : (ph.dataUrl || getMediaFromCache(ph.name) || getMediaFromCache(ph.id) || (ph.name ? `/api/uploads/${ph.name}` : '') || ph.url || '');
                    return (
                      <div
                        key={ph.id || pIdx}
                        onClick={() => setActiveMediaPreviewModal({ type: 'image', url: photoUrl, name: ph.name || `Packed Item Photo ${pIdx + 1}` })}
                        style={{
                          height: '84px',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          border: '1.5px solid #CBD5E1',
                          backgroundColor: '#0F172A',
                          position: 'relative',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                          transition: 'transform 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <img src={photoUrl || ph.dataUrl} alt={ph.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0,
                          backgroundColor: 'rgba(15,23,42,0.75)', color: '#FFFFFF',
                          padding: '2px 6px', fontSize: '10px', fontWeight: '700',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                          <span>📷 View Photo</span>
                          <span>›</span>
                        </div>
                      </div>
                    );
                  })}
                  {packVideos.map((vd, vIdx) => {
                    const videoUrl = (vd.url && !vd.url.startsWith('blob:')) ? vd.url : (vd.dataUrl || getMediaFromCache(vd.name) || getMediaFromCache(vd.id) || (vd.name ? `/api/uploads/${vd.name}` : '') || vd.url || '');
                    return (
                      <div
                        key={vd.id || vIdx}
                        onClick={() => setActiveMediaPreviewModal({ type: 'video', url: videoUrl, name: vd.name || `Packed Item Video ${vIdx + 1}` })}
                        style={{
                          height: '84px',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          border: '1.5px solid #CBD5E1',
                          backgroundColor: '#0F172A',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          position: 'relative',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                          transition: 'transform 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <Video size={22} style={{ color: '#38BDF8' }} />
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0,
                          backgroundColor: 'rgba(15,23,42,0.75)', color: '#FFFFFF',
                          padding: '2px 6px', fontSize: '10px', fontWeight: '700',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                          <span>🎥 Watch Video</span>
                          <span>›</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic', padding: '6px 0' }}>
                  No dispatch packing photos or videos attached yet for this order.
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* PRODUCT ITEMS TABLE */}
      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              {isAlreadyForwarded ? 'Itemized Product & Material Breakdown' : 'Product Verification List'}
            </h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              {isAlreadyForwarded
                ? 'Itemized specifications and rate breakdown passed to Production & Dispatch teams.'
                : 'Check every product box after verifying item details. Modify or add products if incorrect.'}
            </span>
          </div>

          {!isAlreadyForwarded && (
            <button
              onClick={() => {
                const currentItems = confirmingBomModal.items || [];
                const updatedItems = [...currentItems, { name: '', category: '', qty: 1, rate: 0, confirmed: false }];
                setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
              }}
              style={{ border: '1px solid #E0E7FF', backgroundColor: '#EEF2FF', color: '#4F46E5', height: '36px', padding: '0 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus style={{ width: '14px', height: '14px' }} /> Add New Product
            </button>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                {!isAlreadyForwarded && <th style={{ padding: '12px 10px', width: '40px', textAlign: 'center' }}>✓</th>}
                <th style={{ padding: '12px 10px', width: '40px', textAlign: 'center' }}>#</th>
                <th style={{ padding: '12px 10px', width: '25%' }}>Product / Component Name</th>
                <th style={{ padding: '12px 10px', width: '18%' }}>Description</th>
                <th style={{ padding: '12px 10px', width: '9%', textAlign: 'center' }}>UOM</th>
                <th style={{ padding: '12px 10px', width: '9%', textAlign: 'center' }}>Qty</th>
                <th style={{ padding: '12px 10px', width: '12%', textAlign: 'right' }}>Rate (₹)</th>
                <th style={{ padding: '12px 10px', width: '13%', textAlign: 'right' }}>Total (₹)</th>
                {!isAlreadyForwarded && <th style={{ padding: '12px 10px', width: '50px', textAlign: 'center' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {/* Build mapping for Preset Kit grouping to show consolidated amount in the middle of items (like PI) */}
              {(() => {
                const presetGroupMap = {};
                (confirmingBomModal.items || []).forEach((item, idx) => {
                  const itemRate = parseFloat(item.rate) || 0;
                  const isPartBundle = Boolean(item.isPresetItem || (modalPresetGroups.length > 0 && itemRate === 0));
                  if (isPartBundle) {
                    const gid = item.presetGroupId || (modalPresetGroups[0]?.presetGroupId) || 'default_kit';
                    if (!presetGroupMap[gid]) {
                      const matchedGrp = modalPresetGroups.find(g => (g.presetGroupId || 'default_kit') === gid) || modalPresetGroups[0] || {};
                      const sets = parseInt(matchedGrp.setCount) || 1;
                      const price = parseFloat(matchedGrp.kitPrice) || (presetKitsTotal / sets) || 0;
                      presetGroupMap[gid] = {
                        firstIdx: idx,
                        count: 0,
                        presetName: matchedGrp.presetName || confirmingBomModal.presetName || 'Preset MMS Kit',
                        setCount: sets,
                        kitPrice: price,
                        totalAmount: price * sets
                      };
                    }
                    presetGroupMap[gid].count += 1;
                  }
                });

                return (confirmingBomModal.items || []).map((item, idx) => {
                  const itemQty = parseFloat(item.qty) || 0;
                  const itemRate = parseFloat(item.rate) || 0;
                  const itemTotal = itemQty * itemRate;
                  const isPartBundle = Boolean(item.isPresetItem || (modalPresetGroups.length > 0 && itemRate === 0));
                  const gid = isPartBundle ? (item.presetGroupId || (modalPresetGroups[0]?.presetGroupId) || 'default_kit') : null;
                  const pInfo = gid ? presetGroupMap[gid] : null;
                  const isFirstInKit = pInfo && pInfo.firstIdx === idx;

                  if (isAlreadyForwarded) {
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: isPartBundle ? '#FAFEFF' : '#FFFFFF' }}>
                        <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '700', color: '#64748B' }}>{idx + 1}</td>
                        <td style={{ padding: '12px 10px', fontWeight: '700', color: '#0F172A' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {isPartBundle && (
                              <span style={{ backgroundColor: '#ECFEFF', color: '#0E7490', border: '1px solid #A5F3FC', fontSize: '10px', fontWeight: '800', padding: '2px 7px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                KIT COMPONENT
                              </span>
                            )}
                            <span>{item.name || '—'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 10px', color: '#64748B' }}>{item.category || item.specs || '—'}</td>
                        <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '700', color: '#475569' }}>{item.uom || item.unit || 'NOS'}</td>
                        <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '800', color: '#2563EB' }}>{itemQty}</td>
                        
                        {/* Rate Column: Consolidated & Centered in Middle for Presets (Like PI) */}
                        {isPartBundle ? (
                          isFirstInKit ? (
                            <td
                              rowSpan={pInfo.count}
                              style={{
                                padding: '12px 10px',
                                textAlign: 'right',
                                verticalAlign: 'middle',
                                backgroundColor: '#F0FDFA',
                                borderLeft: '1.5px solid #CCFBF1',
                                borderRight: '1px solid #CCFBF1'
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                                <span style={{ fontSize: '10px', fontWeight: '800', color: '#0E7490', backgroundColor: '#CCFBF1', padding: '2px 7px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                  {pInfo.setCount} Set{pInfo.setCount > 1 ? 's' : ''} Kit
                                </span>
                                <span style={{ fontWeight: '800', color: '#0E7490', fontSize: '13.5px' }}>
                                  ₹ {pInfo.kitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </td>
                          ) : null
                        ) : (
                          <td style={{ padding: '12px 10px', textAlign: 'right', color: '#334155' }}>
                            ₹ {itemRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        )}

                        {/* Total Column: Consolidated & Centered in Middle for Presets (Like PI) */}
                        {isPartBundle ? (
                          isFirstInKit ? (
                            <td
                              rowSpan={pInfo.count}
                              style={{
                                padding: '12px 10px',
                                textAlign: 'right',
                                verticalAlign: 'middle',
                                fontWeight: '900',
                                color: '#0E7490',
                                fontSize: '14px',
                                backgroundColor: '#F0FDFA'
                              }}
                            >
                              ₹ {pInfo.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          ) : null
                        ) : (
                          <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                            ₹ {itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        )}
                      </tr>
                    );
                  }

                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: item.confirmed ? '#F0FDF4' : 'transparent' }}>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(item.confirmed)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, confirmed: checked } : it);
                          setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                        }}
                        style={{ width: '16px', height: '16px', accentColor: '#166534', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '700', color: '#64748B' }}>{idx + 1}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <input
                        type="text"
                        placeholder="Product Name..."
                        value={item.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, name: val } : it);
                          setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                        }}
                        style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12px', color: '#0F172A', outline: 'none' }}
                      />
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <input
                        type="text"
                        placeholder="Description..."
                        value={item.category || item.specs || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, category: val, specs: val } : it);
                          setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                        }}
                        style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12px', color: '#0F172A', outline: 'none' }}
                      />
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <input
                        type="text"
                        placeholder="UOM"
                        value={item.uom || item.unit || 'NOS'}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, uom: val, unit: val } : it);
                          setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                        }}
                        style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 6px', fontSize: '12px', textAlign: 'center', fontWeight: '700', color: '#0F172A', outline: 'none' }}
                      />
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, qty: val } : it);
                          setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                        }}
                        style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 6px', fontSize: '12px', textAlign: 'center', color: '#0F172A', outline: 'none' }}
                      />
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <input
                        type="number"
                        min="0"
                        value={item.rate}
                        placeholder={isPartBundle ? '0 (Bundled)' : '0'}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, rate: val } : it);
                          setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                        }}
                        style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '12px', textAlign: 'right', color: '#0F172A', outline: 'none' }}
                      />
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                      {itemTotal > 0 ? (
                        `₹ ${itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                      ) : isPartBundle ? (
                        <span style={{ color: '#0E7490', fontSize: '11px', fontWeight: '800', backgroundColor: '#ECFEFF', padding: '3px 6px', borderRadius: '4px' }}>
                          Included
                        </span>
                      ) : (
                        '₹ 0.00'
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <button
                        onClick={() => {
                          const updatedItems = (confirmingBomModal.items || []).filter((_, i) => i !== idx);
                          setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                        }}
                        style={{ border: 'none', background: '#FEE2E2', color: '#DC2626', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 style={{ width: '14px', height: '14px' }} />
                      </button>
                    </td>
                  </tr>
                );
              });
            })()}
            </tbody>
          </table>
        </div>

        {/* Summary math block */}
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '13px', color: '#64748B', display: 'block' }}>
              Showing {confirmingBomModal.items?.length || 0} itemized BOM components{modalPresetGroups.length > 0 ? ` + ${modalPresetGroups.length} Preset Kit Package` : ''}
            </span>
            {modalPresetGroups.length > 0 && (
              <span style={{ fontSize: '12px', color: '#0E7490', fontWeight: '600', marginTop: '4px', display: 'block' }}>
                ℹ️ Hardware components with ₹0.00 rate are physical items included inside the Preset Kit package above.
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: '#64748B', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {presetKitsTotal > 0 && (
                  <span>Preset Kit(s): <strong style={{ color: '#0E7490', fontWeight: '800' }}>₹ {presetKitsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                )}
                {customItemsTotal > 0 && (
                  <span>Additional Items: <strong style={{ color: '#0F172A', fontWeight: '800' }}>₹ {customItemsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                )}
                <span>Taxable Subtotal: <strong style={{ color: '#0F172A', fontWeight: '800' }}>₹ {orderSubTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                <span>GST: <strong style={{ color: '#64748B', fontWeight: '700' }}>₹ {orderGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
              </div>
              <div style={{ fontSize: '14px', color: '#334155' }}>
                Total Order Value: <strong style={{ color: '#0E7490', fontSize: '17px', fontWeight: '900' }}>₹ {orderGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>

            {!isAlreadyForwarded && (
              <button
                onClick={() => {
                  const isDeliveryMatching = Boolean(confirmingBomModal.sameAsBilling) || (
                    ((dObj.address || '').trim() === (bObj.address || '').trim()) &&
                    ((dObj.city || '').trim() === (bObj.city || '').trim()) &&
                    ((dObj.state || '').trim() === (bObj.state || '').trim()) &&
                    ((dObj.pincode || '').trim() === (bObj.pincode || '').trim())
                  );

                  const currentItems = confirmingBomModal.items || [];
                  const allCheckedItems = currentItems.map(it => ({ ...it, confirmed: true }));
                  const bStr = formatAddr(bObj, confirmingBomModal.billingAddress);
                  const dStr = confirmingBomModal.sameAsBilling ? bStr : formatAddr(dObj, confirmingBomModal.deliveryAddress);
                  const finalDObj = confirmingBomModal.sameAsBilling ? { ...bObj } : { ...dObj };

                  setConfirmingBomModal({ ...confirmingBomModal, items: allCheckedItems });
                  setBomStore(prev => prev.map(b => b.bomCode === confirmingBomModal.bomCode ? {
                    ...b,
                    companyName: confirmingBomModal.companyName || b.companyName,
                    paymentType: confirmingBomModal.paymentType || b.paymentType,
                    billingAddress: bStr,
                    billingAddressObj: bObj,
                    deliveryAddress: dStr,
                    deliveryAddressObj: finalDObj,
                    deliveryAddressProofDoc: confirmingBomModal.sameAsBilling ? null : (confirmingBomModal.deliveryAddressProofDoc || null),
                    items: allCheckedItems,
                    status: 'Pending Confirmation',
                    subTotal: orderSubTotal,
                    gstAmount: orderGstAmount,
                    grandTotal: orderGrandTotal
                  } : b));
                  alert('All product specifications confirmed! You can now click Send BOM.');
                }}
                style={{ border: 'none', backgroundColor: '#1E40AF', color: 'white', height: '38px', padding: '0 20px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CheckSquare style={{ width: '14px', height: '14px' }} /> Confirm All Products
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
