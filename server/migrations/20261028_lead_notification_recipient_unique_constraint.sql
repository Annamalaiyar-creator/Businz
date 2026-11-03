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

\set ON_ERROR_STOP on

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
-- PostgreSQL 18.6 verified: uses pg_get_indexdef with generate_series(1, i.indnkeyatts).
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_tbl TEXT;
  v_cols TEXT[];
  v_is_valid BOOLEAN;
  v_is_unique BOOLEAN;
  v_natts INTEGER;
  v_nkeyatts INTEGER;
  v_has_expr BOOLEAN;
  v_has_pred BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'idx_notif_recipient_unique'
  ) THEN
    SELECT 
      t.relname,
      ARRAY(
        SELECT pg_get_indexdef(i.indexrelid, k, TRUE)
        FROM generate_series(1, i.indnkeyatts) AS k
        ORDER BY k
      ),
      i.indisvalid,
      i.indisunique,
      i.indnatts,
      i.indnkeyatts,
      (i.indexprs IS NOT NULL),
      (i.indpred IS NOT NULL)
    INTO v_tbl, v_cols, v_is_valid, v_is_unique, v_natts, v_nkeyatts, v_has_expr, v_has_pred
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_index i ON i.indexrelid = c.oid
    JOIN pg_class t ON t.oid = i.indrelid
    WHERE n.nspname = 'public' AND c.relname = 'idx_notif_recipient_unique';

    -- Fail-closed guard: NEVER drop or overwrite an unrelated index!
    IF v_tbl <> 'lead_notification_recipients' THEN
      RAISE EXCEPTION '[INDEX-METADATA-MISMATCH] Existing index idx_notif_recipient_unique belongs to unrelated table "%", expected "lead_notification_recipients"! Never drop an unrelated index.', v_tbl;
    END IF;

    -- Fail-closed guard: Must have exactly 2 key columns and 0 included columns (no unexpected included columns)
    IF v_natts <> 2 OR v_nkeyatts <> 2 THEN
      RAISE EXCEPTION '[INDEX-METADATA-MISMATCH] Existing index idx_notif_recipient_unique has % total attributes and % key attributes (expected exactly 2 key columns, no included columns)! Failing closed.', v_natts, v_nkeyatts;
    END IF;

    -- Fail-closed guard: Must not be an expression index
    IF v_has_expr THEN
      RAISE EXCEPTION '[INDEX-METADATA-MISMATCH] Existing index idx_notif_recipient_unique contains unexpected expressions (indexprs IS NOT NULL)! Failing closed.';
    END IF;

    -- Fail-closed guard: Must not be a partial index
    IF v_has_pred THEN
      RAISE EXCEPTION '[INDEX-METADATA-MISMATCH] Existing index idx_notif_recipient_unique has an unexpected partial predicate (indpred IS NOT NULL)! Failing closed.';
    END IF;

    -- Fail-closed guard: Key columns must match expected target in required order
    IF v_cols <> ARRAY['notification_id', 'recipient_user_id'] THEN
      RAISE EXCEPTION '[INDEX-METADATA-MISMATCH] Existing index idx_notif_recipient_unique key columns are %, expected [notification_id, recipient_user_id] in that exact order! Failing closed.', v_cols;
    END IF;

    IF v_is_valid IS TRUE AND v_is_unique IS TRUE THEN
      RAISE NOTICE '[INDEX-STATUS] Existing index idx_notif_recipient_unique is already VALID and UNIQUE on public.lead_notification_recipients(notification_id, recipient_user_id).';
    ELSIF v_is_valid IS FALSE THEN
      RAISE NOTICE '[INDEX-STATUS] Found invalid matching index idx_notif_recipient_unique (indisvalid = false). Guarded concurrent drop will execute outside transaction.';
    ELSE
      RAISE EXCEPTION '[INDEX-METADATA-MISMATCH] Existing index idx_notif_recipient_unique is NOT unique (indisunique = false)! Failing closed.';
    END IF;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- STEP 2: SEPARATELY GUARDED CONCURRENT DROP OF INVALID MATCHING INDEX
