/**
 * Centralized Financial Year & Sequence Generator Utility for BUSINZ Frontend
 * 
 * Standard Format: VRMS/[MODULE]/[YY-YY]/[SEQ]
 * Examples:
 *   VRMS/PI/26-27/001
 *   VRMS/BOM/26-27/001
 *   VRMS/LD/26-27/001
 *   VRMS/QT/26-27/001
 *   VRMS/INV/26-27/001
 *   VRMS/DC/26-27/001
 *   VRMS/GRN/26-27/001
 *   VRMS/WO/26-27/001
 * 
 * Financial Year:
 *   In India, FY runs from April 1 to March 31.
 *   Between 1 Apr 2026 and 31 Mar 2027 => FY is 2026, rendered as "26-27".
 *   On 1 Apr 2027 => FY resets to 2027 ("27-28"), and sequence counter restarts from 001.
 */

/**
 * Returns current Indian Financial Year (starts April 1st)
 * @param {Date|string|number} [date=new Date()]
 * @returns {number} 4-digit financial year start (e.g. 2026)
 */
export function getFinancialYear(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1 (Jan) to 12 (Dec)
  return month >= 4 ? year : year - 1;
}

/**
 * Returns two-digit financial year code string, e.g. "26-27"
 * @param {Date|string|number} [date=new Date()]
 * @returns {string} e.g. "26-27"
 */
export function getFinancialYearCode(date = new Date()) {
  const fy = getFinancialYear(date);
  const yy = fy % 100;
  const nextYy = (yy + 1) % 100;
  return `${String(yy).padStart(2, '0')}-${String(nextYy).padStart(2, '0')}`;
}

/**
 * Formats a sequence code with standard company prefix VRMS, module abbreviation, FY (YY-YY), and 3-digit padding
 * @param {string} moduleType - e.g. 'PI', 'PO', 'BOM', 'INV', 'QT', 'LD'/'LEAD', 'DC', 'GRN', 'WO'
 * @param {number} seqNumber - Sequential positive integer (1, 2, ..., 99, 100, ..., 2000)
 * @param {Date|string|number} [date=new Date()]
 * @returns {string} e.g. 'VRMS/PI/26-27/001'
 */
export function formatSequenceCode(moduleType, seqNumber, date = new Date()) {
  const fyCode = getFinancialYearCode(date);
  let cleanType = String(moduleType || '').toUpperCase().trim();
  if (cleanType === 'LEAD' || cleanType === 'LD') {
    cleanType = 'LD';
  } else if (cleanType === 'CS' || cleanType === 'CUST' || cleanType === 'CUSTOMER') {
    cleanType = 'CS';
  } else if (cleanType === 'QUOTE' || cleanType === 'QUOTATION' || cleanType === 'QT') {
    cleanType = 'QT';
  } else if (cleanType === 'DC' || cleanType === 'JW') {
    cleanType = 'JW';
  }
  const num = Math.max(1, parseInt(seqNumber, 10) || 1);
  const padded = String(num).padStart(3, '0');
  return `VRMS/${cleanType}/${fyCode}/${padded}`;
}

/**
 * Inspects a list of records and extracts the maximum existing sequence number for a given module and financial year.
 * Seamlessly matches BOTH new format (VRMS/PI/26-27/001) and legacy format (VRM-PI-2026-01).
 * @param {string} moduleType
 * @param {number} fy
 * @param {Array<Object|string>} records
 * @returns {number} Maximum sequence found (or 0 if none)
 */
export function extractMaxSequence(moduleType, fy, records = []) {
  if (!Array.isArray(records) || records.length === 0) return 0;

  const yy = fy % 100;
  const nextYy = (yy + 1) % 100;
  const fyCode = `${String(yy).padStart(2, '0')}-${String(nextYy).padStart(2, '0')}`;

  let cleanType = String(moduleType || '').toUpperCase().trim();
  let typePattern = cleanType;
  if (cleanType === 'LEAD' || cleanType === 'LD') {
    typePattern = '(?:LD|LEAD)';
  } else if (cleanType === 'CS' || cleanType === 'CUST' || cleanType === 'CUSTOMER') {
    typePattern = '(?:CS|CUST|CUSTOMER)';
  } else if (cleanType === 'QUOTE' || cleanType === 'QUOTATION' || cleanType === 'QT') {
    typePattern = '(?:QT|QUOTE|QUOTATION)';
  } else if (cleanType === 'DC' || cleanType === 'JW') {
    typePattern = '(?:JW|DC)';
  }

  // Matches VRMS/[TYPE]/26-27/001 OR VRM-[TYPE]-2026-01
  const regex = new RegExp(`^(?:VRMS\/${typePattern}\/(?:${fyCode}|${fy})\/(\\d+)|VRM-${typePattern}-${fy}-(\\d+))$`, 'i');
  let maxSeq = 0;

  const candidateKeys = [
    'code', 'bomCode', 'bom_code', 'convertedBomCode', 'converted_bom_code',
    'customerCode', 'customer_code', 'customerId',
    'poNo', 'po_no', 'purchaseorder_number',
    'piNo', 'pi_no', 'estimate_number', 'estimateNo',
    'sourcePiNo', 'source_pi_no',
    'invNo', 'invoiceNo', 'invoice_no',
    'quoteNumber', 'quoteNo', 'quote_no',
    'leadNumber', 'leadId', 'lead_number',
    'dcNo', 'dc_no', 'challanNo', 'challan_no',
    'grnNo', 'grn_no',
    'woNo', 'workOrderNo', 'work_order_no',
    'id'
  ];

  for (const item of records) {
    if (!item) continue;
    if (typeof item === 'string') {
      const match = item.match(regex);
      if (match) {
        const val = parseInt(match[1] || match[2], 10);
        if (Number.isFinite(val) && val > maxSeq) maxSeq = val;
      }
      continue;
    }

    if (typeof item === 'object') {
      for (const key of candidateKeys) {
        const raw = item[key];
        if (raw && typeof raw === 'string') {
          const match = raw.match(regex);
          if (match) {
            const val = parseInt(match[1] || match[2], 10);
            if (Number.isFinite(val) && val > maxSeq) maxSeq = val;
          }
        }
      }
    }
  }

  return maxSeq;
}

