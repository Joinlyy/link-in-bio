import { useCallback, useEffect, useState } from 'react'
import { CreditCard, RefreshCw } from 'lucide-react'
import { errorMessage, invokeFunction, supabase } from '../../lib/supabase'
import { Alert, Badge, Button, Card, Empty, Modal, Spinner, Tabs, Textarea, useToast } from '../../components/ui'
import { PageHeading } from '../dashboard/DashboardLayout'

const when = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—')
const ago = (d) => {
  if (!d) return 'never'
  const m = Math.round((Date.now() - new Date(d)) / 60000)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`
}
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const TONE = { processed: 'green', ignored: 'neutral', received: 'lilac', failed: 'red', active: 'green', authenticated: 'lilac', created: 'neutral', pending: 'lilac', halted: 'red', cancelled: 'neutral', completed: 'neutral', captured: 'green', refunded: 'neutral', authorized: 'lilac', open: 'red', resolved: 'green', dismissed: 'neutral' }

function Overview({ onChanged }) {
  const toast = useToast()
  const [o, setO] = useState(null)
  const [conn, setConn] = useState(null)
  const [busy, setBusy] = useState('')

  const load = useCallback(() => supabase.rpc('admin_billing_overview').then(({ data, error }) => (error ? toast(errorMessage(error), 'error') : setO(data))), [toast])
  useEffect(() => {
    load()
  }, [load])

  async function run(action, label) {
    setBusy(action)
    try {
      const r = await invokeFunction('razorpay', { action })
      if (action === 'test_connection') setConn(r)
      else toast(action === 'sync_plans' ? `Razorpay plans ready (${r.plans.length})` : `${label}: checked ${r.synced ?? 0} subscriptions, replayed ${r.replayed ?? 0} events`)
    } catch (e) {
      toast(e.message, 'error')
    }
    setBusy('')
    load()
    onChanged?.()
  }

  if (!o) return <div className="grid h-40 place-items-center"><Spinner /></div>
  const stale = o.last_event && Date.now() - new Date(o.last_event) > 24 * 3600_000
  const tiles = [
    ['Last webhook received', ago(o.last_event), stale ? 'bg-rose text-white' : 'bg-white'],
    ['Webhooks (24h)', o.events_24h, 'bg-white'],
    ['Failed webhooks (24h)', o.failed_24h, o.failed_24h > 0 ? 'bg-rose text-white' : 'bg-white'],
    ['Stuck, not processed', o.unprocessed, o.unprocessed > 0 ? 'bg-rose text-white' : 'bg-white'],
    ['Open issues', o.open_issues, o.open_issues > 0 ? 'bg-ink text-white' : 'bg-white'],
    ['Auto-renewing creators', o.active_auto_renew, 'bg-lime'],
    ['MRR (without GST)', inr(o.mrr), 'bg-lilac-100'],
    ['Collected, 30 days', inr(o.collected_30d), 'bg-white'],
    ['GST in that, 30 days', inr(o.gst_30d), 'bg-white'],
    ['Failed payments (7d)', o.failed_payments_7d, o.failed_payments_7d > 0 ? 'bg-rose text-white' : 'bg-white'],
  ]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {tiles.map(([k, v, cls]) => (
          <div key={k} className={`rounded-3xl p-5 shadow-soft ${cls}`}>
            <p className={`text-xs font-semibold ${cls.includes('text-white') ? 'text-white/70' : 'text-ink-500'}`}>{k}</p>
            <p className="mt-2 font-display text-2xl font-bold">{v}</p>
          </div>
        ))}
      </div>
      <Card className="space-y-4 p-5 sm:p-6">
        <p className="eyebrow text-ink-500">Connection and setup</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" size="sm" loading={busy === 'test_connection'} onClick={() => run('test_connection')}>Test connection</Button>
          <Button variant="soft" size="sm" loading={busy === 'sync_plans'} onClick={() => run('sync_plans')}>Create plans at Razorpay</Button>
          <Button variant="outline" size="sm" loading={busy === 'reconcile'} onClick={() => run('reconcile', 'Check done')}><RefreshCw className="size-4" /> Check against Razorpay now</Button>
        </div>
        {conn && (
          <div className="rounded-2xl bg-cream p-4 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              {conn.ok ? <Badge tone="green">Connected</Badge> : <Badge tone="red">Not connected</Badge>}
              <Badge tone={conn.mode === 'live' ? 'dark' : 'lilac'}>{conn.mode === 'live' ? 'LIVE mode' : 'Test mode'}</Badge>
              {conn.key_id && <span className="text-ink-600">Key {conn.key_id}</span>}
              {conn.webhook_secret_set ? <Badge tone="green">Webhook secret set</Badge> : <Badge tone="red">Webhook secret missing</Badge>}
            </p>
            {conn.error && <p className="mt-2 text-red-700">{conn.error}</p>}
            <p className="mt-3 text-ink-600">Webhook URL for the Razorpay dashboard:</p>
            <code className="mt-1 block rounded-xl bg-white p-2 text-xs break-all">{conn.webhook_url}</code>
            <p className="mt-2 text-xs text-ink-500">Events to turn on: subscription.authenticated, activated, charged, pending, halted, cancelled, completed, paused, resumed, updated; payment.failed, payment.captured; refund.processed.</p>
          </div>
        )}
      </Card>
    </div>
  )
}

function Events() {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [open, setOpen] = useState(null)
  const [filter, setFilter] = useState('all')
  const load = useCallback(() => supabase.from('razorpay_events').select('id, event_id, event, status, error, attempts, received_at, processed_at').order('received_at', { ascending: false }).limit(150).then(({ data }) => setRows(data || [])), [])
  useEffect(() => {
    load()
  }, [load])

  async function show(id) {
    const { data } = await supabase.from('razorpay_events').select('payload').eq('id', id).single()
    setOpen({ id, payload: JSON.stringify(data?.payload, null, 2) })
  }
  async function replay(id) {
    try {
      const r = await invokeFunction('razorpay', { action: 'replay_event', id })
      toast(`Replayed: ${r.result}`)
    } catch (e) {
      toast(e.message, 'error')
    }
    load()
  }
  if (!rows) return <div className="grid h-40 place-items-center"><Spinner /></div>
  const shown = rows.filter((r) => filter === 'all' || (filter === 'problems' ? ['failed', 'received'].includes(r.status) : r.status === filter))
  return (
    <div className="space-y-3">
      <Tabs label="Filter" value={filter} onChange={setFilter} tabs={[['all', 'All'], ['problems', 'Failed or waiting'], ['processed', 'Processed'], ['ignored', 'Ignored']].map(([key, label]) => ({ key, label }))} />
      {shown.length === 0 ? <Empty icon={CreditCard} title="No webhook events yet">Events appear here when Razorpay calls our webhook.</Empty> : (
        <Card className="divide-y divide-ink/5">
          {shown.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">{r.event} <Badge tone={TONE[r.status]}>{r.status}</Badge>{r.attempts > 1 && <span className="text-xs font-normal text-ink-500">{r.attempts} tries</span>}</p>
                <p className="truncate text-xs text-ink-500">{r.event_id} · received {when(r.received_at)}</p>
                {r.error && <p className="text-xs text-red-700">{r.error}</p>}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => show(r.id)}>View</Button>
                {r.status !== 'processed' && <Button variant="soft" size="sm" onClick={() => replay(r.id)}>Replay</Button>}
              </div>
            </div>
          ))}
        </Card>
      )}
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title="Webhook payload" wide>
        <pre className="max-h-[60vh] overflow-auto rounded-2xl bg-cream p-4 text-xs">{open?.payload}</pre>
      </Modal>
    </div>
  )
}

function Subscriptions() {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const load = useCallback(() => supabase.from('billing_subscriptions').select('*, profiles(email, full_name)').order('created_at', { ascending: false }).limit(150).then(({ data }) => setRows(data || [])), [])
  useEffect(() => {
    load()
  }, [load])
  async function resync(id) {
    try {
      const r = await invokeFunction('razorpay', { action: 'resync_subscription', id })
      toast(`Checked: ${r.status}${r.applied ? `, applied ${r.applied} payment(s)` : ''}`)
    } catch (e) {
      toast(e.message, 'error')
    }
    load()
  }
  if (!rows) return <div className="grid h-40 place-items-center"><Spinner /></div>
  if (!rows.length) return <Empty icon={CreditCard} title="No subscriptions yet" />
  return (
    <Card className="divide-y divide-ink/5">
      {rows.map((r) => (
        <div key={r.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold">{r.profiles?.email} <Badge tone={TONE[r.status]}>{r.status}</Badge>{r.cancel_at_cycle_end && <Badge>auto-renew off</Badge>}<Badge tone={r.mode === 'live' ? 'dark' : 'lilac'}>{r.mode}</Badge></p>
            <p className="text-xs text-ink-500">{r.plan} · {r.period} · {inr(r.total_inr)} ({inr(r.base_inr)} + {inr(r.gst_inr)} GST) · paid {r.paid_count}× · ends {when(r.current_end)} · {r.rzp_subscription_id}</p>
          </div>
          <Button variant="soft" size="sm" onClick={() => resync(r.id)}>Check at Razorpay</Button>
        </div>
      ))}
    </Card>
  )
}

function Payments() {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    supabase.from('billing_payments').select('*, profiles(email)').order('created_at', { ascending: false }).limit(200).then(({ data }) => setRows(data || []))
  }, [])
  if (!rows) return <div className="grid h-40 place-items-center"><Spinner /></div>
  if (!rows.length) return <Empty icon={CreditCard} title="No payments yet" />
  return (
    <Card className="divide-y divide-ink/5">
      {rows.map((r) => (
        <div key={r.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{inr(r.amount_inr)} <span className="text-sm font-normal text-ink-500">{r.profiles?.email}</span></p>
            <p className="text-xs text-ink-500">{r.status === 'captured' ? `${inr(r.base_inr)} + ${inr(r.gst_inr)} GST · ` : ''}{when(r.paid_at || r.created_at)} · {r.method || '—'} · {r.rzp_payment_id}{r.error ? ` · ${r.error}` : ''}</p>
          </div>
          <Badge tone={TONE[r.status]}>{r.status}</Badge>
        </div>
      ))}
    </Card>
  )
}

function Issues() {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [show, setShow] = useState('open')
  const [target, setTarget] = useState(null)
  const [note, setNote] = useState('')
  const load = useCallback(() => supabase.from('billing_issues').select('*, profiles(email)').order('created_at', { ascending: false }).limit(150).then(({ data }) => setRows(data || [])), [])
  useEffect(() => {
    load()
  }, [load])
  async function resolve(status) {
    const { error } = await supabase.rpc('admin_resolve_billing_issue', { p_id: target.id, p_status: status, p_note: note })
    if (error) return toast(errorMessage(error), 'error')
    toast(status === 'resolved' ? 'Marked resolved' : 'Dismissed')
    setTarget(null)
    setNote('')
    load()
  }
  if (!rows) return <div className="grid h-40 place-items-center"><Spinner /></div>
  const shown = rows.filter((r) => (show === 'open' ? r.status === 'open' : true))
  return (
    <div className="space-y-3">
      <Tabs label="Filter" value={show} onChange={setShow} tabs={[{ key: 'open', label: 'Open' }, { key: 'all', label: 'All' }]} />
      {shown.length === 0 ? <Empty icon={CreditCard} title="No issues">Mismatched amounts, payments we can not place and missed payments show up here.</Empty> : (
        <Card className="divide-y divide-ink/5">
          {shown.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">{r.kind.replace(/_/g, ' ')} <Badge tone={r.severity === 'high' ? 'red' : 'neutral'}>{r.severity}</Badge><Badge tone={TONE[r.status]}>{r.status}</Badge></p>
                <p className="text-xs break-all text-ink-500">{r.profiles?.email || 'unknown creator'} · {when(r.created_at)} · {r.rzp_payment_id || ''} · {JSON.stringify(r.details)}</p>
                {r.note && <p className="text-xs text-ink-600">Note: {r.note}</p>}
              </div>
              {r.status === 'open' && <Button variant="soft" size="sm" onClick={() => setTarget(r)}>Resolve</Button>}
            </div>
          ))}
        </Card>
      )}
      <Modal open={Boolean(target)} onClose={() => setTarget(null)} title="Close this issue">
        <p className="text-sm text-ink-600">Check the payment in the Razorpay dashboard first. Your note is saved in the audit log.</p>
        <Textarea className="mt-3" label="What did you do?" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => resolve('dismissed')}>Dismiss</Button>
          <Button onClick={() => resolve('resolved')}>Mark resolved</Button>
        </div>
      </Modal>
    </div>
  )
}

/** Everything about Razorpay subscriptions: connection, webhook log, subscriptions, payments and issues */
export default function AdminRazorpay() {
  const [tab, setTab] = useState('overview')
  const [error, setError] = useState('')
  useEffect(() => {
    supabase.from('billing_issues').select('id', { count: 'exact', head: true }).limit(1).then(({ error: e }) => e && setError(errorMessage(e)))
  }, [])
  return (
    <div className="space-y-4">
      <PageHeading title="Razorpay." italic="Subscriptions and webhooks.">Creators pay for plans here (price plus 18% GST). A payment counts only when Razorpay confirms it to our server.</PageHeading>
      {error && <Alert>{error}</Alert>}
      <Tabs label="Section" value={tab} onChange={setTab} tabs={[['overview', 'Overview'], ['events', 'Webhook events'], ['subs', 'Subscriptions'], ['payments', 'Payments'], ['issues', 'Issues']].map(([key, label]) => ({ key, label }))} />
      {tab === 'overview' && <Overview />}
      {tab === 'events' && <Events />}
      {tab === 'subs' && <Subscriptions />}
      {tab === 'payments' && <Payments />}
      {tab === 'issues' && <Issues />}
    </div>
  )
}
