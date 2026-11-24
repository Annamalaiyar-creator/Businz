// Pre-engineered HDG C-Section & SHS Structure Configurator Data & Engine
// Extracted with 100% mathematical parity from HDG_C_Section_SHS_Configurator_Generic_Output.xlsx

export const MASTER_STRUCTURE_OPTIONS = [
  {
    group: 'HDG / SHS Steel Structures (Ground & Elevated)',
    options: [
      { value: 'hdg_c_section', label: 'C Section — CS 100×50×15 (2.0mm HDG)' },
      { value: 'hdg_square_tube', label: 'Square Tube — SHS 60×60 (2.0mm Heavy Duty Tube)' }
    ]
  },
  {
    group: 'Aluminium Rooftop MMS Systems',
    options: [
      { value: 'alu_fam_ssr', label: 'Standing Seam Profile (80 mm Height • Grub Screws)' },
      { value: 'alu_fam_mr_125', label: 'Mini Rail Profile — 125 mm Height (Rivets + EPDM)' },
      { value: 'alu_fam_mr_100', label: 'Mini Rail Profile — 100 mm Height (Rivets + EPDM)' },
      { value: 'alu_fam_mr_75', label: 'Mini Rail Profile — 75 mm Height (Rivets + EPDM)' },
      { value: 'long_rail_bom', label: 'Long Rail — Double C Rail 45mm with L Bracket (1200–4800 mm)' }
    ]
  },
  {
    group: 'PM Surya Ghar: Muft Bijli Yojana (Turnkey BOS Kits)',
    options: [
      { value: 'pm_surya_ghar', label: '☀️ PM Surya Ghar — Complete Solar BOS Kit (Turnkey)' }
    ]
  }
];

export const C_SECTION_LEG_WEIGHTS = {
  150: 0.48,
  300: 0.961,
  350: 1.121,
  500: 1.601,
  650: 2.081,
  900: 2.882,
  1000: 3.202,
  1200: 3.842,
  1300: 4.162,
  1500: 4.803,
  1800: 5.763,
  2000: 7.827,
  2500: 9.783,
  3000: 11.74
};

export const SHS_LEG_WEIGHTS = {
  2100: 8.9652024,
  2500: 10.67286,
  3000: 12.807432
};

export const C_SECTION_LEG_PAIRS = [
  { label: '900 - 1500 mm (Standard)', leg1: 900, leg2: 1500 },
  { label: '1200 - 1800 mm', leg1: 1200, leg2: 1800 },
  { label: '2000 - 2500 mm (High Clearance)', leg1: 2000, leg2: 2500 },
  { label: '2500 - 3000 mm (Extra High)', leg1: 2500, leg2: 3000 }
];

export const SHS_LEG_PAIRS = [
  { label: '2100 - 2500 mm (Standard SHS)', leg1: 2100, leg2: 2500 },
  { label: '2500 - 3000 mm (High SHS)', leg1: 2500, leg2: 3000 }
];

export const DEFAULT_RAW_MATERIAL_RATES = {
  hdgRate: 135,
  galvalRate: 120,
  allenM8: 13,
  hexM12: 18,
  hexM10: 16,
  anchorM10: 20
};

import { CONFIG_PARTS_BY_KEY } from './hdg/hdgPartsConfig.js';
import { ACCESSORIES_BY_KEY } from './hdg/hdgAccessoriesConfig.js';

export { CONFIG_PARTS_BY_KEY, ACCESSORIES_BY_KEY };

