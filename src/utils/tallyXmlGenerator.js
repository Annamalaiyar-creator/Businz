/**
 * BUSINZ - TallyPrime & Tally.ERP 9 XML Generator & Connectivity Utilities
 * Generates standards-compliant Tally XML Envelopes for Sales Vouchers, Purchase Orders, and Ledger Masters.
 */

// Helper to escape XML special entities
function escapeXml(unsafe = '') {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Convert various date formats (DD/MM/YYYY, ISO, etc.) to Tally format YYYYMMDD
export function formatTallyDate(dateVal) {
  if (!dateVal) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
  try {
    if (typeof dateVal === 'string' && dateVal.includes('/')) {
      const parts = dateVal.split('/');
      if (parts.length === 3) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        return `${y}${m}${d}`;
      }
    }
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}${m}${day}`;
    }
  } catch (_) {}
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Detect GST Tax Type (Intra-state CGST+SGST vs Inter-state IGST)
 * VRM / BUSINZ default home state is Tamil Nadu (Code: 33).
 */
export function detectGstType(gstin = '', stateStr = '') {
  const cleanGstin = String(gstin || '').trim();
  const cleanState = String(stateStr || '').trim().toLowerCase();
  
  if (cleanGstin.length >= 2) {
    const stateCode = cleanGstin.substring(0, 2);
    if (stateCode === '33') return 'INTRA'; // Tamil Nadu
    if (!isNaN(parseInt(stateCode, 10))) return 'INTER';
  }
  
  if (cleanState.includes('tamil nadu') || cleanState === 'tn' || cleanState === '33') {
    return 'INTRA';
  }
  return cleanState ? 'INTER' : 'INTRA'; // Default intra if same state
}

/**
 * Generate Tally XML for Sales Invoices (Voucher Type: Sales)
 * @param {Array} invoices - List of invoice records from BUSINZ
 * @param {Object} options - Configuration (companyName, defaultSalesLedger, etc.)
 */
export function generateTallySalesInvoicesXml(invoices = [], options = {}) {
  const companyName = options.companyName || 'VRM STRUCTURES INDIA PRIVATE LIMITED';
  const salesLedger = options.salesLedger || 'Sales - GST';

  const voucherXmlList = (Array.isArray(invoices) ? invoices : [invoices]).map(inv => {
    if (!inv) return '';
    const invNo = inv.invNo || inv.invoiceNo || inv.code || 'INV-001';
    const dateFormatted = formatTallyDate(inv.date || inv.c4 || inv.createdAt);
    const customerName = inv.customerName || inv.vendor || inv.c2 || 'Cash Customer';
    const bomRef = inv.poNo || inv.bomCode || inv.c3 || '';
    const billingAddress = inv.billingAddress || (inv.billingAddressObj && inv.billingAddressObj.address) || '';
    const gstin = inv.gstin || inv.gstNo || '';
    const stateStr = inv.state || (inv.billingAddressObj && inv.billingAddressObj.state) || 'Tamil Nadu';
    const isIntra = detectGstType(gstin, stateStr) === 'INTRA';

    // Collect line items
    const rawItems = (inv.items && inv.items.length > 0)
      ? inv.items
      : [{
          name: inv.presetName || 'Solar Mounting Structure Kit',
          qty: 1,
          rate: parseFloat(String(inv.invAmt || inv.c5 || '1000').replace(/[^0-9.]/g, '')) || 1000,
          unit: 'Nos',
          tax: 18
        }];

    let computedSubTotal = 0;
    let computedTaxTotal = 0;

    const inventoryXml = rawItems.map(item => {
      const itemName = item.name || item.description || 'Solar Structure Component';
      const qty = parseFloat(item.invQty || item.bomQty || item.qty || 1) || 1;
      const rate = parseFloat(item.rate || item.price || 1000) || 1000;
      const amount = Math.round(qty * rate * 100) / 100;
      const uom = item.uom || item.unit || 'Nos';
      const taxRate = parseFloat(item.tax || 18) || 18;

      computedSubTotal += amount;
      computedTaxTotal += Math.round(amount * (taxRate / 100) * 100) / 100;

      return `
              <ALLINVENTORYENTRIES.LIST>
                <STOCKITEMNAME>${escapeXml(itemName)}</STOCKITEMNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <RATE>${rate.toFixed(2)}/${escapeXml(uom)}</RATE>
                <ACTUALQTY>${qty} ${escapeXml(uom)}</ACTUALQTY>
                <BILLEDQTY>${qty} ${escapeXml(uom)}</BILLEDQTY>
                <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
                <ACCOUNTINGALLOCATIONS.LIST>
                  <LEDGERNAME>${escapeXml(salesLedger)}</LEDGERNAME>
                  <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                  <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
                </ACCOUNTINGALLOCATIONS.LIST>
              </ALLINVENTORYENTRIES.LIST>`;
    }).join('\n');

    let grandTotal = computedSubTotal + computedTaxTotal;
    if (inv.grandTotal || inv.invAmt) {
      const explicitTotal = parseFloat(String(inv.grandTotal || inv.invAmt || '').replace(/[^0-9.]/g, ''));
      if (!isNaN(explicitTotal) && explicitTotal > 0) {
        grandTotal = explicitTotal;
      }
    }

    // Taxes split
    let taxLedgersXml = '';
    if (isIntra) {
      const cgstAmt = Math.round((computedTaxTotal / 2) * 100) / 100;
      const sgstAmt = Math.round((computedTaxTotal / 2) * 100) / 100;
      taxLedgersXml = `
              <LEDGERENTRIES.LIST>
                <LEDGERNAME>Output CGST 9%</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>-${cgstAmt.toFixed(2)}</AMOUNT>
              </LEDGERENTRIES.LIST>
              <LEDGERENTRIES.LIST>
                <LEDGERNAME>Output SGST 9%</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>-${sgstAmt.toFixed(2)}</AMOUNT>
              </LEDGERENTRIES.LIST>`;
    } else {
      taxLedgersXml = `
              <LEDGERENTRIES.LIST>
                <LEDGERNAME>Output IGST 18%</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>-${computedTaxTotal.toFixed(2)}</AMOUNT>
              </LEDGERENTRIES.LIST>`;
    }

    // Party Ledger entry (Debtor debit is positive)
    const partyLedgerXml = `
              <LEDGERENTRIES.LIST>
                <LEDGERNAME>${escapeXml(customerName)}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <AMOUNT>${grandTotal.toFixed(2)}</AMOUNT>
                <BILLALLOCATIONS.LIST>
                  <NAME>${escapeXml(invNo)}</NAME>
                  <BILLTYPE>New Ref</BILLTYPE>
                  <AMOUNT>${grandTotal.toFixed(2)}</AMOUNT>
                </BILLALLOCATIONS.LIST>
              </LEDGERENTRIES.LIST>`;

    return `
          <TALLYMESSAGE xmlns:UDF="TallyUDF">
            <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
              <DATE>${dateFormatted}</DATE>
              <EFFECTIVEDATE>${dateFormatted}</EFFECTIVEDATE>
              <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
              <VOUCHERNUMBER>${escapeXml(invNo)}</VOUCHERNUMBER>
              <REFERENCE>${escapeXml(bomRef)}</REFERENCE>
              <PARTYLEDGERNAME>${escapeXml(customerName)}</PARTYLEDGERNAME>
              <PARTYNAME>${escapeXml(customerName)}</PARTYNAME>
              <BASICBUYERNAME>${escapeXml(customerName)}</BASICBUYERNAME>
              <ADDRESS.LIST>
                <ADDRESS>${escapeXml(billingAddress)}</ADDRESS>
              </ADDRESS.LIST>
              <STATENAME>${escapeXml(stateStr)}</STATENAME>
              <COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>
              <PARTYGSTIN>${escapeXml(gstin)}</PARTYGSTIN>
              <PLACEOFSUPPLY>${escapeXml(stateStr)}</PLACEOFSUPPLY>
              <NARRATION>BUSINZ Tax Invoice ${escapeXml(invNo)} | BOM Ref: ${escapeXml(bomRef)} | Dispatch Complete.</NARRATION>
              ${partyLedgerXml}
              ${inventoryXml}
              ${taxLedgersXml}
            </VOUCHER>
          </TALLYMESSAGE>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${voucherXmlList}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

/**
 * Generate Tally XML for Purchase Orders / Vouchers
 * @param {Array} pos - List of PO records from BUSINZ
 * @param {Object} options - Configuration
 */
export function generateTallyPurchaseOrdersXml(pos = [], options = {}) {
  const companyName = options.companyName || 'VRM STRUCTURES INDIA PRIVATE LIMITED';
  const purchaseLedger = options.purchaseLedger || 'Purchase - GST';

  const voucherXmlList = (Array.isArray(pos) ? pos : [pos]).map(po => {
    if (!po) return '';
    const poNo = po.poNumber || po.poNo || po.code || 'PO-00001';
    const dateFormatted = formatTallyDate(po.date || po.poDate || po.createdAt);
    const vendorName = po.vendorName || po.vendor || po.supplierName || 'General Supplier';
    const gstin = po.gstin || po.gstNo || '';
    const stateStr = po.state || 'Tamil Nadu';
    const isIntra = detectGstType(gstin, stateStr) === 'INTRA';

    const rawItems = (po.line_items || po.items || []).length > 0
      ? (po.line_items || po.items)
      : [{
          name: po.itemName || 'Raw Material Item',
          qty: 1,
          rate: parseFloat(String(po.total || po.amount || 1000).replace(/[^0-9.]/g, '')) || 1000,
          unit: 'Nos',
          tax: 18
        }];

    let computedSubTotal = 0;
    let computedTaxTotal = 0;

    const inventoryXml = rawItems.map(item => {
      const itemName = item.name || item.item_name || item.description || 'Raw Material Stock';
      const qty = parseFloat(item.qty || item.quantity || 1) || 1;
      const rate = parseFloat(item.rate || item.unit_price || 1000) || 1000;
      const amount = Math.round(qty * rate * 100) / 100;
      const uom = item.uom || item.unit || 'Nos';
      const taxRate = parseFloat(item.tax || item.tax_percentage || 18) || 18;

      computedSubTotal += amount;
      computedTaxTotal += Math.round(amount * (taxRate / 100) * 100) / 100;

      return `
              <ALLINVENTORYENTRIES.LIST>
                <STOCKITEMNAME>${escapeXml(itemName)}</STOCKITEMNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <RATE>${rate.toFixed(2)}/${escapeXml(uom)}</RATE>
                <ACTUALQTY>${qty} ${escapeXml(uom)}</ACTUALQTY>
                <BILLEDQTY>${qty} ${escapeXml(uom)}</BILLEDQTY>
                <AMOUNT>${amount.toFixed(2)}</AMOUNT>
                <ACCOUNTINGALLOCATIONS.LIST>
                  <LEDGERNAME>${escapeXml(purchaseLedger)}</LEDGERNAME>
                  <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                  <AMOUNT>${amount.toFixed(2)}</AMOUNT>
                </ACCOUNTINGALLOCATIONS.LIST>
              </ALLINVENTORYENTRIES.LIST>`;
    }).join('\n');

    const grandTotal = computedSubTotal + computedTaxTotal;

    let taxLedgersXml = '';
    if (isIntra) {
      const cgstAmt = Math.round((computedTaxTotal / 2) * 100) / 100;
      const sgstAmt = Math.round((computedTaxTotal / 2) * 100) / 100;
      taxLedgersXml = `
              <LEDGERENTRIES.LIST>
                <LEDGERNAME>Input CGST 9%</LEDGERNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <AMOUNT>${cgstAmt.toFixed(2)}</AMOUNT>
              </LEDGERENTRIES.LIST>
              <LEDGERENTRIES.LIST>
                <LEDGERNAME>Input SGST 9%</LEDGERNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <AMOUNT>${sgstAmt.toFixed(2)}</AMOUNT>
              </LEDGERENTRIES.LIST>`;
    } else {
      taxLedgersXml = `
              <LEDGERENTRIES.LIST>
                <LEDGERNAME>Input IGST 18%</LEDGERNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <AMOUNT>${computedTaxTotal.toFixed(2)}</AMOUNT>
              </LEDGERENTRIES.LIST>`;
    }

    const partyLedgerXml = `
              <LEDGERENTRIES.LIST>
                <LEDGERNAME>${escapeXml(vendorName)}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>-${grandTotal.toFixed(2)}</AMOUNT>
                <BILLALLOCATIONS.LIST>
                  <NAME>${escapeXml(poNo)}</NAME>
                  <BILLTYPE>New Ref</BILLTYPE>
                  <AMOUNT>-${grandTotal.toFixed(2)}</AMOUNT>
                </BILLALLOCATIONS.LIST>
              </LEDGERENTRIES.LIST>`;

    return `
          <TALLYMESSAGE xmlns:UDF="TallyUDF">
            <VOUCHER VCHTYPE="Purchase" ACTION="Create" OBJVIEW="Invoice Voucher View">
              <DATE>${dateFormatted}</DATE>
              <EFFECTIVEDATE>${dateFormatted}</EFFECTIVEDATE>
              <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
              <VOUCHERNUMBER>${escapeXml(poNo)}</VOUCHERNUMBER>
              <PARTYLEDGERNAME>${escapeXml(vendorName)}</PARTYLEDGERNAME>
              <PARTYNAME>${escapeXml(vendorName)}</PARTYNAME>
              <PARTYGSTIN>${escapeXml(gstin)}</PARTYGSTIN>
              <NARRATION>BUSINZ Purchase Order ${escapeXml(poNo)} | Vendor: ${escapeXml(vendorName)}</NARRATION>
              ${partyLedgerXml}
              ${inventoryXml}
              ${taxLedgersXml}
            </VOUCHER>
          </TALLYMESSAGE>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${voucherXmlList}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

/**
 * Trigger browser file download of generated Tally XML
 */
export function downloadTallyXmlFile(xmlContent, fileName = 'businz_tally_vouchers.xml') {
  if (!xmlContent) return;
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName.endsWith('.xml') ? fileName : `${fileName}.xml`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
