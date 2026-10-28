-- ==============================================================================
-- BUSINZ CRM — MIGRATION ROLLBACK: 20261028_lead_notification_recipient_unique_constraint_rollback.sql
-- Target Database: PostgreSQL (public.lead_notification_recipients)
-- Purpose:
--   Safely drop unique index idx_notif_recipient_unique concurrently
-- ==============================================================================

DROP INDEX CONCURRENTLY IF EXISTS public.idx_notif_recipient_unique;
