import { fetchCloudStore, saveCloudStore } from '../utils/supabaseDataSync';
import { VRM_OFFICIAL_LOGO, VRM_OFFICIAL_STAMP } from '../utils/vrmOfficialAssets';

export const DEFAULT_BRANDING = {
  logoUrl: VRM_OFFICIAL_LOGO,
  logoHeight: 56,
  showLogo: true,
  stampMode: 'custom', // 'vector' | 'custom' | 'none'
  customStampUrl: VRM_OFFICIAL_STAMP,
  stampSize: 230,
  showSignatoryStamp: true,
  stampText: 'VRM STRUCTURES INDIA PRIVATE LIMITED',
  stampLocation: 'CHENNAI',
  forCompanyText: 'For VRM Structures India Pvt Ltd',
  signatoryTitle: 'Authorized Signatory',
  signatoryName: '',
  signatureMode: 'none', // 'none' | 'vector' | 'custom'
  customSignatureUrl: null
};

const STORAGE_KEY = 'vrm_company_branding';

/**
 * Reads the synchronous local cache for immediate zero-latency UI rendering.
 */
export const getCachedBranding = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const constantLogo = localStorage.getItem('vrm_constant_logo');
    const constantStamp = localStorage.getItem('vrm_constant_stamp');

    let branding = { ...DEFAULT_BRANDING };

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          branding = { ...branding, ...parsed };
        }
      } catch (_) {}
    }

    // Freeze official stamp and logo as permanent defaults if not explicitly custom-uploaded
    if (!branding.customStampUrl || branding.stampMode === 'vector') {
      branding.customStampUrl = constantStamp || VRM_OFFICIAL_STAMP;
      branding.stampMode = 'custom';
    }
    if (!branding.logoUrl || branding.logoUrl === '/vrm_logo.png') {
      branding.logoUrl = constantLogo || VRM_OFFICIAL_LOGO;
    }
    branding.showSignatoryStamp = true;

    return branding;
  } catch (e) {
    return { ...DEFAULT_BRANDING, customStampUrl: VRM_OFFICIAL_STAMP, logoUrl: VRM_OFFICIAL_LOGO };
  }
};

/**
 * Fetches the master company branding from the central backend server / cloud database.
 * Syncs the local browser cache and dispatches an update event so all open views reflect the change.
 */
export const fetchMasterBranding = async () => {
  try {
    // 1. Try fetching from Node server store
    const res = await fetch('/api/store/company_branding_store');
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data && typeof json.data === 'object' && !Array.isArray(json.data)) {
        if (!json.data.customStampUrl || json.data.stampMode === 'vector') {
          json.data.customStampUrl = VRM_OFFICIAL_STAMP;
          json.data.stampMode = 'custom';
        }
        if (!json.data.logoUrl || json.data.logoUrl === '/vrm_logo.png') {
          json.data.logoUrl = VRM_OFFICIAL_LOGO;
        }
        applyAndCacheBranding(json.data);
        return json.data;
      }
    }

    // 2. Fallback to Supabase cloud store
    const cloudData = await fetchCloudStore('company_branding_store', null);
    if (cloudData && typeof cloudData === 'object' && !Array.isArray(cloudData)) {
      if (!cloudData.customStampUrl || cloudData.stampMode === 'vector') {
        cloudData.customStampUrl = VRM_OFFICIAL_STAMP;
        cloudData.stampMode = 'custom';
      }
      if (!cloudData.logoUrl || cloudData.logoUrl === '/vrm_logo.png') {
        cloudData.logoUrl = VRM_OFFICIAL_LOGO;
      }
      applyAndCacheBranding(cloudData);
      return cloudData;
    }
  } catch (err) {
    console.warn('[BrandingService] Error fetching master branding from server:', err);
  }
  return getCachedBranding();
};

/**
 * Internal helper to save branding into localStorage and notify listeners.
 */
const applyAndCacheBranding = (data) => {
  try {
    const current = getCachedBranding();
    const merged = { ...current, ...data };

    if (!merged.customStampUrl || merged.stampMode === 'vector') {
      merged.customStampUrl = VRM_OFFICIAL_STAMP;
      merged.stampMode = 'custom';
    }
    if (!merged.logoUrl || merged.logoUrl === '/vrm_logo.png') {
      merged.logoUrl = VRM_OFFICIAL_LOGO;
    }
    merged.showSignatoryStamp = true;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (_) {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vrm_branding_updated', { detail: merged }));
    }
  } catch (e) {
    console.warn('[BrandingService] Could not cache branding to localStorage:', e);
  }
};

/**
 * Saves company branding updates locally AND pushes to the central backend server
 * so that all other logins, browsers, and devices immediately receive the exact same assets.
 */
export const saveCompanyBranding = async (updates) => {
  try {
    const current = getCachedBranding();
    const updated = {
      ...current,
      ...updates,
      lastUpdated: new Date().toISOString()
    };

    // 1. Immediate local cache write
    applyAndCacheBranding(updated);

    // 2. Async save to server backend store (/api/store/company_branding_store)
    try {
      await fetch('/api/store/company_branding_store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (netErr) {
      console.warn('[BrandingService] Server post error:', netErr);
    }

    // 3. Persist to Supabase cloud store for multi-system resilience
    try {
      saveCloudStore('company_branding_store', updated);
    } catch (sErr) {
      console.warn('[BrandingService] Supabase cloud store error:', sErr);
    }

    return updated;
  } catch (err) {
    console.error('[BrandingService] Error saving company branding:', err);
    return getCachedBranding();
  }
};

/**
 * Subscribe to live branding updates across components and browser storage events.
 */
export const subscribeBrandingUpdates = (callback) => {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (e) => {
    callback(e.detail || getCachedBranding());
  };

  const handleStorageEvent = (e) => {
    if (e.key === STORAGE_KEY || e.key === 'vrm_constant_stamp' || e.key === 'vrm_constant_logo') {
      callback(getCachedBranding());
    }
  };

  window.addEventListener('vrm_branding_updated', handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener('vrm_branding_updated', handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
};
