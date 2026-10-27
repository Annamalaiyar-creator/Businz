-- ==============================================================================
-- BUSINZ CRM — ROLLBACK: 20261027_lead_inactivity_unique_constraint_rollback.sql
-- Target Database: PostgreSQL (public.lead_inactivity_incidents)
-- Purpose:
--   Safely drop unique index idx_lead_inactivity_unique_incident
-- Safety:
--   - Does NOT drop table or remove incident rows
-- ==============================================================================

DROP INDEX IF EXISTS public.idx_lead_inactivity_unique_incident;
