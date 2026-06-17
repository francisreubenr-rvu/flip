import { createClient, type User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _serverClient: ReturnType<typeof createClient> | null = null;

/**
 * Verify the caller's Supabase session from the request's `Authorization:
 * Bearer <jwt>` header and return the authenticated user, or `null` if the
 * token is missing/invalid.
 *
 * The ledger API routes use the service-role client (which bypasses RLS), so
 * the routes themselves MUST gate every request on this check — otherwise the
 * endpoints are world-readable/writable. The JWT is validated with the anon
 * key only; the service-role key is never used for verification.
 */
export async function getAuthedUser(request: Request): Promise<User | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!token || !supabaseUrl || !anonKey) return null;

  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

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
