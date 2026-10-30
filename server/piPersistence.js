/**
 * server/piPersistence.js
 * 
 * BUSINZ ERP — Authoritative PostgreSQL Proforma Invoice (PI) Persistence Module
 * 
 * Strict Guarantees (per AGENTS.md & User Mandate):
 * 1. Database Source of Truth: public.proforma_invoices is the primary, authoritative relational table.
 * 2. Database-First Rule: PI is validated and safely committed to PostgreSQL database BEFORE any Zoho Books sync.
 * 3. 1 Record Change = 1 Targeted Database Operation (No whole-array table overwrites).
 * 4. Dual-sync with controlroom_store (sales_pi_store / proforma_invoice_store) by single-item merge, preventing any data erasure.
 * 5. Automatic collision-free sequence generation (VRM-PI-[YYYY]-[SEQ]).
 * 6. Thread-safe parameterized queries with explicit transaction locks.
 */

import { pool as defaultPool } from './db.js';
import { getFinancialYear, formatSequenceCode } from './sequenceService.js';
import { getStoreFilePath } from './runtimePaths.js';
import fs from 'fs';

/**
 * Maps database row from public.proforma_invoices to consumer JS object format.
 */
export function toConsumerPi(row) {
  if (!row || typeof row !== 'object') return null;

  const subTotal = parseFloat(row.sub_total || row.unit_value || 0) || 0;
  const grandTotal = parseFloat(row.grand_total || (subTotal + parseFloat(row.gst_amount || 0))) || 0;

  return {
    id: row.id || row.pi_no,
    piNo: row.pi_no,
    vendor: row.vendor || row.customer_name || '',
    customerName: row.customer_name || row.vendor || '',
    contactPerson: row.contact_person || '',
    phone: row.phone || '',
    email: row.email || '',
    gstNo: row.gst_no || '',
    productName: row.product_name || '',
    billingAddress: row.billing_address_obj || row.billing_address || '',
    deliveryAddress: row.delivery_address_obj || row.delivery_address || '',
    sameAsBilling: row.same_as_billing !== false,
    vehicleNo: row.vehicle_no || '',
    signedPiDoc: row.signed_pi_doc || null,
    pdfName: row.pdf_name || null,
    piDate: row.pi_date ? String(row.pi_date).split('T')[0] : (row.created_at ? String(row.created_at).split('T')[0] : new Date().toISOString().split('T')[0]),
    validUntilDate: row.valid_until_date ? String(row.valid_until_date).split('T')[0] : (row.exp_date ? String(row.exp_date).split('T')[0] : null),
    expDate: row.exp_date ? String(row.exp_date).split('T')[0] : null,
    deliveryDate: row.delivery_date ? String(row.delivery_date).split('T')[0] : null,
    paymentTerms: row.payment_terms || '100% Paid',
    creditDays: row.credit_days || '',
    remarks: row.remarks || '',
    transportMode: row.transport_mode || 'Transport',
    transporterName: row.transporter_name || '',
    destination: row.destination || '',
    transportScope: row.transport_scope || 'VRM Structures',
    status: row.status || 'Issued',
    statusType: row.status_type || (row.status === 'Draft' ? 'draft' : (row.status === 'Converted to BOM' ? 'converted' : 'issued')),
    salesPerson: row.sales_person || row.created_by || 'sales',
    salesperson: row.sales_person || row.created_by || 'sales',
    salesPersonCode: row.sales_person_code || row.created_by_id || '',
    salesPersonEmail: row.sales_person_email || '',
    createdBy: row.created_by || row.sales_person || 'sales',
    createdById: row.created_by_id || row.sales_person_code || '',
    unitValue: parseFloat(row.unit_value || subTotal),
    quantity: parseFloat(row.quantity || 1),
    subtotal: subTotal,
    kitSubtotal: parseFloat(row.kit_subtotal || 0),
    taxTotal: parseFloat(row.gst_amount || 0),
    cgst: parseFloat(row.cgst_amount || 0),
    sgst: parseFloat(row.sgst_amount || 0),
    grandTotal: grandTotal,
    amount: '₹' + Math.round(grandTotal).toLocaleString('en-IN'),
    hsn: row.hsn || '73089090',
    items: Array.isArray(row.items) ? row.items.map(it => ({
      ...it,
      hsn: it.hsn || it.hsn_or_sac || it.hsnCode || row.hsn || '73089090'
    })) : [],
    presetGroups: row.preset_groups || {},
    convertedBomNo: row.converted_bom_no || null,
    convertedBomCode: row.converted_bom_code || null,
    zohoSynced: Boolean(row.zoho_synced),
    zohoEstimateId: row.zoho_estimate_id || null,
    zohoEstimateNo: row.zoho_estimate_no || null,
    zohoSyncError: row.zoho_sync_error || null,
    zohoSyncedAt: row.zoho_synced_at || null,
    zohoModule: row.zoho_module || 'Quotes',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
  };
}

