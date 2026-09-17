-- ==============================================================================
-- BUSINZ ERP: Complete Supabase Database Setup Script
-- Project: ognmvcpzlebrvdynunwh
-- Run this in your Supabase Dashboard: SQL Editor -> "New query" -> Paste & "Run"
-- ==============================================================================

-- 1. Universal Data Store Table (Used by BUSINZ backend & frontend sync engine)
CREATE TABLE IF NOT EXISTS public.leaves (
  id BIGSERIAL PRIMARY KEY,
  employee TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'active',
  dates TIMESTAMPTZ DEFAULT NOW(),
  duration TEXT DEFAULT '1',
  type TEXT DEFAULT 'Store'
);

CREATE INDEX IF NOT EXISTS idx_leaves_employee ON public.leaves(employee);

-- Enable RLS and grant full read/write to anon and authenticated users
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to leaves" ON public.leaves;
CREATE POLICY "Allow full access to leaves" 
  ON public.leaves 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 2. Employees & Users Authentication Table
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  password TEXT DEFAULT '123456',
  role TEXT DEFAULT 'Sales Executive',
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to users" ON public.users;
CREATE POLICY "Allow full access to users" 
  ON public.users 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 3. Dedicated Central Document Store
CREATE TABLE IF NOT EXISTS public.controlroom_store (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  record_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT DEFAULT 'system'
);

ALTER TABLE public.controlroom_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to controlroom_store" ON public.controlroom_store;
CREATE POLICY "Allow full access to controlroom_store" 
  ON public.controlroom_store 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 4. Dedicated Purchase Orders Table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id TEXT PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,
  vendor_name TEXT NOT NULL,
  vendor_id TEXT,
  order_date DATE DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  total_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Draft',
  status_type TEXT DEFAULT 'draft',
  approved_by TEXT,
  line_items JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_number ON public.purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_po_vendor ON public.purchase_orders(vendor_name);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to purchase_orders" ON public.purchase_orders;
CREATE POLICY "Allow full access to purchase_orders" 
  ON public.purchase_orders 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 5. Dedicated BOM Orders Table
CREATE TABLE IF NOT EXISTS public.bom_orders (
  id TEXT PRIMARY KEY,
  bom_code TEXT UNIQUE NOT NULL,
  source_pi_no TEXT,
  customer_name TEXT NOT NULL,
  customer_code TEXT,
  sales_person TEXT,
  total_panels INTEGER DEFAULT 0,
  total_kw NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Draft',
  delivery_date DATE,
  items JSONB DEFAULT '[]'::jsonb,
  payments JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bom_code ON public.bom_orders(bom_code);
ALTER TABLE public.bom_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to bom_orders" ON public.bom_orders;
CREATE POLICY "Allow full access to bom_orders" 
  ON public.bom_orders 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 6. Insert Default Initial Admin and Floor Users
INSERT INTO public.users (name, email, password, role, department)
VALUES 
  ('Admin Control', 'admin@businz.com', 'admin123', 'Admin', 'ADM-VRM001:::Admin:::Active'),
  ('Mani', 'maniskremo@gmail.com', '123456', 'Production Admin', 'PR-VRM002:::Production Admin:::Active')
ON CONFLICT (email) DO UPDATE SET 
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  department = EXCLUDED.department;

-- Output confirmation message
SELECT 'BUSINZ ERP Tables created and configured successfully!' as status;
