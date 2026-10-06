import React, { useState, useEffect } from 'react';
import { Printer, Mail, FileText, X } from 'lucide-react';
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

// Format date into readable standard format (e.g. January 8, 2026)
function formatInvoiceDate(dateStr) {
  if (!dateStr) return 'January 8, 2026';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
  } catch (_) {}
  return String(dateStr);
}

// Default benchmark invoice dataset matching official Tax Invoice format
export const DEFAULT_OFFICIAL_TAX_INVOICE_DATA = {
  invNo: 'INV-345442-000',
  date: '2026-01-08',
  dueDate: '2026-01-31',
  terms: 'Due on Receipt',
  ewayBill: '542055911945',
  placeOfSupply: 'Tamil Nadu (33)',
  salesPerson: 'Mohith',
  vendor: 'Cansaas Agency',
  customerName: 'Cansaas Agency',
  customerEmail: 'cansaas.creatinf@gmail.com',
  billingAddress: '123 Mapple, Metropolis Street,\nSpringfield, IN 54129',
  gstNo: '33CIQPB3415A1ZX',
  phone: '+91 98847 20789',
  bankDetails: {
    beneficiary: 'VRM Structures India Private Limited',
    accountNo: '332176141910371',
    bankName: 'HDFC Bank',
    branch: 'Kodambakkam',
    ifsc: 'HDFC0000574'
  },
  items: [
    {
      sNo: 1,
      name: 'Brand Guidelines',
      description: 'Supply of Structural Mounting MMS Standards',
      hsn: '76109010',
      qty: 2,
      unit: "no's",
      rate: 1250.00,
      tax: '10%',
      amount: 2500.00
    },
    {
      sNo: 2,
      name: 'Logo Usage',
      description: 'Solar Mounting Engineering & Specification Specs',
      hsn: '85414011',
      qty: 3,
      unit: "no's",
      rate: 1000.00,
      tax: '10%',
      amount: 3000.00
    },
    {
      sNo: 3,
      name: 'Color Palette',
      description: 'High Tensile Fastener Kits & Earthing Terminal Sets',
      hsn: '85359090',
      qty: 4,
      unit: "no's",
      rate: 1000.00,
      tax: '10%',
      amount: 4000.00
    },
    {
      sNo: 4,
      name: 'Typography Standards',
      description: 'Solar On-Grid Installation Verification Guide',
      hsn: '85044090',
      qty: 5,
      unit: "no's",
      rate: 1000.00,
      tax: '10%',
      amount: 5000.00
    }
  ]
};

