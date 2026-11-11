import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { formatInr } from '../lib/images'

/** A standard UPI payment link: every UPI app opens it with the payee, amount and note filled in */
export function upiLink({ upiId, name, amount, note }) {
  const q = new URLSearchParams({ pa: upiId, pn: name || '', am: String(amount), cu: 'INR', tn: note || '' })
  // Spaces as %20 and a plain @ in the UPI ID, as the UPI link format expects
  return `upi://pay?${q.toString().replace(/\+/g, '%20').replace(/%40/g, '@')}`
}

/**
 * Pay someone's UPI ID directly: QR code, a button that opens a UPI app, and a box for the
 * 12-digit UPI reference the payer copies from their app afterwards.
 */
export default function UpiPay({ upiId, name, amount, note, submittedUtr, onSubmit, submitLabel = 'I’ve paid' }) {
  const [utr, setUtr] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const link = upiLink({ upiId, name, amount, note })

  const copy = (text, what) =>
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(what)
      setTimeout(() => setCopied(''), 1500)
    })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSubmit(utr.replace(/\s/g, ''))
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-cream p-5 text-center">
        <p className="text-sm text-ink-600">Pay <b>{name || upiId}</b></p>
        <p className="mt-1 font-display text-4xl font-bold">{formatInr(amount)}</p>
        <div className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3 shadow-soft">
          <QRCodeSVG value={link} size={168} level="M" />
        </div>
        <p className="mt-3 text-xs text-ink-500">Scan with GPay, PhonePe, Paytm or any UPI app</p>
        <a href={link} className="mt-4 flex h-12 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white">Open my UPI app</a>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
          <button type="button" onClick={() => copy(upiId, 'id')} className="rounded-full bg-white px-3 py-1.5 font-semibold">
            {copied === 'id' ? 'Copied' : `UPI ID: ${upiId}`}
          </button>
          {note && (
            <button type="button" onClick={() => copy(note, 'note')} className="rounded-full bg-white px-3 py-1.5 font-semibold">
              {copied === 'note' ? 'Copied' : `Note: ${note}`}
            </button>
          )}
        </div>
      </div>

      {submittedUtr ? (
        <p className="rounded-2xl bg-lime-200 p-4 text-sm">
          <b>Payment reference sent:</b> {submittedUtr}. You’ll get access as soon as it’s confirmed. Keep this page bookmarked.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <label className="block text-sm font-semibold" htmlFor="upi-utr">After paying, enter the 12-digit UPI reference</label>
          <input
            id="upi-utr"
            className="field tracking-wider"
            inputMode="numeric"
            autoComplete="off"
            required
            placeholder="e.g. 412356789012"
            value={utr}
            onChange={(e) => setUtr(e.target.value.replace(/[^\d\s]/g, '').slice(0, 15))}
          />
          <p className="text-xs text-ink-500">Find it in your UPI app’s payment details, called “UPI Ref No.” or “UTR”.</p>
          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
          <button type="submit" disabled={busy || utr.replace(/\s/g, '').length !== 12} className="flex h-12 w-full items-center justify-center rounded-full bg-lime text-[15px] font-semibold text-ink disabled:opacity-50">
            {busy ? 'Sending…' : submitLabel}
          </button>
        </form>
      )}
    </div>
  )
}
