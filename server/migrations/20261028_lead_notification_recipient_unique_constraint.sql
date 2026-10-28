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
-- STEP 1: PRE-CHECK TARGET INDEX METADATA (FAIL CLOSED ON UNRELATED INDEX OR MISMATCH)
-- Inspect target index table, columns, uniqueness, and validity. Never drop an unrelated index.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_tbl TEXT;
  v_cols TEXT[];
  v_is_valid BOOLEAN;
  v_is_unique BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'idx_notif_recipient_unique'
  ) THEN
    SELECT 
      t.relname,
      ARRAY_AGG(a.attname ORDER BY array_position(i.indkey, a.attnum)),
      i.indisvalid,
      i.indisunique
    INTO v_tbl, v_cols, v_is_valid, v_is_unique
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_index i ON i.indexrelid = c.oid
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
    WHERE n.nspname = 'public' AND c.relname = 'idx_notif_recipient_unique'
    GROUP BY t.relname, i.indisvalid, i.indisunique;

    -- Fail-closed guard: NEVER drop or overwrite an unrelated index!
    IF v_tbl <> 'lead_notification_recipients' THEN
      RAISE EXCEPTION '[INDEX-METADATA-MISMATCH] Existing index idx_notif_recipient_unique belongs to unrelated table "%", expected "lead_notification_recipients"! Never drop an unrelated index.', v_tbl;
    END IF;

    IF v_cols <> ARRAY['notification_id', 'recipient_user_id'] THEN
      RAISE EXCEPTION '[INDEX-METADATA-MISMATCH] Existing index idx_notif_recipient_unique is defined on columns %, expected [notification_id, recipient_user_id]! Failing closed.', v_cols;
    END IF;

    IF v_is_valid IS TRUE AND v_is_unique IS TRUE THEN
      RAISE NOTICE '[INDEX-STATUS] Existing index idx_notif_recipient_unique is already VALID and UNIQUE on public.lead_notification_recipients(notification_id, recipient_user_id).';
    ELSIF v_is_valid IS FALSE THEN
      RAISE NOTICE '[INDEX-STATUS] Found invalid matching index idx_notif_recipient_unique (indisvalid = false). Guarded concurrent drop will execute outside transaction.';
    END IF;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- STEP 2: SEPARATELY GUARDED CONCURRENT DROP OF INVALID MATCHING INDEX
-- Drops the index CONCURRENTLY outside any transaction ONLY if it is invalid and matches
-- table public.lead_notification_recipients on columns (notification_id, recipient_user_id).
-- ------------------------------------------------------------------------------
SELECT 'DROP INDEX CONCURRENTLY IF EXISTS public.idx_notif_recipient_unique;'
WHERE EXISTS (
  SELECT 1 FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_index i ON i.indexrelid = c.oid
  JOIN pg_class t ON t.oid = i.indrelid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
  WHERE n.nspname = 'public'
    AND c.relname = 'idx_notif_recipient_unique'
    AND t.relname = 'lead_notification_recipients'
    AND i.indisvalid IS FALSE
  GROUP BY t.relname, i.indisvalid
  HAVING ARRAY_AGG(a.attname ORDER BY array_position(i.indkey, a.attnum)) = ARRAY['notification_id', 'recipient_user_id']
) \gexec

-- ------------------------------------------------------------------------------
-- STEP 3: ENSURE BASE TABLE EXISTS
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
-- STEP 4: CONCURRENT UNIQUE INDEX CREATION
-- Build index concurrently outside of any transaction block.
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_notif_recipient_unique 
  ON public.lead_notification_recipients(notification_id, recipient_user_id);

-- ------------------------------------------------------------------------------
-- STEP 5: POST-CREATION VERIFICATION & FAIL-CLOSED METADATA VALIDATION
-- Confirm the index is present, valid (indisvalid = true), unique (indisunique = true),
-- and defined on the exact intended table and columns. Fail closed on metadata mismatches.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_tbl TEXT;
  v_cols TEXT[];
  v_valid BOOLEAN;
  v_unique BOOLEAN;
BEGIN
  SELECT 
    t.relname,
    ARRAY_AGG(a.attname ORDER BY array_position(i.indkey, a.attnum)),
    i.indisvalid,
    i.indisunique
  INTO v_tbl, v_cols, v_valid, v_unique
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_index i ON i.indexrelid = c.oid
  JOIN pg_class t ON t.oid = i.indrelid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
  WHERE n.nspname = 'public' AND c.relname = 'idx_notif_recipient_unique'
  GROUP BY t.relname, i.indisvalid, i.indisunique;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[POST-CHECK-FAIL-CLOSED] Unique index idx_notif_recipient_unique was not created or not found!';
  END IF;

  IF v_tbl <> 'lead_notification_recipients' THEN
    RAISE EXCEPTION '[POST-CHECK-FAIL-CLOSED] Index idx_notif_recipient_unique was created on wrong table "%" (expected lead_notification_recipients)!', v_tbl;
  END IF;

  IF v_cols <> ARRAY['notification_id', 'recipient_user_id'] THEN
    RAISE EXCEPTION '[POST-CHECK-FAIL-CLOSED] Index idx_notif_recipient_unique columns mismatch: found %, expected [notification_id, recipient_user_id]!', v_cols;
  END IF;

  IF NOT v_valid THEN
    RAISE EXCEPTION '[POST-CHECK-FAIL-CLOSED] Index idx_notif_recipient_unique is INVALID (indisvalid = false)!';
  END IF;

  IF NOT v_unique THEN
    RAISE EXCEPTION '[POST-CHECK-FAIL-CLOSED] Index idx_notif_recipient_unique is NOT UNIQUE (indisunique = false)!';
  END IF;

  RAISE NOTICE '[POST-CHECK-SUCCESS] idx_notif_recipient_unique is confirmed VALID, UNIQUE, and defined on public.lead_notification_recipients(notification_id, recipient_user_id).';
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
-- STEP 6: DOCUMENT INDEX METADATA
-- ------------------------------------------------------------------------------
COMMENT ON INDEX public.idx_notif_recipient_unique IS 
  'Enforces deduplication for lead notification recipients: exactly one recipient per notification and recipient_user_id.';

