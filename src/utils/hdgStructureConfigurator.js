// Pre-engineered HDG C-Section & SHS Structure Configurator Data & Engine
// Extracted with 100% mathematical parity from HDG_C_Section_SHS_Configurator_Generic_Output.xlsx

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

export const CONFIG_PARTS_BY_KEY = {
  "1 Row|2": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 4.803
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 1600,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 2,
      "unitWeight": 3.91208832
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 2400,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 2,
      "unitWeight": 4.15659384
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$2:$E$3,3)=\"Leg\")*($F$2:$F$3<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 2400,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 1,
      "unitWeight": 4.6960584
    },
    {
      "name": "",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$2:$E$3,3)=\"Leg\")*($F$2:$F$3>=2000))>0,\"Base plate\",\"\"))",
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "1 Row|3": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 4.803
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 1600,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 2,
      "unitWeight": 3.91208832
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3600,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 2,
      "unitWeight": 6.23489076
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$19:$E$20,3)=\"Leg\")*($F$19:$F$20<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 1,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$19:$E$20,3)=\"Leg\")*($F$19:$F$20>=2000))>0,\"Base plate\",\"\"))",
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "1 Row|4": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 4.803
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 1600,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 3,
      "unitWeight": 3.91208832
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 2400,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 4,
      "unitWeight": 4.15659384
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$36:$E$37,3)=\"Leg\")*($F$36:$F$37<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 2400,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 4.6960584
    },
    {
      "name": "",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$36:$E$37,3)=\"Leg\")*($F$36:$F$37>=2000))>0,\"Base plate\",\"\"))",
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "1 Row|5": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 4.803
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 1600,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 3,
      "unitWeight": 3.91208832
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 4,
      "unitWeight": 5.1957423
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$53:$E$54,3)=\"Leg\")*($F$53:$F$54<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$53:$E$54,3)=\"Leg\")*($F$53:$F$54>=2000))>0,\"Base plate\",\"\"))",
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "1 Row|6": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 4.803
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 1600,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 3,
      "unitWeight": 3.91208832
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3600,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 4,
      "unitWeight": 6.23489076
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$70:$E$71,3)=\"Leg\")*($F$70:$F$71<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$70:$E$71,3)=\"Leg\")*($F$70:$F$71>=2000))>0,\"Base plate\",\"\"))",
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "1 Row|7": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 4.803
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 1600,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 4,
      "unitWeight": 3.91208832
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 2400,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 2,
      "unitWeight": 4.15659384
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$87:$E$88,3)=\"Leg\")*($F$87:$F$88<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 4,
      "unitWeight": 5.1957423
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 2400,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 1,
      "unitWeight": 4.6960584
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$87:$E$88,3)=\"Leg\")*($F$87:$F$88>=2000))>0,\"Base plate\",\"\"))",
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "1 Row|8": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 4.803
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 1600,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 4,
      "unitWeight": 3.91208832
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3200,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 6,
      "unitWeight": 5.542125120000001
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$104:$E$105,3)=\"Leg\")*($F$104:$F$105<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$104:$E$105,3)=\"Leg\")*($F$104:$F$105>=2000))>0,\"Base plate\",\"\"))",
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "1 Row|9": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 4.803
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 1600,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 5,
      "unitWeight": 3.91208832
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 2400,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 4,
      "unitWeight": 4.15659384
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$121:$E$122,3)=\"Leg\")*($F$121:$F$122<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 10,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 4,
      "unitWeight": 5.1957423
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 2400,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 4.6960584
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$121:$E$122,3)=\"Leg\")*($F$121:$F$122>=2000))>0,\"Base plate\",\"\"))",
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "1 Row|10": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 4.803
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 1600,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 5,
      "unitWeight": 3.91208832
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 16,
      "unitWeight": 5.1957423
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$138:$E$139,3)=\"Leg\")*($F$138:$F$139<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 10,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$138:$E$139,3)=\"Leg\")*($F$138:$F$139>=2000))>0,\"Base plate\",\"\"))",
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "2 Row|2": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 4.803
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 3900,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 2,
      "unitWeight": 9.53571528
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 2400,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 4,
      "unitWeight": 4.15659384
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$155:$E$156,3)=\"Leg\")*($F$155:$F$156<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 2400,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 1,
      "unitWeight": 4.6960584
    },
    {
      "name": "",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$155:$E$156,3)=\"Leg\")*($F$155:$F$156>=2000))>0,\"Base plate\",\"\"))",
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "2 Row|3": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 4.803
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 3900,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 2,
      "unitWeight": 9.53571528
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3600,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 4,
      "unitWeight": 6.23489076
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$172:$E$173,3)=\"Leg\")*($F$172:$F$173<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 1,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$172:$E$173,3)=\"Leg\")*($F$172:$F$173>=2000))>0,\"Base plate\",\"\"))",
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "2 Row|4": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 4.803
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 3900,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 3,
      "unitWeight": 9.53571528
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 2400,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 8,
      "unitWeight": 4.15659384
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$189:$E$190,3)=\"Leg\")*($F$189:$F$190<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 2400,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 4.6960584
    },
    {
      "name": "",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$189:$E$190,3)=\"Leg\")*($F$189:$F$190>=2000))>0,\"Base plate\",\"\"))",
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "2 Row|5": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 4.803
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 3900,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 3,
      "unitWeight": 9.53571528
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 8,
      "unitWeight": 5.1957423
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$206:$E$207,3)=\"Leg\")*($F$206:$F$207<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$206:$E$207,3)=\"Leg\")*($F$206:$F$207>=2000))>0,\"Base plate\",\"\"))",
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "2 Row|6": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 4.803
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 3900,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 3,
      "unitWeight": 9.53571528
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3600,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 8,
      "unitWeight": 6.23489076
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$223:$E$224,3)=\"Leg\")*($F$223:$F$224<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$223:$E$224,3)=\"Leg\")*($F$223:$F$224>=2000))>0,\"Base plate\",\"\"))",
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "2 Row|7": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 4.803
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 3900,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 4,
      "unitWeight": 9.53571528
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 2400,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 4,
      "unitWeight": 4.15659384
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$240:$E$241,3)=\"Leg\")*($F$240:$F$241<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 8,
      "unitWeight": 5.1957423
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 2400,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 1,
      "unitWeight": 4.6960584
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$240:$E$241,3)=\"Leg\")*($F$240:$F$241>=2000))>0,\"Base plate\",\"\"))",
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "2 Row|8": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 4.803
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 3900,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 4,
      "unitWeight": 9.53571528
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3200,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 12,
      "unitWeight": 5.542125120000001
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$257:$E$258,3)=\"Leg\")*($F$257:$F$258<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$257:$E$258,3)=\"Leg\")*($F$257:$F$258>=2000))>0,\"Base plate\",\"\"))",
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "2 Row|9": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 4.803
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 3900,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 5,
      "unitWeight": 9.53571528
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 2400,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 8,
      "unitWeight": 4.15659384
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$274:$E$275,3)=\"Leg\")*($F$274:$F$275<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 10,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 8,
      "unitWeight": 5.1957423
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 12,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 2400,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 4.6960584
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$274:$E$275,3)=\"Leg\")*($F$274:$F$275>=2000))>0,\"Base plate\",\"\"))",
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "2 Row|10": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 4.803
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 3900,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 5,
      "unitWeight": 9.53571528
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 16,
      "unitWeight": 5.1957423
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$291:$E$292,3)=\"Leg\")*($F$291:$F$292<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 10,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 12,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$291:$E$292,3)=\"Leg\")*($F$291:$F$292>=2000))>0,\"Base plate\",\"\"))",
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "3 Row|2": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 4.803
    },
    {
      "name": "Leg-3",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 11.740146
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 3350,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 2,
      "unitWeight": 8.19093492
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 2950,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 2,
      "unitWeight": 7.2129128399999995
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 2400,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 6,
      "unitWeight": 4.15659384
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$308:$E$310,3)=\"Leg\")*($F$308:$F$310<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.934
    },
    {
      "name": "Rafter Cleat 1",
      "partFormula": null,
      "length": 500,
      "section": "P - 500*70*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 0.7640797500000001
    },
    {
      "name": "Rafter cleat 2",
      "partFormula": null,
      "length": 500,
      "section": "P - 500*40*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.38203987500000003
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 12,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 2400,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 4.6960584
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$308:$E$310,3)=\"Leg\")*($F$308:$F$310>=2000))>0,\"Base plate\",\"\"))",
      "length": 200,
      "section": "P - 200*200*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 1.6898695
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "3 Row|3": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 4.803
    },
    {
      "name": "Leg-3",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 11.740146
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 3350,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 2,
      "unitWeight": 8.19093492
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 2950,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 2,
      "unitWeight": 7.2129128399999995
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3600,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 6,
      "unitWeight": 6.23489076
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$325:$E$327,3)=\"Leg\")*($F$325:$F$327<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.934
    },
    {
      "name": "Rafter cleat 1",
      "partFormula": null,
      "length": 500,
      "section": "P - 70*40*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 0.7640797500000001
    },
    {
      "name": "Rafter cleat 2",
      "partFormula": null,
      "length": 500,
      "section": "P - 70*40*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.38203987500000003
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 12,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$325:$E$327,3)=\"Leg\")*($F$325:$F$327>=2000))>0,\"Base plate\",\"\"))",
      "length": 200,
      "section": "P - 200*200*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 1.6898695
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "3 Row|4": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 4.803
    },
    {
      "name": "Leg-3",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 11.740146
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 3350,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 3,
      "unitWeight": 8.19093492
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 2950,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 3,
      "unitWeight": 7.2129128399999995
    },
    {
      "name": "Rafter cleat 1",
      "partFormula": null,
      "length": 500,
      "section": "P - 500*70*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 0.7640797500000001
    },
    {
      "name": "Rafter cleat 2",
      "partFormula": null,
      "length": 500,
      "section": "P - 500*40*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 0.38203987500000003
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 2400,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 12,
      "unitWeight": 4.15659384
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$342:$E$344,3)=\"Leg\")*($F$342:$F$344<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 12,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 2400,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 4.6960584
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$342:$E$344,3)=\"Leg\")*($F$342:$F$344>=2000))>0,\"Base plate\",\"\"))",
      "length": 200,
      "section": "P - 200*200*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 1.6898695
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "3 Row|5": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 4.803
    },
    {
      "name": "Leg-3",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 11.740146
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 3350,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 3,
      "unitWeight": 8.19093492
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 2950,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 3,
      "unitWeight": 7.2129128399999995
    },
    {
      "name": "Rafter cleat 1",
      "partFormula": null,
      "length": 500,
      "section": "P - 500*70*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 0.7640797500000001
    },
    {
      "name": "Rafter cleat 2",
      "partFormula": null,
      "length": 500,
      "section": "P - 500*40*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 0.38203987500000003
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 12,
      "unitWeight": 5.1957423
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$359:$E$361,3)=\"Leg\")*($F$359:$F$361<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 12,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$359:$E$361,3)=\"Leg\")*($F$359:$F$361>=2000))>0,\"Base plate\",\"\"))",
      "length": 200,
      "section": "P - 200*200*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 1.6898695
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "3 Row|6": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 4.803
    },
    {
      "name": "Leg-3",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 11.740146
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 3350,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 3,
      "unitWeight": 8.19093492
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 2950,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 3,
      "unitWeight": 7.2129128399999995
    },
    {
      "name": "Rafter cleat 1",
      "partFormula": null,
      "length": 500,
      "section": "P - 500*70*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 0.7640797500000001
    },
    {
      "name": "Rafter cleat 2",
      "partFormula": null,
      "length": 500,
      "section": "P - 500*40*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 0.38203987500000003
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3600,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 12,
      "unitWeight": 6.23489076
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$376:$E$378,3)=\"Leg\")*($F$376:$F$378<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 12,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 6,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$376:$E$378,3)=\"Leg\")*($F$376:$F$378>=2000))>0,\"Base plate\",\"\"))",
      "length": 200,
      "section": "P - 200*200*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 3,
      "unitWeight": 1.6898695
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "3 Row|7": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 4.803
    },
    {
      "name": "Leg-3",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 11.740146
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 3350,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 4,
      "unitWeight": 8.19093492
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 2950,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 4,
      "unitWeight": 7.2129128399999995
    },
    {
      "name": "Rafter cleat 1",
      "partFormula": null,
      "length": 500,
      "section": "P - 500*70*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.7640797500000001
    },
    {
      "name": "Rafter cleat 2",
      "partFormula": null,
      "length": 500,
      "section": "P - 500*40*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.38203987500000003
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 2400,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 6,
      "unitWeight": 4.15659384
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$393:$E$395,3)=\"Leg\")*($F$393:$F$395<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 12,
      "unitWeight": 5.1957423
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 12,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 12,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 2400,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 2,
      "unitWeight": 4.6960584
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$393:$E$395,3)=\"Leg\")*($F$393:$F$395>=2000))>0,\"Base plate\",\"\"))",
      "length": 200,
      "section": "P - 200*200*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 1.6898695
    }
  ],
  "3 Row|8": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 4.803
    },
    {
      "name": "Leg-3",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 11.740146
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 3350,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 4,
      "unitWeight": 8.19093492
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 2950,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 4,
      "unitWeight": 7.2129128399999995
    },
    {
      "name": "Rafter cleat 1",
      "partFormula": null,
      "length": 500,
      "section": "P - 500*70*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 0.7640797500000001
    },
    {
      "name": "Rafter cleat 2",
      "partFormula": null,
      "length": 500,
      "section": "P - 500*40*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.38203987500000003
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3200,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 18,
      "unitWeight": 5.542125120000001
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$410:$E$412,3)=\"Leg\")*($F$410:$F$412<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 12,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 12,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$410:$E$412,3)=\"Leg\")*($F$410:$F$412>=2000))>0,\"Base plate\",\"\"))",
      "length": 200,
      "section": "P - 200*200*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 1.6898695
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ],
  "3 Row|9": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 4.803
    },
    {
      "name": "Leg-3",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 11.740146
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 3350,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 5,
      "unitWeight": 8.19093492
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 2950,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 5,
      "unitWeight": 7.2129128399999995
    },
    {
      "name": "Rafter cleat 1",
      "partFormula": null,
      "length": 500,
      "section": "P - 500*70*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 0.7640797500000001
    },
    {
      "name": "Rafter cleat 2",
      "partFormula": null,
      "length": 500,
      "section": "P - 500*40*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 10,
      "unitWeight": 0.38203987500000003
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 2400,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 12,
      "unitWeight": 4.15659384
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$427:$E$429,3)=\"Leg\")*($F$427:$F$429<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 10,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 12,
      "unitWeight": 5.1957423
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 12,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 18,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 10,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 10,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 2400,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 4.6960584
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 4,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$427:$E$429,3)=\"Leg\")*($F$427:$F$429>=2000))>0,\"Base plate\",\"\"))",
      "length": 200,
      "section": "P - 200*200*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 1.6898695
    }
  ],
  "3 Row|10": [
    {
      "name": "Leg-1",
      "partFormula": null,
      "length": 900,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 2.882
    },
    {
      "name": "Leg-2",
      "partFormula": null,
      "length": 1500,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 4.803
    },
    {
      "name": "Leg-3",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 100*50*15",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 11.740146
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 3350,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 5,
      "unitWeight": 8.19093492
    },
    {
      "name": "Rafter",
      "partFormula": null,
      "length": 2950,
      "section": "CS - 80*40*15",
      "thickness": 1.6,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 5,
      "unitWeight": 7.2129128399999995
    },
    {
      "name": "Rafter cleat 1",
      "partFormula": null,
      "length": 500,
      "section": "P - 500*70*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 0.7640797500000001
    },
    {
      "name": "Rafter cleat 2",
      "partFormula": null,
      "length": 500,
      "section": "P - 500*40*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 10,
      "unitWeight": 0.38203987500000003
    },
    {
      "name": "Purlin",
      "partFormula": null,
      "length": 3000,
      "section": "CS - 70*40*15",
      "thickness": 1.2,
      "material": "ASM 150 YS 550mpa - GALVAL",
      "qty": 24,
      "unitWeight": 5.1957423
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Column support\",IF(SUMPRODUCT((LEFT($E$444:$E$446,3)=\"Leg\")*($F$444:$F$446<2000))>0,\"Base plate\",\"\"))",
      "length": 150,
      "section": "P - 150*150*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 10,
      "unitWeight": 0.934
    },
    {
      "name": "Purlin cleat 1",
      "partFormula": null,
      "length": 50,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 12,
      "unitWeight": 0.22679827500000002
    },
    {
      "name": "Purlin cleat 2",
      "partFormula": null,
      "length": 130,
      "section": "LS - 60*60",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 18,
      "unitWeight": 0.589675515
    },
    {
      "name": "Bracing Plate",
      "partFormula": null,
      "length": 160,
      "section": "P - 160*80*3",
      "thickness": 3.0,
      "material": "HDG",
      "qty": 10,
      "unitWeight": 0.29884008
    },
    {
      "name": "Bracing",
      "partFormula": null,
      "length": 1260,
      "section": "LS - 50*50",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 10,
      "unitWeight": 3.1378208400000003
    },
    {
      "name": "Cross Bracing",
      "partFormula": null,
      "length": 3000,
      "section": "CU - 60*30",
      "thickness": 2.0,
      "material": "HDG",
      "qty": 8,
      "unitWeight": 5.8700730000000005
    },
    {
      "name": "Base plate",
      "partFormula": "IF('Input Screen'!$D$3=\"Square Tube\",\"Base plate\",IF(SUMPRODUCT((LEFT($E$444:$E$446,3)=\"Leg\")*($F$444:$F$446>=2000))>0,\"Base plate\",\"\"))",
      "length": 200,
      "section": "P - 200*200*5",
      "thickness": 5.0,
      "material": "HDG",
      "qty": 5,
      "unitWeight": 1.6898695
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    },
    {
      "name": "",
      "partFormula": null,
      "length": null,
      "section": null,
      "thickness": null,
      "material": null,
      "qty": null,
      "unitWeight": null
    }
  ]
};

