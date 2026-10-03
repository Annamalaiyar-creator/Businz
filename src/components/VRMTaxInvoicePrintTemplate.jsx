import React, { useState, useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import { getCachedBranding, fetchMasterBranding, subscribeBrandingUpdates } from '../services/brandingService';
import { VRM_OFFICIAL_LOGO, VRM_OFFICIAL_STAMP } from '../utils/vrmOfficialAssets';

// Helper function to format currency into Indian Rupees words
export function numberToWordsINR(num) {
  if (num === null || num === undefined || isNaN(num) || num === 0) return 'Indian Rupee Zero Only';
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

  const integerPart = Math.floor(Math.abs(num));
  const words = convert(integerPart).trim();
  return `Indian Rupee ${words} Only`;
}

// Realistic Government e-Invoice QR Code SVG
function GovernmentInvoiceQRCode({ size = 110 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 130 130" fill="#000000" style={{ display: 'block' }}>
      <rect width="130" height="130" fill="#FFFFFF"/>
      {/* Top Left Finder */}
      <rect x="10" y="10" width="30" height="30" fill="#000000"/>
      <rect x="15" y="15" width="20" height="20" fill="#FFFFFF"/>
      <rect x="20" y="20" width="10" height="10" fill="#000000"/>

      {/* Top Right Finder */}
      <rect x="90" y="10" width="30" height="30" fill="#000000"/>
      <rect x="95" y="15" width="20" height="20" fill="#FFFFFF"/>
      <rect x="100" y="20" width="10" height="10" fill="#000000"/>

      {/* Bottom Left Finder */}
      <rect x="10" y="90" width="30" height="30" fill="#000000"/>
      <rect x="15" y="95" width="20" height="20" fill="#FFFFFF"/>
      <rect x="20" y="100" width="10" height="10" fill="#000000"/>

      {/* Timing Patterns */}
      <rect x="45" y="22" width="40" height="6" fill="#000000" stroke="#FFFFFF" strokeDasharray="6 6"/>
      <rect x="22" y="45" width="6" height="40" fill="#000000" stroke="#FFFFFF" strokeDasharray="6 6"/>

      {/* Dense Modules Matrix */}
      <rect x="46" y="10" width="6" height="6" fill="#000"/>
      <rect x="58" y="10" width="6" height="6" fill="#000"/>
      <rect x="70" y="10" width="6" height="6" fill="#000"/>
      <rect x="52" y="26" width="6" height="6" fill="#000"/>
      <rect x="64" y="26" width="6" height="6" fill="#000"/>
      <rect x="76" y="26" width="6" height="6" fill="#000"/>

      <rect x="46" y="46" width="18" height="18" fill="#000"/>
      <rect x="50" y="50" width="10" height="10" fill="#FFF"/>
      <rect x="52" y="52" width="6" height="6" fill="#000"/>

      <rect x="72" y="46" width="12" height="6" fill="#000"/>
      <rect x="90" y="46" width="6" height="12" fill="#000"/>
      <rect x="102" y="46" width="18" height="6" fill="#000"/>
      <rect x="108" y="58" width="12" height="6" fill="#000"/>

      <rect x="10" y="46" width="6" height="12" fill="#000"/>
      <rect x="22" y="58" width="12" height="6" fill="#000"/>
      <rect x="34" y="46" width="6" height="18" fill="#000"/>

      <rect x="46" y="70" width="12" height="6" fill="#000"/>
      <rect x="64" y="70" width="18" height="6" fill="#000"/>
      <rect x="88" y="70" width="6" height="12" fill="#000"/>
      <rect x="100" y="70" width="20" height="6" fill="#000"/>

      <rect x="46" y="82" width="6" height="12" fill="#000"/>
      <rect x="58" y="82" width="18" height="6" fill="#000"/>
      <rect x="82" y="82" width="12" height="12" fill="#000"/>
      <rect x="100" y="82" width="6" height="12" fill="#000"/>
      <rect x="112" y="82" width="8" height="6" fill="#000"/>

      <rect x="46" y="100" width="18" height="6" fill="#000"/>
      <rect x="70" y="94" width="6" height="18" fill="#000"/>
      <rect x="82" y="100" width="12" height="6" fill="#000"/>
      <rect x="100" y="100" width="20" height="6" fill="#000"/>

      <rect x="52" y="112" width="12" height="8" fill="#000"/>
      <rect x="76" y="112" width="18" height="8" fill="#000"/>
      <rect x="106" y="112" width="14" height="8" fill="#000"/>
    </svg>
  );
}

// Default benchmark invoice dataset matching official Zoho Books Tax Invoice PDF
export const DEFAULT_OFFICIAL_TAX_INVOICE_DATA = {
  invNo: 'VRMS/26-27/2309',
  date: '17-08-2026',
  terms: 'Due on Receipt',
  ewayBill: '542055911945',
  placeOfSupply: 'Tamil Nadu (33)',
  salesPerson: 'Mohith',
  vendor: 'VASAN ENTERPRISES',
  customerName: 'VASAN ENTERPRISES',
  billingAddress: 'Old No 39B, New No 75, KG Towers, Jawahar Bazaar,\nCoimbatore Road, canara Bank upstairs,\nKarur 639001\nTamil Nadu\nIndia',
  gstNo: '33CIQPB3415A1ZX',
  shippingName: 'Ramesh Sivagnanam',
  shippingPhone: '+91-9659440090',
  shippingAltPhone: '9313 6577 5076',
  shippingAddress: '2/587, THESOOR ROAD,\nPonnur, ,\nTiruvannamalai 604408\nTamil Nadu\nIndia',
  bankDetails: {
    beneficiary: 'VRM Structures India Private Limited',
    accountNo: '50200031629272',
    bankName: 'HDFC Bank',
    branch: 'Kodambakkam',
    ifsc: 'HDFC0000574'
  },
  irn: '4b92904b4d6411f74bba72614aa9c1701423c1b80cfb8c712ed565bc2789db83',
  ackNo: '152626823842153',
  ackDate: '2026-08-17 15:19:00',
  items: [
    {
      sNo: 1,
      name: 'Strut Rail - KW',
      description: "Supply of 40*40*2mm Strut Channel\nAluminum MMS - Struct Rail bit 40 mm Height, 3550 mm length - 4 no's\nEnd Clamps - Z Clamp 30 mm - 4 no's\nMid Clamps - U Clamp 30 mm - 10 no's\nSpring Nut - GI / Zinc Coated - 14 no's\nSS304 - Allen Bolt M8*30 - with spring washer - 16 no's\nEPDM Sheet - 40*40*2mm - 16 no's\nSelf tapping screws - M6, 65 mm length - GI - 16 no's",
      hsn: '76109010',
      qty: '3.30',
      unit: 'kW',
      rate: 2100.00,
      cgstPct: '9%',
      sgstPct: '9%',
      amount: 6930.00
    },
    {
      sNo: 2,
      name: 'Module',
      description: "Solar panel\nBRAND: Vikram (DCR)\nWP: 550Wp\n53629695\n53629689\n53629548\n53629694\n53629552\n53629693",
      hsn: '85414011',
      qty: '6.00',
      unit: "no's",
      rate: 13420.00,
      cgstPct: '2.5%',
      sgstPct: '2.5%',
      amount: 80520.00
    },
    {
      sNo: 3,
      name: 'Earthing Kit',
      description: "Earthing Kit\nEarth rod - 3\nChemical Bag -3\nEarth pit chamber -3\nLighting Arrestor - 1",
      hsn: '85359090',
      qty: '1.00',
      unit: 'Set',
      rate: 3150.00,
      cgstPct: '9%',
      sgstPct: '9%',
      amount: 3150.00
    },
    {
      sNo: 4,
      name: 'Inverter',
      description: "Solar On-Grid Inverter\nBRAND: Deye\nKW: 3Kw\nPH: 1 Phase\n2601319063",
      hsn: '85044090',
      qty: '1.00',
      unit: "no's",
      rate: 15600.00,
      cgstPct: '2.5%',
      sgstPct: '2.5%',
      amount: 15600.00
    }
  ]
};

/**
 * VRMTaxInvoicePrintSheet
 * Pixel-perfect standalone printable sheet matching Zoho Books official Tax Invoice format.
 */
export function VRMTaxInvoicePrintSheet({ invoiceData, id = "printable-tax-invoice", settings = {} }) {
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

  const inv = { ...DEFAULT_OFFICIAL_TAX_INVOICE_DATA, ...(invoiceData || {}) };
  const items = Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : DEFAULT_OFFICIAL_TAX_INVOICE_DATA.items;

  // Calculate totals and group taxes dynamically
  const subTotal = items.reduce((sum, it) => sum + Number(it.amount || (it.qty * it.rate) || 0), 0);

  // Group CGST and SGST by percentage rate
  const taxGroups = {};
  items.forEach(it => {
    const itemAmt = Number(it.amount || (it.qty * it.rate) || 0);
    const cgstRate = it.cgstPct ? parseFloat(it.cgstPct) : (it.tax ? parseFloat(it.tax) / 2 : 2.5);
    const sgstRate = it.sgstPct ? parseFloat(it.sgstPct) : (it.tax ? parseFloat(it.tax) / 2 : 2.5);

    const cgstKey = `CGST${cgstRate} (${cgstRate}%)`;
    const sgstKey = `SGST${sgstRate} (${sgstRate}%)`;

    taxGroups[cgstKey] = (taxGroups[cgstKey] || 0) + (itemAmt * (cgstRate / 100));
    taxGroups[sgstKey] = (taxGroups[sgstKey] || 0) + (itemAmt * (sgstRate / 100));
  });

  const totalTaxes = Object.values(taxGroups).reduce((s, v) => s + v, 0);
  const rawTotal = subTotal + totalTaxes;
  const grandTotal = Math.round(rawTotal);
  const rounding = Number((grandTotal - rawTotal).toFixed(2));

  // Billing address lines
  const billingLines = typeof inv.billingAddress === 'string'
    ? inv.billingAddress.split('\n').filter(Boolean)
    : [
        'Old No 39B, New No 75, KG Towers, Jawahar Bazaar,',
        'Coimbatore Road, canara Bank upstairs,',
        'Karur 639001',
        'Tamil Nadu',
        'India'
      ];

  // Shipping address lines
  const shippingLines = typeof inv.shippingAddress === 'string'
    ? inv.shippingAddress.split('\n').filter(Boolean)
    : [
        '2/587, THESOOR ROAD,',
        'Ponnur, ,',
        'Tiruvannamalai 604408',
        'Tamil Nadu',
        'India'
      ];

  const logoSrc = branding.logoUrl || VRM_OFFICIAL_LOGO;
  const stampSrc = branding.customStampUrl || VRM_OFFICIAL_STAMP || '/vrm_stamp.png';

  return (
    <div
      id={id}
      style={{
        width: '100%',
        maxWidth: '850px',
        backgroundColor: '#FFFFFF',
        color: '#000000',
        fontFamily: "'Calibri', 'Arial', sans-serif",
        fontSize: '12px',
        lineHeight: '1.3',
        boxSizing: 'border-box',
        margin: '0 auto',
        padding: '24px 30px'
      }}
    >
      <style>
        {`
          @media print {
            body * { visibility: hidden !important; }
            .no-print { display: none !important; }
            #${id}, #${id} * { visibility: visible !important; }
            #${id} {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              box-shadow: none !important;
              padding: 10mm 12mm !important;
              margin: 0 !important;
            }
            .page-break { page-break-before: always !important; }
          }
        `}
      </style>

      {/* ========================================================= */}
      {/* PAGE 1: INVOICE HEADER, METADATA, ADDRESSES & LINE ITEMS  */}
      {/* ========================================================= */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000000', marginBottom: '0' }}>
        <tbody>
          {/* ROW 1: COMPANY LOGO & ADDRESS (LEFT) | TAX INVOICE TITLE (RIGHT) */}
          <tr>
            <td colSpan={8} style={{ padding: '16px 18px', borderBottom: '1px solid #000000', verticalAlign: 'top' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                {/* Left: Logo & Company Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  <img
                    src={logoSrc}
                    alt="VRM Structures Logo"
                    style={{ height: '54px', maxWidth: '200px', objectFit: 'contain' }}
                    onError={(e) => { e.currentTarget.src = VRM_OFFICIAL_LOGO; }}
                  />
                  <div style={{ fontSize: '11px', color: '#0F172A', lineHeight: '1.4' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#002B49', marginBottom: '2px' }}>
                      VRM Structures India Pvt Ltd.
                    </div>
                    <div>1427, GNT Road, Nagappa Industrial Estate,</div>
                    <div>Puzhal,</div>
                    <div>Chennai, Tamil Nadu 600066</div>
                    <div>India</div>
                    <div style={{ fontWeight: 'bold', marginTop: '2px' }}>GSTIN 33AAGCV4262N1ZZ</div>
                    <div>9884720789</div>
                  </div>
                </div>

                {/* Right: TAX INVOICE Title */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: '28px',
                    fontWeight: 'bold',
                    color: '#1E3A8A',
                    letterSpacing: '1px',
                    lineHeight: '1'
                  }}>
                    TAX INVOICE
                  </div>
                </div>
              </div>
            </td>
          </tr>

          {/* ROW 2: INVOICE METADATA 2-COLUMN TABLE */}
          <tr style={{ borderBottom: '1px solid #000000' }}>
            <td colSpan={4} style={{ width: '50%', padding: '8px 14px', borderRight: '1px solid #000000', verticalAlign: 'top', fontSize: '11.5px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 'bold', width: '110px', padding: '2px 0' }}>Invoice No.</td>
                    <td style={{ padding: '2px 0' }}>: <strong>{inv.invNo || inv.invoiceNo || 'VRMS/26-27/2309'}</strong></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', padding: '2px 0' }}>Invoice Date</td>
                    <td style={{ padding: '2px 0' }}>: {inv.date || '17-08-2026'}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', padding: '2px 0' }}>Terms</td>
                    <td style={{ padding: '2px 0' }}>: {inv.terms || inv.paymentTerms || 'Due on Receipt'}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', padding: '2px 0' }}>E-Way Bill#</td>
                    <td style={{ padding: '2px 0' }}>: <strong>{inv.ewayBill || '542055911945'}</strong></td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td colSpan={4} style={{ width: '50%', padding: '8px 14px', verticalAlign: 'top', fontSize: '11.5px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 'bold', width: '120px', padding: '2px 0' }}>Place Of Supply</td>
                    <td style={{ padding: '2px 0' }}>: <strong>{inv.placeOfSupply || 'Tamil Nadu (33)'}</strong></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', padding: '2px 0' }}>Sales person</td>
                    <td style={{ padding: '2px 0' }}>: {inv.salesPerson || 'Mohith'}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* ROW 3: BILL TO / SHIP TO SECTION HEADER */}
          <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #000000' }}>
            <td colSpan={4} style={{ width: '50%', padding: '5px 14px', fontWeight: 'bold', borderRight: '1px solid #000000', fontSize: '11.5px', color: '#0F172A' }}>
              Bill To
            </td>
            <td colSpan={4} style={{ width: '50%', padding: '5px 14px', fontWeight: 'bold', fontSize: '11.5px', color: '#0F172A' }}>
              Ship To
            </td>
          </tr>

          {/* ROW 4: BILL TO / SHIP TO ADDRESS BODY */}
          <tr style={{ borderBottom: '1px solid #000000' }}>
            <td colSpan={4} style={{ width: '50%', padding: '10px 14px', borderRight: '1px solid #000000', verticalAlign: 'top', fontSize: '11px', lineHeight: '1.45' }}>
              <div style={{ fontWeight: 'bold', color: '#1E3A8A', fontSize: '12px', marginBottom: '2px' }}>
                {inv.vendor || inv.customerName || 'VASAN ENTERPRISES'}
              </div>
              {billingLines.map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
              <div style={{ fontWeight: 'bold', marginTop: '3px' }}>
                {inv.gstNo || '33CIQPB3415A1ZX'}
              </div>
            </td>
            <td colSpan={4} style={{ width: '50%', padding: '10px 14px', verticalAlign: 'top', fontSize: '11px', lineHeight: '1.45' }}>
              <div style={{ fontWeight: 'bold', color: '#0F172A', fontSize: '12px' }}>
                {inv.shippingName || 'Ramesh Sivagnanam'}
              </div>
              {inv.shippingAltPhone && (
                <div style={{ color: '#475569' }}>({inv.shippingAltPhone})</div>
              )}
              {shippingLines.map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
              {inv.shippingPhone && (
                <div style={{ fontWeight: 'bold', marginTop: '3px' }}>
                  {inv.shippingPhone}
                </div>
              )}
            </td>
          </tr>

          {/* ROW 5: LINE ITEMS TABLE HEADER */}
          <tr style={{ borderBottom: '1px solid #000000', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#F8FAFC' }}>
            <td style={{ padding: '6px 4px', borderRight: '1px solid #000000', width: '32px', textAlign: 'center' }}>S.<br/>no</td>
            <td style={{ padding: '6px 8px', borderRight: '1px solid #000000', textAlign: 'left' }}>Item & Description</td>
            <td style={{ padding: '6px 6px', borderRight: '1px solid #000000', width: '70px', textAlign: 'center' }}>HSN</td>
            <td style={{ padding: '6px 6px', borderRight: '1px solid #000000', width: '55px', textAlign: 'center' }}>Qty</td>
            <td style={{ padding: '6px 8px', borderRight: '1px solid #000000', width: '85px', textAlign: 'right' }}>Rate</td>
            <td style={{ padding: '6px 6px', borderRight: '1px solid #000000', width: '48px', textAlign: 'center' }}>CGST</td>
            <td style={{ padding: '6px 6px', borderRight: '1px solid #000000', width: '48px', textAlign: 'center' }}>SGST</td>
            <td style={{ padding: '6px 8px', width: '90px', textAlign: 'right' }}>Amount</td>
          </tr>

          {/* ROW 6: LINE ITEMS DATA ROWS */}
          {items.map((it, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #000000', verticalAlign: 'top', fontSize: '11px' }}>
              <td style={{ padding: '10px 4px', borderRight: '1px solid #000000', textAlign: 'center' }}>
                {idx + 1}
              </td>
              <td style={{ padding: '10px 8px', borderRight: '1px solid #000000' }}>
                <div style={{ fontWeight: 'bold', color: '#0F172A', fontSize: '11.5px' }}>
                  {it.name}
                </div>
                <div style={{ fontSize: '10px', color: '#334155', marginTop: '4px', whiteSpace: 'pre-line', lineHeight: '1.4' }}>
                  {it.description}
                </div>
              </td>
              <td style={{ padding: '10px 6px', borderRight: '1px solid #000000', textAlign: 'center', fontFamily: 'monospace' }}>
                {it.hsn}
              </td>
              <td style={{ padding: '10px 6px', borderRight: '1px solid #000000', textAlign: 'center' }}>
                <strong>{it.qty}</strong><br />{it.unit || "no's"}
              </td>
              <td style={{ padding: '10px 8px', borderRight: '1px solid #000000', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {Number(it.rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={{ padding: '10px 6px', borderRight: '1px solid #000000', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {it.cgstPct || '2.5%'}
              </td>
              <td style={{ padding: '10px 6px', borderRight: '1px solid #000000', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {it.sgstPct || '2.5%'}
              </td>
              <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                {Number(it.amount || (it.qty * it.rate)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          ))}

          {/* ROW 7: TOTALS SUMMARY & BANK DETAILS (BOTTOM OF PAGE 1) */}
          <tr style={{ verticalAlign: 'top' }}>
            {/* Left: Total in Words & Account Details */}
            <td colSpan={4} style={{ borderRight: '1px solid #000000', padding: '12px 14px', fontSize: '11px', lineHeight: '1.45' }}>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#0F172A', textDecoration: 'underline' }}>
                  Total In Words
                </div>
                <div style={{ fontSize: '11.5px', fontWeight: 'bold', color: '#002B49', marginTop: '3px', fontStyle: 'italic' }}>
                  {numberToWordsINR(grandTotal)}
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 'bold', color: '#0F172A', fontSize: '11px' }}>Account Details:</div>
                <div>Beneficiary: <strong>{inv.bankDetails?.beneficiary || 'VRM Structures India Private Limited'}</strong></div>
                <div>A/c No: <strong>{inv.bankDetails?.accountNo || '50200031629272'}</strong></div>
                <div>Bank: <strong>{inv.bankDetails?.bankName || 'HDFC Bank'}</strong></div>
              </div>
            </td>

            {/* Right: SubTotal, Tax Grouping & Final Total */}
            <td colSpan={4} style={{ padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '5px 12px', textAlign: 'right', color: '#475569' }}>Sub Total</td>
                    <td style={{ padding: '5px 12px', textAlign: 'right', fontWeight: 'bold', width: '110px' }}>
                      {subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '5px 12px', textAlign: 'right', color: '#475569' }}>Total Taxable Amount</td>
                    <td style={{ padding: '5px 12px', textAlign: 'right', fontWeight: 'bold' }}>
                      {subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Dynamic Tax Lines matching PDF */}
                  {Object.entries(taxGroups).map(([taxLabel, taxAmt]) => (
                    <tr key={taxLabel} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '4px 12px', textAlign: 'right', color: '#334155' }}>{taxLabel}</td>
                      <td style={{ padding: '4px 12px', textAlign: 'right' }}>
                        {Number(taxAmt).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}

                  {/* Rounding Adjustment line */}
                  <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '4px 12px', textAlign: 'right', color: '#475569' }}>Rounding</td>
                    <td style={{ padding: '4px 12px', textAlign: 'right', color: rounding < 0 ? '#DC2626' : '#0F172A' }}>
                      {rounding > 0 ? `+${rounding.toFixed(2)}` : rounding.toFixed(2)}
                    </td>
                  </tr>

                  {/* Grand Total */}
                  <tr style={{ borderTop: '1px solid #000000', fontWeight: 'bold', fontSize: '13px', backgroundColor: '#F8FAFC' }}>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: '#0F172A' }}>Total</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: '#002B49' }}>
                      ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ========================================================= */}
      {/* PAGE 2: BANK BRANCH, PAYMENT, TERMS, SIGNATORY & E-INVOICE*/}
      {/* ========================================================= */}
      <div className="page-break" style={{ height: '24px' }} />

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000000', marginTop: '20px' }}>
        <tbody>
          {/* TOP ROW: BRANCH/IFSC (LEFT) | PAYMENT MADE & BALANCE DUE (RIGHT) */}
          <tr style={{ borderBottom: '1px solid #000000', verticalAlign: 'top', fontSize: '11px' }}>
            <td style={{ width: '55%', padding: '10px 14px', borderRight: '1px solid #000000', lineHeight: '1.4' }}>
              <div>Branch: <strong>{inv.bankDetails?.branch || 'Kodambakkam'}</strong></div>
              <div>IFSC: <strong>{inv.bankDetails?.ifsc || 'HDFC0000574'}</strong></div>
            </td>
            <td style={{ width: '45%', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: '#475569' }}>Payment Made</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 'bold', color: '#DC2626' }}>
                      (-) {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr style={{ fontWeight: 'bold' }}>
                    <td style={{ padding: '6px 12px', textAlign: 'right' }}>Balance Due</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                      ₹0.00
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* MIDDLE ROW: TERMS & CONDITIONS (LEFT) | AUTHORIZED SIGNATORY (RIGHT) */}
          <tr style={{ borderBottom: '1px solid #000000', verticalAlign: 'top' }}>
            <td style={{ width: '55%', padding: '12px 14px', borderRight: '1px solid #000000', fontSize: '10.5px', lineHeight: '1.5' }}>
              <div style={{ fontWeight: 'bold', color: '#0F172A', marginBottom: '4px' }}>Terms & Conditions</div>
              <ol style={{ margin: 0, paddingLeft: '16px', color: '#334155' }}>
                <li>TAX: Included</li>
                <li>Transport: At actuals</li>
                <li>Payment: 100% along with the Purchase Order</li>
                <li>Delivery: Immediate Dispatch</li>
                <li>Validity: 3 days</li>
                {(inv.processedWithoutAddressProof || inv.addressProofWaived || String(inv.terms || '').includes('without the Address Proof') || String(inv.notes || '').includes('without the Address Proof') || String(inv.disclaimerTerm || '').includes('without the Address Proof')) && (
                  <li style={{ color: '#000000', fontWeight: 'bold', marginTop: '2px' }}>
                    The Invoice is processed without the Address Proof so if any problem happens means VRM Structures India Private Limited will not take any responsibility.
                  </li>
                )}
              </ol>
            </td>
            <td style={{ width: '45%', padding: '14px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '140px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 'bold', color: '#0F172A' }}>
                VRM Structures India Pvt Ltd
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '6px 0' }}>
                <img
                  src={stampSrc}
                  alt="Official VRM Stamp & Signature"
                  style={{ maxHeight: '85px', maxWidth: '200px', objectFit: 'contain' }}
                  onError={(e) => {
                    if (e.currentTarget.src !== VRM_OFFICIAL_STAMP) {
                      e.currentTarget.src = VRM_OFFICIAL_STAMP;
                    }
                  }}
                />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                Authorized Signatory
              </div>
            </td>
          </tr>

          {/* BOTTOM ROW: GOVERNMENT E-INVOICING SECTION */}
          <tr>
            <td colSpan={2} style={{ padding: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    {/* QR Code */}
                    <td style={{ width: '130px', verticalAlign: 'top' }}>
                      <div style={{ border: '1px solid #CBD5E1', padding: '6px', backgroundColor: '#FFFFFF', display: 'inline-block' }}>
                        <GovernmentInvoiceQRCode size={110} />
                      </div>
                    </td>

                    {/* e-Invoice Credentials */}
                    <td style={{ paddingLeft: '18px', verticalAlign: 'top', fontSize: '11px', lineHeight: '1.6' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ fontWeight: 'bold', width: '80px', color: '#1E3A8A' }}>IRN :</td>
                            <td style={{ fontWeight: 'bold', wordBreak: 'break-all', fontFamily: 'monospace', color: '#0F172A' }}>
                              {inv.irn || '4b92904b4d6411f74bba72614aa9c1701423c1b80cfb8c712ed565bc2789db83'}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: 'bold', color: '#1E3A8A' }}>Ack No. :</td>
                            <td style={{ fontWeight: 'bold', fontFamily: 'monospace', color: '#0F172A' }}>
                              {inv.ackNo || '152626823842153'}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: 'bold', color: '#1E3A8A' }}>Ack Date :</td>
                            <td style={{ color: '#334155' }}>
                              {inv.ackDate || '2026-08-17 15:19:00'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <div style={{ marginTop: '12px', fontSize: '10.5px', color: '#64748B', fontStyle: 'italic' }}>
                        e-Invoicing detail(s) generated from the Government's e-Invoicing system.
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * VRMTaxInvoicePrintTemplate
 * Floating Print Preview Modal for Tax Invoices.
 */
export default function VRMTaxInvoicePrintTemplate({ invoiceData, onClose }) {
  if (!invoiceData) return null;

  const invNo = invoiceData.invNo || invoiceData.invoiceNo || invoiceData.code || 'VRMS/26-27/2309';

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
      {/* Top Floating Action Bar */}
      <div
        className="no-print"
        style={{
          width: '100%',
          maxWidth: '850px',
          backgroundColor: '#0F172A',
          borderRadius: '12px 12px 0 0',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#FFFFFF',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{ fontWeight: '800', fontSize: '14.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Tax Invoice</span>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8' }}>({invNo})</span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => window.print()}
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
              boxShadow: '0 2px 6px rgba(14, 116, 144, 0.4)'
            }}
          >
            <Printer size={15} /> Print / Save PDF
          </button>
          <button
            onClick={onClose}
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

      {/* Main Printable Document Canvas */}
      <div
        style={{
          width: '100%',
          maxWidth: '850px',
          backgroundColor: '#FFFFFF',
          borderRadius: '0 0 12px 12px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
          overflow: 'hidden'
        }}
      >
        <VRMTaxInvoicePrintSheet invoiceData={invoiceData} id="printable-tax-invoice" />
      </div>
    </div>
  );
}
