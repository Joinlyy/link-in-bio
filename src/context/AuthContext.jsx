import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button, FullScreenLoader, ToastProvider } from '../components/ui'
import { Logo } from '../components/icons'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileFor, setProfileFor] = useState(null) // user id the profile was loaded for
  const [loading, setLoading] = useState(true)
  const [needsMfa, setNeedsMfa] = useState(false)
  const [aal, setAal] = useState(null)

  const loadProfile = useCallback(async (user) => {
    if (!user) {
      setProfile(null)
      setProfileFor(null)
      return
    }
    const [{ data }, { data: aal }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ])
    setNeedsMfa(aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2')
    setAal(aal?.currentLevel ?? null)
    setProfile(data)
    setProfileFor(user.id)
  }, [])

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      await loadProfile(data.session?.user)
      if (alive) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      // Defer DB calls out of the auth callback (supabase-js recommendation)
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'SIGNED_OUT') {
        setTimeout(() => loadProfile(s?.user), 0)
      }
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading: loading || Boolean(session?.user && profileFor !== session.user.id),
      isAdmin: profile?.role === 'admin' && profile?.status === 'active',
      needsMfa,
      // Admin actions need two-step login; the database refuses them otherwise
      adminNeedsMfa: profile?.role === 'admin' && profile?.status === 'active' && aal !== 'aal2',
      mfaPassed: () => {
        setNeedsMfa(false)
        setAal('aal2')
      },
      refreshProfile: () => loadProfile(session?.user),
      signOut: async () => {
        await supabase.auth.signOut()
        setProfile(null)
      },
    }),
    [session, profile, profileFor, loading, needsMfa, loadProfile],
  )

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  return useContext(AuthCtx)
}

/** Route layout that boots Supabase auth only for app (non-public) routes */
export default function AuthLayout() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Suspense fallback={<FullScreenLoader />}>
          <Outlet />
        </Suspense>
      </ToastProvider>
    </AuthProvider>
  )
}

function MfaChallenge() {
  const { mfaPassed, signOut } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function verify(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { data } = await supabase.auth.mfa.listFactors()
    const factor = data?.totp?.find((f) => f.status === 'verified')
    const { error: err } = factor
      ? await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() })
      : { error: new Error('No authenticator found') }
    setBusy(false)
    if (err) return setError('Wrong code. Try the latest one from your app.')
    mfaPassed()
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <form onSubmit={verify} className="card w-full max-w-md p-8 text-center sm:p-10">
        <Logo size={48} className="mx-auto" />
        <h1 className="display-md mt-6">Enter your code</h1>
        <p className="mt-2 text-ink-500">Open your authenticator app and type the 6-digit code.</p>
        <input
          autoFocus
          className="field mt-6 text-center font-mono text-2xl tracking-[0.5em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          aria-label="6-digit code"
        />
        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
        <Button type="submit" size="lg" className="mt-6 w-full" loading={busy} disabled={code.length !== 6}>Verify</Button>
        <button type="button" onClick={signOut} className="mt-4 text-sm font-semibold text-ink-500 underline">Sign out</button>
      </form>
    </div>
  )
}

function Suspended({ reason, onSignOut }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="card w-full max-w-md p-8 text-center sm:p-10">
        <Logo size={48} className="mx-auto" />
        <h1 className="display-md mt-6">Your account is suspended</h1>
        <p className="mt-3 text-ink-500">{reason || 'Your page has been suspended for violating our terms.'}</p>
        <p className="mt-2 text-sm text-ink-500">If you think this is a mistake, contact support.</p>
        <Button className="mt-7" variant="outline" onClick={onSignOut}>
          Sign out
        </Button>
      </div>
    </div>
  )
}

export function RequireAuth({ children }) {
  const { user, profile, loading, signOut, needsMfa } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to={`/signin?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  if (needsMfa) return <MfaChallenge />
  if (profile?.status === 'suspended') return <Suspended reason={profile.suspended_reason} onSignOut={signOut} />
  return children
}

export function RequireAdmin({ children }) {
  const { isAdmin, adminNeedsMfa, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  if (adminNeedsMfa) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="max-w-sm">
          <h1 className="display-md">Turn on two-step login</h1>
          <p className="mt-3 text-ink-500">Admin tools need an authenticator app code at sign-in. Set it up in Settings, then sign out and sign in again.</p>
          <a href="/dashboard/settings" className="mt-6 inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white">Open Settings</a>
        </div>
      </div>
    )
  }
  return children
}

/** A path on this site, never another site: blocks //evil.com and /\evil.com */
export function safeNext(next) {
  return next && /^\/(?![/\\])/.test(next) ? next : '/dashboard'
}

/** Send signed-in users away from sign-in/up screens */
export function GuestOnly({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoader />
  if (user) {
    const next = new URLSearchParams(location.search).get('next')
    return <Navigate to={safeNext(next)} replace />
  }
  return children
}
