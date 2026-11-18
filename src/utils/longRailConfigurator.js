/**
 * Long Rail (Double C Rail 45mm with L Bracket) Configurator Engine
 * Implements mathematical parity with Long Rail Price Calculation.xlsx
 */

export const LONG_RAIL_LENGTHS = [4800, 3600, 2400, 1800, 1200];

export const DEFAULT_LONG_RAIL_PARAMS = {
  panelWidth: 1134,
  clearance: 44,
  pnlToPnl: 26,
  noOfRails: 2,
  panelWp: 625,
  railCostPerMtr: 360,
  rates: {
    lAngle: 45,
    hexaBoltLAngle: 15,
    endClamp: 18,
    midClamp: 24,
    allenBolt: 9.5,
    tNut: 15,
    epdmWasher: 3,
    selfTappingScrew: 6,
    joinerPlate: 15,
    hexaBoltJoiner: 15
  }
};

export const DEFAULT_LONG_RAIL_ROWS = [
  { id: 'r1', panels: 10, rows: 3, pieces: { 1200: 0, 1800: 0, 2400: 1, 3600: 0, 4800: 2 } },
  { id: 'r2', panels: 5, rows: 2, pieces: { 1200: 0, 1800: 0, 2400: 1, 3600: 1, 4800: 0 } },
  { id: 'r3', panels: 6, rows: 4, pieces: { 1200: 0, 1800: 0, 2400: 0, 3600: 2, 4800: 0 } },
  { id: 'r4', panels: 21, rows: 5, pieces: { 1200: 0, 1800: 1, 2400: 2, 3600: 1, 4800: 3 } },
  { id: 'r5', panels: 12, rows: 7, pieces: { 1200: 0, 1800: 0, 2400: 0, 3600: 0, 4800: 3 } }
];

/**
 * Find an optimal combination of [4800, 3600, 2400, 1800, 1200] mm rails
 * that covers targetLengthMm with minimum extra waste and minimum joiners.
 */
export function autoFitRailPieces(targetLengthMm) {
  const target = Math.max(0, Number(targetLengthMm) || 0);
  if (target <= 0) return { 1200: 0, 1800: 0, 2400: 0, 3600: 0, 4800: 0 };

  let best = null;
  let bestWaste = Infinity;
  let bestCount = Infinity;

  const max4800 = Math.ceil(target / 4800) + 1;
  for (let c48 = 0; c48 <= max4800; c48++) {
    const rem48 = target - c48 * 4800;
    if (rem48 <= 0) {
      const waste = -rem48;
      if (waste < bestWaste || (waste === bestWaste && c48 < bestCount)) {
        bestWaste = waste;
        bestCount = c48;
        best = { 1200: 0, 1800: 0, 2400: 0, 3600: 0, 4800: c48 };
      }
      break;
    }
    const max36 = Math.ceil(rem48 / 3600) + 1;
    for (let c36 = 0; c36 <= max36; c36++) {
      const rem36 = rem48 - c36 * 3600;
      if (rem36 <= 0) {
        const waste = -rem36;
        const cnt = c48 + c36;
        if (waste < bestWaste || (waste === bestWaste && cnt < bestCount)) {
          bestWaste = waste;
          bestCount = cnt;
          best = { 1200: 0, 1800: 0, 2400: 0, 3600: c36, 4800: c48 };
        }
        break;
      }
      const max24 = Math.ceil(rem36 / 2400) + 1;
      for (let c24 = 0; c24 <= max24; c24++) {
        const rem24 = rem36 - c24 * 2400;
        if (rem24 <= 0) {
          const waste = -rem24;
          const cnt = c48 + c36 + c24;
          if (waste < bestWaste || (waste === bestWaste && cnt < bestCount)) {
            bestWaste = waste;
            bestCount = cnt;
            best = { 1200: 0, 1800: 0, 2400: c24, 3600: c36, 4800: c48 };
          }
          break;
        }
        const max18 = Math.ceil(rem24 / 1800) + 1;
        for (let c18 = 0; c18 <= max18; c18++) {
          const rem18 = rem24 - c18 * 1800;
          const c12 = rem18 > 0 ? Math.ceil(rem18 / 1200) : 0;
          const totalLen = c48 * 4800 + c36 * 3600 + c24 * 2400 + c18 * 1800 + c12 * 1200;
          const waste = totalLen - target;
          const cnt = c48 + c36 + c24 + c18 + c12;
          if (waste >= 0 && (waste < bestWaste || (waste === bestWaste && cnt < bestCount))) {
            bestWaste = waste;
            bestCount = cnt;
            best = { 1200: c12, 1800: c18, 2400: c24, 3600: c36, 4800: c48 };
          }
        }
      }
    }
  }

  return best || { 1200: 0, 1800: 0, 2400: 0, 3600: 0, 4800: 0 };
}

