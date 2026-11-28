// Vercel Edge Function: puts the right title, description, share tags and structured data into the first HTML,
// so search engines and chat/social crawlers (which do not run JavaScript) see them. Visitors still get the normal app.
// Handles creator pages (/:username, /:username/:page), Academy, the search landing pages and legal pages.
// A creator page that does not exist answers with a real 404 (the app still shows its friendly message).
import { ARTICLES } from '../src/lib/academyContent.js'
import { SEO_PAGES } from '../src/lib/seoPages.js'

export const config = { runtime: 'edge' }

const SITE = (process.env.SITE_URL || 'https://www.joinlyy.com').replace(/\/$/, '')
const NAME = process.env.VITE_APP_NAME || 'Joinlyy'
const IMAGE = `${SITE}/og-image.png`
const OURS = /(^|\.)joinlyy\.com$|^localhost(:\d+)?$|\.vercel\.app$/i

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const clip = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t
}
const ld = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`

const STATIC = {
  '/privacy': ['Privacy Policy', `How ${NAME} collects, uses and protects your data.`],
  '/terms': ['Terms of Service', `The terms for using ${NAME}.`],
  '/blog': ['Blog: Guides for Indian Creators', `Guides on Instagram comment to DM automation, the free post scheduler, link in bio and selling with UPI, from ${NAME}.`],
  '/refund-policy': ['Refund Policy', `How refunds work on ${NAME}: what to send us and what happens next.`],
  '/data-deletion': ['Data deletion', `How to delete your ${NAME} data, including data from Instagram.`],
}

let shell = { html: '', at: 0 }
async function baseHtml(origin) {
  if (shell.html && Date.now() - shell.at < 60_000) return shell.html
  const res = await fetch(`${origin}/index.html`)
  const html = await res.text()
  if (res.ok && html.includes('<div id="root">')) shell = { html, at: Date.now() }
  return html
}

async function creatorPage(username, slug) {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return undefined
  const qs = new URLSearchParams({ p_username: username.toLowerCase() })
  if (slug) qs.set('p_slug', slug.toLowerCase())
  try {
    const res = await fetch(`${url}/rest/v1/rpc/get_public_page?${qs}`, { headers: { apikey: key } })
    if (!res.ok) return undefined
    return (await res.json()) || null // null: no such page
  } catch {
    return undefined // lookup failed: serve the plain app
  }
}

/** What to say about this URL: { status, title, description, path, image, type, noindex, lang, jsonld } or null for the plain app */
async function describe(path) {
  const parts = path.split('/').filter(Boolean)
  if (STATIC[path]) return { title: `${STATIC[path][0]} | ${NAME}`, description: STATIC[path][1], path }

  const landing = SEO_PAGES.find((p) => `/${p.slug}` === path)
  if (landing) {
    return {
      title: landing.title, description: landing.description, path,
      jsonld: { '@context': 'https://schema.org', '@graph': [
        { '@type': 'WebPage', name: landing.h1, description: landing.description, url: `${SITE}${path}`, inLanguage: 'en-IN' },
        { '@type': 'FAQPage', mainEntity: landing.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
        ...(landing.howto ? [{ '@type': 'HowTo', name: landing.howto.name, step: landing.howto.steps.map(([name, text], i) => ({ '@type': 'HowToStep', position: i + 1, name, text })) }] : []),
      ] },
    }
  }

  if (parts[0] === 'academy') {
    const article = parts[1] && ARTICLES.find((a) => a.slug === parts[1])
    if (parts[1] && !article) return { status: 404, title: `Page not found | ${NAME}`, description: '', path, noindex: true }
    if (article) {
      return {
        title: `${article.title} | ${NAME} Academy`, description: clip(article.summary, 160), path, type: 'article',
        jsonld: { '@context': 'https://schema.org', '@type': 'Article', headline: article.title, description: article.summary, url: `${SITE}${path}`, inLanguage: 'en-IN', publisher: { '@type': 'Organization', name: NAME } },
      }
    }
    return { title: `Creator guides for Indian creators | ${NAME} Academy`, description: 'Practical, step-by-step guides on link in bio, Instagram automation, selling with UPI and growing as an Indian creator.', path }
  }

  // Creator pages: /:username and /:username/:page (media-kit and product pages share the shell)
  if (parts.length >= 1 && parts.length <= 2 && !(parts[1] === 'media-kit' || parts[1] === 'p')) {
    const data = await creatorPage(parts[0], parts[1])
    if (data === undefined) return null
    if (data === null || !data.page) return { status: 404, title: `Page not found | ${NAME}`, description: 'This page does not exist.', path, noindex: true }
    const page = data.page
    const sub = data.site_page
    const seo = { ...(page.seo || {}), ...(sub?.seo || {}) }
    const name = page.display_name || page.username
    return {
      title: clip(seo.title || (sub ? `${sub.title} · ${name}` : `${name} (@${page.username}) | ${NAME}`), 70),
      description: clip(seo.description || page.bio || `All of ${name}'s links in one place.`, 160),
      path: `/${page.username}${sub ? `/${sub.slug}` : ''}`,
      image: seo.image || page.avatar_url || null,
      type: 'profile',
      noindex: seo.noindex === true || sub?.visibility === 'members' || page.username === 'joinlyyreview',
      lang: page.language || 'en',
      jsonld: { '@context': 'https://schema.org', '@type': 'ProfilePage', mainEntity: { '@type': 'Person', name, description: page.bio || undefined, image: page.avatar_url || undefined, url: `${SITE}/${page.username}` } },
    }
  }
  return null
}

