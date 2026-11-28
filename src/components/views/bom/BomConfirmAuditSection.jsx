import React, { useState } from 'react';
import {
  Plus, Check, Trash2, Eye, FileText, AlertCircle, XCircle, CheckCircle, RotateCcw, Truck, Upload, Printer, Download, CreditCard, CheckSquare, Camera, Video, List, Image, Lock, Boxes, User, Receipt, Layers, X, Save, Clock, UploadCloud, FileCheck, ShoppingCart
} from 'lucide-react';
import { saveCloudBomRow } from '../../../utils/supabaseDataSync';
import {
  VRM_PRODUCTS,
  isRailPreset,
  isKwPreset,
  isTriangleDirectPreset,
  SALES_UOM_OPTIONS,
  isSalesLoginRole,
  normalizeSalesUomValue,
  calculateTotalDispatchQty,
  resolveBomItemDispatchQty,
  resolveDefaultUom
} from '../../../utils/vrmProductsData';
import { getMediaFromCache, stripDataUrlsFromRecord, cleanNum, normalizePaymentTerm } from '../../../utils/otherViewsShared';
import { uploadBomDocumentFile, validateClientFile } from '../../../utils/bomStorageClient';
import TypeableProductSelect from '../../TypeableProductSelect';
import SearchablePresetSelector from '../../SearchablePresetSelector';
import { searchCustomers } from '../../../services/customerService';
import { findMatchingCustomerRecord, evaluateCreditEligibility } from '../../../utils/creditCustomerHelper';
import { is5PctSolarProduct } from '../../../utils/hsnCodeService';
import { PRESET_THEMES, getPresetTheme } from '../../../utils/presetThemes';
import DispatchMediaThumbnail from '../DispatchMediaThumbnail';
import { notifyBomSentToDispatch } from '../../../services/notificationService';
import BomConfirmCeoDetailSection from './BomConfirmCeoDetailSection';
import BomOperationalModals from './BomOperationalModals';
import { extractGstRate } from '../../../utils/gstHelper';
import { needsSalesAddressProof } from './bomStageHelpers';

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
    customerList,
    setCustomerList,
    activePresetsMap,
    bomCustSearchTimerRef,
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

  const [selectedPresetPicker, setSelectedPresetPicker] = useState('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState(false);

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

    const normalizedPayType = isDcOrder
      ? '100% Paid'
      : normalizePaymentTerm(confirmingBomModal.paymentType || confirmingBomModal.paymentTerms || confirmingBomModal.piPaymentTerms || '100% Paid');

    const bomPG = confirmingBomModal.presetGroups;
    const hasBomPG = Array.isArray(bomPG) ? bomPG.length > 0 : Boolean(bomPG && typeof bomPG === 'object' && Object.keys(bomPG).length > 0);
    let fallbackPiPG = null;
    if (!hasBomPG && (confirmingBomModal.sourcePiNo || confirmingBomModal.piNo) && typeof window !== 'undefined') {
      try {
        const rawPis = localStorage.getItem('controlroom_sales_pi_store') || localStorage.getItem('controlroom_pi_store');
        const piList = rawPis ? JSON.parse(rawPis) : [];
        const targetPi = String(confirmingBomModal.sourcePiNo || confirmingBomModal.piNo).trim().toLowerCase();
        const foundPi = (Array.isArray(piList) ? piList : []).find(p => String(p?.piNo || p?.id || '').trim().toLowerCase() === targetPi);
        if (foundPi?.presetGroups) fallbackPiPG = foundPi.presetGroups;
      } catch (_) {}
    }
    const effPG = hasBomPG ? bomPG : (fallbackPiPG || []);
    const rawPresetGroupsList = Array.isArray(effPG)
      ? effPG
      : (effPG && typeof effPG === 'object' ? Object.values(effPG) : []);
    const modalPresetGroups = rawPresetGroupsList.length > 0
      ? rawPresetGroupsList.map(g => ({ ...g }))
      : (confirmingBomModal.presetName || (cleanNum(confirmingBomModal.presetKitPrice) > 0))
        ? [{
            presetName: confirmingBomModal.presetName || 'Pre-Engineered Structure Kit Package',
            setCount: parseFloat(confirmingBomModal.presetSetCount) || 1,
            unit: confirmingBomModal.presetUnit || (String(confirmingBomModal.presetName || '').toLowerCase().includes('kw') ? 'kW' : 'Sets'),
            unitType: confirmingBomModal.presetUnit || (String(confirmingBomModal.presetName || '').toLowerCase().includes('kw') ? 'kW' : 'Sets'),
            kitPrice: cleanNum(confirmingBomModal.presetKitPrice) || 0
          }]
        : [];

    let presetKitsTotal = modalPresetGroups.reduce((acc, g) => acc + ((cleanNum(g.kitPrice) || 0) * (parseFloat(g.setCount) || 1)), 0) || (cleanNum(confirmingBomModal.presetKitPrice) || 0);
    const customItemsTotal = (confirmingBomModal.items || []).reduce((acc, it) => acc + ((cleanNum(it.qty) || 0) * (cleanNum(it.rate) || 0)), 0);

    // Fallback: If presetKitsTotal is 0, but the BOM has items with rate 0 and grandTotal > customItemsTotal, compute preset package price
    if (presetKitsTotal === 0 && (confirmingBomModal.items || []).some(it => it.isPresetItem || cleanNum(it.rate || 0) === 0)) {
      const gTotal = cleanNum(confirmingBomModal.grandTotal) || 0;
      const fallbackMult = 1 + (extractGstRate(confirmingBomModal.gstRate, 18) / 100);
      const sTotal = cleanNum(confirmingBomModal.subTotal) || (gTotal > 0 ? (gTotal / fallbackMult) : 0);
      if (sTotal > customItemsTotal) {
        presetKitsTotal = Math.max(0, Math.round((sTotal - customItemsTotal) * 100) / 100);
        if (modalPresetGroups.length === 0) {
          modalPresetGroups.push({
            presetName: confirmingBomModal.presetName || 'Pre-Engineered Structure Kit Package',
            setCount: parseFloat(confirmingBomModal.presetSetCount) || 1,
            unit: confirmingBomModal.presetUnit || (String(confirmingBomModal.presetName || '').toLowerCase().includes('kw') ? 'kW' : 'Sets'),
            unitType: confirmingBomModal.presetUnit || (String(confirmingBomModal.presetName || '').toLowerCase().includes('kw') ? 'kW' : 'Sets'),
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

    const customItemsGstCalc = (confirmingBomModal.items || []).reduce((acc, it) => {
      if (it.isPresetItem || it.presetGroupId) return acc;
      const sub = (cleanNum(it.qty) || 0) * (cleanNum(it.rate) || 0);
      const rate = extractGstRate(it.gstRate ?? it.tax ?? confirmingBomModal.gstRate, 18);
      return acc + (sub * (rate / 100));
    }, 0);
    const presetGroupsGstCalc = modalPresetGroups.reduce((acc, g, gi) => {
      const sub = (cleanNum(g.kitPrice) || 0) * (parseFloat(g.setCount) || 1);
      const gKey = g.groupId || g.presetGroupId || g.presetId || (gi === 0 ? 'default_kit' : `preset_grp_${gi}`);
      const firstGrpItem = (confirmingBomModal.items || []).find(it => (it.presetGroupId || it.groupId || it.presetId || 'default_kit') === gKey);
      const rate = extractGstRate(g.gstRate ?? firstGrpItem?.gstRate ?? confirmingBomModal.gstRate, 18);
      return acc + (sub * (rate / 100));
    }, 0);
    const computedBomGst = Math.round((customItemsGstCalc + presetGroupsGstCalc) * 100) / 100;
    const fallbackBomGst = Math.round(orderSubTotal * (extractGstRate(confirmingBomModal.gstRate, 18) / 100) * 100) / 100;
    const effectiveComputedGst = (customItemsTotal + presetKitsTotal) > 0 ? computedBomGst : fallbackBomGst;
    const storedGstForCheck = confirmingBomModal.gstAmount != null
      ? cleanNum(confirmingBomModal.gstAmount)
      : (cleanNum(confirmingBomModal.grandTotal) > 0 ? Math.max(0, cleanNum(confirmingBomModal.grandTotal) - orderSubTotal) : effectiveComputedGst);
    const hasGstMismatch = Boolean((customItemsTotal + presetKitsTotal) > 0 && Math.abs(effectiveComputedGst - storedGstForCheck) > 1);

    if (hasSubtotalMismatch || hasGstMismatch) {
      // Items or GST rates were modified -> recompute GST and Grand Total cleanly from actual line items
      orderGstAmount = effectiveComputedGst;
      orderGrandTotal = Math.round((orderSubTotal + orderGstAmount) * 100) / 100;
    } else {
      const rawGrand = cleanNum(confirmingBomModal.grandTotal);
      orderGrandTotal = rawGrand > 0 ? Math.round(rawGrand * 100) / 100 : Math.round((orderSubTotal + effectiveComputedGst) * 100) / 100;
      const rawGst = cleanNum(confirmingBomModal.gstAmount);
      orderGstAmount = rawGst > 0 ? Math.round(rawGst * 100) / 100 : Math.max(0, Math.round((orderGrandTotal - orderSubTotal) * 100) / 100);
    }
    const grandTotalCalc = orderGrandTotal;

    const reconfirmCreditCustomer = findMatchingCustomerRecord(customerList, {
      companyName: confirmingBomModal.companyName,
      customerName: confirmingBomModal.customerName,
      gstNo: confirmingBomModal.gstNo || confirmingBomModal.gstin
    });
    const reconfirmCreditEval = evaluateCreditEligibility({
      customer: reconfirmCreditCustomer,
      bomStore: bomStore || [],
      orderTotal: orderGrandTotal || 0,
      excludeBomCode: confirmingBomModal.bomCode || confirmingBomModal.code || confirmingBomModal.id || null
    });

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

    const resolvedBStreet = rawBObj.address ?? rawBObj.street ?? confirmingBomModal.billingStreet ?? sourcePi?.billingStreet ?? (typeof confirmingBomModal.billingAddress === 'string' && !confirmingBomModal.billingAddress.includes('on file') ? confirmingBomModal.billingAddress : '') ?? (typeof sourcePi?.billingAddress === 'string' ? sourcePi.billingAddress : '') ?? '';
    const resolvedBCity = rawBObj.city ?? confirmingBomModal.billingCity ?? sourcePi?.billingCity ?? '';
    const resolvedBState = rawBObj.state ?? confirmingBomModal.billingState ?? sourcePi?.billingState ?? '';
    const resolvedBPincode = rawBObj.pincode ?? rawBObj.pin ?? confirmingBomModal.billingPincode ?? sourcePi?.billingPincode ?? '';

    const bObj = {
      address: resolvedBStreet,
      street: resolvedBStreet,
      city: resolvedBCity,
      state: resolvedBState,
      pincode: resolvedBPincode
    };

    const isSameAddr = confirmingBomModal.sameAsBilling === true
      ? true
      : (confirmingBomModal.sameAsBilling === false
          ? false
          : (!rawDObj.address && !rawDObj.street || (rawDObj.address || rawDObj.street) === (rawBObj.address || rawBObj.street)));

    const resolvedDStreet = isSameAddr && resolvedBStreet
      ? resolvedBStreet
      : (rawDObj.address ?? rawDObj.street ?? confirmingBomModal.deliveryStreet ?? sourcePi?.deliveryStreet ?? (typeof confirmingBomModal.deliveryAddress === 'string' && !confirmingBomModal.deliveryAddress.includes('on file') ? confirmingBomModal.deliveryAddress : '') ?? resolvedBStreet);
    const resolvedDCity = isSameAddr && resolvedBCity ? resolvedBCity : (rawDObj.city ?? confirmingBomModal.deliveryCity ?? sourcePi?.deliveryCity ?? resolvedBCity);
    const resolvedDState = isSameAddr && resolvedBState ? resolvedBState : (rawDObj.state ?? confirmingBomModal.deliveryState ?? sourcePi?.deliveryState ?? resolvedBState);
    const resolvedDPincode = isSameAddr && resolvedBPincode ? resolvedBPincode : (rawDObj.pincode ?? rawDObj.pin ?? confirmingBomModal.deliveryPincode ?? sourcePi?.deliveryPincode ?? resolvedBPincode);

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

    const paymentProofList = (() => {
      const list = (Array.isArray(confirmingBomModal.paymentProofDocs) && confirmingBomModal.paymentProofDocs.length > 0)
        ? confirmingBomModal.paymentProofDocs
        : (Array.isArray(confirmingBomModal.payments?.proofDocObjs) && confirmingBomModal.payments.proofDocObjs.length > 0)
          ? confirmingBomModal.payments.proofDocObjs
          : (confirmingBomModal.paymentProofDoc
              ? (Array.isArray(confirmingBomModal.paymentProofDoc) ? confirmingBomModal.paymentProofDoc : [confirmingBomModal.paymentProofDoc])
              : (confirmingBomModal.payments?.proofDocObj
                  ? [confirmingBomModal.payments.proofDocObj]
                  : (confirmingBomModal.payments?.proofDoc
                      ? [{ name: confirmingBomModal.payments.proofDoc, dataUrl: confirmingBomModal.payments.proofDocData }]
                      : [])));
      return list.filter(d => Boolean(d && (typeof d === 'string' ? d.trim() : (d.name || d.url || d.dataUrl || d.storagePath))));
    })();

    const deliveryProofList = (() => {
      const list = (Array.isArray(confirmingBomModal.deliveryAddressProofDocs) && confirmingBomModal.deliveryAddressProofDocs.length > 0)
        ? confirmingBomModal.deliveryAddressProofDocs
        : (confirmingBomModal.deliveryAddressProofDoc
            ? (Array.isArray(confirmingBomModal.deliveryAddressProofDoc) ? confirmingBomModal.deliveryAddressProofDoc : [confirmingBomModal.deliveryAddressProofDoc])
            : []);
      return list.filter(d => Boolean(d && (typeof d === 'string' ? d.trim() : (d.name || d.url || d.dataUrl || d.storagePath))));
    })();

    let matchedInv = null;
    try {
      const invList = JSON.parse(localStorage.getItem('controlroom_invoice_store') || '[]');
      if (Array.isArray(invList)) {
        const bCode = String(confirmingBomModal.bomCode || confirmingBomModal.code || '').trim().toLowerCase();
        const bInv = String(confirmingBomModal.invoiceNo || '').trim().toLowerCase();
        matchedInv = invList.find(inv => {
          if (!inv) return false;
          const iBom = String(inv.bomCode || inv.poNo || '').trim().toLowerCase();
          const iNo = String(inv.invNo || inv.invoiceNo || inv.code || '').trim().toLowerCase();
          return (bCode && iBom === bCode) || (bInv && iNo === bInv);
        }) || null;
      }
    } catch (_) {}

    const timing = getBomStageTiming(confirmingBomModal, sourcePi, matchedInv);


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

  const isSameAsBillingActive = confirmingBomModal.sameAsBilling !== undefined
    ? Boolean(confirmingBomModal.sameAsBilling)
    : isSameAddr;

  const updateBomInStores = (updatedBomData) => {
    const updatedList = (bomStore || []).map(b => ((b.bomCode && (b.bomCode === confirmingBomModal.bomCode || b.bomCode === confirmingBomModal.id || b.bomCode === confirmingBomModal.code)) || (b.id && (b.id === confirmingBomModal.id || b.id === confirmingBomModal.bomCode)) || (b.code && (b.code === confirmingBomModal.code || b.code === confirmingBomModal.bomCode))) ? {
      ...b,
      ...updatedBomData
    } : b);
    setBomStore(updatedList);
    safeSaveBomStoreToLocal(updatedList);
    saveCloudBomRow(updatedBomData);
    return updatedList;
  };

  const persistBomToServer = async (updatedBomData) => {
    const sesId = typeof window !== 'undefined' && window.localStorage
      ? (localStorage.getItem('controlroom_device_session_id') || localStorage.getItem('businz_device_session_id'))
      : null;
    const curRole = typeof window !== 'undefined' && window.localStorage
      ? (localStorage.getItem('controlroom_user_role') || userRole || 'Sales')
      : (userRole || 'Sales');
    const curEmp = typeof window !== 'undefined' && window.localStorage
      ? (localStorage.getItem('controlroom_logged_emp_id') || 'SE-001')
      : 'SE-001';

    return fetch('/api/boms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sesId ? { 'x-session-id': sesId } : {}),
        'x-user-role': curRole,
        'x-employee-code': curEmp
      },
      body: JSON.stringify({ bom: stripDataUrlsFromRecord(updatedBomData), isUpdate: true })
    }).catch(() => null);
  };

  const buildUpdatedBomPayload = (currentItemsList, { confirmAndSend = false } = {}) => {
    const bStr = formatAddr(bObj, confirmingBomModal.billingAddress);
    const dStr = isSameAsBillingActive ? bStr : formatAddr(dObj, confirmingBomModal.deliveryAddress);
    const finalDObj = isSameAsBillingActive ? { ...bObj } : { ...dObj };

    const finalizedItems = (currentItemsList || []).map(i => {
      const totalDispatchQty = resolveBomItemDispatchQty(i, confirmingBomModal);
      return {
        ...i,
        ...(confirmAndSend ? { confirmed: true } : {}),
        qtyPerSet: i.qtyPerSet || i.qty,
        totalDispatchQty
      };
    });

    // Packing list always follows the confirmed BOM lines, so Sales edits reach Dispatch.
    // A line keeps its existing packed state only when its quantity is unchanged.
    const prevPacking = Array.isArray(confirmingBomModal.dispatchPacking) ? confirmingBomModal.dispatchPacking : [];
    const isSamePackingLine = (p, it) => Boolean(p) &&
      String(p.presetGroupId || '') === String(it.presetGroupId || '') &&
      ((p.code && it.code && p.code === it.code) || (p.name && it.name && p.name.toLowerCase().trim() === it.name.toLowerCase().trim()));
    const packingItems = finalizedItems.map((it, idx) => {
      const dispatchQty = it.totalDispatchQty || it.qty || 1;
      const prev = isSamePackingLine(prevPacking[idx], it) ? prevPacking[idx] : prevPacking.find(p => isSamePackingLine(p, it));
      const qtyUnchanged = prev && Number(prev.totalDispatchQty || prev.bomQty || 0) === Number(dispatchQty);
      return {
        ...(qtyUnchanged ? prev : {}),
        code: it.code || '',
        name: it.name || it.c2 || 'Item',
        bomQty: dispatchQty,
        qtyPerSet: it.qtyPerSet || it.qty || 1,
        totalDispatchQty: dispatchQty,
        setCount: it.setCount || 1,
        isPresetItem: Boolean(it.isPresetItem),
        presetGroupId: it.presetGroupId || null,
        presetName: it.presetName || null,
        packed: qtyUnchanged ? Boolean(prev.packed) : false
      };
    });

    const prevBomRec = (bomStore || []).find(b => b && (b.bomCode === confirmingBomModal.bomCode || b.id === confirmingBomModal.id || b.code === confirmingBomModal.code));
    const nextEditedFields = { ...(prevBomRec?.editedFields || confirmingBomModal.editedFields || {}) };
    const normVal = (v) => String(v == null ? '' : v).trim();

    if (prevBomRec) {
      if (normVal(prevBomRec.deliveryDate) !== normVal(confirmingBomModal.deliveryDate)) {
        nextEditedFields.deliveryDate = `${normVal(prevBomRec.deliveryDate) || '—'} → ${normVal(confirmingBomModal.deliveryDate) || '—'}`;
      }
      if (normVal(prevBomRec.docType || 'Invoice') !== normVal(confirmingBomModal.docType || (isDcOrder ? 'DC' : 'Invoice'))) {
        nextEditedFields.docType = `${normVal(prevBomRec.docType) || 'Invoice'} → ${normVal(confirmingBomModal.docType) || 'Invoice'}`;
      }
      if (normVal(prevBomRec.customerName) !== normVal(confirmingBomModal.customerName)) {
        nextEditedFields.customerName = `${normVal(prevBomRec.customerName) || '—'} → ${normVal(confirmingBomModal.customerName) || '—'}`;
      }
      if (normVal(prevBomRec.companyName) !== normVal(confirmingBomModal.companyName)) {
        nextEditedFields.companyName = `${normVal(prevBomRec.companyName) || '—'} → ${normVal(confirmingBomModal.companyName) || '—'}`;
      }
      if (normVal(prevBomRec.contactPerson) !== normVal(confirmingBomModal.contactPerson)) {
        nextEditedFields.contactPerson = `${normVal(prevBomRec.contactPerson) || '—'} → ${normVal(confirmingBomModal.contactPerson) || '—'}`;
      }
      if (normVal(prevBomRec.mobile || prevBomRec.phone) !== normVal(confirmingBomModal.mobile || confirmingBomModal.phone)) {
        nextEditedFields.mobile = `${normVal(prevBomRec.mobile || prevBomRec.phone) || '—'} → ${normVal(confirmingBomModal.mobile || confirmingBomModal.phone) || '—'}`;
      }
      if (normVal(prevBomRec.email) !== normVal(confirmingBomModal.email)) {
        nextEditedFields.email = `${normVal(prevBomRec.email) || '—'} → ${normVal(confirmingBomModal.email) || '—'}`;
      }
      if (normVal(prevBomRec.gstNo || prevBomRec.gstin) !== normVal(confirmingBomModal.gstNo || confirmingBomModal.gstin)) {
        nextEditedFields.gstNo = `${normVal(prevBomRec.gstNo || prevBomRec.gstin) || '—'} → ${normVal(confirmingBomModal.gstNo || confirmingBomModal.gstin) || '—'}`;
      }
      if (normVal(prevBomRec.paymentType) !== normVal(normalizedPayType)) {
        nextEditedFields.paymentType = `${normVal(prevBomRec.paymentType) || '—'} → ${normVal(normalizedPayType) || '—'}`;
      }
      if (normalizedPayType === 'Credit Payment' && normVal(prevBomRec.creditDays) !== normVal(confirmingBomModal.creditDays || 7)) {
        nextEditedFields.creditDays = `${normVal(prevBomRec.creditDays) || '7'} → ${normVal(confirmingBomModal.creditDays || 7)}`;
      }
      if (normVal(prevBomRec.billingAddress) !== normVal(bStr)) {
        nextEditedFields.billingAddress = 'Updated during BOM confirmation';
      }
      if (normVal(prevBomRec.deliveryAddress) !== normVal(dStr)) {
        nextEditedFields.deliveryAddress = 'Updated during BOM confirmation';
      }
      if (normVal(prevBomRec.transportMode) !== normVal(confirmingBomModal.transportMode)) {
        nextEditedFields.transportMode = `${normVal(prevBomRec.transportMode) || '—'} → ${normVal(confirmingBomModal.transportMode) || '—'}`;
      }
      if (normVal(prevBomRec.transporterName) !== normVal(confirmingBomModal.transporterName)) {
        nextEditedFields.transporterName = `${normVal(prevBomRec.transporterName) || '—'} → ${normVal(confirmingBomModal.transporterName) || '—'}`;
      }
      if (normVal(prevBomRec.destination) !== normVal(confirmingBomModal.destination)) {
        nextEditedFields.destination = `${normVal(prevBomRec.destination) || '—'} → ${normVal(confirmingBomModal.destination) || '—'}`;
      }
      if (normVal(prevBomRec.transportScope) !== normVal(confirmingBomModal.transportScope)) {
        nextEditedFields.transportScope = `${normVal(prevBomRec.transportScope) || '—'} → ${normVal(confirmingBomModal.transportScope) || '—'}`;
      }
      if (normVal(prevBomRec.remarks) !== normVal(confirmingBomModal.remarks)) {
        nextEditedFields.remarks = 'Updated during BOM confirmation';
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
          if (Number(resolveBomItemDispatchQty(prevIt, prevBomRec) || 0) !== Number(it.totalDispatchQty || 0)) {
            diffs.push(`Dispatch Qty: ${resolveBomItemDispatchQty(prevIt, prevBomRec) || 0} → ${it.totalDispatchQty || 0}`);
          }
          if (Number(prevIt.rate || 0) !== Number(it.rate || 0)) {
            diffs.push(`Rate: ₹${Number(prevIt.rate || 0).toLocaleString('en-IN')} → ₹${Number(it.rate || 0).toLocaleString('en-IN')}`);
          }
          if (normVal(prevIt.uom || prevIt.unit) !== normVal(it.uom || it.unit)) {
            diffs.push(`UOM: ${normVal(prevIt.uom || prevIt.unit)} → ${normVal(it.uom || it.unit)}`);
          }
          if (extractGstRate(prevIt.gstRate, 18) !== extractGstRate(it.gstRate, 18)) {
            diffs.push(`GST: ${extractGstRate(prevIt.gstRate, 18)}% → ${extractGstRate(it.gstRate, 18)}%`);
          }
          if (normVal(prevIt.category || prevIt.specs) !== normVal(it.category || it.specs)) {
            diffs.push('Description updated');
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
    const resolvedCreditDays = normalizedPayType === 'Credit Payment' ? (parseInt(confirmingBomModal.creditDays, 10) || 7) : null;
    const isPartialPay = normalizedPayType === 'Partial Paid' || normalizedPayType === 'Partial Payment';
    const partialAmtVal = isPartialPay ? (parseFloat(confirmingBomModal.partialAmount) || 0) : null;
    const balanceAmtVal = isPartialPay
      ? Math.max(0, orderGrandTotal - partialAmtVal)
      : (normalizedPayType === '100% Paid' ? 0 : orderGrandTotal);

    const savedPaymentDocs = isDcOrder ? [] : paymentProofList;
    const savedDeliveryDocs = isSameAsBillingActive ? [] : deliveryProofList;

    const updatedBomData = {
      ...confirmingBomModal,
      ...(hasAnyEdit ? { date: todayIso, bomDate: todayIso } : {}),
      deliveryDate: confirmingBomModal.deliveryDate || '',
      docType: confirmingBomModal.docType || (isDcOrder ? 'DC' : 'Invoice'),
      documentType: confirmingBomModal.docType || (isDcOrder ? 'DC' : 'Invoice'),
      invoiceType: (confirmingBomModal.docType || (isDcOrder ? 'DC' : 'Invoice')) === 'DC' ? 'DC' : 'Invoice',
      customerName: confirmingBomModal.customerName || confirmingBomModal.companyName || '',
      companyName: confirmingBomModal.companyName || bObj.companyName || confirmingBomModal.customerName || '',
      contactPerson: confirmingBomModal.contactPerson || '',
      mobile: confirmingBomModal.mobile || confirmingBomModal.phone || '',
      phone: confirmingBomModal.mobile || confirmingBomModal.phone || confirmingBomModal.mobile || '',
      email: confirmingBomModal.email || '',
      gstNo: confirmingBomModal.gstNo || confirmingBomModal.gstin || '',
      gstin: confirmingBomModal.gstNo || confirmingBomModal.gstin || '',
      billingAddress: bStr,
      billingAddressObj: bObj,
      billingStreet: bObj.address || '',
      billingCity: bObj.city || '',
      billingState: bObj.state || '',
      billingPincode: bObj.pincode || '',
      sameAsBilling: isSameAsBillingActive,
      deliveryAddress: dStr,
      deliveryAddressObj: finalDObj,
      deliveryStreet: finalDObj.address || '',
      deliveryCity: finalDObj.city || '',
      deliveryState: finalDObj.state || '',
      deliveryPincode: finalDObj.pincode || '',
      deliveryAddressProofDoc: savedDeliveryDocs[0] || null,
      deliveryAddressProofDocs: savedDeliveryDocs,
      paymentType: normalizedPayType,
      paymentTerms: normalizedPayType,
      piPaymentTerms: normalizedPayType,
      partialAmount: partialAmtVal,
      balanceAmount: balanceAmtVal,
      creditDays: resolvedCreditDays,
      creditDueDate: normalizedPayType === 'Credit Payment'
        ? (confirmingBomModal.creditDueDate || new Date(Date.now() + (resolvedCreditDays || 7) * 86400000).toISOString().split('T')[0])
        : null,
      paymentProofDoc: savedPaymentDocs[0] || null,
      paymentProofDocs: savedPaymentDocs,
      paymentProofAttached: savedPaymentDocs.length > 0 || Boolean(confirmingBomModal.paymentProofAttached),
      awaitingSalesPaymentProof: (normalizedPayType === 'Credit Payment' || savedPaymentDocs.length > 0) ? false : confirmingBomModal.awaitingSalesPaymentProof,
      pendingSalesDispatchPayment: (normalizedPayType === 'Credit Payment' || savedPaymentDocs.length > 0) ? false : confirmingBomModal.pendingSalesDispatchPayment,
      status: (!confirmAndSend && typeof confirmingBomModal.status === 'string' && confirmingBomModal.status.toLowerCase().includes('awaiting sales payment proof') && (normalizedPayType === 'Credit Payment' || savedPaymentDocs.length > 0))
        ? 'Dispatch Packing Verified - Sent to Accounts'
        : confirmingBomModal.status,
      paymentUpdated: (normalizedPayType === '100% Paid' || isPartialPay) && savedPaymentDocs.length > 0,
      payments: confirmingBomModal.payments
        ? {
            ...confirmingBomModal.payments,
            proofDocObj: savedPaymentDocs[0] || null,
            proofDocObjs: savedPaymentDocs
          }
        : (savedPaymentDocs.length > 0
            ? { proofDocObj: savedPaymentDocs[0] || null, proofDocObjs: savedPaymentDocs }
            : undefined),
      transportMode: confirmingBomModal.transportMode || '',
      transporterName: confirmingBomModal.transporterName || '',
      destination: confirmingBomModal.destination || '',
      transportScope: confirmingBomModal.transportScope || '',
      remarks: confirmingBomModal.remarks || '',
      presetGroups: modalPresetGroups,
      ...(modalPresetGroups.length > 0
        ? {
            presetName: modalPresetGroups[0].presetName || confirmingBomModal.presetName || '',
            presetSetCount: modalPresetGroups[0].setCount || 1,
            presetUnit: modalPresetGroups[0].unitType || modalPresetGroups[0].unit || 'Sets',
            presetKitPrice: modalPresetGroups.length === 1 ? (modalPresetGroups[0].kitPrice ?? 0) : confirmingBomModal.presetKitPrice
          }
        : {
            presetName: '',
            presetSetCount: 1,
            presetUnit: 'Sets',
            presetKitPrice: 0
          }),
      items: diffedItems,
      ...(hasAnyEdit ? {
        isEdited: true,
        editedFields: nextEditedFields,
        lastEditedAt: new Date().toISOString(),
        lastEditedBy: confirmingBomModal.lastEditedBy || defaultSalesPersonName
      } : {}),
      salesPerson: (confirmingBomModal.salesPerson || confirmingBomModal.createdBy || 'Sales Department').replace(/\s*\([^)]*\)/g, '').trim(),
      subTotal: orderSubTotal,
      gstAmount: orderGstAmount,
      grandTotal: orderGrandTotal
    };

    if (confirmAndSend) {
      return {
        updatedBomData: {
          ...updatedBomData,
          dispatchPacking: packingItems,
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
          addressProofReuploadRequested: false
        },
        finalizedItems
      };
    }

    return {
      updatedBomData: {
        ...updatedBomData,
        status: confirmingBomModal.status === 'Draft' ? 'Draft' : 'Edited / Pending Confirmation',
        salesConfirmed: false,
        salesReconfirmed: false,
        isSentToDispatch: false,
        stockBlocked: Boolean(confirmingBomModal.stockBlocked),
        stockDeducted: Boolean(confirmingBomModal.stockDeducted)
      },
      finalizedItems
    };
  };

  const handleAddPresetInReconfirm = (presetId, targetPreset, setsCount = 1) => {
    if (!targetPreset || !targetPreset.items || targetPreset.items.length === 0) return;
    const groupId = 'preset_grp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const isKw = String(targetPreset.label || presetId || '').toLowerCase().includes('kw');
    const multiplier = Math.max(0.01, parseFloat(setsCount) || 1);
    const pUnit = targetPreset.unit || (isKw ? 'kW' : 'Sets');

    let defaultPrice = '';
    if (targetPreset.price || targetPreset.rate) {
      defaultPrice = String(targetPreset.price || targetPreset.rate);
    } else {
      const origSum = targetPreset.items.reduce((acc, it) => acc + (parseFloat(it.qty || 1) * parseFloat(it.rate || 0)), 0);
      defaultPrice = origSum > 0 ? String(origSum) : '';
    }

    const presetName = targetPreset.label || presetId;
    const isDcrBosKit = targetPreset.category === 'DCR BOS Solar Kits' || targetPreset.category === 'BOS Solar Kits' || (targetPreset.label && targetPreset.label.includes('BOS KITS'));
    const initialGstRate = isDcrBosKit ? '5%' : (targetPreset.gstRate || targetPreset.gst || '18%');

    const newGroup = {
      groupId,
      presetId,
      presetName,
      setCount: multiplier,
      sets: multiplier,
      unit: pUnit,
      unitType: pUnit,
      kitPrice: defaultPrice,
      gstRate: initialGstRate
    };

    const existingGroups = modalPresetGroups.map((g, gi) => ({
      ...g,
      groupId: g.groupId || g.presetGroupId || g.presetId || (gi === 0 ? 'default_kit' : `preset_grp_${gi}`)
    }));
    const nextGroups = [...existingGroups, newGroup];

    const newItems = targetPreset.items.map(it => {
      const rawQ = it.qty !== undefined && it.qty !== null ? String(it.qty).trim() : '';
      const hasQty = rawQ !== '' && rawQ !== '0' && !isNaN(parseFloat(rawQ));
      const baseQ = hasQty ? parseFloat(rawQ) : '';
      const matchedCatalog = (itemsList || []).find(ci => ci.name && ci.name.toLowerCase().trim() === String(it.name || '').toLowerCase().trim()) || (VRM_PRODUCTS || []).find(vp => vp.name && vp.name.toLowerCase().trim() === String(it.name || '').toLowerCase().trim());
      const resolvedCode = it.code || (matchedCatalog ? matchedCatalog.code : '');
      const resolvedUom = resolveDefaultUom(it.name, it.uom || it.unit || matchedCatalog?.uom || matchedCatalog?.unit || 'NOS');
      const itemDraft = {
        ...it,
        code: resolvedCode,
        uom: resolvedUom,
        unit: resolvedUom,
        presetGroupId: groupId,
        presetId,
        presetName,
        baseQty: baseQ,
        qty: hasQty ? String(baseQ) : '1',
        qtyPerSet: hasQty ? String(baseQ) : '1',
        rate: '0',
        gstRate: isDcrBosKit ? '5%' : (it.gstRate || initialGstRate),
        isPresetItem: true,
        confirmed: false
      };
      itemDraft.totalDispatchQty = calculateTotalDispatchQty(
        itemDraft,
        multiplier,
        presetName,
        targetPreset.category || it.category,
        pUnit
      );
      return itemDraft;
    });

    setConfirmingBomModal(prev => ({
      ...prev,
      presetGroups: nextGroups,
      presetName: nextGroups.length === 1 ? presetName : (prev.presetName || presetName),
      items: [...(prev.items || []), ...newItems]
    }));
    setSelectedPresetPicker('');
  };

  const handleAddReconfirmPresetItem = (groupId) => {
    if (!groupId) return;
    const grp = modalPresetGroups.find(g => g.groupId === groupId) || {};
    setConfirmingBomModal(prev => {
      const list = [...(prev.items || [])];
      let lastIdx = -1;
      list.forEach((it, idx) => {
        if ((it.presetGroupId || 'legacy_default') === groupId) lastIdx = idx;
      });
      const newItem = {
        name: '',
        category: '',
        specs: '',
        uom: 'NOS',
        unit: 'NOS',
        qty: 1,
        baseQty: 1,
        rate: 0,
        gstRate: grp.gstRate || '18%',
        isPresetItem: true,
        presetGroupId: groupId,
        presetName: grp.presetName || prev.presetName || '',
        confirmed: false
      };
      if (lastIdx >= 0) {
        list.splice(lastIdx + 1, 0, newItem);
      } else {
        list.push(newItem);
      }
      return { ...prev, items: list };
    });
  };

  const handleUploadReconfirmDeliveryProofs = async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (files.length === 0) return;
    const bCode = confirmingBomModal.bomCode || confirmingBomModal.code || confirmingBomModal.id;
    setIsUploadingProof(true);
    try {
      const uploaded = [];
      for (const file of files) {
        validateClientFile(file);
        const metadata = await uploadBomDocumentFile({
          file,
          bomCode: bCode,
          category: 'delivery-proof'
        });
        uploaded.push({
          ...metadata,
          uploadedAt: new Date().toISOString()
        });
      }
      const prevSingle = confirmingBomModal.deliveryAddressProofDoc;
      const prevDocs = Array.isArray(confirmingBomModal.deliveryAddressProofDocs) && confirmingBomModal.deliveryAddressProofDocs.length > 0
        ? confirmingBomModal.deliveryAddressProofDocs
        : (prevSingle ? [prevSingle] : []);
      const existingHistory = Array.isArray(prevSingle?.history) ? prevSingle.history : [];
      const updatedHistory = prevSingle && existingHistory.length === 0 && uploaded.length > 0
        ? [{
            name: prevSingle.name || prevSingle.originalName,
            size: prevSingle.size,
            storageBucket: prevSingle.storageBucket,
            storagePath: prevSingle.storagePath,
            uploadedAt: prevSingle.uploadedAt || new Date().toISOString()
          }]
        : existingHistory;
      const nextDocs = [...prevDocs, ...uploaded];
      const latestDoc = uploaded[uploaded.length - 1] || nextDocs[0];
      const nextStatus = confirmingBomModal.status === 'Address Proof Requested from Sales'
        ? (confirmingBomModal.previousStatusBeforeAddressProof || 'Sales Confirmed - Sent to Dispatch')
        : confirmingBomModal.status;
      const nextModalRecord = {
        ...confirmingBomModal,
        status: nextStatus,
        addressProofReuploadRequested: false,
        addressProofUpdatedAt: new Date().toISOString(),
        deliveryAddressProofDocs: nextDocs,
        deliveryAddressProofDoc: {
          ...latestDoc,
          history: updatedHistory
        }
      };
      setConfirmingBomModal(nextModalRecord);

      if (isAlreadyForwarded) {
        updateBomInStores(nextModalRecord);
        const saveRes = await persistBomToServer(nextModalRecord);
        if (!saveRes || !saveRes.ok) {
          const errJson = saveRes ? await saveRes.json().catch(() => null) : null;
          alert(`⚠️ Address proof uploaded, but failed to update BOM on server (HTTP ${saveRes?.status || 'Network Error'}): ${errJson?.error || errJson?.message || 'Please try again.'}`);
          return;
        }
        try {
          window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: { bom: nextModalRecord } }));
          window.dispatchEvent(new Event('controlroom_storage_update'));
        } catch (_) {}
        alert(`✅ Verified Address Proof uploaded and updated for BOM (${bCode})!`);
      }
    } catch (err) {
      alert(`⚠️ Cannot Proceed: ${err.message}`);
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleRemoveReconfirmDeliveryProof = (removeIdx) => {
    setConfirmingBomModal(prev => {
      const prevDocs = (Array.isArray(prev.deliveryAddressProofDocs) && prev.deliveryAddressProofDocs.length > 0)
        ? prev.deliveryAddressProofDocs
        : (prev.deliveryAddressProofDoc ? [prev.deliveryAddressProofDoc] : []);
      const nextDocs = prevDocs.filter((_, idx) => idx !== removeIdx);
      return {
        ...prev,
        deliveryAddressProofDocs: nextDocs,
        deliveryAddressProofDoc: nextDocs[0] || null
      };
    });
  };

  const handleUploadReconfirmPaymentProofs = async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (files.length === 0) return;
    const bCode = confirmingBomModal.bomCode || confirmingBomModal.code || confirmingBomModal.id;
    setIsUploadingProof(true);
    try {
      const uploaded = [];
      for (const file of files) {
        validateClientFile(file);
        const metadata = await uploadBomDocumentFile({
          file,
          bomCode: bCode,
          category: 'payment-proof'
        });
        uploaded.push({
          ...metadata,
          uploadedAt: new Date().toISOString()
        });
      }
      setConfirmingBomModal(prev => {
        const currentDocs = (Array.isArray(prev.paymentProofDocs) && prev.paymentProofDocs.length > 0)
          ? prev.paymentProofDocs
          : (prev.paymentProofDoc ? [prev.paymentProofDoc] : []);
        const nextDocs = [...currentDocs, ...uploaded];
        return {
          ...prev,
          paymentProofDocs: nextDocs,
          paymentProofDoc: nextDocs[0] || null,
          payments: {
            ...(prev.payments || {}),
            proofDocObjs: nextDocs,
            proofDocObj: nextDocs[0] || null
          }
        };
      });
    } catch (err) {
      alert(`⚠️ Cannot Proceed: ${err.message}`);
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleRemoveReconfirmPaymentProof = (removeIdx) => {
    setConfirmingBomModal(prev => {
      const currentDocs = (Array.isArray(prev.paymentProofDocs) && prev.paymentProofDocs.length > 0)
        ? prev.paymentProofDocs
        : (Array.isArray(prev.payments?.proofDocObjs) && prev.payments.proofDocObjs.length > 0
            ? prev.payments.proofDocObjs
            : (prev.paymentProofDoc ? [prev.paymentProofDoc] : []));
      const nextDocs = currentDocs.filter((_, idx) => idx !== removeIdx);
      return {
        ...prev,
        paymentProofDocs: nextDocs,
        paymentProofDoc: nextDocs[0] || null,
        payments: {
          ...(prev.payments || {}),
          proofDocObjs: nextDocs,
          proofDocObj: nextDocs[0] || null
        }
      };
    });
  };

  const handleSaveBomChanges = async () => {
    if (isSavingDraft || isConfirmingForward) return;
    if (!confirmingBomModal.items || confirmingBomModal.items.length === 0) {
      alert('⚠️ Please keep at least one product or preset item in the BOM before saving.');
      return;
    }
    if (!isDcOrder && normalizedPayType === 'Credit Payment' && !reconfirmCreditEval.canUseCredit) {
      alert(`⛔ Credit Payment Blocked\n\n${reconfirmCreditEval.reason}`);
      return;
    }
    setIsSavingDraft(true);
    try {
      const { updatedBomData } = buildUpdatedBomPayload(confirmingBomModal.items || [], { confirmAndSend: false });
      const saveRes = await persistBomToServer(updatedBomData);
      if (!saveRes || !saveRes.ok) {
        const errJson = saveRes ? await saveRes.json().catch(() => null) : null;
        alert(`⚠️ Failed to save BOM changes (HTTP ${saveRes?.status || 'Network Error'}): ${errJson?.error || errJson?.message || 'Please try again.'}`);
        return;
      }

      updateBomInStores(updatedBomData);
      try {
        window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: { bom: updatedBomData } }));
        window.dispatchEvent(new Event('controlroom_storage_update'));
      } catch (_) {}

      setConfirmingBomModal(null);
      alert(`✅ BOM (${confirmingBomModal.bomCode}) changes saved!`);
    } catch (err) {
      console.error('Error saving BOM draft changes:', err);
      alert(`⚠️ Failed to save BOM changes: ${err?.message || 'Unexpected error. Please try again.'}`);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleConfirmAndSendToDispatch = async (itemsOverride = null) => {
    const currentItemsList = itemsOverride || (confirmingBomModal.items || []);
    const unconfirmedItems = currentItemsList.filter(it => !it.confirmed);
    if (unconfirmedItems.length > 0) {
      alert(`⚠️ Please confirm all products first!\n\n${unconfirmedItems.length} product(s) still need to be verified with the tick mark (✓) or click "Confirm and Send" below before sending BOM to Dispatch.`);
      return;
    }

    const is100OrPartial = normalizedPayType === '100% Paid' || normalizedPayType === '100% Advance' || normalizedPayType === 'Partial Paid' || normalizedPayType === 'Partial Payment';
    const hasProof = Boolean(
      paymentProofList.length > 0 ||
      confirmingBomModal.paymentProofDoc ||
      confirmingBomModal.payments?.proofDocObj ||
      confirmingBomModal.payments?.proofDoc ||
      confirmingBomModal.proofDoc ||
      confirmingBomModal.proofDocData
    );
    if (!isDcOrder && is100OrPartial && !hasProof) {
      alert(`⚠️ Payment Attachment / Slip is strictly mandatory for "${normalizedPayType}"!\n\nPlease attach the bank slip/advice before sending this BOM to Dispatch.`);
      return;
    }
    if (isDcOrder && !String(confirmingBomModal.dcRemarks || '').trim()) {
      alert('⚠️ DC Remarks are mandatory.\n\nPlease enter why this order is going on a Delivery Challan (DC) before sending it to Dispatch.');
      document.getElementById('reconfirm-bom-dc-remarks')?.focus();
      return;
    }
    if (!isDcOrder && normalizedPayType === 'Credit Payment' && !reconfirmCreditEval.canUseCredit) {
      alert(`⛔ Credit Payment Blocked\n\n${reconfirmCreditEval.reason}`);
      return;
    }

    setIsConfirmingForward(true);
    try {
      const { updatedBomData, finalizedItems } = buildUpdatedBomPayload(currentItemsList, { confirmAndSend: true });

      // Ensure inventory is blocked upon verification if not already blocked
      if (!confirmingBomModal.stockBlocked && !confirmingBomModal.stockDeducted) {
        blockInventoryForBom(finalizedItems, confirmingBomModal.bomCode);
      }

      updateBomInStores(updatedBomData);
      try {
        const saveRes = await persistBomToServer(updatedBomData);
        if (!saveRes || !saveRes.ok) {
          const errJson = saveRes ? await saveRes.json().catch(() => null) : null;
          alert(`⚠️ Failed to confirm & send BOM to Dispatch (HTTP ${saveRes?.status || 'Network Error'}): ${errJson?.error || errJson?.message || 'Please try again.'}`);
          return;
        }
      } catch (err) {
        console.error('Error updating BOM to Dispatch:', err);
      }

      try {
        window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: { bom: updatedBomData } }));
        window.dispatchEvent(new Event('controlroom_storage_update'));
      } catch (_) {}

      // Trigger Real-time Workflow Notification with synthesized sound & deep-link to Dispatch Orders
      try {
        if (typeof notifyBomSentToDispatch === 'function') {
          notifyBomSentToDispatch({
            bomCode: confirmingBomModal.bomCode,
            customerName: updatedBomData.companyName || updatedBomData.customerName,
            salesPerson: updatedBomData.salesPerson
          });
        }
      } catch (nErr) {
        console.warn('notifyBomSentToDispatch non-fatal:', nErr);
      }

      setConfirmingBomModal(null);
      alert(`BOM (${confirmingBomModal.bomCode}) successfully verified by Sales and forwarded to Dispatch!`);
    } catch (outerErr) {
      console.error('handleConfirmAndSendToDispatch failed:', outerErr);
      alert(`⚠️ Could not confirm & send BOM to Dispatch: ${outerErr?.message || 'Unexpected error. Please try again.'}`);
    } finally {
      setIsConfirmingForward(false);
    }
  };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', fontFamily: "'DM Sans', sans-serif", backgroundColor: '#F8FAFC', padding: '24px', borderRadius: '16px', boxSizing: 'border-box' }}>
        {/* Top Blue Gradient Page Title Bar (Same as Create BOM) */}
        <div style={{
          background: 'linear-gradient(135deg, #075985 0%, #0E7490 50%, #0891B2 100%)',
          borderRadius: '18px',
          padding: '24px 28px',
          color: '#FFFFFF',
          boxShadow: '0 10px 25px -5px rgba(14, 116, 144, 0.4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart style={{ width: '24px', height: '24px', color: '#FFFFFF' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#FFFFFF', margin: 0, letterSpacing: '-0.3px' }}>
                  {isCancelled
                    ? `BOM Order (Cancelled) — ${confirmingBomModal.bomCode}`
                    : (isAlreadyForwarded ? `BOM Details & Order Summary — ${confirmingBomModal.bomCode}` : `Sales Reconfirmation — ${confirmingBomModal.bomCode}`)}
                </h1>
                <span style={{
                  backgroundColor: isCancelled ? '#FEE2E2' : (isAlreadyForwarded ? '#DCFCE7' : '#FEF3C7'),
                  color: isCancelled ? '#DC2626' : (isAlreadyForwarded ? '#166534' : '#B45309'),
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: '800'
                }}>
                  {confirmingBomModal.status}
                </span>
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
                    backgroundColor: 'rgba(255,255,255,0.2)', color: '#FFFFFF',
                    fontSize: '11px', fontWeight: '800', padding: '3px 10px',
                    borderRadius: '12px', border: '1px solid rgba(255,255,255,0.4)',
                    display: 'inline-flex', alignItems: 'center', gap: '4px'
                  }}>
                    EXECUTIVE VIEW ONLY
                  </span>
                )}
              </div>
              <p style={{ fontSize: '13px', color: '#CFFAFE', margin: '4px 0 0 0' }}>
                {isCancelled
                  ? 'This BOM was cancelled and reserved stock was released back into inventory.'
                  : (isAlreadyForwarded
                    ? 'Review verified bill of materials, product breakdown, and order specifications.'
                    : 'Verify order details, tick every product item checkbox, and forward to Dispatch.')}
              </p>
            </div>
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
                  border: '1px solid rgba(255,255,255,0.35)',
                  backgroundColor: 'rgba(255,255,255,0.16)',
                  color: 'white',
                  height: '40px',
                  padding: '0 18px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <CreditCard style={{ width: '15px', height: '15px' }} /> Update Payment Details
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
        {/* SECTION 1: ORDER INFORMATION (Same card format as Create BOM) */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              1
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ORDER INFORMATION
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
            <div>
              <label htmlFor="reconfirm-bom-order-date" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Order Date
              </label>
              <input
                id="reconfirm-bom-order-date"
                type="text"
                readOnly
                disabled
                value={confirmingBomModal.date || confirmingBomModal.bomDate || (confirmingBomModal.createdAt ? String(confirmingBomModal.createdAt).split('T')[0] : '—')}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', fontWeight: '600', color: '#64748B', backgroundColor: '#F1F5F9', cursor: 'not-allowed', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div>
              <label htmlFor="reconfirm-bom-delivery-date" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Delivery Date <span style={{ color: '#EF4444' }}>*</span>
              </label>
              {isAlreadyForwarded ? (
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', height: '42px', display: 'flex', alignItems: 'center', backgroundColor: '#F8FAFC', padding: '0 14px', borderRadius: '10px', border: '1px solid #E2E8F0', boxSizing: 'border-box' }}>
                  {confirmingBomModal.deliveryDate || '—'}
                </div>
              ) : (
                <input
                  id="reconfirm-bom-delivery-date"
                  name="deliveryDate"
                  aria-label="Delivery Date"
                  type="date"
                  value={confirmingBomModal.deliveryDate || ''}
                  onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, deliveryDate: e.target.value })}
                  style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                />
              )}
            </div>

            <div>
              <label htmlFor="reconfirm-bom-doc-type" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Document Type <span style={{ color: '#EF4444' }}>*</span>
              </label>
              {isAlreadyForwarded ? (
                <div style={{ height: '42px', display: 'flex', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '800',
                    padding: '6px 12px',
                    borderRadius: '10px',
                    backgroundColor: isDcOrder ? '#FFFBEB' : '#F0FDFA',
                    color: isDcOrder ? '#92400E' : '#0E7490',
                    border: isDcOrder ? '1px solid #FCD34D' : '1px solid #99F6E4'
                  }}>
                    {isDcOrder ? 'DC (Delivery Challan)' : 'Invoice (Official Tax Invoice)'}
                  </span>
                </div>
              ) : (
                <select
                  id="reconfirm-bom-doc-type"
                  name="docType"
                  aria-label="Document Type"
                  value={isDcOrder ? 'DC' : 'Invoice'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setConfirmingBomModal(prev => ({
                      ...prev,
                      docType: val,
                      documentType: val,
                      invoiceType: val === 'DC' ? 'DC' : 'Invoice',
                      ...(val === 'DC'
                        ? {
                            _prevPaymentType: prev.paymentType || normalizedPayType,
                            paymentType: '100% Paid'
                          }
                        : {
                            paymentType: prev._prevPaymentType || normalizedPayType || '100% Paid',
                            _prevPaymentType: undefined
                          })
                    }));
                  }}
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    border: isDcOrder ? '1.5px solid #F59E0B' : '1.5px solid #0E7490',
                    backgroundColor: isDcOrder ? '#FFFBEB' : '#F0FDFA',
                    padding: '0 14px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: isDcOrder ? '#92400E' : '#0E7490',
                    boxSizing: 'border-box',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="Invoice">Invoice (Official Tax Invoice)</option>
                  <option value="DC">DC (Delivery Challan)</option>
                </select>
              )}
              {isDcOrder && (isAlreadyForwarded ? (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#92400E' }}>
                  <strong>DC Remarks:</strong> {confirmingBomModal.dcRemarks || '—'}
                </div>
              ) : (
                <textarea
                  id="reconfirm-bom-dc-remarks"
                  name="dcRemarks"
                  aria-label="DC Remarks"
                  placeholder="DC Remarks (required): why is this order going on a Delivery Challan?"
                  value={confirmingBomModal.dcRemarks || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setConfirmingBomModal(prev => ({ ...prev, dcRemarks: val }));
                  }}
                  rows={2}
                  style={{ width: '100%', marginTop: '6px', borderRadius: '8px', border: String(confirmingBomModal.dcRemarks || '').trim() ? '1.5px solid #F59E0B' : '1.5px solid #EF4444', backgroundColor: '#FFFBEB', padding: '8px 10px', fontSize: '12.5px', color: '#92400E', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
                />
              ))}
            </div>

            <div>
              <label htmlFor="reconfirm-bom-order-number" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Order Number
              </label>
              <input
                id="reconfirm-bom-order-number"
                type="text"
                readOnly
                disabled
                value={confirmingBomModal.bomCode || confirmingBomModal.code || '—'}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CCFAFE', padding: '0 14px', fontSize: '13px', fontWeight: '800', color: '#0E7490', backgroundColor: '#F0FDFA', cursor: 'not-allowed', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Sales Person / Creator <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                readOnly
                disabled
                value={(confirmingBomModal.salesPerson || confirmingBomModal.createdBy || defaultSalesPersonName).replace(/\s*\([^)]*\)/g, '').trim()}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', fontWeight: '700', color: '#475569', backgroundColor: '#F1F5F9', cursor: 'not-allowed', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: CUSTOMER INFORMATION & ADDRESSES (Same card format as Create BOM) */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              2
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              CUSTOMER INFORMATION & ADDRESSES
            </h3>
          </div>

          {/* Row 1: 5-Column Customer Contact Details */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <label htmlFor="bom-orders-company-name" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Company Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              {isAlreadyForwarded ? (
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', height: '42px', display: 'flex', alignItems: 'center', backgroundColor: '#F8FAFC', padding: '0 14px', borderRadius: '10px', border: '1px solid #E2E8F0', boxSizing: 'border-box' }}>
                  {confirmingBomModal.companyName || confirmingBomModal.customerName || '—'}
                </div>
              ) : (
                <>
                  <input
                    id="bom-orders-company-name"
                    name="companyName"
                    aria-label="Company Name"
                    type="text"
                    list="reconfirm-bom-customer-suggestions"
                    placeholder="Type or select company..."
                    value={confirmingBomModal.companyName || confirmingBomModal.customerName || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConfirmingBomModal(prev => ({ ...prev, companyName: val, customerName: val }));
                      const target = (val || '').toLowerCase().trim();
                      if (!target) return;

                      if (target.length >= 2 && bomCustSearchTimerRef) {
                        clearTimeout(bomCustSearchTimerRef.current);
                        bomCustSearchTimerRef.current = setTimeout(async () => {
                          try {
                            const matches = await searchCustomers({ query: val, limit: 50 });
                            if (Array.isArray(matches) && matches.length > 0 && typeof setCustomerList === 'function') {
                              setCustomerList(prev => {
                                const map = new Map();
                                (prev || []).forEach(p => {
                                  const k = (p.customerCode || p.id || p.code || p.companyName || '').toLowerCase().trim();
                                  if (k) map.set(k, p);
                                });
                                matches.forEach(m => {
                                  const k = (m.customerCode || m.id || m.code || m.companyName || '').toLowerCase().trim();
                                  if (k && !map.has(k)) map.set(k, m);
                                });
                                return Array.from(map.values());
                              });
                            }
                          } catch (_) {}
                        }, 250);
                      }

                      const chosen = (customerList || []).find(c => {
                        const code = (c.code || c.customerCode || '').toLowerCase().trim();
                        const c2 = (c.c2 || c.companyName || '').toLowerCase().trim();
                        const cName = (c.customerName || '').toLowerCase().trim();
                        const comp = (c.companyName || '').toLowerCase().trim();
                        return code === target || c2 === target || cName === target || comp === target;
                      });

                      if (chosen) {
                        const nextCompany = chosen.c2 || chosen.companyName || chosen.customerName || chosen.code || val;
                        const nextContact = chosen.contact || chosen.contactPerson || chosen.primaryContact?.name || '';
                        const nextPhone = chosen.c4 || chosen.phone || chosen.mobile || chosen.primaryContact?.phone || chosen.primaryContact?.whatsapp || '';
                        const nextEmail = chosen.c5 || chosen.email || chosen.primaryContact?.email || '';
                        const nextGst = chosen.gst || chosen.gstNo || '';
                        const cBObj = chosen.billingAddressObj || {};
                        const cBAddr = cBObj.address || chosen.c6 || chosen.billingAddress || chosen.address || '';
                        const cBCity = cBObj.city || chosen.city || '';
                        const cBState = cBObj.state || chosen.state || '';
                        const cBPin = cBObj.pincode || chosen.pincode || '';
                        const nextBObj = { address: cBAddr, street: cBAddr, city: cBCity, state: cBState, pincode: cBPin };

                        const cDObj = chosen.deliveryAddressObj || {};
                        const cDAddr = cDObj.address || chosen.c7 || chosen.deliveryAddress || chosen.dispatchAddress || '';
                        const clean = (s) => String(s || '').trim().toLowerCase();
                        const isSame = !cDAddr || (
                          clean(cDAddr) === clean(cBAddr) &&
                          clean(cDObj.city || chosen.city || '') === clean(cBCity) &&
                          clean(cDObj.state || chosen.state || '') === clean(cBState) &&
                          clean(cDObj.pincode || chosen.pincode || '') === clean(cBPin)
                        );
                        const nextDObj = (!isSame && cDAddr)
                          ? {
                              address: cDAddr,
                              street: cDAddr,
                              city: cDObj.city || chosen.dispatchCity || chosen.city || '',
                              state: cDObj.state || chosen.dispatchState || chosen.state || '',
                              pincode: cDObj.pincode || chosen.dispatchPincode || chosen.pincode || ''
                            }
                          : { ...nextBObj };

                        setConfirmingBomModal(prev => ({
                          ...prev,
                          customerName: nextCompany,
                          companyName: nextCompany,
                          ...(nextContact ? { contactPerson: nextContact } : {}),
                          ...(nextPhone ? { mobile: nextPhone, phone: nextPhone } : {}),
                          ...(nextEmail ? { email: nextEmail } : {}),
                          ...(nextGst ? { gstNo: nextGst, gstin: nextGst } : {}),
                          billingAddressObj: nextBObj,
                          billingStreet: nextBObj.address,
                          billingCity: nextBObj.city,
                          billingState: nextBObj.state,
                          billingPincode: nextBObj.pincode,
                          sameAsBilling: isSame,
                          deliveryAddressObj: nextDObj,
                          deliveryStreet: nextDObj.address,
                          deliveryCity: nextDObj.city,
                          deliveryState: nextDObj.state,
                          deliveryPincode: nextDObj.pincode
                        }));
                      }
                    }}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', fontWeight: '600', color: '#0F172A', backgroundColor: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
                  />
                  <datalist id="reconfirm-bom-customer-suggestions">
                    {(customerList || []).slice(0, 60).map((c, idx) => {
                      const cVal = c.companyName || c.c2 || c.customerName || c.code;
                      return <option key={idx} value={cVal}>{cVal}</option>;
                    })}
                  </datalist>
                </>
              )}
            </div>

            <div>
              <label htmlFor="reconfirm-bom-contact-person" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Customer Name
              </label>
              {isAlreadyForwarded ? (
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', height: '42px', display: 'flex', alignItems: 'center', backgroundColor: '#F8FAFC', padding: '0 14px', borderRadius: '10px', border: '1px solid #E2E8F0', boxSizing: 'border-box' }}>
                  {confirmingBomModal.contactPerson || '—'}
                </div>
              ) : (
                <input
                  id="reconfirm-bom-contact-person"
                  name="contactPerson"
                  aria-label="Customer Name"
                  type="text"
                  placeholder="e.g. Rajesh Kannan"
                  value={confirmingBomModal.contactPerson || ''}
                  onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, contactPerson: e.target.value })}
                  style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
                />
              )}
            </div>

            <div>
              <label htmlFor="reconfirm-bom-mobile" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Phone Number
              </label>
              {isAlreadyForwarded ? (
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', height: '42px', display: 'flex', alignItems: 'center', backgroundColor: '#F8FAFC', padding: '0 14px', borderRadius: '10px', border: '1px solid #E2E8F0', boxSizing: 'border-box' }}>
                  {confirmingBomModal.mobile || confirmingBomModal.phone || '—'}
                </div>
              ) : (
                <input
                  id="reconfirm-bom-mobile"
                  name="mobileNumber"
                  aria-label="Phone Number"
                  type="text"
                  placeholder="+91 98765 43210"
                  value={confirmingBomModal.mobile || confirmingBomModal.phone || ''}
                  onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, mobile: e.target.value, phone: e.target.value })}
                  style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
                />
              )}
            </div>

            <div>
              <label htmlFor="reconfirm-bom-email" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Email Address
              </label>
              {isAlreadyForwarded ? (
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', height: '42px', display: 'flex', alignItems: 'center', backgroundColor: '#F8FAFC', padding: '0 14px', borderRadius: '10px', border: '1px solid #E2E8F0', boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {confirmingBomModal.email || '—'}
                </div>
              ) : (
                <input
                  id="reconfirm-bom-email"
                  name="email"
                  aria-label="Email Address"
                  type="email"
                  placeholder="accounts@solarclient.com"
                  value={confirmingBomModal.email || ''}
                  onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, email: e.target.value })}
                  style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
                />
              )}
            </div>

            <div>
              <label htmlFor="reconfirm-bom-gstin" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Customer GSTIN
              </label>
              {isAlreadyForwarded ? (
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0E7490', height: '42px', display: 'flex', alignItems: 'center', backgroundColor: '#F8FAFC', padding: '0 14px', borderRadius: '10px', border: '1px solid #E2E8F0', boxSizing: 'border-box' }}>
                  {confirmingBomModal.gstNo || confirmingBomModal.gstin || '—'}
                </div>
              ) : (
                <input
                  id="reconfirm-bom-gstin"
                  name="gstNo"
                  aria-label="Customer GSTIN"
                  type="text"
                  placeholder="e.g. 33AABCV1234F1Z5"
                  value={confirmingBomModal.gstNo || confirmingBomModal.gstin || ''}
                  onChange={(e) => {
                    const up = e.target.value.toUpperCase();
                    setConfirmingBomModal({ ...confirmingBomModal, gstNo: up, gstin: up });
                  }}
                  style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', fontWeight: '700', color: '#0F172A', backgroundColor: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
                />
              )}
            </div>
          </div>

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

            const isDeliveryMatching = isSameAsBillingActive || (
              ((dObj.address || '').trim() === (bObj.address || '').trim()) &&
              ((dObj.city || '').trim() === (bObj.city || '').trim()) &&
              ((dObj.state || '').trim() === (bObj.state || '').trim()) &&
              ((dObj.pincode || '').trim() === (bObj.pincode || '').trim())
            );

            const updateBillingField = (fieldKey, val) => {
              const nextB = {
                ...bObj,
                [fieldKey]: val,
                ...(fieldKey === 'address' ? { street: val } : {})
              };
              const nextD = isSameAsBillingActive ? { ...nextB } : dObj;
              setConfirmingBomModal({
                ...confirmingBomModal,
                billingAddressObj: nextB,
                billingStreet: nextB.address || '',
                billingCity: nextB.city || '',
                billingState: nextB.state || '',
                billingPincode: nextB.pincode || '',
                deliveryAddressObj: nextD,
                deliveryStreet: nextD.address || '',
                deliveryCity: nextD.city || '',
                deliveryState: nextD.state || '',
                deliveryPincode: nextD.pincode || ''
              });
            };

            const updateDeliveryField = (fieldKey, val) => {
              const nextD = {
                ...dObj,
                [fieldKey]: val,
                ...(fieldKey === 'address' ? { street: val } : {})
              };
              setConfirmingBomModal({
                ...confirmingBomModal,
                deliveryAddressObj: nextD,
                deliveryStreet: nextD.address || '',
                deliveryCity: nextD.city || '',
                deliveryState: nextD.state || '',
                deliveryPincode: nextD.pincode || ''
              });
            };

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
                      {deliveryProofList.length > 0 ? (
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {deliveryProofList.map((dDoc, dIdx) => (
                            <div key={dIdx} style={{ padding: '8px 12px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '700', color: '#166534' }}>
                                <FileText style={{ width: '13px', height: '13px' }} />
                                Address Proof{deliveryProofList.length > 1 ? ` #${dIdx + 1}` : ''}: {dDoc.name || 'Address Proof'}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => setPreviewDocModal({ title: `Delivery Address Proof${deliveryProofList.length > 1 ? ` #${dIdx + 1}` : ''}`, doc: dDoc })}
                                  style={{ border: '1px solid #BBF7D0', background: '#FFFFFF', color: '#166534', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Eye style={{ width: '12px', height: '12px' }} /> View Image
                                </button>
                                <span style={{ fontSize: '10px', color: '#15803D', fontWeight: '800' }}>Verified</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {!isCeo && (confirmingBomModal.addressProofReuploadRequested || confirmingBomModal.status === 'Address Proof Requested from Sales' || needsSalesAddressProof(confirmingBomModal)) && (
                        <div style={{ marginTop: '10px', padding: '12px 14px', backgroundColor: '#FEF2F2', border: '1.5px dashed #F87171', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#991B1B', fontSize: '12px', fontWeight: '800' }}>
                              <AlertCircle style={{ width: '14px', height: '14px', color: '#DC2626' }} />
                              <span>{(confirmingBomModal.addressProofReuploadRequested || confirmingBomModal.status === 'Address Proof Requested from Sales') ? 'Accounts Requested Verified Address Proof Re-upload' : 'Address Proof Missing — Delivery Address Differs from Billing'}</span>
                            </div>
                            {(() => {
                              const reqAt = confirmingBomModal.addressProofReuploadRequestedAt || confirmingBomModal.reuploadRequestedAt || confirmingBomModal.reissueRequestedAt;
                              let mLeft = null;
                              if (reqAt) {
                                const ONE_HOUR_MS = 60 * 60 * 1000;
                                mLeft = Math.max(0, Math.ceil((ONE_HOUR_MS - (Date.now() - new Date(reqAt).getTime())) / 60000));
                              }
                              return (
                                <span style={{ fontSize: '11px', fontWeight: '800', color: '#991B1B', backgroundColor: '#FEE2E2', padding: '2px 8px', borderRadius: '12px', border: '1px solid #FCA5A5' }}>
                                  ⏱️ 1-Hr SLA: {mLeft !== null ? `${mLeft}m remaining` : 'Active'}
                                </span>
                              );
                            })()}
                          </div>
                          <span style={{ fontSize: '11px', color: '#B91C1C' }}>
                            Upload the updated GST certificate, Electricity Bill, or Lease Agreement to clear the Accounts re-upload request.
                          </span>
                          <div>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#DC2626', color: '#FFFFFF', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: isUploadingProof ? 'wait' : 'pointer', opacity: isUploadingProof ? 0.7 : 1 }}>
                              <Upload style={{ width: '13px', height: '13px' }} />
                              {isUploadingProof ? 'Uploading Address Proof...' : 'Upload / Update Address Proof'}
                              <input
                                id="bom-reupload-address-proof-input"
                                name="reuploadAddressProof"
                                aria-label="Upload Updated Address Proof"
                                type="file"
                                multiple
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                style={{ display: 'none' }}
                                disabled={isUploadingProof}
                                onChange={async (e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    await handleUploadReconfirmDeliveryProofs(e.target.files);
                                    e.target.value = '';
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      )}
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
                      onChange={(e) => updateBillingField('address', e.target.value)}
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                     />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label htmlFor="bom-orders-city" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                      <input id="bom-orders-city" name="city" aria-label="City" type="text" placeholder="City..." value={bObj.city || ''} onChange={(e) => updateBillingField('city', e.target.value)} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }} />
                    </div>
                    <div>
                      <label htmlFor="bom-orders-state" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                      <input id="bom-orders-state" name="state" aria-label="State" type="text" placeholder="State..." value={bObj.state || ''} onChange={(e) => updateBillingField('state', e.target.value)} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }} />
                    </div>
                    <div>
                      <label htmlFor="bom-orders-pincode" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pincode</label>
                      <input id="bom-orders-pincode" name="pincode" aria-label="Pincode" type="text" placeholder="Pincode..." value={bObj.pincode || ''} onChange={(e) => updateBillingField('pincode', e.target.value)} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }} />
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
                        checked={isSameAsBillingActive}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          const nextD = checked ? { ...bObj } : dObj;
                          setConfirmingBomModal({
                            ...confirmingBomModal,
                            sameAsBilling: checked,
                            deliveryAddressObj: nextD,
                            deliveryStreet: nextD.address || '',
                            deliveryCity: nextD.city || '',
                            deliveryState: nextD.state || '',
                            deliveryPincode: nextD.pincode || ''
                          });
                        }}
                        style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                       />
                      Same as Billing
                    </label>
                  </div>

                  <div>
                    <label htmlFor="reconfirm-bom-delivery-address" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Address</label>
                    <input id="reconfirm-bom-delivery-address" name="deliveryAddress" aria-label="Delivery Address"
                      type="text"
                      placeholder="e.g. Plot No 42, SIDCO Industrial Estate"
                      value={isSameAsBillingActive ? (bObj.address || '') : (dObj.address || '')}
                      disabled={isSameAsBillingActive}
                      onChange={(e) => updateDeliveryField('address', e.target.value)}
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: isSameAsBillingActive ? '#64748B' : '#0F172A', backgroundColor: isSameAsBillingActive ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none', cursor: isSameAsBillingActive ? 'not-allowed' : 'text' }}
                     />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label htmlFor="reconfirm-bom-delivery-city" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                      <input id="reconfirm-bom-delivery-city" name="deliveryCity" aria-label="Delivery City" type="text" placeholder="e.g. Chennai" value={isSameAsBillingActive ? (bObj.city || '') : (dObj.city || '')} disabled={isSameAsBillingActive} onChange={(e) => updateDeliveryField('city', e.target.value)} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: isSameAsBillingActive ? '#64748B' : '#0F172A', backgroundColor: isSameAsBillingActive ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none' }} />
                    </div>
                    <div>
                      <label htmlFor="reconfirm-bom-delivery-state" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                      <input id="reconfirm-bom-delivery-state" name="deliveryState" aria-label="Delivery State" type="text" placeholder="e.g. Tamil Nadu" value={isSameAsBillingActive ? (bObj.state || '') : (dObj.state || '')} disabled={isSameAsBillingActive} onChange={(e) => updateDeliveryField('state', e.target.value)} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: isSameAsBillingActive ? '#64748B' : '#0F172A', backgroundColor: isSameAsBillingActive ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none' }} />
                    </div>
                    <div>
                      <label htmlFor="reconfirm-bom-delivery-pincode" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pincode</label>
                      <input id="reconfirm-bom-delivery-pincode" name="deliveryPincode" aria-label="Delivery Pincode" type="text" placeholder="e.g. 600058" value={isSameAsBillingActive ? (bObj.pincode || '') : (dObj.pincode || '')} disabled={isSameAsBillingActive} onChange={(e) => updateDeliveryField('pincode', e.target.value)} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: isSameAsBillingActive ? '#64748B' : '#0F172A', backgroundColor: isSameAsBillingActive ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none' }} />
                    </div>
                  </div>

                  {(!isDeliveryMatching || confirmingBomModal.addressProofReuploadRequested || confirmingBomModal.status === 'Address Proof Requested from Sales') ? (
                    <div style={{ marginTop: '6px', padding: '14px 16px', backgroundColor: '#FEF2F2', border: '1px dashed #F87171', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <AlertCircle style={{ width: '14px', height: '14px' }} />
                          </div>
                          <div>
                            <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>
                              Delivery Address Proof Document <span style={{ color: '#64748B', fontWeight: '600' }}>(Optional)</span>
                            </h5>
                            <span style={{ fontSize: '11px', color: '#64748B' }}>Upload proof images (GST / Electricity Bill / Lease Agreement) if available.</span>
                          </div>
                        </div>
                        {deliveryProofList.length > 0 && (
                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle style={{ width: '12px', height: '12px' }} /> {deliveryProofList.length} Attached
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

                      {deliveryProofList.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {deliveryProofList.map((dDoc, dIdx) => (
                            <div key={dIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: '8px 12px', borderRadius: '8px', border: '1px solid #FECACA', gap: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <FileText style={{ width: '15px', height: '15px', color: '#DC2626', flexShrink: 0 }} />
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {dDoc.name || `Proof #${dIdx + 1}`}
                                  </div>
                                  <div style={{ fontSize: '10px', color: '#64748B' }}>{dDoc.size || 'Attached'}</div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                <button
                                  type="button"
                                  onClick={() => setPreviewDocModal({ title: `Delivery Address Proof #${dIdx + 1}`, doc: dDoc })}
                                  style={{ border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Eye style={{ width: '12px', height: '12px' }} /> View
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveReconfirmDeliveryProof(dIdx)}
                                  title="Remove this document"
                                  style={{ border: 'none', background: '#FEE2E2', color: '#DC2626', padding: '5px 7px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Trash2 style={{ width: '12px', height: '12px' }} />
                                </button>
                              </div>
                            </div>
                          ))}

                          {confirmingBomModal.deliveryAddressProofDoc?.history && confirmingBomModal.deliveryAddressProofDoc.history.length > 0 && (
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

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', border: '1px solid #DC2626', color: '#DC2626', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: isUploadingProof ? 'wait' : 'pointer' }}>
                          <Upload style={{ width: '13px', height: '13px' }} />
                          {deliveryProofList.length > 0 ? '+ Add More Address Proofs' : 'Upload Address Proof Document(s)'}
                          <input id="bom-orders-input-4" name="input4" aria-label="Upload Address Proof Documents"
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            style={{ display: 'none' }}
                            disabled={isUploadingProof}
                            onChange={async (e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                await handleUploadReconfirmDeliveryProofs(e.target.files);
                                e.target.value = '';
                              }
                            }}
                           />
                        </label>
                      </div>
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
                        Dispatch Packed Items Media ({packPhotos.length} Photos)
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>3</div>
              <div>
                <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ORDER ITEMS & BILL OF MATERIALS
                </h3>
                <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                  {isAlreadyForwarded
                    ? 'Itemized specifications and rate breakdown passed to Production & Dispatch teams.'
                    : 'Tick every product item checkbox before confirming & forwarding to Dispatch.'}
                </span>
              </div>
            </div>

            {!isAlreadyForwarded && !isSourcePiLocked && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#ECFEFF', padding: '0 12px', borderRadius: '20px', height: '38px', border: '1px solid #CFFAFE' }}>
                  <Layers style={{ width: '14px', height: '14px', color: '#0E7490' }} />
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#0E7490' }}>Pack:</span>
                </div>

                <SearchablePresetSelector
                  value={selectedPresetPicker}
                  activePresetsMap={activePresetsMap}
                  accentColor="#0E7490"
                  width="320px"
                  placeholder="Pick a Pack to add..."
                  groupTitleLabel="Packs"
                  emptyLabel="packs"
                  style={{ height: '38px' }}
                  onChange={(val, targetPreset) => {
                    if (val && targetPreset && targetPreset.items) {
                      handleAddPresetInReconfirm(val, targetPreset, 1);
                    } else if (!val) {
                      setSelectedPresetPicker('');
                    }
                  }}
                />

                <button
                  type="button"
                  onClick={() => {
                    const currentItems = confirmingBomModal.items || [];
                    const updatedItems = [...currentItems, { name: '', category: '', specs: '', uom: 'NOS', unit: 'NOS', qty: 1, rate: 0, gstRate: '18%', confirmed: false }];
                    setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                  }}
                  style={{ border: '1px solid #A5F3FC', backgroundColor: '#ECFEFF', color: '#0E7490', height: '38px', padding: '0 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus style={{ width: '14px', height: '14px' }} /> Add New Product
                </button>
              </div>
            )}
          </div>

          {/* Active Preset Badges / Pills */}
          {!isAlreadyForwarded && modalPresetGroups.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '2px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B' }}>Active Presets in Order:</span>
              {modalPresetGroups.map((grp, gi) => {
                const grpGid = grp.groupId || grp.presetGroupId || grp.presetId || (gi === 0 ? 'default_kit' : `preset_grp_${gi}`);
                const grpSets = parseFloat(grp.setCount || grp.quantity || grp.sets) || 1;
                const grpUnit = grp.unitType || grp.unit || (String(grp.presetName || '').toLowerCase().includes('kw') ? 'kW' : 'Sets');
                return (
                  <span
                    key={grpGid}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#ECFEFF',
                      color: '#0E7490',
                      border: '1px solid #A5F3FC',
                      borderRadius: '16px',
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: '700'
                    }}
                  >
                    <Layers size={13} style={{ color: '#0E7490' }} />
                    {grp.presetName} ({grpSets} {grpUnit})
                    <button
                      type="button"
                      onClick={() => {
                        const nextGroups = modalPresetGroups
                          .map((g, gIdx) => ({ ...g, _k: g.groupId || g.presetGroupId || g.presetId || (gIdx === 0 ? 'default_kit' : `preset_grp_${gIdx}`) }))
                          .filter(g => g._k !== grpGid)
                          .map(({ _k, ...rest }) => rest);
                        const nextItems = (confirmingBomModal.items || []).filter(it => {
                          const itGid = it.presetGroupId || it.groupId || it.presetId || 'default_kit';
                          return itGid !== grpGid && !(modalPresetGroups.length === 1 && it.isPresetItem);
                        });
                        setConfirmingBomModal({
                          ...confirmingBomModal,
                          presetGroups: nextGroups,
                          items: nextItems,
                          ...(nextGroups.length === 0 ? { presetName: '', presetKitPrice: 0, presetSetCount: 1 } : {})
                        });
                      }}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0 0 0 2px', display: 'flex', alignItems: 'center', color: '#0891B2' }}
                      title={`Remove ${grp.presetName}`}
                    >
                      <X size={13} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

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
                  <th style={{ padding: '12px 10px', width: '24%' }}>Product / Item <span style={{ color: '#EF4444' }}>*</span></th>
                  <th style={{ padding: '12px 8px', width: '7%', textAlign: 'center' }}>UOM</th>
                  <th style={{ padding: '12px 8px', width: '7%', textAlign: 'center' }}>{modalPresetGroups.length > 0 ? 'Qty / Set' : 'Qty'}</th>
                  <th style={{ padding: '12px 10px', width: '11%', textAlign: 'center', color: '#0E7490', backgroundColor: '#ECFEFF' }}>Total Dispatch Qty</th>
                  <th style={{ padding: '12px 8px', width: '9%', textAlign: 'right' }}>Price (₹)</th>
                  <th style={{ padding: '12px 8px', width: '8%', textAlign: 'center' }}>GST Rate</th>
                  <th style={{ padding: '12px 10px', width: '12%', textAlign: 'center', color: '#0E7490', backgroundColor: '#ECFEFF' }}>Preset Amt (₹) <span style={{ color: '#EF4444' }}>*</span></th>
                  <th style={{ padding: '12px 8px', width: '9%', textAlign: 'right' }}>Taxable (₹)</th>
                  <th style={{ padding: '12px 8px', width: '9%', textAlign: 'right' }}>Total (₹)</th>
                  {!isAlreadyForwarded && <th style={{ padding: '12px 8px', width: '46px', textAlign: 'center' }}>Action</th>}
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
                    const firstMatchingItem = items.find(it => {
                      const itGid = it.presetGroupId || it.groupId || it.presetId || (it.presetName ? (modalPresetGroups.find(g => g.presetName === it.presetName)?.groupId) : null) || (modalPresetGroups.length === 1 ? (modalPresetGroups[0].groupId || modalPresetGroups[0].presetGroupId || 'default_kit') : null);
                      return itGid === gid;
                    });
                    const matchedGrp = modalPresetGroups.find(g => g.groupId === gid || g.presetGroupId === gid || g.presetId === gid || (gIdx === 0 && (gid === 'default_kit' || gid === 'preset_grp_0'))) || modalPresetGroups[gIdx] || {};
                    const sets = parseFloat(matchedGrp.setCount || matchedGrp.quantity || matchedGrp.sets) || 1;
                    const unitType = matchedGrp.unit || matchedGrp.unitType || (matchedGrp.isKwBased || String(matchedGrp.presetName || firstMatchingItem?.presetName || '').toLowerCase().includes('kw') ? 'kW' : 'Sets');
                    const price = cleanNum(matchedGrp.kitPrice) || (modalPresetGroups.length === 1 ? (presetKitsTotal / sets) : 0);
                    presetGroupMap[gid] = {
                      groupId: gid,
                      presetId: matchedGrp.presetId || firstMatchingItem?.presetId,
                      groupIndex: gIdx,
                      presetName: matchedGrp.presetName || firstMatchingItem?.presetName || (confirmingBomModal.presetName && gIdx === 0 ? confirmingBomModal.presetName : `Preset Package ${gIdx + 1}`),
                      setCount: sets,
                      unitType: unitType,
                      kitPrice: price,
                      gstRate: matchedGrp.gstRate || firstMatchingItem?.gstRate || '18%',
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

                    const colCount = isAlreadyForwarded ? 10 : 12;

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
                                      {String(theme.badge || 'PRESET 1').replace('PRESET', 'PACK')}
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
                                    {String(theme.badge || 'PRESET 1').replace('PRESET', 'PACK')} • Component {meta.itemIndexInGroup} of {pInfo ? pInfo.count : 1}
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
                                const isCustomSet = Boolean(
                                  item.isCustomSet ||
                                  pInfo?.isCustomSet ||
                                  pInfo?.presetId === 'custom_set' ||
                                  String(item.presetGroupId || '').startsWith('custom_set_') ||
                                  String(effectivePresetName || '').toLowerCase().includes('custom set')
                                );
                                const effectiveSetCount = isCustomSet ? 1 : (isSub ? (item.subSetCount || 1) : (pInfo?.setCount || confirmingBomModal.setCount || confirmingBomModal.presetSetCount || 1));
                                const totalDisp = isCustomSet
                                  ? (parseFloat(item.qty) || 0)
                                  : calculateTotalDispatchQty(
                                      { ...item, presetId: pInfo?.presetId || item.presetId, isCustomSet },
                                      effectiveSetCount,
                                      effectivePresetName,
                                      confirmingBomModal.category || item.category,
                                      effectiveUnit
                                    );
                                const isKw = isKwPreset(effectivePresetName, effectiveUnit, item);
                                const isRail = isRailPreset(effectivePresetName, confirmingBomModal.category || item.category, item.subPresetName, item.name);
                                const isTriangle = isTriangleDirectPreset(
                                  effectivePresetName,
                                  confirmingBomModal.category || item.category,
                                  item.subPresetName,
                                  pInfo?.presetId || item.presetId
                                );
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
                                      <span style={{ fontSize: '9px', color: (isKw || isRail || isTriangle) ? '#059669' : '#64748B', fontWeight: '600' }}>
                                        {isKw ? 'Direct kW Qty' : (isTriangle ? 'Direct Triangle Qty' : (isRail ? 'Direct Rails Qty' : `${itemQty} × ${pInfo?.setCount || 1} Set${(pInfo?.setCount || 1) > 1 ? 's' : ''}`))}
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
                                    {String(theme.badge || 'PRESET 1').replace('PRESET', 'PACK')}
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{ fontSize: '11.5px', color: '#475569' }}>
                                    Package Rate: <strong style={{ color: theme.primary }}>₹ {pInfo.kitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> / {pInfo.unitType === 'kW' ? 'kW' : 'Set'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleAddReconfirmPresetItem(pInfo.groupId)}
                                    style={{
                                      padding: '3px 10px',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      color: theme.primary,
                                      backgroundColor: '#FFFFFF',
                                      border: `1px solid ${theme.border}`,
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                    title={`Add component row to ${String(theme.badge || 'PRESET 1').replace('PRESET', 'PACK')}`}
                                  >
                                    + Add to {String(theme.badge || 'PRESET 1').replace('PRESET', 'PACK')}
                                  </button>
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
                                  {String(theme.badge || 'PRESET 1').replace('PRESET', 'PACK')} • Component {meta.itemIndexInGroup} of {pInfo ? pInfo.count : 1}
                                </span>
                              </div>
                            )}
                            {isSourcePiLocked ? (
                              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                                {item.name || '—'}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                                    const pCat = matched.category || matched.description || item.category || '';
                                    const isSolar5 = is5PctSolarProduct(pName, pCat);
                                    const updatedItems = (confirmingBomModal.items || []).map((it, i) => {
                                      if (i !== idx) return it;
                                      const resolvedUom = resolveDefaultUom(pName, matched.uom || matched.unit || it.uom || it.unit || 'NOS');
                                      return {
                                        ...it,
                                        name: pName,
                                        code: matched.code || it.code || '',
                                        rate: matched.price || matched.rate ? Number(matched.price || matched.rate) : it.rate,
                                        uom: resolvedUom,
                                        unit: resolvedUom,
                                        category: pCat,
                                        specs: pCat,
                                        gstRate: isSolar5 ? '5%' : (it.gstRate || '18%')
                                      };
                                    });
                                    setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                                  }}
                                />
                                <input
                                  id={`reconfirm-bom-description-${idx}`}
                                  name={`description_${idx}`}
                                  aria-label="Description"
                                  type="text"
                                  placeholder="Description..."
                                  value={item.category || item.specs || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, category: val, specs: val } : it);
                                    setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                                  }}
                                  style={{ width: '100%', height: '28px', borderRadius: '6px', border: '1px solid #E2E8F0', padding: '0 10px', fontSize: '11px', color: '#475569', outline: 'none', boxSizing: 'border-box', backgroundColor: '#F8FAFC' }}
                                />
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            {isSourcePiLocked ? (
                              <div style={{ fontSize: '12px', textAlign: 'center', fontWeight: '700', color: '#475569' }}>
                                {item.uom || item.unit || 'NOS'}
                              </div>
                            ) : (() => {
                              const isSalesUser = isSalesLoginRole(userRole);
                              if (isSalesUser) {
                                const currentUom = normalizeSalesUomValue(item.uom || item.unit || 'NOS');
                                const salesAllowedValues = SALES_UOM_OPTIONS.map((o) => o.value);
                                return (
                                  <select
                                    id={`bom-orders-uom-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`}
                                    name={`uOM_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`}
                                    aria-label="UOM"
                                    value={currentUom}
                                    onChange={(e) => {
                                      const val = e.target.value.toUpperCase();
                                      const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, uom: val, unit: val } : it);
                                      setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                                    }}
                                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 6px', fontSize: '12px', textAlign: 'center', fontWeight: '700', color: '#0F172A', backgroundColor: 'white', outline: 'none', cursor: 'pointer' }}
                                  >
                                    {!salesAllowedValues.includes(currentUom) && (
                                      <option value={currentUom}>{currentUom}</option>
                                    )}
                                    {SALES_UOM_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                );
                              }
                              return (
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
                              );
                            })()}
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
                                  const updatedItems = (confirmingBomModal.items || []).map((it, i) => {
                                    if (i !== idx) return it;
                                    const nextIt = { ...it, qty: val, qtyPerSet: val };
                                    const isSub = Boolean(it.isSubPreset || it.subPresetName || it.subPresetId);
                                    const effectivePresetName = isSub ? it.subPresetName : (pInfo?.presetName || it.presetName || confirmingBomModal.presetName);
                                    const effectiveUnit = isSub ? (it.subUnit || it.unit || 'Sets') : (pInfo?.unitType || it.unit || it.uom);
                                    const effectiveSetCount = isPartBundle
                                      ? (isSub ? (it.subSetCount || 1) : (pInfo?.setCount || 1))
                                      : 1;
                                    const recalcDisp = calculateTotalDispatchQty(
                                      { ...nextIt, presetId: pInfo?.presetId || it.presetId },
                                      effectiveSetCount,
                                      effectivePresetName,
                                      confirmingBomModal.category || it.category,
                                      effectiveUnit
                                    );
                                    return { ...nextIt, totalDispatchQty: recalcDisp };
                                  });
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
                              const isCustomSet = Boolean(
                                item.isCustomSet ||
                                pInfo?.isCustomSet ||
                                pInfo?.presetId === 'custom_set' ||
                                String(item.presetGroupId || '').startsWith('custom_set_') ||
                                String(effectivePresetName || '').toLowerCase().includes('custom set')
                              );
                              const effectiveSetCount = isCustomSet ? 1 : (isSub ? (item.subSetCount || 1) : (pInfo?.setCount || 1));
                              const calcTotalDisp = isCustomSet
                                ? (parseFloat(item.qty) || 0)
                                : calculateTotalDispatchQty(
                                    { ...item, presetId: pInfo?.presetId || item.presetId, isCustomSet },
                                    effectiveSetCount,
                                    effectivePresetName,
                                    confirmingBomModal.category || item.category,
                                    effectiveUnit
                                  );
                              const totalDisp = item.totalDispatchQty !== undefined && item.totalDispatchQty !== null && item.totalDispatchQty !== ''
                                ? item.totalDispatchQty
                                : calcTotalDisp;
                              const isKw = isKwPreset(effectivePresetName, effectiveUnit, item);
                              const isRail = isRailPreset(effectivePresetName, item.category, item.subPresetName, item.name);
                              const isTriangle = isTriangleDirectPreset(
                                effectivePresetName,
                                confirmingBomModal.category || item.category,
                                item.subPresetName,
                                pInfo?.presetId || item.presetId
                              );
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
                                    <span style={{ fontSize: '9px', color: (isKw || isRail || isTriangle) ? '#059669' : '#64748B', fontWeight: '600' }}>
                                      {isKw ? 'Direct kW Qty' : (isTriangle ? 'Direct Triangle Qty' : (isRail ? 'Direct Rails Qty' : `Formula: ${parseFloat(item.qty) || 0} × ${effectiveSetCount}`))}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          {/* Price (₹) Column */}
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                            {isPartBundle ? (
                              <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600', textAlign: 'center' }}>—</div>
                            ) : isSourcePiLocked ? (
                              <div style={{ fontSize: '13px', textAlign: 'right', fontWeight: '600', color: '#334155' }}>
                                ₹ {parseFloat(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </div>
                            ) : (
                              <input id={`bom-orders-rate-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`rate_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Rate"
                                type="number"
                                min="0"
                                value={item.rate}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, rate: val } : it);
                                  setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                                }}
                                style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '12px', textAlign: 'right', color: '#0F172A', backgroundColor: 'white', outline: 'none', cursor: 'text' }}
                               />
                            )}
                          </td>

                          {/* GST Rate Column */}
                          <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                            {isPartBundle || isSourcePiLocked ? (
                              <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#E0F2FE', color: '#0369A1', padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                                {extractGstRate(item.gstRate, 18)}% GST
                              </span>
                            ) : (
                              <select
                                value={`${extractGstRate(item.gstRate, 18)}%`}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, gstRate: val } : it);
                                  setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                                }}
                                style={{ height: '34px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 6px', fontSize: '11.5px', fontWeight: '700', color: '#0F172A', backgroundColor: 'white', cursor: 'pointer' }}
                              >
                                <option value="18%">18%</option>
                                <option value="5%">5%</option>
                                <option value="12%">12%</option>
                                <option value="28%">28%</option>
                                <option value="0%">0%</option>
                              </select>
                            )}
                          </td>

                          {/* Preset Amt (₹) Merged Column */}
                          {isPartBundle ? (
                            isFirstInKit ? (
                              <td
                                rowSpan={pInfo.count}
                                style={{
                                  padding: '12px 10px',
                                  textAlign: 'center',
                                  verticalAlign: 'middle',
                                  backgroundColor: theme.bg,
                                  borderLeft: `1.5px solid ${theme.border}`,
                                  borderRight: `1px solid ${theme.border}`
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A', maxWidth: '180px', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.3', textAlign: 'center' }} title={pInfo.presetName}>
                                    {pInfo.presetName}
                                  </span>
                                  {!isAlreadyForwarded && !isSourcePiLocked ? (
                                    <>
                                      <div style={{ position: 'relative', width: '100%' }}>
                                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', fontWeight: '700', color: theme.primary, pointerEvents: 'none' }}>₹</span>
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          aria-label="Preset Kit Price"
                                          value={pInfo.kitPrice || ''}
                                          placeholder="0.00"
                                          onFocus={(e) => e.target.select()}
                                          onChange={(e) => {
                                            const rawVal = e.target.value;
                                            const numVal = rawVal === '' ? 0 : (parseFloat(rawVal) || 0);
                                            const existingGroups = Array.isArray(confirmingBomModal.presetGroups) && confirmingBomModal.presetGroups.length > 0
                                              ? confirmingBomModal.presetGroups
                                              : [{
                                                  groupId: pInfo.groupId,
                                                  presetName: pInfo.presetName,
                                                  setCount: pInfo.setCount,
                                                  unit: pInfo.unitType,
                                                  unitType: pInfo.unitType,
                                                  kitPrice: numVal
                                                }];
                                            let matchedAny = false;
                                            const nextGroups = existingGroups.map((g, gi) => {
                                              const gKey = g.groupId || g.presetGroupId || g.presetId || (gi === 0 ? 'default_kit' : `preset_grp_${gi}`);
                                              if (gKey === pInfo.groupId || (existingGroups.length === 1 && gi === 0)) {
                                                matchedAny = true;
                                                return { ...g, kitPrice: rawVal === '' ? '' : numVal };
                                              }
                                              return g;
                                            });
                                            if (!matchedAny) {
                                              nextGroups.push({
                                                groupId: pInfo.groupId,
                                                presetName: pInfo.presetName,
                                                setCount: pInfo.setCount,
                                                unit: pInfo.unitType,
                                                unitType: pInfo.unitType,
                                                kitPrice: rawVal === '' ? '' : numVal
                                              });
                                            }
                                            setConfirmingBomModal({
                                              ...confirmingBomModal,
                                              presetGroups: nextGroups,
                                              presetKitPrice: nextGroups.length === 1 ? (rawVal === '' ? '' : numVal) : confirmingBomModal.presetKitPrice
                                            });
                                          }}
                                          style={{
                                            width: '100%', height: '42px', borderRadius: '8px',
                                            border: `2px solid ${theme.border}`, padding: '0 10px 0 26px',
                                            fontSize: '15px', fontWeight: '800', color: theme.primary,
                                            textAlign: 'right', outline: 'none', boxSizing: 'border-box',
                                            backgroundColor: 'white', cursor: 'text'
                                          }}
                                        />
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <span style={{ fontSize: '11px', color: theme.primary, fontWeight: '600' }}>
                                          {pInfo.count} items ×
                                        </span>
                                        <input
                                          type="number"
                                          step="any"
                                          min="0.01"
                                          max="9999"
                                          aria-label="SetCount"
                                          value={pInfo.setCount}
                                          onFocus={(e) => e.target.select()}
                                          onChange={(e) => {
                                            const rawVal = e.target.value;
                                            const parsed = parseFloat(rawVal);
                                            const valToSave = rawVal === '' ? '' : (isNaN(parsed) ? 1 : Math.max(0.01, parsed));
                                            const effectiveCountForCalc = parseFloat(valToSave) || 1;
                                            const existingGroups = Array.isArray(confirmingBomModal.presetGroups) && confirmingBomModal.presetGroups.length > 0
                                              ? confirmingBomModal.presetGroups
                                              : [{ groupId: pInfo.groupId, presetId: pInfo.presetId, presetName: pInfo.presetName, setCount: pInfo.setCount, unit: pInfo.unitType, unitType: pInfo.unitType, kitPrice: pInfo.kitPrice, gstRate: pInfo.gstRate }];
                                            const nextGroups = existingGroups.map((g, gi) => {
                                              const gKey = g.groupId || g.presetGroupId || g.presetId || (gi === 0 ? 'default_kit' : `preset_grp_${gi}`);
                                              return (gKey === pInfo.groupId || (existingGroups.length === 1 && gi === 0))
                                                ? { ...g, setCount: valToSave, sets: valToSave }
                                                : g;
                                            });
                                            const nextItems = (confirmingBomModal.items || []).map(it => {
                                              const itIsBundle = Boolean(it.isPresetItem || (existingGroups.length > 0 && cleanNum(it.rate) === 0));
                                              const itGid = it.presetGroupId || it.groupId || it.presetId || (existingGroups.length === 1 ? pInfo.groupId : null);
                                              if (!itIsBundle || (itGid !== pInfo.groupId && !(existingGroups.length === 1 && itIsBundle))) return it;
                                              const isSub = Boolean(it.isSubPreset || it.subPresetName || it.subPresetId);
                                              if (isSub && it.subSetCount) return it;
                                              const recalcDisp = calculateTotalDispatchQty(
                                                { ...it, presetId: pInfo.presetId || it.presetId },
                                                effectiveCountForCalc,
                                                pInfo.presetName,
                                                confirmingBomModal.category || it.category,
                                                pInfo.unitType
                                              );
                                              return { ...it, totalDispatchQty: recalcDisp };
                                            });
                                            setConfirmingBomModal({
                                              ...confirmingBomModal,
                                              presetGroups: nextGroups,
                                              items: nextItems,
                                              presetSetCount: nextGroups.length === 1 ? valToSave : confirmingBomModal.presetSetCount
                                            });
                                          }}
                                          style={{
                                            width: '50px', height: '26px', borderRadius: '6px',
                                            border: '1.5px solid #818CF8', fontSize: '13px',
                                            fontWeight: '800', color: '#312E81', textAlign: 'center',
                                            padding: '0 2px', outline: 'none', backgroundColor: 'white', boxSizing: 'border-box'
                                          }}
                                        />
                                        <select
                                          value={pInfo.unitType || 'Sets'}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            const existingGroups = Array.isArray(confirmingBomModal.presetGroups) && confirmingBomModal.presetGroups.length > 0
                                              ? confirmingBomModal.presetGroups
                                              : [{ groupId: pInfo.groupId, presetId: pInfo.presetId, presetName: pInfo.presetName, setCount: pInfo.setCount, unit: val, unitType: val, kitPrice: pInfo.kitPrice, gstRate: pInfo.gstRate }];
                                            const nextGroups = existingGroups.map((g, gi) => {
                                              const gKey = g.groupId || g.presetGroupId || g.presetId || (gi === 0 ? 'default_kit' : `preset_grp_${gi}`);
                                              return (gKey === pInfo.groupId || (existingGroups.length === 1 && gi === 0))
                                                ? { ...g, unit: val, unitType: val }
                                                : g;
                                            });
                                            const nextItems = (confirmingBomModal.items || []).map(it => {
                                              const itIsBundle = Boolean(it.isPresetItem || (existingGroups.length > 0 && cleanNum(it.rate) === 0));
                                              const itGid = it.presetGroupId || it.groupId || it.presetId || (existingGroups.length === 1 ? pInfo.groupId : null);
                                              if (!itIsBundle || (itGid !== pInfo.groupId && !(existingGroups.length === 1 && itIsBundle))) return it;
                                              const recalcDisp = calculateTotalDispatchQty(
                                                { ...it, presetId: pInfo.presetId || it.presetId },
                                                pInfo.setCount || 1,
                                                pInfo.presetName,
                                                confirmingBomModal.category || it.category,
                                                val
                                              );
                                              return { ...it, totalDispatchQty: recalcDisp };
                                            });
                                            setConfirmingBomModal({ ...confirmingBomModal, presetGroups: nextGroups, items: nextItems, presetUnit: val });
                                          }}
                                          style={{
                                            height: '24px', borderRadius: '6px',
                                            border: '1px solid #C7D2FE', padding: '0 2px',
                                            fontSize: '11px', fontWeight: '800',
                                            color: '#4F46E5', backgroundColor: '#FFFFFF', cursor: 'pointer'
                                          }}
                                        >
                                          <option value="Sets">Sets</option>
                                          <option value="kW">kW</option>
                                        </select>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                        <span style={{ fontSize: '10px', color: '#6366F1', fontWeight: '700' }}>GST:</span>
                                        <select
                                          value={`${extractGstRate(pInfo.gstRate ?? item.gstRate, 18)}%`}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            const existingGroups = Array.isArray(confirmingBomModal.presetGroups) && confirmingBomModal.presetGroups.length > 0
                                              ? confirmingBomModal.presetGroups
                                              : [{ groupId: pInfo.groupId, presetId: pInfo.presetId, presetName: pInfo.presetName, setCount: pInfo.setCount, unit: pInfo.unitType, unitType: pInfo.unitType, kitPrice: pInfo.kitPrice, gstRate: val }];
                                            const nextGroups = existingGroups.map((g, gi) => {
                                              const gKey = g.groupId || g.presetGroupId || g.presetId || (gi === 0 ? 'default_kit' : `preset_grp_${gi}`);
                                              return (gKey === pInfo.groupId || (existingGroups.length === 1 && gi === 0))
                                                ? { ...g, gstRate: val }
                                                : g;
                                            });
                                            const nextItems = (confirmingBomModal.items || []).map(it => {
                                              const itGid = it.presetGroupId || it.groupId || it.presetId || pInfo.groupId;
                                              return (itGid === pInfo.groupId || (existingGroups.length === 1 && (it.isPresetItem || cleanNum(it.rate) === 0)))
                                                ? { ...it, gstRate: val }
                                                : it;
                                            });
                                            setConfirmingBomModal({ ...confirmingBomModal, presetGroups: nextGroups, items: nextItems });
                                          }}
                                          style={{
                                            height: '24px', borderRadius: '6px',
                                            border: '1.5px solid #818CF8', padding: '0 4px',
                                            fontSize: '11px', fontWeight: '800',
                                            color: '#312E81', backgroundColor: '#FFFFFF', outline: 'none', cursor: 'pointer'
                                          }}
                                        >
                                          <option value="18%">18%</option>
                                          <option value="12%">12%</option>
                                          <option value="5%">5%</option>
                                          <option value="28%">28%</option>
                                          <option value="0%">0%</option>
                                        </select>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const existingGroups = Array.isArray(confirmingBomModal.presetGroups) && confirmingBomModal.presetGroups.length > 0
                                            ? confirmingBomModal.presetGroups
                                            : modalPresetGroups;
                                          const nextGroups = existingGroups.filter((g, gi) => {
                                            const gKey = g.groupId || g.presetGroupId || g.presetId || (gi === 0 ? 'default_kit' : `preset_grp_${gi}`);
                                            return gKey !== pInfo.groupId;
                                          });
                                          const nextItems = (confirmingBomModal.items || []).filter(it => {
                                            const itGid = it.presetGroupId || it.groupId || it.presetId || 'default_kit';
                                            return itGid !== pInfo.groupId && !(existingGroups.length === 1 && (it.isPresetItem || cleanNum(it.rate) === 0));
                                          });
                                          setConfirmingBomModal({
                                            ...confirmingBomModal,
                                            presetGroups: nextGroups,
                                            items: nextItems,
                                            ...(nextGroups.length === 0 ? { presetName: '', presetKitPrice: 0, presetSetCount: 1 } : {})
                                          });
                                        }}
                                        style={{ border: 'none', background: 'none', color: '#DC2626', fontSize: '10.5px', fontWeight: '700', cursor: 'pointer', padding: '2px 4px' }}
                                      >
                                        Remove Kit
                                      </button>
                                    </>
                                  ) : (
                                    <div style={{ textAlign: 'center' }}>
                                      <div style={{ fontSize: '14px', fontWeight: '800', color: theme.primary }}>
                                        ₹{pInfo.kitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </div>
                                      <div style={{ fontSize: '11px', color: theme.primary, fontWeight: '600', marginTop: '2px' }}>
                                        {pInfo.count} items × {pInfo.setCount} {pInfo.unitType}
                                      </div>
                                      <div style={{ fontSize: '10px', color: theme.primary, fontWeight: '700', marginTop: '3px' }}>
                                        GST: {extractGstRate(item.gstRate, 18)}%
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            ) : null
                          ) : (
                            <td style={{ padding: '12px 8px', textAlign: 'center', color: '#94A3B8', fontWeight: '600' }}>—</td>
                          )}

                          {/* Taxable (₹) Column */}
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '700', color: '#334155' }}>
                            {isPartBundle ? '—' : `₹ ${itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                          </td>

                          {/* Total (₹) Column */}
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                            {isPartBundle ? '—' : `₹ ${(itemTotal * (1 + extractGstRate(item.gstRate, 18) / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                          </td>

                          {!isAlreadyForwarded && (
                            <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                              {isSourcePiLocked ? (
                                <span title="Locked from Source Proforma Invoice" style={{ color: '#94A3B8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Lock style={{ width: '14px', height: '14px' }} />
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const removedItem = (confirmingBomModal.items || [])[idx];
                                    const updatedItems = (confirmingBomModal.items || []).filter((_, i) => i !== idx);
                                    const removedGid = removedItem?.presetGroupId || removedItem?.groupId || removedItem?.presetId;
                                    if (removedGid) {
                                      const stillHasItemsInGroup = updatedItems.some(it => (it.presetGroupId || it.groupId || it.presetId) === removedGid);
                                      if (!stillHasItemsInGroup) {
                                        const nextGroups = (confirmingBomModal.presetGroups || []).filter((g, gi) => {
                                          const gKey = g.groupId || g.presetGroupId || g.presetId || (gi === 0 ? 'default_kit' : `preset_grp_${gi}`);
                                          return gKey !== removedGid;
                                        });
                                        setConfirmingBomModal({
                                          ...confirmingBomModal,
                                          items: updatedItems,
                                          presetGroups: nextGroups,
                                          ...(nextGroups.length === 0 ? { presetName: '', presetKitPrice: 0, presetSetCount: 1 } : {})
                                        });
                                        return;
                                      }
                                    }
                                    setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                                  }}
                                  style={{ border: 'none', background: '#FEE2E2', color: '#DC2626', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Trash2 style={{ width: '14px', height: '14px' }} />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      </React.Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 4: TRANSPORT & LOGISTICS DETAILS */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              4
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              TRANSPORT & LOGISTICS DETAILS
            </h3>
          </div>

          {isAlreadyForwarded ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', backgroundColor: '#F8FAFC', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase', marginBottom: '3px' }}>MODE OF TRANSPORT</span>
                <strong style={{ fontSize: '13px', color: '#0F172A' }}>{confirmingBomModal.transportMode || '—'}</strong>
              </div>
              <div>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase', marginBottom: '3px' }}>TRANSPORT NAME</span>
                <strong style={{ fontSize: '13px', color: '#0F172A' }}>{confirmingBomModal.transporterName || '—'}</strong>
              </div>
              <div>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase', marginBottom: '3px' }}>DESTINATION</span>
                <strong style={{ fontSize: '13px', color: '#0F172A' }}>{confirmingBomModal.destination || '—'}</strong>
              </div>
              <div>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase', marginBottom: '3px' }}>SCOPE</span>
                <strong style={{ fontSize: '13px', color: '#0F172A' }}>{confirmingBomModal.transportScope || '—'}</strong>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div>
                <label htmlFor="reconfirm-bom-transport-mode" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Mode of Transport
                </label>
                <select
                  id="reconfirm-bom-transport-mode"
                  name="transportMode"
                  aria-label="Mode of Transport"
                  value={confirmingBomModal.transportMode || ''}
                  onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, transportMode: e.target.value })}
                  style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', color: confirmingBomModal.transportMode ? '#0F172A' : '#64748B', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="" disabled>Select Mode of Transport</option>
                  <option value="Transport">Transport</option>
                  <option value="Own Vehicle">Own Vehicle</option>
                  <option value="Porter">Porter</option>
                  <option value="Courier">Courier</option>
                  <option value="Customer Pickup / Self">Customer Pickup / Self</option>
                </select>
              </div>
              <div>
                <label htmlFor="reconfirm-bom-transport-name" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Transport Name
                </label>
                <input
                  id="reconfirm-bom-transport-name"
                  name="transporterName"
                  aria-label="Transport Name"
                  type="text"
                  placeholder="e.g. VRL Logistics / TCI Freight / Local Transport"
                  value={confirmingBomModal.transporterName || ''}
                  onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, transporterName: e.target.value })}
                  style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
              <div>
                <label htmlFor="reconfirm-bom-destination" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Destination
                </label>
                <input
                  id="reconfirm-bom-destination"
                  name="destination"
                  aria-label="Destination"
                  type="text"
                  placeholder="e.g. Chennai / Coimbatore / Site Location"
                  value={confirmingBomModal.destination || ''}
                  onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, destination: e.target.value })}
                  style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
              <div>
                <label htmlFor="reconfirm-bom-scope" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Scope
                </label>
                <select
                  id="reconfirm-bom-scope"
                  name="transportScope"
                  aria-label="Scope"
                  value={confirmingBomModal.transportScope || ''}
                  onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, transportScope: e.target.value })}
                  style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', color: confirmingBomModal.transportScope ? '#0F172A' : '#64748B', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="" disabled>Select Scope of Payment</option>
                  <option value="VRM Structures">VRM Structures</option>
                  <option value="Customer Scope">Customer Scope</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 5: PAYMENT TERMS & ORDER SUMMARY */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              5
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              PAYMENT TERMS & ORDER SUMMARY
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label htmlFor="bom-orders-payment-type-50-advance" style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  Payment Terms
                  {confirmingBomModal.editedFields?.paymentType && (
                    <span title={confirmingBomModal.editedFields.paymentType} style={{ backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: '800' }}>Edited</span>
                  )}
                </label>
                {isAlreadyForwarded ? (
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#2563EB', height: '40px', display: 'flex', alignItems: 'center', backgroundColor: '#F8FAFC', padding: '0 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    {normalizedPayType}
                  </div>
                ) : isDcOrder ? (
                  <select id="bom-orders-payment-type-50-advance" name="paymentType" aria-label="Payment Terms"
                    value="100% Paid"
                    disabled
                    style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', fontWeight: '700', color: '#2563EB', backgroundColor: '#F8FAFC', outline: 'none', cursor: 'not-allowed', boxSizing: 'border-box' }}
                  >
                    <option value="100% Paid">100% Paid (DC Order)</option>
                  </select>
                ) : (
                  <select id="bom-orders-payment-type-50-advance" name="paymentType" aria-label="Payment Terms"
                    value={normalizedPayType}
                    onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, paymentType: e.target.value })}
                    style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', fontWeight: '700', color: '#2563EB', backgroundColor: '#FFFFFF', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    <option value="100% Paid">100% Paid</option>
                    <option value="Partial Paid">Partial Paid</option>
                    <option value="Payment While Dispatch">Payment While Dispatch</option>
                    <option value="Cash">Cash (No Proof)</option>
                    {reconfirmCreditEval.approved && (
                      <option value="Credit Payment">Credit Payment</option>
                    )}
                  </select>
                )}
                {!isAlreadyForwarded && !isDcOrder && reconfirmCreditEval.gateEnabled !== false && reconfirmCreditEval.approved && normalizedPayType === 'Credit Payment' && (
                  <div style={{
                    marginTop: '6px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: '700',
                    backgroundColor: reconfirmCreditEval.exceedsLimit ? '#FEF2F2' : '#F5F3FF',
                    color: reconfirmCreditEval.exceedsLimit ? '#B91C1C' : '#5B21B6',
                    border: `1px solid ${reconfirmCreditEval.exceedsLimit ? '#FCA5A5' : '#DDD6FE'}`
                  }}>
                    {reconfirmCreditEval.exceedsLimit
                      ? `⛔ ${reconfirmCreditEval.reason}`
                      : reconfirmCreditEval.isUnlimitedCredit
                        ? `✓ Credit Limit: Unlimited • Used: ₹${reconfirmCreditEval.usedCredit.toLocaleString('en-IN')}`
                        : `✓ Credit Limit: ₹${reconfirmCreditEval.creditLimit.toLocaleString('en-IN')} • Used: ₹${reconfirmCreditEval.usedCredit.toLocaleString('en-IN')} • Available: ₹${reconfirmCreditEval.availableCredit.toLocaleString('en-IN')}`}
                  </div>
                )}
                {!isAlreadyForwarded && !isDcOrder && reconfirmCreditCustomer && !reconfirmCreditEval.approved && (
                  <div style={{ marginTop: '4px', fontSize: '10.5px', color: '#64748B', fontWeight: '600' }}>
                    {reconfirmCreditEval.status === 'pending_ceo_approval'
                      ? '⏳ Credit Payment pending CEO approval for this customer.'
                      : 'Credit Payment is restricted to CEO-approved credit customers.'}
                  </div>
                )}
              </div>

              {(normalizedPayType === 'Partial Paid' || normalizedPayType === 'Partial Payment') && (
                <div style={{ backgroundColor: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label htmlFor="bom-orders-partial-amount" style={{ fontSize: '12px', fontWeight: '800', color: '#0F766E' }}>
                      Partial Advance Amount (₹)
                    </label>
                    <span style={{ fontSize: '11px', color: '#0D9488', fontWeight: '700' }}>
                      Total: ₹{Number(orderGrandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {isAlreadyForwarded ? (
                    <strong style={{ fontSize: '14px', color: '#0F766E' }}>
                      ₹{Number(confirmingBomModal.partialAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  ) : (
                    <input id="bom-orders-partial-amount" name="partialAmount" aria-label="Partial Advance Amount"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Enter advance amount paid..."
                      value={confirmingBomModal.partialAmount != null ? confirmingBomModal.partialAmount : ''}
                      onChange={(e) => {
                        const rawVal = e.target.value;
                        const numVal = parseFloat(rawVal) || 0;
                        setConfirmingBomModal({
                          ...confirmingBomModal,
                          partialAmount: rawVal,
                          balanceAmount: Math.max(0, (orderGrandTotal || 0) - numVal)
                        });
                      }}
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #5EEAD4', padding: '0 12px', fontSize: '13px', fontWeight: '700', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                    />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#CCFBF1', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', color: '#115E59' }}>
                    <span>Remaining Balance:</span>
                    <strong style={{ fontSize: '13px', color: '#0F766E' }}>
                      ₹{Math.max(0, (orderGrandTotal || 0) - (parseFloat(confirmingBomModal.partialAmount) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
              )}

              {normalizedPayType === 'Credit Payment' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label htmlFor="reconfirm-bom-credit-days" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155' }}>Credit Timeline (Days)</label>
                    <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700' }}>Default: 7 Days</span>
                  </div>
                  {isAlreadyForwarded ? (
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#5B21B6', backgroundColor: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '8px', padding: '10px 12px' }}>
                      {confirmingBomModal.creditDays || 7} Days
                    </div>
                  ) : (
                    <input
                      id="reconfirm-bom-credit-days"
                      name="creditDays"
                      aria-label="Credit Timeline Days"
                      type="number"
                      min="1"
                      max="365"
                      value={confirmingBomModal.creditDays != null ? confirmingBomModal.creditDays : 7}
                      onChange={(e) => {
                        const nextDays = Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 1));
                        setConfirmingBomModal({
                          ...confirmingBomModal,
                          creditDays: nextDays,
                          creditDueDate: new Date(Date.now() + nextDays * 86400000).toISOString().split('T')[0]
                        });
                      }}
                      style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #A5F3FC', padding: '0 12px', fontSize: '13px', color: '#0F172A', backgroundColor: '#F0FDFA', boxSizing: 'border-box', outline: 'none', fontWeight: '700' }}
                    />
                  )}
                </div>
              )}

              <div>
                <label htmlFor="reconfirm-bom-remarks" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Remarks / Notes
                </label>
                {isAlreadyForwarded ? (
                  <div style={{ minHeight: '60px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', padding: '10px 12px', fontSize: '13px', color: '#334155', whiteSpace: 'pre-wrap' }}>
                    {confirmingBomModal.remarks || '—'}
                  </div>
                ) : (
                  <textarea
                    id="reconfirm-bom-remarks"
                    name="remarks"
                    aria-label="Remarks / Notes"
                    rows={3}
                    value={confirmingBomModal.remarks || ''}
                    onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, remarks: e.target.value })}
                    placeholder="Enter remarks, consignee references, or invoice notes..."
                    style={{ width: '100%', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '10px 12px', fontSize: '13px', color: '#0F172A', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {normalizedPayType === 'Credit Payment' ? (
                <div style={{ border: '1px solid #C7D2FE', borderRadius: '14px', padding: '20px', backgroundColor: '#F5F3FF', display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#EDE9FE', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Clock style={{ width: '18px', height: '18px' }} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#5B21B6' }}>Credit Payment Terms Active</h4>
                      <span style={{ fontSize: '11px', color: '#6D28D9' }}>{confirmingBomModal.creditDays || 7} Days Credit Window</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '12px', color: '#4C1D95', margin: 0, lineHeight: '1.5' }}>
                    Payment slip is not required upfront. You can adjust the credit days or settle payment after confirmation.
                  </p>
                </div>
              ) : normalizedPayType === 'Payment While Dispatch' ? (
                <div style={{ border: '1px solid #C7D2FE', borderRadius: '14px', padding: '20px', backgroundColor: '#EEF2FF', display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#DBEAFE', color: '#1E40AF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Truck style={{ width: '18px', height: '18px' }} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#1E3A8A' }}>Payment While Dispatch Active</h4>
                      <span style={{ fontSize: '11px', color: '#1D4ED8' }}>Payment proof will be attached once goods are packed for dispatch.</span>
                    </div>
                  </div>
                </div>
              ) : isDcOrder ? (
                <div style={{ border: '1px solid #FDE68A', borderRadius: '14px', padding: '20px', backgroundColor: '#FFFBEB', display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#92400E' }}>Delivery Challan (DC) Order</h4>
                  <span style={{ fontSize: '12px', color: '#B45309' }}>Payment attachment is not required for DC orders.</span>
                </div>
              ) : (
                <div style={{
                  padding: '18px 20px',
                  backgroundColor: '#F0FDF4',
                  border: '1.5px dashed #86EFAC',
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#DCFCE7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileCheck style={{ width: '18px', height: '18px' }} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', color: '#0F172A' }}>
                          Payment Attachment / Slip ({normalizedPayType}) <span style={{ color: '#EF4444' }}>*</span>
                        </h4>
                        <span style={{ fontSize: '11px', color: '#166534' }}>
                          Mandatory bank remittance advice, NEFT/RTGS receipt, or deposit slip.
                        </span>
                      </div>
                    </div>
                    {paymentProofList.length > 0 && (
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534', backgroundColor: '#DCFCE7', padding: '4px 10px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle style={{ width: '12px', height: '12px' }} /> {paymentProofList.length} Slip{paymentProofList.length > 1 ? 's' : ''} Attached
                      </span>
                    )}
                  </div>

                  {paymentProofList.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {paymentProofList.map((pDoc, pIdx) => (
                        <div key={pIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: '8px 12px', borderRadius: '8px', border: '1px solid #86EFAC', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <FileText style={{ width: '15px', height: '15px', color: '#166534', flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {pDoc.name || `Payment Slip #${pIdx + 1}`}
                              </div>
                              <div style={{ fontSize: '10px', color: '#64748B' }}>{pDoc.size || 'Attached'}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => setPreviewDocModal({ title: `Payment Proof #${pIdx + 1}: ${pDoc.name || 'Slip'}`, doc: pDoc })}
                              style={{ border: '1px solid #BBF7D0', background: '#DCFCE7', color: '#166534', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye style={{ width: '12px', height: '12px' }} /> View
                            </button>
                            {!isAlreadyForwarded && (
                              <button
                                type="button"
                                onClick={() => handleRemoveReconfirmPaymentProof(pIdx)}
                                title="Remove this slip"
                                style={{ border: 'none', background: '#FEE2E2', color: '#DC2626', padding: '5px 7px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <Trash2 style={{ width: '12px', height: '12px' }} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!isAlreadyForwarded && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', border: '1px solid #10B981', color: '#047857', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: isUploadingProof ? 'wait' : 'pointer' }}>
                        <UploadCloud style={{ width: '14px', height: '14px' }} />
                        {paymentProofList.length > 0 ? '+ Add More Payment Slips' : 'Browse / Upload Payment Slip(s)'}
                        <input
                          id="reconfirm-bom-payment-proof-input"
                          name="paymentProofUpload"
                          aria-label="Upload Payment Proof Slips"
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          style={{ display: 'none' }}
                          disabled={isUploadingProof}
                          onChange={async (e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              await handleUploadReconfirmPaymentProofs(e.target.files);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                      <span style={{ fontSize: '10.5px', color: '#64748B' }}>Supported: PDF, JPG, PNG, DOC (Multi-select enabled)</span>
                    </div>
                  )}
                </div>
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
            {!isSalesLoginRole(userRole) && (
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
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {!isAlreadyForwarded && (
                <button
                  type="button"
                  onClick={() => {
                    const currentItems = confirmingBomModal.items || [];
                    const allCheckedItems = currentItems.map(it => ({ ...it, confirmed: true }));
                    handleConfirmAndSendToDispatch(allCheckedItems);
                  }}
                  disabled={isConfirmingForward || isSavingDraft || isUploadingProof}
                  style={{
                    backgroundColor: '#0E7490',
                    border: 'none',
                    color: 'white',
                    height: '40px',
                    fontSize: '13px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 22px',
                    borderRadius: '50px',
                    cursor: (isConfirmingForward || isSavingDraft || isUploadingProof) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(14, 116, 144, 0.2)',
                    transition: 'all 0.2s ease-in-out',
                    flexShrink: 0,
                    opacity: (isConfirmingForward || isSavingDraft || isUploadingProof) ? 0.7 : 1
                  }}
                >
                  Confirm and Send
                </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>Grand Total:</span>
              <strong style={{ fontSize: '15px', color: '#0E7490', fontWeight: '800' }}>
                ₹{(orderGrandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
          </div>
        </div>

        {/* EXPORT FORMAT SELECTOR MODAL (PDF / JPG / CSV) */}
        {renderExportFormatModal()}

        {/* DOCUMENT PREVIEW MODAL */}
        {renderDocPreviewModal()}

        {/* OPERATIONAL MODALS (Alerts, Print Sheet, Payment Proof Upload) */}
        <BomOperationalModals ctx={ctx} />
      </div>
    );
}
