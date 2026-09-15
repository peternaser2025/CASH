import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Project Reference extracted from JWT: qdpjxwwxtduzd проти -> qdpjxwwxtduzdxeesyws
const DEFAULT_SUPABASE_URL = 'https://qdpjxwwxtduzdxeesyws.supabase.co';

export function getSupabaseServerClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false }
  });
}
