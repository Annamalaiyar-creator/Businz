import basePresets from "./data/vrmPresetsData.json";
import { fetchCloudStore, saveCloudStoreImmediate } from "./utils/supabaseDataSync";

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

// Normalizer helper to enforce 5% GST default for DCR BOS Solar Proposal Kits
const normalizePresetGst = (preset) => {
  if (!preset) return preset;
  const isDcrBos = (preset.category && (preset.category === 'DCR BOS Solar Kits' || preset.category === 'BOS Solar Kits' || preset.category.includes('DCR BOS'))) ||
                   (preset.label && preset.label.includes('BOS KITS'));
  if (isDcrBos) {
    const updatedItems = Array.isArray(preset.items) ? preset.items.map(it => ({ ...it, gstRate: '5%' })) : [];
    return {
      ...preset,
      gstRate: '5%',
      gst: '5%',
      items: updatedItems
    };
  }
  return preset;
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

/**
 * Synchronize custom presets with server and Supabase cloud store across all systems and devices
 */
export async function syncPresetsWithCloud() {
  try {
    const [cloudPresets, serverRes] = await Promise.all([
      fetchCloudStore('presets_store', {}).catch(() => ({})),
      fetch('/api/store/presets_store').then(r => r.ok ? r.json() : null).catch(() => null)
    ]);

    let incomingMap = {};
    if (serverRes && serverRes.data && typeof serverRes.data === 'object') {
      const sData = serverRes.data;
      if (Array.isArray(sData)) {
        sData.forEach(p => { if (p && p.id && (p.isCustom || !basePresetsMap[p.id])) incomingMap[p.id] = p; });
      } else {
        Object.entries(sData).forEach(([k, v]) => {
          if (v && (v.isCustom || !basePresetsMap[k])) incomingMap[k] = v;
        });
      }
    }

    if (cloudPresets && typeof cloudPresets === 'object') {
      if (Array.isArray(cloudPresets)) {
        cloudPresets.forEach(p => { if (p && p.id && (p.isCustom || !basePresetsMap[p.id])) incomingMap[p.id] = p; });
      } else {
        Object.entries(cloudPresets).forEach(([k, v]) => {
          if (v && (v.isCustom || !basePresetsMap[k])) incomingMap[k] = v;
        });
      }
    }

    if (Object.keys(incomingMap).length > 0) {
      customPresetsCache = { ...customPresetsCache, ...incomingMap };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("controlroom_presets_store", JSON.stringify(customPresetsCache));
        } catch (_) {}
      }
      const mergedAll = { ...basePresetsMap, ...customPresetsCache };
      const normalized = {};
      Object.keys(mergedAll).forEach(key => {
        normalized[key] = normalizePresetGst(mergedAll[key]);
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("vrm_presets_updated", { detail: normalized }));
      }
      return normalized;
    }
  } catch (err) {
    console.warn("Could not sync presets with cloud:", err);
  }
  return getAllActivePresets();
}

/**
 * Get all active presets including custom/edited presets stored in Supabase database
 */
export function getAllActivePresets() {
  const merged = { ...basePresetsMap, ...customPresetsCache };
  const normalized = {};
  Object.keys(merged).forEach(key => {
    normalized[key] = normalizePresetGst(merged[key]);
  });
  return normalized;
}

/**
 * Save or update a custom preset into Supabase Database and broadcast real-time update
 */
export function saveCustomPreset(preset) {
  if (!preset || !preset.id) return getAllActivePresets();

  try {
    const toSave = {
      ...preset,
      isCustom: true,
      updated_at: new Date().toISOString()
    };
    customPresetsCache[preset.id] = toSave;

    // Immediately persist to localStorage so it survives tab reloads and refreshes
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("controlroom_presets_store", JSON.stringify(customPresetsCache));
      } catch (err) {
        console.warn("Could not save presets to localStorage:", err);
      }
    }

    // Create merged allPresets dictionary
    const merged = { ...basePresetsMap, ...customPresetsCache };
    const normalized = {};
    Object.keys(merged).forEach(key => {
      normalized[key] = normalizePresetGst(merged[key]);
    });

    // Dispatch real-time update event immediately to all active views and selectors
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("vrm_presets_updated", { detail: normalized }));
    }

    // Push to backend server and Supabase cloud store in background without blocking
    try {
      fetch('/api/store/presets_store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customPresetsCache)
      }).catch(() => {});
      saveCloudStoreImmediate('presets_store', customPresetsCache).catch(() => {});
    } catch (_) {}

    return normalized;
  } catch (e) {
    console.error("Error saving custom preset", e);
    return getAllActivePresets();
  }
}

/**
 * Delete a custom preset and sync deletion to server & cloud
 */
export function deleteCustomPreset(presetId) {
  if (!presetId) return getAllActivePresets();
  try {
    delete customPresetsCache[presetId];

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("controlroom_presets_store", JSON.stringify(customPresetsCache));
      } catch (err) {}
    }

    // Push deletion to backend server and cloud store in background
    try {
      fetch('/api/store/presets_store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customPresetsCache)
      }).catch(() => {});
      saveCloudStoreImmediate('presets_store', customPresetsCache).catch(() => {});
    } catch (_) {}

    const merged = { ...basePresetsMap, ...customPresetsCache };
    const normalized = {};
    Object.keys(merged).forEach(key => {
      normalized[key] = normalizePresetGst(merged[key]);
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("vrm_presets_updated", { detail: normalized }));
    }
    return normalized;
  } catch (e) {
    console.error("Error deleting custom preset", e);
    return getAllActivePresets();
  }
}

// Background auto-sync on browser load and window focus
if (typeof window !== "undefined") {
  setTimeout(() => {
    syncPresetsWithCloud();
  }, 150);

  window.addEventListener("focus", () => {
    syncPresetsWithCloud();
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
