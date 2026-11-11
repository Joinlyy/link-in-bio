import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { DndContext, DragOverlay, PointerSensor, pointerWithin, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { BriefcaseBusiness, Check, Columns3, Mail, Plus, ReceiptIndianRupee, Table2, Trash2 } from 'lucide-react'
import { usePage } from '../../context/PageContext'
import { supabase } from '../../lib/supabase'
import { formatInr } from '../../lib/images'
import { Button, Empty, Input, Modal, Select, Spinner, Stats, Textarea, useToast, askConfirm } from '../../components/ui'
import { DataTable, useViewMode, ViewToggle } from '../../components/DataTable'
import { PageHeading } from './DashboardLayout'

export const STAGES = [
  { key: 'enquiry', label: 'Enquiry', cls: 'bg-lilac-100' },
  { key: 'negotiation', label: 'Negotiation', cls: 'bg-amber-50' },
  { key: 'confirmed', label: 'Confirmed', cls: 'bg-lime-200' },
  { key: 'delivered', label: 'Content delivered', cls: 'bg-cream-200' },
  { key: 'paid', label: 'Payment received', cls: 'bg-lime' },
  { key: 'product_received', label: 'Product received', cls: 'bg-lime' },
  { key: 'lost', label: 'Lost', cls: 'bg-red-50' },
]
const stageLabel = (key) => STAGES.find((s) => s.key === key)?.label || key

export const DEAL_TYPES = [
  { value: 'paid', label: 'Paid' },
  { value: 'barter', label: 'Barter (product in exchange)' },
  { value: 'hybrid', label: 'Paid + product' },
  { value: 'affiliate', label: 'Affiliate / commission' },
]
const SHORT_TYPE = { barter: 'Barter', hybrid: 'Paid + product', affiliate: 'Affiliate' }
const getsMoney = (type) => type !== 'barter'
const getsProduct = (type) => type === 'barter' || type === 'hybrid'
/** A barter deal never reaches Payment received, and a money-only deal never reaches Product received */
const stageAllowed = (type, stage) => (stage === 'paid' ? getsMoney(type) : stage === 'product_received' ? getsProduct(type) : true)
const lastStage = (type) => (type === 'barter' ? 'product_received' : 'paid')
const isClosed = (d) => d.stage === 'lost' || d.stage === lastStage(d.deal_type)
const dealValue = (d) => {
  const money = d.amount_inr ? formatInr(d.amount_inr) : d.budget || null
  if (d.deal_type === 'barter') return d.product_details || 'Product'
  if (d.deal_type === 'hybrid') return [money, d.product_details].filter(Boolean).join(' + ') || '—'
  return money || '—'
}

function DealModal({ deal, onClose, onSaved, onDeleted }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [d, setD] = useState(deal)
  const [item, setItem] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (patch) => setD((x) => ({ ...x, ...patch }))
  const deliverables = d.deliverables || []
  const type = d.deal_type || 'paid'

  async function save() {
    setBusy(true)
    const payload = {
      brand_name: d.brand_name, contact_name: d.contact_name, email: d.email, phone: d.phone, budget: d.budget,
      message: d.message, stage: d.stage, amount_inr: d.amount_inr === '' || d.amount_inr == null ? null : Number(d.amount_inr),
      due_date: d.due_date || null, deliverables, notes: d.notes, deal_type: type,
      product_details: getsProduct(type) ? d.product_details || null : null,
      product_value_inr: getsProduct(type) && d.product_value_inr ? Number(d.product_value_inr) : null,
    }
    if (!getsMoney(type)) payload.amount_inr = null
    if (d.stage === 'paid' && !payload.amount_inr) {
      setBusy(false)
      return toast('Add the deal value before marking payment as received', 'error')
    }
    const query = d.id ? supabase.from('enquiries').update(payload).eq('id', d.id) : supabase.from('enquiries').insert({ ...payload, page_id: d.page_id })
    const { data, error } = await query.select().single()
    setBusy(false)
    if (error) return toast(error.message, 'error')
    toast('Deal saved')
    onSaved(data)
  }

  async function remove() {
    if (!(await askConfirm({ title: 'Delete this deal?', confirmLabel: 'Delete' }))) return
    const { error } = await supabase.from('enquiries').delete().eq('id', d.id)
    if (error) return toast(error.message, 'error')
    onDeleted(d.id)
  }

  return (
    <Modal open onClose={onClose} title={d.id ? d.brand_name : 'New brand deal'} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Brand" value={d.brand_name || ''} maxLength={120} onChange={(e) => set({ brand_name: e.target.value })} />
        <Select label="Stage" value={d.stage} onChange={(e) => set({ stage: e.target.value })} options={STAGES.filter((s) => stageAllowed(type, s.key)).map((s) => ({ value: s.key, label: s.label }))} />
        <Select
          label="Deal type"
          value={type}
          onChange={(e) => {
            const next = e.target.value
            set({ deal_type: next, stage: stageAllowed(next, d.stage) ? d.stage : lastStage(next) })
          }}
          options={DEAL_TYPES}
        />
        <Input label="Contact name" value={d.contact_name || ''} onChange={(e) => set({ contact_name: e.target.value })} />
        <Input label="Email" type="email" value={d.email || ''} onChange={(e) => set({ email: e.target.value })} />
        {getsMoney(type) && <Input label="Deal value (₹)" type="number" min={0} value={d.amount_inr ?? ''} hint={d.budget ? `Brand’s budget: ${d.budget}` : undefined} onChange={(e) => set({ amount_inr: e.target.value })} />}
        {getsProduct(type) && (
          <>
            <Input label="Product you’ll receive" maxLength={300} placeholder="Skincare kit, phone, travel stay…" value={d.product_details || ''} onChange={(e) => set({ product_details: e.target.value })} />
            <Input label="Product value (₹)" type="number" min={0} value={d.product_value_inr ?? ''} onChange={(e) => set({ product_value_inr: e.target.value })} />
          </>
        )}
        <Input label="Due date" type="date" value={d.due_date || ''} onChange={(e) => set({ due_date: e.target.value })} />
        {d.message && (
          <div className="rounded-2xl bg-cream p-4 text-sm leading-relaxed whitespace-pre-line sm:col-span-2">
            <p className="eyebrow mb-1 text-ink-500">Brand’s message</p>
            {d.message}
          </div>
        )}
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium text-ink-700">Deliverables</p>
          <div className="grid gap-1.5">
            {deliverables.map((x, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-sm">
                <button type="button" onClick={() => set({ deliverables: deliverables.map((y, j) => (j === i ? { ...y, done: !y.done } : y)) })} className={`grid size-5 place-items-center rounded-md ${x.done ? 'bg-ink text-lime' : 'border-2 border-ink/20'}`} aria-label="Toggle done">
                  {x.done && <Check className="size-3" strokeWidth={3} />}
                </button>
                <span className={`flex-1 ${x.done ? 'text-ink-400 line-through' : ''}`}>{x.title}</span>
                <button type="button" onClick={() => set({ deliverables: deliverables.filter((_, j) => j !== i) })} aria-label="Remove"><Trash2 className="size-3.5 text-ink-400" /></button>
              </div>
            ))}
          </div>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (item.trim()) { set({ deliverables: [...deliverables, { title: item.trim(), done: false }] }); setItem('') } }}>
            <input className="field h-10 text-sm" placeholder="e.g. 1 Reel + 3 Stories" value={item} onChange={(e) => setItem(e.target.value)} />
            <Button type="submit" variant="soft" size="sm">Add</Button>
          </form>
        </div>
        <Textarea className="sm:col-span-2" label="Private notes" rows={3} value={d.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {d.id && <Button variant="dangerSoft" size="sm" onClick={remove}><Trash2 className="size-4" /> Delete</Button>}
          {d.id && getsMoney(type) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigate(`/dashboard/invoices?new=${d.id}`, {
                  state: { deal: { ...d, deliverables, amount_inr: d.amount_inr === '' || d.amount_inr == null ? null : Number(d.amount_inr) } },
                })
              }
            >
              <ReceiptIndianRupee className="size-4" /> Create invoice
            </Button>
          )}
          {d.email && <Button variant="outline" size="sm" href={`mailto:${d.email}?subject=${encodeURIComponent(`Collaboration with ${d.brand_name}`)}`}><Mail className="size-4" /> Email</Button>}
        </div>
        <Button onClick={save} loading={busy} disabled={!d.brand_name || !d.email}>Save deal</Button>
      </div>
    </Modal>
  )
}

