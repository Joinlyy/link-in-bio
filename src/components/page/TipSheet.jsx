import { useEffect, useState } from 'react'
import { checkoutTip, fetchPaymentMode } from '../../lib/publicApi'
import { formatInr } from '../../lib/images'
import Sheet from './Sheet'

export default function TipSheet({ block, ctx, onClose }) {
  const amounts = (block.data.amounts?.length ? block.data.amounts : [49, 99, 199]).map(Number).filter(Boolean)
  const [amount, setAmount] = useState(amounts[1] || amounts[0])
  const [form, setForm] = useState({ name: '', email: '', note: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState(null)
  useEffect(() => {
    fetchPaymentMode(ctx.pageId).then(setMode).catch(() => setMode(null))
  }, [ctx.pageId])

  async function pay(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { token } = await checkoutTip({ p_page_id: ctx.pageId, p_amount: Number(amount), p_name: form.name, p_email: form.email, p_note: form.note })
      window.location.assign(`/order/${token}`)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Sheet title={`Tip ${ctx.displayName || ''}`.trim()} onClose={onClose}>
      <form onSubmit={pay} className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {amounts.map((a) => (
            <button key={a} type="button" onClick={() => setAmount(a)} className={`h-12 rounded-2xl text-[15px] font-bold transition ${Number(amount) === a ? 'bg-ink text-white' : 'bg-cream hover:bg-cream-300'}`}>
              {formatInr(a)}
            </button>
          ))}
        </div>
        <input className="field" type="number" min={10} max={100000} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Custom amount" />
        <input className="field" placeholder="Your name" value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="field" type="email" required placeholder="Email for your receipt" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <textarea className="field" rows={2} maxLength={500} placeholder="Say something nice (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        {mode === 'upi' && <p className="text-xs text-ink-500">You’ll pay {ctx.displayName || 'the creator'} directly with any UPI app.</p>}
        {mode === 'off' && <p className="text-xs font-medium text-ink-600">Tips aren’t open yet. Please check back soon.</p>}
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy || mode === 'off'} className="h-12 w-full rounded-full bg-ink text-sm font-semibold text-white disabled:opacity-60">
          {busy ? 'Processing…' : `${mode === 'upi' ? 'Continue to pay' : 'Pay'} ${formatInr(amount)}`}
        </button>
        {mode === 'test' && <p className="text-center text-xs text-ink-500">Test mode: no real money is charged.</p>}
      </form>
    </Sheet>
  )
}
