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
  Undo2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { VRM_OFFICIAL_LOGO, VRM_OFFICIAL_STAMP } from '../utils/vrmOfficialAssets';

// Default Template Configuration Settings
export const DEFAULT_PI_TEMPLATE_SETTINGS = {
  // Theme & Identity
  accentColor: '#0E7490', // Default VRM Teal
  documentTitle: 'PROFORMA INVOICE',
  companyName: '',
  companyTagline: '',
  showLogo: true,
  customLogoUrl: VRM_OFFICIAL_LOGO, // Official VRM Logo base64
  logoHeight: 56, // Fixed constant size
  showCompanyName: false,
  showCompanyTagline: false,
  showContactInfo: true,
  showCompanyAddress: true,
  showCinGst: true,
  showCompanyPhoneEmail: true,
  showCompanyWebsite: true,

  // Company Address & Reg Details
  companyAddressLine1: '1427, GNT Road, Nagappa Industrial Estate, Puzhal',
  companyAddressLine2: 'Chennai, Tamil Nadu - 600066, India',
  companyGstin: '33AAGCV4262N1ZZ',
  companyCin: '',
  companyPhone: '+91 98847 20789',
  companyEmail: 'sales@vrmstructures.com',
  companyWebsite: 'www.vrmstructures.com',

  // Address & Meta Options
  showDocumentTitle: true,
  showDocNo: true,
  showDate: true,
  showValidUntil: true,
  showShipTo: true,
  showTransportDetails: true,
  showSalesExecutive: true,
  showPaymentTerms: true,
  showPlaceOfSupply: true,

  // Buyer Details Visibility
  showBillTo: true,
  showBuyerAddress: true,
  showBuyerGstin: true,
  showBuyerContact: true,
  showBuyerPhone: true,
  showBuyerEmail: true,

  // Custom Meta & Address Labels
  docNoLabel: 'Document No:',
  dateLabel: 'Date:',
  validUntilLabel: 'Valid Until:',
  paymentTermsLabel: 'Payment Terms:',
  placeOfSupplyLabel: 'Place Of Supply:',
  salesExecutiveLabel: 'Sales Executive:',
  billToLabel: 'Bill To / Buyer:',
  shipToLabel: 'Ship To / Delivery Destination:',

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
  colHeaderDesc: 'Item & Specification',
  colHeaderHsn: 'HSN/SAC',
  colHeaderQty: 'Qty',
  colHeaderUom: 'UOM',
  colHeaderRate: 'Rate (₹)',
  colHeaderDiscount: 'Disc%',
  colHeaderTaxable: 'Taxable (₹)',
  colHeaderGst: 'GST%',
  colHeaderAmount: 'Total (₹)',

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
  bankHeading: 'VRM Official Commercial Bank Details (NEFT / RTGS / IMPS)',
  bankBeneficiary: 'VRM Structures India Private Limited',
  bankName: 'HDFC Bank',
  bankAccountNo: '50200031629272',
  bankIfsc: 'HDFC0007315',
  bankBranch: 'Vinayagapuram Branch',
  bankAccountType: 'Current Account',

  // Terms & Conditions
  showTerms: true,
  termsHeading: 'Terms & Conditions:',
  termsText:
    '1. Validity: This Proforma Invoice is valid for 15 calendar days from the date of issue.\n2. Payment Terms: 100% advance along with confirmed Purchase Order.\n3. Delivery Schedule: Ex-works Puzhal Chennai, dispatch within 7-10 working days upon advance.\n4. Taxes & Duties: GST as applicable at the time of final tax invoicing and dispatch.\n5. Disputes subject to Chennai jurisdiction only.',

  // Stamp / Seal Customization
  showSignatoryStamp: true,
  stampMode: 'custom', // 'vector' | 'custom' | 'none'
  stampSize: 230, // Width in px (enlarged fixed size)
  customStampUrl: VRM_OFFICIAL_STAMP, // Official VRM Stamp image base64
  stampText: 'VRM STRUCTURES INDIA PRIVATE LIMITED',
  stampLocation: 'CHENNAI',

  // Signature Customization
  signatureMode: 'none', // 'none' | 'vector' | 'custom' | 'blank'
  customSignatureUrl: null, // Custom uploaded handwritten signature base64
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
  return `Indian Rupees ${words} Only`;
}

