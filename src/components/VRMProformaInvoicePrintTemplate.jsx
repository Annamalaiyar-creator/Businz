import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fetchMasterBranding, getCachedBranding, saveCompanyBranding, subscribeBrandingUpdates } from '../services/brandingService';
import { isTamilNaduIntra } from '../utils/gstHelper';
import {
  Printer,
  Download,
  X,
  CheckCircle,
  FileText,
  CreditCard,
  Sliders,
  Palette,
  RotateCcw,
  Eye,
  Save,
  Layers,
  Upload,
  Image,
  Trash2,
  PenTool,
  Stamp,
  Undo2,
  MessageSquare,
  Smartphone,
  Send,
  QrCode
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { VRM_OFFICIAL_LOGO, VRM_OFFICIAL_STAMP } from '../utils/vrmOfficialAssets';
import WhatsAppQrModal from './crm/WhatsAppQrModal';
import {
  getCleanCurrentUserId,
  getCurrentSalesRepName,
  getWhatsAppStatus,
  sendDirectWhatsApp,
  formatPiWhatsAppText
} from '../utils/whatsappDispatchService';

// Default Template Configuration Settings
export const DEFAULT_PI_TEMPLATE_SETTINGS = {
  // Theme & Identity
  accentColor: '#0E7490', // Default VRM Teal
  documentTitle: 'Proforma Invoice',
  companyName: 'VRM Structures India Pvt Ltd.',
  companyTagline: '',
  showLogo: true,
  customLogoUrl: VRM_OFFICIAL_LOGO, // Official VRM Logo base64
  logoHeight: 54, // Fixed constant size
  showCompanyName: true,
  showCompanyTagline: false,
  showContactInfo: true,
  showCompanyAddress: true,
  showCinGst: true,
  showCompanyPhoneEmail: false,
  showCompanyWebsite: false,

  // Company Address & Reg Details
  companyAddressLine1: '1427, GNT Road, Nagappa Industrial Estate,',
  companyAddressLine2: 'Puzhal,\nChennai, Tamil Nadu 600066\nIndia',
  companyGstin: '33AAGCV4262N1ZZ',
  companyCin: '',
  companyUdyam: 'MSME/Udyam No',
  companyPhone: '+91 98847 20789',
  companyEmail: 'sales@vrmstructures.com',
  companyWebsite: 'www.vrmstructures.com',

  // Address & Meta Options
  showDocumentTitle: true,
  showDocNo: true,
  showDate: true,
  showValidUntil: false,
  showShipTo: true,
  showTransportDetails: false,
  showSalesExecutive: false,
  showPaymentTerms: false,
  showPlaceOfSupply: false,

  // Buyer Details Visibility
  showBillTo: true,
  showBuyerAddress: true,
  showBuyerGstin: true,
  showBuyerContact: true,
  showBuyerPhone: true,
  showBuyerEmail: true,

  // Custom Meta & Address Labels
  docNoLabel: 'P.I No.',
  dateLabel: 'P.I Date',
  validUntilLabel: 'Valid Until:',
  paymentTermsLabel: 'Payment Terms:',
  placeOfSupplyLabel: 'Place Of Supply:',
  salesExecutiveLabel: 'Sales Executive:',
  billToLabel: 'Bill To',
  shipToLabel: 'Ship To',

  // Table Columns Visibility
  showSnoCol: true,
  showHsn: true,
  showQty: true,
  showUom: true,
  showItemDescription: true,
  showRateCol: true,
  showDiscountCol: false,
  showTaxableCol: true,
  showGstCol: true,
  showTotalCol: true,

  // Table Column Header Renaming
  colHeaderSno: '#',
  colHeaderDesc: 'Item & Description',
  colHeaderHsn: 'HSN/SAC',
  colHeaderQty: 'Qty',
  colHeaderUom: 'UOM',
  colHeaderRate: 'Rate',
  colHeaderDiscount: 'Disc%',
  colHeaderTaxable: 'Amount',
  colHeaderGst: 'GST%',
  colHeaderAmount: 'Amount',

  // Calculation & Banking
  showSubTotal: true,
  showTaxBreakdown: true,
  showTotalInWords: true,
  showBankDetails: true,
  showBankBeneficiary: true,
  showBankName: true,
  showBankAccountNo: true,
  showBankIfsc: true,
  showBankBranch: true,
  bankHeading: 'Account Details:',
  bankBeneficiary: 'VRM Structures India Private Limited',
  bankName: 'HDFC Bank',
  bankAccountNo: '50200031629272',
  bankIfsc: 'HDFC0000574',
  bankBranch: 'Kodambakkam',
  bankAccountType: 'Current Account',

  // Terms & Conditions
  showTerms: true,
  termsHeading: 'Terms & Conditions',
  termsText:
    '1. TAX: Included\n2. Transport: At actuals\n3. Payment: 100% along with the Purchase Order\n4. Delivery: Immediate Dispatch\n5. Validity: 3 days',

  // Stamp / Seal Customization
  showSignatoryStamp: true,
  stampMode: 'custom', // 'vector' | 'custom' | 'none'
  stampSize: 150, // Width in px
  customStampUrl: VRM_OFFICIAL_STAMP, // Official VRM Stamp image base64
  stampText: 'VRM STRUCTURES INDIA PRIVATE LIMITED',
  stampLocation: 'CHENNAI',

  // Signature Customization
  signatureMode: 'vector', // 'none' | 'vector' | 'custom' | 'blank'
  customSignatureUrl: null,
  forCompanyText: 'For VRM Structures India Pvt Ltd',
  signatoryTitle: 'Authorized Signatory',
  signatoryName: '',

  // Customer Acceptance & Footer
  showCustomerAcceptance: false,
  customerAcceptanceHeading: 'Customer Acceptance & Signature',
  customerAcceptanceSubtext: 'Authorised Signature & Stamp',
  showFooterNote: true,
  footerNote: 'This is an official commercial document issued by VRM Structures India Private Limited. Chennai, Tamil Nadu, India.'
};

const COLOR_PRESETS = [
  { name: 'VRM Teal', hex: '#0E7490' },
  { name: 'Royal Navy', hex: '#1E3A8A' },
  { name: 'Tech Cobalt', hex: '#2563EB' },
  { name: 'Emerald Forest', hex: '#059669' },
  { name: 'Charcoal Slate', hex: '#1E293B' },
  { name: 'Crimson Burgundy', hex: '#991B1B' }
];

const TITLE_PRESETS = ['PROFORMA INVOICE', 'QUOTATION', 'ESTIMATE', 'PROFORMA TAX INVOICE'];

// Lightweight canvas image compressor to safely store in localStorage
const compressImageFile = (file, maxDim = 450, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width || 400;
          let height = img.height || 300;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const isPng = file.type === 'image/png';
          const dataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality);
          resolve(dataUrl);
        } catch (err) {
          resolve(e.target.result);
        }
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper to convert number to Indian Rupees in words
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

  const integerPart = Math.floor(Math.abs(num));
  const words = convert(integerPart);
  return `Indian Rupee ${words} Only`;
}

// Format date nicely (DD-MM-YYYY to match official format)
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (e) {
    return dateStr;
  }
}

/**
 * Printable Sheet Component for Proforma Invoice
 */
