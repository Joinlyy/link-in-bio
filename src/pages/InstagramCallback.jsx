import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { announceInstagramConnected, applyInstagramToPage, clearConnectSettings, connectSettings, exchangeInstagramCode } from '../lib/instagram'
import { useAuth } from '../context/AuthContext'
import { APP_NAME } from '../lib/config'
import { Alert, Button, Spinner } from '../components/ui'
import { InstagramIcon } from '../components/icons'

export default function InstagramCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [error, setError] = useState(params.get('error_description') || (params.get('error') ? 'Instagram connection was cancelled.' : ''))
  const [done, setDone] = useState(false)
  const ran = useRef(false)
  const [settings] = useState(connectSettings)
  const { returnTo, newTab } = settings

  // In its own tab: close it (allowed only for tabs a script opened); otherwise go back into the app
  function finish(path) {
    if (newTab) {
      window.close()
      // Still open (the browser refused): fall through to the page below
    }
    navigate(path, { replace: true })
  }

  useEffect(() => {
    if (ran.current || error || !user) return
    ran.current = true
    ;(async () => {
      try {
        const account = await exchangeInstagramCode(params.get('code'), params.get('state'))
        if (settings.importProfile) {
          // Import into the page being edited (or the first page this creator owns)
          let selected = null
          try {
            selected = localStorage.getItem('lib_page')
          } catch {
            /* ignore */
          }
          const { data: owned } = await supabase.from('pages').select('*').eq('owner_id', user.id).order('created_at')
          const page = (owned || []).find((p) => p.id === selected) || (owned || [])[0]
          if (page) await applyInstagramToPage(page, account)
        }
        clearConnectSettings()
        announceInstagramConnected()
        if (newTab) {
          setDone(true)
          window.close()
        } else {
          navigate(`${returnTo}${returnTo.includes('?') ? '&' : '?'}instagram=connected`, { replace: true })
        }
      } catch (err) {
        setError(err.message)
      }
    })()
  }, [user, error, params, navigate, returnTo, newTab, settings])

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="card w-full max-w-md p-8 text-center sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white">
          <InstagramIcon size={26} />
        </span>
        {error ? (
          <>
            <h1 className="display-md mt-6">Couldn’t connect</h1>
            <div className="mt-4 text-left"><Alert>{error}</Alert></div>
            <Button className="mt-6" onClick={() => finish(returnTo)}>{newTab ? 'Close this tab' : 'Go back'}</Button>
          </>
        ) : done ? (
          <>
            <h1 className="display-md mt-6">Instagram connected</h1>
            <p className="mt-2 text-ink-500">Your {APP_NAME} tab has been updated. You can close this tab.</p>
            <Button className="mt-6" onClick={() => finish(`${returnTo}${returnTo.includes('?') ? '&' : '?'}instagram=connected`)}>Close this tab</Button>
          </>
        ) : (
          <>
            <h1 className="display-md mt-6">Connecting Instagram…</h1>
            <p className="mt-2 text-ink-500">Importing your profile and stats.</p>
            <Spinner className="mx-auto mt-6 size-6" />
          </>
        )}
      </div>
    </div>
  )
}
