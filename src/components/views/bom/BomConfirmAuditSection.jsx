import React from 'react';
import {
  Plus, Check, Trash2, Eye, FileText, AlertCircle, XCircle, CheckCircle, RotateCcw, Truck, Upload, Printer, Download, CreditCard, CheckSquare, Camera, Video, List, Image, Lock, Boxes, User, Receipt
} from 'lucide-react';
import { saveCloudBomRow } from '../../../utils/supabaseDataSync';
import { isRailPreset, isKwPreset, calculateTotalDispatchQty } from '../../../utils/vrmProductsData';
import { getMediaFromCache, stripDataUrlsFromRecord, cleanNum } from '../../../utils/otherViewsShared';
import { uploadBomDocumentFile, validateClientFile } from '../../../utils/bomStorageClient';
import TypeableProductSelect from '../../TypeableProductSelect';
import { is5PctSolarProduct } from '../../../utils/hsnCodeService';
import { PRESET_THEMES, getPresetTheme } from '../../../utils/presetThemes';
import VRMBomPrintTemplate from '../../VRMBomPrintTemplate';
import DispatchMediaThumbnail from '../DispatchMediaThumbnail';
import { notifyBomSentToDispatch } from '../../../services/notificationService';
import BomConfirmCeoDetailSection from './BomConfirmCeoDetailSection';

