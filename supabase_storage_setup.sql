-- ==============================================================================
-- BUSINZ ERP: Supabase Storage Provisioning for BOM Documents (Phase D1)
-- Bucket: bom-documents (PRIVATE)
-- Project: ognmvcpzlebrvdynunwh
-- Run this in your Supabase Dashboard: SQL Editor -> "New query" -> Paste & "Run"
-- ==============================================================================

-- 1. Create Private Storage Bucket with File Restrictions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bom-documents',
  'bom-documents',
  false,
  52428800, -- 50 MB file size limit (covers photos, PDFs, and compressed dispatch media)
  ARRAY['image/jpeg', 'image/png', 'application/pdf', 'video/mp4', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf', 'video/mp4', 'image/webp'];

-- 2. Storage Policies for bom-documents bucket

-- Allow clients to upload objects into the bom-documents bucket
DROP POLICY IF EXISTS "Allow upload to bom-documents" ON storage.objects;
CREATE POLICY "Allow upload to bom-documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'bom-documents');

-- Allow reading/downloading objects via signed URLs
DROP POLICY IF EXISTS "Allow select for bom-documents" ON storage.objects;
CREATE POLICY "Allow select for bom-documents"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'bom-documents');

-- Allow updating objects in bom-documents
DROP POLICY IF EXISTS "Allow update in bom-documents" ON storage.objects;
CREATE POLICY "Allow update in bom-documents"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'bom-documents');

-- Allow deleting objects from bom-documents
DROP POLICY IF EXISTS "Allow delete from bom-documents" ON storage.objects;
CREATE POLICY "Allow delete from bom-documents"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'bom-documents');
