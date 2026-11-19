import { useCallback, useEffect, useState } from 'react'
import { BellRing, LifeBuoy } from 'lucide-react'
import { errorMessage, invokeFunction, supabase } from '../../lib/supabase'
import { formatInr } from '../../lib/images'
import { Alert, Badge, Button, Card, Empty, Input, Modal, Spinner, Tabs, Textarea, useToast } from '../../components/ui'
import { PageHeading } from '../dashboard/DashboardLayout'

export const CATEGORY_LABEL = {
  payment_failed: 'Payment failed or pending',
  not_received: 'Did not receive the product',
  refund: 'Refund request',
  creator_issue: 'Problem with the creator',
  other: 'Something else',
}
const STATUS = { open: ['Open', 'red'], in_progress: ['Waiting', 'lilac'], resolved: ['Resolved', 'green'] }
// Failed payments first, then missing products, then complaints, then everything else
const RANK = { payment_failed: 0, not_received: 1, refund: 2, creator_issue: 2, other: 3 }
const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** Where new tickets are sent. At least one of email and WhatsApp must be set. */
function AlertSettings() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [wa, setWa] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('app_settings').select('support_email, support_whatsapp').maybeSingle().then(({ data }) => {
      setEmail(data?.support_email || '')
      setWa(data?.support_whatsapp ? data.support_whatsapp.replace(/^91(\d{10})$/, '$1') : '')
      setLoaded(true)
    })
  }, [])

  async function save() {
    setBusy(true)
    const { error } = await supabase.rpc('admin_set_support_contacts', { p_email: email, p_whatsapp: wa })
    setBusy(false)
    if (error) return toast(errorMessage(error), 'error')
    toast('Alert contacts saved')
  }

  const none = loaded && !email.trim() && !wa.trim()
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2"><BellRing className="size-5" /><h2 className="text-lg font-bold">Where to alert you</h2></div>
      <p className="mt-1 text-sm text-ink-500">New support requests are sent here. Set at least one; both is best.</p>
      {none && <div className="mt-3"><Alert>No alert contact yet. Tickets still appear below, but nothing will notify you.</Alert></div>}
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="support@yourdomain.com" />
        <Input label="WhatsApp number" inputMode="tel" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="9876543210" />
        <Button onClick={save} loading={busy} disabled={!loaded || none}>Save</Button>
      </div>
    </Card>
  )
}

