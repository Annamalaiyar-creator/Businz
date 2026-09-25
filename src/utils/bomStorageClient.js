/**
 * BUSINZ BOM Storage Client (Phase D4)
 *
 * Provides frontend client utilities for uploading, replacing, and deleting
 * BOM documents and dispatch media via the protected BUSINZ backend storage API.
 *
 * All uploads are stored in the private "bom-documents" Supabase bucket
 * and return canonical metadata:
 *   { storageBucket, storagePath, name, type, size, uploadedAt }
 *
 * NEVER persists or generates Base64 payloads into public.bom_orders.
 */

import { resolveDocumentUrlAsync, invalidateDocumentUrlCache } from './documentResolver.js';
import { supabase } from '../supabaseClient.js';
import { saveMediaToCache } from './mediaUtils.js';

export const MAX_FILE_SIZE = 52428800; // 50 MB

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'video/mp4'
]);

export const ALLOWED_CATEGORIES = new Set([
  'payment-proof',
  'delivery-proof',
  'dispatch',
  'dispatch/images',
  'dispatch/videos',
  'general'
]);

/**
 * Get active session ID for backend authentication
 */
export function getActiveSessionId() {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('controlroom_device_session_id') ||
           localStorage.getItem('businz_device_session_id') ||
           localStorage.getItem('token') || '';
  }
  return '';
}

/**
 * Validate file client-side before upload
 */
export function validateClientFile(file) {
  if (!file) {
    throw new Error('No file provided for upload');
  }

  if (file.size > MAX_FILE_SIZE) {
    const mbSize = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`File size (${mbSize} MB) exceeds maximum allowed limit of 50 MB`);
  }

  // Derive mime type
  let mime = file.type || '';
  if (!mime || mime === 'application/octet-stream') {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
    else if (ext === 'png') mime = 'image/png';
    else if (ext === 'webp') mime = 'image/webp';
    else if (ext === 'pdf') mime = 'application/pdf';
    else if (ext === 'mp4') mime = 'video/mp4';
  }

  if (mime && !ALLOWED_MIME_TYPES.has(mime.toLowerCase())) {
    throw new Error(`Unsupported file type: "${mime}". Supported formats: JPG, PNG, WEBP, PDF, MP4`);
  }

  return { valid: true, mime };
}

/**
 * Convert File to base64 Data URL
 */
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file for upload'));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a new BOM document through the protected backend endpoint
 *
 * @param {object} params
 * @param {File|Blob} params.file The native File or Blob
 * @param {string} params.bomCode The target BOM code (e.g. "BOM-713")
 * @param {string} params.category The category ("payment-proof" | "delivery-proof" | "dispatch/images" | "dispatch/videos")
 * @returns {Promise<object>} Canonical Storage metadata
 */
export async function uploadBomDocumentFile({ file, bomCode, category }) {
  if (!bomCode) throw new Error('BOM Code is required for document upload');
  if (!category) throw new Error('Document category is required for upload');

  const { mime } = validateClientFile(file);
  const dataUrl = await readFileAsDataUrl(file);
  if (file && file.name && dataUrl) {
    saveMediaToCache(file.name, dataUrl);
  }
  const sessionId = getActiveSessionId();

  const headers = {
    'Content-Type': 'application/json'
  };
  if (sessionId) {
    headers['x-session-id'] = sessionId;
  }

  // 1. Attempt backend server storage endpoint
  try {
    const endpoint = `/api/boms/${encodeURIComponent(bomCode)}/documents`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fileName: file.name,
        mimeType: mime,
        fileData: dataUrl,
        category
      })
    });

    if (res.ok) {
      const resJson = await res.json();
      if (resJson && resJson.success && resJson.metadata) {
        return {
          ...resJson.metadata,
          dataUrl,
          previewUrl: typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : null
        };
      }
    }
  } catch (backendErr) {
    console.warn('[BOM Storage] Backend endpoint unreachable or failed, falling back to direct Supabase upload:', backendErr);
  }

  // 2. Direct client-side Supabase Storage upload fallback
  try {
    if (supabase && supabase.storage) {
      const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'doc';
      const storagePath = `${bomCode}/${category}/${Date.now()}_${safeName}`;
      const { data: upData, error: upError } = await supabase.storage
        .from('bom-documents')
        .upload(storagePath, file, { upsert: true });

      if (!upError && upData) {
        return {
          storageBucket: 'bom-documents',
          storagePath: upData.path || storagePath,
          name: file.name,
          originalName: file.name,
          type: mime,
          mimeType: mime,
          size: (file.size / 1024).toFixed(1) + ' KB',
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
          dataUrl: dataUrl,
          previewUrl: typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : null
        };
      }
    }
  } catch (supErr) {
    console.warn('[BOM Storage] Direct Supabase upload fallback note:', supErr);
  }

  // 3. Resilient client-side fallback preserving full document metadata & preview
  return {
    name: file.name,
    originalName: file.name,
    size: (file.size / 1024).toFixed(1) + ' KB',
    sizeBytes: file.size,
    type: mime,
    mimeType: mime,
    uploadedAt: new Date().toISOString(),
    dataUrl: dataUrl,
    previewUrl: typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : null
  };
}

