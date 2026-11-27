import { CharCount } from './CharCount'
import { useCallback, useEffect, useState } from 'react'
import { createSupportTicket, fetchSupportTickets } from '../lib/publicApi'

const CATEGORIES = [
  { value: 'payment_failed', label: 'My payment failed or is stuck' },
  { value: 'not_received', label: 'I didn’t receive what I paid for' },
  { value: 'refund', label: 'I want a refund' },
  { value: 'creator_issue', label: 'Problem with the creator' },
  { value: 'other', label: 'Something else' },
]
const STATUS = { open: 'Received', in_progress: 'We are looking into it', resolved: 'Resolved' }
const DATE = { day: 'numeric', month: 'short' }

/** Support on every order, whatever its status. Requests go to the platform team, not the creator. */
export default function SupportRequest({ token }) {
  const [tickets, setTickets] = useState([])
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const load = useCallback(() => fetchSupportTickets(token).then((t) => setTickets(Array.isArray(t) ? t : [])).catch(() => {}), [token])
  useEffect(() => {
    load()
  }, [load])

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await createSupportTicket(token, category, message.trim())
      setSent(true)
      setOpen(false)
      setCategory('')
      setMessage('')
      load()
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <div className="card p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Need help with this order?</p>
          <p className="text-sm text-ink-500">Our team will look into it and reply here.</p>
        </div>
        {!open && <button type="button" onClick={() => { setOpen(true); setSent(false) }} className="inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white">Contact support</button>}
      </div>

      {sent && <p className="mt-4 rounded-2xl bg-lime-200 p-3 text-sm font-medium">Thanks, we got your request. We will reply on this page.</p>}

      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <select required value={category} onChange={(e) => setCategory(e.target.value)} className="field" aria-label="What is the problem?">
            <option value="" disabled>What is the problem?</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <textarea required minLength={5} maxLength={1500} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className="field" placeholder="Tell us what happened. Include your UPI reference if you paid." aria-label="Message" />
          <CharCount value={message} max={1500} className="block text-right" />
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !category || message.trim().length < 5} className="inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Sending…' : 'Send'}</button>
            <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-full px-4 text-sm font-semibold text-ink-600">Cancel</button>
          </div>
        </form>
      )}

      {tickets.length > 0 && (
        <ul className="mt-5 space-y-3 border-t border-ink/10 pt-4">
          {tickets.map((t) => (
            <li key={t.ticket_no} className="text-sm">
              <p className="flex flex-wrap items-center gap-2 font-semibold">#{t.ticket_no} · {CATEGORIES.find((c) => c.value === t.category)?.label}
                <span className={`rounded-full px-2 py-0.5 text-xs ${t.status === 'resolved' ? 'bg-lime-200' : 'bg-cream'}`}>{STATUS[t.status]}</span>
                <span className="text-xs font-normal text-ink-400">{new Date(t.created_at).toLocaleDateString('en-IN', DATE)}</span>
              </p>
              <p className="mt-1 break-words whitespace-pre-line text-ink-600">{t.message}</p>
              {t.admin_reply && <p className="mt-2 rounded-2xl bg-lilac-100 p-3 break-words whitespace-pre-line"><b>Our reply:</b> {t.admin_reply}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
