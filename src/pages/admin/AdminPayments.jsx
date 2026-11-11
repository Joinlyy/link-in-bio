import { useCallback, useEffect, useState } from 'react'
import { IndianRupee } from 'lucide-react'
import { errorMessage, supabase } from '../../lib/supabase'
import { formatInr } from '../../lib/images'
import { Badge, Button, Card, Empty, Input, Spinner, Tabs, useToast, askText } from '../../components/ui'
import { PageHeading } from '../dashboard/DashboardLayout'

const UPI_RE = /^[a-zA-Z0-9._-]{2,255}@[a-zA-Z0-9]{2,64}$/
const STATUS_TONE = { pending: 'lilac', approved: 'green', rejected: 'red' }

/** Where creators pay for plans */
function PlatformUpi() {
  const toast = useToast()
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    supabase.from('app_settings').select('platform_upi_id, platform_upi_name').maybeSingle()
      .then(({ data }) => setForm({ upi: data?.platform_upi_id || '', name: data?.platform_upi_name || '' }))
  }, [])
  if (!form) return <Card className="grid h-40 place-items-center"><Spinner /></Card>
  const wrong = form.upi.trim() && !UPI_RE.test(form.upi.trim())

  async function save() {
    setBusy(true)
    const { error } = await supabase.rpc('admin_set_platform_upi', { p_upi_id: form.upi.trim(), p_upi_name: form.name.trim() })
    setBusy(false)
    if (error) return toast(errorMessage(error), 'error')
    toast(form.upi.trim() ? 'Creators can now pay for plans by UPI' : 'Plan payments turned off')
  }

  return (
    <Card className="p-5 sm:p-7">
      <h2 className="text-lg font-bold">Your UPI ID for plan payments</h2>
      <p className="mt-1 text-sm text-ink-500">Creators pay this UPI ID when they upgrade, then send the reference. Approve each one below after you see the money in your bank app. Leave it empty to stop plan payments.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Input label="UPI ID" placeholder="business@okhdfcbank" value={form.upi} error={wrong ? 'A UPI ID looks like name@bank' : undefined} onChange={(e) => setForm({ ...form, upi: e.target.value })} />
        <Input label="Name shown when paying" maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <Button className="mt-4" loading={busy} disabled={wrong} onClick={save}>Save</Button>
    </Card>
  )
}

export default function AdminPayments() {
  const toast = useToast()
  const [status, setStatus] = useState('pending')
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    setRows(null)
    const { data, error } = await supabase.from('plan_payments').select('*, profiles!plan_payments_user_id_fkey(email, full_name)').eq('status', status).order('created_at', { ascending: false }).limit(100)
    if (error) toast(errorMessage(error), 'error')
    setRows(data || [])
  }, [status, toast])
  useEffect(() => {
    load()
  }, [load])

  async function review(p, approve) {
    const note = approve ? null : await askText({ title: 'Payment not received?', message: `${formatInr(p.amount_inr)}, reference ${p.utr}. The creator sees this reason.`, label: 'Reason', defaultValue: 'Payment not found in our bank account', confirmLabel: 'Reject', danger: true })
    if (!approve && note === null) return
    setBusy(p.id)
    const { error } = await supabase.rpc('admin_review_plan_payment', { p_id: p.id, p_approve: approve, p_note: note })
    setBusy(null)
    if (error) return toast(errorMessage(error), 'error')
    toast(approve ? 'Approved. Their plan is on.' : 'Rejected')
    load()
  }

  return (
    <div className="space-y-4">
      <PageHeading title="Plan payments." italic="Paid by UPI.">Check each reference in your bank app before approving. Approving switches the creator’s plan on straight away.</PageHeading>
      <PlatformUpi />
      <Tabs label="Status" value={status} onChange={setStatus} tabs={[['pending', 'To check'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([key, label]) => ({ key, label }))} />
      {rows === null ? (
        <div className="grid h-40 place-items-center"><Spinner /></div>
      ) : rows.length === 0 ? (
        <Empty icon={IndianRupee} title={status === 'pending' ? 'Nothing to check' : `No ${status} payments`} />
      ) : (
        <Card className="divide-y divide-ink/5">
          {rows.map((p) => (
            <div key={p.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{formatInr(p.amount_inr)} · {p.plan} · {p.period === 'year' ? '1 year' : '1 month'}</p>
                  <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                </div>
                <p className="truncate text-sm text-ink-500">{p.profiles?.full_name ? `${p.profiles.full_name} · ` : ''}{p.profiles?.email}</p>
                <p className="text-sm">Reference <b className="tracking-wider">{p.utr}</b> · {new Date(p.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
                {p.note && <p className="text-xs text-ink-500">{p.note}</p>}
              </div>
              {p.status === 'pending' && (
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" loading={busy === p.id} onClick={() => review(p, true)}>Money received</Button>
                  <Button size="sm" variant="ghost" disabled={busy === p.id} onClick={() => review(p, false)}>Not received</Button>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
