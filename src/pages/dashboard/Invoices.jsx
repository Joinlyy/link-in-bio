import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { BellRing, Check, ChevronDown, Download, Mail, Pencil, Plus, ReceiptIndianRupee, Send, Trash2, X } from 'lucide-react'
import { usePage } from '../../context/PageContext'
import { errorMessage, supabase } from '../../lib/supabase'
import { whatsappUrl } from '../../lib/embeds'
import { WhatsappIcon } from '../../components/icons'
import { Alert, Badge, Button, Card, Empty, Input, Modal, Select, Spinner, Stats, Tabs, Textarea, useToast, askConfirm } from '../../components/ui'
import {
  DEFAULT_SAC, IFSC_RE, PAN_RE, STATE_OPTIONS, addDays, computeTax, formatDate, formatMoney, fyStart, gstinError, isOverdue,
  istToday, lineAmount, paymentLines, stateName,
} from '../../lib/gst'
import { DataTable, useViewMode, ViewToggle } from '../../components/DataTable'
import { PageHeading } from './DashboardLayout'

const STATUS = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'lilac' },
  overdue: { label: 'Overdue', tone: 'red' },
  paid: { label: 'Paid', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'sent', label: 'Sent' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'paid', label: 'Paid' },
  { key: 'cancelled', label: 'Cancelled' },
]

const statusOf = (inv) => (isOverdue(inv) ? 'overdue' : inv.status)

const blankItem = () => ({ description: '', sac: DEFAULT_SAC, qty: 1, rate: '' })

