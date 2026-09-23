-- ==============================================================================
-- BUSINZ ERP: Complete Development & Testing Database Schema Setup
-- Target Environment: MAIN / PRODUCTION Supabase Project (Strictly Isolated)
-- Guarantee: Zero business data rows, zero employee credentials, pure schema structure.
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. UNIVERSAL STORES & AUTHENTICATION
-- ==============================================================================

-- 1.1 Universal Data Store (Used by backend fallback & sync engine)
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
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to leaves" ON public.leaves;
CREATE POLICY "Allow full access to leaves" ON public.leaves FOR ALL USING (true) WITH CHECK (true);

-- 1.2 Employees & Users Authentication Table (Schema only - zero seed data)
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  password TEXT DEFAULT '123456',
  role TEXT DEFAULT 'Sales Executive',
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to users" ON public.users;
CREATE POLICY "Allow full access to users" ON public.users FOR ALL USING (true) WITH CHECK (true);

-- 1.3 Central Document Store (KV Store)
CREATE TABLE IF NOT EXISTS public.controlroom_store (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.controlroom_store ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to controlroom_store" ON public.controlroom_store;
CREATE POLICY "Allow full access to controlroom_store" ON public.controlroom_store FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 2. COMPANY SETTINGS & BRANDING
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.company_branding (
  id INTEGER PRIMARY KEY DEFAULT 1,
  logo_url TEXT,
  logo_height INTEGER DEFAULT 45,
  show_logo BOOLEAN DEFAULT true,
  stamp_mode TEXT DEFAULT 'auto',
  custom_stamp_url TEXT,
  stamp_size INTEGER DEFAULT 80,
  show_signatory_stamp BOOLEAN DEFAULT true,
  stamp_text TEXT DEFAULT 'For VRM STRUCTURES INDIA PRIVATE LIMITED',
  company_name TEXT DEFAULT 'VRM STRUCTURES INDIA PRIVATE LIMITED',
  cin TEXT,
  gstin TEXT,
  pan TEXT,
  registered_address TEXT,
  support_email TEXT,
  support_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.company_branding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to company_branding" ON public.company_branding;
CREATE POLICY "Allow full access to company_branding" ON public.company_branding FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 3. VENDORS & SUPPLIERS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.vendors (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  company_name TEXT,
  type TEXT DEFAULT 'Supplier',
  contact TEXT,
  phone TEXT,
  mobile TEXT,
  email TEXT,
  cat TEXT,
  status TEXT DEFAULT 'Active',
  spend TEXT DEFAULT '₹0.00',
  payable TEXT DEFAULT '₹0.00',
  terms TEXT DEFAULT 'Net 30',
  gstin TEXT,
  gst_treatment TEXT,
  source_of_supply TEXT,
  pan TEXT,
  currency TEXT DEFAULT 'INR',
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_name ON public.vendors(name);
CREATE INDEX IF NOT EXISTS idx_vendors_code ON public.vendors(code);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to vendors" ON public.vendors;
CREATE POLICY "Allow full access to vendors" ON public.vendors FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 4. CUSTOMERS & CRM CLIENTS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.customers (
  id TEXT PRIMARY KEY,
  customer_code TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  customer_name TEXT,
  customer_type TEXT DEFAULT 'Customer',
  industry TEXT,
  gst_number TEXT,
  pan_number TEXT,
  billing_address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  billing_address_obj JSONB DEFAULT '{}'::jsonb,
  dispatch_address TEXT,
  dispatch_city TEXT,
  dispatch_state TEXT,
  dispatch_pincode TEXT,
  delivery_address_obj JSONB DEFAULT '{}'::jsonb,
  same_as_billing BOOLEAN DEFAULT false,
  credit_limit NUMERIC DEFAULT 0,
  credit_days INTEGER DEFAULT 0,
  payment_terms TEXT DEFAULT 'Due on Receipt',
  assigned_salesperson TEXT,
  source TEXT DEFAULT 'Manual',
  zoho_contact_id TEXT,
  primary_contact JSONB DEFAULT '{}'::jsonb,
  email TEXT,
  phone TEXT,
  status TEXT DEFAULT 'Active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_code ON public.customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_company ON public.customers(company_name);
CREATE INDEX IF NOT EXISTS idx_customers_zoho ON public.customers(zoho_contact_id);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to customers" ON public.customers;
CREATE POLICY "Allow full access to customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 5. PURCHASE ORDERS (Full 30 Columns)
-- ==============================================================================

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
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  branch TEXT,
  contact_person TEXT,
  contact_no TEXT,
  email TEXT,
  gst_no TEXT,
  delivery_address TEXT,
  billing_address TEXT,
  payment_terms TEXT,
  purchaser TEXT,
  approval_remarks TEXT,
  approval_date TEXT,
  approval_time TEXT,
  payment_details JSONB DEFAULT '{}'::jsonb,
  proceed_details JSONB DEFAULT '{}'::jsonb,
  delivery_type TEXT,
  pdf_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_po_number ON public.purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_po_vendor ON public.purchase_orders(vendor_name);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to purchase_orders" ON public.purchase_orders;
CREATE POLICY "Allow full access to purchase_orders" ON public.purchase_orders FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 6. ITEMS & FINISHED PRODUCTS CATALOG (38 Columns)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.items (
  code TEXT PRIMARY KEY,
  sku TEXT,
  item_id TEXT,
  name TEXT NOT NULL,
  cat TEXT DEFAULT 'Finished Goods',
  category TEXT DEFAULT 'Finished Goods',
  unit TEXT DEFAULT 'NOS',
  uom TEXT DEFAULT 'NOS',
  price NUMERIC DEFAULT 0,
  rate NUMERIC DEFAULT 0,
  purchase_rate NUMERIC DEFAULT 0,
  gst_rate TEXT DEFAULT '18%',
  status TEXT DEFAULT 'Active',
  product_type TEXT,
  store TEXT DEFAULT 'Main Store',
  location TEXT,
  hsn TEXT,
  min_level NUMERIC DEFAULT 0,
  reorder_level NUMERIC DEFAULT 0,
  stock NUMERIC DEFAULT 0,
  physical_stock NUMERIC DEFAULT 0,
  available_stock NUMERIC DEFAULT 0,
  stock_on_hand NUMERIC DEFAULT 0,
  reserved NUMERIC DEFAULT 0,
  blocked_for_bom NUMERIC DEFAULT 0,
  parent_code TEXT,
  parent_name TEXT,
  length_mm NUMERIC,
  cut_length NUMERIC,
  opening_stock NUMERIC DEFAULT 0,
  goods_received NUMERIC DEFAULT 0,
  issued_prod NUMERIC DEFAULT 0,
  mat_return NUMERIC DEFAULT 0,
  stock_adj NUMERIC DEFAULT 0,
  description TEXT,
  material TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_category ON public.items(category);
CREATE INDEX IF NOT EXISTS idx_items_name ON public.items(name);

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to items" ON public.items;
CREATE POLICY "Allow full access to items" ON public.items FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 7. RAW MATERIALS INVENTORY (34 Columns)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.raw_materials (
  code TEXT PRIMARY KEY,
  sku TEXT,
  item_id TEXT,
  name TEXT NOT NULL,
  cat TEXT DEFAULT 'Raw Material',
  category TEXT DEFAULT 'Raw Material',
  unit TEXT DEFAULT 'NOS',
  uom TEXT DEFAULT 'NOS',
  price NUMERIC DEFAULT 0,
  rate NUMERIC DEFAULT 0,
  purchase_rate NUMERIC DEFAULT 0,
  gst_rate TEXT DEFAULT '18%',
  status TEXT DEFAULT 'Active',
  product_type TEXT,
  store TEXT DEFAULT 'Raw Material Yard',
  location TEXT,
  hsn TEXT,
  min_level NUMERIC DEFAULT 0,
  reorder_level NUMERIC DEFAULT 0,
  stock NUMERIC DEFAULT 0,
  opening_stock NUMERIC DEFAULT 0,
  physical_stock NUMERIC DEFAULT 0,
  available_stock NUMERIC DEFAULT 0,
  stock_on_hand NUMERIC DEFAULT 0,
  reserved NUMERIC DEFAULT 0,
  blocked_for_bom NUMERIC DEFAULT 0,
  goods_received NUMERIC DEFAULT 0,
  issued_prod NUMERIC DEFAULT 0,
  mat_return NUMERIC DEFAULT 0,
  stock_adj NUMERIC DEFAULT 0,
  description TEXT,
  material TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_materials_name ON public.raw_materials(name);

ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to raw_materials" ON public.raw_materials;
CREATE POLICY "Allow full access to raw_materials" ON public.raw_materials FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 8. BOM PRESETS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.bom_presets (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bom_presets_category ON public.bom_presets(category);

ALTER TABLE public.bom_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to bom_presets" ON public.bom_presets;
CREATE POLICY "Allow full access to bom_presets" ON public.bom_presets FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 9. CRM LEADS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.leads (
  id TEXT PRIMARY KEY,
  lead_number TEXT UNIQUE,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  designation TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  source TEXT DEFAULT 'Manual',
  status TEXT DEFAULT 'New',
  assigned_salesperson TEXT,
  estimated_kw NUMERIC DEFAULT 0,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_company ON public.leads(company_name);
CREATE INDEX IF NOT EXISTS idx_leads_salesperson ON public.leads(assigned_salesperson);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to leads" ON public.leads;
CREATE POLICY "Allow full access to leads" ON public.leads FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 10. CRM OPPORTUNITIES (12 Columns)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.opportunities (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  company_name TEXT NOT NULL,
  title TEXT NOT NULL,
  deal_value NUMERIC DEFAULT 0,
  stage TEXT DEFAULT 'Prospecting',
  probability INTEGER DEFAULT 20,
  assigned_salesperson TEXT,
  target_close_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_company ON public.opportunities(company_name);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON public.opportunities(stage);

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to opportunities" ON public.opportunities;
CREATE POLICY "Allow full access to opportunities" ON public.opportunities FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 11. QUOTATIONS (29 Columns)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.quotations (
  id TEXT PRIMARY KEY,
  quote_number TEXT UNIQUE NOT NULL,
  source_type TEXT DEFAULT 'sales',
  customer_name TEXT NOT NULL,
  company_name TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  project TEXT,
  date DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  amount NUMERIC DEFAULT 0,
  subtotal NUMERIC DEFAULT 0,
  discount_total NUMERIC DEFAULT 0,
  taxable_amount NUMERIC DEFAULT 0,
  gst_total NUMERIC DEFAULT 0,
  grand_total NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Draft',
  salesperson TEXT,
  payment_terms TEXT,
  delivery_terms TEXT,
  billing_address TEXT,
  delivery_address TEXT,
  notes TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  converted_pi_no TEXT,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotations_quote_number ON public.quotations(quote_number);
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON public.quotations(customer_name);

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to quotations" ON public.quotations;
CREATE POLICY "Allow full access to quotations" ON public.quotations FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 12. CRM WHATSAPP CONVERSATIONS (15 Columns)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  customer_name TEXT,
  company_name TEXT,
  customer_id TEXT,
  lead_id TEXT,
  opp_id TEXT,
  assigned_salesperson TEXT,
  unread_count INTEGER DEFAULT 0,
  last_message TEXT,
  last_message_time TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_phone ON public.whatsapp_conversations(phone);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to whatsapp_conversations" ON public.whatsapp_conversations;
CREATE POLICY "Allow full access to whatsapp_conversations" ON public.whatsapp_conversations FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 13. PROFORMA INVOICES (35 Columns)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.proforma_invoices (
  id TEXT PRIMARY KEY,
  pi_no TEXT UNIQUE NOT NULL,
  vendor TEXT,
  customer_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  gst_no TEXT,
  product_name TEXT,
  billing_address TEXT,
  billing_address_obj JSONB DEFAULT '{}'::jsonb,
  delivery_address TEXT,
  delivery_address_obj JSONB DEFAULT '{}'::jsonb,
  vehicle_no TEXT,
  signed_pi_doc TEXT,
  pi_date DATE DEFAULT CURRENT_DATE,
  delivery_date DATE,
  payment_terms TEXT,
  status TEXT DEFAULT 'Confirmed',
  sales_person TEXT,
  sales_person_code TEXT,
  sales_person_email TEXT,
  created_by TEXT,
  created_by_id TEXT,
  sub_total NUMERIC DEFAULT 0,
  gst_amount NUMERIC DEFAULT 0,
  cgst_amount NUMERIC DEFAULT 0,
  sgst_amount NUMERIC DEFAULT 0,
  grand_total NUMERIC DEFAULT 0,
  items JSONB DEFAULT '[]'::jsonb,
  preset_groups JSONB DEFAULT '[]'::jsonb,
  zoho_synced BOOLEAN DEFAULT false,
  zoho_estimate_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pi_no ON public.proforma_invoices(pi_no);
CREATE INDEX IF NOT EXISTS idx_pi_customer ON public.proforma_invoices(customer_name);

ALTER TABLE public.proforma_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to proforma_invoices" ON public.proforma_invoices;
CREATE POLICY "Allow full access to proforma_invoices" ON public.proforma_invoices FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 14. GOODS RECEIPT NOTES (18 Columns)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.goods_receipt_notes (
  id TEXT PRIMARY KEY,
  grn_no TEXT UNIQUE NOT NULL,
  po_ref TEXT,
  po_no TEXT NOT NULL,
  vendor TEXT NOT NULL,
  challan_no TEXT,
  date DATE DEFAULT CURRENT_DATE,
  received_qty NUMERIC DEFAULT 0,
  accepted_qty NUMERIC DEFAULT 0,
  rejected_qty NUMERIC DEFAULT 0,
  received_by TEXT,
  inspector_name TEXT,
  inspection_remarks TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  documents JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'Accepted',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grn_no ON public.goods_receipt_notes(grn_no);
CREATE INDEX IF NOT EXISTS idx_grn_po_no ON public.goods_receipt_notes(po_no);
CREATE INDEX IF NOT EXISTS idx_grn_vendor ON public.goods_receipt_notes(vendor);

ALTER TABLE public.goods_receipt_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to goods_receipt_notes" ON public.goods_receipt_notes;
CREATE POLICY "Allow full access to goods_receipt_notes" ON public.goods_receipt_notes FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 15. BOM ORDERS (Full 54 Columns)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.bom_orders (
  id TEXT PRIMARY KEY,
  bom_code TEXT UNIQUE NOT NULL,
  code TEXT,
  source_pi_no TEXT,
  date DATE DEFAULT CURRENT_DATE,
  delivery_date DATE,
  customer_name TEXT NOT NULL,
  company_name TEXT,
  mobile TEXT,
  email TEXT,
  billing_address TEXT,
  billing_address_obj JSONB DEFAULT '{}'::jsonb,
  delivery_address TEXT,
  delivery_address_obj JSONB DEFAULT '{}'::jsonb,
  delivery_address_proof_doc TEXT,
  transport_mode TEXT,
  transport_scope TEXT,
  transporter_name TEXT,
  vehicle_no TEXT,
  lr_no TEXT,
  payment_type TEXT,
  partial_amount NUMERIC DEFAULT 0,
  balance_amount NUMERIC DEFAULT 0,
  credit_days INTEGER DEFAULT 0,
  credit_due_date DATE,
  payment_proof_doc TEXT,
  remarks TEXT,
  status TEXT DEFAULT 'Draft',
  sales_confirmed BOOLEAN DEFAULT false,
  sales_confirmed_at TIMESTAMPTZ,
  sales_person TEXT,
  sales_person_code TEXT,
  created_by TEXT,
  created_by_id TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  payments JSONB DEFAULT '{}'::jsonb,
  dispatch_packing JSONB DEFAULT '{}'::jsonb,
  accounts_verification JSONB DEFAULT '{}'::jsonb,
  invoice_confirmed BOOLEAN DEFAULT false,
  invoice_deducted BOOLEAN DEFAULT false,
  stock_blocked BOOLEAN DEFAULT false,
  stock_blocked_at TIMESTAMPTZ,
  preset_name TEXT,
  preset_kit_price NUMERIC DEFAULT 0,
  preset_set_count INTEGER DEFAULT 0,
  preset_groups JSONB DEFAULT '[]'::jsonb,
  sub_total NUMERIC DEFAULT 0,
  gst_amount NUMERIC DEFAULT 0,
  cgst_amount NUMERIC DEFAULT 0,
  sgst_amount NUMERIC DEFAULT 0,
  grand_total NUMERIC DEFAULT 0,
  stock_deducted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bom_code ON public.bom_orders(bom_code);
CREATE INDEX IF NOT EXISTS idx_bom_source_pi ON public.bom_orders(source_pi_no);
CREATE INDEX IF NOT EXISTS idx_bom_customer ON public.bom_orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_bom_status ON public.bom_orders(status);

ALTER TABLE public.bom_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to bom_orders" ON public.bom_orders;
CREATE POLICY "Allow full access to bom_orders" ON public.bom_orders FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 16. PRODUCTION WORK ORDERS (31 Columns)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.production_work_orders (
  id TEXT PRIMARY KEY,
  work_order_no TEXT UNIQUE NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  product_name TEXT NOT NULL,
  finished_product_code TEXT,
  finished_product_name TEXT,
  planned_qty NUMERIC DEFAULT 0,
  target_qty NUMERIC DEFAULT 0,
  completed_qty NUMERIC DEFAULT 0,
  unit TEXT DEFAULT 'Pieces',
  cut_length_mm NUMERIC,
  raw_material TEXT,
  raw_material_name TEXT,
  customer TEXT,
  production_head TEXT,
  assigned_employee TEXT,
  priority TEXT DEFAULT 'Normal',
  status TEXT DEFAULT 'Pending',
  status_color TEXT DEFAULT '#D97706',
  start_date DATE,
  target_date DATE,
  delay_days INTEGER DEFAULT 0,
  delay_reason TEXT,
  product_items JSONB DEFAULT '[]'::jsonb,
  progress_history JSONB DEFAULT '[]'::jsonb,
  material_issue_history JSONB DEFAULT '[]'::jsonb,
  additional_material_requests JSONB DEFAULT '[]'::jsonb,
  rework_history JSONB DEFAULT '[]'::jsonb,
  completion_images JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_wo_no ON public.production_work_orders(work_order_no);
CREATE INDEX IF NOT EXISTS idx_production_status ON public.production_work_orders(status);

ALTER TABLE public.production_work_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to production_work_orders" ON public.production_work_orders;
CREATE POLICY "Allow full access to production_work_orders" ON public.production_work_orders FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 17. PRODUCTION INVENTORY, RECIPES & LEDGER
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.production_inventory (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Raw Material',
  unit TEXT DEFAULT 'NOS',
  is_whole_unit_only BOOLEAN DEFAULT false,
  physical_stock NUMERIC DEFAULT 0,
  reserved_stock NUMERIC DEFAULT 0,
  available_stock NUMERIC DEFAULT 0,
  issued_stock NUMERIC DEFAULT 0,
  consumed_stock NUMERIC DEFAULT 0,
  safety_stock NUMERIC DEFAULT 0,
  unit_rate NUMERIC DEFAULT 0,
  bay_location TEXT,
  stock NUMERIC DEFAULT 0,
  opening_stock NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.production_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to production_inventory" ON public.production_inventory;
CREATE POLICY "Allow full access to production_inventory" ON public.production_inventory FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.production_recipes (
  id TEXT PRIMARY KEY,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  output_unit TEXT DEFAULT 'Pieces',
  expected_output_qty NUMERIC DEFAULT 1,
  raw_material_code TEXT NOT NULL,
  raw_material_name TEXT NOT NULL,
  raw_material_unit TEXT DEFAULT 'Length (2414mm)',
  input_qty NUMERIC DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.production_recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to production_recipes" ON public.production_recipes;
CREATE POLICY "Allow full access to production_recipes" ON public.production_recipes FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.production_ledger (
  id BIGSERIAL PRIMARY KEY,
  transaction_type TEXT NOT NULL,
  item_code TEXT NOT NULL,
  work_order_no TEXT,
  quantity NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  operator TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.production_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to production_ledger" ON public.production_ledger;
CREATE POLICY "Allow full access to production_ledger" ON public.production_ledger FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 18. INVOICES & PAYMENTS (Accounts Flow)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY,
  inv_no TEXT UNIQUE,
  preset_name TEXT,
  inv_amt NUMERIC DEFAULT 0,
  vendor TEXT,
  bom_code TEXT,
  zoho_id TEXT,
  status TEXT DEFAULT 'Draft',
  pay TEXT,
  synced_to_zoho BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_inv_no ON public.invoices(inv_no);
CREATE INDEX IF NOT EXISTS idx_invoices_bom ON public.invoices(bom_code);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to invoices" ON public.invoices;
CREATE POLICY "Allow full access to invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY,
  vendor TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  mode TEXT DEFAULT 'NEFT',
  ref TEXT,
  date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'Paid',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to payments" ON public.payments;
CREATE POLICY "Allow full access to payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 19. NOTIFICATIONS & MEDIA ASSETS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  type TEXT DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  time TEXT,
  date DATE DEFAULT CURRENT_DATE,
  target_departments JSONB DEFAULT '[]'::jsonb,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to notifications" ON public.notifications;
CREATE POLICY "Allow full access to notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.media_assets (
  file_name TEXT PRIMARY KEY,
  mime_type TEXT,
  file_size BIGINT,
  storage_path TEXT,
  data_url TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to media_assets" ON public.media_assets;
CREATE POLICY "Allow full access to media_assets" ON public.media_assets FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 20. STORAGE SETUP: bom-documents (Private Bucket)
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bom-documents',
  'bom-documents',
  false,
  52428800, -- 50 MB limit
  ARRAY['image/jpeg', 'image/png', 'application/pdf', 'video/mp4', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf', 'video/mp4', 'image/webp'];

-- Security: Drop open unauthenticated policies (Gatekeeper pattern via server service_role)
DROP POLICY IF EXISTS "Allow upload to bom-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow select for bom-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow update in bom-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete from bom-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow full access to bom-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated and anon uploads to bom-documents" ON storage.objects;

-- Completion indicator
SELECT 'BUSINZ MAIN Environment Schema & Storage successfully initialized!' as status;
