import { safeNext } from '../../context/AuthContext'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { errorMessage, supabase } from '../../lib/supabase'
import { Alert, Button, FullScreenLoader, Input, PasswordInput } from '../../components/ui'
import { savePassword, validatePasswords } from '../../components/SetPassword'
import { useAuth } from '../../context/AuthContext'
import AuthShell from './AuthShell'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    setLoading(false)
    if (err) return setError(errorMessage(err))
    setSent(true)
  }

  return (
    <AuthShell pill="Account help" title="Reset" italic="your password.">
      {sent ? (
        <Alert tone="success">If an account exists for <b>{email}</b>, a reset link is on its way.</Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <Input label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          {error && <Alert>{error}</Alert>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-8 text-center text-[15px]">
        <Link to="/signin" className="font-semibold underline underline-offset-4">Back to sign in</Link>
      </p>
    </AuthShell>
  )
}

export function ResetPassword() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (authLoading) return <FullScreenLoader />

  async function onSubmit(e) {
    e.preventDefault()
    const problem = validatePasswords(password, confirm)
    if (problem) return setError(problem)
    setLoading(true)
    try {
      await savePassword(password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <AuthShell pill="Account help" title="New" italic="password.">
      {!user ? (
        <Alert>This reset link is invalid or has expired. <Link to="/forgot-password" className="underline">Request a new one</Link>.</Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <PasswordInput label="New password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <PasswordInput label="Confirm password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <Alert>{error}</Alert>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Save password
          </Button>
        </form>
      )}
    </AuthShell>
  )
}

/** Landing spot for OAuth / magic links / email confirmations (PKCE code is exchanged by supabase-js) */
export function AuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [error, setError] = useState(params.get('error_description') || '')

  useEffect(() => {
    if (error || loading) return
    if (user) {
      const next = params.get('next')
      navigate(safeNext(next), { replace: true })
      return
    }
    const timer = setTimeout(() => setError('This link is invalid or has expired.'), 6000)
    return () => clearTimeout(timer)
  }, [user, loading, error, params, navigate])

  if (!error) return <FullScreenLoader />
  return (
    <AuthShell pill="Hmm" title="Sign-in" italic="didn’t work.">
      <Alert>{error}</Alert>
      <Button to="/signin" size="lg" className="mt-6 w-full">Back to sign in</Button>
    </AuthShell>
  )
}
