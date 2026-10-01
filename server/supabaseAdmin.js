/**
 * Server-only Database Admin Shim for Hostinger VPS
 * Replaces SupabaseAdmin with self-hosted PostgreSQL admin operations.
 */
import { pool, query, isDbConnected } from './db.js';

export const supabaseAdmin = {
  isSelfHosted: true,
  query,
  pool,
  storage: {
    from() {
      return {
        upload: () => Promise.resolve({ data: {}, error: null }),
        createSignedUrl: (path) => Promise.resolve({ data: { signedUrl: `/uploads/bom-documents/${path}` }, error: null }),
        remove: () => Promise.resolve({ data: [], error: null })
      };
    }
  }
};

export default supabaseAdmin;
