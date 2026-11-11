import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarCheck, Download, IndianRupee, MessageCircleQuestionMark, Receipt, ShieldAlert, Undo2, Wallet } from 'lucide-react'
import { usePage } from '../../context/PageContext'
import { errorMessage, supabase } from '../../lib/supabase'
import { formatInr } from '../../lib/images'
import { calendarUrl, formatIst } from '../../lib/slots'
import { Badge, Button, Card, Empty, Modal, Spinner, Stats, Tabs, Textarea, useToast, askText } from '../../components/ui'
import { DataTable, useViewMode, ViewToggle } from '../../components/DataTable'
import { PageHeading } from './DashboardLayout'

const TABS = [
  { key: 'orders', label: 'Orders', icon: Receipt },
  { key: 'bookings', label: 'Bookings', icon: CalendarCheck },
  { key: 'questions', label: 'Questions', icon: MessageCircleQuestionMark },
  { key: 'disputes', label: 'Disputes', icon: ShieldAlert },
  { key: 'payouts', label: 'Payouts', icon: Wallet },
]

function istDay(ts) {
  return new Date(new Date(ts).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10)
}

function exportCsv(rows, name) {
  const cols = ['created_at', 'product_title', 'kind', 'buyer_name', 'buyer_email', 'buyer_phone', 'amount_inr', 'discount_inr', 'coupon_code', 'status', 'payment_ref']
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

// Every column except access_token, which only the buyer's own order link may use
export const ORDER_COLUMNS = 'payment_submitted_at, id, page_id, product_id, kind, product_title, product_type, buyer_name, buyer_email, buyer_phone, note, amount_inr, discount_inr, coupon_code, status, payment_provider, payment_ref, downloads, created_at, paid_at, question, answer, answered_at, access_expires_at, refunded_at, refund_reason, refunded_by, upsell_of'

const STATUS_TONE = { paid: 'green', refunded: 'red', pending: 'lilac', failed: 'neutral' }
const STATUS_LABEL = { pending: 'waiting for payment', failed: 'payment not received' }

/** UPI payments buyers say they've made, for the creator to check in their bank app */
function UpiToConfirm({ orders, onPatch, canEdit }) {
  const toast = useToast()
  const [busy, setBusy] = useState(null)
  const waiting = orders.filter((o) => o.payment_provider === 'upi' && o.status === 'pending' && o.payment_ref)
  if (!waiting.length) return null

  async function confirm(o) {
    setBusy(o.id)
    const { error } = await supabase.rpc('confirm_upi_order', { p_order_id: o.id })
    setBusy(null)
    if (error) return toast(errorMessage(error), 'error')
    onPatch(o.id, { status: 'paid', paid_at: new Date().toISOString() })
    toast('Confirmed. The buyer has access now.')
  }

  async function reject(o) {
    const reason = await askText({ title: 'Payment not received?', message: `${formatInr(o.amount_inr)} from ${o.buyer_name || o.buyer_email}, reference ${o.payment_ref}.\n\nThe buyer will see this reason on their order page.`, label: 'Reason', defaultValue: 'Payment not found in my bank account', confirmLabel: 'Mark as not received', danger: true })
    if (reason === null) return
    setBusy(o.id)
    const { error } = await supabase.rpc('reject_upi_order', { p_order_id: o.id, p_reason: reason })
    setBusy(null)
    if (error) return toast(errorMessage(error), 'error')
    onPatch(o.id, { status: 'failed', refund_reason: reason })
    toast('Marked as not received')
  }

  return (
    <Card className="border-2 border-lime p-5 sm:p-6">
      <h2 className="text-lg font-bold">{waiting.length} UPI payment{waiting.length === 1 ? '' : 's'} to confirm</h2>
      <p className="mt-1 text-sm text-ink-500">Open your bank or UPI app, find a payment with this amount and reference, then confirm it. Confirm only money you can see.</p>
      <ul className="mt-4 divide-y divide-ink/5">
        {waiting.map((o) => (
          <li key={o.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{formatInr(o.amount_inr)} · {o.kind === 'tip' ? 'Tip' : o.product_title}</p>
              <p className="truncate text-sm text-ink-500">{o.buyer_name ? `${o.buyer_name} · ` : ''}{o.buyer_email}</p>
              <p className="text-sm">Reference <b className="tracking-wider">{o.payment_ref}</b> · sent {formatIst(o.payment_submitted_at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
            </div>
            {canEdit && (
              <div className="flex shrink-0 gap-2">
                <Button size="sm" loading={busy === o.id} onClick={() => confirm(o)}>Money received</Button>
                <Button size="sm" variant="ghost" disabled={busy === o.id} onClick={() => reject(o)}>Not received</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

async function refundOrder(order, toast) {
  const reason = await askText({ title: `Refund ${formatInr(order.amount_inr)}?`, message: `To ${order.buyer_email}\n\nTest mode: no real money moves yet. The order is marked refunded and the buyer loses access.`, label: 'Reason (shown to the buyer)', defaultValue: 'Refund requested', confirmLabel: 'Refund', danger: true })
  if (reason === null) return null
  const why = reason.trim() || 'Refunded by creator'
  const { error } = await supabase.rpc('refund_order', { p_order_id: order.id, p_reason: why })
  if (error) {
    toast(errorMessage(error), 'error')
    return null
  }
  toast('Order refunded')
  return { status: 'refunded', refunded_at: new Date().toISOString(), refund_reason: why }
}

function Orders({ orders, onPatch, canEdit }) {
  const toast = useToast()
  const [busy, setBusy] = useState(null)
  const [view, setView] = useViewMode('orders')
  if (!orders.length) return <Empty icon={Receipt} title="No sales yet">Publish a product and add a Products block to your page.</Empty>

  async function refund(o) {
    setBusy(o.id)
    const patch = await refundOrder(o, toast)
    setBusy(null)
    if (patch) onPatch(o.id, patch)
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/5 p-3">
        <ViewToggle value={view} onChange={setView} />
        <Button variant="outline" size="sm" onClick={() => exportCsv(orders, 'orders.csv')}><Download className="size-4" /> Export CSV</Button>
      </div>
      {view === 'table' ? (
        <DataTable
          bare
          rows={orders}
          defaultSort={{ key: 'created_at', dir: -1 }}
          columns={[
            { key: 'item', label: 'Item', value: (o) => (o.kind === 'tip' ? 'Tip' : o.product_title), render: (o) => <span className="block truncate">{o.kind === 'tip' ? '☕ Tip' : o.product_title}</span> },
            { key: 'buyer', label: 'Buyer', value: (o) => o.buyer_name || o.buyer_email, className: 'max-w-56 truncate text-ink-600', render: (o) => o.buyer_name || o.buyer_email },
            { key: 'created_at', label: 'Date', value: (o) => o.created_at, className: 'whitespace-nowrap text-ink-500', render: (o) => formatIst(o.created_at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) },
            { key: 'coupon_code', label: 'Coupon', value: (o) => o.coupon_code, className: 'text-ink-600', render: (o) => o.coupon_code || '—' },
            { key: 'status', label: 'Status', value: (o) => o.status, render: (o) => <Badge tone={STATUS_TONE[o.status] || 'neutral'}>{STATUS_LABEL[o.status] || o.status}</Badge> },
            { key: 'amount_inr', label: 'Amount', align: 'right', value: (o) => o.amount_inr, className: 'font-semibold whitespace-nowrap', render: (o) => formatInr(o.amount_inr) },
            { key: 'actions', label: '', align: 'right', render: (o) => canEdit && o.status === 'paid' && <Button variant="ghost" size="sm" className="px-3" loading={busy === o.id} onClick={() => refund(o)}><Undo2 className="size-4" /> Refund</Button> },
          ]}
        />
      ) : (
      <ul className="divide-y divide-ink/5">
        {orders.map((o) => {
          const expired = o.access_expires_at && new Date(o.access_expires_at) < new Date()
          return (
            <li key={o.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{o.kind === 'tip' ? `☕ Tip${o.note ? ` — “${o.note}”` : ''}` : o.product_title}{o.upsell_of && <span className="ml-2 text-xs font-semibold text-ink-500">· upsell</span>}</p>
                <p className="truncate text-sm text-ink-500">{o.buyer_name ? `${o.buyer_name} · ` : ''}{o.buyer_email}{o.coupon_code && ` · ${o.coupon_code}`}</p>
                {o.product_type === 'membership' && o.access_expires_at && o.status === 'paid' && (
                  <p className={`text-xs font-semibold ${expired ? 'text-red-600' : 'text-teal'}`}>Membership {expired ? 'expired' : 'active until'} {formatIst(o.access_expires_at, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                )}
                {o.status === 'refunded' && o.refund_reason && <p className="truncate text-xs text-red-600">Refunded: {o.refund_reason}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm sm:flex-nowrap sm:gap-3">
                <span className="text-ink-400">{formatIst(o.created_at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                {o.payment_provider === 'test' && <Badge>Test</Badge>}
                <Badge tone={STATUS_TONE[o.status] || 'neutral'}>{STATUS_LABEL[o.status] || o.status}</Badge>
                <span className="ml-auto w-20 text-right font-display text-lg font-bold sm:ml-0">{formatInr(o.amount_inr)}</span>
                {canEdit && o.status === 'paid' && (
                  <Button variant="ghost" size="sm" className="px-3" loading={busy === o.id} onClick={() => refund(o)} title="Refund this order (test mode)"><Undo2 className="size-4" /> Refund</Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      )}
      <p className="border-t border-ink/5 px-5 py-3 text-xs text-ink-500">Refunds are in test mode — no real money moves yet. Refunding cancels any booked sessions and ends the buyer’s access.</p>
    </Card>
  )
}

function Questions({ orders, onPatch, canEdit }) {
  const toast = useToast()
  const [drafts, setDrafts] = useState({})
  const [busy, setBusy] = useState(null)
  const [view, setView] = useViewMode('questions')
  const [openId, setOpenId] = useState(null)
  const rows = useMemo(
    () =>
      orders
        .filter((o) => o.product_type === 'question' && o.question && (o.status === 'paid' || o.status === 'refunded'))
        .sort((a, b) => (!!a.answer === !!b.answer ? new Date(b.created_at) - new Date(a.created_at) : a.answer ? 1 : -1)),
    [orders],
  )
  if (!rows.length) return <Empty icon={MessageCircleQuestionMark} title="No questions yet">Create a Priority question product so fans can pay to ask you anything.</Empty>

  async function answer(o) {
    const text = (drafts[o.id] ?? '').trim()
    if (!text) return toast('Write an answer first', 'error')
    setBusy(o.id)
    const { error } = await supabase.rpc('answer_question', { p_order_id: o.id, p_answer: text })
    setBusy(null)
    if (error) return toast(errorMessage(error), 'error')
    onPatch(o.id, { answer: text, answered_at: new Date().toISOString() })
    setDrafts((d) => ({ ...d, [o.id]: undefined }))
    toast('Answer sent — it’s on the buyer’s order page')
  }

  const opened = rows.find((o) => o.id === openId)
  const card = (o) => {
        const editing = drafts[o.id] !== undefined
        return (
          <Card key={o.id} className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              {o.answer ? <Badge tone="green">Answered</Badge> : <Badge tone="lilac">Awaiting reply</Badge>}
              {o.status === 'refunded' && <Badge tone="red">refunded</Badge>}
              <span className="text-xs text-ink-500">{o.product_title} · {formatIst(o.created_at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {formatInr(o.amount_inr)}</span>
            </div>
            <p className="mt-2 truncate text-sm font-semibold">{o.buyer_name || 'Buyer'} <span className="font-normal text-ink-500">· {o.buyer_email}</span></p>
            <p className="mt-2 rounded-2xl bg-cream p-4 text-[15px] leading-relaxed break-words whitespace-pre-line">{o.question}</p>
            {o.answer && !editing ? (
              <div className="mt-3">
                <p className="eyebrow text-ink-500">Your answer · {formatIst(o.answered_at, { day: 'numeric', month: 'short' })}</p>
                <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-line">{o.answer}</p>
                {canEdit && <Button variant="soft" size="sm" className="mt-3" onClick={() => setDrafts((d) => ({ ...d, [o.id]: o.answer }))}>Edit answer</Button>}
              </div>
            ) : canEdit && o.status === 'paid' ? (
              <div className="mt-3 grid gap-2">
                <Textarea rows={4} maxLength={4000} placeholder="Write your answer — links are clickable for the buyer." value={drafts[o.id] ?? ''} onChange={(e) => setDrafts((d) => ({ ...d, [o.id]: e.target.value }))} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" loading={busy === o.id} onClick={() => answer(o)}>Send answer</Button>
                  {editing && o.answer && <Button variant="ghost" size="sm" onClick={() => setDrafts((d) => ({ ...d, [o.id]: undefined }))}>Cancel</Button>}
                </div>
              </div>
            ) : null}
          </Card>
        )
  }

  return (
    <div className="grid gap-3">
      <ViewToggle value={view} onChange={setView} />
      {view === 'table' ? (
        <DataTable
          rows={rows}
          onRowClick={(o) => setOpenId(o.id)}
          defaultSort={{ key: 'created_at', dir: -1 }}
          columns={[
            { key: 'buyer', label: 'Buyer', value: (o) => o.buyer_name || o.buyer_email, render: (o) => <span className="block truncate">{o.buyer_name || o.buyer_email}</span> },
            { key: 'question', label: 'Question', value: (o) => o.question, className: 'max-w-72 truncate text-ink-600' },
            { key: 'answer', label: 'Status', value: (o) => (o.answer ? 'Answered' : 'Awaiting reply'), render: (o) => (o.answer ? <Badge tone="green">Answered</Badge> : <Badge tone="lilac">Awaiting reply</Badge>) },
            { key: 'created_at', label: 'Date', value: (o) => o.created_at, className: 'whitespace-nowrap text-ink-500', render: (o) => formatIst(o.created_at, { day: 'numeric', month: 'short' }) },
            { key: 'amount_inr', label: 'Amount', align: 'right', value: (o) => o.amount_inr, className: 'font-semibold', render: (o) => formatInr(o.amount_inr) },
          ]}
        />
      ) : rows.map((o) => <div key={o.id}>{card(o)}</div>)}
      <Modal open={Boolean(opened)} onClose={() => setOpenId(null)} title="Question" wide>{opened && card(opened)}</Modal>
    </div>
  )
}

const DISPUTE_REASON = {
  not_received: 'Didn’t receive it',
  not_as_described: 'Not as described',
  session_missed: 'Session missed',
  duplicate: 'Charged twice',
  other: 'Other',
}
const DISPUTE_STATUS = {
  open: ['Open', 'red'],
  creator_responded: ['You responded', 'lilac'],
  resolved_refund: ['Refunded', 'neutral'],
  resolved_rejected: ['Closed', 'neutral'],
}
const isLive = (d) => d.status === 'open' || d.status === 'creator_responded'

function Disputes({ pageId, orders, onPatch, canEdit }) {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [busy, setBusy] = useState(null)
  const [view, setView] = useViewMode('disputes')
  const [openId, setOpenId] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('disputes').select('*').eq('page_id', pageId).order('created_at', { ascending: false }).limit(200)
    if (error) toast(errorMessage(error), 'error')
    setRows(data || [])
  }, [pageId, toast])
  useEffect(() => {
    load()
  }, [load])

  if (rows === null) return <div className="grid h-40 place-items-center"><Spinner /></div>
  if (!rows.length) return <Empty icon={ShieldAlert} title="No disputes">If a buyer reports a problem with an order, it shows up here so you can respond or refund.</Empty>

  async function respond(d) {
    const text = (drafts[d.id] || '').trim()
    if (!text) return toast('Write a response first', 'error')
    setBusy(d.id)
    const { error } = await supabase.rpc('respond_dispute', { p_dispute_id: d.id, p_response: text })
    setBusy(null)
    if (error) return toast(errorMessage(error), 'error')
    toast('Response sent to the buyer')
    setDrafts((x) => ({ ...x, [d.id]: '' }))
    load()
  }

  async function refund(d, order) {
    setBusy(`r${d.id}`)
    const patch = await refundOrder(order, toast)
    setBusy(null)
    if (patch) {
      onPatch(order.id, patch)
      load()
    }
  }

  const sorted = [...rows].sort((a, b) => Number(isLive(b)) - Number(isLive(a)))

  const orderOf = (d) => orders.find((o) => o.id === d.order_id)
  const opened = rows.find((d) => d.id === openId)
  const card = (d) => {
        const order = orderOf(d)
        const [label, tone] = DISPUTE_STATUS[d.status] || [d.status, 'neutral']
        return (
          <Card key={d.id} className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={tone}>{label}</Badge>
              <span className="text-sm font-semibold">{DISPUTE_REASON[d.reason] || d.reason}</span>
              <span className="text-xs text-ink-500">· {formatIst(d.created_at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
            </div>
            {order && (
              <p className="mt-2 truncate text-sm text-ink-600">{order.product_title || 'Order'} · {formatInr(order.amount_inr)} · {order.buyer_name ? `${order.buyer_name} · ` : ''}{order.buyer_email}</p>
            )}
            {d.details && <p className="mt-3 rounded-2xl bg-cream p-4 text-sm leading-relaxed break-words whitespace-pre-line">{d.details}</p>}
            {d.creator_response && (
              <div className="mt-3 rounded-2xl bg-lilac-100 p-4 text-sm">
                <p className="eyebrow mb-1 text-ink-500">Your response</p>
                <p className="break-words whitespace-pre-line">{d.creator_response}</p>
              </div>
            )}
            {d.admin_note && <p className="mt-2 text-xs text-ink-500">Note from our team: {d.admin_note}</p>}
            {canEdit && isLive(d) && (
              <div className="mt-3 grid gap-2">
                <Textarea rows={3} maxLength={2000} placeholder={d.creator_response ? 'Update your response…' : 'Reply to the buyer — explain or offer a fix'} value={drafts[d.id] || ''} onChange={(e) => setDrafts((x) => ({ ...x, [d.id]: e.target.value }))} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" loading={busy === d.id} onClick={() => respond(d)}>Send response</Button>
                  {order?.status === 'paid' && <Button variant="dangerSoft" size="sm" loading={busy === `r${d.id}`} onClick={() => refund(d, order)}><Undo2 className="size-4" /> Refund order</Button>}
                </div>
              </div>
            )}
          </Card>
        )
  }

  return (
    <div className="grid gap-3">
      <ViewToggle value={view} onChange={setView} />
      {view === 'table' ? (
        <DataTable
          rows={sorted}
          onRowClick={(d) => setOpenId(d.id)}
          columns={[
            { key: 'reason', label: 'Reason', value: (d) => DISPUTE_REASON[d.reason] || d.reason },
            { key: 'buyer', label: 'Buyer', value: (d) => orderOf(d)?.buyer_email, className: 'max-w-56 truncate text-ink-600' },
            { key: 'status', label: 'Status', value: (d) => (DISPUTE_STATUS[d.status] || [d.status])[0], render: (d) => <Badge tone={(DISPUTE_STATUS[d.status] || [])[1] || 'neutral'}>{(DISPUTE_STATUS[d.status] || [d.status])[0]}</Badge> },
            { key: 'created_at', label: 'Opened', value: (d) => d.created_at, className: 'whitespace-nowrap text-ink-500', render: (d) => formatIst(d.created_at, { day: 'numeric', month: 'short' }) },
            { key: 'amount', label: 'Amount', align: 'right', value: (d) => orderOf(d)?.amount_inr, className: 'font-semibold', render: (d) => (orderOf(d) ? formatInr(orderOf(d).amount_inr) : '—') },
          ]}
        />
      ) : sorted.map((d) => <div key={d.id}>{card(d)}</div>)}
      <Modal open={Boolean(opened)} onClose={() => setOpenId(null)} title="Dispute" wide>{opened && card(opened)}</Modal>
      <p className="px-1 text-xs text-ink-500">Unresolved disputes are reviewed by our team. Refunds are in test mode — no real money moves yet.</p>
    </div>
  )
}

function Bookings({ pageId }) {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [past, setPast] = useState(false)
  const [view, setView] = useViewMode('bookings')

  const load = useCallback(async () => {
    let q = supabase.from('bookings').select('*, products(title, private)').eq('page_id', pageId)
    q = past ? q.lt('starts_at', new Date().toISOString()).order('starts_at', { ascending: false }) : q.gte('starts_at', new Date(Date.now() - 2 * 3600_000).toISOString()).order('starts_at')
    const { data } = await q.limit(200)
    setRows(data || [])
  }, [pageId, past])
  useEffect(() => {
    load()
  }, [load])

  async function setStatus(b, status) {
    const reason = status === 'cancelled' ? await askText({ title: 'Cancel this booking?', message: 'The buyer will need a refund once payments are live.', label: 'Reason for cancelling', confirmLabel: 'Cancel booking', danger: true }) : null
    if (status === 'cancelled' && reason === null) return
    const { error } = await supabase.from('bookings').update({ status, cancel_reason: reason }).eq('id', b.id)
    if (error) return toast(error.message, 'error')
    toast(status === 'cancelled' ? 'Booking cancelled — the slot is free again' : 'Marked as completed')
    load()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs label="When" value={past} onChange={setPast} tabs={[{ key: false, label: 'Upcoming' }, { key: true, label: 'Past' }]} />
        <ViewToggle value={view} onChange={setView} />
      </div>
      {rows === null ? (
        <div className="grid h-40 place-items-center"><Spinner /></div>
      ) : rows.length === 0 ? (
        <Empty icon={CalendarCheck} title={past ? 'No past sessions' : 'No upcoming sessions'}>Sell a 1:1 session product to start taking bookings.</Empty>
      ) : view === 'table' ? (
        <DataTable
          rows={rows}
          columns={[
            { key: 'title', label: 'Session', value: (b) => b.products?.title || 'Session' },
            { key: 'starts_at', label: 'When (IST)', value: (b) => b.starts_at, className: 'whitespace-nowrap text-ink-600', render: (b) => formatIst(b.starts_at, { day: 'numeric', month: 'short', weekday: 'short', hour: 'numeric', minute: '2-digit' }) },
            { key: 'buyer', label: 'Buyer', value: (b) => b.buyer_name || b.buyer_email, className: 'max-w-56 truncate text-ink-600' },
            { key: 'buyer_phone', label: 'Phone', value: (b) => b.buyer_phone, className: 'whitespace-nowrap text-ink-600', render: (b) => b.buyer_phone || '—' },
            { key: 'status', label: 'Status', value: (b) => b.status, render: (b) => <Badge tone={b.status === 'confirmed' ? 'green' : b.status === 'cancelled' ? 'red' : 'neutral'}>{b.status}</Badge> },
            { key: 'actions', label: '', align: 'right', render: (b) => b.status === 'confirmed' && (
              past ? <Button variant="soft" size="sm" onClick={() => setStatus(b, 'completed')}>Mark done</Button> : <Button variant="dangerSoft" size="sm" onClick={() => setStatus(b, 'cancelled')}>Cancel</Button>
            ) },
          ]}
        />
      ) : (
        <div className="grid gap-2.5">
          {rows.map((b) => (
            <Card key={b.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
              <div className="grid w-16 shrink-0 place-items-center rounded-2xl bg-lime py-2 text-center">
                <span className="text-[10px] font-bold uppercase">{formatIst(b.starts_at, { month: 'short' })}</span>
                <span className="font-display text-2xl leading-none font-bold">{formatIst(b.starts_at, { day: 'numeric' })}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{b.products?.title || 'Session'} · {formatIst(b.starts_at, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} IST</p>
                <p className="truncate text-sm text-ink-500">{b.buyer_name || 'Buyer'} · {b.buyer_email}{b.buyer_phone && ` · ${b.buyer_phone}`}</p>
                {b.cancel_reason && <p className="text-xs text-red-600">Cancelled: {b.cancel_reason}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={b.status === 'confirmed' ? 'green' : b.status === 'cancelled' ? 'red' : 'neutral'}>{b.status}</Badge>
                {b.status === 'confirmed' && (
                  <>
                    <Button variant="outline" size="sm" href={calendarUrl({ title: `${b.products?.title} with ${b.buyer_name || b.buyer_email}`, start: b.starts_at, end: b.ends_at, details: b.products?.private?.meeting_url || '' })} target="_blank" rel="noreferrer">Add to calendar</Button>
                    {past ? (
                      <Button variant="soft" size="sm" onClick={() => setStatus(b, 'completed')}>Mark done</Button>
                    ) : (
                      <Button variant="dangerSoft" size="sm" onClick={() => setStatus(b, 'cancelled')}>Cancel</Button>
                    )}
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function Payouts({ total }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-3xl bg-ink p-7 text-white">
        <p className="eyebrow text-lime">Available balance</p>
        <p className="mt-3 font-display text-5xl font-bold">{formatInr(total)}</p>
        <p className="mt-2 text-sm text-white/60">From test orders — not real money.</p>
        <button type="button" disabled className="mt-6 h-11 rounded-full bg-white/10 px-5 text-sm font-semibold text-white/50">Withdraw to bank / UPI</button>
      </div>
      <Card className="p-7">
        <p className="eyebrow text-ink-500">Payouts — coming soon</p>
        <h3 className="mt-3 text-xl font-bold">Get paid to your UPI or bank</h3>
        <ul className="mt-4 space-y-2 text-sm text-ink-600">
          <li>• KYC (PAN + bank account) through our payment partner</li>
          <li>• Weekly automatic payouts, minus payment gateway fees</li>
          <li>• GST invoices and TDS statements for your accountant</li>
        </ul>
      </Card>
    </div>
  )
}

export default function Sales() {
  const { page, canEdit } = usePage()
  const [tab, setTab] = useState('orders')
  const [orders, setOrders] = useState(null)
  const patchOrder = useCallback((id, patch) => setOrders((list) => list.map((o) => (o.id === id ? { ...o, ...patch } : o))), [])

  useEffect(() => {
    supabase.from('orders').select(ORDER_COLUMNS).eq('page_id', page.id).order('created_at', { ascending: false }).limit(1000).then(({ data }) => setOrders(data || []))
  }, [page.id])

  const stats = useMemo(() => {
    if (!orders) return null
    const paid = orders.filter((o) => o.status === 'paid')
    const since = Date.now() - 30 * 86400_000
    const series = Array.from({ length: 30 }, (_, i) => ({ day: istDay(Date.now() - (29 - i) * 86400_000), revenue: 0 }))
    for (const o of paid) {
      const s = series.find((x) => x.day === istDay(o.created_at))
      if (s) s.revenue += o.amount_inr
    }
    return {
      total: paid.reduce((s, o) => s + o.amount_inr, 0),
      month: paid.filter((o) => new Date(o.created_at).getTime() > since).reduce((s, o) => s + o.amount_inr, 0),
      count: paid.length,
      tips: paid.filter((o) => o.kind === 'tip').reduce((s, o) => s + o.amount_inr, 0),
      series,
    }
  }, [orders])

  return (
    <div className="space-y-4">
      <PageHeading title="Sales." italic="Your earnings." />
      {!stats ? (
        <div className="grid h-60 place-items-center"><Spinner /></div>
      ) : (
        <>
          <Stats
            items={[
              ['Total earned', formatInr(stats.total), 'bg-ink text-white'],
              ['Last 30 days', formatInr(stats.month), 'bg-lime'],
              ['Orders', stats.count, 'bg-white'],
              ['Tips', formatInr(stats.tips), 'bg-lilac-100'],
            ]}
          />
          <Card className="p-5 sm:p-7">
            <p className="eyebrow flex items-center gap-1.5 text-ink-500"><IndianRupee className="size-3.5" /> Revenue per day · 30 days</p>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.series} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#15161A" strokeOpacity={0.06} vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#6B6E78' }} tickFormatter={(d) => new Date(d).getDate()} minTickGap={10} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#6B6E78' }} />
                  <Tooltip cursor={{ fill: 'rgba(21,22,26,.04)' }} formatter={(v) => formatInr(v)} contentStyle={{ borderRadius: 14, border: 'none', boxShadow: '0 12px 32px -12px rgba(21,22,26,.25)' }} labelFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} />
                  <Bar dataKey="revenue" name="Revenue" fill="#15161A" radius={[8, 8, 8, 8]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Tabs label="Sales" tabs={TABS} value={tab} onChange={setTab} />
          {tab === 'orders' && <UpiToConfirm orders={orders} onPatch={patchOrder} canEdit={canEdit} />}
          {tab === 'orders' && <Orders orders={orders} onPatch={patchOrder} canEdit={canEdit} />}
          {tab === 'questions' && <Questions orders={orders} onPatch={patchOrder} canEdit={canEdit} />}
          {tab === 'disputes' && <Disputes pageId={page.id} orders={orders} onPatch={patchOrder} canEdit={canEdit} />}
          {tab === 'bookings' && <Bookings pageId={page.id} />}
          {tab === 'payouts' && <Payouts total={stats.total} />}
        </>
      )}
    </div>
  )
}
