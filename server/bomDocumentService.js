import path from 'path';
import crypto from 'crypto';
import { supabaseAdmin } from './supabaseAdmin.js';

export const BUCKET_NAME = 'bom-documents';
export const MAX_FILE_SIZE = 52428800; // 50 MB limit
export const DEFAULT_SIGNED_URL_EXPIRY = 900; // 15 minutes in seconds

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

const EXTENSION_MAP = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'video/mp4': ['.mp4']
};

/**
 * Validate BOM Code format (e.g. BOM-713, BOM-TEST-VERIFY)
 * Disallows path traversal, slashes, and control characters.
 */
export function validateBomCode(bomCode) {
  if (!bomCode || typeof bomCode !== 'string') {
    throw new Error('Invalid BOM Code: must be a non-empty string');
  }
  const clean = bomCode.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(clean) || clean.includes('..')) {
    throw new Error(`Invalid BOM Code format: "${clean}". Only alphanumeric, dashes, and underscores allowed.`);
  }
  return clean;
}

/**
 * Sanitize original file name for safe storage.
 * Strips directory traversal, special control characters, and normalizes extensions.
 */
export function sanitizeFileName(originalName) {
  if (!originalName || typeof originalName !== 'string') {
    return `document_${Date.now()}`;
  }
  // Strip path segments
  const basename = path.basename(originalName.trim().replace(/[\\/]/g, '/'));
  // Remove dangerous characters, allow only safe characters
  const clean = basename.replace(/[^A-Za-z0-9._-]/g, '_').replace(/\.{2,}/g, '.');
  return clean || `document_${Date.now()}`;
}

/**
 * Validate that storagePath strictly belongs to the specified BOM code and has no traversal.
 */
export function validateStoragePathBelongsToBom(bomCode, storagePath) {
  const cleanBom = validateBomCode(bomCode);
  if (!storagePath || typeof storagePath !== 'string') {
    throw new Error('Invalid storage path: must be a non-empty string');
  }
  const normalized = storagePath.trim().replace(/\\/g, '/').replace(/\/+/g, '/');

  // Prevent path traversal
  if (normalized.includes('..') || normalized.startsWith('/') || normalized.includes('://')) {
    throw new Error('Path traversal detected: invalid storage path');
  }

  // Cross-BOM protection: MUST start with `${cleanBom}/`
  const expectedPrefix = `${cleanBom}/`;
  if (!normalized.startsWith(expectedPrefix)) {
    throw new Error(`Access denied: Storage path "${normalized}" does not belong to BOM "${cleanBom}"`);
  }

  return normalized;
}

/**
 * Validate category
 */
export function validateCategory(category) {
  if (!category || typeof category !== 'string') {
    return 'general';
  }
  const clean = category.trim().toLowerCase();
  if (!ALLOWED_CATEGORIES.has(clean)) {
    throw new Error(`Invalid category "${clean}". Allowed: ${Array.from(ALLOWED_CATEGORIES).join(', ')}`);
  }
  return clean;
}

/**
 * Validate MIME type
 */
export function validateMimeType(mimeType) {
  if (!mimeType || typeof mimeType !== 'string') {
    throw new Error('MIME type is required');
  }
  const clean = mimeType.trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(clean)) {
    throw new Error(`Unsupported MIME type: "${clean}". Allowed: ${Array.from(ALLOWED_MIME_TYPES).join(', ')}`);
  }
  return clean;
}

export function validateFileSize(fileSize) {
  if (typeof fileSize !== 'number' || fileSize <= 0) {
    throw new Error('Invalid file size: must be a positive number');
  }
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(`File size (${(fileSize / (1024 * 1024)).toFixed(2)} MB) exceeds 50 MB maximum limit`);
  }
  return fileSize;
}

/**
 * Upload a document to Supabase bom-documents private bucket.
 * Uses the server-side privileged service_role client.
 *
 * @returns {Promise<{
 *   storageBucket: string,
 *   storagePath: string,
 *   name: string,
 *   type: string,
 *   size: number,
 *   uploadedAt: string
 * }>} Canonical metadata object
 */
