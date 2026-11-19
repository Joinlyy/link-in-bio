import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import MediaKitView from '../components/MediaKitView'
import { useMediaKitPdf } from '../lib/useMediaKitPdf'
import { Logo } from '../components/icons'
import { fetchMediaKit } from '../lib/publicApi'
import { APP_NAME } from '../lib/config'

export default function MediaKit(props) {
  const routeParams = useParams()
  const username = props.username || routeParams.username
  const [params] = useSearchParams()
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    fetchMediaKit(username)
      .then((data) => setState(data ? { status: 'ready', data } : { status: 'missing' }))
      .catch(() => setState({ status: 'missing' }))
  }, [username])

  const { busy, error, download } = useMediaKitPdf(state.data?.page, state.data?.instagram)

  useEffect(() => {
    if (state.status !== 'ready') return
    document.title = `${state.data.page.display_name || username} — Media kit`
    // Old "?print=1" links: download the PDF straight away (it used to open the print dialog)
    if (params.get('print') === '1') download()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, username])

  if (state.status === 'loading') {
    return <div className="mx-auto mt-16 h-64 max-w-4xl animate-pulse rounded-3xl bg-cream-200 px-4" />
  }
  if (state.status === 'missing') {
    return (
      <div className="grid min-h-dvh place-items-center px-4 text-center">
        <div>
          <Logo size={48} className="mx-auto" />
          <h1 className="display-md mt-6">Media kit not available</h1>
          <Link to="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white">Go to {APP_NAME}</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:py-10">
      <div className="no-print mx-auto mb-4 flex max-w-4xl flex-col items-end gap-2">
        <button type="button" onClick={download} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? <><LoaderCircle className="size-4 animate-spin" /> Preparing PDF…</> : 'Download PDF'}
        </button>
        {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      </div>
      <MediaKitView page={state.data.page} instagram={state.data.instagram} />
    </div>
  )
}
