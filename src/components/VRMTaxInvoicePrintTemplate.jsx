import React, { useState, useEffect } from 'react';
import { Printer, Mail, FileText, Download, X } from 'lucide-react';
import { getCachedBranding, fetchMasterBranding, subscribeBrandingUpdates } from '../services/brandingService';
import { exportSmartMultiPagePdf } from '../utils/smartPdfExporter';
import {
  VRMProformaInvoicePrintSheet,
  DEFAULT_PI_TEMPLATE_SETTINGS,
  numberToWordsINR
} from './VRMProformaInvoicePrintTemplate';

export { numberToWordsINR };

// Default benchmark invoice dataset
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
    branch: 'VINAYAGAPURAM BRANCH',
    ifsc: 'HDFC0007315'
  },
  termsConditions: [
    '1. TAX: Included',
    '2. Transport: At actuals',
    '3. Payment: 100% along with the Purchase Order',
    '4. Delivery: Immediate Dispatch',
    '5. Validity: 3 days'
  ],
  items: [
    {
      sNo: 1,
      name: 'Strut Rail - KW',
      description: 'Supply of 40*40*2mm Strut Channel\nAluminum MMS - Struct Rail bit 40 mm Height',
      hsn: '76109010',
      qty: 3.30,
      uom: 'kW',
      rate: 2100.00,
      gstRate: '18%',
      amount: 6930.00
    },
    {
      sNo: 2,
      name: 'Module',
      description: 'Solar panel — BRAND: Vikram (DCR) 550Wp',
      hsn: '85414011',
      qty: 6.00,
      uom: 'Nos',
      rate: 13420.00,
      gstRate: '5%',
      amount: 80520.00
    }
  ]
};

/**
 * Map a Tax Invoice / BOM / DC record into the PI sheet's expected data shape
 * so VRMTaxInvoicePrintSheet renders with the exact same visual design as PI.
 */
