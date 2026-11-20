// BUSINZ Smart Leads — secured API (/api/smart-leads/*).
// Registered ONLY when ENABLE_SMART_LEADS=true. Every route requires a verified BUSINZ session,
// scopes data by role on the server, paginates lists, and writes exactly the rows that changed.
import express from 'express';
import crypto from 'crypto';
import { pool, query } from './db.js';
import {
  PIPELINE_STAGES, OPEN_STAGES, isValidStage, validateStageTransition, mapStageToLegacyStatus,
  normalizePhone, normalizeEmail, isLeadAdmin, isLeadManager, canAccessSmartLeads,
  computeLeadScore, DEFAULT_SCORING, DEFAULT_STAGE_PROBABILITIES, DEFAULT_SLA
} from './smartLeadsRules.js';

const SUMMARY_COLS = `
  l.id, l.lead_number, l.company_name, l.contact_person, l.phone, l.whatsapp, l.email, l.source,
  l.status, l.pipeline_stage, l.priority, l.temperature, l.score, l.estimated_value, l.estimated_kw,
  l.category, l.location, l.territory, l.assigned_to_user_id, l.assigned_to_name, l.next_action,
  l.next_action_due_at, l.next_action_exception, l.last_activity_at, l.lost_reason_id, l.created_at, l.updated_at`;

const EDITABLE_FIELDS = {
  company_name: 'text', contact_person: 'text', designation: 'text', phone: 'text', whatsapp: 'text',
  email: 'text', source: 'text', category: 'text', location: 'text', territory: 'text',
  product_requirement: 'text', priority: 'text', estimated_kw: 'number', estimated_value: 'number',
  next_action_exception: 'text'
};

const SORTS = {
  newest: 'l.created_at DESC', oldest: 'l.created_at ASC', score: 'l.score DESC NULLS LAST, l.created_at DESC',
  due: 'l.next_action_due_at ASC NULLS LAST', value: 'l.estimated_value DESC NULLS LAST', updated: 'l.updated_at DESC'
};

const genId = (prefix) => `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`.toUpperCase();

class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

export async function getSettings() {
  const res = await query(`SELECT key, value FROM public.lead_settings`);
  const map = Object.fromEntries(res.rows.map(r => [r.key, r.value]));
  return {
    stageProbabilities: { ...DEFAULT_STAGE_PROBABILITIES, ...(map.stage_probabilities || {}) },
    sla: { ...DEFAULT_SLA, ...(map.sla || {}) },
    scoring: { ...DEFAULT_SCORING, ...(map.scoring || {}) }
  };
}

function actorOf(session) {
  return { id: String(session.empCode || ''), name: String(session.user || session.email || 'User'), role: String(session.role || '') };
}

// Role scope: managers see everything; sales executives see only their own / created leads.
function scopeClause(session, params) {
  if (isLeadManager(session.role)) return '';
  params.push(String(session.empCode || ''));
  return ` AND (l.assigned_to_user_id = $${params.length} OR l.lead_created_by_id = $${params.length})`;
}