function DealCardBody({ d }) {
  return (
    <>
      <p className="truncate font-semibold">{d.brand_name}</p>
      <p className="truncate text-xs text-ink-500">{d.contact_name || d.email}</p>
      {SHORT_TYPE[d.deal_type] && <span className="mt-1.5 inline-block rounded-full bg-lilac-100 px-2 py-0.5 text-[11px] font-semibold">{SHORT_TYPE[d.deal_type]}</span>}
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate font-semibold">{dealValue(d)}</span>
        {d.due_date && <span className="text-ink-500">Due {formatDue(d.due_date)}</span>}
      </div>
      {d.deliverables?.length > 0 && (
        <p className="mt-1 text-[11px] text-ink-400">{d.deliverables.filter((x) => x.done).length}/{d.deliverables.length} deliverables</p>
      )}
    </>
  )
}

const formatDue = (date) => new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

function DealCard({ d, onOpen }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: d.id })
  return (
    <button ref={setNodeRef} type="button" onClick={onOpen} {...attributes} {...listeners} className={`card block w-full cursor-grab p-4 text-left transition hover:-translate-y-0.5 active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}>
      <DealCardBody d={d} />
    </button>
  )
}

function StageColumn({ stage, list, onOpen }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key })
  return (
    <div ref={setNodeRef} className={`w-[280px] shrink-0 snap-start rounded-3xl p-2.5 transition ${isOver ? 'bg-lilac-100 ring-2 ring-lilac' : 'bg-white/60'}`}>
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${stage.cls}`}>{stage.label}</span>
        <span className="text-xs font-semibold text-ink-400">{list.length}</span>
      </div>
      <div className="mt-1 min-h-20 space-y-2">
        {list.map((d) => <DealCard key={d.id} d={d} onOpen={() => onOpen(d)} />)}
      </div>
    </div>
  )
}