/**
 * Loads all Proforma Invoices directly from PostgreSQL database (Authoritative Source of Truth).
 */
export async function loadDatabaseProformaInvoices(pool = defaultPool) {
  try {
    const res = await pool.query(`
      SELECT * FROM public.proforma_invoices
      ORDER BY created_at DESC
    `);
    return res.rows.map(toConsumerPi).filter(Boolean);
  } catch (err) {
    console.error('[Database PIs Load Error]:', err.message);
    return [];
  }
}

/**
 * Generates the next sequential PI number directly from authoritative PostgreSQL database records.
 * Format: VRM-PI-[YYYY]-[SEQ] (e.g. VRM-PI-2026-95)
 */
export async function getNextDatabasePiNumber(pool = defaultPool) {
  const fy = getFinancialYear();
  try {
    const candidateStrings = [];

    // 1. From relational public.proforma_invoices
    try {
      const res = await pool.query(`
        SELECT pi_no, id FROM public.proforma_invoices
        WHERE (pi_no ~ '^VRM-PI-[0-9]{4}-[0-9]+$' OR id ~ '^VRM-PI-[0-9]{4}-[0-9]+$')
      `);
      for (const row of res.rows) {
        if (row.pi_no) candidateStrings.push(row.pi_no);
        if (row.id) candidateStrings.push(row.id);
      }
    } catch (_) {}

    // 2. From relational public.bom_orders source_pi_no (prevent colliding with existing BOM conversions)
    try {
      const bomRes = await pool.query(`
        SELECT source_pi_no FROM public.bom_orders
        WHERE source_pi_no IS NOT NULL AND source_pi_no ~ '^VRM-PI-[0-9]{4}-[0-9]+$'
      `);
      for (const row of bomRes.rows) {
        if (row.source_pi_no) candidateStrings.push(row.source_pi_no);
      }
    } catch (_) {}

    // 3. From public.controlroom_store keys: sales_pi_store, proforma_invoice_store, and bom_orders
    try {
      const storeRes = await pool.query(`
        SELECT key, data FROM public.controlroom_store
        WHERE key IN ('sales_pi_store', 'proforma_invoice_store', 'bom_orders', 'bom_store')
      `);
      for (const row of storeRes.rows) {
        if (Array.isArray(row.data)) {
          for (const item of row.data) {
            if (item?.piNo) candidateStrings.push(item.piNo);
            if (item?.id) candidateStrings.push(item.id);
            if (item?.sourcePiNo) candidateStrings.push(item.sourcePiNo);
          }
        }
      }
    } catch (_) {}

    // 4. From local disk JSON files
    for (const f of ['sales_pi_store.json', 'proforma_invoice_store.json', 'bom_store.json']) {
      try {
        const fp = getStoreFilePath(f);
        if (fs.existsSync(fp)) {
          const list = JSON.parse(fs.readFileSync(fp, 'utf8'));
          if (Array.isArray(list)) {
            for (const item of list) {
              if (item?.piNo) candidateStrings.push(item.piNo);
              if (item?.id) candidateStrings.push(item.id);
              if (item?.sourcePiNo) candidateStrings.push(item.sourcePiNo);
            }
          }
        }
      } catch (_) {}
    }

    let maxSeq = 0;
    const regex = new RegExp(`^VRM-PI-${fy}-(\\d+)$`, 'i');

    for (const str of candidateStrings) {
      const match = String(str || '').trim().match(regex);
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        if (Number.isFinite(val) && val > maxSeq) {
          maxSeq = val;
        }
      }
    }

    const nextNum = maxSeq + 1;
    const code = formatSequenceCode('PI', nextNum);
    return { nextPiNo: code, nextEstimateNo: code, nextNum, fiscalYear: String(fy), financialYear: fy };
  } catch (err) {
    console.warn('[PI Next Number DB Warning]:', err.message);
    const code = formatSequenceCode('PI', 1);
    return { nextPiNo: code, nextEstimateNo: code, nextNum: 1, fiscalYear: String(fy), financialYear: fy };
  }
}

