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
 * Comparator to sort BOM records in descending order (highest BOM number first, e.g. 999, 998, 997...).
 * Ensures newly created BOMs automatically appear at the very top.
 */
export function compareBomDescending(a, b) {
  const codeA = a?.bomCode || a?.code || a?.poNo || a?.invNo || a?.id || '';
  const codeB = b?.bomCode || b?.code || b?.poNo || b?.invNo || b?.id || '';
  const seqA = parseBomSequenceNumber(codeA);
  const seqB = parseBomSequenceNumber(codeB);
  if (seqA !== seqB) {
    return seqB - seqA; // Descending
  }
  const dateA = new Date(a?.salesConfirmedAt || a?.date || a?.createdAt || 0).getTime() || 0;
  const dateB = new Date(b?.salesConfirmedAt || b?.date || b?.createdAt || 0).getTime() || 0;
  return dateB - dateA;
}

