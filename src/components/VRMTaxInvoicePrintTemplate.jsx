import React, { useState, useEffect } from 'react';
import { Printer, Mail, FileText, X } from 'lucide-react';
import { getCachedBranding, fetchMasterBranding, subscribeBrandingUpdates } from '../services/brandingService';
import { VRM_OFFICIAL_LOGO, VRM_OFFICIAL_STAMP } from '../utils/vrmOfficialAssets';
import { isTamilNaduIntra } from '../utils/gstHelper';

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

// Format date into DD-MM-YYYY format matching official reference
function formatInvoiceDate(dateStr) {
  if (!dateStr) return '17-08-2026';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    }
  } catch (_) {}
  return String(dateStr);
}

// SVG Component representing the official Government e-Invoice QR Code
function EInvoiceQRCode({ size = 100 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 105 105" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      <rect width="105" height="105" fill="white" />
      {/* Top Left Corner Finder */}
      <rect x="5" y="5" width="28" height="28" stroke="#000" strokeWidth="4" fill="white" />
      <rect x="11" y="11" width="16" height="16" fill="#000" />
      {/* Top Right Corner Finder */}
      <rect x="72" y="5" width="28" height="28" stroke="#000" strokeWidth="4" fill="white" />
      <rect x="78" y="11" width="16" height="16" fill="#000" />
      {/* Bottom Left Corner Finder */}
      <rect x="5" y="72" width="28" height="28" stroke="#000" strokeWidth="4" fill="white" />
      <rect x="11" y="78" width="16" height="16" fill="#000" />
      {/* Internal dense matrix data modules */}
      <rect x="37" y="8" width="4" height="4" fill="#000" />
      <rect x="45" y="8" width="8" height="4" fill="#000" />
      <rect x="57" y="8" width="4" height="4" fill="#000" />
      <rect x="37" y="16" width="8" height="4" fill="#000" />
      <rect x="49" y="16" width="4" height="4" fill="#000" />
      <rect x="57" y="16" width="8" height="4" fill="#000" />
      <rect x="37" y="24" width="4" height="8" fill="#000" />
      <rect x="45" y="24" width="8" height="4" fill="#000" />
      <rect x="57" y="24" width="4" height="8" fill="#000" />
      <rect x="8" y="37" width="4" height="4" fill="#000" />
      <rect x="16" y="37" width="8" height="4" fill="#000" />
      <rect x="28" y="37" width="4" height="4" fill="#000" />
      <rect x="37" y="37" width="8" height="8" fill="#000" />
      <rect x="49" y="37" width="4" height="4" fill="#000" />
      <rect x="57" y="37" width="12" height="4" fill="#000" />
      <rect x="73" y="37" width="4" height="8" fill="#000" />
      <rect x="81" y="37" width="8" height="4" fill="#000" />
      <rect x="93" y="37" width="4" height="4" fill="#000" />
      <rect x="8" y="45" width="8" height="4" fill="#000" />
      <rect x="20" y="45" width="4" height="8" fill="#000" />
      <rect x="28" y="45" width="4" height="4" fill="#000" />
      <rect x="45" y="45" width="8" height="8" fill="#000" />
      <rect x="57" y="45" width="4" height="4" fill="#000" />
      <rect x="65" y="45" width="8" height="4" fill="#000" />
      <rect x="81" y="45" width="4" height="8" fill="#000" />
      <rect x="89" y="45" width="8" height="4" fill="#000" />
      <rect x="8" y="57" width="4" height="4" fill="#000" />
      <rect x="16" y="57" width="8" height="4" fill="#000" />
      <rect x="28" y="57" width="4" height="8" fill="#000" />
      <rect x="37" y="57" width="4" height="4" fill="#000" />
      <rect x="45" y="57" width="4" height="8" fill="#000" />
      <rect x="53" y="57" width="8" height="4" fill="#000" />
      <rect x="65" y="57" width="4" height="8" fill="#000" />
      <rect x="73" y="57" width="8" height="4" fill="#000" />
      <rect x="85" y="57" width="12" height="4" fill="#000" />
      <rect x="37" y="69" width="8" height="4" fill="#000" />
      <rect x="49" y="69" width="4" height="8" fill="#000" />
      <rect x="57" y="69" width="8" height="4" fill="#000" />
      <rect x="69" y="69" width="4" height="4" fill="#000" />
      <rect x="77" y="69" width="8" height="8" fill="#000" />
      <rect x="89" y="69" width="4" height="4" fill="#000" />
      <rect x="97" y="69" width="4" height="8" fill="#000" />
      <rect x="37" y="77" width="4" height="8" fill="#000" />
      <rect x="45" y="77" width="8" height="4" fill="#000" />
      <rect x="57" y="77" width="4" height="4" fill="#000" />
      <rect x="65" y="77" width="8" height="8" fill="#000" />
      <rect x="89" y="77" width="4" height="8" fill="#000" />
      <rect x="37" y="89" width="8" height="4" fill="#000" />
      <rect x="49" y="89" width="4" height="4" fill="#000" />
      <rect x="57" y="89" width="8" height="8" fill="#000" />
      <rect x="69" y="89" width="4" height="4" fill="#000" />
      <rect x="77" y="89" width="12" height="4" fill="#000" />
      <rect x="93" y="89" width="4" height="4" fill="#000" />
      <rect x="41" y="97" width="4" height="4" fill="#000" />
      <rect x="49" y="97" width="8" height="4" fill="#000" />
      <rect x="69" y="97" width="8" height="4" fill="#000" />
      <rect x="81" y="97" width="4" height="4" fill="#000" />
      <rect x="89" y="97" width="8" height="4" fill="#000" />
    </svg>
  );
}

