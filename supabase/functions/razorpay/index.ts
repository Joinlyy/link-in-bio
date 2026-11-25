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

  // Route: a linked account changed state
  if (name.startsWith('product.') || name.startsWith('account.')) {
    const accId = event.account_id ?? entities.product?.entity?.account_id ?? entities.account?.entity?.id
    const { data: pa } = accId ? await db.from('payout_accounts').select('user_id').eq('rzp_account_id', accId).maybeSingle() : { data: null }
    if (!pa) return 'ignored'
    await kycSync(db, pa.user_id)
    return 'processed'
  }

  // Route: a buyer's payment for a creator's order
  if (name === 'payment.captured' || name === 'order.paid') {
    const pay = entities.payment?.entity
    if (pay?.order_id) {
      const { data: ord } = await db.from('orders').select('*').eq('rzp_order_id', pay.order_id).maybeSingle()
      if (ord) {
        await settleOrder(db, ord, pay.id)
        return 'processed'
      }
    }
    if (name === 'order.paid') return 'ignored'
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
  const route = await reconcileRoute(db).catch((e) => ({ error: String(e) }))
  return { synced, failed, replayed, route }
}

// ---------- Razorpay Route: creator payout accounts (KYC) and split payments ----------
const HOLD_HOURS = Number(Deno.env.get('ROUTE_HOLD_HOURS') ?? '48') // money stays with Razorpay this long before it reaches the creator, so a manual refund is still possible
const KYC_CATEGORY = Deno.env.get('ROUTE_CATEGORY') ?? 'education'
const KYC_SUBCATEGORY = Deno.env.get('ROUTE_SUBCATEGORY') ?? 'e_learning'

