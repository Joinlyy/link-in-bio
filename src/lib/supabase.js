import { createClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from './config'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})

/** Turn a Supabase/PostgREST error into a human-friendly message */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback
  const msg = error.message || String(error)
  if (/duplicate key.*username/i.test(msg) || /pages_username_key/.test(msg)) return 'That username is already taken.'
  if (/username_check|pages_username_check/i.test(msg)) return 'Usernames can use 3–30 letters, numbers, dots and underscores.'
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Network error — check your connection.'
  if (/JWT expired|invalid JWT/i.test(msg)) return 'Your session expired. Please sign in again.'
  return msg || fallback
}

/** Invoke an edge function and surface its JSON error body */
export async function invokeFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let message = error.message
    try {
      const payload = await error.context?.json?.()
      if (payload?.error) message = payload.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  return data
}
