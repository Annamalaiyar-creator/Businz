import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
    } catch {}
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
    } catch {}
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
    resolvedCustomer = 'Valued Customer';
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
        fontSize: '10.5px',
        lineHeight: '1.35',
        padding: '16px 20px',
        overflow: 'visible'
      }}
    >
      <style>
        {`
          @page {
            size: A4 portrait;
            margin: 6mm 8mm !important;
          }

          @media print {
            html, body {
              width: 100% !important;
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              overflow-x: visible !important;
              overflow-y: visible !important;
              background: #ffffff !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            body.vrm-bom-print-active > *:not(.vrm-bom-modal-overlay),
            body.vrm-bom-print-active #root,
            body:has(.vrm-bom-modal-overlay) > *:not(.vrm-bom-modal-overlay),
            body:has(.vrm-bom-modal-overlay) #root,
            body > *:not(.vrm-bom-modal-overlay) {
              display: none !important;
              height: 0 !important;
              max-height: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
            }

            .no-print,
            .no-print * {
              display: none !important;
              height: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            .vrm-bom-modal-overlay {
              position: static !important;
              display: block !important;
              padding: 0 !important;
              margin: 0 !important;
              background: transparent !important;
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
              overflow: visible !important;
              overflow-x: visible !important;
              overflow-y: visible !important;
              height: auto !important;
              min-height: 0 !important;
              max-height: none !important;
              width: 100% !important;
              max-width: 100% !important;
              top: auto !important;
              bottom: auto !important;
              left: auto !important;
              right: auto !important;
            }

            .vrm-bom-modal-card {
              position: static !important;
              display: block !important;
              max-width: 100% !important;
              width: 100% !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              overflow: visible !important;
              overflow-x: visible !important;
              overflow-y: visible !important;
              height: auto !important;
              min-height: 0 !important;
              max-height: none !important;
              background: transparent !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            #${id},
            #${id} * {
              visibility: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            #${id} div,
            #${id} table,
            #${id} tbody,
            #${id} thead,
            #${id} tfoot,
            #${id} tr,
            #${id} td,
            #${id} th {
              overflow: visible !important;
              overflow-x: visible !important;
              overflow-y: visible !important;
            }

            /* Natural flow layout: begins at top of Page 1 and paginates cleanly onto subsequent pages */
            #${id} {
              visibility: visible !important;
              position: relative !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              min-height: 0 !important;
              height: auto !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              border: none !important;
              padding: 0 !important;
              margin: 0 !important;
              overflow: visible !important;
              overflow-x: visible !important;
              overflow-y: visible !important;
              background: #ffffff !important;
              display: block !important;
            }

            table {
              page-break-inside: auto !important;
              break-inside: auto !important;
              width: 100% !important;
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

      {/* 1. CLEAN OFFICIAL HEADER (LEFT: LOGO + INFO | RIGHT: TITLE) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottom: '2px solid #0E7490',
        paddingBottom: '8px',
        marginBottom: '8px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {/* Left: Logo & Company Information */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: 0, paddingRight: '12px' }}>
          <img
            src={branding.logoUrl || VRM_OFFICIAL_LOGO}
            alt="VRM Structures Logo"
            style={{ height: '36px', maxWidth: '140px', objectFit: 'contain', flexShrink: 0 }}
            onError={(e) => { e.currentTarget.src = VRM_OFFICIAL_LOGO; }}
          />
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '13.5px', fontWeight: '900', color: '#0E7490', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>
              VRM STRUCTURES INDIA PVT LTD
            </h2>
            <div style={{ fontSize: '9.5px', color: '#334155', lineHeight: '1.3', marginTop: '2px' }}>
              1427, GNT Road, Nagappa Industrial Estate, Puzhal, Chennai, Tamil Nadu - 600066<br />
              <strong>GSTIN:</strong> 33AAGCV4262N1ZZ &nbsp;|&nbsp; <strong>Phone:</strong> +91 98847 20789 &nbsp;|&nbsp; <strong>Email:</strong> sales@vrmstructures.com
            </div>
          </div>
        </div>

        {/* Right: Document Title */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '16px', fontWeight: '900', color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: '1.2' }}>
            BILL OF MATERIALS
          </div>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', marginTop: '2px' }}>
            Official Material Specification
          </div>
        </div>
      </div>

      {/* 2. DEDICATED METADATA BAR (NEVER OVERLAPS) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        border: '1px solid #CBD5E1',
        borderRadius: '4px',
        backgroundColor: '#F8FAFC',
        marginBottom: '8px',
        fontSize: '10px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ padding: '4px 10px', borderRight: '1px solid #CBD5E1', whiteSpace: 'nowrap' }}>
          <span style={{ color: '#64748B', fontWeight: '700' }}>BOM Number: </span>
          <span style={{ color: '#0E7490', fontWeight: '800' }}>{bomNumber}</span>
        </div>
        <div style={{ padding: '4px 10px', borderRight: '1px solid #CBD5E1', whiteSpace: 'nowrap' }}>
          <span style={{ color: '#64748B', fontWeight: '700' }}>BOM Date: </span>
          <span style={{ color: '#0F172A', fontWeight: '700' }}>{bomDate}</span>
        </div>
        <div style={{ padding: '4px 10px', whiteSpace: 'nowrap' }}>
          <span style={{ color: '#64748B', fontWeight: '700' }}>Sales Person: </span>
          <span style={{ color: '#0F172A', fontWeight: '700' }}>{salesPersonName}</span>
        </div>
      </div>

      {/* 3. BILLING ADDRESS & SHIPPING ADDRESS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        border: '1px solid #CBD5E1',
        borderRadius: '4px',
        overflow: 'visible',
        marginBottom: '8px',
        backgroundColor: '#FFFFFF',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {/* Bill To Column */}
        <div style={{ borderRight: '1px solid #CBD5E1', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          <div style={{
            backgroundColor: '#ECFEFF',
            borderBottom: '1px solid #CBD5E1',
            padding: '4px 8px',
            color: '#0E7490',
            fontSize: '9.5px',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '0.3px'
          }}>
            Customer &amp; Billing Address (Bill To)
          </div>
          <div style={{ padding: '5px 8px', fontSize: '10px', lineHeight: '1.35', wordBreak: 'break-word', flex: 1, boxSizing: 'border-box' }}>
            <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '11px', marginBottom: '1px' }}>
              {resolvedCustomer}
            </div>
            {b.companyName && b.companyName !== resolvedCustomer && (
              <div style={{ color: '#475569', fontWeight: '600', marginBottom: '1px', fontSize: '9.5px' }}>{b.companyName}</div>
            )}
            {b.contactPerson && (
              <div style={{ color: '#475569', fontSize: '9.5px' }}>
                <strong>Contact:</strong> {b.contactPerson}
              </div>
            )}
            {b.gstNo && b.gstNo !== '—' && (
              <div style={{ color: '#0E7490', fontSize: '9.5px', fontWeight: '700' }}>
                <strong>GSTIN:</strong> {b.gstNo}
              </div>
            )}
            <div style={{ color: '#334155', marginTop: '1px' }}>
              {billingLines.map((line, idx) => (
                <div key={idx} style={{ lineHeight: '1.25' }}>{line}</div>
              ))}
            </div>
            {b.mobile && b.mobile !== '—' && (
              <div style={{ marginTop: '2px', fontSize: '9.5px', color: '#334155' }}><strong>Phone:</strong> {b.mobile}</div>
            )}
            {b.email && b.email !== '—' && (
              <div style={{ fontSize: '9.5px', color: '#334155' }}><strong>Email:</strong> {b.email}</div>
            )}
          </div>
        </div>

        {/* Ship To Column */}
        <div style={{ display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          <div style={{
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #CBD5E1',
            padding: '4px 8px',
            color: '#475569',
            fontSize: '9.5px',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '0.3px'
          }}>
            Delivery Destination &amp; Consignee (Ship To)
          </div>
          <div style={{ padding: '5px 8px', fontSize: '10px', lineHeight: '1.35', wordBreak: 'break-word', flex: 1, boxSizing: 'border-box' }}>
            <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '11px', marginBottom: '1px' }}>
              {resolvedCustomer} — Delivery Site
            </div>
            <div style={{ color: '#334155', marginTop: '1px' }}>
              {deliveryLines.map((line, idx) => (
                <div key={idx} style={{ lineHeight: '1.25' }}>{line}</div>
              ))}
            </div>
            {(b.siteContact || b.contactPerson || b.mobile) && (b.siteContact !== '—' && b.mobile !== '—') && (
              <div style={{ marginTop: '2px', fontSize: '9.5px', color: '#334155' }}>
                <strong>Site Contact:</strong> {b.siteContact || b.contactPerson || b.mobile}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. MATERIAL SPECIFICATIONS TABLE (PRODUCT, UOM, QUANTITY ONLY) */}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        border: '1px solid #CBD5E1',
        marginBottom: '8px',
        fontSize: '10px',
        boxSizing: 'border-box'
      }}>
        <thead>
          <tr style={{ backgroundColor: '#0E7490', color: '#FFFFFF', fontWeight: '800' }}>
            <th style={{ padding: '4px 6px', width: '32px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.3)', borderBottom: '1px solid #0E7490', fontSize: '9.5px', boxSizing: 'border-box' }}>#</th>
            <th style={{ padding: '4px 8px', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.3)', borderBottom: '1px solid #0E7490', fontSize: '9.5px', boxSizing: 'border-box' }}>Product / Material Name</th>
            <th style={{ padding: '4px 6px', width: '65px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.3)', borderBottom: '1px solid #0E7490', fontSize: '9.5px', boxSizing: 'border-box' }}>UOM</th>
            <th style={{ padding: '4px 6px', width: '70px', textAlign: 'center', borderBottom: '1px solid #0E7490', fontSize: '9.5px', boxSizing: 'border-box' }}>Quantity</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '10.5px' }}>
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
                    backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid'
                  }}
                >
                  <td style={{ padding: '3.5px 6px', textAlign: 'center', color: '#64748B', borderRight: '1px solid #E2E8F0' }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '3.5px 8px', borderRight: '1px solid #E2E8F0', wordBreak: 'break-word' }}>
                    <strong style={{ color: '#0F172A', fontSize: '10.5px' }}>{itemName}</strong>
                    {description && (
                      <span style={{ fontSize: '9px', color: '#64748B', marginLeft: '6px', fontWeight: '500' }}>
                        ({description})
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '3.5px 6px', textAlign: 'center', color: '#475569', borderRight: '1px solid #E2E8F0' }}>
                    {item.uom || item.unit || 'NOS'}
                  </td>
                  <td style={{ padding: '3.5px 6px', textAlign: 'center', fontWeight: '800', color: '#0F172A', fontSize: '10.5px' }}>
                    {qty}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        {items.length > 0 && (
          <tfoot>
            <tr style={{ backgroundColor: '#F1F5F9', borderTop: '1.5px solid #CBD5E1', fontWeight: '800' }}>
              <td colSpan={3} style={{ padding: '5px 8px', textAlign: 'right', color: '#475569', fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Total Quantity:
              </td>
              <td style={{ padding: '5px 6px', textAlign: 'center', color: '#0E7490', fontSize: '11.5px', fontWeight: '900' }}>
                {totalQuantity}
              </td>
            </tr>
          </tfoot>
        )}
      </table>

    </div>
  );
}

export default function VRMBomPrintTemplate({ bomData, onClose, autoPrint = true }) {
  const b = bomData || {};

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    if (!bomData) return;
    if (typeof document !== 'undefined') {
      document.body.classList.add('vrm-bom-print-active');
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('vrm-bom-print-active');
      }
    };
  }, [bomData]);

  useEffect(() => {
    if (!bomData || !autoPrint) return;
    const timer = setTimeout(() => {
      window.print();
    }, 400);
    return () => clearTimeout(timer);
  }, [bomData, autoPrint]);

  if (!bomData) return null;

  const bomNumber = b.bomCode || b.code || b.piNo || b.id || 'BOM Order';

  const modalContent = (
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

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
