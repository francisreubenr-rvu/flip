import { createClient } from '@supabase/supabase-js'

// NEXT_PUBLIC_* vars are replaced at build time. If .env.local hasn't been
// created yet (e.g. fresh clone, CI), fall back to localhost so createClient
// doesn't throw — auth calls will just fail at runtime, not at build time.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL  || 'http://localhost'
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-key'

if (typeof window !== 'undefined' && (url === 'http://localhost' || key === 'missing-key')) {
  console.warn('[flip] Supabase env vars not set. Copy .env.local.example → .env.local and restart the dev server.')
}

export const supabase = createClient(url, key)
