-- ==============================================================================
-- BUSINZ Track System Rollback Migration
-- Migration: 20261124_businz_track_system_rollback.sql
-- ==============================================================================

BEGIN;

DROP TABLE IF EXISTS public.tracking_notification_queue CASCADE;
DROP TABLE IF EXISTS public.order_tracking_issues CASCADE;
DROP TABLE IF EXISTS public.order_tracking_shipments CASCADE;
DROP TABLE IF EXISTS public.order_tracking_events CASCADE;
DROP TABLE IF EXISTS public.order_tracking CASCADE;
DROP TABLE IF EXISTS public.company_tracking_settings CASCADE;

COMMIT;
