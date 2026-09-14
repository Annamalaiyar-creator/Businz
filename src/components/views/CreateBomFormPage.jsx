import React from "react";
import {
  Plus, Trash2, Eye, FileText, AlertCircle, AlertTriangle, X,
  CheckCircle, Clock, FileCheck, UploadCloud, Truck, Package,
  ShoppingCart, Upload, Layers, Image, Bell, Save
} from "lucide-react";
import {
  cleanNum, stripDataUrlsFromRecord, compressAndSaveFile, saveMediaToCache
} from "../../utils/otherViewsShared";
import { saveCloudStoreImmediate } from "../../utils/supabaseDataSync";
import { centralInventoryStore } from "../../utils/centralInventoryStore";
import SearchablePresetSelector from "../SearchablePresetSelector";
import TypeableProductSelect from "../TypeableProductSelect";

export default function CreateBomFormPage(props) {
  const {
    showBOMForm, setShowBOMForm, setShowCustomerForm, customerList, setBomStore,
    newBomCode, setNewBomCode, newBomDeliveryDate, setNewBomDeliveryDate,
    newBomProductName, setNewBomProductName, bomFormErrors, setBomFormErrors,
    newBomBillingStreet, setNewBomBillingStreet, newBomBillingCity, setNewBomBillingCity,
    newBomBillingState, setNewBomBillingState, newBomBillingPincode, setNewBomBillingPincode,
    newBomDeliveryAddress, newBomDeliveryStreet, setNewBomDeliveryStreet,
    newBomDeliveryCity, setNewBomDeliveryCity, newBomDeliveryState, setNewBomDeliveryState,
    newBomDeliveryPincode, setNewBomDeliveryPincode, newBomPaymentType, setNewBomPaymentType,
    newBomCreditDays, setNewBomCreditDays, sameAsBilling, setSameAsBilling,
    newBomDeliveryProofDoc, setNewBomDeliveryProofDoc, newBomPaymentProofDoc, setNewBomPaymentProofDoc,
    newBomRemarks, setNewBomRemarks, newBomTransportMode, setNewBomTransportMode,
    newBomTransporterName, setNewBomTransporterName, newBomVehicleNo, setNewBomVehicleNo,
    newBomLrNo, setNewBomLrNo, newBomGstRate, setNewBomGstRate, activePresetsMap,
    selectedPreset, setSelectedPreset, presetSetCount, setPresetSetCount,
    presetKitPrice, setPresetKitPrice, setPreviewDocModal,
    selectedBomItemIndexes, setSelectedBomItemIndexes,
    showClearConfirmModal, setShowClearConfirmModal,
    bomConfirmModal, setBomConfirmModal, showCustomAlert
  } = props;
  const [newBomPartialAmount, setNewBomPartialAmount] = React.useState(props.newBomPartialAmount || '');
  const calculateBOMTotals = () => {
    const kitUnitPrice = (selectedPreset && presetKitPrice !== '') ? cleanNum(presetKitPrice, 0) : 0;
    const kitMultiplier = parseInt(String(presetSetCount).replace(/[^0-9]/g, '')) || 1;
    const kitSubtotal = selectedPreset ? (kitUnitPrice * kitMultiplier) : 0;

    const itemsSub = (bomMaterialsList || []).reduce((acc, item) => {
      const q = cleanNum(item.qty, 0);
      const r = cleanNum(item.rate, 0);
      return acc + (q * r);
    }, 0);

    const sub = itemsSub + kitSubtotal;
    const disc = 0;

    const itemsGst = (bomMaterialsList || []).reduce((acc, item) => {
      const q = cleanNum(item.qty, 0);
      const r = cleanNum(item.rate, 0);
      const rowTot = q * r;
      const pct = cleanNum(String(item.gstRate || newBomGstRate || '18%').replace('%', ''), 18);
      return acc + (rowTot * (pct / 100));
    }, 0);
    const presetItem = (bomMaterialsList || []).find(it => it.isPresetItem);
    const presetGstPct = cleanNum(String(presetItem?.gstRate || newBomGstRate || '18%').replace('%', ''), 18);
    const kitGst = kitSubtotal * (presetGstPct / 100);
    const gst = itemsGst + kitGst;

    const grand = sub - disc + gst;
    const cgst = gst / 2;
    const sgst = gst / 2;
    return {
      sub: cleanNum(sub, 0),
      kitSubtotal: cleanNum(kitSubtotal, 0),
      disc: cleanNum(disc, 0),
      gst: cleanNum(gst, 0),
      grand: cleanNum(grand, 0),
      cgst: cleanNum(cgst, 0),
      sgst: cleanNum(sgst, 0)
    };
  };

  const totals = calculateBOMTotals();

  const handleAddMaterialRow = () => {
    setBomMaterialsList(prev => [...prev, { name: '', category: '', uom: 'NOS', qty: '1', wastage: '0%', rate: '', gstRate: newBomGstRate || '18%' }]);
  };

  const handleRemoveMaterialRow = (idx) => {
    setBomMaterialsList(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', fontFamily: "'DM Sans', sans-serif", backgroundColor: '#F8FAFC', padding: '24px', borderRadius: '16px', boxSizing: 'border-box' }}>

      {/* Top Page Title Bar with Action Buttons on Same Line */}
      <div style={{
        background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
        borderRadius: '18px',
        padding: '24px 28px',
        color: '#FFFFFF',
        boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.4)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingCart style={{ width: '24px', height: '24px', color: '#FFFFFF' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#FFFFFF', margin: 0, letterSpacing: '-0.3px' }}>
              Create Sales Bill of Materials (BOM)
            </h1>
            <p style={{ fontSize: '13px', color: '#C7D2FE', margin: '4px 0 0 0' }}>
              Configure customer order, specify delivery destination, upload document proofs, & compile BOM preset items
            </p>
          </div>
        </div>

        {/* TOP HEADER BUTTON BAR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setBomConfirmModal('cancel')}
            style={{ border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
          >
            Cancel
          </button>

          <button
            onClick={() => {
              const validation = validateProductionBomForm(true);
              if (!validation.isValid) {
                showCustomAlert({
                  title: `⚠️ Missing Required Details (${validation.missingList.length} field${validation.missingList.length > 1 ? 's' : ''})`,
                  message: 'Please complete the highlighted details before saving draft:',
                  type: 'warning',
                  details: validation.missingList,
                  targetFieldId: validation.missingList[0]?.targetId
                });
                return;
              }
              setBomConfirmModal('draft');
            }}
            style={{ border: 'none', background: '#FFFFFF', color: '#4F46E5', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
          >
            <FileText style={{ width: '15px', height: '15px' }} />
            Save as Draft
          </button>

          <button
            onClick={() => {
              const validation = validateProductionBomForm(false);
              if (!validation.isValid) {
                showCustomAlert({
                  title: `⚠️ Missing Required Details (${validation.missingList.length} field${validation.missingList.length > 1 ? 's' : ''})`,
                  message: 'Please complete the highlighted details before creating this BOM order:',
                  type: 'warning',
                  details: validation.missingList,
                  targetFieldId: validation.missingList[0]?.targetId
                });
                return;
              }
              setBomConfirmModal('create');
            }}
            style={{ border: 'none', background: '#10B981', color: 'white', padding: '10px 24px', borderRadius: '10px', fontSize: '13px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <CheckCircle style={{ width: '16px', height: '16px' }} />
            Create Order →
          </button>
        </div>
      </div>

      {/* SECTION 1: ORDER INFORMATION */}
      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#4F46E5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
            1
          </div>
          <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#4F46E5', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ORDER INFORMATION
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Order Date</label>
            <div style={{ position: 'relative' }}>
              <input
                type="date"
                value={new Date().toISOString().split('T')[0]}
                disabled
                readOnly
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#64748B', backgroundColor: '#F1F5F9', cursor: 'not-allowed', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Delivery Date <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              id="prod-field-newBomDeliveryDate"
              type="date"
              min={new Date().toISOString().split('T')[0]}
              value={newBomDeliveryDate}
              onChange={(e) => {
                setNewBomDeliveryDate(e.target.value);
                if (bomFormErrors.deliveryDate) {
                  setBomFormErrors(prev => ({ ...prev, deliveryDate: null }));
                }
              }}
              style={{
                width: '100%', height: '42px', borderRadius: '10px',
                border: bomFormErrors.deliveryDate ? '2px solid #EF4444' : '1px solid #E2E8F0',
                backgroundColor: bomFormErrors.deliveryDate ? '#FEF2F2' : 'white',
                padding: '0 14px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none'
              }}
            />
            {bomFormErrors.deliveryDate && (
              <div style={{ color: '#DC2626', fontSize: '11px', fontWeight: '700', marginTop: '4px' }}>
                ⚠️ {bomFormErrors.deliveryDate}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Order Number</label>
            <input
              type="text"
              value="Auto-Assigned"
              readOnly
              disabled
              style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CFFAFE', padding: '0 14px', fontSize: '13px', fontWeight: '700', color: '#0E7490', backgroundColor: '#F0FDFA', cursor: 'not-allowed', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: CUSTOMER INFORMATION */}
      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#4F46E5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
            2
          </div>
          <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#4F46E5', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            CUSTOMER INFORMATION
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Customer Name <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ width: '100%' }}>
              <input
                type="text"
                list="bom-customer-name-suggestions"
                placeholder="Type or select customer from list..."
                value={newBomProductName}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewBomProductName(val);
                  const target = (val || '').toLowerCase().trim();
                  if (!target) return;

                  const chosen = customerList.find(c => {
                    const code = (c.code || '').toLowerCase().trim();
                    const c2 = (c.c2 || '').toLowerCase().trim();
                    const cName = (c.customerName || '').toLowerCase().trim();
                    const comp = (c.companyName || '').toLowerCase().trim();
                    return code === target || c2 === target || cName === target || comp === target ||
                           (code && code.startsWith(target)) || (c2 && c2.startsWith(target)) ||
                           (cName && cName.startsWith(target)) || (comp && comp.startsWith(target)) ||
                           (c2 && c2.includes(target)) || (comp && comp.includes(target));
                  });

                  if (chosen) {
                    const dObj = chosen.deliveryAddressObj || {};
                    const dAddr = dObj.address || chosen.c7 || chosen.deliveryAddress || chosen.dispatchAddress || '';
                    const bObj = chosen.billingAddressObj || {};
                    const bAddr = bObj.address || chosen.c6 || chosen.billingAddress || chosen.address || '';

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
                  if (bomFormErrors.customerName) {
                    setBomFormErrors(prev => ({ ...prev, customerName: null }));
                  }
                }}
                id="prod-field-newBomProductName"
                style={{
                  width: '100%', height: '42px', borderRadius: '10px',
                  border: bomFormErrors.customerName ? '2px solid #EF4444' : '1px solid #E2E8F0',
                  backgroundColor: bomFormErrors.customerName ? '#FEF2F2' : 'white',
                  padding: '0 14px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none'
                }}
              />
              {bomFormErrors.customerName && (
                <div style={{ color: '#DC2626', fontSize: '11px', fontWeight: '700', marginTop: '4px' }}>
                  ⚠️ {bomFormErrors.customerName}
                </div>
              )}
              <datalist id="bom-customer-name-suggestions">
                {customerList.map((c, idx) => {
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
          <button
            onClick={() => {
              setShowCustomerForm(true);
            }}
            style={{ border: '1px solid #E0E7FF', background: '#EEF2FF', color: '#4F46E5', height: '42px', padding: '0 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
          >
            <Plus style={{ width: '15px', height: '15px' }} />
            Add New Customer
          </button>
        </div>

        {(() => {
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

          const companyName = selCust ? (selCust.c2 || selCust.companyName || selCust.customerName || selCust.code) : (newBomProductName || '—');
          const mobileNo = selCust ? (selCust.c4 || selCust.primaryContact?.phone || selCust.phone || selCust.primaryContact?.whatsapp || '—') : '—';
          const emailAddr = selCust ? (selCust.c5 || selCust.primaryContact?.email || selCust.email || '—') : '—';

          const bObj = selCust?.billingAddressObj || {};
          const billingStreet = newBomBillingStreet || bObj.address || selCust?.c6 || selCust?.billingAddress || selCust?.address || '';
          const billingCity = newBomBillingCity || bObj.city || selCust?.city || '';
          const billingState = newBomBillingState || bObj.state || selCust?.state || '';
          const billingPincode = newBomBillingPincode || bObj.pincode || selCust?.pincode || '';

          const isDeliveryMatchingBilling = Boolean(sameAsBilling) || (
            (newBomDeliveryStreet.trim() === (billingStreet ? billingStreet.trim() : '')) &&
            (newBomDeliveryCity.trim() === (billingCity ? billingCity.trim() : '')) &&
            (newBomDeliveryState.trim() === (billingState ? billingState.trim() : '')) &&
            (newBomDeliveryPincode.trim() === (billingPincode ? billingPincode.trim() : ''))
          );

          return (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Company Name</label>
                  <input type="text" value={companyName} readOnly style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#64748B', backgroundColor: '#F8FAFC', boxSizing: 'border-box', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Mobile Number</label>
                  <input type="text" value={mobileNo} readOnly style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#64748B', backgroundColor: '#F8FAFC', boxSizing: 'border-box', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Email</label>
                  <input type="text" value={emailAddr} readOnly style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#64748B', backgroundColor: '#F8FAFC', boxSizing: 'border-box', outline: 'none' }} />
                </div>
              </div>

              {/* STRUCTURED BILLING & DELIVERY ADDRESSES */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

                {/* BILLING ADDRESS CARD */}
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
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Primary address for invoices & tax records</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>
                      Address (Street / Building / Area)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Plot No 42, SIDCO Industrial Estate, Ambattur"
                      value={newBomBillingStreet || billingStreet}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewBomBillingStreet(val);
                        if (sameAsBilling) setNewBomDeliveryStreet(val);
                      }}
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                      <input
                        type="text"
                        placeholder="City"
                        value={newBomBillingCity || billingCity}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewBomBillingCity(val);
                          if (sameAsBilling) setNewBomDeliveryCity(val);
                        }}
                        style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                      <input
                        type="text"
                        placeholder="State"
                        value={newBomBillingState || billingState}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewBomBillingState(val);
                          if (sameAsBilling) setNewBomDeliveryState(val);
                        }}
                        style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pincode</label>
                      <input
                        type="text"
                        placeholder="6-digit Pincode"
                        value={newBomBillingPincode || billingPincode}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewBomBillingPincode(val);
                          if (sameAsBilling) setNewBomDeliveryPincode(val);
                        }}
                        style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                      />
                    </div>
                  </div>
                </div>

                {/* DELIVERY / SHIPPING ADDRESS CARD */}
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
                        checked={sameAsBilling}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSameAsBilling(checked);
                          if (checked) {
                            const effStreet = newBomBillingStreet || (billingStreet !== '—' ? billingStreet : '');
                            const effCity = newBomBillingCity || (billingCity !== '—' ? billingCity : '');
                            const effState = newBomBillingState || (billingState !== '—' ? billingState : '');
                            const effPin = newBomBillingPincode || (billingPincode !== '—' ? billingPincode : '');
                            setNewBomDeliveryStreet(effStreet);
                            setNewBomDeliveryCity(effCity);
                            setNewBomDeliveryState(effState);
                            setNewBomDeliveryPincode(effPin);
                            setNewBomDeliveryProofDoc(null);
                          } else {
                            setNewBomDeliveryStreet('');
                            setNewBomDeliveryCity('');
                            setNewBomDeliveryState('');
                            setNewBomDeliveryPincode('');
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
                      placeholder="e.g. Plot No 42, SIDCO Industrial Estate, Ambattur"
                      value={sameAsBilling ? (newBomBillingStreet || (billingStreet !== '—' ? billingStreet : '')) : newBomDeliveryStreet}
                      disabled={sameAsBilling}
                      onChange={(e) => setNewBomDeliveryStreet(e.target.value)}
                      style={{
                        width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px',
                        color: sameAsBilling ? '#64748B' : '#0F172A',
                        backgroundColor: sameAsBilling ? '#F1F5F9' : '#FFFFFF',
                        boxSizing: 'border-box', outline: 'none',
                        cursor: sameAsBilling ? 'not-allowed' : 'text'
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                      <input
                        type="text"
                        placeholder="e.g. Chennai"
                        value={sameAsBilling ? (newBomBillingCity || (billingCity !== '—' ? billingCity : '')) : newBomDeliveryCity}
                        disabled={sameAsBilling}
                        onChange={(e) => setNewBomDeliveryCity(e.target.value)}
                        style={{
                          width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px',
                          color: sameAsBilling ? '#64748B' : '#0F172A',
                          backgroundColor: sameAsBilling ? '#F1F5F9' : '#FFFFFF',
                          boxSizing: 'border-box', outline: 'none',
                          cursor: sameAsBilling ? 'not-allowed' : 'text'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                      <input
                        type="text"
                        placeholder="e.g. Tamil Nadu"
                        value={sameAsBilling ? (newBomBillingState || (billingState !== '—' ? billingState : '')) : newBomDeliveryState}
                        disabled={sameAsBilling}
                        onChange={(e) => setNewBomDeliveryState(e.target.value)}
                        style={{
                          width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px',
                          color: sameAsBilling ? '#64748B' : '#0F172A',
                          backgroundColor: sameAsBilling ? '#F1F5F9' : '#FFFFFF',
                          boxSizing: 'border-box', outline: 'none',
                          cursor: sameAsBilling ? 'not-allowed' : 'text'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pincode</label>
                      <input
                        type="text"
                        placeholder="e.g. 600058"
                        value={sameAsBilling ? (newBomBillingPincode || (billingPincode !== '—' ? billingPincode : '')) : newBomDeliveryPincode}
                        disabled={sameAsBilling}
                        onChange={(e) => setNewBomDeliveryPincode(e.target.value)}
                        style={{
                          width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px',
                          color: sameAsBilling ? '#64748B' : '#0F172A',
                          backgroundColor: sameAsBilling ? '#F1F5F9' : '#FFFFFF',
                          boxSizing: 'border-box', outline: 'none',
                          cursor: sameAsBilling ? 'not-allowed' : 'text'
                        }}
                      />
                    </div>
                  </div>

                  {/* MANDATORY ADDRESS PROOF ATTACHMENT WHEN DELIVERY ADDRESS DIFFERS FROM BILLING */}
                  {!sameAsBilling ? (
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
                            <span style={{ fontSize: '11px', color: '#B91C1C' }}>
                              Delivery address differs from billing address. Upload proof (GST / Electricity Bill / Consignee Lease).
                            </span>
                          </div>
                        </div>
                        {newBomDeliveryProofDoc && (
                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle style={{ width: '12px', height: '12px' }} /> Attached
                          </span>
                        )}
                      </div>

                      {newBomDeliveryProofDoc ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: '10px 14px', borderRadius: '8px', border: '1px solid #FECACA' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText style={{ width: '16px', height: '16px', color: '#DC2626' }} />
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>{newBomDeliveryProofDoc.name}</div>
                              <div style={{ fontSize: '10px', color: '#64748B' }}>{newBomDeliveryProofDoc.size || '1.2 MB'} • Uploaded</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => setPreviewDocModal({ title: 'Delivery Address Proof Document', doc: newBomDeliveryProofDoc })}
                              style={{ border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px' }}
                            >
                              <Eye style={{ width: '13px', height: '13px' }} /> View Image
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewBomDeliveryProofDoc(null)}
                              style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Trash2 style={{ width: '13px', height: '13px' }} /> Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files && e.dataTransfer.files[0];
                            if (file) {
                              compressAndSaveFile(file, (docMeta) => {
                                if (docMeta) {
                                  if (docMeta.name && docMeta.dataUrl) saveMediaToCache(docMeta.name, docMeta.dataUrl);
                                  setNewBomDeliveryProofDoc(docMeta);
                                }
                              });
                            }
                          }}
                          style={{ border: '2px dashed #CBD5E1', borderRadius: '12px', padding: '16px 20px', textAlign: 'center', backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
                        >
                          <UploadCloud style={{ width: '28px', height: '28px', color: '#DC2626' }} />
                          <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>
                            Drag & drop address proof document here or
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', border: '1px solid #DC2626', color: '#DC2626', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                              <Upload style={{ width: '13px', height: '13px' }} />
                              Browse Files
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  const file = e.target.files && e.target.files[0];
                                  if (file) {
                                    compressAndSaveFile(file, (docMeta) => {
                                      if (docMeta) {
                                        if (docMeta.name && docMeta.dataUrl) saveMediaToCache(docMeta.name, docMeta.dataUrl);
                                        setNewBomDeliveryProofDoc(docMeta);
                                      }
                                    });
                                  }
                                }}
                              />
                            </label>
                          </div>
                          <span style={{ fontSize: '10px', color: '#94A3B8' }}>Supported formats: PDF, JPG, PNG, DOC (Max 5MB)</span>
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
            </>
          );
        })()}
      </div>

      {/* SECTION 3: ORDER ITEMS */}
      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#4F46E5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              3
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#4F46E5', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ORDER ITEMS & BILL OF MATERIALS
            </h3>
          </div>

          {/* PRESET SELECTOR & CLEAR BUTTON */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', padding: '4px 10px', borderRadius: '8px' }}>
              <Layers style={{ width: '14px', height: '14px', color: '#4F46E5' }} />
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#4338CA' }}>Preset:</span>
            </div>
            <SearchablePresetSelector
              value={selectedPreset}
              activePresetsMap={activePresetsMap}
              accentColor="#4F46E5"
              width="340px"
              placeholder="Type or pick Preset..."
              onChange={(val, targetPreset) => {
                setSelectedPreset(val);
                setSelectedBomItemIndexes([]);

                if (targetPreset && targetPreset.items) {
                  const multiplier = parseInt(presetSetCount) || 1;
                  setBomMaterialsList(targetPreset.items.map(it => {
                    const baseQ = parseFloat(it.qty) || 1;
                    return {
                      ...it,
                      baseQty: baseQ,
                      qty: String(Math.round(baseQ * multiplier)),
                      rate: '0',
                      isPresetItem: true
                    };
                  }));
                  if (targetPreset.price || targetPreset.rate) {
                    setPresetKitPrice(String(targetPreset.price || targetPreset.rate));
                  } else {
                    const origSum = targetPreset.items.reduce((acc, it) => acc + (parseFloat(it.qty || 1) * parseFloat(it.rate || 0)), 0);
                    setPresetKitPrice(origSum > 0 ? String(origSum) : '');
                  }
                } else {
                  setPresetKitPrice('');
                }
              }}
            />

            {/* Append Additional Preset Button */}
            {selectedPreset && bomMaterialsList.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const targetPreset = activePresetsMap && activePresetsMap[selectedPreset] ? activePresetsMap[selectedPreset] : (VRM_HDG_PRESETS && VRM_HDG_PRESETS[selectedPreset]);
                  if (targetPreset && targetPreset.items) {
                    const multiplier = parseInt(presetSetCount) || 1;
                    const additionalItems = targetPreset.items.map(it => {
                      const baseQ = parseFloat(it.qty) || 1;
                      return {
                        ...it,
                        baseQty: baseQ,
                        qty: String(Math.round(baseQ * multiplier)),
                        rate: '0',
                        isPresetItem: true
                      };
                    });
                    setBomMaterialsList(prev => [...prev, ...additionalItems]);
                    const addPrice = parseFloat(presetKitPrice) || (targetPreset.price || targetPreset.rate || 0);
                    if (addPrice) {
                      setPresetKitPrice(prev => String((parseFloat(prev) || 0) + addPrice));
                    }
                  }
                }}
                title="Add another set of this preset kit without replacing existing items"
                style={{
                  backgroundColor: '#EEF2FF',
                  border: '1px solid #818CF8',
                  color: '#4338CA',
                  fontSize: '11px',
                  fontWeight: '800',
                  height: '36px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                <Plus size={13} /> + Add Another Preset
              </button>
            )}

            {/* SET COUNT / MULTIPLIER INPUT */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', padding: '0 8px', borderRadius: '8px', height: '36px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>No. of Sets:</span>
              <input
                type="number"
                min="1"
                max="999"
                value={presetSetCount}
                onChange={(e) => {
                  const rawVal = e.target.value;
                  const newCount = rawVal === '' ? '' : Math.max(1, parseInt(rawVal) || 1);
                  setPresetSetCount(newCount);

                  const multiplier = parseInt(rawVal) || 1;
                  const targetPreset = activePresetsMap && activePresetsMap[selectedPreset] ? activePresetsMap[selectedPreset] : (VRM_HDG_PRESETS && VRM_HDG_PRESETS[selectedPreset]);
                  if (targetPreset && targetPreset.items) {
                    const baseItems = targetPreset.items;
                    setBomMaterialsList(baseItems.map(it => {
                      const baseQ = parseFloat(it.qty) || 1;
                      return {
                        ...it,
                        baseQty: baseQ,
                        qty: String(Math.round(baseQ * multiplier)),
                        rate: '0',
                        isPresetItem: true
                      };
                    }));
                  } else if (bomMaterialsList.length > 0) {
                    setBomMaterialsList(prev => prev.map(it => {
                      const baseQ = parseFloat(it.baseQty || it.qty) || 1;
                      return {
                        ...it,
                        baseQty: it.baseQty || baseQ,
                        qty: String(Math.round(baseQ * multiplier))
                      };
                    }));
                  }
                }}
                style={{
                  width: '54px',
                  height: '26px',
                  borderRadius: '6px',
                  border: '1px solid #94A3B8',
                  padding: '0 6px',
                  fontSize: '13px',
                  fontWeight: '800',
                  color: '#4F46E5',
                  textAlign: 'center',
                  outline: 'none',
                  backgroundColor: 'white'
                }}
              />
            </div>

            {/* Dedicated Preset Full Package Price Input */}
            {selectedPreset && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', padding: '0 10px', borderRadius: '8px', height: '36px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#4338CA', whiteSpace: 'nowrap' }}>Preset Full Price (₹):</span>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 25000"
                  value={presetKitPrice}
                  onChange={(e) => setPresetKitPrice(e.target.value)}
                  style={{ width: '100px', height: '26px', borderRadius: '6px', border: '1px solid #818CF8', padding: '0 8px', fontSize: '13px', fontWeight: '800', color: '#1E1B4B', textAlign: 'right', outline: 'none', backgroundColor: 'white' }}
                />
                {presetSetCount > 1 && presetKitPrice && (
                  <span style={{ fontSize: '11px', color: '#6366F1', fontWeight: '700' }}>
                    (Total: ₹{((parseFloat(presetKitPrice) || 0) * (parseInt(presetSetCount) || 1)).toLocaleString('en-IN')})
                  </span>
                )}
              </div>
            )}

            <button
              onClick={() => {
                if (selectedBomItemIndexes.length > 0) {
                  setBomMaterialsList(prev => prev.filter((_, idx) => !selectedBomItemIndexes.includes(idx)));
                  setSelectedBomItemIndexes([]);
                } else {
                  if (bomMaterialsList.length > 0) {
                    setShowClearConfirmModal(true);
                  }
                }
              }}
              title={selectedBomItemIndexes.length > 0 ? `Remove ${selectedBomItemIndexes.length} selected item(s)` : "Clear all order items"}
              style={{
                border: selectedBomItemIndexes.length > 0 ? '1px solid #EF4444' : '1px solid #FCA5A5',
                backgroundColor: selectedBomItemIndexes.length > 0 ? '#EF4444' : '#FEF2F2',
                color: selectedBomItemIndexes.length > 0 ? 'white' : '#EF4444',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                margin: 0,
                boxSizing: 'border-box',
                flexShrink: 0
              }}
            >
              <X style={{ width: '18px', height: '18px' }} />
            </button>
          </div>
        </div>

        {/* CLEAR CONFIRMATION POPUP MODAL */}
        {showClearConfirmModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, fontFamily: "'DM Sans', sans-serif" }}>
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
                <button
                  onClick={() => setShowClearConfirmModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setBomMaterialsList([]);
                    setSelectedPreset('');
                    setSelectedBomItemIndexes([]);
                    setShowClearConfirmModal(false);
                  }}
                  style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#DC2626', color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 4px rgba(220,38,38,0.2)' }}
                >
                  Clear All Items
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ color: '#475569', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '12px 14px', width: '30px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={bomMaterialsList.length > 0 && selectedBomItemIndexes.length === bomMaterialsList.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedBomItemIndexes(bomMaterialsList.map((_, idx) => idx));
                      } else {
                        setSelectedBomItemIndexes([]);
                      }
                    }}
                    style={{ accentColor: '#4F46E5', cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '12px 10px', fontWeight: '700', width: '25%' }}>
                  Product / Item <span style={{ color: '#EF4444' }}>*</span>
                </th>
                <th style={{ padding: '12px 10px', fontWeight: '700', width: '18%' }}>Description</th>
                <th style={{ padding: '12px 10px', fontWeight: '700', width: '10%' }}>UOM</th>
                <th style={{ padding: '12px 10px', fontWeight: '700', width: '8%', textAlign: 'center' }}>
                  Qty <span style={{ color: '#EF4444' }}>*</span>
                </th>
                <th style={{ padding: '12px 10px', fontWeight: '700', width: '11%' }}>Price (₹)</th>
                <th style={{ padding: '12px 10px', fontWeight: '700', width: '10%', textAlign: 'center' }}>GST Rate</th>
                <th style={{ padding: '12px 10px', fontWeight: '700', width: '11%', textAlign: 'right' }}>Taxable (₹)</th>
                <th style={{ padding: '12px 10px', fontWeight: '700', width: '11%', textAlign: 'right' }}>Total (₹)</th>
                <th style={{ padding: '12px 10px', fontWeight: '700', width: '4%', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {bomMaterialsList.map((item, i) => {
                const q = parseFloat(item.qty) || 0;
                const r = parseFloat(item.rate) || 0;
                const taxable = q * r;
                const gstPct = parseFloat(String(item.gstRate || '18%').replace('%', '')) || 18;
                const gstAmt = taxable * (gstPct / 100);
                const rowTot = taxable + gstAmt;
                const isChecked = selectedBomItemIndexes.includes(i);
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: isChecked ? '#EEF2FF' : 'transparent' }}>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBomItemIndexes(prev => [...prev, i]);
                          } else {
                            setSelectedBomItemIndexes(prev => prev.filter(idx => idx !== i));
                          }
                        }}
                        style={{ accentColor: '#4F46E5', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <TypeableProductSelect
                        value={item.name || ''}
                        itemsList={itemsList}
                        placeholder="Type or select product..."
                        accentColor="#4F46E5"
                        onChange={(val, matched) => {
                          const pName = matched ? matched.name : val;
                          const pCat = matched ? (matched.description || matched.category || item.category) : item.category;
                          const isSolar5 = is5PctSolarProduct(pName, pCat);
                          setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? {
                            ...mat,
                            name: pName,
                            rate: matched ? String(matched.price || matched.rate || mat.rate) : mat.rate,
                            uom: matched ? (matched.uom || matched.unit || mat.uom) : mat.uom,
                            mm: matched ? (matched.sections || mat.mm) : mat.mm,
                            category: pCat,
                            gstRate: isSolar5 ? '5%' : (mat.gstRate || '18%')
                          } : mat));
                        }}
                      />
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <input
                        type="text"
                        placeholder="Description"
                        value={item.category || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? { ...mat, category: val } : mat));
                        }}
                        style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 10px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </td>
                    {/* UOM Heading Input (Both Dropdown & Typeable) */}
                    <td style={{ padding: '12px 10px' }}>
                      <input
                        type="text"
                        list={`uom-list-${i}`}
                        placeholder="UOM"
                        value={item.uom || 'NOS'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? { ...mat, uom: val } : mat));
                        }}
                        style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 8px', fontSize: '12px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF', fontWeight: '600' }}
                      />
                      <datalist id={`uom-list-${i}`}>
                        <option value="NOS" />
                        <option value="SET" />
                        <option value="KG" />
                        <option value="MTR" />
                        <option value="PCS" />
                        <option value="BOX" />
                        <option value="PKT" />
                        <option value="PAIR" />
                      </datalist>
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <input
                        type="number"
                        value={item.qty}
                        placeholder="0"
                        onChange={(e) => {
                          const val = e.target.value;
                          setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? { ...mat, qty: val } : mat));
                        }}
                        style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 8px', fontSize: '13px', textAlign: 'center', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      {selectedPreset && (item.isPresetItem || parseFloat(item.rate || 0) === 0) ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '38px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '0 8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534' }}>Included in Preset</span>
                        </div>
                      ) : (
                        <input
                          type="number"
                          value={item.rate}
                          placeholder="0.00"
                          onChange={(e) => {
                            const val = e.target.value;
                            setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? { ...mat, rate: val } : mat));
                          }}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 10px', fontSize: '13px', textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                        />
                      )}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <select
                        value={item.gstRate || newBomGstRate || '18%'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBomMaterialsList(prev => prev.map((mat, idx) =>
                            (item.isPresetItem ? (mat.isPresetItem || idx === i) : idx === i) ? { ...mat, gstRate: val } : mat
                          ));
                          if (item.isPresetItem) setNewBomGstRate(val);
                        }}
                        style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #C7D2FE', padding: '0 6px', fontSize: '12px', fontWeight: '700', color: '#4338CA', backgroundColor: '#EEF2FF', outline: 'none', cursor: 'pointer', textAlign: 'center' }}
                      >
                        <option value="18%">18% GST</option>
                        <option value="12%">12% GST</option>
                        <option value="5%">5% GST</option>
                        <option value="0%">0% Exempt</option>
                      </select>
                    </td>
                    <td style={{ padding: '12px 10px', color: '#475569', textAlign: 'right', fontWeight: '600' }}>
                      {selectedPreset && (item.isPresetItem || parseFloat(item.rate || 0) === 0) ? (
                        <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: '700' }}>In Preset</span>
                      ) : (
                        `₹${taxable.toFixed(2)}`
                      )}
                    </td>
                    <td style={{ padding: '12px 10px', fontWeight: 'bold', color: '#0F172A', textAlign: 'right' }}>
                      {selectedPreset && (item.isPresetItem || parseFloat(item.rate || 0) === 0) ? (
                        <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: '700' }}>In Preset</span>
                      ) : (
                        `₹${rowTot.toFixed(2)}`
                      )}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleRemoveMaterialRow(i)}
                        style={{ border: 'none', background: '#FEF2F2', color: '#EF4444', borderRadius: '6px', padding: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 style={{ width: '15px', height: '15px' }} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div>
          <button
            onClick={handleAddMaterialRow}
            style={{ border: '1px solid #E0E7FF', background: '#EEF2FF', color: '#4F46E5', padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus style={{ width: '15px', height: '15px' }} />
            Add Product / Item
          </button>
        </div>
      </div>

      {/* SECTION 4: TRANSPORT & LOGISTICS DETAILS */}
      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#4F46E5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
            4
          </div>
          <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#4F46E5', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            TRANSPORT & LOGISTICS DETAILS
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Mode of Transport <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              list="transport-mode-suggestions"
              value={newBomTransportMode}
              onChange={(e) => setNewBomTransportMode(e.target.value)}
              placeholder="Type/Select (Transport, Lorry, Courier...)"
              style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none' }}
            />
            <datalist id="transport-mode-suggestions">
              <option value="Transport" />
              <option value="Lorry" />
              <option value="Courier" />
              <option value="Tempo / Mini Truck" />
              <option value="Air Cargo" />
              <option value="Train / Rail Cargo" />
              <option value="Customer Pickup / Self" />
              <option value="Dedicated Container" />
            </datalist>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Transport Name
            </label>
            <input
              type="text"
              value={newBomTransporterName}
              onChange={(e) => setNewBomTransporterName(e.target.value)}
              placeholder="e.g. VRL Logistics / TCI Freight / Local Transport"
              style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* SECTION 5: PAYMENT TERMS & FINANCIAL SUMMARY */}
      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#4F46E5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
            5
          </div>
          <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#4F46E5', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            PAYMENT TERMS & ORDER SUMMARY
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Payment Terms</label>
              <select
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
                <option value="Partial Payment">Partial Payment</option>
                <option value="Payment While Dispatch">Payment While Dispatch</option>
                <option value="Credit Payment">Credit Payment</option>
              </select>
            </div>

            {newBomPaymentType === 'Partial Payment' && (
              <div style={{ backgroundColor: '#F0FDFA', border: '1.5px solid #99F6E4', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#0F766E' }}>
                    Advance Paid Amount (₹) *
                  </label>
                  <span style={{ fontSize: '11px', color: '#0D9488', fontWeight: '700' }}>
                    Total Order: ₹{Number(totals.grand || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <input
                      type="number"
                      min="0"
                      max={totals.grand || 9999999}
                      value={newBomPartialAmount}
                      onChange={(e) => setNewBomPartialAmount(e.target.value)}
                      placeholder="e.g. 50000"
                      style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #5EEAD4', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none', fontWeight: '700' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #CCFBF1', padding: '0 14px', height: '42px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Remaining Balance</span>
                    <strong style={{ fontSize: '13px', color: '#0F766E' }}>
                      ₹{Math.max(0, (totals.grand || 0) - (parseFloat(newBomPartialAmount) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: '#0D9488' }}>
                  Record advance payment amount now. Balance payment proof can be uploaded anytime via Payment Details button.
                </span>
              </div>
            )}

            {newBomPaymentType === 'Credit Payment' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                    Credit Timeline (Days)
                  </label>
                  <span style={{ fontSize: '11px', color: '#4F46E5', fontWeight: '700' }}>
                    Default: 7 Days
                  </span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={newBomCreditDays}
                  onChange={(e) => setNewBomCreditDays(Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder="7"
                  style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #C7D2FE', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: '#F5F3FF', boxSizing: 'border-box', outline: 'none', fontWeight: '700' }}
                />
                <span style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'block' }}>
                  Sales follow-up notifications will trigger across the {newBomCreditDays}-day credit cycle.
                </span>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Remarks / Notes</label>
              <textarea
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
                  Payment slip is not required upfront. Salesperson will receive continuous notification reminders. Once payment is received, attach payment details via <strong>3-dot menu → Update Payment</strong> (one-time lock).
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '700', color: '#6D28D9', backgroundColor: '#DDD6FE', padding: '6px 12px', borderRadius: '8px', width: 'fit-content' }}>
                  <Bell style={{ width: '12px', height: '12px' }} /> Automated Sales Payment Tracking Enabled
                </div>
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
                  BOM will proceed with production immediately. When Dispatch finishes packing and forwards to Accounts, an automated alert will notify the Salesperson to attach the payment receipt. Accounts will confirm and release for Invoicing only after proof is attached.
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '700', color: '#1E40AF', backgroundColor: '#DBEAFE', padding: '6px 12px', borderRadius: '8px', width: 'fit-content' }}>
                  <Bell style={{ width: '12px', height: '12px' }} /> Notification to Sales Triggered on Dispatch Packing
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                    Payment Attachment / Slip <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  {newBomPaymentProofDoc && (
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle style={{ width: '12px', height: '12px' }} /> Attached
                    </span>
                  )}
                </div>

                {newBomPaymentProofDoc ? (
                  <div style={{ border: '1px solid #86EFAC', borderRadius: '12px', padding: '16px', backgroundColor: '#F0FDF4', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#DCFCE7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileCheck style={{ width: '18px', height: '18px' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>{newBomPaymentProofDoc.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{newBomPaymentProofDoc.size || '1.2 MB'} • Payment Document Attached</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setPreviewDocModal({ title: 'Payment Proof Document', doc: newBomPaymentProofDoc })}
                          style={{ border: '1px solid #BBF7D0', background: '#DCFCE7', color: '#166534', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Eye style={{ width: '13px', height: '13px' }} /> View Image
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewBomPaymentProofDoc(null)}
                          style={{ border: 'none', background: '#FEE2E2', color: '#DC2626', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Trash2 style={{ width: '13px', height: '13px' }} /> Remove
                        </button>
                      </div>
                    </div>
                    {newBomPaymentProofDoc.dataUrl && (
                      <div style={{ borderTop: '1px solid #BBF7D0', paddingTop: '10px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '10px' }}>
                        <img src={newBomPaymentProofDoc.dataUrl} alt="Payment Proof Preview" style={{ maxHeight: '160px', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files && e.dataTransfer.files[0];
                      if (file) {
                        compressAndSaveFile(file, (res) => {
                          if (res) {
                            if (res.name && res.dataUrl) saveMediaToCache(res.name, res.dataUrl);
                            setNewBomPaymentProofDoc(res);
                          }
                        });
                      }
                    }}
                    style={{ border: '2px dashed #CBD5E1', borderRadius: '12px', padding: '24px 16px', textAlign: 'center', backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}
                  >
                    <UploadCloud style={{ width: '34px', height: '34px', color: '#6366F1' }} />
                    <span style={{ fontSize: '13px', color: '#475569', fontWeight: '600' }}>
                      Drag & drop payment slip / bank advice here or
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <label style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4F46E5',
                        padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
                        cursor: 'pointer'
                      }}>
                        <Upload style={{ width: '13px', height: '13px' }} />
                        Browse Files
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const file = e.target.files && e.target.files[0];
                            if (file) {
                              compressAndSaveFile(file, (res) => {
                                if (res) {
                                  if (res.name && res.dataUrl) saveMediaToCache(res.name, res.dataUrl);
                                  setNewBomPaymentProofDoc(res);
                                }
                              });
                            }
                          }}
                        />
                      </label>
                    </div>

                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                      Supported formats: PDF, JPG, PNG (Max 5MB)
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Subtotals & GST Tax Calculation Breakdown */}
        <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', fontSize: '13px' }}>
          {selectedPreset && totals.kitSubtotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '320px', color: '#4338CA', backgroundColor: '#EEF2FF', padding: '6px 10px', borderRadius: '6px' }}>
              <span style={{ fontWeight: '700' }}>Preset ({presetSetCount} Set{presetSetCount > 1 ? 's' : ''})</span>
              <strong style={{ color: '#3730A3' }}>₹{totals.kitSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '320px', color: '#4338CA', fontWeight: '700', backgroundColor: '#EEF2FF', padding: '6px 10px', borderRadius: '6px' }}>
            <span>Total Applicable GST (18%)</span>
            <span>₹{totals.gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '320px', color: '#0F172A', fontSize: '17px', fontWeight: '800', borderTop: '1px solid #E2E8F0', paddingTop: '10px', marginTop: '4px' }}>
            <span>Grand Total (Incl. GST)</span>
            <span style={{ color: '#4F46E5' }}>₹{totals.grand.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* BOTTOM ACTION BUTTON BAR */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '20px', marginTop: '10px' }}>
          <button
            onClick={() => setBomConfirmModal('cancel')}
            style={{ border: '1px solid #CBD5E1', background: 'white', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', color: '#475569', cursor: 'pointer' }}
          >
            Cancel
          </button>

          <button
            onClick={() => setBomConfirmModal('draft')}
            style={{ border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#4F46E5', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileText style={{ width: '15px', height: '15px' }} />
            Save as Draft
          </button>

          <button
            onClick={() => {
              if (!newBomProductName || !newBomProductName.trim()) {
                alert('⚠️ Please select or enter a Customer Name before creating the BOM order.');
                return;
              }
              if (!bomMaterialsList || bomMaterialsList.length === 0) {
                alert('⚠️ Please add at least one Product / Item to the BOM materials list.');
                return;
              }
              setBomConfirmModal('create');
            }}
            style={{ border: 'none', background: '#10B981', color: 'white', padding: '10px 24px', borderRadius: '10px', fontSize: '13px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            Create Order →
          </button>
        </div>
      </div>

      {/* CONFIRMATION POPUP OVERLAY MODAL */}
      {bomConfirmModal && (
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
          zIndex: 99999,
          fontFamily: "'DM Sans', sans-serif"
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '440px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: bomConfirmModal === 'cancel' ? '#FEE2E2' : bomConfirmModal === 'draft' ? '#EEF2FF' : '#DCFCE7',
                color: bomConfirmModal === 'cancel' ? '#DC2626' : bomConfirmModal === 'draft' ? '#4F46E5' : '#166534',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 'bold',
                flexShrink: 0
              }}>
                {bomConfirmModal === 'cancel' ? (
                  <AlertCircle size={22} />
                ) : bomConfirmModal === 'draft' ? (
                  <FileText size={22} />
                ) : (
                  <CheckCircle size={22} />
                )}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0F172A' }}>
                  {bomConfirmModal === 'cancel' && 'Discard BOM Order?'}
                  {bomConfirmModal === 'draft' && 'Save BOM as Draft?'}
                  {bomConfirmModal === 'create' && 'Confirm BOM Order Creation?'}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B', lineHeight: '1.4' }}>
                  {bomConfirmModal === 'cancel' && 'Are you sure you want to cancel? Any unsaved changes entered in this BOM form will be lost.'}
                  {bomConfirmModal === 'draft' && 'Save this Bill of Materials as a draft order so you can review and update it later?'}
                  {bomConfirmModal === 'create' && `Are you sure you want to finalize and create BOM Order (${newBomCode})?`}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <button
                onClick={() => setBomConfirmModal(null)}
                style={{
                  border: '1px solid #CBD5E1',
                  backgroundColor: 'white',
                  color: '#475569',
                  padding: '9px 18px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Go Back
              </button>

              <button
                onClick={async () => {
                  if (bomConfirmModal === 'cancel') {
                    setShowBOMForm(false);
                    setBomConfirmModal(null);
                    setSelectedPreset('');
                    setPresetKitPrice('');
                    setPresetSetCount(1);
                    setNewBomBillingStreet('');
                    setNewBomBillingCity('');
                    setNewBomBillingState('');
                    setNewBomBillingPincode('');
                    setNewBomDeliveryStreet('');
                    setNewBomDeliveryCity('');
                    setNewBomDeliveryState('');
                    setNewBomDeliveryPincode('');
                    setSameAsBilling(false);
                  } else if (bomConfirmModal === 'draft' || bomConfirmModal === 'create') {
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
                    const bStreet = newBomBillingStreet || bObj.address || selCust?.c6 || selCust?.billingAddress || selCust?.address || '';
                    const bCity = newBomBillingCity || bObj.city || selCust?.city || '';
                    const bState = newBomBillingState || bObj.state || selCust?.state || '';
                    const bPin = newBomBillingPincode || bObj.pincode || selCust?.pincode || '';

                    const formatAddr = (st, ct, sta, pin) => {
                      const parts = [st, ct, sta, pin ? `Pincode: ${pin}` : ''].filter(Boolean);
                      return parts.join(', ');
                    };

                    const billingObj = { address: bStreet, city: bCity, state: bState, pincode: bPin };

                    const billingFull = formatAddr(bStreet, bCity, bState, bPin) || selCust?.c6 || selCust?.billingAddress || selCust?.address || '-';
                    const deliveryFull = sameAsBilling
                      ? billingFull
                      : (formatAddr(newBomDeliveryStreet, newBomDeliveryCity, newBomDeliveryState, newBomDeliveryPincode) || newBomDeliveryAddress || '-');

                    const deliveryObj = sameAsBilling
                      ? { address: bStreet, city: bCity, state: bState, pincode: bPin }
                      : { address: newBomDeliveryStreet, city: newBomDeliveryCity, state: newBomDeliveryState, pincode: newBomDeliveryPincode };

                    // BOM code is strictly assigned atomically upon submission
                    const finalCode = 'BOM-PENDING';

                    const effectiveSalesPersonName = (() => {
                      const stored = localStorage.getItem('controlroom_logged_user_name');
                      if (stored && stored.trim() && stored !== 'undefined' && stored !== 'null') return stored.trim();
                      const storedUser = localStorage.getItem('controlroom_logged_user');
                      if (storedUser && storedUser.trim() && storedUser !== 'undefined' && storedUser !== 'null') return storedUser.trim();
                      if (userRole === 'Sales Head') return 'Vijay';
                      if (userRole === 'Accounts Head') return 'Venkatesh';
                      if (userRole === 'Accounts Executive') return 'Priya';
                      if (userRole === 'Technical Administrator' || userRole === 'CEO') return 'Annamalaiyar';
                      return userRole || 'Sales Executive';
                    })();
                    const effectiveSalesPersonCode = (localStorage.getItem('controlroom_logged_emp_id') || '').trim();

                    const hasPaymentProof = Boolean(newBomPaymentProofDoc);
                    const newBomRecord = {
                      id: finalCode,
                      bomCode: finalCode,
                      code: finalCode,
                      date: new Date().toISOString().split('T')[0],
                      customerName: selCust?.c2 || selCust?.companyName || selCust?.customerName || selCust?.code || newBomProductName || 'Customer Order',
                      companyName: selCust?.c2 || selCust?.companyName || selCust?.customerName || selCust?.code || newBomProductName || '-',
                      mobile: selCust?.c4 || selCust?.primaryContact?.phone || selCust?.phone || selCust?.primaryContact?.whatsapp || '-',
                      email: selCust?.c5 || selCust?.primaryContact?.email || selCust?.email || '-',
                      billingAddress: billingFull,
                      billingAddressObj: billingObj,
                      deliveryAddress: deliveryFull,
                      deliveryAddressObj: deliveryObj,
                      deliveryAddressProofDoc: sameAsBilling ? null : (newBomDeliveryProofDoc || null),
                      transportMode: newBomTransportMode || 'Transport',
                      transporterName: newBomTransporterName || '',
                      vehicleNo: newBomVehicleNo || '',
                      lrNo: newBomLrNo || '',
                      paymentType: newBomPaymentType || '100% Paid',
                      partialAmount: newBomPaymentType === 'Partial Payment' ? (parseFloat(newBomPartialAmount) || 0) : null,
                      balanceAmount: newBomPaymentType === 'Partial Payment' ? Math.max(0, (totals.grand || 0) - (parseFloat(newBomPartialAmount) || 0)) : (newBomPaymentType === '100% Paid' ? 0 : totals.grand),
                      creditDays: newBomPaymentType === 'Credit Payment' ? (parseInt(newBomCreditDays) || 7) : null,
                      creditDueDate: newBomPaymentType === 'Credit Payment' ? new Date(Date.now() + (parseInt(newBomCreditDays) || 7) * 86400000).toISOString().split('T')[0] : null,
                      paymentProofDoc: newBomPaymentProofDoc || null,
                      paymentUpdated: (newBomPaymentType === '100% Paid' || newBomPaymentType === 'Partial Payment') && Boolean(newBomPaymentProofDoc),
                      remarks: newBomRemarks || '',
                      status: isDraft ? 'Draft' : 'Sales Confirmed - Sent to Dispatch',
                      salesConfirmed: !isDraft,
                      salesConfirmedAt: !isDraft ? new Date().toISOString() : null,
                      salesPerson: effectiveSalesPersonName,
                      salesPersonCode: effectiveSalesPersonCode,
                      createdBy: effectiveSalesPersonName,
                      createdById: effectiveSalesPersonCode,
                      items: (bomMaterialsList || []).map(item => ({
                        name: item.name || 'Custom Item',
                        category: item.category || '',
                        uom: item.uom || 'NOS',
                        qty: cleanNum(item.qty, 1),
                        rate: cleanNum(item.rate, 0),
                        gstRate: item.gstRate || newBomGstRate || '18%',
                        confirmed: !isDraft
                      })),
                      payments: {
                        advance50Uploaded: false,
                        dispatch50Uploaded: false,
                        advance100Uploaded: newBomPaymentType === '100% Paid' && hasPaymentProof,
                        net30Uploaded: false,
                        proofDoc: newBomPaymentProofDoc ? newBomPaymentProofDoc.name : null,
                        proofDocObj: newBomPaymentProofDoc || null,
                        paymentUpdated: newBomPaymentType === '100% Paid' && Boolean(newBomPaymentProofDoc)
                      },
                      dispatchPacking: (bomMaterialsList || []).map(item => ({
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
                      presetName: selectedPreset || null,
                      presetKitPrice: (selectedPreset && presetKitPrice !== '') ? cleanNum(presetKitPrice, null) : null,
                      presetSetCount: selectedPreset ? (parseInt(String(presetSetCount).replace(/[^0-9]/g, '')) || 1) : null,
                      subTotal: cleanNum(totals.sub, 0),
                      gstAmount: cleanNum(totals.gst, 0),
                      cgstAmount: cleanNum(totals.cgst, 0),
                      sgstAmount: cleanNum(totals.sgst, 0),
                      grandTotal: cleanNum(totals.grand, 0)
                    };

                    let sanitizedNewBom = stripDataUrlsFromRecord(newBomRecord);

                    let finalAssignedCode = finalCode;
                    if (!isDraft) {
                      try {
                        const reserved = await getAndReserveNextBomCode(true);
                        if (reserved && /^BOM-\d+$/i.test(reserved)) {
                          finalAssignedCode = reserved;
                        }
                      } catch (err) {
                        console.error('Error reserving atomic BOM code:', err);
                      }
                    }
                    sanitizedNewBom.bomCode = finalAssignedCode;
                    sanitizedNewBom.code = finalAssignedCode;
                    sanitizedNewBom.id = finalAssignedCode;

                    let sResOk = false;
                    const postPayload = JSON.stringify({ bom: sanitizedNewBom, isNew: !isDraft });
                    const endpoints = ['/api/boms', 'http://localhost:5001/api/boms'];
                    for (const url of endpoints) {
                      try {
                        const sRes = await fetch(url, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: postPayload
                        });
                        if (sRes.ok) {
                          const sData = await sRes.json();
                          if (sData && (sData.bomCode || sData.bom?.bomCode) && sData.success) {
                            sResOk = true;
                            finalAssignedCode = sData.bomCode || sData.bom?.bomCode;
                            sanitizedNewBom.bomCode = finalAssignedCode;
                            sanitizedNewBom.code = finalAssignedCode;
                            sanitizedNewBom.id = finalAssignedCode;
                            break;
                          }
                        }
                      } catch (err) {
                        console.warn(`Sync attempt to ${url} failed, trying next:`, err);
                      }
                    }

                    // Deduct / Reserve Stock in Central Inventory & Raw Materials Stores immediately
                    try {
                      centralInventoryStore.deductStockForBOM(finalAssignedCode, sanitizedNewBom.items, sanitizedNewBom.salesPerson || 'Sales Executive');
                    } catch (cErr) {
                      console.warn('Central store deduction error in CreateBomFormPage:', cErr);
                    }

                    // If BOM originates from a converted Proforma Invoice, mark the PI as converted to avoid double-allocation
                    const srcPi = sanitizedNewBom.sourcePiNo;
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
                                convertedBomCode: finalAssignedCode,
                                convertedDate: new Date().toISOString()
                              } : pi);
                              localStorage.setItem(storeKey, JSON.stringify(updated));
                              saveCloudStoreImmediate('sales_pi_store', updated);
                            }
                          }
                        } catch (_) {}
                      };
                      updatePiList('controlroom_sales_pi_store');
                      updatePiList('controlroom_procurement_pi_store');
                      try {
                        window.dispatchEvent(new CustomEvent('controlroom_pi_store_updated', { detail: { piNo: srcPi, bomCode: finalAssignedCode } }));
                      } catch (_) {}
                    }

                    setBomStore(prev => {
                      const current = Array.isArray(prev) ? prev : [];
                      const filtered = current.filter(item => item && (item.bomCode !== finalAssignedCode && item.code !== finalAssignedCode));
                      const combined = [sanitizedNewBom, ...filtered];
                      const { list: updatedList } = resolveBomCollisions(combined, 658);

                      // Direct cloud persistence guarantee: ALWAYS save directly to Supabase cloud store so it is never lost on refresh or live server
                      try {
                        saveCloudStoreImmediate('bom_store', updatedList);
                      } catch (sErr) {
                        console.error('Error in direct saveCloudStoreImmediate:', sErr);
                      }
                      try {
                        localStorage.setItem('controlroom_bom_store', JSON.stringify(updatedList.map(stripDataUrlsFromRecord)));
                      } catch (_) {}

                      setShowBOMForm(false);
                      setBomConfirmModal(null);
                      setCurrentPage(1);
                      try {
                        window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: { bom: sanitizedNewBom } }));
                        window.dispatchEvent(new Event('central_inventory_updated'));
                        window.dispatchEvent(new Event('controlroom_raw_materials_update'));
                        window.dispatchEvent(new Event('controlroom_storage_update'));
                        window.dispatchEvent(new Event('storage'));
                      } catch (e) { }
                      return updatedList;
                    });

                    if (!isDraft) {
                      notifyBomSentToDispatch({
                        bomCode: finalAssignedCode,
                        customerName: sanitizedNewBom.companyName || sanitizedNewBom.customerName,
                        salesPerson: sanitizedNewBom.salesPerson
                      });
                      alert(`✅ BOM (${finalAssignedCode}) created successfully and sent to Dispatch for packing!`);
                    } else {
                      alert(`📝 BOM (${finalAssignedCode}) saved as Draft.`);
                    }

                    setNewBomPaymentProofDoc(null);
                    setNewBomDeliveryProofDoc(null);
                    setNewBomRemarks('');
                    setNewBomTransporterName('');
                    setNewBomVehicleNo('');
                    setNewBomLrNo('');
                    setNewBomCreditDays(7);
                    setNewBomPaymentType('100% Paid');
                    setNewBomProductName('');
                    setBomMaterialsList([]);
                    setSelectedPreset('');
                    setPresetKitPrice('');
                    setPresetSetCount(1);
                    setNewBomCode('');
                    setNewBomBillingStreet('');
                    setNewBomBillingCity('');
                    setNewBomBillingState('');
                    setNewBomBillingPincode('');
                    setNewBomDeliveryStreet('');
                    setNewBomDeliveryCity('');
                    setNewBomDeliveryState('');
                    setNewBomDeliveryPincode('');
                    setSameAsBilling(false);
                    setShowBOMForm(false);
                    setBomConfirmModal(null);
                  }
                }}
                style={{
                  border: 'none',
                  backgroundColor: bomConfirmModal === 'cancel' ? '#DC2626' : bomConfirmModal === 'draft' ? '#4F46E5' : '#166534',
                  color: 'white',
                  padding: '9px 20px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                {bomConfirmModal === 'cancel' && 'Yes, Discard'}
                {bomConfirmModal === 'draft' && 'Yes, Save Draft'}
                {bomConfirmModal === 'create' && 'Yes, Confirm & Create'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
