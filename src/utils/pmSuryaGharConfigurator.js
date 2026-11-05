/**
 * PM Surya Ghar: Muft Bijli Yojana - Turnkey Solar BOS Kit Configurator Engine
 * 100% mathematical parity with VRM_Structures_PM_Surya_Ghar_Kit_Final_Corrected_Verified.xlsx
 *
 * Pre-Engineered Turnkey Rooftop Solar Package:
 * Modules + Inverter + HDG Mounting Structure + ACDB/DCDB + Cables + Earth Kit + BOS Hardware + Logistics
 */

export const SURYA_PANEL_MASTER = [
  { make: 'Waaree', dcr: 'DCR', wp: 540, sellingPrice: 27.00, minPrice: 26.50 },
  { make: 'Waaree', dcr: 'DCR', wp: 580, sellingPrice: 28.50, minPrice: 28.00 },
  { make: 'Waaree', dcr: 'DCR', wp: 585, sellingPrice: 28.50, minPrice: 28.00 },
  { make: 'Waaree', dcr: 'DCR', wp: 610, sellingPrice: 28.50, minPrice: 28.00 },
  { make: 'Adani', dcr: 'DCR', wp: 540, sellingPrice: 26.50, minPrice: 26.25 },
  { make: 'Adani', dcr: 'DCR', wp: 545, sellingPrice: 26.50, minPrice: 26.25 },
  { make: 'Adani', dcr: 'DCR', wp: 550, sellingPrice: 26.50, minPrice: 26.25 },
  { make: 'Adani', dcr: 'DCR', wp: 555, sellingPrice: 26.50, minPrice: 26.25 },
  { make: 'Adani', dcr: 'DCR', wp: 620, sellingPrice: 28.00, minPrice: 27.50 },
  { make: 'Adani', dcr: 'DCR', wp: 625, sellingPrice: 26.25, minPrice: 26.00 },
  { make: 'Adani', dcr: 'DCR', wp: 630, sellingPrice: 26.25, minPrice: 26.00 },
  { make: 'Adani', dcr: 'DCR', wp: 635, sellingPrice: 29.00, minPrice: 28.50 },
  { make: 'Renew', dcr: 'DCR', wp: 540, sellingPrice: 22.00, minPrice: 21.50 },
  { make: 'Renew', dcr: 'DCR', wp: 545, sellingPrice: 22.00, minPrice: 21.50 },
  { make: 'Renew', dcr: 'DCR', wp: 550, sellingPrice: 22.00, minPrice: 21.50 },
  { make: 'Vikram', dcr: 'DCR', wp: 550, sellingPrice: 24.80, minPrice: 24.30 },
  { make: 'Vikram', dcr: 'Non DCR', wp: 600, sellingPrice: 16.50, minPrice: 16.00 },
  { make: 'Vikram', dcr: 'Non DCR', wp: 630, sellingPrice: 16.50, minPrice: 16.00 }
];

export const SURYA_INVERTER_MASTER = [
  { make: 'Polycab', kw: 2.0, phase: 'Single Phase', sellingPrice: 15500, minPrice: 15250 },
  { make: 'Polycab', kw: 3.6, phase: 'Single Phase', sellingPrice: 16000, minPrice: 15800 },
  { make: 'Polycab', kw: 4.0, phase: 'Single Phase', sellingPrice: 21090, minPrice: 20500 },
  { make: 'Polycab', kw: 4.6, phase: 'Single Phase', sellingPrice: 25500, minPrice: 25000 },
  { make: 'Polycab', kw: 5.0, phase: 'Single Phase', sellingPrice: 26000, minPrice: 25500 },
  { make: 'Polycab', kw: 5.0, phase: 'Three Phase', sellingPrice: 46000, minPrice: 45500 },
  { make: 'Polycab', kw: 6.0, phase: 'Single Phase', sellingPrice: 29500, minPrice: 28500 },
  { make: 'Polycab', kw: 6.0, phase: 'Three Phase', sellingPrice: 46300, minPrice: 45800 },
  { make: 'Polycab', kw: 8.0, phase: 'Three Phase', sellingPrice: 46700, minPrice: 46200 },
  { make: 'Polycab', kw: 10.0, phase: 'Three Phase', sellingPrice: 48000, minPrice: 47500 },
  { make: 'Deye', kw: 2.2, phase: 'Single Phase', sellingPrice: 15290, minPrice: 14790 },
  { make: 'Deye', kw: 3.0, phase: 'Single Phase', sellingPrice: 15500, minPrice: 15000 },
  { make: 'Deye', kw: 3.3, phase: 'Single Phase', sellingPrice: 16000, minPrice: 15500 },
  { make: 'Deye', kw: 4.0, phase: 'Single Phase', sellingPrice: 19040, minPrice: 18540 },
  { make: 'Deye', kw: 5.0, phase: 'Single Phase', sellingPrice: 24910, minPrice: 24410 },
  { make: 'Deye', kw: 5.0, phase: 'Three Phase', sellingPrice: 43510, minPrice: 43010 },
  { make: 'Deye', kw: 6.0, phase: 'Three Phase', sellingPrice: 44210, minPrice: 43710 },
  { make: 'Deye', kw: 8.0, phase: 'Three Phase', sellingPrice: 45750, minPrice: 45250 },
  { make: 'Deye', kw: 10.0, phase: 'Three Phase', sellingPrice: 47280, minPrice: 46780 },
  { make: 'Growatt', kw: 3.3, phase: 'Single Phase', sellingPrice: 17500, minPrice: 17000 },
  { make: 'Growatt', kw: 5.0, phase: 'Single Phase', sellingPrice: 27000, minPrice: 26500 },
  { make: 'Growatt', kw: 5.0, phase: 'Three Phase', sellingPrice: 54000, minPrice: 53500 },
  { make: 'Growatt', kw: 8.0, phase: 'Three Phase', sellingPrice: 53000, minPrice: 52500 },
  { make: 'Growatt', kw: 10.0, phase: 'Three Phase', sellingPrice: 55000, minPrice: 54000 }
];

