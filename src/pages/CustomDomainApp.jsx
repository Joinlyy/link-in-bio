import { lazy, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { fetchUsernameForDomain } from '../lib/publicApi'
import { APP_NAME, CONFIGURED_DOMAIN } from '../lib/config'
import { Logo } from '../components/icons'
import { FullScreenLoader } from '../components/ui'
import PublicPage from './PublicPage'

const ProductPage = lazy(() => import('./ProductPage'))
const OrderPage = lazy(() => import('./OrderPage'))
const MediaKit = lazy(() => import('./MediaKit'))

/** A creator's own domain (e.g. links.priya.com) serving only their site at the root */
export default function CustomDomainApp() {
  const [state, setState] = useState({ status: 'loading', username: null })

  useEffect(() => {
    fetchUsernameForDomain(window.location.hostname)
      .then((username) => setState({ status: username ? 'ready' : 'missing', username }))
      .catch(() => setState({ status: 'missing', username: null }))
  }, [])

  if (state.status === 'loading') return <FullScreenLoader />
  if (state.status === 'missing') {
    return (
      <div className="grid min-h-dvh place-items-center px-4 text-center">
        <div className="card max-w-md p-8 sm:p-10">
          <Logo size={48} className="mx-auto" />
          <h1 className="display-md mt-6">This domain isn’t connected yet</h1>
          <p className="mt-3 text-ink-500">If you own it, finish setup in your {APP_NAME} dashboard → Settings → Custom domain.</p>
          <a href={CONFIGURED_DOMAIN ? `https://${CONFIGURED_DOMAIN}` : '/'} className="mt-6 inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white">Go to {APP_NAME}</a>
        </div>
      </div>
    )
  }

  const u = state.username
  return (
    <Routes>
      <Route path="/" element={<PublicPage username={u} base="" />} />
      <Route path="/media-kit" element={<MediaKit username={u} />} />
      <Route path="/p/:productId" element={<ProductPage username={u} basePath="" />} />
      <Route path="/order/:token" element={<OrderPage />} />
      <Route path="/:slug" element={<PublicPage username={u} base="" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
