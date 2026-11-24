import VRM_PRODUCTS_DATA from '../data/vrmProductsList.json' with { type: 'json' };

/**
 * VRM Standardized Master Products Dataset
 * Synchronized directly from "VRM - Product - Standardized Names.xlsx"
 * Total Products: 286
 */
export const VRM_PRODUCTS = VRM_PRODUCTS_DATA;

export const normalizeProductName = (str) => {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/(\d+)\s*(mm|m|inch|nos|w|wp|kg)\b/gi, '$1$2')
    .replace(/[*x×]/g, 'x')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const wordFingerprint = (str) => {
  if (!str) return '';
  const normalized = normalizeProductName(str);
  const words = normalized.split(/\s+/).filter(w => w && !['nos', 'mm'].includes(w));
  return Array.from(new Set(words)).sort().join('_');
};

export const CANONICAL_PRODUCT_ALIASES = {
  'MR40N': 'MR40',
  'MR60N': 'MR60',
  'FG-6732': 'MR125',
  'FG-5185': 'MR120',
  'FG-6731': 'MR100',
  'FG-4272': 'ANM10*100',
  'FG-5057': 'ANM10*100',
  'FG-0234': 'ANM10*100',
  'FG-8184': 'HP3600',
  'FG-5184': 'HP3600',
  'FG-4569': 'HP2485',
  'FG-9681': 'ABD540',
  'FG-5068': 'DHT40',
  'FG-3914': 'WTD610',
  'FG-8311': 'WTD585',
  'FG-9323': 'ABD545',
  'FG-4484': 'ABD555',
  'FG-5845': 'RC40',
  'FG-5846': 'CB3000',
  'FG-0472': 'AM8*50',
  'FG-4621': 'CP3000',
  'FG-4047': 'HP3035',
  'FG-7997': 'WTD580',
  'FG-7998': 'EPC6',
  'FG-7999': 'MC4',
  'FG-1041': 'PS4',
  'FG-7910': 'MR40',
  'FG-8001': 'MR60',
  'FG-7244': 'MR100O',
  'FG-8886': 'MR100O',
  'MR300': 'MR-300MM',
  'MR300MM': 'MR-300MM',
  'MINI-RAIL-300MM': 'MR-300MM'
};

// Global resolution cache for instant O(1) repeated lookups
const resolveCodeCache = new Map();

// Pre-indexed lookup maps for instant resolution without searching array
const directExactNameMap = new Map();
const directNormNameMap = new Map();
const directFingerprintMap = new Map();

(VRM_PRODUCTS || []).forEach(p => {
  if (!p || !p.code) return;
  const c = p.code.toUpperCase();
  const alias = CANONICAL_PRODUCT_ALIASES[c] || c;
  if (p.name) {
    const rawLower = p.name.toLowerCase().trim();
    if (!directExactNameMap.has(rawLower)) directExactNameMap.set(rawLower, alias);
    const norm = normalizeProductName(p.name);
    if (norm && !directNormNameMap.has(norm)) directNormNameMap.set(norm, alias);
    const fp = wordFingerprint(p.name);
    if (fp && !directFingerprintMap.has(fp)) directFingerprintMap.set(fp, alias);
  }
});

