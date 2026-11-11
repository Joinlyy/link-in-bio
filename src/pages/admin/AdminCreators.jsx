import { useCallback, useEffect, useState } from 'react'
import { Crown, ExternalLink, Search, Users } from 'lucide-react'
import { errorMessage, supabase } from '../../lib/supabase'
import { Badge, Button, Card, Empty, Input, Modal, Select, Spinner, Tabs, Textarea, useToast } from '../../components/ui'
import { DataTable, useViewMode, ViewToggle } from '../../components/DataTable'
import { PageHeading } from '../dashboard/DashboardLayout'

const PAGE_SIZE = 30

export function useModeration() {
  const toast = useToast()
  return {
    async setSuspended(profileId, suspended, reason) {
      const { error } = await supabase.from('profiles').update({ status: suspended ? 'suspended' : 'active', suspended_reason: suspended ? reason : null }).eq('id', profileId)
      if (error) toast(error.message, 'error')
      else toast(suspended ? 'Creator suspended' : 'Creator reactivated')
      return !error
    },
    async setHidden(pageId, hidden, note) {
      const { error } = await supabase.from('pages').update({ moderation_status: hidden ? 'hidden' : 'ok', moderation_note: hidden ? note : null }).eq('id', pageId)
      if (error) toast(error.message, 'error')
      else toast(hidden ? 'Page hidden from public' : 'Page restored')
      return !error
    },
  }
}

export function SuspendModal({ creator, onClose, onDone }) {
  const { setSuspended } = useModeration()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  if (!creator) return null
  return (
    <Modal open onClose={onClose} title={`Suspend ${creator.email || 'creator'}?`}>
      <p className="text-sm text-ink-600">Their public page goes offline immediately and they can’t use the dashboard.</p>
      <Textarea className="mt-4" label="Reason (shown to the creator)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Links to phishing websites" />
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" loading={busy} onClick={async () => { setBusy(true); if (await setSuspended(creator.id, true, reason)) onDone(); setBusy(false) }}>Suspend</Button>
      </div>
    </Modal>
  )
}

function planActive(r) {
  return r.plan && r.plan !== 'free' && (!r.plan_expires_at || new Date(r.plan_expires_at) > new Date())
}

function PlanModal({ creator, plans, onClose, onDone }) {
  const toast = useToast()
  const defaultExpiry = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  const [plan, setPlan] = useState(creator.plan || 'free')
  const [expires, setExpires] = useState(creator.plan_expires_at ? creator.plan_expires_at.slice(0, 10) : defaultExpiry)
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    const p_expires = plan === 'free' || !expires ? null : new Date(`${expires}T23:59:59+05:30`).toISOString()
    const { error } = await supabase.rpc('admin_set_plan', { p_user: creator.id, p_plan: plan, p_expires })
    setBusy(false)
    if (error) return toast(errorMessage(error), 'error')
    toast(`Plan set to ${plans.find((p) => p.id === plan)?.name || plan}`)
    onDone()
  }
  return (
    <Modal open onClose={onClose} title={`Plan for ${creator.email || 'creator'}`}>
      <div className="space-y-4">
        <Select label="Plan" value={plan} onChange={(e) => setPlan(e.target.value)} options={plans.map((p) => ({ value: p.id, label: `${p.name}${p.is_active ? '' : ' (inactive)'}` }))} />
        {plan !== 'free' && (
          <Input label="Expires on" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} hint="Leave empty for no expiry. Recorded as an admin grant in their billing history." />
        )}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={busy} onClick={save}>Save plan</Button>
      </div>
    </Modal>
  )
}

const pageOf = (r) => (Array.isArray(r.pages) ? r.pages[0] : r.pages)

