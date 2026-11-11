import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, ShieldAlert } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatInr } from '../../lib/images'
import { Badge, Button, Card, Empty, Modal, Spinner, Tabs, useToast } from '../../components/ui'
import { DataTable, useViewMode, ViewToggle } from '../../components/DataTable'
import { PageHeading } from '../dashboard/DashboardLayout'
import { SuspendModal, useModeration } from './AdminCreators'

const KINDS = {
  order_velocity: { title: 'Order velocity', explain: 'The same buyer email placed 6+ orders within an hour — possible card testing or a bot.' },
  high_value_order: { title: 'High-value order', explain: 'A single order of ₹50,000 or more. Usually fine, but worth a quick look.' },
  order_spike: { title: 'Order spike', explain: '50+ orders on one page within 10 minutes — check for scripted or fake purchases.' },
  report_spike: { title: 'Report spike', explain: 'Several visitors reported this page in the last 24 hours.' },
  dispute_rate: { title: 'High dispute rate', explain: '3+ buyer disputes on this page in 30 days — the creator may not be delivering.' },
  lead_flood: { title: 'Lead flood', explain: '60+ leads in 10 minutes — likely spam submissions to the lead form.' },
}
const SEVERITY_TONE = { high: 'red', medium: 'lilac', low: 'neutral' }
const DETAIL_LABELS = {
  email: 'Buyer', orders_last_hour: 'Orders (1h)', amount_inr: 'Amount', orders_10_min: 'Orders (10m)',
  open_reports_24h: 'Open reports (24h)', disputes_30d: 'Disputes (30d)', leads_10_min: 'Leads (10m)',
}

function detailValue(k, v) {
  if (k === 'amount_inr') return formatInr(v)
  return String(v)
}

