import https from 'https';
import querystring from 'querystring';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, isDbConnected } from './db.js';
import { getStoreFilePath } from './runtimePaths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKEN_CACHE_FILE = getStoreFilePath('zoho_token_cache.json');
const CONFIG_FILE = getStoreFilePath('zoho_config.json');
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

// Default Credentials fallback
const DEFAULT_CONFIG = {
  companyName: 'VRM Structures India Private Limited',
  orgId: process.env.ZOHO_ORG_ID || '60082137608',
  clientId: process.env.ZOHO_CLIENT_ID || '1000.9U5BAN338075M5HBI3U8K1VBNKUU8K',
  clientSecret: process.env.ZOHO_CLIENT_SECRET || 'e82079a5165e3b2e75fdc602f3e08fd38489d75f13',
  refreshToken: process.env.ZOHO_REFRESH_TOKEN || '1000.dbba41673c1e444e90955ea2acac3067.99dacc15c2ef094541e7cc913d41d831',
  apiDomain: process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.in',
  accountsDomain: process.env.ZOHO_ACCOUNTS_DOMAIN || 'https://accounts.zoho.in',
  lastVerifiedAt: null,
  lastVerifiedOrgName: null
};

// Active configuration state
let activeConfig = { ...DEFAULT_CONFIG };

// Load config from disk / DB on module startup
(function initZohoConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (data && typeof data === 'object') {
        activeConfig = { ...DEFAULT_CONFIG, ...data };
        console.log(`[Zoho Auth] Loaded Zoho configuration for "${activeConfig.companyName || activeConfig.orgId}" from disk.`);
        return;
      }
    }
    // If not on disk, seed initial default config file
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Zoho Auth] Failed to read/seed zoho_config.json:', err.message);
  }
})();

// Dynamic reference to zoho credentials
const getCredentials = () => ({
  orgId: activeConfig.orgId || process.env.ZOHO_ORG_ID || '60082137608',
  clientId: activeConfig.clientId || process.env.ZOHO_CLIENT_ID || '1000.9U5BAN338075M5HBI3U8K1VBNKUU8K',
  clientSecret: activeConfig.clientSecret || process.env.ZOHO_CLIENT_SECRET || 'e82079a5165e3b2e75fdc602f3e08fd38489d75f13',
  refreshToken: activeConfig.refreshToken || process.env.ZOHO_REFRESH_TOKEN || '1000.dbba41673c1e444e90955ea2acac3067.99dacc15c2ef094541e7cc913d41d831',
  apiDomain: activeConfig.apiDomain || process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.in',
  accountsDomain: activeConfig.accountsDomain || process.env.ZOHO_ACCOUNTS_DOMAIN || 'https://accounts.zoho.in',
  companyName: activeConfig.companyName || 'VRM Structures India Private Limited'
});

// Load cached token on module startup
(function initTokenCache() {
  try {
    if (fs.existsSync(TOKEN_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, 'utf8'));
      if (data && data.accessToken && data.expiresAt > Date.now() + SAFETY_BUFFER_MS) {
        cachedAccessToken = data.accessToken;
        tokenExpiresAt = data.expiresAt;
        tokenUpdatedAt = data.updatedAt || Date.now();
        console.log(`[Zoho Auth] Loaded valid cached token from disk. Expires in ${Math.round((tokenExpiresAt - Date.now()) / 60000)}m.`);
      }
    }
  } catch (err) {
    console.warn('[Zoho Auth] Failed to read disk token cache:', err.message);
  }
})();

async function persistToken(token, expiresInSeconds) {
  cachedAccessToken = token;
  tokenExpiresAt = Date.now() + (expiresInSeconds * 1000);
  tokenUpdatedAt = Date.now();

  const cachePayload = {
    accessToken: cachedAccessToken,
    expiresAt: tokenExpiresAt,
    updatedAt: tokenUpdatedAt
  };

  try {
    fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(cachePayload, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Zoho Auth] Disk token cache write failed:', err.message);
  }

  if (isDbConnected()) {
    try {
      await query(`
        INSERT INTO public.controlroom_store (key, data, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE
        SET data = EXCLUDED.data, updated_at = NOW()
      `, ['zoho_oauth_token', JSON.stringify(cachePayload)]);
    } catch (_) {}
  }
}

