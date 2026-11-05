// Aluminium Mini Rail & Standing Seam Rooftop Structure Configurator Engine
// Extracted with 100% mathematical formula parity from Price_List_Workout_Corrected.xlsx

export const DEFAULT_NALCO_PRICE = 420; // ₹ / kg

export const ALUMINIUM_CATALOG = [
  // 125mm Mini Rails
  { id: 'mr_125_300', name: '125 mm Height Mini Rail with 300 mm Length', category: 'Mini Rail', height: 125, length: 300, weight: 400, fabCost: 2.4, isAlu: true },
  { id: 'mr_125_350', name: '125 mm Height Mini Rail with 350 mm Length', category: 'Mini Rail', height: 125, length: 350, weight: 450, fabCost: 2.4, isAlu: true },
  { id: 'mr_125_400', name: '125 mm Height Mini Rail with 400 mm Length', category: 'Mini Rail', height: 125, length: 400, weight: 500, fabCost: 2.4, isAlu: true },

  // 100mm Mini Rails
  { id: 'mr_100_300', name: '100 mm Height Mini Rail with 300 mm Length', category: 'Mini Rail', height: 100, length: 300, weight: 350, fabCost: 2.4, isAlu: true },
  { id: 'mr_100_350', name: '100 mm Height Mini Rail with 350 mm Length', category: 'Mini Rail', height: 100, length: 350, weight: 400, fabCost: 2.4, isAlu: true },
  { id: 'mr_100_400', name: '100 mm Height Mini Rail with 400 mm Length', category: 'Mini Rail', height: 100, length: 400, weight: 450, fabCost: 2.4, isAlu: true },

  // 75mm Mini Rails
  { id: 'mr_75_300', name: '75 mm Height Mini Rail with 300 mm Length', category: 'Mini Rail', height: 75, length: 300, weight: 325, fabCost: 2.4, isAlu: true },
  { id: 'mr_75_350', name: '75 mm Height Mini Rail with 350 mm Length', category: 'Mini Rail', height: 75, length: 350, weight: 375, fabCost: 2.4, isAlu: true },
  { id: 'mr_75_400', name: '75 mm Height Mini Rail with 400 mm Length', category: 'Mini Rail', height: 75, length: 400, weight: 425, fabCost: 2.4, isAlu: true },

  // 120mm Mini Rails
  { id: 'mr_120_100', name: '120 mm Height Mini Rail with 100 mm Length', category: 'Mini Rail', height: 120, length: 100, weight: 150, fabCost: 2.4, isAlu: true },
  { id: 'mr_120_125', name: '120 mm Height Mini Rail with 125 mm Length', category: 'Mini Rail', height: 120, length: 125, weight: 200, fabCost: 2.4, isAlu: true },
  { id: 'mr_120_150', name: '120 mm Height Mini Rail with 150 mm Length', category: 'Mini Rail', height: 120, length: 150, weight: 250, fabCost: 2.4, isAlu: true },

  // Standing Seam Rails
  { id: 'ssr_100', name: 'Standing Seam Rail with 100 mm Length ', category: 'Standing Seam', height: 80, length: 100, weight: 250, fabCost: 2.4, isAlu: true },
  { id: 'ssr_125', name: 'Standing Seam Rail with 125 mm Length ', category: 'Standing Seam', height: 80, length: 125, weight: 300, fabCost: 2.4, isAlu: true },
  { id: 'ssr_150', name: 'Standing Seam Rail with 150 mm Length ', category: 'Standing Seam', height: 80, length: 150, weight: 350, fabCost: 2.4, isAlu: true },

  // Clamps (Aluminium based)
  { id: 'mid_clamp', name: 'Universal Mid Clamp', category: 'Clamp', weight: 35, fabCost: 1.3, isAlu: true },
  { id: 'end_clamp', name: 'Universal End Clamp', category: 'Clamp', weight: 30, fabCost: 1.0, isAlu: true },
  { id: 'locking_clamp', name: 'Locking Clamp', category: 'Clamp', weight: 20, fabCost: 1.3, isAlu: true },

  // Fasteners & Accessories (Fixed raw cost)
  { id: 'allen_m8_30', name: 'Allen Bolt - SS304 - M8 x 30', category: 'Fastener', baseCost: 6.5, fabCost: 1.0, isAlu: false },
  { id: 'washer_m8', name: 'Spring Washer - M8', category: 'Fastener', baseCost: 1.0, fabCost: 0.5, isAlu: false },
  { id: 'rivet', name: 'Blind Rivet - 5/32" x 1/2"', category: 'Fastener', baseCost: 2.5, fabCost: 1.0, isAlu: false },
  { id: 'epdm_rubber', name: 'EPDM Rubber Sheet - 80*25*2mm', category: 'Accessory', baseCost: 2.5, fabCost: 1.0, isAlu: false },
  { id: 'grub_screw', name: 'Grub Screw', category: 'Fastener', baseCost: 6.5, fabCost: 1.0, isAlu: false }
];

