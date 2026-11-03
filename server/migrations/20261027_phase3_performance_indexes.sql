-- ==============================================================================
-- BUSINZ Phase 3: PostgreSQL Database Performance Optimization Indexes
-- Target: businz_dev (Development Only)
-- Purpose: Optimize ORDER BY created_at DESC scans on BOM orders and CRM leads
-- ==============================================================================

-- 1. Index on public.bom_orders for fast chronological sorting and pagination
CREATE INDEX IF NOT EXISTS idx_bom_orders_created_at ON public.bom_orders (created_at DESC);

-- 2. Index on public.leads for fast chronological sorting and pagination
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads (created_at DESC);
