import { useEffect, useState } from 'react'
import { Crown, ExternalLink } from 'lucide-react'
import { errorMessage, supabase } from '../../lib/supabase'
import { formatInr } from '../../lib/images'
import { Badge, Button, Input, Modal, Spinner, useToast } from '../../components/ui'

const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const UNLIMITED = (v) => v === null || v === undefined || v >= 10000

function Meter({ label, used, limit }) {
  const unlimited = UNLIMITED(limit)
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100))
  return (
    <div>
      <div className="flex justify-between text-sm"><span className="text-ink-600">{label}</span><span className="font-semibold">{used} / {unlimited ? 'Unlimited' : limit}</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-cream"><div className={`h-full rounded-full ${pct >= 90 ? 'bg-rose' : 'bg-ink'}`} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

/** Everything about one creator, for the super admin */
export default function AdminCreatorDetail({ id, plans, onClose, onChanged, onChangePlan, onSuspend }) {
  const toast = useToast()
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const [days, setDays] = useState('7')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => supabase.rpc('admin_creator_detail', { p_user: id }).then(({ data, error: err }) => (err ? setError(errorMessage(err)) : setD(data)))
  useEffect(() => {
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function extend() {
    setBusy(true)
    const { error: err } = await supabase.rpc('admin_extend_plan', { p_user: id, p_days: Number(days), p_reason: reason })
    setBusy(false)
    if (err) return toast(errorMessage(err), 'error')
    toast(`Plan extended by ${days} days`)
    setReason('')
    load()
    onChanged?.()
  }

  const planName = (pid) => plans.find((p) => p.id === pid)?.name || pid
  const page = d?.pages?.[0]
  const f = d?.features || {}
  const paid = d && d.profile.plan !== 'free' && (!d.profile.plan_expires_at || new Date(d.profile.plan_expires_at) > new Date())

  return (
    <Modal open onClose={onClose} title="Creator" wide>
      {error ? <p className="text-sm text-red-600">{error}</p> : !d ? <div className="grid h-40 place-items-center"><Spinner /></div> : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            {page?.avatar_url ? <img src={page.avatar_url} alt="" className="size-16 rounded-full object-cover" /> : <span className="grid size-16 place-items-center rounded-full bg-cream font-display text-xl font-bold text-ink-500">{(d.profile.full_name || d.profile.email || '?')[0].toUpperCase()}</span>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold">{d.profile.full_name || page?.display_name || 'Unnamed'}</p>
              <p className="truncate text-sm text-ink-500">{d.profile.email}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {paid ? <Badge tone="lime"><Crown className="size-3" /> {planName(d.profile.plan)}</Badge> : <Badge>{d.profile.plan === 'free' ? 'Free' : `${planName(d.profile.plan)} · expired`}</Badge>}
                {d.profile.status === 'suspended' ? <Badge tone="red">Suspended</Badge> : <Badge tone="green">Active</Badge>}
                {page && (page.is_published ? <Badge tone="green">Live</Badge> : <Badge>Draft</Badge>)}
                {page?.moderation_status === 'hidden' && <Badge tone="red">Page hidden</Badge>}
              </div>
            </div>
            {page && <Button variant="outline" size="sm" href={`/${page.username}`} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> /{page.username}</Button>}
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ['Sales', formatInr(d.sales.total), `${d.sales.count} paid orders`],
              ['Joined', day(d.profile.created_at), ''],
              ['Last seen', day(d.last_sign_in_at), ''],
              ['Plan until', d.profile.plan === 'free' ? '—' : day(d.profile.plan_expires_at), ''],
            ].map(([k, v, s]) => (
              <div key={k} className="rounded-2xl bg-cream p-3"><p className="text-xs text-ink-500">{k}</p><p className="font-semibold">{v}</p>{s && <p className="text-xs text-ink-500">{s}</p>}</div>
            ))}
          </div>

          <div className="rounded-2xl border border-ink/10 p-4">
            <p className="eyebrow text-ink-500">Usage against plan limits</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Meter label="Bio pages" used={d.usage.pages} limit={f.max_pages} />
              <Meter label="Live products" used={d.usage.products} limit={f.max_products} />
              <Meter label="DM automations" used={d.usage.automations} limit={f.max_automations} />
              <Meter label="DMs this month" used={d.usage.dms_this_month} limit={f.dm_monthly_limit} />
            </div>
            <p className="mt-3 text-sm text-ink-600">
              Instagram: {d.instagram ? <b>@{d.instagram.username}</b> : 'not connected'} · WhatsApp alerts: <b>{page?.whatsapp_alerts ? 'on' : 'off'}</b>
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-5">
            {[['Refunds', d.history.refunds], ['Disputes', d.history.disputes], ['Support requests', d.history.tickets], ['Reports', d.history.reports], ['Open flags', d.history.open_flags]].map(([k, v]) => (
              <div key={k} className={`rounded-2xl p-3 text-center ${v > 0 ? 'bg-rose/10' : 'bg-cream'}`}><p className="font-display text-2xl font-bold">{v}</p><p className="text-xs text-ink-500">{k}</p></div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-ink/10 p-4">
              <p className="eyebrow text-ink-500">Recent orders</p>
              {d.orders.length === 0 ? <p className="mt-2 text-sm text-ink-500">No orders yet.</p> : (
                <ul className="mt-2 divide-y divide-ink/5 text-sm">
                  {d.orders.map((o) => <li key={o.id} className="flex items-center justify-between gap-3 py-2"><span className="min-w-0 truncate">{o.product_title || 'Order'}<span className="text-xs text-ink-400"> · {day(o.created_at)}</span></span><span className="shrink-0 font-semibold">{formatInr(o.amount_inr)} <span className="text-xs font-normal capitalize text-ink-500">{o.status}</span></span></li>)}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border border-ink/10 p-4">
              <p className="eyebrow text-ink-500">Plan history</p>
              {d.subscriptions.length + d.plan_payments.length === 0 ? <p className="mt-2 text-sm text-ink-500">No plan activity.</p> : (
                <ul className="mt-2 divide-y divide-ink/5 text-sm">
                  {d.subscriptions.map((s, i) => <li key={`s${i}`} className="flex justify-between gap-3 py-2"><span>{planName(s.plan)} · {s.provider === 'admin' ? 'admin grant' : s.provider}<span className="text-xs text-ink-400"> · {day(s.created_at)}</span></span><span className="text-xs text-ink-500">until {day(s.ends_at)}</span></li>)}
                  {d.plan_payments.map((p, i) => <li key={`p${i}`} className="flex justify-between gap-3 py-2"><span>UPI {planName(p.plan)} / {p.period}<span className="text-xs text-ink-400"> · {day(p.created_at)}</span></span><span className="font-semibold">{formatInr(p.amount_inr)} <span className="text-xs font-normal capitalize text-ink-500">{p.status}</span></span></li>)}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-ink/10 p-4">
            <p className="eyebrow text-ink-500">Actions</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Button variant="soft" size="sm" onClick={onChangePlan}><Crown className="size-4" /> Change plan</Button>
              {d.profile.status === 'suspended'
                ? <Button size="sm" onClick={() => onSuspend(false)}>Reactivate</Button>
                : <Button variant="dangerSoft" size="sm" onClick={() => onSuspend(true)}>Suspend</Button>}
              {d.profile.plan !== 'free' && (
                <>
                  <div className="w-24"><Input label="Extend (days)" type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} /></div>
                  <div className="min-w-48 flex-1"><Input label="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Trial extended after support chat" /></div>
                  <Button size="sm" loading={busy} disabled={reason.trim().length < 3} onClick={extend}>Extend plan</Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
