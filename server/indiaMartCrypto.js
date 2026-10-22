import crypto from 'crypto';

// Master secret key derivation for IndiaMART credential encryption
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getEncryptionKey() {
  const secret = process.env.INDIAMART_SECRET_KEY || process.env.SUPABASE_ANON_KEY || 'businz-crm-indiamart-secure-key-2026-vrm-structures';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Encrypt plaintext API key using AES-256-GCM
 */
export function encryptApiKey(plainText) {
  if (!plainText || typeof plainText !== 'string') return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  const masked = plainText.length > 4 
    ? '••••' + plainText.slice(-4) 
    : '••••';

  return {
    encryptedKey: encrypted,
    iv: iv.toString('hex'),
    authTag,
    masked
  };
}

/**
 * Decrypt API key using AES-256-GCM
 */
export function decryptApiKey(encryptedKey, ivHex, authTagHex) {
  if (!encryptedKey || !ivHex || !authTagHex) return null;
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[IndiaMART Crypto Error] Failed to decrypt key:', err.message);
    return null;
  }
}
