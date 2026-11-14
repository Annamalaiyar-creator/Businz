import React from 'react';
import {
  Check, Trash2, Eye, FileText, AlertCircle, AlertTriangle, X, CheckCircle, Clock, UploadCloud, Truck, ShoppingCart, Upload, Layers, FileCheck, Image, Lock, Save, Boxes, ArrowLeft
} from 'lucide-react';
import { isFixedQuantityPreset } from '../../../vrmHdgProposalPresets';
import { VRM_PRODUCTS, isRailPreset, isKwPreset, calculateTotalDispatchQty } from '../../../utils/vrmProductsData';
import { cleanNum } from '../../../utils/otherViewsShared';
import SearchablePresetSelector from '../../SearchablePresetSelector';
import TypeableProductSelect from '../../TypeableProductSelect';
import { searchCustomers } from '../../../services/customerService';
import { is5PctSolarProduct } from '../../../utils/hsnCodeService';
import { PRESET_THEMES, getPresetTheme } from '../../../utils/presetThemes';
import BomCreateSubmitModal from './BomCreateSubmitModal';

export default function BomCreateFormSection({ ctx }) {
  const {
    renderDocPreviewModal,
    renderValidationErrorModal,
    renderBomSubmittingOverlay,
    customerList,
    setCustomerList,
    activePresetsMap,
    itemsList,
    bomCustSearchTimerRef,
    setPreviewDocModal,
    newBomDeliveryDate,
    setNewBomDeliveryDate,
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
    setNewBomDocType,
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
    setNewBomPartialAmount,
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
    formErrors,
    setFormErrors,
    setValidationErrorModal,
    deliveryDocs,
    paymentDocs,
    handleUploadDeliveryProofFiles,
    handleRemoveDeliveryDoc,
    handleUploadPaymentProofFiles,
    handleRemovePaymentDoc,
    isSubmittingBom,
    newBomSourcePiNo,
    validateBomForm,
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
    selectedBomItemIndexes,
    setSelectedBomItemIndexes,
    showClearConfirmModal,
    setShowClearConfirmModal,
    setBomConfirmModal,
    bomMaterialsList,
    setBomMaterialsList,
    totals,
    editingBomRecord
  } = ctx;

    const handleAddMaterialRow = () => {
      setBomMaterialsList(prev => [...(prev || []), { name: '', category: '', uom: 'NOS', unit: 'NOS', qty: '1', wastage: '0%', rate: '', gstRate: '18%' }]);
    };

    const handleAddPresetToOrder = (presetId, targetPreset, setsCount) => {
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

      setPresetGroups(prev => ({
        ...prev,
        [groupId]: {
          groupId,
          presetId,
          presetName,
          setCount: multiplier,
          sets: multiplier,
          unit: pUnit,
          unitType: pUnit,
          kitPrice: defaultPrice,
          gstRate: initialGstRate
        }
      }));

      const isFixedKit = isFixedQuantityPreset(presetId, targetPreset.label || presetName);
      const newItems = targetPreset.items.map(it => {
        const rawQ = it.qty !== undefined && it.qty !== null ? String(it.qty).trim() : '';
        const hasQty = rawQ !== '' && rawQ !== '0' && !isNaN(parseFloat(rawQ));
        const baseQ = hasQty ? parseFloat(rawQ) : '';
        const matchedCatalog = (itemsList || []).find(ci => ci.name && ci.name.toLowerCase().trim() === String(it.name || '').toLowerCase().trim()) || (VRM_PRODUCTS || []).find(vp => vp.name && vp.name.toLowerCase().trim() === String(it.name || '').toLowerCase().trim());
        const resolvedCode = it.code || (matchedCatalog ? matchedCatalog.code : '');
        return {
          ...it,
          code: resolvedCode,
          presetGroupId: groupId,
          presetName,
          baseQty: baseQ,
          qty: hasQty ? String(baseQ) : '',
          rate: '0',
          gstRate: isDcrBosKit ? '5%' : (it.gstRate || initialGstRate),
          isPresetItem: true
        };
      });

      setBomMaterialsList(prev => [...(prev || []), ...newItems]);
      setSelectedPreset('');
      setPresetSetCount(1);
    };

    const handleRemovePresetGroup = (groupId) => {
      setBomMaterialsList(prev => (prev || []).filter(item => (item.presetGroupId || 'legacy_default') !== groupId));
      setPresetGroups(prev => {
        const updated = { ...prev };
        delete updated[groupId];
        return updated;
      });
    };

    const handleRemoveMaterialRow = (idx) => {
      const itemToRemove = bomMaterialsList[idx];
      setBomMaterialsList(prev => {
        const updated = (prev || []).filter((_, i) => i !== idx);
        if (itemToRemove && itemToRemove.presetGroupId) {
          const remainingInGroup = updated.filter(it => it.presetGroupId === itemToRemove.presetGroupId);
          if (remainingInGroup.length === 0) {
            setPresetGroups(pgPrev => {
              const c = { ...pgPrev };
              delete c[itemToRemove.presetGroupId];
              return c;
            });
          }
        }
        return updated;
      });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', fontFamily: "'DM Sans', sans-serif", backgroundColor: '#F8FAFC', padding: '24px', borderRadius: '16px', boxSizing: 'border-box' }}>
        {/* Top Page Title Bar with Action Buttons */}
        <div style={{
          background: 'linear-gradient(135deg, #075985 0%, #0E7490 50%, #0891B2 100%)',
          borderRadius: '18px',
          padding: '24px 28px',
          color: '#FFFFFF',
          boxShadow: '0 10px 25px -5px rgba(14, 116, 144, 0.4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart style={{ width: '24px', height: '24px', color: '#FFFFFF' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#FFFFFF', margin: 0, letterSpacing: '-0.3px' }}>
                  Create Sales Bill of Materials (BOM)
                </h1>
                {newBomSourcePiNo && (
                  <span style={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255,255,255,0.4)',
                    padding: '3px 12px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: '800',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <FileText size={12} /> Converted from PI: {newBomSourcePiNo}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '13px', color: '#CFFAFE', margin: '4px 0 0 0' }}>
                {newBomSourcePiNo
                  ? `Imported from Proforma Invoice (${newBomSourcePiNo}). Verify order details & forward to Dispatch.`
                  : 'Configure customer order, specify delivery destination, upload document proofs, & compile BOM preset items'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              disabled={isSubmittingBom}
              onClick={() => setBomConfirmModal('cancel')}
              style={{ border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', color: '#FFFFFF', cursor: isSubmittingBom ? 'not-allowed' : 'pointer', opacity: isSubmittingBom ? 0.6 : 1, backdropFilter: 'blur(4px)' }}
            >
              ← Back
            </button>
            <button
              disabled={isSubmittingBom}
              onClick={() => {
                if (isSubmittingBom) return;
                const validation = validateBomForm(false);
                if (!validation.isValid) {
                  const firstTarget = validation.missingList[0]?.targetId;
                  if (firstTarget && typeof document !== 'undefined') {
                    const el = document.getElementById(firstTarget);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                  setValidationErrorModal({
                    fields: validation.missingList.map(m => typeof m === 'object' ? m.field : m),
                    firstTargetId: firstTarget
                  });
                  return;
                }
                setBomConfirmModal('create');
              }}
              style={{ border: 'none', background: '#10B981', color: 'white', padding: '10px 24px', borderRadius: '10px', fontSize: '13px', fontWeight: '900', cursor: isSubmittingBom ? 'not-allowed' : 'pointer', opacity: isSubmittingBom ? 0.6 : 1, boxShadow: '0 4px 14px rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <CheckCircle style={{ width: '16px', height: '16px' }} />
              Complete →
            </button>
          </div>
        </div>

        {/* SECTION 1: ORDER INFORMATION */}
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
              <label htmlFor="bom-orders-order-date" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Order Date</label>
              <input id="bom-orders-order-date" name="orderDate" aria-label="Order Date"
                type="date"
                value={new Date().toISOString().split('T')[0]}
                disabled
                readOnly
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#64748B', backgroundColor: '#F1F5F9', cursor: 'not-allowed', boxSizing: 'border-box', outline: 'none' }}
               />
            </div>
            <div>
              <label htmlFor="field-newBomDeliveryDate" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Delivery Date <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input name="deliveryDate" aria-label="Delivery Date"
                id="field-newBomDeliveryDate"
                type="date"
                min={new Date().toISOString().split('T')[0]}
                placeholder="Select date"
                value={newBomDeliveryDate}
                onChange={(e) => {
                  setNewBomDeliveryDate(e.target.value);
                  setFormErrors(prev => ({ ...prev, deliveryDate: null }));
                }}
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '10px',
                  border: formErrors.deliveryDate ? '2px solid #EF4444' : '1px solid #E2E8F0',
                  backgroundColor: formErrors.deliveryDate ? '#FEF2F2' : 'white',
                  boxShadow: formErrors.deliveryDate ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'none',
                  padding: '0 14px',
                  fontSize: '13px',
                  color: '#0F172A',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
               />
              {formErrors.deliveryDate && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#DC2626', fontSize: '11px', fontWeight: '700', marginTop: '4px' }}>
                  <AlertCircle size={12} /> {formErrors.deliveryDate}
                </span>
              )}
            </div>
            <div>
              <label htmlFor="field-newBomDocType" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Document Type <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                id="field-newBomDocType"
                name="newBomDocType"
                aria-label="Document Type"
                value={newBomDocType}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewBomDocType(val);
                  if (val === 'DC') {
                    setNewBomPaymentType('100% Paid');
                    setNewBomPaymentProofDoc(null);
                  }
                }}
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '10px',
                  border: newBomDocType === 'DC' ? '1.5px solid #F59E0B' : '1.5px solid #0E7490',
                  backgroundColor: newBomDocType === 'DC' ? '#FFFBEB' : '#F0FDFA',
                  padding: '0 12px',
                  fontSize: '13px',
                  fontWeight: '800',
                  color: newBomDocType === 'DC' ? '#92400E' : '#0E7490',
                  boxSizing: 'border-box',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="Invoice">Invoice (Official Tax Invoice)</option>
                <option value="DC">DC (Delivery Challan)</option>
              </select>
            </div>
            <div>
              <label htmlFor="bom-orders-order-number" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Order Number</label>
              <input id="bom-orders-order-number" name="orderNumber" aria-label="Order Number"
                type="text"
                value="Auto-Assigned"
                readOnly
                disabled
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CFFAFE', padding: '0 14px', fontSize: '13px', fontWeight: '700', color: '#0E7490', backgroundColor: '#F0FDFA', cursor: 'not-allowed', boxSizing: 'border-box', outline: 'none' }}
               />
            </div>
            <div>
              <label htmlFor="bom-orders-sales-person-creator" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748B', marginBottom: '6px' }}>
                Sales Person / Creator <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input id="bom-orders-sales-person-creator" name="salesPersonCreator" aria-label="Sales Person / Creator"
                type="text"
                readOnly
                disabled
                value={newBomSalesPerson || defaultSalesPersonName}
                title="Creator name is tied to the logged-in account and cannot be modified"
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  padding: '0 14px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#475569',
                  backgroundColor: '#F1F5F9',
                  cursor: 'not-allowed',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
               />
            </div>
          </div>
        </div>

        {/* SECTION 2: CUSTOMER INFORMATION & ADDRESSES */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              2
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              CUSTOMER INFORMATION
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="field-newBomProductName" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Customer Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input name="customerName" aria-label="Customer Name"
                id="field-newBomProductName"
                type="text"
                list="bom-customer-name-suggestions"
                placeholder="Type or select customer from list..."
                value={newBomProductName}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewBomProductName(val);
                  setFormErrors(prev => ({ ...prev, customerName: null }));
                  const target = (val || '').toLowerCase().trim();
                  if (!target) return;

                  // Phase B4: Debounced server search as user types
                  if (target.length >= 2) {
                    if (bomCustSearchTimerRef.current) clearTimeout(bomCustSearchTimerRef.current);
                    bomCustSearchTimerRef.current = setTimeout(async () => {
                      try {
                        const matches = await searchCustomers({ query: val, limit: 50 });
                        if (Array.isArray(matches) && matches.length > 0) {
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

                  const chosen = customerList.find(c => {
                    const code = (c.code || c.customerCode || '').toLowerCase().trim();
                    const c2 = (c.c2 || c.companyName || '').toLowerCase().trim();
                    const cName = (c.customerName || '').toLowerCase().trim();
                    const comp = (c.companyName || '').toLowerCase().trim();
                    return code === target || c2 === target || cName === target || comp === target ||
                           (code && code.startsWith(target)) || (c2 && c2.startsWith(target)) ||
                           (cName && cName.startsWith(target)) || (comp && comp.startsWith(target)) ||
                           (c2 && c2.includes(target)) || (comp && comp.includes(target));
                  });

                  if (chosen) {
                    setNewBomCompanyName(chosen.c2 || chosen.companyName || chosen.customerName || chosen.code || val);
                    if (chosen.contact || chosen.contactPerson || chosen.primaryContact?.name) {
                      setNewBomContactPerson(chosen.contact || chosen.contactPerson || chosen.primaryContact?.name);
                    }
                    if (chosen.c4 || chosen.phone || chosen.mobile || chosen.primaryContact?.phone || chosen.primaryContact?.whatsapp) {
                      setNewBomPhone(chosen.c4 || chosen.phone || chosen.mobile || chosen.primaryContact?.phone || chosen.primaryContact?.whatsapp);
                    }
                    if (chosen.c5 || chosen.email || chosen.primaryContact?.email) {
                      setNewBomEmail(chosen.c5 || chosen.email || chosen.primaryContact?.email);
                    }
                    if (chosen.gst || chosen.gstNo) {
                      setNewBomGstNo(chosen.gst || chosen.gstNo);
                    }

                    const bObj = chosen.billingAddressObj || {};
                    const bAddr = bObj.address || chosen.c6 || chosen.billingAddress || chosen.address || '';
                    const dObj = chosen.deliveryAddressObj || {};
                    const dAddr = dObj.address || chosen.c7 || chosen.deliveryAddress || chosen.dispatchAddress || '';

                    const clean = (s) => String(s || '').trim().toLowerCase();
                    const isSame = !dAddr || (
                      clean(dAddr) === clean(bAddr) &&
                      clean(dObj.city || chosen.city || '') === clean(bObj.city || chosen.city || '') &&
                      clean(dObj.state || chosen.state || '') === clean(bObj.state || chosen.state || '') &&
                      clean(dObj.pincode || chosen.pincode || '') === clean(bObj.pincode || chosen.pincode || '')
                    );

                    setSameAsBilling(isSame);
                    setNewBomDeliveryProofDoc(null);
                    if (dAddr && !isSame) {
                      setNewBomDeliveryStreet(dObj.address || chosen.c7 || chosen.deliveryAddress || chosen.dispatchAddress || '');
                      setNewBomDeliveryCity(dObj.city || chosen.dispatchCity || chosen.city || '');
                      setNewBomDeliveryState(dObj.state || chosen.dispatchState || chosen.state || '');
                      setNewBomDeliveryPincode(dObj.pincode || chosen.dispatchPincode || chosen.pincode || '');
                    } else {
                      setNewBomDeliveryStreet(bObj.address || chosen.c6 || chosen.billingAddress || chosen.address || '');
                      setNewBomDeliveryCity(bObj.city || chosen.city || '');
                      setNewBomDeliveryState(bObj.state || chosen.state || '');
                      setNewBomDeliveryPincode(bObj.pincode || chosen.pincode || '');
                    }
                  }
                }}
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '10px',
                  border: formErrors.customerName ? '2px solid #EF4444' : '1px solid #E2E8F0',
                  backgroundColor: formErrors.customerName ? '#FEF2F2' : 'white',
                  boxShadow: formErrors.customerName ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'none',
                  padding: '0 14px',
                  fontSize: '13px',
                  color: '#0F172A',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
               />
              {formErrors.customerName && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#DC2626', fontSize: '11px', fontWeight: '700', marginTop: '4px' }}>
                  <AlertCircle size={12} /> {formErrors.customerName}
                </span>
              )}
              <datalist id="bom-customer-name-suggestions">
                {(customerList || []).slice(0, 60).map((c, idx) => {
                  const val = c.code || c.customerName || c.companyName;
                  const label = c.c2 || c.companyName;
                  return (
                    <option key={idx} value={val}>
                      {label && label !== val ? `${val} (${label})` : val}
                    </option>
                  );
                })}
              </datalist>
            </div>
          </div>

          <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div>
                    <label htmlFor="bom-orders-company-name" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Company Name</label>
                    <input id="bom-orders-company-name" name="companyName" aria-label="Company Name"
                      type="text"
                      placeholder="Company Name..."
                      value={newBomCompanyName}
                      onChange={(e) => setNewBomCompanyName(e.target.value)}
                      style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                     />
                  </div>
                  <div>
                    <label htmlFor="bom-orders-contact-person" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Contact Person</label>
                    <input id="bom-orders-contact-person" name="contactPerson" aria-label="Contact Person"
                      type="text"
                      placeholder="Contact Person..."
                      value={newBomContactPerson}
                      onChange={(e) => setNewBomContactPerson(e.target.value)}
                      style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                     />
                  </div>
                  <div>
                    <label htmlFor="bom-orders-gst-number" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>GST Number</label>
                    <input id="bom-orders-gst-number" name="gSTNumber" aria-label="GST Number"
                      type="text"
                      placeholder="GSTIN (e.g. 33AAAAA0000A1Z5)..."
                      value={newBomGstNo}
                      onChange={(e) => setNewBomGstNo(e.target.value.toUpperCase())}
                      style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                     />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <div>
                    <label htmlFor="bom-orders-mobile-number" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Mobile Number</label>
                    <input id="bom-orders-mobile-number" name="mobileNumber" aria-label="Mobile Number"
                      type="text"
                      placeholder="Mobile / Phone..."
                      value={newBomPhone}
                      onChange={(e) => setNewBomPhone(e.target.value)}
                      style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                     />
                  </div>
                  <div>
                    <label htmlFor="bom-orders-email" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Email</label>
                    <input id="bom-orders-email" name="email" aria-label="Email"
                      type="email"
                      placeholder="Email Address..."
                      value={newBomEmail}
                      onChange={(e) => setNewBomEmail(e.target.value)}
                      style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                     />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  {/* Billing Address Card */}
                  <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                        <FileText style={{ width: '14px', height: '14px' }} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Billing Address</h4>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>Primary address for invoices & tax records</span>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="bom-orders-address" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Address</label>
                      <input id="bom-orders-address" name="address" aria-label="Address"
                        type="text"
                        value={newBomBillingStreet}
                        placeholder="e.g. Plot No 42, SIDCO Industrial Estate"
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewBomBillingStreet(val);
                          if (sameAsBilling) setNewBomDeliveryStreet(val);
                        }}
                        style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                       />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <div>
                        <label htmlFor="bom-orders-city" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                        <input id="bom-orders-city" name="city" aria-label="City"
                          type="text"
                          value={newBomBillingCity}
                          placeholder="e.g. Chennai"
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewBomBillingCity(val);
                            if (sameAsBilling) setNewBomDeliveryCity(val);
                          }}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                         />
                      </div>
                      <div>
                        <label htmlFor="bom-orders-state" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                        <input id="bom-orders-state" name="state" aria-label="State"
                          type="text"
                          value={newBomBillingState}
                          placeholder="e.g. Tamil Nadu"
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewBomBillingState(val);
                            if (sameAsBilling) setNewBomDeliveryState(val);
                          }}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                         />
                      </div>
                      <div>
                        <label htmlFor="bom-orders-pincode" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pincode</label>
                        <input id="bom-orders-pincode" name="pincode" aria-label="Pincode"
                          type="text"
                          value={newBomBillingPincode}
                          placeholder="e.g. 600058"
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewBomBillingPincode(val);
                            if (sameAsBilling) setNewBomDeliveryPincode(val);
                          }}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                         />
                      </div>
                    </div>
                  </div>

                  {/* Delivery Address Card */}
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
                          checked={sameAsBilling}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSameAsBilling(checked);
                            if (checked) {
                              setNewBomDeliveryStreet(newBomBillingStreet);
                              setNewBomDeliveryCity(newBomBillingCity);
                              setNewBomDeliveryState(newBomBillingState);
                              setNewBomDeliveryPincode(newBomBillingPincode);
                              setNewBomDeliveryProofDoc(null);
                            } else {
                              setNewBomDeliveryStreet('');
                              setNewBomDeliveryCity('');
                              setNewBomDeliveryState('');
                              setNewBomDeliveryPincode('');
                            }
                          }}
                          style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                         />
                        Same as Billing
                      </label>
                    </div>

                    <div>
                      <label htmlFor="field-newBomDeliveryStreet" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Address</label>
                      <input name="address" aria-label="Address"
                        id="field-newBomDeliveryStreet"
                        type="text"
                        placeholder="e.g. Plot No 42, SIDCO Industrial Estate, Ambattur"
                        value={sameAsBilling ? newBomBillingStreet : newBomDeliveryStreet}
                        disabled={sameAsBilling}
                        onChange={(e) => {
                          setNewBomDeliveryStreet(e.target.value);
                          setFormErrors(prev => ({ ...prev, deliveryAddress: null }));
                        }}
                        style={{
                          width: '100%',
                          height: '38px',
                          borderRadius: '8px',
                          border: formErrors.deliveryAddress ? '2px solid #EF4444' : '1px solid #CBD5E1',
                          padding: '0 12px',
                          fontSize: '12px',
                          color: sameAsBilling ? '#64748B' : '#0F172A',
                          backgroundColor: formErrors.deliveryAddress ? '#FEF2F2' : (sameAsBilling ? '#F1F5F9' : '#FFFFFF'),
                          boxShadow: formErrors.deliveryAddress ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'none',
                          boxSizing: 'border-box',
                          outline: 'none',
                          cursor: sameAsBilling ? 'not-allowed' : 'text'
                        }}
                       />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <div>
                        <label htmlFor="bom-orders-city" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                        <input id="bom-orders-city" name="city" aria-label="City"
                          type="text"
                          placeholder="e.g. Chennai"
                          value={sameAsBilling ? newBomBillingCity : newBomDeliveryCity}
                          disabled={sameAsBilling}
                          onChange={(e) => {
                            setNewBomDeliveryCity(e.target.value);
                            setFormErrors(prev => ({ ...prev, deliveryAddress: null }));
                          }}
                          style={{
                            width: '100%',
                            height: '38px',
                            borderRadius: '8px',
                            border: formErrors.deliveryAddress && !newBomDeliveryCity ? '2px solid #EF4444' : '1px solid #CBD5E1',
                            padding: '0 12px',
                            fontSize: '12px',
                            color: sameAsBilling ? '#64748B' : '#0F172A',
                            backgroundColor: formErrors.deliveryAddress && !newBomDeliveryCity ? '#FEF2F2' : (sameAsBilling ? '#F1F5F9' : '#FFFFFF'),
                            boxSizing: 'border-box',
                            outline: 'none',
                            cursor: sameAsBilling ? 'not-allowed' : 'text'
                          }}
                         />
                      </div>
                      <div>
                        <label htmlFor="bom-orders-state" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                        <input id="bom-orders-state" name="state" aria-label="State"
                          type="text"
                          placeholder="e.g. Tamil Nadu"
                          value={sameAsBilling ? newBomBillingState : newBomDeliveryState}
                          disabled={sameAsBilling}
                          onChange={(e) => setNewBomDeliveryState(e.target.value)}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none', cursor: sameAsBilling ? 'not-allowed' : 'text' }}
                         />
                      </div>
                      <div>
                        <label htmlFor="bom-orders-pincode" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pincode</label>
                        <input id="bom-orders-pincode" name="pincode" aria-label="Pincode"
                          type="text"
                          placeholder="e.g. 600058"
                          value={sameAsBilling ? newBomBillingPincode : newBomDeliveryPincode}
                          disabled={sameAsBilling}
                          onChange={(e) => setNewBomDeliveryPincode(e.target.value)}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none', cursor: sameAsBilling ? 'not-allowed' : 'text' }}
                         />
                      </div>
                    </div>
                    {formErrors.deliveryAddress && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#DC2626', fontSize: '11px', fontWeight: '700', marginTop: '-4px' }}>
                        <AlertCircle size={12} /> {formErrors.deliveryAddress}
                      </span>
                    )}
                    {(() => {
                      const effectiveDeliveryStreet = sameAsBilling ? newBomBillingStreet : newBomDeliveryStreet;
                      const effectiveDeliveryCity = sameAsBilling ? newBomBillingCity : newBomDeliveryCity;
                      const effectiveDeliveryState = sameAsBilling ? newBomBillingState : newBomDeliveryState;
                      const effectiveDeliveryPincode = sameAsBilling ? newBomBillingPincode : newBomDeliveryPincode;

                      const clean = (str) => String(str || '').trim().toLowerCase();
                      const hasEnteredDeliveryAddress = Boolean(clean(effectiveDeliveryStreet) || clean(effectiveDeliveryCity) || clean(effectiveDeliveryPincode));

                      // Check if delivery matches billing
                      const isMatchingBilling = Boolean(sameAsBilling) || (
                        hasEnteredDeliveryAddress &&
                        clean(effectiveDeliveryStreet) === clean(newBomBillingStreet) &&
                        clean(effectiveDeliveryCity) === clean(newBomBillingCity) &&
                        clean(effectiveDeliveryState) === clean(newBomBillingState) &&
                        clean(effectiveDeliveryPincode) === clean(newBomBillingPincode)
                      );

                      // ONLY render reference notice if addresses do NOT match AND user has specified a different delivery destination
                      if (isMatchingBilling || !hasEnteredDeliveryAddress) {
                        return null;
                      }

                      return (
                        <div style={{
                          marginTop: '6px',
                          padding: '12px 16px',
                          backgroundColor: '#FEF2F2',
                          border: '1px solid #FECACA',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          flexWrap: 'wrap'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertCircle style={{ width: '16px', height: '16px', color: '#DC2626', flexShrink: 0 }} />
                            <span style={{ fontSize: '12px', color: '#991B1B', fontWeight: '600' }}>
                              Alternate Delivery Address specified. Address proof can be attached (optional) in the <strong>Document Attachments</strong> section at the bottom of this form.
                            </span>
                          </div>
                          {deliveryDocs.length > 0 ? (
                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534', backgroundColor: '#DCFCE7', padding: '3px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                              ✓ {deliveryDocs.length} Image{deliveryDocs.length > 1 ? 's' : ''} Attached Below
                            </span>
                          ) : (
                            <a
                              href="#field-bom-attachments-section"
                              style={{ textDecoration: 'none', fontSize: '11px', fontWeight: '800', color: '#B45309', backgroundColor: '#FEF3C7', padding: '4px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}
                            >
                              📷 Upload in Section 6 ↓
                            </a>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </>
        </div>

        {/* SECTION 3: ORDER ITEMS & BILL OF MATERIALS */}
        <div id="field-bomMaterialsList" style={{ backgroundColor: 'white', borderRadius: '16px', border: formErrors.items ? '2px solid #EF4444' : '1px solid #E2E8F0', boxShadow: formErrors.items ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'none', display: 'flex', flexDirection: 'column' }}>
          {formErrors.items && (
            <div style={{ backgroundColor: '#FEF2F2', borderBottom: '1px solid #FECACA', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', fontSize: '12px', fontWeight: '700' }}>
              <AlertCircle size={16} />
              <span>{formErrors.items}</span>
            </div>
          )}
          {/* Section 3 Header — Clean Single Row */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px', gap: '20px', flexWrap: 'wrap', borderBottom: '1px solid #F1F5F9' }}>
            {/* Left: Badge + Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: 'auto' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>3</div>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ORDER ITEMS & BILL OF MATERIALS</span>
            </div>

            {newBomSourcePiNo && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', padding: '0 14px', borderRadius: '20px', height: '38px', color: '#0E7490', fontSize: '12px', fontWeight: '700' }}>
                <FileText style={{ width: '14px', height: '14px', color: '#0E7490' }} />
                <span>Source PI: {newBomSourcePiNo}</span>
              </div>
            )}

            {!newBomSourcePiNo && (
              <>
                {/* Preset Pill */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', backgroundColor: '#ECFEFF', padding: '0 16px', borderRadius: '20px', height: '40px', border: '1px solid #CFFAFE' }}>
                  <Layers style={{ width: '15px', height: '15px', color: '#0E7490' }} />
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0E7490' }}>Preset:</span>
                </div>

                {/* Searchable Preset Selector */}
                <SearchablePresetSelector
                  value={selectedPreset}
                  activePresetsMap={activePresetsMap}
                  accentColor="#0E7490"
                  width="380px"
                  placeholder="Pick a Preset to add..."
                  style={{ height: '40px' }}
                  onChange={(val, targetPreset) => {
                    if (val && targetPreset && targetPreset.items) {
                      handleAddPresetToOrder(val, targetPreset, 1);
                    } else if (!val) {
                      setSelectedPreset('');
                    }
                  }}
                />

                {/* Clear Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedBomItemIndexes.length > 0) {
                      setBomMaterialsList(prev => prev.filter((_, idx) => !selectedBomItemIndexes.includes(idx)));
                      setSelectedBomItemIndexes([]);
                    } else {
                      if (bomMaterialsList.length > 0) setShowClearConfirmModal(true);
                    }
                  }}
                  title={selectedBomItemIndexes.length > 0 ? `Remove ${selectedBomItemIndexes.length} selected item(s)` : 'Clear all order items'}
                  style={{ border: 'none', backgroundColor: selectedBomItemIndexes.length > 0 ? '#EF4444' : '#FFE4E6', color: selectedBomItemIndexes.length > 0 ? 'white' : '#E11D48', width: '40px', height: '40px', borderRadius: '10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
                >
                  <X style={{ width: '18px', height: '18px' }} />
                </button>
              </>
            )}
          </div>

          {/* Active Preset Badges / Pills */}
          {Object.values(presetGroups).length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '12px 24px 0 24px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B' }}>Active Presets in Order:</span>
              {Object.values(presetGroups).map(grp => (
                <span
                  key={grp.groupId}
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
                  {grp.presetName} (Total Quantity: {grp.setCount || 1} Set{(grp.setCount || 1) > 1 ? 's' : ''})
                  {!newBomSourcePiNo && (
                    <button
                      type="button"
                      onClick={() => handleRemovePresetGroup(grp.groupId)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0 0 0 2px', display: 'flex', alignItems: 'center', color: '#0891B2' }}
                      title={`Remove ${grp.presetName}`}
                    >
                      <X size={13} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Section 3 Content */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {Boolean(newBomSourcePiNo) && (
            <div style={{ padding: '12px 18px', backgroundColor: '#FEF3C7', border: '1.5px solid #F59E0B', borderRadius: '10px', color: '#92400E', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Lock style={{ width: '18px', height: '18px', flexShrink: 0, color: '#D97706' }} />
              <span>Line Items & Pricing locked from Source Proforma Invoice ({newBomSourcePiNo}). Line items, quantities, and prices imported from PI cannot be modified.</span>
            </div>
          )}

          {/* Clear confirm modal */}
          {showClearConfirmModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle style={{ width: '20px', height: '20px' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Clear All Order Items?</h3>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>Are you sure you want to delete all items from this BOM list?</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                  <button onClick={() => setShowClearConfirmModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => { setBomMaterialsList([]); setSelectedPreset(''); setPresetGroups({}); setPresetKitPrice(''); setPresetSetCount(1); setSelectedBomItemIndexes([]); setShowClearConfirmModal(false); }} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#DC2626', color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Clear All Items</button>
                </div>
              </div>
            </div>
          )}

          {/* Clean Modern Items Table */}
          <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: '#475569', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 14px', width: '30px', textAlign: 'center' }}>
                    {newBomSourcePiNo ? (
                      <span style={{ color: '#64748B', fontWeight: '700' }}>#</span>
                    ) : (
                      <input id="bom-orders-checkbox" name={`checkbox_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Checkbox"
                        type="checkbox"
                        checked={bomMaterialsList.length > 0 && selectedBomItemIndexes.length === bomMaterialsList.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBomItemIndexes(bomMaterialsList.map((_, idx) => idx));
                          } else {
                            setSelectedBomItemIndexes([]);
                          }
                        }}
                        style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                       />
                    )}
                  </th>
                  <th style={{ padding: '12px 10px', fontWeight: '700', width: '30%' }}>Product / Item <span style={{ color: '#EF4444' }}>*</span></th>
                  <th style={{ padding: '12px 10px', fontWeight: '700', width: '10%' }}>UOM</th>
                  <th style={{ padding: '12px 10px', fontWeight: '700', width: '8%', textAlign: 'center' }}>Qty / Set <span style={{ color: '#EF4444' }}>*</span></th>
                  <th style={{ padding: '12px 10px', fontWeight: '700', width: '10%', textAlign: 'center', color: '#0E7490', backgroundColor: '#ECFEFF' }}>Total Dispatch Qty</th>
                  <th style={{ padding: '12px 10px', fontWeight: '700', width: '10%' }}>Price (₹) <span style={{ color: '#EF4444' }}>*</span></th>
                  <th style={{ padding: '12px 10px', fontWeight: '700', width: '10%', textAlign: 'center' }}>GST Rate</th>
                  {bomMaterialsList.some(it => it.isPresetItem) && (
                    <th style={{ padding: '12px 10px', fontWeight: '700', width: '11%', color: '#0E7490', backgroundColor: '#ECFEFF' }}>
                      Preset Amt (₹) <span style={{ color: '#EF4444' }}>*</span>
                    </th>
                  )}
                  <th style={{ padding: '12px 10px', fontWeight: '700', width: '11%', textAlign: 'right' }}>Taxable (₹)</th>
                  <th style={{ padding: '12px 10px', fontWeight: '700', width: '11%', textAlign: 'right' }}>Total (₹)</th>
                  <th style={{ padding: '12px 10px', fontWeight: '700', width: '4%', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {bomMaterialsList.length === 0 ? (
                  <tr>
                    <td colSpan={bomMaterialsList.some(it => it.isPresetItem) ? 11 : 10} style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                      No items added yet. Pick a preset above or click <strong>Add Product / Item</strong> below.
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const hasAnyPreset = bomMaterialsList.some(it => it.isPresetItem);
                    const distinctGroupIds = [];
                    bomMaterialsList.forEach(it => {
                      if (it.isPresetItem && it.presetGroupId && !distinctGroupIds.includes(it.presetGroupId)) {
                        distinctGroupIds.push(it.presetGroupId);
                      }
                    });
                    if (distinctGroupIds.length === 0 && hasAnyPreset) {
                      distinctGroupIds.push('legacy_default');
                    }
                    const customItems = bomMaterialsList.filter(it => !it.isPresetItem);

                    return bomMaterialsList.map((item, i) => {
                    const isPiLocked = Boolean(newBomSourcePiNo);
                    const q = parseFloat(item.qty) || 0;
                    const r = parseFloat(item.rate) || 0;
                    const taxable = q * r;
                    const gstPct = parseFloat(String(item.gstRate || '18%').replace('%', '')) || 18;
                    const gstAmt = taxable * (gstPct / 100);
                    const rowTot = taxable + gstAmt;
                    const isChecked = selectedBomItemIndexes.includes(i);

                    const isPresetItem = Boolean(item.isPresetItem);
                    const groupId = item.presetGroupId || (isPresetItem ? 'legacy_default' : null);
                    const groupItems = isPresetItem ? bomMaterialsList.filter(it => (it.presetGroupId || 'legacy_default') === groupId) : [];
                    const isFirstInGroup = isPresetItem && bomMaterialsList.findIndex(it => (it.presetGroupId || 'legacy_default') === groupId) === i;
                    const groupCount = groupItems.length;
                    const groupIndex = groupId ? distinctGroupIds.indexOf(groupId) : -1;
                    const presetNumber = groupIndex >= 0 ? groupIndex + 1 : 1;
                    const theme = groupIndex >= 0 ? getPresetTheme(groupIndex) : PRESET_THEMES[0];
                    const itemIndexInGroup = isPresetItem ? groupItems.findIndex(it => it === item) + 1 : 0;
                    const isFirstCustomItem = !isPresetItem && bomMaterialsList.findIndex(it => !it.isPresetItem) === i;
                    const customIndex = !isPresetItem ? customItems.findIndex(it => it === item) + 1 : null;
                    const displaySNo = isPresetItem && distinctGroupIds.length > 0
                      ? `${presetNumber}.${itemIndexInGroup}`
                      : (customIndex !== null ? (distinctGroupIds.length > 0 ? `C.${customIndex}` : `${i + 1}`) : `${i + 1}`);

                    const currentGroup = (groupId && presetGroups[groupId]) || {
                      groupId: groupId || 'legacy_default',
                      presetName: item.presetName || selectedPreset || 'Preset Kit',
                      setCount: presetSetCount || 1,
                      unitType: presetUnit || item.unitType || item.unit || 'Sets',
                      unit: presetUnit || item.unit || item.unitType || 'Sets',
                      kitPrice: presetKitPrice || ''
                    };

                    const totalColumnsCount = hasAnyPreset ? 9 : 8;

                    return (
                      <React.Fragment key={i}>
                        {isFirstInGroup && (
                          <tr key={`bom-form-preset-hdr-${groupId}`} style={{ backgroundColor: theme.bg, borderTop: `2.5px solid ${theme.primary}`, borderBottom: `1.5px solid ${theme.border}` }}>
                            <td colSpan={totalColumnsCount} style={{ padding: '8px 14px' }}>
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
                                    {currentGroup.presetName}
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
                                    {currentGroup.setCount || 1} {currentGroup.unit || currentGroup.unitType || 'Sets'} • {groupCount} Components
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <span style={{ fontSize: '11.5px', color: '#475569' }}>
                                    Package Rate: <strong style={{ color: theme.primary }}>₹ {parseFloat(currentGroup.kitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> / {(currentGroup.unit === 'kW' || currentGroup.unitType === 'kW') ? 'kW' : 'Set'}
                                  </span>
                                  <span style={{ fontSize: '12px', fontWeight: '800', color: theme.primary, backgroundColor: '#FFFFFF', padding: '2px 10px', borderRadius: '6px', border: `1px solid ${theme.border}` }}>
                                    Kit Subtotal: ₹ {(parseFloat(currentGroup.kitPrice || 0) * (parseFloat(currentGroup.setCount || 1) || 1)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        {isFirstCustomItem && distinctGroupIds.length > 0 && (
                          <tr key="bom-form-custom-items-banner" style={{ backgroundColor: '#F8FAFC', borderTop: '2px solid #64748B', borderBottom: '1px solid #CBD5E1' }}>
                            <td colSpan={totalColumnsCount} style={{ padding: '8px 14px' }}>
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
                        <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: isChecked ? '#ECFEFF' : (isPresetItem ? theme.bg : (i % 2 === 1 ? '#FAFBFC' : 'white')) }}>
                          <td style={{
                            padding: '12px 10px',
                            textAlign: 'center',
                            borderLeft: isChecked ? '4px solid #0E7490' : (isPresetItem ? `4px solid ${theme.primary}` : '4px solid #CBD5E1')
                          }}>
                            {isPiLocked ? (
                              <span style={{ fontSize: '12px', fontWeight: '800', color: isPresetItem ? theme.primary : '#64748B' }}>
                                #{displaySNo}
                              </span>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <input id="bom-orders-checkbox" name={`checkbox_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Checkbox"
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedBomItemIndexes(prev => [...prev, i]);
                                    else setSelectedBomItemIndexes(prev => prev.filter(idx => idx !== i));
                                  }}
                                  style={{ accentColor: theme.primary, cursor: 'pointer' }}
                                 />
                                <span style={{ fontSize: '10px', fontWeight: '800', color: isPresetItem ? theme.primary : '#64748B' }}>
                                  #{displaySNo}
                                </span>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 10px' }}>
                            {isPresetItem && (
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
                                  {theme.badge} • Component {itemIndexInGroup} of {groupCount}
                                </span>
                              </div>
                            )}
                            {isPiLocked ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{item.name || '—'}</span>
                                {item.category && <span style={{ fontSize: '11px', color: '#64748B' }}>{item.category}</span>}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {/* Line 1: Product / Item Name (Typeable & Dropdown) */}
                                <TypeableProductSelect
                                  value={item.name || ''}
                                  itemsList={itemsList}
                                  placeholder="Type or select product / item..."
                                  accentColor={theme.primary}
                                  onChange={(val, matched) => {
                                    if (!matched) {
                                      setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? { ...mat, name: val } : mat));
                                      return;
                                    }
                                    const pName = matched.name;
                                    const pCat = matched.category || matched.description || item.category;
                                    const isSolar5 = is5PctSolarProduct(pName, pCat);
                                    setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? {
                                      ...mat,
                                      name: pName,
                                      code: matched.code || mat.code || '',
                                      rate: matched.price || matched.rate ? String(matched.price || matched.rate) : mat.rate,
                                      uom: matched.uom || matched.unit || mat.uom || mat.unit || 'NOS',
                                      unit: matched.uom || matched.unit || mat.uom || mat.unit || 'NOS',
                                      category: pCat,
                                      gstRate: isSolar5 ? '5%' : (mat.gstRate || '18%')
                                    } : mat));
                                  }}
                                />
                                {/* Line 2: Description */}
                                <input id={`bom-orders-description-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`description_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Description"
                                  type="text"
                                  placeholder="Description..."
                                  value={item.category || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? { ...mat, category: val } : mat));
                                  }}
                                  style={{ width: '100%', height: '28px', borderRadius: '6px', border: '1px solid #E2E8F0', padding: '0 10px', fontSize: '11px', color: '#64748B', outline: 'none', boxSizing: 'border-box', backgroundColor: '#F8FAFC' }}
                                 />
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            {isPiLocked ? (
                              <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                                {item.uom || item.unit || 'NOS'}
                              </div>
                            ) : (
                              <>
                                <input id={`bom-orders-uom-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`uOM_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="UOM"
                                  type="text"
                                  list={`uom-list-${i}`}
                                  placeholder="UOM"
                                  value={item.uom || item.unit || 'NOS'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? { ...mat, uom: val, unit: val } : mat));
                                  }}
                                  style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 8px', fontSize: '12px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF', fontWeight: '600' }}
                                 />
                                <datalist id={`uom-list-${i}`}>
                                  <option value="NOS" />
                                  <option value="SET" />
                                  <option value="KW" />
                                  <option value="KG" />
                                  <option value="MTR" />
                                  <option value="PCS" />
                                  <option value="BOX" />
                                  <option value="PKT" />
                                  <option value="PAIR" />
                                  <option value="LOT" />
                                  <option value="TON" />
                                </datalist>
                              </>
                            )}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            {isPiLocked ? (
                              <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                                {item.qty || 0}
                              </div>
                            ) : (
                              <input id={`bom-orders-0-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`0_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="0"
                                type="number"
                                value={item.qty}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? { ...mat, qty: val } : mat));
                                }}
                                style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 8px', fontSize: '13px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }}
                               />
                            )}
                          </td>
                          {/* Total Dispatch Quantity Column */}
                          <td style={{ padding: '12px 10px', textAlign: 'center', backgroundColor: isPresetItem ? '#ECFEFF' : '#F8FAFC' }}>
                            {(() => {
                              if (!isPresetItem) {
                                return (
                                  <span style={{ color: '#94A3B8', fontWeight: '700', fontSize: '13px' }} title="Standalone product; entered quantity is direct total quantity">—</span>
                                );
                              }
                              const isSub = Boolean(item.isSubPreset || item.subPresetName || item.subPresetId);
                              const effectivePresetName = isSub ? item.subPresetName : (currentGroup?.presetName || item.presetName);
                              const effectiveUnit = isSub ? (item.subUnit || item.unit || 'Sets') : (currentGroup?.unit || currentGroup?.unitType || item.unit || item.uom);
                              const nestedSub = isSub && currentGroup?.nestedSubPresets?.find(n => (n.id === item.subPresetId || n.name === item.subPresetName));
                              const effectiveSetCount = isSub ? (item.subSetCount || nestedSub?.setCount || 1) : (currentGroup?.setCount || 1);
                              const calcTotalDisp = calculateTotalDispatchQty(
                                item,
                                effectiveSetCount,
                                effectivePresetName,
                                currentGroup?.category || item.category,
                                effectiveUnit
                              );
                              const totalDisp = item.totalDispatchQty !== undefined && item.totalDispatchQty !== null && item.totalDispatchQty !== ''
                                ? item.totalDispatchQty
                                : calcTotalDisp;
                              const isKw = isKwPreset(effectivePresetName, effectiveUnit, item);
                              const isRail = isRailPreset(effectivePresetName, currentGroup?.category || item.category, item.subPresetName, item.name);
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                  <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    backgroundColor: '#FFFFFF',
                                    border: `1.5px solid ${isPresetItem ? theme.border : '#CBD5E1'}`,
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
                                        setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? { ...mat, totalDispatchQty: val } : mat));
                                      }}
                                      style={{
                                        width: '64px',
                                        height: '28px',
                                        borderRadius: '4px',
                                        border: 'none',
                                        fontSize: '13px',
                                        color: isPresetItem ? theme.primary : '#0E7490',
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
                                  {isPresetItem && (
                                    <span style={{ fontSize: '9px', color: (isKw || isRail) ? '#059669' : '#64748B', fontWeight: '600' }}>
                                      {isKw ? 'Direct kW Qty' : (isRail ? 'Direct Rails Qty' : `${parseFloat(item.qty) || 0} × ${currentGroup?.setCount || 1} Set${(currentGroup?.setCount || 1) > 1 ? 's' : ''}`)}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            {isPresetItem ? (
                              <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>—</span>
                            ) : isPiLocked ? (
                              <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                                ₹{parseFloat(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            ) : (
                              <input id={`bom-orders-0-00-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`000_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="0.00"
                                type="number"
                                value={item.rate}
                                placeholder="0.00"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? { ...mat, rate: val } : mat));
                                }}
                                style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 10px', fontSize: '13px', textAlign: 'right', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }}
                               />
                            )}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                            {isPiLocked ? (
                              <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', color: theme.primary, backgroundColor: theme.tagBg, border: `1px solid ${theme.border}` }}>
                                {item.gstRate || (currentGroup && currentGroup.gstRate) || '18%'} GST
                              </span>
                            ) : (
                              <select id={`bom-orders-gst-rate-18-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`gstRate18_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="GstRate 18"
                                value={item.gstRate || (currentGroup && currentGroup.gstRate) || '18%'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? { ...mat, gstRate: val } : mat));
                                }}
                                style={{ width: '100%', height: '38px', borderRadius: '8px', border: `1px solid ${theme.border}`, padding: '0 6px', fontSize: '12px', fontWeight: '700', color: theme.primary, backgroundColor: theme.tagBg, outline: 'none', cursor: 'pointer', textAlign: 'center' }}
                              >
                                <option value="18%">18%</option>
                                <option value="12%">12%</option>
                                <option value="5%">5%</option>
                                <option value="0%">0%</option>
                              </select>
                            )}
                          </td>
                          {hasAnyPreset && (() => {
                            if (isPresetItem) {
                              if (isFirstInGroup) {
                                return (
                                  <td
                                    rowSpan={groupCount}
                                    style={{
                                      padding: '12px 10px',
                                      verticalAlign: 'middle',
                                      backgroundColor: theme.bg,
                                      borderLeft: `2px solid ${theme.border}`,
                                      borderRight: `2px solid ${theme.border}`
                                    }}
                                  >
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                      <span
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: '800',
                                          color: theme.primary,
                                          textAlign: 'center',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          maxWidth: '120px',
                                          display: 'block'
                                        }}
                                        title={currentGroup.presetName}
                                      >
                                        {currentGroup.presetName}
                                      </span>

                                      {isPiLocked ? (
                                        <div style={{ textAlign: 'center' }}>
                                          <div style={{ fontSize: '14px', fontWeight: '800', color: theme.primary }}>
                                            ₹{parseFloat(currentGroup.kitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </div>
                                          <div style={{ fontSize: '11px', color: theme.primary, fontWeight: '600', marginTop: '2px' }}>
                                            {groupCount} items × Total Quantity: {currentGroup.setCount || 1} {currentGroup.unitType || 'Sets'}
                                          </div>
                                          <div style={{ fontSize: '10px', color: theme.primary, fontWeight: '700', marginTop: '3px' }}>
                                            GST: {currentGroup.gstRate || '18%'}
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          <div style={{ position: 'relative', width: '100%' }}>
                                            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', fontWeight: '700', color: theme.primary, pointerEvents: 'none' }}>₹</span>
                                            <input id="bom-orders-0-00" name="000" aria-label="0.00"
                                              type="number"
                                              value={currentGroup.kitPrice}
                                              placeholder="0.00"
                                              onFocus={(e) => e.target.select()}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                if (groupId) {
                                                  setPresetGroups(prev => ({
                                                    ...prev,
                                                    [groupId]: { ...(prev[groupId] || currentGroup), kitPrice: val }
                                                  }));
                                                }
                                                setPresetKitPrice(val);
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
                                              {groupCount} items ×
                                          </span>
                                          <input id="bom-orders-set-count" name="setCount" aria-label="SetCount"
                                            type="number"
                                            step="any"
                                            min="0.01"
                                            max="9999"
                                            value={currentGroup.setCount !== undefined && currentGroup.setCount !== null ? currentGroup.setCount : ''}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => {
                                              const rawVal = e.target.value;
                                              if (rawVal === '') {
                                                if (groupId) {
                                                  setPresetGroups(prev => ({
                                                    ...prev,
                                                    [groupId]: { ...(prev[groupId] || currentGroup), setCount: '' }
                                                  }));
                                                }
                                                return;
                                              }
                                              const parsed = parseFloat(rawVal);
                                              const valToSave = isNaN(parsed) ? '' : Math.max(0.01, parsed);
                                              if (groupId) {
                                                setPresetGroups(prev => ({
                                                  ...prev,
                                                  [groupId]: { ...(prev[groupId] || currentGroup), setCount: valToSave }
                                                }));
                                              }
                                            }}
                                            onBlur={() => {
                                              const current = currentGroup.setCount;
                                              const finalCount = (current === '' || isNaN(parseFloat(current)) || parseFloat(current) <= 0) ? 1 : Math.max(0.01, parseFloat(current));
                                              if (groupId) {
                                                setPresetGroups(prev => ({
                                                  ...prev,
                                                  [groupId]: { ...(prev[groupId] || currentGroup), setCount: finalCount }
                                                }));
                                              }
                                            }}
                                            style={{
                                              width: '50px', height: '26px', borderRadius: '6px',
                                              border: '1.5px solid #818CF8', fontSize: '13px',
                                              fontWeight: '800', color: '#312E81', textAlign: 'center',
                                              padding: '0 2px', outline: 'none', backgroundColor: 'white', boxSizing: 'border-box', cursor: 'text'
                                            }}
                                            title="Multiplier / Capacity for this preset"
                                           />
                                          <select
                                            value={currentGroup.unit || currentGroup.unitType || 'Sets'}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              if (groupId) {
                                                setPresetGroups(prev => ({
                                                  ...prev,
                                                  [groupId]: { ...(prev[groupId] || currentGroup), unit: val, unitType: val }
                                                }));
                                              }
                                            }}
                                            style={{
                                              height: '24px', borderRadius: '6px',
                                              border: '1px solid #C7D2FE', padding: '0 2px',
                                              fontSize: '11px', fontWeight: '800',
                                              color: '#4F46E5', backgroundColor: '#FFFFFF',
                                              cursor: 'pointer'
                                            }}
                                            title="Choose unit: Sets or kW"
                                          >
                                            <option value="Sets">Sets</option>
                                            <option value="kW">kW</option>
                                          </select>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                          <span style={{ fontSize: '10px', color: '#6366F1', fontWeight: '700' }}>GST:</span>
                                          <select id={`bom-orders-gst-rate-18-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`gstRate18_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="GstRate 18"
                                            value={currentGroup.gstRate || item.gstRate || '18%'}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              if (groupId) {
                                                setPresetGroups(prev => ({
                                                  ...prev,
                                                  [groupId]: { ...(prev[groupId] || currentGroup), gstRate: val }
                                                }));
                                              }
                                              setBomMaterialsList(prev => prev.map((mat, idx) =>
                                                ((mat.presetGroupId || 'legacy_default') === groupId || idx === i)
                                                  ? { ...mat, gstRate: val }
                                                  : mat
                                              ));
                                            }}
                                            style={{
                                              height: '24px', borderRadius: '6px',
                                              border: '1.5px solid #818CF8', padding: '0 4px',
                                              fontSize: '11px', fontWeight: '800',
                                              color: '#312E81', backgroundColor: '#FFFFFF',
                                              outline: 'none', cursor: 'pointer'
                                            }}
                                            title="Change GST Rate for this preset"
                                          >
                                            <option value="18%">18%</option>
                                            <option value="12%">12%</option>
                                            <option value="5%">5%</option>
                                            <option value="0%">0%</option>
                                          </select>
                                        </div>

                                        {groupId && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemovePresetGroup(groupId)}
                                            style={{
                                              border: 'none',
                                              backgroundColor: 'transparent',
                                              color: '#EF4444',
                                              fontSize: '10px',
                                              fontWeight: '700',
                                              cursor: 'pointer',
                                              padding: '2px 6px',
                                              borderRadius: '4px',
                                              marginTop: '2px'
                                            }}
                                            title={`Remove entire ${currentGroup.presetName} preset`}
                                          >
                                            Remove Kit
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                              );
                            } else {
                              return null;
                            }
                          } else {
                            return <td style={{ padding: '12px 10px', textAlign: 'center' }}><span style={{ fontSize: '11px', color: '#CBD5E1' }}>—</span></td>;
                          }
                        })()}
                        <td style={{ padding: '12px 10px', color: '#475569', textAlign: 'right', fontWeight: '600' }}>
                          {isPresetItem ? (
                            <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>—</span>
                          ) : (
                            `₹${taxable.toFixed(2)}`
                          )}
                        </td>
                        <td style={{ padding: '12px 10px', fontWeight: 'bold', color: '#0F172A', textAlign: 'right' }}>
                          {isPresetItem ? (
                            <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>—</span>
                          ) : (
                            `₹${rowTot.toFixed(2)}`
                          )}
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                          {isPiLocked ? (
                            <span title="Locked from Source Proforma Invoice" style={{ color: '#0E7490', backgroundColor: '#ECFEFF', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Lock style={{ width: '13px', height: '13px' }} />
                              <span>Locked</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRemoveMaterialRow(i)}
                              style={{ border: 'none', background: '#FEF2F2', color: '#EF4444', borderRadius: '6px', padding: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Delete Item"
                            >
                              <Trash2 style={{ width: '15px', height: '15px' }} />
                            </button>
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                });
                })()
              )}

              </tbody>
            </table>
          </div>

          {!newBomSourcePiNo && (
            <div>
              <button
                type="button"
                onClick={handleAddMaterialRow}
                style={{ border: '1px solid #A5F3FC', background: '#ECFEFF', color: '#0E7490', padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                Add Product / Item
              </button>
            </div>
          )}
          </div>
        </div>

        {/* SECTION 4: TRANSPORT & LOGISTICS */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              4
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              TRANSPORT & LOGISTICS DETAILS
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div>
              <label htmlFor="bom-orders-mode-of-transport" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Mode of Transport <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select id="bom-orders-mode-of-transport" name="modeOfTransport" aria-label="Mode of Transport"
                required
                value={newBomTransportMode || ''}
                onChange={(e) => {
                  setNewBomTransportMode(e.target.value);
                  if (formErrors?.transportMode) {
                    setFormErrors(prev => ({ ...prev, transportMode: null }));
                  }
                }}
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '10px',
                  border: (!newBomTransportMode?.trim() && formErrors?.transportMode) ? '2px solid #EF4444' : '1px solid #E2E8F0',
                  padding: '0 14px',
                  fontSize: '13px',
                  color: newBomTransportMode ? '#0F172A' : '#64748B',
                  backgroundColor: (!newBomTransportMode?.trim() && formErrors?.transportMode) ? '#FEF2F2' : 'white',
                  boxSizing: 'border-box',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="">-- Select Transport Mode --</option>
                <option value="Transport">Transport</option>
                <option value="Own Vehicle">Own Vehicle</option>
                <option value="Porter">Porter</option>
                <option value="Courier">Courier</option>
                <option value="Customer Pickup / Self">Customer Pickup / Self</option>
              </select>
              {!newBomTransportMode?.trim() && formErrors?.transportMode && (
                <div style={{ color: '#DC2626', fontSize: '11px', fontWeight: '700', marginTop: '4px' }}>
                  ⚠️ {formErrors.transportMode}
                </div>
              )}
            </div>
            <div>
              <label htmlFor="bom-orders-transport-name" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Transport Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input id="bom-orders-transport-name" name="transportName" aria-label="Transport Name"
                type="text"
                required
                value={newBomTransporterName}
                onChange={(e) => {
                  setNewBomTransporterName(e.target.value);
                  if (formErrors?.transporterName) {
                    setFormErrors(prev => ({ ...prev, transporterName: null }));
                  }
                }}
                placeholder="e.g. VRL Logistics / TCI Freight / Local Transport"
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '10px',
                  border: (!newBomTransporterName?.trim() && formErrors?.transporterName) ? '2px solid #EF4444' : '1px solid #E2E8F0',
                  padding: '0 14px',
                  fontSize: '13px',
                  color: '#0F172A',
                  backgroundColor: (!newBomTransporterName?.trim() && formErrors?.transporterName) ? '#FEF2F2' : 'white',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
               />
              {!newBomTransporterName?.trim() && formErrors?.transporterName && (
                <div style={{ color: '#DC2626', fontSize: '11px', fontWeight: '700', marginTop: '4px' }}>
                  ⚠️ {formErrors.transporterName}
                </div>
              )}
            </div>
            <div>
              <label htmlFor="bom-orders-destination" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Destination <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input id="bom-orders-destination" name="destination" aria-label="Destination"
                type="text"
                required
                value={newBomDestination}
                onChange={(e) => {
                  setNewBomDestination(e.target.value);
                  if (formErrors?.destination) {
                    setFormErrors(prev => ({ ...prev, destination: null }));
                  }
                }}
                placeholder="e.g. Chennai / Coimbatore / Site Location"
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '10px',
                  border: (!newBomDestination?.trim() && formErrors?.destination) ? '2px solid #EF4444' : '1px solid #E2E8F0',
                  padding: '0 14px',
                  fontSize: '13px',
                  color: '#0F172A',
                  backgroundColor: (!newBomDestination?.trim() && formErrors?.destination) ? '#FEF2F2' : 'white',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
               />
              {!newBomDestination?.trim() && formErrors?.destination && (
                <div style={{ color: '#DC2626', fontSize: '11px', fontWeight: '700', marginTop: '4px' }}>
                  ⚠️ {formErrors.destination}
                </div>
              )}
            </div>
            <div>
              <label htmlFor="bom-orders-vehicle-number" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Vehicle Number</label>
              <input id="bom-orders-vehicle-number" name="vehicleNumber" aria-label="Vehicle Number"
                type="text"
                value={newBomVehicleNo}
                onChange={(e) => setNewBomVehicleNo(e.target.value)}
                placeholder="e.g. TN 01 AB 1234 / KA 04 C 5678"
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none' }}
               />
            </div>
            <div>
              <label htmlFor="bom-orders-scope" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Scope</label>
              <select id="bom-orders-scope" name="scope" aria-label="Scope"
                value={newBomTransportScope}
                onChange={(e) => setNewBomTransportScope(e.target.value)}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none', cursor: 'pointer' }}
              >
                <option value="VRM Structures">VRM Structures</option>
                <option value="Customer Scope">Customer Scope</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 5: PAYMENT TERMS & FINANCIAL SUMMARY */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              5
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              PAYMENT TERMS & ORDER SUMMARY
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label htmlFor="bom-orders-payment-terms" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Payment Terms</label>
                {newBomDocType === 'DC' ? (
                  <select id="bom-orders-payment-terms" name="paymentTerms" aria-label="Payment Terms"
                    value="100% Paid"
                    disabled
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: '#F8FAFC', outline: 'none', cursor: 'not-allowed', fontWeight: '700' }}
                  >
                    <option value="100% Paid">100% Paid</option>
                  </select>
                ) : (
                  <select id="bom-orders-payment-terms" name="paymentTerms" aria-label="Payment Terms"
                    value={newBomPaymentType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewBomPaymentType(val);
                      if (val === 'Credit Payment' || val === 'Payment While Dispatch') {
                        setNewBomPaymentProofDoc(null);
                      }
                    }}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="100% Paid">100% Paid</option>
                    <option value="Partial Paid">Partial Paid</option>
                    <option value="Payment While Dispatch">Payment While Dispatch</option>
                    <option value="Credit Payment">Credit Payment</option>
                  </select>
                )}
              </div>

              {(newBomPaymentType === 'Partial Paid' || newBomPaymentType === 'Partial Payment') && (
                <div style={{ backgroundColor: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#0F766E' }}>
                      Partial Advance Amount (₹) <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <span style={{ fontSize: '11px', color: '#0D9488', fontWeight: '700' }}>
                      Total: ₹{Number(totals.grand || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <input name="advanceAmountPaid" aria-label="Enter advance amount paid"
                    id="field-newBomPartialAmount"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Enter advance amount paid..."
                    value={newBomPartialAmount}
                    onChange={(e) => setNewBomPartialAmount(e.target.value)}
                    style={{ width: '100%', height: '40px', borderRadius: '8px', border: formErrors.partialAmount ? '1.5px solid #EF4444' : '1px solid #5EEAD4', padding: '0 12px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none', fontWeight: '700' }}
                   />
                  {formErrors.partialAmount && (
                    <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: '600' }}>{formErrors.partialAmount}</span>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#CCFBF1', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', color: '#115E59' }}>
                    <span>Remaining Balance:</span>
                    <strong style={{ fontSize: '13px', color: '#0F766E' }}>
                      ₹{Math.max(0, (totals.grand || 0) - (parseFloat(newBomPartialAmount) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <span style={{ fontSize: '11px', color: '#0F766E', lineHeight: '1.4' }}>
                    ℹ️ Attach the advance payment slip below. The remaining balance slip can be uploaded after BOM completion / before dispatch.
                  </span>
                </div>
              )}

              {newBomPaymentType === 'Credit Payment' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label htmlFor="bom-orders-new-bom-credit-days" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155' }}>Credit Timeline (Days)</label>
                    <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700' }}>Default: 7 Days</span>
                  </div>
                  <input id="bom-orders-new-bom-credit-days" name="newBomCreditDays" aria-label="Credit Timeline (Days)
                    Default 7 Days"
                    type="number"
                    min="1"
                    max="365"
                    value={newBomCreditDays}
                    onChange={(e) => setNewBomCreditDays(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #A5F3FC', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: '#F0FDFA', boxSizing: 'border-box', outline: 'none', fontWeight: '700' }}
                   />
                </div>
              )}

              <div>
                <label htmlFor="bom-orders-remarks-notes" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Remarks / Notes</label>
                <textarea id="bom-orders-remarks-notes" name="remarksNotes" aria-label="Remarks / Notes"
                  rows={3}
                  value={newBomRemarks}
                  onChange={(e) => setNewBomRemarks(e.target.value)}
                  placeholder="Enter remarks, consignee references, or invoice notes..."
                  style={{ width: '100%', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '12px 14px', fontSize: '13px', color: '#0F172A', outline: 'none', resize: 'vertical' }}
                 />
              </div>
            </div>

            <div>
              {newBomPaymentType === 'Credit Payment' ? (
                <div style={{ border: '1px solid #C7D2FE', borderRadius: '14px', padding: '20px', backgroundColor: '#F5F3FF', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', boxSizing: 'border-box', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#EDE9FE', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Clock style={{ width: '18px', height: '18px' }} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#5B21B6' }}>Credit Payment Terms Active</h4>
                      <span style={{ fontSize: '11px', color: '#6D28D9' }}>{newBomCreditDays} Days Credit Window</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '12px', color: '#4C1D95', margin: 0, lineHeight: '1.5' }}>
                    Payment slip is not required upfront. Salesperson will receive continuous notification reminders.
                  </p>
                </div>
              ) : newBomPaymentType === 'Payment While Dispatch' ? (
                <div style={{ border: '1px solid #C7D2FE', borderRadius: '14px', padding: '20px', backgroundColor: '#EEF2FF', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', boxSizing: 'border-box', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#DBEAFE', color: '#1E40AF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Truck style={{ width: '18px', height: '18px' }} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#1E3A8A' }}>Payment While Dispatch Active</h4>
                      <span style={{ fontSize: '11px', color: '#2563EB' }}>Payment slip due when goods are packed</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '12px', color: '#1E3A8A', margin: 0, lineHeight: '1.5' }}>
                    BOM will proceed with production immediately. Payment receipt will be attached prior to final release.
                  </p>
                </div>
              ) : (
                <div style={{ border: '1px solid #BBF7D0', borderRadius: '14px', padding: '20px', backgroundColor: '#F0FDF4', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', boxSizing: 'border-box', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#DCFCE7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle style={{ width: '18px', height: '18px' }} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#166534' }}>{newBomPaymentType} Terms Active</h4>
                      <span style={{ fontSize: '11px', color: '#15803D' }}>Payment slip attachment required</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '12px', color: '#166534', margin: 0, lineHeight: '1.5' }}>
                    Please attach bank transfer receipt, NEFT/RTGS advice, or deposit counterfoil in the <strong>Document Attachments</strong> section at the bottom of this form.
                  </p>
                  {paymentDocs.length > 0 ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '800', color: '#166534', backgroundColor: '#DCFCE7', padding: '6px 12px', borderRadius: '8px', width: 'fit-content' }}>
                      ✓ {paymentDocs.length} Payment Document{paymentDocs.length > 1 ? 's' : ''} Attached Below
                    </div>
                  ) : (
                    <a
                      href="#field-newBomPaymentProofDoc"
                      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '800', color: '#B45309', backgroundColor: '#FEF3C7', padding: '6px 12px', borderRadius: '8px', width: 'fit-content' }}
                    >
                      ⚠️ Attach slip in Section 6 ↓
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Subtotals & GST Tax Calculation Breakdown */}
          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', fontSize: '13px' }}>
            {selectedPreset && totals.kitSubtotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '320px', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '6px 10px', borderRadius: '6px' }}>
                <span style={{ fontWeight: '700' }}>Preset ({presetSetCount} {presetUnit === 'kW' ? 'kW' : (presetSetCount > 1 ? 'Sets' : 'Set')})</span>
                <strong style={{ color: '#0E7490' }}>₹{totals.kitSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '320px', color: '#64748B' }}>
              <span>Taxable Subtotal (Before GST)</span>
              <strong style={{ color: '#0F172A' }}>₹{totals.sub.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '320px', color: '#64748B', fontSize: '12px' }}>
              <span>CGST (9%)</span>
              <span style={{ color: '#475569', fontWeight: '600' }}>₹{totals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '320px', color: '#64748B', fontSize: '12px' }}>
              <span>SGST (9%)</span>
              <span style={{ color: '#475569', fontWeight: '600' }}>₹{totals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '320px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '6px 10px', borderRadius: '6px' }}>
              <span>Total Applicable GST (18%)</span>
              <span>₹{totals.gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '320px', color: '#0F172A', fontSize: '17px', fontWeight: '800', borderTop: '1px solid #E2E8F0', paddingTop: '10px', marginTop: '4px' }}>
              <span>Grand Total (Incl. GST)</span>
              <span style={{ color: '#0E7490' }}>₹{totals.grand.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* SECTION 6: DOCUMENT ATTACHMENTS & PROOFS (DEDICATED SEPARATE BOTTOM SECTION) */}
        <div id="field-bom-attachments-section" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                6
              </div>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  DOCUMENT ATTACHMENTS & PROOFS
                </h3>
                <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                  Mandatory payment slips and alternate delivery address documents
                </span>
              </div>
            </div>
          </div>

          {(() => {
            const needsAddressProof = !sameAsBilling && Boolean(
              (newBomDeliveryStreet && newBomDeliveryStreet.trim()) ||
              (newBomDeliveryCity && newBomDeliveryCity.trim()) ||
              (newBomDeliveryPincode && newBomDeliveryPincode.trim())
            );
            const isPaidOrder = (
              newBomPaymentType === '100% Paid' ||
              newBomPaymentType === '100% Advance' ||
              newBomPaymentType === 'Partial Paid' ||
              newBomPaymentType === 'Partial Payment' ||
              String(newBomPaymentType || '').toLowerCase().includes('advance') ||
              String(newBomPaymentType || '').toLowerCase().includes('partial')
            );

            if (!needsAddressProof && !isPaidOrder) {
              return (
                <div style={{
                  padding: '20px',
                  borderRadius: '12px',
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <CheckCircle style={{ width: '22px', height: '22px', color: '#16A34A', flexShrink: 0 }} />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#166534' }}>
                      No Mandatory Attachments Required
                    </h4>
                    <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#15803D' }}>
                      Delivery address matches registered billing address, and payment terms ({newBomPaymentType}) do not require upfront payment proof. You can proceed directly to create the order.
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* 1. Address Proof Upload */}
                {needsAddressProof && (
                  <div style={{
                    padding: '18px 20px',
                    backgroundColor: '#FEF2F2',
                    border: '1.5px dashed #F87171',
                    borderRadius: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <AlertCircle style={{ width: '18px', height: '18px' }} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', color: '#0F172A' }}>
                            Delivery Address Proof <span style={{ color: '#64748B', fontWeight: '600' }}>(Optional)</span>
                          </h4>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>
                            Alternate delivery address specified. Upload electricity bill, GST certificate, lease copy, or premises photos if available.
                          </span>
                        </div>
                      </div>
                      {deliveryDocs.length >= 4 ? (
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534', backgroundColor: '#DCFCE7', padding: '4px 10px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle style={{ width: '12px', height: '12px' }} /> {deliveryDocs.length} Images Attached
                        </span>
                      ) : deliveryDocs.length > 0 ? (
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#B45309', backgroundColor: '#FEF3C7', padding: '4px 10px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          📷 {deliveryDocs.length} Image{deliveryDocs.length > 1 ? 's' : ''} Attached
                        </span>
                      ) : null}
                    </div>

                    {deliveryDocs.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                        {deliveryDocs.map((doc, idx) => (
                          <div key={idx} style={{ border: '1px solid #FECACA', borderRadius: '10px', padding: '8px', backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                            <div style={{ position: 'relative', height: '100px', backgroundColor: '#FEF2F2', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {(doc.previewUrl || doc.dataUrl) ? (
                                <img src={doc.previewUrl || doc.dataUrl} alt={doc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <FileText style={{ width: '32px', height: '32px', color: '#DC2626' }} />
                              )}
                              <span style={{ position: 'absolute', top: '4px', left: '4px', backgroundColor: 'rgba(15, 23, 42, 0.75)', color: '#FFFFFF', fontSize: '10px', fontWeight: '800', padding: '1px 6px', borderRadius: '4px' }}>
                                Image #{idx + 1}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={doc.name}>
                              {doc.name}
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{doc.size || 'Attached'}</span>
                              <span style={{ color: '#166534', fontWeight: '700' }}>✓ Attached</span>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                              <button
                                type="button"
                                onClick={() => setPreviewDocModal({ title: `Delivery Address Proof #${idx + 1}: ${doc.name}`, doc })}
                                style={{ flex: 1, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '5px', borderRadius: '6px' }}
                              >
                                <Eye style={{ width: '12px', height: '12px' }} /> View
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveDeliveryDoc(idx)}
                                style={{ border: 'none', background: '#FEE2E2', color: '#EF4444', cursor: 'pointer', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 8px', borderRadius: '6px' }}
                                title="Remove this image"
                              >
                                <Trash2 style={{ width: '12px', height: '12px' }} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          handleUploadDeliveryProofFiles(e.dataTransfer.files);
                        }
                      }}
                      style={{ border: '2px dashed #CBD5E1', borderRadius: '12px', padding: deliveryDocs.length > 0 ? '12px 16px' : '16px 20px', textAlign: 'center', backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
                    >
                      <UploadCloud style={{ width: deliveryDocs.length > 0 ? '22px' : '28px', height: deliveryDocs.length > 0 ? '22px' : '28px', color: '#DC2626' }} />
                      <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>
                        {deliveryDocs.length > 0
                          ? `Attach more delivery address images (Select multiple files to reach 4+ images)`
                          : `Drag & drop delivery address images here (Upload at least 4 images e.g. Site front, Entrance, Access road, Premises proof)`}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', border: '1px solid #DC2626', color: '#DC2626', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                          <Upload style={{ width: '13px', height: '13px' }} />
                          {deliveryDocs.length > 0 ? '+ Add More Images' : 'Browse / Select Files (Multi-Select)'}
                          <input id="bom-orders-input-1" name="input1" aria-label="Input 1"
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                handleUploadDeliveryProofFiles(e.target.files);
                                e.target.value = '';
                              }
                            }}
                          />
                        </label>
                      </div>
                      <span style={{ fontSize: '10px', color: '#94A3B8' }}>Supported formats: JPG, PNG, PDF, DOC (Multi-select enabled • Auto-compressed to lightweight &lt; 25 KB)</span>
                    </div>
                  </div>
                )}

                {/* 2. Payment Proof Upload (Shows if 100% or Partial Paid, but NOT for DC) */}
                {isPaidOrder && !(String(newBomDocType || '').toUpperCase().includes('DC') || String(newBomDocType || '').toUpperCase().includes('CHALLAN')) && (
                  <div style={{
                    padding: '18px 20px',
                    backgroundColor: '#F0FDF4',
                    border: (formErrors?.paymentProof && paymentDocs.length === 0) ? '1.5px dashed #EF4444' : '1.5px dashed #86EFAC',
                    borderRadius: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#DCFCE7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle style={{ width: '18px', height: '18px' }} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', color: '#0F172A' }}>
                            Payment Attachment / Slip ({newBomPaymentType}) <span style={{ color: '#EF4444' }}>*</span>
                          </h4>
                          <span style={{ fontSize: '11px', color: '#166534' }}>
                            Mandatory bank remittance advice, NEFT/RTGS transaction receipt, or bank deposit counterfoil.
                          </span>
                        </div>
                      </div>
                      {paymentDocs.length >= 4 ? (
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534', backgroundColor: '#DCFCE7', padding: '4px 10px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle style={{ width: '12px', height: '12px' }} /> {paymentDocs.length} Slips Attached (Target Met)
                        </span>
                      ) : paymentDocs.length > 0 ? (
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#B45309', backgroundColor: '#FEF3C7', padding: '4px 10px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          📷 {paymentDocs.length} Slip{paymentDocs.length > 1 ? 's' : ''} Attached
                        </span>
                      ) : null}
                    </div>

                    {paymentDocs.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                        {paymentDocs.map((doc, idx) => (
                          <div key={idx} style={{ border: '1px solid #86EFAC', borderRadius: '10px', padding: '8px', backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                            <div style={{ position: 'relative', height: '100px', backgroundColor: '#DCFCE7', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {(doc.previewUrl || doc.dataUrl) ? (
                                <img src={doc.previewUrl || doc.dataUrl} alt={doc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <FileCheck style={{ width: '32px', height: '32px', color: '#166534' }} />
                              )}
                              <span style={{ position: 'absolute', top: '4px', left: '4px', backgroundColor: 'rgba(15, 23, 42, 0.75)', color: '#FFFFFF', fontSize: '10px', fontWeight: '800', padding: '1px 6px', borderRadius: '4px' }}>
                                Slip #{idx + 1}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={doc.name}>
                              {doc.name}
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{doc.size || 'Attached'}</span>
                              <span style={{ color: '#166534', fontWeight: '700' }}>✓ Verified</span>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                              <button
                                type="button"
                                onClick={() => setPreviewDocModal({ title: `Payment Proof #${idx + 1}: ${doc.name}`, doc })}
                                style={{ flex: 1, border: '1px solid #BBF7D0', background: '#DCFCE7', color: '#166534', cursor: 'pointer', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '5px', borderRadius: '6px' }}
                              >
                                <Eye style={{ width: '12px', height: '12px' }} /> View
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemovePaymentDoc(idx)}
                                style={{ border: 'none', background: '#FEE2E2', color: '#DC2626', cursor: 'pointer', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 8px', borderRadius: '6px' }}
                                title="Remove this slip"
                              >
                                <Trash2 style={{ width: '12px', height: '12px' }} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div
                      id="field-newBomPaymentProofDoc"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          handleUploadPaymentProofFiles(e.dataTransfer.files);
                        }
                      }}
                      style={{
                        border: (formErrors?.paymentProof && paymentDocs.length === 0) ? '2px dashed #EF4444' : '2px dashed #CBD5E1',
                        borderRadius: '12px',
                        padding: paymentDocs.length > 0 ? '14px 16px' : '20px 16px',
                        textAlign: 'center',
                        backgroundColor: (formErrors?.paymentProof && paymentDocs.length === 0) ? '#FEF2F2' : '#FAFAFA',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <UploadCloud style={{ width: paymentDocs.length > 0 ? '22px' : '30px', height: paymentDocs.length > 0 ? '22px' : '30px', color: (formErrors?.paymentProof && paymentDocs.length === 0) ? '#EF4444' : '#10B981' }} />
                      <span style={{ fontSize: '12.5px', color: (formErrors?.paymentProof && paymentDocs.length === 0) ? '#DC2626' : '#475569', fontWeight: '700' }}>
                        {paymentDocs.length > 0
                          ? `Attach more payment slips / receipts (Multi-select enabled)`
                          : `Drag & drop payment slip / bank advice here (Upload at least 4 images e.g. Transfer receipt, Bank statement, RTGS voucher)`}
                      </span>
                      {formErrors?.paymentProof && paymentDocs.length === 0 && (
                        <span style={{ color: '#EF4444', fontSize: '11.5px', fontWeight: '700' }}>
                          ⚠️ Payment slip is mandatory for {newBomPaymentType} orders!
                        </span>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', border: '1px solid #10B981', color: '#047857', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                          <Upload style={{ width: '13px', height: '13px' }} />
                          {paymentDocs.length > 0 ? '+ Add More Slips' : 'Browse / Select Slips (Multi-Select)'}
                          <input id="bom-orders-input-2" name="input2" aria-label="Input 2"
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                handleUploadPaymentProofFiles(e.target.files);
                                e.target.value = '';
                              }
                            }}
                          />
                        </label>
                      </div>
                      <span style={{ fontSize: '10px', color: '#94A3B8' }}>Supported formats: PDF, JPG, PNG (Multi-select enabled • Upload at least 4 images recommended)</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Sticky Bottom Menu Bar Following with Scroll for Create BOM Order */}
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
            marginTop: '8px',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={isSubmittingBom}
              onClick={() => setBomConfirmModal('cancel')}
              style={{
                height: '40px',
                borderRadius: '8px',
                border: '1.5px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#334155',
                padding: '0 18px',
                fontWeight: '700',
                cursor: isSubmittingBom ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease',
                opacity: isSubmittingBom ? 0.6 : 1
              }}
              onMouseEnter={(e) => { if (!isSubmittingBom) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
              onMouseLeave={(e) => { if (!isSubmittingBom) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
            >
              <ArrowLeft size={15} /> Back
            </button>

            <button
              type="button"
              disabled={isSubmittingBom}
              onClick={() => {
                if (isSubmittingBom) return;
                const validation = validateBomForm(true);
                if (!validation.isValid) {
                  setValidationErrorModal({
                    fields: validation.missingList.map(m => typeof m === 'object' ? m.field : m),
                    firstTargetId: validation.missingList[0]?.targetId
                  });
                  return;
                }
                setBomConfirmModal('draft');
              }}
              style={{
                height: '40px',
                borderRadius: '8px',
                border: '1.5px solid #0E7490',
                backgroundColor: '#FFFFFF',
                color: '#0E7490',
                padding: '0 18px',
                fontWeight: '700',
                cursor: isSubmittingBom ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease',
                opacity: isSubmittingBom ? 0.6 : 1
              }}
              onMouseEnter={(e) => { if (!isSubmittingBom) e.currentTarget.style.backgroundColor = '#ECFEFF'; }}
              onMouseLeave={(e) => { if (!isSubmittingBom) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
            >
              <FileText size={15} /> Save as Draft
            </button>

            <button
              type="button"
              disabled={isSubmittingBom}
              onClick={() => {
                if (isSubmittingBom) return;
                const validation = validateBomForm(false);
                if (!validation.isValid) {
                  const firstTarget = validation.missingList[0]?.targetId;
                  if (firstTarget && typeof document !== 'undefined') {
                    const el = document.getElementById(firstTarget);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                  setValidationErrorModal({
                    fields: validation.missingList.map(m => typeof m === 'object' ? m.field : m),
                    firstTargetId: firstTarget
                  });
                  return;
                }
                setBomConfirmModal('create');
              }}
              style={{
                height: '40px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#0E7490',
                color: '#FFFFFF',
                padding: '0 22px',
                fontWeight: '800',
                cursor: isSubmittingBom ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                boxShadow: '0 2px 8px rgba(14, 116, 144, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                transition: 'all 0.15s ease',
                opacity: isSubmittingBom ? 0.6 : 1
              }}
              onMouseEnter={(e) => { if (!isSubmittingBom) e.currentTarget.style.backgroundColor = '#075985'; }}
              onMouseLeave={(e) => { if (!isSubmittingBom) e.currentTarget.style.backgroundColor = '#0E7490'; }}
            >
              <Check style={{ width: '16px', height: '16px' }} /> {editingBomRecord ? 'Save Edited BOM →' : 'Confirm BOM →'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>Grand Total:</span>
            <strong style={{ fontSize: '15px', color: '#0E7490', fontWeight: '800' }}>
              ₹{cleanNum(totals.grand, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>
        </div>


        <BomCreateSubmitModal ctx={ctx} />

        {/* FULL-SCREEN BOM CREATION LOADING OVERLAY */}
        {renderBomSubmittingOverlay()}

        {/* DOCUMENT PREVIEW MODAL */}
        {renderDocPreviewModal()}

        {/* CUSTOM MANDATORY VALIDATION MODAL */}
        {renderValidationErrorModal()}
      </div>
    );
}
