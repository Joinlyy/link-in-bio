import { useCallback, useEffect, useState } from 'react'
import { Scale } from 'lucide-react'
import { errorMessage, supabase } from '../../lib/supabase'
import { formatInr } from '../../lib/images'
import { Badge, Button, Card, Empty, Modal, Spinner, Tabs, Textarea, useToast } from '../../components/ui'
import { DataTable, useViewMode, ViewToggle } from '../../components/DataTable'
import { PageHeading } from '../dashboard/DashboardLayout'

const REASONS = {
  not_received: 'Didn’t receive the product',
  not_as_described: 'Not as described',
  session_missed: 'Session didn’t happen',
  duplicate: 'Charged twice',
  other: 'Other',
}
const STATUS = {
  open: ['Awaiting creator', 'lilac'],
  creator_responded: ['Creator responded', 'lime'],
  resolved_refund: ['Refunded', 'green'],
  resolved_rejected: ['Rejected', 'neutral'],
}
const TABS = [
  ['open', 'Open', ['open', 'creator_responded']],
  ['refunded', 'Refunded', ['resolved_refund']],
  ['rejected', 'Rejected', ['resolved_rejected']],
]

function ResolveModal({ action, onClose, onDone }) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  if (!action) return null
  const refund = action.refund
  async function submit() {
    setBusy(true)
    const { error } = await supabase.rpc('admin_resolve_dispute', { p_dispute_id: action.dispute.id, p_refund: refund, p_note: note.trim() })
    setBusy(false)
    if (error) return toast(errorMessage(error), 'error')
    toast(refund ? 'Buyer refunded (test mode)' : 'Dispute rejected')
    onDone()
  }
  return (
    <Modal open onClose={onClose} title={refund ? 'Refund the buyer?' : 'Reject this dispute?'}>
      <p className="text-sm text-ink-600">
        {refund
          ? `The ${formatInr(action.dispute.orders?.amount_inr)} order is marked refunded, any booking is cancelled and the dispute is closed. Test mode: no money moves yet.`
          : 'The order stays paid and the dispute is closed in the creator’s favour.'}
      </p>
      <Textarea className="mt-4" label="Note (kept on the dispute)" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={refund ? 'e.g. Creator didn’t deliver the file' : 'e.g. Download logs show the buyer accessed the file'} maxLength={1000} />
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={refund ? 'danger' : 'primary'} loading={busy} onClick={submit}>{refund ? 'Refund buyer' : 'Reject dispute'}</Button>
      </div>
    </Modal>
  )
}

