import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { fetchProduct } from '../../lib/publicApi'
import { trackProductView } from '../../lib/analytics'
import { normalizeUrl } from '../../lib/embeds'
import { optimizedImage } from '../../lib/images'
import { resolveTheme } from '../../lib/themes'
import { BuyBox, ProductInfo } from '../order/ProductPanel'
import { RichText } from '../order/shared'
import { ArrowUpRightIcon } from '../icons'
import Sheet from './Sheet'

const OrderView = lazy(() => import('../../pages/OrderPage').then((m) => ({ default: m.OrderView })))

/** Product details and checkout, then the buyer's download / booking, all without leaving the page */
function ProductModal({ page, productId, previewProduct, onClose }) {
  const preview = Boolean(previewProduct)
  const [state, setState] = useState(preview ? { status: 'ready', data: { product: previewProduct, booked: [], seats_left: null } } : { status: 'loading' })
  const [token, setToken] = useState(null)
  const tracked = useRef(false)

  const load = useCallback(() => {
    if (preview) return
    fetchProduct(page.username, productId)
      .then((data) => setState(data ? { status: 'ready', data } : { status: 'missing' }))
      .catch(() => setState({ status: 'missing' }))
  }, [preview, page.username, productId])

  useEffect(load, [load])
  useEffect(() => {
    if (state.status === 'ready' && !preview && !tracked.current) {
      tracked.current = true
      trackProductView(page.id, productId)
    }
  }, [state.status, preview, page.id, productId])

  const product = state.data?.product
  if (token) {
    return (
      <Sheet title={product?.title || 'Your order'} hideTitle wide onClose={onClose}>
        <Suspense fallback={<div className="h-60 animate-pulse rounded-3xl bg-cream" />}>
          <OrderView key={token} token={token} embedded />
        </Suspense>
      </Sheet>
    )
  }
  if (state.status !== 'ready') {
    return (
      <Sheet title="Details" hideTitle onClose={onClose}>
        {state.status === 'loading' ? <div className="h-60 animate-pulse rounded-3xl bg-cream" /> : <p className="py-8 text-center font-semibold">This isn’t available right now.</p>}
      </Sheet>
    )
  }
  const { booked, seats_left: seatsLeft } = state.data
  return (
    <Sheet title={product.title} hideTitle xl onClose={onClose}>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          {product.thumbnail_url && <img src={optimizedImage(product.thumbnail_url, 1000)} alt="" className="mb-5 aspect-[16/9] w-full rounded-2xl object-cover" />}
          <ProductInfo product={product} theme={resolveTheme(page.theme)} seatsLeft={seatsLeft} stockLeft={product.stock_left} />
        </div>
        <div className="min-w-0 rounded-3xl bg-cream p-5 md:self-start">
          <BuyBox product={product} page={page} booked={booked} seatsLeft={seatsLeft} stockLeft={product.stock_left} onReload={load} onOrdered={setToken} preview={preview} />
        </div>
      </div>
    </Sheet>
  )
}

/** Details popup for a card */
function CardModal({ item, onClose }) {
  const url = item.url && normalizeUrl(item.url)
  return (
    <Sheet title={item.title} hideTitle wide onClose={onClose}>
      {item.image && <img src={optimizedImage(item.image, 1000)} alt="" className="mb-5 aspect-[16/9] w-full rounded-2xl object-cover" />}
      <h2 className="font-display text-2xl font-bold tracking-tight">{item.title}</h2>
      {item.price && <p className="mt-1 text-lg font-bold">{item.price}</p>}
      {(item.details || item.text) && <RichText text={item.details || item.text} className="mt-3 text-[15px] leading-relaxed text-ink-700" />}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-white">
          {item.button || 'Continue'} <ArrowUpRightIcon size={16} />
        </a>
      )}
    </Sheet>
  )
}

/** `id` is a product id, or "<block id>.<card index>" for a card's details */
export default function ItemModal({ id, page, blocks, products, preview, onClose }) {
  if (id.includes('.')) {
    const [blockId, index] = id.split('.')
    const item = blocks.find((b) => b.id === blockId)?.data?.items?.[Number(index)]
    return item ? <CardModal item={item} onClose={onClose} /> : null
  }
  const previewProduct = preview ? products.find((p) => p.id === id) : null
  if (preview && !previewProduct) return null
  return <ProductModal key={id} page={page} productId={id} previewProduct={previewProduct} onClose={onClose} />
}