/**
 * Resolve available inventory stock (in pieces) for each standard rail length [4800, 3600, 2400, 1800, 1200] mm.
 */
export function getLongRailStockMap(inventoryItems = []) {
  const stockMap = { 1200: 0, 1800: 0, 2400: 0, 3600: 0, 4800: 0 };
  if (!Array.isArray(inventoryItems)) return stockMap;

  const lengthMatchers = [
    { len: 4800, codes: ['CC4.8N', 'CC4.8O', 'LR-4800'], tokens: ['4.8', '4800'] },
    { len: 3600, codes: ['CC3.6', 'LR-3600'], tokens: ['3.6', '3600'] },
    { len: 2400, codes: ['CC2.4', 'LR-2400'], tokens: ['2.4', '2400'] },
    { len: 1800, codes: ['CC1.8', 'LR-1800'], tokens: ['1.8', '1800'] },
    { len: 1200, codes: ['CC1.2', 'LR-1200'], tokens: ['1.2', '1200'] }
  ];

  for (const item of inventoryItems) {
    if (!item) continue;
    const code = String(item.code || item.sku || '').toUpperCase().trim();
    const name = String(item.name || '').toLowerCase();
    const isRailItem =
      code.startsWith('CC') ||
      code.startsWith('LR-') ||
      name.includes('double c rail') ||
      name.includes('long rail');
    if (!isRailItem) continue;

    const qty = Math.max(0, Math.floor(Number(item.available ?? item.onHand ?? item.stock ?? 0) || 0));
    for (const m of lengthMatchers) {
      const codeHit = m.codes.includes(code);
      const nameHit = (name.includes('double c rail') || name.includes('long rail')) && m.tokens.some(t => name.includes(t));
      if (codeHit || nameHit) {
        stockMap[m.len] += qty;
        break;
      }
    }
  }

  return stockMap;
}

/**
 * Find an optimal combination of [4800, 3600, 2400, 1800, 1200] mm rails
 * constrained by available stock per slot. Falls back to unconstrained autoFitRailPieces
 * with stockShortage=true if current stock cannot cover targetLengthMm.
 */
