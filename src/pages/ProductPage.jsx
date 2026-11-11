import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProduct } from '../lib/publicApi'
import { optimizedImage } from '../lib/images'
import { backgroundCss, ensureFont, resolveTheme } from '../lib/themes'
import { trackProductView } from '../lib/analytics'
import { Avatar } from '../components/page/PageRenderer'
import { Logo } from '../components/icons'
import { BuyBox, ProductInfo } from '../components/order/ProductPanel'

/**
 * Public product page. On custom domains the router passes `username` and `basePath=''`;
 * on the main site it reads `:username` from the URL and links back to `/${username}`.
 */
export default function ProductPage({ username: usernameProp, basePath }) {
  const params = useParams()
  const username = usernameProp || params.username
  const productId = params.productId
  const base = basePath ?? `/${username}`
  const [state, setState] = useState({ status: 'loading' })
  const tracked = useRef(null)

  const load = useCallback(() => {
    fetchProduct(username, productId)
      .then((data) => setState(data ? { status: 'ready', data } : { status: 'missing' }))
      .catch(() => setState({ status: 'missing' }))
  }, [username, productId])

  useEffect(() => {
    load()
  }, [load])

  const theme = resolveTheme(state.data?.page?.theme)
  useEffect(() => {
    ensureFont(theme.headingFont)
    if (state.status !== 'ready') return
    const { page, product } = state.data
    document.title = `${product.title} · ${page.display_name || username}`
    if (tracked.current === product.id) return // once per product (also guards StrictMode / refetches)
    tracked.current = product.id
    trackProductView(page.id, product.id)
  }, [state, theme.headingFont, username])

  if (state.status === 'loading') return <div className="mx-auto mt-16 h-96 max-w-3xl animate-pulse rounded-3xl bg-cream-200" />
  if (state.status === 'missing') {
    return (
      <div className="grid min-h-dvh place-items-center px-4 text-center">
        <div>
          <Logo size={48} className="mx-auto" />
          <h1 className="display-md mt-6">Product not available</h1>
          <Link to={base || '/'} className="mt-6 inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white">Back to @{username}</Link>
        </div>
      </div>
    )
  }

  const { page, product, booked, seats_left: seatsLeft } = state.data
  const stockLeft = product.stock_left
  return (
    <div className="min-h-dvh px-4 py-6 sm:py-10" style={{ background: backgroundCss(theme) }}>
      <div className="mx-auto max-w-5xl">
        <Link to={base || '/'} className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full bg-white/90 py-1.5 pr-4 pl-1.5 text-sm font-semibold text-ink shadow-soft backdrop-blur">
          <Avatar page={page} size={30} theme={theme} />
          <span className="truncate">{page.display_name || `@${page.username}`}</span>
        </Link>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <article className="card min-w-0 overflow-hidden">
            {product.thumbnail_url && <img src={optimizedImage(product.thumbnail_url, 1200)} alt="" className="aspect-[16/9] w-full object-cover" />}
            <div className="p-6 sm:p-9">
              <ProductInfo product={product} theme={theme} seatsLeft={seatsLeft} stockLeft={stockLeft} />
            </div>
          </article>
          <aside className="card h-fit min-w-0 p-6 lg:sticky lg:top-6">
            <BuyBox product={product} page={page} booked={booked} seatsLeft={seatsLeft} stockLeft={stockLeft} onReload={load} />
          </aside>
        </div>
      </div>
    </div>
  )
}