/**
 * STEP 1: Targeted Single-Record Database Persistence
 * Atomically inserts or updates a Proforma Invoice in public.proforma_invoices.
 * 
 * Strict Guarantees:
 * - Runs in a dedicated client transaction with advisory lock.
 * - Auto-advances PI number if a collision is detected during creation.
 * - On success, performs a targeted update to controlroom_store JSON keys (without overwriting other records).
 * - On failure, throws genuine error so the caller stops and never proceeds to Zoho.
 */
export async function saveProformaInvoiceToDatabase(piData, pool = defaultPool) {
  if (!piData || typeof piData !== 'object') {
    throw new Error('[Validation Error] Invalid Proforma Invoice data object provided.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Transaction-level advisory lock to eliminate concurrent sequence race conditions
    await client.query('SELECT pg_advisory_xact_lock(78891234)');

    const isEdit = Boolean(piData.isEdit || piData.editMode || piData.isEditing);
    let cleanPiNo = String(piData.piNo || piData.id || '').trim();

    // Verify existing record in database
    let existingRow = null;
    let isCollisionWithExistingPiOrBom = false;
    if (cleanPiNo) {
      const existRes = await client.query(
        'SELECT * FROM public.proforma_invoices WHERE LOWER(TRIM(pi_no)) = LOWER(TRIM($1)) OR LOWER(TRIM(id)) = LOWER(TRIM($1))',
        [cleanPiNo]
      );
      if (existRes.rows.length > 0) {
        existingRow = existRes.rows[0];
      }

      // Check if this PI number is already used as a source_pi_no by an existing active BOM in public.bom_orders
      if (!isEdit) {
        try {
          const bomCheck = await client.query(
            'SELECT bom_code FROM public.bom_orders WHERE LOWER(TRIM(source_pi_no)) = LOWER(TRIM($1)) AND status NOT ILIKE \'%cancel%\' LIMIT 1',
            [cleanPiNo]
          );
          if (bomCheck.rows.length > 0) {
            isCollisionWithExistingPiOrBom = true;
          }
        } catch (_) {}
      }
    }

    // Auto-advance sequence if NOT an edit and PI number already taken or claimed by existing BOM
    if (!isEdit && (existingRow || isCollisionWithExistingPiOrBom)) {
      const seqInfo = await getNextDatabasePiNumber(pool);
      console.warn(`[PI Concurrency Protection] PI number "${cleanPiNo}" is already taken or claimed by existing BOM. Auto-advancing to "${seqInfo.nextPiNo}".`);
      cleanPiNo = seqInfo.nextPiNo;
      existingRow = null;
    }

    if (!cleanPiNo) {
      const seqInfo = await getNextDatabasePiNumber(pool);
      cleanPiNo = seqInfo.nextPiNo;
    }

    const subTotal = parseFloat(piData.subtotal ?? piData.sub_total ?? piData.unitValue ?? (existingRow?.sub_total || 0)) || 0;
    let taxTotal = parseFloat(piData.taxTotal ?? piData.gst_amount ?? (existingRow?.gst_amount || 0)) || 0;
    const grandTotal = parseFloat(piData.grandTotal ?? piData.grand_total ?? (subTotal + taxTotal)) || (subTotal + taxTotal);
    if (taxTotal === 0 && grandTotal > subTotal) {
      taxTotal = Math.round((grandTotal - subTotal) * 100) / 100;
    }
    const cgst = parseFloat(piData.cgst ?? piData.cgst_amount ?? (taxTotal / 2)) || (taxTotal / 2);
    const sgst = parseFloat(piData.sgst ?? piData.sgst_amount ?? (taxTotal / 2)) || (taxTotal / 2);

    const billingObj = (piData.billingAddress && typeof piData.billingAddress === 'object')
      ? piData.billingAddress
      : (existingRow?.billing_address_obj || {});
    const deliveryObj = (piData.deliveryAddress && typeof piData.deliveryAddress === 'object')
      ? piData.deliveryAddress
      : (existingRow?.delivery_address_obj || billingObj);

    const billingStr = typeof piData.billingAddress === 'string'
      ? piData.billingAddress
      : (billingObj.street || billingObj.address || existingRow?.billing_address || '');
    const deliveryStr = typeof piData.deliveryAddress === 'string'
      ? piData.deliveryAddress
      : (deliveryObj.street || deliveryObj.address || existingRow?.delivery_address || billingStr);

    const now = new Date().toISOString();
    const createdAt = existingRow?.created_at || piData.createdAt || now;

    const upsertSql = `
      INSERT INTO public.proforma_invoices (
        id, pi_no, vendor, customer_name, contact_person, phone, email, gst_no,
        product_name, billing_address, billing_address_obj, delivery_address, delivery_address_obj,
        vehicle_no, signed_pi_doc, pi_date, delivery_date, valid_until_date, exp_date,
        payment_terms, credit_days, remarks, transport_mode, transporter_name, destination, transport_scope,
        status, status_type, sales_person, sales_person_code, sales_person_email, created_by, created_by_id,
        sub_total, gst_amount, cgst_amount, sgst_amount, grand_total, unit_value, quantity, kit_subtotal,
        items, preset_groups, same_as_billing, converted_bom_no, converted_bom_code, pdf_name, hsn,
        zoho_synced, zoho_estimate_id, zoho_estimate_no, zoho_sync_error, zoho_synced_at, zoho_module,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26,
        $27, $28, $29, $30, $31, $32, $33,
        $34, $35, $36, $37, $38, $39, $40, $41,
        $42, $43, $44, $45, $46, $47, $48,
        $49, $50, $51, $52, $53, $54,
        $55, NOW()
      )
      ON CONFLICT (LOWER(TRIM(pi_no))) DO UPDATE SET
        vendor = EXCLUDED.vendor,
        customer_name = EXCLUDED.customer_name,
        contact_person = EXCLUDED.contact_person,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        gst_no = EXCLUDED.gst_no,
        product_name = EXCLUDED.product_name,
        billing_address = EXCLUDED.billing_address,
        billing_address_obj = EXCLUDED.billing_address_obj,
        delivery_address = EXCLUDED.delivery_address,
        delivery_address_obj = EXCLUDED.delivery_address_obj,
        vehicle_no = EXCLUDED.vehicle_no,
        signed_pi_doc = COALESCE(EXCLUDED.signed_pi_doc, public.proforma_invoices.signed_pi_doc),
        pi_date = COALESCE(EXCLUDED.pi_date, public.proforma_invoices.pi_date),
        delivery_date = EXCLUDED.delivery_date,
        valid_until_date = COALESCE(EXCLUDED.valid_until_date, public.proforma_invoices.valid_until_date),
        exp_date = COALESCE(EXCLUDED.exp_date, public.proforma_invoices.exp_date),
        payment_terms = EXCLUDED.payment_terms,
        credit_days = EXCLUDED.credit_days,
        remarks = EXCLUDED.remarks,
        transport_mode = EXCLUDED.transport_mode,
        transporter_name = EXCLUDED.transporter_name,
        destination = EXCLUDED.destination,
        transport_scope = EXCLUDED.transport_scope,
        status = EXCLUDED.status,
        status_type = EXCLUDED.status_type,
        sales_person = COALESCE(NULLIF(EXCLUDED.sales_person, ''), public.proforma_invoices.sales_person),
        sales_person_code = COALESCE(NULLIF(EXCLUDED.sales_person_code, ''), public.proforma_invoices.sales_person_code),
        sales_person_email = COALESCE(NULLIF(EXCLUDED.sales_person_email, ''), public.proforma_invoices.sales_person_email),
        sub_total = EXCLUDED.sub_total,
        gst_amount = EXCLUDED.gst_amount,
        cgst_amount = EXCLUDED.cgst_amount,
        sgst_amount = EXCLUDED.sgst_amount,
        grand_total = EXCLUDED.grand_total,
        unit_value = EXCLUDED.unit_value,
        quantity = EXCLUDED.quantity,
        kit_subtotal = EXCLUDED.kit_subtotal,
        items = EXCLUDED.items,
        preset_groups = EXCLUDED.preset_groups,
        same_as_billing = EXCLUDED.same_as_billing,
        converted_bom_no = CASE WHEN EXCLUDED.status = 'Converted to BOM' THEN COALESCE(EXCLUDED.converted_bom_no, public.proforma_invoices.converted_bom_no) ELSE EXCLUDED.converted_bom_no END,
        converted_bom_code = CASE WHEN EXCLUDED.status = 'Converted to BOM' THEN COALESCE(EXCLUDED.converted_bom_code, public.proforma_invoices.converted_bom_code) ELSE EXCLUDED.converted_bom_code END,
        pdf_name = COALESCE(EXCLUDED.pdf_name, public.proforma_invoices.pdf_name),
        hsn = COALESCE(EXCLUDED.hsn, public.proforma_invoices.hsn, '73089090'),
        zoho_synced = CASE WHEN EXCLUDED.zoho_synced THEN true ELSE public.proforma_invoices.zoho_synced END,
        zoho_estimate_id = COALESCE(EXCLUDED.zoho_estimate_id, public.proforma_invoices.zoho_estimate_id),
        zoho_estimate_no = COALESCE(EXCLUDED.zoho_estimate_no, public.proforma_invoices.zoho_estimate_no),
        zoho_sync_error = EXCLUDED.zoho_sync_error,
        zoho_synced_at = COALESCE(EXCLUDED.zoho_synced_at, public.proforma_invoices.zoho_synced_at),
        updated_at = NOW()
      RETURNING *;
    `;

    const pick = (val, fb = '') => (val !== undefined && val !== null ? val : (fb !== undefined && fb !== null ? fb : ''));

    const vendor = String(pick(piData.vendor || piData.customerName, existingRow?.vendor || 'Customer')).trim();
    const custName = String(pick(piData.customerName || piData.vendor, existingRow?.customer_name || vendor)).trim();
    const items = Array.isArray(piData.items) ? piData.items : (existingRow?.items || []);
    const presetGroups = piData.presetGroups || existingRow?.preset_groups || {};
    const hsnVal = String(pick(piData.hsn, (items && items[0]?.hsn) || existingRow?.hsn || '73089090')).trim();

    const values = [
      cleanPiNo,
      cleanPiNo,
      vendor,
      custName,
      pick(piData.contactPerson, existingRow?.contact_person),
      pick(piData.phone, existingRow?.phone),
      pick(piData.email, existingRow?.email),
      String(pick(piData.gstNo, existingRow?.gst_no)).toUpperCase(),
      pick(piData.productName, existingRow?.product_name || 'Solar Mounting Structures & Components'),
      billingStr,
      JSON.stringify(billingObj),
      deliveryStr,
      JSON.stringify(deliveryObj),
      pick(piData.vehicleNo, existingRow?.vehicle_no),
      piData.signedPiDoc || existingRow?.signed_pi_doc || null,
      piData.piDate || existingRow?.pi_date || now.split('T')[0],
      piData.deliveryDate || existingRow?.delivery_date || null,
      piData.validUntilDate || existingRow?.valid_until_date || null,
      piData.expDate || existingRow?.exp_date || null,
      pick(piData.paymentTerms, existingRow?.payment_terms || '100% Paid'),
      pick(piData.creditDays, existingRow?.credit_days || ''),
      pick(piData.remarks, existingRow?.remarks),
      pick(piData.transportMode, existingRow?.transport_mode || 'Transport'),
      pick(piData.transporterName, existingRow?.transporter_name),
      pick(piData.destination, existingRow?.destination),
      pick(piData.transportScope, existingRow?.transport_scope || 'VRM Structures'),
      piData.status || existingRow?.status || 'Issued',
      piData.statusType || existingRow?.status_type || 'issued',
      piData.salesPerson || piData.salesperson || existingRow?.sales_person || 'sales',
      piData.salesPersonCode || piData.createdById || existingRow?.sales_person_code || '',
      piData.salesPersonEmail || existingRow?.sales_person_email || '',
      piData.createdBy || existingRow?.created_by || 'sales',
      piData.createdById || piData.salesPersonCode || existingRow?.created_by_id || '',
      subTotal,
      taxTotal,
      cgst,
      sgst,
      grandTotal,
      parseFloat(piData.unitValue || subTotal),
      parseFloat(piData.quantity || 1),
      parseFloat(piData.kitSubtotal || 0),
      JSON.stringify(items),
      JSON.stringify(presetGroups),
      piData.sameAsBilling !== false,
      piData.convertedBomNo || ((piData.status === 'Converted to BOM' || existingRow?.status === 'Converted to BOM') ? existingRow?.converted_bom_no : null) || null,
      piData.convertedBomCode || ((piData.status === 'Converted to BOM' || existingRow?.status === 'Converted to BOM') ? existingRow?.converted_bom_code : null) || null,
      piData.pdfName || existingRow?.pdf_name || null,
      hsnVal,
      Boolean(piData.zohoSynced || existingRow?.zoho_synced),
      piData.zohoEstimateId || existingRow?.zoho_estimate_id || null,
      piData.zohoEstimateNo || existingRow?.zoho_estimate_no || null,
      piData.zohoSyncError || null,
      piData.zohoSyncedAt || existingRow?.zoho_synced_at || null,
      piData.zohoModule || existingRow?.zoho_module || 'Quotes',
      createdAt
    ];

    let savedRow = null;
    try {
      const result = await client.query(upsertSql, values);
      savedRow = result.rows[0];
    } catch (upsertErr) {
      console.warn('[PI Upsert ON CONFLICT fallback]:', upsertErr.message);
      // Fallback: If ON CONFLICT fails, execute direct check & update or insert
      const checkRow = await client.query(
        'SELECT id FROM public.proforma_invoices WHERE LOWER(TRIM(pi_no)) = LOWER(TRIM($1)) OR id = $1',
        [cleanPiNo]
      );
      if (checkRow.rows.length > 0) {
        const updateSql = `
          UPDATE public.proforma_invoices SET
            vendor = $3, customer_name = $4, contact_person = $5, phone = $6, email = $7, gst_no = $8,
            product_name = $9, billing_address = $10, billing_address_obj = $11, delivery_address = $12, delivery_address_obj = $13,
            vehicle_no = $14, signed_pi_doc = $15, pi_date = $16, delivery_date = $17, valid_until_date = $18, exp_date = $19,
            payment_terms = $20, credit_days = $21, remarks = $22, transport_mode = $23, transporter_name = $24, destination = $25, transport_scope = $26,
            status = $27, status_type = $28, sales_person = $29, sales_person_code = $30, sales_person_email = $31, created_by = $32, created_by_id = $33,
            sub_total = $34, gst_amount = $35, cgst_amount = $36, sgst_amount = $37, grand_total = $38, unit_value = $39, quantity = $40, kit_subtotal = $41,
            items = $42, preset_groups = $43, same_as_billing = $44, converted_bom_no = $45, converted_bom_code = $46, pdf_name = $47, hsn = $48,
            updated_at = NOW()
          WHERE LOWER(TRIM(pi_no)) = LOWER(TRIM($2)) OR id = $1
          RETURNING *;
        `;
        const updRes = await client.query(updateSql, values.slice(0, 48));
        savedRow = updRes.rows[0];
      } else {
        const insertDirectSql = `
          INSERT INTO public.proforma_invoices (
            id, pi_no, vendor, customer_name, contact_person, phone, email, gst_no,
            product_name, billing_address, billing_address_obj, delivery_address, delivery_address_obj,
            vehicle_no, signed_pi_doc, pi_date, delivery_date, valid_until_date, exp_date,
            payment_terms, credit_days, remarks, transport_mode, transporter_name, destination, transport_scope,
            status, status_type, sales_person, sales_person_code, sales_person_email, created_by, created_by_id,
            sub_total, gst_amount, cgst_amount, sgst_amount, grand_total, unit_value, quantity, kit_subtotal,
            items, preset_groups, same_as_billing, converted_bom_no, converted_bom_code, pdf_name, hsn,
            zoho_synced, zoho_estimate_id, zoho_estimate_no, zoho_sync_error, zoho_synced_at, zoho_module,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13,
            $14, $15, $16, $17, $18, $19,
            $20, $21, $22, $23, $24, $25, $26,
            $27, $28, $29, $30, $31, $32, $33,
            $34, $35, $36, $37, $38, $39, $40, $41,
            $42, $43, $44, $45, $46, $47, $48,
            $49, $50, $51, $52, $53, $54,
            $55, NOW()
          ) RETURNING *;
        `;
        const insRes = await client.query(insertDirectSql, values);
        savedRow = insRes.rows[0];
      }
    }

    await client.query('COMMIT');

    const consumerPi = toConsumerPi(savedRow);

    // Targeted 1-record update in controlroom_store JSON keys (without whole-array overwrite)
    await syncSinglePiToControlroomStore(consumerPi, pool);

    return {
      success: true,
      pi: consumerPi,
      wasAutoAdvanced: cleanPiNo !== piData.piNo
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`[Proforma Invoice DB Persistence ERROR for ${piData.piNo}]:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Updates a single PI record in controlroom_store (sales_pi_store / proforma_invoice_store)
 * and disk stores safely without overwriting other records.
 */
async function syncSinglePiToControlroomStore(pi, pool = defaultPool) {
  if (!pi || !pi.piNo) return;
  const cleanKey = pi.piNo.toLowerCase();

  // 1. Update disk files safely
  const storeFiles = ['proforma_invoice_store.json', 'sales_pi_store.json'];
  for (const sf of storeFiles) {
    try {
      const p = getStoreFilePath(sf);
      let list = [];
      if (fs.existsSync(p)) {
        list = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (!Array.isArray(list)) list = [];
      }
      const existingIdx = list.findIndex(x => String(x.piNo || x.id || '').trim().toLowerCase() === cleanKey);
      if (existingIdx !== -1) {
        list[existingIdx] = { ...list[existingIdx], ...pi };
      } else {
        list = [pi, ...list];
      }
      fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf8');
    } catch (_) {}
  }

  // 2. Targeted update to controlroom_store in PostgreSQL
  try {
    for (const key of ['sales_pi_store', 'proforma_invoice_store']) {
      await pool.query(`
        UPDATE public.controlroom_store
        SET data = (
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM jsonb_array_elements(data) elem
              WHERE LOWER(TRIM(elem->>'piNo')) = $1 OR LOWER(TRIM(elem->>'id')) = $1
            ) THEN (
              SELECT jsonb_agg(
                CASE 
                  WHEN LOWER(TRIM(elem->>'piNo')) = $1 OR LOWER(TRIM(elem->>'id')) = $1
                  THEN elem || $2::jsonb
                  ELSE elem
                END
              ) FROM jsonb_array_elements(data) elem
            )
            ELSE jsonb_insert(data, '{0}', $2::jsonb)
          END
        ),
        updated_at = NOW()
        WHERE key = $3
      `, [cleanKey, JSON.stringify(pi), key]);
    }
  } catch (err) {
    console.warn('[PI Single-Record Store Sync Warning]:', err.message);
  }
}

/**
 * Updates Zoho sync status on an existing PI in public.proforma_invoices.
 */
export async function updatePiZohoSyncStatus(piNo, zohoStatus, pool = defaultPool) {
  if (!piNo) return;
  try {
    const res = await pool.query(`
      UPDATE public.proforma_invoices
      SET zoho_synced = $1,
          zoho_estimate_id = COALESCE($2, zoho_estimate_id),
          zoho_estimate_no = COALESCE($3, zoho_estimate_no),
          zoho_sync_error = $4,
          zoho_synced_at = CASE WHEN $1 THEN NOW() ELSE zoho_synced_at END,
          updated_at = NOW()
      WHERE LOWER(TRIM(pi_no)) = LOWER(TRIM($5)) OR LOWER(TRIM(id)) = LOWER(TRIM($5))
      RETURNING *;
    `, [
      Boolean(zohoStatus.zohoSynced),
      zohoStatus.zohoEstimateId || null,
      zohoStatus.zohoEstimateNo || null,
      zohoStatus.zohoSyncError || null,
      piNo
    ]);

    if (res.rows.length > 0) {
      const updatedPi = toConsumerPi(res.rows[0]);
      await syncSinglePiToControlroomStore(updatedPi, pool);
      return updatedPi;
    }
  } catch (err) {
    console.error(`[updatePiZohoSyncStatus Error for ${piNo}]:`, err.message);
  }
  return null;
}
