import React, { useState } from "react";
import { ChevronLeft, Truck, Printer, CheckCircle, Package } from "lucide-react";
import { saveCloudStore } from "../../utils/supabaseDataSync";
import { stripDataUrlsFromRecord } from "../../utils/otherViewsShared";

export default function DeliveryChallanModal({
  pendingDcModal,
  onClose,
  bomStore = [],
  setBomStore = () => {},
  invoiceList = [],
  setInvoiceList = () => {}
}) {
  const inv = pendingDcModal || {};
  const isExistingDc = Boolean(inv.dcNo || (inv.code && inv.code.startsWith('DC-')));
  const invNoText = inv.invNo || inv.invoiceNo || inv.code || 'INV-2026-102';
  const bomRefText = inv.bomCode || inv.poNo || inv.c3 || 'BOM-977';
  const customerText = inv.customerName || inv.vendor || inv.c2 || 'Customer';

  // Look up matching BOM
  const matchingBom = (bomStore || []).find(b =>
    b.bomCode === inv.bomCode ||
    b.bomCode === inv.poNo ||
    b.bomCode === inv.code ||
    b.code === inv.bomCode ||
    (b.salesOrderNo && (b.salesOrderNo === inv.poNo || b.salesOrderNo === inv.c3))
  );

  // Derive unpacked or DC items
  const rawItems = (inv.items && inv.items.length > 0)
    ? inv.items
    : (matchingBom && matchingBom.items && matchingBom.items.length > 0)
      ? matchingBom.items
      : [
        { code: 'MR100N', name: 'Mini Rail 100 mm (HDG)', desc: 'Aluminum Solar Mounting Rail', uom: 'Nos', qty: 12, rate: 250, selected: true }
      ];

  const unpackedItemsList = isExistingDc
    ? rawItems
    : rawItems.filter((it, idx) => {
        if (it.selected === false) return true;
        if (matchingBom && matchingBom.dispatchPacking && matchingBom.dispatchPacking[idx]) {
          return matchingBom.dispatchPacking[idx].packed === false;
        }
        return true;
      });

  const itemsListToRender = unpackedItemsList.length > 0 ? unpackedItemsList : rawItems;

  // Controlled form state
  const [transporter, setTransporter] = useState(inv.transporter || "VRL Logistics Ltd.");
  const [vehicleNo, setVehicleNo] = useState(inv.vehicleNo || "TN-09-CB-4890");
  const [lrNo, setLrNo] = useState(inv.lrNo || `LR-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [transportMode, setTransportMode] = useState(inv.mode || "Road Transport");
  const [deliveryAddr, setDeliveryAddr] = useState(inv.deliveryAddress || matchingBom?.deliveryAddress || 'No 1427, GNT Road, Nagappa Industrial Estate, Puzhal, Chennai');
  const [selectedItems, setSelectedItems] = useState(
    itemsListToRender.map((_, idx) => idx)
  );

  const toggleItemSelection = (idx) => {
    setSelectedItems(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const selectedGoodsList = itemsListToRender.filter((_, idx) => selectedItems.includes(idx));
  const totalDcValue = selectedGoodsList.reduce((acc, it) => acc + ((it.qty || it.bomQty || 1) * (it.rate || 250)), 0);

  const generatedDcNo = inv.dcNo || (inv.code && inv.code.startsWith('DC-') ? inv.code : `DC-2026-${String(Date.now()).slice(-4)}`);

  const handleSaveAndGenerateDc = () => {
    if (selectedGoodsList.length === 0) {
      alert("⚠️ Please select at least one item to include in this Delivery Challan!");
      return;
    }
    if (!vehicleNo.trim()) {
      alert("⚠️ Please enter a Vehicle Number for the Delivery Challan!");
      return;
    }

    // 1. Create DC Record
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
      totalValue: totalDcValue,
      itemCount: selectedGoodsList.length,
      items: selectedGoodsList,
      createdAt: new Date().toISOString()
    };

    // 2. Persist in controlroom_dc_store
    try {
      const existingStr = localStorage.getItem('controlroom_dc_store');
      const dcs = existingStr ? JSON.parse(existingStr) : [];
      const updatedDcs = [newDc, ...dcs.filter(d => (d.dcNo !== newDc.dcNo && d.code !== newDc.dcNo))];
      localStorage.setItem('controlroom_dc_store', JSON.stringify(updatedDcs));
      saveCloudStore('delivery_challan_store', updatedDcs);
    } catch (err) {
      console.error("Error saving DC to store:", err);
    }

    // 3. Mark items in invoice store as dispatched
    if (typeof setInvoiceList === 'function') {
      setInvoiceList(prev => (prev || []).map(invItem => (invItem.invNo === inv.invNo || invItem.code === inv.code) ? {
        ...invItem,
        status: 'CLOSED',
        pay: 'Fully Dispatched & Closed',
        dcNo: generatedDcNo,
        items: (invItem.items || []).map(it => ({ ...it, selected: true }))
      } : invItem));
    }

    // 4. Update BOM status to Closed / Dispatched
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

    window.dispatchEvent(new Event('controlroom_storage_update'));
    window.dispatchEvent(new Event('storage'));

    alert(`🚚 Delivery Challan ${generatedDcNo} created successfully!\n\nShipment for ${customerText} is now marked IN TRANSIT.`);
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
            <ChevronLeft style={{ width: '16px', height: '16px' }} /> Back
          </button>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              {isExistingDc ? `Delivery Challan Details (${generatedDcNo})` : 'Create Delivery Challan (DC) — Rule 55 CGST'}
            </h1>
            <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', display: 'block' }}>
              DC No: <strong style={{ color: '#0E7490' }}>{generatedDcNo}</strong> | BOM Ref: <strong style={{ color: '#2563EB' }}>{bomRefText}</strong> | Customer: <strong>{customerText}</strong>
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
              <Truck style={{ width: '16px', height: '16px' }} />
              Generate DC & Complete Dispatch
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

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div style={{ backgroundColor: 'white', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Items in this DC</span>
          <div style={{ fontSize: '18px', color: '#0E7490', marginTop: '4px', fontWeight: '800' }}>{selectedGoodsList.length} Items Selected</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Total DC Value</span>
          <div style={{ fontSize: '18px', color: '#166534', marginTop: '4px', fontWeight: '800' }}>₹ {totalDcValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Vehicle Registration</span>
          <div style={{ fontSize: '14px', color: '#0F172A', marginTop: '6px', fontWeight: '800' }}>{vehicleNo || '—'}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>DC Dispatch Status</span>
          <div style={{ fontSize: '13px', color: '#0E7490', marginTop: '6px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0E7490' }}></span>
            {isExistingDc ? (inv.status || 'DELIVERED') : 'Rule 55 CGST Transit'}
          </div>
        </div>
      </div>

      {/* Professional Delivery Challan Document Template */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '32px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Document Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0E7490', paddingBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#0E7490', letterSpacing: '-0.5px' }}>DELIVERY CHALLAN</div>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', marginTop: '2px' }}>Goods Movement & Subsequent Dispatch Document</div>
            <div style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700', marginTop: '4px' }}>Issued under Rule 55 of CGST Rules, 2017</div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>DC No: <span style={{ color: '#0E7490' }}>{generatedDcNo}</span></div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>Date: <strong>{inv.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>Invoice Ref: <strong>{invNoText}</strong> | Sales BOM: <strong>{bomRefText}</strong></div>
          </div>
        </div>

        {/* Consignor & Consignee Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', backgroundColor: '#F8FAFC', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          {/* Consignor (From) */}
          <div>
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CONSIGNOR (DISPATCH FROM)</span>
            <h4 style={{ margin: '4px 0 2px 0', fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>BUSINZ Industrial Technologies Ltd</h4>
            <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: '1.5' }}>
              Plot 14, Phase II, Industrial Complex<br />
              Nagappa Estate, Puzhal, Chennai - 600066<br />
              <strong>GSTIN:</strong> 33AAAAA0000A1Z5 | <strong>State Code:</strong> 33 (Tamil Nadu)
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
                <strong>GSTIN:</strong> {inv.gstin || matchingBom?.gstNo || '33BBBBB1111B1Z2'} | <strong>State:</strong> Tamil Nadu
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
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Challan Goods Description</h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Items transported under this Delivery Challan consignment.</span>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>
                  {!isExistingDc && <th style={{ padding: '12px', textAlign: 'center', width: '80px' }}>Select</th>}
                  <th style={{ padding: '12px' }}>Product Code</th>
                  <th style={{ padding: '12px' }}>Goods Description</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>HSN Code</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>UOM</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Challan Qty</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Rate (₹)</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Taxable Value (₹)</th>
                </tr>
              </thead>
              <tbody>
                {itemsListToRender.map((it, idx) => {
                  const qty = it.qty || it.bomQty || 1;
                  const rate = it.rate || 250;
                  const val = qty * rate;
                  const isChecked = selectedItems.includes(idx);
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
                      <td style={{ padding: '12px', fontWeight: 'bold', color: '#475569' }}>{it.code || `PRD-00${idx + 1}`}</td>
                      <td style={{ padding: '12px', fontWeight: '700', color: '#0F172A' }}>{it.name}</td>
                      <td style={{ padding: '12px', textAlign: 'center', color: '#64748B' }}>76109090</td>
                      <td style={{ padding: '12px', textAlign: 'center', color: '#64748B' }}>{it.uom || 'Nos'}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: '800', color: '#0E7490' }}>{qty} Nos</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#475569' }}>₹ {parseFloat(rate).toFixed(2)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                        ₹ {val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ backgroundColor: '#F8FAFC', fontWeight: '800' }}>
                  <td colSpan={isExistingDc ? 6 : 7} style={{ padding: '12px', textAlign: 'right', color: '#0F172A' }}>Total Consignment Goods Value</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#0E7490', fontSize: '14px' }}>
                    ₹ {totalDcValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Declaration & Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', borderTop: '1px solid #E2E8F0', paddingTop: '16px', fontSize: '11px', color: '#64748B' }}>
          <div>
            <strong>Statutory Declaration:</strong>
            <p style={{ margin: '4px 0 0 0', lineHeight: '1.4' }}>
              We declare that this Delivery Challan is issued for subsequent transportation of goods not by way of supply. The goods described above are being transported under Rule 55 of CGST Rules, 2017.
            </p>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '60px' }}>
            <strong>For BUSINZ Industrial Technologies Ltd</strong>
            <span style={{ fontWeight: '700', color: '#0F172A' }}>Authorised Signatory</span>
          </div>
        </div>
      </div>
    </div>
  );
}
