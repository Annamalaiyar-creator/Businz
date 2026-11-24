import React, { useState, useEffect, useCallback } from "react";
import {
  Check, Eye, FileText, AlertCircle, AlertTriangle, X, CheckCircle, Clock,
  FileCheck, CheckSquare, XCircle, ChevronLeft, RotateCcw,
  Truck, Download, Printer, Receipt, Camera, Video, Film, FileCode, User
} from "lucide-react";
import { getMediaFromCache, getMediaFromCacheAsync, saveMediaToCache, compressAndSaveFile, stripDataUrlsFromRecord } from "../../utils/otherViewsShared";
import { uploadBomDocumentFile, validateClientFile } from "../../utils/bomStorageClient";
import { resolveDocumentUrl, resolveDocumentUrlAsync } from "../../utils/documentResolver";
import { saveCloudStore, saveCloudBomRow, saveCloudInvoiceRow } from "../../utils/supabaseDataSync";
import { centralInventoryStore } from "../../utils/centralInventoryStore";
import { prodModuleEngine } from "../../utils/productionModuleEngine";
import { addLiveNotification } from "../Header";
import DocPreviewModal from "./DocPreviewModal";
import { isTamilNaduIntra, extractGstRate } from "../../utils/gstHelper";
import { notifyInvoiceCompletedReadyForDispatch, notifyAddressProofPendingToSales } from "../../services/notificationService";
import VRMTaxInvoicePrintTemplate, { VRMTaxInvoicePrintSheet } from "../VRMTaxInvoicePrintTemplate";
import { getHsnCode } from "../../utils/hsnCodeService";
import { autoDispatchOrderStatusToCustomer } from "../../utils/whatsappDispatchService";

const isBomCodeMatching = (codeA, codeB) => {
  if (!codeA || !codeB) return false;
  const sA = String(codeA).trim().toLowerCase();
  const sB = String(codeB).trim().toLowerCase();
  if (sA === sB) return true;
  const nA = sA.replace(/[^a-z0-9]/g, '');
  const nB = sB.replace(/[^a-z0-9]/g, '');
  if (nA && nB && nA === nB) return true;

  // Number-only match is allowed only when one side is a bare number (e.g. "663" vs "BOM-663").
  // Two full BOM codes must match exactly, so VRM-BOM-2025-12 never matches VRM-BOM-2026-12.
  const matchA = sA.match(/(\d+)$/);
  const matchB = sB.match(/(\d+)$/);
  if (matchA && matchB && parseInt(matchA[1], 10) === parseInt(matchB[1], 10)) {
    const isPureA = /^\d+$/.test(sA);
    const isPureB = /^\d+$/.test(sB);
    if ((isPureA && sB.includes('bom')) || (isPureB && sA.includes('bom'))) {
      return true;
    }
  }
  return false;
};