function mapInvoiceToPiData(invoiceData) {
  const inv = { ...DEFAULT_OFFICIAL_TAX_INVOICE_DATA, ...(invoiceData || {}) };
  const rawItems = Array.isArray(inv.items) && inv.items.length > 0
    ? inv.items
    : DEFAULT_OFFICIAL_TAX_INVOICE_DATA.items;

  const mappedItems = rawItems
    .filter((it) => it.selected !== false)
    .map((it) => ({
      ...it,
      name: it.name || it.item || it.productName || 'Item',
      description: it.description || it.desc || it.specifications || '',
      hsn: it.hsn || it.hsnCode || '',
      qty: it.bomQty || it.qty || it.quantity || 1,
      uom: it.uom || it.unit || 'Nos',
      rate: Number(it.rate || it.unitPrice || 0),
      gstRate: it.gstRate !== undefined ? it.gstRate : (it.tax !== undefined ? `${it.tax}%` : '18%'),
      amount: Number(it.amount || it.amt || ((Number(it.bomQty || it.qty || 1)) * Number(it.rate || it.unitPrice || 0)))
    }));

  const invNo = inv.invNo || inv.invoiceNo || inv.code || 'VRMS/26-27/2309';

  const cleanAmt = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const n = parseFloat(String(v || '0').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const resolvedGrandTotal = cleanAmt(inv.grandTotal || inv.orderValue || inv.total || inv.amount || inv.totalAmount);
  const resolvedSubTotal = cleanAmt(inv.subTotal || inv.taxableAmount || inv.unitValue) ||
    (resolvedGrandTotal > 0 ? Math.round((resolvedGrandTotal / 1.18) * 100) / 100 : 0);

  // Normalize presetGroups to object map & backfill missing kitPrice so Rate/Taxable never default to 0.00
  let normalizedPresetGroups = {};
  if (Array.isArray(inv.presetGroups) && inv.presetGroups.length > 0) {
    inv.presetGroups.forEach((grp, idx) => {
      const gid = grp?.groupId || grp?.id || `preset-${idx + 1}`;
      const sCount = parseFloat(grp?.setCount || grp?.quantity || 1) || 1;
      const kPrice = cleanAmt(grp?.kitPrice) || (inv.presetGroups.length === 1 && resolvedSubTotal > 0 ? Math.round((resolvedSubTotal / sCount) * 100) / 100 : 0);
      normalizedPresetGroups[gid] = { ...grp, groupId: gid, setCount: sCount, kitPrice: kPrice };
    });
  } else if (inv.presetGroups && typeof inv.presetGroups === 'object' && Object.keys(inv.presetGroups).length > 0) {
    const keys = Object.keys(inv.presetGroups);
    keys.forEach((gid) => {
      const grp = inv.presetGroups[gid];
      const sCount = parseFloat(grp?.setCount || grp?.quantity || 1) || 1;
      const kPrice = cleanAmt(grp?.kitPrice) || (keys.length === 1 && resolvedSubTotal > 0 ? Math.round((resolvedSubTotal / sCount) * 100) / 100 : 0);
      normalizedPresetGroups[gid] = { ...grp, groupId: grp?.groupId || gid, setCount: sCount, kitPrice: kPrice };
    });
  }

  return {
    ...inv,
    piNo: invNo,
    piDate: inv.date || inv.invoiceDate || new Date().toISOString().split('T')[0],
    expDate: inv.dueDate || inv.date || inv.invoiceDate || '',
    vendor: inv.vendor || inv.customerName || 'Customer Company Name',
    customerName: inv.customerName || inv.vendor || 'Customer Company Name',
    gstNo: inv.gstNo || inv.customerGst || '',
    phone: inv.phone || inv.customerPhone || inv.mobile || inv.shippingPhone || '',
    salesPerson: inv.salesPerson || inv.createdBy || '',
    paymentTerms: inv.terms || inv.paymentTerms || 'Due on Receipt',
    sameAsBilling: inv.sameAsBilling !== false && (!inv.deliveryAddress || inv.deliveryAddress === inv.billingAddress),
    presetGroups: normalizedPresetGroups,
    unitValue: resolvedSubTotal,
    subTotal: resolvedSubTotal,
    orderValue: resolvedGrandTotal || Math.round(resolvedSubTotal * 1.18),
    grandTotal: resolvedGrandTotal || Math.round(resolvedSubTotal * 1.18),
    items: mappedItems.length > 0 ? mappedItems : rawItems
  };
}

function buildInvoiceTemplateSettings(invoiceData, branding, overrides = {}) {
  let saved = {};
  try {
    const raw = localStorage.getItem('vrm_pi_template_customization');
    if (raw) saved = JSON.parse(raw);
  } catch (_) {}

  const isDc = Boolean(invoiceData?.docType === 'DC');
  const base = {
    ...DEFAULT_PI_TEMPLATE_SETTINGS,
    ...saved,
    companyName: branding?.companyName || saved.companyName || DEFAULT_PI_TEMPLATE_SETTINGS.companyName || 'VRM STRUCTURES INDIA PRIVATE LIMITED',
    companyGst: branding?.companyGst || saved.companyGst || DEFAULT_PI_TEMPLATE_SETTINGS.companyGst,
    companyEmail: branding?.companyEmail || saved.companyEmail || DEFAULT_PI_TEMPLATE_SETTINGS.companyEmail,
    companyPhone: branding?.companyPhone || saved.companyPhone || DEFAULT_PI_TEMPLATE_SETTINGS.companyPhone,
    companyAddressLine1: branding?.companyAddressLine1 || saved.companyAddressLine1 || DEFAULT_PI_TEMPLATE_SETTINGS.companyAddressLine1,
    companyAddressLine2: branding?.companyAddressLine2 || saved.companyAddressLine2 || DEFAULT_PI_TEMPLATE_SETTINGS.companyAddressLine2,
    logoUrl: branding?.logoUrl || saved.logoUrl || DEFAULT_PI_TEMPLATE_SETTINGS.logoUrl,
    stampUrl: branding?.stampUrl || saved.stampUrl || DEFAULT_PI_TEMPLATE_SETTINGS.stampUrl,
    bankBeneficiary: 'VRM Structures India Private Limited',
    bankAccountNo: '50200031629272',
    bankName: 'HDFC Bank',
    bankBranch: 'VINAYAGAPURAM BRANCH',
    bankIfsc: 'HDFC0007315',
    bankHeading: 'Account Details:',
    accentColor: (saved.accentColor && saved.accentColor !== '#0E7490') ? saved.accentColor : '#1E2F5B',
    documentTitle: isDc ? 'DELIVERY CHALLAN' : 'TAX INVOICE',
    docNoLabel: isDc ? 'DC No.' : 'Invoice No.',
    dateLabel: isDc ? 'DC Date' : 'Invoice Date',
    validUntilLabel: 'Due Date',
    showValidUntil: true,
    showSalesExec: true,
    showCombinedGstPct: true,
    ...overrides
  };
  return base;
}

/**
 * VRMTaxInvoicePrintSheet
 * Renders Tax Invoice using the exact same PI sheet layout and styling.
 */
export function VRMTaxInvoicePrintSheet({ invoiceData, id = 'printable-tax-invoice', settings = {} }) {
  const [branding, setBranding] = useState(getCachedBranding);

  useEffect(() => {
    let isMounted = true;
    fetchMasterBranding().then((b) => {
      if (isMounted && b) setBranding(b);
    });
    const unsub = subscribeBrandingUpdates((b) => {
      if (isMounted && b) setBranding(b);
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  const mappedPiData = mapInvoiceToPiData(invoiceData);
  const mergedSettings = buildInvoiceTemplateSettings(invoiceData, branding, settings);

  return (
    <VRMProformaInvoicePrintSheet
      piData={mappedPiData}
      settings={mergedSettings}
      id={id}
      isEditable={false}
    />
  );
}

/**
 * VRMTaxInvoicePrintTemplate
 * Floating Print Preview Modal for Tax Invoices matching the PI Print Preview design.
 */
export default function VRMTaxInvoicePrintTemplate({ invoiceData, onClose }) {
  const [isExporting, setIsExporting] = useState(false);

  if (!invoiceData) return null;

  const invNo = invoiceData.invNo || invoiceData.invoiceNo || invoiceData.code || 'VRMS/26-27/2309';
  const isDc = Boolean(invoiceData.docType === 'DC');
  const titleText = isDc ? 'Delivery Challan Preview' : 'Tax Invoice Preview';

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      const cleanName = String(invNo).replace(/[^a-zA-Z0-9_-]/g, '_');
      await exportSmartMultiPagePdf('printable-tax-invoice', `${isDc ? 'DC' : 'TaxInvoice'}_${cleanName}.pdf`);
    } catch (err) {
      console.error('Tax Invoice PDF export failed, falling back to print:', err);
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

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
            {titleText}
          </h2>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#1E3A8A', backgroundColor: '#EFF6FF', padding: '3px 10px', borderRadius: '6px', border: '1px solid #BFDBFE' }}>
            #{String(invNo).replace(/^#/, '')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              const mailto = `mailto:${invoiceData.customerEmail || ''}?subject=${encodeURIComponent((isDc ? 'Delivery Challan ' : 'Tax Invoice ') + invNo)}&body=${encodeURIComponent('Please find attached document.')}`;
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
            type="button"
            disabled={isExporting}
            onClick={handleDownloadPdf}
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
              cursor: isExporting ? 'wait' : 'pointer',
              opacity: isExporting ? 0.6 : 1
            }}
          >
            <Download size={14} /> {isExporting ? 'Exporting...' : 'Download PDF'}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#1E2F5B',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(30, 47, 91, 0.3)'
            }}
          >
            <Printer size={14} /> Print
          </button>

          <button
            type="button"
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

      {/* Main Printable Document Canvas matching PI Print Design */}
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