export const ACCESSORIES_BY_KEY = {
  "1 Row|2": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 8,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 4,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Purlin, bracing & plate fixing",
      "size": "M10x30",
      "material": "HDG",
      "qty": 18,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 16,
      "unitPrice": 20.0
    }
  ],
  "1 Row|3": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 12,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 4,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Purlin, bracing & plate fixing",
      "size": "M10x30",
      "material": "HDG",
      "qty": 18,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 16,
      "unitPrice": 20.0
    }
  ],
  "1 Row|4": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 16,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 6,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Purlin, bracing & plate fixing",
      "size": "M10x30",
      "material": "HDG",
      "qty": 32,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 24,
      "unitPrice": 20.0
    }
  ],
  "1 Row|5": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 20,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 6,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Purlin, bracing & plate fixing",
      "size": "M10x30",
      "material": "HDG",
      "qty": 32,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 24,
      "unitPrice": 20.0
    }
  ],
  "1 Row|6": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 24,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 6,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Purlin, bracing & plate fixing",
      "size": "M10x30",
      "material": "HDG",
      "qty": 32,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 24,
      "unitPrice": 20.0
    }
  ],
  "1 Row|7": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 28,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 8,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Purlin, bracing & plate fixing",
      "size": "M10x30",
      "material": "HDG",
      "qty": 46,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 32,
      "unitPrice": 20.0
    }
  ],
  "1 Row|8": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 32,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 8,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Purlin, bracing & plate fixing",
      "size": "M10x30",
      "material": "HDG",
      "qty": 44,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 32,
      "unitPrice": 20.0
    }
  ],
  "1 Row|9": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 36,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 10,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Purlin, bracing & plate fixing",
      "size": "M10x30",
      "material": "HDG",
      "qty": 60,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 40,
      "unitPrice": 20.0
    }
  ],
  "1 Row|10": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 40,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 10,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Purlin, bracing & plate fixing",
      "size": "M10x30",
      "material": "HDG",
      "qty": 60,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 40,
      "unitPrice": 20.0
    }
  ],
  "2 Row|2": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 16,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 4,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Purlin, bracing & plate fixing",
      "size": "M10x30",
      "material": "HDG",
      "qty": 26,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 16,
      "unitPrice": 20.0
    }
  ],
  "2 Row|3": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 24,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 4,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Purlin, bracing & plate fixing",
      "size": "M10x30",
      "material": "HDG",
      "qty": 26,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 16,
      "unitPrice": 20.0
    }
  ],
  "2 Row|4": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 32,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 6,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Purlin, bracing & plate fixing",
      "size": "M10x30",
      "material": "HDG",
      "qty": 48,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 24,
      "unitPrice": 20.0
    }
  ],
  "2 Row|5": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 40,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 6,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Purlin, bracing & plate fixing",
      "size": "M10x30",
      "material": "HDG",
      "qty": 48,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 24,
      "unitPrice": 20.0
    }
  ],
  "2 Row|6": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 48,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 6,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Purlin, bracing & plate fixing",
      "size": "M10x30",
      "material": "HDG",
      "qty": 48,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 24,
      "unitPrice": 20.0
    }
  ],
  "2 Row|7": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 56,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 8,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Purlin, bracing & plate fixing",
      "size": "M10x30",
      "material": "HDG",
      "qty": 70,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 32,
      "unitPrice": 20.0
    }
  ],
  "2 Row|8": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 64,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 8,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Purlin, bracing & plate fixing",
      "size": "M10x30",
      "material": "HDG",
      "qty": 68,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 32,
      "unitPrice": 20.0
    }
  ],
  "2 Row|9": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 72,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 10,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Purlin, bracing & plate fixing",
      "size": "M10x30",
      "material": "HDG",
      "qty": 92,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 40,
      "unitPrice": 20.0
    }
  ],
  "2 Row|10": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 80,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 10,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Purlin, bracing & plate fixing",
      "size": "M10x30",
      "material": "HDG",
      "qty": 92,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 40,
      "unitPrice": 20.0
    }
  ],
  "3 Row|2": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 24,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 6,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Rafter to Purlins",
      "size": "M10x30",
      "material": "HDG",
      "qty": 80,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 24,
      "unitPrice": 20.0
    }
  ],
  "3 Row|3": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 36,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 6,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Rafter to Purlins",
      "size": "M10x30",
      "material": "HDG",
      "qty": 80,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 24,
      "unitPrice": 20.0
    }
  ],
  "3 Row|4": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 48,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 9,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Rafter to Purlins",
      "size": "M10x30",
      "material": "HDG",
      "qty": 134,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 36,
      "unitPrice": 20.0
    }
  ],
  "3 Row|5": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 60,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 9,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Rafter to Purlins",
      "size": "M10x30",
      "material": "HDG",
      "qty": 134,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 36,
      "unitPrice": 20.0
    }
  ],
  "3 Row|6": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 72,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 9,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Rafter to Purlins",
      "size": "M10x30",
      "material": "HDG",
      "qty": 134,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 36,
      "unitPrice": 20.0
    }
  ],
  "3 Row|7": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 84,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 12,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Rafter to Purlins",
      "size": "M10x30",
      "material": "HDG",
      "qty": 188,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 48,
      "unitPrice": 20.0
    }
  ],
  "3 Row|8": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 96,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 12,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Rafter to Purlins",
      "size": "M10x30",
      "material": "HDG",
      "qty": 184,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 48,
      "unitPrice": 20.0
    }
  ],
  "3 Row|9": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 108,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 15,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Rafter to Purlins",
      "size": "M10x30",
      "material": "HDG",
      "qty": 242,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 60,
      "unitPrice": 20.0
    }
  ],
  "3 Row|10": [
    {
      "item": 1,
      "supply": "Allen Bolt + Washer + Nut - M8x20",
      "purpose": "Panel mount",
      "size": "M8x20",
      "material": "SS304",
      "qty": 120,
      "unitPrice": 13.0
    },
    {
      "item": 2,
      "supply": "Hex Bolt + Nut + 2 Washer - M12x30",
      "purpose": "Column to Rafter",
      "size": "M12x30",
      "material": "HDG",
      "qty": 15,
      "unitPrice": 18.0
    },
    {
      "item": 3,
      "supply": "Hex Bolt + Nut + 2 Washer - M10x30",
      "purpose": "Rafter to Purlins",
      "size": "M10x30",
      "material": "HDG",
      "qty": 242,
      "unitPrice": 16.0
    },
    {
      "item": 4,
      "supply": "Anchor Bolt, Nut,washer - M10x100",
      "purpose": "Column to RCC pillar",
      "size": "M10x100",
      "material": "HDG",
      "qty": 60,
      "unitPrice": 20.0
    }
  ]
};

/**
 * Calculates complete HDG structure BOM, weights, fasteners, costs, and ceiling-rounded quoted price.
 */
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