export default function InvoiceDetailModal({
  viewingInvoiceModal,
  setViewingInvoiceModal,
  isEditingInvoice,
  setIsEditingInvoice,
  invoiceEditForm,
  setInvoiceEditForm,
  invoiceModalActiveTab,
  setInvoiceModalActiveTab,
  bomStore,
  setBomStore,
  invoices,
  setInvoices,
  invoiceList: passedInvoiceList,
  setInvoiceList: passedSetInvoiceList,
  setPreviewDocModal,
  setActiveMediaPreviewModal = () => {},
  setPendingDcModal = () => {},
  setDispatchChecklistPreviewModal = () => {},
  showCustomAlert
}) {
  const invoiceList = passedInvoiceList || invoices || [];
  const setInvoiceList = passedSetInvoiceList || setInvoices || (() => {});
  const inv = viewingInvoiceModal || {};
  const [localDocPreviewModal, setLocalDocPreviewModal] = useState(null);
  const [printTaxInvoiceModal, setPrintTaxInvoiceModal] = useState(null);
  const [selectedProofVersionIdx, setSelectedProofVersionIdx] = useState(null);
  const [resolvedAddressProofUrl, setResolvedAddressProofUrl] = useState(null);
  const [resolvedPaymentProofUrl, setResolvedPaymentProofUrl] = useState(null);

  const rawBomRefText = String(inv.poNo || inv.bomCode || (inv.c3 !== 'BOM-001' ? inv.c3 : '') || '').trim();
  const invNum = String(inv.invNo || inv.code || inv.id || '').trim();
  const custName = String(inv.vendor || inv.customerName || inv.c2 || '').trim().toLowerCase();

  // Look up matching BOM from bomStore with strict hierarchical priority:
  // Priority 1: Match directly on BOM Code / PO Number (exact, canonical, or numeric)
  let matchingBom = null;
  if (rawBomRefText) {
    matchingBom = (bomStore || []).find(b => {
      if (!b) return false;
      const bCode = (b.bomCode || b.code || '').trim();
      return isBomCodeMatching(bCode, rawBomRefText) ||
             (b.salesOrderNo && isBomCodeMatching(b.salesOrderNo, rawBomRefText)) ||
             (b.id && String(b.id).trim() === rawBomRefText);
    });
  }

  // Priority 2: Match on explicit invoice number linked to BOM (b.invoiceNo === invNum)
  if (!matchingBom && invNum && invNum !== 'Pending Confirmation') {
    matchingBom = (bomStore || []).find(b => {
      if (!b) return false;
      const bInv = (b.invoiceNo || '').trim().toLowerCase();
      return bInv && bInv === invNum.toLowerCase();
    });
  }

  // Priority 3: Fallback ONLY if rawBomRefText is completely missing (never override an explicit BOM reference)
  if (!matchingBom && !rawBomRefText && custName && !['customer', 'customer order', 'pending'].includes(custName)) {
    const customerBoms = (bomStore || []).filter(b => {
      if (!b) return false;
      const bCust = (b.customerName || b.companyName || '').trim().toLowerCase();
      return bCust && bCust === custName;
    });
    if (customerBoms.length === 1) {
      matchingBom = customerBoms[0];
    } else if (customerBoms.length > 1) {
      const invAmtVal = parseFloat(String(inv.invAmt || inv.total || 0).replace(/[^0-9.]/g, ''));
      const amtMatch = customerBoms.find(b => {
        const bAmt = parseFloat(String(b.grandTotal || b.subTotal || 0).replace(/[^0-9.]/g, ''));
        return invAmtVal > 0 && Math.abs(invAmtVal - bAmt) < 1;
      });
      matchingBom = amtMatch || customerBoms[0];
    }
  }

  const targetBomRef = (matchingBom && (matchingBom.bomCode || matchingBom.code)) || rawBomRefText || 'VRM-BOM-2026-01';
  const bomRefText = (typeof targetBomRef === 'string' && targetBomRef.trim()) ? targetBomRef.trim() : 'VRM-BOM-2026-01';

  useEffect(() => {
    let isMounted = true;
    const rawAddressProof = inv.deliveryAddressProofDoc || matchingBom?.deliveryAddressProofDoc || null;
    const rawPaymentProof = inv.paymentProofDoc || matchingBom?.paymentProofDoc || matchingBom?.paymentProof || null;

    if (rawAddressProof) {
      const syncUrl = resolveDocumentUrl(rawAddressProof, bomRefText);
      if (syncUrl) setResolvedAddressProofUrl(syncUrl);
      resolveDocumentUrlAsync(rawAddressProof, bomRefText).then(url => {
        if (isMounted && url) setResolvedAddressProofUrl(url);
      }).catch(() => {});
    } else {
      setResolvedAddressProofUrl(null);
    }

    if (rawPaymentProof) {
      const syncUrl = resolveDocumentUrl(rawPaymentProof, bomRefText);
      if (syncUrl) setResolvedPaymentProofUrl(syncUrl);
      resolveDocumentUrlAsync(rawPaymentProof, bomRefText).then(url => {
        if (isMounted && url) setResolvedPaymentProofUrl(url);
      }).catch(() => {});
    } else {
      setResolvedPaymentProofUrl(null);
    }

    return () => { isMounted = false; };
  }, [inv.deliveryAddressProofDoc, matchingBom?.deliveryAddressProofDoc, inv.paymentProofDoc, matchingBom?.paymentProofDoc, matchingBom?.paymentProof, bomRefText]);

  const safeStringVal = (val, fallback = '') => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed || trimmed === '[object Object]' || trimmed.includes('[object')) return fallback;
      return trimmed;
    }
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'object') {
      const candidate = val.name || val.label || val.customerName || val.companyName || val.title || val.code || val.invNo || val.status || val.pay || val.date || val.address;
      if (typeof candidate === 'string' && candidate.trim()) return safeStringVal(candidate, fallback);
      if (typeof candidate === 'number') return String(candidate);
      return fallback;
    }
    return String(val);
  };

  const isConfirmed = inv.status === 'Invoice Confirmed' || inv.status === 'Completed' || inv.invoiceConfirmed || Boolean(matchingBom?.invoiceConfirmed) || Boolean(matchingBom?.status === 'Invoice Confirmed');
  const confirmedFallbackNo = (inv.code && inv.code !== 'Pending Confirmation') ? inv.code : (matchingBom?.invoiceNo && matchingBom.invoiceNo !== 'Pending Confirmation' ? matchingBom.invoiceNo : (inv.invNo && inv.invNo !== 'Pending Confirmation' ? inv.invNo : 'VRM-INV-2026-01'));
  const rawInvNo = isEditingInvoice
    ? (invoiceEditForm.invNo || inv.invoiceNo || (inv.invNo && inv.invNo !== 'Pending Confirmation' ? inv.invNo : null) || (matchingBom?.invoiceNo && matchingBom.invoiceNo !== 'Pending Confirmation' ? matchingBom.invoiceNo : null) || (isConfirmed ? confirmedFallbackNo : 'Pending Confirmation'))
    : (inv.invoiceNo || (inv.invNo && inv.invNo !== 'Pending Confirmation' ? inv.invNo : null) || (matchingBom?.invoiceNo && matchingBom.invoiceNo !== 'Pending Confirmation' ? matchingBom.invoiceNo : null) || (isConfirmed ? confirmedFallbackNo : 'Pending Confirmation'));
  const invNoText = safeStringVal(rawInvNo, 'Pending Confirmation');
  const customerText = safeStringVal(isEditingInvoice ? (invoiceEditForm.vendor || inv.vendor || inv.customerName || matchingBom?.customerName || inv.c2) : (inv.vendor || inv.customerName || matchingBom?.customerName || inv.c2), 'Customer');
  const invDateText = safeStringVal(isEditingInvoice ? (invoiceEditForm.date || inv.date || inv.c4) : (inv.date || inv.c4), '21 May 2025');
  const paymentTypeText = safeStringVal(isEditingInvoice ? (invoiceEditForm.paymentType || inv.paymentType || matchingBom?.paymentType) : (inv.paymentType || matchingBom?.paymentType), '100% Advance');
  const isFullAdvance = paymentTypeText === '100% Advance';
  const is50Percent = paymentTypeText.includes('50%') || paymentTypeText === '50% Advance / 50% Dispatch';

  const handleAutoCancelForMissingProof = useCallback(() => {
    const nowIso = new Date().toISOString();
    const targetCode = inv.poNo || inv.code || bomRefText;
    const cancelMsg = 'Invoice Cancelled because of the Address Proof is missing are Mismatch';

    setViewingInvoiceModal(prev => prev ? {
      ...prev,
      status: 'Cancelled',
      pay: 'Cancelled',
      cancellationReason: cancelMsg,
      cancelledAt: nowIso,
      addressProofReuploadRequested: false
    } : prev);

    if (setInvoiceList) {
      setInvoiceList(prev => {
        const list = Array.isArray(prev) ? prev : [];
        const updatedInvoices = list.map(item => (item.invNo === inv.invNo || item.code === inv.code || item.bomCode === inv.bomCode) ? {
          ...item,
          status: 'Cancelled',
          pay: 'Cancelled',
          cancellationReason: cancelMsg,
          cancelledAt: nowIso,
          addressProofReuploadRequested: false
        } : item);
        try {
          const cancelledInv = updatedInvoices.find(item => item.invNo === inv.invNo || item.code === inv.code || item.bomCode === inv.bomCode);
          if (cancelledInv) saveCloudInvoiceRow(cancelledInv);
        } catch (e) { }
        return updatedInvoices;
      });
    }

    if (setBomStore) {
      setBomStore(prev => (prev || []).map(b => (
        b.bomCode === targetCode ||
        b.salesOrderNo === targetCode ||
        b.code === targetCode ||
        isBomCodeMatching(b.bomCode || b.code, targetCode)
      ) ? {
        ...b,
        status: 'Invoice Cancelled',
        invoiceConfirmed: false,
        cancellationReason: cancelMsg,
        invoiceCancelledAt: nowIso,
        addressProofReuploadRequested: false
      } : b));
    }

    try {
      addLiveNotification({
        title: 'Invoice Cancelled',
        message: cancelMsg,
        type: 'alert'
      });
      window.dispatchEvent(new Event('controlroom_storage_update'));
    } catch (e) { }

    alert(`⚠️ ${cancelMsg}`);
  }, [inv, bomRefText, setViewingInvoiceModal, setInvoiceList, setBomStore]);

  // Live 1-Hour SLA Countdown Ticker & Auto-Cancellation Monitor for Address Proof Reissue
  const [reissueSecondsLeft, setReissueSecondsLeft] = useState(() => {
    const isPending = Boolean(
      inv.addressProofReuploadRequested ||
      matchingBom?.addressProofReuploadRequested ||
      matchingBom?.status === 'Address Proof Requested from Sales' ||
      inv.status === 'Address Proof Reissue Requested'
    );
    const reqAt = inv.addressProofReuploadRequestedAt || inv.reissueRequestedAt || matchingBom?.addressProofReuploadRequestedAt;
    if (!isPending || !reqAt) return null;
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const diff = ONE_HOUR_MS - (Date.now() - new Date(reqAt).getTime());
    return Math.max(0, Math.floor(diff / 1000));
  });

  useEffect(() => {
    if (isConfirmed || inv.status === 'Cancelled') {
      setReissueSecondsLeft(null);
      return;
    }
    const isPendingReissue = Boolean(
      inv.addressProofReuploadRequested ||
      matchingBom?.addressProofReuploadRequested ||
      matchingBom?.status === 'Address Proof Requested from Sales' ||
      inv.status === 'Address Proof Reissue Requested'
    );
    const reqAt = inv.addressProofReuploadRequestedAt || inv.reissueRequestedAt || matchingBom?.addressProofReuploadRequestedAt;
    if (!isPendingReissue || !reqAt) {
      setReissueSecondsLeft(null);
      return;
    }

    const ONE_HOUR_MS = 60 * 60 * 1000;
    const tick = () => {
      const elapsed = Date.now() - new Date(reqAt).getTime();
      const remainingSecs = Math.max(0, Math.floor((ONE_HOUR_MS - elapsed) / 1000));
      setReissueSecondsLeft(remainingSecs);
      if (remainingSecs <= 0) {
        handleAutoCancelForMissingProof();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [inv.addressProofReuploadRequested, inv.addressProofReuploadRequestedAt, inv.reissueRequestedAt, matchingBom?.addressProofReuploadRequested, matchingBom?.addressProofReuploadRequestedAt, isConfirmed, inv.status, handleAutoCancelForMissingProof]);

  // ALWAYS check matchingBom items first so dispatch packing verification state (packed true/false) is source of truth
  const rawItems = (matchingBom && matchingBom.items && matchingBom.items.length > 0)
    ? matchingBom.items
    : (inv.items && inv.items.length > 0)
      ? inv.items
      : null;

  const packingList = (matchingBom && Array.isArray(matchingBom.dispatchPacking) && matchingBom.dispatchPacking.length > 0)
    ? matchingBom.dispatchPacking
    : (inv && Array.isArray(inv.dispatchPacking) && inv.dispatchPacking.length > 0)
      ? inv.dispatchPacking
      : null;

  const baseItemsList = rawItems ? rawItems.map((it, idx) => {
    let selectedState = undefined;

    // 1. Check dispatchPacking verification checklist by code, name, or index
    if (packingList && packingList.length > 0) {
      const matchInDispatch = packingList.find(dp =>
        (dp.code && it.code && dp.code === it.code) ||
        (dp.name && it.name && dp.name.toLowerCase().trim() === it.name.toLowerCase().trim())
      ) || (packingList[idx] && packingList[idx].packed !== undefined ? packingList[idx] : null);

      if (matchInDispatch !== null && matchInDispatch !== undefined && matchInDispatch.packed !== undefined) {
        selectedState = Boolean(matchInDispatch.packed);
      }
    }

    // 2. Check item level properties (selected or packed)
    if (selectedState === undefined) {
      if (it.selected !== undefined) selectedState = Boolean(it.selected);
      else if (it.packed !== undefined) selectedState = Boolean(it.packed);
    }

    // 3. Check corresponding item on the invoice record (inv.items)
    if (selectedState === undefined && inv.items && Array.isArray(inv.items)) {
      const invMatch = inv.items.find(invIt =>
        (invIt.code && it.code && invIt.code === it.code) ||
        (invIt.name && it.name && invIt.name.toLowerCase().trim() === it.name.toLowerCase().trim())
      ) || inv.items[idx];
      if (invMatch && (invMatch.selected !== undefined || invMatch.packed !== undefined)) {
        selectedState = Boolean(invMatch.selected ?? invMatch.packed);
      }
    }

    // 4. Fallback for verified/approved orders in Invoice Management:
    // If the invoice is in Invoice Management or accounts verified, items default to packed (true)
    if (selectedState === undefined) {
      const isAlreadyVerified = Boolean(
        inv.status === 'Invoice Confirmed' ||
        inv.status === 'Accounts Verified & Passed to Invoice' ||
        inv.status === 'Ready for Invoicing' ||
        inv.status === 'Packing Verified - Ready for Billing' ||
        inv.status === 'Ready for Payment' ||
        matchingBom?.status === 'Invoice Confirmed' ||
        matchingBom?.status === 'Accounts Verified & Passed to Invoice' ||
        matchingBom?.status === 'Awaiting Vehicle Loading & Dispatch' ||
        matchingBom?.accountsVerification?.verified
      );
      selectedState = isAlreadyVerified ? true : false;
    }

    const qty = Number(it.qty || it.bomQty || 1) || 1;
    const isPresetFlag = Boolean(it.isPresetItem || it.presetGroupId || it.presetName);
    const parsedRate = parseFloat(it.rate !== undefined && it.rate !== null && it.rate !== '' ? it.rate : (it.unitPrice ?? 0));
    const rate = Number.isFinite(parsedRate) ? parsedRate : 0;
    const itemTaxPct = extractGstRate(it.gstRate ?? it.tax, 18);
    return {
      code: it.code || `PRD-00${idx + 1}`,
      name: it.name || `Product ${idx + 1}`,
      desc: it.desc || it.category || 'High grade mounting component',
      uom: it.uom || 'Nos',
      bomQty: qty,
      invQty: qty,
      rate: rate,
      discount: it.discount || 0,
      tax: itemTaxPct,
      gstRate: it.gstRate !== undefined ? it.gstRate : `${itemTaxPct}%`,
      amt: isPresetFlag ? 0 : (it.amt !== undefined && it.amt !== null && Number(it.amt) > 0 ? Number(it.amt) : (qty * rate * (1 + itemTaxPct / 100))),
      selected: selectedState,
      isPresetItem: isPresetFlag,
      presetGroupId: it.presetGroupId || null,
      presetName: it.presetName || ''
    };
  }) : [
    { code: 'PRD-001', name: 'Long Rail 3000 mm', desc: '3 Meter Heavy Duty Rail', uom: 'Nos', bomQty: 8, invQty: 8, rate: 1800.00, discount: 0, tax: 18, amt: 14400.00 * 1.18, selected: true },
    { code: 'PRD-002', name: 'Mini Rail 100 mm', desc: 'Aluminum Mounting Rail', uom: 'Nos', bomQty: 12, invQty: 12, rate: 250.00, discount: 0, tax: 18, amt: 3000.00 * 1.18, selected: false }
  ];

  // Use invoiceEditForm.items if in edit mode and items are present
  const itemsList = (isEditingInvoice && invoiceEditForm.items && invoiceEditForm.items.length > 0)
    ? invoiceEditForm.items
    : baseItemsList;

  const computedSubtotal = itemsList.reduce((acc, it) => acc + ((it.qty || it.invQty || it.bomQty || 1) * (it.rate || 0)), 0);
  const computedTaxGst = itemsList.reduce((acc, it) => {
    const lineSub = (it.qty || it.invQty || it.bomQty || 1) * (it.rate || 0);
    const pct = extractGstRate(it.gstRate ?? it.tax, 18);
    return acc + (lineSub * (pct / 100));
  }, 0);
  const computedGrandTotal = computedSubtotal + computedTaxGst;

  const cleanAmtNum = (amt) => {
    if (typeof amt === 'number' && !isNaN(amt) && amt > 0) return amt;
    if (!amt) return 0;
    const n = parseFloat(String(amt).replace(/[^0-9.]/g, ''));
    return (isNaN(n) || n <= 0) ? 0 : n;
  };

  const bomTotalAmt = cleanAmtNum(matchingBom?.grandTotal) || cleanAmtNum(matchingBom?.subTotal) || cleanAmtNum(matchingBom?.totalAmount) || cleanAmtNum(matchingBom?.accountsVerification?.totalAmount) || 0;
  const invAmtNum = cleanAmtNum(inv.invAmt) || cleanAmtNum(inv.c5) || cleanAmtNum(inv.total) || cleanAmtNum(inv.amount) || cleanAmtNum(inv.rawTotal) || 0;

  // The confirmed BOM order total is the invoice amount; the stored invoice amount is only a fallback.
  const bomGrandTotalAmt = cleanAmtNum(matchingBom?.grandTotal);
  const totalAmtRaw = isEditingInvoice
    ? computedGrandTotal
    : (bomGrandTotalAmt > 0 ? bomGrandTotalAmt : (invAmtNum > 0 ? invAmtNum : (bomTotalAmt > 0 ? bomTotalAmt : (computedGrandTotal > 0 ? computedGrandTotal : 17400))));

  const storedSub = cleanAmtNum(inv.subTotal) || cleanAmtNum(inv.subtotal) || cleanAmtNum(matchingBom?.subTotal) || cleanAmtNum(matchingBom?.subtotal) || 0;
  const storedGst = cleanAmtNum(inv.gstAmount) || cleanAmtNum(inv.taxAmount) || cleanAmtNum(matchingBom?.gstAmount) || 0;
  const invFallbackRate = extractGstRate(inv.gstRate ?? matchingBom?.gstRate, 18);
  const subtotal = isEditingInvoice
    ? computedSubtotal
    : (storedSub > 0 && storedSub <= totalAmtRaw
      ? storedSub
      : (computedGrandTotal > 0 && Math.abs(computedGrandTotal - totalAmtRaw) < 2
        ? computedSubtotal
        : (totalAmtRaw / (1 + invFallbackRate / 100))));
  const taxGst = isEditingInvoice
    ? computedTaxGst
    : (storedGst > 0 && storedSub > 0 && Math.abs((storedSub + storedGst) - totalAmtRaw) < 2
      ? storedGst
      : Math.max(0, totalAmtRaw - subtotal));
  const invGst = inv.gstNo || inv.gstin || inv.gst || matchingBom?.gstNo || '';
  const invState = inv.deliveryState || inv.billingState || inv.state || matchingBom?.deliveryState || matchingBom?.billingState || '';
  const isInvIntra = isTamilNaduIntra(invGst, invState);

  // Amount received = what Accounts verified (slip + adjustment); invoice total stays the order value.
  const verifiedReceivedAmt = cleanAmtNum(inv.accountsVerification?.totalAmount) || cleanAmtNum(matchingBom?.accountsVerification?.totalAmount);
  const advanceAmt = verifiedReceivedAmt > 0
    ? Math.min(verifiedReceivedAmt, totalAmtRaw)
    : (isFullAdvance ? totalAmtRaw : (is50Percent ? totalAmtRaw * 0.5 : totalAmtRaw));
  const balanceAmt = verifiedReceivedAmt > 0
    ? Math.max(0, Math.round((totalAmtRaw - verifiedReceivedAmt) * 100) / 100)
    : (isFullAdvance ? 0 : (is50Percent ? totalAmtRaw * 0.5 : 0));
  const paymentStatusText = safeStringVal(inv.pay, balanceAmt === 0 ? 'Verified & Paid (100%)' : 'Ready for Payment');

  const getPaymentBadgeStyle = (term) => {
    const t = String(term || '').toLowerCase();
    if (t.includes('partial')) {
      return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', dot: '#3B82F6' };
    }
    if (t.includes('dispatch') || t.includes('while dispatch')) {
      return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A', dot: '#F59E0B' };
    }
    if (t.includes('credit') || t.includes('net 30')) {
      return { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE', dot: '#8B5CF6' };
    }
    if (t.includes('non-chargeable') || t.includes('sample') || t.includes('foc')) {
      return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1', dot: '#64748B' };
    }
    return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0', dot: '#10B981' };
  };

  const handleStartEditingInvoice = () => {
    const bAddrInit = inv.billingAddress || matchingBom?.billingAddress || 'Plot No 42, SIDCO Industrial Estate, Ambattur, Chennai';
    const dAddrInit = inv.deliveryAddress || matchingBom?.deliveryAddress || bAddrInit;
    setInvoiceEditForm({
      invNo: invNoText,
      date: invDateText,
      vendor: customerText,
      billingAddress: bAddrInit,
      deliveryAddress: dAddrInit,
      paymentType: paymentTypeText,
      items: baseItemsList.map(it => ({ ...it }))
    });
    setIsEditingInvoice(true);
  };

  const handleSaveInvoiceEdits = () => {
    const updatedInvAmt = `₹ ${computedGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const updatedInvoiceRecord = {
      ...inv,
      invNo: invoiceEditForm.invNo || invNoText,
      code: invoiceEditForm.invNo || invNoText,
      vendor: invoiceEditForm.vendor || customerText,
      customerName: invoiceEditForm.vendor || customerText,
      date: invoiceEditForm.date || invDateText,
      paymentType: invoiceEditForm.paymentType || paymentTypeText,
      billingAddress: invoiceEditForm.billingAddress,
      deliveryAddress: invoiceEditForm.deliveryAddress,
      invAmt: updatedInvAmt,
      items: invoiceEditForm.items,
      lastModifiedAt: new Date().toISOString()
    };

    setViewingInvoiceModal(updatedInvoiceRecord);

    setInvoiceList(prev => {
      const updated = prev.map(item =>
        (item.invNo === inv.invNo || item.code === inv.code || item.bomCode === inv.bomCode)
          ? { ...item, ...updatedInvoiceRecord }
          : item
      );
      try {
        saveCloudInvoiceRow(updatedInvoiceRecord);
      } catch (e) { }
      return updated;
    });

    // Also sync customer name, paymentType, and addresses back to matching BOM
    const targetCode = inv.poNo || inv.code || bomRefText;
    setBomStore(prev => {
      const updatedBoms = prev.map(b => (
        b.bomCode === targetCode ||
        b.salesOrderNo === targetCode ||
        b.code === targetCode ||
        isBomCodeMatching(b.bomCode || b.code, targetCode)
      ) ? {
        ...b,
        customerName: invoiceEditForm.vendor || b.customerName,
        paymentType: invoiceEditForm.paymentType || b.paymentType,
        billingAddress: invoiceEditForm.billingAddress || b.billingAddress,
        deliveryAddress: invoiceEditForm.deliveryAddress || b.deliveryAddress,
        invoiceNo: invoiceEditForm.invNo || b.invoiceNo
      } : b);
      try {
        const updatedBom = updatedBoms.find(b => (targetCode && (b.bomCode === targetCode || b.code === targetCode)) || (matchingBom && b.bomCode === matchingBom.bomCode));
        if (updatedBom) {
          saveCloudBomRow(updatedBom);
        }
      } catch (e) { }
      return updatedBoms;
    });

    setIsEditingInvoice(false);
    addLiveNotification({
      title: 'Invoice Details Updated',
      message: `Invoice ${invoiceEditForm.invNo || invNoText} successfully updated and saved!`,
      type: 'success',
      category: 'Invoice'
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Back Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => {
            setIsEditingInvoice(false);
            setViewingInvoiceModal(null);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '700',
            color: '#475569',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          <ChevronLeft style={{ width: '16px', height: '16px' }} /> Back to Invoice List
        </button>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Print button */}
          <button
            onClick={() => setPrintTaxInvoiceModal(inv)}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '0 16px',
              height: '38px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Printer style={{ width: '15px', height: '15px', color: '#475569' }} /> Print
          </button>

          {/* Download button */}
          <button
            onClick={() => alert(`Downloading Invoice ${invNoText} PDF...`)}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '0 16px',
              height: '38px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download style={{ width: '15px', height: '15px', color: '#475569' }} /> Download
          </button>

          {/* Cancel Invoice button */}
          {inv.status === 'Cancelled' ? (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                padding: '0 16px',
                height: '38px',
                fontSize: '13px',
                fontWeight: '800',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <XCircle style={{ width: '15px', height: '15px', color: '#DC2626' }} /> Cancelled
            </div>
          ) : (
            <button
              onClick={() => {
                if (window.confirm(`Are you sure you want to cancel Invoice ${invNoText}? This will mark the invoice as Cancelled and return the order status.`)) {
                  const nowIso = new Date().toISOString();
                  const targetCode = inv.poNo || inv.code || bomRefText;

                  setViewingInvoiceModal(prev => prev ? {
                    ...prev,
                    status: 'Cancelled',
                    pay: 'Cancelled',
                    cancelledAt: nowIso
                  } : prev);

                  setInvoiceList(prev => {
                    const updatedInvoices = prev.map(item => (item.invNo === inv.invNo || item.code === inv.code || item.bomCode === inv.bomCode) ? {
                      ...item,
                      status: 'Cancelled',
                      pay: 'Cancelled',
                      cancelledAt: nowIso
                    } : item);
                    try {
                      const cancelledInv = updatedInvoices.find(item => item.invNo === inv.invNo || item.code === inv.code || item.bomCode === inv.bomCode);
                      if (cancelledInv) saveCloudInvoiceRow(cancelledInv);
                    } catch (e) { }
                    return updatedInvoices;
                  });

                  setBomStore(prev => prev.map(b => (
                    isBomCodeMatching(b.bomCode || b.code, targetCode) ||
                    (b.salesOrderNo && isBomCodeMatching(b.salesOrderNo, targetCode))
                  ) ? {
                    ...b,
                    status: 'Invoice Cancelled',
                    invoiceConfirmed: false,
                    invoiceCancelledAt: nowIso
                  } : b));

                  try {
                    addLiveNotification({
                      title: `Invoice ${invNoText} Cancelled`,
                      message: `Invoice ${invNoText} for BOM ${bomRefText} has been marked as Cancelled.`,
                      type: 'alert'
                    });
                  } catch (e) { }

                  alert(`Invoice ${invNoText} has been successfully marked as Cancelled.`);
                }
              }}
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                padding: '0 16px',
                height: '38px',
                fontSize: '13px',
                fontWeight: '700',
                color: '#DC2626',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
              title="Cancel this invoice"
            >
              <XCircle style={{ width: '15px', height: '15px', color: '#DC2626' }} /> Cancel
            </button>
          )}

          {/* Invoices are strictly official records and read-only */}

          {/* Confirm Invoice primary button */}
          {['Invoice Confirmed', 'CLOSED', 'Completed', 'Confirmed', 'Fully Dispatched & Delivered'].includes(inv.status) ? (
            <div
              style={{
                backgroundColor: '#DCFCE7',
                color: '#166534',
                border: '1px solid #86EFAC',
                borderRadius: '8px',
                padding: '0 18px',
                height: '38px',
                fontSize: '13px',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle style={{ width: '16px', height: '16px', color: '#166534' }} /> Invoice Completed
            </div>
          ) : (
            <button
              onClick={() => {
                // 1. Check if 1 hour has expired on an active reissue request -> Auto-Cancel
                const isReissuePending = Boolean(
                  inv.addressProofReuploadRequested ||
                  matchingBom?.addressProofReuploadRequested ||
                  matchingBom?.status === 'Address Proof Requested from Sales' ||
                  inv.status === 'Address Proof Reissue Requested'
                );
                const reqAt = inv.addressProofReuploadRequestedAt || inv.reissueRequestedAt || matchingBom?.addressProofReuploadRequestedAt;
                const ONE_HOUR_MS = 60 * 60 * 1000;
                if (isReissuePending && reqAt && (Date.now() - new Date(reqAt).getTime() >= ONE_HOUR_MS)) {
                  handleAutoCancelForMissingProof();
                  return;
                }

                // 2. Check address proof requirement for alternate delivery address
                const targetRef = bomRefText || inv.poNo || inv.bomCode || inv.code;
                const foundBom = matchingBom || (bomStore || []).find(b => isBomCodeMatching(b.bomCode || b.code, targetRef));
                const bAddr = inv.billingAddress || matchingBom?.billingAddress || foundBom?.billingAddress || 'Plot No 42, SIDCO Industrial Estate, Ambattur, Chennai';
                const dAddr = inv.deliveryAddress || matchingBom?.deliveryAddress || foundBom?.deliveryAddress || bAddr;
                const isDifferentAddress = !Boolean(
                  inv.sameAsBilling ||
                  matchingBom?.sameAsBilling ||
                  foundBom?.sameAsBilling ||
                  (bAddr && dAddr && bAddr.trim().toLowerCase() === dAddr.trim().toLowerCase())
                );
                const hasAddressProof = Boolean(inv.deliveryAddressProofDoc || matchingBom?.deliveryAddressProofDoc || foundBom?.deliveryAddressProofDoc);

                let waiveProofDisclaimer = false;
                if (isDifferentAddress && (!hasAddressProof || isReissuePending)) {
                  const disclaimerClause = 'The Invoice is processed without the Address Proof so if any problem happens means VRM Structures India Private Limited will not take any responsibility.';
                  const confirmWaive = window.confirm(
                    `⚠️ Address proof has not been provided by Sales.\n\nUnder company policy, this invoice can ONLY be completed with the following mandatory disclaimer added to Terms & Conditions:\n\n"${disclaimerClause}"\n\nDo you want to proceed and complete the invoice under this condition?`
                  );
                  if (!confirmWaive) {
                    return;
                  }
                  waiveProofDisclaimer = true;
                }

                // 1. Identify items to deduct (if any selected, use selected, otherwise deduct ALL invoice items)
                const hasExplicitSelection = (itemsList || []).some(item => item.selected === true);
                const packedItemsToDeduct = hasExplicitSelection
                  ? (itemsList || []).filter(item => Boolean(item.selected))
                  : (itemsList || []);

                // Check if matching BOM already blocked/deducted stock at creation/verification time
                const isStockAlreadyBlocked = Boolean(matchingBom?.stockBlocked || inv.stockDeducted || inv.stockBlocked);

                if (!isStockAlreadyBlocked) {
                  // 2. Reduce stock in stockRegistry (if available)
                  try {
                    const rawRegistry = localStorage.getItem('controlroom_stock_registry_store');
                    if (rawRegistry) {
                      const updated = JSON.parse(rawRegistry) || [];
                      packedItemsToDeduct.forEach(pItem => {
                        const qtyToDeduct = parseInt(pItem.invQty || pItem.bomQty || pItem.qty || 1, 10) || 0;
                        const matchIdx = updated.findIndex(r =>
                          (r.code && pItem.code && r.code.toLowerCase().trim() === pItem.code.toLowerCase().trim()) ||
                          (r.item && pItem.name && (
                            r.item.toLowerCase().trim() === pItem.name.toLowerCase().trim() ||
                            r.item.toLowerCase().includes(pItem.name.toLowerCase().trim()) ||
                            pItem.name.toLowerCase().includes(r.item.toLowerCase().trim())
                          ))
                        );
                        if (matchIdx !== -1) {
                          const currentStock = Math.max(0, parseInt(String(updated[matchIdx].stock).replace(/,/g, ''), 10) || 0);
                          const newStock = Math.max(0, currentStock - qtyToDeduct);
                          const minLvl = parseInt(String(updated[matchIdx].minLevel || '500').replace(/,/g, ''), 10) || 500;
                          updated[matchIdx] = {
                            ...updated[matchIdx],
                            stock: String(newStock),
                            status: newStock === 0 ? 'Out of Stock' : (newStock <= minLvl ? 'Low Stock' : 'In Stock')
                          };
                        }
                      });
                      localStorage.setItem('controlroom_stock_registry_store', JSON.stringify(updated));
                    }
                  } catch (e) { console.warn('Stock registry update warning in InvoiceDetailModal:', e); }

                // 3. Deduct stock directly from prodModuleEngine central live inventory
                try {
                  const engineInv = prodModuleEngine.getInventory();
                  packedItemsToDeduct.forEach(pItem => {
                    const qtyToDeduct = parseInt(pItem.invQty || pItem.bomQty || pItem.qty || 1, 10) || 0;
                    const pCode = (pItem.code || '').toUpperCase().trim();
                    const pName = (pItem.name || pItem.description || '').toLowerCase().trim();

                    let targetItem = engineInv.find(i => {
                      const iCode = (i.code || '').toUpperCase().trim();
                      const iName = (i.name || '').toLowerCase().trim();
                      if (pCode && iCode === pCode) return true;
                      if (pName && iName && (iName === pName || iName.includes(pName) || pName.includes(iName))) return true;
                      return false;
                    });

                    if (targetItem) {
                      targetItem.physicalStock = Math.max(0, targetItem.physicalStock - qtyToDeduct);
                      targetItem.availableStock = Math.max(0, targetItem.physicalStock - (targetItem.reservedStock || 0));
                    } else {
                      targetItem = {
                        code: pCode || `FG-${Date.now().toString().slice(-4)}`,
                        name: pItem.name || pItem.description || 'Finished Good Item',
                        category: 'Finished Goods',
                        unit: pItem.uom || pItem.unit || 'Nos',
                        physicalStock: Math.max(0, 1000 - qtyToDeduct),
                        availableStock: Math.max(0, 1000 - qtyToDeduct),
                        reservedStock: 0,
                        safetyStock: 50,
                        bayLocation: 'Main Store'
                      };
                      prodModuleEngine.inventory.push(targetItem);
                    }

                    // Record in central audit log ledger for inventory traceability
                    const salesRepName = inv.salesPerson || (inv.createdByName ? `${inv.createdByName} (Sales)` : 'Sales Team');
                    const targetCodeName = targetItem ? targetItem.code : (pCode || 'FG-ITEM');
                    prodModuleEngine.addLedgerEntry({
                      timestamp: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
                      type: 'PRODUCTION_CONSUMPTION',
                      woId: invNoText,
                      itemCode: targetCodeName,
                      itemName: pItem.name || pItem.description || 'Finished Good Item',
                      qty: -qtyToDeduct,
                      unit: pItem.uom || pItem.unit || 'Nos',
                      previousStock: targetItem.physicalStock + qtyToDeduct,
                      newStock: targetItem.physicalStock,
                      user: 'Accounts & Billing Department',
                      employee: salesRepName,
                      reason: `Dispatch & Invoice Outflow (-${qtyToDeduct} ${pItem.uom || pItem.unit || 'Nos'}): Sales order BOM (${bomRefText}) invoiced (${invNoText}) by ${salesRepName}. Stock deducted from inventory.`,
                      referenceDoc: invNoText
                    });
                  });
                  prodModuleEngine.saveToStorage();
                } catch (e) { console.error('Invoice stock deduction engine error:', e); }

                // 4. Update controlroom_raw_materials_store accurately
                try {
                  const savedMatStr = localStorage.getItem('controlroom_raw_materials_store');
                  let currentMats = [];
                  if (savedMatStr) {
                    try { currentMats = JSON.parse(savedMatStr); } catch (e) { }
                  }
                  if (!Array.isArray(currentMats)) {
                    currentMats = [];
                  }

                  packedItemsToDeduct.forEach(pItem => {
                    const qtyToDeduct = parseInt(pItem.invQty || pItem.bomQty || pItem.qty || 1, 10) || 0;
                    const pCode = (pItem.code || '').toUpperCase().trim();
                    const pName = (pItem.name || pItem.description || '').toLowerCase().trim();

                    let match = currentMats.find(m => {
                      const mCode = (m.code || '').toUpperCase().trim();
                      const mName = (m.name || '').toLowerCase().trim();
                      if (pCode && mCode === pCode) return true;
                      if (pName && (mName === pName || mName.includes(pName) || pName.includes(mName))) return true;
                      return false;
                    });

                    if (match) {
                      const currSt = Math.max(0, parseInt(String(match.stock).replace(/,/g, ''), 10) || 0);
                      const newSt = Math.max(0, currSt - qtyToDeduct);
                      const minL = parseInt(String(match.minLevel || '100').replace(/,/g, ''), 10) || 100;
                      match.stock = newSt;
                      match.issuedProd = (match.issuedProd || 0) + qtyToDeduct;
                      match.status = newSt === 0 ? 'Out of Stock' : (newSt <= minL ? 'Low Stock' : 'In Stock');
                      match.lastUpdated = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                    } else {
                      const startStock = 1000;
                      const newSt = Math.max(0, startStock - qtyToDeduct);
                      currentMats.push({
                        code: pCode || `FG-${Date.now().toString().slice(-4)}`,
                        name: pItem.name || pItem.description || 'Finished Good Item',
                        cat: 'Finished Goods',
                        unit: pItem.uom || pItem.unit || 'Nos',
                        stock: newSt,
                        minLevel: 50,
                        status: newSt === 0 ? 'Out of Stock' : (newSt <= 50 ? 'Low Stock' : 'In Stock'),
                        store: 'Main Store',
                        hsn: pItem.hsn || pItem.hsnCode || getHsnCode(pItem),
                        lastUpdated: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                        reserved: 0,
                        openingStock: startStock,
                        goodsReceived: 0,
                        issuedProd: qtyToDeduct,
                        matReturn: 0,
                        stockAdj: 0
                      });
                    }
                  });

                  localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(currentMats));
                  saveCloudStore('raw_materials_store', currentMats);
                  window.dispatchEvent(new Event('controlroom_raw_materials_update'));
                } catch (err) { console.error('Error updating raw materials store:', err); }
              } // end if (!isStockAlreadyBlocked)

              // Deduct Inventory in Central Inventory Store
              try {
                centralInventoryStore.deductStockForBOM(bomRefText, packedItemsToDeduct, 'Accounts Invoice Confirmation');
                window.dispatchEvent(new Event('central_inventory_updated'));
                window.dispatchEvent(new Event('controlroom_storage_update'));
                window.dispatchEvent(new Event('storage'));
              } catch (cErr) {
                console.warn('Central inventory store deduction error in InvoiceDetailModal:', cErr);
              }

                // 5. Update Invoice status & persist to localStorage / cloud store
                const unpackedItems = (itemsList || []).filter(it => it.selected === false);
                const disclaimerClause = 'The Invoice is processed without the Address Proof so if any problem happens means VRM Structures India Private Limited will not take any responsibility.';
                const targetInvNumber = (invNoText && invNoText !== 'Pending Confirmation')
                  ? invNoText
                  : (inv.invNo && inv.invNo !== 'Pending Confirmation'
                    ? inv.invNo
                    : (matchingBom?.invoiceNo && matchingBom.invoiceNo !== 'Pending Confirmation'
                      ? matchingBom.invoiceNo
                      : (inv.code && inv.code !== 'Pending Confirmation' ? inv.code : 'VRM-INV-2026-01')));

                const finalInvAmt = cleanAmtNum(totalAmtRaw) || invAmtNum || bomTotalAmt || computedGrandTotal || 0;
                const formattedInvAmt = `₹ ${finalInvAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

                const confirmedInvRecord = {
                  ...inv,
                  id: inv.id || targetInvNumber,
                  invNo: targetInvNumber,
                  code: targetInvNumber,
                  invoiceNo: targetInvNumber,
                  invoiceNumber: targetInvNumber,
                  poNo: bomRefText,
                  bomCode: bomRefText,
                  vendor: customerText,
                  customerName: customerText,
                  date: invDateText || new Date().toISOString().split('T')[0],
                  invAmt: finalInvAmt,
                  total: finalInvAmt,
                  rawTotal: finalInvAmt,
                  amount: formattedInvAmt,
                  poVal: formattedInvAmt,
                  grnVal: formattedInvAmt,
                  status: 'Invoice Confirmed',
                  match: 'Matched',
                  pay: 'Completed & Locked',
                  stockDeducted: true,
                  stockDeductionDate: new Date().toISOString(),
                  packedItemsDeducted: packedItemsToDeduct,
                  unpackedItemsRemaining: unpackedItems,
                  addressProofReuploadRequested: false,
                  processedWithoutAddressProof: waiveProofDisclaimer ? true : Boolean(inv.processedWithoutAddressProof),
                  addressProofWaived: waiveProofDisclaimer ? true : Boolean(inv.addressProofWaived),
                  disclaimerTerm: waiveProofDisclaimer ? disclaimerClause : inv.disclaimerTerm,
                  terms: waiveProofDisclaimer
                    ? ((inv.terms ? inv.terms + '\n• ' : '') + disclaimerClause)
                    : inv.terms,
                  items: packedItemsToDeduct.length > 0 ? packedItemsToDeduct : (inv.items || matchingBom?.dispatchPacking || matchingBom?.items || [])
                };

                setInvoiceList(prev => {
                  const currentList = Array.isArray(prev) ? prev : [];
                  const matchKey = (item) =>
                    (item.invNo && item.invNo === targetInvNumber) ||
                    (item.code && item.code === targetInvNumber) ||
                    (item.id && item.id === confirmedInvRecord.id) ||
                    (item.bomCode && item.bomCode === bomRefText) ||
                    (item.poNo && item.poNo === bomRefText) ||
                    (inv.invNo && item.invNo === inv.invNo) ||
                    (inv.id && item.id === inv.id);

                  const exists = currentList.some(matchKey);
                  const updatedInvoices = exists
                    ? currentList.map(item => matchKey(item) ? { ...item, ...confirmedInvRecord } : item)
                    : [confirmedInvRecord, ...currentList];

                  try {
                    localStorage.setItem('controlroom_invoice_store', JSON.stringify(updatedInvoices.map(stripDataUrlsFromRecord)));
                    saveCloudInvoiceRow(confirmedInvRecord);
                  } catch (e) { }
                  return updatedInvoices;
                });

                // Update viewing modal state directly
                setViewingInvoiceModal(confirmedInvRecord);

                // Broadcast local event matching existing listeners
                try {
                  window.dispatchEvent(new CustomEvent('controlroom_invoice_store_updated', {
                    detail: { invoice: confirmedInvRecord }
                  }));
                  window.dispatchEvent(new Event('controlroom_storage_update'));
                  window.dispatchEvent(new Event('storage'));
                } catch (_) {}

                // 6. Update matching BOM status to 'Awaiting Vehicle Loading & Dispatch'
                const targetBomCode = (matchingBom && (matchingBom.bomCode || matchingBom.code)) || bomRefText || inv.bomCode || inv.poNo || inv.code;
                setBomStore(prev => {
                  const updatedBoms = (prev || []).map(b => (
                    (targetBomCode && isBomCodeMatching(b.bomCode || b.code || b.salesOrderNo, targetBomCode)) ||
                    (matchingBom && (b.bomCode === matchingBom.bomCode || b.code === matchingBom.code || b.id === matchingBom.id))
                  ) ? {
                    ...b,
                    status: (b.status === 'Completed' || b.status === 'COMPLETED & DISPATCHED' || b.status === 'Fully Dispatched & Delivered') ? b.status : 'Awaiting Vehicle Loading & Dispatch',
                    invoiceConfirmed: true,
                    invoiceConfirmedAt: b.invoiceConfirmedAt || new Date().toISOString(),
                    invoiceNo: targetInvNumber,
                    stockDeducted: true,
                    stockDeductionDate: new Date().toISOString(),
                    packedItemsDeducted: packedItemsToDeduct,
                    unpackedItemsRemaining: unpackedItems,
                    addressProofReuploadRequested: false,
                    processedWithoutAddressProof: waiveProofDisclaimer ? true : Boolean(b.processedWithoutAddressProof),
                    addressProofWaived: waiveProofDisclaimer ? true : Boolean(b.addressProofWaived),
                    disclaimerTerm: waiveProofDisclaimer ? disclaimerClause : b.disclaimerTerm
                  } : b);

                  try {
                    localStorage.setItem('controlroom_bom_store', JSON.stringify(updatedBoms.map(stripDataUrlsFromRecord)));
                    const matchedUpdated = updatedBoms.find(b => b.bomCode === targetBomCode || b.code === targetBomCode || (matchingBom && b.bomCode === matchingBom.bomCode));
                    if (matchedUpdated) {
                      saveCloudBomRow(matchedUpdated);
                      try {
                        autoDispatchOrderStatusToCustomer(matchedUpdated, 'INVOICE_CONFIRMED');
                      } catch (_) {}
                      fetch('/api/boms', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bom: stripDataUrlsFromRecord(matchedUpdated), isUpdate: true })
                      }).catch(() => {});
                      window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: { bom: matchedUpdated } }));
                    }
                    window.dispatchEvent(new Event('storage'));
                  } catch (persistErr) {
                    console.error('Error persisting BOM store upon invoice confirm:', persistErr);
                  }

                  return updatedBoms;
                });

                // 7. Post Invoice to BUSINZ Native Catalog API (/api/invoices) - Dynamic support for Individual Products vs Preset Packages
                const rawPresetGroups = matchingBom?.presetGroups || inv.presetGroups;
                const presetGroupsList = Array.isArray(rawPresetGroups)
                  ? rawPresetGroups
                  : (rawPresetGroups && typeof rawPresetGroups === 'object' ? Object.values(rawPresetGroups) : []);

                const isPresetOrder = Boolean(
                  (presetGroupsList && presetGroupsList.length > 0) ||
                  (matchingBom?.presetName && matchingBom.presetName !== 'Solar Mounting Structure Kit') ||
                  (inv.presetName && inv.presetName !== 'Solar Mounting Structure Kit')
                );

                let backendItems = [];
                let totalAmt = 0;
                let invoiceNotes = '';

                if (isPresetOrder) {
                  const presetName = (presetGroupsList.length > 0 && presetGroupsList[0]?.presetName) ||
                    matchingBom?.presetName || inv.presetName || 'Solar Mounting Structure Preset Kit';
                  const totalPresetPrice = Number(cleanAmtNum(totalAmtRaw) || invAmtNum || bomTotalAmt || computedGrandTotal || 0);
                  totalAmt = totalPresetPrice;

                  if (presetGroupsList.length > 0) {
                    presetGroupsList.forEach(grp => {
                      const setCount = parseFloat(grp.setCount) || 1;
                      const unitPrice = parseFloat(grp.kitPrice != null ? grp.kitPrice : grp.price) || 0;
                      const gName = grp.presetName || grp.name || presetName;
                      backendItems.push({
                        name: gName,
                        rate: unitPrice,
                        quantity: setCount,
                        unit: 'SET',
                        description: `Preset Structure Package: ${gName}${bomRefText ? ` (Ref BOM: ${bomRefText})` : ''}`
                      });
                    });

                    // Append any custom individual products added alongside the preset
                    const extraItems = (itemsList || []).filter(it => it.selected !== false && !it.isPresetItem && !it.presetGroupId);
                    extraItems.forEach(it => {
                      const q = parseFloat(it.invQty != null ? it.invQty : (it.qty != null ? it.qty : it.bomQty)) || 1;
                      const r = parseFloat(it.rate != null ? it.rate : it.unitPrice) || 0;
                      backendItems.push({
                        name: it.name || it.productName || 'Solar Structure Component',
                        rate: r,
                        quantity: q,
                        unit: it.uom || it.unit || 'Nos',
                        description: it.desc || it.description || ''
                      });
                    });
                  } else {
                    backendItems.push({
                      name: presetName,
                      rate: totalPresetPrice,
                      quantity: 1,
                      unit: 'SET',
                      description: `Preset Structure Package: ${presetName}${bomRefText ? ` (Ref BOM: ${bomRefText})` : ''}`
                    });
                  }
                  invoiceNotes = `Sales Invoice confirmed for BOM ${bomRefText} (${presetName}).`;
                } else {
                  // Individual products (Single product or multiple individual products)
                  const billedItems = (itemsList || []).filter(it => it.selected !== false);
                  const itemsToInclude = billedItems.length > 0 ? billedItems : (itemsList || []);

                  backendItems = itemsToInclude.map(it => {
                    const q = parseFloat(it.invQty != null ? it.invQty : (it.qty != null ? it.qty : it.bomQty)) || 1;
                    const r = parseFloat(it.rate != null ? it.rate : it.unitPrice) || 0;
                    return {
                      name: it.name || it.productName || 'Solar Structure Component',
                      rate: r,
                      quantity: q,
                      unit: it.uom || it.unit || 'Nos',
                      description: it.desc || it.description || ''
                    };
                  });

                  totalAmt = Number(cleanAmtNum(totalAmtRaw) || invAmtNum || bomTotalAmt || computedGrandTotal || 0);
                  invoiceNotes = `Sales Invoice confirmed for BOM ${bomRefText}.`;
                }

                if (waiveProofDisclaimer) {
                  invoiceNotes += `\nTerms: ${disclaimerClause}`;
                }

                try {
                  fetch('/api/invoices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      invNo: targetInvNumber,
                      invoiceNo: targetInvNumber,
                      poNo: bomRefText,
                      bomCode: bomRefText,
                      vendor: customerText,
                      customerName: customerText,
                      date: invDateText || new Date().toISOString().split('T')[0],
                      invAmt: totalAmt,
                      isPreset: isPresetOrder,
                      presetName: isPresetOrder ? (matchingBom?.presetName || inv.presetName) : undefined,
                      presetGroups: isPresetOrder ? presetGroupsList : undefined,
                      items: backendItems,
                      notes: invoiceNotes,
                      terms: waiveProofDisclaimer ? disclaimerClause : (inv.terms || undefined)
                    })
                  })
                    .then(res => res.json())
                    .then(data => {
                      if (data && data.invoice) {
                        const createdInv = data.invoice;
                        const finalConfirmedInvNo = createdInv.invoice_number || createdInv.invNo || targetInvNumber;
                        setInvoiceList(prev => {
                          const updated = (prev || []).map(item =>
                            (item.invNo === inv.invNo || item.code === inv.code || item.bomCode === inv.bomCode || item.poNo === bomRefText || item.invNo === targetInvNumber)
                              ? {
                                  ...item,
                                  invNo: finalConfirmedInvNo,
                                  code: finalConfirmedInvNo,
                                  invoiceNo: finalConfirmedInvNo,
                                  id: createdInv.id || item.id,
                                  invoiceNumber: finalConfirmedInvNo,
                                  status: 'Invoice Confirmed',
                                  pay: 'Completed & Locked',
                                  synced: true
                                }
                              : item
                          );
                          try {
                            localStorage.setItem('controlroom_invoice_store', JSON.stringify(updated.map(stripDataUrlsFromRecord)));
                          } catch (_) {}
                          return updated;
                        });
                        setBomStore(prev => {
                          const updated = (prev || []).map(b =>
                            (b.bomCode === bomRefText || b.code === bomRefText)
                              ? { ...b, invoiceNo: finalConfirmedInvNo, invoiceConfirmed: true }
                              : b
                          );
                          try {
                            localStorage.setItem('controlroom_bom_store', JSON.stringify(updated.map(stripDataUrlsFromRecord)));
                          } catch (_) {}
                          return updated;
                        });
                      }
                    })
                    .catch(err => console.warn('Invoice sync notice:', err));
                } catch (e) { console.error('Invoice fetch trigger error:', e); }

                // Trigger Real-time Workflow Notifications with synthesized sound & deep-links for Sales & Dispatch
                try {
                  notifyInvoiceCompletedReadyForDispatch({
                    invoiceNo: invNoText,
                    bomCode: bomRefText,
                    customerName: customerText,
                    salesPerson: inv.salesPerson || (matchingBom && matchingBom.salesPerson)
                  });
                } catch (notifErr) {
                  console.warn('Dispatch notification warning in InvoiceDetailModal:', notifErr);
                }

                // Return to main page cleanly - close modal and push user back to invoice ledger / table
                setIsEditingInvoice(false);
                setViewingInvoiceModal(null);
                if (typeof showCustomAlert === 'function') {
                  showCustomAlert(`Invoice ${invNoText} for BOM ${bomRefText} (${customerText}) confirmed successfully! Order forwarded to Dispatch for vehicle loading.`, 'Invoice Confirmed & Released', 'success');
                }
              }}
              style={{
                backgroundColor: '#3B82F6',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '0 20px',
                height: '38px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
              }}
            >
              <CheckCircle style={{ width: '16px', height: '16px', color: '#FFFFFF' }} /> Confirm Invoice & Send to Dispatch Loading
            </button>
          )}
        </div>
      </div>

      {/* CARD 1: TOP HEADER METRICS & INVOICE SUMMARY */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '24px',
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: '24px'
      }}>
        {/* Left Header Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#EEF2FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4F46E5'
            }}>
              <Receipt style={{ width: '26px', height: '26px' }} />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase' }}>Invoice Number</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#0F172A' }}>{invNoText}</h2>
                {(inv?.docType === 'DC' || matchingBom?.docType === 'DC') ? (
                  <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Truck size={12} strokeWidth={2.2} />
                    <span>DC (DELIVERY CHALLAN)</span>
                  </span>
                ) : (
                  <span style={{ backgroundColor: '#EEF2FF', color: '#3730A3', border: '1px solid #C7D2FE', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <FileText size={12} strokeWidth={2.2} />
                    <span>TAX INVOICE</span>
                  </span>
                )}
                {['Invoice Confirmed', 'CLOSED', 'Completed', 'Confirmed'].includes(inv.status) ? (
                  <span style={{ backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Check style={{ width: '13px', height: '13px', strokeWidth: 3 }} /> INVOICE COMPLETED & LOCKED
                  </span>
                ) : (
                  <span style={{ backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800' }}>
                    INVOICE PENDING
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Metadata Grid with Complete Payment Information */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 16px', borderTop: '1px solid #F1F5F9', paddingTop: '16px', fontSize: '12px' }}>
            <div>
              <div style={{ color: '#64748B', fontSize: '11px', fontWeight: '600' }}>Related BOM</div>
              <strong style={{ color: '#2563EB' }}>{bomRefText}</strong>
            </div>
            <div>
              <div style={{ color: '#64748B', fontSize: '11px', fontWeight: '600' }}>Invoice Date</div>
              <strong style={{ color: '#1E293B' }}>{invDateText}</strong>
            </div>
            <div>
              <div style={{ color: '#64748B', fontSize: '11px', fontWeight: '600' }}>Payment Due Date</div>
              <strong style={{ color: '#1E293B' }}>{invDateText}</strong>
            </div>

            <div>
              <div style={{ color: '#64748B', fontSize: '11px', fontWeight: '600' }}>Customer</div>
              <strong style={{ color: '#2563EB' }}>{customerText}</strong>
            </div>
            <div>
              <div style={{ color: '#64748B', fontSize: '11px', fontWeight: '600' }}>Sales Person</div>
              <strong style={{ color: '#0E7490', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <User size={13} style={{ color: '#0E7490' }} />
                {safeStringVal(inv.salesPerson || matchingBom?.salesPerson || matchingBom?.createdBy, 'Sales Department').replace(/\s*\([^)]*\)/g, '').trim()}
              </strong>
            </div>
            <div>
              <div style={{ color: '#64748B', fontSize: '11px', fontWeight: '600' }}>Payment Type</div>
              <strong style={{ color: '#1E293B' }}>{paymentTypeText}</strong>
            </div>

            <div>
              <div style={{ color: '#64748B', fontSize: '11px', fontWeight: '600', marginBottom: '3px' }}>Payment Status</div>
              <div>
                <span style={{
                  backgroundColor: (balanceAmt === 0 || ['Invoice Confirmed', 'CLOSED', 'Completed', 'Confirmed'].includes(inv.status)) ? '#DCFCE7' : '#FEF3C7',
                  color: (balanceAmt === 0 || ['Invoice Confirmed', 'CLOSED', 'Completed', 'Confirmed'].includes(inv.status)) ? '#166534' : '#B45309',
                  border: (balanceAmt === 0 || ['Invoice Confirmed', 'CLOSED', 'Completed', 'Confirmed'].includes(inv.status)) ? '1px solid #86EFAC' : '1px solid #FDE68A',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '10.5px',
                  fontWeight: '800',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: (balanceAmt === 0 || ['Invoice Confirmed', 'CLOSED', 'Completed', 'Confirmed'].includes(inv.status)) ? '#16A34A' : '#D97706' }} />
                  {['Invoice Confirmed', 'CLOSED', 'Completed', 'Confirmed'].includes(inv.status) ? 'Verified & Paid (100%)' : paymentStatusText}
                </span>
              </div>
            </div>
            <div>
              <div style={{ color: '#64748B', fontSize: '11px', fontWeight: '600' }}>Advance Received</div>
              <div style={{ fontWeight: '800', color: '#0F172A' }}>
                ₹ {advanceAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {isFullAdvance ? '(100%)' : (is50Percent ? '(50%)' : '')}
              </div>
            </div>
            <div>
              <div style={{ color: '#64748B', fontSize: '11px', fontWeight: '600' }}>Balance Amount</div>
              <div style={{ fontWeight: '800', color: balanceAmt === 0 ? '#166534' : '#DC2626' }}>
                ₹ {balanceAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Invoice Summary Box */}
        <div style={{
          backgroundColor: '#F8FAFC',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          justify: 'center'
        }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Invoice Summary</h4>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569' }}>
            <span>Subtotal (Before Tax)</span>
            <strong style={{ color: '#0F172A' }}>₹ {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </div>

          {isInvIntra ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569' }}>
                <span>CGST (9%)</span>
                <strong style={{ color: '#0F172A' }}>₹ {(taxGst / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569' }}>
                <span>SGST (9%)</span>
                <strong style={{ color: '#0F172A' }}>₹ {(taxGst / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569' }}>
              <span>IGST (18%)</span>
              <strong style={{ color: '#0F172A' }}>₹ {taxGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569' }}>
            <span>Shipping Charges</span>
            <strong style={{ color: '#0F172A' }}>₹ 0.00</strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569' }}>
            <span>Discount</span>
            <strong style={{ color: '#0F172A' }}>- ₹ 0.00</strong>
          </div>

          <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Grand Total</span>
            <strong style={{ fontSize: '20px', fontWeight: '800', color: '#4F46E5' }}>
              ₹ {totalAmtRaw.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>

          <div style={{ fontSize: '10px', color: '#64748B', fontStyle: 'italic', marginTop: '2px' }}>
            Amount in Words: <strong>Rupees {totalAmtRaw.toLocaleString('en-IN')} Only</strong>
          </div>
        </div>
      </div>

      {/* CARD 2: INVOICE ITEMS TABTABLE */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', gap: '24px' }}>
          {['Invoice Items', 'Additional Information'].map(t => (
            <button
              key={t}
              onClick={() => setInvoiceModalActiveTab(t)}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                padding: '10px 0',
                fontSize: '13px',
                fontWeight: '800',
                color: invoiceModalActiveTab === t ? '#4F46E5' : '#64748B',
                borderBottom: invoiceModalActiveTab === t ? '2px solid #4F46E5' : '2px solid transparent',
                cursor: 'pointer'
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* TAB CONTENT: INVOICE ITEMS */}
        {invoiceModalActiveTab === 'Invoice Items' && (() => {
          const indexedItemsList = itemsList.map((it, idx) => ({ ...it, originalIndex: idx }));
          const packedItems = indexedItemsList.filter(it => it.selected !== false);
          const unpackedItems = indexedItemsList.filter(it => it.selected === false);

          const targetRef = bomRefText || inv.poNo || inv.bomCode || inv.code;
          const foundBom = matchingBom || (bomStore || []).find(b => isBomCodeMatching(b.bomCode || b.code, targetRef));

          // Resolve authoritative preset groups from BOM / Invoice (preserving groupId keys)
          const rawInvPresetGroups = matchingBom?.presetGroups || foundBom?.presetGroups || inv.presetGroups || {};
          let invPresetGroups = (Array.isArray(rawInvPresetGroups) && rawInvPresetGroups.length > 0)
            ? rawInvPresetGroups.map((g, i) => ({ ...g, groupId: g?.groupId || g?.id || `preset-${i + 1}` }))
            : (typeof rawInvPresetGroups === 'object' && Object.keys(rawInvPresetGroups).length > 0)
              ? Object.entries(rawInvPresetGroups).map(([key, val]) => ({ ...val, groupId: val?.groupId || val?.id || key }))
              : [];

          // Legacy single-preset fallback if presetGroups is empty but preset metadata exists
          const fallbackPresetName = matchingBom?.presetName || foundBom?.presetName || inv.presetName || packedItems.find(it => it.presetName)?.presetName || '';
          const fallbackKitPrice = cleanAmtNum(matchingBom?.presetKitPrice || foundBom?.presetKitPrice || inv.presetKitPrice || matchingBom?.kitPrice || inv.kitPrice);
          const fallbackSetCount = parseFloat(matchingBom?.presetSetCount || foundBom?.presetSetCount || inv.presetSetCount || 1) || 1;
          if (invPresetGroups.length === 0 && (fallbackPresetName || fallbackKitPrice > 0 || packedItems.some(it => it.isPresetItem || it.presetGroupId))) {
            const defaultGstPct = extractGstRate(matchingBom?.gstRate ?? foundBom?.gstRate ?? inv.gstRate, 18);
            const fallbackSub = cleanAmtNum(matchingBom?.subTotal || foundBom?.subTotal || inv.subTotal) || (totalAmtRaw > 0 ? Math.round((totalAmtRaw / (1 + defaultGstPct / 100)) * 100) / 100 : 0);
            const knownStandaloneSub = packedItems
              .filter(it => !it.presetGroupId && !it.isPresetItem && parseFloat(it.rate || 0) > 0)
              .reduce((sum, it) => sum + (parseFloat(it.rate || 0) * (Number(it.bomQty || it.qty || 1) || 1)), 0);
            const resolvedKitSub = (fallbackKitPrice > 0)
              ? (fallbackKitPrice * fallbackSetCount)
              : (fallbackSub > knownStandaloneSub ? (fallbackSub - knownStandaloneSub) : fallbackSub);
            invPresetGroups = [{
              groupId: packedItems.find(it => it.presetGroupId)?.presetGroupId || 'preset-1',
              presetName: fallbackPresetName || 'Pre-Engineered Structure Kit Package',
              setCount: fallbackSetCount,
              unit: matchingBom?.presetUnit || foundBom?.presetUnit || (String(fallbackPresetName).toLowerCase().includes('kw') ? 'kW' : 'Sets'),
              kitPrice: fallbackKitPrice > 0 ? fallbackKitPrice : (resolvedKitSub > 0 ? Math.round((resolvedKitSub / fallbackSetCount) * 100) / 100 : 0),
              gstRate: defaultGstPct
            }];
          }

          // Strictly assign each packed item to at most ONE preset group (never merge presets)
          const assignedPackedIndices = new Set();
          const packedPresetSections = invPresetGroups.map((grp, gIdx) => {
            const grpId = grp.groupId || grp.id || null;
            const grpNameLower = String(grp.presetName || '').trim().toLowerCase();
            const grpItems = [];
            packedItems.forEach((it, pIdx) => {
              if (assignedPackedIndices.has(pIdx)) return;
              const byGroupId = Boolean(grpId && it.presetGroupId && String(it.presetGroupId) === String(grpId));
              const byPresetName = Boolean(!it.presetGroupId && grpNameLower && String(it.presetName || '').trim().toLowerCase() === grpNameLower);
              const isZeroRateItem = Boolean(!it.presetGroupId && !it.presetName && (it.isPresetItem || parseFloat(it.rate || 0) === 0) && gIdx === 0);
              if (byGroupId || byPresetName || isZeroRateItem) {
                assignedPackedIndices.add(pIdx);
                grpItems.push(it);
              }
            });
            return { grp, gIdx, items: grpItems };
          });
          if (packedPresetSections.length === 1 && packedPresetSections[0].items.length === 0 && packedItems.every(it => Number(it.rate || 0) === 0)) {
            packedItems.forEach((it, pIdx) => {
              assignedPackedIndices.add(pIdx);
              packedPresetSections[0].items.push(it);
            });
          }
          const visiblePackedPresetSections = packedPresetSections.filter(s => s.items.length > 0);
          const standalonePackedItems = packedItems.filter((_, pIdx) => !assignedPackedIndices.has(pIdx));

          const INV_PRESET_THEMES = [
            { primary: '#0E7490', bg: '#ECFEFF', border: '#A5F3FC', badge: 'SET 1' },
            { primary: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE', badge: 'SET 2' },
            { primary: '#D97706', bg: '#FFFBEB', border: '#FDE68A', badge: 'SET 3' },
            { primary: '#059669', bg: '#ECFDF5', border: '#A7F3D0', badge: 'SET 4' },
            { primary: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', badge: 'SET 5' },
          ];

          const packedPresetsGrandTotal = visiblePackedPresetSections.reduce((sum, sec) => {
            const sCount = parseFloat(sec.grp.setCount) || 1;
            const kPrice = cleanAmtNum(sec.grp.kitPrice);
            const kSub = sCount * kPrice;
            const rawGst = sec.grp.gstRate || sec.items[0]?.gstRate || (String(sec.grp.presetName || '').toLowerCase().includes('bos') && String(sec.grp.presetName || '').toLowerCase().includes('dcr') ? 5 : 18);
            const kGstPct = extractGstRate(rawGst, 18);
            return sum + kSub * (1 + kGstPct / 100);
          }, 0);
          const standalonePackedTotal = standalonePackedItems.reduce((acc, it) => {
            const qty = Number(it.bomQty || it.qty || 1) || 1;
            const rate = parseFloat(it.rate || 0) || 0;
            const pct = extractGstRate(it.gstRate ?? it.tax, 18);
            return acc + (it.amt > 0 ? Number(it.amt) : (qty * rate * (1 + pct / 100)));
          }, 0);
          const authoritativeTotal = cleanAmtNum(matchingBom?.grandTotal || inv.grandTotal || totalAmtRaw);
          const computedSum = packedPresetsGrandTotal + standalonePackedTotal;
          const packedTotal = (visiblePackedPresetSections.length > 0 && packedPresetsGrandTotal === 0 && standalonePackedTotal === 0 && totalAmtRaw > 0)
            ? totalAmtRaw
            : (authoritativeTotal > 0 && Math.abs(computedSum - authoritativeTotal) > 1 && visiblePackedPresetSections.length > 0
                ? authoritativeTotal
                : computedSum);
          const unpackedTotal = unpackedItems.reduce((acc, it) => acc + (it.isPresetItem ? 0 : (it.amt ?? ((it.qty || 1) * (it.rate || 0) * (1 + extractGstRate(it.gstRate ?? it.tax, 18) / 100)))), 0);
          const bomDoc = matchingBom?.deliveryAddressProofDoc || foundBom?.deliveryAddressProofDoc || null;
          const invDoc = inv.deliveryAddressProofDoc || null;
          let rawAddressProof = bomDoc || invDoc || null;
          if (bomDoc && invDoc) {
            const bomHistCount = Array.isArray(bomDoc.history) ? bomDoc.history.length : 0;
            const invHistCount = Array.isArray(invDoc.history) ? invDoc.history.length : 0;
            const bomTime = new Date(bomDoc.uploadedAt || bomDoc.reissuedAt || 0).getTime();
            const invTime = new Date(invDoc.uploadedAt || invDoc.reissuedAt || 0).getTime();
            if (bomHistCount > invHistCount || bomTime >= invTime) {
              rawAddressProof = bomDoc;
            } else {
              rawAddressProof = invDoc;
            }
          }
          let addressProofDoc = rawAddressProof;
          if (addressProofDoc && !addressProofDoc.dataUrl && addressProofDoc.name) {
            const cached = getMediaFromCache(addressProofDoc.name);
            if (cached) {
              addressProofDoc = { ...addressProofDoc, dataUrl: cached };
            }
          }
          const bAddr = safeStringVal(inv.billingAddress || matchingBom?.billingAddress || foundBom?.billingAddress, 'Plot No 42, SIDCO Industrial Estate, Ambattur, Chennai');
          const dAddr = safeStringVal(inv.deliveryAddress || matchingBom?.deliveryAddress || foundBom?.deliveryAddress, bAddr);
          const isSameAddress = Boolean(
            inv.sameAsBilling ||
            matchingBom?.sameAsBilling ||
            foundBom?.sameAsBilling ||
            (bAddr && dAddr && bAddr.trim().toLowerCase() === dAddr.trim().toLowerCase())
          );

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* TABLE 1: PACKED & DISPATCHED ITEMS (GREEN THEME) */}
              <div style={{ borderRadius: '12px', border: '1px solid #86EFAC', backgroundColor: '#F0FDF4', overflow: 'hidden', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle style={{ width: '18px', height: '18px', color: '#166534' }} />
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#166534' }}>
                      1. Packed & Dispatched Items ({packedItems.length})
                    </h4>
                  </div>
                  <span style={{ backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: '800' }}>
                    Ready for Invoice / Delivery
                  </span>
                </div>

                <div style={{ overflowX: 'auto', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #DCFCE7' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F0FDF4', color: '#166534', borderBottom: '1px solid #DCFCE7' }}>
                        <th style={{ padding: '10px' }}>Product Code</th>
                        <th style={{ padding: '10px' }}>Product Name</th>
                        <th style={{ padding: '10px' }}>Description</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>UOM</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>BOM Qty</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Unit Price</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Tax (%)</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '10px', textAlign: 'center', width: '120px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packedItems.length > 0 ? (
                        <>
                          {/* Preset Kit Groups — show Preset header & merged Preset Kit Price (NOT separate per-item prices) */}
                          {visiblePackedPresetSections.map((sec, sIdx) => {
                            const theme = INV_PRESET_THEMES[sIdx % INV_PRESET_THEMES.length];
                            const sCount = parseFloat(sec.grp.setCount) || 1;
                            const unitType = sec.grp.unit || sec.grp.unitType || (String(sec.grp.presetName || '').toLowerCase().includes('kw') ? 'kW' : 'Sets');
                            const kPrice = cleanAmtNum(sec.grp.kitPrice);
                            const kSub = sCount * kPrice;
                            const rawGst = sec.grp.gstRate || sec.items[0]?.gstRate || (String(sec.grp.presetName || '').toLowerCase().includes('bos') && String(sec.grp.presetName || '').toLowerCase().includes('dcr') ? 5 : 18);
                            const kGstPct = extractGstRate(rawGst, 18);
                            const kGstAmt = kSub * (kGstPct / 100);
                            const kGrandTotal = kSub + kGstAmt;

                            return (
                              <React.Fragment key={`inv-preset-${sec.grp.groupId || sIdx}`}>
                                <tr style={{ backgroundColor: theme.bg, borderTop: `2px solid ${theme.primary}`, borderBottom: `1.5px solid ${theme.border}` }}>
                                  <td colSpan={9} style={{ padding: '9px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                        <span style={{ backgroundColor: theme.primary, color: '#FFFFFF', fontSize: '10px', fontWeight: '900', padding: '2px 8px', borderRadius: '6px', letterSpacing: '0.5px' }}>
                                          {theme.badge}
                                        </span>
                                        <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#0F172A' }}>
                                          {sec.grp.presetName || 'Pre-Engineered Structure Kit'} ({sCount} {unitType})
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '11.5px', fontWeight: '700' }}>
                                        <span style={{ color: '#475569' }}>
                                          Kit Rate: <strong style={{ color: theme.primary }}>₹ {kPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> / {unitType}
                                        </span>
                                        <span style={{ color: '#166534' }}>
                                          GST ({kGstPct}%): <strong>₹ {kGstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                        </span>
                                        <span style={{ color: '#0E7490', fontWeight: '800' }}>
                                          Preset Total: <strong>₹ {kGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                                {sec.items.map((it, kIdx) => (
                                  <tr key={`inv-preset-item-${sIdx}-${kIdx}`} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: theme.bg }}>
                                    <td style={{ padding: '9px 10px', fontWeight: 'bold', color: '#475569', fontFamily: 'monospace' }}>
                                      {safeStringVal(it.code, `PRD-00${kIdx + 1}`)}
                                    </td>
                                    <td style={{ padding: '9px 10px', fontWeight: '700', color: '#0F172A' }}>
                                      {safeStringVal(it.name, 'Item')}
                                    </td>
                                    <td style={{ padding: '9px 10px', color: '#64748B' }}>
                                      {safeStringVal(it.desc || it.category, 'Preset component')}
                                    </td>
                                    <td style={{ padding: '9px 10px', textAlign: 'center', color: '#64748B' }}>
                                      {safeStringVal(it.uom, 'Nos')}
                                    </td>
                                    <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: '700', color: '#166534' }}>
                                      {Number(it.bomQty || it.qty || 1) || 1}
                                    </td>
                                    {kIdx === 0 && (
                                      <>
                                        <td rowSpan={sec.items.length} style={{ padding: '10px', textAlign: 'right', verticalAlign: 'middle', backgroundColor: '#FFFFFF', borderLeft: `1px solid ${theme.border}`, borderRight: `1px solid ${theme.border}` }}>
                                          <div style={{ fontWeight: '800', color: theme.primary }}>
                                            ₹ {kPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </div>
                                          <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}>
                                            {sCount} {unitType}
                                          </div>
                                        </td>
                                        <td rowSpan={sec.items.length} style={{ padding: '10px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#FFFFFF', borderRight: `1px solid ${theme.border}`, fontWeight: '700', color: '#475569' }}>
                                          {kGstPct}%
                                        </td>
                                        <td rowSpan={sec.items.length} style={{ padding: '10px', textAlign: 'right', verticalAlign: 'middle', backgroundColor: '#FFFFFF', borderRight: `1px solid ${theme.border}` }}>
                                          <div style={{ fontWeight: '800', color: '#166534' }}>
                                            ₹ {kGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </div>
                                          <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}>
                                            Sub: ₹ {kSub.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </div>
                                        </td>
                                      </>
                                    )}
                                    <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                                      <span style={{ backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        <Check style={{ width: '11px', height: '11px', strokeWidth: 3 }} /> Packed
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            );
                          })}

                          {/* Separate / Standalone Products — show individual Unit Price, Tax & Amount */}
                          {visiblePackedPresetSections.length > 0 && standalonePackedItems.length > 0 && (
                            <tr style={{ backgroundColor: '#F8FAFC', borderTop: '2px solid #64748B', borderBottom: '1px solid #CBD5E1' }}>
                              <td colSpan={9} style={{ padding: '8px 14px' }}>
                                <span style={{ padding: '2px 8px', borderRadius: '6px', backgroundColor: '#475569', color: '#FFFFFF', fontSize: '10px', fontWeight: '900', letterSpacing: '0.5px' }}>
                                  INDIVIDUAL / STANDALONE PRODUCTS
                                </span>
                              </td>
                            </tr>
                          )}

                          {standalonePackedItems.map((it, idx) => (
                            <tr key={`inv-standalone-${idx}`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '10px', fontWeight: 'bold', color: '#475569', fontFamily: 'monospace' }}>
                                {safeStringVal(it.code, `PRD-00${idx + 1}`)}
                              </td>
                              <td style={{ padding: '10px', fontWeight: '700', color: '#0F172A' }}>
                                {safeStringVal(it.name, 'Item')}
                              </td>
                              <td style={{ padding: '10px', color: '#64748B' }}>
                                {safeStringVal(it.desc || it.category, 'High grade component')}
                              </td>
                              <td style={{ padding: '10px', textAlign: 'center', color: '#64748B' }}>
                                {safeStringVal(it.uom, 'Nos')}
                              </td>
                              <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700', color: '#166534' }}>
                                {Number(it.bomQty || it.qty || 1) || 1}
                              </td>
                              <td style={{ padding: '10px', textAlign: 'right', color: '#475569' }}>
                                ₹ {parseFloat(it.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: '10px', textAlign: 'center', color: '#64748B' }}>
                                {safeStringVal(it.tax !== undefined ? it.tax : 18, '18')}%
                              </td>
                              <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', color: '#166534' }}>
                                ₹ {(it.amt > 0 ? parseFloat(it.amt) : ((parseFloat(it.bomQty || it.qty || 1) * parseFloat(it.rate || 0)) * (1 + (parseFloat(it.tax !== undefined ? it.tax : 18) / 100)))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: '10px', textAlign: 'center' }}>
                                <span style={{ backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <Check style={{ width: '11px', height: '11px', strokeWidth: 3 }} /> Packed
                                </span>
                              </td>
                            </tr>
                          ))}
                        </>
                      ) : (
                        <tr>
                          <td colSpan={9} style={{ padding: '16px', textAlign: 'center', color: '#64748B', fontStyle: 'italic' }}>
                            No items packed in dispatch yet.
                          </td>
                        </tr>
                      )}
                      <tr style={{ backgroundColor: '#F0FDF4', fontWeight: '800' }}>
                        <td colSpan={7} style={{ padding: '10px', textAlign: 'right', color: '#166534' }}>Subtotal (Packed Items)</td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#166534', fontSize: '13px' }}>
                          ₹ {packedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TABLE 2: UNPACKED / MISSING / PENDING ITEMS (RED THEME BELOW) */}
              <div style={{ borderRadius: '12px', border: '1px solid #FCA5A5', backgroundColor: '#FEF2F2', overflow: 'hidden', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle style={{ width: '18px', height: '18px', color: '#DC2626' }} />
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#991B1B' }}>
                      2. Unpacked / Pending Items ({unpackedItems.length}) — Pending Dispatch
                    </h4>
                  </div>
                  {unpackedItems.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof setPendingDcModal === 'function') {
                          setPendingDcModal({
                            ...inv,
                            invNo: invNoText,
                            poNo: bomRefText,
                            bomCode: bomRefText,
                            customerName: customerText,
                            vendor: customerText,
                            deliveryAddress: inv.deliveryAddress || matchingBom?.deliveryAddress || 'Client Delivery Site',
                            items: unpackedItems
                          });
                          if (typeof setViewingInvoiceModal === 'function') {
                            setViewingInvoiceModal(null);
                          }
                        }
                      }}
                      style={{
                        backgroundColor: '#DC2626',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: '800',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(220,38,38,0.25)'
                      }}
                    >
                      <Truck style={{ width: '13px', height: '13px' }} /> Create Delivery Challan (DC) for Pending Items
                    </button>
                  ) : (
                    <span style={{ backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <AlertCircle style={{ width: '12px', height: '12px' }} /> All items dispatched
                    </span>
                  )}
                </div>

                <div style={{ overflowX: 'auto', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #FEE2E2' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#FEF2F2', color: '#991B1B', borderBottom: '1px solid #FEE2E2' }}>
                        <th style={{ padding: '10px' }}>Product Code</th>
                        <th style={{ padding: '10px' }}>Product Name</th>
                        <th style={{ padding: '10px' }}>Description</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>UOM</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>BOM Qty</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Unit Price</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Tax (%)</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '10px', textAlign: 'center', width: '120px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unpackedItems.length > 0 ? unpackedItems.map((it, idx) => {
                        const origIdx = it.originalIndex !== undefined ? it.originalIndex : idx;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: '#FFF5F5' }}>
                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#475569', fontFamily: 'monospace' }}>
                              {safeStringVal(it.code, `PRD-00${idx + 1}`)}
                            </td>
                            <td style={{ padding: '10px', fontWeight: '700', color: '#991B1B' }}>
                              {safeStringVal(it.name, 'Item')}
                            </td>
                            <td style={{ padding: '10px', color: '#64748B' }}>
                              {safeStringVal(it.desc || it.category, 'High grade component')}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#64748B' }}>
                              {safeStringVal(it.uom, 'Nos')}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700', color: '#DC2626' }}>
                              {Number(it.bomQty || it.qty || 1) || 1}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'right', color: '#475569' }}>
                              ₹ {parseFloat(it.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#64748B' }}>
                              {safeStringVal(it.tax !== undefined ? it.tax : 18, '18')}%
                            </td>
                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', color: '#DC2626' }}>
                              ₹ {(it.amt ? parseFloat(it.amt) : ((parseFloat(it.bomQty || it.qty || 1) * parseFloat(it.rate || 0)) * (1 + (parseFloat(it.tax !== undefined ? it.tax : 18) / 100)))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <span style={{ backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <X style={{ width: '11px', height: '11px', strokeWidth: 3 }} /> Unpacked
                              </span>
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan={9} style={{ padding: '16px', textAlign: 'center', color: '#166534', fontWeight: '700' }}>
                            All BOM items are fully packed & dispatched! No pending items.
                          </td>
                        </tr>
                      )}
                      {unpackedItems.length > 0 && (
                        <tr style={{ backgroundColor: '#FEF2F2', fontWeight: '800' }}>
                          <td colSpan={7} style={{ padding: '10px', textAlign: 'right', color: '#991B1B' }}>Pending Subtotal (Unpacked Items)</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#DC2626', fontSize: '13px' }}>
                            ₹ {unpackedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* COMPACT ADDRESS & INLINE PROOF IMAGE BELOW ITEMS - ONLY IF DIFFERENT ADDRESS */}
              {!isSameAddress && (
                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Truck style={{ width: '18px', height: '18px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', letterSpacing: '0.5px', textTransform: 'uppercase' }}>DELIVERY DESTINATION</div>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>{dAddr}</div>
                      </div>
                    </div>

                    {/* REISSUE BUTTON FOR ADDRESS PROOF */}
                    <button
                      type="button"
                      onClick={async () => {
                        const targetCode = inv.poNo || inv.invNo || inv.code || (matchingBom && matchingBom.bomCode) || (foundBom && foundBom.bomCode);
                        const salesPersonName = (matchingBom?.salesPerson || matchingBom?.createdBy || inv.salesPerson || foundBom?.salesPerson || 'Sales Executive').replace(/\s*\([^)]*\)/g, '').trim();

                        const confirmMsg = `Send Address Proof Reissue Request to Sales (${salesPersonName}) for Order ${targetCode}?\n\nNOTE: Sales will have 1 hour to update this Address proof. Otherwise, the invoice will be automatically cancelled with: "Invoice Cancelled because of the Address Proof is missing are Mismatch".`;
                        if (!window.confirm(confirmMsg)) return;

                        try {
                          const nowIso = new Date().toISOString();

                          // 1. Update BOM in bomStore so it enters 'Address Proof Requested from Sales' state
                          let updatedBomRecord = null;
                          if (setBomStore) {
                            setBomStore(prev => {
                              const list = Array.isArray(prev) ? prev : [];
                              return list.map(b => {
                                const isMatch = (b.bomCode === targetCode || b.code === targetCode || b.id === targetCode || isBomCodeMatching(b.bomCode || b.code, targetCode));
                                if (isMatch) {
                                  updatedBomRecord = {
                                    ...b,
                                    status: 'Address Proof Requested from Sales',
                                    addressProofReuploadRequested: true,
                                    addressProofReuploadRequestedAt: nowIso,
                                    addressProofReuploadRequestedBy: 'Billing Desk',
                                    addressProofReissueReason: 'Address proof not clear / invalid. Reissued from Invoice Desk.'
                                  };
                                  return updatedBomRecord;
                                }
                                return b;
                              });
                            });
                          }

                          // 2. Persist updated BOM to server and cloud
                          if (updatedBomRecord) {
                            try {
                              saveCloudBomRow(updatedBomRecord);
                              fetch('/api/boms', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ bom: stripDataUrlsFromRecord(updatedBomRecord), isUpdate: true })
                              }).catch(() => {});
                            } catch (_) {}
                          }

                          // 3. Update Invoice in modal and list
                          const updatedInvoiceDoc = {
                            ...(addressProofDoc || {}),
                            reissueRequestedAt: nowIso,
                            reissueRequestedBy: 'Billing Desk'
                          };

                          setViewingInvoiceModal(prev => prev ? {
                            ...prev,
                            status: 'Address Proof Reissue Requested',
                            addressProofReuploadRequested: true,
                            addressProofReuploadRequestedAt: nowIso,
                            deliveryAddressProofDoc: updatedInvoiceDoc
                          } : prev);

                          if (setInvoiceList) {
                            setInvoiceList(prev => {
                              const list = Array.isArray(prev) ? prev : [];
                              const updated = list.map(i => (i.poNo === targetCode || i.invNo === inv.invNo || i.code === targetCode) ? {
                                ...i,
                                status: 'Address Proof Reissue Requested',
                                addressProofReuploadRequested: true,
                                addressProofReuploadRequestedAt: nowIso,
                                deliveryAddressProofDoc: updatedInvoiceDoc
                              } : i);
                              try {
                                const reissuedInv = updated.find(i => (i.poNo === targetCode || i.invNo === inv.invNo || i.code === targetCode));
                                if (reissuedInv) saveCloudInvoiceRow(reissuedInv);
                              } catch (e) { }
                              return updated;
                            });
                          }

                          // 4. Trigger Real-time notifications and system events
                          try {
                            addLiveNotification({
                              title: 'Address Proof Reissue Requested (1 Hr SLA)',
                              message: `Invoice Desk requested verified address proof from Sales (${salesPersonName}) for BOM ${targetCode}. Must be updated within 1 hour.`,
                              type: 'warning'
                            });
                            notifyAddressProofPendingToSales({
                              bomCode: targetCode,
                              customerName: inv.customerName || inv.party || matchingBom?.customerName,
                              salesPerson: salesPersonName,
                              salesPersonCode: matchingBom?.salesPersonEmpCode || matchingBom?.salesPersonId || foundBom?.salesPersonEmpCode
                            });
                            if (updatedBomRecord) {
                              window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: { bom: updatedBomRecord } }));
                            }
                            window.dispatchEvent(new Event('controlroom_storage_update'));
                          } catch (_) {}

                          alert(`Reissue request sent to Sales (${salesPersonName}) for order ${targetCode}!\n\nSales has 1 hour to update this Address proof. If not updated within 1 hour, the invoice will be automatically cancelled with "Invoice Cancelled because of the Address Proof is missing are Mismatch".`);
                        } catch (err) {
                          alert(`Address proof reissue request failed: ${err.message}`);
                        }
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        color: '#1D4ED8',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        transition: 'all 0.15s ease'
                      }}
                      title="Request Sales person to re-upload verified address proof document (1 Hour SLA)"
                    >
                      <RotateCcw style={{ width: '13px', height: '13px', color: '#1D4ED8' }} />
                      Reissue
                    </button>
                  </div>

                  {/* Reissue 1-Hour SLA Warning Banner & Disclaimer Status */}
                  {(() => {
                    const isReissuePending = Boolean(
                      inv.addressProofReuploadRequested ||
                      matchingBom?.addressProofReuploadRequested ||
                      matchingBom?.status === 'Address Proof Requested from Sales' ||
                      inv.status === 'Address Proof Reissue Requested'
                    );

                    if (isReissuePending && reissueSecondsLeft !== null) {
                      const mins = Math.floor(reissueSecondsLeft / 60);
                      const secs = reissueSecondsLeft % 60;
                      const formattedTime = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;

                      return (
                        <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock style={{ width: '16px', height: '16px', color: '#DC2626', flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '800', color: '#991B1B' }}>
                                Reissue SLA Active: Sales has 1 hour to update Address Proof — Time Remaining: <span style={{ fontFamily: 'monospace', fontSize: '13px', backgroundColor: '#FEE2E2', padding: '2px 6px', borderRadius: '4px', border: '1px solid #FCA5A5' }}>{formattedTime}</span>
                              </div>
                              <div style={{ fontSize: '11px', color: '#B91C1C', marginTop: '2px' }}>
                                If not updated within 1 hour, this invoice will be automatically cancelled with: <em>"Invoice Cancelled because of the Address Proof is missing are Mismatch"</em>.
                              </div>
                            </div>
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: '800', backgroundColor: '#DC2626', color: '#FFFFFF', padding: '4px 10px', borderRadius: '6px', fontFamily: 'monospace' }}>
                            ⏱️ {formattedTime}
                          </span>
                        </div>
                      );
                    }

                    if (inv.processedWithoutAddressProof || inv.addressProofWaived) {
                      return (
                        <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <AlertTriangle style={{ width: '16px', height: '16px', color: '#D97706', flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: '800', color: '#92400E' }}>
                              Processed without Address Proof (T&amp;C Clause Applied)
                            </div>
                            <div style={{ fontSize: '11px', color: '#78350F', marginTop: '2px', fontWeight: '600' }}>
                              "The Invoice is processed without the Address Proof so if any problem happens means VRM Structures India Private Limited will not take any responsibility."
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })()}

                  {(() => {
                    const historyList = (addressProofDoc?.history && addressProofDoc.history.length > 0)
                      ? addressProofDoc.history
                      : (addressProofDoc ? [addressProofDoc] : []);

                    const activeDoc = (selectedProofVersionIdx !== null && historyList[selectedProofVersionIdx])
                      ? historyList[selectedProofVersionIdx]
                      : addressProofDoc;

                    const proofName = safeStringVal(typeof activeDoc === "string" ? activeDoc : (activeDoc?.originalName || activeDoc?.name), "Delivery Address Proof Document");
                    let proofDataUrl = (typeof activeDoc === "string" && (activeDoc.startsWith("data:") || activeDoc.startsWith("http") || activeDoc.startsWith("/")))
                      ? activeDoc
                      : (activeDoc?.dataUrl || activeDoc?.fileData || activeDoc?.url || null);

                    if (!proofDataUrl) {
                      proofDataUrl = resolveDocumentUrl(activeDoc, bomRefText) || (selectedProofVersionIdx === null ? resolvedAddressProofUrl : null);
                    }
                    if (!proofDataUrl && proofName) {
                      proofDataUrl = getMediaFromCache(proofName);
                    }

                    const isPdf = Boolean(
                      (proofName && proofName.toLowerCase().endsWith('.pdf')) ||
                      (proofDataUrl && (proofDataUrl.startsWith('data:application/pdf') || proofDataUrl.includes('.pdf')))
                    );

                    if (!addressProofDoc) {
                      return (
                        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ padding: '14px 16px', borderRadius: '10px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <AlertCircle style={{ width: '18px', height: '18px', color: '#D97706', flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '800', color: '#B45309' }}>
                                Address Proof Document Not Attached by Sales
                              </div>
                              <div style={{ fontSize: '11px', color: '#92400E', marginTop: '2px' }}>
                                This order has a delivery destination different from the billing address. Click <strong>Reissue</strong> above to request Sales to attach the verified address proof (1 hr SLA). Or complete invoice with the mandatory Terms &amp; Conditions liability disclaimer.
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ fontSize: '12px', fontWeight: '800', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileCheck style={{ width: '15px', height: '15px', color: '#166534' }} />
                            <span>Delivery Address Proof Document ({proofName}):</span>
                          </div>
                          {proofDataUrl && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setLocalDocPreviewModal({
                                    title: `Delivery Address Proof — ${proofName}`,
                                    doc: { name: proofName, dataUrl: proofDataUrl, url: proofDataUrl },
                                    bomCode: bomRefText
                                  });
                                }}
                                style={{ border: 'none', background: '#EFF6FF', color: '#1D4ED8', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Eye size={12} /> Inspect Full Screen
                              </button>
                              <a
                                href={proofDataUrl}
                                download={proofName}
                                style={{ fontSize: '11px', fontWeight: '700', color: '#1D4ED8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#F1F5F9', padding: '4px 10px', borderRadius: '6px' }}
                              >
                                <Download size={12} /> Download
                              </a>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {historyList.length > 1 && (
                            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Document Version History ({historyList.length} Uploads Tracked - Click to View):
                            </div>
                          )}

                          <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', padding: '12px', textAlign: 'center' }}>
                            {proofDataUrl ? (
                              isPdf ? (
                                <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                  <div style={{ width: '48px', height: '48px', borderRadius: '10px', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FileText size={28} />
                                  </div>
                                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{proofName}</div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLocalDocPreviewModal({
                                        title: `Delivery Address Proof (PDF) — ${proofName}`,
                                        doc: { name: proofName, dataUrl: proofDataUrl, url: proofDataUrl },
                                        bomCode: bomRefText
                                      });
                                    }}
                                    style={{ border: 'none', backgroundColor: '#0E7490', color: 'white', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                  >
                                    <Eye size={14} /> Open Verified PDF Document
                                  </button>
                                </div>
                              ) : (
                                <img
                                  src={proofDataUrl}
                                  alt="Delivery Address Proof"
                                  onError={(e) => {
                                    const fallback = activeDoc?.storagePath ? `/api/uploads/bom-documents/${activeDoc.storagePath}` : `/api/media/find/${encodeURIComponent(proofName)}`;
                                    if (e.target.src !== fallback && !e.target.dataset.triedFallback) {
                                      e.target.dataset.triedFallback = '1';
                                      e.target.src = fallback;
                                    }
                                  }}
                                  onClick={() => {
                                    setLocalDocPreviewModal({
                                      title: `Delivery Address Proof — ${proofName}`,
                                      doc: { name: proofName, dataUrl: proofDataUrl, url: proofDataUrl },
                                      bomCode: bomRefText
                                    });
                                  }}
                                  style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', cursor: 'pointer' }}
                                />
                              )
                            ) : (
                              <div style={{ padding: '24px', color: '#64748B', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <FileCheck size={18} color="#0E7490" />
                                <span>{proofName} (Uploaded Address Proof File)</span>
                              </div>
                            )}
                          </div>

                          {historyList.length > 1 && (
                            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingTop: '6px' }}>
                              {historyList.map((hDoc, hIdx) => {
                                const isSelected = (selectedProofVersionIdx === hIdx) || (selectedProofVersionIdx === null && hIdx === historyList.length - 1);
                                return (
                                  <div
                                    key={hIdx}
                                    onClick={() => setSelectedProofVersionIdx(hIdx)}
                                    style={{
                                      border: isSelected ? '1.5px solid #2563EB' : '1px solid #E2E8F0',
                                      backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                                      borderRadius: '8px',
                                      padding: '8px 12px',
                                      fontSize: '11px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease'
                                    }}
                                    title={`Click to view Version ${hIdx + 1}`}
                                  >
                                    <FileText style={{ width: '14px', height: '14px', color: isSelected ? '#1D4ED8' : '#2563EB' }} />
                                    <div>
                                      <div style={{ fontWeight: '700', color: isSelected ? '#1D4ED8' : '#0F172A' }}>
                                        Version {hIdx + 1}: {safeStringVal(hDoc?.name || hDoc?.originalName, 'Proof.png')} {hIdx === 0 ? '(Original)' : '(Reissued)'}
                                      </div>
                                      <div style={{ fontSize: '10px', color: '#64748B' }}>
                                        {hDoc.uploadedAt ? new Date(hDoc.uploadedAt).toLocaleString('en-GB') : 'Uploaded'}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })()}

        {/* TAB CONTENT: ADDITIONAL INFORMATION (ADDRESSES & MANDATORY ADDRESS PROOF) */}
        {invoiceModalActiveTab === 'Additional Information' && (() => {
          const foundBom = matchingBom || (bomStore || []).find(b => isBomCodeMatching(b.bomCode || b.code, bomRefText || inv.poNo || inv.bomCode));
          const addressProofDoc = inv.deliveryAddressProofDoc || matchingBom?.deliveryAddressProofDoc || foundBom?.deliveryAddressProofDoc || null;
          const bObj = inv.billingAddressObj || matchingBom?.billingAddressObj || {};
          const dObj = inv.deliveryAddressObj || matchingBom?.deliveryAddressObj || {};
          const rawBAddr = inv.billingAddress || matchingBom?.billingAddress || bObj.address || 'Plot No 42, SIDCO Industrial Estate, Ambattur, Chennai, Tamil Nadu - 600058';
          const rawDAddr = inv.deliveryAddress || matchingBom?.deliveryAddress || dObj.address || rawBAddr;
          const bAddr = safeStringVal(rawBAddr, 'Plot No 42, SIDCO Industrial Estate, Ambattur, Chennai, Tamil Nadu - 600058');
          const dAddr = safeStringVal(rawDAddr, bAddr);
          const isSame = Boolean(inv.sameAsBilling || matchingBom?.sameAsBilling || (bAddr.trim() === dAddr.trim()));

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Billing Address Card */}
                <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                      <FileText style={{ width: '15px', height: '15px' }} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Registered Billing Address</h4>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Primary address for GST invoicing & books</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', color: '#1E293B', fontWeight: '600', lineHeight: '1.5' }}>
                    {bAddr}
                  </div>
                </div>

                {/* Delivery Address Card */}
                <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5' }}>
                        <Truck style={{ width: '15px', height: '15px' }} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Physical Delivery Destination</h4>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>Shipping address for goods delivery</span>
                      </div>
                    </div>
                    {isSame && (
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#166534', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '12px' }}>
                        Same as Billing
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: '#1E293B', fontWeight: '600', lineHeight: '1.5' }}>
                    {dAddr}
                  </div>
                </div>
              </div>

              {/* ADDRESS PROOF DOCUMENT PREVIEW CARD - ONLY IF DIFFERENT ADDRESS */}
              {!isSame && addressProofDoc && (() => {
                const docName = safeStringVal(typeof addressProofDoc === "string" ? addressProofDoc : (addressProofDoc?.originalName || addressProofDoc?.name), "Address_Proof_Document.png");
                const docUrl = resolvedAddressProofUrl || (typeof addressProofDoc === "string" ? addressProofDoc : (addressProofDoc?.dataUrl || addressProofDoc?.fileData || addressProofDoc?.url || resolveDocumentUrl(addressProofDoc, bomRefText)));
                const isPdf = Boolean((docName && docName.toLowerCase().endsWith('.pdf')) || (docUrl && (docUrl.startsWith('data:application/pdf') || docUrl.includes('.pdf'))));

                return (
                  <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#DCFCE7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileCheck style={{ width: '20px', height: '20px' }} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#166534' }}>
                            Delivery Address Proof Document
                          </h4>
                          <span style={{ fontSize: '12px', color: '#64748B' }}>
                            Mandatory proof attached for alternate delivery address: {docName}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {docUrl && (
                          <a
                            href={docUrl}
                            download={docName}
                            style={{ textDecoration: 'none', backgroundColor: '#FFFFFF', color: '#166534', border: '1px solid #BBF7D0', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' }}
                          >
                            <Download size={13} /> Download
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setLocalDocPreviewModal({
                              title: `Delivery Address Proof — ${docName}`,
                              doc: { name: docName, dataUrl: docUrl, url: docUrl },
                              bomCode: bomRefText
                            });
                          }}
                          style={{ border: 'none', backgroundColor: '#166534', color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(22,101,52,0.2)' }}
                        >
                          <Eye style={{ width: '14px', height: '14px' }} /> Inspect Address Proof
                        </button>
                      </div>
                    </div>

                    {docUrl && (
                      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', maxHeight: '280px', overflow: 'hidden' }}>
                        {isPdf ? (
                          <div style={{ padding: '16px', textAlign: 'center' }}>
                            <FileText size={32} color="#DC2626" style={{ margin: '0 auto 8px' }} />
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#1E293B' }}>{docName}</div>
                            <span style={{ fontSize: '11px', color: '#166534' }}>PDF Document Attached</span>
                          </div>
                        ) : (
                          <img
                            src={docUrl}
                            alt="Address Proof Thumbnail"
                            onError={(e) => {
                              const fallback = addressProofDoc?.storagePath ? `/api/uploads/bom-documents/${addressProofDoc.storagePath}` : `/api/media/find/${encodeURIComponent(docName)}`;
                              if (e.target.src !== fallback && !e.target.dataset.triedFallback) {
                                e.target.dataset.triedFallback = '1';
                                e.target.src = fallback;
                              }
                            }}
                            onClick={() => {
                              setLocalDocPreviewModal({
                                title: `Delivery Address Proof — ${docName}`,
                                doc: { name: docName, dataUrl: docUrl, url: docUrl },
                                bomCode: bomRefText
                              });
                            }}
                            style={{ maxHeight: '250px', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px', cursor: 'pointer' }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* PAYMENT / BILLING PROOF DOCUMENT CARD */}
              {(() => {
                const paymentProofDoc = inv.paymentProofDoc || matchingBom?.paymentProofDoc || matchingBom?.paymentProof || null;
                if (!paymentProofDoc) return null;

                const pName = safeStringVal(typeof paymentProofDoc === "string" ? paymentProofDoc : (paymentProofDoc?.originalName || paymentProofDoc?.name), "Payment_Remittance_Slip.png");
                const pUrl = resolvedPaymentProofUrl || (typeof paymentProofDoc === "string" ? paymentProofDoc : (paymentProofDoc?.dataUrl || paymentProofDoc?.fileData || paymentProofDoc?.url || resolveDocumentUrl(paymentProofDoc, bomRefText)));
                const isPdf = Boolean((pName && pName.toLowerCase().endsWith('.pdf')) || (pUrl && (pUrl.startsWith('data:application/pdf') || pUrl.includes('.pdf'))));

                return (
                  <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#DCFCE7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Receipt style={{ width: '20px', height: '20px' }} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#166534' }}>
                            Verified Payment &amp; Remittance Slip
                          </h4>
                          <span style={{ fontSize: '12px', color: '#64748B' }}>
                            Terms: <strong>{paymentTypeText}</strong> • Slip: {pName}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {pUrl && (
                          <a
                            href={pUrl}
                            download={pName}
                            style={{ textDecoration: 'none', backgroundColor: '#FFFFFF', color: '#166534', border: '1px solid #BBF7D0', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' }}
                          >
                            <Download size={13} /> Download
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setLocalDocPreviewModal({
                              title: `Payment & Remittance Slip — ${pName}`,
                              doc: { name: pName, dataUrl: pUrl, url: pUrl },
                              bomCode: bomRefText
                            });
                          }}
                          style={{ border: 'none', backgroundColor: '#166534', color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(22,101,52,0.2)' }}
                        >
                          <Eye style={{ width: '14px', height: '14px' }} /> Inspect Payment Slip
                        </button>
                      </div>
                    </div>

                    {pUrl && (
                      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', maxHeight: '280px', overflow: 'hidden' }}>
                        {isPdf ? (
                          <div style={{ padding: '16px', textAlign: 'center' }}>
                            <FileText size={32} color="#DC2626" style={{ margin: '0 auto 8px' }} />
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#1E293B' }}>{pName}</div>
                            <span style={{ fontSize: '11px', color: '#166534' }}>PDF Document Attached</span>
                          </div>
                        ) : (
                          <img
                            src={pUrl}
                            alt="Payment Slip Thumbnail"
                            onError={(e) => {
                              const fallback = paymentProofDoc?.storagePath ? `/api/uploads/bom-documents/${paymentProofDoc.storagePath}` : `/api/media/find/${encodeURIComponent(pName)}`;
                              if (e.target.src !== fallback && !e.target.dataset.triedFallback) {
                                e.target.dataset.triedFallback = '1';
                                e.target.src = fallback;
                              }
                            }}
                            onClick={() => {
                              setLocalDocPreviewModal({
                                title: `Payment & Remittance Slip — ${pName}`,
                                doc: { name: pName, dataUrl: pUrl, url: pUrl },
                                bomCode: bomRefText
                              });
                            }}
                            style={{ maxHeight: '250px', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px', cursor: 'pointer' }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })()}
      </div>

      {/* CARD 3: BOTTOM PANEL - COMPLETE ORDER & INVOICE WORKFLOW TIMELINE (FULL WIDTH) */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
              <Clock style={{ width: '16px', height: '16px' }} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Complete Order & Invoice Workflow Timeline</h4>
              <span style={{ fontSize: '11px', color: '#64748B' }}>End-to-end lifecycle from BOM configuration to final dispatch</span>
            </div>
          </div>
          <span style={{ backgroundColor: '#F1F5F9', color: '#475569', padding: '4px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '800' }}>
            5 Stages Tracked
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '20px', borderLeft: '2px solid #E2E8F0' }}>
            {(() => {
              // 1. BOM Creation details
              const bomCreatorName = safeStringVal(matchingBom?.createdBy || matchingBom?.createdByName || matchingBom?.salesPerson, 'Balaji (BOM Executive)');
              const bomCreatorRole = safeStringVal(matchingBom?.createdByRole, 'Design & BOM Team');
              const bomCreatedDate = safeStringVal(matchingBom?.createdAt || matchingBom?.date, `${invDateText}, 09:00 AM`);
              const bomItemCount = (matchingBom?.items || itemsList || []).length;

              // 2. Dispatch Packing details
              const dispatchPackerName = safeStringVal(matchingBom?.packedBy || matchingBom?.dispatchPackedBy, 'Karthik Raja (Dispatch Head)');
              const dispatchPackerRole = 'Dispatch & Warehouse Team';
              const dispatchPackedDate = safeStringVal(matchingBom?.packedAt || matchingBom?.dispatchDate, `${invDateText}, 09:45 AM`);
              const allPackingList = (matchingBom?.dispatchPacking && Array.isArray(matchingBom.dispatchPacking) && matchingBom.dispatchPacking.length > 0)
                ? matchingBom.dispatchPacking
                : (matchingBom?.items || itemsList || []).map(it => ({ name: it.name, code: it.code, bomQty: it.bomQty || it.qty || 1, packed: it.selected !== false }));
              const packedItemsCount = allPackingList.filter(p => Boolean(p.packed)).length;
              const totalPackItemsCount = allPackingList.length;

              // Packing photos / videos (from BOM or vehicleLoading)
              const rawPhotos = matchingBom?.packingPhotos || matchingBom?.packingPhotoList || matchingBom?.vehicleLoading?.photos || [];
              const packingPhotosList = (Array.isArray(rawPhotos) && rawPhotos.length > 0)
                ? rawPhotos
                : (matchingBom?.packingPhotoUrl ? [{ id: 'p1', name: 'Packing_Inspection_Photo.jpg', dataUrl: matchingBom.packingPhotoUrl, capturedAt: '09:45 AM' }] : []);
              
              const rawVideos = matchingBom?.packingVideos || matchingBom?.packingVideoList || matchingBom?.vehicleLoading?.videos || [];
              const packingVideosList = (Array.isArray(rawVideos) && rawVideos.length > 0)
                ? rawVideos
                : (matchingBom?.packingVideoUrl ? [{ id: 'v1', name: 'Packing_Process_Video.mp4', dataUrl: matchingBom.packingVideoUrl, recordedAt: '09:48 AM' }] : []);

              // Default SVG sample photo if none uploaded yet so user can preview interactive photo verification
              const effectivePhotoUrl = packingPhotosList[0]?.dataUrl || ("data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380"><rect width="100%" height="100%" fill="#0F172A"/><rect x="20" y="20" width="560" height="50" fill="#1E3A5F" rx="8"/><text x="40" y="52" fill="#FFFFFF" font-family="sans-serif" font-size="16" font-weight="bold">DISPATCH PACKING &amp; BOX INSPECTION PHOTO</text><rect x="40" y="90" width="240" height="180" fill="#1E293B" stroke="#334155" stroke-width="2" rx="10"/><rect x="320" y="90" width="240" height="180" fill="#1E293B" stroke="#334155" stroke-width="2" rx="10"/><text x="60" y="140" fill="#38BDF8" font-family="sans-serif" font-size="14" font-weight="bold">📦 Shipment Box #1</text><text x="60" y="170" fill="#94A3B8" font-family="sans-serif" font-size="12">Mid 30mm Clamps (500 Nos)</text><text x="60" y="195" fill="#94A3B8" font-family="sans-serif" font-size="12">Fasteners &amp; Hex Bolts</text><text x="60" y="235" fill="#4ADE80" font-family="sans-serif" font-size="12" font-weight="bold">✓ Physical QC Verified</text><text x="340" y="140" fill="#38BDF8" font-family="sans-serif" font-size="14" font-weight="bold">📦 Shipment Box #2</text><text x="340" y="170" fill="#94A3B8" font-family="sans-serif" font-size="12">Mini Rail 100mm Strips</text><text x="340" y="195" fill="#94A3B8" font-family="sans-serif" font-size="12">EPDM Rubber Gaskets</text><text x="340" y="235" fill="#4ADE80" font-family="sans-serif" font-size="12" font-weight="bold">✓ Labelled &amp; Strapped</text><rect x="40" y="300" width="520" height="50" fill="#064E3B" stroke="#059669" rx="8"/><text x="60" y="332" fill="#6EE7B7" font-family="sans-serif" font-size="13" font-weight="bold">✓ DISPATCH PACKING VERIFIED • PACKER: KARTHIK RAJA (DISPATCH HEAD)</text></svg>'));

              // 3. Accounts Verification details (Date of Amount Received)
              const accData = (matchingBom && matchingBom.accountsVerification) || inv.accountsVerification || {};
              const approverName = safeStringVal(accData.verifiedBy || inv.verifiedBy, 'Accounts Head (Venkatesh)');
              const approverRole = safeStringVal(accData.verifiedByRole, 'Accounts Approver');
              const rawPaymentDate = accData.paymentDate || matchingBom?.paymentDate || inv.paymentDate || inv.accountsVerification?.paymentDate || null;
              const formattedPaymentDate = (() => {
                if (!rawPaymentDate) return null;
                const str = String(rawPaymentDate).trim();
                if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
                  const [y, m, d] = str.split('-');
                  const dt = new Date(Number(y), Number(m) - 1, Number(d));
                  if (!isNaN(dt.getTime())) {
                    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                  }
                }
                return str;
              })();

              const isAccVerified = Boolean(accData.verified || inv.status === 'Accounts Verified & Passed to Invoice' || inv.status === 'Invoice Confirmed');
              const approvalTime = formattedPaymentDate
                ? formattedPaymentDate
                : (isAccVerified ? safeStringVal(accData.verifiedAt, invDateText) : 'Pending Accounts Verification');

              // 4. Invoice details
              const isConfirmed = ['Invoice Confirmed', 'CLOSED', 'Completed', 'Confirmed', 'Fully Dispatched & Delivered'].includes(inv.status);
              const invoicePersonName = isConfirmed ? safeStringVal(inv.confirmedBy || matchingBom?.invoiceConfirmedBy, 'Priya (Billing & Invoice Exec)') : 'Priya / Anand (Billing Exec)';
              const invoicePersonRole = 'Finance & Billing Team';
              const invoiceTime = isConfirmed ? safeStringVal(inv.confirmedAt, `${invDateText}, 10:25 AM`) : `${invDateText}, 10:16 AM`;

              // 5. Final Dispatch & Vehicle Loading
              const vLoading = matchingBom?.vehicleLoading || inv.vehicleLoading || null;
              const isDispatched = Boolean(vLoading || matchingBom?.status === 'Completed' || inv.status === 'Fully Dispatched & Delivered');
              const driverText = vLoading ? `${safeStringVal(vLoading.driverName, 'K. Murugan')} (${safeStringVal(vLoading.vehicleNo, 'TN-09-CB-4821')})` : 'Despatch Logistics Crew';

              const timelineSteps = [
                {
                  stage: 'BOM Creation',
                  title: 'BOM Created & Configured',
                  date: bomCreatedDate,
                  user: bomCreatorName,
                  role: bomCreatorRole,
                  color: '#0891B2',
                  badge: `${bomItemCount} Line Items Configured`,
                  badgeColor: '#ECFEFF',
                  badgeTextColor: '#0E7490',
                  borderColor: '#A5F3FC'
                },
                {
                  stage: 'Dispatch Packing',
                  title: 'Dispatch Packing & Inspection',
                  date: dispatchPackedDate,
                  user: dispatchPackerName,
                  role: dispatchPackerRole,
                  color: '#059669',
                  badge: `${packedItemsCount}/${totalPackItemsCount} Items Packed`,
                  badgeColor: '#F0FDF4',
                  badgeTextColor: '#166534',
                  borderColor: '#BBF7D0',
                  hasDispatchMedia: true,
                  packedItemsList: allPackingList,
                  photoUrl: effectivePhotoUrl,
                  photoCount: packingPhotosList.length > 0 ? packingPhotosList.length : 1,
                  videoCount: packingVideosList.length > 0 ? packingVideosList.length : 1,
                  videoUrl: packingVideosList[0]?.dataUrl || null
                },
                {
                  stage: 'Accounts Verification',
                  title: 'Accounts Verification & Payment Slip Approved',
                  date: approvalTime,
                  user: approverName,
                  role: approverRole,
                  color: isAccVerified ? '#16A34A' : '#D97706',
                  badge: isAccVerified ? safeStringVal(accData.paymentStatus, 'Payment Verified & Approved') : 'Pending Accounts Verification',
                  badgeColor: isAccVerified ? '#DCFCE7' : '#FEF3C7',
                  badgeTextColor: isAccVerified ? '#166534' : '#B45309',
                  borderColor: isAccVerified ? '#86EFAC' : '#FDE68A'
                },
                {
                  stage: 'Invoice Generation',
                  title: isConfirmed ? 'Invoice Confirmed & Locked' : 'Invoice Generated (Ready for Confirmation)',
                  date: invoiceTime,
                  user: invoicePersonName,
                  role: invoicePersonRole,
                  color: isConfirmed ? '#2563EB' : '#4F46E5',
                  badge: isConfirmed ? `Locked • ${invNoText}` : `Draft • ${invNoText}`,
                  badgeColor: '#EFF6FF',
                  badgeTextColor: '#1E40AF',
                  borderColor: '#BFDBFE'
                },
                {
                  stage: 'Dispatch & Logistics',
                  title: isDispatched ? 'Vehicle Loaded & Dispatched' : 'Pending Vehicle Loading & Dispatch',
                  date: safeStringVal(vLoading?.loadedTimeStr, isDispatched ? `${invDateText}, 11:30 AM` : 'Awaiting Lorry Loading'),
                  user: driverText,
                  role: 'Logistics & Fleet Team',
                  color: isDispatched ? '#059669' : '#94A3B8',
                  badge: isDispatched ? `Dispatched • ${safeStringVal(vLoading?.vehicleNo, 'Vehicle Verified')}` : 'Next Stage: Vehicle Loading',
                  badgeColor: isDispatched ? '#F0FDF4' : '#F8FAFC',
                  badgeTextColor: isDispatched ? '#166534' : '#64748B',
                  borderColor: isDispatched ? '#BBF7D0' : '#E2E8F0'
                }
              ];

              return timelineSteps.map((tl, i) => (
                <div key={i} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {/* Circle Node on Vertical Line */}
                  <span style={{
                    position: 'absolute',
                    left: '-26px',
                    top: '4px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: tl.color,
                    border: '2px solid #FFFFFF',
                    boxShadow: `0 0 0 2px ${tl.color}40`
                  }} />

                  {/* Top row: Stage Title & User details */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '12.5px', color: '#0F172A' }}>{tl.title}</strong>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          color: tl.badgeTextColor,
                          backgroundColor: tl.badgeColor,
                          border: `1px solid ${tl.borderColor}`,
                          padding: '1px 8px',
                          borderRadius: '10px'
                        }}>
                          {tl.badge}
                        </span>
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '2px' }}>{tl.date}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '11px', whiteSpace: 'nowrap' }}>
                      <strong style={{ color: '#1E293B' }}>{tl.user}</strong>
                      <span style={{ display: 'block', color: '#64748B', fontSize: '10px' }}>{tl.role}</span>
                    </div>
                  </div>

                  {/* Dispatch Media & Checklist interactive buttons for Dispatch step */}
                  {tl.hasDispatchMedia && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                      marginTop: '4px',
                      padding: '8px 12px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px'
                    }}>
                      <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Dispatch Audit:
                      </span>

                      {/* 1. Packing Checklist Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setDispatchChecklistPreviewModal({
                            bomCode: bomRefText,
                            customerName: customerText,
                            packedBy: tl.user,
                            packedItems: tl.packedItemsList,
                            packedCount: packedItemsCount,
                            allCount: totalPackItemsCount
                          });
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid #BBF7D0',
                          backgroundColor: '#F0FDF4',
                          color: '#166534',
                          fontSize: '11px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        <CheckSquare style={{ width: '13px', height: '13px', color: '#166534' }} />
                        <span>Checklist ({packedItemsCount}/{totalPackItemsCount})</span>
                      </button>

                      {/* 2. Packing Photo Preview Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMediaPreviewModal({
                            type: 'image',
                            url: tl.photoUrl,
                            name: `Dispatch Packing Inspection Photo — ${bomRefText} (${tl.user})`
                          });
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid #BAE6FD',
                          backgroundColor: '#F0F9FF',
                          color: '#0369A1',
                          fontSize: '11px',
                          fontWeight: '800',
                          cursor: 'pointer'
                        }}
                      >
                        <Camera style={{ width: '13px', height: '13px', color: '#0284C7' }} />
                        <span>Packing Photo</span>
                      </button>
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>
        </div>

      {/* Delivery Address Proof & Document Preview Modal */}
      {localDocPreviewModal && (
        <DocPreviewModal
          previewDocModal={localDocPreviewModal}
          onClose={() => setLocalDocPreviewModal(null)}
        />
      )}

      {/* VRM Tax Invoice Print Modal */}
      {printTaxInvoiceModal && (
        <VRMTaxInvoicePrintTemplate
          invoiceData={printTaxInvoiceModal}
          onClose={() => setPrintTaxInvoiceModal(null)}
        />
      )}
    </div>
  );
}
