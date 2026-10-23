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
    salesPersonCode: row.sales_person_code || row.created_by_id || 'SE-1000',
    salesPersonEmail: row.sales_person_email || '',
    createdBy: row.created_by || row.sales_person || 'sales',
    createdById: row.created_by_id || row.sales_person_code || 'SE-1000',
    unitValue: parseFloat(row.unit_value || subTotal),
    quantity: parseFloat(row.quantity || 1),
    subtotal: subTotal,
    kitSubtotal: parseFloat(row.kit_subtotal || 0),
    taxTotal: parseFloat(row.gst_amount || 0),
    cgst: parseFloat(row.cgst_amount || 0),
    sgst: parseFloat(row.sgst_amount || 0),
    grandTotal: grandTotal,
    amount: '₹' + Math.round(grandTotal).toLocaleString('en-IN'),
    items: Array.isArray(row.items) ? row.items : [],
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
    const res = await pool.query(`
      SELECT pi_no FROM public.proforma_invoices
      WHERE pi_no ~ '^VRM-PI-[0-9]{4}-[0-9]+$'
    `);

    let maxSeq = 0;
    const regex = new RegExp(`^VRM-PI-${fy}-(\\d+)$`, 'i');

    for (const row of res.rows) {
      const match = (row.pi_no || '').match(regex);
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
    if (cleanPiNo) {
      const existRes = await client.query(
        'SELECT * FROM public.proforma_invoices WHERE LOWER(TRIM(pi_no)) = LOWER(TRIM($1)) OR LOWER(TRIM(id)) = LOWER(TRIM($1))',
        [cleanPiNo]
      );
      if (existRes.rows.length > 0) {
        existingRow = existRes.rows[0];
      }
    }

    // Auto-advance sequence if NOT an edit and PI number already taken
    if (!isEdit && existingRow) {
      const fy = getFinancialYear();
      const allRows = await client.query('SELECT pi_no FROM public.proforma_invoices WHERE pi_no ~ $1', [`^VRM-PI-${fy}-[0-9]+$`]);
      let maxSeq = 0;
      const regex = new RegExp(`^VRM-PI-${fy}-(\\d+)$`, 'i');
      for (const r of allRows.rows) {
        const m = (r.pi_no || '').match(regex);
        if (m && m[1]) {
          const v = parseInt(m[1], 10);
          if (v > maxSeq) maxSeq = v;
        }
      }
      const nextNum = maxSeq + 1;
      const advancedCode = formatSequenceCode('PI', nextNum);
      console.warn(`[PI Concurrency Protection] PI number "${cleanPiNo}" is already taken in database. Auto-advancing to "${advancedCode}".`);
      cleanPiNo = advancedCode;
      existingRow = null;
    }

    if (!cleanPiNo) {
      const seqInfo = await getNextDatabasePiNumber(pool);
      cleanPiNo = seqInfo.nextPiNo;
    }

    const subTotal = parseFloat(piData.subtotal ?? piData.sub_total ?? piData.unitValue ?? (existingRow?.sub_total || 0)) || 0;
    const taxTotal = parseFloat(piData.taxTotal ?? piData.gst_amount ?? (existingRow?.gst_amount || 0)) || 0;
    const cgst = parseFloat(piData.cgst ?? piData.cgst_amount ?? (taxTotal / 2)) || 0;
    const sgst = parseFloat(piData.sgst ?? piData.sgst_amount ?? (taxTotal / 2)) || 0;
    const grandTotal = parseFloat(piData.grandTotal ?? piData.grand_total ?? (subTotal + taxTotal)) || (subTotal + taxTotal);

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
        items, preset_groups, same_as_billing, converted_bom_no, converted_bom_code, pdf_name,
        zoho_synced, zoho_estimate_id, zoho_estimate_no, zoho_sync_error, zoho_synced_at, zoho_module,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26,
        $27, $28, $29, $30, $31, $32, $33,
        $34, $35, $36, $37, $38, $39, $40, $41,
        $42, $43, $44, $45, $46, $47,
        $48, $49, $50, $51, $52, $53,
        $54, NOW()
      )
      ON CONFLICT (LOWER(TRIM(pi_no))) DO UPDATE SET
        vendor = EXCLUDED.vendor,
        customer_name = EXCLUDED.customer_name,
        contact_person = COALESCE(NULLIF(EXCLUDED.contact_person, ''), public.proforma_invoices.contact_person),
        phone = COALESCE(NULLIF(EXCLUDED.phone, ''), public.proforma_invoices.phone),
        email = COALESCE(NULLIF(EXCLUDED.email, ''), public.proforma_invoices.email),
        gst_no = COALESCE(NULLIF(EXCLUDED.gst_no, ''), public.proforma_invoices.gst_no),
        product_name = COALESCE(NULLIF(EXCLUDED.product_name, ''), public.proforma_invoices.product_name),
        billing_address = EXCLUDED.billing_address,
        billing_address_obj = EXCLUDED.billing_address_obj,
        delivery_address = EXCLUDED.delivery_address,
        delivery_address_obj = EXCLUDED.delivery_address_obj,
        vehicle_no = COALESCE(NULLIF(EXCLUDED.vehicle_no, ''), public.proforma_invoices.vehicle_no),
        signed_pi_doc = COALESCE(EXCLUDED.signed_pi_doc, public.proforma_invoices.signed_pi_doc),
        pi_date = COALESCE(EXCLUDED.pi_date, public.proforma_invoices.pi_date),
        delivery_date = COALESCE(EXCLUDED.delivery_date, public.proforma_invoices.delivery_date),
        valid_until_date = COALESCE(EXCLUDED.valid_until_date, public.proforma_invoices.valid_until_date),
        exp_date = COALESCE(EXCLUDED.exp_date, public.proforma_invoices.exp_date),
        payment_terms = COALESCE(NULLIF(EXCLUDED.payment_terms, ''), public.proforma_invoices.payment_terms),
        credit_days = COALESCE(NULLIF(EXCLUDED.credit_days, ''), public.proforma_invoices.credit_days),
        remarks = COALESCE(NULLIF(EXCLUDED.remarks, ''), public.proforma_invoices.remarks),
        transport_mode = COALESCE(NULLIF(EXCLUDED.transport_mode, ''), public.proforma_invoices.transport_mode),
        transporter_name = COALESCE(NULLIF(EXCLUDED.transporter_name, ''), public.proforma_invoices.transporter_name),
        destination = COALESCE(NULLIF(EXCLUDED.destination, ''), public.proforma_invoices.destination),
        transport_scope = COALESCE(NULLIF(EXCLUDED.transport_scope, ''), public.proforma_invoices.transport_scope),
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
        converted_bom_no = COALESCE(EXCLUDED.converted_bom_no, public.proforma_invoices.converted_bom_no),
        converted_bom_code = COALESCE(EXCLUDED.converted_bom_code, public.proforma_invoices.converted_bom_code),
        pdf_name = COALESCE(EXCLUDED.pdf_name, public.proforma_invoices.pdf_name),
        zoho_synced = CASE WHEN EXCLUDED.zoho_synced THEN true ELSE public.proforma_invoices.zoho_synced END,
        zoho_estimate_id = COALESCE(EXCLUDED.zoho_estimate_id, public.proforma_invoices.zoho_estimate_id),
        zoho_estimate_no = COALESCE(EXCLUDED.zoho_estimate_no, public.proforma_invoices.zoho_estimate_no),
        zoho_sync_error = EXCLUDED.zoho_sync_error,
        zoho_synced_at = COALESCE(EXCLUDED.zoho_synced_at, public.proforma_invoices.zoho_synced_at),
        updated_at = NOW()
      RETURNING *;
    `;

    const vendor = String(piData.vendor || piData.customerName || existingRow?.vendor || 'Customer').trim();
    const custName = String(piData.customerName || piData.vendor || existingRow?.customer_name || vendor).trim();
    const items = Array.isArray(piData.items) ? piData.items : (existingRow?.items || []);
    const presetGroups = piData.presetGroups || existingRow?.preset_groups || {};

    const values = [
      cleanPiNo,
      cleanPiNo,
      vendor,
      custName,
      piData.contactPerson || existingRow?.contact_person || '',
      piData.phone || existingRow?.phone || '',
      piData.email || existingRow?.email || '',
      (piData.gstNo || existingRow?.gst_no || '').toUpperCase(),
      piData.productName || existingRow?.product_name || 'Solar Mounting Structures & Components',
      billingStr,
      JSON.stringify(billingObj),
      deliveryStr,
      JSON.stringify(deliveryObj),
      piData.vehicleNo || existingRow?.vehicle_no || '',
      piData.signedPiDoc || existingRow?.signed_pi_doc || null,
      piData.piDate || existingRow?.pi_date || now.split('T')[0],
      piData.deliveryDate || existingRow?.delivery_date || null,
      piData.validUntilDate || existingRow?.valid_until_date || null,
      piData.expDate || existingRow?.exp_date || null,
      piData.paymentTerms || existingRow?.payment_terms || '100% Paid',
      piData.creditDays || existingRow?.credit_days || '',
      piData.remarks || existingRow?.remarks || '',
      piData.transportMode || existingRow?.transport_mode || 'Transport',
      piData.transporterName || existingRow?.transporter_name || '',
      piData.destination || existingRow?.destination || '',
      piData.transportScope || existingRow?.transport_scope || 'VRM Structures',
      piData.status || existingRow?.status || 'Issued',
      piData.statusType || existingRow?.status_type || 'issued',
      piData.salesPerson || piData.salesperson || existingRow?.sales_person || 'sales',
      piData.salesPersonCode || existingRow?.sales_person_code || 'SE-1000',
      piData.salesPersonEmail || existingRow?.sales_person_email || '',
      piData.createdBy || existingRow?.created_by || 'sales',
      piData.createdById || existingRow?.created_by_id || 'SE-1000',
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
      piData.convertedBomNo || existingRow?.converted_bom_no || null,
      piData.convertedBomCode || existingRow?.converted_bom_code || null,
      piData.pdfName || existingRow?.pdf_name || null,
      Boolean(piData.zohoSynced || existingRow?.zoho_synced),
      piData.zohoEstimateId || existingRow?.zoho_estimate_id || null,
      piData.zohoEstimateNo || existingRow?.zoho_estimate_no || null,
      piData.zohoSyncError || null,
      piData.zohoSyncedAt || existingRow?.zoho_synced_at || null,
      piData.zohoModule || existingRow?.zoho_module || 'Quotes',
      createdAt
    ];

    const result = await client.query(upsertSql, values);
    await client.query('COMMIT');

    const savedRow = result.rows[0];
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
