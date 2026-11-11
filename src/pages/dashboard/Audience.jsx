import { useEffect, useMemo, useState } from 'react'
import { Bookmark, Download, Mail, Save, Search, UsersRound, X } from 'lucide-react'
import { usePage } from '../../context/PageContext'
import { errorMessage, supabase } from '../../lib/supabase'
import { whatsappUrl } from '../../lib/embeds'
import { formatInr } from '../../lib/images'
import { WhatsappIcon } from '../../components/icons'
import { Badge, Button, Card, Empty, Input, Modal, Select, Spinner, Stats, Tabs, useToast, askConfirm } from '../../components/ui'
import { DataTable, useViewMode, ViewToggle } from '../../components/DataTable'
import { PageHeading } from './DashboardLayout'

const PAGE_SIZE = 100

const SOURCES = [
  { key: 'lead', label: 'Leads', tone: 'lilac' },
  { key: 'buyer', label: 'Buyers', tone: 'green' },
  { key: 'tipper', label: 'Tippers', tone: 'lime' },
  { key: 'brand', label: 'Brands', tone: 'dark' },
]
const SOURCE_META = Object.fromEntries(SOURCES.map((s) => [s.key, s]))

const EMPTY_FILTER = { source: '', tag: '', product_id: '', min_spent: '', has_email: false, has_phone: false, since: '', q: '' }

/** Only send keys that actually filter, so saved segments stay tidy */
function cleanFilter(f) {
  const out = {}
  for (const [k, v] of Object.entries(f)) {
    if (v === '' || v === false || v == null) continue
    out[k] = k === 'min_spent' ? Number(v) : typeof v === 'string' ? v.trim() : v
  }
  return out
}

function toCsv(rows, productTitle) {
  const cols = ['name', 'email', 'phone', 'sources', 'tags', 'products', 'total_spent', 'orders', 'first_seen', 'last_seen']
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const val = (r, c) =>
    c === 'sources' || c === 'tags' ? (r[c] || []).join('; ') : c === 'products' ? (r.products || []).map(productTitle).join('; ') : r[c]
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(val(r, c))).join(','))].join('\n')
}

