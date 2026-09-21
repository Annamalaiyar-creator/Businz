import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ognmvcpzlebrvdynunwh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[SupabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is not defined in server environment.');
}

/**
 * Server-only Supabase Administrative Client.
 * Uses the privileged service_role key to manage private storage buckets and bypass RLS on the server.
 * NEVER import this file into frontend / client code (src/).
 */
export const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

export default supabaseAdmin;
