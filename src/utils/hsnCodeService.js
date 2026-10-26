/**
 * BUSINZ Central HSN / SAC Code Service
 * Synchronized with authoritative "hsn_code_Filled" master dataset.
 * Supports exact matching, case-insensitive normalization, code mapping,
 * and category-based tariff resolution.
 */
import VRM_HSN_CODES_DATA from '../data/vrmHsnCodes.js';

export const VRM_HSN_CODES = VRM_HSN_CODES_DATA;

// Precompute fast normalized lookup maps
const NORM_MAP = new Map();
const CLEAN_MAP = new Map();

Object.entries(VRM_HSN_CODES).forEach(([name, hsn]) => {
  if (!name || !hsn) return;
  const raw = String(name).trim();
  const lower = raw.toLowerCase();
  const clean = lower.replace(/[^a-z0-9]/g, '');
  NORM_MAP.set(lower, hsn);
  CLEAN_MAP.set(clean, hsn);
});

// Specific known aliases & variant mappings
const VARIANT_MAP = {
  'mr-300mm': '76109090',
  'mini rail - 300 mm': '76109090',
  'mini rail 300mm': '76109090',
  'mini rail - 300mm': '76109090',
  'mini rail (new)': '76109090',
  'mini rail (old)': '76109090',
  'epdm 100*25': '40169990',
  'epdm 80*25': '40169990',
  'epdm 150*25': '40169990',
  'triangle mid section': '76109090',
  'mini rail 75mm new': '76109090',
  'mini rail 100mm new': '76109090',
  'mini rail 120mm new': '76109090',
  'double c rail': '76109090',
  'adhesive rail': '76109090',
  'strut rail': '76109090',
  'mid clamp': '76169990',
  'end clamp': '76169990',
  'l bracket': '76169990'
};

Object.entries(VARIANT_MAP).forEach(([k, v]) => {
  NORM_MAP.set(k.toLowerCase().trim(), v);
  CLEAN_MAP.set(k.toLowerCase().replace(/[^a-z0-9]/g, ''), v);
});

/**
 * Resolves the accurate HSN code for any product or line item.
 * Never returns a single hardcoded code for all items.
 *
 * @param {string|object} itemOrName Product object or name string
 * @returns {string} Accurate HSN code
 */
export function getHsnCode(itemOrName) {
  if (!itemOrName) return '76109090';

  let name = '';
  let code = '';
  let material = '';
  let category = '';
  let existingHsn = '';

  if (typeof itemOrName === 'string') {
    name = itemOrName.trim();
  } else if (typeof itemOrName === 'object') {
    name = String(itemOrName.name || itemOrName.itemName || itemOrName.productName || itemOrName.title || '').trim();
    code = String(itemOrName.code || itemOrName.productCode || itemOrName.sku || itemOrName.itemCode || '').trim();
    material = String(itemOrName.material || '').trim();
    category = String(itemOrName.category || itemOrName.cat || '').trim();
    existingHsn = String(itemOrName.hsn || itemOrName.hsn_or_sac || itemOrName.hsnCode || '').trim();
  }

  // 1. Direct exact match in master dataset
  if (name && VRM_HSN_CODES[name]) {
    return VRM_HSN_CODES[name];
  }

  // 2. Normalized lowercase lookup
  const lowerName = name.toLowerCase();
  if (NORM_MAP.has(lowerName)) {
    return NORM_MAP.get(lowerName);
  }

  // 3. Normalized alphanumeric lookup
  const cleanName = lowerName.replace(/[^a-z0-9]/g, '');
  if (CLEAN_MAP.has(cleanName)) {
    return CLEAN_MAP.get(cleanName);
  }

  // 4. Code lookup
  if (code) {
    const lowerCode = code.toLowerCase();
    if (NORM_MAP.has(lowerCode)) return NORM_MAP.get(lowerCode);
    const cleanCode = lowerCode.replace(/[^a-z0-9]/g, '');
    if (CLEAN_MAP.has(cleanCode)) return CLEAN_MAP.get(cleanCode);
  }

  // 5. Intelligent category and keyword tariff classification
  const combined = `${name} ${code} ${category} ${material}`.toLowerCase();

  // Inverters
  if (combined.includes('inverter') || combined.includes('deye') || combined.includes('hybrid') || combined.includes('ongrid')) {
    return '85044090';
  }

  // Solar Modules & Panels
  if (combined.includes('module') || combined.includes('solar panel') || combined.includes('bifacial') || combined.includes('dcr') || combined.includes('wp')) {
    return '85414300';
  }

  // Cables
  if (combined.includes('cable') || combined.includes('sqmm')) {
    return '85444999';
  }

  // Distribution Boxes
  if (combined.includes('acdb') || combined.includes('dcdb')) {
    return '85371000';
  }

  // EPDM Gaskets & Rubber
  if (combined.includes('epdm') || combined.includes('rubber')) {
    return '40169990';
  }

  // Walkways & Cable Trays & Handrails
  if (combined.includes('walkway') || combined.includes('cable tray') || combined.includes('hand rail') || combined.includes('handrail')) {
    return '39259090';
  }

  // Fasteners: Spring Washers
  if (combined.includes('spring washer')) {
    return '73182100';
  }

  // Fasteners: Plain / Plate Washers
  if (combined.includes('washer')) {
    return '73182200';
  }

  // Fasteners: Nuts
  if (combined.includes('hex nut') || combined.includes('square nut') || combined.includes('hexa nut')) {
    return '73181600';
  }

  // Aluminium T-Nuts & Rivets
  if (combined.includes('t nut') || combined.includes('t-nut') || combined.includes('rivet')) {
    return '76161000';
  }

  // Self Tapping Screws
  if (combined.includes('self tapping') || combined.includes('tapping screw')) {
    return '73181400';
  }

  // Fasteners: Bolts (Allen, Hex, Anchor)
  if (combined.includes('bolt') || combined.includes('anchor') || combined.includes('fastener')) {
    return '73181500';
  }

  // Lightning Protection
  if (combined.includes('lightning') || combined.includes('arrester') || combined.includes('ese')) {
    return '85354010';
  }

  // Connectors & Lugs
  if (combined.includes('mc4') || combined.includes('connector')) {
    return '85366990';
  }
  if (combined.includes('lug') || combined.includes('lugs')) {
    return '85369090';
  }

  // Adhesives
  if (combined.includes('adhesive') || combined.includes('glue') || combined.includes('chemical bag')) {
    return combined.includes('chemical bag') ? '38249900' : '35069190';
  }

  // Clamps & Brackets (Aluminium)
  if (combined.includes('clamp') || combined.includes('bracket') || combined.includes('joinner') || combined.includes('joiner')) {
    if (material === 'HDG' || combined.includes('hdg') || combined.includes('c clamp')) {
      return '73269099';
    }
    return '76169990';
  }

  // Aluminium Profiles, Mini Rails, Extrusions
  if (combined.includes('rail') || combined.includes('mini rail') || combined.includes('triangle') || material === 'Aluminium' || combined.includes('aluminium')) {
    return '76109090';
  }

  // HDG Ground & Rooftop Steel Structures
  if (material === 'HDG' || combined.includes('hdg') || combined.includes('base plate') || combined.includes('bracing') || combined.includes('rafter') || combined.includes('purlin') || combined.includes('column') || combined.includes('leg')) {
    return '73089090';
  }

  // 6. If existing HSN is valid and non-generic, preserve it
  if (existingHsn && existingHsn.length >= 4) {
    return existingHsn;
  }

  // Default fallback for aluminium structural mounting component
  return '76109090';
}
