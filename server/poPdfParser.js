import { PDFParse } from 'pdf-parse';

const MONTHS = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12'
};

const UNIT_SET = new Set([
  'NOS', 'NO', 'PCS', 'PC', 'KG', 'KGS', 'MT', 'TON', 'TONS', 'MTR', 'MTRS', 'M',
  'FT', 'SQFT', 'SQM', 'SET', 'SETS', 'BOX', 'BOXES', 'PKT', 'PACK', 'LOT', 'BAG',
  'BAGS', 'LTR', 'LTRS', 'ROLL', 'ROLLS', 'LENGTH', 'LENGTHS', 'BAR', 'BARS', 'PAIR', 'PAIRS', 'UNIT', 'UNITS'
]);

// Matches 15-char Indian GSTIN even if Zoho concatenates a phone number directly after it
const GSTIN_PATTERN = /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]/g;
const OWN_COMPANY_GSTINS = new Set(['33AAGCV4262N1ZZ']);

// Matches Indian (2,40,000.00) and international (240,000.00) numbers
const NUM_TOKEN = '(?:\\d{1,3}(?:,\\d{2,3})+|\\d+)(?:\\.\\d+)?';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function parseDateToISO(raw) {
  if (!raw) return '';
  const s = String(raw).trim().replace(/,/g, ' ').replace(/\s+/g, ' ');

  // YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) {
    const [, y, mo, d] = m;
    if (Number(mo) >= 1 && Number(mo) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${y}-${pad2(mo)}-${pad2(d)}`;
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  m = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    if (Number(mo) >= 1 && Number(mo) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${y}-${pad2(mo)}-${pad2(d)}`;
    }
  }

  // DD MMM YYYY
  m = s.match(/\b(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s-]+(20\d{2}|\d{2})\b/);
  if (m) {
    let [, d, monStr, y] = m;
    const mo = MONTHS[monStr.toLowerCase()];
    if (mo) {
      if (y.length === 2) y = `20${y}`;
      return `${y}-${mo}-${pad2(d)}`;
    }
  }

  // MMM DD YYYY
  m = s.match(/\b([A-Za-z]{3,9})[\s-]+(\d{1,2})[\s-]+(20\d{2}|\d{2})\b/);
  if (m) {
    let [, monStr, d, y] = m;
    const mo = MONTHS[monStr.toLowerCase()];
    if (mo) {
      if (y.length === 2) y = `20${y}`;
      return `${y}-${mo}-${pad2(d)}`;
    }
  }

  return '';
}

