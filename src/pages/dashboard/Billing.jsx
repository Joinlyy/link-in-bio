import { useCallback, useEffect, useState } from 'react'
import { Check, Crown, FlaskConical, Minus, ReceiptText } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { usePage } from '../../context/PageContext'
import { errorMessage, supabase } from '../../lib/supabase'
import { usePlan } from '../../lib/usePlan'
import { formatInr } from '../../lib/images'
import { Alert, Badge, Button, Card, Empty, Modal, Spinner, useToast } from '../../components/ui'
import { DataTable, useViewMode, ViewToggle } from '../../components/DataTable'
import { PageHeading } from './DashboardLayout'
import { featureList } from '../../lib/plans'
import UpiPay from '../../components/UpiPay'

const LIMITS = [
  { key: 'max_pages', label: 'Bio pages', scope: 'on your account' },
  { key: 'max_site_pages', label: 'Sub-pages', scope: 'per bio page' },
  { key: 'max_team', label: 'Team members', scope: 'per bio page' },
  { key: 'max_products', label: 'Live products', scope: 'per page, deactivated ones don’t count' },
]

const PERIOD_LABEL = { month: 'Monthly', year: 'Yearly', referral: 'Referral reward', admin: 'Granted by team' }

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
  const pct = max ? Math.min(100, (used / max) * 100) : used ? 100 : 0
  const full = max !== undefined && used >= max
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">{label} <span className="font-normal text-ink-500">· {scope}</span></p>
        <p className={`shrink-0 text-sm font-semibold ${full ? 'text-red-600' : ''}`}>{used ?? '—'} / {max ?? '—'}</p>
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
  const [payInfo, setPayInfo] = useState(null)
  const [paying, setPaying] = useState(null)
  const loadPayInfo = useCallback(() => supabase.rpc('plan_payment_info').then(({ data }) => setPayInfo(data || {})), [])

  const loadHistory = useCallback(async () => {
    const { data } = await supabase.from('subscriptions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30)
    setHistory(data || [])
  }, [user.id])

  useEffect(() => {
    supabase.from('plans').select('*').eq('is_active', true).order('position').then(({ data }) => setPlans(data || []))
    loadHistory()
    loadPayInfo()
  }, [loadHistory, loadPayInfo])

  const current = plans?.find((p) => p.id === plan?.plan)
  const expired = plan?.expires_at && new Date(plan.expires_at) < new Date()

  async function upgrade(p) {
    // Real payments go to the platform's UPI and wait for approval; test mode upgrades at once
    if (payInfo?.upi_id) return setPaying(p)
    setBusy(p.id)
    const { error } = await supabase.rpc('test_upgrade', { p_plan: p.id, p_period: period })
    setBusy(null)
    if (error) return toast(errorMessage(error), 'error')
    toast(`You’re on ${p.name} — test mode, no payment taken`)
    reload()
    loadHistory()
    reloadPages()
  }

  async function cancel() {
    setBusy('cancel')
    const { error } = await supabase.rpc('cancel_plan')
    setBusy(null)
    setConfirmCancel(false)
    if (error) return toast(errorMessage(error), 'error')
    toast('Plan cancelled — you’re back on Free')
    reload()
    reloadPages()
  }

  if (!plan || !plans) return <div className="grid h-80 place-items-center"><Spinner /></div>

  return (
    <div className="space-y-4">
      <PageHeading title="Plan & billing." italic="Grow without limits." />

      {payInfo?.pending ? (
        <Alert tone="success">
          <b>Payment sent for {plans.find((x) => x.id === payInfo.pending.plan)?.name || payInfo.pending.plan}</b> ({formatInr(payInfo.pending.amount_inr)}, reference {payInfo.pending.utr}). We’ll switch your plan on as soon as we’ve checked it, usually within a day.
        </Alert>
      ) : payInfo?.last_rejected ? (
        <Alert>Your last plan payment couldn’t be confirmed{payInfo.last_rejected.note ? `: ${payInfo.last_rejected.note}` : '.'} Message us in Messages if you were charged.</Alert>
      ) : payInfo && !payInfo.upi_id && payInfo.test_payments ? (
        <Alert tone="info">
          <span className="inline-flex items-center gap-1.5 font-semibold"><FlaskConical className="size-4" /> Test mode</span>: upgrades are instant and no payment is taken.
        </Alert>
      ) : payInfo && !payInfo.upi_id ? (
        <Alert tone="info">Paid plans open soon. You can keep using Free in the meantime.</Alert>
      ) : null}

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
                  ? <>{expired ? 'Expired on' : 'Renews / ends on'} <b className="text-white">{fmtDate(plan.expires_at)}</b></>
                  : 'No expiry'}
            </p>
            {plan.plan !== 'free' && (
              <Button variant="outline" size="sm" className="mt-5 !border-white/20 !bg-white/10 !text-white" onClick={() => setConfirmCancel(true)}>
                Cancel plan
              </Button>
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
                  <span className="text-base font-medium text-ink-500"> / {period === 'year' ? 'year' : 'month'}</span>
                </p>
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
                    <Button variant={highlight ? 'primary' : 'outline'} className="w-full" loading={busy === p.id} disabled={!!busy || !!payInfo?.pending || (!payInfo?.upi_id && !payInfo?.test_payments)} onClick={() => upgrade(p)}>
                      {isCurrent ? `Extend ${period === 'year' ? '1 year' : '1 month'}` : 'Upgrade'}{payInfo?.upi_id ? '' : payInfo?.test_payments ? ' (test mode)' : ''}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

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

      <Modal open={Boolean(paying)} onClose={() => setPaying(null)} title={paying ? `${paying.name}, ${period === 'year' ? '1 year' : '1 month'}` : ''}>
        {paying && (
          <UpiPay
            upiId={payInfo.upi_id}
            name={payInfo.upi_name}
            amount={period === 'year' ? paying.price_yearly_inr : paying.price_monthly_inr}
            note={`${paying.name} plan ${user.email?.split('@')[0] || ''}`.trim().slice(0, 50)}
            submitLabel="Send for approval"
            onSubmit={async (utr) => {
              const { error } = await supabase.rpc('request_plan_payment', { p_plan: paying.id, p_period: period, p_utr: utr })
              if (error) throw new Error(errorMessage(error))
              setPaying(null)
              toast('Payment sent. We’ll switch your plan on once it’s checked.')
              loadPayInfo()
            }}
          />
        )}
      </Modal>

      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Cancel your plan?">
        <p className="text-sm text-ink-600">You’ll move to Free right away. Extra pages, team access, custom domains and branding removal stop working. Your content stays safe.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmCancel(false)}>Keep plan</Button>
          <Button variant="danger" loading={busy === 'cancel'} onClick={cancel}>Cancel plan</Button>
        </div>
      </Modal>
    </div>
  )
}
