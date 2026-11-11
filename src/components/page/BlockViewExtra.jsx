import { lazy, Suspense, useEffect, useState } from 'react'
import { trackClick } from '../../lib/analytics'
import { normalizeUrl } from '../../lib/embeds'
import { submitEnquiry } from '../../lib/publicApi'
import { buttonCss, FONTS, hexAlpha } from '../../lib/themes'
import { ArrowUpRightIcon, CheckIcon } from '../icons'
import { surfaceCss } from './BlockView'

const TipSheet = lazy(() => import('./TipSheet'))

const headingStyle = (ctx) => ({ fontFamily: FONTS[ctx.theme.headingFont]?.css })
const solidButton = (ctx) => buttonCss({ ...ctx.theme, buttonStyle: ctx.theme.buttonStyle === 'outline' ? 'outline' : 'fill' })

/** "2026-11-08T19:00" interpreted as IST */
export function istDate(value) {
  if (!value) return null
  const d = new Date(value.length <= 16 ? `${value}:00+05:30` : value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function CountdownBlock({ block, ctx }) {
  const target = istDate(block.data.target)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  if (!target) return null
  const left = Math.max(0, target.getTime() - now)
  const parts = [
    [Math.floor(left / 86400000), ctx.lang === 'hi' ? 'दिन' : 'days'],
    [Math.floor(left / 3600000) % 24, ctx.lang === 'hi' ? 'घंटे' : 'hrs'],
    [Math.floor(left / 60000) % 60, ctx.lang === 'hi' ? 'मिनट' : 'min'],
    [Math.floor(left / 1000) % 60, ctx.lang === 'hi' ? 'सेकंड' : 'sec'],
  ]
  return (
    <div className="w-full p-4 text-center sm:p-5" style={surfaceCss(ctx.theme)}>
      {block.data.title && <p className="text-[15px] font-bold" style={headingStyle(ctx)}>{block.data.title}</p>}
      {left === 0 ? (
        <p className="mt-2 text-sm font-semibold opacity-80">{block.data.ended_text || (ctx.lang === 'hi' ? 'समय समाप्त!' : 'It’s live!')}</p>
      ) : (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {parts.map(([n, label]) => (
            <div key={label} className="rounded-2xl py-2.5" style={{ background: hexAlpha(ctx.theme.text, 0.07) }}>
              <p className="font-display text-2xl leading-none font-bold tabular-nums">{String(n).padStart(2, '0')}</p>
              <p className="mt-1 text-[10px] font-semibold tracking-wider uppercase opacity-60">{label}</p>
            </div>
          ))}
        </div>
      )}
      {block.data.url && left > 0 && (
        <a href={normalizeUrl(block.data.url)} target="_blank" rel="noopener noreferrer nofollow" onClick={() => !ctx.preview && trackClick(ctx.pageId, block.id)} className="mt-3 flex h-11 items-center justify-center gap-2 text-sm font-semibold" style={solidButton(ctx)}>
          {block.data.button || 'Set a reminder'} <ArrowUpRightIcon size={16} />
        </a>
      )}
    </div>
  )
}

export function FaqBlock({ block, ctx }) {
  const items = (block.data.items || []).filter((i) => i.q)
  if (!items.length) return null
  return (
    <div className="w-full overflow-hidden" style={surfaceCss(ctx.theme)}>
      {block.data.title && <p className="px-4 pt-4 text-[15px] font-bold sm:px-5" style={headingStyle(ctx)}>{block.data.title}</p>}
      {items.map((item, i) => (
        <details key={i} className="group px-4 py-3.5 sm:px-5" style={{ borderTop: i || block.data.title ? `1px solid ${hexAlpha(ctx.theme.text, 0.08)}` : undefined }}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
            {item.q}
            <span className="text-lg transition group-open:rotate-45">+</span>
          </summary>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line opacity-80">{item.a}</p>
        </details>
      ))}
    </div>
  )
}

export function TestimonialsBlock({ block, ctx }) {
  const items = (block.data.items || []).filter((i) => i.quote)
  if (!items.length) return null
  return (
    <div className="w-full">
      {block.data.title && <p className="mb-2 text-center text-[15px] font-bold" style={headingStyle(ctx)}>{block.data.title}</p>}
      <div className="scrollbar-none -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5">
        {items.map((item, i) => (
          <figure key={i} className={`shrink-0 snap-center p-4 ${items.length === 1 ? 'w-full' : 'w-[85%]'}`} style={surfaceCss(ctx.theme)}>
            <p className="font-display text-3xl leading-none opacity-30">“</p>
            <blockquote className="text-sm leading-relaxed">{item.quote}</blockquote>
            <figcaption className="mt-3 text-xs">
              <b>{item.name}</b>
              {item.role && <span className="opacity-60"> · {item.role}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

export function EnquiryBlock({ block, ctx }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ brand: '', name: '', email: '', phone: '', budget: '', message: '', dealType: 'paid' })
  const [state, setState] = useState({ status: 'idle', error: '' })
  const input = {
    background: hexAlpha(ctx.theme.text, 0.06),
    border: `1px solid ${hexAlpha(ctx.theme.text, 0.15)}`,
    color: ctx.theme.text,
    borderRadius: ctx.theme.radius === 'square' ? 6 : 14,
  }
  const field = 'h-11 w-full px-3.5 text-sm outline-none placeholder:opacity-60'

  async function onSubmit(e) {
    e.preventDefault()
    if (ctx.preview) return setState({ status: 'done', error: '' })
    setState({ status: 'loading', error: '' })
    try {
      await submitEnquiry({ p_page_id: ctx.pageId, p_brand: form.brand, p_name: form.name, p_email: form.email, p_phone: form.phone, p_budget: form.budget, p_message: form.message, p_deal_type: form.dealType })
      setState({ status: 'done', error: '' })
    } catch (err) {
      setState({ status: 'idle', error: err.message })
    }
  }

  return (
    <div className="w-full p-4 sm:p-5" style={surfaceCss(ctx.theme)}>
      <p className="text-[17px] font-bold" style={headingStyle(ctx)}>{block.data.title || 'Work with me'}</p>
      {block.data.description && <p className="mt-1 text-sm opacity-75">{block.data.description}</p>}
      {state.status === 'done' ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold" style={{ background: hexAlpha(ctx.theme.text, 0.08) }}>
          <CheckIcon size={18} /> {ctx.lang === 'hi' ? 'धन्यवाद! जल्द जवाब मिलेगा।' : 'Thanks! I’ll get back to you soon.'}
        </p>
      ) : block.data.action === 'link' && block.data.url ? (
        <a href={normalizeUrl(block.data.url)} target="_blank" rel="noopener noreferrer nofollow" onClick={() => !ctx.preview && trackClick(ctx.pageId, block.id)} className="mt-4 flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold" style={solidButton(ctx)}>
          {block.data.button || 'Send a brand enquiry'} <ArrowUpRightIcon size={16} />
        </a>
      ) : !open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-4 flex h-11 w-full items-center justify-center text-sm font-semibold" style={solidButton(ctx)}>
          {block.data.button || 'Send a brand enquiry'}
        </button>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 space-y-2.5">
          <input className={field} style={input} required maxLength={120} placeholder="Brand / company" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          <input className={field} style={input} maxLength={120} placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={field} style={input} required type="email" placeholder="Work email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <div className="grid grid-cols-2 gap-2.5">
            <input className={field} style={input} type="tel" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className={field} style={input} maxLength={60} placeholder="Budget (₹)" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          </div>
          <select aria-label="What are you offering?" className={field} style={input} value={form.dealType} onChange={(e) => setForm({ ...form, dealType: e.target.value })}>
            <option value="paid">We’ll pay for this collab</option>
            <option value="barter">Product in exchange (barter)</option>
            <option value="hybrid">Payment + product</option>
            <option value="affiliate">Affiliate / commission</option>
          </select>
          <textarea className="min-h-24 w-full px-3.5 py-3 text-sm outline-none placeholder:opacity-60" style={input} maxLength={2000} placeholder="Campaign details, deliverables, timeline…" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          {state.error && <p className="text-xs font-semibold text-red-500">{state.error}</p>}
          <button type="submit" disabled={state.status === 'loading'} className="flex h-11 w-full items-center justify-center text-sm font-semibold disabled:opacity-60" style={solidButton(ctx)}>
            {state.status === 'loading' ? '…' : 'Send enquiry'}
          </button>
        </form>
      )}
    </div>
  )
}

export function TipBlock({ block, ctx }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="w-full p-4 text-center sm:p-5" style={surfaceCss(ctx.theme)}>
      <p className="text-[17px] font-bold" style={headingStyle(ctx)}>{block.data.title || (ctx.lang === 'hi' ? 'मुझे सपोर्ट करें' : 'Support my work')}</p>
      {block.data.description && <p className="mt-1 text-sm opacity-75">{block.data.description}</p>}
      <button type="button" onClick={() => (ctx.preview ? ctx.previewNote('Visitors choose an amount here and pay you. Payments are in test mode for now.', block.id) : setOpen(true))} className="mt-4 flex h-11 w-full items-center justify-center text-sm font-semibold" style={solidButton(ctx)}>
        {block.data.button || (ctx.lang === 'hi' ? '☕ मुझे कॉफ़ी पिलाएँ' : '☕ Buy me a coffee')}
      </button>
      <Suspense fallback={null}>
        {open && <TipSheet block={block} ctx={ctx} onClose={() => setOpen(false)} />}
      </Suspense>
    </div>
  )
}

