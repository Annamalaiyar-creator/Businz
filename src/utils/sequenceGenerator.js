/**
 * Centralized Financial Year & Sequence Generator Utility for BUSINZ Frontend
 * 
 * Standard Format: VRM-[MODULE]-[YYYY]-[SEQ]
 * Examples:
 *   VRM-PI-2026-01
 *   VRM-PO-2026-01
 *   VRM-BOM-2026-01
 *   VRM-INV-2026-01
 *   VRM-QT-2026-01
 *   VRM-LEAD-2026-01
 *   VRM-DC-2026-01
 *   VRM-GRN-2026-01
 *   VRM-WO-2026-01
 * 
 * Financial Year:
 *   In India, FY runs from April 1 to March 31.
 *   Between 1 Apr 2026 and 31 Mar 2027 => FY is 2026.
 *   On 1 Apr 2027 => FY resets to 2027, and sequence counter restarts from 01.
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
 * Formats a sequence code with standard company prefix, module abbreviation, FY, and 2-digit minimum padding
 * @param {string} moduleType - e.g. 'PI', 'PO', 'BOM', 'INV', 'QT', 'LEAD', 'DC', 'GRN', 'WO'
 * @param {number} seqNumber - Sequential positive integer (1, 2, ..., 99, 100, ..., 2000)
 * @param {Date|string|number} [date=new Date()]
 * @returns {string} e.g. 'VRM-PI-2026-01'
 */
export function formatSequenceCode(moduleType, seqNumber, date = new Date()) {
  const fy = getFinancialYear(date);
  const cleanType = String(moduleType || '').toUpperCase().trim();
  const num = Math.max(1, parseInt(seqNumber, 10) || 1);
  const padded = String(num).padStart(2, '0');
  return `VRM-${cleanType}-${fy}-${padded}`;
}

/**
 * Inspects a list of records and extracts the maximum existing sequence number for a given module and financial year.
 * @param {string} moduleType
 * @param {number} fy
 * @param {Array<Object|string>} records
 * @returns {number} Maximum sequence found (or 0 if none)
 */
export function extractMaxSequence(moduleType, fy, records = []) {
  if (!Array.isArray(records) || records.length === 0) return 0;

  const cleanType = String(moduleType || '').toUpperCase().trim();
  const regex = new RegExp(`^VRM-${cleanType}-${fy}-(\\d+)$`, 'i');
  let maxSeq = 0;

  const candidateKeys = [
    'code', 'bomCode', 'bom_code', 'convertedBomCode', 'converted_bom_code',
    'poNo', 'po_no', 'purchaseorder_number',
    'piNo', 'pi_no', 'estimate_number', 'estimateNo',
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
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        if (Number.isFinite(val) && val > maxSeq) maxSeq = val;
      }
      continue;
    }

    if (typeof item === 'object') {
      for (const key of candidateKeys) {
        const raw = item[key];
        if (raw && typeof raw === 'string') {
          const match = raw.match(regex);
          if (match && match[1]) {
            const val = parseInt(match[1], 10);
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
 * Helper to match any BOM code (both new VRM-BOM-YYYY-XX and legacy BOM-XXX)
 */
export const BOM_CODE_REGEX = /^(?:VRM-BOM-\d{4}-\d+|BOM-\d+)$/i;

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
