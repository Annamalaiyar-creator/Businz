-- ===================================================================================
-- BUSINZ ERP — DATABASE MIGRATION: 20261029_remove_entire_notification_system.sql
-- Application: BUSINZ
-- Target Database: PostgreSQL
-- Purpose: Safely drop lead notification tables and remove notifications store key.
-- ===================================================================================

BEGIN;

-- 1. Drop lead notification recipients child table
DROP TABLE IF EXISTS public.lead_notification_recipients CASCADE;

-- 2. Drop lead notifications parent table
DROP TABLE IF EXISTS public.lead_notifications CASCADE;

-- 3. Remove key-value store row for notifications_store if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'controlroom_store') THEN
    DELETE FROM public.controlroom_store WHERE key = 'notifications_store';
  END IF;
END $$;

COMMIT;