export function autoFitRailPiecesWithStock(targetLengthMm, availablePerSlotMap = {}) {
  const target = Math.max(0, Number(targetLengthMm) || 0);
  if (target <= 0) {
    return { pieces: { 1200: 0, 1800: 0, 2400: 0, 3600: 0, 4800: 0 }, stockShortage: false };
  }

  const cap48 = Math.max(0, Math.floor(Number(availablePerSlotMap[4800]) || 0));
  const cap36 = Math.max(0, Math.floor(Number(availablePerSlotMap[3600]) || 0));
  const cap24 = Math.max(0, Math.floor(Number(availablePerSlotMap[2400]) || 0));
  const cap18 = Math.max(0, Math.floor(Number(availablePerSlotMap[1800]) || 0));
  const cap12 = Math.max(0, Math.floor(Number(availablePerSlotMap[1200]) || 0));

  let best = null;
  let bestWaste = Infinity;
  let bestCount = Infinity;

  const max48 = Math.min(cap48, Math.ceil(target / 4800) + 1);
  for (let c48 = 0; c48 <= max48; c48++) {
    const rem48 = target - c48 * 4800;
    if (rem48 <= 0) {
      const waste = -rem48;
      if (waste < bestWaste || (waste === bestWaste && c48 < bestCount)) {
        bestWaste = waste;
        bestCount = c48;
        best = { 1200: 0, 1800: 0, 2400: 0, 3600: 0, 4800: c48 };
      }
      break;
    }
    const max36 = Math.min(cap36, Math.ceil(rem48 / 3600) + 1);
    for (let c36 = 0; c36 <= max36; c36++) {
      const rem36 = rem48 - c36 * 3600;
      if (rem36 <= 0) {
        const waste = -rem36;
        const cnt = c48 + c36;
        if (waste < bestWaste || (waste === bestWaste && cnt < bestCount)) {
          bestWaste = waste;
          bestCount = cnt;
          best = { 1200: 0, 1800: 0, 2400: 0, 3600: c36, 4800: c48 };
        }
        break;
      }
      const max24 = Math.min(cap24, Math.ceil(rem36 / 2400) + 1);
      for (let c24 = 0; c24 <= max24; c24++) {
        const rem24 = rem36 - c24 * 2400;
        if (rem24 <= 0) {
          const waste = -rem24;
          const cnt = c48 + c36 + c24;
          if (waste < bestWaste || (waste === bestWaste && cnt < bestCount)) {
            bestWaste = waste;
            bestCount = cnt;
            best = { 1200: 0, 1800: 0, 2400: c24, 3600: c36, 4800: c48 };
          }
          break;
        }
        const max18 = Math.min(cap18, Math.ceil(rem24 / 1800) + 1);
        for (let c18 = 0; c18 <= max18; c18++) {
          const rem18 = rem24 - c18 * 1800;
          const c12 = rem18 > 0 ? Math.ceil(rem18 / 1200) : 0;
          if (c12 > cap12) continue;
          const totalLen = c48 * 4800 + c36 * 3600 + c24 * 2400 + c18 * 1800 + c12 * 1200;
          const waste = totalLen - target;
          const cnt = c48 + c36 + c24 + c18 + c12;
          if (waste >= 0 && (waste < bestWaste || (waste === bestWaste && cnt < bestCount))) {
            bestWaste = waste;
            bestCount = cnt;
            best = { 1200: c12, 1800: c18, 2400: c24, 3600: c36, 4800: c48 };
          }
        }
      }
    }
  }

  if (best) {
    return { pieces: best, stockShortage: false };
  }
  return { pieces: autoFitRailPieces(target), stockShortage: true };
}

