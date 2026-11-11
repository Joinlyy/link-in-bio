// Signed, short-lived download link for a paid digital product. The order's access token is the credential.
// Optional product_id downloads one item of a bundle (it must be listed in the bundle's data.items).
import { adminClient, handle, HttpError, json } from '../_shared/utils.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Product = { id: string; page_id: string; type: string; data: { items?: unknown } | null; file_path: string | null; file_name: string | null }

Deno.serve(handle(async (req) => {
  const { token, product_id: itemId } = await req.json().catch(() => ({}))
  if (!token || typeof token !== 'string' || !/^[a-f0-9]{24,64}$/.test(token)) throw new HttpError(400, 'Invalid link')
  if (itemId != null && (typeof itemId !== 'string' || !UUID.test(itemId))) throw new HttpError(400, 'Invalid item')

  const admin = adminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, page_id, status, downloads, access_expires_at, products(id, page_id, type, data, file_path, file_name)')
    .eq('access_token', token)
    .maybeSingle()

  const bought = (order as { products?: Product | null } | null)?.products
  if (!order || order.status !== 'paid' || !bought) throw new HttpError(404, 'File not available')
  if (order.access_expires_at && new Date(order.access_expires_at).getTime() <= Date.now()) throw new HttpError(403, 'Your access has expired')
  if (order.downloads >= 50) throw new HttpError(429, 'Download limit reached. Please contact the creator.')

  let product: Product | null = bought
  if (itemId && itemId !== bought.id) {
    const raw = bought.data?.items
    const items = Array.isArray(raw) ? raw.map(String) : []
    if (bought.type !== 'bundle' || !items.includes(itemId)) throw new HttpError(403, 'This file is not part of your order')
    const { data: item } = await admin
      .from('products')
      .select('id, page_id, type, data, file_path, file_name')
      .eq('id', itemId)
      .eq('page_id', bought.page_id)
      .maybeSingle()
    product = item as Product | null
  }
  if (!product?.file_path) throw new HttpError(404, 'File not available')

  const { data, error } = await admin.storage
    .from('product-files')
    .createSignedUrl(product.file_path, 300, { download: product.file_name ?? true })
  if (error || !data) throw new HttpError(500, 'Could not prepare the download')

  await admin.from('orders').update({ downloads: order.downloads + 1 }).eq('id', order.id)
  return json({ url: data.signedUrl })
}))
