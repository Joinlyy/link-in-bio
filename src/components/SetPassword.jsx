import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { errorMessage, supabase } from '../lib/supabase'
import { Alert, Button, Modal, PasswordInput, useToast } from './ui'

/** Google users have no password until they create one here */
export function hasPassword(user) {
  return Boolean(user?.user_metadata?.has_password || user?.app_metadata?.providers?.includes('email'))
}

/** Saves a new password and remembers that this account now has one */
export async function savePassword(password) {
  const { error } = await supabase.auth.updateUser({ password, data: { has_password: true } })
  if (error) throw new Error(errorMessage(error))
}

export function validatePasswords(password, confirm) {
  if (password.length < 8) return 'Use at least 8 characters.'
  if (password !== confirm) return 'The two passwords don’t match.'
  return ''
}

function SetPasswordModal({ onClose }) {
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    const problem = validatePasswords(password, confirm)
    if (problem) return setError(problem)
    setBusy(true)
    setError('')
    try {
      await savePassword(password)
      toast('Password created. You can now sign in with Google or your password.')
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Create your password">
      <form onSubmit={submit} className="space-y-4">
        <PasswordInput label="Password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        <PasswordInput label="Confirm password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type it again" />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>Save password</Button>
      </form>
    </Modal>
  )
}

/** Header line shown in the panels until the user has created a password */
export default function PasswordBanner() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  if (!user || hasPassword(user)) return null
  return (
    <>
      <div className="flex flex-col gap-2 rounded-2xl bg-lime px-4 py-2.5 text-sm font-medium text-ink sm:flex-row sm:items-center sm:justify-between" role="status">
        <span className="flex items-center gap-2">
          <KeyRound className="size-4 shrink-0" /> Please create your password so you can also sign in without Google.
        </span>
        <Button size="sm" onClick={() => setOpen(true)}>Create password</Button>
      </div>
      {open && <SetPasswordModal onClose={() => setOpen(false)} />}
    </>
  )
}
