import { VRM_OFFICIAL_LOGO, VRM_OFFICIAL_STAMP } from '../../utils/vrmOfficialAssets';

// Default Template Configuration Settings
export const DEFAULT_PI_TEMPLATE_SETTINGS = {
  // Theme & Identity
  accentColor: '#1E2F5B', // Official VRM Blue (from VRM Logo)
  documentTitle: 'Proforma Invoice',
  companyName: 'VRM STRUCTURES INDIA PRIVATE LIMITED',
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
  companyAddressLine1: '1427, GNT Road, Nagappa Industrial Estate, Puzhal,',
  companyAddressLine2: 'Chennai, Tamil Nadu 600066\nIndia',
  companyGstin: '33AAGCV4262N1ZZ',
  companyCin: '',
  companyUdyam: '',
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
  showSetKwCol: true,
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
  colHeaderSetKw: 'Set / kW',
  setKwColLabel: 'Set / kW',
  colHeaderQty: 'Qty / Set',
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
  bankIfsc: 'HDFC0007315',
  bankBranch: 'VINAYAGAPURAM BRANCH',
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

export const COLOR_PRESETS = [
  { name: 'VRM Blue', hex: '#1E2F5B' },
  { name: 'Royal Navy', hex: '#1E3A8A' },
  { name: 'Tech Cobalt', hex: '#2563EB' },
  { name: 'Emerald Forest', hex: '#059669' },
  { name: 'Charcoal Slate', hex: '#1E293B' },
  { name: 'Crimson Burgundy', hex: '#991B1B' }
];

export const TITLE_PRESETS = ['PROFORMA INVOICE', 'QUOTATION', 'ESTIMATE', 'PROFORMA TAX INVOICE'];

// Lightweight canvas image compressor to safely store in localStorage
export const compressImageFile = (file, maxDim = 450, quality = 0.85) => {
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

// Safely resolve print image URLs, preventing unreachable localhost/dev URLs from stalling html2canvas on live servers
export const getSafePrintImageUrl = (url, fallback) => {
  if (!url || typeof url !== 'string') return fallback;
  if (url.startsWith('data:image/')) return url;
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    if (url.includes('localhost:') || url.includes('127.0.0.1:') || url.includes('192.168.')) {
      return fallback;
    }
  }
  return url;
};

// Helper to convert number to Indian Rupees in words
export function numberToWordsINR(num) {
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

// Format date nicely (DD-MM-YYYY to match official format)
export function formatDate(dateStr) {
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

// Format date in official long document format (e.g. "29 October 2026") matching redesigned PI template
export function formatDocumentDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch (e) {
    return dateStr;
  }
}