export const SURYA_CABLE_MASTER = [
  { make: 'Polycab', type: 'DC 4SQMM', label: 'Polycab DC 4SQMM', sellingPrice: 56.50, minPrice: 56.00 },
  { make: 'Polycab', type: 'AC 4SQMM', label: 'Polycab AC 4SQMM', sellingPrice: 56.50, minPrice: 56.00 },
  { make: 'Polycab', type: 'DC 6SQMM', label: 'Polycab DC 6SQMM', sellingPrice: 85.00, minPrice: 84.50 },
  { make: 'Polycab', type: 'AC 6SQMM', label: 'Polycab AC 6SQMM', sellingPrice: 85.00, minPrice: 84.50 },
  { make: 'Polycab', type: 'Earthing 4SQMM', label: 'Polycab Earthing 4SQMM', sellingPrice: 58.50, minPrice: 57.00 },
  { make: 'Orbit Aluminium', type: 'Earthing 16SQMM', label: 'Orbit Aluminium Earthing 16SQMM', sellingPrice: 27.50, minPrice: 25.00 }
];

// 88-row pricing matrix for HDG Rooftop Mounting Structures (Hat Type & C Type)
export const SURYA_STRUCTURE_MASTER = [
  // Hat Type
  { type: 'Hat Type', panelQty: 4, height: '3-5 ft', sellingPrice: 9100, minPrice: 8645 },
  { type: 'Hat Type', panelQty: 4, height: '4-6 ft', sellingPrice: 9700, minPrice: 9215 },
  { type: 'Hat Type', panelQty: 4, height: '6.5 - 8.3 ft', sellingPrice: 14500, minPrice: 13775 },
  { type: 'Hat Type', panelQty: 4, height: '8.3 - 10 ft', sellingPrice: 15700, minPrice: 14915 },
  { type: 'Hat Type', panelQty: 6, height: '3-5 ft', sellingPrice: 10600, minPrice: 10070 },
  { type: 'Hat Type', panelQty: 6, height: '4-6 ft', sellingPrice: 11100, minPrice: 10545 },
  { type: 'Hat Type', panelQty: 6, height: '6.5 - 8.3 ft', sellingPrice: 16000, minPrice: 15200 },
  { type: 'Hat Type', panelQty: 6, height: '8.3 - 10 ft', sellingPrice: 17300, minPrice: 16435 },
  { type: 'Hat Type', panelQty: 8, height: '3-5 ft', sellingPrice: 15400, minPrice: 14630 },
  { type: 'Hat Type', panelQty: 8, height: '4-6 ft', sellingPrice: 16300, minPrice: 15485 },
  { type: 'Hat Type', panelQty: 8, height: '6.5 - 8.3 ft', sellingPrice: 23700, minPrice: 22515 },
  { type: 'Hat Type', panelQty: 8, height: '8.3 - 10 ft', sellingPrice: 25600, minPrice: 24320 },
  { type: 'Hat Type', panelQty: 10, height: '3-5 ft', sellingPrice: 16800, minPrice: 15960 },
  { type: 'Hat Type', panelQty: 10, height: '4-6 ft', sellingPrice: 17600, minPrice: 16720 },
  { type: 'Hat Type', panelQty: 10, height: '6.5 - 8.3 ft', sellingPrice: 25500, minPrice: 24225 },
  { type: 'Hat Type', panelQty: 10, height: '8.3 - 10 ft', sellingPrice: 27400, minPrice: 26030 },
  { type: 'Hat Type', panelQty: 12, height: '3-5 ft', sellingPrice: 18200, minPrice: 17290 },
  { type: 'Hat Type', panelQty: 12, height: '4-6 ft', sellingPrice: 19000, minPrice: 18050 },
  { type: 'Hat Type', panelQty: 12, height: '6.5 - 8.3 ft', sellingPrice: 26800, minPrice: 25460 },
  { type: 'Hat Type', panelQty: 12, height: '8.3 - 10 ft', sellingPrice: 28800, minPrice: 27360 },
  { type: 'Hat Type', panelQty: 14, height: '3-5 ft', sellingPrice: 23000, minPrice: 21850 },
  { type: 'Hat Type', panelQty: 14, height: '4-6 ft', sellingPrice: 24200, minPrice: 22990 },
  { type: 'Hat Type', panelQty: 14, height: '6.5 - 8.3 ft', sellingPrice: 34900, minPrice: 33155 },
  { type: 'Hat Type', panelQty: 14, height: '8.3 - 10 ft', sellingPrice: 37500, minPrice: 35625 },
  { type: 'Hat Type', panelQty: 16, height: '3-5 ft', sellingPrice: 24400, minPrice: 23180 },
  { type: 'Hat Type', panelQty: 16, height: '4-6 ft', sellingPrice: 25600, minPrice: 24320 },
  { type: 'Hat Type', panelQty: 16, height: '6.5 - 8.3 ft', sellingPrice: 36300, minPrice: 34485 },
  { type: 'Hat Type', panelQty: 16, height: '8.3 - 10 ft', sellingPrice: 38900, minPrice: 36955 },
  { type: 'Hat Type', panelQty: 18, height: '3-5 ft', sellingPrice: 29300, minPrice: 27835 },
  { type: 'Hat Type', panelQty: 18, height: '4-6 ft', sellingPrice: 30700, minPrice: 29165 },
  { type: 'Hat Type', panelQty: 18, height: '6.5 - 8.3 ft', sellingPrice: 43600, minPrice: 41420 },
  { type: 'Hat Type', panelQty: 18, height: '8.3 - 10 ft', sellingPrice: 46800, minPrice: 44460 },
  { type: 'Hat Type', panelQty: 20, height: '3-5 ft', sellingPrice: 30800, minPrice: 29260 },
  { type: 'Hat Type', panelQty: 20, height: '4-6 ft', sellingPrice: 32300, minPrice: 30685 },
  { type: 'Hat Type', panelQty: 20, height: '6.5 - 8.3 ft', sellingPrice: 45700, minPrice: 43415 },
  { type: 'Hat Type', panelQty: 20, height: '8.3 - 10 ft', sellingPrice: 49000, minPrice: 46550 },
  { type: 'Hat Type', panelQty: 22, height: '3-5 ft', sellingPrice: 32400, minPrice: 30780 },
  { type: 'Hat Type', panelQty: 22, height: '4-6 ft', sellingPrice: 33900, minPrice: 32205 },
  { type: 'Hat Type', panelQty: 22, height: '6.5 - 8.3 ft', sellingPrice: 47600, minPrice: 45220 },
  { type: 'Hat Type', panelQty: 22, height: '8.3 - 10 ft', sellingPrice: 51100, minPrice: 48545 },
  { type: 'Hat Type', panelQty: 24, height: '3-5 ft', sellingPrice: 36700, minPrice: 34865 },
  { type: 'Hat Type', panelQty: 24, height: '4-6 ft', sellingPrice: 38400, minPrice: 36480 },
  { type: 'Hat Type', panelQty: 24, height: '6.5 - 8.3 ft', sellingPrice: 54600, minPrice: 51870 },
  { type: 'Hat Type', panelQty: 24, height: '8.3 - 10 ft', sellingPrice: 58500, minPrice: 55575 },

  // C Type
  { type: 'C Type', panelQty: 4, height: '3-5 ft', sellingPrice: 11800, minPrice: 11210 },
  { type: 'C Type', panelQty: 4, height: '4-6 ft', sellingPrice: 12600, minPrice: 11970 },
  { type: 'C Type', panelQty: 4, height: '6.5 - 8.3 ft', sellingPrice: 18900, minPrice: 17955 },
  { type: 'C Type', panelQty: 4, height: '8.3 - 10 ft', sellingPrice: 20400, minPrice: 19380 },
  { type: 'C Type', panelQty: 6, height: '3-5 ft', sellingPrice: 13800, minPrice: 13110 },
  { type: 'C Type', panelQty: 6, height: '4-6 ft', sellingPrice: 14400, minPrice: 13680 },
  { type: 'C Type', panelQty: 6, height: '6.5 - 8.3 ft', sellingPrice: 20800, minPrice: 19760 },
  { type: 'C Type', panelQty: 6, height: '8.3 - 10 ft', sellingPrice: 22500, minPrice: 21375 },
  { type: 'C Type', panelQty: 8, height: '3-5 ft', sellingPrice: 20000, minPrice: 19000 },
  { type: 'C Type', panelQty: 8, height: '4-6 ft', sellingPrice: 21200, minPrice: 20140 },
  { type: 'C Type', panelQty: 8, height: '6.5 - 8.3 ft', sellingPrice: 30800, minPrice: 29260 },
  { type: 'C Type', panelQty: 8, height: '8.3 - 10 ft', sellingPrice: 33300, minPrice: 31635 },
  { type: 'C Type', panelQty: 10, height: '3-5 ft', sellingPrice: 21800, minPrice: 20710 },
  { type: 'C Type', panelQty: 10, height: '4-6 ft', sellingPrice: 22900, minPrice: 21755 },
  { type: 'C Type', panelQty: 10, height: '6.5 - 8.3 ft', sellingPrice: 33200, minPrice: 31540 },
  { type: 'C Type', panelQty: 10, height: '8.3 - 10 ft', sellingPrice: 35600, minPrice: 33820 },
  { type: 'C Type', panelQty: 12, height: '3-5 ft', sellingPrice: 23700, minPrice: 22515 },
  { type: 'C Type', panelQty: 12, height: '4-6 ft', sellingPrice: 24700, minPrice: 23465 },
  { type: 'C Type', panelQty: 12, height: '6.5 - 8.3 ft', sellingPrice: 34800, minPrice: 33060 },
  { type: 'C Type', panelQty: 12, height: '8.3 - 10 ft', sellingPrice: 37400, minPrice: 35530 },
  { type: 'C Type', panelQty: 14, height: '3-5 ft', sellingPrice: 29900, minPrice: 28405 },
  { type: 'C Type', panelQty: 14, height: '4-6 ft', sellingPrice: 31500, minPrice: 29925 },
  { type: 'C Type', panelQty: 14, height: '6.5 - 8.3 ft', sellingPrice: 45400, minPrice: 43130 },
  { type: 'C Type', panelQty: 14, height: '8.3 - 10 ft', sellingPrice: 48800, minPrice: 46360 },
  { type: 'C Type', panelQty: 16, height: '3-5 ft', sellingPrice: 31700, minPrice: 30115 },
  { type: 'C Type', panelQty: 16, height: '4-6 ft', sellingPrice: 33700, minPrice: 32015 },
  { type: 'C Type', panelQty: 16, height: '6.5 - 8.3 ft', sellingPrice: 44100, minPrice: 41895 },
  { type: 'C Type', panelQty: 16, height: '8.3 - 10 ft', sellingPrice: 46700, minPrice: 44365 },
  { type: 'C Type', panelQty: 18, height: '3-5 ft', sellingPrice: 38100, minPrice: 36195 },
  { type: 'C Type', panelQty: 18, height: '4-6 ft', sellingPrice: 39800, minPrice: 37810 },
  { type: 'C Type', panelQty: 18, height: '6.5 - 8.3 ft', sellingPrice: 52900, minPrice: 50255 },
  { type: 'C Type', panelQty: 18, height: '8.3 - 10 ft', sellingPrice: 56000, minPrice: 53200 },
  { type: 'C Type', panelQty: 20, height: '3-5 ft', sellingPrice: 40300, minPrice: 38285 },
  { type: 'C Type', panelQty: 20, height: '4-6 ft', sellingPrice: 42000, minPrice: 39900 },
  { type: 'C Type', panelQty: 20, height: '6.5 - 8.3 ft', sellingPrice: 55400, minPrice: 52630 },
  { type: 'C Type', panelQty: 20, height: '8.3 - 10 ft', sellingPrice: 58600, minPrice: 55670 },
  { type: 'C Type', panelQty: 22, height: '3-5 ft', sellingPrice: 42500, minPrice: 40375 },
  { type: 'C Type', panelQty: 22, height: '4-6 ft', sellingPrice: 44300, minPrice: 42085 },
  { type: 'C Type', panelQty: 22, height: '6.5 - 8.3 ft', sellingPrice: 57600, minPrice: 54720 },
  { type: 'C Type', panelQty: 22, height: '8.3 - 10 ft', sellingPrice: 60800, minPrice: 57760 },
  { type: 'C Type', panelQty: 24, height: '3-5 ft', sellingPrice: 48400, minPrice: 45980 },
  { type: 'C Type', panelQty: 24, height: '4-6 ft', sellingPrice: 50400, minPrice: 47880 },
  { type: 'C Type', panelQty: 24, height: '6.5 - 8.3 ft', sellingPrice: 66600, minPrice: 63270 },
  { type: 'C Type', panelQty: 24, height: '8.3 - 10 ft', sellingPrice: 70500, minPrice: 66975 }
];

