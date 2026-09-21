import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try loading from parent root .env as well as current working directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ognmvcpzlebrvdynunwh.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nbm12Y3B6bGVicnZkeW51bndoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MjA3ODYsImV4cCI6MjEwMTk5Njc4Nn0.x3NIpkDHzNa9dMQ9pnz4qGiy0ZBeAX98Hzbj54AHSfo';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[SupabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is not defined in server environment. Using fallback key.');
}

const keyToUse = SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || SUPABASE_KEY;

/**
 * Server-only Supabase Administrative Client.
 * Uses the privileged service_role key to manage private storage buckets and bypass RLS on the server.
 * NEVER import this file into frontend / client code (src/).
 */
export const supabaseAdmin = createClient(
  SUPABASE_URL,
  keyToUse,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

export default supabaseAdmin;
