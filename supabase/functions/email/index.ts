// Automatic emails, sent through Brevo.
//   POST { action: 'event', kind, id }  — called by database triggers when something happens. The row is read again and each email
//        is recorded once (unique key in email_log), so a forged call can only trigger an email that should have gone out anyway.
//        kinds: 'welcome' (profile id), 'order' (order id), 'creator_payout' (payout id), 'billing_payment', 'billing_sub', 'lead', 'enquiry', 'post' (scheduled Instagram post)
//   POST { action: 'reminders' }        — called daily by pg_cron: plans ending in 3 days, plans that ended.
// Secrets: BREVO_API_KEY, EMAIL_FROM (+ optional EMAIL_FROM_NAME, BREVO_LIST_ID), APP_ORIGIN. See docs/EMAIL-SETUP.md.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { adminClient, handle, HttpError, json } from '../_shared/utils.ts'
import { sendEmail, syncContact } from '../_shared/email.ts'
import * as T from '../_shared/emailTemplates.ts'
import { b64, makeIcs } from '../_shared/ics.ts'

const APP = (Deno.env.get('APP_ORIGIN') ?? 'https://www.joinlyy.com').replace(/\/$/, '')
const RECENT_MS = 60 * 60_000 // only email about things that just happened
const recent = (ts?: string | null) => Boolean(ts) && Date.now() - new Date(ts!).getTime() < RECENT_MS
const dateIn = (ts: string) => new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
const first = <X>(v: X | X[] | null | undefined): X | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

/** Sends one email once. The key is claimed first, so a repeat call stops here. */
async function deliver(db: SupabaseClient, key: string, event: string, to: string | null | undefined, mail: T.Mail, attachments?: { name: string; content: string }[]) {
  if (!to) return
  const { error: claim } = await db.from('email_log').insert({ key, event, to_email: to })
  if (claim) return // already handled
  const result = await sendEmail({ to, subject: mail.subject, html: mail.html, attachments })
  await db.from('email_log').update({ status: result.split(':')[0], error: result.startsWith('sent') ? null : result.slice(0, 300) }).eq('key', key)
}