export const SURYA_FIXED_ITEMS = [
  { item: 'ACDB MCB & SPD', make: 'Jashsun', unit: 'Nos', defaultQty: 1, sellingPrice: 2640, minPrice: 2600, tier: '1-5kw' },
  { item: '5-10KW Three Phase ACDB 1 In 1 Out', make: 'Jashsun', unit: 'Nos', defaultQty: 1, sellingPrice: 8800, minPrice: 8500, tier: '6-10kw' },
  { item: '1 In 1 Out DCDB MCB & SPD', make: 'Jashsun', unit: 'Nos', defaultQty: 1, sellingPrice: 0, minPrice: 0 },
  { item: 'Complete Earth Kit (3 Cu Rods + 3 Pits + 3x10kg Compound)', make: 'Terrabond', unit: 'Nos', defaultQty: 1, sellingPrice: 2860, minPrice: 2700 },
  { item: '6 Sq.mm Ring Type Cu. Lugs', make: 'Reputed', unit: 'Nos', defaultQty: 10, sellingPrice: 10, minPrice: 10 },
  { item: '6 Sq.mm Pin Type Cu. Lugs', make: 'Reputed', unit: 'Nos', defaultQty: 10, sellingPrice: 10, minPrice: 10 },
  { item: 'PVC Slotted Cable Tray', make: 'Aeroplast', unit: 'Nos', defaultQty: 1, sellingPrice: 110, minPrice: 100 },
  { item: 'UV Protected 200mm Cable Tie', make: 'Reputed', unit: 'Pack', defaultQty: 1, sellingPrice: 250, minPrice: 200 },
  { item: 'MC4 Connectors (1000V, 30A)', make: 'Nimbo', unit: 'Pairs', defaultQty: 2, sellingPrice: 35, minPrice: 30 },
  { item: 'Insulation Tape (Red, Black, Green)', make: 'Reputed', unit: 'Nos', defaultQty: 3, sellingPrice: 100, minPrice: 80 },
  { item: '25mm Black ISI Heavy-Duty PVC Conduit with Bends & Screws', make: 'Aeroplast', unit: 'Mtr', defaultQty: 25, sellingPrice: 0, minPrice: 0 }
];