/** Drag a card to another column to change its stage */
function DealBoard({ deals, onOpen, onStage }) {
  const [activeId, setActiveId] = useState(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )
  const active = deals.find((d) => d.id === activeId)
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e) => setActiveId(e.active.id)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={({ active: dragged, over }) => {
        setActiveId(null)
        const deal = deals.find((d) => d.id === dragged.id)
        if (deal && over && over.id !== deal.stage) onStage(deal, over.id)
      }}
    >
      <div className="scrollbar-none -mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-2">
        {STAGES.map((stage) => <StageColumn key={stage.key} stage={stage} list={deals.filter((d) => d.stage === stage.key)} onOpen={onOpen} />)}
      </div>
      {/* On the body: page animations leave transforms that would offset the dragged card */}
      {createPortal(<DragOverlay dropAnimation={null}>{active && <div className="card w-[260px] rotate-2 p-4 shadow-lift"><DealCardBody d={active} /></div>}</DragOverlay>, document.body)}
    </DndContext>
  )
}

/** Confirms a move between stages, and asks for what the new stage needs */
function StageModal({ deal, stage, onCancel, onConfirm, onEdit }) {
  const type = deal.deal_type || 'paid'
  const [amount, setAmount] = useState(deal.amount_inr ?? '')
  const [product, setProduct] = useState(deal.product_details || '')
  const [value, setValue] = useState(deal.product_value_inr ?? '')
  const [busy, setBusy] = useState(false)
  const to = stageLabel(stage)

  if (!stageAllowed(type, stage)) {
    return (
      <Modal open onClose={onCancel} title={`${deal.brand_name} can’t move to ${to}`}>
        <p className="text-sm leading-relaxed text-ink-600">
          {stage === 'paid' ? 'This is a barter deal, so it finishes at Product received.' : 'This deal doesn’t include a product, so it finishes at Payment received.'} To change that, edit the deal type.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={onEdit}>Edit deal</Button>
        </div>
      </Modal>
    )
  }

  const needsAmount = stage === 'paid'
  const needsProduct = stage === 'product_received'
  const invalid = (needsAmount && !(Number(amount) > 0)) || (needsProduct && !product.trim())
  const wasEarned = deal.stage === 'paid' && stage !== 'paid' && deal.amount_inr > 0

  async function submit(e) {
    e.preventDefault()
    if (invalid) return
    setBusy(true)
    const extra = needsAmount ? { amount_inr: Number(amount) } : needsProduct ? { product_details: product.trim(), product_value_inr: value === '' ? null : Number(value) } : {}
    await onConfirm(extra)
  }

  return (
    <Modal open onClose={onCancel} title={`Move to ${to}?`}>
      <form onSubmit={submit} className="grid gap-4">
        <p className="text-sm leading-relaxed text-ink-600"><b>{deal.brand_name}</b> moves from {stageLabel(deal.stage)} to {to}.</p>
        {needsAmount && <Input label="Amount received (₹)" type="number" min={1} autoFocus required value={amount} onChange={(e) => setAmount(e.target.value)} hint={Number(amount) > 0 ? `${formatInr(Number(amount))} will be added to Earned.` : 'This is added to Earned.'} />}
        {needsProduct && (
          <>
            <Input label="Product received" autoFocus required maxLength={300} placeholder="Skincare kit" value={product} onChange={(e) => setProduct(e.target.value)} />
            <Input label="Product value (₹)" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} hint="Counted in Products received, not in Earned." />
          </>
        )}
        {stage === 'lost' && <p className="rounded-2xl bg-cream p-3 text-sm">It leaves your pipeline value. You can move it back later.</p>}
        {wasEarned && <p className="rounded-2xl bg-amber-50 p-3 text-sm">{formatInr(deal.amount_inr)} will be removed from Earned.</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={invalid}>Confirm move</Button>
        </div>
      </form>
    </Modal>
  )
}