function parseNumber(val) {
  if (val === null || val === undefined) return 0;
  const cleaned = String(val).replace(/[₹$,\s%]/g, '').trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function mapPaymentTerms(raw) {
  if (!raw) return { paymentTerms: '', advancePaidPct: null };
  const s = String(raw).trim();
  const lower = s.toLowerCase();

  if (lower.includes('advance') || /\d{1,3}\s*%\s*(?:payment|along\s+with|with\s+po|before)/i.test(lower)) {
    const pctMatch = lower.match(/(\d{1,3})\s*%/);
    return {
      paymentTerms: 'Advance',
      advancePaidPct: pctMatch ? Math.min(100, Math.max(0, Number(pctMatch[1]))) : null
    };
  }
  if (lower.includes('immediate') || lower.includes('due on receipt') || lower.includes('against delivery') || lower.includes('before dispatch') || lower.includes('cod') || lower.includes('cash')) {
    return { paymentTerms: 'Immediate', advancePaidPct: null };
  }
  if (/\b60\b/.test(lower)) return { paymentTerms: 'Net 60 Days', advancePaidPct: null };
  if (/\b45\b/.test(lower)) return { paymentTerms: 'Net 45 Days', advancePaidPct: null };
  if (/\b30\b/.test(lower)) return { paymentTerms: 'Net 30 Days', advancePaidPct: null };
  if (/\b15\b/.test(lower)) return { paymentTerms: '15 Days Net', advancePaidPct: null };
  if (/\b7\b/.test(lower)) return { paymentTerms: '7 Days', advancePaidPct: null };
  return { paymentTerms: '', advancePaidPct: null };
}

function normalizeUnit(u) {
  const up = String(u || 'NOS').toUpperCase().replace(/\./g, '').trim();
  if (up === 'NO' || up === 'PCS' || up === 'PC' || up === 'UNITS' || up === 'UNIT') return 'NOS';
  if (up === 'KGS') return 'KG';
  if (up === 'TON' || up === 'TONS') return 'MT';
  if (up === 'MTRS' || up === 'M') return 'MTR';
  return up || 'NOS';
}

function extractLabeledLine(lines, labelPatterns) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pat of labelPatterns) {
      const m = line.match(pat);
      if (m) {
        const val = (m[1] || '').trim().replace(/^[:\-#\s]+/, '').trim();
        if (val) return val;
        if (lines[i + 1] && !/^(po\s*(no|number|date)|date|delivery|billing|gst|vendor|supplier|item|s\.?\s*no|#)/i.test(lines[i + 1])) {
          return lines[i + 1].trim();
        }
      }
    }
  }
  return '';
}

function extractDocumentTaxRate(rawText) {
  // IGST18 (18%) or IGST @ 18%
  const igst = rawText.match(/\bIGST\s*\d*\s*\(?\s*(\d{1,2}(?:\.\d+)?)\s*%\s*\)?/i);
  if (igst) return Number(igst[1]);

  // CGST9 (9%) + SGST9 (9%) => 18%
  const cgst = rawText.match(/\bCGST\s*\d*\s*\(?\s*(\d{1,2}(?:\.\d+)?)\s*%\s*\)?/i);
  const sgst = rawText.match(/\bSGST\s*\d*\s*\(?\s*(\d{1,2}(?:\.\d+)?)\s*%\s*\)?/i);
  if (cgst && sgst) return Number(cgst[1]) + Number(sgst[1]);
  if (cgst) return Number(cgst[1]) * 2;

  const gst = rawText.match(/\bGST\s*@?\s*\(?\s*(\d{1,2}(?:\.\d+)?)\s*%\s*\)?/i);
  if (gst) return Number(gst[1]);

  return 18;
}

function extractBlockLines(lines, headerRegex, stopRegex, maxLines = 10) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(headerRegex);
    if (!m) continue;
    const collected = [];
    const inlineRest = (m[1] || '').trim().replace(/^[:\-\s]+/, '').trim();
    if (inlineRest && !stopRegex.test(inlineRest)) {
      collected.push(inlineRest);
    }
    for (let j = i + 1; j < Math.min(lines.length, i + 1 + maxLines); j++) {
      const next = lines[j].trim();
      if (!next) {
        if (collected.length > 0) break;
        continue;
      }
      if (stopRegex.test(next)) break;
      collected.push(next);
    }
    if (collected.length > 0) return collected;
  }
  return [];
}