export const resolveProductCode = (item, productsList = VRM_PRODUCTS) => {
  if (!item) return '';
  const rawDirect = String(item.code || item.sku || '').trim().toUpperCase();
  const direct = CANONICAL_PRODUCT_ALIASES[rawDirect] || rawDirect;
  if (direct && direct !== 'VRM-ITEM' && direct !== 'ITEM' && !direct.startsWith('FG-')) {
    return direct;
  }

  const rawName = String(item.name || item.description || '').trim();
  if (!rawName) return direct || '';

  const cacheKey = (rawDirect || '') + '||' + rawName;
  if (resolveCodeCache.has(cacheKey)) {
    return resolveCodeCache.get(cacheKey);
  }

  // Fast O(1) direct map lookups
  const cleanStr = rawName.toLowerCase().trim();
  if (directExactNameMap.has(cleanStr)) {
    const res = directExactNameMap.get(cleanStr);
    resolveCodeCache.set(cacheKey, res);
    return res;
  }

  const normRaw = normalizeProductName(rawName);
  if (normRaw && directNormNameMap.has(normRaw)) {
    const res = directNormNameMap.get(normRaw);
    resolveCodeCache.set(cacheKey, res);
    return res;
  }

  // Pattern-based resolution for common aliases (e.g. Mini Rails, Adhesive Rails, Double C Rails)
  const mrMatch = cleanStr.match(/mini\s*rail\s*[-–—]?\s*(\d+)\s*mm/i) || cleanStr.match(/(\d+)\s*mm\s*mini\s*rail/i) || cleanStr.match(/mini\s*rail\s*[-–—]?\s*(\d+)/i);
  if (mrMatch) {
    const mm = mrMatch[1];
    let res = 'MR' + mm;
    if (mm === '300') res = 'MR-300MM';
    else if (cleanStr.includes('old')) res = 'MR' + mm + 'O';
    else if (cleanStr.includes('new') && mm === '100') res = 'MR100N';
    res = res.toUpperCase();
    resolveCodeCache.set(cacheKey, res);
    return res;
  }
  if (cleanStr.includes('mini rail') && (cleanStr.includes('300 mm') || cleanStr.includes('300mm') || cleanStr.includes('- 300'))) {
    resolveCodeCache.set(cacheKey, 'MR-300MM');
    return 'MR-300MM';
  }
  const arMatch = cleanStr.match(/adhesive\s*rail\s*(\d+)/i) || cleanStr.match(/(\d+)\s*mm\s*adhesive\s*rail/i);
  if (arMatch) {
    const res = ('AR' + arMatch[1]).toUpperCase();
    resolveCodeCache.set(cacheKey, res);
    return res;
  }
  const ccMatch = cleanStr.match(/double\s*c\s*rail\s*([\d.]+)/i);
  if (ccMatch) {
    const len = ccMatch[1];
    let res = 'CC' + len;
    if (cleanStr.includes('new')) res += 'N';
    else if (cleanStr.includes('old')) res += 'O';
    res = res.toUpperCase();
    resolveCodeCache.set(cacheKey, res);
    return res;
  }
  const srMatch = cleanStr.match(/struct\s*rail\s*([\d.]+)/i);
  if (srMatch) {
    const res = ('SR' + srMatch[1]).toUpperCase();
    resolveCodeCache.set(cacheKey, res);
    return res;
  }
  if (/hand\s*rail/i.test(cleanStr)) {
    resolveCodeCache.set(cacheKey, 'HR');
    return 'HR';
  }

  // 2. Word fingerprint match
  const fp = wordFingerprint(rawName);
  if (fp && directFingerprintMap.has(fp)) {
    const res = directFingerprintMap.get(fp);
    resolveCodeCache.set(cacheKey, res);
    return res;
  }

  // 3. Clean parenthetical variations (e.g. "(300mm)", "(100mm)", "new", "old")
  const strippedName = rawName.replace(/\([^)]*\)/g, '').replace(/\b(new|old|nos|mm)\b/gi, '').trim();
  if (strippedName && strippedName.length >= 3) {
    const normStripped = normalizeProductName(strippedName);
    if (normStripped && directNormNameMap.has(normStripped)) {
      const res = directNormNameMap.get(normStripped);
      resolveCodeCache.set(cacheKey, res);
      return res;
    }
  }

  // 4. Fallback search only when using a custom productsList or unindexed items
  if (productsList && productsList !== VRM_PRODUCTS) {
    const exact = productsList.find(p => p.name && (
      p.name.toLowerCase().trim() === cleanStr ||
      normalizeProductName(p.name) === normRaw
    ));
    if (exact && exact.code) {
      const c = exact.code.toUpperCase();
      const res = CANONICAL_PRODUCT_ALIASES[c] || c;
      resolveCodeCache.set(cacheKey, res);
      return res;
    }
  }

  const finalRes = CANONICAL_PRODUCT_ALIASES[direct] || direct || '';
  resolveCodeCache.set(cacheKey, finalRes);
  return finalRes;
};

/**
 * Detects whether a preset or item is a "Rails Preset" (Mini Rail, Adhesive Rail, Long Rail, Double C Rail, C Rail, Struct Rail, etc.).
 * For Rails presets, user mandated that the quantity entered by salesperson is directly the total dispatch quantity (multiplier = 1).
 * Checks presetName, category, subPresetName, and item name.
 */
