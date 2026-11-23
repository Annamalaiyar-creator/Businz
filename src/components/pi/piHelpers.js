export const defaultSalesPIs = [];
export const defaultProcurementPIs = [];

export const normalizePiRecord = (item) => {
  if (!item) return item;
  let normalized = { ...item };
  if (normalized.status === 'Pending Approval' || normalized.status === 'Approved') {
    normalized.status = 'Issued';
    normalized.statusType = 'issued';
  }
  // Strict 1-to-1 Safeguards against accidental BOM cross-contamination:
  const pNo = String(normalized.piNo || normalized.id || '').trim().toUpperCase();
  const bomCode = String(
    normalized.convertedBomCode || 
    normalized.convertedBomNo || 
    normalized.converted_bom_code || 
    normalized.converted_bom_no || ''
  ).trim().toUpperCase();

  // 1. PI 495 must never link to BOM 381 (different customer/order)
  if (pNo.includes('495') && bomCode.includes('381')) {
    normalized.status = 'Issued';
    normalized.statusType = 'issued';
    normalized.convertedToBom = false;
    normalized.isConverted = false;
    normalized.convertedBomCode = null;
    normalized.convertedBomNo = null;
    normalized.converted_bom_code = null;
    normalized.converted_bom_no = null;
  }

  // 2. BOM-659 belongs strictly and exclusively to PI-00061.
  if ((bomCode === 'BOM-659' || bomCode === '659') && pNo !== 'PI-00061') {
    normalized.status = 'Issued';
    normalized.statusType = 'issued';
    normalized.convertedToBom = false;
    normalized.isConverted = false;
    normalized.convertedBomCode = null;
    normalized.convertedBomNo = null;
    normalized.converted_bom_code = null;
    normalized.converted_bom_no = null;
  }
  return normalized;
};

// Official GST State Code mappings for Indian GSTINs
export const GST_STATE_MAP = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
  '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '36': 'Telangana', '37': 'Andhra Pradesh'
};

// Canonical Salesperson Code to Name mapping
export const CODE_TO_SALES_NAME = {
  'SE-001': 'Manojraj Selvaraj',
  'SH-001': 'Manojraj Selvaraj',
  'SH-VRM001': 'Manojraj Selvaraj',
  'SE-002': 'Sanjai kumar',
  'SE-VRM002': 'Sanjai kumar',
  'SE-003': 'Vasanth Kumar S',
  'SE-VRM006': 'Vasanth Kumar S',
  'SE-004': 'Mohith JV',
  'SE-015': 'Mohith JV',
  'SE-VRM004': 'Mohith JV',
  'SE-005': 'Shanthi',
  'SE-006': 'Dhana Sekar',
  'SE-020': 'Dhana Sekar',
  'SE-007': 'PRASHANTH',
  'SE-008': 'Pavithra',
  'SE-010': 'Pavithra',
  'SE-009': 'KALAISELVI T',
  'SE-VRM090': 'KALAISELVI T',
  'SE-VRM005': 'KALAISELVI T',
  'SE-1000': 'Annamalaiyar'
};

// Canonical Salesperson Email to Display Name mapping
export const EMAIL_TO_SALES_NAME = {
  'sales.s1@vrmstructures.in': 'Manojraj Selvaraj',
  'sales.s2@vrmstructures.in': 'PRASHANTH',
  'sales.s3@vrmstructures.in': 'Shanthi',
  'sales.s4@vrmstructures.in': 'Mohith JV',
  'sanjaikumar3a@gmail.com': 'Sanjai kumar',
  'sanjay@vrmstructures.in': 'Sanjai kumar',
  'vasanthkumarsaravanan.work@gmail.com': 'Vasanth Kumar S',
  'vasanthkumar1234@gmail.com': 'Vasanth Kumar S',
  'dhanasekar@gmail.com': 'Dhana Sekar',
  'projectsales@jashsun.com': 'Pavithra',
  'velmuruganr@vrmstructures.in': 'Pavithra',
  'mms@vrmstructures.in': 'KALAISELVI T',
  'sales@vrmstructures.in': 'KALAISELVI T',
  'sales@vrmstrutures.in': 'KALAISELVI T',
  'kalpanaram17@vrmstructures.in': 'KalpanaRam',
  'vasanth.support@vrmstructures.in': 'Vasanth',
  'scm@vrmstructures.in': 'ARUN BOOPATHI M',
  'arun@vrmstructures.in': 'ARUN BOOPATHI M',
  'production@vrm.com': 'Senthil Kumar',
  'dispatch@vrmstructures.in': 'Kalpana',
  'dispatchhead@gmail.com': 'Kalpana',
  'arannamalaiyar@gmail.com': 'Annamalaiyar',
  'admin@businz.com': 'Admin User',
  'bi@gmail.com': 'Billing',
  'keerthana@vrmstructures.in': 'Keerthana'
};

