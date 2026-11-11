import { useCallback, useEffect, useState } from 'react'
import { Download, Mail, Plus, Search, Trash2, Users, X } from 'lucide-react'
import { usePage } from '../../context/PageContext'
import { supabase } from '../../lib/supabase'
import { Button, Card, Empty, Spinner, Tabs, useToast, askConfirm, askText } from '../../components/ui'
import { WhatsappIcon } from '../../components/icons'
import { whatsappUrl } from '../../lib/embeds'
import { DataTable, useViewMode, ViewToggle } from '../../components/DataTable'
import { PageHeading } from './DashboardLayout'

const PAGE_SIZE = 50

function toCsv(rows) {
  const cols = ['created_at', 'name', 'email', 'phone', 'tags', 'consent_text']
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}

export default function Leads() {
  const { page } = usePage()
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [count, setCount] = useState(0)
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [tag, setTag] = useState('')
  const [allTags, setAllTags] = useState([])
  const [view, setView] = useViewMode('leads', 'auto')

  const load = useCallback(async () => {
    let query = supabase.from('leads').select('*', { count: 'exact' }).eq('page_id', page.id).order('created_at', { ascending: false }).range(0, limit - 1)
    const term = q.trim().replace(/[%,()]/g, '')
    if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
    if (tag) query = query.contains('tags', [tag])
    const { data, count: c } = await query
    setRows(data || [])
    setCount(c || 0)
  }, [page.id, q, limit, tag])

  useEffect(() => {
    supabase.from('leads').select('tags').eq('page_id', page.id).not('tags', 'eq', '{}').limit(2000).then(({ data }) => {
      setAllTags([...new Set((data || []).flatMap((r) => r.tags))].sort())
    })
  }, [page.id, rows])

  async function setTags(row, tags) {
    const clean = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 10)
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, tags: clean } : x)))
    const { error } = await supabase.from('leads').update({ tags: clean }).eq('id', row.id)
    if (error) toast(error.message, 'error')
  }

  function Tags({ row }) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {(row.tags || []).map((t) => (
          <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-lilac-100 py-0.5 pr-1 pl-2 text-[11px] font-semibold">
            {t}
            <button type="button" onClick={() => setTags(row, row.tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X className="size-3" /></button>
          </span>
        ))}
        <button
          type="button"
          onClick={async () => {
            const v = await askText({ title: 'Add a tag', placeholder: 'e.g. buyer, webinar-oct', confirmLabel: 'Add' })
            if (v) setTags(row, [...(row.tags || []), v])
          }}
          className="grid size-5 place-items-center rounded-full bg-cream text-ink-500 hover:bg-cream-300"
          aria-label="Add tag"
        >
          <Plus className="size-3" />
        </button>
      </div>
    )
  }

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  async function exportAll() {
    const { data } = await supabase.from('leads').select('*').eq('page_id', page.id).order('created_at', { ascending: false }).limit(10000)
    const url = URL.createObjectURL(new Blob([toCsv(data || [])], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${page.username}-leads.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function remove(id) {
    if (!(await askConfirm({ title: 'Delete this lead permanently?', confirmLabel: 'Delete' }))) return
    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) return toast(error.message, 'error')
    setRows((r) => r.filter((x) => x.id !== id))
    setCount((c) => c - 1)
    toast('Lead deleted')
  }

  return (
    <div className="space-y-4">
      <PageHeading
        title="Leads."
        italic={`${count} and counting.`}
        actions={
          <Button variant="outline" size="sm" onClick={exportAll} disabled={!count}>
            <Download className="size-4" /> Export CSV
          </Button>
        }
      >
        People who joined through a Lead form block, with the consent they gave. Only you can see this list.
      </PageHeading>

      <Card className="p-3">
        <label className="flex items-center gap-2 rounded-full bg-cream px-4">
          <Search className="size-4 text-ink-400" />
          <input className="h-11 flex-1 bg-transparent text-sm outline-none" placeholder="Search name, email or number" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {allTags.length > 0 && (
          <div className="mt-2"><Tabs label="Tag" value={tag} onChange={setTag} tabs={['', ...allTags].map((t) => ({ key: t, label: t || 'All' }))} /></div>
        )}
      </Card>

      {rows === null ? (
        <div className="grid h-60 place-items-center"><Spinner /></div>
      ) : rows.length === 0 ? (
        <Empty icon={Users} title={q ? 'No matches' : 'No leads yet'}>
          {q ? 'Try a different search.' : 'Add a Lead form block to your page to start collecting emails and WhatsApp numbers.'}
        </Empty>
      ) : (
        <>
        <ViewToggle value={view} onChange={setView} />
        <Card className="overflow-hidden">
          {view === 'table' ? (
            <DataTable
              bare
              rows={rows}
              defaultSort={{ key: 'created_at', dir: -1 }}
              columns={[
                { key: 'name', label: 'Name', value: (r) => r.name, render: (r) => r.name || '—' },
                { key: 'email', label: 'Email', value: (r) => r.email, render: (r) => (r.email ? <a href={`mailto:${r.email}`} className="hover:underline">{r.email}</a> : '—') },
                { key: 'phone', label: 'WhatsApp', value: (r) => r.phone, render: (r) => (r.phone ? <a href={whatsappUrl(r.phone)} target="_blank" rel="noreferrer" className="whitespace-nowrap hover:underline">+{r.phone.replace(/^\+/, '')}</a> : '—') },
                { key: 'tags', label: 'Tags', value: (r) => (r.tags || []).join(' '), render: (r) => <Tags row={r} /> },
                { key: 'created_at', label: 'Joined', value: (r) => r.created_at, className: 'whitespace-nowrap text-ink-500', render: (r) => new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) },
                { key: 'actions', label: '', align: 'right', render: (r) => (
                  <button type="button" onClick={() => remove(r.id)} className="ml-auto grid size-8 place-items-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete lead">
                    <Trash2 className="size-4" />
                  </button>
                ) },
              ]}
            />
          ) : (
          <ul className="divide-y divide-ink/5">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.name || r.email || r.phone}</p>
                  <p className="truncate text-sm text-ink-500">{[r.email, r.phone && `+${r.phone.replace(/^\+/, '')}`].filter(Boolean).join(' · ')}</p>
                  <p className="mt-0.5 text-xs text-ink-400">{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  <div className="mt-1.5"><Tags row={r} /></div>
                </div>
                {r.email && <a href={`mailto:${r.email}`} className="grid size-9 place-items-center rounded-full bg-cream" aria-label="Email"><Mail className="size-4" /></a>}
                {r.phone && <a href={whatsappUrl(r.phone)} target="_blank" rel="noreferrer" className="grid size-9 place-items-center rounded-full bg-cream" aria-label="WhatsApp"><WhatsappIcon size={16} /></a>}
                <button type="button" onClick={() => remove(r.id)} className="grid size-9 place-items-center rounded-full bg-cream text-ink-500" aria-label="Delete"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
          )}
          {rows.length < count && (
            <div className="border-t border-ink/5 p-4 text-center">
              <Button variant="soft" size="sm" onClick={() => setLimit((l) => l + PAGE_SIZE)}>Load more</Button>
            </div>
          )}
        </Card>
        </>
      )}
    </div>
  )
}
