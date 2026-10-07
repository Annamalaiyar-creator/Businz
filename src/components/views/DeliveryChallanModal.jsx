import React, { useState, useMemo } from "react";
import { Truck, Printer, CheckCircle, Package, Info, Plus, Trash2 } from "lucide-react";
import { saveCloudStore } from "../../utils/supabaseDataSync";
import { centralInventoryStore } from "../../utils/centralInventoryStore";
import { resolveProductCode, normalizeProductName, CANONICAL_PRODUCT_ALIASES, VRM_PRODUCTS } from "../../utils/vrmProductsData";
import { notifyDispatchCompletedToSales } from "../../services/notificationService";

export default function DeliveryChallanModal({
  pendingDcModal,
  onClose,
  bomStore = [],
  setBomStore = () => {},
  invoiceList = [],
  setInvoiceList = () => {},
  userRole = 'Billing'
}) {
  const isExistingDc = Boolean(
    pendingDcModal && !pendingDcModal.isNew && (pendingDcModal.dcNo || (pendingDcModal.code && String(pendingDcModal.code).startsWith('DC-')))
  );
  const isLinkedInvoice = Boolean(
    pendingDcModal && !isExistingDc && !pendingDcModal.isNew && (pendingDcModal.invNo || pendingDcModal.invoiceNo)
  );
  const initialInv = pendingDcModal || {};

  const isBillingUser = useMemo(() => {
    const roleFromStorage = localStorage.getItem('controlroom_logged_user_role') || '';
    const nameFromStorage = localStorage.getItem('controlroom_logged_user_name') || '';
    const r = `${userRole} ${roleFromStorage} ${nameFromStorage}`.toLowerCase();
    return r.includes('billing') || r.includes('invoice') || r.includes('account') || r.includes('finance') || r.includes('admin') || r.includes('ceo') || r.includes('md');
  }, [userRole]);

  // DC Mode: "against_invoice" vs "direct_customer"
  const [dcMode, setDcMode] = useState(() => {
    if (isLinkedInvoice) return 'against_invoice';
    if (initialInv.dcMode === 'direct_customer' || initialInv.challanType === 'Direct Delivery Challan') return 'direct_customer';
    if (initialInv.dcMode === 'against_invoice' || initialInv.challanType === 'Against Invoice') return 'against_invoice';
    return isBillingUser ? 'against_invoice' : 'direct_customer';
  });

  // Collect existing customers from BOMs and customer directory for direct DC creation
  const existingCustomers = useMemo(() => {
    const setMap = new Map();
    (bomStore || []).forEach(b => {
      const name = (b.customerName || b.vendor || b.clientName || '').trim();
      const addr = (b.deliveryAddress || b.c6 || b.billingAddress || '').trim();
      const bomCode = b.bomCode || b.code || '';
      if (name && !setMap.has(name.toLowerCase())) {
        setMap.set(name.toLowerCase(), { name, address: addr, bomCode });
      }
    });
    try {
      const rawCust = localStorage.getItem('controlroom_customer_store');
      if (rawCust) {
        const parsed = JSON.parse(rawCust);
        if (Array.isArray(parsed)) {
          parsed.forEach(c => {
            const name = (c.name || c.companyName || c.contact_name || '').trim();
            const addr = (c.billingAddress || c.address || '').trim();
            if (name && !setMap.has(name.toLowerCase())) {
              setMap.set(name.toLowerCase(), { name, address: addr, bomCode: '' });
            }
          });
        }
      }
    } catch (_) {}
    return Array.from(setMap.values());
  }, [bomStore]);

  // Customer change handler with auto-fill
  const handleCustomerChange = (val) => {
    setCustomerName(val);
    const matched = existingCustomers.find(c => c.name.toLowerCase() === val.toLowerCase());
    if (matched) {
      if (matched.address && (!deliveryAddr || deliveryAddr === 'Client Delivery Site')) {
        setDeliveryAddr(matched.address);
      }
      if (matched.bomCode && (!bomRef || bomRef === 'N/A')) {
        setBomRef(matched.bomCode);
      }
    }
  };

  // Helper to generate sequential next DC Number
  const getNextDcNumber = () => {
    try {
      const raw = localStorage.getItem('controlroom_dc_store');
      const list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list) && list.length > 0) {
        let maxNum = 0;
        list.forEach(item => {
          const str = String(item.dcNo || item.code || '');
          const match = str.match(/DC-\d{4}-(\d+)/i) || str.match(/DC-(\d+)/i);
          if (match && match[1]) {
            const seq = parseInt(match[1], 10);
            if (seq > maxNum) maxNum = seq;
          }
        });
        const year = new Date().getFullYear();
        const nextSeq = String(maxNum + 1).padStart(4, '0');
        return `DC-${year}-${nextSeq}`;
      }
    } catch (_) {}
    const year = new Date().getFullYear();
    return `DC-${year}-0001`;
  };

  const generatedDcNo = useMemo(() => {
    if (isExistingDc) {
      return initialInv.dcNo || initialInv.code || 'DC-2026-0001';
    }
    return getNextDcNumber();
  }, [isExistingDc, initialInv?.dcNo, initialInv?.code]);

  // Selected invoice reference
  const [selectedInvNo, setSelectedInvNo] = useState(
    isLinkedInvoice ? (initialInv.invNo || initialInv.invoiceNo || '') : ''
  );
  const [customInvNo, setCustomInvNo] = useState('');

  // Customer & Order Fields
  const [customerName, setCustomerName] = useState(
    isExistingDc
      ? (initialInv.customerName || initialInv.vendor || '')
      : (isLinkedInvoice ? (initialInv.customerName || initialInv.vendor || '') : '')
  );
  const [bomRef, setBomRef] = useState(
    isExistingDc
      ? (initialInv.bomCode || initialInv.poNo || '')
      : (isLinkedInvoice ? (initialInv.bomCode || initialInv.poNo || '') : '')
  );
  const [deliveryAddr, setDeliveryAddr] = useState(
    isExistingDc
      ? (initialInv.deliveryAddress || '')
      : (isLinkedInvoice ? (initialInv.deliveryAddress || '') : '')
  );

  // Logistics Fields
  const [transporter, setTransporter] = useState(
    isExistingDc ? (initialInv.transporter || '') : ''
  );
  const [vehicleNo, setVehicleNo] = useState(
    isExistingDc ? (initialInv.vehicleNo || '') : ''
  );
  const [lrNo, setLrNo] = useState(
    isExistingDc ? (initialInv.lrNo || '') : ''
  );
  const [transportMode, setTransportMode] = useState(initialInv.mode || "Road Transport");

  // Helper to look up live available warehouse stock
  const getItemWarehouseStock = (item) => {
    try {
      const rawSaved = localStorage.getItem('controlroom_raw_materials_store');
      if (rawSaved) {
        const rawList = JSON.parse(rawSaved);
        const resCode = resolveProductCode(item);
        const rawCode = String(resCode || item?.code || '').toUpperCase().trim();
        const pCode = CANONICAL_PRODUCT_ALIASES[rawCode] || rawCode;
        const normN = normalizeProductName(item?.name || '');
        const match = rawList.find(rm => {
          const rmCode = String(rm.code || rm.sku || '').toUpperCase().trim();
          const rmNorm = normalizeProductName(rm.name || '');
          return rmCode === pCode || (normN && rmNorm === normN);
        });
        if (match) {
          return Number(match.availableStock !== undefined ? match.availableStock : (match.stock || 0));
        }
      }
    } catch (_) {}
    return 0;
  };

  // Derive initial items
  const deriveInitialItems = () => {
    if (isExistingDc) {
      return Array.isArray(initialInv.items) ? initialInv.items.map((it, idx) => ({
        ...it,
        originalIdx: idx,
        totalOrdered: Number(it.qty || it.bomQty || it.dcQty || 1),
        prevDispatched: Number(it.prevDispatched || 0),
        pendingQty: Number(it.dcQty || it.qty || 1),
        dcQty: Number(it.dcQty || it.qty || 1),
        rate: Number(it.rate || 0),
        liveStock: getItemWarehouseStock(it)
      })) : [];
    }
    if (isLinkedInvoice && Array.isArray(initialInv.items) && initialInv.items.length > 0) {
      return initialInv.items.map((it, idx) => {
        const totalOrdered = Number(it.qty || it.bomQty || 1);
        const prevDispatched = Number(it.dispatchedQty || 0);
        const pendingQty = Math.max(0, totalOrdered - prevDispatched);
        return {
          ...it,
          originalIdx: idx,
          totalOrdered,
          prevDispatched,
          pendingQty: pendingQty > 0 ? pendingQty : totalOrdered,
          dcQty: pendingQty > 0 ? pendingQty : totalOrdered,
          rate: Number(it.rate || 0),
          liveStock: getItemWarehouseStock(it)
        };
      });
    }
    // Fresh creation mode: starts completely EMPTY!
    return [];
  };

  const [itemsWithDcQty, setItemsWithDcQty] = useState(deriveInitialItems);
  const [selectedItems, setSelectedItems] = useState(() => deriveInitialItems().map((_, idx) => idx));

  // Handle selecting an invoice from dropdown
  const handleSelectInvoice = (invNo) => {
    setSelectedInvNo(invNo);
    if (!invNo) {
      // Switched to Direct DC (no invoice)
      setCustomerName('');
      setBomRef('');
      setDeliveryAddr('');
      setItemsWithDcQty([]);
      setSelectedItems([]);
      return;
    }

    const found = (invoiceList || []).find(i => (i.invNo === invNo || i.invoiceNo === invNo || i.code === invNo));
    if (found) {
      const cust = found.customerName || found.vendor || found.c2 || found.clientName || '';
      const bom = found.bomCode || found.poNo || found.c3 || '';
      const addr = found.deliveryAddress || '';
      setCustomerName(cust);
      setBomRef(bom);
      setDeliveryAddr(addr);

      if (found.items && Array.isArray(found.items) && found.items.length > 0) {
        const derived = found.items.map((it, idx) => {
          const totalOrdered = Number(it.qty || it.bomQty || 1);
          const prevDispatched = Number(it.dispatchedQty || 0);
          const pendingQty = Math.max(0, totalOrdered - prevDispatched);
          return {
            ...it,
            originalIdx: idx,
            totalOrdered,
            prevDispatched,
            pendingQty: pendingQty > 0 ? pendingQty : totalOrdered,
            dcQty: pendingQty > 0 ? pendingQty : totalOrdered,
            rate: Number(it.rate || 0),
            liveStock: getItemWarehouseStock(it)
          };
        });
        setItemsWithDcQty(derived);
        setSelectedItems(derived.map((_, i) => i));
      } else {
        const matchingBom = (bomStore || []).find(b => b.bomCode === bom || b.code === bom);
        if (matchingBom && matchingBom.items && matchingBom.items.length > 0) {
          const derived = matchingBom.items.map((it, idx) => ({
            ...it,
            originalIdx: idx,
            totalOrdered: Number(it.qty || it.bomQty || 1),
            prevDispatched: 0,
            pendingQty: Number(it.qty || it.bomQty || 1),
            dcQty: Number(it.qty || it.bomQty || 1),
            rate: Number(it.rate || 0),
            liveStock: getItemWarehouseStock(it)
          }));
          setItemsWithDcQty(derived);
          setSelectedItems(derived.map((_, i) => i));
        } else {
          setItemsWithDcQty([]);
          setSelectedItems([]);
        }
      }
    }
  };

  // Add a new empty item row
  const handleAddItem = () => {
    const newIdx = itemsWithDcQty.length;
    setItemsWithDcQty(prev => [
      ...prev,
      {
        code: '',
        name: '',
        desc: '',
        uom: 'Nos',
        totalOrdered: 1,
        prevDispatched: 0,
        pendingQty: 1,
        dcQty: 1,
        rate: 0,
        liveStock: 0,
        hsn: '76109090'
      }
    ]);
    setSelectedItems(prev => [...prev, newIdx]);
  };

  // Remove an item row
  const handleRemoveItem = (idxToRemove) => {
    setItemsWithDcQty(prev => prev.filter((_, i) => i !== idxToRemove));
    setSelectedItems(prev => prev.filter(i => i !== idxToRemove).map(i => (i > idxToRemove ? i - 1 : i)));
  };

  // Update item field
  const handleItemFieldChange = (idx, field, value) => {
    setItemsWithDcQty(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === 'dcQty') {
        const num = Math.max(1, parseInt(value, 10) || 1);
        updated.dcQty = num;
        if (!selectedInvNo) {
          updated.pendingQty = num;
          updated.totalOrdered = num;
        }
      } else if (field === 'rate') {
        updated.rate = Math.max(0, parseFloat(value) || 0);
      } else if (field === 'name') {
        const match = (VRM_PRODUCTS || []).find(p => p.name.toLowerCase() === String(value).toLowerCase());
        if (match) {
          updated.code = match.code;
          updated.uom = match.uom || 'Nos';
          updated.liveStock = getItemWarehouseStock(match);
        }
      } else if (field === 'code') {
        const match = (VRM_PRODUCTS || []).find(p => p.code.toLowerCase() === String(value).toLowerCase());
        if (match) {
          updated.name = match.name;
          updated.uom = match.uom || 'Nos';
          updated.liveStock = getItemWarehouseStock(match);
        } else {
          updated.liveStock = getItemWarehouseStock({ code: value, name: updated.name });
        }
      }
      return updated;
    }));
  };

  const toggleItemSelection = (idx) => {
    setSelectedItems(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const selectedGoodsList = itemsWithDcQty.filter((_, idx) => selectedItems.includes(idx));
  const totalTransitValuation = selectedGoodsList.reduce((acc, it) => acc + ((Number(it.dcQty) || 1) * (Number(it.rate) || 0)), 0);

  const effectiveInvRef = isExistingDc
    ? (initialInv.invNo && initialInv.invNo !== 'N/A' ? initialInv.invNo : '')
    : (dcMode === 'against_invoice' ? (selectedInvNo || customInvNo || '') : '');
  const effectiveBomRef = bomRef || (isExistingDc ? initialInv.bomCode : '');

  const handleSaveAndGenerateDc = () => {
    if (selectedGoodsList.length === 0) {
      alert("⚠️ Please add and select at least one item to dispatch on this Delivery Challan!");
      return;
    }
    const blankItem = selectedGoodsList.find(it => !String(it.name || '').trim() && !String(it.code || '').trim());
    if (blankItem) {
      alert("⚠️ Please provide a Product Name or Code for all selected items!");
      return;
    }
    if (dcMode === 'against_invoice' && !effectiveInvRef.trim()) {
      alert("⚠️ Please select an Originating Invoice for 'Against Invoice' DC mode, or switch to 'Direct to Customer' mode!");
      return;
    }
    if (!customerName.trim()) {
      alert("⚠️ Please enter a Customer / Consignee Name!");
      return;
    }
    if (!vehicleNo.trim()) {
      alert("⚠️ Please enter a Vehicle Number for the Delivery Challan!");
      return;
    }

    // 1. Create DC Record (Non-chargeable / Rule 55 CGST)
    const newDc = {
      dcNo: generatedDcNo,
      code: generatedDcNo,
      dcMode: dcMode,
      challanType: dcMode === 'against_invoice' ? 'Against Invoice' : 'Direct Delivery Challan',
      bomCode: effectiveBomRef || 'N/A',
      invNo: effectiveInvRef || 'N/A',
      customerName: customerName.trim(),
      vendor: customerName.trim(),
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      vehicleNo: vehicleNo.toUpperCase().trim(),
      transporter: transporter.trim() || 'Direct Fleet',
      lrNo: lrNo.trim() || '—',
      mode: transportMode,
      deliveryAddress: deliveryAddr.trim() || 'Client Delivery Site',
      status: 'IN TRANSIT',
      totalValue: totalTransitValuation,
      isNonChargeable: true,
      nonChargeableNotice: effectiveInvRef
        ? `Delivered against Invoice ${effectiveInvRef} (Already Billed / ₹0 Payment Collection)`
        : 'Rule 55 Statutory Goods Movement (Non-Chargeable / ₹0 Payment Collection)',
      itemCount: selectedGoodsList.length,
      items: selectedGoodsList.map(it => ({
        code: it.code || 'PRD-CUSTOM',
        name: it.name || 'Component Item',
        uom: it.uom || 'Nos',
        qty: it.dcQty || 1,
        dcQty: it.dcQty || 1,
        rate: it.rate || 0,
        hsn: it.hsn || '76109090'
      })),
      createdAt: new Date().toISOString()
    };

    // 2. Reduce Inventory Stock in Central Store
    centralInventoryStore.deductStockForDC(generatedDcNo, effectiveInvRef || 'DIRECT', newDc.items, 'Billing Executive');

    // 3. Persist in controlroom_dc_store
    try {
      const existingStr = localStorage.getItem('controlroom_dc_store');
      const dcs = existingStr ? JSON.parse(existingStr) : [];
      const updatedDcs = [newDc, ...(Array.isArray(dcs) ? dcs : []).filter(d => (d.dcNo !== newDc.dcNo && d.code !== newDc.dcNo))];
      localStorage.setItem('controlroom_dc_store', JSON.stringify(updatedDcs));
      saveCloudStore('delivery_challan_store', updatedDcs);
    } catch (err) {
      console.error("Error saving DC to store:", err);
    }

    // 4. Update Invoice Record to track dispatched vs pending quantities if linked
    if (effectiveInvRef && typeof setInvoiceList === 'function') {
      setInvoiceList(prev => (prev || []).map(invItem => {
        const isMatch = (invItem.invNo === effectiveInvRef || invItem.invoiceNo === effectiveInvRef || invItem.code === effectiveInvRef);
        if (!isMatch) return invItem;

        const updatedItems = (invItem.items || []).map(it => {
          const dispatchedNow = selectedGoodsList.find(s => s.code === it.code || s.name === it.name);
          const addQty = dispatchedNow ? Number(dispatchedNow.dcQty || 0) : 0;
          const prevDispatched = Number(it.dispatchedQty || 0);
          const totalDispatched = prevDispatched + addQty;
          const totalOrdered = Number(it.qty || it.bomQty || 1);
          return {
            ...it,
            dispatchedQty: totalDispatched,
            selected: totalDispatched >= totalOrdered
          };
        });

        const allFulfilled = updatedItems.every(it => Number(it.dispatchedQty || 0) >= Number(it.qty || it.bomQty || 1));

        return {
          ...invItem,
          status: allFulfilled ? 'CLOSED' : 'PARTIALLY DISPATCHED',
          pay: allFulfilled ? 'Fully Dispatched & Closed' : 'Partially Dispatched (DC Issued)',
          lastDcNo: generatedDcNo,
          dcNo: generatedDcNo,
          items: updatedItems
        };
      }));
    }

    // 5. Update BOM status if applicable
    if (effectiveBomRef && typeof setBomStore === 'function') {
      setBomStore(prev => (prev || []).map(b => {
        const isMatch = b.bomCode === effectiveBomRef || b.code === effectiveBomRef;
        if (isMatch) {
          const updatedDispatch = (b.dispatchPacking && b.dispatchPacking.length > 0)
            ? b.dispatchPacking.map(p => ({ ...p, packed: true }))
            : (b.items || []).map(it => ({ ...it, packed: true }));
          return {
            ...b,
            status: 'Completed',
            fullyCompleted: true,
            dcNo: generatedDcNo,
            dispatchPacking: updatedDispatch
          };
        }
        return b;
      }));
    }

    window.dispatchEvent(new CustomEvent('controlroom_storage_update', { detail: { key: 'controlroom_dc_store' } }));
    window.dispatchEvent(new Event('controlroom_storage_update'));
    window.dispatchEvent(new Event('storage'));

    // Notify Sales Person
    try {
      notifyDispatchCompletedToSales({
        bomCode: effectiveBomRef || generatedDcNo,
        customerName: customerName.trim(),
        vehicleNo: vehicleNo.toUpperCase().trim(),
        lrNo: lrNo ? lrNo.trim() : generatedDcNo,
        transporter: transporter ? transporter.trim() : 'Direct Fleet',
        deliveryMode: transportMode,
        status: 'Completed'
      });
    } catch (_) {}

    alert(`🚚 Delivery Challan ${generatedDcNo} created successfully!\n\n• Reference: ${effectiveInvRef || 'Direct DC'}\n• Customer: ${customerName}\n• Vehicle: ${vehicleNo.toUpperCase().trim()}\n• Billing Amount: ₹0.00 (Non-Chargeable / Rule 55 CGST)\n• Inventory Stock: Automatically reduced for all dispatched items.`);
    onClose();
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      width: '100%',
      fontFamily: "'DM Sans', sans-serif",
      backgroundColor: '#F8FAFC',
      padding: '20px 24px',
      boxSizing: 'border-box',
      borderRadius: '16px'
    }}>
      {/* HTML Datalist for VRM standard products */}
      <datalist id="vrm-product-catalog">
        {(VRM_PRODUCTS || []).map((p, idx) => (
          <option key={`${p.code || idx}`} value={p.name}>
            {p.code} — {p.name} ({p.uom || 'NOS'})
          </option>
        ))}
      </datalist>

      {/* HTML Datalist for Customer suggestions in Direct DC mode */}
      <datalist id="dc-customer-suggestions">
        {existingCustomers.map((c, idx) => (
          <option key={`${c.name}-${idx}`} value={c.name}>
            {c.name} {c.address ? `— ${c.address.slice(0, 45)}...` : ''}
          </option>
        ))}
      </datalist>

      <div style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        paddingBottom: '20px'
      }}>
        {/* TOP HEADER HERO CARD (MATCHING PO & PI DESIGN) */}
        <div style={{
          background: 'linear-gradient(135deg, #0E7490 0%, #155E75 100%)',
          borderRadius: '18px',
          padding: '22px 28px',
          color: '#FFFFFF',
          boxShadow: '0 10px 25px -5px rgba(14, 116, 144, 0.35)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              backgroundColor: 'rgba(255,255,255,0.18)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF'
            }}>
              <Truck style={{ width: '24px', height: '24px' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#FFFFFF', margin: 0, letterSpacing: '-0.3px' }}>
                  {isExistingDc ? `Delivery Challan: ${generatedDcNo}` : 'Create Delivery Challan (DC)'}
                </h1>
                <span style={{
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: '#FFFFFF',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: '800',
                  letterSpacing: '0.3px'
                }}>
                  RULE 55 CGST
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#CFFAFE', margin: '4px 0 0 0' }}>
                {isExistingDc
                  ? `Goods movement & dispatch audit for ${customerName || 'Customer'}`
                  : (effectiveInvRef
                    ? `Fulfill backordered & pending dispatch items for Invoice #${effectiveInvRef} (${customerName || 'Customer'})`
                    : (customerName ? `Goods movement & delivery challan for ${customerName}` : 'Issue statutory delivery challan for goods transit under Rule 55 CGST'))}
              </p>
            </div>
          </div>

          {/* Action Buttons on Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => onClose()}
              style={{
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.12)',
                padding: '9px 18px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '700',
                color: '#FFFFFF',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.15)',
                color: '#FFFFFF',
                padding: '9px 18px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Printer style={{ width: '15px', height: '15px' }} />
              Print DC
            </button>
            {!isExistingDc && (
              <button
                type="button"
                onClick={handleSaveAndGenerateDc}
                style={{
                  border: 'none',
                  background: '#10B981',
                  color: '#FFFFFF',
                  padding: '9px 22px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(16,185,129,0.4)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <CheckCircle style={{ width: '16px', height: '16px' }} />
                Issue DC & Deduct Stock
              </button>
            )}
          </div>
        </div>


        {/* SECTION 1: CHALLAN & CUSTOMER INFORMATION */}
        <div style={{
          backgroundColor: '#FFFFFF',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: '#0E7490',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: '800'
              }}>
                1
              </div>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                DELIVERY CHALLAN & CUSTOMER DETAILS
              </h3>
            </div>

            {/* Mode Switcher: Billing Login can choose Against Invoice or Direct to Customer; others do Direct */}
            {!isExistingDc && (
              isBillingUser ? (
                <div style={{
                  display: 'inline-flex',
                  backgroundColor: '#F1F5F9',
                  padding: '4px',
                  borderRadius: '12px',
                  border: '1px solid #CBD5E1',
                  gap: '4px'
                }}>
                  <button
                    type="button"
                    onClick={() => setDcMode('against_invoice')}
                    style={{
                      border: 'none',
                      background: dcMode === 'against_invoice' ? '#0E7490' : 'transparent',
                      color: dcMode === 'against_invoice' ? '#FFFFFF' : '#475569',
                      padding: '7px 16px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: dcMode === 'against_invoice' ? '0 2px 6px rgba(14,116,144,0.3)' : 'none'
                    }}
                  >
                    Against Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDcMode('direct_customer');
                      setSelectedInvNo('');
                      setCustomInvNo('');
                    }}
                    style={{
                      border: 'none',
                      background: dcMode === 'direct_customer' ? '#0E7490' : 'transparent',
                      color: dcMode === 'direct_customer' ? '#FFFFFF' : '#475569',
                      padding: '7px 16px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: dcMode === 'direct_customer' ? '0 2px 6px rgba(14,116,144,0.3)' : 'none'
                    }}
                  >
                    Direct to Customer
                  </button>
                </div>
              ) : (
                <span style={{
                  backgroundColor: '#ECFEFF',
                  color: '#0E7490',
                  border: '1px solid #A5F3FC',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '800'
                }}>
                  Direct to Customer (Rule 55)
                </span>
              )
            )}
          </div>

          {/* 4-column Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                DC Number
              </label>
              <input
                type="text"
                value={generatedDcNo}
                readOnly
                disabled
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CFFAFE', padding: '0 14px', fontSize: '13px', fontWeight: '700', color: '#0E7490', backgroundColor: '#F0FDFA', cursor: 'not-allowed', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Challan Date
              </label>
              <input
                type="text"
                value={initialInv.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                readOnly
                disabled
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#475569', backgroundColor: '#F8FAFC', cursor: 'not-allowed', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Originating Invoice Ref {dcMode === 'against_invoice' && <span style={{ color: '#EF4444' }}>*</span>}
              </label>
              {isExistingDc ? (
                <input
                  type="text"
                  value={initialInv.invNo || 'N/A (Direct DC)'}
                  readOnly
                  disabled
                  style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#475569', backgroundColor: '#F8FAFC', cursor: 'not-allowed', boxSizing: 'border-box', outline: 'none' }}
                />
              ) : dcMode === 'against_invoice' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <select
                    value={selectedInvNo}
                    onChange={(e) => handleSelectInvoice(e.target.value)}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #0E7490', padding: '0 12px', fontSize: '13px', fontWeight: '700', color: '#0F172A', outline: 'none', backgroundColor: '#FFFFFF', boxSizing: 'border-box' }}
                  >
                    <option value="">-- Select Originating Invoice --</option>
                    {(invoiceList || []).filter(i => (i.invNo || i.invoiceNo || i.code)).map(invItem => {
                      const no = invItem.invNo || invItem.invoiceNo || invItem.code;
                      const cust = invItem.customerName || invItem.vendor || invItem.c2 || 'Customer';
                      return (
                        <option key={no} value={no}>
                          {no} — {cust}
                        </option>
                      );
                    })}
                  </select>
                  {!selectedInvNo && (
                    <input
                      type="text"
                      value={customInvNo}
                      onChange={(e) => setCustomInvNo(e.target.value)}
                      placeholder="Or enter custom Invoice Ref (e.g. INV-0042)..."
                      style={{ width: '100%', height: '34px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12px', color: '#334155', outline: 'none', boxSizing: 'border-box' }}
                    />
                  )}
                </div>
              ) : (
                <div style={{
                  height: '42px',
                  borderRadius: '10px',
                  border: '1px dashed #CBD5E1',
                  backgroundColor: '#F8FAFC',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#64748B'
                }}>
                  Direct Dispatch (No Invoice Required)
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                BOM Order Ref
              </label>
              <input
                type="text"
                disabled={isExistingDc}
                value={bomRef}
                onChange={(e) => setBomRef(e.target.value)}
                placeholder="Enter BOM Ref (e.g. BOM-101)..."
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: isExistingDc ? '#F8FAFC' : '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          </div>

          {/* Customer & Address Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Customer / Consignee Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                list="dc-customer-suggestions"
                disabled={isExistingDc}
                value={customerName}
                onChange={(e) => handleCustomerChange(e.target.value)}
                placeholder="Type or select customer name..."
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', fontWeight: '700', color: '#0F172A', backgroundColor: isExistingDc ? '#F8FAFC' : '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Delivery Destination / Consignee Address <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                disabled={isExistingDc}
                value={deliveryAddr}
                onChange={(e) => setDeliveryAddr(e.target.value)}
                placeholder="Enter client delivery destination address..."
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: isExistingDc ? '#F8FAFC' : '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: TRANSPORT & LOGISTICS DETAILS */}
        <div style={{
          backgroundColor: '#FFFFFF',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: '#0E7490',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: '800'
            }}>
              2
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              TRANSPORT & LOGISTICS DETAILS
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Transporter Name
              </label>
              <input
                type="text"
                disabled={isExistingDc}
                value={transporter}
                onChange={(e) => setTransporter(e.target.value)}
                placeholder="e.g. VRL Logistics / Company Fleet..."
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: isExistingDc ? '#F8FAFC' : '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Vehicle Number <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                disabled={isExistingDc}
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                placeholder="e.g. TN-09-AB-1234"
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', color: '#0F172A', backgroundColor: isExistingDc ? '#F8FAFC' : '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Lorry Receipt (LR) No.
              </label>
              <input
                type="text"
                disabled={isExistingDc}
                value={lrNo}
                onChange={(e) => setLrNo(e.target.value)}
                placeholder="e.g. LR-2026-1001 (optional)"
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: isExistingDc ? '#F8FAFC' : '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Mode of Transport
              </label>
              <select
                disabled={isExistingDc}
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value)}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: isExistingDc ? '#F8FAFC' : '#FFFFFF', boxSizing: 'border-box', outline: 'none', cursor: 'pointer' }}
              >
                <option>Road Transport</option>
                <option>Rail Freight</option>
                <option>Air Express</option>
                <option>Direct Customer Pickup</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 3: ITEMS TO DELIVER */}
        <div style={{
          backgroundColor: '#FFFFFF',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: '#0E7490',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: '800'
              }}>
                3
              </div>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ITEMS TO DELIVER
                </h3>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  Specify the items and dispatch quantity. Warehouse inventory will be deducted automatically upon issue.
                </span>
              </div>
            </div>

            {!isExistingDc && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleAddItem}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(14, 116, 144, 0.3)'
                  }}
                >
                  <Plus style={{ width: '14px', height: '14px' }} /> Add Line Item
                </button>

                {itemsWithDcQty.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedItems.length === itemsWithDcQty.length) {
                          setSelectedItems([]);
                        } else {
                          setSelectedItems(itemsWithDcQty.map((_, i) => i));
                        }
                      }}
                      style={{
                        border: '1px solid #CBD5E1',
                        background: '#F8FAFC',
                        color: '#475569',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      {selectedItems.length === itemsWithDcQty.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <span style={{ fontSize: '12px', color: '#0E7490', fontWeight: '800', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', padding: '6px 12px', borderRadius: '8px' }}>
                      {selectedGoodsList.length} of {itemsWithDcQty.length} Selected
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Items Table */}
          <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>
                  {!isExistingDc && <th style={{ padding: '12px', textAlign: 'center', width: '40px' }}>Select</th>}
                  <th style={{ padding: '12px', width: '140px' }}>Product Code</th>
                  <th style={{ padding: '12px' }}>Product Name</th>
                  <th style={{ padding: '12px', textAlign: 'center', width: '80px' }}>UOM</th>
                  {selectedInvNo && <th style={{ padding: '12px', textAlign: 'center' }}>Invoiced Qty</th>}
                  {selectedInvNo && <th style={{ padding: '12px', textAlign: 'center' }}>Prev. Dispatched</th>}
                  <th style={{ padding: '12px', textAlign: 'center', width: '120px' }}>DC Dispatch Qty</th>
                  <th style={{ padding: '12px', textAlign: 'center', width: '140px' }}>Warehouse Stock</th>
                  <th style={{ padding: '12px', textAlign: 'right', width: '110px' }}>Unit Valuation</th>
                  <th style={{ padding: '12px', textAlign: 'right', width: '130px' }}>Transit Valuation</th>
                  {!isExistingDc && <th style={{ padding: '12px', textAlign: 'center', width: '50px' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {itemsWithDcQty.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: '48px 24px', textAlign: 'center', backgroundColor: '#FAFBFC' }}>
                      <Package style={{ width: '40px', height: '40px', color: '#94A3B8', margin: '0 auto 12px auto', display: 'block' }} />
                      <div style={{ fontWeight: '800', fontSize: '15px', color: '#334155' }}>No items in Delivery Challan</div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', marginBottom: '16px' }}>
                        Click below to add products for transit or pick an Originating Invoice above.
                      </div>
                      {!isExistingDc && (
                        <button
                          type="button"
                          onClick={handleAddItem}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: '#0E7490',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '8px 20px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(14, 116, 144, 0.3)'
                          }}
                        >
                          <Plus style={{ width: '15px', height: '15px' }} /> Add Line Item
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  itemsWithDcQty.map((it, idx) => {
                    const isChecked = selectedItems.includes(idx);
                    const dcQty = it.dcQty !== undefined ? it.dcQty : (it.pendingQty || it.qty || 1);
                    const rate = it.rate !== undefined ? it.rate : 0;
                    const val = dcQty * rate;
                    const liveStock = it.liveStock !== undefined ? it.liveStock : 0;
                    const isLow = liveStock < dcQty;

                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          backgroundColor: isChecked ? '#FFFFFF' : '#FAFBFC',
                          opacity: isChecked ? 1 : 0.6
                        }}
                      >
                        {!isExistingDc && (
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleItemSelection(idx)}
                              style={{ accentColor: '#0E7490', width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                          </td>
                        )}
                        <td style={{ padding: '10px 12px' }}>
                          {isExistingDc ? (
                            <span style={{ fontWeight: 'bold', color: '#475569', fontFamily: 'monospace' }}>
                              {it.code || '—'}
                            </span>
                          ) : (
                            <input
                              type="text"
                              value={it.code || ''}
                              onChange={(e) => handleItemFieldChange(idx, 'code', e.target.value)}
                              placeholder="Code"
                              style={{
                                width: '100%',
                                height: '34px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                padding: '0 8px',
                                fontSize: '12px',
                                fontWeight: '700',
                                fontFamily: 'monospace',
                                color: '#0E7490',
                                outline: 'none',
                                boxSizing: 'border-box'
                              }}
                            />
                          )}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {isExistingDc ? (
                            <span style={{ fontWeight: '700', color: '#0F172A' }}>
                              {it.name}
                            </span>
                          ) : (
                            <input
                              type="text"
                              list="vrm-product-catalog"
                              value={it.name || ''}
                              onChange={(e) => handleItemFieldChange(idx, 'name', e.target.value)}
                              placeholder="Select or enter product name..."
                              style={{
                                width: '100%',
                                height: '34px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                padding: '0 10px',
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#0F172A',
                                outline: 'none',
                                boxSizing: 'border-box'
                              }}
                            />
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {isExistingDc ? (
                            <span style={{ color: '#64748B' }}>{it.uom || 'Nos'}</span>
                          ) : (
                            <select
                              value={it.uom || 'Nos'}
                              onChange={(e) => handleItemFieldChange(idx, 'uom', e.target.value)}
                              style={{
                                height: '34px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                padding: '0 6px',
                                fontSize: '12px',
                                color: '#334155',
                                outline: 'none',
                                backgroundColor: '#FFFFFF'
                              }}
                            >
                              <option value="Nos">Nos</option>
                              <option value="Sets">Sets</option>
                              <option value="Kg">Kg</option>
                              <option value="Mtr">Mtr</option>
                              <option value="MT">MT</option>
                              <option value="Pcs">Pcs</option>
                              <option value="Box">Box</option>
                            </select>
                          )}
                        </td>
                        {selectedInvNo && (
                          <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#475569' }}>
                            {it.totalOrdered || it.qty || 1}
                          </td>
                        )}
                        {selectedInvNo && (
                          <td style={{ padding: '12px', textAlign: 'center', color: '#64748B' }}>
                            {it.prevDispatched || 0}
                          </td>
                        )}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {isExistingDc ? (
                            <span style={{ fontWeight: '800', color: '#0E7490', fontSize: '13px' }}>
                              {dcQty} {it.uom || 'Nos'}
                            </span>
                          ) : (
                            <input
                              type="number"
                              min="1"
                              value={dcQty}
                              onChange={(e) => handleItemFieldChange(idx, 'dcQty', e.target.value)}
                              style={{
                                width: '76px',
                                height: '34px',
                                textAlign: 'center',
                                borderRadius: '6px',
                                border: '1.5px solid #0E7490',
                                fontWeight: '800',
                                color: '#0E7490',
                                fontSize: '13px',
                                backgroundColor: '#F0FDFA',
                                outline: 'none'
                              }}
                            />
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '800',
                            backgroundColor: isLow ? '#FEF2F2' : '#ECFDF5',
                            color: isLow ? '#DC2626' : '#059669',
                            border: isLow ? '1px solid #FECACA' : '1px solid #A7F3D0'
                          }}>
                            {isLow ? `⚠️ ${liveStock.toLocaleString()} WH` : `✓ ${liveStock.toLocaleString()} WH`}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          {isExistingDc ? (
                            <span style={{ color: '#475569', fontWeight: '600' }}>
                              ₹ {rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={rate}
                              onChange={(e) => handleItemFieldChange(idx, 'rate', e.target.value)}
                              placeholder="0.00"
                              style={{
                                width: '80px',
                                height: '34px',
                                textAlign: 'right',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                padding: '0 8px',
                                fontSize: '12px',
                                fontWeight: '700',
                                color: '#0F172A',
                                outline: 'none'
                              }}
                            />
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                          ₹ {val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <div style={{ fontSize: '10px', color: '#16A34A', fontWeight: '700' }}>₹0.00 Billed</div>
                        </td>
                        {!isExistingDc && (
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              title="Delete Item"
                              style={{
                                border: 'none',
                                background: '#FEE2E2',
                                color: '#DC2626',
                                borderRadius: '6px',
                                width: '28px',
                                height: '28px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 style={{ width: '14px', height: '14px' }} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}

                {/* Subtotal / Footer Row */}
                {itemsWithDcQty.length > 0 && (
                  <tr style={{ backgroundColor: '#F8FAFC', fontWeight: '800' }}>
                    <td colSpan={isExistingDc ? 7 : (selectedInvNo ? 8 : 6)} style={{ padding: '14px 16px', textAlign: 'right', color: '#0F172A' }}>
                      Total Transit Valuation (Rule 55 Insurance Baseline):
                    </td>
                    <td colSpan={!isExistingDc ? 3 : 2} style={{ padding: '14px 16px', textAlign: 'right', color: '#0E7490', fontSize: '15px' }}>
                      ₹ {totalTransitValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span style={{ display: 'block', fontSize: '11px', color: '#16A34A', fontWeight: '700', marginTop: '2px' }}>
                        Customer Amount Due: ₹ 0.00 (Non-Chargeable)
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 4: STATUTORY DECLARATION & SIGNATURE */}
        <div style={{
          backgroundColor: '#FFFFFF',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: '#0E7490',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: '800'
            }}>
              4
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              STATUTORY DECLARATION (RULE 55 CGST RULES)
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', backgroundColor: '#F8FAFC', padding: '18px 20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.6' }}>
              <strong style={{ color: '#0F172A', display: 'block', marginBottom: '4px' }}>Rule 55 Statutory Declaration:</strong>
              We declare that this Delivery Challan is issued strictly for subsequent transportation of goods not by way of supply. The goods described above are being transported under Rule 55 of CGST Rules, 2017{effectiveInvRef ? ` in fulfillment of backordered / pending quantities already billed under Tax Invoice #${effectiveInvRef}` : ''}. No further sales consideration is payable.
            </div>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingLeft: '20px', borderLeft: '1px solid #E2E8F0' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>BUSINZ Industrial Technologies Ltd</div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>GSTIN: 33AAAAA0000A1Z5</div>
              </div>
              <div style={{ marginTop: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#0E7490' }}>Authorised Billing Signatory</div>
                <div style={{ fontSize: '10px', color: '#94A3B8' }}>Electronically Verified & Logged</div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BUTTON BAR */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 0',
          borderTop: '1px solid #E2E8F0'
        }}>
          <button
            type="button"
            onClick={() => onClose()}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '10px',
              padding: '10px 22px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '10px',
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#334155',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Printer style={{ width: '15px', height: '15px' }} />
            Print DC
          </button>
          {!isExistingDc && (
            <button
              type="button"
              onClick={handleSaveAndGenerateDc}
              style={{
                backgroundColor: '#0E7490',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 26px',
                fontSize: '13px',
                fontWeight: '800',
                color: '#FFFFFF',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(14, 116, 144, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle style={{ width: '16px', height: '16px' }} />
              Issue DC & Deduct Stock
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
