import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Alert, Button, Input } from '../../components/ui'
import { Logo } from '../../components/icons'

/** Admin tools need two-step login. First time in: set it up right here, then continue straight to the admin. */
export default function AdminSecurityGate() {
  const { mfaPassed, signOut, profile } = useAuth()
  const [enroll, setEnroll] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function start() {
    setError('')
    setBusy(true)
    const { data: list } = await supabase.auth.mfa.listFactors()
    for (const f of list?.all || []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Admin ${Date.now()}` })
    setBusy(false)
    if (err) return setError(err.message)
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  async function verify(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.trim() })
    if (err) {
      setBusy(false)
      return setError('That code didn’t work. Check the time on your phone and try again.')
    }
    await supabase.auth.refreshSession() // the new session carries the verified two-step level
    setBusy(false)
    mfaPassed()
  }

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="card w-full max-w-md p-8 text-center sm:p-10">
        <Logo size={48} className="mx-auto" />
        <span className="mx-auto mt-6 grid size-12 place-items-center rounded-full bg-lime"><ShieldCheck className="size-6" /></span>
        <h1 className="display-md mt-4">Secure your admin account</h1>
        <p className="mt-2 text-ink-500">Admin access needs a 6-digit code from an authenticator app (Google Authenticator, Authy or 1Password), every time you sign in.</p>
        {error && <div className="mt-4 text-left"><Alert>{error}</Alert></div>}
        {enroll ? (
          <form onSubmit={verify} className="mt-6 grid gap-4 text-left">
            <img src={enroll.qr} alt="Scan with your authenticator app" className="mx-auto size-44 rounded-2xl bg-white p-2 ring-1 ring-ink/10" />
            <p className="text-sm text-ink-600">Scan the QR code, or type this key into the app: <code className="rounded bg-cream px-1.5 py-0.5 text-xs break-all">{enroll.secret}</code></p>
            <Input label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            <Button type="submit" size="lg" loading={busy} disabled={code.length !== 6}>Verify and open admin</Button>
          </form>
        ) : (
          <Button size="lg" className="mt-6 w-full" loading={busy} onClick={start}>Set up two-step login</Button>
        )}
        <p className="mt-5 text-xs text-ink-400">Signed in as {profile?.email}</p>
        <button type="button" onClick={signOut} className="mt-2 text-sm font-semibold text-ink-500 underline">Sign out</button>
      </div>
    </div>
  )
}
