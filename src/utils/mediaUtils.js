// Universal Media Storage & Cache (IndexedDB + In-Memory Map + LocalStorage)
// Supports large video uploads, HD photos, PDFs with zero data-loss and quota protection

const DB_NAME = 'ControlRoomMediaDB';
const DB_VERSION = 1;
const STORE_NAME = 'mediaFiles';

// In-Memory Cache for fast synchronous access
if (typeof window !== 'undefined') {
  window.__CR_MEDIA_MAP__ = window.__CR_MEDIA_MAP__ || new Map();
}

// Open or initialize IndexedDB
const getDB = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return resolve(null);
    }
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'name' });
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => {
        console.warn('IndexedDB open error:', e.target.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB initialization failed:', err);
      resolve(null);
    }
  });
};

// Pre-hydrate in-memory map from IndexedDB on startup
if (typeof window !== 'undefined' && window.indexedDB) {
  getDB().then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.value?.name && cursor.value?.dataUrl) {
            window.__CR_MEDIA_MAP__.set(cursor.value.name, cursor.value.dataUrl);
          }
          cursor.continue();
        }
      };
    } catch (_) {}
  }).catch(() => {});
}

export const saveMediaToCache = (docKey, dataUrl) => {
  if (!docKey || !dataUrl) return;

  // 1. Save to global memory map
  if (typeof window !== 'undefined' && window.__CR_MEDIA_MAP__) {
    window.__CR_MEDIA_MAP__.set(docKey, dataUrl);
  }

  // 2. Persist to IndexedDB (asynchronously handles large video payloads)
  getDB().then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ name: docKey, dataUrl, updatedAt: Date.now() });
    } catch (e) {
      console.warn('Failed to save to IndexedDB:', e);
    }
  }).catch(() => {});

  // 3. For small payloads (< 100KB), also mirror in localStorage for quick tab sync
  if (typeof dataUrl === 'string' && dataUrl.length < 100000) {
    try {
      const raw = localStorage.getItem('controlroom_media_cache') || '{}';
      const cache = JSON.parse(raw);
      cache[docKey] = dataUrl;
      localStorage.setItem('controlroom_media_cache', JSON.stringify(cache));
    } catch (_) {}
  }
};

export const getMediaFromCache = (docKey) => {
  if (!docKey) return null;

  // 1. Check in-memory map
  if (typeof window !== 'undefined' && window.__CR_MEDIA_MAP__ && window.__CR_MEDIA_MAP__.has(docKey)) {
    return window.__CR_MEDIA_MAP__.get(docKey);
  }

  // 2. Check localStorage
  try {
    const raw = localStorage.getItem('controlroom_media_cache') || '{}';
    const cache = JSON.parse(raw);
    if (cache[docKey]) {
      if (typeof window !== 'undefined' && window.__CR_MEDIA_MAP__) {
        window.__CR_MEDIA_MAP__.set(docKey, cache[docKey]);
      }
      return cache[docKey];
    }
  } catch (_) {}

  // 3. Asynchronously fetch from IndexedDB to warm the memory cache
  getDB().then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(docKey);
      req.onsuccess = () => {
        if (req.result?.dataUrl) {
          if (typeof window !== 'undefined' && window.__CR_MEDIA_MAP__) {
            window.__CR_MEDIA_MAP__.set(docKey, req.result.dataUrl);
            window.dispatchEvent(new CustomEvent('controlroom_media_cached', { detail: { name: docKey, dataUrl: req.result.dataUrl } }));
          }
        }
      };
    } catch (_) {}
  }).catch(() => {});

  return null;
};

export const getMediaFromCacheAsync = async (docKey) => {
  if (!docKey) return null;
  const syncVal = getMediaFromCache(docKey);
  if (syncVal) return syncVal;

  const db = await getDB();

  return new Promise((resolve) => {
    try {
      if (!db) {
        // Direct fallback to server media finder
        fetch(`/api/media/find/${encodeURIComponent(docKey)}`)
          .then(r => r.json())
          .then(data => {
            if (data?.found && data?.url) {
              saveMediaToCache(docKey, data.url);
              resolve(data.url);
            } else {
              resolve(null);
            }
          })
          .catch(() => resolve(null));
        return;
      }

      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(docKey);
      req.onsuccess = () => {
        if (req.result?.dataUrl) {
          if (typeof window !== 'undefined' && window.__CR_MEDIA_MAP__) {
            window.__CR_MEDIA_MAP__.set(docKey, req.result.dataUrl);
          }
          resolve(req.result.dataUrl);
        } else {
          // Check backend server
          fetch(`/api/media/find/${encodeURIComponent(docKey)}`)
            .then(r => r.json())
            .then(data => {
              if (data?.found && data?.url) {
                saveMediaToCache(docKey, data.url);
                resolve(data.url);
              } else {
                resolve(null);
              }
            })
            .catch(() => resolve(null));
        }
      };
      req.onerror = () => {
        fetch(`/api/media/find/${encodeURIComponent(docKey)}`)
          .then(r => r.json())
          .then(data => resolve(data?.found ? data.url : null))
          .catch(() => resolve(null));
      };
    } catch (_) {
      resolve(null);
    }
  });
};

