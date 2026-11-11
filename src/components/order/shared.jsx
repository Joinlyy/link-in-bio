// Small public-bundle helpers shared by the product page and the buyer's order page.
// Keep dependency-free (no supabase-js, no lucide) so the public bundle stays light.
import { Fragment, useEffect, useMemo, useState } from 'react'
import { buildSlots, formatIst } from '../../lib/slots'

export const TYPE_LABEL = {
  digital: 'Digital download',
  bundle: 'Bundle',
  content: 'Paid content',
  membership: 'Membership',
  question: 'Priority question',
  session: '1:1 session',
  webinar: 'Live webinar',
  link: 'Product',
}

export const intervalLabel = (data) => (data?.interval === 'year' ? 'year' : 'month')

/** Ticks every second until `target` passes; calls onEnd once when it does */
export function useCountdown(target, onEnd) {
  const end = target ? new Date(target).getTime() : null
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!end) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= end) {
        clearInterval(id)
        onEnd?.()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [end, onEnd])
  if (!end) return null
  const left = Math.max(0, end - now)
  return {
    left,
    days: Math.floor(left / 86400000),
    hours: Math.floor(left / 3600000) % 24,
    minutes: Math.floor(left / 60000) % 60,
    seconds: Math.floor(left / 1000) % 60,
  }
}

const URL_RE = /((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]])/gi

/** Plain text with line breaks kept and http(s) URLs turned into safe links (React escapes everything else) */
export function RichText({ text, className = '' }) {
  if (!text) return null
  const parts = String(text).split(URL_RE)
  return (
    <div className={`leading-relaxed break-words whitespace-pre-line ${className}`}>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>
        const href = /^https?:\/\//i.test(part) ? part : `https://${part}`
        return (
          <a key={i} href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold underline decoration-ink/30 underline-offset-2 hover:decoration-ink">
            {part}
          </a>
        )
      })}
    </div>
  )
}

export function SlotPicker({ data, booked, value, onChange }) {
  const days = useMemo(() => buildSlots(data, booked), [data, booked])
  const [day, setDay] = useState(days[0]?.date)
  if (!days.length) return <p className="rounded-2xl bg-cream p-4 text-sm">No slots available right now. Please check back later.</p>
  const current = days.find((d) => d.date === day) || days[0]
  return (
    <div className="min-w-0">
      <p className="mb-2 text-sm font-semibold">Pick a date</p>
      <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((d) => {
          const date = new Date(`${d.date}T12:00:00+05:30`)
          const active = d.date === current.date
          return (
            <button key={d.date} type="button" onClick={() => { setDay(d.date); onChange(null) }} className={`grid w-16 shrink-0 place-items-center rounded-2xl py-2.5 transition ${active ? 'bg-ink text-white' : 'bg-cream hover:bg-cream-300'}`}>
              <span className="text-[11px] font-semibold uppercase opacity-70">{date.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })}</span>
              <span className="font-display text-xl font-bold">{date.toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' })}</span>
              <span className="text-[10px] opacity-60">{date.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' })}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-4 mb-2 text-sm font-semibold">Pick a time (IST)</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {current.slots.map((s) => {
          const active = value && new Date(value).getTime() === s.getTime()
          return (
            <button key={s.toISOString()} type="button" onClick={() => onChange(s.toISOString())} className={`h-11 rounded-xl text-sm font-semibold transition ${active ? 'bg-lime ring-2 ring-ink' : 'bg-cream hover:bg-cream-300'}`}>
              {formatIst(s, { hour: 'numeric', minute: '2-digit' })}
            </button>
          )
        })}
      </div>
    </div>
  )
}
