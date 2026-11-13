import { Check } from 'lucide-react';
import { isFixedQuantityPreset } from '../../vrmHdgProposalPresets';
import { normalizePaymentTerm, stripDataUrlsFromRecord } from '../../utils/otherViewsShared';
import { resolveProductCode, calculateTotalDispatchQty } from '../../utils/vrmProductsData';
import { notifyPiCreated } from '../../services/notificationService';
import { isTamilNaduIntra } from '../../utils/gstHelper';
import { getNextSequence } from '../../utils/sequenceGenerator';
import { getHsnCode, is5PctSolarProduct } from '../../utils/hsnCodeService';

export function createPiActionHandlers(ctx) {
  const {
    userRole,
    GST_STATE_MAP,
    selectedStandaloneIndexes,
    setViewMode,
    setPrintModalPi,
    setValidationAlert,
    showTopToast,
    bomList,
    piList,
    currentEmpId,
    currentEmpName,
    currentLoggedEmail,
    isTechSupport,
    selectedSalespersonCode,
    getEffectiveSalesPerson,
    updatePiList,
    deleteIdx,
    setDeleteIdx,
    setShowSaveConfirm,
    editIdx,
    setEditIdx,
    setActiveDropdownIdx,
    getActiveUserName,
    setSelectedPreset,
    setPresetSetCount,
    setPresetKitPrice,
    presetGroups,
    setPresetGroups,
    setSubPresetModalGroup,
    setNestedSubPresetVal,
    setNestedSubPresetCount,
    setShowConvertPresetModal,
    convertPresetName,
    setConvertPresetName,
    convertPresetPrice,
    setConvertPresetPrice,
    convertPresetGst,
    setConvertPresetGst,
    setSelectedItemIndexes,
    setShowClearConfirmModal,
    setShowCreateSetModal,
    newSetName,
    setNewSetName,
    newSetCount,
    setNewSetCount,
    newSetUnit,
    setNewSetUnit,
    newSetPrice,
    setNewSetPrice,
    newSetGstRate,
    setNewSetGstRate,
    setPiConfirmModal,
    pdfFile,
    setPdfFile,
    signedPiDoc,
    setSignedPiDoc,
    piNumber,
    setPiNumber,
    isSubmittingPI,
    setIsSubmittingPI,
    piDate,
    setPiDate,
    validUntilDate,
    setValidUntilDate,
    salesPerson,
    setSalesPerson,
    vendorName,
    setVendorName,
    contactPerson,
    setContactPerson,
    phone,
    setPhone,
    email,
    setEmail,
    gstNo,
    setGstNo,
    billingStreet,
    setBillingStreet,
    billingCity,
    setBillingCity,
    billingState,
    setBillingState,
    billingPincode,
    setBillingPincode,
    sameAsBilling,
    setSameAsBilling,
    deliveryStreet,
    setDeliveryStreet,
    deliveryCity,
    setDeliveryCity,
    deliveryState,
    setDeliveryState,
    deliveryPincode,
    setDeliveryPincode,
    piItems,
    setPiItems,
    transportMode,
    setTransportMode,
    transporterName,
    setTransporterName,
    destination,
    setDestination,
    vehicleNo,
    setVehicleNo,
    transportScope,
    setTransportScope,
    paymentTerms,
    setPaymentTerms,
    creditDays,
    setCreditDays,
    remarks,
    setRemarks,
    setUploadProgress,
    setIsUploading
  } = ctx;

  // Financial calculations supporting multi-preset groups and line items
  const calculatePiTotals = () => {
    let kitSubtotal = 0;
    const groupIds = Object.keys(presetGroups || {});
    groupIds.forEach(grpId => {
      const grp = presetGroups[grpId];
      if (grp) {
        const unitPrice = parseFloat(grp.kitPrice) || 0;
        const multiplier = parseFloat(grp.setCount || grp.quantity || 1) || 0;
        kitSubtotal += (unitPrice * multiplier);
      }
    });

    const itemsSub = (piItems || []).reduce((acc, item) => {
      if (item.isPresetItem || item.presetGroupId) return acc;
      const q = parseFloat(item.qty) || 0;
      const r = parseFloat(item.rate) || 0;
      return acc + (q * r);
    }, 0);

    const sub = itemsSub + kitSubtotal;

    // 3. GST: Custom item GSTs + Preset kits GST grouped by rate (e.g. 0%, 5%, 18%)
    const gstTiersMap = {};
    const extractRate = (val, fallback = 18) => {
      if (val === undefined || val === null || val === '') return fallback;
      const str = String(val).replace('%', '').trim();
      const n = parseFloat(str);
      return isNaN(n) ? fallback : n;
    };

    (piItems || []).forEach(item => {
      if (item.isPresetItem || item.presetGroupId) return;
      const q = parseFloat(item.qty) || 0;
      const r = parseFloat(item.rate) || 0;
      if (r <= 0) return;
      const rowTot = q * r;
      const pct = extractRate(item.gstRate, 18);
      const amt = rowTot * (pct / 100);
      if (!gstTiersMap[pct]) gstTiersMap[pct] = { rate: pct, taxable: 0, gstAmt: 0 };
      gstTiersMap[pct].taxable += rowTot;
      gstTiersMap[pct].gstAmt += amt;
    });

    groupIds.forEach(grpId => {
      const grp = presetGroups[grpId];
      if (grp) {
        const unitPrice = parseFloat(grp.kitPrice) || 0;
        const multiplier = parseFloat(grp.setCount || grp.quantity || 1) || 0;
        const groupTotal = unitPrice * multiplier;
        if (groupTotal <= 0) return;

        const gPct = extractRate(grp?.gstRate, 18);
        const gAmt = groupTotal * (gPct / 100);
        if (!gstTiersMap[gPct]) gstTiersMap[gPct] = { rate: gPct, taxable: 0, gstAmt: 0 };
        gstTiersMap[gPct].taxable += groupTotal;
        gstTiersMap[gPct].gstAmt += gAmt;
      }
    });

    const targetState = sameAsBilling ? billingState : (deliveryState || billingState);
    const isIntra = isTamilNaduIntra(gstNo, targetState, billingState);

    // Only include tax tiers with rate > 0 so that 0% rate incurs 0 tax and does not appear as a tax deduction
    const gstTiers = Object.values(gstTiersMap)
      .filter(t => t.rate > 0 && (t.gstAmt > 0 || t.taxable > 0))
      .sort((a, b) => a.rate - b.rate);

    const formattedTiers = gstTiers.map(t => ({
      ...t,
      cgstRate: t.rate / 2,
      cgstAmt: t.gstAmt / 2,
      sgstRate: t.rate / 2,
      sgstAmt: t.gstAmt / 2,
      igstRate: t.rate,
      igstAmt: t.gstAmt
    }));

    const rawGst = formattedTiers.reduce((sum, t) => sum + t.gstAmt, 0);
    const roundedSub = Math.round(sub * 100) / 100;
    const roundedGst = Math.round(rawGst * 100) / 100;
    const roundedGrand = Math.round((roundedSub + roundedGst) * 100) / 100;
    const halfGst = Math.round((roundedGst / 2) * 100) / 100;

    return {
      sub: isNaN(roundedSub) ? 0 : roundedSub,
      kitSubtotal: isNaN(kitSubtotal) ? 0 : Math.round(kitSubtotal * 100) / 100,
      gst: isNaN(roundedGst) ? 0 : roundedGst,
      grand: isNaN(roundedGrand) ? 0 : roundedGrand,
      cgst: isNaN(halfGst) ? 0 : halfGst,
      sgst: isNaN(halfGst) ? 0 : halfGst,
      isIntra,
      taxType: isIntra ? 'INTRA' : 'INTER',
      gstTiers: formattedTiers
    };
  };

  const previewCurrentFormAsTemplate = () => {
    const totals = calculatePiTotals();
    const joinedProducts = (piItems || []).map(it => it.name).filter(Boolean).join(', ') || 'Solar Structure & Accessories';
    const previewData = {
      piNo: (piNumber && piNumber.trim() && piNumber !== 'Auto-Assigned') ? piNumber : 'DRAFT-PREVIEW',
      vendor: vendorName || 'Customer Company Name',
      customerName: vendorName || 'Customer Company Name',
      contactPerson,
      phone,
      email,
      gstNo: (gstNo || '').toUpperCase(),
      productName: joinedProducts,
      items: (piItems && piItems.length > 0) ? piItems : [
        {
          name: joinedProducts,
          description: 'Standard VRM Solar Structure & Accessories Kit',
          hsn: getHsnCode(joinedProducts || 'Solar Structure Kit'),
          qty: 1,
          uom: 'NOS',
          rate: totals.sub || 100000,
          gstRate: '18%',
          amount: totals.sub || 100000
        }
      ],
      salesPerson: salesPerson || getEffectiveSalesPerson(),
      billingStreet,
      billingCity,
      billingState,
      billingPincode,
      deliveryStreet: sameAsBilling ? billingStreet : deliveryStreet,
      deliveryCity: sameAsBilling ? billingCity : deliveryCity,
      deliveryState: sameAsBilling ? billingState : deliveryState,
      deliveryPincode: sameAsBilling ? billingPincode : deliveryPincode,
      sameAsBilling,
      transportMode,
      transporterName,
      destination,
      vehicleNo,
      transportScope,
      paymentTerms,
      creditDays,
      remarks,
      unitValue: Math.round(totals.sub),
      quantity: (piItems || []).reduce((acc, it) => acc + (parseFloat(it.qty) || 0), 0) || 1,
      subtotal: totals.sub,
      taxTotal: totals.gst,
      grandTotal: totals.grand,
      amount: '₹' + Math.round(totals.grand).toLocaleString('en-IN'),
      piDate: piDate || new Date().toISOString().split('T')[0],
      expDate: validUntilDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
    };
    setPrintModalPi(previewData);
  };

  const handleAddMaterialRow = () => {
    setPiItems(prev => [...(prev || []), { name: '', category: '', uom: 'NOS', unit: 'NOS', qty: '1', rate: '', gstRate: '18%', hsn: '' }]);
  };

  const handleAddPresetItem = (groupId) => {
    const grp = (groupId && presetGroups[groupId]) || Object.values(presetGroups)[0];
    if (!grp) return;
    const mult = (grp.unit === 'kW' || grp.unitType === 'kW') ? 1 : Math.max(1, parseFloat(grp.setCount) || 1);
    const targetGid = grp.groupId || groupId;
    const newItem = {
      name: '',
      category: '',
      uom: 'NOS',
      unit: 'NOS',
      qty: String(1 * mult),
      baseQty: 1,
      rate: '0',
      gstRate: grp.gstRate || '18%',
      hsn: '',
      isPresetItem: true,
      presetGroupId: targetGid,
      presetName: grp.presetName
    };
    setPiItems(prev => {
      const items = [...(prev || [])];
      let lastGroupIdx = -1;
      for (let idx = items.length - 1; idx >= 0; idx--) {
        if (items[idx]?.presetGroupId === targetGid) {
          lastGroupIdx = idx;
          break;
        }
      }
      if (lastGroupIdx >= 0) {
        items.splice(lastGroupIdx + 1, 0, newItem);
        return items;
      }
      return [...items, newItem];
    });
  };

  const handleReorderPiItem = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setPiItems(prev => {
      if (!prev || prev.length <= 1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const handleMovePiItemStep = (fromIndex, direction) => {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= piItems.length) return;
    handleReorderPiItem(fromIndex, toIndex);
  };

  const handleMovePresetGroupBlock = (groupId, direction) => {
    setPiItems(prev => {
      if (!prev || prev.length <= 1) return prev;
      const distinctGroups = [];
      prev.forEach(it => {
        const g = it.presetGroupId || (it.isPresetItem ? 'legacy' : 'custom_items');
        if (!distinctGroups.includes(g)) distinctGroups.push(g);
      });
      const curIdx = distinctGroups.indexOf(groupId);
      if (curIdx === -1) return prev;
      const targetIdx = curIdx + direction;
      if (targetIdx < 0 || targetIdx >= distinctGroups.length) return prev;

      const groupItemsMap = {};
      distinctGroups.forEach(g => { groupItemsMap[g] = []; });
      prev.forEach(it => {
        const g = it.presetGroupId || (it.isPresetItem ? 'legacy' : 'custom_items');
        groupItemsMap[g].push(it);
      });

      const newOrder = [...distinctGroups];
      const [movedGroup] = newOrder.splice(curIdx, 1);
      newOrder.splice(targetIdx, 0, movedGroup);

      const result = [];
      newOrder.forEach(g => {
        if (groupItemsMap[g]) result.push(...groupItemsMap[g]);
      });
      return result;
    });
  };

  const handleConvertSelectedToPreset = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (selectedStandaloneIndexes.length === 0) return;
    const cleanName = (convertPresetName || '').trim() || `Custom Preset ${Object.keys(presetGroups || {}).length + 1}`;
    const groupId = 'custom_set_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const gst = convertPresetGst || '18%';
    const idxSet = new Set(selectedStandaloneIndexes);

    setPresetGroups(prev => ({
      ...prev,
      [groupId]: {
        groupId,
        presetId: 'custom_set',
        presetName: cleanName,
        setCount: 1,
        unit: 'Sets',
        kitPrice: convertPresetPrice ? String(convertPresetPrice) : '',
        gstRate: gst,
        hsn: getHsnCode(cleanName),
        isCustomSet: true
      }
    }));

    setPiItems(prev => {
      const list = prev || [];
      const converted = [];
      const rest = [];
      list.forEach((it, i) => {
        if (idxSet.has(i)) {
          const baseQ = parseFloat(it.qty) || 1;
          converted.push({
            ...it,
            isPresetItem: true,
            presetGroupId: groupId,
            presetName: cleanName,
            baseQty: baseQ,
            rate: '0',
            gstRate: it.gstRate || gst
          });
        } else {
          rest.push(it);
        }
      });
      return [...rest, ...converted];
    });

    setSelectedItemIndexes([]);
    setConvertPresetName('');
    setConvertPresetPrice('');
    setConvertPresetGst('18%');
    setShowConvertPresetModal(false);
  };

  const handleCreateCustomSet = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanName = (newSetName || '').trim() || `Custom Set ${Object.keys(presetGroups || {}).length + 1}`;
    const unit = newSetUnit || 'Sets';
    const count = unit === 'kW' ? Math.max(0.01, parseFloat(newSetCount) || 1) : Math.max(1, parseInt(newSetCount) || 1);
    const groupId = 'custom_set_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const setGst = newSetGstRate || '18%';

    setPresetGroups(prev => ({
      ...prev,
      [groupId]: {
        groupId,
        presetId: 'custom_set',
        presetName: cleanName,
        setCount: count,
        unit,
        kitPrice: newSetPrice ? String(newSetPrice) : '',
        gstRate: setGst,
        hsn: getHsnCode(cleanName),
        isCustomSet: true
      }
    }));

    const initialItem = {
      name: '',
      category: '',
      uom: unit === 'kW' ? 'kW' : 'NOS',
      qty: '1',
      baseQty: 1,
      rate: '0',
      gstRate: setGst,
      hsn: '',
      isPresetItem: true,
      presetGroupId: groupId,
      presetName: cleanName
    };

    setPiItems(prev => [...(prev || []), initialItem]);

    setNewSetName('');
    setNewSetCount(1);
    setNewSetUnit('Sets');
    setNewSetPrice('');
    setNewSetGstRate('18%');
    setShowCreateSetModal(false);
  };

  const handleAddPresetToOrder = (presetId, targetPreset, setsCount) => {
    if (!targetPreset || !targetPreset.items || targetPreset.items.length === 0) return;
    const groupId = 'preset_grp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const multiplier = Math.max(0.01, parseFloat(setsCount) || 1);

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
    const presetHsn = targetPreset.hsn || targetPreset.hsn_or_sac || getHsnCode(targetPreset.label || presetName);

    setPresetGroups(prev => ({
      ...prev,
      [groupId]: {
        groupId,
        presetId,
        presetName,
        setCount: multiplier,
        unit: targetPreset.unit || 'Sets',
        kitPrice: defaultPrice,
        gstRate: initialGstRate,
        hsn: presetHsn
      }
    }));

    const isFixedKit = isFixedQuantityPreset(presetId, targetPreset.label || presetName);
    const newItems = targetPreset.items.map(it => {
      const rawQ = it.qty !== undefined && it.qty !== null ? String(it.qty).trim() : '';
      const hasQty = rawQ !== '' && rawQ !== '0' && !isNaN(parseFloat(rawQ));
      const baseQ = hasQty ? parseFloat(rawQ) : '';
      const resCode = resolveProductCode(it);
      return {
        ...it,
        code: it.code || resCode,
        presetGroupId: groupId,
        presetName,
        baseQty: baseQ,
        qty: hasQty ? String(baseQ) : '',
        rate: '0',
        gstRate: (isDcrBosKit || is5PctSolarProduct(it.name, it.category || it.specs)) ? '5%' : (it.gstRate || initialGstRate),
        hsn: it.hsn || it.hsn_or_sac || getHsnCode(it) || presetHsn,
        isPresetItem: true
      };
    });

    setPiItems(prev => [...(prev || []), ...newItems]);
    setSelectedPreset('');
    setPresetSetCount(1);
  };

  const handleRemovePresetGroup = (groupId) => {
    setPiItems(prev => (prev || []).filter(item => (item.presetGroupId || 'legacy_default') !== groupId));
    setPresetGroups(prev => {
      const updated = { ...prev };
      delete updated[groupId];
      return updated;
    });
  };

  const handleAttachSubPresetToGroup = (parentGroupId, subPresetId, targetPreset, subSetsCount) => {
    if (!targetPreset || !targetPreset.items || targetPreset.items.length === 0) return;
    const parentGroup = presetGroups[parentGroupId];
    if (!parentGroup) return;

    const multiplier = Math.max(1, parseInt(subSetsCount) || 1);
    const subPresetName = targetPreset.label || subPresetId;
    const parentPresetName = parentGroup.presetName;

    const newSubItems = targetPreset.items.map(it => {
      const rawQ = it.qty !== undefined && it.qty !== null ? String(it.qty).trim() : '';
      const hasQty = rawQ !== '' && rawQ !== '0' && !isNaN(parseFloat(rawQ));
      const baseQ = hasQty ? parseFloat(rawQ) : '';
      const resCode = resolveProductCode(it);
      return {
        ...it,
        code: it.code || resCode,
        presetGroupId: parentGroupId,
        presetName: parentPresetName,
        isSubPreset: true,
        subPresetId,
        subPresetName,
        subSetCount: multiplier,
        subUnit: targetPreset.unit || 'Sets',
        baseQty: baseQ,
        qty: hasQty ? String(baseQ) : '',
        rate: '0',
        gstRate: it.gstRate || parentGroup.gstRate || '18%',
        hsn: it.hsn || it.hsn_or_sac || getHsnCode(it) || parentGroup.hsn,
        isPresetItem: true
      };
    });

    setPiItems(prev => [...(prev || []), ...newSubItems]);
    setPresetGroups(prev => {
      const existingGrp = prev[parentGroupId];
      const existingNested = existingGrp.nestedSubPresets || [];
      return {
        ...prev,
        [parentGroupId]: {
          ...existingGrp,
          nestedSubPresets: [
            ...existingNested,
            {
              id: subPresetId,
              name: subPresetName,
              setCount: multiplier
            }
          ]
        }
      };
    });

    setSubPresetModalGroup(null);
    setNestedSubPresetVal('');
    setNestedSubPresetCount(1);
  };

  const handleRemoveMaterialRow = (idx) => {
    setPiItems(prev => {
      const target = (prev || [])[idx];
      const remaining = (prev || []).filter((_, i) => i !== idx);
      if (target && target.presetGroupId) {
        const stillHasGroup = remaining.some(it => it.presetGroupId === target.presetGroupId);
        if (!stillHasGroup) {
          setPresetGroups(pg => {
            const copy = { ...pg };
            delete copy[target.presetGroupId];
            return copy;
          });
        }
      }
      if (remaining.length === 0) {
        setSelectedPreset('');
      }
      return remaining;
    });
    setSelectedItemIndexes(prev => prev.filter(i => i !== idx).map(i => i > idx ? i - 1 : i));
  };

  const fetchNextPiNumber = async () => {
    const fallback = getNextSequence('PI', [...(piList || []), ...(bomList || [])]).code;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch('/api/next-pi-number', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.nextPiNo || data.nextEstimateNo)) {
          const val = data.nextPiNo || data.nextEstimateNo;
          setPiNumber(val);
          return val;
        }
      }
    } catch (e) {
      console.warn('Fast fallback for PI number generation:', e?.message || e);
    }

    setPiNumber(fallback);
    return fallback;
  };

  const resetForm = () => {
    setPdfFile(null);
    setSignedPiDoc(null);
    setUploadProgress(0);
    setIsUploading(false);
    setPiNumber('');
    setPiDate(new Date().toISOString().split('T')[0]);
    setValidUntilDate('');
    setVendorName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setGstNo('');
    setSalesPerson(getActiveUserName());
    setBillingStreet('');
    setBillingCity('');
    setBillingState('');
    setBillingPincode('');
    setDeliveryStreet('');
    setDeliveryCity('');
    setDeliveryState('');
    setDeliveryPincode('');
    setSameAsBilling(true);
    setTransportMode('Transport');
    setTransporterName('');
    setDestination('');
    setVehicleNo('');
    setTransportScope('VRM Structures');
    setPaymentTerms('100% Paid');
    setCreditDays('');
    setRemarks('');
    setPiItems([]); // Fresh empty default with 0 prefilled items
    setSelectedPreset('');
    setPresetSetCount(1);
    setPresetKitPrice('');
    setPresetGroups({});
    setSelectedItemIndexes([]);
    setShowSaveConfirm(false);
    setShowClearConfirmModal(false);
    setPiConfirmModal(null);
  };

  // Validates required fields before creating or saving a PI
  const validatePiForm = (isDraft = false) => {
    const missingList = [];

    // 1. Company Name
    if (!vendorName || !vendorName.trim()) {
      missingList.push({
        field: 'Company Name',
        message: 'Please enter or select the Company Name.',
        targetId: 'pi-field-vendorName'
      });
    }

    // 2. Mobile / Phone
    if (!phone || !phone.trim()) {
      missingList.push({
        field: 'Contact Mobile / Phone',
        message: 'Please provide a valid contact mobile number.',
        targetId: 'pi-field-phone'
      });
    }

    // 3. Billing Address
    if (!billingStreet || !billingStreet.trim()) {
      missingList.push({
        field: 'Billing Street Address',
        message: 'Please enter the Billing Street / Door / Area details.',
        targetId: 'pi-field-billingStreet'
      });
    }
    if (!billingCity || !billingCity.trim()) {
      missingList.push({
        field: 'Billing City',
        message: 'Please enter the Billing City.',
        targetId: 'pi-field-billingCity'
      });
    }
    if (!billingState || !billingState.trim()) {
      missingList.push({
        field: 'Billing State',
        message: 'Please enter the Billing State.',
        targetId: 'pi-field-billingState'
      });
    }
    if (!billingPincode || !billingPincode.trim()) {
      missingList.push({
        field: 'Billing Pincode',
        message: 'Please enter the 6-digit Pincode.',
        targetId: 'pi-field-billingPincode'
      });
    }

    // 3.5 GST State match validation
    const checkGstCode = (gstNo || '').trim().substring(0, 2);
    const expectedGstState = GST_STATE_MAP[checkGstCode];
    if (gstNo && gstNo.trim().length >= 2 && expectedGstState && billingState && billingState.trim()) {
      if (expectedGstState.toLowerCase() !== billingState.trim().toLowerCase()) {
        missingList.push({
          field: 'GST Number State Mismatch',
          message: `GSTIN code "${checkGstCode}" is registered to ${expectedGstState}, but Billing State is entered as "${billingState}". Click "Sync to ${expectedGstState}" to resolve.`,
          targetId: 'pi-field-billingState'
        });
      }
    }

    // 4. Delivery Address
    if (!sameAsBilling) {
      if (!deliveryStreet || !deliveryStreet.trim()) {
        missingList.push({
          field: 'Delivery Street Address',
          message: 'Please enter the Delivery Street address (or check "Same as Billing").',
          targetId: 'pi-field-deliveryStreet'
        });
      }
      if (!deliveryCity || !deliveryCity.trim()) {
        missingList.push({
          field: 'Delivery City',
          message: 'Please enter the Delivery City.',
          targetId: 'pi-field-deliveryCity'
        });
      }
    }

    // 5. Line items
    if (!Array.isArray(piItems) || piItems.length === 0) {
      missingList.push({
        field: 'Invoice Line Items',
        message: 'Please add at least one line item or select a preset kit.',
        targetId: 'pi-field-items'
      });
    } else {
      const invalid = [];
      piItems.forEach((it, idx) => {
        const q = parseFloat(it.qty) || 0;
        const r = parseFloat(it.rate) || 0;
        const isPresetItem = Boolean(it.isPresetItem);
        if (!it.name || !it.name.trim()) {
          invalid.push(`Item #${idx + 1}: Name is required`);
        } else if (q <= 0) {
          invalid.push(`Item #${idx + 1} (${it.name}): Quantity must be > 0`);
        } else if (!isPresetItem && r <= 0) {
          invalid.push(`Item #${idx + 1} (${it.name}): Price (₹) is required and must be > 0`);
        }
      });
      const presetItems = piItems.filter(it => it.isPresetItem);
      if (presetItems.length > 0) {
        if (!presetGroups || Object.keys(presetGroups).length === 0) {
          invalid.push('Pack Amt (₹) is mandatory: Please enter a valid Pack Amount for the configured pack kit.');
        } else {
          Object.values(presetGroups).forEach(g => {
            const kp = parseFloat(g.kitPrice) || 0;
            if (kp <= 0) {
              invalid.push(`Pack Amt (₹) is mandatory for "${g.presetName || 'Pack Kit'}": Please enter an amount > 0`);
            }
          });
        }
      }
      if (invalid.length > 0) {
        missingList.push({
          field: 'Incomplete Item Details',
          message: invalid.join(' • '),
          targetId: 'pi-field-items'
        });
      }
    }

    return {
      isValid: missingList.length === 0,
      missingList
    };
  };

  // Triggers Save Confirmation modal
  const triggerSaveConfirm = (e) => {
    if (e) e.preventDefault();
    const validation = validatePiForm(false);
    if (!validation.isValid) {
      setValidationAlert({
        fields: validation.missingList.map(m => typeof m === 'object' ? m.field : m),
        firstTargetId: validation.missingList[0]?.targetId
      });
      return;
    }
    setPiConfirmModal('create');
  };

  // Triggers Draft Confirmation modal
  const triggerDraftConfirm = (e) => {
    if (e) e.preventDefault();
    if (!vendorName || !vendorName.trim()) {
      setValidationAlert({
        fields: ['Company Name'],
        firstTargetId: 'pi-field-vendorName'
      });
      return;
    }
    // Check if preset items exist without Preset Amt
    const presetItems = (piItems || []).filter(it => it.isPresetItem);
    if (presetItems.length > 0) {
      let missingKitPrice = false;
      if (!presetGroups || Object.keys(presetGroups).length === 0) {
        missingKitPrice = true;
      } else {
        Object.values(presetGroups).forEach(g => {
          if (!g.kitPrice || parseFloat(g.kitPrice) <= 0) {
            missingKitPrice = true;
          }
        });
      }
      if (missingKitPrice) {
        setValidationAlert({
          fields: ['Pack Amt (₹) is Mandatory'],
          message: 'Pack Amt (₹) is mandatory for pack structure items. Please enter a valid amount before saving.',
          firstTargetId: 'pi-field-items'
        });
        return;
      }
    }
    setPiConfirmModal('draft');
  };

  // Submits the new or edited PI
  const executeCreatePI = async (isDraft = false) => {
    if (isSubmittingPI) return;
    setIsSubmittingPI(true);
    try {
      const totals = calculatePiTotals();
      const joinedProducts = piItems.map(it => it.name).filter(Boolean).join(', ') || 'Solar Structure & Accessories';

      const isEditing = editIdx !== null;
      let cleanPiNo;
      if (isEditing) {
        cleanPiNo = (piNumber && piNumber.trim() && piNumber !== 'Auto-Assigned')
          ? piNumber.trim().toUpperCase()
          : (piList[editIdx]?.piNo || `PI-${String(editIdx + 1).padStart(5, '0')}`);
      } else {
        // Generate the sequential PI number at the last step upon final submission (same as BOM)
        cleanPiNo = await fetchNextPiNumber();
      }

      // CONCURRENCY & COLLISION PROTECTION (CLIENT-SIDE):
      // If user is creating a NEW PI (not editing), but cleanPiNo already exists in local piList:
      // DO NOT OVERWRITE! Advance to the next unused sequence number.
      let targetKey = String(cleanPiNo || '').trim().toLowerCase();
      if (!isEditing) {
        const isCollision = (piList || []).some(p => {
          const pNo = String(p.piNo || '').trim().toLowerCase();
          const pId = String(p.id || '').trim().toLowerCase();
          return pNo === targetKey || pId === targetKey;
        });
        if (isCollision) {
          const { code } = getNextSequence('PI', [...(piList || []), ...(bomList || [])]);
          console.warn(`[PI CONCURRENCY SAFETY] PI number "${cleanPiNo}" is already taken. Auto-advancing new PI to "${code}".`);
          cleanPiNo = code;
          targetKey = cleanPiNo.toLowerCase();
        }
      }

      setPiNumber(cleanPiNo);

      const existingMatchIdx = (piList || []).findIndex(p => {
        const pNo = String(p.piNo || '').trim().toLowerCase();
        const pId = String(p.id || '').trim().toLowerCase();
        return pNo === targetKey || pId === targetKey;
      });

      const matchedExisting = (isEditing && existingMatchIdx !== -1)
        ? piList[existingMatchIdx]
        : (isEditing && editIdx !== null ? piList[editIdx] : null);

      const sanitizedItems = (piItems || []).map(it => {
        const isPreset = Boolean(it.isPresetItem || it.presetGroupId);
        const resolvedUom = String(it.uom || it.unit || 'NOS').trim().toUpperCase() || 'NOS';
        const grp = it.presetGroupId ? presetGroups[it.presetGroupId] : null;
        const totalDisp = calculateTotalDispatchQty(
          it,
          grp?.setCount || 1,
          grp?.presetName || it.presetName,
          grp?.category || it.category
        );
        return {
          ...it,
          uom: resolvedUom,
          unit: resolvedUom,
          isPresetItem: isPreset,
          qtyPerSet: parseFloat(it.qty) || 0,
          totalDispatchQty: totalDisp,
          rate: isPreset ? '0' : String(it.rate || '0'),
          taxable: isPreset ? 0 : ((parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0)),
          hsn: String(it.hsn || it.hsn_or_sac || it.hsnCode || getHsnCode(it)).trim()
        };
      });

      const newPI = {
        id: cleanPiNo,
        piNo: cleanPiNo,
        vendor: vendorName,
        customerName: vendorName,
        contactPerson,
        phone,
        email,
        gstNo: (gstNo || '').toUpperCase(),
        productName: joinedProducts,
        hsn: sanitizedItems.find(it => it.hsn)?.hsn || getHsnCode(joinedProducts),
        items: sanitizedItems,
        presetGroups,
        billingAddress: {
          street: billingStreet,
          city: billingCity,
          state: billingState,
          pincode: billingPincode
        },
        deliveryAddress: {
          street: sameAsBilling ? billingStreet : deliveryStreet,
          city: sameAsBilling ? billingCity : deliveryCity,
          state: sameAsBilling ? billingState : deliveryState,
          pincode: sameAsBilling ? billingPincode : deliveryPincode
        },
        sameAsBilling,
        transportMode,
        transporterName,
        destination: destination.trim(),
        vehicleNo,
        transportScope,
        paymentTerms,
        creditDays,
        remarks,
        unitValue: Math.round(totals.sub),
        quantity: piItems.reduce((acc, it) => acc + (parseFloat(it.qty) || 0), 0) || 1,
        subtotal: totals.sub,
        kitSubtotal: totals.kitSubtotal,
        taxTotal: totals.gst,
        cgst: totals.cgst,
        sgst: totals.sgst,
        grandTotal: totals.grand,
        amount: '₹' + Math.round(totals.grand).toLocaleString('en-IN'),
        pdfName: pdfFile ? pdfFile.name : (signedPiDoc ? signedPiDoc.name : null),
        signedPiDoc: signedPiDoc || null,
        piDate: piDate || new Date().toISOString().split('T')[0],
        expDate: validUntilDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        status: isDraft ? 'Draft' : (isEditing && matchedExisting?.status === 'Converted to BOM' ? 'Converted to BOM' : 'Issued'),
        statusType: isDraft ? 'draft' : (isEditing && matchedExisting?.statusType === 'converted' ? 'converted' : 'issued'),
        salesPerson: (isEditing ? matchedExisting?.salesPerson : null) || (isTechSupport ? salesPerson || '' : getEffectiveSalesPerson()),
        salesperson: (isEditing ? matchedExisting?.salesPerson : null) || (isTechSupport ? salesPerson || '' : getEffectiveSalesPerson()),
        salesPersonCode: (isEditing ? matchedExisting?.salesPersonCode : null) || (isTechSupport ? selectedSalespersonCode || '' : (currentEmpId || '')),
        salesPersonEmail: (isEditing ? matchedExisting?.salesPersonEmail : null) || currentLoggedEmail || '',
        assignedSalesperson: (isEditing ? matchedExisting?.assignedSalesperson : null) || (isTechSupport ? salesPerson || '' : ''),
        assignedSalespersonCode: (isEditing ? matchedExisting?.assignedSalespersonCode : null) || (isTechSupport ? selectedSalespersonCode || '' : ''),
        assignedToName: (isEditing ? matchedExisting?.assignedToName : null) || (isTechSupport ? salesPerson || '' : ''),
        assignedToId: (isEditing ? matchedExisting?.assignedToId : null) || (isTechSupport ? selectedSalespersonCode || '' : ''),
        assignedAt: (isEditing ? matchedExisting?.assignedAt : null) || (isTechSupport && salesPerson ? new Date().toISOString() : null),
        assignedBy: (isEditing ? matchedExisting?.assignedBy : null) || (isTechSupport && salesPerson ? (currentEmpName || 'Tech Support') : null),
        assignedById: (isEditing ? matchedExisting?.assignedById : null) || (isTechSupport && salesPerson ? (currentEmpId || 'TS-001') : null),
        createdBy: (isEditing ? matchedExisting?.createdBy : null) || currentEmpName || (isTechSupport ? 'Tech Support' : getEffectiveSalesPerson()),
        createdById: (isEditing ? matchedExisting?.createdById : null) || currentEmpId || (isTechSupport ? 'TS-001' : ''),
        createdByRole: (isEditing ? matchedExisting?.createdByRole : null) || userRole || (isTechSupport ? 'Tech Support' : 'Sales Executive'),
        createdByEmail: (isEditing ? matchedExisting?.createdByEmail : null) || currentLoggedEmail || '',
        convertedBomCode: isEditing ? (matchedExisting?.convertedBomCode || null) : null,
        convertedBomNo: isEditing ? (matchedExisting?.convertedBomNo || null) : null,
        convertedToBom: isEditing ? Boolean(matchedExisting?.convertedToBom) : false,
        isConverted: isEditing ? Boolean(matchedExisting?.isConverted) : false,
        zohoSynced: matchedExisting?.zohoSynced || false,
        zohoEstimateId: matchedExisting?.zohoEstimateId || null,
        zohoModule: 'Quotes'
      };

      let updatedList;
      if (isEditing && existingMatchIdx !== -1) {
        updatedList = [...piList];
        updatedList[existingMatchIdx] = newPI;
        setEditIdx(null);
      } else if (isEditing && editIdx !== null && editIdx >= 0 && editIdx < piList.length) {
        updatedList = [...piList];
        updatedList[editIdx] = newPI;
        setEditIdx(null);
      } else {
        // ALWAYS PREPEND new PI to list without overwriting any existing PI
        updatedList = [newPI, ...piList];
        setEditIdx(null);
        try {
          notifyPiCreated({
            piNo: newPI.piNo,
            customerName: newPI.vendor,
            salesPerson: newPI.salesPerson,
            salesPersonCode: newPI.salesPersonCode,
            amount: newPI.amount
          });
        } catch (err) {
          console.warn('PI voice notification error:', err);
        }
      }
      updatePiList(updatedList);

      // Save Proforma Invoice to BUSINZ Database (PostgreSQL public.proforma_invoices)
      // NOTE: Strictly database-first. Zero automatic Zoho sync. Zoho push occurs ONLY when salesperson clicks "Push to Zoho".
      const sanitizedPayload = {
        ...stripDataUrlsFromRecord(newPI),
        isEdit: isEditing
      };
      delete sanitizedPayload.paymentProofDoc;
      delete sanitizedPayload.deliveryProofDoc;
      delete sanitizedPayload.deliveryAddressProofDoc;

      try {
        const response = await fetch('/api/estimates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sanitizedPayload)
        });

        const respText = await response.text();
        let data = null;
        try {
          data = respText ? JSON.parse(respText) : null;
        } catch (_) {
          data = null;
        }

        if (!response.ok || !data || data.success === false) {
          throw new Error(data?.error || `Server communication error (HTTP ${response.status}). Please check backend status.`);
        }

        const serverAssignedPiNo = data?.pi?.piNo || data?.estimate?.piNo;
        const finalEstNo = serverAssignedPiNo || data?.estimate?.piNo || cleanPiNo;

        if (serverAssignedPiNo && serverAssignedPiNo !== cleanPiNo) {
          console.warn(`[PI CONCURRENCY NOTIFICATION] Server auto-advanced PI number from ${cleanPiNo} to ${serverAssignedPiNo}`);
          showTopToast(`ℹ️ PI Number was auto-advanced to ${serverAssignedPiNo} to prevent overwriting existing record.`, 'info', 6000);
        }

        const enrichedList = updatedList.map(p => (p.piNo === newPI.piNo || p.id === newPI.id) ? {
          ...p,
          id: finalEstNo,
          piNo: finalEstNo,
          ...(data.pi || {})
        } : p);
        updatePiList(enrichedList);

        // Dismiss modal and advance to list view once confirmed safely stored in DB
        setPiConfirmModal(null);
        resetForm();
        setViewMode('list');

        const safeCustomer = (vendorName || 'Customer').trim();
        if (isDraft) {
          showTopToast(`📝 Proforma Invoice (${finalEstNo}) for ${safeCustomer} has been saved as Draft in BUSINZ database.`, 'info', 5000);
        } else {
          showTopToast(`Proforma Invoice (${finalEstNo}) for ${safeCustomer} stored permanently in BUSINZ database!`, 'success', 5000);
        }
      } catch (saveErr) {
        console.error('[ESTIMATE DB SAVE ERROR]', saveErr);
        showTopToast('❌ Failed to store Proforma Invoice in database: ' + (saveErr?.message || 'Server error. Please try again.'), 'error', 8000);
        // Do NOT reset form so salesperson never loses their entered form data!
        return;
      }
    } catch (err) {
      console.error('Error creating Proforma Invoice:', err);
      showTopToast('Error creating Proforma Invoice: ' + (err?.message || 'Please check your connection and try again.'), 'error', 6000);
    } finally {
      setIsSubmittingPI(false);
      setPiConfirmModal(null);
    }
  };

  // Pre-populates the fields to edit a Performa Invoice
  const handleStartEdit = (pi, idx) => {
    setEditIdx(idx);
    setPiNumber(pi.piNo || '');
    if (pi.piDate) setPiDate(pi.piDate);
    const todayStr = new Date().toISOString().split('T')[0];
    const incomingValidUntil = pi.validUntilDate || pi.expDate || pi.validUntil || '';
    setValidUntilDate(incomingValidUntil);
    setVendorName(pi.vendor || pi.customerName || '');
    setContactPerson(pi.contactPerson || '');
    setPhone(pi.phone || '');
    setEmail(pi.email || '');
    setGstNo(pi.gstNo || '');
    setSalesPerson(pi.salesPerson || getActiveUserName());
    setPaymentTerms(normalizePaymentTerm(pi.paymentTerms || pi.paymentType || '100% Paid'));
    setCreditDays(pi.creditDays || '');
    setTransportMode(pi.transportMode || 'Transport');
    setTransporterName(pi.transporterName || '');
    setDestination(pi.destination || pi.deliveryCity || '');
    setVehicleNo(pi.vehicleNo || '');
    setTransportScope(pi.transportScope || 'VRM Structures');

    // Robust Billing Address extraction (handles object, string, or direct properties)
    const bAddr = pi.billingAddress || pi.billingAddressObj || {};
    if (typeof bAddr === 'object') {
      setBillingStreet(bAddr.street || bAddr.address || pi.billingStreet || '');
      setBillingCity(bAddr.city || pi.billingCity || '');
      setBillingState(bAddr.state || pi.billingState || '');
      setBillingPincode(bAddr.pincode || bAddr.pin || pi.billingPincode || '');
    } else if (typeof bAddr === 'string') {
      setBillingStreet(bAddr || pi.billingStreet || '');
      setBillingCity(pi.billingCity || '');
      setBillingState(pi.billingState || '');
      setBillingPincode(pi.billingPincode || '');
    } else {
      setBillingStreet(pi.billingStreet || '');
      setBillingCity(pi.billingCity || '');
      setBillingState(pi.billingState || '');
      setBillingPincode(pi.billingPincode || '');
    }

    // Robust Delivery Address extraction
    const dAddr = pi.deliveryAddress || pi.deliveryAddressObj || {};
    if (typeof dAddr === 'object') {
      setDeliveryStreet(dAddr.street || dAddr.address || pi.deliveryStreet || '');
      setDeliveryCity(dAddr.city || pi.deliveryCity || '');
      setDeliveryState(dAddr.state || pi.deliveryState || '');
      setDeliveryPincode(dAddr.pincode || dAddr.pin || pi.deliveryPincode || '');
    } else if (typeof dAddr === 'string') {
      setDeliveryStreet(dAddr || pi.deliveryStreet || '');
      setDeliveryCity(pi.deliveryCity || '');
      setDeliveryState(pi.deliveryState || '');
      setDeliveryPincode(pi.deliveryPincode || '');
    } else {
      setDeliveryStreet(pi.deliveryStreet || '');
      setDeliveryCity(pi.deliveryCity || '');
      setDeliveryState(pi.deliveryState || '');
      setDeliveryPincode(pi.deliveryPincode || '');
    }
    setSameAsBilling(pi.sameAsBilling !== undefined ? pi.sameAsBilling : (!pi.deliveryStreet && !pi.deliveryAddress));
    if (pi.presetGroups) {
      setPresetGroups(pi.presetGroups);
    } else {
      setPresetGroups({});
    }
    if (Array.isArray(pi.items) && pi.items.length > 0) {
      setPiItems(pi.items.map(it => ({
        ...it,
        hsn: it.hsn || it.hsn_or_sac || it.hsnCode || getHsnCode(it) || pi.hsn
      })));
    } else {
      setPiItems([
        {
          name: pi.productName || 'Solar Mounting Structures & Fasteners',
          category: 'Structure Kit',
          uom: 'NOS',
          qty: String(pi.quantity || 1),
          rate: String(pi.unitValue || 25000),
          gstRate: '18%',
          hsn: pi.hsn || getHsnCode(pi.productName)
        }
      ]);
    }
    if (pi.signedPiDoc) {
      setSignedPiDoc(pi.signedPiDoc);
    } else if (pi.pdfName) {
      setSignedPiDoc({ name: pi.pdfName, size: 24000, uploadedAt: pi.piDate });
    } else {
      setSignedPiDoc(null);
    }
    setPdfFile(pi.pdfName ? { name: pi.pdfName, size: 3.2 * 1024 * 1024 } : null);
    setUploadProgress(100);
    setViewMode('edit');
    setActiveDropdownIdx(null);
  };

  // Clones/duplicates a Performa Invoice into a fresh new record with sequential number
  const handleClonePi = async (pi) => {
    if (!pi) return;
    resetForm();
    setEditIdx(null); // Creating a NEW record, not editing an existing one!

    // 1. Fetch fresh sequential PI Number
    const nextNo = await fetchNextPiNumber();
    if (nextNo) setPiNumber(nextNo);

    // 2. Set current date & validity (default 30 days)
    const todayStr = new Date().toISOString().split('T')[0];
    setPiDate(todayStr);
    const validDate = new Date();
    validDate.setDate(validDate.getDate() + 30);
    setValidUntilDate(validDate.toISOString().split('T')[0]);

    // 3. Clone Customer Information
    setVendorName(pi.vendor || pi.customerName || '');
    setContactPerson(pi.contactPerson || '');
    setPhone(pi.phone || '');
    setEmail(pi.email || '');
    setGstNo(pi.gstNo || '');
    setSalesPerson(getActiveUserName() || pi.salesPerson || '');

    // 4. Clone Terms & Transportation
    setPaymentTerms(normalizePaymentTerm(pi.paymentTerms || pi.paymentType || '100% Paid'));
    setCreditDays(pi.creditDays || '');
    setTransportMode(pi.transportMode || 'Transport');
    setTransporterName(pi.transporterName || '');
    setDestination(pi.destination || pi.deliveryCity || '');
    setVehicleNo('');
    setTransportScope(pi.transportScope || 'VRM Structures');

    // 5. Clone Billing Address
    const bAddr = pi.billingAddress || pi.billingAddressObj || {};
    if (typeof bAddr === 'object') {
      setBillingStreet(bAddr.street || bAddr.address || pi.billingStreet || '');
      setBillingCity(bAddr.city || pi.billingCity || '');
      setBillingState(bAddr.state || pi.billingState || '');
      setBillingPincode(bAddr.pincode || bAddr.pin || pi.billingPincode || '');
    } else if (typeof bAddr === 'string') {
      setBillingStreet(bAddr || pi.billingStreet || '');
      setBillingCity(pi.billingCity || '');
      setBillingState(pi.billingState || '');
      setBillingPincode(pi.billingPincode || '');
    } else {
      setBillingStreet(pi.billingStreet || '');
      setBillingCity(pi.billingCity || '');
      setBillingState(pi.billingState || '');
      setBillingPincode(pi.billingPincode || '');
    }

    // 6. Clone Delivery Address
    const dAddr = pi.deliveryAddress || pi.deliveryAddressObj || {};
    if (typeof dAddr === 'object') {
      setDeliveryStreet(dAddr.street || dAddr.address || pi.deliveryStreet || '');
      setDeliveryCity(dAddr.city || pi.deliveryCity || '');
      setDeliveryState(dAddr.state || pi.deliveryState || '');
      setDeliveryPincode(dAddr.pincode || dAddr.pin || pi.deliveryPincode || '');
    } else if (typeof dAddr === 'string') {
      setDeliveryStreet(dAddr || pi.deliveryStreet || '');
      setDeliveryCity(pi.deliveryCity || '');
      setDeliveryState(pi.deliveryState || '');
      setDeliveryPincode(pi.deliveryPincode || '');
    } else {
      setDeliveryStreet(pi.deliveryStreet || '');
      setDeliveryCity(pi.deliveryCity || '');
      setDeliveryState(pi.deliveryState || '');
      setDeliveryPincode(pi.deliveryPincode || '');
    }
    setSameAsBilling(pi.sameAsBilling !== undefined ? pi.sameAsBilling : (!pi.deliveryStreet && !pi.deliveryAddress));

    // 7. Clone Preset Groups & Items
    if (pi.presetGroups) {
      try {
        setPresetGroups(JSON.parse(JSON.stringify(pi.presetGroups)));
      } catch (_) {
        setPresetGroups(pi.presetGroups);
      }
    } else {
      setPresetGroups({});
    }

    if (Array.isArray(pi.items) && pi.items.length > 0) {
      setPiItems(pi.items.map(it => ({
        ...it,
        hsn: it.hsn || it.hsn_or_sac || it.hsnCode || getHsnCode(it) || pi.hsn
      })));
    } else {
      setPiItems([
        {
          name: pi.productName || 'Solar Mounting Structures & Fasteners',
          category: 'Structure Kit',
          uom: 'NOS',
          qty: String(pi.quantity || 1),
          rate: String(pi.unitValue || 25000),
          gstRate: '18%',
          hsn: pi.hsn || getHsnCode(pi.productName)
        }
      ]);
    }

    // 8. Documents start clean for cloned record
    setSignedPiDoc(null);
    setPdfFile(null);
    setUploadProgress(0);

    // 9. Open Create view
    setViewMode('create');
    setActiveDropdownIdx(null);
    showTopToast(`Cloned from PI ${pi.piNo || ''}. Assigned fresh PI number: ${nextNo || ''}`, 'success', 4000);
  };

  // Deletes the PI
  const executeDeletePI = () => {
    if (deleteIdx !== null) {
      updatePiList(piList.filter((_, i) => i !== deleteIdx));
      setDeleteIdx(null);
    }
  };

  return {
    calculatePiTotals,
    previewCurrentFormAsTemplate,
    handleAddMaterialRow,
    handleAddPresetItem,
    handleReorderPiItem,
    handleMovePiItemStep,
    handleMovePresetGroupBlock,
    handleConvertSelectedToPreset,
    handleCreateCustomSet,
    handleAddPresetToOrder,
    handleRemovePresetGroup,
    handleAttachSubPresetToGroup,
    handleRemoveMaterialRow,
    fetchNextPiNumber,
    resetForm,
    validatePiForm,
    triggerSaveConfirm,
    triggerDraftConfirm,
    executeCreatePI,
    handleStartEdit,
    handleClonePi,
    executeDeletePI
  };
}
