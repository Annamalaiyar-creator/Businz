// Universal Indian GST Calculation & State Detection Utility for BUSINZ
// Home State: Tamil Nadu (State Code: 33)

export const GST_STATE_MAP = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh'
};

/**
 * Detects if a transaction is Intra-State (Tamil Nadu: CGST + SGST) or Inter-State (Outside TN: IGST)
 * @param {string} gstin - Customer GSTIN (first 2 digits = state code)
 * @param {string} stateStr - Delivery / Destination State
 * @param {string} billingStateStr - Billing State fallback
 * @returns {boolean} true for INTRA (Tamil Nadu), false for INTER (Outside TN)
 */
export function isTamilNaduIntra(gstin = '', stateStr = '', billingStateStr = '') {
  const cleanGst = String(gstin || '').trim();
  if (cleanGst.length >= 2) {
    const code = cleanGst.substring(0, 2);
    if (code === '33') return true;
    if (!isNaN(parseInt(code, 10)) && parseInt(code, 10) > 0) return false;
  }

  const s1 = String(stateStr || '').trim().toLowerCase();
  const s2 = String(billingStateStr || '').trim().toLowerCase();
  const target = s1 || s2;

  if (!target || target === '—' || target === '-') {
    return true; // Default to Intra-State (Tamil Nadu) if unassigned
  }

  if (target.includes('tamil nadu') || target === 'tn' || target === '33' || target.includes('tamilnadu')) {
    return true;
  }

  // Any other defined state is Inter-State
  return false;
}

/**
 * Resolves state name from GSTIN or state string
 */
export function resolveStateName(gstin = '', stateStr = '') {
  const cleanGst = String(gstin || '').trim();
  if (cleanGst.length >= 2) {
    const code = cleanGst.substring(0, 2);
    if (GST_STATE_MAP[code]) return GST_STATE_MAP[code];
  }
  return stateStr || 'Tamil Nadu';
}

/**
 * Groups items and calculates detailed GST tier breakdowns with CGST/SGST vs IGST
 * @param {Array} items - List of items with qty, rate/unitPrice, gstRate
 * @param {Object} options - { isIntra, gstin, state, presetGroups }
 * @returns {Object} Comprehensive GST Breakdown
 */
export function calculateGstTiers(items = [], options = {}) {
  const isIntra = options.isIntra !== undefined
    ? options.isIntra
    : isTamilNaduIntra(options.gstin, options.state, options.billingState);

  const gstTiersMap = {};
  let totalTaxable = 0;

  // 1. Process custom items
  (items || []).forEach(it => {
    if (it.isPresetItem && options.presetGroups) return; // Handled under presetGroups
    const q = parseFloat(it.qty !== undefined ? it.qty : (it.invQty || it.bomQty || 1)) || 0;
    const r = parseFloat(it.rate !== undefined ? it.rate : (it.unitPrice || 0)) || 0;
    const taxable = it.taxable !== undefined ? parseFloat(it.taxable) : (q * r);
    const rateStr = it.gstRate !== undefined ? it.gstRate : (it.tax !== undefined ? it.tax : '18%');
    const rate = parseFloat(String(rateStr).replace('%', '')) || 18;
    const amt = taxable * (rate / 100);

    if (!gstTiersMap[rate]) {
      gstTiersMap[rate] = { rate, taxable: 0, gstAmt: 0, items: [] };
    }
    gstTiersMap[rate].taxable += taxable;
    gstTiersMap[rate].gstAmt += amt;
    gstTiersMap[rate].items.push(it.name || it.description || 'Item');
    totalTaxable += taxable;
  });

  // 2. Process preset groups if present
  if (options.presetGroups && typeof options.presetGroups === 'object') {
    Object.values(options.presetGroups).forEach(grp => {
      if (!grp) return;
      const unitPrice = parseFloat(grp.kitPrice) || 0;
      const multiplier = parseInt(grp.setCount) || 1;
      const groupTotal = unitPrice * multiplier;
      const rate = parseFloat(String(grp.gstRate || '18').replace('%', '')) || 18;
      const amt = groupTotal * (rate / 100);

      if (!gstTiersMap[rate]) {
        gstTiersMap[rate] = { rate, taxable: 0, gstAmt: 0, items: [] };
      }
      gstTiersMap[rate].taxable += groupTotal;
      gstTiersMap[rate].gstAmt += amt;
      gstTiersMap[rate].items.push(grp.name || 'Preset Package');
      totalTaxable += groupTotal;
    });
  }

  // 3. Format tiers with half-rates for CGST/SGST or full rate for IGST
  const rawTiers = Object.values(gstTiersMap).sort((a, b) => a.rate - b.rate);
  const tiers = rawTiers.map(t => {
    const halfRate = t.rate / 2;
    const halfAmt = t.gstAmt / 2;
    return {
      rate: t.rate,
      taxable: t.taxable,
      gstAmt: t.gstAmt,
      items: t.items,
      // CGST & SGST (Intra-state)
      cgstRate: halfRate,
      cgstAmt: halfAmt,
      sgstRate: halfRate,
      sgstAmt: halfAmt,
      // IGST (Inter-state)
      igstRate: t.rate,
      igstAmt: t.gstAmt
    };
  });

  const totalGst = tiers.reduce((s, t) => s + t.gstAmt, 0);
  const totalCgst = isIntra ? (totalGst / 2) : 0;
  const totalSgst = isIntra ? (totalGst / 2) : 0;
  const totalIgst = !isIntra ? totalGst : 0;
  const grandTotal = totalTaxable + totalGst;

  return {
    isIntra,
    taxType: isIntra ? 'INTRA' : 'INTER',
    taxLabel: isIntra ? 'CGST + SGST (Tamil Nadu Intra-State)' : 'IGST (Inter-State)',
    stateName: resolveStateName(options.gstin, options.state),
    tiers: tiers.length > 0 ? tiers : [{
      rate: 18,
      taxable: totalTaxable,
      gstAmt: totalGst,
      cgstRate: 9,
      cgstAmt: totalGst / 2,
      sgstRate: 9,
      sgstAmt: totalGst / 2,
      igstRate: 18,
      igstAmt: totalGst
    }],
    totalTaxable,
    totalGst,
    totalCgst,
    totalSgst,
    totalIgst,
    grandTotal
  };
}