export function calculateHdgStructure({
  columnProfile = 'C Section',
  rowModel = '2 Row',
  tableSize = 3,
  leg1Height = 900,
  leg2Height = 1500,
  hasBracing = false,
  hasCrossBracing = false,
  hdgRate = 135,
  galvalRate = 120,
  fastenerRates = {},
  setCount = 1
}) {
  const key = rowModel + '|' + tableSize;
  const rawParts = CONFIG_PARTS_BY_KEY[key] || [];
  const rawAccessories = ACCESSORIES_BY_KEY[key] || [];

  const rates = {
    hdg: parseFloat(hdgRate) || 135,
    galval: parseFloat(galvalRate) || 120,
    allenM8: parseFloat(fastenerRates.allenM8) || 13,
    hexM12: parseFloat(fastenerRates.hexM12) || 18,
    hexM10: parseFloat(fastenerRates.hexM10) || 16,
    anchorM10: parseFloat(fastenerRates.anchorM10) || 20
  };

  const leg1 = parseInt(leg1Height) || (columnProfile === 'Square Tube' ? 2100 : 900);
  const leg2 = parseInt(leg2Height) || (columnProfile === 'Square Tube' ? 2500 : 1500);

  const activeParts = [];

  let leg1Qty = 0;
  let leg2Qty = 0;
  let leg3Qty = 0;

  let cleat1Qty = 0;
  let cleat2Qty = 0;
  let bracingQty = 0;
  let crossQty = 0;
  let rafterCleat1Qty = 0;
  let rafterCleat2Qty = 0;

  rawParts.forEach(item => {
    const rawName = (item.name || '').trim();

    if (rawName === 'Leg-1') {
      leg1Qty = item.qty || 0;
      const sec = columnProfile === 'Square Tube' ? 'SHS - 60*60' : 'CS - 100*50*15';
      const uw = columnProfile === 'Square Tube'
        ? (SHS_LEG_WEIGHTS[leg1] || 8.9652024)
        : (C_SECTION_LEG_WEIGHTS[leg1] || 2.882);
      activeParts.push({
        name: 'Leg-1',
        length: leg1,
        section: sec,
        thickness: 2,
        material: 'HDG',
        qty: leg1Qty,
        unitWeight: uw,
        totalWeight: leg1Qty * uw
      });
    } else if (rawName === 'Leg-2') {
      leg2Qty = item.qty || 0;
      const sec = columnProfile === 'Square Tube' ? 'SHS - 60*60' : 'CS - 100*50*15';
      const uw = columnProfile === 'Square Tube'
        ? (SHS_LEG_WEIGHTS[leg2] || 10.67286)
        : (C_SECTION_LEG_WEIGHTS[leg2] || 4.803);
      activeParts.push({
        name: 'Leg-2',
        length: leg2,
        section: sec,
        thickness: 2,
        material: 'HDG',
        qty: leg2Qty,
        unitWeight: uw,
        totalWeight: leg2Qty * uw
      });
    } else if (rawName === 'Leg-3') {
      leg3Qty = item.qty || 0;
      const sec = columnProfile === 'Square Tube' ? 'SHS - 60*60' : 'CS - 100*50*15';
      const uw = columnProfile === 'Square Tube' ? 12.807432 : 11.740146;
      activeParts.push({
        name: 'Leg-3',
        length: 3000,
        section: sec,
        thickness: 2,
        material: 'HDG',
        qty: leg3Qty,
        unitWeight: uw,
        totalWeight: leg3Qty * uw
      });
    } else if (rawName === 'Rafter') {
      const q = item.qty || 0;
      const uw = item.unitWeight || 0;
      activeParts.push({
        name: 'Rafter',
        length: item.length,
        section: item.section,
        thickness: item.thickness,
        material: item.material,
        qty: q,
        unitWeight: uw,
        totalWeight: q * uw
      });
    } else if (rawName === 'Purlin') {
      const q = item.qty || 0;
      const uw = item.unitWeight || 0;
      activeParts.push({
        name: 'Purlin',
        length: item.length,
        section: item.section,
        thickness: item.thickness,
        material: item.material,
        qty: q,
        unitWeight: uw,
        totalWeight: q * uw
      });
    } else if (rawName === 'Purlin cleat 1') {
      const q = item.qty || 0;
      cleat1Qty += q;
      const uw = item.unitWeight || 0;
      activeParts.push({
        name: 'Purlin cleat 1',
        length: item.length,
        section: item.section,
        thickness: item.thickness,
        material: item.material,
        qty: q,
        unitWeight: uw,
        totalWeight: q * uw
      });
    } else if (rawName === 'Purlin cleat 2') {
      const q = item.qty || 0;
      cleat2Qty += q;
      const uw = item.unitWeight || 0;
      activeParts.push({
        name: 'Purlin cleat 2',
        length: item.length,
        section: item.section,
        thickness: item.thickness,
        material: item.material,
        qty: q,
        unitWeight: uw,
        totalWeight: q * uw
      });
    } else if (rawName === 'Bracing Plate') {
      if (hasBracing) {
        const q = item.qty || 0;
        const uw = item.unitWeight || 0;
        activeParts.push({
          name: 'Bracing Plate',
          length: item.length,
          section: item.section,
          thickness: item.thickness,
          material: item.material,
          qty: q,
          unitWeight: uw,
          totalWeight: q * uw
        });
      }
    } else if (rawName === 'Bracing') {
      const q = item.qty || 0;
      bracingQty += q;
      if (hasBracing) {
        const uw = item.unitWeight || 0;
        activeParts.push({
          name: 'Bracing',
          length: item.length,
          section: item.section,
          thickness: item.thickness,
          material: item.material,
          qty: q,
          unitWeight: uw,
          totalWeight: q * uw
        });
      }
    } else if (rawName === 'Cross Bracing') {
      const q = item.qty || 0;
      crossQty += q;
      if (hasCrossBracing) {
        const uw = item.unitWeight || 0;
        activeParts.push({
          name: 'Cross Bracing',
          length: item.length,
          section: item.section,
          thickness: item.thickness,
          material: item.material,
          qty: q,
          unitWeight: uw,
          totalWeight: q * uw
        });
      }
    } else if (rawName.toLowerCase() === 'rafter cleat 1') {
      const q = item.qty || 0;
      rafterCleat1Qty += q;
      const uw = item.unitWeight || 0;
      activeParts.push({
        name: 'Rafter cleat 1',
        length: item.length,
        section: item.section,
        thickness: item.thickness,
        material: item.material,
        qty: q,
        unitWeight: uw,
        totalWeight: q * uw
      });
    } else if (rawName.toLowerCase() === 'rafter cleat 2') {
      const q = item.qty || 0;
      rafterCleat2Qty += q;
      const uw = item.unitWeight || 0;
      activeParts.push({
        name: 'Rafter cleat 2',
        length: item.length,
        section: item.section,
        thickness: item.thickness,
        material: item.material,
        qty: q,
        unitWeight: uw,
        totalWeight: q * uw
      });
    }
  });

  // Base plates & Column supports
  const totalLegs = leg1Qty + leg2Qty + leg3Qty;
  if (columnProfile === 'Square Tube') {
    activeParts.push({
      name: 'Column support',
      length: 60,
      section: 'LS - 60*60',
      thickness: 3,
      material: 'HDG',
      qty: totalLegs,
      unitWeight: 0.27215793,
      totalWeight: totalLegs * 0.27215793
    });
    activeParts.push({
      name: 'Base plate',
      length: 200,
      section: 'P - 200*200*5',
      thickness: 5,
      material: 'HDG',
      qty: totalLegs,
      unitWeight: 1.6898695,
      totalWeight: totalLegs * 1.6898695
    });
  } else {
    // C Section
    let under2000Legs = 0;
    let over2000Legs = 0;
    if (leg1 < 2000) under2000Legs += leg1Qty;
    else over2000Legs += leg1Qty;

    if (leg2 < 2000) under2000Legs += leg2Qty;
    else over2000Legs += leg2Qty;

    if (leg3Qty > 0) {
      over2000Legs += leg3Qty; // Leg-3 is 3000mm
    }

    if (under2000Legs > 0) {
      activeParts.push({
        name: 'Base plate',
        length: 150,
        section: 'P - 150*150*5',
        thickness: 5,
        material: 'HDG',
        qty: under2000Legs,
        unitWeight: 0.934,
        totalWeight: under2000Legs * 0.934
      });
    }
    if (over2000Legs > 0) {
      activeParts.push({
        name: 'Base plate',
        length: 200,
        section: 'P - 200*200*5',
        thickness: 5,
        material: 'HDG',
        qty: over2000Legs,
        unitWeight: 1.6898695,
        totalWeight: over2000Legs * 1.6898695
      });
    }
  }

  // Calculate individual structural part costs with 3% wastage
  activeParts.forEach(p => {
    const isHdg = p.material === 'HDG';
    const ratePerKg = isHdg ? rates.hdg : rates.galval;
    p.cost = (p.totalWeight * 1.03 * ratePerKg);
  });

  // Fasteners / Accessories
  const activeAccessories = rawAccessories.map(acc => {
    const itNum = acc.item;
    let q = acc.qty;
    let up = rates.hexM10;

    if (itNum === 1) up = rates.allenM8;
    else if (itNum === 2) up = rates.hexM12;
    else if (itNum === 4) up = rates.anchorM10;

    if (itNum === 3) {
      const baseM10 = (cleat1Qty * 2) + (cleat2Qty * 4) + (crossQty * 2) + (bracingQty * 4) + (rafterCleat1Qty * 6) + (rafterCleat2Qty * 6);
      let adjusted = baseM10;
      if (!hasBracing) adjusted -= (bracingQty * 4);
      if (!hasCrossBracing) adjusted -= (crossQty * 2);
      q = Math.max(0, adjusted);
      up = rates.hexM10;
    }

    return {
      item: itNum,
      supply: acc.supply,
      purpose: acc.purpose,
      size: acc.size,
      material: acc.material,
      qty: q,
      unitPrice: up,
      cost: q * up
    };
  });

  // Weights
  const hdgWeight = activeParts
    .filter(p => p.material === 'HDG')
    .reduce((sum, p) => sum + p.totalWeight, 0);

  const galvalWeight = activeParts
    .filter(p => (p.material || '').includes('GALVAL'))
    .reduce((sum, p) => sum + p.totalWeight, 0);

  const totalWeight = hdgWeight + galvalWeight;

  // Costs
  const structureCost = (hdgWeight * 1.03 * rates.hdg) + (galvalWeight * 1.03 * rates.galval);
  const accessoryCost = activeAccessories.reduce((sum, a) => sum + a.cost, 0);
  const totalCost = structureCost + accessoryCost;
  const quotedPrice = Math.ceil(totalCost / 100) * 100;

  const mult = Math.max(1, parseInt(setCount) || 1);
  const totalQuotedPrice = quotedPrice * mult;

  const tableTitle = rowModel.charAt(0) + '×' + tableSize + ' Table (' + rowModel + ' × ' + tableSize + ' Panel)';

  return {
    key,
    tableTitle,
    columnProfile,
    rowModel,
    tableSize,
    leg1Height: leg1,
    leg2Height: leg2,
    hasBracing,
    hasCrossBracing,
    setCount: mult,
    rates,
    hdgWeight,
    galvalWeight,
    totalWeight,
    structureCost,
    accessoryCost,
    totalCost,
    quotedPrice,
    totalQuotedPrice,
    parts: activeParts,
    accessories: activeAccessories,
    commercialTerms: [
      { term: 'TAX', value: 'Extra (GST 18% as applicable)' },
      { term: 'Transport', value: 'Extra (Freight to-pay / actuals)' },
      { term: 'Payment', value: '100% advance along with the purchase order' },
      { term: 'Delivery', value: 'Immediate Dispatch / 3-5 days' },
      { term: 'Validity', value: '3 days from quotation date' }
    ]
  };
}
