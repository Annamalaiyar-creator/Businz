import { createClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
const APP_ENV = env.VITE_APP_ENV || env.MODE || 'development';

const PROD_REF = 'qhxaqrclvdfkswdavvjd';
const DEV_REF = 'ddzkcbgwwpluzbhnrywp';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[BUSINZ Config Error] Supabase environment configuration is missing.');
  throw new Error('Supabase environment configuration is missing.');
}

// Guard against cross-environment configuration mismatch
if ((APP_ENV === 'development' || APP_ENV === 'staging') && SUPABASE_URL.includes(PROD_REF)) {
  console.error('[BUSINZ Security Guard] Configuration mismatch: Non-production environment is targeting Production Supabase.');
  throw new Error('Security Guard: Non-production environment cannot connect to Production Supabase.');
}

if (APP_ENV === 'production' && SUPABASE_URL.includes(DEV_REF)) {
  console.error('[BUSINZ Security Guard] Configuration mismatch: Production environment is targeting Dev Supabase.');
  throw new Error('Security Guard: Production environment cannot connect to Dev Supabase.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