export function calculateLongRailStructure(params = {}, rows = [], stockMap = null) {
  const panelWidth = Math.max(1, Number(params.panelWidth) || DEFAULT_LONG_RAIL_PARAMS.panelWidth);
  const clearance = Math.max(0, Number(params.clearance ?? DEFAULT_LONG_RAIL_PARAMS.clearance));
  const pnlToPnl = Math.max(0, Number(params.pnlToPnl ?? DEFAULT_LONG_RAIL_PARAMS.pnlToPnl));
  const noOfRails = Math.max(1, Number(params.noOfRails) || DEFAULT_LONG_RAIL_PARAMS.noOfRails);
  const panelWp = Math.max(1, Number(params.panelWp) || DEFAULT_LONG_RAIL_PARAMS.panelWp);
  const railCostPerMtr = Math.max(0, Number(params.railCostPerMtr ?? DEFAULT_LONG_RAIL_PARAMS.railCostPerMtr));
  const rates = { ...DEFAULT_LONG_RAIL_PARAMS.rates, ...(params.rates || {}) };

  const railTotals = { 1200: 0, 1800: 0, 2400: 0, 3600: 0, 4800: 0 };
  let totalPanels = 0;
  let totalRows = 0;
  let midClampsQty = 0;
  let joinerPlatesQty = 0;

  const remainingStock = stockMap ? {
    1200: Math.max(0, Number(stockMap[1200]) || 0),
    1800: Math.max(0, Number(stockMap[1800]) || 0),
    2400: Math.max(0, Number(stockMap[2400]) || 0),
    3600: Math.max(0, Number(stockMap[3600]) || 0),
    4800: Math.max(0, Number(stockMap[4800]) || 0)
  } : null;
  let hasStockShortage = false;

  const computedRows = (rows || []).map((row) => {
    const panels = Math.max(0, Number(row.panels) || 0);
    const rowCount = Math.max(0, Number(row.rows) || 0);
    const requiredLength = panels > 0 ? (panels * panelWidth) + ((panels + 1) * pnlToPnl) + (clearance * 2) : 0;

    let pieces;
    let stockShortage = false;
    if (remainingStock && panels > 0 && rowCount > 0) {
      const multiplier = rowCount * noOfRails;
      const perSlotAvail = {
        1200: Math.floor(remainingStock[1200] / multiplier),
        1800: Math.floor(remainingStock[1800] / multiplier),
        2400: Math.floor(remainingStock[2400] / multiplier),
        3600: Math.floor(remainingStock[3600] / multiplier),
        4800: Math.floor(remainingStock[4800] / multiplier)
      };
      const fitted = autoFitRailPiecesWithStock(requiredLength, perSlotAvail);
      pieces = fitted.pieces;
      stockShortage = fitted.stockShortage;
      if (stockShortage) hasStockShortage = true;
      for (const len of LONG_RAIL_LENGTHS) {
        remainingStock[len] = Math.max(0, remainingStock[len] - (pieces[len] * multiplier));
      }
    } else if (remainingStock) {
      pieces = { 1200: 0, 1800: 0, 2400: 0, 3600: 0, 4800: 0 };
    } else {
      pieces = {
        1200: Math.max(0, Number(row.pieces?.[1200]) || 0),
        1800: Math.max(0, Number(row.pieces?.[1800]) || 0),
        2400: Math.max(0, Number(row.pieces?.[2400]) || 0),
        3600: Math.max(0, Number(row.pieces?.[3600]) || 0),
        4800: Math.max(0, Number(row.pieces?.[4800]) || 0)
      };
    }

    const proposedLength =
      (pieces[4800] * 4800) +
      (pieces[3600] * 3600) +
      (pieces[2400] * 2400) +
      (pieces[1800] * 1800) +
      (pieces[1200] * 1200);
    const extraLength = proposedLength - requiredLength;

    const rowRailQty = {
      1200: pieces[1200] * rowCount * noOfRails,
      1800: pieces[1800] * rowCount * noOfRails,
      2400: pieces[2400] * rowCount * noOfRails,
      3600: pieces[3600] * rowCount * noOfRails,
      4800: pieces[4800] * rowCount * noOfRails
    };

    for (const len of LONG_RAIL_LENGTHS) {
      railTotals[len] += rowRailQty[len];
    }

    totalPanels += panels * rowCount;
    totalRows += rowCount;

    if (panels > 0 && rowCount > 0) {
      midClampsQty += ((panels * rowCount) - rowCount) * 2;
    }

    const totalPiecesInRow = pieces[1200] + pieces[1800] + pieces[2400] + pieces[3600] + pieces[4800];
    if (totalPiecesInRow > 1 && rowCount > 0) {
      joinerPlatesQty += totalPiecesInRow * rowCount;
    }

    return {
      ...row,
      panels,
      rows: rowCount,
      pieces,
      requiredLength,
      proposedLength,
      extraLength,
      rowRailQty,
      stockShortage
    };
  });

  const totalMeters = LONG_RAIL_LENGTHS.reduce((sum, len) => sum + ((len / 1000) * railTotals[len]), 0);
  const totalWatts = totalPanels * panelWp;
  const totalKw = totalWatts / 1000;

  const lAngleQty =
    (railTotals[4800] * 4) +
    (railTotals[3600] * 3) +
    (railTotals[2400] * 2) +
    (railTotals[1800] * 2) +
    (railTotals[1200] * 2);
  const endClampsQty = noOfRails === 2 ? totalRows * 4 : totalRows * 6;
  const clampHardwareQty = endClampsQty + midClampsQty;
  const joinerBoltQty = joinerPlatesQty * 2;

  const railUnitPrice = (lenMm) => Number(((lenMm / 1000) * (railCostPerMtr + 2)).toFixed(2));

  const rawItems = [
    {
      code: 'LR-4800',
      name: 'Aluminum MMS - Long Rail 45 mm Height, 4800 mm length',
      category: 'Long Rail',
      hsn: '76109010',
      qty: railTotals[4800],
      unitPrice: railUnitPrice(4800)
    },
    {
      code: 'LR-3600',
      name: 'Aluminum MMS - Long Rail 45mm Height, 3600 mm length',
      category: 'Long Rail',
      hsn: '76109010',
      qty: railTotals[3600],
      unitPrice: railUnitPrice(3600)
    },
    {
      code: 'LR-2400',
      name: 'Aluminum MMS - Long Rail 45mm Height, 2400 mm length',
      category: 'Long Rail',
      hsn: '76109010',
      qty: railTotals[2400],
      unitPrice: railUnitPrice(2400)
    },
    {
      code: 'LR-1800',
      name: 'Aluminum MMS - Long Rail 45mm Height, 1800 mm length',
      category: 'Long Rail',
      hsn: '76109010',
      qty: railTotals[1800],
      unitPrice: railUnitPrice(1800)
    },
    {
      code: 'LR-1200',
      name: 'Aluminum MMS - Long Rail 45mm Height, 1200 mm length',
      category: 'Long Rail',
      hsn: '76109010',
      qty: railTotals[1200],
      unitPrice: railUnitPrice(1200)
    },
    {
      code: 'LR-LANGLE',
      name: 'Aluminum L Angle - 40*85 mm length',
      category: 'Mounting Bracket',
      hsn: '76109010',
      qty: lAngleQty,
      unitPrice: Number(rates.lAngle) || 0
    },
    {
      code: 'LR-HEX-LA',
      name: 'Hexa Bolt SS 304 with spring washer and Nut M8*30 - Full set (L Angle)',
      category: 'SS304 Hardware',
      hsn: '73181500',
      qty: lAngleQty,
      unitPrice: Number(rates.hexaBoltLAngle) || 0
    },
    {
      code: 'LR-END-Z',
      name: 'End Clamps - Z Clamp 35 mm',
      category: 'Clamps',
      hsn: '76109010',
      qty: endClampsQty,
      unitPrice: Number(rates.endClamp) || 0
    },
    {
      code: 'LR-MID-U',
      name: 'Mid Clamps - U Clamp 35 mm',
      category: 'Clamps',
      hsn: '76109010',
      qty: midClampsQty,
      unitPrice: Number(rates.midClamp) || 0
    },
    {
      code: 'LR-ALLEN',
      name: 'Allen Bolt - with spring washer - SS304 - M8 x 20 for Clamp',
      category: 'SS304 Hardware',
      hsn: '73181500',
      qty: clampHardwareQty,
      unitPrice: Number(rates.allenBolt) || 0
    },
    {
      code: 'LR-TNUT',
      name: 'T Nut for Clamps - Aluminum',
      category: 'Clamps',
      hsn: '76169990',
      qty: clampHardwareQty,
      unitPrice: Number(rates.tNut) || 0
    },
    {
      code: 'LR-EPDM',
      name: 'EPDM Rubber Washer',
      category: 'Sealing',
      hsn: '40169320',
      qty: lAngleQty,
      unitPrice: Number(rates.epdmWasher) || 0
    },
    {
      code: 'LR-STS',
      name: 'Self tapping screws - M6, 75 mm length - GI',
      category: 'Fasteners',
      hsn: '73181400',
      qty: lAngleQty,
      unitPrice: Number(rates.selfTappingScrew) || 0
    },
    {
      code: 'LR-JOINER',
      name: 'Joiner Plates - Aluminum - 100*25*3mm',
      category: 'Joinery',
      hsn: '76109010',
      qty: joinerPlatesQty,
      unitPrice: Number(rates.joinerPlate) || 0
    },
    {
      code: 'LR-HEX-JN',
      name: 'Hexa Bolt SS 304 with spring washer and Nut M8*30 - Full set (Joiner)',
      category: 'SS304 Hardware',
      hsn: '73181500',
      qty: joinerBoltQty,
      unitPrice: Number(rates.hexaBoltJoiner) || 0
    }
  ];

  const items = rawItems
    .filter(it => it.qty > 0)
    .map(it => ({
      ...it,
      total: Number((it.qty * it.unitPrice).toFixed(2))
    }));

  const subtotal = Number(items.reduce((sum, it) => sum + it.total, 0).toFixed(2));
  const gstAmount = Number((subtotal * 0.18).toFixed(2));
  const grandTotal = Math.round(subtotal * 1.18);
  const perKwRate = totalWatts > 0 ? Math.round((subtotal / totalWatts) * 1000) : 0;

  return {
    title: `Double C Rail with L Bracket — ${totalKw.toFixed(3).replace(/\.?0+$/, '')} kW`,
    systemType: 'Aluminium Long Rail 45mm (Double C Rail with L Bracket)',
    computedRows,
    railTotals,
    totalPanels,
    totalRows,
    totalMeters: Number(totalMeters.toFixed(2)),
    totalWatts,
    totalKw: Number(totalKw.toFixed(3)),
    perKwRate,
    subtotal,
    gstAmount,
    grandTotal,
    items,
    hasStockShortage
  };
}
