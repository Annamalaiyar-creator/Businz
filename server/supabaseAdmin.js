import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prioritize local development env if present, then fallback to root .env
dotenv.config({ path: path.resolve(__dirname, '../.env.development.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_ENV = process.env.APP_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'development');

const PROD_REF = 'qhxaqrclvdfkswdavvjd';
const DEV_REF = 'ddzkcbgwwpluzbhnrywp';

if (!SUPABASE_URL) {
  console.error('[SupabaseAdmin Error] Supabase environment configuration is missing.');
  throw new Error('Supabase environment configuration is missing.');
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[SupabaseAdmin Error] SUPABASE_SERVICE_ROLE_KEY is required for administrative server operations but is not defined.');
  throw new Error('Administrative Supabase configuration is missing.');
}

// Guard against cross-environment configuration mismatch
if ((APP_ENV === 'development' || APP_ENV === 'staging') && SUPABASE_URL.includes(PROD_REF)) {
  console.error('[SupabaseAdmin Security Guard] Mismatch: Non-production environment attempted connection to Production Supabase.');
  throw new Error('Security Guard: Non-production environment cannot connect to Production Supabase.');
}

if (APP_ENV === 'production' && SUPABASE_URL.includes(DEV_REF)) {
  console.error('[SupabaseAdmin Security Guard] Mismatch: Production environment attempted connection to Dev Supabase.');
  throw new Error('Security Guard: Production environment cannot connect to Dev Supabase.');
}

/**
 * Server-only Supabase Administrative Client.
 * Uses the privileged service_role key to manage private storage buckets and bypass RLS on the server.
 * NEVER import this file into frontend / client code (src/).
 */
export const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

export default supabaseAdmin;
