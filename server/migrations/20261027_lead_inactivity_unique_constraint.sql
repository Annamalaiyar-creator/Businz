-- ==============================================================================
-- BUSINZ CRM — MIGRATION: 20261027_lead_inactivity_unique_constraint.sql
-- Target Database: PostgreSQL (public.lead_inactivity_incidents)
-- Purpose:
--   Create unique index on (lead_id, incident_type, salesperson_id, assigned_at)
--   to satisfy the idempotency constraint required by:
--   ON CONFLICT (lead_id, incident_type, salesperson_id, assigned_at) DO NOTHING
-- Safety:
--   - Uses IF NOT EXISTS to prevent re-execution errors
--   - Read-only audit confirmed 0 duplicate groups exist in production
--   - Does NOT delete or overwrite any incident records
-- ==============================================================================

-- 1. Ensure table exists with correct schema
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

-- 2. Create unique index to satisfy ON CONFLICT specification
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_inactivity_unique_incident 
  ON public.lead_inactivity_incidents(lead_id, incident_type, salesperson_id, assigned_at);

-- 3. Document index metadata
COMMENT ON INDEX public.idx_lead_inactivity_unique_incident IS 
  'Enforces idempotency for lead inactivity engine: exactly one incident per lead, incident_type, salesperson, and assignment timestamp.';