export async function invalidateZohoAccessToken() {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
  tokenUpdatedAt = 0;

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

  console.log('[Zoho Auth] Cached access token invalidated and cleared.');
}

/**
 * Returns current Zoho configuration metadata for UI viewing and editing.
 */
export function getZohoConfigInfo(includeSecrets = true) {
  return {
    companyName: activeConfig.companyName || 'VRM Structures India Private Limited',
    orgId: activeConfig.orgId || '',
    clientId: activeConfig.clientId || '',
    clientSecret: activeConfig.clientSecret || '',
    refreshToken: activeConfig.refreshToken || '',
    apiDomain: activeConfig.apiDomain || 'https://www.zohoapis.in',
    accountsDomain: activeConfig.accountsDomain || 'https://accounts.zoho.in',
    lastVerifiedAt: activeConfig.lastVerifiedAt || null,
    lastVerifiedOrgName: activeConfig.lastVerifiedOrgName || null,
    isConfigured: Boolean(activeConfig.orgId && activeConfig.clientId && activeConfig.refreshToken)
  };
}

/**
 * Updates Zoho company credentials, saves to disk & DB, and purges previous cached tokens.
 */
export async function updateZohoConfig(newConfig = {}) {
  activeConfig = {
    ...activeConfig,
    companyName: (newConfig.companyName !== undefined ? newConfig.companyName : activeConfig.companyName || '').trim(),
    orgId: (newConfig.orgId !== undefined ? newConfig.orgId : activeConfig.orgId || '').trim(),
    clientId: (newConfig.clientId !== undefined ? newConfig.clientId : activeConfig.clientId || '').trim(),
    clientSecret: (newConfig.clientSecret !== undefined ? newConfig.clientSecret : activeConfig.clientSecret || '').trim(),
    refreshToken: (newConfig.refreshToken !== undefined ? newConfig.refreshToken : activeConfig.refreshToken || '').trim(),
    apiDomain: (newConfig.apiDomain || activeConfig.apiDomain || 'https://www.zohoapis.in').trim().replace(/\/+$/, ''),
    accountsDomain: (newConfig.accountsDomain || activeConfig.accountsDomain || 'https://accounts.zoho.in').trim().replace(/\/+$/, ''),
    lastVerifiedAt: newConfig.lastVerifiedAt !== undefined ? newConfig.lastVerifiedAt : activeConfig.lastVerifiedAt,
    lastVerifiedOrgName: newConfig.lastVerifiedOrgName !== undefined ? newConfig.lastVerifiedOrgName : activeConfig.lastVerifiedOrgName,
    updatedAt: new Date().toISOString()
  };

  // Persist to disk
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(activeConfig, null, 2), 'utf8');
    console.log(`[Zoho Auth] Successfully persisted updated credentials for "${activeConfig.companyName}" to ${CONFIG_FILE}`);
  } catch (err) {
    console.warn('[Zoho Auth] Disk config write failed:', err.message);
  }

  // Persist to DB if connected
  if (isDbConnected()) {
    try {
      await query(`
        INSERT INTO public.controlroom_store (key, data, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE
        SET data = EXCLUDED.data, updated_at = NOW()
      `, ['zoho_config', JSON.stringify(activeConfig)]);
    } catch (_) {}
  }

  // Invalidate cached access token to ensure next request uses the new credentials
  await invalidateZohoAccessToken();

  return getZohoConfigInfo(true);
}

/**
 * Centralized Access Token Getter with Concurrency Lock (Mutex) and 5-min safety buffer.
 */
