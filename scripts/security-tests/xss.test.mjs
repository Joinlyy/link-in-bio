// Renders a creator page full of hostile content with the app's real components and checks the HTML.
// Run from the project folder: node scripts/security-tests/xss.test.mjs
import { createServer } from 'vite'

const vite = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(ok ? 'PASS' : 'FAIL', name, detail)
}

try {
  const { createRequire } = await import('node:module')
  const require = createRequire(`${process.cwd()}/package.json`)
  const React = require('react')
  const { renderToString } = require('react-dom/server')
  const { MemoryRouter } = require('react-router-dom')
  const { default: PageRenderer } = await vite.ssrLoadModule('/src/components/page/PageRenderer.jsx')
  const { socialHref } = await vite.ssrLoadModule('/src/lib/socials.js')
  const { normalizeUrl } = await vite.ssrLoadModule('/src/lib/embeds.js')

  const evil = '<script>alert(1)</script><img src=x onerror=alert(2)>'
  const page = {
    id: 'p1', username: 'evil', display_name: evil, bio: evil, language: 'en',
    theme: { tagline: evil }, socials: { instagram: 'javascript:alert(3)', youtube: 'data:text/html,<script>alert(4)</script>', website: 'vbscript:msgbox(5)' },
    whatsapp: { open: true, number: '9999999999', label: evil },
  }
  const blocks = [
    { id: 'b1', type: 'link', is_active: true, data: { title: evil, url: 'javascript:alert(6)' } },
    { id: 'b2', type: 'text', is_active: true, data: { text: evil } },
    { id: 'b3', type: 'heading', is_active: true, data: { text: evil } },
    { id: 'b4', type: 'faq', is_active: true, data: { title: evil, items: [{ q: evil, a: evil }] } },
    { id: 'b5', type: 'testimonials', is_active: true, data: { title: evil, items: [{ quote: evil, name: evil, role: evil }] } },
    { id: 'b6', type: 'cards', is_active: true, data: { title: evil, items: [{ id: 'c1', title: evil, text: evil, action: 'link', url: 'data:text/html,x' }] } },
    { id: 'b7', type: 'youtube', is_active: true, data: { url: 'javascript:alert(7)//youtu.be/aaaaaaaaaaa' } },
  ]
  const products = [{ id: 'pr1', type: 'link', title: evil, description: evil, price_inr: 10, show_on_page: true, data: { url: 'javascript:alert(8)' } }]

  const html = renderToString(
    React.createElement(MemoryRouter, null, React.createElement(PageRenderer, { page, blocks, products })),
  )
  check('No live <script> tag from creator text', !/<script>alert/i.test(html))
  check('No live onerror attribute from creator text', !/<img[^>]*onerror/i.test(html))
  check('Creator text is escaped as text', html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
  const hrefs = [...html.matchAll(/(?:href|src)="([^"]*)"/g)].map((m) => m[1])
  const bad = hrefs.filter((h) => /^\s*(javascript|data|vbscript|file):/i.test(h))
  check('No javascript:/data:/vbscript:/file: in any href or src', bad.length === 0, bad.join(' '))
  check('Rendered links found to inspect', hrefs.length > 0, `${hrefs.length} links`)

  for (const [kind, handle] of [['instagram', 'javascript:alert(1)'], ['youtube', 'data:text/html,x'], ['website', 'vbscript:x'], ['website', 'file:///etc/passwd'], ['website', 'JaVaScRiPt:alert(1)']]) {
    const href = socialHref(kind, handle) || ''
    check(`Social ${kind} "${handle}" is made safe`, !/^\s*(javascript|data|vbscript|file):/i.test(href), `-> ${href}`)
  }
  for (const u of ['javascript:alert(1)', ' javascript:alert(1)', 'data:text/html,x', 'vbscript:x']) {
    check(`Link "${u}" can't run`, !/^\s*(javascript|data|vbscript):/i.test(normalizeUrl(u)), `-> ${normalizeUrl(u)}`)
  }
} finally {
  await vite.close()
}
process.exit(failed ? 1 : 0)