const istWhen = (ts: string) => new Date(ts).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
const urlOf = (v: unknown) => { const s = String(v ?? '').trim(); return s ? (/^https?:\/\//i.test(s) ? s : `https://${s}`) : null }

/** The time of a 1:1 session booking or a webinar that belongs to an order, if it has one */
async function scheduleFor(db: SupabaseClient, o: { id: string; product_id: string | null }) {
  const { data: pr } = o.product_id ? await db.from('products').select('type, title, data, private').eq('id', o.product_id).maybeSingle() : { data: null }
  const link = urlOf(pr?.private?.meeting_url)
  if (pr?.type === 'session') {
    const { data: b } = await db.from('bookings').select('starts_at, ends_at').eq('order_id', o.id).neq('status', 'cancelled').order('starts_at').limit(1).maybeSingle()
    if (b) return { kind: 'session' as const, start: b.starts_at as string, end: b.ends_at as string, link }
  }
  if (pr?.type === 'webinar' && pr.data?.starts_at) {
    const start = new Date(pr.data.starts_at).toISOString()
    return { kind: 'webinar' as const, start, end: new Date(Date.parse(start) + Number(pr.data.duration || 60) * 60000).toISOString(), link }
  }
  return null
}
const icsFor = (id: string, title: string, s: { start: string; end: string; link: string | null }, who: string) =>
  [{ name: 'invite.ics', content: b64(makeIcs({ uid: `${id}-${who}`, title, start: s.start, end: s.end, details: s.link ? `Join: ${s.link}` : 'Booked on Joinlyy', url: s.link || undefined })) }]

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
      .select('id, kind, product_id, product_title, buyer_name, buyer_email, buyer_phone, amount_inr, status, payment_provider, payment_ref, refund_reason, access_token, paid_at, created_at, pages(display_name, username, owner_id)')
      .eq('id', id).maybeSingle()
    if (!o) return
    const page = first(o.pages)
    const creatorName = page?.display_name || page?.username || 'the creator'
    const what = o.kind === 'tip' ? 'a tip' : o.product_title || 'your order'
    const orderUrl = `${APP}/order/${o.access_token}`
    if (o.status === 'paid' && recent(o.paid_at || o.created_at)) {
      const sch = await scheduleFor(db, o)
      const session = sch ? { kind: sch.kind, when: istWhen(sch.start), link: sch.link } : null
      await deliver(db, `order_paid:${o.id}`, 'order_paid', o.buyer_email, T.orderConfirmedBuyer({ creator: creatorName, product: what, amount: o.amount_inr, orderUrl, session }),
        sch ? icsFor(o.id, `${what} with ${creatorName}`, sch, 'buyer') : undefined)
      const { data: owner } = page?.owner_id ? await db.from('profiles').select('email').eq('id', page.owner_id).maybeSingle() : { data: null }
      await deliver(db, `order_creator:${o.id}`, 'order_creator', owner?.email, T.newOrderCreator({ buyer: o.buyer_name || o.buyer_email, product: what, amount: o.amount_inr, buyerContact: [o.buyer_email, o.buyer_phone].filter(Boolean).join(' · '), session }),
        sch ? icsFor(o.id, `${what} with ${o.buyer_name || o.buyer_email}`, sch, 'creator') : undefined)
    }
    return
  }

  // Creator alerts for leads, brand enquiries and scheduled posts. Every plan gets these by email; WhatsApp is Pro only.
  if (kind === 'lead' || kind === 'enquiry') {
    const table = kind === 'lead' ? 'leads' : 'enquiries'
    const cols = kind === 'lead' ? 'id, name, email, phone, created_at, page_id' : 'id, brand_name, message, stage, created_at, page_id'
    const { data: r } = await db.from(table).select(cols).eq('id', id).maybeSingle()
    if (!r || !recent(r.created_at) || (kind === 'enquiry' && r.stage !== 'enquiry')) return
    const { data: pg } = await db.from('pages').select('owner_id').eq('id', r.page_id).maybeSingle()
    const { data: owner } = pg?.owner_id ? await db.from('profiles').select('email').eq('id', pg.owner_id).maybeSingle() : { data: null }
    const mail = kind === 'lead'
      ? T.newContactCreator({ kind: 'lead', who: r.name || 'Someone', detail: r.email || r.phone || '', url: `${APP}/dashboard/leads` })
      : T.newContactCreator({ kind: 'brand enquiry', who: r.brand_name || 'A brand', detail: r.message || '', url: `${APP}/dashboard/deals` })
    await deliver(db, `${kind}_creator:${r.id}`, `${kind}_creator`, owner?.email, mail)
    return
  }

  if (kind === 'post') {
    const { data: sp } = await db.from('ig_scheduled_posts').select('id, owner_id, status, scheduled_at, error').eq('id', id).maybeSingle()
    if (!sp || !['published', 'failed'].includes(sp.status)) return
    const { data: owner } = await db.from('profiles').select('email').eq('id', sp.owner_id).maybeSingle()
    const when = `${new Date(sp.scheduled_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })} IST`
    await deliver(db, `post_${sp.status}:${sp.id}`, `post_${sp.status}`, owner?.email, T.postStatusCreator({ ok: sp.status === 'published', when, reason: sp.error, url: `${APP}/dashboard/schedule` }))
    return
  }

  if (kind === 'billing_payment') {
    const { data: bp } = await db.from('billing_payments')
      .select('id, user_id, status, amount_inr, base_inr, gst_inr, method, error, rzp_payment_id, period_end, billing_subscriptions(plan, period)').eq('id', id).maybeSingle()
    if (!bp) return
    const sub = first(bp.billing_subscriptions)
    const { data: u } = await db.from('profiles').select('email').eq('id', bp.user_id).maybeSingle()
    if (!u?.email || !sub) return
    const name = await planName(db, sub.plan)
    if (bp.status === 'captured') {
      await deliver(db, `bill_receipt:${bp.id}`, 'bill_receipt', u.email, T.subscriptionReceipt({
        plan: name, period: sub.period, base: Number(bp.base_inr), gst: Number(bp.gst_inr), total: Number(bp.amount_inr),
        until: bp.period_end ? dateIn(bp.period_end) : null, paymentId: bp.rzp_payment_id, method: bp.method,
      }))
      await syncContact(u.email, { PLAN: sub.plan })
    } else if (bp.status === 'failed') {
      await deliver(db, `bill_failed:${bp.id}`, 'bill_failed', u.email, T.renewalFailed({ plan: name, total: Number(bp.amount_inr), reason: bp.error }))
    }
    return
  }

  if (kind === 'creator_payout') {
    const { data: cp } = await db.from('creator_payouts').select('id, user_id, amount_inr, upi_id, reference, created_at').eq('id', id).maybeSingle()
    if (!cp) return
    const { data: u } = await db.from('profiles').select('email').eq('id', cp.user_id).maybeSingle()
    if (!u?.email) return
    await deliver(db, `payout:${cp.id}`, 'creator_payout', u.email, T.payoutSent({ amount: Number(cp.amount_inr), upi: cp.upi_id, reference: cp.reference }))
    return
  }

  if (kind === 'billing_sub') {
    const { data: bs } = await db.from('billing_subscriptions').select('id, user_id, plan, status, current_end').eq('id', id).maybeSingle()
    if (!bs) return
    const { data: u } = await db.from('profiles').select('email').eq('id', bs.user_id).maybeSingle()
    if (!u?.email) return
    const name = await planName(db, bs.plan)
    const until = bs.current_end ? dateIn(bs.current_end) : null
    if (bs.status === 'cancelled') await deliver(db, `sub_cancelled:${bs.id}`, 'sub_cancelled', u.email, T.subscriptionCancelled({ plan: name, until }))
    if (bs.status === 'halted') await deliver(db, `sub_halted:${bs.id}`, 'sub_halted', u.email, T.autoRenewStopped({ plan: name, until }))
    return
  }
}

