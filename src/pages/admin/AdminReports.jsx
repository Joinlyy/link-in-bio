import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Flag } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Badge, Button, Card, Empty, Modal, Spinner, Tabs, useToast } from '../../components/ui'
import { DataTable, useViewMode, ViewToggle } from '../../components/DataTable'
import { PageHeading } from '../dashboard/DashboardLayout'
import { SuspendModal, useModeration } from './AdminCreators'

const REASONS = { scam: 'Scam', phishing: 'Phishing', impersonation: 'Impersonation', adult: 'Adult', hate: 'Hate', spam: 'Spam', other: 'Other' }

export default function AdminReports() {
  const [status, setStatus] = useState('open')
  const [rows, setRows] = useState(null)
  const [suspendFor, setSuspendFor] = useState(null)
  const [view, setView] = useViewMode('admin-reports')
  const [openId, setOpenId] = useState(null)
  const { setHidden } = useModeration()
  const toast = useToast()

  const load = useCallback(async () => {
    setRows(null)
    const { data } = await supabase
      .from('reports')
      .select('*, pages(id, username, display_name, moderation_status, owner_id, profiles(id, email, status))')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(100)
    setRows(data || [])
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  async function resolve(id, next) {
    const { error } = await supabase.from('reports').update({ status: next, resolved_at: new Date().toISOString() }).eq('id', id)
    if (error) return toast(error.message, 'error')
    setRows((r) => r.filter((x) => x.id !== id))
    toast(next === 'resolved' ? 'Marked resolved' : 'Dismissed')
  }

  const opened = (rows || []).find((x) => x.id === openId)
  const card = (r) => {
            const page = r.pages
            const owner = page?.profiles
            return (
              <Card key={r.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="red">{REASONS[r.reason] || r.reason}</Badge>
                      {page && <a href={`/${page.username}`} target="_blank" rel="noreferrer" className="font-semibold hover:underline">/{page.username}</a>}
                      {page?.moderation_status === 'hidden' && <Badge>Hidden</Badge>}
                      {owner?.status === 'suspended' && <Badge>Owner suspended</Badge>}
                    </div>
                    {r.details && <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink-700">{r.details}</p>}
                    <p className="mt-2 text-xs text-ink-400">
                      {new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                      {r.reporter_email && ` · from ${r.reporter_email}`} · owner {owner?.email}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {page && <Button variant="outline" size="sm" href={`/${page.username}`} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /></Button>}
                    {page && page.moderation_status !== 'hidden' && (
                      <Button variant="soft" size="sm" onClick={async () => (await setHidden(page.id, true, `Report: ${r.reason}`)) && load()}>Hide page</Button>
                    )}
                    {owner && owner.status !== 'suspended' && <Button variant="dangerSoft" size="sm" onClick={() => setSuspendFor(owner)}>Suspend owner</Button>}
                    {status === 'open' && (
                      <>
                        <Button size="sm" onClick={() => resolve(r.id, 'resolved')}>Resolve</Button>
                        <Button variant="ghost" size="sm" onClick={() => resolve(r.id, 'dismissed')}>Dismiss</Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeading title="Reports." italic="Keep it safe.">Pages flagged by visitors. Hide the page, suspend the creator, or dismiss.</PageHeading>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs label="Status" value={status} onChange={setStatus} tabs={[['open', 'Open'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed']].map(([key, label]) => ({ key, label }))} />
        <ViewToggle value={view} onChange={setView} />
      </div>
      {rows === null ? (
        <div className="grid h-60 place-items-center"><Spinner /></div>
      ) : rows.length === 0 ? (
        <Empty icon={Flag} title={status === 'open' ? 'All clear' : `No ${status} reports`}>{status === 'open' ? 'No pages are waiting for review.' : null}</Empty>
      ) : (
        <div className="space-y-2.5">
          {view === 'table' ? (
            <DataTable
              rows={rows}
              onRowClick={(r) => setOpenId(r.id)}
              minWidth={820}
              columns={[
                { key: 'reason', label: 'Reason', value: (r) => REASONS[r.reason] || r.reason },
                { key: 'page', label: 'Page', value: (r) => r.pages?.username, render: (r) => (r.pages ? `/${r.pages.username}` : '—') },
                { key: 'details', label: 'Details', value: (r) => r.details, className: 'max-w-72 truncate text-ink-600', render: (r) => r.details || '—' },
                { key: 'owner', label: 'Owner', value: (r) => r.pages?.profiles?.email, className: 'max-w-56 truncate text-ink-600' },
                { key: 'created_at', label: 'Date', value: (r) => r.created_at, className: 'whitespace-nowrap text-ink-500', render: (r) => new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
              ]}
            />
          ) : rows.map((r) => card(r))}
        </div>
      )}
      <Modal open={Boolean(opened)} onClose={() => setOpenId(null)} title="Report" wide>{opened && card(opened)}</Modal>
      <SuspendModal creator={suspendFor} onClose={() => setSuspendFor(null)} onDone={() => { setSuspendFor(null); load() }} />
    </div>
  )
}