export function getZohoAccessToken(forceRefresh = false) {
  const now = Date.now();

  if (!forceRefresh && cachedAccessToken && tokenExpiresAt > now + SAFETY_BUFFER_MS) {
    return Promise.resolve(cachedAccessToken);
  }

  if (refreshPromise) {
    stats.concurrentRefreshBlocks++;
    return refreshPromise;
  }

  refreshPromise = (async () => {
    stats.oauthRequestsCount++;
    stats.tokenRefreshesCount++;

    const creds = getCredentials();
    if (!creds.refreshToken || !creds.clientId || !creds.clientSecret) {
      throw new Error('Zoho credentials missing (Client ID, Secret, or Refresh Token).');
    }

    const postData = new URLSearchParams({
      refresh_token: creds.refreshToken,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: 'refresh_token'
    }).toString();

    let accountsHostname = 'accounts.zoho.in';
    try {
      const url = new URL(creds.accountsDomain.startsWith('http') ? creds.accountsDomain : `https://${creds.accountsDomain}`);
      accountsHostname = url.hostname;
    } catch (_) {}

    console.log(`[Zoho Auth] Refreshing access token via ${accountsHostname} (OAuth Request #${stats.oauthRequestsCount})...`);

    const tokenResponse = await new Promise((resolve, reject) => {
      const options = {
        hostname: accountsHostname,
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
              console.warn(`[Zoho Auth] Token refresh returned error ${res.statusCode}: ${errMsg}`);
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

      req.on('error', (e) => reject(new Error(`Network error contacting ${accountsHostname}: ${e.message}`)));
      req.setTimeout(10000, () => {
        try { req.destroy(); } catch (_) {}
        reject(new Error('Zoho OAuth request timed out (10000ms).'));
      });
      req.write(postData);
      req.end();
    });

    await persistToken(tokenResponse.access_token, tokenResponse.expires_in || 3600);
    console.log(`[Zoho Auth] Access token refreshed. Valid for ${Math.round((tokenResponse.expires_in || 3600) / 60)} minutes.`);
    return tokenResponse.access_token;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

/**
 * Standardized HTTP caller for Zoho Books with automatic 401 retry and 429 backoff handling.
 */
export async function zohoRequest(requestOptions, postPayload = null, retryCount = 0) {
  stats.apiRequestsCount++;
  const token = await getZohoAccessToken();
  const creds = getCredentials();

  const reqHeaders = {
    ...(requestOptions.headers || {}),
    'Authorization': `Zoho-oauthtoken ${token}`,
    'X-com-zoho-books-organizationid': creds.orgId
  };

  let bodyData = null;
  if (postPayload !== null && postPayload !== undefined) {
    bodyData = typeof postPayload === 'string' ? postPayload : JSON.stringify(postPayload);
    if (!reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }
    reqHeaders['Content-Length'] = Buffer.byteLength(bodyData);
  }

  // Ensure organization_id query parameter is present on Zoho Books calls
  let fullPath = requestOptions.path || '';
  if (!fullPath.includes('organization_id=')) {
    const separator = fullPath.includes('?') ? '&' : '?';
    fullPath = `${fullPath}${separator}organization_id=${creds.orgId}`;
  }

  let apiHostname = 'www.zohoapis.in';
  try {
    const url = new URL(creds.apiDomain.startsWith('http') ? creds.apiDomain : `https://${creds.apiDomain}`);
    apiHostname = url.hostname;
  } catch (_) {}

  const execOptions = {
    hostname: requestOptions.hostname || apiHostname,
    port: requestOptions.port || 443,
    path: fullPath,
    method: (requestOptions.method || 'GET').toUpperCase(),
    headers: reqHeaders
  };

  return new Promise((resolve, reject) => {
    const req = https.request(execOptions, (res) => {
      let rawData = '';
      res.on('data', chunk => { rawData += chunk; });
      res.on('end', async () => {
        // Handle 401 Unauthorized (Expired or invalid token)
        if (res.statusCode === 401) {
          if (retryCount === 0) {
            stats.retries401Count++;
            console.warn(`[Zoho Auth] HTTP 401 received for ${execOptions.path}. Refreshing token & retrying once...`);
            await invalidateZohoAccessToken();
            try {
              await getZohoAccessToken(true);
              const retryResult = await zohoRequest(requestOptions, postPayload, 1);
              return resolve(retryResult);
            } catch (retryErr) {
              return reject(retryErr);
            }
          } else {
            console.error(`[Zoho Auth] HTTP 401 persisted on ${execOptions.path}.`);
            return resolve({
              statusCode: 401,
              ok: false,
              error: 'Zoho authentication failed: invalid credentials.',
              data: null
            });
          }
        }

        // Handle 429 Too Many Requests
        if (res.statusCode === 429) {
          stats.rateLimits429Count++;
          const retryAfter = res.headers['retry-after'] || '60';
          console.warn(`[Zoho Auth] HTTP 429 on ${execOptions.path}. Retry-After: ${retryAfter}s.`);
          return resolve({
            statusCode: 429,
            ok: false,
            error: `Zoho API rate limit reached. Retry after ${retryAfter}s.`,
            retryAfter: Number(retryAfter) || 60,
            data: null
          });
        }

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

    req.setTimeout(15000, () => {
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
 * Tests connection to Zoho Books OAuth & API using provided custom creds or currently saved creds.
 */
export async function testZohoConnection(customCreds = null) {
  const creds = customCreds ? {
    orgId: String(customCreds.orgId || '').trim(),
    clientId: String(customCreds.clientId || '').trim(),
    clientSecret: String(customCreds.clientSecret || '').trim(),
    refreshToken: String(customCreds.refreshToken || '').trim(),
    apiDomain: String(customCreds.apiDomain || 'https://www.zohoapis.in').trim().replace(/\/+$/, ''),
    accountsDomain: String(customCreds.accountsDomain || 'https://accounts.zoho.in').trim().replace(/\/+$/, '')
  } : getCredentials();

  if (!creds.orgId || !creds.clientId || !creds.clientSecret || !creds.refreshToken) {
    return {
      success: false,
      error: 'Missing required credentials: Organization ID, Client ID, Client Secret, and Refresh Token are required.'
    };
  }

  // 1. Test OAuth token generation
  let accessToken = null;
  let accountsHostname = 'accounts.zoho.in';
  try {
    const url = new URL(creds.accountsDomain.startsWith('http') ? creds.accountsDomain : `https://${creds.accountsDomain}`);
    accountsHostname = url.hostname;
  } catch (_) {}

  try {
    const postData = new URLSearchParams({
      refresh_token: creds.refreshToken,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: 'refresh_token'
    }).toString();

    const tokenRes = await new Promise((resolve, reject) => {
      const options = {
        hostname: accountsHostname,
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
              return reject(new Error(`OAuth Error [${res.statusCode}]: ${errMsg}`));
            }
            if (parsed.access_token) {
              resolve(parsed);
            } else {
              reject(new Error('Zoho did not return an access_token.'));
            }
          } catch (e) {
            reject(new Error(`Failed to parse OAuth response: ${e.message}`));
          }
        });
      });

      req.on('error', (e) => reject(new Error(`Network error contacting ${accountsHostname}: ${e.message}`)));
      req.setTimeout(12000, () => {
        try { req.destroy(); } catch (_) {}
        reject(new Error(`Request timed out contacting ${accountsHostname}`));
      });
      req.write(postData);
      req.end();
    });

    accessToken = tokenRes.access_token;
  } catch (oauthErr) {
    return {
      success: false,
      stage: 'oauth',
      error: `OAuth Authentication Failed: ${oauthErr.message}`
    };
  }

  // 2. Query Organization Profile from Zoho Books API
  let apiHostname = 'www.zohoapis.in';
  try {
    const url = new URL(creds.apiDomain.startsWith('http') ? creds.apiDomain : `https://${creds.apiDomain}`);
    apiHostname = url.hostname;
  } catch (_) {}

  try {
    const orgRes = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: apiHostname,
        port: 443,
        path: `/books/v3/organizations/${creds.orgId}`,
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'X-com-zoho-books-organizationid': creds.orgId
        }
      }, (res) => {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve({ statusCode: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: body });
          }
        });
      });

      req.on('error', (err) => reject(new Error(`Network error querying ${apiHostname}: ${err.message}`)));
      req.setTimeout(12000, () => {
        try { req.destroy(); } catch (_) {}
        reject(new Error(`Request timed out querying Zoho Books API (${apiHostname})`));
      });
      req.end();
    });

    if (orgRes.statusCode >= 200 && orgRes.statusCode < 300 && orgRes.data?.organization) {
      const org = orgRes.data.organization;
      const verifiedInfo = {
        name: org.name || org.organization_name || creds.orgId,
        orgId: org.organization_id || creds.orgId,
        currencyCode: org.currency_code || 'INR',
        currencySymbol: org.currency_symbol || '₹',
        contactEmail: org.email || '',
        fiscalYearStartMonth: org.fiscal_year_start_month,
        planType: org.plan_type,
        timeZone: org.time_zone
      };

      // Record verified status in active config
      if (!customCreds) {
        activeConfig.lastVerifiedAt = new Date().toISOString();
        activeConfig.lastVerifiedOrgName = verifiedInfo.name;
        try {
          fs.writeFileSync(CONFIG_FILE, JSON.stringify(activeConfig, null, 2), 'utf8');
        } catch (_) {}
      }

      return {
        success: true,
        message: `Successfully connected to Zoho Books organization "${verifiedInfo.name}"!`,
        organization: verifiedInfo
      };
    } else {
      const msg = orgRes.data?.message || (typeof orgRes.data === 'string' ? orgRes.data : `HTTP ${orgRes.statusCode}`);
      return {
        success: false,
        stage: 'organization',
        error: `OAuth succeeded, but Zoho Books API returned: ${msg}. Check if Organization ID (${creds.orgId}) matches your Zoho Books account.`
      };
    }
  } catch (apiErr) {
    return {
      success: false,
      stage: 'api',
      error: `Zoho Books API Query Error: ${apiErr.message}`
    };
  }
}

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

