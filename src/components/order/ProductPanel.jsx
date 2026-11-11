import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { checkCoupon, checkoutOrder, fetchPaymentMode } from '../../lib/publicApi'
import { formatBytes, formatInr, optimizedImage } from '../../lib/images'
import { FONTS } from '../../lib/themes'
import { formatIst } from '../../lib/slots'
import { CalendarIcon, CheckIcon } from '../icons'
import { intervalLabel, SlotPicker, TYPE_LABEL, useCountdown } from './shared'

function SaleCountdown({ endsAt, onEnd }) {
  const c = useCountdown(endsAt, onEnd)
  if (!c || c.left === 0) return null
  const pad = (n) => String(n).padStart(2, '0')
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-ink px-4 py-3 text-white">
      <span className="text-xs font-semibold tracking-wider text-lime uppercase">Offer ends in</span>
      <span className="font-display text-lg font-bold tabular-nums">
        {c.days > 0 && `${c.days}d `}{pad(c.hours)}:{pad(c.minutes)}:{pad(c.seconds)}
      </span>
    </div>
  )
}

function Checkout({ product, page, booked, soldOut, onOrdered, preview }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', phone: '', waUpdates: false, amount: product.pay_what_you_want ? Math.max(product.price_inr, product.min_price_inr) : product.price_inr, coupon: '', question: '' })
  const [slot, setSlot] = useState(null)
  const [discount, setDiscount] = useState(0)
  const [couponMsg, setCouponMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState(null) // 'upi' | 'test' | 'off'
  useEffect(() => {
    if (!preview) fetchPaymentMode(page.id).then(setMode).catch(() => setMode(null))
  }, [page.id, preview])

  const base = product.pay_what_you_want ? Math.max(Number(form.amount) || 0, product.min_price_inr) : product.price_inr
  const total = Math.max(0, base - discount)
  const started = product.type === 'webinar' && product.data?.starts_at && new Date(product.data.starts_at) < new Date()
  const sessions = product.type === 'session' ? Math.max(1, Number(product.data?.sessions) || 1) : 0
  const slotRequired = product.type === 'session' && sessions === 1

  async function applyCoupon() {
    setCouponMsg('')
    setDiscount(0)
    if (!form.coupon.trim()) return
    try {
      const d = await checkCoupon({ p_page_id: page.id, p_product_id: product.id, p_code: form.coupon, p_price: base })
      setDiscount(d)
      setCouponMsg(`Coupon applied — you save ${formatInr(d)}`)
    } catch (err) {
      setCouponMsg(err.message)
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (preview) return setError('This is a preview. Visitors can pay here on your live page.')
    if (slotRequired && !slot) return setError('Please pick a time slot')
    if (product.type === 'question' && !form.question.trim()) return setError('Please write your question')
    setBusy(true)
    setError('')
    try {
      const { token } = await checkoutOrder({
        p_product_id: product.id, p_name: form.name, p_email: form.email, p_phone: form.phone,
        p_amount: product.pay_what_you_want ? Number(form.amount) : null, p_coupon: discount ? form.coupon : null, p_slot: slot,
        p_question: product.type === 'question' ? form.question.trim() : null,
        p_wa_updates: Boolean(form.phone.trim() && form.waUpdates),
      })
      if (onOrdered) onOrdered(token)
      else navigate(`/order/${token}`)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  if (soldOut || started) {
    return <div className="rounded-2xl bg-cream p-5 text-center font-semibold">{soldOut ? 'Sold out' : 'This webinar has already started'}</div>
  }

  const freeLabel = { digital: 'Get it free', bundle: 'Get it free', content: 'Unlock for free', membership: 'Join for free', question: 'Send my question' }[product.type] || 'Reserve my spot'

  return (
    <form onSubmit={submit} className="space-y-4">
      {product.type === 'session' && (
        <div>
          {sessions > 1 && (
            <div className="mb-3 rounded-2xl bg-lilac-100 p-4 text-sm">
              <p className="font-semibold">Book your first session now or later</p>
              <p className="mt-0.5 text-ink-600">You can book all {sessions} sessions from your order page after checkout.</p>
            </div>
          )}
          <SlotPicker data={product.data} booked={booked} value={slot} onChange={setSlot} />
          {sessions > 1 && slot && <button type="button" onClick={() => setSlot(null)} className="mt-2 text-xs font-semibold text-ink-500 underline">Clear — I’ll book later</button>}
        </div>
      )}
      {product.type === 'question' && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Your question</span>
          <textarea className="field min-h-32" required maxLength={1000} placeholder="Be specific — share context so the answer is useful to you." value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
          <span className="mt-1 block text-right text-[11px] text-ink-400">{form.question.length}/1000</span>
        </label>
      )}
      {product.pay_what_you_want && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Name your price (min {formatInr(product.min_price_inr)})</span>
          <input className="field" type="number" min={product.min_price_inr} inputMode="numeric" value={form.amount} onChange={(e) => { setForm({ ...form, amount: e.target.value }); setDiscount(0) }} />
        </label>
      )}
      <input className="field" placeholder="Your name" required maxLength={120} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input className="field" type="email" required placeholder="Email (we’ll show your access link)" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input className="field" type="tel" placeholder="WhatsApp number (optional)" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      {mode === 'upi' && form.phone.trim() && (
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-ink" checked={form.waUpdates} onChange={(e) => setForm({ ...form, waUpdates: e.target.checked })} />
          <span>Send me a WhatsApp message when my payment is confirmed</span>
        </label>
      )}
      {base > 0 && (
        <div>
          <div className="flex gap-2">
            <input className="field h-11 min-w-0 uppercase" placeholder="Coupon code" value={form.coupon} onChange={(e) => setForm({ ...form, coupon: e.target.value })} />
            <button type="button" onClick={applyCoupon} className="h-11 shrink-0 rounded-full bg-cream px-5 text-sm font-semibold hover:bg-cream-300">Apply</button>
          </div>
          {couponMsg && <p className={`mt-1.5 text-xs font-semibold ${discount ? 'text-teal' : 'text-red-600'}`}>{couponMsg}</p>}
        </div>
      )}
      {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
      <button type="submit" disabled={busy || (total > 0 && mode === 'off')} className="flex h-13 w-full items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white disabled:opacity-60">
        {busy ? 'Processing…' : total > 0 ? `${mode === 'upi' ? 'Continue to pay' : 'Pay'} ${formatInr(total)}${product.type === 'membership' ? ` / ${intervalLabel(product.data)}` : ''}` : freeLabel}
      </button>
      {total > 0 && mode === 'upi' && <p className="text-center text-xs text-ink-500">You pay {page.display_name || 'the creator'} directly with any UPI app. Access opens once they confirm your payment.</p>}
      {total > 0 && mode === 'test' && <p className="text-center text-xs text-ink-500">🔒 Test mode: no real payment is taken.</p>}
      {total > 0 && mode === 'off' && <p className="text-center text-xs font-medium text-ink-600">This creator hasn’t set up payments yet. Please check back soon.</p>}
    </form>
  )
}

/** Description, facts and what's included */
export function ProductInfo({ product, theme, seatsLeft, stockLeft }) {
  const when = product.type === 'webinar' && product.data?.starts_at
  const sessions = Math.max(1, Number(product.data?.sessions) || 1)
  const items = product.bundle_items || []
  return (
            <div>
              <p className="eyebrow text-ink-500">{TYPE_LABEL[product.type]}</p>
              <h1 className="mt-2 text-3xl leading-tight font-bold tracking-tight break-words sm:text-4xl" style={{ fontFamily: FONTS[theme.headingFont]?.css }}>{product.title}</h1>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                {when && <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 font-medium"><CalendarIcon size={14} /> {formatIst(product.data.starts_at, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} IST · {product.data.duration || 60} min</span>}
                {product.type === 'session' && <span className="rounded-full bg-cream px-3 py-1.5 font-medium">{sessions > 1 ? `${sessions} × ` : ''}{product.data.duration || 30}-minute video call{sessions > 1 ? 's' : ''}</span>}
                {product.type === 'digital' && product.file_name && <span className="rounded-full bg-cream px-3 py-1.5 font-medium">{product.file_name.split('.').pop().toUpperCase()} · {formatBytes(product.file_size)}</span>}
                {product.type === 'bundle' && items.length > 0 && <span className="rounded-full bg-cream px-3 py-1.5 font-medium">{items.length} items included</span>}
                {product.type === 'membership' && <span className="rounded-full bg-cream px-3 py-1.5 font-medium">Billed {product.data?.interval === 'year' ? 'yearly' : 'monthly'}</span>}
                {product.type === 'question' && <span className="rounded-full bg-cream px-3 py-1.5 font-medium">Reply within {product.data?.response_days || 3} day{Number(product.data?.response_days) === 1 ? '' : 's'}</span>}
                {seatsLeft != null && <span className="rounded-full bg-lime px-3 py-1.5 font-semibold">{seatsLeft} seats left</span>}
                {stockLeft != null && stockLeft > 0 && <span className="rounded-full bg-lime px-3 py-1.5 font-semibold">Only {stockLeft} left</span>}
              </div>
              {product.description && <p className="mt-6 text-[16px] leading-relaxed break-words whitespace-pre-line text-ink-700">{product.description}</p>}
              {product.type === 'bundle' && items.length > 0 && (
                <div className="mt-6">
                  <p className="eyebrow mb-2 text-ink-500">What’s included</p>
                  <ul className="grid gap-2">
                    {items.map((it) => (
                      <li key={it.id} className="flex items-center gap-3 rounded-2xl bg-cream p-2.5">
                        <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">
                          {it.thumbnail_url ? <img src={optimizedImage(it.thumbnail_url, 120)} alt="" className="size-full object-cover" /> : <CheckIcon size={16} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{it.title}</span>
                          <span className="block text-xs text-ink-500">{TYPE_LABEL[it.type]}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <ul className="mt-6 space-y-2 text-sm text-ink-600">
                {product.type === 'digital' && <li className="flex items-center gap-2"><CheckIcon size={16} /> Instant download after checkout</li>}
                {product.type === 'bundle' && <li className="flex items-center gap-2"><CheckIcon size={16} /> Everything unlocked instantly after checkout</li>}
                {product.type === 'content' && <li className="flex items-center gap-2"><CheckIcon size={16} /> Unlocked instantly after checkout</li>}
                {product.type === 'membership' && <li className="flex items-center gap-2"><CheckIcon size={16} /> Community invite & members-only pages right after joining</li>}
                {product.type === 'question' && <li className="flex items-center gap-2"><CheckIcon size={16} /> Written reply on your order page</li>}
                {product.type === 'session' && <li className="flex items-center gap-2"><CheckIcon size={16} /> Meeting link shown right after booking</li>}
                {product.type === 'session' && Number(product.data?.reschedule_hours ?? 24) >= 0 && <li className="flex items-center gap-2"><CheckIcon size={16} /> Reschedule up to {product.data?.reschedule_hours ?? 24} hours before</li>}
                {product.type === 'webinar' && <li className="flex items-center gap-2"><CheckIcon size={16} /> Joining link shown right after registration</li>}
                <li className="flex items-center gap-2"><CheckIcon size={16} /> Receipt on screen — bookmark your access page</li>
              </ul>
            </div>
  )
}

/** Price, offer countdown and the checkout form */
export function BuyBox({ product, page, booked, seatsLeft, stockLeft, onReload, onOrdered, preview }) {
  const soldOut = seatsLeft === 0 || stockLeft === 0
  const per = product.type === 'membership' ? ` / ${intervalLabel(product.data)}` : ''
  const priceText = product.pay_what_you_want ? `${formatInr(product.min_price_inr)}+` : product.price_inr ? formatInr(product.price_inr) : 'Free'
  return (
    <>
      {product.sale_ends_at && <SaleCountdown endsAt={product.sale_ends_at} onEnd={onReload} />}
      <div className="mb-5 flex flex-wrap items-baseline gap-x-2">
        <span className="font-display text-4xl font-bold">{priceText}</span>
        {per && product.price_inr > 0 && !product.pay_what_you_want && <span className="text-lg font-semibold text-ink-500">{per}</span>}
        {product.compare_at_inr > product.price_inr && <span className="text-lg text-ink-400 line-through">{formatInr(product.compare_at_inr)}</span>}
      </div>
      <Checkout key={product.price_inr} product={product} page={page} booked={booked} soldOut={soldOut} onOrdered={onOrdered} preview={preview} />
    </>
  )
}
