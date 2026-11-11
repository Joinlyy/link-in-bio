// 1:1 session slot generation. All times are IST; availability is weekly windows.
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function istDayString(offsetDays = 0) {
  return new Date(Date.now() + 5.5 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10)
}

const toMinutes = (hhmm) => {
  const [h, m] = (hhmm || '0:0').split(':').map(Number)
  return h * 60 + m
}

/**
 * @param data   product.data: { duration, availability: [{ day, start, end }], advance_days, buffer }
 * @param booked ISO strings of taken slot starts
 * @returns [{ date: 'YYYY-MM-DD', slots: [Date] }]
 */
export function buildSlots(data, booked = []) {
  const duration = Number(data?.duration) || 30
  const step = duration + (Number(data?.buffer) || 0)
  const days = Math.min(Number(data?.advance_days) || 14, 60)
  const windows = data?.availability || []
  const taken = new Set(booked.map((b) => new Date(b).getTime()))
  const earliest = Date.now() + 2 * 3600_000
  const out = []
  for (let i = 0; i < days; i++) {
    const date = istDayString(i)
    const weekday = new Date(`${date}T12:00:00+05:30`).getUTCDay()
    const slots = []
    for (const w of windows.filter((x) => Number(x.day) === weekday)) {
      for (let m = toMinutes(w.start); m + duration <= toMinutes(w.end); m += step) {
        const hh = String(Math.floor(m / 60)).padStart(2, '0')
        const mm = String(m % 60).padStart(2, '0')
        const at = new Date(`${date}T${hh}:${mm}:00+05:30`)
        if (at.getTime() >= earliest && !taken.has(at.getTime())) slots.push(at)
      }
    }
    if (slots.length) out.push({ date, slots: slots.sort((a, b) => a - b) })
  }
  return out
}

export function formatIst(d, opts) {
  return new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', ...opts })
}

/** Google Calendar "add event" link */
export function calendarUrl({ title, start, end, details }) {
  const f = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const p = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${f(start)}/${f(end)}`, details: details || '' })
  return `https://calendar.google.com/calendar/render?${p}`
}
