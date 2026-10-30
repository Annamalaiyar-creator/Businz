import fs from 'fs';
import { getStoreFilePath, isMaintenanceModeActive } from './runtimePaths.js';
import { pool, query } from './db.js';
import { recordJobStart, recordJobEnd, recordJobOverlap } from './memoryDiagnostics.js';

/**
 * Execute a query with auto-connection handling
 */
export async function dbQuery(sql, params = []) {
  return query(sql, params);
}

/**
 * Execute within a transaction with safe statement timeout
 */
export async function withTransaction(callback, options = {}) {
  const client = await pool.connect();
  const timeoutMs = options.timeoutMs || 30000;
  try {
    await client.query('BEGIN');
    try {
      await client.query(`SET LOCAL statement_timeout = ${timeoutMs}`);
    } catch (_) {}
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    try {
      client.release();
    } catch (_) {}
  }
}

let schemaEnsured = false;
export async function ensureLeadsSchema() {
  if (schemaEnsured) return;
  try {
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS public.leads (
        id TEXT PRIMARY KEY,
        lead_number TEXT UNIQUE,
        company_name TEXT NOT NULL,
        contact_person TEXT,
        designation TEXT,
        phone TEXT,
        whatsapp TEXT,
        email TEXT,
        source TEXT DEFAULT 'Manual',
        status TEXT DEFAULT 'New',
        assigned_salesperson TEXT,
        estimated_kw NUMERIC DEFAULT 0,
        category TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE public.leads 
        ADD COLUMN IF NOT EXISTS location TEXT,
        ADD COLUMN IF NOT EXISTS product_requirement TEXT,
        ADD COLUMN IF NOT EXISTS lead_created_by_id TEXT,
        ADD COLUMN IF NOT EXISTS lead_created_by_name TEXT,
        ADD COLUMN IF NOT EXISTS assigned_by_user_id TEXT,
        ADD COLUMN IF NOT EXISTS assigned_by_name TEXT,
        ADD COLUMN IF NOT EXISTS assigned_by_role TEXT,
        ADD COLUMN IF NOT EXISTS assigned_to_user_id TEXT,
        ADD COLUMN IF NOT EXISTS assigned_to_name TEXT,
        ADD COLUMN IF NOT EXISTS assigned_to_role TEXT,
        ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'MEDIUM',
        ADD COLUMN IF NOT EXISTS next_followup_date TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS external_enquiry_id TEXT,
        ADD COLUMN IF NOT EXISTS external_payload JSONB,
        ADD COLUMN IF NOT EXISTS last_qualifying_activity_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS last_activity_type TEXT,
        ADD COLUMN IF NOT EXISTS is_unattended_24h BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS is_unattended_2h BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS is_unattended_48h BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS unattended_alert_sent_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS escalation_alert_sent_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS converted_customer_id TEXT,
        ADD COLUMN IF NOT EXISTS converted_customer_code TEXT;

      CREATE TABLE IF NOT EXISTS public.lead_assignment_history (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
        assigned_by_user_id TEXT NOT NULL,
        assigned_by_name TEXT NOT NULL,
        assigned_by_role TEXT NOT NULL,
        assigned_to_user_id TEXT NOT NULL,
        assigned_to_name TEXT NOT NULL,
        assigned_to_role TEXT NOT NULL,
        previous_assigned_to_user_id TEXT,
        previous_assigned_to_name TEXT,
        assignment_reason TEXT,
        assignment_type TEXT NOT NULL DEFAULT 'INITIAL',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.lead_activities (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
        activity_type TEXT NOT NULL,
        is_qualifying_activity BOOLEAN NOT NULL DEFAULT false,
        summary TEXT NOT NULL,
        customer_response TEXT,
        call_duration_seconds INT,
        conducted_by_user_id TEXT NOT NULL,
        conducted_by_name TEXT NOT NULL,
        conducted_by_role TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.lead_status_history (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
        previous_status TEXT,
        new_status TEXT NOT NULL,
        remarks TEXT,
        updated_by_user_id TEXT NOT NULL,
        updated_by_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.lead_followups (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
        scheduled_at TIMESTAMPTZ NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        assigned_salesperson_id TEXT NOT NULL,
        assigned_salesperson_name TEXT NOT NULL,
        completed_at TIMESTAMPTZ,
        outcome_remarks TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.lead_inactivity_incidents (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
        salesperson_id TEXT NOT NULL,
        salesperson_name TEXT NOT NULL,
        incident_type TEXT NOT NULL,
        assigned_at TIMESTAMPTZ NOT NULL,
        alerted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        resolved_by_user_id TEXT,
        resolution_type TEXT,
        details JSONB
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_inactivity_unique_incident 
        ON public.lead_inactivity_incidents(lead_id, incident_type, salesperson_id, assigned_at);
    `);
    schemaEnsured = true;
    console.log('✅ [PostgreSQL] Ensured public.leads columns and CRM tables exist.');
  } catch (err) {
    console.warn('[PostgreSQL Leads Schema Notice]:', err.message);
  }
}

/**
 * Generate sequential Lead ID: VRM-LD-YYYY-XX (e.g. VRM-LD-2026-01)
 */
export async function generateNextLeadNumber() {
  const year = new Date().getFullYear();
  const prefix = `VRM-LD-${year}-`;
  const res = await dbQuery(
    `SELECT lead_number, id FROM public.leads WHERE lead_number LIKE $1 OR lead_number LIKE $2 OR id LIKE $1 OR id LIKE $2 ORDER BY created_at DESC`,
    [`${prefix}%`, `VRM-LEAD-${year}-%`]
  );

  let maxSeq = 0;
  for (const row of res.rows) {
    const str = row.lead_number || row.id || '';
    const match = str.match(/VRM-(?:LD|LEAD)-\d{4}-(\d+)/i);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num > maxSeq) maxSeq = num;
    }
  }
  const nextSeq = maxSeq + 1;
  return `${prefix}${String(nextSeq).padStart(2, '0')}`;
}

export const STAGE_RANKS = {
  'new': 1,
  'assigned': 2,
  'contacted': 3,
  'in progress': 4,
  'process': 4,
  'opportunity': 5,
  'qualified': 5,
  'proposal sent': 6,
  'converted': 7,
  'won': 7,
  'dropped': 8,
  'lost': 8,
  'disqualified': 8
};

export function getStageRank(stage) {
  if (!stage) return 1;
  const key = String(stage).toLowerCase().trim();
  return STAGE_RANKS[key] || 1;
}

/**
 * Check if role has all-leads management privileges
 * Preserves CEO, Technical Administrator, Tech Support, and Sales Head
 */
export function canViewAllLeads(role = '', employeeCode = '') {
  const r = String(role || '').toLowerCase().trim();
  const code = String(employeeCode || '').toUpperCase().trim();
  return (
    !r ||
    r.includes('ceo') ||
    r.includes('md') ||
    r.includes('managing director') ||
    r.includes('technical administrator') ||
    r.includes('technical admin') ||
    r.includes('tech support') ||
    r.includes('technical support') ||
    r.includes('tech_support') ||
    r.includes('admin') ||
    r.includes('super admin') ||
    r.includes('developer') ||
    r.includes('sales head') ||
    code.startsWith('CEO-') ||
    code.startsWith('TA-') ||
    code.startsWith('TS-') ||
    code.startsWith('SH-') ||
    code.startsWith('ADM-')
  );
}

/**
 * Check if role can assign or reassign leads
 * Strictly restricted to CEO and Tech Support (plus Technical Administrator)
 */
export function canAssignLeads(role = '', employeeCode = '') {
  const r = String(role || '').toLowerCase().trim();
  const code = String(employeeCode || '').toUpperCase().trim();
  return (
    r.includes('ceo') ||
    r.includes('md') ||
    r.includes('managing director') ||
    r.includes('technical administrator') ||
    r.includes('tech support') ||
    r.includes('technical support') ||
    code.startsWith('CEO-') ||
    code.startsWith('TA-') ||
    code.startsWith('TS-')
  );
}

/**
 * Fetch Leads with Role-Based Scoping & Comprehensive Quotation & Activity Aggregations
 */
export async function getLeads({ userRole = '', userEmpId = '', userName = '', search = '', status = '', source = '', assignedTo = '', unassignedOnly = false }) {
  const hasGlobalView = canViewAllLeads(userRole, userEmpId);
  const cleanEmpId = String(userEmpId || '').trim();
  const cleanName = String(userName || '').trim();

  let sql = `
    SELECT 
      l.id,
      l.lead_number,
      l.company_name,
      l.contact_person,
      l.designation,
      l.phone,
      l.whatsapp,
      l.email,
      l.location,
      l.source,
      l.status,
      l.product_requirement,
      l.priority,
      l.estimated_kw,
      l.category,
      l.notes,
      l.converted_customer_id,
      l.converted_customer_code,
      l.lead_created_by_id,
      l.lead_created_by_name,
      l.assigned_by_user_id,
      l.assigned_by_name,
      l.assigned_by_role,
      l.assigned_to_user_id,
      l.assigned_to_name,
      l.assigned_to_role,
      l.assigned_at,
      l.next_followup_date,
      l.external_enquiry_id,
      l.external_payload,
      l.last_qualifying_activity_at,
      l.last_activity_at,
      l.last_activity_type,
      l.is_unattended_24h,
      l.is_unattended_2h,
      l.is_unattended_48h,
      l.created_at,
      l.updated_at
    FROM public.leads l
    WHERE 1=1
  `;

  const params = [];
  let paramIdx = 1;

  // Salesperson data isolation: Sales Executives can see leads assigned to their employee ID or Name, PLUS unassigned leads
  if (!hasGlobalView) {
    if (cleanEmpId || cleanName) {
      const orClauses = [];
      if (cleanEmpId) {
        orClauses.push(`LOWER(TRIM(COALESCE(l.assigned_to_user_id, ''))) = LOWER(TRIM($${paramIdx}))`);
        params.push(cleanEmpId);
        paramIdx++;
      }
      if (cleanName) {
        orClauses.push(`l.assigned_to_name ILIKE $${paramIdx}`);
        orClauses.push(`l.assigned_salesperson ILIKE $${paramIdx}`);
        params.push(`%${cleanName}%`);
        paramIdx++;
      }
      orClauses.push(`(l.assigned_to_user_id IS NULL OR l.assigned_to_user_id = '' OR l.status = 'New')`);
      sql += ` AND (${orClauses.join(' OR ')})`;
    }
  }

  if (unassignedOnly) {
    sql += ` AND (l.assigned_to_user_id IS NULL OR l.assigned_to_user_id = '' OR l.status = 'New')`;
  }

  if (status && status !== 'All') {
    sql += ` AND l.status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }

  if (source && source !== 'All') {
    sql += ` AND l.source = $${paramIdx}`;
    params.push(source);
    paramIdx++;
  }

  if (assignedTo && assignedTo !== 'All') {
    sql += ` AND l.assigned_to_user_id = $${paramIdx}`;
    params.push(assignedTo);
    paramIdx++;
  }

  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    sql += ` AND (
      LOWER(l.company_name) LIKE $${paramIdx} OR 
      LOWER(l.contact_person) LIKE $${paramIdx} OR 
      LOWER(l.phone) LIKE $${paramIdx} OR 
      LOWER(l.email) LIKE $${paramIdx} OR 
      LOWER(l.lead_number) LIKE $${paramIdx} OR 
      LOWER(COALESCE(l.product_requirement, '')) LIKE $${paramIdx} OR
      LOWER(COALESCE(l.location, '')) LIKE $${paramIdx}
    )`;
    params.push(q);
    paramIdx++;
  }

  sql += ` ORDER BY l.created_at DESC`;

  let res;
  try {
    res = await dbQuery(sql, params);
  } catch (queryErr) {
    console.warn('[getLeads] Primary query failed, attempting auto-heal...', queryErr.message);
    try {
      await ensureLeadsSchema();
      res = await dbQuery(sql, params);
    } catch (secondErr) {
      console.error('[getLeads] Fallback to simple select:', secondErr.message);
      res = await dbQuery(`SELECT * FROM public.leads ORDER BY created_at DESC`, []);
    }
  }
  return res.rows;
}

/**
 * Fetch a single lead by ID with its complete history
 */
export async function getLeadDetail(leadId) {
  const leadRes = await dbQuery(
    `SELECT l.*,
      COALESCE(q.total_distinct_quotes, 0) AS total_distinct_quotes,
      COALESCE(q.total_revisions, 0) AS total_revisions,
      q.latest_quote_amount,
      q.latest_quote_date
    FROM public.leads l
    LEFT JOIN (
      SELECT 
        lead_id,
        COUNT(DISTINCT COALESCE(parent_quote_number, quote_number)) AS total_distinct_quotes,
        COUNT(*) FILTER (WHERE (revision_number IS NOT NULL AND revision_number > 0) OR parent_quote_number IS NOT NULL) AS total_revisions,
        MAX(grand_total) AS latest_quote_amount,
        MAX(created_at) AS latest_quote_date
      FROM public.quotations
      WHERE lead_id = $1
      GROUP BY lead_id
    ) q ON l.id = q.lead_id
    WHERE l.id = $1 OR l.lead_number = $1`,
    [leadId]
  );

  if (leadRes.rows.length === 0) return null;
  const lead = leadRes.rows[0];

  const [assignmentHist, activities, statusHist, followups, linkedQuotes] = await Promise.all([
    dbQuery(`SELECT * FROM public.lead_assignment_history WHERE lead_id = $1 ORDER BY created_at DESC`, [lead.id]),
    dbQuery(`SELECT * FROM public.lead_activities WHERE lead_id = $1 ORDER BY created_at DESC`, [lead.id]),
    dbQuery(`SELECT * FROM public.lead_status_history WHERE lead_id = $1 ORDER BY created_at DESC`, [lead.id]),
    dbQuery(`SELECT * FROM public.lead_followups WHERE lead_id = $1 ORDER BY scheduled_at ASC`, [lead.id]),
    dbQuery(`SELECT id, quote_number, grand_total, status, salesperson, revision_number, parent_quote_number, created_at FROM public.quotations WHERE lead_id = $1 ORDER BY created_at DESC`, [lead.id])
  ]);

  return {
    ...lead,
    assignmentHistory: assignmentHist.rows,
    activities: activities.rows,
    statusHistory: statusHist.rows,
    followups: followups.rows,
    quotations: linkedQuotes.rows
  };
}

/**
 * Create a new Lead
 */
export async function createLead(leadData, creatorUser = {}) {
  // Pre-transaction: Ensure schema outside transaction before BEGIN
  await ensureLeadsSchema();

  const leadNumber = leadData.lead_number || leadData.leadNumber || await generateNextLeadNumber();
  const id = leadNumber;

  const phone = String(leadData.phone || leadData.whatsapp || '').trim();
  if (!phone) throw new Error('Phone number is mandatory.');

  const companyName = String(leadData.companyName || leadData.customerName || '').trim() || (phone ? `Contact ${phone}` : 'New Lead Customer');

  const createdById = creatorUser.employee_code || creatorUser.id || 'SYSTEM';
  const createdByName = creatorUser.employee_name || creatorUser.name || 'System';

  const sql = `
    INSERT INTO public.leads (
      id, lead_number, company_name, contact_person, designation, phone, whatsapp,
      email, location, source, status, product_requirement, priority, estimated_kw,
      notes, lead_created_by_id, lead_created_by_name, external_enquiry_id, external_payload,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19,
      NOW(), NOW()
    )
    RETURNING *
  `;

  const params = [
    id,
    leadNumber,
    companyName,
    leadData.contactPerson || '',
    leadData.designation || '',
    phone,
    leadData.whatsapp || phone,
    leadData.email || '',
    leadData.location || '',
    leadData.source || 'Direct',
    'New',
    leadData.productRequirement || '',
    leadData.priority || 'MEDIUM',
    Number(leadData.estimatedKw) || 0,
    leadData.notes || '',
    createdById,
    createdByName,
    leadData.externalEnquiryId || null,
    leadData.externalPayload ? JSON.stringify(leadData.externalPayload) : null
  ];

  let pendingNotificationBroadcast = null;

  const created = await withTransaction(async (client) => {
    const res = await client.query(sql, params);
    let lead = res.rows[0];

    // If assignee was specified upon creation, assign immediately within same transaction
    if (leadData.assignedToId && leadData.assignedToName) {
      try {
        const assignedLead = await assignLead({
          client,
          leadId: lead.id,
          assignedToId: leadData.assignedToId,
          assignedToName: leadData.assignedToName,
          assignedToRole: leadData.assignedToRole || 'Sales Executive',
          assignerUser: creatorUser,
          reason: leadData.assignmentReason || 'Assigned on lead creation',
          bypassPermission: true,
          onDeferredNotification: (broadcastFn) => {
            pendingNotificationBroadcast = broadcastFn;
          }
        });
        if (assignedLead) {
          lead = assignedLead;
        }
      } catch (assignErr) {
        console.error('[createLead: direct assign error]:', assignErr);
        throw assignErr;
      }
    } else {
      // Notify CEO & Tech Support of New Unassigned Lead within same transaction
      const notifResult = await createLeadNotification({
        client,
        leadId: lead.id,
        type: 'NEW_LEAD',
        title: `🆕 New Lead Created: ${lead.company_name}`,
        message: `Lead ${lead.lead_number} created from ${lead.source} by ${createdByName}. Added to Unassigned queue.`,
        metadata: { leadNumber: lead.lead_number, companyName: lead.company_name, source: lead.source }
      });
      if (notifResult?.deferredBroadcast) {
        pendingNotificationBroadcast = notifResult.deferredBroadcast;
      }
    }

    return lead;
  });

  // Post-commit: Broadcast realtime notification only after transaction has successfully committed
  if (typeof pendingNotificationBroadcast === 'function') {
    try {
      pendingNotificationBroadcast();
    } catch (sseErr) {
      console.warn('[createLead: post-commit SSE broadcast notice]:', sseErr.message);
    }
  }

  return created;
}

/**
 * Update an existing lead record
 */
export async function updateLead(leadId, leadData = {}) {
  const companyName = leadData.companyName !== undefined ? leadData.companyName : (leadData.company_name !== undefined ? leadData.company_name : null);
  const contactPerson = leadData.contactPerson !== undefined ? leadData.contactPerson : (leadData.contact_person !== undefined ? leadData.contact_person : null);
  const designation = leadData.designation !== undefined ? leadData.designation : null;
  const phone = leadData.phone !== undefined ? leadData.phone : null;
  const whatsapp = leadData.whatsapp !== undefined ? leadData.whatsapp : null;
  const email = leadData.email !== undefined ? leadData.email : null;
  const location = leadData.location !== undefined ? leadData.location : null;
  const productRequirement = leadData.productRequirement !== undefined ? leadData.productRequirement : (leadData.product_requirement !== undefined ? leadData.product_requirement : null);
  const category = leadData.category !== undefined ? leadData.category : null;
  const estimatedKw = leadData.estimatedKw !== undefined ? leadData.estimatedKw : (leadData.estimated_kw !== undefined ? leadData.estimated_kw : null);
  const notes = leadData.notes !== undefined ? leadData.notes : null;
  const priority = leadData.priority !== undefined ? leadData.priority : null;
  const status = leadData.status !== undefined ? leadData.status : null;
  const source = leadData.source !== undefined ? leadData.source : null;

  if (status) {
    const existing = await dbQuery(`SELECT status FROM public.leads WHERE id = $1 OR lead_number = $1`, [leadId]);
    if (existing.rows.length > 0) {
      const prevStatus = existing.rows[0].status;
      if (getStageRank(status) < getStageRank(prevStatus)) {
        throw new Error(`Lead stage cannot be reversed from "${prevStatus}" to "${status}". Stages can only increase.`);
      }
    }
  }

  const res = await dbQuery(
    `UPDATE public.leads
     SET company_name = COALESCE($1, company_name),
         contact_person = COALESCE($2, contact_person),
         designation = COALESCE($3, designation),
         phone = COALESCE($4, phone),
         whatsapp = COALESCE($5, whatsapp),
         email = COALESCE($6, email),
         location = COALESCE($7, location),
         product_requirement = COALESCE($8, product_requirement),
         category = COALESCE($9, category),
         estimated_kw = COALESCE($10, estimated_kw),
         notes = COALESCE($11, notes),
         priority = COALESCE($12, priority),
         status = COALESCE($13, status),
         source = COALESCE($14, source),
         updated_at = NOW()
     WHERE id = $15 OR lead_number = $15
     RETURNING *`,
    [
      companyName,
      contactPerson,
      designation,
      phone,
      whatsapp,
      email,
      location,
      productRequirement,
      category,
      estimatedKw,
      notes,
      priority,
      status,
      source,
      leadId
    ]
  );

  return res.rows[0] || null;
}


/**
 * Assign or Reassign Lead
 * Only CEO and Tech Support authorized
 * Permanently logs to public.lead_assignment_history
 * Starts/Resets the 24-hour inactivity response timer
 */
export async function assignLead({
  leadId,
  assignedToId,
  assignedToName,
  assignedToRole,
  assignerUser,
  reason = 'Direct assignment',
  bypassPermission = false,
  client = null,
  onDeferredNotification = null
}) {
  if (!bypassPermission && !canAssignLeads(assignerUser.role, assignerUser.employee_code)) {
    throw new Error('Unauthorized: Only CEO and Tech Support can assign or reassign leads.');
  }

  const assignerId = assignerUser.employee_code || assignerUser.id || 'MGMT';
  const assignerName = assignerUser.employee_name || assignerUser.name || 'Management';
  const assignerRole = assignerUser.role || 'Tech Support';

  const executeAssignment = async (activeClient) => {
    // 1. Get current lead state
    const currentRes = await activeClient.query(`SELECT * FROM public.leads WHERE id = $1 FOR UPDATE`, [leadId]);
    if (currentRes.rows.length === 0) throw new Error('Lead not found.');
    const current = currentRes.rows[0];

    const isReassignment = Boolean(current.assigned_to_user_id && current.assigned_to_user_id !== assignedToId);
    const assignmentType = isReassignment ? 'REASSIGNMENT' : 'INITIAL';
    const assignedAt = new Date();

    // 2. Insert into permanent history (never deleted)
    const historyId = `AH-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    await activeClient.query(`
      INSERT INTO public.lead_assignment_history (
        id, lead_id, assigned_by_user_id, assigned_by_name, assigned_by_role,
        assigned_to_user_id, assigned_to_name, assigned_to_role,
        previous_assigned_to_user_id, previous_assigned_to_name,
        assignment_reason, assignment_type, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      historyId,
      leadId,
      assignerId,
      assignerName,
      assignerRole,
      assignedToId,
      assignedToName,
      assignedToRole || 'Sales Executive',
      current.assigned_to_user_id || null,
      current.assigned_to_name || null,
      reason,
      assignmentType,
      assignedAt
    ]);

    // 3. Update the lead record
    const updateRes = await activeClient.query(`
      UPDATE public.leads SET
        assigned_by_user_id = $1,
        assigned_by_name = $2,
        assigned_by_role = $3,
        assigned_to_user_id = $4,
        assigned_to_name = $5,
        assigned_to_role = $6,
        assigned_at = $7,
        status = CASE WHEN status = 'New' THEN 'Assigned' ELSE status END,
        is_unattended_24h = false,
        is_unattended_48h = false,
        unattended_alert_sent_at = NULL,
        escalation_alert_sent_at = NULL,
        updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `, [
      assignerId,
      assignerName,
      assignerRole,
      assignedToId,
      assignedToName,
      assignedToRole || 'Sales Executive',
      assignedAt,
      leadId
    ]);

    // 4. Record status change if transitioned from New to Assigned
    if (current.status === 'New') {
      const statusHistId = `SH-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      await activeClient.query(`
        INSERT INTO public.lead_status_history (
          id, lead_id, previous_status, new_status, remarks,
          updated_by_user_id, updated_by_name, created_at
        ) VALUES ($1, $2, 'New', 'Assigned', $3, $4, $5, NOW())
      `, [statusHistId, leadId, `Assigned to ${assignedToName} by ${assignerName}`, assignerId, assignerName]);
    }

    return updateRes.rows[0];
  };

  const result = client ? await executeAssignment(client) : await withTransaction(executeAssignment);

  // 5. Notify the Assigned Salesperson after successful transaction commit
  try {
    const notifResult = await createLeadNotification({
      client,
      leadId: result.id,
      type: 'ASSIGNMENT',
      title: `🎯 Lead Assigned to You: ${result.company_name}`,
      message: `Lead ${result.lead_number} assigned by ${assignerName} (${assignerRole}). Please contact within 24 hours.`,
      metadata: { leadNumber: result.lead_number, companyName: result.company_name, assignerName },
      specificRecipientId: assignedToId,
      specificRecipientRole: assignedToRole || 'Sales Executive'
    });

    if (notifResult?.deferredBroadcast) {
      if (typeof onDeferredNotification === 'function') {
        onDeferredNotification(notifResult.deferredBroadcast);
      }
      Object.defineProperty(result, '_deferredNotification', {
        value: notifResult.deferredBroadcast,
        enumerable: false,
        configurable: true
      });
    }
  } catch (notifErr) {
    if (client) {
      // Mandatory notification write failure within outer transaction (e.g. createLead)
      // must propagate so the entire outer transaction is rolled back (leads, history, notifications)
      throw notifErr;
    }
    // Preserve historical standalone assignment behavior: log warning without reversing already committed assignment
    console.warn('[Notification Notice]:', notifErr.message);
  }

  // Preserve historical return contract: return database lead row directly without leaking internal fields
  return result;
}

/**
 * Record a Customer Interaction Activity (Call, WhatsApp, Email, Meeting)
 * Strictly marks is_qualifying_activity = true ONLY for genuine customer interactions.
 * Clears/Satisfies the 24-hour inactivity timer.
 */
export async function recordLeadActivity({ leadId, activityType, summary, customerResponse = '', callDurationSeconds = 0, user }) {
  const qualifyingTypes = ['CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'SITE_VISIT', 'QUOTATION_SENT'];
  const isQualifying = qualifyingTypes.includes(String(activityType).toUpperCase());

  const userId = user.employee_code || user.id || 'USER';
  const userName = user.employee_name || user.name || 'Sales Rep';
  const userRole = user.role || 'Sales Executive';

  return await withTransaction(async (client) => {
    const actId = `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const now = new Date();

    // 1. Insert activity log
    await client.query(`
      INSERT INTO public.lead_activities (
        id, lead_id, activity_type, is_qualifying_activity, summary,
        customer_response, call_duration_seconds, conducted_by_user_id,
        conducted_by_name, conducted_by_role, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      actId,
      leadId,
      activityType.toUpperCase(),
      isQualifying,
      summary,
      customerResponse,
      Number(callDurationSeconds) || 0,
      userId,
      userName,
      userRole,
      now
    ]);

    // 2. If it is a qualifying customer interaction, satisfy the 24h inactivity timer and update status to Contacted if still Assigned
    if (isQualifying) {
      await client.query(`
        UPDATE public.leads SET
          last_qualifying_activity_at = $1,
          last_activity_at = $1,
          last_activity_type = $2,
          is_unattended_24h = false,
          is_unattended_48h = false,
          status = CASE WHEN status = 'Assigned' THEN 'Contacted' ELSE status END,
          updated_at = NOW()
        WHERE id = $3
      `, [now, activityType.toUpperCase(), leadId]);

      // Resolve any open inactivity incidents for this lead
      await client.query(`
        UPDATE public.lead_inactivity_incidents SET
          resolved_at = NOW(),
          resolved_by_user_id = $1,
          resolution_type = 'CUSTOMER_CONTACTED'
        WHERE lead_id = $2 AND resolved_at IS NULL
      `, [userId, leadId]);
    } else {
      // General view / note activity: record last_activity_at but DO NOT clear 24h timer!
      await client.query(`
        UPDATE public.leads SET
          last_activity_at = $1,
          last_activity_type = $2,
          updated_at = NOW()
        WHERE id = $3
      `, [now, activityType.toUpperCase(), leadId]);
    }

    return { success: true, activityId: actId, isQualifying };
  });
}

/**
 * Update Lead Status with Audit Trail
 * Enforces that status change alone without customer interaction does NOT bypass 24h inactivity rule
 */
export async function updateLeadStatus({ leadId, newStatus, remarks = '', convertedCustomerId = null, convertedCustomerCode = null, user }) {
  const userId = user?.employee_code || user?.id || 'USER';
  const userName = user?.employee_name || user?.name || 'Sales Rep';

  await ensureLeadsSchema();

  return await withTransaction(async (client) => {
    const leadRes = await client.query(`SELECT status, converted_customer_id, converted_customer_code FROM public.leads WHERE id = $1 OR lead_number = $1 FOR UPDATE`, [leadId]);
    if (leadRes.rows.length === 0) throw new Error('Lead not found.');
    const prevStatus = leadRes.rows[0].status;

    if (prevStatus === newStatus && !convertedCustomerId && !convertedCustomerCode) return { success: true, message: 'Status unchanged' };

    // Enforce irreversible forward progression
    if (getStageRank(newStatus) < getStageRank(prevStatus)) {
      throw new Error(`Lead stage cannot be reversed from "${prevStatus}" to "${newStatus}". Stages can only increase.`);
    }

    // 1. Update status and customer references
    await client.query(`
      UPDATE public.leads SET
        status = $1,
        converted_customer_id = COALESCE($2, converted_customer_id),
        converted_customer_code = COALESCE($3, converted_customer_code),
        updated_at = NOW()
      WHERE id = $4 OR lead_number = $4
    `, [newStatus, convertedCustomerId, convertedCustomerCode, leadId]);

    // 2. Audit history
    const histId = `SH-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    await client.query(`
      INSERT INTO public.lead_status_history (
        id, lead_id, previous_status, new_status, remarks,
        updated_by_user_id, updated_by_name, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [histId, leadId, prevStatus, newStatus, remarks, userId, userName]);

    return { 
      success: true, 
      previousStatus: prevStatus, 
      newStatus,
      convertedCustomerId,
      convertedCustomerCode
    };
  });
}

/**
 * Schedule a Follow-up
 */
export async function scheduleLeadFollowup({ leadId, scheduledAt, notes = '', user }) {
  const userId = user.employee_code || user.id || 'USER';
  const userName = user.employee_name || user.name || 'Sales Rep';

  const followupId = `FUP-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const dateObj = new Date(scheduledAt);

  return await withTransaction(async (client) => {
    await client.query(`
      INSERT INTO public.lead_followups (
        id, lead_id, scheduled_at, notes, status, assigned_salesperson_id, assigned_salesperson_name, created_at
      ) VALUES ($1, $2, $3, $4, 'PENDING', $5, $6, NOW())
    `, [followupId, leadId, dateObj, notes, userId, userName]);

    await client.query(`
      UPDATE public.leads SET
        next_followup_date = $1,
        updated_at = NOW()
      WHERE id = $2
    `, [dateObj, leadId]);

    return { success: true, followupId };
  });
}

let realtimeNotificationBroadcaster = null;

export function setRealtimeNotificationBroadcaster(fn) {
  realtimeNotificationBroadcaster = fn;
}

/**
 * Helper to broadcast lead notifications over SSE gateway (DECOMMISSIONED)
 */
function broadcastLeadNotification() {
  // No-op: Notifications decommissioned
}

/**
 * Create Lead Notification (DECOMMISSIONED)
 */
export async function createLeadNotification() {
  // No-op: Notifications decommissioned
  return {
    success: true,
    notificationId: null,
    deferredBroadcast: () => {}
  };
}

/**
 * Get notifications for a specific logged-in employee (DECOMMISSIONED)
 */
export async function getNotificationsForEmployee() {
  return [];
}

/**
 * Mark a notification as read by a specific recipient (DECOMMISSIONED)
 */
export async function markNotificationRead() {
  return { success: true };
}

// Concurrency mutex, epoch fencing and job duration tracking for Inactivity Engine
let isInactivityCheckRunning = false;
let currentRunEpoch = 0;
let lastInactivityCheckStartedAt = null;
let lastInactivityCheckDurationMs = 0;
let overlappingInactivityRunsAttempted = 0;
const INACTIVITY_JOB_MAX_EXECUTION_MS = 60000; // 60s hard ceiling

export function getInactivityEngineStatus() {
  return {
    isRunning: isInactivityCheckRunning,
    currentEpoch: currentRunEpoch,
    lastStartedAt: lastInactivityCheckStartedAt ? new Date(lastInactivityCheckStartedAt).toISOString() : null,
    lastDurationMs: lastInactivityCheckDurationMs,
    overlappingRunsSkipped: overlappingInactivityRunsAttempted
  };
}

/**
 * Automatic 2-Hour Inactivity Monitoring Engine
 * Scans for leads where:
 * 1. Status is 'New', 'Assigned', 'Contacted', or 'In Progress'
 * 2. Inactive / not making progress for > 2 hours
 * 3. No qualifying customer activity recorded within 2 hours
 * Idempotently creates incidents and alerts CEO & Tech Support
 */
export async function checkAndProcessLeadInactivity(options = {}) {
  const source = options.source || 'scheduled';
  if (isMaintenanceModeActive()) {
    return { skipped: true, reason: 'MAINTENANCE_MODE', source };
  }
  if (isInactivityCheckRunning) {
    const elapsedSinceStart = lastInactivityCheckStartedAt ? (Date.now() - lastInactivityCheckStartedAt) : 0;
    // Bounded execution check: strictly prevent any second job while active job is within normal window
    if (elapsedSinceStart < INACTIVITY_JOB_MAX_EXECUTION_MS) {
      overlappingInactivityRunsAttempted++;
      recordJobOverlap('inactivityEngine');
      console.warn(`[Inactivity Engine] Check already running (started ${lastInactivityCheckStartedAt ? new Date(lastInactivityCheckStartedAt).toISOString() : 'earlier'}); skipping overlapping execution requested by ${source}. Total skipped: ${overlappingInactivityRunsAttempted}.`);
      return { skipped: true, reason: 'ALREADY_RUNNING', source, overlappingSkipped: overlappingInactivityRunsAttempted };
    }

    // Hard ceiling exceeded: Fenced cancellation (invalidates prior epoch so late responses cannot write alerts)
    console.warn(`[Inactivity Engine] Prior run exceeded ${INACTIVITY_JOB_MAX_EXECUTION_MS / 1000}s execution ceiling. Fencing prior epoch ${currentRunEpoch} to prevent concurrent alert writes.`);
    currentRunEpoch++;
    isInactivityCheckRunning = false;
  }

  isInactivityCheckRunning = true;
  const runEpoch = ++currentRunEpoch;
  lastInactivityCheckStartedAt = Date.now();
  const jobStartTime = recordJobStart('inactivityEngine');

  try {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // Fencing checkpoint 1: Verify this run is still authoritative
    if (runEpoch !== currentRunEpoch) return { aborted: true, reason: 'FENCED_BY_NEWER_RUN', runEpoch };

  // 1. Query candidates for 2-Hour Inactivity / Status Unchanged Alert
  let candidates2h = { rows: [] };
  try {
    candidates2h = await dbQuery(`
      SELECT l.*
      FROM public.leads l
      WHERE (
          (l.assigned_at IS NOT NULL AND l.assigned_at <= $1 AND l.status IN ('New', 'Assigned', 'Contacted', 'In Progress'))
          OR
          (l.created_at <= $1 AND l.status = 'New')
          OR
          (l.updated_at <= $1 AND l.status IN ('New', 'Assigned', 'Contacted', 'In Progress'))
        )
        AND (l.last_qualifying_activity_at IS NULL OR l.last_qualifying_activity_at <= $1)
        AND l.is_unattended_24h = false
    `, [twoHoursAgo]);
  } catch (dbErr) {
    console.warn('[Inactivity Engine] PostgreSQL query notice:', dbErr.message);
  }

  // Also check disk store leads if any match 2 hours without activity
  try {
    const diskPath = getStoreFilePath('crm_leads.json');
    if (fs.existsSync(diskPath)) {
      const diskData = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
      if (Array.isArray(diskData)) {
        let modified = false;
        for (const lead of diskData) {
          const isNotCompleted = ['New', 'Assigned', 'Contacted', 'In Progress'].includes(lead.status);
          const assignedTime = lead.assigned_at ? new Date(lead.assigned_at).getTime() : 0;
          const createdTime = lead.created_at ? new Date(lead.created_at).getTime() : 0;
          const updatedTime = lead.updated_at ? new Date(lead.updated_at).getTime() : 0;
          const lastActivityTime = lead.last_qualifying_activity_at ? new Date(lead.last_qualifying_activity_at).getTime() : 0;
          const referenceTime = Math.max(assignedTime, createdTime, updatedTime);

          if (
            isNotCompleted &&
            !lead.is_unattended_24h &&
            !lead.is_unattended_2h &&
            referenceTime > 0 &&
            referenceTime <= twoHoursAgo.getTime() &&
            (!lastActivityTime || lastActivityTime <= twoHoursAgo.getTime())
          ) {
            lead.is_unattended_24h = true;
            lead.is_unattended_2h = true;
            lead.unattended_alert_sent_at = new Date().toISOString();
            modified = true;

            // Trigger notification to CEO and Tech Support
            await createLeadNotification({
              leadId: lead.id,
              type: 'STATUS_UNCHANGED_2H',
              title: `⚠️ Lead Inactivity Alert (2 Hours): ${lead.company_name || lead.lead_number}`,
              message: `Lead ${lead.lead_number} (${lead.company_name || 'Customer'}) has had NO progress or status change for over 2 hours (Current Status: "${lead.status}"). Assigned: ${lead.assigned_to_name || lead.assigned_salesperson || 'Unassigned'}. Immediate attention required.`,
              metadata: {
                leadId: lead.id,
                leadNumber: lead.lead_number,
                companyName: lead.company_name,
                currentStatus: lead.status,
                salesperson: lead.assigned_to_name || lead.assigned_salesperson || 'Unassigned',
                assignedBy: lead.assigned_by_name ? `${lead.assigned_by_name} (${lead.assigned_by_role})` : 'System',
                assignedAt: lead.assigned_at,
                isCeoTechSupportAlert: true,
                step: 'STATUS_UNCHANGED_2H'
              }
            });
            console.log(`[Inactivity Engine] 2h inactivity alert sent to CEO & Tech Support for lead ${lead.lead_number} (${lead.company_name}).`);
          }
        }
        if (modified) {
          fs.writeFileSync(diskPath, JSON.stringify(diskData, null, 2), 'utf8');
        }
      }
    }
  } catch (diskErr) {
    console.warn('[Inactivity Engine] Disk store check notice:', diskErr.message);
  }

  // Fencing checkpoint 2: Ensure epoch is active before writing 2h alerts
  if (runEpoch !== currentRunEpoch) return { aborted: true, reason: 'FENCED_BY_NEWER_RUN', runEpoch };

  for (const lead of (candidates2h.rows || [])) {
    try {
      const incidentId = `INC-2H-${lead.id}-${Date.now()}`;
      await withTransaction(async (client) => {
        // Record incident idempotently
        await client.query(`
          INSERT INTO public.lead_inactivity_incidents (
            id, lead_id, salesperson_id, salesperson_name, incident_type, assigned_at, alerted_at, details
          ) VALUES ($1, $2, $3, $4, '2_HOUR_UNATTENDED', $5, NOW(), $6)
          ON CONFLICT (lead_id, incident_type, salesperson_id, assigned_at) DO NOTHING
        `, [
          incidentId,
          lead.id,
          lead.assigned_to_user_id || 'UNASSIGNED',
          lead.assigned_to_name || 'Unassigned',
          lead.assigned_at || lead.created_at || new Date().toISOString(),
          JSON.stringify({ leadNumber: lead.lead_number, companyName: lead.company_name, source: lead.source, status: lead.status })
        ]);

        // Mark lead as 2h unattended
        await client.query(`
          UPDATE public.leads
          SET is_unattended_24h = true, unattended_alert_sent_at = NOW(), updated_at = NOW()
          WHERE id = $1
        `, [lead.id]);
      });

      // Dispatch Persistent Notification to CEO & Tech Support
      await createLeadNotification({
        leadId: lead.id,
        type: 'STATUS_UNCHANGED_2H',
        title: `⚠️ Lead Inactivity Alert (2 Hours): ${lead.company_name || lead.lead_number}`,
        message: `Lead ${lead.lead_number} (${lead.company_name || 'Customer'}) has had NO progress or status change for over 2 hours (Current Status: "${lead.status}"). Assigned: ${lead.assigned_to_name || lead.assigned_salesperson || 'Unassigned'}. Immediate attention required.`,
        metadata: {
          leadId: lead.id,
          leadNumber: lead.lead_number,
          companyName: lead.company_name,
          currentStatus: lead.status,
          salesperson: lead.assigned_to_name || lead.assigned_salesperson || 'Unassigned',
          assignedBy: lead.assigned_by_name ? `${lead.assigned_by_name} (${lead.assigned_by_role})` : 'System',
          assignedAt: lead.assigned_at,
          isCeoTechSupportAlert: true,
          step: 'STATUS_UNCHANGED_2H'
        }
      });
      console.log(`[Inactivity Engine] 2h status unchanged alert generated for lead ${lead.lead_number} (${lead.company_name}).`);
    } catch (err) {
      console.warn(`[Inactivity Engine] Error processing 2h alert for lead ${lead.id}:`, err.message);
    }
  }

  // 2. Query candidates for 48-Hour Escalation Alert
  const candidates48 = await dbQuery(`
    SELECT l.*
    FROM public.leads l
    WHERE l.assigned_at IS NOT NULL
      AND l.assigned_at <= $1
      AND l.last_qualifying_activity_at IS NULL
      AND l.is_unattended_48h = false
      AND l.status IN ('New', 'Assigned')
  `, [fortyEightHoursAgo]);

  // Fencing checkpoint 3: Ensure epoch is active before writing 48h alerts
  if (runEpoch !== currentRunEpoch) return { aborted: true, reason: 'FENCED_BY_NEWER_RUN', runEpoch };

  for (const lead of candidates48.rows) {
    try {
      const incidentId = `INC-48H-${lead.id}-${Date.now()}`;
      await withTransaction(async (client) => {
        await client.query(`
          INSERT INTO public.lead_inactivity_incidents (
            id, lead_id, salesperson_id, salesperson_name, incident_type, assigned_at, alerted_at, details
          ) VALUES ($1, $2, $3, $4, '48_HOUR_ESCALATION', $5, NOW(), $6)
          ON CONFLICT (lead_id, incident_type, salesperson_id, assigned_at) DO NOTHING
        `, [
          incidentId,
          lead.id,
          lead.assigned_to_user_id || 'UNASSIGNED',
          lead.assigned_to_name || 'Unassigned',
          lead.assigned_at || lead.created_at || new Date().toISOString(),
          JSON.stringify({ leadNumber: lead.lead_number, companyName: lead.company_name, source: lead.source })
        ]);

        await client.query(`
          UPDATE public.leads
          SET is_unattended_48h = true, escalation_alert_sent_at = NOW(), updated_at = NOW()
          WHERE id = $1
        `, [lead.id]);
      });

      await createLeadNotification({
        leadId: lead.id,
        type: 'ESCALATION_48H',
        title: `🚨 ESCALATION: Lead Unattended Over 48 Hours: ${lead.company_name}`,
        message: `CRITICAL: Lead ${lead.lead_number} for "${lead.company_name}" assigned to ${lead.assigned_to_name} remains completely unattended after 48 hours! Please review for immediate reassignment.`,
        metadata: {
          leadId: lead.id,
          leadNumber: lead.lead_number,
          companyName: lead.company_name,
          salesperson: lead.assigned_to_name,
          assignedBy: `${lead.assigned_by_name} (${lead.assigned_by_role})`,
          assignedAt: lead.assigned_at
        }
      });
      console.log(`[Inactivity Engine] 48h escalation generated for lead ${lead.lead_number} (${lead.company_name}).`);
    } catch (err) {
      console.warn(`[Inactivity Engine] Error processing 48h escalation for lead ${lead.id}:`, err.message);
    }
  }

  // 3. Query candidates for Missed Follow-ups
  const missedFollowups = await dbQuery(`
    SELECT f.*, l.company_name, l.lead_number
    FROM public.lead_followups f
    JOIN public.leads l ON f.lead_id = l.id
    WHERE f.scheduled_at <= $1 AND f.status = 'PENDING'
  `, [now]);

  // Fencing checkpoint 4: Ensure epoch is active before writing missed follow-ups
  if (runEpoch !== currentRunEpoch) return { aborted: true, reason: 'FENCED_BY_NEWER_RUN', runEpoch };

  for (const f of missedFollowups.rows) {
    try {
      await dbQuery(`UPDATE public.lead_followups SET status = 'MISSED' WHERE id = $1`, [f.id]);
      await createLeadNotification({
        leadId: f.lead_id,
        type: 'MISSED_FOLLOWUP',
        title: `⏰ Overdue Follow-up: ${f.company_name}`,
        message: `Scheduled follow-up for lead ${f.lead_number} (${f.company_name}) by ${f.assigned_salesperson_name} was missed.`,
        metadata: { leadNumber: f.lead_number, companyName: f.company_name, scheduledAt: f.scheduled_at }
      });
    } catch (_) {}
  }
  return { success: true };
} finally {
  lastInactivityCheckDurationMs = Date.now() - jobStartTime;
  recordJobEnd('inactivityEngine', jobStartTime);
  // Only release mutex if this run is still the authoritative epoch
  if (runEpoch === currentRunEpoch) {
    isInactivityCheckRunning = false;
  }
}
}
