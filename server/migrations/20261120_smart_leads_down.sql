-- BUSINZ Smart Leads — ROLLBACK of ensureSmartLeadsSchema() (server/smartLeadsSchema.js)
-- Drops ONLY what Smart Leads added. Existing lead data, status, history, and followup rows are preserved.
BEGIN;
DROP INDEX IF EXISTS public.idx_leads_pipeline_stage;
DROP INDEX IF EXISTS public.idx_leads_owner_stage;
DROP INDEX IF EXISTS public.idx_leads_next_action_due;
DROP INDEX IF EXISTS public.idx_leads_phone;
DROP INDEX IF EXISTS public.idx_leads_email_lower;
DROP INDEX IF EXISTS public.idx_leads_created_desc;
DROP INDEX IF EXISTS public.idx_lead_followups_lead;
DROP INDEX IF EXISTS public.idx_lead_followups_due;

DROP TABLE IF EXISTS public.sales_targets;
DROP TABLE IF EXISTS public.sales_team_members;
DROP TABLE IF EXISTS public.lead_webhook_events;
DROP TABLE IF EXISTS public.lead_automation_rules;
DROP TABLE IF EXISTS public.lead_notes;
DROP TABLE IF EXISTS public.lead_field_audit;
DROP TABLE IF EXISTS public.lead_lost_reasons;
DROP TABLE IF EXISTS public.lead_settings;

ALTER TABLE public.lead_followups
  DROP COLUMN IF EXISTS followup_type,
  DROP COLUMN IF EXISTS outcome,
  DROP COLUMN IF EXISTS rescheduled_from_id,
  DROP COLUMN IF EXISTS escalated_at,
  DROP COLUMN IF EXISTS created_by_user_id,
  DROP COLUMN IF EXISTS created_by_name;

ALTER TABLE public.leads
  DROP COLUMN IF EXISTS pipeline_stage,
  DROP COLUMN IF EXISTS lost_reason_id,
  DROP COLUMN IF EXISTS lost_remarks,
  DROP COLUMN IF EXISTS score,
  DROP COLUMN IF EXISTS score_breakdown,
  DROP COLUMN IF EXISTS temperature,
  DROP COLUMN IF EXISTS territory,
  DROP COLUMN IF EXISTS next_action,
  DROP COLUMN IF EXISTS next_action_due_at,
  DROP COLUMN IF EXISTS next_action_exception,
  DROP COLUMN IF EXISTS stage_changed_at,
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS merged_into_lead_id;
COMMIT;
