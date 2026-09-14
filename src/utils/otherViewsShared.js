import { saveCloudStore } from './supabaseDataSync';
export {
  saveMediaToCache,
  getMediaFromCache,
  getMediaFromCacheAsync,
  stripDataUrlsFromRecord,
  readCompressedImage,
  compressAndSaveFile
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