export default function AdminCreators() {
  const [rows, setRows] = useState(null)
  const [count, setCount] = useState(0)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [suspendFor, setSuspendFor] = useState(null)
  const [planFor, setPlanFor] = useState(null)
  const [plans, setPlans] = useState([])
  const [view, setView] = useViewMode('admin-creators')
  const [openId, setOpenId] = useState(null)
  const { setSuspended, setHidden } = useModeration()

  useEffect(() => {
    supabase.from('plans').select('id, name, is_active').order('position').then(({ data }) => setPlans(data || []))
  }, [])

  const load = useCallback(async () => {
    let query = supabase
      .from('profiles')
      .select('id, email, full_name, role, status, suspended_reason, created_at, plan, plan_expires_at, pages(id, username, display_name, is_published, moderation_status)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(0, limit - 1)
    if (filter === 'suspended') query = query.eq('status', 'suspended')
    if (filter === 'admins') query = query.eq('role', 'admin')
    if (filter === 'paid') query = query.neq('plan', 'free')
    const term = q.trim().replace(/[%,()]/g, '')
    if (term) query = query.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`)
    const { data, count: c } = await query
    setRows(data || [])
    setCount(c || 0)
  }, [q, filter, limit])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const opened = (rows || []).find((r) => r.id === openId)
  const card = (r) => {
    const page = pageOf(r)
    return (
              <Card key={r.id} className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{r.full_name || page?.display_name || 'Unnamed'}</p>
                    {r.role === 'admin' && <Badge tone="dark">Admin</Badge>}
                    {planActive(r) ? (
                      <Badge tone="lime"><Crown className="size-3" /> {plans.find((p) => p.id === r.plan)?.name || r.plan}</Badge>
                    ) : r.plan && r.plan !== 'free' ? (
                      <Badge>{plans.find((p) => p.id === r.plan)?.name || r.plan} · expired</Badge>
                    ) : (
                      <Badge>Free</Badge>
                    )}
                    {r.status === 'suspended' && <Badge tone="red">Suspended</Badge>}
                    {page?.moderation_status === 'hidden' && <Badge tone="red">Page hidden</Badge>}
                    {page && (page.is_published ? <Badge tone="green">Live</Badge> : <Badge>Draft</Badge>)}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-ink-500">
                    {r.email} {page && <>· <a href={`/${page.username}`} target="_blank" rel="noreferrer" className="font-medium text-ink hover:underline">/{page.username}</a></>}
                  </p>
                  <p className="text-xs text-ink-400">Joined {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{r.plan !== 'free' && r.plan_expires_at && ` · plan until ${new Date(r.plan_expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}{r.suspended_reason && ` · ${r.suspended_reason}`}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="soft" size="sm" onClick={() => setPlanFor(r)}><Crown className="size-4" /> Plan</Button>
                  {page && (
                    <Button variant="outline" size="sm" href={`/${page.username}`} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> View</Button>
                  )}
                  {page && (
                    <Button variant="soft" size="sm" onClick={async () => (await setHidden(page.id, page.moderation_status !== 'hidden', 'Hidden by admin')) && load()}>
                      {page.moderation_status === 'hidden' ? 'Unhide page' : 'Hide page'}
                    </Button>
                  )}
                  {r.role !== 'admin' &&
                    (r.status === 'suspended' ? (
                      <Button size="sm" onClick={async () => (await setSuspended(r.id, false)) && load()}>Reactivate</Button>
                    ) : (
                      <Button variant="dangerSoft" size="sm" onClick={() => setSuspendFor(r)}>Suspend</Button>
                    ))}
                </div>
              </Card>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeading title="Creators." italic={`${count} total.`} />
      <Card className="flex flex-col gap-3 p-3 sm:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-full bg-cream px-4">
          <Search className="size-4 text-ink-400" />
          <input className="h-11 flex-1 bg-transparent text-sm outline-none" placeholder="Search by email or name" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <Tabs label="Filter" value={filter} onChange={setFilter} tabs={[['all', 'All'], ['paid', 'Paid'], ['suspended', 'Suspended'], ['admins', 'Admins']].map(([key, label]) => ({ key, label }))} />
      </Card>

      <ViewToggle value={view} onChange={setView} />
      {rows === null ? (
        <div className="grid h-60 place-items-center"><Spinner /></div>
      ) : rows.length === 0 ? (
        <Empty icon={Users} title="No creators found" />
      ) : (
        <div className="space-y-2.5">
          {view === 'table' ? (
            <DataTable
              rows={rows}
              minWidth={860}
              onRowClick={(r) => setOpenId(r.id)}
              columns={[
                { key: 'name', label: 'Name', value: (r) => r.full_name || pageOf(r)?.display_name, className: 'truncate', render: (r) => r.full_name || pageOf(r)?.display_name || 'Unnamed' },
                { key: 'email', label: 'Email', value: (r) => r.email, className: 'max-w-56 truncate text-ink-600' },
                { key: 'page', label: 'Page', value: (r) => pageOf(r)?.username, render: (r) => (pageOf(r) ? `/${pageOf(r).username}` : '—') },
                { key: 'plan', label: 'Plan', value: (r) => r.plan, className: 'capitalize', render: (r) => plans.find((p) => p.id === r.plan)?.name || r.plan },
                { key: 'status', label: 'Status', value: (r) => r.status, render: (r) => (r.status === 'suspended' ? <Badge tone="red">Suspended</Badge> : <Badge tone="green">Active</Badge>) },
                { key: 'created_at', label: 'Joined', value: (r) => r.created_at, className: 'whitespace-nowrap text-ink-500', render: (r) => new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
              ]}
            />
          ) : rows.map((r) => card(r))}
          {rows.length < count && (
            <div className="pt-2 text-center"><Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE_SIZE)}>Load more</Button></div>
          )}
        </div>
      )}
      <Modal open={Boolean(opened)} onClose={() => setOpenId(null)} title="Creator" wide>{opened && card(opened)}</Modal>
      <SuspendModal creator={suspendFor} onClose={() => setSuspendFor(null)} onDone={() => { setSuspendFor(null); load() }} />
      {planFor && <PlanModal key={planFor.id} creator={planFor} plans={plans} onClose={() => setPlanFor(null)} onDone={() => { setPlanFor(null); load() }} />}
    </div>
  )
}
