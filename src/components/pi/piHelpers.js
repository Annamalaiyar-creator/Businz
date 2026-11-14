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

export const canonicalizeSalespersonCode = (rawCode, name) => {
  const c = String(rawCode || '').trim().toUpperCase();
  if (c.startsWith('TS-')) return c;
  if (c === 'SE-015' || (c === 'SE-VRM002' && String(name || '').toLowerCase().includes('mohith'))) return 'SE-004';
  if (c === 'SH-001' || c === 'SH-VRM001') return 'SE-001';
  if (c === 'SE-020') return 'SE-006';
  if (c === 'SE-010') return 'SE-008';
  if (c === 'SE-VRM090') return 'SE-009';
  if (String(name || '').toLowerCase().includes('mohith')) return 'SE-004';
  if (String(name || '').toLowerCase().includes('sanjai') || String(name || '').toLowerCase().includes('sanjay')) return 'SE-002';
  if (String(name || '').toLowerCase().includes('manoj')) return 'SE-001';
  const lowerName = String(name || '').toLowerCase();
  if (lowerName.includes('kumar') && lowerName.includes('vasanth')) return 'SE-003';
  if (c === 'SE-003' || c === 'SE-VRM006') return 'SE-003';
  if (c === 'SE-004' || c === 'SE-015') return 'SE-004';
  return c || '';
};

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

export const resolvePiSalesPersonName = (pi) => {
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

  const raw = (!primaryRaw || nonSales.includes(primaryRaw.toLowerCase()))
    ? (assignedRaw && !nonSales.includes(assignedRaw.toLowerCase()) ? assignedRaw : (primaryRaw || creatorRaw))
    : primaryRaw;

  const rawCode = String(pi?.assignedSalespersonCode || pi?.salesPersonCode || pi?.createdById || '').trim().toUpperCase();
  const canonicalCode = canonicalizeSalespersonCode(rawCode, raw);

  if (raw.toLowerCase() === 'annamalai' || raw.toLowerCase() === 'ar.annamalaiyar' || raw.toLowerCase() === 'ar annamalaiyar') {
    return 'Annamalaiyar';
  }

  if (canonicalCode && CODE_TO_SALES_NAME[canonicalCode]) {
    if (!raw || nonSales.includes(raw.toLowerCase())) {
      return CODE_TO_SALES_NAME[canonicalCode];
    }
  }
  if (rawCode && CODE_TO_SALES_NAME[rawCode]) {
    if (!raw || nonSales.includes(raw.toLowerCase())) {
      return CODE_TO_SALES_NAME[rawCode];
    }
  }

  if (nonSales.includes(raw.toLowerCase())) {
    if (canonicalCode && CODE_TO_SALES_NAME[canonicalCode]) return CODE_TO_SALES_NAME[canonicalCode];
    if (rawCode && CODE_TO_SALES_NAME[rawCode]) return CODE_TO_SALES_NAME[rawCode];
    return '';
  }
  return raw;
};
