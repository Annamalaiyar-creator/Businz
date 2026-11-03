import { dbQuery, withTransaction, createLeadNotification } from './leadManagementService.js';
import { encryptApiKey, decryptApiKey } from './indiaMartCrypto.js';
import { isOptimizationTestMode } from './optimizationTestGuard.js';

const INDIAMART_CRM_API_BASE = 'https://mapi.indiamart.com/wservce/crm/crmListing/v2/';

/**
 * Get IndiaMART integration configuration (masked for security)
 */
export async function getIndiaMartConfig() {
  const res = await dbQuery(`SELECT * FROM public.indiamart_configurations WHERE id = 'primary'`);
  if (res.rows.length === 0) {
    return {
      glusr_mobile_num: '',
      key_masked: '',
      is_active: false,
      auto_sync_enabled: true,
      sync_interval_minutes: 15,
      last_sync_at: null,
      status: 'DISCONNECTED',
      last_error: null
    };
  }
  const row = res.rows[0];
  return {
    glusr_mobile_num: row.glusr_mobile_num || '',
    mobile_number: row.glusr_mobile_num || '',
    key_masked: row.key_masked || '',
    crm_api_key_masked: row.key_masked || '',
    has_key: !!row.encrypted_key,
    is_active: row.is_active || false,
    auto_sync_enabled: row.auto_sync_enabled !== false,
    sync_interval_minutes: row.sync_interval_minutes || 15,
    last_sync_at: row.last_sync_at,
    last_sync_status: row.status || 'DISCONNECTED',
    status: row.status || 'DISCONNECTED',
    last_error: row.last_error
  };
}

/**
 * Save IndiaMART integration configuration with AES-256-GCM encryption
 */
export async function saveIndiaMartConfig({ mobileNumber, crmApiKey, autoSyncEnabled = true, syncIntervalMinutes = 15 }) {
  const cleanMobile = String(mobileNumber || '').trim();
  const cleanKey = String(crmApiKey || '').trim();

  // If a new key is provided, encrypt it. If blank/masked, retain existing.
  let enc = null;
  if (cleanKey && !cleanKey.startsWith('••••')) {
    enc = encryptApiKey(cleanKey);
  }

  const existingRes = await dbQuery(`SELECT * FROM public.indiamart_configurations WHERE id = 'primary'`);
  const exists = existingRes.rows.length > 0;

  if (exists) {
    const existing = existingRes.rows[0];
    const updateEncKey = enc ? enc.encryptedKey : existing.encrypted_key;
    const updateIv = enc ? enc.iv : existing.key_iv;
    const updateTag = enc ? enc.authTag : existing.key_auth_tag;
    const updateMasked = enc ? enc.masked : existing.key_masked;

    await dbQuery(`
      UPDATE public.indiamart_configurations SET
        glusr_mobile_num = $1,
        encrypted_key = $2,
        key_iv = $3,
        key_auth_tag = $4,
        key_masked = $5,
        auto_sync_enabled = $6,
        sync_interval_minutes = $7,
        updated_at = NOW()
      WHERE id = 'primary'
    `, [cleanMobile, updateEncKey, updateIv, updateTag, updateMasked, autoSyncEnabled, syncIntervalMinutes]);
  } else {
    const encKey = enc ? enc.encryptedKey : null;
    const iv = enc ? enc.iv : null;
    const tag = enc ? enc.authTag : null;
    const masked = enc ? enc.masked : null;

    await dbQuery(`
      INSERT INTO public.indiamart_configurations (
        id, glusr_mobile_num, encrypted_key, key_iv, key_auth_tag, key_masked,
        auto_sync_enabled, sync_interval_minutes, created_at, updated_at
      ) VALUES ('primary', $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    `, [cleanMobile, encKey, iv, tag, masked, autoSyncEnabled, syncIntervalMinutes]);
  }

  return await getIndiaMartConfig();
}

/**
 * Retrieve decrypted IndiaMART API credentials on server side
 */
async function getDecryptedCredentials() {
  const res = await dbQuery(`SELECT * FROM public.indiamart_configurations WHERE id = 'primary'`);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  if (!row.encrypted_key || !row.glusr_mobile_num) return null;

  const plainKey = decryptApiKey(row.encrypted_key, row.key_iv, row.key_auth_tag);
  return {
    mobile: row.glusr_mobile_num,
    apiKey: plainKey
  };
}

/**
 * Test IndiaMART Connection
 */
