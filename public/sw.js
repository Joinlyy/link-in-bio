// App-shell service worker.
//   /assets/*      → cache-first (hashed, immutable build files)
//   navigations    → network-first, offline fallback to the cached /index.html
//   everything else (Supabase & other cross-origin calls, /api/*, non-GET) → straight to the network, never cached
// Bump VERSION to drop old caches on the next activation.
const VERSION = 'v1'
const CACHE = `linkinbio-shell-${VERSION}`
const SHELL = ['/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('linkinbio-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase, fonts, payments: never cached
  if (url.pathname.startsWith('/api/')) return

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstPage(req))
    return
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(req))
  }
})

async function networkFirstPage(req) {
  const cache = await caches.open(CACHE)
  try {
    const res = await fetch(req)
    // Every route serves the SPA shell; keep the freshest copy for offline use
    if (res.ok && res.type === 'basic' && (res.headers.get('content-type') || '').includes('text/html')) {
      cache.put('/index.html', res.clone())
    }
    return res
  } catch {
    const cached = await cache.match('/index.html')
    return cached || new Response('<h1>You’re offline</h1><p>Reconnect and try again.</p>', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(req)
  if (cached) return cached
  const res = await fetch(req)
  if (res.ok && res.type === 'basic') cache.put(req, res.clone())
  return res
}
