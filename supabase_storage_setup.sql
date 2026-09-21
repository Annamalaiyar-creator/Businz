-- ==============================================================================
-- BUSINZ ERP: Supabase Storage Provisioning for BOM Documents (Phase D1)
-- Bucket: bom-documents (STRICTLY PRIVATE)
-- Project: ognmvcpzlebrvdynunwh
-- Execution: Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run
-- ==============================================================================

-- 1. Create Private Storage Bucket with Strict File Restrictions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bom-documents',
  'bom-documents',
  false,
  52428800, -- 50 MB maximum file size limit
  ARRAY['image/jpeg', 'image/png', 'application/pdf', 'video/mp4', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf', 'video/mp4', 'image/webp'];

-- 2. Drop any previous insecure or overly permissive policies on bom-documents
DROP POLICY IF EXISTS "Allow upload to bom-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow select for bom-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow update in bom-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete from bom-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow full access to bom-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated and anon uploads to bom-documents" ON storage.objects;

-- 3. Security Policy:
-- In the BUSINZ Backend Gatekeeper architecture:
-- The backend server operates with service_role permissions (which bypasses RLS)
-- to upload, update, and generate signed URLs after verifying the BUSINZ session.
-- Direct unauthenticated/anonymous access to storage.objects is strictly BLOCKED.
-- No open anonymous CRUD policies are created.
