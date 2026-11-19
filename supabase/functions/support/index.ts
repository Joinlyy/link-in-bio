// Buyer support tickets for the platform admin.
//   POST { token, category, message }  (buyer: the order's access token is the credential)
//        creates a ticket on that order and alerts the admin by email and/or WhatsApp.
//   POST { action: 'reply', id }       (signed-in admin with two-step login)
//        emails the admin's reply on a ticket to the buyer.
// Secrets: APP_ORIGIN; for email BREVO_API_KEY and EMAIL_FROM (see _shared/email.ts);
//          for WhatsApp WHATSAPP_TOKEN, WHATSAPP_PHONE_ID (template `admin_support_ticket`, see scripts/whatsapp-templates.mjs).
// If neither alert channel works the ticket still lands in the admin inbox; each result is stored on the ticket.
import { adminClient, handle, HttpError, json, requireUser } from '../_shared/utils.ts'
import { sendEmail } from '../_shared/email.ts'

const APP = (Deno.env.get('APP_ORIGIN') ?? 'https://joinlyy.com').replace(/\/$/, '')
const GRAPH = 'https://graph.facebook.com/v21.0'
const CATEGORIES: Record<string, string> = {
  payment_failed: 'Payment failed or pending',
  not_received: 'Did not receive the product',
  refund: 'Refund request',
  creator_issue: 'Problem with the creator',
  other: 'Something else',
}
const clip = (s: unknown, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

async function sendWhatsapp(to: string, params: string[]): Promise<string> {
  const token = Deno.env.get('WHATSAPP_TOKEN')
  const phoneId = Deno.env.get('WHATSAPP_PHONE_ID')
  if (!token || !phoneId) return 'skipped: WhatsApp is not set up'
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to, type: 'template',
      template: { name: 'admin_support_ticket', language: { code: 'en' }, components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }] },
    }),
  })
  if (res.ok) return 'sent'
  const body = await res.json().catch(() => ({}))
  return `failed: ${clip(body.error?.message || `HTTP ${res.status}`, 120)}`
}

Deno.serve(handle(async (req) => {
  const body = await req.json().catch(() => ({}))
  const db = adminClient()

  // ---- admin: email the reply to the buyer ----
  if (body.action === 'reply') {
    const user = await requireUser(req, db)
    const { data: me } = await db.from('profiles').select('role, status').eq('id', user.id).maybeSingle()
    if (me?.role !== 'admin' || me.status !== 'active') throw new HttpError(403, 'Not allowed')
    const { data: t } = await db.from('support_tickets').select('id, ticket_no, buyer_email, admin_reply, orders(access_token)').eq('id', String(body.id)).maybeSingle()
    if (!t?.admin_reply) throw new HttpError(400, 'Write a reply first')
    const order = Array.isArray(t.orders) ? t.orders[0] : t.orders
    const result = await sendEmail({
      to: t.buyer_email,
      subject: `Re: your support request #${t.ticket_no}`,
      html: `<p>${esc(t.admin_reply).replace(/\n/g, '<br>')}</p><p><a href="${APP}/order/${order?.access_token}">Open your order</a></p>`,
    })
    return json({ email: result })
  }

  // ---- buyer: new ticket ----
  const token = String(body.token ?? '')
  if (!/^[a-f0-9]{24,64}$/.test(token)) throw new HttpError(400, 'Invalid link')
  const category = String(body.category ?? '')
  if (!CATEGORIES[category]) throw new HttpError(400, 'Choose what the problem is')
  const message = String(body.message ?? '').trim()
  if (message.length < 5) throw new HttpError(400, 'Tell us a little more about the problem')
  if (message.length > 1500) throw new HttpError(400, 'Please keep the message under 1,500 characters')

  const { data: order } = await db.from('orders').select('id, page_id, buyer_email, buyer_name, buyer_phone, status, product_title, amount_inr').eq('access_token', token).maybeSingle()
  if (!order) throw new HttpError(404, 'Order not found')

  const hourAgo = new Date(Date.now() - 3600_000).toISOString()
  const { count: recent } = await db.from('support_tickets').select('id', { count: 'exact', head: true }).eq('order_id', order.id).gt('created_at', hourAgo)
  if ((recent ?? 0) >= 3) throw new HttpError(429, 'You have already sent a few messages. We will get back to you soon.')
  const { count: open } = await db.from('support_tickets').select('id', { count: 'exact', head: true }).eq('order_id', order.id).neq('status', 'resolved')
  if ((open ?? 0) >= 5) throw new HttpError(429, 'You already have several open requests for this order. We are on it.')

  const priority = category === 'payment_failed' || category === 'not_received' || ['failed', 'pending'].includes(order.status) ? 'high' : 'normal'
  const { data: ticket, error } = await db.from('support_tickets').insert({
    order_id: order.id, page_id: order.page_id, buyer_email: order.buyer_email, buyer_name: order.buyer_name, buyer_phone: order.buyer_phone,
    category, message, priority,
  }).select('id, ticket_no').single()
  if (error || !ticket) throw error ?? new Error('insert failed')

  // ---- alert the admin: every channel that is set up, never blocking the buyer ----
  const { data: s } = await db.from('app_settings').select('support_email, support_whatsapp').eq('id', true).maybeSingle()
  const label = CATEGORIES[category]
  const link = `${APP}/admin/support`
  const notified: Record<string, string> = {}
  const jobs: Promise<void>[] = []
  if (s?.support_email) {
    jobs.push(sendEmail({
      to: s.support_email,
      subject: `${priority === 'high' ? '[High] ' : ''}Support #${ticket.ticket_no}: ${label}`,
      html: `<p><b>${esc(label)}</b> (${priority} priority)</p><p>Order: ${esc(clip(order.product_title, 80))}, ₹${order.amount_inr}, ${esc(order.status)}<br>Buyer: ${esc(order.buyer_email)}</p><p>${esc(clip(message, 600))}</p><p><a href="${link}">Open in admin</a></p>`,
      replyTo: order.buyer_email,
    })
      .then((r) => { notified.email = r }, (e) => { notified.email = `failed: ${clip(e?.message, 80)}` }))
  }
  if (s?.support_whatsapp) {
    jobs.push(sendWhatsapp(s.support_whatsapp, [String(ticket.ticket_no), label, clip(order.buyer_email, 60), link])
      .then((r) => { notified.whatsapp = r }, (e) => { notified.whatsapp = `failed: ${clip(e?.message, 80)}` }))
  }
  if (!jobs.length) notified.none = 'no alert contact set in admin'
  await Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, 15000))])
  await db.from('support_tickets').update({ notified }).eq('id', ticket.id)

  return json({ ok: true, ticket_no: ticket.ticket_no })
}, { anyOrigin: true })) // order pages can be on a creator's own domain; the token is the credential
