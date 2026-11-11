// URL helpers shared by the public renderer and the editor.

export function normalizeUrl(raw) {
  const v = (raw || '').trim()
  if (!v) return ''
  if (/^https?:\/\//i.test(v)) return v
  return `https://${v.replace(/^\/+/, '')}`
}

export function isValidUrl(raw) {
  try {
    const u = new URL(normalizeUrl(raw))
    return ['http:', 'https:'].includes(u.protocol) && u.hostname.includes('.')
  } catch {
    return false
  }
}

export function youtubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/)
  return m ? m[1] : null
}

export function instagramEmbed(url) {
  if (!url) return null
  const m = url.match(/instagram\.com\/(?:[\w.]+\/)?(reel|reels|p|tv)\/([\w-]+)/)
  if (!m) return null
  const kind = m[1] === 'reels' ? 'reel' : m[1]
  return `https://www.instagram.com/${kind}/${m[2]}/embed`
}

export function spotifyEmbed(url) {
  if (!url) return null
  const m = url.match(/open\.spotify\.com\/(?:intl-\w+\/)?(track|album|playlist|episode|show|artist)\/(\w+)/)
  return m ? { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, compact: ['track', 'episode'].includes(m[1]) } : null
}

/** Indian numbers default to +91 when no country code is given */
export function cleanPhone(raw) {
  let p = (raw || '').replace(/[^\d+]/g, '')
  if (!p) return ''
  if (p.startsWith('+')) return p.slice(1)
  if (p.startsWith('0')) p = p.slice(1)
  if (p.length === 10) return `91${p}`
  return p
}

export function whatsappUrl(phone, message) {
  const p = cleanPhone(phone)
  const text = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${p}${text}`
}

export function hostOf(url) {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function faviconUrl(url) {
  const host = hostOf(url)
  return host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : null
}

export function formatNumber(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  const v = Number(n)
  if (v >= 10_000_000) return `${(v / 10_000_000).toFixed(1).replace(/\.0$/, '')}Cr`
  if (v >= 100_000) return `${(v / 100_000).toFixed(1).replace(/\.0$/, '')}L`
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return v.toLocaleString('en-IN')
}
