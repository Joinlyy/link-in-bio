import { useCallback, useEffect, useState } from 'react'
import { CARD_COLUMNS, CARD_STYLES, PRODUCT_LIMITS } from '../BlockFields'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check, Coffee, Copy, Plus, ShoppingBag, Ticket, Trash2 } from 'lucide-react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { usePage } from '../../../context/PageContext'
import { errorMessage, supabase } from '../../../lib/supabase'
import { formatInr } from '../../../lib/images'
import { pageUrl } from '../../../lib/config'
import { removeProductFile } from '../../../lib/storage'
import { useOwnerFeatures } from '../../../lib/usePlan'
import { Badge, Button, Card, Empty, Input, Modal, Select, Tabs, Toggle, useToast } from '../../../components/ui'
import { DataTable, useViewMode, ViewToggle } from '../../../components/DataTable'
import { PageHeading } from '../DashboardLayout'
import { BLOCK_TYPES } from '../blockTypes'
import SectionCard from '../SectionCard'
import { MAIN_PRODUCT_TYPES, missing, PRODUCT_TYPES, saleActive } from './productTypes'

const CATEGORY_LABEL = { digital: 'Digital products', session: '1:1 sessions', webinar: 'Webinars', link: 'Affiliate', bundle: 'Bundles', content: 'Paid content', membership: 'Memberships', question: 'Paid messages' }

/** What a product costs right now: the words to show and the number to sort by */
function priceOf(p) {
  const onSale = p.type !== 'link' && saleActive(p)
  const amount = p.pay_what_you_want ? p.min_price_inr : onSale ? p.sale_price_inr : p.price_inr
  const label = p.type === 'link' ? (p.price_inr ? formatInr(p.price_inr) : 'Buy link') : p.pay_what_you_want ? `${formatInr(p.min_price_inr)}+` : amount ? formatInr(amount) : 'Free'
  return { label, amount: amount || 0, onSale }
}
const statusOf = (p) => (p.is_published ? 'Live' : p.title ? 'Deactivated' : 'Draft')

