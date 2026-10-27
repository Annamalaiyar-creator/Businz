-- ==============================================================================
-- BUSINZ Phase 3: Rollback for Performance Indexes
-- Target: businz_dev (Development Only)
-- ==============================================================================

DROP INDEX IF EXISTS idx_bom_orders_created_at;
DROP INDEX IF EXISTS idx_leads_created_at;
