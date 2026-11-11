// Vercel Routing Middleware: social apps (WhatsApp, Instagram, X, Telegram…) don't run
// JavaScript, so give their link-preview bots a tiny HTML page with the creator's
// Open Graph tags. Real visitors fall through to the SPA untouched.
export const config = { matcher: ['/((?!assets/|api/|favicon).*)'] }

const BOTS = /facebookexternalhit|facebot|twitterbot|whatsapp|telegrambot|slackbot|linkedinbot|discordbot|pinterest|skypeuripreview|applebot|redditbot|embedly|snapchat/i
const USERNAME = /^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$/

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

async function rpc(fn, params) {
  const base = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  const res = await fetch(`${base}/rest/v1/rpc/${fn}?${new URLSearchParams(params)}`, { headers: { apikey: key } })
  return res.ok ? res.json() : null
}

const APP_HOSTS = (process.env.VITE_APP_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)
const MAIN_DOMAIN = (process.env.VITE_PUBLIC_DOMAIN || '').toLowerCase()

function isAppHost(host) {
  // Until the site's own domain is set, treat every host as the main site
  if (!MAIN_DOMAIN && !APP_HOSTS.length) return true
  return APP_HOSTS.includes(host) || host === MAIN_DOMAIN || host === `www.${MAIN_DOMAIN}` || host.endsWith('.vercel.app') || host === 'localhost'
}

export default async function middleware(request) {
  if (!BOTS.test(request.headers.get('user-agent') || '')) return
  const url = new URL(request.url)
  const host = url.hostname.toLowerCase()
  let seg = url.pathname.split('/').filter(Boolean).map((s) => s.toLowerCase())

  try {
    // Creator custom domain: path is relative to their page
    if (!isAppHost(host)) {
      const username = await rpc('get_page_by_domain', { p_host: host })
      if (!username) return
      seg = [username, ...seg]
    }
  } catch {
    return
  }
  if (!seg.length || !USERNAME.test(seg[0])) return

  let title, description, image
  try {
    if (seg.length === 3 && seg[1] === 'p') {
      const data = await rpc('get_public_product', { p_username: seg[0], p_product_id: seg[2] })
      if (!data) return
      title = `${data.product.title} · ${data.page.display_name || data.page.username}`
      description = (data.product.description || '').slice(0, 200)
      image = data.product.thumbnail_url || data.page.avatar_url
    } else if (seg.length <= 2) {
      const slug = seg[1] && seg[1] !== 'media-kit' ? seg[1] : null
      const data = await rpc('get_public_page', slug ? { p_username: seg[0], p_slug: slug } : { p_username: seg[0] })
      if (!data) return
      const p = data.page
      const seo = { ...(p.seo || {}), ...(data.site_page?.seo || {}) }
      const name = p.display_name || p.username
      title = seo.title || (data.site_page ? `${data.site_page.title} · ${name}` : `${name} (@${p.username})`)
      description = seo.description || p.bio || `All of ${name}'s links in one place.`
      image = seo.image || p.avatar_url
    } else return
  } catch {
    return
  }

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="profile">
<meta property="og:url" content="${esc(url.href)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
</head><body><a href="${esc(url.href)}">${esc(title)}</a></body></html>`

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
