import React, { useState, useEffect } from 'react';
import { Printer, X, Download } from 'lucide-react';
import { getCachedBranding, fetchMasterBranding, subscribeBrandingUpdates } from '../services/brandingService';
import { VRM_OFFICIAL_LOGO, VRM_OFFICIAL_STAMP } from '../utils/vrmOfficialAssets';

function numberToWordsINR(num) {
  if (num === null || num === undefined || isNaN(num) || num === 0) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convert = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
  };

  const integerPart = Math.floor(num);
  const words = convert(integerPart);
  return `${words} Rupees Only`;
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
  const items = Array.isArray(b.items) && b.items.length > 0 ? b.items : [];



  // Format addresses cleanly
  const bObj = b.billingAddressObj || {};
  const bStreet = bObj.address || b.billingAddress || '';
  const bCity = bObj.city || '';
  const bState = bObj.state || '';
  const bPin = bObj.pincode || '';

  const dObj = b.deliveryAddressObj || {};
  const dStreet = dObj.address || b.deliveryAddress || (b.sameAsBilling ? bStreet : '');
  const dCity = dObj.city || (b.sameAsBilling ? bCity : '');
  const dState = dObj.state || (b.sameAsBilling ? bState : '');
  const dPin = dObj.pincode || (b.sameAsBilling ? bPin : '');

  const formatAddressBlock = (street, city, state, pin) => {
    const parts = [];
    const cleanStreet = (street && street !== '-' && street !== '—' && street !== 'null' && street !== 'undefined') ? String(street).trim() : '';
    if (cleanStreet) parts.push(cleanStreet);

    const cityStatePin = [
      city && city !== '-' ? String(city).trim() : '',
      state && state !== '-' ? String(state).trim() : '',
      pin && pin !== '-' ? (String(pin).toLowerCase().includes('pin') ? String(pin).trim() : `PIN: ${String(pin).trim()}`) : ''
    ].filter(Boolean).join(', ');

    if (cityStatePin) parts.push(cityStatePin);
    return parts;
  };

  const billingLines = formatAddressBlock(bStreet, bCity, bState, bPin);
  const deliveryLines = formatAddressBlock(dStreet, dCity, dState, dPin);

  return (
    <div
      id={id}
      style={{
        width: '100%',
        maxWidth: '880px',
        backgroundColor: '#FFFFFF',
        color: '#0F172A',
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif",
        fontSize: '12.5px',
        lineHeight: '1.5',
        boxSizing: 'border-box',
        boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
        padding: '36px 42px',
        borderRadius: '0 0 12px 12px'
      }}
    >
      <style>
          {`
            @media print {
              body * { visibility: hidden !important; }
              .no-print { display: none !important; }
              #printable-bom-document, #printable-bom-document * {
                visibility: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              #printable-bom-document {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              @page {
                size: A4 portrait;
                margin: 14mm 14mm;
              }
              thead {
                display: table-header-group !important;
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

        {/* 1. OFFICIAL HEADER WITH LOGO AND COMPANY INFO */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '2.5px solid #0E7490', paddingBottom: '16px', marginBottom: '18px' }}>
          <tbody>
            <tr>
              <td style={{ width: '58%', verticalAlign: 'top', paddingRight: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
                  <img
                    src={branding.logoUrl || VRM_OFFICIAL_LOGO}
                    alt="VRM Structures Logo"
                    style={{ height: '48px', maxWidth: '200px', objectFit: 'contain' }}
                    onError={(e) => { e.currentTarget.src = VRM_OFFICIAL_LOGO; }}
                  />
                  <div>
                    <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '900', color: '#0E7490', letterSpacing: '-0.2px' }}>
                      VRM STRUCTURES INDIA PVT LTD
                    </h2>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', display: 'block', marginTop: '2px' }}>
                      Pioneering Solar Mounting Structures & Infrastructure
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#334155', lineHeight: '1.45', marginTop: '4px' }}>
                  1427, GNT Road, Nagappa Industrial Estate, Puzhal, Chennai, Tamil Nadu - 600066<br />
                  <strong>GSTIN:</strong> 33AAGCV4262N1ZZ &nbsp;|&nbsp; <strong>Phone:</strong> +91 98847 20789 &nbsp;|&nbsp; <strong>Email:</strong> sales@vrmstructures.com
                </div>
              </td>
              <td style={{ width: '42%', verticalAlign: 'top', textAlign: 'right' }}>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  BILL OF MATERIALS (BOM)
                </div>
                <table style={{ marginLeft: 'auto', borderCollapse: 'collapse', border: '1px solid #CBD5E1', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#F8FAFC', fontSize: '11.5px' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '6px 12px', color: '#64748B', fontWeight: '700', textAlign: 'left', backgroundColor: '#F1F5F9' }}>Order Date</td>
                      <td style={{ padding: '6px 14px', color: '#0F172A', fontWeight: '700', textAlign: 'right' }}>{b.date || new Date().toISOString().split('T')[0]}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 12px', color: '#64748B', fontWeight: '700', textAlign: 'left', backgroundColor: '#F1F5F9' }}>Sales Person</td>
                      <td style={{ padding: '6px 14px', color: '#0F172A', fontWeight: '700', textAlign: 'right' }}>{b.salesPerson || 'Mohith JV'}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 2. CUSTOMER & ADDRESSES (BILL TO / SHIP TO) */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CBD5E1', borderRadius: '6px', marginBottom: '16px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ backgroundColor: '#ECFEFF', borderBottom: '1.5px solid #CBD5E1', color: '#0E7490', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <th style={{ width: '50%', padding: '8px 14px', textAlign: 'left', fontWeight: '800', borderRight: '1px solid #CBD5E1' }}>
                Customer & Billing Address (Bill To)
              </th>
              <th style={{ width: '50%', padding: '8px 14px', textAlign: 'left', fontWeight: '800' }}>
                Delivery Destination & Consignee (Ship To)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '12px 14px', verticalAlign: 'top', borderRight: '1px solid #CBD5E1', fontSize: '12px', lineHeight: '1.55' }}>
                <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '13.5px', marginBottom: '4px' }}>
                  {b.customerName || b.companyName || 'Valued Customer'}
                </div>
                {b.companyName && b.companyName !== b.customerName && (
                  <div style={{ color: '#475569', fontWeight: '600', marginBottom: '4px', fontSize: '11.5px' }}>{b.companyName}</div>
                )}
                {b.contactPerson && (
                  <div style={{ color: '#475569', fontSize: '11.5px', marginBottom: '3px' }}>
                    <strong>Contact:</strong> {b.contactPerson}
                  </div>
                )}
                {b.gstNo && (
                  <div style={{ color: '#0E7490', fontSize: '11.5px', fontWeight: '700', marginBottom: '4px' }}>
                    <strong>GSTIN:</strong> {b.gstNo}
                  </div>
                )}
                <div style={{ color: '#334155' }}>
                  {billingLines.length > 0 ? (
                    billingLines.map((line, idx) => <div key={idx}>{line}</div>)
                  ) : (
                    <div style={{ color: '#64748B', fontStyle: 'italic' }}>Address on file</div>
                  )}
                  {b.mobile && b.mobile !== '—' && (
                    <div style={{ marginTop: '4px' }}><strong>Phone:</strong> {b.mobile}</div>
                  )}
                  {b.email && b.email !== '—' && (
                    <div><strong>Email:</strong> {b.email}</div>
                  )}
                </div>
              </td>
              <td style={{ padding: '12px 14px', verticalAlign: 'top', fontSize: '12px', lineHeight: '1.55' }}>
                <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '13.5px', marginBottom: '4px' }}>
                  {b.customerName || b.companyName || 'Valued Customer'} — Delivery Site
                </div>
                <div style={{ color: '#334155' }}>
                  {deliveryLines.length > 0 ? (
                    deliveryLines.map((line, idx) => <div key={idx}>{line}</div>)
                  ) : (
                    <div style={{ color: '#0E7490', fontWeight: '600' }}>Same as Billing Address</div>
                  )}
                  {b.mobile && b.mobile !== '—' && (
                    <div style={{ marginTop: '4px' }}><strong>Site Contact:</strong> {b.mobile}</div>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 3. TRANSPORT & LOGISTICS TABLE (Uniform Table Grid) */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CBD5E1', borderRadius: '6px', marginBottom: '16px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #CBD5E1', color: '#0E7490', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              <th style={{ width: '20%', padding: '8px 12px', textAlign: 'left', fontWeight: '800', borderRight: '1px solid #E2E8F0' }}>Mode of Transport</th>
              <th style={{ width: '20%', padding: '8px 12px', textAlign: 'left', fontWeight: '800', borderRight: '1px solid #E2E8F0' }}>Scope</th>
              <th style={{ width: '25%', padding: '8px 12px', textAlign: 'left', fontWeight: '800', borderRight: '1px solid #E2E8F0' }}>Transport Name</th>
              <th style={{ width: '20%', padding: '8px 12px', textAlign: 'left', fontWeight: '800', borderRight: '1px solid #E2E8F0' }}>Vehicle Number</th>
              <th style={{ width: '15%', padding: '8px 12px', textAlign: 'left', fontWeight: '800' }}>LR / Docket No</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '10px 12px', borderRight: '1px solid #E2E8F0', fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>
                {b.transportMode || 'Transport'}
              </td>
              <td style={{ padding: '10px 12px', borderRight: '1px solid #E2E8F0', fontSize: '12px', fontWeight: '700', color: b.transportScope === 'Customer Scope' ? '#0284C7' : '#0F172A' }}>
                {b.transportScope || 'VRM Structures'}
              </td>
              <td style={{ padding: '10px 12px', borderRight: '1px solid #E2E8F0', fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>
                {b.transporterName || '—'}
              </td>
              <td style={{ padding: '10px 12px', borderRight: '1px solid #E2E8F0', fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>
                {b.vehicleNo || '—'}
              </td>
              <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>
                {b.lrNo || '—'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 4. ITEMIZED PRODUCTS & MATERIALS TABLE (PURE SPECIFICATION - NO AMOUNTS) */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CBD5E1', marginBottom: '16px', fontSize: '11.5px' }}>
          <thead>
            <tr style={{ backgroundColor: '#0E7490', color: '#FFFFFF', fontWeight: '800' }}>
              <th style={{ padding: '10px 8px', width: '36px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.25)', fontSize: '11px' }}>#</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.25)', fontSize: '11px' }}>Product / Material Name</th>
              <th style={{ padding: '10px 10px', width: '160px', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.25)', fontSize: '11px' }}>Specification / Description</th>
              <th style={{ padding: '10px 10px', width: '80px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.25)', fontSize: '11px' }}>UOM</th>
              <th style={{ padding: '10px 10px', width: '80px', textAlign: 'center', fontSize: '11px' }}>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                  No itemized materials in this BOM record.
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const qty = parseFloat(item.qty) || 0;

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
                    <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64748B', borderRight: '1px solid #E2E8F0' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '10px 12px', borderRight: '1px solid #E2E8F0' }}>
                      <strong style={{ color: '#0F172A', fontSize: '12px' }}>{item.name || 'Custom Product Item'}</strong>
                      {item.isPresetItem && item.presetName && (
                        <span style={{ display: 'block', fontSize: '10px', color: '#0E7490', marginTop: '2px', fontWeight: '600' }}>
                          Kit: {item.presetName}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'left', color: '#475569', borderRight: '1px solid #E2E8F0' }}>
                      {item.category || item.specs || '—'}
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'center', color: '#475569', borderRight: '1px solid #E2E8F0' }}>
                      {item.uom || item.unit || 'NOS'}
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: '800', color: '#0F172A' }}>
                      {qty}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* 5. SUMMARY & ORDER DISPATCH METRICS (NO FINANCIAL PRICING) */}
        <table className="print-avoid-break" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <tbody>
            <tr>
              <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CBD5E1', borderRadius: '6px', overflow: 'hidden', marginBottom: '10px' }}>
                  <tbody>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '6px 12px', fontSize: '10.5px', fontWeight: '800', color: '#0E7490', textTransform: 'uppercase' }}>
                        Dispatch & Delivery Terms
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>
                        {b.transportScope || 'Standard Delivery'}
                        {b.creditDays ? ` (${b.creditDays} Days Credit)` : ''}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {b.remarks && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#475569', lineHeight: '1.4' }}>
                    <strong>Remarks / Dispatch Notes:</strong> {b.remarks}
                  </div>
                )}
              </td>
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse', border: '1px solid #CBD5E1', borderRadius: '6px', overflow: 'hidden' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                      <td style={{ padding: '8px 12px', color: '#0E7490', fontWeight: '800', textTransform: 'uppercase', fontSize: '10.5px' }} colSpan={2}>
                        Production & Dispatch Scope
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '8px 12px', color: '#64748B' }}>Total Line Items</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                        {items.length} Item{items.length !== 1 ? 's' : ''}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '8px 12px', color: '#64748B' }}>Total Quantity Count</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800', color: '#0E7490' }}>
                        {items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0)} Units
                      </td>
                    </tr>
                    <tr style={{ backgroundColor: '#ECFEFF' }}>
                      <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: '800', color: '#0E7490' }}>
                        Material Status
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: '800', color: '#059669' }}>
                        Verified for Dispatch
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 6. SIGNATURES & FOOTER */}
        <div className="print-avoid-break" style={{ borderTop: '2px solid #CBD5E1', paddingTop: '16px', marginTop: '22px', display: 'flex', justifyContent: 'flex-end', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <div style={{ textAlign: 'center', minWidth: '230px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {branding.showSignatoryStamp && (
              <div style={{ minHeight: '65px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                <img
                  src={branding.customStampUrl || VRM_OFFICIAL_STAMP || '/vrm_stamp.png'}
                  alt="VRM Structures Official Stamp"
                  onError={(e) => {
                    if (e.currentTarget.src !== VRM_OFFICIAL_STAMP) {
                      e.currentTarget.src = VRM_OFFICIAL_STAMP;
                    }
                  }}
                  style={{
                    maxHeight: '90px',
                    maxWidth: '220px',
                    objectFit: 'contain'
                  }}
                />
              </div>
            )}
            <div style={{ borderTop: '1.5px dashed #94A3B8', paddingTop: '6px', width: '100%' }}>
              <strong style={{ color: '#0F172A', fontSize: '11.5px', display: 'block' }}>{branding.forCompanyText || 'For VRM Structures India Pvt Ltd'}</strong>
              <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '4px' }}>{branding.signatoryTitle || 'Authorized Signatory'}</div>
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

  return (
    <div
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
        padding: '20px',
        overflowY: 'auto'
      }}
    >
      {/* TOP FLOATING CONTROL BAR (Hidden when printing) */}
      <div
        className="no-print"
        style={{
          width: '100%',
          maxWidth: '880px',
          backgroundColor: '#0F172A',
          borderRadius: '12px 12px 0 0',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#FFFFFF',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: '800', fontSize: '15px' }}>
            Bill of Materials Document — {b.bomCode || b.code || 'BOM-621'}
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
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(14, 116, 144, 0.3)'
            }}
          >
            <Printer size={15} /> Print
          </button>
          <button
            onClick={onClose}
            title="Close Preview"
            style={{
              backgroundColor: '#334155',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <VRMBomPrintSheet bomData={bomData} />
    </div>
  );
}
