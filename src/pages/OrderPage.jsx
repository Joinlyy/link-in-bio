import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { acceptUpsell, bookSession, fetchOrder, fetchUpiPayment, getDownloadUrl, openDispute, rescheduleBooking, submitUpiReference } from '../lib/publicApi'
import UpiPay from '../components/UpiPay'
import { formatInr, optimizedImage } from '../lib/images'
import { calendarUrl, formatIst } from '../lib/slots'
import { normalizeUrl } from '../lib/embeds'
import { Avatar } from '../components/page/PageRenderer'
import { ArrowUpRightIcon, CalendarIcon, CheckIcon, CloseIcon, FlagIcon, Logo } from '../components/icons'
import { intervalLabel, RichText, SlotPicker, TYPE_LABEL } from '../components/order/shared'
import { isCustomDomainHost } from '../lib/config'

const DATE = { day: 'numeric', month: 'short', year: 'numeric' }

const DISPUTE_REASONS = [
  { value: 'not_received', label: 'I didn’t receive what I paid for' },
  { value: 'not_as_described', label: 'Not as described' },
  { value: 'session_missed', label: 'The creator missed my session' },
  { value: 'duplicate', label: 'I was charged twice' },
  { value: 'other', label: 'Something else' },
]
const DISPUTE_STATUS = {
  open: 'Waiting for the creator',
  creator_responded: 'The creator responded',
  resolved_refund: 'Resolved — refunded',
  resolved_rejected: 'Resolved — no refund',
}

function Section({ title, tone = 'bg-cream', children }) {
  return (
    <div className={`min-w-0 rounded-2xl p-5 ${tone}`}>
      {title && <p className="eyebrow mb-2 text-ink-500">{title}</p>}
      {children}
    </div>
  )
}

