import basePresets from "./data/vrmPresetsData.json";
import { fetchCloudStore } from "./utils/supabaseDataSync";
import { resolveDefaultUom } from "./utils/vrmProductsData";

/**
 * VRM_HDG_PRESETS
 * Standardized Presets extracted from "VRM - Product - Standardized Names.xlsx"
 * Contains:
 * - Hat Purline Structures (126 configurations)
 * - C Purlin Structures (126 configurations)
 * - Mini Rail Kits (40mm, 60mm, 75mm, 100mm, 125mm)
 * - Adhesive Rail Kits (Penetrative & Non-Penetrative)
 * - Long Rail & Double C Rail Kits
 * - Triangle Structure Kits (North Slope, East-West, Ballast)
 * - BOS Solar Kits (3kW, 4kW, 5kW DCR)
 */
export const VRM_HDG_PRESETS = basePresets;

// Cache basePresets lookup for fast access
const basePresetsMap = basePresets || {};

// Normalizer helper to clean preset components, prune duplicate clamps, combine fasteners, and enforce GST
const normalizePreset = (preset) => {
  if (!preset) return preset;
  let items = Array.isArray(preset.items) ? [...preset.items] : [];

  if (items.length > 0) {
    const map = new Map();
    items.forEach(it => {
      const rawName = (it.name || '').trim();
      if (!rawName) return;
      const cleanName = rawName.replace(/\s*\*\s*/g, '*');
      const resolvedUom = resolveDefaultUom({ ...it, name: cleanName }, it.uom || it.unit, 'NOS');
      if (map.has(cleanName)) {
        const ex = map.get(cleanName);
        const q1 = parseFloat(ex.qty) || 0;
        const q2 = parseFloat(it.qty) || 0;
        ex.qty = String(q1 + q2);
        if (!ex.uom) ex.uom = resolvedUom;
      } else {
        map.set(cleanName, { ...it, name: cleanName, uom: resolvedUom });
      }
    });
    items = Array.from(map.values());

    // Prune duplicate mid clamps (Universal Mid Clamp replaces Mid Clamp 35mm / 30mm)
    if (items.some(it => /universal\s+mid\s+clamp/i.test(it.name)) && items.some(it => /mid\s+clamp\s+3[05]mm/i.test(it.name))) {
      items = items.filter(it => !/mid\s+clamp\s+3[05]mm/i.test(it.name));
    }

    // Prune duplicate end clamps (End Clamp 30mm & 35mm redundant pair)
    const end30 = items.find(it => /end\s+clamp\s+30\s*mm/i.test(it.name));
    const end35 = items.find(it => /end\s+clamp\s+35\s*mm/i.test(it.name));
    if (end30 && end35) {
      const targetQty = Math.max(parseFloat(end30.qty) || 0, parseFloat(end35.qty) || 0);
      items = items.filter(it => it !== end30);
      end35.name = 'End Clamp 35 mm';
      end35.qty = String(targetQty || 8);
    }
  }

  const isDcrBos = (preset.category && (preset.category === 'DCR BOS Solar Kits' || preset.category === 'BOS Solar Kits' || preset.category.includes('DCR BOS'))) ||
                   (preset.label && preset.label.includes('BOS KITS'));
  if (isDcrBos) {
    items = items.map(it => ({ ...it, gstRate: '5%' }));
    return {
      ...preset,
      gstRate: '5%',
      gst: '5%',
      items
    };
  }
  return {
    ...preset,
    items
  };
};

// Load custom presets synchronously from localStorage on init
const loadLocalCustomPresets = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem("controlroom_presets_store");
    if (raw && raw !== "undefined" && raw !== "null") {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        if (Array.isArray(parsed)) {
          const map = {};
          parsed.forEach(p => { if (p && p.id) map[p.id] = p; });
          return map;
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Failed to load local presets cache:", e);
  }
  return {};
};

// In-memory active cache for custom presets directly backed by localStorage & Supabase
let customPresetsCache = loadLocalCustomPresets();
let cachedActivePresets = null;

const buildActivePresets = () => {
  const merged = { ...basePresetsMap, ...customPresetsCache };
  const normalized = {};
  Object.keys(merged).forEach(key => {
    normalized[key] = normalizePreset(merged[key]);
  });
  cachedActivePresets = normalized;
  return normalized;
};

/**
 * Synchronize custom presets with server and Supabase cloud store across all systems and devices
 */
let inFlightPresetsSync = null;
let lastPresetsSyncAt = 0;
const PRESETS_FOCUS_COOLDOWN_MS = 30 * 1000;

const getPresetAuthHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined' && window.localStorage) {
    const sesId = localStorage.getItem('controlroom_device_session_id');
    if (sesId) headers['x-session-id'] = sesId;
  }
  return headers;
};

const applyCustomPresetsAndBroadcast = (nextMap) => {
  customPresetsCache = nextMap && typeof nextMap === 'object' ? nextMap : {};
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('controlroom_presets_store', JSON.stringify(customPresetsCache));
    } catch (err) {
      console.warn('Could not save presets cache to localStorage:', err);
    }
  }
  const normalized = buildActivePresets();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vrm_presets_updated', { detail: normalized }));
  }
  return normalized;
};

export async function syncPresetsWithCloud({ force = false } = {}) {
  const now = Date.now();
  if (!force && lastPresetsSyncAt > 0 && (now - lastPresetsSyncAt < PRESETS_FOCUS_COOLDOWN_MS)) {
    return getAllActivePresets();
  }
  if (inFlightPresetsSync) {
    return inFlightPresetsSync;
  }

  inFlightPresetsSync = (async () => {
    try {
      let serverRes = null;
      let serverRespondedOk = false;
      let cloudPresets = null;
      try {
        const res = await fetch('/api/store/presets_store', { headers: getPresetAuthHeaders() });
        if (res.ok) {
          serverRes = await res.json();
          serverRespondedOk = true;
        }
      } catch (_) {}

      if (!serverRespondedOk) {
        cloudPresets = await fetchCloudStore('presets_store', {}).catch(() => ({}));
      }

      const incomingMap = {};
      const sourceData = serverRespondedOk ? serverRes?.data : cloudPresets;
      if (sourceData && typeof sourceData === 'object') {
        if (Array.isArray(sourceData)) {
          sourceData.forEach(p => { if (p && p.id && (p.isCustom || !basePresetsMap[p.id])) incomingMap[p.id] = p; });
        } else {
          Object.entries(sourceData).forEach(([k, v]) => {
            if (v && (v.isCustom || !basePresetsMap[k])) incomingMap[k] = v;
          });
        }
      }

      lastPresetsSyncAt = Date.now();

      // Database is the authoritative source of truth (never resurrect deleted presets from stale localStorage)
      if (serverRespondedOk || Object.keys(incomingMap).length > 0) {
        const nextCustom = serverRespondedOk ? incomingMap : { ...customPresetsCache, ...incomingMap };
        if (JSON.stringify(customPresetsCache) !== JSON.stringify(nextCustom)) {
          return applyCustomPresetsAndBroadcast(nextCustom);
        }
      }
    } catch (err) {
      console.warn('Could not sync presets with cloud:', err);
    }
    return getAllActivePresets();
  })().finally(() => {
    inFlightPresetsSync = null;
  });

  return inFlightPresetsSync;
}

/**
 * Get all active presets including custom/edited presets stored in PostgreSQL database
 */
export function getAllActivePresets() {
  if (cachedActivePresets) return cachedActivePresets;
  return buildActivePresets();
}

const preparePresetPayload = (preset) => {
  const cleanItems = Array.isArray(preset.items) ? preset.items.map(it => {
    const rawQ = it.qty !== undefined && it.qty !== null ? String(it.qty).trim() : '';
    return {
      ...it,
      qty: (rawQ === '' || rawQ === '0') ? '' : rawQ
    };
  }) : [];
  return {
    ...preset,
    isCustom: true,
    items: cleanItems,
    updated_at: new Date().toISOString()
  };
};

/**
 * Save or update a single custom preset via authenticated POST /api/presets (one record = one DB write)
 */