async function loadLeadForWrite(client, id, session) {
  const res = await client.query(
    `SELECT * FROM public.leads WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [id]
  );
  const lead = res.rows[0];
  if (!lead) throw new HttpError(404, 'Lead not found');
  if (!isLeadManager(session.role)) {
    const me = String(session.empCode || '');
    if (lead.assigned_to_user_id !== me && lead.lead_created_by_id !== me) throw new HttpError(403, 'You can only modify your own leads');
  }
  return lead;
}

// Recompute derived fields (score, next action) for ONE lead and return its summary row.
async function refreshDerived(client, id, scoring) {
  const leadRes = await client.query(`SELECT * FROM public.leads WHERE id = $1`, [id]);
  const lead = leadRes.rows[0];
  if (!lead) return null;
  const next = await client.query(
    `SELECT followup_type, notes, scheduled_at FROM public.lead_followups
      WHERE lead_id = $1 AND status = 'PENDING' ORDER BY scheduled_at ASC LIMIT 1`, [id]
  );
  const nf = next.rows[0];
  const { score, temperature, breakdown } = computeLeadScore(lead, scoring);
  const out = await client.query(
    `UPDATE public.leads l SET score = $2, temperature = $3, score_breakdown = $4::jsonb,
        next_action = $5, next_action_due_at = $6
      WHERE l.id = $1 RETURNING ${SUMMARY_COLS}`,
    [id, score, temperature, JSON.stringify(breakdown),
      nf ? `${nf.followup_type}${nf.notes ? ': ' + String(nf.notes).slice(0, 120) : ''}` : null,
      nf ? nf.scheduled_at : null]
  );
  return out.rows[0];
}

async function findDuplicates(executor, { phone, whatsapp, email, company_name }, excludeId = null) {
  const phones = [normalizePhone(phone), normalizePhone(whatsapp)].filter(Boolean);
  const mail = normalizeEmail(email);
  const company = String(company_name || '').trim().toLowerCase();
  if (!phones.length && !mail && !company) return [];
  const res = await executor.query(
    `SELECT l.id, l.lead_number, l.company_name, l.contact_person, l.phone, l.email, l.pipeline_stage, l.assigned_to_name,
            CASE
              WHEN cardinality($1::text[]) > 0 AND (RIGHT(regexp_replace(COALESCE(l.phone,''), '\\D', '', 'g'), 10) = ANY($1::text[])
                   OR RIGHT(regexp_replace(COALESCE(l.whatsapp,''), '\\D', '', 'g'), 10) = ANY($1::text[])) THEN 'phone'
              WHEN $2 <> '' AND LOWER(COALESCE(l.email,'')) = $2 THEN 'email'
              ELSE 'company'
            END AS match_on
       FROM public.leads l
      WHERE l.deleted_at IS NULL AND ($4::text IS NULL OR l.id <> $4)
        AND (
          (cardinality($1::text[]) > 0 AND (RIGHT(regexp_replace(COALESCE(l.phone,''), '\\D', '', 'g'), 10) = ANY($1::text[])
                                       OR RIGHT(regexp_replace(COALESCE(l.whatsapp,''), '\\D', '', 'g'), 10) = ANY($1::text[])))
          OR ($2 <> '' AND LOWER(COALESCE(l.email,'')) = $2)
          OR ($3 <> '' AND LOWER(TRIM(l.company_name)) = $3)
        )
      ORDER BY l.created_at DESC LIMIT 10`,
    [phones, mail, company, excludeId]
  );
  return res.rows;
}

async function nextLeadNumber(client) {
  // Serialize number generation to avoid duplicates under concurrent creates
  await client.query(`SELECT pg_advisory_xact_lock(hashtext('smart_leads_lead_number'))`);
  const year = new Date().getFullYear();
  const res = await client.query(
    `SELECT COALESCE(MAX((regexp_match(lead_number, '^VRM-(?:LD|LEAD)-\\d{4}-(\\d+)$'))[1]::int), 0) AS max_seq
       FROM public.leads WHERE lead_number LIKE $1 OR lead_number LIKE $2`,
    [`VRM-LD-${year}-%`, `VRM-LEAD-${year}-%`]
  );
  return `VRM-LD-${year}-${String((res.rows[0]?.max_seq || 0) + 1).padStart(2, '0')}`;
}

async function insertStatusHistory(client, leadId, prev, next, remarks, actor) {
  await client.query(
    `INSERT INTO public.lead_status_history (id, lead_id, previous_status, new_status, remarks, updated_by_user_id, updated_by_name, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [genId('LSH'), leadId, prev, next, remarks || null, actor.id, actor.name]
  );
}

async function insertAudit(client, leadId, field, oldV, newV, actor) {
  await client.query(
    `INSERT INTO public.lead_field_audit (lead_id, field, old_value, new_value, changed_by_user_id, changed_by_name)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [leadId, field, oldV == null ? null : String(oldV), newV == null ? null : String(newV), actor.id, actor.name]
  );
}

/**
 * @param {object} deps
 * @param {Function} deps.requireSession  Express middleware that sets req.userSession ({ empCode, user, role })
 * @param {Function} deps.broadcast       (eventType, payload) => void  (SSE)
 * @param {Function} deps.getTeam         async () => [{ user_id, name, role }]  registered BUSINZ sales staff
 * @param {Function} [deps.notify]        async (params) => void  (internal notifications)
 */
export function createSmartLeadsRouter({ requireSession, broadcast = () => {}, getTeam = async () => [], notify = async () => {} }) {
  const router = express.Router();
  router.use(express.json({ limit: '1mb' }));
  router.use(requireSession);
  router.use((req, res, next) => {
    if (!canAccessSmartLeads(req.userSession?.role)) return res.status(403).json({ success: false, error: 'Forbidden: Smart Leads access not permitted for your role' });
    next();
  });

  const wrap = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error('[Smart Leads API]', err);
      res.status(status).json({ success: false, error: err.message, ...(err.extra || {}) });
    }
  };
  const requireManager = (req) => { if (!isLeadManager(req.userSession.role)) throw new HttpError(403, 'Sales manager permission required'); };
  const requireAdmin = (req) => { if (!isLeadAdmin(req.userSession.role)) throw new HttpError(403, 'Administrator permission required'); };
  // SSE goes to every connected client, so broadcast IDs only (no contact data). Clients fetch the row via the scoped /summary route.
  const emit = (action, lead, extra = {}) => broadcast('smart_lead_changed', { action, leadId: lead?.id || extra.leadId, ownerId: lead?.assigned_to_user_id || null });

  // ---------- Meta / settings ----------
  router.get('/meta', wrap(async (req, res) => {
    const [settings, reasons, team] = await Promise.all([
      getSettings(),
      query(`SELECT id, label, is_active, sort_order FROM public.lead_lost_reasons ORDER BY sort_order, label`),
      getTeam()
    ]);
    const s = req.userSession;
    res.json({
      success: true,
      stages: PIPELINE_STAGES,
      ...settings,
      lostReasons: reasons.rows,
      team,
      me: { id: s.empCode, name: s.user, role: s.role, isManager: isLeadManager(s.role), isAdmin: isLeadAdmin(s.role) }
    });
  }));

  router.put('/settings/:key', wrap(async (req, res) => {
    requireAdmin(req);
    const keyMap = { stageProbabilities: 'stage_probabilities', sla: 'sla', scoring: 'scoring' };
    const key = keyMap[req.params.key];
    if (!key) throw new HttpError(400, 'Unknown setting');
    const value = req.body?.value;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Setting value must be an object');
    if (key === 'stage_probabilities') {
      for (const st of PIPELINE_STAGES) {
        const v = Number(value[st]);
        if (!Number.isFinite(v) || v < 0 || v > 100) throw new HttpError(400, `Probability for ${st} must be 0–100`);
      }
    }
    if (key === 'sla') {
      for (const k of Object.keys(DEFAULT_SLA)) {
        const v = Number(value[k]);
        if (!Number.isFinite(v) || v <= 0) throw new HttpError(400, `${k} must be a positive number`);
      }
    }
    await query(
      `INSERT INTO public.lead_settings (key, value, updated_by, updated_at) VALUES ($1, $2::jsonb, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [key, JSON.stringify(value), req.userSession.user]
    );
    res.json({ success: true });
  }));

  router.post('/lost-reasons', wrap(async (req, res) => {
    requireAdmin(req);
    const label = String(req.body?.label || '').trim();
    if (!label || label.length > 80) throw new HttpError(400, 'Reason label is required (max 80 chars)');
    const id = genId('LR');
    await query(
      `INSERT INTO public.lead_lost_reasons (id, label, sort_order)
       VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order),0)+1 FROM public.lead_lost_reasons))`, [id, label]
    ).catch(err => { if (err.code === '23505') throw new HttpError(409, 'This reason already exists'); throw err; });
    res.json({ success: true, reason: { id, label, is_active: true } });
  }));

  router.patch('/lost-reasons/:id', wrap(async (req, res) => {
    requireAdmin(req);
    const out = await query(
      `UPDATE public.lead_lost_reasons SET is_active = $2 WHERE id = $1 RETURNING id, label, is_active`,
      [req.params.id, req.body?.is_active !== false]
    );
    if (!out.rows[0]) throw new HttpError(404, 'Reason not found');
    res.json({ success: true, reason: out.rows[0] });
  }));

  // ---------- Lead list (paginated, summary columns only) ----------
  router.get('/leads', wrap(async (req, res) => {
    const q = req.query;
    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(5, parseInt(q.pageSize, 10) || 10));
    const params = [];
    let where = `WHERE l.deleted_at IS NULL`;
    where += scopeClause(req.userSession, params);
    if (q.search) {
      params.push(`%${String(q.search).trim().toLowerCase()}%`);
      const i = params.length;
      where += ` AND (LOWER(l.company_name) LIKE $${i} OR LOWER(COALESCE(l.contact_person,'')) LIKE $${i}
                 OR LOWER(COALESCE(l.lead_number,'')) LIKE $${i} OR LOWER(COALESCE(l.email,'')) LIKE $${i}
                 OR COALESCE(l.phone,'') LIKE $${i} OR LOWER(COALESCE(l.location,'')) LIKE $${i})`;
    }
    if (q.stage && isValidStage(q.stage)) { params.push(q.stage); where += ` AND l.pipeline_stage = $${params.length}`; }
    if (q.source) { params.push(`%${String(q.source).toLowerCase()}%`); where += ` AND LOWER(COALESCE(l.source,'')) LIKE $${params.length}`; }
    if (q.temperature) { params.push(q.temperature); where += ` AND l.temperature = $${params.length}`; }
    if (q.owner === 'unassigned') where += ` AND l.assigned_to_user_id IS NULL`;
    else if (q.owner) { params.push(q.owner); where += ` AND l.assigned_to_user_id = $${params.length}`; }
    if (q.status === 'open') where += ` AND l.pipeline_stage = ANY(ARRAY['${OPEN_STAGES.join("','")}'])`;
    if (q.due === 'overdue') where += ` AND l.next_action_due_at < NOW()`;
    else if (q.due === 'today') where += ` AND l.next_action_due_at::date = CURRENT_DATE`;
    else if (q.due === 'none') where += ` AND l.next_action_due_at IS NULL AND l.next_action_exception IS NULL AND l.pipeline_stage = ANY(ARRAY['${OPEN_STAGES.join("','")}'])`;
    if (q.from) { params.push(q.from); where += ` AND l.created_at >= $${params.length}::date`; }
    if (q.to) { params.push(q.to); where += ` AND l.created_at < ($${params.length}::date + INTERVAL '1 day')`; }

    const order = SORTS[q.sort] || SORTS.newest;
    const countParams = [...params];
    params.push(pageSize, (page - 1) * pageSize);
    const [rows, count, stageCounts] = await Promise.all([
      query(`SELECT ${SUMMARY_COLS} FROM public.leads l ${where} ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      query(`SELECT COUNT(*)::int AS n FROM public.leads l ${where}`, countParams),
      query(`SELECT l.pipeline_stage AS stage, COUNT(*)::int AS n FROM public.leads l ${where} GROUP BY 1`, countParams)
    ]);
    res.json({
      success: true, data: rows.rows, total: count.rows[0].n, page, pageSize,
      stageCounts: Object.fromEntries(stageCounts.rows.map(r => [r.stage, r.n]))
    });
  }));

  // ---------- Pipeline (Kanban): per-stage top N + totals ----------
  router.get('/pipeline', wrap(async (req, res) => {
    const perStage = Math.min(50, Math.max(5, parseInt(req.query.perStage, 10) || 20));
    const params = [];
    let where = `WHERE l.deleted_at IS NULL`;
    where += scopeClause(req.userSession, params);
    if (req.query.owner) { params.push(req.query.owner); where += ` AND l.assigned_to_user_id = $${params.length}`; }
    const settings = await getSettings();
    const totals = await query(
      `SELECT l.pipeline_stage AS stage, COUNT(*)::int AS n, COALESCE(SUM(l.estimated_value),0)::numeric AS value
         FROM public.leads l ${where} GROUP BY 1`, params
    );
    params.push(perStage);
    const cards = await query(
      `SELECT * FROM (
         SELECT ${SUMMARY_COLS}, ROW_NUMBER() OVER (PARTITION BY l.pipeline_stage ORDER BY l.score DESC NULLS LAST, l.updated_at DESC) AS rn
           FROM public.leads l ${where}
       ) t WHERE t.rn <= $${params.length}`, params
    );
    const columns = PIPELINE_STAGES.map(stage => {
      const t = totals.rows.find(r => r.stage === stage) || { n: 0, value: 0 };
      const prob = Number(settings.stageProbabilities[stage]) || 0;
      return {
        stage, probability: prob, count: t.n, value: Number(t.value),
        weightedValue: Math.round(Number(t.value) * prob / 100),
        cards: cards.rows.filter(c => c.pipeline_stage === stage)
      };
    });
    res.json({ success: true, columns });
  }));

  // ---------- Single-row summary (used by realtime merge) ----------
  router.get('/leads/:id/summary', wrap(async (req, res) => {
    const params = [req.params.id];
    const scope = scopeClause(req.userSession, params);
    const out = await query(`SELECT ${SUMMARY_COLS} FROM public.leads l WHERE l.id = $1 AND l.deleted_at IS NULL ${scope}`, params);
    if (!out.rows[0]) throw new HttpError(404, 'Lead not found');
    res.json({ success: true, lead: out.rows[0] });
  }));

  // ---------- Lead detail (Customer 360) ----------
  router.get('/leads/:id', wrap(async (req, res) => {
    const params = [req.params.id];
    const scope = scopeClause(req.userSession, params);
    const leadRes = await query(
      `SELECT l.id, l.lead_number, l.company_name, l.contact_person, l.designation, l.phone, l.whatsapp, l.email,
              l.source, l.status, l.pipeline_stage, l.priority, l.temperature, l.score, l.score_breakdown,
              l.estimated_value, l.estimated_kw, l.category, l.location, l.territory, l.product_requirement, l.notes,
              l.assigned_to_user_id, l.assigned_to_name, l.assigned_at, l.lead_created_by_name, l.next_action,
              l.next_action_due_at, l.next_action_exception, l.last_activity_at, l.last_activity_type,
              l.lost_reason_id, l.lost_remarks, l.stage_changed_at, l.is_converted, l.converted_customer_id,
              l.converted_customer_code, l.external_enquiry_id, l.created_at, l.updated_at
         FROM public.leads l WHERE l.id = $1 AND l.deleted_at IS NULL ${scope}`, params
    );
    const lead = leadRes.rows[0];
    if (!lead) throw new HttpError(404, 'Lead not found');
    const id = lead.id;
    const phone10 = normalizePhone(lead.phone || lead.whatsapp);
    const companyClean = String(lead.company_name || '').trim().toLowerCase();

    const [notes, activities, statusHist, assignHist, audit, followups, quotations, customerMatch, relatedLeads] = await Promise.all([
      query(`SELECT id, body, created_by_name, created_at FROM public.lead_notes WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 100`, [id]),
      query(`SELECT id, activity_type, summary, customer_response, conducted_by_name, created_at FROM public.lead_activities WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 100`, [id]),
      query(`SELECT id, previous_status, new_status, remarks, updated_by_name, created_at FROM public.lead_status_history WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 100`, [id]),
      query(`SELECT id, assigned_by_name, assigned_to_name, previous_assigned_to_name, assignment_reason, created_at FROM public.lead_assignment_history WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 50`, [id]),
      query(`SELECT id, field, old_value, new_value, changed_by_name, changed_at FROM public.lead_field_audit WHERE lead_id = $1 ORDER BY changed_at DESC LIMIT 100`, [id]),
      query(`SELECT id, followup_type, scheduled_at, notes, status, outcome, outcome_remarks, assigned_salesperson_name, completed_at, rescheduled_from_id, escalated_at, created_at
               FROM public.lead_followups WHERE lead_id = $1 ORDER BY scheduled_at DESC LIMIT 100`, [id]),
      query(`SELECT id, quote_number, status, grand_total, date, converted_pi_no FROM public.quotations WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 50`, [id]),
      // Customer Master cross-reference (Customer 360)
      query(`SELECT id, customer_code, company_name, customer_name, gst_number, city, state, credit_limit, credit_approved
               FROM public.customers
              WHERE (company_name IS NOT NULL AND LOWER(TRIM(company_name)) = $1)
                 OR ($2 <> '' AND (RIGHT(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = $2))
              LIMIT 1`, [companyClean, phone10]),
      // Related enquiries / repeat leads
      query(`SELECT id, lead_number, company_name, pipeline_stage, score, temperature, created_at
               FROM public.leads
              WHERE id <> $1 AND deleted_at IS NULL
                AND ((company_name IS NOT NULL AND LOWER(TRIM(company_name)) = $2)
                     OR ($3 <> '' AND (RIGHT(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = $3)))
              ORDER BY created_at DESC LIMIT 5`, [id, companyClean, phone10])
    ]);
    res.json({
      success: true, lead,
      customerMaster: customerMatch.rows[0] || null,
      relatedLeads: relatedLeads.rows,
      notes: notes.rows, activities: activities.rows, statusHistory: statusHist.rows,
      assignmentHistory: assignHist.rows, audit: audit.rows, followups: followups.rows, quotations: quotations.rows
    });
  }));

  // ---------- Duplicate check ----------
  router.post('/duplicates/check', wrap(async (req, res) => {
    const dups = await findDuplicates({ query: (t, p) => query(t, p) }, req.body || {}, req.body?.excludeId || null);
    res.json({ success: true, duplicates: dups });
  }));

  // ---------- Create ----------
  router.post('/leads', wrap(async (req, res) => {
    const b = req.body || {};
    const company = String(b.company_name || '').trim();
    if (!company) throw new HttpError(400, 'Company name is required');
    if (company.length > 200) throw new HttpError(400, 'Company name too long');
    if (!normalizePhone(b.phone) && !normalizeEmail(b.email)) throw new HttpError(400, 'Phone (10+ digits) or email is required');
    if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.email).trim())) throw new HttpError(400, 'Invalid email');
    const actor = actorOf(req.userSession);
    const settings = await getSettings();
    const team = await getTeam();

    let assignee = null;
    if (b.assigned_to_user_id) {
      if (!isLeadManager(actor.role) && b.assigned_to_user_id !== actor.id) throw new HttpError(403, 'Only managers can assign leads to others');
      assignee = team.find(t => t.user_id === b.assigned_to_user_id);
      if (!assignee) throw new HttpError(400, 'Assignee is not an active BUSINZ sales user');
    } else if (!isLeadManager(actor.role)) {
      assignee = { user_id: actor.id, name: actor.name, role: actor.role }; // sales exec owns what they create
    }

    const lead = await withTx(async (client) => {
      if (!b.force) {
        const dups = await findDuplicates(client, b);
        if (dups.length) throw new HttpError(409, 'Possible duplicate lead found', { duplicates: dups });
      }
      const id = genId('SLD');
      const leadNumber = await nextLeadNumber(client);
      const stage = 'New';
      await client.query(
        `INSERT INTO public.leads (id, lead_number, company_name, contact_person, designation, phone, whatsapp, email, source,
            status, pipeline_stage, priority, category, location, territory, product_requirement, estimated_kw, estimated_value,
            lead_created_by_id, lead_created_by_name, assigned_to_user_id, assigned_to_name, assigned_to_role,
            assigned_by_user_id, assigned_by_name, assigned_by_role, assigned_at, assigned_salesperson, stage_changed_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,
                 $24,$25,$26, CASE WHEN $21::text IS NULL THEN NULL ELSE NOW() END, $22, NOW(), NOW(), NOW())`,
        [id, leadNumber, company, b.contact_person || null, b.designation || null, b.phone || null, b.whatsapp || null,
          b.email ? String(b.email).trim() : null, b.source || 'Manual', mapStageToLegacyStatus(stage, !!assignee), stage,
          String(b.priority || 'MEDIUM').toUpperCase(), b.category || null, b.location || null, b.territory || null,
          b.product_requirement || null, Number(b.estimated_kw) || null, Number(b.estimated_value) || null,
          actor.id, actor.name, assignee?.user_id || null, assignee?.name || null, assignee?.role || null,
          assignee ? actor.id : null, assignee ? actor.name : null, assignee ? actor.role : null]
      );
      await insertStatusHistory(client, id, null, 'New', 'Lead created in Smart Leads', actor);
      if (assignee) {
        await client.query(
          `INSERT INTO public.lead_assignment_history (id, lead_id, assigned_by_user_id, assigned_by_name, assigned_by_role,
              assigned_to_user_id, assigned_to_name, assigned_to_role, assignment_reason, assignment_type, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'INITIAL',NOW())`,
          [genId('LAH'), id, actor.id, actor.name, actor.role, assignee.user_id, assignee.name, assignee.role || null, 'Assigned on creation']
        );
      }
      return refreshDerived(client, id, settings.scoring);
    });

    if (lead.assigned_to_user_id && lead.assigned_to_user_id !== actor.id) {
      notify({
        recipientEmpCode: lead.assigned_to_user_id, eventType: 'LEAD_ASSIGNED', documentType: 'LEAD', documentId: lead.id,
        title: 'New lead assigned', message: `${lead.lead_number} – ${lead.company_name} was assigned to you by ${actor.name}`,
        actorEmpCode: actor.id, actorName: actor.name, actorRole: actor.role, targetTab: 'Smart Leads', targetRecordId: lead.id,
        dedupId: `smart-lead-assign-${lead.id}-${lead.assigned_to_user_id}`
      }).catch(() => {});
    }
    emit('create', lead);
    res.status(201).json({ success: true, lead });
  }));

  // ---------- Update (whitelisted fields, field-level audit) ----------
  router.patch('/leads/:id', wrap(async (req, res) => {
    const actor = actorOf(req.userSession);
    const settings = await getSettings();
    const b = req.body || {};
    const lead = await withTx(async (client) => {
      const cur = await loadLeadForWrite(client, req.params.id, req.userSession);
      if (b.expected_updated_at && new Date(b.expected_updated_at).getTime() !== new Date(cur.updated_at).getTime()) {
        throw new HttpError(409, 'This lead was changed by someone else. Reload and try again.');
      }
      const sets = []; const params = [cur.id];
      for (const [field, type] of Object.entries(EDITABLE_FIELDS)) {
        if (!(field in b)) continue;
        let v = b[field];
        if (type === 'number') v = v === '' || v == null ? null : Number(v);
        else v = v == null ? null : String(v).trim() || null;
        if (type === 'number' && v != null && !Number.isFinite(v)) throw new HttpError(400, `${field} must be a number`);
        if (field === 'company_name' && !v) throw new HttpError(400, 'Company name is required');
        if (field === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new HttpError(400, 'Invalid email');
        if (field === 'priority' && v) v = v.toUpperCase();
        const old = cur[field];
        if (String(old ?? '') === String(v ?? '')) continue;
        params.push(v); sets.push(`${field} = $${params.length}`);
        await insertAudit(client, cur.id, field, old, v, actor);
      }
      if (!sets.length) return refreshDerived(client, cur.id, settings.scoring);
      await client.query(`UPDATE public.leads SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`, params);
      return refreshDerived(client, cur.id, settings.scoring);
    });
    emit('update', lead);
    res.json({ success: true, lead });
  }));

  // ---------- Stage change ----------
  async function changeStage(client, cur, { stage, lostReasonId, remarks }, actor, isManager) {
    const v = validateStageTransition({ from: cur.pipeline_stage, to: stage, lostReasonId, isManager });
    if (!v.ok) throw new HttpError(400, v.error);
    if (stage === 'Lost') {
      const r = await client.query(`SELECT 1 FROM public.lead_lost_reasons WHERE id = $1 AND is_active`, [lostReasonId]);
      if (!r.rows[0]) throw new HttpError(400, 'Invalid lost reason');
    }
    const legacy = mapStageToLegacyStatus(stage, !!cur.assigned_to_user_id);
    await client.query(
      `UPDATE public.leads SET pipeline_stage = $2, status = $3, stage_changed_at = NOW(), updated_at = NOW(),
          lost_reason_id = CASE WHEN $2 = 'Lost' THEN $4 ELSE NULL END,
          lost_remarks = CASE WHEN $2 = 'Lost' THEN $5 ELSE NULL END
        WHERE id = $1`,
      [cur.id, stage, legacy, lostReasonId || null, remarks || null]
    );
    await insertStatusHistory(client, cur.id, cur.pipeline_stage, stage, remarks, actor);
    if (stage === 'Won' || stage === 'Lost') {
      await client.query(`UPDATE public.lead_followups SET status = 'CANCELLED', outcome_remarks = $2 WHERE lead_id = $1 AND status = 'PENDING'`, [cur.id, `Lead closed as ${stage}`]);
    }
  }

  router.post('/leads/:id/stage', wrap(async (req, res) => {
    const actor = actorOf(req.userSession);
    const settings = await getSettings();
    const lead = await withTx(async (client) => {
      const cur = await loadLeadForWrite(client, req.params.id, req.userSession);
      await changeStage(client, cur, req.body || {}, actor, isLeadManager(actor.role));
      return refreshDerived(client, cur.id, settings.scoring);
    });
    emit('update', lead);
    res.json({ success: true, lead });
  }));

  // ---------- Assign / reassign ----------
  async function assignOne(client, cur, assignee, reason, actor) {
    if (cur.assigned_to_user_id === assignee.user_id) return false;
    await client.query(
      `UPDATE public.leads SET assigned_to_user_id = $2, assigned_to_name = $3, assigned_to_role = $4, assigned_salesperson = $3,
          assigned_by_user_id = $5, assigned_by_name = $6, assigned_by_role = $7, assigned_at = NOW(), updated_at = NOW(),
          status = CASE WHEN pipeline_stage = 'New' THEN 'Assigned' ELSE status END
        WHERE id = $1`,
      [cur.id, assignee.user_id, assignee.name, assignee.role || null, actor.id, actor.name, actor.role]
    );
    await client.query(
      `INSERT INTO public.lead_assignment_history (id, lead_id, assigned_by_user_id, assigned_by_name, assigned_by_role,
          assigned_to_user_id, assigned_to_name, assigned_to_role, previous_assigned_to_user_id, previous_assigned_to_name,
          assignment_reason, assignment_type, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())`,
      [genId('LAH'), cur.id, actor.id, actor.name, actor.role, assignee.user_id, assignee.name, assignee.role || null,
        cur.assigned_to_user_id, cur.assigned_to_name, reason || null, cur.assigned_to_user_id ? 'REASSIGNMENT' : 'INITIAL']
    );
    await client.query(`UPDATE public.lead_followups SET assigned_salesperson_id = $2, assigned_salesperson_name = $3 WHERE lead_id = $1 AND status = 'PENDING'`, [cur.id, assignee.user_id, assignee.name]);
    await insertAudit(client, cur.id, 'owner', cur.assigned_to_name, assignee.name, actor);
    return true;
  }

  const notifyAssigned = (lead, actor) => notify({
    recipientEmpCode: lead.assigned_to_user_id, eventType: 'LEAD_ASSIGNED', documentType: 'LEAD', documentId: lead.id,
    title: 'Lead assigned to you', message: `${lead.lead_number} – ${lead.company_name} was assigned to you by ${actor.name}`,
    actorEmpCode: actor.id, actorName: actor.name, actorRole: actor.role, targetTab: 'Smart Leads', targetRecordId: lead.id,
    dedupId: `smart-lead-assign-${lead.id}-${lead.assigned_to_user_id}-${Date.now()}`
  }).catch(() => {});

  router.post('/leads/:id/assign', wrap(async (req, res) => {
    requireManager(req);
    const actor = actorOf(req.userSession);
    const team = await getTeam();
    const assignee = team.find(t => t.user_id === req.body?.userId);
    if (!assignee) throw new HttpError(400, 'Assignee is not an active BUSINZ sales user');
    const settings = await getSettings();
    let changed = false;
    const lead = await withTx(async (client) => {
      const cur = await loadLeadForWrite(client, req.params.id, req.userSession);
      changed = await assignOne(client, cur, assignee, req.body?.reason, actor);
      return refreshDerived(client, cur.id, settings.scoring);
    });
    if (changed) { notifyAssigned(lead, actor); emit('update', lead); }
    res.json({ success: true, lead, changed });
  }));

  // ---------- Bulk operations (managers, single transaction) ----------
  router.post('/leads/bulk', wrap(async (req, res) => {
    requireManager(req);
    const { ids, action } = req.body || {};
    if (!Array.isArray(ids) || !ids.length || ids.length > 100) throw new HttpError(400, 'Select 1–100 leads');
    const actor = actorOf(req.userSession);
    const settings = await getSettings();
    let assignee = null;
    if (action === 'assign') {
      assignee = (await getTeam()).find(t => t.user_id === req.body.userId);
      if (!assignee) throw new HttpError(400, 'Assignee is not an active BUSINZ sales user');
    } else if (action === 'delete') {
      requireAdmin(req);
    } else if (action !== 'stage') throw new HttpError(400, 'Unknown bulk action');

    const updated = await withTx(async (client) => {
      const out = [];
      for (const id of ids) {
        const cur = await loadLeadForWrite(client, String(id), req.userSession);
        if (action === 'assign') {
          if (!(await assignOne(client, cur, assignee, req.body.reason || 'Bulk reassignment', actor))) continue;
        } else if (action === 'stage') {
          await changeStage(client, cur, req.body, actor, true);
        } else {
          await client.query(`UPDATE public.leads SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`, [cur.id]);
          await insertAudit(client, cur.id, 'deleted', null, 'Soft-deleted (bulk)', actor);
          out.push({ id: cur.id, deleted: true });
          continue;
        }
        out.push(await refreshDerived(client, cur.id, settings.scoring));
      }
      return out;
    });
    for (const l of updated) {
      if (l.deleted) emit('delete', null, { leadId: l.id });
      else { emit('update', l); if (action === 'assign') notifyAssigned(l, actor); }
    }
    res.json({ success: true, updated: updated.length });
  }));

  // ---------- Soft delete ----------
  router.delete('/leads/:id', wrap(async (req, res) => {
    requireAdmin(req);
    const actor = actorOf(req.userSession);
    await withTx(async (client) => {
      const cur = await loadLeadForWrite(client, req.params.id, req.userSession);
      await client.query(`UPDATE public.leads SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`, [cur.id]);
      await insertAudit(client, cur.id, 'deleted', null, 'Soft-deleted', actor);
    });
    emit('delete', null, { leadId: req.params.id });
    res.json({ success: true });
  }));

  // ---------- Merge duplicates (source → target) ----------
  router.post('/leads/:id/merge', wrap(async (req, res) => {
    requireManager(req);
    const sourceId = req.params.id;
    const targetId = String(req.body?.targetId || '');
    if (!targetId || targetId === sourceId) throw new HttpError(400, 'Choose a different lead to merge into');
    const actor = actorOf(req.userSession);
    const settings = await getSettings();
    const target = await withTx(async (client) => {
      const [first, second] = [sourceId, targetId].sort(); // consistent lock order prevents deadlocks
      const a = await loadLeadForWrite(client, first, req.userSession);
      const b = await loadLeadForWrite(client, second, req.userSession);
      const src = a.id === sourceId ? a : b;
      const tgt = a.id === targetId ? a : b;
      const fill = ['contact_person', 'designation', 'phone', 'whatsapp', 'email', 'category', 'location', 'territory', 'product_requirement', 'estimated_kw', 'estimated_value'];
      for (const f of fill) {
        if ((tgt[f] == null || tgt[f] === '') && src[f] != null && src[f] !== '') {
          await client.query(`UPDATE public.leads SET ${f} = $2 WHERE id = $1`, [tgt.id, src[f]]);
          await insertAudit(client, tgt.id, f, null, src[f], actor);
        }
      }
      for (const table of ['lead_activities', 'lead_status_history', 'lead_assignment_history', 'lead_followups', 'lead_notes', 'quotations']) {
        await client.query(`UPDATE public.${table} SET lead_id = $2 WHERE lead_id = $1`, [src.id, tgt.id]);
      }
      await client.query(`UPDATE public.leads SET deleted_at = NOW(), merged_into_lead_id = $2, updated_at = NOW() WHERE id = $1`, [src.id, tgt.id]);
      await client.query(`UPDATE public.leads SET updated_at = NOW() WHERE id = $1`, [tgt.id]);
      await insertAudit(client, tgt.id, 'merged', src.lead_number, `Merged ${src.lead_number} into this lead`, actor);
      await insertAudit(client, src.id, 'merged_into', null, tgt.lead_number, actor);
      return refreshDerived(client, tgt.id, settings.scoring);
    });
    emit('delete', null, { leadId: sourceId });
    emit('update', target);
    res.json({ success: true, lead: target });
  }));

  // ---------- Notes ----------
  router.post('/leads/:id/notes', wrap(async (req, res) => {
    const body = String(req.body?.body || '').trim();
    if (!body || body.length > 4000) throw new HttpError(400, 'Note is required (max 4000 chars)');
    const actor = actorOf(req.userSession);
    const note = await withTx(async (client) => {
      const cur = await loadLeadForWrite(client, req.params.id, req.userSession);
      const out = await client.query(
        `INSERT INTO public.lead_notes (id, lead_id, body, created_by_user_id, created_by_name) VALUES ($1,$2,$3,$4,$5)
         RETURNING id, body, created_by_name, created_at`, [genId('LN'), cur.id, body, actor.id, actor.name]
      );
      await client.query(`UPDATE public.leads SET updated_at = NOW() WHERE id = $1`, [cur.id]);
      return out.rows[0];
    });
    res.status(201).json({ success: true, note });
  }));

  // ---------- Activities (call / WhatsApp / email / meeting) ----------
  router.post('/leads/:id/activities', wrap(async (req, res) => {
    const type = String(req.body?.type || '').toUpperCase();
    if (!['CALL', 'WHATSAPP', 'EMAIL', 'MEETING'].includes(type)) throw new HttpError(400, 'Invalid activity type');
    const summary = String(req.body?.summary || '').trim();
    if (!summary || summary.length > 2000) throw new HttpError(400, 'Activity summary is required (max 2000 chars)');
    const actor = actorOf(req.userSession);
    const settings = await getSettings();
    const lead = await withTx(async (client) => {
      const cur = await loadLeadForWrite(client, req.params.id, req.userSession);
      await client.query(
        `INSERT INTO public.lead_activities (id, lead_id, activity_type, is_qualifying_activity, summary, customer_response,
            conducted_by_user_id, conducted_by_name, conducted_by_role, created_at)
         VALUES ($1,$2,$3,TRUE,$4,$5,$6,$7,$8,NOW())`,
        [genId('LAC'), cur.id, type, summary, req.body?.customerResponse || null, actor.id, actor.name, actor.role]
      );
      await client.query(
        `UPDATE public.leads SET last_activity_at = NOW(), last_qualifying_activity_at = NOW(), last_activity_type = $2,
            is_unattended_2h = FALSE, is_unattended_24h = FALSE, is_unattended_48h = FALSE, updated_at = NOW()
          WHERE id = $1`, [cur.id, type]
      );
      if (cur.pipeline_stage === 'New') {
        await client.query(`UPDATE public.leads SET pipeline_stage = 'Contacted', status = 'Contacted', stage_changed_at = NOW() WHERE id = $1`, [cur.id]);
        await insertStatusHistory(client, cur.id, 'New', 'Contacted', `Auto: first ${type.toLowerCase()} logged`, actor);
      }
      return refreshDerived(client, cur.id, settings.scoring);
    });
    emit('update', lead);
    res.status(201).json({ success: true, lead });
  }));

  // ============================================================================
  // PHASE 2: FOLLOW-UP CENTER ENDPOINTS
  // ============================================================================

  // ---------- List follow-ups with counts & filters ----------
  router.get('/followups', wrap(async (req, res) => {
    const tab = String(req.query.tab || 'today').toLowerCase();
    const type = String(req.query.type || '').toUpperCase();
    const salespersonId = req.query.salesperson_id ? String(req.query.salesperson_id).trim() : null;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
    const offset = (page - 1) * pageSize;

    const conds = ['l.deleted_at IS NULL'];
    const params = [];
    let pIdx = 1;

    // Scoping by user role
    if (!isLeadManager(req.userSession.role)) {
      const myId = String(req.userSession.empCode || '');
      conds.push(`(f.assigned_salesperson_id = $${pIdx} OR l.assigned_to_user_id = $${pIdx} OR l.lead_created_by_id = $${pIdx})`);
      params.push(myId);
      pIdx++;
    } else if (salespersonId) {
      conds.push(`f.assigned_salesperson_id = $${pIdx}`);
      params.push(salespersonId);
      pIdx++;
    }

    if (type && ['CALL', 'WHATSAPP', 'EMAIL', 'MEETING'].includes(type)) {
      conds.push(`f.followup_type = $${pIdx}`);
      params.push(type);
      pIdx++;
    }

    // Filter by tab
    if (tab === 'today') {
      conds.push(`f.status = 'PENDING' AND f.scheduled_at::date = CURRENT_DATE`);
    } else if (tab === 'overdue') {
      conds.push(`f.status = 'PENDING' AND f.scheduled_at < NOW() AND f.scheduled_at::date < CURRENT_DATE`);
    } else if (tab === 'upcoming') {
      conds.push(`f.status = 'PENDING' AND f.scheduled_at::date > CURRENT_DATE`);
    } else if (tab === 'completed') {
      conds.push(`f.status = 'COMPLETED'`);
    } else if (tab === 'pending') {
      conds.push(`f.status = 'PENDING'`);
    }
    // 'all' includes all statuses without extra condition

    const whereClause = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    // Fetch tab counts
    const scopeConds = ['l.deleted_at IS NULL'];
    const scopeParams = [];
    let sIdx = 1;
    if (!isLeadManager(req.userSession.role)) {
      const myId = String(req.userSession.empCode || '');
      scopeConds.push(`(f.assigned_salesperson_id = $${sIdx} OR l.assigned_to_user_id = $${sIdx} OR l.lead_created_by_id = $${sIdx})`);
      scopeParams.push(myId);
      sIdx++;
    } else if (salespersonId) {
      scopeConds.push(`f.assigned_salesperson_id = $${sIdx}`);
      scopeParams.push(salespersonId);
      sIdx++;
    }
    const scopeWhere = scopeConds.length ? `WHERE ${scopeConds.join(' AND ')}` : '';

    const countSql = `
      SELECT 
        COUNT(*) FILTER (WHERE f.status = 'PENDING' AND f.scheduled_at::date = CURRENT_DATE) AS today,
        COUNT(*) FILTER (WHERE f.status = 'PENDING' AND f.scheduled_at < NOW() AND f.scheduled_at::date < CURRENT_DATE) AS overdue,
        COUNT(*) FILTER (WHERE f.status = 'PENDING' AND f.scheduled_at::date > CURRENT_DATE) AS upcoming,
        COUNT(*) FILTER (WHERE f.status = 'COMPLETED') AS completed,
        COUNT(*) AS total
      FROM public.lead_followups f
      JOIN public.leads l ON f.lead_id = l.id
      ${scopeWhere}
    `;
    const countRes = await query(countSql, scopeParams);
    const counts = {
      today: parseInt(countRes.rows[0]?.today || 0, 10),
      overdue: parseInt(countRes.rows[0]?.overdue || 0, 10),
      upcoming: parseInt(countRes.rows[0]?.upcoming || 0, 10),
      completed: parseInt(countRes.rows[0]?.completed || 0, 10),
      total: parseInt(countRes.rows[0]?.total || 0, 10)
    };

    // Sort order: overdue/today first by scheduled_at ASC, completed by completed_at DESC
    let orderBy = 'f.scheduled_at ASC';
    if (tab === 'completed') orderBy = 'f.completed_at DESC NULLS LAST, f.scheduled_at DESC';

    const listSql = `
      SELECT 
        f.id, f.lead_id, f.followup_type, f.scheduled_at, f.notes, f.status,
        f.outcome, f.outcome_remarks, f.assigned_salesperson_id, f.assigned_salesperson_name,
        f.completed_at, f.created_at,
        l.company_name AS lead_company_name,
        l.contact_person AS lead_contact_person,
        l.phone AS lead_phone,
        l.pipeline_stage AS lead_stage,
        l.temperature AS lead_temperature,
        l.score AS lead_score,
        l.estimated_value AS lead_value,
        l.requirement AS lead_requirement
      FROM public.lead_followups f
      JOIN public.leads l ON f.lead_id = l.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${pIdx} OFFSET $${pIdx + 1}
    `;
    params.push(pageSize, offset);

    const listRes = await query(listSql, params);

    const currentTotal = tab === 'today' ? counts.today
      : tab === 'overdue' ? counts.overdue
      : tab === 'upcoming' ? counts.upcoming
      : tab === 'completed' ? counts.completed
      : counts.total;

    res.json({
      success: true,
      data: listRes.rows,
      counts,
      total: currentTotal,
      page,
      pageSize
    });
  }));

  // ---------- Schedule a follow-up for a lead ----------
  router.post('/leads/:id/followups', wrap(async (req, res) => {
    const followupType = String(req.body?.followup_type || req.body?.type || 'CALL').toUpperCase();
    if (!['CALL', 'WHATSAPP', 'EMAIL', 'MEETING'].includes(followupType)) {
      throw new HttpError(400, 'Invalid follow-up type (CALL, WHATSAPP, EMAIL, MEETING)');
    }
    const scheduledAt = new Date(req.body?.scheduled_at);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new HttpError(400, 'Valid scheduled_at timestamp is required');
    }
    const notes = String(req.body?.notes || '').trim();
    const actor = actorOf(req.userSession);

    const followup = await withTx(async (client) => {
      const cur = await loadLeadForWrite(client, req.params.id, req.userSession);
      const fid = genId('LF');
      const ins = await client.query(
        `INSERT INTO public.lead_followups (
          id, lead_id, followup_type, scheduled_at, notes, status,
          assigned_salesperson_id, assigned_salesperson_name, created_by_user_id, created_by_name, created_at
        ) VALUES ($1,$2,$3,$4,$5,'PENDING',$6,$7,$8,$9,NOW())
        RETURNING *`,
        [fid, cur.id, followupType, scheduledAt.toISOString(), notes, cur.assigned_salesperson || actor.id, cur.assigned_salesperson_name || actor.name, actor.id, actor.name]
      );

      // Update lead's next_action_due_at to the earliest pending follow-up
      await client.query(
        `UPDATE public.leads 
         SET next_action_due_at = (
           SELECT MIN(scheduled_at) FROM public.lead_followups WHERE lead_id = $1 AND status = 'PENDING'
         ), updated_at = NOW()
         WHERE id = $1`,
        [cur.id]
      );

      // Audit activity
      await client.query(
        `INSERT INTO public.lead_activities (id, lead_id, activity_type, summary, conducted_by_user_id, conducted_by_name, conducted_by_role, created_at)
         VALUES ($1,$2,'FOLLOWUP_SCHEDULED',$3,$4,$5,$6,NOW())`,
        [genId('LAC'), cur.id, `Scheduled ${followupType}: ${notes || 'No notes'} for ${scheduledAt.toLocaleString('en-IN')}`, actor.id, actor.name, actor.role]
      );

      return ins.rows[0];
    });

    emit('followup', { action: 'create', followupId: followup.id, leadId: req.params.id });
    res.status(201).json({ success: true, followup });
  }));

  // ---------- Complete a follow-up with outcome ----------
  router.post('/followups/:id/complete', wrap(async (req, res) => {
    const outcome = String(req.body?.outcome || 'INTERESTED').toUpperCase();
    const outcomeRemarks = String(req.body?.outcome_remarks || req.body?.remarks || '').trim();
    const nextFollowup = req.body?.next_followup || null;
    const actor = actorOf(req.userSession);

    const result = await withTx(async (client) => {
      const fRes = await client.query(`SELECT * FROM public.lead_followups WHERE id = $1 FOR UPDATE`, [req.params.id]);
      if (!fRes.rows.length) throw new HttpError(404, 'Follow-up not found');
      const f = fRes.rows[0];

      // Update follow-up as completed
      const up = await client.query(
        `UPDATE public.lead_followups 
         SET status = 'COMPLETED', outcome = $2, outcome_remarks = $3, completed_at = NOW()
         WHERE id = $1 RETURNING *`,
        [f.id, outcome, outcomeRemarks]
      );

      // Log lead activity
      await client.query(
        `INSERT INTO public.lead_activities (id, lead_id, activity_type, summary, customer_response, conducted_by_user_id, conducted_by_name, conducted_by_role, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
        [
          genId('LAC'), f.lead_id, f.followup_type || 'CALL',
          `Follow-up completed [Outcome: ${outcome}] - ${outcomeRemarks || 'Completed successfully'}`,
          outcomeRemarks || outcome, actor.id, actor.name, actor.role
        ]
      );

      // If next follow-up was provided, schedule it
      let nextF = null;
      if (nextFollowup && nextFollowup.scheduled_at) {
        const nextDt = new Date(nextFollowup.scheduled_at);
        if (!Number.isNaN(nextDt.getTime())) {
          const nextType = String(nextFollowup.followup_type || nextFollowup.type || 'CALL').toUpperCase();
          const nextNotes = String(nextFollowup.notes || '').trim();
          const nIns = await client.query(
            `INSERT INTO public.lead_followups (
              id, lead_id, followup_type, scheduled_at, notes, status,
              assigned_salesperson_id, assigned_salesperson_name, created_by_user_id, created_by_name, created_at
            ) VALUES ($1,$2,$3,$4,$5,'PENDING',$6,$7,$8,$9,NOW())
            RETURNING *`,
            [genId('LF'), f.lead_id, nextType, nextDt.toISOString(), nextNotes, f.assigned_salesperson_id || actor.id, f.assigned_salesperson_name || actor.name, actor.id, actor.name]
          );
          nextF = nIns.rows[0];
        }
      }

      // Refresh lead's next_action_due_at and last_activity
      await client.query(
        `UPDATE public.leads 
         SET next_action_due_at = (
           SELECT MIN(scheduled_at) FROM public.lead_followups WHERE lead_id = $1 AND status = 'PENDING'
         ),
         last_activity_at = NOW(),
         last_activity_type = $2,
         is_unattended_2h = FALSE,
         is_unattended_24h = FALSE,
         is_unattended_48h = FALSE,
         updated_at = NOW()
         WHERE id = $1`,
        [f.lead_id, f.followup_type || 'CALL']
      );

      return { completed: up.rows[0], nextFollowup: nextF };
    });

    emit('followup', { action: 'complete', followupId: req.params.id });
    res.json({ success: true, ...result });
  }));

  // ---------- Reschedule a follow-up ----------
  router.post('/followups/:id/reschedule', wrap(async (req, res) => {
    const scheduledAt = new Date(req.body?.scheduled_at);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new HttpError(400, 'Valid scheduled_at timestamp is required');
    }
    const reason = String(req.body?.reason || req.body?.notes || '').trim();
    const actor = actorOf(req.userSession);

    const updated = await withTx(async (client) => {
      const fRes = await client.query(`SELECT * FROM public.lead_followups WHERE id = $1 FOR UPDATE`, [req.params.id]);
      if (!fRes.rows.length) throw new HttpError(404, 'Follow-up not found');
      const f = fRes.rows[0];

      // Mark old as rescheduled and create new one
      await client.query(
        `UPDATE public.lead_followups 
         SET status = 'RESCHEDULED', outcome_remarks = $2
         WHERE id = $1`,
        [f.id, reason ? `Rescheduled: ${reason}` : 'Rescheduled by user']
      );

      const nId = genId('LF');
      const ins = await client.query(
        `INSERT INTO public.lead_followups (
          id, lead_id, followup_type, scheduled_at, notes, status,
          assigned_salesperson_id, assigned_salesperson_name, rescheduled_from_id,
          created_by_user_id, created_by_name, created_at
        ) VALUES ($1,$2,$3,$4,$5,'PENDING',$6,$7,$8,$9,$10,NOW())
        RETURNING *`,
        [nId, f.lead_id, f.followup_type, scheduledAt.toISOString(), f.notes, f.assigned_salesperson_id, f.assigned_salesperson_name, f.id, actor.id, actor.name]
      );

      // Update lead
      await client.query(
        `UPDATE public.leads 
         SET next_action_due_at = (
           SELECT MIN(scheduled_at) FROM public.lead_followups WHERE lead_id = $1 AND status = 'PENDING'
         ), updated_at = NOW()
         WHERE id = $1`,
        [f.lead_id]
      );

      // Audit activity
      await client.query(
        `INSERT INTO public.lead_activities (id, lead_id, activity_type, summary, conducted_by_user_id, conducted_by_name, conducted_by_role, created_at)
         VALUES ($1,$2,'FOLLOWUP_RESCHEDULED',$3,$4,$5,$6,NOW())`,
        [genId('LAC'), f.lead_id, `Follow-up rescheduled to ${scheduledAt.toLocaleString('en-IN')}${reason ? ' (' + reason + ')' : ''}`, actor.id, actor.name, actor.role]
      );

      return ins.rows[0];
    });

    emit('followup', { action: 'reschedule', followupId: updated.id });
    res.json({ success: true, followup: updated });
  }));

  // ---------- Command Center Overview KPIs ----------
  router.get('/overview', wrap(async (req, res) => {
    const isManager = isLeadManager(req.userSession.role);
    const conds = ['l.deleted_at IS NULL'];
    const params = [];
    if (!isManager) {
      const myId = String(req.userSession.empCode || '');
      conds.push('(l.assigned_to_user_id = $1 OR l.lead_created_by_id = $1)');
      params.push(myId);
    }
    const whereClause = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const settings = await getSettings();
    const [leadKpis, stageStats, followupStats, hotLeads] = await Promise.all([
      // Total leads, pipeline value, new this week, won, lost
      query(`
        SELECT 
          COUNT(*) AS total_leads,
          COUNT(*) FILTER (WHERE l.created_at >= NOW() - INTERVAL '7 days') AS new_this_week,
          COALESCE(SUM(l.estimated_value) FILTER (WHERE l.pipeline_stage NOT IN ('Won', 'Lost')), 0) AS pipeline_value,
          COUNT(*) FILTER (WHERE l.pipeline_stage = 'Won') AS won_count,
          COUNT(*) FILTER (WHERE l.pipeline_stage = 'Lost') AS lost_count,
          COALESCE(SUM(l.estimated_value) FILTER (WHERE l.pipeline_stage = 'Won'), 0) AS won_value
        FROM public.leads l
        ${whereClause}
      `, params),

      // Stage distribution
      query(`
        SELECT l.pipeline_stage, COUNT(*) AS count, COALESCE(SUM(l.estimated_value), 0) AS total_value
        FROM public.leads l
        ${whereClause}
        GROUP BY l.pipeline_stage
      `, params),

      // Follow-up counts
      query(`
        SELECT 
          COUNT(*) FILTER (WHERE f.status = 'PENDING' AND f.scheduled_at::date = CURRENT_DATE) AS today,
          COUNT(*) FILTER (WHERE f.status = 'PENDING' AND f.scheduled_at < NOW() AND f.scheduled_at::date < CURRENT_DATE) AS overdue,
          COUNT(*) FILTER (WHERE f.status = 'PENDING' AND f.scheduled_at::date > CURRENT_DATE) AS upcoming,
          COUNT(*) FILTER (WHERE f.status = 'COMPLETED') AS completed
        FROM public.lead_followups f
        JOIN public.leads l ON f.lead_id = l.id
        ${whereClause}
      `, params),

      // Attention queue: Hot/Warm leads needing attention
      query(`
        SELECT l.id, l.company_name, l.contact_person, l.phone, l.pipeline_stage, l.temperature, l.score, l.estimated_value, l.next_action_due_at, l.assigned_salesperson_name
        FROM public.leads l
        ${whereClause ? whereClause + ' AND' : 'WHERE'} l.pipeline_stage NOT IN ('Won', 'Lost')
          AND (l.temperature = 'HOT' OR l.score >= 60 OR l.next_action_due_at < NOW())
        ORDER BY l.score DESC, l.created_at DESC
        LIMIT 6
      `, params)
    ]);

    const kpi = leadKpis.rows[0] || {};
    const totalClosed = parseInt(kpi.won_count || 0, 10) + parseInt(kpi.lost_count || 0, 10);
    const winRate = totalClosed > 0 ? Math.round((parseInt(kpi.won_count || 0, 10) / totalClosed) * 100) : 0;

    // Calculate weighted forecast using configurable stage probabilities from settings
    const stageProbs = settings.stageProbabilities || {};
    let weightedForecast = 0;
    stageStats.rows.forEach(st => {
      if (st.pipeline_stage !== 'Won' && st.pipeline_stage !== 'Lost') {
        const val = parseFloat(st.total_value) || 0;
        const prob = stageProbs[st.pipeline_stage] != null ? stageProbs[st.pipeline_stage] : 10;
        weightedForecast += (val * prob) / 100.0;
      }
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalLeads: parseInt(kpi.total_leads || 0, 10),
          newThisWeek: parseInt(kpi.new_this_week || 0, 10),
          pipelineValue: parseFloat(kpi.pipeline_value || 0),
          weightedForecast: Math.round(weightedForecast),
          wonCount: parseInt(kpi.won_count || 0, 10),
          lostCount: parseInt(kpi.lost_count || 0, 10),
          wonValue: parseFloat(kpi.won_value || 0),
          winRate
        },
        stages: stageStats.rows,
        followups: {
          today: parseInt(followupStats.rows[0]?.today || 0, 10),
          overdue: parseInt(followupStats.rows[0]?.overdue || 0, 10),
          upcoming: parseInt(followupStats.rows[0]?.upcoming || 0, 10),
          completed: parseInt(followupStats.rows[0]?.completed || 0, 10)
        },
        attentionQueue: hotLeads.rows
      }
    });
  }));

  return router;
}
