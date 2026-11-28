// BUSINZ Smart Leads — additive, idempotent schema migration.
// Runs ONLY when ENABLE_SMART_LEADS=true. Reverse with server/migrations/20261120_smart_leads_down.sql
import fs from 'fs';
import path from 'path';
import { query } from './db.js';
import { getStoreFilePath } from './runtimePaths.js';
import {
  mapLegacyStatusToStage, computeLeadScore, DEFAULT_SCORING,
  DEFAULT_STAGE_PROBABILITIES, DEFAULT_SLA, DEFAULT_LOST_REASONS
} from './smartLeadsRules.js';

export async function ensureSmartLeadsSchema() {
  // 1. Ensure public.leads table exists before running column alterations
  await query(`
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
      estimated_value NUMERIC DEFAULT 0,
      category TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 2. Add columns individually to prevent any single column failure from aborting others
  const leadCols = [
    'estimated_value NUMERIC DEFAULT 0',
    'estimated_kw NUMERIC',
    'category TEXT',
    'location TEXT',
    'product_requirement TEXT',
    "priority TEXT DEFAULT 'Medium'",
    'designation TEXT',
    'whatsapp TEXT',
    'email TEXT',
    'last_activity_at TIMESTAMPTZ',
    'last_activity_type TEXT',
    'converted_customer_id TEXT',
    'converted_customer_code TEXT',
    'is_converted BOOLEAN DEFAULT FALSE',
    'assigned_salesperson TEXT',
    'assigned_to_user_id TEXT',
    'assigned_to_name TEXT',
    'assigned_to_role TEXT',
    'assigned_by_user_id TEXT',
    'assigned_by_name TEXT',
    'assigned_by_role TEXT',
    'assigned_at TIMESTAMPTZ',
    'lead_created_by_id TEXT',
    'lead_created_by_name TEXT',
    'pipeline_stage TEXT',
    'lost_reason_id TEXT',
    'lost_remarks TEXT',
    'score INTEGER',
    'score_breakdown JSONB',
    'temperature TEXT',
    'territory TEXT',
    'next_action TEXT',
    'next_action_due_at TIMESTAMPTZ',
    'next_action_exception TEXT',
    'stage_changed_at TIMESTAMPTZ',
    'deleted_at TIMESTAMPTZ',
    'merged_into_lead_id TEXT',
    'sl_escalated_24h_at TIMESTAMPTZ',
    'customer_id TEXT',
    'customer_code TEXT',
    'last_qualifying_activity_at TIMESTAMPTZ',
    'first_qualifying_activity_at TIMESTAMPTZ',
    'sl_escalated_unassigned_3h_at TIMESTAMPTZ',
    'sl_escalated_2h_at TIMESTAMPTZ',
    'sl_escalated_48h_at TIMESTAMPTZ'
  ];

  for (const col of leadCols) {
    try {
      await query(`ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ${col};`);
    } catch (colErr) {
      console.warn(`[Smart Leads Schema] Warning adding column ${col}:`, colErr.message);
    }
  }

  await query(`
    CREATE TABLE IF NOT EXISTS public.lead_followups (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
      scheduled_at TIMESTAMPTZ NOT NULL,
      completed_at TIMESTAMPTZ,
      notes TEXT,
      status TEXT DEFAULT 'Scheduled',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      created_by_user_id TEXT,
      created_by_name TEXT,
      assigned_to_user_id TEXT,
      assigned_to_name TEXT
    );

    ALTER TABLE public.lead_followups
      ADD COLUMN IF NOT EXISTS followup_type TEXT DEFAULT 'CALL',
      ADD COLUMN IF NOT EXISTS outcome TEXT,
      ADD COLUMN IF NOT EXISTS rescheduled_from_id TEXT,
      ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS created_by_user_id TEXT,
      ADD COLUMN IF NOT EXISTS created_by_name TEXT,
      ADD COLUMN IF NOT EXISTS reminded_15m_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reminded_due_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS escalated_missed_at TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS public.lead_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_by TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.lead_lost_reasons (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL UNIQUE,
      is_active BOOLEAN DEFAULT TRUE,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.lead_field_audit (
      id BIGSERIAL PRIMARY KEY,
      lead_id TEXT NOT NULL,
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by_user_id TEXT,
      changed_by_name TEXT,
      changed_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.lead_notes (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_by_user_id TEXT,
      created_by_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.lead_automation_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      priority INTEGER DEFAULT 100,
      match_source TEXT,
      match_territory TEXT,
      match_category TEXT,
      assign_mode TEXT NOT NULL DEFAULT 'FIXED',
      assign_to_user_ids JSONB DEFAULT '[]'::jsonb,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.lead_webhook_events (
      id BIGSERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      payload JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'RECEIVED',
      lead_id TEXT,
      attempts INTEGER DEFAULT 0,
      last_error TEXT,
      received_at TIMESTAMPTZ DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS public.sales_team_members (
      user_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT,
      territory TEXT,
      categories JSONB DEFAULT '[]'::jsonb,
      manager_user_id TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      max_open_leads INTEGER,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.sales_targets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      period TEXT NOT NULL,
      target_value NUMERIC DEFAULT 0,
      target_leads_won INTEGER DEFAULT 0,
      updated_by TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, period)
    );

    CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON public.leads (pipeline_stage) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_leads_owner_stage ON public.leads (assigned_to_user_id, pipeline_stage);
    CREATE INDEX IF NOT EXISTS idx_leads_next_action_due ON public.leads (next_action_due_at);
    CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads (phone);
    CREATE INDEX IF NOT EXISTS idx_leads_email_lower ON public.leads (LOWER(email));
    CREATE INDEX IF NOT EXISTS idx_leads_created_desc ON public.leads (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_lead_followups_lead ON public.lead_followups (lead_id);
    CREATE INDEX IF NOT EXISTS idx_lead_followups_due ON public.lead_followups (status, scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_lead_field_audit_lead ON public.lead_field_audit (lead_id, changed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_lead_notes_lead ON public.lead_notes (lead_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON public.leads (customer_id);
    CREATE INDEX IF NOT EXISTS idx_leads_unassigned_3h ON public.leads (created_at) WHERE assigned_to_user_id IS NULL AND deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_leads_inactivity_2h ON public.leads (assigned_at) WHERE assigned_to_user_id IS NOT NULL AND deleted_at IS NULL;
  `);

  // Seed defaults (only if missing — never overwrites admin-edited settings)
  await query(
    `INSERT INTO public.lead_settings (key, value) VALUES
       ('stage_probabilities', $1::jsonb), ('sla', $2::jsonb), ('scoring', $3::jsonb)
     ON CONFLICT (key) DO NOTHING`,
    [JSON.stringify(DEFAULT_STAGE_PROBABILITIES), JSON.stringify(DEFAULT_SLA), JSON.stringify(DEFAULT_SCORING)]
  );
  for (let i = 0; i < DEFAULT_LOST_REASONS.length; i++) {
    await query(
      `INSERT INTO public.lead_lost_reasons (id, label, sort_order) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [`LR-${String(i + 1).padStart(2, '0')}`, DEFAULT_LOST_REASONS[i], i + 1]
    );
  }

  // Merge any legacy Lead Management records (controlroom_store crm_leads + crm_leads.json) into public.leads
  try {
    const legacyLeads = [];
    const storeRes = await query(`SELECT data FROM public.controlroom_store WHERE key IN ('crm_leads', 'leads')`);
    for (const r of storeRes.rows) {
      if (Array.isArray(r.data)) legacyLeads.push(...r.data);
    }
    const diskPath = getStoreFilePath('crm_leads.json');
    if (fs.existsSync(diskPath)) {
      const diskData = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
      if (Array.isArray(diskData)) legacyLeads.push(...diskData);
    }

    if (legacyLeads.length > 0) {
      const existingRes = await query(`SELECT id, lead_number FROM public.leads`);
      const seenIds = new Set(existingRes.rows.map(r => String(r.id || '').trim()).filter(Boolean));
      const seenNums = new Set(existingRes.rows.map(r => String(r.lead_number || '').trim().toUpperCase()).filter(Boolean));
      let mergedCount = 0;

      for (const l of legacyLeads) {
        if (!l || typeof l !== 'object') continue;
        const id = String(l.id || l.lead_number || l.leadNumber || '').trim();
        const leadNum = String(l.lead_number || l.leadNumber || id || '').trim();
        const companyName = String(l.company_name || l.companyName || l.contact_person || l.contactPerson || 'Unnamed Lead').trim();
        if (!id || seenIds.has(id) || (leadNum && seenNums.has(leadNum.toUpperCase()))) continue;

        seenIds.add(id);
        if (leadNum) seenNums.add(leadNum.toUpperCase());

        const status = String(l.status || 'New Lead').trim();
        const stage = l.pipeline_stage || l.pipelineStage || mapLegacyStatusToStage(status);
        const assignedName = l.assigned_to_name || l.assignedToName || l.assigned_salesperson || l.assignedSalesperson || null;
        const assignedId = l.assigned_to_user_id || l.assignedToUserId || null;
        const estKw = Number(l.estimated_kw ?? l.estimatedKw ?? 0) || 0;
        const estVal = Number(l.estimated_value ?? l.estimatedValue ?? (estKw > 0 ? estKw * 35000 : 0)) || 0;
        const createdAt = l.created_at || l.createdAt || new Date().toISOString();
        const updatedAt = l.updated_at || l.updatedAt || createdAt;

        await query(
          `INSERT INTO public.leads (
            id, lead_number, company_name, contact_person, designation, phone, whatsapp, email,
            source, status, pipeline_stage, priority, assigned_salesperson, assigned_to_user_id,
            assigned_to_name, estimated_kw, estimated_value, category, location, notes, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14,
            $15, $16, $17, $18, $19, $20, $21, $22
          ) ON CONFLICT DO NOTHING`,
          [
            id, leadNum || null, companyName,
            l.contact_person || l.contactPerson || null,
            l.designation || null,
            l.phone || null,
            l.whatsapp || l.phone || null,
            l.email || null,
            l.source || 'Manual',
            status,
            stage,
            l.priority || 'Medium',
            assignedName,
            assignedId,
            assignedName,
            estKw,
            estVal,
            l.category || null,
            l.location || null,
            typeof l.notes === 'string' ? l.notes : null,
            createdAt,
            updatedAt
          ]
        );
        mergedCount++;
      }
      if (mergedCount > 0) {
        console.log(`✅ [Smart Leads] Merged ${mergedCount} legacy Lead Management records into public.leads.`);
      }
    }

    await query(
      `UPDATE public.leads
          SET assigned_to_name = assigned_salesperson
        WHERE (assigned_to_name IS NULL OR TRIM(assigned_to_name) = '')
          AND assigned_salesperson IS NOT NULL
          AND TRIM(assigned_salesperson) <> ''`
    );
  } catch (mergeErr) {
    console.warn('[Smart Leads] Legacy crm_leads merge notice:', mergeErr.message);
  }

  // One-time backfill of pipeline_stage + score for rows that don't have it yet (migration, not normal UI use)
  const pending = await query(
    `SELECT id, status, source, estimated_value, estimated_kw, phone, whatsapp, email, last_activity_at
       FROM public.leads WHERE pipeline_stage IS NULL`
  );
  for (const row of pending.rows) {
    const stage = mapLegacyStatusToStage(row.status);
    const { score, temperature, breakdown } = computeLeadScore({ ...row, pipeline_stage: stage });
    await query(
      `UPDATE public.leads
          SET pipeline_stage = $2, score = $3, temperature = $4, score_breakdown = $5::jsonb,
              lost_reason_id = CASE WHEN $2 = 'Lost' AND lost_reason_id IS NULL THEN 'LR-08' ELSE lost_reason_id END,
              stage_changed_at = COALESCE(stage_changed_at, updated_at, created_at)
        WHERE id = $1 AND pipeline_stage IS NULL`,
      [row.id, stage, score, temperature, JSON.stringify(breakdown)]
    );
  }
  if (pending.rows.length) console.log(`✅ [Smart Leads] Backfilled pipeline_stage for ${pending.rows.length} leads.`);
}
