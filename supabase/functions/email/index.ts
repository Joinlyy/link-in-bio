// Automatic emails, sent through Brevo.
//   POST { action: 'event', kind, id }  — called by database triggers when something happens. The row is read again and each email
//        is recorded once (unique key in email_log), so a forged call can only trigger an email that should have gone out anyway.
//        kinds: 'welcome' (profile id), 'order' (order id), 'creator_payout' (payout id), 'billing_payment', 'billing_sub'
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
    if (!/^[0-9a-f-]{36}$/i.test(id) || !['welcome', 'order', 'creator_payout', 'billing_payment', 'billing_sub'].includes(String(body.kind))) throw new HttpError(400, 'Invalid event')
    await handleEvent(db, String(body.kind), id)
    return json({ ok: true })
  }
  if (body.action === 'reminders') return json({ ok: true, ...(await reminders(db)) })
  throw new HttpError(400, 'Unknown action')
}))