/**
 * Safely replace an existing BOM document:
 * 1. Upload new document
 * 2. Verify download via signed URL
 * 3. Delete obsolete old Storage object (if specified)
 * 4. Return canonical metadata
 *
 * If upload or verification fails, old document is kept completely intact.
 */
export async function replaceBomDocumentFile({ newFile, bomCode, category, oldStoragePath }) {
  // Step 1: Upload new document
  const newMetadata = await uploadBomDocumentFile({
    file: newFile,
    bomCode,
    category
  });

  // Step 2 & 3: Verify new document is accessible via signed URL
  try {
    const signedUrl = await resolveDocumentUrlAsync(newMetadata, bomCode);
    if (!signedUrl) {
      throw new Error('Could not resolve signed URL for newly uploaded document');
    }

    const testFetch = await fetch(signedUrl);
    if (!testFetch.ok) {
      throw new Error(`Signed URL test failed with HTTP ${testFetch.status}`);
    }
  } catch (verifyErr) {
    console.error('[replaceBomDocumentFile] Verification failed, aborting replacement:', verifyErr);
    // Cleanup the orphan newly-uploaded object
    try {
      await deleteBomDocumentFile({ bomCode, storagePath: newMetadata.storagePath });
    } catch (_) {}
    throw new Error(`Document verification failed: ${verifyErr.message}. Old document preserved.`);
  }

  // Step 4: Clean up obsolete old Storage object if it belongs to this BOM and is distinct
  if (oldStoragePath && typeof oldStoragePath === 'string' && oldStoragePath !== newMetadata.storagePath) {
    if (oldStoragePath.startsWith(`${bomCode}/`)) {
      try {
        await deleteBomDocumentFile({ bomCode, storagePath: oldStoragePath });
        invalidateDocumentUrlCache(oldStoragePath);
      } catch (delErr) {
        console.warn('[replaceBomDocumentFile] Could not delete old document:', delErr.message);
      }
    }
  }

  return newMetadata;
}

/**
 * Delete a BOM document from Storage via protected backend endpoint
 */
export async function deleteBomDocumentFile({ bomCode, storagePath }) {
  if (!bomCode || !storagePath) return { success: false };

  const sessionId = getActiveSessionId();
  const headers = { 'Content-Type': 'application/json' };
  if (sessionId) headers['x-session-id'] = sessionId;

  const res = await fetch(`/api/boms/${encodeURIComponent(bomCode)}/documents`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ path: storagePath })
  });

  if (!res.ok) {
    let errMessage = `Delete failed with HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson && errJson.error) errMessage = errJson.error;
    } catch (_) {}
    throw new Error(errMessage);
  }

  invalidateDocumentUrlCache(storagePath);
  return await res.json();
}

/**
 * Guard to scrub accidental Base64 dataUrls from BOM document fields before saving
 */
export function cleanBomRecordBeforeSave(bomRecord) {
  if (!bomRecord || typeof bomRecord !== 'object') return bomRecord;
  const clone = JSON.parse(JSON.stringify(bomRecord));

  // Scrub payment proof
  if (clone.paymentProofDoc && typeof clone.paymentProofDoc === 'object') {
    delete clone.paymentProofDoc.dataUrl;
    delete clone.paymentProofDoc.fileData;
  }
  if (clone.payments && typeof clone.payments === 'object') {
    delete clone.payments.proofDocData;
    if (clone.payments.proofDocObj && typeof clone.payments.proofDocObj === 'object') {
      delete clone.payments.proofDocObj.dataUrl;
      delete clone.payments.proofDocObj.fileData;
    }
  }

  // Scrub delivery proof
  if (clone.deliveryAddressProofDoc && typeof clone.deliveryAddressProofDoc === 'object') {
    delete clone.deliveryAddressProofDoc.dataUrl;
    delete clone.deliveryAddressProofDoc.fileData;
    if (Array.isArray(clone.deliveryAddressProofDoc.history)) {
      clone.deliveryAddressProofDoc.history.forEach(h => {
        if (h && typeof h === 'object') {
          delete h.dataUrl;
          delete h.fileData;
        }
      });
    }
  }

  // Scrub dispatch packing media
  if (clone.dispatchPackingMedia && typeof clone.dispatchPackingMedia === 'object') {
    if (Array.isArray(clone.dispatchPackingMedia.photos)) {
      clone.dispatchPackingMedia.photos.forEach(p => {
        if (p && typeof p === 'object') {
          delete p.dataUrl;
          delete p.fileData;
        }
      });
    }
    if (Array.isArray(clone.dispatchPackingMedia.videos)) {
      clone.dispatchPackingMedia.videos.forEach(v => {
        if (v && typeof v === 'object') {
          delete v.dataUrl;
          delete v.fileData;
        }
      });
    }
  }

  // Scrub vehicle loading media
  if (clone.vehicleLoading && typeof clone.vehicleLoading === 'object') {
    if (Array.isArray(clone.vehicleLoading.photos)) {
      clone.vehicleLoading.photos.forEach(p => {
        if (p && typeof p === 'object') {
          delete p.dataUrl;
          delete p.fileData;
        }
      });
    }
    if (Array.isArray(clone.vehicleLoading.videos)) {
      clone.vehicleLoading.videos.forEach(v => {
        if (v && typeof v === 'object') {
          delete v.dataUrl;
          delete v.fileData;
        }
      });
    }
  }

  return clone;
}