export const isRailPreset = (presetName = '', category = '', subPresetName = '', itemName = '') => {
  const norm = `${presetName || ''} ${category || ''} ${subPresetName || ''} ${itemName || ''}`.toLowerCase();
  return (
    norm.includes('mini rail') ||
    norm.includes('adhesive rail') ||
    norm.includes('double c rail') ||
    norm.includes('c rail') ||
    norm.includes('long rail') ||
    norm.includes('struct rail') ||
    norm.includes('short rail') ||
    norm.includes('rail kit') ||
    norm.includes('rail preset') ||
    norm.includes('rails preset') ||
    /\brails?\b/i.test(norm)
  );
};

/**
 * Detects whether a preset or item is capacity-based (kW).
 * User rule: when unit is kW (or name indicates kW, e.g. "3 kW DCR Kit"), the salesperson
 * enters the ENTIRE total quantity needed for that kW capacity directly.
 * Therefore, kW presets MUST NOT be multiplied by set count (multiplier is strictly 1).
 */
export const isKwPreset = (presetName = '', unit = '', item = {}) => {
  const normUnit = String(unit || item?.unit || item?.uom || item?.unitType || item?.presetUnit || '').trim().toLowerCase();
  if (normUnit === 'kw' || normUnit === 'kwh') return true;
  if (item?.isKwBased) return true;
  const normName = `${presetName || ''} ${item?.presetName || ''} ${item?.subPresetName || ''} ${item?.name || ''}`.toLowerCase();
  return (
    normName.includes(' kw ') ||
    normName.endsWith(' kw') ||
    normName.startsWith('kw ') ||
    /\b\d+\s*kw\b/i.test(normName)
  );
};

/**
 * Calculates the Total Dispatch Quantity for an item in a preset kit or standalone item.
 * - In printouts: Shows ONLY Qty / Set.
 * - In software: Shows BOTH Qty / Set and Total Dispatch Quantity.
 * - Special Rule 1 (Standalone): entered quantity is directly the total dispatch quantity (multiplier = 1).
 * - Special Rule 2 (kW Presets): salesperson enters entire capacity quantity directly -> multiplier = 1 (NOT multiplied).
 * - Special Rule 3 (Rails Presets): salesperson enters direct roof sheet requirement -> multiplier = 1 (NOT multiplied, even inside table sets).
 * - Special Rule 4 (Table / Structure Presets with Unit = 'Set' or 'Kit'): salesperson enters qty for 1 set -> multiplied by Set Count.
 */
export const calculateTotalDispatchQty = (item, setCount = 1, presetName = '', presetCategory = '', unit = '') => {
  if (!item) return 0;
  const baseQty = parseFloat(
    item.qty !== undefined && item.qty !== null && item.qty !== ''
      ? item.qty
      : (item.bomQty !== undefined && item.bomQty !== null && item.bomQty !== ''
        ? item.bomQty
        : (item.quantity !== undefined && item.quantity !== null && item.quantity !== ''
          ? item.quantity
          : (item.totalDispatchQty || 0)))
  ) || 0;
  if (baseQty <= 0) return 0;

  // 1. Standalone custom items or Create Set (isCustomSet) -> entered quantity is directly the total dispatch qty (multiplier = 1)
  const isCustomSetItem = Boolean(
    item.isCustomSet ||
    item.isCustomGrp ||
    item.presetId === 'custom_set' ||
    String(item.presetGroupId || '').startsWith('custom_set_') ||
    String(item.groupId || '').startsWith('custom_set_') ||
    String(presetName || item.presetName || '').toLowerCase().includes('custom set') ||
    String(presetCategory || item.category || '').toLowerCase().includes('custom set')
  );
  if (isCustomSetItem || (!item.isPresetItem && !item.presetGroupId && !item.presetName && !presetName)) {
    return baseQty;
  }

  // Determine the effective target preset name and unit for this item
  // If the item is a sub-preset, prioritize its own subPresetName over the parent presetName
  const effectivePreset = (item.isSubPreset && item.subPresetName) ? item.subPresetName : (presetName || item.presetName || '');
  const effectiveUnit = (item.isSubPreset && item.subUnit) ? item.subUnit : (unit || item.unit || item.uom || '');

  // 2. kW Capacity Rule: If the preset or item has unit = kW (or name indicates kW),
  // the salesperson enters the ENTIRE total quantity for that kW capacity directly -> multiplier = 1 (NOT multiplied by setCount).
  const isKw = isKwPreset(effectivePreset, effectiveUnit, item);
  if (isKw) {
    return baseQty;
  }

  // 3. Rails Rule & Triangle Direct Rule: Mini Rails, Adhesive Rails, Short Rails, Long Rails, and 2 Mtr Triangle Structures
  // Quantity is entered directly by salesperson -> multiplier = 1 (NOT multiplied by table setCount).
  const isRail = isRailPreset(effectivePreset, presetCategory || item.category, item.isSubPreset ? item.subPresetName : '', item.name);
  const isTriangleDirect = isTriangleDirectPreset(
    effectivePreset,
    presetCategory || item.category,
    item.isSubPreset ? item.subPresetName : '',
    item.presetId || item.subPresetId || ''
  );
  if (isRail || isTriangleDirect) {
    return baseQty;
  }

  // 4. Sub-Preset with its own independent set count:
  if (item.isSubPreset && item.subSetCount) {
    const subMult = Math.max(0.01, parseFloat(item.subSetCount) || 1);
    return Math.round(baseQty * subMult * 100) / 100;
  }

  // 5. Structure / Table Presets (Unit = Set / Kit):
  // Salesperson enters quantity for 1 set/kit -> multiplied by the set count.
  const mult = Math.max(0.01, parseFloat(setCount) || 1);
  return Math.round(baseQty * mult * 100) / 100;
};