/**
 * Exchanges a temporary grant token (authorization code from Self Client) for a permanent Refresh Token.
 */
export async function exchangeAuthorizationCode({ code, clientId, clientSecret, orgId, apiDomain, accountsDomain, companyName }) {
  const cId = (clientId || activeConfig.clientId || '').trim();
  const cSec = (clientSecret || activeConfig.clientSecret || '').trim();
  const oId = (orgId || activeConfig.orgId || '').trim();
  const accDomain = (accountsDomain || activeConfig.accountsDomain || 'https://accounts.zoho.in').trim().replace(/\/+$/, '');

  if (!code || !code.trim()) {
    throw new Error('Authorization code (Grant Code) is required.');
  }
  if (!cId || !cSec) {
    throw new Error('Client ID and Client Secret are required.');
  }

  let accountsHostname = 'accounts.zoho.in';
  try {
    const url = new URL(accDomain.startsWith('http') ? accDomain : `https://${accDomain}`);
    accountsHostname = url.hostname;
  } catch (_) {}

  const postData = querystring.stringify({
    code: code.trim(),
    client_id: cId,
    client_secret: cSec,
    grant_type: 'authorization_code'
  });

  const tokenRes = await new Promise((resolve, reject) => {
    const options = {
      hostname: accountsHostname,
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
            return reject(new Error(`OAuth Error [${res.statusCode}]: ${errMsg}`));
          }
          if (parsed.refresh_token || parsed.access_token) {
            resolve(parsed);
          } else {
            reject(new Error('Zoho did not return a refresh_token or access_token.'));
          }
        } catch (e) {
          reject(new Error(`Failed to parse OAuth response: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => reject(new Error(`Network error contacting ${accountsHostname}: ${e.message}`)));
    req.setTimeout(12000, () => {
      try { req.destroy(); } catch (_) {}
      reject(new Error(`Request timed out contacting ${accountsHostname}`));
    });
    req.write(postData);
    req.end();
  });

  const newRefreshToken = tokenRes.refresh_token || activeConfig.refreshToken;
  const updated = await updateZohoConfig({
    clientId: cId,
    clientSecret: cSec,
    orgId: oId || activeConfig.orgId,
    refreshToken: newRefreshToken,
    companyName: companyName || activeConfig.companyName,
    apiDomain: apiDomain || activeConfig.apiDomain,
    accountsDomain: accDomain
  });

  if (tokenRes.access_token) {
    await persistToken(tokenRes.access_token, tokenRes.expires_in || 3600);
  }

  let testResult = null;
  if (oId) {
    try {
      testResult = await testZohoConnection();
    } catch (_) {}
  }

  return {
    success: true,
    message: tokenRes.refresh_token 
      ? 'Successfully exchanged grant code and generated permanent Refresh Token!' 
      : 'Access token generated successfully.',
    refreshToken: newRefreshToken,
    accessToken: tokenRes.access_token,
    config: updated,
    testResult
  };
}
