import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://qhxaqrclvdfkswdavvjd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoeGFxcmNsdmRma3N3ZGF2dmpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNDc2MzgsImV4cCI6MjEwNTcyMzYzOH0.5eTHE3fVU5L0wvNr-xFcidfqgBTqVSpGFhiBvZcKfec';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});
const SUPABASE_URL = env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[BUSINZ Config Error] Supabase environment configuration is missing.');
  throw new Error('Supabase environment configuration is missing.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