// Default benchmark invoice dataset matching the official Tax Invoice format
export const DEFAULT_OFFICIAL_TAX_INVOICE_DATA = {
  invNo: 'VRMS/26-27/2309',
  date: '2026-08-17',
  dueDate: '2026-08-17',
  terms: 'Due on Receipt',
  ewayBill: '542055911945',
  placeOfSupply: 'Tamil Nadu (33)',
  salesPerson: 'Mohith',
  vendor: 'VASAN ENTERPRISES',
  customerName: 'VASAN ENTERPRISES',
  billingAddress: 'Old No 39B, New No 75, KG Towers, Jawahar Bazaar,\nCoimbatore Road, canara Bank upstairs,\nKarur 639001\nTamil Nadu\nIndia',
  gstNo: '33CIQPB3415A1ZX',
  shippingName: 'Ramesh Sivagnanam',
  shippingPhone: '( 9313 6577 5076 )',
  deliveryAddress: '2/587, THESOOR ROAD,\nPonnur, ,\nTiruvannamalai 604408\nTamil Nadu\nIndia\n+91-9659440090',
  bankDetails: {
    beneficiary: 'VRM Structures India Private Limited',
    accountNo: '50200031629272',
    bankName: 'HDFC Bank',
    branch: 'Kodambakkam',
    ifsc: 'HDFC0000574'
  },
  termsConditions: [
    '1. TAX: Included',
    '2. Transport: At actuals',
    '3. Payment: 100% along with the Purchase Order',
    '4. Delivery: Immediate Dispatch',
    '5. Validity: 3 days'
  ],
  irn: '4b92904b4d6411f74bba72614aa9c1701423c1b80cfb8c712ed565bc2789db83',
  ackNo: '152626823842153',
  ackDate: '2026-08-17 15:19:00',
  items: [
    {
      sNo: 1,
      name: 'Strut Rail - KW',
      description: 'Supply of 40*40*2mm Strut Channel\n\nAluminum MMS - Struct Rail bit 40 mm\nHeight, 3550 mm length - 4 no\'s\nEnd Clamps - Z Clamp 30 mm - 4 no\'s\nMid Clamps - U Clamp 30 mm - 10 no\'s\nSpring Nut - GI / Zinc Coated - 14 no\'s\nSS304 - Allen Bolt M8*30 - with spring\nwasher - 16 no\'s\nEPDM Sheet - 40*40*2mm - 16 no\'s\nSelf tapping screws - M6, 65 mm length\n- GI - 16 no\'s',
      hsn: '76109010',
      qty: 3.30,
      unit: 'kW',
      rate: 2100.00,
      gstRate: 18,
      amount: 6930.00
    },
    {
      sNo: 2,
      name: 'Module',
      description: 'Solar panel\nBRAND: Vikram (DCR)\nWP: 550Wp\n53629695\n53629689\n53629548\n53629694\n53629552\n53629693',
      hsn: '85414011',
      qty: 6.00,
      unit: "no's",
      rate: 13420.00,
      gstRate: 5,
      amount: 80520.00
    },
    {
      sNo: 3,
      name: 'Earthing Kit',
      description: 'Earthing Kit\nEarth rod - 3\nChemical Bag -3\nEarth pit chamber -3\nLighting Arrestor - 1',
      hsn: '85359090',
      qty: 1.00,
      unit: 'Set',
      rate: 3150.00,
      gstRate: 18,
      amount: 3150.00
    },
    {
      sNo: 4,
      name: 'Inverter',
      description: 'Solar On-Grid Inverter\nBRAND: Deye\nKW: 3Kw\nPH: 1 Phase\n2601319063',
      hsn: '85044090',
      qty: 1.00,
      unit: "no's",
      rate: 15600.00,
      gstRate: 5,
      amount: 15600.00
    }
  ]
};

