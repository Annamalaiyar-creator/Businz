import React from 'react';
import { AlertTriangle, Upload, Layers, Loader, Save } from 'lucide-react';
import { saveCloudStore, getAndReserveNextBomCode, resolveBomCollisions, saveCloudBomRow } from '../../../utils/supabaseDataSync';
import { stripDataUrlsFromRecord, cleanNum, normalizePaymentTerm } from '../../../utils/otherViewsShared';
import { uploadBomDocumentFile } from '../../../utils/bomStorageClient';
import { notifyBomCreatedToSales } from '../../../services/notificationService';
import { getNextSequence } from '../../../utils/sequenceGenerator';

function buildBomEditChanges(oldBom, nextBom) {
  if (!oldBom || !nextBom) return ['BOM details updated'];
  const changes = [];
  const norm = (v) => String(v == null ? '' : v).trim();
  const checkStr = (label, a, b) => {
    const sA = norm(a);
    const sB = norm(b);
    if (sA !== sB) changes.push(`${label}: "${sA || '—'}" → "${sB || '—'}"`);
  };
  checkStr('Customer', oldBom.customerName || oldBom.companyName, nextBom.customerName || nextBom.companyName);
  checkStr('Doc Type', oldBom.docType, nextBom.docType);
  checkStr('Delivery Date', oldBom.deliveryDate, nextBom.deliveryDate);
  checkStr('Mode of Transport', oldBom.transportMode, nextBom.transportMode);
  checkStr('Transport Name', oldBom.transporterName, nextBom.transporterName);
  checkStr('Destination', oldBom.destination, nextBom.destination);
  checkStr('Payment Terms', oldBom.paymentType, nextBom.paymentType);
  if (Number(oldBom.partialAmount || 0) !== Number(nextBom.partialAmount || 0)) {
    changes.push(`Partial Amount: ₹${Number(oldBom.partialAmount || 0).toLocaleString('en-IN')} → ₹${Number(nextBom.partialAmount || 0).toLocaleString('en-IN')}`);
  }
  checkStr('Billing Address', oldBom.billingAddress, nextBom.billingAddress);
  checkStr('Delivery Address', oldBom.deliveryAddress, nextBom.deliveryAddress);
  checkStr('Remarks', oldBom.remarks, nextBom.remarks);

  const oldItemsMap = new Map();
  (Array.isArray(oldBom.items) ? oldBom.items : []).forEach((it) => {
    const k = norm(it?.name || it?.code).toLowerCase();
    if (k) oldItemsMap.set(k, it);
  });
  const nextItemsMap = new Map();
  (Array.isArray(nextBom.items) ? nextBom.items : []).forEach((it) => {
    const k = norm(it?.name || it?.code).toLowerCase();
    if (k) nextItemsMap.set(k, it);
  });
  nextItemsMap.forEach((nIt, k) => {
    const oIt = oldItemsMap.get(k);
    if (!oIt) {
      changes.push(`Added Item: ${nIt.name} (Qty ${nIt.qty})`);
    } else {
      if (Number(oIt.qty || 0) !== Number(nIt.qty || 0)) {
        changes.push(`Item Qty (${nIt.name}): ${oIt.qty} → ${nIt.qty}`);
      }
      if (Number(oIt.rate || 0) !== Number(nIt.rate || 0)) {
        changes.push(`Item Rate (${nIt.name}): ₹${Number(oIt.rate || 0).toLocaleString('en-IN')} → ₹${Number(nIt.rate || 0).toLocaleString('en-IN')}`);
      }
    }
  });
  oldItemsMap.forEach((oIt, k) => {
    if (!nextItemsMap.has(k)) {
      changes.push(`Removed Item: ${oIt.name} (Qty ${oIt.qty})`);
    }
  });

  if (Math.round(Number(oldBom.grandTotal || 0)) !== Math.round(Number(nextBom.grandTotal || 0))) {
    changes.push(`Grand Total: ₹${Number(oldBom.grandTotal || 0).toLocaleString('en-IN')} → ₹${Number(nextBom.grandTotal || 0).toLocaleString('en-IN')}`);
  }
  return changes.length > 0 ? changes : ['BOM details updated'];
}