/**
 * Distinct Aluminium Profile Families (Categorized by Profile Type & Height)
 * Lengths are selected separately in the Rail Length Specification container
 */
export const ALUMINIUM_PROFILE_FAMILIES = [
  {
    familyId: 'ssr',
    category: 'Standing Seam',
    height: 80,
    label: 'Standing Seam Profile (80 mm Height • Grub Screws)',
    shortLabel: 'Standing Seam (80mm)',
    defaultRailId: 'ssr_100',
    fixing: 'Grub Screws'
  },
  {
    familyId: 'mr_125',
    category: 'Mini Rail',
    height: 125,
    label: 'Mini Rail Profile — 125 mm Height (Rivets + EPDM)',
    shortLabel: 'Mini Rail (125mm H)',
    defaultRailId: 'mr_125_300',
    fixing: 'Rivets + EPDM'
  },
  {
    familyId: 'mr_100',
    category: 'Mini Rail',
    height: 100,
    label: 'Mini Rail Profile — 100 mm Height (Rivets + EPDM)',
    shortLabel: 'Mini Rail (100mm H)',
    defaultRailId: 'mr_100_300',
    fixing: 'Rivets + EPDM'
  },
  {
    familyId: 'mr_75',
    category: 'Mini Rail',
    height: 75,
    label: 'Mini Rail Profile — 75 mm Height (Rivets + EPDM)',
    shortLabel: 'Mini Rail (75mm H)',
    defaultRailId: 'mr_75_300',
    fixing: 'Rivets + EPDM'
  },
  {
    familyId: 'mr_120',
    category: 'Mini Rail',
    height: 120,
    label: 'Mini Rail Profile — 120 mm Height (Rivets + EPDM)',
    shortLabel: 'Mini Rail (120mm H)',
    defaultRailId: 'mr_120_100',
    fixing: 'Rivets + EPDM'
  }
];

export function getProfileFamilyForRail(railDef) {
  if (!railDef) return ALUMINIUM_PROFILE_FAMILIES[0];
  if (railDef.category === 'Standing Seam') return ALUMINIUM_PROFILE_FAMILIES[0];
  return (
    ALUMINIUM_PROFILE_FAMILIES.find(f => f.category === 'Mini Rail' && f.height === railDef.height) ||
    ALUMINIUM_PROFILE_FAMILIES[1]
  );
}

/**
 * Calculate unit cost and price for an item given the live NALCO price
 * Formula from Excel:
 * Cost = isAlu ? ((nalcoPrice / 1000) * weight) + fabCost : baseCost + fabCost
 * Price = Cost * 1.30 (30% margin)
 */
export function calculateItemPricing(itemDef, nalcoPrice = DEFAULT_NALCO_PRICE, customMargin = 1.3) {
  let cost = 0;
  if (itemDef.isAlu) {
    cost = ((nalcoPrice / 1000) * (itemDef.weight || 0)) + (itemDef.fabCost || 0);
  } else {
    cost = (itemDef.baseCost || 0) + (itemDef.fabCost || 0);
  }
  const price = cost * customMargin;
  return {
    cost: parseFloat(cost.toFixed(2)),
    price: parseFloat(price.toFixed(2))
  };
}

/**
 * Full Standing Seam / Mini Rail Structure Calculation Engine
 * 100% Excel mathematical parity with Sheet1 of Price_List_Workout_Corrected.xlsx
 */
