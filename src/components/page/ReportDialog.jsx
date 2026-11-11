import { useState } from 'react'
import { reportPage } from '../../lib/publicApi'
import Sheet from './Sheet'

const REASONS = [
  ['scam', 'Scam or fraud'],
  ['phishing', 'Phishing or malicious links'],
  ['impersonation', 'Pretending to be someone else'],
  ['adult', 'Adult or sexual content'],
  ['hate', 'Hate or harassment'],
  ['spam', 'Spam'],
  ['other', 'Something else'],
]

export default function ReportDialog({ page, onClose }) {
  const [reason, setReason] = useState('scam')
  const [details, setDetails] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setStatus('loading')
    setError('')
    try {
      await reportPage({ p_page_id: page.id, p_reason: reason, p_details: details, p_email: email })
      setStatus('done')
    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
  }

  return (
    <Sheet title={`Report @${page.username}`} onClose={onClose}>
      {status === 'done' ? (
        <div className="rounded-2xl bg-lilac-100 p-5 text-sm leading-relaxed">
          Thanks — our team will review this page. We may contact you if we need more details.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <fieldset className="grid gap-2">
            {REASONS.map(([value, label]) => (
              <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition ${reason === value ? 'border-ink bg-cream' : 'border-ink/10 hover:bg-cream'}`}>
                <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} className="accent-ink" />
                {label}
              </label>
            ))}
          </fieldset>
          <textarea className="field" rows={3} maxLength={1000} placeholder="Tell us more (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
          <input className="field" type="email" placeholder="Your email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <button type="submit" disabled={status === 'loading'} className="h-12 w-full rounded-full bg-ink text-sm font-semibold text-white disabled:opacity-60">
            {status === 'loading' ? 'Sending…' : 'Submit report'}
          </button>
        </form>
      )}
    </Sheet>
  )
}