export const resolveBomItemDispatchQty = (item, bomRecord = null, rawMatch = null) => {
  if (!item && !rawMatch) return 0;
  const it = item || {};
  const rm = rawMatch || {};
  if (it.totalDispatchQty !== undefined && it.totalDispatchQty !== null && it.totalDispatchQty !== '') {
    return Number(it.totalDispatchQty) || 0;
  }
  if (rm.totalDispatchQty !== undefined && rm.totalDispatchQty !== null && rm.totalDispatchQty !== '') {
    return Number(rm.totalDispatchQty) || 0;
  }

  const rawGroups = bomRecord?.presetGroups;
  const groupsMap = Array.isArray(rawGroups)
    ? rawGroups.reduce((acc, g) => {
        const gid = g?.groupId || g?.presetGroupId;
        if (gid) acc[gid] = g;
        return acc;
      }, {})
    : (rawGroups && typeof rawGroups === 'object' ? rawGroups : {});

  const groupId = it.presetGroupId || rm.presetGroupId || null;
  const grp = groupId ? groupsMap[groupId] : null;
  const isPreset = Boolean(it.isPresetItem || rm.isPresetItem || groupId || it.presetName || rm.presetName);

  const isCustomSet = Boolean(
    it.isCustomSet ||
    rm.isCustomSet ||
    grp?.isCustomSet ||
    grp?.presetId === 'custom_set' ||
    String(groupId || '').startsWith('custom_set_') ||
    String(it.presetGroupId || '').startsWith('custom_set_') ||
    String(rm.presetGroupId || '').startsWith('custom_set_') ||
    String(it.presetName || rm.presetName || grp?.presetName || '').toLowerCase().includes('custom set')
  );
  let effectiveSetCount = 1;
  if (isCustomSet) {
    effectiveSetCount = 1;
  } else if (it.isSubPreset || rm.isSubPreset) {
    effectiveSetCount = parseFloat(it.subSetCount || rm.subSetCount || 1) || 1;
  } else if (grp) {
    effectiveSetCount = parseFloat(grp.setCount || grp.sets || 1) || 1;
  } else if (isPreset) {
    effectiveSetCount = parseFloat(it.setCount || rm.setCount || bomRecord?.presetSetCount || bomRecord?.setCount || 1) || 1;
  }

  const effectivePresetName = it.presetName || rm.presetName || grp?.presetName || (isPreset ? bomRecord?.presetName : '') || '';
  const effectiveCategory = it.category || rm.category || grp?.category || '';
  const effectiveUnit = grp?.unit || grp?.unitType || it.unit || it.uom || rm.unit || rm.uom || '';

  return calculateTotalDispatchQty(
    { ...rm, ...it, presetId: it.presetId || rm.presetId || grp?.presetId || '', isCustomSet },
    effectiveSetCount,
    effectivePresetName,
    effectiveCategory,
    effectiveUnit
  );
};

const TRIANGLE_DIRECT_PRESET_IDS = new Set([
  'preset_10_2_mtr_triangle_structure_north_slope',
  'preset_11_2_mtr_triangle_structure_east_west_slope',
  'preset_12_2_mtr_triangle_structure_bllast_structures'
]);

/**
 * Detects the 2 Mtr Triangle Structure presets (North Slope, East-West Slope, Ballast / Bllast)
 * whose item quantities are decoupled from setCount (same behavior as Rails presets).
 */