const stageIndex = (key) => STAGES.findIndex((s) => s.key === key)

function DealTable({ deals, onOpen, onStage }) {
  return (
    <DataTable
      rows={deals}
      minWidth={900}
      onRowClick={onOpen}
      defaultSort={{ key: 'created_at', dir: -1 }}
      columns={[
        { key: 'brand_name', label: 'Brand', value: (d) => d.brand_name, className: 'truncate' },
        { key: 'contact', label: 'Contact', value: (d) => d.contact_name || d.email, className: 'max-w-48 truncate text-ink-600' },
        { key: 'stage', label: 'Stage', value: (d) => stageIndex(d.stage), render: (d) => (
          <select aria-label={`Stage of ${d.brand_name}`} value={d.stage} onChange={(e) => onStage(d, e.target.value)} className={`h-8 rounded-full border-0 px-3 text-xs font-bold ${STAGES[stageIndex(d.stage)]?.cls || ''}`}>
            {STAGES.filter((s) => stageAllowed(d.deal_type, s.key)).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        ) },
        { key: 'deal_type', label: 'Type', value: (d) => SHORT_TYPE[d.deal_type] || 'Paid', className: 'whitespace-nowrap text-ink-600' },
        { key: 'amount_inr', label: 'Value', value: (d) => d.amount_inr, className: 'max-w-48 truncate font-semibold', render: dealValue },
        { key: 'due_date', label: 'Due', value: (d) => d.due_date, className: 'whitespace-nowrap text-ink-600', render: (d) => (d.due_date ? formatDue(d.due_date) : '—') },
        { key: 'deliverables', label: 'Deliverables', value: (d) => (d.deliverables?.length ? d.deliverables.filter((x) => x.done).length : null), className: 'text-ink-600', render: (d) => (d.deliverables?.length ? `${d.deliverables.filter((x) => x.done).length}/${d.deliverables.length}` : '—') },
        { key: 'created_at', label: 'Received', value: (d) => d.created_at, className: 'whitespace-nowrap text-ink-600', render: (d) => formatDue(d.created_at) },
      ]}
    />
  )
}

export default function BrandDeals() {
  const { page } = usePage()
  const toast = useToast()
  const [deals, setDeals] = useState(null)
  const [open, setOpen] = useState(null)
  const [moving, setMoving] = useState(null)
  const [view, setView] = useViewMode('collabs', 'board')

  async function changeStage(deal, stage, extra) {
    const { data, error } = await supabase.from('enquiries').update({ stage, ...extra }).eq('id', deal.id).select().single()
    setMoving(null)
    if (error) return toast(error.message, 'error')
    setDeals((list) => list.map((x) => (x.id === deal.id ? data : x)))
    toast(`${deal.brand_name} moved to ${stageLabel(stage)}`)
  }

  const load = useCallback(async () => {
    const { data } = await supabase.from('enquiries').select('*').eq('page_id', page.id).order('created_at', { ascending: false })
    setDeals(data || [])
  }, [page.id])

  useEffect(() => {
    load()
  }, [load])

  const pipeline = (deals || []).filter((d) => !isClosed(d) && d.stage !== 'paid').reduce((s, d) => s + (d.amount_inr || 0), 0)
  const productsValue = (deals || []).filter((d) => getsProduct(d.deal_type) && (d.stage === 'product_received' || d.stage === 'paid')).reduce((s, d) => s + (d.product_value_inr || 0), 0)
  const earned = (deals || []).filter((d) => d.stage === 'paid').reduce((s, d) => s + (d.amount_inr || 0), 0)

  return (
    <div className="space-y-4">
      <PageHeading
        title="Brand collabs."
        italic="Your pipeline."
        actions={<Button onClick={() => setOpen({ page_id: page.id, stage: 'negotiation', deal_type: 'paid', deliverables: [] })}><Plus className="size-4" /> Add deal</Button>}
      >
        Enquiries from your brand form land here. Drag a collab between stages and confirm the move, or switch to the table to sort and compare.
      </PageHeading>

      <Stats
        items={[
          ['Open deals', (deals || []).filter((d) => !isClosed(d)).length, 'bg-white'],
          ['New enquiries', (deals || []).filter((d) => d.stage === 'enquiry').length, 'bg-lilac-100'],
          ['Pipeline value', formatInr(pipeline), 'bg-lime'],
          ['Products received', formatInr(productsValue), 'bg-cream-200'],
          ['Earned', formatInr(earned), 'bg-ink text-white col-span-2 lg:col-span-1'],
        ]}
      />

      {deals === null ? (
        <div className="grid h-60 place-items-center"><Spinner /></div>
      ) : deals.length === 0 ? (
        <Empty icon={BriefcaseBusiness} title="No brand collabs yet">Turn on your brand form so brands can reach you.</Empty>
      ) : (
        <>
          <ViewToggle value={view} onChange={setView} views={[{ key: 'board', label: 'Board', icon: Columns3 }, { key: 'table', label: 'Table', icon: Table2 }]} />
          {view === 'board' ? <DealBoard deals={deals} onOpen={setOpen} onStage={(deal, stage) => setMoving({ deal, stage })} /> : <DealTable deals={deals} onOpen={setOpen} onStage={(deal, stage) => setMoving({ deal, stage })} />}
        </>
      )}

      {moving && (
        <StageModal
          key={moving.deal.id + moving.stage}
          deal={moving.deal}
          stage={moving.stage}
          onCancel={() => setMoving(null)}
          onConfirm={(extra) => changeStage(moving.deal, moving.stage, extra)}
          onEdit={() => {
            setOpen(moving.deal)
            setMoving(null)
          }}
        />
      )}
      {open && (
        <DealModal
          deal={open}
          onClose={() => setOpen(null)}
          onSaved={(row) => {
            setDeals((list) => (list.some((x) => x.id === row.id) ? list.map((x) => (x.id === row.id ? row : x)) : [row, ...list]))
            setOpen(null)
          }}
          onDeleted={(id) => {
            setDeals((list) => list.filter((x) => x.id !== id))
            setOpen(null)
          }}
        />
      )}
    </div>
  )
}