export default function BomConfirmAuditSection({ ctx }) {
  const {
    props,
    userRole,
    safeSaveBomStoreToLocal,
    getBomStageTiming,
    renderDocPreviewModal,
    renderExportFormatModal,
    isConfirmingForward,
    setIsConfirmingForward,
    printingBomRecord,
    setPrintingBomRecord,
    setExportFormatRecord,
    bomStore,
    setBomStore,
    itemsList,
    isCeo,
    confirmingBomModal,
    setConfirmingBomModal,
    setUploadPaymentModal,
    setPreviewDocModal,
    sameAsBilling,
    defaultSalesPersonName,
    presetSetCount,
    presetUnit,
    presetKitPrice,
    presetGroups,
    blockInventoryForBom,
    alert
  } = ctx;

    const isCancelled = Boolean(
      confirmingBomModal.cancelled ||
      confirmingBomModal.status === 'Cancelled' ||
      confirmingBomModal.status === 'Cancelled & Stock Restored' ||
      (typeof confirmingBomModal.status === 'string' && confirmingBomModal.status.toLowerCase().includes('cancel'))
    );
    const isEditMode = Boolean(
      !isCeo &&
      !isCancelled &&
      confirmingBomModal.isEditMode !== false &&
      ['Draft', 'Pending Confirmation', 'Pending Sales Confirmation', 'Edited / Pending Confirmation', 'Cancelled & Reissued to Dispatch', 'ACTIVE', 'Active', 'Pending Verification', 'Pending'].includes(confirmingBomModal.status || 'Pending Sales Confirmation')
    );
    const isAlreadyForwarded = !isEditMode;
    const isSourcePiLocked = false;

    const modalPresetGroups = (Array.isArray(confirmingBomModal.presetGroups) && confirmingBomModal.presetGroups.length > 0)
      ? confirmingBomModal.presetGroups.map(g => ({ ...g }))
      : (confirmingBomModal.presetName || (cleanNum(confirmingBomModal.presetKitPrice) > 0))
        ? [{
            presetName: confirmingBomModal.presetName || 'Pre-Engineered Structure Kit Package',
            setCount: parseFloat(confirmingBomModal.presetSetCount) || 1,
            unit: confirmingBomModal.presetUnit || (String(confirmingBomModal.presetName || '').toLowerCase().includes('kw') ? 'kW' : 'Sets'),
            kitPrice: cleanNum(confirmingBomModal.presetKitPrice) || 0
          }]
        : [];

    let presetKitsTotal = modalPresetGroups.reduce((acc, g) => acc + ((cleanNum(g.kitPrice) || 0) * (parseFloat(g.setCount) || 1)), 0) || (cleanNum(confirmingBomModal.presetKitPrice) || 0);
    const customItemsTotal = (confirmingBomModal.items || []).reduce((acc, it) => acc + ((cleanNum(it.qty) || 0) * (cleanNum(it.rate) || 0)), 0);

    // Fallback: If presetKitsTotal is 0, but the BOM has items with rate 0 and grandTotal > customItemsTotal, compute preset package price
    if (presetKitsTotal === 0 && (confirmingBomModal.items || []).some(it => it.isPresetItem || cleanNum(it.rate || 0) === 0)) {
      const gTotal = cleanNum(confirmingBomModal.grandTotal) || 0;
      const sTotal = cleanNum(confirmingBomModal.subTotal) || (gTotal > 0 ? (gTotal / 1.18) : 0);
      if (sTotal > customItemsTotal) {
        presetKitsTotal = Math.max(0, Math.round((sTotal - customItemsTotal) * 100) / 100);
        if (modalPresetGroups.length === 0) {
          modalPresetGroups.push({
            presetName: confirmingBomModal.presetName || 'Pre-Engineered Structure Kit Package',
            setCount: parseFloat(confirmingBomModal.presetSetCount) || 1,
            unit: confirmingBomModal.presetUnit || (String(confirmingBomModal.presetName || '').toLowerCase().includes('kw') ? 'kW' : 'Sets'),
            kitPrice: presetKitsTotal
          });
        } else if (modalPresetGroups.length === 1 && (cleanNum(modalPresetGroups[0].kitPrice) || 0) === 0) {
          modalPresetGroups[0].kitPrice = presetKitsTotal / (parseFloat(modalPresetGroups[0].setCount) || 1);
        }
      }
    }

    const calculatedSubtotal = Math.round((presetKitsTotal + customItemsTotal) * 100) / 100;
    // Strict Reconciliation: If line items exist, orderSubTotal must strictly match the visible items (calculatedSubtotal).
    // Never allow a ghost subtotal where the table shows ₹2,820 but the footer charges ₹1,06,400!
    const orderSubTotal = calculatedSubtotal > 0 ? calculatedSubtotal : Math.round((cleanNum(confirmingBomModal.subTotal) || 0) * 100) / 100;

    // Detect if the previous stored subtotal had an unexplained mismatch with the actual line items
    const hasSubtotalMismatch = Boolean(confirmingBomModal.subTotal && calculatedSubtotal > 0 && Math.abs(calculatedSubtotal - cleanNum(confirmingBomModal.subTotal)) > 1);

    let orderGrandTotal = 0;
    let orderGstAmount = 0;

    if (hasSubtotalMismatch) {
      // Items were modified or previous PI had ghost unlisted amount -> recompute GST and Grand Total cleanly from actual line items
      orderGstAmount = Math.round(orderSubTotal * 0.18 * 100) / 100;
      orderGrandTotal = Math.round((orderSubTotal + orderGstAmount) * 100) / 100;
    } else {
      const rawGrand = cleanNum(confirmingBomModal.grandTotal);
      orderGrandTotal = rawGrand > 0 ? Math.round(rawGrand * 100) / 100 : Math.round(orderSubTotal * 1.18 * 100) / 100;
      const rawGst = cleanNum(confirmingBomModal.gstAmount);
      orderGstAmount = rawGst > 0 ? Math.round(rawGst * 100) / 100 : Math.max(0, Math.round((orderGrandTotal - orderSubTotal) * 100) / 100);
    }
    const grandTotalCalc = orderGrandTotal;

    let sourcePi = null;
    const piNum = confirmingBomModal.sourcePiNo || confirmingBomModal.piNo;
    if (piNum) {
      try {
        const rawPis = localStorage.getItem('controlroom_sales_pi_store') || localStorage.getItem('controlroom_proforma_invoice_store');
        if (rawPis) {
          const parsedPis = JSON.parse(rawPis);
          if (Array.isArray(parsedPis)) {
            sourcePi = parsedPis.find(p => {
              const pNo = String(p.piNo || p.estimate_number || p.id || '').trim().toLowerCase();
              return pNo === String(piNum).trim().toLowerCase();
            });
          }
        }
      } catch (e) {}
    }

    const rawBObj = (confirmingBomModal.billingAddressObj && typeof confirmingBomModal.billingAddressObj === 'object' && Object.keys(confirmingBomModal.billingAddressObj).length > 0)
      ? confirmingBomModal.billingAddressObj
      : (confirmingBomModal.billingAddress && typeof confirmingBomModal.billingAddress === 'object'
          ? confirmingBomModal.billingAddress
          : (sourcePi?.billingAddressObj && typeof sourcePi.billingAddressObj === 'object' && Object.keys(sourcePi.billingAddressObj).length > 0
              ? sourcePi.billingAddressObj
              : (sourcePi?.billingAddress && typeof sourcePi.billingAddress === 'object' ? sourcePi.billingAddress : {})));

    const rawDObj = (confirmingBomModal.deliveryAddressObj && typeof confirmingBomModal.deliveryAddressObj === 'object' && Object.keys(confirmingBomModal.deliveryAddressObj).length > 0)
      ? confirmingBomModal.deliveryAddressObj
      : (confirmingBomModal.deliveryAddress && typeof confirmingBomModal.deliveryAddress === 'object'
          ? confirmingBomModal.deliveryAddress
          : (sourcePi?.deliveryAddressObj && typeof sourcePi.deliveryAddressObj === 'object' && Object.keys(sourcePi.deliveryAddressObj).length > 0
              ? sourcePi.deliveryAddressObj
              : (sourcePi?.deliveryAddress && typeof sourcePi.deliveryAddress === 'object' ? sourcePi.deliveryAddress : {})));

    const resolvedBStreet = confirmingBomModal.billingStreet || rawBObj.street || rawBObj.address || sourcePi?.billingStreet || (typeof confirmingBomModal.billingAddress === 'string' && !confirmingBomModal.billingAddress.includes('on file') ? confirmingBomModal.billingAddress : '') || (typeof sourcePi?.billingAddress === 'string' ? sourcePi.billingAddress : '') || '';
    const resolvedBCity = confirmingBomModal.billingCity || rawBObj.city || sourcePi?.billingCity || '';
    const resolvedBState = confirmingBomModal.billingState || rawBObj.state || sourcePi?.billingState || '';
    const resolvedBPincode = confirmingBomModal.billingPincode || rawBObj.pincode || rawBObj.pin || sourcePi?.billingPincode || '';

    const bObj = {
      address: resolvedBStreet,
      street: resolvedBStreet,
      city: resolvedBCity,
      state: resolvedBState,
      pincode: resolvedBPincode
    };

    const isSameAddr = confirmingBomModal.sameAsBilling !== false && (!rawDObj.address && !rawDObj.street || (rawDObj.address || rawDObj.street) === (rawBObj.address || rawBObj.street));

    const resolvedDStreet = isSameAddr && resolvedBStreet
      ? resolvedBStreet
      : (confirmingBomModal.deliveryStreet || rawDObj.street || rawDObj.address || sourcePi?.deliveryStreet || (typeof confirmingBomModal.deliveryAddress === 'string' && !confirmingBomModal.deliveryAddress.includes('on file') ? confirmingBomModal.deliveryAddress : '') || resolvedBStreet);
    const resolvedDCity = isSameAddr && resolvedBCity ? resolvedBCity : (confirmingBomModal.deliveryCity || rawDObj.city || sourcePi?.deliveryCity || resolvedBCity);
    const resolvedDState = isSameAddr && resolvedBState ? resolvedBState : (confirmingBomModal.deliveryState || rawDObj.state || sourcePi?.deliveryState || resolvedBState);
    const resolvedDPincode = isSameAddr && resolvedBPincode ? resolvedBPincode : (confirmingBomModal.deliveryPincode || rawDObj.pincode || rawDObj.pin || sourcePi?.deliveryPincode || resolvedBPincode);

    const dObj = {
      address: resolvedDStreet,
      street: resolvedDStreet,
      city: resolvedDCity,
      state: resolvedDState,
      pincode: resolvedDPincode
    };

    const formatAddr = (obj, fallbackStr) => {
      if (!obj) return fallbackStr || '—';
      const { address, street, city, state, pincode } = obj;
      const addrLine = address || street || '';
      const parts = [];
      if (addrLine && addrLine.trim() && addrLine.trim() !== '—') parts.push(addrLine.trim());
      if (city && city.trim() && city.trim() !== '—') parts.push(city.trim());
      if (state && state.trim() && state.trim() !== '—' && pincode && pincode.trim() && pincode.trim() !== '—') {
        parts.push(`${state.trim()} - ${pincode.trim()}`);
      } else {
        if (state && state.trim() && state.trim() !== '—') parts.push(state.trim());
        if (pincode && pincode.trim() && pincode.trim() !== '—') parts.push(pincode.trim());
      }
      return parts.length > 0 ? parts.join(', ') : (fallbackStr || '—');
    };

    const timing = getBomStageTiming(confirmingBomModal);


  const auditVars = {
    isCancelled,
    isEditMode,
    isAlreadyForwarded,
    isSourcePiLocked,
    modalPresetGroups,
    presetKitsTotal,
    customItemsTotal,
    calculatedSubtotal,
    orderSubTotal,
    hasSubtotalMismatch,
    orderGrandTotal,
    orderGstAmount,
    grandTotalCalc,
    sourcePi,
    piNum,
    rawBObj,
    rawDObj,
    resolvedBStreet,
    resolvedBCity,
    resolvedBState,
    resolvedBPincode,
    bObj,
    isSameAddr,
    resolvedDStreet,
    resolvedDCity,
    resolvedDState,
    resolvedDPincode,
    dObj,
    formatAddr,
    timing
  };

  if (isCeo) {
    return <BomConfirmCeoDetailSection ctx={ctx} auditVars={auditVars} />;
  }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', fontFamily: "'DM Sans', sans-serif", backgroundColor: '#F8FAFC', padding: '24px', borderRadius: '16px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                {isCancelled
                  ? `BOM Order (Cancelled) — ${confirmingBomModal.bomCode}`
                  : (isAlreadyForwarded ? `BOM Details & Order Summary — ${confirmingBomModal.bomCode}` : `BOM Verification & Order Editing — ${confirmingBomModal.bomCode}`)}
              </h1>
              {isCancelled && (
                <span style={{
                  backgroundColor: '#FEE2E2', color: '#DC2626',
                  fontSize: '11px', fontWeight: '800', padding: '3px 10px',
                  borderRadius: '12px', border: '1px solid #FECACA'
                }}>
                  CANCELLED • VIEW ONLY
                </span>
              )}
              {(confirmingBomModal.isEdited || (Array.isArray(confirmingBomModal.editHistory) && confirmingBomModal.editHistory.length > 0)) && (
                <span style={{
                  backgroundColor: '#FEF3C7', color: '#B45309',
                  fontSize: '11px', fontWeight: '800', padding: '3px 10px',
                  borderRadius: '12px', border: '1px solid #FDE68A',
                  display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}>
                  Edited{confirmingBomModal.lastEditedBy ? ` • ${confirmingBomModal.lastEditedBy}` : ''}{confirmingBomModal.lastEditedAt ? ` (${new Date(confirmingBomModal.lastEditedAt).toLocaleString('en-IN')})` : ''}
                </span>
              )}
              {isCeo && (
                <span style={{
                  backgroundColor: '#ECFEFF', color: '#0E7490',
                  fontSize: '11px', fontWeight: '800', padding: '3px 10px',
                  borderRadius: '12px', border: '1px solid #A5F3FC',
                  display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}>
                  EXECUTIVE VIEW ONLY
                </span>
              )}
            </div>
            <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', display: 'block' }}>
              {isCancelled
                ? 'This BOM was cancelled and reserved stock was released back into inventory.'
                : (isAlreadyForwarded
                  ? 'Review verified bill of materials, product breakdown, and order specifications.'
                  : 'Review & modify company details, billing/delivery addresses, payment terms, or product specifications before final dispatch.')}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>

            {isAlreadyForwarded && !isCeo && ['Partial Paid', 'Partial Payment', 'Payment While Dispatch', 'Credit Payment'].includes(confirmingBomModal.paymentType) && (
              <button
                type="button"
                onClick={() => {
                  const target = confirmingBomModal;
                  setConfirmingBomModal(null);
                  setUploadPaymentModal(target);
                }}
                style={{
                  border: 'none',
                  backgroundColor: '#0E7490',
                  color: 'white',
                  height: '40px',
                  padding: '0 18px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(14,116,144,0.3)'
                }}
              >
                <CreditCard style={{ width: '15px', height: '15px' }} /> Update Payment Details
              </button>
            )}

            {!isAlreadyForwarded && (
              <button
                onClick={() => {
                  const isDeliveryMatching = Boolean(confirmingBomModal.sameAsBilling) || (
                    ((dObj.address || '').trim() === (bObj.address || '').trim()) &&
                    ((dObj.city || '').trim() === (bObj.city || '').trim()) &&
                    ((dObj.state || '').trim() === (bObj.state || '').trim()) &&
                    ((dObj.pincode || '').trim() === (bObj.pincode || '').trim())
                  );



                  const currentItemsList = confirmingBomModal.items || [];
                  const unconfirmedItems = currentItemsList.filter(it => !it.confirmed);
                  if (unconfirmedItems.length > 0) {
                    alert(`⚠️ Please confirm all products first!\n\n${unconfirmedItems.length} product(s) still need to be verified with the tick mark (✓) or click "Confirm All Products" below before sending BOM to Dispatch.`);
                    return;
                  }

                  const isDcOrder = Boolean(
                    confirmingBomModal.docType === 'DC' ||
                    confirmingBomModal.docType === 'Delivery Challan' ||
                    confirmingBomModal.documentType === 'DC' ||
                    confirmingBomModal.invoiceType === 'DC' ||
                    String(confirmingBomModal.docType || '').toUpperCase().includes('DC') ||
                    String(confirmingBomModal.docType || '').toUpperCase().includes('CHALLAN') ||
                    String(confirmingBomModal.documentType || '').toUpperCase().includes('DC') ||
                    String(confirmingBomModal.documentType || '').toUpperCase().includes('CHALLAN')
                  );

                  const currentPayType = confirmingBomModal.paymentType;
                  const is100OrPartial = currentPayType === '100% Paid' || currentPayType === '100% Advance' || currentPayType === 'Partial Paid' || currentPayType === 'Partial Payment';
                  const hasProof = Boolean(
                    confirmingBomModal.paymentProofDoc ||
                    confirmingBomModal.payments?.proofDocObj ||
                    confirmingBomModal.payments?.proofDoc ||
                    confirmingBomModal.proofDoc ||
                    confirmingBomModal.proofDocData
                  );
                  if (!isDcOrder && is100OrPartial && !hasProof) {
                    alert(`⚠️ Payment Attachment / Slip is strictly mandatory for "${currentPayType}"!\n\nPlease attach the bank slip/advice before sending this BOM to Dispatch.`);
                    return;
                  }

                  setIsConfirmingForward(true);
                  try {
                    const bStr = formatAddr(bObj, confirmingBomModal.billingAddress);
                    const dStr = confirmingBomModal.sameAsBilling ? bStr : formatAddr(dObj, confirmingBomModal.deliveryAddress);
                    const finalDObj = confirmingBomModal.sameAsBilling ? { ...bObj } : { ...dObj };

                    const finalizedItems = currentItemsList.map(i => ({ ...i, confirmed: true }));
                  const packingItems = (confirmingBomModal.dispatchPacking && confirmingBomModal.dispatchPacking.length > 0)
                    ? confirmingBomModal.dispatchPacking
                    : finalizedItems.map(it => ({
                      name: it.name || it.c2 || 'Item',
                      bomQty: it.qty || 1,
                      packed: false
                    }));

                  // Ensure inventory is blocked upon verification if not already blocked
                  if (!confirmingBomModal.stockBlocked && !confirmingBomModal.stockDeducted) {
                    blockInventoryForBom(finalizedItems, confirmingBomModal.bomCode);
                  }

                  const prevBomRec = (bomStore || []).find(b => b && (b.bomCode === confirmingBomModal.bomCode || b.id === confirmingBomModal.id || b.code === confirmingBomModal.code));
                  const nextEditedFields = { ...(prevBomRec?.editedFields || confirmingBomModal.editedFields || {}) };
                  const normVal = (v) => String(v == null ? '' : v).trim();
                  if (prevBomRec) {
                    if (normVal(prevBomRec.companyName) !== normVal(confirmingBomModal.companyName)) {
                      nextEditedFields.companyName = `${normVal(prevBomRec.companyName) || '—'} → ${normVal(confirmingBomModal.companyName) || '—'}`;
                    }
                    if (normVal(prevBomRec.paymentType) !== normVal(confirmingBomModal.paymentType)) {
                      nextEditedFields.paymentType = `${normVal(prevBomRec.paymentType) || '—'} → ${normVal(confirmingBomModal.paymentType) || '—'}`;
                    }
                    if (normVal(prevBomRec.billingAddress) !== normVal(bStr)) {
                      nextEditedFields.billingAddress = 'Updated during BOM confirmation';
                    }
                    if (normVal(prevBomRec.deliveryAddress) !== normVal(dStr)) {
                      nextEditedFields.deliveryAddress = 'Updated during BOM confirmation';
                    }
                  }
                  const prevItemsMap = new Map();
                  (Array.isArray(prevBomRec?.items) ? prevBomRec.items : []).forEach((it) => {
                    const k = normVal(it?.name || it?.code).toLowerCase();
                    if (k) prevItemsMap.set(k, it);
                  });
                  let anyItemEdited = false;
                  const diffedItems = finalizedItems.map((it) => {
                    const k = normVal(it?.name || it?.code).toLowerCase();
                    const prevIt = k ? prevItemsMap.get(k) : null;
                    const diffs = [];
                    if (prevBomRec) {
                      if (!prevIt) {
                        diffs.push('Added during BOM confirmation');
                      } else {
                        if (Number(prevIt.qty || 0) !== Number(it.qty || 0)) {
                          diffs.push(`Qty: ${prevIt.qty || 0} → ${it.qty || 0}`);
                        }
                        if (Number(prevIt.rate || 0) !== Number(it.rate || 0)) {
                          diffs.push(`Rate: ₹${Number(prevIt.rate || 0).toLocaleString('en-IN')} → ₹${Number(it.rate || 0).toLocaleString('en-IN')}`);
                        }
                        if (normVal(prevIt.uom || prevIt.unit) !== normVal(it.uom || it.unit)) {
                          diffs.push(`UOM: ${normVal(prevIt.uom || prevIt.unit)} → ${normVal(it.uom || it.unit)}`);
                        }
                      }
                    }
                    const itemEdited = Boolean(it.isEdited || diffs.length > 0);
                    if (itemEdited) anyItemEdited = true;
                    const mergedNote = [it.editedNote, ...diffs].filter(Boolean).join(' • ');
                    return itemEdited ? { ...it, isEdited: true, ...(mergedNote ? { editedNote: mergedNote } : {}) } : it;
                  });
                  const hasAnyEdit = Boolean(confirmingBomModal.isEdited || prevBomRec?.isEdited || Object.keys(nextEditedFields).length > 0 || anyItemEdited);
                  const todayIso = new Date().toISOString().split('T')[0];

                  const updatedBomData = {
                    ...confirmingBomModal,
                    ...(hasAnyEdit ? { date: todayIso, bomDate: todayIso } : {}),
                    companyName: confirmingBomModal.companyName,
                    docType: confirmingBomModal.docType || (isDcOrder ? 'DC' : 'Invoice'),
                    paymentType: confirmingBomModal.paymentType,
                    billingAddress: bStr,
                    billingAddressObj: bObj,
                    deliveryAddress: dStr,
                    deliveryAddressObj: finalDObj,
                    deliveryAddressProofDoc: confirmingBomModal.sameAsBilling ? null : (confirmingBomModal.deliveryAddressProofDoc || null),
                    items: diffedItems,
                    ...(hasAnyEdit ? {
                      isEdited: true,
                      editedFields: nextEditedFields,
                      lastEditedAt: confirmingBomModal.lastEditedAt || new Date().toISOString(),
                      lastEditedBy: confirmingBomModal.lastEditedBy || defaultSalesPersonName
                    } : {}),
                    dispatchPacking: packingItems,
                    salesPerson: (confirmingBomModal.salesPerson || confirmingBomModal.createdBy || 'Sales Department').replace(/\s*\([^)]*\)/g, '').trim(),
                    status: 'Sales Confirmed - Sent to Dispatch',
                    salesConfirmed: true,
                    salesReconfirmed: true,
                    tabGroup: 'Sent',
                    stBg: '#dcfce7',
                    stFg: '#166534',
                    stBorder: '1px solid #bbf7d0',
                    salesConfirmedAt: new Date().toISOString(),
                    reconfirmedAt: new Date().toISOString(),
                    isSentToDispatch: true,
                    stockBlocked: true,
                    stockBlockedAt: confirmingBomModal.stockBlockedAt || new Date().toISOString(),
                    stockDeducted: true,
                    addressProofReuploadRequested: false,
                    subTotal: orderSubTotal,
                    gstAmount: orderGstAmount,
                    grandTotal: orderGrandTotal
                  };

                  const updatedList = (bomStore || []).map(b => ((b.bomCode && (b.bomCode === confirmingBomModal.bomCode || b.bomCode === confirmingBomModal.id || b.bomCode === confirmingBomModal.code)) || (b.id && (b.id === confirmingBomModal.id || b.id === confirmingBomModal.bomCode)) || (b.code && (b.code === confirmingBomModal.code || b.code === confirmingBomModal.bomCode))) ? {
                    ...b,
                    ...updatedBomData
                  } : b);
                  setBomStore(updatedList);
                  safeSaveBomStoreToLocal(updatedList);

                  // Push to Supabase and server immediately so Dispatch sees it in real time
                  saveCloudBomRow(updatedBomData);
                  try {
                    const sesId = typeof window !== 'undefined' && window.localStorage
                      ? (localStorage.getItem('controlroom_device_session_id') || localStorage.getItem('businz_device_session_id'))
                      : null;
                    const curRole = typeof window !== 'undefined' && window.localStorage
                      ? (localStorage.getItem('controlroom_user_role') || userRole || 'Sales')
                      : (userRole || 'Sales');
                    const curEmp = typeof window !== 'undefined' && window.localStorage
                      ? (localStorage.getItem('controlroom_logged_emp_id') || 'SE-001')
                      : 'SE-001';

                    fetch('/api/boms', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(sesId ? { 'x-session-id': sesId } : {}),
                        'x-user-role': curRole,
                        'x-employee-code': curEmp
                      },
                      body: JSON.stringify({ bom: stripDataUrlsFromRecord(updatedBomData), isUpdate: true })
                    }).then(res => {
                      if (!res.ok) {
                        console.warn('[BomOrdersView] POST /api/boms response not OK:', res.status);
                      }
                    }).catch(err => console.error('Error updating BOM to Dispatch:', err));
                  } catch (_) {}

                  try {
                    window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: { bom: updatedBomData } }));
                    window.dispatchEvent(new Event('controlroom_storage_update'));
                  } catch (_) {}

                  // Trigger Real-time Workflow Notification with synthesized sound & deep-link to Dispatch Orders
                  try {
                    if (typeof notifyBomSentToDispatch === 'function') {
                      notifyBomSentToDispatch({
                        bomCode: confirmingBomModal.bomCode,
                        customerName: confirmingBomModal.companyName || confirmingBomModal.customerName,
                        salesPerson: confirmingBomModal.salesPerson
                      });
                    }
                  } catch (nErr) {
                    console.warn('notifyBomSentToDispatch non-fatal:', nErr);
                  }

                  setConfirmingBomModal(null);
                  alert(`BOM (${confirmingBomModal.bomCode}) successfully verified by Sales and forwarded to Dispatch!`);
                } finally {
                  setIsConfirmingForward(false);
                }
              }}
              disabled={isConfirmingForward}
              style={{
                border: 'none',
                backgroundColor: '#0E7490',
                color: 'white',
                height: '40px',
                padding: '0 24px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '800',
                cursor: isConfirmingForward ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(14,116,144,0.3)',
                opacity: isConfirmingForward ? 0.7 : 1
              }}
            >
              {isConfirmingForward ? (
                <>
                  <RotateCcw style={{ width: '16px', height: '16px', animation: 'spin 0.75s linear infinite' }} />
                  Forwarding to Dispatch...
                </>
              ) : (
                <>
                  <CheckCircle style={{ width: '16px', height: '16px' }} />
                  Confirm BOM & Send to Dispatch
                </>
              )}
            </button>
            )}
          </div>
        </div>

        {/* CANCELLATION ALERT BANNER */}
        {isCancelled && (
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1.5px solid #FCA5A5',
            borderRadius: '14px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.08)'
          }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              backgroundColor: '#DC2626', color: '#FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <XCircle style={{ width: '22px', height: '22px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '15px', fontWeight: '900', color: '#991B1B' }}>
                  This BOM was Cancelled
                </span>
                <span style={{
                  backgroundColor: '#FFFFFF', color: '#DC2626',
                  fontSize: '11px', fontWeight: '800', padding: '2px 8px',
                  borderRadius: '6px', border: '1px solid #FECACA'
                }}>
                  Non-Editable • Stock Restored
                </span>
              </div>
              <div style={{ marginTop: '6px', fontSize: '13px', color: '#7F1D1D', lineHeight: 1.5 }}>
                <strong>Reason:</strong> {confirmingBomModal.cancellationReason || 'Order cancelled by Dispatch'}
              </div>
              <div style={{ marginTop: '8px', display: 'flex', gap: '16px', fontSize: '11px', color: '#991B1B', flexWrap: 'wrap', alignItems: 'center' }}>
                <span>
                  <strong>Cancelled By:</strong>{' '}
                  <strong style={{ color: '#7F1D1D' }}>
                    {confirmingBomModal.cancelledBy || 'Authorized Personnel'}
                  </strong>
                  {(confirmingBomModal.cancelledByRole || confirmingBomModal.cancelledByTeam) && (
                    <span style={{
                      marginLeft: '6px',
                      backgroundColor: '#FFFFFF',
                      color: '#991B1B',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: '1px solid #FECACA',
                      fontWeight: '800'
                    }}>
                      {confirmingBomModal.cancelledByRole || ''}
                      {confirmingBomModal.cancelledByRole && confirmingBomModal.cancelledByTeam ? ` • ${confirmingBomModal.cancelledByTeam}` : (confirmingBomModal.cancelledByTeam || '')}
                    </span>
                  )}
                </span>
                <span>•</span>
                <span><strong>Cancelled At:</strong> {confirmingBomModal.cancelledAt ? new Date(confirmingBomModal.cancelledAt).toLocaleString('en-IN') : 'Recently'}</span>
                <span>•</span>
                <span><strong>Sales Person Notified:</strong> {(confirmingBomModal.salesPerson || 'Sales Executive').replace(/\s*\([^)]*\)/g, '').trim()}</span>
              </div>
            </div>
          </div>
        )}

        {/* ORDER DETAILS & ADDRESSES */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {isAlreadyForwarded ? 'BILL OF MATERIALS SUMMARY' : 'ORDER DETAILS & ADDRESSES'}
            </span>
            <span style={{
              backgroundColor: isAlreadyForwarded ? '#DCFCE7' : '#FEF3C7',
              color: isAlreadyForwarded ? '#166534' : '#B45309',
              padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', display: 'inline-block'
            }}>
              {confirmingBomModal.status}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div>
              <label htmlFor="bom-orders-customer-name" style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '6px' }}>
                CUSTOMER NAME
              </label>
              <input id="bom-orders-customer-name" name="cUSTOMERNAME" aria-label="CUSTOMER NAME"
                type="text"
                value={confirmingBomModal.customerName}
                readOnly
                style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', fontWeight: '700', color: '#475569', backgroundColor: '#F8FAFC', outline: 'none', cursor: 'not-allowed', boxSizing: 'border-box' }}
               />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                COMPANY NAME {!isAlreadyForwarded && <span style={{ color: '#2563EB', fontSize: '10px' }}>(Editable)</span>}
                {confirmingBomModal.editedFields?.companyName && (
                  <span title={confirmingBomModal.editedFields.companyName} style={{ backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: '800' }}>Edited</span>
                )}
              </label>
              {isAlreadyForwarded ? (
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', height: '40px', display: 'flex', alignItems: 'center' }}>
                  {confirmingBomModal.companyName || confirmingBomModal.customerName || '—'}
                </div>
              ) : (
                <input id="bom-orders-company-name" name="companyName" aria-label="Company Name"
                  type="text"
                  placeholder="Company Name..."
                  value={confirmingBomModal.companyName || ''}
                  onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, companyName: e.target.value })}
                  style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
                 />
              )}
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                PAYMENT TYPE {(!isAlreadyForwarded || confirmingBomModal.isEditMode) && <span style={{ color: '#2563EB', fontSize: '10px' }}>(Editable)</span>}
                {confirmingBomModal.editedFields?.paymentType && (
                  <span title={confirmingBomModal.editedFields.paymentType} style={{ backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: '800' }}>Edited</span>
                )}
              </label>
              {isAlreadyForwarded && !confirmingBomModal.isEditMode ? (
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#2563EB', height: '40px', display: 'flex', alignItems: 'center' }}>
                  {confirmingBomModal.paymentType || '100% Paid'}
                </div>
              ) : (
                <select id="bom-orders-payment-type-50-advance" name="paymentType50Advance" aria-label="PaymentType 50 Advance"
                  value={confirmingBomModal.paymentType || '50% Advance + 50% Dispatch'}
                  onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, paymentType: e.target.value })}
                  style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', fontWeight: '700', color: '#2563EB', backgroundColor: '#FFFFFF', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
                >
                  <option value="100% Paid">100% Paid</option>
                  <option value="Partial Paid">Partial Paid</option>
                  <option value="Payment While Dispatch">Payment While Dispatch</option>
                  <option value="Credit Payment">Credit Payment</option>
                </select>
              )}
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#0E7490', display: 'block', marginBottom: '6px' }}>
                SALES PERSON / CREATOR
              </label>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#0E7490', height: '40px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#F0FDFA', padding: '0 12px', borderRadius: '8px', border: '1px solid #CCFBF1' }}>
                <User size={14} style={{ color: '#0E7490', flexShrink: 0 }} /> {(confirmingBomModal.salesPerson || confirmingBomModal.createdBy || defaultSalesPersonName).replace(/\s*\([^)]*\)/g, '').trim()}
              </div>
            </div>
          </div>

          {/* Contact Details & GSTIN */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', backgroundColor: '#F8FAFC', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
            <div>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>CONTACT PERSON</span>
              <strong style={{ fontSize: '12.5px', color: '#0F172A', fontWeight: '700' }}>{confirmingBomModal.contactPerson || '—'}</strong>
            </div>
            <div>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>PHONE</span>
              <strong style={{ fontSize: '12.5px', color: '#0F172A', fontWeight: '700' }}>{confirmingBomModal.mobile || confirmingBomModal.phone || '—'}</strong>
            </div>
            <div>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>EMAIL</span>
              <strong style={{ fontSize: '12.5px', color: '#0F172A', fontWeight: '700', wordBreak: 'break-all' }}>{confirmingBomModal.email || '—'}</strong>
            </div>
            <div>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>GSTIN</span>
              <strong style={{ fontSize: '12.5px', color: '#0E7490', fontWeight: '800' }}>{confirmingBomModal.gstNo || confirmingBomModal.gstin || '—'}</strong>
            </div>
          </div>

          {(confirmingBomModal.paymentType === 'Partial Paid' || confirmingBomModal.paymentType === 'Partial Payment') && (
            <div style={{ backgroundColor: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <label htmlFor="bom-orders-partial-amount" style={{ fontSize: '12px', fontWeight: '800', color: '#0F766E', whiteSpace: 'nowrap' }}>
                  Advance Amount (₹):
                </label>
                {confirmingBomModal.isEditMode ? (
                  <input id="bom-orders-partial-amount" name="partialAmount" aria-label="Advance Amount (₹)
                
                {confirmingBomModal.isEditMode ? ("
                    type="number"
                    min="0"
                    step="any"
                    value={confirmingBomModal.partialAmount != null ? confirmingBomModal.partialAmount : ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      const gTot = Number(confirmingBomModal.grandTotal || confirmingBomModal.subTotal || 0);
                      setConfirmingBomModal({
                        ...confirmingBomModal,
                        partialAmount: val,
                        balanceAmount: Math.max(0, gTot - val)
                      });
                    }}
                    style={{ height: '36px', width: '160px', borderRadius: '6px', border: '1px solid #5EEAD4', padding: '0 10px', fontSize: '13px', fontWeight: '700', color: '#0F172A', outline: 'none' }}
                   />
                ) : (
                  <strong style={{ fontSize: '13px', color: '#0F766E' }}>
                    ₹{Number(confirmingBomModal.partialAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#115E59' }}>
                <span>Balance Due:</span>
                <strong style={{ fontSize: '13px', color: '#0F766E' }}>
                  ₹{Number(confirmingBomModal.balanceAmount != null ? confirmingBomModal.balanceAmount : Math.max(0, (confirmingBomModal.grandTotal || 0) - (confirmingBomModal.partialAmount || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>
          )}

          {/* Structured Address Cards */}
          {(() => {
            const bStreet = bObj.address || bObj.street || (typeof confirmingBomModal.billingAddress === 'string' ? confirmingBomModal.billingAddress : '') || '—';
            const bCity = bObj.city || '—';
            const bState = bObj.state || '—';
            const bPin = bObj.pincode || '—';

            const dStreet = dObj.address || dObj.street || (typeof confirmingBomModal.deliveryAddress === 'string' ? confirmingBomModal.deliveryAddress : '') || bStreet;
            const dCity = dObj.city || bCity;
            const dState = dObj.state || bState;
            const dPin = dObj.pincode || bPin;

            const isDeliveryMatching = Boolean(confirmingBomModal.sameAsBilling) || (
              ((dObj.address || '').trim() === (bObj.address || '').trim()) &&
              ((dObj.city || '').trim() === (bObj.city || '').trim()) &&
              ((dObj.state || '').trim() === (bObj.state || '').trim()) &&
              ((dObj.pincode || '').trim() === (bObj.pincode || '').trim())
            );

            if (isAlreadyForwarded) {
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '4px' }}>
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

                  <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '800', color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px' }}>
                      <Truck style={{ width: '13px', height: '13px', color: '#0E7490' }} /> Delivery Address
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => setPreviewDocModal({ title: 'Delivery Address Proof Document', doc: confirmingBomModal.deliveryAddressProofDoc })}
                              style={{ border: '1px solid #BBF7D0', background: '#FFFFFF', color: '#166534', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye style={{ width: '12px', height: '12px' }} /> View Image
                            </button>
                            <span style={{ fontSize: '10px', color: '#15803D', fontWeight: '800' }}>Verified</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '4px' }}>
                {/* Editable Billing */}
                <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                    <label htmlFor="bom-orders-address" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Address</label>
                    <input id="bom-orders-address" name="address" aria-label="Address"
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
                      <label htmlFor="bom-orders-city" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                      <input id="bom-orders-city" name="city" aria-label="City" type="text" placeholder="City..." value={bObj.city || ''} onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, billingAddressObj: { ...bObj, city: e.target.value } })} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}  />
                    </div>
                    <div>
                      <label htmlFor="bom-orders-state" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                      <input id="bom-orders-state" name="state" aria-label="State" type="text" placeholder="State..." value={bObj.state || ''} onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, billingAddressObj: { ...bObj, state: e.target.value } })} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}  />
                    </div>
                    <div>
                      <label htmlFor="bom-orders-pincode" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pincode</label>
                      <input id="bom-orders-pincode" name="pincode" aria-label="Pincode" type="text" placeholder="Pincode..." value={bObj.pincode || ''} onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, billingAddressObj: { ...bObj, pincode: e.target.value } })} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}  />
                    </div>
                  </div>
                </div>

                {/* Editable Delivery */}
                <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#ECFEFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0E7490' }}>
                        <Truck style={{ width: '14px', height: '14px' }} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Delivery Address</h4>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>Destination for physical dispatch</span>
                      </div>
                    </div>
                    <label htmlFor="bom-orders-same-as-billing" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#0E7490', cursor: 'pointer', backgroundColor: '#ECFEFF', padding: '4px 10px', borderRadius: '8px', border: '1px solid #A5F3FC' }}>
                      <input id="bom-orders-same-as-billing" name="sameAsBilling" aria-label="SameAsBilling"
                        type="checkbox"
                        checked={Boolean(confirmingBomModal.sameAsBilling)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setConfirmingBomModal({
                            ...confirmingBomModal,
                            sameAsBilling: checked,
                            deliveryAddressObj: checked ? { ...bObj } : dObj
                          });
                        }}
                        style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                       />
                      Same as Billing
                    </label>
                  </div>

                  <div>
                    <label htmlFor="bom-orders-address" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Address</label>
                    <input id="bom-orders-address" name="address" aria-label="Address"
                      type="text"
                      placeholder="e.g. Plot No 42, SIDCO Industrial Estate"
                      value={confirmingBomModal.sameAsBilling ? (bObj.address || '') : (dObj.address || '')}
                      disabled={confirmingBomModal.sameAsBilling}
                      onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, deliveryAddressObj: { ...dObj, address: e.target.value } })}
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: confirmingBomModal.sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: confirmingBomModal.sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none', cursor: confirmingBomModal.sameAsBilling ? 'not-allowed' : 'text' }}
                     />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label htmlFor="bom-orders-city" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                      <input id="bom-orders-city" name="city" aria-label="City" type="text" placeholder="e.g. Chennai" value={confirmingBomModal.sameAsBilling ? (bObj.city || '') : (dObj.city || '')} disabled={confirmingBomModal.sameAsBilling} onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, deliveryAddressObj: { ...dObj, city: e.target.value } })} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: confirmingBomModal.sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: confirmingBomModal.sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}  />
                    </div>
                    <div>
                      <label htmlFor="bom-orders-state" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                      <input id="bom-orders-state" name="state" aria-label="State" type="text" placeholder="e.g. Tamil Nadu" value={confirmingBomModal.sameAsBilling ? (bObj.state || '') : (dObj.state || '')} disabled={confirmingBomModal.sameAsBilling} onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, deliveryAddressObj: { ...dObj, state: e.target.value } })} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: confirmingBomModal.sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: confirmingBomModal.sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}  />
                    </div>
                    <div>
                      <label htmlFor="bom-orders-pincode" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pincode</label>
                      <input id="bom-orders-pincode" name="pincode" aria-label="Pincode" type="text" placeholder="e.g. 600058" value={confirmingBomModal.sameAsBilling ? (bObj.pincode || '') : (dObj.pincode || '')} disabled={confirmingBomModal.sameAsBilling} onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, deliveryAddressObj: { ...dObj, pincode: e.target.value } })} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: confirmingBomModal.sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: confirmingBomModal.sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}  />
                    </div>
                  </div>

                  {!isDeliveryMatching ? (
                    <div style={{ marginTop: '6px', padding: '14px 16px', backgroundColor: '#FEF2F2', border: '1px dashed #F87171', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <AlertCircle style={{ width: '14px', height: '14px' }} />
                          </div>
                          <div>
                            <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>
                              Delivery Address Proof Document <span style={{ color: '#64748B', fontWeight: '600' }}>(Optional)</span>
                            </h5>
                            <span style={{ fontSize: '11px', color: '#64748B' }}>Upload proof (GST / Electricity Bill / Lease Agreement) if available.</span>
                          </div>
                        </div>
                        {confirmingBomModal.deliveryAddressProofDoc && (
                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle style={{ width: '12px', height: '12px' }} /> Attached
                          </span>
                        )}
                        {confirmingBomModal.addressProofReuploadRequested && (() => {
                          const reqAt = confirmingBomModal.addressProofReuploadRequestedAt || confirmingBomModal.reuploadRequestedAt || confirmingBomModal.reissueRequestedAt;
                          let mLeft = null;
                          if (reqAt) {
                            const ONE_HOUR_MS = 60 * 60 * 1000;
                            mLeft = Math.max(0, Math.ceil((ONE_HOUR_MS - (Date.now() - new Date(reqAt).getTime())) / 60000));
                          }
                          return (
                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#991B1B', backgroundColor: '#FEE2E2', padding: '3px 8px', borderRadius: '12px', border: '1px solid #FCA5A5', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              ⏱️ 1-Hr SLA: {mLeft !== null ? `${mLeft}m remaining` : 'Active'}
                            </span>
                          );
                        })()}
                      </div>

                      {confirmingBomModal.deliveryAddressProofDoc && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: '10px 14px', borderRadius: '8px', border: '1px solid #FECACA' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <FileText style={{ width: '16px', height: '16px', color: '#DC2626' }} />
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>{confirmingBomModal.deliveryAddressProofDoc.name}</div>
                                <div style={{ fontSize: '10px', color: '#64748B' }}>{confirmingBomModal.deliveryAddressProofDoc.size || '1.2 MB'} • Current Version</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => setPreviewDocModal({ title: 'Delivery Address Proof Document', doc: confirmingBomModal.deliveryAddressProofDoc })}
                                style={{ border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Eye style={{ width: '13px', height: '13px' }} /> View Image
                              </button>
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', color: '#2563EB', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                                <Upload style={{ width: '11px', height: '11px' }} /> Upload New Version
                                <input id="bom-orders-input-3" name="input3" aria-label="Input 3"
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                  style={{ display: 'none' }}
                                  onChange={async (e) => {
                                    const file = e.target.files && e.target.files[0];
                                    if (file) {
                                      try {
                                        validateClientFile(file);
                                        const bCode = confirmingBomModal.bomCode || confirmingBomModal.code || confirmingBomModal.id;
                                        const metadata = await uploadBomDocumentFile({
                                          file,
                                          bomCode: bCode,
                                          category: 'delivery-proof'
                                        });
                                        const prevDoc = confirmingBomModal.deliveryAddressProofDoc || {};
                                        const existingHistory = Array.isArray(prevDoc.history) ? prevDoc.history : [];
                                        const updatedHistory = [...existingHistory, {
                                          name: prevDoc.name || prevDoc.originalName,
                                          size: prevDoc.size,
                                          storageBucket: prevDoc.storageBucket,
                                          storagePath: prevDoc.storagePath,
                                          uploadedAt: prevDoc.uploadedAt || new Date().toISOString()
                                        }];
                                        setConfirmingBomModal(prev => ({
                                          ...prev,
                                          addressProofReuploadRequested: false,
                                          deliveryAddressProofDoc: {
                                            ...metadata,
                                            uploadedAt: new Date().toISOString(),
                                            history: updatedHistory
                                          }
                                        }));
                                      } catch (err) {
                                        e.target.value = '';
                                        alert(`⚠️ Cannot Proceed: ${err.message}`);
                                      }
                                    }
                                  }}
                                 />
                              </label>
                            </div>
                          </div>

                          {/* Render Previous Preserved Versions If Any */}
                          {confirmingBomModal.deliveryAddressProofDoc.history && confirmingBomModal.deliveryAddressProofDoc.history.length > 0 && (
                            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>
                                📁 Previous Address Proof Uploads Preserved ({confirmingBomModal.deliveryAddressProofDoc.history.length}):
                              </span>
                              {confirmingBomModal.deliveryAddressProofDoc.history.map((histItem, hIdx) => (
                                <div key={hIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#475569' }}>
                                  <span>• {histItem.name} ({histItem.size || 'Saved'})</span>
                                  <span style={{ fontSize: '10px', color: '#94A3B8' }}>{new Date(histItem.uploadedAt || Date.now()).toLocaleDateString('en-IN')}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {!confirmingBomModal.deliveryAddressProofDoc && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', border: '1px solid #DC2626', color: '#DC2626', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                            <Upload style={{ width: '13px', height: '13px' }} />
                            Upload Address Proof Document
                            <input id="bom-orders-input-4" name="input4" aria-label="Input 4"
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                              style={{ display: 'none' }}
                              onChange={async (e) => {
                                const file = e.target.files && e.target.files[0];
                                if (file) {
                                  try {
                                    validateClientFile(file);
                                    const bCode = confirmingBomModal.bomCode || confirmingBomModal.code || confirmingBomModal.id;
                                    const metadata = await uploadBomDocumentFile({
                                      file,
                                      bomCode: bCode,
                                      category: 'delivery-proof'
                                    });
                                    setConfirmingBomModal(prev => ({
                                      ...prev,
                                      addressProofReuploadRequested: false,
                                      deliveryAddressProofDoc: {
                                        ...metadata,
                                        uploadedAt: new Date().toISOString(),
                                        history: []
                                      }
                                    }));
                                  } catch (err) {
                                    e.target.value = '';
                                    alert(`⚠️ Cannot Proceed: ${err.message}`);
                                  }
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
                      return (
                        <DispatchMediaThumbnail
                          key={ph.id || pIdx}
                          photo={ph}
                          bomCode={confirmingBomModal?.bomCode || confirmingBomModal?.code}
                          label="View Photo"
                          onClick={(resolvedUrl) => {
                            setPreviewDocModal({
                              title: ph.name || `Packed Item Photo ${pIdx + 1}`,
                              bomCode: confirmingBomModal?.bomCode || confirmingBomModal?.code,
                              doc: {
                                ...ph,
                                name: ph.name || `Photo ${pIdx + 1}`,
                                dataUrl: resolvedUrl,
                                url: resolvedUrl,
                                storageBucket: ph.storageBucket || 'bom-documents',
                                storagePath: ph.storagePath
                              }
                            });
                          }}
                        />
                      );
                    })}
                    {packVideos.map((vd, vIdx) => {
                      const videoUrl = (vd.url && !vd.url.startsWith('blob:'))
                        ? vd.url
                        : ((vd.dataUrl && !vd.dataUrl.startsWith('blob:')) ? vd.dataUrl : (getMediaFromCache(vd.name) || getMediaFromCache(vd.id) || (vd.name ? `/api/uploads/${vd.name}` : '')));
                      return (
                        <div
                          key={vIdx}
                          onClick={() => setPreviewDocModal({ title: vd.name || `Packed Item Video ${vIdx + 1}`, doc: { ...vd, name: vd.name || `Video ${vIdx + 1}`, dataUrl: videoUrl, url: vd.url || videoUrl } })}
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

          {/* VEHICLE LOADING, LR COPY & FINAL DISPATCH PROOF FOR SALES */}
          {(() => {
            const vLoading = confirmingBomModal.vehicleLoading || {};
            const finalPhotos = (Array.isArray(vLoading.photos) && vLoading.photos.length > 0)
              ? vLoading.photos
              : (Array.isArray(confirmingBomModal.loadingPhotos) && confirmingBomModal.loadingPhotos.length > 0)
                ? confirmingBomModal.loadingPhotos
                : (Array.isArray(confirmingBomModal.photos) && confirmingBomModal.photos.length > 0)
                  ? confirmingBomModal.photos : [];
            const lrDoc = confirmingBomModal.lrCopyDoc || vLoading.lrCopyDoc || null;
            const vehicleNo = confirmingBomModal.vehicleNo || vLoading.vehicleNo || '—';
            const lrNo = confirmingBomModal.lrNo || vLoading.lrNo || '—';
            const transporter = confirmingBomModal.transporterName || confirmingBomModal.transporter || vLoading.transporter || vLoading.transporterName || '—';
            const destination = confirmingBomModal.destination || vLoading.destination || confirmingBomModal.deliveryCity || '—';
            const driverName = confirmingBomModal.driverName || vLoading.driverName || '';
            const driverPhone = confirmingBomModal.driverPhone || vLoading.driverPhone || '';

            const hasLoadingData = finalPhotos.length > 0 || Boolean(lrDoc) || vehicleNo !== '—' || lrNo !== '—' || transporter !== '—';

            if (!hasLoadingData) return null;

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
                gap: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Truck size={16} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', color: '#0F172A' }}>
                        Vehicle Loading & Final Dispatch Proof ({finalPhotos.length} Loading Photo{finalPhotos.length === 1 ? '' : 's'}{lrDoc ? ', LR Copy Attached' : ''})
                      </h4>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>
                        Vehicle loading photos and transporter Lorry Receipt (LR) uploaded by Dispatch Team
                      </span>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    backgroundColor: '#DCFCE7',
                    color: '#166534',
                    border: '1px solid #BBF7D0'
                  }}>
                    ✓ Dispatch Proof Recorded
                  </span>
                </div>

                {/* Logistics Key Details */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', backgroundColor: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '11.5px' }}>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Transporter</span>
                    <strong style={{ color: '#0E7490' }}>{transporter}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Destination</span>
                    <strong style={{ color: '#0F172A' }}>{destination}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Vehicle Number</span>
                    <strong style={{ color: '#0F172A' }}>{vehicleNo}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>LR / Docket No</span>
                    <strong style={{ color: '#0F172A' }}>{lrNo}</strong>
                  </div>
                  {(driverName || driverPhone) && (
                    <div>
                      <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Driver Details</span>
                      <strong style={{ color: '#0F172A' }}>{[driverName, driverPhone].filter(Boolean).join(' • ')}</strong>
                    </div>
                  )}
                </div>

                {/* LR Document & Loading Photos Row */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {lrDoc && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: '10px 14px', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText size={18} style={{ color: '#16A34A' }} />
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '800', color: '#166534' }}>
                            Transporter Lorry Receipt (LR) Document
                          </div>
                          <span style={{ fontSize: '11px', color: '#15803D' }}>
                            {lrDoc.name || 'LR_Document.pdf'} {lrDoc.size ? `(${Math.round(lrDoc.size / 1024)} KB)` : ''}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const lrStorageUrl = lrDoc?.storagePath ? `/api/uploads/bom-documents/${lrDoc.storagePath.replace(/^\/+/, '').replace(/^bom-documents\//, '')}` : '';
                          const docUrl = (lrDoc.url && !lrDoc.url.startsWith('blob:')) ? (lrDoc.url.startsWith('/uploads/') ? `/api${lrDoc.url}` : lrDoc.url) : (lrStorageUrl || (lrDoc.dataUrl && !lrDoc.dataUrl.startsWith('blob:') ? lrDoc.dataUrl : '') || (getMediaFromCache(lrDoc.name) || (lrDoc.name ? `/api/uploads/${lrDoc.name}` : '')));
                          setPreviewDocModal({
                            title: `Lorry Receipt (LR) — ${lrNo !== '—' ? lrNo : confirmingBomModal.bomCode}`,
                            bomCode: confirmingBomModal?.bomCode || confirmingBomModal?.code,
                            doc: { ...lrDoc, url: docUrl, dataUrl: docUrl, storageBucket: lrDoc.storageBucket || 'bom-documents', storagePath: lrDoc.storagePath }
                          });
                        }}
                        style={{ border: 'none', backgroundColor: '#16A34A', color: 'white', padding: '6px 14px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <Eye size={12} /> View LR Document
                      </button>
                    </div>
                  )}

                  {finalPhotos.length > 0 && (
                    <div>
                      <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '6px' }}>
                        Final Vehicle Loading Proof Photos ({finalPhotos.length})
                      </span>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                        {finalPhotos.map((ph, pIdx) => {
                          return (
                            <DispatchMediaThumbnail
                              key={ph.id || pIdx}
                              photo={ph}
                              bomCode={confirmingBomModal?.bomCode || confirmingBomModal?.code}
                              label="View Photo"
                              onClick={(resolvedUrl) => {
                                setPreviewDocModal({
                                  title: ph.name || `Vehicle Loading Photo ${pIdx + 1}`,
                                  bomCode: confirmingBomModal?.bomCode || confirmingBomModal?.code,
                                  doc: {
                                    ...ph,
                                    name: ph.name || `Vehicle Loading Photo ${pIdx + 1}`,
                                    dataUrl: resolvedUrl,
                                    url: resolvedUrl,
                                    storageBucket: ph.storageBucket || 'bom-documents',
                                    storagePath: ph.storagePath
                                  }
                                });
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
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

            {!isAlreadyForwarded && !isSourcePiLocked && (
              <button
                onClick={() => {
                  const currentItems = confirmingBomModal.items || [];
                  const updatedItems = [...currentItems, { name: '', category: '', qty: 1, rate: 0, confirmed: false }];
                  setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                }}
                style={{ border: '1px solid #A5F3FC', backgroundColor: '#ECFEFF', color: '#0E7490', height: '36px', padding: '0 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus style={{ width: '14px', height: '14px' }} /> Add New Product
              </button>
            )}
          </div>

          {isSourcePiLocked && (
            <div style={{ padding: '10px 16px', backgroundColor: '#FEF3C7', border: '1.5px solid #F59E0B', borderRadius: '10px', color: '#92400E', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock style={{ width: '16px', height: '16px', flexShrink: 0, color: '#D97706' }} />
              <span>Line Items & Pricing locked from Source Proforma Invoice ({confirmingBomModal.sourcePiNo}). Quantities, items, and prices imported from PI cannot be modified.</span>
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                  {!isAlreadyForwarded && (
                    <th style={{ padding: '12px 10px', width: '40px', textAlign: 'center' }}>
                      <input id="bom-orders-select-all" name="selectAll" aria-label="SelectAll"
                        type="checkbox"
                        title="Select and confirm all products"
                        checked={(confirmingBomModal.items || []).length > 0 && (confirmingBomModal.items || []).every(it => it.confirmed)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          const updated = (confirmingBomModal.items || []).map(it => ({ ...it, confirmed: checked }));
                          setConfirmingBomModal({ ...confirmingBomModal, items: updated });
                        }}
                        style={{ width: '16px', height: '16px', accentColor: '#166534', cursor: 'pointer' }}
                       />
                    </th>
                  )}
                  <th style={{ padding: '12px 10px', width: '40px', textAlign: 'center' }}>#</th>
                  <th style={{ padding: '12px 10px', width: '25%' }}>Product / Component Name</th>
                  <th style={{ padding: '12px 10px', width: '18%' }}>Description</th>
                  <th style={{ padding: '12px 10px', width: '9%', textAlign: 'center' }}>UOM</th>
                  <th style={{ padding: '12px 10px', width: '9%', textAlign: 'center' }}>Qty / Set</th>
                  <th style={{ padding: '12px 10px', width: '12%', textAlign: 'center', color: '#0E7490', backgroundColor: '#ECFEFF' }}>Total Dispatch Qty</th>
                  <th style={{ padding: '12px 10px', width: '12%', textAlign: 'right' }}>Rate (₹)</th>
                  <th style={{ padding: '12px 10px', width: '13%', textAlign: 'right' }}>Total (₹)</th>
                  {!isAlreadyForwarded && <th style={{ padding: '12px 10px', width: '50px', textAlign: 'center' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {/* Build mapping for Preset Kit grouping with distinct themes, banners, and badges */}
                {(() => {
                  const items = confirmingBomModal.items || [];
                  const distinctPresetGroupIds = [];
                  items.forEach(it => {
                    const isPartBundle = Boolean(it.isPresetItem || (modalPresetGroups.length > 0 && cleanNum(it.rate) === 0));
                    if (isPartBundle) {
                      const gid = it.presetGroupId || it.groupId || it.presetId || (it.presetName ? (modalPresetGroups.find(g => g.presetName === it.presetName)?.groupId) : null) || (modalPresetGroups.length === 1 ? (modalPresetGroups[0].groupId || modalPresetGroups[0].presetGroupId || 'default_kit') : null);
                      if (gid && !distinctPresetGroupIds.includes(gid)) {
                        distinctPresetGroupIds.push(gid);
                      }
                    }
                  });
                  modalPresetGroups.forEach((g, gIdx) => {
                    const gid = g.groupId || g.presetGroupId || `preset_grp_${gIdx}`;
                    if (!distinctPresetGroupIds.includes(gid)) {
                      distinctPresetGroupIds.push(gid);
                    }
                  });

                  const presetGroupMap = {};
                  distinctPresetGroupIds.forEach((gid, gIdx) => {
                    const matchedGrp = modalPresetGroups.find(g => g.groupId === gid || g.presetGroupId === gid || g.presetId === gid || (gIdx === 0 && (gid === 'default_kit' || gid === 'preset_grp_0'))) || modalPresetGroups[gIdx] || {};
                    const sets = parseFloat(matchedGrp.setCount || matchedGrp.quantity || matchedGrp.sets) || 1;
                    const unitType = matchedGrp.unit || matchedGrp.unitType || (matchedGrp.isKwBased || String(matchedGrp.presetName || '').toLowerCase().includes('kw') ? 'kW' : 'Sets');
                    const price = cleanNum(matchedGrp.kitPrice) || (modalPresetGroups.length === 1 ? (presetKitsTotal / sets) : 0);
                    presetGroupMap[gid] = {
                      groupId: gid,
                      groupIndex: gIdx,
                      presetName: matchedGrp.presetName || (confirmingBomModal.presetName && gIdx === 0 ? confirmingBomModal.presetName : `Preset Package ${gIdx + 1}`),
                      setCount: sets,
                      unitType: unitType,
                      kitPrice: price,
                      totalAmount: price * sets,
                      firstIdx: -1,
                      count: 0
                    };
                  });

                  // Precompute item metadata and counts
                  const itemMeta = items.map((item, idx) => {
                    const itemRate = cleanNum(item.rate) || 0;
                    const isPartBundle = Boolean(item.isPresetItem || (modalPresetGroups.length > 0 && itemRate === 0));
                    let gid = null;
                    let pInfo = null;
                    let theme = PRESET_THEMES[0];
                    let itemIndexInGroup = 0;
                    let presetNumber = 1;

                    if (isPartBundle) {
                      gid = item.presetGroupId || item.groupId || item.presetId || (item.presetName ? (modalPresetGroups.find(g => g.presetName === item.presetName)?.groupId) : null) || (modalPresetGroups.length === 1 ? (modalPresetGroups[0].groupId || modalPresetGroups[0].presetGroupId || 'default_kit') : (distinctPresetGroupIds[0] || 'default_kit'));
                      if (!presetGroupMap[gid]) {
                        presetGroupMap[gid] = {
                          groupId: gid,
                          groupIndex: distinctPresetGroupIds.length,
                          presetName: item.presetName || 'Preset MMS Kit',
                          setCount: 1,
                          unitType: 'Sets',
                          kitPrice: 0,
                          totalAmount: 0,
                          firstIdx: idx,
                          count: 0
                        };
                        distinctPresetGroupIds.push(gid);
                      }
                      pInfo = presetGroupMap[gid];
                      if (pInfo.firstIdx === -1) pInfo.firstIdx = idx;
                      pInfo.count += 1;
                      itemIndexInGroup = pInfo.count;
                      theme = getPresetTheme(pInfo.groupIndex);
                      presetNumber = pInfo.groupIndex + 1;
                    }
                    return { isPartBundle, gid, itemIndexInGroup, theme, presetNumber };
                  });

                  const customItems = items.filter((_, idx) => !itemMeta[idx].isPartBundle);
                  let customCounter = 0;

                  return items.map((item, idx) => {
                    const itemQty = cleanNum(item.qty) || 0;
                    const itemRate = cleanNum(item.rate) || 0;
                    const itemTotal = itemQty * itemRate;
                    const meta = itemMeta[idx];
                    const isPartBundle = meta.isPartBundle;
                    const gid = meta.gid;
                    const pInfo = gid ? presetGroupMap[gid] : null;
                    const isFirstInKit = pInfo && pInfo.firstIdx === idx;
                    const theme = meta.theme;
                    const isFirstCustomItem = !isPartBundle && idx === items.findIndex((_, i) => !itemMeta[i].isPartBundle);
                    const displaySNo = isPartBundle && distinctPresetGroupIds.length > 0
                      ? `${meta.presetNumber}.${meta.itemIndexInGroup}`
                      : (distinctPresetGroupIds.length > 0 ? `C.${++customCounter}` : `${idx + 1}`);

                    const colCount = isAlreadyForwarded ? 7 : 8;

                    if (isAlreadyForwarded) {
                      return (
                        <React.Fragment key={idx}>
                          {isFirstInKit && pInfo && (
                            <tr key={`bom-preset-banner-${gid}`} style={{ backgroundColor: theme.bg, borderTop: `2.5px solid ${theme.primary}`, borderBottom: `1.5px solid ${theme.border}` }}>
                              <td colSpan={colCount} style={{ padding: '8px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      backgroundColor: theme.primary,
                                      color: '#FFFFFF',
                                      fontSize: '11px',
                                      fontWeight: '800',
                                      letterSpacing: '0.5px'
                                    }}>
                                      <Boxes size={12} />
                                      {theme.badge}
                                    </span>
                                    <strong style={{ fontSize: '13px', color: theme.primary, letterSpacing: '0.2px' }}>
                                      {pInfo.presetName}
                                    </strong>
                                    <span style={{
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      color: theme.tagText,
                                      backgroundColor: theme.tagBg,
                                      padding: '2px 8px',
                                      borderRadius: '12px',
                                      border: `1px solid ${theme.border}`
                                    }}>
                                      {pInfo.setCount} {pInfo.unitType} • {pInfo.count} Components
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '11.5px', color: '#475569' }}>
                                      Package Rate: <strong style={{ color: theme.primary }}>₹ {pInfo.kitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> / {pInfo.unitType === 'kW' ? 'kW' : 'Set'}
                                    </span>
                                    <span style={{ fontSize: '12px', fontWeight: '800', color: theme.primary, backgroundColor: '#FFFFFF', padding: '2px 10px', borderRadius: '6px', border: `1px solid ${theme.border}` }}>
                                      Kit Subtotal: ₹ {pInfo.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          {isFirstCustomItem && distinctPresetGroupIds.length > 0 && (
                            <tr key="bom-custom-items-banner" style={{ backgroundColor: '#F8FAFC', borderTop: '2px solid #64748B', borderBottom: '1px solid #CBD5E1' }}>
                              <td colSpan={colCount} style={{ padding: '8px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    backgroundColor: '#475569',
                                    color: '#FFFFFF',
                                    fontSize: '11px',
                                    fontWeight: '800',
                                    letterSpacing: '0.5px'
                                  }}>
                                    CUSTOM ITEMS
                                  </span>
                                  <strong style={{ fontSize: '12px', color: '#334155' }}>
                                    Additional Materials / Standalone Products ({customItems.length} items)
                                  </strong>
                                </div>
                              </td>
                            </tr>
                          )}
                          <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: isPartBundle ? theme.bg : '#FFFFFF' }}>
                            <td style={{
                              padding: '12px 10px',
                              textAlign: 'center',
                              fontWeight: '800',
                              color: isPartBundle ? theme.primary : '#64748B',
                              borderLeft: isPartBundle ? `4px solid ${theme.primary}` : '4px solid #CBD5E1'
                            }}>
                              #{displaySNo}
                            </td>
                            <td style={{ padding: '12px 10px', fontWeight: '700', color: '#0F172A' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {isPartBundle && (
                                  <span style={{
                                    backgroundColor: theme.tagBg,
                                    color: theme.tagText,
                                    border: `1px solid ${theme.border}`,
                                    fontSize: '10px',
                                    fontWeight: '800',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    letterSpacing: '0.3px',
                                    width: 'fit-content',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: theme.primary }} />
                                    {theme.badge} • Component {meta.itemIndexInGroup} of {pInfo ? pInfo.count : 1}
                                  </span>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span>{item.name || '—'}</span>
                                  {item.isEdited && (
                                    <span title={item.editedNote || 'Edited'} style={{ backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: '800' }}>
                                      Edited
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '12px 10px', color: '#64748B' }}>{item.category || item.specs || '—'}</td>
                            <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '700', color: '#475569' }}>{item.uom || item.unit || 'NOS'}</td>
                            <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '800', color: '#2563EB' }}>{itemQty}</td>
                            
                            {/* Total Dispatch Quantity Column */}
                            <td style={{ padding: '12px 10px', textAlign: 'center', backgroundColor: isPartBundle ? '#ECFEFF' : '#F8FAFC' }}>
                              {(() => {
                                if (!isPartBundle) {
                                  return (
                                    <span style={{ color: '#94A3B8', fontWeight: '700', fontSize: '13px' }} title="Standalone product; entered quantity is direct total quantity">—</span>
                                  );
                                }
                                const isSub = Boolean(item.isSubPreset || item.subPresetName || item.subPresetId);
                                const effectivePresetName = isSub ? item.subPresetName : (pInfo?.presetName || item.presetName || confirmingBomModal.presetName);
                                const effectiveUnit = isSub ? (item.subUnit || item.unit || 'Sets') : (pInfo?.unitType || pInfo?.unit || item.unit || item.uom);
                                const effectiveSetCount = isSub ? (item.subSetCount || 1) : (pInfo?.setCount || confirmingBomModal.setCount || confirmingBomModal.presetSetCount || 1);
                                const totalDisp = calculateTotalDispatchQty(
                                  item,
                                  effectiveSetCount,
                                  effectivePresetName,
                                  confirmingBomModal.category || item.category,
                                  effectiveUnit
                                );
                                const isKw = isKwPreset(effectivePresetName, effectiveUnit, item);
                                const isRail = isRailPreset(effectivePresetName, confirmingBomModal.category || item.category, item.subPresetName, item.name);
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                    <div style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      backgroundColor: '#FFFFFF',
                                      border: `1.5px solid ${isPartBundle ? theme.border : '#CBD5E1'}`,
                                      borderRadius: '6px',
                                      padding: '4px 8px'
                                    }}>
                                      <strong style={{ fontSize: '13px', color: isPartBundle ? theme.primary : '#0E7490', fontWeight: '800' }}>
                                        {totalDisp}
                                      </strong>
                                      <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '700' }}>
                                        {item.uom || item.unit || 'NOS'}
                                      </span>
                                    </div>
                                    {isPartBundle && (
                                      <span style={{ fontSize: '9px', color: (isKw || isRail) ? '#059669' : '#64748B', fontWeight: '600' }}>
                                        {isKw ? 'Direct kW Qty' : (isRail ? 'Direct Rails Qty' : `${itemQty} × ${pInfo?.setCount || 1} Set${(pInfo?.setCount || 1) > 1 ? 's' : ''}`)}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            
                            {/* Rate Column: Consolidated & Centered in Middle for Presets (Like PI) */}
                            {isPartBundle ? (
                              isFirstInKit ? (
                                <td
                                  rowSpan={pInfo.count}
                                  style={{
                                    padding: '12px 10px',
                                    textAlign: 'right',
                                    verticalAlign: 'middle',
                                    backgroundColor: theme.bg,
                                    borderLeft: `1.5px solid ${theme.border}`,
                                    borderRight: `1px solid ${theme.border}`
                                  }}
                                >
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: '800', color: theme.primary, backgroundColor: theme.tagBg, padding: '2px 7px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                      {pInfo.setCount} {pInfo.unitType} Kit
                                    </span>
                                    <span style={{ fontWeight: '800', color: theme.primary, fontSize: '13.5px' }}>
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
                                    color: theme.primary,
                                    fontSize: '14px',
                                    backgroundColor: theme.bg
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
                        </React.Fragment>
                      );
                    }

                    return (
                      <React.Fragment key={idx}>
                        {isFirstInKit && pInfo && (
                          <tr key={`bom-preset-banner-edit-${gid}`} style={{ backgroundColor: theme.bg, borderTop: `2.5px solid ${theme.primary}`, borderBottom: `1.5px solid ${theme.border}` }}>
                            <td colSpan={colCount} style={{ padding: '8px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    backgroundColor: theme.primary,
                                    color: '#FFFFFF',
                                    fontSize: '11px',
                                    fontWeight: '800',
                                    letterSpacing: '0.5px'
                                  }}>
                                    <Boxes size={12} />
                                    {theme.badge}
                                  </span>
                                  <strong style={{ fontSize: '13px', color: theme.primary, letterSpacing: '0.2px' }}>
                                    {pInfo.presetName}
                                  </strong>
                                  <span style={{
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    color: theme.tagText,
                                    backgroundColor: theme.tagBg,
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    border: `1px solid ${theme.border}`
                                  }}>
                                    {pInfo.setCount} {pInfo.unitType} • {pInfo.count} Components
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <span style={{ fontSize: '11.5px', color: '#475569' }}>
                                    Package Rate: <strong style={{ color: theme.primary }}>₹ {pInfo.kitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> / {pInfo.unitType === 'kW' ? 'kW' : 'Set'}
                                  </span>
                                  <span style={{ fontSize: '12px', fontWeight: '800', color: theme.primary, backgroundColor: '#FFFFFF', padding: '2px 10px', borderRadius: '6px', border: `1px solid ${theme.border}` }}>
                                    Kit Subtotal: ₹ {pInfo.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        {isFirstCustomItem && distinctPresetGroupIds.length > 0 && (
                          <tr key="bom-custom-items-banner-edit" style={{ backgroundColor: '#F8FAFC', borderTop: '2px solid #64748B', borderBottom: '1px solid #CBD5E1' }}>
                            <td colSpan={colCount} style={{ padding: '8px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: '#475569',
                                  color: '#FFFFFF',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  letterSpacing: '0.5px'
                                }}>
                                  CUSTOM ITEMS
                                </span>
                                <strong style={{ fontSize: '12px', color: '#334155' }}>
                                  Additional Materials / Standalone Products ({customItems.length} items)
                                </strong>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: item.confirmed ? '#F0FDF4' : (isPartBundle ? theme.bg : '#FFFFFF') }}>
                          <td style={{
                            padding: '12px 10px',
                            textAlign: 'center',
                            borderLeft: isPartBundle ? `4px solid ${theme.primary}` : (item.confirmed ? '4px solid #166534' : '4px solid #CBD5E1')
                          }}>
                            <input id={`bom-orders-checkbox-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`checkbox_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Checkbox"
                              type="checkbox"
                              checked={Boolean(item.confirmed)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, confirmed: checked } : it);
                                setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                              }}
                              style={{ width: '16px', height: '16px', accentColor: theme.primary, cursor: 'pointer' }}
                             />
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '800', color: isPartBundle ? theme.primary : '#64748B' }}>
                            #{displaySNo}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            {isPartBundle && (
                              <div style={{ marginBottom: '4px' }}>
                                <span style={{
                                  backgroundColor: theme.tagBg,
                                  color: theme.tagText,
                                  border: `1px solid ${theme.border}`,
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  letterSpacing: '0.3px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: theme.primary }} />
                                  {theme.badge} • Component {meta.itemIndexInGroup} of {pInfo ? pInfo.count : 1}
                                </span>
                              </div>
                            )}
                            {isSourcePiLocked ? (
                              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                                {item.name || '—'}
                              </div>
                            ) : (
                              <TypeableProductSelect
                                value={item.name || ''}
                                itemsList={itemsList}
                                placeholder="Type or select product / item..."
                                accentColor={theme.primary}
                                onChange={(val, matched) => {
                                  if (!matched) {
                                    const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, name: val } : it);
                                    setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                                    return;
                                  }
                                  const pName = matched.name;
                                  const pCat = matched.category || matched.description || item.category;
                                  const isSolar5 = is5PctSolarProduct(pName, pCat);
                                  const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? {
                                    ...it,
                                    name: pName,
                                    code: matched.code || it.code || '',
                                    rate: matched.price || matched.rate ? Number(matched.price || matched.rate) : it.rate,
                                    uom: matched.uom || matched.unit || it.uom || it.unit || 'NOS',
                                    unit: matched.uom || matched.unit || it.uom || it.unit || 'NOS',
                                    category: pCat,
                                    gstRate: isSolar5 ? '5%' : (it.gstRate || '18%')
                                  } : it);
                                  setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                                }}
                              />
                            )}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            {isSourcePiLocked ? (
                              <div style={{ fontSize: '12px', color: '#64748B' }}>
                                {item.category || item.specs || '—'}
                              </div>
                            ) : (
                              <input id={`bom-orders-description-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`description_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Description"
                                type="text"
                                placeholder="Description..."
                                value={item.category || item.specs || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, category: val, specs: val } : it);
                                  setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                                }}
                                style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12px', color: '#0F172A', backgroundColor: 'white', outline: 'none', cursor: 'text' }}
                               />
                            )}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            {isSourcePiLocked ? (
                              <div style={{ fontSize: '12px', textAlign: 'center', fontWeight: '700', color: '#475569' }}>
                                {item.uom || item.unit || 'NOS'}
                              </div>
                            ) : (
                              <input id={`bom-orders-uom-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`uOM_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="UOM"
                                type="text"
                                placeholder="UOM"
                                value={item.uom || item.unit || 'NOS'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, uom: val, unit: val } : it);
                                  setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                                }}
                                style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 6px', fontSize: '12px', textAlign: 'center', fontWeight: '700', color: '#0F172A', backgroundColor: 'white', outline: 'none', cursor: 'text' }}
                               />
                            )}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            {isSourcePiLocked ? (
                              <div style={{ fontSize: '13px', textAlign: 'center', fontWeight: '800', color: '#2563EB' }}>
                                {item.qty || 0}
                              </div>
                            ) : (
                              <input id={`bom-orders-qty-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`qty_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Qty"
                                type="number"
                                min="1"
                                value={item.qty}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, qty: val } : it);
                                  setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                                }}
                                style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 6px', fontSize: '12px', textAlign: 'center', color: '#0F172A', backgroundColor: 'white', outline: 'none', cursor: 'text' }}
                               />
                            )}
                          </td>
                          {/* Total Dispatch Quantity Column */}
                          <td style={{ padding: '12px 10px', textAlign: 'center', backgroundColor: isPartBundle ? theme.bg : '#F8FAFC' }}>
                            {(() => {
                              const isSub = Boolean(item.isSubPreset || item.subPresetName || item.subPresetId);
                              const effectivePresetName = isSub ? item.subPresetName : (pInfo?.presetName || item.presetName);
                              const effectiveUnit = isSub ? (item.subUnit || item.unit || 'Sets') : (pInfo?.unit || item.unit || item.uom);
                              const effectiveSetCount = isSub ? (item.subSetCount || 1) : (pInfo?.setCount || 1);
                              const calcTotalDisp = calculateTotalDispatchQty(
                                item,
                                effectiveSetCount,
                                effectivePresetName,
                                item.category,
                                effectiveUnit
                              );
                              const totalDisp = item.totalDispatchQty !== undefined && item.totalDispatchQty !== null && item.totalDispatchQty !== ''
                                ? item.totalDispatchQty
                                : calcTotalDisp;
                              const isKw = isKwPreset(effectivePresetName, effectiveUnit, item);
                              const isRail = isRailPreset(effectivePresetName, item.category, item.subPresetName, item.name);
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                  <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    backgroundColor: '#FFFFFF',
                                    border: `1.5px solid ${isPartBundle ? (isSub ? '#0D9488' : theme.border) : '#CBD5E1'}`,
                                    borderRadius: '6px',
                                    padding: '2px 4px'
                                  }}>
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      value={totalDisp}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, totalDispatchQty: val } : it);
                                        setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                                      }}
                                      style={{
                                        width: '64px',
                                        height: '28px',
                                        borderRadius: '4px',
                                        border: 'none',
                                        fontSize: '13px',
                                        color: isPartBundle ? (isSub ? '#0F766E' : theme.primary) : '#0E7490',
                                        fontWeight: '800',
                                        textAlign: 'center',
                                        outline: 'none',
                                        backgroundColor: 'transparent'
                                      }}
                                    />
                                    <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '700', paddingRight: '4px' }}>
                                      {item.uom || item.unit || 'NOS'}
                                    </span>
                                  </div>
                                  {isPartBundle && (
                                    <span style={{ fontSize: '9px', color: (isKw || isRail) ? '#059669' : '#64748B', fontWeight: '600' }}>
                                      {isKw ? 'Direct kW Qty' : (isRail ? 'Direct Rails Qty' : `Formula: ${parseFloat(item.qty) || 0} × ${effectiveSetCount}`)}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          {/* Rate Column for Editing / Verification */}
                          {isSourcePiLocked && isPartBundle ? (
                            isFirstInKit ? (
                              <td
                                rowSpan={pInfo.count}
                                style={{
                                  padding: '12px 10px',
                                  textAlign: 'right',
                                  verticalAlign: 'middle',
                                  backgroundColor: theme.bg,
                                  borderLeft: `1.5px solid ${theme.border}`,
                                  borderRight: `1px solid ${theme.border}`
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                                  <span style={{ fontSize: '10px', fontWeight: '800', color: theme.primary, backgroundColor: theme.tagBg, padding: '2px 7px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                    {pInfo.setCount} {pInfo.unitType} Kit
                                  </span>
                                  <span style={{ fontWeight: '800', color: theme.primary, fontSize: '13px' }}>
                                    ₹ {pInfo.kitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </td>
                            ) : null
                          ) : (
                            <td style={{ padding: '12px 10px' }}>
                              {isSourcePiLocked ? (
                                <div style={{ fontSize: '13px', textAlign: 'right', fontWeight: '600', color: '#334155' }}>
                                  ₹ {parseFloat(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </div>
                              ) : (
                                <input id={`bom-orders-rate-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`rate_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Rate"
                                  type="number"
                                  min="0"
                                  value={item.rate}
                                  placeholder={isPartBundle ? '0 (Bundled)' : '0'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, rate: val } : it);
                                    setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                                  }}
                                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '12px', textAlign: 'right', color: '#0F172A', backgroundColor: 'white', outline: 'none', cursor: 'text' }}
                                 />
                              )}
                            </td>
                          )}

                          {/* Total Column for Editing / Verification */}
                          {isSourcePiLocked && isPartBundle ? (
                            isFirstInKit ? (
                              <td
                                rowSpan={pInfo.count}
                                style={{
                                  padding: '12px 10px',
                                  textAlign: 'right',
                                  verticalAlign: 'middle',
                                  fontWeight: '900',
                                  color: theme.primary,
                                  fontSize: '13.5px',
                                  backgroundColor: theme.bg
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

                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            {isSourcePiLocked ? (
                              <span title="Locked from Source Proforma Invoice" style={{ color: '#94A3B8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Lock style={{ width: '14px', height: '14px' }} />
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  const updatedItems = (confirmingBomModal.items || []).filter((_, i) => i !== idx);
                                  setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                                }}
                                style={{ border: 'none', background: '#FEE2E2', color: '#DC2626', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <Trash2 style={{ width: '14px', height: '14px' }} />
                              </button>
                            )}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          {/* Summary Math & Action Block */}
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
                    <span>Preset Kit(s): <strong style={{ color: '#0E7490', fontWeight: '800' }}>₹ {presetKitsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                  )}
                  {customItemsTotal > 0 && (
                    <span>Additional Items: <strong style={{ color: '#0F172A', fontWeight: '800' }}>₹ {customItemsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                  )}
                  <span>Taxable Subtotal: <strong style={{ color: '#0F172A', fontWeight: '800' }}>₹ {orderSubTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                  <span>GST: <strong style={{ color: '#64748B', fontWeight: '700' }}>₹ {orderGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                </div>
                <div style={{ fontSize: '14px', color: '#334155' }}>
                  Total Order Value: <strong style={{ color: '#0E7490', fontSize: '17px', fontWeight: '900' }}>₹ {orderGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
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

        {/* Sticky Bottom Menu Bar Following with Scroll for BOM Details & Reconfirmation */}
        <div
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
            flexWrap: 'wrap',
            gap: '16px',
            zIndex: 50,
            boxShadow: '0 -4px 16px rgba(15, 23, 42, 0.08)',
            borderRadius: '12px',
            marginTop: '16px',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setConfirmingBomModal(null)}
              style={{
                height: '40px',
                borderRadius: '8px',
                border: '1.5px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#334155',
                padding: '0 18px',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
            >
              Back to BOM Dashboard
            </button>
            <button
              type="button"
              onClick={() => setPrintingBomRecord(confirmingBomModal)}
              style={{
                height: '40px',
                borderRadius: '8px',
                border: '1.5px solid #10B981',
                backgroundColor: '#ECFDF5',
                color: '#047857',
                padding: '0 18px',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
            >
              Print
            </button>
            <button
              type="button"
              onClick={() => setExportFormatRecord(confirmingBomModal)}
              style={{
                height: '40px',
                borderRadius: '8px',
                border: '1.5px solid #0E7490',
                backgroundColor: '#ECFEFF',
                color: '#0E7490',
                padding: '0 18px',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
            >
              Export
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>Grand Total:</span>
            <strong style={{ fontSize: '15px', color: '#0E7490', fontWeight: '800' }}>
              ₹{(orderGrandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>
        </div>

        {/* EXPORT FORMAT SELECTOR MODAL (PDF / JPG / CSV) */}
        {renderExportFormatModal()}

        {/* PRINTABLE BOM ORDER SHEET TEMPLATE */}
        {printingBomRecord && (
          <VRMBomPrintTemplate
            bomData={printingBomRecord}
            onClose={() => setPrintingBomRecord(null)}
            userRole={props.userRole || userRole || 'Sales Executive'}
            isSales={true}
          />
        )}

        {/* DOCUMENT PREVIEW MODAL */}
        {renderDocPreviewModal()}
      </div>
    );
}
