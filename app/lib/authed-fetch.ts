'use client'

import { supabase } from './supabase'

/**
 * fetch() wrapper that attaches the current Supabase session's access token as
 * an `Authorization: Bearer` header so server routes can authenticate the
 * caller. When there is no session, the request is sent without the header and
 * the server rejects it with 401 (fail-closed).
 *
 * Used for the ledger API, whose routes run with the service-role client and
 * therefore enforce auth themselves rather than relying on RLS.
 */
export async function authedFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers = new Headers(init.headers)
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  return fetch(input, { ...init, headers })
}
