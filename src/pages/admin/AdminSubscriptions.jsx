import { useEffect, useState } from 'react'
import { Crown } from 'lucide-react'
import { errorMessage, supabase } from '../../lib/supabase'
import { formatInr } from '../../lib/images'
import { Alert, Badge, Card, Empty, Spinner, Tabs } from '../../components/ui'
import { DataTable } from '../../components/DataTable'
import { PageHeading } from '../dashboard/DashboardLayout'

const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No end date')
const daysLeft = (d) => (d ? Math.ceil((new Date(d) - Date.now()) / 86400000) : null)

/** Who pays, for which plan, until when, and what failed. Real payment history starts with Razorpay. */
export default function AdminSubscriptions() {
  const [rows, setRows] = useState(null)
  const [plans, setPlans] = useState([])
  const [error, setError] = useState('')
  const [tab, setTab] = useState('active')

  useEffect(() => {
    supabase.rpc('admin_subscriptions').then(({ data, error: err }) => (err ? setError(errorMessage(err)) : setRows(data || [])))
    supabase.from('plans').select('id, name').then(({ data }) => setPlans(data || []))
  }, [])

  if (error) return <Alert>{error}</Alert>
  if (!rows) return <div className="grid h-60 place-items-center"><Spinner /></div>

  const name = (id) => plans.find((p) => p.id === id)?.name || id
  const soon = (r) => r.active && daysLeft(r.plan_expires_at) !== null && daysLeft(r.plan_expires_at) <= 7
  const filtered = rows.filter((r) => (tab === 'active' ? r.active : tab === 'expiring' ? soon(r) : tab === 'lapsed' ? !r.active : tab === 'failed' ? r.failed > 0 : true))
  const count = (fn) => rows.filter(fn).length

  return (
    <div className="space-y-4">
      <PageHeading title="Subscriptions." italic={`${count((r) => r.active)} paying.`}>Plans are paid by UPI and approved in Plan payments. Card and auto-renew billing arrive with Razorpay.</PageHeading>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[['Paying now', count((r) => r.active)], ['Ending in 7 days', count(soon)], ['Lapsed', count((r) => !r.active)], ['With failed payments', count((r) => r.failed > 0)]].map(([k, v]) => (
          <Card key={k} className="p-5"><p className="text-xs font-semibold text-ink-500">{k}</p><p className="mt-2 font-display text-3xl font-bold">{v}</p></Card>
        ))}
      </div>
      <Tabs label="Filter" value={tab} onChange={setTab} tabs={[['active', 'Paying'], ['expiring', 'Ending soon'], ['lapsed', 'Lapsed'], ['failed', 'Failed payments'], ['all', 'All']].map(([key, label]) => ({ key, label }))} />
      {filtered.length === 0 ? <Empty icon={Crown} title="Nobody here" /> : (
        <Card className="divide-y divide-ink/5">
          <DataTable
            bare
            rows={filtered}
            minWidth={900}
            columns={[
              { key: 'who', label: 'Creator', value: (r) => r.email, className: 'max-w-56 truncate', render: (r) => <span>{r.full_name || r.email}<span className="block text-xs text-ink-500">{r.email}</span></span> },
              { key: 'plan', label: 'Plan', value: (r) => r.plan, render: (r) => name(r.plan) },
              { key: 'status', label: 'Status', value: (r) => (r.active ? 1 : 0), render: (r) => (r.active ? <Badge tone="green">Active</Badge> : r.plan === 'free' ? <Badge>Free</Badge> : <Badge tone="red">Expired</Badge>) },
              { key: 'renews', label: 'Renews / ends', value: (r) => r.plan_expires_at || '', className: 'whitespace-nowrap', render: (r) => (r.plan === 'free' ? '—' : `${day(r.plan_expires_at)}${daysLeft(r.plan_expires_at) !== null ? ` (${daysLeft(r.plan_expires_at)}d)` : ''}`) },
              { key: 'auto', label: 'Auto-renew', value: (r) => (r.rzp_status ? (r.rzp_auto_renew ? 1 : 0) : -1), render: (r) => (r.rzp_status ? (r.rzp_auto_renew ? <Badge tone="green">On</Badge> : <Badge>Off ({r.rzp_status})</Badge>) : '—') },
              { key: 'source', label: 'Source', value: (r) => r.last_source || '', className: 'capitalize text-ink-600', render: (r) => (r.last_source === 'admin' ? 'Admin grant' : r.last_source || '—') },
              { key: 'paid', label: 'Paid so far', align: 'right', value: (r) => r.paid_total, className: 'font-semibold', render: (r) => formatInr(r.paid_total) },
              { key: 'issues', label: 'Failed / pending / overrides', value: (r) => r.failed, className: 'text-ink-600', render: (r) => `${r.failed + (r.rzp_failed || 0)} / ${r.pending} / ${r.overrides}` },
            ]}
          />
        </Card>
      )}
    </div>
  )
}