export async function saveCustomPresetAsync(preset) {
  if (!preset || !preset.id) {
    return { ok: false, error: 'Preset id is required.', presets: getAllActivePresets() };
  }
  const toSave = preparePresetPayload(preset);
  try {
    const res = await fetch('/api/presets', {
      method: 'POST',
      headers: getPresetAuthHeaders(),
      body: JSON.stringify(toSave)
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) {
      return {
        ok: false,
        error: body.error || `Server rejected preset save (HTTP ${res.status})`,
        presets: getAllActivePresets()
      };
    }
    const saved = body.preset || toSave;
    const normalized = applyCustomPresetsAndBroadcast({ ...customPresetsCache, [saved.id]: saved });
    return { ok: true, preset: saved, presets: normalized };
  } catch (err) {
    console.error('Error saving custom preset:', err);
    return {
      ok: false,
      error: err?.message || 'Network error while saving preset.',
      presets: getAllActivePresets()
    };
  }
}

export function saveCustomPreset(preset) {
  if (!preset || !preset.id) return getAllActivePresets();
  const toSave = preparePresetPayload(preset);
  const normalized = applyCustomPresetsAndBroadcast({ ...customPresetsCache, [toSave.id]: toSave });
  // Persist single preset asynchronously with session auth
  fetch('/api/presets', {
    method: 'POST',
    headers: getPresetAuthHeaders(),
    body: JSON.stringify(toSave)
  }).catch((err) => console.warn('Background preset save failed:', err));
  return normalized;
}

/**
 * Delete a single custom preset via authenticated DELETE /api/presets/:id
 */
export async function deleteCustomPresetAsync(presetId) {
  if (!presetId) {
    return { ok: false, error: 'Preset id is required.', presets: getAllActivePresets() };
  }
  try {
    const res = await fetch(`/api/presets/${encodeURIComponent(presetId)}`, {
      method: 'DELETE',
      headers: getPresetAuthHeaders()
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) {
      return {
        ok: false,
        error: body.error || `Server rejected preset delete (HTTP ${res.status})`,
        presets: getAllActivePresets()
      };
    }
    const nextMap = { ...customPresetsCache };
    delete nextMap[presetId];
    const normalized = applyCustomPresetsAndBroadcast(nextMap);
    return { ok: true, presets: normalized };
  } catch (err) {
    console.error('Error deleting custom preset:', err);
    return {
      ok: false,
      error: err?.message || 'Network error while deleting preset.',
      presets: getAllActivePresets()
    };
  }
}

export function deleteCustomPreset(presetId) {
  if (!presetId) return getAllActivePresets();
  const nextMap = { ...customPresetsCache };
  delete nextMap[presetId];
  const normalized = applyCustomPresetsAndBroadcast(nextMap);
  fetch(`/api/presets/${encodeURIComponent(presetId)}`, {
    method: 'DELETE',
    headers: getPresetAuthHeaders()
  }).catch((err) => console.warn('Background preset delete failed:', err));
  return normalized;
}

// Background auto-sync on browser load, window focus, and instant real-time SSE single-preset updates
if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncPresetsWithCloud();
  }, 150);

  window.addEventListener('focus', () => {
    syncPresetsWithCloud();
  });

  window.addEventListener('controlroom_presets_realtime_update', (e) => {
    const detail = e?.detail || {};
    if (detail.action === 'upsert' && detail.preset && detail.preset.id) {
      applyCustomPresetsAndBroadcast({ ...customPresetsCache, [detail.preset.id]: detail.preset });
    } else if (detail.action === 'delete' && (detail.presetId || detail.recordId)) {
      const targetId = detail.presetId || detail.recordId;
      const nextMap = { ...customPresetsCache };
      delete nextMap[targetId];
      applyCustomPresetsAndBroadcast(nextMap);
    } else {
      syncPresetsWithCloud({ force: true });
    }
  });
}

/**
 * Presets where item quantities remain fixed at 1 (decoupled from set count multiplier)
 * while kit pricing multiplies by set count (Option A).
 */
export const FIXED_QUANTITY_PRESET_IDS = new Set([
  'preset_1_40mm_mini_rail',
  'preset_2_60mm_mini_rail',
  'preset_3_mini_rail_75mm_new',
  'preset_4_100mm_mini_rail__new_',
  'preset_5_mini_rail_125mm_height_and_300mm_length',
  'preset_6_120mm_adhesive_rail',
  'preset_7_120mm_adhesive_rail',
  'preset_8_struct_rail_2_4mm',
  'preset_9_double_c_rail_2_4m',
  'preset_10_2_mtr_triangle_structure_north_slope',
  'preset_11_2_mtr_triangle_structure_east_west_slope',
  'preset_12_2_mtr_triangle_structure_bllast_structures'
]);

/**
 * Checks if a preset has its component quantities decoupled (cut connection) from set count.
 * Returns true if item quantities must remain fixed at 1 (or base quantity).
 */
export function isFixedQuantityPreset(presetId, presetName) {
  if (!presetId && !presetName) return false;
  const pId = String(presetId || '').trim();
  if (pId && FIXED_QUANTITY_PRESET_IDS.has(pId)) return true;
  const pName = String(presetName || '').toLowerCase().trim();
  return (
    pName.includes('mini rail') ||
    pName.includes('adhesive rail') ||
    pName.includes('struct rail 2.4') ||
    pName.includes('double c rail 2.4') ||
    pName.includes('triangle structure')
  );
}
