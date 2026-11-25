import { useCallback, useEffect, useState } from 'react'
import { Check, Crown, Minus, ReceiptText } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { usePage } from '../../context/PageContext'
import { errorMessage, supabase } from '../../lib/supabase'
import { usePlan } from '../../lib/usePlan'
import { formatInr } from '../../lib/images'
import { Alert, Badge, Button, Card, Empty, Modal, Spinner, useToast } from '../../components/ui'
import { DataTable, useViewMode, ViewToggle } from '../../components/DataTable'
import { PageHeading } from './DashboardLayout'
import { featureList } from '../../lib/plans'
import { cancelAutoRenew, checkPayment, money2, payForPlan, razorpayConfig, withGst } from '../../lib/razorpay'

const LIMITS = [
  { key: 'max_pages', label: 'Bio pages', scope: 'on your account' },
  { key: 'max_site_pages', label: 'Sub-pages', scope: 'per bio page' },
  { key: 'max_team', label: 'Team members', scope: 'per bio page' },
  { key: 'max_products', label: 'Live products', scope: 'per page, deactivated ones don’t count' },
]

const PERIOD_LABEL = { test: '₹1 test', month: 'Monthly', year: 'Yearly', referral: 'Referral reward', admin: 'Granted by team' }

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

/** Usage of the user's own pages: page count + the busiest page for per-page limits */
function useUsage(userId) {
  const [usage, setUsage] = useState(null)
  useEffect(() => {
    if (!userId) return
    let alive = true
    ;(async () => {
      const { data: owned } = await supabase.from('pages').select('id').eq('owner_id', userId)
      const ids = (owned || []).map((p) => p.id)
      if (!ids.length) {
        if (alive) setUsage({ max_pages: 0, max_site_pages: 0, max_team: 0, max_products: 0 })
        return
      }
      const [{ data: sp }, { data: tm }, { data: pr }] = await Promise.all([
        supabase.from('site_pages').select('page_id').in('page_id', ids),
        supabase.from('page_members').select('page_id').in('page_id', ids),
        supabase.from('products').select('page_id').in('page_id', ids).eq('is_published', true),
      ])
      const busiest = (rows) => {
        const counts = {}
        for (const r of rows || []) counts[r.page_id] = (counts[r.page_id] || 0) + 1
        return Math.max(0, ...Object.values(counts))
      }
      if (alive) setUsage({ max_pages: ids.length, max_site_pages: busiest(sp), max_team: busiest(tm), max_products: busiest(pr) })
    })()
    return () => {
      alive = false
    }
  }, [userId])
  return usage
}