// Format date nicely
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
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
  const cfg = { ...DEFAULT_PI_TEMPLATE_SETTINGS, ...settings };
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
            outline: 'none',
            border: 'none',
            backgroundColor: 'transparent',
            borderRadius: '3px',
            padding: '1px 3px',
            transition: 'all 0.15s ease',
            display: multiline ? 'block' : 'inline-block',
            cursor: 'text'
          }}
          className={`${className} editable-template-field`}
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

  // Helper to extract clean string from address object or string
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

    return {
      street: street || 'Plot No 4A, Industrial Area',
      city: city || 'Chennai',
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

  const customerName = typeof pi.vendor === 'string' ? pi.vendor : (typeof pi.customerName === 'string' ? pi.customerName : (typeof pi.vendorName === 'string' ? pi.vendorName : 'Customer Company Name'));

  // Detect Inter-state vs Intra-state GST based on customer state / GST
  const customerGst = typeof pi.gstNo === 'string' ? pi.gstNo.trim().toUpperCase() : '';
  const rawState = bState || '';
  const customerState = typeof rawState === 'string' ? rawState.trim().toLowerCase() : '';
  const isTamilNadu = customerGst.startsWith('33') || customerState.includes('tamil') || customerState.includes('tn');
  const isInterState = customerGst.length >= 2 && !customerGst.startsWith('33') && !isTamilNadu;

  // Extract preset groups or detect preset items
  const presetGroups = pi.presetGroups || {};
  const hasExplicitPresets = Object.keys(presetGroups).length > 0 || rawItems.some(it => it.isPresetItem);
  const allZeroRate = rawItems.length > 0 && rawItems.every(it => (parseFloat(it.rate) || 0) === 0) && (Number(pi.unitValue) || 0) > 0;

  // Pre-calculate group prices and GSTs
  const groupMetaMap = {};
  if (hasExplicitPresets) {
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
        name: grp.presetName || 'Solar Structure MMS Kit',
        kitPrice: uPrice,
        setCount: sCount,
        groupSubtotal: grpSub,
        groupGst: grpGst,
        groupTotal: grpSub + grpGst,
        gstRateStr: grp.gstRate || '18%'
      };
    });
  } else if (allZeroRate) {
    const uPrice = Number(pi.unitValue) || 0;
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
      name: pi.productName || 'Solar MMS Preset Kit',
      kitPrice: uPrice,
      setCount: sCount,
      groupSubtotal: grpSub,
      groupGst: grpGst,
      groupTotal: grpSub + grpGst,
      gstRateStr: '18%'
    };
  }

  // Compute item totals
  const items = rawItems.map((it, idx) => {
    const q = parseFloat(it.qty) || 1;
    const r = parseFloat(it.rate) || 0;
    const isPreset = Boolean(it.isPresetItem || (allZeroRate && !it.rate));
    const grpId = it.presetGroupId || (allZeroRate ? 'implicit_preset_1' : null);
    const grpMeta = grpId ? groupMetaMap[grpId] : null;

    let isFirstInGroup = false;
    let groupCount = 1;
    if (isPreset && grpId) {
      const firstIdx = rawItems.findIndex(x => (x.presetGroupId || (allZeroRate ? 'implicit_preset_1' : null)) === grpId);
      isFirstInGroup = (firstIdx === idx);
      groupCount = rawItems.filter(x => (x.presetGroupId || (allZeroRate ? 'implicit_preset_1' : null)) === grpId).length;
    }

    const gross = q * r;
    const discPct = parseFloat(it.discountPct || it.discount) || 0;
    const discAmt = gross * (discPct / 100);
    const taxable = isPreset ? 0 : (gross - discAmt);
    const gRate = parseFloat(String(it.gstRate || '18%').replace('%', '')) || 18;
    const gstAmt = isPreset ? 0 : (taxable * (gRate / 100));
    const lineTotal = taxable + gstAmt;

    return {
      sNo: idx + 1,
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
      presetName: grpMeta?.name || '',
      setCount: grpMeta?.setCount || 1,
      groupPrice: grpMeta?.kitPrice || 0,
      groupTaxable: grpMeta?.groupSubtotal || 0,
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
            margin: 12mm 12mm !important;
          }

          @media print {
            body * {
              visibility: hidden !important;
            }

            .no-print,
            .vrm-floating-action-toolbar,
            .TemplateCustomizerDrawer {
              display: none !important;
            }

            #${id},
            #${id} * {
              visibility: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            /* Printable Sheet: Exact full width, zero-offset layout */
            #${id} {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              min-height: auto !important;
              height: auto !important;
              overflow: visible !important;
              box-shadow: none !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              border-radius: 0 !important;
              background: #ffffff !important;
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
              page-break-after: auto !important;
              break-after: auto !important;
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

            div {
              overflow: visible !important;
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
              <span>👁️ Removed Elements ({hiddenElements.length})</span>
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
      <div style={{ border: `1.5px solid ${accent}`, borderRadius: '4px', overflow: 'hidden' }}>

        {/* 1. HEADER SECTION (LOGO + COMPANY DETAILS | PROFORMA INVOICE BADGE & META) */}
        <div style={{ padding: '16px 20px', borderBottom: `1.5px solid ${accent}`, backgroundColor: '#F8FAFC' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
            {/* LEFT: COMPANY INFO */}
            <div style={{ flex: '1 1 55%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                {cfg.showLogo && (
                  <RemovableBlock
                    visible={cfg.showLogo}
                    settingKey="showLogo"
                    title="Company Logo"
                  >
                    <img
                      src={cfg.customLogoUrl || (typeof window !== 'undefined' && localStorage.getItem('vrm_constant_logo')) || VRM_OFFICIAL_LOGO}
                      alt={cfg.companyName || 'VRM Structures'}
                      style={{
                        height: '56px',
                        width: 'auto',
                        maxWidth: '220px',
                        objectFit: 'contain'
                      }}
                      onError={(e) => {
                        e.currentTarget.src = VRM_OFFICIAL_LOGO;
                      }}
                    />
                  </RemovableBlock>
                )}
                {((cfg.showCompanyName && cfg.companyName) || (cfg.showCompanyTagline && cfg.companyTagline)) ? (
                  <div>
                    {cfg.showCompanyName && cfg.companyName && (
                      <div style={{ fontSize: '16.5px', fontWeight: '800', color: accent, letterSpacing: '-0.3px', textTransform: 'uppercase' }}>
                        <EditableText
                          value={cfg.companyName}
                          fallback=""
                          onSave={(v) => onUpdateSetting?.({ companyName: v })}
                          onRemove={() => {
                            onUpdateSetting?.({ showCompanyName: false, companyName: '' });
                            onElementRemoved?.('showCompanyName', 'Company Name');
                          }}
                          removeLabel="Company Name"
                        />
                      </div>
                    )}
                    {cfg.showCompanyTagline && cfg.companyTagline && (
                      <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}>
                        <EditableText
                          value={cfg.companyTagline}
                          fallback=""
                          onSave={(v) => onUpdateSetting?.({ companyTagline: v })}
                          onRemove={() => {
                            onUpdateSetting?.({ showCompanyTagline: false, companyTagline: '' });
                            onElementRemoved?.('showCompanyTagline', 'Company Tagline');
                          }}
                          removeLabel="Company Tagline"
                        />
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {cfg.showContactInfo && (
                <div style={{ fontSize: '10.5px', color: '#334155', lineHeight: '1.45', marginTop: '4px' }}>
                  {cfg.showCompanyAddress !== false && (
                    <RemovableBlock
                      visible={cfg.showCompanyAddress !== false}
                      settingKey="showCompanyAddress"
                      title="Company Address"
                    >
                      <div>
                        <EditableText
                          value={cfg.companyAddressLine1}
                          fallback="1427, GNT Road, Nagappa Industrial Estate, Puzhal"
                          onSave={(v) => onUpdateSetting?.({ companyAddressLine1: v })}
                        />
                      </div>
                      <div>
                        <EditableText
                          value={cfg.companyAddressLine2}
                          fallback="Chennai, Tamil Nadu - 600066, India"
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
                      style={{ marginTop: '3px' }}
                    >
                      <strong style={{ color: '#0F172A' }}>GSTIN:</strong>{' '}
                      <EditableText
                        value={cfg.companyGstin}
                        fallback="33AAGCV4262N1ZZ"
                        onSave={(v) => onUpdateSetting?.({ companyGstin: v })}
                        style={{ fontFamily: 'monospace', fontWeight: '700' }}
                      />
                      {cfg.companyCin ? (
                        <>
                          {' '}&nbsp;|&nbsp; <strong style={{ color: '#0F172A' }}>CIN:</strong>{' '}
                          <EditableText
                            value={cfg.companyCin}
                            fallback=""
                            onSave={(v) => onUpdateSetting?.({ companyCin: v })}
                            onRemove={() => onUpdateSetting?.({ companyCin: '' })}
                            removeLabel="Company CIN"
                            style={{ fontFamily: 'monospace', fontWeight: '700' }}
                          />
                        </>
                      ) : null}
                    </RemovableBlock>
                  )}
                  {cfg.showCompanyPhoneEmail !== false && (
                    <RemovableBlock
                      visible={cfg.showCompanyPhoneEmail !== false}
                      settingKey="showCompanyPhoneEmail"
                      title="Company Phone & Email"
                    >
                      <strong style={{ color: '#0F172A' }}>Phone:</strong>{' '}
                      <EditableText
                        value={cfg.companyPhone}
                        fallback="+91 98847 20789"
                        onSave={(v) => onUpdateSetting?.({ companyPhone: v })}
                      />{' '}
                      &nbsp;|&nbsp; <strong style={{ color: '#0F172A' }}>Email:</strong>{' '}
                      <EditableText
                        value={cfg.companyEmail}
                        fallback="sales@vrmstructures.com"
                        onSave={(v) => onUpdateSetting?.({ companyEmail: v })}
                      />
                    </RemovableBlock>
                  )}
                  {cfg.showCompanyWebsite && (
                    <RemovableBlock
                      visible={cfg.showCompanyWebsite}
                      settingKey="showCompanyWebsite"
                      title="Company Website"
                    >
                      <strong style={{ color: '#0F172A' }}>Website:</strong>{' '}
                      <EditableText
                        value={cfg.companyWebsite}
                        fallback="www.vrmstructures.com"
                        onSave={(v) => onUpdateSetting?.({ companyWebsite: v })}
                      />
                    </RemovableBlock>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT: DOCUMENT TITLE & ESSENTIAL METADATA */}
            <div style={{ flex: '1 1 45%', textAlign: 'right' }}>
              {cfg.showDocumentTitle !== false && (
                <div style={{ display: 'inline-block', marginBottom: '10px' }}>
                  <RemovableBlock
                    visible={cfg.showDocumentTitle !== false}
                    settingKey="showDocumentTitle"
                    title="Document Title"
                  >
                    <div style={{
                      display: 'inline-block',
                      backgroundColor: accent,
                      color: '#FFFFFF',
                      padding: '6px 16px',
                      borderRadius: '6px',
                      fontSize: '15px',
                      fontWeight: '800',
                      letterSpacing: '1px',
                      textTransform: 'uppercase'
                    }}>
                      <EditableText
                        value={cfg.documentTitle}
                        fallback="PROFORMA INVOICE"
                        onSave={(v) => onUpdateSetting?.({ documentTitle: v })}
                        style={{ color: '#FFFFFF' }}
                      />
                    </div>
                  </RemovableBlock>
                </div>
              )}

              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', marginTop: '4px' }}>
                <tbody>
                  {cfg.showDocNo !== false && (
                    <RemovableMetaRow
                      visible={cfg.showDocNo !== false}
                      settingKey="showDocNo"
                      label={cfg.docNoLabel || "Document No:"}
                      itemLabel="Document No"
                      valueText={pi.piNo || "SPI-2025-101"}
                      fallbackValue="SPI-2025-101"
                      valueColor={accent}
                      onSaveLabel={(v) => onUpdateSetting?.({ docNoLabel: v })}
                      onSaveValue={(v) => {
                        onUpdatePiData?.({ piNo: v });
                        onUpdateSetting?.({ defaultDocNo: v });
                      }}
                    />
                  )}
                  {cfg.showDate !== false && (
                    <RemovableMetaRow
                      visible={cfg.showDate !== false}
                      settingKey="showDate"
                      label={cfg.dateLabel || "Date:"}
                      itemLabel="Date"
                      valueText={formatDate(pi.piDate)}
                      fallbackValue="Date"
                      onSaveLabel={(v) => onUpdateSetting?.({ dateLabel: v })}
                      onSaveValue={(v) => onUpdatePiData?.({ piDate: v })}
                    />
                  )}
                  {cfg.showValidUntil !== false && !Boolean(pi.convertedToBom) && pi.status !== 'Converted to BOM' && pi.status !== 'Cancelled' && (
                    <RemovableMetaRow
                      visible={cfg.showValidUntil !== false}
                      settingKey="showValidUntil"
                      label={cfg.validUntilLabel || "Valid Until:"}
                      itemLabel="Valid Until"
                      valueText={formatDate(pi.expDate || pi.validUntilDate)}
                      fallbackValue="11 Oct 2026"
                      valueColor="#B91C1C"
                      onSaveLabel={(v) => onUpdateSetting?.({ validUntilLabel: v })}
                      onSaveValue={(v) => onUpdatePiData?.({ expDate: v })}
                    />
                  )}
                  {cfg.showPlaceOfSupply && (
                    <RemovableMetaRow
                      visible={cfg.showPlaceOfSupply}
                      settingKey="showPlaceOfSupply"
                      label={cfg.placeOfSupplyLabel || "Place Of Supply:"}
                      itemLabel="Place Of Supply"
                      valueText={pi.placeOfSupply || (isTamilNadu ? 'Tamil Nadu (33)' : (bState ? `${bState}` : 'Tamil Nadu (33)'))}
                      fallbackValue="Tamil Nadu (33)"
                      onSaveLabel={(v) => onUpdateSetting?.({ placeOfSupplyLabel: v })}
                      onSaveValue={(v) => {
                        onUpdatePiData?.({ placeOfSupply: v });
                        onUpdateSetting?.({ defaultPlaceOfSupply: v });
                      }}
                    />
                  )}
                  {cfg.showSalesExecutive && (
                    <RemovableMetaRow
                      visible={cfg.showSalesExecutive}
                      settingKey="showSalesExecutive"
                      label={cfg.salesExecutiveLabel || "Sales Executive:"}
                      itemLabel="Sales Executive"
                      valueText={pi.salesPerson || pi.salesperson || pi.createdBy || 'ManojRaj (VRM Sales)'}
                      fallbackValue="ManojRaj (VRM Sales)"
                      onSaveLabel={(v) => onUpdateSetting?.({ salesExecutiveLabel: v })}
                      onSaveValue={(v) => {
                        onUpdatePiData?.({ salesPerson: v });
                        onUpdateSetting?.({ defaultSalesPerson: v });
                      }}
                    />
                  )}
                  {cfg.showPaymentTerms && (
                    <RemovableMetaRow
                      visible={cfg.showPaymentTerms}
                      settingKey="showPaymentTerms"
                      label={cfg.paymentTermsLabel || "Payment Terms:"}
                      itemLabel="Payment Terms"
                      valueText={pi.paymentTerms || "50% Adv + 50% Before Dispatch"}
                      fallbackValue="50% Adv + 50% Before Dispatch"
                      onSaveLabel={(v) => onUpdateSetting?.({ paymentTermsLabel: v })}
                      onSaveValue={(v) => onUpdatePiData?.({ paymentTerms: v })}
                    />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 2. CUSTOMER DETAILS: BILL TO & SHIP TO */}
        {(cfg.showBillTo !== false || cfg.showShipTo) && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: (cfg.showBillTo !== false && cfg.showShipTo) ? '1fr 1fr' : '1fr',
            borderBottom: '1px solid #CBD5E1',
            backgroundColor: '#FFFFFF'
          }}>
            {/* BILL TO */}
            {cfg.showBillTo !== false && (
              <RemovableBlock
                visible={cfg.showBillTo !== false}
                title="Bill To / Buyer Section"
                onRemove={() => onUpdateSetting?.({ showBillTo: false })}
                style={{ padding: '12px 18px', borderRight: cfg.showShipTo ? '1px solid #CBD5E1' : 'none' }}
              >
                <div style={{ fontSize: '11px', fontWeight: '800', color: accent, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  <EditableText
                    value={cfg.billToLabel}
                    fallback="Bill To / Buyer:"
                    onSave={(v) => onUpdateSetting?.({ billToLabel: v })}
                    onRemove={() => onUpdateSetting?.({ showBillTo: false })}
                  />
                </div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginBottom: '3px' }}>
                  <EditableText
                    value={customerName}
                    fallback="Customer / Buyer Company Name"
                    onSave={(v) => onUpdatePiData?.({ customerName: v, vendor: v, vendorName: v })}
                  />
                </div>
                <div style={{ fontSize: '11px', color: '#334155', lineHeight: '1.4' }}>
                  {cfg.showBuyerAddress !== false && (
                    <RemovableBlock
                      visible={cfg.showBuyerAddress !== false}
                      title="Buyer Address"
                      onRemove={() => onUpdateSetting?.({ showBuyerAddress: false })}
                    >
                      <div>
                        <EditableText
                          value={bStreet}
                          fallback="Street Address"
                          onSave={(v) => onUpdatePiData?.({ billingStreet: v, billingAddress: { ...(pi.billingAddress || {}), street: v } })}
                          onRemove={() => onUpdateSetting?.({ showBuyerAddress: false })}
                        />
                      </div>
                      <div>
                        <EditableText
                          value={bCity}
                          fallback="City"
                          onSave={(v) => onUpdatePiData?.({ billingCity: v, billingAddress: { ...(pi.billingAddress || {}), city: v } })}
                        />{', '}
                        <EditableText
                          value={bState}
                          fallback="State"
                          onSave={(v) => onUpdatePiData?.({ billingState: v, billingAddress: { ...(pi.billingAddress || {}), state: v } })}
                        />{' - '}
                        <EditableText
                          value={bPincode}
                          fallback="Pincode"
                          onSave={(v) => onUpdatePiData?.({ billingPincode: v, billingAddress: { ...(pi.billingAddress || {}), pincode: v } })}
                        />
                      </div>
                    </RemovableBlock>
                  )}
                  {cfg.showBuyerGstin !== false && (
                    <div style={{ marginTop: '3px' }}>
                      <strong style={{ color: '#0F172A' }}>GSTIN:</strong>{' '}
                      <span style={{ fontFamily: 'monospace', fontWeight: '700' }}>
                        <EditableText
                          value={pi.gstNo}
                          fallback="Unregistered"
                          onSave={(v) => onUpdatePiData?.({ gstNo: v })}
                          onRemove={() => onUpdateSetting?.({ showBuyerGstin: false })}
                        />
                      </span>
                    </div>
                  )}
                  {cfg.showBuyerContact !== false && (
                    <div>
                      <strong style={{ color: '#0F172A' }}>Contact:</strong>{' '}
                      <EditableText
                        value={pi.contactPerson}
                        fallback="Add Contact Person"
                        onSave={(v) => onUpdatePiData?.({ contactPerson: v })}
                        onRemove={() => onUpdateSetting?.({ showBuyerContact: false })}
                      />
                    </div>
                  )}
                  {cfg.showBuyerPhone !== false && (
                    <div>
                      <strong style={{ color: '#0F172A' }}>Phone:</strong>{' '}
                      <EditableText
                        value={pi.phone}
                        fallback="+91 98765 43210"
                        onSave={(v) => onUpdatePiData?.({ phone: v })}
                        onRemove={() => onUpdateSetting?.({ showBuyerPhone: false })}
                      />
                    </div>
                  )}
                  {cfg.showBuyerEmail !== false && (
                    <div>
                      <strong style={{ color: '#0F172A' }}>Email:</strong>{' '}
                      <EditableText
                        value={pi.email}
                        fallback="buyer@example.com"
                        onSave={(v) => onUpdatePiData?.({ email: v })}
                        onRemove={() => onUpdateSetting?.({ showBuyerEmail: false })}
                      />
                    </div>
                  )}
                </div>
              </RemovableBlock>
            )}

            {/* SHIP TO (Optional) */}
            {cfg.showShipTo && (
              <RemovableBlock
                visible={cfg.showShipTo}
                title="Ship To Section"
                onRemove={() => onUpdateSetting?.({ showShipTo: false })}
                style={{ padding: '12px 18px' }}
              >
                <div style={{ fontSize: '11px', fontWeight: '800', color: accent, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  <EditableText
                    value={cfg.shipToLabel}
                    fallback="Ship To / Delivery Destination:"
                    onSave={(v) => onUpdateSetting?.({ shipToLabel: v })}
                    onRemove={() => onUpdateSetting?.({ showShipTo: false })}
                  />
                </div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginBottom: '3px' }}>
                  <EditableText
                    value={pi.shippingName || customerName}
                    fallback="Delivery Destination Name"
                    onSave={(v) => onUpdatePiData?.({ shippingName: v })}
                  />
                </div>
                <div style={{ fontSize: '11px', color: '#334155', lineHeight: '1.4' }}>
                  <div>
                    <EditableText
                      value={dStreet}
                      fallback="Site Delivery Address"
                      onSave={(v) => onUpdatePiData?.({ deliveryStreet: v, deliveryAddress: { ...(pi.deliveryAddress || {}), street: v } })}
                    />
                  </div>
                  <div>
                    <EditableText
                      value={dCity}
                      fallback="Delivery City"
                      onSave={(v) => onUpdatePiData?.({ deliveryCity: v, deliveryAddress: { ...(pi.deliveryAddress || {}), city: v } })}
                    />{', '}
                    <EditableText
                      value={dState}
                      fallback="Delivery State"
                      onSave={(v) => onUpdatePiData?.({ deliveryState: v, deliveryAddress: { ...(pi.deliveryAddress || {}), state: v } })}
                    />{' - '}
                    <EditableText
                      value={dPincode}
                      fallback="Pincode"
                      onSave={(v) => onUpdatePiData?.({ deliveryPincode: v, deliveryAddress: { ...(pi.deliveryAddress || {}), pincode: v } })}
                    />
                  </div>
                  <div style={{ marginTop: '3px' }}>
                    <strong style={{ color: '#0F172A' }}>State Code:</strong> {isTamilNadu ? '33 (Tamil Nadu)' : (dState || '—')}
                  </div>
                  {cfg.showTransportDetails && (
                    <RemovableBlock
                      visible={cfg.showTransportDetails}
                      title="Transport / LR Details"
                      onRemove={() => onUpdateSetting?.({ showTransportDetails: false })}
                    >
                      <div>
                        <strong style={{ color: '#0F172A' }}>Dispatch Mode:</strong>{' '}
                        <EditableText
                          value={pi.transportMode}
                          fallback="Road Transport"
                          onSave={(v) => onUpdatePiData?.({ transportMode: v })}
                          onRemove={() => onUpdateSetting?.({ showTransportDetails: false })}
                        />
                      </div>
                      <div>
                        <strong style={{ color: '#0F172A' }}>Vehicle / LR No:</strong>{' '}
                        <EditableText
                          value={pi.vehicleNo}
                          fallback="TN-01-AB-1234"
                          onSave={(v) => onUpdatePiData?.({ vehicleNo: v })}
                        />
                      </div>
                    </RemovableBlock>
                  )}
                </div>
              </RemovableBlock>
            )}
          </div>
        )}

        {/* 3. LINE ITEMS TABLE */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: accent, color: '#FFFFFF', fontWeight: '700', textAlign: 'center' }}>
                {cfg.showSnoCol !== false && (
                  <RemovableTableHeaderCell
                    title={cfg.colHeaderSno}
                    settingKey="showSnoCol"
                    label="S.No (#) Column"
                    width="34px"
                    align="center"
                    onSaveTitle={(v) => onUpdateSetting?.({ colHeaderSno: v })}
                  />
                )}
                <RemovableTableHeaderCell
                  title={cfg.colHeaderDesc}
                  label="Item & Specification"
                  align="left"
                  canRemove={false}
                  onSaveTitle={(v) => onUpdateSetting?.({ colHeaderDesc: v })}
                />
                {cfg.showHsn && (
                  <RemovableTableHeaderCell
                    title={cfg.colHeaderHsn}
                    settingKey="showHsn"
                    label="HSN/SAC Column"
                    width="75px"
                    align="center"
                    onSaveTitle={(v) => onUpdateSetting?.({ colHeaderHsn: v })}
                  />
                )}
                {cfg.showQty !== false && (
                  <RemovableTableHeaderCell
                    title={cfg.colHeaderQty}
                    settingKey="showQty"
                    label="Qty Column"
                    width="55px"
                    align="center"
                    onSaveTitle={(v) => onUpdateSetting?.({ colHeaderQty: v })}
                  />
                )}
                {cfg.showUom && (
                  <RemovableTableHeaderCell
                    title={cfg.colHeaderUom}
                    settingKey="showUom"
                    label="UOM Column"
                    width="50px"
                    align="center"
                    onSaveTitle={(v) => onUpdateSetting?.({ colHeaderUom: v })}
                  />
                )}
                {cfg.showRateCol !== false && (
                  <RemovableTableHeaderCell
                    title={cfg.colHeaderRate}
                    settingKey="showRateCol"
                    label="Rate (₹) Column"
                    width="85px"
                    align="right"
                    onSaveTitle={(v) => onUpdateSetting?.({ colHeaderRate: v })}
                  />
                )}
                {cfg.showDiscountCol && (
                  <RemovableTableHeaderCell
                    title={cfg.colHeaderDiscount}
                    settingKey="showDiscountCol"
                    label="Disc% Column"
                    width="55px"
                    align="center"
                    onSaveTitle={(v) => onUpdateSetting?.({ colHeaderDiscount: v })}
                  />
                )}
                {cfg.showTaxableCol !== false && (
                  <RemovableTableHeaderCell
                    title={cfg.colHeaderTaxable}
                    settingKey="showTaxableCol"
                    label="Taxable (₹) Column"
                    width="85px"
                    align="right"
                    onSaveTitle={(v) => onUpdateSetting?.({ colHeaderTaxable: v })}
                  />
                )}
                {cfg.showGstCol && (
                  <RemovableTableHeaderCell
                    title={cfg.colHeaderGst}
                    settingKey="showGstCol"
                    label="GST% Column"
                    width="55px"
                    align="center"
                    onSaveTitle={(v) => onUpdateSetting?.({ colHeaderGst: v })}
                  />
                )}
                {cfg.showTotalCol !== false && (
                  <RemovableTableHeaderCell
                    title={cfg.colHeaderAmount}
                    settingKey="showTotalCol"
                    label="Total (₹) Column"
                    width="95px"
                    align="right"
                    onSaveTitle={(v) => onUpdateSetting?.({ colHeaderAmount: v })}
                  />
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr
                  key={idx}
                  style={{
                    backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                    verticalAlign: 'top'
                  }}
                >
                  {cfg.showSnoCol !== false && (
                    <td style={{ padding: '10px 6px', borderRight: '1px solid #E2E8F0', textAlign: 'center', fontWeight: '600', color: '#64748B' }}>
                      {it.sNo}
                    </td>
                  )}
                  <td style={{ padding: '10px 10px', borderRight: '1px solid #E2E8F0' }}>
                    <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '11.5px' }}>
                      {it.name}
                    </div>
                    {cfg.showItemDescription && it.description && (
                      <div style={{ fontSize: '10px', color: '#475569', marginTop: '3px', whiteSpace: 'pre-line', lineHeight: '1.35' }}>
                        {it.description}
                      </div>
                    )}
                  </td>
                  {cfg.showHsn && (
                    <td style={{ padding: '10px 6px', borderRight: '1px solid #E2E8F0', textAlign: 'center', fontFamily: 'monospace', color: '#334155', fontSize: '11px' }}>
                      {it.hsn || '—'}
                    </td>
                  )}
                  {cfg.showQty !== false && (
                    <td style={{ padding: '10px 6px', borderRight: '1px solid #E2E8F0', textAlign: 'center', fontWeight: '700', color: '#0F172A', fontSize: '11.5px' }}>
                      {it.qty}
                    </td>
                  )}
                  {cfg.showUom && (
                    <td style={{ padding: '10px 6px', borderRight: '1px solid #E2E8F0', textAlign: 'center', color: '#475569', fontSize: '11px' }}>
                      {it.uom || 'NOS'}
                    </td>
                  )}
                  {cfg.showRateCol !== false && (
                    it.isPresetItem ? (
                      it.isFirstInGroup ? (
                        <td
                          rowSpan={it.groupCount}
                          style={{
                            padding: '10px 8px',
                            borderRight: '1px solid #E2E8F0',
                            textAlign: 'right',
                            color: '#0F172A',
                            verticalAlign: 'middle',
                            fontWeight: '700',
                            backgroundColor: '#FAFAFA'
                          }}
                        >
                          ₹ {it.groupPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <div style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 'normal' }}>
                            for {it.setCount || 1} Set{it.setCount > 1 ? 's' : ''}
                          </div>
                        </td>
                      ) : null
                    ) : (
                      <td style={{ padding: '10px 8px', borderRight: '1px solid #E2E8F0', textAlign: 'right', color: '#0F172A', fontSize: '11px', fontWeight: '600' }}>
                        {Number(it.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    )
                  )}
                  {cfg.showDiscountCol && (
                    it.isPresetItem ? (
                      it.isFirstInGroup ? (
                        <td rowSpan={it.groupCount} style={{ padding: '10px 6px', borderRight: '1px solid #E2E8F0', textAlign: 'center', verticalAlign: 'middle', color: '#64748B', backgroundColor: '#FAFAFA' }}>
                          —
                        </td>
                      ) : null
                    ) : (
                      <td style={{ padding: '10px 6px', borderRight: '1px solid #E2E8F0', textAlign: 'center', color: '#64748B', fontSize: '11px' }}>
                        {it.discPct ? `${it.discPct}%` : '—'}
                      </td>
                    )
                  )}
                  {cfg.showTaxableCol !== false && (
                    it.isPresetItem ? (
                      it.isFirstInGroup ? (
                        <td
                          rowSpan={it.groupCount}
                          style={{
                            padding: '10px 8px',
                            borderRight: '1px solid #E2E8F0',
                            textAlign: 'right',
                            fontWeight: '700',
                            color: '#0F172A',
                            verticalAlign: 'middle',
                            backgroundColor: '#FAFAFA'
                          }}
                        >
                          ₹ {it.groupTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      ) : null
                    ) : (
                      <td style={{ padding: '10px 8px', borderRight: '1px solid #E2E8F0', textAlign: 'right', fontWeight: '600', color: '#0F172A', fontSize: '11px' }}>
                        {Number(it.taxable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    )
                  )}
                  {cfg.showGstCol && (
                    it.isPresetItem ? (
                      it.isFirstInGroup ? (
                        <td
                          rowSpan={it.groupCount}
                          style={{
                            padding: '10px 6px',
                            borderRight: '1px solid #E2E8F0',
                            textAlign: 'center',
                            color: accent,
                            fontWeight: '700',
                            verticalAlign: 'middle',
                            backgroundColor: '#FAFAFA'
                          }}
                        >
                          {it.groupGstRateStr}
                        </td>
                      ) : null
                    ) : (
                      <td style={{ padding: '10px 6px', borderRight: '1px solid #E2E8F0', textAlign: 'center', color: accent, fontWeight: '600', fontSize: '11px' }}>
                        {it.gRate ? `${it.gRate}%` : '18%'}
                      </td>
                    )
                  )}
                  {cfg.showTotalCol !== false && (
                    it.isPresetItem ? (
                      it.isFirstInGroup ? (
                        <td
                          rowSpan={it.groupCount}
                          style={{
                            padding: '10px 10px',
                            textAlign: 'right',
                            fontWeight: '800',
                            color: accent,
                            verticalAlign: 'middle',
                            backgroundColor: '#FAFAFA'
                          }}
                        >
                          ₹ {it.groupLineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      ) : null
                    ) : (
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700', color: accent, fontSize: '11px' }}>
                        {Number(it.lineTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. TOTAL IN WORDS & CALCULATION SUMMARY */}
        <div className="avoid-break" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', borderTop: `1.5px solid ${accent}`, backgroundColor: '#FFFFFF' }}>
          {/* LEFT: WORDS + BANK DETAILS + TERMS */}
          <div style={{ padding: '14px 18px', borderRight: '1px solid #CBD5E1' }}>
            {cfg.showTotalInWords && (
              <RemovableBlock
                visible={cfg.showTotalInWords}
                settingKey="showTotalInWords"
                title="Amount Chargeable In Words"
                style={{ marginBottom: '12px' }}
              >
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Amount Chargeable (in words):</div>
                <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#0F172A', marginTop: '2px', lineHeight: '1.3' }}>
                  {numberToWordsINR(grandTotal)}
                </div>
              </RemovableBlock>
            )}

            {/* BANK DETAILS */}
            {cfg.showBankDetails && (
              <RemovableBlock
                visible={cfg.showBankDetails}
                settingKey="showBankDetails"
                title="Bank Details Box"
                style={{ border: '1px solid #CBD5E1', borderRadius: '4px', padding: '8px 12px', backgroundColor: '#F8FAFC', marginBottom: '12px' }}
              >
                <div style={{ fontSize: '10.5px', fontWeight: '800', color: accent, textTransform: 'uppercase', marginBottom: '4px' }}>
                  <EditableText
                    value={cfg.bankHeading}
                    fallback="VRM Company Bank Details (NEFT / RTGS / IMPS)"
                    onSave={(v) => onUpdateSetting?.({ bankHeading: v })}
                    onRemove={() => {
                      onUpdateSetting?.({ showBankDetails: false });
                      onElementRemoved?.('showBankDetails', 'Bank Details Box');
                    }}
                    removeLabel="Bank Details"
                  />
                </div>
                <table style={{ width: '100%', fontSize: '10.5px', borderCollapse: 'collapse' }}>
                  <tbody>
                    {cfg.showBankBeneficiary !== false && (
                      <tr>
                        <td style={{ width: '90px', color: '#64748B', fontWeight: '600', padding: '1px 0' }}>Beneficiary:</td>
                        <td style={{ fontWeight: '700', color: '#0F172A' }}>
                          <EditableText
                            value={cfg.bankBeneficiary}
                            fallback="Beneficiary Name"
                            onSave={(v) => onUpdateSetting?.({ bankBeneficiary: v })}
                            onRemove={() => {
                              onUpdateSetting?.({ showBankBeneficiary: false });
                              onElementRemoved?.('showBankBeneficiary', 'Bank Beneficiary');
                            }}
                            removeLabel="Bank Beneficiary"
                          />
                        </td>
                      </tr>
                    )}
                    {cfg.showBankName !== false && (
                      <tr>
                        <td style={{ color: '#64748B', fontWeight: '600', padding: '1px 0' }}>Bank Name:</td>
                        <td style={{ fontWeight: '600', color: '#0F172A' }}>
                          <EditableText
                            value={cfg.bankName}
                            fallback="Bank Name"
                            onSave={(v) => onUpdateSetting?.({ bankName: v })}
                            onRemove={() => {
                              onUpdateSetting?.({ showBankName: false });
                              onElementRemoved?.('showBankName', 'Bank Name');
                            }}
                            removeLabel="Bank Name"
                          />
                        </td>
                      </tr>
                    )}
                    {cfg.showBankAccountNo !== false && (
                      <tr>
                        <td style={{ color: '#64748B', fontWeight: '600', padding: '1px 0' }}>Account No:</td>
                        <td style={{ fontWeight: '800', color: accent, fontFamily: 'monospace', fontSize: '11px' }}>
                          <EditableText
                            value={cfg.bankAccountNo}
                            fallback="Account Number"
                            onSave={(v) => onUpdateSetting?.({ bankAccountNo: v })}
                            onRemove={() => {
                              onUpdateSetting?.({ showBankAccountNo: false });
                              onElementRemoved?.('showBankAccountNo', 'Account Number');
                            }}
                            removeLabel="Account Number"
                          />
                        </td>
                      </tr>
                    )}
                    {cfg.showBankIfsc !== false && (
                      <tr>
                        <td style={{ color: '#64748B', fontWeight: '600', padding: '1px 0' }}>IFSC Code:</td>
                        <td style={{ fontWeight: '700', color: '#0F172A', fontFamily: 'monospace' }}>
                          <EditableText
                            value={cfg.bankIfsc}
                            fallback="IFSC Code"
                            onSave={(v) => onUpdateSetting?.({ bankIfsc: v })}
                            onRemove={() => {
                              onUpdateSetting?.({ showBankIfsc: false });
                              onElementRemoved?.('showBankIfsc', 'IFSC Code');
                            }}
                            removeLabel="IFSC Code"
                          />
                        </td>
                      </tr>
                    )}
                    {cfg.showBankBranch !== false && (
                      <tr>
                        <td style={{ color: '#64748B', fontWeight: '600', padding: '1px 0' }}>Branch:</td>
                        <td style={{ color: '#0F172A' }}>
                          <EditableText
                            value={cfg.bankBranch}
                            fallback="Branch Name"
                            onSave={(v) => onUpdateSetting?.({ bankBranch: v })}
                            onRemove={() => {
                              onUpdateSetting?.({ showBankBranch: false });
                              onElementRemoved?.('showBankBranch', 'Bank Branch');
                            }}
                            removeLabel="Branch"
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </RemovableBlock>
            )}

            {/* TERMS & CONDITIONS */}
            {cfg.showTerms && (
              <RemovableBlock
                visible={cfg.showTerms}
                settingKey="showTerms"
                title="Terms & Conditions"
                style={{ fontSize: '10px', color: '#475569', lineHeight: '1.4' }}
              >
                <div style={{ fontWeight: '700', color: '#0F172A', marginBottom: '2px' }}>
                  <EditableText
                    value={cfg.termsHeading}
                    fallback="Terms & Conditions:"
                    onSave={(v) => onUpdateSetting?.({ termsHeading: v })}
                    onRemove={() => {
                      onUpdateSetting?.({ showTerms: false });
                      onElementRemoved?.('showTerms', 'Terms & Conditions');
                    }}
                    removeLabel="Terms Heading"
                  />
                </div>
                {isEditable ? (
                  <div style={{ marginTop: '3px', whiteSpace: 'pre-line' }}>
                    <EditableText
                      value={cfg.termsText}
                      fallback="Enter terms and conditions (one per line)..."
                      multiline={true}
                      onSave={(v) => onUpdateSetting?.({ termsText: v })}
                    />
                  </div>
                ) : (
                  termsLines.length > 0 && (
                    <ol style={{ margin: 0, paddingLeft: '14px' }}>
                      {termsLines.map((line, lIdx) => (
                        <li key={lIdx}>{line.replace(/^[0-9]+[.)]\s*/, '')}</li>
                      ))}
                    </ol>
                  )
                )}
              </RemovableBlock>
            )}
          </div>

          {/* RIGHT: BREAKDOWN TOTALS + SIGNATURE BOX */}
          <div style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
            {/* TOTALS TABLE */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '6px 14px', color: '#475569', fontWeight: '600' }}>Sub Total (Taxable):</td>
                  <td style={{ padding: '6px 14px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>
                    ₹{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>

                {isIntra ? (
                  gstTiers.map((tier) => (
                    <React.Fragment key={tier.rate}>
                      <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '5px 14px', color: '#475569', fontWeight: '600' }}>
                          CGST ({(tier.rate / 2)}%){gstTiers.length > 1 ? ` (on ${tier.rate}% items)` : ''}:
                        </td>
                        <td style={{ padding: '5px 14px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>
                          ₹{(tier.gstAmt / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '5px 14px', color: '#475569', fontWeight: '600' }}>
                          SGST ({(tier.rate / 2)}%){gstTiers.length > 1 ? ` (on ${tier.rate}% items)` : ''}:
                        </td>
                        <td style={{ padding: '5px 14px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>
                          ₹{(tier.gstAmt / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))
                ) : (
                  gstTiers.map((tier) => (
                    <tr key={tier.rate} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '6px 14px', color: '#475569', fontWeight: '600' }}>
                        IGST ({tier.rate}%){gstTiers.length > 1 ? ` (on ${tier.rate}% items)` : ''}:
                      </td>
                      <td style={{ padding: '6px 14px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>
                        ₹{tier.gstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}

                <tr style={{ borderBottom: `1.5px solid ${accent}`, backgroundColor: `${accent}15` }}>
                  <td style={{ padding: '8px 14px', color: accent, fontWeight: '800', fontSize: '13px' }}>Grand Total:</td>
                  <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: '800', color: accent, fontSize: '14px' }}>
                    ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* SIGNATURE & STAMP BOX */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* CUSTOMER ACCEPTANCE (Optional) */}
              {cfg.showCustomerAcceptance && (
                <RemovableBlock
                  visible={cfg.showCustomerAcceptance}
                  settingKey="showCustomerAcceptance"
                  title="Customer Acceptance Box"
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px dashed #CBD5E1',
                    textAlign: 'center',
                    minHeight: '70px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '700' }}>
                    <EditableText
                      value={cfg.customerAcceptanceHeading}
                      fallback="Customer Acceptance & Signature"
                      onSave={(v) => onUpdateSetting?.({ customerAcceptanceHeading: v })}
                      onRemove={() => {
                        onUpdateSetting?.({ showCustomerAcceptance: false });
                        onElementRemoved?.('showCustomerAcceptance', 'Customer Acceptance');
                      }}
                      removeLabel="Customer Acceptance"
                    />
                  </div>
                  <div style={{ borderBottom: '1px solid #94A3B8', width: '80%', margin: '14px auto 4px auto' }} />
                  <div style={{ fontSize: '9.5px', color: '#94A3B8' }}>
                    <EditableText
                      value={cfg.customerAcceptanceSubtext}
                      fallback="Authorised Signature & Stamp"
                      onSave={(v) => onUpdateSetting?.({ customerAcceptanceSubtext: v })}
                    />
                  </div>
                </RemovableBlock>
              )}

              {/* COMPANY SIGNATORY & STAMP */}
              {cfg.showSignatoryStamp && (
                <RemovableBlock
                  visible={cfg.showSignatoryStamp}
                  settingKey="showSignatoryStamp"
                  title="Signatory & Stamp"
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    textAlign: 'center',
                    minHeight: '155px',
                    backgroundColor: '#FAFAFA'
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#0F172A' }}>
                    <EditableText
                      value={cfg.forCompanyText ? `${cfg.forCompanyText} ${cfg.companyName}` : `For ${cfg.companyName}`}
                      fallback={`For ${cfg.companyName}`}
                      onSave={(v) => {
                        const stripped = v.replace(/^For\s+/i, '');
                        onUpdateSetting?.({ companyName: stripped });
                      }}
                      onRemove={() => onUpdateSetting?.({ showSignatoryStamp: false })}
                    />
                  </div>

                  {/* STAMP & SIGNATURE MEDIA CONTAINER */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    margin: '6px 0',
                    position: 'relative',
                    minHeight: '60px'
                  }}>
                    {/* FROZEN OFFICIAL STAMP DISPLAY */}
                    {cfg.showSignatoryStamp !== false && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <img
                          src={cfg.customStampUrl || (typeof window !== 'undefined' && localStorage.getItem('vrm_constant_stamp')) || VRM_OFFICIAL_STAMP || '/vrm_stamp.png'}
                          alt="VRM Structures Official Stamp"
                          onError={(e) => {
                            if (e.currentTarget.src !== VRM_OFFICIAL_STAMP) {
                              e.currentTarget.src = VRM_OFFICIAL_STAMP;
                            }
                          }}
                          style={{
                            height: '115px',
                            width: '230px',
                            maxWidth: '240px',
                            maxHeight: '120px',
                            objectFit: 'contain'
                          }}
                        />
                      </div>
                    )}

                    {/* SIGNATURE DISPLAY */}
                    {cfg.signatureMode && cfg.signatureMode !== 'none' && (
                      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                        {cfg.signatureMode === 'custom' && cfg.customSignatureUrl ? (
                          <img
                            src={cfg.customSignatureUrl}
                            alt="Authorized Signature"
                            style={{
                              maxHeight: '44px',
                              maxWidth: '120px',
                              objectFit: 'contain'
                            }}
                          />
                        ) : cfg.signatureMode === 'vector' ? (
                          <svg width="105" height="28" viewBox="0 0 105 28">
                            <path d="M 10 20 Q 30 5 55 18 T 95 12" stroke={accent} strokeWidth="1.8" fill="none" />
                          </svg>
                        ) : cfg.signatureMode === 'blank' ? (
                          <div style={{ width: '100px', borderBottom: '1px dashed #94A3B8', height: '24px' }} />
                        ) : null}
                        {isEditable && (
                          <button
                            type="button"
                            className="no-print"
                            onClick={() => {
                              onUpdateSetting?.({ signatureMode: 'none' });
                              onElementRemoved?.('signatureMode', 'Authorized Signature');
                            }}
                            title="Remove Authorized Signature"
                            style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '-10px',
                              backgroundColor: '#EF4444',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '50%',
                              width: '16px',
                              height: '16px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: '800',
                              cursor: 'pointer',
                              padding: 0,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                              zIndex: 10
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* SIGNATORY NAME & TITLE */}
                  <div>
                    {cfg.signatoryName ? (
                      <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#0F172A', marginBottom: '1px' }}>
                        <EditableText
                          value={cfg.signatoryName}
                          fallback=""
                          onSave={(v) => onUpdateSetting?.({ signatoryName: v })}
                          onRemove={() => onUpdateSetting?.({ signatoryName: '' })}
                          removeLabel="Signatory Name"
                        />
                      </div>
                    ) : null}
                    {cfg.signatoryTitle !== '' && (
                      <div style={{ fontSize: '10px', fontWeight: '700', color: '#475569' }}>
                        <EditableText
                          value={cfg.signatoryTitle}
                          fallback="Authorized Signatory"
                          onSave={(v) => onUpdateSetting?.({ signatoryTitle: v })}
                          onRemove={() => onUpdateSetting?.({ signatoryTitle: '' })}
                          removeLabel="Authorized Signatory"
                        />
                      </div>
                    )}
                  </div>

                </RemovableBlock>
              )}
            </div>

          </div>
        </div>

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
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748B', cursor: 'pointer' }}>
                  <input
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
                    <input
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
              <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '6px' }}>
                Document Title
              </label>
              <input
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

              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '11.5px', color: '#334155' }}>
                <span>Show GSTIN & CIN Numbers</span>
                <input
                  type="checkbox"
                  checked={settings.showCinGst}
                  onChange={(e) => onUpdateSettings({ showCinGst: e.target.checked })}
                  style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '11.5px', color: '#334155' }}>
                <span>Show Company Address & Contact</span>
                <input
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
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748B', cursor: 'pointer' }}>
                  <input
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
                        <label style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}>Seal Header Text</label>
                        <input
                          type="text"
                          value={settings.stampText}
                          onChange={(e) => onUpdateSettings({ stampText: e.target.value })}
                          style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}>Seal Location Subtitle</label>
                        <input
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
                        <input
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
                      <input
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
                    <label style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}>Signatory Name (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. M. Annamalaiyar"
                      value={settings.signatoryName || ''}
                      onChange={(e) => onUpdateSettings({ signatoryName: e.target.value })}
                      style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}>Designation Title</label>
                    <input
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
              <input
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

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Rate (₹) Column</span>
              <input
                type="checkbox"
                checked={settings.showRateCol !== false}
                onChange={(e) => onUpdateSettings({ showRateCol: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>HSN / SAC Code Column</span>
              <input
                type="checkbox"
                checked={settings.showHsn}
                onChange={(e) => onUpdateSettings({ showHsn: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Taxable Value (₹) Column</span>
              <input
                type="checkbox"
                checked={settings.showTaxableCol !== false}
                onChange={(e) => onUpdateSettings({ showTaxableCol: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Quantity Column</span>
              <input
                type="checkbox"
                checked={settings.showQty !== false}
                onChange={(e) => onUpdateSettings({ showQty: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Unit of Measure (UOM) Column</span>
              <input
                type="checkbox"
                checked={settings.showUom}
                onChange={(e) => onUpdateSettings({ showUom: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Total / Amount (₹) Column</span>
              <input
                type="checkbox"
                checked={settings.showTotalCol !== false}
                onChange={(e) => onUpdateSettings({ showTotalCol: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Discount Column</span>
              <input
                type="checkbox"
                checked={settings.showDiscountCol}
                onChange={(e) => onUpdateSettings({ showDiscountCol: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Line Item GST% Column</span>
              <input
                type="checkbox"
                checked={settings.showGstCol}
                onChange={(e) => onUpdateSettings({ showGstCol: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>S.No Column</span>
              <input
                type="checkbox"
                checked={settings.showSnoCol !== false}
                onChange={(e) => onUpdateSettings({ showSnoCol: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Item Technical Descriptions</span>
              <input
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
              <input
                type="checkbox"
                checked={settings.showShipTo}
                onChange={(e) => onUpdateSettings({ showShipTo: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Show Dispatch & Vehicle Details</span>
              <input
                type="checkbox"
                checked={settings.showTransportDetails}
                onChange={(e) => onUpdateSettings({ showTransportDetails: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
              <span>Show Sales Executive Name</span>
              <input
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
              <input
                type="checkbox"
                checked={settings.showBankDetails}
                onChange={(e) => onUpdateSettings({ showBankDetails: e.target.checked })}
                style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
              />
            </label>

            {settings.showBankDetails && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                <div>
                  <label style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748B' }}>Beneficiary Name</label>
                  <input
                    type="text"
                    value={settings.bankBeneficiary}
                    onChange={(e) => onUpdateSettings({ bankBeneficiary: e.target.value })}
                    style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748B' }}>Bank Name</label>
                  <input
                    type="text"
                    value={settings.bankName}
                    onChange={(e) => onUpdateSettings({ bankName: e.target.value })}
                    style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748B' }}>Account No.</label>
                    <input
                      type="text"
                      value={settings.bankAccountNo}
                      onChange={(e) => onUpdateSettings({ bankAccountNo: e.target.value })}
                      style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748B' }}>IFSC Code</label>
                    <input
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
                <input
                  type="checkbox"
                  checked={settings.showTerms}
                  onChange={(e) => onUpdateSettings({ showTerms: e.target.checked })}
                  style={{ accentColor: settings.accentColor, cursor: 'pointer' }}
                />
              </label>

              {settings.showTerms && (
                <div>
                  <label style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                    Edit Terms (1 per line)
                  </label>
                  <textarea
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

    return () => {
      isMounted = false;
      unsub();
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
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
