// Vercel Edge Function: /sitemap.xml. Lists the home page, search landing pages, Academy and every published,
// indexable creator page (opted-out and hidden pages are left out by the database).
import { ARTICLES } from '../src/lib/academyContent.js'
import { SEO_PAGES } from '../src/lib/seoPages.js'

export const config = { runtime: 'edge' }

const SITE = (process.env.SITE_URL || 'https://www.joinlyy.com').replace(/\/$/, '')
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export default async function handler() {
  const entries = [
    { loc: '/', priority: '1.0' },
    ...SEO_PAGES.map((p) => ({ loc: `/${p.slug}`, priority: '0.9' })),
    { loc: '/academy', priority: '0.7' },
    ...ARTICLES.map((a) => ({ loc: `/academy/${a.slug}`, priority: '0.6' })),
    { loc: '/privacy', priority: '0.2' },
    { loc: '/terms', priority: '0.2' },
    { loc: '/refund-policy', priority: '0.2' },
  ]

  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/rpc/public_sitemap`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: '{}' })
      if (res.ok) for (const p of await res.json()) entries.push({ loc: `/${encodeURIComponent(p.username)}`, lastmod: String(p.updated_at).slice(0, 10), priority: '0.5' })
    } catch {
      // creator pages are left out this time; the rest is still valid
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
    .map((e) => `  <url><loc>${esc(SITE + (e.loc === '/' ? '' : e.loc))}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}<priority>${e.priority}</priority></url>`)
    .join('\n')}\n</urlset>\n`
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' } })
}