export default function AdminDisputes() {
  const [view, setView] = useViewMode('admin-disputes')
  const [openId, setOpenId] = useState(null)
  const [tab, setTab] = useState('open')
  const [rows, setRows] = useState(null)
  const [action, setAction] = useState(null)

  const load = useCallback(async () => {
    setRows(null)
    const statuses = TABS.find((t) => t[0] === tab)[2]
    const { data } = await supabase
      .from('disputes')
      .select('*, orders(id, product_title, kind, amount_inr, buyer_name, buyer_email, status, created_at), pages(username, display_name, profiles(email))')
      .in('status', statuses)
      .order('created_at', { ascending: false })
      .limit(100)
    setRows(data || [])
  }, [tab])

  useEffect(() => {
    load()
  }, [load])

  const opened = (rows || []).find((x) => x.id === openId)
  const card = (d) => {
            const o = d.orders
            const [label, tone] = STATUS[d.status] || [d.status, 'neutral']
            const open = d.status === 'open' || d.status === 'creator_responded'
            return (
              <Card key={d.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{REASONS[d.reason] || d.reason}</p>
                      <Badge tone={tone}>{label}</Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-ink-500">
                      <span className="font-medium text-ink">{o?.kind === 'tip' ? 'Tip' : o?.product_title || 'Order'}</span> · {formatInr(o?.amount_inr)} · order {o?.status}
                    </p>
                    <p className="truncate text-sm text-ink-500">
                      Buyer: {o?.buyer_name ? `${o.buyer_name} · ` : ''}{o?.buyer_email}
                    </p>
                    <p className="truncate text-sm text-ink-500">
                      Creator: {d.pages ? <a href={`/${d.pages.username}`} target="_blank" rel="noreferrer" className="font-medium text-ink hover:underline">/{d.pages.username}</a> : '—'}
                      {d.pages?.profiles?.email && <> · {d.pages.profiles.email}</>}
                    </p>
                    {d.details && (
                      <div className="mt-3 rounded-2xl bg-cream p-3 text-sm">
                        <p className="eyebrow text-ink-400">Buyer says</p>
                        <p className="mt-1 break-words whitespace-pre-line">{d.details}</p>
                      </div>
                    )}
                    <div className={`mt-2 rounded-2xl p-3 text-sm ${d.creator_response ? 'bg-lilac-100' : 'bg-cream text-ink-500'}`}>
                      <p className="eyebrow text-ink-400">Creator response</p>
                      <p className="mt-1 break-words whitespace-pre-line">{d.creator_response || 'No response yet.'}</p>
                    </div>
                    {d.admin_note && <p className="mt-2 text-sm text-ink-600"><b>Admin note:</b> {d.admin_note}</p>}
                    <p className="mt-2 text-xs text-ink-400">
                      Opened {new Date(d.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                      {o?.created_at && ` · ordered ${new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                    </p>
                  </div>
                  {open && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="danger" size="sm" disabled={o?.status !== 'paid'} onClick={() => setAction({ dispute: d, refund: true })}>Refund buyer</Button>
                      <Button variant="outline" size="sm" onClick={() => setAction({ dispute: d, refund: false })}>Reject</Button>
                    </div>
                  )}
                </div>
              </Card>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeading title="Disputes." italic="Fair to both sides.">
        Buyers can dispute paid orders within 60 days. Read the creator’s response, then refund the buyer or reject.
      </PageHeading>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs label="Status" value={tab} onChange={setTab} tabs={TABS.map(([key, label]) => ({ key, label }))} />
        <ViewToggle value={view} onChange={setView} />
      </div>
      {rows === null ? (
        <div className="grid h-60 place-items-center"><Spinner /></div>
      ) : rows.length === 0 ? (
        <Empty icon={Scale} title={tab === 'open' ? 'No open disputes' : `No ${tab} disputes`} />
      ) : (
        <div className="space-y-2.5">
          {view === 'table' ? (
            <DataTable
              rows={rows}
              onRowClick={(d) => setOpenId(d.id)}
              minWidth={820}
              columns={[
                { key: 'reason', label: 'Reason', value: (d) => REASONS[d.reason] || d.reason },
                { key: 'status', label: 'Status', value: (d) => (STATUS[d.status] || [d.status])[0], render: (d) => <Badge tone={(STATUS[d.status] || [])[1] || 'neutral'}>{(STATUS[d.status] || [d.status])[0]}</Badge> },
                { key: 'buyer', label: 'Buyer', value: (d) => d.orders?.buyer_email, className: 'max-w-56 truncate text-ink-600' },
                { key: 'page', label: 'Creator', value: (d) => d.pages?.username, render: (d) => (d.pages ? `/${d.pages.username}` : '—') },
                { key: 'amount', label: 'Amount', align: 'right', value: (d) => d.orders?.amount_inr, className: 'font-semibold', render: (d) => formatInr(d.orders?.amount_inr) },
                { key: 'created_at', label: 'Opened', value: (d) => d.created_at, className: 'whitespace-nowrap text-ink-500', render: (d) => new Date(d.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
              ]}
            />
          ) : rows.map((d) => card(d))}
        </div>
      )}
      <Modal open={Boolean(opened)} onClose={() => setOpenId(null)} title="Dispute" wide>{opened && card(opened)}</Modal>
      <ResolveModal key={action?.dispute.id} action={action} onClose={() => setAction(null)} onDone={() => { setAction(null); load() }} />
    </div>
  )
}