/**
 * Generates next sequence code for a given module
 * @param {string} moduleType
 * @param {Array<Object|string>} records
 * @param {Date|string|number} [date=new Date()]
 * @returns {{ code: string, nextNum: number, financialYear: number }}
 */
export function getNextSequence(moduleType, records = [], date = new Date()) {
  const fy = getFinancialYear(date);
  const maxSeq = extractMaxSequence(moduleType, fy, records);
  const nextNum = maxSeq + 1;
  const code = formatSequenceCode(moduleType, nextNum, date);
  return { code, nextNum, financialYear: fy };
}

/**
 * Helper to match any BOM code (both new VRMS/BOM/YY-YY/XXX, legacy VRM-BOM-YYYY-XX and BOM-XXX)
 */
export const BOM_CODE_REGEX = /^(?:VRMS\/BOM\/\d{2}-\d{2}\/\d+|VRM-BOM-\d{4}-\d+|BOM-\d+)$/i;

/**
 * Helper to match any Invoice code (both new VRM-INV-YYYY-XX and legacy INV-XXXXXX)
 */
export const INV_CODE_REGEX = /^(?:VRM-INV-\d{4}-\d+|INV-\d+)$/i;

/**
 * Helper to match any PO code (both new VRM-PO-YYYY-XX and legacy PO-XXXXX)
 */
export const PO_CODE_REGEX = /^(?:VRM-PO-\d{4}-\d+|PO-\d+)$/i;

/**
 * Helper to match any PI code (both new VRM-PI-YYYY-XX and legacy PI-XXXXX)
 */
export const PI_CODE_REGEX = /^(?:VRM-PI-\d{4}-\d+|PI-\d+|VRMS\/PI\/\d{2}-\d{2}\/\d+)$/i;

/**
 * Universal BOM Sequence Number Parser.
 * Accurately extracts the numeric order/sequence from any BOM code format:
 * - VRM-BOM-2026-999 -> 999
 * - VRM-BOM-2026-22  -> 22
 * - BOM-2026-999     -> 999
 * - BOM-999          -> 999
 * - BOM-22           -> 22
 * - VRM-BOM-26-27-519-> 519
 * - VRM-INV-2026-999 -> 999
 */
/**
 * Normalizes/trims BOM codes without overriding legacy BOM codes onto active sequence numbers.
 */
export function normalizeBomCode(code) {
  if (!code) return '';
  return String(code).trim();
}

export function parseBomSequenceNumber(code) {
  if (!code) return 0;
  const str = String(code).trim();
  const terminalMatch = str.match(/[-/_](\d+)$/);
  if (terminalMatch) return parseInt(terminalMatch[1], 10);
  
  const bomMatch = str.match(/BOM.*?(\d+)(?!.*\d)/i);
  if (bomMatch) return parseInt(bomMatch[1], 10);

  const allNums = str.match(/\d+/g);
  if (allNums && allNums.length > 0) {
    return parseInt(allNums[allNums.length - 1], 10);
  }
  return 0;
}

/**
 * Extracts the terminal sequence digits from a BOM/PI/Invoice/DC code,
 * ignoring financial-year prefixes like `26-27` when a trailing sequence number exists.
 */
export function extractCodeSequenceDigits(code) {
  if (!code) return '';
  const str = String(code).trim();
  if (!str) return '';
  if (/^\d+$/.test(str)) return str;

  const terminalMatch = str.match(/[-/_](\d+)$/);
  if (terminalMatch) return terminalMatch[1];

  const allNums = str.match(/\d+/g);
  if (allNums && allNums.length > 0) {
    return allNums[allNums.length - 1];
  }
  return '';
}

