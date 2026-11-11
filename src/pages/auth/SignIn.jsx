import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { errorMessage, supabase } from '../../lib/supabase'
import { captureRef } from '../../lib/referral'
import { Alert, Button, Input, PasswordInput } from '../../components/ui'
import AuthShell, { Divider, GoogleButton, Tabs, useGoogleEnabled } from './AuthShell'

export async function signInWithGoogle(next = '/dashboard') {
  // Google sign-ups carry no metadata: remember ?ref= so the dashboard can claim it after login
  captureRef()
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
  })
}

export default function SignIn() {
  const [params] = useSearchParams()
  const next = params.get('next') || '/dashboard'
  const navigate = useNavigate()
  const [mode, setMode] = useState('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const googleEnabled = useGoogleEnabled()

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    if (mode === 'password') {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      setLoading(false)
      if (err) return setError(err.message === 'Invalid login credentials' ? 'Wrong email or password.' : errorMessage(err))
      navigate(next, { replace: true })
    } else {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      })
      setLoading(false)
      if (err) return setError(errorMessage(err))
      setSent(true)
    }
  }

  return (
    <AuthShell pill="Welcome back" title="Sign in" italic="to your page.">
      <Tabs
        value={mode}
        onChange={(m) => {
          setMode(m)
          setSent(false)
          setError('')
        }}
        options={[
          { value: 'password', label: 'Password' },
          { value: 'magic', label: 'Email link' },
        ]}
      />
      {sent ? (
        <div className="mt-6">
          <Alert tone="success">
            Check <b>{email}</b> — we sent you a sign-in link. It expires in 1 hour.
          </Alert>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          {mode === 'password' && (
            <PasswordInput label="Password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          )}
          {mode === 'password' && (
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm font-semibold underline underline-offset-4">
                Forgot password?
              </Link>
            </div>
          )}
          {error && <Alert>{error}</Alert>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            {mode === 'password' ? 'Sign in' : 'Email me a link'}
          </Button>
        </form>
      )}
      {googleEnabled && (
        <>
          <Divider />
          <GoogleButton onClick={() => signInWithGoogle(next)} />
        </>
      )}
      <p className="mt-8 text-center text-[15px] text-ink-600">
        New here?{' '}
        <Link to="/signup" className="font-semibold text-ink underline underline-offset-4">
          Create your free page
        </Link>
      </p>
    </AuthShell>
  )
}