/**
 * VRMTaxInvoicePrintSheet
 * Official Tax Invoice printable sheet matching the user's reference PDF layout.
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
  const rawItems = Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : DEFAULT_OFFICIAL_TAX_INVOICE_DATA.items;

  // Inter-state vs Intra-state GST detection
  const customerGst = typeof inv.gstNo === 'string' ? inv.gstNo.trim().toUpperCase() : '';
  const customerState = typeof inv.deliveryAddress === 'object' ? (inv.deliveryAddress?.state || '') : (inv.deliveryState || inv.billingState || '');
  const isIntra = isTamilNaduIntra(customerGst, customerState);

  // Normalize items & calculate taxes
  const items = rawItems.map((it, idx) => {
    const qty = Number(it.qty || it.quantity || 1);
    const rate = Number(it.rate || it.unitPrice || 0);
    const amount = Number(it.amount || it.taxable || (qty * rate) || 0);
    const rawRateStr = String(it.gstRate || it.tax || it.gRate || '18').replace('%', '');
    const gRate = parseFloat(rawRateStr) || 18;
    const cgstPct = isIntra ? gRate / 2 : 0;
    const sgstPct = isIntra ? gRate / 2 : 0;
    const cgstAmt = isIntra ? amount * (cgstPct / 100) : 0;
    const sgstAmt = isIntra ? amount * (sgstPct / 100) : 0;
    const igstAmt = !isIntra ? amount * (gRate / 100) : 0;

    return {
      sNo: idx + 1,
      name: it.name || it.item || it.productName || `Item ${idx + 1}`,
      description: it.description || it.specifications || '',
      hsn: it.hsn || it.hsnCode || '76109010',
      qty,
      unit: it.unit || it.uom || "no's",
      rate,
      gRate,
      cgstPct,
      sgstPct,
      cgstAmt,
      sgstAmt,
      igstAmt,
      amount
    };
  });

  const subTotal = items.reduce((sum, it) => sum + it.amount, 0);

  // Group GST by rate tier (e.g. 9% / 2.5%)
  const gstTiersMap = {};
  items.forEach(it => {
    const key = it.gRate;
    if (!gstTiersMap[key]) {
      gstTiersMap[key] = {
        rate: it.gRate,
        halfRate: it.gRate / 2,
        taxable: 0,
        cgstAmt: 0,
        sgstAmt: 0,
        igstAmt: 0
      };
    }
    gstTiersMap[key].taxable += it.amount;
    gstTiersMap[key].cgstAmt += it.cgstAmt;
    gstTiersMap[key].sgstAmt += it.sgstAmt;
    gstTiersMap[key].igstAmt += it.igstAmt;
  });

  const gstTiers = Object.values(gstTiersMap).sort((a, b) => b.rate - a.rate);
  const totalGst = items.reduce((sum, it) => sum + (isIntra ? (it.cgstAmt + it.sgstAmt) : it.igstAmt), 0);
  const exactGrandTotal = subTotal + totalGst;
  const grandTotal = Math.round(exactGrandTotal);
  const rounding = Number((grandTotal - exactGrandTotal).toFixed(2));

  // Address parsing helper
  const parseAddrText = (addr) => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object') {
      const parts = [
        addr.street || addr.addressLine1 || addr.address,
        addr.area || addr.landmark,
        addr.city,
        addr.state ? `${addr.state}${addr.pincode ? ' ' + addr.pincode : ''}` : (addr.pincode || '')
      ].filter(Boolean);
      return parts.join('\n');
    }
    return String(addr);
  };

  const customerName = inv.customerName || inv.vendor || inv.c2 || 'VASAN ENTERPRISES';
  const billingAddrText = parseAddrText(inv.billingAddress) || DEFAULT_OFFICIAL_TAX_INVOICE_DATA.billingAddress;
  const shippingName = inv.shippingName || inv.contactPerson || 'Ramesh Sivagnanam';
  const shippingPhone = inv.shippingPhone || inv.phone || '( 9313 6577 5076 )';
  const deliveryAddrText = parseAddrText(inv.deliveryAddress) || DEFAULT_OFFICIAL_TAX_INVOICE_DATA.deliveryAddress;

  const invNoDisplay = inv.invNo || inv.invoiceNo || inv.code || 'VRMS/26-27/2309';
  const invDateDisplay = formatInvoiceDate(inv.date || inv.invoiceDate || inv.createdAt);
  const termsDisplay = inv.terms || 'Due on Receipt';
  const ewayBillDisplay = inv.ewayBill || inv.ewayBillNo || '542055911945';
  const placeOfSupplyDisplay = inv.placeOfSupply || 'Tamil Nadu (33)';
  const salesPersonDisplay = inv.salesPerson || inv.salesperson || 'Mohith';

  const logoSrc = branding.logoUrl || VRM_OFFICIAL_LOGO;
  const stampSrc = branding.customStampUrl || VRM_OFFICIAL_STAMP || '/vrm_stamp.png';

  const bank = inv.bankDetails || DEFAULT_OFFICIAL_TAX_INVOICE_DATA.bankDetails;
  const termsList = Array.isArray(inv.termsConditions) ? inv.termsConditions : DEFAULT_OFFICIAL_TAX_INVOICE_DATA.termsConditions;

  const irnDisplay = inv.irn || DEFAULT_OFFICIAL_TAX_INVOICE_DATA.irn;
  const ackNoDisplay = inv.ackNo || DEFAULT_OFFICIAL_TAX_INVOICE_DATA.ackNo;
  const ackDateDisplay = inv.ackDate || DEFAULT_OFFICIAL_TAX_INVOICE_DATA.ackDate;

  return (
    <div
      id={id}
      style={{
        width: '100%',
        maxWidth: '850px',
        backgroundColor: '#FFFFFF',
        color: '#0F172A',
        fontFamily: "'Segoe UI', Roboto, -apple-system, BlinkMacSystemFont, Arial, sans-serif",
        fontSize: '11px',
        lineHeight: '1.4',
        boxSizing: 'border-box',
        margin: '0 auto',
        padding: '24px 28px',
        position: 'relative'
      }}
    >
      <style>
        {`
          @page {
            size: A4 portrait;
            margin: 10mm 10mm !important;
          }

          @media print {
            body * {
              visibility: hidden !important;
            }
            .no-print {
              display: none !important;
            }
            #${id},
            #${id} * {
              visibility: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #${id} {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              box-shadow: none !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              background: #ffffff !important;
            }
            .tax-invoice-page {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .tax-invoice-page-2 {
              page-break-before: always !important;
              break-before: page !important;
              margin-top: 15mm !important;
            }
          }
        `}
      </style>

      {/* ═══════════════════════════════════════════════════════════════
          PAGE 1: HEADER, METADATA, BILL/SHIP TO, ITEMS TABLE & SUMMARY
          ═══════════════════════════════════════════════════════════════ */}
      <div
        className="tax-invoice-page tax-invoice-page-1"
        style={{
          border: '1.5px solid #334155',
          borderRadius: '0px',
          overflow: 'hidden',
          backgroundColor: '#FFFFFF'
        }}
      >
        {/* 1. TOP HEADER SECTION */}
        <div style={{ padding: '14px 18px', borderBottom: '1.5px solid #334155', backgroundColor: '#FFFFFF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
            {/* LEFT: COMPANY LOGO & INFO */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: '1 1 auto' }}>
              <img
                src={logoSrc}
                alt="VRM Structures"
                style={{
                  height: '48px',
                  width: 'auto',
                  maxWidth: '190px',
                  objectFit: 'contain'
                }}
                onError={(e) => { e.currentTarget.src = VRM_OFFICIAL_LOGO; }}
              />
              <div>
                <div style={{ fontSize: '14.5px', fontWeight: '800', color: '#1E3A8A', letterSpacing: '-0.2px', marginBottom: '2px' }}>
                  VRM Structures India Pvt Ltd.
                </div>
                <div style={{ fontSize: '10px', color: '#1E293B', lineHeight: '1.38' }}>
                  <div>1427, GNT Road, Nagappa Industrial Estate,</div>
                  <div>Puzhal,</div>
                  <div>Chennai, Tamil Nadu 600066</div>
                  <div>India</div>
                  <div style={{ marginTop: '2px' }}>
                    <strong>GSTIN </strong>33AAGCV4262N1ZZ
                  </div>
                  <div>9884720789</div>
                </div>
              </div>
            </div>

            {/* RIGHT: TAX INVOICE TITLE */}
            <div style={{ textAlign: 'right', flex: '0 0 auto', paddingTop: '4px' }}>
              <div style={{
                fontSize: '25px',
                fontWeight: '700',
                color: '#1E3A8A',
                letterSpacing: '0.5px'
              }}>
                TAX INVOICE
              </div>
            </div>
          </div>
        </div>

        {/* 2. INVOICE METADATA ROW */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          borderBottom: '1.5px solid #334155',
          backgroundColor: '#FFFFFF',
          fontSize: '11px'
        }}>
          {/* LEFT: Invoice No, Date, Terms, E-Way Bill */}
          <div style={{ padding: '8px 16px', borderRight: '1.5px solid #334155' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '85px 10px auto', rowGap: '3px', alignItems: 'center' }}>
              <div style={{ color: '#0F172A' }}>Invoice No.</div>
              <div>:</div>
              <div style={{ fontWeight: '700', color: '#0F172A' }}>{invNoDisplay}</div>

              <div style={{ color: '#0F172A' }}>Invoice Date</div>
              <div>:</div>
              <div style={{ fontWeight: '700', color: '#0F172A' }}>{invDateDisplay}</div>

              <div style={{ color: '#0F172A' }}>Terms</div>
              <div>:</div>
              <div style={{ fontWeight: '700', color: '#0F172A' }}>{termsDisplay}</div>

              <div style={{ color: '#0F172A' }}>E-Way Bill#</div>
              <div>:</div>
              <div style={{ fontWeight: '700', color: '#0F172A' }}>{ewayBillDisplay}</div>
            </div>
          </div>

          {/* RIGHT: Place of Supply, Sales Person */}
          <div style={{ padding: '8px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 10px auto', rowGap: '3px', alignItems: 'center' }}>
              <div style={{ color: '#0F172A' }}>Place Of Supply</div>
              <div>:</div>
              <div style={{ fontWeight: '700', color: '#0F172A' }}>{placeOfSupplyDisplay}</div>

              <div style={{ color: '#0F172A' }}>Sales person</div>
              <div>:</div>
              <div style={{ fontWeight: '700', color: '#0F172A' }}>{salesPersonDisplay}</div>
            </div>
          </div>
        </div>

        {/* 3. BILL TO & SHIP TO SECTION */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          borderBottom: '1.5px solid #334155',
          backgroundColor: '#FFFFFF',
          fontSize: '11px'
        }}>
          {/* BILL TO */}
          <div style={{ borderRight: '1.5px solid #334155' }}>
            <div style={{ padding: '4px 14px', borderBottom: '1px solid #CBD5E1', fontWeight: '700', color: '#0F172A', backgroundColor: '#F8FAFC' }}>
              Bill To
            </div>
            <div style={{ padding: '8px 14px', lineHeight: '1.45', color: '#1E293B', fontSize: '10.5px' }}>
              <div style={{ fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', marginBottom: '2px' }}>
                {customerName}
              </div>
              <div style={{ whiteSpace: 'pre-line' }}>
                {billingAddrText}
              </div>
              {inv.gstNo && (
                <div style={{ marginTop: '2px', fontWeight: '700', color: '#0F172A' }}>
                  {inv.gstNo}
                </div>
              )}
            </div>
          </div>

          {/* SHIP TO */}
          <div>
            <div style={{ padding: '4px 14px', borderBottom: '1px solid #CBD5E1', fontWeight: '700', color: '#0F172A', backgroundColor: '#F8FAFC' }}>
              Ship To
            </div>
            <div style={{ padding: '8px 14px', lineHeight: '1.45', color: '#1E293B', fontSize: '10.5px' }}>
              <div style={{ fontWeight: '700', color: '#0F172A', marginBottom: '1px' }}>
                {shippingName}
              </div>
              {shippingPhone && (
                <div style={{ color: '#0F172A' }}>
                  {shippingPhone}
                </div>
              )}
              <div style={{ whiteSpace: 'pre-line' }}>
                {deliveryAddrText}
              </div>
            </div>
          </div>
        </div>

        {/* 4. LINE ITEMS TABLE */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
            <thead>
              <tr style={{ backgroundColor: '#FFFFFF', color: '#0F172A', fontWeight: '700', textAlign: 'center' }}>
                <th style={{ border: '1px solid #CBD5E1', padding: '6px 4px', width: '32px' }}>
                  S.<br />no
                </th>
                <th style={{ border: '1px solid #CBD5E1', padding: '6px 8px', textAlign: 'left', width: '34%' }}>
                  Item &amp; Description
                </th>
                <th style={{ border: '1px solid #CBD5E1', padding: '6px 4px', width: '75px' }}>
                  HSN
                </th>
                <th style={{ border: '1px solid #CBD5E1', padding: '6px 4px', width: '55px' }}>
                  Qty
                </th>
                <th style={{ border: '1px solid #CBD5E1', padding: '6px 8px', width: '75px', textAlign: 'right' }}>
                  Rate
                </th>
                {isIntra ? (
                  <>
                    <th style={{ border: '1px solid #CBD5E1', padding: '6px 6px', width: '55px' }}>
                      CGST
                    </th>
                    <th style={{ border: '1px solid #CBD5E1', padding: '6px 6px', width: '55px' }}>
                      SGST
                    </th>
                  </>
                ) : (
                  <th style={{ border: '1px solid #CBD5E1', padding: '6px 6px', width: '75px' }}>
                    IGST
                  </th>
                )}
                <th style={{ border: '1px solid #CBD5E1', padding: '6px 8px', width: '85px', textAlign: 'right' }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} style={{ verticalAlign: 'top' }}>
                  <td style={{ border: '1px solid #CBD5E1', padding: '8px 4px', textAlign: 'center', color: '#334155' }}>
                    {it.sNo}
                  </td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '8px 8px' }}>
                    <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '11px' }}>
                      {it.name}
                    </div>
                    {it.description && (
                      <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px', whiteSpace: 'pre-line', lineHeight: '1.35' }}>
                        {it.description}
                      </div>
                    )}
                  </td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '8px 4px', textAlign: 'center', fontFamily: 'monospace', fontSize: '10px' }}>
                    {it.hsn || '—'}
                  </td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '8px 4px', textAlign: 'center', fontSize: '10px' }}>
                    <div>{typeof it.qty === 'number' ? it.qty.toFixed(2) : it.qty}</div>
                    <div style={{ fontSize: '9px', color: '#64748B' }}>{it.unit || "no's"}</div>
                  </td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '8px 8px', textAlign: 'right', fontSize: '10.5px' }}>
                    {Number(it.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  {isIntra ? (
                    <>
                      <td style={{ border: '1px solid #CBD5E1', padding: '8px 4px', textAlign: 'center', fontSize: '10px' }}>
                        {it.cgstPct ? `${it.cgstPct.toFixed(1).replace(/\.0$/, '')}%` : '—'}
                      </td>
                      <td style={{ border: '1px solid #CBD5E1', padding: '8px 4px', textAlign: 'center', fontSize: '10px' }}>
                        {it.sgstPct ? `${it.sgstPct.toFixed(1).replace(/\.0$/, '')}%` : '—'}
                      </td>
                    </>
                  ) : (
                    <td style={{ border: '1px solid #CBD5E1', padding: '8px 4px', textAlign: 'center', fontSize: '10px' }}>
                      {it.gRate ? `${it.gRate}%` : '—'}
                    </td>
                  )}
                  <td style={{ border: '1px solid #CBD5E1', padding: '8px 8px', textAlign: 'right', fontWeight: '600', color: '#0F172A', fontSize: '10.5px' }}>
                    {Number(it.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 5. PAGE 1 BOTTOM SUMMARY SECTION */}
        <div style={{ display: 'grid', gridTemplateColumns: '58% 42%', borderTop: '1.5px solid #334155', backgroundColor: '#FFFFFF' }}>
          {/* LEFT: TOTAL IN WORDS & BANK DETAILS */}
          <div style={{ borderRight: '1.5px solid #334155' }}>
            {/* Total In Words */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #CBD5E1' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#0F172A', marginBottom: '2px' }}>
                Total In Words
              </div>
              <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#0F172A', lineHeight: '1.3' }}>
                {numberToWordsINR(grandTotal)}
              </div>
            </div>

            {/* Account Details */}
            <div style={{ padding: '8px 12px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#0F172A', marginBottom: '2px' }}>
                Account Details:
              </div>
              <div style={{ fontSize: '10px', color: '#1E293B', lineHeight: '1.4' }}>
                <div>Beneficiary: {bank.beneficiary || 'VRM Structures India Private Limited'}</div>
                <div>A/c No: <strong style={{ fontFamily: 'monospace' }}>{bank.accountNo || '50200031629272'}</strong></div>
                <div>Bank: {bank.bankName || 'HDFC Bank'}</div>
              </div>
            </div>
          </div>

          {/* RIGHT: TOTALS BREAKDOWN */}
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '4px 12px', color: '#1E293B' }}>Sub Total</td>
                  <td style={{ padding: '4px 12px', textAlign: 'right', fontWeight: '600', color: '#0F172A' }}>
                    {subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 12px', color: '#1E293B' }}>Total Taxable Amount</td>
                  <td style={{ padding: '4px 12px', textAlign: 'right', fontWeight: '600', color: '#0F172A' }}>
                    {subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                {isIntra ? (
                  gstTiers.map(tier => (
                    <React.Fragment key={tier.rate}>
                      <tr>
                        <td style={{ padding: '3px 12px', color: '#1E293B' }}>
                          CGST{tier.halfRate.toFixed(1).replace(/\.0$/, '')} ({tier.halfRate.toFixed(1).replace(/\.0$/, '')}%)
                        </td>
                        <td style={{ padding: '3px 12px', textAlign: 'right', color: '#0F172A' }}>
                          {tier.cgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '3px 12px', color: '#1E293B' }}>
                          SGST{tier.halfRate.toFixed(1).replace(/\.0$/, '')} ({tier.halfRate.toFixed(1).replace(/\.0$/, '')}%)
                        </td>
                        <td style={{ padding: '3px 12px', textAlign: 'right', color: '#0F172A' }}>
                          {tier.sgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))
                ) : (
                  gstTiers.map(tier => (
                    <tr key={tier.rate}>
                      <td style={{ padding: '4px 12px', color: '#1E293B' }}>
                        IGST{tier.rate} ({tier.rate}%)
                      </td>
                      <td style={{ padding: '4px 12px', textAlign: 'right', color: '#0F172A' }}>
                        {tier.igstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
                {rounding !== 0 && (
                  <tr>
                    <td style={{ padding: '3px 12px', color: '#1E293B' }}>Rounding</td>
                    <td style={{ padding: '3px 12px', textAlign: 'right', color: '#0F172A' }}>
                      {rounding > 0 ? `+${rounding.toFixed(2)}` : rounding.toFixed(2)}
                    </td>
                  </tr>
                )}
                <tr style={{ borderTop: '1px solid #CBD5E1', fontWeight: '800' }}>
                  <td style={{ padding: '6px 12px', color: '#0F172A' }}>Total</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: '#0F172A', fontSize: '11px' }}>
                    ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PAGE BREAK SEPARATOR FOR ON-SCREEN MODAL PREVIEW */}
      <div className="no-print" style={{ margin: '20px 0', textAlign: 'center' }}>
        <div style={{ height: '1px', backgroundColor: '#CBD5E1', margin: '0 auto', width: '80%' }} />
        <span style={{ display: 'inline-block', backgroundColor: '#F1F5F9', color: '#64748B', fontSize: '10.5px', fontWeight: '700', padding: '2px 12px', borderRadius: '12px', transform: 'translateY(-10px)' }}>
          Page 2
        </span>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          PAGE 2: BANK CONTINUATION, TERMS, PAYMENT STATUS, STAMP & IRN
          ═══════════════════════════════════════════════════════════════ */}
      <div
        className="tax-invoice-page tax-invoice-page-2"
        style={{
          border: '1.5px solid #334155',
          borderRadius: '0px',
          overflow: 'hidden',
          backgroundColor: '#FFFFFF'
        }}
      >
        {/* 1. TOP GRID: BANK DETAILS CONTINUATION + TERMS (LEFT) | PAYMENT STATUS + STAMP (RIGHT) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '58% 42%',
          borderBottom: '1.5px solid #334155',
          backgroundColor: '#FFFFFF',
          fontSize: '11px'
        }}>
          {/* LEFT: Branch, IFSC, Terms & Conditions */}
          <div style={{ borderRight: '1.5px solid #334155' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #CBD5E1', fontSize: '10.5px', color: '#1E293B', lineHeight: '1.45' }}>
              <div>Branch: {bank.branch || 'Kodambakkam'}</div>
              <div>IFSC: <strong style={{ fontFamily: 'monospace' }}>{bank.ifsc || 'HDFC0000574'}</strong></div>
            </div>

            <div style={{ padding: '8px 12px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#0F172A', marginBottom: '3px' }}>
                Terms &amp; Conditions
              </div>
              <div style={{ fontSize: '9.5px', color: '#1E293B', lineHeight: '1.45', whiteSpace: 'pre-line' }}>
                {termsList.join('\n')}
              </div>
            </div>
          </div>

          {/* RIGHT: PAYMENT STATUS + STAMP & SIGNATURE */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Payment Made & Balance Due */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', borderBottom: '1px solid #CBD5E1' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '5px 12px', color: '#1E293B' }}>Payment Made</td>
                  <td style={{ padding: '5px 12px', textAlign: 'right', fontWeight: '600', color: '#B91C1C' }}>
                    (-) {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr style={{ fontWeight: '800' }}>
                  <td style={{ padding: '5px 12px', color: '#0F172A' }}>Balance Due</td>
                  <td style={{ padding: '5px 12px', textAlign: 'right', color: '#0F172A', fontSize: '11px' }}>
                    ₹0.00
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Stamp & Authorized Signatory */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              alignItems: 'center',
              padding: '16px 12px 10px 12px',
              minHeight: '150px',
              position: 'relative'
            }}>
              <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#0F172A', marginBottom: '4px', textAlign: 'center' }}>
                VRM Structures India Pvt Ltd
              </div>
              <div style={{
                position: 'relative',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '95px'
              }}>
                {/* Official Stamp */}
                <img
                  src={stampSrc}
                  alt="VRM Structures Official Stamp"
                  style={{
                    height: '115px',
                    width: '115px',
                    objectFit: 'contain'
                  }}
                  onError={(e) => { e.currentTarget.src = VRM_OFFICIAL_STAMP; }}
                />

              </div>
              <div style={{ fontSize: '10px', fontWeight: '600', color: '#1E293B', marginTop: '6px', textAlign: 'center' }}>
                Authorized Signatory
              </div>
            </div>
          </div>
        </div>

        {/* 2. BOTTOM E-INVOICING SECTION */}
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          gap: '20px'
        }}>
          {/* Government e-Invoice QR Code */}
          <div style={{ flex: '0 0 auto' }}>
            <EInvoiceQRCode size={95} />
          </div>

          {/* IRN & Acknowledgement Details */}
          <div style={{ flex: '1 1 auto', fontSize: '10px', color: '#1E293B', lineHeight: '1.45' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '70px 10px auto', rowGap: '3px', alignItems: 'flex-start' }}>
              <div style={{ fontWeight: '700', color: '#0F172A' }}>IRN :</div>
              <div></div>
              <div style={{ fontWeight: '700', wordBreak: 'break-all', fontFamily: 'monospace', color: '#0F172A' }}>
                {irnDisplay}
              </div>

              <div style={{ fontWeight: '700', color: '#0F172A' }}>Ack No. :</div>
              <div></div>
              <div style={{ fontWeight: '700', color: '#0F172A' }}>
                {ackNoDisplay}
              </div>

              <div style={{ fontWeight: '700', color: '#0F172A' }}>Ack Date :</div>
              <div></div>
              <div style={{ fontWeight: '700', color: '#0F172A' }}>
                {ackDateDisplay}
              </div>
            </div>

            <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '8px' }}>
              e-Invoicing detail(s) generated from the Government's e-Invoicing system.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * VRMTaxInvoicePrintTemplate
 * Floating Print Preview Modal for Tax Invoices in Billing login.
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
        backdropFilter: 'blur(5px)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 16px',
        overflowY: 'auto'
      }}
    >
      {/* Top Floating Action Bar */}
      <div
        className="no-print"
        style={{
          width: '100%',
          maxWidth: '850px',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px 12px 0 0',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #E2E8F0',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            Tax Invoice Preview
          </h2>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#1E3A8A', backgroundColor: '#EFF6FF', padding: '3px 10px', borderRadius: '6px', border: '1px solid #BFDBFE' }}>
            #{invNo.replace(/^#/, '')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => {
              const mailto = `mailto:${invoiceData.customerEmail || ''}?subject=Tax%20Invoice%20${invNo}&body=Please%20find%20attached%20tax%20invoice.`;
              window.open(mailto, '_blank');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <Mail size={14} /> Email
          </button>

          <button
            onClick={() => window.print()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <FileText size={14} /> PDF
          </button>

          <button
            onClick={() => window.print()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#0E7490',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(14, 116, 144, 0.3)'
            }}
          >
            <Printer size={14} /> Print
          </button>

          <button
            onClick={onClose}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#F8FAFC',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '4px'
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main Printable Document Canvas with Paper Shadow Effect */}
      <div
        style={{
          width: '100%',
          maxWidth: '850px',
          backgroundColor: '#FFFFFF',
          borderRadius: '0 0 12px 12px',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          overflow: 'hidden'
        }}
      >
        <VRMTaxInvoicePrintSheet invoiceData={invoiceData} id="printable-tax-invoice" />
      </div>
    </div>
  );
}