/** Days between two dates in India time: today minus the plan's last day (negative before it ends) */
const istDay = (ts: number) => new Date(ts + 5.5 * 3600_000).toISOString().slice(0, 10)
const dayDiff = (endTs: number, nowTs: number) => Math.round((Date.parse(istDay(nowTs)) - Date.parse(istDay(endTs))) / 86400_000)
const STAGES: Record<number, string> = { [-3]: 'before3', 0: 'day0', 1: 'after1', 2: 'after2', 3: 'after3', 7: 'after7', 10: 'after10' }

/**
 * Plan-end reminders: 3 days before, on the last day, then 1, 2, 3, 7 and 10 days after it ended. Each is sent once per plan end date.
 * Plans that renew by themselves (an active Razorpay subscription with auto-renew on) get none of them.
 */
async function reminders(db: SupabaseClient) {
  const now = Date.now()
  const { data: due } = await db.from('profiles').select('id, email, plan, plan_expires_at')
    .neq('plan', 'free').gt('plan_expires_at', new Date(now - 11 * 86400_000).toISOString()).lt('plan_expires_at', new Date(now + 4 * 86400_000).toISOString())
  let sent = 0
  for (const u of due ?? []) {
    const stage = STAGES[dayDiff(Date.parse(u.plan_expires_at), now)]
    if (!stage || !u.email) continue
    const { data: auto } = await db.from('billing_subscriptions').select('id').eq('user_id', u.id).eq('status', 'active').eq('cancel_at_cycle_end', false).limit(1)
    if (auto?.length) continue
    await deliver(db, `plan_end:${u.id}:${u.plan_expires_at.slice(0, 10)}:${stage}`, 'plan_end', u.email, T.planReminder(stage, { plan: await planName(db, u.plan), until: dateIn(u.plan_expires_at) }))
    sent++
    if (stage === 'after1') await syncContact(u.email, { PLAN: 'expired' })
  }
  return { checked: due?.length ?? 0, stages: sent }
}