function inject(html, d) {
  const url = `${SITE}${d.path === '/' ? '' : d.path}`
  const image = d.image || IMAGE
  let out = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(d.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/i, '')
    .replace(/<meta (property="og:|name="twitter:|name="robots")[^>]*>/gi, '')
    .replace(/<link rel="canonical"[^>]*>/gi, '')
    .replace(/<script type="application\/ld\+json"[\s\S]*?<\/script>/gi, '')
  if (d.lang) out = out.replace(/<html lang="[^"]*"/i, `<html lang="${esc(d.lang)}"`)
  const tags = [
    `<meta name="description" content="${esc(d.description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta name="robots" content="${d.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'}" />`,
    `<meta property="og:site_name" content="${esc(NAME)}" />`,
    `<meta property="og:type" content="${d.type || 'website'}" />`,
    `<meta property="og:title" content="${esc(d.title)}" />`,
    `<meta property="og:description" content="${esc(d.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta name="twitter:card" content="${d.image ? 'summary' : 'summary_large_image'}" />`,
    `<meta name="twitter:title" content="${esc(d.title)}" />`,
    `<meta name="twitter:description" content="${esc(d.description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    d.jsonld ? ld(d.jsonld) : '',
  ].join('\n    ')
  return out.replace('</head>', `    ${tags}\n  </head>`)
}

export default async function handler(req) {
  const url = new URL(req.url)
  const host = req.headers.get('host') || url.host
  const raw = url.searchParams.get('path') || url.pathname
  const path = ('/' + raw.replace(/^\/+/, '').replace(/\/+$/, '')).slice(0, 200)

  const html = await baseHtml(url.origin)
  const plain = () => new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' } })
  // Creators' own domains get the plain app without our canonical link, so search engines do not treat their page as ours
  if (!OURS.test(host)) {
    const bare = html.replace(/<link rel="canonical"[^>]*>/gi, '').replace(/<meta property="og:url"[^>]*>/gi, '').replace(/<script type="application\/ld\+json"[\s\S]*?<\/script>/gi, '')
    return new Response(bare, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' } })
  }

  const d = await describe(path)
  if (!d) return plain()
  return new Response(inject(html, d), {
    status: d.status || 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': d.status === 404 ? 'public, s-maxage=60' : 'public, s-maxage=300, stale-while-revalidate=3600',
    },
  })
}
