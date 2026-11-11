import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageRenderer from '../components/page/PageRenderer'
import { Logo } from '../components/icons'
import { trackView } from '../lib/analytics'
import { fetchMemberPage, fetchPublicPage } from '../lib/publicApi'
import MembersGate from '../components/page/MembersGate'
import { APP_NAME } from '../lib/config'

function setMeta(name, content, attr = 'name') {
  let el = document.head.querySelector(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

const memberKey = (pageId) => `lib_member_${pageId}`

/**
 * A creator page or one of its sub-pages. On a custom domain the router passes
 * `username` and base="" as props instead of reading them from the URL.
 */
export default function PublicPage(props) {
  const params = useParams()
  const username = props.username || params.username
  const slug = params.slug || null
  const base = props.base ?? `/${username}`
  const [state, setState] = useState({ status: 'loading', data: null })

  useEffect(() => {
    let alive = true
    setState({ status: 'loading', data: null })
    ;(async () => {
      try {
        let data = await fetchPublicPage(username, slug)
        // Members-only sub-page: try a saved membership access token
        if (data?.locked) {
          let token = null
          try {
            token = localStorage.getItem(memberKey(data.page.id))
          } catch {
            /* ignore */
          }
          if (token) data = await fetchMemberPage(username, slug, token).catch(() => data)
        }
        if (alive) setState({ status: data ? 'ready' : 'missing', data })
      } catch {
        if (alive) setState({ status: 'error', data: null })
      }
    })()
    return () => {
      alive = false
    }
  }, [username, slug])

  async function unlock(token) {
    const data = await fetchMemberPage(username, slug, token)
    try {
      localStorage.setItem(memberKey(data.page.id), token)
    } catch {
      /* ignore */
    }
    setState({ status: 'ready', data })
  }

  useEffect(() => {
    if (state.status !== 'ready') return
    const { page } = state.data
    const sub = state.data.site_page
    const seo = { ...(page.seo || {}), ...(sub?.seo || {}) }
    const name = page.display_name || page.username
    const title = seo.title || (sub ? `${sub.title} · ${name}` : `${name} (@${page.username}) | ${APP_NAME}`)
    const description = seo.description || page.bio || `All of ${page.display_name || page.username}'s links in one place.`
    document.title = title
    setMeta('description', description)
    setMeta('og:title', title, 'property')
    setMeta('og:description', description, 'property')
    const image = seo.image || page.avatar_url
    if (image) setMeta('og:image', image, 'property')
    const bg = page.theme?.bg
    if (bg) setMeta('theme-color', bg)
    trackView(page.id)
  }, [state])

  if (state.status === 'loading') {
    return (
      <div className="mx-auto flex min-h-dvh max-w-[580px] flex-col items-center px-5 pt-16">
        <div className="size-24 animate-pulse rounded-full bg-cream-300" />
        <div className="mt-5 h-6 w-40 animate-pulse rounded-full bg-cream-300" />
        <div className="mt-3 h-4 w-60 animate-pulse rounded-full bg-cream-200" />
        <div className="mt-8 w-full space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 w-full animate-pulse rounded-full bg-cream-200" />
          ))}
        </div>
      </div>
    )
  }

  if (state.status !== 'ready') {
    return (
      <div className="grid min-h-dvh place-items-center px-5">
        <div className="card w-full max-w-md p-8 text-center sm:p-10">
          <Logo size={48} className="mx-auto" />
          <h1 className="display-md mt-6">{state.status === 'error' ? 'Couldn’t load this page' : 'This page doesn’t exist'}</h1>
          <p className="mt-3 text-ink-500">
            {state.status === 'error'
              ? 'Please check your connection and try again.'
              : `The username @${username} may have changed, or the page isn’t published yet.`}
          </p>
          <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {state.status === 'missing' && !slug && !props.username && (
              <Link to={`/signup?username=${encodeURIComponent(username)}`} className="inline-flex h-12 items-center justify-center rounded-full bg-ink px-6 text-sm font-semibold text-white">
                Claim @{username}
              </Link>
            )}
            <Link to="/" className="inline-flex h-12 items-center justify-center rounded-full border border-ink/15 bg-white px-6 text-sm font-semibold">
              Go to {APP_NAME}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const d = state.data
  return (
    <PageRenderer
      page={d.page}
      blocks={d.blocks}
      products={d.products || []}
      nav={d.nav || []}
      sitePage={d.site_page}
      base={base}
      latestReel={d.latest_reel}
      leadPopup={d.lead_popup}
    >
      {d.locked ? <MembersGate data={d} base={base} onUnlock={unlock} /> : undefined}
    </PageRenderer>
  )
}
