-- ==============================================================================
-- BUSINZ CRM — MIGRATION: 20261028_lead_notification_recipient_unique_constraint.sql
-- Target Database: PostgreSQL (public.lead_notification_recipients)
-- Purpose:
--   Create unique index on (notification_id, recipient_user_id)
--   to satisfy the idempotency constraint required by:
--   ON CONFLICT (notification_id, recipient_user_id) DO NOTHING
-- Safety:
--   - Uses CONCURRENT index build strategy: does NOT lock table writes
--   - Includes duplicate audit pre-check: fails safely if duplicates exist
--   - Does NOT automatically delete records
--   - Safe execution ordering: Execute migration in PostgreSQL -> Deploy code -> Reload PM2
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 0: PRE-FLIGHT AUDIT — CHECK FOR DUPLICATE PAIRS
-- If any rows are returned, STOP and reconcile before creating unique index.
-- Do NOT automatically delete records.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'lead_notification_recipients'
  ) THEN
    SELECT COUNT(*) INTO duplicate_count FROM (
      SELECT notification_id, recipient_user_id
      FROM public.lead_notification_recipients
      GROUP BY notification_id, recipient_user_id
      HAVING COUNT(*) > 1
    ) sub;

    IF duplicate_count > 0 THEN
      RAISE EXCEPTION '[PRE-FLIGHT-FAIL-SAFE] Found % duplicate (notification_id, recipient_user_id) pairs in public.lead_notification_recipients. Migration aborted without modifying data.', duplicate_count;
    END IF;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- STEP 1: AUDIT & CLEAN UP PRIOR FAILED CONCURRENT BUILDS (indisvalid = false)
-- If a prior CREATE INDEX CONCURRENTLY failed or was cancelled, PostgreSQL leaves
-- an invalid index (indisvalid = false). Drop it before re-creating.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_is_valid BOOLEAN;
BEGIN
  SELECT i.indisvalid INTO v_is_valid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_index i ON i.indexrelid = c.oid
  WHERE n.nspname = 'public' AND c.relname = 'idx_notif_recipient_unique';

  IF FOUND AND v_is_valid IS FALSE THEN
    RAISE NOTICE 'Found invalid index idx_notif_recipient_unique from a previous failed run. Dropping invalid index.';
    EXECUTE 'DROP INDEX IF EXISTS public.idx_notif_recipient_unique';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- STEP 2: ENSURE BASE TABLE EXISTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_notification_recipients (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES public.lead_notifications(id) ON DELETE CASCADE,
  recipient_user_id TEXT NOT NULL,
  recipient_role TEXT,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- STEP 3: CONCURRENT UNIQUE INDEX CREATION
-- Build index concurrently so active operations on lead_notification_recipients
-- are never blocked. Must be run outside of a BEGIN ... COMMIT block.
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_notif_recipient_unique 
  ON public.lead_notification_recipients(notification_id, recipient_user_id);

-- ------------------------------------------------------------------------------
-- STEP 4: POST-CREATION VERIFICATION & FAIL-SAFE ASSERTION
-- Confirm the index is present, unique (indisunique = true), and marked VALID (indisvalid = true).
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_valid BOOLEAN;
  v_unique BOOLEAN;
BEGIN
  SELECT i.indisvalid, i.indisunique INTO v_valid, v_unique
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_index i ON i.indexrelid = c.oid
  WHERE n.nspname = 'public' AND c.relname = 'idx_notif_recipient_unique';

  IF NOT FOUND THEN
    RAISE EXCEPTION '[POST-CHECK-FAIL] Unique index idx_notif_recipient_unique was not created or not found!';
  END IF;

  IF NOT v_valid THEN
    RAISE EXCEPTION '[POST-CHECK-FAIL] Index idx_notif_recipient_unique is INVALID (indisvalid = false)!';
  END IF;

  IF NOT v_unique THEN
    RAISE EXCEPTION '[POST-CHECK-FAIL] Index idx_notif_recipient_unique is NOT UNIQUE (indisunique = false)!';
  END IF;

  RAISE NOTICE '[VERIFICATION-SUCCESS] idx_notif_recipient_unique is confirmed VALID and UNIQUE.';
END $$;

SELECT 
  c.relname AS index_name, 
  i.indisvalid AS is_valid, 
  i.indisunique AS is_unique
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_index i ON i.indexrelid = c.oid
WHERE n.nspname = 'public' AND c.relname = 'idx_notif_recipient_unique';

-- ------------------------------------------------------------------------------
-- STEP 5: DOCUMENT INDEX METADATA
-- ------------------------------------------------------------------------------
COMMENT ON INDEX public.idx_notif_recipient_unique IS 
  'Enforces deduplication for lead notification recipients: exactly one recipient per notification and recipient_user_id.';