-- Drops the index CONCURRENTLY outside any transaction ONLY if it is invalid and matches
-- table public.lead_notification_recipients on columns (notification_id, recipient_user_id)
-- with exactly 2 key columns, no expressions, and no partial predicate.
-- PostgreSQL 18.6 verified: uses pg_get_indexdef with generate_series(1, i.indnkeyatts).
-- ------------------------------------------------------------------------------
SELECT 'DROP INDEX CONCURRENTLY IF EXISTS public.idx_notif_recipient_unique;'
WHERE EXISTS (
  SELECT 1 FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_index i ON i.indexrelid = c.oid
  JOIN pg_class t ON t.oid = i.indrelid
  WHERE n.nspname = 'public'
    AND c.relname = 'idx_notif_recipient_unique'
    AND t.relname = 'lead_notification_recipients'
    AND i.indisvalid IS FALSE
    AND i.indnatts = 2
    AND i.indnkeyatts = 2
    AND i.indexprs IS NULL
    AND i.indpred IS NULL
    AND ARRAY(
      SELECT pg_get_indexdef(i.indexrelid, k, TRUE)
      FROM generate_series(1, i.indnkeyatts) AS k
      ORDER BY k
    ) = ARRAY['notification_id', 'recipient_user_id']
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
-- exactly two key columns in required order, no expressions, no partial predicates.
-- PostgreSQL 18.6 verified: uses pg_get_indexdef with generate_series(1, i.indnkeyatts).
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_tbl TEXT;
  v_cols TEXT[];
  v_valid BOOLEAN;
  v_unique BOOLEAN;
  v_natts INTEGER;
  v_nkeyatts INTEGER;
  v_has_expr BOOLEAN;
  v_has_pred BOOLEAN;
BEGIN
  SELECT 
    t.relname,
    ARRAY(
      SELECT pg_get_indexdef(i.indexrelid, k, TRUE)
      FROM generate_series(1, i.indnkeyatts) AS k
      ORDER BY k
    ),
    i.indisvalid,
    i.indisunique,
    i.indnatts,
    i.indnkeyatts,
    (i.indexprs IS NOT NULL),
    (i.indpred IS NOT NULL)
  INTO v_tbl, v_cols, v_valid, v_unique, v_natts, v_nkeyatts, v_has_expr, v_has_pred
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_index i ON i.indexrelid = c.oid
  JOIN pg_class t ON t.oid = i.indrelid
  WHERE n.nspname = 'public' AND c.relname = 'idx_notif_recipient_unique';

  IF NOT FOUND THEN
    RAISE EXCEPTION '[POST-CHECK-FAIL-CLOSED] Unique index idx_notif_recipient_unique was not created or not found!';
  END IF;

  IF v_tbl <> 'lead_notification_recipients' THEN
    RAISE EXCEPTION '[POST-CHECK-FAIL-CLOSED] Index idx_notif_recipient_unique was created on wrong table "%" (expected lead_notification_recipients)!', v_tbl;
  END IF;

  IF v_natts <> 2 OR v_nkeyatts <> 2 THEN
    RAISE EXCEPTION '[POST-CHECK-FAIL-CLOSED] Index idx_notif_recipient_unique has % total attributes and % key attributes (expected exactly 2 key columns, no included columns)!', v_natts, v_nkeyatts;
  END IF;

  IF v_has_expr THEN
    RAISE EXCEPTION '[POST-CHECK-FAIL-CLOSED] Index idx_notif_recipient_unique contains unexpected expressions (indexprs IS NOT NULL)!';
  END IF;

  IF v_has_pred THEN
    RAISE EXCEPTION '[POST-CHECK-FAIL-CLOSED] Index idx_notif_recipient_unique has an unexpected partial predicate (indpred IS NOT NULL)!';
  END IF;

  IF v_cols <> ARRAY['notification_id', 'recipient_user_id'] THEN
    RAISE EXCEPTION '[POST-CHECK-FAIL-CLOSED] Index idx_notif_recipient_unique columns mismatch: found %, expected [notification_id, recipient_user_id] in that exact order!', v_cols;
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

