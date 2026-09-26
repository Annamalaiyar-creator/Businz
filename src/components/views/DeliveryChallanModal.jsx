import React, { useState, useMemo } from "react";
import { ChevronLeft, Truck, Printer, CheckCircle, Package, AlertCircle, FileText, Info } from "lucide-react";
import { saveCloudStore } from "../../utils/supabaseDataSync";
import { centralInventoryStore, TX_TYPES } from "../../utils/centralInventoryStore";
import { resolveProductCode, normalizeProductName, CANONICAL_PRODUCT_ALIASES } from "../../utils/vrmProductsData";

export default function DeliveryChallanModal({
  pendingDcModal,
  onClose,
  bomStore = [],
  setBomStore = () => {},
  invoiceList = [],
  setInvoiceList = () => {}
}) {
  const initialInv = pendingDcModal || {};
  const isExistingDc = Boolean(initialInv.dcNo || (initialInv.code && String(initialInv.code).startsWith('DC-')));

  // Selected invoice for new DC
  const [selectedInvNo, setSelectedInvNo] = useState(
    initialInv.invNo || initialInv.invoiceNo || initialInv.code || ''
  );

  // Active invoice record
  const inv = useMemo(() => {
    if (isExistingDc) return initialInv;
    if (selectedInvNo && Array.isArray(invoiceList) && invoiceList.length > 0) {
      const found = invoiceList.find(i => (i.invNo === selectedInvNo || i.invoiceNo === selectedInvNo || i.code === selectedInvNo));
      if (found) return found;
    }
    return initialInv;
  }, [selectedInvNo, invoiceList, initialInv, isExistingDc]);

  const invNoText = inv.invNo || inv.invoiceNo || inv.code || 'INV-000012';
  const bomRefText = inv.bomCode || inv.poNo || inv.c3 || 'BOM-977';
  const customerText = inv.customerName || inv.vendor || inv.c2 || inv.clientName || 'Valued Customer';

  // Look up matching BOM for technical/dispatch specs
  const matchingBom = (bomStore || []).find(b =>
    b.bomCode === inv.bomCode ||
    b.bomCode === inv.poNo ||
    b.bomCode === inv.code ||
    b.code === inv.bomCode ||
    (b.salesOrderNo && (b.salesOrderNo === inv.poNo || b.salesOrderNo === inv.c3))
  );

  // Helper to look up live available warehouse stock
  const getItemWarehouseStock = (item) => {
    try {
      const rawSaved = localStorage.getItem('controlroom_raw_materials_store');
      if (rawSaved) {
        const rawList = JSON.parse(rawSaved);
        const resCode = resolveProductCode(item);
        const rawCode = String(resCode || item.code || '').toUpperCase().trim();
        const pCode = CANONICAL_PRODUCT_ALIASES[rawCode] || rawCode;
        const normN = normalizeProductName(item.name || '');
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

  // Derive unpacked/pending items from the invoice
  const rawItems = useMemo(() => {
    if (inv.items && Array.isArray(inv.items) && inv.items.length > 0) {
      return inv.items.map((it, idx) => {
        const totalOrdered = Number(it.qty || it.bomQty || 1);
        const prevDispatched = Number(it.dispatchedQty || (it.selected && !isExistingDc ? totalOrdered : 0));
        const pendingQty = Math.max(0, totalOrdered - prevDispatched);
        const curStock = getItemWarehouseStock(it);
        return {
          ...it,
          originalIdx: idx,
          totalOrdered,
          prevDispatched,
          pendingQty: isExistingDc ? totalOrdered : (pendingQty > 0 ? pendingQty : totalOrdered),
          dcQty: isExistingDc ? totalOrdered : (pendingQty > 0 ? pendingQty : totalOrdered),
          liveStock: curStock
        };
      });
    }
    if (matchingBom && matchingBom.items && matchingBom.items.length > 0) {
      return matchingBom.items.map((it, idx) => ({
        ...it,
        originalIdx: idx,
        totalOrdered: Number(it.qty || it.bomQty || 1),
        prevDispatched: 0,
        pendingQty: Number(it.qty || it.bomQty || 1),
        dcQty: Number(it.qty || it.bomQty || 1),
        liveStock: getItemWarehouseStock(it)
      }));
    }
    return [
      { code: 'MR100N', name: 'Mini Rail 100 mm (HDG)', desc: 'Aluminum Solar Mounting Rail', uom: 'Nos', totalOrdered: 12, prevDispatched: 0, pendingQty: 12, dcQty: 12, rate: 250, liveStock: 1800 }
    ];
  }, [inv, matchingBom, isExistingDc]);

  const [itemsWithDcQty, setItemsWithDcQty] = useState(rawItems);

  // Sync items when rawItems changes (e.g. invoice switch)
  React.useEffect(() => {
    setItemsWithDcQty(rawItems);
    setSelectedItems(rawItems.map((_, idx) => idx));
  }, [rawItems]);

  // Form State
  const [transporter, setTransporter] = useState(inv.transporter || "VRL Logistics Ltd.");
  const [vehicleNo, setVehicleNo] = useState(inv.vehicleNo || "TN-09-CB-4890");
  const [lrNo, setLrNo] = useState(inv.lrNo || `LR-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [transportMode, setTransportMode] = useState(inv.mode || "Road Transport");
  const [deliveryAddr, setDeliveryAddr] = useState(
    inv.deliveryAddress || matchingBom?.deliveryAddress || 'Plot 14, Nagappa Industrial Estate, Puzhal, Chennai 600066'
  );
  const [selectedItems, setSelectedItems] = useState(rawItems.map((_, idx) => idx));

  const toggleItemSelection = (idx) => {
    setSelectedItems(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleDcQtyChange = (idx, val) => {
    const num = Math.max(1, parseInt(val, 10) || 1);
    setItemsWithDcQty(prev => prev.map((it, i) => i === idx ? { ...it, dcQty: num } : it));
  };

  const selectedGoodsList = itemsWithDcQty.filter((_, idx) => selectedItems.includes(idx));
  const totalTransitValuation = selectedGoodsList.reduce((acc, it) => acc + ((it.dcQty || it.qty || 1) * (it.rate || 250)), 0);

  const generatedDcNo = inv.dcNo || (inv.code && String(inv.code).startsWith('DC-') ? inv.code : `DC-2026-${String(Date.now()).slice(-4)}`);

  const handleSaveAndGenerateDc = () => {
    if (selectedGoodsList.length === 0) {
      alert("⚠️ Please select at least one pending item to dispatch on this Delivery Challan!");
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
      bomCode: bomRefText,
      invNo: invNoText,
      customerName: customerText,
      vendor: customerText,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      vehicleNo: vehicleNo.toUpperCase().trim(),
      transporter: transporter.trim(),
      lrNo: lrNo.trim(),
      mode: transportMode,
      deliveryAddress: deliveryAddr,
      status: 'IN TRANSIT',
      totalValue: totalTransitValuation,
      isNonChargeable: true,
      nonChargeableNotice: `Delivered against Invoice ${invNoText} (Already Billed / ₹0 Payment Collection)`,
      itemCount: selectedGoodsList.length,
      items: selectedGoodsList.map(it => ({
        code: it.code,
        name: it.name,
        uom: it.uom || 'Nos',
        qty: it.dcQty,
        dcQty: it.dcQty,
        rate: it.rate || 250,
        hsn: it.hsn || '76109090'
      })),
      createdAt: new Date().toISOString()
    };

    // 2. Reduce Inventory Stock in Central Store & Raw Materials Store
    centralInventoryStore.deductStockForDC(generatedDcNo, invNoText, newDc.items, 'Billing Executive');

    // 3. Persist in controlroom_dc_store
    try {
      const existingStr = localStorage.getItem('controlroom_dc_store');
      const dcs = existingStr ? JSON.parse(existingStr) : [];
      const updatedDcs = [newDc, ...dcs.filter(d => (d.dcNo !== newDc.dcNo && d.code !== newDc.dcNo))];
      localStorage.setItem('controlroom_dc_store', JSON.stringify(updatedDcs));
      saveCloudStore('delivery_challan_store', updatedDcs);
    } catch (err) {
      console.error("Error saving DC to store:", err);
    }

    // 4. Update Invoice Record to track dispatched vs pending quantities
    if (typeof setInvoiceList === 'function') {
      setInvoiceList(prev => (prev || []).map(invItem => {
        const isMatch = (invItem.invNo === invNoText || invItem.invoiceNo === invNoText || invItem.code === invNoText);
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
    if (typeof setBomStore === 'function') {
      setBomStore(prev => (prev || []).map(b => {
        const isMatch = b.bomCode === bomRefText || b.code === bomRefText || b.bomCode === inv.poNo || b.bomCode === inv.invNo;
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

    alert(`🚚 Delivery Challan ${generatedDcNo} created successfully!\n\n• Reference Invoice: ${invNoText}\n• Customer: ${customerText}\n• Billing Amount: ₹0.00 (Non-Chargeable / Customer already paid in original invoice)\n• Inventory Stock: Automatically reduced for all dispatched items.`);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#F8FAFC', zIndex: 99999, overflowY: 'auto', padding: '24px', boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: '16px 24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => onClose()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '700', color: '#475569', cursor: 'pointer' }}
          >
            <ChevronLeft style={{ width: '16px', height: '16px' }} /> Back to Billing
          </button>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck style={{ width: '20px', height: '20px', color: '#0E7490' }} />
              {isExistingDc ? `Delivery Challan Details (${generatedDcNo})` : 'Create Delivery Challan (DC) — Billing Portal'}
            </h1>
            <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', display: 'block' }}>
              DC No: <strong style={{ color: '#0E7490' }}>{generatedDcNo}</strong> | Invoice Ref: <strong style={{ color: '#2563EB' }}>{invNoText}</strong> | Customer: <strong>{customerText}</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => window.print()}
            style={{ border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#334155', height: '40px', padding: '0 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer style={{ width: '15px', height: '15px', color: '#475569' }} /> Print DC
          </button>

          {!isExistingDc && (
            <button
              onClick={handleSaveAndGenerateDc}
              style={{ border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', height: '40px', padding: '0 24px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 2px 4px rgba(14,116,144,0.25)', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <CheckCircle style={{ width: '16px', height: '16px' }} />
              Issue DC & Deduct Stock
            </button>
          )}

          <button
            onClick={() => onClose()}
            style={{ border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', color: '#475569', height: '40px', padding: '0 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>

      {/* NON-CHARGEABLE / RULE 55 CGST HIGHLIGHT BANNER */}
      <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A', flexShrink: 0 }}>
            <Info style={{ width: '20px', height: '20px' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#166534' }}>
              NON-CHARGEABLE DELIVERY CHALLAN (RULE 55 CGST RULES, 2017)
            </div>
            <div style={{ fontSize: '12px', color: '#15803D', marginTop: '2px' }}>
              Goods transit document for backordered / pending items. Customer has already paid / been billed under <strong>Invoice #{invNoText}</strong>. No payment will be collected (₹0 Financial Amount).
            </div>
          </div>
        </div>
        <div style={{ backgroundColor: '#DCFCE7', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '800', color: '#166534', whiteSpace: 'nowrap' }}>
          Payment Status: Already Settled (₹0 Due)
        </div>
      </div>

      {/* INVOICE SELECTOR (ONLY SHOWN IF CREATING NEW DC AND MULTIPLE INVOICES EXIST) */}
      {!isExistingDc && Array.isArray(invoiceList) && invoiceList.length > 0 && (
        <div style={{ backgroundColor: '#FFFFFF', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB', flexShrink: 0 }}>
            <FileText style={{ width: '18px', height: '18px' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              Select Originating Invoice for Delivery Challan
            </label>
            <select
              value={selectedInvNo}
              onChange={(e) => setSelectedInvNo(e.target.value)}
              style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', fontWeight: '700', color: '#0F172A', outline: 'none' }}
            >
              {invoiceList.map(invItem => {
                const no = invItem.invNo || invItem.invoiceNo || invItem.code;
                const cust = invItem.customerName || invItem.vendor || invItem.c2 || 'Customer';
                const count = Array.isArray(invItem.items) ? invItem.items.length : 1;
                return (
                  <option key={no} value={no}>
                    {no} — {cust} ({count} items)
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div style={{ backgroundColor: 'white', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Items Dispatched in DC</span>
          <div style={{ fontSize: '18px', color: '#0E7490', marginTop: '4px', fontWeight: '800' }}>{selectedGoodsList.length} Items Selected</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Transit Insurance Value</span>
          <div style={{ fontSize: '18px', color: '#166534', marginTop: '4px', fontWeight: '800' }}>₹ {totalTransitValuation.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Vehicle Registration</span>
          <div style={{ fontSize: '14px', color: '#0F172A', marginTop: '6px', fontWeight: '800' }}>{vehicleNo || '—'}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Financial Charge</span>
          <div style={{ fontSize: '15px', color: '#16A34A', marginTop: '6px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16A34A' }}></span>
            ₹0.00 (Non-Chargeable DC)
          </div>
        </div>
      </div>

      {/* Professional Delivery Challan Document Template */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '32px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Document Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0E7490', paddingBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#0E7490', letterSpacing: '-0.5px' }}>DELIVERY CHALLAN</div>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', marginTop: '2px' }}>Goods Movement & Subsequent Dispatch Document (Rule 55 CGST)</div>
            <div style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700', marginTop: '4px' }}>
              NON-CHARGEABLE DELIVERY — FULFILLMENT OF BACKORDERED / PENDING GOODS
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>DC No: <span style={{ color: '#0E7490' }}>{generatedDcNo}</span></div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>Date: <strong>{inv.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>Originating Invoice Ref: <strong style={{ color: '#2563EB' }}>{invNoText}</strong></div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>Sales BOM Ref: <strong>{bomRefText}</strong></div>
          </div>
        </div>

        {/* Consignor & Consignee Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', backgroundColor: '#F8FAFC', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          {/* Consignor (From) */}
          <div>
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CONSIGNOR (DISPATCH FROM)</span>
            <h4 style={{ margin: '4px 0 2px 0', fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>BUSINZ Industrial Technologies Ltd</h4>
            <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: '1.5' }}>
              Plot 14, Phase II, Nagappa Estate, Puzhal, Chennai - 600066<br />
              <strong>GSTIN:</strong> 33AAAAA0000A1Z5 | <strong>State:</strong> Tamil Nadu (33)
            </p>
          </div>

          {/* Consignee (Ship To) */}
          <div>
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CONSIGNEE (DELIVER TO)</span>
            <h4 style={{ margin: '4px 0 2px 0', fontSize: '14px', fontWeight: '800', color: '#0E7490' }}>{customerText}</h4>
            <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.5' }}>
              {isExistingDc ? (
                <p style={{ margin: 0 }}>{deliveryAddr}</p>
              ) : (
                <input
                  type="text"
                  value={deliveryAddr}
                  onChange={(e) => setDeliveryAddr(e.target.value)}
                  style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '12px', marginTop: '4px' }}
                />
              )}
              <div style={{ marginTop: '4px' }}>
                <strong>GSTIN:</strong> {inv.gstin || matchingBom?.gstNo || '33BBBBB1111B1Z2'} | <strong>Invoice Reference:</strong> {invNoText}
              </div>
            </div>
          </div>
        </div>

        {/* Transport & Shipping Details */}
        <div style={{ backgroundColor: '#ECFEFF', padding: '18px 20px', borderRadius: '12px', border: '1px solid #A5F3FC' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            <Truck style={{ width: '14px', height: '14px' }} /> Transport & Movement Details (Rule 55 Shipping Form)
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Transporter Name</label>
              <input
                type="text"
                disabled={isExistingDc}
                value={transporter}
                onChange={(e) => setTransporter(e.target.value)}
                style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12px', backgroundColor: isExistingDc ? '#F8FAFC' : 'white' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Vehicle Number</label>
              <input
                type="text"
                disabled={isExistingDc}
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12px', backgroundColor: isExistingDc ? '#F8FAFC' : 'white', fontWeight: '700', textTransform: 'uppercase' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Lorry Receipt (LR) No.</label>
              <input
                type="text"
                disabled={isExistingDc}
                value={lrNo}
                onChange={(e) => setLrNo(e.target.value)}
                style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12px', backgroundColor: isExistingDc ? '#F8FAFC' : 'white' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Mode of Transport</label>
              <select
                disabled={isExistingDc}
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value)}
                style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12px', backgroundColor: isExistingDc ? '#F8FAFC' : 'white' }}
              >
                <option>Road Transport</option>
                <option>Rail Freight</option>
                <option>Air Express</option>
                <option>Direct Customer Pickup</option>
              </select>
            </div>
          </div>
        </div>

        {/* Goods Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Pending Items To Deliver</h3>
              <span style={{ fontSize: '12px', color: '#64748B' }}>
                Select items and specify the dispatch quantity. Inventory will be automatically reduced upon issuing.
              </span>
            </div>
            {!isExistingDc && (
              <span style={{ fontSize: '12px', color: '#0E7490', fontWeight: '700' }}>
                {selectedItems.length} of {itemsWithDcQty.length} items selected
              </span>
            )}
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>
                  {!isExistingDc && <th style={{ padding: '12px', textAlign: 'center', width: '60px' }}>Select</th>}
                  <th style={{ padding: '12px' }}>Product Code</th>
                  <th style={{ padding: '12px' }}>Description</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>UOM</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Invoiced Qty</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Previously Dispatched</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Pending Balance</th>
                  <th style={{ padding: '12px', textAlign: 'center', width: '140px' }}>DC Dispatch Qty</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Live Warehouse Stock</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Transit Valuation (₹)</th>
                </tr>
              </thead>
              <tbody>
                {itemsWithDcQty.map((it, idx) => {
                  const isChecked = selectedItems.includes(idx);
                  const dcQty = it.dcQty !== undefined ? it.dcQty : (it.pendingQty || it.qty || 1);
                  const rate = it.rate || 250;
                  const val = dcQty * rate;
                  const liveStock = it.liveStock !== undefined ? it.liveStock : 0;
                  const isLow = liveStock < dcQty;

                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: isChecked ? '#FFFFFF' : '#F8FAFC', opacity: isChecked ? 1 : 0.6 }}>
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
                      <td style={{ padding: '12px', fontWeight: 'bold', color: '#475569' }}>
                        {it.code || `PRD-00${idx + 1}`}
                      </td>
                      <td style={{ padding: '12px', fontWeight: '700', color: '#0F172A' }}>
                        {it.name}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', color: '#64748B' }}>
                        {it.uom || 'Nos'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#475569' }}>
                        {it.totalOrdered || it.qty || 1}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', color: '#64748B' }}>
                        {it.prevDispatched || 0}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: '800', color: '#DC2626' }}>
                        {it.pendingQty || it.qty || 1}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {isExistingDc ? (
                          <span style={{ fontWeight: '800', color: '#0E7490', fontSize: '13px' }}>
                            {dcQty} {it.uom || 'Nos'}
                          </span>
                        ) : (
                          <input
                            type="number"
                            min="1"
                            max={it.pendingQty || it.totalOrdered || 9999}
                            value={dcQty}
                            onChange={(e) => handleDcQtyChange(idx, e.target.value)}
                            style={{ width: '80px', height: '32px', textAlign: 'center', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: '800', color: '#0E7490', fontSize: '13px' }}
                          />
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '800',
                          backgroundColor: isLow ? '#FEF2F2' : '#ECFDF5',
                          color: isLow ? '#DC2626' : '#059669',
                          border: isLow ? '1px solid #FECACA' : '1px solid #A7F3D0'
                        }}>
                          {isLow ? `⚠️ ${liveStock.toLocaleString()} in WH` : `✓ ${liveStock.toLocaleString()} in WH`}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                        ₹ {val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        <div style={{ fontSize: '10px', color: '#16A34A', fontWeight: '600' }}>(₹0 Billed)</div>
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ backgroundColor: '#F8FAFC', fontWeight: '800' }}>
                  <td colSpan={isExistingDc ? 7 : 8} style={{ padding: '12px', textAlign: 'right', color: '#0F172A' }}>
                    Total Transit Valuation (Rule 55 Insurance Baseline):
                  </td>
                  <td colSpan={2} style={{ padding: '12px', textAlign: 'right', color: '#0E7490', fontSize: '14px' }}>
                    ₹ {totalTransitValuation.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    <span style={{ display: 'block', fontSize: '11px', color: '#16A34A', fontWeight: '700' }}>
                      Customer Invoice Amount Due: ₹ 0.00
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Declaration & Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', borderTop: '1px solid #E2E8F0', paddingTop: '16px', fontSize: '11px', color: '#64748B' }}>
          <div>
            <strong>Statutory Declaration (Rule 55 CGST Rules, 2017):</strong>
            <p style={{ margin: '4px 0 0 0', lineHeight: '1.4' }}>
              We declare that this Delivery Challan is issued for subsequent transportation of goods not by way of supply. The goods described above are being transported under Rule 55 of CGST Rules, 2017 in fulfillment of backordered quantities already billed under Tax Invoice #{invNoText}. No further sales consideration is payable.
            </p>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '60px' }}>
            <strong>For BUSINZ Industrial Technologies Ltd</strong>
            <span style={{ fontWeight: '700', color: '#0F172A' }}>Authorised Billing Signatory</span>
          </div>
        </div>
      </div>
    </div>
  );
}
