import { useCallback, useEffect, useState } from 'react'
import { Ban, ExternalLink, Globe, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Badge, Button, Card, Empty, Input, Spinner, Tabs, useToast, askConfirm } from '../../components/ui'
import { DataTable, useViewMode, ViewToggle } from '../../components/DataTable'
import { PageHeading } from '../dashboard/DashboardLayout'

const DOMAIN_TABS = [
  ['verified', 'To activate'],
  ['active', 'Active'],
  ['pending', 'Pending DNS'],
]
const DOMAIN_TONE = { verified: 'lime', active: 'green', pending: 'neutral' }

function CustomDomains() {
  const toast = useToast()
  const [tab, setTab] = useState('verified')
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(null)
  const [view, setView] = useViewMode('admin-domains')

  const load = useCallback(async () => {
    setRows(null)
    const { data } = await supabase
      .from('pages')
      .select('id, username, custom_domain, domain_status, domain_verified_at, updated_at, profiles(email)')
      .eq('domain_status', tab)
      .not('custom_domain', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(200)
    setRows(data || [])
  }, [tab])

  useEffect(() => {
    load()
  }, [load])

  async function setStatus(p, next) {
    if (next === 'active' && p.domain_status === 'pending' && !(await askConfirm({ title: 'Activate this domain?', message: `${p.custom_domain} hasn’t passed DNS verification.`, confirmLabel: 'Activate anyway' }))) return
    setBusy(p.id)
    const { error } = await supabase.from('pages').update({ domain_status: next }).eq('id', p.id)
    setBusy(null)
    if (error) return toast(error.message, 'error')
    setRows((r) => r.filter((x) => x.id !== p.id))
    toast(next === 'active' ? `${p.custom_domain} is live` : `${p.custom_domain} deactivated`)
  }

  return (
    <>
      <PageHeading title="Custom domains." italic="Creator-owned links.">
        Add each verified domain to the Vercel project (Settings → Domains), wait for the certificate, then click Activate. Deactivate sends it back to verified.
      </PageHeading>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs label="Domain status" value={tab} onChange={setTab} tabs={DOMAIN_TABS.map(([key, label]) => ({ key, label }))} />
        <ViewToggle value={view} onChange={setView} />
      </div>
      {rows === null ? (
        <div className="grid h-40 place-items-center"><Spinner /></div>
      ) : rows.length === 0 ? (
        <Empty icon={Globe} title={tab === 'verified' ? 'Nothing to activate' : `No ${tab} domains`} />
      ) : view === 'table' ? (
        <DataTable
          rows={rows}
          minWidth={760}
          columns={[
            { key: 'custom_domain', label: 'Domain', value: (p) => p.custom_domain, className: 'truncate' },
            { key: 'username', label: 'Page', value: (p) => p.username, render: (p) => `/${p.username}` },
            { key: 'email', label: 'Owner', value: (p) => p.profiles?.email, className: 'max-w-56 truncate text-ink-600' },
            { key: 'domain_verified_at', label: 'Verified', value: (p) => p.domain_verified_at, className: 'whitespace-nowrap text-ink-500', render: (p) => (p.domain_verified_at ? new Date(p.domain_verified_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—') },
            { key: 'actions', label: '', align: 'right', render: (p) => (p.domain_status === 'active'
              ? <Button variant="dangerSoft" size="sm" loading={busy === p.id} onClick={() => setStatus(p, 'verified')}>Deactivate</Button>
              : <Button variant={p.domain_status === 'verified' ? 'primary' : 'soft'} size="sm" loading={busy === p.id} onClick={() => setStatus(p, 'active')}>Activate</Button>) },
          ]}
        />
      ) : (
        <Card className="divide-y divide-ink/5">
          {rows.map((p) => (
            <div key={p.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <Globe className="hidden size-4 shrink-0 text-ink-400 sm:block" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{p.custom_domain}</p>
                  <Badge tone={DOMAIN_TONE[p.domain_status]}>{p.domain_status}</Badge>
                </div>
                <p className="truncate text-sm text-ink-500">
                  <a href={`/${p.username}`} target="_blank" rel="noreferrer" className="font-medium text-ink hover:underline">/{p.username}</a>
                  {p.profiles?.email && <> · {p.profiles.email}</>}
                  {p.domain_verified_at && <> · verified {new Date(p.domain_verified_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</>}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {p.domain_status === 'active' && (
                  <Button variant="outline" size="sm" href={`https://${p.custom_domain}`} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Open</Button>
                )}
                {p.domain_status === 'active' ? (
                  <Button variant="dangerSoft" size="sm" loading={busy === p.id} onClick={() => setStatus(p, 'verified')}>Deactivate</Button>
                ) : (
                  <Button variant={p.domain_status === 'verified' ? 'primary' : 'soft'} size="sm" loading={busy === p.id} onClick={() => setStatus(p, 'active')}>Activate</Button>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  )
}

export default function AdminDomains() {
  const [rows, setRows] = useState(null)
  const [domain, setDomain] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [view, setView] = useViewMode('admin-blocked')
  const toast = useToast()

  const load = useCallback(async () => {
    const { data } = await supabase.from('blocked_domains').select('*').order('created_at', { ascending: false })
    setRows(data || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function add(e) {
    e.preventDefault()
    const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    if (!d.includes('.')) return toast('Enter a domain like example.com', 'error')
    setBusy(true)
    const { data, error } = await supabase.rpc('admin_block_domain', { p_domain: d, p_reason: reason || null })
    setBusy(false)
    if (error) return toast(error.message, 'error')
    toast(`Blocked ${d}${data ? ` · ${data} existing block${data > 1 ? 's' : ''} disabled` : ''}`)
    setDomain('')
    setReason('')
    load()
  }

  async function remove(d) {
    const { error } = await supabase.from('blocked_domains').delete().eq('domain', d)
    if (error) return toast(error.message, 'error')
    setRows((r) => r.filter((x) => x.domain !== d))
    toast(`Unblocked ${d}`)
  }

  return (
    <div className="space-y-4">
      <CustomDomains />
      <div className="pt-6" />
      <PageHeading title="Blocked links." italic="Phishing stops here.">
        Creators can’t add links to these domains (subdomains included). Adding a domain also disables existing blocks that point to it.
      </PageHeading>
      <Card className="p-5 sm:p-7">
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Input label="Domain" placeholder="bad-site.com" value={domain} onChange={(e) => setDomain(e.target.value)} required />
          <Input label="Reason (optional)" placeholder="Phishing" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button type="submit" loading={busy} className="h-12">Block domain</Button>
        </form>
      </Card>
      <ViewToggle value={view} onChange={setView} />
      {rows === null ? (
        <div className="grid h-40 place-items-center"><Spinner /></div>
      ) : rows.length === 0 ? (
        <Empty icon={Ban} title="No blocked domains yet" />
      ) : view === 'table' ? (
        <DataTable
          rows={rows}
          rowKey={(r) => r.domain}
          minWidth={560}
          columns={[
            { key: 'domain', label: 'Domain', value: (r) => r.domain, className: 'truncate' },
            { key: 'reason', label: 'Reason', value: (r) => r.reason, className: 'max-w-56 truncate text-ink-600', render: (r) => r.reason || '—' },
            { key: 'created_at', label: 'Added', value: (r) => r.created_at, className: 'whitespace-nowrap text-ink-500', render: (r) => new Date(r.created_at).toLocaleDateString('en-IN') },
            { key: 'actions', label: '', align: 'right', render: (r) => <button type="button" onClick={() => remove(r.domain)} className="ml-auto grid size-8 place-items-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label={`Unblock ${r.domain}`}><Trash2 className="size-4" /></button> },
          ]}
        />
      ) : (
        <Card className="divide-y divide-ink/5">
          {rows.map((r) => (
            <div key={r.domain} className="flex items-center gap-3 px-5 py-3.5">
              <Ban className="size-4 text-red-500" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.domain}</span>
                {r.reason && <span className="block truncate text-xs text-ink-500">{r.reason}</span>}
              </span>
              <span className="hidden text-xs text-ink-400 sm:block">{new Date(r.created_at).toLocaleDateString('en-IN')}</span>
              <button type="button" onClick={() => remove(r.domain)} className="grid size-9 place-items-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label={`Unblock ${r.domain}`}>
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