export const TRANSPORT_DISTANCE_SLABS = [
  { label: 'Less than 50 km', cost: 1000 },
  { label: '50 to 250 km', cost: 2000 },
  { label: 'Above 250 km', cost: 3000 }
];

/**
 * Finds the optimal on-grid string inverter for the calculated DC system size
 */
export function getAutoInverter(actualDcKw, preferredMake = 'Polycab', forcedPhase = null) {
  const phase = forcedPhase || (actualDcKw <= 6.0 ? 'Single Phase' : 'Three Phase');
  const available = SURYA_INVERTER_MASTER.filter(inv =>
    inv.make.toLowerCase() === preferredMake.toLowerCase() &&
    inv.phase === phase &&
    inv.kw >= actualDcKw
  );
  if (available.length > 0) {
    return available.sort((a, b) => a.kw - b.kw)[0];
  }
  // Fallback: any inverter >= actualDcKw matching phase
  const anyMake = SURYA_INVERTER_MASTER.filter(inv => inv.phase === phase && inv.kw >= actualDcKw);
  if (anyMake.length > 0) return anyMake.sort((a, b) => a.kw - b.kw)[0];
  return SURYA_INVERTER_MASTER[0];
}

/**
 * Main Calculation Engine - 100% Excel Math Parity
 */