export default function AdminFraud() {
  const { user } = useAuth()
  const toast = useToast()
  const { setHidden } = useModeration()
  const [status, setStatus] = useState('open')
  const [rows, setRows] = useState(null)
  const [orders, setOrders] = useState({})
  const [suspendFor, setSuspendFor] = useState(null)
  const [view, setView] = useViewMode('admin-fraud')
  const [openId, setOpenId] = useState(null)

  const load = useCallback(async () => {
    setRows(null)
    const { data } = await supabase
      .from('fraud_flags')
      .select('*, pages(id, username, display_name, moderation_status, owner_id, profiles(id, email, status, role))')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(100)
    const list = data || []
    const orderIds = list.filter((f) => f.subject_type === 'order').map((f) => f.subject_id)
    if (orderIds.length) {
      const { data: os } = await supabase.from('orders').select('id, product_title, kind, buyer_email, amount_inr, status, created_at').in('id', orderIds)
      setOrders(Object.fromEntries((os || []).map((o) => [o.id, o])))
    }
    setRows(list)
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  async function close(id, next) {
    const { error } = await supabase.from('fraud_flags').update({ status: next, resolved_at: new Date().toISOString(), resolved_by: user.id }).eq('id', id)
    if (error) return toast(error.message, 'error')
    setRows((r) => r.filter((x) => x.id !== id))
    toast(next === 'resolved' ? 'Marked resolved' : 'Dismissed')
  }

  async function reopen(id) {
    const { error } = await supabase.from('fraud_flags').update({ status: 'open', resolved_at: null, resolved_by: null }).eq('id', id)
    if (error) return toast(error.message, 'error')
    setRows((r) => r.filter((x) => x.id !== id))
    toast('Reopened')
  }

  const opened = (rows || []).find((x) => x.id === openId)
  const card = (f) => {
            const kind = KINDS[f.kind] || { title: f.kind.replace(/_/g, ' '), explain: 'Automatic flag.' }
            const page = f.pages
            const owner = page?.profiles
            const order = f.subject_type === 'order' ? orders[f.subject_id] : null
            return (
              <Card key={f.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold capitalize">{kind.title}</p>
                      <Badge tone={SEVERITY_TONE[f.severity]}>{f.severity}</Badge>
                      {page?.moderation_status === 'hidden' && <Badge tone="red">Page hidden</Badge>}
                      {owner?.status === 'suspended' && <Badge tone="red">Owner suspended</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-ink-600">{kind.explain}</p>
                    <p className="mt-1.5 truncate text-sm text-ink-500">
                      {page ? (
                        <a href={`/${page.username}`} target="_blank" rel="noreferrer" className="font-medium text-ink hover:underline">/{page.username}</a>
                      ) : 'Page deleted'}
                      {owner?.email && <> · {owner.email}</>}
                    </p>
                    {order && (
                      <p className="mt-1 truncate text-sm text-ink-500">
                        Order: <span className="font-medium text-ink">{order.kind === 'tip' ? 'Tip' : order.product_title}</span> · {formatInr(order.amount_inr)} · {order.buyer_email} · <span className="capitalize">{order.status}</span>{' '}
                        <Link to="/admin/orders" className="font-semibold underline underline-offset-2">Orders</Link>
                      </p>
                    )}
                    {Object.keys(f.details || {}).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(f.details).map(([k, v]) => (
                          <span key={k} className="max-w-full truncate rounded-full bg-cream px-2.5 py-1 text-xs">
                            <span className="text-ink-500">{DETAIL_LABELS[k] || k}:</span> <b>{detailValue(k, v)}</b>
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-ink-400">
                      Raised {new Date(f.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                      {f.resolved_at && ` · closed ${new Date(f.resolved_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 md:max-w-[320px] md:justify-end">
                    {page && (
                      <Button variant="outline" size="sm" href={`/${page.username}`} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> View</Button>
                    )}
                    {page && (
                      <Button variant="soft" size="sm" onClick={async () => (await setHidden(page.id, page.moderation_status !== 'hidden', `Fraud flag: ${kind.title}`)) && load()}>
                        {page.moderation_status === 'hidden' ? 'Unhide page' : 'Hide page'}
                      </Button>
                    )}
                    {owner && owner.status !== 'suspended' && owner.role !== 'admin' && (
                      <Button variant="dangerSoft" size="sm" onClick={() => setSuspendFor(owner)}>Suspend owner</Button>
                    )}
                    {status === 'open' ? (
                      <>
                        <Button size="sm" onClick={() => close(f.id, 'resolved')}>Resolve</Button>
                        <Button variant="ghost" size="sm" onClick={() => close(f.id, 'dismissed')}>Dismiss</Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => reopen(f.id)}>Reopen</Button>
                    )}
                  </div>
                </div>
              </Card>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeading title="Fraud flags." italic="Automatic early warnings.">
        Raised automatically by order, report, dispute and lead patterns. Investigate, take action, then resolve or dismiss.
      </PageHeading>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs label="Status" value={status} onChange={setStatus} tabs={[['open', 'Open'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed']].map(([key, label]) => ({ key, label }))} />
        <ViewToggle value={view} onChange={setView} />
      </div>
      {rows === null ? (
        <div className="grid h-60 place-items-center"><Spinner /></div>
      ) : rows.length === 0 ? (
        <Empty icon={ShieldAlert} title={status === 'open' ? 'Nothing suspicious' : `No ${status} flags`}>{status === 'open' ? 'No open fraud flags right now.' : null}</Empty>
      ) : (
        <div className="space-y-2.5">
          {view === 'table' ? (
            <DataTable
              rows={rows}
              onRowClick={(f) => setOpenId(f.id)}
              minWidth={820}
              columns={[
                { key: 'kind', label: 'Flag', value: (f) => (KINDS[f.kind] || { title: f.kind.replace(/_/g, ' ') }).title, className: 'truncate capitalize' },
                { key: 'severity', label: 'Severity', value: (f) => f.severity, render: (f) => <Badge tone={SEVERITY_TONE[f.severity]}>{f.severity}</Badge> },
                { key: 'page', label: 'Page', value: (f) => f.pages?.username, render: (f) => (f.pages ? `/${f.pages.username}` : 'Page deleted') },
                { key: 'owner', label: 'Owner', value: (f) => f.pages?.profiles?.email, className: 'max-w-56 truncate text-ink-600' },
                { key: 'created_at', label: 'Raised', value: (f) => f.created_at, className: 'whitespace-nowrap text-ink-500', render: (f) => new Date(f.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
              ]}
            />
          ) : rows.map((f) => card(f))}
        </div>
      )}
      <Modal open={Boolean(opened)} onClose={() => setOpenId(null)} title="Fraud flag" wide>{opened && card(opened)}</Modal>
      <SuspendModal creator={suspendFor} onClose={() => setSuspendFor(null)} onDone={() => { setSuspendFor(null); load() }} />
    </div>
  )
}