// ---------------------------------------------------------------------------
// Billing details (pages.billing)
// ---------------------------------------------------------------------------
function BillingCard({ billing, onSave, canEdit }) {
  const [b, setB] = useState(billing)
  const [open, setOpen] = useState(!billing.legal_name)
  const set = (patch) => setB((x) => ({ ...x, ...patch }))

  const gstErr = gstinError(b.gstin)
  const panErr = b.pan && !PAN_RE.test(b.pan) ? 'PAN should look like ABCDE1234F' : null
  const ifscErr = b.ifsc && !IFSC_RE.test(b.ifsc) ? 'IFSC should look like HDFC0001234' : null
  const stateMismatch = b.gstin && !gstErr && b.state_code && b.gstin.slice(0, 2) !== b.state_code
  const rate = Number(b.gst_rate)
  const rateErr = b.gst_rate !== '' && b.gst_rate != null && (Number.isNaN(rate) || rate < 0 || rate > 28) ? 'Between 0 and 28' : null
  const dirty = JSON.stringify(b) !== JSON.stringify(billing)

  function save() {
    const clean = Object.fromEntries(
      Object.entries({ ...b, gst_rate: b.gst_rate === '' || b.gst_rate == null ? 18 : Number(b.gst_rate) }).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]),
    )
    onSave(clean)
  }

  return (
    <Card className="p-5 sm:p-6">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="eyebrow block text-ink-500">Billing details</span>
          <span className="mt-1 block truncate font-semibold">
            {billing.legal_name || 'Add your details to start invoicing'}
            {billing.gstin ? <span className="font-normal text-ink-500"> · GSTIN {billing.gstin}</span> : billing.legal_name ? <span className="font-normal text-ink-500"> · No GSTIN (no GST charged)</span> : null}
          </span>
        </span>
        <ChevronDown className={`size-5 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Legal / business name" value={b.legal_name || ''} maxLength={160} onChange={(e) => set({ legal_name: e.target.value })} disabled={!canEdit} />
            <Input
              label="GSTIN (optional)"
              value={b.gstin || ''}
              maxLength={15}
              placeholder="27ABCDE1234F1Z5"
              error={gstErr}
              hint="Leave empty if you’re not GST-registered — invoices won’t charge GST."
              onChange={(e) => {
                const v = e.target.value.toUpperCase().replace(/\s/g, '')
                const code = v.slice(0, 2)
                set({ gstin: v, ...(v.length >= 2 && stateName(code) && !b.state_code ? { state_code: code, state: stateName(code) } : {}), ...(v.length === 15 && !b.pan ? { pan: v.slice(2, 12) } : {}) })
              }}
              disabled={!canEdit}
            />
            <Input label="PAN" value={b.pan || ''} maxLength={10} placeholder="ABCDE1234F" error={panErr} onChange={(e) => set({ pan: e.target.value.toUpperCase().replace(/\s/g, '') })} disabled={!canEdit} />
            <Select
              label="State"
              value={b.state_code || ''}
              options={STATE_OPTIONS}
              hint={stateMismatch ? 'Doesn’t match your GSTIN’s state code — GST split uses the GSTIN.' : undefined}
              onChange={(e) => set({ state_code: e.target.value, state: stateName(e.target.value) })}
              disabled={!canEdit}
            />
            <Textarea className="sm:col-span-2" label="Address" rows={2} maxLength={400} value={b.address || ''} onChange={(e) => set({ address: e.target.value })} disabled={!canEdit} />
            <Input label="Email" type="email" value={b.email || ''} onChange={(e) => set({ email: e.target.value })} disabled={!canEdit} />
            <Input label="Phone" type="tel" value={b.phone || ''} onChange={(e) => set({ phone: e.target.value })} disabled={!canEdit} />
            <Input
              label="Invoice prefix"
              value={b.invoice_prefix || ''}
              maxLength={10}
              placeholder="INV"
              hint={`Numbers look like ${(b.invoice_prefix || 'INV').toUpperCase().replace(/[^A-Z0-9-]/g, '') || 'INV'}/${fyStart().slice(0, 4)}-${String((Number(fyStart().slice(0, 4)) + 1) % 100).padStart(2, '0')}/0001`}
              onChange={(e) => set({ invoice_prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })}
              disabled={!canEdit}
            />
            <Input label="GST rate (%)" type="number" min={0} max={28} step="0.01" value={b.gst_rate ?? 18} error={rateErr} onChange={(e) => set({ gst_rate: e.target.value })} disabled={!canEdit} />
          </div>
          <div>
            <p className="eyebrow mb-3 text-ink-500">Payment details (shown on invoices & reminders)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="UPI ID" value={b.upi_id || ''} placeholder="name@okhdfcbank" onChange={(e) => set({ upi_id: e.target.value.trim() })} disabled={!canEdit} />
              <Input label="Bank name" value={b.bank_name || ''} onChange={(e) => set({ bank_name: e.target.value })} disabled={!canEdit} />
              <Input label="Account holder name" value={b.account_name || ''} onChange={(e) => set({ account_name: e.target.value })} disabled={!canEdit} />
              <Input label="Account number" inputMode="numeric" value={b.account_number || ''} onChange={(e) => set({ account_number: e.target.value.replace(/[^0-9]/g, '') })} disabled={!canEdit} />
              <Input label="IFSC" value={b.ifsc || ''} maxLength={11} error={ifscErr} onChange={(e) => set({ ifsc: e.target.value.toUpperCase().trim() })} disabled={!canEdit} />
            </div>
          </div>
          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={save} disabled={!dirty || Boolean(gstErr || panErr || ifscErr || rateErr) || !b.legal_name?.trim()}>Save billing details</Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Create / edit invoice
// ---------------------------------------------------------------------------
function TaxPreview({ tax }) {
  const rows = [['Subtotal', tax.subtotal]]
  if (tax.mode === 'intra') rows.push([`CGST @ ${tax.rate / 2}%`, tax.cgst], [`SGST @ ${tax.rate / 2}%`, tax.sgst])
  if (tax.mode === 'inter') rows.push([`IGST @ ${tax.rate}%`, tax.igst])
  return (
    <div className="rounded-2xl bg-cream p-4 text-sm">
      {rows.map(([l, v]) => (
        <div key={l} className="flex justify-between py-0.5">
          <span className="text-ink-600">{l}</span>
          <span className="font-medium tabular-nums">{formatMoney(v)}</span>
        </div>
      ))}
      <div className="mt-2 flex justify-between border-t border-ink/10 pt-2 font-display text-lg font-bold">
        <span>Total</span>
        <span className="tabular-nums">{formatMoney(tax.total)}</span>
      </div>
      <p className="mt-2 text-xs text-ink-500">
        {tax.mode === 'none'
          ? 'No GST — add your GSTIN in Billing details to charge GST.'
          : tax.mode === 'intra'
            ? 'Same state as you → CGST + SGST.'
            : 'Different (or unknown) state → IGST.'}
      </p>
    </div>
  )
}

function InvoiceModal({ invoice, billing, deals, onClose, onSaved }) {
  const toast = useToast()
  const [inv, setInv] = useState(invoice)
  const [busy, setBusy] = useState(false)
  const set = (patch) => setInv((x) => ({ ...x, ...patch }))
  const items = inv.items?.length ? inv.items : [blankItem()]
  const setItem = (i, patch) => set({ items: items.map((it, j) => (j === i ? { ...it, ...patch } : it)) })

  // Drafts re-snapshot the seller on save; issued invoices keep their snapshot
  const isDraft = !inv.id || inv.status === 'draft'
  const seller = isDraft ? billing : inv.seller || {}
  const tax = computeTax(items, seller, inv.brand_state_code || null)
  const gstErr = gstinError(inv.brand_gstin)
  const itemsValid = items.every((it) => it.description?.trim() && Number(it.qty) > 0 && it.rate !== '' && Number(it.rate) >= 0)
  const dueErr = inv.due_date && inv.issue_date && inv.due_date < inv.issue_date ? 'Due date is before the issue date' : null
  const locked = inv.id && ['paid', 'cancelled'].includes(inv.status)

  async function save() {
    setBusy(true)
    const payload = {
      brand_name: inv.brand_name.trim(),
      brand_email: inv.brand_email?.trim() || null,
      brand_gstin: inv.brand_gstin?.trim() || null,
      brand_address: inv.brand_address?.trim() || null,
      brand_state_code: inv.brand_state_code || null,
      issue_date: inv.issue_date,
      due_date: inv.due_date || null,
      items: items.map((it) => ({ description: it.description.trim(), sac: (it.sac || '').trim(), qty: Number(it.qty), rate: Number(it.rate) })),
      notes: inv.notes?.trim() || null,
      enquiry_id: inv.enquiry_id || null,
    }
    const query = inv.id
      ? supabase.from('invoices').update({ ...payload, ...(isDraft ? { seller: {} } : {}) }).eq('id', inv.id)
      : supabase.from('invoices').insert({ ...payload, page_id: inv.page_id })
    const { data, error } = await query.select().single()
    setBusy(false)
    if (error) return toast(errorMessage(error), 'error')
    toast(inv.id ? 'Invoice updated' : `Invoice ${data.number} created`)
    onSaved(data)
  }

  return (
    <Modal open onClose={onClose} title={inv.id ? `Invoice ${inv.number}` : 'New invoice'} wide>
      {!billing.legal_name && isDraft && (
        <div className="mb-4">
          <Alert tone="info">Add your billing details first so your name, address and GSTIN appear on the invoice.</Alert>
        </div>
      )}
      {locked && (
        <div className="mb-4">
          <Alert tone="info">{inv.status === 'paid' ? 'This invoice is paid. Mark it unpaid to make changes.' : 'Cancelled invoices can’t be edited.'}</Alert>
        </div>
      )}
      <fieldset disabled={locked} className="grid min-w-0 gap-4 sm:grid-cols-2">
        {deals.length > 0 && (
          <Select
            className="sm:col-span-2"
            label="Brand deal (optional)"
            value={inv.enquiry_id || ''}
            hint="Marking this invoice paid also moves the deal to Paid."
            options={[{ value: '', label: 'Not linked' }, ...deals.map((d) => ({ value: d.id, label: `${d.brand_name}${d.amount_inr ? ` · ₹${d.amount_inr.toLocaleString('en-IN')}` : ''}` }))]}
            onChange={(e) => {
              const d = deals.find((x) => x.id === e.target.value)
              set({ enquiry_id: e.target.value, ...(d && !inv.brand_name ? { brand_name: d.brand_name, brand_email: d.email } : {}) })
            }}
          />
        )}
        <Input label="Brand / client name" value={inv.brand_name || ''} maxLength={160} onChange={(e) => set({ brand_name: e.target.value })} />
        <Input label="Brand email" type="email" value={inv.brand_email || ''} onChange={(e) => set({ brand_email: e.target.value })} />
        <Input
          label="Brand GSTIN (optional)"
          value={inv.brand_gstin || ''}
          maxLength={15}
          error={gstErr}
          onChange={(e) => {
            const v = e.target.value.toUpperCase().replace(/\s/g, '')
            const code = v.slice(0, 2)
            set({ brand_gstin: v, ...(v.length >= 2 && stateName(code) ? { brand_state_code: code } : {}) })
          }}
        />
        <Select label="Place of supply (brand’s state)" value={inv.brand_state_code || ''} options={STATE_OPTIONS} onChange={(e) => set({ brand_state_code: e.target.value })} />
        <Textarea className="sm:col-span-2" label="Brand address" rows={2} value={inv.brand_address || ''} onChange={(e) => set({ brand_address: e.target.value })} />
        <Input label="Issue date" type="date" value={inv.issue_date || ''} onChange={(e) => set({ issue_date: e.target.value })} />
        <Input label="Due date" type="date" value={inv.due_date || ''} min={inv.issue_date} error={dueErr} onChange={(e) => set({ due_date: e.target.value })} />

        <div className="min-w-0 sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium text-ink-700">Line items</p>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-6 gap-2 rounded-2xl bg-cream p-3 sm:grid-cols-12 sm:items-center">
                <input className="field col-span-6 h-10 bg-white text-sm sm:col-span-5" placeholder="e.g. 1 Instagram Reel + 3 Stories" value={it.description} aria-label="Description" onChange={(e) => setItem(i, { description: e.target.value })} />
                <input className="field col-span-2 h-10 bg-white text-sm" placeholder="SAC" value={it.sac} aria-label="SAC code" maxLength={8} onChange={(e) => setItem(i, { sac: e.target.value.replace(/[^0-9]/g, '') })} />
                <input className="field col-span-1 h-10 bg-white px-2 text-sm" type="number" min={1} step="any" value={it.qty} aria-label="Quantity" onChange={(e) => setItem(i, { qty: e.target.value })} />
                <input className="field col-span-3 h-10 bg-white text-sm sm:col-span-2" type="number" min={0} step="0.01" placeholder="Rate ₹" value={it.rate} aria-label="Rate" onChange={(e) => setItem(i, { rate: e.target.value })} />
                <div className="col-span-6 flex items-center justify-between gap-2 sm:col-span-2 sm:justify-end">
                  <span className="text-sm font-semibold tabular-nums">{formatMoney(lineAmount(it))}</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => set({ items: items.filter((_, j) => j !== i) })} className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-white hover:text-red-600" aria-label="Remove line">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!locked && (
            <Button variant="soft" size="sm" className="mt-2" onClick={() => set({ items: [...items, blankItem()] })}>
              <Plus className="size-4" /> Add line
            </Button>
          )}
        </div>

        <Textarea label="Notes (printed on the invoice)" rows={3} value={inv.notes || ''} placeholder="e.g. Payment within 15 days. Thank you!" onChange={(e) => set({ notes: e.target.value })} />
        <TaxPreview tax={tax} />
      </fieldset>
      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        {!locked && (
          <Button onClick={save} loading={busy} disabled={!inv.brand_name?.trim() || !inv.issue_date || !itemsValid || Boolean(gstErr || dueErr)}>
            {inv.id ? 'Save changes' : 'Create invoice'}
          </Button>
        )}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Payment reminders (mailto / wa.me — no third-party API)
// ---------------------------------------------------------------------------
function reminderText(inv, billing) {
  const seller = { ...billing, ...(inv.seller || {}) }
  const due = inv.due_date ? (isOverdue(inv) ? `was due on ${formatDate(inv.due_date)}` : `is due on ${formatDate(inv.due_date)}`) : 'is pending'
  const pay = paymentLines(seller)
  return [
    `Hi ${inv.brand_name},`,
    '',
    `A friendly reminder that invoice ${inv.number} for ${formatMoney(inv.total)} ${due}.`,
    ...(pay.length ? ['', 'Payment details:', ...pay] : []),
    '',
    'Please share the payment reference once done. Thank you!',
    '',
    seller.legal_name || '',
  ].join('\n').trim()
}

function ReminderModal({ invoice, billing, phone, onClose, onLogged }) {
  const text = reminderText(invoice, billing)
  const subject = `Payment reminder: Invoice ${invoice.number} (${formatMoney(invoice.total)})`
  const mailto = `mailto:${invoice.brand_email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
  const wa = phone ? whatsappUrl(phone, text) : `https://wa.me/?text=${encodeURIComponent(text)}`

  return (
    <Modal open onClose={onClose} title="Send a reminder">
      <p className="text-sm text-ink-500">Opens your own email or WhatsApp with this message ready to send.</p>
      <pre className="mt-4 max-h-60 overflow-auto rounded-2xl bg-cream p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap">{text}</pre>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Button href={mailto} variant="primary" onClick={() => onLogged('email')} className={!invoice.brand_email ? 'pointer-events-none opacity-50' : ''} aria-disabled={!invoice.brand_email}>
          <Mail className="size-4" /> Email
        </Button>
        <Button href={wa} target="_blank" rel="noreferrer" variant="lime" onClick={() => onLogged('whatsapp')}>
          <WhatsappIcon size={16} /> WhatsApp
        </Button>
      </div>
      {!invoice.brand_email && <p className="mt-2 text-xs text-ink-500">Add the brand’s email to the invoice to remind by email.</p>}
      {!phone && <p className="mt-2 text-xs text-ink-500">No phone number on the linked deal — WhatsApp will ask you to pick a chat.</p>}
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Invoices() {
  const { page, canEdit, updatePage } = usePage()
  const toast = useToast()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [invoices, setInvoices] = useState(null)
  const [deals, setDeals] = useState([])
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [reminding, setReminding] = useState(null)
  const [view, setView] = useViewMode('invoices')
  const billing = useMemo(() => page.billing || {}, [page.billing])

  const load = useCallback(async () => {
    const [{ data: inv, error }, { data: enq }] = await Promise.all([
      supabase.from('invoices').select('*').eq('page_id', page.id).order('issue_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('enquiries').select('id, brand_name, contact_name, email, phone, amount_inr, deliverables, stage').eq('page_id', page.id).order('created_at', { ascending: false }),
    ])
    if (error) toast(errorMessage(error), 'error')
    setInvoices(inv || [])
    setDeals(enq || [])
  }, [page.id, toast])

  useEffect(() => {
    load()
  }, [load])

  const newInvoice = useCallback(
    (deal) => {
      const today = istToday()
      const base = { page_id: page.id, issue_date: today, due_date: addDays(today, 15), items: [blankItem()], status: 'draft' }
      if (!deal) return base
      const deliverables = (deal.deliverables || []).map((x) => x.title).filter(Boolean)
      return {
        ...base,
        enquiry_id: deal.id,
        brand_name: deal.brand_name || '',
        brand_email: deal.email || '',
        items: [{
          description: deliverables.length ? `${deal.brand_name} collaboration: ${deliverables.join(', ')}`.slice(0, 300) : `${deal.brand_name} brand collaboration`,
          sac: DEFAULT_SAC,
          qty: 1,
          rate: deal.amount_inr ?? '',
        }],
      }
    },
    [page.id],
  )

  // ?new=1 opens a blank invoice; ?new=<enquiry id> pre-fills it from that brand deal
  useEffect(() => {
    const id = params.get('new')
    if (!id || !canEdit) return
    const fromState = location.state?.deal
    ;(async () => {
      let deal = null
      if (id !== '1') {
        if (fromState?.id === id) deal = fromState
        else {
          const { data } = await supabase.from('enquiries').select('*').eq('id', id).eq('page_id', page.id).maybeSingle()
          deal = data
        }
      }
      setEditing(newInvoice(deal))
      setParams((p) => {
        p.delete('new')
        return p
      }, { replace: true, state: null })
    })()
  }, [params, setParams, canEdit, location.state, page.id, newInvoice])

  const totals = useMemo(() => {
    const list = invoices || []
    const fy = fyStart()
    const istDay = (ts) => new Date(new Date(ts).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10)
    return {
      outstanding: list.filter((i) => i.status === 'sent').reduce((s, i) => s + Number(i.total), 0),
      overdue: list.filter(isOverdue).reduce((s, i) => s + Number(i.total), 0),
      paidFy: list.filter((i) => i.status === 'paid' && i.paid_at && istDay(i.paid_at) >= fy).reduce((s, i) => s + Number(i.total), 0),
      drafts: list.filter((i) => i.status === 'draft').length,
    }
  }, [invoices])

  const shown = (invoices || []).filter((i) => filter === 'all' || statusOf(i) === filter)

  function upsert(row) {
    setInvoices((list) => {
      const next = list.some((x) => x.id === row.id) ? list.map((x) => (x.id === row.id ? row : x)) : [row, ...list]
      return next
    })
  }

  async function setStatus(inv, status) {
    if (status === 'cancelled' && !(await askConfirm({ title: `Cancel invoice ${inv.number}?`, message: 'It stays in your records as cancelled.', confirmLabel: 'Cancel invoice' }))) return
    const { data, error } = await supabase.from('invoices').update({ status }).eq('id', inv.id).select().single()
    if (error) return toast(errorMessage(error), 'error')
    upsert(data)
    toast(status === 'paid' ? 'Marked as paid' : status === 'sent' ? 'Marked as sent' : 'Invoice cancelled')
  }

  async function remove(inv) {
    if (!(await askConfirm({ title: `Delete draft ${inv.number}?`, confirmLabel: 'Delete' }))) return
    const { error } = await supabase.from('invoices').delete().eq('id', inv.id)
    if (error) return toast(errorMessage(error), 'error')
    setInvoices((list) => list.filter((x) => x.id !== inv.id))
    toast('Draft deleted')
  }

  async function logReminder(inv, channel) {
    const reminders = [...(inv.reminders || []), { at: new Date().toISOString(), channel }]
    upsert({ ...inv, reminders })
    setReminding(null)
    const { data, error } = await supabase.from('invoices').update({ reminders }).eq('id', inv.id).select().single()
    if (error) return toast(errorMessage(error), 'error')
    upsert(data)
  }

  function saveBilling(next) {
    updatePage({ billing: next }, { immediate: true })
    toast('Billing details saved')
  }

  const openPdf = (inv) => window.open(`/invoices/${inv.id}/print`, '_blank', 'noopener')
  const dealPhone = (inv) => deals.find((d) => d.id === inv.enquiry_id)?.phone || null

  function Actions({ inv }) {
    const s = statusOf(inv)
    const last = inv.reminders?.length ? inv.reminders[inv.reminders.length - 1] : null
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="soft" size="sm" onClick={() => openPdf(inv)}><Download className="size-4" /> PDF</Button>
        {canEdit && (
          <>
            {inv.status === 'draft' && <Button variant="primary" size="sm" onClick={() => setStatus(inv, 'sent')}><Send className="size-4" /> Mark sent</Button>}
            {inv.status === 'sent' && (
              <>
                <Button variant="lime" size="sm" onClick={() => setStatus(inv, 'paid')}><Check className="size-4" /> Mark paid</Button>
                <Button variant={s === 'overdue' ? 'primary' : 'outline'} size="sm" onClick={() => setReminding(inv)}><BellRing className="size-4" /> Remind</Button>
              </>
            )}
            {inv.status === 'paid' && <Button variant="ghost" size="sm" onClick={() => setStatus(inv, 'sent')}>Mark unpaid</Button>}
            {['draft', 'sent'].includes(inv.status) && (
              <button type="button" onClick={() => setEditing(inv)} className="grid size-9 place-items-center rounded-full text-ink-500 hover:bg-cream" aria-label="Edit invoice"><Pencil className="size-4" /></button>
            )}
            {inv.status === 'sent' && (
              <button type="button" onClick={() => setStatus(inv, 'cancelled')} className="grid size-9 place-items-center rounded-full text-ink-500 hover:bg-cream" aria-label="Cancel invoice" title="Cancel invoice"><X className="size-4" /></button>
            )}
            {inv.status === 'draft' && (
              <button type="button" onClick={() => remove(inv)} className="grid size-9 place-items-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete draft"><Trash2 className="size-4" /></button>
            )}
          </>
        )}
        {last && (
          <span className="w-full text-[11px] text-ink-400">
            Last reminder {new Date(last.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} via {last.channel === 'whatsapp' ? 'WhatsApp' : 'email'}
            {inv.reminders.length > 1 ? ` · ${inv.reminders.length} sent` : ''}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeading
        title="Invoices."
        italic="Get paid on time."
        actions={canEdit && <Button onClick={() => setEditing(newInvoice(null))}><Plus className="size-4" /> New invoice</Button>}
      >
        GST-ready invoices for your brand deals. Tax is split into CGST + SGST or IGST automatically based on the brand’s state.
      </PageHeading>

      <Stats
        items={[
          ['Outstanding', formatMoney(totals.outstanding), 'bg-white'],
          ['Overdue', formatMoney(totals.overdue), totals.overdue ? 'bg-red-50' : 'bg-lilac-100'],
          ['Paid this FY', formatMoney(totals.paidFy), 'bg-lime'],
          ['Drafts', totals.drafts, 'bg-ink text-white'],
        ]}
      />

      <BillingCard key={JSON.stringify(billing)} billing={billing} onSave={saveBilling} canEdit={canEdit} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs label="Status" value={filter} onChange={setFilter} tabs={FILTERS.map((f) => ({ ...f, count: f.key === 'all' ? (invoices || []).length : (invoices || []).filter((i) => statusOf(i) === f.key).length }))} />
        <ViewToggle value={view} onChange={setView} />
      </div>

      {invoices === null ? (
        <div className="grid h-60 place-items-center"><Spinner /></div>
      ) : shown.length === 0 ? (
        <Empty
          icon={ReceiptIndianRupee}
          title={invoices.length ? 'Nothing here' : 'No invoices yet'}
          action={canEdit && !invoices.length ? <Button onClick={() => setEditing(newInvoice(null))}><Plus className="size-4" /> Create your first invoice</Button> : null}
        >
          {invoices.length ? 'No invoices match this filter.' : 'Create an invoice from scratch, or open a brand deal and tap “Create invoice”.'}
        </Empty>
      ) : view === 'table' ? (
        <DataTable
          rows={shown}
          minWidth={1040}
          columns={[
            { key: 'number', label: 'Number', value: (inv) => inv.number, className: 'font-mono text-xs whitespace-nowrap' },
            { key: 'brand_name', label: 'Brand', value: (inv) => inv.brand_name, className: 'max-w-48 truncate font-semibold' },
            { key: 'status', label: 'Status', value: (inv) => STATUS[statusOf(inv)].label, render: (inv) => <Badge tone={STATUS[statusOf(inv)].tone}>{STATUS[statusOf(inv)].label}</Badge> },
            { key: 'issue_date', label: 'Issued', value: (inv) => inv.issue_date, className: 'whitespace-nowrap text-ink-600', render: (inv) => formatDate(inv.issue_date) },
            { key: 'due_date', label: 'Due', value: (inv) => inv.due_date, className: 'whitespace-nowrap text-ink-600', render: (inv) => (inv.due_date ? formatDate(inv.due_date) : '—') },
            { key: 'total', label: 'Total', align: 'right', value: (inv) => Number(inv.total), className: 'font-semibold whitespace-nowrap tabular-nums', render: (inv) => formatMoney(inv.total) },
            { key: 'actions', label: 'Actions', className: 'min-w-72', render: (inv) => <Actions inv={inv} /> },
          ]}
        />
      ) : (
        <div className="space-y-3">
          {shown.map((inv) => {
            const s = statusOf(inv)
            return (
              <Card key={inv.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-ink-500">{inv.number}</span>
                      <Badge tone={STATUS[s].tone}>{STATUS[s].label}</Badge>
                      {inv.tax_mode !== 'none' && <Badge tone="neutral">{inv.tax_mode === 'intra' ? 'CGST+SGST' : 'IGST'}</Badge>}
                    </div>
                    <p className="mt-1 truncate text-lg font-bold">{inv.brand_name}</p>
                    <p className="text-xs text-ink-500">
                      Issued {formatDate(inv.issue_date)}
                      {inv.due_date && <> · <span className={s === 'overdue' ? 'font-semibold text-red-600' : ''}>Due {formatDate(inv.due_date)}</span></>}
                      {inv.paid_at && <> · Paid {new Date(inv.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
                    </p>
                  </div>
                  <p className="font-display text-2xl font-bold tabular-nums">{formatMoney(inv.total)}</p>
                </div>
                <div className="mt-3 border-t border-ink/5 pt-3">
                  <Actions inv={inv} />
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {editing && (
        <InvoiceModal
          invoice={editing}
          billing={billing}
          deals={deals}
          onClose={() => setEditing(null)}
          onSaved={(row) => {
            upsert(row)
            setEditing(null)
          }}
        />
      )}
      {reminding && (
        <ReminderModal invoice={reminding} billing={billing} phone={dealPhone(reminding)} onClose={() => setReminding(null)} onLogged={(ch) => logReminder(reminding, ch)} />
      )}
    </div>
  )
}
