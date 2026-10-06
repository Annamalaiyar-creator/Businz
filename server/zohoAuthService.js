import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, isDbConnected } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKEN_CACHE_FILE = path.join(__dirname, 'zoho_token_cache.json');
const SAFETY_BUFFER_MS = 5 * 60 * 1000; // 5-minute safety buffer

// Metrics / Counters for Audit & Verification
const stats = {
  oauthRequestsCount: 0,
  apiRequestsCount: 0,
  tokenRefreshesCount: 0,
  concurrentRefreshBlocks: 0,
  retries401Count: 0,
  rateLimits429Count: 0
};

// Internal Token State
let cachedAccessToken = null;
let tokenExpiresAt = 0;
let tokenUpdatedAt = 0;
let refreshPromise = null;

const DEFAULT_ORG_ID = '60020613233';
const DEFAULT_REFRESH_TOKEN = '1000.72a818ee439bb2de32b531f9dc5588ee.bf37bcc95e83b89d487c42fb342042ca';
const DEFAULT_CLIENT_ID = '1000.GLVQL7WI3FS3N0YC5F8VPP59OL73OH';
const DEFAULT_CLIENT_SECRET = '12442de238386baed5a051d7036d71540c4ff90db4';

// Dynamic reference to zohoSession credentials
let getSessionCredentials = () => ({
  refreshToken: process.env.ZOHO_REFRESH_TOKEN || DEFAULT_REFRESH_TOKEN,
  clientId: process.env.ZOHO_CLIENT_ID || DEFAULT_CLIENT_ID,
  clientSecret: process.env.ZOHO_CLIENT_SECRET || DEFAULT_CLIENT_SECRET,
  orgId: process.env.ZOHO_ORG_ID || DEFAULT_ORG_ID
});

export function configureSessionProvider(providerFn) {
  if (typeof providerFn === 'function') {
    getSessionCredentials = providerFn;
  }
}

/**
 * Loads cached token from durable PostgreSQL storage first, then fallback to local file.
 */
export async function initZohoTokenStore() {
  const now = Date.now();

  // 1. Try loading from PostgreSQL controlroom_store table
  if (isDbConnected()) {
    try {
      const res = await query(
        `SELECT data, updated_at FROM public.controlroom_store WHERE key = $1 LIMIT 1`,
        ['zoho_oauth_token']
      );
      if (res && res.rows && res.rows[0] && res.rows[0].data) {
        const d = res.rows[0].data;
        if (d.accessToken && Number(d.expiresAt) > now + SAFETY_BUFFER_MS) {
          cachedAccessToken = d.accessToken;
          tokenExpiresAt = Number(d.expiresAt);
          tokenUpdatedAt = Number(d.updatedAt) || now;
          console.log(`[Zoho Auth] Restored valid access token from database. Expires in ${Math.round((tokenExpiresAt - now) / 60000)} min.`);
          return;
        }
      }
    } catch (dbErr) {
      console.warn('[Zoho Auth] Notice reading token from DB:', dbErr.message);
    }
  }

  // 2. Fallback to local cache file
  try {
    if (fs.existsSync(TOKEN_CACHE_FILE)) {
      const raw = fs.readFileSync(TOKEN_CACHE_FILE, 'utf8');
      const c = JSON.parse(raw);
      if (c.accessToken && Number(c.tokenExpiresAt) > now + SAFETY_BUFFER_MS) {
        cachedAccessToken = c.accessToken;
        tokenExpiresAt = Number(c.tokenExpiresAt);
        tokenUpdatedAt = Number(c.updatedAt) || now;
        console.log(`[Zoho Auth] Restored valid access token from disk cache. Expires in ${Math.round((tokenExpiresAt - now) / 60000)} min.`);
      }
    }
  } catch (fsErr) {
    console.warn('[Zoho Auth] Notice reading token from disk cache:', fsErr.message);
  }
}

/**
 * Persists token to local disk file AND PostgreSQL durable storage.
 */
