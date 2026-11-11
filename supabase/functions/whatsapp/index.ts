// WhatsApp alerts from the platform's own WhatsApp number (WhatsApp Cloud API).
// Secrets: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID; for delivery receipts also WHATSAPP_APP_SECRET and
// WHATSAPP_VERIFY_TOKEN; APP_ORIGIN for links. The token can be replaced at any time with
// `supabase secrets set WHATSAPP_TOKEN=…`; it's read on every request.
//
// Actions:
//   event  (from database triggers) { kind: 'order' | 'lead' | 'enquiry', id } — no secret needed:
//          the row is re-read and each alert is recorded once, so a forged call sends nothing new.
//   test   (signed-in creator) — sends a test alert to the page's alert number.
//   GET / POST without action — Meta webhook: subscription check and delivery receipts.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { adminClient, handle, HttpError, json, requireUser } from '../_shared/utils.ts'

const GRAPH = 'https://graph.facebook.com/v21.0'
const APP = (Deno.env.get('APP_ORIGIN') ?? 'https://joinlyy.com').replace(/\/$/, '')
const RECENT_MS = 30 * 60_000 // only alert about things that just happened

/** Approved message templates. Parameter order must match the template text in scripts/whatsapp-templates.mjs */
const T = {
  upi_submitted: 'creator_upi_payment',
  new_order: 'creator_new_order',
  new_lead: 'creator_new_lead',
  brand_enquiry: 'creator_brand_enquiry',
  order_confirmed: 'buyer_order_confirmed',
  payment_rejected: 'buyer_payment_rejected',
  test: 'creator_alerts_on',
} as const

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const clip = (s: unknown, n = 60) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n) || '-'

/** Indian numbers default to +91, as on the rest of the site */
function cleanPhone(raw?: string | null) {
  let p = (raw || '').replace(/[^\d+]/g, '')
  if (!p) return ''
  if (p.startsWith('+')) return p.slice(1)
  if (p.startsWith('0')) p = p.slice(1)
  return p.length === 10 ? `91${p}` : p
}

type Alert = { key: string; pageId: string; event: keyof typeof T; recipient: 'creator' | 'buyer' | 'test'; to: string; params: string[] }

async function send(db: SupabaseClient, a: Alert) {
  const to = cleanPhone(a.to)
  if (!/^\d{10,15}$/.test(to)) return
  // Claim the key first: a second call for the same event stops here
  const { error: claim } = await db.from('notifications').insert({
    key: a.key, page_id: a.pageId, event: a.event, recipient: a.recipient, phone_last4: to.slice(-4), template: T[a.event],
  })
  if (claim) return // already sent (unique key)

  const token = Deno.env.get('WHATSAPP_TOKEN')
  const phoneId = Deno.env.get('WHATSAPP_PHONE_ID')
  if (!token || !phoneId) {
    await db.from('notifications').update({ status: 'skipped', error: 'WhatsApp is not set up', updated_at: new Date().toISOString() }).eq('key', a.key)
    return
  }
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: { name: T[a.event], language: { code: 'en' }, ...(a.params.length ? { components: [{ type: 'body', parameters: a.params.map((text) => ({ type: 'text', text })) }] } : {}) },
    }),
  })
  const body = await res.json().catch(() => ({}))
  await db.from('notifications').update(
    res.ok
      ? { status: 'sent', wa_message_id: body.messages?.[0]?.id ?? null, updated_at: new Date().toISOString() }
      : { status: 'failed', error: clip(body.error?.message || `HTTP ${res.status}`, 300), updated_at: new Date().toISOString() },
  ).eq('key', a.key)
}

const recent = (ts?: string | null) => Boolean(ts) && Date.now() - new Date(ts!).getTime() < RECENT_MS