export function calculateAluminiumStructure({
  rowsConfig = [{ panels: 4, rows: 1 }], // Array of { panels, rows }
  panelWp = 625,
  selectedRailId = 'ssr_100',
  fixingModel = 'Standing Seam', // 'Standing Seam' | 'Riviting' | 'Adhesive'
  railCountPerPanel = 2,
  grubScrewsPerRail = 2,
  nalcoPrice = DEFAULT_NALCO_PRICE,
  margin = 1.3
}) {
  // 1. Calculate Total Panels & Rows
  const totalPanels = rowsConfig.reduce((acc, r) => acc + ((parseFloat(r.panels) || 0) * (parseFloat(r.rows) || 1)), 0);
  const totalRows = rowsConfig.reduce((acc, r) => acc + (parseFloat(r.rows) || 1), 0);
  const totalKw = parseFloat(((totalPanels * (parseFloat(panelWp) || 625)) / 1000).toFixed(3));

  // 2. Spare Count Formula: ROUND((TotalPanels + TotalRows) * RailCount * 0.002, 0)
  const spareCount = Math.round((totalPanels + totalRows) * railCountPerPanel * 0.002);

  // 3. Find selected rail definition
  const railDef = ALUMINIUM_CATALOG.find(x => x.id === selectedRailId) || ALUMINIUM_CATALOG.find(x => x.id === 'ssr_100');
  const isStandingSeam = Boolean(
    railDef.category === 'Standing Seam' ||
    (railDef.name && railDef.name.toLowerCase().includes('standing seam'))
  );

  // 4. Quantities based on formulas
  // End Clamps: Rows * 2 * RailCount + SpareCount
  const endClampQty = Math.max(0, (totalRows * 2 * railCountPerPanel) + spareCount);

  // Mid Clamps: (TotalPanels - Rows) * RailCount + SpareCount
  const midClampQty = Math.max(0, ((totalPanels - totalRows) * railCountPerPanel) + spareCount);

  // Total Rails: EndClamps + MidClamps
  const railQty = endClampQty + midClampQty;

  // Locking Clamps, Allen Bolts, Spring Washers equal Total Rails
  const lockingClampQty = railQty;
  const allenBoltQty = railQty;
  const washerQty = railQty;

  // Rivets & EPDM: only if not Adhesive and not Standing Seam
  const isAdhesive = String(fixingModel).toUpperCase().includes('ADHESIVE');
  const rivetQty = (isAdhesive || isStandingSeam) ? 0 : Math.round(railQty * 4 * 1.05);
  const epdmQty = (isAdhesive || isStandingSeam) ? 0 : Math.round(railQty * 2 * 1.01);

  // Grub Screws: only for Standing Seam
  const grubScrewQty = isStandingSeam ? Math.round(railQty * (parseFloat(grubScrewsPerRail) || 2)) : 0;

  // 5. Build Itemized BOM & Compute Amounts
  const bomRows = [
    { def: railDef, qty: railQty },
    { def: ALUMINIUM_CATALOG.find(x => x.id === 'end_clamp'), qty: endClampQty },
    { def: ALUMINIUM_CATALOG.find(x => x.id === 'mid_clamp'), qty: midClampQty },
    { def: ALUMINIUM_CATALOG.find(x => x.id === 'locking_clamp'), qty: lockingClampQty },
    { def: ALUMINIUM_CATALOG.find(x => x.id === 'allen_m8_30'), qty: allenBoltQty },
    { def: ALUMINIUM_CATALOG.find(x => x.id === 'washer_m8'), qty: washerQty },
    { def: ALUMINIUM_CATALOG.find(x => x.id === 'rivet'), qty: rivetQty },
    { def: ALUMINIUM_CATALOG.find(x => x.id === 'epdm_rubber'), qty: epdmQty },
    { def: ALUMINIUM_CATALOG.find(x => x.id === 'grub_screw'), qty: grubScrewQty }
  ].filter(b => b.def && b.qty > 0);

  let totalAmount = 0;
  let totalCost = 0;
  let totalWeightKg = 0;

  const items = bomRows.map((row) => {
    const pricing = calculateItemPricing(row.def, nalcoPrice, margin);
    const lineAmount = parseFloat((row.qty * pricing.price).toFixed(2));
    const lineCost = parseFloat((row.qty * pricing.cost).toFixed(2));
    const lineWeightKg = row.def.weight ? parseFloat(((row.qty * row.def.weight) / 1000).toFixed(2)) : 0;

    totalAmount += lineAmount;
    totalCost += lineCost;
    totalWeightKg += lineWeightKg;

    return {
      id: row.def.id,
      name: row.def.name,
      category: row.def.category,
      qty: row.qty,
      uom: 'NOS',
      unit: 'NOS',
      weightGrams: row.def.weight || 0,
      unitCost: pricing.cost,
      unitPrice: pricing.price,
      rate: pricing.price,
      amount: lineAmount,
      totalWeightKg: lineWeightKg,
      hsn: row.def.isAlu ? '76109010' : '73181500',
      gstRate: '18%'
    };
  });

  totalAmount = parseFloat(totalAmount.toFixed(2));
  totalCost = parseFloat(totalCost.toFixed(2));
  totalWeightKg = parseFloat(totalWeightKg.toFixed(2));

  const perKwRate = totalKw > 0 ? parseFloat((totalAmount / totalKw).toFixed(2)) : 0;
  const perPanelRate = totalPanels > 0 ? parseFloat((totalAmount / totalPanels).toFixed(2)) : 0;
  const perSetCost = railQty > 0 ? parseFloat((totalAmount / railQty).toFixed(2)) : 0;
  const pricePerWp = (totalKw > 0 && totalPanels > 0) ? parseFloat((totalAmount / (totalKw * 1000)).toFixed(2)) : 0;

  return {
    systemType: isStandingSeam ? 'Standing Seam Roof MMS' : 'Aluminium Mini Rail MMS',
    title: `${isStandingSeam ? 'Standing Seam' : 'Mini Rail'} Rooftop MMS — ${totalKw} kW (${totalPanels} Panels)`,
    railName: railDef.name,
    fixingModel,
    nalcoPrice,
    totalPanels,
    totalRows,
    totalKw,
    panelWp,
    spareCount,
    totalWeightKg,
    totalCost,
    totalAmount,
    perKwRate,
    perPanelRate,
    perSetCost,
    pricePerWp,
    items
  };
}

