-- ============================================================================
-- BUSINZ CRM - Centralized Lead Management & IndiaMART Integration Migration
-- Date: 2026-10-22
-- ============================================================================

-- 1. Extend public.leads table with strict assignment, IndiaMART, and activity columns
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
  ADD COLUMN IF NOT EXISTS is_unattended_48h BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS unattended_alert_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalation_alert_sent_at TIMESTAMPTZ;

-- Unique constraint on external_enquiry_id to prevent duplicate imports idempotently
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_external_enquiry_id 
  ON public.leads(external_enquiry_id) 
  WHERE external_enquiry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_assigned_to 
  ON public.leads(assigned_to_user_id);

CREATE INDEX IF NOT EXISTS idx_leads_assigned_by 
  ON public.leads(assigned_by_user_id);

CREATE INDEX IF NOT EXISTS idx_leads_status 
  ON public.leads(status);

CREATE INDEX IF NOT EXISTS idx_leads_source 
  ON public.leads(source);

CREATE INDEX IF NOT EXISTS idx_leads_assigned_at 
  ON public.leads(assigned_at);


-- 2. Permanent Assignment History Table (Immutable audit trail; NO CASCADE deletion)
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
  assignment_type TEXT NOT NULL DEFAULT 'INITIAL', -- 'INITIAL' | 'REASSIGNMENT'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_assign_hist_lead 
  ON public.lead_assignment_history(lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_assign_hist_created 
  ON public.lead_assignment_history(created_at DESC);


-- 3. Lead Activities Table (Call logs, customer responses, meetings, view tracking)
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  activity_type TEXT NOT NULL, -- 'CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'SITE_VISIT', 'NOTE', 'VIEW'
  is_qualifying_activity BOOLEAN NOT NULL DEFAULT false, -- True ONLY if genuine customer interaction that satisfies 24h rule
  summary TEXT NOT NULL,
  customer_response TEXT,
  call_duration_seconds INT,
  conducted_by_user_id TEXT NOT NULL,
  conducted_by_name TEXT NOT NULL,
  conducted_by_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead 
  ON public.lead_activities(lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_activities_qualifying 
  ON public.lead_activities(lead_id, is_qualifying_activity, created_at DESC);


-- 4. Lead Status History Table (Audit trail of every status transition)
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

CREATE INDEX IF NOT EXISTS idx_lead_status_hist_lead 
  ON public.lead_status_history(lead_id);


-- 5. Lead Follow-ups Table
CREATE TABLE IF NOT EXISTS public.lead_followups (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'COMPLETED', 'MISSED', 'RESCHEDULED'
  assigned_salesperson_id TEXT NOT NULL,
  assigned_salesperson_name TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  outcome_remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_followups_lead 
  ON public.lead_followups(lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_followups_scheduled 
  ON public.lead_followups(scheduled_at, status);


-- 6. Link Quotations to Leads without altering existing quotation structures
ALTER TABLE public.quotations 
  ADD COLUMN IF NOT EXISTS lead_id TEXT,
  ADD COLUMN IF NOT EXISTS revision_number INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_quote_number TEXT;

CREATE INDEX IF NOT EXISTS idx_quotations_lead_id 
  ON public.quotations(lead_id);


-- 7. Inactivity Incidents Table (Persistent, survives server restarts)
CREATE TABLE IF NOT EXISTS public.lead_inactivity_incidents (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  salesperson_id TEXT NOT NULL,
  salesperson_name TEXT NOT NULL,
  incident_type TEXT NOT NULL, -- '24_HOUR_UNATTENDED' | '48_HOUR_ESCALATION' | 'MISSED_FOLLOWUP'
  assigned_at TIMESTAMPTZ NOT NULL,
  alerted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id TEXT,
  resolution_type TEXT, -- 'CUSTOMER_CONTACTED' | 'REASSIGNED' | 'DISMISSED'
  details JSONB
);

-- Idempotency constraint: A lead can only have one active alert per incident type for a specific assignment
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_inactivity_unique_incident 
  ON public.lead_inactivity_incidents(lead_id, incident_type, salesperson_id, assigned_at);


-- 8. Lead Notifications & Recipient Tracking (Independent read/unread per recipient)
CREATE TABLE IF NOT EXISTS public.lead_notifications (
  id TEXT PRIMARY KEY,
  lead_id TEXT REFERENCES public.leads(id) ON DELETE SET NULL,
  incident_id TEXT REFERENCES public.lead_inactivity_incidents(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- 'NEW_LEAD' | 'INDIAMART_ENQUIRY' | 'ASSIGNMENT' | 'UNATTENDED_24H' | 'ESCALATION_48H' | 'MISSED_FOLLOWUP'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lead_notification_recipients (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES public.lead_notifications(id) ON DELETE CASCADE,
  recipient_user_id TEXT NOT NULL, -- e.g. 'CEO-001', 'TS-001'
  recipient_role TEXT NOT NULL, -- 'CEO' | 'Tech Support' | 'Sales Head'
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent recipient index: ensures one recipient record per notification
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_recipient_unique 
  ON public.lead_notification_recipients(notification_id, recipient_user_id);

CREATE INDEX IF NOT EXISTS idx_notif_recipient_status 
  ON public.lead_notification_recipients(recipient_user_id, read, created_at DESC);


-- 9. IndiaMART Configuration (Encrypted Credentials) & Sync Logs
CREATE TABLE IF NOT EXISTS public.indiamart_configurations (
  id TEXT PRIMARY KEY DEFAULT 'primary',
  glusr_mobile_num TEXT,
  encrypted_key TEXT, -- AES-256-GCM encrypted ciphertext
  key_iv TEXT,        -- Initialization Vector
  key_auth_tag TEXT,  -- GCM Authentication Tag
  key_masked TEXT,    -- Safe display (e.g. '****abcd')
  is_active BOOLEAN DEFAULT false,
  auto_sync_enabled BOOLEAN DEFAULT true,
  sync_interval_minutes INT DEFAULT 15,
  last_sync_at TIMESTAMPTZ,
  status TEXT DEFAULT 'DISCONNECTED', -- 'CONNECTED', 'DISCONNECTED', 'ERROR'
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.indiamart_sync_logs (
  id TEXT PRIMARY KEY,
  sync_type TEXT NOT NULL, -- 'MANUAL' | 'SCHEDULED' | 'TEST'
  records_fetched INT DEFAULT 0,
  records_imported INT DEFAULT 0,
  duplicates_skipped INT DEFAULT 0,
  status TEXT NOT NULL, -- 'SUCCESS' | 'FAILED'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_indiamart_sync_logs_created 
  ON public.indiamart_sync_logs(created_at DESC);
