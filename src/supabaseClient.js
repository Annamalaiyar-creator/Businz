import { createClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});
const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://ognmvcpzlebrvdynunwh.supabase.co';
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nbm12Y3B6bGVicnZkeW51bndoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MjA3ODYsImV4cCI6MjEwMTk5Njc4Nn0.x3NIpkDHzNa9dMQ9pnz4qGiy0ZBeAX98Hzbj54AHSfo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
