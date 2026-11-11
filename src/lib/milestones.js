import { formatNumber } from './embeds'
import { APP_NAME, INSTAGRAM_ENABLED, pageDisplayUrl } from './config'

export const MILESTONE_LADDER = [
  { metric: 'views', label: 'Page views', steps: [1_000, 10_000, 100_000, 1_000_000], format: (n) => `${formatNumber(n)} page views` },
  { metric: 'earnings', label: 'Earnings', steps: [1_000, 10_000, 100_000, 1_000_000], format: (n) => `₹${formatNumber(n)} earned` },
  { metric: 'leads', label: 'Leads', steps: [100, 1_000, 10_000], format: (n) => `${formatNumber(n)} leads` },
  { metric: 'followers', label: 'Instagram followers', steps: [10_000, 100_000, 1_000_000], format: (n) => `${formatNumber(n)} followers` },
].filter((m) => INSTAGRAM_ENABLED || m.metric !== 'followers')

/** Per metric: achieved steps, next target and progress (0–1) towards it */
export function evaluateMilestones(totals) {
  return MILESTONE_LADDER.map((m) => {
    const value = Number(totals?.[m.metric] || 0)
    const achieved = m.steps.filter((s) => value >= s)
    const next = m.steps.find((s) => value < s) || null
    const prev = achieved.at(-1) || 0
    return {
      ...m,
      value,
      achieved: achieved.map((s) => ({ id: `${m.metric}_${s}`, metric: m.metric, threshold: s, title: m.format(s) })),
      next,
      progress: next ? Math.min(1, (value - prev) / (next - prev)) : 1,
    }
  })
}

const key = (pageId) => `lib_celebrated_${pageId}`

export function celebratedIds(pageId) {
  try {
    return JSON.parse(localStorage.getItem(key(pageId)) || '[]')
  } catch {
    return []
  }
}

export function markCelebrated(pageId, ids) {
  try {
    localStorage.setItem(key(pageId), JSON.stringify([...new Set([...celebratedIds(pageId), ...ids])]))
  } catch {
    /* ignore */
  }
}

/** Draws a 1080×1080 shareable milestone card */
export async function drawMilestoneCard(canvas, { name, username, milestone }) {
  try {
    await document.fonts?.ready
  } catch {
    /* fonts optional */
  }
  const S = 1080
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')
  const display = '"Bricolage Grotesque", "DM Sans", system-ui, sans-serif'
  const sans = '"DM Sans", system-ui, sans-serif'

  ctx.fillStyle = '#15161A'
  ctx.fillRect(0, 0, S, S)
  ctx.fillStyle = '#B9AFF5'
  ctx.beginPath()
  ctx.arc(S - 80, 120, 300, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#D5F05C'
  ctx.beginPath()
  ctx.arc(90, S - 60, 180, 0, Math.PI * 2)
  ctx.fill()

  // eyebrow pill
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  roundRect(ctx, 80, 110, 360, 64, 32)
  ctx.fill()
  ctx.fillStyle = '#D5F05C'
  ctx.font = `600 26px ${sans}`
  ctx.textBaseline = 'middle'
  ctx.fillText('MILESTONE UNLOCKED', 112, 143)

  // headline (wrap)
  ctx.fillStyle = '#FFFFFF'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 120px ${display}`
  const lines = wrap(ctx, milestone, S - 160)
  let y = 420
  for (const line of lines.slice(0, 3)) {
    ctx.fillText(line, 80, y)
    y += 128
  }

  ctx.font = `italic 500 52px ${display}`
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText(`${name ? `${name} · ` : ''}thank you for the love!`.slice(0, 44), 80, y + 20)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = `600 38px ${sans}`
  ctx.fillText(pageDisplayUrl(username), 320, S - 110)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = `500 28px ${sans}`
  ctx.fillText(`Made with ${APP_NAME}`, 320, S - 66)
  return canvas
}

function wrap(ctx, text, max) {
  const words = String(text).split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > max && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