async function persistToken(accessToken, expiresInSec) {
  cachedAccessToken = accessToken;
  tokenExpiresAt = Date.now() + (Number(expiresInSec) || 3600) * 1000;
  tokenUpdatedAt = Date.now();

  // 1. Write to local file
  try {
    fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify({
      accessToken: cachedAccessToken,
      tokenExpiresAt,
      updatedAt: tokenUpdatedAt
    }), 'utf8');
  } catch (err) {
    console.warn('[Zoho Auth] Notice writing disk token cache:', err.message);
  }

  // 2. Write to PostgreSQL durable storage
  if (isDbConnected()) {
    try {
      await query(`
        INSERT INTO public.controlroom_store (key, data, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE 
        SET data = EXCLUDED.data, updated_at = NOW()
      `, ['zoho_oauth_token', JSON.stringify({
        accessToken: cachedAccessToken,
        expiresAt: tokenExpiresAt,
        updatedAt: tokenUpdatedAt
      })]);
    } catch (err) {
      console.warn('[Zoho Auth] Notice writing DB token cache:', err.message);
    }
  }
}

/**
 * Explicitly invalidates the cached access token (used on HTTP 401).
 */
export async function invalidateZohoAccessToken() {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
  tokenUpdatedAt = Date.now();

  try {
    if (fs.existsSync(TOKEN_CACHE_FILE)) {
      fs.unlinkSync(TOKEN_CACHE_FILE);
    }
  } catch (_) {}

  if (isDbConnected()) {
    try {
      await query(`DELETE FROM public.controlroom_store WHERE key = $1`, ['zoho_oauth_token']);
    } catch (_) {}
  }

  console.log('[Zoho Auth] Cached access token invalidated and cleared from storage.');
}

/**
 * Centralized Access Token Getter with Concurrency Lock (Mutex) and 5-min safety buffer.
 */
export function getZohoAccessToken(forceRefresh = false) {
  const now = Date.now();

  // Return cached token if valid and not close to expiry
  if (!forceRefresh && cachedAccessToken && tokenExpiresAt > now + SAFETY_BUFFER_MS) {
    return Promise.resolve(cachedAccessToken);
  }

  // If a refresh is already in-flight, reuse the same promise (prevents concurrent refreshes)
  if (refreshPromise) {
    stats.concurrentRefreshBlocks++;
    return refreshPromise;
  }

  // Single in-flight token refresh execution
  refreshPromise = (async () => {
    stats.oauthRequestsCount++;
    stats.tokenRefreshesCount++;

    const creds = getSessionCredentials();
    const refreshToken = creds.refreshToken || process.env.ZOHO_REFRESH_TOKEN;
    const clientId = creds.clientId || process.env.ZOHO_CLIENT_ID;
    const clientSecret = creds.clientSecret || process.env.ZOHO_CLIENT_SECRET;

    if (!refreshToken || !clientId || !clientSecret) {
      throw new Error('Zoho credentials missing (Client ID, Secret, or Refresh Token).');
    }

    const postData = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token'
    }).toString();

    console.log(`[Zoho Auth] Refreshing access token via accounts.zoho.in (OAuth Request #${stats.oauthRequestsCount})...`);

    const tokenResponse = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'accounts.zoho.in',
        port: 443,
        path: '/oauth/v2/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (res.statusCode >= 400 || parsed.error) {
              const errMsg = parsed.error_description || parsed.error || `HTTP ${res.statusCode}`;
              console.warn(`[Zoho Auth] Token refresh returned error status ${res.statusCode}: ${parsed.error || 'Error'}`);
              reject(new Error(`Zoho OAuth refresh failed [${res.statusCode}]: ${errMsg}`));
              return;
            }
            if (parsed.access_token) {
              resolve(parsed);
            } else {
              reject(new Error('Zoho OAuth response missing access_token.'));
            }
          } catch (e) {
            reject(new Error(`Failed to parse OAuth response: ${e.message}`));
          }
        });
      });

      req.on('error', (e) => reject(new Error(`Network error contacting accounts.zoho.in: ${e.message}`)));
      req.setTimeout(8000, () => {
        try { req.destroy(); } catch (_) {}
        reject(new Error('Zoho OAuth request timed out (8000ms).'));
      });
      req.write(postData);
      req.end();
    });

    await persistToken(tokenResponse.access_token, tokenResponse.expires_in || 3600);
    console.log(`[Zoho Auth] Access token successfully refreshed. Valid for ${Math.round((tokenResponse.expires_in || 3600) / 60)} minutes.`);
    return tokenResponse.access_token;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

