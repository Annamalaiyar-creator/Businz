import React from "react";
import {
  Plus, Trash2, Eye, FileText, AlertCircle, AlertTriangle, X,
  CheckCircle, Clock, FileCheck, UploadCloud, Truck, Package,
  ShoppingCart, Upload, Layers, Image, Bell, Save
} from "lucide-react";
import {
  cleanNum, stripDataUrlsFromRecord, compressAndSaveFile, saveMediaToCache, normalizePaymentTerm
} from "../../utils/otherViewsShared";
import { uploadBomDocumentFile, validateClientFile } from "../../utils/bomStorageClient";
import { saveCloudStoreImmediate, saveCloudBomRow } from "../../utils/supabaseDataSync";
import { centralInventoryStore } from "../../utils/centralInventoryStore";
import { getFullProductsCatalogWithStock } from "../../utils/productCatalogService";
import { resolveProductCode, normalizeProductName } from "../../utils/vrmProductsData";
import SearchablePresetSelector from "../SearchablePresetSelector";
import TypeableProductSelect from "../TypeableProductSelect";
import { getNextSequence } from "../../utils/sequenceGenerator";
import { isFixedQuantityPreset, VRM_HDG_PRESETS } from "../../vrmHdgProposalPresets";
import { notifyBomSentToDispatch, notifyBomCreatedToSales } from "../../services/notificationService";

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
    newBomTransporterName, setNewBomTransporterName, newBomDestination, setNewBomDestination, newBomVehicleNo, setNewBomVehicleNo,
    newBomLrNo, setNewBomLrNo, newBomGstRate, setNewBomGstRate, activePresetsMap,
    selectedPreset, setSelectedPreset, presetSetCount, setPresetSetCount,
    presetKitPrice, setPresetKitPrice, setPreviewDocModal,
    selectedBomItemIndexes, setSelectedBomItemIndexes,
    showClearConfirmModal, setShowClearConfirmModal,
    bomConfirmModal, setBomConfirmModal, showCustomAlert
  } = props;
  const [newBomPartialAmount, setNewBomPartialAmount] = React.useState(props.newBomPartialAmount || '');

  // Normalize multi-image proofs for Delivery Address and Payment (target: at least 4 images)
  const deliveryDocs = React.useMemo(() => {
    if (!newBomDeliveryProofDoc) return [];
    return Array.isArray(newBomDeliveryProofDoc) ? newBomDeliveryProofDoc : [newBomDeliveryProofDoc];
  }, [newBomDeliveryProofDoc]);

  const paymentDocs = React.useMemo(() => {
    if (!newBomPaymentProofDoc) return [];
    return Array.isArray(newBomPaymentProofDoc) ? newBomPaymentProofDoc : [newBomPaymentProofDoc];
  }, [newBomPaymentProofDoc]);

  const handleUploadDeliveryProofFiles = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    files.forEach((file) => {
      try {
        validateClientFile(file);
        compressAndSaveFile(file, (res) => {
          if (res) {
            if (res.name && res.dataUrl) saveMediaToCache(res.name, res.dataUrl);
            const docObj = {
              ...res,
              _rawFile: file,
              dataUrl: res.dataUrl || null,
              previewUrl: res.dataUrl || (typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : null)
            };
            setNewBomDeliveryProofDoc(prev => {
              const current = Array.isArray(prev) ? prev : (prev ? [prev] : []);
              if (current.some(d => d.name === docObj.name && d.size === docObj.size)) return current;
              return [...current, docObj];
            });
          }
        });
      } catch (err) {
        alert(`⚠️ Cannot Proceed with ${file.name}: ${err.message}`);
      }
    });
  };

  const handleRemoveDeliveryDoc = (index) => {
    setNewBomDeliveryProofDoc(prev => {
      const current = Array.isArray(prev) ? prev : (prev ? [prev] : []);
      const updated = current.filter((_, i) => i !== index);
      return updated.length > 0 ? updated : null;
    });
  };

  const handleUploadPaymentProofFiles = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    files.forEach((file) => {
      try {
        validateClientFile(file);
        compressAndSaveFile(file, (res) => {
          if (res) {
            if (res.name && res.dataUrl) saveMediaToCache(res.name, res.dataUrl);
            const docObj = {
              ...res,
              _rawFile: file,
              dataUrl: res.dataUrl || null,
              previewUrl: res.dataUrl || (typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : null)
            };
            setNewBomPaymentProofDoc(prev => {
              const current = Array.isArray(prev) ? prev : (prev ? [prev] : []);
              if (current.some(d => d.name === docObj.name && d.size === docObj.size)) return current;
              return [...current, docObj];
            });
            if (setBomFormErrors) {
              setBomFormErrors(prev => ({ ...prev, paymentProof: null }));
            }
          }
        });
      } catch (err) {
        alert(`⚠️ Cannot Proceed with ${file.name}: ${err.message}`);
      }
    });
  };

  const handleRemovePaymentDoc = (index) => {
    setNewBomPaymentProofDoc(prev => {
      const current = Array.isArray(prev) ? prev : (prev ? [prev] : []);
      const updated = current.filter((_, i) => i !== index);
      return updated.length > 0 ? updated : null;
    });
  };

  // Live unified catalog with real-time stock balances
  const [itemsList, setItemsList] = React.useState(() => {
    return Array.isArray(props.itemsList) && props.itemsList.length > 0
      ? props.itemsList
      : getFullProductsCatalogWithStock();
  });

  React.useEffect(() => {
    let timer = null;
    const refreshCatalog = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setItemsList(getFullProductsCatalogWithStock());
      }, 300);
    };
    window.addEventListener('central_inventory_updated', refreshCatalog);
    window.addEventListener('controlroom_items_update', refreshCatalog);
    window.addEventListener('controlroom_raw_materials_update', refreshCatalog);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('central_inventory_updated', refreshCatalog);
      window.removeEventListener('controlroom_items_update', refreshCatalog);
      window.removeEventListener('controlroom_raw_materials_update', refreshCatalog);
    };
  }, []);

  const stockLookupMap = React.useMemo(() => {
    const map = new Map();
    (itemsList || []).forEach(p => {
      const st = Number(p.stock !== undefined ? p.stock : (p.availableStock !== undefined ? p.availableStock : 0));
      const code = String(p.code || '').toLowerCase().trim();
      const name = String(p.name || '').toLowerCase().trim();
      const norm = normalizeProductName(p.name);
      if (code && !map.has(code)) map.set(code, st);
      if (name && !map.has(name)) map.set(name, st);
      if (norm && !map.has(norm)) map.set(norm, st);
      const resCode = resolveProductCode(p).toLowerCase().trim();
      if (resCode && !map.has(resCode)) map.set(resCode, st);
    });
    return map;
  }, [itemsList]);

  const getItemStock = (itemName, itemCode) => {
    if (!itemName && !itemCode) return null;
    const cleanCode = (itemCode || '').toLowerCase().trim();
    if (cleanCode && stockLookupMap.has(cleanCode)) return stockLookupMap.get(cleanCode);
    const cleanName = (itemName || '').toLowerCase().trim();
    if (cleanName && stockLookupMap.has(cleanName)) return stockLookupMap.get(cleanName);
    const normName = normalizeProductName(itemName);
    if (normName && stockLookupMap.has(normName)) return stockLookupMap.get(normName);
    const resolvedCode = resolveProductCode({ name: itemName, code: itemCode }).toLowerCase().trim();
    if (resolvedCode && stockLookupMap.has(resolvedCode)) return stockLookupMap.get(resolvedCode);
    return null;
  };

  const calculateBOMTotals = () => {
    const kitUnitPrice = (selectedPreset && presetKitPrice !== '') ? cleanNum(presetKitPrice, 0) : 0;
    const kitMultiplier = parseInt(String(presetSetCount).replace(/[^0-9]/g, '')) || 1;
    const kitSubtotal = selectedPreset ? (kitUnitPrice * kitMultiplier) : 0;

    const itemsSub = (bomMaterialsList || []).reduce((acc, item) => {
      if (selectedPreset && (item.isPresetItem || item.presetGroupId)) return acc;
      const q = cleanNum(item.qty, 0);
      const r = cleanNum(item.rate, 0);
      return acc + (q * r);
    }, 0);

    const sub = itemsSub + kitSubtotal;
    const disc = 0;

    const itemsGst = (bomMaterialsList || []).reduce((acc, item) => {
      if (selectedPreset && (item.isPresetItem || item.presetGroupId)) return acc;
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
            <label htmlFor="create-bom-form-order-date" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Order Date</label>
            <div style={{ position: 'relative' }}>
              <input id="create-bom-form-order-date" name="orderDate" aria-label="Order Date"
                type="date"
                value={new Date().toISOString().split('T')[0]}
                disabled
                readOnly
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#64748B', backgroundColor: '#F1F5F9', cursor: 'not-allowed', boxSizing: 'border-box', outline: 'none' }}
               />
            </div>
          </div>

          <div>
            <label htmlFor="prod-field-newBomDeliveryDate" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Delivery Date <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input name="deliveryDate" aria-label="Delivery Date"
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
            <label htmlFor="create-bom-form-order-number" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Order Number</label>
            <input id="create-bom-form-order-number" name="orderNumber" aria-label="Order Number"
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
            <label htmlFor="prod-field-newBomProductName" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Customer Name <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ width: '100%' }}>
              <input name="customerName" aria-label="Customer Name"
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
                  <label htmlFor="create-bom-form-company-name" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Company Name</label>
                  <input id="create-bom-form-company-name" name="companyName" aria-label="Company Name" type="text" value={companyName} readOnly style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#64748B', backgroundColor: '#F8FAFC', boxSizing: 'border-box', outline: 'none' }}  />
                </div>
                <div>
                  <label htmlFor="create-bom-form-mobile-number" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Mobile Number</label>
                  <input id="create-bom-form-mobile-number" name="mobileNumber" aria-label="Mobile Number" type="text" value={mobileNo} readOnly style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#64748B', backgroundColor: '#F8FAFC', boxSizing: 'border-box', outline: 'none' }}  />
                </div>
                <div>
                  <label htmlFor="create-bom-form-email" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Email</label>
                  <input id="create-bom-form-email" name="email" aria-label="Email" type="text" value={emailAddr} readOnly style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#64748B', backgroundColor: '#F8FAFC', boxSizing: 'border-box', outline: 'none' }}  />
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
                    <label htmlFor="create-bom-form-input-1" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>
                      Address (Street / Building / Area)
                    </label>
                    <input id="create-bom-form-input-1" name="input1" aria-label="Address (Street / Building / Area)"
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
                      <label htmlFor="create-bom-form-city" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                      <input id="create-bom-form-city" name="city" aria-label="City"
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
                      <label htmlFor="create-bom-form-state" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                      <input id="create-bom-form-state" name="state" aria-label="State"
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
                      <label htmlFor="create-bom-form-pincode" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pincode</label>
                      <input id="create-bom-form-pincode" name="pincode" aria-label="Pincode"
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

                    <label htmlFor="create-bom-form-same-as-billing" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#4F46E5', cursor: 'pointer', backgroundColor: '#EEF2FF', padding: '4px 10px', borderRadius: '8px', border: '1px solid #C7D2FE' }}>
                      <input id="create-bom-form-same-as-billing" name="sameAsBilling" aria-label="SameAsBilling"
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
                    <label htmlFor="create-bom-form-input-2" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>
                      Address (Street / Building / Area)
                    </label>
                    <input id="create-bom-form-input-2" name="input2" aria-label="Address (Street / Building / Area)"
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
                      <label htmlFor="create-bom-form-city" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                      <input id="create-bom-form-city" name="city" aria-label="City"
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
                      <label htmlFor="create-bom-form-state" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                      <input id="create-bom-form-state" name="state" aria-label="State"
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
                      <label htmlFor="create-bom-form-pincode" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pincode</label>
                      <input id="create-bom-form-pincode" name="pincode" aria-label="Pincode"
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
                        {deliveryDocs.length >= 4 ? (
                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle style={{ width: '12px', height: '12px' }} /> {deliveryDocs.length} Images Attached (Target 4+ Met)
                          </span>
                        ) : deliveryDocs.length > 0 ? (
                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#B45309', backgroundColor: '#FEF3C7', padding: '3px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            📷 {deliveryDocs.length} / 4 Images Attached (Add {4 - deliveryDocs.length} more)
                          </span>
                        ) : null}
                      </div>

                      {/* Attached Delivery Address Proof Images List */}
                      {deliveryDocs.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginBottom: '10px' }}>
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

                      {/* Dropzone to Add / Upload Images (Multiple allowed) */}
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
                            <input id="create-bom-form-input-3" name="input3" aria-label="Input 3"
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
                        <span style={{ fontSize: '10px', color: '#94A3B8' }}>Supported formats: JPG, PNG, PDF, DOC (Multi-select enabled • At least 4 images recommended)</span>
                      </div>
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
                  setBomMaterialsList(targetPreset.items.map(it => {
                    const baseQ = parseFloat(it.qty) || 1;
                    return {
                      ...it,
                      baseQty: baseQ,
                      qty: String(baseQ),
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
                    const additionalItems = targetPreset.items.map(it => {
                      const baseQ = parseFloat(it.qty) || 1;
                      return {
                        ...it,
                        baseQty: baseQ,
                        qty: String(baseQ),
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
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>Total Quantity (Sets):</span>
              <input id="create-bom-form-preset-set-count" name="presetSetCount" aria-label="PresetSetCount"
                type="number"
                min="1"
                max="999"
                value={presetSetCount}
                onChange={(e) => {
                  const rawVal = e.target.value;
                  const newCount = rawVal === '' ? '' : Math.max(1, parseInt(rawVal) || 1);
                  setPresetSetCount(newCount);
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
                <input id="create-bom-form-25000" name="25000" aria-label="25000"
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
                  <input id="create-bom-form-checkbox" name={`checkbox_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Checkbox"
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
                <th style={{ padding: '12px 10px', fontWeight: '700', width: '11%' }}>Price (₹) <span style={{ color: '#EF4444' }}>*</span></th>
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
                      <input id="create-bom-form-checkbox" name={`checkbox_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Checkbox"
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
                          if (!matched) {
                            setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? { ...mat, name: val } : mat));
                            return;
                          }
                          const pName = matched.name;
                          const pCat = matched.description || matched.category || item.category;
                          const pCode = matched.code || matched.sku || resolveProductCode(matched) || item.code;
                          const isSolar5 = is5PctSolarProduct(pName, pCat);
                          setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? {
                            ...mat,
                            code: pCode || mat.code,
                            name: pName,
                            rate: matched.price || matched.rate ? String(matched.price || matched.rate) : mat.rate,
                            uom: matched.uom || matched.unit || mat.uom,
                            mm: matched.sections || mat.mm || '',
                            category: pCat,
                            gstRate: isSolar5 ? '5%' : (mat.gstRate || '18%')
                          } : mat));
                        }}
                      />
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <input id={`create-bom-form-description-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`description_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Description"
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
                      <input id={`create-bom-form-uom-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`uOM_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="UOM"
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
                        <option value="KW" />
                        <option value="KG" />
                        <option value="MTR" />
                        <option value="PCS" />
                        <option value="BOX" />
                        <option value="PKT" />
                        <option value="PAIR" />
                      </datalist>
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <input id={`create-bom-form-0-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`0_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="0"
                        type="number"
                        value={item.qty}
                        placeholder="0"
                        onChange={(e) => {
                          const val = e.target.value;
                          setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? { ...mat, qty: val } : mat));
                        }}
                        style={{ width: '100%', height: '34px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 8px', fontSize: '13px', textAlign: 'center', outline: 'none', boxSizing: 'border-box' }}
                       />
                      {(() => {
                        const avail = getItemStock(item.name, item.code);
                        if (avail === null || avail === undefined) return null;
                        const isOut = avail <= 0;
                        return (
                          <div style={{ marginTop: '3px' }}>
                            <span
                              title={`Available Inventory Stock: ${avail.toLocaleString()} ${item.uom || 'NOS'}`}
                              style={{
                                fontSize: '10px',
                                fontWeight: '800',
                                padding: '1px 6px',
                                borderRadius: '6px',
                                backgroundColor: isOut ? '#FEF2F2' : '#ECFDF5',
                                color: isOut ? '#DC2626' : '#059669',
                                border: isOut ? '1px solid #FECACA' : '1px solid #A7F3D0',
                                display: 'inline-block',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {isOut ? 'Stock: 0' : `Stock: ${avail.toLocaleString()}`}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      {selectedPreset && (item.isPresetItem || parseFloat(item.rate || 0) === 0) ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '38px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '0 8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534' }}>Included in Preset</span>
                        </div>
                      ) : (
                        <input id={`create-bom-form-0-00-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`000_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="0.00"
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
                      <select id={`create-bom-form-gst-rate-new-bom-gst-rate-18-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`gstRateNewBomGstRate18_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="GstRate newBomGstRate 18"
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
                        <option value="18%">18%</option>
                        <option value="12%">12%</option>
                        <option value="5%">5%</option>
                        <option value="0%">0%</option>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div>
            <label htmlFor="create-bom-form-mode-of-transport" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Mode of Transport <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input id="create-bom-form-mode-of-transport" name="modeOfTransport" aria-label="Mode of Transport"
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
            <label htmlFor="create-bom-form-transport-name" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Transport Name
            </label>
            <input id="create-bom-form-transport-name" name="transportName" aria-label="Transport Name"
              type="text"
              value={newBomTransporterName}
              onChange={(e) => setNewBomTransporterName(e.target.value)}
              placeholder="e.g. VRL Logistics / TCI Freight / Local Transport"
              style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none' }}
             />
          </div>

          <div>
            <label htmlFor="create-bom-form-destination" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Destination <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input id="create-bom-form-destination" name="destination" aria-label="Destination"
              type="text"
              required
              value={newBomDestination || ''}
              onChange={(e) => setNewBomDestination && setNewBomDestination(e.target.value)}
              placeholder="e.g. Coimbatore, Hyderabad, Site Location..."
              style={{ width: '100%', height: '42px', borderRadius: '10px', border: (!newBomDestination?.trim() && (bomFormErrors?.destination || false)) ? '1.5px solid #EF4444' : '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none' }}
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
              <label htmlFor="create-bom-form-payment-terms" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Payment Terms</label>
              <select id="create-bom-form-payment-terms" name="paymentTerms" aria-label="Payment Terms"
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
            </div>

            {(newBomPaymentType === 'Partial Paid' || newBomPaymentType === 'Partial Payment') && (
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
                    <input id="create-bom-form-50000" name="50000" aria-label="50000"
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
                <input id="create-bom-form-7" name="7" aria-label="7"
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
              <label htmlFor="create-bom-form-remarks-notes" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Remarks / Notes</label>
              <textarea id="create-bom-form-remarks-notes" name="remarksNotes" aria-label="Remarks / Notes"
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
                  {paymentDocs.length >= 4 ? (
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle style={{ width: '12px', height: '12px' }} /> {paymentDocs.length} Images Attached (Target 4+ Met)
                    </span>
                  ) : paymentDocs.length > 0 ? (
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#B45309', backgroundColor: '#FEF3C7', padding: '3px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      📷 {paymentDocs.length} / 4 Images Attached (Add {4 - paymentDocs.length} more)
                    </span>
                  ) : null}
                </div>

                {/* Attached Payment Proof Images List */}
                {paymentDocs.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                    {paymentDocs.map((doc, idx) => (
                      <div key={idx} style={{ border: '1px solid #86EFAC', borderRadius: '10px', padding: '8px', backgroundColor: '#F0FDF4', display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                        <div style={{ position: 'relative', height: '100px', backgroundColor: '#DCFCE7', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {(doc.previewUrl || doc.dataUrl) ? (
                            <img src={doc.previewUrl || doc.dataUrl} alt={doc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <FileCheck style={{ width: '32px', height: '32px', color: '#166534' }} />
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
                            title="Remove this image"
                          >
                            <Trash2 style={{ width: '12px', height: '12px' }} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dropzone to Add / Upload Payment Slips (Multiple allowed) */}
                <div
                  id="prod-field-newBomPaymentProofDoc"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleUploadPaymentProofFiles(e.dataTransfer.files);
                    }
                  }}
                  style={{
                    border: (bomFormErrors?.paymentProof && paymentDocs.length === 0) ? '2px dashed #EF4444' : '2px dashed #CBD5E1',
                    borderRadius: '12px',
                    padding: paymentDocs.length > 0 ? '14px 16px' : '24px 16px',
                    textAlign: 'center',
                    backgroundColor: (bomFormErrors?.paymentProof && paymentDocs.length === 0) ? '#FEF2F2' : '#FAFAFA',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <UploadCloud style={{ width: paymentDocs.length > 0 ? '24px' : '34px', height: paymentDocs.length > 0 ? '24px' : '34px', color: (bomFormErrors?.paymentProof && paymentDocs.length === 0) ? '#EF4444' : '#6366F1' }} />
                  <span style={{ fontSize: '13px', color: (bomFormErrors?.paymentProof && paymentDocs.length === 0) ? '#DC2626' : '#475569', fontWeight: '700' }}>
                    {paymentDocs.length > 0
                      ? `Attach more payment slips / receipts (Select multiple files to reach 4+ images)`
                      : `Drag & drop payment slip / bank advice here (Upload at least 4 images e.g. Transfer receipt, Bank statement, RTGS voucher)`}
                  </span>
                  {bomFormErrors?.paymentProof && paymentDocs.length === 0 && (
                    <div style={{ color: '#DC2626', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle style={{ width: '14px', height: '14px' }} /> {bomFormErrors.paymentProof}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <label style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4F46E5',
                      padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
                      cursor: 'pointer'
                    }}>
                      <Upload style={{ width: '13px', height: '13px' }} />
                      {paymentDocs.length > 0 ? '+ Add More Payment Slips' : 'Browse / Select Files (Multi-Select)'}
                      <input id="create-bom-form-input-4" name="input4" aria-label="Input 4"
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleUploadPaymentProofFiles(e.target.files);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                  </div>

                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                    Supported formats: PDF, JPG, PNG (Multi-select enabled • Upload at least 4 images recommended)
                  </span>
                </div>
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
              const invalidItems = [];
              bomMaterialsList.forEach((it, idx) => {
                const qty = parseFloat(it.qty) || 0;
                const r = parseFloat(it.rate) || 0;
                const isPreset = selectedPreset && (it.isPresetItem || parseFloat(it.rate || 0) === 0);
                if (!it.name || !it.name.trim()) {
                  invalidItems.push(`Item #${idx + 1}: Product name is required`);
                } else if (qty <= 0) {
                  invalidItems.push(`Item #${idx + 1} (${it.name}): Quantity must be greater than 0`);
                } else if (!isPreset && r <= 0) {
                  invalidItems.push(`Item #${idx + 1} (${it.name}): Price (₹) is required and must be greater than 0`);
                }
              });
              if (selectedPreset && parseFloat(presetFullPrice || 0) <= 0) {
                invalidItems.push(`Preset Kit (${selectedPreset}): Preset Full Price (₹) is required and must be greater than 0`);
              }
              if (invalidItems.length > 0) {
                alert(`⚠️ Incomplete Item Details:\n\n• ${invalidItems.join('\n• ')}`);
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

                    const pendingPiFromStorage = (() => {
                      try {
                        const parsed = typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('controlroom_pending_pi_to_bom') || '{}') : {};
                        if (parsed && (parsed.status === 'Draft' || parsed.statusType === 'draft')) {
                          return {};
                        }
                        return parsed;
                      } catch (e) {
                        return {};
                      }
                    })();

                    const loggedInOperatorName = (() => {
                      const stored = localStorage.getItem('controlroom_logged_user_name');
                      if (stored && stored.trim() && stored !== 'undefined' && stored !== 'null' && stored.toLowerCase() !== 'vijay') return stored.trim();
                      try {
                        const emps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
                        const cloudEmps = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
                        const allEmps = [...(Array.isArray(emps) ? emps : []), ...(Array.isArray(cloudEmps) ? cloudEmps : [])];
                        const match = allEmps.find(e => e && e.role === userRole && e.employee_name && e.employee_name.toLowerCase() !== 'vijay');
                        if (match && (match.employee_name || match.name)) return match.employee_name || match.name;
                      } catch (_) {}
                      if (stored && stored.trim() && stored !== 'undefined' && stored !== 'null') return stored.trim();
                      const storedUser = localStorage.getItem('controlroom_logged_user');
                      if (storedUser && storedUser.trim() && storedUser !== 'undefined' && storedUser !== 'null') return storedUser.trim();
                      if (userRole === 'Sales Head') return 'Sales Head';
                      if (userRole === 'Accounts Head') return 'Venkatesh';
                      if (userRole === 'Accounts Executive') return 'Priya';
                      if (userRole === 'Technical Administrator' || userRole === 'CEO') return 'Annamalaiyar';
                      return userRole || 'Sales Executive';
                    })();
                    const loggedInOperatorId = (localStorage.getItem('controlroom_logged_emp_id') || '').trim();

                    const explicitSourcePi = String(props.newBomSourcePiNo || props.sourcePiNo || '').trim();

                    // PRESERVE ORIGINAL PI SALESPERSON: Prioritize PI salesperson over converting admin only when explicitly converting
                    const effectiveSalesPersonName = (explicitSourcePi && pendingPiFromStorage?.salesPerson && pendingPiFromStorage.salesPerson.trim()) ||
                      (explicitSourcePi && pendingPiFromStorage?.createdBy && pendingPiFromStorage.createdBy.trim()) ||
                      loggedInOperatorName;

                    const effectiveSalesPersonCode = (explicitSourcePi && pendingPiFromStorage?.salesPersonCode && pendingPiFromStorage.salesPersonCode.trim()) ||
                      (explicitSourcePi && pendingPiFromStorage?.createdById && pendingPiFromStorage.createdById.trim()) ||
                      loggedInOperatorId;

                    const effectiveCreatorName = loggedInOperatorName;
                    const effectiveCreatedById = loggedInOperatorId || effectiveSalesPersonCode;

                    const hasPaymentProof = Boolean(newBomPaymentProofDoc);
                    const newBomRecord = {
                      id: finalCode,
                      bomCode: finalCode,
                      code: finalCode,
                      sourcePiNo: explicitSourcePi || null,
                      date: new Date().toISOString().split('T')[0],
                      createdAt: new Date().toISOString(),
                      customerName: selCust?.c2 || selCust?.companyName || selCust?.customerName || selCust?.code || newBomProductName || 'Customer Order',
                      companyName: selCust?.c2 || selCust?.companyName || selCust?.customerName || selCust?.code || newBomProductName || '-',
                      mobile: selCust?.c4 || selCust?.primaryContact?.phone || selCust?.phone || selCust?.primaryContact?.whatsapp || '-',
                      email: selCust?.c5 || selCust?.primaryContact?.email || selCust?.email || '-',
                      billingAddress: billingFull,
                      billingAddressObj: billingObj,
                      deliveryAddress: deliveryFull,
                      deliveryAddressObj: deliveryObj,
                      deliveryAddressProofDoc: sameAsBilling ? null : (deliveryDocs[0] || null),
                      deliveryAddressProofDocs: sameAsBilling ? [] : deliveryDocs,
                      transportMode: newBomTransportMode || 'Transport',
                      transporterName: newBomTransporterName || '',
                      destination: (newBomDestination || '').trim(),
                      vehicleNo: newBomVehicleNo || '',
                      lrNo: newBomLrNo || '',
                      paymentType: normalizePaymentTerm(newBomPaymentType),
                      partialAmount: (newBomPaymentType === 'Partial Paid' || newBomPaymentType === 'Partial Payment') ? (parseFloat(newBomPartialAmount) || 0) : null,
                      balanceAmount: (newBomPaymentType === 'Partial Paid' || newBomPaymentType === 'Partial Payment') ? Math.max(0, (totals.grand || 0) - (parseFloat(newBomPartialAmount) || 0)) : (['100% Paid', '100% Advance'].includes(newBomPaymentType) ? 0 : totals.grand),
                      creditDays: newBomPaymentType === 'Credit Payment' ? (parseInt(newBomCreditDays) || 7) : null,
                      creditDueDate: newBomPaymentType === 'Credit Payment' ? new Date(Date.now() + (parseInt(newBomCreditDays) || 7) * 86400000).toISOString().split('T')[0] : null,
                      paymentProofDoc: paymentDocs[0] || null,
                      paymentProofDocs: paymentDocs,
                      paymentUpdated: (newBomPaymentType === '100% Paid' || newBomPaymentType === 'Partial Paid' || newBomPaymentType === 'Partial Payment') && paymentDocs.length > 0,
                      remarks: newBomRemarks || '',
                      status: isDraft ? 'Draft' : 'Sales Confirmed - Sent to Dispatch',
                      salesConfirmed: !isDraft,
                      salesConfirmedAt: !isDraft ? new Date().toISOString() : null,
                      salesPerson: effectiveSalesPersonName,
                      salesPersonCode: effectiveSalesPersonCode,
                      createdBy: effectiveCreatorName,
                      createdById: effectiveCreatedById,
                      convertedBy: loggedInOperatorName,
                      convertedById: loggedInOperatorId,
                      items: (bomMaterialsList || []).map(item => ({
                        code: item.code || item.sku || item.itemId || resolveProductCode(item) || '',
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
                        proofDoc: paymentDocs[0] ? paymentDocs[0].name : null,
                        proofDocObj: paymentDocs[0] || null,
                        proofDocs: paymentDocs.map(d => d.name),
                        proofDocObjs: paymentDocs,
                        paymentUpdated: newBomPaymentType === '100% Paid' && paymentDocs.length > 0
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
                        if (reserved && (/^VRM-BOM-\d{4}-\d+$/i.test(reserved) || /^BOM-\d+$/i.test(reserved))) {
                          finalAssignedCode = reserved;
                        }
                      } catch (err) {
                        console.error('Error reserving atomic BOM code:', err);
                        finalAssignedCode = getNextSequence('BOM', props.bomStore || []).code;
                      }
                    }
                    sanitizedNewBom.bomCode = finalAssignedCode;
                    sanitizedNewBom.code = finalAssignedCode;
                    sanitizedNewBom.id = finalAssignedCode;

                    // Upload any attached delivery proof files to private Supabase Storage
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

                    // Upload any attached payment proof files to private Supabase Storage
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

                    let sResOk = false;
                    const postPayload = JSON.stringify({ bom: sanitizedNewBom, isNew: !isDraft });
                    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
                    const endpoints = isHttps ? ['/api/boms'] : ['/api/boms', 'http://localhost:5001/api/boms'];
                    for (const url of endpoints) {
                      try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 1500);
                        const sRes = await fetch(url, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: postPayload,
                          signal: controller.signal
                        }).catch(() => null);
                        clearTimeout(timeoutId);
                        if (sRes && sRes.ok) {
                          const sData = await sRes.json().catch(() => null);
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

                    // Deduct / Reserve Stock in Central Inventory & Raw Materials Stores ONLY if sent to dispatch (never for drafts)
                    if (!isDraft) {
                      try {
                        centralInventoryStore.deductStockForBOM(finalAssignedCode, sanitizedNewBom.items, sanitizedNewBom.salesPerson || 'Sales Executive');
                        sanitizedNewBom.stockBlocked = true;
                        sanitizedNewBom.stockBlockedAt = new Date().toISOString();
                        sanitizedNewBom.stockDeducted = true;
                      } catch (cErr) {
                        console.warn('Central store deduction error in CreateBomFormPage:', cErr);
                      }
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
                              saveCloudStore(storeKey.replace('controlroom_', ''), updated);
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
                      const filtered = current.filter(item => {
                        if (!item) return false;
                        if (item.bomCode === finalAssignedCode || item.code === finalAssignedCode) return false;
                        if (sanitizedNewBom.sourcePiNo && String(item.sourcePiNo || item.piNo || '').trim().toLowerCase() === String(sanitizedNewBom.sourcePiNo).trim().toLowerCase()) {
                          return false;
                        }
                        return true;
                      });
                      const combined = [sanitizedNewBom, ...filtered];
                      const { list: updatedList } = resolveBomCollisions(combined, 662);

                      try {
                        localStorage.setItem('controlroom_bom_store', JSON.stringify(updatedList.map(stripDataUrlsFromRecord)));
                      } catch (_) {}

                      // Atomically push created BOM order to Supabase and Node server API
                      saveCloudBomRow(sanitizedNewBom);
                      try {
                        fetch('/api/boms', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ bom: stripDataUrlsFromRecord(sanitizedNewBom), isUpdate: false })
                        }).catch(err => console.error('Error syncing created BOM to server:', err));
                      } catch (_) {}

                      setShowBOMForm(false);
                      setBomConfirmModal(null);
                      setCurrentPage(1);
                      try { localStorage.removeItem('controlroom_pending_pi_to_bom'); } catch (_) {}
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
                      notifyBomCreatedToSales({
                        bomCode: finalAssignedCode,
                        customerName: sanitizedNewBom.companyName || sanitizedNewBom.customerName,
                        salesPerson: sanitizedNewBom.salesPerson,
                        salesPersonCode: sanitizedNewBom.salesPersonCode || sanitizedNewBom.createdById
                      });
                      alert(`✅ BOM (${finalAssignedCode}) created successfully and sent to Dispatch for packing!`);
                    } else {
                      alert(`📝 BOM (${finalAssignedCode}) saved as Draft.`);
                    }

                    setNewBomPaymentProofDoc(null);
                    setNewBomDeliveryProofDoc(null);
                    setNewBomRemarks('');
                    setNewBomTransporterName('');
                    if (typeof setNewBomDestination === 'function') setNewBomDestination('');
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
