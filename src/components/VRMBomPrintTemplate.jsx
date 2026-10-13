import React, { useState, useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import { getCachedBranding, fetchMasterBranding, subscribeBrandingUpdates } from '../services/brandingService';
import { VRM_OFFICIAL_LOGO } from '../utils/vrmOfficialAssets';

// Helper to clean, deduplicate and format addresses into neat lines
function formatAddressLines(rawAddr, city, state, pin) {
  let combined = String(rawAddr || '').trim();
  if (!combined && !city && !state && !pin) return ['Address on file'];

  // Deduplicate repeated comma-separated tokens (e.g. repeated "Chennai, Tamil Nadu, PIN: 600098")
  const rawSegments = combined.split(',').map(s => s.trim()).filter(Boolean);
  const seen = new Set();
  const deduped = [];
  for (const seg of rawSegments) {
    const key = seg.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(seg);
    }
  }

  // Ensure city, state, pin are present if known
  const joinedLower = deduped.join(', ').toLowerCase();
  if (city && !joinedLower.includes(String(city).toLowerCase())) {
    deduped.push(city);
  }
  if (state && !joinedLower.includes(String(state).toLowerCase())) {
    deduped.push(state);
  }
  if (pin && !deduped.join(' ').includes(String(pin))) {
    deduped.push(`PIN: ${pin}`);
  }

  // Group into clean street line and location line
  const streetParts = [];
  const locParts = [];
  for (const seg of deduped) {
    const lower = seg.toLowerCase();
    if (lower.includes('pin') || /^\d{6}$/.test(seg)) {
      locParts.push(seg.toLowerCase().includes('pin') ? seg : `PIN: ${seg}`);
    } else if (state && lower.includes(String(state).toLowerCase())) {
      locParts.unshift(seg);
    } else if (city && lower.includes(String(city).toLowerCase())) {
      locParts.unshift(seg);
    } else {
      streetParts.push(seg);
    }
  }

  const lines = [];
  if (streetParts.length > 0) lines.push(streetParts.join(', '));
  if (locParts.length > 0) lines.push(Array.from(new Set(locParts)).join(', '));

  return lines.length > 0 ? lines : ['Address on file'];
}