function UsageBar({ label, scope, used, max }) {
  const pct = max === null || max >= 10000 ? 0 : max ? Math.min(100, (used / max) * 100) : used ? 100 : 0
  const unlimited = max === null || max >= 10000
  const full = !unlimited && max !== undefined && used >= max
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">{label} <span className="font-normal text-ink-500">· {scope}</span></p>
        <p className={`shrink-0 text-sm font-semibold ${full ? 'text-red-600' : ''}`}>{used ?? '—'} / {unlimited ? '∞' : max ?? '—'}</p>
      </div>
      <div className="mt-2 h-2 rounded-full bg-cream">
        <div className={`h-2 rounded-full transition-all ${full ? 'bg-rose' : 'bg-ink'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function Billing() {
  const [view, setView] = useViewMode('plan-history')
  const { user } = useAuth()
  const { reload: reloadPages } = usePage()
  const { plan, reload } = usePlan()
  const usage = useUsage(user?.id)
  const toast = useToast()
  const [plans, setPlans] = useState(null)
  const [history, setHistory] = useState(null)
  const [period, setPeriod] = useState('month')
  const [busy, setBusy] = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [rzp, setRzp] = useState(null) // { enabled, mode }
  const [sub, setSub] = useState(null) // the latest Razorpay subscription
  const [pays, setPays] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [payError, setPayError] = useState('')

  const loadHistory = useCallback(async () => {
    const { data } = await supabase.from('subscriptions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30)
    setHistory(data || [])
    const [{ data: subs }, { data: payments }] = await Promise.all([
      supabase.from('billing_subscriptions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
      supabase.from('billing_payments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
    ])
    setSub(subs?.[0] || null)
    setPays(payments || [])
  }, [user.id])

  useEffect(() => {
    supabase.from('plans').select('*').eq('is_active', true).order('position').then(({ data }) => setPlans(data || []))
    loadHistory()
    razorpayConfig().then(setRzp)
  }, [loadHistory])

  const current = plans?.find((p) => p.id === plan?.plan)
  const expired = plan?.expires_at && new Date(plan.expires_at) < new Date()
  const autoRenew = sub && sub.status === 'active' && !sub.cancel_at_cycle_end && sub.period !== 'test'
  const waiting = sub && sub.status === 'authenticated' && Date.now() - new Date(sub.created_at).getTime() < 86400_000

  const refreshAll = () => {
    reload()
    loadHistory()
    reloadPages()
  }

  /** Pays through Razorpay. The plan is switched on by the server after it checks Razorpay's own records. */
  async function buy(p, per = period) {
    setPayError('')
    setBusy(per === 'test' ? 'test' : p.id)
    try {
      const r = await payForPlan({ plan: p.id, period: per, onFailed: setPayError })
      if (r.dismissed) return
      if (r.activated) toast(`You’re on ${p.name}. Thank you!`)
      else setConfirming(true)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(null)
      refreshAll()
    }
  }

  /** "I paid but it still says pending": ask the server to look at Razorpay's records */
  async function recheck() {
    setBusy('check')
    try {
      const r = await checkPayment()
      if (r.activated) {
        setConfirming(false)
        toast('Payment confirmed. Your plan is on.')
      } else toast('We have not seen the payment yet. If money left your account it will show here within minutes, or message us from the order help button.')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(null)
      refreshAll()
    }
  }

  async function stopRenewal() {
    setBusy('cancel')
    try {
      await cancelAutoRenew()
      toast('Auto-renew is off. Your plan stays on until it ends.')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(null)
      setConfirmCancel(false)
      refreshAll()
    }
  }

  async function cancel() {
    setBusy('cancel')
    const { error } = await supabase.rpc('cancel_plan')
    setBusy(null)
    setConfirmCancel(false)
    if (error) return toast(errorMessage(error), 'error')
    toast('Plan cancelled — you’re back on Starter')
    reload()
    reloadPages()
  }

  if (!plan || !plans) return <div className="grid h-80 place-items-center"><Spinner /></div>

  return (
    <div className="space-y-4">
      <PageHeading title="Plan & billing." italic="Grow without limits." />

      {payError && <Alert>{payError}</Alert>}
      {(confirming || waiting) && !autoRenew && (
        <Alert tone="info">
          <b>We are confirming your payment.</b> This usually takes under a minute. If you were charged and your plan is not on yet, press the button and we will look at Razorpay’s records right now.
          <div className="mt-2"><Button size="sm" variant="outline" loading={busy === 'check'} onClick={recheck}>Check my payment</Button></div>
        </Alert>
      )}
      {sub?.status === 'halted' && <Alert>Auto-renew stopped because the payments failed. Your plan stays on until the end date below. Subscribe again to keep your paid features.</Alert>}
      {pays?.[0]?.status === 'failed' && sub && ['pending', 'halted'].includes(sub.status) && <Alert>Your last payment did not go through{pays[0].error ? ` (${pays[0].error})` : ''}. Check your card or UPI, or subscribe again below.</Alert>}
      {rzp && !rzp.enabled && <Alert tone="info">Paid plans open soon. You can keep using Starter in the meantime.</Alert>}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-8">
          <div className="absolute -top-16 -right-16 size-48 rounded-full bg-lilac" aria-hidden />
          <div className="relative">
            <p className="eyebrow text-lime">Current plan</p>
            <h2 className="mt-3 flex items-center gap-2 font-display text-4xl font-bold tracking-tight">
              <Crown className="size-7 text-lime" /> {current?.name || plan.plan}
            </h2>
            <p className="mt-2 text-[15px] text-white/70">{current?.description}</p>
            <p className="mt-5 text-sm text-white/70">
              {plan.plan === 'free'
                ? 'Free forever. Upgrade any time.'
                : plan.expires_at
                  ? <>{autoRenew ? 'Renews automatically on' : expired ? 'Ended on' : 'Ends on'} <b className="text-white">{fmtDate(autoRenew && sub.current_end ? sub.current_end : plan.expires_at)}</b></>
                  : 'No expiry'}
            </p>
            {autoRenew && <p className="mt-1 text-xs text-white/60">{money2(sub.total_inr)} per {sub.period === 'year' ? 'year' : 'month'}, including GST</p>}
            {!autoRenew && plan.plan !== 'free' && plan.expires_at && !expired && <p className="mt-1 text-xs text-lime">Auto-renew is off. Subscribe again before this date to keep your plan.</p>}
            {autoRenew ? (
              <Button variant="outline" size="sm" className="mt-5 !border-white/20 !bg-white/10 !text-white" onClick={() => setConfirmCancel(true)}>
                Turn off auto-renew
              </Button>
            ) : (
              plan.plan !== 'free' && (
                <Button variant="outline" size="sm" className="mt-5 !border-white/20 !bg-white/10 !text-white" onClick={() => setConfirmCancel(true)}>
                  Cancel plan
                </Button>
              )
            )}
          </div>
        </div>

        <Card className="space-y-5 p-6 sm:p-8">
          <p className="eyebrow text-ink-500">Usage</p>
          {usage === null ? (
            <Spinner />
          ) : (
            LIMITS.map((l) => <UsageBar key={l.key} label={l.label} scope={l.scope} used={usage[l.key]} max={plan.features?.[l.key]} />)
          )}
          <p className="text-xs text-ink-500">Per-page limits show your busiest page.</p>
        </Card>
      </div>

      <Card className="p-5 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-2xl font-bold tracking-tight">Choose a plan</h2>
          <div className="flex w-fit gap-1 rounded-full bg-cream p-1">
            {[['month', 'Monthly'], ['year', 'Yearly · 2 months free']].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setPeriod(v)} className={`h-9 rounded-full px-4 text-sm font-semibold ${period === v ? 'bg-ink text-white' : 'text-ink-600'}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => {
            const isCurrent = p.id === plan.plan
            const price = period === 'year' ? p.price_yearly_inr : p.price_monthly_inr
            const highlight = p.id === 'pro'
            return (
              <div key={p.id} className={`flex flex-col rounded-3xl p-6 ${highlight ? 'bg-lime' : 'bg-cream'}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-xl font-bold">{p.name}</h3>
                  {isCurrent && <Badge tone="dark">Current</Badge>}
                </div>
                <p className="mt-1 text-sm text-ink-600">{p.description}</p>
                <p className="mt-5 font-display text-4xl font-bold tracking-tight">
                  {price ? formatInr(price) : '₹0'}
                  <span className="text-base font-medium text-ink-500"> / {period === 'year' ? 'year' : 'month'}{price ? ' + GST' : ''}</span>
                </p>
                {price > 0 && <p className="mt-1 text-xs text-ink-600">You pay {money2(withGst(price).total)} with 18% GST ({money2(withGst(price).gst)})</p>}
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {featureList(p.features || {}).map((f) => (
                    <li key={f.text} className={`flex items-center gap-2 ${f.on ? '' : 'text-ink-400'}`}>
                      {f.on ? <Check className="size-4 shrink-0" strokeWidth={3} /> : <Minus className="size-4 shrink-0" />}
                      {f.text}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {p.id === 'free' ? (
                    <Button variant="outline" className="w-full" disabled>{isCurrent ? 'Your plan' : 'Included'}</Button>
                  ) : (
                    <Button variant={highlight ? 'primary' : 'outline'} className="w-full" loading={busy === p.id} disabled={!!busy || !rzp?.enabled || Boolean(autoRenew || waiting)} onClick={() => buy(p)}>
                      {!rzp?.enabled ? 'Opening soon' : autoRenew ? (isCurrent ? 'Subscribed' : 'Turn off auto-renew to change') : isCurrent ? 'Renew with auto-renew' : 'Subscribe'}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {rzp?.enabled && (
          <div className="mt-4 flex flex-col gap-3 rounded-3xl border border-dashed border-ink/20 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-lg font-bold">Pro, ₹1 test <Badge>Temporary</Badge></p>
              <p className="text-sm text-ink-600">One payment of {money2(withGst(1).total)} (₹1 + GST) for 1 month of Pro, no auto-renew. For trying the payment flow.</p>
            </div>
            <Button variant="outline" loading={busy === 'test'} disabled={!!busy || Boolean(autoRenew || waiting)} onClick={() => buy({ id: 'pro', name: 'Pro' }, 'test')}>Pay ₹1 test</Button>
          </div>
        )}
      </Card>

      {pays?.length > 0 && (
        <Card className="p-5 sm:p-8">
          <p className="eyebrow text-ink-500">Payments</p>
          <div className="mt-3 divide-y divide-ink/5">
            {pays.map((x) => (
              <div key={x.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{money2(x.amount_inr)} {x.status === 'captured' && <span className="text-sm font-normal text-ink-500">({money2(x.base_inr)} + {money2(x.gst_inr)} GST)</span>}</p>
                  <p className="text-sm text-ink-500">{fmtDate(x.paid_at || x.created_at)}{x.method ? ` · ${x.method}` : ''}{x.error ? ` · ${x.error}` : ''}</p>
                </div>
                <Badge tone={x.status === 'captured' ? 'green' : x.status === 'failed' ? 'red' : 'neutral'}>{x.status === 'captured' ? 'Paid' : x.status === 'failed' ? 'Failed' : x.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow text-ink-500">Subscription history</p>
          {history?.length > 0 && <ViewToggle value={view} onChange={setView} />}
        </div>
        {history === null ? (
          <div className="grid h-24 place-items-center"><Spinner /></div>
        ) : history.length === 0 ? (
          <div className="mt-4"><Empty icon={ReceiptText} title="No subscriptions yet">Upgrades, referral rewards and extensions will show up here.</Empty></div>
        ) : view === 'table' ? (
          <div className="mt-3">
            <DataTable
              bare
              rows={history}
              minWidth={560}
              defaultSort={{ key: 'starts_at', dir: -1 }}
              columns={[
                { key: 'plan', label: 'Plan', value: (s) => plans.find((p) => p.id === s.plan)?.name || s.plan, className: 'capitalize' },
                { key: 'period', label: 'Period', value: (s) => PERIOD_LABEL[s.period] || s.period, className: 'text-ink-600' },
                { key: 'starts_at', label: 'From', value: (s) => s.starts_at, className: 'whitespace-nowrap text-ink-600', render: (s) => fmtDate(s.starts_at) },
                { key: 'ends_at', label: 'To', value: (s) => s.ends_at, className: 'whitespace-nowrap text-ink-600', render: (s) => fmtDate(s.ends_at) },
                { key: 'amount_inr', label: 'Amount', align: 'right', value: (s) => s.amount_inr, className: 'font-semibold', render: (s) => formatInr(s.amount_inr) },
              ]}
            />
          </div>
        ) : (
          <div className="mt-3 divide-y divide-ink/5">
            {history.map((s) => (
              <div key={s.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold capitalize">{plans.find((p) => p.id === s.plan)?.name || s.plan} <span className="font-normal text-ink-500">· {PERIOD_LABEL[s.period] || s.period}</span></p>
                  <p className="text-sm text-ink-500">{fmtDate(s.starts_at)} → {fmtDate(s.ends_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {s.provider === 'test' && <Badge>Test</Badge>}
                  {s.provider === 'referral' && <Badge tone="lilac">Referral</Badge>}
                  <span className="font-display text-lg font-bold">{formatInr(s.amount_inr)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} title={autoRenew ? 'Turn off auto-renew?' : 'Cancel your plan?'}>
        <p className="text-sm text-ink-600">
          {autoRenew
            ? <>Your plan stays on until <b>{fmtDate(sub.current_end || plan.expires_at)}</b>, and then moves to Starter. We will remind you by email before it ends. Your content stays safe.</>
            : 'You’ll move to Starter right away. Paid features stop: extra pages, team access, custom domain, branding removal, WhatsApp alerts and advanced DM automations. Your content stays safe.'}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmCancel(false)}>Keep plan</Button>
          <Button variant="danger" loading={busy === 'cancel'} onClick={autoRenew ? stopRenewal : cancel}>{autoRenew ? 'Turn off auto-renew' : 'Cancel plan'}</Button>
        </div>
      </Modal>
    </div>
  )
}