function DownloadButton({ token, itemId, label = 'Download your file', small }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function go() {
    setBusy(true)
    setError('')
    try {
      window.location.assign(await getDownloadUrl(token, itemId))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <button type="button" onClick={go} disabled={busy} className={`flex w-full items-center justify-center gap-2 rounded-full bg-ink font-semibold text-white disabled:opacity-60 ${small ? 'h-11 text-sm' : 'h-13 text-[15px]'}`}>
        {busy ? 'Preparing…' : label}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}

function Bookings({ data, token, onChange }) {
  const { order, access, bookings = [], sessions_total: total, reschedule_hours: hours, session_data: sessionData, booked = [] } = data
  const [mode, setMode] = useState(null) // { kind: 'book' } | { kind: 'reschedule', id }
  const [slot, setSlot] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = bookings.filter((b) => b.status !== 'cancelled')
  const meeting = access?.meeting_url && normalizeUrl(access.meeting_url)
  const canBook = !!sessionData && active.length < (total || 1)
  const canReschedule = (b) => !!sessionData && hours >= 0 && b.status === 'confirmed' && new Date(b.starts_at).getTime() - Date.now() > hours * 3600_000

  async function confirm() {
    if (!slot) return setError('Pick a time slot')
    setBusy(true)
    setError('')
    try {
      if (mode.kind === 'book') await bookSession(token, slot)
      else await rescheduleBooking(token, mode.id, slot)
      setMode(null)
      setSlot(null)
      await onChange()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title={total > 1 ? `Your sessions · ${active.length} of ${total} booked` : 'Your session'}>
      {bookings.length === 0 && <p className="text-sm text-ink-600">No session booked yet.</p>}
      <ul className="grid gap-2.5">
        {bookings.map((b) => {
          const cancelled = b.status === 'cancelled'
          return (
            <li key={b.id} className="rounded-2xl bg-white p-4">
              <p className={`flex items-center gap-2 font-semibold ${cancelled ? 'text-ink-400 line-through' : ''}`}><CalendarIcon size={16} /> {formatIst(b.starts_at, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })} IST</p>
              {cancelled && <p className="mt-1 text-sm font-semibold text-red-600">Cancelled{b.cancel_reason ? ` — ${b.cancel_reason}` : ''}</p>}
              {b.status === 'completed' && <p className="mt-1 text-sm font-semibold text-teal">Completed</p>}
              {b.status === 'confirmed' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {meeting && <a href={meeting} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-white">Join link <ArrowUpRightIcon size={14} /></a>}
                  <a href={calendarUrl({ title: order.product_title, start: b.starts_at, end: b.ends_at, details: meeting || '' })} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-full border border-ink/15 bg-white px-4 text-sm font-semibold">Add to calendar</a>
                  {canReschedule(b) && (
                    <button type="button" onClick={() => { setMode({ kind: 'reschedule', id: b.id }); setSlot(null); setError('') }} className="inline-flex h-10 items-center rounded-full bg-cream px-4 text-sm font-semibold hover:bg-cream-300">Reschedule</button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {active.some((b) => b.status === 'confirmed') && !meeting && <p className="mt-3 text-sm text-ink-500">The creator will share the joining link before it starts.</p>}
      {hours >= 0 && active.some((b) => b.status === 'confirmed') && <p className="mt-3 text-xs text-ink-500">You can reschedule up to {hours} hours before a session.</p>}
      {canBook && !mode && (
        <button type="button" onClick={() => { setMode({ kind: 'book' }); setSlot(null); setError('') }} className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-lime text-sm font-semibold text-ink">
          {active.length === 0 ? 'Book your session' : 'Book next session'}
        </button>
      )}
      {mode && (
        <div className="mt-4 rounded-2xl bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-semibold">{mode.kind === 'book' ? 'Book a session' : 'Pick a new time'}</p>
            <button type="button" onClick={() => setMode(null)} className="grid size-9 place-items-center rounded-full bg-cream hover:bg-cream-300" aria-label="Close"><CloseIcon size={16} /></button>
          </div>
          <SlotPicker data={sessionData} booked={booked} value={slot} onChange={setSlot} />
          {error && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
          <button type="button" onClick={confirm} disabled={busy || !slot} className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-ink text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'Saving…' : mode.kind === 'book' ? 'Confirm booking' : 'Move my session'}
          </button>
        </div>
      )}
    </Section>
  )
}

function Upsell({ upsell, token }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const regular = upsell.price_inr
  const offer = upsell.offer_price_inr
  async function accept() {
    setBusy(true)
    setError('')
    try {
      const res = await acceptUpsell(token)
      navigate(`/order/${res.token}`)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
  return (
    <div className="card overflow-hidden">
      <div className="bg-ink px-6 py-3 text-center text-xs font-bold tracking-widest text-lime uppercase">One-time offer · just for you</div>
      <div className="flex gap-4 p-5 sm:p-6">
        {upsell.thumbnail_url && <img src={optimizedImage(upsell.thumbnail_url, 200)} alt="" className="size-20 shrink-0 rounded-2xl object-cover" />}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-ink-500">{TYPE_LABEL[upsell.type]}</p>
          <p className="font-bold break-words">{upsell.title}</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="font-display text-2xl font-bold">{offer ? formatInr(offer) : 'Free'}</span>
            {regular > offer && <span className="text-sm text-ink-400 line-through">{formatInr(regular)}</span>}
          </p>
        </div>
      </div>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        {error && <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
        <button type="button" onClick={accept} disabled={busy} className="flex h-12 w-full items-center justify-center rounded-full bg-lime text-[15px] font-semibold text-ink disabled:opacity-60">
          {busy ? 'Adding…' : offer ? `Yes, add it for ${formatInr(offer)}` : 'Yes, add it free'}
        </button>
        <p className="mt-2 text-center text-xs text-ink-500">One click — no need to fill your details again. Test mode: no real payment.</p>
      </div>
    </div>
  )
}

function Dispute({ dispute, paid, token, onChange }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('not_received')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const live = dispute && ['open', 'creator_responded'].includes(dispute.status)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await openDispute(token, reason, details.trim())
      setOpen(false)
      await onChange()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-5 sm:p-6">
      {dispute && (
        <div className="mb-4">
          <p className="flex items-center gap-2 font-semibold"><FlagIcon size={16} /> Problem reported · {formatIst(dispute.created_at, DATE)}</p>
          <p className={`mt-1 text-sm font-semibold ${dispute.status === 'resolved_refund' ? 'text-teal' : 'text-ink-600'}`}>{DISPUTE_STATUS[dispute.status] || dispute.status}</p>
          {dispute.creator_response && (
            <div className="mt-3 rounded-2xl bg-lilac-100 p-4 text-sm">
              <p className="eyebrow mb-1 text-ink-500">Creator’s response</p>
              <RichText text={dispute.creator_response} />
            </div>
          )}
          {live && <p className="mt-3 text-xs text-ink-500">Our team reviews disputes that aren’t resolved between you and the creator.</p>}
        </div>
      )}
      {paid && !live && (
        open ? (
          <form onSubmit={submit} className="space-y-3">
            <p className="font-semibold">Report a problem</p>
            <select className="field" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason">
              {DISPUTE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <textarea className="field min-h-24" required maxLength={2000} placeholder="Tell us what happened…" value={details} onChange={(e) => setDetails(e.target.value)} />
            {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy} className="inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Sending…' : 'Submit'}</button>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex h-11 items-center rounded-full bg-cream px-5 text-sm font-semibold hover:bg-cream-300">Cancel</button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 text-sm font-semibold text-ink-600 hover:text-ink">
            <FlagIcon size={15} /> Report a problem with this order
          </button>
        )
      )}
    </div>
  )
}

/** An order paid straight to the creator's UPI: pay, send the reference, then wait for them to confirm */
function UpiOrder({ data, token, onChange, embedded }) {
  const { order, page } = data
  const [pay, setPay] = useState(null)
  const loadPay = useCallback(() => fetchUpiPayment(token).then(setPay).catch(() => setPay(null)), [token])
  useEffect(() => {
    loadPay()
  }, [loadPay])
  // Check now and then whether the creator has confirmed
  useEffect(() => {
    if (!pay?.utr || order.status !== 'pending') return
    const timer = setInterval(onChange, 30000)
    return () => clearInterval(timer)
  }, [pay?.utr, order.status, onChange])

  const failed = order.status === 'failed'
  return (
    <div className={embedded ? '' : 'min-h-dvh px-4 py-8 sm:py-14'}>
      <div className="mx-auto max-w-xl space-y-4">
        <div className="card overflow-hidden">
          <div className="bg-cream-200 px-6 py-8 text-center sm:px-9">
            <h1 className="display-md">{failed ? 'Payment not confirmed' : pay?.utr ? 'Waiting for confirmation' : 'Pay to finish your order'}</h1>
            <p className="mt-2 break-words text-ink-700">{order.kind === 'tip' ? `Tip for ${page.display_name || page.username}` : order.product_title}</p>
          </div>
          <div className="space-y-5 p-6 sm:p-9">
            {failed ? (
              <Section tone="bg-red-50">
                <p className="font-semibold text-red-700">{page.display_name || 'The creator'} couldn’t find this payment.</p>
                {order.refund_reason && <p className="mt-1 text-sm text-red-700">Reason: {order.refund_reason}</p>}
                <p className="mt-2 text-sm text-ink-700">If money left your account, contact them with your UPI reference.</p>
              </Section>
            ) : pay ? (
              <UpiPay
                upiId={pay.upi_id}
                name={pay.upi_name}
                amount={pay.amount_inr}
                note={pay.note}
                submittedUtr={pay.utr}
                onSubmit={async (utr) => {
                  await submitUpiReference(token, utr)
                  await loadPay()
                }}
              />
            ) : (
              <div className="h-80 animate-pulse rounded-3xl bg-cream" />
            )}
            <p className="text-center text-xs text-ink-500">You’re paying {page.display_name || page.username} directly. Bookmark this page: it’s your order link.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function OrderView({ token, embedded = false }) {
  const [state, setState] = useState({ status: 'loading' })

  const load = useCallback(
    () =>
      fetchOrder(token)
        .then((data) => setState(data ? { status: 'ready', data } : { status: 'missing' }))
        .catch(() => setState({ status: 'missing' })),
    [token],
  )

  useEffect(() => {
    document.title = 'Your order'
    load()
  }, [load])

  // Active members unlock members-only sub-pages on this device
  const memberPageId = state.data?.membership_active ? state.data.page?.id : null
  useEffect(() => {
    if (!memberPageId) return
    try {
      localStorage.setItem(`lib_member_${memberPageId}`, token)
    } catch {
      /* storage blocked */
    }
  }, [memberPageId, token])

  if (state.status === 'loading') return <div className="mx-auto mt-16 h-80 max-w-xl animate-pulse rounded-3xl bg-cream-200" />
  if (state.status === 'missing') {
    return (
      <div className="grid min-h-dvh place-items-center px-4 text-center">
        <div>
          <Logo size={48} className="mx-auto" />
          <h1 className="display-md mt-6">Order not found</h1>
          <p className="mt-2 text-ink-500">Check that you copied the full link.</p>
        </div>
      </div>
    )
  }

  const { data } = state
  if (data.order.payment_provider === 'upi' && ['pending', 'failed'].includes(data.order.status)) {
    return <UpiOrder data={data} token={token} onChange={load} embedded={embedded} />
  }
  const { order, page, product, access, upsell, dispute } = data
  const type = product?.type || order.product_type
  const paid = order.status === 'paid'
  const refunded = order.status === 'refunded'
  const isTip = order.kind === 'tip'
  const expired = type === 'membership' && paid && data.membership_active === false
  const meeting = access?.meeting_url && normalizeUrl(access.meeting_url)
  const webinarStart = type === 'webinar' && product?.data?.starts_at
  const webinarEnd = webinarStart && new Date(new Date(webinarStart).getTime() + (product.data.duration || 60) * 60000).toISOString()
  // On a creator's custom domain their site lives at the root
  const pageBase = isCustomDomainHost() ? '' : `/${page.username}`
  const productLink = product ? `${pageBase}/p/${product.id}` : pageBase || '/'
  const inviteUrl = access?.invite_url && normalizeUrl(access.invite_url)

  const heading = isTip
    ? 'Thank you for the tip!'
    : refunded
      ? 'Order refunded'
      : expired
        ? 'Membership expired'
        : paid
          ? type === 'membership' ? 'Welcome in!' : type === 'question' ? (order.answer ? 'You’ve got an answer!' : 'Question sent!') : 'You’re all set!'
          : `Order ${order.status}`
  const good = paid && !expired

  return (
    <div className={embedded ? '' : 'min-h-dvh px-4 py-8 sm:py-14'}>
      <div className="mx-auto max-w-xl space-y-4">
        <div className="card overflow-hidden">
          <div className={`px-6 py-8 text-center sm:px-9 ${good ? 'bg-lime' : 'bg-cream-200'}`}>
            <span className={`mx-auto grid size-14 place-items-center rounded-full ${good ? 'bg-ink text-lime' : 'bg-white text-ink'}`}>{good ? <CheckIcon size={28} /> : <CloseIcon size={24} />}</span>
            <h1 className="display-md mt-4">{heading}</h1>
            <p className="mt-2 break-words text-ink-700">{isTip ? `${page.display_name || page.username} will love this.` : order.product_title}</p>
          </div>
          <div className="space-y-5 p-6 sm:p-9">
            {refunded && (
              <Section tone="bg-red-50">
                <p className="font-semibold text-red-700">This order was refunded{order.refunded_at ? ` on ${formatIst(order.refunded_at, DATE)}` : ''}.</p>
                {order.refund_reason && <p className="mt-1 text-sm text-red-700">Reason: {order.refund_reason}</p>}
                <p className="mt-2 text-xs text-ink-500">Access to this purchase has ended.{order.payment_provider === 'test' ? ' Test order — no real money moved.' : ''}</p>
              </Section>
            )}

            {paid && type === 'digital' && access?.has_file && <DownloadButton token={token} />}

            {paid && type === 'bundle' && (data.bundle_items || []).length > 0 && (
              <div className="space-y-3">
                <p className="eyebrow text-ink-500">Your bundle · {data.bundle_items.length} items</p>
                {data.bundle_items.map((it) => (
                  <Section key={it.id}>
                    <p className="font-semibold break-words">{it.title}</p>
                    <p className="text-xs text-ink-500">{TYPE_LABEL[it.type]}{it.file_name ? ` · ${it.file_name}` : ''}</p>
                    {it.type === 'digital' && it.has_file && <div className="mt-3"><DownloadButton token={token} itemId={it.id} label="Download" small /></div>}
                    {it.content && <RichText text={it.content} className="mt-3 rounded-2xl bg-white p-4 text-sm" />}
                    {it.instructions && <RichText text={it.instructions} className="mt-3 text-sm text-ink-600" />}
                  </Section>
                ))}
              </div>
            )}

            {paid && type === 'content' && access?.content && (
              <Section title="Your content" tone="bg-white border border-ink/10">
                <RichText text={access.content} className="text-[15px] text-ink-800" />
              </Section>
            )}

            {type === 'membership' && paid && (
              <Section tone={expired ? 'bg-cream' : 'bg-lilac-100'}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="eyebrow text-ink-500">Membership</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${expired ? 'bg-red-50 text-red-700' : 'bg-lime text-ink'}`}>{expired ? 'Expired' : 'Active'}</span>
                </div>
                {order.access_expires_at && <p className="mt-2 font-semibold">{expired ? 'Ended' : 'Access until'} {formatIst(order.access_expires_at, DATE)}</p>}
                {!expired && inviteUrl && (
                  <a href={inviteUrl} target="_blank" rel="noopener noreferrer" className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-white">Join the community <ArrowUpRightIcon size={16} /></a>
                )}
                {!expired && <p className="mt-3 text-xs text-ink-600">Members-only pages on {page.display_name || `@${page.username}`}’s site are unlocked on this device.</p>}
                <Link to={productLink} className={`mt-4 flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold ${expired ? 'bg-ink text-white' : 'border border-ink/15 bg-white'}`}>
                  {expired ? 'Renew membership' : `Renew early · +1 ${intervalLabel(product?.data)}`}
                </Link>
              </Section>
            )}

            {type === 'question' && order.question && (
              <div className="space-y-3">
                <Section title="Your question">
                  <p className="text-sm leading-relaxed break-words whitespace-pre-line">{order.question}</p>
                </Section>
                {order.answer ? (
                  <Section title={`Answer · ${formatIst(order.answered_at, DATE)}`} tone="bg-lime-200">
                    <RichText text={order.answer} className="text-[15px]" />
                  </Section>
                ) : paid ? (
                  <p className="rounded-2xl border-2 border-dashed border-ink/10 p-4 text-center text-sm text-ink-600">
                    Awaiting reply — {page.display_name || page.username} usually answers within {product?.data?.response_days || 3} day{Number(product?.data?.response_days) === 1 ? '' : 's'}. Bookmark this page to check back.
                  </p>
                ) : null}
              </div>
            )}

            {paid && type === 'session' && <Bookings data={data} token={token} onChange={load} />}

            {paid && webinarStart && (
              <Section>
                <p className="flex items-center gap-2 font-semibold"><CalendarIcon size={16} /> {formatIst(webinarStart, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })} IST</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {meeting && <a href={meeting} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white">Join link <ArrowUpRightIcon size={16} /></a>}
                  <a href={calendarUrl({ title: order.product_title, start: webinarStart, end: webinarEnd, details: meeting || '' })} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center rounded-full border border-ink/15 bg-white px-5 text-sm font-semibold">Add to Google Calendar</a>
                </div>
                {!meeting && <p className="mt-3 text-sm text-ink-500">The creator will share the joining link before it starts.</p>}
              </Section>
            )}

            {paid && access?.instructions && (
              <Section title="From the creator" tone="bg-lilac-100">
                <RichText text={access.instructions} className="text-sm" />
              </Section>
            )}

            <dl className="divide-y divide-ink/10 text-sm">
              {[
                ['Amount', `${formatInr(order.amount_inr)}${order.discount_inr ? ` (saved ${formatInr(order.discount_inr)})` : ''}`],
                ['Email', order.buyer_email],
                ['Date', formatIst(order.created_at, { ...DATE, hour: 'numeric', minute: '2-digit' })],
                type === 'membership' && order.access_expires_at && ['Access until', formatIst(order.access_expires_at, DATE)],
                ['Reference', order.payment_ref],
              ].filter(Boolean).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5">
                  <dt className="shrink-0 text-ink-500">{k}</dt>
                  <dd className="min-w-0 text-right font-medium break-all">{v}</dd>
                </div>
              ))}
            </dl>
            {order.payment_provider === 'test' && <p className="rounded-2xl bg-cream p-3 text-center text-xs text-ink-500">Test order — no real payment was taken.</p>}
            <p className="text-center text-xs text-ink-500">Bookmark this page — it’s your access link.</p>
          </div>
        </div>

        {paid && upsell && order.payment_provider !== 'upi' && <Upsell upsell={upsell} token={token} />}

        {!isTip && (paid || dispute) && <Dispute dispute={dispute} paid={paid} token={token} onChange={load} />}

        {!embedded && <Link to={pageBase || '/'} className="card flex items-center gap-3 p-4">
          <Avatar page={page} size={44} theme={page.theme} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{page.display_name || page.username}</span>
            <span className="block text-sm text-ink-500">Back to their page</span>
          </span>
          <ArrowUpRightIcon size={18} />
        </Link>}
      </div>
    </div>
  )
}

export default function OrderPage() {
  const { token } = useParams()
  // Keyed so navigating to an upsell order starts fresh
  return <OrderView key={token} token={token} />
}
