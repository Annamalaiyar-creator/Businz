import React from "react";
import { Filter, ChevronLeft, Truck, Info, Printer, Factory, Receipt } from "lucide-react";

export default function DeliveryChallanModal({
  pendingDcModal,
  onClose,
  bomStore,
  setBomStore
}) {
const inv = pendingDcModal;
const invNoText = inv.invNo || inv.code || 'INV-2026-102';
const bomRefText = inv.poNo || inv.c3 || 'BOM-102';
const customerText = inv.vendor || inv.c2 || 'Customer';

// Look up matching BOM
const matchingBom = bomStore.find(b =>
  b.bomCode === inv.poNo ||
  b.bomCode === inv.code ||
  b.bomCode === inv.c3 ||
  (b.salesOrderNo && (b.salesOrderNo === inv.poNo || b.salesOrderNo === inv.c3))
);

// Derive unpacked items from invoice items or matchingBom
const rawItems = (inv.items && inv.items.length > 0)
  ? inv.items
  : (matchingBom && matchingBom.items && matchingBom.items.length > 0)
    ? matchingBom.items
    : [
      { code: 'PRD-002', name: 'Mini Rail 100 mm', desc: 'Aluminum Mounting Rail', uom: 'Nos', qty: 12, rate: 250, selected: false }
    ];

// Filter unpacked items (selected === false or packed === false)
const unpackedItemsList = rawItems.filter((it, idx) => {
  if (it.selected === false) return true;
  if (matchingBom && matchingBom.dispatchPacking && matchingBom.dispatchPacking[idx]) {
    return matchingBom.dispatchPacking[idx].packed === false;
  }
  return false;
});

const itemsListToRender = unpackedItemsList.length > 0 ? unpackedItemsList : rawItems;

return (
  <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#F8FAFC', zIndex: 99999, overflowY: 'auto', padding: '24px', boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', gap: '20px' }}>
    {/* Top Bar Header */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: '20px 24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          onClick={() => onClose()}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '700', color: '#475569', cursor: 'pointer' }}
        >
          <ChevronLeft style={{ width: '16px', height: '16px' }} /> Back to Invoices
        </button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            Create Delivery Challan (DC) for Pending Items
          </h1>
          <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', display: 'block' }}>
            Invoice Ref: <strong style={{ color: '#2563EB' }}>{invNoText}</strong> | BOM Ref: <strong style={{ color: '#4F46E5' }}>{bomRefText}</strong> | Customer: <strong>{customerText}</strong>
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => onClose()}
          style={{ border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', height: '40px', padding: '0 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
        >
          Cancel
        </button>

        <button
          onClick={() => {
            // Update invoice items state to marked as included in DC & close invoice
            setInvoiceList(prev => prev.map(invItem => (invItem.invNo === inv.invNo || invItem.code === inv.code) ? {
              ...invItem,
              status: 'CLOSED',
              pay: 'Fully Dispatched & Closed',
              items: (invItem.items || []).map(it => ({ ...it, selected: true }))
            } : invItem));

            // Update corresponding BOM status to 'Closed' in bomStore and mark dispatchPacking items packed
            const targetPoNo = inv.poNo || inv.invNo || inv.code;
            const targetPoNum = targetPoNo ? targetPoNo.replace(/[^0-9]/g, '') : '';

            setBomStore(prev => prev.map(b => {
              const bNum = b.bomCode ? b.bomCode.replace(/[^0-9]/g, '') : '';
              const isMatch = b.bomCode === targetPoNo ||
                b.bomCode === inv.invNo ||
                b.bomCode === inv.poNo ||
                b.bomCode === inv.code ||
                (b.salesOrderNo && (b.salesOrderNo === inv.poNo || b.salesOrderNo === inv.c3)) ||
                (targetPoNum && bNum && bNum === targetPoNum);

              if (isMatch) {
                const updatedDispatch = (b.dispatchPacking && b.dispatchPacking.length > 0)
                  ? b.dispatchPacking.map(p => ({ ...p, packed: true }))
                  : (b.items || []).map(it => ({ name: it.name || it.c2 || 'Item', bomQty: it.qty || 1, packed: true }));

                return {
                  ...b,
                  status: 'Closed',
                  dispatchPacking: updatedDispatch
                };
              }
              return b;
            }));

            alert(`🚚 Delivery Challan (DC) Generated successfully! Pending items dispatched for ${invNoText}. Dispatch status updated to CLOSED.`);
            onClose();
          }}
          style={{ border: 'none', backgroundColor: '#4F46E5', color: '#FFFFFF', height: '40px', padding: '0 24px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 2px 4px rgba(79,70,229,0.25)', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Truck style={{ width: '16px', height: '16px' }} />
          Generate DC & Complete Dispatch
        </button>
      </div>
    </div>

    {/* Summary Cards */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
        <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Pending Items Count</span>
        <div style={{ fontSize: '18px', color: '#DC2626', marginTop: '6px', fontWeight: '800' }}>{itemsListToRender.length} Items Pending</div>
      </div>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
        <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Delivery Location</span>
        <div style={{ fontSize: '13px', color: '#0F172A', marginTop: '6px', fontWeight: '600' }}>{inv.deliveryAddress || 'Factory Site - Plot 14, Phase II'}</div>
      </div>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
        <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>DC Dispatch Status</span>
        <div style={{ fontSize: '13px', color: '#4F46E5', marginTop: '6px', fontWeight: '800' }}>Subsequent Partial Delivery DC</div>
      </div>
    </div>

    {/* Professional Delivery Challan (DC) Document Template & Form */}
    <div style={{ backgroundColor: '#FFFFFF', padding: '32px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Document Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #4F46E5', paddingBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#4F46E5', letterSpacing: '-0.5px' }}>DELIVERY CHALLAN</div>
          <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', marginTop: '2px' }}>Subsequent Partial Goods Dispatch Document</div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Issued under Rule 55 of CGST Rules, 2017</div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>DC No: <span style={{ color: '#4F46E5' }}>DC-{invNoText.replace('INV-', '')}</span></div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>Date: <strong>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
          <div style={{ fontSize: '12px', color: '#64748B' }}>Invoice Ref: <strong>{invNoText}</strong> | Sales BOM: <strong>{bomRefText}</strong></div>
        </div>
      </div>

      {/* Consignor & Consignee Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', backgroundColor: '#F8FAFC', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
        {/* Consignor (From) */}
        <div>
          <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CONSIGNOR (DISPATCH FROM)</span>
          <h4 style={{ margin: '4px 0 2px 0', fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Businz Industrial Corp Ltd</h4>
          <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: '1.5' }}>
            Plot 14, Phase II, Industrial Complex<br />
            Nagappa Estate, Puzhal, Chennai - 600066<br />
            <strong>GSTIN:</strong> 33AAAAA0000A1Z5 | <strong>State Code:</strong> 33
          </p>
        </div>

        {/* Consignee (Ship To) */}
        <div>
          <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CONSIGNEE (DELIVER TO)</span>
          <h4 style={{ margin: '4px 0 2px 0', fontSize: '14px', fontWeight: '800', color: '#2563EB' }}>{customerText}</h4>
          <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: '1.5' }}>
            {inv.deliveryAddress || 'No 1427, GNT Road, Nagappa Industrial Estate, Puzhal, Chennai'}<br />
            <strong>GSTIN:</strong> {inv.gstin || '33BBBBB1111B1Z2'} | <strong>State Code:</strong> 33
          </p>
        </div>
      </div>

      {/* Transporter & Shipping Info Input Form */}
      <div style={{ backgroundColor: '#EEF2FF', padding: '18px 20px', borderRadius: '12px', border: '1px solid #C7D2FE' }}>
        <span style={{ fontSize: '11px', fontWeight: '800', color: '#4F46E5', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <Truck style={{ width: '14px', height: '14px' }} /> Transport & Movement Information (DC Shipping Details)
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Transporter Name</label>
            <input
              type="text"
              defaultValue="VRL Logistics Ltd."
              style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12px', backgroundColor: 'white' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Vehicle Number</label>
            <input
              type="text"
              defaultValue="TN-09-CB-4890"
              style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12px', backgroundColor: 'white', fontWeight: '700', textTransform: 'uppercase' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Lorry Receipt (LR) No.</label>
            <input
              type="text"
              defaultValue="LR-2026-9812"
              style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12px', backgroundColor: 'white' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Mode of Transport</label>
            <select style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12px', backgroundColor: 'white' }}>
              <option>Road Transport</option>
              <option>Rail Freight</option>
              <option>Air Express</option>
            </select>
          </div>
        </div>
      </div>

      {/* Pending Items Table Card */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Challan Goods Description (Pending Items to Dispatch)</h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Select items included in this Delivery Challan shipment.</span>
          </div>

          <button
            onClick={() => window.print()}
            style={{ border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#334155', height: '34px', padding: '0 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer style={{ width: '14px', height: '14px', color: '#475569' }} /> Print DC Template
          </button>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '12px', textAlign: 'center', width: '100px' }}>Include</th>
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
                const qty = it.qty || it.bomQty || 12;
                const rate = it.rate || 250;
                const val = qty * rate;
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        defaultChecked={true}
                        style={{ accentColor: '#4F46E5', width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '12px', fontWeight: 'bold', color: '#475569' }}>{it.code || `PRD-00${idx + 2}`}</td>
                    <td style={{ padding: '12px', fontWeight: '700', color: '#0F172A' }}>{it.name}</td>
                    <td style={{ padding: '12px', textAlign: 'center', color: '#64748B' }}>76109090</td>
                    <td style={{ padding: '12px', textAlign: 'center', color: '#64748B' }}>{it.uom || 'Nos'}</td>
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: '800', color: '#4F46E5' }}>{qty} Nos</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#475569' }}>₹ {parseFloat(rate).toFixed(2)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                      ₹ {val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ backgroundColor: '#F8FAFC', fontWeight: '800' }}>
                <td colSpan={7} style={{ padding: '12px', textAlign: 'right', color: '#0F172A' }}>Total Goods Value for DC</td>
                <td style={{ padding: '12px', textAlign: 'right', color: '#4F46E5', fontSize: '14px' }}>
                  ₹ {itemsListToRender.reduce((acc, it) => acc + ((it.qty || it.bomQty || 12) * (it.rate || 250)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Declaration & Signatures */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', borderTop: '1px solid #E2E8F0', paddingTop: '16px', fontSize: '11px', color: '#64748B' }}>
        <div>
          <strong>Declaration:</strong>
          <p style={{ margin: '4px 0 0 0', lineHeight: '1.4' }}>
            We declare that this Delivery Challan is issued for subsequent transportation of goods not by way of supply. The goods described above are being transported under Rule 55 of CGST Rules, 2017.
          </p>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '60px' }}>
          <strong>For Businz Industrial Corp Ltd</strong>
          <span style={{ fontWeight: '700', color: '#0F172A' }}>Authorised Signatory</span>
        </div>
      </div>
    </div>
  </div>
);
}
