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
  'SE-009': 'Jawahar',
  'SE-VRM090': 'Jawahar',
  'SE-VRM005': 'Kalai selvi',
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
  'dhanasekar@gmail.com': 'Dhana Sekar',
  'projectsales@jashsun.com': 'Pavithra',
  'velmuruganr@vrmstructures.in': 'Pavithra',
  'mms@vrmstructures.in': 'Kalai selvi',
  'jawahar@vrmstructures.in': 'Jawahar',
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
  'jawahar@vrmstructures.in': 'SE-009',
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
  const lowerName = String(name || '').toLowerCase().trim();

  // 1. Dynamic lookup from live Employee Directory (reflects renamed users & updated emails immediately)
  try {
    const empsList = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
    const empsStore = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
    const allEmps = [...(Array.isArray(empsList) ? empsList : []), ...(Array.isArray(empsStore) ? empsStore : [])].filter(Boolean);
    if (lowerName) {
      const byNameOrEmail = allEmps.find(e => {
        const eName = String(e.employee_name || e.name || '').replace(/\s*\([^)]*\)/g, '').toLowerCase().trim();
        const eEmail = String(e.email || '').toLowerCase().trim();
        return (eName && (eName === lowerName || eName.includes(lowerName) || lowerName.includes(eName))) || (eEmail && eEmail === lowerName);
      });
      if (byNameOrEmail) {
        const empCode = String(byNameOrEmail.employee_code || byNameOrEmail.code || byNameOrEmail.id || '').trim().toUpperCase();
        if (empCode) return empCode;
      }
    }
    if (/^SE-\d{3,4}$/.test(c)) {
      const byCode = allEmps.find(e => String(e.employee_code || e.code || e.id || '').trim().toUpperCase() === c);
      if (byCode) return c;
    }
  } catch (_) {}

  if (EMAIL_TO_SALES_CODE[lowerName]) return EMAIL_TO_SALES_CODE[lowerName];
  if (lowerName.includes('sales.s4') || lowerName.includes('mohith')) return 'SE-004';
  if (lowerName.includes('sales.s1') || lowerName.includes('manoj')) return 'SE-001';
  if (lowerName.includes('sales.s2') || lowerName.includes('prashanth') || lowerName.includes('prasanth')) return 'SE-007';
  if (lowerName.includes('sales.s3') || lowerName.includes('shanthi') || lowerName.includes('santhi')) return 'SE-005';
  if (lowerName.includes('sanjai') || lowerName.includes('sanjay')) return 'SE-002';
  if (lowerName.includes('dhana')) return 'SE-006';
  if (lowerName.includes('pavithra') || lowerName.includes('pavitra')) return 'SE-008';
  if (lowerName.includes('jawahar')) return 'SE-009';
  if (c === 'SE-015' || c === 'SE-VRM004') return 'SE-004';
  if (c === 'SE-VRM002' && lowerName.includes('mohith')) return 'SE-004';
  if (c === 'SH-001' || c === 'SH-VRM001') return 'SE-001';
  if (c === 'SE-020') return 'SE-006';
  if (c === 'SE-010') return 'SE-008';
  if (c === 'SE-VRM090') return 'SE-009';
  if (c === 'SE-VRM006') return 'SE-003';
  if (/^SE-\d{3,4}$/.test(c)) return c;
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

  const rawCode = String(
    pi?.assignedSalespersonCode ||
    pi?.assignedToCode ||
    pi?.assignedToId ||
    pi?.salesPersonCode ||
    pi?.createdById ||
    pi?.sales_person_code ||
    pi?.created_by_id || ''
  ).trim().toUpperCase();

  const canonicalCode = canonicalizeSalespersonCode(rawCode, assignedRaw || primaryRaw || creatorRaw);

  // 1. Dynamic lookup from localStorage employee cache (prioritizes latest edited employee profile names)
  try {
    const empsList = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
    const empsStore = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
    const allEmps = [...(Array.isArray(empsList) ? empsList : []), ...(Array.isArray(empsStore) ? empsStore : [])];

    const targetCode = (canonicalCode || rawCode).toUpperCase().trim();
    if (targetCode) {
      const match = allEmps.find(e => {
        if (!e) return false;
        const c = String(e.employee_code || e.code || e.id || '').toUpperCase().trim();
        const aliases = Array.isArray(e.alias_codes) ? e.alias_codes.map(a => String(a).toUpperCase().trim()) : [];
        return c === targetCode || aliases.includes(targetCode);
      });
      if (match && (match.employee_name || match.name)) {
        return clean(match.employee_name || match.name);
      }
    }
  } catch (_) {}

  // 2. Explicit assigned salesperson takes top priority if valid person name
  if (assignedRaw && !assignedRaw.includes('@') && !nonSales.includes(assignedRaw.toLowerCase())) {
    return assignedRaw;
  }

  // 3. Explicit primary salesperson name if valid person name
  if (primaryRaw && !primaryRaw.includes('@') && !nonSales.includes(primaryRaw.toLowerCase())) {
    return primaryRaw;
  }

  // 4. Fallback to canonical code mapping
  if (canonicalCode && CODE_TO_SALES_NAME[canonicalCode]) {
    return CODE_TO_SALES_NAME[canonicalCode];
  }
  if (rawCode && CODE_TO_SALES_NAME[rawCode]) {
    return CODE_TO_SALES_NAME[rawCode];
  }

  // 5. Collect email candidates (strictly sales staff emails, NEVER pi.email which is customer contact!)
  const emailCandidates = [
    primaryRaw,
    assignedRaw,
    creatorRaw,
    pi?.salesPersonEmail,
    pi?.salespersonEmail,
    pi?.createdByEmail,
    pi?.creatorEmail
  ].map(e => String(e || '').toLowerCase().trim()).filter(e => e.includes('@'));

  // Direct match on known salesperson personal email
  for (const em of emailCandidates) {
    if (EMAIL_TO_SALES_NAME[em]) {
      return EMAIL_TO_SALES_NAME[em];
    }
  }

  // Prefix match for VRM sales mailbox aliases
  for (const em of emailCandidates) {
    if (em.includes('sales.s4')) return 'Mohith JV';
    if (em.includes('sales.s1')) return 'Manojraj Selvaraj';
    if (em.includes('sales.s2')) return 'PRASHANTH';
    if (em.includes('sales.s3')) return 'Shanthi';
  }

  const raw = (!primaryRaw || primaryRaw.includes('@') || nonSales.includes(primaryRaw.toLowerCase()))
    ? (assignedRaw && !assignedRaw.includes('@') && !nonSales.includes(assignedRaw.toLowerCase()) ? assignedRaw : (primaryRaw || creatorRaw))
    : primaryRaw;

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
