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
  l.next_action_due_at, l.next_action_exception, l.last_activity_at, l.last_qualifying_activity_at,
  l.customer_id, l.customer_code, l.lost_reason_id, l.created_at, l.updated_at`;

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

const DEFAULT_AUTOMATION = {
  autoAssign: {
    enabled: true,
    mode: 'round_robin', // 'round_robin' | 'workload_balance'
    eligibleRoles: ['Sales Executive', 'Sales']
  },
  slaAlerts: {
    uncontactedHours: 24,
    escalateToManager: true
  },
  autoFollowup: {
    enabled: true,
    delayHours: 24,
    type: 'CALL',
    notes: 'Initial contact & requirement qualification'
  },
  inboundWebhook: {
    enabled: true,
    apiKey: 'sl_wh_live_2026_vrm',
    allowedSources: ['Website', 'IndiaMART', 'Meta Lead Ads', 'WhatsApp Cloud']
  }
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
    scoring: { ...DEFAULT_SCORING, ...(map.scoring || {}) },
    workspace: {
      name: 'BUSINZ Industrial Dynamics',
      url: 'businz.cloud/app',
      industry: 'Solar & Heavy Industrial Manufacturing',
      description: 'Unified enterprise CRM, quotation engine, proforma invoice generation, BOM production tracking, and dispatch control system.',
      weekStartsOn: 'Monday',
      language: 'English (US)',
      timezone: 'UTC+05:30 Asia/Kolkata (IST)',
      allowMemberLeadCreation: true,
      ...(map.workspace || {})
    }
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

async function getNextRoundRobinAssignee(client, team) {
  if (!team || team.length === 0) return null;
  // Concurrency-safe advisory lock specifically for round-robin pointer
  await client.query(`SELECT pg_advisory_xact_lock(hashtext('smart_leads_round_robin'))`);
  const cur = await client.query(`SELECT value FROM public.lead_settings WHERE key = 'round_robin_pointer' FOR UPDATE`);
  let lastIndex = cur.rows[0]?.value?.index != null ? Number(cur.rows[0].value.index) : -1;
  const nextIndex = (lastIndex + 1) % team.length;
  await client.query(`
    INSERT INTO public.lead_settings (key, value, updated_at)
    VALUES ('round_robin_pointer', $1::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = NOW()
  `, [JSON.stringify({ index: nextIndex, last_assigned_user_id: team[nextIndex].user_id, last_assigned_at: new Date().toISOString() })]);
  return team[nextIndex];
}

async function findExistingCustomerMatch(client, { phone, whatsapp, email, company_name }) {
  const p1 = normalizePhone(phone);
  const p2 = normalizePhone(whatsapp);
  const mail = normalizeEmail(email);
  const comp = String(company_name || '').trim().toLowerCase();
  
  if (!p1 && !p2 && !mail && !comp) return null;

  // 1. Search Customer Master
  const cmRes = await client.query(`
    SELECT id, customer_code, company_name, customer_name, assigned_salesperson
    FROM public.customers
    WHERE (company_name IS NOT NULL AND LOWER(TRIM(company_name)) = $1)
       OR ($2 <> '' AND (RIGHT(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = $2))
       OR ($3 <> '' AND (RIGHT(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = $3))
       OR ($4 <> '' AND LOWER(COALESCE(email, '')) = $4)
    ORDER BY created_at DESC LIMIT 1
  `, [comp, p1, p2, mail]);

  if (cmRes.rows.length) {
    return { type: 'CUSTOMER_MASTER', record: cmRes.rows[0] };
  }

  // 2. Search existing active leads
  const leadRes = await client.query(`
    SELECT id, lead_number, company_name, assigned_to_user_id, assigned_to_name, assigned_to_role, customer_id, customer_code
    FROM public.leads
    WHERE deleted_at IS NULL AND assigned_to_user_id IS NOT NULL
      AND (
        (company_name IS NOT NULL AND LOWER(TRIM(company_name)) = $1)
        OR ($2 <> '' AND (RIGHT(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = $2))
        OR ($3 <> '' AND (RIGHT(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = $3))
        OR ($4 <> '' AND LOWER(COALESCE(email, '')) = $4)
      )
    ORDER BY created_at DESC LIMIT 1
  `, [comp, p1, p2, mail]);

  if (leadRes.rows.length) {
    return { type: 'EXISTING_LEAD', record: leadRes.rows[0] };
  }
  return null;
}

/**
 * @param {object} deps
 * @param {Function} deps.requireSession  Express middleware that sets req.userSession ({ empCode, user, role })
 * @param {Function} deps.broadcast       (eventType, payload) => void  (SSE)
 * @param {Function} deps.getTeam         async () => [{ user_id, name, role }]  registered BUSINZ sales staff
 * @param {Function} [deps.notify]        async (params) => void  (internal notifications)
 * @param {Function} [deps.getStaff]      async () => [{ user_id, name, role }]  all BUSINZ employees (for manager notifications)
 */
export function createSmartLeadsRouter({ requireSession, broadcast = () => {}, getTeam = async () => [], getStaff = async () => [], notify = async () => {} }) {
  const router = express.Router();
  router.use(express.json({ limit: '1mb' }));
  router.use(requireSession);
  router.use((req, res, next) => {
    if (!canAccessSmartLeads(req.userSession?.role)) return res.status(403).json({ success: false, error: 'Forbidden: Smart Leads access not permitted for your role' });
    next();
  });

  // Guarantee database schema & columns exist before executing any query
  let isSchemaReady = false;
  let schemaPromise = null;
  router.use(async (req, res, next) => {
    if (!isSchemaReady) {
      if (!schemaPromise) {
        schemaPromise = import('./smartLeadsSchema.js')
          .then(m => m.ensureSmartLeadsSchema())
          .then(() => { isSchemaReady = true; })
          .catch(err => {
            schemaPromise = null;
            console.warn('[Smart Leads Router] On-demand schema ensure notice:', err.message);
          });
      }
      await schemaPromise;
    }
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
  const emit = (action, lead, extra = {}) => broadcast('smart_lead_changed', {
    action,
    leadId: lead?.id || extra.leadId || null,
    ownerId: lead?.assigned_to_user_id || extra.ownerId || null,
    stage: lead?.stage || extra.stage || null
  });

  // Quotations created in the app are kept in the crm_quotations store (not public.quotations); match them by leadId
  const STORE_QUOTES_FOR_LEAD_SQL = `
    SELECT COALESCE(q->>'quoteNumber', q->>'code', q->>'id') AS id,
           COALESCE(q->>'quoteNumber', q->>'code', q->>'id') AS quote_number,
           q->>'status' AS status,
           NULLIF(q->>'grandTotal', '')::numeric AS grand_total,
           q->>'date' AS date,
           q->>'convertedPiNo' AS converted_pi_no
      FROM public.controlroom_store s,
           jsonb_array_elements(CASE WHEN jsonb_typeof(s.data) = 'array' THEN s.data ELSE '[]'::jsonb END) q
     WHERE s.key = 'crm_quotations' AND q->>'leadId' = $1`;

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
    const keyMap = { stageProbabilities: 'stage_probabilities', sla: 'sla', scoring: 'scoring', workspace: 'workspace' };
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
      Promise.all([
        query(`SELECT id, quote_number, status, grand_total, date, converted_pi_no FROM public.quotations WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 50`, [id]),
        query(STORE_QUOTES_FOR_LEAD_SQL, [id]).catch(() => ({ rows: [] }))
      ]).then(([t, st]) => ({ rows: [...t.rows, ...st.rows.filter(r => !t.rows.some(x => x.quote_number === r.quote_number))] })),
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

    // Downstream tracking: PI -> BOM -> Tax Invoice for this lead
    const leadQuoteNos = quotations.rows.map(q => q.quote_number).filter(Boolean);
    const leadQuotePiNos = quotations.rows.map(q => q.converted_pi_no).filter(Boolean);
    // PIs: same customer, or created from this lead's quotations
    const proformaInvoices = await query(
      `SELECT id, pi_no, customer_name, grand_total, pi_date, status, sales_person, converted_bom_code
         FROM public.proforma_invoices
        WHERE (customer_name IS NOT NULL AND LOWER(TRIM(customer_name)) = $1)
           OR pi_no = ANY($2::text[])
           OR (extra_data->>'sourceQuoteNo') = ANY($3::text[])
        ORDER BY pi_date DESC NULLS LAST LIMIT 50`,
      [companyClean, leadQuotePiNos, leadQuoteNos]
    ).catch(() => ({ rows: [] }));
    const leadPiNos = proformaInvoices.rows.map(p => p.pi_no).filter(Boolean);
    // BOMs: same customer, or converted from those PIs
    const bomOrders = await query(
      `SELECT id, bom_code, source_pi_no, customer_name, company_name, grand_total, date, status, invoice_no, invoice_confirmed, updated_at
         FROM public.bom_orders
        WHERE (customer_name IS NOT NULL AND LOWER(TRIM(customer_name)) = $1)
           OR (company_name IS NOT NULL AND LOWER(TRIM(company_name)) = $1)
           OR source_pi_no = ANY($2::text[])
        ORDER BY date DESC NULLS LAST LIMIT 50`,
      [companyClean, leadPiNos]
    ).catch(() => ({ rows: [] }));
    const leadBomCodes = bomOrders.rows.map(b => b.bom_code).filter(Boolean);
    // Tax invoices: the invoice number lives on the BOM order; also include any rows in public.invoices
    const legacyInvoices = await query(
      `SELECT id, inv_no, bom_code, inv_amt, status, created_at FROM public.invoices WHERE bom_code = ANY($1::text[]) ORDER BY created_at DESC LIMIT 50`,
      [leadBomCodes]
    ).catch(() => ({ rows: [] }));
    const bomInvoices = bomOrders.rows
      .filter(b => String(b.invoice_no || '').trim() && !/pending/i.test(String(b.invoice_no)))
      .map(b => ({
        id: b.invoice_no,
        inv_no: b.invoice_no,
        bom_code: b.bom_code,
        inv_amt: b.grand_total,
        status: b.invoice_confirmed ? 'Invoice Confirmed' : 'Pending Confirmation',
        created_at: b.updated_at
      }));
    const invoices = { rows: [...bomInvoices, ...legacyInvoices.rows.filter(r => !bomInvoices.some(x => x.inv_no === r.inv_no))] };
    res.json({
      success: true, lead,
      customerMaster: customerMatch.rows[0] || null,
      relatedLeads: relatedLeads.rows,
      notes: notes.rows, activities: activities.rows, statusHistory: statusHist.rows,
      assignmentHistory: assignHist.rows, audit: audit.rows, followups: followups.rows,
      quotations: quotations.rows,
      proformaInvoices: proformaInvoices.rows,
      bomOrders: bomOrders.rows,
      invoices: invoices.rows
    });
  }));

  // ---------- Duplicate check ----------
  router.post('/duplicates/check', wrap(async (req, res) => {
    const dups = await findDuplicates({ query: (t, p) => query(t, p) }, req.body || {}, req.body?.excludeId || null);
    res.json({ success: true, duplicates: dups });
  }));

  // ---------- Create ----------
  router.post('/leads', wrap(async (req, res) => {
    const actor = actorOf(req.userSession);
    if (/sales/i.test(actor.role) && !isLeadManager(actor.role)) {
      throw new HttpError(403, 'Sales accounts do not have permission to manually create new leads.');
    }
    const b = req.body || {};
    const company = String(b.company_name || '').trim() || String(b.contact_person || '').trim() || (b.phone ? `Contact ${b.phone}` : 'Individual Customer');
    if (company.length > 200) throw new HttpError(400, 'Company name too long');
    const phoneClean = String(b.phone || '').replace(/\D/g, '');
    if (!phoneClean || phoneClean.length < 10) throw new HttpError(400, 'Phone number is required (at least 10 digits)');
    if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.email).trim())) throw new HttpError(400, 'Invalid email');
    const settings = await getSettings();
    const team = await getTeam();

    // Same rule as the old lead management: only CEO / Technical Administrator / Tech Support assign leads.
    // A lead created by Sales goes to the Unassigned queue (the creator can still see it).
    let assignee = null;
    if (b.assigned_to_user_id) {
      if (!isLeadManager(actor.role)) throw new HttpError(403, 'Only CEO, Technical Administrator or Tech Support can assign leads');
      assignee = team.find(t => t.user_id === b.assigned_to_user_id);
      if (!assignee) throw new HttpError(400, 'Assignee is not an active BUSINZ sales user');
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
    if (!lead.assigned_to_user_id) {
      // Old rule: notify CEO & Tech Support of a new unassigned lead
      const managers = (await getStaff().catch(() => [])).filter(s => isLeadManager(s.role) && s.user_id !== actor.id);
      for (const m of managers) {
        notify({
          recipientEmpCode: m.user_id, eventType: 'NEW_LEAD', documentType: 'LEAD', documentId: lead.id,
          title: 'New unassigned lead', message: `${lead.lead_number} – ${lead.company_name} was created by ${actor.name} and needs to be assigned`,
          actorEmpCode: actor.id, actorName: actor.name, actorRole: actor.role, targetTab: 'Smart Leads', targetRecordId: lead.id,
          dedupId: `smart-lead-new-${lead.id}-${m.user_id}`
        }).catch(() => {});
      }
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
        if (field === 'phone' && (!v || v.replace(/\D/g, '').length < 10)) throw new HttpError(400, 'Phone number is required (at least 10 digits)');
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
    const v = validateStageTransition({ from: cur.pipeline_stage, to: stage, lostReasonId, isManager, remarks });
    if (!v.ok) throw new HttpError(400, v.error);
    if (stage === 'Lost') {
      const r = await client.query(`SELECT 1 FROM public.lead_lost_reasons WHERE id = $1 AND is_active`, [lostReasonId]);
      if (!r.rows[0]) throw new HttpError(400, 'Invalid lost reason');
    }
    // Won = a real sale: the lead must have a quotation and a customer in the Customer master
    let customerId = cur.converted_customer_id || null;
    let customerCode = cur.converted_customer_code || null;
    if (stage === 'Won') {
      const q = await client.query(`SELECT 1 FROM public.quotations WHERE lead_id = $1 LIMIT 1`, [cur.id]);
      const sq = q.rows[0] ? { rows: [1] } : await client.query(`${STORE_QUOTES_FOR_LEAD_SQL} LIMIT 1`, [cur.id]);
      if (!q.rows[0] && !sq.rows[0]) throw new HttpError(400, 'Create a quotation for this lead before marking it Won');
      if (!customerId) {
        const c = await client.query(
          `SELECT id, customer_code FROM public.customers
            WHERE (company_name IS NOT NULL AND LOWER(TRIM(company_name)) = $1)
               OR ($2 <> '' AND RIGHT(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = $2)
            LIMIT 1`,
          [String(cur.company_name || '').trim().toLowerCase(), normalizePhone(cur.phone || cur.whatsapp)]
        );
        customerId = c.rows[0]?.id != null ? String(c.rows[0].id) : null;
        customerCode = c.rows[0]?.customer_code || null;
      }
      if (!customerId) throw new HttpError(400, 'Add this customer to the Customer master before marking the lead Won');
    }
    const legacy = mapStageToLegacyStatus(stage, !!cur.assigned_to_user_id);
    await client.query(
      `UPDATE public.leads SET pipeline_stage = $2, status = $3, stage_changed_at = NOW(), updated_at = NOW(),
          lost_reason_id = CASE WHEN $2 = 'Lost' THEN $4 ELSE NULL END,
          lost_remarks = CASE WHEN $2 = 'Lost' THEN $5 ELSE NULL END,
          is_converted = CASE WHEN $2 = 'Won' THEN TRUE WHEN $6 = 'Won' THEN FALSE ELSE is_converted END,
          converted_customer_id = CASE WHEN $2 = 'Won' THEN $7 ELSE converted_customer_id END,
          converted_customer_code = CASE WHEN $2 = 'Won' THEN $8 ELSE converted_customer_code END
        WHERE id = $1`,
      [cur.id, stage, legacy, lostReasonId || null, remarks || null, cur.pipeline_stage || null, customerId, customerCode]
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

  // ---------- Convert Lead to Customer Master ----------
  router.post('/leads/:id/convert-customer', wrap(async (req, res) => {
    const actor = actorOf(req.userSession);
    const settings = await getSettings();
    const result = await withTx(async (client) => {
      const cur = await loadLeadForWrite(client, req.params.id, req.userSession);

      let customer = null;
      if (cur.converted_customer_id) {
        const c = await client.query(`SELECT * FROM public.customers WHERE id = $1 LIMIT 1`, [cur.converted_customer_id]);
        if (c.rows[0]) customer = c.rows[0];
      }
      if (!customer) {
        const match = await findExistingCustomerMatch(client, {
          phone: cur.phone,
          whatsapp: cur.whatsapp,
          email: cur.email,
          companyName: cur.company_name
        });
        if (match) {
          const c = await client.query(`SELECT * FROM public.customers WHERE id = $1 LIMIT 1`, [match.id]);
          if (c.rows[0]) customer = c.rows[0];
        }
      }

      if (customer) {
        await client.query(
          `UPDATE public.leads
              SET is_converted = TRUE,
                  converted_customer_id = $2::text,
                  converted_customer_code = $3::text,
                  customer_id = $2::text,
                  customer_code = $3::text,
                  updated_at = NOW()
            WHERE id = $1`,
          [cur.id, customer.id, customer.customer_code || customer.code || customer.id]
        );
        await client.query(
          `INSERT INTO public.lead_activities (id, lead_id, activity_type, summary, conducted_by_user_id, conducted_by_name, conducted_by_role, created_at)
           VALUES ($1,$2,'CONVERTED_TO_CUSTOMER',$3,$4,$5,$6,NOW())`,
          [genId('LAC'), cur.id, `Lead linked to existing Customer Master: ${customer.company_name || customer.customer_name} (${customer.customer_code || customer.id})`, actor.id, actor.name, actor.role]
        );
        return { customer, leadId: cur.id, alreadyExisted: true };
      }

      // Generate sequential customer code: VRM-CS-YYYY-XX
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('customer_sequence_number'))`);
      const year = new Date().getFullYear();
      const seqRes = await client.query(
        `SELECT COALESCE(MAX((regexp_match(customer_code, '^VRM-CS-\\d{4}-(\\d+)$'))[1]::int), 0) AS max_seq
           FROM public.customers
          WHERE customer_code LIKE $1`,
        [`VRM-CS-${year}-%`]
      );
      const nextSeq = (seqRes.rows[0]?.max_seq || 0) + 1;
      const customerCode = `VRM-CS-${year}-${String(nextSeq).padStart(2, '0')}`;

      const compName = (cur.company_name || 'New Customer').trim();
      const contactPerson = (cur.contact_person || compName).trim();
      const phone = (cur.phone || cur.whatsapp || '').trim();
      const email = (cur.email || '').trim();
      const city = cur.location || 'Chennai';
      const state = 'Tamil Nadu';
      const rep = cur.assigned_to_name || actor.name || '';

      const insRes = await client.query(
        `INSERT INTO public.customers (
          id, customer_code, company_name, customer_name, customer_type, industry,
          city, state, assigned_salesperson, source, email, phone, status,
          credit_limit, credit_days, payment_terms, primary_contact, created_at, updated_at
        ) VALUES (
          $1, $1, $2, $3, 'EPC Contractor', 'Solar Energy / Utility Scale',
          $4, $5, $6, $7, $8, $9, 'ACTIVE',
          2500000, 30, '50% Advance + 50% Dispatch',
          $10::jsonb, NOW(), NOW()
        ) RETURNING *`,
        [
          customerCode,
          compName,
          contactPerson,
          city,
          state,
          rep,
          cur.source || 'Smart Leads',
          email,
          phone,
          JSON.stringify({
            name: contactPerson,
            designation: cur.designation || 'Project Head',
            phone,
            whatsapp: cur.whatsapp || phone,
            email
          })
        ]
      );
      const newCustomer = insRes.rows[0];

      await client.query(
        `UPDATE public.leads
            SET is_converted = TRUE,
                converted_customer_id = $2::text,
                converted_customer_code = $2::text,
                customer_id = $2::text,
                customer_code = $2::text,
                updated_at = NOW()
          WHERE id = $1`,
        [cur.id, customerCode]
      );

      await client.query(
        `INSERT INTO public.lead_activities (id, lead_id, activity_type, summary, conducted_by_user_id, conducted_by_name, conducted_by_role, created_at)
         VALUES ($1,$2,'CONVERTED_TO_CUSTOMER',$3,$4,$5,$6,NOW())`,
        [genId('LAC'), cur.id, `Lead converted to official Customer Master: ${compName} (${customerCode})`, actor.id, actor.name, actor.role]
      );

      return { customer: newCustomer, leadId: cur.id, created: true };
    });

    const refreshed = await withTx(client => refreshDerived(client, result.leadId, settings.scoring));
    emit('update', refreshed);

    res.json({
      success: true,
      customer: result.customer,
      lead: refreshed,
      message: result.alreadyExisted
        ? `Linked to existing Customer Master: ${result.customer.customer_code || result.customer.id}`
        : `Successfully converted to Customer: ${result.customer.customer_code || result.customer.id}`
    });
  }));

  // ---------- Assign / reassign ----------
  async function assignOne(client, cur, assignee, reason, actor) {
    if (cur.assigned_to_user_id === assignee.user_id) return false;
    await client.query(
      `UPDATE public.leads SET assigned_to_user_id = $2, assigned_to_name = $3, assigned_to_role = $4, assigned_salesperson = $3,
          assigned_by_user_id = $5, assigned_by_name = $6, assigned_by_role = $7, assigned_at = NOW(), updated_at = NOW(),
          status = CASE WHEN pipeline_stage = 'New' THEN 'Assigned' ELSE status END,
          sl_escalated_24h_at = NULL
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
      // Single entry notes integration: persist logged activity summary into notes timeline
      const noteBody = `[${type} Logged] ${summary}${req.body?.customerResponse ? ` · Customer response: ${req.body.customerResponse}` : ''}`;
      await client.query(
        `INSERT INTO public.lead_notes (id, lead_id, body, created_by_user_id, created_by_name, created_at)
         VALUES ($1,$2,$3,$4,$5,NOW())`,
        [genId('LNT'), cur.id, noteBody, actor.id, actor.name]
      );
      await client.query(
        `UPDATE public.leads SET last_activity_at = NOW(), last_qualifying_activity_at = NOW(),
            first_qualifying_activity_at = COALESCE(first_qualifying_activity_at, NOW()),
            last_activity_type = $2,
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
        l.product_requirement AS lead_requirement
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
        [fid, cur.id, followupType, scheduledAt.toISOString(), notes, cur.assigned_to_user_id || cur.assigned_salesperson || actor.id, cur.assigned_to_name || actor.name, actor.id, actor.name]
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

      // Single entry notes integration: persist to lead notes timeline without duplicate typing
      if (notes) {
        await client.query(
          `INSERT INTO public.lead_notes (id, lead_id, body, created_by_user_id, created_by_name, created_at)
           VALUES ($1,$2,$3,$4,$5,NOW())`,
          [genId('LNT'), cur.id, `[Follow-up Scheduled: ${followupType} for ${scheduledAt.toLocaleString('en-IN')}] ${notes}`, actor.id, actor.name]
        );
      }

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
      if (String(f.status || '').toUpperCase() !== 'PENDING') throw new HttpError(409, `Follow-up is already ${String(f.status || '').toLowerCase()}`);

      // Update follow-up as completed
      const up = await client.query(
        `UPDATE public.lead_followups 
         SET status = 'COMPLETED', outcome = $2, outcome_remarks = $3, completed_at = NOW()
         WHERE id = $1 RETURNING *`,
        [f.id, outcome, outcomeRemarks]
      );

      // Log lead activity
      await client.query(
        `INSERT INTO public.lead_activities (id, lead_id, activity_type, is_qualifying_activity, summary, customer_response, conducted_by_user_id, conducted_by_name, conducted_by_role, created_at)
         VALUES ($1,$2,$3,TRUE,$4,$5,$6,$7,$8,NOW())`,
        [
          genId('LAC'), f.lead_id, f.followup_type || 'CALL',
          `Follow-up completed [Outcome: ${outcome}] - ${outcomeRemarks || 'Completed successfully'}`,
          outcomeRemarks || outcome, actor.id, actor.name, actor.role
        ]
      );

      // Single entry notes integration: persist outcome remarks to notes timeline
      if (outcomeRemarks) {
        await client.query(
          `INSERT INTO public.lead_notes (id, lead_id, body, created_by_user_id, created_by_name, created_at)
           VALUES ($1,$2,$3,$4,$5,NOW())`,
          [genId('LNT'), f.lead_id, `[Follow-up Completed - ${outcome}] ${outcomeRemarks}`, actor.id, actor.name]
        );
      }

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

      // Refresh lead's next_action_due_at, last_activity, and qualifying activity
      await client.query(
        `UPDATE public.leads 
         SET next_action_due_at = (
           SELECT MIN(scheduled_at) FROM public.lead_followups WHERE lead_id = $1 AND status = 'PENDING'
         ),
         last_activity_at = NOW(),
         last_activity_type = $2,
         last_qualifying_activity_at = NOW(),
         first_qualifying_activity_at = COALESCE(first_qualifying_activity_at, NOW()),
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
      if (String(f.status || '').toUpperCase() !== 'PENDING') throw new HttpError(409, `Follow-up is already ${String(f.status || '').toLowerCase()}`);

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
        SELECT l.id, l.company_name, l.contact_person, l.phone, l.pipeline_stage, l.temperature, l.score, l.estimated_value, l.next_action_due_at,
               COALESCE(l.assigned_to_name, l.assigned_salesperson, 'Sales Team') AS assigned_salesperson_name
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

  // ── 9. Sales Team Workload & Performance ────────────────────────────────────
  router.get('/team', wrap(async (req, res) => {
    requireManager(req);
    const team = await getTeam();
    const [leadAgg, followupAgg] = await Promise.all([
      query(`
        SELECT 
          COALESCE(assigned_to_user_id, assigned_salesperson) AS user_id,
          COALESCE(assigned_to_name, assigned_salesperson, 'Sales Team') AS rep_name,
          COUNT(*) FILTER (WHERE pipeline_stage NOT IN ('Won', 'Lost')) AS active_leads,
          COUNT(*) FILTER (WHERE pipeline_stage = 'Won') AS won_leads,
          COUNT(*) FILTER (WHERE pipeline_stage = 'Lost') AS lost_leads,
          COUNT(*) AS total_leads,
          COALESCE(SUM(estimated_value) FILTER (WHERE pipeline_stage NOT IN ('Won', 'Lost')), 0) AS pipeline_value,
          COALESCE(SUM(estimated_value) FILTER (WHERE pipeline_stage = 'Won'), 0) AS won_value
        FROM public.leads
        WHERE deleted_at IS NULL
        GROUP BY 1, 2
      `),
      query(`
        SELECT 
          assigned_salesperson_id AS user_id,
          COUNT(*) FILTER (WHERE status = 'PENDING' AND scheduled_at < NOW()) AS overdue_followups,
          COUNT(*) FILTER (WHERE status = 'PENDING' AND scheduled_at::date = CURRENT_DATE) AS today_followups
        FROM public.lead_followups
        GROUP BY 1
      `)
    ]);

    const leadMap = new Map();
    leadAgg.rows.forEach(r => {
      if (r.user_id) leadMap.set(String(r.user_id), r);
    });

    const followupMap = new Map();
    followupAgg.rows.forEach(r => {
      if (r.user_id) followupMap.set(String(r.user_id), r);
    });

    const members = (Array.isArray(team) && team.length > 0 ? team : []).map(member => {
      const id = String(member.user_id);
      const l = leadMap.get(id) || {};
      const f = followupMap.get(id) || {};

      const activeLeads = parseInt(l.active_leads || 0, 10);
      const wonLeads = parseInt(l.won_leads || 0, 10);
      const lostLeads = parseInt(l.lost_leads || 0, 10);
      const totalClosed = wonLeads + lostLeads;
      const winRate = totalClosed > 0 ? Math.round((wonLeads / totalClosed) * 100) : 0;

      let workload = 'Low';
      if (activeLeads > 15) workload = 'High';
      else if (activeLeads >= 5) workload = 'Balanced';

      return {
        user_id: id,
        name: member.name,
        role: member.role || 'Sales',
        active_leads: activeLeads,
        total_leads: parseInt(l.total_leads || 0, 10),
        won_leads: wonLeads,
        lost_leads: lostLeads,
        pipeline_value: parseFloat(l.pipeline_value || 0),
        won_value: parseFloat(l.won_value || 0),
        win_rate: winRate,
        overdue_followups: parseInt(f.overdue_followups || 0, 10),
        today_followups: parseInt(f.today_followups || 0, 10),
        workload
      };
    });

    // Also include any assigned reps who have leads but might not be in the current team store
    leadAgg.rows.forEach(r => {
      const id = String(r.user_id || '');
      if (id && !members.some(m => m.user_id === id)) {
        const activeLeads = parseInt(r.active_leads || 0, 10);
        const wonLeads = parseInt(r.won_leads || 0, 10);
        const lostLeads = parseInt(r.lost_leads || 0, 10);
        const totalClosed = wonLeads + lostLeads;
        const winRate = totalClosed > 0 ? Math.round((wonLeads / totalClosed) * 100) : 0;
        const f = followupMap.get(id) || {};

        members.push({
          user_id: id,
          name: r.rep_name || id,
          role: 'Sales Representative',
          active_leads: activeLeads,
          total_leads: parseInt(r.total_leads || 0, 10),
          won_leads: wonLeads,
          lost_leads: lostLeads,
          pipeline_value: parseFloat(r.pipeline_value || 0),
          won_value: parseFloat(r.won_value || 0),
          win_rate: winRate,
          overdue_followups: parseInt(f.overdue_followups || 0, 10),
          today_followups: parseInt(f.today_followups || 0, 10),
          workload: activeLeads > 15 ? 'High' : (activeLeads >= 5 ? 'Balanced' : 'Low')
        });
      }
    });

    const totals = {
      teamCount: members.length,
      totalActiveLeads: members.reduce((sum, m) => sum + m.active_leads, 0),
      totalPipelineValue: members.reduce((sum, m) => sum + m.pipeline_value, 0),
      totalWonValue: members.reduce((sum, m) => sum + m.won_value, 0),
      totalOverdueFollowups: members.reduce((sum, m) => sum + m.overdue_followups, 0)
    };

    res.json({ success: true, data: { members, totals } });
  }));

  // Reassign all active leads from one rep to another
  router.post('/team/reassign', wrap(async (req, res) => {
    if (!isLeadManager(req.userSession.role)) {
      throw new HttpError(403, 'Only managers can perform team reassignments');
    }
    const { fromUserId, toUserId } = req.body;
    if (!fromUserId || !toUserId) {
      throw new HttpError(400, 'fromUserId and toUserId are required');
    }
    const team = await getTeam();
    const target = team.find(t => t.user_id === toUserId);
    if (!target) throw new HttpError(404, 'Target sales representative not found');

    const actor = actorOf(req.userSession);
    const updated = await withTx(async (client) => {
      const res = await client.query(`
        UPDATE public.leads
        SET assigned_to_user_id = $1, assigned_to_name = $2, assigned_to_role = $3,
            assigned_salesperson = $2, assigned_at = NOW(), assigned_by_user_id = $4,
            assigned_by_name = $5, updated_at = NOW(), sl_escalated_24h_at = NULL
        WHERE (assigned_to_user_id = $6 OR assigned_salesperson = $6)
          AND pipeline_stage NOT IN ('Won', 'Lost')
          AND deleted_at IS NULL
        RETURNING id
      `, [target.user_id, target.name, target.role || 'Sales Executive', actor.id, actor.name, fromUserId]);

      if (res.rows.length > 0) {
        const leadIds = res.rows.map(r => r.id);
        await client.query(`
          UPDATE public.lead_followups
          SET assigned_salesperson_id = $1, assigned_salesperson_name = $2
          WHERE lead_id = ANY($3::text[]) AND status = 'PENDING'
        `, [target.user_id, target.name, leadIds]);
      }
      return res.rows.length;
    });

    res.json({ success: true, reassignedCount: updated, targetName: target.name });
  }));

  // ── 10. Performance & Analytics Reports ─────────────────────────────────────
  router.get('/reports', wrap(async (req, res) => {
    const range = req.query.range || 'month'; // '7d', '30d', 'month', 'quarter', 'year', 'all'
    let timeClause = '';
    const params = [];
    if (range === '7d') {
      timeClause = ` AND l.created_at >= NOW() - INTERVAL '7 days'`;
    } else if (range === '30d') {
      timeClause = ` AND l.created_at >= NOW() - INTERVAL '30 days'`;
    } else if (range === 'quarter') {
      timeClause = ` AND l.created_at >= DATE_TRUNC('quarter', CURRENT_DATE)`;
    } else if (range === 'year') {
      timeClause = ` AND l.created_at >= DATE_TRUNC('year', CURRENT_DATE)`;
    } else if (range === 'month') {
      timeClause = ` AND l.created_at >= DATE_TRUNC('month', CURRENT_DATE)`;
    }

    const [sourcesRes, lostReasonsRes, stagesRes, repLeaderboardRes, totalsRes] = await Promise.all([
      // 1. Sources breakdown
      query(`
        SELECT 
          COALESCE(NULLIF(source, ''), 'Direct') AS source,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE pipeline_stage = 'Won') AS won,
          COUNT(*) FILTER (WHERE pipeline_stage = 'Lost') AS lost,
          COUNT(*) FILTER (WHERE pipeline_stage NOT IN ('Won', 'Lost')) AS active,
          COALESCE(SUM(estimated_value) FILTER (WHERE pipeline_stage = 'Won'), 0) AS revenue,
          COALESCE(SUM(estimated_value) FILTER (WHERE pipeline_stage NOT IN ('Won', 'Lost')), 0) AS pipeline_value
        FROM public.leads l
        WHERE l.deleted_at IS NULL ${timeClause}
        GROUP BY 1 ORDER BY total DESC
      `, params),

      // 2. Lost reasons
      query(`
        SELECT 
          COALESCE(r.label, l.lost_remarks, 'Not Specified') AS reason,
          COUNT(*) AS count
        FROM public.leads l
        LEFT JOIN public.lead_lost_reasons r ON l.lost_reason_id = r.id
        WHERE l.deleted_at IS NULL AND l.pipeline_stage = 'Lost' ${timeClause}
        GROUP BY 1 ORDER BY count DESC LIMIT 8
      `, params),

      // 3. Stage breakdown
      query(`
        SELECT 
          pipeline_stage,
          COUNT(*) AS count,
          COALESCE(SUM(estimated_value), 0) AS total_value
        FROM public.leads l
        WHERE l.deleted_at IS NULL ${timeClause}
        GROUP BY 1
      `, params),

      // 4. Sales rep leaderboard
      query(`
        SELECT 
          COALESCE(l.assigned_to_name, l.assigned_salesperson, 'Unassigned') AS rep_name,
          COUNT(*) AS total_assigned,
          COUNT(*) FILTER (WHERE pipeline_stage = 'Won') AS won_count,
          COUNT(*) FILTER (WHERE pipeline_stage = 'Lost') AS lost_count,
          COUNT(*) FILTER (WHERE pipeline_stage NOT IN ('Won', 'Lost')) AS active_count,
          COALESCE(SUM(estimated_value) FILTER (WHERE pipeline_stage = 'Won'), 0) AS revenue,
          COALESCE(SUM(estimated_value) FILTER (WHERE pipeline_stage NOT IN ('Won', 'Lost')), 0) AS pipeline_value
        FROM public.leads l
        WHERE l.deleted_at IS NULL ${timeClause}
        GROUP BY 1 ORDER BY revenue DESC, won_count DESC
      `, params),

      // 5. Total high-level KPIs for selected time range
      query(`
        SELECT 
          COUNT(*) AS total_leads,
          COUNT(*) FILTER (WHERE pipeline_stage = 'Won') AS won_count,
          COUNT(*) FILTER (WHERE pipeline_stage = 'Lost') AS lost_count,
          COALESCE(SUM(estimated_value) FILTER (WHERE pipeline_stage = 'Won'), 0) AS total_revenue,
          COALESCE(AVG(estimated_value) FILTER (WHERE pipeline_stage = 'Won' AND estimated_value > 0), 0) AS avg_deal_size
        FROM public.leads l
        WHERE l.deleted_at IS NULL ${timeClause}
      `, params)
    ]);

    const tot = totalsRes.rows[0] || {};
    const wonCount = parseInt(tot.won_count || 0, 10);
    const lostCount = parseInt(tot.lost_count || 0, 10);
    const closedCount = wonCount + lostCount;
    const conversionRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;

    res.json({
      success: true,
      data: {
        range,
        kpis: {
          totalLeads: parseInt(tot.total_leads || 0, 10),
          wonCount,
          lostCount,
          conversionRate,
          totalRevenue: parseFloat(tot.total_revenue || 0),
          avgDealSize: Math.round(parseFloat(tot.avg_deal_size || 0))
        },
        sources: sourcesRes.rows.map(s => {
          const tot = parseInt(s.total, 10);
          const w = parseInt(s.won, 10);
          const l = parseInt(s.lost, 10);
          const c = w + l;
          return {
            source: s.source,
            total: tot,
            won: w,
            lost: l,
            active: parseInt(s.active, 10),
            revenue: parseFloat(s.revenue),
            pipelineValue: parseFloat(s.pipeline_value),
            conversionRate: c > 0 ? Math.round((w / c) * 100) : 0
          };
        }),
        lostReasons: lostReasonsRes.rows.map(r => ({
          reason: r.reason,
          count: parseInt(r.count, 10)
        })),
        stages: stagesRes.rows.map(st => ({
          stage: st.pipeline_stage,
          count: parseInt(st.count, 10),
          value: parseFloat(st.total_value)
        })),
        leaderboard: repLeaderboardRes.rows.map(rep => {
          const w = parseInt(rep.won_count, 10);
          const l = parseInt(rep.lost_count, 10);
          const c = w + l;
          return {
            repName: rep.rep_name,
            totalAssigned: parseInt(rep.total_assigned, 10),
            wonCount: w,
            lostCount: l,
            activeCount: parseInt(rep.active_count, 10),
            revenue: parseFloat(rep.revenue),
            pipelineValue: parseFloat(rep.pipeline_value),
            winRate: c > 0 ? Math.round((w / c) * 100) : 0
          };
        })
      }
    });
  }));

  // ── 11. Lead Automation & Inbound Rules ─────────────────────────────────────
  router.get('/automation', wrap(async (req, res) => {
    requireManager(req);
    const s = await query(`SELECT value FROM public.lead_settings WHERE key = 'automation_rules'`);
    const val = s.rows[0]?.value || DEFAULT_AUTOMATION;
    res.json({ success: true, data: val });
  }));

  router.put('/automation', wrap(async (req, res) => {
    if (!isLeadManager(req.userSession.role)) {
      throw new HttpError(403, 'Only managers can modify automation rules');
    }
    const val = req.body || {};
    await query(`
      INSERT INTO public.lead_settings (key, value, updated_at)
      VALUES ('automation_rules', $1::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = NOW()
    `, [JSON.stringify(val)]);
    res.json({ success: true, data: val });
  }));

  router.post('/automation/test-webhook', wrap(async (req, res) => {
    const team = await getTeam();
    const s = await query(`SELECT value FROM public.lead_settings WHERE key = 'automation_rules'`);
    const auto = s.rows[0]?.value || DEFAULT_AUTOMATION;

    // Pick assignee based on mode
    let assignee = null;
    if (auto.autoAssign?.enabled && team.length > 0) {
      if (auto.autoAssign.mode === 'workload_balance') {
        const counts = await query(`
          SELECT assigned_to_user_id, COUNT(*) as cnt FROM public.leads
          WHERE deleted_at IS NULL AND pipeline_stage NOT IN ('Won', 'Lost')
          GROUP BY 1
        `);
        const map = Object.fromEntries(counts.rows.map(r => [r.assigned_to_user_id, parseInt(r.cnt, 10)]));
        team.sort((a, b) => (map[a.user_id] || 0) - (map[b.user_id] || 0));
        assignee = team[0];
      } else {
        assignee = team[Math.floor(Math.random() * team.length)];
      }
    }

    const testBody = req.body || {};
    const company = testBody.company_name || 'Acme Solar Tech Ltd';
    const contact = testBody.contact_person || 'Sunil Verma';
    const phone = testBody.phone || '+91 98765 43210';
    const email = testBody.email || 'sunil@acmesolar.com';
    const source = testBody.source || 'Website Inbound Form';
    const reqText = testBody.product_requirement || '50kW Rooftop Solar HDG Structure with walk-ways';
    const estVal = testBody.estimated_value || 450000;

    const leadNum = await withTx(async (client) => {
      const num = await nextLeadNumber(client);
      const lid = genId('LD');
      await client.query(`
        INSERT INTO public.leads (
          id, lead_number, company_name, contact_person, phone, email, source,
          pipeline_stage, priority, product_requirement, estimated_value,
          assigned_to_user_id, assigned_to_name, assigned_to_role, assigned_salesperson,
          assigned_at, lead_created_by_id, lead_created_by_name,
          created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'New','High',$8,$9,$10,$11,$12,$11,NOW(),$13,$14,NOW(),NOW())
      `, [
        lid, num, company, contact, phone, email, source,
        reqText, estVal,
        assignee?.user_id || null, assignee?.name || null, assignee?.role || null,
        'WEBHOOK', 'Inbound Webhook System'
      ]);

      if (auto.autoFollowup?.enabled) {
        const dt = new Date(Date.now() + (auto.autoFollowup.delayHours || 24) * 3600 * 1000);
        await client.query(`
          INSERT INTO public.lead_followups (
            id, lead_id, followup_type, scheduled_at, notes, status,
            assigned_salesperson_id, assigned_salesperson_name, created_by_user_id, created_by_name, created_at
          ) VALUES ($1,$2,$3,$4,$5,'PENDING',$6,$7,'WEBHOOK','Inbound Automation',NOW())
        `, [
          genId('LF'), lid, auto.autoFollowup.type || 'CALL', dt.toISOString(),
          auto.autoFollowup.notes || 'Automated response & qualification',
          assignee?.user_id || null, assignee?.name || null
        ]);
        await client.query(`UPDATE public.leads SET next_action_due_at = $2 WHERE id = $1`, [lid, dt.toISOString()]);
      }

      return { id: lid, lead_number: num, assigned_to: assignee?.name || 'Unassigned' };
    });

    res.json({ success: true, message: `Inbound lead created successfully via webhook simulator!`, lead: leadNum });
  }));

  // ── Unified Inbound Lead Intake (Website, WhatsApp, Meta Ads, IndiaMART) ─────
  router.post('/inbound', wrap(async (req, res) => {
    const b = req.body || {};
    const source = String(b.source || 'Website Inbound').trim();
    const phoneClean = String(b.phone || b.mobile || '').replace(/\D/g, '');
    if (!phoneClean || phoneClean.length < 10) {
      throw new HttpError(400, 'Valid phone number is required (at least 10 digits)');
    }
    const company = String(b.company_name || '').trim() || String(b.contact_person || '').trim() || `Contact ${phoneClean.slice(-10)}`;
    const email = b.email ? String(b.email).trim() : null;
    const team = await getTeam();
    const settings = await getSettings();

    // Idempotency check
    const idempKey = String(b.idempotency_key || b.external_enquiry_id || `${source}_${phoneClean.slice(-10)}_${Date.now()}`);

    const lead = await withTx(async (client) => {
      // 1. Check idempotency table
      const idempRes = await client.query(
        `SELECT lead_id FROM public.lead_webhook_events WHERE idempotency_key = $1`, [idempKey]
      );
      if (idempRes.rows.length && idempRes.rows[0].lead_id) {
        const existing = await client.query(`SELECT ${SUMMARY_COLS} FROM public.leads l WHERE id = $1`, [idempRes.rows[0].lead_id]);
        if (existing.rows.length) return existing.rows[0];
      }

      // 2. Customer Master match or active lead match
      const custMatch = await findExistingCustomerMatch(client, {
        phone: phoneClean, whatsapp: b.whatsapp, email, company_name: company
      });
      let customerId = null;
      let customerCode = null;
      let assignee = null;

      if (custMatch) {
        if (custMatch.type === 'CUSTOMER_MASTER') {
          customerId = custMatch.record.id;
          customerCode = custMatch.record.customer_code;
          if (custMatch.record.assigned_salesperson) {
            assignee = team.find(t => 
              t.user_id === custMatch.record.assigned_salesperson ||
              t.name.toLowerCase() === custMatch.record.assigned_salesperson.toLowerCase()
            );
          }
        } else if (custMatch.type === 'EXISTING_LEAD') {
          customerId = custMatch.record.customer_id;
          customerCode = custMatch.record.customer_code;
          if (custMatch.record.assigned_to_user_id) {
            assignee = team.find(t => t.user_id === custMatch.record.assigned_to_user_id);
          }
        }
      }

      // 3. Concurrency-Safe Round-Robin if no existing rep matched
      if (!assignee && team.length > 0) {
        assignee = await getNextRoundRobinAssignee(client, team);
      }

      // 4. Create Lead
      const id = genId('SLD');
      const leadNumber = await nextLeadNumber(client);
      const stage = 'New';
      await client.query(
        `INSERT INTO public.leads (
          id, lead_number, company_name, contact_person, designation, phone, whatsapp, email, source,
          status, pipeline_stage, priority, category, location, territory, product_requirement, estimated_kw, estimated_value,
          customer_id, customer_code, external_enquiry_id,
          lead_created_by_id, lead_created_by_name, assigned_to_user_id, assigned_to_name, assigned_to_role,
          assigned_by_user_id, assigned_by_name, assigned_by_role, assigned_at, assigned_salesperson, stage_changed_at, created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,
          $10,$11,$12,$13,$14,$15,$16,$17,$18,
          $19,$20,$21,
          'INBOUND_SYSTEM','Inbound Integration',$22,$23,$24,
          'SYSTEM','Smart Leads System','System',
          CASE WHEN $22::text IS NULL THEN NULL ELSE NOW() END,
          $23, NOW(), NOW(), NOW()
        )`,
        [
          id, leadNumber, company, b.contact_person || null, b.designation || null, phoneClean, b.whatsapp || null, email, source,
          mapStageToLegacyStatus(stage, !!assignee), stage, String(b.priority || 'HIGH').toUpperCase(),
          b.category || null, b.location || null, b.territory || null, b.product_requirement || null,
          Number(b.estimated_kw) || null, Number(b.estimated_value) || null,
          customerId, customerCode, b.external_enquiry_id || null,
          assignee?.user_id || null, assignee?.name || null, assignee?.role || null
        ]
      );

      await insertStatusHistory(client, id, null, 'New', `Inbound lead received via ${source}`, { id: 'SYSTEM', name: 'Inbound Integration' });

      if (assignee) {
        await client.query(
          `INSERT INTO public.lead_assignment_history (
            id, lead_id, assigned_by_user_id, assigned_by_name, assigned_by_role,
            assigned_to_user_id, assigned_to_name, assigned_to_role, assignment_reason, assignment_type, created_at
          ) VALUES ($1,$2,'SYSTEM','Smart Leads System','System',$3,$4,$5,$6,'ROUND_ROBIN',NOW())`,
          [genId('LAH'), id, assignee.user_id, assignee.name, assignee.role || null, custMatch ? 'Assigned to existing account owner' : 'Round-Robin Inbound Distribution']
        );
      }

      await client.query(
        `INSERT INTO public.lead_webhook_events (source, idempotency_key, payload, status, lead_id, received_at, processed_at)
         VALUES ($1,$2,$3::jsonb,'PROCESSED',$4,NOW(),NOW())
         ON CONFLICT (idempotency_key) DO UPDATE SET status = 'PROCESSED', processed_at = NOW(), lead_id = $4`,
        [source, idempKey, JSON.stringify(b), id]
      );

      return refreshDerived(client, id, settings.scoring);
    });

    if (lead.assigned_to_user_id) {
      notify({
        recipientEmpCode: lead.assigned_to_user_id,
        eventType: 'LEAD_ASSIGNED',
        documentType: 'LEAD',
        documentId: lead.id,
        title: `New Inbound Lead Assigned (${source})`,
        message: `${lead.lead_number} – ${lead.company_name} was assigned to you via Round-Robin.`,
        actorEmpCode: 'SYSTEM',
        actorName: 'Smart Leads System',
        actorRole: 'System',
        targetTab: 'Smart Leads',
        targetRecordId: lead.id,
        dedupId: `smart-lead-inbound-${lead.id}-${lead.assigned_to_user_id}`
      }).catch(() => {});
    }

    emit('create', lead);
    res.status(201).json({ success: true, lead });
  }));

  return router;
}

/**
 * Master Smart Leads Automation Engine:
 * 1. 3h Unassigned Escalation to CEO & Tech Support
 * 2. 2h Inactivity on Assigned Lead Escalation to CEO & Tech Support + Sales Rep Reminder
 * 3. 48h Inactivity on Active Open Leads Escalation to CEO & Tech Support + Sales Rep Reminder
 * 4. 15-Minute Follow-up Reminder to Sales Rep
 * 5. Due-Now Follow-up Notification to Sales Rep
 * 6. Missed Follow-up Escalation to CEO & Tech Support
 */
export async function runSmartLeadsAutomations({ notify = async () => {}, getStaff = async () => [] } = {}) {
  const staff = await getStaff().catch(() => []);
  const managers = staff.filter(s => isLeadManager(s.role));
  const techSupport = staff.filter(s => /tech(nical)?\s*support/i.test(String(s.role || '')));
  const execs = managers.length ? managers : techSupport;

  const report = {
    unassigned3h: 0,
    inactivity2h: 0,
    inactivity48h: 0,
    followup15m: 0,
    followupDue: 0,
    followupMissed: 0
  };

  // 1. 3-Hour Unassigned Lead Escalation (Phase 4)
  const unassignedRes = await query(`
    UPDATE public.leads
    SET sl_escalated_unassigned_3h_at = NOW(), updated_at = NOW()
    WHERE id IN (
      SELECT id FROM public.leads
      WHERE deleted_at IS NULL
        AND assigned_to_user_id IS NULL
        AND sl_escalated_unassigned_3h_at IS NULL
        AND created_at <= NOW() - INTERVAL '3 hours'
      LIMIT 100
    )
    RETURNING id, lead_number, company_name, created_at
  `);
  for (const row of unassignedRes.rows) {
    report.unassigned3h++;
    for (const mgr of execs) {
      await notify({
        recipientEmpCode: mgr.user_id,
        eventType: 'LEAD_UNASSIGNED_3H',
        documentType: 'LEAD',
        documentId: row.id,
        title: 'Lead unassigned for 3+ hours',
        message: `${row.lead_number} – ${row.company_name} was created 3+ hours ago and remains unassigned.`,
        actorEmpCode: 'SYSTEM',
        actorName: 'Smart Leads Automation',
        actorRole: 'System',
        targetTab: 'Smart Leads',
        targetRecordId: row.id,
        dedupId: `smart-lead-unassigned-3h-${row.id}-${mgr.user_id}`
      }).catch(() => {});
    }
  }

  // 2. 2-Hour Assigned Lead Inactivity Alert (Phase 6)
  const inactivity2hRes = await query(`
    UPDATE public.leads
    SET sl_escalated_2h_at = NOW(), updated_at = NOW()
    WHERE id IN (
      SELECT id FROM public.leads
      WHERE deleted_at IS NULL
        AND assigned_to_user_id IS NOT NULL
        AND pipeline_stage = 'New'
        AND last_qualifying_activity_at IS NULL
        AND sl_escalated_2h_at IS NULL
        AND assigned_at <= NOW() - INTERVAL '2 hours'
      LIMIT 100
    )
    RETURNING id, lead_number, company_name, assigned_to_user_id, assigned_to_name, assigned_at
  `);
  for (const row of inactivity2hRes.rows) {
    report.inactivity2h++;
    for (const mgr of execs) {
      await notify({
        recipientEmpCode: mgr.user_id,
        eventType: 'LEAD_INACTIVITY_2H',
        documentType: 'LEAD',
        documentId: row.id,
        title: 'Lead uncontacted for 2+ hours',
        message: `${row.lead_number} – ${row.company_name} assigned to ${row.assigned_to_name || 'sales rep'} has had no customer contact for 2 hours.`,
        actorEmpCode: 'SYSTEM',
        actorName: 'Smart Leads Automation',
        actorRole: 'System',
        targetTab: 'Smart Leads',
        targetRecordId: row.id,
        dedupId: `smart-lead-inactivity-2h-${row.id}-${mgr.user_id}`
      }).catch(() => {});
    }
    if (row.assigned_to_user_id) {
      await notify({
        recipientEmpCode: row.assigned_to_user_id,
        eventType: 'LEAD_ACTION_REQUIRED',
        documentType: 'LEAD',
        documentId: row.id,
        title: 'Action required on assigned lead',
        message: `${row.lead_number} – ${row.company_name} was assigned 2 hours ago. Please make initial contact and log activity.`,
        actorEmpCode: 'SYSTEM',
        actorName: 'Smart Leads Automation',
        actorRole: 'System',
        targetTab: 'Smart Leads',
        targetRecordId: row.id,
        dedupId: `smart-lead-rep-reminder-2h-${row.id}-${row.assigned_to_user_id}`
      }).catch(() => {});
    }
  }

  // 3. 48-Hour Inactivity Monitoring (Phase 7)
  const inactivity48hRes = await query(`
    UPDATE public.leads
    SET sl_escalated_48h_at = NOW(), updated_at = NOW()
    WHERE id IN (
      SELECT id FROM public.leads
      WHERE deleted_at IS NULL
        AND assigned_to_user_id IS NOT NULL
        AND pipeline_stage = ANY($1::text[])
        AND sl_escalated_48h_at IS NULL
        AND COALESCE(last_qualifying_activity_at, assigned_at, created_at) <= NOW() - INTERVAL '48 hours'
      LIMIT 100
    )
    RETURNING id, lead_number, company_name, assigned_to_user_id, assigned_to_name, pipeline_stage
  `, [OPEN_STAGES]);
  for (const row of inactivity48hRes.rows) {
    report.inactivity48h++;
    for (const mgr of execs) {
      await notify({
        recipientEmpCode: mgr.user_id,
        eventType: 'LEAD_INACTIVITY_48H',
        documentType: 'LEAD',
        documentId: row.id,
        title: 'Lead stalled for 48+ hours',
        message: `${row.lead_number} – ${row.company_name} (${row.assigned_to_name || 'sales rep'}) has had no activity for 48+ hours in stage ${row.pipeline_stage}.`,
        actorEmpCode: 'SYSTEM',
        actorName: 'Smart Leads Automation',
        actorRole: 'System',
        targetTab: 'Smart Leads',
        targetRecordId: row.id,
        dedupId: `smart-lead-inactivity-48h-${row.id}-${mgr.user_id}`
      }).catch(() => {});
    }
    if (row.assigned_to_user_id) {
      await notify({
        recipientEmpCode: row.assigned_to_user_id,
        eventType: 'LEAD_STALLED',
        documentType: 'LEAD',
        documentId: row.id,
        title: 'Follow-up needed: 48h inactive',
        message: `${row.lead_number} – ${row.company_name} has had no logged activity for 48 hours. Please update customer status.`,
        actorEmpCode: 'SYSTEM',
        actorName: 'Smart Leads Automation',
        actorRole: 'System',
        targetTab: 'Smart Leads',
        targetRecordId: row.id,
        dedupId: `smart-lead-rep-reminder-48h-${row.id}-${row.assigned_to_user_id}`
      }).catch(() => {});
    }
  }

  // 4. 15-Minute Follow-Up Reminder (Phase 9)
  const followup15mRes = await query(`
    UPDATE public.lead_followups
    SET reminded_15m_at = NOW()
    WHERE id IN (
      SELECT f.id FROM public.lead_followups f
      WHERE f.status = 'PENDING'
        AND f.reminded_15m_at IS NULL
        AND f.scheduled_at > NOW()
        AND f.scheduled_at <= NOW() + INTERVAL '15 minutes'
      LIMIT 100
    )
    RETURNING id, lead_id, followup_type, scheduled_at, assigned_salesperson_id, assigned_salesperson_name
  `);
  for (const f of followup15mRes.rows) {
    report.followup15m++;
    if (f.assigned_salesperson_id) {
      const dtStr = new Date(f.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      await notify({
        recipientEmpCode: f.assigned_salesperson_id,
        eventType: 'FOLLOWUP_REMINDER_15M',
        documentType: 'LEAD_FOLLOWUP',
        documentId: f.id,
        title: `Follow-up in 15 minutes (${f.followup_type})`,
        message: `Your ${f.followup_type} follow-up is scheduled for ${dtStr}.`,
        actorEmpCode: 'SYSTEM',
        actorName: 'Smart Leads Automation',
        actorRole: 'System',
        targetTab: 'Smart Leads',
        targetRecordId: f.lead_id,
        dedupId: `smart-followup-15m-${f.id}-${f.assigned_salesperson_id}`
      }).catch(() => {});
    }
  }

  // 5. Follow-Up Due Now (Phase 9)
  const followupDueRes = await query(`
    UPDATE public.lead_followups
    SET reminded_due_at = NOW()
    WHERE id IN (
      SELECT f.id FROM public.lead_followups f
      WHERE f.status = 'PENDING'
        AND f.reminded_due_at IS NULL
        AND f.scheduled_at <= NOW()
        AND f.scheduled_at >= NOW() - INTERVAL '10 minutes'
      LIMIT 100
    )
    RETURNING id, lead_id, followup_type, scheduled_at, assigned_salesperson_id, assigned_salesperson_name
  `);
  for (const f of followupDueRes.rows) {
    report.followupDue++;
    if (f.assigned_salesperson_id) {
      await notify({
        recipientEmpCode: f.assigned_salesperson_id,
        eventType: 'FOLLOWUP_DUE_NOW',
        documentType: 'LEAD_FOLLOWUP',
        documentId: f.id,
        title: `Follow-up due now (${f.followup_type})`,
        message: `Your ${f.followup_type} follow-up is due now.`,
        actorEmpCode: 'SYSTEM',
        actorName: 'Smart Leads Automation',
        actorRole: 'System',
        targetTab: 'Smart Leads',
        targetRecordId: f.lead_id,
        dedupId: `smart-followup-due-${f.id}-${f.assigned_salesperson_id}`
      }).catch(() => {});
    }
  }

  // 6. Missed Follow-Up Escalation (Phase 9)
  const followupMissedRes = await query(`
    UPDATE public.lead_followups
    SET escalated_missed_at = NOW()
    WHERE id IN (
      SELECT f.id FROM public.lead_followups f
      WHERE f.status = 'PENDING'
        AND f.escalated_missed_at IS NULL
        AND f.scheduled_at < NOW() - INTERVAL '15 minutes'
      LIMIT 100
    )
    RETURNING id, lead_id, followup_type, scheduled_at, assigned_salesperson_id, assigned_salesperson_name
  `);
  for (const f of followupMissedRes.rows) {
    report.followupMissed++;
    const dtStr = new Date(f.scheduled_at).toLocaleString('en-IN');
    for (const mgr of execs) {
      await notify({
        recipientEmpCode: mgr.user_id,
        eventType: 'FOLLOWUP_MISSED',
        documentType: 'LEAD_FOLLOWUP',
        documentId: f.id,
        title: `Missed Follow-up: ${f.assigned_salesperson_name || 'Sales Rep'}`,
        message: `${f.assigned_salesperson_name || 'Sales rep'} missed a scheduled ${f.followup_type} follow-up (was due ${dtStr}).`,
        actorEmpCode: 'SYSTEM',
        actorName: 'Smart Leads Automation',
        actorRole: 'System',
        targetTab: 'Smart Leads',
        targetRecordId: f.lead_id,
        dedupId: `smart-followup-missed-${f.id}-${mgr.user_id}`
      }).catch(() => {});
    }
  }

  return report;
}

export const runSmartLeadsSlaEscalation = runSmartLeadsAutomations;