export function VRMProformaInvoicePrintSheet({
  piData,
  settings = DEFAULT_PI_TEMPLATE_SETTINGS,
  id = 'printable-proforma-invoice',
  isEditable = false,
  onUpdateSetting,
  onUpdatePiData,
  onElementRemoved
}) {
  if (!piData) return null;

  const pi = piData;
  const isBomDocument = Boolean(
    piData?.category === 'bom' ||
    settings?.documentTitle?.toUpperCase().includes('BOM') ||
    piData?.bomCode
  );

  const cfg = {
    ...DEFAULT_PI_TEMPLATE_SETTINGS,
    ...settings,
    ...(isBomDocument ? {
      showHsn: false,
      showRateCol: false,
      showTaxableCol: false,
      showGstCol: false,
      showDiscountCol: false,
      showTotalCol: false,
      showTotalInWords: false,
      showBankDetails: false,
      showTerms: false,
      showPaymentTerms: false,
      showSignatoryStamp: false,
      showTransportDetails: false,
      showCustomerAcceptance: false,
      showSubtotalSummary: false
    } : {})
  };
  const accent = cfg.accentColor || '#0E7490';

  // Inline Click-to-Edit & Quick-Remove Helper Component
  const EditableText = ({
    value,
    fallback = '',
    onSave,
    onRemove,
    removeLabel,
    style = {},
    tag = 'span',
    className = '',
    multiline = false,
    placeholder = 'Click to edit...'
  }) => {
    const [isHovered, setIsHovered] = useState(false);

    if (!isEditable || !onSave) {
      const Tag = tag;
      return <Tag style={style} className={className}>{value || fallback}</Tag>;
    }

    return (
      <span
        style={{
          position: 'relative',
          display: style.display || (multiline ? 'block' : 'inline-block'),
          verticalAlign: 'middle',
          maxWidth: '100%'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => {
            const text = e.currentTarget.innerText.trim();
            if (text !== value) {
              onSave(text);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !multiline) {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          style={{
            ...style,
            outline: isHovered ? '1px dashed #0E7490' : 'none',
            backgroundColor: isHovered ? 'rgba(14, 116, 144, 0.08)' : (style.backgroundColor || 'transparent'),
            borderRadius: '3px',
            padding: '1px 3px',
            transition: 'all 0.15s ease',
            display: multiline ? 'block' : 'inline-block',
            cursor: 'text'
          }}
          className={`${className} editable-template-field ${(!value && !fallback) ? 'no-print' : ''}`}
          title="Click to edit text"
        >
          {value || fallback || placeholder}
        </span>
        {onRemove && (
          <button
            type="button"
            className="no-print"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onRemove();
            }}
            title={`Remove ${removeLabel || 'element'} from print/PDF`}
            style={{
              opacity: isHovered ? 1 : 0,
              visibility: isHovered ? 'visible' : 'hidden',
              transition: 'opacity 0.15s ease',
              position: 'absolute',
              top: '-6px',
              right: '-8px',
              backgroundColor: '#EF4444',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '50%',
              width: '15px',
              height: '15px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '9px',
              fontWeight: '800',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
              zIndex: 10,
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
            }}
          >
            ✕
          </button>
        )}
      </span>
    );
  };

  // Section / Block Container with hover-remove button
  const RemovableBlock = ({
    visible = true,
    settingKey,
    title = 'Section',
    onRemove,
    children,
    style = {}
  }) => {
    const [isHovered, setIsHovered] = useState(false);
    if (!visible) return null;
    if (!isEditable || (!onRemove && !settingKey)) {
      return <div style={style}>{children}</div>;
    }

    const handleRemove = () => {
      if (onRemove) {
        onRemove();
      } else if (settingKey) {
        onUpdateSetting?.({ [settingKey]: false });
        onElementRemoved?.(settingKey, title);
      }
    };

    return (
      <div
        style={{ ...style, position: 'relative' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {children}
        <button
          type="button"
          className="no-print"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleRemove();
          }}
          title={`Remove ${title} from print/PDF`}
          style={{
            opacity: isHovered ? 1 : 0,
            visibility: isHovered ? 'visible' : 'hidden',
            transition: 'opacity 0.15s ease',
            position: 'absolute',
            top: '2px',
            right: '2px',
            backgroundColor: '#FEE2E2',
            color: '#DC2626',
            border: '1px solid #FCA5A5',
            borderRadius: '6px',
            fontSize: '10px',
            fontWeight: '800',
            padding: '2px 7px',
            cursor: 'pointer',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
          }}
        >
          ✕ Remove
        </button>
      </div>
    );
  };

  // Dedicated Header Metadata Row with hover delete and editable label/value
  const RemovableMetaRow = ({
    visible = true,
    settingKey,
    label,
    itemLabel,
    valueText,
    fallbackValue,
    valueColor,
    onSaveLabel,
    onSaveValue
  }) => {
    const [hovered, setHovered] = useState(false);
    if (!visible) return null;

    return (
      <tr
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ position: 'relative' }}
      >
        <td style={{ padding: '2px 6px', fontWeight: '700', color: '#475569', textAlign: 'right', width: '50%' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
            {isEditable && (
              <button
                type="button"
                className="no-print"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onUpdateSetting?.({ [settingKey]: false });
                  onElementRemoved?.(settingKey, itemLabel || label);
                }}
                title={`Remove ${itemLabel || label} from print/PDF`}
                style={{
                  opacity: hovered ? 1 : 0,
                  visibility: hovered ? 'visible' : 'hidden',
                  transition: 'opacity 0.15s ease',
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '50%',
                  width: '15px',
                  height: '15px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  cursor: 'pointer',
                  padding: 0,
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            )}
            <EditableText
              value={label}
              fallback={label}
              onSave={onSaveLabel}
            />
          </div>
        </td>
        <td style={{ padding: '2px 6px', fontWeight: valueColor ? '800' : '700', color: valueColor || '#0F172A', textAlign: 'right' }}>
          <EditableText
            value={valueText}
            fallback={fallbackValue}
            onSave={onSaveValue}
          />
        </td>
      </tr>
    );
  };

  // Dedicated Table Header Cell with hover ✕ button to remove column without touching items
  const RemovableTableHeaderCell = ({
    title,
    settingKey,
    label,
    align = 'center',
    width,
    canRemove = true,
    onSaveTitle
  }) => {
    const [hovered, setHovered] = useState(false);

    return (
      <th
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          padding: align === 'left' ? '8px 10px' : (align === 'right' ? '8px 8px' : '8px 6px'),
          borderRight: '1px solid rgba(255,255,255,0.2)',
          width: width,
          textAlign: align,
          color: '#FFFFFF',
          fontWeight: '700'
        }}
      >
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: align === 'right' ? 'flex-end' : (align === 'left' ? 'flex-start' : 'center'),
          gap: '4px',
          width: align === 'right' ? '100%' : 'auto'
        }}>
          <EditableText
            value={title}
            fallback={label}
            onSave={onSaveTitle}
            style={{ color: '#FFFFFF', fontWeight: '700' }}
          />
          {isEditable && canRemove && (
            <button
              type="button"
              className="no-print"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onUpdateSetting?.({ [settingKey]: false });
                onElementRemoved?.(settingKey, label);
              }}
              title={`Remove ${label} from print/PDF`}
              style={{
                opacity: hovered ? 1 : 0.65,
                visibility: 'visible',
                transition: 'opacity 0.15s ease',
                backgroundColor: '#EF4444',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '50%',
                width: '15px',
                height: '15px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: '900',
                cursor: 'pointer',
                padding: 0,
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                flexShrink: 0
              }}
            >
              ✕
            </button>
          )}
        </div>
      </th>
    );
  };

  // Extract or synthesize items array
  const rawItems = Array.isArray(pi.items) && pi.items.length > 0 ? pi.items : [
    {
      name: pi.productName || 'Solar Mounting Structures & Fasteners',
      description: pi.productDescription || (pi.productName ? `Supply of ${pi.productName} as per technical specifications` : 'Standard VRM Solar Structure & Accessories Kit'),
      hsn: pi.hsn || '73089090',
      qty: pi.quantity || 1,
      uom: pi.uom || 'Nos',
      rate: Number(pi.unitValue || (typeof pi.amount === 'string' ? parseFloat(pi.amount.replace(/[^0-9.]/g, '')) : pi.amount) || 0),
      gstRate: pi.gstRate || '18%',
      discountPct: 0,
      amount: Number(pi.unitValue || (typeof pi.amount === 'string' ? parseFloat(pi.amount.replace(/[^0-9.]/g, '')) : pi.amount) || 0) * (Number(pi.quantity) || 1)
    }
  ];

  // Helper to extract clean string from address object or string and deduplicate repeated tokens
  const parseAddress = (addrObj, directStreet, directCity, directState, directPin) => {
    let street = '';
    let city = '';
    let state = '';
    let pincode = '';

    if (addrObj && typeof addrObj === 'object') {
      street = String(addrObj.street || addrObj.address || '').trim();
      city = String(addrObj.city || '').trim();
      state = String(addrObj.state || '').trim();
      pincode = String(addrObj.pincode || addrObj.pin || addrObj.zip || '').trim();
    } else if (typeof addrObj === 'string') {
      street = addrObj.trim();
    }

    if (directStreet && typeof directStreet === 'string') street = directStreet.trim();
    if (directCity && typeof directCity === 'string') city = directCity.trim();
    if (directState && typeof directState === 'string') state = directState.trim();
    if (directPin && (typeof directPin === 'string' || typeof directPin === 'number')) pincode = String(directPin).trim();

    // Deduplicate repeated comma/newline separated segments (e.g., "Chennai, Tamil Nadu, PIN: 600098, Chennai, Tamil Nadu...")
    const dedupeTokens = (raw) => {
      if (!raw) return '';
      const parts = String(raw).split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      const seen = new Set();
      const unique = [];
      for (const p of parts) {
        const norm = p.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (norm && !seen.has(norm)) {
          seen.add(norm);
          unique.push(p);
        }
      }
      return unique.join(', ');
    };

    return {
      street: dedupeTokens(street) || 'Plot No 4A, Industrial Area',
      city: dedupeTokens(city) || 'Chennai',
      state: state || 'Tamil Nadu',
      pincode: pincode || '600066'
    };
  };

  const billAddr = parseAddress(pi.billingAddress, pi.billingStreet, pi.billingCity, pi.billingState, pi.billingPincode);
  const sameAsBilling = pi.sameAsBilling !== false;
  const shipAddr = sameAsBilling
    ? billAddr
    : parseAddress(pi.deliveryAddress, pi.deliveryStreet, pi.deliveryCity, pi.deliveryState, pi.deliveryPincode);

  const bStreet = billAddr.street;
  const bCity = billAddr.city;
  const bState = billAddr.state;
  const bPincode = billAddr.pincode;

  const dStreet = shipAddr.street;
  const dCity = shipAddr.city;
  const dState = shipAddr.state;
  const dPincode = shipAddr.pincode;

  const bStreetNorm = (bStreet || '').toLowerCase();
  const bStreetHasCity = Boolean(bCity && bStreetNorm.includes(bCity.toLowerCase()));
  const bStreetHasState = Boolean(bState && bStreetNorm.includes(bState.toLowerCase()));
  const bStreetHasPin = Boolean(bPincode && bStreetNorm.includes(bPincode.toLowerCase()));
  const bStreetHasIndia = bStreetNorm.includes('india');

  const dStreetNorm = (dStreet || '').toLowerCase();
  const dStreetHasCity = Boolean(dCity && dStreetNorm.includes(dCity.toLowerCase()));
  const dStreetHasState = Boolean(dState && dStreetNorm.includes(dState.toLowerCase()));
  const dStreetHasPin = Boolean(dPincode && dStreetNorm.includes(dPincode.toLowerCase()));
  const dStreetHasIndia = dStreetNorm.includes('india');

  const customerName = typeof pi.vendor === 'string' ? pi.vendor : (typeof pi.customerName === 'string' ? pi.customerName : (typeof pi.vendorName === 'string' ? pi.vendorName : 'Customer Company Name'));

  // Detect Inter-state vs Intra-state GST based on customer state / GST
  const customerGst = typeof pi.gstNo === 'string' ? pi.gstNo.trim().toUpperCase() : '';
  const rawState = bState || '';
  const customerState = typeof rawState === 'string' ? rawState.trim().toLowerCase() : '';
  const isTamilNadu = customerGst.startsWith('33') || customerState.includes('tamil') || customerState.includes('tn');
  const isInterState = customerGst.length >= 2 && !customerGst.startsWith('33') && !isTamilNadu;

  // Extract preset groups or detect preset items
  const presetGroups = pi.presetGroups || {};
  const hasConfiguredGroups = Object.keys(presetGroups).length > 0;
  const anyPresetItem = rawItems.some(it => it.isPresetItem || it.presetGroupId);
  const allZeroRate = rawItems.length > 0 && rawItems.every(it => (parseFloat(it.rate) || 0) === 0) && (Number(pi.unitValue) || Number(pi.orderValue) || 0) > 0;

  // Pre-calculate group prices and GSTs
  const groupMetaMap = {};
  if (hasConfiguredGroups) {
    Object.keys(presetGroups).forEach(grpId => {
      const grp = presetGroups[grpId];
      const uPrice = parseFloat(grp.kitPrice) || 0;
      const sCount = parseInt(grp.setCount) || 1;
      const grpSub = uPrice * sCount;
      const gItems = rawItems.filter(it => (it.presetGroupId || 'legacy_default') === grpId);
      const tQty = gItems.reduce((s, it) => s + (parseFloat(it.qty) || 1), 0);
      let grpGst = 0;
      if (tQty > 0) {
        gItems.forEach(it => {
          const itShare = grpSub * ((parseFloat(it.qty) || 1) / tQty);
          const itRate = parseFloat(String(it.gstRate || grp.gstRate || '18%').replace('%', '')) || 0;
          grpGst += itShare * (itRate / 100);
        });
      } else {
        const rPct = parseFloat(String(grp.gstRate || '18%').replace('%', '')) || 18;
        grpGst = grpSub * (rPct / 100);
      }
      groupMetaMap[grpId] = {
        name: grp.presetName || grp.name || 'Solar Structure MMS Kit',
        presetName: grp.presetName || grp.name || 'Solar Structure MMS Kit',
        kitPrice: uPrice,
        taxable: grpSub,
        setCount: sCount,
        groupSubtotal: grpSub,
        groupGst: grpGst,
        groupTotal: grpSub + grpGst,
        gstRateStr: grp.gstRate || '18%'
      };
    });
  }

  // Fallback for implicit preset / zero-rate items or when presetGroups is empty but items are preset
  if (Object.keys(groupMetaMap).length === 0 && (anyPresetItem || allZeroRate)) {
    const rawVal = Number(pi.unitValue) || (Number(pi.orderValue) ? Math.round(Number(pi.orderValue) / 1.18) : 0);
    const uPrice = Math.round(rawVal);
    const sCount = 1;
    const grpSub = uPrice;
    const tQty = rawItems.reduce((s, it) => s + (parseFloat(it.qty) || 1), 0);
    let grpGst = 0;
    rawItems.forEach(it => {
      const itShare = grpSub * ((parseFloat(it.qty) || 1) / (tQty || 1));
      const itRate = parseFloat(String(it.gstRate || '18%').replace('%', '')) || 18;
      grpGst += itShare * (itRate / 100);
    });
    groupMetaMap['implicit_preset_1'] = {
      name: pi.productName || pi.presetName || 'Solar MMS Preset Kit',
      presetName: pi.productName || pi.presetName || 'Solar MMS Preset Kit',
      kitPrice: uPrice,
      taxable: grpSub,
      setCount: sCount,
      groupSubtotal: grpSub,
      groupGst: grpGst,
      groupTotal: grpSub + grpGst,
      gstRateStr: '18%'
    };
  }

  // Distinct preset groups in items
  const distinctPrintGroupIds = [];
  rawItems.forEach(x => {
    const xIsPreset = Boolean(x.isPresetItem || x.presetGroupId || (Object.keys(groupMetaMap).length > 0 && !x.rate));
    let xGrpId = x.presetGroupId;
    if (xIsPreset && (!xGrpId || !groupMetaMap[xGrpId])) {
      xGrpId = Object.keys(groupMetaMap)[0] || 'implicit_preset_1';
    }
    if (xIsPreset && xGrpId && !distinctPrintGroupIds.includes(xGrpId)) {
      distinctPrintGroupIds.push(xGrpId);
    }
  });

  // Live Inline Editing Handlers for Table Line Items and Preset Groups
  const handleUpdateItem = (rawIdx, patch) => {
    const updated = rawItems.map((item, i) => {
      if (i === rawIdx) {
        const next = { ...item, ...patch };
        if (patch.qty !== undefined || patch.rate !== undefined) {
          const q = parseFloat(patch.qty !== undefined ? patch.qty : next.qty) || 0;
          const r = parseFloat(patch.rate !== undefined ? patch.rate : next.rate) || 0;
          next.amount = q * r;
        }
        return next;
      }
      return item;
    });
    onUpdatePiData?.({ items: updated });
  };

  const handleUpdatePresetGroup = (grpId, patch) => {
    const currentGroups = { ...(pi.presetGroups || {}) };
    const base = currentGroups[grpId] || groupMetaMap[grpId] || {};
    const updatedGroup = { ...base, ...patch };
    if (patch.presetName) updatedGroup.name = patch.presetName;
    if (patch.name) updatedGroup.presetName = patch.name;
    if (patch.kitPrice !== undefined) {
      const kp = parseFloat(patch.kitPrice) || 0;
      const sc = parseFloat(updatedGroup.setCount || 1) || 1;
      updatedGroup.groupSubtotal = kp * sc;
      updatedGroup.taxable = updatedGroup.groupSubtotal;
    }
    currentGroups[grpId] = updatedGroup;
    onUpdatePiData?.({ presetGroups: currentGroups });
  };

  // Compute item totals
  const items = rawItems.map((it, idx) => {
    const q = parseFloat(it.qty) || 1;
    const r = parseFloat(it.rate) || 0;
    const hasPresetGroups = Object.keys(groupMetaMap).length > 0;
    const isPreset = Boolean(it.isPresetItem || it.presetGroupId || (hasPresetGroups && !it.rate));
    let grpId = it.presetGroupId;
    if (isPreset && (!grpId || !groupMetaMap[grpId])) {
      grpId = Object.keys(groupMetaMap)[0] || 'implicit_preset_1';
    }
    const grpMeta = grpId ? groupMetaMap[grpId] : null;

    let isFirstInGroup = false;
    let groupCount = 1;
    let groupItemsIndices = [];
    if (isPreset && grpId) {
      groupItemsIndices = rawItems
        .map((x, i) => ({ x, i }))
        .filter(({ x }) => {
          const xIsPreset = Boolean(x.isPresetItem || x.presetGroupId || (hasPresetGroups && !x.rate));
          let xGrpId = x.presetGroupId;
          if (xIsPreset && (!xGrpId || !groupMetaMap[xGrpId])) {
            xGrpId = Object.keys(groupMetaMap)[0] || 'implicit_preset_1';
          }
          return xIsPreset && xGrpId === grpId;
        })
        .map(o => o.i);

      isFirstInGroup = (groupItemsIndices[0] === idx);
      groupCount = groupItemsIndices.length;
    }

    const presetGroupIndex = grpId ? distinctPrintGroupIds.indexOf(grpId) : -1;
    const presetGroupNum = presetGroupIndex >= 0 ? presetGroupIndex + 1 : 1;
    const groupItemIndex = isPreset && groupItemsIndices.length > 0 ? (groupItemsIndices.indexOf(idx) + 1) : null;
    const displaySNo = isPreset && distinctPrintGroupIds.length > 0
      ? `${presetGroupNum}.${groupItemIndex}`
      : `${idx + 1}`;

    const gross = q * r;
    const discPct = parseFloat(it.discountPct || it.discount) || 0;
    const discAmt = gross * (discPct / 100);
    const taxable = isPreset ? 0 : (gross - discAmt);
    const gRate = parseFloat(String(it.gstRate || grpMeta?.gstRateStr || '18%').replace('%', '')) || 18;
    const gstAmt = isPreset ? 0 : (taxable * (gRate / 100));
    const lineTotal = taxable + gstAmt;

    return {
      rawIndex: idx,
      grpId,
      sNo: idx + 1,
      displaySNo,
      presetGroupNum,
      groupItemIndex,
      totalPresetsCount: distinctPrintGroupIds.length,
      name: it.name || it.productName || 'Item',
      description: it.description || it.specifications || '',
      hsn: it.hsn || '73089090',
      qty: q,
      uom: it.uom || it.unit || 'Nos',
      rate: r,
      discPct,
      taxable,
      gRate,
      gstAmt,
      lineTotal,
      isPresetItem: isPreset,
      presetGroupId: grpId,
      isFirstInGroup,
      groupCount,
      presetName: grpMeta?.presetName || grpMeta?.name || '',
      setCount: grpMeta?.setCount || 1,
      groupPrice: grpMeta?.kitPrice || grpMeta?.groupSubtotal || 0,
      groupTaxable: grpMeta?.groupSubtotal || grpMeta?.taxable || 0,
      groupGst: grpMeta?.groupGst || 0,
      groupGstRateStr: grpMeta?.gstRateStr || `${gRate}%`,
      groupLineTotal: grpMeta?.groupTotal || 0
    };
  });

  const presetSubtotalSum = Object.values(groupMetaMap).reduce((s, g) => s + g.groupSubtotal, 0);
  const presetGstSum = Object.values(groupMetaMap).reduce((s, g) => s + g.groupGst, 0);

  const customSubtotal = items.filter(it => !it.isPresetItem).reduce((sum, item) => sum + item.taxable, 0);
  const customGst = items.filter(it => !it.isPresetItem).reduce((sum, item) => sum + item.gstAmt, 0);

  const subTotal = (presetSubtotalSum + customSubtotal) || (Number(pi.unitValue) || 0);
  const totalGst = (presetGstSum + customGst) || (subTotal * 0.18);
  const grandTotal = subTotal + totalGst;

  // Group GST by rate tier (e.g. 5%, 18%)
  const gstTiersMap = {};

  // From preset groups
  Object.values(groupMetaMap).forEach(grp => {
    const rate = parseFloat(String(grp.gstRateStr || grp.gstRate || '18').replace('%', '')) || 18;
    if (!gstTiersMap[rate]) gstTiersMap[rate] = { rate, taxable: 0, gstAmt: 0 };
    gstTiersMap[rate].taxable += (grp.groupSubtotal || 0);
    gstTiersMap[rate].gstAmt += (grp.groupGst || 0);
  });

  // From custom non-preset line items
  items.filter(it => !it.isPresetItem).forEach(it => {
    const rate = it.gRate || 18;
    if (!gstTiersMap[rate]) gstTiersMap[rate] = { rate, taxable: 0, gstAmt: 0 };
    gstTiersMap[rate].taxable += (it.taxable || 0);
    gstTiersMap[rate].gstAmt += (it.gstAmt || 0);
  });

  const rawGstTiers = Object.values(gstTiersMap)
    .filter(t => t.gstAmt > 0 || t.taxable > 0)
    .sort((a, b) => a.rate - b.rate);

  const gstTiers = rawGstTiers.length > 0
    ? rawGstTiers
    : (totalGst > 0 ? [{ rate: 18, taxable: subTotal, gstAmt: totalGst }] : []);

  const piGst = pi.gstNo || pi.gstin || pi.gst || pi.customerGst || '';
  const piState = (typeof pi.deliveryAddress === 'object' ? pi.deliveryAddress?.state : pi.deliveryState) ||
    (typeof pi.billingAddress === 'object' ? pi.billingAddress?.state : pi.billingState) ||
    pi.state || '';
  const isIntra = isTamilNaduIntra(piGst, piState);

  // Terms array from text lines
  const termsLines = (cfg.termsText || '')
    .split('\n')
    .map(t => t.trim())
    .filter(Boolean);

  // List of all elements that can be hidden/removed and easily restored
  const ALL_ELEMENTS = [
    { key: 'showLogo', label: 'Company Logo' },
    { key: 'showCompanyName', label: 'Company Name' },
    { key: 'showCompanyTagline', label: 'Company Tagline' },
    { key: 'showCompanyAddress', label: 'Company Address' },
    { key: 'showCinGst', label: 'Company GSTIN & CIN' },
    { key: 'showCompanyPhoneEmail', label: 'Company Phone & Email' },
    { key: 'showCompanyWebsite', label: 'Company Website' },
    { key: 'showDocumentTitle', label: 'Document Title' },
    { key: 'showDocNo', label: 'Document Number' },
    { key: 'showDate', label: 'Date' },
    { key: 'showValidUntil', label: 'Valid Until' },
    { key: 'showPaymentTerms', label: 'Payment Terms' },
    { key: 'showPlaceOfSupply', label: 'Place of Supply' },
    { key: 'showSalesExecutive', label: 'Sales Executive' },
    { key: 'showBillTo', label: 'Bill To Block' },
    { key: 'showBuyerAddress', label: 'Buyer Address' },
    { key: 'showBuyerGstin', label: 'Buyer GSTIN' },
    { key: 'showBuyerContact', label: 'Buyer Contact' },
    { key: 'showBuyerPhone', label: 'Buyer Phone' },
    { key: 'showBuyerEmail', label: 'Buyer Email' },
    { key: 'showShipTo', label: 'Ship To Block' },
    { key: 'showTransportDetails', label: 'Transport / LR Details' },
    { key: 'showSnoCol', label: 'S.No Column' },
    { key: 'showHsn', label: 'HSN/SAC Column' },
    { key: 'showQty', label: 'Qty Column' },
    { key: 'showUom', label: 'UOM Column' },
    { key: 'showRateCol', label: 'Rate (₹) Column' },
    { key: 'showDiscountCol', label: 'Discount Column' },
    { key: 'showTaxableCol', label: 'Taxable Column' },
    { key: 'showGstCol', label: 'GST Column' },
    { key: 'showTotalCol', label: 'Total (₹) Column' },
    { key: 'showItemDescription', label: 'Item Description' },
    { key: 'showTotalInWords', label: 'Amount In Words' },
    { key: 'showBankDetails', label: 'Bank Details Box' },
    { key: 'showTerms', label: 'Terms & Conditions' },
    { key: 'showSignatoryStamp', label: 'Signatory & Stamp' },
    { key: 'showCustomerAcceptance', label: 'Customer Acceptance Box' },
    { key: 'showFooterNote', label: 'Bottom Footer Note' }
  ];

  const hiddenElements = ALL_ELEMENTS.filter(item => cfg[item.key] === false);

  return (
    <div
      id={id}
      style={{
        width: '100%',
        maxWidth: '850px',
        backgroundColor: '#FFFFFF',
        color: '#0F172A',
        fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        fontSize: '11.5px',
        lineHeight: '1.4',
        boxSizing: 'border-box',
        boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
        padding: '24px 28px',
        margin: '0 auto',
        borderRadius: '4px'
      }}
    >
      <style>
        {`
          @page {
            size: A4 portrait;
            margin: 10mm 10mm !important;
          }

          @media print {
            /* 1. Reset root HTML & body natural flow */
            html, body {
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }

            /* 2. Completely eliminate #root and background siblings from layout flow so they consume 0px height and don't push content to Page 2 */
            body.vrm-print-portal-active > *:not(.vrm-print-portal-overlay),
            body.vrm-print-portal-active #root,
            body:has(.vrm-print-portal-overlay) > *:not(.vrm-print-portal-overlay),
            body:has(.vrm-print-portal-overlay) #root,
            body > *:not(.vrm-print-portal-overlay) {
              display: none !important;
              height: 0 !important;
              max-height: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
            }

            /* 3. Non-printable interface elements */
            .no-print,
            .vrm-floating-action-toolbar,
            .TemplateCustomizerDrawer,
            .vrm-floating-action-toolbar * {
              display: none !important;
              height: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            /* 4. Portal overlay: Must be static, unpadded, and start at the top of Page 1 */
            .vrm-print-portal-overlay {
              position: static !important;
              display: block !important;
              width: 100% !important;
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              padding: 0 !important;
              margin: 0 !important;
              background: #ffffff !important;
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
              box-shadow: none !important;
              z-index: auto !important;
            }

            .vrm-print-workspace,
            .vrm-print-sheet-container {
              display: block !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
            }

            /* 5. Printable Sheet: Position relative at top:0 to begin immediately on Page 1 and flow across multiple pages */
            #${id} {
              visibility: visible !important;
              position: relative !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              min-height: 0 !important;
              height: auto !important;
              overflow: visible !important;
              box-shadow: none !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              border-radius: 0 !important;
              background: #ffffff !important;
              display: block !important;
            }

            #${id},
            #${id} * {
              visibility: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            #${id} div,
            #${id} section {
              overflow: visible !important;
            }

            .editable-template-field {
              border: none !important;
              border-bottom: none !important;
              background-color: transparent !important;
              padding: 0 !important;
              outline: none !important;
            }

            /* Multi-page table pagination */
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

            tr.preset-group-banner-row {
              page-break-after: avoid !important;
              break-after: avoid !important;
              break-after: avoid-page !important;
            }

            tr.preset-first-item-row,
            tr.preset-group-banner-row + tr {
              page-break-before: avoid !important;
              break-before: avoid !important;
              break-before: avoid-page !important;
            }

            /* Prevent splitting critical blocks like totals, bank details, and stamp */
            .avoid-break,
            .print-avoid-break {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            .page-break {
              page-break-before: always !important;
              break-before: always !important;
            }
          }
          .editable-template-field {
            cursor: text;
            transition: background-color 0.15s ease, outline 0.15s ease;
          }
          .editable-template-field:hover {
            background-color: rgba(14, 116, 144, 0.08) !important;
            border-radius: 3px !important;
            outline: 1px dashed rgba(14, 116, 144, 0.35) !important;
          }
          .editable-template-field:focus {
            background-color: #F0FDFA !important;
            outline: 1.5px solid #0E7490 !important;
            border-radius: 3px !important;
            color: #0F172A !important;
          }
        `}
      </style>

      {/* QUICK RESTORE BAR FOR REMOVED / HIDDEN ELEMENTS */}
      {isEditable && hiddenElements.length > 0 && (
        <div
          className="no-print"
          style={{
            marginBottom: '14px',
            padding: '10px 14px',
            backgroundColor: '#FEF3C7',
            border: '1px solid #FCD34D',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#92400E', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Eye size={13} style={{ color: '#92400E' }} /> Removed Elements ({hiddenElements.length})</span>
              <span style={{ fontSize: '10.5px', fontWeight: '500', color: '#B45309' }}>— Click any pill below to restore it back onto the invoice:</span>
            </span>
            <button
              type="button"
              onClick={() => {
                const restores = {};
                hiddenElements.forEach(item => {
                  restores[item.key] = true;
                });
                onUpdateSetting?.(restores);
              }}
              style={{
                backgroundColor: '#92400E',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '10.5px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Restore All ({hiddenElements.length})
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {hiddenElements.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => onUpdateSetting?.({ [item.key]: true })}
                title={`Restore ${item.label}`}
                style={{
                  backgroundColor: '#FFFFFF',
                  color: '#B45309',
                  border: '1px solid #FDE68A',
                  borderRadius: '14px',
                  padding: '3px 10px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                <span>+ {item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* OUTER BORDER CONTAINER */}
      <div className="vrm-print-outer-box" style={{ border: '1.5px solid #334155', borderRadius: '0px' }}>

        {/* 1. HEADER SECTION (LOGO + COMPANY DETAILS on Left | DOCUMENT TITLE on Right) */}
        <div style={{ padding: '8px 16px', borderBottom: '1.5px solid #334155', backgroundColor: '#FFFFFF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
            {/* LEFT: COMPANY LOGO & INFO */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: '1 1 auto' }}>
              {cfg.showLogo && (
                <RemovableBlock
                  visible={cfg.showLogo}
                  settingKey="showLogo"
                  title="Company Logo"
                  style={{ display: 'inline-flex', alignItems: 'center' }}
                >
                  <div style={{ height: '48px', maxWidth: '180px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', overflow: 'hidden' }}>
                    <img
                      src={cfg.customLogoUrl || (typeof window !== 'undefined' && localStorage.getItem('vrm_constant_logo')) || VRM_OFFICIAL_LOGO}
                      alt={cfg.companyName || 'VRM Structures'}
                      style={{
                        maxHeight: '44px',
                        maxWidth: '180px',
                        width: 'auto',
                        height: 'auto',
                        display: 'block'
                      }}
                      onError={(e) => {
                        e.currentTarget.src = VRM_OFFICIAL_LOGO;
                      }}
                    />
                  </div>
                </RemovableBlock>
              )}
              <div>
                {cfg.showCompanyName && cfg.companyName && (
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#1E3A8A', letterSpacing: '-0.2px', marginBottom: '3px' }}>
                    <EditableText
                      value={cfg.companyName}
                      fallback="VRM Structures India Pvt Ltd."
                      onSave={(v) => onUpdateSetting?.({ companyName: v })}
                      onRemove={() => {
                        onUpdateSetting?.({ showCompanyName: false, companyName: '' });
                        onElementRemoved?.('showCompanyName', 'Company Name');
                      }}
                      removeLabel="Company Name"
                    />
                  </div>
                )}
                {cfg.showContactInfo && (
                  <div style={{ fontSize: '10px', color: '#1E293B', lineHeight: '1.4' }}>
                    {cfg.showCompanyAddress !== false && (
                      <RemovableBlock
                        visible={cfg.showCompanyAddress !== false}
                        settingKey="showCompanyAddress"
                        title="Company Address"
                      >
                        <div style={{ whiteSpace: 'pre-line' }}>
                          <EditableText
                            value={cfg.companyAddressLine1}
                            fallback="1427, GNT Road, Nagappa Industrial Estate,"
                            onSave={(v) => onUpdateSetting?.({ companyAddressLine1: v })}
                          />
                        </div>
                        <div style={{ whiteSpace: 'pre-line' }}>
                          <EditableText
                            value={cfg.companyAddressLine2}
                            fallback={"Puzhal,\nChennai, Tamil Nadu 600066\nIndia"}
                            multiline={true}
                            onSave={(v) => onUpdateSetting?.({ companyAddressLine2: v })}
                          />
                        </div>
                      </RemovableBlock>
                    )}
                    {cfg.showCinGst && (
                      <RemovableBlock
                        visible={cfg.showCinGst}
                        settingKey="showCinGst"
                        title="Company GSTIN"
                      >
                        <div>
                          <strong>GSTIN </strong>
                          <EditableText
                            value={cfg.companyGstin}
                            fallback="33AAGCV4262N1ZZ"
                            onSave={(v) => onUpdateSetting?.({ companyGstin: v })}
                            style={{ fontFamily: 'inherit', fontWeight: 'inherit' }}
                          />
                        </div>
                        {cfg.companyUdyam ? (
                          <div>
                            <EditableText
                              value={cfg.companyUdyam}
                              fallback="MSME/Udyam No"
                              onSave={(v) => onUpdateSetting?.({ companyUdyam: v })}
                            />
                          </div>
                        ) : null}
                      </RemovableBlock>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: PROFORMA INVOICE TITLE */}
            {cfg.showDocumentTitle !== false && (
              <div style={{ textAlign: 'right', flex: '0 0 auto', paddingTop: '6px' }}>
                <RemovableBlock
                  visible={cfg.showDocumentTitle !== false}
                  settingKey="showDocumentTitle"
                  title="Document Title"
                >
                  <div style={{ fontSize: '24px', fontWeight: '500', color: '#0F172A', letterSpacing: '0.2px' }}>
                    <EditableText
                      value={cfg.documentTitle}
                      fallback="Proforma Invoice"
                      onSave={(v) => onUpdateSetting?.({ documentTitle: v })}
                    />
                  </div>
                </RemovableBlock>
              </div>
            )}
          </div>
        </div>

        {/* 2. P.I NO & DATE ROW */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          borderBottom: '1.5px solid #334155',
          backgroundColor: '#FFFFFF',
          fontSize: '11px'
        }}>
          {/* LEFT: P.I No & P.I Date */}
          <div style={{ padding: '5px 14px', borderRight: '1.5px solid #334155' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '70px 10px auto', rowGap: '2px', alignItems: 'center' }}>
              {cfg.showDocNo !== false && (
                <>
                  <div style={{ color: '#0F172A' }}>
                    <EditableText
                      value={cfg.docNoLabel || 'P.I No.'}
                      fallback="P.I No."
                      onSave={(v) => onUpdateSetting?.({ docNoLabel: v })}
                    />
                  </div>
                  <div>:</div>
                  <div style={{ fontWeight: '700', color: '#0F172A' }}>
                    <EditableText
                      value={pi.piNo || 'VRMS/PI/26-27/1943'}
                      fallback="VRMS/PI/26-27/1943"
                      onSave={(v) => onUpdatePiData?.({ piNo: v })}
                    />
                  </div>
                </>
              )}
              {cfg.showDate !== false && (
                <>
                  <div style={{ color: '#0F172A' }}>
                    <EditableText
                      value={cfg.dateLabel || 'P.I Date'}
                      fallback="P.I Date"
                      onSave={(v) => onUpdateSetting?.({ dateLabel: v })}
                    />
                  </div>
                  <div>:</div>
                  <div style={{ fontWeight: '700', color: '#0F172A' }}>
                    <EditableText
                      value={formatDate(pi.piDate)}
                      fallback="23-09-2026"
                      onSave={(v) => onUpdatePiData?.({ piDate: v })}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT: OPTIONAL METADATA (Valid Until, Place of Supply, Sales Exec) */}
          <div style={{ padding: '5px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 10px auto', rowGap: '2px', alignItems: 'center' }}>
              {cfg.showValidUntil && (
                <>
                  <div style={{ color: '#64748B' }}>
                    <EditableText
                      value={cfg.validUntilLabel || 'Valid Until'}
                      fallback="Valid Until"
                      onSave={(v) => onUpdateSetting?.({ validUntilLabel: v })}
                    />
                  </div>
                  <div>:</div>
                  <div style={{ fontWeight: '600', color: '#0F172A' }}>
                    <EditableText
                      value={formatDate(pi.expDate || pi.validUntilDate)}
                      fallback="14-10-2026"
                      onSave={(v) => onUpdatePiData?.({ expDate: v, validUntilDate: v })}
                    />
                  </div>
                </>
              )}
              {cfg.showPlaceOfSupply && (
                <>
                  <div style={{ color: '#64748B' }}>
                    <EditableText
                      value={cfg.placeOfSupplyLabel || 'Place of Supply'}
                      fallback="Place of Supply"
                      onSave={(v) => onUpdateSetting?.({ placeOfSupplyLabel: v })}
                    />
                  </div>
                  <div>:</div>
                  <div style={{ fontWeight: '600', color: '#0F172A' }}>
                    <EditableText
                      value={pi.placeOfSupply || 'Tamil Nadu (33)'}
                      fallback="Tamil Nadu (33)"
                      onSave={(v) => onUpdatePiData?.({ placeOfSupply: v })}
                    />
                  </div>
                </>
              )}
              {cfg.showSalesExecutive && (
                <>
                  <div style={{ color: '#64748B' }}>
                    <EditableText
                      value={cfg.salesExecutiveLabel || 'Sales Executive'}
                      fallback="Sales Executive"
                      onSave={(v) => onUpdateSetting?.({ salesExecutiveLabel: v })}
                    />
                  </div>
                  <div>:</div>
                  <div style={{ fontWeight: '600', color: '#0F172A' }}>
                    <EditableText
                      value={pi.salesPerson || pi.salesperson || 'sales'}
                      fallback="sales"
                      onSave={(v) => onUpdatePiData?.({ salesPerson: v, salesperson: v })}
                    />
                  </div>
                </>
              )}
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
              <EditableText
                value={cfg.billToLabel || 'Bill To'}
                fallback="Bill To"
                onSave={(v) => onUpdateSetting?.({ billToLabel: v })}
              />
            </div>
            <div style={{ padding: '5px 12px', lineHeight: '1.35', color: '#1E293B', fontSize: '10.5px' }}>
              <div style={{ fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', marginBottom: '2px' }}>
                <EditableText
                  value={customerName}
                  fallback="COSMIC POWER SOLUTION"
                  onSave={(v) => onUpdatePiData?.({ customerName: v, vendor: v, vendorName: v })}
                />
              </div>
              {bStreet ? (
                <div>
                  <EditableText
                    value={bStreet}
                    fallback="NO 69, 4TH STREET POOMBUHAR NAGAR"
                    onSave={(v) => onUpdatePiData?.({ billingStreet: v, billingAddress: { ...(pi.billingAddress || {}), street: v } })}
                  />
                </div>
              ) : null}
              {bCity && !bStreetHasCity ? (
                <div>
                  <EditableText
                    value={bCity}
                    fallback="Chennai"
                    onSave={(v) => onUpdatePiData?.({ billingCity: v, billingAddress: { ...(pi.billingAddress || {}), city: v } })}
                  />
                </div>
              ) : null}
              {((bPincode && !bStreetHasPin) || (bState && !bStreetHasState)) ? (
                <div>
                  <EditableText
                    value={`${bPincode && !bStreetHasPin ? `${bPincode} ` : ''}${bState && !bStreetHasState ? bState : ''}`.trim() || `${bPincode} ${bState}`}
                    fallback="600098 Tamil Nadu"
                    onSave={(v) => {
                      const parts = v.trim().split(/\s+/);
                      const maybePin = parts[0] && /^\d{6}$/.test(parts[0]) ? parts[0] : '';
                      const maybeState = maybePin ? parts.slice(1).join(' ') : v;
                      onUpdatePiData?.({ billingPincode: maybePin, billingState: maybeState });
                    }}
                  />
                </div>
              ) : null}
              {!bStreetHasIndia && <div>India</div>}
              {pi.gstNo && (
                <div style={{ marginTop: '2px' }}>
                  <strong>GSTIN </strong>
                  <EditableText
                    value={pi.gstNo}
                    fallback="33AUDPB5369C1Z3"
                    onSave={(v) => onUpdatePiData?.({ gstNo: v })}
                  />
                </div>
              )}
            </div>
          </div>

          {/* SHIP TO */}
          <div>
            <div style={{ padding: '4px 14px', borderBottom: '1px solid #CBD5E1', fontWeight: '700', color: '#0F172A', backgroundColor: '#F8FAFC' }}>
              <EditableText
                value={cfg.shipToLabel || 'Ship To'}
                fallback="Ship To"
                onSave={(v) => onUpdateSetting?.({ shipToLabel: v })}
              />
            </div>
            <div style={{ padding: '5px 12px', lineHeight: '1.35', color: '#1E293B', fontSize: '10.5px' }}>
              <div style={{ fontWeight: '700', color: '#0F172A', marginBottom: '1px' }}>
                <EditableText
                  value={pi.shippingName || pi.contactPerson || customerName}
                  fallback="V N Vigneshwar"
                  onSave={(v) => onUpdatePiData?.({ shippingName: v })}
                />
              </div>
              {(pi.phone || pi.contactPhone) && (
                <div>
                  <EditableText
                    value={`(${pi.phone || pi.contactPhone})`}
                    fallback="(9341 5621 2461)"
                    onSave={(v) => onUpdatePiData?.({ phone: v.replace(/[()]/g, '') })}
                  />
                </div>
              )}
              {dStreet ? (
                <div>
                  <EditableText
                    value={dStreet}
                    fallback="8/90, 4th Street,"
                    onSave={(v) => onUpdatePiData?.({ deliveryStreet: v, deliveryAddress: { ...(pi.deliveryAddress || {}), street: v } })}
                  />
                </div>
              ) : null}
              {dCity && !dStreetHasCity ? (
                <div>
                  <EditableText
                    value={dCity}
                    fallback="Poombugar nagar kolathur, Ambattur,"
                    onSave={(v) => onUpdatePiData?.({ deliveryCity: v, deliveryAddress: { ...(pi.deliveryAddress || {}), city: v } })}
                  />
                </div>
              ) : null}
              {((dPincode && !dStreetHasPin) || (dState && !dStreetHasState)) ? (
                <div>
                  <EditableText
                    value={`${dPincode && !dStreetHasPin ? `${dPincode} ` : ''}${dState && !dStreetHasState ? dState : ''}`.trim() || `${dPincode} ${dState}`}
                    fallback="600098 Tamil Nadu"
                    onSave={(v) => {
                      const parts = v.trim().split(/\s+/);
                      const maybePin = parts[0] && /^\d{6}$/.test(parts[0]) ? parts[0] : '';
                      const maybeState = maybePin ? parts.slice(1).join(' ') : v;
                      onUpdatePiData?.({ deliveryPincode: maybePin, deliveryState: maybeState });
                    }}
                  />
                </div>
              ) : null}
              {!dStreetHasIndia && <div>India</div>}
            </div>
          </div>
        </div>

        {/* 4. LINE ITEMS TABLE */}
        <div style={{ overflowX: 'auto' }}>
          {(() => {
            const hasSno = cfg.showSnoCol !== false;
            const hasDesc = cfg.showItemDescription !== false;
            const hasHsn = cfg.showHsn !== false;
            const hasQty = cfg.showQty !== false;
            const hasRate = cfg.showRateCol !== false;
            const hasGst = cfg.showGstCol !== false;
            const hasAmt = cfg.showTotalCol !== false;

            const computedColSpan = (hasSno ? 1 : 0) +
              (hasDesc ? 1 : 0) +
              (hasHsn ? 1 : 0) +
              (hasQty ? 1 : 0) +
              (hasRate ? 1 : 0) +
              (hasGst ? (isIntra ? 4 : 2) : 0) +
              (hasAmt ? 1 : 0);

            const colHeaderRemoveBtnStyle = {
              position: 'absolute',
              top: '2px',
              right: '2px',
              backgroundColor: '#FEE2E2',
              color: '#DC2626',
              border: '1px solid #FCA5A5',
              borderRadius: '50%',
              width: '13px',
              height: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              lineHeight: '1',
              cursor: 'pointer',
              padding: 0,
              zIndex: 5
            };

            return (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#FFFFFF', color: '#0F172A', fontWeight: '700', textAlign: 'center' }}>
                    {hasSno && (
                      <th rowSpan={hasGst ? 2 : 1} style={{ border: '1px solid #CBD5E1', padding: '4px 3px', width: '30px', position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <EditableText
                            value={cfg.colHeaderSno || '#'}
                            fallback="#"
                            onSave={(v) => onUpdateSetting?.({ colHeaderSno: v })}
                          />
                          {isEditable && (
                            <button
                              type="button"
                              className="no-print"
                              onClick={() => {
                                onUpdateSetting?.({ showSnoCol: false });
                                onElementRemoved?.('showSnoCol', 'S.No Column');
                              }}
                              title="Remove S.No Column"
                              style={colHeaderRemoveBtnStyle}
                            >×</button>
                          )}
                        </div>
                      </th>
                    )}
                    {hasDesc && (
                      <th rowSpan={hasGst ? 2 : 1} style={{ border: '1px solid #CBD5E1', padding: '4px 6px', textAlign: 'left', position: 'relative' }}>
                        <EditableText
                          value={cfg.itemColLabel || 'Item & Description'}
                          fallback="Item & Description"
                          onSave={(v) => onUpdateSetting?.({ itemColLabel: v })}
                        />
                      </th>
                    )}
                    {hasHsn && (
                      <th rowSpan={hasGst ? 2 : 1} style={{ border: '1px solid #CBD5E1', padding: '4px 3px', width: '70px', position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <EditableText
                            value={cfg.hsnColLabel || 'HSN/SAC'}
                            fallback="HSN/SAC"
                            onSave={(v) => onUpdateSetting?.({ hsnColLabel: v })}
                          />
                          {isEditable && (
                            <button
                              type="button"
                              className="no-print"
                              onClick={() => {
                                onUpdateSetting?.({ showHsn: false });
                                onElementRemoved?.('showHsn', 'HSN Column');
                              }}
                              title="Remove HSN Column"
                              style={colHeaderRemoveBtnStyle}
                            >×</button>
                          )}
                        </div>
                      </th>
                    )}
                    {hasQty && (
                      <th rowSpan={hasGst ? 2 : 1} style={{ border: '1px solid #CBD5E1', padding: '4px 3px', width: '50px', position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <EditableText
                            value={cfg.qtyColLabel || 'Qty'}
                            fallback="Qty"
                            onSave={(v) => onUpdateSetting?.({ qtyColLabel: v })}
                          />
                          {isEditable && (
                            <button
                              type="button"
                              className="no-print"
                              onClick={() => {
                                onUpdateSetting?.({ showQty: false });
                                onElementRemoved?.('showQty', 'Quantity Column');
                              }}
                              title="Remove Quantity Column"
                              style={colHeaderRemoveBtnStyle}
                            >×</button>
                          )}
                        </div>
                      </th>
                    )}
                    {hasRate && (
                      <th rowSpan={hasGst ? 2 : 1} style={{ border: '1px solid #CBD5E1', padding: '4px 6px', width: '75px', textAlign: 'right', position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <EditableText
                            value={cfg.rateColLabel || 'Rate'}
                            fallback="Rate"
                            onSave={(v) => onUpdateSetting?.({ rateColLabel: v })}
                          />
                          {isEditable && (
                            <button
                              type="button"
                              className="no-print"
                              onClick={() => {
                                onUpdateSetting?.({ showRateCol: false });
                                onElementRemoved?.('showRateCol', 'Rate Column');
                              }}
                              title="Remove Rate Column"
                              style={colHeaderRemoveBtnStyle}
                            >×</button>
                          )}
                        </div>
                      </th>
                    )}
                    {hasGst && (
                      isIntra ? (
                        <>
                          <th colSpan={2} style={{ border: '1px solid #CBD5E1', padding: '3px 4px', position: 'relative' }}>
                            CGST
                            {isEditable && (
                              <button
                                type="button"
                                className="no-print"
                                onClick={() => {
                                  onUpdateSetting?.({ showGstCol: false });
                                  onElementRemoved?.('showGstCol', 'GST Columns');
                                }}
                                title="Remove GST Columns"
                                style={colHeaderRemoveBtnStyle}
                              >×</button>
                            )}
                          </th>
                          <th colSpan={2} style={{ border: '1px solid #CBD5E1', padding: '3px 4px' }}>SGST</th>
                        </>
                      ) : (
                        <th colSpan={2} style={{ border: '1px solid #CBD5E1', padding: '3px 4px', position: 'relative' }}>
                          IGST
                          {isEditable && (
                            <button
                              type="button"
                              className="no-print"
                              onClick={() => {
                                onUpdateSetting?.({ showGstCol: false });
                                onElementRemoved?.('showGstCol', 'GST Columns');
                              }}
                              title="Remove GST Columns"
                              style={colHeaderRemoveBtnStyle}
                            >×</button>
                          )}
                        </th>
                      )
                    )}
                    {hasAmt && (
                      <th rowSpan={hasGst ? 2 : 1} style={{ border: '1px solid #CBD5E1', padding: '4px 6px', width: '80px', textAlign: 'right' }}>
                        <EditableText
                          value={cfg.amountColLabel || 'Amount'}
                          fallback="Amount"
                          onSave={(v) => onUpdateSetting?.({ amountColLabel: v })}
                        />
                      </th>
                    )}
                  </tr>
                  {hasGst && (
                    <tr style={{ backgroundColor: '#FFFFFF', color: '#0F172A', fontWeight: '700', textAlign: 'center' }}>
                      {isIntra ? (
                        <>
                          <th style={{ border: '1px solid #CBD5E1', padding: '2px 3px', width: '40px' }}>%</th>
                          <th style={{ border: '1px solid #CBD5E1', padding: '2px 5px', width: '60px', textAlign: 'right' }}>Amt</th>
                          <th style={{ border: '1px solid #CBD5E1', padding: '2px 3px', width: '40px' }}>%</th>
                          <th style={{ border: '1px solid #CBD5E1', padding: '2px 5px', width: '60px', textAlign: 'right' }}>Amt</th>
                        </>
                      ) : (
                        <>
                          <th style={{ border: '1px solid #CBD5E1', padding: '2px 3px', width: '40px' }}>%</th>
                          <th style={{ border: '1px solid #CBD5E1', padding: '2px 5px', width: '70px', textAlign: 'right' }}>Amt</th>
                        </>
                      )}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <React.Fragment key={idx}>
                      {it.isFirstInGroup && (
                        <tr
                          className="preset-group-banner-row"
                          style={{
                            backgroundColor: '#F8FAFC',
                            pageBreakAfter: 'avoid',
                            breakAfter: 'avoid',
                            pageBreakBefore: (it.presetGroupNum > 1 && idx > 5) ? 'always' : 'auto',
                            breakBefore: (it.presetGroupNum > 1 && idx > 5) ? 'page' : 'auto'
                          }}
                        >
                          <td
                            colSpan={computedColSpan || (isIntra ? 10 : 8)}
                            style={{
                              border: '1px solid #CBD5E1',
                              padding: '3px 8px',
                              backgroundColor: it.presetGroupNum % 2 === 1 ? '#F0FDFA' : '#EEF2FF',
                              borderTop: `2px solid ${it.presetGroupNum % 2 === 1 ? '#0E7490' : '#6366F1'}`
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: '800', color: it.presetGroupNum % 2 === 1 ? '#0E7490' : '#4338CA', fontSize: '10px' }}>
                                PRESET {it.presetGroupNum}:{' '}
                                <EditableText
                                  value={it.presetName}
                                  fallback="Solar Structure MMS Kit"
                                  onSave={(v) => {
                                    if (it.grpId) handleUpdatePresetGroup(it.grpId, { presetName: v, name: v });
                                  }}
                                />
                                {' '}({it.setCount || 1} Set{(it.setCount || 1) > 1 ? 's' : ''} — {it.groupCount} Components)
                              </span>
                              <span style={{ fontSize: '9px', color: '#475569', fontWeight: '700' }}>
                                Kit Subtotal: ₹{Number(it.groupPrice || it.groupTaxable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr
                        className={it.isFirstInGroup ? 'preset-first-item-row' : ''}
                        style={{
                          verticalAlign: 'top',
                          pageBreakBefore: it.isFirstInGroup ? 'avoid' : 'auto',
                          breakBefore: it.isFirstInGroup ? 'avoid' : 'auto'
                        }}
                      >
                        {hasSno && (
                          <td style={{ border: '1px solid #CBD5E1', padding: '2.5px 3px', textAlign: 'center', color: '#334155', fontWeight: it.isPresetItem ? '700' : 'normal', fontSize: '9.5px' }}>
                            {it.displaySNo || it.sNo}
                          </td>
                        )}
                        {hasDesc && (
                          <td style={{ border: '1px solid #CBD5E1', padding: '2.5px 6px' }}>
                            <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '10px', lineHeight: '1.2' }}>
                              <EditableText
                                value={it.name}
                                fallback="Item Name"
                                onSave={(v) => handleUpdateItem(it.rawIndex !== undefined ? it.rawIndex : idx, { name: v })}
                              />
                            </div>
                            {it.description ? (
                              <div style={{ fontSize: '8.5px', color: '#475569', marginTop: '1px', whiteSpace: 'pre-line', lineHeight: '1.15' }}>
                                <EditableText
                                  value={it.description}
                                  fallback=""
                                  placeholder=""
                                  multiline={true}
                                  onSave={(v) => handleUpdateItem(it.rawIndex !== undefined ? it.rawIndex : idx, { description: v })}
                                />
                              </div>
                            ) : isEditable ? (
                              <div className="no-print" style={{ fontSize: '7.5px', color: '#94A3B8', marginTop: '1px' }}>
                                <EditableText
                                  value=""
                                  fallback=""
                                  placeholder="+ desc"
                                  multiline={true}
                                  onSave={(v) => handleUpdateItem(it.rawIndex !== undefined ? it.rawIndex : idx, { description: v })}
                                />
                              </div>
                            ) : null}
                          </td>
                        )}
                        {hasHsn && (
                          <td style={{ border: '1px solid #CBD5E1', padding: '2.5px 3px', textAlign: 'center', fontFamily: 'monospace', fontSize: '9px', verticalAlign: it.isPresetItem ? 'middle' : 'top' }}>
                            <EditableText
                              value={it.hsn || '73089090'}
                              fallback="73089090"
                              onSave={(v) => handleUpdateItem(it.rawIndex !== undefined ? it.rawIndex : idx, { hsn: v })}
                            />
                          </td>
                        )}
                        {hasQty && (
                          <td style={{ border: '1px solid #CBD5E1', padding: '2.5px 3px', textAlign: 'center', fontSize: '9px', verticalAlign: it.isPresetItem ? 'middle' : 'top' }}>
                            <div>
                              <EditableText
                                value={typeof it.qty === 'number' ? it.qty.toFixed(2) : String(it.qty || '1')}
                                fallback="1.00"
                                onSave={(v) => {
                                  const n = parseFloat(v);
                                  handleUpdateItem(it.rawIndex !== undefined ? it.rawIndex : idx, { qty: isNaN(n) ? v : n });
                                }}
                              />
                            </div>
                            <div style={{ fontSize: '8px', color: '#64748B' }}>
                              <EditableText
                                value={it.uom || "no's"}
                                fallback="NOS"
                                onSave={(v) => handleUpdateItem(it.rawIndex !== undefined ? it.rawIndex : idx, { uom: v })}
                              />
                            </div>
                          </td>
                        )}

                        {/* RATE COLUMN: Merged vertically in the middle for Preset Kit */}
                        {hasRate && (
                          it.isPresetItem ? (
                            it.isFirstInGroup ? (
                              <td
                                rowSpan={it.groupCount}
                                style={{
                                  border: '1px solid #CBD5E1',
                                  padding: '4px 6px',
                                  textAlign: 'right',
                                  fontSize: '10.5px',
                                  verticalAlign: 'middle',
                                  backgroundColor: '#FFFFFF',
                                  fontWeight: '700'
                                }}
                              >
                                <div style={{ color: '#0F172A' }}>
                                  <EditableText
                                    value={Number(it.groupPrice || it.groupTaxable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    fallback="0.00"
                                    onSave={(v) => {
                                      const num = parseFloat(v.replace(/[^0-9.]/g, ''));
                                      if (!isNaN(num) && it.grpId) {
                                        handleUpdatePresetGroup(it.grpId, { kitPrice: num / (it.setCount || 1) });
                                      }
                                    }}
                                  />
                                </div>
                              </td>
                            ) : null
                          ) : (
                            <td style={{ border: '1px solid #CBD5E1', padding: '2.5px 6px', textAlign: 'right', fontSize: '9.5px', verticalAlign: 'top' }}>
                              <EditableText
                                value={Number(it.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                fallback="0.00"
                                onSave={(v) => {
                                  const num = parseFloat(v.replace(/[^0-9.]/g, ''));
                                  if (!isNaN(num)) handleUpdateItem(it.rawIndex !== undefined ? it.rawIndex : idx, { rate: num });
                                }}
                              />
                            </td>
                          )
                        )}

                        {/* TAX COLUMNS: Merged vertically in the middle for Preset Kit */}
                        {hasGst && (
                          isIntra ? (
                            it.isPresetItem ? (
                              it.isFirstInGroup ? (
                                <>
                                  <td
                                    rowSpan={it.groupCount}
                                    style={{ border: '1px solid #CBD5E1', padding: '4px 3px', textAlign: 'center', fontSize: '9.5px', verticalAlign: 'middle', backgroundColor: '#FFFFFF' }}
                                  >
                                    {it.gRate ? `${(it.gRate / 2).toFixed(1).replace(/\.0$/, '')}%` : '9%'}
                                  </td>
                                  <td
                                    rowSpan={it.groupCount}
                                    style={{ border: '1px solid #CBD5E1', padding: '4px 5px', textAlign: 'right', fontSize: '10px', verticalAlign: 'middle', backgroundColor: '#FFFFFF', fontWeight: '600' }}
                                  >
                                    {((it.groupGst || (it.groupTaxable * (it.gRate / 100))) / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td
                                    rowSpan={it.groupCount}
                                    style={{ border: '1px solid #CBD5E1', padding: '4px 3px', textAlign: 'center', fontSize: '9.5px', verticalAlign: 'middle', backgroundColor: '#FFFFFF' }}
                                  >
                                    {it.gRate ? `${(it.gRate / 2).toFixed(1).replace(/\.0$/, '')}%` : '9%'}
                                  </td>
                                  <td
                                    rowSpan={it.groupCount}
                                    style={{ border: '1px solid #CBD5E1', padding: '4px 5px', textAlign: 'right', fontSize: '10px', verticalAlign: 'middle', backgroundColor: '#FFFFFF', fontWeight: '600' }}
                                  >
                                    {((it.groupGst || (it.groupTaxable * (it.gRate / 100))) / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                </>
                              ) : null
                            ) : (
                              <>
                                <td style={{ border: '1px solid #CBD5E1', padding: '2.5px 3px', textAlign: 'center', fontSize: '9px', verticalAlign: 'top' }}>
                                  {it.gRate ? `${(it.gRate / 2).toFixed(1).replace(/\.0$/, '')}%` : '2.5%'}
                                </td>
                                <td style={{ border: '1px solid #CBD5E1', padding: '2.5px 5px', textAlign: 'right', fontSize: '9px', verticalAlign: 'top' }}>
                                  {(it.gstAmt / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td style={{ border: '1px solid #CBD5E1', padding: '2.5px 3px', textAlign: 'center', fontSize: '9px', verticalAlign: 'top' }}>
                                  {it.gRate ? `${(it.gRate / 2).toFixed(1).replace(/\.0$/, '')}%` : '2.5%'}
                                </td>
                                <td style={{ border: '1px solid #CBD5E1', padding: '2.5px 5px', textAlign: 'right', fontSize: '9px', verticalAlign: 'top' }}>
                                  {(it.gstAmt / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </>
                            )
                          ) : (
                            it.isPresetItem ? (
                              it.isFirstInGroup ? (
                                <>
                                  <td
                                    rowSpan={it.groupCount}
                                    style={{ border: '1px solid #CBD5E1', padding: '4px 3px', textAlign: 'center', fontSize: '9.5px', verticalAlign: 'middle', backgroundColor: '#FFFFFF' }}
                                  >
                                    {it.gRate ? `${it.gRate}%` : '18%'}
                                  </td>
                                  <td
                                    rowSpan={it.groupCount}
                                    style={{ border: '1px solid #CBD5E1', padding: '4px 5px', textAlign: 'right', fontSize: '10px', verticalAlign: 'middle', backgroundColor: '#FFFFFF', fontWeight: '600' }}
                                  >
                                    {(it.groupGst || (it.groupTaxable * (it.gRate / 100))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                </>
                              ) : null
                            ) : (
                              <>
                                <td style={{ border: '1px solid #CBD5E1', padding: '2.5px 3px', textAlign: 'center', fontSize: '9px', verticalAlign: 'top' }}>
                                  {it.gRate ? `${it.gRate}%` : '5%'}
                                </td>
                                <td style={{ border: '1px solid #CBD5E1', padding: '2.5px 5px', textAlign: 'right', fontSize: '9px', verticalAlign: 'top' }}>
                                  {(it.gstAmt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </>
                            )
                          )
                        )}

                        {/* AMOUNT COLUMN: Merged vertically in the middle for Preset Kit */}
                        {hasAmt && (
                          it.isPresetItem ? (
                            it.isFirstInGroup ? (
                              <td
                                rowSpan={it.groupCount}
                                style={{
                                  border: '1px solid #CBD5E1',
                                  padding: '4px 6px',
                                  textAlign: 'right',
                                  fontWeight: '800',
                                  color: '#0F172A',
                                  fontSize: '10.5px',
                                  verticalAlign: 'middle',
                                  backgroundColor: '#FFFFFF'
                                }}
                              >
                                <EditableText
                                  value={Number(it.groupTaxable || it.groupPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  fallback="0.00"
                                  onSave={(v) => {
                                    const num = parseFloat(v.replace(/[^0-9.]/g, ''));
                                    if (!isNaN(num) && it.grpId) {
                                      handleUpdatePresetGroup(it.grpId, { kitPrice: num / (it.setCount || 1) });
                                    }
                                  }}
                                />
                              </td>
                            ) : null
                          ) : (
                            <td style={{ border: '1px solid #CBD5E1', padding: '2.5px 6px', textAlign: 'right', fontWeight: '600', color: '#0F172A', fontSize: '9.5px', verticalAlign: 'top' }}>
                              <EditableText
                                value={Number(it.taxable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                fallback="0.00"
                                onSave={(v) => {
                                  const num = parseFloat(v.replace(/[^0-9.]/g, ''));
                                  if (!isNaN(num)) handleUpdateItem(it.rawIndex !== undefined ? it.rawIndex : idx, { amount: num });
                                }}
                              />
                            </td>
                          )
                        )}
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            );
          })()}
        </div>

        {/* BOM TOTAL QUANTITY FOOTER */}
        {isBomDocument && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid #CBD5E1', backgroundColor: '#F8FAFC' }}>
            <span style={{ color: '#64748B', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', marginRight: '16px' }}>Total Quantity:</span>
            <span style={{ color: accent, fontSize: '13px', fontWeight: '900' }}>
              {items.reduce((sum, it) => sum + (parseFloat(it.qty) || 0), 0)}
            </span>
          </div>
        )}

        {/* 5. BOTTOM SECTION: WORDS + NOTES + TERMS ON LEFT | TOTALS + STAMP ON RIGHT */}
        {isBomDocument ? (
          <div className="avoid-break" style={{ borderTop: '1.5px solid #334155', paddingTop: '16px', marginTop: '28px', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ textAlign: 'center', minWidth: '220px' }}>
              <div style={{ height: '45px' }}></div>
              <div style={{ borderTop: '1.5px dashed #94A3B8', paddingTop: '6px', width: '100%' }}>
                <strong style={{ color: '#0F172A', fontSize: '11.5px', display: 'block' }}>For VRM Structures India Pvt Ltd</strong>
                <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '3px' }}>Authorized Signatory</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="avoid-break" style={{ display: 'grid', gridTemplateColumns: '58% 42%', borderTop: '1.5px solid #334155', backgroundColor: '#FFFFFF' }}>
            {/* LEFT: WORDS + NOTES + TERMS */}
            <div style={{ borderRight: '1.5px solid #334155' }}>
              {/* TOTAL IN WORDS */}
              {cfg.showTotalInWords && (
                <div style={{ padding: '8px 12px', borderBottom: '1px solid #CBD5E1' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#0F172A', marginBottom: '2px' }}>Total In Words</div>
                  <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#0F172A', lineHeight: '1.3' }}>
                    {numberToWordsINR(grandTotal)}
                  </div>
                </div>
              )}

              {/* NOTES / ACCOUNT DETAILS */}
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #CBD5E1' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#0F172A', marginBottom: '3px' }}>Notes</div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#1E293B', marginBottom: '2px' }}>
                  <EditableText
                    value={cfg.bankHeading || 'Account Details:'}
                    fallback="Account Details:"
                    onSave={(v) => onUpdateSetting?.({ bankHeading: v })}
                  />
                </div>
                <div style={{ fontSize: '10px', color: '#1E293B', lineHeight: '1.4' }}>
                  <div>
                    Beneficiary: <EditableText value={cfg.bankBeneficiary || 'VRM Structures India Private Limited'} fallback="VRM Structures India Private Limited" onSave={(v) => onUpdateSetting?.({ bankBeneficiary: v })} />
                  </div>
                  <div>
                    A/c No: <EditableText value={cfg.bankAccountNo || '50200031629272'} fallback="50200031629272" onSave={(v) => onUpdateSetting?.({ bankAccountNo: v })} style={{ fontWeight: '700' }} />
                  </div>
                  <div>
                    Bank: <EditableText value={cfg.bankName || 'HDFC Bank'} fallback="HDFC Bank" onSave={(v) => onUpdateSetting?.({ bankName: v })} />
                  </div>
                  <div>
                    Branch: <EditableText value={cfg.bankBranch || 'Kodambakkam'} fallback="Kodambakkam" onSave={(v) => onUpdateSetting?.({ bankBranch: v })} />
                  </div>
                  <div>
                    IFSC: <EditableText value={cfg.bankIfsc || 'HDFC0000574'} fallback="HDFC0000574" onSave={(v) => onUpdateSetting?.({ bankIfsc: v })} style={{ fontWeight: '700' }} />
                  </div>
                </div>
              </div>

              {/* TERMS & CONDITIONS */}
              {cfg.showTerms && (
                <div style={{ padding: '8px 12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#0F172A', marginBottom: '3px' }}>
                    <EditableText
                      value={cfg.termsHeading || 'Terms & Conditions'}
                      fallback="Terms & Conditions"
                      onSave={(v) => onUpdateSetting?.({ termsHeading: v })}
                    />
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#1E293B', lineHeight: '1.45', whiteSpace: 'pre-line' }}>
                    <EditableText
                      value={cfg.termsText}
                      fallback="1. TAX: Included\n2. Transport: At actuals\n3. Payment: 100% along with the Purchase Order\n4. Delivery: Immediate Dispatch\n5. Validity: 3 days"
                      multiline={true}
                      onSave={(v) => onUpdateSetting?.({ termsText: v })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: TOTALS SUMMARY + STAMP & SIGNATURE */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* TOTALS TABLE */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', borderBottom: '1px solid #CBD5E1' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '5px 12px', color: '#1E293B' }}>Sub Total</td>
                    <td style={{ padding: '5px 12px', textAlign: 'right', fontWeight: '600', color: '#0F172A' }}>
                      {subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                  {isIntra ? (
                    gstTiers.map((tier) => (
                      <React.Fragment key={tier.rate}>
                        <tr>
                          <td style={{ padding: '4px 12px', color: '#1E293B' }}>
                            CGST{(tier.rate / 2).toFixed(1).replace(/\.0$/, '')} ({(tier.rate / 2).toFixed(1).replace(/\.0$/, '')}%)
                          </td>
                          <td style={{ padding: '4px 12px', textAlign: 'right', color: '#0F172A' }}>
                            {(tier.gstAmt / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: '4px 12px', color: '#1E293B' }}>
                            SGST{(tier.rate / 2).toFixed(1).replace(/\.0$/, '')} ({(tier.rate / 2).toFixed(1).replace(/\.0$/, '')}%)
                          </td>
                          <td style={{ padding: '4px 12px', textAlign: 'right', color: '#0F172A' }}>
                            {(tier.gstAmt / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </React.Fragment>
                    ))
                  ) : (
                    gstTiers.map((tier) => (
                      <tr key={tier.rate}>
                        <td style={{ padding: '4px 12px', color: '#1E293B' }}>
                          IGST{tier.rate} ({tier.rate}%)
                        </td>
                        <td style={{ padding: '4px 12px', textAlign: 'right', color: '#0F172A' }}>
                          {tier.gstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                  {Math.abs(Math.round(grandTotal) - grandTotal) > 0.001 && (
                    <tr>
                      <td style={{ padding: '4px 12px', color: '#1E293B' }}>Rounding</td>
                      <td style={{ padding: '4px 12px', textAlign: 'right', color: '#0F172A' }}>
                        {(Math.round(grandTotal) - grandTotal).toFixed(2)}
                      </td>
                    </tr>
                  )}
                  <tr style={{ borderTop: '1px solid #CBD5E1', fontWeight: '800' }}>
                    <td style={{ padding: '6px 12px', color: '#0F172A' }}>Total</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: '#0F172A', fontSize: '11px' }}>
                      ₹{Math.round(grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* STAMP & SIGNATURE BOX */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center',
                padding: '16px 12px 10px 12px',
                minHeight: '140px',
                position: 'relative'
              }}>
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
                    src={cfg.customStampUrl || (typeof window !== 'undefined' && localStorage.getItem('vrm_constant_stamp')) || VRM_OFFICIAL_STAMP}
                    alt="VRM Structures Official Stamp"
                    style={{
                      height: '115px',
                      width: '115px',
                      objectFit: 'contain'
                    }}
                  />
                  {/* Optional Custom Signature overlay (Only shown if custom signature image uploaded) */}
                  {cfg.signatureMode === 'custom' && cfg.customSignatureUrl && (
                    <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
                      <img
                        src={cfg.customSignatureUrl}
                        alt="Signature"
                        style={{ height: '40px', width: 'auto', objectFit: 'contain' }}
                      />
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '10px', fontWeight: '600', color: '#1E293B', marginTop: '6px', textAlign: 'center' }}>
                  <EditableText
                    value={cfg.signatoryTitle || 'Authorized Signatory'}
                    fallback="Authorized Signatory"
                    onSave={(v) => onUpdateSetting?.({ signatoryTitle: v })}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* PAGE NUMBER (BOTTOM RIGHT) */}
      <div style={{ textAlign: 'right', fontSize: '9px', color: '#64748B', marginTop: '4px', paddingRight: '2px' }}>
        1
      </div>

      {/* FOOTER NOTICE */}
      {cfg.showFooterNote !== false && cfg.footerNote && (
        <RemovableBlock
          visible={cfg.showFooterNote !== false}
          settingKey="showFooterNote"
          title="Footer Note"
          style={{ marginTop: '10px', textAlign: 'center', fontSize: '9.5px', color: '#64748B' }}
        >
          <EditableText
            value={cfg.footerNote}
            fallback="This is a Computer Generated Proforma Invoice and does not require physical signature unless requested."
            onSave={(v) => onUpdateSetting?.({ footerNote: v })}
            onRemove={() => {
              onUpdateSetting?.({ showFooterNote: false });
              onElementRemoved?.('showFooterNote', 'Footer Note');
            }}
            removeLabel="Footer Note"
          />
        </RemovableBlock>
      )}
    </div>
  );
}

/**
 * Customizer Drawer Panel for Live Template Editing
 */
function TemplateCustomizerDrawer({
  settings,
  onUpdateSettings,
  onSaveAsDefault,
  onResetDefaults,
  onClose
}) {
  const [activeTab, setActiveTab] = useState('branding'); // branding | stampSign | columns | sections | banking
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingStamp, setIsUploadingStamp] = useState(false);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);

  const logoInputRef = useRef(null);
  const stampInputRef = useRef(null);
  const signatureInputRef = useRef(null);

  const handleSave = () => {
    onSaveAsDefault();
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2500);
  };

  // Upload handlers
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingLogo(true);
      const dataUrl = await compressImageFile(file, 450, 0.85);
      try {
        localStorage.setItem('vrm_constant_logo', dataUrl);
      } catch (err) {}
      onUpdateSettings({ customLogoUrl: dataUrl, showLogo: true, logoHeight: 56 });
    } catch (err) {
      alert('Failed to upload logo: ' + err.message);
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleStampUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingStamp(true);
      const dataUrl = await compressImageFile(file, 350, 0.85);
      try {
        localStorage.setItem('vrm_constant_stamp', dataUrl);
      } catch (err) {}
      onUpdateSettings({ customStampUrl: dataUrl, stampMode: 'custom', showSignatoryStamp: true, stampSize: 230 });
    } catch (err) {
      alert('Failed to upload stamp: ' + err.message);
    } finally {
      setIsUploadingStamp(false);
      if (stampInputRef.current) stampInputRef.current.value = '';
    }
  };

  const handleSignatureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingSignature(true);
      const dataUrl = await compressImageFile(file, 350, 0.85);
      onUpdateSettings({ customSignatureUrl: dataUrl, signatureMode: 'custom', showSignatoryStamp: true });
    } catch (err) {
      alert('Failed to upload signature: ' + err.message);
    } finally {
      setIsUploadingSignature(false);
      if (signatureInputRef.current) signatureInputRef.current.value = '';
    }
  };

  return (
    <div
      className="no-print"
      style={{
        width: '390px',
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        boxShadow: '0 20px 35px -5px rgba(0,0,0,0.25)',
        border: '1px solid #CBD5E1',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 90px)',
        maxHeight: '800px',
        position: 'sticky',
        top: '20px',
        overflow: 'hidden',
        zIndex: 10
      }}
    >
      {/* DRAWER HEADER */}
      <div style={{
        padding: '14px 18px',
        backgroundColor: '#0F172A',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #334155'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={17} style={{ color: '#38BDF8' }} />
          <div>
            <div style={{ fontWeight: '800', fontSize: '13.5px' }}>Customize Template</div>
            <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>Custom Logo, Stamp, Signature & Layout</div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* TAB NAVIGATION */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        backgroundColor: '#F8FAFC',
        borderBottom: '1px solid #E2E8F0',
        padding: '4px'
      }}>
        {[
          { id: 'branding', label: 'Logo & Colors', icon: Palette },
          { id: 'stampSign', label: 'Stamp & Sign', icon: PenTool },
          { id: 'columns', label: 'Columns', icon: Layers },
          { id: 'sections', label: 'Sections', icon: Eye },
          { id: 'banking', label: 'Banking', icon: CreditCard }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '7px 2px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                color: isActive ? '#0E7490' : '#64748B',
                fontWeight: isActive ? '700' : '600',
                fontSize: '10.5px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              <Icon size={13} />
              <span style={{ fontSize: '9.5px', textAlign: 'center' }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SCROLLABLE SETTINGS CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

        {/* TAB 1: BRANDING, LOGO & THEME */}
        {activeTab === 'branding' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* COMPANY LOGO SECTION */}
            <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Image size={14} style={{ color: '#0E7490' }} /> Company Logo
                </span>
                <label htmlFor="vrmproforma-invoice-print-template-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748B', cursor: 'pointer' }}>
                  <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                    type="checkbox"
                    checked={settings.showLogo}
                    onChange={(e) => onUpdateSettings({ showLogo: e.target.checked })}
                    style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
                   />
                  <span>Show</span>
                </label>
              </div>

              {settings.showLogo && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Current Logo Preview */}
                  <div style={{
                    padding: '8px 12px',
                    backgroundColor: '#FFFFFF',
                    border: '1px dashed #CBD5E1',
                    borderRadius: '6px',
                    textAlign: 'center',
                    minHeight: '56px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img
                      src={settings.customLogoUrl || '/vrm_logo.png'}
                      alt="Logo Preview"
                      style={{ maxHeight: '48px', maxWidth: '180px', objectFit: 'contain' }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>

                  {/* Logo Actions */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input id="vrmproforma-invoice-print-template-input-1" name="input1" aria-label="Input 1"
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleLogoUpload}
                     />
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      disabled={isUploadingLogo}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        backgroundColor: '#0E7490',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Upload size={13} /> {isUploadingLogo ? 'Processing...' : (settings.customLogoUrl ? 'Change Logo' : 'Upload Logo')}
                    </button>

                    {settings.customLogoUrl && (
                      <button
                        onClick={() => onUpdateSettings({ customLogoUrl: null })}
                        title="Reset to default VRM logo"
                        style={{
                          padding: '6px 10px',
                          backgroundColor: '#FEE2E2',
                          color: '#DC2626',
                          border: '1px solid #FCA5A5',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Trash2 size={12} /> Reset
                      </button>
                    )}
                  </div>

                  {/* Fixed Logo Size (Locked) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: '#64748B',
                    backgroundColor: '#FFFFFF',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0'
                  }}>
                    <span style={{ fontWeight: '600' }}>Logo Dimensions:</span>
                    <span style={{ fontWeight: '700', color: '#0E7490', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      🔒 Fixed Standard (56px)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ACCENT COLOR */}
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '8px' }}>
                Brand Accent Color
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {COLOR_PRESETS.map(preset => {
                  const isSelected = settings.accentColor === preset.hex;
                  return (
                    <button
                      key={preset.hex}
                      onClick={() => onUpdateSettings({ accentColor: preset.hex })}
                      style={{
                        padding: '6px 8px',
                        border: isSelected ? `2px solid ${preset.hex}` : '1px solid #E2E8F0',
                        borderRadius: '6px',
                        backgroundColor: isSelected ? `${preset.hex}10` : '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        fontWeight: isSelected ? '700' : '500',
                        color: '#1E293B'
                      }}
                    >
                      <span style={{ width: '13px', height: '13px', borderRadius: '50%', backgroundColor: preset.hex, display: 'inline-block' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DOCUMENT TITLE */}
            <div>
              <label htmlFor="vrmproforma-invoice-print-template-document-title" style={{ fontSize: '11.5px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '6px' }}>
                Document Title
              </label>
              <input id="vrmproforma-invoice-print-template-document-title" name="documentTitle" aria-label="Document Title"
                type="text"
                value={settings.documentTitle}
                onChange={(e) => onUpdateSettings({ documentTitle: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#0F172A',
                  boxSizing: 'border-box'
                }}
               />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                {TITLE_PRESETS.map(preset => (
                  <button
                    key={preset}
                    onClick={() => onUpdateSettings({ documentTitle: preset })}
                    style={{
                      fontSize: '10px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: settings.documentTitle === preset ? '#ECFEFF' : '#F8FAFC',
                      color: settings.documentTitle === preset ? '#0E7490' : '#475569',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* BRAND DETAILS TOGGLES */}
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#0F172A' }}>Header Display Options</label>

              <label htmlFor="vrmproforma-invoice-print-template-show-gstin-cin" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '11.5px', color: '#334155' }}>
                <span>Show GSTIN & CIN Numbers</span>
                <input id="vrmproforma-invoice-print-template-show-gstin-cin" name="showGSTINCIN" aria-label="Show GSTIN & CIN Numbers"
                  type="checkbox"
                  checked={settings.showCinGst}
                  onChange={(e) => onUpdateSettings({ showCinGst: e.target.checked })}
                  style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
                 />
              </label>

              <label htmlFor="vrmproforma-invoice-print-template-checkbox" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '11.5px', color: '#334155' }}>
                <span>Show Company Address & Contact</span>
                <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Show Company Address & Contact"
                  type="checkbox"
                  checked={settings.showContactInfo}
                  onChange={(e) => onUpdateSettings({ showContactInfo: e.target.checked })}
                  style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
                 />
              </label>
            </div>
          </div>
        )}

        {/* TAB 2: STAMP & SIGNATURE (NEW HIGH-POWERED CUSTOMIZATION) */}
        {activeTab === 'stampSign' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* 1. OFFICIAL COMPANY STAMP SECTION */}
            <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Stamp size={15} style={{ color: '#0E7490' }} /> Company Stamp / Seal
                </span>
                <label htmlFor="vrmproforma-invoice-print-template-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748B', cursor: 'pointer' }}>
                  <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                    type="checkbox"
                    checked={settings.showSignatoryStamp}
                    onChange={(e) => onUpdateSettings({ showSignatoryStamp: e.target.checked })}
                    style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
                   />
                  <span>Show</span>
                </label>
              </div>

              {settings.showSignatoryStamp && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Stamp Mode Switcher */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                    {[
                      { id: 'vector', label: 'Vector Seal' },
                      { id: 'custom', label: 'Custom Stamp' },
                      { id: 'none', label: 'No Stamp' }
                    ].map(mode => {
                      const isSel = settings.stampMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          onClick={() => onUpdateSettings({ stampMode: mode.id })}
                          style={{
                            padding: '6px 4px',
                            borderRadius: '6px',
                            border: isSel ? `2px solid ${settings.accentColor}` : '1px solid #CBD5E1',
                            backgroundColor: isSel ? '#FFFFFF' : '#F1F5F9',
                            color: isSel ? settings.accentColor : '#475569',
                            fontSize: '10.5px',
                            fontWeight: isSel ? '700' : '600',
                            cursor: 'pointer'
                          }}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Stamp Mode A: Vector Seal Text Config */}
                  {settings.stampMode === 'vector' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                      <div>
                        <label htmlFor="vrmproforma-invoice-print-template-seal-header-text" style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}>Seal Header Text</label>
                        <input id="vrmproforma-invoice-print-template-seal-header-text" name="sealHeaderText" aria-label="Seal Header Text"
                          type="text"
                          value={settings.stampText}
                          onChange={(e) => onUpdateSettings({ stampText: e.target.value })}
                          style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                         />
                      </div>
                      <div>
                        <label htmlFor="vrmproforma-invoice-print-template-seal-location-subtitle" style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}>Seal Location Subtitle</label>
                        <input id="vrmproforma-invoice-print-template-seal-location-subtitle" name="sealLocationSubtitle" aria-label="Seal Location Subtitle"
                          type="text"
                          value={settings.stampLocation}
                          onChange={(e) => onUpdateSettings({ stampLocation: e.target.value })}
                          style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                         />
                      </div>
                    </div>
                  )}

                  {/* Stamp Mode B: Custom Uploaded Stamp Image */}
                  {settings.stampMode === 'custom' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                      <div style={{
                        padding: '8px',
                        backgroundColor: '#FFFFFF',
                        border: '1px dashed #CBD5E1',
                        borderRadius: '6px',
                        textAlign: 'center',
                        minHeight: '52px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {settings.customStampUrl ? (
                          <img
                            src={settings.customStampUrl}
                            alt="Custom Stamp Preview"
                            style={{ maxHeight: '48px', maxWidth: '120px', objectFit: 'contain' }}
                          />
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>No stamp image uploaded yet</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input id="vrmproforma-invoice-print-template-input-2" name="input2" aria-label="Input 2"
                          ref={stampInputRef}
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleStampUpload}
                         />
                        <button
                          onClick={() => stampInputRef.current?.click()}
                          disabled={isUploadingStamp}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            backgroundColor: '#0E7490',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <Upload size={12} /> {isUploadingStamp ? 'Uploading...' : (settings.customStampUrl ? 'Change Stamp Image' : 'Upload Stamp Image')}
                        </button>

                        {settings.customStampUrl && (
                          <button
                            onClick={() => onUpdateSettings({ customStampUrl: null, stampMode: 'vector' })}
                            title="Remove custom stamp"
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#FEE2E2',
                              color: '#DC2626',
                              border: '1px solid #FCA5A5',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748B' }}>
                        💡 Tip: Transparent PNG of rubber stamp gives the best official look.
                      </div>
                    </div>
                  )}

                  {/* Fixed Stamp Size (Locked) */}
                  {settings.stampMode !== 'none' && (
                    <div style={{
                      marginTop: '6px',
                      padding: '8px 10px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '6px',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      color: '#64748B'
                    }}>
                      <span style={{ fontWeight: '600' }}>Stamp Dimensions:</span>
                      <span style={{ fontWeight: '700', color: '#0E7490', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        🔒 Fixed Standard (230px)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. AUTHORIZED SIGNATURE SECTION */}
            <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PenTool size={14} style={{ color: '#0E7490' }} /> Authorized Signature
                </span>
                {settings.signatureMode && settings.signatureMode !== 'none' && (
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ signatureMode: 'none' })}
                    style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      color: '#EF4444',
                      backgroundColor: '#FEE2E2',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      cursor: 'pointer'
                    }}
                    title="Remove Authorized Signature"
                  >
                    ✕ Remove
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Signature Mode Switcher */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '4px' }}>
                  {[
                    { id: 'none', label: 'None' },
                    { id: 'vector', label: 'Digital' },
                    { id: 'custom', label: 'Upload' },
                    { id: 'blank', label: 'Line' }
                  ].map(mode => {
                    const isSel = (settings.signatureMode || 'none') === mode.id;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => onUpdateSettings({ signatureMode: mode.id })}
                        style={{
                          padding: '6px 4px',
                          borderRadius: '6px',
                          border: isSel ? `2px solid ${settings.accentColor}` : '1px solid #CBD5E1',
                          backgroundColor: isSel ? '#FFFFFF' : '#F1F5F9',
                          color: isSel ? settings.accentColor : '#475569',
                          fontSize: '10px',
                          fontWeight: isSel ? '700' : '600',
                          cursor: 'pointer'
                        }}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>

                {/* Signature Custom Image Upload */}
                {settings.signatureMode === 'custom' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    <div style={{
                      padding: '8px',
                      backgroundColor: '#FFFFFF',
                      border: '1px dashed #CBD5E1',
                      borderRadius: '6px',
                      textAlign: 'center',
                      minHeight: '48px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {settings.customSignatureUrl ? (
                        <img
                          src={settings.customSignatureUrl}
                          alt="Custom Signature Preview"
                          style={{ maxHeight: '40px', maxWidth: '140px', objectFit: 'contain' }}
                        />
                      ) : (
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>No signature image uploaded</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input id="vrmproforma-invoice-print-template-input-3" name="input3" aria-label="Input 3"
                        ref={signatureInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleSignatureUpload}
                       />
                      <button
                        onClick={() => signatureInputRef.current?.click()}
                        disabled={isUploadingSignature}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          backgroundColor: '#0E7490',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <Upload size={12} /> {isUploadingSignature ? 'Uploading...' : (settings.customSignatureUrl ? 'Change Signature' : 'Upload Signature')}
                      </button>

                      {settings.customSignatureUrl && (
                        <button
                          onClick={() => onUpdateSettings({ customSignatureUrl: null, signatureMode: 'vector' })}
                          title="Remove custom signature"
                          style={{
                            padding: '6px 10px',
                            backgroundColor: '#FEE2E2',
                            color: '#DC2626',
                            border: '1px solid #FCA5A5',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Signatory Title and Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                  <div>
                    <label htmlFor="vrmproforma-invoice-print-template-signatory-name-optional" style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}>Signatory Name (optional)</label>
                    <input id="vrmproforma-invoice-print-template-signatory-name-optional" name="signatoryNameOptional" aria-label="Signatory Name (optional)"
                      type="text"
                      placeholder="e.g. M. Annamalaiyar"
                      value={settings.signatoryName || ''}
                      onChange={(e) => onUpdateSettings({ signatoryName: e.target.value })}
                      style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                     />
                  </div>
                  <div>
                    <label htmlFor="vrmproforma-invoice-print-template-designation-title" style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}>Designation Title</label>
                    <input id="vrmproforma-invoice-print-template-designation-title" name="designationTitle" aria-label="Designation Title"
                      type="text"
                      value={settings.signatoryTitle || 'Authorized Signatory'}
                      onChange={(e) => onUpdateSettings({ signatoryTitle: e.target.value })}
                      style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                     />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. CUSTOMER ACCEPTANCE */}
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: '11.5px', color: '#0F172A', fontWeight: '700' }}>
              <span>Show Customer Acceptance & Signature Box</span>
              <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                type="checkbox"
                checked={settings.showCustomerAcceptance}
                onChange={(e) => onUpdateSettings({ showCustomerAcceptance: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

          </div>
        )}

        {/* TAB 3: TABLE COLUMNS */}
        {activeTab === 'columns' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '11.5px', color: '#64748B' }}>
              Select which columns and data fields appear in the itemized table:
            </div>

            <label htmlFor="vrmproforma-invoice-print-template-rate-column" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Rate (₹) Column</span>
              <input id="vrmproforma-invoice-print-template-rate-column" name="rateColumn" aria-label="Rate (₹) Column"
                type="checkbox"
                checked={settings.showRateCol !== false}
                onChange={(e) => onUpdateSettings({ showRateCol: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label htmlFor="vrmproforma-invoice-print-template-hsn-sac-code" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>HSN / SAC Code Column</span>
              <input id="vrmproforma-invoice-print-template-hsn-sac-code" name="hSNSACCode" aria-label="HSN / SAC Code Column"
                type="checkbox"
                checked={settings.showHsn}
                onChange={(e) => onUpdateSettings({ showHsn: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Taxable Value (₹) Column</span>
              <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                type="checkbox"
                checked={settings.showTaxableCol !== false}
                onChange={(e) => onUpdateSettings({ showTaxableCol: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label htmlFor="vrmproforma-invoice-print-template-quantity-column" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Quantity Column</span>
              <input id="vrmproforma-invoice-print-template-quantity-column" name="quantityColumn" aria-label="Quantity Column"
                type="checkbox"
                checked={settings.showQty !== false}
                onChange={(e) => onUpdateSettings({ showQty: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Unit of Measure (UOM) Column</span>
              <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                type="checkbox"
                checked={settings.showUom}
                onChange={(e) => onUpdateSettings({ showUom: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Total / Amount (₹) Column</span>
              <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                type="checkbox"
                checked={settings.showTotalCol !== false}
                onChange={(e) => onUpdateSettings({ showTotalCol: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label htmlFor="vrmproforma-invoice-print-template-discount-column" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Discount Column</span>
              <input id="vrmproforma-invoice-print-template-discount-column" name="discountColumn" aria-label="Discount Column"
                type="checkbox"
                checked={settings.showDiscountCol}
                onChange={(e) => onUpdateSettings({ showDiscountCol: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label htmlFor="vrmproforma-invoice-print-template-line-item-gst" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Line Item GST% Column</span>
              <input id="vrmproforma-invoice-print-template-line-item-gst" name="lineItemGST" aria-label="Line Item GST% Column"
                type="checkbox"
                checked={settings.showGstCol}
                onChange={(e) => onUpdateSettings({ showGstCol: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label htmlFor="vrmproforma-invoice-print-template-s-no-column" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>S.No Column</span>
              <input id="vrmproforma-invoice-print-template-s-no-column" name="sNoColumn" aria-label="S.No Column"
                type="checkbox"
                checked={settings.showSnoCol !== false}
                onChange={(e) => onUpdateSettings({ showSnoCol: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Item Technical Descriptions</span>
              <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                type="checkbox"
                checked={settings.showItemDescription}
                onChange={(e) => onUpdateSettings({ showItemDescription: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>
          </div>
        )}

        {/* TAB 4: SECTIONS & ADDRESSES */}
        {activeTab === 'sections' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#0F172A' }}>Address & Transport Blocks</label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Show Ship To / Delivery Address</span>
              <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                type="checkbox"
                checked={settings.showShipTo}
                onChange={(e) => onUpdateSettings({ showShipTo: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Show Dispatch & Vehicle Details</span>
              <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                type="checkbox"
                checked={settings.showTransportDetails}
                onChange={(e) => onUpdateSettings({ showTransportDetails: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Show Sales Executive Name</span>
              <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                type="checkbox"
                checked={settings.showSalesExecutive}
                onChange={(e) => onUpdateSettings({ showSalesExecutive: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>
          </div>
        )}

        {/* TAB 5: BANKING & TERMS */}
        {activeTab === 'banking' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Show Company Bank Account</span>
              <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                type="checkbox"
                checked={settings.showBankDetails}
                onChange={(e) => onUpdateSettings({ showBankDetails: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
               />
            </label>

            {settings.showBankDetails && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                <div>
                  <label htmlFor="vrmproforma-invoice-print-template-beneficiary-name" style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748B' }}>Beneficiary Name</label>
                  <input id="vrmproforma-invoice-print-template-beneficiary-name" name="beneficiaryName" aria-label="Beneficiary Name"
                    type="text"
                    value={settings.bankBeneficiary}
                    onChange={(e) => onUpdateSettings({ bankBeneficiary: e.target.value })}
                    style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                   />
                </div>
                <div>
                  <label htmlFor="vrmproforma-invoice-print-template-bank-name" style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748B' }}>Bank Name</label>
                  <input id="vrmproforma-invoice-print-template-bank-name" name="bankName" aria-label="Bank Name"
                    type="text"
                    value={settings.bankName}
                    onChange={(e) => onUpdateSettings({ bankName: e.target.value })}
                    style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                   />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label htmlFor="vrmproforma-invoice-print-template-account-no" style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748B' }}>Account No.</label>
                    <input id="vrmproforma-invoice-print-template-account-no" name="accountNo" aria-label="Account No."
                      type="text"
                      value={settings.bankAccountNo}
                      onChange={(e) => onUpdateSettings({ bankAccountNo: e.target.value })}
                      style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                     />
                  </div>
                  <div>
                    <label htmlFor="vrmproforma-invoice-print-template-ifsc-code" style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748B' }}>IFSC Code</label>
                    <input id="vrmproforma-invoice-print-template-ifsc-code" name="iFSCCode" aria-label="IFSC Code"
                      type="text"
                      value={settings.bankIfsc}
                      onChange={(e) => onUpdateSettings({ bankIfsc: e.target.value })}
                      style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                     />
                  </div>
                </div>
              </div>
            )}

            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600', marginBottom: '8px' }}>
                <span>Show Terms & Conditions</span>
                <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                  type="checkbox"
                  checked={settings.showTerms}
                  onChange={(e) => onUpdateSettings({ showTerms: e.target.checked })}
                  style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
                 />
              </label>

              {settings.showTerms && (
                <div>
                  <label htmlFor="vrmproforma-invoice-print-template-edit-terms-1" style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                    Edit Terms (1 per line)
                  </label>
                  <textarea id="vrmproforma-invoice-print-template-edit-terms-1" name="editTerms1" aria-label="Edit Terms (1 per line)"
                    rows={6}
                    value={settings.termsText}
                    onChange={(e) => onUpdateSettings({ termsText: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '11px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      lineHeight: '1.4',
                      boxSizing: 'border-box',
                      resize: 'vertical'
                    }}
                   />
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* DRAWER FOOTER: PERSISTENCE & ACTIONS */}
      <div style={{
        padding: '12px 18px',
        borderTop: '1px solid #E2E8F0',
        backgroundColor: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {saveSuccessNotice && (
          <div style={{
            fontSize: '11.5px',
            color: '#15803D',
            backgroundColor: '#DCFCE7',
            padding: '6px 10px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: '700'
          }}>
            <CheckCircle size={14} /> Saved as your default template!
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: '#0E7490',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Save size={14} /> Save As Default
          </button>

          <button
            onClick={onResetDefaults}
            title="Reset to factory VRM defaults"
            style={{
              padding: '8px 12px',
              backgroundColor: '#FFFFFF',
              color: '#64748B',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Full Interactive Modal Dialog for Previewing, Printing, Customizing, and Exporting PDF
 */
export default function VRMProformaInvoicePrintTemplate({ piData, onClose }) {
  const [isExporting, setIsExporting] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [currentPiData, setCurrentPiData] = useState(piData);
  const [undoToast, setUndoToast] = useState(null);
  const undoTimeoutRef = useRef(null);

  // WhatsApp 1-Click Dispatch State
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [showWhatsAppQrModal, setShowWhatsAppQrModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [waSession, setWaSession] = useState(null);
  const [waRecipientPhone, setWaRecipientPhone] = useState('');
  const [waMessage, setWaMessage] = useState('');
  const [waAttachPdf, setWaAttachPdf] = useState(true);

  // Load saved preferences or fall back to defaults synced with master company branding
  const [templateSettings, setTemplateSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('vrm_pi_template_customization');
      const branding = getCachedBranding();

      let initial = { ...DEFAULT_PI_TEMPLATE_SETTINGS };
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.companyName === 'VRM Structures India Pvt Ltd') parsed.companyName = '';
        if (parsed.companyTagline === 'Engineered Solar Mounting Structures & Solutions') parsed.companyTagline = '';
        if (parsed.companyCin === 'U28112TN2020PTC135489') parsed.companyCin = '';
        if (parsed.signatureMode === 'vector' && !parsed.customSignatureUrl) parsed.signatureMode = 'none';
        if (parsed.bankIfsc === 'HDFC0000574' || parsed.bankIfsc === 'HDFC0001234') parsed.bankIfsc = 'HDFC0007315';
        if (parsed.bankBranch === 'Kodambakkam, Chennai' || parsed.bankBranch === 'Kodambakkam' || parsed.bankBranch?.includes('Ambattur')) parsed.bankBranch = 'Vinayagapuram Branch';
        if (parsed.bankAccountNo === '50200088912456') parsed.bankAccountNo = '50200031629272';
        if (parsed.bankName === 'HDFC Bank Ltd.' || parsed.bankName === 'HDFC Bank Ltd') parsed.bankName = 'HDFC Bank';
        parsed.showCompanyName = false;
        parsed.showCompanyTagline = false;
        initial = { ...initial, ...parsed };
      }

      // Merge master company branding (logo, stamp, signatory details)
      if (branding) {
        if (branding.logoUrl) {
          initial.customLogoUrl = branding.logoUrl;
          initial.showLogo = branding.showLogo !== undefined ? branding.showLogo : true;
        }
        if (branding.customStampUrl) {
          initial.customStampUrl = branding.customStampUrl;
          initial.stampMode = branding.stampMode || 'custom';
          initial.showSignatoryStamp = true;
        }
        if (branding.stampText) initial.stampText = branding.stampText;
        if (branding.stampLocation) initial.stampLocation = branding.stampLocation;
        if (branding.stampSize) initial.stampSize = branding.stampSize;
        if (branding.logoHeight) initial.logoHeight = branding.logoHeight;
        if (branding.forCompanyText) initial.forCompanyText = branding.forCompanyText;
        if (branding.signatoryTitle) initial.signatoryTitle = branding.signatoryTitle;
        if (branding.signatureMode) initial.signatureMode = branding.signatureMode;
        if (branding.customSignatureUrl) initial.customSignatureUrl = branding.customSignatureUrl;
      }

      // Freeze official stamp and logo as permanent defaults if not explicitly custom-uploaded
      if (!initial.customStampUrl || initial.stampMode === 'vector') {
        initial.customStampUrl = VRM_OFFICIAL_STAMP;
        initial.stampMode = 'custom';
      }
      if (!initial.customLogoUrl || initial.customLogoUrl === '/vrm_logo.png') {
        initial.customLogoUrl = VRM_OFFICIAL_LOGO;
      }
      initial.showSignatoryStamp = true;

      // Fixed constant dimensions
      initial.logoHeight = 56;
      initial.stampSize = 230;
      return initial;
    } catch (e) {}
    return {
      ...DEFAULT_PI_TEMPLATE_SETTINGS,
      customStampUrl: VRM_OFFICIAL_STAMP,
      customLogoUrl: VRM_OFFICIAL_LOGO,
      stampMode: 'custom',
      showSignatoryStamp: true,
      logoHeight: 56,
      stampSize: 230
    };
  });

  // Pull latest master company branding from backend on mount and subscribe to multi-tab updates
  useEffect(() => {
    let isMounted = true;
    fetchMasterBranding().then(master => {
      if (isMounted && master && typeof master === 'object') {
        setTemplateSettings(prev => ({
          ...prev,
          customLogoUrl: master.logoUrl || prev.customLogoUrl || VRM_OFFICIAL_LOGO,
          customStampUrl: master.customStampUrl || prev.customStampUrl || VRM_OFFICIAL_STAMP,
          stampMode: 'custom',
          stampSize: 230,
          showSignatoryStamp: master.showSignatoryStamp !== undefined ? master.showSignatoryStamp : true,
          ...(master.stampText && { stampText: master.stampText }),
          ...(master.stampLocation && { stampLocation: master.stampLocation }),
          ...(master.forCompanyText && { forCompanyText: master.forCompanyText }),
          ...(master.signatoryTitle && { signatoryTitle: master.signatoryTitle }),
          ...(master.signatureMode && { signatureMode: master.signatureMode }),
          ...(master.customSignatureUrl !== undefined && { customSignatureUrl: master.customSignatureUrl })
        }));
      }
    });

    const unsub = subscribeBrandingUpdates(b => {
      if (isMounted && b && typeof b === 'object') {
        setTemplateSettings(prev => ({
          ...prev,
          customLogoUrl: b.logoUrl || prev.customLogoUrl || VRM_OFFICIAL_LOGO,
          customStampUrl: b.customStampUrl || prev.customStampUrl || VRM_OFFICIAL_STAMP,
          stampMode: 'custom',
          stampSize: 230,
          showSignatoryStamp: b.showSignatoryStamp !== undefined ? b.showSignatoryStamp : true,
          ...(b.stampText && { stampText: b.stampText }),
          ...(b.stampLocation && { stampLocation: b.stampLocation }),
          ...(b.forCompanyText && { forCompanyText: b.forCompanyText }),
          ...(b.signatoryTitle && { signatoryTitle: b.signatoryTitle }),
          ...(b.signatureMode && { signatureMode: b.signatureMode }),
          ...(b.customSignatureUrl !== undefined && { customSignatureUrl: b.customSignatureUrl })
        }));
      }
    });

    if (typeof document !== 'undefined') {
      document.body.classList.add('vrm-print-portal-active');
    }

    return () => {
      isMounted = false;
      unsub();
      if (typeof document !== 'undefined') {
        document.body.classList.remove('vrm-print-portal-active');
      }
    };
  }, []);

  if (!piData) return null;

  const handleUpdateSettings = (updates) => {
    setTemplateSettings(prev => {
      const next = {
        ...prev,
        ...updates,
        logoHeight: 56, // Constant locked size
        stampSize: 230  // Constant locked size
      };
      try {
        localStorage.setItem('vrm_pi_template_customization', JSON.stringify(next));
        if (next.customLogoUrl) localStorage.setItem('vrm_constant_logo', next.customLogoUrl);
        if (next.customStampUrl) localStorage.setItem('vrm_constant_stamp', next.customStampUrl);
      } catch (e) {}

      // Automatically sync branding changes to backend server so all other logins immediately inherit
      if (
        updates.customStampUrl !== undefined ||
        updates.customLogoUrl !== undefined ||
        updates.stampMode !== undefined ||
        updates.stampSize !== undefined ||
        updates.stampText !== undefined ||
        updates.stampLocation !== undefined ||
        updates.showSignatoryStamp !== undefined ||
        updates.forCompanyText !== undefined ||
        updates.signatoryTitle !== undefined ||
        updates.signatureMode !== undefined ||
        updates.customSignatureUrl !== undefined
      ) {
        saveCompanyBranding({
          ...(updates.customStampUrl !== undefined && { customStampUrl: updates.customStampUrl }),
          ...(updates.customLogoUrl !== undefined && { logoUrl: updates.customLogoUrl }),
          ...(updates.stampMode !== undefined && { stampMode: updates.stampMode }),
          ...(updates.stampSize !== undefined && { stampSize: updates.stampSize }),
          ...(updates.stampText !== undefined && { stampText: updates.stampText }),
          ...(updates.stampLocation !== undefined && { stampLocation: updates.stampLocation }),
          ...(updates.showSignatoryStamp !== undefined && { showSignatoryStamp: updates.showSignatoryStamp }),
          ...(updates.forCompanyText !== undefined && { forCompanyText: updates.forCompanyText }),
          ...(updates.signatoryTitle !== undefined && { signatoryTitle: updates.signatoryTitle }),
          ...(updates.signatureMode !== undefined && { signatureMode: updates.signatureMode }),
          ...(updates.customSignatureUrl !== undefined && { customSignatureUrl: updates.customSignatureUrl })
        });
      }

      return next;
    });
  };

  const handleElementRemoved = (key, label) => {
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    setUndoToast({ key, label, message: `Removed "${label}"` });
    undoTimeoutRef.current = setTimeout(() => setUndoToast(null), 8000);
  };

  const handleUndo = () => {
    if (undoToast && undoToast.key) {
      handleUpdateSettings({ [undoToast.key]: true });
      setUndoToast(null);
    }
  };

  const handleSaveAsDefault = () => {
    try {
      localStorage.setItem('vrm_pi_template_customization', JSON.stringify(templateSettings));
      if (templateSettings.customLogoUrl) localStorage.setItem('vrm_constant_logo', templateSettings.customLogoUrl);
      if (templateSettings.customStampUrl) localStorage.setItem('vrm_constant_stamp', templateSettings.customStampUrl);
    } catch (e) {
      console.warn('Could not persist template settings:', e);
    }
  };

  const handleResetDefaults = () => {
    const constantLogo = localStorage.getItem('vrm_constant_logo') || templateSettings.customLogoUrl || VRM_OFFICIAL_LOGO;
    const constantStamp = localStorage.getItem('vrm_constant_stamp') || templateSettings.customStampUrl || VRM_OFFICIAL_STAMP;
    const reset = {
      ...DEFAULT_PI_TEMPLATE_SETTINGS,
      customLogoUrl: constantLogo,
      customStampUrl: constantStamp,
      stampMode: 'custom',
      logoHeight: 56,
      stampSize: 230
    };
    setTemplateSettings(reset);
    try {
      localStorage.setItem('vrm_pi_template_customization', JSON.stringify(reset));
    } catch (e) {}
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      const sheetEl = document.getElementById('printable-proforma-invoice');
      if (!sheetEl) {
        alert('Could not locate printable invoice element.');
        setIsExporting(false);
        return;
      }

      await new Promise(res => setTimeout(res, 250));

      const canvas = await html2canvas(sheetEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        ignoreElements: (element) => element.classList?.contains('no-print')
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();

      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight, '', 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight, '', 'FAST');
        heightLeft -= pageHeight;
      }

      const piNumberSafe = (piData.piNo || 'Proforma_Invoice').replace(/[^a-zA-Z0-9_-]/g, '_');
      pdf.save(`${piNumberSafe}_document.pdf`);
    } catch (err) {
      console.error('Proforma Invoice PDF export failed:', err);
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenWhatsAppModal = async () => {
    const rawPhone = currentPiData.phone || currentPiData.contactPhone || currentPiData.customerPhone || '';
    setWaRecipientPhone(rawPhone);
    setWaMessage(formatPiWhatsAppText(currentPiData));
    setShowWhatsAppModal(true);
    try {
      const status = await getWhatsAppStatus(getCleanCurrentUserId());
      setWaSession(status);
    } catch (_) {}
  };

  const handleSendWhatsAppPi = async () => {
    const cleanPhone = waRecipientPhone.replace(/[^0-9]/g, '');
    if (!cleanPhone) {
      alert('Please enter a valid recipient phone number.');
      return;
    }

    setIsSendingWhatsApp(true);
    try {
      let pdfBase64 = null;
      if (waAttachPdf) {
        const sheetEl = document.getElementById('printable-proforma-invoice');
        if (sheetEl) {
          const canvas = await html2canvas(sheetEl, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            ignoreElements: (element) => element.classList?.contains('no-print')
          });
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          const pageHeight = pdf.internal.pageSize.getHeight();
          let heightLeft = pdfHeight;
          let position = 0;
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight, '', 'FAST');
          heightLeft -= pageHeight;
          while (heightLeft > 0) {
            position -= pageHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight, '', 'FAST');
            heightLeft -= pageHeight;
          }
          pdfBase64 = pdf.output('datauristring');
        }
      }

      const status = await getWhatsAppStatus(getCleanCurrentUserId());
      if (status?.status === 'CONNECTED') {
        const piNumberSafe = (currentPiData.piNo || 'Proforma_Invoice').replace(/[^a-zA-Z0-9_-]/g, '_');
        await sendDirectWhatsApp({
          userId: getCleanCurrentUserId(),
          to: cleanPhone,
          text: waMessage,
          document: pdfBase64,
          fileName: `${piNumberSafe}.pdf`,
          caption: waMessage
        });
        alert(`Proforma Invoice ${currentPiData.piNo || ''} dispatched directly from your WhatsApp (+${status.phoneNumber}) with official PDF document attached.`);
        setShowWhatsAppModal(false);
      } else {
        const encoded = encodeURIComponent(waMessage);
        const formatted = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
        window.open(`https://wa.me/${formatted}?text=${encoded}`, '_blank');
        alert(`Opened in WhatsApp Web. To send attachments directly in 1 click without mobile downloads, link your WhatsApp in BUSINZ!`);
        setShowWhatsAppModal(false);
      }
    } catch (err) {
      alert(`Failed to send WhatsApp message: ${err.message}`);
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const modalContent = (
    <div
      className="vrm-print-portal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px',
        overflowY: 'auto'
      }}
    >
      {/* TOP FLOATING ACTION TOOLBAR */}
      <div
        className="no-print vrm-floating-action-toolbar"
        style={{
          width: '100%',
          maxWidth: showCustomizer ? '1260px' : '850px',
          backgroundColor: '#0F172A',
          borderRadius: '10px 10px 0 0',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#FFFFFF',
          boxSizing: 'border-box',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          transition: 'max-width 0.2s ease-in-out'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText size={18} style={{ color: '#38BDF8' }} />
          <span style={{ fontWeight: '800', fontSize: '14px' }}>
            {templateSettings.documentTitle} — {piData.piNo || 'SPI-2025'}
          </span>
          <span style={{
            fontSize: '11px',
            backgroundColor: templateSettings.accentColor || '#0E7490',
            color: '#FFFFFF',
            padding: '2px 8px',
            borderRadius: '12px',
            fontWeight: '700'
          }}>
            Official PDF
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* CUSTOMIZE TOGGLE BUTTON */}
          <button
            onClick={() => setShowCustomizer(!showCustomizer)}
            style={{
              backgroundColor: showCustomizer ? '#334155' : 'transparent',
              color: '#FFFFFF',
              border: '1px solid #475569',
              borderRadius: '6px',
              padding: '7px 14px',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Sliders size={14} style={{ color: '#38BDF8' }} />
            {showCustomizer ? 'Hide Customizer' : 'Customize Template'}
          </button>

          {/* DOWNLOAD PDF */}
          <button
            onClick={handleDownloadPdf}
            disabled={isExporting}
            style={{
              backgroundColor: '#059669',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '7px 16px',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: isExporting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: isExporting ? 0.7 : 1
            }}
          >
            <Download size={14} /> {isExporting ? 'Generating PDF...' : 'Download PDF'}
          </button>

          {/* SEND VIA WHATSAPP (1-CLICK) */}
          <button
            onClick={handleOpenWhatsAppModal}
            disabled={isSendingWhatsApp}
            style={{
              backgroundColor: '#16A34A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '7px 16px',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: isSendingWhatsApp ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(22,163,74,0.3)',
              opacity: isSendingWhatsApp ? 0.7 : 1
            }}
          >
            <MessageSquare size={14} /> {isSendingWhatsApp ? 'Sending...' : 'Send PI via WhatsApp'}
          </button>

          {/* NATIVE PRINT */}
          <button
            onClick={handlePrint}
            style={{
              backgroundColor: templateSettings.accentColor || '#0E7490',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '7px 16px',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Printer size={14} /> Print
          </button>

          {/* CLOSE */}
          <button
            onClick={onClose}
            title="Close Preview"
            style={{
              backgroundColor: '#334155',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '7px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* WORKSPACE AREA: SHEET + OPTIONAL SIDE-BY-SIDE CUSTOMIZER */}
      <div
        className="vrm-print-workspace"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: '24px',
          width: '100%',
          maxWidth: showCustomizer ? '1260px' : '850px',
          transition: 'max-width 0.2s ease-in-out'
        }}
      >
        {/* LIVE PRINTABLE DOCUMENT SHEET */}
        <div className="vrm-print-sheet-container" style={{ flex: 1, minWidth: '0' }}>
          <VRMProformaInvoicePrintSheet
            piData={currentPiData}
            settings={templateSettings}
            id="printable-proforma-invoice"
            isEditable={true}
            onUpdateSetting={handleUpdateSettings}
            onUpdatePiData={(patch) => setCurrentPiData(prev => ({ ...prev, ...patch }))}
            onElementRemoved={handleElementRemoved}
          />
        </div>

        {/* CUSTOMIZATION DRAWER */}
        {showCustomizer && (
          <TemplateCustomizerDrawer
            settings={templateSettings}
            onUpdateSettings={handleUpdateSettings}
            onSaveAsDefault={handleSaveAsDefault}
            onResetDefaults={handleResetDefaults}
            onClose={() => setShowCustomizer(false)}
          />
        )}
      </div>

      {/* FLOATING UNDO TOAST */}
      {undoToast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#0F172A',
          color: '#FFFFFF',
          padding: '10px 20px',
          borderRadius: '30px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          zIndex: 100000,
          border: '1px solid rgba(255,255,255,0.15)'
        }}>
          <span style={{ fontSize: '12.5px', fontWeight: '600' }}>
            {undoToast.message}
          </span>
          <button
            type="button"
            onClick={handleUndo}
            style={{
              backgroundColor: '#ECFEFF',
              color: '#0E7490',
              border: 'none',
              borderRadius: '20px',
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Undo2 size={13} />
            Undo
          </button>
          </div>
        )}

        {/* WHATSAPP PI SEND PROMPT MODAL */}
        {showWhatsAppModal && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100002,
            padding: '16px'
          }}>
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '520px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{
                backgroundColor: '#075E54',
                padding: '16px 20px',
                color: '#FFFFFF',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={18} />
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800' }}>
                    Send Proforma Invoice ({currentPiData.piNo || 'PI'}) via WhatsApp
                  </h3>
                </div>
                <button
                  onClick={() => setShowWhatsAppModal(false)}
                  style={{ backgroundColor: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Sender Device Status */}
                <div style={{
                  backgroundColor: waSession?.status === 'CONNECTED' ? '#F0FDF4' : '#FFFBEB',
                  border: waSession?.status === 'CONNECTED' ? '1px solid #BBF7D0' : '1px solid #FDE68A',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Smartphone size={16} color={waSession?.status === 'CONNECTED' ? '#16A34A' : '#D97706'} />
                    <span style={{ fontSize: '12px', color: '#1E293B' }}>
                      Sender Phone: <strong>{waSession?.status === 'CONNECTED' ? `+${waSession.phoneNumber} (${getCurrentSalesRepName()})` : 'Not Linked'}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWhatsAppQrModal(true)}
                    style={{ backgroundColor: 'transparent', border: 'none', color: '#0E7490', fontSize: '11px', fontWeight: '800', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {waSession?.status === 'CONNECTED' ? 'Manage' : 'Link WhatsApp'}
                  </button>
                </div>

                {/* Recipient Phone */}
                <div>
                  <label htmlFor="vrmproforma-invoice-print-template-919876543210" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Recipient Phone Number (Client)
                  </label>
                  <input id="vrmproforma-invoice-print-template-919876543210" name="919876543210" aria-label="Recipient Phone Number (Client)"
                    type="text"
                    placeholder="e.g. 919876543210"
                    value={waRecipientPhone}
                    onChange={(e) => setWaRecipientPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                   />
                </div>

                {/* PDF Document Attachment Toggle */}
                <label htmlFor="vrmproforma-invoice-print-template-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', color: '#0F172A', fontWeight: '600' }}>
                  <input id="vrmproforma-invoice-print-template-checkbox" name="checkbox" aria-label="Checkbox"
                    type="checkbox"
                    checked={waAttachPdf}
                    onChange={(e) => setWaAttachPdf(e.target.checked)}
                    style={{ accentColor: '#16A34A', width: '16px', height: '16px' }}
                   />
                  <span>Attach Official Proforma Invoice PDF Document</span>
                </label>

                {/* Message Content */}
                <div>
                  <label htmlFor="vrmproforma-invoice-print-template-wa-message" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    WhatsApp Message Text (Editable)
                  </label>
                  <textarea id="vrmproforma-invoice-print-template-wa-message" name="waMessage" aria-label="WhatsApp Message Text (Editable)"
                    rows={6}
                    value={waMessage}
                    onChange={(e) => setWaMessage(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '12px',
                      lineHeight: '1.5',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit'
                    }}
                   />
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setShowWhatsAppModal(false)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#475569',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSendingWhatsApp || !waRecipientPhone}
                    onClick={handleSendWhatsAppPi}
                    style={{
                      padding: '9px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#16A34A',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: isSendingWhatsApp ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
                      opacity: isSendingWhatsApp ? 0.7 : 1
                    }}
                  >
                    <Send size={14} />
                    <span>
                      {isSendingWhatsApp 
                        ? 'Generating & Dispatching...' 
                        : waSession?.status === 'CONNECTED' 
                          ? 'Send PI via WhatsApp' 
                          : 'Send via WhatsApp Web'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WhatsApp QR Modal */}
        <WhatsAppQrModal
          isOpen={showWhatsAppQrModal}
          onClose={() => setShowWhatsAppQrModal(false)}
          onSessionChanged={(s) => setWaSession(s)}
        />
      </div>
    );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
