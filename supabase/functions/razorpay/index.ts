// Razorpay subscriptions: creators pay Joinlyy for the Creator and Pro plans (price + 18% GST), with auto-renew.
//
// Browser actions (signed-in creator):
//   config               public: is Razorpay on, the public key id, test or live
//   create_subscription  { plan, period }   creates the subscription at Razorpay and returns what Checkout needs
//   verify               { subscription_id, payment_id, signature }   after Checkout: checks the signature, then asks Razorpay for the truth
//   cancel               stops auto-renew at the end of the paid period (the plan runs until then)
// Razorpay:
//   webhook              POST with header x-razorpay-signature (HMAC of the raw body with RAZORPAY_WEBHOOK_SECRET)
// Cron / admin:
//   reconcile            every 10 min: checks stuck or stale subscriptions against Razorpay, retries failed events
//   test_connection, sync_plans, replay_event, resync_subscription   admin only
//
// Rules this file keeps (see docs/RAZORPAY.md):
//   1. A payment counts only from Razorpay's signed webhook or Razorpay's own API, never from the browser.
//   2. Each payment id is applied once (database function billing_apply_charge); the amount must equal the quoted price.
//   3. A paid plan is never taken away by a late or repeated message; plans end on their end date.
// Secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, CRON_SECRET, APP_ORIGIN
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { adminClient, handle, HttpError, json, requireUser } from '../_shared/utils.ts'
import { sendEmail } from '../_shared/email.ts'

const KEY_ID = Deno.env.get('RAZORPAY_KEY_ID') ?? ''
const KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') ?? ''
const WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const APP = (Deno.env.get('APP_ORIGIN') ?? 'https://www.joinlyy.com').replace(/\/$/, '')
const MODE: 'test' | 'live' = KEY_ID.startsWith('rzp_live_') ? 'live' : 'test'
const GST_RATE = 0.18
const round2 = (n: number) => Math.round(n * 100) / 100

