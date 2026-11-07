import { saveCloudStore } from './supabaseDataSync.js';
export {
  saveMediaToCache,
  getMediaFromCache,
  getMediaFromCacheAsync,
  stripDataUrlsFromRecord,
  readCompressedImage,
  compressAndSaveFile,
  uploadMediaFile
} from './mediaUtils.js';

/**
 * Universal safe number parser: strips currency symbols, commas, spaces and handles NaN/null/undefined.
 * Always returns a guaranteed finite number.
 */
export const cleanNum = (val, defaultVal = 0) => {
  if (typeof val === 'number') return Number.isFinite(val) ? val : defaultVal;
  if (!val) return defaultVal;
  const str = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(str);
  return Number.isFinite(parsed) ? parsed : defaultVal;
};

/**
 * Universal safe Indian currency formatter: guaranteed to never render 'NaN'.
 */
export const formatCurrency = (val, decimals = 2) => {
  const num = cleanNum(val, 0);
  return `₹ ${num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`;
};

/**
 * The only 4 approved Payment Terms for PI and BOM
 */
export const STANDARD_PAYMENT_TERMS = [
  '100% Paid',
  'Partial Paid',
  'Payment While Dispatch',
  'Credit Payment'
];

/**
 * Universal payment term normalizer: strictly maps all historical / ad-hoc terms into the 4 approved options
 */
export const normalizePaymentTerm = (term) => {
  if (!term) return '100% Paid';
  const s = String(term).trim().toLowerCase();
  if (s.startsWith('partial') || s === 'partial paid' || s === 'partial payment') {
    return 'Partial Paid';
  }
  if (s.includes('dispatch') || s.includes('while dispatch')) {
    return 'Payment While Dispatch';
  }
  if (s.includes('credit') || s.includes('net ') || s.includes('days')) {
    return 'Credit Payment';
  }
  if (s.includes('100%') || s.includes('advance') || s.includes('paid') || s.includes('full')) {
    return '100% Paid';
  }
  return '100% Paid';
};

/**
 * Parse an address string or object into structured components: address1, address2, city, state, pincode
 */
export const parseAddressString = (addrStr) => {
  if (!addrStr) {
    return { address1: '', address2: '', city: '', state: '', pincode: '' };
  }
  if (typeof addrStr === 'object') {
    return {
      address1: addrStr.address1 || addrStr.line1 || addrStr.street || '',
      address2: addrStr.address2 || addrStr.line2 || addrStr.area || '',
      city: addrStr.city || '',
      state: addrStr.state || '',
      pincode: addrStr.pincode || addrStr.pin || addrStr.zip || ''
    };
  }
  const str = String(addrStr).trim();
  if (!str || str === '—') {
    return { address1: '', address2: '', city: '', state: '', pincode: '' };
  }

  let pincode = '';
  const pinMatch = str.match(/\b(\d{6})\b/);
  if (pinMatch) {
    pincode = pinMatch[1];
  }

  let cleanStr = str.replace(/(?:pin(?:\s*code)?[:\s]*)?\b\d{6}\b/gi, '').replace(/[,\-\s]+$/, '').trim();
  const parts = cleanStr.split(',').map(p => p.trim()).filter(Boolean);

  if (parts.length === 0) {
    return { address1: str, address2: '', city: '', state: '', pincode };
  }
  if (parts.length === 1) {
    return { address1: parts[0], address2: '', city: '', state: '', pincode };
  }
  if (parts.length === 2) {
    return { address1: parts[0], address2: '', city: parts[1], state: '', pincode };
  }
  if (parts.length === 3) {
    return { address1: parts[0], address2: '', city: parts[1], state: parts[2], pincode };
  }
  if (parts.length === 4) {
    return { address1: parts[0], address2: parts[1], city: parts[2], state: parts[3], pincode };
  }
  const state = parts[parts.length - 1];
  const city = parts[parts.length - 2];
  const address1 = parts[0];
  const address2 = parts.slice(1, parts.length - 2).join(', ');
  return { address1, address2, city, state, pincode };
};

/**
 * Format structured address components into a single coherent address string
 */
export const formatAddressObj = (input) => {
  if (!input) return '';
  const a1 = (input.address1 || input.line1 || '').trim();
  const a2 = (input.address2 || input.line2 || '').trim();
  const city = (input.city || '').trim();
  const state = (input.state || '').trim();
  const pin = (input.pincode || input.pin || '').trim();

  const parts = [];
  if (a1) parts.push(a1);
  if (a2) parts.push(a2);
  if (city) parts.push(city);
  let statePin = '';
  if (state) statePin += state;
  if (pin) {
    statePin += (statePin ? ` - ${pin}` : pin);
  }
  if (statePin) parts.push(statePin);
  return parts.join(', ');
};

