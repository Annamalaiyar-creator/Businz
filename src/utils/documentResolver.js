/**
 * BUSINZ BOM Document Resolver (Phase D2)
 *
 * Provides a backward-compatible resolution layer for BOM documents.
 * Prioritizes:
 * 1. Storage Metadata (storageBucket + storagePath) -> requests short-lived signed URL from backend
 * 2. Legacy Base64 dataUrl / fileData / proofDocData
 * 3. Existing static / server URL (http://, https://, /api/uploads/...)
 * 4. Local media cache fallback (IndexedDB / memory map)
 */

import { getMediaFromCache } from './mediaUtils.js';

// Client-side in-memory cache for generated signed URLs: storagePath -> { signedUrl, expiresAt }
const signedUrlCache = new Map();

/**
 * Check if an object is a Storage-backed document
 */
export function isStorageDocument(doc) {
  return Boolean(
    doc &&
    typeof doc === 'object' &&
    doc.storageBucket &&
    doc.storagePath
  );
}

/**
 * Get human-readable file name from any document shape
 */
export function getDocumentDisplayName(doc, fallback = 'Document') {
  if (!doc) return fallback;
  if (typeof doc === 'string') {
    if (doc.startsWith('data:')) return fallback;
    return doc.split('/').pop() || fallback;
  }
  return doc.name || doc.fileName || doc.title || fallback;
}

/**
 * Format document size in human-readable units
 */
export function getDocumentSizeLabel(doc) {
  if (!doc) return '';
  if (typeof doc === 'object') {
    if (typeof doc.size === 'string') return doc.size;
    if (typeof doc.size === 'number' && Number.isFinite(doc.size)) {
      if (doc.size >= 1024 * 1024) {
        return `${(doc.size / (1024 * 1024)).toFixed(1)} MB`;
      }
      return `${Math.round(doc.size / 1024)} KB`;
    }
  }
  return '';
}

/**
 * Synchronous document URL resolver.
 * Immediately returns available dataUrl, URL, or cached signed URL without network round-trip.
 *
 * @param {object|string} doc The document object or dataUrl string
 * @returns {string|null} Resolved direct URL, data URL, or null if async fetch needed
 */
export function resolveDocumentUrl(doc) {
  if (!doc) return null;

  // 1. Raw string dataUrl or HTTP URL
  if (typeof doc === 'string') {
    if (doc.startsWith('data:') || doc.startsWith('http://') || doc.startsWith('https://') || doc.startsWith('/')) {
      return doc;
    }
    // Check if it's a document name cached locally
    return getMediaFromCache(doc) || null;
  }

  // 2. Storage-backed document: check in-memory signed URL cache
  if (isStorageDocument(doc)) {
    const cached = signedUrlCache.get(doc.storagePath);
    // Use cached signed URL if not expired (with 60-second safety cushion)
    if (cached && cached.expiresAt > Date.now() + 60000) {
      return cached.signedUrl;
    }
  }

  // 3. Backward compatibility: check embedded dataUrl / fileData
  if (doc.dataUrl && typeof doc.dataUrl === 'string') {
    return doc.dataUrl;
  }
  if (doc.fileData && typeof doc.fileData === 'string') {
    return doc.fileData;
  }
  if (doc.proofDocData && typeof doc.proofDocData === 'string') {
    return doc.proofDocData;
  }

  // 4. Backward compatibility: check direct url
  if (doc.url && typeof doc.url === 'string') {
    return doc.url;
  }

  // 5. Check local media cache by document name
  if (doc.name) {
    const fromCache = getMediaFromCache(doc.name);
    if (fromCache) return fromCache;
  }

  return null;
}

/**
 * Asynchronous document URL resolver.
 * Handles fetching short-lived signed URLs from the backend when needed.
 *
 * Resolution Priority:
 * 1. Storage Metadata -> Backend Signed URL (cached in-memory for session)
 * 2. Legacy dataUrl / fileData
 * 3. Existing URL
 * 4. Fallback: null
 *
 * @param {object|string} doc
 * @param {string} [bomCode] Optional BOM code for path scoping (e.g. "BOM-713")
 * @returns {Promise<string|null>}
 */
export async function resolveDocumentUrlAsync(doc, bomCode = null) {
  if (!doc) return null;

  // Check synchronous options first
  const immediate = resolveDocumentUrl(doc);
  if (immediate) return immediate;

  // If it's a Storage document, fetch a signed URL from the backend
  if (isStorageDocument(doc)) {
    try {
      const targetBom = bomCode || doc.storagePath.split('/')[0];
      const sessionId = typeof localStorage !== 'undefined' ? localStorage.getItem('controlroom_device_session_id') : null;

      const headers = { 'Content-Type': 'application/json' };
      if (sessionId) headers['x-session-id'] = sessionId;

      const res = await fetch(
        `/api/boms/${encodeURIComponent(targetBom)}/documents/signed-url?path=${encodeURIComponent(doc.storagePath)}`,
        { headers }
      );

      if (res.ok) {
        const json = await res.json();
        if (json && json.signedUrl) {
          const expiresIn = json.expiresIn || 900;
          signedUrlCache.set(doc.storagePath, {
            signedUrl: json.signedUrl,
            expiresAt: Date.now() + expiresIn * 1000
          });
          return json.signedUrl;
        }
      }
    } catch (err) {
      console.warn('[DocumentResolver] Error fetching signed URL:', err);
    }
  }

  return null;
}

/**
 * Invalidate cached signed URL for a specific storage path
 */
export function invalidateDocumentUrlCache(storagePath) {
  if (storagePath) {
    signedUrlCache.delete(storagePath);
  }
}

/**
 * Clear entire signed URL in-memory cache (e.g. on logout)
 */
export function clearDocumentUrlCache() {
  signedUrlCache.clear();
}