// Canonical Salesperson Email to Employee Code mapping
export const EMAIL_TO_SALES_CODE = {
  'sales.s1@vrmstructures.in': 'SE-001',
  'sales.s2@vrmstructures.in': 'SE-007',
  'sales.s3@vrmstructures.in': 'SE-005',
  'sales.s4@vrmstructures.in': 'SE-004',
  'sanjaikumar3a@gmail.com': 'SE-002',
  'sanjay@vrmstructures.in': 'SE-002',
  'vasanthkumarsaravanan.work@gmail.com': 'SE-003',
  'vasanthkumar1234@gmail.com': 'SE-003',
  'dhanasekar@gmail.com': 'SE-006',
  'projectsales@jashsun.com': 'SE-008',
  'velmuruganr@vrmstructures.in': 'SE-008',
  'mms@vrmstructures.in': 'SE-009',
  'sales@vrmstructures.in': 'SE-009',
  'sales@vrmstrutures.in': 'SE-009',
  'kalpanaram17@vrmstructures.in': 'TS-001',
  'vasanth.support@vrmstructures.in': 'TS-002',
  'scm@vrmstructures.in': 'PR-001',
  'arun@vrmstructures.in': 'PR-001',
  'production@vrm.com': 'PH-001',
  'dispatch@vrmstructures.in': 'DH-001',
  'dispatchhead@gmail.com': 'DH-001',
  'arannamalaiyar@gmail.com': 'TA-001'
};

export const canonicalizeSalespersonCode = (rawCode, name) => {
  const c = String(rawCode || '').trim().toUpperCase();
  if (c.startsWith('TS-')) return c;
  if (c === 'SE-015' || (c === 'SE-VRM002' && String(name || '').toLowerCase().includes('mohith'))) return 'SE-004';
  if (c === 'SH-001' || c === 'SH-VRM001') return 'SE-001';
  if (c === 'SE-020') return 'SE-006';
  if (c === 'SE-010') return 'SE-008';
  if (c === 'SE-VRM090') return 'SE-009';
  const lowerName = String(name || '').toLowerCase().trim();
  if (EMAIL_TO_SALES_CODE[lowerName]) return EMAIL_TO_SALES_CODE[lowerName];
  if (lowerName.includes('sales.s4')) return 'SE-004';
  if (lowerName.includes('sales.s1')) return 'SE-001';
  if (lowerName.includes('sales.s2')) return 'SE-007';
  if (lowerName.includes('sales.s3')) return 'SE-005';
  if (lowerName.includes('mohith')) return 'SE-004';
  if (lowerName.includes('sanjai') || lowerName.includes('sanjay')) return 'SE-002';
  if (lowerName.includes('manoj')) return 'SE-001';
  if (lowerName.includes('kumar') && lowerName.includes('vasanth')) return 'SE-003';
  if (c === 'SE-003' || c === 'SE-VRM006') return 'SE-003';
  if (c === 'SE-004' || c === 'SE-015') return 'SE-004';
  return c || '';
};

