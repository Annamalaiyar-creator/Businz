import React from 'react';
import {
  Trash2, Eye, FileText, AlertCircle, AlertTriangle, X, XCircle, CheckCircle, RotateCcw, UploadCloud, Truck, Upload, Printer, Download, CreditCard, Camera, Video, List, Lock, Save, User, Receipt
} from 'lucide-react';
import { saveCloudBomRow } from '../../../utils/supabaseDataSync';
import { calculateTotalDispatchQty } from '../../../utils/vrmProductsData';
import { getMediaFromCache, stripDataUrlsFromRecord, cleanNum, formatCurrency, normalizePaymentTerm } from '../../../utils/otherViewsShared';
import { uploadBomDocumentFile, validateClientFile } from '../../../utils/bomStorageClient';
import { PRESET_THEMES, getPresetTheme } from '../../../utils/presetThemes';
import VRMBomPrintTemplate from '../../VRMBomPrintTemplate';
import LrUploadPopupModal from '../LrUploadPopupModal';
import DispatchMediaThumbnail from '../DispatchMediaThumbnail';
import { notifyBomPackedAndSentToAccounts } from '../../../services/notificationService';

export default function BomOperationalModals({ ctx }) {
  const {
    props,
    userRole,
    getCleanSalesPersonName,
    safeSaveBomStoreToLocal,
    renderDocPreviewModal,
    renderValidationErrorModal,
    renderExportFormatModal,
    renderBomSubmittingOverlay,
    printingBomRecord,
    setPrintingBomRecord,
    setExportFormatRecord,
    bomCancelPromptModal,
    setBomCancelPromptModal,
    cancellationReasonInput,
    setCancellationReasonInput,
    uploadingPayment,
    setUploadingPayment,
    lrUploadModal,
    setLrUploadModal,
    bomStore,
    setBomStore,
    isCeo,
    setConfirmingBomModal,
    uploadPaymentModal,
    setUploadPaymentModal,
    settleCreditModal,
    setSettleCreditModal,
    settleCreditUtr,
    setSettleCreditUtr,
    settleCreditDate,
    setSettleCreditDate,
    settleCreditMode,
    setSettleCreditMode,
    settleCreditAmount,
    setSettleCreditAmount,
    settleCreditFile,
    setSettleCreditFile,
    settleCreditNotes,
    setSettleCreditNotes,
    isSettlingCredit,
    setPaymentProofFile,
    paymentProofFiles,
    setPaymentProofFiles,
    existingPaymentDocsList,
    setExistingPaymentDocsList,
    quickPreviewRecord,
    setQuickPreviewRecord,
    setPreviewDocModal,
    customAlert,
    setCustomAlert,
    modalBalanceAmount,
    setModalBalanceAmount,
    sameAsBilling,
    presetSetCount,
    presetUnit,
    presetKitPrice,
    presetGroups,
    canUserCancelBom,
    handleCancelBomOrder,
    executeCancelBom,
    alert,
    handleExecuteSettleCredit
  } = ctx;

  return (
    <>
      {/* QUICK PREVIEW DRAWER */}
      {quickPreviewRecord && (
        <div
          onClick={() => setQuickPreviewRecord(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end', zIndex: 20000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: '#FFFFFF', width: '580px', maxWidth: '92vw', height: '100vh', overflowY: 'auto', boxShadow: '-12px 0 40px rgba(15, 23, 42, 0.2)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', boxSizing: 'border-box' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px' }}>
              <span style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>BOM Order Preview</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setPrintingBomRecord(quickPreviewRecord)}
                  title="Print BOM Order Sheet"
                  style={{
                    border: '1px solid #059669',
                    backgroundColor: '#ECFDF5',
                    color: '#047857',
                    padding: '6px 14px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  <Printer size={14} style={{ color: '#059669' }} /> Print
                </button>
                <button
                  onClick={() => setExportFormatRecord(quickPreviewRecord)}
                  title="Export BOM (PDF, JPG, or CSV)"
                  style={{
                    border: '1px solid #0E7490',
                    backgroundColor: '#ECFEFF',
                    color: '#0E7490',
                    padding: '6px 14px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  <Download size={14} style={{ color: '#0E7490' }} /> Export
                </button>
                {canUserCancelBom(quickPreviewRecord) && (
                  <button
                    onClick={() => {
                      const rec = quickPreviewRecord;
                      handleCancelBomOrder(rec);
                      setQuickPreviewRecord(null);
                    }}
                    style={{
                      border: '1px solid #FECACA',
                      backgroundColor: '#FEF2F2',
                      color: '#DC2626',
                      padding: '6px 14px',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 2px rgba(220,38,38,0.08)'
                    }}
                    title="Cancel BOM and restore blocked stock back into inventory"
                  >
                    <XCircle size={14} style={{ color: '#DC2626' }} /> Cancel BOM
                  </button>
                )}

                <button
                  onClick={() => {
                    const rec = quickPreviewRecord;
                    setQuickPreviewRecord(null);
                    const isSentToDispatch = rec.salesConfirmed || ['Sales Confirmed - Sent to Dispatch', 'Sent to Production', 'Confirmed', 'Packed & Ready for Dispatch', 'Partially Packed', 'Closed', 'CLOSED', 'Dispatch Packing Verified - Sent to Accounts', 'Awaiting Vehicle Loading & Dispatch'].includes(rec.status);
                    const isDraftOrPending = !isCeo && !isSentToDispatch && ['Draft', 'Pending Confirmation', 'Edited / Pending Confirmation', 'Cancelled & Reissued to Dispatch', 'Pending Verification', 'Pending'].includes(rec.status);
                    setConfirmingBomModal({ ...rec, isEditMode: isDraftOrPending });
                  }}
                  style={{ border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#1E293B', padding: '6px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  View Full Details
                </button>
                <button onClick={() => setQuickPreviewRecord(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B', padding: '4px', display: 'inline-flex', alignItems: 'center' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {(() => {
              // 1. Resolve source PI if available for full fidelity fallback
              let sourcePi = null;
              try {
                const piNum = quickPreviewRecord.sourcePiNo || quickPreviewRecord.piNo;
                const rawPi = localStorage.getItem('controlroom_sales_pi_store') || localStorage.getItem('sales_pi_store') || localStorage.getItem('proforma_invoices');
                if (rawPi) {
                  const parsedPis = JSON.parse(rawPi);
                  if (Array.isArray(parsedPis)) {
                    sourcePi = parsedPis.find(p => 
                      (piNum && (p.piNo === piNum || p.id === piNum)) ||
                      (p.convertedBomCode === quickPreviewRecord.bomCode) ||
                      (p.convertedBomNo === quickPreviewRecord.bomCode) ||
                      (Array.isArray(p.assignedBoms) && p.assignedBoms.includes(quickPreviewRecord.bomCode))
                    );
                  }
                }
              } catch (_) {}

              // 2. Company Name & Customer Name resolution
              const cleanVal = (v) => (v && typeof v === 'string' && v.trim() && !['—', '-', 'Customer', 'Customer Order'].includes(v.trim())) ? v.trim() : '';
              
              const resolvedCompany = [
                cleanVal(quickPreviewRecord.companyName),
                cleanVal(sourcePi?.vendor),
                cleanVal(sourcePi?.companyName),
                cleanVal(sourcePi?.customerName && !/^\d+$/.test(sourcePi.customerName) ? sourcePi.customerName : ''),
                cleanVal(quickPreviewRecord.customerName && !/^\d+$/.test(quickPreviewRecord.customerName) ? quickPreviewRecord.customerName : ''),
                cleanVal(quickPreviewRecord.c2),
                cleanVal(quickPreviewRecord.c3 && !/^\d+$/.test(quickPreviewRecord.c3) ? quickPreviewRecord.c3 : '')
              ].find(Boolean) || cleanVal(quickPreviewRecord.customerName) || 'Teorainn Solar Pvt Ltd';

              const resolvedContact = [
                cleanVal(quickPreviewRecord.contactPerson),
                cleanVal(sourcePi?.contactPerson),
                cleanVal(sourcePi?.customerName),
                cleanVal(quickPreviewRecord.customerName)
              ].find(s => s && s !== resolvedCompany) || quickPreviewRecord.contactPerson || '—';

              const phone = quickPreviewRecord.mobile || quickPreviewRecord.phone || sourcePi?.phone || sourcePi?.mobile || '—';
              const email = quickPreviewRecord.email || sourcePi?.email || '';
              const gstNo = quickPreviewRecord.gstNo || quickPreviewRecord.gstin || sourcePi?.gstNo || sourcePi?.gst || '—';

              // Payment Terms
              const paymentType = normalizePaymentTerm(
                sourcePi?.paymentTerms || sourcePi?.paymentType || quickPreviewRecord.paymentType || quickPreviewRecord.paymentTerms || '100% Paid'
              );

              // Grand Total / Order Value
              const numVal = (v) => {
                const n = parseFloat(String(v || '').replace(/[^0-9.]/g, ''));
                return Number.isFinite(n) && n > 0 ? n : 0;
              };
              const calculatedItemTotal = (quickPreviewRecord.items || []).reduce((sum, it) => sum + ((cleanNum(it.qty) || 0) * (cleanNum(it.rate) || 0)), 0);
              const grandVal = numVal(quickPreviewRecord.grandTotal) 
                || numVal(quickPreviewRecord.c5)
                || numVal(sourcePi?.grandTotal)
                || numVal(sourcePi?.amount)
                || numVal(calculatedItemTotal)
                || numVal(quickPreviewRecord.subTotal);
              const subVal = numVal(quickPreviewRecord.subTotal) || numVal(sourcePi?.subTotal) || (grandVal > 0 ? Math.round((grandVal / 1.18) * 100) / 100 : 0);
              const gstVal = numVal(quickPreviewRecord.gstAmount) || numVal(sourcePi?.gstAmount) || Math.max(0, Math.round((grandVal - subVal) * 100) / 100);

              // Transporter & Logistics
              const existingLoading = quickPreviewRecord.vehicleLoading || {};
              const transporter = [
                cleanVal(quickPreviewRecord.transporterName),
                cleanVal(quickPreviewRecord.transporter),
                cleanVal(existingLoading.transporter),
                cleanVal(existingLoading.transporterName),
                cleanVal(sourcePi?.transporterName),
                cleanVal(sourcePi?.transporter)
              ].find(Boolean) || '—';

              const destination = [
                cleanVal(quickPreviewRecord.destination),
                cleanVal(existingLoading.destination),
                cleanVal(sourcePi?.destination),
                cleanVal(quickPreviewRecord.deliveryCity),
                cleanVal(sourcePi?.deliveryCity)
              ].find(Boolean) || '—';

              const transportMode = quickPreviewRecord.transportMode || existingLoading.deliveryMode || sourcePi?.transportMode || 'Transport';
              const transportScope = quickPreviewRecord.transportScope || sourcePi?.transportScope || 'VRM Structures';
              const vehicleNo = quickPreviewRecord.vehicleNo || existingLoading.vehicleNo || sourcePi?.vehicleNo || '—';
              const lrNo = quickPreviewRecord.lrNo || existingLoading.lrNo || sourcePi?.lrNo || '—';
              const driverName = quickPreviewRecord.driverName || existingLoading.driverName || '';
              const driverPhone = quickPreviewRecord.driverPhone || existingLoading.driverPhone || '';
              const lrDoc = quickPreviewRecord.lrCopyDoc || existingLoading.lrCopyDoc || null;
              const loadingPhotos = (Array.isArray(existingLoading.photos) && existingLoading.photos.length > 0)
                ? existingLoading.photos
                : (Array.isArray(quickPreviewRecord.loadingPhotos) && quickPreviewRecord.loadingPhotos.length > 0)
                  ? quickPreviewRecord.loadingPhotos
                  : (Array.isArray(quickPreviewRecord.photos) && quickPreviewRecord.photos.length > 0)
                    ? quickPreviewRecord.photos : [];

              // Addresses
              const bObj = quickPreviewRecord.billingAddressObj || sourcePi?.billingAddressObj || {};
              const dObj = quickPreviewRecord.deliveryAddressObj || sourcePi?.deliveryAddressObj || {};

              const bStreet = quickPreviewRecord.billingStreet || bObj.street || bObj.address || sourcePi?.billingStreet || (typeof quickPreviewRecord.billingAddress === 'string' && !quickPreviewRecord.billingAddress.includes('on file') ? quickPreviewRecord.billingAddress : '') || (typeof sourcePi?.billingAddress === 'string' ? sourcePi.billingAddress : '');
              const bCity = quickPreviewRecord.billingCity || bObj.city || sourcePi?.billingCity || '';
              const bState = quickPreviewRecord.billingState || bObj.state || sourcePi?.billingState || '';
              const bPin = quickPreviewRecord.billingPincode || bObj.pincode || bObj.pin || sourcePi?.billingPincode || '';

              const isSameAddr = quickPreviewRecord.sameAsBilling !== false && (!dObj.address || dObj.address === bObj.address);
              const dStreet = isSameAddr ? bStreet : (quickPreviewRecord.deliveryStreet || dObj.street || dObj.address || sourcePi?.deliveryStreet || (typeof quickPreviewRecord.deliveryAddress === 'string' && !quickPreviewRecord.deliveryAddress.includes('on file') ? quickPreviewRecord.deliveryAddress : '') || bStreet);
              const dCity = isSameAddr ? bCity : (quickPreviewRecord.deliveryCity || dObj.city || sourcePi?.deliveryCity || bCity);
              const dState = isSameAddr ? bState : (quickPreviewRecord.deliveryState || dObj.state || sourcePi?.deliveryState || bState);
              const dPin = isSameAddr ? bPin : (quickPreviewRecord.deliveryPincode || dObj.pincode || dObj.pin || sourcePi?.deliveryPincode || bPin);

              const addrDoc = quickPreviewRecord.deliveryAddressProofDoc || sourcePi?.deliveryAddressProofDoc || sourcePi?.deliveryProofDoc;
              const hasDispatchPacking = Boolean(
                (quickPreviewRecord.dispatchPacking && Array.isArray(quickPreviewRecord.dispatchPacking) && quickPreviewRecord.dispatchPacking.length > 0) ||
                quickPreviewRecord.packingStatus ||
                quickPreviewRecord.packedAt
              );

              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '4px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#ECFEFF', color: '#0E7490', border: '2px solid #0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '800', flexShrink: 0 }}>
                      {resolvedCompany.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                      <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                        {resolvedCompany}
                      </h3>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>
                        Ref Code: <strong style={{ color: '#0E7490' }}>{quickPreviewRecord.bomCode || quickPreviewRecord.code}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Order Meta Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>REF CODE</span>
                      <strong style={{ fontSize: '14px', color: '#0F172A', fontWeight: '800' }}>{quickPreviewRecord.bomCode || quickPreviewRecord.code}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>STATUS</span>
                      <strong style={{ fontSize: '13px', color: '#0E7490', fontWeight: '800' }}>{quickPreviewRecord.status}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>TOTAL ITEMS</span>
                      <strong style={{ fontSize: '15px', color: '#0F172A', fontWeight: '800' }}>{(quickPreviewRecord.items || []).length || (sourcePi?.items || []).length || 1}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>ORDER VALUE</span>
                      <strong style={{ fontSize: '15px', color: '#0F172A', fontWeight: '800' }}>
                        {grandVal > 0 ? formatCurrency(grandVal) : (quickPreviewRecord.c5 || '—')}
                      </strong>
                    </div>
                  </div>

                  {/* Sales & Payment Terms Info */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: '#FFFFFF', padding: '14px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block' }}>Sales Creator</span>
                      <strong style={{ fontSize: '13px', color: '#0E7490', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <User size={13} style={{ color: '#0E7490', flexShrink: 0 }} /> {(quickPreviewRecord.salesPerson || quickPreviewRecord.createdBy || sourcePi?.salesPerson || 'Sales Department').replace(/\s*\([^)]*\)/g, '').trim()}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block' }}>Payment Terms</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        <strong style={{ fontSize: '13px', color: '#0F172A', fontWeight: '800' }}>
                          {paymentType}
                        </strong>
                        {(() => {
                          const pDocs = (Array.isArray(quickPreviewRecord.paymentProofDocs) && quickPreviewRecord.paymentProofDocs.length > 0)
                            ? quickPreviewRecord.paymentProofDocs
                            : (Array.isArray(quickPreviewRecord.payments?.proofDocObjs) && quickPreviewRecord.payments.proofDocObjs.length > 0)
                              ? quickPreviewRecord.payments.proofDocObjs
                              : (quickPreviewRecord.paymentProofDoc
                                  ? (Array.isArray(quickPreviewRecord.paymentProofDoc) ? quickPreviewRecord.paymentProofDoc : [quickPreviewRecord.paymentProofDoc])
                                  : (quickPreviewRecord.payments?.proofDoc
                                      ? [{ name: quickPreviewRecord.payments.proofDoc, dataUrl: quickPreviewRecord.payments.proofDocData }]
                                      : (sourcePi?.paymentProofDoc ? [sourcePi.paymentProofDoc] : [])));
                          const validPDocs = (pDocs || []).filter(d => Boolean(d && (typeof d === 'string' ? d.trim() : (d.name || d.url || d.dataUrl))));
                          if (validPDocs.length === 0) return null;
                          return (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                              {validPDocs.map((pDoc, pIdx) => (
                                <button
                                  key={pIdx}
                                  type="button"
                                  onClick={() => setPreviewDocModal({ title: `Payment Proof #${pIdx + 1}: ${pDoc.name || pDoc.originalName || 'Slip'}`, doc: pDoc })}
                                  style={{ border: '1px solid #BBF7D0', backgroundColor: '#F0FDF4', color: '#166534', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                >
                                  <Eye size={10} /> Proof {validPDocs.length > 1 ? `#${pIdx + 1}` : ''}
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Contact Details & GST */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', backgroundColor: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>COMPANY NAME</span>
                      <strong style={{ fontSize: '12px', color: '#0F172A', fontWeight: '700' }}>{resolvedCompany}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>CONTACT PERSON</span>
                      <strong style={{ fontSize: '12px', color: '#0F172A', fontWeight: '700' }}>{resolvedContact}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>PHONE / EMAIL</span>
                      <strong style={{ fontSize: '12px', color: '#0F172A', fontWeight: '700', display: 'block' }}>{phone}</strong>
                      {email && <span style={{ fontSize: '11px', color: '#64748B', wordBreak: 'break-all' }}>{email}</span>}
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>GSTIN</span>
                      <strong style={{ fontSize: '12px', color: '#0E7490', fontWeight: '800' }}>{gstNo}</strong>
                    </div>
                  </div>

                  {/* Structured Billing & Delivery Addresses */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '800', color: '#2563EB', borderBottom: '1px solid #E2E8F0', paddingBottom: '4px' }}>
                        <FileText size={12} /> Billing Address
                      </div>
                      <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.5' }}>
                        <div>{bStreet || 'Billing address on file'}</div>
                        {(bCity || bState) && <div>{[bCity, bState].filter(Boolean).join(', ')}</div>}
                        {bPin && <div>PIN: <strong>{bPin}</strong></div>}
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '800', color: '#0E7490' }}>
                          <Truck size={12} /> Delivery Address
                        </span>
                        {isSameAddr && (
                          <span style={{ fontSize: '10px', color: '#166534', fontWeight: '700' }}>Same as Billing</span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.5' }}>
                        <div>{dStreet || 'Delivery address on file'}</div>
                        {(dCity || dState) && <div>{[dCity, dState].filter(Boolean).join(', ')}</div>}
                        {dPin && <div>PIN: <strong>{dPin}</strong></div>}
                      </div>
                      {(() => {
                        const aDocs = Array.isArray(quickPreviewRecord.deliveryAddressProofDocs) && quickPreviewRecord.deliveryAddressProofDocs.length > 0
                          ? quickPreviewRecord.deliveryAddressProofDocs
                          : addrDoc ? [addrDoc] : [];
                        if (aDocs.length === 0) return null;
                        return (
                          <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {aDocs.map((aDoc, aIdx) => (
                              <div key={aIdx} style={{ padding: '5px 8px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '10.5px', color: '#166534', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }} title={aDoc.name}>
                                  📄 {aDoc.name || `Address Proof #${aIdx + 1}`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setPreviewDocModal({ title: `Delivery Address Proof #${aIdx + 1}: ${aDoc.name || 'Document'}`, doc: aDoc })}
                                  style={{ border: 'none', background: 'transparent', color: '#0E7490', cursor: 'pointer', fontSize: '10.5px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}
                                >
                                  <Eye size={11} /> View {aDocs.length > 1 ? `#${aIdx + 1}` : ''}
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Logistics & Dispatch Information */}
                  <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>Logistics & Dispatch Information</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', fontSize: '11.5px' }}>
                      <div>
                        <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Mode</span>
                        <strong>{transportMode}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Scope</span>
                        <strong style={{ color: transportScope === 'Customer Scope' ? '#0284C7' : '#0F172A' }}>{transportScope}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Transporter</span>
                        <strong style={{ color: transporter !== '—' ? '#0E7490' : '#0F172A' }}>{transporter}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Destination</span>
                        <strong style={{ color: destination !== '—' ? '#0E7490' : '#0F172A' }}>{destination}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Vehicle No</span>
                        <strong>{vehicleNo}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>LR / Docket</span>
                        <strong>{lrNo}</strong>
                      </div>
                      {(driverName || driverPhone) && (
                        <div>
                          <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Driver</span>
                          <strong>{[driverName, driverPhone].filter(Boolean).join(' • ')}</strong>
                        </div>
                      )}
                    </div>
                    {lrDoc && (
                      <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', color: '#166534', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          📄 LR Document Attached ({lrDoc.name || 'Lorry Receipt'})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const docUrl = (lrDoc.url && !lrDoc.url.startsWith('blob:')) ? lrDoc.url : ((lrDoc.dataUrl && !lrDoc.dataUrl.startsWith('blob:')) ? lrDoc.dataUrl : (getMediaFromCache(lrDoc.name) || (lrDoc.name ? `/api/uploads/${lrDoc.name}` : '')));
                            setPreviewDocModal({
                              title: `Lorry Receipt (LR) — ${lrNo !== '—' ? lrNo : quickPreviewRecord.bomCode}`,
                              doc: { ...lrDoc, url: docUrl, dataUrl: docUrl }
                            });
                          }}
                          style={{ border: 'none', backgroundColor: '#16A34A', color: 'white', padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Eye size={10} /> View LR Photo
                        </button>
                      </div>
                    )}
                  </div>

            {/* Itemized List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                  {hasDispatchPacking && (
                    <div style={{
                      backgroundColor: '#ECFDF5',
                      border: '1.5px solid #10B981',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      boxShadow: '0 2px 6px rgba(16,185,129,0.08)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <CheckCircle style={{ width: '22px', height: '22px', color: '#059669', flexShrink: 0 }} />
                        <div>
                          <strong style={{ color: '#065F46', fontSize: '13px', display: 'block' }}>
                            Notice to Sales: Goods Verified & Packed by Dispatch
                          </strong>
                          <span style={{ color: '#047857', fontSize: '12px' }}>
                            Dispatch has packed this BOM ({quickPreviewRecord.packingStatus === 'PACKING_VERIFIED' ? '100% Fully Packed' : 'Partially Packed'}). Review the comparison below between ordered BOM Qty and actual Packed Qty.
                          </span>
                        </div>
                      </div>
                      <span style={{
                        backgroundColor: '#059669',
                        color: '#FFFFFF',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: '800',
                        whiteSpace: 'nowrap'
                      }}>
                        {quickPreviewRecord.packingStatus === 'PACKING_VERIFIED' ? 'Fully Packed' : 'Partially Packed'}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Itemized Products & Materials</h4>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>{(quickPreviewRecord.items || []).length} items</span>
                  </div>
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '12px', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                          <th style={{ padding: '8px 10px' }}>#</th>
                          <th style={{ padding: '8px 10px' }}>Product Description</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center' }}>Qty / Set</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', color: '#0E7490', backgroundColor: '#ECFEFF' }}>Total Dispatch Qty</th>
                          {hasDispatchPacking && (
                            <th style={{ padding: '8px 10px', textAlign: 'center', color: '#0E7490' }}>Packed Qty</th>
                          )}
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Rate (₹)</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Preset Kit Package Rows */}
                    {(() => {
                      const pGroups = (Array.isArray(quickPreviewRecord.presetGroups) && quickPreviewRecord.presetGroups.length > 0)
                        ? quickPreviewRecord.presetGroups
                        : (quickPreviewRecord.presetName || (cleanNum(quickPreviewRecord.presetKitPrice) > 0))
                          ? [{
                              presetName: quickPreviewRecord.presetName || 'Pre-Engineered Structure Kit Package',
                              setCount: parseFloat(quickPreviewRecord.presetSetCount) || 1,
                              unit: quickPreviewRecord.presetUnit || (String(quickPreviewRecord.presetName || '').toLowerCase().includes('kw') ? 'kW' : 'Sets'),
                              unitType: quickPreviewRecord.presetUnit || (String(quickPreviewRecord.presetName || '').toLowerCase().includes('kw') ? 'kW' : 'Sets'),
                              kitPrice: cleanNum(quickPreviewRecord.presetKitPrice) || 0
                            }]
                          : [];

                      return pGroups.map((grp, gIdx) => {
                        const sCount = parseFloat(grp.setCount) || 1;
                        const kPrice = cleanNum(grp.kitPrice) || 0;
                        const kTotal = sCount * kPrice;
                        const theme = getPresetTheme(gIdx);
                        const unitType = grp.unit || grp.unitType || (grp.isKwBased || String(grp.presetName || '').toLowerCase().includes('kw') ? 'kW' : 'Sets');
                        return (
                          <tr key={`preset-pkg-${gIdx}`} style={{ backgroundColor: theme.bg, borderBottom: `1.5px solid ${theme.border}` }}>
                            <td style={{ padding: '8px 10px', color: theme.primary, fontWeight: '800', textAlign: 'center' }}>★</td>
                            <td style={{ padding: '8px 10px', fontWeight: '800', color: theme.primary }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ backgroundColor: theme.primary, color: '#FFFFFF', fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                  {theme.badge}
                                </span>
                                <span>{grp.presetName || 'Preset Structure Kit'}</span>
                              </div>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', color: theme.primary }}>
                              {sCount} {unitType}
                            </td>
                            {hasDispatchPacking && (
                              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', color: theme.primary }}>
                                {sCount} {unitType}
                              </td>
                            )}
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: theme.primary }}>
                              ₹ {kPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '900', color: theme.primary }}>
                              ₹ {kTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      });
                    })()}

                    {/* Component Items */}
                    {(() => {
                      const pGroups = (Array.isArray(quickPreviewRecord.presetGroups) && quickPreviewRecord.presetGroups.length > 0)
                        ? quickPreviewRecord.presetGroups
                        : (quickPreviewRecord.presetName || (cleanNum(quickPreviewRecord.presetKitPrice) > 0))
                          ? [{
                              groupId: 'default_kit',
                              presetName: quickPreviewRecord.presetName || 'Preset Package',
                              setCount: parseFloat(quickPreviewRecord.presetSetCount) || 1
                            }]
                          : [];

                      return (quickPreviewRecord.items || []).map((it, idx) => {
                        const q = cleanNum(it.qty, 1);
                        const r = cleanNum(it.rate, 0);
                        const lineTotal = q * r;
                        const hasPresets = pGroups.length > 0;
                        const isKitPart = Boolean(it.isPresetItem || (hasPresets && r === 0));
                        let theme = PRESET_THEMES[0];
                        if (isKitPart) {
                          const gid = it.presetGroupId || it.groupId || it.presetId;
                          const gIdx = gid ? pGroups.findIndex(g => g.groupId === gid || g.presetGroupId === gid) : 0;
                          theme = getPresetTheme(gIdx >= 0 ? gIdx : 0);
                        }

                        const matchingPacked = (quickPreviewRecord.dispatchPacking || []).find(p => (p.name && it.name && p.name.toLowerCase().trim() === it.name.toLowerCase().trim()) || (p.code && it.code && p.code === it.code));
                        const packedQ = (it.packedQty !== undefined && it.packedQty !== null && it.packedQty !== '')
                          ? Number(it.packedQty)
                          : (matchingPacked && matchingPacked.packedQty !== undefined && matchingPacked.packedQty !== null && matchingPacked.packedQty !== ''
                              ? Number(matchingPacked.packedQty)
                              : (matchingPacked?.packed ? q : (it.packed ? q : 0)));

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: isKitPart ? theme.bg : '#FFFFFF' }}>
                            <td style={{ padding: '8px 10px', color: isKitPart ? theme.primary : '#94A3B8', fontWeight: '700', textAlign: 'center' }}>{idx + 1}</td>
                            <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0F172A' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {isKitPart && (
                                  <span style={{ backgroundColor: theme.tagBg, color: theme.tagText, border: `1px solid ${theme.border}`, fontSize: '9px', fontWeight: '800', padding: '1px 6px', borderRadius: '3px' }}>
                                    {theme.badge} COMPONENT
                                  </span>
                                )}
                                <span>{it.name || '—'}</span>
                              </div>
                              {it.category && <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '500' }}>{it.category}</span>}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', color: isKitPart ? theme.primary : '#0E7490' }}>{q} {it.uom || ''}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', color: '#0E7490', backgroundColor: isKitPart ? '#ECFEFF' : '#F8FAFC' }}>
                              {(() => {
                                if (!isKitPart) return <span style={{ color: '#94A3B8', fontWeight: '700' }} title="Standalone product; entered quantity is direct total quantity">—</span>;
                                const matchedGrp = pGroups.find(g => g.groupId === it.presetGroupId) || pGroups[0];
                                const totalDisp = calculateTotalDispatchQty(
                                  it,
                                  matchedGrp?.setCount || quickPreviewRecord.setCount || quickPreviewRecord.presetSetCount || 1,
                                  matchedGrp?.presetName || it.presetName || quickPreviewRecord.presetName,
                                  it.category,
                                  matchedGrp?.unit || matchedGrp?.unitType || it.uom || it.unit
                                );
                                return `${totalDisp} ${it.uom || ''}`;
                              })()}
                            </td>
                            {hasDispatchPacking && (
                              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800' }}>
                                <span style={{
                                  color: packedQ >= q ? '#059669' : packedQ > 0 ? '#D97706' : '#DC2626',
                                  backgroundColor: packedQ >= q ? '#DCFCE7' : packedQ > 0 ? '#FEF3C7' : '#FEE2E2',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  {packedQ} {it.uom || ''}
                                </span>
                              </td>
                            )}
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600', color: isKitPart ? theme.primary : '#475569' }}>
                              {isKitPart ? (
                                <span style={{ fontSize: '11px', color: theme.primary, fontWeight: '700', backgroundColor: theme.tagBg, padding: '2px 5px', borderRadius: '3px' }}>Included</span>
                              ) : (
                                `₹ ${r.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                              )}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: isKitPart ? '#0E7490' : '#0F172A' }}>
                            {isKitPart ? (
                              <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '2px 5px', borderRadius: '3px' }}>Included</span>
                            ) : (
                              `₹ ${lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                            )}
                          </td>
                        </tr>
                      );
                    });
                    })()}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#F8FAFC', borderTop: '2px solid #E2E8F0', fontWeight: '700', color: '#475569' }}>
                      <td colSpan={hasDispatchPacking ? 5 : 4} style={{ padding: '8px 10px', textAlign: 'right' }}>Taxable Subtotal:</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                        ₹ {subVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    {gstVal > 0 && (
                      <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', fontSize: '11.5px' }}>
                        <td colSpan={hasDispatchPacking ? 5 : 4} style={{ padding: '4px 10px', textAlign: 'right' }}>GST:</td>
                        <td style={{ padding: '4px 10px', textAlign: 'right', fontWeight: '700', color: '#64748B' }}>
                          ₹ {gstVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}
                    <tr style={{ backgroundColor: '#ECFEFF', borderTop: '1px solid #A5F3FC', fontWeight: '900', color: '#0E7490', fontSize: '13px' }}>
                      <td colSpan={hasDispatchPacking ? 5 : 4} style={{ padding: '10px', textAlign: 'right', textTransform: 'uppercase' }}>Total Order Value:</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontSize: '14px', color: '#0E7490' }}>
                        ₹ {grandVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Dispatch Packed Items Media Section in Quick Preview */}
            {(() => {
              const packMedia = quickPreviewRecord.dispatchPackingMedia || {};
              const packPhotos = packMedia.photos || [];
              const packVideos = packMedia.videos || [];
              const hasMedia = packPhotos.length > 0 || packVideos.length > 0;

              if (!hasMedia && !quickPreviewRecord.status?.includes('Dispatch') && !quickPreviewRecord.status?.includes('Packed') && !quickPreviewRecord.dispatchPacking) {
                return null;
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Camera size={16} style={{ color: '#0E7490' }} />
                      <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                        Dispatch Packed Items Media ({packPhotos.length} Photos, {packVideos.length} Videos)
                      </h4>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Captured by Dispatch</span>
                  </div>

                  {hasMedia ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                      {packPhotos.map((ph, pIdx) => {
                        return (
                          <DispatchMediaThumbnail
                            key={ph.id || pIdx}
                            photo={ph}
                            bomCode={quickPreviewRecord?.bomCode || quickPreviewRecord?.code}
                            height="76px"
                            label="Photo"
                            onClick={(resolvedUrl) => {
                              setPreviewDocModal({
                                title: ph.name || `Photo ${pIdx + 1}`,
                                bomCode: quickPreviewRecord?.bomCode || quickPreviewRecord?.code,
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
                            onClick={() => setPreviewDocModal({ title: vd.name || `Video ${vIdx + 1}`, doc: { ...vd, name: vd.name || `Video ${vIdx + 1}`, dataUrl: videoUrl, url: vd.url || videoUrl } })}
                            style={{ height: '76px', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #CBD5E1', backgroundColor: '#0F172A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', position: 'relative' }}
                          >
                            <Video size={20} style={{ color: '#38BDF8' }} />
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 6px', fontSize: '9px', fontWeight: '700', display: 'flex', justifyContent: 'space-between' }}>
                              <span>🎥 Video</span>
                              <span>›</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic', backgroundColor: '#F8FAFC', padding: '10px 14px', borderRadius: '10px', border: '1px dashed #E2E8F0' }}>
                      No packing photos or videos attached yet for this order.
                    </div>
                  )}
                </div>
              );
            })()}

            {/* VEHICLE LOADING PROOF PHOTOS IN QUICK PREVIEW */}
            {(() => {
              const existingLoading = quickPreviewRecord.vehicleLoading || {};
              const loadingPhotos = (Array.isArray(existingLoading.photos) && existingLoading.photos.length > 0)
                ? existingLoading.photos
                : (Array.isArray(quickPreviewRecord.loadingPhotos) && quickPreviewRecord.loadingPhotos.length > 0)
                  ? quickPreviewRecord.loadingPhotos
                  : (Array.isArray(quickPreviewRecord.photos) && quickPreviewRecord.photos.length > 0)
                    ? quickPreviewRecord.photos : [];

              if (loadingPhotos.length === 0) return null;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Truck size={15} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                          Vehicle Loading Proof Photos ({loadingPhotos.length})
                        </h4>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>Captured by Dispatch Team during final lorry loading</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0' }}>
                      ✓ {loadingPhotos.length} Photo{loadingPhotos.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px' }}>
                    {loadingPhotos.map((ph, pIdx) => {
                      return (
                        <DispatchMediaThumbnail
                          key={ph.id || pIdx}
                          photo={ph}
                          bomCode={quickPreviewRecord?.bomCode || quickPreviewRecord?.code}
                          height="76px"
                          label="View"
                          onClick={(resolvedUrl) => {
                            setPreviewDocModal({
                              title: ph.name || `Vehicle Loading Photo ${pIdx + 1}`,
                              bomCode: quickPreviewRecord?.bomCode || quickPreviewRecord?.code,
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
              );
            })()}
          </>
        );
      })()}
          </div>
        </div>
      )}

      {/* VIEW / UPLOAD PAYMENT DETAILS MODAL */}
      {uploadPaymentModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, fontFamily: "'DM Sans', sans-serif", padding: '16px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px 28px', maxWidth: '620px', width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CreditCard style={{ width: '20px', height: '20px' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Payment Details & Proof</h3>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    {uploadPaymentModal.bomCode || uploadPaymentModal.code} — {uploadPaymentModal.customerName || uploadPaymentModal.companyName || 'Customer Order'}
                  </span>
                </div>
              </div>
              <button onClick={() => setUploadPaymentModal(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            {(() => {
              const pType = String(uploadPaymentModal.paymentType || '').toLowerCase();
              const accPay = String(uploadPaymentModal.accountsVerification?.paymentType || '').toLowerCase();
              const cDays = Number(uploadPaymentModal.creditDays || uploadPaymentModal.accountsVerification?.creditDays || 0);
              const isOrderCredit = pType.includes('credit') || pType.includes('net ') || pType.includes('net 30') || accPay.includes('credit') || cDays > 0 || Boolean(uploadPaymentModal.isCreditOrder);

              return (
                <>
                  {/* TOP NAVIGATION / MODE SWITCH: Payment Proof vs Credit Payment (Strictly locked to customer's order type) */}
                  <div style={{ display: 'flex', gap: '8px', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '10px' }}>
                    {!isOrderCredit ? (
                      <>
                        <button
                          type="button"
                          style={{
                            flex: 1,
                            padding: '8px 14px',
                            fontSize: '12px',
                            fontWeight: '800',
                            borderRadius: '7px',
                            border: 'none',
                            backgroundColor: '#FFFFFF',
                            color: '#0E7490',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                            cursor: 'default',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <Receipt size={14} /> Payment Proof
                        </button>
                        <button
                          type="button"
                          disabled
                          title="Locked: This order is not a credit payment order"
                          style={{
                            flex: 1,
                            padding: '8px 14px',
                            fontSize: '12px',
                            fontWeight: '700',
                            borderRadius: '7px',
                            border: '1px dashed #CBD5E1',
                            backgroundColor: '#F8FAFC',
                            color: '#94A3B8',
                            cursor: 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            opacity: 0.7
                          }}
                        >
                          <Lock size={13} style={{ color: '#94A3B8' }} /> Credit Payment (Locked)
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled
                          title="Locked: Payment Proof is locked for credit customers"
                          style={{
                            flex: 1,
                            padding: '8px 14px',
                            fontSize: '12px',
                            fontWeight: '700',
                            borderRadius: '7px',
                            border: '1px dashed #CBD5E1',
                            backgroundColor: '#F8FAFC',
                            color: '#94A3B8',
                            cursor: 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            opacity: 0.7
                          }}
                        >
                          <Lock size={13} style={{ color: '#94A3B8' }} /> Payment Proof (Locked)
                        </button>
                        <button
                          type="button"
                          style={{
                            flex: 1,
                            padding: '8px 14px',
                            fontSize: '12px',
                            fontWeight: '800',
                            borderRadius: '7px',
                            border: 'none',
                            backgroundColor: '#0E7490',
                            color: '#FFFFFF',
                            boxShadow: '0 2px 4px rgba(14,116,144,0.3)',
                            cursor: 'default',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <CreditCard size={14} /> Credit Payment
                        </button>
                      </>
                    )}
                  </div>

                  {/* TAB 1: CREDIT PAYMENT / SETTLE CREDIT VIEW (Visible ONLY for Credit orders) */}
                  {isOrderCredit && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Order Overview Summary Card */}
                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginBottom: '2px' }}>Customer Name</span>
                    <strong style={{ color: '#0F172A', fontSize: '13px' }}>{uploadPaymentModal.customerName || uploadPaymentModal.companyName || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginBottom: '2px' }}>Agreed Payment Terms</span>
                    <strong style={{ color: '#2563EB', fontSize: '13px' }}>
                      {uploadPaymentModal.paymentType || (uploadPaymentModal.creditDays ? `${uploadPaymentModal.creditDays} Days Credit` : 'Credit Payment')}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginBottom: '2px' }}>Order Total / Credit Due</span>
                    <strong style={{ color: '#059669', fontSize: '15px', fontWeight: '800' }}>
                      ₹ {Number(uploadPaymentModal.grandTotal || uploadPaymentModal.subTotal || uploadPaymentModal.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginBottom: '2px' }}>BOM Ref Number</span>
                    <strong style={{ color: '#0E7490', fontSize: '13px' }}>{uploadPaymentModal.bomCode || uploadPaymentModal.code || '—'}</strong>
                  </div>
                </div>

                {/* Settle Credit Form Fields */}
                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                    <Receipt size={16} style={{ color: '#0E7490' }} />
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                      Settle Credit / Record Payment Details
                    </span>
                  </div>

                  {/* Row 1: Payment Date & Settled Amount */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                        Payment Received Date <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      <input
                        type="date"
                        value={settleCreditDate}
                        onChange={(e) => setSettleCreditDate(e.target.value)}
                        disabled={isSettlingCredit}
                        style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                        Settled Amount (₹) <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      <input
                        type="number"
                        value={settleCreditAmount}
                        onChange={(e) => setSettleCreditAmount(e.target.value)}
                        placeholder="Enter amount paid"
                        disabled={isSettlingCredit}
                        style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  {/* Row 2: Payment Mode & Bank Reference / UTR */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                        Payment Mode <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      <select
                        value={settleCreditMode}
                        onChange={(e) => setSettleCreditMode(e.target.value)}
                        disabled={isSettlingCredit}
                        style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '12.5px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF' }}
                      >
                        <option value="NEFT / RTGS (Direct Bank Transfer)">NEFT / RTGS (Direct Bank)</option>
                        <option value="IMPS Transfer">IMPS Transfer</option>
                        <option value="UPI Transfer">UPI Transfer</option>
                        <option value="Cheque / DD">Cheque / Demand Draft</option>
                        <option value="Cash Deposit">Cash Deposit</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                        Bank Reference / UTR Number <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={settleCreditUtr}
                        onChange={(e) => setSettleCreditUtr(e.target.value)}
                        placeholder="e.g. HDFC00012345678"
                        disabled={isSettlingCredit}
                        style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  {/* Row 3: Upload Bank Slip / Payment Receipt */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                      Upload Bank Slip / Payment Receipt <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      disabled={isSettlingCredit}
                      onChange={(e) => {
                        const f = e.target.files && e.target.files[0];
                        if (f) setSettleCreditFile(f);
                      }}
                      style={{ width: '100%', padding: '10px', border: '1px dashed #CBD5E1', borderRadius: '8px', fontSize: '12px', boxSizing: 'border-box' }}
                    />
                    {settleCreditFile && (
                      <span style={{ fontSize: '11px', color: '#059669', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700' }}>
                        <CheckCircle style={{ width: '13px', height: '13px' }} /> Selected: {settleCreditFile.name} ({Math.round(settleCreditFile.size / 1024)} KB)
                      </span>
                    )}
                  </div>

                  {/* Row 4: Remarks / Notes */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                      Remarks / Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={settleCreditNotes}
                      onChange={(e) => setSettleCreditNotes(e.target.value)}
                      placeholder="Enter remarks or payment notes..."
                      disabled={isSettlingCredit}
                      style={{ width: '100%', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '8px 12px', fontSize: '12px', boxSizing: 'border-box', outline: 'none', resize: 'vertical' }}
                    />
                  </div>

                  {/* Notice Banner */}
                  <div style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', padding: '10px 12px', fontSize: '11.5px', color: '#065F46', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle style={{ width: '16px', height: '16px', flexShrink: 0, color: '#059669' }} />
                    <span>
                      <strong>Instant Clearance:</strong> Credit for this order will be closed immediately, reducing the customer's outstanding credit. The Accounts team will receive an instant real-time notification with the UTR and slip.
                    </span>
                  </div>
                </div>

                {/* Credit Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
                  <button
                    type="button"
                    onClick={() => setUploadPaymentModal(null)}
                    disabled={isSettlingCredit}
                    style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={isSettlingCredit}
                    onClick={() => handleExecuteSettleCredit(uploadPaymentModal)}
                    style={{
                      padding: '9px 22px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#0E7490',
                      color: 'white',
                      fontSize: '13px',
                      fontWeight: '800',
                      cursor: isSettlingCredit ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 4px rgba(14,116,144,0.3)',
                      opacity: isSettlingCredit ? 0.7 : 1
                    }}
                  >
                    {isSettlingCredit ? (
                      <>
                        <RotateCcw style={{ width: '15px', height: '15px', animation: 'spin 0.75s linear infinite' }} />
                        Saving and Updating...
                      </>
                    ) : (
                      <>
                        <Save style={{ width: '15px', height: '15px' }} />
                        Save and Update
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: REGULAR PAYMENT PROOF VIEW (Visible ONLY for Non-Credit orders) */}
            {!isOrderCredit && (() => {
              const totalAttachedCount = existingPaymentDocsList.length + paymentProofFiles.length;
              const isPartial = uploadPaymentModal.paymentType === 'Partial Paid' || uploadPaymentModal.paymentType === 'Partial Payment';
              const isWhileDispatch = uploadPaymentModal.paymentType === 'Payment While Dispatch' || String(uploadPaymentModal.paymentType || '').includes('While Dispatch');
              const prevBal = uploadPaymentModal.balanceAmount != null ? uploadPaymentModal.balanceAmount : Math.max(0, (uploadPaymentModal.grandTotal || 0) - (uploadPaymentModal.partialAmount || 0));

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* Order Financial Status Banner */}
                  <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Payment Status</span>
                      <span style={{ backgroundColor: totalAttachedCount > 0 ? '#DCFCE7' : '#FEF3C7', color: totalAttachedCount > 0 ? '#166534' : '#B45309', fontSize: '11px', fontWeight: '800', padding: '3px 10px', borderRadius: '10px', border: totalAttachedCount > 0 ? '1px solid #BBF7D0' : '1px solid #FDE68A' }}>
                        {totalAttachedCount > 0 ? `✓ ${totalAttachedCount} Payment Proof${totalAttachedCount > 1 ? 's' : ''} on File` : '• Awaiting Payment Proof'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '10px' }}>
                      <div>
                        <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginBottom: '2px' }}>Customer</span>
                        <strong style={{ color: '#0F172A' }}>{uploadPaymentModal.customerName || uploadPaymentModal.companyName || '—'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginBottom: '2px' }}>Payment Terms</span>
                        <strong style={{ color: '#0F172A' }}>{uploadPaymentModal.paymentType || '100% Full Advance'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginBottom: '2px' }}>Total Amount</span>
                        <strong style={{ color: '#059669', fontSize: '13px' }}>
                          ₹ {Number(uploadPaymentModal.grandTotal || uploadPaymentModal.subTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* UNIFIED PAYMENT PROOF SECTION (Single section for Payment while Dispatch / Partial) */}
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F766E', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Receipt size={16} /> Payment Proof
                      </span>
                      {isWhileDispatch && (
                        <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#B45309', backgroundColor: '#FEF3C7', padding: '2px 8px', borderRadius: '6px', border: '1px solid #FDE68A' }}>
                          Payment While Dispatch
                        </span>
                      )}
                      {isPartial && (
                        <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#0D9488', backgroundColor: '#CCFBF1', padding: '2px 8px', borderRadius: '6px', border: '1px solid #99F6E4' }}>
                          Partially Paid
                        </span>
                      )}
                    </div>

                    {/* Breakdown for Partial Payment */}
                    {isPartial && (
                      <div style={{ backgroundColor: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: '#0D9488', display: 'block', fontWeight: '700' }}>Advance Paid:</span>
                          <strong style={{ fontSize: '13px', color: '#0F766E' }}>₹{Number(uploadPaymentModal.partialAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '11px', color: '#0D9488', display: 'block', fontWeight: '700' }}>Remaining Balance Due:</span>
                          <strong style={{ fontSize: '14px', color: '#0F766E' }}>
                            ₹{Number(prevBal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                      </div>
                    )}

                    {isPartial && (
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                          Balance Amount Paid Now (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Enter balance amount paid..."
                          value={modalBalanceAmount}
                          onChange={(e) => setModalBalanceAmount(e.target.value)}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                    )}

                    {/* Existing Payment Proof on File (Compact box without raw thumbnail) */}
                    {existingPaymentDocsList.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle size={14} style={{ color: '#16A34A' }} /> Existing Payment Proof on File ({existingPaymentDocsList.length}):
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {existingPaymentDocsList.map((doc, idx) => {
                            const dName = doc.name || doc.originalName || `Payment_Proof_${idx + 1}.jpg`;
                            return (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  backgroundColor: '#F8FAFC',
                                  border: '1px solid #E2E8F0',
                                  borderRadius: '8px',
                                  gap: '10px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <FileText size={16} />
                                  </div>
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={dName}>
                                      {dName}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#64748B' }}>
                                      Payment Slip #{idx + 1} {doc.size ? `• ${(doc.size / 1024).toFixed(0)} KB` : ''}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewDocModal({ title: `Payment Proof #${idx + 1}: ${dName}`, doc, bomCode: uploadPaymentModal.bomCode })}
                                    style={{
                                      padding: '4px 10px',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      color: '#0E7490',
                                      backgroundColor: '#ECFEFF',
                                      border: '1px solid #A5F3FC',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <Eye size={12} /> View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setExistingPaymentDocsList(prev => prev.filter((_, i) => i !== idx))}
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      color: '#DC2626',
                                      backgroundColor: '#FEF2F2',
                                      border: '1px solid #FECACA',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '2px'
                                    }}
                                    title="Remove this image"
                                  >
                                    <Trash2 size={12} /> Remove
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* File Dropzone */}
                    <div style={{
                      border: '2px dashed #0E7490',
                      backgroundColor: '#F0FDFA',
                      borderRadius: '10px',
                      padding: '14px',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <UploadCloud style={{ width: '26px', height: '26px', color: '#0E7490' }} />
                      <span style={{ fontSize: '12px', color: '#334155', fontWeight: '700' }}>
                        Select payment proof image(s) or bank transfer slip
                      </span>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#0E7490', color: '#FFFFFF', padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 2px 4px rgba(14,116,144,0.25)' }}>
                        <Upload style={{ width: '13px', height: '13px' }} />
                        {paymentProofFiles.length > 0 || existingPaymentDocsList.length > 0 ? '+ Add More Images' : 'Browse Files'}
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              const newFiles = Array.from(e.target.files).filter(f => {
                                try {
                                  validateClientFile(f);
                                  return true;
                                } catch (err) {
                                  alert(`⚠️ Skipped ${f.name}: ${err.message}`);
                                  return false;
                                }
                              });
                              setPaymentProofFiles(prev => [...prev, ...newFiles]);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                      <span style={{ fontSize: '10.5px', color: '#64748B' }}>
                        Supported formats: JPG, PNG, WEBP, PDF
                      </span>
                    </div>

                    {/* Newly Staged Files List */}
                    {paymentProofFiles.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490' }}>
                          New Files Ready to Save ({paymentProofFiles.length}):
                        </span>
                        {paymentProofFiles.map((file, fIdx) => (
                          <div
                            key={fIdx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              backgroundColor: '#F0FDFA',
                              border: '1px solid #99F6E4',
                              borderRadius: '6px',
                              fontSize: '11.5px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                              <FileText size={14} style={{ color: '#0E7490', flexShrink: 0 }} />
                              <span style={{ fontWeight: '700', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.name}>
                                {file.name}
                              </span>
                              <span style={{ color: '#64748B', fontSize: '10px', flexShrink: 0 }}>
                                ({(file.size / 1024).toFixed(0)} KB)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPaymentProofFiles(prev => prev.filter((_, i) => i !== fIdx))}
                              style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                              title="Remove"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bottom Actions for Proof */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
                    <button
                      type="button"
                      onClick={() => setUploadPaymentModal(null)}
                      style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Close
                    </button>
                    {!isCeo && (
                      <button
                        type="button"
                        disabled={uploadingPayment}
                        onClick={async () => {
                          if (paymentProofFiles.length === 0 && existingPaymentDocsList.length === 0) {
                            alert('Please attach or select at least one payment proof image!');
                            return;
                          }
                          setUploadingPayment(true);
                          try {
                            const newlyUploadedDocs = [];
                            for (const f of paymentProofFiles) {
                              if (f instanceof File) {
                                const uploadedMeta = await uploadBomDocumentFile({
                                  file: f,
                                  bomCode: uploadPaymentModal.bomCode,
                                  category: 'payment-proof'
                                });
                                newlyUploadedDocs.push(uploadedMeta);
                              } else {
                                newlyUploadedDocs.push(typeof f === 'object' ? f : { name: f });
                              }
                            }
                            const allPaymentDocs = [...existingPaymentDocsList, ...newlyUploadedDocs];
                            const primaryProof = allPaymentDocs[0] || null;

                            const balPaid = parseFloat(modalBalanceAmount) || 0;
                            const newBal = isPartial && balPaid > 0 ? Math.max(0, prevBal - balPaid) : prevBal;

                            const isPackedAwaitingProof = Boolean(
                              uploadPaymentModal.awaitingSalesPaymentProof ||
                              (typeof uploadPaymentModal.status === 'string' && uploadPaymentModal.status.toLowerCase().includes('awaiting sales payment proof')) ||
                              uploadPaymentModal.packingStatus === 'PACKING_VERIFIED' ||
                              uploadPaymentModal.dispatchPackingVerified
                            );

                            const nextStatus = isPackedAwaitingProof
                              ? 'Dispatch Packing Verified - Sent to Accounts'
                              : (uploadPaymentModal.status || 'Pending Sales Confirmation');

                            const attachedIso = new Date().toISOString();
                            const updatedList = (bomStore || []).map(b => b.bomCode === uploadPaymentModal.bomCode ? {
                              ...b,
                              status: nextStatus,
                              readyForAccounts: isPackedAwaitingProof ? true : b.readyForAccounts,
                              awaitingSalesPaymentProof: false,
                              pendingSalesDispatchPayment: false,
                              dispatchPackingVerified: isPackedAwaitingProof ? true : b.dispatchPackingVerified,
                              packingStatus: isPackedAwaitingProof ? 'PACKING_VERIFIED' : b.packingStatus,
                              paymentProofAttachedAt: attachedIso,
                              balancePaidAt: isPartial ? attachedIso : (b.balancePaidAt || attachedIso),
                              paymentProofDoc: primaryProof,
                              paymentProofDocs: allPaymentDocs,
                              balancePaymentProofDoc: newlyUploadedDocs[newlyUploadedDocs.length - 1] || primaryProof,
                              balanceProofDoc: newlyUploadedDocs[newlyUploadedDocs.length - 1] || primaryProof,
                              balancePaymentProofDocs: allPaymentDocs,
                              uploadedDocuments: [
                                ...(Array.isArray(b.uploadedDocuments) ? b.uploadedDocuments.filter(d => !d.category?.includes('payment') && !d.type?.includes('payment')) : []),
                                ...allPaymentDocs
                              ],
                              accountsVerification: {
                                ...(b.accountsVerification || {}),
                                readyForAccounts: isPackedAwaitingProof ? true : (b.accountsVerification?.readyForAccounts || false),
                                paymentProofDoc: primaryProof,
                                balancePaymentProofDoc: newlyUploadedDocs[newlyUploadedDocs.length - 1] || primaryProof,
                                paymentProofDocs: allPaymentDocs,
                                paymentStatus: 'Payment Proof Attached'
                              },
                              balanceAmount: newBal,
                              paymentUpdated: true,
                              payments: {
                                ...b.payments,
                                proofDoc: primaryProof?.originalName || primaryProof?.name || null,
                                proofDocObj: primaryProof,
                                proofDocs: allPaymentDocs,
                                proofDocObjs: allPaymentDocs,
                                proofDocData: primaryProof?.dataUrl || null,
                                balanceProofDoc: primaryProof?.originalName || primaryProof?.name || null,
                                balanceProofDocObj: primaryProof,
                                balanceUploaded: true,
                                paymentUpdated: true
                              }
                            } : b);
                            setBomStore(updatedList);
                            safeSaveBomStoreToLocal(updatedList);

                            const targetBom = updatedList.find(b => b.bomCode === uploadPaymentModal.bomCode);
                            if (targetBom) {
                              saveCloudBomRow(targetBom);
                              const sesId = typeof window !== 'undefined' && window.localStorage
                                ? (localStorage.getItem('controlroom_device_session_id') || localStorage.getItem('businz_device_session_id'))
                                : null;
                              const curRole = typeof window !== 'undefined' && window.localStorage ? (localStorage.getItem('controlroom_user_role') || 'Sales') : 'Sales';
                              const curEmp = typeof window !== 'undefined' && window.localStorage ? (localStorage.getItem('controlroom_logged_emp_id') || 'SE-001') : 'SE-001';

                              fetch('/api/boms', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  ...(sesId ? { 'x-session-id': sesId } : {}),
                                  'x-user-role': curRole,
                                  'x-employee-code': curEmp
                                },
                                body: JSON.stringify({ bom: stripDataUrlsFromRecord(targetBom), isUpdate: true })
                              }).catch(() => {});

                              if (isPackedAwaitingProof) {
                                try {
                                  notifyBomPackedAndSentToAccounts({
                                    bomCode: targetBom.bomCode,
                                    customerName: targetBom.customerName || targetBom.c3,
                                    actorName: getCleanSalesPersonName(targetBom.salesPerson)
                                  });
                                } catch (nErr) {
                                  console.warn('Failed to send Accounts notification:', nErr);
                                }
                              }
                            }
                            setUploadPaymentModal(null);
                            setPaymentProofFiles([]);
                            setExistingPaymentDocsList([]);
                            setPaymentProofFile(null);
                            setModalBalanceAmount('');
                            alert(`✅ ${allPaymentDocs.length} Payment proof document(s) uploaded and saved successfully!`);
                          } catch (err) {
                            alert(`Payment upload failed: ${err.message}`);
                          } finally {
                            setUploadingPayment(false);
                          }
                        }}
                        style={{
                          padding: '9px 22px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: '#0E7490',
                          color: 'white',
                          fontSize: '13px',
                          fontWeight: '800',
                          cursor: uploadingPayment ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 4px rgba(14,116,144,0.3)',
                          opacity: uploadingPayment ? 0.7 : 1
                        }}
                      >
                        {uploadingPayment ? (
                          <>
                            <RotateCcw style={{ width: '15px', height: '15px', animation: 'spin 0.75s linear infinite' }} />
                            Saving and Updating...
                          </>
                        ) : (
                          <>
                            <Save style={{ width: '15px', height: '15px' }} />
                            Save and Update
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </>
        );
      })()}
          </div>
        </div>
      )}

      {/* SETTLE CREDIT / RECORD PAYMENT MODAL */}
      {settleCreditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, fontFamily: "'DM Sans', sans-serif", padding: '16px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '18px', padding: '28px', maxWidth: '540px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid #E2E8F0', maxHeight: '90vh', overflowY: 'auto' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #A7F3D0' }}>
                  <Receipt style={{ width: '22px', height: '22px' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Settle Credit / Record Payment</h3>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>{settleCreditModal.bomCode} — {settleCreditModal.customerName || settleCreditModal.companyName || 'Customer'}</span>
                </div>
              </div>
              <button 
                onClick={() => setSettleCreditModal(null)} 
                disabled={isSettlingCredit}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B', padding: '4px' }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            {/* Order Overview Summary Card */}
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '12px' }}>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginBottom: '2px' }}>Customer Name</span>
                <strong style={{ color: '#0F172A', fontSize: '13px' }}>{settleCreditModal.customerName || settleCreditModal.companyName || '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginBottom: '2px' }}>Agreed Payment Terms</span>
                <strong style={{ color: '#2563EB', fontSize: '13px' }}>
                  {settleCreditModal.paymentType || (settleCreditModal.creditDays ? `${settleCreditModal.creditDays} Days Credit` : 'Credit Payment')}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginBottom: '2px' }}>Order Total / Credit Due</span>
                <strong style={{ color: '#059669', fontSize: '15px', fontWeight: '800' }}>
                  ₹ {Number(settleCreditModal.grandTotal || settleCreditModal.subTotal || settleCreditModal.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginBottom: '2px' }}>BOM Ref Number</span>
                <strong style={{ color: '#0E7490', fontSize: '13px' }}>{settleCreditModal.bomCode || '—'}</strong>
              </div>
            </div>

            {/* Input Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Row 1: Payment Date & Amount */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Payment Received Date <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={settleCreditDate}
                    onChange={(e) => setSettleCreditDate(e.target.value)}
                    disabled={isSettlingCredit}
                    style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Settled Amount (₹) <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    value={settleCreditAmount}
                    onChange={(e) => setSettleCreditAmount(e.target.value)}
                    placeholder="Enter amount paid"
                    disabled={isSettlingCredit}
                    style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Row 2: Payment Mode & UTR / Ref Number */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Payment Mode <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <select
                    value={settleCreditMode}
                    onChange={(e) => setSettleCreditMode(e.target.value)}
                    disabled={isSettlingCredit}
                    style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '12.5px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF' }}
                  >
                    <option value="NEFT / RTGS (Direct Bank Transfer)">NEFT / RTGS (Direct Bank)</option>
                    <option value="IMPS Transfer">IMPS Transfer</option>
                    <option value="UPI Transfer">UPI Transfer</option>
                    <option value="Cheque / DD">Cheque / Demand Draft</option>
                    <option value="Cash Deposit">Cash Deposit</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Bank Reference / UTR Number <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={settleCreditUtr}
                    onChange={(e) => setSettleCreditUtr(e.target.value)}
                    placeholder="e.g. HDFC00012345678"
                    disabled={isSettlingCredit}
                    style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Row 3: Upload Bank Slip / Payment Receipt */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Upload Bank Slip / Payment Receipt <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  disabled={isSettlingCredit}
                  onChange={(e) => {
                    const f = e.target.files && e.target.files[0];
                    if (f) setSettleCreditFile(f);
                  }}
                  style={{ width: '100%', padding: '10px', border: '1px dashed #CBD5E1', borderRadius: '8px', fontSize: '12px', boxSizing: 'border-box' }}
                />
                {settleCreditFile && (
                  <span style={{ fontSize: '11px', color: '#059669', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700' }}>
                    <CheckCircle style={{ width: '13px', height: '13px' }} /> Selected: {settleCreditFile.name} ({Math.round(settleCreditFile.size / 1024)} KB)
                  </span>
                )}
              </div>

              {/* Row 4: Notes / Remarks */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Remarks / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={settleCreditNotes}
                  onChange={(e) => setSettleCreditNotes(e.target.value)}
                  placeholder="Enter remarks or payment notes..."
                  disabled={isSettlingCredit}
                  style={{ width: '100%', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '8px 12px', fontSize: '12px', boxSizing: 'border-box', outline: 'none', resize: 'vertical' }}
                />
              </div>

              {/* Notice Banner */}
              <div style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', padding: '10px 12px', fontSize: '11.5px', color: '#065F46', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle style={{ width: '16px', height: '16px', flexShrink: 0, color: '#059669' }} />
                <span>
                  <strong>Instant Clearance:</strong> Credit for this order will be closed immediately, reducing the customer's outstanding credit. The Accounts team will receive an instant real-time notification with the UTR and slip.
                </span>
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => setSettleCreditModal(null)}
                disabled={isSettlingCredit}
                style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSettlingCredit}
                onClick={() => handleExecuteSettleCredit(settleCreditModal)}
                style={{
                  padding: '9px 22px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: isSettlingCredit ? '#94A3B8' : '#059669',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: isSettlingCredit ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(5,150,105,0.3)'
                }}
              >
                {isSettlingCredit ? 'Settling Credit...' : '✓ Confirm & Settle Credit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM ALERT POPUP WITH MISSING FIELDS SUPPORT */}
      {customAlert && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '16px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '18px', padding: '24px', maxWidth: '480px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0,
                backgroundColor: customAlert.type === 'error' ? '#FEE2E2' : customAlert.type === 'warning' ? '#FEF3C7' : '#DCFCE7',
                color: customAlert.type === 'error' ? '#DC2626' : customAlert.type === 'warning' ? '#D97706' : '#166534',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {customAlert.type === 'error' ? <AlertCircle size={24} /> : customAlert.type === 'warning' ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px 0' }}>{customAlert.title}</h3>
                <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: '1.4', whiteSpace: 'pre-line' }}>{customAlert.message}</p>
              </div>
            </div>

            {/* Render Missing Fields Card List if provided */}
            {Array.isArray(customAlert.details) && customAlert.details.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                {customAlert.details.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      if (item.targetId) {
                        const el = document.getElementById(item.targetId);
                        if (el) {
                          setCustomAlert(null);
                          setTimeout(() => {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el.focus();
                          }, 100);
                        }
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '10px',
                      padding: '10px 14px', backgroundColor: '#FEF2F2',
                      border: '1px solid #FECACA', borderRadius: '10px',
                      cursor: item.targetId ? 'pointer' : 'default'
                    }}
                  >
                    <AlertCircle size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#991B1B' }}>{item.field}</div>
                      <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '2px' }}>{item.message}</div>
                    </div>
                    {item.targetId && (
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '2px 8px', borderRadius: '6px', alignSelf: 'center', whiteSpace: 'nowrap' }}>
                        Fill Field →
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                onClick={() => {
                  const targetId = customAlert.targetFieldId || (customAlert.details?.[0]?.targetId);
                  setCustomAlert(null);
                  if (targetId) {
                    setTimeout(() => {
                      const el = document.getElementById(targetId);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.focus();
                      }
                    }, 100);
                  }
                }}
                style={{
                  padding: '9px 22px', borderRadius: '10px', border: 'none',
                  backgroundColor: customAlert.type === 'error' ? '#DC2626' : '#0E7490',
                  color: 'white', fontSize: '13px', fontWeight: '800', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(14,116,144,0.3)'
                }}
              >
                {customAlert.details?.length > 0 ? 'Review & Fill Details →' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      {renderDocPreviewModal()}

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

      {/* BOM CANCELLATION REASON PROMPT MODAL */}
      {bomCancelPromptModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100000, padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '540px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            border: '1px solid #E2E8F0',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#FFFFFF'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <AlertTriangle style={{ width: '22px', height: '22px', color: '#FFFFFF' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
                    Cancel BOM & Restore Stock
                  </h3>
                  <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
                    BOM: <strong>{bomCancelPromptModal.bomCode || bomCancelPromptModal.code}</strong> • Customer: {bomCancelPromptModal.customerName || bomCancelPromptModal.clientName || 'Customer'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setBomCancelPromptModal(null);
                  setCancellationReasonInput('');
                }}
                style={{
                  background: 'none', border: 'none', color: '#FFFFFF',
                  cursor: 'pointer', padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '12px',
                color: '#991B1B',
                lineHeight: 1.5
              }}>
                <strong>⚠️ Why are you cancelling this BOM?</strong>
                <br />
                The Sales Person (<strong>{(bomCancelPromptModal.salesPerson || bomCancelPromptModal.createdBy || 'Sales Department').replace(/\s*\([^)]*\)/g, '').trim()}</strong>) who raised this order will be immediately notified with your reason, and reserved stock will be returned to raw inventory.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Quick Select Reason
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    'Customer requested order cancellation',
                    'Specification / Drawing changed by client',
                    'Payment term non-compliance',
                    'Wrong profile / cut length selected in BOM',
                    'Duplicate BOM entry created',
                    'Material grade / thickness unavailable'
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCancellationReasonInput(preset)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        border: cancellationReasonInput === preset ? '1.5px solid #DC2626' : '1px solid #CBD5E1',
                        backgroundColor: cancellationReasonInput === preset ? '#FEF2F2' : '#F8FAFC',
                        color: cancellationReasonInput === preset ? '#DC2626' : '#475569',
                        fontSize: '11px',
                        fontWeight: cancellationReasonInput === preset ? '700' : '600',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="bom-orders-cancellation-reason-input" style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Cancellation Reason <span style={{ color: '#DC2626' }}>* (Required)</span>
                </label>
                <textarea id="bom-orders-cancellation-reason-input" name="cancellationReasonInput" aria-label="Cancellation Reason  (Required)"
                  value={cancellationReasonInput}
                  onChange={(e) => setCancellationReasonInput(e.target.value)}
                  placeholder="Explain why this BOM is being cancelled (e.g. Customer cancelled the project, drawing mismatch...)"
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '13px',
                    color: '#0F172A',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    lineHeight: '1.5'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#DC2626'}
                  onBlur={(e) => e.target.style.borderColor = '#CBD5E1'}
                 />
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              backgroundColor: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                type="button"
                onClick={() => {
                  setBomCancelPromptModal(null);
                  setCancellationReasonInput('');
                }}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Keep BOM Active
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!cancellationReasonInput.trim()) {
                    alert('Please enter or select a reason for cancelling this BOM.');
                    return;
                  }
                  executeCancelBom(bomCancelPromptModal, cancellationReasonInput.trim());
                }}
                disabled={!cancellationReasonInput.trim()}
                style={{
                  padding: '9px 22px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: cancellationReasonInput.trim() ? '#DC2626' : '#FCA5A5',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: cancellationReasonInput.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: cancellationReasonInput.trim() ? '0 4px 12px rgba(220, 38, 38, 0.3)' : 'none'
                }}
              >
                <XCircle size={15} /> Confirm & Cancel BOM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MANDATORY VALIDATION MODAL */}
      {renderValidationErrorModal()}

      {/* FULL-SCREEN BOM CREATION LOADING OVERLAY */}
      {renderBomSubmittingOverlay()}

      {/* ─── DEDICATED LR COPY UPLOAD POPUP MODAL ─── */}
      {lrUploadModal && (
        <LrUploadPopupModal
          bom={lrUploadModal}
          onClose={() => setLrUploadModal(null)}
          setBomStore={setBomStore}
        />
      )}
    </>
  );
}
