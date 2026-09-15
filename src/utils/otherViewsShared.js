import { saveCloudStore } from './supabaseDataSync';
export {
  saveMediaToCache,
  getMediaFromCache,
  getMediaFromCacheAsync,
  stripDataUrlsFromRecord,
  readCompressedImage,
  compressAndSaveFile,
  uploadMediaFile
} from './mediaUtils';

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
  if (s.includes('partial') || s.includes('advance +') || s.includes('50%')) {
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