// ---------- small helpers ----------
const enc = new TextEncoder()
async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
  return [...mac].map((b) => b.toString(16).padStart(2, '0')).join('')
}
function sameText(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
const iso = (epoch?: number | null) => (epoch ? new Date(epoch * 1000).toISOString() : null)

// deno-lint-ignore no-explicit-any
type Json = any

async function rzp(path: string, method = 'GET', body?: unknown): Promise<Json> {
  if (!KEY_ID || !KEY_SECRET) throw new HttpError(503, 'Razorpay is not set up yet')
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${btoa(`${KEY_ID}:${KEY_SECRET}`)}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Razorpay: ${data?.error?.description || `HTTP ${res.status}`}`)
  return data
}

async function requireAdmin(req: Request, db: SupabaseClient) {
  const user = await requireUser(req, db)
  const { data: me } = await db.from('profiles').select('role, status').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin' || me.status !== 'active') throw new HttpError(403, 'Not allowed')
  return user
}

/** Tell the admin about something that needs a look (best effort) */
async function alertAdmin(db: SupabaseClient, subject: string, text: string) {
  const { data: s } = await db.from('app_settings').select('support_email').eq('id', true).maybeSingle()
  if (!s?.support_email) return
  await sendEmail({ to: s.support_email, subject: `[Razorpay] ${subject}`, html: `<p>${text.replace(/</g, '&lt;')}</p><p><a href="${APP}/admin/razorpay">Open the Razorpay page in admin</a></p>` })
}

async function raiseIssue(db: SupabaseClient, kind: string, severity: string, row: { id?: string; user_id?: string } | null, paymentId: string | null, details: Json) {
  const { error } = await db.from('billing_issues').insert({ kind, severity, user_id: row?.user_id ?? null, subscription_id: row?.id ?? null, rzp_payment_id: paymentId, details })
  if (!error) await alertAdmin(db, `${kind.replace(/_/g, ' ')}`, `${kind} (${severity}). ${JSON.stringify(details).slice(0, 400)}`)
}

// ---------- Razorpay plans for our prices ----------
async function ensureRazorpayPlan(db: SupabaseClient, planId: string, planName: string, period: 'month' | 'year', paise: number) {
  const { data: have } = await db.from('razorpay_plans').select('rzp_plan_id').eq('plan', planId).eq('period', period).eq('mode', MODE).eq('amount_paise', paise).maybeSingle()
  if (have) return have.rzp_plan_id as string
  const made = await rzp('/plans', 'POST', {
    period: period === 'year' ? 'yearly' : 'monthly',
    interval: 1,
    item: { name: `Joinlyy ${planName} (${period === 'year' ? 'yearly' : 'monthly'})`, amount: paise, currency: 'INR', description: `${planName} plan, price including 18% GST` },
    notes: { plan: planId, period, mode: MODE },
  })
  const { error } = await db.from('razorpay_plans').insert({ plan: planId, period, mode: MODE, amount_paise: paise, rzp_plan_id: made.id })
  if (error) throw error
  return made.id as string
}

function quote(base: number) {
  const gst = round2(base * GST_RATE)
  const total = round2(base + gst)
  return { base: round2(base), gst, total, paise: Math.round(total * 100) }
}

async function planPrice(db: SupabaseClient, planId: string, period: 'month' | 'year') {
  const { data: p } = await db.from('plans').select('id, name, price_monthly_inr, price_yearly_inr, is_active').eq('id', planId).maybeSingle()
  const base = Number(period === 'year' ? p?.price_yearly_inr : p?.price_monthly_inr)
  if (!p || !p.is_active || planId === 'free' || !(base > 0)) throw new HttpError(400, 'That plan can not be bought')
  return { name: p.name as string, ...quote(base) }
}

// ---------- applying what Razorpay tells us ----------
async function applyCharge(db: SupabaseClient, row: Json, pay: Json, periodEndEpoch: number | null) {
  if (pay.status !== 'captured') return { applied: false, reason: 'not_captured' }
  if (pay.currency && pay.currency !== 'INR') {
    await raiseIssue(db, 'wrong_currency', 'high', row, pay.id, { currency: pay.currency })
    return { applied: false, reason: 'wrong_currency' }
  }
  const periodEnd = iso(periodEndEpoch) ?? new Date(Date.now() + (row.period === 'year' ? 365 : 31) * 86400_000).toISOString()
  const { data, error } = await db.rpc('billing_apply_charge', {
    p_subscription: row.id, p_payment_id: pay.id, p_invoice_id: pay.invoice_id ?? null, p_amount_paise: pay.amount,
    p_period_end: periodEnd, p_method: pay.method ?? null, p_paid_at: iso(pay.created_at) ?? new Date().toISOString(),
  })
  if (error) throw error
  if (data?.reason === 'amount_mismatch') await alertAdmin(db, 'amount mismatch', `Payment ${pay.id} was ${pay.amount} paise but the plan price is different. The plan was NOT switched on.`)
  return data
}

/** Pulls the truth for one subscription from Razorpay: its state and every paid invoice. Safe to run any number of times. */
async function syncSubscription(db: SupabaseClient, rzpSubId: string) {
  const { data: row } = await db.from('billing_subscriptions').select('*').eq('rzp_subscription_id', rzpSubId).maybeSingle()
  if (!row) throw new HttpError(404, 'Unknown subscription')
  const sub = await rzp(`/subscriptions/${rzpSubId}`)
  const invoices = await rzp(`/invoices?subscription_id=${rzpSubId}&count=100`)
  let applied = 0
  for (const inv of invoices.items ?? []) {
    if (inv.status === 'paid' && inv.payment_id) {
      const pay = await rzp(`/payments/${inv.payment_id}`)
      const r = await applyCharge(db, row, pay, inv.billing_end ?? sub.current_end ?? null)
      if (r?.applied) applied++
    }
  }
  const { data: fresh } = await db.from('billing_subscriptions').select('status, current_end').eq('id', row.id).single()
  // A paid cycle must have a payment on our side; if Razorpay says more cycles were paid than we hold, someone should look
  const { count } = await db.from('billing_payments').select('id', { count: 'exact', head: true }).eq('subscription_id', row.id).eq('status', 'captured')
  if (Number(sub.paid_count ?? 0) > (count ?? 0)) await raiseIssue(db, 'missing_payment', 'high', row, null, { razorpay_paid_count: sub.paid_count, our_captured: count })
  // Do not move a finished subscription back to an earlier state because of an old message
  const keep = ['cancelled', 'completed', 'halted'].includes(fresh?.status ?? '') && sub.status === 'active' && row.cancel_at_cycle_end
  await db.from('billing_subscriptions').update({
    status: keep ? fresh!.status : sub.status,
    current_start: iso(sub.current_start), current_end: iso(sub.current_end) ?? fresh?.current_end ?? null, next_charge_at: iso(sub.charge_at),
    updated_at: new Date().toISOString(),
  }).eq('id', row.id)
  return { status: sub.status, applied }
}

/** Process one stored webhook event */
async function processEvent(db: SupabaseClient, event: Json) {
  const name: string = event.event
  const entities = event.payload ?? {}
  const eventAt = iso(event.created_at)

  if (name.startsWith('subscription.')) {
    const sub = entities.subscription?.entity
    if (!sub?.id) return 'ignored'
    const { data: row } = await db.from('billing_subscriptions').select('*').eq('rzp_subscription_id', sub.id).maybeSingle()
    if (!row) {
      await raiseIssue(db, 'unknown_subscription', 'medium', null, entities.payment?.entity?.id ?? null, { subscription: sub.id, event: name })
      return 'ignored'
    }
    if (name === 'subscription.charged') {
      const pay = entities.payment?.entity
      if (pay?.id) await applyCharge(db, row, pay, sub.current_end ?? null)
    }
    // Old messages arriving late must not roll a newer state back
    const older = row.last_event_at && eventAt && new Date(eventAt) < new Date(row.last_event_at)
    if (!older) {
      const finished = ['cancelled', 'completed'].includes(row.status) && sub.status === 'active' && name !== 'subscription.resumed'
      await db.from('billing_subscriptions').update({
        status: finished ? row.status : sub.status,
        current_start: iso(sub.current_start), current_end: iso(sub.current_end) ?? row.current_end, next_charge_at: iso(sub.charge_at),
        last_event_at: eventAt, updated_at: new Date().toISOString(),
      }).eq('id', row.id)
    }
    return 'processed'
  }

  if (name === 'payment.failed' || name === 'payment.captured') {
    const pay = entities.payment?.entity
    if (!pay?.id || !pay.invoice_id) return 'ignored' // not a subscription payment
    const inv = await rzp(`/invoices/${pay.invoice_id}`).catch(() => null)
    if (!inv?.subscription_id) return 'ignored'
    const { data: row } = await db.from('billing_subscriptions').select('*').eq('rzp_subscription_id', inv.subscription_id).maybeSingle()
    if (!row) return 'ignored'
    if (name === 'payment.captured') await applyCharge(db, row, pay, inv.billing_end ?? null)
    else await db.rpc('billing_record_failure', { p_subscription: row.id, p_payment_id: pay.id, p_amount_paise: pay.amount ?? 0, p_method: pay.method ?? null, p_error: pay.error_description ?? pay.error_reason ?? 'Payment failed' })
    return 'processed'
  }

  if (name === 'refund.processed' || name === 'refund.created') {
    const refund = entities.refund?.entity
    if (refund?.payment_id) {
      const { data: bp } = await db.from('billing_payments').select('id, user_id').eq('rzp_payment_id', refund.payment_id).maybeSingle()
      if (bp) {
        if (name === 'refund.processed') await db.from('billing_payments').update({ status: 'refunded' }).eq('id', bp.id)
        await raiseIssue(db, 'refund', 'low', { user_id: bp.user_id }, refund.payment_id, { refund: refund.id, amount_paise: refund.amount })
        return 'processed'
      }
    }
    return 'ignored'
  }
  return 'ignored'
}

async function runEvent(db: SupabaseClient, id: number) {
  const { data: ev } = await db.from('razorpay_events').select('*').eq('id', id).single()
  try {
    const result = await processEvent(db, ev.payload)
    await db.from('razorpay_events').update({ status: result, error: null, attempts: ev.attempts + 1, processed_at: new Date().toISOString() }).eq('id', id)
    return result
  } catch (e) {
    await db.from('razorpay_events').update({ status: 'failed', error: String((e as Error)?.message ?? e).slice(0, 400), attempts: ev.attempts + 1 }).eq('id', id)
    throw e
  }
}

// ---------- actions ----------
async function webhook(req: Request, db: SupabaseClient) {
  if (!WEBHOOK_SECRET) throw new HttpError(503, 'Webhook secret is not set')
  const raw = await req.text()
  const given = req.headers.get('x-razorpay-signature') ?? ''
  if (!given || !sameText(given, await hmacHex(WEBHOOK_SECRET, raw))) throw new HttpError(401, 'Bad signature')
  let event: Json
  try {
    event = JSON.parse(raw)
  } catch {
    throw new HttpError(400, 'Bad body')
  }
  const eventId = req.headers.get('x-razorpay-event-id') || `hash:${await hmacHex('event', raw)}`
  const { data: ins, error } = await db.from('razorpay_events').insert({ event_id: eventId, event: String(event.event ?? 'unknown'), payload: event }).select('id').single()
  let id = ins?.id as number | undefined
  if (error) {
    // Razorpay sent the same event again: if we already handled it, say thanks and stop
    const { data: old } = await db.from('razorpay_events').select('id, status').eq('event_id', eventId).maybeSingle()
    if (!old || ['processed', 'ignored'].includes(old.status)) return json({ ok: true, duplicate: true })
    id = old.id
  }
  try {
    await runEvent(db, id!)
  } catch (e) {
    console.error('razorpay webhook failed', eventId, e)
    return json({ error: 'Could not process, will retry' }, 500) // Razorpay retries on a non-2xx answer
  }
  return json({ ok: true })
}

async function createSubscription(req: Request, db: SupabaseClient, body: Json) {
  const user = await requireUser(req, db)
  const planId = String(body.plan ?? '')
  const period = body.period === 'year' ? 'year' : body.period === 'month' ? 'month' : null
  if (!period || !['pro', 'business'].includes(planId)) throw new HttpError(400, 'Choose a plan and a period')
  const price = await planPrice(db, planId, period)

  const { data: current } = await db.from('billing_subscriptions').select('id, status, plan, cancel_at_cycle_end').eq('user_id', user.id).in('status', ['authenticated', 'active', 'pending'])
  if (current?.length) throw new HttpError(409, 'You already have a subscription. Turn off auto-renew on the Billing page first, and subscribe again when it ends.')
  // Old checkouts that were never paid are closed so they can not be completed later by accident
  await db.from('billing_subscriptions').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('user_id', user.id).eq('status', 'created')

  const rzpPlan = await ensureRazorpayPlan(db, planId, price.name, period, price.paise)
  const made = await rzp('/subscriptions', 'POST', {
    plan_id: rzpPlan, total_count: period === 'year' ? 10 : 120, quantity: 1, customer_notify: 1,
    notes: { user_id: user.id, plan: planId, period, mode: MODE },
  })
  const { error } = await db.from('billing_subscriptions').insert({
    user_id: user.id, plan: planId, period, mode: MODE, rzp_subscription_id: made.id, rzp_plan_id: rzpPlan, status: 'created',
    base_inr: price.base, gst_inr: price.gst, total_inr: price.total,
  })
  if (error) throw error
  return json({ subscription_id: made.id, key_id: KEY_ID, mode: MODE, name: 'Joinlyy', description: `${price.name} plan, ${period === 'year' ? 'yearly' : 'monthly'} (incl. 18% GST)`, email: user.email, ...price })
}

async function verify(req: Request, db: SupabaseClient, body: Json) {
  const user = await requireUser(req, db)
  const subId = String(body.subscription_id ?? ''), payId = String(body.payment_id ?? ''), sig = String(body.signature ?? '')
  if (!subId || !payId || !sig) throw new HttpError(400, 'Missing payment details')
  const { data: row } = await db.from('billing_subscriptions').select('id, user_id').eq('rzp_subscription_id', subId).maybeSingle()
  if (!row || row.user_id !== user.id) throw new HttpError(404, 'Subscription not found')
  // The signature only proves Checkout finished for this subscription. The plan is switched on from Razorpay's own records.
  if (!sameText(sig, await hmacHex(KEY_SECRET, `${payId}|${subId}`))) throw new HttpError(400, 'Payment signature did not match')
  const r = await syncSubscription(db, subId)
  const { data: bs } = await db.from('billing_subscriptions').select('status, current_end').eq('id', row.id).single()
  return json({ status: bs?.status ?? r.status, activated: r.applied > 0 || bs?.status === 'active', ends: bs?.current_end ?? null })
}

/** "Check my payment": the creator asks us to look at Razorpay's records for their latest subscription. Nothing is taken on trust. */
async function check(req: Request, db: SupabaseClient) {
  const user = await requireUser(req, db)
  const { data: row } = await db.from('billing_subscriptions').select('id, rzp_subscription_id, status, current_end').eq('user_id', user.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!row?.rzp_subscription_id) return json({ status: 'none', activated: false })
  const r = await syncSubscription(db, row.rzp_subscription_id)
  const { data: bs } = await db.from('billing_subscriptions').select('status, current_end').eq('id', row.id).single()
  return json({ status: bs?.status ?? r.status, activated: bs?.status === 'active' || r.applied > 0, ends: bs?.current_end ?? null })
}

async function cancel(req: Request, db: SupabaseClient) {
  const user = await requireUser(req, db)
  const { data: row } = await db.from('billing_subscriptions').select('id, status, rzp_subscription_id').eq('user_id', user.id).in('status', ['created', 'authenticated', 'active', 'pending']).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!row) throw new HttpError(404, 'You have no subscription to cancel')
  const atEnd = row.status === 'active' || row.status === 'pending'
  await rzp(`/subscriptions/${row.rzp_subscription_id}/cancel`, 'POST', { cancel_at_cycle_end: atEnd ? 1 : 0 })
  await db.from('billing_subscriptions').update({ cancel_at_cycle_end: true, status: atEnd ? row.status : 'cancelled', updated_at: new Date().toISOString() }).eq('id', row.id)
  return json({ ok: true, at_period_end: atEnd })
}

/** Safety net: runs every 10 minutes */
async function reconcile(db: SupabaseClient) {
  const now = Date.now()
  const stuckBefore = new Date(now - 5 * 60_000).toISOString()
  const staleBefore = new Date(now - 2 * 3600_000).toISOString()
  const { data: stuck } = await db.from('billing_subscriptions').select('rzp_subscription_id')
    .in('status', ['created', 'authenticated']).gt('created_at', new Date(now - 3 * 86400_000).toISOString()).lt('updated_at', stuckBefore).not('rzp_subscription_id', 'is', null).limit(25)
  const { data: stale } = await db.from('billing_subscriptions').select('rzp_subscription_id')
    .in('status', ['active', 'pending']).lt('updated_at', staleBefore).not('rzp_subscription_id', 'is', null).limit(25)
  let synced = 0, failed = 0
  for (const r of [...(stuck ?? []), ...(stale ?? [])]) {
    try {
      await syncSubscription(db, r.rzp_subscription_id)
      synced++
    } catch (e) {
      failed++
      console.error('reconcile failed', r.rzp_subscription_id, e)
    }
  }
  // Events that arrived but were never finished, or failed: try again (up to 5 times)
  const { data: events } = await db.from('razorpay_events').select('id, attempts, status, received_at')
    .or(`and(status.eq.received,received_at.lt.${new Date(now - 10 * 60_000).toISOString()}),and(status.eq.failed,attempts.lt.5)`).order('received_at').limit(25)
  let replayed = 0
  for (const ev of events ?? []) {
    try {
      await runEvent(db, ev.id)
      replayed++
    } catch {
      if (ev.attempts + 1 >= 5) await raiseIssue(db, 'event_failed', 'high', null, null, { event_row: ev.id })
    }
  }
  return { synced, failed, replayed }
}

Deno.serve(handle(async (req) => {
  const db = adminClient()
  if (req.method === 'POST' && req.headers.has('x-razorpay-signature')) return webhook(req, db)

  const body = await req.json().catch(() => ({}))
  switch (body.action) {
    case 'config':
      return json({ enabled: Boolean(KEY_ID && KEY_SECRET), key_id: KEY_ID || null, mode: MODE, gst_rate: GST_RATE })
    case 'create_subscription':
      return createSubscription(req, db, body)
    case 'verify':
      return verify(req, db, body)
    case 'cancel':
      return cancel(req, db)
    case 'check':
      return check(req, db)
    case 'reconcile': {
      if (!(CRON_SECRET && sameText(req.headers.get('x-cron-secret') ?? '', CRON_SECRET))) await requireAdmin(req, db)
      return json({ ok: true, ...(await reconcile(db)) })
    }
    case 'test_connection': {
      await requireAdmin(req, db)
      const r = await rzp('/plans?count=1').then(() => ({ ok: true }), (e) => ({ ok: false, error: String(e.message) }))
      return json({ ...r, mode: MODE, key_id: KEY_ID ? `${KEY_ID.slice(0, 12)}…` : null, webhook_secret_set: Boolean(WEBHOOK_SECRET), webhook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/razorpay` })
    }
    case 'sync_plans': {
      await requireAdmin(req, db)
      const out: string[] = []
      for (const [id, period] of [['pro', 'month'], ['pro', 'year'], ['business', 'month'], ['business', 'year']] as const) {
        const price = await planPrice(db, id, period)
        out.push(`${price.name} ${period}: ${await ensureRazorpayPlan(db, id, price.name, period, price.paise)}`)
      }
      return json({ ok: true, plans: out })
    }
    case 'replay_event': {
      await requireAdmin(req, db)
      const result = await runEvent(db, Number(body.id))
      return json({ ok: true, result })
    }
    case 'resync_subscription': {
      await requireAdmin(req, db)
      const { data: row } = await db.from('billing_subscriptions').select('rzp_subscription_id').eq('id', String(body.id)).maybeSingle()
      if (!row?.rzp_subscription_id) throw new HttpError(404, 'Subscription not found')
      return json({ ok: true, ...(await syncSubscription(db, row.rzp_subscription_id)) })
    }
    default:
      throw new HttpError(400, 'Unknown action')
  }
}, { anyOrigin: false }))