/**
 * Universal Vendor/Customer multi-location resolver.
 * Parses and returns an array of recognized branches/plants/warehouses with structured addresses and GST.
 */
export const getVendorLocations = (vendor) => {
  if (!vendor || typeof vendor !== 'object') return [];
  const locs = [];

  // 1. Explicit locations or addresses array
  if (Array.isArray(vendor.locations) && vendor.locations.length > 0) {
    vendor.locations.forEach((loc, idx) => {
      const parsed = parseAddressString(loc);
      locs.push({
        id: loc.id || `loc_${idx}`,
        label: loc.label || loc.name || `Location ${idx + 1}`,
        address1: loc.address1 || loc.address_1 || parsed.address1 || '',
        address2: loc.address2 || loc.address_2 || parsed.address2 || '',
        city: loc.city || parsed.city || '',
        state: loc.state || parsed.state || '',
        pincode: loc.pincode || loc.zip || parsed.pincode || '',
        gst: loc.gst || loc.gstin || vendor.gstin || vendor.gstNo || ''
      });
    });
  }

  if (Array.isArray(vendor.addresses) && vendor.addresses.length > 0) {
    vendor.addresses.forEach((addr, idx) => {
      const parsed = parseAddressString(addr);
      locs.push({
        id: addr.id || `addr_${idx}`,
        label: addr.label || addr.name || addr.address_type || `Branch ${idx + 1}`,
        address1: addr.address1 || addr.address_1 || parsed.address1 || '',
        address2: addr.address2 || addr.address_2 || parsed.address2 || '',
        city: addr.city || parsed.city || '',
        state: addr.state || parsed.state || '',
        pincode: addr.pincode || addr.zip || parsed.pincode || '',
        gst: addr.gst || addr.gstin || vendor.gstin || vendor.gstNo || ''
      });
    });
  }

  // 2. Billing / Registered Head Office
  const billAddr = vendor.billingAddress || vendor.billing_address || vendor.registeredAddress || vendor.address || '';
  if (billAddr) {
    const parsedBill = parseAddressString(billAddr);
    const hasBill = locs.some(l => l.address1 && parsedBill.address1 && l.address1.toLowerCase().includes(parsedBill.address1.toLowerCase()));
    if (!hasBill) {
      locs.unshift({
        id: 'registered_office',
        label: 'Registered / Head Office',
        address1: vendor.billingAddress1 || vendor.address_1 || parsedBill.address1 || '',
        address2: vendor.billingAddress2 || vendor.address_2 || parsedBill.address2 || '',
        city: vendor.billingCity || vendor.city || parsedBill.city || '',
        state: vendor.billingState || vendor.state || parsedBill.state || '',
        pincode: vendor.billingPincode || vendor.zip || parsedBill.pincode || '',
        gst: vendor.gstin || vendor.gstNo || ''
      });
    }
  }

  // 3. Shipping / Factory / Plant / Yard Address
  const shipAddr = vendor.shippingAddress || vendor.shipping_address || vendor.deliveryAddress || vendor.factoryAddress || vendor.plantAddress || '';
  if (shipAddr && shipAddr !== billAddr) {
    const parsedShip = parseAddressString(shipAddr);
    const hasShip = locs.some(l => l.address1 && parsedShip.address1 && l.address1.toLowerCase().includes(parsedShip.address1.toLowerCase()));
    if (!hasShip) {
      locs.push({
        id: 'factory_plant',
        label: 'Factory / Manufacturing Plant',
        address1: vendor.shippingAddress1 || parsedShip.address1 || '',
        address2: vendor.shippingAddress2 || parsedShip.address2 || '',
        city: vendor.shippingCity || parsedShip.city || '',
        state: vendor.shippingState || parsedShip.state || '',
        pincode: vendor.shippingPincode || parsedShip.pincode || '',
        gst: vendor.shippingGst || vendor.gstin || vendor.gstNo || ''
      });
    }
  }

  // 4. Warehouse / Stockyard if present
  const whAddr = vendor.warehouseAddress || vendor.stockyardAddress || vendor.yardAddress || '';
  if (whAddr && whAddr !== billAddr && whAddr !== shipAddr) {
    const parsedWh = parseAddressString(whAddr);
    locs.push({
      id: 'warehouse_yard',
      label: 'Warehouse / Stockyard',
      address1: parsedWh.address1 || '',
      address2: parsedWh.address2 || '',
      city: parsedWh.city || '',
      state: parsedWh.state || '',
      pincode: parsedWh.pincode || '',
      gst: vendor.gstin || vendor.gstNo || ''
    });
  }

  return locs;
};



