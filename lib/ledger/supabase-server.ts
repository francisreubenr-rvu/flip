import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _serverClient: ReturnType<typeof createClient> | null = null;

/**
 * Create or return a cached server-side Supabase client.
 *
 * When `SUPABASE_SERVICE_ROLE_KEY` is present (Vercel deploys) it is used so
 * that Row Level Security is bypassed — the server owns the ledger data.
 * Falls back to the anon key when only local development env vars are set.
 *
 * Returns `null` when neither key is available or the URL is unset.
 */
export function getServerClient() {
  if (_serverClient) return _serverClient;

  const key = serviceRoleKey || anonKey;
  if (!supabaseUrl || !key) return null;

  _serverClient = createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return _serverClient;
}

/**
 * Check whether at least the URL and one auth key are present so the
 * Supabase client can be created.
 */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && (serviceRoleKey || anonKey));
}
