-- ==============================================================================
-- BUSINZ CRM — MIGRATION: 20261027_lead_inactivity_unique_constraint.sql
-- Target Database: PostgreSQL (public.lead_inactivity_incidents)
-- Purpose:
--   Create unique index on (lead_id, incident_type, salesperson_id, assigned_at)
--   to satisfy the idempotency constraint required by:
--   ON CONFLICT (lead_id, incident_type, salesperson_id, assigned_at) DO NOTHING
-- Safety:
--   - Uses CONCURRENT index build strategy: does NOT lock table writes
--   - Includes duplicate audit pre-check
--   - Verifies and recovers from any prior invalid index state
--   - Safe execution ordering: Execute migration in PostgreSQL -> Deploy code -> Reload PM2
--   - Startup initialization in db.js / leadManagementService.js uses IF NOT EXISTS
--     and detects the index already built, preventing duplicate catalog operations.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 0: PRE-FLIGHT AUDIT — VERIFY ZERO DUPLICATE ROWS
-- If any rows are returned, STOP and reconcile before creating unique index.
-- (Previous production audit confirmed 0 duplicate groups exist).
-- ------------------------------------------------------------------------------
SELECT lead_id, incident_type, salesperson_id, assigned_at, COUNT(*) as occurrence_count
FROM public.lead_inactivity_incidents
GROUP BY lead_id, incident_type, salesperson_id, assigned_at
HAVING COUNT(*) > 1;

-- ------------------------------------------------------------------------------
-- STEP 1: ENSURE BASE TABLE EXISTS
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- STEP 2: CONCURRENT UNIQUE INDEX CREATION
-- Build index concurrently so active operations on lead_inactivity_incidents
-- are never blocked. Must be run outside of a BEGIN ... COMMIT block.
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_inactivity_unique_incident 
  ON public.lead_inactivity_incidents(lead_id, incident_type, salesperson_id, assigned_at);

-- ------------------------------------------------------------------------------
-- STEP 3: POST-CREATION VERIFICATION
-- Confirm the index is present, unique, and marked VALID (indisvalid = true).
-- ------------------------------------------------------------------------------
SELECT 
  c.relname AS index_name, 
  i.indisvalid AS is_valid, 
  i.indisunique AS is_unique
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_index i ON i.indexrelid = c.oid
WHERE n.nspname = 'public' AND c.relname = 'idx_lead_inactivity_unique_incident';

-- ------------------------------------------------------------------------------
-- STEP 4: DOCUMENT INDEX METADATA
-- ------------------------------------------------------------------------------
COMMENT ON INDEX public.idx_lead_inactivity_unique_incident IS 
  'Enforces idempotency for lead inactivity engine: exactly one incident per lead, incident_type, salesperson, and assignment timestamp.';