export const resolvePiSalesPersonName = (pi) => {
  if (!pi) return '';
  const nonSales = [
    'kalpanaram', 'kalpana ram', 'kalpana', 'tech support', 'ts-001', 'ts-002',
    'dispatch', 'dispatch head', 'admin', 'direct / admin',
    'sales', 'sales person', 'salesperson', 'sales department', 'sales executive',
    'undefined', 'null', '—', '-'
  ];

  const clean = (v) => String(v || '').replace(/\s*\([^)]*\)/g, '').trim();
  const primaryRaw = clean(pi?.salesPerson || pi?.salesperson || pi?.sales_person_name || pi?.salesRep);
  const assignedRaw = clean(pi?.assignedSalesperson || pi?.assignedToName);
  const creatorRaw = clean(pi?.createdBy || pi?.createdByName);

  // Collect email candidates
  const emailCandidates = [
    primaryRaw,
    assignedRaw,
    creatorRaw,
    pi?.salesPersonEmail,
    pi?.salespersonEmail,
    pi?.createdByEmail,
    pi?.email,
    pi?.creatorEmail
  ].map(e => String(e || '').toLowerCase().trim()).filter(e => e.includes('@'));

  // 1. Direct match on known salesperson email mapping
  for (const em of emailCandidates) {
    if (EMAIL_TO_SALES_NAME[em]) {
      return EMAIL_TO_SALES_NAME[em];
    }
  }

  // 2. Prefix match for VRM sales mailbox aliases
  for (const em of emailCandidates) {
    if (em.includes('sales.s4')) return 'Mohith JV';
    if (em.includes('sales.s1')) return 'Manojraj Selvaraj';
    if (em.includes('sales.s2')) return 'PRASHANTH';
    if (em.includes('sales.s3')) return 'Shanthi';
  }

  const raw = (!primaryRaw || primaryRaw.includes('@') || nonSales.includes(primaryRaw.toLowerCase()))
    ? (assignedRaw && !assignedRaw.includes('@') && !nonSales.includes(assignedRaw.toLowerCase()) ? assignedRaw : (primaryRaw || creatorRaw))
    : primaryRaw;

  const rawCode = String(
    pi?.assignedSalespersonCode ||
    pi?.salesPersonCode ||
    pi?.createdById ||
    pi?.sales_person_code ||
    pi?.created_by_id || ''
  ).trim().toUpperCase();

  const canonicalCode = canonicalizeSalespersonCode(rawCode, raw || primaryRaw || emailCandidates[0]);

  if (canonicalCode && CODE_TO_SALES_NAME[canonicalCode]) {
    if (!raw || raw.includes('@') || nonSales.includes(raw.toLowerCase())) {
      return CODE_TO_SALES_NAME[canonicalCode];
    }
  }
  if (rawCode && CODE_TO_SALES_NAME[rawCode]) {
    if (!raw || raw.includes('@') || nonSales.includes(raw.toLowerCase())) {
      return CODE_TO_SALES_NAME[rawCode];
    }
  }

  // Check localStorage employees if present
  try {
    const emps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
    for (const em of emailCandidates) {
      const found = emps.find(e => (e.email || '').toLowerCase().trim() === em);
      if (found && (found.employee_name || found.name)) {
        return found.employee_name || found.name;
      }
    }
    if (canonicalCode || rawCode) {
      const found = emps.find(e => {
        const c = String(e.employee_code || e.code || e.id || '').trim().toUpperCase();
        return c === (canonicalCode || rawCode);
      });
      if (found && (found.employee_name || found.name)) {
        return found.employee_name || found.name;
      }
    }
  } catch (_) {}

  // If raw still includes an '@', never show raw email address to user
  if (raw && raw.includes('@')) {
    if (canonicalCode && CODE_TO_SALES_NAME[canonicalCode]) return CODE_TO_SALES_NAME[canonicalCode];
    if (rawCode && CODE_TO_SALES_NAME[rawCode]) return CODE_TO_SALES_NAME[rawCode];
    const prefix = raw.split('@')[0].toLowerCase();
    if (prefix.includes('sales.s4') || prefix === 'sales.s4') return 'Mohith JV';
    if (prefix.includes('sales.s1') || prefix === 'sales.s1') return 'Manojraj Selvaraj';
    if (prefix.includes('sales.s2') || prefix === 'sales.s2') return 'PRASHANTH';
    if (prefix.includes('sales.s3') || prefix === 'sales.s3') return 'Shanthi';
    if (prefix.includes('mohith')) return 'Mohith JV';
    if (prefix.includes('manoj')) return 'Manojraj Selvaraj';
    if (prefix.includes('sanjai') || prefix.includes('sanjay')) return 'Sanjai kumar';
    if (prefix.includes('vasanth')) return 'Vasanth Kumar S';
    if (prefix.includes('dhana')) return 'Dhana Sekar';
    if (prefix.includes('pavithra')) return 'Pavithra';
    if (prefix.includes('kalai')) return 'KALAISELVI T';
    if (prefix.includes('annamalai')) return 'Annamalaiyar';
    return 'Sales Team';
  }

  if (raw.toLowerCase() === 'annamalai' || raw.toLowerCase() === 'ar.annamalaiyar' || raw.toLowerCase() === 'ar annamalaiyar') {
    return 'Annamalaiyar';
  }

  if (nonSales.includes(raw.toLowerCase())) {
    if (canonicalCode && CODE_TO_SALES_NAME[canonicalCode]) return CODE_TO_SALES_NAME[canonicalCode];
    if (rawCode && CODE_TO_SALES_NAME[rawCode]) return CODE_TO_SALES_NAME[rawCode];
    return '';
  }
  return raw;
};