export async function testIndiaMartConnection() {
  if (isOptimizationTestMode()) {
    return {
      success: false,
      testMode: true,
      error: '[FAIL-CLOSED] External IndiaMART connection tests are blocked in optimization test mode.',
      message: 'IndiaMART connection test is blocked in optimization test mode.'
    };
  }

  const creds = await getDecryptedCredentials();
  if (!creds || !creds.apiKey || !creds.mobile) {
    return {
      success: false,
      message: 'IndiaMART configuration incomplete. Please provide registered mobile number and CRM API key.'
    };
  }

  try {
    const params = new URLSearchParams({
      glusr_crm_key: creds.apiKey,
      glusr_mobile_num: creds.mobile
    });

    const url = `${INDIAMART_CRM_API_BASE}?${params.toString()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      // Some IndiaMART endpoints respond in XML or text error
      data = { raw: text };
    }

    // Check IndiaMART standard response codes
    // CODE 200: Success
    // CODE 204: No enquiries found in current window (Valid connection!)
    // CODE 401/403/400: Invalid key or mobile
    const status = (data && data.STATUS) || (data && data.CODE);
    const isValid = response.ok || status === 200 || status === '200' || status === 204 || status === '204';

    if (isValid) {
      await dbQuery(`
        UPDATE public.indiamart_configurations SET
          status = 'CONNECTED',
          last_error = NULL,
          is_active = true,
          updated_at = NOW()
        WHERE id = 'primary'
      `);
      return {
        success: true,
        message: '✅ Connection to IndiaMART CRM API verified successfully!',
        details: data
      };
    } else {
      const errMsg = (data && data.MESSAGE) || (data && data.Error_Message) || 'IndiaMART returned error code ' + status;
      await dbQuery(`
        UPDATE public.indiamart_configurations SET
          status = 'ERROR',
          last_error = $1,
          updated_at = NOW()
        WHERE id = 'primary'
      `, [errMsg]);
      return {
        success: false,
        message: `⚠️ IndiaMART Connection Failed: ${errMsg}`,
        details: data
      };
    }
  } catch (err) {
    const errMsg = err.name === 'AbortError' ? 'IndiaMART API timed out after 8s.' : err.message;
    await dbQuery(`
      UPDATE public.indiamart_configurations SET
        status = 'ERROR',
        last_error = $1,
        updated_at = NOW()
      WHERE id = 'primary'
    `, [errMsg]);
    return { success: false, message: `⚠️ Network error connecting to IndiaMART: ${errMsg}` };
  }
}

/**
 * Synchronize Enquiries from IndiaMART CRM API
 * Idempotently imports new leads into public.leads with source = 'IndiaMART'
 */
export async function syncIndiaMartLeads(syncType = 'MANUAL') {
  if (isOptimizationTestMode()) {
    return {
      success: false,
      recordsImported: 0,
      duplicatesSkipped: 0,
      testMode: true,
      error: '[FAIL-CLOSED] External IndiaMART lead synchronization is blocked in optimization test mode.',
      message: 'IndiaMART sync is blocked in optimization test mode.'
    };
  }

  const logId = `IMLOG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const creds = await getDecryptedCredentials();

  if (!creds || !creds.apiKey || !creds.mobile) {
    await dbQuery(`
      INSERT INTO public.indiamart_sync_logs (id, sync_type, records_fetched, records_imported, duplicates_skipped, status, error_message, created_at)
      VALUES ($1, $2, 0, 0, 0, 'FAILED', 'Missing credentials', NOW())
    `, [logId, syncType]);
    return { success: false, error: 'IndiaMART credentials not configured.' };
  }

  try {
    const params = new URLSearchParams({
      glusr_crm_key: creds.apiKey,
      glusr_mobile_num: creds.mobile
    });

    const url = `${INDIAMART_CRM_API_BASE}?${params.toString()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { raw: text };
    }

    const enquiries = (data && Array.isArray(data.RESPONSE)) ? data.RESPONSE : [];
    let recordsImported = 0;
    let duplicatesSkipped = 0;

    for (const enq of enquiries) {
      const queryId = String(enq.UNIQUE_QUERY_ID || enq.QUERY_ID || enq.Enquiry_Id || enq.id || '').trim();
      if (!queryId) continue;

      const customerName = String(enq.SENDER_NAME || enq.SENDERNAME || enq.Name || 'IndiaMART Buyer').trim();
      const companyName = String(enq.SENDER_COMPANY || enq.SENDERCOMPANY || enq.Company || customerName).trim();
      const phone = String(enq.SENDER_MOBILE || enq.SENDER_PHONE || enq.Mobile || '').trim();
      const email = String(enq.SENDER_EMAIL || enq.Email || '').trim();
      const city = String(enq.SENDER_CITY || enq.City || '').trim();
      const state = String(enq.SENDER_STATE || enq.State || '').trim();
      const location = [city, state].filter(Boolean).join(', ');

      const product = String(enq.QUERY_PRODUCT_NAME || enq.PRODUCT_NAME || enq.Subject || 'Solar Structure Requirement').trim();
      const notes = String(enq.QUERY_MESSAGE || enq.ENQ_MESSAGE || enq.Message || '').trim();
      const enqDateStr = enq.DATE_TIME_RE || enq.QUERY_TIME || enq.Date;
      const enqDate = enqDateStr ? new Date(enqDateStr) : new Date();

      const leadId = `LEAD-IM-${queryId}`;
      const year = new Date().getFullYear();
      const leadNumber = `VRM-IM-${year}-${queryId.slice(-4)}`;

      // Idempotent insertion using UNIQUE (external_enquiry_id)
      const insertRes = await dbQuery(`
        INSERT INTO public.leads (
          id, lead_number, company_name, contact_person, phone, whatsapp, email,
          location, source, status, product_requirement, priority, notes,
          lead_created_by_id, lead_created_by_name, external_enquiry_id,
          external_payload, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, 'IndiaMART', 'New', $9, 'MEDIUM', $10,
          'SYSTEM_INDIAMART', 'IndiaMART Integration', $11,
          $12, $13, NOW()
        )
        ON CONFLICT (external_enquiry_id) DO NOTHING
        RETURNING id, lead_number, company_name
      `, [
        leadId,
        leadNumber,
        companyName,
        customerName,
        phone,
        phone,
        email,
        location,
        product,
        notes,
        queryId,
        JSON.stringify(enq),
        isNaN(enqDate.getTime()) ? new Date() : enqDate
      ]);

      if (insertRes.rows.length > 0) {
        recordsImported++;
        const newLead = insertRes.rows[0];

        // Notify CEO and Tech Support of newly arrived IndiaMART enquiry
        await createLeadNotification({
          leadId: newLead.id,
          type: 'INDIAMART_ENQUIRY',
          title: `🇮🇳 New IndiaMART Enquiry: ${newLead.company_name}`,
          message: `Enquiry #${queryId} from "${customerName}" for ${product}. Added to Unassigned Leads queue.`,
          metadata: { enquiryId: queryId, companyName, product, phone, location }
        });
      } else {
        duplicatesSkipped++;
      }
    }

    // Update config sync timestamp & log sync event
    await dbQuery(`
      UPDATE public.indiamart_configurations SET
        last_sync_at = NOW(),
        status = 'CONNECTED',
        last_error = NULL,
        updated_at = NOW()
      WHERE id = 'primary'
    `);

    await dbQuery(`
      INSERT INTO public.indiamart_sync_logs (
        id, sync_type, records_fetched, records_imported, duplicates_skipped, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, 'SUCCESS', NOW())
    `, [logId, syncType, enquiries.length, recordsImported, duplicatesSkipped]);

    return {
      success: true,
      recordsFetched: enquiries.length,
      recordsImported,
      duplicatesSkipped
    };
  } catch (err) {
    const errMsg = err.name === 'AbortError' ? 'IndiaMART sync timed out after 12s.' : err.message;
    await dbQuery(`
      UPDATE public.indiamart_configurations SET
        status = 'ERROR',
        last_error = $1,
        updated_at = NOW()
      WHERE id = 'primary'
    `, [errMsg]);

    await dbQuery(`
      INSERT INTO public.indiamart_sync_logs (
        id, sync_type, records_fetched, records_imported, duplicates_skipped, status, error_message, created_at
      ) VALUES ($1, $2, 0, 0, 0, 'FAILED', $3, NOW())
    `, [logId, syncType, errMsg]);

    return { success: false, error: errMsg };
  }
}

/**
 * Fetch recent IndiaMART sync logs
 */
export async function getIndiaMartSyncLogs(limit = 20) {
  const res = await dbQuery(`
    SELECT * FROM public.indiamart_sync_logs 
    ORDER BY created_at DESC 
    LIMIT $1
  `, [limit]);
  return res.rows;
}