export const isTriangleDirectPreset = (presetName = '', category = '', subPresetName = '', presetId = '') => {
  const pid = String(presetId || '').trim().toLowerCase();
  if (pid && TRIANGLE_DIRECT_PRESET_IDS.has(pid)) return true;
  const norm = `${presetName || ''} ${category || ''} ${subPresetName || ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!norm) return false;
  if (norm.includes('2 mtr triangle structure') || norm.includes('reverse tilt triangle')) return true;
  return norm.includes('triangle structure') && (
    norm.includes('north slope') ||
    norm.includes('east west') ||
    norm.includes('east-west') ||
    norm.includes('bllast') ||
    norm.includes('ballast')
  );
};

export const SALES_UOM_OPTIONS = [
  { value: 'MTR', label: 'MTR' },
  { value: 'NOS', label: 'NOS' },
  { value: 'KW', label: 'kW' },
  { value: 'SET', label: 'Set' }
];

/**
 * Returns true only for Sales login roles (excludes CEO/Admin/Procurement/Dispatch/Accounts/Production/Billing).
 */
export const isSalesLoginRole = (role = '') => {
  const rawRole = String(
    role || (typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('controlroom_user_role') : '') || ''
  ).trim().toLowerCase();
  if (!rawRole) return false;
  if ([
    'ceo', 'md', 'managing director', 'technical administrator',
    'dispatch', 'procurement', 'purchase', 'production',
    'accounts', 'billing', 'floor supervisor', 'hr', 'tech support'
  ].some(r => rawRole.includes(r))) {
    return false;
  }
  return rawRole === 'sales' || rawRole === 'salesperson' || rawRole.includes('sales');
};

/**
 * Normalizes unit strings onto the Sales UOM value codes (MTR, NOS, KW, SET).
 */
export const normalizeSalesUomValue = (rawUom = 'NOS') => {
  const u = String(rawUom || '').trim().toUpperCase();
  if (!u || ['NO', 'NOS', 'NUMBER', 'NUMBERS'].includes(u)) return 'NOS';
  if (['MTR', 'MTRS', 'METER', 'METERS', 'M'].includes(u)) return 'MTR';
  if (['KW', 'KWH'].includes(u)) return 'KW';
  if (['SET', 'SETS'].includes(u)) return 'SET';
  return u;
};

const CABLE_MTR_CODE_RE = /^(?:ACB|ACR|DCB|DCR|ECG)\d+$/i;
const CABLE_MTR_NAME_RE = /\b(?:ac|dc|earthing)[\s\-_/]+cables?\b/i;

/**
 * Returns true only for AC Cable, DC Cable, and Earthing Cable items (excludes CABLE TIE / CABLE TRAY).
 */
export const isMtrDefaultCable = (itemOrName) => {
  if (!itemOrName) return false;
  if (typeof itemOrName === 'string') {
    const trimmed = itemOrName.trim();
    return CABLE_MTR_CODE_RE.test(trimmed) || CABLE_MTR_NAME_RE.test(trimmed);
  }
  const code = String(itemOrName.code || itemOrName.sku || '').trim();
  if (code && CABLE_MTR_CODE_RE.test(code)) return true;
  const text = `${itemOrName.name || ''} ${itemOrName.itemName || ''} ${itemOrName.description || ''}`.trim();
  return Boolean(text && CABLE_MTR_NAME_RE.test(text));
};

/**
 * Resolves default UOM, enforcing MTR for AC/DC/Earthing cables unless a non-NOS unit was explicitly chosen.
 */
export const resolveDefaultUom = (itemOrName, currentUom = '', fallback = 'NOS') => {
  const rawUom = String(currentUom || '').trim();
  if (isMtrDefaultCable(itemOrName)) {
    const upper = rawUom.toUpperCase();
    if (!upper || ['NOS', 'NO', 'NUMBERS', 'NUMBER', 'MTR', 'MTRS', 'METER', 'METERS'].includes(upper)) {
      return 'MTR';
    }
    return rawUom;
  }
  return rawUom || fallback;
};

export default {
  VRM_PRODUCTS,
  wordFingerprint,
  resolveProductCode,
  isRailPreset,
  isKwPreset,
  isTriangleDirectPreset,
  SALES_UOM_OPTIONS,
  isSalesLoginRole,
  normalizeSalesUomValue,
  calculateTotalDispatchQty,
  resolveBomItemDispatchQty,
  isMtrDefaultCable,
  resolveDefaultUom
};