/**
 * VRMTaxInvoicePrintSheet
 * Modern, clean, minimalist printable sheet matching the user's requested template aesthetic.
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

  // Normalize items
  const items = rawItems.map((it, idx) => {
    const qty = Number(it.qty || it.quantity || 1);
    const rate = Number(it.rate || it.unitPrice || (it.amount ? it.amount / qty : 0));
    const amount = Number(it.amount || (qty * rate) || 0);
    const taxRate = it.tax ? String(it.tax) : (it.cgstPct && it.sgstPct ? `${parseFloat(it.cgstPct) + parseFloat(it.sgstPct)}%` : '10%');
    return {
      sNo: idx + 1,
      name: it.name || it.item || it.description || `Item ${idx + 1}`,
      description: it.description || '',
      hsn: it.hsn || it.hsnCode || '',
      qty,
      unit: it.unit || "no's",
      rate,
      tax: taxRate,
      amount
    };
  });

  const subTotal = items.reduce((sum, it) => sum + it.amount, 0);
  const discountAmount = Number(inv.discount || inv.discountAmount || 0);
  const grandTotal = Math.max(0, subTotal - discountAmount);

  // Address lines
  const customerName = inv.customerName || inv.vendor || inv.c2 || inv.clientName || 'Cansaas Agency';
  const customerEmail = inv.customerEmail || inv.email || 'cansaas.creatinf@gmail.com';
  const customerAddress = inv.billingAddress || inv.address || '123 Mapple, Metropolis Street';

  const companyName = branding.companyName || 'Angelina Caroline';
  const companyEmail = branding.email || 'angelina.creatinf@gmail.com';
  const companyAddress = branding.address || 'IV Persimmon, Springfield, IN 54129';

  const invNoDisplay = inv.invNo || inv.invoiceNo || inv.code || 'INV-345442-000';
  const dateIssueDisplay = formatInvoiceDate(inv.date || inv.dateIssue || inv.createdAt);
  const dueDateDisplay = formatInvoiceDate(inv.dueDate || inv.deliveryDate || '2026-01-31');

  const logoSrc = branding.logoUrl || VRM_OFFICIAL_LOGO;
  const stampSrc = branding.customStampUrl || VRM_OFFICIAL_STAMP || '/vrm_stamp.png';

  return (
    <div
      id={id}
      style={{
        width: '100%',
        maxWidth: '820px',
        backgroundColor: '#FFFFFF',
        color: '#0F172A',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: '13px',
        lineHeight: '1.4',
        boxSizing: 'border-box',
        margin: '0 auto',
        padding: '36px 42px',
        borderRadius: '8px',
        position: 'relative'
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
              padding: 10mm 14mm !important;
              margin: 0 !important;
            }
          }
        `}
      </style>

      {/* ─── 1. TOP HEADER: INVOICE TITLE & LOGO EMBLEM ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '900',
            letterSpacing: '-0.5px',
            color: '#0F172A',
            margin: 0,
            lineHeight: 1
          }}>
            INVOICE
          </h1>
          <div style={{ fontSize: '13.5px', color: '#64748B', marginTop: '6px', fontWeight: '500' }}>
            Invoice Number &nbsp;
            <span style={{ color: '#0F172A', fontWeight: '700' }}>
              #{invNoDisplay.replace(/^#/, '')}
            </span>
          </div>
        </div>

        {/* Circular Emblem / Logo Matching Screenshot */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#042F2E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(4, 47, 46, 0.25)',
            border: '2px solid #064E3B'
          }}>
            {logoSrc ? (
              <img
                src={logoSrc}
                alt="Logo"
                style={{ width: '36px', height: '36px', objectFit: 'contain' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M2 12h20M5 5l14 14M5 19L19 5" />
              </svg>
            )}
          </div>
        </div>
      </div>

      <div style={{ height: '1px', backgroundColor: '#E2E8F0', marginBottom: '20px' }} />

      {/* ─── 2. BILLED BY & BILLED TO SECTION ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '20px' }}>
        {/* Left: Billed by */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'capitalize', marginBottom: '4px' }}>
            Billed by:
          </div>
          <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', marginBottom: '2px' }}>
            {companyName}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '2px' }}>
            {companyEmail}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.4', whiteSpace: 'pre-line' }}>
            {companyAddress}
          </div>
        </div>

        {/* Right: Billed to */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'capitalize', marginBottom: '4px' }}>
            Billed to:
          </div>
          <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', marginBottom: '2px' }}>
            {customerName}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '2px' }}>
            {customerEmail}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.4', whiteSpace: 'pre-line' }}>
            {customerAddress}
          </div>
        </div>
      </div>

      {/* ─── 3. DATES ROW ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '28px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '3px' }}>
            Date Issue:
          </div>
          <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
            {dateIssueDisplay}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '3px' }}>
            Due Date:
          </div>
          <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
            {dueDateDisplay}
          </div>
        </div>
      </div>

      {/* ─── 4. INVOICE ITEMS / SERVICE SECTION ─── */}
      <div style={{ fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '10px' }}>
        Invoice Items/Service:
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
            <th style={{ padding: '8px 4px', textAlign: 'left', fontSize: '11.5px', fontWeight: '700', color: '#64748B', width: '48%' }}>
              Item Name
            </th>
            <th style={{ padding: '8px 4px', textAlign: 'center', fontSize: '11.5px', fontWeight: '700', color: '#64748B', width: '16%' }}>
              QTY
            </th>
            <th style={{ padding: '8px 4px', textAlign: 'center', fontSize: '11.5px', fontWeight: '700', color: '#64748B', width: '16%' }}>
              Tax
            </th>
            <th style={{ padding: '8px 4px', textAlign: 'right', fontSize: '11.5px', fontWeight: '700', color: '#64748B', width: '20%' }}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '12px 4px', verticalAlign: 'top' }}>
                <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '13px' }}>
                  {it.name}
                </div>
                {it.description && (
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', lineHeight: '1.3' }}>
                    {it.description}
                  </div>
                )}
              </td>
              <td style={{ padding: '12px 4px', textAlign: 'center', verticalAlign: 'top', color: '#334155', fontWeight: '600' }}>
                {it.qty}
              </td>
              <td style={{ padding: '12px 4px', textAlign: 'center', verticalAlign: 'top', color: '#334155', fontWeight: '600' }}>
                {it.tax}
              </td>
              <td style={{ padding: '12px 4px', textAlign: 'right', verticalAlign: 'top', fontWeight: '700', color: '#0F172A' }}>
                ₹{Number(it.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ─── 5. FINANCIAL SUMMARY BLOCK ─── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
        <div style={{ width: '280px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12.5px', color: '#64748B' }}>
            <span>Subtotal</span>
            <span style={{ fontWeight: '700', color: '#0F172A' }}>
              ₹{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12.5px', color: '#64748B' }}>
              <span>Discount</span>
              <span style={{ fontWeight: '700', color: '#DC2626' }}>
                -₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '10px 0 4px 0',
            fontSize: '14px',
            fontWeight: '900',
            color: '#0F172A',
            borderTop: '1px solid #E2E8F0',
            marginTop: '6px'
          }}>
            <span>Grand Total</span>
            <span style={{ fontSize: '15px' }}>
              ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Total in words */}
      <div style={{ fontSize: '11px', color: '#64748B', fontStyle: 'italic', marginBottom: '18px' }}>
        Total in Words: <strong style={{ color: '#0F172A' }}>{numberToWordsINR(grandTotal)}</strong>
      </div>

      {/* ─── 6. NOTE PILL BOX MATCHING SCREENSHOT ─── */}
      <div style={{
        backgroundColor: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: '10px',
        padding: '10px 16px',
        fontSize: '11.5px',
        color: '#64748B',
        marginBottom: '26px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span>
          <strong>Note:</strong> Late payments will incur a 10% annual fee, calculated daily.
        </span>
        <span style={{ fontSize: '11px', color: '#94A3B8' }}>
          Terms: {inv.terms || 'Due on Receipt'}
        </span>
      </div>

      {/* ─── 7. PAYMENT METHOD & SIGNATURE ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '8px' }}>
        {/* Left: Payment Method */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', marginBottom: '2px' }}>
            Payment Method
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748B' }}>
            EFT Bank Transfer / NEFT / RTGS
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
            Account Number : <strong style={{ color: '#0F172A' }}>{inv.bankDetails?.accountNo || '332176141910371'}</strong>
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
            Bank: {inv.bankDetails?.bankName || 'HDFC Bank'} • IFSC: {inv.bankDetails?.ifsc || 'HDFC0000574'}
          </div>
        </div>

        {/* Right: Signature */}
        <div style={{ textAlign: 'center', minWidth: '160px' }}>
          <div style={{ height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2px' }}>
            {stampSrc ? (
              <img
                src={stampSrc}
                alt="Signature"
                style={{ maxHeight: '42px', maxWidth: '140px', objectFit: 'contain' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <span style={{ fontFamily: "'Brush Script MT', cursive, sans-serif", fontSize: '24px', color: '#0F172A' }}>
                Soke Bahtera Abr
              </span>
            )}
          </div>
          <div style={{ height: '1px', width: '140px', backgroundColor: '#CBD5E1', margin: '0 auto 4px auto' }} />
          <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#334155' }}>
            {inv.signatoryName || 'Soke Bahtera Abr'}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * VRMTaxInvoicePrintTemplate
 * Floating Print Preview Modal for Tax Invoices.
 * Styled matching the screenshot's top "Preview" bar and paper document.
 */
export default function VRMTaxInvoicePrintTemplate({ invoiceData, onClose }) {
  if (!invoiceData) return null;

  const invNo = invoiceData.invNo || invoiceData.invoiceNo || invoiceData.code || 'INV-345442-000';

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
      {/* Top Floating Action Bar Matching Screenshot */}
      <div
        className="no-print"
        style={{
          width: '100%',
          maxWidth: '820px',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px 12px 0 0',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #E2E8F0',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#0F172A', margin: 0 }}>
            Preview
          </h2>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', backgroundColor: '#F1F5F9', padding: '3px 8px', borderRadius: '6px' }}>
            #{invNo.replace(/^#/, '')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => {
              const mailto = `mailto:${invoiceData.customerEmail || ''}?subject=Invoice%20${invNo}&body=Please%20find%20attached%20invoice.`;
              window.open(mailto, '_blank');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontSize: '12.5px',
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
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontSize: '12.5px',
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
              backgroundColor: '#0284C7',
              color: '#FFFFFF',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
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
          maxWidth: '820px',
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