/**
 * Standardized HTTP caller for Zoho Books with automatic 401 single-retry and 429 backoff handling.
 */
export async function zohoRequest(requestOptions, postPayload = null, retryCount = 0) {
  stats.apiRequestsCount++;
  const token = await getZohoAccessToken();

  const reqHeaders = {
    ...(requestOptions.headers || {}),
    'Authorization': `Zoho-oauthtoken ${token}`
  };

  let bodyData = null;
  if (postPayload !== null && postPayload !== undefined) {
    bodyData = typeof postPayload === 'string' ? postPayload : JSON.stringify(postPayload);
    if (!reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }
    reqHeaders['Content-Length'] = Buffer.byteLength(bodyData);
  }

  const execOptions = {
    hostname: requestOptions.hostname || 'www.zohoapis.in',
    port: requestOptions.port || 443,
    path: requestOptions.path,
    method: (requestOptions.method || 'GET').toUpperCase(),
    headers: reqHeaders
  };

  return new Promise((resolve, reject) => {
    const req = https.request(execOptions, (res) => {
      let rawData = '';
      res.on('data', chunk => { rawData += chunk; });
      res.on('end', async () => {
        // Handle 401 Unauthorized (Token invalid/expired)
        if (res.statusCode === 401) {
          if (retryCount === 0) {
            stats.retries401Count++;
            console.warn(`[Zoho Auth] HTTP 401 received for ${execOptions.path}. Invalidating cached token & retrying once...`);
            await invalidateZohoAccessToken();
            try {
              // Force fresh token generation and retry original request
              await getZohoAccessToken(true);
              const retryResult = await zohoRequest(requestOptions, postPayload, 1);
              return resolve(retryResult);
            } catch (retryErr) {
              return reject(retryErr);
            }
          } else {
            console.error(`[Zoho Auth] HTTP 401 persisted after token refresh on ${execOptions.path}. Aborting.`);
            return resolve({
              statusCode: 401,
              ok: false,
              error: 'Zoho authentication failed: invalid or revoked credentials.',
              data: null
            });
          }
        }

        // Handle 429 Too Many Requests (Rate limit - DO NOT refresh OAuth token)
        if (res.statusCode === 429) {
          stats.rateLimits429Count++;
          const retryAfter = res.headers['retry-after'] || '60';
          console.warn(`[Zoho Auth] HTTP 429 Too Many Requests on ${execOptions.path}. Retry-After: ${retryAfter}s.`);
          return resolve({
            statusCode: 429,
            ok: false,
            error: `Zoho API rate limit reached. Retry after ${retryAfter} seconds.`,
            retryAfter: Number(retryAfter) || 60,
            data: null
          });
        }

        // Parse standard JSON response
        try {
          const parsed = JSON.parse(rawData);
          resolve({
            statusCode: res.statusCode,
            ok: res.statusCode >= 200 && res.statusCode < 300,
            data: parsed
          });
        } catch (_) {
          resolve({
            statusCode: res.statusCode,
            ok: res.statusCode >= 200 && res.statusCode < 300,
            data: rawData
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Zoho request failed for ${execOptions.path}: ${err.message}`));
    });

    req.setTimeout(12000, () => {
      try { req.destroy(); } catch (_) {}
      reject(new Error(`Zoho request timed out for ${execOptions.path}`));
    });

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

/**
 * Returns safe operational metrics for audits and health checks.
 */
export function getZohoAuthStats() {
  const now = Date.now();
  return {
    ...stats,
    hasCachedToken: Boolean(cachedAccessToken),
    tokenExpiresAt,
    expiresInSeconds: tokenExpiresAt > now ? Math.round((tokenExpiresAt - now) / 1000) : 0,
    isTokenValid: Boolean(cachedAccessToken && tokenExpiresAt > now + SAFETY_BUFFER_MS),
    isRefreshInFlight: Boolean(refreshPromise)
  };
}
