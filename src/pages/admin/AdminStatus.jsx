import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { errorMessage, supabase } from '../../lib/supabase'
import { SUPABASE_KEY, SUPABASE_URL } from '../../lib/config'
import { Alert, Badge, Button, Card, Spinner } from '../../components/ui'
import { PageHeading } from '../dashboard/DashboardLayout'

const FUNCTIONS = ['account', 'check-url', 'domains', 'download', 'instagram', 'instagram-data', 'instagram-webhook', 'support', 'whatsapp']
const ago = (d) => {
  if (!d) return 'never'
  const m = Math.round((Date.now() - new Date(d)) / 60000)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`
}
const Dot = ({ ok }) => <span className={`inline-block size-2.5 rounded-full ${ok === null ? 'bg-ink/20' : ok ? 'bg-teal' : 'bg-rose'}`} />

/** Are the services we depend on working? */
export default function AdminStatus() {
  const [s, setS] = useState(null)
  const [fns, setFns] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    const { data, error: err } = await supabase.rpc('admin_system_status')
    if (err) setError(errorMessage(err))
    else setS(data)
    // A function that answers, even with a refusal, is up; a network error or 5xx means it is down
    const results = await Promise.all(FUNCTIONS.map(async (f) => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${f}`, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: '{}' })
        return [f, res.status < 500]
      } catch {
        return [f, false]
      }
    }))
    setFns(Object.fromEntries(results))
    setBusy(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  if (error) return <Alert>{error}</Alert>
  if (!s) return <div className="grid h-60 place-items-center"><Spinner /></div>
  const wa = s.whatsapp_24h
  const ig = s.instagram

  return (
    <div className="space-y-4">
      <PageHeading title="Status." italic="Is everything up?" actions={<Button variant="outline" size="sm" onClick={load} loading={busy}><RefreshCw className="size-4" /> Refresh</Button>} />

      {s.tickets_not_alerted > 0 && (
        <Alert>{s.tickets_not_alerted} recent support request{s.tickets_not_alerted > 1 ? 's' : ''} could not alert you. Check the alert contacts in Buyer support and the email or WhatsApp setup.</Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <p className="eyebrow text-ink-500">Backend functions</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {FUNCTIONS.map((f) => <li key={f} className="flex items-center gap-2"><Dot ok={f in fns ? fns[f] : null} /> {f}</li>)}
          </ul>
        </Card>
        <Card className="p-5 sm:p-6">
          <p className="eyebrow text-ink-500">Last 24 hours</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt>Background calls failed</dt><dd><b>{s.http_24h.failed}</b> of {s.http_24h.total}</dd></div>
            <div className="flex justify-between"><dt>WhatsApp sent / failed / skipped</dt><dd><b>{wa.sent}</b> / {wa.failed} / {wa.skipped}</dd></div>
            <div className="flex justify-between"><dt>Instagram DMs failed</dt><dd><b>{ig.dm_failed_24h}</b></dd></div>
            <div className="flex justify-between"><dt>Last Instagram event</dt><dd>{ago(ig.last_event)}</dd></div>
            <div className="flex justify-between"><dt>Instagram accounts connected</dt><dd>{ig.accounts}</dd></div>
          </dl>
          {(wa.last_error || ig.last_error) && (
            <p className="mt-3 rounded-2xl bg-cream p-3 text-xs text-ink-600">
              {wa.last_error && <>WhatsApp: {wa.last_error}<br /></>}
              {ig.last_error && <>Instagram: {ig.last_error}</>}
            </p>
          )}
        </Card>
      </div>

      {s.razorpay && (
        <Card className="p-5 sm:p-6">
          <p className="eyebrow text-ink-500">Razorpay</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt>Last webhook received</dt><dd>{ago(s.razorpay.last_event)}</dd></div>
            <div className="flex justify-between"><dt>Failed webhooks (24h)</dt><dd><b>{s.razorpay.failed_24h}</b></dd></div>
            <div className="flex justify-between"><dt>Waiting more than 10 minutes</dt><dd><b>{s.razorpay.unprocessed}</b></dd></div>
            <div className="flex justify-between"><dt>Subscriptions not confirmed after 30 minutes</dt><dd><b>{s.razorpay.stuck_subscriptions}</b></dd></div>
            <div className="flex justify-between"><dt>Open billing issues</dt><dd><b>{s.razorpay.open_issues}</b></dd></div>
          </dl>
          {(s.razorpay.failed_24h > 0 || s.razorpay.unprocessed > 0 || s.razorpay.stuck_subscriptions > 0 || s.razorpay.open_issues > 0) && (
            <p className="mt-3 rounded-2xl bg-cream p-3 text-xs text-ink-600">Something needs a look: open Admin, Razorpay.</p>
          )}
        </Card>
      )}

      <Card className="p-5 sm:p-6">
        <p className="eyebrow text-ink-500">Scheduled jobs</p>
        <ul className="mt-3 divide-y divide-ink/5 text-sm">
          {s.jobs.map((j) => (
            <li key={j.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <Dot ok={j.active && (j.last_status === 'succeeded' || j.last_status === null)} />
              <span className="font-medium">{j.name}</span>
              <code className="text-xs text-ink-500">{j.schedule}</code>
              <span className="ml-auto text-ink-600">
                {j.last_status ? <Badge tone={j.last_status === 'succeeded' ? 'green' : 'red'}>{j.last_status}</Badge> : 'not run yet'} · {ago(j.last_run)}
              </span>
              {j.last_status === 'failed' && j.last_message && <span className="w-full text-xs text-red-700">{j.last_message}</span>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
