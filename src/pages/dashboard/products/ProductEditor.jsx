import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, ExternalLink, Eye, FileUp, Plus, Trash2, X } from 'lucide-react'
import { usePage } from '../../../context/PageContext'
import { errorMessage, supabase } from '../../../lib/supabase'
import { removeProductFile, uploadProductFile } from '../../../lib/storage'
import { formatBytes, formatInr } from '../../../lib/images'
import { DAYS } from '../../../lib/slots'
import { normalizeUrl } from '../../../lib/embeds'
import ImageInput from '../../../components/ImageInput'
import { Alert, Button, Card, Input, Modal, Select, Textarea, Toggle, useToast, askConfirm } from '../../../components/ui'
import { BUNDLE_ITEM_TYPES, missing, PRODUCT_TYPES, UPSELL_TYPES } from './productTypes'

const toIstInput = (ts) => (ts ? new Date(new Date(ts).getTime() + 5.5 * 3600_000).toISOString().slice(0, 16) : '')
const fromIstInput = (v) => (v ? new Date(`${v}:00+05:30`).toISOString() : '')
const blank = (v) => v === null || v === undefined || v === ''

const TITLE_PLACEHOLDER = {
  session: '30-min Instagram growth call',
  webinar: 'Live: Reels editing masterclass',
  bundle: 'Creator starter kit (presets + templates)',
  content: 'My exact gear list & brand-deal email templates',
  membership: 'Inner circle — monthly community',
  question: 'Ask me anything about growing on Instagram',
}

function Availability({ value, onChange }) {
  const update = (i, patch) => onChange(value.map((w, j) => (j === i ? { ...w, ...patch } : w)))
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink-700">Weekly availability (IST)</p>
      <div className="grid gap-2">
        {value.map((w, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-2xl bg-cream p-2">
            <select className="field h-10 w-24 text-sm" value={w.day} onChange={(e) => update(i, { day: Number(e.target.value) })} aria-label="Day">
              {DAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}
            </select>
            <input type="time" className="field h-10 w-32 text-sm" value={w.start} onChange={(e) => update(i, { start: e.target.value })} aria-label="From" />
            <span className="text-ink-400">to</span>
            <input type="time" className="field h-10 w-32 text-sm" value={w.end} onChange={(e) => update(i, { end: e.target.value })} aria-label="To" />
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="ml-auto grid size-9 place-items-center rounded-full hover:bg-white" aria-label="Remove window"><X className="size-4" /></button>
          </div>
        ))}
      </div>
      <Button variant="soft" size="sm" className="mt-2" onClick={() => onChange([...value, { day: 1, start: '10:00', end: '13:00' }])}>
        <Plus className="size-4" /> Add window
      </Button>
    </div>
  )
}

function BundleItems({ product, products, value, onChange }) {
  const options = products.filter((x) => x.id !== product.id && BUNDLE_ITEM_TYPES.includes(x.type))
  const worth = options.filter((x) => value.includes(x.id)).reduce((s, x) => s + (Number(x.price_inr) || 0), 0)
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <Card className="p-5 sm:p-7">
      <h2 className="text-lg font-bold">What’s in the bundle</h2>
      <p className="mt-1 text-sm text-ink-500">Pick 2 or more digital downloads or paid content products. Items don’t need to be published on their own.</p>
      {options.length === 0 ? (
        <div className="mt-4"><Alert tone="info">Create a digital download or paid content product first, then add it here.</Alert></div>
      ) : (
        <div className="mt-4 grid gap-2">
          {options.map((x) => {
            const on = value.includes(x.id)
            const t = PRODUCT_TYPES[x.type]
            return (
              <button key={x.id} type="button" onClick={() => toggle(x.id)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${on ? 'border-ink bg-lime-200' : 'border-ink/10 hover:border-ink/30'}`} aria-pressed={on}>
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${t.color}`}><t.icon className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{x.title || 'Untitled product'}</span>
                  <span className="block text-xs text-ink-500">{t.label} · {x.price_inr ? formatInr(x.price_inr) : 'Free'}{!x.is_published && ' · draft'}</span>
                </span>
                <span className={`grid size-6 shrink-0 place-items-center rounded-full ${on ? 'bg-ink text-lime' : 'border border-ink/20'}`}>{on && <Check className="size-3.5" />}</span>
              </button>
            )
          })}
        </div>
      )}
      {value.length > 0 && <p className="mt-3 text-sm text-ink-600">{value.length} item{value.length === 1 ? '' : 's'} · worth {formatInr(worth)} if bought separately</p>}
    </Card>
  )
}

function SummaryRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-sm text-ink-500">{label}</span>
      <span className="text-right text-sm font-semibold">{children}</span>
    </div>
  )
}

/** What she's about to save, in plain words, before it goes on her site */
function SaveSummary({ open, product: p, saving, onClose, onSave, onDraft }) {
  if (!open) return null
  const t = PRODUCT_TYPES[p.type] || PRODUCT_TYPES.digital
  const sellable = p.type !== 'link'
  const price = Number(p.price_inr) || 0
  const sale = sellable && !blank(p.sale_price_inr) ? Number(p.sale_price_inr) : null
  const problem = p.is_published ? missing(p) : null
  const when = (ts) => new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
  return (
    <Modal open onClose={onClose} title="Check before saving">
      <div className="flex items-center gap-3 rounded-2xl bg-cream p-3">
        <span className={`grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl ${t.color}`}>
          {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="size-full object-cover" /> : <t.icon className="size-5" />}
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-ink-500">{t.label}</span>
          <span className="block truncate font-bold">{p.title?.trim() || 'Untitled product'}</span>
        </span>
      </div>
      <div className="mt-3 divide-y divide-ink/5">
        <SummaryRow label={p.type === 'link' ? 'Price shown' : 'Price'}>
          {p.pay_what_you_want ? `${formatInr(Number(p.min_price_inr) || 0)} or more` : price ? formatInr(price) : p.type === 'link' ? 'Not shown' : 'Free'}
          {p.type === 'membership' && price > 0 && ` / ${p.data.interval === 'year' ? 'year' : 'month'}`}
          {Number(p.compare_at_inr) > price && <span className="ml-1.5 font-normal text-ink-400 line-through">{formatInr(Number(p.compare_at_inr))}</span>}
        </SummaryRow>
        {sale != null && <SummaryRow label="Offer price">{formatInr(sale)}{p.sale_ends_at ? (new Date(p.sale_ends_at) < new Date() ? `, ended ${when(p.sale_ends_at)}` : ` until ${when(p.sale_ends_at)}`) : ', no end date'}</SummaryRow>}
        {sellable && !blank(p.stock) && <SummaryRow label="Stock">{p.stock} available</SummaryRow>}
        {p.type === 'digital' && <SummaryRow label="File">{p.file_name || 'No file yet'}</SummaryRow>}
        {p.type === 'session' && <SummaryRow label="Session">{p.data.duration || 30} min{Number(p.data.sessions) > 1 ? ` · ${p.data.sessions} sessions` : ''}</SummaryRow>}
        {p.type === 'webinar' && <SummaryRow label="Starts">{p.data.starts_at ? when(p.data.starts_at) : 'No date yet'}</SummaryRow>}
        {p.type === 'link' && <SummaryRow label="Buy link">{p.data.url ? 'Added' : 'Missing'}</SummaryRow>}
        <SummaryRow label="On your site">{p.is_published ? 'Yes, live on your Shop page' : 'No, saved as a draft'}</SummaryRow>
      </div>
      {problem && <div className="mt-3"><Alert>To publish it: {problem.toLowerCase()}. Fix that, or save it as a draft for now.</Alert></div>}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Keep editing</Button>
        {problem ? (
          <Button onClick={onDraft}>Save as a draft instead</Button>
        ) : (
          <Button loading={saving} onClick={onSave}>{p.is_published ? 'Save and publish' : 'Save draft'}</Button>
        )}
      </div>
    </Modal>
  )
}

