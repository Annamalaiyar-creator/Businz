// IISNode CommonJS entrypoint for Windows Plesk hosting (compatible with Node 16+)
try { process.chdir(__dirname); } catch (_) {}

// 1. Polyfill web standards (fetch, Headers, Request, Response, WebSocket) for Node 16
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
  if (!globalThis.WebSocket && undici.WebSocket) {
    globalThis.WebSocket = undici.WebSocket;
    global.WebSocket = undici.WebSocket;
  }
} catch (err) {
  // Undici not installed yet, fallbacks below will handle it
}

// 2. Fallback in-memory Headers polyfill if still undefined
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

// 3. Fallback WebSocket polyfill if still undefined
if (typeof globalThis.WebSocket === 'undefined') {
  class WebSocketPolyfill {
    constructor(url, protocols) {
      this.url = url;
      this.protocols = protocols;
      this.readyState = 3; // CLOSED
    }
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  }
  globalThis.WebSocket = WebSocketPolyfill;
  global.WebSocket = WebSocketPolyfill;
}

// 4. Ensure Supabase environment variables exist for Windows IISNode
if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = 'https://qhxaqrclvdfkswdavvjd.supabase.co';
if (!process.env.VITE_SUPABASE_URL) process.env.VITE_SUPABASE_URL = 'https://qhxaqrclvdfkswdavvjd.supabase.co';
if (!process.env.SUPABASE_KEY) process.env.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoeGFxcmNsdmRma3N3ZGF2dmpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNDc2MzgsImV4cCI6MjEwNTcyMzYzOH0.5eTHE3fVU5L0wvNr-xFcidfqgBTqVSpGFhiBvZcKfec';
if (!process.env.VITE_SUPABASE_ANON_KEY) process.env.VITE_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoeGFxcmNsdmRma3N3ZGF2dmpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNDc2MzgsImV4cCI6MjEwNTcyMzYzOH0.5eTHE3fVU5L0wvNr-xFcidfqgBTqVSpGFhiBvZcKfec';
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoeGFxcmNsdmRma3N3ZGF2dmpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDE0NzYzOCwiZXhwIjoyMTA1NzIzNjM4fQ.NZJoTzxvoiMPjOa-MIeGful8PeiYAu68vw8rZc8zegw';
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';
if (!process.env.APP_ENV) process.env.APP_ENV = 'production';

// 5. Dynamically import the ES Module server
import('./server/index.js').catch((err) => {
  console.error('[IISNode Startup Error]:', err);
  process.exit(1);
});