/**
 * Ranks a numeric-only search query against code candidates and non-monetary text candidates.
 * Returns:
 *   1 = exact sequence match
 *   2 = prefix sequence match
 *   3 = substring sequence match
 *   4 = substring match in non-monetary text (e.g. customer name, vehicle number, phone)
 *   0 = no match
 */
export function getNumericSearchMatchRank(queryDigits, codeCandidates = [], textCandidates = []) {
  const q = String(queryDigits || '').trim();
  if (!/^\d+$/.test(q)) return 0;
  const qUnpadded = String(parseInt(q, 10));

  let bestCodeRank = 0;
  for (let i = 0; i < codeCandidates.length; i++) {
    const raw = codeCandidates[i];
    if (!raw) continue;
    const seq = extractCodeSequenceDigits(raw);
    if (!seq) continue;
    const seqUnpadded = String(parseInt(seq, 10));

    let rank = 0;
    if (seq === q || seqUnpadded === qUnpadded) {
      rank = 1;
    } else if (seq.startsWith(q) || (q.length >= 2 && seqUnpadded.startsWith(qUnpadded))) {
      rank = 2;
    } else if (seq.includes(q)) {
      rank = 3;
    }

    if (rank > 0 && (bestCodeRank === 0 || rank < bestCodeRank)) {
      bestCodeRank = rank;
      if (bestCodeRank === 1) return 1;
    }
  }
  if (bestCodeRank > 0) return bestCodeRank;

  for (let i = 0; i < textCandidates.length; i++) {
    const val = textCandidates[i];
    if (!val) continue;
    if (String(val).toLowerCase().includes(q.toLowerCase())) {
      return 4;
    }
  }
  return 0;
}

/**
 * Safely parses any date candidate from a BOM record into an epoch timestamp (ms).
 */
export function parseBomDateTimestamp(item) {
  if (!item) return 0;
  if (typeof item === 'number' && !isNaN(item)) return item;

  const candidates = [
    item.salesConfirmedAt,
    item.sales_confirmed_at,
    item.createdAt,
    item.created_at,
    item.updatedAt,
    item.updated_at,
    item.appliedAt,
    item.bomDate,
    item.date,
    item.dateTimeObj?.combined,
    item.dateTimeObj?.date
  ];

  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === 'number' && !isNaN(c)) return c;
    if (c instanceof Date && !isNaN(c.getTime())) return c.getTime();
    const s = String(c).trim();
    if (!s || s === '—' || s === '-' || s === '[object Object]') continue;

    // Check DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY format
    const ddmmyyyy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(.*)$/);
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1], 10);
      const month = parseInt(ddmmyyyy[2], 10) - 1;
      const year = parseInt(ddmmyyyy[3], 10);
      const rest = ddmmyyyy[4].trim();
      if (rest) {
        const parsedRest = new Date(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} ${rest}`);
        if (!isNaN(parsedRest.getTime())) return parsedRest.getTime();
      }
      return new Date(year, month, day).getTime();
    }

    const t = new Date(s).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
}

/**
 * Comparator to sort BOM records in descending order.
 * Ensures the most recently created orders (Today > Yesterday > Older) appear at the top,
 * and within the same calendar day breaks ties with sequential BOM number or exact timestamp.
 */
export function compareBomDescending(a, b) {
  const dateA = parseBomDateTimestamp(a);
  const dateB = parseBomDateTimestamp(b);

  if (dateA > 0 && dateB === 0) return -1;
  if (dateA === 0 && dateB > 0) return 1;

  if (dateA > 0 && dateB > 0) {
    const da = new Date(dateA);
    const db = new Date(dateB);
    const dayKeyA = `${da.getFullYear()}-${String(da.getMonth() + 1).padStart(2, '0')}-${String(da.getDate()).padStart(2, '0')}`;
    const dayKeyB = `${db.getFullYear()}-${String(db.getMonth() + 1).padStart(2, '0')}-${String(db.getDate()).padStart(2, '0')}`;

    // If on different calendar days, the newer day ALWAYS comes first
    if (dayKeyA !== dayKeyB) {
      return dayKeyB.localeCompare(dayKeyA);
    }

    // Within the same calendar day, if timestamps differ significantly (>= 1 minute), sort by timestamp descending
    if (Math.abs(dateB - dateA) >= 60000) {
      return dateB - dateA;
    }
  }

  // Same day or equal timestamps or no date: sort by sequence number descending
  const codeA = a?.bomCode || a?.code || a?.poNo || a?.invNo || a?.id || '';
  const codeB = b?.bomCode || b?.code || b?.poNo || b?.invNo || b?.id || '';
  const seqA = parseBomSequenceNumber(codeA);
  const seqB = parseBomSequenceNumber(codeB);
  if (seqA !== seqB) {
    return seqB - seqA;
  }
  return (dateB || 0) - (dateA || 0);
}