export function calculatePmSuryaGharKit({
  panelQty = 5,
  panelMake = 'Renew',
  panelWp = 550,
  inverterMake = 'Polycab',
  inverterKw = null,
  inverterPhase = null,
  structureType = 'Hat Type',
  structureHeight = '8.3 - 10 ft',
  dcCableSelection = 'Polycab DC 4SQMM',
  dcCableMetres = 40,
  acCableSelection = 'Polycab DC 4SQMM',
  acCableMetres = 40,
  earthingCableSelection = 'Orbit Aluminium Earthing 16SQMM',
  earthingCableMetres = 100,
  transportDistance = 'Less than 50 km',
  priceBasis = 'Selling Price', // 'Selling Price' | 'Minimum Selling Price'
  marginRounding = 0,
  discount = 0,
  setCount = 1
} = {}) {
  const isMinPrice = priceBasis === 'Minimum Selling Price';
  const mult = Math.max(1, parseInt(setCount, 10) || 1);

  // 1. Module Capacity
  const safeQty = Math.max(1, parseInt(panelQty, 10) || 1);
  const safeWp = Math.max(100, parseFloat(panelWp) || 550);
  const actualDcKw = parseFloat(((safeQty * safeWp) / 1000).toFixed(2));

  // 2. Find Module
  const panelDef = SURYA_PANEL_MASTER.find(p =>
    p.make.toLowerCase() === panelMake.toLowerCase() && p.wp === safeWp
  ) || SURYA_PANEL_MASTER.find(p => p.make.toLowerCase() === panelMake.toLowerCase()) || SURYA_PANEL_MASTER[0];
  const panelRatePerWp = isMinPrice ? panelDef.minPrice : panelDef.sellingPrice;
  const panelTotalAmount = parseFloat((safeQty * safeWp * panelRatePerWp).toFixed(2));

  // 3. Find Inverter
  let chosenInverter = null;
  if (inverterKw) {
    chosenInverter = SURYA_INVERTER_MASTER.find(inv =>
      inv.make.toLowerCase() === inverterMake.toLowerCase() &&
      inv.kw === parseFloat(inverterKw) &&
      (!inverterPhase || inv.phase === inverterPhase)
    );
  }
  if (!chosenInverter) {
    chosenInverter = getAutoInverter(actualDcKw, inverterMake, inverterPhase);
  }
  const inverterRate = isMinPrice ? chosenInverter.minPrice : chosenInverter.sellingPrice;
  const inverterTotalAmount = parseFloat(inverterRate.toFixed(2));

  // 4. Mounting Structure (Odd-to-Even Auto-Rounding rule: 5 -> 6 panels)
  const evenPanelQty = safeQty % 2 === 1 ? safeQty + 1 : safeQty;
  const clampedStructureQty = Math.min(24, Math.max(4, evenPanelQty));
  const structDef = SURYA_STRUCTURE_MASTER.find(s =>
    s.type === structureType &&
    s.panelQty === clampedStructureQty &&
    s.height === structureHeight
  ) || SURYA_STRUCTURE_MASTER[0];
  const structureRate = isMinPrice ? structDef.minPrice : structDef.sellingPrice;
  const structureTotalAmount = parseFloat(structureRate.toFixed(2));

  // 5. Cables
  const dcCableDef = SURYA_CABLE_MASTER.find(c => c.label === dcCableSelection) || SURYA_CABLE_MASTER[0];
  const dcCableRate = isMinPrice ? dcCableDef.minPrice : dcCableDef.sellingPrice;
  const dcCableTotal = parseFloat((Math.max(0, parseFloat(dcCableMetres) || 0) * dcCableRate).toFixed(2));

  const acCableDef = SURYA_CABLE_MASTER.find(c => c.label === acCableSelection) || SURYA_CABLE_MASTER[1];
  const acCableRate = isMinPrice ? acCableDef.minPrice : acCableDef.sellingPrice;
  const acCableTotal = parseFloat((Math.max(0, parseFloat(acCableMetres) || 0) * acCableRate).toFixed(2));

  const earthingCableDef = SURYA_CABLE_MASTER.find(c => c.label === earthingCableSelection) || SURYA_CABLE_MASTER[5];
  const earthingCableRate = isMinPrice ? earthingCableDef.minPrice : earthingCableDef.sellingPrice;
  const earthingCableTotal = parseFloat((Math.max(0, parseFloat(earthingCableMetres) || 0) * earthingCableRate).toFixed(2));

  // 6. ACDB / DCDB Tier
  const isAbove5Kw = actualDcKw > 5.0;
  const acdbRate = isAbove5Kw
    ? (isMinPrice ? 8500 : 8800)
    : (isMinPrice ? 2600 : 2640);
  const acdbTotal = parseFloat(acdbRate.toFixed(2));

  // 7. BOS Hardware (Fixed Items)
  const earthKitRate = isMinPrice ? 2700 : 2860;
  const ringLugsRate = isMinPrice ? 10 : 10;
  const pinLugsRate = isMinPrice ? 10 : 10;
  const cableTrayRate = isMinPrice ? 100 : 110;
  const cableTiesRate = isMinPrice ? 200 : 250;
  const mc4Rate = isMinPrice ? 30 : 35; // 2 pairs @ 35 = 70
  const mc4Total = mc4Rate * 2;
  const insulationTapeRate = isMinPrice ? 80 : 100; // 3 nos @ 100 = 300
  const insulationTapeTotal = insulationTapeRate * 3;
  const pvcConduitRate = 0;

  // 8. Logistics
  const miscExpenses = 1000;
  const transDef = TRANSPORT_DISTANCE_SLABS.find(t => t.label === transportDistance) || TRANSPORT_DISTANCE_SLABS[0];
  const transportCost = transDef.cost;

  // 9. BOM Items Array (21 Lines matching Quote_BOM sheet)
  const items = [
    {
      slNo: 1,
      name: 'Solar Module',
      spec: `${safeWp}Wp (${panelDef.dcr})`,
      make: panelDef.make.toUpperCase(),
      qty: safeQty,
      uom: 'Nos',
      unit: 'Nos',
      rate: panelRatePerWp,
      amount: panelTotalAmount,
      hsn: '85414011',
      gstRate: '5%',
      category: 'Solar PV Modules'
    },
    {
      slNo: 2,
      name: 'Inverter',
      spec: `${chosenInverter.kw}kW ${chosenInverter.phase}`,
      make: chosenInverter.make.toUpperCase(),
      qty: 1,
      uom: 'Nos',
      unit: 'Nos',
      rate: inverterRate,
      amount: inverterTotalAmount,
      hsn: '85044090',
      gstRate: '12%',
      category: 'Grid-Tied Inverter'
    },
    {
      slNo: 3,
      name: 'Structure',
      spec: `HDG Structure with ${structDef.type} purlin ${safeQty} Panels with ${structDef.height} height`,
      make: 'VRM STRUCTURES',
      qty: 1,
      uom: 'Lot',
      unit: 'Lot',
      rate: structureRate,
      amount: structureTotalAmount,
      hsn: '73089090',
      gstRate: '18%',
      category: 'HDG Mounting Structure'
    },
    {
      slNo: 4,
      name: 'ACDB',
      spec: isAbove5Kw
        ? '5-10KW Three Phase ACDB 1 In 1 Out IP65 SPD & MCB'
        : 'IP 65 Indoor Polycarbonate Enclosure, AC Type 2 SPD, 25A pole AC MCB',
      make: 'TERRABOND',
      qty: 1,
      uom: 'Nos',
      unit: 'Nos',
      rate: acdbRate,
      amount: acdbTotal,
      hsn: '85371000',
      gstRate: '18%',
      category: 'AC Distribution'
    },
    {
      slNo: 5,
      name: 'DCDB',
      spec: 'PC Enclosure with IP 65 Protection, DC Type 2 SPD 600V, 25A DC fuse & DC MCB',
      make: 'TERRABOND',
      qty: 1,
      uom: 'Nos',
      unit: 'Nos',
      rate: 0,
      amount: 0,
      hsn: '85371000',
      gstRate: '18%',
      category: 'DC Distribution'
    },
    {
      slNo: 6,
      name: 'DC Cable',
      spec: `${dcCableDef.type}`,
      make: dcCableDef.make.toUpperCase(),
      qty: parseFloat(dcCableMetres) || 40,
      uom: 'Mtr',
      unit: 'Mtr',
      rate: dcCableRate,
      amount: dcCableTotal,
      hsn: '85444990',
      gstRate: '18%',
      category: 'Solar Cables'
    },
    {
      slNo: 7,
      name: 'AC Cable',
      spec: `${acCableDef.type}, multi strand Cu flexible`,
      make: acCableDef.make.toUpperCase(),
      qty: parseFloat(acCableMetres) || 40,
      uom: 'Mtr',
      unit: 'Mtr',
      rate: acCableRate,
      amount: acCableTotal,
      hsn: '85444990',
      gstRate: '18%',
      category: 'Solar Cables'
    },
    {
      slNo: 8,
      name: 'Earthing Cable',
      spec: `${earthingCableDef.type} Flexible Cable`,
      make: earthingCableDef.make.toUpperCase(),
      qty: parseFloat(earthingCableMetres) || 100,
      uom: 'Mtr',
      unit: 'Mtr',
      rate: earthingCableRate,
      amount: earthingCableTotal,
      hsn: '85444990',
      gstRate: '18%',
      category: 'Solar Cables'
    },
    {
      slNo: 9,
      name: 'Complete Earth Kit',
      spec: '3 × 1 Mtr Copper Bonded Earth Rods + 3 Earth Pit Chambers + 3 × 10 kg Earthing Compound Bags',
      make: 'TERRABOND',
      qty: 1,
      uom: 'Nos',
      unit: 'Nos',
      rate: earthKitRate,
      amount: earthKitRate,
      hsn: '85389000',
      gstRate: '18%',
      category: 'Earthing & Grounding'
    },
    {
      slNo: 10,
      name: 'Earth Rod',
      spec: '1 Mtr Copper Bonded (Included in Earth Kit)',
      make: 'TERRABOND',
      qty: 3,
      uom: 'Nos',
      unit: 'Nos',
      rate: 0,
      amount: 0,
      hsn: '85389000',
      gstRate: '18%',
      category: 'Earthing & Grounding'
    },
    {
      slNo: 11,
      name: 'Earth Pit Chamber',
      spec: '6 Inch FRP Earth Pit Chamber with Cover (Included in Earth Kit)',
      make: 'TERRABOND',
      qty: 3,
      uom: 'Nos',
      unit: 'Nos',
      rate: 0,
      amount: 0,
      hsn: '85389000',
      gstRate: '18%',
      category: 'Earthing & Grounding'
    },
    {
      slNo: 12,
      name: 'Earth Chemical Bag',
      spec: '10kg Chemical Compound Bag (Included in Earth Kit)',
      make: 'TERRABOND',
      qty: 3,
      uom: 'Nos',
      unit: 'Nos',
      rate: 0,
      amount: 0,
      hsn: '38249900',
      gstRate: '18%',
      category: 'Earthing & Grounding'
    },
    {
      slNo: 13,
      name: 'Lugs (Ring Type)',
      spec: '6 Sq.mm Ring Type Cu. Lugs',
      make: 'REPUTED',
      qty: 10,
      uom: 'Nos',
      unit: 'Nos',
      rate: ringLugsRate,
      amount: 10 * ringLugsRate,
      hsn: '85389000',
      gstRate: '18%',
      category: 'BOS Hardware'
    },
    {
      slNo: 14,
      name: 'Lugs (Pin Type)',
      spec: '6 Sq.mm Pin Type Cu. Lugs',
      make: 'REPUTED',
      qty: 10,
      uom: 'Nos',
      unit: 'Nos',
      rate: pinLugsRate,
      amount: 10 * pinLugsRate,
      hsn: '85389000',
      gstRate: '18%',
      category: 'BOS Hardware'
    },
    {
      slNo: 15,
      name: 'Cable Tray',
      spec: 'PVC Slotted Cable Tray',
      make: 'AEROPLAST',
      qty: 1,
      uom: 'Nos',
      unit: 'Nos',
      rate: cableTrayRate,
      amount: cableTrayRate,
      hsn: '39269099',
      gstRate: '18%',
      category: 'BOS Hardware'
    },
    {
      slNo: 16,
      name: 'Cable Ties',
      spec: 'UV Protected 200mm Cable Tie (Pack)',
      make: 'REPUTED',
      qty: 1,
      uom: 'Pack',
      unit: 'Pack',
      rate: cableTiesRate,
      amount: cableTiesRate,
      hsn: '39269099',
      gstRate: '18%',
      category: 'BOS Hardware'
    },
    {
      slNo: 17,
      name: 'MC4 Connectors',
      spec: 'MC4 Connectors (1000V, 30A)',
      make: 'NIMBO',
      qty: 2,
      uom: 'Pairs',
      unit: 'Pairs',
      rate: mc4Rate,
      amount: mc4Total,
      hsn: '85366990',
      gstRate: '18%',
      category: 'BOS Hardware'
    },
    {
      slNo: 18,
      name: 'Insulation Tape',
      spec: 'Insulation Tape (Red, Black, Green)',
      make: 'REPUTED',
      qty: 3,
      uom: 'Nos',
      unit: 'Nos',
      rate: insulationTapeRate,
      amount: insulationTapeTotal,
      hsn: '39191000',
      gstRate: '18%',
      category: 'BOS Hardware'
    },
    {
      slNo: 19,
      name: 'PVC Pipe',
      spec: '25 mm PVC Black ISI Heavy-Duty Conduit complete with bends, clamps & screws',
      make: 'AEROPLAST',
      qty: 25,
      uom: 'Mtr',
      unit: 'Mtr',
      rate: pvcConduitRate,
      amount: 0,
      hsn: '39172300',
      gstRate: '18%',
      category: 'BOS Hardware'
    },
    {
      slNo: 20,
      name: 'Miscellaneous Expenses',
      spec: 'Site handling, fastener packaging & transit insurance overheads',
      make: 'VRM STRUCTURES',
      qty: 1,
      uom: 'Lot',
      unit: 'Lot',
      rate: miscExpenses,
      amount: miscExpenses,
      hsn: '998719',
      gstRate: '18%',
      category: 'Overheads & Site'
    },
    {
      slNo: 21,
      name: 'Transportation',
      spec: `Direct Site Dispatch (${transportDistance})`,
      make: 'LOGISTICS',
      qty: 1,
      uom: 'Lot',
      unit: 'Lot',
      rate: transportCost,
      amount: transportCost,
      hsn: '996511',
      gstRate: '18%',
      category: 'Logistics'
    }
  ];

  // 10. Financial Sums (Strict 2-Decimal Precision)
  const subtotalBeforeAdjustment = items.reduce((sum, it) => sum + it.amount, 0);
  const safeMargin = parseFloat(marginRounding) || 0;
  const safeDiscount = parseFloat(discount) || 0;
  const singleKitAmount = Math.max(0, Math.round((subtotalBeforeAdjustment + safeMargin - safeDiscount) * 100) / 100);

  const totalQuotedAmount = Math.round((singleKitAmount * mult) * 100) / 100;
  const totalCapacityKw = parseFloat((actualDcKw * mult).toFixed(3));
  const perKwRate = totalCapacityKw > 0 ? Math.round((totalQuotedAmount / totalCapacityKw) * 100) / 100 : 0;

  return {
    systemType: 'PM Surya Ghar Solar BOS Kit',
    title: `PM Surya Ghar Solar BOS Kit — ${actualDcKw} kW (${safeQty} × ${safeWp}Wp)`,
    actualDcKw,
    panelQty: safeQty,
    panelWp: safeWp,
    panelMake: panelDef.make,
    panelDcr: panelDef.dcr,
    inverterMake: chosenInverter.make,
    inverterKw: chosenInverter.kw,
    inverterPhase: chosenInverter.phase,
    structureType: structDef.type,
    structureHeight: structDef.height,
    structurePanelQty: structDef.panelQty,
    priceBasis,
    subtotalBeforeAdjustment: Math.round(subtotalBeforeAdjustment * 100) / 100,
    marginRounding: safeMargin,
    discount: safeDiscount,
    perKitAmount: singleKitAmount,
    totalAmount: totalQuotedAmount,
    totalKw: totalCapacityKw,
    perKwRate,
    setCount: mult,
    items
  };
}

