import { useEffect, useState } from 'react'
import { ScrollText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Button, Card, Empty, Spinner } from '../../components/ui'
import { DataTable, useViewMode, ViewToggle } from '../../components/DataTable'
import { PageHeading } from '../dashboard/DashboardLayout'

const LABELS = {
  status_suspended: 'Suspended creator',
  status_active: 'Reactivated creator',
  role_change: 'Changed role',
  page_hidden: 'Hid page',
  page_ok: 'Restored page',
  report_resolved: 'Resolved report',
  report_dismissed: 'Dismissed report',
  report_open: 'Reopened report',
  domain_blocked: 'Blocked domain',
  domain_unblocked: 'Unblocked domain',
}

function describe(row) {
  const d = row.details || {}
  return d.email || d.username || (row.target_table === 'blocked_domains' ? row.target_id : d.reason) || row.target_id
}

export default function AdminAudit() {
  const [rows, setRows] = useState(null)
  const [actors, setActors] = useState({})
  const [limit, setLimit] = useState(50)
  const [view, setView] = useViewMode('admin-audit')

  useEffect(() => {
    supabase
      .from('admin_audit')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(async ({ data }) => {
        setRows(data || [])
        const ids = [...new Set((data || []).map((r) => r.actor_id).filter(Boolean))]
        if (ids.length) {
          const { data: people } = await supabase.from('profiles').select('id, email, full_name').in('id', ids)
          setActors(Object.fromEntries((people || []).map((p) => [p.id, p.full_name || p.email])))
        }
      })
  }, [limit])

  return (
    <div className="space-y-4">
      <PageHeading title="Audit log." italic="Who did what.">Every moderation action by an admin is recorded here and can’t be edited.</PageHeading>
      <ViewToggle value={view} onChange={setView} />
      {rows === null ? (
        <div className="grid h-60 place-items-center"><Spinner /></div>
      ) : rows.length === 0 ? (
        <Empty icon={ScrollText} title="Nothing logged yet" />
      ) : (
        <Card className="divide-y divide-ink/5">
          {view === 'table' ? (
            <DataTable
              bare
              rows={rows}
              minWidth={720}
              defaultSort={{ key: 'created_at', dir: -1 }}
              columns={[
                { key: 'actor', label: 'Who', value: (r) => actors[r.actor_id] || (r.actor_id ? 'Admin' : 'System / SQL'), className: 'truncate' },
                { key: 'action', label: 'Action', value: (r) => LABELS[r.action] || r.action },
                { key: 'target', label: 'On', value: describe, className: 'max-w-64 truncate text-ink-600' },
                { key: 'created_at', label: 'When', value: (r) => r.created_at, className: 'whitespace-nowrap text-ink-500', render: (r) => new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) },
              ]}
            />
          ) : rows.map((r) => (
            <div key={r.id} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4">
              <span className="w-40 shrink-0 text-xs text-ink-400">
                {new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <b>{actors[r.actor_id] || (r.actor_id ? 'Admin' : 'System / SQL')}</b> · {LABELS[r.action] || r.action} ·{' '}
                <span className="text-ink-600">{describe(r)}</span>
                {r.details?.reason && r.target_table === 'profiles' && <span className="text-ink-400"> — {r.details.reason}</span>}
              </span>
            </div>
          ))}
          {rows.length >= limit && (
            <div className="p-4 text-center"><Button variant="soft" size="sm" onClick={() => setLimit((l) => l + 50)}>Load more</Button></div>
          )}
        </Card>
      )}
    </div>
  )
}