export default function BomCreateSubmitModal({ ctx }) {
  const {
    safeSaveBomStoreToLocal,
    setCurrentPage,
    bomStore,
    setBomStore,
    customerList,
    setShowBOMForm,
    setNewBomCode,
    newBomDeliveryDate,
    newBomProductName,
    setNewBomProductName,
    newBomCompanyName,
    setNewBomCompanyName,
    newBomContactPerson,
    setNewBomContactPerson,
    newBomPhone,
    setNewBomPhone,
    newBomEmail,
    setNewBomEmail,
    newBomGstNo,
    setNewBomGstNo,
    newBomDocType,
    newBomDeliveryAddress,
    newBomBillingStreet,
    setNewBomBillingStreet,
    newBomBillingCity,
    setNewBomBillingCity,
    newBomBillingState,
    setNewBomBillingState,
    newBomBillingPincode,
    setNewBomBillingPincode,
    newBomDeliveryStreet,
    setNewBomDeliveryStreet,
    newBomDeliveryCity,
    setNewBomDeliveryCity,
    newBomDeliveryState,
    setNewBomDeliveryState,
    newBomDeliveryPincode,
    setNewBomDeliveryPincode,
    newBomPaymentType,
    setNewBomPaymentType,
    newBomPartialAmount,
    newBomCreditDays,
    setNewBomCreditDays,
    sameAsBilling,
    setSameAsBilling,
    setNewBomDeliveryProofDoc,
    newBomPaymentProofDoc,
    setNewBomPaymentProofDoc,
    newBomRemarks,
    setNewBomRemarks,
    newBomTransportMode,
    setNewBomTransportMode,
    newBomTransporterName,
    setNewBomTransporterName,
    newBomDestination,
    setNewBomDestination,
    newBomVehicleNo,
    setNewBomVehicleNo,
    newBomTransportScope,
    setNewBomTransportScope,
    newBomLrNo,
    setNewBomLrNo,
    deliveryDocs,
    paymentDocs,
    isSubmittingBom,
    setIsSubmittingBom,
    setBomSubmitStage,
    setBomSubmitAssignedCode,
    isSubmittingBomRef,
    newBomSourcePiNo,
    setNewBomSourcePiNo,
    newBomSalesPersonCode,
    newBomCreatedBy,
    newBomCreatedById,
    defaultSalesPersonName,
    newBomSalesPerson,
    selectedPreset,
    setSelectedPreset,
    presetSetCount,
    setPresetSetCount,
    presetUnit,
    presetKitPrice,
    setPresetKitPrice,
    presetGroups,
    setPresetGroups,
    bomConfirmModal,
    setBomConfirmModal,
    bomMaterialsList,
    setBomMaterialsList,
    alert,
    totals,
    editingBomRecord,
    setEditingBomRecord,
    originalPiSnapshot,
    setOriginalPiSnapshot,
    userRole
  } = ctx;

  return (
    <>
        {/* CONFIRMATION / SUBMISSION MODAL */}
        {bomConfirmModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', maxWidth: '440px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: bomConfirmModal === 'cancel' ? '#FEE2E2' : '#ECFEFF', color: bomConfirmModal === 'cancel' ? '#DC2626' : '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {bomConfirmModal === 'cancel' ? <AlertTriangle style={{ width: '20px', height: '20px' }} /> : <Layers style={{ width: '20px', height: '20px' }} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                    {bomConfirmModal === 'cancel' && 'Go Back?'}
                    {bomConfirmModal === 'draft' && 'Save BOM Order as Draft?'}
                    {bomConfirmModal === 'create' && 'Confirm & Complete BOM Order?'}
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B', lineHeight: '1.4' }}>
                    {bomConfirmModal === 'cancel' && 'Are you sure you want to go back? Any unsaved changes entered in this BOM form will be lost.'}
                    {bomConfirmModal === 'draft' && 'Save this BOM order in Draft state? You can edit details, attach documents, and confirm it later before sending to Dispatch.'}
                    {bomConfirmModal === 'create' && `Are you sure you want to complete this BOM order and forward it directly to Dispatch for packing?`}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                <button
                  disabled={isSubmittingBom}
                  onClick={() => setBomConfirmModal(null)}
                  style={{
                    border: '1px solid #CBD5E1',
                    backgroundColor: 'white',
                    color: isSubmittingBom ? '#94A3B8' : '#475569',
                    padding: '9px 18px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isSubmittingBom ? 'not-allowed' : 'pointer',
                    opacity: isSubmittingBom ? 0.6 : 1
                  }}
                >
                  Go Back
                </button>
                <button
                  disabled={isSubmittingBom}
                  onClick={async () => {
                    if (bomConfirmModal === 'cancel') {
                      setShowBOMForm(false);
                      setBomConfirmModal(null);
                      if (setEditingBomRecord) setEditingBomRecord(null);
                      if (setOriginalPiSnapshot) setOriginalPiSnapshot(null);
                      setSelectedPreset('');
                      setPresetKitPrice('');
                      setPresetSetCount(1);
                      setPresetGroups({});
                      setNewBomTransportMode('');
                      setNewBomTransporterName('');
                      setNewBomDestination('');
                      setNewBomVehicleNo('');
                      setNewBomTransportScope('');
                      setNewBomSourcePiNo('');
                      setNewBomBillingStreet('');
                      setNewBomBillingCity('');
                      setNewBomBillingState('');
                      setNewBomBillingPincode('');
                      setNewBomDeliveryStreet('');
                      setNewBomDeliveryCity('');
                      setNewBomDeliveryState('');
                      setNewBomDeliveryPincode('');
                      setNewBomCompanyName('');
                      setNewBomContactPerson('');
                      setNewBomPhone('');
                      setNewBomEmail('');
                      setNewBomGstNo('');
                      setSameAsBilling(true);
                      setNewBomPaymentProofDoc(null);
                      setNewBomDeliveryProofDoc(null);
                    } else if (bomConfirmModal === 'draft' || bomConfirmModal === 'create') {
                      // MULTI-CLICK MUTEX GUARD: Drop any secondary clicks while submitting
                      if (isSubmittingBomRef.current) {
                        console.warn('BOM creation already in progress. Ignoring duplicate click.');
                        return;
                      }
                      isSubmittingBomRef.current = true;
                      setIsSubmittingBom(true);
                      setBomSubmitStage('validating');
                      setBomSubmitAssignedCode('');

                      try {
                        const isDraft = bomConfirmModal === 'draft';
                        const target = (newBomProductName || '').toLowerCase().trim();
                        const selCust = target ? customerList.find(c => {
                          const code = (c.code || '').toLowerCase().trim();
                          const c2 = (c.c2 || '').toLowerCase().trim();
                          const cName = (c.customerName || '').toLowerCase().trim();
                          const comp = (c.companyName || '').toLowerCase().trim();
                          return code === target || c2 === target || cName === target || comp === target ||
                                 (code && code.startsWith(target)) || (c2 && c2.startsWith(target)) ||
                                 (cName && cName.startsWith(target)) || (comp && comp.startsWith(target)) ||
                                 (c2 && c2.includes(target)) || (comp && comp.includes(target));
                        }) : null;

                        const bObj = selCust?.billingAddressObj || {};
                        const bStreet = newBomBillingStreet || bObj.address || selCust?.c6 || selCust?.billingAddress || '';
                        const bCity = newBomBillingCity || bObj.city || '';
                        const bState = newBomBillingState || bObj.state || '';
                        const bPin = newBomBillingPincode || bObj.pincode || '';

                        const formatAddr = (st, ct, sta, pin) => {
                          const parts = [st, ct, sta, pin ? `Pincode: ${pin}` : ''].filter(Boolean);
                          return parts.join(', ');
                        };

                        const billingObj = { address: bStreet, city: bCity, state: bState, pincode: bPin };
                        const billingFull = formatAddr(bStreet, bCity, bState, bPin) || selCust?.c6 || selCust?.billingAddress || '-';
                        const deliveryFull = sameAsBilling
                          ? billingFull
                          : (formatAddr(newBomDeliveryStreet, newBomDeliveryCity, newBomDeliveryState, newBomDeliveryPincode) || newBomDeliveryAddress || '-');

                        const deliveryObj = sameAsBilling
                          ? { address: bStreet, city: bCity, state: bState, pincode: bPin }
                          : { address: newBomDeliveryStreet, city: newBomDeliveryCity, state: newBomDeliveryState, pincode: newBomDeliveryPincode };

                        const existingNumsRec = (bomStore || []).map(b => {
                          const match = String(b.bomCode || b.code || b.id || '').match(/BOM-(\d+)/i);
                          return match ? parseInt(match[1], 10) : 0;
                        }).filter(n => Number.isFinite(n) && n > 0);
                        // BOM code is strictly assigned atomically upon submission
                        const finalCode = 'BOM-PENDING';

                        const loggedInOperatorName = (localStorage.getItem('controlroom_logged_user_name') || '').trim() || defaultSalesPersonName;
                        const loggedInOperatorId = (localStorage.getItem('controlroom_logged_emp_id') || '').trim();

                        // PRESERVE ORIGINAL PI SALESPERSON: Prioritize PI salesperson over converting operator
                        const effectiveSalesPersonName = (newBomSalesPerson && newBomSalesPerson.trim()) ? newBomSalesPerson.trim() : (newBomCreatedBy || loggedInOperatorName);
                        const effectiveSalesPersonCode = (newBomSalesPersonCode && newBomSalesPersonCode.trim()) ? newBomSalesPersonCode.trim() : (newBomCreatedById || loggedInOperatorId);
                        const effectiveCreatorName = loggedInOperatorName;
                        const effectiveCreatedById = loggedInOperatorId || effectiveSalesPersonCode;

                        const hasPaymentProof = Boolean(newBomPaymentProofDoc);
                        const newBomRecord = {
                          id: finalCode,
                          bomCode: finalCode,
                          code: finalCode,
                          docType: newBomDocType || 'Invoice',
                          sourcePiNo: newBomSourcePiNo || null,
                          date: new Date().toISOString().split('T')[0],
                          createdAt: new Date().toISOString(),
                          deliveryDate: newBomDeliveryDate || null,
                          customerName: (newBomCompanyName && newBomCompanyName !== '-') ? newBomCompanyName : (newBomProductName || selCust?.c2 || selCust?.companyName || selCust?.code || 'Customer Order'),
                          companyName: (newBomCompanyName && newBomCompanyName !== '-') ? newBomCompanyName : (newBomProductName || selCust?.c2 || selCust?.companyName || selCust?.code || '-'),
                          contactPerson: newBomContactPerson || selCust?.contact || selCust?.contactPerson || '-',
                          mobile: newBomPhone || selCust?.c4 || selCust?.phone || '-',
                          email: newBomEmail || selCust?.c5 || selCust?.email || '-',
                          gstNo: newBomGstNo || selCust?.gst || selCust?.gstNo || '-',
                          billingAddress: billingFull,
                          billingAddressObj: billingObj,
                          deliveryAddress: deliveryFull,
                          deliveryAddressObj: deliveryObj,
                          deliveryAddressProofDoc: sameAsBilling ? null : (deliveryDocs[0] || null),
                          deliveryAddressProofDocs: sameAsBilling ? [] : deliveryDocs,
                          transportMode: newBomTransportMode || '',
                          transportScope: newBomTransportScope || '',
                          transporterName: newBomTransporterName || '',
                          destination: (newBomDestination || '').trim(),
                          vehicleNo: newBomVehicleNo || '',
                          lrNo: newBomLrNo || '',
                          paymentType: normalizePaymentTerm(newBomPaymentType),
                          partialAmount: (newBomPaymentType === 'Partial Paid' || newBomPaymentType === 'Partial Payment') ? (parseFloat(newBomPartialAmount) || 0) : null,
                          balanceAmount: (newBomPaymentType === 'Partial Paid' || newBomPaymentType === 'Partial Payment') ? Math.max(0, cleanNum(totals.grand, 0) - (parseFloat(newBomPartialAmount) || 0)) : null,
                          creditDays: newBomPaymentType === 'Credit Payment' ? (parseInt(newBomCreditDays) || 7) : null,
                          creditDueDate: newBomPaymentType === 'Credit Payment' ? new Date(Date.now() + (parseInt(newBomCreditDays) || 7) * 86400000).toISOString().split('T')[0] : null,
                          paymentProofDoc: paymentDocs[0] || null,
                          paymentProofDocs: paymentDocs,
                          paymentUpdated: (newBomPaymentType === '100% Paid' || newBomPaymentType === 'Partial Paid' || newBomPaymentType === 'Partial Payment') && paymentDocs.length > 0,
                          remarks: newBomRemarks || '',
                          status: isDraft ? 'Draft' : 'Pending Confirmation',
                          salesConfirmed: false,
                          salesConfirmedAt: null,
                          salesPerson: effectiveSalesPersonName,
                          salesPersonCode: effectiveSalesPersonCode,
                          createdBy: effectiveCreatorName,
                          createdById: effectiveCreatedById,
                          convertedBy: loggedInOperatorName,
                          convertedById: loggedInOperatorId,
                          items: (bomMaterialsList || []).map(item => ({
                            code: item.code || '',
                            name: item.name || 'Custom Item',
                            category: item.category || (item.isPresetItem ? 'Preset Component' : ''),
                            uom: item.uom || item.unit || 'NOS',
                            unit: item.uom || item.unit || 'NOS',
                            qty: cleanNum(item.qty, 1),
                            rate: item.isPresetItem ? 0 : cleanNum(item.rate, 0),
                            gstRate: item.gstRate || '18%',
                            confirmed: false,
                            isPresetItem: Boolean(item.isPresetItem),
                            presetGroupId: item.presetGroupId || null,
                            presetName: item.presetName || null,
                            baseQty: item.baseQty != null ? cleanNum(item.baseQty, 1) : null
                          })),
                          payments: {
                            advance50Uploaded: false,
                            dispatch50Uploaded: false,
                            advance100Uploaded: newBomPaymentType === '100% Paid' && hasPaymentProof,
                            net30Uploaded: false,
                            proofDoc: paymentDocs[0] ? paymentDocs[0].name : null,
                            proofDocObj: paymentDocs[0] || null,
                            proofDocs: paymentDocs.map(d => d.name),
                            proofDocObjs: paymentDocs,
                            paymentUpdated: newBomPaymentType === '100% Paid' && paymentDocs.length > 0
                          },
                          dispatchPacking: (bomMaterialsList || []).map(item => ({
                            code: item.code || '',
                            name: item.name || 'Custom Item',
                            bomQty: cleanNum(item.qty, 1),
                            packed: false
                          })),
                          accountsVerification: {
                            paymentStatus: null,
                            hardCopyReceived: false,
                            softCopyReceived: false
                          },
                          invoiceConfirmed: false,
                          invoiceDeducted: false,
                          stockBlocked: !isDraft,
                          stockBlockedAt: !isDraft ? new Date().toISOString() : null,
                          presetName: Object.values(presetGroups).map(g => `${g.presetName} (${g.setCount} ${g.unit === 'kW' ? 'kW' : (g.setCount > 1 ? 'Sets' : 'Set')})`).join(' + ') || selectedPreset || null,
                          presetKitPrice: (Object.values(presetGroups).length === 1 && Object.values(presetGroups)[0]?.kitPrice)
                            ? cleanNum(Object.values(presetGroups)[0].kitPrice, null)
                            : (totals.kitSubtotal || ((selectedPreset && presetKitPrice !== '') ? cleanNum(presetKitPrice, null) : null)),
                          presetSetCount: Object.values(presetGroups).length === 1
                            ? (parseFloat(Object.values(presetGroups)[0]?.setCount) || 1)
                            : (selectedPreset ? (parseFloat(presetSetCount) || 1) : null),
                          presetUnit: presetUnit || (Object.values(presetGroups)[0]?.unit) || 'Sets',
                          presetGroups: Object.values(presetGroups).map(g => ({
                            ...g,
                            kitPrice: cleanNum(g.kitPrice, 0),
                            setCount: parseFloat(g.setCount) || 1,
                            sets: parseFloat(g.setCount) || 1,
                            unit: g.unit || g.unitType || 'Sets',
                            unitType: g.unit || g.unitType || 'Sets'
                          })),
                          subTotal: cleanNum(totals.sub, 0),
                          gstAmount: cleanNum(totals.gst, 0),
                          cgstAmount: cleanNum(totals.cgst, 0),
                          sgstAmount: cleanNum(totals.sgst, 0),
                          grandTotal: cleanNum(totals.grand, 0)
                        };

                        let sanitizedNewBom = stripDataUrlsFromRecord(newBomRecord);
                        const isEditingExisting = Boolean(editingBomRecord && (editingBomRecord.bomCode || editingBomRecord.code || editingBomRecord.id));
                        if (!isEditingExisting && originalPiSnapshot && sanitizedNewBom.sourcePiNo) {
                          const normVal = (v) => String(v == null ? '' : v).trim();
                          const editedFields = {};
                          const oldComp = normVal(originalPiSnapshot.companyName || originalPiSnapshot.vendorName || originalPiSnapshot.customerName);
                          const newComp = normVal(sanitizedNewBom.companyName || sanitizedNewBom.customerName);
                          if (oldComp && newComp && oldComp !== newComp) editedFields.companyName = `${oldComp} → ${newComp}`;
                          const oldPay = normVal(originalPiSnapshot.paymentTerms || originalPiSnapshot.paymentType);
                          const newPay = normVal(sanitizedNewBom.paymentType);
                          if (oldPay && newPay && oldPay !== newPay) editedFields.paymentType = `${oldPay} → ${newPay}`;
                          const oldRem = normVal(originalPiSnapshot.remarks || originalPiSnapshot.notes);
                          const newRem = normVal(sanitizedNewBom.remarks);
                          if (oldRem !== newRem && (oldRem || newRem)) editedFields.remarks = `${oldRem || '—'} → ${newRem || '—'}`;

                          const piItemsList = Array.isArray(originalPiSnapshot.items) ? originalPiSnapshot.items : [];
                          const piItemMap = new Map();
                          piItemsList.forEach(pIt => {
                            const k = normVal(pIt?.name || pIt?.code).toLowerCase();
                            if (k) piItemMap.set(k, pIt);
                          });
                          let anyItemEdited = false;
                          sanitizedNewBom.items = (sanitizedNewBom.items || []).map(bIt => {
                            const k = normVal(bIt?.name || bIt?.code).toLowerCase();
                            const matchPi = k ? piItemMap.get(k) : null;
                            if (!matchPi) {
                              anyItemEdited = true;
                              return { ...bIt, isEdited: true, editedNote: 'Added during PI → BOM conversion' };
                            }
                            const diffs = [];
                            if (Number(matchPi.qty || 0) !== Number(bIt.qty || 0)) {
                              diffs.push(`Qty: ${matchPi.qty || 0} → ${bIt.qty || 0}`);
                            }
                            if (!bIt.isPresetItem && Number(matchPi.rate || 0) !== Number(bIt.rate || 0)) {
                              diffs.push(`Rate: ₹${Number(matchPi.rate || 0).toLocaleString('en-IN')} → ₹${Number(bIt.rate || 0).toLocaleString('en-IN')}`);
                            }
                            if (diffs.length > 0) {
                              anyItemEdited = true;
                              return { ...bIt, isEdited: true, editedNote: diffs.join(', ') };
                            }
                            return bIt;
                          });
                          if (Object.keys(editedFields).length > 0 || anyItemEdited) {
                            sanitizedNewBom.editedFields = editedFields;
                            sanitizedNewBom.isEdited = true;
                            sanitizedNewBom.lastEditedAt = new Date().toISOString();
                            sanitizedNewBom.lastEditedBy = loggedInOperatorName;
                          }
                        }
                        if (isEditingExisting) {
                          const nowIso = new Date().toISOString();
                          const existingCode = editingBomRecord.bomCode || editingBomRecord.code || editingBomRecord.id;
                          const diffList = buildBomEditChanges(editingBomRecord, sanitizedNewBom);
                          sanitizedNewBom = {
                            ...editingBomRecord,
                            ...sanitizedNewBom,
                            id: existingCode,
                            bomCode: existingCode,
                            code: existingCode,
                            createdAt: editingBomRecord.createdAt || sanitizedNewBom.createdAt,
                            sourcePiNo: editingBomRecord.sourcePiNo || sanitizedNewBom.sourcePiNo || null,
                            salesPerson: editingBomRecord.salesPerson || sanitizedNewBom.salesPerson,
                            salesPersonCode: editingBomRecord.salesPersonCode || sanitizedNewBom.salesPersonCode,
                            createdBy: editingBomRecord.createdBy || sanitizedNewBom.createdBy,
                            createdById: editingBomRecord.createdById || sanitizedNewBom.createdById,
                            status: (editingBomRecord.status === 'Draft' && !isDraft) ? 'Pending Confirmation' : (editingBomRecord.status || sanitizedNewBom.status),
                            salesConfirmed: Boolean(editingBomRecord.salesConfirmed),
                            salesConfirmedAt: editingBomRecord.salesConfirmedAt || null,
                            accountsVerification: editingBomRecord.accountsVerification || sanitizedNewBom.accountsVerification,
                            invoiceConfirmed: Boolean(editingBomRecord.invoiceConfirmed),
                            invoiceDeducted: Boolean(editingBomRecord.invoiceDeducted),
                            isEdited: true,
                            editCount: (Number(editingBomRecord.editCount) || 0) + 1,
                            lastEditedAt: nowIso,
                            lastEditedBy: loggedInOperatorName,
                            lastEditedByRole: userRole || 'Sales',
                            editHistory: [
                              ...(Array.isArray(editingBomRecord.editHistory) ? editingBomRecord.editHistory : []),
                              {
                                editedAt: nowIso,
                                editedBy: loggedInOperatorName,
                                editedByRole: userRole || 'Sales',
                                changes: diffList
                              }
                            ]
                          };
                        }

                        // Stage: Assigning sequential code
                        setBomSubmitStage('assigning');

                        // 1. Synchronize with server backend & assign atomic sequential BOM code (or update existing when editing)
                        let finalAssignedCode = isEditingExisting ? (editingBomRecord.bomCode || editingBomRecord.code || editingBomRecord.id) : null;
                        let sResOk = false;
                        const postPayload = JSON.stringify({ bom: sanitizedNewBom, isNew: !isEditingExisting, isUpdate: isEditingExisting });
                        const endpoints = ['/api/boms'];
                        for (const url of endpoints) {
                          for (let attempt = 0; attempt < 3 && !sResOk; attempt++) {
                            try {
                              const controller = new AbortController();
                              const timeoutId = setTimeout(() => controller.abort(), 20000);
                              const sRes = await fetch(url, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: postPayload,
                                signal: controller.signal
                              }).catch(() => null);
                              clearTimeout(timeoutId);
                              if (sRes && sRes.ok) {
                                const sData = await sRes.json().catch(() => null);
                                if (sData && (sData.bomCode || sData.bom?.bomCode || isEditingExisting) && sData.success !== false) {
                                  sResOk = true;
                                  if (!isEditingExisting) {
                                    finalAssignedCode = sData.bomCode || sData.bom?.bomCode;
                                  }
                                  break;
                                }
                              }
                            } catch (err) {
                              console.warn(`Sync attempt ${attempt + 1} to ${url} failed:`, err);
                            }
                            if (attempt < 2) {
                              await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
                            }
                          }
                        }

                        // 2. Offline / Direct fallback to atomic Supabase Sequence
                        const isValidBomCode = (c) => Boolean(c && (c.startsWith('VRMS/BOM/') || c.startsWith('VRM-BOM-') || /^BOM-\d+$/i.test(c)));
                        if (!isEditingExisting && (!finalAssignedCode || !isValidBomCode(finalAssignedCode))) {
                          try {
                            const reservedCode = await getAndReserveNextBomCode(true);
                            if (reservedCode && isValidBomCode(reservedCode)) {
                              finalAssignedCode = reservedCode;
                            }
                          } catch (err) {
                            console.error('Error reserving atomic BOM code from Supabase:', err);
                            const fallbackSeq = getNextSequence('BOM', bomStore || []);
                            finalAssignedCode = (fallbackSeq && typeof fallbackSeq === 'object') ? fallbackSeq.code : fallbackSeq;
                          }
                        }

                        setBomSubmitAssignedCode(finalAssignedCode);
                        sanitizedNewBom.bomCode = finalAssignedCode;
                        sanitizedNewBom.code = finalAssignedCode;
                        sanitizedNewBom.id = finalAssignedCode;

                        // Upload attached delivery proof files to private Supabase Storage under the final BOM code
                        if (deliveryDocs.length > 0 && !sameAsBilling) {
                          try {
                            const uploadedDeliveryDocs = await Promise.all(deliveryDocs.map(async (doc, idx) => {
                              if (doc && doc._rawFile) {
                                try {
                                  const meta = await uploadBomDocumentFile({
                                    file: doc._rawFile,
                                    bomCode: finalAssignedCode,
                                    category: `delivery-proof-${idx + 1}`
                                  });
                                  return meta;
                                } catch (upErr) {
                                  console.warn('Storage upload fallback, keeping local delivery proof:', upErr);
                                }
                              }
                              return {
                                name: doc.name || `Delivery_Address_Proof_${idx + 1}`,
                                size: doc.size || 'Attached',
                                mimeType: doc.mimeType || 'image/jpeg',
                                uploadedAt: new Date().toISOString(),
                                dataUrl: doc.dataUrl || null,
                                previewUrl: doc.previewUrl || null
                              };
                            }));
                            sanitizedNewBom.deliveryAddressProofDocs = uploadedDeliveryDocs;
                            sanitizedNewBom.deliveryAddressProofDoc = uploadedDeliveryDocs[0] || null;
                          } catch (err) {
                            console.warn('Error uploading delivery proof docs:', err);
                          }
                        }

                        // Upload attached payment proof files to private Supabase Storage
                        if (paymentDocs.length > 0) {
                          try {
                            const uploadedPaymentDocs = await Promise.all(paymentDocs.map(async (doc, idx) => {
                              if (doc && doc._rawFile) {
                                try {
                                  const meta = await uploadBomDocumentFile({
                                    file: doc._rawFile,
                                    bomCode: finalAssignedCode,
                                    category: `payment-proof-${idx + 1}`
                                  });
                                  return meta;
                                } catch (upErr) {
                                  console.warn('Storage upload fallback, keeping local payment proof:', upErr);
                                }
                              }
                              return {
                                name: doc.name || `Payment_Slip_${idx + 1}`,
                                size: doc.size || 'Attached',
                                mimeType: doc.mimeType || 'image/jpeg',
                                uploadedAt: new Date().toISOString(),
                                dataUrl: doc.dataUrl || null,
                                previewUrl: doc.previewUrl || null
                              };
                            }));
                            sanitizedNewBom.paymentProofDocs = uploadedPaymentDocs;
                            sanitizedNewBom.paymentProofDoc = uploadedPaymentDocs[0] || null;
                            if (sanitizedNewBom.payments) {
                              sanitizedNewBom.payments.proofDocObjs = uploadedPaymentDocs;
                              sanitizedNewBom.payments.proofDocObj = uploadedPaymentDocs[0] || null;
                              sanitizedNewBom.payments.proofDocs = uploadedPaymentDocs.map(d => d.originalName || d.name);
                              sanitizedNewBom.payments.proofDoc = uploadedPaymentDocs[0]?.originalName || uploadedPaymentDocs[0]?.name || null;
                            }
                          } catch (err) {
                            console.warn('Error uploading payment proof docs:', err);
                          }
                        }

                        // Stage: Stock reservation is performed upon Sales Reconfirmation
                        setBomSubmitStage('reserving');
                        sanitizedNewBom.stockBlocked = false;
                        sanitizedNewBom.stockDeducted = false;

                        // Stage: Saving to cloud & local storage
                        setBomSubmitStage('saving');
                        const current = Array.isArray(bomStore) ? bomStore : [];
                        const filtered = current.filter(item => {
                          if (!item) return false;
                          if (item.bomCode === finalAssignedCode || item.code === finalAssignedCode || item.id === finalAssignedCode) return false;
                          if (sanitizedNewBom.sourcePiNo && String(item.sourcePiNo || item.piNo || '').trim().toLowerCase() === String(sanitizedNewBom.sourcePiNo).trim().toLowerCase()) {
                            return false;
                          }
                          return true;
                        });
                        const combined = [sanitizedNewBom, ...filtered];
                        const { list: updatedList } = resolveBomCollisions(combined, 662);
                        setBomStore(updatedList);

                        // Safe browser localStorage backup per Rule 5 (local UI convenience only)
                        safeSaveBomStoreToLocal(updatedList);

                        // Atomically push created BOM order to Supabase and Node server API
                        saveCloudBomRow(sanitizedNewBom);
                        const hasAttachedBomDocs = (deliveryDocs.length > 0 && !sameAsBilling) || paymentDocs.length > 0;
                        if (!sResOk || hasAttachedBomDocs) {
                          try {
                            const sesId = typeof window !== 'undefined' && window.localStorage
                              ? (localStorage.getItem('controlroom_device_session_id') || localStorage.getItem('businz_device_session_id'))
                              : null;
                            const syncBody = JSON.stringify({ bom: stripDataUrlsFromRecord(sanitizedNewBom), isUpdate: Boolean(sResOk) });
                            for (let attempt = 0; attempt < 3; attempt++) {
                              const syncRes = await fetch('/api/boms', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  ...(sesId ? { 'x-session-id': sesId } : {})
                                },
                                body: syncBody
                              }).catch(() => null);
                              if (syncRes && syncRes.ok) break;
                              if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
                            }
                          } catch (err) {
                            console.error('Error syncing created BOM to server:', err);
                          }
                        }

                        // If converted from a Proforma Invoice, update the PI stores so PI knows its BOM number
                        if (!isDraft && sanitizedNewBom.sourcePiNo) {
                          try {
                            const piNum = String(sanitizedNewBom.sourcePiNo).trim();
                            const updatePiRecords = (storeKey) => {
                              try {
                                const raw = localStorage.getItem(storeKey);
                                if (raw) {
                                  const list = JSON.parse(raw);
                                  if (Array.isArray(list)) {
                                    const updated = list.map(item => {
                                      const iNum = String(item.piNo || item.estimate_number || item.id || '').trim();
                                      if (iNum.toLowerCase() === piNum.toLowerCase()) {
                                        return {
                                          ...item,
                                          status: 'Converted to BOM',
                                          statusType: 'converted',
                                          convertedToBom: true,
                                          convertedBomNo: finalAssignedCode,
                                          convertedBomCode: finalAssignedCode,
                                          convertedAt: new Date().toISOString()
                                        };
                                      }
                                      return item;
                                    });
                                    localStorage.setItem(storeKey, JSON.stringify(updated));
                                    const piCtrl = new AbortController();
                                    const piTId = setTimeout(() => piCtrl.abort(), 1200);
                                    fetch(`/api/store/${storeKey.replace('controlroom_', '')}`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify(updated),
                                      signal: piCtrl.signal
                                    }).catch(() => {}).finally(() => clearTimeout(piTId));
                                    saveCloudStore(storeKey.replace('controlroom_', ''), updated);
                                  }
                                }
                              } catch (_) {}
                            };
                            updatePiRecords('controlroom_sales_pi_store');
                            updatePiRecords('controlroom_procurement_pi_store');
                            window.dispatchEvent(new CustomEvent('controlroom_pi_store_updated', { 
                              detail: { piNo: piNum, bomCode: finalAssignedCode } 
                            }));
                          } catch (e) {
                            console.error('Error updating PI records with BOM code:', e);
                          }
                        }

                        try {
                          window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: { bom: sanitizedNewBom } }));
                          window.dispatchEvent(new Event('controlroom_storage_update'));
                        } catch (e) { }

                        // Stage: Completed!
                        setBomSubmitStage('completed');
                        await new Promise(res => setTimeout(res, 650));

                        setShowBOMForm(false);
                        setBomConfirmModal(null);
                        setCurrentPage(1);

                        // 3. Notification to sales upon initial BOM creation (sent to dispatch only upon reconfirmation)
                        if (!isDraft) {
                          try {
                            if (typeof notifyBomCreatedToSales === 'function') {
                              notifyBomCreatedToSales({
                                bomCode: finalAssignedCode,
                                customerName: sanitizedNewBom.companyName || sanitizedNewBom.customerName,
                                salesPerson: sanitizedNewBom.salesPerson,
                                salesPersonCode: sanitizedNewBom.salesPersonCode || sanitizedNewBom.createdById
                              });
                            }
                          } catch (nErr) {
                            console.warn('Notification failed non-fatally:', nErr);
                          }
                          alert(sanitizedNewBom.sourcePiNo
                            ? `✅ BOM (${finalAssignedCode}) saved from Proforma Invoice (${sanitizedNewBom.sourcePiNo}) as Pending Confirmation!\n\nPlease select this order in the table and click 'Reconfirm BOM' in the floating bottom action bar to verify materials & quantities before sending to Dispatch.`
                            : `✅ BOM (${finalAssignedCode}) saved as Pending Confirmation!\n\nPlease select this order in the table and click 'Reconfirm BOM' in the floating bottom action bar to verify materials & quantities before sending to Dispatch.`);
                        } else {
                          alert(sanitizedNewBom.sourcePiNo
                            ? `📝 BOM (${finalAssignedCode}) saved as Draft from Proforma Invoice (${sanitizedNewBom.sourcePiNo}).`
                            : `📝 BOM (${finalAssignedCode}) saved as Draft.`);
                        }

                        setNewBomPaymentProofDoc(null);
                        setNewBomDeliveryProofDoc(null);
                        setNewBomRemarks('');
                        setNewBomTransportMode('');
                        if (setEditingBomRecord) setEditingBomRecord(null);
                        if (setOriginalPiSnapshot) setOriginalPiSnapshot(null);
                        setNewBomTransporterName('');
                        setNewBomDestination('');
                        setNewBomVehicleNo('');
                        setNewBomTransportScope('');
                        setNewBomLrNo('');
                        setNewBomCreditDays(7);
                        setNewBomPaymentType('100% Paid');
                        setNewBomProductName('');
                        setBomMaterialsList([]);
                        setSelectedPreset('');
                        setPresetKitPrice('');
                        setPresetSetCount(1);
                        setPresetGroups({});
                        setNewBomCode('');
                        setNewBomSourcePiNo('');
                        setNewBomCompanyName('');
                        setNewBomContactPerson('');
                        setNewBomPhone('');
                        setNewBomEmail('');
                        setNewBomGstNo('');
                        setNewBomBillingStreet('');
                        setNewBomBillingCity('');
                        setNewBomBillingState('');
                        setNewBomBillingPincode('');
                        setNewBomDeliveryStreet('');
                        setNewBomDeliveryCity('');
                        setNewBomDeliveryState('');
                        setNewBomDeliveryPincode('');
                        setSameAsBilling(true);
                      } catch (err) {
                        console.error('BOM creation error:', err);
                        alert('Error creating BOM: ' + (err.message || 'Please check your connection and try again.'));
                      } finally {
                        isSubmittingBomRef.current = false;
                        setIsSubmittingBom(false);
                        setBomSubmitStage('');
                        setBomSubmitAssignedCode('');
                      }
                    }
                  }}
                  style={{
                    border: 'none',
                    backgroundColor: bomConfirmModal === 'cancel' ? '#DC2626' : bomConfirmModal === 'draft' ? '#0E7490' : '#166534',
                    color: 'white',
                    padding: '9px 20px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: isSubmittingBom ? 'not-allowed' : 'pointer',
                    opacity: isSubmittingBom ? 0.7 : 1,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {isSubmittingBom ? (
                    <>
                      <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>{bomConfirmModal === 'draft' ? 'Saving Draft...' : 'Creating BOM Order...'}</span>
                    </>
                  ) : (
                    <>
                      {bomConfirmModal === 'cancel' && 'Yes, Go Back'}
                      {bomConfirmModal === 'draft' && 'Save Draft'}
                      {bomConfirmModal === 'create' && 'Yes, Complete Order'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}
