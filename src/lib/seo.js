// Search and sharing tags, set from the app. The edge function (api/seo.js) puts the same tags into the first
// HTML so crawlers that do not run JavaScript (WhatsApp, Instagram, X, LinkedIn) see them too.
import { APP_NAME } from './config'

export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://www.joinlyy.com').replace(/\/$/, '')
export const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`

function setTag(selector, create, attrs) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement(create)
    document.head.appendChild(el)
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
}
const meta = (key, value, attr = 'name') => setTag(`meta[${attr}="${key}"]`, 'meta', { [attr]: key, content: value })

/** Title, description, canonical link, Open Graph and Twitter tags, robots and language for the current page */
export function applySeo({ title, description, path, image, type = 'website', noindex = false, lang = 'en', canonical }) {
  const url = canonical || `${SITE_URL}${path === '/' ? '' : path || window.location.pathname}`
  document.title = title
  document.documentElement.lang = lang
  meta('description', description)
  setTag('link[rel="canonical"]', 'link', { rel: 'canonical', href: url })
  meta('robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large')
  meta('og:site_name', APP_NAME, 'property')
  meta('og:type', type, 'property')
  meta('og:title', title, 'property')
  meta('og:description', description, 'property')
  meta('og:url', url, 'property')
  meta('og:image', image || DEFAULT_IMAGE, 'property')
  meta('twitter:card', image && image !== DEFAULT_IMAGE ? 'summary' : 'summary_large_image')
  meta('twitter:title', title)
  meta('twitter:description', description)
  meta('twitter:image', image || DEFAULT_IMAGE)
}

/** Structured data for the current page. Pass null to clear it. */
export function setJsonLd(data, id = 'page-jsonld') {
  const old = document.getElementById(id)
  if (old) old.remove()
  if (!data) return
  const el = document.createElement('script')
  el.id = id
  el.type = 'application/ld+json'
  el.textContent = JSON.stringify(data)
  document.head.appendChild(el)
}