async function rzp2(path: string, method = 'GET', body?: unknown): Promise<Json> {
  if (!KEY_ID || !KEY_SECRET) throw new HttpError(503, 'Razorpay is not set up yet')
  const res = await fetch(`https://api.razorpay.com/v2${path}`, {
    method,
    headers: { Authorization: `Basic ${btoa(`${KEY_ID}:${KEY_SECRET}`)}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error?.description || data?.message || `HTTP ${res.status}`
    if (/access denied/i.test(msg)) throw new HttpError(503, 'Payouts are not switched on at Razorpay yet. We will tell you when they are.')
    throw new HttpError(400, `Razorpay: ${msg}`)
  }
  return data
}

const KYC_STATUS: Record<string, string> = { activated: 'activated', under_review: 'under_review', needs_clarification: 'needs_clarification', suspended: 'suspended', rejected: 'rejected', requested: 'under_review' }

/** Pull the linked account's state from Razorpay and store it */
async function kycSync(db: SupabaseClient, userId: string) {
  const { data: acc } = await db.from('payout_accounts').select('*').eq('user_id', userId).maybeSingle()
  if (!acc?.rzp_account_id || !acc.rzp_product_id) return acc
  const p = await rzp2(`/accounts/${acc.rzp_account_id}/products/${acc.rzp_product_id}`)
  const status = KYC_STATUS[p.activation_status] ?? 'under_review'
  const reqs = [...(p.requirements ?? []), ...(p.active_configuration?.requirements ?? [])]
  const patch = {
    status,
    requirements: reqs.map((r: Json) => ({ field: r.field_reference, reason: r.reason_code, status: r.status, url: r.resolution_url ?? null })).slice(0, 20),
    reason: status === 'rejected' || status === 'suspended' ? String(p.rejection_reason ?? p.reason ?? '').slice(0, 300) || null : null,
    activated_at: status === 'activated' ? (acc.activated_at ?? new Date().toISOString()) : acc.activated_at,
    updated_at: new Date().toISOString(),
  }
  await db.from('payout_accounts').update(patch).eq('user_id', userId)
  return { ...acc, ...patch }
}

async function kycStart(req: Request, db: SupabaseClient, body: Json) {
  const user = await requireUser(req, db)
  const text = (v: unknown, max = 120) => String(v ?? '').trim().slice(0, max)
  const f = {
    legal_name: text(body.legal_name),
    business_type: body.business_type === 'proprietorship' ? 'proprietorship' : 'individual',
    pan: text(body.pan, 10).toUpperCase(),
    phone: text(body.phone, 15).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, ''),
    account: text(body.bank_account, 20).replace(/\s/g, ''),
    ifsc: text(body.ifsc, 11).toUpperCase(),
    beneficiary: text(body.beneficiary_name),
    street: text(body.street),
    city: text(body.city, 60),
    state: text(body.state, 60),
    pin: text(body.postal_code, 6),
  }
  const bad = (m: string) => {
    throw new HttpError(400, m)
  }
  if (f.legal_name.length < 2) bad('Enter your full name as on your PAN card')
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(f.pan)) bad('PAN looks wrong. It has 5 letters, 4 digits and 1 letter, like ABCDE1234F')
  if (!/^[6-9]\d{9}$/.test(f.phone)) bad('Enter a 10-digit mobile number')
  if (!/^\d{9,18}$/.test(f.account)) bad('Bank account number should be 9 to 18 digits')
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(f.ifsc)) bad('IFSC looks wrong. It is 11 characters, like HDFC0001234')
  if (f.beneficiary.length < 2) bad('Enter the name on the bank account')
  if (f.street.length < 3 || f.city.length < 2 || f.state.length < 2) bad('Enter your address, city and state')
  if (!/^\d{6}$/.test(f.pin)) bad('PIN code should be 6 digits')

  let { data: acc } = await db.from('payout_accounts').select('*').eq('user_id', user.id).maybeSingle()
  if (acc && ['activated', 'under_review', 'suspended'].includes(acc.status)) throw new HttpError(409, 'Your payout account is already set up or being reviewed')
  if (!acc) {
    await db.from('payout_accounts').insert({ user_id: user.id })
    acc = { user_id: user.id }
  }
  const save = (p: Json) => db.from('payout_accounts').update({ ...p, updated_at: new Date().toISOString() }).eq('user_id', user.id)

  // Each step is saved, so pressing the button again carries on from where it stopped
  if (!acc.rzp_account_id) {
    const made = await rzp2('/accounts', 'POST', {
      email: user.email, phone: f.phone, type: 'route', reference_id: user.id.replace(/-/g, '').slice(0, 20),
      legal_business_name: f.legal_name, business_type: f.business_type, contact_name: f.legal_name,
      profile: {
        category: KYC_CATEGORY, subcategory: KYC_SUBCATEGORY,
        addresses: { registered: { street1: f.street, street2: f.street, city: f.city, state: f.state, postal_code: f.pin, country: 'IN' } },
      },
      legal_info: { pan: f.pan },
    })
    acc.rzp_account_id = made.id
    await save({ rzp_account_id: made.id, status: 'created', legal_name: f.legal_name, business_type: f.business_type, phone: f.phone })
  }
  if (!acc.rzp_stakeholder_id) {
    const sh = await rzp2(`/accounts/${acc.rzp_account_id}/stakeholders`, 'POST', { name: f.legal_name, email: user.email, kyc: { pan: f.pan } })
    acc.rzp_stakeholder_id = sh.id
    await save({ rzp_stakeholder_id: sh.id })
  }
  if (!acc.rzp_product_id) {
    const pr = await rzp2(`/accounts/${acc.rzp_account_id}/products`, 'POST', { product_name: 'route', tnc_accepted: true })
    acc.rzp_product_id = pr.id
    await save({ rzp_product_id: pr.id })
  }
  await rzp2(`/accounts/${acc.rzp_account_id}/products/${acc.rzp_product_id}`, 'PATCH', {
    settlements: { account_number: f.account, ifsc_code: f.ifsc, beneficiary_name: f.beneficiary },
    tnc_accepted: true,
  })
  await save({ bank_last4: f.account.slice(-4), bank_ifsc: f.ifsc, beneficiary_name: f.beneficiary })
  const fresh = await kycSync(db, user.id)
  return json({ ok: true, status: fresh?.status ?? 'under_review' })
}

async function kycStatus(req: Request, db: SupabaseClient) {
  const user = await requireUser(req, db)
  const fresh = await kycSync(db, user.id).catch(() => null)
  return json({ ok: true, status: fresh?.status ?? 'not_started' })
}

/** What the creator is paid and what we keep, from the creator's plan */
async function commissionFor(db: SupabaseClient, ownerId: string, amountInr: number) {
  const { data: pr } = await db.from('profiles').select('plan, plan_expires_at').eq('id', ownerId).maybeSingle()
  const live = !pr?.plan_expires_at || new Date(pr.plan_expires_at) > new Date()
  const { data: plan } = await db.from('plans').select('features').eq('id', live ? pr?.plan ?? 'free' : 'free').maybeSingle()
  const pct = Number(plan?.features?.commission_pct ?? 15)
  const paise = Math.round(amountInr * 100)
  const fee = Math.min(paise - 100, Math.round((paise * pct) / 100)) // the creator always gets at least ₹1
  return { pct, commission: fee / 100, share: (paise - fee) / 100, sharePaise: paise - fee }
}

async function orderByToken(db: SupabaseClient, token: string) {
  const { data: o } = await db.from('orders').select('*, pages(owner_id, display_name, username)').eq('access_token', token).maybeSingle()
  if (!o) throw new HttpError(404, 'Order not found')
  return o
}

/** Buyer presses Pay: make (or reuse) the Razorpay order with the split attached */
async function orderCreate(db: SupabaseClient, body: Json) {
  const o = await orderByToken(db, String(body.token ?? ''))
  if (o.payment_provider !== 'razorpay' || o.status !== 'pending' || !(o.amount_inr > 0)) throw new HttpError(409, 'This order is not waiting for a payment')
  const ownerId = o.pages.owner_id as string
  // Route on and the creator verified: Razorpay splits the money. Otherwise every rupee comes to us and the creator is paid by hand.
  const { data: st } = await db.from('app_settings').select('route_enabled').eq('id', true).maybeSingle()
  const { data: acc } = await db.from('payout_accounts').select('rzp_account_id, status').eq('user_id', ownerId).maybeSingle()
  const split = Boolean(st?.route_enabled && acc?.rzp_account_id && acc.status === 'activated')
  if (!split) {
    const { data: pg } = await db.from('pages').select('upi_id').eq('owner_id', ownerId).maybeSingle()
    if (!pg?.upi_id) throw new HttpError(409, 'This creator can not take payments right now')
  }
  const c = await commissionFor(db, ownerId, o.amount_inr)
  let rzpOrderId = o.rzp_order_id as string | null
  if (rzpOrderId) {
    const existing = await rzp(`/orders/${rzpOrderId}`)
    if (existing.status === 'paid') {
      const pays = await rzp(`/orders/${rzpOrderId}/payments`)
      const ok = (pays.items ?? []).find((p: Json) => p.status === 'captured')
      if (ok) {
        await settleOrder(db, o, ok.id)
        throw new HttpError(409, 'This order is already paid')
      }
    }
  } else {
    const made = await rzp('/orders', 'POST', {
      amount: Math.round(o.amount_inr * 100), currency: 'INR', receipt: String(o.id).slice(0, 40),
      notes: { order_id: o.id, page: o.pages.username },
      ...(split ? { transfers: [{
        account: acc!.rzp_account_id, amount: c.sharePaise, currency: 'INR', notes: { order_id: o.id },
        on_hold: HOLD_HOURS > 0 ? 1 : 0,
        ...(HOLD_HOURS > 0 ? { on_hold_until: Math.floor(Date.now() / 1000) + HOLD_HOURS * 3600 } : {}),
      }] } : {}),
    })
    rzpOrderId = made.id
    await db.from('orders').update({ rzp_order_id: made.id, commission_pct: c.pct, commission_inr: c.commission, creator_share_inr: c.share }).eq('id', o.id)
  }
  return json({
    key_id: KEY_ID, order_id: rzpOrderId, amount: Math.round(o.amount_inr * 100), currency: 'INR',
    name: o.pages.display_name || o.pages.username, description: o.product_title || 'Order', email: o.buyer_email, contact: o.buyer_phone || undefined,
  })
}

/** Mark an order paid from Razorpay's own record of the payment. Safe to repeat. */
async function settleOrder(db: SupabaseClient, o: Json, paymentId: string) {
  let pay = await rzp(`/payments/${paymentId}`)
  if (pay.order_id !== o.rzp_order_id) throw new HttpError(400, 'That payment belongs to another order')
  if (pay.status === 'authorized') pay = await rzp(`/payments/${paymentId}/capture`, 'POST', { amount: pay.amount, currency: pay.currency })
  if (pay.status !== 'captured') return { paid: false, status: pay.status }
  if (pay.amount !== Math.round(o.amount_inr * 100) || pay.currency !== 'INR') {
    await raiseIssue(db, 'order_amount_mismatch', 'high', null, paymentId, { order: o.id, paid_paise: pay.amount, expected_inr: o.amount_inr })
    return { paid: false, status: 'amount_mismatch' }
  }
  if (o.status === 'paid' || o.status === 'refunded') return { paid: true, status: o.status }
  await db.from('orders').update({ status: 'paid', paid_at: iso(pay.created_at) ?? new Date().toISOString(), payment_ref: paymentId }).eq('id', o.id).in('status', ['pending', 'failed'])
  return { paid: true, status: 'paid' }
}

async function orderVerify(db: SupabaseClient, body: Json) {
  const o = await orderByToken(db, String(body.token ?? ''))
  const paymentId = String(body.payment_id ?? '')
  const signature = String(body.signature ?? '')
  if (!o.rzp_order_id || !paymentId || !signature) throw new HttpError(400, 'Missing payment details')
  if (!sameText(signature, await hmacHex(KEY_SECRET, `${o.rzp_order_id}|${paymentId}`))) throw new HttpError(400, 'Payment could not be verified')
  return json({ ok: true, ...(await settleOrder(db, o, paymentId)) })
}

/** "I paid but it says pending": look at Razorpay's records for this order */
async function orderCheck(db: SupabaseClient, body: Json) {
  const o = await orderByToken(db, String(body.token ?? ''))
  if (o.status === 'paid') return json({ ok: true, paid: true })
  if (!o.rzp_order_id) return json({ ok: true, paid: false })
  const pays = await rzp(`/orders/${o.rzp_order_id}/payments`)
  const ok = (pays.items ?? []).find((p: Json) => p.status === 'captured' || p.status === 'authorized')
  return json({ ok: true, ...(ok ? await settleOrder(db, o, ok.id) : { paid: false }) })
}

/** Safety net for Route: check accounts under review and orders that stayed pending */
async function reconcileRoute(db: SupabaseClient) {
  const { data: accs } = await db.from('payout_accounts').select('user_id').in('status', ['created', 'under_review', 'needs_clarification']).not('rzp_product_id', 'is', null).limit(25)
  for (const a of accs ?? []) await kycSync(db, a.user_id).catch((e) => console.error('kyc sync', a.user_id, e))
  const { data: orders } = await db.from('orders').select('*').eq('payment_provider', 'razorpay').eq('status', 'pending')
    .lt('created_at', new Date(Date.now() - 10 * 60_000).toISOString()).limit(40)
  let settled = 0
  let closed = 0
  for (const o of orders ?? []) {
    try {
      if (o.rzp_order_id) {
        const pays = await rzp(`/orders/${o.rzp_order_id}/payments`)
        const ok = (pays.items ?? []).find((p: Json) => p.status === 'captured' || p.status === 'authorized')
        if (ok && (await settleOrder(db, o, ok.id)).paid) {
          settled++
          continue
        }
      }
      if (new Date(o.created_at).getTime() < Date.now() - 24 * 3600_000) {
        await db.rpc('route_fail_order', { p_order_id: o.id, p_reason: 'Payment not completed' })
        closed++
      }
    } catch (e) {
      console.error('order reconcile', o.id, e)
    }
  }
  return { settled, closed }
}

Deno.serve(handle(async (req) => {
  const db = adminClient()
  if (req.method === 'POST' && req.headers.has('x-razorpay-signature')) return webhook(req, db)

  const body = await req.json().catch(() => ({}))
  switch (body.action) {
    case 'config':
    {
      const { data: st } = await db.from('app_settings').select('route_enabled').eq('id', true).maybeSingle()
      return json({ enabled: Boolean(KEY_ID && KEY_SECRET), key_id: KEY_ID || null, mode: MODE, gst_rate: GST_RATE, route_enabled: Boolean(st?.route_enabled) })
    }
    case 'kyc_start':
      return kycStart(req, db, body)
    case 'kyc_status':
      return kycStatus(req, db)
    case 'order_create':
      return orderCreate(db, body)
    case 'order_verify':
      return orderVerify(db, body)
    case 'order_check':
      return orderCheck(db, body)
    case 'test_route': {
      await requireAdmin(req, db)
      // A made-up account id: "not found" means Route is on for us, "access denied" means Razorpay has not enabled it
      const out = await rzp2('/accounts/acc_0000000000000A').then(() => ({ enabled: true, message: '' }), (e) => ({ enabled: !/not switched on/i.test(String(e.message)), message: String(e.message) }))
      return json(out)
    }
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