/**
 * Reminders for sessions and webinars: 24 hours before and 1 hour before, to the buyer and to the creator. Runs every 10 minutes;
 * each one is sent once (email_log key). A booking made less than 3 hours ahead gets no 24-hour reminder.
 */
async function sessionReminders(db: SupabaseClient) {
  const now = Date.now()
  let sent = 0
  type Item = { id: string; product: string; start: string; link: string | null; buyers: { email: string; name: string | null; key: string }[]; ownerId: string }
  const items: Item[] = []
  const { data: bks } = await db.from('bookings')
    .select('id, order_id, starts_at, buyer_name, buyer_email, status, products(title, private), pages(owner_id)')
    .eq('status', 'confirmed').gt('starts_at', new Date(now).toISOString()).lt('starts_at', new Date(now + 25 * 3600_000).toISOString())
  for (const b of bks ?? []) {
    const pr = first(b.products)
    const pg = first(b.pages)
    if (!pg) continue
    items.push({ id: `bk:${b.id}`, product: pr?.title || 'Your session', start: b.starts_at, link: urlOf(pr?.private?.meeting_url), buyers: [{ email: b.buyer_email, name: b.buyer_name, key: b.id }], ownerId: pg.owner_id })
  }
  const { data: wps } = await db.from('products').select('id, title, data, private, page_id, pages(owner_id)').eq('type', 'webinar')
  for (const p of wps ?? []) {
    const st = p.data?.starts_at ? Date.parse(p.data.starts_at) : 0
    if (!st || st <= now || st > now + 25 * 3600_000) continue
    const { data: ords } = await db.from('orders').select('id, buyer_email, buyer_name').eq('product_id', p.id).eq('status', 'paid')
    const pg = first(p.pages)
    if (!ords?.length || !pg) continue
    items.push({ id: `wb:${p.id}`, product: p.title, start: new Date(st).toISOString(), link: urlOf(p.private?.meeting_url), buyers: ords.map((x) => ({ email: x.buyer_email, name: x.buyer_name, key: x.id })), ownerId: pg.owner_id })
  }
  for (const it of items) {
    const diff = Date.parse(it.start) - now
    const stage = diff <= 70 * 60_000 ? 1 : diff > 3 * 3600_000 && diff <= 24 * 3600_000 + 10 * 60_000 ? 24 : 0
    if (!stage) continue
    const when = istWhen(it.start)
    const { data: owner } = await db.from('profiles').select('email').eq('id', it.ownerId).maybeSingle()
    for (const by of it.buyers) {
      await deliver(db, `rem${stage}:${it.id}:buyer:${by.key}`, `session_reminder_${stage}`, by.email, T.sessionReminder({ who: 'buyer', hours: stage, product: it.product, when, link: it.link, other: 'your host', url: APP }))
      sent++
    }
    const names = it.buyers.map((b) => b.name || b.email).join(', ')
    await deliver(db, `rem${stage}:${it.id}:creator`, `session_reminder_${stage}`, owner?.email, T.sessionReminder({ who: 'creator', hours: stage, product: it.product, when, link: it.link, other: names, url: `${APP}/dashboard/sales` }))
    sent++
  }
  return { checked: items.length, sent }
}

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
function sameSecret(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(handle(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
  if (!sameSecret(req.headers.get('x-cron-secret') ?? '', CRON_SECRET)) throw new HttpError(401, 'Unauthorized')
  const body = await req.json().catch(() => ({}))
  const db = adminClient()
  if (body.action === 'event') {
    const id = String(body.id ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(id) || !['welcome', 'order', 'creator_payout', 'billing_payment', 'billing_sub', 'lead', 'enquiry', 'post'].includes(String(body.kind))) throw new HttpError(400, 'Invalid event')
    await handleEvent(db, String(body.kind), id)
    return json({ ok: true })
  }
  if (body.action === 'reminders') return json({ ok: true, ...(await reminders(db)) })
  if (body.action === 'session_reminders') return json({ ok: true, ...(await sessionReminders(db)) })
  throw new HttpError(400, 'Unknown action')
}))
