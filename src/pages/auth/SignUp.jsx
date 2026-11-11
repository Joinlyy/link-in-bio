import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PUBLIC_DOMAIN } from '../../lib/config'
import { Alert } from '../../components/ui'
import AuthShell, { GoogleButton, useGoogleEnabled } from './AuthShell'
import { signInWithGoogle } from './SignIn'
import { captureRef } from '../../lib/referral'

/** Accounts are created with Google only; a password can be added later inside the panel */
export default function SignUp() {
  const [params] = useSearchParams()
  const googleEnabled = useGoogleEnabled()
  const wanted = params.get('username')

  useEffect(() => {
    if (wanted) sessionStorage.setItem('lib_wanted_username', wanted)
  }, [wanted])

  useEffect(() => {
    captureRef()
  }, [])

  return (
    <AuthShell pill="Free forever plan" title="Start free" italic="in two minutes.">
      {wanted && (
        <div className="mb-6 rounded-2xl bg-lime-200 px-4 py-3 text-sm">
          Next, we’ll check that <b>{PUBLIC_DOMAIN}/{wanted}</b> is free and save it for you.
        </div>
      )}
      {googleEnabled === false ? (
        <Alert>Sign-up isn’t available right now. Please try again a little later.</Alert>
      ) : (
        <GoogleButton onClick={() => signInWithGoogle('/onboarding')} loading={googleEnabled === null} />
      )}
      <p className="mt-4 text-center text-sm text-ink-500">No form to fill. You can create a password later from your dashboard.</p>
      <p className="mt-8 text-center text-[15px] text-ink-600">
        Already have a page?{' '}
        <Link to="/signin" className="font-semibold text-ink underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
