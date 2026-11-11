import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export const USERNAME_RE = /^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$/

export function cleanUsername(v) {
  return (v || '').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 30)
}

/** Debounced availability check against the database */
export function useUsernameCheck(username, current) {
  const [state, setState] = useState({ status: 'idle', message: '' })

  useEffect(() => {
    if (!username || username === current) return setState({ status: 'idle', message: '' })
    if (!USERNAME_RE.test(username)) {
      return setState({ status: 'invalid', message: '3–30 characters: letters, numbers, dots, underscores. Can’t start or end with a dot.' })
    }
    setState({ status: 'checking', message: 'Checking…' })
    let alive = true
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('is_username_available', { p_username: username })
      if (!alive) return
      if (error) setState({ status: 'invalid', message: 'Couldn’t check right now.' })
      else setState(data ? { status: 'ok', message: 'Available!' } : { status: 'taken', message: 'Sorry, that one’s taken.' })
    }, 350)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [username, current])

  return state
}