export async function uploadBomDocument({ bomCode, category, fileBuffer, fileName, mimeType }) {
  const cleanBom = validateBomCode(bomCode);
  const cleanCategory = validateCategory(category);
  const cleanMime = validateMimeType(mimeType);

  if (!fileBuffer || !(Buffer.isBuffer(fileBuffer) || fileBuffer instanceof Uint8Array)) {
    throw new Error('Invalid file content: buffer required');
  }

  const fileSize = fileBuffer.length || fileBuffer.byteLength;
  validateFileSize(fileSize);

  const safeName = sanitizeFileName(fileName);
  const ext = path.extname(safeName).toLowerCase();
  const validExts = EXTENSION_MAP[cleanMime] || [];
  const finalName = (ext && validExts.includes(ext)) ? safeName : `${safeName}${validExts[0] || ''}`;

  // Safe unique storage path: BOM-XXX/category/timestamp-random-filename.ext
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const storagePath = `${cleanBom}/${cleanCategory}/${Date.now()}-${randomSuffix}-${finalName}`;

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBuffer, {
      contentType: cleanMime,
      upsert: false
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const canonicalMetadata = {
    storageBucket: BUCKET_NAME,
    storagePath: data.path || storagePath,
    name: safeName,
    type: cleanMime,
    size: fileSize,
    uploadedAt: new Date().toISOString()
  };

  return canonicalMetadata;
}

/**
 * Generate a short-lived signed URL for an authorized user to view/download a document.
 * Enforces cross-BOM validation.
 */
export async function createBomDocumentSignedUrl({ bomCode, storagePath, expiresIn = DEFAULT_SIGNED_URL_EXPIRY }) {
  const validatedPath = validateStoragePathBelongsToBom(bomCode, storagePath);
  const expirySeconds = Math.max(60, Math.min(Number(expiresIn) || DEFAULT_SIGNED_URL_EXPIRY, 3600)); // 1 min to 1 hour

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .createSignedUrl(validatedPath, expirySeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Signed URL generation failed: ${error?.message || 'Unknown error'}`);
  }

  return {
    signedUrl: data.signedUrl,
    storagePath: validatedPath,
    expiresIn: expirySeconds,
    expiresAt: new Date(Date.now() + expirySeconds * 1000).toISOString()
  };
}

/**
 * Delete a BOM document from storage.
 * Enforces cross-BOM validation and fixed bucket constraint.
 */
export async function deleteBomDocument({ bomCode, storagePath }) {
  const validatedPath = validateStoragePathBelongsToBom(bomCode, storagePath);

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .remove([validatedPath]);

  if (error) {
    throw new Error(`Failed to delete document: ${error.message}`);
  }

  return {
    success: true,
    deletedPath: validatedPath,
    removedCount: data?.length || 1
  };
}

/**
 * Get document metadata from storage (verifying existence).
 */
export async function getBomDocumentMetadata({ bomCode, storagePath }) {
  const validatedPath = validateStoragePathBelongsToBom(bomCode, storagePath);
  const folder = path.dirname(validatedPath);
  const fileName = path.basename(validatedPath);

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .list(folder === '.' ? '' : folder);

  if (error) {
    throw new Error(`Failed to list storage path: ${error.message}`);
  }

  const match = (data || []).find(item => item.name === fileName);
  if (!match) {
    return null;
  }

  return {
    storageBucket: BUCKET_NAME,
    storagePath: validatedPath,
    name: fileName,
    id: match.id,
    size: match.metadata?.size || null,
    type: match.metadata?.mimetype || null,
    updatedAt: match.updated_at
  };
}

/**
 * Validate a BUSINZ session ID against active sessions registered in the database.
 * Used by backend endpoints to authenticate requests.
 */
export async function validateBusinzSession(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    return { valid: false, error: 'Missing session ID' };
  }
  const cleanId = sessionId.trim();
  if (!cleanId.startsWith('SES-')) {
    return { valid: false, error: 'Invalid session ID format' };
  }

  try {
    const { data: sessionRow, error } = await supabaseAdmin
      .from('leaves')
      .select('id, duration, reason, status, dates')
      .eq('employee', 'SESSION_REGISTRY')
      .eq('duration', cleanId)
      .maybeSingle();

    if (error || !sessionRow) {
      return { valid: false, error: 'Session not found' };
    }

    if (sessionRow.status !== 'active') {
      return { valid: false, error: `Session is ${sessionRow.status}` };
    }

    let parsed = {};
    try {
      parsed = JSON.parse(sessionRow.reason || '{}');
    } catch (_) {}

    return {
      valid: true,
      sessionId: cleanId,
      user: parsed.user || 'User',
      email: parsed.email,
      role: parsed.role || 'Employee'
    };
  } catch (err) {
    return { valid: false, error: `Session validation error: ${err.message}` };
  }
}