function Check({ checked, onChange, label }) {
  return (
    <label className={`flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold ${checked ? 'bg-ink text-white' : 'bg-cream'}`}>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export default function Audience() {
  const { page, products, canEdit } = usePage()
  const toast = useToast()
  const [filter, setFilter] = useState(EMPTY_FILTER)
  const [rows, setRows] = useState(null)
  const [all, setAll] = useState(null) // unfiltered, for tag options & source counts
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [segments, setSegments] = useState([])
  const [activeSegment, setActiveSegment] = useState(null)
  const [saving, setSaving] = useState(false)
  const [segName, setSegName] = useState('')
  const [view, setView] = useViewMode('audience', 'auto')
  const set = (patch) => {
    setActiveSegment(null)
    setFilter((f) => ({ ...f, ...patch }))
  }

  const productTitle = useMemo(() => {
    const map = Object.fromEntries(products.map((p) => [p.id, p.title]))
    return (id) => map[id] || 'Deleted product'
  }, [products])

  useEffect(() => {
    supabase.rpc('audience', { p_page_id: page.id, p_filter: {} }).then(({ data }) => setAll(data || []))
    supabase.from('segments').select('*').eq('page_id', page.id).order('created_at').then(({ data }) => setSegments(data || []))
  }, [page.id])

  const active = useMemo(() => cleanFilter(filter), [filter])
  const activeKey = JSON.stringify(active)

  useEffect(() => {
    let alive = true
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('audience', { p_page_id: page.id, p_filter: JSON.parse(activeKey) })
      if (!alive) return
      if (error) toast(errorMessage(error), 'error')
      setRows(data || [])
      setLimit(PAGE_SIZE)
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [page.id, activeKey, toast])

  const allTags = useMemo(() => [...new Set((all || []).flatMap((r) => r.tags || []))].sort(), [all])
  const sourceCounts = useMemo(() => {
    const c = {}
    for (const r of all || []) for (const s of r.sources || []) c[s] = (c[s] || 0) + 1
    return c
  }, [all])

  const stats = useMemo(() => {
    const list = rows || []
    return {
      count: list.length,
      emails: list.filter((r) => r.email).length,
      phones: list.filter((r) => r.phone).length,
      spent: list.reduce((s, r) => s + (r.total_spent || 0), 0),
    }
  }, [rows])

  const filtersOn = Object.keys(active).length > 0

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([toCsv(rows || [], productTitle)], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${page.username}-${activeSegment?.name?.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'audience'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function saveSegment() {
    const name = segName.trim()
    if (!name) return
    const { data, error } = await supabase.from('segments').insert({ page_id: page.id, name: name.slice(0, 60), filter: active }).select().single()
    if (error) return toast(errorMessage(error), 'error')
    setSegments((s) => [...s, data])
    setActiveSegment(data)
    setSaving(false)
    setSegName('')
    toast('Segment saved')
  }

  function loadSegment(seg) {
    setFilter({ ...EMPTY_FILTER, ...seg.filter, min_spent: seg.filter.min_spent ?? '' })
    setActiveSegment(seg)
  }

  async function deleteSegment(seg) {
    if (!(await askConfirm({ title: `Delete segment “${seg.name}”?`, confirmLabel: 'Delete' }))) return
    const { error } = await supabase.from('segments').delete().eq('id', seg.id)
    if (error) return toast(errorMessage(error), 'error')
    setSegments((s) => s.filter((x) => x.id !== seg.id))
    if (activeSegment?.id === seg.id) setActiveSegment(null)
  }

  const shown = (rows || []).slice(0, limit)
  const fmtDay = (ts) => new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  function Sources({ r }) {
    return (
      <div className="flex flex-wrap gap-1">
        {(r.sources || []).map((s) => <Badge key={s} tone={SOURCE_META[s]?.tone || 'neutral'}>{SOURCE_META[s]?.label.replace(/s$/, '') || s}</Badge>)}
        {(r.tags || []).map((t) => <span key={t} className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold text-ink-600">#{t}</span>)}
      </div>
    )
  }

  function QuickActions({ r, className = '' }) {
    return (
      <div className={`flex shrink-0 gap-1.5 ${className}`}>
        {r.email && <a href={`mailto:${r.email}`} className="grid size-9 place-items-center rounded-full bg-cream hover:bg-cream-300" aria-label={`Email ${r.email}`}><Mail className="size-4" /></a>}
        {r.phone && <a href={whatsappUrl(r.phone)} target="_blank" rel="noreferrer" className="grid size-9 place-items-center rounded-full bg-cream hover:bg-cream-300" aria-label="WhatsApp"><WhatsappIcon size={16} /></a>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeading
        title="Audience."
        italic="Everyone, in one place."
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows?.length}>
            <Download className="size-4" /> Export CSV
          </Button>
        }
      >
        Leads, buyers, tippers and brands merged by email or phone. Filter, save segments and reach out — only your team can see this.
      </PageHeading>

      <Stats
        loading={rows === null}
        items={[
          [filtersOn ? 'Matching contacts' : 'Contacts', stats.count.toLocaleString('en-IN'), 'bg-white'],
          ['With email', stats.emails.toLocaleString('en-IN'), 'bg-lilac-100'],
          ['With WhatsApp', stats.phones.toLocaleString('en-IN'), 'bg-lime'],
          ['Total spent', formatInr(stats.spent), 'bg-ink text-white'],
        ]}
      />

      {segments.length > 0 && (
        <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {segments.map((seg) => (
            <span key={seg.id} className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-full pr-1 pl-3.5 text-sm font-semibold ${activeSegment?.id === seg.id ? 'bg-ink text-white' : 'bg-white shadow-soft'}`}>
              <button type="button" onClick={() => loadSegment(seg)} className="flex items-center gap-1.5">
                <Bookmark className="size-3.5" /> {seg.name}
              </button>
              {canEdit && (
                <button type="button" onClick={() => deleteSegment(seg)} className="grid size-7 place-items-center rounded-full opacity-60 hover:opacity-100" aria-label={`Delete segment ${seg.name}`}>
                  <X className="size-3.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <Card className="space-y-3 p-3 sm:p-4">
        <label className="flex items-center gap-2 rounded-full bg-cream px-4">
          <Search className="size-4 shrink-0 text-ink-400" />
          <input className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search name, email or number" value={filter.q} onChange={(e) => set({ q: e.target.value })} />
        </label>

        <Tabs label="Source" value={filter.source} onChange={(source) => set({ source })} tabs={[{ key: '', label: 'All' }, ...SOURCES.map((s) => ({ key: s.key, label: s.label, count: sourceCounts[s.key] }))]} />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Tag" value={filter.tag} onChange={(e) => set({ tag: e.target.value })} options={[{ value: '', label: 'Any tag' }, ...allTags.map((t) => ({ value: t, label: t }))]} />
          <Select label="Bought product" value={filter.product_id} onChange={(e) => set({ product_id: e.target.value })} options={[{ value: '', label: 'Any product' }, ...products.map((p) => ({ value: p.id, label: p.title }))]} />
          <Input label="Min. spent (₹)" type="number" min={0} value={filter.min_spent} onChange={(e) => set({ min_spent: e.target.value })} />
          <Input label="Active since" type="date" value={filter.since} onChange={(e) => set({ since: e.target.value })} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Check checked={filter.has_email} onChange={(v) => set({ has_email: v })} label="Has email" />
          <Check checked={filter.has_phone} onChange={(v) => set({ has_phone: v })} label="Has WhatsApp" />
          <div className="ml-auto flex gap-2">
            {filtersOn && (
              <Button variant="ghost" size="sm" onClick={() => set(EMPTY_FILTER)}>Clear</Button>
            )}
            {canEdit && filtersOn && !activeSegment && (
              <Button variant="soft" size="sm" onClick={() => setSaving(true)}><Save className="size-4" /> Save segment</Button>
            )}
          </div>
        </div>
      </Card>

      {rows === null ? (
        <div className="grid h-60 place-items-center"><Spinner /></div>
      ) : rows.length === 0 ? (
        <Empty icon={UsersRound} title={filtersOn ? 'No matches' : 'No contacts yet'}>
          {filtersOn ? 'Try loosening your filters.' : 'Leads, buyers, tippers and brand enquiries all show up here automatically.'}
        </Empty>
      ) : (
        <>
        <ViewToggle value={view} onChange={setView} />
        <Card className="overflow-hidden">
          {view === 'table' ? (
            <DataTable
              bare
              rows={shown}
              rowKey={(r) => r.email || r.phone}
              defaultSort={{ key: 'last_seen', dir: -1 }}
              columns={[
                { key: 'name', label: 'Contact', value: (r) => r.name || r.email || r.phone, render: (r) => (
                  <>
                    <p className="truncate">{r.name || '—'}</p>
                    <p className="truncate text-xs font-normal text-ink-500">{[r.email, r.phone].filter(Boolean).join(' · ')}</p>
                  </>
                ) },
                { key: 'sources', label: 'Source & tags', value: (r) => (r.sources || []).join(' '), render: (r) => <Sources r={r} /> },
                { key: 'products', label: 'Products', value: (r) => (r.products || []).length || null, className: 'max-w-[220px] text-xs text-ink-600', render: (r) => (r.products || []).map(productTitle).join(', ') || '—' },
                { key: 'orders', label: 'Orders', align: 'right', value: (r) => r.orders || null, render: (r) => r.orders || '—' },
                { key: 'total_spent', label: 'Spent', align: 'right', value: (r) => r.total_spent || null, className: 'font-semibold whitespace-nowrap', render: (r) => (r.total_spent ? formatInr(r.total_spent) : '—') },
                { key: 'last_seen', label: 'Last seen', value: (r) => r.last_seen, className: 'whitespace-nowrap text-ink-500', render: (r) => fmtDay(r.last_seen) },
                { key: 'actions', label: '', render: (r) => <QuickActions r={r} className="justify-end" /> },
              ]}
            />
          ) : (
          <ul className="divide-y divide-ink/5">
            {shown.map((r) => (
              <li key={r.email || r.phone} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.name || r.email || r.phone}</p>
                  <p className="truncate text-sm text-ink-500">{[r.email, r.phone].filter(Boolean).join(' · ')}</p>
                  <div className="mt-1.5"><Sources r={r} /></div>
                  <p className="mt-1.5 text-xs text-ink-400">
                    {r.total_spent ? `${formatInr(r.total_spent)} spent · ` : ''}Last seen {fmtDay(r.last_seen)}
                  </p>
                  {r.products?.length > 0 && <p className="mt-0.5 truncate text-xs text-ink-400">{r.products.map(productTitle).join(', ')}</p>}
                </div>
                <QuickActions r={r} />
              </li>
            ))}
          </ul>
          )}
          {rows.length > limit && (
            <div className="border-t border-ink/5 p-4 text-center">
              <Button variant="soft" size="sm" onClick={() => setLimit((l) => l + PAGE_SIZE)}>Show more ({rows.length - limit} left)</Button>
            </div>
          )}
        </Card>
        </>
      )}

      <Modal open={saving} onClose={() => setSaving(false)} title="Save segment">
        <form onSubmit={(e) => { e.preventDefault(); saveSegment() }} className="space-y-4">
          <Input label="Segment name" value={segName} maxLength={60} placeholder="e.g. Buyers who spent ₹999+" autoFocus onChange={(e) => setSegName(e.target.value)} />
          <p className="text-xs text-ink-500">Saves the current filters. The list updates automatically as new contacts arrive.</p>
          <div className="flex justify-end">
            <Button type="submit" disabled={!segName.trim()}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