function extractVendorSection(lines) {
  const stopRegex = /^(?:deliver\s*to|delivery\s*address|ship\s*to|shipping\s*address|bill\s*to|p\.?o\.?\s*(?:no|number|date)|purchase\s*order|date\s*:|ref#|#\s*item|item\s*&\s*description|s\.?\s*no)/i;
  const block = extractBlockLines(
    lines,
    /^(?:vendor\s*address|supplier\s*address|bill\s*from)\s*[:\-]?(.*)$/i,
    stopRegex,
    10
  );

  let vendorName = '';
  let vendorGstin = '';
  let contactNo = '';
  const addrLines = [];

  for (let i = 0; i < block.length; i++) {
    const ln = block[i];
    if (/^msme|^udyam/i.test(ln)) continue;

    // Check for GSTIN line (may have phone concatenated like "GSTIN 32AAACV7795C1ZA95664 96888")
    const gstMatch = ln.match(/([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])/i);
    if (gstMatch) {
      vendorGstin = gstMatch[1].toUpperCase();
      const afterGst = ln.slice(ln.indexOf(gstMatch[1]) + 15).trim();
      const digitsAfter = afterGst.replace(/[^\d]/g, '');
      if (digitsAfter.length >= 10 && digitsAfter.length <= 13) {
        contactNo = digitsAfter.slice(-10);
      }
      continue;
    }

    if (!vendorName) {
      vendorName = ln;
    } else {
      addrLines.push(ln);
    }
  }

  return {
    vendorName,
    vendorGstin,
    contactNo,
    billingAddress: addrLines.join(', ').replace(/\s*,\s*,+/g, ', ').trim()
  };
}

function extractDeliverToSection(lines) {
  const stopRegex = /^(?:vendor\s*address|supplier\s*address|bill\s*from|gstin|msme|udyam|date\s*:|ref#|#\s*item|item\s*&\s*description|s\.?\s*no)/i;
  const block = extractBlockLines(
    lines,
    /^(?:deliver\s*to|delivery\s*address|ship\s*to|shipping\s*address)\s*[:\-]?(.*)$/i,
    stopRegex,
    10
  );
  if (block.length === 0) return '';

  // Drop buyer company name line if it's the first line (e.g. "VRM Structures India Pvt Ltd")
  const filtered = block.filter((ln, idx) => {
    if (idx === 0 && /vrm\s*structures/i.test(ln)) return false;
    if (/^gstin|^msme|^udyam/i.test(ln)) return false;
    return true;
  });

  return filtered.join(', ').replace(/\s*,\s*,+/g, ', ').trim();
}

function extractTermsBlock(lines) {
  const stopRegex = /^(?:authorized\s*signat|for\s+vrm\s*structures|page\s+\d+|sub\s*total|grand\s*total)/i;
  const block = extractBlockLines(
    lines,
    /^terms\s*(?:&|and)\s*conditions?\s*[:\-]?(.*)$/i,
    stopRegex,
    25
  );
  return block.join('\n').trim();
}

function parseItemsFromTables(tables, defaultTax = 18) {
  const extracted = [];
  if (!Array.isArray(tables)) return extracted;

  for (const table of tables) {
    const rows = Array.isArray(table) ? table : (Array.isArray(table?.rows) ? table.rows : []);
    if (rows.length < 2) continue;

    let headerIdx = -1;
    let colMap = {};
    for (let r = 0; r < Math.min(rows.length, 4); r++) {
      const cells = (rows[r] || []).map(c => String(c || '').toLowerCase().replace(/\s+/g, ' ').trim());
      const joined = cells.join(' ');
      if ((joined.includes('item') || joined.includes('description') || joined.includes('particular')) &&
          (joined.includes('qty') || joined.includes('quantity') || joined.includes('rate') || joined.includes('price'))) {
        headerIdx = r;
        cells.forEach((cell, idx) => {
          if (colMap.name === undefined && (cell.includes('item') || cell.includes('description') || cell.includes('particular') || cell.includes('material'))) {
            colMap.name = idx;
          } else if (colMap.hsn === undefined && (cell.includes('hsn') || cell.includes('sac'))) {
            colMap.hsn = idx;
          } else if (colMap.qty === undefined && (cell.includes('qty') || cell.includes('quantity'))) {
            colMap.qty = idx;
          } else if (colMap.unit === undefined && (cell.includes('unit') || cell.includes('uom'))) {
            colMap.unit = idx;
          } else if (colMap.rate === undefined && (cell.includes('rate') || cell.includes('price') || cell.includes('unit cost'))) {
            colMap.rate = idx;
          } else if (colMap.tax === undefined && (cell.includes('tax') || cell.includes('gst'))) {
            colMap.tax = idx;
          }
        });
        break;
      }
    }

    if (headerIdx === -1 || colMap.name === undefined) continue;

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const rawCell = String(row[colMap.name] || '').trim();
      if (!rawCell || /^(sub\s*total|total|grand\s*total|cgst|sgst|igst|tax|discount|shipping|freight|round)/i.test(rawCell)) {
        continue;
      }
      const cellLines = rawCell.split('\n').map(s => s.trim()).filter(Boolean);
      const name = cellLines[0] || rawCell;
      const description = cellLines.slice(1).join(' ').trim();

      const rawQty = colMap.qty !== undefined ? String(row[colMap.qty] || '').trim() : '';
      const qtyNumMatch = rawQty.match(new RegExp(NUM_TOKEN));
      const qty = qtyNumMatch ? parseNumber(qtyNumMatch[0]) : 0;
      let unit = colMap.unit !== undefined ? String(row[colMap.unit] || '').trim() : '';
      if (!unit && rawQty) {
        const uMatch = rawQty.match(/([A-Za-z]+)\s*$/);
        if (uMatch && UNIT_SET.has(uMatch[1].toUpperCase())) {
          unit = uMatch[1];
        }
      }

      const rate = colMap.rate !== undefined ? parseNumber(row[colMap.rate]) : 0;
      const taxRaw = colMap.tax !== undefined ? String(row[colMap.tax] || '') : '';
      const taxMatch = taxRaw.match(/(\d+(?:\.\d+)?)\s*%?/);
      const tax = taxMatch ? Number(taxMatch[1]) : defaultTax;
      const hsn = colMap.hsn !== undefined ? String(row[colMap.hsn] || '').replace(/[^0-9]/g, '') : '';

      if (qty <= 0 && rate <= 0) continue;

      extracted.push({
        name,
        description,
        hsn,
        account: 'Raw Material',
        qty: qty > 0 ? qty : 1,
        unit: normalizeUnit(unit || 'NOS'),
        rate: rate >= 0 ? rate : 0,
        tax: Number.isFinite(tax) ? tax : defaultTax
      });
    }
  }

  return extracted;
}

function parseZohoMultiLineItems(lines, defaultTax = 18) {
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/(item|description|particular)/i.test(l) && /(qty|quantity)/i.test(l) && /(rate|amount|price)/i.test(l)) {
      startIdx = i + 1;
      break;
    }
  }
  if (startIdx === -1) return [];

  // Collect all table lines until summary / terms / signature
  const tableLines = [];
  for (let i = startIdx; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    if (/^(?:sub\s*total|grand\s*total|total\b|igst\d*|cgst\d*|sgst\d*|terms\s*(?:&|and)\s*conditions?|notes?\s*:|authorized\s*signat|shipping\s*charges?)/i.test(l)) {
      break;
    }
    tableLines.push(l);
  }
  if (tableLines.length === 0) return [];

  // First try single-line item pattern (generic POs with Indian/standard commas)
  const singleLineRegex = new RegExp(
    `^(?:\\d{1,3}[.)]?\\s+)?(.+?)\\s+(?:(\\d{4,8})\\s+)?(${NUM_TOKEN})\\s*(NOS|NO|PCS|PC|KG|KGS|MT|TON|TONS|MTR|MTRS|M|FT|SQFT|SQM|SET|SETS|BOX|PKT|LOT|BAG|LTR|ROLL|LENGTH|BAR|PAIR|UNIT|UNITS)?\\s+(?:₹|Rs\\.?\\s*)?(${NUM_TOKEN})\\s+(?:(\\d{1,2}(?:\\.\\d+)?)\\s*%\\s+)?(?:₹|Rs\\.?\\s*)?(${NUM_TOKEN})$`,
    'i'
  );

  const singleLineItems = [];
  for (const l of tableLines) {
    const m = l.match(singleLineRegex);
    if (!m) continue;
    const [, rawName, hsn, qtyStr, unitStr, rateStr, taxStr] = m;
    const cleanName = rawName.trim();
    if (!cleanName || /^(sub\s*total|total|cgst|sgst|igst|discount|shipping|freight)/i.test(cleanName)) continue;
    const qty = parseNumber(qtyStr);
    const rate = parseNumber(rateStr);
    const tax = taxStr !== undefined ? Number(taxStr) : defaultTax;
    if (qty > 0 || rate > 0) {
      singleLineItems.push({
        name: cleanName,
        description: '',
        hsn: hsn || '',
        account: 'Raw Material',
        qty: qty > 0 ? qty : 1,
        unit: normalizeUnit(unitStr || 'NOS'),
        rate: rate >= 0 ? rate : 0,
        tax: Number.isFinite(tax) ? tax : defaultTax
      });
    }
  }
  if (singleLineItems.length > 0) return singleLineItems;

  // Multi-line Zoho Books item blocks:
  // Starts with "<itemNo> <Item Name>" (where itemNo increments 1, 2, 3...)
  // Followed by description lines, then HSN+Qty line, optional unit line, and Rate+Amount line.
  const blocks = [];
  let current = null;
  let expectedNo = 1;

  for (const l of tableLines) {
    const startMatch = l.match(/^(\d{1,3})\s+([A-Za-z].*)$/);
    if (startMatch && Number(startMatch[1]) === expectedNo) {
      if (current) blocks.push(current);
      current = {
        name: startMatch[2].trim(),
        lines: []
      };
      expectedNo += 1;
    } else if (current) {
      current.lines.push(l);
    }
  }
  if (current) blocks.push(current);

  const hsnQtyRegex = new RegExp(`^(\\d{4,8})\\s+(${NUM_TOKEN})(?:\\s*([A-Za-z]+))?$`);
  const rateAmtRegex = new RegExp(`^(?:₹|Rs\\.?\\s*)?(${NUM_TOKEN})\\s+(?:₹|Rs\\.?\\s*)?(${NUM_TOKEN})$`);
  const hsnQtyRateAmtRegex = new RegExp(`^(\\d{4,8})\\s+(${NUM_TOKEN})\\s*(?:([A-Za-z]+)\\s+)?(?:₹|Rs\\.?\\s*)?(${NUM_TOKEN})\\s+(?:₹|Rs\\.?\\s*)?(${NUM_TOKEN})$`);

  const items = [];
  for (const blk of blocks) {
    let hsn = '';
    let qty = 0;
    let unit = '';
    let rate = 0;
    const descLines = [];

    for (const ln of blk.lines) {
      // Combined HSN Qty [Unit] Rate Amount on one line
      const combined = ln.match(hsnQtyRateAmtRegex);
      if (combined) {
        hsn = combined[1];
        qty = parseNumber(combined[2]);
        if (combined[3] && UNIT_SET.has(combined[3].toUpperCase())) unit = combined[3];
        rate = parseNumber(combined[4]);
        continue;
      }

      // HSN + Qty (e.g. "76109010 500.00")
      const hq = ln.match(hsnQtyRegex);
      if (hq) {
        hsn = hq[1];
        qty = parseNumber(hq[2]);
        if (hq[3] && UNIT_SET.has(hq[3].toUpperCase())) unit = hq[3];
        continue;
      }

      // Standalone unit line (e.g. "mtr", "nos", "kg")
      if (!unit && UNIT_SET.has(ln.toUpperCase().replace(/\./g, ''))) {
        unit = ln;
        continue;
      }

      // Rate + Amount line (e.g. "480.00 2,40,000.00")
      const ra = ln.match(rateAmtRegex);
      if (ra && qty > 0) {
        rate = parseNumber(ra[1]);
        continue;
      }

      descLines.push(ln);
    }

    if (blk.name && (qty > 0 || rate > 0)) {
      items.push({
        name: blk.name,
        description: descLines.join(' ').replace(/\s+/g, ' ').trim(),
        hsn,
        account: 'Raw Material',
        qty: qty > 0 ? qty : 1,
        unit: normalizeUnit(unit || 'NOS'),
        rate: rate >= 0 ? rate : 0,
        tax: defaultTax
      });
    }
  }

  return items;
}

