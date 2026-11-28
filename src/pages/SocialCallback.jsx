import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { finishSocialConnect, SOCIAL, socialReturnTo } from '../lib/social'
import { Alert, Button, Spinner } from '../components/ui'

/** Where LinkedIn and Google send people back to after they allow posting */
export default function SocialCallback({ platform }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const name = SOCIAL[platform].name
  const [error, setError] = useState(params.get('error_description') || (params.get('error') ? `${name} connection was cancelled.` : ''))
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current || error || !user) return
    ran.current = true
    finishSocialConnect(platform, params.get('code'), params.get('state'))
      .then(() => {
        document.title = 'Joinlyy'
        const back = socialReturnTo()
        navigate(`${back}${back.includes('?') ? '&' : '?'}connected=${platform}`, { replace: true })
      })
      .catch((err) => setError(err.message))
  }, [user, error, params, navigate, platform])

  return (
    <div className="grid min-h-dvh place-items-center bg-cream p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-soft">
        {error ? (
          <>
            <Alert>{error}</Alert>
            <Button to="/dashboard/settings" className="mt-6 w-full">Back to Settings</Button>
          </>
        ) : (
          <>
            <Spinner />
            <p className="mt-4 font-semibold">Connecting {name}…</p>
          </>
        )}
      </div>
    </div>
  )
}
