-- ============================================================================
-- BUSINZ ROLLBACK: PHASE 10 - RESTORE LEGACY ZOHO DATABASE COLUMNS & INDEXES
-- Purpose: Restores columns and indexes if unexpected legacy rollback is required
-- Date: 2026-10-07
-- Target Tables: public.customers, public.proforma_invoices, public.invoices
-- ============================================================================

BEGIN;

-- 1. Restore columns on public.customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS zoho_contact_id TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_zoho ON public.customers(zoho_contact_id);

-- 2. Restore columns on public.proforma_invoices
ALTER TABLE public.proforma_invoices
  ADD COLUMN IF NOT EXISTS zoho_synced BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS zoho_estimate_id TEXT;

-- 3. Restore columns on public.invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS zoho_id TEXT,
  ADD COLUMN IF NOT EXISTS synced_to_zoho BOOLEAN DEFAULT false;

COMMIT;
