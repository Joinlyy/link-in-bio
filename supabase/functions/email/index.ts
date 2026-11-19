// Automatic emails, sent through Brevo.
//   POST { action: 'event', kind, id }  — called by database triggers when something happens. The row is read again and each email
//        is recorded once (unique key in email_log), so a forged call can only trigger an email that should have gone out anyway.
//        kinds: 'welcome' (profile id), 'order' (order id), 'plan_payment' (plan payment id)
//   POST { action: 'reminders' }        — called daily by pg_cron: plans ending in 3 days, plans that ended.
// Secrets: BREVO_API_KEY, EMAIL_FROM (+ optional EMAIL_FROM_NAME, BREVO_LIST_ID), APP_ORIGIN. See docs/EMAIL-SETUP.md.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { adminClient, handle, HttpError, json } from '../_shared/utils.ts'
import { sendEmail, syncContact } from '../_shared/email.ts'
import * as T from '../_shared/emailTemplates.ts'

const APP = (Deno.env.get('APP_ORIGIN') ?? 'https://www.joinlyy.com').replace(/\/$/, '')
const RECENT_MS = 60 * 60_000 // only email about things that just happened
const recent = (ts?: string | null) => Boolean(ts) && Date.now() - new Date(ts!).getTime() < RECENT_MS
const dateIn = (ts: string) => new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
const first = <X>(v: X | X[] | null | undefined): X | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

/** Sends one email once. The key is claimed first, so a repeat call stops here. */
async function deliver(db: SupabaseClient, key: string, event: string, to: string | null | undefined, mail: T.Mail) {
  if (!to) return
  const { error: claim } = await db.from('email_log').insert({ key, event, to_email: to })
  if (claim) return // already handled
  const result = await sendEmail({ to, subject: mail.subject, html: mail.html })
  await db.from('email_log').update({ status: result.split(':')[0], error: result.startsWith('sent') ? null : result.slice(0, 300) }).eq('key', key)
}

async function planName(db: SupabaseClient, id: string) {
  const { data } = await db.from('plans').select('name').eq('id', id).maybeSingle()
  return data?.name || id
}

async function handleEvent(db: SupabaseClient, kind: string, id: string) {
  if (kind === 'welcome') {
    const { data: p } = await db.from('profiles').select('id, email, full_name, role, plan, created_at').eq('id', id).maybeSingle()
    if (!p || p.role !== 'creator' || !p.email || !recent(p.created_at)) return
    await deliver(db, `welcome:${p.id}`, 'welcome', p.email, T.welcome(p.full_name || ''))
    await syncContact(p.email, { FIRSTNAME: (p.full_name || '').split(' ')[0] || '', PLAN: p.plan || 'free', SOURCE: 'joinlyy-signup' })
    return
  }

  if (kind === 'order') {
    const { data: o } = await db.from('orders')
      .select('id, kind, product_title, buyer_name, buyer_email, amount_inr, status, payment_provider, payment_ref, refund_reason, access_token, paid_at, created_at, pages(display_name, username, owner_id)')
      .eq('id', id).maybeSingle()
    if (!o) return
    const page = first(o.pages)
    const creatorName = page?.display_name || page?.username || 'the creator'
    const what = o.kind === 'tip' ? 'a tip' : o.product_title || 'your order'
    const orderUrl = `${APP}/order/${o.access_token}`
    if (o.status === 'paid' && recent(o.paid_at || o.created_at)) {
      await deliver(db, `order_paid:${o.id}`, 'order_paid', o.buyer_email, T.orderConfirmedBuyer({ creator: creatorName, product: what, amount: o.amount_inr, orderUrl }))
      const { data: owner } = page?.owner_id ? await db.from('profiles').select('email').eq('id', page.owner_id).maybeSingle() : { data: null }
      await deliver(db, `order_creator:${o.id}`, 'order_creator', owner?.email, T.newOrderCreator({ buyer: o.buyer_name || o.buyer_email, product: what, amount: o.amount_inr }))
    }
    // A UPI payment the creator could not find
    if (o.status === 'failed' && o.payment_provider === 'upi' && o.payment_ref) {
      await deliver(db, `payment_rejected:${o.id}`, 'payment_rejected', o.buyer_email, T.paymentRejectedBuyer({ creator: creatorName, product: what, orderUrl, reason: o.refund_reason || undefined }))
    }
    return
  }

  if (kind === 'plan_payment') {
    const { data: pp } = await db.from('plan_payments').select('id, user_id, plan, status, note, decided_at').eq('id', id).maybeSingle()
    if (!pp || !['approved', 'rejected'].includes(pp.status) || !recent(pp.decided_at)) return
    const { data: u } = await db.from('profiles').select('email, plan_expires_at, full_name, plan').eq('id', pp.user_id).maybeSingle()
    if (!u?.email) return
    const name = await planName(db, pp.plan)
    if (pp.status === 'approved') {
      await deliver(db, `plan_approved:${pp.id}`, 'plan_approved', u.email, T.planApproved({ plan: name, until: u.plan_expires_at ? dateIn(u.plan_expires_at) : null }))
      await syncContact(u.email, { PLAN: pp.plan })
    } else {
      await deliver(db, `plan_rejected:${pp.id}`, 'plan_rejected', u.email, T.planRejected({ plan: name, note: pp.note || undefined }))
    }
  }
}

/** Plans ending within 3 days, and plans that ended in the last 2 days (each email once per plan end date) */
async function reminders(db: SupabaseClient) {
  const now = Date.now()
  const { data: soon } = await db.from('profiles').select('id, email, plan, plan_expires_at')
    .neq('plan', 'free').gt('plan_expires_at', new Date(now).toISOString()).lt('plan_expires_at', new Date(now + 3 * 86400_000).toISOString())
  for (const u of soon ?? []) {
    const days = Math.max(1, Math.ceil((new Date(u.plan_expires_at).getTime() - now) / 86400_000))
    await deliver(db, `plan_expiring:${u.id}:${u.plan_expires_at.slice(0, 10)}`, 'plan_expiring', u.email, T.planExpiring({ plan: await planName(db, u.plan), until: dateIn(u.plan_expires_at), days }))
  }
  const { data: ended } = await db.from('profiles').select('id, email, plan, plan_expires_at')
    .neq('plan', 'free').lt('plan_expires_at', new Date(now).toISOString()).gt('plan_expires_at', new Date(now - 2 * 86400_000).toISOString())
  for (const u of ended ?? []) {
    await deliver(db, `plan_expired:${u.id}:${u.plan_expires_at.slice(0, 10)}`, 'plan_expired', u.email, T.planExpired({ plan: await planName(db, u.plan) }))
    await syncContact(u.email, { PLAN: 'expired' })
  }
  return { expiring: soon?.length ?? 0, ended: ended?.length ?? 0 }
}

Deno.serve(handle(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
  const body = await req.json().catch(() => ({}))
  const db = adminClient()
  if (body.action === 'event') {
    const id = String(body.id ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(id) || !['welcome', 'order', 'plan_payment'].includes(String(body.kind))) throw new HttpError(400, 'Invalid event')
    await handleEvent(db, String(body.kind), id)
    return json({ ok: true })
  }
  if (body.action === 'reminders') return json({ ok: true, ...(await reminders(db)) })
  throw new HttpError(400, 'Unknown action')
}))