async function alertsFor(db: SupabaseClient, kind: string, id: string): Promise<Alert[]> {
  if (kind === 'order') {
    const { data: o } = await db.from('orders')
      .select('id, page_id, kind, product_title, buyer_name, buyer_email, buyer_phone, amount_inr, status, payment_provider, payment_ref, payment_submitted_at, paid_at, created_at, refund_reason, access_token, wa_updates, pages(username, display_name, alert_whatsapp, alert_on)')
      .eq('id', id).maybeSingle()
    if (!o) return []
    const page = Array.isArray(o.pages) ? o.pages[0] : o.pages
    const creator = page?.alert_on && page.alert_whatsapp ? page.alert_whatsapp : null
    const what = o.kind === 'tip' ? 'a tip' : clip(o.product_title)
    const who = clip(o.buyer_name || o.buyer_email, 40)
    const orderLink = `${APP}/order/${o.access_token}`
    const out: Alert[] = []
    if (o.payment_provider === 'upi' && o.status === 'pending' && o.payment_ref && recent(o.payment_submitted_at) && creator) {
      out.push({ key: `upi_submitted:${o.id}`, pageId: o.page_id, event: 'upi_submitted', recipient: 'creator', to: creator, params: [who, inr(o.amount_inr), what, o.payment_ref, `${APP}/dashboard/sales`] })
    }
    if (o.status === 'paid' && recent(o.paid_at)) {
      if (creator) out.push({ key: `new_order:${o.id}`, pageId: o.page_id, event: 'new_order', recipient: 'creator', to: creator, params: [who, what, inr(o.amount_inr), `${APP}/dashboard/sales`] })
      if (o.payment_provider === 'upi' && o.wa_updates && o.buyer_phone) {
        out.push({ key: `order_confirmed:${o.id}`, pageId: o.page_id, event: 'order_confirmed', recipient: 'buyer', to: o.buyer_phone, params: [clip(page?.display_name || page?.username, 40), what, orderLink] })
      }
    }
    // A rejection has no timestamp of its own; the unique key still means at most one message per order
    if (o.status === 'failed' && o.payment_provider === 'upi' && o.wa_updates && o.buyer_phone && o.payment_ref) {
      out.push({ key: `payment_rejected:${o.id}`, pageId: o.page_id, event: 'payment_rejected', recipient: 'buyer', to: o.buyer_phone, params: [clip(page?.display_name || page?.username, 40), what, orderLink] })
    }
    return out
  }
  if (kind === 'lead') {
    const { data: l } = await db.from('leads').select('id, page_id, name, email, phone, created_at, pages(alert_whatsapp, alert_on)').eq('id', id).maybeSingle()
    const page = l && (Array.isArray(l.pages) ? l.pages[0] : l.pages)
    if (!l || !recent(l.created_at) || !page?.alert_on || !page.alert_whatsapp) return []
    return [{ key: `new_lead:${l.id}`, pageId: l.page_id, event: 'new_lead', recipient: 'creator', to: page.alert_whatsapp, params: [clip(l.name || 'Someone', 40), clip(l.email || (l.phone ? `+${cleanPhone(l.phone)}` : ''), 60), `${APP}/dashboard/leads`] }]
  }
  if (kind === 'enquiry') {
    const { data: e } = await db.from('enquiries').select('id, page_id, brand_name, message, stage, created_at, pages(alert_whatsapp, alert_on)').eq('id', id).maybeSingle()
    const page = e && (Array.isArray(e.pages) ? e.pages[0] : e.pages)
    if (!e || e.stage !== 'enquiry' || !recent(e.created_at) || !page?.alert_on || !page.alert_whatsapp) return []
    return [{ key: `brand_enquiry:${e.id}`, pageId: e.page_id, event: 'brand_enquiry', recipient: 'creator', to: page.alert_whatsapp, params: [clip(e.brand_name, 40), clip(e.message, 80), `${APP}/dashboard/deals`] }]
  }
  return []
}

/** Meta's X-Hub-Signature-256 over the raw body */
async function validSignature(raw: string, header: string | null, secret: string) {
  if (!header?.startsWith('sha256=')) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)))
  const hex = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('')
  const given = header.slice(7)
  if (given.length !== hex.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i)
  return diff === 0
}

Deno.serve(handle(async (req) => {
  const url = new URL(req.url)

  // Meta webhook subscription check
  if (req.method === 'GET') {
    const verify = Deno.env.get('WHATSAPP_VERIFY_TOKEN')
    if (verify && url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === verify) {
      return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')

  const raw = await req.text()
  const db = adminClient()

  // Meta webhook: delivery receipts (sent, delivered, read, failed)
  if (req.headers.get('x-hub-signature-256')) {
    const secret = Deno.env.get('WHATSAPP_APP_SECRET')
    if (!secret) return new Response('Not configured', { status: 503 })
    if (!(await validSignature(raw, req.headers.get('x-hub-signature-256'), secret))) return new Response('Invalid signature', { status: 401 })
    const payload = JSON.parse(raw)
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const s of change.value?.statuses ?? []) {
          if (!['sent', 'delivered', 'read', 'failed'].includes(s.status)) continue
          await db.from('notifications').update({ status: s.status, error: s.errors?.[0]?.title ?? null, updated_at: new Date().toISOString() }).eq('wa_message_id', s.id)
        }
      }
    }
    return json({ ok: true })
  }

  const body = JSON.parse(raw || '{}')

  if (body.action === 'event') {
    if (!['order', 'lead', 'enquiry'].includes(body.kind) || !/^[0-9a-f-]{36}$/i.test(body.id || '')) throw new HttpError(400, 'Bad event')
    for (const a of await alertsFor(db, body.kind, body.id)) await send(db, a)
    return json({ ok: true })
  }

  if (body.action === 'test') {
    const user = await requireUser(req, db)
    const { data: page } = await db.from('pages').select('id, owner_id, alert_whatsapp').eq('id', body.page_id).maybeSingle()
    if (!page) throw new HttpError(404, 'Page not found')
    const { data: member } = await db.from('page_members').select('role').eq('page_id', page.id).eq('user_id', user.id).not('accepted_at', 'is', null).maybeSingle()
    if (page.owner_id !== user.id && !['admin', 'editor'].includes(member?.role)) throw new HttpError(403, 'Not allowed')
    if (!page.alert_whatsapp) throw new HttpError(400, 'Add your WhatsApp number first')
    const key = `test:${page.id}:${Math.floor(Date.now() / 60_000)}` // one test a minute
    await send(db, { key, pageId: page.id, event: 'test', recipient: 'test', to: page.alert_whatsapp, params: [] })
    const { data: n } = await db.from('notifications').select('status, error').eq('key', key).maybeSingle()
    if (!n) throw new HttpError(429, 'Please wait a minute before sending another test')
    return json(n)
  }

  throw new HttpError(400, 'Unknown action')
}))