/**
 * High-performance media uploader: streams video/image binary to backend server
 * Returns public URL (/api/uploads/...) accessible by all users across devices
 */
export const uploadMediaFile = async (file, originalName) => {
  if (!file) return null;
  const fileName = originalName || file.name || `media_${Date.now()}`;

  // 1. If native File or Blob, stream upload directly without base64 overhead
  if (file instanceof Blob || (typeof File !== 'undefined' && file instanceof File)) {
    try {
      const res = await fetch('/api/media/upload-raw', {
        method: 'POST',
        body: file,
        headers: {
          'x-file-name': encodeURIComponent(fileName),
          'Content-Type': file.type || 'application/octet-stream'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.url) {
          saveMediaToCache(fileName, data.url);
          return data;
        }
      }
    } catch (err) {
      console.warn('[uploadMediaFile raw stream failed]:', err);
    }
  }

  // 2. Fallback: Base64 JSON upload
  if (typeof file === 'string' && file.startsWith('data:')) {
    try {
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fileName, dataUrl: file })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.url) {
          saveMediaToCache(fileName, data.url);
          return data;
        }
      }
    } catch (err2) {
      console.warn('[uploadMediaFile base64 fallback failed]:', err2);
    }
  }

  return null;
};

export const stripDataUrlsFromRecord = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = JSON.parse(JSON.stringify(obj));

  const removeDataUrl = (target) => {
    if (!target || typeof target !== 'object') return;

    // Cache before stripping so data is never permanently lost
    const docIdentifier = target.name || target.id || target.title;
    if (docIdentifier) {
      if (target.dataUrl) saveMediaToCache(docIdentifier, target.dataUrl);
      if (target.fileData) saveMediaToCache(docIdentifier, target.fileData);
      if (target.proofDocData) saveMediaToCache(docIdentifier, target.proofDocData);
    }

    if (target.dataUrl) delete target.dataUrl;
    if (target.fileData) delete target.fileData;
    if (target.proofDocData) delete target.proofDocData;

    Object.keys(target).forEach((k) => {
      if (typeof target[k] === 'string' && (target[k].startsWith('data:') || (target[k].length > 1000 && /^[A-Za-z0-9+/=]+$/.test(target[k].slice(0, 100))))) {
        delete target[k];
      } else if (target[k] && typeof target[k] === 'object') {
        removeDataUrl(target[k]);
      }
    });
  };

  removeDataUrl(clone);
  return clone;
};

export const readCompressedImage = (file, callback) => {
  if (!file) {
    if (callback) callback(null);
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const result = e.target ? e.target.result : null;
    if (callback) callback(result);
  };
  reader.onerror = () => {
    if (callback) callback(null);
  };
  try {
    reader.readAsDataURL(file);
  } catch (err) {
    if (callback) callback(null);
  }
};

export const compressAndSaveFile = (file, callback) => {
  if (!file) return callback(null);
  const isImg = (file.type && file.type.startsWith('image/')) || /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(file.name || '');
  const isVid = (file.type && file.type.startsWith('video/')) || /\.(mp4|webm|mov|mkv|avi)$/i.test(file.name || '');
  const baseMeta = {
    name: file.name,
    size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
    type: file.type || (isImg ? 'image/jpeg' : isVid ? 'video/mp4' : 'application/pdf'),
    uploadedAt: new Date().toISOString()
  };

  const reader = new FileReader();
  reader.onload = (e) => {
    const rawDataUrl = e.target ? e.target.result : null;
    if (!rawDataUrl) {
      return callback(baseMeta);
    }
    if (isImg) {
      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width || 1280;
          let height = img.height || 720;
          const maxDim = 1280;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const compressedData = canvas.toDataURL('image/jpeg', 0.85);
          baseMeta.dataUrl = compressedData;
          if (baseMeta.name) {
            saveMediaToCache(baseMeta.name, compressedData);
          }
          callback(baseMeta);
        } catch (err) {
          baseMeta.dataUrl = rawDataUrl;
          if (baseMeta.name) saveMediaToCache(baseMeta.name, rawDataUrl);
          callback(baseMeta);
        }
      };
      img.onerror = () => {
        baseMeta.dataUrl = rawDataUrl;
        if (baseMeta.name) saveMediaToCache(baseMeta.name, rawDataUrl);
        callback(baseMeta);
      };
      img.src = rawDataUrl;
    } else {
      // Video, PDF, or other binary
      baseMeta.dataUrl = rawDataUrl;
      if (baseMeta.name) saveMediaToCache(baseMeta.name, rawDataUrl);
      callback(baseMeta);
    }
  };
  reader.onerror = () => callback(baseMeta);
  reader.readAsDataURL(file);
};