export default function ProductEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { page, products, setProducts, canEdit } = usePage()
  const [p, setP] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    supabase.from('products').select('*').eq('id', id).maybeSingle().then(({ data }) => (data ? setP(data) : navigate('/dashboard/products', { replace: true })))
  }, [id, navigate])

  if (!p) return null
  const t = PRODUCT_TYPES[p.type] || PRODUCT_TYPES.digital
  const set = (patch) => setP((x) => ({ ...x, ...patch }))
  const setData = (patch) => setP((x) => ({ ...x, data: { ...x.data, ...patch } }))
  const setPrivate = (patch) => setP((x) => ({ ...x, private: { ...x.private, ...patch } }))
  const sellable = p.type !== 'link'
  const upsellOptions = products.filter((x) => x.id !== p.id && UPSELL_TYPES.includes(x.type))

  async function save(extra = {}) {
    if (!canEdit) return false
    const next = { ...p, ...extra }
    if (next.is_published) {
      const why = missing(next)
      if (why) {
        toast(why, 'error')
        return false
      }
    }
    setSaving(true)
    const data = { ...next.data }
    if (data.url) data.url = normalizeUrl(data.url)
    if (!data.upsell_product_id) {
      delete data.upsell_product_id
      delete data.upsell_price_inr
    } else if (blank(data.upsell_price_inr)) delete data.upsell_price_inr
    else data.upsell_price_inr = Math.max(0, parseInt(data.upsell_price_inr, 10) || 0)
    if (p.type === 'session') {
      data.sessions = Math.max(1, Number(data.sessions) || 1)
      data.reschedule_hours = Number(data.reschedule_hours ?? 24)
    }
    if (p.type === 'question') data.response_days = Math.max(1, Number(data.response_days) || 3)
    const priv = { ...next.private }
    if (priv.invite_url?.trim()) priv.invite_url = normalizeUrl(priv.invite_url.trim())
    const payload = {
      title: next.title.trim(), description: next.description, thumbnail_url: next.thumbnail_url || null,
      price_inr: Number(next.price_inr) || 0, compare_at_inr: Number(next.compare_at_inr) || null,
      pay_what_you_want: next.pay_what_you_want, min_price_inr: Number(next.min_price_inr) || 0,
      sale_price_inr: sellable && !blank(next.sale_price_inr) ? Math.max(0, parseInt(next.sale_price_inr, 10) || 0) : null,
      sale_ends_at: sellable && !blank(next.sale_price_inr) && next.sale_ends_at ? next.sale_ends_at : null,
      stock: sellable && !blank(next.stock) ? Math.max(0, parseInt(next.stock, 10) || 0) : null,
      data, private: priv, is_published: next.is_published,
      file_path: next.file_path, file_name: next.file_name, file_size: next.file_size,
    }
    const { data: row, error } = await supabase.from('products').update(payload).eq('id', p.id).select().single()
    setSaving(false)
    if (error) {
      toast(errorMessage(error), 'error')
      return false
    }
    setP(row)
    setProducts((list) => list.map((x) => (x.id === row.id ? row : x)))
    toast(row.is_published ? 'Product saved and live' : 'Saved as a draft')
    return true
  }

  async function confirmSave() {
    if (await save()) navigate('/dashboard/products')
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const old = p.file_path
      // Team editors upload into the page owner's folder
      const meta = await uploadProductFile(file, p.id, page.owner_id)
      const { error } = await supabase.from('products').update(meta).eq('id', p.id)
      if (error) throw error
      set(meta)
      setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, ...meta } : x)))
      if (old) removeProductFile(old)
      toast('File uploaded')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  async function remove() {
    if (!(await askConfirm({ title: 'Delete this product?', message: 'Past orders stay in your sales history, but buyers lose their downloads and bookings for it. To keep those working, turn it off instead.', confirmLabel: 'Delete' }))) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) return toast(error.message, 'error')
    if (p.file_path) removeProductFile(p.file_path)
    setProducts((list) => list.filter((x) => x.id !== p.id))
    navigate('/dashboard/products')
  }

  const priceLabel = p.type === 'membership' ? `Price per ${p.data.interval === 'year' ? 'year' : 'month'} (₹)` : 'Price (₹)'

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-2">
        <Link to="/dashboard/products" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink"><ArrowLeft className="size-4" /> Products</Link>
        <div className="flex items-center gap-2">
          {p.is_published && p.type !== 'link' && (
            <Button variant="outline" size="sm" href={`/${page.username}/p/${p.id}`} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> View</Button>
          )}
          {canEdit && <Button variant="dangerSoft" size="sm" onClick={remove} aria-label="Delete product"><Trash2 className="size-4" /></Button>}
        </div>
      </div>

      <div className="flex items-center gap-3 px-1">
        <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${t.color}`}><t.icon className="size-5" /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-500">{t.label}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight break-words">{p.title || 'Untitled product'}</h1>
        </div>
      </div>

      {!canEdit && <Alert tone="info"><span className="inline-flex items-center gap-1.5"><Eye className="size-4" /> You have view-only access to this page’s products.</span></Alert>}

      <fieldset disabled={!canEdit} className="m-0 min-w-0 border-0 p-0">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-4">
            <Card className="grid gap-4 p-5 sm:p-7">
              <Input label="Title" maxLength={120} placeholder={TITLE_PLACEHOLDER[p.type] || 'Lightroom preset pack (12 presets)'} value={p.title} onChange={(e) => set({ title: e.target.value })} />
              <Textarea label="Description" rows={6} maxLength={4000} placeholder="What’s included, who it’s for, what buyers get…" value={p.description} onChange={(e) => set({ description: e.target.value })} />
              <ImageInput label="Thumbnail" value={p.thumbnail_url} onChange={(thumbnail_url) => set({ thumbnail_url })} folder="products" />
            </Card>

            {p.type === 'digital' && (
              <Card className="p-5 sm:p-7">
                <h2 className="text-lg font-bold">File</h2>
                <p className="mt-1 text-sm text-ink-500">Stored privately. Buyers get a secure link that expires after a few minutes. PDF, ZIP, images, docs, audio, presets — no video.</p>
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-cream p-4">
                  <FileUp className="size-5" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.file_name ? `${p.file_name} · ${formatBytes(p.file_size)}` : 'No file yet'}</span>
                  {canEdit && <Button size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>{p.file_name ? 'Replace' : 'Upload file'}</Button>}
                  <input ref={fileRef} type="file" className="hidden" onChange={onFile} accept=".pdf,.zip,.rar,.epub,.jpg,.jpeg,.png,.webp,.gif,.svg,.psd,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.mp3,.xmp,.dng,.lrtemplate,.cube,.ttf,.otf" />
                </div>
                <Textarea className="mt-4" label="Note for buyers (optional)" rows={2} maxLength={1000} placeholder="How to install the presets…" value={p.private.instructions || ''} onChange={(e) => setPrivate({ instructions: e.target.value })} />
              </Card>
            )}

            {p.type === 'bundle' && (
              <>
                <BundleItems product={p} products={products} value={p.data.items || []} onChange={(items) => setData({ items })} />
                <Card className="p-5 sm:p-7">
                  <Textarea label="Note for buyers (optional)" rows={2} maxLength={1000} placeholder="Start with the guide, then install the presets." value={p.private.instructions || ''} onChange={(e) => setPrivate({ instructions: e.target.value })} />
                </Card>
              </>
            )}

            {p.type === 'content' && (
              <Card className="grid gap-4 p-5 sm:p-7">
                <div>
                  <h2 className="text-lg font-bold">Locked content</h2>
                  <p className="mt-1 text-sm text-ink-500">Shown only after purchase, on the buyer’s order page. Links are clickable. Line breaks are kept.</p>
                </div>
                <Textarea rows={12} maxLength={20000} placeholder={'My full gear list:\nCamera — https://…\nMic — https://…\n\nBrand-deal email template:\n…'} value={p.private.content || ''} onChange={(e) => setPrivate({ content: e.target.value })} />
              </Card>
            )}

            {p.type === 'membership' && (
              <Card className="grid gap-4 p-5 sm:p-7">
                <div>
                  <h2 className="text-lg font-bold">Membership</h2>
                  <p className="mt-1 text-sm text-ink-500">Members also unlock any sub-page you set to <b>Members only</b> in the editor. Access ends when the period runs out unless they renew.</p>
                </div>
                <Select label="Billing period" value={p.data.interval === 'year' ? 'year' : 'month'} onChange={(e) => setData({ interval: e.target.value })} options={[{ value: 'month', label: 'Monthly' }, { value: 'year', label: 'Yearly' }]} />
                <Input label="Community invite link" inputMode="url" placeholder="https://t.me/+… · https://chat.whatsapp.com/… · https://discord.gg/…" value={p.private.invite_url || ''} onChange={(e) => setPrivate({ invite_url: e.target.value })} hint="Telegram, WhatsApp or Discord. Only shown to active members." />
                <Textarea label="Joining instructions (optional)" rows={3} maxLength={1000} placeholder="Introduce yourself in #welcome and read the pinned post." value={p.private.instructions || ''} onChange={(e) => setPrivate({ instructions: e.target.value })} />
              </Card>
            )}

            {p.type === 'question' && (
              <Card className="grid gap-4 p-5 sm:p-7">
                <div>
                  <h2 className="text-lg font-bold">Priority question</h2>
                  <p className="mt-1 text-sm text-ink-500">Buyers write their question at checkout. Answer it from <b>Sales → Questions</b> — the reply appears on their order page.</p>
                </div>
                <Select label="I’ll reply within" value={String(p.data.response_days || 3)} onChange={(e) => setData({ response_days: Number(e.target.value) })} options={[1, 2, 3, 5, 7].map((n) => ({ value: String(n), label: `${n} day${n === 1 ? '' : 's'}` }))} />
              </Card>
            )}

            {p.type === 'link' && (
              <Card className="grid gap-4 p-5 sm:p-7">
                <Input label="Buy link" inputMode="url" placeholder="https://www.amazon.in/…" value={p.data.url || ''} onChange={(e) => setData({ url: e.target.value })} />
                <Input label="Store name (optional)" maxLength={30} placeholder="Amazon, Nykaa, my website…" value={p.data.label || ''} onChange={(e) => setData({ label: e.target.value })} />
              </Card>
            )}

            {p.type === 'session' && (
              <Card className="grid gap-5 p-5 sm:p-7">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Select label="Duration" value={String(p.data.duration || 30)} onChange={(e) => setData({ duration: Number(e.target.value) })} options={[15, 20, 30, 45, 60, 90].map((n) => ({ value: String(n), label: `${n} min` }))} />
                  <Select label="Gap between calls" value={String(p.data.buffer ?? 10)} onChange={(e) => setData({ buffer: Number(e.target.value) })} options={[0, 5, 10, 15, 30].map((n) => ({ value: String(n), label: `${n} min` }))} />
                  <Select label="Bookable up to" value={String(p.data.advance_days || 14)} onChange={(e) => setData({ advance_days: Number(e.target.value) })} options={[7, 14, 30, 60].map((n) => ({ value: String(n), label: `${n} days ahead` }))} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select label="Sessions in this package" value={String(p.data.sessions || 1)} onChange={(e) => setData({ sessions: Number(e.target.value) })} options={[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => ({ value: String(n), label: n === 1 ? 'Single session' : `${n} sessions` }))} hint={Number(p.data.sessions) > 1 ? 'Buyers book each session from their order page.' : undefined} />
                  <Select label="Buyer can reschedule" value={String(p.data.reschedule_hours ?? 24)} onChange={(e) => setData({ reschedule_hours: Number(e.target.value) })} options={[{ value: '-1', label: 'Not allowed' }, ...[2, 6, 12, 24, 48, 72].map((n) => ({ value: String(n), label: `Up to ${n} h before` }))]} />
                </div>
                <Availability value={p.data.availability || []} onChange={(availability) => setData({ availability })} />
                <Input label="Meeting link (shared only after booking)" placeholder="Your Zoom / Google Meet personal room link" value={p.private.meeting_url || ''} onChange={(e) => setPrivate({ meeting_url: e.target.value })} />
                <Textarea label="Instructions for the buyer (optional)" rows={2} maxLength={1000} placeholder="Please share your Instagram handle before the call." value={p.private.instructions || ''} onChange={(e) => setPrivate({ instructions: e.target.value })} />
              </Card>
            )}

            {p.type === 'webinar' && (
              <Card className="grid gap-4 p-5 sm:grid-cols-3 sm:p-7">
                <Input className="sm:col-span-3" label="Starts (IST)" type="datetime-local" value={toIstInput(p.data.starts_at)} onChange={(e) => setData({ starts_at: fromIstInput(e.target.value) })} />
                <Select label="Duration" value={String(p.data.duration || 60)} onChange={(e) => setData({ duration: Number(e.target.value) })} options={[30, 45, 60, 90, 120, 180].map((n) => ({ value: String(n), label: `${n} min` }))} />
                <Input label="Seats (optional)" type="number" min={1} placeholder="Unlimited" value={p.data.capacity || ''} onChange={(e) => setData({ capacity: e.target.value })} />
                <Input className="sm:col-span-3" label="Zoom joining link (shared only with buyers)" placeholder="https://zoom.us/j/…" value={p.private.meeting_url || ''} onChange={(e) => setPrivate({ meeting_url: e.target.value })} />
                <Textarea className="sm:col-span-3" label="Instructions for attendees (optional)" rows={2} maxLength={1000} value={p.private.instructions || ''} onChange={(e) => setPrivate({ instructions: e.target.value })} />
              </Card>
            )}

            {sellable && (
              <Card className="grid gap-4 p-5 sm:p-7">
                <div>
                  <h2 className="text-lg font-bold">One-click upsell</h2>
                  <p className="mt-1 text-sm text-ink-500">After checkout, buyers see a special offer they can add with one tap — no form to fill again.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
                  <Select
                    label="Offer"
                    value={p.data.upsell_product_id || ''}
                    onChange={(e) => setData({ upsell_product_id: e.target.value || null })}
                    options={[{ value: '', label: 'No upsell' }, ...upsellOptions.map((x) => ({ value: x.id, label: `${x.title || 'Untitled'} · ${PRODUCT_TYPES[x.type].label}${x.is_published ? '' : ' (draft)'}` }))]}
                    hint={upsellOptions.length ? 'Digital downloads, paid content and bundles. Must be published to show.' : 'Create a digital download, paid content or bundle to offer as an upsell.'}
                  />
                  {p.data.upsell_product_id && (
                    <Input label="Special price (₹)" type="number" min={0} placeholder={String(upsellOptions.find((x) => x.id === p.data.upsell_product_id)?.price_inr ?? '')} value={p.data.upsell_price_inr ?? ''} onChange={(e) => setData({ upsell_price_inr: e.target.value })} />
                  )}
                </div>
              </Card>
            )}
          </div>

          <div className="min-w-0 space-y-4 lg:sticky lg:top-28 lg:self-start">
            <Card className="grid gap-4 p-5 sm:p-6">
              <h2 className="text-lg font-bold">{p.type === 'link' ? 'Display price' : 'Pricing'}</h2>
              <div className="grid grid-cols-2 gap-3">
                <Input label={priceLabel} type="number" min={0} value={p.price_inr} onChange={(e) => set({ price_inr: e.target.value })} hint={Number(p.price_inr) === 0 && p.type !== 'link' ? 'Free' : undefined} />
                <Input label="Was (₹)" type="number" min={0} placeholder="Optional" value={p.compare_at_inr || ''} onChange={(e) => set({ compare_at_inr: e.target.value })} />
              </div>
              {sellable && (
                <>
                  <Toggle label="Pay what you want" description="Buyers can pay more than the minimum" checked={p.pay_what_you_want} onChange={(v) => set({ pay_what_you_want: v })} disabled={!canEdit} />
                  {p.pay_what_you_want && <Input label="Minimum (₹)" type="number" min={0} value={p.min_price_inr} onChange={(e) => set({ min_price_inr: e.target.value })} />}
                </>
              )}
            </Card>

            {sellable && (
              <Card className="grid gap-4 p-5 sm:p-6">
                <div>
                  <h2 className="text-lg font-bold">Limited-time offer</h2>
                  <p className="mt-1 text-xs text-ink-500">Shows a countdown and the regular price struck through.</p>
                </div>
                <Input label="Offer price (₹)" type="number" min={0} placeholder="None" value={p.sale_price_inr ?? ''} onChange={(e) => set({ sale_price_inr: e.target.value })} />
                {!blank(p.sale_price_inr) && (
                  <div className="grid gap-2">
                    <Input label="Offer ends (IST)" type="datetime-local" value={toIstInput(p.sale_ends_at)} onChange={(e) => set({ sale_ends_at: fromIstInput(e.target.value) || null })} />
                    <div className="flex flex-wrap gap-1.5">
                      {[['24 hours', 1], ['3 days', 3], ['7 days', 7]].map(([label, days]) => (
                        <button key={label} type="button" onClick={() => set({ sale_ends_at: new Date(Date.now() + days * 86400_000).toISOString() })} className="h-8 rounded-full bg-cream px-3 text-xs font-semibold hover:bg-cream-300">In {label}</button>
                      ))}
                      {p.sale_ends_at && <button type="button" onClick={() => set({ sale_ends_at: null })} className="h-8 rounded-full px-3 text-xs font-semibold text-ink-500 hover:bg-cream">No end date</button>}
                    </div>
                  </div>
                )}
                {!blank(p.sale_price_inr) && !p.sale_ends_at && <p className="-mt-2 text-xs text-ink-500">No end date — the offer runs until you remove it.</p>}
                {!blank(p.sale_price_inr) && p.sale_ends_at && new Date(p.sale_ends_at) < new Date() && <p className="-mt-2 text-xs font-medium text-red-600">This offer has ended — buyers pay the regular price.</p>}
                <Input label="Stock (optional)" type="number" min={0} placeholder="Unlimited" value={p.stock ?? ''} onChange={(e) => set({ stock: e.target.value })} hint={!blank(p.stock) ? `${Math.max(0, Number(p.stock) - (p.sales_count || 0))} left · shows “Only N left” on the page` : 'Limit how many can be sold'} />
              </Card>
            )}

            {canEdit && (
              <Card className="grid gap-4 p-5 sm:p-6">
                <Toggle
                  label="Published"
                  description={p.is_published ? 'Visible on your page and buyable once saved' : 'Only you can see this'}
                  checked={p.is_published}
                  onChange={(v) => set({ is_published: v })}
                />
                {missing(p) && <Alert tone="info">{p.is_published ? 'To publish' : 'Before publishing'}: {missing(p).toLowerCase()}.</Alert>}
                <Button size="lg" onClick={() => setReviewing(true)}>Save</Button>
              </Card>
            )}
          </div>
        </div>
      </fieldset>
      <SaveSummary open={reviewing} product={p} saving={saving} onClose={() => setReviewing(false)} onSave={confirmSave} onDraft={() => set({ is_published: false })} />
    </div>
  )
}
