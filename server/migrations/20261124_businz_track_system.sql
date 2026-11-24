-- ==============================================================================
-- BUSINZ Track – Live Customer Order & Dispatch Tracking System Migration
-- Migration: 20261124_businz_track_system.sql
-- ==============================================================================

BEGIN;

-- 1. Company Tracking Settings (Multi-tenant configuration)
CREATE TABLE IF NOT EXISTS public.company_tracking_settings (
  id TEXT PRIMARY KEY,
  company_name TEXT UNIQUE NOT NULL,
  is_enabled BOOLEAN DEFAULT true NOT NULL,
  logo_url TEXT,
  brand_color TEXT DEFAULT '#0E7490' NOT NULL,
  support_phone TEXT DEFAULT '+91 98765 43210',
  support_email TEXT DEFAULT 'support@businz.com',
  tracking_domain TEXT DEFAULT 'track.businz.com',
  show_packing_photos BOOLEAN DEFAULT true NOT NULL,
  show_loading_photos BOOLEAN DEFAULT true NOT NULL,
  show_driver_phone BOOLEAN DEFAULT true NOT NULL,
  show_pricing BOOLEAN DEFAULT false NOT NULL,
  require_otp_for_documents BOOLEAN DEFAULT false NOT NULL,
  auto_whatsapp_dispatch_received BOOLEAN DEFAULT true NOT NULL,
  auto_whatsapp_packing_completed BOOLEAN DEFAULT true NOT NULL,
  auto_whatsapp_dispatched BOOLEAN DEFAULT true NOT NULL,
  auto_whatsapp_delivered BOOLEAN DEFAULT true NOT NULL,
  token_expiry_days INTEGER DEFAULT 90 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Seed default company tracking settings
INSERT INTO public.company_tracking_settings (
  id, company_name, is_enabled, brand_color, support_phone, support_email
) VALUES (
  'SETTING-DEFAULT', 'VRM Structures India Private Limited', true, '#0E7490', '+91 98765 43210', 'support@vrmstructures.com'
) ON CONFLICT (company_name) DO NOTHING;

-- 2. Customer Tracking References & Cryptographic Tokens
CREATE TABLE IF NOT EXISTS public.order_tracking (
  id TEXT PRIMARY KEY,
  company_name TEXT DEFAULT 'VRM Structures India Private Limited' NOT NULL,
  bom_code TEXT UNIQUE NOT NULL,
  source_pi_no TEXT,
  tracking_token TEXT UNIQUE NOT NULL,
  token_hash TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_mobile TEXT NOT NULL,
  customer_email TEXT,
  status TEXT DEFAULT 'ACTIVE' NOT NULL, -- 'ACTIVE', 'REVOKED', 'EXPIRED'
  current_stage TEXT DEFAULT 'RECEIVED_BY_DISPATCH' NOT NULL,
  packing_percentage INTEGER DEFAULT 0 NOT NULL,
  access_count INTEGER DEFAULT 0 NOT NULL,
  last_accessed_at TIMESTAMPTZ,
  last_ip TEXT,
  last_user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_tracking_bom_code ON public.order_tracking (bom_code);
CREATE INDEX IF NOT EXISTS idx_order_tracking_token_hash ON public.order_tracking (token_hash);
CREATE INDEX IF NOT EXISTS idx_order_tracking_source_pi ON public.order_tracking (source_pi_no);
CREATE INDEX IF NOT EXISTS idx_order_tracking_mobile ON public.order_tracking (customer_mobile);
CREATE INDEX IF NOT EXISTS idx_order_tracking_status ON public.order_tracking (status);

-- 3. Order Tracking Workflow Events Log
CREATE TABLE IF NOT EXISTS public.order_tracking_events (
  id BIGSERIAL PRIMARY KEY,
  tracking_id TEXT NOT NULL REFERENCES public.order_tracking(id) ON DELETE CASCADE,
  bom_code TEXT NOT NULL,
  stage TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  actor_role TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_tracking_id ON public.order_tracking_events (tracking_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_bom_code ON public.order_tracking_events (bom_code);
CREATE INDEX IF NOT EXISTS idx_tracking_events_created_at ON public.order_tracking_events (created_at ASC);

-- 4. Order Tracking Shipments (Multi-shipment & partial dispatch support)
CREATE TABLE IF NOT EXISTS public.order_tracking_shipments (
  id TEXT PRIMARY KEY,
  tracking_id TEXT NOT NULL REFERENCES public.order_tracking(id) ON DELETE CASCADE,
  bom_code TEXT NOT NULL,
  shipment_number INTEGER DEFAULT 1 NOT NULL,
  shipment_reference TEXT NOT NULL,
  transporter_name TEXT,
  transport_mode TEXT DEFAULT 'ROAD',
  lr_no TEXT,
  lr_date DATE,
  lr_copy_url TEXT,
  vehicle_no TEXT,
  driver_name TEXT,
  driver_phone TEXT,
  packages_count INTEGER,
  bundles_count INTEGER,
  destination TEXT,
  status TEXT DEFAULT 'DISPATCHED' NOT NULL, -- 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'
  dispatched_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  delivered_at TIMESTAMPTZ,
  items JSONB DEFAULT '[]'::jsonb NOT NULL,
  photos JSONB DEFAULT '[]'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracking_shipments_tracking_id ON public.order_tracking_shipments (tracking_id);
CREATE INDEX IF NOT EXISTS idx_tracking_shipments_bom_code ON public.order_tracking_shipments (bom_code);

-- 5. Customer Delivery Confirmation & Issue Reports
CREATE TABLE IF NOT EXISTS public.order_tracking_issues (
  id TEXT PRIMARY KEY,
  tracking_id TEXT NOT NULL REFERENCES public.order_tracking(id) ON DELETE CASCADE,
  bom_code TEXT NOT NULL,
  issue_type TEXT NOT NULL, -- 'DELIVERY_CONFIRMED', 'MISSING_PRODUCTS', 'DAMAGED_PRODUCTS', 'INCORRECT_ITEMS', 'OTHER'
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  affected_items JSONB DEFAULT '[]'::jsonb NOT NULL,
  remarks TEXT,
  photos JSONB DEFAULT '[]'::jsonb NOT NULL,
  status TEXT DEFAULT 'OPEN' NOT NULL, -- 'OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED'
  resolution_notes TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracking_issues_tracking_id ON public.order_tracking_issues (tracking_id);
CREATE INDEX IF NOT EXISTS idx_tracking_issues_bom_code ON public.order_tracking_issues (bom_code);
CREATE INDEX IF NOT EXISTS idx_tracking_issues_status ON public.order_tracking_issues (status);

-- 6. WhatsApp Tracking Notification Queue & Audit History
CREATE TABLE IF NOT EXISTS public.tracking_notification_queue (
  id TEXT PRIMARY KEY,
  tracking_id TEXT REFERENCES public.order_tracking(id) ON DELETE SET NULL,
  bom_code TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  channel TEXT DEFAULT 'META_CLOUD_API' NOT NULL,
  template_name TEXT NOT NULL,
  template_variables JSONB DEFAULT '[]'::jsonb NOT NULL,
  tracking_url TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING' NOT NULL, -- 'PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED'
  retry_count INTEGER DEFAULT 0 NOT NULL,
  max_retries INTEGER DEFAULT 3 NOT NULL,
  error_message TEXT,
  meta_message_id TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracking_notif_bom_code ON public.tracking_notification_queue (bom_code);
CREATE INDEX IF NOT EXISTS idx_tracking_notif_status ON public.tracking_notification_queue (status);
CREATE INDEX IF NOT EXISTS idx_tracking_notif_created_at ON public.tracking_notification_queue (created_at DESC);

COMMIT;
