-- ============================================================================
-- BUSINZ MIGRATION: PHASE 10 - RETIRE LEGACY ZOHO DATABASE COLUMNS & INDEXES
-- Purpose: Safely drop obsolete Zoho Books columns and indexes from database
-- Date: 2026-10-07
-- Target Tables: public.customers, public.proforma_invoices, public.invoices
-- ============================================================================

BEGIN;

-- 1. Drop obsolete index on public.customers
DROP INDEX IF EXISTS public.idx_customers_zoho;

-- 2. Drop obsolete Zoho column from public.customers
ALTER TABLE public.customers
  DROP COLUMN IF EXISTS zoho_contact_id;

-- 3. Drop obsolete Zoho columns from public.proforma_invoices
ALTER TABLE public.proforma_invoices
  DROP COLUMN IF EXISTS zoho_synced,
  DROP COLUMN IF EXISTS zoho_estimate_id;

-- 4. Drop obsolete Zoho columns from public.invoices
ALTER TABLE public.invoices
  DROP COLUMN IF EXISTS zoho_id,
  DROP COLUMN IF EXISTS synced_to_zoho;

COMMIT;