async function parsePoPdfBuffer(pdfBuffer) {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new Error('Empty PDF buffer provided.');
  }
  if (pdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('Uploaded file is not a valid PDF document.');
  }

  const parser = new PDFParse({ data: pdfBuffer });
  let textResult;
  let tableResult = null;
  try {
    textResult = await parser.getText();
    try {
      tableResult = await parser.getTable();
    } catch (_) {
      tableResult = null;
    }
  } finally {
    await parser.destroy().catch(() => {});
  }

  const rawText = String(textResult?.text || '').replace(/\r/g, '');
  const lines = rawText
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const nonSpaceChars = rawText.replace(/\s+/g, '').length;
  if (nonSpaceChars < 25) {
    return {
      scannedWarning: true,
      poNumberSkipped: true,
      extractedFields: [],
      data: {
        poDate: '',
        deliveryDate: '',
        vendorName: '',
        vendorGstin: '',
        contactPerson: '',
        contactNo: '',
        email: '',
        deliveryAddress: '',
        billingAddress: '',
        paymentTerms: '',
        advancePaidPct: null,
        shippingCharges: 0,
        discountPct: 0,
        notes: '',
        terms: '',
        items: []
      },
      rawTextPreview: ''
    };
  }

  const defaultTax = extractDocumentTaxRate(rawText);

  // 1. Dates (strictly ignore PO Number!)
  const rawPoDate = extractLabeledLine(lines, [
    /(?:p\.?o\.?\s*date|purchase\s*order\s*date|order\s*date)\s*[:\-]?\s*(.+)$/i,
    /^date\s*[:\-]\s*(.+)$/i,
    /\bdate\s*:\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})/i,
    /^dated\s*[:\-]?\s*(.+)$/i
  ]);
  const poDate = parseDateToISO(rawPoDate);

  const rawDeliveryDate = extractLabeledLine(lines, [
    /(?:delivery\s*date|expected\s*delivery(?:\s*date)?|expected\s*shipment\s*date|required\s*by|due\s*date)\s*[:\-]?\s*(.+)$/i
  ]);
  const deliveryDate = parseDateToISO(rawDeliveryDate);

  // 2. Vendor Section (Zoho Books "Vendor Address" block + generic labels)
  const vendorSection = extractVendorSection(lines);
  let vendorName = vendorSection.vendorName || extractLabeledLine(lines, [
    /(?:vendor\s*name|supplier\s*name)\s*[:\-]?\s*(.+)$/i,
    /^(?:vendor|supplier)\s*[:\-]\s*(.+)$/i,
    /^m\/s\.?\s+(.+)$/i
  ]);
  if (vendorName && /vrm\s*structures/i.test(vendorName)) {
    vendorName = '';
  }

  const contactPerson = extractLabeledLine(lines, [
    /(?:contact\s*person|kind\s*attn|attn|attention)\s*[:\-]?\s*(.+)$/i
  ]);

  const rawPhone = extractLabeledLine(lines, [
    /(?:phone|mobile|contact\s*no\.?|tel)\s*[:\-]?\s*([+\d][\d\s\-()]{7,18})/i
  ]);
  const contactNo = vendorSection.contactNo || (rawPhone ? rawPhone.replace(/[^\d+]/g, '').slice(-13) : '');

  const emailMatch = rawText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  const email = emailMatch ? emailMatch[0] : '';

  // 3. Vendor GSTIN (skip VRM's own GSTIN)
  let vendorGstin = vendorSection.vendorGstin;
  if (!vendorGstin) {
    const gstLine = extractLabeledLine(lines, [
      /(?:vendor\s*gst(?:in)?|supplier\s*gst(?:in)?)\s*[:\-]?\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])/i
    ]);
    if (gstLine) {
      vendorGstin = gstLine.toUpperCase();
    } else {
      const allGstins = [...new Set((rawText.match(GSTIN_PATTERN) || []).map(g => g.toUpperCase()))];
      vendorGstin = allGstins.find(g => !OWN_COMPANY_GSTINS.has(g)) || '';
    }
  }

  // 4. Addresses
  const deliveryAddress = extractDeliverToSection(lines);
  const billingAddress = vendorSection.billingAddress;

  // 5. Terms & Conditions + Payment Terms
  const terms = extractTermsBlock(lines) || extractLabeledLine(lines, [
    /^(?:terms\s*(?:&|and)\s*conditions?)\s*[:\-]\s*(.+)$/i
  ]);

  const rawPaymentTerms = extractLabeledLine(lines, [
    /(?:payment\s*terms?|terms\s*of\s*payment|credit\s*terms?)\s*[:\-]?\s*(.+)$/i
  ]);
  const { paymentTerms, advancePaidPct } = mapPaymentTerms(rawPaymentTerms || terms);

  // 6. Reference / Notes / Charges
  const refVal = extractLabeledLine(lines, [
    /^ref#?\s*[:\-]\s*(.+)$/i,
    /^reference\s*(?:no\.?|#)?\s*[:\-]\s*(.+)$/i
  ]);
  const rawNotes = extractLabeledLine(lines, [
    /^(?:notes?|remarks?|special\s*instructions?)\s*[:\-]\s*(.+)$/i
  ]);
  const notes = rawNotes || (refVal ? `Ref: ${refVal}` : '');

  const rawShipping = extractLabeledLine(lines, [
    /(?:shipping\s*charges?|freight(?:\s*charges?)?|transport(?:ation)?\s*charges?)\s*[:\-]?\s*(?:₹|Rs\.?\s*)?([\d,]+(?:\.\d+)?)/i
  ]);
  const shippingCharges = parseNumber(rawShipping);

  const rawDiscount = extractLabeledLine(lines, [
    /(?:discount)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/i
  ]);
  const discountPct = parseNumber(rawDiscount);

  // 7. Line Items (try multi-line/single-line text parser first if table parser misses descriptions, or use whichever extracts richer items)
  let tableItems = [];
  if (tableResult?.pages) {
    const allTables = tableResult.pages.flatMap(p => p.tables || []);
    tableItems = parseItemsFromTables(allTables, defaultTax);
  }
  const textItems = parseZohoMultiLineItems(lines, defaultTax);
  const items = textItems.length >= tableItems.length ? textItems : tableItems;

  const data = {
    poDate,
    deliveryDate,
    vendorName,
    vendorGstin,
    contactPerson,
    contactNo,
    email,
    deliveryAddress,
    billingAddress,
    paymentTerms,
    advancePaidPct,
    shippingCharges,
    discountPct,
    notes,
    terms,
    items
  };

  const extractedFields = [];
  if (data.poDate) extractedFields.push('PO Date');
  if (data.deliveryDate) extractedFields.push('Delivery Date');
  if (data.vendorName) extractedFields.push('Vendor Name');
  if (data.vendorGstin) extractedFields.push('Vendor GSTIN');
  if (data.contactPerson) extractedFields.push('Contact Person');
  if (data.contactNo) extractedFields.push('Contact No');
  if (data.email) extractedFields.push('Email');
  if (data.deliveryAddress) extractedFields.push('Delivery Address');
  if (data.billingAddress) extractedFields.push('Billing Address');
  if (data.paymentTerms) extractedFields.push('Payment Terms');
  if (data.shippingCharges > 0) extractedFields.push('Shipping Charges');
  if (data.discountPct > 0) extractedFields.push('Discount %');
  if (data.notes) extractedFields.push('Notes');
  if (data.terms) extractedFields.push('Terms & Conditions');
  if (data.items.length > 0) extractedFields.push(`${data.items.length} Line Item(s)`);

  return {
    scannedWarning: false,
    poNumberSkipped: true,
    extractedFields,
    data,
    rawTextPreview: rawText.slice(0, 1500)
  };
}

export {
  parsePoPdfBuffer
};
