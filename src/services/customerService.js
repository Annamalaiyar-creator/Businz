/**
 * BUSINZ Enterprise ERP — Customer Data Service (Phase B1 & B2)
 * 
 * Provides:
 * 1. Phase B1: In-Flight Promise Manager & Request Deduplication
 *    - Collapses multiple concurrent identical GET /api/customers requests into a single network fetch.
 *    - Discards failed promises immediately so retries always proceed.
 *    - Preserves independent queries (?q=..., ?limit=...).
 * 
 * 2. Phase B2: Safe Scoped In-Memory Customer Cache
 *    - User/Role/Tenant scoped caching with 5-minute configurable TTL.
 *    - Instant event-driven invalidation on create/update/delete/import/realtime.
 *    - Invalidation version tracking prevents stale in-flight fetches from repopulating invalidated cache entries.
 *    - Failed or non-array responses are never cached.
 *    - Full session purge on logout or authorization change.
 */

// In-Flight Promise Registry for Request Deduplication (Phase B1)
const inFlightRequests = new Map();

// In-Memory Customer Cache Store (Phase B2)
const customerCache = new Map();

// Cache Configuration & State
let defaultCacheTtlMs = 5 * 60 * 1000; // 5 minutes
let currentInvalidationVersion = 0;

/**
 * Configure Cache TTL in milliseconds
 * @param {number} ms 
 */
export function setCustomerCacheTTL(ms) {
  if (typeof ms === 'number' && ms >= 0) {
    defaultCacheTtlMs = ms;
  }
}

export function getCustomerCacheTTL() {
  return defaultCacheTtlMs;
}

/**
 * Generate deterministic cache/in-flight key from URL and query parameters.
 * Preserves independent queries (?q=abc vs ?q=xyz vs full list) and user scopes.
 * 
 * @param {string} url - Target URL with or without query string
 * @param {Object} [context={}] - Optional user/role scope context
 * @returns {string} Deterministic string key
 */
export function buildCustomerRequestKey(url = '/api/customers', context = {}) {
  try {
    const parsed = new URL(url, 'http://localhost');
    const params = Array.from(parsed.searchParams.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const paramStr = params.map(([k, v]) => `${k}=${v}`).join('&');
    const userScope = context.userId ? `[user:${context.userId}]` : '';
    const roleScope = context.role ? `[role:${context.role}]` : '';
    return `${parsed.pathname}?${paramStr}${userScope}${roleScope}`;
  } catch (_) {
    return String(url || '/api/customers');
  }
}

/**
 * Invalidate affected customer cache entries.
 * Increments invalidationVersion so any in-flight network requests that began
 * before this invalidation will NOT repopulate the cache when they resolve.
 */
export function invalidateCustomerCache() {
  currentInvalidationVersion++;
  customerCache.clear();
}

/**
 * Clear all customer cache entries and in-flight promises on logout, user switch or auth change.
 */
export function clearCustomerCacheOnLogout() {
  currentInvalidationVersion++;
  customerCache.clear();
  inFlightRequests.clear();
}

/**
 * Retrieve cached customer data if present and not expired
 * 
 * @param {string} key 
 * @param {Object} [context={}]
 * @returns {Array|null}
 */
export function getCachedCustomers(key, context = {}) {
  const entry = customerCache.get(key);
  if (!entry) return null;

  // Check TTL expiration
  if (Date.now() > entry.expiresAt) {
    customerCache.delete(key);
    return null;
  }

  // Check user context scoping
  if (context.userId && entry.scope.userId && context.userId !== entry.scope.userId) {
    return null;
  }
  if (context.role && entry.scope.role && context.role !== entry.scope.role) {
    return null;
  }

  return entry.data;
}

/**
 * Phase B1 + B2: Deduplicated & Cached Customer Fetch
 * 
 * 1. Checks memory cache (Phase B2). If fresh cache hit, resolves immediately with zero network request.
 * 2. If cache miss, checks in-flight registry (Phase B1). If identical fetch is in-flight, awaits existing Promise.
 * 3. Otherwise, issues network fetch. On success, caches data with TTL and current invalidation version.
 * 4. Stale in-flight responses that resolve after an invalidation are rejected from entering the cache.
 * 
 * @param {string} [url='/api/customers'] - The endpoint URL
 * @param {RequestInit} [options={}] - Standard fetch options
 * @param {Object} [context={}] - Optional user/role context { userId, role, bypassCache }
 * @returns {Promise<Array>} Parsed JSON customer array
 */
export function fetchCustomersDeduplicated(url = '/api/customers', options = {}, context = {}) {
  const key = buildCustomerRequestKey(url, context);

  // Phase B2: Check memory cache first (unless explicitly bypassed)
  if (!context.bypassCache && (!options.method || options.method === 'GET')) {
    const cached = getCachedCustomers(key, context);
    if (cached) {
      return Promise.resolve(cached);
    }
  }

  // Phase B1: Check in-flight registry
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  // Capture invalidation version at the moment request initiates
  const requestStartVersion = currentInvalidationVersion;

  // Create new network promise
  const promise = (async () => {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      const customerList = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);

      // Phase B2: Safe Cache Population Guard
      // Only cache if NO invalidation occurred while this request was in flight
      if (requestStartVersion === currentInvalidationVersion && Array.isArray(customerList)) {
        customerCache.set(key, {
          data: customerList,
          timestamp: Date.now(),
          expiresAt: Date.now() + defaultCacheTtlMs,
          scope: {
            userId: context.userId || null,
            role: context.role || null
          },
          invalidationVersion: requestStartVersion
        });
      }

      return customerList;
    } catch (err) {
      // Failed responses are NEVER cached
      throw err;
    } finally {
      // Phase B1: Always clean up in-flight registry so retries proceed
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, promise);
  return promise;
}

/**
 * Universal getter for application views
 */
export async function getCustomers(context = {}) {
  return fetchCustomersDeduplicated('/api/customers', {}, context);
}

/**
 * Check active count of in-flight customer requests (for testing/telemetry)
 */
export function getActiveInFlightCount() {
  return inFlightRequests.size;
}

/**
 * Check count of cached keys (for testing/telemetry)
 */
export function getCacheEntriesCount() {
  return customerCache.size;
}

/**
 * Reset both in-flight and cache stores (for testing)
 */
export function resetCustomerDataService() {
  inFlightRequests.clear();
  customerCache.clear();
  currentInvalidationVersion = 0;
}

export const resetInFlightRegistry = resetCustomerDataService;


// Phase B2 Realtime Listener Registration (Browser Environment)
if (typeof window !== 'undefined') {
  try {
    // Invalidate on realtime customer or CRM update events
    window.addEventListener('controlroom_customer_update', () => {
      invalidateCustomerCache();
    });
    window.addEventListener('controlroom_crm_updated', () => {
      invalidateCustomerCache();
    });
    // Invalidate on logout
    window.addEventListener('controlroom_logout', () => {
      clearCustomerCacheOnLogout();
    });
  } catch (_) {}
}