function TicketModal({ ticket, onClose, onChanged }) {
  const toast = useToast()
  const [order, setOrder] = useState(null)
  const [reply, setReply] = useState(ticket.admin_reply || '')
  const [note, setNote] = useState(ticket.admin_note || '')
  const [busy, setBusy] = useState('')

  useEffect(() => {
    // Opening buyer details is recorded in the audit log
    supabase.rpc('admin_log_view', { p_what: 'support_ticket', p_id: String(ticket.ticket_no) }).then(() => {})
    supabase.from('orders').select('id, product_title, kind, amount_inr, status, payment_provider, payment_ref, created_at, paid_at, pages(username, display_name)').eq('id', ticket.order_id).maybeSingle().then(({ data }) => setOrder(data))
  }, [ticket])

  async function openOrder() {
    const { data, error } = await supabase.rpc('admin_ticket_order_link', { p_id: ticket.id })
    if (error) return toast(errorMessage(error), 'error')
    window.open(`/order/${data}`, '_blank', 'noopener')
  }

  async function save(status) {
    setBusy(status)
    const { error } = await supabase.rpc('admin_update_ticket', { p_id: ticket.id, p_status: status, p_reply: reply, p_note: note })
    if (error) {
      setBusy('')
      return toast(errorMessage(error), 'error')
    }
    const replied = reply.trim() && reply.trim() !== (ticket.admin_reply || '')
    if (replied) {
      try {
        const r = await invokeFunction('support', { action: 'reply', id: ticket.id })
        toast(r.email === 'sent' ? 'Reply saved and emailed to the buyer' : 'Reply saved. The buyer sees it on their order page (email is not set up yet)')
      } catch {
        toast('Reply saved. The buyer sees it on their order page')
      }
    } else {
      toast(status === 'resolved' ? 'Marked resolved' : 'Saved')
    }
    setBusy('')
    onChanged()
  }

  const page = order && (Array.isArray(order.pages) ? order.pages[0] : order.pages)
  return (
    <Modal open onClose={onClose} title={`Request #${ticket.ticket_no}`} wide>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS[ticket.status][1]}>{STATUS[ticket.status][0]}</Badge>
        {ticket.priority === 'high' && <Badge tone="red">High priority</Badge>}
        <Badge>{CATEGORY_LABEL[ticket.category]}</Badge>
        <span className="text-xs text-ink-400">{when(ticket.created_at)}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-cream p-4 text-sm">
          <p className="eyebrow text-ink-500">Buyer</p>
          <p className="mt-1 font-semibold">{ticket.buyer_name || 'No name given'}</p>
          <p className="break-all">{ticket.buyer_email}</p>
          {ticket.buyer_phone && <p>{ticket.buyer_phone}</p>}
        </div>
        <div className="rounded-2xl bg-cream p-4 text-sm">
          <p className="eyebrow text-ink-500">Order</p>
          {order ? (
            <>
              <p className="mt-1 font-semibold break-words">{order.product_title || (order.kind === 'tip' ? 'Tip' : 'Order')}</p>
              <p>{formatInr(order.amount_inr)} · <b className="capitalize">{order.status}</b> · {order.payment_provider}</p>
              {order.payment_ref && <p className="break-all text-ink-600">Ref: {order.payment_ref}</p>}
              {page && <a className="font-medium underline" href={`/${page.username}`} target="_blank" rel="noreferrer">Creator: {page.display_name || page.username}</a>}
            </>
          ) : <Spinner />}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-ink/10 p-4">
        <p className="eyebrow text-ink-500">Their message</p>
        <p className="mt-1 text-[15px] break-words whitespace-pre-line">{ticket.message}</p>
      </div>

      <p className="mt-3 text-xs text-ink-500">
        Alerts: {Object.entries(ticket.notified || {}).map(([k, v]) => `${k} ${v}`).join(' · ') || 'none recorded'}
      </p>

      <Textarea className="mt-4" label="Your reply (the buyer sees it on their order page, and gets an email if email is set up)" rows={4} maxLength={2000} value={reply} onChange={(e) => setReply(e.target.value)} />
      <Textarea className="mt-3" label="Private note (only you see this)" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Close</Button>
        <Button variant="outline" onClick={openOrder}>Open order page</Button>
        <Button variant="soft" loading={busy === 'in_progress'} onClick={() => save('in_progress')}>Save, waiting</Button>
        {ticket.status === 'resolved'
          ? <Button variant="outline" loading={busy === 'open'} onClick={() => save('open')}>Reopen</Button>
          : <Button loading={busy === 'resolved'} onClick={() => save('resolved')}>Mark resolved</Button>}
      </div>
    </Modal>
  )
}

export default function AdminSupport() {
  const [rows, setRows] = useState(null)
  const [tab, setTab] = useState('active')
  const [openId, setOpenId] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(300)
    setRows(data || [])
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const active = (rows || []).filter((r) => r.status !== 'resolved')
  const shown = (rows || [])
    .filter((r) => (tab === 'active' ? r.status !== 'resolved' : tab === 'resolved' ? r.status === 'resolved' : true))
    .sort((a, b) => (tab === 'active' ? RANK[a.category] - RANK[b.category] || (b.priority === 'high') - (a.priority === 'high') : 0) || new Date(b.created_at) - new Date(a.created_at))
  const opened = (rows || []).find((r) => r.id === openId)

  return (
    <div className="space-y-4">
      <PageHeading title="Buyer support." italic={`${active.length} open.`} />
      <AlertSettings />
      <Tabs label="Filter" value={tab} onChange={setTab} tabs={[
        { key: 'active', label: 'Needs action', count: active.length },
        { key: 'resolved', label: 'Resolved' },
        { key: 'all', label: 'All' },
      ]} />
      {rows === null ? (
        <div className="grid h-40 place-items-center"><Spinner /></div>
      ) : shown.length === 0 ? (
        <Empty icon={LifeBuoy} title="Nothing here" >Requests from the Support button on every order page appear here.</Empty>
      ) : (
        <div className="space-y-2.5">
          {shown.map((r) => (
            <Card key={r.id} className="flex cursor-pointer flex-col gap-2 p-4 transition hover:shadow-lift sm:flex-row sm:items-center" onClick={() => setOpenId(r.id)}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">#{r.ticket_no}</span>
                  <Badge tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</Badge>
                  {r.priority === 'high' && r.status !== 'resolved' && <Badge tone="red">High</Badge>}
                  <Badge>{CATEGORY_LABEL[r.category]}</Badge>
                </div>
                <p className="mt-1 truncate text-sm text-ink-600">{r.message}</p>
              </div>
              <p className="shrink-0 text-xs text-ink-400">{when(r.created_at)}</p>
            </Card>
          ))}
        </div>
      )}
      {opened && <TicketModal key={opened.id} ticket={opened} onClose={() => setOpenId(null)} onChanged={() => { setOpenId(null); load() }} />}
    </div>
  )
}