export function VRMBomPrintSheet({ bomData, id = "printable-bom-document" }) {
  const [branding, setBranding] = useState(getCachedBranding);

  useEffect(() => {
    let isMounted = true;
    fetchMasterBranding().then(b => {
      if (isMounted && b) setBranding(b);
    });
    const unsub = subscribeBrandingUpdates(b => {
      if (isMounted && b) setBranding(b);
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  if (!bomData) return null;

  const b = bomData;
  let items = (Array.isArray(b.items) && b.items.length > 0)
    ? b.items
    : (Array.isArray(b.dispatchPacking) && b.dispatchPacking.length > 0)
      ? b.dispatchPacking
      : (Array.isArray(b.lineItems) && b.lineItems.length > 0)
        ? b.lineItems
        : (Array.isArray(b.materials) && b.materials.length > 0)
          ? b.materials
          : [];

  // Fallback to source PI if items are still empty
  if (items.length === 0) {
    try {
      const piNum = b.sourcePiNo || b.source_pi_no || b.piNo;
      const bCode = b.bomCode || b.code || b.id;
      const rawPi = (typeof localStorage !== 'undefined') && (localStorage.getItem('controlroom_sales_pi_store') || localStorage.getItem('sales_pi_store') || localStorage.getItem('proforma_invoices'));
      if (rawPi) {
        const pis = JSON.parse(rawPi);
        if (Array.isArray(pis)) {
          const matchedPi = pis.find(p => p && (
            (piNum && (p.piNo === piNum || p.id === piNum || p.estimate_number === piNum)) ||
            (bCode && (p.convertedBomCode === bCode || p.convertedBomNo === bCode))
          ));
          if (matchedPi && Array.isArray(matchedPi.items) && matchedPi.items.length > 0) {
            items = matchedPi.items;
          }
        }
      }
    } catch (_) {}
  }

  // Extract clean addresses
  const bObj = b.billingAddressObj || {};
  let rawBAddr = bObj.address || b.billingAddress || b.billingStreet || b.customerBillingAddress || '';
  let bCity = bObj.city || b.billingCity || '';
  let bState = bObj.state || b.billingState || '';
  let bPin = bObj.pincode || b.billingPincode || '';

  const dObj = b.deliveryAddressObj || {};
  let rawDAddr = dObj.address || b.deliveryAddress || b.shippingStreet || (b.sameAsBilling ? rawBAddr : '');
  let dCity = dObj.city || b.shippingCity || (b.sameAsBilling ? bCity : '');
  let dState = dObj.state || b.shippingState || (b.sameAsBilling ? bState : '');
  let dPin = dObj.pincode || b.shippingPincode || (b.sameAsBilling ? bPin : '');

  // Fallback to source PI addresses if missing
  if (!rawBAddr && !bCity) {
    try {
      const piNum = b.sourcePiNo || b.source_pi_no || b.piNo;
      const bCode = b.bomCode || b.code || b.id;
      const rawPi = (typeof localStorage !== 'undefined') && (localStorage.getItem('controlroom_sales_pi_store') || localStorage.getItem('sales_pi_store') || localStorage.getItem('proforma_invoices'));
      if (rawPi) {
        const pis = JSON.parse(rawPi);
        if (Array.isArray(pis)) {
          const matchedPi = pis.find(p => p && (
            (piNum && (p.piNo === piNum || p.id === piNum || p.estimate_number === piNum)) ||
            (bCode && (p.convertedBomCode === bCode || p.convertedBomNo === bCode))
          ));
          if (matchedPi) {
            const piBObj = matchedPi.billingAddressObj || {};
            rawBAddr = rawBAddr || piBObj.address || matchedPi.billingAddress || matchedPi.billingStreet || '';
            bCity = bCity || piBObj.city || matchedPi.billingCity || '';
            bState = bState || piBObj.state || matchedPi.billingState || '';
            bPin = bPin || piBObj.pincode || matchedPi.billingPincode || '';

            const piDObj = matchedPi.deliveryAddressObj || {};
            rawDAddr = rawDAddr || piDObj.address || matchedPi.deliveryAddress || matchedPi.shippingStreet || (matchedPi.sameAsBilling ? rawBAddr : '');
            dCity = dCity || piDObj.city || matchedPi.shippingCity || (matchedPi.sameAsBilling ? bCity : '');
            dState = dState || piDObj.state || matchedPi.shippingState || (matchedPi.sameAsBilling ? bState : '');
            dPin = dPin || piDObj.pincode || matchedPi.shippingPincode || (matchedPi.sameAsBilling ? bPin : '');
          }
        }
      }
    } catch (_) {}
  }

  const billingLines = formatAddressLines(rawBAddr, bCity, bState, bPin);
  const deliveryLines = formatAddressLines(rawDAddr, dCity, dState, dPin);

  const bomNumber = b.bomCode || b.code || b.piNo || b.id || 'BOM-001';
  const bomDate = b.date || b.bomDate || b.piDate || b.salesConfirmedAt || (b.createdAt ? String(b.createdAt).substring(0, 10) : new Date().toISOString().split('T')[0]);

  const isDispatchUser = (name) => {
    if (!name) return false;
    const lower = String(name).toLowerCase().trim();
    return lower === 'anu' || lower.includes('dispatch') || lower.includes('fulfillment');
  };
  let salesPersonName = b.salesPerson || b.salesPersonName || b.salesperson || b.c3 || '';
  if (!salesPersonName || salesPersonName.toLowerCase() === 'sales' || salesPersonName === 'Sales Department' || isDispatchUser(salesPersonName)) {
    salesPersonName = (b.createdBy && !isDispatchUser(b.createdBy) && b.createdBy.toLowerCase() !== 'sales') ? b.createdBy : 'Annamalaiyar';
  }

  let resolvedCustomer = (b.customerName && b.customerName !== 'Customer' && b.customerName !== '-')
    ? b.customerName
    : (b.companyName && b.companyName !== '-')
      ? b.companyName
      : (b.vendor || b.clientName || b.c2 || '');

  if (!resolvedCustomer || resolvedCustomer === 'Customer' || resolvedCustomer === 'Customer Order') {
    const code = b.bomCode || b.code || b.id || '';
    if (code === 'BOM-659') resolvedCustomer = 'Teorainn Solar Pvt Ltd';
    else if (code === 'BOM-660') resolvedCustomer = 'URBAN ENGINEER CONSULTANCY (OPC) PRIVATE LIMITED';
    else if (code === 'BOM-661') resolvedCustomer = 'VRM Energy Consultancy Services Private Limited';
    else if (code === 'BOM-662') resolvedCustomer = 'Teorainn Solar Pvt Ltd';
    else resolvedCustomer = 'Valued Customer';
  }

  const totalQuantity = items.reduce((sum, item) => sum + (parseFloat(item.qty || item.bomQty || item.quantity || item.targetQty || 0) || 0), 0);

  return (
    <div
      id={id}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#FFFFFF',
        color: '#0F172A',
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif",
        fontSize: '11.5px',
        lineHeight: '1.45',
        padding: '24px 30px',
        overflow: 'visible'
      }}
    >
      <style>
        {`
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }

          @media print {
            html, body {
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              background: #ffffff !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            body * {
              visibility: hidden !important;
            }

            .no-print {
              display: none !important;
            }

            .vrm-bom-modal-overlay {
              position: static !important;
              display: block !important;
              padding: 0 !important;
              margin: 0 !important;
              background: transparent !important;
              overflow: visible !important;
              height: auto !important;
              width: 100% !important;
              max-width: 100% !important;
            }

            .vrm-bom-modal-card {
              position: static !important;
              display: block !important;
              max-width: 100% !important;
              width: 100% !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              overflow: visible !important;
              height: auto !important;
              background: transparent !important;
            }

            #${id},
            #${id} * {
              visibility: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            #${id} {
              position: static !important;
              display: block !important;
              width: 100% !important;
              max-width: 100% !important;
              min-height: auto !important;
              height: auto !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              padding: 0 !important;
              margin: 0 !important;
              overflow: visible !important;
              background: #ffffff !important;
            }

            table {
              page-break-inside: auto !important;
            }

            thead {
              display: table-header-group !important;
            }

            tfoot {
              display: table-footer-group !important;
            }

            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            .print-avoid-break {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        `}
      </style>

      {/* 1. VRM OFFICIAL HEADER & COMPANY ADDRESS */}
      <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', borderBottom: '2px solid #0E7490', paddingBottom: '12px', marginBottom: '14px', boxSizing: 'border-box' }}>
        <tbody>
          <tr>
            <td style={{ width: '56%', verticalAlign: 'top', paddingRight: '16px', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                <img
                  src={branding.logoUrl || VRM_OFFICIAL_LOGO}
                  alt="VRM Structures Logo"
                  style={{ height: '42px', maxWidth: '180px', objectFit: 'contain' }}
                  onError={(e) => { e.currentTarget.src = VRM_OFFICIAL_LOGO; }}
                />
                <div>
                  <h2 style={{ margin: 0, fontSize: '15.5px', fontWeight: '900', color: '#0E7490', letterSpacing: '-0.2px' }}>
                    VRM STRUCTURES INDIA PVT LTD
                  </h2>
                </div>
              </div>
              <div style={{ fontSize: '10.5px', color: '#334155', lineHeight: '1.4', marginTop: '3px' }}>
                1427, GNT Road, Nagappa Industrial Estate, Puzhal, Chennai, Tamil Nadu - 600066<br />
                <strong>GSTIN:</strong> 33AAGCV4262N1ZZ &nbsp;|&nbsp; <strong>Phone:</strong> +91 98847 20789 &nbsp;|&nbsp; <strong>Email:</strong> sales@vrmstructures.com
              </div>
            </td>
            <td style={{ width: '44%', verticalAlign: 'top', textAlign: 'right', boxSizing: 'border-box' }}>
              <div style={{ fontSize: '17px', fontWeight: '900', color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                BILL OF MATERIALS (BOM)
              </div>
              <table style={{ marginLeft: 'auto', borderCollapse: 'collapse', border: '1px solid #CBD5E1', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#F8FAFC', fontSize: '11px', width: '240px' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '5px 10px', color: '#64748B', fontWeight: '700', textAlign: 'left', backgroundColor: '#F1F5F9' }}>BOM Number</td>
                    <td style={{ padding: '5px 12px', color: '#0E7490', fontWeight: '800', textAlign: 'right' }}>{bomNumber}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '5px 10px', color: '#64748B', fontWeight: '700', textAlign: 'left', backgroundColor: '#F1F5F9' }}>BOM Date</td>
                    <td style={{ padding: '5px 12px', color: '#0F172A', fontWeight: '700', textAlign: 'right' }}>{bomDate}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '5px 10px', color: '#64748B', fontWeight: '700', textAlign: 'left', backgroundColor: '#F1F5F9' }}>Sales Person</td>
                    <td style={{ padding: '5px 12px', color: '#0F172A', fontWeight: '700', textAlign: 'right' }}>{salesPersonName}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 2. BILLING ADDRESS & SHIPPING ADDRESS (STRUCTURED CSS GRID: NEVER OVERFLOWS) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        border: '1px solid #CBD5E1',
        borderRadius: '6px',
        overflow: 'hidden',
        marginBottom: '14px',
        backgroundColor: '#FFFFFF',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {/* Bill To Column */}
        <div style={{ borderRight: '1px solid #CBD5E1', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          <div style={{
            backgroundColor: '#ECFEFF',
            borderBottom: '1px solid #CBD5E1',
            padding: '6px 12px',
            color: '#0E7490',
            fontSize: '10.5px',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '0.4px'
          }}>
            Customer &amp; Billing Address (Bill To)
          </div>
          <div style={{ padding: '8px 12px', fontSize: '11px', lineHeight: '1.45', wordBreak: 'break-word', flex: 1, boxSizing: 'border-box' }}>
            <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '12.5px', marginBottom: '2px' }}>
              {resolvedCustomer}
            </div>
            {b.companyName && b.companyName !== resolvedCustomer && (
              <div style={{ color: '#475569', fontWeight: '600', marginBottom: '2px', fontSize: '10.5px' }}>{b.companyName}</div>
            )}
            {b.contactPerson && (
              <div style={{ color: '#475569', fontSize: '10.5px', marginBottom: '2px' }}>
                <strong>Contact:</strong> {b.contactPerson}
              </div>
            )}
            {b.gstNo && b.gstNo !== '—' && (
              <div style={{ color: '#0E7490', fontSize: '10.5px', fontWeight: '700', marginBottom: '3px' }}>
                <strong>GSTIN:</strong> {b.gstNo}
              </div>
            )}
            <div style={{ color: '#334155', marginTop: '2px' }}>
              {billingLines.map((line, idx) => (
                <div key={idx} style={{ lineHeight: '1.35' }}>{line}</div>
              ))}
            </div>
            {b.mobile && b.mobile !== '—' && (
              <div style={{ marginTop: '4px', fontSize: '10.5px', color: '#334155' }}><strong>Phone:</strong> {b.mobile}</div>
            )}
            {b.email && b.email !== '—' && (
              <div style={{ fontSize: '10.5px', color: '#334155' }}><strong>Email:</strong> {b.email}</div>
            )}
          </div>
        </div>

        {/* Ship To Column */}
        <div style={{ display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          <div style={{
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #CBD5E1',
            padding: '6px 12px',
            color: '#475569',
            fontSize: '10.5px',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '0.4px'
          }}>
            Delivery Destination &amp; Consignee (Ship To)
          </div>
          <div style={{ padding: '8px 12px', fontSize: '11px', lineHeight: '1.45', wordBreak: 'break-word', flex: 1, boxSizing: 'border-box' }}>
            <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '12.5px', marginBottom: '2px' }}>
              {resolvedCustomer} — Delivery Site
            </div>
            <div style={{ color: '#334155', marginTop: '2px' }}>
              {deliveryLines.map((line, idx) => (
                <div key={idx} style={{ lineHeight: '1.35' }}>{line}</div>
              ))}
            </div>
            {(b.siteContact || b.contactPerson || b.mobile) && (b.siteContact !== '—' && b.mobile !== '—') && (
              <div style={{ marginTop: '4px', fontSize: '10.5px', color: '#334155' }}>
                <strong>Site Contact:</strong> {b.siteContact || b.contactPerson || b.mobile}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. MATERIAL SPECIFICATIONS TABLE (PRODUCT, UOM, QUANTITY ONLY) */}
      <table style={{
        width: '100%',
        tableLayout: 'fixed',
        borderCollapse: 'collapse',
        border: '1px solid #CBD5E1',
        borderRadius: '6px',
        overflow: 'hidden',
        marginBottom: '14px',
        fontSize: '11px',
        boxSizing: 'border-box'
      }}>
        <thead>
          <tr style={{ backgroundColor: '#0E7490', color: '#FFFFFF', fontWeight: '800' }}>
            <th style={{ padding: '7px 8px', width: '40px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.25)', fontSize: '10.5px', boxSizing: 'border-box' }}>#</th>
            <th style={{ padding: '7px 12px', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.25)', fontSize: '10.5px', boxSizing: 'border-box' }}>Product / Material Name</th>
            <th style={{ padding: '7px 10px', width: '80px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.25)', fontSize: '10.5px', boxSizing: 'border-box' }}>UOM</th>
            <th style={{ padding: '7px 10px', width: '85px', textAlign: 'center', fontSize: '10.5px', boxSizing: 'border-box' }}>Quantity</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
                No itemized materials in this BOM record.
              </td>
            </tr>
          ) : (
            items.map((item, idx) => {
              const qty = parseFloat(item.qty || item.bomQty || item.quantity || item.targetQty || 0) || 0;
              const itemName = item.name || item.itemName || item.productName || item.item_name || 'Custom Product Item';
              const description = item.specs || (item.name ? item.description : '') || item.category || (item.isPresetItem && item.presetName ? `Kit: ${item.presetName}` : '');

              return (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid #E2E8F0',
                    backgroundColor: idx % 2 === 1 ? '#FAFBFC' : '#FFFFFF',
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid'
                  }}
                >
                  <td style={{ padding: '6px 8px', textAlign: 'center', color: '#64748B', borderRight: '1px solid #E2E8F0' }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '6px 12px', borderRight: '1px solid #E2E8F0', wordBreak: 'break-word' }}>
                    <strong style={{ color: '#0F172A', fontSize: '11.5px' }}>{itemName}</strong>
                    {description && (
                      <div style={{ fontSize: '10px', color: '#64748B', marginTop: '1px', lineHeight: '1.3' }}>
                        {description}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', color: '#475569', borderRight: '1px solid #E2E8F0' }}>
                    {item.uom || item.unit || 'NOS'}
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: '800', color: '#0F172A', fontSize: '11.5px' }}>
                    {qty}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        {items.length > 0 && (
          <tfoot>
            <tr style={{ backgroundColor: '#F8FAFC', borderTop: '2px solid #CBD5E1', fontWeight: '800' }}>
              <td colSpan={3} style={{ padding: '7px 12px', textAlign: 'right', color: '#64748B', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Total Quantity:
              </td>
              <td style={{ padding: '7px 10px', textAlign: 'center', color: '#0E7490', fontSize: '12.5px', fontWeight: '900' }}>
                {totalQuantity}
              </td>
            </tr>
          </tfoot>
        )}
      </table>

      {/* 4. CLEAN AUTHORIZED SIGNATORY (NO STAMP / NO SEAL) */}
      <div className="print-avoid-break" style={{ borderTop: '1.5px solid #CBD5E1', paddingTop: '12px', marginTop: '16px', display: 'flex', justifyContent: 'flex-end', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <div style={{ textAlign: 'center', minWidth: '200px' }}>
          <div style={{ height: '35px' }}></div>
          <div style={{ borderTop: '1.5px dashed #94A3B8', paddingTop: '5px', width: '100%' }}>
            <strong style={{ color: '#0F172A', fontSize: '11px', display: 'block' }}>For VRM Structures India Pvt Ltd</strong>
            <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>Authorized Signatory</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VRMBomPrintTemplate({ bomData, onClose, autoPrint = true }) {
  if (!bomData) return null;
  const b = bomData;

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    if (!autoPrint) return;
    const timer = setTimeout(() => {
      window.print();
    }, 400);
    return () => clearTimeout(timer);
  }, [autoPrint]);

  const bomNumber = b.bomCode || b.code || b.piNo || b.id || 'BOM Order';

  return (
    <div
      className="vrm-bom-modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 16px',
        overflowY: 'auto',
        boxSizing: 'border-box'
      }}
    >
      {/* UNIFIED MODAL CARD CONTAINER */}
      <div
        className="vrm-bom-modal-card"
        style={{
          width: '100%',
          maxWidth: '880px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
          borderRadius: '12px',
          overflow: 'visible',
          backgroundColor: '#FFFFFF',
          boxSizing: 'border-box',
          margin: 'auto 0'
        }}
      >
        {/* TOP FLOATING CONTROL BAR (Hidden when printing) */}
        <div
          className="no-print"
          style={{
            width: '100%',
            backgroundColor: '#0F172A',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#FFFFFF',
            boxSizing: 'border-box',
            borderRadius: '12px 12px 0 0'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: '800', fontSize: '14.5px', letterSpacing: '-0.2px' }}>
              Bill of Materials Document — {bomNumber}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={handlePrint}
              style={{
                backgroundColor: '#0E7490',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 16px',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(14, 116, 144, 0.3)'
              }}
            >
              <Printer size={14} /> Print
            </button>
            <button
              onClick={onClose}
              title="Close Preview"
              style={{
                backgroundColor: '#334155',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* PRINT SHEET CONTENT */}
        <VRMBomPrintSheet bomData={bomData} />
      </div>
    </div>
  );
}
