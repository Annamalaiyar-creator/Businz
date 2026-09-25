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

const DEFAULT_SUPABASE_URL = 'https://qhxaqrclvdfkswdavvjd.supabase.co';
const DEFAULT_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoeGFxcmNsdmRma3N3ZGF2dmpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDE0NzYzOCwiZXhwIjoyMTA1NzIzNjM4fQ.NZJoTzxvoiMPjOa-MIeGful8PeiYAu68vw8rZc8zegw';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('[SupabaseAdmin Error] Supabase environment configuration is missing.');
  throw new Error('Supabase environment configuration is missing.');
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[SupabaseAdmin Error] SUPABASE_SERVICE_ROLE_KEY is required for administrative server operations but is not defined.');
  throw new Error('Administrative Supabase configuration is missing.');
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
