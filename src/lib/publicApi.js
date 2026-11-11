// Lightweight REST calls used by public creator pages.
// Deliberately avoids supabase-js so the public bundle stays tiny for millions of visitors.
import { SUPABASE_KEY, SUPABASE_URL } from './config'

const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }

async function readError(res) {
  const body = await res.json().catch(() => ({}))
  return new Error(body.message || body.error || 'Request failed')
}

async function rpcGet(fn, params) {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}?${qs}`, { headers })
  if (!res.ok) throw await readError(res)
  return res.json()
}

async function rpcPost(fn, body, { keepalive = false } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    keepalive,
  })
  if (!res.ok) throw await readError(res)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

const pageCache = new Map()

export async function fetchPublicPage(username, slug = null) {
  const key = `${username.toLowerCase()}/${slug || ''}`
  if (pageCache.has(key)) return pageCache.get(key)
  const params = { p_username: username.toLowerCase() }
  if (slug) params.p_slug = slug.toLowerCase()
  const data = await rpcGet('get_public_page', params)
  if (data) pageCache.set(key, data)
  return data
}

/** Members-only sub-page, unlocked with a paid membership order token */
export const fetchMemberPage = (username, slug, token) =>
  rpcGet('get_member_page', { p_username: username.toLowerCase(), p_slug: slug.toLowerCase(), p_token: token })

/** Username for a creator's connected custom domain (null if none / not active) */
export const fetchUsernameForDomain = (host) => rpcGet('get_page_by_domain', { p_host: host.toLowerCase() })

export const fetchMediaKit = (username) => rpcGet('get_media_kit', { p_username: username.toLowerCase() })
export const fetchProduct = (username, id) => rpcGet('get_public_product', { p_username: username.toLowerCase(), p_product_id: id })
export const fetchOrder = (token) => rpcGet('get_order', { p_token: token })

export const submitLead = (payload) => rpcPost('submit_lead', payload)
export const submitEnquiry = (payload) => rpcPost('submit_enquiry', payload)
export const reportPage = (payload) => rpcPost('report_page', payload)
export const checkCoupon = (payload) => rpcGet('coupon_discount', payload)
// The server decides: the creator's own UPI, test mode, or not yet
export const checkoutOrder = (payload) => rpcPost('checkout_order', payload)
export const checkoutTip = (payload) => rpcPost('checkout_tip', payload)
export const fetchPaymentMode = (pageId) => rpcGet('page_payment_mode', { p_page_id: pageId })
export const fetchUpiPayment = (token) => rpcGet('get_upi_payment', { p_token: token })
export const submitUpiReference = (token, utr) => rpcPost('submit_upi_reference', { p_token: token, p_utr: utr })
export const bookSession = (token, slot) => rpcPost('book_session', { p_token: token, p_slot: slot })
export const rescheduleBooking = (token, bookingId, slot) => rpcPost('reschedule_booking', { p_token: token, p_booking_id: bookingId, p_slot: slot })
export const acceptUpsell = (token) => rpcPost('accept_upsell', { p_token: token })
export const openDispute = (token, reason, details) => rpcPost('open_dispute', { p_token: token, p_reason: reason, p_details: details })

export function sendEvent(payload) {
  return rpcPost('track_event', payload, { keepalive: true }).catch(() => {})
}

/** Signed, short-lived download URL for a paid digital product (productId for items inside a bundle) */
export async function getDownloadUrl(token, productId = null) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/download`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ token, product_id: productId }),
  })
  if (!res.ok) throw await readError(res)
  return (await res.json()).url
}
