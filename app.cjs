// IISNode CommonJS entrypoint for Windows Plesk hosting (compatible with Node 16+)

// Polyfill web standards (fetch, Headers, Request, Response) for Node 16
if (typeof globalThis.Headers === 'undefined' || typeof globalThis.fetch === 'undefined') {
  try {
    const undici = require('undici');
    if (!globalThis.Headers && undici.Headers) {
      globalThis.Headers = undici.Headers;
      global.Headers = undici.Headers;
    }
    if (!globalThis.fetch && undici.fetch) {
      globalThis.fetch = undici.fetch;
      global.fetch = undici.fetch;
    }
    if (!globalThis.Request && undici.Request) {
      globalThis.Request = undici.Request;
      global.Request = undici.Request;
    }
    if (!globalThis.Response && undici.Response) {
      globalThis.Response = undici.Response;
      global.Response = undici.Response;
    }
    if (!globalThis.FormData && undici.FormData) {
      globalThis.FormData = undici.FormData;
      global.FormData = undici.FormData;
    }
  } catch (err) {
    console.warn('[Polyfill Warning] Undici not found, using basic polyfill:', err.message);
  }
}

// Fallback in-memory Headers polyfill if still undefined
if (typeof globalThis.Headers === 'undefined') {
  class HeadersPolyfill {
    constructor(init) {
      this._map = new Map();
      if (init) {
        if (init instanceof HeadersPolyfill) {
          init.forEach((v, k) => this.set(k, v));
        } else if (Array.isArray(init)) {
          init.forEach(([k, v]) => this.append(k, v));
        } else if (typeof init === 'object') {
          Object.entries(init).forEach(([k, v]) => this.set(k, v));
        }
      }
    }
    append(name, value) {
      const key = String(name).toLowerCase();
      const existing = this._map.get(key);
      this._map.set(key, existing ? `${existing}, ${value}` : String(value));
    }
    delete(name) {
      this._map.delete(String(name).toLowerCase());
    }
    get(name) {
      return this._map.get(String(name).toLowerCase()) || null;
    }
    has(name) {
      return this._map.has(String(name).toLowerCase());
    }
    set(name, value) {
      this._map.set(String(name).toLowerCase(), String(value));
    }
    forEach(callback, thisArg) {
      this._map.forEach((v, k) => callback.call(thisArg, v, k, this));
    }
    entries() { return this._map.entries(); }
    keys() { return this._map.keys(); }
    values() { return this._map.values(); }
    [Symbol.iterator]() { return this.entries(); }
  }
  globalThis.Headers = HeadersPolyfill;
  global.Headers = HeadersPolyfill;
}

// Dynamically import the ES Module server
import('./server/index.js').catch((err) => {
  console.error('[IISNode Startup Error]:', err);
  process.exit(1);
});
