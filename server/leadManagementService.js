import { pool, query } from './db.js';

/**
 * Execute a query with auto-connection handling
 */
export async function dbQuery(sql, params = []) {
  return query(sql, params);
}

/**
 * Execute within a transaction
 */
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    try {
      client.release();
    } catch (_) {}
  }
}

/**
 * Generate sequential Lead ID: VRM-LEAD-YYYY-XXX
 */
export async function generateNextLeadNumber() {
  const year = new Date().getFullYear();
  const prefix = `VRM-LEAD-${year}-`;
  const res = await dbQuery(
    `SELECT lead_number FROM public.leads WHERE lead_number LIKE $1 ORDER BY lead_number DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let nextSeq = 1;
  if (res.rows.length > 0 && res.rows[0].lead_number) {
    const parts = res.rows[0].lead_number.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }
  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Check if role has all-leads management privileges
 * Preserves CEO, Technical Administrator, Tech Support, and Sales Head
 */
export function canViewAllLeads(role = '', employeeCode = '') {
  const r = String(role || '').toLowerCase().trim();
  const code = String(employeeCode || '').toUpperCase().trim();
  return (
    r.includes('ceo') ||
    r.includes('md') ||
    r.includes('managing director') ||
    r.includes('technical administrator') ||
    r.includes('tech support') ||
    r.includes('technical support') ||
    r.includes('sales head') ||
    code.startsWith('CEO-') ||
    code.startsWith('TA-') ||
    code.startsWith('TS-') ||
    code.startsWith('SH-')
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
export async function getLeads({ userRole = 'Sales Executive', userEmpId = '', search = '', status = '', source = '', assignedTo = '', unassignedOnly = false }) {
  const hasGlobalView = canViewAllLeads(userRole, userEmpId);
  const cleanEmpId = String(userEmpId || '').trim();

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
      l.is_unattended_48h,
      l.created_at,
      l.updated_at,
      -- Quotation metrics
      COALESCE(q.total_distinct_quotes, 0) AS total_distinct_quotes,
      COALESCE(q.total_revisions, 0) AS total_revisions,
      COALESCE(q.quotes_sent, 0) AS quotes_sent,
      COALESCE(q.quotes_pending, 0) AS quotes_pending,
      COALESCE(q.quotes_accepted, 0) AS quotes_accepted,
      COALESCE(q.quotes_rejected, 0) AS quotes_rejected,
      q.latest_quote_amount,
      q.latest_quote_date,
      -- Activity summary
      COALESCE(act.total_activities, 0) AS total_activities,
      COALESCE(act.total_calls, 0) AS total_calls
    FROM public.leads l
    LEFT JOIN (
      SELECT 
        lead_id,
        COUNT(DISTINCT COALESCE(parent_quote_number, quote_number)) AS total_distinct_quotes,
        COUNT(*) FILTER (WHERE (revision_number IS NOT NULL AND revision_number > 0) OR parent_quote_number IS NOT NULL) AS total_revisions,
        COUNT(*) FILTER (WHERE status ILIKE '%sent%' OR status ILIKE '%issued%') AS quotes_sent,
        COUNT(*) FILTER (WHERE status ILIKE '%pending%' OR status ILIKE '%draft%') AS quotes_pending,
        COUNT(*) FILTER (WHERE status ILIKE '%accepted%' OR status ILIKE '%approved%' OR status ILIKE '%converted%') AS quotes_accepted,
        COUNT(*) FILTER (WHERE status ILIKE '%rejected%' OR status ILIKE '%declined%') AS quotes_rejected,
        MAX(grand_total) AS latest_quote_amount,
        MAX(created_at) AS latest_quote_date
      FROM public.quotations
      WHERE lead_id IS NOT NULL
      GROUP BY lead_id
    ) q ON l.id = q.lead_id
    LEFT JOIN (
      SELECT 
        lead_id,
        COUNT(*) AS total_activities,
        COUNT(*) FILTER (WHERE activity_type = 'CALL') AS total_calls
      FROM public.lead_activities
      GROUP BY lead_id
    ) act ON l.id = act.lead_id
    WHERE 1=1
  `;

  const params = [];
  let paramIdx = 1;

  // Strict salesperson data isolation: Sales Executives can ONLY see leads assigned to their employee ID
  if (!hasGlobalView) {
    sql += ` AND (l.assigned_to_user_id = $${paramIdx} OR l.assigned_salesperson ILIKE $${paramIdx+1})`;
    params.push(cleanEmpId, `%${cleanEmpId}%`);
    paramIdx += 2;
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

  const res = await dbQuery(sql, params);
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
  const leadNumber = await generateNextLeadNumber();
  const id = `LEAD-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

  const companyName = String(leadData.companyName || leadData.customerName || '').trim();
  if (!companyName) throw new Error('Company / Customer Name is required.');

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
    leadData.phone || '',
    leadData.whatsapp || leadData.phone || '',
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

  const res = await dbQuery(sql, params);
  const created = res.rows[0];

  // Notify CEO & Tech Support of New Lead
  await createLeadNotification({
    leadId: created.id,
    type: 'NEW_LEAD',
    title: `🆕 New Lead Created: ${created.company_name}`,
    message: `Lead ${created.lead_number} created from ${created.source} by ${createdByName}. Added to Unassigned queue.`,
    metadata: { leadNumber: created.lead_number, companyName: created.company_name, source: created.source }
  });

  return created;
}

/**
 * Assign or Reassign Lead
 * Only CEO and Tech Support authorized
 * Permanently logs to public.lead_assignment_history
 * Starts/Resets the 24-hour inactivity response timer
 */
export async function assignLead({ leadId, assignedToId, assignedToName, assignedToRole, assignerUser, reason = 'Direct assignment' }) {
  if (!canAssignLeads(assignerUser.role, assignerUser.employee_code)) {
    throw new Error('Unauthorized: Only CEO and Tech Support can assign or reassign leads.');
  }

  const assignerId = assignerUser.employee_code || assignerUser.id || 'MGMT';
  const assignerName = assignerUser.employee_name || assignerUser.name || 'Management';
  const assignerRole = assignerUser.role || 'Tech Support';

  return await withTransaction(async (client) => {
    // 1. Get current lead state
    const currentRes = await client.query(`SELECT * FROM public.leads WHERE id = $1 FOR UPDATE`, [leadId]);
    if (currentRes.rows.length === 0) throw new Error('Lead not found.');
    const current = currentRes.rows[0];

    const isReassignment = Boolean(current.assigned_to_user_id && current.assigned_to_user_id !== assignedToId);
    const assignmentType = isReassignment ? 'REASSIGNMENT' : 'INITIAL';
    const assignedAt = new Date();

    // 2. Insert into permanent history (never deleted)
    const historyId = `AH-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    await client.query(`
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
    const updateRes = await client.query(`
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
      await client.query(`
        INSERT INTO public.lead_status_history (
          id, lead_id, previous_status, new_status, remarks,
          updated_by_user_id, updated_by_name, created_at
        ) VALUES ($1, $2, 'New', 'Assigned', $3, $4, $5, NOW())
      `, [statusHistId, leadId, `Assigned to ${assignedToName} by ${assignerName}`, assignerId, assignerName]);
    }

    return updateRes.rows[0];
  });

  // 5. Notify the Assigned Salesperson after successful transaction commit
  try {
    await createLeadNotification({
      leadId: result.id,
      type: 'ASSIGNMENT',
      title: `🎯 Lead Assigned to You: ${result.company_name}`,
      message: `Lead ${result.lead_number} assigned by ${assignerName} (${assignerRole}). Please contact within 24 hours.`,
      metadata: { leadNumber: result.lead_number, companyName: result.company_name, assignerName },
      specificRecipientId: assignedToId,
      specificRecipientRole: assignedToRole || 'Sales Executive'
    });
  } catch (notifErr) {
    console.warn('[Notification Notice]:', notifErr.message);
  }

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
export async function updateLeadStatus({ leadId, newStatus, remarks = '', user }) {
  const userId = user.employee_code || user.id || 'USER';
  const userName = user.employee_name || user.name || 'Sales Rep';

  return await withTransaction(async (client) => {
    const leadRes = await client.query(`SELECT status FROM public.leads WHERE id = $1 FOR UPDATE`, [leadId]);
    if (leadRes.rows.length === 0) throw new Error('Lead not found.');
    const prevStatus = leadRes.rows[0].status;

    if (prevStatus === newStatus) return { success: true, message: 'Status unchanged' };

    // 1. Update status
    await client.query(`
      UPDATE public.leads SET
        status = $1,
        updated_at = NOW()
      WHERE id = $2
    `, [newStatus, leadId]);

    // 2. Audit history
    const histId = `SH-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    await client.query(`
      INSERT INTO public.lead_status_history (
        id, lead_id, previous_status, new_status, remarks,
        updated_by_user_id, updated_by_name, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [histId, leadId, prevStatus, newStatus, remarks, userId, userName]);

    return { success: true, previousStatus: prevStatus, newStatus };
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

/**
 * Create Lead Notification with Individual Recipient Tracking (CEO & Tech Support)
 * Each recipient has their own independent 'read' status!
 */
export async function createLeadNotification({ leadId = null, incidentId = null, type, title, message, metadata = {}, specificRecipientId = null, specificRecipientRole = null }) {
  const notifId = `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

  await withTransaction(async (client) => {
    // 1. Create main notification
    await client.query(`
      INSERT INTO public.lead_notifications (id, lead_id, incident_id, type, title, message, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [notifId, leadId, incidentId, type, title, message, JSON.stringify(metadata)]);

    // 2. Determine recipients
    let recipients = [];
    if (specificRecipientId) {
      recipients.push({ id: specificRecipientId, role: specificRecipientRole || 'Sales Executive' });
    } else {
      // Default management recipients: CEO, Technical Administrator, and all Tech Support users
      recipients.push({ id: 'CEO-001', role: 'CEO' });
      recipients.push({ id: 'TA-VRM001', role: 'Technical Administrator' });

      // Standard executive & support recipients: CEO, Technical Administrator, and Tech Support users
      recipients.push({ id: 'CEO-001', role: 'CEO' });
      recipients.push({ id: 'CEO-1000', role: 'CEO' });
      recipients.push({ id: 'TA-VRM001', role: 'Technical Administrator' });
      recipients.push({ id: 'TS-001', role: 'Tech Support' });
      recipients.push({ id: 'TS-010', role: 'Tech Support' });
      recipients.push({ id: 'TS-1000', role: 'Tech Support' });
    }

    // 3. Insert individual recipient records
    for (const rec of recipients) {
      const recId = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      await client.query(`
        INSERT INTO public.lead_notification_recipients (id, notification_id, recipient_user_id, recipient_role, read, created_at)
        VALUES ($1, $2, $3, $4, false, NOW())
        ON CONFLICT (notification_id, recipient_user_id) DO NOTHING
      `, [recId, notifId, rec.id, rec.role]);
    }
  });

  return { success: true, notificationId: notifId };
}

/**
 * Get notifications for a specific logged-in employee with their individual read status
 */
export async function getNotificationsForEmployee(employeeCode) {
  const cleanCode = String(employeeCode || '').trim();
  const res = await dbQuery(`
    SELECT 
      n.id,
      n.lead_id,
      n.incident_id,
      n.type,
      n.title,
      n.message,
      n.metadata,
      n.created_at,
      r.read,
      r.read_at
    FROM public.lead_notification_recipients r
    JOIN public.lead_notifications n ON r.notification_id = n.id
    WHERE r.recipient_user_id = $1
    ORDER BY n.created_at DESC
    LIMIT 100
  `, [cleanCode]);

  return res.rows;
}

/**
 * Mark a notification as read by a specific recipient
 */
export async function markNotificationRead(notificationId, employeeCode) {
  const res = await dbQuery(`
    UPDATE public.lead_notification_recipients
    SET read = true, read_at = NOW()
    WHERE notification_id = $1 AND recipient_user_id = $2
    RETURNING *
  `, [notificationId, employeeCode]);

  return { success: res.rows.length > 0 };
}

/**
 * Automatic 24-Hour & 48-Hour Inactivity Monitoring Engine
 * Scans for leads where:
 * 1. Status is 'Assigned' or 'New'
 * 2. Assigned time is > 24 hours ago
 * 3. No qualifying customer activity recorded within 24 hours of assignment
 * Idempotently creates incidents and alerts CEO & Tech Support
 */
export async function checkAndProcessLeadInactivity() {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // 1. Query candidates for 24-Hour Unattended Alert
  const candidates24 = await dbQuery(`
    SELECT l.*
    FROM public.leads l
    WHERE l.assigned_at IS NOT NULL
      AND l.assigned_at <= $1
      AND l.last_qualifying_activity_at IS NULL
      AND l.is_unattended_24h = false
      AND l.status IN ('New', 'Assigned')
  `, [twentyFourHoursAgo]);

  for (const lead of candidates24.rows) {
    try {
      const incidentId = `INC-24H-${lead.id}-${Date.now()}`;
      await withTransaction(async (client) => {
        // Record incident idempotently
        await client.query(`
          INSERT INTO public.lead_inactivity_incidents (
            id, lead_id, salesperson_id, salesperson_name, incident_type, assigned_at, alerted_at, details
          ) VALUES ($1, $2, $3, $4, '24_HOUR_UNATTENDED', $5, NOW(), $6)
          ON CONFLICT (lead_id, incident_type, salesperson_id, assigned_at) DO NOTHING
        `, [
          incidentId,
          lead.id,
          lead.assigned_to_user_id,
          lead.assigned_to_name,
          lead.assigned_at,
          JSON.stringify({ leadNumber: lead.lead_number, companyName: lead.company_name, source: lead.source })
        ]);

        // Mark lead as 24h unattended
        await client.query(`
          UPDATE public.leads
          SET is_unattended_24h = true, unattended_alert_sent_at = NOW(), updated_at = NOW()
          WHERE id = $1
        `, [lead.id]);
      });

      // Dispatch Persistent Notification to CEO & Tech Support
      await createLeadNotification({
        leadId: lead.id,
        type: 'UNATTENDED_24H',
        title: `⚠️ Lead Not Attended – 24 Hours: ${lead.company_name}`,
        message: `Customer "${lead.company_name}" (${lead.lead_number}) assigned to ${lead.assigned_to_name} has had NO qualifying activity for 24 hours.`,
        metadata: {
          leadId: lead.id,
          leadNumber: lead.lead_number,
          companyName: lead.company_name,
          salesperson: lead.assigned_to_name,
          assignedBy: `${lead.assigned_by_name} (${lead.assigned_by_role})`,
          assignedAt: lead.assigned_at
        }
      });
      console.log(`[Inactivity Engine] 24h alert generated for lead ${lead.lead_number} (${lead.company_name}).`);
    } catch (err) {
      console.warn(`[Inactivity Engine] Error processing 24h alert for lead ${lead.id}:`, err.message);
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
          lead.assigned_to_user_id,
          lead.assigned_to_name,
          lead.assigned_at,
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
}