function TypeOption({ type, onPick }) {
  const t = PRODUCT_TYPES[type]
  return (
    <button type="button" onClick={() => onPick(type)} className="flex items-center gap-4 rounded-2xl border border-ink/10 p-4 text-left transition hover:-translate-y-0.5 hover:border-ink/30">
      <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${t.color}`}><t.icon className="size-5" /></span>
      <span>
        <span className="block font-semibold">{t.label}</span>
        <span className="block text-sm text-ink-500">{t.desc}</span>
      </span>
    </button>
  )
}

function NewProductModal({ open, onClose, onPick }) {
  return (
    <Modal open={open} onClose={onClose} title="What do you want to add?">
      <div className="grid gap-2.5">
        {MAIN_PRODUCT_TYPES.map((type) => <TypeOption key={type} type={type} onPick={onPick} />)}
      </div>
    </Modal>
  )
}

/** Fans can send a small amount without the creator setting up a product */
function CoffeeCard() {
  const { blocks, addBlock, autoPage, canEdit } = usePage()
  const [open, setOpen] = useState(false)
  const block = blocks.find((b) => b.type === 'tip')
  if (block) return <SectionCard block={block} open={open} onToggle={() => setOpen(!open)} />
  return (
    <Card className="flex flex-wrap items-center gap-4 p-5">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-50"><Coffee className="size-5" /></span>
      <div className="min-w-0 flex-1 basis-52">
        <p className="font-bold">Buy me a coffee</p>
        <p className="text-sm text-ink-500">Let fans support you with a small amount.</p>
      </div>
      {canEdit && (
        <Button
          variant="ghost"
          onClick={async () => {
            if (await addBlock('tip', BLOCK_TYPES.tip.defaults, { sitePage: await autoPage('shop') })) setOpen(true)
          }}
        >
          <Plus className="size-4" /> Add to my website
        </Button>
      )}
    </Card>
  )
}

function Coupons() {
  const { page, products } = usePage()
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [view, setView] = useViewMode('coupons')
  const [form, setForm] = useState({ code: '', kind: 'percent', value: '', product_id: '', max_uses: '', expires_at: '' })

  const load = useCallback(async () => {
    const { data } = await supabase.from('coupons').select('*').eq('page_id', page.id).order('created_at', { ascending: false })
    setRows(data || [])
  }, [page.id])
  useEffect(() => {
    load()
  }, [load])

  async function add(e) {
    e.preventDefault()
    const v = parseInt(form.value, 10)
    if (!v) return toast('Enter a discount value', 'error')
    const { error } = await supabase.from('coupons').insert({
      page_id: page.id,
      code: form.code.toUpperCase(),
      percent_off: form.kind === 'percent' ? Math.min(v, 100) : null,
      amount_off_inr: form.kind === 'amount' ? v : null,
      product_id: form.product_id || null,
      max_uses: form.max_uses ? parseInt(form.max_uses, 10) : null,
      expires_at: form.expires_at ? new Date(`${form.expires_at}T23:59:59+05:30`).toISOString() : null,
    })
    if (error) return toast(/coupons_page_id_code_key/.test(error.message) ? 'You already have a coupon with that code' : error.message, 'error')
    setForm({ code: '', kind: 'percent', value: '', product_id: '', max_uses: '', expires_at: '' })
    toast('Coupon created')
    load()
  }

  return (
    <Card className="p-5 sm:p-7">
      <div className="flex items-center gap-2"><Ticket className="size-5" /><h2 className="text-lg font-bold">Coupons</h2></div>
      <form onSubmit={add} className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:items-end">
        <Input label="Code" required placeholder="DIWALI20" maxLength={24} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} />
        <Select label="Type" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} options={[{ value: 'percent', label: '% off' }, { value: 'amount', label: '₹ off' }]} />
        <Input label={form.kind === 'percent' ? 'Percent' : 'Amount (₹)'} type="number" min={1} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
        <Select label="Applies to" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} options={[{ value: '', label: 'All products' }, ...products.filter((p) => p.type !== 'link').map((p) => ({ value: p.id, label: p.title || 'Untitled' }))]} />
        <Input label="Max uses" type="number" min={1} placeholder="∞" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} />
        <Button type="submit" className="h-12">Create</Button>
      </form>
      {rows.length > 0 && <div className="mt-5"><ViewToggle value={view} onChange={setView} /></div>}
      {rows.length > 0 && view === 'table' && (
        <div className="mt-3 rounded-2xl border border-ink/10">
          <DataTable
            bare
            rows={rows}
            minWidth={680}
            columns={[
              { key: 'code', label: 'Code', value: (c) => c.code, render: (c) => <code className="rounded-lg bg-lime px-2 py-0.5 font-bold">{c.code}</code> },
              { key: 'off', label: 'Discount', value: (c) => c.percent_off || c.amount_off_inr, render: (c) => (c.percent_off ? `${c.percent_off}% off` : `${formatInr(c.amount_off_inr)} off`) },
              { key: 'used_count', label: 'Used', align: 'right', value: (c) => c.used_count, render: (c) => `${c.used_count}${c.max_uses ? `/${c.max_uses}` : ''}` },
              { key: 'product', label: 'Applies to', value: (c) => (c.product_id ? products.find((p) => p.id === c.product_id)?.title || 'One product' : 'All products'), className: 'max-w-48 truncate text-ink-600' },
              { key: 'is_active', label: 'On', value: (c) => (c.is_active ? 1 : 0), render: (c) => <Toggle checked={c.is_active} onChange={async (v) => { await supabase.from('coupons').update({ is_active: v }).eq('id', c.id); load() }} /> },
              { key: 'actions', label: '', align: 'right', render: (c) => <button type="button" onClick={async () => { await supabase.from('coupons').delete().eq('id', c.id); load() }} className="ml-auto grid size-8 place-items-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete coupon"><Trash2 className="size-4" /></button> },
            ]}
          />
        </div>
      )}
      {rows.length > 0 && view !== 'table' && (
        <div className="mt-3 divide-y divide-ink/5 rounded-2xl border border-ink/10">
          {rows.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <code className="rounded-lg bg-lime px-2 py-0.5 font-bold">{c.code}</code>
              <span className="flex-1 text-ink-600">
                {c.percent_off ? `${c.percent_off}% off` : `${formatInr(c.amount_off_inr)} off`} · used {c.used_count}{c.max_uses ? `/${c.max_uses}` : ''}
                {c.product_id && ` · ${products.find((p) => p.id === c.product_id)?.title || 'one product'}`}
              </span>
              <Toggle checked={c.is_active} onChange={async (v) => { await supabase.from('coupons').update({ is_active: v }).eq('id', c.id); load() }} />
              <button type="button" onClick={async () => { await supabase.from('coupons').delete().eq('id', c.id); load() }} className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete coupon"><Trash2 className="size-4" /></button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/** How products appear on the public page; settings live on the page's Products block */
function ProductDisplay() {
  const { products, blocks, updateBlock, canEdit } = usePage()
  const block = blocks.find((b) => b.type === 'products')
  const shown = products.filter((p) => p.is_published && p.show_on_page !== false).length
  if (!block || !products.length) return null
  const d = block.data || {}
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">How they appear on your page</h2>
        <Badge tone="lilac">{shown} showing</Badge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Section name" maxLength={80} disabled={!canEdit} value={d.title || ''} onChange={(e) => updateBlock(block.id, { data: { title: e.target.value } })} />
        <Select label="Cards in a row" disabled={!canEdit} value={String(d.columns || (d.layout === 'carousel' ? 'swipe' : d.layout === 'list' ? 1 : 2))} onChange={(e) => updateBlock(block.id, { data: { columns: e.target.value === 'swipe' ? 'swipe' : Number(e.target.value) } })} options={CARD_COLUMNS} />
        <Select label="Card style" disabled={!canEdit} value={d.style || (d.layout === 'list' ? 'row' : 'image')} onChange={(e) => updateBlock(block.id, { data: { style: e.target.value } })} options={CARD_STYLES} />
        <Select label="How many" disabled={!canEdit} value={String(d.limit || 0)} onChange={(e) => updateBlock(block.id, { data: { limit: Number(e.target.value) } })} options={PRODUCT_LIMITS} />
      </div>
      <p className="mt-3 text-xs text-ink-500">This is the same Products section as in Website → Pages, so a change here shows there too. With 4 or more products of different kinds, visitors also get filters like Downloads and 1:1 sessions.</p>
    </Card>
  )
}

export default function Products() {
  const { page, products, setProducts, canEdit, ensureProductsBlock, syncShopMenu } = usePage()
  const navigate = useNavigate()
  const toast = useToast()
  const { state: routeState } = useLocation()
  const [picking, setPicking] = useState(Boolean(routeState?.newProduct))
  const [category, setCategory] = useState(null)
  const [selected, setSelected] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useViewMode('products')
  const features = useOwnerFeatures(page.owner_id)
  const liveCount = products.filter((p) => p.is_published).length
  const categories = [...MAIN_PRODUCT_TYPES, ...Object.keys(PRODUCT_TYPES).filter((type) => !MAIN_PRODUCT_TYPES.includes(type) && products.some((p) => p.type === type))]
  const visible = category ? products.filter((p) => p.type === category) : products
  const chosen = products.filter((p) => selected.includes(p.id))
  const chosenSold = chosen.filter((p) => p.sales_count > 0).length

  function pickCategory(type) {
    setCategory(type)
    setSelected([])
  }

  async function deactivate() {
    setBusy(true)
    const { error } = await supabase.from('products').update({ is_published: false }).in('id', selected)
    setBusy(false)
    setConfirmDelete(false)
    if (error) return toast(errorMessage(error), 'error')
    setProducts((list) => list.map((p) => (selected.includes(p.id) ? { ...p, is_published: false } : p)))
    toast(`${selected.length} deactivated. Buyers keep their access.`)
    setSelected([])
  }

  async function removeSelected() {
    setBusy(true)
    const { data, error } = await supabase.from('products').delete().in('id', selected).select('id, file_path')
    setBusy(false)
    setConfirmDelete(false)
    if (error) return toast(errorMessage(error), 'error')
    for (const row of data) if (row.file_path) removeProductFile(row.file_path)
    const gone = data.map((row) => row.id)
    setProducts((list) => list.filter((p) => !gone.includes(p.id)))
    toast(`${gone.length} deleted`)
    setSelected([])
  }

  async function activate(p) {
    const { data: full, error: readError } = await supabase.from('products').select('*').eq('id', p.id).single()
    if (readError) return toast(errorMessage(readError), 'error')
    const problem = missing(full)
    if (problem) {
      toast(problem, 'error')
      return navigate(`/dashboard/products/${p.id}`)
    }
    const { error } = await supabase.from('products').update({ is_published: true }).eq('id', p.id)
    if (error) return toast(errorMessage(error), 'error')
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, is_published: true } : x)))
    toast('Product is live')
  }

  // Published products must actually appear: make sure the page has a Products section
  useEffect(() => {
    if (!canEdit) return
    const showing = products.some((p) => p.is_published && p.show_on_page !== false)
    if (showing) ensureProductsBlock()
    syncShopMenu(showing)
  }, [canEdit, products, ensureProductsBlock, syncShopMenu])

  async function toggleShow(p, show) {
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, show_on_page: show } : x)))
    const { error } = await supabase.from('products').update({ show_on_page: show }).eq('id', p.id)
    if (error) {
      setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, show_on_page: !show } : x)))
      return toast(errorMessage(error), 'error')
    }
    toast(show ? 'Showing on your page' : 'Hidden from your page. The direct link still works.')
  }

  async function move(index, dir) {
    const j = index + dir
    if (j < 0 || j >= products.length) return
    const next = [...products]
    ;[next[index], next[j]] = [next[j], next[index]]
    setProducts(next.map((p, i) => ({ ...p, position: i })))
    const results = await Promise.all(next.map((p, i) => supabase.from('products').update({ position: i }).eq('id', p.id)))
    if (results.some((r) => r.error)) toast('Could not save the new order', 'error')
  }

  async function create(type) {
    setPicking(false)
    const def = PRODUCT_TYPES[type].defaults
    const { data, error } = await supabase
      .from('products')
      .insert({ page_id: page.id, owner_id: page.owner_id, type, title: '', data: def.data, private: def.private, position: products.length })
      .select()
      .single()
    if (error) return toast(error.message, 'error')
    setProducts((list) => [...list, data])
    navigate(`/dashboard/products/${data.id}`)
  }

  return (
    <div className="space-y-4">
      <PageHeading title="Products." italic="Sell anything." actions={canEdit && <Button onClick={() => setPicking(true)}><Plus className="size-4" /> New product</Button>}>
        Digital products, 1:1 sessions, webinars, affiliate products and paid messages. They go on a Shop page in your site’s top menu. Optional: with nothing to sell, your website works fine without it.
      </PageHeading>

      <div className="rounded-3xl bg-lilac-100 px-5 py-4 text-sm">
        <b>Test mode:</b> checkout works end to end but no real money moves yet. Razorpay will be switched on later — your products won’t need any changes.
      </div>

      {products.length === 0 ? (
        <Empty icon={ShoppingBag} title="No products yet" action={canEdit && <Button onClick={() => setPicking(true)}>Create your first product</Button>}>
          Start with a PDF guide, a 30-minute call or something you recommend from another store.
        </Empty>
      ) : (
        <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Tabs label="Product categories" value={category} onChange={pickCategory} tabs={[null, ...categories].map((type) => ({ key: type, label: type ? CATEGORY_LABEL[type] : 'All', count: type ? products.filter((p) => p.type === type).length : products.length }))} />
          <div className="flex items-center gap-3">
            {features?.max_products != null && <p className="text-sm font-semibold text-ink-600">{liveCount} of {features.max_products} live</p>}
            <ViewToggle value={view} onChange={setView} />
          </div>
        </div>
        {visible.length === 0 && category && (
          <Empty icon={PRODUCT_TYPES[category].icon} title={`No ${CATEGORY_LABEL[category].toLowerCase()} yet`} action={canEdit && <Button onClick={() => create(category)}><Plus className="size-4" /> Add {/^[aeiou1]/i.test(PRODUCT_TYPES[category].label) ? 'an' : 'a'} {PRODUCT_TYPES[category].label.toLowerCase()}</Button>}>
            {PRODUCT_TYPES[category].desc}
          </Empty>
        )}
        {visible.length > 0 && view === 'table' && (
          <DataTable
            rows={visible}
            minWidth={920}
            onRowClick={(p) => navigate(`/dashboard/products/${p.id}`)}
            columns={[
              { key: 'title', label: 'Product', value: (p) => p.title, render: (p) => {
                const t = PRODUCT_TYPES[p.type] || PRODUCT_TYPES.digital
                return (
                  <span className="flex items-center gap-2.5">
                    {canEdit && <input type="checkbox" className="size-4 shrink-0 accent-ink" aria-label={`Select ${p.title || 'untitled product'}`} checked={selected.includes(p.id)} onChange={() => setSelected((list) => (list.includes(p.id) ? list.filter((id) => id !== p.id) : [...list, p.id]))} />}
                    <span className={`grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg ${t.color}`}>{p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="size-full object-cover" /> : <t.icon className="size-4 opacity-50" />}</span>
                    <span className="min-w-0 truncate">{p.title || 'Untitled product'}</span>
                  </span>
                )
              } },
              { key: 'type', label: 'Type', value: (p) => (PRODUCT_TYPES[p.type] || PRODUCT_TYPES.digital).label, className: 'whitespace-nowrap text-ink-600' },
              { key: 'status', label: 'Status', value: statusOf, render: (p) => <Badge tone={p.is_published ? 'green' : 'neutral'}>{statusOf(p)}</Badge> },
              { key: 'price', label: 'Price', align: 'right', value: (p) => priceOf(p).amount, className: 'font-semibold whitespace-nowrap', render: (p) => priceOf(p).label },
              { key: 'sales_count', label: 'Sold', align: 'right', value: (p) => (p.type === 'link' ? null : p.sales_count), render: (p) => (p.type === 'link' ? '—' : p.sales_count) },
              { key: 'show', label: 'On my page', value: (p) => (p.show_on_page !== false ? 1 : 0), render: (p) => <Toggle checked={p.show_on_page !== false} disabled={!canEdit || !p.is_published} onChange={(v) => toggleShow(p, v)} /> },
              { key: 'actions', label: '', align: 'right', render: (p) => (canEdit && !p.is_published
                ? <button type="button" onClick={() => activate(p)} className="text-xs font-semibold underline underline-offset-2">Activate</button>
                : p.type !== 'link' && <button type="button" onClick={() => navigator.clipboard.writeText(`${pageUrl(page.username)}/p/${p.id}`).then(() => toast('Product link copied'))} className="ml-auto grid size-8 place-items-center rounded-full text-ink-500 hover:bg-white" aria-label="Copy product link"><Copy className="size-4" /></button>) },
            ]}
          />
        )}
        {view !== 'table' && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => {
            const index = products.indexOf(p)
            const isSelected = selected.includes(p.id)
            const t = PRODUCT_TYPES[p.type] || PRODUCT_TYPES.digital
            const { label: price, onSale } = priceOf(p)
            const left = p.stock != null && p.type !== 'link' ? Math.max(0, p.stock - (p.sales_count || 0)) : null
            return (
              <Card key={p.id} className={`relative flex flex-col overflow-hidden ${isSelected ? 'ring-2 ring-ink' : ''}`}>
                {canEdit && (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={`Select ${p.title || 'untitled product'}`}
                    onClick={() => setSelected((list) => (isSelected ? list.filter((id) => id !== p.id) : [...list, p.id]))}
                    className={`absolute top-3 right-3 z-10 grid size-8 place-items-center rounded-full border-2 shadow-soft ${isSelected ? 'border-ink bg-ink text-lime' : 'border-white bg-white/90 text-transparent'}`}
                  >
                    <Check className="size-4" strokeWidth={3} />
                  </button>
                )}
                <button type="button" onClick={() => navigate(`/dashboard/products/${p.id}`)} className="text-left">
                  <div className={`relative grid aspect-[16/9] place-items-center overflow-hidden ${t.color}`}>
                    {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="size-full object-cover" /> : <t.icon className="size-8 opacity-40" />}
                    {onSale && <span className="absolute top-3 left-3"><Badge tone="dark">Sale{p.sale_ends_at ? ` · ends ${new Date(p.sale_ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}` : ''}</Badge></span>}
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500"><t.icon className="size-3.5" /> {t.label}</span>
                      {p.is_published ? <Badge tone="green">Live</Badge> : <Badge>{p.title ? 'Deactivated' : 'Draft'}</Badge>}
                      {left != null && <Badge tone={left === 0 ? 'red' : 'lilac'}>{left === 0 ? 'Sold out' : `${left} left`}</Badge>}
                    </div>
                    <p className="mt-1 truncate text-lg font-bold">{p.title || 'Untitled product'}</p>
                    <p className="text-sm text-ink-600">
                      {price}
                      {p.type === 'membership' && !p.pay_what_you_want && (onSale ? p.sale_price_inr : p.price_inr) > 0 && ` / ${p.data?.interval === 'year' ? 'year' : 'month'}`}
                      {onSale && !p.pay_what_you_want && <span className="ml-1.5 text-ink-400 line-through">{formatInr(p.price_inr)}</span>}
                      {p.type !== 'link' && <> · {p.sales_count} {p.type === 'membership' ? 'joined' : 'sold'}</>}
                    </p>
                  </div>
                </button>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink/5 px-4 py-3">
                  <Toggle label="Show on my page" checked={p.show_on_page !== false} disabled={!canEdit || !p.is_published} onChange={(v) => toggleShow(p, v)} />
                  {canEdit && !category && (
                    <span className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="grid size-8 place-items-center rounded-full bg-cream disabled:opacity-30" aria-label="Move earlier"><ArrowUp className="size-4" /></button>
                      <button type="button" onClick={() => move(index, 1)} disabled={index === products.length - 1} className="grid size-8 place-items-center rounded-full bg-cream disabled:opacity-30" aria-label="Move later"><ArrowDown className="size-4" /></button>
                    </span>
                  )}
                </div>
                {canEdit && !p.is_published && (
                  <button type="button" onClick={() => activate(p)} className="mx-4 mb-4 self-start text-xs font-semibold underline underline-offset-2">Activate</button>
                )}
                {p.is_published && p.type !== 'link' && (
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(`${pageUrl(page.username)}/p/${p.id}`).then(() => toast('Product link copied'))}
                    className="mx-4 mb-4 inline-flex items-center gap-1.5 self-start text-xs font-semibold text-ink-600 hover:text-ink"
                  >
                    <Copy className="size-3.5" /> Copy product link
                  </button>
                )}
              </Card>
            )
          })}
        </div>}
        </>
      )}

      {selected.length > 0 && (
        <div className="sticky bottom-3 z-30 flex flex-wrap items-center gap-2 rounded-3xl bg-ink p-3 text-white shadow-lift" role="toolbar" aria-label="Selected products">
          <span className="px-2 text-sm font-semibold">{selected.length} selected</span>
          {selected.length < visible.length && (
            <button type="button" onClick={() => setSelected(visible.map((p) => p.id))} className="h-9 rounded-full px-3 text-sm font-semibold underline underline-offset-2">Select all {visible.length}</button>
          )}
          <span className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={() => setSelected([])} className="h-9 rounded-full px-3 text-sm font-semibold">Cancel</button>
            <button type="button" disabled={busy || !chosen.some((p) => p.is_published)} onClick={deactivate} className="h-9 rounded-full bg-white/15 px-4 text-sm font-semibold disabled:opacity-40">Deactivate</button>
            <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-red-600 px-4 text-sm font-semibold"><Trash2 className="size-4" /> Delete</button>
          </span>
        </div>
      )}

      <Modal open={confirmDelete} onClose={() => !busy && setConfirmDelete(false)} title={`Delete ${selected.length} product${selected.length === 1 ? '' : 's'}?`}>
        <p className="text-sm leading-relaxed text-ink-600">
          This can’t be undone.
          {chosenSold > 0 && <> <b>{chosenSold} of them {chosenSold === 1 ? 'has' : 'have'} buyers.</b> Past orders stay in Sales, but buyers lose their downloads and bookings. Deactivating hides a product and keeps buyers’ access.</>}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</Button>
          {chosenSold > 0 && chosen.some((p) => p.is_published) && <Button variant="outline" disabled={busy} onClick={deactivate}>Deactivate instead</Button>}
          <Button variant="dangerSoft" loading={busy} onClick={removeSelected}>Delete</Button>
        </div>
      </Modal>

      <CoffeeCard />
      <ProductDisplay />
      <Coupons />
      <NewProductModal open={picking} onClose={() => setPicking(false)} onPick={create} />
    </div>
  )
}
